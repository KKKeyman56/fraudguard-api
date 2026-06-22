"""
config.py
=========
FUNGSI: Pusat konfigurasi untuk bot leverage flash loan di BASE chain.
Semua alamat kontrak resmi Base mainnet/Sepolia, parameter RPC, dan
parameter risk default dikumpulkan di sini supaya modul lain tidak perlu
hardcode address. Nilai sensitif (private key, RPC key) diambil dari .env.

CATATAN: alamat di bawah sudah diverifikasi di BaseScan (Juni 2026).
JANGAN deploy dengan address salah -> bisa kehilangan dana.
"""

import os
from dataclasses import dataclass, field

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv opsional; env bisa di-set lewat shell
    pass

# --------------------------------------------------------------------------- #
#  Alamat kontrak resmi BASE MAINNET (chainId 8453) - verified di BaseScan
# --------------------------------------------------------------------------- #
BASE_MAINNET = {
    "chain_id": 8453,
    # Aave V3
    "aave_pool": "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",          # Pool proxy
    "aave_pool_addresses_provider": "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D",
    # CATATAN: AaveProtocolDataProvider BELUM diverifikasi & TIDAK dipakai kode ini.
    # Kalau perlu, baca dari PoolAddressesProvider.getPoolDataProvider() on-chain.
    "aave_data_provider": "",  # isi setelah verifikasi di BaseScan / Aave Address Book
    # Balancer V2 (flash loan fee 0%)
    "balancer_vault": "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    # Uniswap V3
    "uniswap_router02": "0x2626664c2603336E57B271c5C0b26F421741e481",   # SwapRouter02
    "uniswap_quoter_v2": "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",  # QuoterV2
    # Aerodrome (Solidly-fork) - verified di BaseScan
    "aerodrome_router": "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    "aerodrome_factory": "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",  # PoolFactory
    # BaseSwap (UniswapV2-fork) - verified di BaseScan
    "baseswap_router": "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86",
    # SushiSwap di Base routing-nya via RouteProcessor/API, BUKAN router UniV2 klasik.
    # Kosongkan -> adapter Sushi non-aktif. Isi hanya kalau sudah verifikasi sendiri.
    "sushiswap_router": "",
    # Token
    "weth": "0x4200000000000000000000000000000000000006",
    "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",               # USDC native
}

# --------------------------------------------------------------------------- #
#  BASE SEPOLIA TESTNET (chainId 84532) - selalu test di sini dulu!
#  NB: di testnet likuiditas Uniswap/Aave bisa sangat tipis. Beberapa address
#      berbeda; isi sesuai deployment yang kamu pakai sebelum testing.
# --------------------------------------------------------------------------- #
BASE_SEPOLIA = {
    "chain_id": 84532,
    "aave_pool": "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b",
    "aave_pool_addresses_provider": "0xd449FeD49d9C443688d6816fE6872F21402e41de",
    "balancer_vault": "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    "uniswap_router02": "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    "uniswap_quoter_v2": "0xC5290058841028F1614F3A6F0F5816cAd0df5E27",
    # Aerodrome/BaseSwap umumnya TIDAK ada / tidak likuid di Sepolia.
    # Kosongkan -> optimizer praktis hanya pakai Uniswap V3 di testnet.
    "aerodrome_router": "",
    "aerodrome_factory": "",
    "baseswap_router": "",
    "sushiswap_router": "",
    "weth": "0x4200000000000000000000000000000000000006",
    "usdc": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
}


@dataclass
class Settings:
    """Konfigurasi runtime yang dirakit dari environment + tabel address."""

    network: str = os.getenv("NETWORK", "base-sepolia")  # 'base' atau 'base-sepolia'
    rpc_url: str = os.getenv("BASE_RPC_URL", "https://sepolia.base.org")
    private_key: str = os.getenv("PRIVATE_KEY", "")
    # alamat contract LeverageFlashLoan setelah deploy (diisi otomatis oleh deploy.py)
    contract_address: str = os.getenv("LEVERAGE_CONTRACT", "")

    # ---- parameter risk default ----
    min_margin_of_safety: float = float(os.getenv("MIN_MARGIN_OF_SAFETY", "0.15"))  # 15%
    slippage_bps: int = int(os.getenv("SLIPPAGE_BPS", "50"))     # 0.50% slippage swap
    default_pool_fee: int = int(os.getenv("UNISWAP_POOL_FEE", "500"))  # 0.05% tier

    # liquidation threshold Aave (1e4 = 100%). WETH ~0.83, USDC ~0.86 di Base.
    # idealnya dibaca on-chain via AaveProtocolDataProvider; ini fallback statis.
    liq_threshold_weth: float = float(os.getenv("LIQ_THRESHOLD_WETH", "0.83"))
    liq_threshold_usdc: float = float(os.getenv("LIQ_THRESHOLD_USDC", "0.86"))

    db_path: str = os.getenv("DB_PATH", "leverage_trades.db")

    # ---- aggregator (1inch/0x) opsional untuk split-routing size besar ----
    use_aggregator: bool = os.getenv("USE_AGGREGATOR", "false").lower() == "true"
    # router yang di-whitelist on-chain (call target = approve spender):
    #   1inch AggregationRouterV6 (Base): 0x111111125421cA6dc452d289314280a0f8842A65
    #   0x AllowanceHolder (Base)       : 0x0000000000001fF3684f28c67538d4D072C22734

    # ---- monitor / auto-deleverage ----
    hf_warn: float = float(os.getenv("HF_WARN", "1.30"))        # peringatan
    hf_action: float = float(os.getenv("HF_ACTION", "1.15"))    # ambil tindakan (close)
    monitor_interval: int = int(os.getenv("MONITOR_INTERVAL", "30"))  # detik

    addresses: dict = field(default_factory=dict)

    def __post_init__(self):
        self.addresses = BASE_MAINNET if self.network == "base" else BASE_SEPOLIA

    @property
    def is_mainnet(self) -> bool:
        return self.network == "base"


# instance global yang dipakai modul lain
settings = Settings()
