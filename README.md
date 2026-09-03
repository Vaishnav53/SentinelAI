<p align="center">
  <img src="docs/assets/branding/banner.svg" alt="SentinelAI Banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python Badge">
  <img src="https://img.shields.io/badge/FastAPI-0.111.0-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI Badge">
  <img src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Badge">
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite Badge">
  <img src="https://img.shields.io/badge/Groq%20Cloud-ONLINE-orange?style=for-the-badge" alt="Groq Badge">
  <img src="https://img.shields.io/badge/Tests-45%2F45%20Passing-brightgreen?style=for-the-badge" alt="Tests Badge">
  <img src="https://img.shields.io/badge/MITRE%20ATT%26CK-Aligned-red?style=for-the-badge" alt="MITRE ATT&CK Badge">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License Badge">
</p>

---

# SentinelAI — AI-Powered Cyber Defense Platform

**SentinelAI** is an advanced, enterprise-grade Security Operations Center (SOC) simulation, threat telemetry correlation, and AI-driven incident response platform. It integrates live host vitals monitoring, active perimeter WAF defenses, multi-protocol decoy honeypots (HTTP, SSH, FTP, Telnet), and automated MITRE ATT&CK mapping with a high-throughput **AI Security Copilot & Investigator Workspace**.

The platform is powered by **Groq Cloud** as its primary high-speed reasoning engine (utilizing `openai/gpt-oss-120b`). When Groq is unavailable or unconfigured, SentinelAI automatically activates a deterministic local fallback engine, ensuring continuous operational availability.

---

## 📌 Table of Contents

