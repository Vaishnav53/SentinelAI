import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.database.session import get_db
from backend.models.models import WAFRule, WAFHit, AuditLog, AttackEvent, HoneypotActivityLog
from backend.api.dependencies import require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/waf", tags=["waf"])

def is_local_ip(ip: str) -> bool:
    """Determine if an IP address belongs to RFC 1918 private or loopback ranges."""
    if not ip:
        return False
    local_prefixes = (
        "127.", "::1", "localhost",
        "192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
        "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
        "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31."
    )
    return any(ip.startswith(prefix) for prefix in local_prefixes)

class ObservedSourceRead(BaseModel):
    ip_address: str
    last_seen: str
    first_seen: Optional[str] = None
    event_count: int
    threat_types: List[str] = []
    services: List[str] = []
    severity: str = "LOW"
    is_blocked: bool
    is_local: bool = False
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
    honeypot_attackers_count: int = 0
    blocked_attackers_count: int = 0

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
    blocked_count = db.query(func.count(WAFHit.id)).filter(WAFHit.action == "BLOCK").scalar() or 0
    quarantined_count = db.query(func.count(WAFHit.id)).filter(WAFHit.action == "QUARANTINE").scalar() or 0

    active_rules_count = db.query(func.count(WAFRule.id)).filter(WAFRule.is_enabled == 1).scalar() or 0
    auto_rules_count = db.query(func.count(WAFRule.id)).filter(WAFRule.rule_type == "AUTOMATIC").scalar() or 0
    manual_rules_count = db.query(func.count(WAFRule.id)).filter(WAFRule.rule_type == "MANUAL").scalar() or 0

    # Distinct honeypot attackers count using fast distinct query projections
    hp_attack_ips = set(r[0] for r in db.query(AttackEvent.source_ip).filter(AttackEvent.source_ip != None).distinct().all())
    hp_activity_ips = set(r[0] for r in db.query(HoneypotActivityLog.source_ip).filter(HoneypotActivityLog.source_ip != None).distinct().all())
    hp_ips = hp_attack_ips | hp_activity_ips

    blocked_ips_set = set(r[0] for r in db.query(WAFRule.ip_address).filter(WAFRule.is_enabled == 1, WAFRule.action == "BLOCK").all() if r[0])
    blocked_attackers_count = len(hp_ips & blocked_ips_set)

    return WAFStatus(
        blocked_count=blocked_count,
        quarantined_count=quarantined_count,
        active_rules_count=active_rules_count,
        auto_rules_count=auto_rules_count,
        manual_rules_count=manual_rules_count,
        honeypot_attackers_count=len(hp_ips),
        blocked_attackers_count=blocked_attackers_count
    )

@router.get("/hits", response_model=List[WAFHitRead])
def get_waf_hits(db: Session = Depends(get_db)):
    """Retrieve audit history logs of WAF rule matches."""
    return db.query(WAFHit).order_by(WAFHit.created_at.desc()).limit(100).all()

