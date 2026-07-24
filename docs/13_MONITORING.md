# 13 — Monitoring Specification

> [!NOTE]
> **Design Specification**: This document is an initial host monitoring design specification. For current live system vitals features, refer to [FEATURES.md](FEATURES.md).

---

## Host Vitals & Telemetry Monitoring

The Monitoring subsystem tracks host resource utilization using `psutil`:
- Real-time CPU percent usage.
- RAM memory allocation and available capacity.
- Disk I/O read/write statistics.
- Active network connections and open ports count.
