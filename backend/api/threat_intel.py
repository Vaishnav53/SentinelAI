from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database.session import get_db
from backend.core.registry import get_settings_service
from backend.services.threat_intel import ThreatIntelService
from pydantic import BaseModel
from typing import Dict

router = APIRouter(prefix="/threat-intel", tags=["Threat Intelligence"])

class IPEnrichmentResponse(BaseModel):
    ip: str
    country: str
    country_code: str
    city: str
    asn: str
    isp: str
    threat_score: int
    risk_level: str
    confidence: float
    reputation_summary: str
    provider_statuses: Dict[str, str]
    latitude: float = 0.0
    longitude: float = 0.0

@router.get("/enrich/ip/{ip}", response_model=IPEnrichmentResponse)
def get_ip_enrichment(
    ip: str,
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Fetch enriched Threat Intelligence profile for a given IP."""
    try:
        import ipaddress
        ipaddress.ip_address(ip)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address format")

    service = ThreatIntelService(db, settings_service)
    return service.enrich_ip(ip)
