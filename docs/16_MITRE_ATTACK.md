# 16 — MITRE ATT&CK Mapping Specification

> [!NOTE]
> **Design Specification**: This document is an initial MITRE ATT&CK design specification. For current live MITRE ATT&CK mapping features, refer to [FEATURES.md](FEATURES.md).

---

## MITRE ATT&CK Alignment

SentinelAI automatically maps detected threat events and correlated incidents to MITRE ATT&CK framework tactics and techniques:
- **T1110**: Brute Force Authentication (SSH / Telnet login probes)
- **T1190**: Exploit Public-Facing Application (SQL Injection, XSS, Path Traversal)
- **T1059**: Command and Scripting Interpreter (Malicious shell script execution)
- **T1083**: File and Directory Discovery (Traversal scans)
- **T1595**: Active Scanning (Port probes)
