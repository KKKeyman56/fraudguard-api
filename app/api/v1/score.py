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
- `reason` — human-readable list of why this was flagged
- `confidence` — every signal that fired, with weight + contribution %
- `latency_ms` — actual processing time

**Fraud scenario example response:**
```json
{
  "transaction_id": "tx_001",
  "risk_score": 99,
  "verdict": "CRITICAL",
  "action": "BLOCK",
  "reason": [
    "balance fully drained",
    "destination balance unchanged (money mule pattern)",
    "exact transfer match — amount equals full balance",
    "large amount anomaly — exceeds $1M threshold"
  ],
  "confidence": [
    { "signal": "balance_fully_drained",  "weight": 38, "contribution": 31 },
    { "signal": "dest_balance_unchanged", "weight": 28, "contribution": 23 },
    { "signal": "exact_balance_transfer", "weight": 25, "contribution": 21 },
    { "signal": "large_amount_over_1m",   "weight": 20, "contribution": 17 }
  ],
  "latency_ms": 0.07,
  "flagged": true
}
```

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
        422: {"description": "Validation error"},
    },
)
async def score_transaction(
    request: ScoreRequest,
    client: dict = Depends(verify_api_key),
):
    t0 = time.perf_counter()

    score, signals, reasons = compute_score(request)
    verdict, action = get_verdict(score)

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return ScoreResponse(
        transaction_id=request.transaction_id,
        risk_score=score,
        verdict=verdict,
        action=action,
        reason=reasons,
        confidence=signals,
        latency_ms=latency_ms,
        flagged=score >= 40,
    )


@router.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok", "service": "fraudguard-api"}