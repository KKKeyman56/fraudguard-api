# Base Flash-Loan Leverage Bot

Leveraged directional trading (long/short WETH vs USDC) on **Base** using a
single atomic **flash loan** + **Aave V3** lending + **Uniswap V3** swaps.

> ⚠️ **Educational / personal trading tooling.** Flash-loan leverage can be
> liquidated. Test on **Base Sepolia** first. Audit before mainnet. Use a
> dedicated bot wallet — never your main wallet's key.

---

## Struktur

```
base_flashloan_bot/
├── contracts/
│   └── LeverageFlashLoan.sol     # contract atomik: flash loan + leverage loop + safety check
└── python/
    ├── config.py                 # alamat Base (verified), RPC, parameter risk
    ├── contract_interface.py     # lapisan Web3.py (deploy/open/close/quote/read)
    ├── risk_check.py             # liquidation price + margin-of-safety, reject < 15%
    ├── logger.py                 # SQLite: catat setiap entry
    ├── deploy.py                 # compile (solcx) + deploy ke Base
    ├── run_bot.py                # orchestrator: harga -> risk -> open -> log
    └── requirements.txt
```

## Quickstart

```bash
cd base_flashloan_bot/python
pip install -r requirements.txt
cp ../.env.example ../.env        # isi PRIVATE_KEY, BASE_RPC_URL, NETWORK
NETWORK=base-sepolia python deploy.py          # deploy testnet -> simpan LEVERAGE_CONTRACT
# isi LEVERAGE_CONTRACT di .env, lalu:
python run_bot.py
```

---

## Alamat resmi Base mainnet (chainId 8453)

