import json
import numpy as np
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "fraud_model.joblib"
META_PATH  = Path(__file__).parent / "model_meta.json"

try:
    import joblib
    _model = joblib.load(MODEL_PATH)
    with open(META_PATH) as f:
        _meta = json.load(f)
    _ml_ready = True
    print(f"ML model loaded: {_meta['version']} | AUC: {_meta['auc_roc']}")
except Exception as e:
    _model = None
    _meta = {}
    _ml_ready = False
    print(f"ML model not available: {e}")


def load_model():
    return _model, _meta


def extract_features(request) -> list:
    amt   = float(request.amount) or 0
    old_o = float(request.origin_balance_before) or 0
    new_o = float(request.origin_balance_after) or 0
    old_d = float(request.dest_balance_before) or 0
    new_d = float(request.dest_balance_after) or 0
    t_type = str(request.type)
    drain = (old_o - new_o) / old_o if old_o > 0 else 0
    ratio = amt / old_o if old_o > 0 else 999
    return [
        np.log1p(amt),
        np.log1p(old_o),
        drain,
        int(old_o > 0 and new_o == 0),
        int(abs(amt - old_o) < 1),
        int(old_d == 0 and t_type == "TRANSFER"),
        int(old_d == 0 and new_d == 0 and t_type == "TRANSFER"),
        ratio,
        int(t_type == "CASH_OUT"),
        int(amt > 1_000_000),
        int(500_000 <= amt <= 1_000_000),
        1,
    ]


def ml_score(request) -> dict:
    if not _ml_ready or _model is None:
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
    if str(request.type) not in ("TRANSFER", "CASH_OUT"):
        return {"ml_available": False, "ml_score": None, "ml_probability": None}
    try:
        features = extract_features(request)
        prob = _model.predict_proba([features])[0][1]
        score = int(round(prob * 100))
        return {
            "ml_available": True,
            "ml_score": score,
            "ml_probability": round(float(prob), 4),
            "model_version": _meta.get("version", "v2.0.0"),
        }
    except Exception as e:
        print(f"ML scoring error: {e}")
        return {"ml_available": False, "ml_score": None, "ml_probability": None}