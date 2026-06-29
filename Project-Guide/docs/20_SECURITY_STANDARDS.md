# 20 — Security Standards

## Principles

- Least privilege
- Local-first data handling
- Explicit authorization
- Safe defaults
- Input validation
- Auditability
- Reversible actions
- Clear trust boundaries

## API security

- Validate every request
- Limit payload sizes
- Sanitize filenames
- Prevent path traversal
- Avoid shell command construction
- Use timeouts
- Restrict CORS
- Hide internal stack traces
- Rate-limit sensitive endpoints

## Honeypot security

- Isolate listeners
- Avoid real vulnerable software
- Store raw payloads safely
- Escape payloads in UI
- Never execute captured content
- Configure retention and truncation

## AI security

- Treat logs and payloads as untrusted input
- Separate system instructions from event content
- Do not permit prompt content to invoke tools automatically
- Require confirmation for future response actions
- Keep local model traffic local by default

## Secrets

Use environment variables. Never commit secrets, tokens, private keys or production credentials.
