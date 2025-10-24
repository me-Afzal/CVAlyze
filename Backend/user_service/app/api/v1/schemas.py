"""Schemas for user operations in the user service."""
from pydantic import BaseModel

class UserCreate(BaseModel):
    """Schema for creating a new user."""
    username: str
    password: str

class UserLogin(BaseModel):
    """Schema for user login."""
    username: str
    password: str

class UpdateUser(BaseModel):
    """Schema for updating user password."""
    username: str
    oldpassword: str
    newpassword: str

class DeleteUser(BaseModel):
    """Schema for deleting a user."""
    username: str
    password: str
