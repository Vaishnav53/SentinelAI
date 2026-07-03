from fastapi import APIRouter
from backend.api.health import router as health_router
from backend.api.settings import router as settings_router
from backend.api.attacks import router as attacks_router
from backend.api.sensors import router as sensors_router
from backend.api.agent import router as agent_router
from backend.api.reports import router as reports_router
from backend.api.monitoring import router as monitoring_router
from backend.api.honeypot import router as honeypot_router
from backend.api.threat_intel import router as threat_intel_router
from backend.api.waf import router as waf_router
from backend.api.logs import router as logs_router
from backend.api.correlation import router as correlation_router
from backend.api.sandbox import router as sandbox_router

api_router = APIRouter()

# Register sub-routers
api_router.include_router(health_router)
api_router.include_router(settings_router)
api_router.include_router(attacks_router)
api_router.include_router(sensors_router)
api_router.include_router(agent_router)
api_router.include_router(reports_router)
api_router.include_router(monitoring_router)
api_router.include_router(honeypot_router)
api_router.include_router(threat_intel_router)
api_router.include_router(waf_router)
api_router.include_router(logs_router)
api_router.include_router(correlation_router)
api_router.include_router(sandbox_router)
