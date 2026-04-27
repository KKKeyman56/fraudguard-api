from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


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
    idempotency_key: Optional[str] = Field(None, example="idem_tx_001_1714200000",
        description="Optional unique key to safely retry requests without double-processing.")
    amount: float         = Field(..., gt=0, example=1250000)
    type: TransactionType = Field(..., example="TRANSFER")
    origin_account: str   = Field(..., example="C1234567890")
    dest_account: str     = Field(..., example="C9876543210")
    origin_balance_before: float        = Field(..., ge=0, example=1250000)
    origin_balance_after: float         = Field(..., ge=0, example=0)
    dest_balance_before: Optional[float] = Field(0, ge=0, example=0)
    dest_balance_after: Optional[float]  = Field(0, ge=0, example=0)


# ── RESPONSE ──────────────────────────────────────────────────────
class SignalDetail(BaseModel):
    signal: str
    weight: int
    contribution: int   # normalized % contribution to final score

class ScoreResponse(BaseModel):
    transaction_id: str
    idempotency_key: Optional[str]      # echoed back if provided
    risk_score: int     = Field(..., ge=0, le=100)
    risk_level: RiskLevel               # LOW / MEDIUM / HIGH / CRITICAL
    action: Action                      # ALLOW / REVIEW / BLOCK
    confidence_score: float = Field(..., description="Overall system confidence 0.0–1.0")
    reason: list[str]                   # human-readable fraud signals
    confidence: list[SignalDetail]      # per-signal breakdown
    is_suspicious: bool                 # true if risk_level >= MEDIUM
    latency_ms: float

class ErrorResponse(BaseModel):
    error: str
    detail: str