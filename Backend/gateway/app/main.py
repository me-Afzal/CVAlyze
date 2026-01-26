"""Gateway Service for CVAlyze application.
Handles routing, authentication, and logging for incoming API requests."""

import os
import logging
import sys
from datetime import datetime
from typing import Set
from contextlib import asynccontextmanager
import httpx
import pytz
import redis.asyncio as redis
from fastapi import FastAPI, Request, Depends, Query, HTTPException
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from jose import jwt
from jose import JWTError
from dotenv import load_dotenv
from app.api.v1.routes import router as v1_router

load_dotenv()

# Load environment variables for JWT authentication
SECRET_KEY = os.getenv("SECRET_KEY")
REDIS_URL = os.getenv("REDIS_URL")
ALGORITHM = "HS256"

# Service URLs
USER_SERVICE = "http://cv-user-service:8001/"
ETL_SERVICE = "http://cv-etl-service:8002/"

# ------------------ Allowed Paths Configuration ------------------

# Define all allowed paths in your application
ALLOWED_PATHS: Set[str] = {
    # Documentation and Metrics Scrapping
    "/docs",
    "/redoc",
    "/openapi.json",
    "/metrics",
    
    # API v1 routes (public)
    "/api/v1/register",
    "/api/v1/login",
    "/api/v1/health",
    
    # API v1 routes (authenticated)
    "/api/v1/register/update",
    "/api/v1/register/delete",
    "/api/v1/upload_cvs",
}

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

# ------------------ Helper Functions ------------------

def is_path_allowed(path: str) -> bool:
    """
    Check if the requested path is in the allowed paths list.
    Uses strict whitelist approach - only exact matches are allowed.
    
    Args:
        path: The request path to check
    
    Returns:
        bool: True if path is allowed, False otherwise
    """
    # Normalize path by removing trailing slashes
    normalized_path = path.rstrip("/")
    
    # Check for exact matches in ALLOWED_PATHS
    # We need to check both the original path and normalized version
    if path in ALLOWED_PATHS or normalized_path in ALLOWED_PATHS:
        return True
    
    # Also check with trailing slash added (for cases like /api/v1 vs /api/v1/)
    path_with_slash = normalized_path + "/"
    if path_with_slash in ALLOWED_PATHS:
        return True
    
    # If no exact match found, deny access
    return False

def get_client_ip(request: Request) -> str:
    """
    Get the real client IP address, considering proxy headers.
    
    Args:
        request: FastAPI Request object
    
    Returns:
        str: Client IP address
    """
    # Check for proxy headers
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # Take the first IP if there are multiple
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    
    # Fallback to direct client
    return request.client.host if request.client else "unknown"

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
            max_connections=50,  # Connection pooling
            socket_connect_timeout=5,  # Connection timeout
            socket_timeout=5,  # Operation timeout
            retry_on_timeout=True,
            retry_on_error=[ConnectionError, TimeoutError]
        )
        
        # Test the connection
        await redis_conn.ping()
        
        # Store redis connection in app state
        app.state.redis = redis_conn
        logger.info("Redis connected successfully for rate limiting")
        
    except redis.ConnectionError as e:
        logger.error(f"Failed to connect to Redis: {e}")
        logger.warning("Rate limiting will be disabled")
        app.state.redis = None

    except Exception as e:
        logger.error(f"Unexpected error connecting to Redis: {e}")
        app.state.redis = None

    yield  # App runs here

    # Shutdown logic
    if redis_conn:
        try:
            await redis_conn.aclose()
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
# IMPORTANT: Middleware executes in REVERSE order of definition
# OPTIMAL EXECUTION ORDER: path_whitelist → rate_limiter → token_auth
# (Define in reverse: auth first, rate limiter second, whitelist last)

@app.middleware("http")
async def token_auth_middleware(request: Request, call_next):
    """JWT authentication middleware that protects API routes
    except login/register/metrics.
    
    EXECUTION ORDER: Runs THIRD (last) - only for whitelisted, rate-limited requests.
    """

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

    path = request.url.path.rstrip("/")  # Normalize path

    if any(path == p or path == p.rstrip("/") for p in open_paths):
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    token = request.headers.get("Authorization")

    if not token or not token.startswith("Bearer"):
        logger.warning("Missing/invalid auth token | Path: %s | IP: %s", 
                      path, get_client_ip(request))
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    try:
        token = token.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        request.state.user = payload.get("sub")
        logger.info("Authenticated user: %s -> %s", payload.get("sub"), path)
        response = await call_next(request)
        return response
    except JWTError:
        logger.error("JWT validation failed | IP: %s", get_client_ip(request))
        return JSONResponse(status_code=401,
                          content={"detail": "Token is expired or invalid"})


@app.middleware("http")
async def global_rate_limiter(request: Request, call_next):
    """
    Rate limiting middleware - 15 requests per minute per IP.
    
    EXECUTION ORDER: Runs SECOND - only for whitelisted paths (saves Redis resources).
    """
    # Allow public endpoints without rate limiting
    if request.url.path in [
        "/docs",
        "/redoc",
        "/openapi.json",
        "/metrics",
        "/api/v1/health",
    ]:
        return await call_next(request)

    # Use the shared Redis connection from app state
    redis_conn = request.app.state.redis

    if redis_conn:
        try:
            client_ip = get_client_ip(request)
            key = f"rl:{client_ip}"

            # Increment counter
            count = await redis_conn.incr(key)

            if count == 1:
                # First access → set expiry for window (60 seconds)
                await redis_conn.expire(key, 60)

            if count > 15:
                logger.warning(
                    "Rate limit exceeded | IP: %s | Count: %d",
                    client_ip,
                    count
                )
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too Many Requests - Slow down"},
                )
        except redis.ConnectionError as e:
            logger.error(f"Redis connection error in rate limiter: {e}")
            # Continue without rate limiting if Redis fails
            pass
        except Exception as e:
            logger.error(f"Unexpected error in rate limiter: {e}")
            pass

    return await call_next(request)


@app.middleware("http")
async def path_whitelist_middleware(request: Request, call_next):
    """
    Middleware to enforce strict path whitelisting.
    Only explicitly allowed paths in ALLOWED_PATHS can proceed.
    
    EXECUTION ORDER: Runs FIRST - blocks malicious paths before any processing.
    This is the most efficient placement as it:
    - Blocks attacks immediately with minimal processing
    - Prevents wasting Redis operations on bad paths
    - Protects rate limiter and auth middleware from spam
    """
    path = request.url.path
    
    # Check if path is in whitelist
    if not is_path_allowed(path):
        client_ip = get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")
        
        logger.warning(
            "BLOCKED - Non-whitelisted path | IP: %s | Path: %s | UA: %s",
            client_ip,
            path,
            user_agent[:100]  # Truncate user agent to avoid log spam
        )
        
        # Return 404 to avoid information disclosure
        # (Don't reveal that path filtering is active)
        return JSONResponse(
            status_code=404,
            content={"detail": "Not found"}
        )
    
    # Path is whitelisted - proceed to next middleware (rate limiter)
    return await call_next(request)


# ------------------ Routers ------------------
app.include_router(v1_router, prefix="/api/v1")

# ------------------ Root Endpoint -----------------
@app.get("/")
def root():
    """Root endpoint for the API Gateway."""
    logger.info("Gateway root accessed")
    return {"message": "Welcome to CVAlyze API Gateway"}