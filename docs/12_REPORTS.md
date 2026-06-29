# 12 — Reports


## Purpose
Generate dynamic technical and executive security reports.

## Required sections
- Date range
- Attack type and severity filters
- Sensor/data-source filters
- Report type cards
- Inclusion options
- Format selection
- Generate button with progress
- Overview charts
- Recent reports table
- Download, preview, regenerate and delete actions

## Job model
Large reports run asynchronously with queued, generating, completed and failed states.

## Acceptance
Generated content reflects selected filters and supports PDF, CSV and JSON.


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
