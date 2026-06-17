/**
 * 一键部署脚本
 * 用法: node scripts/deploy.js
 *
 * 功能：
 * 1. 编译合约
 * 2. 部署到 Ganache（调用 deploy-direct.js）
 * 3. 自动更新前端代码中的合约地址
 */
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { cwd: rootDir, encoding: "utf8", stdio: "inherit" });
}

async function main() {
  console.log("=== LoyaltyLink 一键部署 ===\n");

  // 1. 编译合约
  console.log("1. 编译合约...");
  try {
    run("npx hardhat compile");
    console.log("   编译成功\n");
  } catch (e) {
    console.error("   编译失败:", e.message);
    process.exit(1);
  }

  // 2. 部署合约（使用 direct 脚本绕过 Ignition 交互提示）
  console.log("2. 部署到 Ganache...");
  try {
    run("npx hardhat run scripts/deploy-direct.js --network ganache");
  } catch (e) {
    console.error("\n常见原因:");
    console.error("  1. Ganache 未启动 — 请先启动 Ganache");
    console.error("  2. 网络配置错误 — 检查 hardhat.config.ts 中的 Ganache 配置");
    console.error("  3. 端口被占用 — 确保 :7545 端口可用");
    process.exit(1);
  }
}

main();
