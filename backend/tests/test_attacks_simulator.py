import pytest
import asyncio
from backend.api.attacks import _generate_simulated_attack_event, start_attack_simulator
from backend.database.session import SessionLocal
from backend.models.models import AttackEvent

def test_generate_simulated_attack_event_worker():
    """Test that the synchronous helper worker generates, persists, and returns event data."""
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
    
    # Allow simulator loop to start
    await asyncio.sleep(0.05)
    
    # Cancel background simulator task
    task.cancel()
    
    # Task catches CancelledError internally, logs cancellation, and returns cleanly (None)
    result = await task
    assert result is None
