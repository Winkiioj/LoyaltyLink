/**
 * LoyaltyLink 商户端 — 订单处理、发放积分、扣除积分、查询余额
 * 依赖：common.js（钱包连接 / 合约加载）、Web3.js CDN
 */

// ========== 连接完成后的初始化 ==========
LL.onReady = async function (tokenInfo) {
    LL.setActiveNav();
    await updateMerchantInfo();
    await updateExchangeRateDisplay();
    loadPendingOrders();
    loadRedemptionRequests();
    renderMyProducts();
    renderMyRedeemItems();
};

// ========== 更新商家信息 ==========
async function updateMerchantInfo() {
    try {
        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) return;

        var symbol = await contract.methods.symbol().call();

        var isMerchant = await contract.methods.merchants(currentAccount).call();

        var tokenBalanceRaw = await contract.methods.balanceOf(currentAccount).call();
        var tokenBalance = LL.web3().utils.fromWei(tokenBalanceRaw, "ether");

        document.getElementById("merchantStatus").innerText =
            isMerchant ? "商家状态: 是商家，可以发放/扣除积分" : "商家状态: 不是商家，不能调用 reward/spend";

        document.getElementById("balance").innerText =
            "LYL 余额: " + tokenBalance + " " + symbol;

        await LL.updateEthBalance();
    } catch (error) {
        console.error("更新商家信息失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    }
}

// ========== 发放 LYL ==========
async function reward() {
    var restoreBtn = function () {};

    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var user = document.getElementById("rewardAddress").value.trim();
        var amount = document.getElementById("rewardAmount").value.trim();

        var hasError = false;

        if (!user) {
            LL.showFieldError("rewardAddress", "请输入用户地址");
            hasError = true;
        } else if (!LL.web3().utils.isAddress(user)) {
            LL.showFieldError("rewardAddress", "请输入有效的以太坊地址 (0x...)");
            hasError = true;
        }

        if (!amount) {
            LL.showFieldError("rewardAmount", "请输入发放数量");
            hasError = true;
        } else if (Number(amount) <= 0) {
            LL.showFieldError("rewardAmount", "发放数量必须大于 0");
            hasError = true;
        }

        if (hasError) return;

        var confirmed = await LL.confirm(
            "确认发放积分",
            "即将向 " + LL.truncateAddress(user) + " 发放 " + amount + " LYL\n\n积分将铸造（mint）到对方账户"
        );
        if (!confirmed) return;

        var amountRaw = LL.web3().utils.toWei(amount, "ether");

        restoreBtn = LL.setButtonLoading("rewardBtn", "发放处理中...");

        await contract.methods.reward(user, amountRaw).send({
            from: currentAccount,
            gas: 300000
        });

        await updateMerchantInfo();

        LL.showStatus("LYL 积分发放成功！已向 " + LL.truncateAddress(user) + " 发放 " + amount + " LYL", "success");

        document.getElementById("rewardAddress").value = "";
        document.getElementById("rewardAmount").value = "";
    } catch (error) {
        console.error("发放失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 扣除 LYL ==========
async function spend() {
    var restoreBtn = function () {};

    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var user = document.getElementById("spendAddress").value.trim();
        var amount = document.getElementById("spendAmount").value.trim();

        var hasError = false;

        if (!user) {
            LL.showFieldError("spendAddress", "请输入用户地址");
            hasError = true;
        } else if (!LL.web3().utils.isAddress(user)) {
            LL.showFieldError("spendAddress", "请输入有效的以太坊地址 (0x...)");
            hasError = true;
        }

        if (!amount) {
            LL.showFieldError("spendAmount", "请输入扣除数量");
            hasError = true;
        } else if (Number(amount) <= 0) {
            LL.showFieldError("spendAmount", "扣除数量必须大于 0");
            hasError = true;
        }

        if (hasError) return;

        var confirmed = await LL.confirm(
            "确认扣除积分",
            "即将从 " + LL.truncateAddress(user) + " 扣除 " + amount + " LYL\n\n扣除的积分将被销毁（burn）"
        );
        if (!confirmed) return;

        var amountRaw = LL.web3().utils.toWei(amount, "ether");

        restoreBtn = LL.setButtonLoading("spendBtn", "扣除处理中...");

        await contract.methods.spend(user, amountRaw).send({
            from: currentAccount,
            gas: 300000
        });

        await updateMerchantInfo();

        LL.showStatus("LYL 积分扣除成功！已从 " + LL.truncateAddress(user) + " 扣除 " + amount + " LYL", "success");

        document.getElementById("spendAddress").value = "";
        document.getElementById("spendAmount").value = "";
    } catch (error) {
        console.error("扣除失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 查询任意地址余额 ==========
async function queryBalance() {
    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();

        if (!contract) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var address = document.getElementById("queryAddress").value.trim();

        if (!address) {
            LL.showFieldError("queryAddress", "请输入查询地址");
            return;
        }

        if (!LL.web3().utils.isAddress(address)) {
            LL.showFieldError("queryAddress", "请输入有效的以太坊地址 (0x...)");
            return;
        }

        var symbol = await contract.methods.symbol().call();
        var balanceRaw = await contract.methods.balanceOf(address).call();
        var balance = LL.web3().utils.fromWei(balanceRaw, "ether");

        document.getElementById("queryResult").innerText =
            "查询结果: " + balance + " " + symbol;
    } catch (error) {
        console.error("查询失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    }
}

// ========== 加载待处理订单 ==========
function loadPendingOrders() {
    var container = document.getElementById("pending-orders");
    if (!container) return;

    var orders = LL.getOrders();
    var account = LL.currentAccount();
    var accountLower = account ? account.toLowerCase() : "";
    var pending = [];

    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        if (o.status !== "pending") continue;
        // 自定义商品仅该商家可见；默认商品所有商家可见
        var isDefaultProduct = !o.merchantAddress;
        var isOwnProduct = o.merchantAddress && o.merchantAddress.toLowerCase() === accountLower;
        if (isDefaultProduct || isOwnProduct) {
            pending.push(o);
        }
    }

    if (pending.length === 0) {
        container.innerHTML = "<p class=\"hint\">暂无待处理订单</p>";
        return;
    }

    var html = "";
    for (var j = 0; j < pending.length; j++) {
        var o = pending[j];
        html += "" +
            "<div class=\"order-card\">" +
            "  <div class=\"order-info\">" +
            "    <div class=\"order-product\">" + o.productName + "</div>" +
            "    <div class=\"order-meta\">买家: " + LL.truncateAddress(o.buyer) + " · " + o.merchant + "</div>" +
            "    <div class=\"order-meta\">金额: ¥" + o.priceYuan + " → " + o.pointsRequired + " LYL · " + formatMerchantTime(o.timestamp) + "</div>" +
            "  </div>" +
            "  <div class=\"order-actions\">" +
            "    <button class=\"button-sm btn-confirm-order\" data-order-id=\"" + o.id + "\">确认发放</button>" +
            "  </div>" +
            "</div>";
    }
    container.innerHTML = html;

    // 绑定确认按钮事件（用事件委托避免 onclick 属性）
    var buttons = container.querySelectorAll(".btn-confirm-order");
    for (var k = 0; k < buttons.length; k++) {
        buttons[k].addEventListener("click", function () {
            confirmOrder(this.getAttribute("data-order-id"), this);
        });
    }
}

// ========== 确认订单并发放积分 ==========
async function confirmOrder(orderId, btn) {
    var restoreBtn = function () {};

    try {
        var contract = LL.contract();
        var account = LL.currentAccount();

        if (!contract || !account) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var orders = LL.getOrders();
        var order = null;
        for (var i = 0; i < orders.length; i++) {
            if (orders[i].id === orderId) {
                order = orders[i];
                break;
            }
        }

        if (!order) {
            LL.showStatus("订单不存在", "error");
            return;
        }

        if (order.status !== "pending") {
            LL.showStatus("订单状态不是待确认", "error");
            return;
        }

        var confirmed = await LL.confirm(
            "确认发放积分",
            "即将向 " + LL.truncateAddress(order.buyer) + " 发放 " + order.pointsRequired + " LYL\n\n" +
            "商品: " + order.productName + "\n金额: ¥" + order.priceYuan
        );
        if (!confirmed) return;

        if (btn) {
            restoreBtn = LL.setButtonLoading(btn, "处理中...");
        }

        var receipt = await contract.methods.reward(order.buyer, order.amountWei).send({
            from: account,
            gas: 300000
        });

        order.status = "confirmed";
        order.txHash = receipt.transactionHash;
        LL.saveOrders(orders);

        await updateMerchantInfo();
        loadPendingOrders();

        LL.showStatus("积分发放成功！订单 " + order.id + " 已确认，已向用户发放 " + order.pointsRequired + " LYL", "success");
    } catch (err) {
        console.error("发放失败:", err);
        LL.showStatus(LL.translateError(err), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 加载兑换请求 ==========
function loadRedemptionRequests() {
    var container = document.getElementById("redemption-requests");
    if (!container) return;

    var redemptions = LL.getRedemptions();

    if (redemptions.length === 0) {
        container.innerHTML = "<p class=\"hint\">暂无兑换请求</p>";
        return;
    }

    var sorted = [];
    for (var i = redemptions.length - 1; i >= 0; i--) {
        sorted.push(redemptions[i]);
    }

    var html = "";
    for (var j = 0; j < sorted.length; j++) {
        var r = sorted[j];
        var statusClass = r.status === "confirmed" ? "confirmed" : "pending";
        var statusText = r.status === "confirmed" ? "已兑换" : "待处理";
        var txInfo = r.txHash
            ? "<div class=\"order-meta\">交易: " + r.txHash.substring(0, 10) + "...</div>"
            : "";

        html += "" +
            "<div class=\"order-card\">" +
            "  <div class=\"order-info\">" +
            "    <div class=\"order-product\">" + r.itemName + "</div>" +
            "    <div class=\"order-meta\">兑换人: " + LL.truncateAddress(r.redeemer) + "</div>" +
            "    <div class=\"order-meta\">消耗 " + r.pointsRequired + " LYL · " + formatMerchantTime(r.timestamp) + "</div>" +
            txInfo +
            "  </div>" +
            "  <span class=\"order-status " + statusClass + "\">" + statusText + "</span>" +
            "</div>";
    }
    container.innerHTML = html;
}

// ========== 时间格式化 ==========
function formatMerchantTime(ts) {
    var d = new Date(ts);
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var hours = d.getHours();
    var minutes = d.getMinutes();

    return month + "/" + day + " " +
           (hours < 10 ? "0" : "") + hours + ":" +
           (minutes < 10 ? "0" : "") + minutes;
}

// ========== 商品管理 ==========
function addProduct() {
    var currentAccount = LL.currentAccount();
    if (!currentAccount) {
        LL.showStatus("请先连接钱包", "error");
        return;
    }

    var nameInput = document.getElementById("productName");
    var priceInput = document.getElementById("productPrice");
    var pointsInput = document.getElementById("productPoints");
    var iconInput = document.getElementById("productIcon");

    var name = nameInput.value.trim();
    var price = priceInput.value.trim();
    var points = pointsInput.value.trim();
    var icon = iconInput.value.trim() || "🛍️";

    if (!name) { LL.showFieldError("productName", "请输入商品名称"); return; }
    if (!price || Number(price) <= 0) { LL.showFieldError("productPrice", "价格必须大于 0"); return; }
    if (!points || Number(points) <= 0) { LL.showFieldError("productPoints", "积分数必须大于 0"); return; }

    // 获取商家名称（优先用已保存的，否则用截断地址）
    var merchantNames = LL.getMerchantNames();
    var merchantName = merchantNames[currentAccount.toLowerCase()] || LL.truncateAddress(currentAccount);

    var product = {
        id: "cust_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        name: name,
        price: Number(price),
        pointsRequired: Number(points),
        merchant: merchantName,
        merchantAddress: currentAccount,
        icon: icon
    };

    LL.addMerchantProduct(product);
    LL.showStatus("商品已添加：" + name + "（¥" + price + "，发放 " + points + " LYL）", "success");

    nameInput.value = "";
    priceInput.value = "";
    pointsInput.value = "";
    iconInput.value = "🛍️";
    resetPointsManual();
    var hintEl = document.getElementById("rateHint");
    if (hintEl) hintEl.style.display = "none";
    LL.clearAllFieldErrors();
    renderMyProducts();
}

function deleteProduct(productId) {
    LL.removeMerchantProduct(productId);
    LL.showStatus("商品已移除", "success");
    renderMyProducts();
}

function renderMyProducts() {
    var container = document.getElementById("my-products");
    if (!container) return;

    var currentAccount = LL.currentAccount();
    if (!currentAccount) return;

    var allProducts = LL.getMerchantProducts();
    var myProducts = [];
    for (var i = 0; i < allProducts.length; i++) {
        if (allProducts[i].merchantAddress && allProducts[i].merchantAddress.toLowerCase() === currentAccount.toLowerCase()) {
            myProducts.push(allProducts[i]);
        }
    }

    if (myProducts.length === 0) {
        container.innerHTML = "<p class=\"hint\">尚未添加自定义商品，添加后将显示在商城</p>";
        return;
    }

    var html = "";
    for (var j = 0; j < myProducts.length; j++) {
        var p = myProducts[j];
        html += "<div class=\"product-list-item\">" +
            "<span>" + p.icon + "</span>" +
            "<span class=\"p-name\">" + p.name + "</span>" +
            "<span class=\"p-price\">¥" + p.price + " → " + p.pointsRequired + " LYL</span>" +
            "<button class=\"p-del\" onclick=\"deleteProduct('" + p.id + "')\">✕</button>" +
            "</div>";
    }
    container.innerHTML = html;
}

// ========== 兑换奖品管理 ==========
function addRedeemItem() {
    var currentAccount = LL.currentAccount();
    if (!currentAccount) { LL.showStatus("请先连接钱包", "error"); return; }

    var nameInput = document.getElementById("redeemItemName");
    var pointsInput = document.getElementById("redeemItemPoints");
    var iconInput = document.getElementById("redeemItemIcon");
    var name = nameInput.value.trim();
    var points = pointsInput.value.trim();
    var icon = iconInput.value.trim() || "🎁";

    if (!name) { LL.showFieldError("redeemItemName", "请输入奖品名称"); return; }
    if (!points || Number(points) <= 0) { LL.showFieldError("redeemItemPoints", "积分数必须大于 0"); return; }

    var merchantNames = LL.getMerchantNames();
    var merchantName = merchantNames[currentAccount.toLowerCase()] || LL.truncateAddress(currentAccount);

    var item = {
        id: "rdm_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        name: name, points: Number(points), icon: icon,
        desc: merchantName, merchantAddress: currentAccount, merchant: merchantName
    };

    LL.addMerchantRedeemItem(item);
    LL.showStatus("兑换奖品已添加：" + name + "（" + points + " LYL）", "success");
    nameInput.value = ""; pointsInput.value = ""; iconInput.value = "🎁";
    LL.clearAllFieldErrors();
    renderMyRedeemItems();
}

function deleteRedeemItem(itemId) {
    LL.removeMerchantRedeemItem(itemId);
    LL.showStatus("兑换奖品已移除", "success");
    renderMyRedeemItems();
}

function renderMyRedeemItems() {
    var container = document.getElementById("my-redeems");
    if (!container) return;
    var currentAccount = LL.currentAccount();
    if (!currentAccount) return;

    var allItems = LL.getMerchantRedeemItems();
    var myItems = [];
    for (var i = 0; i < allItems.length; i++) {
        if (allItems[i].merchantAddress && allItems[i].merchantAddress.toLowerCase() === currentAccount.toLowerCase()) {
            myItems.push(allItems[i]);
        }
    }

    if (myItems.length === 0) {
        container.innerHTML = "<p class=\"hint\">尚未添加自定义兑换奖品</p>";
        return;
    }

    var html = "";
    for (var j = 0; j < myItems.length; j++) {
        var item = myItems[j];
        html += "<div class=\"product-list-item\">" +
            "<span>" + item.icon + "</span>" +
            "<span class=\"p-name\">" + item.name + "</span>" +
            "<span class=\"p-price\">" + item.points + " LYL</span>" +
            "<button class=\"p-del\" onclick=\"deleteRedeemItem('" + item.id + "')\">✕</button>" +
            "</div>";
    }
    container.innerHTML = html;
}

// ========== 商家间结算 ==========
async function settle() {
    var restoreBtn = function () {};

    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var toAddress = document.getElementById("settleAddress").value.trim();
        var amount = document.getElementById("settleAmount").value.trim();

        var hasError = false;

        if (!toAddress) {
            LL.showFieldError("settleAddress", "请输入目标商家地址");
            hasError = true;
        } else if (!LL.web3().utils.isAddress(toAddress)) {
            LL.showFieldError("settleAddress", "请输入有效的以太坊地址 (0x...)");
            hasError = true;
        }

        if (!amount) {
            LL.showFieldError("settleAmount", "请输入结算数量");
            hasError = true;
        } else if (Number(amount) <= 0) {
            LL.showFieldError("settleAmount", "结算数量必须大于 0");
            hasError = true;
        }

        if (hasError) return;

        var confirmed = await LL.confirm(
            "确认商家间结算",
            "即将向 " + LL.truncateAddress(toAddress) + " 结算 " + amount + " LYL\n\n目标地址必须是已注册的联盟商家"
        );
        if (!confirmed) return;

        var amountRaw = LL.web3().utils.toWei(amount, "ether");

        restoreBtn = LL.setButtonLoading("settleBtn", "结算中...");

        await contract.methods.settle(toAddress, amountRaw).send({
            from: currentAccount,
            gas: 300000
        });

        await updateMerchantInfo();

        LL.showStatus("结算成功！已向 " + LL.truncateAddress(toAddress) + " 转账 " + amount + " LYL", "success");

        document.getElementById("settleAddress").value = "";
        document.getElementById("settleAmount").value = "";
    } catch (error) {
        console.error("结算失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 汇率缓存（供商品定价自动换算） ==========
var cachedExchangeRate = 10; // 默认 1元 = 10积分

// ========== 积分汇率设置 ==========
async function setExchangeRate() {
    var restoreBtn = function () {};

    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var rateInput = document.getElementById("exchangeRateInput");
        var rate = rateInput.value.trim();

        if (!rate) {
            LL.showFieldError("exchangeRateInput", "请输入汇率值");
            return;
        }
        if (Number(rate) <= 0) {
            LL.showFieldError("exchangeRateInput", "汇率必须大于 0");
            return;
        }

        var confirmed = await LL.confirm(
            "确认设置汇率",
            "即将设置积分汇率为：1 元 = " + rate + " 积分\n\n用户购物时将按此汇率计算应获得的积分"
        );
        if (!confirmed) return;

        restoreBtn = LL.setButtonLoading("setRateBtn", "设置中...");

        await contract.methods.setExchangeRate(rate).send({
            from: currentAccount,
            gas: 200000
        });

        await updateExchangeRateDisplay();
        LL.showStatus("汇率已设置：1 元 = " + rate + " 积分", "success");
        rateInput.value = "";
    } catch (error) {
        console.error("设置汇率失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

/** 查询并显示当前商家的积分汇率，同时缓存供商品定价使用 */
async function updateExchangeRateDisplay() {
    try {
        var contract = LL.contract();
        var currentAccount = LL.currentAccount();
        if (!contract || !currentAccount) return;

        var rate = await contract.methods.exchangeRates(currentAccount).call();
        var rateNum = parseInt(rate);
        cachedExchangeRate = rateNum > 0 ? rateNum : 10;
        var displayEl = document.getElementById("currentRate");
        if (displayEl) {
            if (rateNum > 0) {
                displayEl.innerText = "当前汇率：1 元 = " + rateNum + " 积分";
                displayEl.style.color = "var(--accent)";
            } else {
                displayEl.innerText = "当前汇率：未设置（默认 10）";
                displayEl.style.color = "var(--text-muted)";
            }
        }
    } catch (err) {
        console.error("查询汇率失败:", err);
    }
}

// ========== 汇率自动换算（商品定价） ==========

/** 根据价格和汇率自动计算应发积分，并填充积分输入框 */
function autoCalcPoints() {
    var priceInput = document.getElementById("productPrice");
    var pointsInput = document.getElementById("productPoints");
    var hintEl = document.getElementById("rateHint");
    if (!priceInput || !pointsInput) return;

    var price = parseFloat(priceInput.value);
    if (price > 0 && cachedExchangeRate > 0) {
        var autoPoints = Math.round(price * cachedExchangeRate);
        // 仅当用户未手动修改过积分字段时才自动填充
        if (pointsInput.dataset.manual !== "true") {
            pointsInput.value = autoPoints;
        }
        if (hintEl) {
            hintEl.innerText = "💱 按汇率自动换算: ¥" + price + " × " + cachedExchangeRate + " = " + autoPoints + " LYL";
            hintEl.style.display = "block";
        }
    } else if (hintEl) {
        hintEl.style.display = "none";
    }
}

/** 标记积分字段被手动修改，此后不再自动换算 */
function markPointsManual() {
    var pointsInput = document.getElementById("productPoints");
    if (pointsInput) {
        pointsInput.dataset.manual = "true";
    }
}

/** 重置积分字段的手动标记（商品添加成功后调用） */
function resetPointsManual() {
    var pointsInput = document.getElementById("productPoints");
    if (pointsInput) {
        pointsInput.dataset.manual = "false";
    }
}

// ========== 事件绑定（防御性注册） ==========
(function bindEvents() {
    try {
        var btnIds = {
            connectBtn: LL.connectWallet, rewardBtn: reward, spendBtn: spend,
            queryBtn: queryBalance, addProductBtn: addProduct, addRedeemBtn: addRedeemItem,
            settleBtn: settle, setRateBtn: setExchangeRate
        };
        for (var id in btnIds) {
            var el = document.getElementById(id);
            if (el) el.addEventListener("click", btnIds[id]);
        }

        var inputIds = ["rewardAddress", "rewardAmount", "spendAddress", "spendAmount",
            "queryAddress", "settleAddress", "settleAmount", "exchangeRateInput"];
        for (var i = 0; i < inputIds.length; i++) {
            (function (inputId) {
                var inp = document.getElementById(inputId);
                if (inp) inp.addEventListener("input", function () { LL.clearFieldError(inputId); });
            })(inputIds[i]);
        }

        // 汇率自动换算：价格输入时自动计算积分
        var priceInp = document.getElementById("productPrice");
        if (priceInp) priceInp.addEventListener("input", autoCalcPoints);

        // 积分字段被手动修改时标记，不再自动覆盖
        var pointsInp = document.getElementById("productPoints");
        if (pointsInp) pointsInp.addEventListener("input", markPointsManual);
    } catch (e) {
        console.error("merchant.js 事件绑定失败:", e);
    }
})();
