import { expect } from "chai";
import hre from "hardhat";

describe("LoyaltyToken", function () {
    // 全局变量，每个测试前重新部署
    let token: any;
    let owner: any, merchant1: any, merchant2: any, user1: any, user2: any, otherUser: any;
    let ethers: any;

    beforeEach(async function () {
        const conn = await hre.network.getOrCreate();
        ethers = conn.ethers;
        const signers = await ethers.getSigners();
        owner = signers[0];
        merchant1 = signers[1];
        merchant2 = signers[2];
        user1 = signers[3];
        user2 = signers[4];
        otherUser = signers[5];

        const LoyaltyToken = await ethers.getContractFactory("LoyaltyToken");
        token = await LoyaltyToken.deploy("LoyaltyLink", "LYL");
    });

    describe("部署", function () {
        it("应正确设置代币名称和符号", async function () {
            expect(await token.name()).to.equal("LoyaltyLink");
            expect(await token.symbol()).to.equal("LYL");
        });

        it("合约部署者应为合约所有者（Owner）", async function () {
            expect(await token.owner()).to.equal(owner.address);
        });

        it("初始总供应量应为 0", async function () {
            expect(await token.totalSupply()).to.equal(0);
        });

        it("任何地址初始余额应为 0", async function () {
            expect(await token.balanceOf(user1.address)).to.equal(0);
        });

        it("部署后不应有任何商家", async function () {
            expect(await token.merchants(merchant1.address)).to.be.false;
        });
    });

    describe("商家权限管理", function () {
        it("Owner 可以添加商家", async function () {
            await expect(token.addMerchant(merchant1.address))
                .to.emit(token, "MerchantAdded")
                .withArgs(merchant1.address);
            expect(await token.merchants(merchant1.address)).to.be.true;
        });

        it("Owner 可以移除商家", async function () {
            await token.addMerchant(merchant1.address);
            await expect(token.removeMerchant(merchant1.address))
                .to.emit(token, "MerchantRemoved")
                .withArgs(merchant1.address);
            expect(await token.merchants(merchant1.address)).to.be.false;
        });

        it("非 Owner 不能添加商家", async function () {
            await expect(
                token.connect(user1).addMerchant(merchant1.address)
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });

        it("非 Owner 不能移除商家", async function () {
            await token.addMerchant(merchant1.address);
            await expect(
                token.connect(user1).removeMerchant(merchant1.address)
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });

        it("可以添加多个商家", async function () {
            await token.addMerchant(merchant1.address);
            await token.addMerchant(merchant2.address);
            expect(await token.merchants(merchant1.address)).to.be.true;
            expect(await token.merchants(merchant2.address)).to.be.true;
        });

        it("重复添加同一商家应保持 true", async function () {
            await token.addMerchant(merchant1.address);
            await token.addMerchant(merchant1.address);
            expect(await token.merchants(merchant1.address)).to.be.true;
        });

        it("移除未添加的商家不应报错", async function () {
            await token.removeMerchant(merchant1.address);
            expect(await token.merchants(merchant1.address)).to.be.false;
        });
    });

    describe("积分发放（reward）", function () {
        it("商家可以向用户发放积分", async function () {
            await token.addMerchant(merchant1.address);
            await expect(token.connect(merchant1).reward(user1.address, 100))
                .to.emit(token, "Reward")
                .withArgs(merchant1.address, user1.address, 100);
            expect(await token.balanceOf(user1.address)).to.equal(100);
            expect(await token.totalSupply()).to.equal(100);
        });

        it("非商家不能发放积分", async function () {
            await expect(
                token.connect(user1).reward(otherUser.address, 100)
            ).to.be.revertedWith("LoyaltyToken: Not a merchant");
        });

        it("商家可以向多个用户发放积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 50);
            await token.connect(merchant1).reward(user2.address, 30);
            expect(await token.balanceOf(user1.address)).to.equal(50);
            expect(await token.balanceOf(user2.address)).to.equal(30);
            expect(await token.totalSupply()).to.equal(80);
        });

        it("可以向同一用户多次发放积分（累计）", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.connect(merchant1).reward(user1.address, 200);
            expect(await token.balanceOf(user1.address)).to.equal(300);
        });

        it("发放 0 积分也可以（边界情况）", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 0);
            expect(await token.balanceOf(user1.address)).to.equal(0);
        });
    });

    describe("积分消费（spend）", function () {
        it("商家可以从用户扣减积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await expect(token.connect(merchant1).spend(user1.address, 50))
                .to.emit(token, "Spend")
                .withArgs(merchant1.address, user1.address, 50);
            expect(await token.balanceOf(user1.address)).to.equal(50);
            expect(await token.totalSupply()).to.equal(50);
        });

        it("非商家不能扣减积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await expect(
                token.connect(user2).spend(user1.address, 50)
            ).to.be.revertedWith("LoyaltyToken: Not a merchant");
        });

        it("余额不足时应回退交易", async function () {
            await token.addMerchant(merchant1.address);
            await expect(
                token.connect(merchant1).spend(user1.address, 100)
            ).to.be.revertedWith("LoyaltyToken: Insufficient balance");
        });

        it("不能扣减超过余额的积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 50);
            await expect(
                token.connect(merchant1).spend(user1.address, 100)
            ).to.be.revertedWith("LoyaltyToken: Insufficient balance");
        });

        it("扣减全部积分后余额为 0", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.connect(merchant1).spend(user1.address, 100);
            expect(await token.balanceOf(user1.address)).to.equal(0);
            expect(await token.totalSupply()).to.equal(0);
        });
    });

    describe("积分兑换（redeemTokens）", function () {
        it("用户可以主动销毁自己的积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await expect(token.connect(user1).redeemTokens(30))
                .to.emit(token, "TokensRedeemed")
                .withArgs(user1.address, 30);
            expect(await token.balanceOf(user1.address)).to.equal(70);
            expect(await token.totalSupply()).to.equal(70);
        });

        it("任何人（包括非商家）都可以销毁自己的积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 50);
            // user1 不是商家，但可以销毁自己的积分
            await token.connect(user1).redeemTokens(50);
            expect(await token.balanceOf(user1.address)).to.equal(0);
        });

        it("余额不足时销毁应回退", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 10);
            await expect(
                token.connect(user1).redeemTokens(20)
            ).to.be.revertedWith("LoyaltyToken: Insufficient balance");
        });

        it("销毁 0 积分也可以（边界情况）", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 10);
            await token.connect(user1).redeemTokens(0);
            expect(await token.balanceOf(user1.address)).to.equal(10);
        });

        it("暂停后不能销毁积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.pause();
            await expect(
                token.connect(user1).redeemTokens(10)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });
    });

    describe("ERC-20 标准功能", function () {
        it("用户间可以转账积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await expect(token.connect(user1).transfer(user2.address, 40))
                .to.emit(token, "Transfer")
                .withArgs(user1.address, user2.address, 40);
            expect(await token.balanceOf(user1.address)).to.equal(60);
            expect(await token.balanceOf(user2.address)).to.equal(40);
        });

        it("转账金额不足时应回退", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 10);
            await expect(
                token.connect(user1).transfer(user2.address, 100)
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
        });

        it("用户可以通过 approve + transferFrom 实现代付", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.connect(user1).approve(user2.address, 50);
            await token.connect(user2).transferFrom(user1.address, user2.address, 50);
            expect(await token.balanceOf(user1.address)).to.equal(50);
            expect(await token.balanceOf(user2.address)).to.equal(50);
        });

        it("总供应量等于所有地址余额之和", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.connect(merchant1).reward(user2.address, 200);
            const totalSupply = await token.totalSupply();
            const balance1 = await token.balanceOf(user1.address);
            const balance2 = await token.balanceOf(user2.address);
            expect(totalSupply).to.equal(balance1 + balance2);
        });
    });

    describe("完整业务流程", function () {
        it("模拟完整积分生命周期：发放 → 转账 → 消费", async function () {
            // 1. Owner 添加商家
            await token.addMerchant(merchant1.address);
            expect(await token.merchants(merchant1.address)).to.be.true;

            // 2. 商家给 user1 发放积分
            await token.connect(merchant1).reward(user1.address, 500);
            expect(await token.balanceOf(user1.address)).to.equal(500);

            // 3. user1 转账给 user2
            await token.connect(user1).transfer(user2.address, 200);
            expect(await token.balanceOf(user1.address)).to.equal(300);
            expect(await token.balanceOf(user2.address)).to.equal(200);

            // 4. 商家从 user2 扣减积分（消费）
            await token.connect(merchant1).spend(user2.address, 150);
            expect(await token.balanceOf(user2.address)).to.equal(50);

            // 5. 验证最终总供应量
            expect(await token.totalSupply()).to.equal(350);
        });
    });

    describe("暂停与恢复", function () {
        it("Owner 可以暂停合约", async function () {
            await expect(token.pause())
                .to.emit(token, "ContractPaused")
                .withArgs(owner.address);
            expect(await token.paused()).to.be.true;
        });

        it("Owner 可以恢复合约", async function () {
            await token.pause();
            await expect(token.unpause())
                .to.emit(token, "ContractUnpaused")
                .withArgs(owner.address);
            expect(await token.paused()).to.be.false;
        });

        it("非 Owner 不能暂停合约", async function () {
            await expect(
                token.connect(user1).pause()
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });

        it("非 Owner 不能恢复合约", async function () {
            await token.pause();
            await expect(
                token.connect(user1).unpause()
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });

        it("暂停后商家不能发放积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.pause();
            await expect(
                token.connect(merchant1).reward(user1.address, 100)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("暂停后商家不能扣除积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.pause();
            await expect(
                token.connect(merchant1).spend(user1.address, 50)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("暂停后用户不能转账", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.pause();
            await expect(
                token.connect(user1).transfer(user2.address, 50)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("暂停后不能 transferFrom", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.connect(user1).approve(user2.address, 50);
            await token.pause();
            await expect(
                token.connect(user2).transferFrom(user1.address, user2.address, 50)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("恢复后商家可以正常发放积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.pause();
            await token.unpause();
            await token.connect(merchant1).reward(user1.address, 100);
            expect(await token.balanceOf(user1.address)).to.equal(100);
        });

        it("恢复后用户可以正常转账", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await token.pause();
            await token.unpause();
            await token.connect(user1).transfer(user2.address, 50);
            expect(await token.balanceOf(user1.address)).to.equal(50);
            expect(await token.balanceOf(user2.address)).to.equal(50);
        });
    });

    describe("事件验证", function () {
        it("MerchantAdded 事件应正确触发", async function () {
            await expect(token.addMerchant(merchant1.address))
                .to.emit(token, "MerchantAdded")
                .withArgs(merchant1.address);
        });

        it("MerchantRemoved 事件应正确触发", async function () {
            await token.addMerchant(merchant1.address);
            await expect(token.removeMerchant(merchant1.address))
                .to.emit(token, "MerchantRemoved")
                .withArgs(merchant1.address);
        });

        it("Reward 事件应正确触发", async function () {
            await token.addMerchant(merchant1.address);
            await expect(token.connect(merchant1).reward(user1.address, 100))
                .to.emit(token, "Reward")
                .withArgs(merchant1.address, user1.address, 100);
        });

        it("Spend 事件应正确触发", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            await expect(token.connect(merchant1).spend(user1.address, 50))
                .to.emit(token, "Spend")
                .withArgs(merchant1.address, user1.address, 50);
        });

        it("ContractPaused 事件应正确触发", async function () {
            await expect(token.pause())
                .to.emit(token, "ContractPaused")
                .withArgs(owner.address);
        });

        it("ContractUnpaused 事件应正确触发", async function () {
            await token.pause();
            await expect(token.unpause())
                .to.emit(token, "ContractUnpaused")
                .withArgs(owner.address);
        });
    });
});
