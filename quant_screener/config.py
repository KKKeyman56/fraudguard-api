"""Central configuration for QuantScreener.

All secrets are read from environment variables (see .env.example) so the
project can run safely on Railway / a VPS without hardcoding tokens.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    # Optional: load a local .env when running outside of Railway.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv is optional
    pass


# --------------------------------------------------------------------------- #
# Telegram
# --------------------------------------------------------------------------- #
TELEGRAM_TOKEN: str = os.getenv("TELEGRAM_TOKEN", "your_token")
TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "your_chat_id")

# --------------------------------------------------------------------------- #
# Data / backtest settings
# --------------------------------------------------------------------------- #
LOOKBACK_YEARS: int = int(os.getenv("LOOKBACK_YEARS", "2"))
UNIVERSE: str = os.getenv("UNIVERSE", "LQ45")  # "LQ45", "IDX30" or "CUSTOM"

# Stale threshold for the on-disk cache, in hours. If the most recent bar is
# older than this we re-download from Yahoo Finance.
CACHE_STALE_HOURS: int = int(os.getenv("CACHE_STALE_HOURS", "24"))

# Risk-free rate (annual) used for the Sharpe ratio. Indonesian 10y ~6-7%.
RISK_FREE_RATE: float = float(os.getenv("RISK_FREE_RATE", "0.06"))

# --------------------------------------------------------------------------- #
# Scheduler (times are WIB / Asia/Jakarta)
# --------------------------------------------------------------------------- #
TIMEZONE: str = os.getenv("TIMEZONE", "Asia/Jakarta")
SCREENER_HOUR: int = int(os.getenv("SCREENER_HOUR", "16"))
SCREENER_MINUTE: int = int(os.getenv("SCREENER_MINUTE", "0"))
WEEKLY_REPORT_HOUR: int = int(os.getenv("WEEKLY_REPORT_HOUR", "8"))
WEEKLY_REPORT_MINUTE: int = int(os.getenv("WEEKLY_REPORT_MINUTE", "0"))

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"
CACHE_DIR: Path = DATA_DIR / "cache"
RESULTS_DIR: Path = BASE_DIR / "results"
BACKTEST_DIR: Path = RESULTS_DIR / "backtest"
LOG_FILE: Path = BASE_DIR / "quant_screener.log"

for _d in (DATA_DIR, CACHE_DIR, RESULTS_DIR, BACKTEST_DIR):
    _d.mkdir(parents=True, exist_ok=True)


# --------------------------------------------------------------------------- #
# Universe definitions (Yahoo Finance uses the .JK suffix for IDX tickers)
# --------------------------------------------------------------------------- #
# LQ45 constituents (approximate recent composition — review periodically as
# IDX rebalances the index every 6 months in Feb & Aug).
LQ45_TICKERS: list[str] = [
    "ACES", "ADRO", "AKRA", "AMMN", "AMRT", "ANTM", "ARTO", "ASII", "BBCA",
    "BBNI", "BBRI", "BBTN", "BMRI", "BRIS", "BRPT", "BUKA", "CPIN", "ESSA",
    "EXCL", "GGRM", "GOTO", "HRUM", "ICBP", "INCO", "INDF", "INKP", "INTP",
    "ISAT", "ITMG", "KLBF", "MAPI", "MBMA", "MDKA", "MEDC", "PGAS", "PGEO",
    "PTBA", "SIDO", "SMGR", "TLKM", "TOWR", "TPIA", "UNTR", "UNVR", "VKTR",
]

# IDX30 is a subset of LQ45 (top 30 by liquidity / market cap).
IDX30_TICKERS: list[str] = [
    "ADRO", "AKRA", "AMMN", "AMRT", "ANTM", "ASII", "BBCA", "BBNI", "BBRI",
    "BMRI", "BRIS", "BRPT", "CPIN", "GOTO", "ICBP", "INDF", "INKP", "ISAT",
    "ITMG", "KLBF", "MDKA", "MEDC", "PGAS", "PTBA", "SMGR", "TLKM", "TOWR",
    "TPIA", "UNTR", "UNVR",
]

# Override here if you set UNIVERSE="CUSTOM".
CUSTOM_TICKERS: list[str] = [
    "BBCA", "BBRI", "TLKM", "ASII", "BMRI",
]

YF_SUFFIX = ".JK"


def get_universe() -> list[str]:
    """Return the active ticker list (without the .JK suffix)."""
    mapping = {
        "LQ45": LQ45_TICKERS,
        "IDX30": IDX30_TICKERS,
        "CUSTOM": CUSTOM_TICKERS,
    }
    return mapping.get(UNIVERSE.upper(), LQ45_TICKERS)


def to_yahoo(ticker: str) -> str:
    """Append the Yahoo Finance .JK suffix if not already present."""
    return ticker if ticker.endswith(YF_SUFFIX) else f"{ticker}{YF_SUFFIX}"


def from_yahoo(ticker: str) -> str:
    """Strip the .JK suffix to get the plain IDX code."""
    return ticker[: -len(YF_SUFFIX)] if ticker.endswith(YF_SUFFIX) else ticker
