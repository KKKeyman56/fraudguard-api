// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*//////////////////////////////////////////////////////////////////////////
    LeverageFlashLoan.sol
    --------------------------------------------------------------------------
    FUNGSI FILE INI:
    Smart contract on-chain untuk membuka & menutup posisi LEVERAGED
    DIRECTIONAL (long/short WETH terhadap USDC) di BASE chain dalam SATU
    transaksi atomik menggunakan FLASH LOAN.

    Sumber flash loan:
      - PRIMARY  : Balancer V2 Vault  -> fee 0% (gratis) di Base
      - FALLBACK : Aave V3 flashLoanSimple -> premium ~0.05%

    Lending/borrow protocol: Aave V3 (Base)
    Swap venue            : Uniswap V3 SwapRouter02 (Base)

    ALUR LONG:
      margin USDC (dari owner) + flash USDC
        -> swap semua USDC ke WETH (Uniswap V3)
        -> supply WETH ke Aave (jadi collateral)
        -> borrow USDC dari Aave (untuk bayar flash loan)
        -> repay flash loan di tx yang sama
      Hasil akhir: collateral WETH besar, debt USDC = long terungkit.

    ALUR SHORT (kebalikannya):
      margin USDC + flash WETH
        -> swap WETH ke USDC
        -> supply USDC ke Aave (collateral)
        -> borrow WETH dari Aave
        -> repay flash loan WETH
      Hasil akhir: collateral USDC, debt WETH = short terungkit.

    SAFETY: setelah posisi terbentuk, contract membaca healthFactor dari Aave
    dan REVERT kalau di bawah `minHealthFactor` yang dikirim off-chain
    (risk module sudah menghitung liquidation buffer sebelum kirim tx).

    CATATAN PENTING: posisi Aave dimiliki oleh CONTRACT ini (onBehalfOf =
    address(this)). Karena itu hanya owner yang boleh open/close, dan owner
    bisa menarik token tersisa. Audit & test di Base Sepolia dulu.
//////////////////////////////////////////////////////////////////////////*/

/* ------------------------------------------------------------------ */
/*  Interfaces (minimal, ditulis inline supaya file self-contained)    */
/* ------------------------------------------------------------------ */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @dev Aave V3 Pool (subset yang dipakai)
interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256);
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}

/// @dev Balancer V2 Vault flash loan (fee 0% di Base)
interface IBalancerVault {
    function flashLoan(
        address recipient,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata userData
    ) external;
}

