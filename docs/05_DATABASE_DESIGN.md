# 05 — Database Design

## Core entities

### AttackEvent
- id
- external_id
- attack_type
- severity
- status
- source_ip
- source_port
- destination_ip
- destination_port
- protocol
- target_service
- country
- city
- payload
- user_agent
- sensor_id
- session_id
- threat_score
- confidence
- raw_metadata
- created_at

### HoneypotSensor
- id
- name
- type
- host
- port
- state
- last_heartbeat
- configuration
- created_at

### SystemMetric
- id
- cpu_percent
- memory_percent
- disk_percent
- network_sent
- network_received
- process_count
- created_at

### WindowsLogEvent
- id
- event_record_id
- event_id
- channel
- provider
- level
- computer
- user_name
- message
- raw_xml
- classification
- severity
- created_at

### ReportJob and Report
Separate asynchronous job state from completed artifacts.

### AIConversation and AIMessage
Store optional local conversation history with model and timestamps.

### MITREMapping
Link attacks or Windows events to tactic and technique identifiers.

### AuditLog
Track settings changes, sensor actions, report actions and future active response.

## Indexes

Index timestamps, severity, source IP, attack type, sensor ID, event ID and report status.

## Retention

Retention is configurable. Purging must be explicit, logged and performed in batches.
