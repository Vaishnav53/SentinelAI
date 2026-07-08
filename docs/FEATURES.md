# Feature Reference — SentinelAI

This document provides a detailed functional review of the security monitoring, visualization, and active defense features built into SentinelAI.

---

## 📈 Dashboard & Command Center

The core dashboard forms a locked, single-shell view to maintain UI stability under 100% browser zoom. It exhibits:
* **System Vitals Dashboard**: Displays live metrics (CPU usage, RAM allocation, IO writes, open ports count) gathered from the host system using `psutil`.
* **Geographical Threat Map**: Plots geolocation coordinate rings for active intrusion source IPs based on automatic GeoIP resolution.
* **Correlated Threat Indicators**: Provides progress dials showing active honeypot status and average response latencies.
* **Real-time Logs Feed**: Employs WebSockets to instantly stream normalized network events.

---

## 🤖 AI Security Copilot Workspace

The Copilot workbench is an advanced interactive workspace:
* **Interactive SSE Streaming**: Uses FastAPI server-sent events (`data: ` JSON chunks) to display live responses from Groq Cloud models (`llama-3.3-70b-versatile`) in real time.
* **Threat Telemetry Context**: Automatically loads variables from an attached attack log to build matching system prompt instructions.
* **Dynamic Markdown Parser**: Parses and styles ordered lists (`1. `, `2. `), headings (`### `), and bold text (`**bold**`).
* **High-Fidelity Code Badges**: Identifies inline ticks and wraps text within a distinct, syntax-highlighted `.inline-code-badge` block.
* **Interactive IP Addresses & MITRE tags**: Highlights IPs and MITRE technique codes (`T1059`). Clicking an IP address queries the threat intelligence lookup dashboard.

---

## 🛡️ Decoy Honeypot Lab

A collection of active deception sensors simulating vulnerable listening services:
* **Multiple Decoy Ports**: Emulates services like Telnet (Port 23), HTTP admin panels (Port 80/8080), SSH interfaces (Port 22/2222), and SMB databases.
* **Path Traversal Traps**: Actively tracks path traversal payload patterns (e.g. `../../etc/passwd` or `..\..\windows\win.ini`) to trigger high-severity alerts.
* **Signature Detection**: Scans SQL injection attempts (`UNION SELECT`, `' OR 1=1`) and cross-site scripting (`<script>`) tags.

---

## 🔬 Active Sandbox Environment

Provides a secure inspection workbench for analyzed threats:
* **Payload Upload Node**: Analysts can copy-paste raw payloads or upload mock binary scripts to inspect security metadata.
* **Heuristics Parser**: Computes hash values (MD5, SHA256) and parses commands, scripts, or executables for signature matching.
* **Isolated Emulation Logs**: Simulates system calls or routing alterations inside isolated runtime mocks, printing output step logs to the user interface.

---

## 📋 Active Playbooks Engine

Automates host actions and mitigation policies:
* **Active Defense Actions**: Translates AI recommendations into shell operations (e.g., locking network ports, dropping traffic from attacker subnets, generating host configuration files).
* **Mitigation Workflows**: A set of step-by-step checklists to confirm actions like firewall rules review, vulnerability patches application, and log reviews.
* **Audit Trails**: Logs the action execution time, analyst name, and target host variables for compliance reports.