| Kontrak | Address | Status |
|---|---|---|
| Aave V3 `Pool` (proxy) | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | ✅ verified di BaseScan |
| Aave V3 `PoolAddressesProvider` | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` | ✅ verified |
| Balancer V2 `Vault` (flash loan **fee 0%**) | `0xBA12222222228d8Ba445958a75a0704d566BF2C8` | ✅ ada di Base |
| Uniswap V3 `SwapRouter02` | `0x2626664c2603336E57B271c5C0b26F421741e481` | ✅ verified |
| Uniswap V3 `QuoterV2` | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | ✅ verified |
| WETH | `0x4200000000000000000000000000000000000006` | ✅ |
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | ✅ |

> Alamat **Base Sepolia** di `config.py` bersifat best-effort — **verifikasi
> ulang di BaseScan Sepolia** sebelum testing; deployment testnet sering berganti
> dan likuiditasnya tipis.

### Pilihan sumber flash loan
- **Balancer V2 Vault** dipakai sebagai **primary** karena fee flash loan = **0%** di Base.
- **Aave V3 `flashLoanSimple`** tersedia sebagai **fallback** (premium ~0.05%) —
  aktifkan dengan `use_aave=True`. Berguna kalau likuiditas token di Balancer Vault
  sedang tidak cukup untuk jumlah yang kamu pinjam.

---

## Kenapa Base, bukan Ethereum mainnet?

1. **Gas fee.** Strategi ini = banyak langkah dalam 1 tx (flash loan + swap +
   supply + borrow + repay), lalu close juga 1 tx penuh. Di Ethereum mainnet
   sekali open/close bisa $20–$80+ saat ramai; di Base biasanya **beberapa sen
   sampai < $0.10**. Untuk modal kecil & sering re-balance, ini selisih hidup-mati.
2. **Finality cepat.** Base (OP-stack) block ~2 detik → entry/exit lebih responsif
   terhadap pergerakan harga, mengurangi waktu posisi "menggantung" tanpa hedge.
3. **Likuiditas Aave/Uniswap sudah live & cukup dalam.** Aave V3 dan Uniswap V3
   keduanya resmi di Base dengan WETH/USDC sebagai pair paling likuid → slippage
   swap & risiko utilization Aave lebih terkendali dibanding chain kecil lain.
4. **Balancer fee 0%** di Base → ongkos flash loan praktis nol, jadi yang tersisa
   tinggal gas (murah) + slippage + bunga Aave.

**Trade-off:** likuiditas Aave/Uniswap di Base **tetap lebih kecil** dari Ethereum
mainnet. Untuk ukuran posisi besar, slippage & borrow-cap Aave bisa menggigit.

### Modal minimum yang masuk akal
- Karena gas Base murah, secara **teknis** modal kecil ($50–$100) sudah jalan.
- Secara **ekonomis**: walau gas murah, kamu tetap bayar **slippage swap** (2x:
  saat open & saat close) + **bunga borrow Aave**. Dengan slippage 0.05–0.3% per
  swap, **modal $200–$500** dengan leverage 2–3x adalah titik di mana biaya
  friksi tidak memakan PnL terlalu besar. Di bawah ~$100 friksi mulai dominan.
- Mulai testnet → mainnet dengan **$50–$100 "uang yang siap hilang"** dulu untuk
  memvalidasi seluruh alur sebelum menaikkan ukuran.

---

## Cara kerja safety (dua lapis)

1. **Off-chain (`risk_check.py`)** — sebelum kirim tx, hitung `liquidation_price`
   dan `margin_of_safety`. Tolak kalau buffer `< 15%` (`MIN_MARGIN_OF_SAFETY`).
   - LONG: `P_liq = P·(L−1)/(L·LT)`
   - SHORT: `P_liq = P·L·LT/(L−1)`
2. **On-chain (`LeverageFlashLoan.sol`)** — setelah posisi terbentuk, contract
   baca `healthFactor` dari Aave dan **revert** kalau `< minHealthFactor`. Karena
   atomik, kalau revert → seluruh tx batal, tidak ada posisi setengah jadi.

---

## ⚠️ Daftar risiko teknis (baca sebelum mainnet)

1. **Smart contract risk.** Contract ini **belum diaudit**. Bug pada urutan
   approve/borrow/repay bisa mengunci dana. Audit + test fork mainnet wajib.
   Posisi Aave dimiliki contract → bug di `rescue`/owner = total loss.
2. **Liquidation risk.** Risiko utama strategi. Buffer 15% bukan jaminan; saat
   volatil tinggi harga bisa lompat menembus `P_liq` sebelum kamu sempat close.
   Pertimbangkan auto-deleverage/monitor health factor terus-menerus.
3. **MEV / sandwich attack.** Swap Uniswap kamu kelihatan di mempool. Bot bisa
   sandwich → kamu beli WETH lebih mahal / jual lebih murah. Mitigasi:
   `minSwapOut` ketat (sudah ada), fee tier likuid (500), pertimbangkan
   private RPC / Flashbots-style submission di Base bila tersedia, dan pecah
   order besar.
4. **Slippage & price impact.** Likuiditas Base < mainnet. Order besar di pool
   fee 0.05% bisa kena impact besar. Selalu quote via `QuoterV2` (sudah) dan
   set `SLIPPAGE_BPS` realistis; uji ukuran sebelum naik.
5. **Likuiditas Aave Base lebih kecil.** Borrow cap & utilization tinggi bisa
   menaikkan bunga borrow tajam atau bahkan menggagalkan `borrow`. Cek
   available liquidity & cap reserve sebelum entry besar.
6. **Oracle / liq-threshold drift.** `LIQ_THRESHOLD_*` di config statis; Aave
   bisa mengubah parameter risk. Idealnya baca on-chain tiap entry.
7. **Flash-loan availability.** Balancer Vault harus punya cukup token untuk
   dipinjam saat itu juga, kalau tidak tx revert → fallback ke Aave (`use_aave=True`).
8. **Quoter ≠ harga eksekusi.** QuoterV2 adalah estimasi; harga aktual saat tx
   bisa beda (itu sebabnya ada `minSwapOut`). Jangan pakai quote sebagai harga final.
9. **Operasional:** private key bocor = dana hilang; RPC publik bisa rate-limit /
   down (pakai Alchemy/Infura untuk produksi); nonce/gas spike bisa bikin tx
   stuck. Pakai wallet bot terpisah berisi dana minimal.

---

## Catatan dependency
- `LeverageFlashLoan.sol` **self-contained** (interface ditulis inline, tanpa
  import OpenZeppelin) → compile dengan solc `0.8.20`, `optimizer runs=200`.
- Helper ERC20 menangani token non-standar (return kosong) dan pola approve
  reset-ke-0.

---

# UPGRADE: Multi-DEX Routing Optimizer

Menambah pemilihan DEX termurah otomatis sebelum tiap swap. Flash loan kini
fokus ke **Aave V3 `flashLoanSimple`** (native Base).

## File baru / berubah
| File | Status | Isi |
|---|---|---|
| `contracts/LeverageFlashLoanRouted.sol` | **baru** | Aave flashLoanSimple + swap multi-DEX (UniV3/Aerodrome/BaseSwap/Sushi) via routing off-chain |
| `python/dex_optimizer.py` | **baru** | bandingkan output semua DEX paralel, cache 3 dtk, pilih terbaik |
| `python/deploy_routed.py` | **baru** | deploy contract versi routed |
| `python/run_bot_routed.py` | **baru** | orchestrator pakai optimizer |
| `python/config.py` | diperbarui | tambah alamat Aerodrome/BaseSwap/Sushi |
| `python/contract_interface.py` | diperbarui | binding + `open_position_routed`/`close_position_routed` |
| `python/logger.py` | diperbarui | kolom `dex_used`, `fee_paid_bps`, `slippage_estimate`, dll (migrasi additive) |

## Alamat DEX Base mainnet (verified BaseScan)
| DEX | Kontrak | Address |
|---|---|---|
| Aerodrome | Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` ✅ |
| Aerodrome | PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` ✅ |
| BaseSwap | Router (UniV2) | `0x327Df1E6de05895d2ab08513aaDD9313Fe505d86` ✅ |
| Uniswap V3 | QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` ✅ |

