from fastapi import APIRouter, Depends, Query, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import asyncio
import random
import json
import logging
from backend.database.session import get_db, SessionLocal
from backend.models.models import AttackEvent, HoneypotSensor
from backend.schemas.attacks import (
    AttackEventRead,
    AttackEventUpdateStatus,
    AttackStats,
    SeverityCount,
    AttackTypeCount,
    TimelineMetric
)

router = APIRouter(prefix="/attacks", tags=["Attacks"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

async def start_attack_simulator():
    """Background simulator feeding random live attack events to WebSocket subscribers."""
    logging.info("Threat attack simulator loop started.")
    try:
        while True:
            # We check if there are active WebSocket connections to run simulation
            if manager.active_connections:
                db = SessionLocal()
                try:
                    # Random source country coordinates mapper list
                    countries = [
                        "United States", "China", "Germany", "India", "Russia", 
                        "Netherlands", "Singapore", "Brazil", "Canada", "Australia", 
                        "United Kingdom", "France", "Japan", "South Africa"
                    ]
                    src_country = random.choice(countries)
                    
                    # Random severities and types
                    severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
                    sev = random.choices(severities, weights=[40, 30, 20, 10])[0]
                    
                    attack_types = {
                        "LOW": ["Port Scan", "Ping Sweep", "Reconnaissance Probe"],
                        "MEDIUM": ["Config File Access", "SSH Probe", "Unauthorized Login Access"],
                        "HIGH": ["Brute Force Login", "XSS Attempt", "Directory Traversal"],
                        "CRITICAL": ["SQL Injection", "Remote Code Execution", "Buffer Overflow"]
                    }
                    attack_type = random.choice(attack_types[sev])
                    
                    src_ip = f"{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}"
                    dest_port = random.choice([80, 22, 21, 23, 8088])
                    
                    new_event = AttackEvent(
                        external_id=f"SIM-{int(datetime.utcnow().timestamp())}",
                        attack_type=attack_type,
                        severity=sev,
                        status="NEW",
                        source_ip=src_ip,
                        source_port=random.randint(1024, 65535),
                        destination_port=dest_port,
                        protocol="TCP",
                        target_service="HTTP Honeypot" if dest_port == 8088 else ("SSH" if dest_port == 22 else "HTTP"),
                        country=src_country,
                        city="Threat Node",
                        payload="Simulated threat intelligence arc trace",
                        user_agent="SentinelAISimulator/1.0",
                        sensor_id="Simulated Sensor Node",
                        threat_score=9.5 if sev == "CRITICAL" else (7.5 if sev == "HIGH" else (4.5 if sev == "MEDIUM" else 1.5)),
                        confidence=round(0.8 + random.random() * 0.19, 2),
                        created_at=datetime.utcnow()
                    )
                    db.add(new_event)
                    
                    # Update http sensor heartbeat
                    sensor = db.query(HoneypotSensor).filter(HoneypotSensor.name == "HTTP Honeypot").first()
                    if sensor:
                        sensor.last_heartbeat = datetime.utcnow()
                        sensor.state = "ONLINE"
                        
                    db.commit()
                    db.refresh(new_event)
                    
                    event_data = {
                        "id": new_event.id,
                        "external_id": new_event.external_id,
                        "attack_type": new_event.attack_type,
                        "severity": new_event.severity,
                        "status": new_event.status,
                        "source_ip": new_event.source_ip,
                        "source_port": new_event.source_port,
                        "destination_port": new_event.destination_port,
                        "protocol": new_event.protocol,
                        "target_service": new_event.target_service,
                        "country": new_event.country,
                        "city": new_event.city,
                        "payload": new_event.payload,
                        "threat_score": new_event.threat_score,
                        "confidence": new_event.confidence,
                        "created_at": new_event.created_at.isoformat()
                    }
                    
                    await manager.broadcast({
                        "type": "new_attack",
                        "data": event_data
                    })
                except Exception as ex:
                    logging.error(f"Simulator error: {ex}", exc_info=True)
                finally:
                    db.close()
            await asyncio.sleep(4.0)
    except asyncio.CancelledError:
        logging.info("Simulator background loop cancelled.")

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Receive message to keep socket open
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

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
