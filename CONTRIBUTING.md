# Contributing to SentinelAI

Thank you for your interest in contributing to SentinelAI! We welcome contributions that improve security capabilities, refine threat detection heuristics, or optimize platform performance.

---

## Code of Conduct

All contributors are expected to adhere to professional, respectful, and constructive collaboration standards.

---

## Development Setup

### Prerequisites
- **Python**: 3.11+ (Python 3.11 - 3.14 supported)
- **Node.js**: 18+ (Node 20+ recommended)
- **Git**: 2.30+

### 1. Fork & Clone
```bash
git clone https://github.com/Vaishnav53/SentinelAI.git
cd SentinelAI
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
cp .env.example .env
```

---

## Validation Before Submitting

Always run the full automated verification suite locally before opening a pull request:

### Backend Tests
Ensure all 45 test cases pass:
```bash
# From repository root:
$env:PYTHONPATH="."; & backend\.venv\Scripts\pytest.exe backend/tests
```

### Frontend Build & Lint
Ensure the client builds cleanly with zero lint errors:
```bash
cd frontend
npm run build
npm run lint
```

### Git Hygiene Check
```bash
git diff --check
```

---

## Commit Guidelines

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat(...)`: New user-facing feature or detection capability
- `fix(...)`: Bug fix or defect resolution
- `perf(...)`: Performance optimization
- `docs(...)`: Documentation updates
- `test(...)`: Adding or updating test suites
- `chore(...)`: Maintenance, dependency, or build tasks

---

## Pull Request Process

1. Create a descriptive feature branch (`git checkout -b feat/your-feature-name`).
2. Make minimal, focused, well-tested changes.
3. Verify that no secrets, database files (`.db`), or local machine paths are committed.
4. Open a pull request against `main` with a clear explanation of changes and validation evidence.
