/**
 * LoyaltyLink 管理端 — 商家白名单管理、合约暂停/恢复
 * 依赖：common.js（钱包连接 / 合约加载）、Web3.js CDN
 */

// ========== 连接完成后的初始化 ==========
LL.onReady = async function (tokenInfo) {
    LL.setActiveNav();
    LL.showStatus("正在获取管理员信息...", "pending");
    await updateAdminInfo();

    LL.showStatus("正在加载商家白名单...", "pending");
    await loadMerchantList();

    LL.showStatus("正在查询合约状态...", "pending");
    await updatePauseStatus();
};

// ========== 更新管理员信息 ==========
async function updateAdminInfo() {
    try {
        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) return;

        var owner = await contract.methods.owner().call();
        var isAdmin = owner.toLowerCase() === currentAccount.toLowerCase();

        document.getElementById("ownerInfo").innerText =
            "Owner: " + owner;

        document.getElementById("adminStatus").innerText =
            isAdmin ? "管理员状态: 是管理员，可以添加/移除商家" : "管理员状态: 不是管理员，只能查询";

        await LL.updateEthBalance();
    } catch (error) {
        console.error("更新管理员信息失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    }
}

// ========== 添加商家 ==========
async function addMerchant() {
    var restoreBtn = function () {};

    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var merchant = document.getElementById("addMerchantAddress").value.trim();
        var name = document.getElementById("addMerchantName").value.trim();

        if (!merchant) {
            LL.showFieldError("addMerchantAddress", "请输入商家地址");
            return;
        }

        if (!LL.web3().utils.isAddress(merchant)) {
            LL.showFieldError("addMerchantAddress", "请输入有效的以太坊地址 (0x...)");
            return;
        }

        // 构建确认消息
        var confirmMsg = "即将添加商家: " + LL.truncateAddress(merchant);
        if (name) {
            confirmMsg += "\n商家名称: " + name;
        }

        var confirmed = await LL.confirm("确认添加商家", confirmMsg);
        if (!confirmed) return;

        restoreBtn = LL.setButtonLoading("addMerchantBtn", "添加处理中...");

        await contract.methods.addMerchant(merchant).send({
            from: currentAccount,
            gas: 300000
        });

        // 保存商家名称（如果有）
        if (name) {
            LL.saveMerchantName(merchant, name);
        }

        document.getElementById("addMerchantAddress").value = "";
        document.getElementById("addMerchantName").value = "";

        await loadMerchantList();

        LL.showStatus("商家添加成功" + (name ? "：" + name : ""), "success");
    } catch (error) {
        console.error("添加商家失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 移除商家 ==========
async function removeMerchant() {
    var restoreBtn = function () {};

    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var merchant = document.getElementById("removeMerchantAddress").value.trim();

        if (!merchant) {
            LL.showFieldError("removeMerchantAddress", "请输入商家地址");
            return;
        }

        if (!LL.web3().utils.isAddress(merchant)) {
            LL.showFieldError("removeMerchantAddress", "请输入有效的以太坊地址 (0x...)");
            return;
        }

        // 获取商家名称用于友好提示
        var names = LL.getMerchantNames();
        var displayName = names[merchant.toLowerCase()] || LL.truncateAddress(merchant);

        var confirmed = await LL.confirm(
            "确认移除商家",
            "即将移除商家: " + displayName + "\n\n移除后该地址将无法发放/扣除积分"
        );
        if (!confirmed) return;

        restoreBtn = LL.setButtonLoading("removeMerchantBtn", "移除处理中...");

        await contract.methods.removeMerchant(merchant).send({
            from: currentAccount,
            gas: 300000
        });

        document.getElementById("removeMerchantAddress").value = "";

        await loadMerchantList();

        LL.showStatus("商家移除成功：" + displayName, "success");
    } catch (error) {
        console.error("移除商家失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 查询指定地址是否为商家 ==========
async function checkMerchant() {
    try {
        LL.clearAllFieldErrors();

        var contract = LL.contract();

        if (!contract) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var address = document.getElementById("checkMerchantAddress").value.trim();

        if (!address) {
            LL.showFieldError("checkMerchantAddress", "请输入查询地址");
            return;
        }

        if (!LL.web3().utils.isAddress(address)) {
            LL.showFieldError("checkMerchantAddress", "请输入有效的以太坊地址 (0x...)");
            return;
        }

        var isMerchant = await contract.methods.merchants(address).call();
        var names = LL.getMerchantNames();
        var displayName = names[address.toLowerCase()] || "";

        var text = isMerchant ? "查询结果: 是商家" : "查询结果: 不是商家";
        if (displayName) {
            text += " (" + displayName + ")";
        }

        document.getElementById("checkMerchantResult").innerText = text;
    } catch (error) {
        console.error("查询商家状态失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    }
}

// ========== 加载当前商家白名单 ==========
// 按时间顺序重放 Add/Remove 事件，保证最终状态正确
async function loadMerchantList() {
    try {
        var contract = LL.contract();

        if (!contract) return;

        var addedEvents = await contract.getPastEvents("MerchantAdded", {
            fromBlock: 0,
            toBlock: "latest"
        });

        var removedEvents = await contract.getPastEvents("MerchantRemoved", {
            fromBlock: 0,
            toBlock: "latest"
        });

        // 合并并按区块号+交易索引排序，确保按时间顺序重放
        var allEvents = addedEvents.map(function (e) { return { address: e.returnValues.merchant, blockNumber: e.blockNumber, txIndex: e.transactionIndex, type: "add" }; })
            .concat(removedEvents.map(function (e) { return { address: e.returnValues.merchant, blockNumber: e.blockNumber, txIndex: e.transactionIndex, type: "remove" }; }))
            .sort(function (a, b) {
                if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
                return a.txIndex - b.txIndex;
            });

        var merchantMap = new Map();

        for (var i = 0; i < allEvents.length; i++) {
            var evt = allEvents[i];
            if (evt.type === "add") {
                merchantMap.set(evt.address.toLowerCase(), evt.address);
            } else {
                merchantMap.delete(evt.address.toLowerCase());
            }
        }

        var listDiv = document.getElementById("merchantList");
        var names = LL.getMerchantNames();

        if (merchantMap.size === 0) {
            listDiv.innerHTML = "暂无商家";
            return;
        }

        var html = "<ul>";
        var entries = merchantMap.values();
        var entry = entries.next();
        while (!entry.done) {
            var addr = entry.value;
            var merchantName = names[addr.toLowerCase()];
            var displayText = merchantName
                ? addr + " <span style=\"color: #667eea; font-weight: 600;\">(" + merchantName + ")</span>"
                : addr;
            html += "<li style=\"word-break: break-all; margin: 8px 0;\">" + displayText + "</li>";
            entry = entries.next();
        }
        html += "</ul>";

        listDiv.innerHTML = html;
    } catch (error) {
        console.error("加载商家白名单失败:", error);
        LL.showStatus("加载商家白名单失败: " + error.message, "error");
    }
}

// ========== 暂停/恢复（紧急控制） ==========

async function updatePauseStatus() {
    try {
        var contract = LL.contract();
        if (!contract) return;

        var paused = await contract.methods.paused().call();
        document.getElementById("pauseStatus").innerText =
            "合约状态: " + (paused ? "已暂停 ⚠️" : "正常运行 ✅");
    } catch (error) {
        console.error("查询暂停状态失败:", error);
    }
}

async function pauseContract() {
    var restoreBtn = function () {};

    try {
        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var confirmed = await LL.confirm(
            "确认暂停合约",
            "即将暂停合约的所有积分操作\n\n暂停后 reward / spend / transfer 均无法执行\n管理员仍可添加/移除商家"
        );
        if (!confirmed) return;

        restoreBtn = LL.setButtonLoading("pauseBtn", "暂停处理中...");

        await contract.methods.pause().send({ from: currentAccount, gas: 200000 });

        await updatePauseStatus();
        LL.showStatus("合约已暂停，所有积分操作被冻结", "success");
    } catch (error) {
        console.error("暂停失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

async function unpauseContract() {
    var restoreBtn = function () {};

    try {
        var contract = LL.contract();
        var currentAccount = LL.currentAccount();

        if (!contract || !currentAccount) {
            LL.showStatus("请先连接钱包", "error");
            return;
        }

        var confirmed = await LL.confirm(
            "确认恢复合约",
            "即将恢复合约的所有积分操作\n\n恢复后所有功能恢复正常"
        );
        if (!confirmed) return;

        restoreBtn = LL.setButtonLoading("unpauseBtn", "恢复处理中...");

        await contract.methods.unpause().send({ from: currentAccount, gas: 200000 });

        await updatePauseStatus();
        LL.showStatus("合约已恢复，所有功能正常", "success");
    } catch (error) {
        console.error("恢复失败:", error);
        LL.showStatus(LL.translateError(error), "error");
    } finally {
        restoreBtn();
    }
}

// ========== 事件绑定（防御性注册，避免单个元素缺失阻断整个页面） ==========
(function bindEvents() {
    try {
        var els = {
            connectBtn: LL.connectWallet,
            refreshBtn: loadMerchantList,
            addMerchantBtn: addMerchant,
            removeMerchantBtn: removeMerchant,
            checkMerchantBtn: checkMerchant,
            pauseBtn: pauseContract,
            unpauseBtn: unpauseContract
        };
        for (var id in els) {
            var el = document.getElementById(id);
            if (el) el.addEventListener("click", els[id]);
        }

        // 输入框实时清除错误
        var inputs = ["addMerchantAddress", "addMerchantName", "removeMerchantAddress", "checkMerchantAddress"];
        for (var i = 0; i < inputs.length; i++) {
            var inp = document.getElementById(inputs[i]);
            if (inp) {
                inp.addEventListener("input", (function (inputId) {
                    return function () { LL.clearFieldError(inputId); };
                })(inputs[i]));
            }
        }
    } catch (e) {
        console.error("admin.js 事件绑定失败:", e);
    }
})();
