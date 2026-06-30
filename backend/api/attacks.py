from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from backend.database.session import get_db
from backend.models.models import AttackEvent
from backend.schemas.attacks import (
    AttackEventRead,
    AttackEventUpdateStatus,
    AttackStats,
    SeverityCount,
    AttackTypeCount,
    TimelineMetric
)

router = APIRouter(prefix="/attacks", tags=["Attacks"])

@router.get("", response_model=List[AttackEventRead])
async def get_attacks(
    db: Session = Depends(get_db),
    severity: Optional[str] = Query(None),
    attack_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sensor_id: Optional[str] = Query(None),
    target_service: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """Retrieve attack events with pagination and filters."""
    query = db.query(AttackEvent)
    
    # Apply filters
    if severity:
        query = query.filter(AttackEvent.severity == severity.upper())
    if attack_type:
        query = query.filter(AttackEvent.attack_type == attack_type)
    if status:
        query = query.filter(AttackEvent.status == status.upper())
    if sensor_id:
        query = query.filter(AttackEvent.sensor_id == sensor_id)
    if target_service:
        query = query.filter(AttackEvent.target_service == target_service.upper())
        
    if search:
        query = query.filter(
            AttackEvent.source_ip.contains(search) |
            AttackEvent.payload.contains(search) |
            AttackEvent.attack_type.contains(search)
        )
        
    # Sort by created_at desc (newest first)
    query = query.order_by(AttackEvent.created_at.desc())
    
    # Pagination
    offset = (page - 1) * page_size
    attacks = query.offset(offset).limit(page_size).all()
    return attacks

@router.get("/stats", response_model=AttackStats)
async def get_attack_stats(db: Session = Depends(get_db)):
    """Calculate severity distribution, attack type distribution, and recent activity timeline."""
    total_count = db.query(AttackEvent).count()
    
    # Severity distribution
    sev_rows = db.query(
        AttackEvent.severity, 
        func.count(AttackEvent.id)
    ).group_by(AttackEvent.severity).all()
    severity_distribution = [SeverityCount(severity=row[0], count=row[1]) for row in sev_rows]
    
    # Type distribution
    type_rows = db.query(
        AttackEvent.attack_type, 
        func.count(AttackEvent.id)
    ).group_by(AttackEvent.attack_type).all()
    type_distribution = [AttackTypeCount(attack_type=row[0], count=row[1]) for row in type_rows]
    
    # Simple Mock Timeline metrics for Recharts
    # In production, this pulls count of events grouped by date/hour.
    # For now, build a series from database events or fallback
    timeline_rows = db.query(
        func.strftime("%Y-%m-%d", AttackEvent.created_at),
        func.count(AttackEvent.id)
    ).group_by(func.strftime("%Y-%m-%d", AttackEvent.created_at)).order_by(AttackEvent.created_at.asc()).all()
    
    timeline = [TimelineMetric(time=row[0], count=row[1]) for row in timeline_rows]
    
    # Fallback/Dummy timeline values if database has very sparse entries
    if not timeline:
        timeline = [
            TimelineMetric(time="Mon", count=2),
            TimelineMetric(time="Tue", count=5),
            TimelineMetric(time="Wed", count=8),
            TimelineMetric(time="Thu", count=4),
            TimelineMetric(time="Fri", count=11),
            TimelineMetric(time="Sat", count=7),
            TimelineMetric(time="Sun", count=14)
        ]
        
    return AttackStats(
        total_count=total_count,
        severity_distribution=severity_distribution,
        type_distribution=type_distribution,
        timeline=timeline
    )

@router.get("/{id}", response_model=AttackEventRead)
async def get_attack_details(id: int, db: Session = Depends(get_db)):
    """Get single attack event detail by database ID."""
    attack = db.query(AttackEvent).filter(AttackEvent.id == id).first()
    if not attack:
        raise HTTPException(status_code=404, detail=f"Attack event with ID {id} not found")
    return attack

@router.post("/{id}/status", response_model=AttackEventRead)
async def update_attack_status(
    id: int, 
    payload: AttackEventUpdateStatus, 
    db: Session = Depends(get_db)
):
    """Change the response status of an event."""
    attack = db.query(AttackEvent).filter(AttackEvent.id == id).first()
    if not attack:
        raise HTTPException(status_code=404, detail=f"Attack event with ID {id} not found")
        
    attack.status = payload.status.upper()
    db.commit()
    db.refresh(attack)
    return attack