/// @dev Aave V3 flash loan simple (fallback, premium ~0.05%)
interface IAavePoolFlash {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

/// @dev Uniswap V3 SwapRouter02 (Base) - exactInputSingle TIDAK punya field deadline
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/* ------------------------------------------------------------------ */
/*  Contract                                                           */
/* ------------------------------------------------------------------ */

contract LeverageFlashLoan {
    /* ----------------------------- Errors ----------------------------- */
    error NotOwner();
    error NotFlashSource();
    error NoFlashInProgress();
    error HealthFactorTooLow(uint256 actual, uint256 required);
    error TransferFailed();

    /* ---------------------------- Constants --------------------------- */
    // interestRateMode Aave: 1 = stable (deprecated), 2 = variable
    uint256 private constant VARIABLE_RATE = 2;
    uint16  private constant REFERRAL_CODE = 0;
    uint256 private constant MAX_UINT = type(uint256).max;

    // Sumber flash loan yang dipilih untuk operasi yang sedang berjalan
    enum FlashSource { BALANCER, AAVE }

    // Jenis operasi yang di-encode ke userData flash loan
    enum OpKind { OPEN_LONG, OPEN_SHORT, CLOSE_LONG, CLOSE_SHORT }

    /* ---------------------------- Immutables -------------------------- */
    address public immutable owner;
    IAavePool       public immutable aavePool;        // Aave V3 Pool (lending)
    IAavePoolFlash  public immutable aaveFlash;       // Aave V3 Pool (flash, address sama)
    IBalancerVault  public immutable balancerVault;   // Balancer V2 Vault
    ISwapRouter02   public immutable swapRouter;      // Uniswap V3 SwapRouter02
    address public immutable WETH;
    address public immutable USDC;

    /* ----------------------------- State ------------------------------ */
    // Guard sederhana: hanya boleh ada satu flash loan in-flight + reentrancy
    bool private _flashInProgress;

    /* ----------------------------- Events ----------------------------- */
    event PositionOpened(
        OpKind kind,
        uint256 margin,
        uint256 flashAmount,
        uint256 collateralSupplied,
        uint256 debtBorrowed,
        uint256 healthFactor
    );
    event PositionClosed(OpKind kind, uint256 returnedToOwner, uint256 healthFactor);

    /* --------------------------- Constructor -------------------------- */
    /// @param _pool   Aave V3 Pool proxy (Base: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5)
    /// @param _vault  Balancer V2 Vault (Base: 0xBA12222222228d8Ba445958a75a0704d566BF2C8)
    /// @param _router Uniswap V3 SwapRouter02 (Base: 0x2626664c2603336E57B271c5C0b26F421741e481)
    /// @param _weth   WETH (Base: 0x4200000000000000000000000000000000000006)
    /// @param _usdc   USDC native (Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
    constructor(
        address _pool,
        address _vault,
        address _router,
        address _weth,
        address _usdc
    ) {
        owner         = msg.sender;
        aavePool      = IAavePool(_pool);
        aaveFlash     = IAavePoolFlash(_pool);
        balancerVault = IBalancerVault(_vault);
        swapRouter    = ISwapRouter02(_router);
        WETH          = _weth;
        USDC          = _usdc;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /* ================================================================== */
    /*                          ENTRY POINTS (owner)                       */
    /* ================================================================== */

    /**
     * @notice Buka posisi long/short terungkit.
     * @param isLong          true = long WETH, false = short WETH.
     * @param useAave         true = pakai Aave flashLoanSimple, false = Balancer.
     * @param margin          modal yang disetor owner, dalam USDC (token margin).
     * @param flashAmount     jumlah flash loan: USDC kalau long, WETH kalau short.
     * @param minSwapOut      output minimum hasil swap (slippage guard, dari off-chain quoter).
     * @param poolFee         fee tier Uniswap V3 (mis. 500 = 0.05%, 3000 = 0.3%).
     * @param minHealthFactor health factor minimum (1e18 = 1.0). Revert jika lebih rendah.
     *
     * PRASYARAT: owner harus approve contract ini untuk `margin` USDC sebelum panggil.
     */
    function openPosition(
        bool isLong,
        bool useAave,
        uint256 margin,
        uint256 flashAmount,
        uint256 minSwapOut,
        uint24 poolFee,
        uint256 minHealthFactor
    ) external onlyOwner {
        // 1. Tarik margin USDC dari owner ke contract.
        _safeTransferFrom(USDC, msg.sender, address(this), margin);

        // 2. Tentukan token & arah berdasarkan long/short.
        //    LONG  : flash USDC, lalu seluruh USDC (margin+flash) di-swap ke WETH.
        //    SHORT : flash WETH, lalu seluruh WETH di-swap ke USDC (margin sudah USDC).
        address flashToken = isLong ? USDC : WETH;
        OpKind kind        = isLong ? OpKind.OPEN_LONG : OpKind.OPEN_SHORT;

        // 3. Encode semua parameter untuk dipakai di callback flash loan.
        bytes memory userData = abi.encode(
            kind,
            margin,
            flashAmount,
            minSwapOut,
            poolFee,
            minHealthFactor
        );

        // 4. Mulai flash loan dari sumber yang dipilih.
        _initiateFlash(useAave, flashToken, flashAmount, userData);
    }

    /**
     * @notice Tutup posisi: lunasi debt Aave, tarik collateral, realisasi PnL ke owner.
     * @param isLong       true kalau yang ditutup posisi long.
     * @param useAave      sumber flash loan untuk melunasi debt.
     * @param flashAmount  jumlah flash loan token-debt; HARUS >= total debt saat ini
     *                     (off-chain baca debt + tambah buffer kecil).
     * @param minSwapOut   minimum hasil swap collateral -> token-debt (slippage guard).
     * @param poolFee      fee tier Uniswap V3.
     */
    function closePosition(
        bool isLong,
        bool useAave,
        uint256 flashAmount,
        uint256 minSwapOut,
        uint24 poolFee
    ) external onlyOwner {
        // LONG  : debt = USDC, collateral = WETH -> flash USDC untuk repay.
        // SHORT : debt = WETH, collateral = USDC -> flash WETH untuk repay.
        address flashToken = isLong ? USDC : WETH;
        OpKind kind        = isLong ? OpKind.CLOSE_LONG : OpKind.CLOSE_SHORT;

        bytes memory userData = abi.encode(
            kind,
            uint256(0),       // margin tidak dipakai saat close
            flashAmount,
            minSwapOut,
            poolFee,
            uint256(0)        // minHealthFactor tidak dipakai saat close
        );

        _initiateFlash(useAave, flashToken, flashAmount, userData);
    }

    /* ================================================================== */
    /*                       FLASH LOAN INITIATION                          */
    /* ================================================================== */

    function _initiateFlash(
        bool useAave,
        address token,
        uint256 amount,
        bytes memory userData
    ) internal {
        _flashInProgress = true;

        if (useAave) {
            // Aave flashLoanSimple -> callback executeOperation()
            aaveFlash.flashLoanSimple(address(this), token, amount, userData, REFERRAL_CODE);
        } else {
            // Balancer flashLoan -> callback receiveFlashLoan()
            address[] memory tokens = new address[](1);
            uint256[] memory amounts = new uint256[](1);
            tokens[0] = token;
            amounts[0] = amount;
            balancerVault.flashLoan(address(this), tokens, amounts, userData);
        }

        _flashInProgress = false;
    }

    /* ================================================================== */
    /*                       FLASH LOAN CALLBACKS                           */
    /* ================================================================== */

    /// @notice Callback Balancer V2. Wajib transfer (amount + fee) kembali ke Vault.
    function receiveFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata feeAmounts,
        bytes calldata userData
    ) external {
        if (msg.sender != address(balancerVault)) revert NotFlashSource();
        if (!_flashInProgress) revert NoFlashInProgress();

        address token = tokens[0];
        uint256 amount = amounts[0];
        uint256 repayAmount = amount + feeAmounts[0]; // fee Balancer = 0 di Base

        _dispatch(token, amount, repayAmount, userData);

        // Repay Balancer: transfer balik ke Vault.
        _safeTransfer(token, address(balancerVault), repayAmount);
    }

    /// @notice Callback Aave V3 flashLoanSimple. Wajib approve Pool untuk (amount + premium).
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        if (msg.sender != address(aavePool)) revert NotFlashSource();
        if (initiator != address(this)) revert NotFlashSource();
        if (!_flashInProgress) revert NoFlashInProgress();

        uint256 repayAmount = amount + premium;

        _dispatch(asset, amount, repayAmount, params);

        // Repay Aave: Pool akan tarik (amount + premium) via transferFrom.
        _safeApprove(asset, address(aavePool), repayAmount);
        return true;
    }

