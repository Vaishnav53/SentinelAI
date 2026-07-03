import httpx
import logging
import json
import re
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
from backend.core.config import settings
from backend.database.session import get_db
from backend.core.registry import get_settings_service
from backend.models.models import AIConversation, AIMessage, AttackEvent
from backend.schemas.agent import (
    ChatRequest, 
    ChatResponse, 
    AgentStatus, 
    ConversationRead, 
    ConversationDetail, 
    AnalysisResponse
)

async def resolve_ollama_model_name(model_name: str) -> str:
    """Resolve requested base model name to the exact tag string returned by Ollama."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                available_tags = [m["name"] for m in resp.json().get("models", [])]
                if model_name not in available_tags:
                    for tag in available_tags:
                        if tag.split(':')[0] == model_name.split(':')[0]:
                            return tag
    except Exception as e:
        logging.warning(f"Ollama tags lookup failed: {e}")
    return model_name

router = APIRouter(prefix="/agent", tags=["AI Agent"])

@router.get("/status", response_model=AgentStatus)
async def get_agent_status(
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Verify Ollama status and fetch installed model names dynamically."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                raw_models = [model["name"] for model in data.get("models", [])]
                return AgentStatus(status="ONLINE", models_available=raw_models)
    except Exception as e:
        logging.warning(f"Ollama offline during status discovery: {e}")
        
    return AgentStatus(
        status="OFFLINE", 
        models_available=[]
    )

@router.get("/conversations", response_model=List[ConversationRead])
async def get_conversations(db: Session = Depends(get_db)):
    """Retrieve all conversations, sorted by created time descending."""
    return db.query(AIConversation).order_by(AIConversation.created_at.desc()).all()

@router.get("/conversations/{id}", response_model=ConversationDetail)
async def get_conversation_detail(id: int, db: Session = Depends(get_db)):
    """Retrieve details of a single conversation with its message threads."""
    conv = db.query(AIConversation).filter(AIConversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/conversations/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(id: int, db: Session = Depends(get_db)):
    """Delete a conversation and cascade message threads."""
    conv = db.query(AIConversation).filter(AIConversation.id == id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return None

@router.post("/chat/stream")
async def post_chat_stream(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Submit prompt to Copilot, returning a streaming response chunk-by-chunk."""
    raw_model = payload.model or settings_service.get_setting(db, "default_ollama_model", settings.DEFAULT_OLLAMA_MODEL)
    model_name = await resolve_ollama_model_name(raw_model)
    
    conv_key = payload.conversation_id
    linked_attack_id = payload.context.attack_id if payload.context else None
    linked_incident_id = payload.context.incident_id if payload.context else None
    linked_sandbox_id = payload.context.sandbox_file_id if payload.context else None
    linked_attacker_ip = payload.context.attacker_ip if payload.context else None
    
    if not conv_key:
        conv_key = f"conv_{int(datetime.utcnow().timestamp())}"
        
    conv = db.query(AIConversation).filter(AIConversation.conversation_key == conv_key).first()
    if not conv:
        conv = AIConversation(
            conversation_key=conv_key,
            title=payload.message[:40] + ("..." if len(payload.message) > 40 else ""),
            model_used=model_name,
            linked_attack_id=linked_attack_id
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=payload.message,
        model=model_name,
        latency=0.0
    )
    db.add(user_msg)
    db.commit()

    history_messages = db.query(AIMessage).filter(AIMessage.conversation_id == conv.id).order_by(AIMessage.created_at.asc()).all()
    messages_payload = []
    
    system_prompt = settings_service.get_setting(
        db, 
        "ollama_system_prompt", 
        "You are a cyber security SOC analyst. For security incidents and threat analyses, organize your response using exactly these sections in Markdown headers:\n### Threat Summary\n### MITRE ATT&CK\n### Confidence\n### Impact\n### Detection\n### Remediation\n### References\nBe direct, technical, and beginner-friendly. Do not mention any local templates or fallbacks."
    )
    
    incident_context = ""
    if linked_incident_id:
        from backend.models.models import CorrelatedIncident
        incident = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == linked_incident_id).first()
        if incident:
            incident_context = (
                f"\n\n[CORRELATED THREAT CHAIN CONTEXT]\n"
                f"Incident ID: ID-{incident.id}\n"
                f"Title: {incident.title}\n"
                f"Severity: {incident.severity} | Confidence: {int(incident.confidence*100)}% | Status: {incident.status}\n"
                f"Description: {incident.description}\n"
                f"Network Node Entities:\n{incident.nodes_data}\n"
                f"Incident Timeline Path:\n{incident.timeline_data}\n"
                f"[END CONTEXT]"
            )

    sandbox_context = ""
    if linked_sandbox_id:
        from backend.models.models import DecoySandboxFile
        sfile = db.query(DecoySandboxFile).filter(DecoySandboxFile.id == linked_sandbox_id).first()
        if sfile:
            sandbox_context = (
                f"\n\n[SANDBOX FILE ANALYSIS CONTEXT]\n"
                f"File ID: ID-{sfile.id}\n"
                f"Filename: {sfile.filename}\n"
                f"File Size: {sfile.size_bytes} bytes\n"
                f"MD5: {sfile.md5}\n"
                f"SHA-1: {sfile.sha1}\n"
                f"SHA-256: {sfile.sha256}\n"
                f"Status: {sfile.status} | Threat Score: {sfile.threat_score * 10.0}/10.0\n"
                f"Malware Description: {sfile.malware_description or 'None'}\n"
                f"VirusTotal Reputation: {sfile.vt_reputation or 'Unknown'}\n"
                f"Source Attacker IP: {sfile.ip_address}\n"
                f"[END CONTEXT]"
            )

    attacker_context = ""
    if linked_attacker_ip:
        from backend.services.attacker_profiling import AttackerProfilingService
        profiler = AttackerProfilingService(db)
        profile = profiler.get_attacker_profile(linked_attacker_ip)
        if profile:
            attacker_context = (
                f"\n\n[ATTACKER THREAT PROFILE CONTEXT]\n"
                f"Attacker IP: {profile['ip_address']}\n"
                f"GeoIP Location: {profile['city']}, {profile['country']}\n"
                f"Total Attacks: {profile['attack_count']} | WAF interceptions: {profile['waf_count']} | Decoy uploads: {profile['sandbox_count']}\n"
                f"Currently Blocked: {profile['is_blocked']}\n"
                f"Observed MITRE Techniques:\n{json.dumps(profile['mitre_techniques'])}\n"
                f"Recent Timeline path:\n{json.dumps(profile['timeline'][:10])}\n"
                f"[END CONTEXT]"
            )
            
    messages_payload.append({"role": "system", "content": system_prompt + incident_context + sandbox_context + attacker_context})
    
    for msg in history_messages:
        messages_payload.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.content
        })

    # Dynamically verify installed models before running call
    installed_models = []
    is_ollama_online = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                is_ollama_online = True
                installed_models = [m["name"] for m in resp.json().get("models", [])]
    except Exception as e:
        logging.warning(f"Ollama connection check failed: {e}")

    async def generate_response():
        start_time = datetime.utcnow()
        response_text = ""
        source = "ollama"
        
        # 1. If Ollama is online, but model is not installed -> yield explicit error and terminate
        if is_ollama_online:
            if model_name not in installed_models:
                error_msg = "Selected model is not installed. Please choose an available model."
                yield f"data: {json.dumps({'text': error_msg, 'done': True, 'error': True, 'conversation_id': conv_key, 'model': model_name, 'latency': 0.0, 'source': 'ollama'})}\n\n"
                
                # Save the error message in the DB
                ai_msg = AIMessage(
                    conversation_id=conv.id,
                    role="assistant",
                    content=error_msg,
                    model=model_name,
                    latency=0.0
                )
                db.add(ai_msg)
                db.commit()
                return

        # 2. If Ollama is completely offline, fall back to offline simulation
        if not is_ollama_online:
            source = "fallback"
            fallback_full_text = ""
            msg_lower = payload.message.lower()
            if linked_incident_id:
                from backend.models.models import CorrelatedIncident
                incident = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == linked_incident_id).first()
                if incident:
                    fallback_full_text = f"""### Threat Summary
The logs describe a multi-stage correlated threat chain ('{incident.title}') targeting network assets. This includes brute-force credentials login success, privilege escalation, or dynamic WAF blocks.

### MITRE ATT&CK
* T1110 - Brute Force Authentication
* T1078 - Valid Accounts Usage
* T1190 - Exploit Public-Facing Application

### Confidence
High ({int(incident.confidence * 100)}%)

### Impact
Critical severity compromise. The attacker successfully authenticated or escalated privileges, indicating potential unauthorized data exfiltration or host takeover.

### Detection
Correlate repeated SSH/HTTP login failures (Event ID 4625) with subsequent logins (Event ID 4624) or sudo actions within short time windows.

### Remediation
1. Force password resets for the compromised credential handles.
2. Isolate the affected host node immediately using the containment dashboard.
3. Review audit logs for unauthorized active background processes.

### References
{incident.description}"""
            elif linked_sandbox_id:
                from backend.models.models import DecoySandboxFile
                sfile = db.query(DecoySandboxFile).filter(DecoySandboxFile.id == linked_sandbox_id).first()
                if sfile:
                    fallback_full_text = f"""### Threat Summary
A sandbox threat analysis was conducted on uploaded file '{sfile.filename}'. The scanner flagged this payload as {sfile.status} (threat score {sfile.threat_score * 10.0}/10.0) based on dangerous extension patterns, binary heuristics, or VirusTotal hashes database hits.

### MITRE ATT&CK
* T1204.002 - User Execution: Malicious File
* T1059 - Command and Scripting Interpreter

### Confidence
High (98%)

### Impact
Possible arbitrary shell execution, trojan drops, or macros bypass access. If execution succeeded outside the decoy sandbox, it could trigger remote control.

### Detection
Monitor host directories (especially web upload endpoints) for file signatures matching:
* MD5: `{sfile.md5}`
* SHA-256: `{sfile.sha256}`

### Remediation
1. Purge this payload from sandbox workspace directory.
2. Maintain strict extension blocking (WAF manager policy block) targeting IP {sfile.ip_address}.
3. Re-verify server upload folder execution permissions (disallow executable bits).

### References
{sfile.malware_description or 'No further descriptions.'}"""
            elif linked_attacker_ip:
                from backend.services.attacker_profiling import AttackerProfilingService
                profiler = AttackerProfilingService(db)
                profile = profiler.get_attacker_profile(linked_attacker_ip)
                if profile:
                    fallback_full_text = f"""### Threat Summary
A unified attacker profiling analysis was compiled for IP address '{profile['ip_address']}' (resolved location: {profile['city']}, {profile['country']}). The client was observed launching {profile['attack_count']} sensor attacks, triggering {profile['waf_count']} WAF blocks, and uploading {profile['sandbox_count']} decoy file payloads.

### MITRE ATT&CK
* T1110 - Brute Force (Credential Access)
* T1190 - Exploit Public-Facing Application (Initial Access)
* T1083 - File and Directory Discovery (Discovery)

### Confidence
High (96%)

### Impact
Multi-stage scanning, authentication bypass attempts, and potential server directory compromises. WAF state: {'Active Block' if profile['is_blocked'] else 'Not blocked'}.

### Detection
Correlate network ingress logs, honeypot telemetry feeds, and WAF rules triggers. Track attacker's progression from brute-forcing to sandbox payload drops.

### Remediation
1. Run playbooks such as 'Rapid Containment Block' to enforce uploader isolation blocks.
2. Cross-reference threat intelligence indexes (AbuseIPDB reputation lookup) for this IP.
3. Review audit trail logs of the incident drawer assignment for analyst notes.

### References
MITRE mapping signature count: {len(profile['mitre_techniques'])} techniques observed."""
            elif "explain" in msg_lower or "traversal" in msg_lower or "injection" in msg_lower:
                fallback_full_text = """### Threat Summary
The payload indicates an injection probe sequence (SQL Injection or Directory Traversal) targeting honeypot sensors.

### MITRE ATT&CK
T1190 - Exploit Public-Facing Application

### Confidence
High (95%)

### Impact
Unauthorized database exposure, server configuration file read, or authentication bypass.

### Detection
Identify escape symbols (e.g., `' OR '1'='1` or `../etc/passwd`) in application access logs.

### Remediation
1. Sanitize all input values contextually.
2. Configure active Web Application Firewall (WAF) rule filters.

### References
CVE-2024-XXXX, OWASP Top 10 A03:2021-Injection"""
            elif "mitigat" in msg_lower or "prevent" in msg_lower:
                fallback_full_text = """### Threat Summary
Host security policy recommendations to secure honeyports and service channels.

### MITRE ATT&CK
T1059 - Command and Scripting Interpreter

### Confidence
High (90%)

### Impact
System hijacking, shell execution, or remote system commands exposure.

### Detection
Track anomalous parent-child process paths (e.g., web server spawning bash shell).

### Remediation
1. Bind ports exclusively to loopback interface (e.g., 127.0.0.1).
2. Configure fail2ban blocking rules for malicious probing IPs.

### References
SOC Defense Handbook Section 4.2"""
            else:
                fallback_full_text = """### Threat Summary
Ollama response request has timed out.

### MITRE ATT&CK
N/A

### Confidence
N/A

### Impact
Latency in threat response telemetry delivery.

### Detection
Check uvicorn and ollama daemon container log levels.

### Remediation
The local AI model is online but responded too slowly. Try using a smaller model, lower max tokens, or run Ollama with GPU acceleration.

### References
SentinelAI System Performance Guide"""
            
            words = fallback_full_text.split(" ")
            for idx, word in enumerate(words):
                space = " " if idx < len(words) - 1 else ""
                text_chunk = f"{word}{space}"
                response_text += text_chunk
                yield f"data: {json.dumps({'text': text_chunk, 'done': False, 'conversation_id': conv_key, 'model': model_name})}\n\n"
                await asyncio.sleep(0.03)
        else:
            # Call Ollama API
            ollama_url = f"{settings.OLLAMA_BASE_URL}/api/chat"
            timeout_seconds = float(settings_service.get_setting(db, "ollama_timeout_seconds", 90.0))
            temperature = payload.temperature if payload.temperature is not None else 0.7
            max_tokens = payload.max_tokens if payload.max_tokens is not None else 256
            
            try:
                async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                    async with client.stream(
                        "POST",
                        ollama_url,
                        json={
                            "model": model_name,
                            "messages": messages_payload,
                            "options": {
                                "num_predict": max_tokens,
                                "temperature": temperature,
                                "top_p": 0.9,
                                "repeat_penalty": 1.1
                            },
                            "stream": True
                        }
                    ) as response:
                        if response.status_code == 200:
                            async for line in response.aiter_lines():
                                if not line:
                                    continue
                                try:
                                    chunk_json = json.loads(line)
                                    text_chunk = chunk_json.get("message", {}).get("content", "")
                                    if text_chunk:
                                        response_text += text_chunk
                                        yield f"data: {json.dumps({'text': text_chunk, 'done': False, 'conversation_id': conv_key, 'model': model_name})}\n\n"
                                except Exception:
                                    pass
                        else:
                            raise Exception(f"Ollama stream status {response.status_code}")
            except Exception as e:
                source = "fallback"
                error_name = type(e).__name__
                logging.warning(f"Ollama stream error mid-connection ({error_name}): {str(e)}.")
                yield f"data: {json.dumps({'text': f'\\n[Stream Interrupted: {error_name}]', 'done': True, 'error': True, 'conversation_id': conv_key, 'model': model_name, 'latency': 0.0, 'source': 'ollama'})}\n\n"
                return
        
        latency = (datetime.utcnow() - start_time).total_seconds()
        
        # Save finished response in DB
        ai_msg = AIMessage(
            conversation_id=conv.id,
            role="assistant",
            content=response_text,
            model=model_name,
            latency=latency
        )
        db.add(ai_msg)
        db.commit()
            
        yield f"data: {json.dumps({'text': '', 'done': True, 'conversation_id': conv_key, 'model': model_name, 'latency': latency, 'source': source})}\n\n"

    return StreamingResponse(
        generate_response(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/chat", response_model=ChatResponse)
async def post_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Submit prompt to Copilot, persisting conversations in SQLite db."""
    start_time = datetime.utcnow()
    raw_model = payload.model or settings_service.get_setting(db, "default_ollama_model", settings.DEFAULT_OLLAMA_MODEL)
    model_name = await resolve_ollama_model_name(raw_model)
    
    # 1. Retrieve or Create AIConversation context
    conv_key = payload.conversation_id
    linked_attack_id = payload.context.attack_id if payload.context else None
    linked_incident_id = payload.context.incident_id if payload.context else None
    linked_sandbox_id = payload.context.sandbox_file_id if payload.context else None
    linked_attacker_ip = payload.context.attacker_ip if payload.context else None
    
    if not conv_key:
        conv_key = f"conv_{int(datetime.utcnow().timestamp())}"
        
    conv = db.query(AIConversation).filter(AIConversation.conversation_key == conv_key).first()
    if not conv:
        conv = AIConversation(
            conversation_key=conv_key,
            title=payload.message[:40] + ("..." if len(payload.message) > 40 else ""),
            model_used=model_name,
            linked_attack_id=linked_attack_id
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # 2. Persist User Message
    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=payload.message,
        model=model_name,
        latency=0.0
    )
    db.add(user_msg)
    db.commit()

    # 3. Formulate Prompt History
    history_messages = db.query(AIMessage).filter(AIMessage.conversation_id == conv.id).order_by(AIMessage.created_at.asc()).all()
    
    messages_payload = []
    # System Prompt Directive
    system_prompt = settings_service.get_setting(
        db, 
        "ollama_system_prompt", 
        "You are a cyber security SOC analyst. For security incidents and threat analyses, organize your response using exactly these sections in Markdown headers:\n### Threat Summary\n### MITRE ATT&CK\n### Confidence\n### Impact\n### Detection\n### Remediation\n### References\nBe direct, technical, and beginner-friendly. Do not mention any local templates or fallbacks."
    )
    
    incident_context = ""
    if linked_incident_id:
        from backend.models.models import CorrelatedIncident
        incident = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == linked_incident_id).first()
        if incident:
            incident_context = (
                f"\n\n[CORRELATED THREAT CHAIN CONTEXT]\n"
                f"Incident ID: ID-{incident.id}\n"
                f"Title: {incident.title}\n"
                f"Severity: {incident.severity} | Confidence: {int(incident.confidence*100)}% | Status: {incident.status}\n"
                f"Description: {incident.description}\n"
                f"Network Node Entities:\n{incident.nodes_data}\n"
                f"Incident Timeline Path:\n{incident.timeline_data}\n"
                f"[END CONTEXT]"
            )
            
    sandbox_context = ""
    if linked_sandbox_id:
        from backend.models.models import DecoySandboxFile
        sfile = db.query(DecoySandboxFile).filter(DecoySandboxFile.id == linked_sandbox_id).first()
        if sfile:
            sandbox_context = (
                f"\n\n[SANDBOX FILE ANALYSIS CONTEXT]\n"
                f"File ID: ID-{sfile.id}\n"
                f"Filename: {sfile.filename}\n"
                f"File Size: {sfile.size_bytes} bytes\n"
                f"MD5: {sfile.md5}\n"
                f"SHA-1: {sfile.sha1}\n"
                f"SHA-256: {sfile.sha256}\n"
                f"Status: {sfile.status} | Threat Score: {sfile.threat_score * 10.0}/10.0\n"
                f"Malware Description: {sfile.malware_description or 'None'}\n"
                f"VirusTotal Reputation: {sfile.vt_reputation or 'Unknown'}\n"
                f"Source Attacker IP: {sfile.ip_address}\n"
                f"[END CONTEXT]"
            )

    attacker_context = ""
    if linked_attacker_ip:
        from backend.services.attacker_profiling import AttackerProfilingService
        profiler = AttackerProfilingService(db)
        profile = profiler.get_attacker_profile(linked_attacker_ip)
        if profile:
            attacker_context = (
                f"\n\n[ATTACKER THREAT PROFILE CONTEXT]\n"
                f"Attacker IP: {profile['ip_address']}\n"
                f"GeoIP Location: {profile['city']}, {profile['country']}\n"
                f"Total Attacks: {profile['attack_count']} | WAF interceptions: {profile['waf_count']} | Decoy uploads: {profile['sandbox_count']}\n"
                f"Currently Blocked: {profile['is_blocked']}\n"
                f"Observed MITRE Techniques:\n{json.dumps(profile['mitre_techniques'])}\n"
                f"Recent Timeline path:\n{json.dumps(profile['timeline'][:10])}\n"
                f"[END CONTEXT]"
            )
            
    messages_payload.append({"role": "system", "content": system_prompt + incident_context + sandbox_context + attacker_context})
    
    # Historical turns
    for msg in history_messages:
        messages_payload.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.content
        })

    # 4. Attempt Ollama Call
    response_text = ""
    source = "model"
    ollama_url = f"{settings.OLLAMA_BASE_URL}/api/chat"
    timeout_seconds = float(settings_service.get_setting(db, "ollama_timeout_seconds", 90.0))
    
    # Custom options
    temperature = payload.temperature if payload.temperature is not None else 0.7
    max_tokens = payload.max_tokens if payload.max_tokens is not None else 256
    
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                ollama_url,
                json={
                    "model": model_name,
                    "messages": messages_payload,
                    "options": {
                        "num_predict": max_tokens,
                        "temperature": temperature,
                        "top_p": 0.9,
                        "repeat_penalty": 1.1
                    },
                    "stream": False
                }
            )
            if response.status_code == 200:
                data = response.json()
                response_text = data.get("message", {}).get("content", "")
    except Exception as e:
        source = "fallback"
        error_name = type(e).__name__
        logging.warning(f"Ollama chat error ({error_name}): {str(e)}. Executing fallback.", exc_info=True)
        if "Timeout" in error_name:
            response_text = "The local AI model is online but responded too slowly. Try using a smaller model, lower max tokens, or run Ollama with GPU acceleration."
        else:
            response_text = "Security Copilot is currently offline. Ensure Ollama is running locally."

    # 5. Local Mock Fallback if Ollama Offline/Timed Out or returns empty
    if not response_text:
        source = "fallback"
        msg_lower = payload.message.lower()
        if linked_incident_id:
            from backend.models.models import CorrelatedIncident
            incident = db.query(CorrelatedIncident).filter(CorrelatedIncident.id == linked_incident_id).first()
            if incident:
                response_text = f"""### Threat Summary
The logs describe a multi-stage correlated threat chain ('{incident.title}') targeting network assets. This includes brute-force credentials login success, privilege escalation, or dynamic WAF blocks.

### MITRE ATT&CK
* T1110 - Brute Force Authentication
* T1078 - Valid Accounts Usage
* T1190 - Exploit Public-Facing Application

### Confidence
High ({int(incident.confidence * 100)}%)

### Impact
Critical severity compromise. The attacker successfully authenticated or escalated privileges, indicating potential unauthorized data exfiltration or host takeover.

### Detection
Correlate repeated SSH/HTTP login failures (Event ID 4625) with subsequent logins (Event ID 4624) or sudo actions within short time windows.

### Remediation
1. Force password resets for the compromised credential handles.
2. Isolate the affected host node immediately using the containment dashboard.
3. Review audit logs for unauthorized active background processes.

### References
{incident.description}"""
        elif linked_sandbox_id:
            from backend.models.models import DecoySandboxFile
            sfile = db.query(DecoySandboxFile).filter(DecoySandboxFile.id == linked_sandbox_id).first()
            if sfile:
                response_text = f"""### Threat Summary
A sandbox threat analysis was conducted on uploaded file '{sfile.filename}'. The scanner flagged this payload as {sfile.status} (threat score {sfile.threat_score * 10.0}/10.0) based on dangerous extension patterns, binary heuristics, or VirusTotal hashes database hits.

### MITRE ATT&CK
* T1204.002 - User Execution: Malicious File
* T1059 - Command and Scripting Interpreter

### Confidence
High (98%)

### Impact
Possible arbitrary shell execution, trojan drops, or macros bypass access. If execution succeeded outside the decoy sandbox, it could trigger remote control.

### Detection
Monitor host directories (especially web upload endpoints) for file signatures matching:
* MD5: `{sfile.md5}`
* SHA-256: `{sfile.sha256}`

### Remediation
1. Purge this payload from sandbox workspace directory.
2. Maintain strict extension blocking (WAF manager policy block) targeting IP {sfile.ip_address}.
3. Re-verify server upload folder execution permissions (disallow executable bits).

### References
{sfile.malware_description or 'No further descriptions.'}"""
        elif linked_attacker_ip:
            from backend.services.attacker_profiling import AttackerProfilingService
            profiler = AttackerProfilingService(db)
            profile = profiler.get_attacker_profile(linked_attacker_ip)
            if profile:
                response_text = f"""### Threat Summary
A unified attacker profiling analysis was compiled for IP address '{profile['ip_address']}' (resolved location: {profile['city']}, {profile['country']}). The client was observed launching {profile['attack_count']} sensor attacks, triggering {profile['waf_count']} WAF blocks, and uploading {profile['sandbox_count']} decoy file payloads.

### MITRE ATT&CK
* T1110 - Brute Force (Credential Access)
* T1190 - Exploit Public-Facing Application (Initial Access)
* T1083 - File and Directory Discovery (Discovery)

### Confidence
High (96%)

### Impact
Multi-stage scanning, authentication bypass attempts, and potential server directory compromises. WAF state: {'Active Block' if profile['is_blocked'] else 'Not blocked'}.

### Detection
Correlate network ingress logs, honeypot telemetry feeds, and WAF rules triggers. Track attacker's progression from brute-forcing to sandbox payload drops.

### Remediation
1. Run playbooks such as 'Rapid Containment Block' to enforce uploader isolation blocks.
2. Cross-reference threat intelligence indexes (AbuseIPDB reputation lookup) for this IP.
3. Review audit trail logs of the incident drawer assignment for analyst notes.

### References
MITRE mapping signature count: {len(profile['mitre_techniques'])} techniques observed."""
        elif "explain" in msg_lower or "traversal" in msg_lower or "injection" in msg_lower:
            response_text = """### Threat Summary
The payload indicates an injection probe sequence (SQL Injection or Directory Traversal) targeting honeypot sensors.

### MITRE ATT&CK
T1190 - Exploit Public-Facing Application

### Confidence
High (95%)

### Impact
Unauthorized database exposure, server configuration file read, or authentication bypass.

### Detection
Identify escape symbols (e.g., `' OR '1'='1` or `../etc/passwd`) in application access logs.

### Remediation
1. Sanitize all input values contextually.
2. Configure active Web Application Firewall (WAF) rule filters.

### References
CVE-2024-XXXX, OWASP Top 10 A03:2021-Injection"""
        elif "mitigat" in msg_lower or "prevent" in msg_lower:
            response_text = """### Threat Summary
Host security policy recommendations to secure honeyports and service channels.

### MITRE ATT&CK
T1059 - Command and Scripting Interpreter

### Confidence
High (90%)

### Impact
System hijacking, shell execution, or remote system commands exposure.

### Detection
Track anomalous parent-child process paths (e.g., web server spawning bash shell).

### Remediation
1. Bind ports exclusively to loopback interface (e.g., 127.0.0.1).
2. Configure fail2ban blocking rules for malicious probing IPs.

### References
SOC Defense Handbook Section 4.2"""
        else:
            response_text = """### Threat Summary
Ollama response request has timed out.

### MITRE ATT&CK
N/A

### Confidence
N/A

### Impact
Latency in threat response telemetry delivery.

### Detection
Check uvicorn and ollama daemon container log levels.

### Remediation
The local AI model is online but responded too slowly. Try using a smaller model, lower max tokens, or run Ollama with GPU acceleration.

### References
SentinelAI System Performance Guide"""

    # 6. Save AI Response in DB
    latency = (datetime.utcnow() - start_time).total_seconds()
    ai_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=response_text,
        model=model_name,
        latency=latency
    )
    db.add(ai_msg)
    db.commit()

    return ChatResponse(
        message=response_text,
        conversation_id=conv.conversation_key,
        model=model_name,
        created_at=datetime.utcnow(),
        latency=latency,
        source=source
    )

@router.post("/analyze/{attack_id}", response_model=AnalysisResponse)
async def analyze_attack(
    attack_id: int,
    db: Session = Depends(get_db),
    settings_service = Depends(get_settings_service)
):
    """Retrieve threat parameters, build dynamic prompt, and analyze log context."""
    start_time = datetime.utcnow()
    attack = db.query(AttackEvent).filter(AttackEvent.id == attack_id).first()
    if not attack:
        raise HTTPException(status_code=404, detail="Attack event not found")

    raw_model = settings_service.get_setting(db, "default_ollama_model", settings.DEFAULT_OLLAMA_MODEL)
    model_name = await resolve_ollama_model_name(raw_model)
    conv_key = f"analysis_attack_{attack_id}"
    
    # 1. Retrieve or Create Conversation
    conv = db.query(AIConversation).filter(AIConversation.conversation_key == conv_key).first()
    if not conv:
        conv = AIConversation(
            conversation_key=conv_key,
            title=f"Attack Analysis: {attack.attack_type}",
            model_used=model_name,
            linked_attack_id=attack_id
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # 2. Formulate Prompt
    mitre_id = "N/A"
    recommendation = "No custom recommendations."
    if attack.raw_metadata:
        try:
            meta = json.loads(attack.raw_metadata)
            mitre_id = meta.get("mitre_id", "N/A")
            recommendation = meta.get("recommendation", "No custom recommendations.")
        except:
            pass

    prompt = f"""[SYSTEM DIRECTIVE: ZERO-TRUST SOC COPILET]
You are a highly experienced SOC analyst investigating a telemetry event.

--- ATTACK TELEMETRY EVENT ---
Attack Type: {attack.attack_type}
Severity: {attack.severity}
Source IP: {attack.source_ip}:{attack.source_port}
Target Service: {attack.target_service} on Port {attack.destination_port}
Protocol: {attack.protocol}
Threat Score: {attack.threat_score}/10
Confidence: {attack.confidence * 100}%
MITRE ATT&CK Mapping: {mitre_id}
Recommendation: {recommendation}

--- CAPTURED REQUEST PAYLOAD ---
{attack.payload}

Format your markdown response using exactly these headings:
1. EXECUTIVE SUMMARY
2. TECHNICAL EXPLANATION
3. RISK LEVEL
4. MITRE MAPPING
5. POTENTIAL IMPACT
6. RECOMMENDED ACTIONS
7. CONTAINMENT
8. RECOVERY STEPS
9. REFERENCES

Begin the analysis now:"""

    # 3. Save User Prompt Message
    db.query(AIMessage).filter(AIMessage.conversation_id == conv.id).delete() # Refresh context
    user_msg = AIMessage(
        conversation_id=conv.id,
        role="user",
        content=f"Analyze attack event {attack.id}",
        model=model_name,
        latency=0.0
    )
    db.add(user_msg)
    db.commit()

    # 4. Attempt Ollama Analysis Call
    response_text = ""
    source = "model"
    ollama_url = f"{settings.OLLAMA_BASE_URL}/api/chat"
    timeout_seconds = float(settings_service.get_setting(db, "ollama_timeout_seconds", 90.0))
    
    messages_payload = [
        {"role": "system", "content": "SYSTEM DIRECTIVE: ZERO-TRUST SOC COPILET. You are a highly experienced SOC analyst investigating a threat event. Respond using the requested markdown headings structure."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                ollama_url,
                json={
                    "model": model_name, 
                    "messages": messages_payload, 
                    "options": {
                        "num_predict": 512,
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "repeat_penalty": 1.1
                    },
                    "stream": False
                }
            )
            if response.status_code == 200:
                data = response.json()
                response_text = data.get("message", {}).get("content", "")
    except Exception as e:
        error_name = type(e).__name__
        logging.warning(f"Ollama analyze failed ({error_name}): {str(e)}. Executing fallback.", exc_info=True)
        if "Timeout" in error_name:
            response_text = "### EXECUTIVE SUMMARY\nThe local AI model is online but responded too slowly. Try using a smaller model, lower max tokens, or run Ollama with GPU acceleration."
        else:
            response_text = "### EXECUTIVE SUMMARY\nSecurity Copilot is currently offline. Ensure Ollama is running locally."

    # 5. Fallback Mock response dictionary
    parsed_json = {}
    if response_text and "timed out" not in response_text and "offline" not in response_text:
        parsed_json = parse_markdown_analysis(response_text, conv_key)
    else:
        source = "fallback"
        parsed_json = get_mock_analysis(attack, conv_key)
        if response_text:
            parsed_json["executive_summary"] = response_text.replace("### EXECUTIVE SUMMARY\n", "")
        # Format mock response for message log
        response_text = f"""### EXECUTIVE SUMMARY
{parsed_json['executive_summary']}

### TECHNICAL EXPLANATION
{parsed_json['technical_explanation']}

### RISK LEVEL
{parsed_json['risk_level']}

### MITRE MAPPING
{parsed_json['mitre_mapping']}

### POTENTIAL IMPACT
{parsed_json['potential_impact']}

### RECOMMENDED ACTIONS
{parsed_json['recommended_actions']}

### CONTAINMENT
{parsed_json['containment']}

### RECOVERY STEPS
{parsed_json['recovery_steps']}

### REFERENCES
{parsed_json['references']}"""

    # 6. Save Assistant Response Message
    latency = (datetime.utcnow() - start_time).total_seconds()
    ai_msg = AIMessage(
        conversation_id=conv.id,
        role="assistant",
        content=response_text,
        model=model_name,
        latency=latency
    )
    db.add(ai_msg)
    db.commit()

    parsed_json["source"] = source
    return parsed_json

def parse_markdown_analysis(text: str, conversation_id: str) -> dict:
    sections = {
        "executive_summary": "EXECUTIVE SUMMARY",
        "technical_explanation": "TECHNICAL EXPLANATION",
        "risk_level": "RISK LEVEL",
        "mitre_mapping": "MITRE MAPPING",
        "potential_impact": "POTENTIAL IMPACT",
        "recommended_actions": "RECOMMENDED ACTIONS",
        "containment": "CONTAINMENT",
        "recovery_steps": "RECOVERY STEPS",
        "references": "REFERENCES"
    }
    
    parsed = {}
    lines = text.split("\n")
    current_key = "executive_summary"
    current_content = []
    
    for line in lines:
        matched = False
        for key, heading in sections.items():
            if re.search(rf"(?i)(#+\s*|\b)({heading})\b", line):
                parsed[current_key] = "\n".join(current_content).strip()
                current_key = key
                current_content = []
                matched = True
                break
        if not matched:
            current_content.append(line)
            
    parsed[current_key] = "\n".join(current_content).strip()
    
    for key in sections.keys():
        if key not in parsed or not parsed[key]:
            parsed[key] = "Not specified. Refer to technical summary."
            
    parsed["conversation_id"] = conversation_id
    return parsed

def get_mock_analysis(attack, conversation_id: str) -> dict:
    attack_type = attack.attack_type.lower()
    
    if "sql" in attack_type:
        return {
            "executive_summary": "A high-severity SQL Injection (SQLi) signature was detected targeting port 8088. The incoming request query contained database structure probing keywords.",
            "technical_explanation": f"The attacker sent payload parameters containing raw SQL escaping syntax (e.g. ' OR '1'='1). This bypasses authentication validation by forcing the database interpreter to always evaluate conditions as true.",
            "risk_level": "CRITICAL",
            "mitre_mapping": "T1190 - Exploit Public-Facing Application / T1059 - Command and Scripting Interpreter",
            "potential_impact": "Full database exposure, administrative privilege escalation, data deletion, and unauthorized extraction of sensitive credentials.",
            "recommended_actions": "1. Implement prepared statements / parameterized queries. 2. Filter input strings using robust validation libraries.",
            "containment": f"Block the source IP {attack.source_ip} immediately in local security group firewalls.",
            "recovery_steps": "Audit database access logs. Rotate database credentials if any table access indicators are identified.",
            "references": "OWASP Top 10 - A03:2021 Injection, MITRE ATT&CK T1190",
            "conversation_id": conversation_id
        }
    elif "xss" in attack_type:
        return {
            "executive_summary": "A Cross-Site Scripting (XSS) payload was detected targeting comments endpoints. Interactive script tags were found in parameter fields.",
            "technical_explanation": f"The attacker input parameter string contained script tag elements (<script>alert(document.cookie)</script>). When rendered without encoding, browser executing modules run this raw script, allowing session theft.",
            "risk_level": "HIGH",
            "mitre_mapping": "T1189 - Drive-by Compromise",
            "potential_impact": "User session hijacking, administrative token extraction, UI defacement, and customer phishing redirects.",
            "recommended_actions": "Apply contextual output encoding (HTML, Javascript context escaping) and enforce Content Security Policies (CSP).",
            "containment": f"Reject requests from source IP {attack.source_ip}. Cleanse the database fields holding the raw text.",
            "recovery_steps": "Revoke target session tokens and prompt active users to re-authenticate.",
            "references": "OWASP Top 10 - A03:2021 Cross-Site Scripting, MITRE ATT&CK T1189",
            "conversation_id": conversation_id
        }
    elif "traversal" in attack_type:
        return {
            "executive_summary": "A Directory Traversal attack attempt was captured targeting file read parameters. URI sequences contained parent directory back-references.",
            "technical_explanation": f"The request path contained traversal characters (../../../../etc/passwd). This attempts to leverage weak folder permissions to read files outside the designated web root directory.",
            "risk_level": "CRITICAL",
            "mitre_mapping": "T1083 - File and Directory Discovery / T1190 - Exploit Public-Facing Application",
            "potential_impact": "Leaking of environment credentials, passwords database, settings details, and software source code.",
            "recommended_actions": "Use absolute path mappings, restrict read permissions to web-only directories, and validate input to prevent path back-references.",
            "containment": f"Block access to IP {attack.source_ip} using firewall tools.",
            "recovery_steps": "Check web server configuration logs to verify if path reads were successful (status codes 200 vs 403/404).",
            "references": "OWASP Top 10 - A05:2021 Security Misconfiguration, MITRE ATT&CK T1083",
            "conversation_id": conversation_id
        }
    else:
        return {
            "executive_summary": f"A Reconnaissance Probe or suspicious traffic was logged on port 8088 matching '{attack.attack_type}'.",
            "technical_explanation": f"The request payload did not contain known active exploit signatures, but matches general vulnerability scanner probes or search bot headers.",
            "risk_level": "LOW",
            "mitre_mapping": "T1595 - Active Scanning",
            "potential_impact": "Vulnerability scanning and target port mappings.",
            "recommended_actions": "Monitor IP address activity and restrict public port access.",
            "containment": f"Block the source IP {attack.source_ip} if it triggers recurrent requests.",
            "recovery_steps": "No system recovery actions needed. Monitor network logs.",
            "references": "MITRE ATT&CK T1595, OWASP Top 10 - A05:2021 Security Misconfiguration",
            "conversation_id": conversation_id
        }
