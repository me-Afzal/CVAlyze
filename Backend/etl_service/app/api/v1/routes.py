"""
Routes for CVAlyze ETL Service.
Handles resume uploads, processing, and provides access to logs.
"""

import logging
import asyncio
import os
from io import BytesIO
from typing import List
from contextlib import asynccontextmanager
from fastapi import APIRouter, File, UploadFile, HTTPException
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

ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"] # Supported cv/resume file types

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
    Upload and process one or more resume files asynchronously.
    """
    if not files or len(files) == 0:
        logger.warning("Upload attempt with no files provided.")
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    # Validate extensions
    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            logger.warning("Unsupported file type: %s", file.filename)
            raise HTTPException(status_code=400,
                                detail=f"Unsupported file type: {ext}")

    logger.info("Received %d files for processing", len(files))

    # Async concurrent read
    async def read_file(file: UploadFile):
        """Read file content asynchronously."""
        try:
            content = await file.read()
            if not content:
                raise ValueError("Empty file")
            return file.filename, BytesIO(content)
        except Exception as e:
            logger.exception("Error reading file %s: %s", file.filename, str(e))
            raise HTTPException(status_code=500,
                                detail=f"Error reading {file.filename}: {str(e)}")

    processed_files = await asyncio.gather(*[read_file(file) for file in files])

    try:
        result = await asyncio.wait_for(process_cvs(processed_files), timeout=300)
        logger.info("CV processing successful for %d files.", len(processed_files))
    except asyncio.TimeoutError:
        logger.error("CV processing timed out.")
        raise HTTPException(status_code=504, detail="Processing timed out. Try again.")
    except Exception as e:
        logger.exception("CV processing failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"CV processing failed: {str(e)}") from e

    return result
