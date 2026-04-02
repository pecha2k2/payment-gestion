"""Validate required environment variables on startup."""

import os
import sys


REQUIRED_PRODUCTION_VARS = [
    "SECRET_KEY",
    "ADMIN_PASSWORD",
]

OPTIONAL_VARS_WITH_DEFAULTS = {
    "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/payment_gestion",
    "ALLOWED_ORIGINS": "",
    "REDIS_URL": "",
    "MAX_FILE_SIZE_MB": "50",
    "RATE_LIMIT_ENABLED": "true",
}


def validate_environment():
    """Validate environment and set defaults."""
    errors = []
    warnings = []

    # Check if running in production mode
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"

    if is_production:
        for var in REQUIRED_PRODUCTION_VARS:
            if not os.getenv(var):
                errors.append(f"{var} is required in production")

    # Set defaults for optional vars
    for var, default in OPTIONAL_VARS_WITH_DEFAULTS.items():
        if not os.getenv(var):
            os.environ[var] = default
            warnings.append(f"{var} not set, using default")

    # Validate specific values
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
    if is_production and (not allowed_origins or allowed_origins == "*"):
        errors.append("ALLOWED_ORIGINS must be explicitly set (not '*') in production")

    # Check ADMIN_PASSWORD is not default in production
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    if is_production and admin_password in ["admin123", "password", "123456"]:
        errors.append("ADMIN_PASSWORD must not be a common default in production")

    # Log warnings
    for warning in warnings:
        print(f"[ENV WARNING] {warning}", file=sys.stderr)

    # Exit on errors
    if errors:
        for error in errors:
            print(f"[ENV ERROR] {error}", file=sys.stderr)
        sys.exit(1)


def get_config():
    """Get validated configuration."""
    return {
        "database_url": os.getenv("DATABASE_URL"),
        "secret_key": os.getenv("SECRET_KEY"),
        "admin_password": os.getenv("ADMIN_PASSWORD"),
        "allowed_origins": [
            o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
        ],
        "redis_url": os.getenv("REDIS_URL"),
        "max_file_size": int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024,
        "rate_limit_enabled": os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true",
    }
