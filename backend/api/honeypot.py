from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
from backend.database.session import get_db
from backend.models.models import AttackEvent
from backend.schemas.attacks import AttackEventRead
from backend.core.registry import get_honeypot_manager
from backend.services.honeypot import HoneypotManager

from backend.api.dependencies import require_admin

class StartPayload(BaseModel):
    lan_mode: bool = False

router = APIRouter(prefix="/honeypot", tags=["Honeypot Core"])

@router.get("/status", response_model=Dict[str, Any])
def get_honeypot_status(db: Session = Depends(get_db), manager: HoneypotManager = Depends(get_honeypot_manager)):
    """Retrieve the current online state and bind details of the HTTP Honeypot."""
    return manager.get_full_status()

@router.post("/start", response_model=Dict[str, Any], dependencies=[Depends(require_admin)])
def start_honeypot_service(
    payload: StartPayload = None,
    db: Session = Depends(get_db), 
    manager: HoneypotManager = Depends(get_honeypot_manager)
):
    """Enable the HTTP Honeypot background listener thread."""
    lan_mode = payload.lan_mode if payload else False
    manager.start(lan_mode=lan_mode)
    return manager.get_full_status()

@router.post("/stop", response_model=Dict[str, Any], dependencies=[Depends(require_admin)])
def stop_honeypot_service(db: Session = Depends(get_db), manager: HoneypotManager = Depends(get_honeypot_manager)):
    """Deactivate the HTTP Honeypot background listener."""
    manager.stop()
    return manager.get_full_status()

@router.post("/mode", response_model=Dict[str, Any], dependencies=[Depends(require_admin)])
def switch_honeypot_mode(
    payload: StartPayload,
    db: Session = Depends(get_db),
    manager: HoneypotManager = Depends(get_honeypot_manager)
):
    """Switch honeypot listener bind mode (Local Only vs LAN Lab)."""
    return manager.set_mode(lan_mode=payload.lan_mode)


@router.get("/events", response_model=List[AttackEventRead])
def get_honeypot_captured_events(db: Session = Depends(get_db)):
    """Fetch only attack events captured by the HTTP Honeypot."""
    return db.query(AttackEvent).filter(
        AttackEvent.destination_port == 8088
    ).order_by(AttackEvent.created_at.desc()).all()
