from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from backend.database.session import get_db
from backend.models.models import AttackEvent
from backend.schemas.attacks import AttackEventRead
from backend.core.registry import get_honeypot_manager
from backend.services.honeypot import HoneypotManager

router = APIRouter(prefix="/honeypot", tags=["Honeypot Core"])

@router.get("/status", response_model=Dict[str, Any])
async def get_honeypot_status(manager: HoneypotManager = Depends(get_honeypot_manager)):
    """Retrieve the current online state of the HTTP Honeypot."""
    status = manager.get_status()
    return {
        "status": status,
        "host": manager.host,
        "port": manager.port,
        "url": f"http://{manager.host}:{manager.port}"
    }

@router.post("/start", response_model=Dict[str, Any])
async def start_honeypot_service(manager: HoneypotManager = Depends(get_honeypot_manager)):
    """Enable the HTTP Honeypot background thread."""
    status = manager.start()
    return {
        "status": status,
        "host": manager.host,
        "port": manager.port,
        "url": f"http://{manager.host}:{manager.port}"
    }

@router.post("/stop", response_model=Dict[str, Any])
async def stop_honeypot_service(manager: HoneypotManager = Depends(get_honeypot_manager)):
    """Deactivate the HTTP Honeypot background listener."""
    status = manager.stop()
    return {
        "status": status,
        "host": manager.host,
        "port": manager.port,
        "url": f"http://{manager.host}:{manager.port}"
    }

@router.get("/events", response_model=List[AttackEventRead])
async def get_honeypot_captured_events(db: Session = Depends(get_db)):
    """Fetch only attack events captured by the HTTP Honeypot."""
    return db.query(AttackEvent).filter(
        AttackEvent.destination_port == 8088
    ).order_by(AttackEvent.created_at.desc()).all()
