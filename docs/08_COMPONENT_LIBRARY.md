# 08 — Shared Component Library

> [!NOTE]
> **Design Specification**: This document is an initial component library specification. For current component implementations and layout details, refer to [FEATURES.md](FEATURES.md).

---

## Shared UI Primitives

- `AppCard` / `MetricCard`: Container cards for KPI counters, line charts, and status indicators.
- `StatusBadge`: Colored status pills for severity classifications (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
- `ThreatIntelPanel`: Overlay panel rendering IP threat scores, GeoIP location data, and attacker history.
- `Toast notifications`: Real-time toast alerts triggered by honeypot and WAF events.
- `PageHeader`: Standardized page title header with breadcrumbs and active status indicators.
