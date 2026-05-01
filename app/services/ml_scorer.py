import json
import numpy as np
import pandas as pd
import xgboost as xgb
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "fraud_model.json"
META_PATH  = Path(__file__).parent / "model_meta.json"

FEATURES = [
    'amount_log', 'orig_balance_log', 'balance_drain_pct', 'is_balance_drained',
    'is_exact_transfer', 'dest_had_zero_balance', 'dest_balance_unchanged',
    'amount_to_balance_ratio', 'type_encoded', 'is_large_amount', 'is_medium_amount', 'step'
]

_booster = None
_meta = {}
_ml_ready = False

try:
    _booster = xgb.Booster()
    _booster.load_model(str(MODEL_PATH))
    with open(META_PATH) as f:
        _meta = json.load(f)
    _ml_ready = True
    print(f"ML model loaded: {_meta['version']} | AUC: {_meta['auc_roc']}")
except Exception as e:
    print(f"ML model not available: {type(e).__name__}: {e}")


def load_model():
    return _booster, _meta


def extract_features(request):
    amt   = float(request.amount) or 0
    old_o = float(request.origin_balance_before) or 0
    new_o = float(request.origin_balance_after) or 0
    old_d = float(request.dest_balance_before) or 0
    new_d = float(request.dest_balance_after) or 0
    t     = str(request.type)
    drain = (old_o - new_o) / old_o if old_o > 0 else 0
    ratio = amt / old_o if old_o > 0 else 999
    values = [
        np.log1p(amt), np.log1p(old_o), drain,
        int(old_o > 0 and new_o == 0),
        int(abs(amt - old_o) < 1),
        int("TRANSFER" in t),
        int("TRANSFER" in t and old_d == 0 and new_d == 0),
        ratio,
        int("CASH_OUT" in t),
        int(amt > 1_000_000),
        int(500_000 <= amt <= 1_000_000),
        1,
    ]
    return pd.DataFrame([values], columns=FEATURES)


def ml_score(request) -> dict:
    if not _ml_ready or _booster is None:
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
    req_type = str(request.type)
    if "TRANSFER" not in req_type and "CASH_OUT" not in req_type:
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
    try:
        df = extract_features(request)
        dmat = xgb.DMatrix(df)
        prob = float(_booster.predict(dmat)[0])
        return {
            "ml_available": True,
            "ml_score": int(round(prob * 100)),
            "ml_probability": round(prob, 4),
            "model_version": _meta.get("version", "v2.0.0"),
        }
    except Exception as e:
        print(f"ML scoring error: {e}")
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
