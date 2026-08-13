import pytest
from backend.models.models import SentinelUser
from backend.services.auth import AuthService
from backend.schemas.auth import RegisterRequest
from backend.core.config import settings

def test_normal_registration_assigned_analyst_role(db):
    reg_payload = RegisterRequest(
        username="analyst_test_user",
        email="analyst_test@sentinel.ai",
        password="SecurePassword123!"
    )
    user = AuthService.register_user(db, reg_payload)
    assert user.role == "analyst"
    assert user.username == "analyst_test_user"

def test_analyst_forbidden_on_admin_endpoints(client, db):
    # Create analyst user session
    analyst_user = AuthService.register_user(db, RegisterRequest(
        username="analyst_only_user",
        email="analyst_only@sentinel.ai",
        password="SecurePassword123!"
    ))
    raw_token, _ = AuthService.create_user_session(db, analyst_user.id)
    client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, raw_token)

    # 1. Attempt WAF Rule Creation -> 403
    resp_waf = client.post("/api/waf/rules", json={"ip_address": "10.0.0.99", "action": "BLOCK"})
    assert resp_waf.status_code == 403
    assert "Administrator privileges required" in resp_waf.json()["error"]["message"]

    # 2. Attempt Honeypot Start -> 403
    resp_honey = client.post("/api/honeypot/start", json={"lan_mode": False})
    assert resp_honey.status_code == 403

    # 3. Attempt Settings Update -> 403
    resp_settings = client.put("/api/settings", json={"app_name": "TamperedApp"})
    assert resp_settings.status_code == 403

def test_analyst_allowed_on_soc_endpoints(client, db):
    analyst_user = AuthService.register_user(db, RegisterRequest(
        username="analyst_soc_user",
        email="analyst_soc@sentinel.ai",
        password="SecurePassword123!"
    ))
    raw_token, _ = AuthService.create_user_session(db, analyst_user.id)
    client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, raw_token)

    # 1. View Attacks Feed -> 200
    resp_attacks = client.get("/api/attacks")
    assert resp_attacks.status_code == 200

    # 2. View WAF Rules -> 200
    resp_waf_get = client.get("/api/waf/rules")
    assert resp_waf_get.status_code == 200

    # 3. Create Report Job -> 200
    resp_report = client.post("/api/reports/jobs", json={"format": "PDF"})
    assert resp_report.status_code == 200

def test_admin_allowed_on_admin_endpoints(client, db):
    admin_user = AuthService.register_user(db, RegisterRequest(
        username="admin_test_user",
        email="admin_test@sentinel.ai",
        password="SecurePassword123!"
    ))
    admin_user.role = "admin"
    db.commit()

    raw_token, _ = AuthService.create_user_session(db, admin_user.id)
    client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, raw_token)

    # 1. Admin WAF Rule Creation -> 200
    resp_waf = client.post("/api/waf/rules", json={"ip_address": "10.0.0.99", "action": "BLOCK"})
    assert resp_waf.status_code == 200
    assert resp_waf.json()["ip_address"] == "10.0.0.99"

    # 2. Admin Honeypot Start -> 200
    resp_honey = client.post("/api/honeypot/start", json={"lan_mode": False})
    assert resp_honey.status_code == 200

    # 3. Admin Settings Update -> 200
    resp_settings = client.put("/api/settings", json={"app_name": "SentinelAI"})
    assert resp_settings.status_code == 200

def test_unauthenticated_rejected_on_admin_endpoints(client):
    client.cookies.clear()
    resp_waf = client.post("/api/waf/rules", json={"ip_address": "10.0.0.99", "action": "BLOCK"})
    assert resp_waf.status_code == 401

def test_admin_bootstrap_idempotency(db, monkeypatch):
    monkeypatch.setattr(settings, "SENTINEL_ADMIN_USERNAME", "dyn4m1t3")
    monkeypatch.setattr(settings, "SENTINEL_ADMIN_PASSWORD", "TestAdminSecret123!")
    monkeypatch.setattr(settings, "SENTINEL_ADMIN_EMAIL", "admin@sentinel.ai")

    # First bootstrap execution -> Admin created
    user1 = AuthService.bootstrap_admin_user(db)
    assert user1 is not None
    assert user1.username == "dyn4m1t3"
    assert user1.role == "admin"

    # Second bootstrap execution -> Returns existing admin, no duplicate
    user2 = AuthService.bootstrap_admin_user(db)
    assert user2 is not None
    assert user2.id == user1.id
    
    count = db.query(SentinelUser).filter(SentinelUser.username == "dyn4m1t3").count()
    assert count == 1