    /* ================================================================== */
    /*                          CORE DISPATCH                               */
    /* ================================================================== */

    function _dispatch(
        address flashToken,
        uint256 flashAmount,
        uint256 repayAmount,
        bytes calldata userData
    ) internal {
        (
            OpKind kind,
            uint256 margin,
            ,                       // flashAmount (sudah diterima dari callback)
            uint256 minSwapOut,
            uint24 poolFee,
            uint256 minHealthFactor
        ) = abi.decode(userData, (OpKind, uint256, uint256, uint256, uint24, uint256));

        if (kind == OpKind.OPEN_LONG || kind == OpKind.OPEN_SHORT) {
            _open(kind, flashToken, repayAmount, minSwapOut, poolFee, minHealthFactor, margin);
        } else {
            _close(kind, flashToken, flashAmount, repayAmount, minSwapOut, poolFee);
        }
    }

    /* ------------------------------ OPEN ------------------------------ */
    function _open(
        OpKind kind,
        address flashToken,
        uint256 repayAmount,
        uint256 minSwapOut,
        uint24 poolFee,
        uint256 minHealthFactor,
        uint256 margin
    ) internal {
        bool isLong = (kind == OpKind.OPEN_LONG);

        // supplyToken = aset yang akan jadi collateral.
        //   LONG  : supply WETH (hasil swap dari USDC).
        //   SHORT : supply USDC (margin + hasil swap dari WETH).
        address supplyToken = isLong ? WETH : USDC;

        // STEP 1: swap SELURUH saldo flashToken -> supplyToken.
        //   LONG  : flashToken=USDC, saldo USDC = margin + flash, swap semua ke WETH.
        //   SHORT : flashToken=WETH, saldo WETH = flash, swap semua ke USDC.
        uint256 swapIn = IERC20(flashToken).balanceOf(address(this));
        _swapExactIn(flashToken, supplyToken, poolFee, swapIn, minSwapOut);

        // STEP 2: supply SELURUH supplyToken ke Aave sebagai collateral.
        uint256 supplyAmount = IERC20(supplyToken).balanceOf(address(this));
        _safeApprove(supplyToken, address(aavePool), supplyAmount);
        aavePool.supply(supplyToken, supplyAmount, address(this), REFERRAL_CODE);

        // STEP 3: borrow flashToken dari Aave sebanyak repayAmount (untuk bayar flash loan).
        aavePool.borrow(flashToken, repayAmount, VARIABLE_RATE, REFERRAL_CODE, address(this));

        // STEP 4: SAFETY CHECK -> health factor harus >= minHealthFactor.
        (, , , , , uint256 hf) = aavePool.getUserAccountData(address(this));
        if (hf < minHealthFactor) revert HealthFactorTooLow(hf, minHealthFactor);

        emit PositionOpened(kind, margin, repayAmount, supplyAmount, repayAmount, hf);
        // repayAmount flashToken tetap di contract -> dipakai callback untuk repay flash.
    }

