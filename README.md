# LoyaltyLink — 基于 ERC-20 的企业联盟通用积分系统

基于以太坊 ERC-20 标准构建的去中心化积分平台，解决传统积分体系**价值低、兑换门槛高、易过期、跨商家不互通**的痛点。通过智能合约实现积分在联盟商家间的通存通兑，用户可自由转账，所有交易链上可查、不可篡改。

## 核心特性

- **去中心化积分** — 积分作为 ERC-20 代币存储在链上，用户拥有完全自主权
- **商家联盟管理** — 管理员可动态添加/移除联盟商家，无需重新部署合约
- **积分发行与消费** — 商家通过 `reward` 铸币发放积分，通过 `spend` 销毁积分完成消费
- **用户自由转账** — 支持积分在任意地址间点对点转账
- **权限分级** — 三级角色（管理员 / 商家 / 用户），OpenZeppelin Ownable + 自定义 modifier 控制

## 技术栈

| 层级 | 组件 | 版本 |
|:---|:---|:---|
| 区块链网络 | Ganache (本地测试链) | 7.x |
| 智能合约框架 | Hardhat | 3.x |
| 合约语言 | Solidity | 0.8.20 |
| 安全库 | OpenZeppelin Contracts | 5.x |
| 前端 | 原生 HTML/CSS/JS + Web3.js | 1.8.0 |
| 钱包 | MetaMask | 最新版 |
| 测试 | Hardhat + Mocha + Chai + Ethers.js | — |

## 项目结构

```
loyaltylink/
├── contracts/                 # 智能合约
│   └── LoyaltyToken.sol       # ERC-20 积分代币（含商家权限）
├── test/
│   └── LoyaltyToken.test.ts   # 单元测试（31 个用例）
├── ignition/modules/
│   └── LoyaltyToken.ts        # Hardhat Ignition 部署模块
├── frontend/                  # 前端页面
│   ├── index.html + app.js    # 用户端（余额查询、积分转账）
│   ├── merchant.html + merchant.js  # 商户端（发放积分、扣除积分）
│   ├── admin.html + admin.js  # 管理端（商家白名单管理）
│   ├── style.css              # 共用样式
│   └── abi.json               # 合约 ABI
├── scripts/
│   ├── deploy.js              # 一键部署（编译 + 部署 + 更新前端地址）
│   ├── deploy-direct.js       # Hardhat 直接部署
│   ├── deploy-ethers.js       # Ethers.js 直接部署
│   └── demo.js                # CLI 演示工具
├── docs/                      # 项目文档
│   ├── 需求分析.md
│   ├── 系统设计文档.md
│   ├── 环境配置-已验证.md
│   ├── 详细分工.md
│   ├── 演示流程.md
│   ├── 组员拉取运行指南.md
│   └── CONTRIBUTING.md
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

### 2. 启动 Ganache

```bash
# 使用项目共用助记词（10 个账户各 100 ETH）
npx ganache --port 7545 --chain.chainId 1337 \
  --wallet.mnemonic "maid notable twist mutual dune speed come dolphin wet gaze scout sort"
```

### 3. 编译合约

```bash
npx hardhat compile
```

### 4. 运行测试

```bash
npx hardhat test
```

### 5. 部署合约

```bash
npm run deploy:full
# 或：npx hardhat ignition deploy ./ignition/modules/LoyaltyToken.ts --network ganache
```

部署成功后，`frontend/app.js`、`frontend/merchant.js`、`frontend/admin.js` 中的合约地址会自动更新。

### 6. 启动前端

```bash
npx http-server frontend/ -p 3000 -c-1
```

### 7. 配置 MetaMask

1. 添加自定义网络：RPC `http://127.0.0.1:7545`，Chain ID `1337`
2. 导入 Ganache 账户私钥（至少导入 Account 0、1、2 分别作为管理员、商家、用户）

### 8. 开始使用

| 页面 | 地址 | 角色 |
|:---|:---|:---|
| 管理端 | `http://localhost:3000/admin.html` | 管理员（Account 0） |
| 商户端 | `http://localhost:3000/merchant.html` | 商家（Account 1） |
| 用户端 | `http://localhost:3000/index.html` | 用户（Account 2+） |

完整演示流程见 [docs/演示流程.md](docs/演示流程.md)。

## 合约接口

### 只读方法

| 方法 | 说明 |
|:---|:---|
| `name()` → `string` | 代币名称 |
| `symbol()` → `string` | 代币符号 |
| `balanceOf(address)` → `uint256` | 查询余额 |
| `merchants(address)` → `bool` | 查询是否为商家 |
| `owner()` → `address` | 合约所有者 |

### 写方法

| 方法 | 权限 | 说明 |
|:---|:---|:---|
| `addMerchant(address)` | `onlyOwner` | 添加商家 |
| `removeMerchant(address)` | `onlyOwner` | 移除商家 |
| `reward(address, uint256)` | `onlyMerchant` | 向用户发放积分（mint） |
| `spend(address, uint256)` | `onlyMerchant` | 从用户扣除积分（burn） |
| `transfer(address, uint256)` | 任何人 | 转账积分 |
| `approve(address, uint256)` | 任何人 | 授权额度 |
| `transferFrom(address, address, uint256)` | 授权用户 | 代理转账 |

## NPM Scripts

| 命令 | 说明 |
|:---|:---|
| `npm run compile` | 编译合约 |
| `npm test` | 运行单元测试 |
| `npm run deploy` | 用 Hardhat Ignition 部署 |
| `npm run deploy:full` | 一键部署（编译 + 部署 + 更新前端地址） |

## 演示账户

使用项目共用助记词启动 Ganache，前 5 个账户：

| 索引 | 地址 | 角色 |
|:---|:---|:---|
| Account 0 | `0x6f5F0Bb0B2167C386bA9AEb420e7Bf4ef0E2f3F5` | 管理员 |
| Account 1 | `0x2E41528A488d166B8c1EEaeC2e271A979Ff5cB82` | 商家 |
| Account 2 | `0x31FE47b6b4aEF60b5971735aE7C0836E1173743E` | 用户 A |
| Account 3 | `0xa0C19A4F28ADac0d2aA4C244Bee5d5E52F781Ca1` | 用户 B |
| Account 4 | `0x041CDFebb3723e9eDad09b057b694a4b27573Ad4` | — |
