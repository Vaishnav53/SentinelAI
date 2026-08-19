import logging
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.models import AttackEvent, WAFHit, DecoySandboxFile, WAFRule, PlaybookExecution, ThreatPlaybook, CorrelatedIncident, HoneypotActivityLog

logger = logging.getLogger(__name__)

# MITRE technique definitions
MITRE_MAPPINGS = {
    "T1110": {"tactic": "Credential Access", "name": "Brute Force"},
    "T1190": {"tactic": "Initial Access", "name": "Exploit Public-Facing Application"},
    "T1083": {"tactic": "Discovery", "name": "File and Directory Discovery"},
    "T1078": {"tactic": "Defense Evasion", "name": "Valid Accounts"},
    "T1548": {"tactic": "Privilege Escalation", "name": "Abuse Elevation Control Mechanism"},
    "T1105": {"tactic": "Command and Control", "name": "Ingress Tool Transfer"}
}

def is_local_ip(ip: str) -> bool:
    if not ip:
        return True
    return ip in ("127.0.0.1", "::1", "localhost") or ip.startswith(("192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31."))

class AttackerProfilingService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_attackers(self) -> List[Dict[str, Any]]:
        """Retrieve all unique attacking IPs with incident metrics aggregates."""
        from sqlalchemy import func

        # 1. Aggregate counts per IP
        attack_counts = dict(self.db.query(AttackEvent.source_ip, func.count(AttackEvent.id)).filter(AttackEvent.source_ip != None).group_by(AttackEvent.source_ip).all())
        waf_counts = dict(self.db.query(WAFHit.ip_address, func.count(WAFHit.id)).filter(WAFHit.ip_address != None).group_by(WAFHit.ip_address).all())
        sandbox_counts = dict(self.db.query(DecoySandboxFile.ip_address, func.count(DecoySandboxFile.id)).filter(DecoySandboxFile.ip_address != None).group_by(DecoySandboxFile.ip_address).all())
        activity_counts = dict(self.db.query(HoneypotActivityLog.source_ip, func.count(HoneypotActivityLog.id)).filter(HoneypotActivityLog.source_ip != None).group_by(HoneypotActivityLog.source_ip).all())

        # Blocked IPs
        blocked_ips = set(ip[0] for ip in self.db.query(WAFRule.ip_address).filter(WAFRule.is_enabled == 1, WAFRule.action == "BLOCK").all() if ip[0])

        # All distinct IPs
        all_ips = set(attack_counts.keys()) | set(waf_counts.keys()) | set(sandbox_counts.keys()) | set(activity_counts.keys())

        # Fast GeoIP lookup
        geo_map = {}
        for ae in self.db.query(AttackEvent.source_ip, AttackEvent.country, AttackEvent.city).filter(AttackEvent.source_ip != None).all():
            if ae[0] and ae[0] not in geo_map and ae[1] and ae[1] != "Unknown":
                geo_map[ae[0]] = (ae[1], ae[2] or "Unknown")

        # Fast Max Severities
        sev_map = {}
        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        for ae in self.db.query(AttackEvent.source_ip, AttackEvent.severity).filter(AttackEvent.source_ip != None).all():
            if ae[0]:
                curr = sev_map.get(ae[0], "LOW")
                sev_val = ae[1].upper() if ae[1] else "LOW"
                if sev_val in severities and (curr not in severities or severities.index(sev_val) > severities.index(curr)):
                    sev_map[ae[0]] = sev_val

        results = []
        for ip in all_ips:
            if not ip:
                continue
            geo = geo_map.get(ip, ("Unknown", "Unknown"))
            country, city = geo
            if country == "Unknown" and is_local_ip(ip):
                country = "Local Network"
                city = "Local Infrastructure"

            results.append({
                "ip_address": ip,
                "attack_count": attack_counts.get(ip, 0) + activity_counts.get(ip, 0),
                "waf_count": waf_counts.get(ip, 0),
                "sandbox_count": sandbox_counts.get(ip, 0),
                "highest_severity": sev_map.get(ip, "LOW"),
                "is_blocked": ip in blocked_ips,
                "country": country,
                "city": city
            })

        # Sort results by threat severity/count
        return sorted(results, key=lambda x: x["attack_count"] + x["waf_count"] + x["sandbox_count"], reverse=True)


    def get_attacker_profile(self, ip: str) -> Optional[Dict[str, Any]]:
        """Build detailed threat profile timeline and MITRE mappings for an IP."""
        # 1. GeoIP details
        country = "Unknown"
        city = "Unknown"
        lat, lon = 0.0, 0.0
        
        # Check any logged attack events for metadata
        a_events = self.db.query(AttackEvent).filter(AttackEvent.source_ip == ip).all()
        for ae in a_events:
            if ae.country and ae.country != "Unknown":
                country = ae.country
                city = ae.city or "Unknown"
                # Parse coordinate geometry
                if ae.raw_metadata:
                    try:
                        meta = json.loads(ae.raw_metadata)
                        lat = meta.get("latitude", 0.0)
                        lon = meta.get("longitude", 0.0)
                    except:
                        pass
                break

        if country == "Unknown" and is_local_ip(ip):
            country = "Local Network"
            city = "Local Infrastructure"

        # Fetch honeypot activity logs
        h_logs = self.db.query(HoneypotActivityLog).filter(HoneypotActivityLog.source_ip == ip).all()

        # 2. MITRE Techniques matched
        matched_techniques = {}
        for ae in a_events:
            # Deduce technique mapping from attack labels
            tech_id = None
            if "sql" in ae.attack_type.lower() or "xss" in ae.attack_type.lower() or "injection" in ae.attack_type.lower():
                tech_id = "T1190"
            elif "traversal" in ae.attack_type.lower():
                tech_id = "T1083"
            elif "brute" in ae.attack_type.lower() or "credentials" in ae.attack_type.lower():
                tech_id = "T1110"
            elif "upload" in ae.attack_type.lower() or "malware" in ae.attack_type.lower():
                tech_id = "T1105"

            if tech_id and tech_id in MITRE_MAPPINGS:
                t_info = MITRE_MAPPINGS[tech_id]
                if tech_id not in matched_techniques:
                    matched_techniques[tech_id] = {
                        "id": tech_id,
                        "name": t_info["name"],
                        "tactic": t_info["tactic"],
                        "count": 1
                    }
                else:
                    matched_techniques[tech_id]["count"] += 1

        for hl in h_logs:
            tech_id = None
            action_lower = (hl.action_type or "").lower()
            if "login" in action_lower or "auth" in action_lower:
                tech_id = "T1110"
            elif "sql" in action_lower or "inject" in action_lower:
                tech_id = "T1190"
            elif "admin" in action_lower or "privilege" in action_lower:
                tech_id = "T1548"

            if tech_id and tech_id in MITRE_MAPPINGS:

                t_info = MITRE_MAPPINGS[tech_id]
                if tech_id not in matched_techniques:
                    matched_techniques[tech_id] = {
                        "id": tech_id,
                        "name": t_info["name"],
                        "tactic": t_info["tactic"],
                        "count": 1
                    }
                else:
                    matched_techniques[tech_id]["count"] += 1

        # 3. Dynamic Chronological Timeline
        timeline = []
        
        # Add AttackEvents
        for ae in a_events:
            timeline.append({
                "time": ae.created_at.isoformat(),
                "type": "ATTACK",
                "severity": ae.severity,
                "description": f"Honeypot Sensor matched pattern: {ae.attack_type} - {ae.payload}"
            })

        # Add HoneypotActivityLog entries
        for hl in h_logs:
            time_str = hl.timestamp.isoformat() if hl.timestamp else datetime.utcnow().isoformat()
            user_str = f" (User: {hl.username_or_email})" if hl.username_or_email else ""
            timeline.append({
                "time": time_str,
                "type": "HONEYPOT_ACTIVITY",
                "severity": hl.severity or "MEDIUM",
                "description": f"Aetheris Telemetry: {hl.action_type} - {hl.result} on path {hl.request_path}{user_str}"
            })

        # Add WAF Hits
        waf_hits = self.db.query(WAFHit).filter(WAFHit.ip_address == ip).all()
        for wh in waf_hits:
            timeline.append({
                "time": wh.created_at.isoformat(),
                "type": "WAF_BLOCK",
                "severity": "HIGH",
                "description": f"WAF Intercepted request: {wh.method} {wh.path} - Intercept override action: {wh.action}"
            })

        # Add DecoySandboxFiles
        sandbox_files = self.db.query(DecoySandboxFile).filter(DecoySandboxFile.ip_address == ip).all()
        for sf in sandbox_files:
            timeline.append({
                "time": sf.created_at.isoformat(),
                "type": "SANDBOX_UPLOAD",
                "severity": "CRITICAL" if sf.status == "MALICIOUS" else "HIGH",
                "description": f"Sandbox Payload Upload: {sf.filename} (Hash: {sf.sha256[:12]}...) - Status: {sf.status}"
            })

        # Sort timeline chronologically
        timeline = sorted(timeline, key=lambda x: x["time"], reverse=True)

        # 4. WAF Containment state
        is_blocked = self.db.query(WAFRule).filter(
            WAFRule.ip_address == ip,
            WAFRule.is_enabled == 1,
            WAFRule.action == "BLOCK"
        ).first() is not None

        # 5. Playbook Executions
        executions = []
        execs_records = self.db.query(PlaybookExecution).filter(PlaybookExecution.target_ip == ip).all()
        for ex in execs_records:
            playbook = self.db.query(ThreatPlaybook).filter(ThreatPlaybook.id == ex.playbook_id).first()
            executions.append({
                "id": ex.id,
                "playbook_name": playbook.name if playbook else "Unknown Workflow",
                "status": ex.status,
                "created_at": ex.created_at.isoformat(),
                "logs": json.loads(ex.logs_data or "[]")
            })

        return {
            "ip_address": ip,
            "country": country,
            "city": city,
            "latitude": lat,
            "longitude": lon,
            "attack_count": len(a_events) + len(h_logs),
            "waf_count": len(waf_hits),
            "sandbox_count": len(sandbox_files),
            "is_blocked": is_blocked,
            "mitre_techniques": list(matched_techniques.values()),
            "timeline": timeline,
            "playbook_executions": executions
        }
