import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from app.core.database import query_one, execute
from app.core.auth import generate_api_key, verify_api_key
from app.core.rate_limit import PLAN_LIMITS

router = APIRouter()
USE_POSTGRES = bool(os.getenv("DATABASE_URL"))
PH = "%s" if USE_POSTGRES else "?"


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
    requests_today: int
    daily_limit: int
    remaining_today: int
    is_active: bool


@router.post("/keys/request", response_model=KeyResponse, summary="Request a new API key", tags=["API Keys"])
async def request_api_key(body: KeyRequest):
    existing = query_one(f"SELECT key, is_active FROM api_keys WHERE email = {PH}", (body.email,))
    if existing:
        if existing["is_active"]:
            raise HTTPException(status_code=409, detail=f"API key already exists for {body.email}.")
        else:
            raise HTTPException(status_code=403, detail="This email's API key has been deactivated.")

    new_key = generate_api_key()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    execute(
        f"INSERT INTO api_keys (key, email, client_name, plan, created_at) VALUES ({PH},{PH},{PH},'free',{PH})",
        (new_key, body.email, body.client_name, now)
    )

    return KeyResponse(
        api_key=new_key, email=body.email, client_name=body.client_name,
        plan="free", created_at=now,
        message="API key created. Save it - it won't be shown again.",
    )


@router.get("/keys/me", response_model=KeyInfo, summary="Get your API key info + daily usage", tags=["API Keys"])
async def get_key_info(client: dict = Depends(verify_api_key)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    row = query_one(f"SELECT * FROM api_keys WHERE email = {PH}", (client["email"],))
    usage = query_one(
        f"SELECT request_count FROM daily_usage WHERE api_key = {PH} AND usage_date = {PH}",
        (client["api_key"], today)
    )

    requests_today = usage["request_count"] if usage else 0
    limit = PLAN_LIMITS.get(row["plan"], 1000)

    return KeyInfo(
        email=row["email"],
        client_name=row["client_name"],
        plan=row["plan"],
        created_at=row["created_at"],
        request_count=row["request_count"],
        requests_today=requests_today,
        daily_limit=limit,
        remaining_today=max(0, limit - requests_today),
        is_active=bool(row["is_active"]),
    )