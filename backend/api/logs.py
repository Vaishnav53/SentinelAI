import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any

from backend.database.session import get_db
from backend.services.log_ingestion import LogIngestionService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/logs", tags=["Logs Ingestion"])

class WindowsLogIngestPayload(BaseModel):
    event_id: int
    user_name: Optional[str] = "Administrator"
    computer: Optional[str] = "Workstation-1"
    message: Optional[str] = ""
    source_ip: Optional[str] = None
    severity: Optional[str] = "LOW"

class SyslogIngestPayload(BaseModel):
    raw_syslog: str
    client_ip: Optional[str] = "127.0.0.1"

@router.post("/ingest/windows")
async def ingest_windows_event(payload: WindowsLogIngestPayload, db: Session = Depends(get_db)):
    """Submit Windows Security/System event log payload to Normalized Log engine."""
    try:
        service = LogIngestionService(db)
        data = payload.model_dump()
        normalized = service.ingest_windows_log(data)
        return {
            "status": "SUCCESS",
            "log_id": normalized.id,
            "source_ip": normalized.source_ip,
            "severity": normalized.severity,
            "message": normalized.message
        }
    except Exception as e:
        logger.error(f"Failed to ingest Windows log: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ingest/syslog")
async def ingest_syslog_message(payload: SyslogIngestPayload, db: Session = Depends(get_db)):
    """Submit Syslog/Apache/Linux events text to Normalized Log engine."""
    try:
        service = LogIngestionService(db)
        normalized = service.ingest_syslog(payload.raw_syslog, payload.client_ip)
        return {
            "status": "SUCCESS",
            "log_id": normalized.id,
            "source_ip": normalized.source_ip,
            "severity": normalized.severity,
            "message": normalized.message
        }
    except Exception as e:
        logger.error(f"Failed to ingest Syslog message: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
