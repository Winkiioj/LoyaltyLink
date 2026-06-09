/**
 * LoyaltyLink 积分商城 — 商品浏览、下单
 * 依赖：common.js（钱包连接 / 合约加载）、Web3.js CDN
 *
 * 订单存储在 localStorage (ll_orders)，商家在 merchant.html 确认后调用 reward() 上链
 */

// ========== 商品目录（模拟联盟商家） ==========
var PRODUCTS = [
    { id: "bubble_tea",  name: "珍珠奶茶",       price: 15, merchant: "奶茶店", icon: "🧋" },
    { id: "coffee",      name: "拿铁咖啡",       price: 22, merchant: "咖啡店", icon: "☕" },
    { id: "printing",    name: "黑白打印(10页)", price: 5,  merchant: "打印店", icon: "🖨️" },
    { id: "laundry",     name: "洗衣服务",       price: 30, merchant: "洗衣店", icon: "👕" },
    { id: "fruit_tea",   name: "水果茶",         price: 18, merchant: "奶茶店", icon: "🍹" },
    { id: "binding",     name: "论文装订",       price: 12, merchant: "打印店", icon: "📚" }
];

// ========== 生成唯一订单 ID ==========
function generateOrderId() {
    return "order_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
}

// ========== 连接完成后的初始化 ==========
LL.onReady = async function (tokenInfo) {
    LL.setActiveNav();
    await LL.updateTokenBalance();
    await LL.updateEthBalance();
    renderProducts();
    renderMyOrders();
};

// ========== 渲染商品卡片 ==========
function renderProducts() {
    var container = document.getElementById("product-list");
    if (!container) return;

    var html = "";
    for (var i = 0; i < PRODUCTS.length; i++) {
        var p = PRODUCTS[i];
        html += "" +
            "<div class=\"product-card\">" +
            "  <div class=\"product-icon\">" + p.icon + "</div>" +
            "  <div class=\"product-name\">" + p.name + "</div>" +
            "  <div class=\"product-merchant\">" + p.merchant + "</div>" +
            "  <div class=\"product-price\">¥" + p.price + " → " + p.price + " LYL</div>" +
            "  <button class=\"button-sm\" onclick=\"buyProduct('" + p.id + "')\">购买</button>" +
            "</div>";
    }
    container.innerHTML = html;
}

// ========== 购买商品（创建离线订单） ==========
function buyProduct(productId) {
    var account = LL.currentAccount();
    if (!account) {
        LL.showStatus("请先连接 MetaMask 钱包", "error");
        return;
    }

    var product = null;
    for (var i = 0; i < PRODUCTS.length; i++) {
        if (PRODUCTS[i].id === productId) {
            product = PRODUCTS[i];
            break;
        }
    }

    if (!product) {
        LL.showStatus("商品不存在", "error");
        return;
    }

    // 创建订单（链下记录，不上链）
    var order = {
        id: generateOrderId(),
        productId: product.id,
        productName: product.name,
        priceYuan: product.price,
        pointsRequired: product.price,  // 1元 = 1积分
        amountWei: LL.web3().utils.toWei(String(product.price), "ether"),
        merchant: product.merchant,
        buyer: account,
        timestamp: Date.now(),
        status: "pending",
        txHash: null
    };

    var orders = LL.getOrders();
    orders.push(order);
    LL.saveOrders(orders);

    LL.showStatus("订单已创建：" + product.name + "（¥" + product.price + "），等待商家确认发放积分", "success");

    renderMyOrders();
}

// ========== 渲染我的订单列表 ==========
function renderMyOrders() {
    var container = document.getElementById("my-orders");
    if (!container) return;

    var account = LL.currentAccount();
    var orders = LL.getOrders();

    // 筛选当前用户的订单，按时间倒序
    var myOrders = [];
    for (var i = orders.length - 1; i >= 0; i--) {
        if (orders[i].buyer.toLowerCase() === (account || "").toLowerCase()) {
            myOrders.push(orders[i]);
        }
    }

    if (myOrders.length === 0) {
        container.innerHTML = "<p class=\"hint\">暂无订单</p>";
        return;
    }

    var html = "";
    for (var j = 0; j < myOrders.length; j++) {
        var o = myOrders[j];
        var statusClass = o.status; // pending / confirmed / cancelled
        var statusText = o.status === "pending" ? "待确认"
                       : o.status === "confirmed" ? "已确认"
                       : "已取消";

        html += "" +
            "<div class=\"order-card\">" +
            "  <div class=\"order-info\">" +
            "    <div class=\"order-product\">" + o.productName + "</div>" +
            "    <div class=\"order-meta\">" + o.merchant + " · ¥" + o.priceYuan + " · " + formatTime(o.timestamp) + "</div>" +
            "    <div class=\"order-meta\">订单号: " + o.id + "</div>" +
            "  </div>" +
            "  <span class=\"order-status " + statusClass + "\">" + statusText + "</span>" +
            "</div>";
    }
    container.innerHTML = html;
}

// ========== 时间格式化工具 ==========
function formatTime(ts) {
    var d = new Date(ts);
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var hours = d.getHours();
    var minutes = d.getMinutes();
    var seconds = d.getSeconds();

    return month + "/" + day + " " +
           (hours < 10 ? "0" : "") + hours + ":" +
           (minutes < 10 ? "0" : "") + minutes + ":" +
           (seconds < 10 ? "0" : "") + seconds;
}

// ========== 事件绑定 ==========
document.getElementById("connectBtn").addEventListener("click", LL.connectWallet);
