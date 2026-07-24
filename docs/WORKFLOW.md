# Operations Workflow — SentinelAI

This document outlines the end-to-end security lifecycle of a threat alert within SentinelAI, tracking an attack from initial sensor detection through automated enrichment, correlation, AI-assisted investigation, mitigation, and reporting.

---

## 🔄 Complete Threat Lifecycle Flow

```text
       [ 1. Attack Execution ]
                 │ (Probes, Exploit Payloads, Brute Force)
                 ▼
      [ 2. Sensor Detection ]
                 │ (Decoy Honeypots, WAF Engine, Host Metrics)
                 ▼
      [ 3. Data Enrichment ]
                 │ (GeoIP Lookup, Severity Indexing, Payload Normalization)
                 ▼
    [ 4. Incident Correlation ]
                 │ (Correlation Engine, Risk Score Aggregation, MITRE Mapping)
                 ▼
      [ 5. Incident Creation ]
                 │ (CorrelatedIncident Entity, Real-time WebSocket Broadcast)
                 ▼
       [ 6. AI Analysis ]
                 │ (AI Copilot & AI Investigator Workspace 7-Action Triage)
                 ▼
       [ 7. Active Mitigation ]
                 │ (WAF IP Blocklist, Playbooks, Firewall Rule Execution)
                 ▼
       [ 8. Executive Reporting ]
                 │ (PDF Compliance Reports & CSV Incident Log Export)
```

---

## 🛡️ Step-by-Step Security Operations Guide

### Step 1: Intrusion & Attack Sensing
* A threat actor or automated bot sends malicious network traffic targeting the environment (e.g., executing a directory traversal request `/etc/passwd` on HTTP Honeypot Port `8088`, probing SSH Port `2222`, or sending a SQL Injection payload `' UNION SELECT 1,2,3--`).
* The active sensor (Honeypot Decoy or WAF Active Defense) intercepts the connection safely.

### Step 2: Log Normalization & Detection
* The backend parses raw packet buffers, HTTP headers, or command strings.
* Validates source IP, target port, protocol, and attack signature.
* Assigns an initial **Threat Score** (0–100) and **Severity Classification** (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).

### Step 3: Telemetry Enrichment
* **GeoIP Resolution**: Resolves country, city, and geographical coordinates for external source IPs.
* **IP Reputation Check**: Cross-references source IP against historical incident records in the database.
* **Payload Hashing**: Computes MD5/SHA256 digests for ingested file artifacts.

### Step 4: Correlation Engine Processing
* The **Threat Correlation Engine** groups related micro-events occurring within temporal windows or sharing source IPs.
* Aggregates threat scores and maps activities to MITRE ATT&CK techniques (e.g., `T1110` Brute Force, `T1190` Exploit Public-Facing Application).

### Step 5: Incident Creation & Live Alerting
* Saves the aggregated event as a `CorrelatedIncident` record.
* Broadcasts the update via WebSockets (`/api/attacks/ws`) to all connected client browsers.
* The frontend SOC Command Center UI dynamically updates KPIs, live activity tickers, and threat map coordinates without page reloads.

### Step 6: AI Security Copilot & AI Investigator Triage
1. The analyst spots an alert in `Incident Response (/attacks)` or selects an active threat or incident in the **AI Assistant Workspace** (`/agent`).
2. **Telemetry Tab**: Analysts can engage in interactive chat with the AI (Groq Cloud `llama-3.3-70b-versatile` or deterministic local fallback engine).
3. **Investigator Tab**: Analysts choose an incident from the threat context dropdown and execute one of **7 Structured AI Investigation Actions**:
   * *Analyze Incident*
   * *Explain Severity*
   * *Extract IOCs*
   * *Recommend Containment*
   * *Map to MITRE*
   * *Generate Timeline*
   * *Executive Summary*

### Step 7: Active Mitigation & Countermeasures
* Analysts review the AI's recommendations and apply containment steps:
  * **WAF IP Quarantine**: Add offending source IP to the active WAF blocklist via `/waf`.
  * **Playbook Execution**: Execute pre-configured firewall block rules (`iptables` / PowerShell rules).
  * **Status Update**: Change incident status to `Under Investigation` or `Mitigated`.

### Step 8: Executive Reporting & Compliance
* Navigate to **Reports** (`/reports`) to generate a downloadable executive compliance PDF report summarizing total attacks, top threat vectors, sensor activity, and mitigation logs.
* Export raw incident logs to CSV format for external auditing and team reviews.
