import httpx
import logging
from fastapi import APIRouter, Depends
from datetime import datetime
from backend.core.config import settings
from backend.schemas.agent import ChatRequest, ChatResponse, AgentStatus

router = APIRouter(prefix="/agent", tags=["AI Agent"])

@router.get("/status", response_model=AgentStatus)
async def get_agent_status():
    """Verify Ollama status and fetch installed model names dynamically."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [model["name"] for model in data.get("models", [])]
                return AgentStatus(status="ONLINE", models_available=models)
    except Exception as e:
        logging.warning(f"Ollama offline during status discovery: {e}")
        
    # Return offline status with configuration models as default placeholder reference
    return AgentStatus(
        status="OFFLINE", 
        models_available=[settings.DEFAULT_OLLAMA_MODEL, "gemma:latest"]
    )

@router.post("/chat", response_model=ChatResponse)
async def post_chat(payload: ChatRequest):
    """Interact with local AI assistant, with smart mock fallback when Ollama is offline."""
    start_time = datetime.utcnow()
    
    # Try calling Ollama
    ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    model_name = payload.model or settings.DEFAULT_OLLAMA_MODEL
    prompt = payload.message
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                ollama_url,
                json={"model": model_name, "prompt": prompt, "stream": False}
            )
            if response.status_code == 200:
                data = response.json()
                response_text = data.get("response", "")
                latency = (datetime.utcnow() - start_time).total_seconds()
                return ChatResponse(
                    message=response_text,
                    conversation_id=payload.conversation_id or "conv_session_1",
                    model=model_name,
                    created_at=datetime.utcnow(),
                    latency=latency
                )
    except Exception as e:
        logging.warning(f"Ollama chat generation failed: {e}. Falling back to mock cyber advice.")
        
    # Fallback/Mock Response if local AI is offline
    latency = (datetime.utcnow() - start_time).total_seconds()
    mock_responses = {
        "explain": "Based on the raw payload details, this appears to be a classical Directory Traversal attempt matching MITRE ATT&CK technique T1083 (File and Directory Discovery). Recommendation: Ensure path sanitization filters are active on input endpoints.",
        "mitigate": "Mitigation steps: 1. Configure firewall rules to restrict port access. 2. Implement IP rate limiting on active listeners. 3. Validate path traversal escape sequences on web forms.",
        "default": f"SentinelAI AI Assistant: Received message '{prompt}'. (Note: Local Ollama service at {settings.OLLAMA_BASE_URL} is currently offline. Returning simulated security insight)."
    }
    
    msg_lower = prompt.lower()
    if "explain" in msg_lower or "traversal" in msg_lower or "brute" in msg_lower:
        ans = mock_responses["explain"]
    elif "mitigat" in msg_lower or "prevent" in msg_lower or "action" in msg_lower:
        ans = mock_responses["mitigate"]
    else:
        ans = mock_responses["default"]
        
    return ChatResponse(
        message=ans,
        conversation_id=payload.conversation_id or "conv_session_1",
        model=model_name,
        created_at=datetime.utcnow(),
        latency=latency
    )
