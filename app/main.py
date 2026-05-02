from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import score, keys, webhooks

app = FastAPI(
    title="FraudGuard API",
    description="Real-time fraud detection for fintech. AI-powered hybrid engine v2.0.0.",
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
app.include_router(webhooks.router, prefix="/v1", tags=["Webhooks"])

@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": "FraudGuard API",
        "version": settings.APP_VERSION,
        "engine": "v2.0.0-hybrid",
        "docs": "/docs",
        "status": "running",
    }
