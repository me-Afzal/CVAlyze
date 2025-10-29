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
    logger.info("User Service Root endpoint accessed.")
    return {"message": "Welcome to CVAlyze User Service API"}

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
