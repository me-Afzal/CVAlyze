"""
Main entry point for the CVAlyze User Service API.
Includes Prometheus metrics, logging setup, and versioned routes.
"""

import logging
import sys
import os
from datetime import datetime
from typing import List
import pytz
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from prometheus_fastapi_instrumentator import Instrumentator
from app.api.v1.routes import router as v1_router

# ------------------ Logging Setup ------------------

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

# 3. Configure application's logger (User service)
logger = logging.getLogger("user_service")
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

# 5. Disable the access log
uvicorn_access_logger = logging.getLogger("uvicorn.access")
if uvicorn_access_logger.hasHandlers():
    uvicorn_access_logger.handlers.clear()
uvicorn_access_logger.propagate = False

# 6. Reduce verbosity of other libraries
logging.getLogger("httpx").setLevel(logging.WARNING)

logger.info("Starting CVAlyze User Service API")

# ------------------ FastAPI Application ------------------
app = FastAPI(
    title="CVAlyze User Service API",
    version="1.0.0",
    description="Manages user registration, authentication, and updates for the CVAlyze platform."
)

# Prometheus metrics setup
Instrumentator().instrument(app).expose(app)

# Include versioned router
app.include_router(v1_router, prefix="/api/v1")

# Cors middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://cv-alyze.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ Routes ------------------
@app.get("/")
def root():
    """
    Root endpoint to verify the User Service status.
    """
    logger.info("User Service Root endpoint accessed.")
    return {"message": "Welcome to CVAlyze User Service API"}


