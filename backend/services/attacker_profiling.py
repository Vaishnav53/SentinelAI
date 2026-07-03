import logging
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.models import AttackEvent, WAFHit, DecoySandboxFile, WAFRule, PlaybookExecution, ThreatPlaybook, CorrelatedIncident

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

class AttackerProfilingService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_attackers(self) -> List[Dict[str, Any]]:
        """Retrieve all unique attacking IPs with incident metrics aggregates."""
        # Find distinct IPs across telemetry models
        ips = set()
        for ip in self.db.query(AttackEvent.source_ip).distinct().all():
            if ip[0]: ips.add(ip[0])
        for ip in self.db.query(WAFHit.ip_address).distinct().all():
            if ip[0]: ips.add(ip[0])
        for ip in self.db.query(DecoySandboxFile.ip_address).distinct().all():
            if ip[0]: ips.add(ip[0])

        results = []
        for ip in ips:
            # Skip localhost local loop checking for cleaner lists if needed (optional)
            attack_count = self.db.query(AttackEvent).filter(AttackEvent.source_ip == ip).count()
            waf_count = self.db.query(WAFHit).filter(WAFHit.ip_address == ip).count()
            sandbox_count = self.db.query(DecoySandboxFile).filter(DecoySandboxFile.ip_address == ip).count()
            
            # Highest severity calculation
            max_severity = "LOW"
            severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            for a in self.db.query(AttackEvent.severity).filter(AttackEvent.source_ip == ip).all():
                sev_val = a[0].upper() if a[0] else "LOW"
                if sev_val in severities:
                    if severities.index(sev_val) > severities.index(max_severity):
                        max_severity = sev_val
            
            # WAF Block active status
            is_blocked = self.db.query(WAFRule).filter(
                WAFRule.ip_address == ip,
                WAFRule.is_enabled == 1,
                WAFRule.action == "BLOCK"
            ).first() is not None

            # Look up GeoIP from any logged attacks raw metadata
            country = "Unknown"
            city = "Unknown"
            a_event = self.db.query(AttackEvent).filter(AttackEvent.source_ip == ip).first()
            if a_event:
                country = a_event.country or "Unknown"
                city = a_event.city or "Unknown"

            results.append({
                "ip_address": ip,
                "attack_count": attack_count,
                "waf_count": waf_count,
                "sandbox_count": sandbox_count,
                "highest_severity": max_severity,
                "is_blocked": is_blocked,
                "country": country,
                "city": city
            })

        # Sort results by threat severity/count
        return sorted(results, key=lambda x: x["attack_count"] + x["waf_count"], reverse=True)

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
            "attack_count": len(a_events),
            "waf_count": len(waf_hits),
            "sandbox_count": len(sandbox_files),
            "is_blocked": is_blocked,
            "mitre_techniques": list(matched_techniques.values()),
            "timeline": timeline,
            "playbook_executions": executions
        }

