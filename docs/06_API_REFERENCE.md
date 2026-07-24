# 06 — API Reference

> [!NOTE]
> **Design Specification**: This document represents the **ORIGINAL API DESIGN SPECIFICATION**. For current implemented endpoints, parameters, payloads, WebSockets (`ws://127.0.0.1:8000/api/attacks/ws`), and status codes, refer to [API_REFERENCE.md](API_REFERENCE.md).

---

## Initial API Design Conventions

- Base Path: `/api`
- JSON request and response payloads
- ISO 8601 timestamp formats
- Pagination and severity filtering
- Unified FastAPI exception handlers

## Planned Initial Endpoint Categories

### Attacks Router
```text
GET /api/attacks
GET /api/attacks/{id}
GET /api/attacks/stats
POST /api/attacks/simulate
```

### AI Agent Router
```text
GET /api/agent/status
GET /api/agent/conversations
GET /api/agent/conversations/{id}
POST /api/agent/chat/stream
POST /api/agent/chat
POST /api/agent/analyze/{attack_id}
```

### Reports Router
```text
POST /api/reports/generate
GET /api/reports/download/{filename}
```

### WebSockets Stream
- Endpoint: `/api/attacks/ws`
- Pushes real-time normalized threat events to client views.
