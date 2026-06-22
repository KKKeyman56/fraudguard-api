"""
dex_optimizer.py
================
FUNGSI: Engine perbandingan DEX real-time di BASE chain. Sebelum tiap swap,
modul ini mem-query expected output untuk input yang sama di banyak DEX
SECARA PARALEL, lalu memilih yang outputnya TERBESAR (= fee + slippage
terendah). Hasilnya berupa `RouteQuote` yang dipakai contract_interface.py
untuk membentuk `SwapRoute` on-chain (dex id, fee tier, stable flag, minOut).

DEX yang dibandingkan:
  - Uniswap V3  : QuoterV2.quoteExactInputSingle untuk tiap fee tier (500/3000/10000)
  - Aerodrome   : Router.getAmountsOut untuk volatile pool & stable pool
  - BaseSwap    : Router.getAmountsOut (UniswapV2-style)
  - SushiSwap   : opsional (adapter UniV2) - aktif kalau alamat router diisi

Fitur:
  - Paralel via ThreadPoolExecutor (call Web3 bersifat blocking I/O).
  - Cache 3 detik per (tokenIn, tokenOut, amountIn) supaya tidak spam RPC.
  - Estimasi slippage/price-impact via probe amount kecil (mid price).

CATATAN: identitas DEX (DEX_UNIV3=0, dst) HARUS sinkron dengan konstanta di
LeverageFlashLoanRouted.sol.
"""

from __future__ import annotations

import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Optional

from web3 import Web3

from config import settings

# --- identitas DEX (sinkron dgn contract) ---
DEX_UNIV3 = 0
DEX_AERO = 1
DEX_BASESWAP = 2
DEX_SUSHI = 3
DEX_NAME = {0: "uniswap_v3", 1: "aerodrome", 2: "baseswap", 3: "sushiswap"}

UNIV3_FEE_TIERS = [500, 3000, 10000]  # 0.05% / 0.3% / 1%

# --------------------------------------------------------------------------- #
#  ABI minimal
# --------------------------------------------------------------------------- #
QUOTER_ABI = json.loads("""[
  {"inputs":[{"components":[{"name":"tokenIn","type":"address"},{"name":"tokenOut","type":"address"},{"name":"amountIn","type":"uint256"},{"name":"fee","type":"uint24"},{"name":"sqrtPriceLimitX96","type":"uint160"}],"name":"params","type":"tuple"}],"name":"quoteExactInputSingle","outputs":[{"name":"amountOut","type":"uint256"},{"name":"a","type":"uint160"},{"name":"b","type":"uint32"},{"name":"c","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}
]""")

AERO_ROUTER_ABI = json.loads("""[
  {"inputs":[{"name":"amountIn","type":"uint256"},{"components":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"stable","type":"bool"},{"name":"factory","type":"address"}],"name":"routes","type":"tuple[]"}],"name":"getAmountsOut","outputs":[{"name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"}
]""")

UNIV2_ROUTER_ABI = json.loads("""[
  {"inputs":[{"name":"amountIn","type":"uint256"},{"name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"}
]""")


@dataclass
class Quote:
    dex_id: int
    dex_name: str
    amount_out: int
    uni_fee: int = 0          # fee tier (UniV3)
    aero_stable: bool = False  # stable pool? (Aerodrome)
    ok: bool = True
    error: str = ""


@dataclass
class RouteQuote:
    """Hasil akhir optimizer: rute terbaik + metadata untuk eksekusi & logging."""
    token_in: str
    token_out: str
    amount_in: int
    best: Quote
    all_quotes: list = field(default_factory=list)
    slippage_estimate: float = 0.0  # price impact fraksi (mis. 0.004 = 0.4%)

    def min_out(self, slippage_bps: Optional[int] = None) -> int:
        bps = settings.slippage_bps if slippage_bps is None else slippage_bps
        return self.best.amount_out * (10_000 - bps) // 10_000


