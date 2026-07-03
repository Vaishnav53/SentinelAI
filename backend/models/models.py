from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.models.base import Base, DBBaseModel

class ApplicationSetting(Base, DBBaseModel):
    __tablename__ = "application_settings"
    
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    type = Column(String, default="string", nullable=False)  # string, int, float, bool, json

class AttackEvent(Base, DBBaseModel):
    __tablename__ = "attack_events"
    
    external_id = Column(String, index=True, nullable=True)
    attack_type = Column(String, index=True, nullable=False)
    severity = Column(String, index=True, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String, index=True, nullable=False)  # NEW, ASSIGNED, RESOLVED, IGNORED
    source_ip = Column(String, index=True, nullable=False)
    source_port = Column(Integer, nullable=True)
    destination_ip = Column(String, nullable=True)
    destination_port = Column(Integer, index=True, nullable=False)
    protocol = Column(String, nullable=True)  # TCP, UDP, ICMP
    target_service = Column(String, nullable=True)  # HTTP, SSH, FTP, etc.
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    payload = Column(Text, nullable=True)
    user_agent = Column(String, nullable=True)
    sensor_id = Column(String, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=True)
    threat_score = Column(Float, default=0.0, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    raw_metadata = Column(Text, nullable=True)  # JSON dump of raw captured data

class HoneypotSensor(Base, DBBaseModel):
    __tablename__ = "honeypot_sensors"
    
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # HTTP, SSH, FTP, TELNET
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    state = Column(String, default="IDLE", nullable=False)  # ONLINE, OFFLINE, IDLE, ERROR
    last_heartbeat = Column(DateTime, nullable=True)
    configuration = Column(Text, nullable=True)  # JSON configuration overrides

class SystemMetric(Base, DBBaseModel):
    __tablename__ = "system_metrics"
    
    cpu_percent = Column(Float, nullable=False)
    memory_percent = Column(Float, nullable=False)
    disk_percent = Column(Float, nullable=False)
    network_sent = Column(Float, nullable=False)  # Bytes sent
    network_received = Column(Float, nullable=False)  # Bytes received
    process_count = Column(Integer, nullable=False)

class WindowsLogEvent(Base, DBBaseModel):
    __tablename__ = "windows_log_events"
    
    event_record_id = Column(Integer, nullable=True)
    event_id = Column(Integer, index=True, nullable=False)
    channel = Column(String, index=True, nullable=False)  # Security, System, Application, PowerShell
    provider = Column(String, nullable=True)
    level = Column(String, nullable=True)  # Information, Warning, Error, Critical
    computer = Column(String, nullable=True)
    user_name = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    raw_xml = Column(Text, nullable=True)
    classification = Column(String, nullable=True)
    severity = Column(String, index=True, nullable=False)

class ReportJob(Base, DBBaseModel):
    __tablename__ = "report_jobs"
    
    job_type = Column(String, nullable=False)  # PDF, CSV, JSON
    status = Column(String, index=True, default="queued", nullable=False)  # queued, generating, completed, failed
    filters = Column(Text, nullable=True)  # JSON formatted filters used
    progress = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    
    reports = relationship("Report", back_populates="job", cascade="all, delete-orphan")

class Report(Base, DBBaseModel):
    __tablename__ = "reports"
    
    job_id = Column(Integer, ForeignKey("report_jobs.id"), nullable=True)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    format = Column(String, nullable=False)  # pdf, csv, json
    generated_by = Column(String, default="System", nullable=False)
    
    job = relationship("ReportJob", back_populates="reports")

class AIConversation(Base, DBBaseModel):
    __tablename__ = "ai_conversations"
    
    conversation_key = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=True)
    model_used = Column(String, nullable=True)
    linked_attack_id = Column(Integer, nullable=True)
    
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")

class AIMessage(Base, DBBaseModel):
    __tablename__ = "ai_messages"
    
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # system, user, assistant
    content = Column(Text, nullable=False)
    model = Column(String, nullable=True)
    latency = Column(Float, nullable=True)  # response generation time in seconds
    
    conversation = relationship("AIConversation", back_populates="messages")

class MITREMapping(Base, DBBaseModel):
    __tablename__ = "mitre_mappings"
    
    event_type = Column(String, nullable=False)  # attack, windows_log
    event_id = Column(Integer, nullable=False)  # references ID of target event
    tactic_id = Column(String, index=True, nullable=False)  # e.g., TA0001
    tactic_name = Column(String, nullable=False)
    technique_id = Column(String, index=True, nullable=False)  # e.g., T1059
    technique_name = Column(String, nullable=False)

