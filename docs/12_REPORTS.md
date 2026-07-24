# 12 — Reports Specification

> [!NOTE]
> **Design Specification**: This document is an initial Reports design specification. For current live reporting feature details, refer to [FEATURES.md](FEATURES.md).

---

## Executive Reports Subsystem

The Reports module (`/reports`) handles PDF compliance report generation and raw log CSV exports:
- **PDF Compliance Reports**: Generates downloadable PDF compliance documents containing executive threat statistics, top attack vectors, and containment recommendations.
- **CSV Log Exports**: Export raw incident and attack event logs into CSV files for external audit and SIEM ingestion.
