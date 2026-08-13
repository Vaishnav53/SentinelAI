import os
from typing import Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Locate and load the env file
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

class Settings(BaseModel):
    # App Settings
    APP_NAME: str = Field(default_factory=lambda: os.getenv("APP_NAME", "SentinelAI"))
    APP_ENV: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    APP_HOST: str = Field(default_factory=lambda: os.getenv("APP_HOST", "127.0.0.1"))
    APP_PORT: int = Field(default_factory=lambda: int(os.getenv("APP_PORT", "8000")))
    
    # Database Settings
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./storage/sentinelai.db"))
    
    # Frontend Settings
    FRONTEND_ORIGIN: str = Field(default_factory=lambda: os.getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"))
    
    # Production Security settings
    SECRET_KEY: str = Field(default_factory=lambda: os.getenv("SECRET_KEY", "placeholder_secret_key"))
    TRUSTED_HOSTS: str = Field(default_factory=lambda: os.getenv("TRUSTED_HOSTS", "127.0.0.1,localhost,testserver"))

    # Auth Settings
    AUTH_SESSION_COOKIE_NAME: str = Field(default_factory=lambda: os.getenv("AUTH_SESSION_COOKIE_NAME", "sentinel_session"))
    AUTH_SESSION_TTL_HOURS: int = Field(default_factory=lambda: int(os.getenv("AUTH_SESSION_TTL_HOURS", "24")))
    AUTH_COOKIE_SECURE: bool = Field(default_factory=lambda: os.getenv("AUTH_COOKIE_SECURE", "false").lower() in ("true", "1", "yes"))
    AUTH_COOKIE_SAMESITE: str = Field(default_factory=lambda: os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower())

    # Administrator Bootstrap Settings
    SENTINEL_ADMIN_USERNAME: str = Field(default_factory=lambda: os.getenv("SENTINEL_ADMIN_USERNAME", "dyn4m1t3"))
    SENTINEL_ADMIN_PASSWORD: Optional[str] = Field(default_factory=lambda: os.getenv("SENTINEL_ADMIN_PASSWORD"))
    SENTINEL_ADMIN_EMAIL: str = Field(default_factory=lambda: os.getenv("SENTINEL_ADMIN_EMAIL", "admin@sentinel.ai"))



    # Local AI Settings
    OLLAMA_BASE_URL: str = Field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    DEFAULT_OLLAMA_MODEL: str = Field(default_factory=lambda: os.getenv("DEFAULT_OLLAMA_MODEL", "llama3.2:3b"))
    
    # Groq AI Settings
    GROQ_API_KEY: Optional[str] = Field(default_factory=lambda: os.getenv("GROQ_API_KEY"))
    DEFAULT_GROQ_MODEL: str = Field(default_factory=lambda: os.getenv("DEFAULT_GROQ_MODEL", "llama-3.3-70b-versatile"))
    
    # Storage Settings
    REPORT_STORAGE: str = Field(default_factory=lambda: os.getenv("REPORT_STORAGE", "./storage/reports"))
    
    # Logging Settings
    LOG_LEVEL: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

settings = Settings()
