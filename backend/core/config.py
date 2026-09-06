import os
from typing import Optional, List
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Locate and load the env file
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class Settings(BaseModel):
    # App Settings
    APP_NAME: str = Field(default_factory=lambda: os.getenv("APP_NAME", "SentinelAI"))
    APP_ENV: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    APP_HOST: str = Field(default_factory=lambda: os.getenv("APP_HOST", "127.0.0.1"))
    APP_PORT: int = Field(default_factory=lambda: int(os.getenv("APP_PORT", "8000")))
    
    # Database Settings
    DATABASE_URL: str = Field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./storage/sentinelai.db"))
    
    # Frontend Settings (supports FRONTEND_ORIGIN or FRONTEND_URL)
    FRONTEND_ORIGIN: str = Field(default_factory=lambda: os.getenv("FRONTEND_ORIGIN", os.getenv("FRONTEND_URL", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")))
    
    # Production Security settings (supports ALLOWED_HOSTS or TRUSTED_HOSTS)
    SECRET_KEY: str = Field(default_factory=lambda: os.getenv("SECRET_KEY", "placeholder_secret_key"))
    TRUSTED_HOSTS: str = Field(default_factory=lambda: os.getenv("ALLOWED_HOSTS", os.getenv("TRUSTED_HOSTS", "127.0.0.1,localhost,testserver")))

    # Auth Settings
    AUTH_SESSION_COOKIE_NAME: str = Field(default_factory=lambda: os.getenv("AUTH_SESSION_COOKIE_NAME", "sentinel_session"))
    AUTH_SESSION_TTL_HOURS: int = Field(default_factory=lambda: int(os.getenv("AUTH_SESSION_TTL_HOURS", "24")))
    AUTH_COOKIE_SECURE: bool = Field(default_factory=lambda: os.getenv("AUTH_COOKIE_SECURE", "false").lower() in ("true", "1", "yes"))
    AUTH_COOKIE_SAMESITE: str = Field(default_factory=lambda: os.getenv("AUTH_COOKIE_SAMESITE", "lax").lower())

    # Administrator Bootstrap Settings
    SENTINEL_ADMIN_USERNAME: str = Field(default_factory=lambda: os.getenv("SENTINEL_ADMIN_USERNAME", "dyn4m1t3"))
    SENTINEL_ADMIN_PASSWORD: Optional[str] = Field(default_factory=lambda: os.getenv("SENTINEL_ADMIN_PASSWORD"))
    SENTINEL_ADMIN_EMAIL: str = Field(default_factory=lambda: os.getenv("SENTINEL_ADMIN_EMAIL", "admin@sentinel.ai"))

    # Groq AI Settings
    GROQ_API_KEY: Optional[str] = Field(default_factory=lambda: os.getenv("GROQ_API_KEY"))
    DEFAULT_GROQ_MODEL: str = Field(default_factory=lambda: os.getenv("DEFAULT_GROQ_MODEL", "openai/gpt-oss-120b"))
    
    # Storage Settings
    REPORT_STORAGE: str = Field(default_factory=lambda: os.getenv("REPORT_STORAGE", "./storage/reports"))
    SANDBOX_STORAGE: str = Field(default_factory=lambda: os.getenv("SANDBOX_STORAGE", os.path.join(PROJECT_ROOT, "decoy_sandbox")))
    
    # Logging Settings
    LOG_LEVEL: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))

    def get_cors_origins(self) -> List[str]:
        raw = f"{self.FRONTEND_ORIGIN},{os.getenv('FRONTEND_URL', '')}"
        return list(dict.fromkeys([o.strip() for o in raw.split(",") if o.strip()]))

    def get_trusted_hosts(self) -> List[str]:
        raw = f"{self.TRUSTED_HOSTS},{os.getenv('ALLOWED_HOSTS', '')}"
        return list(dict.fromkeys([h.strip() for h in raw.split(",") if h.strip()]))

settings = Settings()
