import json
import numpy as np
import pandas as pd
import xgboost as xgb
from pathlib import Path
from functools import lru_cache

MODEL_PATH = Path(__file__).parent / "fraud_model.json"
META_PATH  = Path(__file__).parent / "model_meta.json"

FEATURES = [
    'amount_log', 'orig_balance_log', 'balance_drain_pct', 'is_balance_drained',
    'is_exact_transfer', 'dest_had_zero_balance', 'dest_balance_unchanged',
    'amount_to_balance_ratio', 'type_encoded', 'is_large_amount', 'is_medium_amount', 'step'
]


@lru_cache(maxsize=1)
def get_model():
    try:
        booster = xgb.Booster()
        booster.load_model(str(MODEL_PATH))
        with open(META_PATH) as f:
            meta = json.load(f)
        print(f"ML model loaded: {meta['version']} | AUC: {meta['auc_roc']}")
        return booster, meta
    except Exception as e:
        print(f"ML model not available: {type(e).__name__}: {e}")
        return None, {}


def load_model():
    return get_model()


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
        int(old_d == 0 and t == "TRANSFER"),
        int(old_d == 0 and new_d == 0 and t == "TRANSFER"),
        ratio,
        int(t == "CASH_OUT"),
        int(amt > 1_000_000),
        int(500_000 <= amt <= 1_000_000),
        1,
    ]
    return pd.DataFrame([values], columns=FEATURES)


def ml_score(request) -> dict:
    if str(request.type) not in ("TRANSFER", "CASH_OUT"):
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
    booster, meta = get_model()
    if booster is None:
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
    try:
        df = extract_features(request)
        dmat = xgb.DMatrix(df)
        prob = float(booster.predict(dmat)[0])
        return {
            "ml_available": True,
            "ml_score": int(round(prob * 100)),
            "ml_probability": round(prob, 4),
            "model_version": meta.get("version", "v2.0.0"),
        }
    except Exception as e:
        print(f"ML scoring error: {e}")
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