    /* ------------------------------ CLOSE ----------------------------- */
    function _close(
        OpKind kind,
        address flashToken,
        uint256 flashAmount,
        uint256 repayAmount,
        uint256 minSwapOut,
        uint24 poolFee
    ) internal {
        bool isLong = (kind == OpKind.CLOSE_LONG);
        address collateralToken = isLong ? WETH : USDC; // kebalikan dari debt token

        // STEP 1: lunasi SELURUH debt Aave (amount = MAX_UINT -> Aave pakai saldo yg ada).
        _safeApprove(flashToken, address(aavePool), flashAmount);
        aavePool.repay(flashToken, MAX_UINT, VARIABLE_RATE, address(this));

        // STEP 2: tarik SELURUH collateral dari Aave.
        aavePool.withdraw(collateralToken, MAX_UINT, address(this));

        // STEP 3: swap collateral -> flashToken supaya cukup untuk repay flash loan.
        uint256 swapIn = IERC20(collateralToken).balanceOf(address(this));
        _swapExactIn(collateralToken, flashToken, poolFee, swapIn, minSwapOut);

        // STEP 4: kirim sisa (PnL) ke owner setelah menyisakan repayAmount untuk flash.
        uint256 bal = IERC20(flashToken).balanceOf(address(this));
        uint256 toOwner = bal > repayAmount ? bal - repayAmount : 0;
        if (toOwner > 0) _safeTransfer(flashToken, owner, toOwner);

        (, , , , , uint256 hf) = aavePool.getUserAccountData(address(this));
        emit PositionClosed(kind, toOwner, hf);
    }

    /* ================================================================== */
    /*                              SWAP                                    */
    /* ================================================================== */

    function _swapExactIn(
        address tokenIn,
        address tokenOut,
        uint24 poolFee,
        uint256 amountIn,
        uint256 minOut
    ) internal returns (uint256) {
        _safeApprove(tokenIn, address(swapRouter), amountIn);
        ISwapRouter02.ExactInputSingleParams memory p = ISwapRouter02.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: poolFee,
            recipient: address(this),
            amountIn: amountIn,
            amountOutMinimum: minOut,   // slippage guard wajib > 0 di produksi
            sqrtPriceLimitX96: 0
        });
        return swapRouter.exactInputSingle(p);
    }

    /* ================================================================== */
    /*                          OWNER UTILITIES                             */
    /* ================================================================== */

    /// @notice Tarik token apa pun yang tersangkut di contract (rescue / ambil PnL).
    function rescue(address token, uint256 amount) external onlyOwner {
        _safeTransfer(token, owner, amount);
    }

    /// @notice Lihat health factor & data posisi contract di Aave (view helper).
    function accountData()
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        return aavePool.getUserAccountData(address(this));
    }

    /* ================================================================== */
    /*                       SAFE ERC20 HELPERS                             */
    /* ================================================================== */
    // Menangani token non-standard (return kosong) seperti beberapa implementasi.

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        // reset ke 0 dulu untuk token yang mewajibkannya (mis. pola USDT-style)
        (bool ok0, ) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, 0));
        ok0; // diabaikan kalau token tidak butuh reset
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
