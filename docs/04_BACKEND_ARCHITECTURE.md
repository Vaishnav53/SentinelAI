# 04 — Backend Architecture

> [!NOTE]
> **Design Specification**: This document is an initial backend design specification. For current live backend architecture details, refer to [ARCHITECTURE.md](ARCHITECTURE.md) and [API_REFERENCE.md](API_REFERENCE.md).

---

## Service Directory Structure

```text
backend/
├── main.py           # FastAPI application entry point & lifespan startup
├── api/              # API Routers (agent, attacks, sandbox, reports, waf, etc.)
├── core/             # Settings (config.py), security, logging
├── database/         # SQLAlchemy engine setup & seed scripts (session.py)
├── models/           # SQLAlchemy ORM model definitions (models.py)
├── schemas/          # Pydantic validation schemas
├── services/         # Correlation engine, WAF defense, honeypots, AI adapters
└── tests/            # Pytest test suite (19 test cases)
```

## Layer Responsibilities

### API Routers (`api/`)
- Parse incoming HTTP requests and WebSocket connections.
- Enforce Pydantic validation schemas.
- Invoke domain services and return typed JSON or streamed responses.

### Services (`services/`)
- **Correlation Engine**: Groups raw attack telemetry into aggregated correlated incidents.
- **WAF Engine**: Real-time SQLi, XSS, and path traversal parameter inspection.
- **Honeypot Decoy Sensors**: Multi-protocol socket listeners (ports 8088, 2222, 2121, 2323).
- **AI Adapter**: Groq Cloud API provider integration with a deterministic local fallback response engine.
- **Reporting Service**: Asynchronous PDF compliance report generation and CSV exports.

### Database & Models (`database/`, `models/`)
- Manages SQLite (`sentinelai.db`) and PostgreSQL ORM mappings.
- Auto-seeds initial demo sensors, settings, and sample attack events on startup (`populate_demo_data()`).

## Security & Error Handling

- CORS origins restricted via `FRONTEND_ORIGIN` settings.
- Exception handlers format standard HTTP error responses.
- Sensitive environment secrets (`GROQ_API_KEY`, `SECRET_KEY`) managed via `backend/.env`.
