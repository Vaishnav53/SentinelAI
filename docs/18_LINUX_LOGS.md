# 18 — Linux Logs Specification

> [!NOTE]
> **Design Specification**: This document is an initial Linux Syslog design specification. For current live telemetry features, refer to [FEATURES.md](FEATURES.md).

---

## Linux Syslog Ingestion Design

The Syslog collector ingests local authentication and system log entries:
- `/var/log/auth.log` / `/var/log/secure`: Failed SSH login attempts and sudo privilege escalations.
- `/var/log/syslog`: General kernel and daemon messages.
