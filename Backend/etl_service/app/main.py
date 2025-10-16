from fastapi import FastAPI, File, UploadFile
from typing import List
from io import BytesIO
import pandas as pd
from contextlib import asynccontextmanager
from app.cv_process import process_cvs,get_active_api_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code
    await get_active_api_key()
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/")
def root():
    return {"message": "ETL Service"}

@app.post("/upload_cvs/")
async def upload_cvs(files: List[UploadFile] = File(...)):
    processed_files = []
    for file in files:
        content = await file.read()
        processed_files.append((file.filename, BytesIO(content)))

    result=await process_cvs(processed_files)   
    return result
