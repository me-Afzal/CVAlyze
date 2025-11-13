# Backend/user_service/tests/test_user_v1.py
import sys
import os
import pytest
from fastapi.testclient import TestClient
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Load environment variables from .env
load_dotenv()

from app.main import app

client = TestClient(app)

# Load test credentials from env
TEST_USERNAME = os.getenv("TEST_USERNAME")
TEST_PASSWORD = os.getenv("TEST_PASSWORD")
SECRET_KEY = os.getenv("SECRET_KEY")

# ------------------ Tests ------------------

def test_root_endpoint():
    """Test root endpoint of User Service."""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


@pytest.mark.parametrize("user_data", [
    {"username": TEST_USERNAME, "password": TEST_PASSWORD}
])
def test_login_user(user_data):
    """Test login endpoint with valid credentials."""
    response = client.post("/api/v1/login", json=user_data)
    assert response.status_code == 200
    json_data = response.json()
    assert "Token" in json_data


def test_register_user():
    """Test registration endpoint with a new dummy user."""
    dummy_user = {
        "username": "dummyuser",
        "password": "dummy1234"
    }
    
    # First, try to delete the user if it exists (ignore errors)
    delete_data = {
        "username": "dummyuser",
        "password": "dummy1234"
    }
    client.post("/api/v1/register/delete", json=delete_data)
    # We don't check the response - user might not exist
    
    # Now register the user
    response = client.post("/api/v1/register", json=dummy_user)
    assert response.status_code == 200
    json_data = response.json()
    assert "Message" in json_data


def test_update_password():
    """Test password update endpoint for existing user."""
    update_data = {
        "username": "dummyuser",
        "oldpassword": "dummy1234",
        "newpassword": "dummy5678"
    }
    response = client.put("/api/v1/register/update", json=update_data)
    # Can return 200 if successful
    assert response.status_code == 200
    json_data = response.json()
    assert "Message" in json_data


def test_delete_user():
    """Test delete user endpoint."""
    delete_data = {
        "username": "dummyuser",
        "password": "dummy5678"
    }
    response = client.post("/api/v1/register/delete", json=delete_data)
    # Can return 200 if user existed and deleted, 400 if not found
    assert response.status_code == 200
    json_data = response.json()
    assert "Message" in json_data
        
