# Development Roadmap — SentinelAI

This roadmap tracks completed engineering milestones and planned future capabilities for the SentinelAI platform.

---

## ✅ Completed Milestones

### Core Platform Foundation (Phases 1–13)
* **Log Ingestion & Normalization**: Built the core logging server with SQLAlchemy schema mapping.
* **Intrusion Sensing**: Deployed multi-protocol decoy sensors (HTTP, SSH, FTP, Telnet).
* **Correlation Engine**: Implemented cross-source threat correlation and incident aggregation.
* **Decoy Sandbox**: Created YARA signature matching and file payload heuristics.
* **Active Defense WAF**: Added real-time SQLi, XSS, and path traversal inspection with an active IP quarantine blocklist.
* **SOC Console UI**: Built real-time WebSocket telemetry streaming, system vitals charts, and geographical threat map.

### Groq Integration & Viewport Stability (Phase 14)
* **High-Speed Cloud AI**: Integrated Groq Cloud API (`llama-3.3-70b-versatile`) as the primary low-latency LLM provider.
* **Secure Environment Handling**: Mapped `GROQ_API_KEY` to load securely from `backend/.env` without exposing secrets to source control.
* **Streaming Completions**: Built SSE streaming choices inside `/api/agent/chat/stream` for real-time agent responses.
* **Viewport Stability**: Refactored `index.css` and layout containers to maintain a locked, single-shell view under 100% browser zoom.

### AI Copilot Upgrade (Phase 15A)
* **Context Ingestion Engine**: Configured backend `/chat` and `/chat/stream` endpoints to construct `[ATTACK EVENT CONTEXT]` blocks from database records and inject them into system prompts.
* **Quick Scans Dispatcher**: Created parameter-aware prompt triggers binding target IP, port, protocol, and payload details.
* **Tokenizing Markdown Parser**: Built a custom Markdown tokenizer rendering inline code badges, MITRE technique tags, IP address lookups, and bold formatting without text collision.

### AI Investigator Workspace (Phase 15B)
* **Dual-Tab Workspace Layout**: Added Telemetry and Investigator tabs inside the AI Assistant page (`/agent`).
* **Threat Context Linkage**: Built an interactive threat context selection panel binding active incidents and attack events directly to AI analysis prompts.
* **7 Structured AI Investigation Actions**: Implemented automated action triggers:
  1. *Analyze Incident*
  2. *Explain Severity*
  3. *Extract IOCs*
  4. *Recommend Containment*
  5. *Map to MITRE*
  6. *Generate Timeline*
  7. *Executive Summary*
* **Dual AI Provider Architecture**: Seamless switching and fallback between Groq Cloud (`llama-3.3-70b-versatile`) and local Ollama (`llama3.2:3b`).

### Deployment Foundation & Hybrid Setup (Phase 16)
* **Containerized Orchestration**: Created `docker-compose.yml` orchestrating FastAPI backend, static Nginx reverse proxy, and PostgreSQL database.
* **Nginx Reverse Proxy**: Configured `nginx.conf` for HTTP/HTTPS proxying, API routing, and WebSocket upgrading (`/api/attacks/ws`).
* **Database Backup & Recovery**: Built automated database backup (`scripts/db_backup.sh`) and restore (`scripts/db_restore.sh`) scripts.

---

## 🔮 Future Roadmap (Postponed / Future Scope)

### Phase 17 — Advanced SIEM Query Exporter
* **Goal**: Provide automated SIEM query generation for detected intrusion vectors.
* **Actions**: Export threat indicators into Splunk SPL, Elastic DSL, and Azure Sentinel KQL formats.

### Phase 18 — Multi-Agent Remote Telemetry Forwarders
* **Goal**: Expand telemetry collection beyond single-host environments.
* **Actions**: Deploy lightweight agent forwarders shipping telemetry over HTTPS/WebSockets from remote VMs to the primary SentinelAI SOC console.

### Phase 19 — Enterprise Authentication & Role-Based Access
* **Goal**: Secure multi-user access for collaborative SOC teams.
* **Actions**: Implement RBAC (Role-Based Access Control), OIDC/LDAP integration, and audit logging tables.

### Postponed Features (Explicitly Reserved for Future Iterations)
* **Voice Input / Output Controls**: Hands-free voice commands and audio report generation.
* **Dynamic Honeypot IP Rotation**: Randomized decoy IP generation.
* **Multi-Agent Autonomous Malware Reverse Engineering**: Automated assembly disassembly pipelines (Phase 15C+ roadmap).
