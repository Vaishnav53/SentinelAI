from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from backend.database.session import get_db
from backend.models.models import HoneypotSensor
from backend.schemas.sensors import HoneypotSensorRead, SensorStateUpdate

router = APIRouter(prefix="/sensors", tags=["Sensors"])

@router.get("", response_model=List[HoneypotSensorRead])
async def get_sensors(db: Session = Depends(get_db)):
    """Retrieve all simulated honeypot sensors and status."""
    return db.query(HoneypotSensor).all()

@router.post("/{id}/start", response_model=HoneypotSensorRead)
async def start_sensor(id: int, db: Session = Depends(get_db)):
    """Activate sensor and update status to ONLINE."""
    sensor = db.query(HoneypotSensor).filter(HoneypotSensor.id == id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor with ID {id} not found")
        
    sensor.state = "ONLINE"
    sensor.last_heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(sensor)
    return sensor

@router.post("/{id}/stop", response_model=HoneypotSensorRead)
async def stop_sensor(id: int, db: Session = Depends(get_db)):
    """Deactivate sensor and update status to OFFLINE."""
    sensor = db.query(HoneypotSensor).filter(HoneypotSensor.id == id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail=f"Sensor with ID {id} not found")
        
    sensor.state = "OFFLINE"
    db.commit()
    db.refresh(sensor)
    return sensor
