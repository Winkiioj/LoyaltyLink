/**
 * CLI 演示工具 — 添加商家、发放/扣减积分、查询余额
 * 用法: node scripts/demo.js <command> [args]
 *
 * 合约地址自动从 Ignition 部署产物中读取
 */
import { ethers } from "ethers";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const RPC = "http://127.0.0.1:7545";

// ========== 自动读取合约地址 ==========
function getContractAddress() {
  // 优先从 Ignition 部署产物读取
  const deployDir = join(rootDir, "ignition", "deployments");
  if (existsSync(deployDir)) {
    let dirs = [];
    try { dirs = readdirSync(deployDir); } catch (e) { /* ignore */ }
    for (const dir of dirs) {
      const deployedPath = join(deployDir, dir, "deployed_addresses.json");
      if (existsSync(deployedPath)) {
        try {
          const data = JSON.parse(readFileSync(deployedPath, "utf8"));
          const addr = data["LoyaltyTokenModule#LoyaltyToken"];
          if (addr) return addr;
        } catch (e) { /* 继续尝试 */ }
      }
    }
  }

  // 回退：从 frontend/common.js 中读取
  const commonJsPath = join(rootDir, "frontend", "js", "common.js");
  if (existsSync(commonJsPath)) {
    const content = readFileSync(commonJsPath, "utf8");
    const match = content.match(/contractAddress\s*=\s*"0x[a-fA-F0-9]{40}"/);
    if (match) {
      return match[0].match(/0x[a-fA-F0-9]{40}/)[0];
    }
  }

  // 最后回退：从 frontend/app.js 中读取
  const appJsPath = join(rootDir, "frontend", "app.js");
  if (existsSync(appJsPath)) {
    const content = readFileSync(appJsPath, "utf8");
    const match = content.match(/contractAddress\s*=\s*"0x[a-fA-F0-9]{40}"/);
    if (match) {
      return match[0].match(/0x[a-fA-F0-9]{40}/)[0];
    }
  }

  throw new Error("未找到合约地址，请先运行 npm run deploy:full");
}

const CONTRACT_ADDR = getContractAddress();

async function main() {
  console.log("合约地址: " + CONTRACT_ADDR + "\n");

  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = await provider.getSigner();

  // 读取 ABI
  const artifactPath = join(rootDir, "artifacts", "contracts", "LoyaltyToken.sol", "LoyaltyToken.json");
  if (!existsSync(artifactPath)) {
    console.error("错误: 未找到合约编译产物，请先运行 npx hardhat compile");
    process.exit(1);
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const contract = new ethers.Contract(CONTRACT_ADDR, artifact.abi, deployer);

  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === "add-merchant") {
    const addr = args[1] || (await deployer.getAddress());
    console.log("注册商家: " + addr);
    const tx = await contract.addMerchant(addr);
    await tx.wait();
    console.log("✅ 商家注册成功");
  } else if (cmd === "remove-merchant") {
    const addr = args[1];
    if (!addr) { console.log("用法: remove-merchant <addr>"); return; }
    const tx = await contract.removeMerchant(addr);
    await tx.wait();
    console.log("✅ 已移除商家: " + addr);
  } else if (cmd === "is-merchant") {
    const addr = args[1] || (await deployer.getAddress());
    const isM = await contract.merchants(addr);
    console.log(addr + " 是否为商家: " + isM);
  } else if (cmd === "reward") {
    const user = args[1];
    const amount = args[2];
    if (!user || !amount) { console.log("用法: reward <userAddr> <amount>"); return; }
    const tx = await contract.reward(user, ethers.parseEther(amount));
    await tx.wait();
    console.log("✅ 已向 " + user + " 发放 " + amount + " LYL");
  } else if (cmd === "spend") {
    const user = args[1];
    const amount = args[2];
    if (!user || !amount) { console.log("用法: spend <userAddr> <amount>"); return; }
    const tx = await contract.spend(user, ethers.parseEther(amount));
    await tx.wait();
    console.log("✅ 已从 " + user + " 扣减 " + amount + " LYL");
  } else if (cmd === "balance") {
    const addr = args[1] || (await deployer.getAddress());
    const bal = await contract.balanceOf(addr);
    console.log(addr + " 余额: " + ethers.formatEther(bal) + " LYL");
  } else if (cmd === "info") {
    const name = await contract.name();
    const symbol = await contract.symbol();
    const supply = await contract.totalSupply();
    const owner = await contract.owner();
    const paused = await contract.paused().catch(() => false);
    console.log("=== 合约信息 ===");
    console.log("代币: " + name + " (" + symbol + ")");
    console.log("总供应量: " + ethers.formatEther(supply) + " LYL");
    console.log("所有者: " + owner);
    console.log("暂停状态: " + (paused ? "已暂停" : "运行中"));
    console.log("合约地址: " + CONTRACT_ADDR);
  } else if (cmd === "pause") {
    const tx = await contract.pause();
    await tx.wait();
    console.log("✅ 合约已暂停");
  } else if (cmd === "unpause") {
    const tx = await contract.unpause();
    await tx.wait();
    console.log("✅ 合约已恢复");
  } else {
    console.log(`
用法: node scripts/demo.js <command> [args]

命令:
  add-merchant [addr]      注册商家
  remove-merchant <addr>   移除商家
  is-merchant [addr]       查询是否为商家
  reward <addr> <amount>   发放积分
  spend <addr> <amount>    扣减积分
  balance [addr]           查询余额
  info                     显示合约信息
  pause                    暂停合约（仅 Owner）
  unpause                  恢复合约（仅 Owner）
`);
  }
}

main().catch(console.error);
