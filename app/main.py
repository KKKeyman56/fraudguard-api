from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import score

app = FastAPI(
    title="FraudGuard API",
    description="""
## Real-time fraud detection for fintech

Send a transaction → get a risk score in **⚡ < 15ms**.

---

### ⚡ Performance
| Metric | Value |
|--------|-------|
| **Avg latency** | **< 15ms** |
| **P99 latency** | < 50ms |
| **Uptime SLA** | 99.9% |
| **Coverage** | 100% of transactions |

---

### Quick start
```bash
curl -X POST https://web-production-cdea4.up.railway.app/v1/score \\
  -H "Authorization: Bearer fg_live_demo_key_001" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_id": "tx_001",
    "amount": 1250000,
    "type": "TRANSFER",
    "origin_account": "C1234567890",
    "dest_account": "C9876543210",
    "origin_balance_before": 1250000,
    "origin_balance_after": 0,
    "dest_balance_before": 0,
    "dest_balance_after": 0
  }'
```

### Expected response
```json
{
  "transaction_id": "tx_001",
  "risk_score": 99,
  "verdict": "CRITICAL",
  "action": "BLOCK",
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

### Risk levels
| Score | Verdict | Action | Meaning |
|-------|---------|--------|---------|
| 0–39 | `SAFE` | `ALLOW` | Normal transaction |
| 40–69 | `WARNING` | `REVIEW` | Suspicious — flag for review |
| 70–84 | `CRITICAL` | `REVIEW` | High probability fraud |
| 85–99 | `CRITICAL` | `BLOCK` | Auto-block — immediate threat |

### Auth
All endpoints require an API key in the `Authorization` header:
> **Demo key:** `fg_live_demo_key_001` — free to use for testing
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(score.router, prefix="/v1", tags=["Scoring"])

@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": "FraudGuard API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "running",
    }