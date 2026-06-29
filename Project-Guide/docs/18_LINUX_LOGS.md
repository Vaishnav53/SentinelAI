# 18 — Linux Logs


## Purpose
Future-ready ingestion for syslog, auth.log, auditd and journal events.

## Initial architecture
Define adapters and normalized event schemas without forcing Linux dependencies on Windows users.

## Acceptance
The architecture supports later Linux agents while the Windows-first build remains stable.


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
