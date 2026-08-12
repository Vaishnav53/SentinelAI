from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique account username")
    email: EmailStr = Field(..., description="Unique account email address")
    password: str = Field(..., min_length=8, max_length=128, description="Account password")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if not v.isalnum() and "_" not in v and "-" not in v:
            raise ValueError("Username may only contain letters, numbers, underscores, and hyphens.")
        return v

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Username or email address")
    password: str = Field(..., min_length=1, description="Account password")

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AuthMessageResponse(BaseModel):
    message: str
    user: Optional[UserResponse] = None
