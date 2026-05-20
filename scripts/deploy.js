/**
 * 一键部署脚本
 * 用法: node scripts/deploy.js
 *
 * 功能：
 * 1. 编译合约
 * 2. 部署到 Ganache
 * 3. 自动更新前端代码中的合约地址
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { cwd: rootDir, encoding: "utf8", stdio: "pipe" });
}

async function main() {
  console.log("=== LoyaltyLink 部署脚本 ===\n");

  // 1. 编译合约
  console.log("1. 编译合约...");
  try {
    run("npx hardhat compile");
    console.log("   编译成功\n");
  } catch (e) {
    console.error("   编译失败:", e.message);
    process.exit(1);
  }

  // 2. 部署合约
  console.log("2. 部署到 Ganache...");
  try {
    // 部署并获取输出
    const deployOutput = run("npx hardhat ignition deploy ./ignition/modules/LoyaltyToken.ts --network ganache");
    console.log(deployOutput);

    // 从输出中提取合约地址
    // Hardhat Ignition 输出格式类似:
    // successfully deployed [contract Address: 0x...] or
    // deployed at 0x...
    const addressMatch = deployOutput.match(/0x[a-fA-F0-9]{40}/);
    if (!addressMatch) {
      console.error("   无法从部署输出中提取合约地址");
      console.log("   请手动查找地址并更新 frontend/app.js 和 frontend/merchant.js");
      process.exit(1);
    }

    const contractAddress = addressMatch[0];
    console.log(`   合约地址: ${contractAddress}\n`);

    // 3. 更新前端文件
    console.log("3. 更新前端代码...");

    const frontendFiles = [
      join(rootDir, "frontend", "app.js"),
      join(rootDir, "frontend", "merchant.js"),
    ];

    for (const file of frontendFiles) {
      let content = readFileSync(file, "utf8");
      content = content.replace(
        /const contractAddress = "0x[a-fA-F0-9]{40}";/,
        `const contractAddress = "${contractAddress}";`
      );
      writeFileSync(file, content, "utf8");
      console.log(`   已更新 ${file}`);
    }

    console.log("\n=== 部署完成！===");
    console.log(`合约地址: ${contractAddress}`);
    console.log("前端 app.js 和 merchant.js 已自动更新");
    console.log("请确保 MetaMask 已配置 Ganache 网络: http://127.0.0.1:7545");

  } catch (e) {
    console.error("   部署失败:", e.message);
    console.error("\n常见原因:");
    console.error("  1. Ganache 未启动 — 请先启动 Ganache");
    console.error("  2. 网络配置错误 — 检查 hardhat.config.ts 中的 Ganache 配置");
    console.error("  3. 端口被占用 — 确保 :7545 端口可用");
    process.exit(1);
  }
}

main();
