import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import SessionLocal
from backend.models.models import DecoySandboxFile, WAFRule, AttackEvent

def test_sandbox_ingestion_and_threat_detection():
    with TestClient(app) as client:
        # 1. Ingest a clean avatar file
        from backend.services.decoy_sandbox import DecoySandboxService
        db = SessionLocal()
        service = DecoySandboxService(db)
        
        import asyncio
        loop = asyncio.new_event_loop()
        sfile = loop.run_until_complete(
            service.save_and_scan_file(
                "avatar.png",
                b"fake png file content byte stream data",
                "127.0.0.1"
            )
        )
        loop.close()
        
        assert sfile.status == "CLEAN"
        assert sfile.threat_score == 0.0
        assert sfile.sha256 is not None
        assert sfile.md5 is not None
        assert sfile.sha1 is not None
        
        # 2. Ingest a malicious double-extension PHP script
        loop = asyncio.new_event_loop()
        mal_file = loop.run_until_complete(
            service.save_and_scan_file(
                "avatar.png.php",
                b"<?php system($_GET['cmd']); ?>",
                "192.168.1.55"
            )
        )
        loop.close()
        
        assert mal_file.status == "MALICIOUS"
        assert mal_file.threat_score >= 0.8
        
        # 3. Retrieve files via API
        res = client.get("/api/sandbox/files")
        assert res.status_code == 200
        files = res.json()
        assert any(f["id"] == mal_file.id for f in files)
        
        # 4. Get Sandbox overview stats
        res = client.get("/api/sandbox/status")
        assert res.status_code == 200
        stats = res.json()
        assert stats["total_scanned"] >= 2
        assert stats["malicious_count"] >= 1
        
        # 5. Quarantine containment action
        res = client.post(f"/api/sandbox/files/{mal_file.id}/contain")
        assert res.status_code == 200
        assert res.json()["status"] == "SUCCESS"
        
        # Check uploader IP was blocked in WAF rules
        waf_rules = db.query(WAFRule).filter(WAFRule.ip_address == "192.168.1.55").all()
        assert len(waf_rules) >= 1
        
        # Clean up database
        db.query(DecoySandboxFile).filter(DecoySandboxFile.id.in_([sfile.id, mal_file.id])).delete()
        db.query(WAFRule).filter(WAFRule.ip_address == "192.168.1.55").delete()
        db.query(AttackEvent).filter(AttackEvent.source_ip == "192.168.1.55").delete()
        db.commit()
        db.close()

def test_honeypot_path_traversal_deception():
    # Clear any previous local block rules for 127.0.0.1 so WAF doesn't trigger auto-containment
    db = SessionLocal()
    db.query(WAFRule).filter((WAFRule.ip_address == "127.0.0.1") | (WAFRule.ip_address == "")).delete()
    db.query(AttackEvent).filter(AttackEvent.source_ip == "127.0.0.1").delete()
    db.commit()
    db.close()

    # Make a mock query to honeypot port mimicking /etc/passwd LFI traversal
    from backend.services.honeypot import HoneypotManager
    import urllib.request
    import urllib.error
    import time

    mgr = HoneypotManager()
    status = mgr.start(lan_mode=False)
    time.sleep(1)

    try:
        # Request LFI traversal
        req = urllib.request.Request("http://127.0.0.1:8088/../../etc/passwd", headers={"User-Agent": "LFI Tester"})
        with urllib.request.urlopen(req) as res:
            assert res.status == 200
            content = res.read().decode('utf-8')
            assert "root:x:0:0:root:" in content, "Expected fake passwd decoy output"
            assert "aetheris-admin:" in content, "Expected decoy users list"
    finally:
        mgr.stop()
