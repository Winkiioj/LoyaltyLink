# LoyaltyLink 项目 - 团队协同开发指南

## 一、前言

本文档为 LoyaltyLink 项目团队成员提供 Git 协同开发工作流的详细指导，包括分支策略、常用命令、代码规范和注意事项，确保团队高效协作。

---

## 二、Git 分支策略

### 2.1 分支结构

```
main (主分支，稳定版本)
  ↑
  └── develop (开发分支，集成最新功能)
         ↑
         ├── feature/合约开发
         ├── feature/前端开发
         ├── feature/部署配置
         ├── feature/测试
         └── bugfix/修复问题
```

### 2.2 分支说明

| 分支名称 | 用途 | 保护规则 |
| :--- | :--- | :--- |
| `main` | 生产环境稳定版本 | 禁止直接推送，仅通过 PR 合并 |
| `develop` | 开发环境集成分支 | 禁止直接推送，仅通过 PR 合并 |
| `feature/*` | 功能开发分支 | 从 `develop` 创建，完成后合并回 `develop` |
| `bugfix/*` | Bug 修复分支 | 从 `develop` 创建，完成后合并回 `develop` |
| `hotfix/*` | 紧急修复分支 | 从 `main` 创建，完成后合并回 `main` 和 `develop` |

---

## 三、首次设置

### 3.1 克隆仓库

```powershell
git clone https://github.com/Winkiioj/loyaltylink.git
cd loyaltylink
```

### 3.2 配置用户信息

```powershell
git config user.name "您的姓名"
git config user.email "您的邮箱"
```

### 3.3 安装项目依赖

```powershell
npm install
```

---

## 四、日常开发工作流

### 4.1 开始新功能开发

#### 步骤 1：拉取最新代码
```powershell
git checkout develop
git pull origin develop
```

#### 步骤 2：创建功能分支
```powershell
git checkout -b feature/功能描述
# 示例：git checkout -b feature/添加积分过期机制
```

#### 步骤 3：进行开发
```powershell
# 编辑代码...
```

#### 步骤 4：查看修改状态
```powershell
git status
```

#### 步骤 5：添加修改到暂存区
```powershell
# 添加所有修改的文件
git add .

# 或添加特定文件
git add 文件名
```

#### 步骤 6：提交修改
```powershell
git commit -m "feat: 添加积分过期机制"
```

#### 步骤 7：推送到远程仓库
```powershell
git push -u origin feature/功能描述
```

#### 步骤 8：创建 Pull Request
1. 访问 GitHub 仓库页面
2. 点击 "Compare & pull request"
3. 选择从 `feature/功能描述` 合并到 `develop`
4. 填写 PR 描述（参考第五章）
5. 提交 PR 并等待代码审查

### 4.2 修复 Bug

```powershell
# 从 develop 创建修复分支
git checkout develop
git pull origin develop
git checkout -b bugfix/问题描述

# 修复代码后提交
git add .
git commit -m "fix: 修复积分扣减时余额不足的检查逻辑"
git push -u origin bugfix/问题描述

# 创建 PR 到 develop
```

### 4.3 同步最新代码

在开发过程中，定期同步 `develop` 分支的最新代码：

```powershell
# 切换到 develop 分支
git checkout develop
git pull origin develop

# 切换回功能分支
git checkout feature/功能描述

# 合并 develop 的最新代码
git merge develop

# 如果有冲突，解决冲突后
git add .
git commit -m "merge: 同步 develop 最新代码"
git push
```

---

## 五、提交信息规范

### 5.1 提交信息格式

```
<类型>: <简短描述>

<详细描述（可选）>

<相关 Issue（可选）>
```

### 5.2 提交类型

| 类型 | 说明 | 示例 |
| :--- | :--- | :--- |
| `feat` | 新功能 | `feat: 添加积分过期机制` |
| `fix` | Bug 修复 | `fix: 修复余额查询显示错误` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `style` | 代码格式调整 | `style: 统一代码缩进` |
| `refactor` | 代码重构 | `refactor: 优化合约 gas 消耗` |
| `test` | 测试相关 | `test: 添加积分发放单元测试` |
| `chore` | 构建过程或辅助工具 | `chore: 更新依赖包版本` |

### 5.3 提交信息示例

