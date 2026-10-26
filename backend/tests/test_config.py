from backend.core.config import Settings, settings

def test_settings_load():
    assert settings.APP_NAME == "SentinelAI"
    assert settings.APP_ENV in ("development", "test", "production", "prod")
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

def test_resolve_app_env_contract(monkeypatch):
    from backend.core.config import _resolve_app_env

    # 1. Genuinely absent environment variable defaults to development
    monkeypatch.delenv("APP_ENV", raising=False)
    assert _resolve_app_env() == "development"

    # 2. Case variations and surrounding whitespace normalized
    monkeypatch.setenv("APP_ENV", "  Production  ")
    assert _resolve_app_env() == "production"

    monkeypatch.setenv("APP_ENV", "  PROD  ")
    assert _resolve_app_env() == "prod"

    # 3. Empty or whitespace-only preserved as empty string (rejected at startup)
    monkeypatch.setenv("APP_ENV", "")
    assert _resolve_app_env() == ""

    monkeypatch.setenv("APP_ENV", "   ")
    assert _resolve_app_env() == ""

