"""Module 3 — Daily Screener.

Scans the universe for tickers whose *latest bar* triggers a strategy entry,
reusing the exact signal logic from the backtester. Produces a structured
result grouped by strategy, ready for the Telegram reporter.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

import pandas as pd

from . import backtester, config, indicators
from .data_fetcher import get_universe_data

logger = logging.getLogger("quant_screener.screener")


@dataclass
class Signal:
    ticker: str
    strategy: str
    close: float
    vol_ratio: float | None = None
    rsi: float | None = None
    pct_from_ma50: float | None = None
    above_ma200: bool | None = None


def _latest_close(df: pd.DataFrame) -> float:
    return float(df["Close"].iloc[-1])


def _pct_from_ma50(df: pd.DataFrame) -> float | None:
    ma50 = indicators.sma(df["Close"], 50).iloc[-1]
    if pd.isna(ma50) or ma50 == 0:
        return None
    return round((_latest_close(df) / float(ma50) - 1) * 100, 2)


def screen_ticker(ticker: str, df: pd.DataFrame) -> list[Signal]:
    """Return the list of signals triggered by the latest bar for one ticker."""
    signals: list[Signal] = []
    if len(df) < 60:
        return signals

    close = _latest_close(df)
    rsi_now = indicators.rsi(df["Close"], 14).iloc[-1]
    pct_ma50 = _pct_from_ma50(df)

    for strat in backtester.STRATEGIES.values():
        try:
            sig = strat.signal_fn(df)
        except Exception as exc:
            logger.error("Signal calc failed for %s/%s: %s", ticker, strat.key, exc)
            continue
        if not bool(sig["entry"].iloc[-1]):
            continue

        vr = sig["vol_ratio"].iloc[-1] if "vol_ratio" in sig else None
        above_ma200 = None
        if "ma200" in sig:
            ma200 = sig["ma200"].iloc[-1]
            above_ma200 = bool(close > ma200) if pd.notna(ma200) else None

        signals.append(
            Signal(
                ticker=ticker,
                strategy=strat.key,
                close=round(close, 2),
                vol_ratio=round(float(vr), 2) if vr is not None and pd.notna(vr) else None,
                rsi=round(float(rsi_now), 1) if pd.notna(rsi_now) else None,
                pct_from_ma50=pct_ma50,
                above_ma200=above_ma200,
            )
        )
    return signals


def run_screener(
    data: dict[str, pd.DataFrame] | None = None,
) -> dict[str, list[Signal]]:
    """Screen the whole universe. Returns {strategy_key: [Signal, ...]}."""
    data = data or get_universe_data()
    grouped: dict[str, list[Signal]] = {k: [] for k in backtester.STRATEGIES}

    for ticker, df in data.items():
        try:
            for sig in screen_ticker(ticker, df):
                grouped[sig.strategy].append(sig)
        except Exception as exc:
            logger.error("Screening failed for %s: %s", ticker, exc)

    total = sum(len(v) for v in grouped.values())
    logger.info("Screener produced %d signals across %d tickers", total, len(data))
    return grouped


if __name__ == "__main__":  # manual run
    logging.basicConfig(level=logging.INFO)
    result = run_screener()
    for strat_key, sigs in result.items():
        print(f"\n=== {strat_key} ({len(sigs)}) ===")
        for s in sigs:
            print(asdict(s))
