# 21 — Coding Standards

## Python

- Type hints
- Pydantic schemas
- Async I/O for network operations
- Small route handlers
- Service-layer logic
- Clear exception types
- Docstrings for public services
- Ruff or Flake8-compatible style
- pytest tests

## React

- Functional components
- Custom hooks
- Stable keys
- No API calls directly in deeply nested presentation components
- Accessible controls
- Avoid giant JSX files
- Avoid duplicated styles
- Cleanup effects and WebSockets
- ESLint clean

## Naming

- React components: PascalCase
- Hooks: useCamelCase
- Python modules: snake_case
- API fields: snake_case unless a documented convention changes
- Constants: UPPER_SNAKE_CASE

## Git

Recommended checkpoints:

- `chore/foundation`
- `feat/backend-core`
- `feat/dashboard`
- `feat/agent`
- one feature branch per phase

Never mix unrelated page changes in one commit.
