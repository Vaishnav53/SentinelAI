# 26 — Presentation Script & Speaker Guide

This document provides a spoken presentation script designed for a 12-to-15 minute technical project defense, university final-year project presentation, or technical demonstration of SentinelAI.

---

## 🎙️ Presentation Overview

* **Target Duration**: 12–15 Minutes
* **Speaker Tone**: Professional, confident, articulate, and technical
* **Visual Aid Requirements**: Live browser window running SentinelAI (or recorded HD demo video) + slide deck

---

## 📜 Complete Spoken Script

### 1. Greeting & Introduction (1 Minute)

> "Good morning, members of the evaluation panel, faculty, and esteemed guests. My name is Vaishnav, and today I am proud to present **SentinelAI** — an advanced, local-first Security Operations Center simulation, threat correlation, and AI-driven incident response platform.
>
> In today's digital landscape, organizations face unprecedented volumes of cyber threats ranging from brute-force intrusions to complex multi-stage web application exploits. SentinelAI was built to bridge the critical gap between passive intrusion detection systems and actionable, intelligent incident triage."

---

### 2. Problem Statement & Motivation (1.5 Minutes)

> "Traditional Security Information and Event Management (SIEM) solutions present three fundamental challenges for modern SOC analysts:
>
> First, **Alert Fatigue**: Security analysts are overwhelmed by thousands of un-correlated micro-events per day, making it difficult to distinguish routine port scans from critical compromise indicators.
>
> Second, **Siloed Deception and Telemetry**: Honeypots, web application firewalls, and system monitoring tools often operate in isolation without unified correlation.
>
> Third, **Delayed Response Triage**: Manually dissecting raw request payloads, checking IP reputations, mapping MITRE ATT&CK techniques, and drafting executive briefs slows down mean time to respond (MTTR).
>
> SentinelAI directly addresses these challenges by uniting multi-protocol deception sensors, real-time log ingestion, active WAF defenses, automated threat correlation, and an integrated AI Security Investigator Workspace into a single, cohesive platform."

---

### 3. Key Objectives & Scope (1.5 Minutes)

> "Our design and implementation objectives for SentinelAI were centered on five key pillars:
>
> 1. **Integrated Threat Sensing**: Capturing real-time telemetry across multi-protocol decoy honeypots — including HTTP, SSH, FTP, and Telnet sensors — alongside active WAF parameter filtering.
> 2. **Automated Incident Correlation**: Grouping related attack micro-events into high-fidelity correlated incidents using composite threat scoring algorithms.
> 3. **AI-Assisted Investigation**: Providing an integrated AI Copilot & AI Investigator Workspace capable of performing seven structured security analyses on demand.
> 4. **Active Defense & Countermeasures**: Enabling instant IP quarantine blocklists and actionable containment playbooks.
> 5. **Hybrid Deployment Readiness**: Offering a lightweight, local-first development setup coupled with containerized hybrid deployment foundation assets using Docker Compose, Nginx, and PostgreSQL."

---

### 4. High-Level Architecture & Tech Stack (2 Minutes)

> "Let us examine the underlying architecture that powers SentinelAI.
>
> On the **Backend**, we leverage Python 3.11 with FastAPI running on Uvicorn. FastAPI’s asynchronous ASGI framework enables high-throughput REST endpoints and native WebSocket streaming (`/api/attacks/ws`) to push live security events directly to connected client dashboards.
>
> Our **Persistence Layer** utilizes SQLAlchemy ORM, offering seamless flexibility: local SQLite storage for zero-dependency workstation development, and PostgreSQL integration for containerized deployments.
>
> On the **Frontend**, SentinelAI is built with React 18 and Vite. The user interface features a single-shell viewport layout with modern dark-mode styling, custom CSS design tokens, and real-time Recharts analytics.
>
> For **AI Intelligence**, SentinelAI incorporates Groq Cloud API as its primary live LLM provider using `llama-3.3-70b-versatile` for ultra-low latency inference, paired with a deterministic local fallback response engine when cloud AI is unconfigured or offline."

