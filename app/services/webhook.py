"""
FraudGuard Webhook Service
Sends real-time alerts to client URLs when fraud is detected.
"""
import json
import httpx
from datetime import datetime, timezone
from app.core.database import query_one, query_all


async def fire_webhook(api_key: str, score_data: dict):
    """
    Fire webhook if client has registered a URL and risk level matches.
    Non-blocking — errors are logged but don't affect the main response.
    """
    risk_level = score_data.get("risk_level", "LOW")

    # Only fire for HIGH and CRITICAL
    if risk_level not in ("HIGH", "CRITICAL"):
        return

    # Get webhook config for this API key
    webhook = query_one(
        "SELECT * FROM webhooks WHERE api_key = %s AND is_active = 1"
        if _is_postgres() else
        "SELECT * FROM webhooks WHERE api_key = ? AND is_active = 1",
        (api_key,)
    )

    if not webhook:
        return

    # Check if this event type is in the webhook's event list
    events = webhook.get("events", "CRITICAL,HIGH").split(",")
    if risk_level not in events:
        return

    # Build payload
    payload = {
        "event": "fraud.detected",
        "risk_level": risk_level,
        "risk_score": score_data.get("risk_score"),
        "action": score_data.get("action"),
        "transaction_id": score_data.get("transaction_id"),
        "ml_score": score_data.get("ml_score"),
        "ml_probability": score_data.get("ml_probability"),
        "reason": score_data.get("reason", []),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "engine_version": score_data.get("engine_version"),
    }

    # Fire webhook async
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                webhook["url"],
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-FraudGuard-Event": "fraud.detected",
                    "X-FraudGuard-Version": "v2.0.0",
                }
            )
            print(f"Webhook fired: {webhook['url']} → {resp.status_code}")
    except Exception as e:
        print(f"Webhook error ({webhook['url']}): {e}")


def _is_postgres():
    import os
    return bool(os.getenv("DATABASE_URL"))
