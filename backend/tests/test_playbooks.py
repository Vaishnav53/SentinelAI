import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import SessionLocal
from backend.models.models import ThreatPlaybook, PlaybookExecution, WAFRule, AttackEvent, CorrelatedIncident

def test_playbook_workflows_crud_and_execution():
    with TestClient(app) as client:
        db = SessionLocal()
        
        # 1. Clean previous rules and playbooks
        db.query(ThreatPlaybook).delete()
        db.query(PlaybookExecution).delete()
        db.query(WAFRule).filter(WAFRule.ip_address == "10.99.99.99").delete()
        db.query(CorrelatedIncident).filter(CorrelatedIncident.title.like("%10.99.99.99%")).delete()
        db.commit()

        # 2. Get playbooks (triggers defaults seed)
        res = client.get("/api/playbooks")
        assert res.status_code == 200
        playbooks = res.json()
        assert len(playbooks) >= 2
        assert playbooks[0]["name"] == "Rapid Containment Block"

        # Find target playbook
        target_pb = playbooks[0]

        # 3. Trigger manual run targeting test IP 10.99.99.99
        res = client.post(f"/api/playbooks/execute/{target_pb['id']}", json={
            "target_ip": "10.99.99.99"
        })
        assert res.status_code == 200
        exec_record = res.json()
        assert exec_record["status"] == "SUCCESS"
        assert exec_record["target_ip"] == "10.99.99.99"
        print("EXEC LOGS DATA:", exec_record["logs_data"])

        # Verify WAF rule block was created
        db.commit()
        waf_rule = db.query(WAFRule).filter(WAFRule.ip_address == "10.99.99.99").first()
        assert waf_rule is not None
        assert waf_rule.action == "BLOCK"

        # Verify correlated incident case was opened
        incident = db.query(CorrelatedIncident).filter(
            CorrelatedIncident.title.like("%10.99.99.99%")
        ).first()
        assert incident is not None
        assert incident.assigned_analyst == "Lead Analyst Alex"

        # 4. Create custom playbook
        custom_pb_payload = {
            "name": "Custom Isolation",
            "description": "Custom sequence steps description.",
            "trigger_type": "MANUAL",
            "actions": [
                {"action": "QUARANTINE_IP"},
                {"action": "NOTIFY_TEAM"}
            ]
        }
        res = client.post("/api/playbooks", json=custom_pb_payload)
        assert res.status_code == 200
        custom_pb = res.json()
        assert custom_pb["name"] == "Custom Isolation"

        # 5. Clean up
        db.query(ThreatPlaybook).delete()
        db.query(PlaybookExecution).delete()
        db.query(WAFRule).filter(WAFRule.ip_address == "10.99.99.99").delete()
        db.query(CorrelatedIncident).filter(CorrelatedIncident.title.like("%10.99.99.99%")).delete()
        db.commit()
        db.close()

def test_attacker_profiling_aggregation():
    with TestClient(app) as client:
        db = SessionLocal()
        
        # Ingest mock AttackEvent
        from datetime import datetime
        import json
        ae = AttackEvent(
            external_id="HON-PROFILER-TEST",
            attack_type="SQL Injection Scan",
            severity="HIGH",
            status="NEW",
            source_ip="88.88.88.88",
            destination_port=8088,
            sensor_id="HONEYPOT-DECOY",
            payload="SELECT * FROM users",
            country="France",
            city="Paris",
            raw_metadata=json.dumps({"latitude": 48.8566, "longitude": 2.3522})
        )
        db.add(ae)
        db.commit()

        # Retrieve profiles
        res = client.get("/api/attacker/profiles")
        assert res.status_code == 200
        profiles = res.json()
        assert len(profiles) >= 1
        
        target_profile = next((p for p in profiles if p["ip_address"] == "88.88.88.88"), None)
        assert target_profile is not None
        assert target_profile["country"] == "France"
        assert target_profile["city"] == "Paris"

        # Get details profile
        res = client.get("/api/attacker/profiles/88.88.88.88")
        assert res.status_code == 200
        detail = res.json()
        assert detail["attack_count"] >= 1
        assert len(detail["mitre_techniques"]) >= 1
        assert detail["mitre_techniques"][0]["id"] == "T1190"
        assert len(detail["timeline"]) >= 1

        # Clean up
        db.query(AttackEvent).filter(AttackEvent.source_ip == "88.88.88.88").delete()
        db.commit()
        db.close()
