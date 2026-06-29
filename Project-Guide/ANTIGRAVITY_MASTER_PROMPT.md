# SENTINELAI — COMPLETE MASTER BUILD PROMPT FOR ANTIGRAVITY

You are the principal software architect and senior full-stack engineer responsible for building **SentinelAI**, a production-quality, local-first, AI-powered cyber-defense platform.

This is a long-term enterprise software project, not a demo and not a one-file prototype.

You must create the project from the beginning, establish the architecture, implement the backend and frontend, integrate local AI through Ollama, build the defensive honeypot and monitoring modules, and construct every page according to the uploaded visual reference images.

The workspace may be empty or may contain partial files. Before changing anything, inspect the workspace. If a complete fresh project does not exist, initialize it. If valid files already exist, preserve working code and migrate carefully instead of deleting unrelated functionality.

---

## 1. PROJECT NAME

**SentinelAI — AI-Powered Cyber Defense Platform**

Default local workspace:

```text
D:\AI-CyberShield
```

If the repository already uses another valid root, continue there and document it.

---

## 2. PRODUCT VISION

SentinelAI must become a professional SOC-style cyber-defense application containing:

- Enterprise SOC Dashboard
- Real-time Attack Feed
- Interactive Honeypot Lab
- ChatGPT-style AI Cyber Assistant
- Local multi-model Ollama support
- Streaming model responses
- Voice input and voice output
- Threat Intelligence
- MITRE ATT&CK mapping
- Windows Event Log collection and analysis
- Future Linux log collection
- Real-time system monitoring
- Incident-response workflows
- Dynamic report generation
- PDF, CSV and JSON exports
- WebSocket notifications
- Cyber Command Center visual design
- Modular, testable, production-quality architecture

The platform must remain defensive, local-first and safe.

---

## 3. NON-NEGOTIABLE SAFETY BOUNDARIES

Implement only defensive and authorized capabilities.

Allowed:

- Honeypot event capture
- Local lab monitoring
- Threat detection and classification
- IOC enrichment
- MITRE ATT&CK mapping
- Defensive recommendations
- Log collection from systems owned by the operator
- Blocking recommendations
- Simulated incident-response actions
- Explicitly confirmed local defensive actions

Do not implement:

- Autonomous exploitation
- Malware deployment
- Credential theft
- Persistence
- Evasion
- Destructive commands
- Attacks against third-party systems
- Background scanning of public networks without explicit authorization

Any future active-response feature must require visible user confirmation, audit logging and reversible actions.

---

## 4. REQUIRED TECHNOLOGY STACK

### Backend

- Python 3.11+
- FastAPI
- Uvicorn
- SQLAlchemy
- SQLite for the first stable release
- Pydantic
- WebSockets
- HTTPX for async service calls
- psutil for local monitoring
- pytest for tests
- Alembic-ready schema design
- Structured logging

### Frontend

- React
- React Router
- Vite preferred for a fresh project
- Axios or a centralized fetch wrapper
- Framer Motion
- Lucide React
- Recharts or another stable React chart library
- CSS modules or page-scoped CSS
- React hooks
- ESLint
- Vitest and React Testing Library

### Local AI

- Ollama
- Default host: `http://127.0.0.1:11434`
- Installed models currently expected:
  - `llama3.1`
  - `gemma`
- Future-ready:
  - `llama3`
  - `mistral`
  - `qwen`

Never hardcode only two model names. Discover installed models dynamically from Ollama and fall back safely.

---

## 5. REQUIRED ROOT STRUCTURE

Create this structure gradually. Do not create empty page folders before their phase begins.

```text
SentinelAI/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/
│   ├── core/
│   ├── database/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── collectors/
│   ├── honeypots/
│   ├── intelligence/
│   ├── reports/
│   ├── websocket/
│   ├── tests/
│   └── storage/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── app/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── routes/
│       ├── styles/
│       ├── utils/
│       └── assets/
├── docs/
├── scripts/
├── .gitignore
├── README.md
└── docker-compose.yml
```

---

## 6. PAGE ARCHITECTURE RULE

Create a page folder only when that page is being implemented.

Each page must be self-contained:

```text
frontend/src/pages/<feature>/
├── <Page>.jsx
├── <Page>.css
├── components/
├── hooks/
├── services/
├── utils/
└── assets/
```

