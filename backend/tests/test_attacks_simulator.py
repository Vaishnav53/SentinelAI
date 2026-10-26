import pytest
import asyncio
from unittest.mock import patch
from backend.core.config import settings
from backend.api.attacks import _generate_simulated_attack_event, start_attack_simulator, manager
from backend.services.threat_intel import ThreatIntelService
from backend.database.session import SessionLocal
from backend.models.models import AttackEvent

def test_simulator_disabled_by_default():
    """Verify that the simulator configuration flag is disabled by default."""
    assert settings.ENABLE_ATTACK_SIMULATOR is False

@pytest.mark.anyio
async def test_startup_does_not_create_simulator_task_when_disabled():
    """Verify that FastAPI lifespan startup leaves simulator_task as None when disabled."""
    from fastapi import FastAPI
    from backend.main import lifespan
    test_app = FastAPI(lifespan=lifespan)

    with patch.object(settings, "ENABLE_ATTACK_SIMULATOR", False):
        async with lifespan(test_app):
            assert hasattr(test_app.state, "simulator_task")
            assert test_app.state.simulator_task is None

@pytest.mark.anyio
async def test_startup_creates_simulator_task_when_opted_in():
    """Verify that FastAPI lifespan startup launches simulator when explicitly enabled."""
    from fastapi import FastAPI
    from backend.main import lifespan
    test_app = FastAPI(lifespan=lifespan)

    with patch.object(settings, "ENABLE_ATTACK_SIMULATOR", True):
        async with lifespan(test_app):
            assert hasattr(test_app.state, "simulator_task")
            assert test_app.state.simulator_task is not None
            assert isinstance(test_app.state.simulator_task, asyncio.Task)

def test_threat_intel_cgnat_rfc6598_classification():
    """Verify RFC 6598 Carrier-Grade NAT addresses (100.64.0.0/10) are classified correctly without external GeoIP calls."""
    service = ThreatIntelService()
    with patch.object(service, "_query_free_geoip") as mock_geoip:
        cgnat_ips = ["100.73.95.23", "100.64.0.1", "100.127.255.254"]
        for ip in cgnat_ips:
            res = service.enrich_ip(ip)
            assert res["country"] == "Unknown"
            assert res["city"] == "Unknown"
            assert res["country_code"] == "UN"
            assert "CGNAT" in res["isp"]
            assert res["threat_score"] == 0
            assert res["risk_level"] == "LOW"
        # Must never attempt external network queries for CGNAT addresses
        mock_geoip.assert_not_called()

def test_threat_intel_private_and_loopback_classification():
    """Verify private (RFC 1918) and loopback addresses return standard local labels without external GeoIP calls."""
    service = ThreatIntelService()
    with patch.object(service, "_query_free_geoip") as mock_geoip:
        for ip in ["127.0.0.1", "192.168.1.100", "10.0.0.1", "172.16.5.1"]:
            res = service.enrich_ip(ip)
            assert res["country"] == "Loopback / Private Network"
            assert res["city"] == "Loopback / Private Network"
            assert res["country_code"] == "LAN"
            assert res["threat_score"] == 0
        mock_geoip.assert_not_called()

def test_threat_intel_unresolved_public_ip_never_hashes_to_fabricated_country():
    """Verify that unresolved public IPs do NOT receive fabricated countries or cities from hash fallbacks."""
    service = ThreatIntelService()
    with patch.object(service, "_query_free_geoip", return_value=None):
        # Test public IPs that previously got mapped to Germany, Russia, China by hash
        for ip in ["93.184.216.34", "100.172.1.141", "104.244.42.1", "151.101.1.140"]:
            res = service.enrich_ip(ip)
            assert res["country"] == "Unknown"
            assert res["city"] == "Unknown"
            assert res["country_code"] == "UN"
            assert res["asn"] == "Unknown"
            assert res["isp"] == "Unknown"

def test_threat_intel_resolved_public_ip_uses_genuine_provider_data():
    """Verify that when external GeoIP returns data for a public IP, genuine location is preserved."""
    service = ThreatIntelService()
    mock_payload = {
        "status": "success",
        "country": "Canada",
        "countryCode": "CA",
        "city": "Montreal",
        "as": "AS577 Bell Canada",
        "isp": "Bell Canada",
        "lat": 45.5017,
        "lon": -73.5673
    }
    with patch.object(service, "_query_free_geoip", return_value=mock_payload):
        res = service.enrich_ip("93.184.216.34")
        assert res["country"] == "Canada"
        assert res["country_code"] == "CA"
        assert res["city"] == "Montreal"
        assert res["asn"] == "AS577"
        assert res["isp"] == "Bell Canada"
        assert res["latitude"] == 45.5017
        assert res["longitude"] == -73.5673

@pytest.mark.anyio
async def test_websocket_broadcast_functional():
    """Verify that WebSocket broadcast mechanism remains intact."""
    class DummySocket:
        def __init__(self):
            self.sent = []
        async def send_json(self, msg):
            self.sent.append(msg)

    sock = DummySocket()
    manager.active_connections.append(sock)
    try:
        await manager.broadcast({"type": "test_alert", "data": {"id": 123}})
        assert len(sock.sent) == 1
        assert sock.sent[0]["type"] == "test_alert"
    finally:
        manager.disconnect(sock)

def test_generate_simulated_attack_event_worker():
    """Test that the synchronous helper worker generates, persists, and returns event data when invoked."""
    with patch.object(ThreatIntelService, "_query_free_geoip", return_value={
        "status": "success",
        "country": "United States",
        "countryCode": "US",
        "city": "Chicago",
        "as": "AS21928",
        "isp": "Test ISP",
        "lat": 41.8781,
        "lon": -87.6298
    }):
        event_data = _generate_simulated_attack_event()

    assert event_data is not None
    assert "external_id" in event_data
    assert event_data["external_id"].startswith("SIM-")
    assert "attack_type" in event_data
    assert "severity" in event_data
    assert "created_at" in event_data
    assert isinstance(event_data["created_at"], str)

    # Verify record was committed in SessionLocal database
    db = SessionLocal()
    try:
        db_event = db.query(AttackEvent).filter(AttackEvent.external_id == event_data["external_id"]).first()
        assert db_event is not None
        assert db_event.attack_type == event_data["attack_type"]
    finally:
        db.close()

@pytest.mark.anyio
async def test_start_attack_simulator_cancellation():
    """Test that start_attack_simulator starts, runs offloaded tasks, and handles cancellation cleanly."""
    task = asyncio.create_task(start_attack_simulator())
    await asyncio.sleep(0.05)
    task.cancel()
    result = await task
    assert result is None

def test_attacker_profiles_limit_parameter():
    """Test that /attacker/profiles honors optional limit query parameter."""
    from backend.services.attacker_profiling import AttackerProfilingService
    db = SessionLocal()
    try:
        service = AttackerProfilingService(db)
        res_full = service.get_all_attackers()
        res_5 = service.get_all_attackers(limit=5)
        if len(res_full) >= 5:
            assert len(res_5) == 5
            assert res_5[0]["ip_address"] == res_full[0]["ip_address"]
        else:
            assert len(res_5) == len(res_full)
    finally:
        db.close()
