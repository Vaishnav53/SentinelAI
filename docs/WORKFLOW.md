# Operations Workflow — SentinelAI

This document outlines the step-by-step lifecycle of a threat alert within the SentinelAI ecosystem, from the initial sensor trigger to active AI mitigation rules generation.

---

## 🔄 Lifecycle of a Threat

```text
 [Attacker Activity]
         │
         ▼
 1. Decoy Sensors Triggered  (Port Probe, SQL Injection attempt, Credentials trial)
         │
         ▼
 2. Ingestion & Logging      (FastAPI parses payload, performs GeoIP, writes to DB)
         │
         ▼
 3. Correlation Engine       (Alert grouped, threat score aggregated)
         │
         ▼
 4. Live Broadcast           (WebSockets push telemetry update to Dashboard)
         │
         ▼
 5. Copilot Context Mount    (Analyst clicks 'Analyze', context loads into chat prompt)
         │
         ▼
 6. Action Generation        (Analyst triggers WAF block, MITRE maps, or IOC report)
         │
         ▼
 7. Mitigation Complete      (Active defense rule generated, event marked Mitigated)
```

---

## 🛡️ Step-by-Step Operations Guide

### Step 1: Intrusion Sensing
A malicious agent tries to probe the environment (e.g., executing a directory traversal `/etc/passwd` request on a mock Web Decoy port, or testing default root credentials on SSH Port 2222). The decoy engine intercepts this connection.

### Step 2: Log Normalization
The backend parses the network packets:
* Reconstructs HTTP headers or SSH command lines.
* Validates source IP and destination port.
* Computes an initial **Confidence Score** and a **Threat Severity Index** based on signatures.
* Runs a local GeoIP database lookup to resolve the source location (City, Country).
* Saves the record as an `AttackEvent` inside the database.

### Step 3: Correlation & Aggregation
The **Correlation Engine** runs in the background. If a single IP triggers multiple events within a 60-second window, it aggregates these events. It generates a **Correlated Incident** (e.g., "SSH Brute Force Campaign" or "Multi-port Probe Scan") and calculates a cumulative Threat Score.

### Step 4: Real-time Alerting
The incident and attack details are serialized to JSON and broadcast via standard WebSockets. The React frontend receives the payload:
* The Live Logs ticker adds the new line immediately.
* Visual counters (Total Threat Alerts, Active Sensors) increment dynamically.
* The Geographical Threat Map highlights a new alert flash at the source GeoIP coordinates.

### Step 5: Context-Aware Copilot Analysis
1. The SOC analyst spots a high-severity alert in the feed.
2. Clicking **Analyze with AI Copilot** redirects them to the `/agent` workspace.
3. The page URL holds the query parameter `?analyze_attack=<id>`.
4. The system loads the incident telemetry directly into the right-side **Threat Telemetry Context** sidebar.
5. Behind the scenes, the FastAPI endpoint `/api/agent/chat/stream` loads this event state and appends it to the system instructions block.

### Step 6: Triggering Quick Scans
Instead of composing prompt instructions manually, the analyst clicks one of the sidebar **Quick Scans**:
* **Explain Attack**: Sends the target port, type, and payload details, asking for an threat synopsis.
* **Map to MITRE**: Queries the AI to map the payload characteristics (e.g. `T1059.004` Unix Shell script execution) to MITRE techniques.
* **Recommend Firewall Rule**: Extracts the attacker IP and asks the AI to construct immediate routing filters.

### Step 7: Rule Deployment
The AI streams back the proposed block rules. The analyst copies the generated configuration (e.g. `iptables -A INPUT -s 192.168.1.50 -j DROP`) and marks the incident as **Mitigated** on the console dashboard, resolving the threat.
