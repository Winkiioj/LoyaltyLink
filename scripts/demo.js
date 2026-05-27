/**
 * 用于 Demo 的辅助脚本：添加商家、查询信息
 * 用法: node scripts/demo.js
 */
import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const RPC = "http://127.0.0.1:7545";
const CONTRACT_ADDR = "0x8D36e0A3f6a23fCc12E206D735e71Ebd461d010d";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = await provider.getSigner();

  // 读取 ABI
  const artifactPath = join(rootDir, "artifacts", "contracts", "LoyaltyToken.sol", "LoyaltyToken.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const contract = new ethers.Contract(CONTRACT_ADDR, artifact.abi, deployer);

  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === "add-merchant") {
    const addr = args[1] || deployer.address;
    console.log(`注册商家: ${addr}`);
    const tx = await contract.addMerchant(addr);
    await tx.wait();
    console.log("✅ 商家注册成功");
  } else if (cmd === "remove-merchant") {
    const addr = args[1];
    const tx = await contract.removeMerchant(addr);
    await tx.wait();
    console.log("✅ 已移除商家:", addr);
  } else if (cmd === "is-merchant") {
    const addr = args[1] || deployer.address;
    const isM = await contract.merchants(addr);
    console.log(`${addr} 是否为商家: ${isM}`);
  } else if (cmd === "reward") {
    const user = args[1];
    const amount = args[2];
    if (!user || !amount) { console.log("用法: reward <userAddr> <amount>"); return; }
    const tx = await contract.reward(user, ethers.parseEther(amount));
    await tx.wait();
    console.log(`✅ 已向 ${user} 发放 ${amount} LYL`);
  } else if (cmd === "spend") {
    const user = args[1];
    const amount = args[2];
    if (!user || !amount) { console.log("用法: spend <userAddr> <amount>"); return; }
    const tx = await contract.spend(user, ethers.parseEther(amount));
    await tx.wait();
    console.log(`✅ 已从 ${user} 扣减 ${amount} LYL`);
  } else if (cmd === "balance") {
    const addr = args[1] || deployer.address;
    const bal = await contract.balanceOf(addr);
    console.log(`${addr} 余额: ${ethers.formatEther(bal)} LYL`);
  } else if (cmd === "info") {
    const name = await contract.name();
    const symbol = await contract.symbol();
    const supply = await contract.totalSupply();
    const owner = await contract.owner();
    console.log("=== 合约信息 ===");
    console.log(`代币: ${name} (${symbol})`);
    console.log(`总供应量: ${ethers.formatEther(supply)} LYL`);
    console.log(`所有者: ${owner}`);
    console.log(`合约地址: ${CONTRACT_ADDR}`);
  } else {
    console.log(`
用法: node scripts/demo.js <command> [args]

命令:
  add-merchant [addr]    注册商家
  remove-merchant <addr>  移除商家
  is-merchant [addr]     查询是否为商家
  reward <addr> <amount>  发放积分
  spend <addr> <amount>   扣减积分
  balance [addr]         查询余额
  info                   显示合约信息
`);
  }
}

main().catch(console.error);
