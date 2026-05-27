/**
 * 直接部署脚本（ethers.js 直接连接 Ganache）
 * 用法: node scripts/deploy-ethers.js
 */
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

async function main() {
  console.log("=== LoyaltyLink 直接部署 (ethers) ===\n");

  // 连接 Ganache
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");
  const deployer = await provider.getSigner();
  console.log(`部署账户: ${deployer.address}`);
  console.log(`账户余额: ${ethers.formatEther(await provider.getBalance(deployer.address))} ETH\n`);

  // 读取编译好的 artifact
  const artifactPath = join(rootDir, "artifacts", "contracts", "LoyaltyToken.sol", "LoyaltyToken.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  const abi = artifact.abi;
  const bytecode = artifact.bytecode;

  // 部署合约
  console.log("部署 LoyaltyToken (name=LoyaltyLink, symbol=LYL)...");
  const factory = new ethers.ContractFactory(abi, bytecode, deployer);
  const token = await factory.deploy("LoyaltyLink", "LYL");
  await token.waitForDeployment();

  const contractAddress = await token.getAddress();
  console.log(`\n✅ 部署成功!`);
  console.log(`合约地址: ${contractAddress}\n`);

  // 验证部署
  const name = await token.name();
  const symbol = await token.symbol();
  const totalSupply = await token.totalSupply();
  const owner = await token.owner();

  console.log("=== 合约信息 ===");
  console.log(`代币名称: ${name}`);
  console.log(`代币符号: ${symbol}`);
  console.log(`总供应量: ${totalSupply}`);
  console.log(`合约所有者: ${owner}`);

  // 更新前端文件
  console.log("\n=== 更新前端代码... ===");
  const frontendFiles = [
    join(rootDir, "frontend", "app.js"),
    join(rootDir, "frontend", "merchant.js"),
    join(rootDir, "frontend", "admin.js"),
  ];

  for (const file of frontendFiles) {
    let content = readFileSync(file, "utf8");
    content = content.replace(
      /const contractAddress = "0x[a-fA-F0-9]{40}";/,
      `const contractAddress = "${contractAddress}";`
    );
    writeFileSync(file, content, "utf8");
    console.log(`已更新 ${file}`);
  }

  console.log(`\n✅ 部署完成！合约地址: ${contractAddress}`);
  console.log("请确保 MetaMask 已配置 Ganache 网络: http://127.0.0.1:7545");
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exitCode = 1;
});
