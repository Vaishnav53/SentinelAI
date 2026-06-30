from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class HoneypotSensorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    type: str
    host: str
    port: int
    state: str
    last_heartbeat: Optional[datetime] = None
    configuration: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class SensorStateUpdate(BaseModel):
    state: str = Field(..., description="ONLINE, OFFLINE, IDLE, ERROR")
