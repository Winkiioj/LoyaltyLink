import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";

// 从环境变量读取助记词，如果没有则使用默认的 Hardhat 测试助记词
// 如果连接自己的 Ganache，请替换成你 Ganache 显示的助记词
const MNEMONIC = process.env.MNEMONIC || "test test test test test test test test test test test junk";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      type: "http",
      url: process.env.GANACHE_RPC || "http://127.0.0.1:7545",
      chainId: 1337,
      accounts: {
        mnemonic: MNEMONIC
      }
    }
  }
};

export default config;
