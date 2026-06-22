// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*//////////////////////////////////////////////////////////////////////////
    LeverageFlashLoanRouted.sol
    --------------------------------------------------------------------------
    FUNGSI FILE INI:
    Versi multi-DEX dari contract leverage flash loan di BASE chain.

    Perbedaan utama vs versi sebelumnya:
      - Flash loan HANYA dari Aave V3 `flashLoanSimple` (native, confirmed Base).
      - Swap TIDAK lagi hardcode ke Uniswap V3. Sekarang menerima "routing data"
        dari off-chain optimizer (dex_optimizer.py) dan mengeksekusi swap ke DEX
        dengan output terbaik:
            0 = Uniswap V3 (SwapRouter02, pakai fee tier)
            1 = Aerodrome  (Router, stable/volatile route)
            2 = BaseSwap   (Router UniswapV2-style)
            3 = SushiSwap  (Router UniswapV2-style, opsional)

    KENAPA routing dari off-chain (bukan quote on-chain di dalam tx)?
      - Quote multi-DEX on-chain = banyak STATICCALL boros gas + tetap bisa
        di-front-run. Off-chain quote (gratis, paralel, di-cache) lalu kirim
        rute terbaik + `minOut` sebagai slippage guard jauh lebih hemat gas.
      - `minOut` tetap melindungi: kalau harga bergerak melewati batas saat tx
        di-mine, swap revert -> seluruh flash loan revert (atomik, aman).

    ALUR (LONG, contoh):
      Aave flashLoanSimple(USDC)  ->  executeOperation():
        swap (margin+flash) USDC -> WETH  via DEX terbaik (route dari off-chain)
        supply WETH ke Aave (collateral)
        borrow USDC (= flash + premium)
        cek healthFactor >= minHealthFactor  (revert kalau kurang)
        approve Aave tarik (flash + premium)  -> repay flash loan
//////////////////////////////////////////////////////////////////////////*/

/* ----------------------------- ERC20 ----------------------------- */
interface IERC20 {
    function balanceOf(address a) external view returns (uint256);
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address f, address t, uint256 v) external returns (bool);
    function approve(address s, uint256 v) external returns (bool);
}

/* ----------------------------- Aave V3 ----------------------------- */
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function borrow(address asset, uint256 amount, uint256 rateMode, uint16 ref, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256);
    function flashLoanSimple(address receiver, address asset, uint256 amount, bytes calldata params, uint16 ref) external;
    function getUserAccountData(address user)
        external view
        returns (uint256, uint256, uint256, uint256, uint256, uint256 healthFactor);
}

/* --------------------- Uniswap V3 SwapRouter02 --------------------- */
interface IUniV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256);
}

/* ------------------------ Aerodrome Router ------------------------- */
interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/* ------------------- UniswapV2-style (BaseSwap/Sushi) -------------- */
interface IUniV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract LeverageFlashLoanRouted {
    /* ----------------------------- Errors ----------------------------- */
    error NotOwner();
    error NotPool();
    error NotSelf();
    error NoFlash();
    error HealthFactorTooLow(uint256 actual, uint256 required);
    error BadDex();
    error TransferFailed();

    /* ---------------------------- Constants --------------------------- */
    uint256 private constant VARIABLE_RATE = 2;
    uint16  private constant REF = 0;
    uint256 private constant MAX = type(uint256).max;

    // identitas DEX (harus sinkron dengan dex_optimizer.py)
    uint8 private constant DEX_UNIV3   = 0;
    uint8 private constant DEX_AERO    = 1;
    uint8 private constant DEX_BASESWAP = 2;
    uint8 private constant DEX_SUSHI   = 3;

    enum OpKind { OPEN_LONG, OPEN_SHORT, CLOSE_LONG, CLOSE_SHORT }

    /* ---------------------------- Immutables -------------------------- */
    address public immutable owner;
    IAavePool        public immutable pool;
    IUniV3Router     public immutable uniV3;
    IAerodromeRouter public immutable aero;
    address          public immutable aeroFactory;   // PoolFactory Aerodrome
    IUniV2Router     public immutable baseSwap;
    IUniV2Router     public immutable sushi;          // boleh address(0) jika tak dipakai
    address public immutable WETH;
    address public immutable USDC;

    bool private _inFlash;

    /* ----------------------------- Events ----------------------------- */
    event Opened(OpKind kind, uint8 dex, uint256 collateral, uint256 debt, uint256 amountOut, uint256 hf);
    event Closed(OpKind kind, uint8 dex, uint256 returnedToOwner, uint256 hf);

