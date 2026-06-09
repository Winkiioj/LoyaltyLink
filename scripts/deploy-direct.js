/**
 * 直接部署脚本（不使用 Ignition，解决兼容性问题）
 * 用法: npx hardhat run scripts/deploy-direct.js --network ganache
 */
import hre from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

async function main() {
  console.log("=== LoyaltyLink 直接部署 ===\n");

  const conn = await hre.network.getOrCreate();
  const ethers = conn.ethers;

  const [deployer] = await ethers.getSigners();
  console.log(`部署账户: ${deployer.address}`);
  console.log(`账户余额: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const LoyaltyToken = await ethers.getContractFactory("LoyaltyToken");
  console.log("部署 LoyaltyToken (name=LoyaltyLink, symbol=LYL)...");

  const token = await LoyaltyToken.deploy("LoyaltyLink", "LYL");
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

  // 更新前端文件（所有硬编码合约地址）
  console.log("\n3. 更新前端代码...");
  const frontendFiles = [
    join(rootDir, "frontend", "js", "common.js"),
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
    console.log(`   已更新 ${file}`);
  }

  // 同步 ABI 到前端目录
  const artifactPath = join(
    rootDir, "artifacts", "contracts", "LoyaltyToken.sol", "LoyaltyToken.json"
  );
  if (existsSync(artifactPath)) {
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const abiPath = join(rootDir, "frontend", "abi.json");
    writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`   已同步 ABI 到 frontend/abi.json (${artifact.abi.length} entries)`);
  }

  console.log("\n=== 部署完成！===");
  console.log(`合约地址: ${contractAddress}`);
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exitCode = 1;
});
