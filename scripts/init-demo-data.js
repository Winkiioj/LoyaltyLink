/**
 * 演示环境初始化脚本 — 恢复完整演示数据
 *
 * 做什么：
 *   1. 注册 Account 1 为联盟商家
 *   2. 向 Account 2（用户A）发放 5000 LYL 初始积分
 *   3. 向 Account 4（用户B）发放 2000 LYL 初始积分
 *
 * 前提：
 *   - Ganache 已在 localhost:7545 运行
 *   - 合约已部署（deploy-direct.js 已执行）
 *
 * 用法: node scripts/init-demo-data.js
 *
 * 实现要点：
 *   - 使用 Ganache 内置已解锁账户签名（不创建 HDNodeWallet），nonce 由 Ganache 统一管理
 *   - 幂等设计：已有数据自动跳过
 */

import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// ========== 配置（与 hardhat.config.ts 保持一致） ==========
const RPC = "http://127.0.0.1:7545";
const MNEMONIC = "maid notable twist mutual dune speed come dolphin wet gaze scout sort";

// ========== 从助记词派生账户地址（仅地址字符串，不创建钱包） ==========
function deriveAddresses(mnemonic, count) {
  const seed = ethers.Mnemonic.fromPhrase(mnemonic).computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const addresses = [];
  for (let i = 0; i < count; i++) {
    const wallet = rootNode.derivePath(`m/44'/60'/0'/0/${i}`);
    addresses.push(wallet.address);
  }
  return addresses;
}

// ========== 读取合约地址（优先 common.js） ==========
function getContractAddress() {
  const commonJsPath = join(rootDir, "frontend", "js", "common.js");
  if (existsSync(commonJsPath)) {
    const content = readFileSync(commonJsPath, "utf8");
    const match = content.match(/contractAddress\s*=\s*"0x[a-fA-F0-9]{40}"/);
    if (match) {
      return match[0].match(/0x[a-fA-F0-9]{40}/)[0];
    }
  }
  throw new Error("未找到合约地址，请先运行 npm run deploy:full");
}

// ========== 加载合约 ABI ==========
function loadArtifact() {
  const artifactPath = join(
    rootDir, "artifacts", "contracts", "LoyaltyToken.sol", "LoyaltyToken.json"
  );
  if (!existsSync(artifactPath)) {
    console.error("❌ 未找到合约编译产物，请先运行 npx hardhat compile");
    process.exit(1);
  }
  return JSON.parse(readFileSync(artifactPath, "utf8")).abi;
}

// ========== 等待交易确认，失败则重试一次 ==========
async function sendAndWait(contractMethod, label) {
  // 在 Ganache 中每条交易后短暂等待，确保 nonce 及时更新
  const tx = await contractMethod;
  console.log(`   TX: ${tx.hash}`);
  await tx.wait();
  // 给 Ganache 一点时间更新内部状态
  await new Promise(r => setTimeout(r, 100));
  console.log(`   ✅ ${label}`);
}

