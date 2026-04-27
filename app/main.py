from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import score

app = FastAPI(
    title="FraudGuard API",
    description="""
## Real-time fraud detection for fintech

Send a transaction → get a risk score in <15ms.

### Quick start
```bash
curl -X POST https://api.fraudguard.io/v1/score \\
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

### Auth
All endpoints require an API key in the `Authorization` header:
```
Authorization: Bearer fg_live_YOUR_KEY_HERE
```
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow all origins for MVP, restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(score.router, prefix="/v1", tags=["Scoring"])


@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": "FraudGuard API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "running",
    }
