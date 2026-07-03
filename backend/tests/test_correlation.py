import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import SessionLocal
from backend.models.models import NormalizedLog, CorrelatedIncident

def test_logs_ingestion_and_brute_force_correlation():
    with TestClient(app) as client:
        # 1. Ingest first failed logon
        res = client.post("/api/logs/ingest/windows", json={
            "event_id": 4625,
            "user_name": "target_user",
            "computer": "DC-01",
            "message": "Logon failed target_user from Address: 10.20.30.40",
            "source_ip": "10.20.30.40",
            "severity": "MEDIUM"
        })
        assert res.status_code == 200
        assert res.json()["status"] == "SUCCESS"

        # 2. Ingest second failed logon
        res = client.post("/api/logs/ingest/windows", json={
            "event_id": 4625,
            "user_name": "target_user",
            "computer": "DC-01",
            "message": "Logon failed target_user from Address: 10.20.30.40",
            "source_ip": "10.20.30.40",
            "severity": "MEDIUM"
        })
        assert res.status_code == 200

        # 3. Ingest successful logon -> should trigger Correlation Engine
        res = client.post("/api/logs/ingest/windows", json={
            "event_id": 4624,
            "user_name": "target_user",
            "computer": "DC-01",
            "message": "Logon successful target_user from Address: 10.20.30.40",
            "source_ip": "10.20.30.40",
            "severity": "LOW"
        })
        assert res.status_code == 200

        # 4. Check if correlated incident has been created in DB
        res = client.get("/api/correlation/incidents")
        assert res.status_code == 200
        incidents = res.json()
        
        # Verify brute-force success chain matching
        matched = [i for i in incidents if "Brute-Force" in i["title"] and "10.20.30.40" in i["title"]]
        assert len(matched) >= 1, "Expected brute-force success incident chain to be correlated"
        incident = matched[0]
        incident_id = incident["id"]

        # 5. Fetch incident details
        res = client.get(f"/api/correlation/incidents/{incident_id}")
        assert res.status_code == 200
        details = res.json()
        assert details["severity"] == "CRITICAL"
        assert "target_user" in details["nodes_data"]

        # 6. Change incident status to INVESTIGATING
        res = client.post(f"/api/correlation/incidents/{incident_id}/action", json={
            "action": "update_status",
            "status": "INVESTIGATING"
        })
        assert res.status_code == 200
        assert res.json()["status"] == "INVESTIGATING"

        # Cleanup DB logs and incidents
        db = SessionLocal()
        db.query(NormalizedLog).filter(NormalizedLog.source_ip == "10.20.30.40").delete()
        db.query(CorrelatedIncident).filter(CorrelatedIncident.id == incident_id).delete()
        db.commit()
        db.close()
