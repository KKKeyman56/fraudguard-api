"""
run_bot_routed.py
=================
FUNGSI: Orchestrator versi MULTI-DEX. Merangkai dex_optimizer + risk_check +
contract_interface + logger untuk membuka posisi terungkit dengan swap yang
dirutekan ke DEX paling efisien di Base.

ALUR:
  1. dex_optimizer  -> harga WETH/USDC (best route)
  2. risk_check     -> liquidation price & buffer, reject jika < 15%
  3. dex_optimizer  -> best route untuk swap aktual (USDC->WETH long / WETH->USDC short)
  4. contract       -> openPosition(..., SwapRoute) via Aave flashLoanSimple
  5. logger         -> catat entry + DEX dipakai + fee + slippage estimate
"""

from __future__ import annotations

from decimal import Decimal

from config import settings
from contract_interface import BaseChainClient
from dex_optimizer import DexOptimizer, DEX_NAME, DEX_UNIV3, DEX_AERO
from logger import TradeLogger
from risk_check import assess_position, suggested_min_health_factor

USDC_DECIMALS = 6
WETH_DECIMALS = 18


def _fee_bps(best) -> int:
    """Estimasi fee DEX yang dibayar (bps) untuk logging."""
    if best.dex_id == DEX_UNIV3:
        return best.uni_fee // 100          # 500 -> 5 bps
    if best.dex_id == DEX_AERO:
        return 5 if best.aero_stable else 30  # stable ~0.05%, volatile ~0.3% (perkiraan)
    return 30                                # UniV2-fork umumnya ~0.3%


def _detail(best) -> str:
    if best.dex_id == DEX_UNIV3:
        return f"fee_tier={best.uni_fee}"
    if best.dex_id == DEX_AERO:
        return "stable" if best.aero_stable else "volatile"
    return "v2"


def open_long_routed(margin_usdc: float, leverage: float):
    client = BaseChainClient()
    opt = DexOptimizer(client.w3)
    logger = TradeLogger()

    if client.routed is None:
        raise SystemExit("LEVERAGE_CONTRACT (versi routed) belum di-set di .env.")

    usdc = settings.addresses["usdc"]
    weth = settings.addresses["weth"]

    # --- 1. harga WETH/USDC dari best route (1 WETH -> ? USDC) ---
    price_rq = opt.best_route(weth, usdc, 10**WETH_DECIMALS)
    price = price_rq.best.amount_out / 10**USDC_DECIMALS
    print(f"Harga WETH/USDC  : {price:,.2f} (via {DEX_NAME[price_rq.best.dex_id]})")

    # --- 2. RISK CHECK ---
    flash_usdc = margin_usdc * (leverage - 1)
    risk = assess_position(True, price, margin_usdc, flash_usdc)
    print(f"Liq price        : {risk.liquidation_price:,.2f} | buffer {risk.margin_of_safety:.1%}")
    print(f"Keputusan        : {risk.reason}")
    if not risk.approved:
        print("Trade DITOLAK risk module. Stop.")
        return

    # --- 3. BEST ROUTE untuk swap aktual: seluruh USDC (margin+flash) -> WETH ---
    margin_wei = int(Decimal(margin_usdc) * 10**USDC_DECIMALS)
    flash_wei = int(Decimal(flash_usdc) * 10**USDC_DECIMALS)
    total_in = margin_wei + flash_wei

    rq = opt.best_route(usdc, weth, total_in)
    best = rq.best
    print(f"DEX swap terbaik : {DEX_NAME[best.dex_id]} ({_detail(best)}) "
          f"out={best.amount_out/10**WETH_DECIMALS:.6f} WETH, impact {rq.slippage_estimate:.2%}")
    print("Perbandingan:")
    for q in sorted(rq.all_quotes, key=lambda x: -x.amount_out):
        tag = "<= dipilih" if q is best else ""
        print(f"  {q.dex_name:12} {q.amount_out/10**WETH_DECIMALS:.6f} WETH {tag}")

    # --- 4. bentuk SwapRoute + kirim tx ---
    route = (
        best.dex_id,
        best.uni_fee if best.dex_id == DEX_UNIV3 else 0,
        best.aero_stable if best.dex_id == DEX_AERO else False,
        rq.min_out(settings.slippage_bps),   # slippage guard on-chain
    )
    min_hf = suggested_min_health_factor(settings.min_margin_of_safety)

    approve_tx = client.approve_margin(margin_wei)
    if approve_tx:
        print(f"Approve tx       : {approve_tx}")

    tx = client.open_position_routed(
        is_long=True, margin=margin_wei, flash_amount=flash_wei,
        min_health_factor=min_hf, route=route,
    )
    print(f"Open tx          : {tx}")

    # --- 5. log ---
    acct = client.get_account_data()
    logger.log_entry(
        direction="long", flash_source="aave",
        entry_price=price, leverage=risk.leverage,
        margin_usd=margin_usdc, position_size_usd=risk.collateral_value_usd,
        debt_usd=risk.debt_value_usd, liquidation_price=risk.liquidation_price,
        margin_of_safety=risk.margin_of_safety, ltv_bps=acct["ltv_bps"],
        health_factor=acct["health_factor"], tx_hash=tx,
        dex_used=DEX_NAME[best.dex_id], dex_detail=_detail(best),
        expected_out=best.amount_out / 10**WETH_DECIMALS,
        slippage_estimate=rq.slippage_estimate, fee_paid_bps=_fee_bps(best),
    )
    print(f"Health factor    : {acct['health_factor']:.3f} | entry tercatat di SQLite.")


if __name__ == "__main__":
    open_long_routed(margin_usdc=200, leverage=3.0)
