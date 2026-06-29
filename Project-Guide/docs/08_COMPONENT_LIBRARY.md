# 08 — Shared Component Library

## Required primitives

### AppCard
Props: title, subtitle, actions, status, loading, error, className.

### StatusBadge
Statuses: checking, online, offline, degraded, active, idle, warning, error.

### MetricCard
Supports value, delta, icon, sparkline and semantic status.

### DataTableShell
Provides header, search slot, filters, loading, empty state, pagination and selection.

### ChartCard
Standardizes chart title, legend, range control and loading state.

### ConfirmDialog
Required for destructive or active-response actions.

### CodePanel
For payloads, HTTP requests, Windows XML and raw logs.

### PageHeader
Standard page title, subtitle, live state, clock and page actions.

## Shared behavior

- Skeleton loading
- Error boundary
- Empty state
- Accessible focus
- Reduced-motion support
- Consistent tooltips
- Consistent toast notifications
