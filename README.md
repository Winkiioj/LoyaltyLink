# LoyaltyLink — 基于 ERC-20 的企业联盟通用积分系统

基于以太坊 ERC-20 标准构建的去中心化积分平台，解决传统积分体系**价值低、兑换门槛高、易过期、跨商家不互通**的痛点。通过智能合约实现积分在联盟商家间的通存通兑，用户可自由转账，所有交易链上可查、不可篡改。

## 核心特性

- **去中心化积分** — 积分作为 ERC-20 代币存储在链上，用户拥有完全自主权
- **商家联盟管理** — 管理员可动态添加/移除联盟商家，无需重新部署合约
- **积分发行与消费** — 商家通过 `reward` 铸币发放积分，通过 `spend` 销毁积分完成消费
- **用户积分兑换** — 用户通过 `redeemTokens` 自主销毁积分兑换奖品
- **用户自由转账** — 支持积分在任意地址间点对点转账
- **商家间结算** — 联盟商家可通过 `settle` 互相转账积分
- **积分汇率** — 商家可自定义汇率（默认 1元=10积分），创建商品时自动换算定价
- **积分过期** — 支持设置有效期（默认 365 天），过期积分自动销毁
- **水龙头** — 测试用户每日可免费领取 5 LYL
- **权限分级** — 四级角色（管理员 / 商家 / 用户），OpenZeppelin Ownable + Pausable + 自定义 modifier 控制
- **紧急控制** — 管理员可暂停/恢复合约，阻止异常操作
- **前端角色门禁** — 非管理员无法进入管理后台，非商家无法进入商家后台

## 技术栈

| 层级 | 组件 | 版本 |
|:---|:---|:---|
| 区块链网络 | Ganache GUI (本地测试链) | 2.7.1 |
| 智能合约框架 | Hardhat | 3.x |
| 合约语言 | Solidity | 0.8.20 |
| 安全库 | OpenZeppelin Contracts | 5.x |
| 前端 | 原生 HTML/CSS/JS + Web3.js | 1.8.0 |
| 钱包 | MetaMask | 最新版 |
| 测试 | Hardhat + Mocha + Chai + Ethers.js | 48 tests |

## 项目结构

```
loyaltylink/
├── contracts/                 # 智能合约
│   └── LoyaltyToken.sol       # ERC-20 积分代币（含商家权限、暂停控制、积分兑换）
├── test/
│   └── LoyaltyToken.test.ts   # 单元测试（48 个用例）
├── frontend/                  # 前端页面
│   ├── index.html + app.js    # 用户端（余额查询、积分转账）
│   ├── shop.html + js/shop.js # 积分商城（商品浏览、下单）
│   ├── redeem.html + js/redeem.js  # 积分兑换（兑换奖品）
│   ├── merchant.html + merchant.js  # 商户端（发放/扣除积分、订单处理）
│   ├── history.html + js/history.js # 交易记录（链上事件+链下记录）
│   ├── faucet.html + js/faucet.js   # 水龙头（免费领取测试积分）
│   ├── admin.html + admin.js  # 管理端（商家白名单、暂停/恢复）
│   ├── js/common.js           # 前端公共模块（钱包/合约/角色校验）
│   ├── style.css              # 共用样式
│   └── abi.json               # 合约 ABI（部署时自动同步）
├── scripts/
│   ├── deploy.js              # 一键部署（编译 + 部署 + 更新前端地址）
│   ├── deploy-direct.js       # Hardhat 直接部署 + ABI 同步
│   ├── demo.js                # CLI 演示工具（reward/spend/pause 等）
│   ├── init-demo-data.js      # 演示数据初始化（幂等）
│   ├── health-check.js        # 环境健康检查
│   ├── start-all.sh           # 一键启动脚本（Bash）
│   └── start-all.ps1          # 一键启动脚本（PowerShell）
├── docs/                      # 项目文档
└── hardhat.config.ts
```

## 快速开始

### 前提条件

- Node.js >= 18
- Ganache（GUI 或 CLI）
- MetaMask 浏览器插件

### 1. 克隆项目

```bash
git clone <repo-url>
cd loyaltylink
npm install
```

### 2. 启动环境

```bash
# 打开 Ganache GUI（端口 7545, Chain ID 1337, 上述助记词）
# 然后运行一键启动脚本
npm start
```

