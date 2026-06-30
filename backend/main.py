import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from backend.database.session import engine
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
    except Exception as e:
        logging.error(f"Failed to initialize database tables: {e}", exc_info=True)
    yield
    # Cleanup tasks (if any) go here on Shutdown
    logging.info("Shutting down SentinelAI API backend...")

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan
)

# CORS Setup
origins = [
    settings.FRONTEND_ORIGIN
]

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
