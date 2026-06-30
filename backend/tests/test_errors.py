from backend.core.errors import (
    SentinelException,
    DatabaseException,
    ExternalServiceException,
    NotFoundException,
    ValidationException,
    sentinel_exception_handler,
    general_exception_handler
)
from fastapi import Request

# Simple mock request helper
def mock_request():
    return object()

def test_exception_properties():
    exc = ValidationException("Invalid username", {"field": "username"})
    assert exc.status_code == 400
    assert exc.code == "VALIDATION_ERROR"
    assert exc.message == "Invalid username"
    assert exc.details == {"field": "username"}

def test_sentinel_exception_handler():
    exc = NotFoundException("Sensor 5 not found")
    response = sentinel_exception_handler(mock_request(), exc)
    
    assert response.status_code == 404
    data = response.body.decode()
    import json
    parsed = json.loads(data)
    assert "error" in parsed
    assert parsed["error"]["code"] == "NOT_FOUND"
    assert parsed["error"]["message"] == "Sensor 5 not found"

def test_general_exception_handler():
    exc = ValueError("Something bad happened")
    response = general_exception_handler(mock_request(), exc)
    
    assert response.status_code == 500
    data = response.body.decode()
    import json
    parsed = json.loads(data)
    assert "error" in parsed
    assert parsed["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert parsed["error"]["details"]["type"] == "ValueError"

def test_client_404_handling(client):
    response = client.get("/api/non-existent-endpoint-abc")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "Not Found" in data["error"]["message"]

