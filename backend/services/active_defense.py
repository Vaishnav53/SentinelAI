import logging
import json
import re
from datetime import datetime, timedelta
from typing import Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models.models import WAFRule, WAFHit, AuditLog, AttackEvent
from backend.database.session import SessionLocal

logger = logging.getLogger(__name__)

# Premium glassmorphic enterprise WAF block page HTML template
WAF_BLOCK_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Restricted - SentinelAI WAF</title>
    <style>
        :root {
            --bg-deep: #02060c;
            --border-primary: rgba(0, 229, 255, 0.15);
            --red: #ef4444;
            --orange: #f97316;
            --text-primary: #ffffff;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
        }
        
        body {
            background-color: var(--bg-deep);
            color: var(--text-primary);
            font-family: 'Inter', -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(239, 68, 68, 0.08) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(0, 229, 255, 0.05) 0%, transparent 45%);
        }
        
        .waf-card {
            background: rgba(10, 16, 26, 0.7);
            border: 1px solid var(--border-primary);
            border-radius: 12px;
            padding: 40px;
            max-width: 600px;
            width: 90%;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.05);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .waf-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--red), var(--orange));
        }
        
        .shield-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            background-color: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 50%;
            color: var(--red);
            margin-bottom: 24px;
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
            animation: pulse-glow 2s infinite alternate;
        }

        @keyframes pulse-glow {
            0% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.3); }
            100% { box-shadow: 0 0 25px rgba(239, 68, 68, 0.4); border-color: rgba(239, 68, 68, 0.6); }
        }
        
        h1 {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 0.1em;
            margin: 0 0 12px 0;
            text-transform: uppercase;
            background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        p {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin: 0 0 30px 0;
        }
        
        .technical-details {
            background-color: rgba(2, 6, 12, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            padding: 20px;
            text-align: left;
            margin-bottom: 30px;
            font-family: monospace;
            font-size: 11px;
            color: var(--text-secondary);
        }
        
        .detail-row {
            display: flex;
            margin-bottom: 8px;
            border-bottom: 1px dashed rgba(255, 255, 255, 0.03);
            padding-bottom: 6px;
        }
        
        .detail-row:last-child {
            margin-bottom: 0;
            border-bottom: none;
            padding-bottom: 0;
        }
        
        .detail-label {
            color: var(--text-muted);
            width: 130px;
            font-weight: bold;
            flex-shrink: 0;
        }
        
        .detail-val {
            color: #ffffff;
            word-break: break-all;
        }
        
        .footer-note {
            font-size: 10px;
            color: var(--text-muted);
            letter-spacing: 0.05em;
        }
    </style>
</head>
<body>
    <div class="waf-card">
        <div class="shield-icon">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
        </div>
        <h1>Access Restricted by WAF</h1>
        <p>Your request signature or connection IP address has triggered security rules enforced by SentinelAI Web Application Firewall. Access has been temporarily restricted to contain threat vectors.</p>
        
        <div class="technical-details">
            <div class="detail-row">
                <span class="detail-label">Client IP:</span>
                <span class="detail-val">{client_ip}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Action Taken:</span>
                <span class="detail-val" style="color: var(--red); font-weight: bold;">{action}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Trigger Reason:</span>
                <span class="detail-val">{reason}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Timestamp:</span>
                <span class="detail-val">{timestamp}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Protection System:</span>
                <span class="detail-val">SentinelAI Active Defense Engine v1.0</span>
            </div>
        </div>
        
        <div class="footer-note">
            SECURITY INCIDENT LOGGED • SECURE CONTAINERIZED NETWORK
        </div>
    </div>
</body>
</html>
"""

class ActiveDefenseEngine:
    def __init__(self, db: Session):
        self.db = db

    def get_setting(self, key: str, default: Any) -> Any:
        from backend.models.models import ApplicationSetting
        row = self.db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()
        if row:
            if row.type == "int":
                return int(row.value)
            elif row.type == "float":
                return float(row.value)
            elif row.type == "bool":
                return row.value.lower() == "true"
            elif row.type == "json":
                try:
                    return json.loads(row.value)
                except Exception:
                    return default
            return row.value
        return default

    def evaluate_request(
        self, 
        ip: str, 
        path: str, 
        method: str, 
        headers: Dict[str, str], 
        body: str
    ) -> Tuple[bool, str, str]:
        """
        Intercept decoy requests and evaluate security rules.
        Returns: (is_blocked, action, reason)
        """
        now = datetime.utcnow()
        
        # 1. Fetch active rules matching this IP or all IPs (ip_address is Null/empty)
        rules = self.db.query(WAFRule).filter(
            WAFRule.is_enabled == 1,
            (WAFRule.ip_address == ip) | (WAFRule.ip_address == "") | (WAFRule.ip_address.is_(None))
        ).all()

        # 2. Check for rule expirations
        active_matched_rules = []
        for rule in rules:
            if rule.expires_at and rule.expires_at < now:
                rule.is_enabled = 0
                # Log audit trail
                audit = AuditLog(
                    action="EXPIRE_RULE",
                    module="waf",
                    user="system",
                    details=f"WAF rule ID {rule.id} for IP '{rule.ip_address}' has expired."
                )
                self.db.add(audit)
                self.db.commit()
                continue
            active_matched_rules.append(rule)

        # Evaluate matched rules: ALLOW takes precedence, then BLOCK/QUARANTINE
        # Sort rules so ALLOW rules are evaluated first, then BLOCK, then QUARANTINE
        action_priority = {"ALLOW": 0, "BLOCK": 1, "QUARANTINE": 2}
        active_matched_rules.sort(key=lambda r: action_priority.get(r.action, 99))

        for rule in active_matched_rules:
            # Increment trigger count
            rule.trigger_count += 1
            
            # Log hit
            hit = WAFHit(
                ip_address=ip,
                rule_id=rule.id,
                path=path,
                method=method,
                action=rule.action,
                payload=body[:200] if body else None,
                user_agent=headers.get("User-Agent", "Unknown")
            )
            self.db.add(hit)
            
            # Audit log
            audit = AuditLog(
                action="TRIGGER_RULE",
                module="waf",
                user="system",
                details=f"IP {ip} matched WAF rule {rule.id}. Action: {rule.action} | Reason: {rule.reason}"
            )
            self.db.add(audit)
            self.db.commit()

            if rule.action in ("BLOCK", "QUARANTINE"):
                return True, rule.action, rule.reason
            elif rule.action == "ALLOW":
                return False, "ALLOW", ""

        # 3. Apply Auto-Containment rules
        is_malicious, signature_type = self._scan_signatures(path, body)
        if is_malicious:
            # Check if auto-containment policy is enabled
            auto_enabled = self.get_setting("waf_auto_containment_enabled", "true").lower() == "true"
            if auto_enabled:
                # Count recent attacks from this IP (last 5 minutes)
                five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
                recent_attacks_count = self.db.query(AttackEvent).filter(
                    AttackEvent.source_ip == ip,
                    AttackEvent.created_at >= five_mins_ago
                ).count()

                # Trigger rule if they exceed count or have committed any CRITICAL/HIGH attack
                has_critical_attack = self.db.query(AttackEvent).filter(
                    AttackEvent.source_ip == ip,
                    AttackEvent.created_at >= five_mins_ago,
                    AttackEvent.severity.in_(["CRITICAL", "HIGH"])
                ).first() is not None

                # Contain if they have either committed a critical signature or hit the rate threshold (>= 2 events)
                if has_critical_attack or recent_attacks_count >= 1:
                    reason = f"Auto-containment policy triggered due to repeated intrusion signatures ({signature_type})"
                    
                    # Create automatic rule
                    auto_rule = WAFRule(
                        ip_address=ip,
                        action="BLOCK",
                        reason=reason,
                        is_enabled=1,
                        rule_type="AUTOMATIC",
                        expires_at=datetime.utcnow() + timedelta(hours=24),
                        analyst_attribution="SentinelAI WAF Engine",
                        trigger_count=1
                    )
                    self.db.add(auto_rule)
                    self.db.commit()
                    self.db.refresh(auto_rule)

                    # Log Hit
                    hit = WAFHit(
                        ip_address=ip,
                        rule_id=auto_rule.id,
                        path=path,
                        method=method,
                        action="BLOCK",
                        payload=body[:200] if body else None,
                        user_agent=headers.get("User-Agent", "Unknown")
                    )
                    self.db.add(hit)

                    # Log audit trail
                    audit = AuditLog(
                        action="CREATE_AUTO_RULE",
                        module="waf",
                        user="system",
                        details=f"Created auto-blocking WAF rule {auto_rule.id} for IP {ip}."
                    )
                    self.db.add(audit)
                    self.db.commit()

                    # Broadcast event via WebSockets
                    try:
                        from backend.api.attacks import manager
                        import asyncio
                        event_loop = asyncio.get_event_loop()
                        if event_loop.is_running():
                            event_loop.create_task(manager.broadcast({
                                "type": "waf_rule_created",
                                "data": {
                                    "id": auto_rule.id,
                                    "ip_address": auto_rule.ip_address,
                                    "action": auto_rule.action,
                                    "reason": auto_rule.reason,
                                    "rule_type": auto_rule.rule_type,
                                    "created_at": auto_rule.created_at.isoformat()
                                }
                            }))
                    except Exception as e:
                        logger.warning(f"Failed to broadcast auto-rule socket event: {e}")

                    # Trigger alert notifications via NotificationService
                    try:
                        from backend.services.notification import NotificationService
                        mock_attack_summary = {
                            "external_id": f"WAF-AUTO-{auto_rule.id}",
                            "attack_type": f"Active WAF containment triggered ({signature_type})",
                            "severity": "CRITICAL",
                            "threat_score": 10.0,
                            "source_ip": ip,
                            "country": "Sandbox Area",
                            "destination_port": 8088,
                            "target_service": "HTTP WAF Interceptor"
                        }
                        NotificationService(self.db).trigger_notifications(mock_attack_summary)
                    except Exception as e:
                        logger.warning(f"Failed to post notifications for WAF auto rule: {e}")

                    return True, "BLOCK", reason

        return False, "", ""

    def _scan_signatures(self, path: str, body: str) -> Tuple[bool, str]:
        """Simple signature scanner for common vulnerabilities inside WAF engine."""
        payloads = [path.lower(), body.lower()]
        
        for p in payloads:
            if not p:
                continue
            # SQL Injection indicators
            if "' or " in p or '" or ' in p or "select " in p or "union select" in p or "admin' --" in p:
                return True, "SQL Injection"
            # Cross-Site Scripting indicators
            if "<script" in p or "javascript:" in p or "onload=" in p or "onerror=" in p:
                return True, "Cross-Site Scripting (XSS)"
            # Local File Inclusion / Traversal indicators
            if "../" in p or "..\\\\" in p or "etc/passwd" in p or "boot.ini" in p:
                return True, "Path Traversal"

        return False, ""

    def get_block_html(self, client_ip: str, action: str, reason: str) -> str:
        """Returns the formatted beautiful block page HTML."""
        html = WAF_BLOCK_TEMPLATE
        html = html.replace("{client_ip}", client_ip)
        html = html.replace("{action}", "CONNECTION BLOCKED" if action == "BLOCK" else "HOST QUARANTINED")
        html = html.replace("{reason}", reason)
        html = html.replace("{timestamp}", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))
        return html
