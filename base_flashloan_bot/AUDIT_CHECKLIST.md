# Pre-Mainnet Audit Checklist — Base Flash-Loan Leverage Bot

> Tujuan: gerbang **go/no-go** sebelum deploy contract ke Base **mainnet** dan
> jalanin dengan **uang asli**. Centang semua item kritikal (🔴) dulu. Jangan
> skip cuma karena "udah jalan di testnet/CI".
>
> Status sekarang: contract teruji di **fork mainnet (5/5 pass)** + deployed di
> **Sepolia**. Itu BELUM sama dengan siap-mainnet. Checklist ini jembatannya.

---

## 0. GERBANG KRITIKAL (🔴 wajib sebelum kirim 1 USD pun)

- [ ] 🔴 **Audit eksternal / minimal peer-review serius.** Contract ini belum
      diaudit pihak ketiga. Posisi Aave dimiliki contract → bug = bisa total loss.
      Minimal: 1 reviewer Solidity berpengalaman baca baris-per-baris + Slither.
- [ ] 🔴 **Mulai super kecil.** Trade pertama mainnet = "uang yang siap hilang"
      ($20–$50). Naikkan bertahap hanya setelah beberapa siklus open+close sukses.
- [ ] 🔴 **Wallet bot terpisah** berisi dana minimal. BUKAN wallet utama.
      Private key hanya di mesin/secret manager, tidak pernah di-commit.
- [ ] 🔴 **Rencana exit manual** teruji: kamu bisa `closePosition` / `rescue`
      lewat BaseScan "Write Contract" kalau bot/RPC mati.
- [ ] 🔴 **Monitor jalan di infra andal** (VPS/server), bukan laptop yang bisa sleep.

---

## 1. Smart contract review (spesifik kode kita)

- [ ] **Owner & akses.** `onlyOwner` di `openPosition`, `closePosition`,
      `setAggregator`, `rescue`. Owner = `msg.sender` saat deploy (immutable).
      Konfirmasi deployer = wallet yang benar. Pertimbangkan multisig untuk owner.
- [ ] **Callback aman.** `executeOperation` cek `msg.sender == pool` &&
      `initiator == address(this)` && `_inFlash`. Tanpa ini, orang bisa panggil
      callback langsung. ✔ sudah ada — verifikasi tidak berubah.
- [ ] **`_inFlash` guard** mencegah callback dipanggil di luar flash. ✔
- [ ] **Aggregator whitelist.** `aggTarget` HARUS di-whitelist; default kosong.
      Jangan whitelist alamat selain router resmi (1inch V6 / 0x AllowanceHolder).
      Calldata aggregator = arbitrary call → ini permukaan serangan terbesar.
- [ ] **Verifikasi output swap.** Path DEX & aggregator pakai `minOut`
      (balance-delta untuk aggregator). Pastikan `minOut > 0` di PRODUKSI
      (di test fork sengaja 0 — jangan tiru di mainnet).
- [ ] **Approval hygiene.** `_safeApprove` reset ke 0 sebelum set nilai; aggregator
      di-reset ke 0 setelah swap. Cek tidak ada sisa allowance tak terbatas.
- [ ] **Health factor check** (`minHealthFactor`) dipanggil SETELAH borrow,
      revert kalau kurang. ✔ teruji `test_RevertWhen_HFTooLow`.
- [ ] **Reentrancy.** Semua state-changing dipagari owner + flash guard; tidak ada
      callback ke alamat untrusted kecuali router (whitelisted/known). OK, tapi
      catat: aggregator call = external call — pastikan tidak ada state penting
      yang bisa dimanipulasi di tengah.
- [ ] **`rescue` & dana nyangkut.** Setelah open/close, sisa token dikirim ke owner.
      Verifikasi tidak ada dust yang ke-lock permanen.
- [ ] **Tooling:** jalankan `slither .` dan `forge test` (CI sudah hijau).
      Tambah test: open SHORT, close SHORT, jalur aggregator (mock), revert minOut.

## 2. Coverage test yang MASIH KURANG (tambah sebelum mainnet)

- [ ] Test **open/close SHORT** (sekarang test cuma LONG).
- [ ] Test jalur **aggregator dex=4** end-to-end (mock router + calldata).
- [ ] Test **slippage**: minOut realistis → revert kalau swap meleset.
- [ ] Test **leverage ekstrem** ditolak risk module (sudah ada di Python; tambah
      di Solidity HF check untuk beberapa skenario harga).
