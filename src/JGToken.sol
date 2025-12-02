// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JGToken is ERC20, Ownable {
    uint256 public claimAmount = 5 * 1e18; // 5 jg each claim

    event Claimed(address indexed user, uint256 amount);
    event ClaimAmountUpdated(uint256 newAmount);

    constructor() ERC20("JG Token", "JG") Ownable(msg.sender) {}

    //  Unlimited Claim
    function claim() external {
        _mint(msg.sender, claimAmount);
        emit Claimed(msg.sender, claimAmount);
    }

    //  Owner can adjust amount (optional)
    function setClaimAmount(uint256 newAmount) external onlyOwner {
        claimAmount = newAmount;
        emit ClaimAmountUpdated(newAmount);
    }
}
