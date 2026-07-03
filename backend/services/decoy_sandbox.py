import logging
import hashlib
import os
import re
import json
from datetime import datetime
from typing import Dict, Any, Tuple
import httpx
from sqlalchemy.orm import Session
from backend.models.models import DecoySandboxFile, AttackEvent, AuditLog
from backend.core.config import settings

logger = logging.getLogger(__name__)

class DecoySandboxService:
    def __init__(self, db: Session):
        self.db = db
        # Sandbox storage dir in project workspace
        self.sandbox_dir = "d:/Documents/SentinelAI/decoy_sandbox"
        if not os.path.exists(self.sandbox_dir):
            os.makedirs(self.sandbox_dir)

    async def save_and_scan_file(self, filename: str, content: bytes, ip_address: str) -> DecoySandboxFile:
        """Calculate hashes, scan threat profiles, run VirusTotal lookup, and write to sandbox."""
        # 1. Compute Hashing
        md5_hash = hashlib.md5(content).hexdigest()
        sha1_hash = hashlib.sha1(content).hexdigest()
        sha256_hash = hashlib.sha256(content).hexdigest()
        size_bytes = len(content)

        # 2. Signature Threat Analysis Heuristics
        status = "CLEAN"
        threat_score = 0.0
        malware_description = None
        
        ext_match = re.search(r'\.([a-zA-Z0-9]+)$', filename.lower())
        extension = ext_match.group(1) if ext_match else ""

        # Risk Heuristic 1: Double Extension check
        if re.search(r'\.[a-zA-Z0-9]+\.[a-zA-Z0-9]+$', filename.lower()):
            status = "SUSPICIOUS"
            threat_score = 0.70
            malware_description = "Double extension evasion signature detected."

        # Risk Heuristic 2: Executable script types
        executable_exts = ["exe", "elf", "sh", "py", "bat", "cmd", "com", "php", "jsp", "asp", "aspx", "pl", "js"]
        if extension in executable_exts:
            status = "MALICIOUS"
            threat_score = 0.95
            malware_description = f"Unauthorized executable upload type: .{extension}."

        # Risk Heuristic 3: Macro-enabled documents
        macro_exts = ["docm", "xlsm", "pptm"]
        if extension in macro_exts:
            status = "SUSPICIOUS"
            threat_score = 0.65
            malware_description = "Office document containing potentially malicious active macros."

        # Risk Heuristic 4: Archive zip bomb / Oversized payloads
        if size_bytes > 5 * 1024 * 1024:  # > 5MB
            status = "SUSPICIOUS"
            threat_score = 0.60
            malware_description = "Oversized attachment payload exceeds security policy limits."

        if extension in ["zip", "rar", "tar"] and (size_bytes > 2 * 1024 * 1024 or b"bomb" in content.lower()):
            status = "SUSPICIOUS"
            threat_score = 0.75
            malware_description = "Simulated high-expansion archive bomb payload warning."

        # 3. VirusTotal API Enrichment (Fallback to mock analysis)
        vt_reputation = "0/72 clean"
        
        # Get VT key from database settings if available
        from backend.services.settings import SettingsService
        settings_service = SettingsService()
        vt_key = settings_service.get_setting(self.db, "virustotal_api_key", "")

        if vt_key:
            try:
                # Query VirusTotal v3 files API
                headers = {"x-apikey": vt_key}
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.get(
                        f"https://www.virustotal.com/api/v3/files/{sha256_hash}",
                        headers=headers
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
                        malicious = stats.get("malicious", 0)
                        harmless = stats.get("harmless", 0)
                        total = malicious + harmless + stats.get("undetected", 0)
                        vt_reputation = f"{malicious}/{total} malicious"
                        
                        if malicious > 0:
                            status = "MALICIOUS"
                            threat_score = max(threat_score, 0.98)
                            malware_description = f"VirusTotal threat match detected: {malicious} engine hits."
                    elif resp.status_code == 404:
                        vt_reputation = "0/72 clean (Not seen by VT)"
            except Exception as e:
                logger.warning(f"VirusTotal API reputation check error: {e}")

        # If no real API query succeeded, generate simulated VT reputation mapping
        if vt_reputation == "0/72 clean" and status in ("SUSPICIOUS", "MALICIOUS"):
            hits = 48 if status == "MALICIOUS" else 15
            vt_reputation = f"{hits}/75 malicious (Simulated)"

        # 4. Save file inertly inside sandbox path
        sandbox_path = os.path.join(self.sandbox_dir, f"{sha256_hash}.dat")
        try:
            with open(sandbox_path, "wb") as f:
                f.write(content)
        except Exception as e:
            logger.error(f"Failed to write file to decoy sandbox directory: {e}")
            raise IOError("Sandbox write failure")

        # 5. Persist to DB
        sandbox_file = DecoySandboxFile(
            filename=filename,
            size_bytes=size_bytes,
            sha256=sha256_hash,
            md5=md5_hash,
            sha1=sha1_hash,
            status=status,
            threat_score=threat_score,
            malware_description=malware_description,
            vt_reputation=vt_reputation,
            sandbox_path=sandbox_path,
            ip_address=ip_address
        )
        self.db.add(sandbox_file)
        self.db.commit()
        self.db.refresh(sandbox_file)

        # 6. Log Threat telemetry if malicious
        if status in ("SUSPICIOUS", "MALICIOUS"):
            attack = AttackEvent(
                external_id=f"HON-{int(datetime.utcnow().timestamp())}",
                attack_type="Malicious File Upload",
                severity="CRITICAL" if status == "MALICIOUS" else "HIGH",
                threat_score=threat_score * 10.0,
                status="NEW",
                source_ip=ip_address,
                destination_port=8088,
                sensor_id="HONEYPOT-DECOY",
                payload=f"Uploaded file: {filename}",
                raw_metadata=json.dumps({
                    "filename": filename,
                    "sha256": sha256_hash,
                    "malware_description": malware_description,
                    "vt_reputation": vt_reputation,
                    "sandbox_file_id": sandbox_file.id
                })
            )
            self.db.add(attack)
            
            # Log Audit log
            audit = AuditLog(
                action="SANDBOX_ALERT",
                module="sandbox",
                user="system",
                details=f"Malicious file detected in sandbox: {filename} ({sha256_hash[:12]}...)"
            )
            self.db.add(audit)
            self.db.commit()

            # Trigger Active Containment rules check dynamically
            # If uploader IP exceeds threshold, lock them out!
            try:
                from backend.services.active_defense import ActiveDefenseEngine
                engine = ActiveDefenseEngine(self.db)
                engine.evaluate_request(ip_address, "/upload", "POST", {}, "")
            except Exception as e:
                logger.warning(f"Active defense containment evaluation failed in sandbox scan: {e}")

        # Broadcast update over sockets
        try:
            from backend.api.attacks import manager
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(manager.broadcast({
                    "type": "new_sandbox_file",
                    "data": {
                        "id": sandbox_file.id,
                        "filename": sandbox_file.filename,
                        "status": sandbox_file.status,
                        "threat_score": sandbox_file.threat_score,
                        "created_at": sandbox_file.created_at.isoformat()
                    }
                }))
        except Exception as e:
            logger.warning(f"Failed to broadcast sandbox socket event: {e}")

        return sandbox_file
