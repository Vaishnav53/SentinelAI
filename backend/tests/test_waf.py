import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import SessionLocal
from backend.models.models import WAFRule, WAFHit, AuditLog

def test_waf_rules_crud():
    with TestClient(app) as client:
        # 1. Create rule
        res = client.post("/api/waf/rules", json={
            "ip_address": "10.0.0.99",
            "action": "BLOCK",
            "reason": "Test blocking rule",
            "analyst_attribution": "Test Analyst"
        })
        assert res.status_code == 200
        data = res.json()
        rule_id = data["id"]
        assert data["ip_address"] == "10.0.0.99"
        assert data["action"] == "BLOCK"

        # 2. Get rules
        res = client.get("/api/waf/rules")
        assert res.status_code == 200
        rules = res.json()
        assert any(r["id"] == rule_id for r in rules)

        # 3. Update rule
        res = client.put(f"/api/waf/rules/{rule_id}", json={
            "action": "QUARANTINE",
            "reason": "Updated test rule"
        })
        assert res.status_code == 200
        updated = res.json()
        assert updated["action"] == "QUARANTINE"

        # 4. Get WAF Status
        res = client.get("/api/waf/status")
        assert res.status_code == 200
        stats = res.json()
        assert stats["active_rules_count"] >= 1

        # 5. Delete rule
        res = client.delete(f"/api/waf/rules/{rule_id}")
        assert res.status_code == 200
        
        # Verify deletion
        res = client.get("/api/waf/rules")
        rules = res.json()
        assert not any(r["id"] == rule_id for r in rules)

def test_active_defense_evaluation():
    db = SessionLocal()
    try:
        # Create a test block rule
        rule = WAFRule(
            ip_address="192.168.99.99",
            action="BLOCK",
            reason="Malicious scanner IP block",
            is_enabled=1,
            rule_type="MANUAL"
        )
        db.add(rule)
        db.commit()
        rule_id = rule.id
        
        # Evaluate request
        from backend.services.active_defense import ActiveDefenseEngine
        engine = ActiveDefenseEngine(db)
        is_blocked, action, reason = engine.evaluate_request(
            "192.168.99.99",
            "/admin",
            "GET",
            {"User-Agent": "Mozilla"},
            ""
        )
        assert is_blocked is True
        assert action == "BLOCK"
        assert "scanner" in reason

        # Clean up
        db.delete(rule)
        db.commit()
    finally:
        db.close()
