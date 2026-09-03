# Security Policy

## Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

The SentinelAI team takes the security of this platform seriously. If you discover a security vulnerability, please do **NOT** open a public issue.

Instead, please report vulnerabilities directly to the maintainer via email:
- **Email**: [security@sentinel.ai](mailto:security@sentinel.ai) or reach out via [GitHub Profile](https://github.com/Vaishnav53)

Please include:
1. Description of the vulnerability and its potential impact.
2. Step-by-step reproduction steps or proof-of-concept (PoC).
3. The affected component (e.g., WAF engine, API authentication, session handling, decoy listener).

You can expect:
- Initial acknowledgement within 48 hours.
- A status update within 5 business days with triage findings.
- Remediation coordination prior to public disclosure.

## Operational & Honeypot Safety Notice

SentinelAI includes an emulated Honeypot Decoy subsystem ([backend/services/honeypot.py](file:///D:/Documents/SentinelAI/backend/services/honeypot.py)) designed to capture adversary probes.

- **Containment**: All emulated services (HTTP, SSH, FTP, Telnet) run within mock handlers without spawning real shells or executing host-level system commands.
- **Production Isolation**: When deploying decoy listeners in production or on LAN interfaces (`0.0.0.0`), ensure they run on an isolated network segment (VLAN / DMZ) to prevent lateral adversary movement.
- **Secrets & Credentials**: Never hardcode production API keys or credentials in configuration files. Always use environment variables.
