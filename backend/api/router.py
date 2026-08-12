from fastapi import APIRouter, Depends
from backend.api.auth import router as auth_router
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
from backend.api.attacker import router as attacker_router
from backend.api.playbooks import router as playbooks_router
from backend.api.dependencies import get_current_user

api_router = APIRouter()

# 1. Public API Routers
api_router.include_router(auth_router)
api_router.include_router(health_router)

# 2. Decoy / Honeypot API Router (Unauthenticated Decoy Infrastructure)
api_router.include_router(honeypot_router)

# 3. Protected SentinelAI SOC User API Routers
api_router.include_router(settings_router, dependencies=[Depends(get_current_user)])
api_router.include_router(attacks_router, dependencies=[Depends(get_current_user)])
api_router.include_router(sensors_router, dependencies=[Depends(get_current_user)])
api_router.include_router(agent_router, dependencies=[Depends(get_current_user)])
api_router.include_router(reports_router, dependencies=[Depends(get_current_user)])
api_router.include_router(monitoring_router, dependencies=[Depends(get_current_user)])
api_router.include_router(threat_intel_router, dependencies=[Depends(get_current_user)])
api_router.include_router(waf_router, dependencies=[Depends(get_current_user)])
api_router.include_router(logs_router, dependencies=[Depends(get_current_user)])
api_router.include_router(correlation_router, dependencies=[Depends(get_current_user)])
api_router.include_router(sandbox_router, dependencies=[Depends(get_current_user)])
api_router.include_router(attacker_router, dependencies=[Depends(get_current_user)])
api_router.include_router(playbooks_router, dependencies=[Depends(get_current_user)])
