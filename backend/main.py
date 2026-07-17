import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager

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
from backend.database.session import engine, SessionLocal, populate_demo_data
from backend.models.base import Base
from backend.api.router import api_router

# Initialize Logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Idempotent Database Initialization on Startup
    logging.info("Initializing database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        logging.info("Database tables initialized successfully.")
        
        # Add new columns to existing SQLite files if they do not exist
        from sqlalchemy import text
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE ai_conversations ADD COLUMN model_used VARCHAR;"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE ai_conversations ADD COLUMN linked_attack_id INTEGER;"))
                conn.commit()
            except Exception:
                pass

        # Populate initial/demo data
        db = SessionLocal()
        try:
            populate_demo_data(db)
            logging.info("Demo data populated successfully.")
        finally:
            db.close()
            
        # Start background threat simulator task
        import asyncio
        from backend.api.attacks import start_attack_simulator
        app.state.simulator_task = asyncio.create_task(start_attack_simulator())
    except Exception as e:
        logging.error(f"Failed to initialize database tables or populate demo data: {e}", exc_info=True)
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
trusted_hosts = [host.strip() for host in settings.TRUSTED_HOSTS.split(",") if host.strip()]
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=trusted_hosts
)

# CORS Setup (Supports comma-separated origins)
origins = [origin.strip() for origin in settings.FRONTEND_ORIGIN.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(api_router, prefix="/api")

# Centralized Exception Boundaries
app.add_exception_handler(SentinelException, sentinel_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

logging.info(f"SentinelAI backend application started in [{settings.APP_ENV}] mode.")
