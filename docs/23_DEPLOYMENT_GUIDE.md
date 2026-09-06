# 23 — Deployment Guide

## Production Architecture

SentinelAI is architected for high-performance cyber defense with a decoupled, hardened deployment topology:

```text
                    ┌─────────────────────┐
                    │      Vercel         │
                    │   React / Vite      │
                    └──────────┬──────────┘
                               │
                    HTTPS / WSS / SSE
                               │
                               ▼
              ┌────────────────────────────┐
              │ Persistent FastAPI Backend │
              │        Uvicorn             │
              └──────┬──────────────┬──────┘
                     │              │
                     ▼              ▼
          Managed PostgreSQL    Persistent Honeypot
                               / Decoy Infrastructure
```

- **Frontend**: Deployed on **Vercel** as a high-speed Single Page Application (SPA). Deep routes (`/dashboard`, `/login`, `/admin`, `/honeypot`, `/threat-intelligence`, `/waf`, `/sensors`, etc.) are served seamlessly via root and frontend `vercel.json` rewrite configurations.
- **Backend**: Hosted on **persistent infrastructure** (PaaS / VM / container instance like Railway, Render, Fly.io, or AWS EC2) capable of sustaining long-lived WebSocket connections, unbuffered Server-Sent Events (SSE), background threat simulations, and persistent honeypot socket listeners.
- **Database**: **Managed PostgreSQL** for resilient, high-volume security event logging and ACID transaction integrity (SQLite remains fully supported for local workstation development and automated testing).
- **Honeypot & Decoy Engine**: Operates on persistent host networking, binding port `8088` (with simulated port mappings for 2222, 2121, 2323) to capture and analyze threat actor interactions.

---

## 1. Environment Variable Matrix

### Frontend (Vercel Project Settings)

| Variable | Recommended Value (Production) | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://api.yourdomain.com/api` | Absolute HTTPS URL to persistent FastAPI `/api` root |
| `VITE_WS_BASE_URL` | `wss://api.yourdomain.com` | Absolute WSS endpoint for real-time attack stream |

### Backend (Persistent PaaS / VM / Container)

| Variable | Recommended Value (Production) | Description |
| :--- | :--- | :--- |
| `APP_ENV` | `production` | Enables production security guards |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/sentinelai` | Managed PostgreSQL connection string |
| `SECRET_KEY` | *(Strong random 64-char hex)* | Production cryptographic signing key |
| `FRONTEND_ORIGIN` | `https://your-app.vercel.app` | Allowed CORS origin (comma-separated if multiple) |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Optional alias for `FRONTEND_ORIGIN` |
| `TRUSTED_HOSTS` | `api.yourdomain.com,localhost` | Trusted host headers for HTTP Host-header injection defense |
| `ALLOWED_HOSTS` | `api.yourdomain.com` | Optional alias for `TRUSTED_HOSTS` |
| `AUTH_COOKIE_SECURE` | `true` | Enforces `Secure` flag on session cookies (requires HTTPS) |
| `AUTH_COOKIE_SAMESITE` | `none` | Cross-origin cookie sharing between Vercel and API domain |
| `SENTINEL_ADMIN_USERNAME` | `dyn4m1t3` | Bootstrap administrator username |
| `SENTINEL_ADMIN_PASSWORD` | *(Secure custom password)* | Password for bootstrap administrator |
| `SENTINEL_ADMIN_EMAIL` | `admin@sentinel.ai` | Administrator email address |
| `GROQ_API_KEY` | `gsk_...` | Groq Cloud AI Copilot inference key |
| `DEFAULT_GROQ_MODEL` | `openai/gpt-oss-120b` | Default LLM model identifier |
| `REPORT_STORAGE` | `./storage/reports` | Persistent volume path for exported reports |
| `SANDBOX_STORAGE` | `./decoy_sandbox` | Persistent volume path for quarantined uploads |

---

## 2. Health & Readiness Monitoring

The backend exposes explicit liveness and readiness endpoints for cloud load balancers and orchestrators:

- **Liveness Probe**: `GET /health` or `GET /api/health`  
  Returns HTTP 200 `{"status": "ONLINE", "version": "0.1.0"}` while the process is running.
- **Readiness Probe**: `GET /ready` or `GET /health/ready` or `GET /api/health/ready`  
  Validates active PostgreSQL connectivity via `SELECT 1`. Returns HTTP 200 `{"status": "READY", "database": "CONNECTED"}` when ready to accept traffic; returns HTTP 503 `{"status": "NOT_READY", "database": "DISCONNECTED"}` if PostgreSQL is unreachable.
- **Services Health**: `GET /api/health/services`  
  Provides detailed breakdown of database, Groq AI, and sensor collector status. Returns HTTP 503 if required dependencies are offline.

---

## 3. Honeypot Port & Networking Verification

| Port | Service | Bind Scope | Security Group / Firewall |
| :--- | :--- | :--- | :--- |
| `8088` | Aetheris HTTP Decoy Portal | `0.0.0.0` (LAN/Public) or `127.0.0.1` | Inbound TCP allowed from monitored network segments |
| `8000` | FastAPI API & WebSocket | `0.0.0.0` | Inbound TCP from Vercel / reverse proxy |
| `5432` | Managed PostgreSQL | Private network / VPC | Inbound allowed strictly from backend host IP |

---

## 4. Hybrid Container Deployment (Docker Compose)

For self-hosted or hybrid deployments, `docker-compose.yml` orchestrates all services locally:

```bash
# Build and launch all containers
docker-compose up -d --build

# Verify container health
docker-compose ps
```