> **SushiSwap di Base**: routing kanoniknya lewat **RouteProcessor + API**, bukan
> router UniswapV2 klasik. Adapter Sushi dibiarkan **non-aktif** (`sushiswap_router=""`).
> Jangan isi address sembarangan — `getAmountsOut` ke RouteProcessor akan gagal.
> Untuk Sushi, lebih baik pakai jalur API (lihat rekomendasi di bawah).

## Identitas DEX (HARUS sinkron contract ↔ optimizer)
```
0 = Uniswap V3   (pakai fee tier: 500 / 3000 / 10000)
1 = Aerodrome    (stable=false volatile, stable=true stable pool)
2 = BaseSwap     (UniswapV2-style)
3 = SushiSwap    (UniswapV2-style, opsional)
```

## Diagram alur (optimizer ⟶ flash loan)

```
                         OFF-CHAIN (Python)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  run_bot_routed.py                                                     │
 │      │                                                                 │
 │      │ 1. harga & ukuran posisi                                        │
 │      ▼                                                                 │
 │  dex_optimizer.best_route(USDC, WETH, amount)                         │
 │      │   ├─ UniV3 Quoter  (fee 500/3000/10000) ┐                       │
 │      │   ├─ Aerodrome     (volatile + stable)  │  query PARALEL        │
 │      │   ├─ BaseSwap      (getAmountsOut)      │  (ThreadPoolExecutor) │
 │      │   └─ SushiSwap*    (opsional)           ┘  cache 3 dtk          │
 │      ▼                                                                 │
 │  pilih output TERBESAR  ->  RouteQuote{dex, fee/stable, minOut}        │
 │      │                                                                 │
 │      │ 2. risk_check.assess_position()  -> buffer >= 15% ? lanjut      │
 │      ▼                                                                 │
 │  contract_interface.open_position_routed(..., SwapRoute)              │
 └──────┼─────────────────────────────────────────────────────────────-─┘
        │  tx (1 panggilan)
        ▼                         ON-CHAIN (atomik, 1 transaksi)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  LeverageFlashLoanRouted.openPosition()                               │
 │     └─ Aave.flashLoanSimple(USDC) ─► executeOperation():              │
 │            ├─ _swap() ──► DEX terpilih (route dari off-chain)         │
 │            │                 └─ minOut = slippage guard (revert kalau  │
 │            │                    harga sudah bergerak melewati batas)   │
 │            ├─ Aave.supply(WETH)        (collateral)                    │
 │            ├─ Aave.borrow(USDC)        (= flash + premium)             │
 │            ├─ require healthFactor >= minHF   ◄── safety on-chain      │
 │            └─ approve repay ► Aave tarik (flash + premium)            │
 └──────────────────────────────────────────────────────────────────────┘
        │
        ▼  3. logger.log_entry(..., dex_used, fee_paid_bps, slippage_estimate)
```

