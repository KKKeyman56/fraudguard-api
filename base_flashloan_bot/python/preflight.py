"""
preflight.py
============
FUNGSI: Cek kesiapan SEBELUM deploy / trade supaya masalah ketahuan lebih dulu
(bukan setelah gas kebuang / tx revert). Memvalidasi:
  - .env: PRIVATE_KEY ada -> derive alamat wallet
  - RPC: konek + chainId cocok dgn NETWORK
  - saldo: ETH (gas) wallet, plus saldo USDC/WETH
  - alamat kontrak terkonfigurasi BENAR-BENAR punya bytecode on-chain
    (mendeteksi address salah/kosong yang umum bikin deploy/tx gagal)
  - kalau LEVERAGE_CONTRACT terisi: cek ada code + baca accountData

Jalankan:
    NETWORK=base-sepolia python preflight.py
"""

from __future__ import annotations

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from config import settings

OK = "✅"
WARN = "⚠️ "
BAD = "❌"


def _has_code(w3, addr) -> bool:
    try:
        return len(w3.eth.get_code(Web3.to_checksum_address(addr))) > 2
    except Exception:
        return False


def main():
    print(f"== PREFLIGHT: network={settings.network} ==")
    fails = 0

    # 1. private key
    if not settings.private_key:
        print(f"{BAD} PRIVATE_KEY belum di-set di .env"); return 1
    acct = None

    # 2. RPC
    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not w3.is_connected():
        print(f"{BAD} RPC tidak konek: {settings.rpc_url}"); return 1
    print(f"{OK} RPC konek: {settings.rpc_url}")

    chain_id = w3.eth.chain_id
    want = settings.addresses["chain_id"]
    if chain_id != want:
        print(f"{BAD} chainId {chain_id} != expected {want} (NETWORK salah?)"); fails += 1
    else:
        print(f"{OK} chainId {chain_id}")

    acct = w3.eth.account.from_key(settings.private_key)
    print(f"{OK} Wallet: {acct.address}")

    # 3. saldo ETH
    bal = w3.eth.get_balance(acct.address)
    eth = w3.from_wei(bal, "ether")
    if bal == 0:
        print(f"{BAD} Saldo ETH 0 -> tak bisa bayar gas. Pakai faucet Base Sepolia."); fails += 1
    else:
        print(f"{OK} Saldo ETH: {eth}")

    # 4. alamat kontrak punya bytecode?
    a = settings.addresses
    required = ["aave_pool", "uniswap_router02", "uniswap_quoter_v2", "weth", "usdc"]
    optional = ["aerodrome_router", "aerodrome_factory", "baseswap_router", "sushiswap_router"]
    for key in required:
        addr = a.get(key, "")
        if not addr:
            print(f"{BAD} {key}: kosong (wajib diisi)"); fails += 1
        elif _has_code(w3, addr):
            print(f"{OK} {key}: {addr} (ada bytecode)")
        else:
            print(f"{BAD} {key}: {addr} TIDAK ada bytecode (alamat salah / belum deploy)"); fails += 1
    for key in optional:
        addr = a.get(key, "")
        if not addr:
            print(f"{WARN}{key}: kosong (adapter non-aktif - normal di Sepolia)")
        elif _has_code(w3, addr):
            print(f"{OK} {key}: {addr}")
        else:
            print(f"{WARN}{key}: {addr} tak ada bytecode (akan di-skip)")

    # 5. saldo token (ERC20.balanceOf)
    erc20 = [{"constant": True, "inputs": [{"name": "o", "type": "address"}],
              "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "type": "function"}]
    for key, dec in (("usdc", 6), ("weth", 18)):
        try:
            c = w3.eth.contract(address=Web3.to_checksum_address(a[key]), abi=erc20)
            b = c.functions.balanceOf(acct.address).call()
            print(f"{OK} Saldo {key.upper()}: {b / 10**dec}")
        except Exception as e:
            print(f"{WARN}Gagal baca saldo {key}: {str(e)[:60]}")

    # 6. contract sudah deploy?
    if settings.contract_address:
        if _has_code(w3, settings.contract_address):
            print(f"{OK} LEVERAGE_CONTRACT: {settings.contract_address} (ada bytecode)")
            try:
                routed_abi = [{"inputs": [], "name": "accountData", "outputs": [
                    {"name": "a", "type": "uint256"}, {"name": "b", "type": "uint256"},
                    {"name": "c", "type": "uint256"}, {"name": "d", "type": "uint256"},
                    {"name": "e", "type": "uint256"}, {"name": "hf", "type": "uint256"}],
                    "stateMutability": "view", "type": "function"}]
                c = w3.eth.contract(address=Web3.to_checksum_address(settings.contract_address), abi=routed_abi)
                d = c.functions.accountData().call()
                print(f"{OK} accountData OK (health factor={d[5]/1e18:.3f})")
            except Exception as e:
                print(f"{WARN}accountData gagal dibaca: {str(e)[:60]}")
        else:
            print(f"{BAD} LEVERAGE_CONTRACT diisi tapi tak ada bytecode: {settings.contract_address}"); fails += 1
    else:
        print(f"{WARN}LEVERAGE_CONTRACT belum di-set (deploy dulu: python deploy_routed.py)")

    print("==", f"{BAD} {fails} masalah" if fails else f"{OK} semua cek inti lolos", "==")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
