from app.models.schemas import ScoreRequest, SignalDetail, Verdict, Action


SIGNALS = [
    {
        "name": "balance_fully_drained",
        "reason": "balance fully drained",
        "weight": 38,
        "check": lambda r: (
            r.origin_balance_before > 0
            and r.origin_balance_after == 0
            and r.type in ("TRANSFER", "CASH_OUT")
        ),
    },
    {
        "name": "dest_balance_unchanged",
        "reason": "destination balance unchanged (money mule pattern)",
        "weight": 28,
        "check": lambda r: (
            r.dest_balance_before == 0
            and r.dest_balance_after == 0
            and r.type == "TRANSFER"
        ),
    },
    {
        "name": "exact_balance_transfer",
        "reason": "exact transfer match — amount equals full balance",
        "weight": 25,
        "check": lambda r: (
            abs(r.amount - r.origin_balance_before) < 1
            and r.type in ("TRANSFER", "CASH_OUT")
        ),
    },
    {
        "name": "cashout_full_drain",
        "reason": "CASH_OUT drains account completely",
        "weight": 22,
        "check": lambda r: (
            r.type == "CASH_OUT"
            and r.origin_balance_before > 0
            and r.origin_balance_after == 0
        ),
    },
    {
        "name": "large_amount_over_1m",
        "reason": "large amount anomaly — exceeds $1M threshold",
        "weight": 20,
        "check": lambda r: r.amount > 1_000_000,
    },
    {
        "name": "large_amount_500k_1m",
        "reason": "elevated amount — $500K to $1M range",
        "weight": 12,
        "check": lambda r: 500_000 <= r.amount <= 1_000_000,
    },
    {
        "name": "dest_had_zero_balance",
        "reason": "destination account had zero balance",
        "weight": 10,
        "check": lambda r: (
            r.dest_balance_before == 0
            and r.type == "TRANSFER"
        ),
    },
    {
        "name": "normal_payment_pattern",
        "reason": "normal payment pattern — low risk",
        "weight": 6,
        "check": lambda r: r.type == "PAYMENT",
    },
]

SCORE_CRITICAL   = 70
SCORE_WARNING    = 40
SCORE_AUTO_BLOCK = 85


def compute_score(request: ScoreRequest) -> tuple[int, list[SignalDetail], list[str]]:
    active = [s for s in SIGNALS if s["check"](request)]

    high_weight = [s for s in active if s["weight"] >= 10]
    if not high_weight:
        low = active[0] if active else None
        signal_list = [SignalDetail(signal=low["name"], weight=low["weight"], contribution=100)] if low else []
        reason_list = [low["reason"]] if low else ["no suspicious signals detected"]
        return 8, signal_list, reason_list

    active = high_weight
    total_weight = sum(s["weight"] for s in active)
    raw_score = sum((s["weight"] / total_weight) * 100 for s in active)

    if len([s for s in active if s["weight"] >= 22]) >= 2:
        raw_score = min(raw_score * 1.15, 99)

    score = max(1, min(99, int(raw_score)))

    signals = [
        SignalDetail(
            signal=s["name"],
            weight=s["weight"],
            contribution=round((s["weight"] / total_weight) * 100),
        )
        for s in active
    ]
    signals.sort(key=lambda x: x.weight, reverse=True)

    reasons = [s["reason"] for s in sorted(active, key=lambda x: x["weight"], reverse=True)[:5]]

    return score, signals, reasons


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