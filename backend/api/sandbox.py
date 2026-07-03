import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.database.session import get_db
from backend.models.models import DecoySandboxFile, WAFRule, AuditLog

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sandbox", tags=["Sandbox Analysis"])

class DecoySandboxFileRead(BaseModel):
    id: int
    filename: str
    size_bytes: int
    sha256: str
    md5: str
    sha1: str
    status: str
    threat_score: float
    malware_description: Optional[str] = None
    vt_reputation: Optional[str] = None
    sandbox_path: str
    ip_address: str
    created_at: datetime

    class Config:
        from_attributes = True

class SandboxStatusResponse(BaseModel):
    total_scanned: int
    malicious_count: int
    suspicious_count: int
    clean_count: int
    storage_bytes: int

@router.get("/files", response_model=List[DecoySandboxFileRead])
async def get_sandbox_files(db: Session = Depends(get_db)):
    """Retrieve all sandboxed malware upload threat logs."""
    return db.query(DecoySandboxFile).order_by(DecoySandboxFile.created_at.desc()).all()

@router.get("/status", response_model=SandboxStatusResponse)
async def get_sandbox_status(db: Session = Depends(get_db)):
    """Retrieve overview metrics for Sandbox Storage SOC console."""
    total = db.query(DecoySandboxFile).count()
    malicious = db.query(DecoySandboxFile).filter(DecoySandboxFile.status == "MALICIOUS").count()
    suspicious = db.query(DecoySandboxFile).filter(DecoySandboxFile.status == "SUSPICIOUS").count()
    clean = db.query(DecoySandboxFile).filter(DecoySandboxFile.status == "CLEAN").count()
    
    # Calculate storage footprint
    storage = 0
    sandbox_dir = "d:/Documents/SentinelAI/decoy_sandbox"
    if os.path.exists(sandbox_dir):
        for f in os.listdir(sandbox_dir):
            fp = os.path.join(sandbox_dir, f)
            if os.path.isfile(fp):
                storage += os.path.getsize(fp)

    return {
        "total_scanned": total,
        "malicious_count": malicious,
        "suspicious_count": suspicious,
        "clean_count": clean,
        "storage_bytes": storage
    }

@router.post("/files/{id}/contain")
async def contain_sandbox_file(id: int, db: Session = Depends(get_db)):
    """Contain threat: Delete sandboxed payload file and block uploader IP address dynamically."""
    sandbox_file = db.query(DecoySandboxFile).filter(DecoySandboxFile.id == id).first()
    if not sandbox_file:
        raise HTTPException(status_code=404, detail="Sandbox file not found")

    # 1. Delete physical payload from sandboxed workspace
    if os.path.exists(sandbox_file.sandbox_path):
        try:
            os.remove(sandbox_file.sandbox_path)
        except Exception as e:
            logger.warning(f"Failed to delete sandboxed payload file: {e}")

    # 2. Update DB status
    sandbox_file.status = "QUARANTINED"
    sandbox_file.threat_score = 0.0
    sandbox_file.malware_description = "File quarantined and purged by administrator."

    # 3. Add dynamic WAF rule block uploader IP
    waf_rule = WAFRule(
        ip_address=sandbox_file.ip_address,
        action="BLOCK",
        reason=f"Decoy sandbox file upload containment: {sandbox_file.filename}",
        is_enabled=1,
        rule_type="AUTOMATIC",
        analyst_attribution="Sandbox SOC Controller"
    )
    db.add(waf_rule)

    # 4. Audit Log
    audit = AuditLog(
        action="CONTAIN_SANDBOX_MALWARE",
        module="sandbox",
        user="admin",
        details=f"Quarantined file '{sandbox_file.filename}' and blocked IP {sandbox_file.ip_address}."
    )
    db.add(audit)
    db.commit()

    return {"status": "SUCCESS", "message": f"Purged file and isolated uploader IP {sandbox_file.ip_address}."}
