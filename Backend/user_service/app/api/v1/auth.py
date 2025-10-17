import os
from sqlalchemy.orm import Session
from app.api.v1 import models,schemas
from fastapi import HTTPException
from passlib.context import CryptContext
from jose import jwt
from dotenv import load_dotenv
import time

load_dotenv()

SECRET_KEY= os.getenv("SECRET_KEY")
ALGORITHM='HS256'

pwd_context=CryptContext(schemes=["argon2"],deprecated="auto")

def register_user(db: Session,user: schemas.UserCreate):
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
    db_user=db.query(models.User).filter(models.User.username==user.username).first()
    if not db_user:
        raise HTTPException(404,detail='User not found')
    if not pwd_context.verify(user.oldpassword,db_user.password):
        raise HTTPException(401,detail='Password is wrong')
    db_user.password=pwd_context.hash(user.newpassword)
    db.commit()
    return {'Message':'Your password is changed'}

def delete_user(db: Session,user: schemas.DeleteUser):
    db_user=db.query(models.User).filter(models.User.username==user.username).first()
    if not db_user:
        raise HTTPException(404,detail='User not found')
    if not pwd_context.verify(user.password,db_user.password):
        raise HTTPException(401,detail='Password is wrong')
    db.delete(db_user)
    db.commit()
    return {'Message':'User is deleted'}

def authenticate_user(db: Session,user: schemas.UserLogin):
    db_user=db.query(models.User).filter(models.User.username==user.username).first()
    if not db_user or not pwd_context.verify(user.password,db_user.password):
        raise HTTPException(status_code=401,detail='Username/password is incorrect')
    payload={'sub':db_user.username,
             'exp':time.time() + 24 * 3600}
    token=jwt.encode(payload,SECRET_KEY,algorithm=ALGORITHM)
    return {'Token':token,'token_type':'Bearer'}