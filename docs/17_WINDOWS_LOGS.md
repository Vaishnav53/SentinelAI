# 17 — Windows Event Logs Specification

> [!NOTE]
> **Design Specification**: This document is an initial Windows Event Log design specification. For current live telemetry features, refer to [FEATURES.md](FEATURES.md).

---

## Windows Log Collector Design

The Windows Log Ingestion service processes local Event Log records:
- **Event ID 4625**: Failed Security Account Login (Brute force indicator)
- **Event ID 4624**: Successful Security Account Login
- **Event ID 4688**: Process Creation (Process execution tracking)
- **Event ID 7045**: New Service Installation
