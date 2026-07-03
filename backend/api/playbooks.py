import logging
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.database.session import get_db
from backend.models.models import ThreatPlaybook, PlaybookExecution, AuditLog
from backend.services.playbook_engine import PlaybookEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/playbooks", tags=["Threat Playbooks"])

class PlaybookAction(BaseModel):
    action: str  # BLOCK_IP, QUARANTINE_IP, CREATE_INCIDENT, ASSIGN_ANALYST, ADD_COMMENT, NOTIFY_TEAM

class PlaybookCreatePayload(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: Optional[str] = "MANUAL"
    actions: List[PlaybookAction]

class ThreatPlaybookRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    trigger_type: str
    actions_data: str
    created_at: datetime

    class Config:
        from_attributes = True

class PlaybookExecutionRead(BaseModel):
    id: int
    playbook_id: int
    target_ip: str
    status: str
    logs_data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PlaybookRunPayload(BaseModel):
    target_ip: str

@router.get("", response_model=List[ThreatPlaybookRead])
async def list_threat_playbooks(db: Session = Depends(get_db)):
    """Retrieve all preconfigured and custom incident response playbooks."""
    # Seed default playbooks if none exist
    if db.query(ThreatPlaybook).count() == 0:
        default_playbooks = [
            ThreatPlaybook(
                name="Rapid Containment Block",
                description="Automatically isolate uploader source IP by deploying WAF rules and opening a high-priority incident.",
                trigger_type="MANUAL",
                actions_data=json.dumps([
                    {"action": "BLOCK_IP"},
                    {"action": "CREATE_INCIDENT"},
                    {"action": "ASSIGN_ANALYST"},
                    {"action": "ADD_COMMENT"},
                    {"action": "NOTIFY_TEAM"}
                ])
            ),
            ThreatPlaybook(
                name="IP Quarantine Escalation",
                description="Enforce temporary uploader host quarantine and broadcast warning logs to teams alerts channels.",
                trigger_type="MANUAL",
                actions_data=json.dumps([
                    {"action": "QUARANTINE_IP"},
                    {"action": "CREATE_INCIDENT"},
                    {"action": "NOTIFY_TEAM"}
                ])
            )
        ]
        db.add_all(default_playbooks)
        db.commit()
        
    return db.query(ThreatPlaybook).all()

@router.post("", response_model=ThreatPlaybookRead)
async def create_custom_playbook(payload: PlaybookCreatePayload, db: Session = Depends(get_db)):
    """Configure a custom threat response playbook workflow."""
    try:
        actions_list = [a.model_dump() for a in payload.actions]
        playbook = ThreatPlaybook(
            name=payload.name,
            description=payload.description,
            trigger_type=payload.trigger_type,
            actions_data=json.dumps(actions_list)
        )
        db.add(playbook)
        db.commit()
        db.refresh(playbook)
        
        # Log Audit Log
        audit = AuditLog(
            action="CREATE_PLAYBOOK",
            module="playbook",
            user="admin",
            details=f"Created custom playbook workflow: '{playbook.name}'"
        )
        db.add(audit)
        db.commit()
        
        return playbook
    except Exception as e:
        logger.error(f"Failed to create playbook: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/executions", response_model=List[PlaybookExecutionRead])
async def list_playbook_executions(db: Session = Depends(get_db)):
    """Retrieve history of all automated playbook executions."""
    return db.query(PlaybookExecution).order_by(PlaybookExecution.created_at.desc()).all()

@router.post("/execute/{id}", response_model=PlaybookExecutionRead)
async def trigger_playbook_run(id: int, payload: PlaybookRunPayload, db: Session = Depends(get_db)):
    """Trigger manual run of a response playbook targeting an attacker IP."""
    try:
        engine = PlaybookEngine(db)
        execution = await engine.execute_playbook(id, payload.target_ip)
        return execution
    except ValueError as val_ex:
        raise HTTPException(status_code=404, detail=str(val_ex))
    except Exception as e:
        logger.error(f"Playbook run trigger failed: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
