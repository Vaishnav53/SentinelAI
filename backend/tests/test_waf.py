import pytest
from backend.database.session import SessionLocal
from backend.models.models import WAFRule, WAFHit, AuditLog
from backend.tests.conftest import create_test_auth_client

def test_waf_rules_crud():
    with create_test_auth_client() as client:
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

def test_waf_observed_sources_and_honeypot_enforcement():
    with create_test_auth_client() as client:
        db = SessionLocal()
        try:
            from datetime import datetime
            from backend.models.models import HoneypotActivityLog
            log_entry = HoneypotActivityLog(
                timestamp=datetime.utcnow(),
                source_ip="192.168.22.33",
                action_type="LOGIN_PROBE",
                result="DETECTED",
                severity="HIGH",
                request_path="/login.php"
            )


            db.add(log_entry)
            db.commit()

            # 1. Fetch observed sources endpoint
            res = client.get("/api/waf/observed-sources")
            assert res.status_code == 200
            sources = res.json()
            target_source = next((s for s in sources if s["ip_address"] == "192.168.22.33"), None)
            assert target_source is not None
            assert target_source["is_blocked"] is False
            assert target_source["event_count"] >= 1

            # 2. Block the observed source
            res = client.post("/api/waf/rules", json={
                "ip_address": "192.168.22.33",
                "action": "BLOCK",
                "reason": "Observed Honeypot Source containment"
            })
            assert res.status_code == 200
            rule_id = res.json()["id"]

            # 3. Verify ActiveDefenseEngine evaluates blocked state for target IP
            from backend.services.active_defense import ActiveDefenseEngine
            engine = ActiveDefenseEngine(db)
            is_blocked, action, reason = engine.evaluate_request(
                "192.168.22.33", "/", "GET", {}, ""
            )
            assert is_blocked is True
            assert action == "BLOCK"

            # 4. Unblock observed source
            res = client.delete(f"/api/waf/rules/{rule_id}")
            assert res.status_code == 200

            # 5. Clean up test log
            db.delete(log_entry)
            db.commit()
        finally:
            db.close()
