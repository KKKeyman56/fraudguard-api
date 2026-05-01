import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response
from app.models.schemas import ScoreRequest, ScoreResponse, ErrorResponse, RiskLevel
from app.services.scorer import compute_score, get_risk_level, get_action, ENGINE_VERSION
from app.services.ml_scorer import ml_score
from app.core.auth import verify_api_key
from app.core.rate_limit import check_rate_limit

router = APIRouter()
ENGINE_VERSION_FULL = "v2.0.0-hybrid"


@router.post("/score", response_model=ScoreResponse, summary="Score a transaction")
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

    ml_result = ml_score(request)
    print(f"ML result: {ml_result}")

    if ml_result["ml_available"] and ml_result["ml_score"] is not None:
        ml_s = ml_result["ml_score"]
        blended = int(round(score * 0.4 + ml_s * 0.6))
        final_score = max(1, min(99, blended))
        risk_level = get_risk_level(final_score)
        action = get_action(final_score)
    else:
        final_score = score

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    response.headers["X-RateLimit-Limit"] = str(usage["limit"])
    response.headers["X-RateLimit-Remaining"] = str(usage["remaining"])
    response.headers["X-RateLimit-Reset"] = "midnight UTC"

    return ScoreResponse(
        transaction_id=request.transaction_id,
        idempotency_key=request.idempotency_key or None,
        risk_score=final_score,
        risk_level=risk_level,
        action=action,
        confidence_score=confidence_score,
        reason=reasons,
        confidence=signals,
        is_suspicious=risk_level in (RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL),
        ml_score=ml_result.get("ml_score"),
        ml_probability=ml_result.get("ml_probability"),
        ml_available=ml_result.get("ml_available", False),
        timestamp=datetime.now(timezone.utc),
        engine_version=ENGINE_VERSION_FULL,
        latency_ms=latency_ms,
    )


@router.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok", "service": "fraudguard-api", "engine_version": ENGINE_VERSION_FULL}
