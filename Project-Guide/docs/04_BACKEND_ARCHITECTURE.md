# 04 — Backend Architecture

## Target structure

```text
backend/
├── main.py
├── api/
├── core/
├── database/
├── models/
├── schemas/
├── services/
├── repositories/
├── collectors/
├── honeypots/
├── intelligence/
├── reports/
├── websocket/
└── tests/
```

## Layer responsibilities

### Routers
- Parse requests
- Enforce validation
- Call services
- Return typed responses

### Services
- Business logic
- Classification
- Aggregation
- External integrations
- Transaction coordination

### Repositories
- Database queries
- Pagination
- Filtering
- Persistence

### Schemas
- Request and response models
- Stable API contracts

### Models
- SQLAlchemy persistence entities

## Core services

- AttackService
- SensorService
- MonitoringService
- OllamaService
- ReportService
- MITREService
- WindowsLogService
- SettingsService
- AuditService

## Error format

```json
{
  "error": {
    "code": "OLLAMA_OFFLINE",
    "message": "The local Ollama service is unavailable.",
    "details": {}
  }
}
```

## Security defaults

- CORS limited by environment
- Input size limits
- Payload truncation rules
- No raw exception traces returned
- Sensitive configuration excluded from logs
- Rate limits on honeypot and AI endpoints where practical
