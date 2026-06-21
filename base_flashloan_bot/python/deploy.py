"""
deploy.py
=========
FUNGSI: Compile (via py-solc-x) dan deploy kontrak LeverageFlashLoan ke Base
(mainnet atau Sepolia) memakai Web3.py. Setelah deploy, alamat contract dicetak
agar kamu simpan ke .env (LEVERAGE_CONTRACT).

Constructor menerima alamat Aave Pool, Balancer Vault, Uniswap Router02, WETH,
USDC -> semua diambil otomatis dari config sesuai network aktif.

Jalankan:
    NETWORK=base-sepolia python deploy.py     # testnet dulu, WAJIB
    NETWORK=base          python deploy.py     # mainnet (uang asli)
"""

from __future__ import annotations

import os

import solcx
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from config import settings

CONTRACT_PATH = os.path.join(os.path.dirname(__file__), "..", "contracts", "LeverageFlashLoan.sol")
SOLC_VERSION = "0.8.20"


def compile_contract():
    solcx.install_solc(SOLC_VERSION)
    solcx.set_solc_version(SOLC_VERSION)
    with open(CONTRACT_PATH, "r") as f:
        source = f.read()

    compiled = solcx.compile_source(
        source,
        output_values=["abi", "bin"],
        optimize=True,
        optimize_runs=200,
        solc_version=SOLC_VERSION,
    )
    # ambil entri kontrak LeverageFlashLoan
    key = next(k for k in compiled if k.endswith(":LeverageFlashLoan"))
    return compiled[key]["abi"], compiled[key]["bin"]


def main():
    if not settings.private_key:
        raise SystemExit("PRIVATE_KEY belum di-set di .env")

    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not w3.is_connected():
        raise SystemExit(f"Tidak bisa konek RPC: {settings.rpc_url}")

    acct = w3.eth.account.from_key(settings.private_key)
    addr = settings.addresses

    print(f"Network         : {settings.network} (chainId {addr['chain_id']})")
    print(f"Deployer        : {acct.address}")
    print(f"Balance (ETH)   : {w3.from_wei(w3.eth.get_balance(acct.address), 'ether')}")

    abi, bytecode = compile_contract()
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)

    constructor = Contract.constructor(
        Web3.to_checksum_address(addr["aave_pool"]),
        Web3.to_checksum_address(addr["balancer_vault"]),
        Web3.to_checksum_address(addr["uniswap_router02"]),
        Web3.to_checksum_address(addr["weth"]),
        Web3.to_checksum_address(addr["usdc"]),
    )

    tx = constructor.build_transaction(
        {
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "chainId": addr["chain_id"],
            "maxFeePerGas": w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": w3.to_wei(0.001, "gwei"),
        }
    )
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Deploy tx       : {tx_hash.hex()}")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    print(f"Contract address: {receipt.contractAddress}")
    print(">>> Simpan ke .env: LEVERAGE_CONTRACT=" + receipt.contractAddress)


if __name__ == "__main__":
    main()