* [🚀 Core Platform Capabilities](#-core-platform-capabilities)
* [🛠️ Technical Stack](#️-technical-stack)
* [📐 System Architecture](#-system-architecture)
* [🛡️ Feature Breakdown](#️-feature-breakdown)
* [⚡ Quick Setup & Installation](#-quick-setup--installation)
* [🔧 Environment Variables Reference](#-environment-variables-reference)
* [🧪 Automated Verification & Testing](#-automated-verification--testing)
* [🌐 Production & Deployment Architecture](#-production--deployment-architecture)
* [📂 Repository Structure](#-repository-structure)
* [🔒 Security Policy & Disclosure](#-security-policy--disclosure)
* [📄 License & Maintainer](#-license--maintainer)

---

## 🚀 Core Platform Capabilities

* **Real-Time SOC Command Center**: Live telemetry dashboard tracking host vitals (`psutil`), dynamic Threat Levels, AI Confidence indices, and low-latency WebSocket security event feeds.
* **Attack Feed & Normalized Ingestion**: Unified threat log capturing micro-events with instant multi-criteria filtering (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), protocol breakdown, payload inspection, and analyst triage assignment.
* **Threat Correlation Engine**: Automatically groups distributed events (e.g. brute-force authentication bursts, path traversal scans) into **Correlated Incidents** mapped to MITRE ATT&CK tactics and techniques.
* **Active Defense Web Application Firewall (WAF)**: Real-time inspection for SQL Injection (SQLi), Cross-Site Scripting (XSS), and Path Traversal, coupled with an automated IP quarantine containment blocklist and observed source tracking.
* **Aetheris Decoy Honeypot Lab**: Multi-protocol deception infrastructure emulating vulnerable services:
  * HTTP Honeypot & Decoy Admin Portal (Port `8088`)
  * SSH Listener (Port `2222`)
  * FTP Decoy (Port `2121`)
  * Telnet Port (Port `2323`)
  * Toggleable **Local Loopback (`127.0.0.1`)** vs. **LAN Broadcast (`0.0.0.0`)** binding modes with Windows Firewall command generators.
* **AI Copilot & Investigator Workspace**:
  * **Telemetry Tab**: Interactive real-time assistant for tactical queries, threat intelligence guidance, and cybersecurity concepts.
  * **Investigator Tab**: Deep contextual investigation panel featuring **7 Structured AI Investigation Actions**:
    1. *Analyze Incident*
    2. *Explain Severity*
    3. *Extract IOCs*
    4. *Recommend Containment*
    5. *Map to MITRE ATT&CK*
    6. *Generate Attack Timeline*
    7. *Draft Executive Summary*
* **Decoy Malware Sandbox**: File ingestion environment that computes cryptographic hashes (MD5, SHA-1, SHA-256), applies heuristic signature analysis, and evaluates VirusTotal threat reputation.
* **Automated Threat Playbooks**: Pre-configured and customizable orchestration playbooks (e.g., *Brute Force IP Containment*, *SQL Injection Quarantine*) for rapid, automated response.
* **Executive PDF & CSV Reports**: Generates formal compliance incident documentation and downloadable raw audit logs.
* **Universal UTC Presentation Localization**: Rigorous presentation-layer timestamp localization converting naive UTC backend timestamps to the user's browser local timezone across SSR and dynamic polling cycles without altering database schemas.

---

## 🛠️ Technical Stack

### Backend
* **Runtime**: Python 3.11+ (verified on Python 3.11 through 3.14)
* **API Framework**: FastAPI with Uvicorn ASGI Server
* **ORM & Database**: SQLAlchemy (SQLite for local development; PostgreSQL for production containers)
* **Realtime Ingress**: WebSockets (`/api/attacks/ws`) with in-memory `ConnectionManager`
* **AI Streaming**: Server-Sent Events (SSE) via `httpx.AsyncClient` streaming from Groq Cloud
* **Security & Auth**: Argon2id password hashing, SHA-256 hashed server-side sessions, HttpOnly secure cookies

### Frontend
* **Runtime**: Node.js v18+ (Node 20+ recommended)
* **Framework**: React 19 with Vite 8
* **Styling**: Tailored Vanilla CSS cyber-defense design system (dark glassmorphism, responsive data grids)
* **Icons & Visuals**: Lucide React iconography, Three.js holographic globe
* **Charts & Analytics**: Recharts data visualization library

---

## 📐 System Architecture

```text
+----------------------------------------------------------------------------------------------------+
|                                         CLIENT BROWSER                                             |
|                                                                                                    |
|   +--------------------------+       HTTP REST (axios)        +--------------------------------+   |
|   |  Vite / React 19 SPA     |===============================>|  FastAPI ASGI Backend          |   |
|   |  - Dashboard / Analytics |       Cookies (SameSite/Auth)  |  - Auth & RBAC (Session-based) |   |
|   |  - Attack Feed           |                                |  - WAF Manager Engine          |   |
|   |  - WAF Console           |       WebSockets (Persistent)  |  - Threat Intelligence Agg     |   |
|   |  - Honeypot Lab UI       |<==============================>|  - Decoy Sandbox Scanners      |   |
|   |  - AI Copilot Assistant  |       SSE Streams (httpx)      |  - Groq AI Orchestrator        |   |
|   +--------------------------+<-------------------------------|  - In-Memory ConnectionManager |   |
|                 |                                             +--------------------------------+   |
|                 | Navigates Decoys                                             |                   |
|                 v                                                              v                   |
|   +--------------------------+                                +--------------------------------+   |
|   |  Aetheris Decoy Web App  |                                |  Database / Storage (Local)    |   |
|   |  HTTP Decoy (Port 8088)  |                                |  - SQLite / PostgreSQL         |   |
|   |  - SSR HTML Templates    |                                |  - ./storage/reports/          |   |
|   |  - Honeypot Polling 5s   |                                |  - ./decoy_sandbox/ (malware)  |   |
|   +--------------------------+                                +--------------------------------+   |
+----------------------------------------------------------------------------------------------------+
```

---

## 🛡️ Feature Breakdown

| Feature Module | Endpoint / Path | Description |
| :--- | :--- | :--- |
| **SOC Dashboard** | `/dashboard` | Executive summary metrics, host hardware vitals, interactive globe, and live incident feeds. |
| **Attack Feed** | `/attacks` | Granular threat event inspection with severity badges, analyst assignment, and quick actions. |
| **Honeypot Lab** | `/honeypot-lab` | Decoy listener control center, LAN mode toggle, live sensor telemetry, and firewall commands. |
| **WAF Manager** | `/waf` | Active web firewall rule configurations, IP blocklist quarantine, and observed attacker lists. |
| **Threat Intelligence** | `/threat-intel` | Aggregated attacker dossiers, MITRE ATT&CK technique heatmaps, and threat intelligence feeds. |
| **AI Copilot** | `/agent` | Dual-mode workspace: Chat copilot & 7-point structured incident investigator. |
| **Sandbox Console** | `/sandbox` | Malicious artifact ingestion, heuristic threat scoring, and VirusTotal reputation lookup. |
| **Playbooks Console**| `/playbooks` | Automated threat remediation workflows with real-time execution step logging. |
| **Security Reports** | `/reports` | Executive summary generator, CSV raw telemetry export, and printable audit logs. |
| **Admin Controls** | `/admin/dashboard` | Dedicated administrative honeypot overview with auto-refreshing telemetry polling. |

---

## ⚡ Quick Setup & Installation

### Prerequisites
* **Python**: 3.11 or later
* **Node.js**: 18 or later
* **Git**: 2.30 or later

### 1. Clone Repository
```bash
git clone https://github.com/Vaishnav53/SentinelAI.git
cd SentinelAI
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```
*Edit `.env` to configure your `GROQ_API_KEY` (optional for local fallback).*

### 3. Frontend Setup
```bash
cd ../frontend
npm install
cp .env.example .env
```

### 4. Running the Development Environment
Open two terminal windows:

**Terminal 1 (Backend API & Services)**:
```bash
cd backend
# With .venv activated:
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (Frontend Client)**:
```bash
cd frontend
npm run dev
```
*Access the SOC Command Center at: `http://localhost:5173`*

---

## 🔧 Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Default Value | Required in Production | Description |
| :--- | :--- | :--- | :--- |
| `APP_NAME` | `SentinelAI` | No | System instance name |
| `APP_ENV` | `development` | **Yes** (`production`) | Environment toggle; activates security guards |
| `APP_HOST` | `127.0.0.1` | **Yes** (`0.0.0.0`) | Network bind host |
| `APP_PORT` | `8000` | **Yes** | API listener port |
| `DATABASE_URL` | `sqlite:///./storage/sentinelai.db` | **Yes** (PostgreSQL) | Primary database connection URI |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | **Yes** | CORS allowed origins (comma-separated) |
| `SECRET_KEY` | `placeholder_secret_key` | **Yes** | 256-bit entropy session signing key |
| `TRUSTED_HOSTS` | `127.0.0.1,localhost` | **Yes** | Allowed Host header protection list |
| `AUTH_COOKIE_SECURE` | `false` | **Yes** (`true`) | Enforces HTTPS-only cookies |
| `AUTH_COOKIE_SAMESITE`| `lax` | **Yes** (`none` for cross-origin)| Cookie SameSite attribute |
| `GROQ_API_KEY` | *(None)* | **Yes** | Groq Cloud API key for AI reasoning |
| `DEFAULT_GROQ_MODEL` | `openai/gpt-oss-120b`| No | Default LLM model identifier |

### Frontend (`frontend/.env`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `/api` | Base URL for REST API requests |
| `VITE_WS_BASE_URL` | `ws://127.0.0.1:8000` | Endpoint for persistent WebSocket threat feeds |

---

## 🧪 Automated Verification & Testing

SentinelAI includes comprehensive test suites across backend API contracts, security controls, and client build pipelines.

### Run Backend Pytest Suite (45 Tests)
```bash
# From repository root:
$env:PYTHONPATH="."; & backend\.venv\Scripts\pytest.exe backend/tests
```
```text
====================== 45 passed, 575 warnings in 28.87s ======================
Exit Code: 0 (100% Passing)
```

### Validate Frontend Production Build & Linting
```bash
cd frontend
npm run build
npm run lint
```
```text
✓ built in 1.12s (dist/ bundle ready)
Found 53 warnings and 0 errors across 33 files.
Exit Code: 0
```

---

## 🌐 Production & Deployment Architecture

SentinelAI follows a modern **decoupled hybrid architecture** for production deployments:

* **Frontend (Vercel Edge CDN)**:
  * Hosts the React 19 / Vite single-page application globally with instant edge invalidation.
  * Configured with SPA rewrites (`/(.*) -> /index.html`).
* **Backend (Persistent Container / Cloud VM)**:
  * Runs FastAPI on a persistent runtime (e.g. Render, Fly.io, AWS ECS, or DigitalOcean).
  * Maintains persistent, long-lived WebSockets (`/api/attacks/ws`) and background threat simulator loops.
  * Dedicated ingress ports for the **Aetheris Honeypot** (`8088`, `2222`, `2121`, `2323`).
* **Database (Managed PostgreSQL)**:
  * Enterprise database persistence (Supabase, Neon, or AWS RDS).

> *Note: Vercel Serverless Functions alone cannot host the backend due to absence of persistent incoming WebSockets and multi-port TCP listeners required by honeypot sensors.*

---

## 📂 Repository Structure

```text
SentinelAI/
├── backend/                  # FastAPI Application Source
│   ├── api/                  # API route handlers (attacks, auth, agent, waf, reports)
│   ├── core/                 # App configuration, security, errors, and logging
│   ├── database/             # SQLAlchemy session and schema seeding
│   ├── models/               # Database ORM models
│   ├── schemas/              # Pydantic v2 validation contracts
│   ├── services/             # Core business logic (honeypot, WAF, sandbox, AI)
│   └── tests/                # Automated pytest test suite (45 tests)
├── frontend/                 # React 19 / Vite Single Page Application
│   ├── src/
│   │   ├── api/              # Axios client configuration & interceptors
│   │   ├── components/       # Shared UI components (feed, drawers, globe)
│   │   ├── context/          # React AuthContext & state providers
│   │   ├── layouts/          # DashboardLayout & navigation
│   │   ├── pages/            # 10 primary SOC feature views
│   │   └── utils/            # Shared date & time parsing utilities
│   └── package.json          # Frontend dependencies & build scripts
├── docs/                     # Architectural diagrams, specifications & assets
├── .github/                  # Issue & Pull Request templates
├── .gitignore                # Production git exclusion filters
├── CONTRIBUTING.md           # Developer contribution guidelines
├── LICENSE                   # MIT License
├── README.md                 # Master project documentation
└── SECURITY.md               # Vulnerability disclosure policy
```

---

## 🔒 Security Policy & Disclosure

Please review our [SECURITY.md](SECURITY.md) for vulnerability disclosure protocols and honeypot isolation guidelines. All emulated decoys run within contained mock environments designed for safe payload capture.

---

## 📄 License & Maintainer

* **Author & Lead Developer**: **[Vaishnav Kumar (Vaishnav53)](https://github.com/Vaishnav53)**
* **Repository**: [https://github.com/Vaishnav53/SentinelAI](https://github.com/Vaishnav53/SentinelAI)
* **License**: Open-source under the [MIT License](LICENSE).