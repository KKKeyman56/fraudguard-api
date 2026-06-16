"""Module 2 — Backtester.

Generates entry/exit signals for the three strategies and evaluates them per
ticker. VectorBT is used as the engine when available (fast, vectorised); a
pure-pandas single-position simulator is used as a fallback so the project
still runs on minimal environments where VectorBT is not installed.

The signal-generation functions are the single source of truth and are also
imported by the daily screener so backtest and live signals never drift.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from . import config, indicators
from .data_fetcher import get_universe_data

logger = logging.getLogger("quant_screener.backtester")

SignalFn = Callable[[pd.DataFrame], "pd.DataFrame"]


# --------------------------------------------------------------------------- #
# Signal generation — returns a frame with boolean `entry` / `exit` columns
# plus the indicator values used (handy for the screener report).
# --------------------------------------------------------------------------- #
def strat1_volume_anomaly(df: pd.DataFrame) -> pd.DataFrame:
    """Volume Anomaly Momentum."""
    close, vol = df["Close"], df["Volume"]
    ma20 = indicators.sma(close, 20)
    ma50 = indicators.sma(close, 50)
    vratio = indicators.volume_ratio(vol, 20)

    entry = (vratio > 2.0) & (close > df["Open"]) & (close > ma50)
    exit_ = close < ma20  # plus a 5% hard stop applied by the engine

    out = pd.DataFrame(index=df.index)
    out["entry"] = entry.fillna(False)
    out["exit"] = exit_.fillna(False)
    out["vol_ratio"] = vratio
    out["ma50"] = ma50
    out["rsi"] = indicators.rsi(close, 14)
    return out


def strat2_breakout_52w(df: pd.DataFrame) -> pd.DataFrame:
    """Breakout of 52-week (252 trading day) closing high."""
    close, vol = df["Close"], df["Volume"]
    high_52w = indicators.rolling_high(close, 252)
    vratio = indicators.volume_ratio(vol, 20)

    entry = (close > high_52w) & (vratio > 1.5)
    # Exit is handled entirely by the 7% trailing stop in the engine.
    exit_ = pd.Series(False, index=df.index)

    out = pd.DataFrame(index=df.index)
    out["entry"] = entry.fillna(False)
    out["exit"] = exit_
    out["vol_ratio"] = vratio
    out["high_52w"] = high_52w
    out["rsi"] = indicators.rsi(close, 14)
    return out


def strat3_rsi_oversold(df: pd.DataFrame) -> pd.DataFrame:
    """Mean-reversion: RSI oversold while in a long-term uptrend."""
    close = df["Close"]
    rsi = indicators.rsi(close, 14)
    ma200 = indicators.sma(close, 200)
    downtrend = indicators.consecutive_down(close, 3)

    entry = (rsi < 35) & (close > ma200) & (~downtrend)
    exit_ = rsi > 55  # plus a 5% hard stop applied by the engine

    out = pd.DataFrame(index=df.index)
    out["entry"] = entry.fillna(False)
    out["exit"] = exit_.fillna(False)
    out["rsi"] = rsi
    out["ma200"] = ma200
    out["ma50"] = indicators.sma(close, 50)
    return out


@dataclass(frozen=True)
class Strategy:
    key: str
    label: str
    signal_fn: SignalFn
    sl_stop: float | None = None   # hard stop loss (fraction, e.g. 0.05)
    tsl_stop: float | None = None  # trailing stop (fraction, e.g. 0.07)


STRATEGIES: dict[str, Strategy] = {
    "volume_anomaly": Strategy(
        "volume_anomaly", "VOLUME ANOMALY", strat1_volume_anomaly, sl_stop=0.05
    ),
    "breakout_52w": Strategy(
        "breakout_52w", "BREAKOUT 52W HIGH", strat2_breakout_52w, tsl_stop=0.07
    ),
    "rsi_oversold": Strategy(
        "rsi_oversold", "RSI OVERSOLD", strat3_rsi_oversold, sl_stop=0.05
    ),
}


# --------------------------------------------------------------------------- #
# Backtest engines
# --------------------------------------------------------------------------- #
def _metrics_vectorbt(close: pd.Series, sig: pd.DataFrame, strat: Strategy) -> dict:
    import vectorbt as vbt

    pf = vbt.Portfolio.from_signals(
        close=close,
        entries=sig["entry"],
        exits=sig["exit"],
        sl_stop=strat.sl_stop,
        tsl_stop=strat.tsl_stop,
        init_cash=100_000,
        fees=0.0015,  # ~0.15% IDX retail commission
        freq="1D",
    )
    trades = pf.trades
    n = int(trades.count())
    win_rate = float(trades.win_rate() * 100) if n > 0 else 0.0
    sharpe = pf.sharpe_ratio()
    return {
        "total_return_pct": float(pf.total_return() * 100),
        "win_rate_pct": round(win_rate, 2),
        "max_drawdown_pct": float(pf.max_drawdown() * 100),
        "sharpe": round(float(sharpe), 3) if np.isfinite(sharpe) else 0.0,
        "num_trades": n,
    }


def _metrics_fallback(close: pd.Series, sig: pd.DataFrame, strat: Strategy) -> dict:
    """Single-position long-only simulator (no leverage, full allocation)."""
    entries = sig["entry"].to_numpy()
    exits = sig["exit"].to_numpy()
    prices = close.to_numpy(dtype=float)
    fee = 0.0015

    equity = 1.0
    curve = [equity]
    in_pos = False
    entry_px = peak = 0.0
    returns: list[float] = []

    for i in range(1, len(prices)):
        px = prices[i]
        if not np.isfinite(px):
            curve.append(equity)
            continue

        if in_pos:
            peak = max(peak, px)
            hit_sl = strat.sl_stop and px <= entry_px * (1 - strat.sl_stop)
            hit_tsl = strat.tsl_stop and px <= peak * (1 - strat.tsl_stop)
            if exits[i] or hit_sl or hit_tsl:
                trade_ret = (px / entry_px) * (1 - fee) ** 2 - 1
                returns.append(trade_ret)
                equity *= 1 + trade_ret
                in_pos = False
        elif entries[i - 1]:  # enter next bar after signal
            in_pos = True
            entry_px = peak = px

        # mark-to-market equity for drawdown/sharpe
        mtm = equity * (px / entry_px if in_pos else 1.0)
        curve.append(mtm)

    eq = pd.Series(curve)
    daily = eq.pct_change().dropna()
    sharpe = 0.0
    if daily.std() > 0:
        excess = daily - (config.RISK_FREE_RATE / 252)
        sharpe = float(np.sqrt(252) * excess.mean() / daily.std())
    dd = (eq / eq.cummax() - 1).min()
    wins = sum(1 for r in returns if r > 0)
    n = len(returns)
    # Use the mark-to-market curve so total return is consistent with the
    # drawdown / Sharpe figures (an open position is reflected in all three).
    return {
        "total_return_pct": round((float(eq.iloc[-1]) - 1) * 100, 2),
        "win_rate_pct": round(wins / n * 100, 2) if n else 0.0,
        "max_drawdown_pct": round(float(dd) * 100, 2),
        "sharpe": round(sharpe, 3),
        "num_trades": n,
    }


def _has_vectorbt() -> bool:
    try:
        import vectorbt  # noqa: F401

        return True
    except Exception:
        return False


def backtest_ticker(ticker: str, df: pd.DataFrame, strat: Strategy) -> dict | None:
    """Run one strategy on one ticker. Returns a metrics dict or None."""
    if len(df) < 60:  # not enough history to be meaningful
        return None
    try:
        sig = strat.signal_fn(df)
        close = df["Close"].astype(float)
        if sig["entry"].sum() == 0:
            return {
                "ticker": ticker, "strategy": strat.key,
                "total_return_pct": 0.0, "win_rate_pct": 0.0,
                "max_drawdown_pct": 0.0, "sharpe": 0.0, "num_trades": 0,
            }
        engine = _metrics_vectorbt if _has_vectorbt() else _metrics_fallback
        metrics = engine(close, sig, strat)
        metrics.update({"ticker": ticker, "strategy": strat.key})
        return metrics
    except Exception as exc:
        logger.error("Backtest failed for %s/%s: %s", ticker, strat.key, exc)
        return None


def run_backtests(
    data: dict[str, pd.DataFrame] | None = None, save: bool = True
) -> pd.DataFrame:
    """Backtest every strategy on every ticker; return a ranked results frame."""
    data = data or get_universe_data()
    if not _has_vectorbt():
        logger.warning("vectorbt not installed — using pure-pandas fallback engine")

    rows: list[dict] = []
    for strat in STRATEGIES.values():
        for ticker, df in data.items():
            res = backtest_ticker(ticker, df, strat)
            if res:
                rows.append(res)

    if not rows:
        logger.warning("No backtest results produced")
        return pd.DataFrame()

    results = pd.DataFrame(rows)
    cols = [
        "strategy", "ticker", "total_return_pct", "win_rate_pct",
        "max_drawdown_pct", "sharpe", "num_trades",
    ]
    results = results[cols].sort_values(
        ["strategy", "win_rate_pct", "total_return_pct"], ascending=[True, False, False]
    )

    if save:
        out = config.BACKTEST_DIR / f"backtest_{pd.Timestamp.now():%Y%m%d}.csv"
        results.to_csv(out, index=False)
        latest = config.BACKTEST_DIR / "backtest_latest.csv"
        results.to_csv(latest, index=False)
        logger.info("Saved backtest results to %s", out)

    return results


def best_strategy(results: pd.DataFrame) -> tuple[str, float] | None:
    """Pick the strategy with the highest mean win rate across the universe."""
    if results.empty:
        return None
    traded = results[results["num_trades"] > 0]
    if traded.empty:
        return None
    avg = traded.groupby("strategy")["win_rate_pct"].mean().sort_values(ascending=False)
    return str(avg.index[0]), float(avg.iloc[0])


if __name__ == "__main__":  # manual run
    logging.basicConfig(level=logging.INFO)
    res = run_backtests()
    if not res.empty:
        print(res.to_string(index=False))
        bs = best_strategy(res)
        if bs:
            print(f"\nBest strategy by avg win rate: {bs[0]} ({bs[1]:.1f}%)")
