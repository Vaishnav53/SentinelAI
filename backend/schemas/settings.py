from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any

class SettingRead(BaseModel):
    key: str
    value: str
    type: str = "string"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SettingUpdate(BaseModel):
    value: str

class SettingsDump(BaseModel):
    settings: Dict[str, Any]
