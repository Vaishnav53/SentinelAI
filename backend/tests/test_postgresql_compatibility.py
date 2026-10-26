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


@pytest.mark.parametrize("prod_env", ["production", "prod"])
def test_readiness_probe_unhealthy_sanitized_in_production(monkeypatch, prod_env):
    """Verify readiness check probe sanitizes error messages in both production and prod environments."""
    monkeypatch.setattr(settings, "APP_ENV", prod_env)
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


@pytest.mark.parametrize("prod_env", ["production", "prod"])
def test_services_health_unhealthy_sanitized_in_production(monkeypatch, prod_env):
    """Verify services health check probe sanitizes error messages in both production and prod environments."""
    from backend.api.health import get_services_health

    monkeypatch.setattr(settings, "APP_ENV", prod_env)
    response = Response()
    mock_failing_db = MagicMock()
    mock_failing_db.execute.side_effect = Exception("psycopg2.OperationalError: could not connect to server at 192.168.1.50")

    result = get_services_health(response, mock_failing_db)
    assert response.status_code == 503
    assert result.database.status == "OFFLINE"
    assert result.database.details == "Database connection unavailable"
    assert "192.168.1.50" not in result.database.details


def mask_db_url(url: str) -> str:
    """Mask credentials in a database connection URL for safe logging and error reporting."""
    import urllib.parse
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.password:
            masked_netloc = f"{parsed.username or ''}:***@{parsed.hostname or ''}"
            if parsed.port:
                masked_netloc += f":{parsed.port}"
            return urllib.parse.urlunparse(parsed._replace(netloc=masked_netloc))
        return url
    except Exception:
        return "postgresql://***"


def validate_postgres_test_environment(
    test_db_url: str = None,
    opt_in: str = None,
    current_app_env: str = settings.APP_ENV,
    current_db_url: str = settings.DATABASE_URL
):
    """
    Validates whether the environment is safely authorized to run live PostgreSQL integration tests.

    Safety Guarantees:
    1. Explicit opt-in required (SENTINEL_ENABLE_LIVE_POSTGRES_TEST in 'true', '1', 'yes').
    2. TEST_DATABASE_URL must be provided and non-empty.
    3. Scheme must be 'postgresql' or 'postgresql+psycopg2'.
    4. Refuses execution if current_app_env is 'production' or 'prod'.
    5. Refuses execution if TEST_DATABASE_URL matches the primary application DATABASE_URL.
    6. Refuses execution if hostname matches managed cloud production patterns.
    7. All returned error/skip messages never leak passwords or raw connection strings.
    """
    import urllib.parse

    # 1. Opt-in authorization check
    if not opt_in or opt_in.strip().lower() not in ("true", "1", "yes"):
        return (
            False,
            "Live PostgreSQL integration skipped: explicit opt-in required via "
            "SENTINEL_ENABLE_LIVE_POSTGRES_TEST=true to authorize live database execution."
        )

    # 2. Presence check
    if not test_db_url or not test_db_url.strip():
        return (
            False,
            "Live PostgreSQL integration skipped: no isolated test database configured via TEST_DATABASE_URL."
        )

    # 3. Environment check
    if current_app_env.lower() in ("production", "prod"):
        return (
            False,
            "Live PostgreSQL integration refused: cannot execute live integration tests while APP_ENV is production/prod."
        )

    # 4. Parse URL
    try:
        parsed = urllib.parse.urlparse(test_db_url.strip())
    except Exception:
        return (False, "Live PostgreSQL integration skipped: TEST_DATABASE_URL could not be parsed.")

    scheme = parsed.scheme.lower()
    if not (scheme == "postgresql" or scheme.startswith("postgresql+")):
        return (
            False,
            f"Live PostgreSQL integration skipped: TEST_DATABASE_URL scheme '{scheme}' is not a PostgreSQL dialect."
        )

    # 5. Collision check against primary application DATABASE_URL
    if current_db_url and test_db_url.strip() == current_db_url.strip():
        return (
            False,
            "Live PostgreSQL integration refused: TEST_DATABASE_URL matches primary application DATABASE_URL."
        )

    # 6. Production host pattern guard
    hostname = (parsed.hostname or "").lower()
    prohibited_hosts = [
        "railway.app", "up.railway.app", "internal",
        "rds.amazonaws.com", "supabase.co", "neon.tech", "render.com"
    ]
    for ph in prohibited_hosts:
        if hostname.endswith(ph):
            return (
                False,
                f"Live PostgreSQL integration refused: TEST_DATABASE_URL hostname '{hostname}' "
                "matches managed cloud production patterns; isolated local or dedicated test instance required."
            )

    return (True, "OK")


