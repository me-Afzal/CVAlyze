"""
Main entry point for the CVAlyze ETL Service.
Includes Prometheus metrics, logging setup, and routes registration.
"""

import logging
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from prometheus_fastapi_instrumentator import Instrumentator
from app.api.v1.routes import router as v1_router

# ------------------ Logging Setup ------------------
LOG_FILE = "etl_service.log"

# Configure logger to write logs to both file and console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("etl_service")
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
