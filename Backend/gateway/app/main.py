"""Gateway Service for CVAlyze application.
Handles routing, authentication, and logging for incoming API requests."""

import os
import logging
import sys
from datetime import datetime
from typing import List
from contextlib import asynccontextmanager
import httpx
import pytz
import redis.asyncio as redis
from fastapi import FastAPI, Request, Depends, Query, HTTPException
from fastapi.responses import JSONResponse, FileResponse,PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from prometheus_fastapi_instrumentator import Instrumentator
from jose import jwt
from jose import JWTError
from dotenv import load_dotenv
from app.api.v1.routes import router as v1_router
from jose import jwt,JWTError
from dotenv import load_dotenv
import os

load_dotenv()

# Load environment variables for JWT authentication
SECRET_KEY = os.getenv("SECRET_KEY")
REDIS_URL = os.getenv("REDIS_URL")
ALGORITHM = "HS256"

# Service URLs
USER_SERVICE = "http://cv-user-service:8001/"
ETL_SERVICE = "http://cv-etl-service:8002/"

# ------------------ Logging Setup with IST Format ------------------

class ISTFormatter(logging.Formatter):
    """Custom logging formatter to convert timestamps to IST timezone."""
    def formatTime(self, record, datefmt=None):
        """Convert UTC time to IST for log records."""
        ist = pytz.timezone("Asia/Kolkata")
        dt = datetime.fromtimestamp(record.created, tz=ist)
        if datefmt:
            return dt.strftime(datefmt)
        return dt.isoformat()

# 1. Create a handler for standard output (for INFO and DEBUG logs)
stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setFormatter(ISTFormatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))
stdout_handler.addFilter(lambda record: record.levelno <= logging.INFO)

# 2. Create a handler for standard error (for WARNING and above)
stderr_handler = logging.StreamHandler(sys.stderr)
stderr_handler.setFormatter(ISTFormatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))
stderr_handler.setLevel(logging.WARNING)

# 3. Configure application's logger
logger = logging.getLogger("gateway")
logger.setLevel(logging.INFO)
if logger.hasHandlers():
    logger.handlers.clear()
logger.propagate = False
logger.addHandler(stdout_handler)
logger.addHandler(stderr_handler)

# 4. Configure Uvicorn's logger to use the same handlers
uvicorn_logger = logging.getLogger("uvicorn")
uvicorn_logger.setLevel(logging.INFO)
if uvicorn_logger.hasHandlers():
    uvicorn_logger.handlers.clear()
uvicorn_logger.propagate = False
uvicorn_logger.addHandler(stdout_handler)
uvicorn_logger.addHandler(stderr_handler)

# 5. Disable the access
uvicorn_access_logger = logging.getLogger("uvicorn.access")
if uvicorn_access_logger.hasHandlers():
    uvicorn_access_logger.handlers.clear()
uvicorn_access_logger.propagate = False

# 6. Reduce verbosity of other libraries
logging.getLogger("httpx").setLevel(logging.WARNING)

logger.info("Starting Gateway Service")

# ------------------ Lifespan for Redis for Rate limit ------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup logic with proper error handling"""
    redis_conn = None
    
    try:
        # Connect to Redis with connection pooling
        redis_conn = await redis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=10,  # Connection pooling
            socket_connect_timeout=5,  # Connection timeout
            socket_timeout=5,  # Operation timeout
            retry_on_timeout=True,
            retry_on_error=[ConnectionError, TimeoutError]
        )
        
        # Test the connection
        await redis_conn.ping()
        
        await FastAPILimiter.init(redis_conn)
        logger.info("Redis connected successfully for rate limiting")
        
    except redis.ConnectionError as e:
        logger.error(f"Failed to connect to Redis: {e}")
        logger.warning("Rate limiting will be disabled")
        
    except Exception as e:
        logger.error(f"Unexpected error connecting to Redis: {e}")

    yield  # App runs here

    # Shutdown logic
    if redis_conn:
        try:
            await redis_conn.close()
            logger.info("Redis connection closed")
        except Exception as e:
            logger.error(f"Error closing Redis connection: {e}")

# ------------------ FastAPI App ------------------
app = FastAPI(
    title="CVAlyze API Gateway",
    version="1.0.0",
    lifespan=lifespan
)

Instrumentator().instrument(app).expose(app)

# Cors middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://cv-alyze.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ Middleware ------------------
@app.middleware("http")
async def token_auth_middleware(request: Request, call_next):
    """JWT authentication middleware that protects API routes
        except login/register/metrics."""

    # Allow open routes (including versioned ones)
    open_paths = [
        "/docs",
        "/redoc",
        "/openapi.json",
        "/metrics",
        "/api/v1/register",
        "/api/v1/login",
        "/api/v1/health",
    ]

    path = request.url.path.rstrip("/") # Normalize path

    if any(path == p or path == p.rstrip("/") for p in open_paths):
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    token = request.headers.get("Authorization")

    if not token or not token.startswith("Bearer"):
        logger.warning("Unauthorized access attempt to %s", path)
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    try:
        token = token.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        request.state.user = payload.get("sub")
        logger.info("Authenticated user: %s -> %s", payload.get("sub"),
                    path)
        response = await call_next(request)
        return response
    except JWTError:
        logger.error("Token is expired or invalid")
        return JSONResponse(status_code=401,
                            content={"detail": "Token is expired or invalid"})


# ------------------ Routers ------------------
app.include_router(v1_router,
                   prefix="/api/v1",
                   dependencies=[Depends(RateLimiter(times=100,
                                                     seconds=60))])

# ------------------ Root Endpoint -----------------
@app.get("/")
def root():
    """Root endpoint for the API Gateway."""
    logger.info("Gateway root accessed")
    return {"message": "Welcome to CVAlyze API Gateway"}
