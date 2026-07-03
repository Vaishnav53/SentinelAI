import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models.models import NormalizedLog
from backend.services.correlation_engine import CorrelationEngine

logger = logging.getLogger(__name__)

class LogIngestionService:
    def __init__(self, db: Session):
        self.db = db

    def ingest_windows_log(self, data: Dict[str, Any]) -> NormalizedLog:
        """
        Ingest Windows Event Log and normalize.
        Fields: event_id, channel, computer, user_name, message, severity, raw_xml
        """
        event_id = str(data.get("event_id", ""))
        message = data.get("message", "")
        user_name = data.get("user_name", "")
        computer = data.get("computer", "Workstation-1")
        
        # Default severity mapping
        severity = data.get("severity", "LOW").upper()
        technique_id = None

        # Standard Windows security event normalization
        if event_id == "4625": # Logon Failure
            severity = "MEDIUM"
            technique_id = "T1110" # Brute Force
            if not message:
                message = f"An account failed to log on. Target User Name: {user_name}."
        elif event_id == "4624": # Logon Success
            severity = "LOW"
            if not message:
                message = f"An account was successfully logged on. User Name: {user_name}."
        elif event_id in ("4728", "4732"): # Member added to security group
            severity = "HIGH"
            technique_id = "T1078" # Valid Accounts / Privilege escalation
            if not message:
                message = f"A member was added to a security-enabled local group. User: {user_name}."

        # Parse source IP from raw message/XML text if present
        source_ip = data.get("source_ip")
        if not source_ip and message:
            import re
            ip_match = re.search(r'Source Network Address:\s*([0-9.]+)', message)
            if ip_match:
                source_ip = ip_match.group(1)
            else:
                ip_match = re.search(r'Address:\s*([0-9.]+)', message)
                if ip_match:
                    source_ip = ip_match.group(1)

        normalized = NormalizedLog(
            log_source="WINDOWS",
            event_id=event_id,
            source_ip=source_ip or "127.0.0.1",
            destination_ip="127.0.0.1",
            user_name=user_name,
            hostname=computer,
            message=message,
            severity=severity,
            technique_id=technique_id,
            raw_data=json.dumps(data)
        )
        self.db.add(normalized)
        self.db.commit()
        self.db.refresh(normalized)

        # Trigger correlation checks
        engine = CorrelationEngine(self.db)
        engine.process_log(normalized)
        return normalized

    def ingest_syslog(self, raw_syslog: str, client_ip: str) -> NormalizedLog:
        """
        Parse raw Syslog-style logs and normalize.
        Format: <timestamp> <hostname> <service>[<pid>]: <message>
        """
        # Set default values
        hostname = "syslog-gateway"
        message = raw_syslog
        severity = "LOW"
        technique_id = None
        user_name = "System"
        
        # Simple string heuristics to parse common linux syslog items
        msg_lower = raw_syslog.lower()
        
        if "failed password" in msg_lower or "authentication failure" in msg_lower:
            severity = "MEDIUM"
            technique_id = "T1110" # Brute Force
            import re
            user_match = re.search(r'for\s+([a-zA-Z0-9_-]+)', msg_lower)
            if user_match:
                user_name = user_match.group(1)
        elif "session opened" in msg_lower or "accepted publickey" in msg_lower or "accepted password" in msg_lower:
            severity = "LOW"
            import re
            user_match = re.search(r'for\s+([a-zA-Z0-9_-]+)', msg_lower)
            if user_match:
                user_name = user_match.group(1)
        elif "sudo:" in msg_lower:
            severity = "HIGH"
            technique_id = "T1548" # Sudo / Privilege escalation
            if "pam_unix(sudo:session)" in msg_lower:
                severity = "LOW"
        elif "waf block" in msg_lower or "waf intercept" in msg_lower:
            severity = "CRITICAL"
            technique_id = "T1190" # Exploit Public-Facing Application

        normalized = NormalizedLog(
            log_source="SYSLOG",
            event_id=None,
            source_ip=client_ip,
            destination_ip="127.0.0.1",
            user_name=user_name,
            hostname=hostname,
            message=message,
            severity=severity,
            technique_id=technique_id,
            raw_data=json.dumps({"raw_syslog": raw_syslog})
        )
        self.db.add(normalized)
        self.db.commit()
        self.db.refresh(normalized)

        # Trigger correlation checks
        engine = CorrelationEngine(self.db)
        engine.process_log(normalized)
        return normalized
