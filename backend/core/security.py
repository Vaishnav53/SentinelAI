import secrets
import hashlib
from passlib.context import CryptContext

# Password hashing context with Argon2id and bcrypt fallback
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a plaintext password securely."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored password hash."""
    return pwd_context.verify(plain_password, hashed_password)

def generate_session_token() -> str:
    """Generate a cryptographically secure random session token."""
    return secrets.token_urlsafe(32)

def hash_session_token(token: str) -> str:
    """Compute a SHA-256 digest of a session token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
