# 09 — Dashboard


## Purpose
Provide an immediate SOC overview without excessive scrolling.

## Required sections
- Page header and live system state
- Backend, honeypot, AI and sensor status cards
- Threat radar
- Live attack map
- Severity distribution
- Six compact metrics
- Live attack feed
- Top attackers
- Recent activity
- System resources
- Sensor status
- AI insight

## Data
Use health, attack stats, latest attacks, monitoring and sensor APIs. Statuses must never be hardcoded.

## Interactions
- Refresh
- Start authorized scan placeholder only
- Navigate to attack detail
- Open AI analysis
- WebSocket live updates

## Acceptance
At 1366×768, the main analytical content should be visible with minimal scrolling and no oversized widgets.


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
