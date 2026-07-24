# 05 — Database Design

> [!NOTE]
> **Design Specification**: This document is an initial database design blueprint. For the current live ORM schema definitions and database configurations, refer to [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Core Entities & Schemas

### `AttackEvent`
Stores raw logs captured by host sensors, WAF filters, or honeypot sensors.
* `id` (Integer, Primary Key)
* `external_id` (String, Unique)
* `attack_type` (String) | `severity` (String) | `status` (String)
* `source_ip` (String) | `source_port` (Integer) | `destination_port` (Integer)
* `protocol` (String) | `target_service` (String)
* `country` (String) | `city` (String)
* `payload` (Text) | `user_agent` (String)
* `threat_score` (Integer) | `confidence` (Float)
* `created_at` (DateTime)

### `CorrelatedIncident`
Groups related `AttackEvent` entries into aggregated incidents.
* `id` (Integer, Primary Key)
* `title` / `incident_type` (String)
* `severity` (String) | `status` (String)
* `attack_count` (Integer) | `threat_score` (Integer)
* `source_ip` (String) | `summary` (Text)
* `created_at` / `updated_at` (DateTime)

### `HoneypotSensor`
Tracks multi-protocol decoy sensors and listener statuses.
* `id` (Integer, Primary Key)
* `name` (String) | `type` (String)
* `host` (String) | `port` (Integer)
* `state` (String - ONLINE, IDLE, OFFLINE)
* `last_heartbeat` (DateTime)

### `DecoySandboxFile`
Tracks mock payload behaviors scanned by the decoy sandbox engine.
* `id` (Integer, Primary Key)
* `filename` (String) | `md5` (String) | `sha256` (String)
* `status` (String) | `threat_score` (Float)

### `AIConversation` & `AIMessage`
Stores interactive copilot chat threads and messages history.

### `ApplicationSetting`
Stores platform preferences, default models, and system threshold parameters.

---

## Database Dialects & Persistence

* **Development Engine**: Local SQLite database file (`backend/storage/sentinelai.db`).
* **Containerized Engine**: PostgreSQL database container (`docker-compose.yml`).
* **Auto-Seeding**: The `populate_demo_data()` function automatically creates schema tables and seeds initial demo telemetry on backend startup if tables are empty.
