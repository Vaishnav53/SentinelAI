# 13 — Monitoring


## Purpose
Display current and historical health of the local SentinelAI host and services.

## Required sections
- CPU, memory, disk and network metrics
- Trend charts
- Process summary
- Service status
- Sensor heartbeat
- WebSocket state
- Alerts
- Historical range selector

## Acceptance
Metrics refresh efficiently, history is paginated or sampled, and service health is dynamic.


## Architecture rule

Create the page folder only when this module is implemented. Keep page-specific components, hooks, services, utilities and assets inside that folder. Shared primitives remain in the shared component library.

## Testing

- Rendering test
- Loading state
- Empty state
- Error state
- API success
- API failure
- Critical interaction
- Responsive desktop layout
