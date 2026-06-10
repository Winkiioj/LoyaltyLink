/**
 * LoyaltyLink 交易记录 — 监听合约事件 + 合并 localStorage 记录
 * 依赖：common.js（钱包连接 / 合约加载）、Web3.js CDN
 *
 * 从区块链查询 Transfer/Reward/Spend/MerchantAdded/MerchantRemoved/
 * ContractPaused/ContractUnpaused 事件，合并 localStorage 中的订单和兑换记录，
 * 按时间倒序展示，支持类型筛选。
 */

// ========== 连接完成后的初始化 ==========
LL.onReady = async function (tokenInfo) {
    LL.setActiveNav();
    await LL.updateTokenBalance();
    await LL.updateEthBalance();
    await loadHistory();

    // 绑定筛选和刷新
    document.getElementById("filter-type").addEventListener("change", loadHistory);
    document.getElementById("btn-refresh").addEventListener("click", function () {
        LL.showStatus("正在刷新交易记录...", "pending");
        loadHistory();
    });
};

// ========== 加载全部历史记录 ==========
async function loadHistory() {
    var contract = LL.contract();
    var account = LL.currentAccount();
    var container = document.getElementById("history-list");

    if (!contract || !account) {
        container.innerHTML = "<p class=\"hint\">请先连接钱包后刷新</p>";
        return;
    }

    container.innerHTML = "<p class=\"hint\">加载中...</p>";

    var filterType = document.getElementById("filter-type").value;

    try {
        // 1. 获取所有链上事件
        var eventNames = [
            "Transfer",
            "Reward",
            "Spend",
            "TokensRedeemed",
            "MerchantAdded",
            "MerchantRemoved",
            "ContractPaused",
            "ContractUnpaused"
        ];

        var chainEvents = [];
        for (var i = 0; i < eventNames.length; i++) {
            try {
                var pastEvents = await contract.getPastEvents(eventNames[i], {
                    fromBlock: 0,
                    toBlock: "latest"
                });
                chainEvents = chainEvents.concat(pastEvents);
            } catch (e) {
                // 某些事件可能还没有被触发过，跳过
                console.warn("跳过事件 " + eventNames[i] + ":", e.message);
            }
        }

        // 2. 转换为统一的历史记录项
        var chainItems = [];
        for (var j = 0; j < chainEvents.length; j++) {
            var item = transformChainEvent(chainEvents[j], account);
            if (item) {
                chainItems.push(item);
            }
        }

        // 2c. 后处理：burn Transfer (to=0x0) 统一归类为积分兑换
        // redeemTokens() 和 spend() 内部都调用 _burn() emit Transfer(to=0x0)
        // getPastEvents("TokensRedeemed") 在部分 Ganache 版本下可能不兼容
        // 这里的 Transfer 事件如果还没被归类（admin+系统销毁），统一改为 redemption
        (function () {
            var redemptionTxSet = {};
            for (var i = 0; i < chainItems.length; i++) {
                var ci = chainItems[i];
                if (ci.txHash && ci.type === "redemption") {
                    redemptionTxSet[ci.txHash.toLowerCase()] = true;
                }
            }

            var filtered = [];
            for (var i = 0; i < chainItems.length; i++) {
                var ci = chainItems[i];
                var txl = ci.txHash ? ci.txHash.toLowerCase() : "";

                // 已被 redemption 事件覆盖的 burn Transfer → 去重跳过
                if (ci.type === "admin" && ci.counterparty === "系统销毁" && redemptionTxSet[txl]) {
                    continue;
                }

                // 未被覆盖的 burn Transfer → redeemTokens 产生 → 归类为积分兑换
                if (ci.type === "admin" && ci.counterparty === "系统销毁") {
                    ci.type = "redemption";
                    ci.counterparty = "积分兑换";
                }

                filtered.push(ci);
            }
            chainItems = filtered;
        })();

        // 3. 加载 localStorage 记录
        var localItems = loadLocalHistory(account);

        // 4. 合并去重（链上记录优先）
        var allItems = mergeAndDedupe(chainItems, localItems);

        // 5. 非管理员过滤掉管理类事件（普通用户不应看到添加商家/暂停合约等）
        var currentOwner = null;
        try {
            currentOwner = await contract.methods.owner().call();
        } catch (e) {}
        var isCurrentUserOwner = currentOwner && account.toLowerCase() === currentOwner.toLowerCase();
        if (!isCurrentUserOwner) {
            allItems = allItems.filter(function (item) {
                return item.type !== "admin";
            });
        }

        // 6. 应用类型筛选
        if (filterType !== "all") {
            allItems = allItems.filter(function (item) {
                return item.type === filterType;
            });
        }

        // 7. 渲染
        renderHistory(allItems, container);

    } catch (err) {
        console.error("加载交易记录失败:", err);
        container.innerHTML = "<p class=\"hint\">加载失败: " + err.message + "</p>";
        LL.showStatus(LL.translateError(err), "error");
    }
}