// ========== 主流程 ==========
async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  LoyaltyLink 演示环境初始化         ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. 连接 Ganache
  const provider = new ethers.JsonRpcProvider(RPC);
  const network = await provider.getNetwork();
  console.log(`🔗 已连接 Ganache (Chain ID: ${network.chainId})`);

  // 2. 从助记词推导地址（仅用于显示和创建 signer）
  //    用户B 在 MetaMask 中使用 Account 4，故派生 5 个
  const addrs = deriveAddresses(MNEMONIC, 5);
  const [admin, merchant, userA, , userB] = addrs; // Account 3 未使用

  console.log("📋 派生账户：");
  console.log(`  Account 0 (管理员): ${admin}`);
  console.log(`  Account 1 (商家):   ${merchant}`);
  console.log(`  Account 2 (用户A):  ${userA}`);
  console.log(`  Account 4 (用户B):  ${userB}`);
  console.log();

  // 3. 使用 Ganache 内置已解锁账户创建签名器（nonce 由 Ganache 服务端管理）
  //    关键：不用 HDNodeWallet.connect()，避免 ethers 客户端 nonce 与链上不同步
  const adminSigner = await provider.getSigner(admin);
  const merchantSigner = await provider.getSigner(merchant);

  const contractAddr = getContractAddress();
  console.log(`📄 合约地址: ${contractAddr}`);

  const abi = loadArtifact();
  const contract = new ethers.Contract(contractAddr, abi, adminSigner);
  const merchantContract = new ethers.Contract(contractAddr, abi, merchantSigner);

  // 验证部署状态
  const name = await contract.name();
  const symbol = await contract.symbol();
  const owner = await contract.owner();
  console.log(`   代币: ${name} (${symbol}) | Owner: ${owner}`);

  if (owner.toLowerCase() !== admin.toLowerCase()) {
    console.warn(`⚠️  合约 owner (${owner}) 与派生地址 (${admin}) 不一致`);
    console.warn(`   请确认 Ganache 使用了项目指定的助记词。`);
  }
  console.log();

  // 4. 检查现有状态（幂等设计）
  const isMerchant = await contract.merchants(merchant);
  const userABalance = await contract.balanceOf(userA);
  const userBBalance = await contract.balanceOf(userB);

  if (isMerchant) {
    console.log("⏭️  Account 1 已是商家，跳过添加。");
  }
  if (userABalance > 0n) {
    console.log(`⏭️  Account 2 (用户A) 已有余额 ${ethers.formatEther(userABalance)} LYL，跳过发放。`);
  }
  if (userBBalance > 0n) {
    console.log(`⏭️  Account 4 (用户B) 已有余额 ${ethers.formatEther(userBBalance)} LYL，跳过发放。`);
  }

  if (isMerchant && userABalance > 0n && userBBalance > 0n) {
    console.log("\n✅ 演示数据已完整，无需初始化。");
    printSummary(contract, ethers, addrs);
    return;
  }
  console.log();

  // 5. 添加商家（管理员操作）
  if (!isMerchant) {
    console.log(`👤 添加商家: ${merchant}`);
    console.log("   → Account 1 将拥有 reward() / spend() 权限");
    try {
      await sendAndWait(contract.addMerchant(merchant), "商家添加成功");
    } catch (err) {
      console.error(`   ❌ 添加商家失败: ${err.message}\n`);
    }
    console.log();
  }

  // 6. 发放初始积分（商家操作，reward 需要 onlyMerchant 权限）
  const rewards = [
    { addr: userA, amount: "5000", label: "Account 2 (用户A)" },
    { addr: userB, amount: "2000", label: "Account 4 (用户B)" },
  ];

  for (const r of rewards) {
    const currentBal = await contract.balanceOf(r.addr);
    if (currentBal > 0n) continue;

    console.log(`🎁 向 ${r.label} 发放 ${r.amount} LYL`);
    console.log(`   地址: ${r.addr}`);
    try {
      await sendAndWait(
        merchantContract.reward(r.addr, ethers.parseEther(r.amount)),
        "发放成功"
      );
      console.log();
    } catch (err) {
      console.error(`   ❌ 发放失败: ${err.message}\n`);
    }
  }

  // 7. 输出最终状态
  console.log("═══════════════════════════════════════");
  console.log("  初始化完成");
  console.log("═══════════════════════════════════════\n");
  printSummary(contract, ethers, [admin, merchant, userA, userB]);
}

async function printSummary(contract, ethers, addrs) {
  const [admin, merchant, userA, userB] = addrs; // userB = Account 4
  const paused = await contract.paused().catch(() => false);

  console.log("📊 当前链上状态：");
  console.log(`  合约暂停:  ${paused ? "⚠️ 已暂停" : "✅ 运行中"}`);
  console.log(`  总供应量:  ${ethers.formatEther(await contract.totalSupply())} LYL`);
  console.log();

  console.log("👥 账户状态：");
  console.log(`  Account 0  管理员  ${admin}`);
  console.log(`  Account 1  商家    ${merchant}  (${(await contract.merchants(merchant)) ? "✅ 已注册" : "❌ 未注册"})`);
  console.log(`  Account 2  用户A   ${userA}  余额: ${ethers.formatEther(await contract.balanceOf(userA))} LYL`);
  console.log(`  Account 4  用户B   ${userB}  余额: ${ethers.formatEther(await contract.balanceOf(userB))} LYL`);
  console.log();

  console.log("💡 下一步：");
  console.log("  npx http-server frontend/ -p 3000 -c-1");
  console.log("  打开浏览器 → http://localhost:3000");
  console.log("  在 MetaMask 中导入 Account 0/1/2 的私钥");
  console.log();
}

main().catch((err) => {
  console.error("初始化失败:", err);
  process.exitCode = 1;
});
