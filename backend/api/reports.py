import os
import json
import httpx
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from backend.database.session import get_db
from backend.core.config import settings
from backend.core.registry import get_settings_service
from backend.models.models import ReportJob, Report, AttackEvent, CorrelatedIncident, DecoySandboxFile
from backend.api.agent import resolve_ollama_model_name

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Reports"])

class ReportJobRead(BaseModel):
    id: int
    job_type: str
    status: str
    filters: Optional[str] = None
    progress: int
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GenerateReportPayload(BaseModel):
    type: str
    target_id: str

@router.get("/jobs", response_model=List[ReportJobRead])
async def get_report_jobs(db: Session = Depends(get_db)):
    """Retrieve list of all report jobs generated on the platform."""
    return db.query(ReportJob).order_by(ReportJob.created_at.desc()).all()

@router.post("/jobs", response_model=Dict[str, Any])
async def create_report_job(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Standard report job creation entry."""
    job = ReportJob(
        job_type=payload.get("format", "PDF"),
        status="completed",
        progress=100,
        filters=json.dumps(payload.get("filters", {})),
        created_at=datetime.utcnow()
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "filters": job.filters,
        "created_at": job.created_at.isoformat()
    }

@router.delete("/jobs/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report_job(id: int, db: Session = Depends(get_db)):
    """Delete a report job and its generated markdown artifact file."""
    job = db.query(ReportJob).filter(ReportJob.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Report job not found")
    
    # Try deleting associated report files
    reports = db.query(Report).filter(Report.job_id == id).all()
    for report in reports:
        if os.path.exists(report.file_path):
            try:
                os.remove(report.file_path)
            except Exception as e:
                logger.warning(f"Failed to delete report file {report.file_path}: {e}")
    
    db.delete(job)
    db.commit()
    return None

@router.get("/options")
async def get_report_options(type: str, db: Session = Depends(get_db)):
    """Fetch recent dynamic objects from DB to populate dropdown list based on report type."""
    options = []
    if type == "Threat Incident":
        incidents = db.query(CorrelatedIncident).order_by(CorrelatedIncident.created_at.desc()).all()
        for i in incidents:
            options.append({"value": str(i.id), "label": f"Incident #{i.id}: {i.title} ({i.severity})"})
        if not options:
            # Fallback to general attack events
            attacks = db.query(AttackEvent).order_by(AttackEvent.created_at.desc()).limit(20).all()
            for a in attacks:
                options.append({"value": f"event_{a.id}", "label": f"Event #{a.id}: {a.attack_type} from {a.source_ip}"})
    elif type == "Honeypot Request":
        attacks = db.query(AttackEvent).filter(AttackEvent.target_service == "HTTP Honeypot").order_by(AttackEvent.created_at.desc()).limit(50).all()
        for a in attacks:
            options.append({"value": str(a.id), "label": f"Honeypot #{a.id}: {a.attack_type} from {a.source_ip} (Port {a.destination_port})"})
    elif type == "Sandbox Upload":
        files = db.query(DecoySandboxFile).order_by(DecoySandboxFile.created_at.desc()).all()
        for f in files:
            options.append({"value": str(f.id), "label": f"File: {f.filename} ({f.status}) - {f.ip_address}"})
    elif type == "Attacker Dossier":
        ips = db.query(AttackEvent.source_ip).distinct().all()
        for ip in ips:
            if ip[0]:
                options.append({"value": ip[0], "label": f"Attacker IP: {ip[0]}"})
    return options

@router.post("/generate-ai-summary")
async def generate_ai_summary(
    payload: GenerateReportPayload,
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Query object details, invoke Ollama for synthesis, save markdown, and record jobs."""
    target_id = payload.target_id
    report_type = payload.type
    
    # 1. Fetch data context depending on type
    context_str = ""
    title_detail = ""
    
    if report_type == "Threat Incident":
        if target_id.startswith("event_"):
            event_id_int = int(target_id.replace("event_", ""))
            event = db.query(AttackEvent).filter(AttackEvent.id == event_id_int).first()
            if event:
                title_detail = f"Event #{event.id} ({event.attack_type})"
                context_str = (
                    f"Attack Event ID: {event.id}\n"
                    f"Type: {event.attack_type} | Severity: {event.severity}\n"
                    f"Source IP: {event.source_ip}:{event.source_port or 0} -> Target Port: {event.destination_port}\n"
                    f"Protocol: {event.protocol} | Sensor: {event.sensor_id}\n"
                    f"Payload Details:\n{event.payload or 'No payload content recorded.'}\n"
                )
        else:
            try:
                inc_id = int(target_id)
                inc = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == inc_id).first()
                if inc:
                    title_detail = f"Incident #{inc.id} ({inc.title})"
                    context_str = (
                        f"Correlated Incident ID: {inc.id}\n"
                        f"Title: {inc.title}\n"
                        f"Severity: {inc.severity} | Confidence: {int(inc.confidence * 100)}% | Status: {inc.status}\n"
                        f"Description: {inc.description}\n"
                        f"Nodes Topology Data:\n{inc.nodes_data or '[]'}\n"
                        f"Timeline Steps:\n{inc.timeline_data or '[]'}\n"
                    )
            except ValueError:
                pass
    elif report_type == "Honeypot Request":
        try:
            ev_id = int(target_id)
            event = db.query(AttackEvent).filter(AttackEvent.id == ev_id).first()
            if event:
                title_detail = f"Honeypot Event #{event.id} ({event.attack_type})"
                context_str = (
                    f"Honeypot Request ID: {event.id}\n"
                    f"Service: {event.target_service}\n"
                    f"Attack Signature: {event.attack_type} (Severity: {event.severity})\n"
                    f"Source Client Address: {event.source_ip} (Port: {event.source_port or 0}) -> Destination Port: {event.destination_port}\n"
                    f"Country/City: {event.country or 'Unknown'}/{event.city or 'Unknown'}\n"
                    f"Raw Ingress Payload:\n{event.payload or 'None'}\n"
                    f"User-Agent: {event.user_agent or 'Unknown'}\n"
                )
        except ValueError:
            pass
    elif report_type == "Sandbox Upload":
        try:
            s_id = int(target_id)
            sfile = db.query(DecoySandboxFile).filter(DecoySandboxFile.id == s_id).first()
            if sfile:
                title_detail = f"Sandbox File Upload ({sfile.filename})"
                context_str = (
                    f"Sandbox File ID: {sfile.id}\n"
                    f"Filename: {sfile.filename}\n"
                    f"File Size: {sfile.size_bytes} bytes\n"
                    f"MD5: {sfile.md5}\n"
                    f"SHA-1: {sfile.sha1}\n"
                    f"SHA-256: {sfile.sha256}\n"
                    f"Threat Assessment: {sfile.status} | Threat Score: {sfile.threat_score * 10.0}/10.0\n"
                    f"Scanner Description: {sfile.malware_description or 'No warning signatures.'}\n"
                    f"VirusTotal Matches: {sfile.vt_reputation or '0 matches'}\n"
                    f"Source Attacker Address: {sfile.ip_address}\n"
                )
        except ValueError:
            pass
    elif report_type == "Attacker Dossier":
        from backend.services.attacker_profiling import AttackerProfilingService
        profiler = AttackerProfilingService(db)
        profile = profiler.get_attacker_profile(target_id)
        if profile:
            title_detail = f"Attacker IP Dossier ({target_id})"
            context_str = (
                f"Attacker Host IP: {profile['ip_address']}\n"
                f"GeoIP Location: {profile['city']}, {profile['country']}\n"
                f"Attack Volume: {profile['attack_count']} attacks | WAF blocks: {profile['waf_count']} | Sandbox uploads: {profile['sandbox_count']}\n"
                f"State: {'Active Blocked IP' if profile['is_blocked'] else 'Monitored IP'}\n"
                f"Observed MITRE Techniques:\n{json.dumps(profile['mitre_techniques'])}\n"
                f"Chronological Timeline:\n{json.dumps(profile['timeline'])}\n"
            )

    if not context_str:
        raise HTTPException(status_code=404, detail="Selected target report item details not found")

    # 2. Build Ollama Prompt & Run Synthesis
    prompt = (
        f"Generate a comprehensive, formal security audit report for the following context:\n\n"
        f"--- CONTEXT DETAILS ---\n"
        f"{context_str}\n"
        f"-----------------------\n\n"
        f"Organize your report in clean Markdown format. Include sections: "
        f"### Executive Summary, "
        f"### Technical Deep Dive, "
        f"### MITRE ATT&CK Mapping, "
        f"### Operational Impact, "
        f"### Defensive Recommendations, "
        f"and ### Security References.\n"
        f"Be precise, technical, and objective."
    )

    raw_model = settings_service.get_setting(db, "default_ollama_model", settings.DEFAULT_OLLAMA_MODEL)
    model_name = await resolve_ollama_model_name(raw_model)
    timeout_seconds = float(settings_service.get_setting(db, "ollama_timeout_seconds", 120.0))
    
    markdown_content = ""
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": "You are a senior cyber security principal generating official SentinelAI security compliance logs."},
                        {"role": "user", "content": prompt}
                    ],
                    "stream": False
                }
            )
            if resp.status_code == 200:
                markdown_content = resp.json().get("message", {}).get("content", "")
    except Exception as e:
        logger.warning(f"Ollama offline during report AI synthesis, using template fallback: {e}")

    # Fallback to local markdown template if Ollama timed out/failed
    if not markdown_content:
        timestamp_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        
        mitre_list = "* T1190 - Exploit Public-Facing Application\n* T1110 - Brute Force"
        remediations = "1. Enable active firewall blocking rules.\n2. Revoke and update session access keys.\n3. Keep decoy sandbox execution monitored."
        
        if report_type == "Sandbox Upload":
            mitre_list = "* T1204.002 - User Execution: Malicious File\n* T1059 - Command and Scripting Interpreter"
            remediations = "1. Delete payload from sandbox directories.\n2. Add extension type blacklist in WAF settings."
        elif report_type == "Threat Incident":
            mitre_list = "* T1110 - Brute Force\n* T1078 - Valid Accounts"
            remediations = "1. Quarantine compromised host node.\n2. Force password resets for affected credentials."

        markdown_content = f"""# EXECUTIVE compliance security audit report
Generated on: {timestamp_str} (SentinelAI Fallback Analyzer)

## Executive Summary
This formal report details a security assessment generated dynamically by the SentinelAI compliance engine. The threat intelligence metrics analyze telemetry logs associated with target **{title_detail}**.

## Technical Deep Dive
```yaml
Report Type: {report_type}
Target Object Ref: {target_id}
Assessment Date: {timestamp_str}
Platform Service: HTTP Honeypot & Decoy Sandbox
```

### Context Parameters
{context_str}

## MITRE ATT&CK Mapping
The activity matches the following MITRE ATT&CK techniques:
{mitre_list}

## Operational Impact
High risk breach indicators. Probes, invalid authentications, or payload executions of this nature represent high-severity threats to the target local environment.

## Defensive Recommendations
{remediations}

## Security References
* SentinelAI Threat Database v1.0
* MITRE ATT&CK Matrix for Enterprise
* OWASP Top 10 vulnerabilities index
"""

    # 3. Create db records and save markdown content to disk
    os.makedirs(settings.REPORT_STORAGE, exist_ok=True)
    
    report_job = ReportJob(
        job_type=report_type,
        status="completed",
        progress=100,
        filters=json.dumps({"type": report_type, "target_id": target_id}),
        created_at=datetime.utcnow()
    )
    db.add(report_job)
    db.commit()
    db.refresh(report_job)
    
    file_path = os.path.join(settings.REPORT_STORAGE, f"report_{report_job.id}.md")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)
    except Exception as err:
        logger.error(f"Failed to write report file to disk: {err}")

    report = Report(
        job_id=report_job.id,
        title=f"{report_type} Audit Report - Job #{report_job.id}",
        file_path=file_path,
        file_size=len(markdown_content.encode('utf-8')),
        format="markdown",
        generated_by="System AI Analyst",
        created_at=datetime.utcnow()
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "id": report_job.id,
        "job_type": report_job.job_type,
        "status": report_job.status,
        "progress": report_job.progress,
        "created_at": report_job.created_at.isoformat(),
        "markdown": markdown_content,
        "report_id": report.id
    }

