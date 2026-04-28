import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.models.schemas import ScoreRequest, ScoreResponse, ErrorResponse, RiskLevel
from app.services.scorer import compute_score, get_risk_level, get_action, ENGINE_VERSION
from app.core.auth import verify_api_key

router = APIRouter()


@router.post(
    "/score",
    response_model=ScoreResponse,
    summary="Score a transaction",
    description="""
Submit a financial transaction and receive a fraud risk score in **⚡ < 15ms**.

**What you get back:**
- `risk_score` — 0 to 100
- `risk_level` — LOW / MEDIUM / HIGH / CRITICAL
- `action` — ALLOW / REVIEW / BLOCK
- `confidence_score` — overall system confidence 0.0–1.0
- `reason` — human-readable list of triggered fraud signals
- `confidence` — per-signal breakdown with weight + contribution %
- `is_suspicious` — true if risk_level is MEDIUM or above
- `timestamp` — UTC time this score was computed
- `engine_version` — scoring model version (use for audit trails)
- `idempotency_key` — echoed back only if provided in request

> **Note on latency:** `latency_ms` reflects local rule-based inference time.
> End-to-end network latency depends on client location and is typically 20–80ms.

**Example response:**
```json
{
  "transaction_id": "tx_001",
  "risk_score": 99,
  "risk_level": "CRITICAL",
  "action": "BLOCK",
  "confidence_score": 0.99,
  "reason": [
    "balance fully drained",
    "destination balance unchanged (money mule pattern)",
    "exact transfer match - amount equals full balance",
    "large amount anomaly - exceeds $1M threshold",
    "destination account previously had zero balance"
  ],
  "is_suspicious": true,
  "timestamp": "2026-04-27T13:55:00Z",
  "engine_version": "v1.2.0",
  "latency_ms": 0.07
}
```

**Risk levels:**
| Score | Risk Level | Action | Meaning |
|-------|-----------|--------|---------|
| 0–39 | `LOW` | `ALLOW` | Normal transaction |
| 40–69 | `MEDIUM` | `REVIEW` | Suspicious — flag for review |
| 70–84 | `HIGH` | `REVIEW` | High probability fraud |
| 85–99 | `CRITICAL` | `BLOCK` | Auto-block — immediate threat |

**Demo key:** `Bearer fg_live_demo_key_001`
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or missing API key"},
        422: {"description": "Validation error"},
    },
)
async def score_transaction(
    request: ScoreRequest,
    client: dict = Depends(verify_api_key),
):
    t0 = time.perf_counter()

    score, signals, reasons, confidence_score = compute_score(request)
    risk_level = get_risk_level(score)
    action = get_action(score)

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

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
    return {
        "status": "ok",
        "service": "fraudguard-api",
        "engine_version": ENGINE_VERSION,
    }