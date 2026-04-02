from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
import os
import secrets
import logging

_logger = logging.getLogger(__name__)

_default_key = "your-secret-key-change-in-production-min-32-chars-long"
SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == _default_key:
    SECRET_KEY = secrets.token_urlsafe(48)
    _logger.warning(
        "SECRET_KEY not set — generated ephemeral key. Sessions will NOT survive restarts. Set SECRET_KEY env var in production."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        return username
    except JWTError:
        return None


def create_document_token(user_id: int, doc_id: int, expires_seconds: int = 60) -> str:
    """Create a short-lived JWT scoped to a single document."""
    expire = datetime.now(timezone.utc) + timedelta(seconds=expires_seconds)
    payload = {
        "sub": str(user_id),
        "purpose": "document_access",
        "doc_id": doc_id,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_document_token(token: str, expected_doc_id: int):
    """Decode an ephemeral document token. Returns user_id if valid, None otherwise."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "document_access":
            return None
        if payload.get("doc_id") != expected_doc_id:
            return None
        user_id = payload.get("sub")
        return int(user_id) if user_id else None
    except Exception:
        return None