Do not place an entire page in one giant JSX file.

Rules:

- One component, one responsibility
- Prefer files below 250–300 lines
- UI components stay in `components`
- State/data logic stays in `hooks`
- Page API calls stay in `services`
- Pure transforms stay in `utils`
- Shared reusable elements stay in `frontend/src/components`
- Do not duplicate common Card, Button, Modal, Badge, Loader or chart wrappers

---

## 7. VISUAL REFERENCE RULE

The uploaded page image for each phase is the single visual source of truth for that page.

For each page:

- Match layout hierarchy
- Match proportions
- Match spacing
- Match card dimensions
- Match typography hierarchy
- Match dark navy/cyan/purple visual language
- Match border opacity and glow intensity
- Match icons as closely as practical
- Match responsive behavior
- Avoid excessive scrolling
- Do not redesign unrelated pages
- Do not invent an alternative layout

Build for 1366×768 first, then verify 1920×1080.

Do not use screenshots as page backgrounds. Recreate the UI with real React components.

---

## 8. COMMON DESIGN SYSTEM

Use shared tokens, not random inline values.

Target palette:

```text
Background deep:      #020617
Surface primary:      #06101f
Surface secondary:    #081426
Surface elevated:     #0b1930
Cyan primary:         #00d4ff
Cyan bright:          #00f5ff
Blue:                 #2d8cff
Purple:               #8b5cf6
Green:                #00ff88
Yellow:               #ffd32a
Orange:               #ff9f43
Critical red:         #ff3860
Text primary:         #e5f7ff
Text secondary:       #9bb0c9
Text muted:           #6b7c9b
Border subtle:        rgba(0, 212, 255, 0.12)
Border active:        rgba(0, 212, 255, 0.45)
```

Use an 8px-based spacing system with compact SOC density.

Animations must be subtle and meaningful:

- Connection pulse
- New-event slide/fade
- Radar sweep
- Counter animation
- Chart draw
- Selected-card glow
- Thinking indicator
- Report progress
- Sensor online pulse

Respect `prefers-reduced-motion`.

---

## 9. BACKEND ARCHITECTURE

Use layered architecture:

```text
API router -> service -> repository/database or external integration
```

Do not place business logic directly in route handlers.

Implement:

- Central configuration
- CORS configuration from environment
- Structured error responses
- Health endpoints
- Service status registry
- WebSocket connection manager
- Database sessions
- Typed schemas
- Idempotent startup initialization
- Safe shutdown
- Logging with timestamps and severity
- Tests for critical services

Target backend modules:

- health
- attacks
- agent
- reports
- monitoring
- sensors
- honeypots
- mitre
- windows_logs
- settings
- websocket

---

## 10. DATABASE MODEL TARGETS

At minimum, design normalized models for:

- AttackEvent
- HoneypotSensor
- HoneypotSession
- CapturedRequest
- SystemMetric
- WindowsLogEvent
- Incident
- Report
- ReportJob
- AIConversation
- AIMessage
- MITREMapping
- ThreatIndicator
- ApplicationSetting
- AuditLog

Every major event should include:

- UUID or stable ID
- Created timestamp
- Updated timestamp where relevant
- Source/sensor identity
- Severity
- Status
- Raw metadata JSON when appropriate

Avoid schema changes without migration planning.

---

## 11. CORE API TARGETS

Base prefix:

```text
/api
```

Target endpoints include:

```text
GET  /api/health
GET  /api/health/services

GET  /api/attacks
GET  /api/attacks/{attack_id}
GET  /api/attacks/stats
POST /api/attacks/{attack_id}/status

GET  /api/sensors
GET  /api/sensors/{sensor_id}
POST /api/sensors/{sensor_id}/start
POST /api/sensors/{sensor_id}/stop

GET  /api/agent/models
GET  /api/agent/status
POST /api/agent/chat
POST /api/agent/chat/stream

GET  /api/monitoring/current
GET  /api/monitoring/history

POST /api/reports/jobs
GET  /api/reports/jobs
GET  /api/reports/jobs/{job_id}
GET  /api/reports/{report_id}/download

GET  /api/mitre/techniques
GET  /api/mitre/mappings

GET  /api/windows-logs
GET  /api/windows-logs/stats

GET  /api/settings
PUT  /api/settings
```

WebSocket targets:

