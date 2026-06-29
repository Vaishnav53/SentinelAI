# 22 — Testing Guide

## Backend tests

- Health endpoints
- Attack filtering and pagination
- Sensor state transitions
- Ollama offline behavior
- Model discovery
- Report job lifecycle
- Monitoring data serialization
- Windows-log normalization
- Settings validation
- WebSocket manager behavior

## Frontend tests

- Route rendering
- Loading/error/empty states
- Filter interactions
- Row selection
- Model selection
- Message sending
- Report form validation
- Settings validation

## End-to-end smoke flow

1. Start Ollama.
2. Start backend.
3. Start frontend.
4. Open Dashboard.
5. Trigger a safe local honeypot request.
6. Confirm attack appears live.
7. Open Attack Feed details.
8. Ask AI to explain the attack.
9. Generate a report.
10. Verify downloaded artifact.
11. Check monitoring.
12. Check logs and settings.

## Performance targets

- Dashboard first meaningful render under 2 seconds on local development hardware after warm start
- Attack filter response under 500ms for typical local datasets
- No uncontrolled WebSocket growth
- Long tables paginated or virtualized
