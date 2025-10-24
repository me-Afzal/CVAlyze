"""
API routes for CVAlyze User Service v1.
Handles user registration, authentication, password updates, and deletion.
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.v1 import schemas, auth, models
from app.api.v1.database import engine, SessionLocal

# Create all database tables (if not already created)
models.Base.metadata.create_all(bind=engine)

# Initialize the router for version 1
router = APIRouter()

# ------------------ Logging Setup ------------------

logger = logging.getLogger("user_service")

# ------------------ Database Dependency ------------------
def get_db():
    """
    Provides a SQLAlchemy session for request lifecycle.

    Yields:
        Session: A database session for performing queries.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------ Routes ------------------
@router.get("/")
def root():
    """
    Root endpoint for version 1 of the User Service.
    Returns a message confirming the service is active.
    """
    logger.info("v1 root endpoint accessed.")
    return {"message": "Welcome to CVAlyze User Service API v1"}


@router.post("/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    """
    logger.info("Registration attempt for user: %s", user.username)
    result = auth.register_user(db, user)
    logger.info("Registration is completed for user %s", user.username)
    return result


@router.post("/login")
def login_user(user: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user and return a JWT token.
    """
    logger.info("Login attempt for user: %s", user.username)
    result = auth.authenticate_user(db, user)
    logger.info("Login is successful for user %s", user.username)
    return result


@router.put("/register")
def update_pw(user: schemas.UpdateUser, db: Session = Depends(get_db)):
    """
    Update an existing user's password.
    """
    logger.info("Password update attempt for user: %s", user.username)
    result = auth.update_pw(db, user)
    logger.info("Password update is completed for user %s", user.username)
    return result


@router.post("/register/delete")
def delete_user(user: schemas.DeleteUser, db: Session = Depends(get_db)):
    """
    Delete a user account from the system.
    """
    logger.info("Deletion attempt for user: %s", user.username)
    result = auth.delete_user(db, user)
    logger.info("Deletion is completed for user %s", user.username)
    return result
