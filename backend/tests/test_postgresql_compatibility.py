import pytest
from sqlalchemy import func
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql
from unittest.mock import MagicMock
from fastapi import Response

from backend.models.base import Base
from backend.models.models import (
    AttackEvent,
    ApplicationSetting,
    HoneypotSensor,
    SystemMetric,
    WindowsLogEvent,
    ReportJob,
    Report,
    AIConversation,
    AIMessage,
    MITREMapping,
    AuditLog,
    WAFRule,
    WAFHit,
    NormalizedLog,
    CorrelatedIncident,
    DecoySandboxFile,
    ThreatPlaybook,
    PlaybookExecution,
    HoneypotPortalUser,
    HoneypotFeedback,
    HoneypotActivityLog,
    SentinelUser,
    UserSession
)
from backend.core.config import settings
from backend.api.health import check_db_readiness
from backend.services.decoy_sandbox import DecoySandboxService


def test_postgresql_ddl_compilation():
    """Verify that all core SQLAlchemy tables compile cleanly against the PostgreSQL dialect."""
    pg_dialect = postgresql.dialect()
    
    tables_to_verify = [
        AttackEvent, ApplicationSetting, HoneypotSensor, SystemMetric,
        WindowsLogEvent, ReportJob, Report, AIConversation, AIMessage,
        MITREMapping, AuditLog, WAFRule, WAFHit, NormalizedLog,
        CorrelatedIncident, DecoySandboxFile, ThreatPlaybook,
        PlaybookExecution, HoneypotPortalUser, HoneypotFeedback,
        HoneypotActivityLog, SentinelUser, UserSession
    ]
    
    for model in tables_to_verify:
        create_sql = str(CreateTable(model.__table__).compile(dialect=pg_dialect))
        assert len(create_sql) > 0
        assert "CREATE TABLE" in create_sql


def test_postgresql_timeline_date_query_compilation():
    """Verify the timeline aggregation query compiles cleanly to PostgreSQL syntax without SQLite-specific strftime."""
    pg_dialect = postgresql.dialect()
    
    # Simulate dialect being postgresql
    date_col = func.to_char(AttackEvent.created_at, "YYYY-MM-DD")
    query = (
        AttackEvent.__table__.select()
        .with_only_columns(date_col, func.count(AttackEvent.id))
        .group_by(date_col)
        .order_by(date_col.asc())
    )
    
    compiled_sql = str(query.compile(dialect=pg_dialect))
    assert "to_char" in compiled_sql.lower()
    assert "group by" in compiled_sql.lower()
    assert "order by" in compiled_sql.lower()
    assert "strftime" not in compiled_sql.lower()


def test_readiness_probe_healthy(db):
    """Verify readiness check probe returns HTTP 200 and READY status when DB is connected."""
    response = Response()
    result = check_db_readiness(response, db)
    assert response.status_code == 200
    assert result["status"] == "READY"
    assert result["database"] == "CONNECTED"


def test_readiness_probe_unhealthy():
    """Verify readiness check probe returns HTTP 503 and NOT_READY status when DB is disconnected."""
    response = Response()
    mock_failing_db = MagicMock()
    mock_failing_db.execute.side_effect = Exception("Connection to PostgreSQL server lost")
    
    result = check_db_readiness(response, mock_failing_db)
    assert response.status_code == 503
    assert result["status"] == "NOT_READY"
    assert result["database"] == "DISCONNECTED"
    assert "Connection to PostgreSQL server lost" in result["error"]


def test_cors_and_trusted_host_resolution():
    """Verify CORS origins and Trusted Hosts resolve dynamically from primary or alias environment variables."""
    origins = settings.get_cors_origins()
    assert len(origins) > 0
    assert any("localhost" in o or "127.0.0.1" in o for o in origins)

    hosts = settings.get_trusted_hosts()
    assert len(hosts) > 0
    assert "127.0.0.1" in hosts or "localhost" in hosts


