# Project Overview — SentinelAI

SentinelAI is an advanced, local-first Security Operations Center (SOC) simulation, threat telemetry correlation, and AI-driven incident response platform. Built to run efficiently in local environments and containerized hybrid deployments, SentinelAI combines multi-protocol decoy sensors, real-time log ingestion, active defense WAF capabilities, and AI analysis to automate threat detection and incident investigation.

---

## 🎯 Problem & Motivation

Modern Security Information and Event Management (SIEM) platforms capture massive volumes of log telemetry, but security analysts are routinely overwhelmed by false positives and fragmented alert channels. Manual triage of raw payloads, IP reputations, and multi-stage attack patterns slows down incident response and increases mean time to detect (MTTD) and respond (MTTR).

Furthermore, traditional Intrusion Detection Systems (IDS) often function as passive alerting mechanisms without providing immediate contextual investigation tools or integrated containment guidance.

---

## 🚀 Key Objectives

1. **Integrated Threat Sensing**: Collect and normalize security telemetry from active WAF filters, multi-protocol decoy honeypots (HTTP, SSH, FTP, Telnet), and system logs.
2. **Automated Incident Correlation**: Group related micro-events into high-fidelity correlated incidents using multi-factor threat scoring and timeline clustering.
3. **AI-Assisted Investigation**: Provide a dedicated dual-tab AI Copilot and AI Investigator Workspace that automatically binds threat context to perform 7 structured security analyses (incident breakdown, IOC extraction, severity explanation, containment advice, MITRE ATT&CK mapping, timeline generation, and executive summaries). Groq Cloud is the primary live LLM provider. When Groq is unavailable or unconfigured, SentinelAI uses a deterministic local fallback response engine.
4. **Active Defense & Countermeasures**: Enable instant IP quarantine, WAF rule creation, and automated response playbooks.
5. **Local-First & Hybrid Ready**: Offer a privacy-conscious, local-first development model alongside a containerized hybrid deployment foundation (Docker Compose, Nginx, PostgreSQL, database backup automation).

---

## 🧩 Core Modules

### 1. Dashboard & SOC Command Center
* Provides real-time threat KPIs (Total Threats, Threat Level, AI Confidence, Online Sensors), live attack activity feeds, and system resource monitoring (CPU, Memory, Disk).

### 2. Incident Response (`/attacks`)
* Real-time attack feed, filtering, payload inspection, and incident actions. Ingests normalized security events via WebSockets, allowing filtering by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), protocol, and raw payload contents.

### 3. Threat Correlation Engine
* Clusters multi-vector attack events from distinct sensors into unified **Correlated Incidents**, calculating composite threat scores and mapping events to MITRE ATT&CK techniques.

### 4. Decoy Honeypot Lab
* Emulates multi-protocol deception traps (HTTP on 8088, SSH on 2222, FTP on 2121, Telnet on 2323) to capture recon probes, path traversal attempts, and credential brute-force attacks safely without exposing internal assets.

### 5. Decoy Sandbox Environment
* Ingests suspicious file artifacts and payloads, running YARA signature rules, structural classification, and behavioral risk scoring.

### 6. WAF Manager & Active Defense
* Provides real-time inspection for SQL Injection (SQLi), Cross-Site Scripting (XSS), and path traversal attacks, maintaining an active IP quarantine blocklist.

### 7. AI Security Copilot & AI Investigator Workspace (Phase 15B)
* Features a dual-tab interface:
  * **Telemetry Tab**: Real-time AI chat assistant, model selection status, and quick prompt triggers.
  * **Investigator Tab**: Incident & attack context selection panel supporting **7 Structured AI Investigation Actions**:
    1. *Analyze Incident*
    2. *Explain Severity*
    3. *Extract IOCs*
    4. *Recommend Containment*
    5. *Map to MITRE*
    6. *Generate Timeline*
    7. *Executive Summary*

### 8. Executive Reports Generator
* Generates downloadable PDF compliance reports and CSV incident exports.

### 9. Hybrid Deployment Foundation (Phase 16)
* Includes Docker Compose orchestration, Nginx reverse proxy configuration, PostgreSQL database integration, and automated database backup/restore scripts (`scripts/db_backup.sh`, `scripts/db_restore.sh`).

---

## 👤 Target Audience & Benefits

* **SOC Analysts & Incident Responders**: Accelerates triage with automated IOC extraction, threat correlation graphs, and structured AI investigation playbooks.
* **Security Engineers & Administrators**: Offers a flexible testbed for active WAF rule testing, deception deployment, and containerized hybrid setup.
* **Cybersecurity Students & Educators**: Serves as an interactive laboratory for analyzing real-world attack payloads and learning MITRE ATT&CK mappings.

---

## 📋 Current Scope vs. Future Scope

### Current Implemented Scope (v0.15.2):
* Complete SOC Dashboard, Incident Response (`/attacks`), Correlation Engine, Honeypot Lab, Sandbox, WAF Manager, AI Copilot & AI Investigator Workspace, PDF Reports, and Hybrid Deployment Foundation.

### Future Scope (Postponed Work):
* Voice input/output controls (hands-free audio interface).
* Dynamic honeypot IP rotation.
* Multi-agent autonomous malware reverse engineering (Phase 15C+).
