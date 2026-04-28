import os
import secrets
import string
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from app.core.config import settings
from app.core.database import query_one, execute

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)
USE_POSTGRES = bool(os.getenv("DATABASE_URL"))
PH = "%s" if USE_POSTGRES else "?"


def generate_api_key() -> str:
    alphabet = string.ascii_letters + string.digits
    random_part = ''.join(secrets.choice(alphabet) for _ in range(32))
    return f"{settings.API_KEY_PREFIX}{random_part}"


async def verify_api_key(authorization: str = Security(api_key_header)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header. Use: 'Bearer YOUR_API_KEY'")
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid format. Use: 'Bearer YOUR_API_KEY'")
    key = parts[1]

    row = query_one(f"SELECT * FROM api_keys WHERE key = {PH} AND is_active = 1", (key,))
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key.")

    execute(f"UPDATE api_keys SET request_count = request_count + 1 WHERE key = {PH}", (key,))
    return {"client": row["client_name"], "email": row["email"], "plan": row["plan"]}