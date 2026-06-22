// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*//////////////////////////////////////////////////////////////////////////
    LeverageFlashLoanRouted.t.sol
    --------------------------------------------------------------------------
    Test suite Foundry yang FORK Base mainnet untuk menguji contract leverage
    flash loan multi-DEX terhadap protokol asli (Aave V3 + Uniswap V3 Base).

    Jalankan:
        export BASE_RPC_URL=https://mainnet.base.org   # atau Alchemy/Infura
        forge install foundry-rs/forge-std
        forge test --fork-url $BASE_RPC_URL -vvv

    Yang diuji:
      1. open LONG via Uniswap V3 -> posisi terbentuk, HF >= minHF
      2. safety: minHealthFactor terlalu tinggi -> revert
      3. close LONG -> debt lunas, dana balik ke owner
      4. akses: non-owner tak bisa open
      5. aggregator: target belum di-whitelist -> revert; setAggregator bekerja
//////////////////////////////////////////////////////////////////////////*/

import {Test} from "forge-std/Test.sol";
import {LeverageFlashLoanRouted} from "../contracts/LeverageFlashLoanRouted.sol";

interface IERC20T {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

contract LeverageFlashLoanRoutedTest is Test {
    // --- alamat resmi Base mainnet (verified BaseScan) ---
    address constant AAVE_POOL   = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
    address constant UNIV3       = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant AERO        = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address constant AERO_FAC    = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;
    address constant BASESWAP    = 0x327Df1E6de05895d2ab08513aaDD9313Fe505d86;
    address constant SUSHI       = address(0);
    address constant WETH        = 0x4200000000000000000000000000000000000006;
    address constant USDC        = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // 0x AllowanceHolder Base (untuk test whitelist)
    address constant ZEROX_AH    = 0x0000000000001fF3684f28c67538d4D072C22734;

    LeverageFlashLoanRouted bot;
    address owner = address(this);

    uint8 constant DEX_UNIV3 = 0;
    uint24 constant FEE_005 = 500;

    function setUp() public {
        // fork dibuat lewat --fork-url; deploy contract dgn owner = test contract
        bot = new LeverageFlashLoanRouted(
            AAVE_POOL, UNIV3, AERO, AERO_FAC, BASESWAP, SUSHI, WETH, USDC
        );
        // danai owner dgn 5000 USDC (cheatcode tulis storage saldo)
        deal(USDC, owner, 5_000e6);
        IERC20T(USDC).approve(address(bot), type(uint256).max);
    }

    function _longRoute() internal pure returns (LeverageFlashLoanRouted.SwapRoute memory) {
        // minOut=0 hanya untuk test fork deterministik (JANGAN di produksi)
        return LeverageFlashLoanRouted.SwapRoute({
            dex: DEX_UNIV3, uniFee: FEE_005, aeroStable: false,
            minOut: 0, aggTarget: address(0), aggData: ""
        });
    }

    /* 1. OPEN LONG 3x via Uniswap V3 */
    function test_OpenLong_Univ3() public {
        uint256 margin = 1_000e6;     // 1000 USDC
        uint256 flash  = 2_000e6;     // flash 2000 USDC -> 3x
        bot.openPosition(true, margin, flash, 1.05e18, _longRoute());

        (uint256 coll, uint256 debt,,,, uint256 hf) = bot.accountData();
        assertGt(coll, 0, "ada collateral");
        assertGt(debt, 0, "ada debt");
        assertGe(hf, 1.05e18, "HF >= minHF");
        emit log_named_uint("health factor (1e18)", hf);
    }

    /* 2. SAFETY: minHealthFactor mustahil -> revert */
    function test_RevertWhen_HFTooLow() public {
        vm.expectRevert();  // HealthFactorTooLow
        bot.openPosition(true, 1_000e6, 2_000e6, 100e18, _longRoute());
    }

    /* 3. CLOSE LONG -> dana balik ke owner */
    function test_CloseLong() public {
        bot.openPosition(true, 1_000e6, 2_000e6, 1.05e18, _longRoute());

        uint256 balBefore = IERC20T(USDC).balanceOf(owner);
        // flash USDC cukup utk lunasi debt; swap WETH->USDC saat close (minOut=0 test)
        LeverageFlashLoanRouted.SwapRoute memory r = LeverageFlashLoanRouted.SwapRoute({
            dex: DEX_UNIV3, uniFee: FEE_005, aeroStable: false,
            minOut: 0, aggTarget: address(0), aggData: ""
        });
        bot.closePosition(true, 2_100e6, r);

        (, uint256 debt,,,,) = bot.accountData();
        assertEq(debt, 0, "debt lunas");
        assertGt(IERC20T(USDC).balanceOf(owner), balBefore, "PnL balik ke owner");
    }

    /* 4. AKSES: non-owner tak bisa open */
    function test_RevertWhen_NotOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(); // NotOwner
        bot.openPosition(true, 1_000e6, 2_000e6, 1.05e18, _longRoute());
    }

    /* 5. AGGREGATOR whitelist */
    function test_AggregatorWhitelist() public {
        assertFalse(bot.aggregatorWhitelist(ZEROX_AH));
        bot.setAggregator(ZEROX_AH, true);
        assertTrue(bot.aggregatorWhitelist(ZEROX_AH));

        // dex=4 dgn target belum di-whitelist harus revert
        LeverageFlashLoanRouted.SwapRoute memory r = LeverageFlashLoanRouted.SwapRoute({
            dex: 4, uniFee: 0, aeroStable: false, minOut: 0,
            aggTarget: address(0xDEAD), aggData: hex"00"
        });
        vm.expectRevert(); // AggregatorNotWhitelisted
        bot.openPosition(true, 1_000e6, 2_000e6, 1.05e18, r);
    }
}
