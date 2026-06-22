"""
monitor.py
==========
FUNGSI: Pengawas kesehatan posisi (auto-deleverage). Polling health factor
posisi contract di Aave secara berkala:
  - HF <= HF_WARN   -> peringatan (log/print).
  - HF <= HF_ACTION -> TINDAKAN: tutup posisi (deleverage) lewat flash loan +
    DEX terbaik, supaya tidak kena likuidasi.

Auto-close penuh dipilih karena paling robust & atomik (parsial close butuh
kalkulasi rumit dan tetap berisiko). Kalau mau partial, kurangi flash amount.

Catatan: arah posisi (long/short) diambil dari entry terbuka terakhir di logger,
atau bisa dipaksa lewat argumen. Jalankan sebagai proses terpisah:
    python monitor.py
"""

from __future__ import annotations

import time
from decimal import Decimal

from config import settings
from contract_interface import BaseChainClient
from dex_optimizer import DexOptimizer, DEX_UNIV3, DEX_AERO
from logger import TradeLogger

USDC_DECIMALS = 6
WETH_DECIMALS = 18
CLOSE_BUFFER = 1.003  # lebihkan flash 0.3% utk premium + bunga sejak baca


def _route_tuple(rq):
    best = rq.best
    return (
        best.dex_id,
        best.uni_fee if best.dex_id == DEX_UNIV3 else 0,
        best.aero_stable if best.dex_id == DEX_AERO else False,
        rq.min_out(settings.slippage_bps),
        "0x0000000000000000000000000000000000000000",
        b"",
    )


class HealthMonitor:
    def __init__(self):
        self.client = BaseChainClient()
        self.opt = DexOptimizer(self.client.w3)
        self.logger = TradeLogger()
        if self.client.routed is None:
            raise SystemExit("LEVERAGE_CONTRACT (routed) belum di-set di .env.")

    def _open_direction(self) -> str | None:
        for row in self.logger.recent(50):
            if row.get("status") == "open":
                return row["direction"]
        return None

    def current_price(self) -> float:
        weth, usdc = settings.addresses["weth"], settings.addresses["usdc"]
        return self.opt.best_route(weth, usdc, 10**WETH_DECIMALS).best.amount_out / 10**USDC_DECIMALS

    def auto_close(self, is_long: bool) -> str:
        """Tutup posisi penuh: flash debt -> repay -> withdraw -> swap -> PnL ke owner."""
        usdc, weth = settings.addresses["usdc"], settings.addresses["weth"]
        acct = self.client.get_account_data()
        debt_usd = acct["total_debt_base"] / 1e8         # base currency 8 desimal
        coll_usd = acct["total_collateral_base"] / 1e8
        price = self.current_price()

        if is_long:
            # debt USDC, collateral WETH -> flash USDC, swap WETH->USDC saat close
            flash_amount = int(Decimal(str(debt_usd * CLOSE_BUFFER)) * 10**USDC_DECIMALS)
            coll_est = int(Decimal(str(coll_usd / price)) * 10**WETH_DECIMALS)
            rq = self.opt.best_route(weth, usdc, coll_est)
        else:
            # debt WETH, collateral USDC -> flash WETH, swap USDC->WETH saat close
            flash_amount = int(Decimal(str(debt_usd / price * CLOSE_BUFFER)) * 10**WETH_DECIMALS)
            coll_est = int(Decimal(str(coll_usd)) * 10**USDC_DECIMALS)
            rq = self.opt.best_route(usdc, weth, coll_est)

        route = _route_tuple(rq)
        tx = self.client.close_position_routed(is_long, flash_amount, route)
        return tx

    def check_once(self, is_long: bool | None = None) -> dict:
        acct = self.client.get_account_data()
        hf = acct["health_factor"]
        status = "ok"
        if hf <= settings.hf_action:
            status = "action"
        elif hf <= settings.hf_warn:
            status = "warn"

        print(f"[monitor] HF={hf:.4f} status={status} "
              f"(warn<={settings.hf_warn} action<={settings.hf_action})")

        if status == "action":
            direction = is_long
            if direction is None:
                d = self._open_direction()
                direction = (d == "long") if d else True
            print(f"[monitor] HF kritis -> AUTO-DELEVERAGE (close {'long' if direction else 'short'})")
            tx = self.auto_close(bool(direction))
            print(f"[monitor] close tx: {tx}")
            return {"hf": hf, "status": status, "tx": tx}

        return {"hf": hf, "status": status}

    def run(self, is_long: bool | None = None):
        print(f"[monitor] mulai polling tiap {settings.monitor_interval}s ...")
        while True:
            try:
                res = self.check_once(is_long)
                if res["status"] == "action":
                    print("[monitor] posisi ditutup. Stop monitor.")
                    break
            except Exception as e:  # jangan mati gara2 RPC blip
                print(f"[monitor] error: {e}")
            time.sleep(settings.monitor_interval)


if __name__ == "__main__":
    HealthMonitor().run()
