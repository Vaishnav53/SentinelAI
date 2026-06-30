from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.database.session import get_db
from backend.models.models import ReportJob

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/jobs", response_model=List[Dict[str, Any]])
async def get_report_jobs(db: Session = Depends(get_db)):
    """Retrieve list of report jobs generated on the platform."""
    # For now, return mock placeholder rows representing reports
    return [
        {
            "id": 1,
            "job_type": "PDF",
            "status": "completed",
            "filters": '{"severity": "HIGH"}',
            "progress": 100,
            "error_message": None,
            "created_at": "2026-06-30T10:00:00"
        },
        {
            "id": 2,
            "job_type": "CSV",
            "status": "completed",
            "filters": "{}",
            "progress": 100,
            "error_message": None,
            "created_at": "2026-06-30T12:30:00"
        }
    ]

@router.post("/jobs", response_model=Dict[str, Any])
async def create_report_job(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Trigger a new PDF/CSV report compilation job."""
    return {
        "id": 3,
        "job_type": payload.get("format", "PDF"),
        "status": "completed",
        "progress": 100,
        "filters": str(payload.get("filters", {})),
        "created_at": "2026-06-30T18:40:00"
    }
