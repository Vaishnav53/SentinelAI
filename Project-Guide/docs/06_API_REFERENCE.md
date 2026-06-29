# 06 — API Reference

## Common conventions

- Prefix: `/api`
- JSON responses
- ISO 8601 timestamps
- Cursor or page pagination
- Stable error envelope
- Filter parameters validated

## Attack endpoints

```text
GET /api/attacks
GET /api/attacks/{id}
GET /api/attacks/stats
POST /api/attacks/{id}/status
```

Suggested filters:

- page
- page_size
- severity
- attack_type
- source_ip
- target_service
- sensor_id
- status
- date_from
- date_to
- search

## AI endpoints

```text
GET /api/agent/status
GET /api/agent/models
POST /api/agent/chat
POST /api/agent/chat/stream
```

Chat request:

```json
{
  "message": "Explain this attack.",
  "model": "llama3.1",
  "conversation_id": null,
  "context": {
    "attack_id": null
  }
}
```

## Report endpoints

```text
POST /api/reports/jobs
GET /api/reports/jobs
GET /api/reports/jobs/{id}
GET /api/reports/{id}
GET /api/reports/{id}/download
DELETE /api/reports/{id}
```

## Monitoring endpoints

```text
GET /api/monitoring/current
GET /api/monitoring/history
```

## WebSockets

- `/ws/alerts`
- `/ws/metrics`
- `/ws/reports`
- `/ws/agent`

Each message must include `type`, `timestamp` and `payload`.
