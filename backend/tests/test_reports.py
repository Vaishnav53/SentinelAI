import pytest
import json
import os
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import SessionLocal
from backend.models.models import AttackEvent, CorrelatedIncident, DecoySandboxFile, ReportJob, Report
from datetime import datetime

def test_reports_workflow():
    with TestClient(app) as client:
        db = SessionLocal()
        try:
            # Seed mock data
            event = AttackEvent(
                external_id="ATT-REP-01",
                attack_type="SQL Injection",
                severity="CRITICAL",
                status="NEW",
                source_ip="192.168.99.99",
                source_port=12345,
                destination_port=8088,
                protocol="HTTP",
                target_service="HTTP Honeypot",
                sensor_id="HTTP Honeypot",
                threat_score=9.5,
                confidence=0.98,
                created_at=datetime.utcnow()
            )
            db.add(event)
            
            incident = CorrelatedIncident(
                title="Incident test chain",
                description="Simulating lateral brute force chain",
                severity="HIGH",
                confidence=0.85,
                status="NEW",
                nodes_data='[]',
                links_data='[]',
                timeline_data='[]',
                created_at=datetime.utcnow()
            )
            db.add(incident)
            
            sfile = DecoySandboxFile(
                filename="malware.exe",
                size_bytes=2048,
                sha256="abc123sha256",
                md5="md5abc123",
                sha1="sha1abc123",
                status="MALICIOUS",
                threat_score=1.0,
                malware_description="Backdoor Trojan",
                vt_reputation="55/72 matches",
                sandbox_path="/tmp/malware.exe",
                ip_address="192.168.99.99",
                created_at=datetime.utcnow()
            )
            db.add(sfile)
            db.commit()

            # 1. Test GET options for each report type
            resp = client.get("/api/reports/options?type=Threat Incident")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert any(opt["value"] == str(incident.id) for opt in data)

            resp = client.get("/api/reports/options?type=Honeypot Request")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert any(opt["value"] == str(event.id) for opt in data)

            resp = client.get("/api/reports/options?type=Sandbox Upload")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert any(opt["value"] == str(sfile.id) for opt in data)

            resp = client.get("/api/reports/options?type=Attacker Dossier")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert any(opt["value"] == "192.168.99.99" for opt in data)

            # 2. Test generate AI Summary (triggers offline fallback template gracefully)
            payload = {
                "type": "Sandbox Upload",
                "target_id": str(sfile.id)
            }
            resp = client.post("/api/reports/generate-ai-summary", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert "markdown" in data
            assert "report_id" in data
            job_id = data["id"]

            # 3. Test list report jobs
            resp = client.get("/api/reports/jobs")
            assert resp.status_code == 200
            assert len(resp.json()) >= 1

            # 4. Test download report markdown
            resp = client.get(f"/api/reports/download/{job_id}")
            assert resp.status_code == 200
            assert b"EXECUTIVE compliance security audit report" in resp.content

            # 5. Test export CSV
            resp = client.get(f"/api/reports/export-csv?type=Sandbox Upload&id={sfile.id}")
            assert resp.status_code == 200
            assert b"malware.exe" in resp.content
            assert resp.headers["content-type"] == "text/csv; charset=utf-8"

            # 6. Test delete report job
            resp = client.delete(f"/api/reports/jobs/{job_id}")
            assert resp.status_code == 204
        finally:
            # Clean up seeded objects
            db.delete(event)
            db.delete(incident)
            db.delete(sfile)
            db.commit()
            db.close()
