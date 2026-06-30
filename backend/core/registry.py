from backend.services.settings import SettingsService
from backend.services.honeypot import HoneypotManager

_settings_service = SettingsService()
_honeypot_manager = HoneypotManager()

def get_settings_service() -> SettingsService:
    return _settings_service

def get_honeypot_manager() -> HoneypotManager:
    return _honeypot_manager
