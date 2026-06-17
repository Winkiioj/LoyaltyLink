/**
 * 环境健康检查
 *
 * 用法:
 *   node scripts/health-check.js           输出 JSON 状态
 *   node scripts/health-check.js --deployed  合约已部署 → exit 0
 *   node scripts/health-check.js --data      数据已初始化 → exit 0
 *   node scripts/health-check.js --contract  输出合约地址到 stdout
 */

import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const RPC = "http://127.0.0.1:7545";
const MNEMONIC = "maid notable twist mutual dune speed come dolphin wet gaze scout sort";

function getContractAddress() {
  const commonJsPath = join(rootDir, "frontend", "js", "common.js");
  if (!existsSync(commonJsPath)) return null;
  const content = readFileSync(commonJsPath, "utf8");
  const match = content.match(/contractAddress\s*=\s*"0x[a-fA-F0-9]{40}"/);
  return match ? match[0].match(/0x[a-fA-F0-9]{40}/)[0] : null;
}

function deriveAddress(index) {
  const seed = ethers.Mnemonic.fromPhrase(MNEMONIC).computeSeed();
  const root = ethers.HDNodeWallet.fromSeed(seed);
  return root.derivePath(`m/44'/60'/0'/0/${index}`).address;
}

async function check() {
  const addr = getContractAddress();
  let deployed = false;
  let dataReady = false;

  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    await provider.getBlockNumber();

    if (addr) {
      const code = await provider.getCode(addr);
      if (code !== "0x") {
        deployed = true;

        // 检查演示数据
        const artifactPath = join(
          rootDir, "artifacts", "contracts", "LoyaltyToken.sol", "LoyaltyToken.json"
        );
        if (existsSync(artifactPath)) {
          const abi = JSON.parse(readFileSync(artifactPath, "utf8")).abi;
          const contract = new ethers.Contract(addr, abi, provider);

          const isMerchant = await contract.merchants(deriveAddress(1));
          const userABal = await contract.balanceOf(deriveAddress(2));
          const userBBal = await contract.balanceOf(deriveAddress(4));

          if (isMerchant && userABal > 0n && userBBal > 0n) {
            dataReady = true;
          }
        }
      }
    }
  } catch (_) {
    // Ganache 不可达
  }

  return { deployed, dataReady, contractAddr: addr || "" };
}

// ========== CLI ==========
const flag = process.argv[2];

if (flag === "--deployed") {
  const { deployed } = await check();
  process.exit(deployed ? 0 : 1);
}

if (flag === "--data") {
  const { dataReady } = await check();
  process.exit(dataReady ? 0 : 1);
}

if (flag === "--contract") {
  const { contractAddr } = await check();
  if (contractAddr) process.stdout.write(contractAddr);
  process.exit(contractAddr ? 0 : 1);
}

// 默认：输出完整 JSON
const result = await check();
console.log(JSON.stringify(result));
