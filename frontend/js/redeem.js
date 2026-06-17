/**
 * LoyaltyLink 积分兑换 — 使用 LYL 积分兑换奖品
 * 依赖：common.js（钱包连接 / 合约加载）、Web3.js CDN
 */

// ========== 默认兑换奖品 ==========
var DEFAULT_REDEEMS = [
    { id: "coupon_5",     name: "¥5 优惠券",         points: 500,    icon: "🎫", desc: "联盟商家通用", merchant: "官方" },
    { id: "milk_tea",     name: "珍珠奶茶兑换券",     points: 1500,   icon: "🧋", desc: "到店出示即可", merchant: "官方" },
    { id: "notebook",     name: "定制笔记本",         points: 5000,   icon: "📓", desc: "LoyaltyLink 周边", merchant: "官方" },
    { id: "coupon_20",    name: "¥20 优惠券",         points: 2000,   icon: "🎟️", desc: "联盟商家通用", merchant: "官方" },
    { id: "movie_ticket", name: "电影票一张",         points: 12000,  icon: "🎬", desc: "2D/3D 通兑", merchant: "官方" },
    { id: "earphones",    name: "蓝牙耳机",           points: 30000,  icon: "🎧", desc: "品牌无线耳机", merchant: "官方" }
];

/** 合并默认 + 商家自定义 */
function getRedeemItems() {
    return DEFAULT_REDEEMS.concat(LL.getMerchantRedeemItems());
}

/** 获取所有不重复的商家列表 */
function getRedeemMerchants() {
    var items = getRedeemItems();
    var seen = {};
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var m = items[i].merchant || "其他";
        if (!seen[m]) { seen[m] = true; list.push(m); }
    }
    return list;
}

var pendingRedeemItem = null;
var currentFilter = "all";

function generateRedemptionId() {
    return "redeem_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
}

// ========== 连接完成 ==========
LL.onReady = async function (tokenInfo) {
    LL.setActiveNav();
    await LL.updateTokenBalance();
    await LL.updateEthBalance();
    populateMerchantFilter();
    renderItems();
    renderMyRedemptions();
    bindDialogEvents();
};

function populateMerchantFilter() {
    var sel = document.getElementById("redeem-merchant-filter");
    if (!sel) return;
    sel.innerHTML = "<option value=\"all\">全部商家</option>";
    var merchants = getRedeemMerchants();
    for (var i = 0; i < merchants.length; i++) {
        sel.innerHTML += "<option value=\"" + merchants[i] + "\">" + merchants[i] + "</option>";
    }
}

// ========== 渲染奖品 ==========
function renderItems() {
    var container = document.getElementById("redeem-list");
    if (!container) return;

    var allItems = getRedeemItems();
    var filter = document.getElementById("redeem-merchant-filter");
    currentFilter = filter ? filter.value : "all";

    var items = allItems;
    if (currentFilter !== "all") {
        items = allItems.filter(function (it) { return (it.merchant || "其他") === currentFilter; });
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        html += "" +
            "<div class=\"product-card\">" +
            "  <div class=\"product-icon\">" + item.icon + "</div>" +
            "  <div class=\"product-name\">" + item.name + "</div>" +
            "  <div class=\"product-merchant\">" + (item.desc || item.merchant || "") + "</div>" +
            "  <div class=\"product-price\">" + item.points + " LYL</div>" +
            "  <button class=\"button-sm\" onclick=\"redeemItem('" + item.id + "')\">兑换</button>" +
            "</div>";
    }
    container.innerHTML = html || "<p class=\"hint\">该商家暂无兑换奖品</p>";
}

// ========== 兑换 ==========
async function redeemItem(itemId) {
    var account = LL.currentAccount();
    var contract = LL.contract();
    if (!account || !contract) { LL.showStatus("请先连接 MetaMask 钱包", "error"); return; }

    var allItems = getRedeemItems();
    var item = null;
    for (var i = 0; i < allItems.length; i++) {
        if (allItems[i].id === itemId) { item = allItems[i]; break; }
    }
    if (!item) { LL.showStatus("奖品不存在", "error"); return; }

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

    pendingRedeemItem = item;
    document.getElementById("confirm-text").innerText =
        "确认使用 " + item.points + " LYL 兑换「" + item.name + "」？\n兑换后积分将被销毁。";
    document.getElementById("confirm-dialog").classList.add("show");
}

async function confirmRedeem() {
    var item = pendingRedeemItem;
    if (!item) return;
    var contract = LL.contract();
    var account = LL.currentAccount();
    var amountWei = LL.web3().utils.toWei(String(item.points), "ether");

    document.getElementById("confirm-dialog").classList.remove("show");
    pendingRedeemItem = null;
    var restoreBtn = LL.setButtonLoading("btn-confirm-dialog", "兑换处理中...");

    try {
        var receipt = await contract.methods.redeemTokens(amountWei).send({ from: account, gas: 300000 });
        var redemption = {
            id: generateRedemptionId(), itemId: item.id, itemName: item.name,
            pointsRequired: item.points, amountWei: amountWei, redeemer: account,
            timestamp: Date.now(), status: "confirmed", txHash: receipt.transactionHash
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

function renderMyRedemptions() {
    var container = document.getElementById("my-redemptions");
    if (!container) return;
    var account = LL.currentAccount();
    var redemptions = LL.getRedemptions();
    var myItems = [];
    for (var i = redemptions.length - 1; i >= 0; i--) {
        if (redemptions[i].redeemer.toLowerCase() === (account || "").toLowerCase()) {
            myItems.push(redemptions[i]);
        }
    }
    if (myItems.length === 0) { container.innerHTML = "<p class=\"hint\">暂无兑换记录</p>"; return; }

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
            "    <div class=\"order-meta\">兑换号: " + r.id + "</div>" + txLink +
            "  </div>" +
            "  <span class=\"order-status " + statusClass + "\">" + statusText + "</span>" +
            "</div>";
    }
    container.innerHTML = html;
}

function bindDialogEvents() {
    document.getElementById("btn-cancel-dialog").addEventListener("click", function () {
        document.getElementById("confirm-dialog").classList.remove("show");
        pendingRedeemItem = null;
    });
    document.getElementById("btn-confirm-dialog").addEventListener("click", confirmRedeem);
    document.getElementById("confirm-dialog").addEventListener("click", function (e) {
        if (e.target === this) { this.classList.remove("show"); pendingRedeemItem = null; }
    });
}

function formatRedeemTime(ts) {
    var d = new Date(ts);
    return (d.getMonth()+1) + "/" + d.getDate() + " " +
           (d.getHours()<10?"0":"") + d.getHours() + ":" +
           (d.getMinutes()<10?"0":"") + d.getMinutes();
}

document.getElementById("connectBtn").addEventListener("click", LL.connectWallet);
