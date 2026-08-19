import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.database.session import get_db
from backend.models.models import WAFRule, WAFHit, AuditLog, AttackEvent, HoneypotActivityLog, DecoySandboxFile
from backend.api.dependencies import require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/waf", tags=["waf"])

class ObservedSourceRead(BaseModel):
    ip_address: str
    last_seen: str
    event_count: int
    threat_types: List[str]
    is_blocked: bool
    rule_id: Optional[int] = None

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
def get_waf_rules(
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

@router.post("/rules", response_model=WAFRuleRead, dependencies=[Depends(require_admin)])
def create_waf_rule(payload: WAFRuleCreate, db: Session = Depends(get_db)):
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

@router.put("/rules/{id}", response_model=WAFRuleRead, dependencies=[Depends(require_admin)])
def update_waf_rule(id: int, payload: WAFRuleUpdate, db: Session = Depends(get_db)):
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

@router.delete("/rules/{id}", dependencies=[Depends(require_admin)])
def delete_waf_rule(id: int, db: Session = Depends(get_db)):

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
def get_waf_status(db: Session = Depends(get_db)):
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
def get_waf_hits(db: Session = Depends(get_db)):
    """Retrieve audit history logs of WAF rule matches."""
    return db.query(WAFHit).order_by(WAFHit.created_at.desc()).limit(100).all()

@router.get("/observed-sources", response_model=List[ObservedSourceRead])
def get_observed_sources(db: Session = Depends(get_db)):
    """Retrieve all real source IPs observed across honeypot and telemetry logs."""
    from collections import defaultdict

    timestamps_map = defaultdict(list)
    threat_types_map = defaultdict(set)
    counts_map = defaultdict(int)

    # 1. AttackEvent
    for ae in db.query(AttackEvent.source_ip, AttackEvent.created_at, AttackEvent.attack_type).filter(AttackEvent.source_ip != None).all():
        ip = ae[0]
        if not ip: continue
        counts_map[ip] += 1
        if ae[1]: timestamps_map[ip].append(ae[1])
        if ae[2]: threat_types_map[ip].add(ae[2])

    # 2. HoneypotActivityLog
    for hl in db.query(HoneypotActivityLog.source_ip, HoneypotActivityLog.timestamp, HoneypotActivityLog.action_type).filter(HoneypotActivityLog.source_ip != None).all():
        ip = hl[0]
        if not ip: continue
        counts_map[ip] += 1
        if hl[1]: timestamps_map[ip].append(hl[1])
        if hl[2]: threat_types_map[ip].add(hl[2])

    # 3. WAFHit
    for wh in db.query(WAFHit.ip_address, WAFHit.created_at, WAFHit.action).filter(WAFHit.ip_address != None).all():
        ip = wh[0]
        if not ip: continue
        counts_map[ip] += 1
        if wh[1]: timestamps_map[ip].append(wh[1])
        if wh[2]: threat_types_map[ip].add(f"WAF {wh[2]}")

    # 4. DecoySandboxFile
    for sf in db.query(DecoySandboxFile.ip_address, DecoySandboxFile.created_at, DecoySandboxFile.status).filter(DecoySandboxFile.ip_address != None).all():
        ip = sf[0]
        if not ip: continue
        counts_map[ip] += 1
        if sf[1]: timestamps_map[ip].append(sf[1])
        if sf[2]: threat_types_map[ip].add(f"Sandbox {sf[2]}")

    # Active WAF block rules lookup
    blocked_rules_map = {
        rule.ip_address: rule.id
        for rule in db.query(WAFRule).filter(WAFRule.is_enabled == 1, WAFRule.action == "BLOCK").all()
        if rule.ip_address
    }

    all_ips = set(counts_map.keys())
    observed_sources = []
    for ip in all_ips:
        timestamps = timestamps_map[ip]
        latest_time = max(timestamps) if timestamps else datetime.utcnow()
        last_seen_str = latest_time.strftime("%Y-%m-%d %H:%M:%S UTC")
        rule_id = blocked_rules_map.get(ip)

        observed_sources.append(ObservedSourceRead(
            ip_address=ip,
            last_seen=last_seen_str,
            event_count=counts_map[ip],
            threat_types=sorted(list(threat_types_map[ip])),
            is_blocked=rule_id is not None,
            rule_id=rule_id
        ))

    return sorted(observed_sources, key=lambda x: x.last_seen, reverse=True)