    /// @dev Routing data dari off-chain optimizer untuk satu swap.
    /// dex      : 0 UniV3 | 1 Aerodrome | 2 BaseSwap | 3 Sushi
    /// uniFee   : fee tier Uniswap V3 (500/3000/10000) - dipakai kalau dex=0
    /// aeroStable: true=stable pool, false=volatile - dipakai kalau dex=1
    /// minOut   : output minimum (slippage guard) dari quote off-chain
    struct SwapRoute {
        uint8 dex;
        uint24 uniFee;
        bool aeroStable;
        uint256 minOut;
    }

    constructor(
        address _pool,
        address _uniV3,
        address _aero,
        address _aeroFactory,
        address _baseSwap,
        address _sushi,
        address _weth,
        address _usdc
    ) {
        owner       = msg.sender;
        pool        = IAavePool(_pool);
        uniV3       = IUniV3Router(_uniV3);
        aero        = IAerodromeRouter(_aero);
        aeroFactory = _aeroFactory;
        baseSwap    = IUniV2Router(_baseSwap);
        sushi       = IUniV2Router(_sushi);
        WETH        = _weth;
        USDC        = _usdc;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /* ================================================================== */
    /*                          ENTRY POINTS                               */
    /* ================================================================== */

    /// @notice Buka posisi long/short terungkit memakai rute swap dari off-chain.
    function openPosition(
        bool isLong,
        uint256 margin,
        uint256 flashAmount,
        uint256 minHealthFactor,
        SwapRoute calldata route
    ) external onlyOwner {
        _safeTransferFrom(USDC, msg.sender, address(this), margin);

        // LONG: flash USDC, swap ke WETH. SHORT: flash WETH, swap ke USDC.
        address flashToken = isLong ? USDC : WETH;
        OpKind kind = isLong ? OpKind.OPEN_LONG : OpKind.OPEN_SHORT;

        bytes memory params = abi.encode(kind, margin, minHealthFactor, route);
        _inFlash = true;
        pool.flashLoanSimple(address(this), flashToken, flashAmount, params, REF);
        _inFlash = false;
    }

    /// @notice Tutup posisi: lunasi debt, tarik collateral, swap balik, kirim PnL.
    function closePosition(
        bool isLong,
        uint256 flashAmount,
        SwapRoute calldata route
    ) external onlyOwner {
        address flashToken = isLong ? USDC : WETH; // debt token
        OpKind kind = isLong ? OpKind.CLOSE_LONG : OpKind.CLOSE_SHORT;

        bytes memory params = abi.encode(kind, uint256(0), uint256(0), route);
        _inFlash = true;
        pool.flashLoanSimple(address(this), flashToken, flashAmount, params, REF);
        _inFlash = false;
    }

    /* ================================================================== */
    /*                     AAVE FLASH LOAN CALLBACK                         */
    /* ================================================================== */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        if (msg.sender != address(pool)) revert NotPool();
        if (initiator != address(this)) revert NotSelf();
        if (!_inFlash) revert NoFlash();

        uint256 repay = amount + premium;
        (OpKind kind, uint256 margin, uint256 minHF, SwapRoute memory route) =
            abi.decode(params, (OpKind, uint256, uint256, SwapRoute));

        if (kind == OpKind.OPEN_LONG || kind == OpKind.OPEN_SHORT) {
            _open(kind, asset, repay, minHF, margin, route);
        } else {
            _close(kind, asset, amount, repay, route);
        }

        // repay Aave: Pool tarik (amount + premium) via transferFrom.
        _safeApprove(asset, address(pool), repay);
        return true;
    }

    /* ------------------------------ OPEN ------------------------------ */
    function _open(
        OpKind kind,
        address flashToken,
        uint256 repay,
        uint256 minHF,
        uint256 margin,
        SwapRoute memory route
    ) internal {
        bool isLong = (kind == OpKind.OPEN_LONG);
        address supplyToken = isLong ? WETH : USDC;

        // STEP 1: swap SELURUH saldo flashToken -> supplyToken via DEX terpilih.
        uint256 swapIn = IERC20(flashToken).balanceOf(address(this));
        uint256 out = _swap(flashToken, supplyToken, swapIn, route);

        // STEP 2: supply collateral ke Aave.
        uint256 supplyAmount = IERC20(supplyToken).balanceOf(address(this));
        _safeApprove(supplyToken, address(pool), supplyAmount);
        pool.supply(supplyToken, supplyAmount, address(this), REF);

        // STEP 3: borrow flashToken untuk bayar flash loan.
        pool.borrow(flashToken, repay, VARIABLE_RATE, REF, address(this));

        // STEP 4: SAFETY -> health factor.
        (, , , , , uint256 hf) = pool.getUserAccountData(address(this));
        if (hf < minHF) revert HealthFactorTooLow(hf, minHF);

        emit Opened(kind, route.dex, supplyAmount, repay, out, hf);
    }