## Risiko TAMBAHAN dari multi-DEX routing

1. **Race condition quote ⟶ eksekusi.** Quote diambil off-chain pada blok T,
   tx di-mine pada blok T+n. Harga/likuiditas DEX bisa berubah → DEX yang tadi
   "terbaik" jadi bukan terbaik, atau output turun. **Mitigasi:** cache pendek
   (3 dtk), `minOut` ketat on-chain (kalau meleset → revert, bukan rugi), dan
   kirim tx segera setelah quote. Catatan: `minOut` melindungi dari harga buruk,
   **tapi tidak menjamin** kamu dapat DEX paling optimal saat eksekusi.
2. **MEV / sandwich di Base.** Base sekarang punya **Flashblocks** (pre-confirm
   ~200ms) dan sequencer-nya tidak menjalankan lelang MEV publik seperti
   mainnet, jadi sandwich klasik **lebih sulit tapi tidak nol** (terutama untuk
   swap besar di pool dangkal). Optimizer yang memilih pool likuid + `minOut`
   ketat sudah membantu. Untuk size besar pertimbangkan private/protected RPC.
3. **Gas overhead multi-query vs profit.** Query banyak DEX **gratis** kalau
   pakai `eth_call` ke node sendiri (tidak ada gas) — overhead-nya **latency**,
   bukan gas. Yang mahal: kalau kamu nekat quote on-chain di dalam tx. Desain
   ini sengaja off-chain → on-chain hanya 1 swap. Tetap: tiap RPC call ada
   biaya kalau pakai provider berbayar per-request; cache 3 dtk meredam itu.
4. **Likuiditas tipis Aerodrome/BaseSwap untuk size besar.** Pool kecil →
   `getAmountsOut` bisa kelihatan bagus untuk probe kecil tapi price impact
   meledak di size penuh. `slippage_estimate` (impact via probe) di optimizer
   memberi sinyal ini; pertimbangkan **split routing** atau batasi size per-DEX.
5. **Quote ≠ eksekusi (lagi).** `getAmountsOut`/Quoter adalah estimasi blok
   sekarang; `exactInputSingle` UniV3 bahkan bukan `view`. Selalu andalkan
   `minOut`, jangan treat quote sebagai harga pasti.
6. **Stale cache.** Cache 3 dtk = ada kemungkinan pakai harga basi saat pasar
   bergerak cepat. Untuk entry besar, set TTL lebih pendek / bypass cache.

## Rekomendasi: aggregator API (1inch/Paraswap/0x) vs optimizer sendiri

**Pakai optimizer sendiri (modul ini) kalau:**
- Pair sederhana & likuid (WETH/USDC) dengan jumlah venue terbatas.
- Mau kontrol penuh, tanpa dependensi/limit API pihak ketiga, dan butuh
  integrasi rapi ke `minOut` + flash-loan callback.
- Size kecil–menengah di mana single-pool routing sudah optimal.

**Pakai aggregator (1inch / Paraswap / 0x — semua live di Base) kalau:**
- Size **besar** yang butuh **split routing** lintas banyak pool/DEX untuk
  menekan price impact (aggregator jauh lebih jago di sini).
- Mau cakupan DEX luas (termasuk Sushi RouteProcessor) tanpa nulis tiap adapter.
- Siap menerima: ketergantungan API (rate limit, downtime), kalldata swap yang
  di-generate eksternal harus dieksekusi via router aggregator di dalam
  `executeOperation` (perlu adapter "generic call" di contract + whitelist
  target demi keamanan), dan harga quote yang juga bisa stale.

