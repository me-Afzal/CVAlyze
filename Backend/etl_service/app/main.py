"""
Main entry point for the CVAlyze ETL Service.
Includes Prometheus metrics, logging setup, and routes registration.
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
LOG_FILE = "etl_service.log"

class ISTFormatter(logging.Formatter):
    """ Custom logging formatter to convert timestamps to IST timezone. """
    def formatTime(self, record, datefmt=None):
        """Convert UTC time to IST for log records."""
        ist = pytz.timezone("Asia/Kolkata")
        dt = datetime.fromtimestamp(record.created, tz=ist)
        # Use the datefmt if provided, else default ISO
        if datefmt:
            return dt.strftime(datefmt)
        return dt.isoformat()

# Handlers
file_handler = logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
file_handler.setFormatter(ISTFormatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s", 
                                      datefmt="%Y-%m-%d %H:%M:%S"))

console_handler = logging.StreamHandler()
console_handler.setFormatter(ISTFormatter(
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s", 
                                         datefmt="%Y-%m-%d %H:%M:%S"))

# Logger setup
logger = logging.getLogger("etl_service")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn").setLevel(logging.WARNING)

logger.info("Starting CVAlyze ETL Service")

# ------------------ FastAPI App ------------------
app = FastAPI(
    title="CVAlyze ETL Service",
    version="1.0.0",
    description="Handles resume parsing and data processing tasks for CVAlyze."
)

# Prometheus metrics instrumentation
Instrumentator().instrument(app).expose(app)

# Include versioned router
app.include_router(v1_router, prefix="/api/v1")


# ------------------ Endpoints ------------------
@app.get("/")
def root():
    """
    Root endpoint to verify ETL Service status.
    """
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to CVAlyze ETL Service"}


@app.get("/logs", response_class=FileResponse)
def get_logs():
    """
    Endpoint to retrieve the current log file.

    Returns:
        FileResponse: Sends the log file as a downloadable response.
    Raises:
        HTTPException: If log file is missing or inaccessible.
    """
    if not os.path.exists(LOG_FILE):
        logger.warning("Attempt to access missing log file.")
        raise HTTPException(status_code=404, detail="Log file not found.")

    logger.info("Log file accessed by client.")
    return FileResponse(
        path=LOG_FILE,
        media_type="text/plain",
        filename="etl_service.log"
    )
