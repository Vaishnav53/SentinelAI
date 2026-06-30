import json
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from backend.models.models import ApplicationSetting

class SettingsService:
    @staticmethod
    def get_setting_raw(db: Session, key: str) -> Optional[ApplicationSetting]:
        """Retrieve raw ApplicationSetting entity."""
        return db.query(ApplicationSetting).filter(ApplicationSetting.key == key).first()

    @staticmethod
    def parse_setting_value(value: str, setting_type: str) -> Any:
        """Parse string value into corresponding python type."""
        if setting_type == "int":
            return int(value)
        elif setting_type == "float":
            return float(value)
        elif setting_type == "bool":
            return value.lower() in ("true", "1", "yes")
        elif setting_type == "json":
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {}
        return value

    @staticmethod
    def serialize_setting_value(value: Any) -> tuple[str, str]:
        """Convert python value into string representation and type name."""
        if isinstance(value, bool):
            return "true" if value else "false", "bool"
        elif isinstance(value, int):
            return str(value), "int"
        elif isinstance(value, float):
            return str(value), "float"
        elif isinstance(value, (dict, list)):
            return json.dumps(value), "json"
        return str(value), "string"

    def get_setting(self, db: Session, key: str, default: Any = None) -> Any:
        """Get a parsed setting value, falling back to default."""
        setting = self.get_setting_raw(db, key)
        if not setting:
            return default
        return self.parse_setting_value(setting.value, setting.type)

    def get_all_settings(self, db: Session) -> Dict[str, Any]:
        """Retrieve all parsed settings as a dictionary."""
        settings_list = db.query(ApplicationSetting).all()
        return {s.key: self.parse_setting_value(s.value, s.type) for s in settings_list}

    def update_setting(self, db: Session, key: str, value: Any) -> ApplicationSetting:
        """Update or create an application setting, serializing the value."""
        val_str, val_type = self.serialize_setting_value(value)
        setting = self.get_setting_raw(db, key)
        
        if setting:
            setting.value = val_str
            setting.type = val_type
        else:
            setting = ApplicationSetting(key=key, value=val_str, type=val_type)
            db.add(setting)
            
        db.commit()
        db.refresh(setting)
        return setting

    def reset_settings(self, db: Session, defaults: Dict[str, Any]) -> None:
        """Reset settings to default configuration."""
        db.query(ApplicationSetting).delete()
        for key, val in defaults.items():
            val_str, val_type = self.serialize_setting_value(val)
            setting = ApplicationSetting(key=key, value=val_str, type=val_type)
            db.add(setting)
        db.commit()
