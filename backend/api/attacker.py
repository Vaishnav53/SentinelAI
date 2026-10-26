import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from backend.database.session import get_db
from backend.services.attacker_profiling import AttackerProfilingService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attacker", tags=["Attacker Profiling"])

@router.get("/profiles")
def get_attacker_profiles(
    limit: Optional[int] = Query(None, ge=1, le=10000, description="Optional maximum number of attacker profiles to return"),
    db: Session = Depends(get_db)
):
    """Retrieve unique attacking IPs with telemetry metrics aggregates."""
    try:
        service = AttackerProfilingService(db)
        return service.get_all_attackers(limit=limit)
    except Exception as e:
        logger.error(f"Failed to fetch attacker profiles: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/profiles/{ip}")
def get_attacker_profile_detail(ip: str, db: Session = Depends(get_db)):
    """Retrieve details, timelines, playbooks execution, and MITRE maps for an attacker IP."""
    try:
        service = AttackerProfilingService(db)
        profile = service.get_attacker_profile(ip)
        if not profile:
            raise HTTPException(status_code=404, detail="Attacker profile not found")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch profile detail for {ip}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
