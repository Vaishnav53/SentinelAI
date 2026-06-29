# 00 — SentinelAI Master Guide

## Mission

SentinelAI is a local-first defensive cybersecurity platform that combines SOC visualization, honeypot telemetry, system and event-log monitoring, local LLM assistance, MITRE ATT&CK mapping, incident analysis and reporting.

## Product principles

1. **Defensive by design** — features support detection, analysis, containment recommendations and authorized local response.
2. **Local-first intelligence** — Ollama is the default AI runtime.
3. **Observable systems** — health, connection and collector states are visible and dynamic.
4. **Modular architecture** — page modules and backend services remain isolated.
5. **No hidden automation** — sensitive actions require clear user intent and audit logging.
6. **Reference-driven UI** — each uploaded image defines its page layout.
7. **Incremental quality** — every phase must compile, test and document changes.

## Primary users

- Cybersecurity students
- SOC analysts in training
- Defensive security researchers
- Small local lab operators
- Portfolio reviewers
- Authorized blue-team environments

## Major domains

- SOC Overview
- AI Assistant
- Attack Telemetry
- Honeypot Operations
- Host Monitoring
- Windows Event Analysis
- Threat Intelligence
- MITRE ATT&CK
- Incident Reporting
- Platform Settings

## Definition of done

SentinelAI is considered stable when:

- All routes load without runtime errors
- Backend starts cleanly
- Database initializes idempotently
- Ollama status and models are discovered dynamically
- Attack events flow from honeypot to database, WebSocket and UI
- Reports are generated asynchronously from real filters
- Monitoring and Windows-log collectors expose heartbeats
- UI pages match their reference images closely
- Tests, lint and builds pass
- Security limitations are documented

## Governance

This guide is the source of truth. If implementation and guide conflict, either update implementation or revise the guide explicitly. Avoid silent architectural drift.
