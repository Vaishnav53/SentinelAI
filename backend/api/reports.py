import os
import json
import csv
import io
import re
import httpx
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from backend.database.session import get_db
from backend.core.config import settings
from backend.core.registry import get_settings_service
from backend.models.models import (
    ReportJob, Report, AttackEvent, CorrelatedIncident,
    DecoySandboxFile, WAFHit, HoneypotActivityLog
)

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

class AIExecutiveSummaryPayload(BaseModel):
    time_range: str = "7d"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    custom_context: Optional[Dict[str, Any]] = None

@router.get("/jobs", response_model=List[ReportJobRead])
def get_report_jobs(db: Session = Depends(get_db)):
    """Retrieve list of all report jobs generated on the platform."""
    return db.query(ReportJob).order_by(ReportJob.created_at.desc()).all()

@router.post("/jobs", response_model=Dict[str, Any])
def create_report_job(payload: Dict[str, Any], db: Session = Depends(get_db)):
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
def delete_report_job(id: int, db: Session = Depends(get_db)):
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
def get_report_options(type: str, db: Session = Depends(get_db)):
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

def _resolve_time_bounds(time_range: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    now = datetime.utcnow()
    if time_range == "24h":
        cur_start = now - timedelta(hours=24)
        cur_end = now
        prev_start = cur_start - timedelta(hours=24)
        prev_end = cur_start
        interval = "hourly"
        bucket_count = 24
    elif time_range == "30d":
        cur_start = now - timedelta(days=30)
        cur_end = now
        prev_start = cur_start - timedelta(days=30)
        prev_end = cur_start
        interval = "daily"
        bucket_count = 30
    elif time_range == "custom" and start_date and end_date:
        try:
            cur_start = datetime.fromisoformat(start_date.replace("Z", "+00:00")).replace(tzinfo=None)
            cur_end = datetime.fromisoformat(end_date.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            cur_start = now - timedelta(days=7)
            cur_end = now
        if cur_start >= cur_end:
            cur_start = cur_end - timedelta(days=1)
        duration = cur_end - cur_start
        prev_start = cur_start - duration
        prev_end = cur_start
        interval = "hourly" if duration.total_seconds() <= 86400 * 2 else "daily"
        bucket_count = max(7, min(30, int(duration.total_seconds() / (3600 if interval == "hourly" else 86400))))
    else:  # Default "7d"
        time_range = "7d"
        cur_start = now - timedelta(days=7)
        cur_end = now
        prev_start = cur_start - timedelta(days=7)
        prev_end = cur_start
        interval = "daily"
        bucket_count = 7

    return cur_start, cur_end, prev_start, prev_end, interval, bucket_count

def _build_deterministic_executive_summary(summary_data: Dict[str, Any]) -> str:
    total = summary_data.get("total_events", 0)
    sources = summary_data.get("unique_sources", 0)
    crit_high = summary_data.get("critical_high_events", 0)
    blocked = summary_data.get("blocked_events", 0)
    trend_level = summary_data.get("attack_trend_level", "Moderate")
    trend_desc = summary_data.get("attack_trend_desc", "Baseline")
    range_label = summary_data.get("range_label", "Selected Period")
    top_types = summary_data.get("top_attack_types", [])
    top_sources = summary_data.get("top_attack_sources", [])

    primary_attack = top_types[0]["name"] if top_types else "Suspicious Reconnaissance"
    primary_source = top_sources[0]["source_ip"] if top_sources else "Distributed Sources"

    crit_pct = round((crit_high / max(total, 1)) * 100, 1) if total > 0 else 0

    return (
        f"### Executive Threat Briefing ({range_label})\n\n"
        f"During the **{range_label}** monitoring window, SentinelAI intercepted and analyzed **{total:,} total security events** "
        f"originating from **{sources:,} unique threat sources**. The overall attack velocity is classified as **{trend_level.upper()}** "
        f"({trend_desc}).\n\n"
        f"#### Threat Posture & Critical Indicators\n"
        f"* **High-Impact Vectors**: **{crit_high:,} events ({crit_pct}%)** met Critical or High severity thresholds, "
        f"with **{primary_attack}** emerging as the dominant vector.\n"
        f"* **Top Threat Actor**: Host **`{primary_source}`** generated the highest attack concentration, targeting exposed network services.\n"
        f"* **Defensive Interceptions**: Active WAF filtering and HTTP honeypot decoys successfully neutralized/intercepted **{blocked:,} malicious probes**.\n\n"
        f"#### Tactical Recommendations\n"
        f"1. **Enforce WAF Rules**: Quarantine repeat offender IP addresses exhibiting persistent SQLi or path traversal signatures.\n"
        f"2. **Honeypot Decoy Telemetry**: Maintain active port 8088 decoy listeners to capture zero-day payloads before lateral network traversal.\n"
        f"3. **Credential Hardening**: Rotate administrative session secrets and verify multi-factor authentication policies across edge gateways."
    )

@router.get("/analytics")
def get_reports_analytics(
    time_range: str = Query("7d", alias="range", description="Time range (24h, 7d, 30d, custom)"),
    start_date: Optional[str] = Query(None, description="Custom range start ISO date"),
    end_date: Optional[str] = Query(None, description="Custom range end ISO date"),
    db: Session = Depends(get_db)
):
    """Retrieve consolidated, server-side aggregated security analytics for reporting."""
    cur_start, cur_end, prev_start, prev_end, interval, bucket_count = _resolve_time_bounds(time_range, start_date, end_date)

    # 1. Fetch current and previous events
    cur_attacks = db.query(AttackEvent).filter(
        AttackEvent.created_at >= cur_start,
        AttackEvent.created_at <= cur_end
    ).order_by(AttackEvent.created_at.desc()).all()

    prev_attacks = db.query(AttackEvent).filter(
        AttackEvent.created_at >= prev_start,
        AttackEvent.created_at < prev_end
    ).all()

    cur_waf_hits = db.query(WAFHit).filter(
        WAFHit.created_at >= cur_start,
        WAFHit.created_at <= cur_end
    ).all()

    prev_waf_hits = db.query(WAFHit).filter(
        WAFHit.created_at >= prev_start,
        WAFHit.created_at < prev_end
    ).all()

    cur_incidents = db.query(CorrelatedIncident).filter(
        CorrelatedIncident.created_at >= cur_start,
        CorrelatedIncident.created_at <= cur_end
    ).order_by(CorrelatedIncident.created_at.desc()).all()

    cur_hp_logs = db.query(HoneypotActivityLog).filter(
        HoneypotActivityLog.timestamp >= cur_start,
        HoneypotActivityLog.timestamp <= cur_end
    ).all()

    prev_hp_logs = db.query(HoneypotActivityLog).filter(
        HoneypotActivityLog.timestamp >= prev_start,
        HoneypotActivityLog.timestamp < prev_end
    ).all()

    # 2. KPI Metrics Calculation
    total_events = len(cur_attacks)
    prev_total_events = len(prev_attacks)
    diff_total_pct = round(((total_events - prev_total_events) / max(prev_total_events, 1)) * 100, 1) if prev_total_events > 0 else (0.0 if total_events == 0 else 100.0)

    unique_sources = len(set(a.source_ip for a in cur_attacks if a.source_ip))
    prev_unique_sources = len(set(a.source_ip for a in prev_attacks if a.source_ip))
    diff_sources_pct = round(((unique_sources - prev_unique_sources) / max(prev_unique_sources, 1)) * 100, 1) if prev_unique_sources > 0 else (0.0 if unique_sources == 0 else 100.0)

    crit_high_events = sum(1 for a in cur_attacks if str(a.severity).upper() in ("HIGH", "CRITICAL"))
    prev_crit_high_events = sum(1 for a in prev_attacks if str(a.severity).upper() in ("HIGH", "CRITICAL"))
    diff_crit_high_pct = round(((crit_high_events - prev_crit_high_events) / max(prev_crit_high_events, 1)) * 100, 1) if prev_crit_high_events > 0 else (0.0 if crit_high_events == 0 else 100.0)

    # Blocked / Mitigated count
    blocked_waf = sum(1 for w in cur_waf_hits if str(w.action).upper() in ("BLOCK", "QUARANTINE"))
    blocked_hp = sum(1 for h in cur_hp_logs if str(h.result).upper() in ("INTERCEPTED", "BLOCKED"))
    blocked_attacks = sum(1 for a in cur_attacks if str(a.status).upper() in ("RESOLVED", "BLOCKED", "CONTAINED"))
    blocked_events = max(blocked_waf + blocked_hp, blocked_attacks)

    prev_blocked_waf = sum(1 for w in prev_waf_hits if str(w.action).upper() in ("BLOCK", "QUARANTINE"))
    prev_blocked_hp = sum(1 for h in prev_hp_logs if str(h.result).upper() in ("INTERCEPTED", "BLOCKED"))
    prev_blocked_attacks = sum(1 for a in prev_attacks if str(a.status).upper() in ("RESOLVED", "BLOCKED", "CONTAINED"))
    prev_blocked_events = max(prev_blocked_waf + prev_blocked_hp, prev_blocked_attacks)
    diff_blocked_pct = round(((blocked_events - prev_blocked_events) / max(prev_blocked_events, 1)) * 100, 1) if prev_blocked_events > 0 else (0.0 if blocked_events == 0 else 100.0)

    # Attack Trend calculation
    if total_events == 0:
        trend_level = "Low"
        trend_desc = "Baseline activity"
    elif prev_total_events > 0 and (total_events / prev_total_events) >= 1.20:
        trend_level = "High"
        trend_desc = f"+{abs(diff_total_pct)}% volume surge"
    elif prev_total_events > 0 and (total_events / prev_total_events) <= 0.80:
        trend_level = "Low"
        trend_desc = f"-{abs(diff_total_pct)}% volume reduction"
    else:
        trend_level = "Moderate"
        trend_desc = f"{'+' if diff_total_pct >= 0 else ''}{diff_total_pct}% nominal rate"

    # 3. Time Series & Sparklines Bucketing
    duration_total_sec = (cur_end - cur_start).total_seconds()
    bucket_step_sec = duration_total_sec / max(bucket_count, 1)

    timeline_series = []
    sparkline_total = []
    sparkline_sources = []
    sparkline_crit_high = []
    sparkline_blocked = []
    sparkline_trend = []

    for i in range(bucket_count):
        b_start = cur_start + timedelta(seconds=i * bucket_step_sec)
        b_end = cur_start + timedelta(seconds=(i + 1) * bucket_step_sec)

        b_attacks = [a for a in cur_attacks if b_start <= a.created_at < b_end]
        b_waf = [w for w in cur_waf_hits if b_start <= w.created_at < b_end]
        b_hp = [h for h in cur_hp_logs if b_start <= h.timestamp < b_end]

        b_total = len(b_attacks)
        b_high_crit = sum(1 for a in b_attacks if str(a.severity).upper() in ("HIGH", "CRITICAL"))
        b_sources = len(set(a.source_ip for a in b_attacks if a.source_ip))
        b_blocked = sum(1 for w in b_waf if str(w.action).upper() in ("BLOCK", "QUARANTINE")) + sum(1 for h in b_hp if str(h.result).upper() in ("INTERCEPTED", "BLOCKED"))

        label_fmt = "%H:%M" if interval == "hourly" else "%b %d"
        b_label = b_start.strftime(label_fmt)

        timeline_series.append({
            "timestamp": b_label,
            "full_time": b_start.isoformat(),
            "total_events": b_total,
            "high_severity": b_high_crit,
            "blocked_events": b_blocked
        })

        sparkline_total.append(b_total)
        sparkline_sources.append(b_sources)
        sparkline_crit_high.append(b_high_crit)
        sparkline_blocked.append(b_blocked)
        sparkline_trend.append(b_total)

    # 4. Severity Distribution
    crit_count = sum(1 for a in cur_attacks if str(a.severity).upper() == "CRITICAL")
    high_count = sum(1 for a in cur_attacks if str(a.severity).upper() == "HIGH")
    med_count = sum(1 for a in cur_attacks if str(a.severity).upper() == "MEDIUM")
    low_count = sum(1 for a in cur_attacks if str(a.severity).upper() in ("LOW", "INFORMATIONAL", "INFO"))

    denom = max(total_events, 1)
    severity_distribution = [
        {"name": "Critical", "count": crit_count, "percentage": round((crit_count / denom) * 100, 1), "color": "#ff3838"},
        {"name": "High", "count": high_count, "percentage": round((high_count / denom) * 100, 1), "color": "#ff9f1a"},
        {"name": "Medium", "count": med_count, "percentage": round((med_count / denom) * 100, 1), "color": "#00e5ff"},
        {"name": "Low", "count": low_count, "percentage": round((low_count / denom) * 100, 1), "color": "#17c0eb"}
    ]

    # 5. Top Attack Types
    type_counts: Dict[str, int] = {}
    for a in cur_attacks:
        atype = a.attack_type or "Unknown Vector"
        type_counts[atype] = type_counts.get(atype, 0) + 1

    top_attack_types = []
    palette = ["#00e5ff", "#17c0eb", "#7158e2", "#ff9f1a", "#ff3838", "#2ed573", "#ffb8b8"]
    sorted_types = sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:6]
    for idx, (t_name, count) in enumerate(sorted_types):
        top_attack_types.append({
            "name": t_name,
            "count": count,
            "percentage": round((count / denom) * 100, 1),
            "color": palette[idx % len(palette)]
        })

    # 6. Top Attack Sources
    source_stats: Dict[str, Dict[str, Any]] = {}
    severity_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    for a in cur_attacks:
        ip = a.source_ip or "Unknown IP"
        if ip not in source_stats:
            source_stats[ip] = {
                "source_ip": ip,
                "event_count": 0,
                "highest_severity": "LOW",
                "last_seen": a.created_at,
                "country": a.country or "Unknown",
                "city": a.city or "Unknown"
            }
        source_stats[ip]["event_count"] += 1
        current_rank = severity_rank.get(str(source_stats[ip]["highest_severity"]).upper(), 1)
        event_rank = severity_rank.get(str(a.severity).upper(), 1)
        if event_rank > current_rank:
            source_stats[ip]["highest_severity"] = str(a.severity).upper()
        if a.created_at > source_stats[ip]["last_seen"]:
            source_stats[ip]["last_seen"] = a.created_at

    top_attack_sources = []
    sorted_sources = sorted(source_stats.values(), key=lambda x: x["event_count"], reverse=True)[:5]
    for s in sorted_sources:
        top_attack_sources.append({
            "source_ip": s["source_ip"],
            "event_count": s["event_count"],
            "highest_severity": s["highest_severity"],
            "last_seen": s["last_seen"].strftime("%Y-%m-%d %H:%M"),
            "last_seen_iso": s["last_seen"].isoformat(),
            "country": s["country"],
            "city": s["city"]
        })

    # 7. Priority Incidents / Events
    priority_incidents = []
    # Merge correlated incidents and high/critical attack events
    for inc in cur_incidents[:4]:
        priority_incidents.append({
            "id": inc.id,
            "type": "incident",
            "severity": str(inc.severity).upper(),
            "timestamp": inc.created_at.strftime("%Y-%m-%d %H:%M"),
            "timestamp_iso": inc.created_at.isoformat(),
            "source": "Multiple Nodes" if not cur_attacks else cur_attacks[0].source_ip,
            "attack_type": inc.title,
            "target": "Infrastructure Chain",
            "action": str(inc.status).upper(),
            "threat_score": float(inc.confidence * 10.0),
            "payload": inc.description or "Correlated multi-stage attack detection"
        })

    # Add top critical / high attack events
    for a in cur_attacks[:8]:
        if len(priority_incidents) >= 8:
            break
        priority_incidents.append({
            "id": a.id,
            "type": "attack_event",
            "severity": str(a.severity).upper(),
            "timestamp": a.created_at.strftime("%Y-%m-%d %H:%M"),
            "timestamp_iso": a.created_at.isoformat(),
            "source": a.source_ip,
            "attack_type": a.attack_type,
            "target": a.target_service or f"Port {a.destination_port}",
            "action": "BLOCKED" if str(a.status).upper() in ("RESOLVED", "BLOCKED") else "INTERCEPTED",
            "threat_score": float(a.threat_score or 5.0),
            "payload": a.payload or "Malicious request signature intercepted."
        })

    # Sort priority incidents by severity rank then timestamp
    priority_incidents.sort(
        key=lambda x: (severity_rank.get(x["severity"], 1), x["timestamp_iso"]),
        reverse=True
    )

    # 8. Deterministic Executive Summary
    range_label = "Last 24 Hours" if time_range == "24h" else ("Last 30 Days" if time_range == "30d" else ("Custom Period" if time_range == "custom" else "Last 7 Days"))
    summary_payload = {
        "total_events": total_events,
        "unique_sources": unique_sources,
        "critical_high_events": crit_high_events,
        "blocked_events": blocked_events,
        "attack_trend_level": trend_level,
        "attack_trend_desc": trend_desc,
        "range_label": range_label,
        "top_attack_types": top_attack_types,
        "top_attack_sources": top_attack_sources
    }
    deterministic_summary = _build_deterministic_executive_summary(summary_payload)

    return {
        "time_range": time_range,
        "range_label": range_label,
        "start_time": cur_start.isoformat(),
        "end_time": cur_end.isoformat(),
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "kpis": {
            "total_events": {
                "count": total_events,
                "prev_count": prev_total_events,
                "diff_pct": diff_total_pct,
                "sparkline": sparkline_total
            },
            "unique_sources": {
                "count": unique_sources,
                "prev_count": prev_unique_sources,
                "diff_pct": diff_sources_pct,
                "sparkline": sparkline_sources
            },
            "critical_high_events": {
                "count": crit_high_events,
                "prev_count": prev_crit_high_events,
                "diff_pct": diff_crit_high_pct,
                "sparkline": sparkline_crit_high
            },
            "blocked_events": {
                "count": blocked_events,
                "prev_count": prev_blocked_events,
                "diff_pct": diff_blocked_pct,
                "sparkline": sparkline_blocked
            },
            "attack_trend": {
                "level": trend_level,
                "description": trend_desc,
                "diff_pct": diff_total_pct,
                "sparkline": sparkline_trend
            }
        },
        "timeline_series": timeline_series,
        "severity_distribution": severity_distribution,
        "top_attack_types": top_attack_types,
        "top_attack_sources": top_attack_sources,
        "priority_incidents": priority_incidents,
        "deterministic_summary": deterministic_summary
    }

@router.post("/ai-executive-summary")
async def generate_ai_executive_summary(
    payload: AIExecutiveSummaryPayload,
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Generate on-demand AI executive summary using Groq GPT-OSS 120B model."""
    cur_start, cur_end, _, _, _, _ = _resolve_time_bounds(payload.time_range, payload.start_date, payload.end_date)

    # Extract live analytics context
    attacks = db.query(AttackEvent).filter(AttackEvent.created_at >= cur_start, AttackEvent.created_at <= cur_end).all()
    total_events = len(attacks)
    sources = len(set(a.source_ip for a in attacks if a.source_ip))
    crit_high = sum(1 for a in attacks if str(a.severity).upper() in ("HIGH", "CRITICAL"))

    top_types: Dict[str, int] = {}
    for a in attacks:
        top_types[a.attack_type] = top_types.get(a.attack_type, 0) + 1
    top_type_str = ", ".join([f"{k} ({v})" for k, v in sorted(top_types.items(), key=lambda x: x[1], reverse=True)[:5]]) or "None"

    context_str = (
        f"Monitoring Period: {payload.time_range.upper()} ({cur_start.strftime('%Y-%m-%d')} to {cur_end.strftime('%Y-%m-%d')})\n"
        f"Total Ingress Attacks: {total_events}\n"
        f"Unique Attacker Sources: {sources}\n"
        f"Critical & High Priority Incidents: {crit_high}\n"
        f"Dominant Attack Vectors: {top_type_str}\n"
    )

    prompt = (
        f"You are a Senior Cyber Defense Principal at SentinelAI. Analyze the following verified SOC metrics:\n\n"
        f"```yaml\n{context_str}```\n\n"
        f"Generate a professional Executive Security Summary formatted in clean Markdown. Include:\n"
        f"### Strategic Assessment\n"
        f"### Vector & Threat Actor Analysis\n"
        f"### Defensive Posture & Mitigations\n"
        f"### Key Recommendations\n"
        f"Be direct, highly technical, and objective. Do NOT include thought processes, reasoning tags, or conversational fluff."
    )

    model_name = settings_service.get_setting(db, "default_groq_model", settings.DEFAULT_GROQ_MODEL)
    markdown_content = ""

    if settings.GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": "You are a Principal SOC Analyst generating executive security reports for SentinelAI."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.2
                    }
                )
                if resp.status_code == 200:
                    choices = resp.json().get("choices", [])
                    if choices:
                        raw_ai = choices[0].get("message", {}).get("content", "")
                        # Strip reasoning tags if present
                        cleaned = re.sub(r"<think>.*?</think>", "", raw_ai, flags=re.DOTALL).strip()
                        markdown_content = cleaned
        except Exception as e:
            logger.warning(f"Groq API error in executive summary generation: {e}")

    if not markdown_content:
        # Fallback to high quality deterministic synthesis
        summary_payload = {
            "total_events": total_events,
            "unique_sources": sources,
            "critical_high_events": crit_high,
            "blocked_events": sum(1 for a in attacks if str(a.status).upper() in ("RESOLVED", "BLOCKED")),
            "attack_trend_level": "High" if crit_high > 5 else "Moderate",
            "attack_trend_desc": f"{total_events} events processed",
            "range_label": f"{payload.time_range.upper()}"
        }
        markdown_content = _build_deterministic_executive_summary(summary_payload)

    return {
        "markdown": markdown_content,
        "model": model_name,
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    }

@router.get("/export-period-csv")
def export_period_csv(
    time_range: str = Query("7d", alias="range"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export all events matching the selected reporting period to CSV."""
    cur_start, cur_end, _, _, _, _ = _resolve_time_bounds(time_range, start_date, end_date)
    attacks = db.query(AttackEvent).filter(
        AttackEvent.created_at >= cur_start,
        AttackEvent.created_at <= cur_end
    ).order_by(AttackEvent.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", "Timestamp (UTC)", "Severity", "Attack Type",
        "Source IP", "Source Port", "Destination Port", "Protocol",
        "Target Service", "Status", "Threat Score", "Country", "City", "User Agent"
    ])

    for a in attacks:
        writer.writerow([
            a.id,
            a.created_at.isoformat(),
            a.severity,
            a.attack_type,
            a.source_ip,
            a.source_port or "",
            a.destination_port,
            a.protocol or "",
            a.target_service or "",
            a.status,
            a.threat_score,
            a.country or "",
            a.city or "",
            a.user_agent or ""
        ])

    csv_content = output.getvalue()
    filename = f"sentinel_security_report_{range}_{cur_start.strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/generate-ai-summary")
async def generate_ai_summary(
    payload: GenerateReportPayload,
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Query object details, invoke synthesis, save markdown, and record jobs."""
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

    model_name = settings_service.get_setting(db, "default_groq_model", settings.DEFAULT_GROQ_MODEL)
    markdown_content = ""
    if settings.GROQ_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": "You are a senior cyber security principal generating official SentinelAI security compliance logs."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.2
                    }
                )
                if resp.status_code == 200:
                    choices = resp.json().get("choices", [])
                    if choices:
                        markdown_content = choices[0].get("message", {}).get("content", "")
                        markdown_content = re.sub(r"<think>.*?</think>", "", markdown_content, flags=re.DOTALL).strip()
        except Exception as e:
            logger.warning(f"Groq API synthesis error during report generation, using template fallback: {e}")

    # Fallback to local markdown template if synthesis timed out/failed
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
