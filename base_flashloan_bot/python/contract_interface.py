"""
contract_interface.py
=====================
FUNGSI: Lapisan Web3.py untuk berinteraksi dengan kontrak LeverageFlashLoan
di Base chain. Menangani: koneksi RPC Base, build/sign/kirim transaksi,
approve token margin, panggil openPosition/closePosition, baca health factor,
dan helper quote harga via Uniswap V3 QuoterV2 untuk menghitung minSwapOut.

Dipakai oleh run_bot.py (orchestrator) bersama risk_check.py & logger.py.
Tidak ada logic risk di sini - murni I/O on-chain.
"""

from __future__ import annotations

import json
from typing import Optional

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware  # Base = OP-stack, butuh POA middleware

from config import settings

# --------------------------------------------------------------------------- #
#  ABI minimal (hanya fungsi yang dipakai)
# --------------------------------------------------------------------------- #
ERC20_ABI = json.loads("""[
  {"constant":false,"inputs":[{"name":"s","type":"address"},{"name":"a","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"},
  {"constant":true,"inputs":[{"name":"o","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[{"name":"o","type":"address"},{"name":"s","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
]""")

LEVERAGE_ABI = json.loads("""[
  {"inputs":[{"name":"isLong","type":"bool"},{"name":"useAave","type":"bool"},{"name":"margin","type":"uint256"},{"name":"flashAmount","type":"uint256"},{"name":"minSwapOut","type":"uint256"},{"name":"poolFee","type":"uint24"},{"name":"minHealthFactor","type":"uint256"}],"name":"openPosition","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"name":"isLong","type":"bool"},{"name":"useAave","type":"bool"},{"name":"flashAmount","type":"uint256"},{"name":"minSwapOut","type":"uint256"},{"name":"poolFee","type":"uint24"}],"name":"closePosition","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"accountData","outputs":[{"name":"totalCollateralBase","type":"uint256"},{"name":"totalDebtBase","type":"uint256"},{"name":"availableBorrowsBase","type":"uint256"},{"name":"currentLiquidationThreshold","type":"uint256"},{"name":"ltv","type":"uint256"},{"name":"healthFactor","type":"uint256"}],"stateMutability":"view","type":"function"}
]""")

# ABI untuk LeverageFlashLoanRouted (multi-DEX). SwapRoute = (dex,uniFee,aeroStable,minOut)
ROUTED_ABI = json.loads("""[
  {"inputs":[{"name":"isLong","type":"bool"},{"name":"margin","type":"uint256"},{"name":"flashAmount","type":"uint256"},{"name":"minHealthFactor","type":"uint256"},{"components":[{"name":"dex","type":"uint8"},{"name":"uniFee","type":"uint24"},{"name":"aeroStable","type":"bool"},{"name":"minOut","type":"uint256"}],"name":"route","type":"tuple"}],"name":"openPosition","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"name":"isLong","type":"bool"},{"name":"flashAmount","type":"uint256"},{"components":[{"name":"dex","type":"uint8"},{"name":"uniFee","type":"uint24"},{"name":"aeroStable","type":"bool"},{"name":"minOut","type":"uint256"}],"name":"route","type":"tuple"}],"name":"closePosition","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"accountData","outputs":[{"name":"a","type":"uint256"},{"name":"b","type":"uint256"},{"name":"c","type":"uint256"},{"name":"d","type":"uint256"},{"name":"e","type":"uint256"},{"name":"healthFactor","type":"uint256"}],"stateMutability":"view","type":"function"}
]""")

# QuoterV2.quoteExactInputSingle (struct param) - dipanggil sebagai 'call' (non-view di ABI Uniswap)
QUOTER_ABI = json.loads("""[
  {"inputs":[{"components":[{"name":"tokenIn","type":"address"},{"name":"tokenOut","type":"address"},{"name":"amountIn","type":"uint256"},{"name":"fee","type":"uint24"},{"name":"sqrtPriceLimitX96","type":"uint160"}],"name":"params","type":"tuple"}],"name":"quoteExactInputSingle","outputs":[{"name":"amountOut","type":"uint256"},{"name":"sqrtPriceX96After","type":"uint160"},{"name":"initializedTicksCrossed","type":"uint32"},{"name":"gasEstimate","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}
]""")


