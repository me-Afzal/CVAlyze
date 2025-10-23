"""
Main entry point for the CVAlyze User Service API.
Includes Prometheus metrics, logging setup, and versioned routes.
"""

import logging
import os
import pytz
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from prometheus_fastapi_instrumentator import Instrumentator
from app.api.v1.routes import router as v1_router

# ------------------ Logging Setup ------------------
LOG_FILE = "user_service.log"

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
logger = logging.getLogger("user_service")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Optional: reduce verbosity of other loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)

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


# ------------------ Routes ------------------
@app.get("/")
def root():
    """
    Root endpoint to verify the User Service status.
    """
    logger.info("Root endpoint accessed.")
    return {"message": "Welcome to CVAlyze User Service API"}


@app.get("/logs", response_class=FileResponse)
def get_logs():
    """
    Retrieve the application log file.

    Returns:
        FileResponse: Sends the user_service.log file as a downloadable response.
    Raises:
        HTTPException: If the log file does not exist.
    """
    if not os.path.exists(LOG_FILE):
        logger.warning("Attempted access to missing log file.")
        raise HTTPException(status_code=404, detail="Log file not found.")

    logger.info("Log file accessed by client.")
    return FileResponse(
        path=LOG_FILE,
        media_type="text/plain",
        filename="user_service.log"
    )
