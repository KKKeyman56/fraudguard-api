"""Shared technical-indicator helpers.

Pure-pandas implementations so they work identically in the backtester and the
daily screener (no dependency on the backtest engine for signal generation).
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    """Simple moving average."""
    return series.rolling(window=window, min_periods=window).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Wilder's RSI."""
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)

    # Wilder's smoothing (EMA with alpha = 1/period).
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    out = 100 - (100 / (1 + rs))
    # When avg_loss == 0 the asset only rose -> RSI is 100.
    out = out.where(avg_loss != 0, 100.0)
    return out


def volume_ratio(volume: pd.Series, window: int = 20) -> pd.Series:
    """Current volume divided by the trailing average volume."""
    avg = volume.rolling(window=window, min_periods=window).mean()
    return volume / avg


def rolling_high(series: pd.Series, window: int) -> pd.Series:
    """Highest value over the *previous* `window` bars (excludes current bar)."""
    return series.shift(1).rolling(window=window, min_periods=window).max()


def consecutive_down(close: pd.Series, days: int = 3) -> pd.Series:
    """Boolean series: True when close fell for `days` consecutive bars."""
    down = close.diff() < 0
    streak = down
    for i in range(1, days):
        streak = streak & down.shift(i).fillna(False)
    return streak.fillna(False)
