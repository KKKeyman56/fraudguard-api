from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import score, keys

app = FastAPI(
    title="FraudGuard API",
    description="""
## Real-time fraud detection for fintech

Stop fraud before it drains your users' money. Send a transaction → get a risk score in **⚡ < 15ms**.

### Quick start

**Step 1 — Get your API key (free):**
```bash
curl -X POST https://web-production-cdea4.up.railway.app/v1/keys/request \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@startup.com", "client_name": "MyStartup"}'
```

**Step 2 — Score a transaction:**
```bash
curl -X POST https://web-production-cdea4.up.railway.app/v1/score \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"transaction_id":"tx_001","amount":1250000,"type":"TRANSFER","origin_account":"C1234567890","dest_account":"C9876543210","origin_balance_before":1250000,"origin_balance_after":0}'
```

### Risk levels
| Score | Risk Level | Action |
|-------|-----------|--------|
| 0–39 | `LOW` | `ALLOW` |
| 40–69 | `MEDIUM` | `REVIEW` |
| 70–84 | `HIGH` | `REVIEW` |
| 85–99 | `CRITICAL` | `BLOCK` |
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

@app.on_event("startup")
async def startup():
    init_db()
    from app.services.ml_scorer import load_model
    load_model()

app.include_router(score.router, prefix="/v1", tags=["Scoring"])
app.include_router(keys.router, prefix="/v1", tags=["API Keys"])

@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": "FraudGuard API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "running",
    }
