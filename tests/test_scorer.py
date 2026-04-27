import pytest
from app.models.schemas import ScoreRequest, TransactionType, RiskLevel, Action
from app.services.scorer import compute_score, get_risk_level, get_action


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


# ── SCORING ───────────────────────────────────────────────────────

def test_low_risk_payment():
    tx = make_tx(type="PAYMENT", amount=100, origin_balance_before=5000, origin_balance_after=4900)
    score, _, _, _ = compute_score(tx)
    assert score < 40

def test_balance_fully_drained():
    tx = make_tx(type="TRANSFER", amount=5000, origin_balance_before=5000, origin_balance_after=0)
    score, signals, _, _ = compute_score(tx)
    assert score >= 40
    assert "balance_fully_drained" in [s.signal for s in signals]

def test_exact_balance_transfer():
    tx = make_tx(type="TRANSFER", amount=5000, origin_balance_before=5000, origin_balance_after=0)
    _, signals, _, _ = compute_score(tx)
    assert "exact_balance_transfer" in [s.signal for s in signals]

def test_large_amount():
    tx = make_tx(amount=1_500_000)
    _, signals, _, _ = compute_score(tx)
    assert "large_amount_over_1m" in [s.signal for s in signals]

def test_cashout_drain():
    tx = make_tx(type="CASH_OUT", amount=3000, origin_balance_before=3000, origin_balance_after=0)
    score, signals, _, _ = compute_score(tx)
    assert score >= 40
    assert "cashout_full_drain" in [s.signal for s in signals]

def test_confidence_sums_to_100():
    tx = make_tx(type="TRANSFER", amount=5000, origin_balance_before=5000, origin_balance_after=0, dest_balance_before=0, dest_balance_after=0)
    _, signals, _, _ = compute_score(tx)
    assert abs(sum(s.contribution for s in signals) - 100) <= 2

def test_reason_is_list_of_strings():
    tx = make_tx(type="TRANSFER", amount=5000, origin_balance_before=5000, origin_balance_after=0)
    _, _, reasons, _ = compute_score(tx)
    assert isinstance(reasons, list)
    assert all(isinstance(r, str) for r in reasons)

def test_confidence_score_range():
    tx = make_tx(type="TRANSFER", amount=5000, origin_balance_before=5000, origin_balance_after=0)
    _, _, _, conf = compute_score(tx)
    assert 0.0 <= conf <= 1.0

def test_em_dash_encoding():
    tx = make_tx(type="TRANSFER", amount=5000, origin_balance_before=5000, origin_balance_after=0)
    _, _, reasons, _ = compute_score(tx)
    for r in reasons:
        assert "â" not in r, f"Encoding issue in reason: {r}"

# ── RISK LEVEL ────────────────────────────────────────────────────

def test_risk_low():       assert get_risk_level(20).value  == "LOW"
def test_risk_medium():    assert get_risk_level(55).value  == "MEDIUM"
def test_risk_high():      assert get_risk_level(75).value  == "HIGH"
def test_risk_critical():  assert get_risk_level(90).value  == "CRITICAL"

# ── ACTION ────────────────────────────────────────────────────────

def test_action_allow():   assert get_action(20).value == "ALLOW"
def test_action_review():  assert get_action(55).value == "REVIEW"
def test_action_block():   assert get_action(90).value == "BLOCK"