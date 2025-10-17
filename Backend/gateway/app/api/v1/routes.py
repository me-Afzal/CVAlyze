import os
import httpx
from fastapi import APIRouter,Request,UploadFile,File,HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from jose import jwt,JWTError
from io import BytesIO
from dotenv import load_dotenv
from prometheus_fastapi_instrumentator import Instrumentator

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = 'HS256'

USER_SERVICE="http://localhost:8001/api/v1"
ETL_SERVICE="http://localhost:8002/api/v1"


router=APIRouter()

# v1 home endpoint
@router.get("/")
def root():
    return {"message":"Welcome to CVAlyze API Gateway v1"}
    
# User creation endpoint
@router.post('/register')
async def register_user(request: Request):
    async with httpx.AsyncClient() as client:
        response= await client.post(f'{USER_SERVICE}/register',json=await request.json())
    return JSONResponse(content=response.json(), status_code=response.status_code)        

# Login endpoint (Return JWT)
@router.post('/login')
async def login_user(request: Request):
    async with httpx.AsyncClient() as client:
        response= await client.post(f'{USER_SERVICE}/login',json=await request.json())
    return JSONResponse(content=response.json(), status_code=response.status_code)

# User password updation endpoint
@router.put('/register')
async def update_pw(request: Request):
    async with httpx.AsyncClient() as client:
        response= await client.put(f'{USER_SERVICE}/register',json=await request.json())
    return JSONResponse(content=response.json(), status_code=response.status_code)

# User account deletion endpoint
@router.post('/register/delete')
async def delete_user(request: Request):
    user_id=request.state.user
    async with httpx.AsyncClient() as client:
        response_user= await client.post(f'{USER_SERVICE}/register/delete',json=await request.json())
    return JSONResponse(content=response_user.json(), status_code=response_user.status_code)  

# ETL endpoint
@router.post('/upload_cvs')
async def upload_cvs(files: List[UploadFile]= File(...)):
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    # Prepare files for httpx multipart upload
    files_to_send = []
    for file in files:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"{file.filename} is empty.")
        # httpx requires tuple: (field_name, (filename, fileobj, content_type))
        files_to_send.append(
            ("files", (file.filename, BytesIO(content), file.content_type))
        )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(150.0)) as client:
            response = await client.post(f'{ETL_SERVICE}/upload_cvs', files=files_to_send)
            result = response.json()
    except httpx.ReadTimeout:
        raise HTTPException(status_code=504,detail="ETL service timed out after 2 minutes.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ETL service request failed: {str(e)}")

    return JSONResponse(content=result,status_code=response.status_code)

