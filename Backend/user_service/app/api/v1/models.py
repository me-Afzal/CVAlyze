"""Database models for user operations in the user service."""
from sqlalchemy import Integer,String,Column
from app.api.v1.database import Base

class User(Base):
    __tablename__='users'
    
    id=Column(Integer,primary_key=True,index=True)
    username=Column(String,unique=True,index=True)
    password=Column(String)