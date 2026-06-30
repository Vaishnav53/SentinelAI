from pydantic import BaseModel, Field
from typing import Dict

class HealthStatus(BaseModel):
    status: str = Field(..., description="Overall platform status (e.g. ONLINE, OFFLINE)")
    version: str = Field(..., description="SentinelAI backend version")
    environment: str = Field(..., description="Running environment")

class ServiceStatusDetail(BaseModel):
    status: str = Field(..., description="Service specific status (ONLINE, OFFLINE, CHECKING, DEGRADED, ACTIVE)")
    details: str = Field(..., description="Human readable detail message")

class ServiceHealthStatus(BaseModel):
    database: ServiceStatusDetail
    ollama: ServiceStatusDetail
    collectors: ServiceStatusDetail