@router.get("/observed-sources", response_model=List[ObservedSourceRead])
def get_observed_sources(db: Session = Depends(get_db)):
    """Retrieve all real source IPs observed strictly across SentinelAI honeypot telemetry."""
    severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    # 1. AttackEvents SQL aggregation
    ae_rows = db.query(
        AttackEvent.source_ip,
        func.count(AttackEvent.id),
        func.min(AttackEvent.created_at),
        func.max(AttackEvent.created_at),
        func.group_concat(func.distinct(AttackEvent.attack_type)),
        func.group_concat(func.distinct(AttackEvent.target_service)),
        func.group_concat(func.distinct(AttackEvent.severity))
    ).filter(AttackEvent.source_ip != None).group_by(AttackEvent.source_ip).all()

    # 2. HoneypotActivityLog SQL aggregation
    hp_rows = db.query(
        HoneypotActivityLog.source_ip,
        func.count(HoneypotActivityLog.id),
        func.min(HoneypotActivityLog.timestamp),
        func.max(HoneypotActivityLog.timestamp),
        func.group_concat(func.distinct(HoneypotActivityLog.action_type)),
        func.group_concat(func.distinct(HoneypotActivityLog.severity))
    ).filter(HoneypotActivityLog.source_ip != None).group_by(HoneypotActivityLog.source_ip).all()

    # 3. Active WAF block rules lookup
    blocked_rules_map = {
        rule_ip: rule_id
        for rule_id, rule_ip in db.query(WAFRule.id, WAFRule.ip_address).filter(WAFRule.is_enabled == 1, WAFRule.action == "BLOCK").all()
        if rule_ip
    }

    # Consolidate in Python per IP
    ip_stats = {}

    def get_entry(ip):
        if ip not in ip_stats:
            ip_stats[ip] = {
                "cnt": 0, "first_seen": None, "last_seen": None,
                "types_set": set(), "services_set": set(), "highest_sev": "LOW"
            }
        return ip_stats[ip]

    for ip, cnt, min_dt, max_dt, a_types, svcs, sevs in ae_rows:
        if not ip: continue
        entry = get_entry(ip)
        entry["cnt"] += cnt
        if min_dt:
            dt = datetime.fromisoformat(min_dt) if isinstance(min_dt, str) else min_dt
            if not entry["first_seen"] or dt < entry["first_seen"]:
                entry["first_seen"] = dt
        if max_dt:
            dt = datetime.fromisoformat(max_dt) if isinstance(max_dt, str) else max_dt
            if not entry["last_seen"] or dt > entry["last_seen"]:
                entry["last_seen"] = dt
        if a_types:
            for t in a_types.split(","):
                if t: entry["types_set"].add(t)
        if svcs:
            for s in svcs.split(","):
                if s: entry["services_set"].add(s)
        if sevs:
            for s in sevs.split(","):
                s_val = s.strip().upper()
                if s_val in severities and severities.index(s_val) > severities.index(entry["highest_sev"]):
                    entry["highest_sev"] = s_val

    for ip, cnt, min_dt, max_dt, acts, sevs in hp_rows:
        if not ip: continue
        entry = get_entry(ip)
        entry["cnt"] += cnt
        if min_dt:
            dt = datetime.fromisoformat(min_dt) if isinstance(min_dt, str) else min_dt
            if not entry["first_seen"] or dt < entry["first_seen"]:
                entry["first_seen"] = dt
        if max_dt:
            dt = datetime.fromisoformat(max_dt) if isinstance(max_dt, str) else max_dt
            if not entry["last_seen"] or dt > entry["last_seen"]:
                entry["last_seen"] = dt
        if acts:
            for a in acts.split(","):
                if a: entry["types_set"].add(a.strip().replace("_", " ").title())
        if sevs:
            for s in sevs.split(","):
                s_val = s.strip().upper()
                if s_val in severities and severities.index(s_val) > severities.index(entry["highest_sev"]):
                    entry["highest_sev"] = s_val

    observed_sources = []
    for ip, entry in ip_stats.items():
        if not ip: continue
        fs = entry["first_seen"]
        ls = entry["last_seen"]
        rule_id = blocked_rules_map.get(ip)
        is_local = is_local_ip(ip)

        observed_sources.append(ObservedSourceRead(
            ip_address=ip,
            last_seen=ls.strftime("%Y-%m-%d %H:%M:%S UTC") if ls else datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            first_seen=fs.isoformat() if fs else None,
            event_count=entry["cnt"],
            threat_types=sorted(list(entry["types_set"])),
            services=sorted(list(entry["services_set"])),
            severity=entry["highest_sev"],
            is_blocked=rule_id is not None,
            is_local=is_local,
            rule_id=rule_id
        ))

    return sorted(observed_sources, key=lambda x: x.last_seen, reverse=True)
