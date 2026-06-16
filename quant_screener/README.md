# QuantScreener v1.0

Semi-quant daily trading screener for Indonesian equities (IHSG / LQ45 / IDX30).
Pulls free EOD data from Yahoo Finance, backtests three strategies with
VectorBT, screens the universe for today's signals, and pushes a formatted
report to a Telegram bot — **signals only, no auto-ordering.**

> ⚠️ Bukan rekomendasi investasi. Untuk edukasi dan riset pribadi.

## Architecture

```
quant_screener/
├── main.py            # Entry point + APScheduler
├── config.py          # Settings, universe lists, env vars
├── indicators.py      # Shared TA helpers (SMA, RSI, vol ratio, ...)
├── data_fetcher.py    # Module 1 — download & cache OHLCV (Yahoo .JK)
├── backtester.py      # Module 2 — signal logic + VectorBT backtests
├── screener.py        # Module 3 — daily signal scanner
├── telegram_bot.py    # Module 4 — message formatter + sender
├── data/cache/        # Per-ticker CSV cache
└── results/backtest/  # Backtest output CSVs
```

The strategy signal functions in `backtester.py` are the single source of
truth — the daily screener imports them, so live signals and backtests can
never drift apart.

## Strategies

| Key | Strategy | Entry | Exit |
|-----|----------|-------|------|
| `volume_anomaly` | Volume Anomaly Momentum | Vol > 2× avg20, green candle, Close > MA50 | Close < MA20 or −5% stop |
| `breakout_52w` | Breakout 52-Week High | Close > 52w high, Vol > 1.5× avg20 | 7% trailing stop |
| `rsi_oversold` | Mean-Reversion RSI | RSI(14) < 35, Close > MA200, not 3-day downtrend | RSI > 55 or −5% stop |

## Setup

```bash
cd quant_screener
pip install -r requirements.txt
cp .env.example .env        # then fill in TELEGRAM_TOKEN and TELEGRAM_CHAT_ID
```

## Usage

```bash
# One-shot modes (great for cron):
python -m quant_screener.main screen      # run daily screener + send to Telegram
python -m quant_screener.main backtest     # backtest all strategies -> results/backtest/
python -m quant_screener.main weekly       # send weekly performance summary

# Long-lived scheduler (Mon-Fri 16:00 WIB screen, Sun 08:00 WIB summary):
python -m quant_screener.main schedule
```

Preview the Telegram formatting without sending anything:

```bash
python -m quant_screener.telegram_bot
```

## Deployment

### Railway (free tier, 512 MB)
- Set env vars from `.env.example` in the Railway dashboard.
- **Worker service:** start command `python -m quant_screener.main schedule`.
- VectorBT pulls in numba/llvmlite and can be heavy on 512 MB. If the build
  OOMs, comment `vectorbt` out of `requirements.txt`; the backtester falls back
  to a built-in pure-pandas simulator automatically.

### Cron (VPS, lighter on RAM)
Prefer the one-shot modes so nothing stays resident:

```cron
# Daily screener — Mon-Fri 16:00 WIB (set the box TZ to Asia/Jakarta)
0 16 * * 1-5 cd /opt/quant_screener && python -m quant_screener.main screen
# Weekly summary — Sun 08:00 WIB
0 8  * * 0   cd /opt/quant_screener && python -m quant_screener.main weekly
```

## Robustness notes
- A failing ticker is logged and skipped — one bad symbol never aborts a run.
- Stale-or-missing cache triggers a re-download; a failed re-download falls back
  to the existing (stale) cache rather than dropping the ticker.
- All runs log to `quant_screener.log` (rotating) and stdout.
- LQ45/IDX30 constituents change at each IDX rebalance (Feb & Aug) — review the
  lists in `config.py` periodically.
