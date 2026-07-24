# Feature Reference — SentinelAI

This document provides a comprehensive specification of every monitoring, visualization, threat detection, AI analysis, and active defense feature implemented in SentinelAI.

---

## 📈 1. Dashboard & SOC Command Center
* **Single-Shell Layout**: Optimized for high-density SOC monitoring under 100% browser zoom.
* **System Vitals Bar**: Real-time host CPU usage, RAM allocation, Disk I/O, and open ports count gathered via `psutil`.
* **Dynamic Threat KPIs**: Live counters for Total Threats Captured, Active Threat Level, AI Confidence Rating (98.4%), and Online Sensors count.
* **Geographical Threat Map**: Plots IP geolocation coordinate rings for active intrusion source IPs based on automatic GeoIP resolution.
* **Real-time Activity Stream**: Uses WebSockets (`/api/attacks/ws`) to stream normalized security events directly to the console without polling delay.

---

## ⚡ 2. Incident Response (`/attacks`)
* **Real-Time Attack Feed**: Displays a scrollable, real-time list of all captured security events across host metrics, WAF filters, and honeypot sensors.
* **Multi-Criteria Filters**: Filter events by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), protocol (`TCP`, `UDP`, `HTTP`, `SSH`), and keyword search.
* **Payload Inspection**: View raw request headers, command buffers, source/destination IPs, ports, and GeoIP details for any attack event.

---

## 🌿 3. Threat Correlation Engine (`/correlation`)
* **Graph Visualization**: Renders an interactive threat correlation node graph linking source IPs, attack vectors, and targeted services.
* **Incident Clustering**: Groups related micro-events (e.g. repeated SSH login attempts + HTTP path traversal) into aggregated **Correlated Incidents**.
* **Threat Score Weighting**: Computes dynamic 0–100 risk scores based on attack frequency, severity, and payload signatures.
* **MITRE ATT&CK Mapping**: Cross-references correlated incidents to specific MITRE tactics and techniques (e.g., T1110, T1059, T1190).

---

## 🌐 4. Threat Intelligence & GeoIP Lookup (`/attackers`)
* **IP Reputation Database**: Tracks historical intrusion attempts per source IP address.
* **GeoIP Resolution**: Resolves country, city, ISP, and geographic coordinates for external source IPs.
* **Threat Actor Profiling**: Classifies persistent IPs into threat categories (e.g., Scanner, Brute-Force Bot, Exploit Probe).

---

## 🔬 5. Decoy Sandbox Environment (`/sandbox`)
* **Mock File Ingestion Node**: Drag-and-drop or paste raw file payloads and suspicious scripts for security scanning.
* **Heuristics & Signatures**: Calculates MD5 and SHA256 hashes, matching payload strings against YARA signature rules.
* **Behavioral Analysis**: Classifies file risk levels (Clean, Suspicious, Malicious) and logs simulated execution events.

---

## 🛡️ 6. WAF Manager & Active Defense (`/waf`)
* **Real-Time Attack Inspection**: Intercepts HTTP request parameters for SQL Injection (`UNION SELECT`, `' OR 1=1`), Cross-Site Scripting (`<script>`), and Path Traversal (`../../etc/passwd`).
* **IP Quarantine Blocklist**: Automatically blocks offending IPs exceeding threat score thresholds, offering manual block/unblock controls.
* **Active Rule Configuration**: Toggle specific WAF rules and inspect live interception statistics.

---

## 📻 7. Decoy Honeypot Lab (`/sensors`)
* **Multi-Protocol Sensors**: Operates isolated Python socket listeners emulating common protocol services:
  * **HTTP Decoy Sensor** (Port `8088`): Captures web exploits and directory scans.
  * **SSH Decoy Sensor** (Port `2222`): Captures credential brute-force attempts.
  * **FTP Decoy Sensor** (Port `2121`): Captures anonymous login attempts and file scans.
  * **Telnet Decoy Sensor** (Port `2323`): Captures IoT botnet reconnaissance.
* **Trap Logs & Statistics**: Real-time activity feeds, sensor health status, and hit counter breakdown.

---

## 🤖 8. AI Security Copilot & AI Investigator Workspace (`/agent`)
* **Dual-Tab Interface**:
  * **Telemetry Tab**: Interactive AI chat assistant, model status display, active target linkage, and quick defensive prompt triggers.
  * **Investigator Tab (Phase 15B)**: Dedicated incident/attack selection panel with **7 Structured AI Investigation Actions**:
    1. `Analyze Incident`: Deep diagnostic breakdown of the selected threat event.
    2. `Explain Severity`: Contextual explanation of the assigned risk rating.
    3. `Extract IOCs`: Automated extraction of IP addresses, domains, hashes, and payload patterns.
    4. `Recommend Containment`: Step-by-step mitigation and containment guidance.
    5. `Map to MITRE`: Automatic cross-referencing with MITRE ATT&CK tactics and techniques.
    6. `Generate Timeline`: Reconstruction of event sequences leading up to the incident.
    7. `Executive Summary`: High-level non-technical summary tailored for leadership.
* **AI Provider & Fallback**:
  * **Groq Cloud Integration**: Primary live LLM provider using `llama-3.3-70b-versatile` for high-speed cloud inference.
  * **Deterministic Local Fallback Engine**: When Groq is unavailable or unconfigured, SentinelAI uses a deterministic local fallback response engine to supply structured incident analyses.

---

## 📄 9. Executive Reports Generator (`/reports`)
* **PDF Compliance Reports**: Generates downloadable executive compliance PDF documents containing threat statistics, incident breakdowns, and security recommendations.
* **CSV Exports**: Export raw incident and attack event logs into CSV files for external audit and SIEM integration.

---

## ⚙️ 10. Settings & Thresholds (`/settings`)
* **AI Settings**: View AI status and threshold settings.
* **Severity Thresholds**: Adjust threat score multipliers and alert sensitivity limits.
* **System Preferences**: Configure refresh intervals and theme options.

---

## 🔌 11. WebSocket Real-Time Telemetry
* Streaming WebSocket endpoint (`ws://127.0.0.1:8000/api/attacks/ws`) pushes live threat events, honeypot traps, and sandbox alerts to connected client views without page reloads.

---

## 🌐 12. Online vs. Offline Operational Capabilities
* **Primary Live Inference**: Groq Cloud API provides live cloud inference for AI Copilot chat and investigation actions when internet connectivity and `GROQ_API_KEY` are active.
* **Local Fallback Mode**: When offline or unconfigured, all core telemetry, attack feeds, correlation engine, sandbox analysis, WAF active defense, honeypot sensors, PDF report generation, and deterministic local AI fallback responses function locally.

---

## 🔮 13. Future Features (Postponed Work)
* **Voice Input / Output Controls**: Hands-free voice commands and spoken summaries (postponed).
* **Dynamic Honeypot IP Rotation**: Randomized honeypot IP generation (postponed).
* **Autonomous Reverse Engineering**: Multi-agent disassembly pipeline (Phase 15C+ roadmap).
