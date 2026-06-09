/**
 * LoyaltyLink 用户端 — 余额查询、积分转账
 * 依赖：common.js（钱包连接 / 合约加载）、Web3.js CDN
 */

// ========== 连接完成后的初始化 ==========
LL.onReady = async function (tokenInfo) {
    LL.setActiveNav();
    await LL.updateTokenBalance();
    await LL.updateEthBalance();
};

// ========== 转账 LYL ==========
async function transfer() {
    var restoreBtn = function () {};

    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var to = document.getElementById("toAddress").value.trim();
        var amount = document.getElementById("transferAmount").value.trim();

        // 字段级校验（使用 inline 红色提示）
        var hasError = false;

        if (!to) {
            LL.showFieldError("toAddress", "请输入接收地址");
            hasError = true;
        } else if (!LL.web3().utils.isAddress(to)) {
            LL.showFieldError("toAddress", "请输入有效的以太坊地址 (0x...)");
            hasError = true;
        }

        if (!amount) {
            LL.showFieldError("transferAmount", "请输入转账数量");
            hasError = true;
        } else if (Number(amount) <= 0) {
            LL.showFieldError("transferAmount", "转账数量必须大于 0");
            hasError = true;
        }

        if (hasError) return;

        // 确认对话框
        var confirmed = await LL.confirm(
            "确认转账",
            "即将向 " + LL.truncateAddress(to) + " 转账 " + amount + " LYL\n\n请在 MetaMask 中确认交易"
        );
        if (!confirmed) return;

        var amountRaw = LL.web3().utils.toWei(amount, "ether");

        restoreBtn = LL.setButtonLoading("transferBtn", "转账处理中...");

        await contract.methods.transfer(to, amountRaw).send({
            from: currentAccount,
            gas: 300000
        });

        await LL.updateTokenBalance();

        LL.showStatus("LYL 转账成功！已向 " + LL.truncateAddress(to) + " 转出 " + amount + " LYL", "success");

        document.getElementById("toAddress").value = "";
        document.getElementById("transferAmount").value = "";
    } catch (error) {
        console.error("转账失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 事件绑定（防御性注册） ==========
(function bindEvents() {
    try {
        var el = document.getElementById("connectBtn");
        if (el) el.addEventListener("click", LL.connectWallet);
        el = document.getElementById("transferBtn");
        if (el) el.addEventListener("click", transfer);

        var toAddr = document.getElementById("toAddress");
        if (toAddr) toAddr.addEventListener("input", function () { LL.clearFieldError("toAddress"); });
        var transferAmt = document.getElementById("transferAmount");
        if (transferAmt) transferAmt.addEventListener("input", function () { LL.clearFieldError("transferAmount"); });
    } catch (e) {
        console.error("app.js 事件绑定失败:", e);
    }
})();
