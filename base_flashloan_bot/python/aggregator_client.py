"""
aggregator_client.py
====================
FUNGSI: Ambil quote + KALLDATA swap dari DEX aggregator (0x / 1inch) di Base,
untuk dieksekusi di dalam flash-loan callback contract (SwapRoute dex=4).
Aggregator unggul untuk SPLIT ROUTING size besar (banyak pool/DEX sekaligus)
yang tak bisa ditiru optimizer single-pool buatan sendiri.

KEAMANAN:
  - `target` (tx.to) HARUS sudah di-whitelist di contract via setAggregator().
  - calldata di-generate dengan taker/receiver = ALAMAT CONTRACT (bukan EOA),
    supaya hasil swap masuk ke contract dan bisa lanjut supply ke Aave.
  - contract tetap verifikasi output via balance-delta >= minOut (anti-rugi).

Butuh network keluar + API key (0x: header `0x-api-key`; 1inch: Bearer token).
Modul ini OPSIONAL: kalau requests/env tak ada, fungsi return None -> bot
fallback ke optimizer on-chain.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

try:
    import requests
except ImportError:
    requests = None

CHAIN_ID = 8453  # Base mainnet


@dataclass
class AggQuote:
    source: str        # '0x' / '1inch'
    amount_out: int    # buyAmount (wei token-out)
    target: str        # tx.to = call target & approve spender (wajib di-whitelist)
    calldata: str      # hex '0x...'


def get_0x_quote(sell_token, buy_token, sell_amount, taker) -> Optional[AggQuote]:
    """0x Swap API v2 (allowance-holder). taker = alamat contract penerima."""
    if requests is None:
        return None
    api_key = os.getenv("ZEROX_API_KEY", "")
    if not api_key:
        return None
    try:
        r = requests.get(
            "https://api.0x.org/swap/allowance-holder/quote",
            params={
                "chainId": CHAIN_ID,
                "sellToken": sell_token,
                "buyToken": buy_token,
                "sellAmount": str(sell_amount),
                "taker": taker,
            },
            headers={"0x-api-key": api_key, "0x-version": "v2"},
            timeout=8,
        )
        r.raise_for_status()
        d = r.json()
        tx = d["transaction"]
        return AggQuote("0x", int(d["buyAmount"]), tx["to"], tx["data"])
    except Exception:
        return None


def get_1inch_quote(sell_token, buy_token, sell_amount, taker, slippage=0.5) -> Optional[AggQuote]:
    """1inch Swap API v6. taker = alamat contract (from). disableEstimate=true."""
    if requests is None:
        return None
    api_key = os.getenv("ONEINCH_API_KEY", "")
    if not api_key:
        return None
    try:
        r = requests.get(
            f"https://api.1inch.dev/swap/v6.0/{CHAIN_ID}/swap",
            params={
                "src": sell_token,
                "dst": buy_token,
                "amount": str(sell_amount),
                "from": taker,
                "origin": taker,
                "slippage": slippage,
                "disableEstimate": "true",
            },
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=8,
        )
        r.raise_for_status()
        d = r.json()
        return AggQuote("1inch", int(d["dstAmount"]), d["tx"]["to"], d["tx"]["data"])
    except Exception:
        return None


def best_aggregator_quote(sell_token, buy_token, sell_amount, taker) -> Optional[AggQuote]:
    """Coba 0x & 1inch, kembalikan output terbesar (atau None kalau dua-duanya gagal)."""
    cands = [
        get_0x_quote(sell_token, buy_token, sell_amount, taker),
        get_1inch_quote(sell_token, buy_token, sell_amount, taker),
    ]
    cands = [c for c in cands if c is not None and c.amount_out > 0]
    if not cands:
        return None
    return max(cands, key=lambda c: c.amount_out)