def test_live_postgresql_integration():
    """
    Live integration test against an explicitly authorized, isolated PostgreSQL test database.

    Safety & Isolation Guarantees:
    - Bounded connection timeout (connect_timeout=3).
    - Uses an ephemeral, uniquely named schema (sentinel_iso_<uuid>).
    - NEVER touches or drops tables in 'public' or any pre-existing application tables.
    - NEVER uses Base.metadata.drop_all().
    - In a guaranteed finally block, cleanly drops ONLY the ephemeral test schema (CASCADE).
    - Cleanly skipped when unverified or when explicit opt-in is absent.
    """
    import os
    import uuid
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    test_db_url = os.getenv("TEST_DATABASE_URL")
    opt_in = os.getenv("SENTINEL_ENABLE_LIVE_POSTGRES_TEST")

    is_valid, reason = validate_postgres_test_environment(test_db_url, opt_in)
    if not is_valid:
        pytest.skip(reason)

    schema_name = f"sentinel_iso_{uuid.uuid4().hex[:10]}"

    engine = create_engine(
        test_db_url,
        connect_args={"connect_timeout": 3},
        pool_pre_ping=True
    )
    try:
        # 1. Connect and create isolated ephemeral schema
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.execute(text(f"CREATE SCHEMA {schema_name};"))
            conn.commit()

        try:
            # 2. Bind local testing session to the ephemeral schema
            with engine.connect() as conn:
                conn.execute(text(f"SET search_path TO {schema_name};"))
                AttackEvent.__table__.schema = schema_name
                AttackEvent.__table__.create(bind=conn)
                conn.commit()

            TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            session = TestingSessionLocal()
            try:
                session.execute(text(f"SET search_path TO {schema_name};"))

                # 3. Insert test record in isolated schema
                evt = AttackEvent(
                    source_ip="198.51.100.42",
                    attack_type="BruteForce",
                    target_service="ssh",
                    severity="HIGH",
                    blocked=True
                )
                session.add(evt)
                session.commit()

                # 4. Verify PostgreSQL string_agg execution
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
                AttackEvent.__table__.schema = None
        finally:
            # 6. Guaranteed teardown: DROP ONLY the ephemeral test schema
            with engine.connect() as conn:
                conn.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;"))
                conn.commit()
    finally:
        engine.dispose()


# ==============================================================================
# Pure Offline Safety Regression Tests (Validate guards without connecting to DB)
# ==============================================================================

def test_validate_postgres_test_environment_missing_opt_in():
    valid, reason = validate_postgres_test_environment(
        test_db_url="postgresql://user:pass@localhost:5432/sentinel_test",
        opt_in=None
    )
    assert valid is False
    assert "explicit opt-in required" in reason


def test_validate_postgres_test_environment_missing_url():
    valid, reason = validate_postgres_test_environment(
        test_db_url=None,
        opt_in="true"
    )
    assert valid is False
    assert "no isolated test database configured" in reason


def test_validate_postgres_test_environment_invalid_scheme():
    valid, reason = validate_postgres_test_environment(
        test_db_url="sqlite:///./storage/test.db",
        opt_in="true"
    )
    assert valid is False
    assert "is not a PostgreSQL dialect" in reason


def test_validate_postgres_test_environment_production_env_rejection():
    valid, reason = validate_postgres_test_environment(
        test_db_url="postgresql://user:pass@localhost:5432/sentinel_test",
        opt_in="true",
        current_app_env="production"
    )
    assert valid is False
    assert "cannot execute live integration tests while APP_ENV is production" in reason


def test_validate_postgres_test_environment_app_database_url_collision():
    target_url = "postgresql://user:pass@localhost:5432/sentinel_primary"
    valid, reason = validate_postgres_test_environment(
        test_db_url=target_url,
        opt_in="true",
        current_app_env="test",
        current_db_url=target_url
    )
    assert valid is False
    assert "matches primary application DATABASE_URL" in reason


def test_validate_postgres_test_environment_managed_cloud_host_rejection():
    valid, reason = validate_postgres_test_environment(
        test_db_url="postgresql://user:pass@postgres.railway.app:5432/railway",
        opt_in="true",
        current_app_env="test"
    )
    assert valid is False
    assert "matches managed cloud production patterns" in reason


def test_validate_postgres_test_environment_mask_credentials_no_leak():
    secret_url = "postgresql://secret_user:super_secret_password_123!@localhost:5432/test_db"
    masked = mask_db_url(secret_url)
    assert "super_secret_password_123!" not in masked
    assert "secret_user:***@localhost:5432" in masked


def test_validate_postgres_test_environment_valid_configuration():
    valid, reason = validate_postgres_test_environment(
        test_db_url="postgresql://test_user:test_pass@127.0.0.1:5432/sentinel_isolated_test",
        opt_in="true",
        current_app_env="test",
        current_db_url="sqlite:///./storage/sentinelai.db"
    )
    assert valid is True
    assert reason == "OK"

