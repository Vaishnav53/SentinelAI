import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from backend.schemas.health import HealthStatus, ServiceHealthStatus, ServiceStatusDetail
from backend.database.session import get_db
from backend.core.config import settings

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("", response_model=HealthStatus)
async def get_health():
    """Basic platform health check."""
    return HealthStatus(
        status="ONLINE",
        version="0.1.0",
        environment=settings.APP_ENV
    )

@router.get("/services", response_model=ServiceHealthStatus)
async def get_services_health(db: Session = Depends(get_db)):
    """Detailed services health check. Verifies database connectivity dynamically."""
    
    # 1. Database Check
    try:
        # Run a simple query to verify database is reachable
        db.execute(text("SELECT 1"))
        db_status = ServiceStatusDetail(status="ONLINE", details="Connected successfully")
    except Exception as e:
        db_status = ServiceStatusDetail(status="OFFLINE", details=f"Database unreachable: {str(e)}")
        
    # 2. Ollama Status Check
    # Ollama checking will be implemented dynamically in later phases. For now, report CHECKING.
    ollama_status = ServiceStatusDetail(status="CHECKING", details="Discovery pending")
    
    # 3. Collectors Status Check
    # Collectors checking will be implemented dynamically in later phases. For now, report ACTIVE.
    collectors_status = ServiceStatusDetail(status="ACTIVE", details="Ready")
    
    return ServiceHealthStatus(
        database=db_status,
        ollama=ollama_status,
        collectors=collectors_status
    )