```
feat: 添加积分过期自动销毁功能

- 新增 lastActivity 映射记录用户最后活动时间
- 新增 checkAndBurnExpired 函数检查并销毁过期积分
- 设置默认过期时间为 365 天

Closes #12
```

---

## 六、Pull Request 规范

### 6.1 PR 标题格式

```
[类型] 简短描述
```

示例：
- `[feat] 添加积分过期机制`
- `[fix] 修复商家权限验证漏洞`
- `[docs] 更新系统设计文档`

### 6.2 PR 描述模板

```markdown
## 变更说明
简要描述本次 PR 的主要内容和目的。

## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化

## 测试情况
- [ ] 单元测试已通过
- [ ] 手动测试已完成
- [ ] 代码已自审

## 相关 Issue
Closes #issue编号

## 截图（如适用）
<!-- 添加功能截图或测试截图 -->

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 已添加必要的注释
- [ ] 已更新相关文档
- [ ] 无控制台错误或警告
```

### 6.3 PR 审查流程

1. **提交 PR**：开发者提交 PR 到 `develop` 分支
2. **自动检查**：GitHub Actions 自动运行测试
3. **代码审查**：至少一名团队成员进行代码审查
4. **修改反馈**：如有问题，修改后再次提交
5. **合并 PR**：审查通过后合并到 `develop`

---

## 七、常用 Git 命令速查

### 7.1 基础命令

| 命令 | 说明 |
| :--- | :--- |
| `git status` | 查看当前状态 |
| `git log` | 查看提交历史 |
| `git diff` | 查看未暂存的修改 |
| `git diff --staged` | 查看已暂存的修改 |
| `git branch` | 查看本地分支 |
| `git branch -a` | 查看所有分支（包括远程） |
| `git checkout <分支名>` | 切换分支 |
| `git checkout -b <分支名>` | 创建并切换到新分支 |

### 7.2 提交与推送

| 命令 | 说明 |
| :--- | :--- |
| `git add .` | 添加所有修改到暂存区 |
| `git add <文件>` | 添加指定文件到暂存区 |
| `git commit -m "信息"` | 提交修改 |
| `git commit --amend` | 修改最后一次提交 |
| `git push` | 推送到远程仓库 |
| `git push -u origin <分支名>` | 推送并设置上游分支 |
| `git pull` | 拉取并合并远程代码 |

### 7.3 分支管理

| 命令 | 说明 |
| :--- | :--- |
| `git merge <分支名>` | 合并指定分支到当前分支 |
| `git rebase <分支名>` | 变基到指定分支 |
| `git branch -d <分支名>` | 删除已合并的本地分支 |
| `git branch -D <分支名>` | 强制删除本地分支 |
| `git push origin --delete <分支名>` | 删除远程分支 |

### 7.4 冲突解决

```powershell
# 当合并时出现冲突，Git 会提示冲突文件

# 1. 打开冲突文件，查找冲突标记
<<<<<<< HEAD
// 当前分支的代码
=======
// 合并分支的代码
>>>>>>> feature/xxx

# 2. 手动编辑文件，保留需要的代码，删除冲突标记

# 3. 标记冲突已解决
git add <冲突文件>

# 4. 完成合并
git commit -m "resolve: 解决合并冲突"
```

---

## 八、代码规范

### 8.1 Solidity 合约规范

#### 命名规范
```solidity
// 合约名：大驼峰
contract LoyaltyToken {}

// 函数名：小驼峰
function addMerchant() {}

// 变量名：小驼峰
mapping(address => bool) public merchants;

// 常量：全大写下划线分隔
uint256 public constant MAX_SUPPLY = 1000000;

// 事件名：大驼峰
event Reward(address indexed from, address indexed to, uint256 amount);
```

#### 注释规范
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LoyaltyToken
 * @dev 基于ERC-20的企业联盟积分合约
 */
contract LoyaltyToken is ERC20, Ownable {
    /**
     * @dev 添加商家到白名单
     * @param merchant 商家地址
     */
    function addMerchant(address merchant) external onlyOwner {
        // 实现代码
    }
}
```

### 8.2 JavaScript/TypeScript 规范

#### 命名规范
```javascript
// 变量：小驼峰
let currentAccount;
let userBalance;

// 常量：全大写下划线分隔
const CONTRACT_ADDRESS = '0x...';