**Praktik production yang umum (hybrid):** pakai aggregator API untuk
**mendapatkan kalldata swap optimal**, lalu eksekusi kalldata itu di dalam
flash-loan callback dengan `minOut` ketat. Optimizer buatan sendiri jadi
**fallback** saat API down. Mulai dari optimizer ini untuk WETH/USDC; naik ke
aggregator begitu size-mu cukup besar sampai price impact > biaya integrasi.

---

# UPGRADE 2: Aggregator + Macro/Sizing + Foundry + Monitor

## Modul baru
| File | Isi |
|---|---|
| `python/macro_score.py` | scoring arah (trend/momentum/mean-revert) -> long/short/flat + confidence + volatilitas; `PriceHistory` SQLite |
| `python/position_sizing.py` | MacroResult -> margin + leverage, di-cap `max_safe_leverage` (buffer >=15%) |
| `python/aggregator_client.py` | quote + calldata dari **1inch / 0x** (split-routing size besar) |
| `python/monitor.py` | polling health factor + **auto-deleverage** kalau HF kritis |
| `test/LeverageFlashLoanRouted.t.sol` + `foundry.toml` | test fork Base mainnet |

## 1) Aggregator (1inch / 0x) — dex id = 4
Contract `LeverageFlashLoanRouted` kini punya path swap via **calldata aggregator**
dengan **whitelist** (keamanan) + verifikasi output via balance-delta (`minOut`).

Router yang perlu di-whitelist (verified BaseScan):
- 1inch AggregationRouterV6: `0x111111125421cA6dc452d289314280a0f8842A65`
- 0x AllowanceHolder:        `0x0000000000001fF3684f28c67538d4D072C22734`

```python
# sekali setelah deploy:
client.set_aggregator("0x111111125421cA6dc452d289314280a0f8842A65", True)  # 1inch
client.set_aggregator("0x0000000000001fF3684f28c67538d4D072C22734", True)  # 0x

# aktifkan di .env: USE_AGGREGATOR=true  (+ ZEROX_API_KEY / ONEINCH_API_KEY)
```
Saat `USE_AGGREGATOR=true`, `auto_trade()` membandingkan output on-chain optimizer
vs aggregator; kalau aggregator menang **dan** target sudah di-whitelist, ia pakai
`dex=4`. Kalau belum di-whitelist → tetap pakai DEX on-chain (fail-safe).

> **Keamanan:** calldata aggregator HARUS digenerate dengan `taker/receiver =
> alamat contract` (bukan EOA). Contract approve + call hanya ke `aggTarget` yang
> di-whitelist, lalu cek `amountOut >= minOut` (revert `SlippageTooHigh` kalau kurang).

## 2) Foundry tests (fork Base mainnet)
```bash
export BASE_RPC_URL=https://mainnet.base.org   # atau Alchemy/Infura
forge install foundry-rs/forge-std
forge test --fork-url $BASE_RPC_URL -vvv
```
Mencakup: open LONG 3x via UniV3 (HF >= minHF), revert saat minHF mustahil
(safety), close LONG (debt lunas + PnL balik), akses non-owner ditolak,
whitelist aggregator. `minOut=0` dipakai khusus di test fork (JANGAN di produksi).

## 3) Monitor / auto-deleverage
```bash
python monitor.py     # polling tiap MONITOR_INTERVAL detik
```
- `HF <= HF_WARN` (default 1.30) → peringatan.
- `HF <= HF_ACTION` (default 1.15) → **tutup posisi otomatis** (flash loan +
  DEX terbaik) sebelum kena likuidasi. Arah posisi dibaca dari entry terbuka
  terakhir di logger (atau paksa via argumen `run(is_long=...)`).

> Auto-close = **full deleverage** (paling robust/atomik). Untuk partial,
> kecilkan `flash_amount`. Monitor bukan pengganti buffer — saat harga gap
> cepat, likuidasi tetap bisa mendahului. Pertimbangkan jalankan monitor di
> infra terpisah yang andal (bukan laptop).

---

# DEPLOY ke Base Sepolia — runbook

> Alamat Aave Base Sepolia (verified `bgd-labs/aave-address-book`):
> Pool `0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27`,
> PoolAddressesProvider `0xE4C23309117Aa30342BFaae6c95c6478e0A4Ad00`,
> USDC reserve (faucet) `0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f`,
> Uniswap SwapRouter02 `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`,
> QuoterV2 `0xC5290058841028F1614F3A6F0F5816cAd0df5E27`.