@router.get("/download/{id}")
async def download_report_file(id: int, db: Session = Depends(get_db)):
    """Serve the generated markdown report artifact file from local storage."""
    report = db.query(Report).filter(Report.job_id == id).first()
    if not report:
        # Try direct lookup by report ID
        report = db.query(Report).filter(Report.id == id).first()
        
    if not report or not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report artifact file not found on disk")
        
    filename = os.path.basename(report.file_path)
    return FileResponse(
        path=report.file_path,
        filename=filename,
        media_type="text/markdown"
    )

@router.get("/export-csv")
async def export_csv(type: str, id: str, db: Session = Depends(get_db)):
    """Compile dynamics of target selected item details into a downloadable CSV attachment."""
    csv_rows = []
    
    if type == "Threat Incident":
        if id.startswith("event_"):
            event_id_int = int(id.replace("event_", ""))
            event = db.query(AttackEvent).filter(AttackEvent.id == event_id_int).first()
            if event:
                csv_rows = [
                    ["Parameter", "Value"],
                    ["ID", str(event.id)],
                    ["External ID", event.external_id or ""],
                    ["Attack Type", event.attack_type],
                    ["Severity", event.severity],
                    ["Source IP", event.source_ip],
                    ["Source Port", str(event.source_port or "")],
                    ["Destination Port", str(event.destination_port)],
                    ["Protocol", event.protocol or ""],
                    ["Target Service", event.target_service or ""],
                    ["Country", event.country or ""],
                    ["City", event.city or ""],
                    ["User-Agent", event.user_agent or ""],
                    ["Created At", event.created_at.isoformat()]
                ]
        else:
            try:
                inc_id = int(id)
                inc = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == inc_id).first()
                if inc:
                    csv_rows = [
                        ["Parameter", "Value"],
                        ["Incident ID", str(inc.id)],
                        ["Title", inc.title],
                        ["Description", inc.description or ""],
                        ["Severity", inc.severity],
                        ["Confidence", f"{int(inc.confidence * 100)}%"],
                        ["Status", inc.status],
                        ["Assigned Analyst", inc.assigned_analyst or "Unassigned"],
                        ["Created At", inc.created_at.isoformat()]
                    ]
            except ValueError:
                pass
    elif type == "Honeypot Request":
        try:
            ev_id = int(id)
            event = db.query(AttackEvent).filter(AttackEvent.id == ev_id).first()
            if event:
                csv_rows = [
                    ["Parameter", "Value"],
                    ["Event ID", str(event.id)],
                    ["Target Service", event.target_service or ""],
                    ["Signature Type", event.attack_type],
                    ["Severity", event.severity],
                    ["Source IP", event.source_ip],
                    ["Source Port", str(event.source_port or "")],
                    ["Destination Port", str(event.destination_port)],
                    ["Country", event.country or ""],
                    ["City", event.city or ""],
                    ["User-Agent", event.user_agent or ""],
                    ["Created At", event.created_at.isoformat()]
                ]
        except ValueError:
            pass
    elif type == "Sandbox Upload":
        try:
            s_id = int(id)
            sfile = db.query(DecoySandboxFile).filter(DecoySandboxFile.id == s_id).first()
            if sfile:
                csv_rows = [
                    ["Parameter", "Value"],
                    ["File ID", str(sfile.id)],
                    ["Filename", sfile.filename],
                    ["Size Bytes", str(sfile.size_bytes)],
                    ["MD5", sfile.md5],
                    ["SHA-1", sfile.sha1],
                    ["SHA-256", sfile.sha256],
                    ["Threat Status", sfile.status],
                    ["Threat Score", f"{sfile.threat_score * 10.0}/10.0"],
                    ["Malware Description", sfile.malware_description or ""],
                    ["VT Matches", sfile.vt_reputation or ""],
                    ["Source IP", sfile.ip_address],
                    ["Created At", sfile.created_at.isoformat()]
                ]
        except ValueError:
            pass
    elif type == "Attacker Dossier":
        from backend.services.attacker_profiling import AttackerProfilingService
        profiler = AttackerProfilingService(db)
        profile = profiler.get_attacker_profile(id)
        if profile:
            csv_rows = [
                ["Parameter", "Value"],
                ["Attacker IP", profile["ip_address"]],
                ["City", profile["city"]],
                ["Country", profile["country"]],
                ["Latitude", str(profile.get("latitude", ""))],
                ["Longitude", str(profile.get("longitude", ""))],
                ["Honeypot Hits Count", str(profile["attack_count"])],
                ["WAF Intercepts Count", str(profile["waf_count"])],
                ["Malicious Sandbox Uploads", str(profile["sandbox_count"])],
                ["Blocked status", "Yes" if profile["is_blocked"] else "No"]
            ]

    if not csv_rows:
        raise HTTPException(status_code=404, detail="Selected target details empty or missing")

    # Construct clean CSV string
    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(csv_rows)
    csv_content = output.getvalue()
    
    filename = f"export_{type.replace(' ', '_')}_{id}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
