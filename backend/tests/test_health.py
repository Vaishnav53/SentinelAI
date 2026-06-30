def test_get_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert "version" in data
    assert "environment" in data

def test_get_services_health(client):
    response = client.get("/api/health/services")
    assert response.status_code == 200
    data = response.json()
    assert "database" in data
    assert "ollama" in data
    assert "collectors" in data
    assert data["database"]["status"] == "ONLINE"
    assert data["ollama"]["status"] == "CHECKING"
    assert data["collectors"]["status"] == "ACTIVE"