// 函数：小驼峰
function connectWallet() {}
function updateBalance() {}

// 类：大驼峰
class LoyaltyToken {}
```

#### 代码风格
```javascript
// 使用 const/let，避免 var
const web3 = new Web3(window.ethereum);

// 使用箭头函数
const getBalance = async (account) => {
    const balance = await contract.methods.balanceOf(account).call();
    return balance;
};

// 添加错误处理
try {
    await contract.methods.reward(user, amount).send({ from: account });
} catch (error) {
    console.error('发放积分失败:', error);
    alert('操作失败，请重试');
}
```

---

## 九、注意事项

### 9.1 开发前必读

| 注意事项 | 说明 |
| :--- | :--- |
| **始终从 develop 创建分支** | 不要从 main 创建功能分支 |
| **定期同步最新代码** | 每天开始工作前先 `git pull` |
| **小步提交** | 频繁提交，每次提交保持小而清晰 |
| **提交前自测** | 确保代码能正常运行 |
| **不要提交敏感信息** | 私钥、助记词等不要提交到仓库 |

### 9.2 禁止操作

| 禁止操作 | 原因 | 替代方案 |
| :--- | :--- | :--- |
| 直接推送到 main/develop | 破坏分支稳定性 | 通过 PR 合并 |
| 提交 node_modules | 文件过大，已有 .gitignore | 使用 `npm install` 安装 |
| 提交编译后的文件 | 可自动生成 | 添加到 .gitignore |
| 强制推送到公共分支 | 覆盖他人代码 | 使用正常推送流程 |
| 提交大文件 | 仓库膨胀 | 使用 Git LFS 或外部存储 |

### 9.3 常见问题处理

#### 问题 1：推送被拒绝
```powershell
# 错误信息：Updates were rejected because the remote contains work that you do not have locally

# 解决方案：先拉取再推送
git pull origin develop
# 解决冲突后
git push
```

#### 问题 2：提交了错误文件
```powershell
# 撤销最后一次提交（保留修改）
git reset --soft HEAD~1

# 或完全撤销最后一次提交（丢弃修改）
git reset --hard HEAD~1
```

#### 问题 3：忘记拉取最新代码
```powershell
# 先暂存当前修改
git stash

# 拉取最新代码
git pull origin develop

# 恢复暂存的修改
git stash pop
```

#### 问题 4：分支名错误
```powershell
# 重命名本地分支
git branch -m 旧分支名 新分支名

# 重命名远程分支
git push origin :旧分支名
git push origin 新分支名
```

---

## 十、团队协作最佳实践

### 10.1 沟通机制

| 场景 | 沟通方式 |
| :--- | :--- |
| 开始新功能前 | 在团队群说明功能范围和计划 |
| 遇到技术难题 | 提出问题，寻求团队讨论 |
| 代码审查 | 及时响应 PR 评论，快速修改 |
| 发布新版本 | 提前通知团队，准备部署 |

### 10.2 代码审查要点

审查者应检查：
- [ ] 代码逻辑正确性
- [ ] 是否符合项目规范
- [ ] 是否有安全漏洞
- [ ] 是否有性能问题
- [ ] 是否有充分的注释
- [ ] 测试覆盖是否充分

### 10.3 发布流程

```
1. develop 分支测试通过
2. 创建 PR 从 develop 到 main
3. 代码审查通过
4. 合并到 main
5. 打 tag 标记版本号
6. 部署到生产环境
```

---

## 十一、故障排查

### 11.1 Git 状态异常

```powershell
# 查看详细状态
git status -v

# 查看未跟踪文件
git clean -n

# 清理未跟踪文件（谨慎使用）
git clean -f
```

### 11.2 远程仓库连接问题

```powershell
# 查看远程仓库地址
git remote -v

# 修改远程仓库地址
git remote set-url origin https://github.com/新用户名/loyaltylink.git

# 测试连接
git ls-remote origin
```

---

## 十二、联系与支持

| 问题类型 | 联系人 |
| :--- | :--- |
| Git 操作问题 | 项目管理员 |
| 代码审查问题 | 相关模块负责人 |
| 部署相关问题 | DevOps 负责人 |
| 文档相关问题 | 技术文档负责人 |

---

**文档版本**: v1.0  
**最后更新**: 2026年4月  
**维护者**: LoyaltyLink 开发团队