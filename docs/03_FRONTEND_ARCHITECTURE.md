# 03 — Frontend Architecture

## Shared structure

```text
src/
├── app/
├── api/
├── assets/
├── components/
├── hooks/
├── layouts/
├── pages/
├── routes/
├── styles/
└── utils/
```

## Page-module pattern

Create a folder only when implementing that page.

```text
pages/attack-feed/
├── AttackFeed.jsx
├── AttackFeed.css
├── components/
├── hooks/
├── services/
├── utils/
└── assets/
```

## State strategy

- Local UI state: `useState`
- Reusable logic: custom hooks
- Server state: centralized API hooks or a query library if introduced
- WebSocket data: one connection owner with subscriptions
- Settings: application context
- Avoid page-global mutable variables

## Shared components

Recommended shared components:

- AppCard
- StatusBadge
- MetricCard
- IconButton
- PageHeader
- LoadingState
- EmptyState
- ErrorState
- ConfirmDialog
- SearchInput
- FilterChip
- DataTable shell
- ChartCard
- Toast notifications

## Accessibility

- Keyboard operable controls
- Visible focus state
- Labels for icon-only controls
- Reduced-motion support
- Adequate contrast
- Semantic headings
- Table headers and accessible row selection

## Performance

- Memoize expensive charts
- Virtualize long log tables
- Debounce filters
- Avoid one WebSocket per component
- Lazy-load major routes
- Paginate backend data
