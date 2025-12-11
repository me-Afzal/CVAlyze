# Backend/gateway/tests/test_gateway_v1.py
import sys
import os
import time
import pytest
from fastapi.testclient import TestClient
from fastapi_limiter import FastAPILimiter
from jose import jwt
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.main import app

# -------------------- Disable Rate Limiter in CI --------------------
@pytest.fixture(autouse=True)
def mock_rate_limiter(monkeypatch):
    """
    Fully mock FastAPILimiter for unit tests — bypass Redis and rate limits.
    Prevents 'You must call FastAPILimiter.init' and 'evalsha' errors.
    """
    # Pretend limiter is initialized
    monkeypatch.setattr(FastAPILimiter, "init", lambda *a, **kw: None)
    monkeypatch.setattr(FastAPILimiter, "close", lambda *a, **kw: None)

    # Mock Redis-like async client
    class MockRedis:
        def __init__(self):
            self.storage = {}
            self.expiry = {}

        async def incr(self, key):
            self.storage[key] = self.storage.get(key, 0) + 1
            return self.storage[key]

        async def expire(self, key, seconds):
            # Ignore TTL timer (not needed in tests)
            self.expiry[key] = seconds
            return True

        async def evalsha(self, *args, **kwargs):
            return None

    mock_redis = MockRedis()
    monkeypatch.setattr(FastAPILimiter, "redis", mock_redis)


    # Async identifier
    async def mock_identifier(request):
        return "test-user"

    # Async callback
    async def mock_http_callback(request, response, pexpire):
        return None

    monkeypatch.setattr(FastAPILimiter, "identifier", mock_identifier)
    monkeypatch.setattr(FastAPILimiter, "http_callback", mock_http_callback)

    # Disable RateLimiter dependency entirely
    monkeypatch.setattr(FastAPILimiter, "__call__", lambda *a, **kw: None)

    yield


# -------------------- Load Env and Setup JWT --------------------
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "testsecret")
TEST_USERNAME = os.getenv("TEST_USERNAME", "testuser")
ALGORITHM = "HS256"

# Generate JWT token for testuser, valid for 1 day
payload = {
    "sub": TEST_USERNAME,
    "exp": int(time.time()) + 24 * 3600
}
token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
auth_headers = {"Authorization": f"Bearer {token}"}

client = TestClient(app)


# -------------------- Tests --------------------
@pytest.mark.parametrize("path", ["/", "/api/v1/"])
def test_root_endpoints(path):
    """Test root endpoints for Gateway service."""
    response = client.get(path, headers=auth_headers)
    assert response.status_code == 200
    assert "message" in response.json()


def test_upload_cvs_no_files():
    """Test /upload_cvs endpoint with no files uploaded."""
    response = client.post("/api/v1/upload_cvs", files={}, headers=auth_headers)
    # FastAPI validation will return 422 Unprocessable Entity
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert errors[0]["loc"] == ["body", "files"]
    assert errors[0]["msg"] == "Field required"


def test_openapi_docs():
    """Check if OpenAPI docs are available."""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "<title>FastAPI</title>" in response.text or "swagger-ui" in response.text
