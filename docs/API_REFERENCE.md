# API Reference — SentinelAI

This reference guide describes the HTTP REST endpoints, WebSocket schemas, request payloads, response structures, and HTTP status codes for the SentinelAI backend application.

---

## 🔒 Security & Authentication Note

> [!IMPORTANT]
> SentinelAI is designed to run in local developer environments and containerized hybrid lab setups. All sensitive credentials (such as `GROQ_API_KEY`, `SECRET_KEY`, and database connection strings) are managed strictly via backend environment variables (`backend/.env`). No API keys or secrets are ever exposed in request headers, URL parameters, or frontend client bundles.

---

## 🌐 Base URL & Protocol

* **REST API Base URL**: `http://127.0.0.1:8000/api`
* **WebSocket Endpoint**: `ws://127.0.0.1:8000/api/attacks/ws`

---

## 📊 Router Endpoints

### 1. Health & System Status (`/api/agent`, `/api/monitoring`)

#### `GET /api/agent/status`
* **Description**: Queries the active AI status, latency, and available models list. Groq Cloud is the primary live LLM provider. When Groq is unavailable or unconfigured, SentinelAI uses a deterministic local fallback response engine.
* **Status Code**: `200 OK`
* **Response Payload**:
  ```json
  {
    "status": "ONLINE",
    "provider": "Groq Cloud",
    "latency_ms": 142,
    "models_available": [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b"
    ]
  }
  ```

#### `GET /api/monitoring/vitals`
* **Description**: Returns live host CPU, memory, disk I/O, and open ports system vitals via `psutil`.
* **Status Code**: `200 OK`
* **Response Payload**:
  ```json
  {
    "cpu_usage": 18.5,
    "memory_usage": 42.1,
    "disk_usage": 55.4,
    "open_ports": 12,
    "timestamp": "2026-07-24T11:00:00Z"
  }
  ```

---

### 2. AI Security Copilot & AI Investigator (`/api/agent`)

> [!NOTE]
> **Implemented Agent Routes**:
> * `GET /api/agent/status` — Returns AI status and available models list.
> * `GET /api/agent/conversations` — Lists historical threat analysis threads.
> * `GET /api/agent/conversations/{id}` — Retrieves thread messages detail.
> * `DELETE /api/agent/conversations/{id}` — Deletes a conversation thread.
> * `POST /api/agent/chat/stream` — Submits prompts and streams text chunks.
> * `POST /api/agent/chat` — Submits prompts and returns JSON chat response.
> * `POST /api/agent/analyze/{attack_id}` — Analyzes a specific attack log context and returns a structured markdown threat summary.
>
> The 7 structured investigation actions (*Analyze Incident*, *Explain Severity*, *Extract IOCs*, *Recommend Containment*, *Map to MITRE*, *Generate Timeline*, *Executive Summary*) submit contextual prompts through `POST /api/agent/chat/stream` and `POST /api/agent/analyze/{attack_id}`. There is no separate `/api/agent/investigate` endpoint.

#### `POST /api/agent/chat/stream`
* **Description**: Initiates a streamed response choice chunks for interactive copilot conversations and structured AI investigation actions.
* **Status Code**: `200 OK` (Content-Type: `text/event-stream`)
* **Request Payload**:
  ```json
  {
    "message": "Recommend containment steps for a SQL Injection attack.",
    "model": "openai/gpt-oss-120b",
    "conversation_id": "conv-a72e8110-3844",
    "context": {
      "attack_id": 23,
      "incident_id": null
    },
    "temperature": 0.2,
    "max_tokens": 1024
  }
  ```
* **Streamed Response Output**:
  ```text
  data: {"text": "For", "done": false}
  data: {"text": " SQL Injection", "done": false}
  data: {"text": " mitigation, sanitize input parameters.", "done": false}
  data: {"done": true, "conversation_id": "conv-a72e8110-3844", "latency": 0.42}
  ```

#### `POST /api/agent/analyze/{attack_id}`
* **Description**: Instantly parses an attack database record, executes AI analysis, and returns a structured markdown threat summary.
* **Status Code**: `200 OK`
* **Response Payload**:
  ```json
  {
    "status": "Success",
    "conversation_id": "analysis_attack_23",
    "analysis": "### EXECUTIVE SUMMARY\nA high-severity SQL Injection signature was detected..."
  }
  ```

---

### 3. Attack Feed & Real-Time Telemetry (`/api/attacks`)

