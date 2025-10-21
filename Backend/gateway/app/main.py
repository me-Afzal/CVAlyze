import os
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from app.api.v1.routes import router as v1_router
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

# ------------------ Logging Setup ------------------
LOG_FILE_PATH = "gateway_logs.txt"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_PATH),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("gateway")

app = FastAPI(
    title="CVAlyze API Gateway",
    version="1.0.0"
)

Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware('http')
async def token_auth_middleware(request: Request,call_next):
    if request.url.path in ['/docs','/redoc','/openapi.json','/register','/login','/metrics']:
        return await call_next(request)
    if request.method=="OPTIONS":
        return await call_next(request)
    
    token=request.headers.get('Authorization')
    
    if not token or not token.startswith('Bearer'):
        return JSONResponse(status_code=401,content={'detail':'Invalid token'})
    
    try:
        token=token.split(' ')[1]
        payload=jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        request.state.user=payload.get('sub')
        response=await call_next(request)
        return response
    except JWTError:
        return JSONResponse(status_code=401,
                            content={'detail':'Token is expired or invalid'})
    
# Include versioned router
app.include_router(v1_router, prefix="/api/v1")

app.get("/")
def root():
    return {"message": "Welcome to CVAlyze API Gateway"}