# 01 — Project Vision and Scope

> [!NOTE]
> **Design Specification**: This document serves as an initial vision specification. For current live platform vision and implementation details, refer to [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) and [FEATURES.md](FEATURES.md).

---

## Vision Statement

Build a visually polished, technically credible and safe AI-powered cyber-defense command center that can run on local workstations and containerized hybrid setups, demonstrating modern SOC workflows and threat telemetry analysis.

## Core Outcomes

- Detect and classify activity captured by local honeypots and active WAF rules.
- Visualize attacks and system state in real time via WebSockets.
- Explain incidents and extract IOCs using AI analysis.
- Map threat activity to MITRE ATT&CK techniques.
- Produce executive PDF compliance and CSV reports.
- Offer a clean foundation for future threat-intelligence and response integrations.

## In Scope for Stable Release (v0.15.2)

- FastAPI backend & React/Vite frontend
- SQLite & PostgreSQL support
- Multi-protocol decoy honeypots (HTTP 8088, SSH 2222, FTP 2121, Telnet 2323)
- Real-time WebSocket threat stream (`/api/attacks/ws`)
- System vitals monitoring
- AI Security Copilot & AI Investigator Workspace (7 structured actions)
- Active WAF Manager and Decoy Sandbox Environment
- Report generation (PDF & CSV)
- MITRE ATT&CK mapping
- Containerized Hybrid Deployment Support (Docker Compose & Nginx)

## Future Scope

- Authentication and RBAC (Role-Based Access Control)
- Distributed multi-agent remote sensors
- Cloud SIEM exporter integrations (Splunk SPL, Elastic DSL, KQL)
- Hands-free voice I/O controls (postponed)
- Dynamic honeypot IP rotation (postponed)

## Explicitly Out of Scope

- Unauthorized scanning
- Automated exploitation
- Malware creation or distribution
- Destructive actions against unauthorized targets
