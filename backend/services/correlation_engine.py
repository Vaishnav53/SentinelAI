import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.models import NormalizedLog, CorrelatedIncident, AuditLog

logger = logging.getLogger(__name__)

class CorrelationEngine:
    def __init__(self, db: Session):
        self.db = db

    def process_log(self, log: NormalizedLog):
        """Analyze a new normalized log and match threat correlation rules."""
        now = datetime.utcnow()
        lookback_window = now - timedelta(minutes=10)

        # Rule 1: Brute-Force to Login Success
        # Windows event 4625 = Login Failed, 4624 = Login Success
        if (log.event_id == "4624" or "successful login" in log.message.lower() or "bypass" in log.message.lower()) and log.source_ip:
            failures = self.db.query(NormalizedLog).filter(
                NormalizedLog.source_ip == log.source_ip,
                NormalizedLog.created_at >= lookback_window,
                (NormalizedLog.event_id == "4625") | (NormalizedLog.message.like("%failed%")) | (NormalizedLog.message.like("%unauthorized%"))
            ).count()

            if failures >= 2:
                title = f"Multi-Stage Attack Chain: Brute-Force to Login Success ({log.source_ip})"
                description = f"Detected multiple login failures ({failures} attempts) followed by a successful authentication from client IP {log.source_ip}."
                
                nodes = [
                    {"id": log.source_ip, "label": f"Attacker IP: {log.source_ip}", "type": "IP"},
                    {"id": log.user_name or "Unknown User", "label": f"User: {log.user_name or 'Unknown'}", "type": "USER"},
                    {"id": log.hostname or "Decoy Target", "label": f"Host: {log.hostname or 'Decoy Server'}", "type": "HOST"},
                    {"id": "auth_service", "label": "Authentication Service", "type": "SERVICE"}
                ]
                links = [
                    {"source": log.source_ip, "target": log.user_name or "Unknown User", "relation": "BRUTE_FORCED"},
                    {"source": log.user_name or "Unknown User", "target": "auth_service", "relation": "AUTHENTICATED_ON"},
                    {"source": "auth_service", "target": log.hostname or "Decoy Target", "relation": "HOSTED_BY"}
                ]
                timeline = [
                    {"time": (now - timedelta(seconds=10)).isoformat(), "title": "Brute-Force Activity", "details": f"Logged {failures} failed login probes from source IP {log.source_ip}."},
                    {"time": now.isoformat(), "title": "Auth Success Bypass", "details": f"Successful authentication session opened for user '{log.user_name}'."}
                ]
                self._add_or_update_incident(title, description, "CRITICAL", 0.95, nodes, links, timeline, log.source_ip)
                return

        # Rule 2: Privilege Escalation
        # Windows event 4728/4732 = Added to security group, or sudo commands
        if ("sudo" in log.message.lower() or "privilege" in log.message.lower() or log.event_id in ("4728", "4732")) and log.user_name:
            # Check if user had a recent successful logon in last 10 mins
            logon_success = self.db.query(NormalizedLog).filter(
                NormalizedLog.user_name == log.user_name,
                NormalizedLog.created_at >= lookback_window,
                (NormalizedLog.event_id == "4624") | (NormalizedLog.message.like("%successful login%"))
            ).first()

            if logon_success:
                title = f"Privilege Escalation Warning: Session Escalated ({log.user_name})"
                description = f"User '{log.user_name}' successfully authenticated and immediately executed administrative privilege actions (Group change/Sudo commands)."
                
                nodes = [
                    {"id": log.source_ip or "Local", "label": f"Operator IP: {log.source_ip or 'Local'}", "type": "IP"},
                    {"id": log.user_name, "label": f"Escalated User: {log.user_name}", "type": "USER"},
                    {"id": log.hostname or "Localhost", "label": f"Host Target: {log.hostname or 'Localhost'}", "type": "HOST"},
                    {"id": "privilege_upgrade", "label": "Admin Privilege Action", "type": "ATTACK"}
                ]
                links = [
                    {"source": log.user_name, "target": "privilege_upgrade", "relation": "EXECUTED"},
                    {"source": "privilege_upgrade", "target": log.hostname or "Localhost", "relation": "AFFECTED"}
                ]
                timeline = [
                    {"time": logon_success.created_at.isoformat(), "title": "Logon Session Established", "details": f"User '{log.user_name}' logged in successfully."},
                    {"time": now.isoformat(), "title": "Privilege Escalation", "details": f"System commands executed with elevated rights: '{log.message}'."}
                ]
                self._add_or_update_incident(title, description, "HIGH", 0.90, nodes, links, timeline, log.source_ip)
                return

        # Rule 3: Lateral Movement (Multiple service targeting)
        if log.source_ip:
            # Count different hosts/services targeted by this IP
            distinct_targets = self.db.query(NormalizedLog.hostname).filter(
                NormalizedLog.source_ip == log.source_ip,
                NormalizedLog.created_at >= lookback_window
            ).distinct().all()

            if len(distinct_targets) >= 2:
                targets_list = [t[0] for t in distinct_targets if t[0]]
                title = f"Host Scan Alert: Lateral Movement Signature ({log.source_ip})"
                description = f"Source IP {log.source_ip} was observed probing multiple system hosts ({', '.join(targets_list)}) within a 10-minute window."
                
                nodes = [
                    {"id": log.source_ip, "label": f"Scanning IP: {log.source_ip}", "type": "IP"}
                ]
                links = []
                for t in targets_list:
                    nodes.append({"id": t, "label": f"Target: {t}", "type": "HOST"})
                    links.append({"source": log.source_ip, "target": t, "relation": "PROBED"})

                timeline = [
                    {"time": now.isoformat(), "title": "Multi-Target Probing", "details": f"IP address initiated lateral network connections to endpoints: {', '.join(targets_list)}."}
                ]
                self._add_or_update_incident(title, description, "HIGH", 0.85, nodes, links, timeline, log.source_ip)
                return

        # Rule 4: Exploitation to Containment
        if ("waf block" in log.message.lower() or "waf intercept" in log.message.lower()) and log.source_ip:
            # Check if they had a recent exploit attack log
            exploit_attempt = self.db.query(NormalizedLog).filter(
                NormalizedLog.source_ip == log.source_ip,
                NormalizedLog.created_at >= lookback_window,
                NormalizedLog.severity.in_(["HIGH", "CRITICAL"])
            ).first()

            if exploit_attempt:
                title = f"Threat Contained: Active Exploit Blocked ({log.source_ip})"
                description = f"WAF active defense engine intercepted and blocked intrusion attempts (SQLi/XSS/Traversals) from source IP {log.source_ip}."
                
                nodes = [
                    {"id": log.source_ip, "label": f"Blocked Attacker: {log.source_ip}", "type": "IP"},
                    {"id": "waf_blocker", "label": "SentinelAI WAF", "type": "SERVICE"},
                    {"id": log.hostname or "Decoy Port", "label": "Decoy Intranet", "type": "HOST"}
                ]
                links = [
                    {"source": log.source_ip, "target": "waf_blocker", "relation": "INTERCEPTED_BY"},
                    {"source": "waf_blocker", "target": log.hostname or "Decoy Port", "relation": "PROTECTED"}
                ]
                timeline = [
                    {"time": exploit_attempt.created_at.isoformat(), "title": "Exploit Attempt Ingested", "details": f"Intrusion signature identified: '{exploit_attempt.message}'."},
                    {"time": now.isoformat(), "title": "WAF Block Rule Active", "details": "Operator IP blocked dynamically. WAF returned 403 Access Denied page."}
                ]
                self._add_or_update_incident(title, description, "CRITICAL", 0.98, nodes, links, timeline, log.source_ip)
                return

    def _add_or_update_incident(
        self, 
        title: str, 
        description: str, 
        severity: str, 
        confidence: float, 
        nodes: List[dict], 
        links: List[dict], 
        timeline: List[dict],
        source_ip: Optional[str]
    ):
        """Write to database and broadcast WebSocket notification payload."""
        now = datetime.utcnow()
        lookback = now - timedelta(minutes=15)
        
        # Check if an active incident for this IP/title already exists in last 15 minutes
        existing = self.db.query(CorrelatedIncident).filter(
            CorrelatedIncident.status != "CLOSED",
            CorrelatedIncident.created_at >= lookback,
            CorrelatedIncident.title.like(f"%{source_ip}%")
        ).first()

        if existing:
            # Merge nodes
            current_nodes = json.loads(existing.nodes_data or "[]")
            for node in nodes:
                if not any(n["id"] == node["id"] for n in current_nodes):
                    current_nodes.append(node)
            existing.nodes_data = json.dumps(current_nodes)

            # Merge links
            current_links = json.loads(existing.links_data or "[]")
            for link in links:
                if not any(l["source"] == link["source"] and l["target"] == link["target"] for l in current_links):
                    current_links.append(link)
            existing.links_data = json.dumps(current_links)

            # Merge timeline
            current_timeline = json.loads(existing.timeline_data or "[]")
            current_timeline.extend(timeline)
            existing.timeline_data = json.dumps(current_timeline)

            # Upgrade severity if CRITICAL
            if severity == "CRITICAL":
                existing.severity = "CRITICAL"
            existing.confidence = max(existing.confidence, confidence)
            
            self.db.commit()
            self.db.refresh(existing)
            incident = existing
        else:
            # Create a new incident
            incident = CorrelatedIncident(
                title=title,
                description=description,
                severity=severity,
                confidence=confidence,
                status="NEW",
                assigned_analyst=None,
                nodes_data=json.dumps(nodes),
                links_data=json.dumps(links),
                timeline_data=json.dumps(timeline)
            )
            self.db.add(incident)
            self.db.commit()
            self.db.refresh(incident)

        # Log audit log
        audit = AuditLog(
            action="CORRELATE_INCIDENT",
            module="correlation",
            user="system",
            details=f"Correlated incident ID {incident.id}: '{incident.title}'"
        )
        self.db.add(audit)
        self.db.commit()

        # WebSocket Broadcast
        try:
            from backend.api.attacks import manager
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(manager.broadcast({
                    "type": "new_correlated_incident",
                    "data": {
                        "id": incident.id,
                        "title": incident.title,
                        "description": incident.description,
                        "severity": incident.severity,
                        "confidence": incident.confidence,
                        "status": incident.status,
                        "created_at": incident.created_at.isoformat()
                    }
                }))
        except Exception as e:
            logger.warning(f"Failed to broadcast correlated incident socket event: {e}")
