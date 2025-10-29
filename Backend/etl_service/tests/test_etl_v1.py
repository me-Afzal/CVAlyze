"""
Pytest test cases for ETL Service (v1 routes).
Covers health check, file upload validation, and log retrieval.
"""

import io
import os
import sys
import pytest
# Add parent directory (etl_service) to sys.path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app


# Initialize test client for FastAPI
client = TestClient(app)


# ------------------- Fixtures -------------------
@pytest.fixture(scope="module", autouse=True)
def setup_test_env():
    """Setup test environment before all tests."""
    # Ensure log file exists for testing /logs endpoint
    log_path = "etl_service.log"
    if not os.path.exists(log_path):
        with open(log_path, "w", encoding="utf-8") as f:
            f.write("Test log entry\n")
    yield


# ------------------- Tests -------------------
def test_root_endpoint():
    """Test the root endpoint returns correct message."""
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome to CVAlyze ETL Service" in response.json()["message"]


def test_v1_health_check():
    """Test the versioned health check endpoint."""
    response = client.get("/api/v1/")
    assert response.status_code == 200
    assert "ETL Service v1 running successfully" in response.json()["message"]


def test_upload_no_files():
    response = client.post("/api/v1/upload_cvs", files={})
    assert response.status_code == 422

    # The response is a list of validation errors
    errors = response.json()["detail"]
    assert len(errors) > 0
    assert errors[0]["loc"] == ["body", "files"]
    assert errors[0]["msg"] == "Field required"


def test_upload_invalid_file_type():
    """Test upload_cvs with unsupported file type."""
    test_file = io.BytesIO(b"dummy data")
    response = client.post(
        "/api/v1/upload_cvs",
        files={"files": ("test.csv", test_file, "text/csv")},
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_logs_endpoint_exists():
    """Test that /logs endpoint returns the log file."""
    response = client.get("/logs")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
