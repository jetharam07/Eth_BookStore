// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";   
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract BookPaymentsV2  is Ownable, ReentrancyGuard {
    address public tokenAddress; // JGToken address

    // each-book prices
    mapping(uint256 => uint256) public ethPrice;     // in wei
    mapping(uint256 => uint256) public tokenPrice;   // in JG (1e18)

    // purchase record
    mapping(address => mapping(uint256 => bool)) public purchased;

    // events
    event TokenAddressSet(address token);
    event PriceSet(uint256 indexed bookId, uint256 ethPrice, uint256 tokenPrice);
    event BoughtEth(address indexed buyer, uint256 indexed bookId, uint256 amount);
    event BoughtToken(address indexed buyer, uint256 indexed bookId, uint256 amount);

    constructor() Ownable(msg.sender) {}

    // -------- owner sets each-book prices --------
    function setBookPrice(
        uint256 bookId,
        uint256 ethPriceWei,
        uint256 tokenPriceJG
    ) external onlyOwner {
        ethPrice[bookId] = ethPriceWei;
        tokenPrice[bookId] = tokenPriceJG;
        emit PriceSet(bookId, ethPriceWei, tokenPriceJG);
    }

    function setTokenAddress(address _token) external onlyOwner {
        tokenAddress = _token;
        emit TokenAddressSet(_token);
    }

    // -------- user buys with ETH --------
    function buyWithEth(uint256 bookId) external payable nonReentrant {
        require(ethPrice[bookId] > 0, "ETH price not set");
        require(msg.value == ethPrice[bookId], "Incorrect ETH");
        require(!purchased[msg.sender][bookId], "Already bought");

        purchased[msg.sender][bookId] = true;
        emit BoughtEth(msg.sender, bookId, msg.value);
    }

    // -------- user buys with JG token --------
    function buyWithToken(uint256 bookId) external nonReentrant {
        require(tokenAddress != address(0), "Token not set");
        require(tokenPrice[bookId] > 0, "Token price not set");
        require(!purchased[msg.sender][bookId], "Already bought");

        bool ok = IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            tokenPrice[bookId]
        );
        require(ok, "Token transfer failed");

        purchased[msg.sender][bookId] = true;
        emit BoughtToken(msg.sender, bookId, tokenPrice[bookId]);
    }

    // -------- view --------
    function hasPurchased(address user, uint256 bookId) external view returns (bool) {
        return purchased[user][bookId];
    }

    // -------- withdraw --------
    function withdrawEth() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No ETH");
        (bool ok, ) = payable(owner()).call{value: bal}("");
        require(ok, "ETH transfer failed");
    }

    function withdrawToken() external onlyOwner {
        uint256 bal = IERC20(tokenAddress).balanceOf(address(this));
        require(bal > 0, "No token");
        IERC20(tokenAddress).transfer(owner(), bal);
    }

    receive() external payable {}
}
