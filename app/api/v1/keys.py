import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from app.core.database import query_one, execute
from app.core.auth import generate_api_key, verify_api_key
from datetime import datetime

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
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    execute(
        f"INSERT INTO api_keys (key, email, client_name, plan, created_at) VALUES ({PH},{PH},{PH},'free',{PH})",
        (new_key, body.email, body.client_name, now)
    )

    return KeyResponse(
        api_key=new_key, email=body.email, client_name=body.client_name,
        plan="free", created_at=now,
        message="API key created. Save it - it won't be shown again.",
    )


@router.get("/keys/me", response_model=KeyInfo, summary="Get your API key info", tags=["API Keys"])
async def get_key_info(client: dict = Depends(verify_api_key)):
    row = query_one(f"SELECT * FROM api_keys WHERE email = {PH}", (client["email"],))
    return KeyInfo(
        email=row["email"], client_name=row["client_name"], plan=row["plan"],
        created_at=row["created_at"], request_count=row["request_count"],
        is_active=bool(row["is_active"]),
    )