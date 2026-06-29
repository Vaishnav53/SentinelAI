# SentinelAI — AI-Powered Cyber Defense Platform

SentinelAI is a professional, local-first, AI-powered cyber-defense platform and SOC simulation system. It integrates defensive host monitoring, log collection (including Windows Event Logs), interactive honeypot systems, MITRE ATT&CK mapping, and local AI collaboration via Ollama.

## Technical Stack

*   **Backend**: Python 3.11+ (running on Python 3.14.5 locally), FastAPI, Uvicorn, SQLAlchemy (SQLite), WebSockets, `psutil`.
*   **Frontend**: React (Vite), React Router, Framer Motion, Lucide React, Recharts.
*   **Local AI**: Ollama (`llama3.1:latest`, `gemma:latest`).

## Platform Architecture

```text
SentinelAI/
├── backend/          # FastAPI backend services, collectors, and honeypots
├── frontend/         # Vite-powered React front-end application
├── docs/             # SentinelAI project design and guides
├── scripts/          # Administration and startup scripts
└── README.md         # This documentation
```

## Running the Platform

To start the platform locally, follow these steps:

### 1. Start Ollama
Ensure Ollama is installed and running locally with the expected models:
```bash
# Check if Ollama is running and download required models
ollama pull llama3.1
ollama pull gemma
```

### 2. Run Backend
Initialize the virtual environment, install dependencies, and start the FastAPI dev server:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Run Frontend
Install Node packages and run the Vite dev server:
```bash
cd frontend
npm install
npm run dev
```

### 4. Smart Startup Script (Alternative)
You can use the provided Windows batch script to launch the application components interactively:
```powershell
.\scripts\start.bat
```
