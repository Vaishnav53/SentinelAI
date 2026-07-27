import pytest
import socket
from backend.services.honeypot import HoneypotManager, HoneypotRequestHandler
from backend.models.models import AttackEvent

def test_honeypot_local_mode_defaults():
    manager = HoneypotManager()
    status = manager.get_full_status()
    assert status["lan_mode"] is False
    assert status["bind_host"] == "127.0.0.1"
    assert status["host"] == "127.0.0.1"
    assert status["port"] == 8088
    assert status["local_url"] == "http://127.0.0.1:8088"
    assert status["url"] == "http://127.0.0.1:8088"

def test_honeypot_lan_mode_bind_and_url():
    manager = HoneypotManager()
    manager.lan_mode = True
    manager.bind_host = "0.0.0.0"
    status = manager.get_full_status()
    assert status["lan_mode"] is True
    assert status["bind_host"] == "0.0.0.0"
    assert status["url"].startswith("http://")
    assert ":8088" in status["url"]
    assert "0.0.0.0" not in status["url"]
    assert status["lan_ip"] == manager.get_local_lan_ip()

def test_honeypot_mode_switch_lifecycle():
    manager = HoneypotManager()
    # Test set_mode to LAN
    res_lan = manager.set_mode(lan_mode=True)
    assert res_lan["lan_mode"] is True
    assert res_lan["bind_host"] == "0.0.0.0"
    assert "0.0.0.0" not in res_lan["url"]

    # Test set_mode back to Local
    res_local = manager.set_mode(lan_mode=False)
    assert res_local["lan_mode"] is False
    assert res_local["bind_host"] == "127.0.0.1"
    assert res_local["url"] == "http://127.0.0.1:8088"
    manager.stop()

def test_honeypot_status_response_structure():
    manager = HoneypotManager()
    status = manager.get_full_status()
    expected_keys = {
        "status", "ready", "lan_mode", "bind_host", "host",
        "port", "lan_ip", "local_url", "url", "error"
    }
    assert expected_keys.issubset(set(status.keys()))

def test_lan_ip_resolution_filters_virtual_adapters():
    manager = HoneypotManager()
    lan_ip = manager.get_local_lan_ip()
    assert not lan_ip.startswith("192.168.56.")
    assert not lan_ip.startswith("169.254.")
    assert isinstance(lan_ip, str)
    parts = lan_ip.split(".")
    assert len(parts) == 4

def test_remote_source_ip_preserved_in_log():
    from backend.database.session import SessionLocal
    manager = HoneypotManager()
    class DummyHandler:
        def __init__(self):
            self.client_address = ("10.45.169.150", 54321)
            self.headers = {"User-Agent": "RemoteLaptopClient/1.0"}
            self.lab_suspicious_payloads = []
        log_attack = HoneypotRequestHandler.log_attack

    handler = DummyHandler()
    handler.log_attack(
        attack_type="LAN Test Probe",
        severity="HIGH",
        confidence=0.9,
        mitre_id="T1190",
        recommendation="Verify source IP logging",
        payload="GET /test"
    )

    db = SessionLocal()
    try:
        event = db.query(AttackEvent).filter(AttackEvent.attack_type == "LAN Test Probe").first()
        assert event is not None
        assert event.source_ip == "10.45.169.150"
        assert event.destination_port == 8088
        db.query(AttackEvent).filter(AttackEvent.attack_type == "LAN Test Probe").delete()
        db.commit()
    finally:
        db.close()

def test_honeypot_api_router_endpoints(client):
    status_resp = client.get("/api/honeypot/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert "lan_mode" in data
    assert "url" in data

    mode_resp = client.post("/api/honeypot/mode", json={"lan_mode": True})
    assert mode_resp.status_code == 200
    mode_data = mode_resp.json()
    assert mode_data["lan_mode"] is True
    assert mode_data["bind_host"] == "0.0.0.0"

    stop_resp = client.post("/api/honeypot/stop")
    assert stop_resp.status_code == 200

def test_honeypot_event_detail_by_id_and_missing_event():
    from fastapi.testclient import TestClient
    from backend.main import app
    from backend.database.session import SessionLocal
    from datetime import datetime

    with TestClient(app) as client:
        db = SessionLocal()
        try:
            test_event = AttackEvent(
                external_id="HON-TEST-100",
                attack_type="SQL Injection",
                severity="CRITICAL",
                status="NEW",
                source_ip="192.168.1.50",
                source_port=54321,
                destination_port=8088,
                protocol="HTTP",
                target_service="HTTP Honeypot",
                payload="username=admin' OR '1'='1",
                user_agent="PytestClient/1.0",
                sensor_id="HTTP Honeypot",
                created_at=datetime.utcnow()
            )
            db.add(test_event)
            db.commit()
            event_id = test_event.id

            # Fetch detail by ID
            resp = client.get(f"/api/attacks/{event_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == event_id
            assert data["external_id"] == "HON-TEST-100"
            assert data["attack_type"] == "SQL Injection"
            assert data["destination_port"] == 8088

            # Test AI analysis endpoint for this event
            analyze_resp = client.post(f"/api/agent/analyze/{event_id}")
            assert analyze_resp.status_code == 200
            analysis_data = analyze_resp.json()
            assert "executive_summary" in analysis_data
            assert "technical_explanation" in analysis_data

            # Fetch non-existent ID
            resp_404 = client.get("/api/attacks/999999")
            assert resp_404.status_code == 404

            # Cleanup
            db.query(AttackEvent).filter(AttackEvent.id == event_id).delete()
            db.commit()
        finally:
            db.close()

