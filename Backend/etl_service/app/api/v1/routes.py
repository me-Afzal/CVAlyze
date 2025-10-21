"""
Routes for CVAlyze ETL Service.
Handles resume uploads, processing, and provides access to logs.
"""

import logging
import os
from io import BytesIO
from typing import List
from contextlib import asynccontextmanager
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from app.api.v1.cv_process import process_cvs, get_active_api_key

# ------------------ Logging Setup ------------------
logger = logging.getLogger("etl_service")


@asynccontextmanager
async def lifespan(app):
    """
    FastAPI lifespan event handler.
    Executes startup and shutdown logic for the ETL service.
    """
    logger.info("ETL Service starting up...")
    await get_active_api_key()
    yield
    logger.info("ETL Service shutting down...")


# Router with lifespan
router = APIRouter(lifespan=lifespan)


@router.get("/")
def root():
    """
    Health check endpoint.
    Returns a welcome message for the ETL Service.
    """
    logger.info("ETL Service root endpoint accessed")
    return {"message": "ETL Service v1 running successfully"}


@router.post("/upload_cvs")
async def upload_cvs(files: List[UploadFile] = File(...)):
    """
    Upload and process one or more resume files (PDF, DOCX, etc.).
    Args:
        files (List[UploadFile]): List of uploaded files.
    Returns:
        dict: Processed CV data or error details.
    """
    if not files or len(files) == 0:
        logger.warning("Upload attempt with no files provided.")
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    logger.info("Received %d files for processing", len(files))
    processed_files = []

    for file in files:
        try:
            content = await file.read()
            if not content:
                logger.warning("Empty file uploaded: %s", file.filename)
                raise HTTPException(status_code=400, detail=f"{file.filename} is empty.")
            processed_files.append((file.filename, BytesIO(content)))
        except Exception as exc:
            logger.exception("Error reading file %s: %s", file.filename, str(exc))
            raise HTTPException(status_code=500, detail=f"Error reading {file.filename}: {str(exc)}") from exc

    try:
        result = await process_cvs(processed_files)
        logger.info("CV processing successful for %d files.", len(processed_files))
    except Exception as exc:
        logger.exception("CV processing failed: %s", str(exc))
        raise HTTPException(status_code=500, detail=f"CV processing failed: {str(exc)}") from exc

    return result
