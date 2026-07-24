# Installation & Setup — SentinelAI

This guide provides step-by-step instructions to configure, initialize, and execute the SentinelAI platform for local development and containerized hybrid deployment foundation testing.

---

## 💻 System Prerequisites

* **Operating System**: Windows 10/11, macOS, or Ubuntu Linux.
* **Python**: Python 3.11 or later. The backend container uses Python 3.11, and local development has been verified with Python 3.14.
* **Node.js**: Version 18.x or higher (with npm package manager).
* **AI Provider**:
  * **Groq Cloud** (Primary Live LLM Provider): Requires an API key from [Groq Console](https://console.groq.com/). When Groq is unavailable or unconfigured, SentinelAI uses a deterministic local fallback response engine.
* **Docker & Docker Compose** (Optional for Hybrid Container Setup): Docker Desktop or Docker Engine.

---

## 🔑 Environment Variables Reference

Copy `.env.example` templates to `.env` files in both backend and frontend directories:

### Backend (`backend/.env`):
```env
APP_NAME=SentinelAI
APP_ENV=development
APP_HOST=127.0.0.1
APP_PORT=8000

# Database Settings
DATABASE_URL=sqlite:///./storage/sentinelai.db

# Frontend Security & CORS Settings
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174

# Production Security
SECRET_KEY=placeholder_secret_key
TRUSTED_HOSTS=127.0.0.1,localhost,testserver

# Groq Cloud AI Settings
GROQ_API_KEY=your_groq_api_key_here
DEFAULT_GROQ_MODEL=llama-3.3-70b-versatile

# Storage & Logging
REPORT_STORAGE=./storage/reports
LOG_LEVEL=INFO
```

### Frontend (`frontend/.env`):
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

> [!WARNING]
> Do **not** commit `.env` files containing sensitive keys to version control. They are ignored by default in `.gitignore`.

---

## 🔌 Network Ports Reference

| Service / Subsystem | Host Port | Protocol | Usage / Purpose |
| :--- | :---: | :---: | :--- |
| **Frontend Web App** | `5173` | HTTP | React / Vite SOC Console UI |
| **Backend Application API** | `8000` | HTTP/WS | FastAPI REST API & WebSocket Stream (`/api/attacks/ws`) |
| **HTTP Decoy Sensor** | `8088` | HTTP | Honeypot web exploit & traversal sensor |
| **SSH Decoy Sensor** | `2222` | TCP/SSH | Honeypot brute-force login sensor |
| **FTP Decoy Sensor** | `2121` | TCP/FTP | Honeypot anonymous file scan sensor |
| **Telnet Decoy Sensor** | `2323` | TCP/Telnet | Honeypot IoT botnet probe sensor |

---

## 📥 Local Development Setup

### 1. Backend Service Setup

```powershell
# 1. Navigate to backend directory
cd D:\Documents\SentinelAI\backend

# 2. Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# 3. Install requirements
pip install -r requirements.txt

# 4. Set Python path and start backend server
$env:PYTHONPATH="D:\Documents\SentinelAI"
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```
*The FastAPI server will boot at `http://127.0.0.1:8000`. On startup, SQLite tables are created automatically and seeded with demo telemetry via `populate_demo_data()`.*

### 2. Frontend Application Setup

```powershell
# 1. Open a new terminal and navigate to frontend directory
cd D:\Documents\SentinelAI\frontend

# 2. Install Node packages
npm install

# 3. Start Vite dev server on port 5173
npm run dev -- --port 5173
```
*Access the SOC Command Center in your browser at:* **`http://localhost:5173`**

---

## ⚠️ Database Reset & Data Loss Warning

> [!CAUTION]
> **Data Loss Warning**: Deleting `backend/storage/sentinelai.db` permanently removes all existing local SQLite data. This procedure should be used **only for disposable demonstration environments**. If existing attacks, incidents, reports, settings, or investigation data must be preserved, create a backup file before deletion. On the next backend startup, the database schema and default demonstration records are automatically recreated.

---

## 🐳 Hybrid Deployment Support (Phase 16)

SentinelAI includes containerized deployment foundation assets for hybrid lab setups:

```powershell
# Build and start Docker containers
docker-compose up -d --build
```
Orchestrates FastAPI backend, static Nginx reverse proxy, and PostgreSQL database.

* **Database Backup**: `./scripts/db_backup.sh`
* **Database Restore**: `./scripts/db_restore.sh ./backups/sentinelai_backup_*.sql`

---

## 🧪 Verification & Testing

### 1. Backend Pytest Suite
```powershell
$env:PYTHONPATH="D:\Documents\SentinelAI"
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```
*Expected Result: All 19 unit tests pass cleanly.*

### 2. Frontend Production Build Check
```powershell
cd D:\Documents\SentinelAI\frontend
npm run build
```
*Expected Result: Vite production bundle compiles cleanly.*
