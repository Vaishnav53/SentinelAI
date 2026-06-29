import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load env variables from .env file
# FastAPI looks for .env in the current working directory, we use python-dotenv to find it.
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

app = FastAPI(
    title=os.getenv("APP_NAME", "SentinelAI"),
    version="0.1.0"
)

# CORS setup
origins = [
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def get_health():
    """Basic platform health check."""
    return {
        "status": "ONLINE",
        "version": "0.1.0",
        "environment": os.getenv("APP_ENV", "development")
    }

@app.get("/api/health/services")
async def get_services_health():
    """Detailed services health check."""
    # For now in Phase 0, we report standard state. 
    # The actual implementation will verify DB, Ollama, and collectors in subsequent phases.
    return {
        "database": {
            "status": "ONLINE",
            "details": "Initialized"
        },
        "ollama": {
            "status": "CHECKING",
            "details": "Discovery pending"
        },
        "collectors": {
            "status": "ACTIVE",
            "details": "Ready"
        }
    }
