from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, HTTPException
import os

_redis_url = os.getenv("REDIS_URL")
_storage_uri = f"redis://{_redis_url}" if _redis_url and not _redis_url.startswith("redis") else (_redis_url or "memory://")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri,
    default_limits=["100/minute"],
)


def setup_rate_limiting(app):
    """Configure rate limiting for FastAPI app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded."""
    raise HTTPException(status_code=429, detail="Rate limit exceeded")


# Endpoint-specific decorators
def auth_limits():
    """Strict limits for authentication endpoints."""
    return limiter.limit("5/minute")


def upload_limits():
    """Limits for file uploads."""
    return limiter.limit("10/minute")


def search_limits():
    """Limits for search endpoints."""
    return limiter.limit("30/minute")
