from fastapi import Request, Depends
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.core.config import settings
from backend.core.errors import SentinelException
from backend.services.auth import AuthService
from backend.models.models import SentinelUser

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> SentinelUser:
    """Dependency that extracts the sentinel_session cookie and resolves the active SentinelUser."""
    cookie_name = settings.AUTH_SESSION_COOKIE_NAME
    token = request.cookies.get(cookie_name)
    
    if not token:
        raise SentinelException(
            message="Authentication required. Please log in.",
            code="UNAUTHORIZED",
            status_code=401
        )
        
    return AuthService.get_user_from_session(db, token)
