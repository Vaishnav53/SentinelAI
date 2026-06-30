from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any

class AttackEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    external_id: Optional[str] = None
    attack_type: str
    severity: str
    status: str
    source_ip: str
    source_port: Optional[int] = None
    destination_ip: Optional[str] = None
    destination_port: int
    protocol: Optional[str] = None
    target_service: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    payload: Optional[str] = None
    user_agent: Optional[str] = None
    sensor_id: str
    session_id: Optional[str] = None
    threat_score: float
    confidence: float
    raw_metadata: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class AttackEventUpdateStatus(BaseModel):
    status: str = Field(..., description="NEW, ASSIGNED, RESOLVED, IGNORED")

class SeverityCount(BaseModel):
    severity: str
    count: int

class AttackTypeCount(BaseModel):
    attack_type: str
    count: int

class TimelineMetric(BaseModel):
    time: str  # e.g., "14:00" or date string
    count: int

class AttackStats(BaseModel):
    total_count: int
    severity_distribution: List[SeverityCount]
    type_distribution: List[AttackTypeCount]
    timeline: List[TimelineMetric]
