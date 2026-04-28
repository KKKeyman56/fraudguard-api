from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime


class TransactionType(str, Enum):
    TRANSFER = "TRANSFER"
    CASH_OUT = "CASH_OUT"
    PAYMENT  = "PAYMENT"
    DEBIT    = "DEBIT"
    CASH_IN  = "CASH_IN"


class RiskLevel(str, Enum):
    LOW      = "LOW"
    MEDIUM   = "MEDIUM"
    HIGH     = "HIGH"
    CRITICAL = "CRITICAL"


class Action(str, Enum):
    ALLOW  = "ALLOW"
    REVIEW = "REVIEW"
    BLOCK  = "BLOCK"


# ── REQUEST ───────────────────────────────────────────────────────
class ScoreRequest(BaseModel):
    transaction_id: str   = Field(..., example="tx_001")
    idempotency_key: Optional[str] = Field(
        None,
        example="txn_001_retry_1",
        description="Optional. Provide to safely retry without double-processing."
    )
    amount: float         = Field(..., gt=0, example=1250000)
    type: TransactionType = Field(..., example="TRANSFER")
    origin_account: str   = Field(..., example="C1234567890")
    dest_account: str     = Field(..., example="C9876543210")
    origin_balance_before: float         = Field(..., ge=0, example=1250000)
    origin_balance_after: float          = Field(..., ge=0, example=0)
    dest_balance_before: Optional[float] = Field(0, ge=0, example=0)
    dest_balance_after: Optional[float]  = Field(0, ge=0, example=0)


# ── RESPONSE ──────────────────────────────────────────────────────
class SignalDetail(BaseModel):
    signal: str
    weight: int
    contribution: int

class ScoreResponse(BaseModel):
    transaction_id: str
    idempotency_key: Optional[str] = Field(
        None,
        description="Echoed back only if provided in request."
    )
    risk_score: int       = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    action: Action
    confidence_score: float
    reason: list[str]
    confidence: list[SignalDetail]
    is_suspicious: bool
    timestamp: datetime   = Field(..., description="UTC timestamp of when this score was computed.")
    engine_version: str   = Field(..., description="Scoring engine version. Use this to track model changes.")
    latency_ms: float     = Field(..., description="Inference latency in milliseconds (local rule-based engine).")

    class Config:
        json_encoders = {datetime: lambda v: v.strftime("%Y-%m-%dT%H:%M:%SZ")}

class ErrorResponse(BaseModel):
    error: str
    detail: str