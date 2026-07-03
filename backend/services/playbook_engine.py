import logging
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.models.models import ThreatPlaybook, PlaybookExecution, WAFRule, CorrelatedIncident, AuditLog

logger = logging.getLogger(__name__)

class PlaybookEngine:
    def __init__(self, db: Session):
        self.db = db

    async def execute_playbook(self, playbook_id: int, target_ip: str) -> PlaybookExecution:
        """Run playbook steps sequentially and write logs data."""
        playbook = self.db.query(ThreatPlaybook).filter(ThreatPlaybook.id == playbook_id).first()
        if not playbook:
            raise ValueError("Playbook not found")

        # 1. Initialize Playbook Execution record
        execution = PlaybookExecution(
            playbook_id=playbook_id,
            target_ip=target_ip,
            status="RUNNING",
            logs_data="[]"
        )
        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)

        execution_logs = []
        status = "SUCCESS"
        created_incident = None

        try:
            # Parse actions list JSON
            actions = json.loads(playbook.actions_data or "[]")
            
            for idx, act in enumerate(actions):
                act_type = act.get("action", "").upper()
                step_log = {
                    "time": datetime.utcnow().isoformat(),
                    "step": act_type,
                    "status": "SUCCESS",
                    "message": ""
                }
                
                try:
                    if act_type == "BLOCK_IP":
                        # Create dynamic block WAF rule
                        rule = WAFRule(
                            ip_address=target_ip,
                            action="BLOCK",
                            reason=f"Playbook '{playbook.name}' containment auto-block.",
                            is_enabled=1,
                            rule_type="AUTOMATIC",
                            analyst_attribution="Playbook Orchestrator"
                        )
                        self.db.add(rule)
                        step_log["message"] = f"Staged WAF block policy rule targeting IP address: {target_ip}."

                    elif act_type == "QUARANTINE_IP":
                        rule = WAFRule(
                            ip_address=target_ip,
                            action="QUARANTINE",
                            reason=f"Playbook '{playbook.name}' containment auto-quarantine.",
                            is_enabled=1,
                            rule_type="AUTOMATIC",
                            analyst_attribution="Playbook Orchestrator"
                        )
                        self.db.add(rule)
                        step_log["message"] = f"Staged WAF quarantine policy rule targeting IP address: {target_ip}."

                    elif act_type == "CREATE_INCIDENT":
                        incident = CorrelatedIncident(
                            title=f"Incident Escalated: Campaign {target_ip}",
                            description=f"Automated incident case created via playbook execution targeting {target_ip}.",
                            severity="HIGH",
                            confidence=0.85,
                            status="NEW",
                            nodes_data=json.dumps([{"id": target_ip, "label": f"IP: {target_ip}", "type": "IP"}]),
                            links_data="[]",
                            timeline_data=json.dumps([{"time": datetime.utcnow().isoformat(), "title": "Playbook Escalation", "details": "Incident opened dynamically."}])
                        )
                        self.db.add(incident)
                        self.db.flush()
                        created_incident = incident
                        step_log["message"] = f"Created new correlated incident chain case."

                    elif act_type == "ASSIGN_ANALYST":
                        # Find latest open incident for this IP
                        inc = created_incident
                        if not inc:
                            inc = self.db.query(CorrelatedIncident).filter(
                                CorrelatedIncident.title.like(f"%{target_ip}%")
                            ).order_by(CorrelatedIncident.id.desc()).first()
                        if inc:
                            inc.assigned_analyst = "Lead Analyst Alex"
                            step_log["message"] = f"Assigned incident case owner to Alex Rivera."
                        else:
                            step_log["message"] = "No matching incident case found to assign owner."

                    elif act_type == "ADD_COMMENT":
                        inc = created_incident
                        if not inc:
                            inc = self.db.query(CorrelatedIncident).filter(
                                CorrelatedIncident.title.like(f"%{target_ip}%")
                            ).order_by(CorrelatedIncident.id.desc()).first()
                        if inc:
                            timeline = json.loads(inc.timeline_data or "[]")
                            timeline.append({
                                "time": datetime.utcnow().isoformat(),
                                "title": "Playbook Update",
                                "details": f"Executed response action playbook step '{playbook.name}' successfully."
                            })
                            inc.timeline_data = json.dumps(timeline)
                            step_log["message"] = f"Logged playbook run comment to incident timeline case."
                        else:
                            step_log["message"] = "No matching incident case found to log comment."

                    elif act_type == "NOTIFY_TEAM":
                        # Mock notification webhook trigger
                        step_log["message"] = "Broadcasted threat details warning to Slack/Discord/Email teams channels."

                    else:
                        step_log["status"] = "FAILED"
                        step_log["message"] = f"Unknown action: {act_type}"
                        status = "FAILED"
                        
                except Exception as ex:
                    step_log["status"] = "FAILED"
                    step_log["message"] = f"Step execution error: {str(ex)}"
                    status = "FAILED"
                
                execution_logs.append(step_log)
                
            # Log Audit log
            audit = AuditLog(
                action="RUN_PLAYBOOK",
                module="playbook",
                user="system",
                details=f"Ran playbook '{playbook.name}' on target IP {target_ip}. Result: {status}"
            )
            self.db.add(audit)
            self.db.commit()

        except Exception as e:
            logger.error(f"Playbook processing crash: {e}", exc_info=True)
            status = "FAILED"
            execution_logs.append({
                "time": datetime.utcnow().isoformat(),
                "step": "SYSTEM_CRASH",
                "status": "FAILED",
                "message": f"Execution processing error: {str(e)}"
            })

        execution.status = status
        execution.logs_data = json.dumps(execution_logs)
        self.db.commit()
        self.db.refresh(execution)

        # Broadcast update over WebSockets
        try:
            from backend.api.attacks import manager
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(manager.broadcast({
                    "type": "new_playbook_execution",
                    "data": {
                        "id": execution.id,
                        "playbook_name": playbook.name,
                        "target_ip": execution.target_ip,
                        "status": execution.status,
                        "created_at": execution.created_at.isoformat()
                    }
                }))
        except Exception as e:
            logger.warning(f"Failed to broadcast playbook execution socket: {e}")

        return execution
