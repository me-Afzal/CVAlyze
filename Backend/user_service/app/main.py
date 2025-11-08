"""
Main entry point for the CVAlyze User Service API.
Includes Prometheus metrics, logging setup, and versioned routes.
"""

import logging
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

# Console handler (captured by Kubernetes/Loki)
console_handler = logging.StreamHandler()
console_handler.setFormatter(ISTFormatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
))

# Logger setup
logger = logging.getLogger("user_service")
logger.setLevel(logging.INFO)

# Prevent duplicate handlers if reloaded
if logger.hasHandlers():
    logger.handlers.clear()

# Prevent log propagation to root/Uvicorn
logger.propagate = False

logger.addHandler(console_handler)

# Reduce verbosity of other loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

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
    allow_origins=["http://localhost:5173","http://localhost:5500"],
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


