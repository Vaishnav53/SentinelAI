# 11 — Incident Response (`/attacks`)

> [!NOTE]
> **Design Specification**: This document is an initial attack feed design specification. For current live feature specifications, refer to [FEATURES.md](FEATURES.md) and [WORKFLOW.md](WORKFLOW.md).

---

## Module Overview

`Incident Response (/attacks)`: real-time attack feed, filtering, payload inspection, and incident actions.
- **Live Ingestion Feed**: Displays a scrollable, real-time list of all captured security events across host metrics, WAF filters, and honeypot sensors.
- **Multi-Criteria Filters**: Filter events by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), protocol (`TCP`, `UDP`, `HTTP`, `SSH`), and keyword search.
- **Payload Inspection**: View raw request headers, command buffers, source/destination IPs, ports, and GeoIP details for any attack event.
