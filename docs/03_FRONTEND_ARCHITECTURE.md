# 03 — Frontend Architecture

> [!NOTE]
> **Design Specification**: This document is an initial frontend design specification. For current live frontend architecture details, refer to [ARCHITECTURE.md](ARCHITECTURE.md) and [FEATURES.md](FEATURES.md).

---

## Directory Structure

```text
frontend/src/
├── api/          # Axios API client setup (client.js)
├── assets/       # Static branding and icons
├── components/   # Reusable UI cards, tables, maps, modals
├── layouts/      # DashboardLayout shell
├── pages/        # Views (Dashboard, AttackFeed, Agent, HoneypotLab, WAF, etc.)
├── routes/       # React Router index definitions
├── styles/       # CSS tokens and styling rules
└── utils/        # Helper functions and formatters
```

## Page-Module Pattern

Each primary view lives in its dedicated folder containing its component logic and CSS module:

```text
pages/attack-feed/
├── AttackFeed.jsx
└── AttackFeed.css
```

## State Strategy

- Local UI state: `useState` & `useEffect`
- Global telemetry: WebSocket connection owned by `DashboardLayout` broadcasting alerts via custom events
- Server communication: Axios client pointing to `VITE_API_BASE_URL` (`http://127.0.0.1:8000/api`)

## Shared UI Primitives

- `AppCard` / `MetricCard`: KPI metrics and chart panels
- `StatusBadge`: Colored status badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`)
- `ThreatIntelPanel`: IP intelligence details overlay
- `Toast notifications`: Real-time alert notifications

## Styling & Layout Rules

- Fixed single-shell dashboard view maintaining 100% viewport stability without horizontal scrolling.
- Modern dark mode styling with custom CSS design tokens (`#0a0f1d` background, cyan and red glow accents).