---

### 5. Live Feature Walkthrough (5 Minutes)

*(Transition to live browser window at `http://localhost:5173`)*

#### A. SOC Command Center Dashboard (`/`)
> "Here on our main dashboard, analysts receive an immediate operational brief. At the top, the System Vitals bar tracks host CPU, memory, disk utilization, and open ports using Python's `psutil` library.
>
> Below, dynamic KPI cards highlight total captured threats, current threat levels, and sensor statuses. The Geographical Threat Map plots real-time IP geolocation coordinates, while our activity feed streams live normalized events via WebSockets."

#### B. Decoy Honeypot Lab (`/sensors`)
> "Navigating to the Honeypot Lab, SentinelAI operates isolated socket listeners emulating vulnerable services: HTTP on port 8088, SSH on port 2222, FTP on port 2121, and Telnet on port 2323. When an attacker probes these ports, full payload buffers are logged safely without risking host assets."

#### C. Incident Response (`/attacks`)
> "In the Incident Response feed, analysts can filter incoming events by severity — Critical, High, Medium, or Low — search by protocol, inspect raw request headers, and view extracted GeoIP telemetry."

#### D. AI Investigator Workspace (`/agent`)
> "Now, let us highlight one of SentinelAI's core innovations: the **AI Security Copilot & Investigator Workspace**.
>
> In the Telemetry tab, analysts can chat directly with our defensive AI copilot. Switching to the **Investigator Tab**, an analyst selects an active threat context — such as a Critical Path Traversal attack.
>
> With a single click, the analyst can trigger seven structured security actions:
> 1. *Analyze Incident* for deep root-cause diagnostic evaluations.
> 2. *Extract IOCs* to isolate malicious IPs, domains, and payload hashes.
> 3. *Recommend Containment* for actionable step-by-step firewall block playbooks.
> 4. *Map to MITRE* to identify technique codes such as T1190 or T1059.
> 5. *Generate Timeline* for chronological event reconstruction.
> 6. *Explain Severity* for risk scoring breakdown.
> 7. *Executive Summary* for non-technical leadership briefs."

#### E. Reports Subsystem (`/reports`)
> "Finally, in the Reports module, SentinelAI allows analysts to generate downloadable executive compliance PDF reports and export raw incident records into CSV files for external audits."

---

### 6. Deployment & Security Architecture (1.5 Minutes)

> "SentinelAI is designed with strict security standards in mind:
>
> All sensitive API credentials and database connection strings are isolated within backend environment files (`.env`) and are never exposed to client browser bundles or version control.
>
> For deployment, SentinelAI provides a containerized hybrid deployment foundation using Docker Compose, orchestrating the FastAPI backend, Nginx reverse proxy with SSL termination and WebSocket upgrading, PostgreSQL database storage, and automated database backup and restore shell scripts."

---

### 7. Future Enhancements & Conclusion (1.5 Minutes)

> "Looking ahead, our technical roadmap includes expanding SIEM query exporters for Splunk and Elastic, implementing distributed remote sensor forwarders, and introducing hands-free voice command interface controls.
>
> To conclude, SentinelAI demonstrates how modern web architecture, deception technology, and artificial intelligence can unite to simplify SOC operations, reduce mean time to triage, and empower cybersecurity defenders.
>
> Thank you for your time. I am now open to questions from the evaluation panel."

---

## ❓ Frequently Asked Questions & Defensive Answers

* **Q: How does SentinelAI ensure honeypots do not compromise host safety?**
  * **A**: Honeypots run inside isolated non-privileged socket threads. They capture incoming bytes and close connections without executing untrusted payload instructions.

* **Q: What happens if internet access is lost or Groq API is unavailable?**
  * **A**: SentinelAI incorporates a deterministic local fallback response engine that supplies structured threat analysis templates without crashing the analyst UI.
