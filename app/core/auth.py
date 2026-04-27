"""
Simple API key authentication.
MVP: keys stored in memory/env.
Production: store in PostgreSQL with per-key rate limits + usage tracking.
"""
import secrets
import string
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

# MVP: hardcoded demo keys — replace with DB lookup in production
# Format: "Bearer fg_live_xxxx"
VALID_KEYS = {
    "fg_live_demo_key_001": {"client": "demo", "plan": "free"},
    "fg_live_test_key_002": {"client": "test", "plan": "pro"},
}


def generate_api_key() -> str:
    """Generate a new API key."""
    alphabet = string.ascii_letters + string.digits
    random_part = ''.join(secrets.choice(alphabet) for _ in range(32))
    return f"{settings.API_KEY_PREFIX}{random_part}"


async def verify_api_key(authorization: str = Security(api_key_header)) -> dict:
    """
    Verify API key from Authorization header.
    Expects: 'Bearer fg_live_xxxx'
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Use: 'Bearer YOUR_API_KEY'",
        )

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid format. Use: 'Bearer YOUR_API_KEY'",
        )

    key = parts[1]
    if key not in VALID_KEYS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )

    return VALID_KEYS[key]
