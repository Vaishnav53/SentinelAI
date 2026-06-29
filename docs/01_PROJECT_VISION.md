# 01 — Project Vision and Scope

## Vision statement

Build a visually polished, technically credible and safe AI-powered cyber-defense command center that can run on a Windows development laptop and demonstrate modern SOC workflows without depending on cloud AI.

## Core outcomes

- Detect and classify activity captured by local honeypots.
- Visualize attacks and system state in real time.
- Explain incidents using a local AI model.
- Map activity to MITRE ATT&CK.
- Analyze Windows event logs.
- Produce technical and executive reports.
- Offer a clean platform for future threat-intelligence and response integrations.

## In scope for the first stable release

- Local user, single-workstation deployment
- FastAPI backend
- React frontend
- SQLite
- HTTP honeypot
- Simulated lab sensors
- WebSocket alerting
- Local monitoring
- Ollama model discovery and chat
- Report generation
- MITRE mapping
- Windows log ingestion
- Settings and retention controls

## Later scope

- Authentication and RBAC
- PostgreSQL
- Distributed sensors
- Multi-tenant deployments
- Cloud collectors
- Full SIEM integrations
- SOAR playbooks
- Container orchestration
- Message queues
- Advanced IOC enrichment

## Explicitly out of scope

- Unauthorized scanning
- Automated exploitation
- Malware creation
- Offensive persistence
- Credential theft
- Destructive actions
- Third-party target testing without authorization