### ⚠️ Ekspektasi realistis di testnet
Di Sepolia, token reserve Aave & pool Uniswap **sering tidak punya likuiditas
yang cocok**, jadi alur **OPEN penuh** (swap → supply → borrow) **besar
kemungkinan gagal** di langkah swap/borrow. Sepolia paling berguna untuk:
deploy, akses owner, jalur **revert/safety**, dan `setAggregator`. Validasi
**siklus leverage penuh** paling andal lewat **Foundry fork mainnet** (`test/`).

### Langkah
```bash
# 0. masuk folder & deps
cd base_flashloan_bot/python
pip install -r requirements.txt

# 1. .env
cp ../.env.example ../.env
#   isi: NETWORK=base-sepolia
#        BASE_RPC_URL=https://sepolia.base.org   (atau Alchemy/Infura Sepolia)
#        PRIVATE_KEY=<wallet bot khusus, JANGAN wallet utama>

# 2. dana testnet
#   - ETH gas : https://www.alchemy.com/faucets/base-sepolia
#   - aset Aave: https://bridge-testnet.aave.com/faucet/?marketName=proto_base_sepolia_v3

# 3. PREFLIGHT (cek RPC, chainId, saldo, bytecode tiap address)
python preflight.py
#   -> harus '✅ semua cek inti lolos' sebelum lanjut

# 4. deploy contract multi-DEX
python deploy_routed.py
#   -> copy 'Contract: 0x...' ke .env: LEVERAGE_CONTRACT=0x...

# 5. preflight lagi (sekarang cek LEVERAGE_CONTRACT + accountData)
python preflight.py

# 6. (opsional) whitelist aggregator + aktifkan
#   python -c "from contract_interface import BaseChainClient as C; \
#     c=C(); print(c.set_aggregator('0x111111125421cA6dc452d289314280a0f8842A65', True))"

# 7. coba pipeline (kemungkinan revert di swap krn likuiditas testnet - itu wajar)
python run_bot_routed.py
```

### Troubleshooting cepat
| Gejala | Kemungkinan sebab | Aksi |
|---|---|---|
| `preflight: chainId != expected` | NETWORK/RPC tak cocok | samakan `NETWORK` & `BASE_RPC_URL` |
| `TIDAK ada bytecode` di preflight | alamat salah / belum ada di chain itu | cek address di BaseScan Sepolia |
| deploy revert / out of gas | saldo ETH kurang | faucet ETH |
| open revert di swap | pool Uniswap testnet kosong | wajar di Sepolia → andalkan Foundry fork |
| open revert `HealthFactorTooLow` | leverage/buffer ketat | turunkan leverage / cek harga |
| borrow revert | reserve cap / butuh enable collateral | cek param reserve Aave Sepolia |

---

# CI: Foundry fork test otomatis (GitHub Actions)

Workflow `.github/workflows/foundry.yml` otomatis compile + jalanin
`forge test` **fork Base mainnet** tiap push/PR yang menyentuh contract/test
(juga bisa di-trigger manual dari tab **Actions**). Kamu **tak perlu install
Foundry di laptop** — semua jalan di runner GitHub.

### Setup (sekali): tambah secret RPC mainnet
1. Repo GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**:
   - Name: `BASE_RPC_URL`
   - Value: RPC Base **MAINNET** (mis. `https://base-mainnet.g.alchemy.com/v2/<KEY>`;
     `https://mainnet.base.org` juga bisa tapi rawan rate-limit).
3. Selesai. Push berikutnya akan menjalankan fork test; lihat hasil di tab
   **Actions**. Kalau secret belum di-set, workflow tetap compile contract dan
   memberi warning (fork test dilewati, bukan gagal).

> Kenapa fork **mainnet** padahal deploy di Sepolia? Karena hanya mainnet yang
> punya likuiditas Aave + Uniswap asli untuk menguji siklus leverage penuh
> (open→swap→supply→borrow→close) secara realistis, tetap dengan dana bohongan.
