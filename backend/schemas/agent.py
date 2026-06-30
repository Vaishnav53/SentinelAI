from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class ChatContext(BaseModel):
    attack_id: Optional[int] = None

class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = "llama3.1"
    conversation_id: Optional[str] = None
    context: Optional[ChatContext] = None

class ChatResponse(BaseModel):
    message: str
    conversation_id: str
    model: str
    created_at: datetime
    latency: float

class ModelRead(BaseModel):
    name: str
    size: str
    status: str

class AgentStatus(BaseModel):
    status: str  # ONLINE, OFFLINE
    models_available: List[str]
