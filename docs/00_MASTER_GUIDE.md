# 00 — SentinelAI Master Guide

> [!NOTE]
> **Design Specification**: This document serves as an initial design specification. For current live platform documentation, refer to:
> * [Project Overview](PROJECT_OVERVIEW.md)
> * [System Architecture](ARCHITECTURE.md)
> * [Feature Reference](FEATURES.md)
> * [API Reference](API_REFERENCE.md)
> * [Installation & Setup](SETUP.md)
> * [Development Roadmap](ROADMAP.md)

---

## Mission

SentinelAI is a local-first defensive cybersecurity platform that combines SOC visualization, honeypot telemetry, system and event-log monitoring, AI assistance (Groq Cloud API & local fallback), MITRE ATT&CK mapping, incident analysis and reporting.

## Product Principles

1. **Defensive by Design** — features support detection, analysis, containment recommendations and authorized local response.
2. **Local-First & Privacy Conscious** — designed for privacy and local control with cloud AI options.
3. **Observable Systems** — health, connection and collector states are visible and dynamic.
4. **Modular Architecture** — page modules and backend services remain isolated.
5. **No Hidden Automation** — sensitive actions require clear user intent and audit logging.
6. **Reference-Driven UI** — clean layout standards maintain visual consistency across pages.
7. **Incremental Quality** — every phase must compile, test and document changes.

## Primary Users

- Cybersecurity students
- SOC analysts in training
- Defensive security researchers
- Small local lab operators
- Portfolio reviewers
- Authorized blue-team environments

## Major Navigation & Engine Domains

### Core Navigation Views:
- SOC Overview (`/`)
- AI Assistant & Investigator (`/agent`)
- Threat Intelligence (`/attackers`)
- Incident Response (`/attacks`)
- Honeypot Operations (`/sensors`)
- WAF Manager (`/waf`)
- Incident Reporting (`/reports`)

### Subsystem & Backend Engines:
- Sandbox Console (`/sandbox`)
- Automated Threat Correlation Engine (`services/correlation_engine.py`)
- System Configuration & Alert Thresholds (`api/settings.py`)

## Definition of Done

SentinelAI is considered stable when:

- All routes load without runtime errors
- Backend starts cleanly
- Database initializes idempotently
- AI status and models are discovered dynamically
- Attack events flow from honeypot to database, WebSocket and UI
- Reports are generated asynchronously from real filters
- Tests, lint and builds pass
- Security limitations are documented
