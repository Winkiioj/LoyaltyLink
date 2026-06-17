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

    // ========== FR-06: 积分过期机制 ==========

    describe("积分过期机制", function () {
        it("Owner 可以设置积分有效期", async function () {
            const secs = 180 * 24 * 3600;
            await token.setExpiryTime(secs);
            expect(await token.expiryTime()).to.equal(secs);
        });

        it("非 Owner 不能设置积分有效期", async function () {
            const secs = 180 * 24 * 3600;
            await expect(
                token.connect(user1).setExpiryTime(secs)
            ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
        });

        it("设为 0 表示永不过期", async function () {
            await token.setExpiryTime(0);
            expect(await token.expiryTime()).to.equal(0);
        });

        it("reward 后应更新用户 lastActivity", async function () {
            await token.addMerchant(merchant1.address);
            const tx = await token.connect(merchant1).reward(user1.address, 100);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const activity = await token.lastActivity(user1.address);
            expect(activity).to.equal(block.timestamp);
        });

        it("spend 后应更新用户 lastActivity", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            const tx = await token.connect(merchant1).spend(user1.address, 30);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const activity = await token.lastActivity(user1.address);
            expect(activity).to.equal(block.timestamp);
        });

        it("transfer 后应更新发送方 lastActivity", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            const tx = await token.connect(user1).transfer(user2.address, 30);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const activity = await token.lastActivity(user1.address);
            expect(activity).to.equal(block.timestamp);
        });

        it("redeemTokens 后应更新用户 lastActivity", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            const tx = await token.connect(user1).redeemTokens(20);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const activity = await token.lastActivity(user1.address);
            expect(activity).to.equal(block.timestamp);
        });

        it("未过期时 checkAndBurnExpired 应返回 0", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);
            // staticCall 模拟调用获取返回值（不实际修改状态）
            const expired = await token.checkAndBurnExpired.staticCall(user1.address);
            expect(expired).to.equal(0);
            expect(await token.balanceOf(user1.address)).to.equal(100);
        });

        it("过期后 checkAndBurnExpired 应销毁全部积分", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);

            // 快进 366 天
            await ethers.provider.send("evm_increaseTime", [366 * 24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            // staticCall 获取预期返回值
            const expectedExpired = await token.checkAndBurnExpired.staticCall(user1.address);
            expect(expectedExpired).to.equal(100);

            // 实际执行交易
            await token.checkAndBurnExpired(user1.address);
            expect(await token.balanceOf(user1.address)).to.equal(0);
        });

        it("过期销毁应触发 PointsExpired 事件", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);

            await ethers.provider.send("evm_increaseTime", [366 * 24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            await expect(token.checkAndBurnExpired(user1.address))
                .to.emit(token, "PointsExpired")
                .withArgs(user1.address, 100);
        });

        it("expiryTime=0 时永不过期", async function () {
            await token.setExpiryTime(0);
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);

            await ethers.provider.send("evm_increaseTime", [1000 * 24 * 3600]); // 1000天
            await ethers.provider.send("evm_mine", []);

            const expired = await token.checkAndBurnExpired.staticCall(user1.address);
            expect(expired).to.equal(0);
            expect(await token.balanceOf(user1.address)).to.equal(100);
        });

        it("新用户（无活动记录）过期检查应返回 0", async function () {
            const expired = await token.checkAndBurnExpired.staticCall(user1.address);
            expect(expired).to.equal(0);
        });

        it("用户有活动后更新 lastActivity 可避免过期", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);

            // 快进 200 天（未过期）
            await ethers.provider.send("evm_increaseTime", [200 * 24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            // 再次 reward 刷新活动时间
            await token.connect(merchant1).reward(user1.address, 50);
            expect(await token.balanceOf(user1.address)).to.equal(150);

            // 再快进 200 天（距上次活动仅200天，未过期）
            await ethers.provider.send("evm_increaseTime", [200 * 24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            const expired = await token.checkAndBurnExpired.staticCall(user1.address);
            expect(expired).to.equal(0);
        });

        it("暂停后不能调用 checkAndBurnExpired", async function () {
            await token.addMerchant(merchant1.address);
            await token.connect(merchant1).reward(user1.address, 100);

            await ethers.provider.send("evm_increaseTime", [366 * 24 * 3600]);
            await ethers.provider.send("evm_mine", []);

            await token.pause();
            await expect(
                token.checkAndBurnExpired(user1.address)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });
    });

    // ========== FR-07: 商家间结算 ==========

    describe("商家间结算", function () {
        beforeEach(async function () {
            await token.addMerchant(merchant1.address);
            await token.addMerchant(merchant2.address);
            // merchant1 需要持有积分才能结算（可以从某用户 reward 然后 spend 给自己？不...
            // 实际上 settle 用的是 transfer，商家需要先有余额
            // 让 merchant1 通过 reward 给 user1 然后... 不对，商家本身不能直接获得积分
            // 现实场景：用户向商家转账（作为积分支付），然后商家之间结算
            // 测试中：让 user1 获得积分后转给 merchant1
            await token.connect(merchant1).reward(user1.address, 500);
            await token.connect(user1).transfer(merchant1.address, 200);
        });

        it("商家可以向另一商家结算积分", async function () {
            await expect(token.connect(merchant1).settle(merchant2.address, 100))
                .to.emit(token, "Settlement")
                .withArgs(merchant1.address, merchant2.address, 100);
            expect(await token.balanceOf(merchant1.address)).to.equal(100);
            expect(await token.balanceOf(merchant2.address)).to.equal(100);
        });

        it("非商家不能调用结算", async function () {
            await expect(
                token.connect(user1).settle(merchant2.address, 100)
            ).to.be.revertedWith("LoyaltyToken: Not a merchant");
        });

        it("目标地址必须是注册商家", async function () {
            await expect(
                token.connect(merchant1).settle(user1.address, 100)
            ).to.be.revertedWith("LoyaltyToken: Target not a merchant");
        });

        it("余额不足时结算应回退", async function () {
            await expect(
                token.connect(merchant1).settle(merchant2.address, 999)
            ).to.be.revertedWith("LoyaltyToken: Insufficient balance");
        });

        it("暂停后不能结算", async function () {
            await token.pause();
            await expect(
                token.connect(merchant1).settle(merchant2.address, 50)
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });
    });

    // ========== FR-09: 水龙头 ==========

    describe("水龙头", function () {
        it("用户可以领取水龙头积分", async function () {
            await expect(token.connect(user1).faucet())
                .to.emit(token, "FaucetClaim")
                .withArgs(user1.address, ethers.parseEther("50"));
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
        });

        it("领取水龙头后应更新 lastActivity", async function () {
            await token.connect(user1).faucet();
            const activity = await token.lastActivity(user1.address);
            expect(activity).to.be.greaterThan(0);
        });

        it("冷却期内不能重复领取", async function () {
            await token.connect(user1).faucet();
            await expect(
                token.connect(user1).faucet()
            ).to.be.revertedWith("LoyaltyToken: Faucet cooldown not elapsed");
        });

        it("冷却期过后可以再次领取", async function () {
            await token.connect(user1).faucet();

            await ethers.provider.send("evm_increaseTime", [24 * 3600 + 1]); // 1天+1秒
            await ethers.provider.send("evm_mine", []);

            await token.connect(user1).faucet();
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("暂停后不能领取水龙头", async function () {
            await token.pause();
            await expect(
                token.connect(user1).faucet()
            ).to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("不同用户互不影响", async function () {
            await token.connect(user1).faucet();
            // user2 不受 user1 冷却影响
            await token.connect(user2).faucet();
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
        });
    });

    // ========== FR-10: 积分汇率 ==========

    describe("积分汇率", function () {
        beforeEach(async function () {
            await token.addMerchant(merchant1.address);
        });

        it("商家可以设置汇率", async function () {
            await expect(token.connect(merchant1).setExchangeRate(200))
                .to.emit(token, "ExchangeRateSet")
                .withArgs(merchant1.address, 200);
            expect(await token.exchangeRates(merchant1.address)).to.equal(200);
        });

        it("非商家不能设置汇率", async function () {
            await expect(
                token.connect(user1).setExchangeRate(200)
            ).to.be.revertedWith("LoyaltyToken: Not a merchant");
        });

        it("汇率必须大于 0", async function () {
            await expect(
                token.connect(merchant1).setExchangeRate(0)
            ).to.be.revertedWith("LoyaltyToken: Rate must be positive");
        });

        it("不同商家可以设置不同的汇率", async function () {
            await token.addMerchant(merchant2.address);
            await token.connect(merchant1).setExchangeRate(100);
            await token.connect(merchant2).setExchangeRate(200);
            expect(await token.exchangeRates(merchant1.address)).to.equal(100);
            expect(await token.exchangeRates(merchant2.address)).to.equal(200);
        });

        it("商家可以修改已设置的汇率", async function () {
            await token.connect(merchant1).setExchangeRate(100);
            await token.connect(merchant1).setExchangeRate(150);
            expect(await token.exchangeRates(merchant1.address)).to.equal(150);
        });
    });
});
