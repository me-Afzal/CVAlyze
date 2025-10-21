"""
CVAlyze API Gateway Routes Module.

This module defines all v1 API routes for the CVAlyze Gateway service.
It includes endpoints for user registration, login, password updates,
user deletion, and CV uploads routed to the ETL service.

Logging is integrated to record all key API interactions and errors
into a dedicated gateway log file for monitoring and debugging.
"""

import os
import httpx
import logging
from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List
from jose import jwt, JWTError  # pylint: disable=unused-import
from io import BytesIO
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Configure a logger for the gateway
logger = logging.getLogger("gateway")

# Load environment variables for JWT authentication
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

# Service URLs (can be updated when deployed in Kubernetes)
USER_SERVICE = "http://localhost:8001/api/v1"
ETL_SERVICE = "http://localhost:8002/api/v1"

# Create a router instance for API version v1
router = APIRouter()


@router.get("/")
def root():
    """
    Root endpoint for the API Gateway v1.

    Returns:
        dict: A welcome message for the API Gateway v1.
    """
    logger.info("Gateway v1 root accessed")
    return {"message": "Welcome to CVAlyze API Gateway v1"}


@router.post("/register")
async def register_user(request: Request):
    """
    Register a new user via the User Service.

    Args:
        request (Request): The incoming HTTP request with user registration data.

    Returns:
        JSONResponse: The response returned by the User Service.
    """
    logger.info("Register user request received")

    # Forward registration data to the user service
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{USER_SERVICE}/register", json=await request.json())

    logger.info("User registration status: %s", response.status_code)
    return JSONResponse(content=response.json(), status_code=response.status_code)


@router.post("/login")
async def login_user(request: Request):
    """
    Handle user login requests via the User Service.

    Args:
        request (Request): The incoming HTTP request with login credentials.

    Returns:
        JSONResponse: The JWT token or error message from the User Service.
    """
    logger.info("User login attempt")

    async with httpx.AsyncClient() as client:
        response = await client.post(f"{USER_SERVICE}/login", json=await request.json())

    logger.info("Login response: %s", response.status_code)
    return JSONResponse(content=response.json(), status_code=response.status_code)


@router.put("/register")
async def update_pw(request: Request):
    """
    Update a user's password.

    Args:
        request (Request): The incoming HTTP request with password update data.

    Returns:
        JSONResponse: Response from the User Service with status of update.
    """
    logger.info("User password update request received")

    async with httpx.AsyncClient() as client:
        response = await client.put(f"{USER_SERVICE}/register", json=await request.json())

    logger.info("Password update status: %s", response.status_code)
    return JSONResponse(content=response.json(), status_code=response.status_code)


@router.post("/register/delete")
async def delete_user(request: Request):
    """
    Delete a user account.

    Args:
        request (Request): The incoming HTTP request containing user deletion data.

    Returns:
        JSONResponse: Response from the User Service with deletion status.
    """
    user_id = getattr(request.state, "user", None)
    logger.warning("User deletion requested by: %s", user_id)

    async with httpx.AsyncClient() as client:
        response_user = await client.post(f"{USER_SERVICE}/register/delete", json=await request.json())

    logger.info("User delete status: %s", response_user.status_code)
    return JSONResponse(content=response_user.json(), status_code=response_user.status_code)


@router.post("/upload_cvs")
async def upload_cvs(files: List[UploadFile] = File(...)):
    """
    Upload and forward CV files to the ETL service for processing.

    Args:
        files (List[UploadFile]): A list of CV files uploaded by the user.

    Raises:
        HTTPException: If no files are uploaded, if a file is empty,
                       or if the ETL service request fails.

    Returns:
        JSONResponse: Response from the ETL service.
    """
    if not files or len(files) == 0:
        logger.warning("Upload attempt with no files")
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    logger.info("Uploading %d files to ETL service", len(files))

    # Prepare files for httpx multipart upload
    files_to_send = []
    for file in files:
        content = await file.read()
        if not content:
            logger.warning("Empty file uploaded: %s", file.filename)
            raise HTTPException(status_code=400, detail=f"{file.filename} is empty.")
        files_to_send.append(("files", (file.filename, BytesIO(content), file.content_type)))

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(150.0)) as client:
            response = await client.post(f"{ETL_SERVICE}/upload_cvs", files=files_to_send)
            result = response.json()
        logger.info("ETL upload successful with status code: %s", response.status_code)

    except httpx.ReadTimeout:
        logger.error("ETL service timed out after 2 minutes.")
        raise HTTPException(status_code=504, detail="ETL service timed out after 2 minutes.")

    except Exception as e:
        # Logs the full traceback for debugging
        logger.exception("ETL service request failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"ETL service request failed: {str(e)}") from e

    return JSONResponse(content=result, status_code=response.status_code)
