"""
Webhook management endpoints.
"""
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from app.core.database import query_one, execute
from app.core.auth import verify_api_key

router = APIRouter()
USE_POSTGRES = bool(os.getenv("DATABASE_URL"))
PH = "%s" if USE_POSTGRES else "?"


class WebhookCreate(BaseModel):
    url: str = Field(..., example="https://your-app.com/webhooks/fraud")
    events: str = Field("CRITICAL,HIGH", example="CRITICAL,HIGH")


class WebhookResponse(BaseModel):
    api_key: str
    url: str
    events: str
    is_active: bool
    created_at: str
    message: str


@router.post(
    "/webhooks",
    response_model=WebhookResponse,
    summary="Register a webhook URL",
    description="""
Register a URL to receive real-time fraud alerts.

FraudGuard will POST to your URL when a transaction is scored HIGH or CRITICAL.

**Payload example:**
```json
{
  "event": "fraud.detected",
  "risk_level": "CRITICAL",
  "risk_score": 98,
  "action": "BLOCK",
  "transaction_id": "tx_001",
  "ml_score": 97,
  "ml_probability": 0.9656,
  "reason": ["balance fully drained", "exact transfer match"],
  "timestamp": "2026-05-01T09:00:00Z",
  "engine_version": "v2.0.0-hybrid"
}
```

**Available events:** `CRITICAL`, `HIGH`

> Note: Webhook delivery is best-effort with a 5s timeout. Your endpoint should return 2xx quickly.
    """,
    tags=["Webhooks"],
)
async def register_webhook(body: WebhookCreate, client: dict = Depends(verify_api_key)):
    api_key = client.get("api_key")

    # Upsert webhook
    existing = query_one(f"SELECT id FROM webhooks WHERE api_key = {PH}", (api_key,))

    if existing:
        execute(
            f"UPDATE webhooks SET url = {PH}, events = {PH}, is_active = 1 WHERE api_key = {PH}",
            (body.url, body.events, api_key)
        )
        msg = "Webhook updated."
    else:
        execute(
            f"INSERT INTO webhooks (api_key, url, events) VALUES ({PH}, {PH}, {PH})",
            (api_key, body.url, body.events)
        )
        msg = "Webhook registered."

    row = query_one(f"SELECT * FROM webhooks WHERE api_key = {PH}", (api_key,))

    return WebhookResponse(
        api_key=api_key,
        url=row["url"],
        events=row["events"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
        message=msg,
    )


@router.get(
    "/webhooks",
    summary="Get your webhook config",
    tags=["Webhooks"],
)
async def get_webhook(client: dict = Depends(verify_api_key)):
    api_key = client.get("api_key")
    row = query_one(f"SELECT * FROM webhooks WHERE api_key = {PH}", (api_key,))
    if not row:
        raise HTTPException(status_code=404, detail="No webhook registered.")
    return {
        "url": row["url"],
        "events": row["events"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
    }


@router.delete(
    "/webhooks",
    summary="Delete your webhook",
    tags=["Webhooks"],
)
async def delete_webhook(client: dict = Depends(verify_api_key)):
    api_key = client.get("api_key")
    execute(f"UPDATE webhooks SET is_active = 0 WHERE api_key = {PH}", (api_key,))
    return {"message": "Webhook deactivated."}
