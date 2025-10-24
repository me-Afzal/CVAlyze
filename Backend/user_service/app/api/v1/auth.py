"""Authentication and user management functions for the user service."""
import os
import time
from sqlalchemy.orm import Session
from fastapi import HTTPException
from passlib.context import CryptContext
from jose import jwt
from dotenv import load_dotenv
from app.api.v1 import models,schemas


load_dotenv()

# Load environment variables for JWT authentication
SECRET_KEY= os.getenv("SECRET_KEY")
ALGORITHM='HS256'

# Password hashing context
pwd_context=CryptContext(schemes=["argon2"],deprecated="auto")

def register_user(db: Session,user: schemas.UserCreate):
    """Register a new user in the database."""
    user_exist=db.query(models.User).filter(models.User.username==user.username).first()
    if user_exist:
        raise HTTPException(409,detail='User already exist')
    hashed_pw=pwd_context.hash(user.password)
    db_user=models.User(username=user.username,password=hashed_pw)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {'Message':'User registered successfully'}

def update_pw(db: Session,user: schemas.UpdateUser):
    """Update the password for an existing user."""
    db_user=db.query(models.User).filter(models.User.username==user.username).first()
    if not db_user:
        raise HTTPException(404,detail='User not found')
    if not pwd_context.verify(user.oldpassword,db_user.password):
        raise HTTPException(401,detail='Password is wrong')
    db_user.password=pwd_context.hash(user.newpassword)
    db.commit()
    return {'Message':'Your password is changed'}

def delete_user(db: Session,user: schemas.DeleteUser):
    """Delete a user from the database."""
    db_user=db.query(models.User).filter(models.User.username==user.username).first()
    if not db_user:
        raise HTTPException(404,detail='User not found')
    if not pwd_context.verify(user.password,db_user.password):
        raise HTTPException(401,detail='Password is wrong')
    db.delete(db_user)
    db.commit()
    return {'Message':'User is deleted'}

def authenticate_user(db: Session,user: schemas.UserLogin):
    """Authenticate a user and return a JWT token."""
    db_user=db.query(models.User).filter(models.User.username==user.username).first()
    if not db_user or not pwd_context.verify(user.password,db_user.password):
        raise HTTPException(status_code=401,detail='Username/password is incorrect')
    payload={'sub':db_user.username,
             'exp':time.time() + 24 * 3600}
    token=jwt.encode(payload,SECRET_KEY,algorithm=ALGORITHM)
    return {'Token':token,'token_type':'Bearer'}
