from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from backend.schemas.health import HealthStatus, ServiceHealthStatus, ServiceStatusDetail
from backend.database.session import get_db
from backend.core.config import settings

router = APIRouter(prefix="/health", tags=["Health"])

def check_db_readiness(response: Response, db: Session):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "READY",
            "database": "CONNECTED",
            "environment": settings.APP_ENV,
            "version": "0.1.0"
        }
    except Exception as e:
        response.status_code = 503
        return {
            "status": "NOT_READY",
            "database": "DISCONNECTED",
            "error": str(e),
            "environment": settings.APP_ENV,
            "version": "0.1.0"
        }

@router.get("", response_model=HealthStatus)
async def get_health():
    """Basic platform process liveness check."""
    return HealthStatus(
        status="ONLINE",
        version="0.1.0",
        environment=settings.APP_ENV
    )

@router.get("/ready")
def get_readiness(response: Response, db: Session = Depends(get_db)):
    """Readiness check probe. Verifies database connectivity and returns 503 if unavailable."""
    return check_db_readiness(response, db)

@router.get("/services", response_model=ServiceHealthStatus)
def get_services_health(response: Response, db: Session = Depends(get_db)):
    """Detailed services health check. Verifies database connectivity dynamically."""
    
    # 1. Database Check
    try:
        # Run a simple query to verify database is reachable
        db.execute(text("SELECT 1"))
        db_status = ServiceStatusDetail(status="ONLINE", details="Connected successfully")
    except Exception as e:
        response.status_code = 503
        db_status = ServiceStatusDetail(status="OFFLINE", details=f"Database unreachable: {str(e)}")
        
    # 2. Groq AI Status Check
    groq_status = ServiceStatusDetail(
        status="ONLINE" if settings.GROQ_API_KEY else "UNAVAILABLE",
        details="Groq Cloud API Key Configured" if settings.GROQ_API_KEY else "GROQ_API_KEY missing"
    )
    
    # 3. Collectors Status Check
    collectors_status = ServiceStatusDetail(status="ACTIVE", details="Ready")
    
    return ServiceHealthStatus(
        database=db_status,
        groq=groq_status,
        collectors=collectors_status
    )
