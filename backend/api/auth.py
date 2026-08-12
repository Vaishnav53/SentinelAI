import logging
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.core.config import settings
from backend.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    AuthMessageResponse
)
from backend.services.auth import AuthService
from backend.api.dependencies import get_current_user
from backend.models.models import SentinelUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Register a new SentinelAI user account and establish authenticated session."""
    user = AuthService.register_user(db, payload)
    logger.info(f"SentinelAI user registered successfully: {user.username} ({user.email})")

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    raw_token, _ = AuthService.create_user_session(db, user.id, ip_address, user_agent)

    response.set_cookie(
        key=settings.AUTH_SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=settings.AUTH_SESSION_TTL_HOURS * 3600,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.AUTH_COOKIE_SECURE,
        path="/"
    )
    return user


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Authenticate SentinelAI credentials and set HttpOnly session cookie."""
    user = AuthService.authenticate_user(db, payload.username, payload.password)
    
    # Client IP and User-Agent metadata
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    raw_token, _ = AuthService.create_user_session(db, user.id, ip_address, user_agent)
    
    # Cookie TTL in seconds
    max_age_seconds = settings.AUTH_SESSION_TTL_HOURS * 3600

    response.set_cookie(
        key=settings.AUTH_SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=max_age_seconds,
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE
    )
    
    logger.info(f"SentinelAI user logged in: {user.username} (IP: {ip_address})")
    return user

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: SentinelUser = Depends(get_current_user)
):
    """Retrieve profile of currently authenticated SentinelAI user."""
    return current_user

@router.post("/logout", response_model=AuthMessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Revoke active session and delete authentication cookie."""
    raw_token = request.cookies.get(settings.AUTH_SESSION_COOKIE_NAME)
    if raw_token:
        AuthService.revoke_user_session(db, raw_token)

    response.delete_cookie(
        key=settings.AUTH_SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.AUTH_COOKIE_SECURE
    )

    
    return {"message": "Logged out successfully"}
