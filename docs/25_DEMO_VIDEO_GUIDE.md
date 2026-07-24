# 25 — Demo Video Recording Guide

This document provides a comprehensive, step-by-step operational guide for recording a video demonstration of the SentinelAI platform.

---

## 🎯 Purpose

Ensure consistent, high-quality, and visually impressive video demonstrations of SentinelAI for portfolio reviews, academic presentations, and technical showcases.

---

## 💻 Demo Prerequisites

Before recording, ensure your local environment meets these requirements:
* **Operating System**: Windows 10/11 (or macOS / Linux).
* **Python Environment**: Python 3.11+ virtual environment configured under `backend/.venv`.
* **Node Environment**: Node.js v18+ with `node_modules` installed under `frontend/`.
* **API Credentials**: Active `GROQ_API_KEY` set in `backend/.env` (optional, local fallback active if unconfigured).
* **Screen Recording Software**: OBS Studio, Camtasia, or Loom configured for 1080p recording.

---

## ⚙️ Environment Setup & Startup

### 1. Terminal Preparation
Open two side-by-side terminal windows (or integrated VS Code terminal tabs):

#### Terminal 1 — Backend Startup:
```powershell
cd D:\Documents\SentinelAI\backend
$env:PYTHONPATH="D:\Documents\SentinelAI"
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```
*Verify output*: `Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)`

#### Terminal 2 — Frontend Startup:
```powershell
cd D:\Documents\SentinelAI\frontend
npm run dev -- --port 5173
```
*Verify output*: `Local: http://localhost:5173/`

### 2. Display & Browser Preparation
* **Screen Resolution**: 1920 x 1080 (1080p Full HD recommended).
* **Browser**: Chrome or Edge in full-screen mode (F11 or maximized window).
* **Browser Zoom Level**: **100%** (Do not zoom in or out; SentinelAI single-shell CSS layout is locked to 100% viewport zoom).
* **Browser Environment**: Clear bookmarks bar (`Ctrl+Shift+B`), enable dark browser frame theme, and hide OS taskbar for clean recording framing.

---

## 🎬 Recommended Demonstration Sequence

| Sequence | Module / View | Estimated Duration | Key Highlights |
| :---: | :--- | :---: | :--- |
| **1** | **SOC Command Center (`/`)** | 2 mins | System Vitals bar (`psutil`), Threat Level indicator, AI Confidence rating (98.4%), Geographical Threat Map, and live WebSocket telemetry stream. |
| **2** | **Honeypot Decoy Lab (`/sensors`)** | 2 mins | Active decoy traps (HTTP 8088, SSH 2222, FTP 2121, Telnet 2323), hit statistics, and sensor state toggles. |
| **3** | **Incident Response (`/attacks`)** | 2.5 mins | Real-time attack feed, severity filters (`CRITICAL`, `HIGH`, `MEDIUM`), raw payload inspection, and GeoIP details. |
| **4** | **AI Investigator Workspace (`/agent`)** | 4 mins | Dual-tab interface, threat context selection panel, model status display, and execution of 7 Structured AI Actions (*Analyze Incident*, *Extract IOCs*, *Recommend Containment*, *Map to MITRE*, etc.). |
| **5** | **Decoy Sandbox (`/sandbox`) & WAF (`/waf`)** | 2 mins | Mock file hash scanning, YARA signatures, WAF active rule toggles, and IP quarantine blocklist. |
| **6** | **Executive Reports (`/reports`)** | 1.5 mins | PDF compliance report generation and CSV incident log export download. |

---

## 🧪 Suggested Live Attack Demonstrations

To trigger real-time alerts during recording, run these simulation commands in a separate terminal:

### Attack 1: SQL Injection Payload Simulation
```powershell
# Triggers HTTP Honeypot & WAF alert
curl "http://127.0.0.1:8088/api/login?user=admin'%20OR%20'1'='1"
```

### Attack 2: Directory Traversal Probe
```powershell
# Triggers Critical Path Traversal alert
curl "http://127.0.0.1:8088/../../../../etc/passwd"
```

### Attack 3: Automated Simulation Trigger
```powershell
# Triggers backend alert broadcast
curl -X POST "http://127.0.0.1:8000/api/attacks/simulate"
```

---

## 🤖 AI Investigator Demonstration Flow

1. Navigate to **AI Assistant** (`/agent`).
2. Switch to the **Investigator Tab**.
3. Open the Threat Context selector dropdown and pick a high-severity incident (e.g., `Attack Event HON-1783491 (Path Traversal)`).
4. Review the auto-populated metadata view (Target IP, Vector, Severity).
5. Click **Analyze Incident** to trigger the diagnostic breakdown.
6. Click **Extract IOCs** to extract malicious IP indicators and payload keywords into tabbed markdown output.
7. Click **Recommend Containment** to demonstrate actionable step-by-step SOC mitigation playbooks.

---

## 🔄 Emergency Reset & Recovery Steps

If demo telemetry needs to be reset before a fresh recording run:

> [!CAUTION]
> Deleting the SQLite file removes local demo data. Ensure a backup is created if custom records must be kept.

```powershell
# 1. Stop backend Uvicorn process (Ctrl+C)
# 2. Remove SQLite database file
Remove-Item D:\Documents\SentinelAI\backend\storage\sentinelai.db -Force

# 3. Restart backend (database and demo data populate automatically)
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

---

## ✅ Recording & Post-Recording Checklists

### Recording Setup Checklist:
* [ ] Both backend (8000) and frontend (5173) running cleanly.
* [ ] Screen recorder capturing 1920x1080 at 60fps.
* [ ] Audio microphone checked and gain calibrated.
* [ ] Browser zoom set to 100%.
* [ ] Desktop notifications disabled.

### Post-Recording Checklist:
* [ ] Verify audio clarity and synchronization.
* [ ] Trim video intro/outro padding.
* [ ] Export final MP4 file in 1080p format.
* [ ] Archive raw recording files.
