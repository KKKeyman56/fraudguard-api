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
