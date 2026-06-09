/**
 * LoyaltyLink 积分兑换商城 — 使用 LYL 积分兑换奖品
 * 依赖：common.js（钱包连接 / 合约加载）、Web3.js CDN
 *
 * 兑换时调用合约 spend() 销毁积分，记录保存到 localStorage (ll_redemptions)
 */

// ========== 可兑换奖品目录 ==========
var REDEEM_ITEMS = [
    { id: "coupon_5",     name: "¥5 优惠券",         points: 50,   icon: "🎫", desc: "联盟商家通用" },
    { id: "milk_tea",     name: "珍珠奶茶兑换券",     points: 30,   icon: "🧋", desc: "到店出示即可" },
    { id: "notebook",     name: "定制笔记本",         points: 150,  icon: "📓", desc: "LoyaltyLink 周边" },
    { id: "coupon_20",    name: "¥20 优惠券",         points: 200,  icon: "🎟️", desc: "联盟商家通用" },
    { id: "movie_ticket", name: "电影票一张",         points: 500,  icon: "🎬", desc: "2D/3D 通兑" },
    { id: "earphones",    name: "蓝牙耳机",           points: 1000, icon: "🎧", desc: "品牌无线耳机" }
];

// ========== 当前选中的待兑换项 ==========
var pendingRedeemItem = null;

// ========== 生成唯一兑换记录 ID ==========
function generateRedemptionId() {
    return "redeem_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
}

// ========== 连接完成后的初始化 ==========
LL.onReady = async function (tokenInfo) {
    LL.setActiveNav();
    await LL.updateTokenBalance();
    await LL.updateEthBalance();
    renderItems();
    renderMyRedemptions();
    bindDialogEvents();
};

// ========== 渲染可兑换奖品 ==========
function renderItems() {
    var container = document.getElementById("redeem-list");
    if (!container) return;

    var html = "";
    for (var i = 0; i < REDEEM_ITEMS.length; i++) {
        var item = REDEEM_ITEMS[i];
        html += "" +
            "<div class=\"product-card\">" +
            "  <div class=\"product-icon\">" + item.icon + "</div>" +
            "  <div class=\"product-name\">" + item.name + "</div>" +
            "  <div class=\"product-merchant\">" + item.desc + "</div>" +
            "  <div class=\"product-price\">" + item.points + " LYL</div>" +
            "  <button class=\"button-sm\" onclick=\"redeemItem('" + item.id + "')\">兑换</button>" +
            "</div>";
    }
    container.innerHTML = html;
}

// ========== 点击兑换按钮 ==========
async function redeemItem(itemId) {
    var account = LL.currentAccount();
    var contract = LL.contract();

    if (!account || !contract) {
        LL.showStatus("请先连接 MetaMask 钱包", "error");
        return;
    }

    // 查找商品
    var item = null;
    for (var i = 0; i < REDEEM_ITEMS.length; i++) {
        if (REDEEM_ITEMS[i].id === itemId) {
            item = REDEEM_ITEMS[i];
            break;
        }
    }
    if (!item) {
        LL.showStatus("奖品不存在", "error");
        return;
    }

    // 检查余额
    try {
        var balanceRaw = await contract.methods.balanceOf(account).call();
        var balance = LL.web3().utils.fromWei(balanceRaw, "ether");
        if (Number(balance) < item.points) {
            LL.showStatus("积分不足！当前余额 " + balance + " LYL，需要 " + item.points + " LYL", "error");
            return;
        }
    } catch (err) {
        LL.showStatus("查询余额失败: " + err.message, "error");
        return;
    }

    // 显示确认对话框
    pendingRedeemItem = item;
    document.getElementById("confirm-text").innerText =
        "确认使用 " + item.points + " LYL 兑换「" + item.name + "」？\n兑换后积分将被销毁。";
    document.getElementById("confirm-dialog").classList.add("show");
}

