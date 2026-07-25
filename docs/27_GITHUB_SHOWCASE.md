# 27 — GitHub Repository Showcase & Presentation Guide

This guide details best practices for showcasing SentinelAI professionally on GitHub, optimizing repository branding, badges, screenshots, demonstration media, and portfolio visibility.

---

## 🎨 1. Repository Branding & Metadata

### Official Repository Title
**`SentinelAI`** — AI-Powered Cyber Defense & SOC Simulation Platform

### Short Description (About Section)
> Advanced, local-first SOC simulation, threat correlation, and AI incident response platform with multi-protocol honeypots, active WAF defense, and MITRE ATT&CK mapping.

### Recommended Repository Topics / Tags
Add the following topic tags on GitHub under `About -> Edit Topics`:

`cybersecurity` • `soc-platform` • `ai-security` • `honeypot` • `fastapi` • `react` • `threat-correlation` • `mitre-attack` • `waf` • `incident-response` • `groq-cloud` • `docker` • `python` • `vite`

---

## 🖼️ 2. Visual Assets & Media Strategy

### A. Repository Banner
Include a 1200x400 SVG/PNG banner graphic at the top of `README.md`:
* **Path**: `docs/assets/branding/banner.svg`
* **Style**: Dark cyber aesthetic with SentinelAI logo, status indicators, and feature callouts.

### B. Curated Screenshot Portfolio
Ensure high-resolution 1080p screenshots exist in `docs/assets/screenshots/`:
1. `dashboard.png`: SOC Command Center with system vitals, map, and telemetry ticker displaying the 7-item sidebar navigation.
2. `copilot.png`: AI Copilot & AI Investigator Workspace with threat context panel.
3. `honeypot.png`: Honeypot Decoy Lab showing SSH, HTTP, FTP, Telnet hit counters.
4. `reports.png`: Executive Reports & Decoy Sandbox file scanner view.

### C. Recommended Animated Demonstration GIFs
Convert short 10-second screen captures into optimized GIFs (`docs/assets/gifs/`):
* `realtime_alert.gif`: Demonstrates live WebSocket alert arrival on the dashboard.
* `ai_investigator_action.gif`: Shows selecting threat context and executing *Analyze Incident* or *Extract IOCs*.
* `waf_ip_block.gif`: Demonstrates adding an offending IP to the WAF quarantine blocklist.

---

## 📹 3. Demo Video Embedding Guidelines

To showcase your demo video on GitHub:
1. Upload HD demo video (from `docs/25_DEMO_VIDEO_GUIDE.md`) to YouTube (Unlisted or Public) or Vimeo.
2. Embed clickable video thumbnail preview in `README.md`:

```markdown
[![SentinelAI Video Demonstration](docs/assets/screenshots/dashboard.png)](https://www.youtube.com/watch?your_video_id "Watch SentinelAI Demo Video")
```

---

## 🚀 4. GitHub Release Checklist

When publishing GitHub release tags (e.g. `v0.15.2`):

* [ ] Verify clean working tree (`git status`).
* [ ] Run backend test suite (`pytest backend/tests`).
* [ ] Verify frontend build (`npm run build`).
* [ ] Tag release commit (`git tag -a v0.15.2 -m "Release v0.15.2"`).
* [ ] Push tag (`git push origin v0.15.2`).
* [ ] Draft Release Notes on GitHub featuring:
  * Highlighted features (Phase 15B AI Investigator, Phase 16 Deployment Foundation).
  * System requirements (Python 3.11+, Node 18+).
  * Downloadable source code archive (`.zip` / `.tar.gz`).

---

## 💼 5. Portfolio & Recruiter Showcase Checklist

* [ ] Add direct link to live repository in LinkedIn project sections and resume.
* [ ] Ensure repository pinned to GitHub profile overview.
* [ ] Confirm open-source MIT license file (`LICENSE`) is present in repository root.
* [ ] Verify `.gitignore` excludes virtual environments, Node modules, `.env` files, and database files (`sentinelai.db`).
* [ ] Ensure documentation index in `README.md` links cleanly to all technical guides.
