from fastapi import APIRouter, File, UploadFile,HTTPException
from typing import List
from io import BytesIO
import pandas as pd
from contextlib import asynccontextmanager
from app.api.v1.cv_process import process_cvs,get_active_api_key


@asynccontextmanager
async def lifespan(app):
    # Startup code
    await get_active_api_key()
    yield

router = APIRouter(lifespan=lifespan)

@router.get("/")
def root():
    return {"message": "ETL Service"}

@router.post("/upload_cvs")
async def upload_cvs(files: List[UploadFile] = File(...)):
    # Check if files were actually provided
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    processed_files = []

    for file in files:
        try:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail=f"{file.filename} is empty.")
            processed_files.append((file.filename, BytesIO(content)))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading {file.filename}: {str(e)}")

    if len(processed_files) == 0:
        raise HTTPException(status_code=400, detail="No valid files to process.")

    try:
        result = await process_cvs(processed_files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CV processing failed: {str(e)}")

    return result