    /* ------------------------------ CLOSE ----------------------------- */
    function _close(
        OpKind kind,
        address flashToken,
        uint256 flashAmount,
        uint256 repay,
        SwapRoute memory route
    ) internal {
        bool isLong = (kind == OpKind.CLOSE_LONG);
        address collateralToken = isLong ? WETH : USDC;

        // STEP 1: lunasi seluruh debt Aave.
        _safeApprove(flashToken, address(pool), flashAmount);
        pool.repay(flashToken, MAX, VARIABLE_RATE, address(this));

        // STEP 2: tarik seluruh collateral.
        pool.withdraw(collateralToken, MAX, address(this));

        // STEP 3: swap collateral -> flashToken via DEX terpilih.
        uint256 swapIn = IERC20(collateralToken).balanceOf(address(this));
        _swap(collateralToken, flashToken, swapIn, route);

        // STEP 4: sisihkan repay, kirim PnL ke owner.
        uint256 bal = IERC20(flashToken).balanceOf(address(this));
        uint256 toOwner = bal > repay ? bal - repay : 0;
        if (toOwner > 0) _safeTransfer(flashToken, owner, toOwner);

        (, , , , , uint256 hf) = pool.getUserAccountData(address(this));
        emit Closed(kind, route.dex, toOwner, hf);
    }

    /* ================================================================== */
    /*                       MULTI-DEX SWAP DISPATCH                        */
    /* ================================================================== */
    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        SwapRoute memory route
    ) internal returns (uint256 amountOut) {
        if (route.dex == DEX_UNIV3) {
            _safeApprove(tokenIn, address(uniV3), amountIn);
            amountOut = uniV3.exactInputSingle(
                IUniV3Router.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: route.uniFee,
                    recipient: address(this),
                    amountIn: amountIn,
                    amountOutMinimum: route.minOut,
                    sqrtPriceLimitX96: 0
                })
            );
        } else if (route.dex == DEX_AERO) {
            _safeApprove(tokenIn, address(aero), amountIn);
            IAerodromeRouter.Route[] memory r = new IAerodromeRouter.Route[](1);
            r[0] = IAerodromeRouter.Route({
                from: tokenIn,
                to: tokenOut,
                stable: route.aeroStable,
                factory: aeroFactory
            });
            uint256[] memory amounts =
                aero.swapExactTokensForTokens(amountIn, route.minOut, r, address(this), block.timestamp);
            amountOut = amounts[amounts.length - 1];
        } else if (route.dex == DEX_BASESWAP || route.dex == DEX_SUSHI) {
            IUniV2Router router = route.dex == DEX_BASESWAP ? baseSwap : sushi;
            _safeApprove(tokenIn, address(router), amountIn);
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            uint256[] memory amounts =
                router.swapExactTokensForTokens(amountIn, route.minOut, path, address(this), block.timestamp);
            amountOut = amounts[amounts.length - 1];
        } else {
            revert BadDex();
        }
    }

    /* ================================================================== */
    /*                          OWNER UTILITIES                             */
    /* ================================================================== */
    function rescue(address token, uint256 amount) external onlyOwner {
        _safeTransfer(token, owner, amount);
    }

    function accountData()
        external view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        return pool.getUserAccountData(address(this));
    }

    /* ----------------------- SafeERC20 helpers ------------------------ */
    function _safeTransfer(address t, address to, uint256 v) internal {
        (bool ok, bytes memory d) = t.call(abi.encodeWithSelector(IERC20.transfer.selector, to, v));
        if (!ok || (d.length != 0 && !abi.decode(d, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address t, address f, address to, uint256 v) internal {
        (bool ok, bytes memory d) = t.call(abi.encodeWithSelector(IERC20.transferFrom.selector, f, to, v));
        if (!ok || (d.length != 0 && !abi.decode(d, (bool)))) revert TransferFailed();
    }

    function _safeApprove(address t, address s, uint256 v) internal {
        (bool ok0, ) = t.call(abi.encodeWithSelector(IERC20.approve.selector, s, 0));
        ok0;
        (bool ok, bytes memory d) = t.call(abi.encodeWithSelector(IERC20.approve.selector, s, v));
        if (!ok || (d.length != 0 && !abi.decode(d, (bool)))) revert TransferFailed();
    }
}
