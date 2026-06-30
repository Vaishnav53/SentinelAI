from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
from backend.database.session import get_db
from backend.core.registry import get_settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=Dict[str, Any])
async def get_all_settings(
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Retrieve all current application settings."""
    return settings_service.get_all_settings(db)

@router.put("", response_model=Dict[str, Any])
async def update_settings(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Update settings and return the updated set."""
    for key, val in payload.items():
        settings_service.update_setting(db, key, val)
    return settings_service.get_all_settings(db)
