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
