// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoyaltyToken is ERC20, Ownable {
    mapping(address => bool) public merchants;
    
    event MerchantAdded(address indexed merchant);
    event MerchantRemoved(address indexed merchant);
    event Reward(address indexed fromMerchant, address indexed toUser, uint256 amount);
    event Spend(address indexed fromMerchant, address indexed fromUser, uint256 amount);

    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) 
        Ownable(msg.sender) 
    {}

    modifier onlyMerchant() {
        require(merchants[msg.sender], "LoyaltyToken: Not a merchant");
        _;
    }

    function addMerchant(address merchant) external onlyOwner {
        merchants[merchant] = true;
        emit MerchantAdded(merchant);
    }

    function removeMerchant(address merchant) external onlyOwner {
        merchants[merchant] = false;
        emit MerchantRemoved(merchant);
    }

    function reward(address user, uint256 amount) external onlyMerchant {
        _mint(user, amount);
        emit Reward(msg.sender, user, amount);
    }

    function spend(address user, uint256 amount) external onlyMerchant {
        require(balanceOf(user) >= amount, "LoyaltyToken: Insufficient balance");
        _burn(user, amount);
        emit Spend(msg.sender, user, amount);
    }
}