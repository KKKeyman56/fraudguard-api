"""
FraudGuard ML Scoring Engine v2.0.0
XGBoost model trained on AIML PaySim 6.3M transactions.

AUC-ROC: 0.9995 | Precision: 0.9425 | Recall: 0.9970 | F1: 0.9689
"""
import os
import json
import numpy as np
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "fraud_model.json"
META_PATH  = Path(__file__).parent / "model_meta.json"

# Load model at startup
_model = None
_meta  = None

def load_model():
    global _model, _meta
    if _model is None:
        try:
            import joblib
            _model = joblib.load(MODEL_PATH)
            with open(META_PATH) as f:
                _meta = json.load(f)
            print(f"ML model loaded: {_meta['version']} | AUC: {_meta['auc_roc']}")
        except Exception as e:
            print(f"ML model not available: {e}")
            _model = None
    return _model, _meta


def extract_features(request) -> list:
    """Extract ML features from a ScoreRequest."""
    amt    = float(request.amount) or 0
    old_o  = float(request.origin_balance_before) or 0
    new_o  = float(request.origin_balance_after) or 0
    old_d  = float(request.dest_balance_before) or 0
    new_d  = float(request.dest_balance_after) or 0
    t_type = str(request.type)

    drain = (old_o - new_o) / old_o if old_o > 0 else 0
    ratio = amt / old_o if old_o > 0 else 999

    return [
        np.log1p(amt),                                      # amount_log
        np.log1p(old_o),                                    # orig_balance_log
        drain,                                              # balance_drain_pct
        int(old_o > 0 and new_o == 0),                      # is_balance_drained
        int(abs(amt - old_o) < 1),                          # is_exact_transfer
        int(old_d == 0 and t_type == "TRANSFER"),            # dest_had_zero_balance
        int(old_d == 0 and new_d == 0 and t_type == "TRANSFER"),  # dest_balance_unchanged
        ratio,                                              # amount_to_balance_ratio
        int(t_type == "CASH_OUT"),                          # type_encoded
        int(amt > 1_000_000),                               # is_large_amount
        int(500_000 <= amt <= 1_000_000),                   # is_medium_amount
        1,                                                  # step (default 1)
    ]


def ml_score(request) -> dict:
    """
    Score a transaction using the XGBoost model.
    Returns dict with ml_score (0-100), ml_probability, ml_available.
    """
    model, meta = load_model()

    if model is None:
        return {"ml_available": False, "ml_score": None, "ml_probability": None}

    # Only score TRANSFER and CASH_OUT (model trained on these)
    if str(request.type) not in ("TRANSFER", "CASH_OUT"):
        return {"ml_available": False, "ml_score": None, "ml_probability": None}

    try:
        features = extract_features(request)
        prob = model.predict_proba([features])[0][1]
        score = int(round(prob * 100))
        return {
            "ml_available": True,
            "ml_score": score,
            "ml_probability": round(float(prob), 4),
            "model_version": meta["version"],
        }
    except Exception as e:
        print(f"ML scoring error: {e}")
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
