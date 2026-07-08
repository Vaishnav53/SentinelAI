# API Reference — SentinelAI

This reference guide describes the endpoints, parameters, payloads, and response structures of the SentinelAI backend server.

---

## 🔒 Security & Authentication Note

> [!IMPORTANT]
> All endpoints are intended to run within a local virtual machine or an isolated secure environment. 
> Under no circumstances should backend API keys (such as `GROQ_API_KEY`) be exposed via request headers, parameters, or front-end logs. All keys must load exclusively via server environment variables (`backend/.env`).

---

## 📊 Endpoints Overview

All URLs are prefixed with `/api`.

### 1. Health & Status
Checks active AI server connections, loaded modules, and network connectivity.

#### `GET /api/agent/status`
* **Description**: Queries active AI provider status (Ollama or Groq Cloud) and lists dynamically discovered models.
* **Response `200 OK`**:
  ```json
  {
    "status": "ONLINE",
    "provider": "Groq Cloud",
    "latency_ms": 142,
    "models_available": [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "groq/compound-mini"
    ]
  }
  }
  ```

---

### 2. AI Security Copilot
Manages conversational loops, streaming SSE chunks, and incident briefs.

#### `POST /api/agent/chat/stream`
* **Description**: Initiates a Server-Sent Events (SSE) chat completion streaming choice chunks to the user.
* **Payload**:
  ```json
  {
    "message": "Can you recommend mitigation strategies for SQL Injection?",
    "model": "llama-3.3-70b-versatile",
    "conversation_id": "conv-a72e8110-3844",
    "context": {
      "attack_id": 23,
      "incident_id": null,
      "sandbox_file_id": null,
      "attacker_ip": null
    },
    "temperature": 0.2,
    "max_tokens": 1024
  }
  ```
* **Event Stream Output**:
  ```text
  data: {"text": "For", "done": false}
  data: {"text": " SQL Injection", "done": false}
  data: {"text": " mitigation, use parameterization.", "done": false}
  data: {"done": true, "conversation_id": "conv-a72e8110-3844", "latency": 0.45}
  ```

#### `POST /api/agent/analyze/{attack_id}`
* **Description**: Instantly parses an attack database record, queries the AI provider, and returns a structured markdown threat summary.
* **Response `200 OK`**:
  ```json
  {
    "status": "Success",
    "conversation_id": "conv-3918-b271",
    "analysis": "### Threat Summary\n- Detected SQL Injection attempt...\n### Mitigation\n- Deploy WAF rule..."
  }
  ```

---

### 3. Attack Feeds & Decoys
Manages raw logging, active sensor alerts, and intrusion payloads.

#### `GET /api/attacks`
* **Description**: Lists captured sensor intrusion events.
* **Parameters**: `limit` (Integer, default: 50), `severity` (String, optional).
* **Response `200 OK`**:
  ```json
  [
    {
      "id": 23,
      "external_id": "HON-1783491",
      "source_ip": "185.220.101.4",
      "source_port": 49102,
      "destination_port": 80,
      "protocol": "TCP",
      "attack_type": "Path Traversal",
      "severity": "High",
      "threat_score": 85,
      "confidence": 0.95,
      "payload": "GET /../../../../etc/passwd HTTP/1.1",
      "city": "Berlin",
      "country": "Germany",
      "created_at": "2026-07-08T21:42:00Z"
    }
  ]
  ```

#### `POST /api/attacks/simulate`
* **Description**: Dynamically inserts a simulated intrusion log to test alert broadcasts.
* **Response `201 Created`**:
  ```json
  {
    "status": "Simulated Alert Broadcasted",
    "event_id": 24
  }
  ```

---

### 4. Playbooks & Automation
Manages defense scripts and checks mitigation status.

#### `POST /api/playbooks/execute`
* **Description**: Triggers playbook workflow sequence steps against a targeted threat.
* **Payload**:
  ```json
  {
    "playbook_id": 5,
    "target_ip": "185.220.101.4"
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "status": "Completed",
    "logs": [
      "Step 1: Loaded block configurations.",
      "Step 2: Appended IP to local WAF iptables filters.",
      "Step 3: Verification check passed."
    ]
  }
  ```

---

### 5. Decoy Sandbox
Inspects suspicious command lines and uploaded file signatures.

#### `POST /api/sandbox/upload`
* **Description**: Ingests files or command lists for isolated signature checking.
* **Response `200 OK`**:
  ```json
  {
    "file_name": "malicious_script.sh",
    "md5_hash": "2f671bbac3980a3123b37803a",
    "matches": [
      "WGET_DOWNLOAD_EXEC",
      "LOCAL_PORT_BIND"
    ],
    "verdict": "CRITICAL"
  }
  ```

---

## ❌ Error Response Format

Errors are serialized using standard FastAPI HTTPException validators.

#### Example `422 Unprocessable Entity` (Missing Parameters)
```json
{
  "detail": [
    {
      "loc": ["body", "message"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

#### Example `503 Service Unavailable` (AI connection failure)
```json
{
  "detail": "Groq Cloud API connection failed. Connection timeout."
}
```
