"""Gateway Service for CVAlyze application.
Handles routing, authentication, and logging for incoming API requests."""

import os
import logging
from datetime import datetime
import httpx
import pytz
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse,PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
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

# Service URLs
USER_SERVICE = "http://cv-user-service:8001/"
ETL_SERVICE = "http://cv-etl-service:8002/"

# ------------------ Logging Setup ------------------
LOG_FILE_PATH = "gateway_logs.log"

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
file_handler = logging.FileHandler(LOG_FILE_PATH, mode="a", encoding="utf-8")
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

# ------------------ FastAPI App ------------------
app = FastAPI(
    title="CVAlyze API Gateway",
    version="1.0.0"
)

Instrumentator().instrument(app).expose(app)

# Cors middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(v1_router, prefix="/api/v1")


@app.get("/")
def root():
    """Root endpoint for the API Gateway."""
    logger.info("Gateway root accessed")
    return {"message": "Welcome to CVAlyze API Gateway"}


# ------------------ Log Retrieval Endpoint ------------------
@app.get("/logs")
def get_logs():
    """
    Retrieve the gateway logs (for monitoring/debugging).
    """
    try:
        logger.info("Log file accessed by client.")
        return FileResponse(LOG_FILE_PATH, media_type="text/plain",
                            filename="gateway_logs.log")
    except Exception:
        raise JSONResponse(status_code=404, content={"detail": "Log file not found"})

# ------------------ Logs from other services ------------------
@app.get("/logs/user")
async def get_user_service_logs():
    """
    Fetch logs from the User Service via its /logs endpoint.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{USER_SERVICE}logs")
            response.raise_for_status()
            return PlainTextResponse(content=response.text,
                                     media_type="text/plain")
    except httpx.RequestError as e:
        logger.error("Error fetching User Service logs: %s", e)
        return JSONResponse(status_code=503,
                            content={"detail": "User Service unavailable"})
    except httpx.HTTPStatusError as e:
        logger.error("User Service returned error: %s", e)
        return JSONResponse(status_code=e.response.status_code,
                            content={"detail": "Failed to fetch logs"})


@app.get("/logs/etl")
async def get_etl_service_logs():
    """
    Fetch logs from the ETL Service via its /logs endpoint.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{ETL_SERVICE}logs")
            response.raise_for_status()
            return PlainTextResponse(content=response.text,
                                     media_type="text/plain")
    except httpx.RequestError as e:
        logger.error("Error fetching ETL Service logs: %s", e)
        return JSONResponse(status_code=503,
                            content={"detail": "ETL Service unavailable"})
    except httpx.HTTPStatusError as e:
        logger.error("ETL Service returned error: %s", e)
        return JSONResponse(status_code=e.response.status_code,
                            content={"detail": "Failed to fetch logs"})
