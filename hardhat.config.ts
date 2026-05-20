import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const MNEMONIC = process.env.MNEMONIC || "maid notable twist mutual dune speed come dolphin wet gaze scout sort";

export default defineConfig({
  solidity: {
    version: "0.8.20",
    settings: {
      evmVersion: "paris"
    }
  },
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