class BaseChainClient:
    """Wrapper Web3 untuk Base + helper transaksi ke LeverageFlashLoan."""

    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
        # Base adalah OP-stack chain -> inject POA middleware agar block parsing tidak error
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if not self.w3.is_connected():
            raise ConnectionError(f"Gagal konek ke RPC Base: {settings.rpc_url}")

        self.account = self.w3.eth.account.from_key(settings.private_key)
        self.address = self.account.address
        self.addr = settings.addresses

        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.addr["usdc"]), abi=ERC20_ABI
        )
        self.weth = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.addr["weth"]), abi=ERC20_ABI
        )
        self.quoter = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.addr["uniswap_quoter_v2"]), abi=QUOTER_ABI
        )

        self.leverage = None
        self.routed = None
        if settings.contract_address:
            addr = Web3.to_checksum_address(settings.contract_address)
            # bind kedua ABI ke alamat yang sama; pakai .routed kalau deploy versi multi-DEX
            self.leverage = self.w3.eth.contract(address=addr, abi=LEVERAGE_ABI)
            self.routed = self.w3.eth.contract(address=addr, abi=ROUTED_ABI)

    # ----------------------------------------------------------------- #
    #  Transaksi util
    # ----------------------------------------------------------------- #
    def _send(self, fn) -> str:
        """Build, sign, kirim sebuah ContractFunction dan tunggu receipt."""
        tx = fn.build_transaction(
            {
                "from": self.address,
                "nonce": self.w3.eth.get_transaction_count(self.address),
                "chainId": self.addr["chain_id"],
                # Base murah; tetap pakai EIP-1559
                "maxFeePerGas": self.w3.eth.gas_price * 2,
                "maxPriorityFeePerGas": self.w3.to_wei(0.001, "gwei"),
            }
        )
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt.status != 1:
            raise RuntimeError(f"Transaksi revert: {tx_hash.hex()}")
        return tx_hash.hex()

    # ----------------------------------------------------------------- #
    #  Quote harga (untuk hitung minSwapOut dengan slippage guard)
    # ----------------------------------------------------------------- #
    def quote_exact_in(self, token_in: str, token_out: str, amount_in: int, fee: int) -> int:
        """Return amountOut estimasi dari Uniswap V3 QuoterV2 (dipanggil via .call())."""
        params = (
            Web3.to_checksum_address(token_in),
            Web3.to_checksum_address(token_out),
            amount_in,
            fee,
            0,
        )
        out = self.quoter.functions.quoteExactInputSingle(params).call()
        return out[0]  # amountOut

    def min_out_with_slippage(self, amount_out: int) -> int:
        """Terapkan toleransi slippage (bps) ke estimasi output."""
        return amount_out * (10_000 - settings.slippage_bps) // 10_000

    # ----------------------------------------------------------------- #
    #  Approve margin
    # ----------------------------------------------------------------- #
    def approve_margin(self, amount: int) -> Optional[str]:
        """Approve contract LeverageFlashLoan untuk menarik margin USDC."""
        spender = Web3.to_checksum_address(settings.contract_address)
        current = self.usdc.functions.allowance(self.address, spender).call()
        if current >= amount:
            return None
        return self._send(self.usdc.functions.approve(spender, amount))

    # ----------------------------------------------------------------- #
    #  Open / Close
    # ----------------------------------------------------------------- #
    def open_position(
        self,
        is_long: bool,
        margin: int,
        flash_amount: int,
        min_swap_out: int,
        min_health_factor: int,
        use_aave: bool = False,
        pool_fee: Optional[int] = None,
    ) -> str:
        pool_fee = pool_fee or settings.default_pool_fee
        fn = self.leverage.functions.openPosition(
            is_long, use_aave, margin, flash_amount, min_swap_out, pool_fee, min_health_factor
        )
        return self._send(fn)

    def close_position(
        self,
        is_long: bool,
        flash_amount: int,
        min_swap_out: int,
        use_aave: bool = False,
        pool_fee: Optional[int] = None,
    ) -> str:
        pool_fee = pool_fee or settings.default_pool_fee
        fn = self.leverage.functions.closePosition(
            is_long, use_aave, flash_amount, min_swap_out, pool_fee
        )
        return self._send(fn)

    # ----------------------------------------------------------------- #
    #  Open / Close versi MULTI-DEX (LeverageFlashLoanRouted)
    #  `route` = tuple (dex, uni_fee, aero_stable, min_out) dari dex_optimizer
    # ----------------------------------------------------------------- #
    def open_position_routed(
        self,
        is_long: bool,
        margin: int,
        flash_amount: int,
        min_health_factor: int,
        route: tuple,
    ) -> str:
        fn = self.routed.functions.openPosition(
            is_long, margin, flash_amount, min_health_factor, route
        )
        return self._send(fn)

    def close_position_routed(self, is_long: bool, flash_amount: int, route: tuple) -> str:
        fn = self.routed.functions.closePosition(is_long, flash_amount, route)
        return self._send(fn)

    # ----------------------------------------------------------------- #
    #  Baca posisi
    # ----------------------------------------------------------------- #
    def get_account_data(self) -> dict:
        d = self.leverage.functions.accountData().call()
        return {
            "total_collateral_base": d[0],
            "total_debt_base": d[1],
            "available_borrows_base": d[2],
            "liquidation_threshold_bps": d[3],
            "ltv_bps": d[4],
            "health_factor": d[5] / 1e18,  # 1e18 = 1.0
        }
