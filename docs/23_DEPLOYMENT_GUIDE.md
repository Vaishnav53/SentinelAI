# 23 — Deployment Guide

> [!NOTE]
> **Design Specification**: This document is an initial deployment design specification. For current live containerized setup commands and hybrid deployment architecture details, refer to [SETUP.md](SETUP.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Hybrid Container Deployment Support (Phase 16)

SentinelAI provides a containerized hybrid deployment foundation:
- **Docker Compose**: Orchestrates `web` (Nginx), `backend` (FastAPI), and `db` (PostgreSQL) containers.
- **Nginx Reverse Proxy**: Manages SSL termination, API routing, and WebSocket upgrading (`/api/attacks/ws`).
- **Database Backup Automation**: Shell scripts (`scripts/db_backup.sh` and `scripts/db_restore.sh`) automate timestamped database backups.

```powershell
# Launch containerized hybrid setup
docker-compose up -d --build
```
