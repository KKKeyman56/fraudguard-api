"""Module 5 — Entry point & Scheduler.

Usage:
    python -m quant_screener.main screen     # run the daily screener once
    python -m quant_screener.main backtest    # run backtests once
    python -m quant_screener.main weekly       # send the weekly summary once
    python -m quant_screener.main schedule     # run the long-lived scheduler

The `screen` / `backtest` / `weekly` one-shot modes are ideal for an external
cron (e.g. Railway cron or a VPS crontab). The `schedule` mode keeps a process
alive with APScheduler for environments without a cron facility.
"""
from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler

import pandas as pd

from . import config, telegram_bot
from .backtester import run_backtests
from .data_fetcher import get_universe_data
from .screener import run_screener


def _setup_logging() -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    try:
        handlers.append(
            RotatingFileHandler(
                config.LOG_FILE, maxBytes=2_000_000, backupCount=3, encoding="utf-8"
            )
        )
    except Exception:
        pass  # filesystem may be read-only; stdout logging still works
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=handlers,
    )


logger = logging.getLogger("quant_screener.main")


# --------------------------------------------------------------------------- #
# Jobs
# --------------------------------------------------------------------------- #
def job_daily_screen() -> None:
    logger.info("=== Daily screener run starting ===")
    try:
        data = get_universe_data()
        grouped = run_screener(data)
        telegram_bot.send_daily_report(grouped)
    except Exception as exc:
        logger.exception("Daily screener run failed: %s", exc)
    logger.info("=== Daily screener run finished ===")


def job_backtest() -> pd.DataFrame:
    logger.info("=== Backtest run starting ===")
    results = pd.DataFrame()
    try:
        data = get_universe_data()
        results = run_backtests(data)
    except Exception as exc:
        logger.exception("Backtest run failed: %s", exc)
    logger.info("=== Backtest run finished ===")
    return results


def job_weekly_summary() -> None:
    logger.info("=== Weekly summary run starting ===")
    try:
        latest = config.BACKTEST_DIR / "backtest_latest.csv"
        if latest.exists():
            results = pd.read_csv(latest)
        else:
            results = job_backtest()
        telegram_bot.send_weekly_summary(results)
    except Exception as exc:
        logger.exception("Weekly summary run failed: %s", exc)
    logger.info("=== Weekly summary run finished ===")


# --------------------------------------------------------------------------- #
# Scheduler
# --------------------------------------------------------------------------- #
def run_scheduler() -> None:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger

    sched = BlockingScheduler(timezone=config.TIMEZONE)

    # Daily screener — Mon-Fri at the configured WIB time (after market close).
    sched.add_job(
        job_daily_screen,
        CronTrigger(
            day_of_week="mon-fri",
            hour=config.SCREENER_HOUR,
            minute=config.SCREENER_MINUTE,
            timezone=config.TIMEZONE,
        ),
        id="daily_screen",
        max_instances=1,
        coalesce=True,
    )

    # Weekly backtest summary — Sunday morning.
    sched.add_job(
        job_weekly_summary,
        CronTrigger(
            day_of_week="sun",
            hour=config.WEEKLY_REPORT_HOUR,
            minute=config.WEEKLY_REPORT_MINUTE,
            timezone=config.TIMEZONE,
        ),
        id="weekly_summary",
        max_instances=1,
        coalesce=True,
    )

    logger.info(
        "Scheduler started (tz=%s): screener Mon-Fri %02d:%02d, weekly Sun %02d:%02d",
        config.TIMEZONE, config.SCREENER_HOUR, config.SCREENER_MINUTE,
        config.WEEKLY_REPORT_HOUR, config.WEEKLY_REPORT_MINUTE,
    )
    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped")


def main() -> None:
    _setup_logging()
    mode = sys.argv[1] if len(sys.argv) > 1 else "schedule"

    if mode == "screen":
        job_daily_screen()
    elif mode == "backtest":
        res = job_backtest()
        if not res.empty:
            print(res.to_string(index=False))
    elif mode == "weekly":
        job_weekly_summary()
    elif mode == "schedule":
        run_scheduler()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
