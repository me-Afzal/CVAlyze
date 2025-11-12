"""Schemas for user operations in the user service."""
from pydantic import BaseModel,Field,field_validator

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)

    # Use field_validator instead of deprecated validator
    @field_validator('username')
    @classmethod
    def sanitize_username(cls, v: str) -> str:
        """Strip whitespace and convert to lowercase."""
        return v.strip().lower()

    @field_validator('password')
    @classmethod
    def sanitize_password(cls, v: str) -> str:
        """Strip whitespace from password."""
        return v.strip()


class UserLogin(BaseModel):
    username: str
    password: str

    @field_validator('username')
    @classmethod
    def sanitize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator('password')
    @classmethod
    def sanitize_password(cls, v: str) -> str:
        return v.strip()


class UpdateUser(BaseModel):
    username: str
    oldpassword: str
    newpassword: str = Field(..., min_length=8)

    @field_validator('username')
    @classmethod
    def sanitize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator('oldpassword', 'newpassword')
    @classmethod
    def sanitize_passwords(cls, v: str) -> str:
        return v.strip()


class DeleteUser(BaseModel):
    username: str
    password: str

    @field_validator('username')
    @classmethod
    def sanitize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator('password')
    @classmethod
    def sanitize_password(cls, v: str) -> str:
        return v.strip()