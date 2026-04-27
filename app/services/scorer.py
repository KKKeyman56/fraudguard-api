"""
FraudGuard Scoring Engine
Rule-based fraud detection with weighted signal normalization.
Each rule contributes a weight; active rules are normalized to 100%.
"""
from app.models.schemas import ScoreRequest, SignalDetail, Verdict, Action


# ── SIGNAL DEFINITIONS ────────────────────────────────────────────
# Each signal: name, raw_weight (0-100), condition function
SIGNALS = [
    {
        "name": "balance_fully_drained",
        "weight": 38,
        "description": "Origin balance wiped to zero",
        "check": lambda r: (
            r.origin_balance_before > 0
            and r.origin_balance_after == 0
            and r.type in ("TRANSFER", "CASH_OUT")
        ),
    },
    {
        "name": "dest_balance_unchanged",
        "weight": 28,
        "description": "Destination received nothing (money mule pattern)",
        "check": lambda r: (
            r.dest_balance_before == 0
            and r.dest_balance_after == 0
            and r.type == "TRANSFER"
        ),
    },
    {
        "name": "exact_balance_transfer",
        "weight": 25,
        "description": "Amount exactly equals origin balance",
        "check": lambda r: (
            abs(r.amount - r.origin_balance_before) < 1
            and r.type in ("TRANSFER", "CASH_OUT")
        ),
    },
    {
        "name": "cashout_full_drain",
        "weight": 22,
        "description": "CASH_OUT drains account completely",
        "check": lambda r: (
            r.type == "CASH_OUT"
            and r.origin_balance_before > 0
            and r.origin_balance_after == 0
        ),
    },
    {
        "name": "large_amount_over_1m",
        "weight": 20,
        "description": "Transaction amount exceeds $1M",
        "check": lambda r: r.amount > 1_000_000,
    },
    {
        "name": "large_amount_500k_1m",
        "weight": 12,
        "description": "Transaction amount $500K–$1M",
        "check": lambda r: 500_000 <= r.amount <= 1_000_000,
    },
    {
        "name": "dest_had_zero_balance",
        "weight": 10,
        "description": "Destination account had zero balance before",
        "check": lambda r: (
            r.dest_balance_before == 0
            and r.type == "TRANSFER"
        ),
    },
    {
        "name": "normal_payment_pattern",
        "weight": 6,
        "description": "Normal payment — low-risk baseline",
        "check": lambda r: r.type == "PAYMENT",
    },
]


# ── THRESHOLDS ────────────────────────────────────────────────────
SCORE_CRITICAL = 70
SCORE_WARNING  = 40
SCORE_AUTO_BLOCK = 85


def compute_score(request: ScoreRequest) -> tuple[int, list[SignalDetail]]:
    """
    Compute a fraud risk score (0–100) for a transaction.
    Returns (score, list of active signals with contributions).
    """
    # Collect active signals
    active = [s for s in SIGNALS if s["check"](request)]

    # Remove low-risk baseline if any high-weight signals are active
    high_weight_active = [s for s in active if s["weight"] >= 10]
    if not high_weight_active:
        # Only low-risk signals active — definitely safe
        return 8, [SignalDetail(signal=active[0]["name"], weight=active[0]["weight"], contribution=100)] if active else []

    # Drop the baseline/normal signals when real signals exist
    active = high_weight_active

    total_weight = sum(s["weight"] for s in active)

    # Base score: weighted sum normalized to 100
    raw_score = sum(
        (s["weight"] / total_weight) * 100
        for s in active
    )

    # Apply multiplier for stacked high-weight signals
    critical_signals = [s for s in active if s["weight"] >= 22]
    if len(critical_signals) >= 2:
        raw_score = min(raw_score * 1.15, 99)

    score = max(1, min(99, int(raw_score)))

    # Build signal detail list (normalized contributions)
    signals = [
        SignalDetail(
            signal=s["name"],
            weight=s["weight"],
            contribution=round((s["weight"] / total_weight) * 100),
        )
        for s in active
    ]
    signals.sort(key=lambda x: x.weight, reverse=True)

    return score, signals


def get_verdict(score: int) -> tuple[Verdict, Action]:
    if score >= SCORE_CRITICAL:
        verdict = Verdict.CRITICAL
        action = Action.BLOCK if score >= SCORE_AUTO_BLOCK else Action.REVIEW
    elif score >= SCORE_WARNING:
        verdict = Verdict.WARNING
        action = Action.REVIEW
    else:
        verdict = Verdict.SAFE
        action = Action.ALLOW
    return verdict, action
