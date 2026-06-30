from typing import Dict, Any, Type, TypeVar
from backend.services.settings import SettingsService

T = TypeVar("T")

class ServiceRegistry:
    """Central container for singleton service instances (dependency registry)."""
    def __init__(self):
        self._services: Dict[Type, Any] = {}

    def register(self, service_cls: Type[T], instance: T) -> None:
        """Register a service instance."""
        self._services[service_cls] = instance

    def get(self, service_cls: Type[T]) -> T:
        """Retrieve a service instance. Raises KeyError if not registered."""
        if service_cls not in self._services:
            raise KeyError(f"Service {service_cls.__name__} not registered in registry.")
        return self._services[service_cls]

# Instantiate registry and register core services
registry = ServiceRegistry()
registry.register(SettingsService, SettingsService())

# Helper functions for FastAPI dependency injection
def get_settings_service() -> SettingsService:
    """Dependency injection helper for SettingsService."""
    return registry.get(SettingsService)