脚本自动完成：检查 → 编译 → 部署 → 初始化数据 → 启动前端。

### 3. 配置 MetaMask

1. 添加自定义网络：RPC `http://127.0.0.1:7545`，Chain ID `1337`
2. 导入 Ganache 账户私钥：Account 0/1/2/4（管理员/商家/用户A/用户B）

### 4. 开始演示

| 页面 | 地址 | 角色限制 |
|:---|:---|:---|
| 管理后台 | `http://localhost:3000/admin.html` | 仅管理员（Account 0） |
| 商家后台 | `http://localhost:3000/merchant.html` | 仅商家（Account 1） |
| 用户首页 | `http://localhost:3000/index.html` | 所有用户 |
| 积分商城 | `http://localhost:3000/shop.html` | 所有用户 |
| 积分兑换 | `http://localhost:3000/redeem.html` | 所有用户 |
| 交易记录 | `http://localhost:3000/history.html` | 所有用户 |
| 水龙头 | `http://localhost:3000/faucet.html` | 所有用户 |

🎬 完整演示流程见 [docs/演示流程.md](docs/演示流程.md)。

## 合约接口

### 只读方法

| 方法 | 说明 |
|:---|:---|
| `name()` → `string` | 代币名称 |
| `symbol()` → `string` | 代币符号 |
| `balanceOf(address)` → `uint256` | 查询余额 |
| `merchants(address)` → `bool` | 查询是否为商家 |
| `owner()` → `address` | 合约所有者 |
| `exchangeRates(address)` → `uint256` | 查询商家积分汇率 |
| `lastFaucetClaim(address)` → `uint256` | 查询上次水龙头领取时间 |
| `expiryTime()` → `uint256` | 查询积分有效期（秒） |
| `FAUCET_AMOUNT()` → `uint256` | 水龙头单次领取量（5 LYL） |

### 写方法

| 方法 | 权限 | 说明 |
|:---|:---|:---|
| `addMerchant(address)` | `onlyOwner` | 添加商家 |
| `removeMerchant(address)` | `onlyOwner` | 移除商家 |
| `pause()` / `unpause()` | `onlyOwner` | 暂停/恢复合约 |
| `reward(address, uint256)` | `onlyMerchant` | 向用户发放积分（mint） |
| `spend(address, uint256)` | `onlyMerchant` | 从用户扣除积分（burn） |
| `redeemTokens(uint256)` | 任何人 | 用户自主销毁积分兑换 |
| `faucet()` | 任何人 | 领取测试积分（5 LYL/天） |
| `settle(address, uint256)` | `onlyMerchant` | 商家间结算转账 |
| `setExchangeRate(uint256)` | `onlyMerchant` | 设置积分汇率 |
| `checkAndBurnExpired(address)` | 任何人 | 检查并销毁过期积分 |
| `setExpiryTime(uint256)` | `onlyOwner` | 设置积分有效期 |
| `transfer(address, uint256)` | 任何人 | 转账积分 |
| `approve(address, uint256)` | 任何人 | 授权额度 |
| `transferFrom(address, address, uint256)` | 授权用户 | 代理转账 |
| `approve(address, uint256)` | 任何人 | 授权额度 |
| `transferFrom(address, address, uint256)` | 授权用户 | 代理转账 |

## NPM Scripts

| 命令 | 说明 |
|:---|:---|
| `npm start` | 一键启动（检查→编译→部署→初始化→前端） |
| `npm test` | 运行单元测试（48 cases） |
| `npm run compile` | 编译合约 |
| `npm run deploy:full` | 一键部署（编译 + 部署 + 更新前端地址 + 同步 ABI） |
| `npm run init` | 初始化演示数据（幂等） |

## 演示账户

使用项目共用助记词启动 Ganache，前 5 个账户：

| 索引 | 地址 | 角色 |
|:---|:---|:---|
| Account 0 | `0xed329e6792b65ff9e45b4d7cA3fF7CE59d829857` | 管理员 |
| Account 1 | `0xFed50871bBE34950e6488c532b03359156417F52` | 商家 |
| Account 2 | `0x4A52673E3B88C235DB2f5fF6a1B4f6Cb3339c2E8` | 用户 A |
| Account 4 | `0xB47e4ABEAee85B21C59e23e94A4d3AA50f7669da` | 用户 B |