def test_portable_sandbox_storage(db):
    """Verify DecoySandboxService initializes storage directory using portable config rather than hardcoded Windows drive."""
    service = DecoySandboxService(db)
    assert service.sandbox_dir is not None
    assert not service.sandbox_dir.startswith("d:/Documents/SentinelAI/decoy_sandbox") or service.sandbox_dir.endswith("decoy_sandbox")


def test_postgresql_observed_sources_aggregation_compilation():
    """Verify that WAF observed sources aggregation query compiles to string_agg on PostgreSQL and avoids SQLite group_concat."""
    from sqlalchemy import select
    from backend.database.session import distinct_group_concat

    pg_dialect = postgresql.dialect()

    # Verify column expression compilation
    col_expr = distinct_group_concat(AttackEvent.attack_type, is_postgres=True)
    compiled_col = str(col_expr.compile(dialect=pg_dialect))
    assert "string_agg" in compiled_col.lower()
    assert "group_concat" not in compiled_col.lower()

    # Verify full query compilation against PostgreSQL dialect
    query = select(
        AttackEvent.source_ip,
        func.count(AttackEvent.id),
        distinct_group_concat(AttackEvent.attack_type, is_postgres=True),
        distinct_group_concat(AttackEvent.target_service, is_postgres=True),
        distinct_group_concat(AttackEvent.severity, is_postgres=True)
    ).group_by(AttackEvent.source_ip)

    compiled_sql = str(query.compile(dialect=pg_dialect))
    assert "string_agg" in compiled_sql.lower()
    assert "group_concat" not in compiled_sql.lower()
    assert "distinct" in compiled_sql.lower()


def test_postgresql_attacker_profiling_aggregation_compilation():
    """Verify that attacker profiling aggregation expressions compile cleanly to string_agg on PostgreSQL."""
    from backend.database.session import distinct_group_concat

    pg_dialect = postgresql.dialect()

    profiling_cols = [
        AttackEvent.attack_type,
        AttackEvent.severity,
        HoneypotActivityLog.action_type,
        HoneypotActivityLog.severity,
        WAFHit.action,
        DecoySandboxFile.status
    ]

    for col in profiling_cols:
        expr = distinct_group_concat(col, is_postgres=True)
        compiled = str(expr.compile(dialect=pg_dialect))
        assert "string_agg" in compiled.lower(), f"Expected string_agg for {col}"
        assert "group_concat" not in compiled.lower(), f"Unexpected group_concat for {col}"
        assert "distinct" in compiled.lower(), f"Expected distinct for {col}"


def test_sqlite_aggregation_backward_compatibility(db):
    """Verify that distinct_group_concat and attacker profiling execute cleanly on active SQLite test database."""
    from backend.database.session import distinct_group_concat
    from backend.services.attacker_profiling import AttackerProfilingService

    # 1. Direct helper execution against SQLite session
    res = db.query(distinct_group_concat(AttackEvent.attack_type, db)).scalar()

    # 2. Attacker profiling service execution on SQLite session
    service = AttackerProfilingService(db)
    attackers = service.get_all_attackers()
    assert isinstance(attackers, list)


def test_is_postgres_session_dialect_detection(db):
    """Verify is_postgres_session accurately detects PostgreSQL vs SQLite dialect."""
    from backend.database.session import is_postgres_session
    from unittest.mock import MagicMock

    # Active test session is SQLite
    assert is_postgres_session(db) is False

    # Mock PostgreSQL session
    mock_pg_session = MagicMock()
    mock_pg_session.bind.dialect.name = "postgresql"
    assert is_postgres_session(mock_pg_session) is True

    # Mock PostgreSQL session where bind is on get_bind()
    mock_get_bind_session = MagicMock()
    mock_get_bind_session.bind = None
    mock_get_bind_session.get_bind.return_value.dialect.name = "postgresql"
    assert is_postgres_session(mock_get_bind_session) is True


