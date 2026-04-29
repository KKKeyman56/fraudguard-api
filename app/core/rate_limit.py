"""
Rate limiting per API key.
Tracks daily request count in the database.
Resets at midnight UTC.
"""
import os
from datetime import datetime, timezone
from fastapi import HTTPException
from app.core.database import query_one, execute

USE_POSTGRES = bool(os.getenv("DATABASE_URL"))
PH = "%s" if USE_POSTGRES else "?"

# Plan limits
PLAN_LIMITS = {
    "free": 1000,
    "pro":  100000,
    "enterprise": 99999999,
}

def get_today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def check_rate_limit(api_key: str, plan: str = "free"):
    """
    Check if API key has exceeded daily limit.
    Raises 429 if limit exceeded.
    """
    limit = PLAN_LIMITS.get(plan, 1000)
    today = get_today()

    # Get or create today's usage record
    row = query_one(
        f"SELECT * FROM daily_usage WHERE api_key = {PH} AND usage_date = {PH}",
        (api_key, today)
    )

    if not row:
        # First request today
        execute(
            f"INSERT INTO daily_usage (api_key, usage_date, request_count) VALUES ({PH}, {PH}, 1)",
            (api_key, today)
        )
        return {"requests_today": 1, "limit": limit, "remaining": limit - 1}

    count = row["request_count"]

    if count >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "limit": limit,
                "requests_today": count,
                "reset": "midnight UTC",
                "upgrade": "Contact us to upgrade to Pro (100K req/day)"
            }
        )

    # Increment counter
    execute(
        f"UPDATE daily_usage SET request_count = request_count + 1 WHERE api_key = {PH} AND usage_date = {PH}",
        (api_key, today)
    )

    return {"requests_today": count + 1, "limit": limit, "remaining": limit - count - 1}
