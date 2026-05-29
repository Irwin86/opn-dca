// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MockERC20.sol";

/// @notice Simulates a Uniswap V2-compatible router for local tests.
///         Always returns a 1:1 swap for simplicity.
contract MockRouter {
    using SafeERC20 for IERC20;

    /// @dev Swap rate in basis points applied to simulate price: 10000 = 1:1
    uint256 public swapRateBps = 10_000;

    function setSwapRate(uint256 rateBps) external {
        swapRateBps = rateBps;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "MockRouter: path too short");

        uint256 amountOut = (amountIn * swapRateBps) / 10_000;
        require(amountOut >= amountOutMin, "MockRouter: insufficient output");

        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        MockERC20(path[path.length - 1]).mint(to, amountOut);

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountOut;
    }
}