// ========== 确认兑换（调用 spend） ==========
async function confirmRedeem() {
    var item = pendingRedeemItem;
    if (!item) return;

    var contract = LL.contract();
    var account = LL.currentAccount();
    var amountWei = LL.web3().utils.toWei(String(item.points), "ether");

    // 隐藏对话框
    document.getElementById("confirm-dialog").classList.remove("show");
    pendingRedeemItem = null;

    var restoreBtn = LL.setButtonLoading("btn-confirm-dialog", "兑换处理中...");

    try {
        var receipt = await contract.methods.redeemTokens(amountWei).send({
            from: account,
            gas: 300000
        });

        // 保存兑换记录
        var redemption = {
            id: generateRedemptionId(),
            itemId: item.id,
            itemName: item.name,
            pointsRequired: item.points,
            amountWei: amountWei,
            redeemer: account,
            timestamp: Date.now(),
            status: "confirmed",
            txHash: receipt.transactionHash
        };

        var redemptions = LL.getRedemptions();
        redemptions.push(redemption);
        LL.saveRedemptions(redemptions);

        await LL.updateTokenBalance();

        LL.showStatus("兑换成功！「" + item.name + "」已扣除 " + item.points + " LYL", "success");

        renderMyRedemptions();
    } catch (err) {
        console.error("兑换失败:", err);
        LL.showStatus(LL.translateError(err), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 渲染我的兑换记录 ==========
function renderMyRedemptions() {
    var container = document.getElementById("my-redemptions");
    if (!container) return;

    var account = LL.currentAccount();
    var redemptions = LL.getRedemptions();

    // 筛选当前用户，按时间倒序
    var myItems = [];
    for (var i = redemptions.length - 1; i >= 0; i--) {
        if (redemptions[i].redeemer.toLowerCase() === (account || "").toLowerCase()) {
            myItems.push(redemptions[i]);
        }
    }

    if (myItems.length === 0) {
        container.innerHTML = "<p class=\"hint\">暂无兑换记录</p>";
        return;
    }

    var html = "";
    for (var j = 0; j < myItems.length; j++) {
        var r = myItems[j];
        var statusClass = r.status === "confirmed" ? "confirmed" : "pending";
        var statusText = r.status === "confirmed" ? "已确认" : "待确认";
        var txLink = r.txHash
            ? "<div class=\"order-meta\">交易: <span class=\"tx-link\" title=\"" + r.txHash + "\">" + r.txHash.substring(0, 10) + "...</span></div>"
            : "";

        html += "" +
            "<div class=\"order-card\">" +
            "  <div class=\"order-info\">" +
            "    <div class=\"order-product\">" + r.itemName + "</div>" +
            "    <div class=\"order-meta\">消耗 " + r.pointsRequired + " LYL · " + formatRedeemTime(r.timestamp) + "</div>" +
            "    <div class=\"order-meta\">兑换号: " + r.id + "</div>" +
            txLink +
            "  </div>" +
            "  <span class=\"order-status " + statusClass + "\">" + statusText + "</span>" +
            "</div>";
    }
    container.innerHTML = html;
}

// ========== 对话框事件绑定 ==========
function bindDialogEvents() {
    document.getElementById("btn-cancel-dialog").addEventListener("click", function () {
        document.getElementById("confirm-dialog").classList.remove("show");
        pendingRedeemItem = null;
    });

    document.getElementById("btn-confirm-dialog").addEventListener("click", confirmRedeem);

    // 点击遮罩关闭
    document.getElementById("confirm-dialog").addEventListener("click", function (e) {
        if (e.target === this) {
            this.classList.remove("show");
            pendingRedeemItem = null;
        }
    });
}

// ========== 时间格式化工具 ==========
function formatRedeemTime(ts) {
    var d = new Date(ts);
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var hours = d.getHours();
    var minutes = d.getMinutes();

    return month + "/" + day + " " +
           (hours < 10 ? "0" : "") + hours + ":" +
           (minutes < 10 ? "0" : "") + minutes;
}

// ========== 事件绑定 ==========
document.getElementById("connectBtn").addEventListener("click", LL.connectWallet);
