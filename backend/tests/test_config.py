from backend.core.config import Settings, settings

def test_settings_load():
    assert settings.APP_NAME == "SentinelAI"
    assert settings.APP_ENV in ("development", "test", "production")
    assert settings.APP_PORT == 8000

def test_custom_settings_instantiation():
    custom = Settings(
        APP_NAME="MockShield",
        APP_ENV="test",
        APP_PORT=9999
    )
    assert custom.APP_NAME == "MockShield"
    assert custom.APP_ENV == "test"
    assert custom.APP_PORT == 9999
