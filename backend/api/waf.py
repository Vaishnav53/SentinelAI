import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.database.session import get_db
from backend.models.models import WAFRule, WAFHit, AuditLog

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/waf", tags=["waf"])

class WAFRuleRead(BaseModel):
    id: int
    ip_address: Optional[str] = None
    action: str
    reason: Optional[str] = None
    is_enabled: int
    rule_type: str
    expires_at: Optional[datetime] = None
    analyst_attribution: Optional[str] = None
    trigger_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class WAFRuleCreate(BaseModel):
    ip_address: Optional[str] = None
    action: str
    reason: Optional[str] = None
    is_enabled: int = 1
    rule_type: str = "MANUAL"
    expires_at: Optional[datetime] = None
    analyst_attribution: Optional[str] = None

class WAFRuleUpdate(BaseModel):
    ip_address: Optional[str] = None
    action: Optional[str] = None
    reason: Optional[str] = None
    is_enabled: Optional[int] = None
    expires_at: Optional[datetime] = None
    analyst_attribution: Optional[str] = None

class WAFHitRead(BaseModel):
    id: int
    ip_address: str
    rule_id: Optional[int] = None
    path: str
    method: str
    action: str
    payload: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class WAFStatus(BaseModel):
    blocked_count: int
    quarantined_count: int
    active_rules_count: int
    auto_rules_count: int
    manual_rules_count: int

@router.get("/rules", response_model=List[WAFRuleRead])
async def get_waf_rules(
    search: Optional[str] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve all WAF active and inactive defensive containment rules."""
    query = db.query(WAFRule)
    if search:
        query = query.filter(
            (WAFRule.ip_address.like(f"%{search}%")) |
            (WAFRule.reason.like(f"%{search}%")) |
            (WAFRule.analyst_attribution.like(f"%{search}%"))
        )
    if action:
        query = query.filter(WAFRule.action == action.upper())
    return query.order_by(WAFRule.created_at.desc()).all()

@router.post("/rules", response_model=WAFRuleRead)
async def create_waf_rule(payload: WAFRuleCreate, db: Session = Depends(get_db)):
    """Create a new manual security containment rule."""
    rule = WAFRule(
        ip_address=payload.ip_address,
        action=payload.action.upper(),
        reason=payload.reason or "Manually configured via WAF controller",
        is_enabled=payload.is_enabled,
        rule_type="MANUAL",
        expires_at=payload.expires_at,
        analyst_attribution=payload.analyst_attribution or "System Analyst"
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    audit = AuditLog(
        action="CREATE_RULE",
        module="waf",
        user=rule.analyst_attribution,
        details=f"Created WAF rule ID {rule.id} for target IP '{rule.ip_address}'. Action: {rule.action}"
    )
    db.add(audit)
    db.commit()
    return rule

@router.put("/rules/{id}", response_model=WAFRuleRead)
async def update_waf_rule(id: int, payload: WAFRuleUpdate, db: Session = Depends(get_db)):
    """Edit details or enable/disable an existing WAF rule."""
    rule = db.query(WAFRule).filter(WAFRule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="WAF rule not found")

    if payload.ip_address is not None:
        rule.ip_address = payload.ip_address
    if payload.action is not None:
        rule.action = payload.action.upper()
    if payload.reason is not None:
        rule.reason = payload.reason
    if payload.is_enabled is not None:
        rule.is_enabled = payload.is_enabled
    if payload.expires_at is not None:
        rule.expires_at = payload.expires_at
    if payload.analyst_attribution is not None:
        rule.analyst_attribution = payload.analyst_attribution

    db.commit()
    db.refresh(rule)

    audit = AuditLog(
        action="UPDATE_RULE",
        module="waf",
        user=rule.analyst_attribution or "System",
        details=f"Updated WAF rule ID {rule.id}. Action: {rule.action} | Enabled: {rule.is_enabled}"
    )
    db.add(audit)
    db.commit()
    return rule

@router.delete("/rules/{id}")
async def delete_waf_rule(id: int, db: Session = Depends(get_db)):
    """Remove a security containment rule."""
    rule = db.query(WAFRule).filter(WAFRule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="WAF rule not found")

    db.delete(rule)
    db.commit()

    audit = AuditLog(
        action="DELETE_RULE",
        module="waf",
        user="System Analyst",
        details=f"Deleted WAF rule ID {id} for target IP '{rule.ip_address}'."
    )
    db.add(audit)
    db.commit()
    return {"message": f"Rule {id} successfully deleted"}

@router.get("/status", response_model=WAFStatus)
async def get_waf_status(db: Session = Depends(get_db)):
    """Fetch aggregated defense metrics for WAF status dashboard widgets."""
    blocked_count = db.query(WAFHit).filter(WAFHit.action == "BLOCK").count()
    quarantined_count = db.query(WAFHit).filter(WAFHit.action == "QUARANTINE").count()
    
    active_rules_count = db.query(WAFRule).filter(WAFRule.is_enabled == 1).count()
    auto_rules_count = db.query(WAFRule).filter(WAFRule.rule_type == "AUTOMATIC").count()
    manual_rules_count = db.query(WAFRule).filter(WAFRule.rule_type == "MANUAL").count()

    return WAFStatus(
        blocked_count=blocked_count,
        quarantined_count=quarantined_count,
        active_rules_count=active_rules_count,
        auto_rules_count=auto_rules_count,
        manual_rules_count=manual_rules_count
    )

@router.get("/hits", response_model=List[WAFHitRead])
async def get_waf_hits(db: Session = Depends(get_db)):
    """Retrieve audit history logs of WAF rule matches."""
    return db.query(WAFHit).order_by(WAFHit.created_at.desc()).limit(100).all()
