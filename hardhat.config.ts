import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";


const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    ganache: {
 type: "http",
      url: "http://127.0.0.1:7545",
      chainId: 1337,
      accounts: {
        mnemonic: "quick snow fox erode faith inject excite moment tunnel lamp crazy repeat"
      
      }
    }
  }
};

export default config;
