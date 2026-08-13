import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.models.base import Base
import backend.models.models
from backend.database.session import get_db
from backend.main import app

from sqlalchemy.pool import StaticPool

# Setup in-memory database engine for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    """Create a clean in-memory database session for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

def create_test_auth_client(db_session=None):
    """Helper to return an authenticated TestClient for unit tests."""
    from backend.models.models import SentinelUser
    from backend.services.auth import AuthService
    from backend.schemas.auth import RegisterRequest
    from backend.core.config import settings
    from backend.database.session import SessionLocal

    db = db_session if db_session is not None else SessionLocal()
    close_db = db_session is None

    try:
        user = db.query(SentinelUser).filter(SentinelUser.username == "test_operator").first()
        if not user:
            user = AuthService.register_user(db, RegisterRequest(
                username="test_operator",
                email="operator_test@sentinel.ai",
                password="TestPassword123!"
            ))
            user.role = "admin"
            db.commit()
        elif user.role != "admin":
            user.role = "admin"
            db.commit()
        raw_token, _ = AuthService.create_user_session(db, user.id)
        test_client = TestClient(app)
        test_client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, raw_token)
        return test_client
    finally:
        if close_db:
            db.close()

@pytest.fixture(scope="function")
def client(db):
    """Return a TestClient with overridden get_db dependency and active user session."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db

    from backend.models.models import SentinelUser
    from backend.services.auth import AuthService
    from backend.schemas.auth import RegisterRequest
    from backend.core.config import settings

    user = db.query(SentinelUser).filter(SentinelUser.username == "test_operator").first()
    if not user:
        user = AuthService.register_user(db, RegisterRequest(
            username="test_operator",
            email="operator_test@sentinel.ai",
            password="TestPassword123!"
        ))
        user.role = "admin"
        db.commit()
    elif user.role != "admin":
        user.role = "admin"
        db.commit()

    raw_token, _ = AuthService.create_user_session(db, user.id)

    with TestClient(app) as test_client:
        test_client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, raw_token)
        yield test_client
    app.dependency_overrides.clear()
