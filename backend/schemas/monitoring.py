from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List

class SystemMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    network_sent: float
    network_received: float
    process_count: int
    created_at: datetime

class SystemMetricCurrent(BaseModel):
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    network_sent: float
    network_received: float
    process_count: int
    uptime_seconds: int