class DexOptimizer:
    def __init__(self, w3: Web3):
        self.w3 = w3
        a = settings.addresses
        self.quoter = w3.eth.contract(
            address=Web3.to_checksum_address(a["uniswap_quoter_v2"]), abi=QUOTER_ABI
        )
        # Adapter dibuat hanya kalau alamatnya terisi (Sepolia biasanya kosong).
        self.aero = None
        self.aero_factory = None
        if a.get("aerodrome_router") and a.get("aerodrome_factory"):
            self.aero = w3.eth.contract(
                address=Web3.to_checksum_address(a["aerodrome_router"]), abi=AERO_ROUTER_ABI
            )
            self.aero_factory = Web3.to_checksum_address(a["aerodrome_factory"])
        self.baseswap = None
        if a.get("baseswap_router"):
            self.baseswap = w3.eth.contract(
                address=Web3.to_checksum_address(a["baseswap_router"]), abi=UNIV2_ROUTER_ABI
            )
        self.sushi = None
        if a.get("sushiswap_router"):
            self.sushi = w3.eth.contract(
                address=Web3.to_checksum_address(a["sushiswap_router"]), abi=UNIV2_ROUTER_ABI
            )

        # cache: key -> (timestamp, RouteQuote)
        self._cache: dict = {}
        self._cache_ttl = 3.0  # detik
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ #
    #  Quote per-DEX (dipanggil paralel)
    # ------------------------------------------------------------------ #
    def _q_univ3(self, token_in, token_out, amount_in, fee) -> Quote:
        try:
            params = (
                Web3.to_checksum_address(token_in),
                Web3.to_checksum_address(token_out),
                amount_in, fee, 0,
            )
            out = self.quoter.functions.quoteExactInputSingle(params).call()
            return Quote(DEX_UNIV3, "uniswap_v3", out[0], uni_fee=fee)
        except Exception as e:  # pool fee tier ini mungkin tidak ada
            return Quote(DEX_UNIV3, "uniswap_v3", 0, uni_fee=fee, ok=False, error=str(e)[:80])

    def _q_aero(self, token_in, token_out, amount_in, stable) -> Quote:
        try:
            route = [(
                Web3.to_checksum_address(token_in),
                Web3.to_checksum_address(token_out),
                stable, self.aero_factory,
            )]
            amounts = self.aero.functions.getAmountsOut(amount_in, route).call()
            return Quote(DEX_AERO, "aerodrome", amounts[-1], aero_stable=stable)
        except Exception as e:
            return Quote(DEX_AERO, "aerodrome", 0, aero_stable=stable, ok=False, error=str(e)[:80])

    def _q_univ2(self, contract, dex_id, dex_name, token_in, token_out, amount_in) -> Quote:
        try:
            path = [Web3.to_checksum_address(token_in), Web3.to_checksum_address(token_out)]
            amounts = contract.functions.getAmountsOut(amount_in, path).call()
            return Quote(dex_id, dex_name, amounts[-1])
        except Exception as e:
            return Quote(dex_id, dex_name, 0, ok=False, error=str(e)[:80])

    # ------------------------------------------------------------------ #
    #  Quote semua DEX paralel + pilih terbaik
    # ------------------------------------------------------------------ #
    def best_route(self, token_in: str, token_out: str, amount_in: int) -> RouteQuote:
        key = (token_in.lower(), token_out.lower(), amount_in)
        now = time.time()
        with self._lock:
            cached = self._cache.get(key)
            if cached and now - cached[0] < self._cache_ttl:
                return cached[1]

        # daftar tugas quote
        tasks = []
        with ThreadPoolExecutor(max_workers=10) as ex:
            for fee in UNIV3_FEE_TIERS:
                tasks.append(ex.submit(self._q_univ3, token_in, token_out, amount_in, fee))
            if self.aero is not None:
                for stable in (False, True):
                    tasks.append(ex.submit(self._q_aero, token_in, token_out, amount_in, stable))
            if self.baseswap is not None:
                tasks.append(ex.submit(self._q_univ2, self.baseswap, DEX_BASESWAP, "baseswap",
                                       token_in, token_out, amount_in))
            if self.sushi is not None:
                tasks.append(ex.submit(self._q_univ2, self.sushi, DEX_SUSHI, "sushiswap",
                                       token_in, token_out, amount_in))

            quotes = [t.result() for t in as_completed(tasks)]

        valid = [q for q in quotes if q.ok and q.amount_out > 0]
        if not valid:
            raise RuntimeError(f"Tidak ada DEX yang memberi quote untuk {token_in}->{token_out}")

        best = max(valid, key=lambda q: q.amount_out)
        slippage = self._estimate_impact(token_in, token_out, amount_in, best)

        rq = RouteQuote(
            token_in=token_in, token_out=token_out, amount_in=amount_in,
            best=best, all_quotes=quotes, slippage_estimate=slippage,
        )
        with self._lock:
            self._cache[key] = (now, rq)
        return rq

    # ------------------------------------------------------------------ #
    #  Estimasi price impact: bandingkan rate ukuran-penuh vs probe kecil
    # ------------------------------------------------------------------ #
    def _estimate_impact(self, token_in, token_out, amount_in, best: Quote) -> float:
        """impact = 1 - (rate_full / rate_mid); rate = out/in. Pakai DEX terbaik."""
        try:
            probe = max(1, amount_in // 1000)  # 0.1% dari size untuk dekati mid price
            if best.dex_id == DEX_UNIV3:
                mid = self._q_univ3(token_in, token_out, probe, best.uni_fee)
            elif best.dex_id == DEX_AERO:
                mid = self._q_aero(token_in, token_out, probe, best.aero_stable)
            elif best.dex_id == DEX_BASESWAP:
                mid = self._q_univ2(self.baseswap, DEX_BASESWAP, "baseswap", token_in, token_out, probe)
            else:
                mid = self._q_univ2(self.sushi, DEX_SUSHI, "sushiswap", token_in, token_out, probe)
            if not mid.ok or mid.amount_out == 0:
                return 0.0
            rate_full = best.amount_out / amount_in
            rate_mid = mid.amount_out / probe
            impact = 1.0 - (rate_full / rate_mid)
            return max(0.0, impact)
        except Exception:
            return 0.0


# Contoh manual: bandingkan 1000 USDC -> WETH
if __name__ == "__main__":
    from web3 import Web3 as _W3
    from web3.middleware import ExtraDataToPOAMiddleware

    w3 = _W3(_W3.HTTPProvider(settings.rpc_url))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    opt = DexOptimizer(w3)
    rq = opt.best_route(settings.addresses["usdc"], settings.addresses["weth"], 1000 * 10**6)
    print("BEST:", DEX_NAME[rq.best.dex_id], "out:", rq.best.amount_out,
          "fee:", rq.best.uni_fee, "stable:", rq.best.aero_stable,
          "impact:", f"{rq.slippage_estimate:.2%}")
    for q in sorted(rq.all_quotes, key=lambda x: -x.amount_out):
        print(f"  {q.dex_name:12} out={q.amount_out:>22} ok={q.ok} {q.error}")
