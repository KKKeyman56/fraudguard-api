"""Module 1 — Data Fetcher.

Downloads EOD OHLCV data for the configured universe from Yahoo Finance,
caches it to per-ticker CSV files, and refreshes only when the cache is stale.
Every fetch is defensive: a single failing ticker never aborts the run.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from . import config

logger = logging.getLogger("quant_screener.data_fetcher")

OHLCV_COLS = ["Open", "High", "Low", "Close", "Volume"]


def _cache_path(ticker: str) -> Path:
    return config.CACHE_DIR / f"{config.from_yahoo(ticker)}.csv"


def _is_stale(path: Path) -> bool:
    """A cache file is stale if missing, empty, or its newest bar is too old."""
    if not path.exists() or path.stat().st_size == 0:
        return True
    try:
        df = pd.read_csv(path, index_col=0, parse_dates=True)
    except Exception:
        return True
    if df.empty:
        return True
    last_bar = df.index.max()
    # Allow for weekends/holidays: only stale once older than the threshold.
    age = datetime.now() - last_bar.to_pydatetime()
    return age > timedelta(hours=config.CACHE_STALE_HOURS)


def _download(ticker: str, start: datetime) -> pd.DataFrame | None:
    """Download OHLCV from Yahoo Finance. Returns None on failure/empty."""
    import yfinance as yf

    yahoo = config.to_yahoo(ticker)
    try:
        raw = yf.download(
            yahoo,
            start=start.strftime("%Y-%m-%d"),
            auto_adjust=False,
            progress=False,
            threads=False,
        )
    except Exception as exc:  # network / parsing errors
        logger.warning("Download failed for %s: %s", yahoo, exc)
        return None

    if raw is None or raw.empty:
        logger.warning("No data returned for %s (delisted or wrong code?)", yahoo)
        return None

    # yfinance may return a MultiIndex column frame for a single ticker.
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    missing = [c for c in OHLCV_COLS if c not in raw.columns]
    if missing:
        logger.warning("%s missing columns %s — skipping", yahoo, missing)
        return None

    df = raw[OHLCV_COLS].copy()
    df.index.name = "Date"
    df = df.dropna(subset=["Close"])
    return df if not df.empty else None


def get_data(ticker: str, force_refresh: bool = False) -> pd.DataFrame | None:
    """Return cached/fresh OHLCV for one ticker, or None if unavailable."""
    path = _cache_path(ticker)
    start = datetime.now() - timedelta(days=int(config.LOOKBACK_YEARS * 365) + 30)

    if not force_refresh and not _is_stale(path):
        try:
            df = pd.read_csv(path, index_col=0, parse_dates=True)
            logger.debug("Cache hit for %s (%d bars)", ticker, len(df))
            return df
        except Exception as exc:
            logger.warning("Cache read failed for %s (%s) — re-downloading", ticker, exc)

    df = _download(ticker, start)
    if df is None:
        # Fall back to a possibly-stale cache rather than losing the ticker.
        if path.exists():
            try:
                logger.info("Using stale cache for %s after failed refresh", ticker)
                return pd.read_csv(path, index_col=0, parse_dates=True)
            except Exception:
                return None
        return None

    try:
        df.to_csv(path)
        logger.info("Cached %s (%d bars)", ticker, len(df))
    except Exception as exc:
        logger.warning("Could not write cache for %s: %s", ticker, exc)
    return df


def get_universe_data(
    tickers: list[str] | None = None, force_refresh: bool = False
) -> dict[str, pd.DataFrame]:
    """Fetch every ticker in the universe. Failed tickers are simply skipped."""
    tickers = tickers or config.get_universe()
    out: dict[str, pd.DataFrame] = {}
    for ticker in tickers:
        try:
            df = get_data(ticker, force_refresh=force_refresh)
        except Exception as exc:  # last-resort guard
            logger.error("Unexpected error fetching %s: %s", ticker, exc)
            df = None
        if df is not None and len(df) > 0:
            out[config.from_yahoo(ticker)] = df
        else:
            logger.warning("Skipping %s — no usable data", ticker)
    logger.info("Fetched %d/%d tickers", len(out), len(tickers))
    return out


if __name__ == "__main__":  # manual smoke test
    logging.basicConfig(level=logging.INFO)
    data = get_universe_data()
    for tk, frame in data.items():
        print(f"{tk}: {len(frame)} bars, last {frame.index.max().date()}")
