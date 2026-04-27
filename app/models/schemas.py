from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


class TransactionType(str, Enum):
    TRANSFER = "TRANSFER"
    CASH_OUT = "CASH_OUT"
    PAYMENT = "PAYMENT"
    DEBIT = "DEBIT"
    CASH_IN = "CASH_IN"


class Verdict(str, Enum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class Action(str, Enum):
    ALLOW = "ALLOW"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


# REQUEST
class ScoreRequest(BaseModel):
    transaction_id: str = Field(..., example="tx_001")
    amount: float = Field(..., gt=0, example=1250000)
    type: TransactionType = Field(..., example="TRANSFER")
    origin_account: str = Field(..., example="C1234567890")
    dest_account: str = Field(..., example="C9876543210")
    origin_balance_before: float = Field(..., ge=0, example=1250000)
    origin_balance_after: float = Field(..., ge=0, example=0)
    dest_balance_before: Optional[float] = Field(0, ge=0, example=0)
    dest_balance_after: Optional[float] = Field(0, ge=0, example=0)


# RESPONSE
class SignalDetail(BaseModel):
    signal: str
    weight: int
    contribution: int

class ScoreResponse(BaseModel):
    transaction_id: str
    risk_score: int = Field(..., ge=0, le=100)
    verdict: Verdict
    action: Action
    reason: list[str]
    confidence: list[SignalDetail]
    latency_ms: float
    flagged: bool

class ErrorResponse(BaseModel):
    error: str
    detail: str