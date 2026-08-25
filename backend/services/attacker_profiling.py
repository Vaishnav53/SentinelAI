import logging
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.models import (
    AttackEvent,
    WAFHit,
    DecoySandboxFile,
    WAFRule,
    PlaybookExecution,
    ThreatPlaybook,
    CorrelatedIncident,
    HoneypotActivityLog
)

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
    return ip in ("127.0.0.1", "::1", "localhost") or ip.startswith((
        "192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
        "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
        "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31."
    ))

def calculate_risk_assessment(highest_severity: str, total_events: int, attack_type_count: int, has_malicious_file: bool) -> tuple[int, str]:
    """
    Deterministic SentinelAI Risk Assessment calculation derived exclusively from real database telemetry.
    Score range: 0-100.
    Risk Levels: LOW (0-29), MEDIUM (30-59), HIGH (60-84), CRITICAL (85-100).
    """
    base_scores = {
        "CRITICAL": 70,
        "HIGH": 45,
        "MEDIUM": 25,
        "LOW": 10
    }
    score = base_scores.get(highest_severity.upper(), 10)

    # Event volume impact (up to +15 pts)
    volume_bonus = min(15, total_events * 2)
    score += volume_bonus

    # Vector diversity impact (up to +10 pts)
    diversity_bonus = min(10, attack_type_count * 3)
    score += diversity_bonus

    # Malicious file upload bonus (+15 pts)
    if has_malicious_file:
        score += 15

    score = max(5, min(100, score))

    if score >= 85:
        level = "CRITICAL"
    elif score >= 60:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    else:
        level = "LOW"

    return score, level

