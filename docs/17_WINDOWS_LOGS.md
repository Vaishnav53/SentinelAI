# 17 — Windows Logs


## Purpose
Collect, normalize, filter and analyze Windows event logs.

## Required sections
- Collector state
- Channel filters
- Severity/event level filters
- Event ID search
- Provider and host filters
- Summary cards
- Timeline/source charts
- Paginated event table
- Event detail panel
- Raw XML view
- AI explanation
- MITRE mapping

## Safety
No privilege escalation. Permission failures are explained clearly.

## Acceptance
Collector heartbeat, pagination, filtering and event detail work reliably.


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
