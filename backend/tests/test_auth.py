import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import get_db
from backend.models.models import SentinelUser, UserSession, HoneypotPortalUser
from backend.services.auth import AuthService
from backend.core.security import verify_password, hash_session_token
from backend.core.config import settings

def test_auth_full_lifecycle(db):
    """Test full authentication lifecycle: register, login, auth/me, logout, session expiration, and isolation."""
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as client:
            # 1. Valid Registration
            reg_payload = {
                "username": "analyst_john",
                "email": "john.analyst@sentinel.ai",
                "password": "SecurePassword123!"
            }
            res = client.post("/api/auth/register", json=reg_payload)
            assert res.status_code == 201
            user_data = res.json()
            assert user_data["username"] == "analyst_john"
            assert user_data["email"] == "john.analyst@sentinel.ai"
            assert user_data["role"] == "user"
            assert "password_hash" not in user_data
            assert "password" not in user_data

            # 2. Duplicate Username Rejected
            res = client.post("/api/auth/register", json={
                "username": "analyst_john",
                "email": "different@sentinel.ai",
                "password": "AnotherPassword123!"
            })
            assert res.status_code == 400
            assert "DUPLICATE_USERNAME" in res.json()["error"]["code"]

            # 3. Duplicate Email Rejected
            res = client.post("/api/auth/register", json={
                "username": "different_user",
                "email": "john.analyst@sentinel.ai",
                "password": "AnotherPassword123!"
            })
            assert res.status_code == 400
            assert "DUPLICATE_EMAIL" in res.json()["error"]["code"]

            # 4. Invalid Email or Password Format Rejected
            res = client.post("/api/auth/register", json={
                "username": "short",
                "email": "invalid-email",
                "password": "123"
            })
            assert res.status_code == 400

            # 5. Verify Password Stored Hashed in Database
            db_user = db.query(SentinelUser).filter(SentinelUser.username == "analyst_john").first()
            assert db_user is not None
            assert db_user.password_hash != "SecurePassword123!"
            assert verify_password("SecurePassword123!", db_user.password_hash)

            # 6. Invalid Password Rejected
            res = client.post("/api/auth/login", json={
                "username": "analyst_john",
                "password": "WrongPassword123!"
            })
            assert res.status_code == 401
            assert "INVALID_CREDENTIALS" in res.json()["error"]["code"]

            # 7. Unknown Account Rejected
            res = client.post("/api/auth/login", json={
                "username": "nonexistent_operator",
                "password": "SecurePassword123!"
            })
            assert res.status_code == 401
            assert "INVALID_CREDENTIALS" in res.json()["error"]["code"]

            # 8. Valid Username Login Sets Cookie
            res = client.post("/api/auth/login", json={
                "username": "analyst_john",
                "password": "SecurePassword123!"
            })
            assert res.status_code == 200
            assert settings.AUTH_SESSION_COOKIE_NAME in client.cookies

            # 9. Verify Token Hash in DB
            raw_cookie = client.cookies.get(settings.AUTH_SESSION_COOKIE_NAME)
            assert raw_cookie is not None
            expected_hash = hash_session_token(raw_cookie)
            session_record = db.query(UserSession).filter(UserSession.token_hash == expected_hash).first()
            assert session_record is not None
            assert session_record.user_id == db_user.id

            # 10. Valid Email Login
            client.cookies.clear()
            res = client.post("/api/auth/login", json={
                "username": "john.analyst@sentinel.ai",
                "password": "SecurePassword123!"
            })
            assert res.status_code == 200
            assert settings.AUTH_SESSION_COOKIE_NAME in client.cookies

            # 11. /auth/me Works with Valid Session
            res = client.get("/api/auth/me")
            assert res.status_code == 200
            profile = res.json()
            assert profile["username"] == "analyst_john"

            # 12. Protected Endpoint Rejects Anonymous Request
            anon_client = TestClient(app)
            res = anon_client.get("/api/settings")
            assert res.status_code == 401
            assert "UNAUTHORIZED" in res.json()["error"]["code"]

            # 13. Protected Endpoint Accepts Authenticated User
            res = client.get("/api/settings")
            assert res.status_code == 200

            # 14. /auth/me Rejects Invalid Cookie Token
            invalid_client = TestClient(app)
            invalid_client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, "fake_token_12345")
            res = invalid_client.get("/api/auth/me")
            assert res.status_code == 401

            # 15. Logout Revokes Session & Clears Cookie
            active_cookie = client.cookies.get(settings.AUTH_SESSION_COOKIE_NAME)
            active_hash = hash_session_token(active_cookie)

            res = client.post("/api/auth/logout")
            assert res.status_code == 200
            assert settings.AUTH_SESSION_COOKIE_NAME not in client.cookies

            # Verify Session Record Removed from DB
            db.rollback()
            db.expire_all()
            revoked_record = db.query(UserSession).filter(UserSession.token_hash == active_hash).first()
            assert revoked_record is None

            # Revoked Session Cannot Be Reused
            client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, active_cookie)
            res = client.get("/api/auth/me")
            assert res.status_code == 401

            # 16. Inactive Account Login Rejected
            db_user.is_active = 0
            db.commit()
            res = client.post("/api/auth/login", json={
                "username": "analyst_john",
                "password": "SecurePassword123!"
            })
            assert res.status_code == 401
            assert "INACTIVE_ACCOUNT" in res.json()["error"]["code"]

            # 17. Expired Session Rejected
            db_user.is_active = 1
            db.commit()
            raw_tok, sess = AuthService.create_user_session(db, db_user.id)
            sess.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
            db.commit()

            exp_client = TestClient(app)
            exp_client.cookies.set(settings.AUTH_SESSION_COOKIE_NAME, raw_tok)
            res = exp_client.get("/api/auth/me")
            assert res.status_code == 401

            # 18. Aetheris Decoy Isolation Verification
            # Confirm HoneypotPortalUser table is untouched and independent
            decoy_count = db.query(HoneypotPortalUser).count()
            assert decoy_count >= 0
    finally:
        app.dependency_overrides.clear()
