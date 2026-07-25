# 19 — Platform Settings Specification

> [!NOTE]
> **Design Specification**: This document is an initial Settings design specification. For current platform configuration options, refer to [FEATURES.md](FEATURES.md) and [SETUP.md](SETUP.md).

---

## System Settings & Configuration Overview

System settings and configuration parameters are managed internally and exposed via backend APIs (`/api/settings`):
- **Platform Parameters**: Configures API bindings, data retention periods, and metric collector intervals.
- **Alert Sensitivity & Thresholds**: Maintains alert score multipliers and notification threshold filters used by WebSocket alerts and SOC notifications.
- **Integration Endpoints**: Stores webhook integration parameters (Slack, Discord) and alert recipient emails.
