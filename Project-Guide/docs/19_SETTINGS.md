# 19 — Settings


## Purpose
Control application behavior without editing source files.

## Required sections
- General
- API and WebSocket
- Ollama
- Preferred model
- Retention
- Collectors
- Honeypots
- Reports
- Notifications
- Appearance and motion
- Export/import configuration
- Reset with confirmation

## Acceptance
Validation prevents invalid hosts, ports and retention values. Sensitive values are not exposed in logs.


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