class AttackerProfilingService:
    def __init__(self, db: Session):
        self.db = db

    def get_all_attackers(self) -> List[Dict[str, Any]]:
        """Retrieve all unique attacking IPs with telemetry metrics aggregates and real timestamps efficiently."""
        from sqlalchemy import func

        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

        # 1. Blocked WAF rules map (fast index lookup)
        blocked_rules_map = {}
        for rule_id, rule_ip in self.db.query(WAFRule.id, WAFRule.ip_address).filter(WAFRule.is_enabled == 1, WAFRule.action == "BLOCK").all():
            if rule_ip:
                blocked_rules_map[rule_ip] = rule_id

        # 2. AttackEvents SQL aggregation
        ae_rows = self.db.query(
            AttackEvent.source_ip,
            func.count(AttackEvent.id),
            func.min(AttackEvent.created_at),
            func.max(AttackEvent.created_at),
            func.group_concat(func.distinct(AttackEvent.attack_type)),
            func.group_concat(func.distinct(AttackEvent.severity))
        ).filter(AttackEvent.source_ip != None).group_by(AttackEvent.source_ip).all()

        # Geo lookup from AttackEvent (only for non-Unknown country)
        geo_rows = self.db.query(
            AttackEvent.source_ip,
            AttackEvent.country,
            AttackEvent.city
        ).filter(
            AttackEvent.source_ip != None,
            AttackEvent.country != None,
            AttackEvent.country != "Unknown"
        ).group_by(AttackEvent.source_ip).all()
        geo_map = {r[0]: (r[1], r[2] or "Unknown") for r in geo_rows}

        # 3. HoneypotActivityLog SQL aggregation
        hp_rows = self.db.query(
            HoneypotActivityLog.source_ip,
            func.count(HoneypotActivityLog.id),
            func.min(HoneypotActivityLog.timestamp),
            func.max(HoneypotActivityLog.timestamp),
            func.group_concat(func.distinct(HoneypotActivityLog.action_type)),
            func.group_concat(func.distinct(HoneypotActivityLog.severity))
        ).filter(HoneypotActivityLog.source_ip != None).group_by(HoneypotActivityLog.source_ip).all()

        # 4. WAFHit SQL aggregation
        waf_rows = self.db.query(
            WAFHit.ip_address,
            func.count(WAFHit.id),
            func.min(WAFHit.created_at),
            func.max(WAFHit.created_at),
            func.group_concat(func.distinct(WAFHit.action))
        ).filter(WAFHit.ip_address != None).group_by(WAFHit.ip_address).all()

        # 5. DecoySandboxFile SQL aggregation
        sb_rows = self.db.query(
            DecoySandboxFile.ip_address,
            func.count(DecoySandboxFile.id),
            func.min(DecoySandboxFile.created_at),
            func.max(DecoySandboxFile.created_at),
            func.group_concat(func.distinct(DecoySandboxFile.status))
        ).filter(DecoySandboxFile.ip_address != None).group_by(DecoySandboxFile.ip_address).all()

        # Consolidate per IP
        ip_stats = {}

        def get_entry(ip):
            if ip not in ip_stats:
                ip_stats[ip] = {
                    "a_count": 0, "hp_count": 0, "w_count": 0, "s_count": 0,
                    "first_seen": None, "last_seen": None,
                    "types_set": set(), "highest_sev": "LOW",
                    "has_malware": False
                }
            return ip_stats[ip]

        for ip, cnt, min_dt, max_dt, a_types, sevs in ae_rows:
            if not ip: continue
            entry = get_entry(ip)
            entry["a_count"] += cnt
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
            if sevs:
                for s in sevs.split(","):
                    s_val = s.strip().upper()
                    if s_val in severities and severities.index(s_val) > severities.index(entry["highest_sev"]):
                        entry["highest_sev"] = s_val

        for ip, cnt, min_dt, max_dt, acts, sevs in hp_rows:
            if not ip: continue
            entry = get_entry(ip)
            entry["hp_count"] += cnt
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

        for ip, cnt, min_dt, max_dt, acts in waf_rows:
            if not ip: continue
            entry = get_entry(ip)
            entry["w_count"] += cnt
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
                    if a: entry["types_set"].add(f"WAF {a.strip()}")
            if severities.index("HIGH") > severities.index(entry["highest_sev"]):
                entry["highest_sev"] = "HIGH"

        for ip, cnt, min_dt, max_dt, statuses in sb_rows:
            if not ip: continue
            entry = get_entry(ip)
            entry["s_count"] += cnt
            if min_dt:
                dt = datetime.fromisoformat(min_dt) if isinstance(min_dt, str) else min_dt
                if not entry["first_seen"] or dt < entry["first_seen"]:
                    entry["first_seen"] = dt
            if max_dt:
                dt = datetime.fromisoformat(max_dt) if isinstance(max_dt, str) else max_dt
                if not entry["last_seen"] or dt > entry["last_seen"]:
                    entry["last_seen"] = dt
            if statuses:
                for st in statuses.split(","):
                    st_val = st.strip()
                    if st_val:
                        entry["types_set"].add(f"Sandbox Upload ({st_val})")
                        if st_val == "MALICIOUS":
                            entry["has_malware"] = True
                            entry["highest_sev"] = "CRITICAL"
                        else:
                            if severities.index("HIGH") > severities.index(entry["highest_sev"]):
                                entry["highest_sev"] = "HIGH"

        results = []
        for ip, entry in ip_stats.items():
            if not ip:
                continue
            geo = geo_map.get(ip, ("Unknown", "Unknown"))
            country, city = geo
            is_local = is_local_ip(ip)
            if country == "Unknown" and is_local:
                country = "Local Network"
                city = "Local Infrastructure"

            first_seen_dt = entry["first_seen"]
            last_seen_dt = entry["last_seen"]

            a_count = entry["a_count"] + entry["hp_count"]
            w_count = entry["w_count"]
            s_count = entry["s_count"]
            total_events = a_count + w_count + s_count
            highest_sev = entry["highest_sev"]
            types_set = entry["types_set"]
            has_malware = entry["has_malware"]

            risk_score, risk_level = calculate_risk_assessment(
                highest_severity=highest_sev,
                total_events=total_events,
                attack_type_count=len(types_set),
                has_malicious_file=has_malware
            )

            is_blocked = ip in blocked_rules_map
            tags = []
            if is_blocked:
                tags.append("Blocked")
            if is_local:
                tags.append("Local LAN")
            if has_malware:
                tags.append("Malware Uploader")
            if w_count > 0:
                tags.append("WAF Intercepted")
            if any("sql" in t.lower() for t in types_set):
                tags.append("SQLi Probe")
            if any("brute" in t.lower() or "auth" in t.lower() for t in types_set):
                tags.append("Brute Force")

            results.append({
                "ip_address": ip,
                "attack_count": a_count,
                "waf_count": w_count,
                "sandbox_count": s_count,
                "total_events": total_events,
                "highest_severity": highest_sev,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "is_blocked": is_blocked,
                "waf_rule_id": blocked_rules_map.get(ip),
                "country": country,
                "city": city,
                "is_local": is_local,
                "attack_types": sorted(list(types_set)),
                "tags": tags,
                "first_seen": first_seen_dt.isoformat() if hasattr(first_seen_dt, 'isoformat') else (str(first_seen_dt) if first_seen_dt else None),
                "last_seen": last_seen_dt.isoformat() if hasattr(last_seen_dt, 'isoformat') else (str(last_seen_dt) if last_seen_dt else None)
            })

        # Sort results by risk_score desc then total_events desc
        return sorted(results, key=lambda x: (x["risk_score"], x["total_events"]), reverse=True)


    def get_attacker_profile(self, ip: str) -> Optional[Dict[str, Any]]:
        """Build detailed threat profile timeline, telemetry evidence, and MITRE mappings for an IP."""
        is_local = is_local_ip(ip)
        country = "Unknown"
        city = "Unknown"
        lat, lon = 0.0, 0.0
        asn = "Local Infrastructure / LAN" if is_local else "N/A"

        # 1. Fetch AttackEvents
        a_events = self.db.query(AttackEvent).filter(AttackEvent.source_ip == ip).all()
        for ae in a_events:
            if ae.country and ae.country != "Unknown":
                country = ae.country
                city = ae.city or "Unknown"
                if ae.raw_metadata:
                    try:
                        meta = json.loads(ae.raw_metadata)
                        lat = meta.get("latitude", 0.0)
                        lon = meta.get("longitude", 0.0)
                        if "asn" in meta:
                            asn = meta["asn"]
                    except:
                        pass
                break

        if country == "Unknown" and is_local:
            country = "Local Network"
            city = "Local Infrastructure"

        # 2. Fetch HoneypotActivityLogs, WAFHits, DecoySandboxFiles
        h_logs = self.db.query(HoneypotActivityLog).filter(HoneypotActivityLog.source_ip == ip).all()
        waf_hits = self.db.query(WAFHit).filter(WAFHit.ip_address == ip).all()
        sandbox_files = self.db.query(DecoySandboxFile).filter(DecoySandboxFile.ip_address == ip).all()

        if not a_events and not h_logs and not waf_hits and not sandbox_files:
            return None

        # 3. MITRE Techniques matched & evidence extraction
        matched_techniques = {}
        attack_types_set = set()
        targeted_paths_set = set()
        payload_samples = []
        user_agents_set = set()
        all_timestamps = []
        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        highest_sev = "LOW"
        has_malware = False

        for ae in a_events:
            if ae.created_at:
                all_timestamps.append(ae.created_at)
            if ae.attack_type:
                attack_types_set.add(ae.attack_type)
            if ae.user_agent:
                user_agents_set.add(ae.user_agent)
            if ae.payload and ae.payload not in payload_samples and len(payload_samples) < 10:
                payload_samples.append(ae.payload)
            if ae.target_service:
                targeted_paths_set.add(f"Port {ae.destination_port} ({ae.target_service})")

            sev_val = ae.severity.upper() if ae.severity else "LOW"
            if sev_val in severities and severities.index(sev_val) > severities.index(highest_sev):
                highest_sev = sev_val

            # MITRE deduction
            tech_id = None
            at_lower = ae.attack_type.lower()
            if "sql" in at_lower or "xss" in at_lower or "injection" in at_lower:
                tech_id = "T1190"
            elif "traversal" in at_lower:
                tech_id = "T1083"
            elif "brute" in at_lower or "credentials" in at_lower:
                tech_id = "T1110"
            elif "upload" in at_lower or "malware" in at_lower:
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
            if hl.timestamp:
                all_timestamps.append(hl.timestamp)
            if hl.action_type:
                attack_types_set.add(hl.action_type.replace("_", " ").title())
            if hl.request_path:
                targeted_paths_set.add(hl.request_path)
            if hl.user_agent:
                user_agents_set.add(hl.user_agent)

            sev_val = hl.severity.upper() if hl.severity else "LOW"
            if sev_val in severities and severities.index(sev_val) > severities.index(highest_sev):
                highest_sev = sev_val

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

        for wh in waf_hits:
            if wh.created_at:
                all_timestamps.append(wh.created_at)
            attack_types_set.add(f"WAF Intercept ({wh.action})")
            if wh.path:
                targeted_paths_set.add(f"{wh.method} {wh.path}")
            if wh.payload and wh.payload not in payload_samples and len(payload_samples) < 10:
                payload_samples.append(wh.payload)
            if wh.user_agent:
                user_agents_set.add(wh.user_agent)
            if severities.index("HIGH") > severities.index(highest_sev):
                highest_sev = "HIGH"

        for sf in sandbox_files:
            if sf.created_at:
                all_timestamps.append(sf.created_at)
            attack_types_set.add(f"Sandbox Upload ({sf.status})")
            targeted_paths_set.add(f"Upload: {sf.filename}")
            if sf.status == "MALICIOUS":
                has_malware = True
                highest_sev = "CRITICAL"
            elif severities.index("HIGH") > severities.index(highest_sev):
                highest_sev = "HIGH"

        # 4. Dynamic Chronological Timeline
        timeline = []
        for ae in a_events:
            timeline.append({
                "time": ae.created_at.isoformat(),
                "type": "ATTACK",
                "severity": ae.severity,
                "description": f"Honeypot Sensor matched pattern: {ae.attack_type} - {ae.payload or 'Payload inspected'}",
                "path": f"Port {ae.destination_port} / {ae.target_service or 'HTTP'}",
                "payload": ae.payload
            })

        for hl in h_logs:
            time_str = hl.timestamp.isoformat() if hl.timestamp else datetime.utcnow().isoformat()
            user_str = f" (User: {hl.username_or_email})" if hl.username_or_email else ""
            timeline.append({
                "time": time_str,
                "type": "HONEYPOT_ACTIVITY",
                "severity": hl.severity or "MEDIUM",
                "description": f"Aetheris Telemetry: {hl.action_type} - {hl.result} on path {hl.request_path}{user_str}",
                "path": hl.request_path,
                "payload": None
            })

        for wh in waf_hits:
            timeline.append({
                "time": wh.created_at.isoformat(),
                "type": "WAF_BLOCK",
                "severity": "HIGH",
                "description": f"WAF Intercepted request: {wh.method} {wh.path} - Intercept override action: {wh.action}",
                "path": f"{wh.method} {wh.path}",
                "payload": wh.payload
            })

        for sf in sandbox_files:
            timeline.append({
                "time": sf.created_at.isoformat(),
                "type": "SANDBOX_UPLOAD",
                "severity": "CRITICAL" if sf.status == "MALICIOUS" else "HIGH",
                "description": f"Sandbox Payload Upload: {sf.filename} (SHA256: {sf.sha256[:12]}...) - Status: {sf.status}",
                "path": f"Decoy Sandbox / {sf.filename}",
                "payload": f"MD5: {sf.md5} | SHA256: {sf.sha256}"
            })

        timeline = sorted(timeline, key=lambda x: x["time"], reverse=True)

        # 5. WAF Containment state
        waf_rule = self.db.query(WAFRule).filter(
            WAFRule.ip_address == ip,
            WAFRule.is_enabled == 1,
            WAFRule.action == "BLOCK"
        ).first()
        is_blocked = waf_rule is not None
        waf_rule_id = waf_rule.id if waf_rule else None

        # 6. Playbook Executions
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

        total_events = len(a_events) + len(h_logs) + len(waf_hits) + len(sandbox_files)
        first_seen_dt = min(all_timestamps) if all_timestamps else None
        last_seen_dt = max(all_timestamps) if all_timestamps else None

        risk_score, risk_level = calculate_risk_assessment(
            highest_severity=highest_sev,
            total_events=total_events,
            attack_type_count=len(attack_types_set),
            has_malicious_file=has_malware
        )

        tags = []
        if is_blocked:
            tags.append("Blocked")
        if is_local:
            tags.append("Local LAN")
        if has_malware:
            tags.append("Malware Uploader")
        if len(waf_hits) > 0:
            tags.append("WAF Intercepted")
        if any("sql" in t.lower() for t in attack_types_set):
            tags.append("SQLi Probe")
        if any("brute" in t.lower() or "auth" in t.lower() for t in attack_types_set):
            tags.append("Brute Force")

        return {
            "ip_address": ip,
            "is_local": is_local,
            "country": country,
            "city": city,
            "latitude": lat,
            "longitude": lon,
            "asn": asn,
            "total_events": total_events,
            "attack_count": len(a_events) + len(h_logs),
            "waf_count": len(waf_hits),
            "sandbox_count": len(sandbox_files),
            "first_seen": first_seen_dt.isoformat() if first_seen_dt else None,
            "last_seen": last_seen_dt.isoformat() if last_seen_dt else None,
            "highest_severity": highest_sev,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "is_blocked": is_blocked,
            "waf_rule_id": waf_rule_id,
            "attack_types": sorted(list(attack_types_set)),
            "targeted_paths": sorted(list(targeted_paths_set))[:20],
            "payload_samples": payload_samples,
            "user_agents": sorted(list(user_agents_set))[:5],
            "tags": tags,
            "mitre_techniques": list(matched_techniques.values()),
            "timeline": timeline,
            "playbook_executions": executions
        }
