# Installation & Setup — SentinelAI

This guide provides step-by-step instructions to configure, initialize, and execute the SentinelAI platform for local development.

---

## 💻 System Prerequisites

* **OS**: Windows 10/11, macOS, or Ubuntu Linux.
* **Python**: Version 3.14.x or higher.
* **Node.js**: Version 18.x or higher (npm package manager included).
* **AI Provider**:
  * **Groq Cloud** (Recommended): Requires an active API key from [Groq Console](https://console.groq.com/).
  * **Ollama** (Local Fallback): Installed locally and running on default port `11434`.

---

## 📥 Step-by-Step Installation

Clone the repository to your local workspace, then configure the separate layers:

### 1. Backend Service Setup

First, initialize python dependencies and configure the environment:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows PowerShell
   python -m venv .venv
   .venv\Scripts\activate

   # macOS / Linux
   python -m venv .venv
   source .venv/bin/activate
   ```
3. Install package requirements:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
5. Open `backend/.env` in your text editor and specify your keys:
   ```env
   GROQ_API_KEY=gsk_your_key_here
   DEFAULT_GROQ_MODEL=llama-3.3-70b-versatile
   DATABASE_URL=sqlite:///./sentinel.db
   ENVIRONMENT=development
   ```

> [!WARNING]
> Do **not** commit `backend/.env` to source control. It is ignored by default via the main `.gitignore` file.

---

### 2. Database Initialization
SQLite requires no manual service installation. The application automatically initializes tables and populates base seed data on startup:

If you wish to test database creation manually, run:
```bash
$env:PYTHONPATH=".."  # Windows PowerShell
# OR export PYTHONPATH=".." on Linux/macOS
.venv\Scripts\python -c "from backend.database.session import engine; from backend.models.base import Base; Base.metadata.create_all(bind=engine); print('Database ready')"
```

---

### 3. Frontend App Setup

Initialize Node dependencies for the React Vite project:

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```

---

## 🏃 Running the Services

### Command Line Startup (Individual)

#### Start Backend Service
Run from `backend/` folder:
```bash
# Set Python path to project root
$env:PYTHONPATH="d:\Documents\SentinelAI"
.venv\Scripts\uvicorn main:app --reload --port 8000
```
This runs the FastAPI server at `http://127.0.0.1:8000` with hot-reloading active.

#### Start Frontend Application
Run from `frontend/` folder:
```bash
npm run dev
```
The developer server will boot up at `http://localhost:5173`.

---

### Launcher Script Startup
For convenience, you can run the batch launcher from the root folder:
```cmd
.\scripts\start.bat
```
This script checks Ollama, prompt choices, and launches both services in independent command prompts automatically.

---

## 🧪 Validating Installation

### 1. Run Automated Unit Tests
To verify all APIs, ingestion logic, and WAF rules are functioning:
Navigate to the `backend/` folder and execute the test runner:
```bash
$env:PYTHONPATH="d:\Documents\SentinelAI"
.venv\Scripts\pytest
```
*Expected output: All 19 tests pass.*

### 2. Confirm Frontend Compile
To verify that UI styling rules compile correctly:
Navigate to the `frontend/` folder and build:
```bash
npm run build
```
*Expected output: Successful Vite production bundle output.*
