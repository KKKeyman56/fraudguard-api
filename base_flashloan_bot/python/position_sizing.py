"""
position_sizing.py
==================
FUNGSI: Menerjemahkan MacroResult (arah + conviction) menjadi UKURAN POSISI
konkret: berapa margin USDC dipakai dan berapa leverage — meniru lapisan
"position sizing" gcr_bot, tapi dengan plafon leverage yang dijamin lolos
risk_check (buffer >= 15%).

Prinsip:
  - Fractional sizing: margin = equity * risk_fraction * confidence
    (makin yakin -> makin besar; flat/low-conf -> tidak entry).
  - Volatility targeting: leverage diturunkan saat volatilitas tinggi.
  - Plafon keras: leverage <= max_safe_leverage(buffer 15%) DAN <= max_leverage.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from config import settings
from macro_score import MacroResult
from risk_check import assess_position, max_safe_leverage


@dataclass
class SizingResult:
    enter: bool
    direction: str          # 'long' / 'short'
    margin_usd: float
    leverage: float
    liquidation_price: float
    margin_of_safety: float
    reason: str


class PositionSizer:
    def __init__(
        self,
        risk_fraction: float = 0.25,   # porsi equity maksimum dipakai per trade
        min_margin_usd: float = 50.0,  # di bawah ini, friksi > profit (lihat README)
        base_leverage: float = 2.0,
        max_leverage: float = 4.0,
        target_volatility: float = 0.02,  # vol acuan; vol > ini -> leverage dipangkas
    ):
        self.risk_fraction = risk_fraction
        self.min_margin_usd = min_margin_usd
        self.base_leverage = base_leverage
        self.max_leverage = max_leverage
        self.target_vol = target_volatility

    def size(
        self,
        macro: MacroResult,
        equity_usd: float,
        entry_price: float,
        liq_threshold: Optional[float] = None,
        buffer_target: Optional[float] = None,
    ) -> SizingResult:
        buffer_target = (
            settings.min_margin_of_safety if buffer_target is None else buffer_target
        )

        if macro.direction == "flat":
            return SizingResult(False, "flat", 0, 0, 0, 0,
                                f"Macro FLAT (score {macro.score:+.2f}, conf {macro.confidence:.2f})")

        is_long = macro.direction == "long"
        if liq_threshold is None:
            liq_threshold = (
                settings.liq_threshold_weth if is_long else settings.liq_threshold_usdc
            )

        # --- margin: fraksi equity diskala conviction ---
        margin = equity_usd * self.risk_fraction * macro.confidence
        if margin < self.min_margin_usd:
            return SizingResult(False, macro.direction, 0, 0, 0, 0,
                                f"Margin ${margin:.0f} < minimum ${self.min_margin_usd:.0f}")

        # --- leverage: base diskala conviction, dipangkas volatilitas ---
        lev = self.base_leverage * (0.5 + macro.confidence)            # conviction
        if macro.volatility > self.target_vol:
            lev *= self.target_vol / macro.volatility                  # vol targeting

        # --- plafon keras: jangan lampaui leverage yang aman utk buffer 15% ---
        lev_cap = max_safe_leverage(is_long, buffer_target, liq_threshold)
        lev = max(1.01, min(lev, self.max_leverage, lev_cap))

        # --- validasi akhir lewat risk_check ---
        flash = margin * (lev - 1)
        risk = assess_position(is_long, entry_price, margin, flash, liq_threshold, buffer_target)
        if not risk.approved:
            # fallback: turunkan tepat ke cap aman
            lev = max(1.01, lev_cap * 0.99)
            flash = margin * (lev - 1)
            risk = assess_position(is_long, entry_price, margin, flash, liq_threshold, buffer_target)
            if not risk.approved:
                return SizingResult(False, macro.direction, 0, 0, 0, 0,
                                    f"Tak ada leverage aman: {risk.reason}")

        return SizingResult(
            enter=True, direction=macro.direction, margin_usd=round(margin, 2),
            leverage=round(lev, 3), liquidation_price=risk.liquidation_price,
            margin_of_safety=risk.margin_of_safety,
            reason=(f"{macro.direction.upper()} margin ${margin:.0f} x{lev:.2f} "
                    f"(conf {macro.confidence:.2f}, buffer {risk.margin_of_safety:.1%})"),
        )


if __name__ == "__main__":
    from macro_score import MacroScorer
    up = [3000 + i * 8 for i in range(40)]
    m = MacroScorer().score(up)
    s = PositionSizer().size(m, equity_usd=1000, entry_price=up[-1])
    print(s.reason, "| enter:", s.enter, "| liq:", round(s.liquidation_price, 2))
