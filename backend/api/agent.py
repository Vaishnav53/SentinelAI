import httpx
import logging
import json
import re
from fastapi import APIRouter, Depends, HTTPException, status
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
    active_model = settings_service.get_setting(db, "default_ollama_model", settings.DEFAULT_OLLAMA_MODEL)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                raw_models = [model["name"] for model in data.get("models", [])]
                
                # Filter out duplicate base names if a tagged version exists
                models = []
                for name in raw_models:
                    if ":" not in name:
                        if any(m.startswith(name + ":") for m in raw_models):
                            continue
                    models.append(name)
                
                # Insert active model if not matching any in list
                has_match = any(m.split(':')[0] == active_model.split(':')[0] for m in models)
                if not has_match and active_model not in models:
                    models.insert(0, active_model)
                return AgentStatus(status="ONLINE", models_available=models)
    except Exception as e:
        logging.warning(f"Ollama offline during status discovery: {e}")
        
    return AgentStatus(
        status="OFFLINE", 
        models_available=[active_model, "gemma:latest", "llama3.1:latest"]
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
        "You are a cyber security SOC analyst. Answer questions clearly, directly, and practically. Be beginner-friendly for general questions, and provide actionable security recommendations for threats. Do not mention any local templates or fallbacks."
    )
    messages_payload.append({"role": "system", "content": system_prompt})
    
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
        if "explain" in msg_lower or "traversal" in msg_lower or "injection" in msg_lower:
            response_text = "Analysis: The payload indicates an injection probe sequence. Recommendations: Contextually sanitize input values and configure firewall blocks."
        elif "mitigat" in msg_lower or "prevent" in msg_lower:
            response_text = "Mitigation guidance: 1. Deploy firewall filters. 2. Bind application ports exclusively to local interfaces (e.g. 127.0.0.1)."
        else:
            response_text = "The local AI model is online but responded too slowly. Try using a smaller model, lower max tokens, or run Ollama with GPU acceleration."

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
