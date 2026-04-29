import time
from fastapi import APIRouter, Depends
from app.models.schemas import ScoreRequest, ScoreResponse, ErrorResponse
from app.services.scorer import compute_score, get_verdict
from app.core.auth import verify_api_key

router = APIRouter()


@router.post(
    "/score",
    response_model=ScoreResponse,
    summary="Score a transaction",
    description="""
Submit a financial transaction → receive a fraud risk score in **⚡ < 15ms**.

**What you get back:**
- `risk_score` — 0 to 100
- `verdict` — SAFE / WARNING / CRITICAL
- `action` — ALLOW / REVIEW / BLOCK
- `confidence` — every signal that fired, with weight + contribution %
- `latency_ms` — actual processing time

**Risk levels:**
| Score | Verdict | Action |
|-------|---------|--------|
| 0–39 | `SAFE` | `ALLOW` |
| 40–69 | `WARNING` | `REVIEW` |
| 70–84 | `CRITICAL` | `REVIEW` |
| 85–99 | `CRITICAL` | `BLOCK` |

**Demo key:** `Bearer fg_live_demo_key_001`
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or missing API key"},
        422: {"description": "Validation error — check request body"},
    },
)
async def score_transaction(
    request: ScoreRequest,
    client: dict = Depends(verify_api_key),
):
    t0 = time.perf_counter()

    score, signals = compute_score(request)
    verdict, action = get_verdict(score)

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return ScoreResponse(
        transaction_id=request.transaction_id,
        risk_score=score,
        verdict=verdict,
        action=action,
        confidence=signals,
        latency_ms=latency_ms,
        flagged=score >= 40,
    )


@router.get(
    "/health",
    summary="Health check",
    include_in_schema=False,
)
async def health():
    return {"status": "ok", "service": "fraudguard-api"}
