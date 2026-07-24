# 09 — Dashboard Specification

> [!NOTE]
> **Design Specification**: This document is an initial Dashboard design specification. For current live Dashboard features and vitals monitoring, refer to [FEATURES.md](FEATURES.md).

---

## SOC Command Center Overview

The SOC Command Center (`/`) serves as the central operational view of SentinelAI:
- **System Vitals Bar**: Live host CPU usage, RAM allocation, Disk I/O, and open ports count gathered via `psutil`.
- **Dynamic Threat KPIs**: Real-time counters for Total Threats, Threat Level, AI Confidence Rating, and Online Sensors.
- **Geographical Threat Map**: Geolocation map plotting source coordinates for active intrusion IPs.
- **Real-Time Activity Stream**: WebSocket stream (`/api/attacks/ws`) rendering incoming security events without manual page refreshes.
