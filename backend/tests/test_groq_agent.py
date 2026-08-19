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
