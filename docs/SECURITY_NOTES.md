# Security Notes & Policies — SentinelAI

This document outlines key management instructions, sandbox safety guidelines, threat modeling boundaries, and the vulnerability disclosure policy for the SentinelAI project.

---

## 🔑 API Key & Secrets Management

Security of API keys is paramount, especially when shifting from local AI setups (Ollama) to cloud-based systems (Groq Cloud).

### Key Storage Policies
* **No Commits Policy**: The `backend/.env` file is excluded in `.gitignore` by default. Under no circumstances should `GROQ_API_KEY` or any environment configurations be staged or committed.
* **Environment Loader**: The settings module (`backend/core/config.py`) loads values using Pydantic’s settings engine directly from environment variables or local `.env` files.
* **Mock Fallbacks**: If the `GROQ_API_KEY` is missing or empty, the backend API automatically switches to local rule-based mock responses or tries local Ollama connections to prevent runtime crashes.

### Key Rotation Guidelines
1. In the event of keys exposure, revoke the token immediately via the [Groq Console](https://console.groq.com/keys).
2. Generate a new key and update the local `backend/.env` file.
3. Restart the backend service (`uvicorn`) to reload variables.

---

## 🧪 Sandbox Safety & Isolation

The Active Sandbox allows analysts to review malicious scripts, command chains, or uploaded payload buffers.

> [!CAUTION]
> The sandbox uses simulated behavior heuristics. To prevent actual code execution:
> 1. Do **not** upload live binary files, compiled malware, or execute scripts directly on the host machine.
> 2. The sandbox service extracts text signatures and runs safe emulation loops using dictionary mocks.
> 3. For advanced forensic analysis, run the backend server inside an isolated Virtual Machine (VM) or containerized environment (Docker/LXC) with network isolation enabled.

---

## 🧬 Threat Modeling Boundaries

### 1. Attacker-facing Decoys (Honeypot ports)
* The honeypot lab listens on configurable decoy ports (e.g. 2222, 8080).
* Since these decoy services are open to network connections, they must not share process credentials or use administrative permissions. Uvicorn and FastAPI should run as a non-privileged system user (`nobody` or local developer user).

### 2. Cross-Site Scripting (XSS) Prevention
* The frontend console displays raw payloads captured from attackers.
* To prevent browser-side exploitation, the React rendering engine automatically sanitizes HTML content. The custom parser tokenizes tags and outputs React elements rather than injecting raw text as `dangerouslySetInnerHTML`.

---

## ✉️ Vulnerability Disclosure Policy

If you discover a security issue (e.g., key exposure paths, sandbox escapes, or buffer vulnerabilities), please do not open a public issue. Instead, report it privately to the maintainers or follow the project's security coordinates protocol (Placeholder email: `security@sentinelai.local`).
