# 15 — Threat Intelligence Specification

> [!NOTE]
> **Design Specification**: This document is an initial Threat Intelligence design specification. For current live threat intelligence features, refer to [FEATURES.md](FEATURES.md).

---

## GeoIP & Attacker Profiling

The Threat Intelligence subsystem (`/attackers`) enriches incoming source IP addresses:
- **GeoIP Resolution**: Resolves country, city, and geographical map coordinates for external IPs.
- **IP Reputation Database**: Tracks historical intrusion attempts and WAF block history per source IP.
- **Threat Actor Profiling**: Categorizes IP activities (Scanner, Brute-Force Bot, Exploit Probe).
