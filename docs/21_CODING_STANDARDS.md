# 21 — Coding Standards

> [!NOTE]
> **Design Specification**: This document provides coding guidelines and quality standards for SentinelAI development.

---

## Code Quality & Style Standards

1. **Python (Backend)**:
   - PEP 8 code formatting compliance.
   - Type annotations for functions and FastAPI endpoint signatures.
   - Pydantic models for request/response serialization.
   - Async endpoints for long-running or IO-bound operations.
2. **JavaScript / React (Frontend)**:
   - Functional React components with hooks.
   - Modular CSS files co-located with page components.
   - Descriptive variable naming and clean component decomposition.
3. **Documentation & Testing**:
   - Maintain clear docstrings for backend services.
   - Ensure all automated unit tests (`pytest`) pass before releasing patches.
