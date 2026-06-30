import psutil
import time
from fastapi import APIRouter
from backend.schemas.monitoring import SystemMetricCurrent

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

# Track boot time for uptime calculation
BOOT_TIME = psutil.boot_time()

@router.get("/current", response_model=SystemMetricCurrent)
async def get_current_metrics():
    """Retrieve host system metrics (CPU, RAM, Disk usage) using psutil."""
    cpu_percent = psutil.cpu_percent(interval=None)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    # Calculate uptime
    uptime_seconds = int(time.time() - BOOT_TIME)
    
    # Get active process count
    try:
        process_count = len(list(psutil.process_iter()))
    except Exception:
        process_count = 0
        
    return SystemMetricCurrent(
        cpu_percent=cpu_percent,
        memory_percent=memory.percent,
        disk_percent=disk.percent,
        network_sent=0.0,
        network_received=0.0,
        process_count=process_count,
        uptime_seconds=uptime_seconds
    )