```text
/ws/alerts
/ws/metrics
/ws/reports
/ws/agent
```

Do not open duplicate uncontrolled WebSocket connections. Implement reconnect backoff and cleanup.

---

## 12. OLLAMA INTEGRATION

Implement a dedicated `OllamaService`.

Requirements:

- Check Ollama status
- Discover installed models using Ollama API
- Default to `llama3.1` if installed
- Allow `gemma`
- Support future model additions without frontend rewrites
- Send selected model with every request
- Stream responses where supported
- Handle timeout and cancellation
- Return friendly errors when Ollama is offline
- Do not crash FastAPI
- Log model latency
- Keep conversations local
- Never send user content to a cloud provider by default

Expected local Ollama base URL:

```text
http://127.0.0.1:11434
```

---

## 13. HONEYPOT SCOPE

Begin with safe local honeypots:

- HTTP honeypot
- Simulated SSH listener
- Simulated FTP listener
- Simulated Telnet listener
- Decoy service profiles

Capture:

- Timestamp
- Source IP
- Source port
- Destination port
- Protocol
- Method
- Path
- Headers
- User agent
- Payload
- Attack classification
- Severity
- Sensor ID
- Session ID
- MITRE mapping where applicable

Do not build a vulnerable production service. Honeypots must be isolated, rate-limited and clearly documented as lab components.

---

## 14. IMPLEMENTATION PHASES

Execute in this order.

### Phase 0 — Repository and documentation
- Initialize root
- README
- `.gitignore`
- environment templates
- docs
- basic scripts

### Phase 1 — Backend foundation
- FastAPI app
- config
- database
- health APIs
- structured logging
- tests

### Phase 2 — Frontend foundation
- React/Vite
- routing
- shared layout
- sidebar
- design tokens
- API client
- error boundary
- toast system

### Phase 3 — Attack and honeypot foundation
- attack database model
- attack APIs
- HTTP honeypot
- classification service
- WebSocket alerts

### Phase 4 — Monitoring
- CPU, memory, disk, network
- monitoring APIs
- live metrics stream

### Phase 5 — AI Agent backend
- Ollama service
- model discovery
- chat and streaming APIs
- safe cyber-assistant system prompt

### Phase 6 — Dashboard
Use the uploaded Dashboard reference image.
Create only:

```text
frontend/src/pages/dashboard/
```

Implement compact SOC overview, status cards, radar, map, severity distribution, metrics, live attack feed, top attackers, resources, sensor status and AI insight.

### Phase 7 — AI Agent
Use the uploaded AI Agent reference image.
Create only:

```text
frontend/src/pages/agent/
```

Implement model selector, local status, hero visual, chat, streaming, quick prompts, voice-ready controls and conversation state.

### Phase 8 — Attack Feed
Use the uploaded Attack Feed reference image.
Create only:

```text
frontend/src/pages/attack-feed/
```

Implement real-time table, filters, search, details panel, honeypot metadata, payload view, timeline, MITRE mapping and defensive actions.

### Phase 9 — Reports
Use the uploaded Reports reference image.
Create only:

```text
frontend/src/pages/reports/
```

Implement dynamic filters, report type selection, report jobs, charts, recent reports, progress and exports.

### Phase 10 — Monitoring UI
Use the uploaded Monitoring reference image.
Create only:

```text
frontend/src/pages/monitoring/
```

Implement system health, live charts, processes, network, service state and alerts.

### Phase 11 — Honeypot Lab
Use the uploaded Honeypot Lab reference image.
Create only:

```text
frontend/src/pages/honeypot-lab/
```

Implement sensor cards, controlled start/stop, attack map, sessions, captured interactions, sensor configuration and isolation warnings.

### Phase 12 — MITRE ATT&CK
Use the uploaded MITRE ATT&CK reference image.
Create only:

```text
frontend/src/pages/mitre-attack/
```

Implement searchable technique matrix, mappings, tactic filters, local attack correlations and detail drawer.

### Phase 13 — Windows Logs
Use the uploaded Windows Logs reference image.
Create only:

```text
frontend/src/pages/windows-logs/
```

Implement collector status, event filters, Windows event IDs, source charts, log detail view and suspicious activity classification.

### Phase 14 — Settings
Use the uploaded Settings reference image.
Create only:

```text
frontend/src/pages/settings/
```

