"""
risk_check.py
=============
FUNGSI: Modul risk management OFF-CHAIN. Sebelum mengirim transaksi entry,
modul ini menghitung HARGA LIKUIDASI dan MARGIN OF SAFETY (buffer) sebuah
posisi terungkit, lalu MENOLAK trade kalau buffer di bawah ambang (default 15%).

Ini lapisan pertahanan pertama; safety check di smart contract (health factor)
adalah pertahanan kedua yang bersifat atomik on-chain.

Model matematis (HF Aave = 1 saat likuidasi):
  LONG  (collateral WETH, debt USDC):
      P_liq = P * (L-1) / (L * LT)
      buffer = (P - P_liq)/P = 1 - (L-1)/(L*LT)
  SHORT (collateral USDC, debt WETH):
      P_liq = P * L * LT / (L-1)
      buffer = (P_liq - P)/P = (L*LT)/(L-1) - 1
  dengan:
      P  = harga WETH/USDC saat ini
      L  = leverage = (margin + flash) / margin
      LT = liquidation threshold aset collateral (0..1)
"""

from __future__ import annotations

from dataclasses import dataclass

from config import settings


@dataclass
class RiskAssessment:
    is_long: bool
    entry_price: float          # harga WETH/USDC saat entry
    leverage: float
    liquidation_price: float
    margin_of_safety: float     # fraksi, mis. 0.22 = 22%
    liq_threshold: float
    collateral_value_usd: float
    debt_value_usd: float
    approved: bool
    reason: str


def assess_position(
    is_long: bool,
    entry_price: float,
    margin_usd: float,
    flash_usd: float,
    liq_threshold: float | None = None,
    min_margin_of_safety: float | None = None,
) -> RiskAssessment:
    """
    Hitung liquidation price + buffer dan putuskan approve/reject.

    margin_usd : modal sendiri (USDC) dalam satuan USD.
    flash_usd  : nilai flash loan dalam satuan USD (USDC untuk long, WETH*P untuk short).
    """
    min_buffer = (
        settings.min_margin_of_safety if min_margin_of_safety is None else min_margin_of_safety
    )

    # LONG -> collateral WETH; SHORT -> collateral USDC
    if liq_threshold is None:
        liq_threshold = settings.liq_threshold_weth if is_long else settings.liq_threshold_usdc

    if margin_usd <= 0:
        return _reject(is_long, entry_price, liq_threshold, "Margin harus > 0")

    leverage = (margin_usd + flash_usd) / margin_usd
    collateral_value = margin_usd + flash_usd
    debt_value = flash_usd

    if leverage <= 1.0:
        return _reject(is_long, entry_price, liq_threshold,
                       "Leverage <= 1x: tidak ada flash loan, tak perlu modul ini")

    if is_long:
        liq_price = entry_price * (leverage - 1) / (leverage * liq_threshold)
        buffer = (entry_price - liq_price) / entry_price
    else:
        liq_price = entry_price * leverage * liq_threshold / (leverage - 1)
        buffer = (liq_price - entry_price) / entry_price

    approved = buffer >= min_buffer
    reason = (
        f"OK: buffer {buffer:.1%} >= minimum {min_buffer:.0%}"
        if approved
        else f"REJECT: buffer {buffer:.1%} < minimum {min_buffer:.0%} (terlalu dekat likuidasi)"
    )

    return RiskAssessment(
        is_long=is_long,
        entry_price=entry_price,
        leverage=leverage,
        liquidation_price=liq_price,
        margin_of_safety=buffer,
        liq_threshold=liq_threshold,
        collateral_value_usd=collateral_value,
        debt_value_usd=debt_value,
        approved=approved,
        reason=reason,
    )


def suggested_min_health_factor(margin_of_safety_target: float = 0.15) -> int:
    """
    Konversi target buffer -> minHealthFactor (1e18) untuk dikirim ke contract.
    Pendekatan konservatif: HF_min ~ 1 / (1 - target). Mis. target 15% -> ~1.176.
    """
    hf = 1.0 / max(1e-6, (1.0 - margin_of_safety_target))
    return int(hf * 1e18)


def max_safe_leverage(is_long: bool, buffer_target: float, liq_threshold: float) -> float:
    """
    Leverage maksimum yang MASIH menjaga margin-of-safety >= buffer_target.
    Diturunkan dari rumus buffer di assess_position():
      LONG  : buffer = 1 - (L-1)/(L*LT)  ->  L_max = 1 / (1 - (1-B)*LT)
      SHORT : buffer = (L*LT)/(L-1) - 1  ->  L_max = (1+B) / ((1+B) - LT)
    Position sizer pakai ini sebagai plafon leverage supaya trade tak ditolak risk.
    """
    B, LT = buffer_target, liq_threshold
    if is_long:
        denom = 1.0 - (1.0 - B) * LT
    else:
        denom = (1.0 + B) - LT
    if denom <= 0:
        return 1.0
    return max(1.0, (1.0 if is_long else (1.0 + B)) / denom)



def _reject(is_long, price, lt, msg) -> RiskAssessment:
    return RiskAssessment(
        is_long=is_long,
        entry_price=price,
        leverage=0.0,
        liquidation_price=0.0,
        margin_of_safety=0.0,
        liq_threshold=lt,
        collateral_value_usd=0.0,
        debt_value_usd=0.0,
        approved=False,
        reason=msg,
    )


# Contoh manual run
if __name__ == "__main__":
    a = assess_position(is_long=True, entry_price=3500.0, margin_usd=1000, flash_usd=2000)
    print(a.reason, "| liq price:", round(a.liquidation_price, 2), "| lev:", round(a.leverage, 2))
