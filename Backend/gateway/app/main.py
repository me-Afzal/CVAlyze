"""Gateway Service for CVAlyze application.
Handles routing, authentication, and logging for incoming API requests."""

import os
import logging
import sys
import re
from datetime import datetime
from typing import List, Set
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

# ------------------ Bot Protection Configuration ------------------

# Common bot/scanner paths to block
BLOCKED_PATHS: Set[str] = {
    # WordPress paths
    "/wp-admin", "/wp-login.php", "/wp-content", "/wordpress",
    "/wp-includes", "/wp-json", "/xmlrpc.php", "/wp-cron.php",
    
    # PHP paths
    "/.env", "/config.php", "/info.php", "/phpinfo.php",
    "/test.php", "/admin.php", "/shell.php", "/setup.php",
    
    # Admin panels
    "/admin", "/administrator", "/phpmyadmin", "/pma",
    "/adminer", "/mysql", "/myadmin", "/sqlmanager",
    
    # Common exploits
    "/.git", "/.svn", "/.htaccess", "/.htpasswd",
    "/backup", "/.backup", "/backups", "/backup.sql",
    "/database.sql", "/db.sql", "/dump.sql",
    
    # Config files
    "/config.json", "/settings.php", "/configuration.php",
    "/web.config", "/robots.txt", "/sitemap.xml",
    
    # Shell/backdoor attempts
    "/shell", "/cmd", "/command", "/execute",
    "/eval", "/system", "/exec",
    
    # Other common targets
    "/cgi-bin", "/scripts", "/aspnet_client",
    "/.well-known", "/actuator", "/api/actuator",
    
    # Java/Spring paths
    "/manager/html", "/invoker", "/jolokia",
    
    # Login attempts
    "/login.aspx", "/signin", "/user/login",
    "/admin/login", "/manager/login",
}

# Patterns for suspicious paths (using regex)
BLOCKED_PATTERNS = [
    r"\.\.\/",  # Directory traversal
    r"\.\.\\",  # Directory traversal (Windows)
    r"<script",  # XSS attempts
    r"javascript:",  # XSS attempts
    r"\.(bak|backup|old|orig|save|swp|tmp)$",  # Backup files
    r"union.*select",  # SQL injection
    r"base64_decode",  # PHP exploits
    r"eval\(",  # Code execution attempts
    r"\$\{.*\}",  # Template injection
    r"%00",  # Null byte injection
    r"\.php\.",  # Double extension attacks
]

# Compile regex patterns for efficiency
COMPILED_PATTERNS = [re.compile(pattern, re.IGNORECASE) for pattern in BLOCKED_PATTERNS]

# User agents commonly associated with bots/scanners
SUSPICIOUS_USER_AGENTS = [
    "nikto", "sqlmap", "scanner", "nmap", "metasploit",
    "burp", "zap", "acunetix", "nessus", "openvas",
    "qualys", "nexpose", "wpscan", "joomla", "drupal",
    "zgrab", "masscan", "shodan", "censys", "bot",
    "crawler", "spider", "scraper", "wget", "curl",
]

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

# ------------------ Verification Helper Functions ------------------

def is_bot_request(request: Request) -> bool:
    """
    Detect if the request is from a bot/scanner based on various indicators.
    
    Args:
        request: FastAPI Request object
    
    Returns:
        bool: True if request appears to be from a bot/scanner
    """
    path = request.url.path.lower()
    
    # Check exact path matches
    for blocked_path in BLOCKED_PATHS:
        if blocked_path in path:
            return True
    
    # Check regex patterns
    for pattern in COMPILED_PATTERNS:
        if pattern.search(path):
            return True
    
    # Check user agent
    user_agent = request.headers.get("user-agent", "").lower()
    for suspicious_agent in SUSPICIOUS_USER_AGENTS:
        if suspicious_agent in user_agent:
            return True
    
    # Check for missing or suspicious headers that bots often have
    if not user_agent or user_agent == "-":
        return True
    
    # Check query parameters for common attack patterns
    query_string = str(request.url.query)
    if query_string:
        for pattern in COMPILED_PATTERNS:
            if pattern.search(query_string):
                return True
    
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
async def bot_protection_middleware(request: Request, call_next):
    """
    Middleware to block bot/scanner requests before they reach the application.
    This runs before authentication to save resources.
    """
    # Skip bot check for legitimate paths
    if request.url.path in ["/metrics","api/v1/health"]:
        return await call_next(request)
    
    # Check if this is a bot request
    if is_bot_request(request):
        client_ip = get_client_ip(request)
        user_agent = request.headers.get("user-agent", "unknown")
        
        logger.warning(
            "Bot/Scanner request blocked - IP: %s, Path: %s, User-Agent: %s",
            client_ip,
            request.url.path,
            user_agent[:100]  # Truncate long user agents
        )
        
        # Return a generic 404 to not give away information
        return JSONResponse(
            status_code=404,
            content={"detail": "Not found"}
        )
    
    return await call_next(request)

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

    path = request.url.path.rstrip("/")  # Normalize path

    if any(path == p or path == p.rstrip("/") for p in open_paths):
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    token = request.headers.get("Authorization")

    if not token or not token.startswith("Bearer"):
        logger.warning("Unauthorized access attempt to %s from IP: %s", 
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
        logger.error("Token is expired or invalid for IP: %s", get_client_ip(request))
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
