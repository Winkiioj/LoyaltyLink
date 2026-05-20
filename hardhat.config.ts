import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const MNEMONIC = process.env.MNEMONIC || "quick snow fox erode faith inject excite moment tunnel lamp crazy repeat";

export default defineConfig({
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
  },
  plugins: [hardhatToolboxMochaEthers],
});
