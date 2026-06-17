import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LoyaltyTokenModule = buildModule("LoyaltyTokenModule", (m) => {
    const token = m.contract("LoyaltyToken", ["LoyaltyLink", "LYL"]);
    return { token };
});

export default LoyaltyTokenModule;