Implement app settings, Ollama settings, retention, collectors, notifications, appearance and export/import configuration.

### Phase 15 — Testing and hardening
- backend unit tests
- API integration tests
- frontend component tests
- end-to-end smoke tests
- security review
- performance review
- documentation update

---

## 15. PAGE ROUTES

Target routes:

```text
/dashboard
/agent
/attacks
/reports
/monitoring
/honeypot-lab
/mitre-attack
/windows-logs
/settings
```

Unknown routes must show a styled 404 page.

---

## 16. DYNAMIC STATUS RULE

Never hardcode ONLINE, ACTIVE or READY.

Every visible status must be derived from:

- health API
- sensor state
- WebSocket state
- Ollama state
- collector state
- recent heartbeat timestamp

Status values:

- CHECKING
- ONLINE
- OFFLINE
- DEGRADED
- STARTING
- ACTIVE
- IDLE
- ERROR

---

## 17. REPORTING REQUIREMENTS

Reports must be generated from selected filters:

- date range
- attack types
- severities
- sensors
- source IP
- target service
- status
- MITRE technique
- threat score

Support:

- PDF
- CSV
- JSON

Report job states:

- queued
- generating
- completed
- failed

Do not block the API request while generating a large report.

---

## 18. WINDOWS LOG REQUIREMENTS

For the first release:

- Local Windows collector with explicit user execution
- Security, System, Application and PowerShell channels
- Future Sysmon support
- Event ID mapping
- Deduplication
- Pagination
- Safe filtering
- Collector heartbeat
- Clear permission errors

Do not attempt privilege escalation.

---

## 19. SETTINGS REQUIREMENTS

Settings must be validated and persisted.

Include:

- API host
- WebSocket host
- Ollama host
- preferred model
- theme
- animation level
- data retention
- collector interval
- report storage
- notification preferences
- sensor defaults

Secrets must not be stored in source control.

---

## 20. QUALITY GATES

Before declaring a phase complete:

1. Run backend tests.
2. Run frontend tests.
3. Run lint.
4. Build frontend.
5. Verify backend startup.
6. Verify database initialization.
7. Verify API contracts.
8. Verify WebSocket cleanup.
9. Verify responsive layout.
10. Confirm no unrelated page changed.
11. Document files created or modified.
12. Document known limitations.

---

## 21. EXECUTION BEHAVIOR

You are allowed to work continuously through the phases, but you must remain disciplined.

At the beginning:

1. Inspect workspace.
2. Produce an implementation inventory.
3. Produce the exact target tree.
4. Identify missing dependencies.
5. Create a backup or Git checkpoint if an existing project is present.
6. Begin Phase 0.

After every phase:

- Show completed work
- Show commands run
- Show test results
- Show remaining work
- Continue to the next phase unless blocked by missing assets, unavailable dependencies or a destructive decision

Do not ask unnecessary questions.

Ask only when:

- A reference image is missing for the current UI phase
- A destructive migration is unavoidable
- Required credentials or permissions are unavailable
- Two requirements directly conflict

---

## 22. REFERENCE IMAGES TO EXPECT

The user will upload separate images for:

1. Dashboard
2. AI Agent
3. Attack Feed
4. Reports
5. Monitoring
6. Honeypot Lab
7. MITRE ATT&CK
8. Windows Logs
9. Settings

Map each image to only its matching page.

Do not combine all page images into one design.

---

## 23. FINAL DELIVERABLE

Produce a fully working local SentinelAI repository with:

- Clean backend
- Clean frontend
- Modular pages
- Local Ollama integration
- Working honeypot event flow
- Dynamic health statuses
- Real-time WebSockets
- Dynamic reports
- Monitoring
- MITRE mapping
- Windows logs
- Tests
- Documentation
- Safe startup scripts
- Clear README

The final README must explain:

```text
Terminal 1 — Ollama
ollama serve

Terminal 2 — Backend
cd D:\AI-CyberShield\backend
venv\Scripts\activate
uvicorn main:app --reload

Terminal 3 — Frontend
cd D:\AI-CyberShield\frontend
npm install
npm run dev
```

Use the actual frontend command based on the created toolchain.

Start now by inspecting the workspace and creating the Phase 0 implementation inventory. Do not output placeholder code. Build SentinelAI as a serious, long-term defensive cybersecurity platform.