class AuditLog(Base, DBBaseModel):
    __tablename__ = "audit_logs"
    
    action = Column(String, index=True, nullable=False)
    module = Column(String, index=True, nullable=False)  # settings, sensor, reports, agent
    user = Column(String, default="system", nullable=False)
    details = Column(Text, nullable=True)

# Define indexes for performance optimization as requested in 05_DATABASE_DESIGN.md
# Index timestamps (created_at is defined in DBBaseModel)
Index("ix_attack_events_created_at", AttackEvent.created_at)
Index("ix_system_metrics_created_at", SystemMetric.created_at)
Index("ix_windows_log_events_created_at", WindowsLogEvent.created_at)
Index("ix_audit_logs_created_at", AuditLog.created_at)

class WAFRule(Base, DBBaseModel):
    __tablename__ = "waf_rules"
    
    ip_address = Column(String, index=True, nullable=True)  # Specific IP target, or null for general WAF check signatures
    action = Column(String, index=True, nullable=False)  # ALLOW, BLOCK, QUARANTINE
    reason = Column(Text, nullable=True)
    is_enabled = Column(Integer, default=1, nullable=False)  # 1 = Enabled, 0 = Disabled
    rule_type = Column(String, index=True, default="MANUAL", nullable=False)  # MANUAL, AUTOMATIC
    expires_at = Column(DateTime, nullable=True)
    analyst_attribution = Column(String, nullable=True)
    trigger_count = Column(Integer, default=0, nullable=False)

class WAFHit(Base, DBBaseModel):
    __tablename__ = "waf_hits"
    
    ip_address = Column(String, index=True, nullable=False)
    rule_id = Column(Integer, ForeignKey("waf_rules.id"), nullable=True)
    path = Column(String, nullable=False)
    method = Column(String, nullable=False)
    action = Column(String, nullable=False)
    payload = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)

Index("ix_waf_rules_created_at", WAFRule.created_at)
Index("ix_waf_hits_created_at", WAFHit.created_at)

class NormalizedLog(Base, DBBaseModel):
    __tablename__ = "normalized_logs"
    
    log_source = Column(String, index=True, nullable=False)  # WINDOWS, SYSLOG, SENSOR
    event_id = Column(String, index=True, nullable=True)
    source_ip = Column(String, index=True, nullable=True)
    destination_ip = Column(String, index=True, nullable=True)
    user_name = Column(String, index=True, nullable=True)
    hostname = Column(String, index=True, nullable=True)
    message = Column(Text, nullable=False)
    severity = Column(String, index=True, nullable=False)
    technique_id = Column(String, index=True, nullable=True)
    raw_data = Column(Text, nullable=True)  # JSON formatted metadata details

class CorrelatedIncident(Base, DBBaseModel):
    __tablename__ = "correlated_incidents"
    
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, index=True, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Float, default=1.0, nullable=False)
    status = Column(String, index=True, default="NEW", nullable=False)  # NEW, INVESTIGATING, CONTAINED, CLOSED
    assigned_analyst = Column(String, nullable=True)
    nodes_data = Column(Text, nullable=True)  # JSON serialized list of nodes in chain
    links_data = Column(Text, nullable=True)  # JSON serialized list of links in chain
    timeline_data = Column(Text, nullable=True)  # JSON serialized list of timeline logs

Index("ix_normalized_logs_created_at", NormalizedLog.created_at)
Index("ix_correlated_incidents_created_at", CorrelatedIncident.created_at)

class DecoySandboxFile(Base, DBBaseModel):
    __tablename__ = "decoy_sandbox_files"
    
    filename = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String, index=True, nullable=False)
    md5 = Column(String, nullable=False)
    sha1 = Column(String, nullable=False)
    status = Column(String, index=True, nullable=False)  # CLEAN, SUSPICIOUS, MALICIOUS
    threat_score = Column(Float, default=0.0, nullable=False)
    malware_description = Column(String, nullable=True)
    vt_reputation = Column(String, nullable=True)
    sandbox_path = Column(String, nullable=False)
    ip_address = Column(String, index=True, nullable=False)

Index("ix_decoy_sandbox_files_created_at", DecoySandboxFile.created_at)
