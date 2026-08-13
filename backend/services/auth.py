from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models.models import SentinelUser, UserSession
from backend.schemas.auth import RegisterRequest
from backend.core.security import (
    hash_password,
    verify_password,
    generate_session_token,
    hash_session_token
)
from backend.core.config import settings
from backend.core.errors import SentinelException

class AuthService:
    @staticmethod
    def register_user(db: Session, payload: RegisterRequest) -> SentinelUser:
        """Register a new SentinelAI user with secure password hashing."""
        username = payload.username.strip()
        email = payload.email.strip().lower()

        # Check existing username (case-insensitive)
        existing_username = db.query(SentinelUser).filter(
            func.lower(SentinelUser.username) == username.lower()
        ).first()
        if existing_username:
            raise SentinelException(
                message="Username is already taken",
                code="DUPLICATE_USERNAME",
                status_code=400
            )

        # Check existing email
        existing_email = db.query(SentinelUser).filter(
            func.lower(SentinelUser.email) == email
        ).first()
        if existing_email:
            raise SentinelException(
                message="Email is already registered",
                code="DUPLICATE_EMAIL",
                status_code=400
            )

        # Hash password and store user with analyst role
        hashed_pwd = hash_password(payload.password)
        new_user = SentinelUser(
            username=username,
            email=email,
            password_hash=hashed_pwd,
            role="analyst",
            is_active=1
        )
        
        try:
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            return new_user
        except Exception as e:
            db.rollback()
            raise SentinelException(
                message="Could not complete registration due to a database constraint.",
                code="REGISTRATION_FAILED",
                status_code=400,
                details={"error": str(e)}
            )

    @staticmethod
    def bootstrap_admin_user(db: Session) -> Optional[SentinelUser]:
        """Safely bootstrap environment-configured administrator account if credentials are present."""
        admin_username = (settings.SENTINEL_ADMIN_USERNAME or "dyn4m1t3").strip()
        admin_password = settings.SENTINEL_ADMIN_PASSWORD
        admin_email = (settings.SENTINEL_ADMIN_EMAIL or "admin@sentinel.ai").strip().lower()

        if not admin_password:
            return None

        # Check existing admin account by username or email
        existing_user = db.query(SentinelUser).filter(
            (func.lower(SentinelUser.username) == admin_username.lower()) |
            (func.lower(SentinelUser.email) == admin_email)
        ).first()

        if existing_user:
            # Ensure existing account maintains administrator role
            if existing_user.role != "admin":
                existing_user.role = "admin"
                db.commit()
                db.refresh(existing_user)
            return existing_user

        # Create fresh admin user with Argon2id password hashing
        hashed_pwd = hash_password(admin_password)
        admin_user = SentinelUser(
            username=admin_username,
            email=admin_email,
            password_hash=hashed_pwd,
            role="admin",
            is_active=1
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        import logging
        logging.info(f"Administrator account '{admin_username}' bootstrapped successfully.")
        return admin_user


    @staticmethod
    def authenticate_user(db: Session, identity: str, password: str) -> SentinelUser:
        """Authenticate user by username or email and password."""
        identity_clean = identity.strip().lower()
        
        # Look up user by username or email
        user = db.query(SentinelUser).filter(
            (func.lower(SentinelUser.username) == identity_clean) |
            (func.lower(SentinelUser.email) == identity_clean)
        ).first()

        # Generic error message to prevent account enumeration
        if not user or not verify_password(password, user.password_hash):
            raise SentinelException(
                message="Invalid username/email or password",
                code="INVALID_CREDENTIALS",
                status_code=401
            )

        if not user.is_active:
            raise SentinelException(
                message="User account is deactivated",
                code="INACTIVE_ACCOUNT",
                status_code=401
            )

        # Update last login timestamp
        user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def create_user_session(
        db: Session,
        user_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[str, UserSession]:
        """Create a server-side session and return raw token and session record."""
        raw_token = generate_session_token()
        token_hash = hash_session_token(raw_token)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires_at = now + timedelta(hours=settings.AUTH_SESSION_TTL_HOURS)

        session_record = UserSession(
            user_id=user_id,
            token_hash=token_hash,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=expires_at,
            last_seen_at=now
        )
        db.add(session_record)
        db.commit()
        db.refresh(session_record)

        return raw_token, session_record

    @staticmethod
    def get_user_from_session(db: Session, raw_token: str) -> SentinelUser:
        """Resolve valid non-expired active user from raw session token."""
        if not raw_token:
            raise SentinelException(
                message="Authentication session token missing",
                code="UNAUTHORIZED",
                status_code=401
            )

        token_hash = hash_session_token(raw_token)
        session_record = db.query(UserSession).filter(
            UserSession.token_hash == token_hash
        ).first()

        if not session_record:
            raise SentinelException(
                message="Invalid or revoked session",
                code="UNAUTHORIZED",
                status_code=401
            )

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if session_record.expires_at < now:
            # Clean up expired session
            db.delete(session_record)
            db.commit()
            raise SentinelException(
                message="Session has expired. Please log in again.",
                code="SESSION_EXPIRED",
                status_code=401
            )

        # Retrieve user
        user = db.query(SentinelUser).filter(SentinelUser.id == session_record.user_id).first()
        if not user or not user.is_active:
            db.delete(session_record)
            db.commit()
            raise SentinelException(
                message="User account associated with this session is inactive",
                code="UNAUTHORIZED",
                status_code=401
            )

        # Update last seen timestamp
        session_record.last_seen_at = now
        db.commit()

        return user

    @staticmethod
    def revoke_user_session(db: Session, raw_token: str) -> bool:
        """Revoke server-side session using raw session token."""
        if not raw_token:
            return False

        token_hash = hash_session_token(raw_token)
        session_record = db.query(UserSession).filter(
            UserSession.token_hash == token_hash
        ).first()

        if session_record:
            db.delete(session_record)
            db.commit()
            return True
        return False
