// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title LoyaltyToken — 企业联盟通用积分代币
/// @notice 基于 ERC-20 的积分系统，支持管理员管理商家白名单，
///         商家发放(reward/mint)和扣除(spend/burn)用户积分，
///         用户间自由转账。管理员可紧急暂停所有核心操作。
/// @dev 继承 ERC20、Ownable、Pausable
contract LoyaltyToken is ERC20, Ownable, Pausable {
    /// @notice 商家白名单映射：地址 → 是否为商家
    mapping(address => bool) public merchants;

    // ========== 事件 ==========

    /// @notice 商家被添加到白名单时触发
    /// @param merchant 被添加的商家地址
    event MerchantAdded(address indexed merchant);

    /// @notice 商家被从白名单移除时触发
    /// @param merchant 被移除的商家地址
    event MerchantRemoved(address indexed merchant);

    /// @notice 商家向用户发放积分时触发（mint 新代币）
    /// @param fromMerchant 发放积分的商家地址
    /// @param toUser 接收积分的用户地址
    /// @param amount 发放的积分数量（以 wei 为单位，1 LYL = 10^18）
    event Reward(address indexed fromMerchant, address indexed toUser, uint256 amount);

    /// @notice 商家从用户扣除积分时触发（burn 代币）
    /// @param fromMerchant 扣除积分的商家地址
    /// @param fromUser 被扣除积分的用户地址
    /// @param amount 扣除的积分数量（以 wei 为单位）
    event Spend(address indexed fromMerchant, address indexed fromUser, uint256 amount);

    /// @notice 合约暂停时触发
    event ContractPaused(address indexed by);

    /// @notice 合约恢复时触发
    event ContractUnpaused(address indexed by);

    /// @notice 用户主动销毁积分（积分兑换场景）时触发
    /// @param user 销毁积分的用户地址
    /// @param amount 销毁的积分数量（以 wei 为单位）
    event TokensRedeemed(address indexed user, uint256 amount);

    // ========== 构造函数 ==========

    /// @param name 代币全称，如 "LoyaltyLink"
    /// @param symbol 代币符号，如 "LYL"
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
        Ownable(msg.sender)
    {}

    // ========== 权限修饰符 ==========

    /// @notice 仅商家可调用的修饰符
    modifier onlyMerchant() {
        require(merchants[msg.sender], "LoyaltyToken: Not a merchant");
        _;
    }

    // ========== 管理员方法 ==========

    /// @notice 添加商家到白名单
    /// @dev 仅合约所有者可调用。重复添加同一地址不会报错
    /// @param merchant 要添加的商家地址
    function addMerchant(address merchant) external onlyOwner {
        merchants[merchant] = true;
        emit MerchantAdded(merchant);
    }

    /// @notice 从白名单移除商家
    /// @dev 仅合约所有者可调用。移除未注册的商家不会报错
    /// @param merchant 要移除的商家地址
    function removeMerchant(address merchant) external onlyOwner {
        merchants[merchant] = false;
        emit MerchantRemoved(merchant);
    }

    // ========== 紧急控制方法 ==========

    /// @notice 暂停合约的核心操作（reward / spend / transfer）
    /// @dev 仅合约所有者可调用。暂停后商家无法发放/扣除积分，用户无法转账
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }

    /// @notice 恢复合约的正常运行
    /// @dev 仅合约所有者可调用
    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    // ========== 商家方法 ==========

    /// @notice 商家向用户发放积分
    /// @dev 铸币（mint）新代币，增加总供应量。仅商家可调用，暂停时不可调用
    /// @param user 接收积分的用户地址
    /// @param amount 发放的积分数量（以 wei 为单位）
    function reward(address user, uint256 amount) external onlyMerchant whenNotPaused {
        _mint(user, amount);
        emit Reward(msg.sender, user, amount);
    }

    /// @notice 商家从用户扣除积分（模拟积分消费场景）
    /// @dev 销毁（burn）代币，减少总供应量。仅商家可调用、用户余额不足时回退，暂停时不可调用
    /// @param user 被扣减积分的用户地址
    /// @param amount 扣除的积分数量（以 wei 为单位）
    function spend(address user, uint256 amount) external onlyMerchant whenNotPaused {
        require(balanceOf(user) >= amount, "LoyaltyToken: Insufficient balance");
        _burn(user, amount);
        emit Spend(msg.sender, user, amount);
    }

    /// @notice 用户自主销毁积分（用于积分兑换奖品，非商家操作）
    /// @dev 销毁（burn）调用者自己的代币，无需商家权限。暂停时不可调用
    /// @param amount 销毁的积分数量（以 wei 为单位）
    function redeemTokens(uint256 amount) external whenNotPaused {
        require(balanceOf(msg.sender) >= amount, "LoyaltyToken: Insufficient balance");
        _burn(msg.sender, amount);
        emit TokensRedeemed(msg.sender, amount);
    }

    // ========== ERC-20 重写（添加暂停保护） ==========

    /// @notice 用户间转账积分
    /// @dev 重写 ERC20.transfer，暂停时不可调用
    /// @param to 接收方地址
    /// @param value 转账数量
    function transfer(address to, uint256 value) public override whenNotPaused returns (bool) {
        return super.transfer(to, value);
    }

    /// @notice 代理转账（需先 approve）
    /// @dev 重写 ERC20.transferFrom，暂停时不可调用
    /// @param from 发送方地址
    /// @param to 接收方地址
    /// @param value 转账数量
    function transferFrom(address from, address to, uint256 value) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, value);
    }
}
