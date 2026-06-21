"""
run_bot.py
==========
FUNGSI: Orchestrator off-chain yang merangkai semua modul:
  1. ambil harga WETH/USDC (via Uniswap QuoterV2)
  2. risk_check -> hitung liquidation price & buffer, reject jika < 15%
  3. kalau lolos: approve margin -> kirim openPosition ke contract
  4. logger -> catat entry ke SQLite

Ini contoh alur SATU entry (bukan loop trading penuh). Macro scoring /
position sizing gaya gcr_bot kamu bisa dipasang di fungsi decide_trade().
"""

from __future__ import annotations

from decimal import Decimal

from config import settings
from contract_interface import BaseChainClient
from logger import TradeLogger
from risk_check import assess_position, suggested_min_health_factor

USDC_DECIMALS = 6
WETH_DECIMALS = 18


def get_weth_price(client: BaseChainClient) -> float:
    """Harga 1 WETH dalam USDC via Uniswap V3 QuoterV2 (1 WETH -> ? USDC)."""
    one_weth = 10**WETH_DECIMALS
    usdc_out = client.quote_exact_in(
        settings.addresses["weth"], settings.addresses["usdc"], one_weth, settings.default_pool_fee
    )
    return usdc_out / 10**USDC_DECIMALS


def open_long_example(margin_usdc: float, leverage: float):
    """Buka long WETH dengan modal `margin_usdc` USDC dan target leverage."""
    client = BaseChainClient()
    logger = TradeLogger()

    if client.leverage is None:
        raise SystemExit("LEVERAGE_CONTRACT belum di-set di .env (deploy dulu).")

    # --- 1. harga & ukuran posisi ---
    price = get_weth_price(client)
    flash_usdc = margin_usdc * (leverage - 1)
    print(f"Harga WETH/USDC : {price:,.2f}")

    # --- 2. RISK CHECK (off-chain) ---
    risk = assess_position(
        is_long=True, entry_price=price, margin_usd=margin_usdc, flash_usd=flash_usdc
    )
    print(f"Liq price       : {risk.liquidation_price:,.2f}")
    print(f"Margin of safety: {risk.margin_of_safety:.1%}")
    print(f"Keputusan       : {risk.reason}")
    if not risk.approved:
        print("Trade DITOLAK oleh risk module. Stop.")
        return

    # --- 3. siapkan jumlah on-chain ---
    margin_wei = int(Decimal(margin_usdc) * 10**USDC_DECIMALS)
    flash_wei = int(Decimal(flash_usdc) * 10**USDC_DECIMALS)

    # minSwapOut: total USDC (margin+flash) -> WETH, dikurangi slippage
    total_usdc_wei = margin_wei + flash_wei
    quoted_weth = client.quote_exact_in(
        settings.addresses["usdc"], settings.addresses["weth"],
        total_usdc_wei, settings.default_pool_fee,
    )
    min_swap_out = client.min_out_with_slippage(quoted_weth)

    min_hf = suggested_min_health_factor(settings.min_margin_of_safety)

    # --- 4. approve + open ---
    approve_tx = client.approve_margin(margin_wei)
    if approve_tx:
        print(f"Approve tx      : {approve_tx}")

    tx = client.open_position(
        is_long=True,
        margin=margin_wei,
        flash_amount=flash_wei,
        min_swap_out=min_swap_out,
        min_health_factor=min_hf,
        use_aave=False,  # Balancer (fee 0%) sebagai primary
    )
    print(f"Open tx         : {tx}")

    # --- 5. baca posisi on-chain + log ---
    acct = client.get_account_data()
    logger.log_entry(
        direction="long",
        flash_source="balancer",
        entry_price=price,
        leverage=risk.leverage,
        margin_usd=margin_usdc,
        position_size_usd=risk.collateral_value_usd,
        debt_usd=risk.debt_value_usd,
        liquidation_price=risk.liquidation_price,
        margin_of_safety=risk.margin_of_safety,
        ltv_bps=acct["ltv_bps"],
        health_factor=acct["health_factor"],
        tx_hash=tx,
    )
    print(f"Health factor   : {acct['health_factor']:.3f}")
    print("Entry tercatat di SQLite.")


if __name__ == "__main__":
    # CONTOH: long $200 modal, leverage 3x (flash $400) -> posisi $600
    open_long_example(margin_usdc=200, leverage=3.0)
