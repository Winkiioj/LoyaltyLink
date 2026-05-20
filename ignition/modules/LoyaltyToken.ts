import { buildModule } from "hardhat/ignition";

const LoyaltyTokenModule = buildModule("LoyaltyTokenModule", (m) => {
  const token = m.contract("LoyaltyToken", ["LoyaltyLink", "LYL"]);
  return { token };
});

export default LoyaltyTokenModule;
