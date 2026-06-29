# 15 — Threat Intelligence


## Purpose
Enrich local indicators and correlate attacks.

## Initial scope
- Local IOC store
- Source IP history
- Known-bad/manual indicators
- Confidence and last-seen
- Attack correlations
- Future provider adapters

## Acceptance
The module works without paid external services and clearly distinguishes local observations from third-party intelligence.


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
