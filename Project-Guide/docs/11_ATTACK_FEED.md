# 11 — Attack Feed


## Purpose
Provide searchable real-time attack telemetry with a detailed investigation view.

## Required sections
- Summary metrics
- Attack-type filter chips
- Advanced filter drawer
- Search
- Real-time paginated table
- Selected attack details
- Map/radar visual
- Honeypot and session metadata
- Request/payload code panel
- Event timeline
- MITRE mapping
- Defensive recommendations

## Interaction
Selecting a row updates the detail panel without a page reload. New WebSocket rows animate in without losing the current selection.

## Acceptance
Filtering, pagination, detail loading and live updates work with real backend data.


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
