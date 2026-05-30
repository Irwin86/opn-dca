// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DCAVault
 * @author Irwin86
 * @notice Permissionless, non-custodial Dollar-Cost Averaging vault on OPN Chain.
 *         Users deposit a "from" token, define a recurring swap amount and interval,
 *         and anyone (a keeper) can trigger the swap on their behalf once the interval elapses.
 * @dev Built for IOPn Builders Programme — Season 1 (DeFi & Open Finance)
 *      Repository: https://github.com/Irwin86/opn-dca
 */
contract DCAVault is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct Position {
        address owner;           // wallet that created the position
        address fromToken;       // token to spend (e.g. USDC)
        address toToken;         // token to accumulate (e.g. WETH)
        uint256 amountPerSwap;   // how much fromToken to swap each interval
        uint256 intervalSeconds; // minimum seconds between swaps
        uint256 lastSwapAt;      // timestamp of the last executed swap
        uint256 totalDeposited;  // lifetime fromToken deposited
        uint256 totalSpent;      // lifetime fromToken spent on swaps
        uint256 totalReceived;   // lifetime toToken received from swaps
        bool active;             // false if user closed the position
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Auto-incrementing position ID
    uint256 public nextPositionId;

    /// @notice All positions by ID
    mapping(uint256 => Position) public positions;

    /// @notice All position IDs owned by a wallet
    mapping(address => uint256[]) public userPositions;

    /// @notice DEX router used for swaps
    address public router;

    /// @notice Protocol fee in basis points (e.g. 30 = 0.3%)
    uint256 public feeBps;

    /// @notice Accumulated protocol fees per token
    mapping(address => uint256) public accruedFees;

    /// @notice Keeper reward in basis points paid from each swap
    uint256 public keeperRewardBps;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event PositionCreated(
        uint256 indexed positionId,
        address indexed owner,
        address fromToken,
        address toToken,
        uint256 amountPerSwap,
        uint256 intervalSeconds
    );

    event Deposited(uint256 indexed positionId, address indexed owner, uint256 amount);

    event SwapExecuted(
        uint256 indexed positionId,
        address indexed keeper,
        uint256 fromAmount,
        uint256 toAmount,
        uint256 keeperReward
    );

    event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 refunded);

    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeesWithdrawn(address indexed token, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error NotPositionOwner();
    error PositionNotActive();
    error IntervalNotElapsed(uint256 nextSwapAt, uint256 currentTime);
    error InsufficientBalance(uint256 available, uint256 required);
    error InvalidInterval();
    error InvalidAmount();
    error InvalidToken();
    error SameToken();
    error ZeroAddress();
    error FeeTooHigh();
    error NoFeesToWithdraw();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _router   DEX router address (Uniswap V2-compatible)
     * @param _feeBps   Protocol fee in basis points (max 100 = 1%)
     * @param _keeperRewardBps  Keeper reward in basis points (max 50 = 0.5%)
     */
    constructor(
        address _router,
        uint256 _feeBps,
        uint256 _keeperRewardBps
    ) Ownable(msg.sender) {
        if (_router == address(0)) revert ZeroAddress();
        if (_feeBps > 100) revert FeeTooHigh();
        if (_keeperRewardBps > 50) revert FeeTooHigh();

        router = _router;
        feeBps = _feeBps;
        keeperRewardBps = _keeperRewardBps;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // User Actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new DCA position and optionally fund it immediately.
     * @param fromToken       Token to sell on each interval
     * @param toToken         Token to buy on each interval
     * @param amountPerSwap   Amount of fromToken to spend per swap
     * @param intervalSeconds Minimum seconds between consecutive swaps
     * @param initialDeposit  Amount of fromToken to deposit now (can be 0)
     * @return positionId     The new position's ID
     */
    function createPosition(
        address fromToken,
        address toToken,
        uint256 amountPerSwap,
        uint256 intervalSeconds,
        uint256 initialDeposit
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        if (fromToken == address(0) || toToken == address(0)) revert InvalidToken();
        if (fromToken == toToken) revert SameToken();
        if (amountPerSwap == 0) revert InvalidAmount();
        if (intervalSeconds < 60) revert InvalidInterval(); // minimum 1 minute

        positionId = nextPositionId++;

        positions[positionId] = Position({
            owner: msg.sender,
            fromToken: fromToken,
            toToken: toToken,
            amountPerSwap: amountPerSwap,
            intervalSeconds: intervalSeconds,
            lastSwapAt: 0,
            totalDeposited: 0,
            totalSpent: 0,
            totalReceived: 0,
            active: true
        });

        userPositions[msg.sender].push(positionId);

        emit PositionCreated(
            positionId,
            msg.sender,
            fromToken,
            toToken,
            amountPerSwap,
            intervalSeconds
        );

        if (initialDeposit > 0) {
            _deposit(positionId, initialDeposit);
        }
    }

    /**
     * @notice Top up an existing position's fromToken balance.
     * @param positionId  Position to fund
     * @param amount      Amount of fromToken to deposit
     */
    function deposit(uint256 positionId, uint256 amount) external nonReentrant whenNotPaused {
        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionNotActive();
        _deposit(positionId, amount);
    }

    /**
     * @notice Close a position and withdraw all remaining fromToken balance.
     * @param positionId  Position to close
     */
    function closePosition(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.owner != msg.sender) revert NotPositionOwner();
        if (!pos.active) revert PositionNotActive();

        pos.active = false;

        uint256 remaining = _positionBalance(positionId);
        if (remaining > 0) {
            IERC20(pos.fromToken).safeTransfer(msg.sender, remaining);
        }

        emit PositionClosed(positionId, msg.sender, remaining);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Keeper / Execution
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Execute a pending DCA swap for a position. Anyone can call this
     *         (permissionless keeper model). The caller earns a small reward.
     * @param positionId  Position to execute
     * @param minAmountOut  Minimum toToken to receive (slippage protection)
     * @param path          Swap path for the DEX router
     */
    function executeSwap(
        uint256 positionId,
        uint256 minAmountOut,
        address[] calldata path
    ) external nonReentrant whenNotPaused {
        Position storage pos = positions[positionId];
        if (!pos.active) revert PositionNotActive();

        // Interval check
        uint256 nextSwapTime = pos.lastSwapAt + pos.intervalSeconds;
        if (block.timestamp < nextSwapTime) {
            revert IntervalNotElapsed(nextSwapTime, block.timestamp);
        }

        uint256 available = _positionBalance(positionId);
        if (available < pos.amountPerSwap) {
            revert InsufficientBalance(available, pos.amountPerSwap);
        }

        // Calculate fees
        uint256 protocolFee = (pos.amountPerSwap * feeBps) / 10_000;
        uint256 keeperReward = (pos.amountPerSwap * keeperRewardBps) / 10_000;
        uint256 swapAmount = pos.amountPerSwap - protocolFee - keeperReward;

        // Update state before external calls
        pos.lastSwapAt = block.timestamp;
        pos.totalSpent += pos.amountPerSwap;
        accruedFees[pos.fromToken] += protocolFee;

        // Pay keeper
        if (keeperReward > 0) {
            IERC20(pos.fromToken).safeTransfer(msg.sender, keeperReward);
        }

        // Execute swap via DEX router
        IERC20(pos.fromToken).approve(router, swapAmount);
        uint256 toAmountReceived = _swap(path, swapAmount, minAmountOut, pos.owner);

        pos.totalReceived += toAmountReceived;

        emit SwapExecuted(positionId, msg.sender, pos.amountPerSwap, toAmountReceived, keeperReward);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns whether a position is ready to be swapped.
     */
    function isSwapDue(uint256 positionId) external view returns (bool) {
        Position storage pos = positions[positionId];
        if (!pos.active) return false;
        if (block.timestamp < pos.lastSwapAt + pos.intervalSeconds) return false;
        return _positionBalance(positionId) >= pos.amountPerSwap;
    }

    /**
     * @notice Current fromToken balance held in the vault for a position.
     *         Balance = totalDeposited - totalSpent.
     */
    function positionBalance(uint256 positionId) external view returns (uint256) {
        return _positionBalance(positionId);
    }

    /**
     * @notice Returns all position IDs for a user.
     */
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    /**
     * @notice Returns the timestamp when the next swap can be executed.
     */
    function nextSwapAt(uint256 positionId) external view returns (uint256) {
        Position storage pos = positions[positionId];
        return pos.lastSwapAt + pos.intervalSeconds;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner / Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        emit RouterUpdated(router, _router);
        router = _router;
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 100) revert FeeTooHigh();
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    function withdrawFees(address token) external onlyOwner {
        uint256 amount = accruedFees[token];
        if (amount == 0) revert NoFeesToWithdraw();
        accruedFees[token] = 0;
        IERC20(token).safeTransfer(owner(), amount);
        emit FeesWithdrawn(token, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────────────────────────

    function _deposit(uint256 positionId, uint256 amount) internal {
        if (amount == 0) revert InvalidAmount();
        Position storage pos = positions[positionId];
        IERC20(pos.fromToken).safeTransferFrom(msg.sender, address(this), amount);
        pos.totalDeposited += amount;
        emit Deposited(positionId, msg.sender, amount);
    }

    function _positionBalance(uint256 positionId) internal view returns (uint256) {
        Position storage pos = positions[positionId];
        return pos.totalDeposited - pos.totalSpent;
    }

    /**
     * @dev Calls a Uniswap V2-compatible router's swapExactTokensForTokens.
     *      Returns the amount of toToken received.
     */
    function _swap(
        address[] calldata path,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        // Interface for Uniswap V2-compatible router
        IUniswapV2Router routerContract = IUniswapV2Router(router);
        uint256[] memory amounts = routerContract.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            block.timestamp + 300 // 5 min deadline
        );
        return amounts[amounts.length - 1];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal interface for Uniswap V2-compatible router
// ─────────────────────────────────────────────────────────────────────────────

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
