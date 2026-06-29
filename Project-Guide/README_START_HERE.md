# SentinelAI Development Bible — Start Here

This package is the authoritative engineering guide for building **SentinelAI**, a local-first, enterprise-style, AI-powered cyber-defense platform.

## Primary use

1. Open a fresh Antigravity workspace.
2. Place or clone the SentinelAI repository in the workspace.
3. Upload the page reference images listed in `checklists/ASSET_UPLOAD_CHECKLIST.md`.
4. Paste the complete contents of `ANTIGRAVITY_MASTER_PROMPT.md` into Antigravity.
5. Allow Antigravity to inspect the workspace before writing code.
6. Require a clean build and test report at the end of every phase.

## Important scope

SentinelAI is a defensive cybersecurity lab and SOC simulation platform. It is intended for:

- Local development
- Authorized testing
- Honeypot research
- Defensive monitoring
- Log analysis
- Threat classification
- Incident-response training

It must not automate unauthorized exploitation, persistence, credential theft, destructive actions, or attacks against systems the operator does not own or have explicit permission to test.

## Key documents

- `ANTIGRAVITY_MASTER_PROMPT.md` — one complete prompt to begin the project from scratch.
- `docs/00_MASTER_GUIDE.md` — project-wide source of truth.
- `docs/02_SYSTEM_ARCHITECTURE.md` — end-to-end architecture.
- `docs/03_FRONTEND_ARCHITECTURE.md` — frontend folder and component rules.
- `docs/04_BACKEND_ARCHITECTURE.md` — backend folder and service rules.
- `docs/06_API_REFERENCE.md` — target API contracts.
- `docs/07_UI_DESIGN_SYSTEM.md` — common UI system.
- `docs/09_DASHBOARD.md` through `docs/19_SETTINGS.md` — page/module specifications.
- `docs/24_ROADMAP.md` — recommended implementation order.
- `prompts/` — page-specific continuation prompts.
- `checklists/` — asset and execution checklists.

## Development rule

Build one phase at a time, but keep the entire architecture consistent. A phase is complete only after:

- Code compiles
- Tests pass
- Relevant APIs work
- No unrelated page is broken
- The UI is compared against its reference image
- Technical debt is documented
