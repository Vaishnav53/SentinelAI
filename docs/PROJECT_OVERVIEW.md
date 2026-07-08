# Project Overview — SentinelAI

SentinelAI is an advanced, local-first Security Operations Center (SOC) simulation and threat mitigation platform. Designed to run seamlessly in local developer environments and small-to-medium enterprises, SentinelAI merges telemetry gathering sensors with artificial intelligence to offer automated threat analysis, behavior tracking, and countermeasures deployment.

---

## 🎯 Vision & Purpose
In traditional enterprise cybersecurity, Security Information and Event Management (SIEM) tools capture vast amounts of log data, but sorting signal from noise requires specialized, manual analysis. On the other hand, traditional intrusion detection systems (IDS) act as passive alert generators.

SentinelAI bridges this gap by creating a closed-loop system:
1. **Intrusion Sensing**: Host metrics, Active Honey-pot decoys, and sandbox interfaces capture initial threats.
2. **AI Translation**: High-speed Large Language Models (LLMs) parse raw payload binaries, command patterns, and system call profiles to isolate intent.
3. **Countermeasure Routing**: The analyst is provided with immediate, high-context threat intelligence and interactive controls to trigger network isolation playbooks or firewall filters.

---

## 🧩 Core Modules

### 1. Decoy Honeypot Lab
Operates as a safe emulation sandbox hosting common protocols (SSH, FTP, HTTP, SMB). It captures scan signatures, path traversal parameters, brute force credential attempts, and command payloads without exposing critical internal assets.

### 2. Live Attack Feed
Ingests syslogs, system logs, and honeypot alerts, normalizing them using SQLAlchemy models and streaming them to the front-end dashboard via WebSockets.

### 3. Correlation Engine
Groups related micro-events (e.g. repeated failed logins on port 22, directory scans on port 80) into a unified, high-level **Correlated Incident** with an assigned threat score.

### 4. Interactive AI SOC Copilot
An SSE streaming-based chat interface. When an incident is selected, its database record is automatically injected into the AI's system prompt context. Analysts can run contextual quick actions like **Recommend Firewall Rule** or **Map to MITRE** with a single click.

### 5. Playbook & Response Engine
A set of pre-configured workflow playbooks designed to execute mitigation commands (e.g., locking access to an IP, blocking a specific port, generating routing modifications).

---

## 👤 Target Audience & Value

* **SOC Analysts & Threat Hunters**: Provides a high-fidelity testbed to study malware payload behaviors, simulate attackers, and test custom WAF filters.
* **Security Engineers**: Serves as a reference architecture for integrating AI completion agents safely within automated incident response pipelines.
* **Academic & Training labs**: A sandbox simulation suite to teach junior analysts how log patterns correlate directly to MITRE ATT&CK techniques.
