from backend.models.models import ApplicationSetting, AttackEvent
from backend.services.settings import SettingsService

def test_database_crud(db):
    # Test setting creation
    setting = ApplicationSetting(key="test_key", value="test_val", type="string")
    db.add(setting)
    db.commit()
    
    # Test retrieval
    retrieved = db.query(ApplicationSetting).filter_by(key="test_key").first()
    assert retrieved is not None
    assert retrieved.value == "test_val"
    
    # Test update
    retrieved.value = "new_val"
    db.commit()
    updated = db.query(ApplicationSetting).filter_by(key="test_key").first()
    assert updated.value == "new_val"
    
    # Test delete
    db.delete(updated)
    db.commit()
    deleted = db.query(ApplicationSetting).filter_by(key="test_key").first()
    assert deleted is None

def test_settings_service_persistence(db):
    service = SettingsService()
    
    # Create setting via service
    service.update_setting(db, "retention_days", 90)
    
    # Retrieve parsed value
    val = service.get_setting(db, "retention_days")
    assert val == 90
    
    # Verify raw type storage in database
    raw = db.query(ApplicationSetting).filter_by(key="retention_days").first()
    assert raw.value == "90"
    assert raw.type == "int"

def test_attack_event_persistence(db):
    event = AttackEvent(
        attack_type="Brute Force",
        severity="HIGH",
        status="NEW",
        source_ip="192.168.1.50",
        destination_port=22,
        sensor_id="SSH_HONEYPOT",
        threat_score=7.5
    )
    db.add(event)
    db.commit()
    
    retrieved = db.query(AttackEvent).first()
    assert retrieved.attack_type == "Brute Force"
    assert retrieved.severity == "HIGH"
    assert retrieved.destination_port == 22
    assert retrieved.created_at is not None
    assert retrieved.updated_at is not None