- [ ] Fuzz/invariant (opsional): HF selalu >= minHF setelah open sukses.

## 3. Parameter ekonomi & risiko

- [ ] **`MIN_MARGIN_OF_SAFETY`** (default 15%) — cukup untuk volatilitas WETH?
      Pertimbangkan 20–25% untuk leverage > 3x.
- [ ] **`SLIPPAGE_BPS`** realistis vs likuiditas pool yang dipakai (uji ukuran).
- [ ] **`LIQ_THRESHOLD_*`** statis di config — **baca on-chain** idealnya; Aave
      bisa ubah parameter. Verifikasi nilai vs Aave Base saat ini.
- [ ] **Leverage cap** (`max_safe_leverage` + `PositionSizer.max_leverage`) sesuai
      toleransi risikomu.
- [ ] **Borrow cap / utilization Aave Base** dicek sebelum entry besar (borrow
      bisa revert atau bunga melonjak).
- [ ] Hitung **break-even**: gas + slippage(2x) + bunga Aave + (premium flash 0.05%).
      Pastikan ukuran posisi > friksi.

## 4. Operational security

- [ ] **Private key**: di env var / secret manager, bukan plaintext sembarangan.
      `.env` di `.gitignore` (✔). Pertimbangkan hardware wallet/KMS untuk produksi.
- [ ] **RPC**: pakai Alchemy/Infura berbayar untuk produksi (publik rawan
      rate-limit/down saat butuh close cepat). Punya RPC cadangan.
- [ ] **MEV**: swap besar di Base bisa kena. Pertimbangkan private/protected RPC
      submission. `minOut` ketat wajib.
- [ ] **Nonce/gas**: handle tx stuck (resubmission), terutama saat mau close.
- [ ] **Aggregator API keys** (0x/1inch) disimpan sebagai secret, ada fallback ke
      DEX on-chain kalau API down (✔ sudah).
- [ ] **Logging & alert**: monitor kirim alert (TG/Discord/email) saat HF turun,
      bukan cuma print ke console.

## 5. Monitor / auto-deleverage

- [ ] `HF_WARN` / `HF_ACTION` di-set konservatif (default 1.30 / 1.15).
- [ ] Monitor jalan **terus** & restart otomatis (systemd/pm2/docker restart).
- [ ] Uji **auto-close beneran** di Sepolia/fork sebelum andalkan di mainnet.
- [ ] Sadar batas: kalau harga **gap** cepat, likuidasi bisa mendahului auto-close.
      Auto-deleverage mengurangi risiko, bukan menghapus.

## 6. Rollout bertahap (disarankan)

1. [ ] Deploy contract ke mainnet (`NETWORK=base python deploy_routed.py`).
2. [ ] `preflight.py` di mainnet → semua hijau.
3. [ ] **1 siklus manual**: open kecil ($20–50, leverage 2x) → cek di BaseScan →
       close → verifikasi PnL & tidak ada dana nyangkut.
4. [ ] Whitelist aggregator (kalau dipakai) + uji 1 swap via dex=4.
5. [ ] Nyalakan monitor; biarkan posisi kecil terbuka, pantau HF beberapa jam.
6. [ ] Baru naikkan ukuran bertahap (mis. 2x tiap minggu kalau lancar).

## 7. Prosedur darurat

- [ ] **Bot mati / RPC down** → cara manual close via BaseScan "Write Contract"
      (`closePosition`) dengan parameter yang sudah disiapkan.
- [ ] **Harga melawan cepat** → close manual / tambah collateral via Aave langsung.
- [ ] **Bug contract terdeteksi** → `rescue` semua token + jangan buka posisi baru.
- [ ] **Aggregator/DEX bermasalah** → set `USE_AGGREGATOR=false`, andalkan UniV3.

## 8. Limitasi yang DITERIMA (sadari risikonya)

- Posisi Aave dimiliki **contract** (bukan EOA-mu). Kontrol penuh via owner.
- Close merealisasi PnL dalam **token-debt** (long → keluar USDC).
- `LIQ_THRESHOLD_*` statis (belum baca on-chain).
- Belum ada partial-deleverage (auto-close = full).
- Belum diaudit pihak ketiga.

---

### Verdict gate
> **JANGAN go mainnet** sampai semua 🔴 di Bagian 0 tercentang + Bagian 1 & 2
> beres. Testnet hijau + CI hijau = perlu, tapi **belum cukup**.
