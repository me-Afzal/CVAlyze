# Backend/gateway/tests/test_gateway_v1.py
import sys
import os
import time
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from jose import jwt
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.main import app

# -------------------- Mock Redis for Rate Limiter --------------------
@pytest.fixture(autouse=True)
def mock_redis_rate_limiter():
    """
    Mock Redis connection for the custom rate limiter in app.state.redis.
    This bypasses actual Redis calls during testing.
    """
    # Create a mock Redis client
    mock_redis = MagicMock()
    mock_redis.incr = AsyncMock(return_value=1)  # Always return count of 1 (under limit)
    mock_redis.expire = AsyncMock(return_value=True)
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.aclose = AsyncMock(return_value=None)
    
    # Inject mock Redis into app state
    app.state.redis = mock_redis
    
    yield mock_redis
    
    # Cleanup
    app.state.redis = None


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
@pytest.mark.parametrize("path", ["/api/v1/"])
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


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_metrics_endpoint():
    """Test Prometheus metrics endpoint."""
    response = client.get("/metrics")
    assert response.status_code == 200


def test_blocked_path():
    """Test that non-whitelisted paths are blocked."""
    response = client.get("/api/v1/nonexistent", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Not found"


def test_unauthorized_access():
    """Test that protected endpoints require authentication."""
    response = client.post("/api/v1/upload_cvs", files={})
    assert response.status_code == 401


def test_invalid_token():
    """Test that invalid tokens are rejected."""
    bad_headers = {"Authorization": "Bearer invalid_token_here"}
    response = client.post("/api/v1/upload_cvs", files={}, headers=bad_headers)
    assert response.status_code == 401