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

def map_model_to_groq(model_name: str) -> str:
    """Map a local model name or custom input to a valid Groq model ID."""
    if not model_name:
        return settings.DEFAULT_GROQ_MODEL
    model_name_lower = model_name.lower()
    if "llama" in model_name_lower:
        if "70b" in model_name_lower or "versatile" in model_name_lower:
            return "llama-3.3-70b-versatile"
        return "llama-3.1-8b-instant"
    elif "qwen" in model_name_lower:
        return "llama-3.1-8b-instant"
    elif "mixtral" in model_name_lower:
        return "mixtral-8x7b-32768"
    elif "gemma" in model_name_lower:
        return "gemma2-9b-it"
    
    valid_groq_models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it", "llama3-8b-8192"]
    if model_name in valid_groq_models:
        return model_name
    return settings.DEFAULT_GROQ_MODEL

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
    """Verify Groq status and fetch available model names dynamically."""
    if not settings.GROQ_API_KEY:
        return AgentStatus(status="OFFLINE", models_available=[])
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
            )
            if response.status_code == 200:
                data = response.json()
                non_chat_patterns = ["whisper", "prompt-guard", "safeguard", "moderation", "audio", "speech", "embedding"]
                raw_models = [
                    model["id"] for model in data.get("data", [])
                    if not any(pat in model["id"].lower() for pat in non_chat_patterns)
                ]
                return AgentStatus(status="ONLINE", models_available=raw_models)
            else:
                logging.warning(f"Groq models lookup returned status code: {response.status_code}")
    except Exception as e:
        logging.warning(f"Groq offline during status discovery: {e}")
        
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
    model_name = map_model_to_groq(raw_model)
    
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
        "You are SentinelAI SOC Copilot, a senior cyber security SOC analyst. For security incidents and threat analyses, organize your response using exactly these sections in Markdown headers:\n### Threat Summary\n### MITRE ATT&CK\n### Confidence\n### Impact\n### Detection\n### Remediation\n### References\nFocus technical answers specifically on threat detection, incident response, IOC explanation, payload analysis, firewall/WAF rules, SIEM queries, and executive summaries. Be direct, technical, and beginner-friendly. For general conversational messages, respond in a friendly, conversational style without using these report headers. Do not mention any local templates or fallbacks."
    )
    
    attack_context = ""
    effective_attack_id = linked_attack_id or conv.linked_attack_id
    if effective_attack_id:
        from backend.models.models import AttackEvent
        attack = db.query(AttackEvent).filter(AttackEvent.id == effective_attack_id).first()
        if attack:
            attack_context = (
                f"\n\n[ATTACK EVENT CONTEXT]\n"
                f"Attack ID: {attack.id}\n"
                f"External ID: {attack.external_id}\n"
                f"Attack Type: {attack.attack_type}\n"
                f"Severity: {attack.severity} | Status: {attack.status}\n"
                f"Source: {attack.source_ip}:{attack.source_port} | Destination Port: {attack.destination_port}\n"
                f"Protocol: {attack.protocol} | Target Service: {attack.target_service}\n"
                f"GeoIP Location: {attack.city}, {attack.country}\n"
                f"Confidence: {int(attack.confidence*100)}% | Threat Score: {attack.threat_score}/100\n"
                f"Payload: {attack.payload or 'No payload data'}\n"
                f"User Agent: {attack.user_agent or 'Unknown'}\n"
                f"[END CONTEXT]"
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
            
    messages_payload.append({"role": "system", "content": system_prompt + attack_context + incident_context + sandbox_context + attacker_context})
    
    for msg in history_messages:
        messages_payload.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.content
        })

    # Check if Groq API is configured
    is_ollama_online = bool(settings.GROQ_API_KEY)

    async def generate_response():
        start_time = datetime.utcnow()
        response_text = ""
        source = "groq"

        # 2. If Ollama is completely offline, fall back to offline simulation
        if not is_ollama_online:
            source = "fallback"
            fallback_full_text = ""
            msg_lower = payload.message.lower().strip()
            
            # Simple conversational greeting checks
            greetings = ["hi", "hello", "hey", "greetings", "yo", "help", "who are you", "what are you"]
            is_greeting = any(g in msg_lower for g in greetings) or msg_lower in ["hi", "hello", "hey", "yo", "help"]
            
            if is_greeting and not linked_incident_id and not linked_sandbox_id and not linked_attacker_ip:
                fallback_full_text = (
                    "Hello! I am your SentinelAI SOC Assistant.\n\n"
                    "I am here to help you analyze honeypot telemetry, WAF rules alerts, correlated incident chains, "
                    "and decoy sandbox file uploads.\n\n"
                    "How can I assist you with your security operations today?"
                )
            elif linked_incident_id:
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
                fallback_full_text = f"""### ⚠️ Local AI Model Offline or Timed Out

I was unable to establish a timely connection with the local Ollama service.

**Possible Causes:**
1. **Ollama Service is Not Running:** Ensure that the Ollama application is active on your host system.
2. **Model Not Pulled:** The requested model (`{model_name}`) might not be downloaded. Run `ollama pull {model_name}` in your terminal.
3. **Hardware Latency:** Running larger LLMs on CPU can lead to timeouts.

**Recommended Troubleshooting:**
- Select a smaller, faster model (e.g., `llama3.2:1b`, `tinydolphin`, or `phi3`) from the dropdown above.
- Verify Ollama is running by executing: `curl http://127.0.0.1:11434/` in your command prompt.
- Increase the AI timeout threshold in Platform Settings."""
            
            words = fallback_full_text.split(" ")
            for idx, word in enumerate(words):
                space = " " if idx < len(words) - 1 else ""
                text_chunk = f"{word}{space}"
                response_text += text_chunk
                yield f"data: {json.dumps({'text': text_chunk, 'done': False, 'conversation_id': conv_key, 'model': model_name})}\n\n"
                await asyncio.sleep(0.03)
        else:
            # Call Groq API
            groq_url = "https://api.groq.com/openai/v1/chat/completions"
            timeout_seconds = float(settings_service.get_setting(db, "ollama_timeout_seconds", 90.0))
            temperature = payload.temperature if payload.temperature is not None else 0.7
            max_tokens = payload.max_tokens if payload.max_tokens is not None else 256
            
            try:
                async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                    async with client.stream(
                        "POST",
                        groq_url,
                        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                        json={
                            "model": model_name,
                            "messages": messages_payload,
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                            "top_p": 0.9,
                            "stream": True
                        }
                    ) as response:
                        if response.status_code == 200:
                            async for line in response.aiter_lines():
                                if not line:
                                    continue
                                line = line.strip()
                                if line.startswith("data:"):
                                    data_content = line[5:].strip()
                                    if data_content == "[DONE]":
                                        break
                                    try:
                                        chunk_json = json.loads(data_content)
                                        text_chunk = chunk_json.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                        if text_chunk:
                                            response_text += text_chunk
                                            yield f"data: {json.dumps({'text': text_chunk, 'done': False, 'conversation_id': conv_key, 'model': model_name})}\n\n"
                                    except Exception:
                                        pass
                        else:
                            raise Exception(f"Groq stream status {response.status_code}")
            except Exception as e:
                source = "fallback"
                error_name = type(e).__name__
                logging.warning(f"Groq stream error ({error_name}): {str(e)}.")
                if not response_text:
                    err_msg = f"""### ⚠️ Groq Cloud AI Offline or Timed Out

I was unable to establish a timely connection with the Groq Cloud service ({error_name}).

**Possible Causes:**
1. **API Key Missing or Invalid:** Ensure that your `GROQ_API_KEY` is correctly defined in `backend/.env`.
2. **Network Connection Issues:** Verify that the host is connected to the internet and can access `https://api.groq.com`.
3. **Rate Limits / Quotas:** You may have exceeded your Groq account's rate limits.

**Recommended Troubleshooting:**
- Check your internet access.
- Validate your `GROQ_API_KEY` settings."""
                    words = err_msg.split(" ")
                    for idx, word in enumerate(words):
                        space = " " if idx < len(words) - 1 else ""
                        text_chunk = f"{word}{space}"
                        response_text += text_chunk
                        yield f"data: {json.dumps({'text': text_chunk, 'done': False, 'conversation_id': conv_key, 'model': model_name})}\n\n"
                        await asyncio.sleep(0.01)
                    
                    latency = (datetime.utcnow() - start_time).total_seconds()
                    yield f"data: {json.dumps({'text': '', 'done': True, 'conversation_id': conv_key, 'model': model_name, 'latency': latency, 'source': 'fallback'})}\n\n"
                else:
                    yield f"data: {json.dumps({'text': f'\\n[Stream Interrupted: {error_name}]', 'done': True, 'error': True, 'conversation_id': conv_key, 'model': model_name, 'latency': 0.0, 'source': 'groq'})}\n\n"
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
    model_name = map_model_to_groq(raw_model)
    
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
        "You are SentinelAI SOC Copilot, a senior cyber security SOC analyst. For security incidents and threat analyses, organize your response using exactly these sections in Markdown headers:\n### Threat Summary\n### MITRE ATT&CK\n### Confidence\n### Impact\n### Detection\n### Remediation\n### References\nFocus technical answers specifically on threat detection, incident response, IOC explanation, payload analysis, firewall/WAF rules, SIEM queries, and executive summaries. Be direct, technical, and beginner-friendly. Do not mention any local templates or fallbacks."
    )
    
    attack_context = ""
    effective_attack_id = linked_attack_id or conv.linked_attack_id
    if effective_attack_id:
        from backend.models.models import AttackEvent
        attack = db.query(AttackEvent).filter(AttackEvent.id == effective_attack_id).first()
        if attack:
            attack_context = (
                f"\n\n[ATTACK EVENT CONTEXT]\n"
                f"Attack ID: {attack.id}\n"
                f"External ID: {attack.external_id}\n"
                f"Attack Type: {attack.attack_type}\n"
                f"Severity: {attack.severity} | Status: {attack.status}\n"
                f"Source: {attack.source_ip}:{attack.source_port} | Destination Port: {attack.destination_port}\n"
                f"Protocol: {attack.protocol} | Target Service: {attack.target_service}\n"
                f"GeoIP Location: {attack.city}, {attack.country}\n"
                f"Confidence: {int(attack.confidence*100)}% | Threat Score: {attack.threat_score}/100\n"
                f"Payload: {attack.payload or 'No payload data'}\n"
                f"User Agent: {attack.user_agent or 'Unknown'}\n"
                f"[END CONTEXT]"
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
            
    messages_payload.append({"role": "system", "content": system_prompt + attack_context + incident_context + sandbox_context + attacker_context})
    
    # Historical turns
    for msg in history_messages:
        messages_payload.append({
            "role": "user" if msg.role == "user" else "assistant",
            "content": msg.content
        })

    # 4. Attempt Groq Call
    response_text = ""
    source = "model"
    if settings.GROQ_API_KEY:
        groq_url = "https://api.groq.com/openai/v1/chat/completions"
        timeout_seconds = float(settings_service.get_setting(db, "ollama_timeout_seconds", 90.0))
        
        # Custom options
        temperature = payload.temperature if payload.temperature is not None else 0.7
        max_tokens = payload.max_tokens if payload.max_tokens is not None else 256
        
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(
                    groq_url,
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": model_name,
                        "messages": messages_payload,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "top_p": 0.9,
                        "stream": False
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            source = "fallback"
            error_name = type(e).__name__
            logging.warning(f"Groq chat error ({error_name}): {str(e)}. Executing fallback.", exc_info=True)
            if "Timeout" in error_name:
                response_text = "The Groq Cloud model responded too slowly. Try lowering max tokens or check your network limits."
    else:
        source = "fallback"

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
    model_name = map_model_to_groq(raw_model)
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

    # 4. Attempt Groq Analysis Call
    response_text = ""
    source = "model"
    messages_payload = [
        {"role": "system", "content": "SYSTEM DIRECTIVE: ZERO-TRUST SOC COPILET. You are a highly experienced SOC analyst investigating a threat event. Respond using the requested markdown headings structure."},
        {"role": "user", "content": prompt}
    ]
    
    if settings.GROQ_API_KEY:
        groq_url = "https://api.groq.com/openai/v1/chat/completions"
        timeout_seconds = float(settings_service.get_setting(db, "ollama_timeout_seconds", 90.0))
        
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(
                    groq_url,
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": model_name, 
                        "messages": messages_payload, 
                        "temperature": 0.2,
                        "max_tokens": 512,
                        "top_p": 0.9,
                        "stream": False
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            error_name = type(e).__name__
            logging.warning(f"Groq analyze failed ({error_name}): {str(e)}. Executing fallback.", exc_info=True)
            if "Timeout" in error_name:
                response_text = "### EXECUTIVE SUMMARY\nThe Groq Cloud model responded too slowly. Try lowering max tokens or check your network limits."
    else:
        source = "fallback"

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
