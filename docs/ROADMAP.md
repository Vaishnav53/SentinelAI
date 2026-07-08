# Development Roadmap — SentinelAI

This roadmap tracks the completed phases and planned future integrations for the SentinelAI platform.

---

## ✅ Completed Milestones

### Core Platform (Phases 1-13)
* **Log Pipeline & Normalization**: Built the core logging server with database storage schema support.
* **Intrusion Sensing**: Deployed decoy honeypots simulating active ports.
* **Correlations Engine**: Implemented brute force and scanning alerts grouping.
* **Active Sandbox**: Safe mock execution tracking for threat uploads.
* **Platform UI**: Real-time WebSockets dashboards, visual vitals charts, and geographical maps.

### Groq Integration & Viewport Stability (Phase 14)
* **Provider Migration**: Transitioned from local Ollama latency constraints to high-speed Groq Cloud API connections.
* **Secure Environment Handling**: Mapped `GROQ_API_KEY` to load securely from `backend/.env` without exposing secrets to source control.
* **Streaming completions**: Integrated SSE streaming connections inside `/chat/stream` for live agent replies.
* **Layout Stability Patch**: Refactored `index.css` and layout cards styling to prevent horizontal page scrolling and shifts.

### AI Copilot Upgrade (Phase 15A)
* **Context Ingestion Router**: Configured the backend `/chat` and `/chat/stream` endpoints to build a detailed `[ATTACK EVENT CONTEXT]` block from database records and append it to system inputs.
* **Quick Scans Dispatcher**: Replaced generic quick actions with dynamic, parameter-aware scripts incorporating the active IP, port, protocol, and payload.
* **Tokenizing Markdown Parser**: Built a state-based tokenizer to properly format bold characters, MITRE technique tags, IP addresses, percentages, and inline code badges without collision.

---

## 📅 Upcoming Roadmap

### Phase 15B — Security SIEM Queries Generator
* **Goal**: Provide automated SIEM queries mapping for detected intrusion vectors.
* **Actions**: Integrate a quick button to export queries in common formats:
  * Elasticsearch DSL
  * Splunk Search Processing Language (SPL)
  * Azure Sentinel Kusto Query Language (KQL)

### Phase 16 — Advanced Playbook Automation
* **Goal**: Allow playbooks to execute real active defense actions on the host machine.
* **Actions**: Develop script templates to trigger safe system calls (e.g. updating local iptables or firewall configurations) with manual confirmation confirmations.

### Phase 17 — Multi-Agent Sensor Aggregation
* **Goal**: Expand telemetry monitoring beyond the local host.
* **Actions**: Implement a lightweight remote telemetry forwarder client that ships metrics over HTTPS/WebSockets from auxiliary virtual machines to the primary SentinelAI command dashboard.

### Phase 18 — Enterprise Authentication & Audit Logs
* **Goal**: Secure console access for collaborative environments.
* **Actions**: Add LDAP/Active Directory or OIDC client login handlers, and audit trail tables logging analyst actions.
