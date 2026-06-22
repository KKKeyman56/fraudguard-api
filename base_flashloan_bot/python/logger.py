"""
logger.py
=========
FUNGSI: Logger SQLite sederhana untuk mencatat setiap entry posisi terungkit.
Menyimpan: timestamp, arah (long/short), network (Base), harga entry, leverage,
LTV, liquidation price, margin of safety, ukuran posisi, sumber flash loan,
tx hash, dan health factor on-chain saat entry.

Dipakai run_bot.py setelah trade berhasil dikirim. Tujuannya untuk audit,
backtest pasca-trade, dan analisa kenapa sebuah posisi kena likuidasi/tidak.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Optional

from config import settings


class TradeLogger:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS leverage_entries (
                    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts                  TEXT    NOT NULL,
                    network             TEXT    NOT NULL,
                    direction           TEXT    NOT NULL,   -- 'long' / 'short'
                    flash_source        TEXT    NOT NULL,   -- 'balancer' / 'aave'
                    entry_price         REAL    NOT NULL,
                    leverage            REAL    NOT NULL,
                    margin_usd          REAL    NOT NULL,
                    position_size_usd   REAL    NOT NULL,   -- collateral value
                    debt_usd            REAL    NOT NULL,
                    ltv_bps             INTEGER,
                    liquidation_price   REAL    NOT NULL,
                    margin_of_safety    REAL    NOT NULL,   -- buffer fraksi
                    health_factor       REAL,
                    tx_hash             TEXT,
                    status              TEXT    DEFAULT 'open'
                )
                """
            )
            # Migrasi additive: kolom multi-DEX (aman dijalankan berulang).
            dex_cols = {
                "dex_used": "TEXT",            # 'uniswap_v3' / 'aerodrome' / 'baseswap' / 'sushiswap'
                "dex_detail": "TEXT",          # fee tier / stable-volatile
                "expected_out": "REAL",        # quote dari optimizer (token units)
                "actual_out": "REAL",          # output aktual on-chain (opsional, dari event)
                "slippage_estimate": "REAL",   # price impact estimasi (fraksi)
                "slippage_actual": "REAL",     # (expected-actual)/expected (kalau actual ada)
                "fee_paid_bps": "INTEGER",     # fee DEX yang dibayar (bps)
            }
            existing = {r[1] for r in conn.execute("PRAGMA table_info(leverage_entries)")}
            for col, typ in dex_cols.items():
                if col not in existing:
                    conn.execute(f"ALTER TABLE leverage_entries ADD COLUMN {col} {typ}")
            conn.commit()

    def log_entry(
        self,
        direction: str,
        flash_source: str,
        entry_price: float,
        leverage: float,
        margin_usd: float,
        position_size_usd: float,
        debt_usd: float,
        liquidation_price: float,
        margin_of_safety: float,
        ltv_bps: Optional[int] = None,
        health_factor: Optional[float] = None,
        tx_hash: Optional[str] = None,
        # --- field multi-DEX (dari dex_optimizer) ---
        dex_used: Optional[str] = None,
        dex_detail: Optional[str] = None,
        expected_out: Optional[float] = None,
        actual_out: Optional[float] = None,
        slippage_estimate: Optional[float] = None,
        slippage_actual: Optional[float] = None,
        fee_paid_bps: Optional[int] = None,
    ) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cur = conn.execute(
                """
                INSERT INTO leverage_entries (
                    ts, network, direction, flash_source, entry_price, leverage,
                    margin_usd, position_size_usd, debt_usd, ltv_bps,
                    liquidation_price, margin_of_safety, health_factor, tx_hash,
                    dex_used, dex_detail, expected_out, actual_out,
                    slippage_estimate, slippage_actual, fee_paid_bps
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    datetime.now(timezone.utc).isoformat(),
                    settings.network,
                    direction,
                    flash_source,
                    entry_price,
                    leverage,
                    margin_usd,
                    position_size_usd,
                    debt_usd,
                    ltv_bps,
                    liquidation_price,
                    margin_of_safety,
                    health_factor,
                    tx_hash,
                    dex_used,
                    dex_detail,
                    expected_out,
                    actual_out,
                    slippage_estimate,
                    slippage_actual,
                    fee_paid_bps,
                ),
            )
            conn.commit()
            return cur.lastrowid

    def mark_closed(self, entry_id: int, tx_hash: Optional[str] = None):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE leverage_entries SET status='closed' WHERE id=?", (entry_id,)
            )
            conn.commit()

    def recent(self, limit: int = 20):
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM leverage_entries ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]


if __name__ == "__main__":
    lg = TradeLogger(":memory:")
    rid = lg.log_entry(
        direction="long", flash_source="balancer", entry_price=3500, leverage=3.0,
        margin_usd=1000, position_size_usd=3000, debt_usd=2000,
        liquidation_price=2410, margin_of_safety=0.31, ltv_bps=8000, health_factor=1.45,
        tx_hash="0xabc",
    )
    print("logged id:", rid, "->", lg.recent(1))
