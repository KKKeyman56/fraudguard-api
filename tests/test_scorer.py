import pytest
from app.models.schemas import ScoreRequest, TransactionType
from app.services.scorer import compute_score, get_verdict


def make_tx(**kwargs) -> ScoreRequest:
    defaults = dict(
        transaction_id="tx_test",
        amount=1000,
        type=TransactionType.PAYMENT,
        origin_account="C111",
        dest_account="C222",
        origin_balance_before=5000,
        origin_balance_after=4000,
        dest_balance_before=0,
        dest_balance_after=0,
    )
    defaults.update(kwargs)
    return ScoreRequest(**defaults)


# ── SCORING TESTS ─────────────────────────────────────────────────

def test_low_risk_payment():
    tx = make_tx(type="PAYMENT", amount=100, origin_balance_before=5000, origin_balance_after=4900)
    score, signals = compute_score(tx)
    assert score < 40, f"Expected low score, got {score}"


def test_balance_fully_drained_transfer():
    tx = make_tx(
        type="TRANSFER",
        amount=5000,
        origin_balance_before=5000,
        origin_balance_after=0,
    )
    score, signals = compute_score(tx)
    assert score >= 40, f"Expected high score for drained balance, got {score}"
    signal_names = [s.signal for s in signals]
    assert "balance_fully_drained" in signal_names


def test_exact_balance_transfer():
    tx = make_tx(
        type="TRANSFER",
        amount=5000,
        origin_balance_before=5000,
        origin_balance_after=0,
    )
    score, signals = compute_score(tx)
    signal_names = [s.signal for s in signals]
    assert "exact_balance_transfer" in signal_names


def test_large_amount_over_1m():
    tx = make_tx(amount=1_500_000)
    score, signals = compute_score(tx)
    signal_names = [s.signal for s in signals]
    assert "large_amount_over_1m" in signal_names


def test_cashout_full_drain():
    tx = make_tx(
        type="CASH_OUT",
        amount=3000,
        origin_balance_before=3000,
        origin_balance_after=0,
    )
    score, signals = compute_score(tx)
    assert score >= 40
    signal_names = [s.signal for s in signals]
    assert "cashout_full_drain" in signal_names


def test_confidence_sums_to_100():
    tx = make_tx(
        type="TRANSFER",
        amount=5000,
        origin_balance_before=5000,
        origin_balance_after=0,
        dest_balance_before=0,
        dest_balance_after=0,
    )
    _, signals = compute_score(tx)
    total = sum(s.contribution for s in signals)
    # Allow ±2 rounding error
    assert abs(total - 100) <= 2, f"Contributions sum to {total}, expected ~100"


# ── VERDICT TESTS ─────────────────────────────────────────────────

def test_verdict_safe():
    verdict, action = get_verdict(20)
    assert verdict.value == "SAFE"
    assert action.value == "ALLOW"

def test_verdict_warning():
    verdict, action = get_verdict(55)
    assert verdict.value == "WARNING"
    assert action.value == "REVIEW"

def test_verdict_critical_review():
    verdict, action = get_verdict(75)
    assert verdict.value == "CRITICAL"
    assert action.value == "REVIEW"

def test_verdict_critical_block():
    verdict, action = get_verdict(90)
    assert verdict.value == "CRITICAL"
    assert action.value == "BLOCK"
