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

    /// @notice 积分有效期（秒），默认 365 天。0 表示永不过期
    uint256 public expiryTime = 365 days;

    /// @notice 用户最后活动时间戳映射：地址 → 最后交易时间
    mapping(address => uint256) public lastActivity;

    /// @notice 水龙头领取冷却映射：地址 → 上次领取时间
    mapping(address => uint256) public lastFaucetClaim;

    /// @notice 商家积分汇率映射：商家地址 → 汇率（积分/单位货币，默认10即1元=10积分）
    mapping(address => uint256) public exchangeRates;

    /// @notice 水龙头单次领取数量（以 wei 为单位，默认 5 LYL）
    uint256 public constant FAUCET_AMOUNT = 5 ether;

    /// @notice 水龙头冷却时间（默认 1 天）
    uint256 public constant FAUCET_COOLDOWN = 1 days;

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

    /// @notice 积分过期被自动销毁时触发
    /// @param user 积分过期的用户地址
    /// @param amount 被销毁的过期积分数量
    event PointsExpired(address indexed user, uint256 amount);

    /// @notice 商家间结算时触发
    /// @param fromMerchant 发起结算的商家地址
    /// @param toMerchant 接收结算的商家地址
    /// @param amount 结算的积分数量
    event Settlement(address indexed fromMerchant, address indexed toMerchant, uint256 amount);

    /// @notice 用户从水龙头领取测试积分时触发
    /// @param user 领取积分的用户地址
    /// @param amount 领取的积分数量
    event FaucetClaim(address indexed user, uint256 amount);

    /// @notice 商家设置积分汇率时触发
    /// @param merchant 设置汇率的商家地址
    /// @param rate 新的汇率值
    event ExchangeRateSet(address indexed merchant, uint256 rate);

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

    /// @notice 设置积分有效期
    /// @dev 仅合约所有者可调用。设为 0 表示永不过期
    /// @param _expiryTime 新的有效期（秒）
    function setExpiryTime(uint256 _expiryTime) external onlyOwner {
        expiryTime = _expiryTime;
    }

    // ========== 内部辅助 ==========

    /// @notice 更新用户最后活动时间
    /// @dev 所有积分变动操作（reward/spend/transfer/transferFrom/redeem）均调用此函数
    /// @param user 需要更新活动时间的用户地址
    function _updateActivity(address user) internal {
        if (expiryTime > 0) {
            lastActivity[user] = block.timestamp;
        }
    }

    // ========== 积分过期 ==========

    /// @notice 检查并销毁用户的过期积分
    /// @dev 任何人都可调用（无需权限）。如果 expiryTime 为 0 则永不过期
    /// @param user 需要检查的用户地址
    /// @return expiredAmount 被销毁的过期积分数量（0 表示无过期）
    function checkAndBurnExpired(address user) external whenNotPaused returns (uint256 expiredAmount) {
        if (expiryTime == 0) return 0; // 永不过期

        uint256 lastActive = lastActivity[user];
        if (lastActive == 0) return 0; // 新用户，从未有过活动

        if (block.timestamp < lastActive + expiryTime) return 0; // 未过期

        uint256 balance = balanceOf(user);
        if (balance > 0) {
            _burn(user, balance);
            lastActivity[user] = 0; // 重置活动时间，避免重复销毁
            emit PointsExpired(user, balance);
            return balance;
        }
        return 0;
    }

    // ========== 商家间结算 ==========

    /// @notice 商家向另一商家转账积分用于联盟内结算
    /// @dev 仅商家可调用，需有足够余额。暂停时不可调用
    /// @param toMerchant 接收结算积分的商家地址（必须是注册商家）
    /// @param amount 结算积分数量
    function settle(address toMerchant, uint256 amount) external onlyMerchant whenNotPaused {
        require(merchants[toMerchant], "LoyaltyToken: Target not a merchant");
        require(balanceOf(msg.sender) >= amount, "LoyaltyToken: Insufficient balance");
        _transfer(msg.sender, toMerchant, amount);
        emit Settlement(msg.sender, toMerchant, amount);
    }

    // ========== 水龙头 ==========

    /// @notice 测试用户免费领取小额积分（水龙头）
    /// @dev 每次 5 LYL，两次领取之间至少间隔 FAUCET_COOLDOWN（1天）。暂停时不可调用
    function faucet() external whenNotPaused {
        require(block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
            "LoyaltyToken: Faucet cooldown not elapsed");
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        _updateActivity(msg.sender);
        emit FaucetClaim(msg.sender, FAUCET_AMOUNT);
    }

    // ========== 积分汇率 ==========

    /// @notice 商家设置自己的积分汇率
    /// @dev 仅商家可调用。汇率表示 1 单位货币可兑换的积分数量（默认 10，即 1 元 = 10 积分）
    /// @param rate 新的汇率值
    function setExchangeRate(uint256 rate) external onlyMerchant {
        require(rate > 0, "LoyaltyToken: Rate must be positive");
        exchangeRates[msg.sender] = rate;
        emit ExchangeRateSet(msg.sender, rate);
    }

    // ========== 商家方法 ==========

    /// @notice 商家向用户发放积分
    /// @dev 铸币（mint）新代币，增加总供应量。仅商家可调用，暂停时不可调用
    /// @param user 接收积分的用户地址
    /// @param amount 发放的积分数量（以 wei 为单位）
    function reward(address user, uint256 amount) external onlyMerchant whenNotPaused {
        _mint(user, amount);
        _updateActivity(user);
        emit Reward(msg.sender, user, amount);
    }

    /// @notice 商家从用户扣除积分（模拟积分消费场景）
    /// @dev 销毁（burn）代币，减少总供应量。仅商家可调用、用户余额不足时回退，暂停时不可调用
    /// @param user 被扣减积分的用户地址
    /// @param amount 扣除的积分数量（以 wei 为单位）
    function spend(address user, uint256 amount) external onlyMerchant whenNotPaused {
        require(balanceOf(user) >= amount, "LoyaltyToken: Insufficient balance");
        _burn(user, amount);
        _updateActivity(user);
        emit Spend(msg.sender, user, amount);
    }

    /// @notice 用户自主销毁积分（用于积分兑换奖品，非商家操作）
    /// @dev 销毁（burn）调用者自己的代币，无需商家权限。暂停时不可调用
    /// @param amount 销毁的积分数量（以 wei 为单位）
    function redeemTokens(uint256 amount) external whenNotPaused {
        require(balanceOf(msg.sender) >= amount, "LoyaltyToken: Insufficient balance");
        _burn(msg.sender, amount);
        _updateActivity(msg.sender);
        emit TokensRedeemed(msg.sender, amount);
    }

    // ========== ERC-20 重写（添加暂停保护） ==========

    /// @notice 用户间转账积分
    /// @dev 重写 ERC20.transfer，暂停时不可调用
    /// @param to 接收方地址
    /// @param value 转账数量
    function transfer(address to, uint256 value) public override whenNotPaused returns (bool) {
        bool success = super.transfer(to, value);
        if (success) {
            _updateActivity(msg.sender);
        }
        return success;
    }

    /// @notice 代理转账（需先 approve）
    /// @dev 重写 ERC20.transferFrom，暂停时不可调用
    /// @param from 发送方地址
    /// @param to 接收方地址
    /// @param value 转账数量
    function transferFrom(address from, address to, uint256 value) public override whenNotPaused returns (bool) {
        bool success = super.transferFrom(from, to, value);
        if (success) {
            _updateActivity(from);
        }
        return success;
    }
}
