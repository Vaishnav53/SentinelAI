# 22 — Testing Guide

> [!NOTE]
> **Design Specification**: This document provides automated testing specifications. For current setup instructions and test execution commands, refer to [SETUP.md](SETUP.md).

---

## Test Execution Guidelines

### 1. Backend Pytest Suite
Run the backend automated integration test suite from the repository root:
```powershell
$env:PYTHONPATH="D:\Documents\SentinelAI"
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```
*Executes 19 test cases validating database models, API routers, WAF inspection rules, correlation logic, and report generation.*

### 2. Frontend Production Build Verification
Verify React/Vite bundle compilation:
```powershell
cd D:\Documents\SentinelAI\frontend
npm run build
```
*Ensures all UI modules and CSS tokens compile cleanly.*
