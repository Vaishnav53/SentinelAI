import logging
from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.core.logging_config import setup_logging
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from backend.core.errors import (
    SentinelException,
    sentinel_exception_handler,
    general_exception_handler,
    http_exception_handler,
    validation_exception_handler
)
from backend.database.session import engine, SessionLocal, populate_demo_data, get_db
from backend.models.base import Base
import backend.models.models
from backend.api.router import api_router

# Initialize Logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Production Deployment Security Guards
    if settings.APP_ENV.lower() in ("production", "prod"):
        if not settings.SECRET_KEY or settings.SECRET_KEY == "placeholder_secret_key":
            raise RuntimeError("CRITICAL SECURITY ERROR: Production deployment requires a custom SECRET_KEY environment variable.")
        if settings.DATABASE_URL.startswith("sqlite"):
            raise RuntimeError("CRITICAL SECURITY ERROR: Production deployment requires a PostgreSQL DATABASE_URL environment variable.")
        if settings.AUTH_COOKIE_SAMESITE == "none" and not settings.AUTH_COOKIE_SECURE:
            raise RuntimeError("CRITICAL SECURITY ERROR: AUTH_COOKIE_SAMESITE='none' requires AUTH_COOKIE_SECURE=true.")

    # Idempotent Database Initialization on Startup
    logging.info("Initializing database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        logging.info("Database tables initialized successfully.")
        
        # Safe schema inspection to add missing columns across SQLite and PostgreSQL
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        with engine.begin() as conn:
            if "ai_conversations" in existing_tables:
                conv_cols = [col["name"] for col in inspector.get_columns("ai_conversations")]
                if "model_used" not in conv_cols:
                    conn.execute(text("ALTER TABLE ai_conversations ADD COLUMN model_used VARCHAR;"))
                if "linked_attack_id" not in conv_cols:
                    conn.execute(text("ALTER TABLE ai_conversations ADD COLUMN linked_attack_id INTEGER;"))
            
            if "sentinel_users" in existing_tables:
                user_cols = [col["name"] for col in inspector.get_columns("sentinel_users")]
                if "role" not in user_cols:
                    conn.execute(text("ALTER TABLE sentinel_users ADD COLUMN role VARCHAR(20) DEFAULT 'analyst';"))

        # Populate initial/demo data and bootstrap admin user
        db = SessionLocal()
        try:
            populate_demo_data(db)
            logging.info("Demo data populated successfully.")
            from backend.services.auth import AuthService
            AuthService.bootstrap_admin_user(db)
        finally:
            db.close()
            
        # Start background threat simulator task
        import asyncio
        from backend.api.attacks import start_attack_simulator
        app.state.simulator_task = asyncio.create_task(start_attack_simulator())
        app.state.db_ready = True
    except Exception as e:
        app.state.db_ready = False
        app.state.db_error = str(e)
        logging.error(f"Failed to initialize database tables or populate demo data: {e}", exc_info=True)
        if settings.APP_ENV.lower() in ("production", "prod"):
            raise RuntimeError(f"CRITICAL STARTUP ERROR: Database initialization failed in production: {e}") from e
    yield
    # Cleanup tasks (if any) go here on Shutdown
    logging.info("Shutting down SentinelAI API backend...")
    if hasattr(app.state, "simulator_task"):
        app.state.simulator_task.cancel()

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan
)

# Trusted Host Middleware (Host Header Injection protection)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.get_trusted_hosts()
)

# CORS Setup (Supports comma-separated origins from FRONTEND_ORIGIN or FRONTEND_URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root Health and Readiness Endpoints (for cloud orchestrators and load balancers)
@app.get("/health", tags=["Health"])
async def root_health():
    """Root platform liveness check."""
    return {"status": "ONLINE", "version": "0.1.0", "environment": settings.APP_ENV}

@app.get("/ready", tags=["Health"])
@app.get("/health/ready", tags=["Health"])
def root_ready(response: Response, db: Session = Depends(get_db)):
    """Root platform readiness check verifying database connectivity."""
    from backend.api.health import check_db_readiness
    return check_db_readiness(response, db)

# Mount API Routers
app.include_router(api_router, prefix="/api")

# Centralized Exception Boundaries
app.add_exception_handler(SentinelException, sentinel_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

logging.info(f"SentinelAI backend application started in [{settings.APP_ENV}] mode.")
