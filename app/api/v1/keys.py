"""
API Key management endpoints.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr, Field
from app.core.database import get_db
from app.core.auth import generate_api_key, verify_api_key
from datetime import datetime

router = APIRouter()


# ── REQUEST/RESPONSE MODELS ───────────────────────────────────────
class KeyRequest(BaseModel):
    email: str = Field(..., example="you@startup.com")
    client_name: str = Field(..., example="MyStartup", min_length=2, max_length=60)


class KeyResponse(BaseModel):
    api_key: str
    email: str
    client_name: str
    plan: str
    created_at: str
    message: str


class KeyInfo(BaseModel):
    email: str
    client_name: str
    plan: str
    created_at: str
    request_count: int
    is_active: bool


# ── ENDPOINTS ─────────────────────────────────────────────────────
@router.post(
    "/keys/request",
    response_model=KeyResponse,
    summary="Request a new API key",
    description="""
Generate a new API key for your application.

**Free plan includes:**
- 1,000 requests/day
- Full access to `/v1/score`
- Real-time risk scoring

**Save your API key** — it won't be shown again.

```json
{
  "email": "you@startup.com",
  "client_name": "MyStartup"
}
```
    """,
    tags=["API Keys"],
)
async def request_api_key(body: KeyRequest):
    conn = get_db()

    # Check if email already has a key
    existing = conn.execute(
        "SELECT key, is_active FROM api_keys WHERE email = ?", (body.email,)
    ).fetchone()

    if existing:
        conn.close()
        if existing["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An API key already exists for {body.email}. Use GET /v1/keys/lookup to retrieve it.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This email's API key has been deactivated. Contact support.",
            )

    new_key = generate_api_key()
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    conn.execute(
        "INSERT INTO api_keys (key, email, client_name, plan, created_at) VALUES (?, ?, ?, 'free', ?)",
        (new_key, body.email, body.client_name, now),
    )
    conn.commit()
    conn.close()

    return KeyResponse(
        api_key=new_key,
        email=body.email,
        client_name=body.client_name,
        plan="free",
        created_at=now,
        message="API key created. Save it — it won't be shown again.",
    )


@router.get(
    "/keys/me",
    response_model=KeyInfo,
    summary="Get your API key info",
    description="Returns usage stats and info for the authenticated API key.",
    tags=["API Keys"],
)
async def get_key_info(client: dict = Depends(verify_api_key)):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM api_keys WHERE email = ?", (client["email"],)
    ).fetchone()
    conn.close()

    return KeyInfo(
        email=row["email"],
        client_name=row["client_name"],
        plan=row["plan"],
        created_at=row["created_at"],
        request_count=row["request_count"],
        is_active=bool(row["is_active"]),
    )
