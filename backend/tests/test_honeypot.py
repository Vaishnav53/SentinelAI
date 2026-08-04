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

def test_sqli_authentication_bypass_conditions():
    import urllib.request
    import urllib.parse
    import urllib.error
    from backend.database.session import SessionLocal

    manager = HoneypotManager()
    status = manager.start()
    assert status in ["ONLINE", "STARTING"]

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)

    def send_login(user, pwd):
        data = urllib.parse.urlencode({"username": user, "password": pwd}).encode("utf-8")
        req = urllib.request.Request("http://127.0.0.1:8088/login", data=data, method="POST")
        try:
            res = opener.open(req)
            return res.status, res.headers, res.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read().decode("utf-8", errors="ignore")

    try:
        # 1. SQLi in both fields -> Bypass succeeds (302 redirect to /dashboard)
        status_code, headers, body = send_login("' OR 1=1 --", "' OR 1=1 --")
        assert status_code == 302
        assert headers.get("Location") == "/dashboard"
        assert "session_id=" in headers.get("Set-Cookie", "")

        # 2. SQLi only in username -> Login fails (200 with error page), but attack logged
        status_code, headers, body = send_login("' OR 1=1 --", "wrongpassword")
        assert status_code == 200
        assert "Invalid credentials." in body

        # 3. SQLi only in password -> Login fails (200 with error page), but attack logged
        status_code, headers, body = send_login("wronguser", "' OR 1=1 --")
        assert status_code == 200
        assert "Invalid credentials." in body

        # 4. Invalid ordinary credentials -> Login fails
        status_code, headers, body = send_login("wronguser", "wrongpassword")
        assert status_code == 200
        assert "Invalid credentials." in body

        # 5. Valid credentials -> Login succeeds (302 redirect to /dashboard)
        status_code, headers, body = send_login("admin", "admin@123")
        assert status_code == 302
        assert headers.get("Location") == "/dashboard"

        # Verify SQL Injection events were recorded in DB
        db = SessionLocal()
        try:
            sqli_events = db.query(AttackEvent).filter(AttackEvent.attack_type == "SQL Injection").all()
            assert len(sqli_events) >= 3
        finally:
            db.close()
    finally:
        manager.stop()


def test_aetheris_decoy_features_and_persistence():
    import urllib.request
    import urllib.parse
    import urllib.error
    import json
    from backend.database.session import SessionLocal
    from backend.models.models import HoneypotPortalUser, HoneypotFeedback, HoneypotActivityLog, AttackEvent

    manager = HoneypotManager()
    status = manager.start()
    assert status in ["ONLINE", "STARTING"]

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)

    # Clean up test user if present from previous test runs
    db = SessionLocal()
    try:
        db.query(HoneypotPortalUser).filter(HoneypotPortalUser.username == "decoy_test_user").delete()
        db.query(HoneypotFeedback).filter(HoneypotFeedback.username == "decoy_test_user").delete()
        db.commit()
    finally:
        db.close()

    def send_req(url, data=None, headers=None, method="GET"):
        if headers is None:
            headers = {}
        data_bytes = data if isinstance(data, bytes) else (urllib.parse.urlencode(data).encode("utf-8") if data else None)
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
        try:
            res = opener.open(req)
            return res.status, res.headers, res.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read().decode("utf-8", errors="ignore")

    try:
        # 1. Valid registration succeeds
        status, headers, body = send_req("http://127.0.0.1:8088/register", {"username": "decoy_test_user", "email": "decoy_test@aetheris.local", "password": "SecretDecoyPassword123"}, method="POST")
        assert status == 200
        assert "Registration successful" in body

        # 2. Verify password is NOT stored in plaintext
        db = SessionLocal()
        try:
            u_db = db.query(HoneypotPortalUser).filter(HoneypotPortalUser.username == "decoy_test_user").first()
            assert u_db is not None
            assert u_db.password_hash != "SecretDecoyPassword123"
            assert len(u_db.password_hash) == 64
        finally:
            db.close()

        # 3. Duplicate registration fails safely
        status, headers, body = send_req("http://127.0.0.1:8088/register", {"username": "decoy_test_user", "email": "decoy_test@aetheris.local", "password": "SecretDecoyPassword123"}, method="POST")
        assert "already registered" in body

        # 4. Invalid registration input rejected
        status, headers, body = send_req("http://127.0.0.1:8088/register", {"username": "ab", "email": "invalidemail", "password": "123"}, method="POST")
        assert "Invalid registration input parameters" in body

        # 5. Normal login success creates an activity entry
        status, headers, body = send_req("http://127.0.0.1:8088/login", {"username": "decoy_test_user", "password": "SecretDecoyPassword123"}, method="POST")
        assert status == 302
        sess_cookie = headers.get("Set-Cookie")
        assert "session_id=" in sess_cookie

        # 6. Feedback submission succeeds and escapes HTML script content (authenticated)
        xss_script = "<script>alert('xss')</script> Very good decoy application!"
        status, headers, body = send_req("http://127.0.0.1:8088/feedback", {"comment": xss_script}, headers={"Cookie": sess_cookie}, method="POST")
        assert status == 200
        assert "Feedback recorded!" in body

        # 7. Verify feedback in DB and HTML feed escapes content
        status, headers, body = send_req("http://127.0.0.1:8088/feedback", headers={"Cookie": sess_cookie}, method="GET")
        assert "&lt;script&gt;" in body
        assert "<script>" not in body
        assert "Very good decoy application!" in body

        # 8. Failed login creates an activity entry
        status, headers, body = send_req("http://127.0.0.1:8088/login", {"username": "decoy_test_user", "password": "WrongPassword"}, method="POST")
        assert status == 200
        assert "Invalid credentials." in body

        # 9. Admin endpoint requires valid admin session
        status, headers, body = send_req("http://127.0.0.1:8088/admin/dashboard", method="GET")
        assert status == 403

        # Login as admin to test admin JSON API and dashboard data
        status, headers, body = send_req("http://127.0.0.1:8088/login", {"username": "admin", "password": "admin@123"}, method="POST")
        assert status == 302
        admin_cookie = headers.get("Set-Cookie")

        # 10. Admin API returns json counters and logs
        status, headers, body = send_req("http://127.0.0.1:8088/admin/dashboard?json=1", headers={"Cookie": admin_cookie}, method="GET")
        assert status == 200
        admin_json = json.loads(body)
        assert "counters" in admin_json
        assert admin_json["counters"]["total_users"] >= 1
        assert len(admin_json["activities"]) > 0
        assert len(admin_json["feedbacks"]) > 0

    finally:
        manager.stop()
        db = SessionLocal()
        try:
            db.query(HoneypotPortalUser).filter(HoneypotPortalUser.username == "decoy_test_user").delete()
            db.query(HoneypotFeedback).filter(HoneypotFeedback.username == "decoy_test_user").delete()
            db.commit()
        finally:
            db.close()



