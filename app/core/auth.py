"""
API key authentication — database-backed.
"""
import secrets
import string
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings
from app.core.database import get_db

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


def generate_api_key() -> str:
    alphabet = string.ascii_letters + string.digits
    random_part = ''.join(secrets.choice(alphabet) for _ in range(32))
    return f"{settings.API_KEY_PREFIX}{random_part}"


async def verify_api_key(authorization: str = Security(api_key_header)) -> dict:
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

    conn = get_db()
    row = conn.execute(
        "SELECT * FROM api_keys WHERE key = ? AND is_active = 1", (key,)
    ).fetchone()

    if not row:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key.",
        )

    # Increment request count
    conn.execute(
        "UPDATE api_keys SET request_count = request_count + 1 WHERE key = ?", (key,)
    )
    conn.commit()
    conn.close()

    return {"client": row["client_name"], "email": row["email"], "plan": row["plan"]}