#### `GET /api/attacks`
* **Description**: Returns a paginated list of captured intrusion events.
* **Parameters**: `limit` (int, default: 50), `severity` (string, optional), `attack_type` (string, optional).
* **Status Code**: `200 OK`
* **Response Payload**:
  ```json
  [
    {
      "id": 23,
      "external_id": "HON-1783491",
      "source_ip": "185.220.101.4",
      "source_port": 49102,
      "destination_port": 8088,
      "protocol": "TCP",
      "attack_type": "Path Traversal",
      "severity": "HIGH",
      "threat_score": 85,
      "confidence": 0.95,
      "payload": "GET /../../../../etc/passwd HTTP/1.1",
      "city": "Berlin",
      "country": "Germany",
      "created_at": "2026-07-24T10:45:00Z"
    }
  ]
  ```

#### `POST /api/attacks/simulate`
* **Description**: Triggers a simulated intrusion log to test alert streams.
* **Status Code**: `201 Created`
* **Response Payload**:
  ```json
  {
    "status": "Simulated Alert Broadcasted",
    "event_id": 24
  }
  ```

#### `WS /api/attacks/ws`
* **Description**: WebSocket stream broadcasting live normalized attack events and sensor triggers to client dashboards.
* **Message Format**:
  ```json
  {
    "type": "NEW_ATTACK",
    "data": {
      "id": 24,
      "source_ip": "192.168.1.50",
      "attack_type": "SQL Injection",
      "severity": "CRITICAL",
      "timestamp": "2026-07-24T11:05:00Z"
    }
  }
  ```

---

### 4. Correlated Incidents (`/api/incidents`)

#### `GET /api/incidents`
* **Description**: Returns all aggregated correlated incidents.
* **Status Code**: `200 OK`
* **Response Payload**:
  ```json
  [
    {
      "id": 5,
      "incident_type": "SSH Brute Force Campaign",
      "severity": "HIGH",
      "status": "ACTIVE",
      "attack_count": 14,
      "source_ip": "185.220.101.4",
      "threat_score": 90,
      "summary": "Multiple failed SSH root login attempts within 60s.",
      "created_at": "2026-07-24T10:30:00Z"
    }
  ]
  ```

#### `POST /api/incidents/{id}/mitigate`
* **Description**: Updates incident status to `MITIGATED` and applies containment tags.
* **Status Code**: `200 OK`

---

### 5. WAF & Active Defense (`/api/waf`)

#### `GET /api/waf/rules`
* **Description**: Lists active WAF inspection rules and statistics.
* **Status Code**: `200 OK`

#### `POST /api/waf/block`
* **Description**: Manually adds an IP address to the active WAF quarantine blocklist.
* **Request Payload**: `{"ip": "192.168.1.50", "reason": "Repeated SQLi attempts"}`
* **Status Code**: `200 OK`

---

### 6. Honeypot Decoys (`/api/honeypot`)

#### `GET /api/honeypot/sensors`
* **Description**: Lists decoy sensor statuses (HTTP, SSH, FTP, Telnet) and listener metrics.
* **Status Code**: `200 OK`

---

### 7. Decoy Sandbox (`/api/sandbox`)

#### `POST /api/sandbox/upload`
* **Description**: Uploads a mock payload file for YARA signature scanning and heuristics analysis.
* **Status Code**: `200 OK`
* **Response Payload**:
  ```json
  {
    "file_name": "suspicious_script.sh",
    "md5_hash": "2f671bbac3980a3123b37803a",
    "matches": ["WGET_EXEC", "PORT_BIND"],
    "verdict": "SUSPICIOUS"
  }
  ```

---

### 8. Executive Reports (`/api/reports`)

#### `POST /api/reports/generate`
* **Description**: Generates an executive compliance PDF report.
* **Status Code**: `200 OK`
* **Response Payload**: `{"status": "success", "report_url": "/api/reports/download/report_20260724.pdf"}`

---

## ❌ HTTP Status Codes Summary

* `200 OK`: Request succeeded.
* `201 Created`: Resource created successfully.
* `400 Bad Request`: Invalid request body or payload parameters.
* `404 Not Found`: Target incident, attack, or report file not found.
* `422 Unprocessable Entity`: Validation failure on request model fields.
* `500 Internal Server Error`: Server exception during execution.
* `503 Service Unavailable`: External AI provider (Groq Cloud) connection error.
