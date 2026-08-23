import pytest
from backend.api.agent import map_model_to_groq, SUPPORTED_GROQ_MODELS
from backend.core.config import settings

def test_get_agent_models(client):
    response = client.get("/api/agent/models")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "Groq Cloud"
    assert "models" in data
    assert len(data["models"]) >= 3
    assert data["default_model"] == "openai/gpt-oss-120b"
    model_ids = [m["id"] for m in data["models"]]
    assert "openai/gpt-oss-120b" in model_ids
    assert "openai/gpt-oss-20b" in model_ids
    assert "qwen/qwen3.6-27b" in model_ids

def test_get_agent_status(client):
    response = client.get("/api/agent/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ("ONLINE", "OFFLINE")

def test_map_model_to_groq_validation():
    # Valid allowlist model IDs map directly
    for model_info in SUPPORTED_GROQ_MODELS:
        assert map_model_to_groq(model_info["id"]) == model_info["id"]

    # Retired model migration mappings
    assert map_model_to_groq("llama-3.3-70b-versatile") == "openai/gpt-oss-120b"
    assert map_model_to_groq("llama-70b") == "openai/gpt-oss-120b"
    assert map_model_to_groq("llama-8b-fast") == "openai/gpt-oss-120b"
    assert map_model_to_groq("mixtral") == "openai/gpt-oss-120b"
    assert map_model_to_groq("gemma") == "openai/gpt-oss-120b"

    # Supported model keyword mappings
    assert map_model_to_groq("gpt-oss-120b") == "openai/gpt-oss-120b"
    assert map_model_to_groq("gpt-oss-20b") == "openai/gpt-oss-20b"
    assert map_model_to_groq("qwen") == "qwen/qwen3.6-27b"

    # Unknown/invalid fallback defaults
    assert map_model_to_groq("unknown-model-xyz") == settings.DEFAULT_GROQ_MODEL
    assert map_model_to_groq(None) == settings.DEFAULT_GROQ_MODEL

def test_copilot_conversational_greetings_and_general_questions(client):
    # 1. Greeting test: "hi" must return a greeting, NOT attack analysis
    res_hi = client.post("/api/agent/chat", json={
        "message": "hi",
        "response_mode": "general_chat"
    })
    assert res_hi.status_code == 200
    data_hi = res_hi.json()
    assert "Hi!" in data_hi["message"] or "Hello!" in data_hi["message"]
    assert "Threat Summary" not in data_hi["message"]

    # 2. General knowledge test: "What is Python?"
    res_py = client.post("/api/agent/chat", json={
        "message": "What is Python?",
        "response_mode": "general_chat"
    })
    assert res_py.status_code == 200
    data_py = res_py.json()
    assert "Python" in data_py["message"]
    assert "Threat Summary" not in data_py["message"]

    # 3. Non-cybersecurity test: "What is the capital of Japan?"
    res_jp = client.post("/api/agent/chat", json={
        "message": "What is the capital of Japan?",
        "response_mode": "general_chat"
    })
    assert res_jp.status_code == 200
    data_jp = res_jp.json()
    assert "Tokyo" in data_jp["message"]
    assert "Threat Summary" not in data_jp["message"]

def test_copilot_context_priority_does_not_hijack_greetings(client):
    # Deep-link scenario: context contains attack_id=8058, but user types "hi"
    res = client.post("/api/agent/chat", json={
        "message": "hi",
        "context": {
            "attack_id": 8058
        }
    })
    assert res.status_code == 200
    data = res.json()
    # Must answer "hi" naturally, NOT automatically produce Attack 8058 analysis
    assert "Hi!" in data["message"] or "Hello!" in data["message"]
    assert "Attack Event #8058 SOC Analysis" not in data["message"]

def test_copilot_explicit_investigation_with_context(client):
    # User explicitly asks to analyze the attack with attack context
    res = client.post("/api/agent/chat", json={
        "message": "Analyze attack 8058",
        "context": {
            "attack_id": 8058
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data["message"]) > 20
