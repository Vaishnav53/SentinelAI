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
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class ChatResponse(BaseModel):
    message: str
    conversation_id: str
    model: str
    created_at: datetime
    latency: float
    source: Optional[str] = "model"

class ModelRead(BaseModel):
    name: str
    size: str
    status: str

class AgentStatus(BaseModel):
    status: str  # ONLINE, OFFLINE
    models_available: List[str]

class MessageRead(BaseModel):
    id: int
    role: str
    content: str
    model: Optional[str] = None
    latency: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class ConversationRead(BaseModel):
    id: int
    conversation_key: str
    title: Optional[str] = None
    model_used: Optional[str] = None
    linked_attack_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}

class ConversationDetail(BaseModel):
    id: int
    conversation_key: str
    title: Optional[str] = None
    model_used: Optional[str] = None
    linked_attack_id: Optional[int] = None
    created_at: datetime
    messages: List[MessageRead]

    model_config = {"from_attributes": True}

class AnalysisResponse(BaseModel):
    executive_summary: str
    technical_explanation: str
    risk_level: str
    mitre_mapping: str
    potential_impact: str
    recommended_actions: str
    containment: str
    recovery_steps: str
    references: str
    conversation_id: str
    source: Optional[str] = "model"

