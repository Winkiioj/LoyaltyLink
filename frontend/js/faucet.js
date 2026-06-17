/**
 * LoyaltyLink 水龙头页面
 * 测试用户可在此免费领取 5 LYL 积分（每地址每天限一次）
 */
(function () {
    "use strict";

    // 绑定连接按钮
    document.getElementById("connectBtn").addEventListener("click", LL.connectWallet);

    LL.onReady = async function (tokenInfo) {
        // 更新余额
        await LL.updateTokenBalance();
        await LL.updateEthBalance();

        // 查询水龙头状态
        await updateFaucetInfo();

        // 绑定领取按钮
        var faucetBtn = document.getElementById("faucetBtn");
        if (faucetBtn) {
            faucetBtn.addEventListener("click", claimFaucet);
        }
    };

    /** 查询水龙头状态（上次领取时间、冷却倒计时） */
    async function updateFaucetInfo() {
        var infoDiv = document.getElementById("faucetInfo");
        var account = LL.currentAccount();
        var contract = LL.contract();
        if (!infoDiv || !account || !contract) return;

        try {
            var lastClaim = await contract.methods.lastFaucetClaim(account).call();
            var lastClaimNum = parseInt(lastClaim);
            var cooldown = 24 * 3600; // FAUCET_COOLDOWN = 1 day

            if (lastClaimNum === 0) {
                // 从未领取过
                document.getElementById("lastClaimTime").innerText = "从未领取";
                document.getElementById("nextClaimTime").innerText = "立即可领取！";
                document.getElementById("faucetBtn").disabled = false;
                document.getElementById("faucetBtn").innerText = "💧 领取 5 LYL";
            } else {
                var lastDate = new Date(lastClaimNum * 1000);
                document.getElementById("lastClaimTime").innerText = lastDate.toLocaleString("zh-CN");

                var nextTime = lastClaimNum + cooldown;
                var now = Math.floor(Date.now() / 1000);

                if (now >= nextTime) {
                    document.getElementById("nextClaimTime").innerText = "立即可领取！";
                    document.getElementById("faucetBtn").disabled = false;
                    document.getElementById("faucetBtn").innerText = "💧 领取 5 LYL";
                } else {
                    var remaining = nextTime - now;
                    var h = Math.floor(remaining / 3600);
                    var m = Math.floor((remaining % 3600) / 60);
                    var s = remaining % 60;
                    document.getElementById("nextClaimTime").innerText = h + "时" + m + "分" + s + "秒后";
                    document.getElementById("faucetBtn").disabled = true;
                    document.getElementById("faucetBtn").innerText = "⏳ 冷却中...";

                    // 每秒更新倒计时
                    setTimeout(updateFaucetInfo, 1000);
                }
            }

            infoDiv.style.display = "block";
        } catch (err) {
            console.error("查询水龙头状态失败:", err);
        }
    }

    /** 领取水龙头积分 */
    async function claimFaucet() {
        var contract = LL.contract();
        var account = LL.currentAccount();
        if (!contract || !account) return;

        // 确认对话框
        var confirmed = await LL.confirm("领取测试积分", "将向你的地址 " + LL.truncateAddress(account) + " 发放 5 LYL 测试积分。\n\n每个地址每天限领取一次。");
        if (!confirmed) return;

        var restore = LL.setButtonLoading("faucetBtn", "领取中...");
        LL.clearAllFieldErrors();

        try {
            var tx = await contract.methods.faucet().send({ from: account });
            LL.showStatus("领取成功！已获得 5 LYL 测试积分。交易哈希: " + LL.truncateAddress(tx.transactionHash), "success");
            await LL.updateTokenBalance();
            await updateFaucetInfo();
        } catch (error) {
            LL.showStatus(LL.translateError(error), "error");
        } finally {
            restore();
        }
    }
})();
