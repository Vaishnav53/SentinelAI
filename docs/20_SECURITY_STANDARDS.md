# 20 — Security Standards

> [!NOTE]
> **Design Specification**: This document is a security policies specification. For current live security notes and key management policies, refer to [SECURITY_NOTES.md](SECURITY_NOTES.md).

---

## Security Policies & Guidelines

1. **Environment Secrets Isolation**: Sensitive API credentials (`GROQ_API_KEY`, `SECRET_KEY`) must load exclusively via `backend/.env` and must never be committed to source control or exposed in API response headers.
2. **Sandbox Isolation**: Decoy sandbox execution tests payloads safely using MD5/SHA256 signature matching and heuristic checks.
3. **CORS Restrictions**: Frontend API access is restricted strictly to permitted origins via `FRONTEND_ORIGIN` settings (`http://localhost:5173`).
4. **Input Validation**: All REST request bodies are validated using Pydantic models to prevent invalid parameter injection.