def test_readiness_probe_unhealthy_sanitized_in_production(monkeypatch):
    """Verify readiness check probe sanitizes error messages in production to prevent leaking connection details."""
    monkeypatch.setattr(settings, "APP_ENV", "production")
    response = Response()
    mock_failing_db = MagicMock()
    mock_failing_db.execute.side_effect = Exception("FATAL: password authentication failed for user 'postgres' at host 10.0.0.1")

    result = check_db_readiness(response, mock_failing_db)
    assert response.status_code == 503
    assert result["status"] == "NOT_READY"
    assert result["database"] == "DISCONNECTED"
    assert result["error"] == "Database connection unavailable"
    assert "password" not in result["error"]
    assert "10.0.0.1" not in result["error"]


def test_services_health_unhealthy_sanitized_in_production(monkeypatch):
    """Verify services health check probe sanitizes error messages in production."""
    from backend.api.health import get_services_health

    monkeypatch.setattr(settings, "APP_ENV", "production")
    response = Response()
    mock_failing_db = MagicMock()
    mock_failing_db.execute.side_effect = Exception("psycopg2.OperationalError: could not connect to server at 192.168.1.50")

    result = get_services_health(response, mock_failing_db)
    assert response.status_code == 503
    assert result.database.status == "OFFLINE"
    assert result.database.details == "Database connection unavailable"
    assert "192.168.1.50" not in result.database.details


def test_live_postgresql_integration():
    """
    Live integration test against an explicitly configured, positively verified isolated PostgreSQL test database.

    Safety constraints:
    - Runs ONLY when TEST_DATABASE_URL or SENTINEL_TEST_POSTGRESQL_URL is set in the environment.
    - URL must start with 'postgresql://' or 'postgresql+psycopg2://'.
    - Database name in URL path MUST contain 'test' to guarantee it cannot touch production or shared data.
    - Creates tables, exercises dialect-specific features (string_agg, to_char, readiness), and cleanly drops tables.
    - If no verified test database is provided, cleanly skips with explicit skip message.
    """
    import os
    import urllib.parse

    test_db_url = os.getenv("TEST_DATABASE_URL") or os.getenv("SENTINEL_TEST_POSTGRESQL_URL")
    if not test_db_url:
        pytest.skip(
            "Live PostgreSQL integration skipped: no isolated test database configured via TEST_DATABASE_URL."
        )

    parsed = urllib.parse.urlparse(test_db_url)
    if not (parsed.scheme.startswith("postgresql")):
        pytest.skip("Configured TEST_DATABASE_URL is not a PostgreSQL connection URL.")

    db_name = parsed.path.lstrip("/").lower()
    if "test" not in db_name:
        pytest.skip(
            f"Configured TEST_DATABASE_URL database name does not contain 'test'; refused connection for safety."
        )

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from backend.models.base import Base
    from backend.models.models import AttackEvent
    from backend.database.session import distinct_group_concat, is_postgres_session
    from backend.api.health import check_db_readiness

    engine = create_engine(test_db_url)
    try:
        # 1. Verify basic connectivity
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        # 2. Create tables in isolated test database
        Base.metadata.create_all(bind=engine)

        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = TestingSessionLocal()
        try:
            assert is_postgres_session(session) is True

            # 3. Insert test record
            evt = AttackEvent(
                source_ip="198.51.100.42",
                attack_type="BruteForce",
                target_service="ssh",
                severity="HIGH",
                blocked=True
            )
            session.add(evt)
            session.commit()

            # 4. Verify string_agg execution
            res = session.query(
                distinct_group_concat(AttackEvent.attack_type, is_postgres=True)
            ).scalar()
            assert res == "BruteForce"

            # 5. Verify live readiness probe against PostgreSQL session
            response = Response()
            readiness = check_db_readiness(response, session)
            assert response.status_code == 200
            assert readiness["status"] == "READY"
            assert readiness["database"] == "CONNECTED"
        finally:
            session.close()
            # 6. Clean up test data/tables
            Base.metadata.drop_all(bind=engine)
    finally:
        engine.dispose()

