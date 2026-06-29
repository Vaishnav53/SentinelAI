# 23 — Deployment Guide

## Local development

### Ollama

```powershell
ollama serve
```

### Backend

```powershell
cd D:\AI-CyberShield\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```powershell
cd D:\AI-CyberShield\frontend
npm install
npm run dev
```

## Production-like local deployment

- Build frontend static files
- Run backend without reload
- Use environment-specific CORS
- Store reports and database in configured storage paths
- Rotate logs
- Back up the database
- Keep honeypots bound to a safe lab interface

## Docker

Docker support is optional for the first stable Windows build. Do not require Docker for Ollama or Windows Event Log collection.
