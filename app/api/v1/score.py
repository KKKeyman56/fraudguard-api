import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response
from app.models.schemas import ScoreRequest, ScoreResponse, ErrorResponse, RiskLevel
from app.services.scorer import compute_score, get_risk_level, get_action, ENGINE_VERSION
from app.core.auth import verify_api_key
from app.core.rate_limit import check_rate_limit

router = APIRouter()


@router.post(
    "/score",
    response_model=ScoreResponse,
    summary="Score a transaction",
    description="""
Submit a transaction and receive a fraud risk score in **⚡ < 15ms**.

**Rate limits:**
| Plan | Limit |
|------|-------|
| `free` | 1,000 req / day |
| `pro` | 100,000 req / day |

**Demo key:** `Bearer fg_live_demo_key_001`
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or missing API key"},
        429: {"description": "Rate limit exceeded"},
        422: {"description": "Validation error"},
    },
)
async def score_transaction(
    request: ScoreRequest,
    response: Response,
    client: dict = Depends(verify_api_key),
):
    usage = check_rate_limit(client.get("api_key", ""), client.get("plan", "free"))

    t0 = time.perf_counter()
    score, signals, reasons, confidence_score = compute_score(request)
    risk_level = get_risk_level(score)
    action = get_action(score)
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    response.headers["X-RateLimit-Limit"] = str(usage["limit"])
    response.headers["X-RateLimit-Remaining"] = str(usage["remaining"])
    response.headers["X-RateLimit-Reset"] = "midnight UTC"

    return ScoreResponse(
        transaction_id=request.transaction_id,
        idempotency_key=request.idempotency_key or None,
        risk_score=score,
        risk_level=risk_level,
        action=action,
        confidence_score=confidence_score,
        reason=reasons,
        confidence=signals,
        is_suspicious=risk_level in (RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL),
        timestamp=datetime.now(timezone.utc),
        engine_version=ENGINE_VERSION,
        latency_ms=latency_ms,
    )


@router.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok", "service": "fraudguard-api", "engine_version": ENGINE_VERSION}