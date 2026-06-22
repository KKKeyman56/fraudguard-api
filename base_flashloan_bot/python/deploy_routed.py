"""
deploy_routed.py
================
FUNGSI: Compile (py-solc-x) + deploy LeverageFlashLoanRouted (versi multi-DEX)
ke Base. Constructor butuh: Aave Pool, Uniswap V3 Router, Aerodrome Router,
Aerodrome Factory, BaseSwap Router, SushiSwap Router (boleh 0x0), WETH, USDC.

Alamat kosong di config (mis. Sepolia / Sushi) otomatis diisi address(0) -> DEX
itu non-aktif on-chain (jangan kirim route ke DEX yang address-nya 0).

Jalankan:
    NETWORK=base-sepolia python deploy_routed.py
    NETWORK=base          python deploy_routed.py
"""

from __future__ import annotations

import os

import solcx
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from config import settings

CONTRACT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "contracts", "LeverageFlashLoanRouted.sol"
)
SOLC_VERSION = "0.8.20"
ZERO = "0x0000000000000000000000000000000000000000"


def compile_contract():
    solcx.install_solc(SOLC_VERSION)
    solcx.set_solc_version(SOLC_VERSION)
    with open(CONTRACT_PATH) as f:
        source = f.read()
    compiled = solcx.compile_source(
        source, output_values=["abi", "bin"],
        optimize=True, optimize_runs=200, solc_version=SOLC_VERSION,
    )
    key = next(k for k in compiled if k.endswith(":LeverageFlashLoanRouted"))
    return compiled[key]["abi"], compiled[key]["bin"]


def _addr(a: dict, key: str) -> str:
    return Web3.to_checksum_address(a[key]) if a.get(key) else ZERO


def main():
    if not settings.private_key:
        raise SystemExit("PRIVATE_KEY belum di-set di .env")

    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not w3.is_connected():
        raise SystemExit(f"Tidak bisa konek RPC: {settings.rpc_url}")

    acct = w3.eth.account.from_key(settings.private_key)
    a = settings.addresses
    print(f"Network  : {settings.network} (chainId {a['chain_id']})")
    print(f"Deployer : {acct.address}")

    abi, bytecode = compile_contract()
    C = w3.eth.contract(abi=abi, bytecode=bytecode)

    ctor = C.constructor(
        _addr(a, "aave_pool"),
        _addr(a, "uniswap_router02"),
        _addr(a, "aerodrome_router"),
        _addr(a, "aerodrome_factory"),
        _addr(a, "baseswap_router"),
        _addr(a, "sushiswap_router"),
        _addr(a, "weth"),
        _addr(a, "usdc"),
    )
    tx = ctor.build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "chainId": a["chain_id"],
        "maxFeePerGas": w3.eth.gas_price * 2,
        "maxPriorityFeePerGas": w3.to_wei(0.001, "gwei"),
    })
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Deploy tx: {tx_hash.hex()}")
    rcpt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    print(f"Contract : {rcpt.contractAddress}")
    print(">>> .env: LEVERAGE_CONTRACT=" + rcpt.contractAddress)


if __name__ == "__main__":
    main()
