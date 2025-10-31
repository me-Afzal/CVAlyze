"""Gateway Service for CVAlyze application.
Handles routing, authentication, and logging for incoming API requests."""

import os
import logging
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
ALGORITHM = "HS256"

# ------------------ Logging Setup ------------------
LOG_FILE = "gateway_logs.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("gateway")

# Service URLs
USER_SERVICE = "http://cv-user-service:8001/"
ETL_SERVICE = "http://cv-etl-service:8002/"

# ------------------ Logging Setup ------------------


class ISTFormatter(logging.Formatter):
    """ Custom logging formatter to convert timestamps to IST timezone. """
    def formatTime(self, record, datefmt=None):
        """Convert UTC time to IST for log records."""
        ist = pytz.timezone("Asia/Kolkata")
        dt = datetime.fromtimestamp(record.created, tz=ist)
        if datefmt:
            return dt.strftime(datefmt)
        return dt.isoformat()

# Handlers
file_handler = logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
file_handler.setFormatter(ISTFormatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))

console_handler = logging.StreamHandler()
console_handler.setFormatter(ISTFormatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))

# Logger setup
logger = logging.getLogger("gateway")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Reduce verbosity of other loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)

logger.info("Starting Gateway Service")

# ------------------ Lifespan for Redis for Rate limit ------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup logic"""
    redis_conn = await redis.from_url(
        "redis://redis.cvalyze.svc.cluster.local:6379",
        encoding="utf-8",
        decode_responses=True
    )
    await FastAPILimiter.init(redis_conn)
    logger.info("Redis connected for rate limiting")

    yield  # App runs here

    # Shutdown logic
    await redis_conn.close()
    logger.info("Redis connection closed")

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
    allow_origins=["http://localhost:5173","http://localhost:5500"],
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

    path = request.url.path.rstrip("/")

    if any(path == p or path == p.rstrip("/") for p in open_paths):
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    token = request.headers.get("Authorization")

    if not token or not token.startswith("Bearer"):
        logger.warning("Unauthorized access attempt to %s", request.url.path)
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    try:
        token = token.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        request.state.user = payload.get("sub")
        logger.info("Authenticated user: %s -> %s", payload.get("sub"),
                    request.url.path)
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


# ------------------ Log Retrieval Endpoint ------------------
def read_log_lines(file_path: str, limit: int, offset: int) -> List[str]:
    """Read logs from end of file with pagination (latest first)."""
    lines = []
    with open(file_path, "rb") as f:
        f.seek(0, os.SEEK_END)
        buffer = bytearray()
        position = f.tell()
        line_count = 0
        skipped = 0

        while position >= 0:
            f.seek(position)
            char = f.read(1)
            if char == b"\n":
                if buffer:
                    if skipped < offset:
                        skipped += 1
                    else:
                        lines.append(buffer.decode("utf-8", errors="ignore")[::-1])
                        line_count += 1
                        if line_count >= limit:
                            break
                    buffer.clear()
            else:
                buffer.extend(char)
            position -= 1

        # Handle first line (no trailing newline)
        if buffer and line_count < limit and skipped >= offset:
            lines.append(buffer.decode("utf-8")[::-1])

    return lines


@app.get("/logs")
def get_logs(
    limit: int = Query(100, ge=1, le=1000, description="Number of lines to return"),
    offset: int = Query(0, ge=0, description="Number of lines to skip from the end")
):
    """
    Retrieve paginated application logs (latest first).

    Args:
        limit (int): Number of log lines to return (default 100)
        offset (int): Number of lines to skip from the end (for pagination)

    Returns:
        JSON: Latest log lines with metadata for pagination.
    """
    if not os.path.exists(LOG_FILE):
        logger.warning("Attempted access to missing log file.")
        raise HTTPException(status_code=404, detail="Log file not found.")

    try:
        log_lines = read_log_lines(LOG_FILE, limit, offset)
        total_lines = sum(1 for _ in open(LOG_FILE, "r", encoding="utf-8"))
    except Exception as e:
        logger.error(f"Error reading log file: {e}")
        raise HTTPException(status_code=500, detail="Error reading log file.")

    logger.info(f"Log file accessed (limit={limit}, offset={offset}).")

    return {
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total_lines,
        "logs": log_lines
    }

# ------------------ Logs from other services ------------------
@app.get("/logs/user")
async def get_user_service_logs(offset: int = 0, limit: int = 100):
    """
    Fetch logs from the User Service via its /logs endpoint.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{USER_SERVICE}logs",
                                        params={"offset": offset, "limit": limit})
            response.raise_for_status()
            # Return JSON structure directly
            return JSONResponse(content=response.json(),
                                status_code=response.status_code)
    except httpx.RequestError as e:
        logger.error("Error fetching User Service logs: %s", e)
        return JSONResponse(status_code=503,
                            content={"detail": "User Service unavailable"})
    except httpx.HTTPStatusError as e:
        logger.error("User Service returned error: %s", e)
        return JSONResponse(status_code=e.response.status_code,
                            content={"detail": "Failed to fetch logs"})


@app.get("/logs/etl")
async def get_etl_service_logs(offset: int = 0, limit: int = 100):
    """
    Fetch logs from the ETL Service via its /logs endpoint.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{ETL_SERVICE}logs",
                                        params={"offset": offset, "limit": limit})
            response.raise_for_status()
            # Return JSON structure directly
            return JSONResponse(content=response.json(),
                                status_code=response.status_code)
    except httpx.RequestError as e:
        logger.error("Error fetching ETL Service logs: %s", e)
        return JSONResponse(status_code=503,
                            content={"detail": "ETL Service unavailable"})
    except httpx.HTTPStatusError as e:
        logger.error("ETL Service returned error: %s", e)
        return JSONResponse(status_code=e.response.status_code,
                            content={"detail": "Failed to fetch logs"})