// ========== 转换链上事件为统一格式 ==========
function transformChainEvent(evt, currentAccount) {
    var values = evt.returnValues;
    var blockNumber = evt.blockNumber;
    var txHash = evt.transactionHash;
    var accountLower = currentAccount.toLowerCase();

    switch (evt.event) {
        case "Transfer": {
            var from = (values.from || "").toLowerCase();
            var to = (values.to || "").toLowerCase();
            var value = values.value || "0";

            // 跳过零地址（mint/burn 由 Reward/Spend 事件覆盖）
            var isMint = from === "0x0000000000000000000000000000000000000000";
            var isBurn = to === "0x0000000000000000000000000000000000000000";

            // 判断是否与当前账户相关
            var isRelevant = (from === accountLower || to === accountLower);
            if (!isRelevant) return null;

            var direction, counterparty;
            if (isMint) {
                direction = "in";
                counterparty = "系统铸造";
            } else if (isBurn) {
                direction = "out";
                counterparty = "系统销毁";
            } else if (from === accountLower) {
                direction = "out";
                counterparty = values.to;
            } else {
                direction = "in";
                counterparty = values.from;
            }

            return {
                type: (isMint || isBurn) ? "admin" : "transfer",
                counterparty: counterparty,
                amount: LL.web3().utils.fromWei(value, "ether"),
                direction: direction,
                txHash: txHash,
                blockNumber: blockNumber
            };
        }

        case "Reward": {
            var toUser = (values.toUser || "").toLowerCase();
            var fromMerchant = values.fromMerchant || "";
            var rewardAmount = values.amount || "0";

            if (toUser === accountLower) {
                return {
                    type: "reward",
                    counterparty: fromMerchant,
                    amount: LL.web3().utils.fromWei(rewardAmount, "ether"),
                    direction: "in",
                    txHash: txHash,
                    blockNumber: blockNumber
                };
            }
            // 商家也看得到自己发放的积分
            if (fromMerchant.toLowerCase() === accountLower) {
                return {
                    type: "reward",
                    counterparty: values.toUser,
                    amount: LL.web3().utils.fromWei(rewardAmount, "ether"),
                    direction: "out",
                    txHash: txHash,
                    blockNumber: blockNumber
                };
            }
            return null;
        }

        case "Spend": {
            var fromUser = (values.fromUser || "").toLowerCase();
            var spendFromMerchant = values.fromMerchant || "";
            var spendAmount = values.amount || "0";

            if (fromUser === accountLower) {
                return {
                    type: "redemption",
                    counterparty: spendFromMerchant,
                    amount: LL.web3().utils.fromWei(spendAmount, "ether"),
                    direction: "out",
                    txHash: txHash,
                    blockNumber: blockNumber
                };
            }
            if (spendFromMerchant.toLowerCase() === accountLower) {
                return {
                    type: "redemption",
                    counterparty: values.fromUser,
                    amount: LL.web3().utils.fromWei(spendAmount, "ether"),
                    direction: "in",
                    txHash: txHash,
                    blockNumber: blockNumber
                };
            }
            return null;
        }

        case "TokensRedeemed": {
            var redeemer = (values.user || "").toLowerCase();
            var redeemAmount = values.amount || "0";

            if (redeemer === accountLower) {
                return {
                    type: "redemption",
                    counterparty: "积分兑换",
                    amount: LL.web3().utils.fromWei(redeemAmount, "ether"),
                    direction: "out",
                    txHash: txHash,
                    blockNumber: blockNumber
                };
            }
            return null;
        }

        case "MerchantAdded":
            return {
                type: "admin",
                counterparty: values.merchant || "",
                amount: "0",
                direction: "none",
                txHash: txHash,
                blockNumber: blockNumber,
                description: "添加商家: " + LL.truncateAddress(values.merchant || "")
            };

        case "MerchantRemoved":
            return {
                type: "admin",
                counterparty: values.merchant || "",
                amount: "0",
                direction: "none",
                txHash: txHash,
                blockNumber: blockNumber,
                description: "移除商家: " + LL.truncateAddress(values.merchant || "")
            };

        case "ContractPaused":
            return {
                type: "admin",
                counterparty: values.by || "",
                amount: "0",
                direction: "none",
                txHash: txHash,
                blockNumber: blockNumber,
                description: "合约已暂停"
            };

        case "ContractUnpaused":
            return {
                type: "admin",
                counterparty: values.by || "",
                amount: "0",
                direction: "none",
                txHash: txHash,
                blockNumber: blockNumber,
                description: "合约已恢复"
            };

        default:
            return null;
    }
}

// ========== 加载 localStorage 中的链下记录 ==========
function loadLocalHistory(account) {
    var items = [];
    var accountLower = account.toLowerCase();

    // 商城订单
    try {
        var orders = LL.getOrders();
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            if (o.buyer.toLowerCase() === accountLower) {
                items.push({
                    type: "order",
                    counterparty: o.merchant,
                    amount: String(o.priceYuan),
                    direction: "out",
                    txHash: o.txHash || null,
                    timestamp: o.timestamp,
                    description: "商城购买: " + o.productName + " (¥" + o.priceYuan + ")",
                    status: o.status
                });
            }
        }
    } catch (e) {}

    // 积分兑换
    try {
        var redemptions = LL.getRedemptions();
        for (var j = 0; j < redemptions.length; j++) {
            var r = redemptions[j];
            if (r.redeemer.toLowerCase() === accountLower) {
                items.push({
                    type: "redemption",
                    counterparty: "积分商城",
                    amount: String(r.pointsRequired),
                    direction: "out",
                    txHash: r.txHash || null,
                    timestamp: r.timestamp,
                    description: "积分兑换: " + r.itemName + " (" + r.pointsRequired + " LYL)",
                    status: r.status
                });
            }
        }
    } catch (e) {}

    return items;
}

