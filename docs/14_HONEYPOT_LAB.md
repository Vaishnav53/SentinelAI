# 14 — Honeypot Lab


## Purpose
Operate safe local honeypot sensors and investigate captured sessions.

## Required sections
- Lab status and isolation warning
- Sensor cards
- Start/stop controls
- Listener ports
- Recent sessions
- Captured interactions
- Attack distribution
- Source map
- Sensor configuration drawer
- Health and uptime

## Safety
Controls only manage local configured listeners. Show clear warnings before exposing listeners beyond localhost or a lab interface.

## Acceptance
Sensor state reflects backend state and every action is audited.


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
