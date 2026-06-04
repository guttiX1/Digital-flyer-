// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Faucet-enabled mock USDC for testnet deployment and local testing.
contract MockUSDC is ERC20 {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("USD Coin (Test)", "USDC") {
        // Mint 1,000,000 USDC to deployer for initial distribution
        _mint(msg.sender, 1_000_000 * 10 ** _DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Anyone can mint up to 10,000 USDC per call (testnet faucet).
    function faucet(uint256 amount) external {
        require(amount <= 10_000 * 10 ** _DECIMALS, "max 10000 USDC per call");
        _mint(msg.sender, amount);
    }
}
