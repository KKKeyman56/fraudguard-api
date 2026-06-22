"""
macro_score.py
==============
FUNGSI: Macro / directional scoring untuk menentukan BIAS arah (long/short/flat)
sebelum bot membuka posisi — meniru lapisan "macro scoring" di gcr_bot, tapi
sumber datanya harga on-chain WETH/USDC di Base.

Output: MacroResult{score in [-1,+1], confidence in [0,1], direction, signals[]}.
  score  > 0  -> bias LONG
  score  < 0  -> bias SHORT
  |score| kecil / confidence rendah -> FLAT (jangan entry).

Sinyal default (semua dinormalisasi ke [-1,+1] via tanh, lalu di-weight):
  - trend       : (SMA cepat - SMA lambat) / SMA lambat
  - momentum    : rate-of-change N periode
  - mean_revert : -z-score harga thd SMA lambat (lawan trend, weight kecil)
  - vol regime  : TIDAK menambah arah; dipakai menurunkan confidence saat volatil

PriceHistory (SQLite) menampung deret harga dari tiap polling supaya scorer punya
data. Untuk produksi sebaiknya di-seed dari sumber candle (OHLC) eksternal;
di sini sengaja pluggable: MacroScorer.score() cukup menerima list harga.
"""

from __future__ import annotations

import math
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

from config import settings


# --------------------------------------------------------------------------- #
#  Penyimpan deret harga (opsional, untuk bot loop)
# --------------------------------------------------------------------------- #
class PriceHistory:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.db_path
        with sqlite3.connect(self.db_path) as c:
            c.execute(
                """CREATE TABLE IF NOT EXISTS price_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL, network TEXT, price REAL NOT NULL)"""
            )
            c.commit()

    def add(self, price: float):
        with sqlite3.connect(self.db_path) as c:
            c.execute(
                "INSERT INTO price_history (ts, network, price) VALUES (?,?,?)",
                (datetime.now(timezone.utc).isoformat(), settings.network, price),
            )
            c.commit()

    def last(self, n: int) -> List[float]:
        with sqlite3.connect(self.db_path) as c:
            rows = c.execute(
                "SELECT price FROM price_history ORDER BY id DESC LIMIT ?", (n,)
            ).fetchall()
        return [r[0] for r in reversed(rows)]


# --------------------------------------------------------------------------- #
#  Scoring
# --------------------------------------------------------------------------- #
@dataclass
class Signal:
    name: str
    value: float   # [-1, +1]
    weight: float


@dataclass
class MacroResult:
    score: float            # [-1, +1]
    confidence: float       # [0, 1]
    direction: str          # 'long' / 'short' / 'flat'
    volatility: float       # stdev return (untuk sizing)
    signals: List[Signal] = field(default_factory=list)
    note: str = ""


def _sma(xs: List[float], n: int) -> float:
    n = min(n, len(xs))
    return sum(xs[-n:]) / n


def _stdev(xs: List[float]) -> float:
    if len(xs) < 2:
        return 0.0
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


class MacroScorer:
    def __init__(
        self,
        fast: int = 10,
        slow: int = 30,
        momentum_lookback: int = 14,
        weights: Optional[dict] = None,
        score_threshold: float = 0.15,   # |score| di bawah ini -> FLAT
        min_confidence: float = 0.35,    # confidence di bawah ini -> FLAT
    ):
        self.fast = fast
        self.slow = slow
        self.mom = momentum_lookback
        self.w = weights or {"trend": 0.5, "momentum": 0.35, "mean_revert": 0.15}
        self.score_threshold = score_threshold
        self.min_confidence = min_confidence

    def score(self, prices: List[float]) -> MacroResult:
        if len(prices) < self.slow:
            return MacroResult(0.0, 0.0, "flat", 0.0,
                               note=f"butuh >= {self.slow} sampel harga, ada {len(prices)}")

        sma_fast = _sma(prices, self.fast)
        sma_slow = _sma(prices, self.slow)

        # returns untuk volatilitas
        rets = [(prices[i] / prices[i - 1] - 1.0) for i in range(1, len(prices))]
        vol = _stdev(rets[-self.slow:])

        # --- sinyal (squash ke [-1,1] dengan tanh) ---
        trend_raw = (sma_fast - sma_slow) / sma_slow
        trend = math.tanh(trend_raw / max(vol, 1e-4) * 0.5)

        mom_n = min(self.mom, len(prices) - 1)
        mom_raw = prices[-1] / prices[-1 - mom_n] - 1.0
        momentum = math.tanh(mom_raw / max(vol, 1e-4) * 0.3)

        z = (prices[-1] - sma_slow) / (sma_slow * max(vol, 1e-4))
        mean_revert = math.tanh(-z * 0.2)

        signals = [
            Signal("trend", trend, self.w["trend"]),
            Signal("momentum", momentum, self.w["momentum"]),
            Signal("mean_revert", mean_revert, self.w["mean_revert"]),
        ]
        wsum = sum(s.weight for s in signals) or 1.0
        score = sum(s.value * s.weight for s in signals) / wsum
        score = max(-1.0, min(1.0, score))

        # confidence: kesepakatan arah trend & momentum, dikurangi penalti volatilitas
        agree = 1.0 if (trend * momentum) > 0 else 0.4
        vol_penalty = math.exp(-vol * 50.0)  # vol tinggi -> confidence turun
        confidence = max(0.0, min(1.0, abs(score) * agree * vol_penalty))

        if abs(score) < self.score_threshold or confidence < self.min_confidence:
            direction = "flat"
        else:
            direction = "long" if score > 0 else "short"

        return MacroResult(
            score=score, confidence=confidence, direction=direction,
            volatility=vol, signals=signals,
            note=f"sma_fast={sma_fast:.2f} sma_slow={sma_slow:.2f} vol={vol:.4f}",
        )


if __name__ == "__main__":
    # contoh: trend naik -> bias long
    up = [3000 + i * 8 + (i % 3) * 5 for i in range(40)]
    r = MacroScorer().score(up)
    print(f"dir={r.direction} score={r.score:+.3f} conf={r.confidence:.2f} vol={r.volatility:.4f}")
    for s in r.signals:
        print(f"  {s.name:12} val={s.value:+.3f} w={s.weight}")
