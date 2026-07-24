# 10 — AI Assistant & AI Investigator Workspace

## Purpose
Provide an intelligent cybersecurity copilot and structured incident investigation workspace for security analysts. Groq Cloud is the primary live LLM provider. When Groq is unavailable or unconfigured, SentinelAI uses a deterministic local fallback response engine.

## Module Architecture & Features

### 1. Dual-Tab Workspace Interface
* **Telemetry Tab**:
  * AI status indicator and model selection dropdown.
  * Active target linkage to current security events.
  * Interactive natural-language security assistant chat stream with real-time response rendering via `POST /api/agent/chat/stream`.
  * Quick defensive prompt buttons (e.g., Explain Attack, Recommend Firewall Rule, Explain Payload, Map to MITRE, IOC Summary).
* **Investigator Tab (Phase 15B)**:
  * **Threat & Incident Context Panel**: Dropdown selector allowing analysts to select active security incidents from `Incident Response (/attacks)` or the correlation engine.
  * **Incident Metadata View**: Displays target IP, attack vector, severity classification, timestamp, and raw payload details.
  * **7 Structured AI Investigation Actions**:
    1. `Analyze Incident`: Deep diagnostic evaluation of attack vector and mechanics.
    2. `Explain Severity`: Contextual risk breakdown of severity scoring.
    3. `Extract IOCs`: Automated extraction of Indicators of Compromise.
    4. `Recommend Containment`: Actionable step-by-step mitigation and containment playbooks.
    5. `Map to MITRE`: Automatic cross-referencing with MITRE ATT&CK tactics and techniques (e.g., T1110, T1059, T1190).
    6. `Generate Timeline`: Chronological reconstruction of threat events.
    7. `Executive Summary`: High-level non-technical summary for SOC managers and leadership.

> [!NOTE]
> Structured investigation actions submit contextual prompts through implemented agent routes: streamed responses via `POST /api/agent/chat/stream` and structured threat summaries via `POST /api/agent/analyze/{attack_id}`.

### 2. AI Provider & Fallback Architecture
* **Primary Live Provider**: Groq Cloud API (`llama-3.3-70b-versatile`) configured via `GROQ_API_KEY` in environment variables.
* **Deterministic Local Fallback**: When Groq Cloud is unavailable or unconfigured, SentinelAI uses a deterministic local fallback response engine to supply structured incident guidance and threat summaries without breaking the analyst interface.

## Security & Guardrails
* **Defensive Focus Only**: Strict prompt engineering enforces defensive security analysis, threat explanation, incident triage, and remediation advice. Destructive or unauthorized offensive instruction requests are safely refused.

## Current Limitations
* Groq Cloud inference requires active internet connectivity and a valid API key.
* Complex multi-step automated remediation execution is guided via playbooks rather than fully unprompted autonomous execution.

## Future Scope (Postponed Work)
* **Voice Input / Output Controls**: Hands-free voice command input and audio report summaries (explicitly postponed for future releases).
* **Multi-Agent Orchestration**: Specialized sub-agents for autonomous malware disassembly and reverse engineering (Phase 15C+ roadmap).
