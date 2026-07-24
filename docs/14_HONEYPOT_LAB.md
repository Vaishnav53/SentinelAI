# 14 — Honeypot Lab Specification

> [!NOTE]
> **Design Specification**: This document is an initial Honeypot Lab design specification. For current live honeypot sensor specifications, refer to [FEATURES.md](FEATURES.md).

---

## Multi-Protocol Decoy Sensors

The Honeypot Lab (`/sensors`) operates isolated Python socket listeners emulating vulnerable protocol services:
- **HTTP Decoy Sensor** (Port `8088`): Captures web exploit probes and path traversal attempts (`/../../etc/passwd`).
- **SSH Decoy Sensor** (Port `2222`): Captures SSH credential brute-force attempts.
- **FTP Decoy Sensor** (Port `2121`): Captures anonymous file upload and scanning attempts.
- **Telnet Decoy Sensor** (Port `2323`): Captures IoT botnet reconnaissance probes.
