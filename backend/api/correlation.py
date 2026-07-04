import logging
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from backend.database.session import get_db
from backend.models.models import CorrelatedIncident, NormalizedLog, AuditLog

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/correlation", tags=["Threat Correlation"])

class CorrelatedIncidentRead(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    severity: str
    confidence: float
    status: str
    assigned_analyst: Optional[str] = None
    nodes_data: Optional[str] = None
    links_data: Optional[str] = None
    timeline_data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class IncidentActionPayload(BaseModel):
    action: str  # e.g., 'update_status', 'assign_analyst', 'add_comment'
    status: Optional[str] = None
    analyst: Optional[str] = None
    comment: Optional[str] = None

class NormalizedLogRead(BaseModel):
    id: int
    log_source: str
    event_id: Optional[str] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    user_name: Optional[str] = None
    hostname: Optional[str] = None
    message: str
    severity: str
    technique_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/incidents", response_model=List[CorrelatedIncidentRead])
async def get_correlated_incidents(
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve all correlated SOC incident attack chains."""
    query = db.query(CorrelatedIncident)
    if search:
        query = query.filter(
            (CorrelatedIncident.title.like(f"%{search}%")) |
            (CorrelatedIncident.description.like(f"%{search}%"))
        )
    if status:
        query = query.filter(CorrelatedIncident.status == status.upper())
    return query.order_by(CorrelatedIncident.created_at.desc()).all()

@router.get("/incidents/{id}", response_model=CorrelatedIncidentRead)
async def get_correlated_incident_detail(id: int, db: Session = Depends(get_db)):
    """Retrieve details for a single correlated incident chain."""
    incident = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Correlated incident not found")
    return incident

@router.post("/incidents/{id}/action", response_model=CorrelatedIncidentRead)
async def perform_incident_action(
    id: int, 
    payload: IncidentActionPayload, 
    db: Session = Depends(get_db)
):
    """Change status, assign owners, or add case comments to correlated incidents."""
    incident = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Correlated incident not found")

    action_type = payload.action.lower()
    now_str = datetime.utcnow().isoformat()
    
    # Load timeline data
    timeline = json.loads(incident.timeline_data or "[]")

    if action_type == "update_status" and payload.status:
        old_status = incident.status
        incident.status = payload.status.upper()
        timeline.append({
            "time": now_str,
            "title": "Status Transition",
            "details": f"Incident state updated from {old_status} to {incident.status}."
        })
        # Log Audit Log
        audit = AuditLog(
            action="UPDATE_INCIDENT_STATUS",
            module="correlation",
            user="system",
            details=f"Updated Incident ID {id} status to {incident.status}."
        )
        db.add(audit)

    elif action_type == "assign_analyst" and payload.analyst:
        incident.assigned_analyst = payload.analyst
        timeline.append({
            "time": now_str,
            "title": "Analyst Assignment",
            "details": f"Assigned case owner to {payload.analyst}."
        })
        audit = AuditLog(
            action="ASSIGN_INCIDENT_ANALYST",
            module="correlation",
            user="system",
            details=f"Assigned Incident ID {id} to analyst {payload.analyst}."
        )
        db.add(audit)

    elif action_type == "add_comment" and payload.comment:
        timeline.append({
            "time": now_str,
            "title": f"Note by {payload.analyst or 'System Analyst'}",
            "details": payload.comment
        })
        audit = AuditLog(
            action="ADD_INCIDENT_COMMENT",
            module="correlation",
            user=payload.analyst or "system",
            details=f"Analyst added note to Incident ID {id}: {payload.comment[:50]}..."
        )
        db.add(audit)

    incident.timeline_data = json.dumps(timeline)
    db.commit()
    db.refresh(incident)
    return incident

@router.get("/logs", response_model=List[NormalizedLogRead])
async def get_normalized_logs(
    source: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve raw historical normalized event log records for audit search."""
    query = db.query(NormalizedLog)
    if source:
        query = query.filter(NormalizedLog.log_source == source.upper())
    if search:
        query = query.filter(
            (NormalizedLog.message.like(f"%{search}%")) |
            (NormalizedLog.source_ip.like(f"%{search}%")) |
            (NormalizedLog.user_name.like(f"%{search}%"))
        )
    return query.order_by(NormalizedLog.created_at.desc()).limit(100).all()

@router.post("/seed-demo", response_model=Dict[str, Any])
async def seed_demo_incidents(db: Session = Depends(get_db)):
    """Seed sample failed and successful logon event logs, then execute correlation to spawn a demo incident graph."""
    from backend.services.correlation_engine import CorrelationEngine
    
    # Clean old demo entries to prevent duplicate clutter
    db.query(NormalizedLog).filter(NormalizedLog.source_ip == "10.99.99.99").delete()
    db.query(CorrelatedIncident).filter(CorrelatedIncident.title.like("%10.99.99.99%")).delete()
    db.commit()
    
    # 1. Add logon failure logs
    failure1 = NormalizedLog(
        log_source="WINDOWS",
        event_id="4625",
        source_ip="10.99.99.99",
        user_name="admin",
        hostname="DEC-SERVER-01",
        message="An account failed to log on. Source Address: 10.99.99.99. User Name: admin",
        severity="MEDIUM",
        created_at=datetime.utcnow()
    )
    db.add(failure1)
    
    failure2 = NormalizedLog(
        log_source="WINDOWS",
        event_id="4625",
        source_ip="10.99.99.99",
        user_name="admin",
        hostname="DEC-SERVER-01",
        message="An account failed to log on. Source Address: 10.99.99.99. User Name: admin",
        severity="MEDIUM",
        created_at=datetime.utcnow()
    )
    db.add(failure2)
    db.commit()
    
    # 2. Add successful bypass login and call CorrelationEngine
    success = NormalizedLog(
        log_source="WINDOWS",
        event_id="4624",
        source_ip="10.99.99.99",
        user_name="admin",
        hostname="DEC-SERVER-01",
        message="An account was successfully logged on. Source Address: 10.99.99.99. User Name: admin",
        severity="HIGH",
        created_at=datetime.utcnow()
    )
    db.add(success)
    db.commit()
    
    # Run the engine
    engine = CorrelationEngine(db)
    engine.process_log(success)
    
    # Find the created incident to confirm
    incident = db.query(CorrelatedIncident).filter(
        CorrelatedIncident.title.like("%10.99.99.99%")
    ).first()
    
    if not incident:
        return {"status": "ERROR", "message": "Failed to trigger incident chain correlation."}
        
    return {
        "status": "SUCCESS",
        "message": "Demo log records seeded. Attack chain successfully correlated.",
        "incident_id": incident.id
    }

