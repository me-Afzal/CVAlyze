# Backend/gateway/tests/test_gateway_v1.py
import sys
import os
import time
import pytest
from fastapi.testclient import TestClient
from jose import jwt
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.main import app

# Load env variables
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
TEST_USERNAME = os.getenv("TEST_USERNAME")
ALGORITHM = "HS256"

# Generate JWT token for testuser, valid for 1 day
payload = {
    "sub": TEST_USERNAME,
    "exp": int(time.time()) + 24 * 3600
}
token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
auth_headers = {"Authorization": f"Bearer {token}"}

client = TestClient(app)


@pytest.mark.parametrize("path", [
    "/", 
    "/api/v1/",
])
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