// ========== 合并去重（链上记录优先，通过 txHash 去重） ==========
function mergeAndDedupe(chainItems, localItems) {
    var txHashes = {};
    for (var i = 0; i < chainItems.length; i++) {
        if (chainItems[i].txHash) {
            txHashes[chainItems[i].txHash.toLowerCase()] = true;
        }
    }

    // 添加链下记录中不在链上的项
    for (var j = 0; j < localItems.length; j++) {
        var item = localItems[j];
        // 如果有 txHash 且链上已存在，跳过（已由链上事件覆盖）
        if (item.txHash && txHashes[item.txHash.toLowerCase()]) {
            continue;
        }
        // 没有 txHash 或 txHash 不在链上 → 作为链下记录添加
        chainItems.push(item);
    }

    // 按 blockNumber / timestamp 降序排列
    chainItems.sort(function (a, b) {
        var aNum = a.blockNumber || Math.floor((a.timestamp || 0) / 1000);
        var bNum = b.blockNumber || Math.floor((b.timestamp || 0) / 1000);
        return bNum - aNum;
    });

    return chainItems;
}

// ========== 渲染历史记录 ==========
function renderHistory(items, container) {
    if (items.length === 0) {
        container.innerHTML = "<p class=\"hint\">暂无相关记录</p>";
        return;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var badgeClass = getBadgeClass(item.type);
        var badgeText = getBadgeText(item.type);
        var directionIcon = item.direction === "in" ? "↓" : (item.direction === "out" ? "↑" : "•");
        var directionClass = item.direction;

        // 描述文本
        var desc = item.description || (getBadgeText(item.type) + ": " + LL.truncateAddress(item.counterparty));

        // 金额显示
        var amountDisplay = "";
        if (item.amount && item.amount !== "0") {
            amountDisplay = "<div class=\"history-amount\">" + item.amount + " LYL</div>";
        }

        // 交易哈希链接
        var txDisplay = "";
        if (item.txHash) {
            txDisplay = "<div class=\"history-tx\"><span class=\"tx-link\" data-tx=\"" + item.txHash +
                        "\" title=\"" + item.txHash + "\">" + item.txHash.substring(0, 10) + "...</span></div>";
        } else if (item.status === "pending") {
            txDisplay = "<div class=\"history-tx\"><span class=\"no-tx\">待上链</span></div>";
        }

        // 状态徽章（仅链下记录显示）
        var statusBadge = "";
        if (item.status === "pending") {
            statusBadge = "<span class=\"order-status pending\">待确认</span>";
        } else if (item.status === "confirmed" && !item.txHash) {
            statusBadge = "<span class=\"order-status confirmed\">已确认</span>";
        }

        html += "" +
            "<div class=\"history-card\">" +
            "  <span class=\"badge " + badgeClass + "\">" + badgeText + "</span>" +
            "  <span class=\"history-direction " + directionClass + "\">" + directionIcon + "</span>" +
            "  <div class=\"history-details\">" +
            "    <div class=\"history-counterparty\">" + escapeHtml(desc) + "</div>" +
            amountDisplay +
            txDisplay +
            "  </div>" +
            statusBadge +
            "</div>";
    }
    container.innerHTML = html;

    // 绑定交易哈希点击事件
    var txLinks = container.querySelectorAll(".tx-link");
    for (var k = 0; k < txLinks.length; k++) {
        txLinks[k].addEventListener("click", function (e) {
            e.preventDefault();
            var txHash = this.getAttribute("data-tx");
            // 复制交易哈希到剪贴板（Ganache 无区块浏览器）
            if (navigator.clipboard) {
                navigator.clipboard.writeText(txHash).then(function () {
                    LL.showStatus("交易哈希已复制: " + txHash.substring(0, 10) + "...", "success");
                });
            } else {
                alert("交易哈希: " + txHash);
            }
        });
    }
}

// ========== 类型徽章样式映射 ==========
function getBadgeClass(type) {
    var map = {
        reward: "badge-success",
        transfer: "badge-info",
        admin: "badge-purple",
        order: "badge-pending",
        redemption: "badge-pending"
    };
    return map[type] || "badge-default";
}

// ========== 类型中文标签 ==========
function getBadgeText(type) {
    var map = {
        reward: "发放",
        transfer: "转账",
        admin: "管理",
        order: "订单",
        redemption: "兑换"
    };
    return map[type] || type;
}

// ========== HTML 转义 ==========
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ========== 事件绑定 ==========
document.getElementById("connectBtn").addEventListener("click", LL.connectWallet);
