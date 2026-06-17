/**
 * LoyaltyLink 前端公共模块
 * 提供钱包连接、网络检测、合约加载、状态显示等共享功能
 * 所有页面（用户端/商户端/管理端）共同依赖此文件
 *
 * 使用方式：
 *   1. 在 HTML 中：<script src="js/common.js"></script>
 *   2. 在页面 JS 中直接使用全局对象 LL
 *   3. 页面 JS 需定义 LL.onReady() 作为连接完成后的回调
 */

// ========== 全局命名空间 ==========
const LL = window.LL || {};

(function () {
    "use strict";

    // ========== 内部状态 ==========
    let web3 = null;
    let contract = null;
    let currentAccount = null;

    /** 合约地址（部署脚本自动更新） */
    const contractAddress = "0x35FBB483C743402FefAf6f4144984F5755941207";

    /** Ganache Chain ID (1337 = 0x539) */
    const requiredChainId = "0x539";

    // ========== 对外暴露的状态读取 ==========
    LL.web3 = () => web3;
    LL.contract = () => contract;
    LL.currentAccount = () => currentAccount;
    LL.contractAddress = () => contractAddress;

    // ========== 显示状态信息 ==========
    /**
     * 在页面上显示操作结果提示
     * @param {string} message - 提示文字
     * @param {'success'|'error'|'pending'} type - 提示类型
     */
    LL.showStatus = function (message, type) {
        const statusDiv = document.getElementById("status");
        if (!statusDiv) return;
        statusDiv.innerText = message;
        statusDiv.className = type;
        statusDiv.style.display = "block";

        // 错误消息不自动消失，方便排查
        if (type !== "error") {
            setTimeout(function () {
                statusDiv.style.display = "none";
            }, 3000);
        }
    };

    // ========== 校验并切换网络 ==========
    async function checkNetwork() {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });

        if (chainId !== requiredChainId) {
            // 尝试自动切换到 Ganache 网络
            try {
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: requiredChainId }]
                });
            } catch (switchError) {
                // 网络不存在则添加
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: "wallet_addEthereumChain",
                            params: [{
                                chainId: requiredChainId,
                                chainName: "Ganache Local",
                                rpcUrls: ["http://127.0.0.1:7545"],
                                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
                            }]
                        });
                    } catch (addError) {
                        throw new Error("无法添加 Ganache 网络: " + addError.message);
                    }
                } else {
                    throw new Error("切换网络被拒绝，请在 MetaMask 中手动切换到 Ganache Local (1337)");
                }
            }
        }
    }

    // ========== 加载合约 ==========
    async function loadContract() {
        let response;
        try {
            response = await fetch("abi.json");
        } catch (e) {
            throw new Error("无法加载 abi.json，请确认前端服务在 frontend/ 目录启动");
        }

        if (!response.ok) {
            throw new Error("ABI 加载失败 (HTTP " + response.status + ")");
        }

        const abi = await response.json();
        contract = new web3.eth.Contract(abi, contractAddress);

        try {
            const code = await web3.eth.getCode(contractAddress);
            if (code === "0x" || code === "0x0") {
                throw new Error("合约未部署到地址 " + contractAddress + "，请重新运行部署脚本");
            }
        } catch (e) {
            if (e.message.includes("合约未部署")) throw e;
            throw new Error("无法在 " + contractAddress + " 找到合约，请确认 Ganache 已启动且合约已部署");
        }

        const name = await contract.methods.name().call();
        const symbol = await contract.methods.symbol().call();
        const decimals = await contract.methods.decimals().call();

        const tokenInfoEl = document.getElementById("tokenInfo");
        if (tokenInfoEl) {
            tokenInfoEl.innerText = "代币: " + name + " (" + symbol + "), 小数位: " + decimals;
        }

        return { name, symbol, decimals };
    }

    // ========== 连接钱包（主入口） ==========
    /**
     * 连接 MetaMask 钱包并初始化合约
     * 完成后自动调用 LL.onReady() 回调（由各页面定义）
     *
     * 角色校验：
     *   - admin.html → 仅合约 Owner 可连接
     *   - merchant.html → 仅白名单商家可连接
     *   - 其他页面 → 所有用户可连接
     *   校验不通过则显示错误，不触发 LL.onReady()
     */
    LL.connectWallet = async function () {
        try {
            if (!window.ethereum) {
                LL.showStatus("请先安装 MetaMask 插件！", "error");
                return;
            }

            LL.showStatus("正在连接钱包...", "pending");

            web3 = new Web3(window.ethereum);

            await window.ethereum.request({ method: "eth_requestAccounts" });
            await checkNetwork();

            const accounts = await web3.eth.getAccounts();
            currentAccount = accounts[0];

            const accountEl = document.getElementById("account");
            if (accountEl) {
                accountEl.innerText = "账户: " + currentAccount.substring(0, 6) + "..." + currentAccount.substring(38);
            }

            LL.showStatus("正在加载合约...", "pending");
            const tokenInfo = await loadContract();

            // 角色校验（在触发 onReady 之前）
            const roleCheck = await checkPageRole();
            if (!roleCheck.allowed) {
                LL.showStatus(roleCheck.message, "error");
                // 显示角色错误覆盖层，隐藏功能区域
                showRoleError(roleCheck.message);
                return;  // 不触发 LL.onReady()
            }

            // 调用页面自定义的初始化逻辑
            if (typeof LL.onReady === "function") {
                await LL.onReady(tokenInfo);
            }

            LL.showStatus("钱包连接成功", "success");

            return { account: currentAccount, tokenInfo };
        } catch (error) {
            console.error("连接失败:", error);
            LL.showStatus("连接钱包失败: " + (error.message || "未知错误"), "error");
        }
    };

    // ========== 角色校验 ==========
    /**
     * 根据 data-page 检查当前账户是否有权限访问该页面
     *   - admin    → 必须是合约 Owner
     *   - merchant → 必须是商家（merchants 映射中为 true）
     *   - 其他     → 所有用户可访问
     * @returns {{ allowed: boolean, message: string }}
     */
    async function checkPageRole() {
        const page = document.body.getAttribute("data-page") || "";
        const account = currentAccount;

        if (!contract || !account) {
            return { allowed: false, message: "合约未加载" };
        }

        try {
            if (page === "admin") {
                const owner = await contract.methods.owner().call();
                if (owner.toLowerCase() !== account.toLowerCase()) {
                    return {
                        allowed: false,
                        message: "权限不足：仅合约管理员可访问管理后台。\n当前账户: " + LL.truncateAddress(account) + "\n请切换到 Account 0（管理员）"
                    };
                }
            }

            if (page === "merchant") {
                const isMerchant = await contract.methods.merchants(account).call();
                if (!isMerchant) {
                    return {
                        allowed: false,
                        message: "权限不足：仅联盟商家可访问商家后台。\n当前账户: " + LL.truncateAddress(account) + "\n请切换到 Account 1（商家）"
                    };
                }
            }

            // index / shop / redeem / history — 所有人可访问
            return { allowed: true, message: "" };
        } catch (err) {
            console.error("角色校验失败:", err);
            return { allowed: false, message: "角色校验失败: " + (err.message || "未知错误") };
        }
    }

    /**
     * 角色不匹配时显示错误覆盖层，隐藏所有功能区域
     */
    function showRoleError(msg) {
        // 隐藏 .container 内所有直接子元素（h1/h2/h3/button/input/hr/div...）
        // 然后插入错误提示卡片，接着显示 .container 本身
        const mainEl = document.querySelector(".main") || document.querySelector(".container");
        if (mainEl) {
            // 先移除已有覆盖层（如果重复调用）
            const existing = document.getElementById("role-error");
            if (existing) existing.parentNode.removeChild(existing);

            // 隐藏所有直接子元素
            var children = mainEl.children;
            for (var i = children.length - 1; i >= 0; i--) {
                children[i].style.display = "none";
            }

            // 创建错误卡片
            const overlay = document.createElement("div");
            overlay.id = "role-error";
            overlay.style.cssText = "background:#fff3f3;border:2px solid #e53e3e;border-radius:12px;padding:32px 24px;margin:24px auto;text-align:center;max-width:600px;";
            overlay.innerHTML = "" +
                "<div style=\"font-size:3rem;margin-bottom:12px;\">🔒</div>" +
                "<h2 style=\"color:#c53030;margin:0 0 12px 0;\">访问被拒绝</h2>" +
                "<p style=\"color:#666;white-space:pre-line;line-height:1.7;margin:0;\">" + escapeHtml(msg) + "</p>" +
                "<p style=\"color:#999;font-size:0.85rem;margin:16px 0 0 0;\">请在 MetaMask 中切换到正确的账户后刷新页面重试</p>";

            mainEl.appendChild(overlay);
            // 恢复 main/container 本身可见
            mainEl.style.display = "block";
        }
    }

    // 简单的 HTML 转义（避免覆盖层中注入）
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // ========== 获取 ETH 余额（共用工具） ==========
    /**
     * 查询当前账户的 ETH 余额并更新页面显示
     */
    LL.updateEthBalance = async function () {
        try {
            if (!web3 || !currentAccount) return;

            const ethBalanceWei = await web3.eth.getBalance(currentAccount);
            const ethBalance = web3.utils.fromWei(ethBalanceWei, "ether");

            const ethBalanceEl = document.getElementById("ethBalance");
            if (ethBalanceEl) {
                ethBalanceEl.innerText = "ETH 余额: " + parseFloat(ethBalance).toFixed(4) + " ETH";
            }

            return ethBalance;
        } catch (error) {
            console.error("查询 ETH 余额失败:", error);
        }
    };

    // ========== 获取 LYL 余额（共用工具） ==========
    /**
     * 查询当前账户的 LYL 余额并更新页面显示
     */
    LL.updateTokenBalance = async function () {
        try {
            if (!contract || !currentAccount) return;

            const symbol = await contract.methods.symbol().call();
            const tokenBalanceRaw = await contract.methods.balanceOf(currentAccount).call();
            const tokenBalance = web3.utils.fromWei(tokenBalanceRaw, "ether");

            const balanceEl = document.getElementById("balance");
            if (balanceEl) {
                balanceEl.innerText = "LYL 余额: " + tokenBalance + " " + symbol;
            }

            return tokenBalance;
        } catch (error) {
            console.error("查询 LYL 余额失败:", error);
        }
    };

    // ========== 导航栏高亮 ==========
    /**
     * 根据当前页面的 data-page 属性高亮对应的导航链接
     */
    LL.setActiveNav = function () {
        var page = document.body.getAttribute("data-page");
        if (!page) return;
        var links = document.querySelectorAll(".sidebar-link, .nav-link");
        for (var i = 0; i < links.length; i++) {
            if (links[i].getAttribute("data-page") === page) {
                links[i].classList.add("active");
            }
        }
    };

    // ========== 地址截断工具 ==========
    /**
     * 将以太坊地址截断为 0x开头...末4位 的可读格式
     * @param {string} address - 完整地址
     * @returns {string} 截断后的地址
     */
    LL.truncateAddress = function (address) {
        if (!address) return "";
        return address.substring(0, 6) + "..." + address.substring(38);
    };

    // ========== localStorage 数据存取 ==========
    /** 获取所有商城订单 */
    LL.getOrders = function () {
        try { return JSON.parse(localStorage.getItem("ll_orders") || "[]"); }
        catch (e) { return []; }
    };

    /** 保存商城订单列表 */
    LL.saveOrders = function (orders) {
        localStorage.setItem("ll_orders", JSON.stringify(orders));
    };

    /** 获取所有兑换记录 */
    LL.getRedemptions = function () {
        try { return JSON.parse(localStorage.getItem("ll_redemptions") || "[]"); }
        catch (e) { return []; }
    };

    /** 保存兑换记录列表 */
    LL.saveRedemptions = function (redemptions) {
        localStorage.setItem("ll_redemptions", JSON.stringify(redemptions));
    };

    /** 获取商家名称映射表 { address: name } */
    LL.getMerchantNames = function () {
        try { return JSON.parse(localStorage.getItem("ll_merchants") || "{}"); }
        catch (e) { return {}; }
    };

    /** 保存商家名称映射 */
    LL.saveMerchantName = function (address, name) {
        var merchants = LL.getMerchantNames();
        merchants[address.toLowerCase()] = name;
        localStorage.setItem("ll_merchants", JSON.stringify(merchants));
    };

    /** 获取商家自定义商品列表 */
    LL.getMerchantProducts = function () {
        try { return JSON.parse(localStorage.getItem("ll_merchant_products") || "[]"); }
        catch (e) { return []; }
    };

    /** 保存商家自定义商品 */
    LL.addMerchantProduct = function (product) {
        var products = LL.getMerchantProducts();
        products.push(product);
        localStorage.setItem("ll_merchant_products", JSON.stringify(products));
    };

    /** 删除商家自定义商品 */
    LL.removeMerchantProduct = function (productId) {
        var products = LL.getMerchantProducts();
        products = products.filter(function (p) { return p.id !== productId; });
        localStorage.setItem("ll_merchant_products", JSON.stringify(products));
    };

    /** 获取商家自定义兑换奖品列表 */
    LL.getMerchantRedeemItems = function () {
        try { return JSON.parse(localStorage.getItem("ll_merchant_redeems") || "[]"); }
        catch (e) { return []; }
    };

    /** 保存商家自定义兑换奖品 */
    LL.addMerchantRedeemItem = function (item) {
        var items = LL.getMerchantRedeemItems();
        items.push(item);
        localStorage.setItem("ll_merchant_redeems", JSON.stringify(items));
    };

    /** 删除商家自定义兑换奖品 */
    LL.removeMerchantRedeemItem = function (itemId) {
        var items = LL.getMerchantRedeemItems();
        items = items.filter(function (it) { return it.id !== itemId; });
        localStorage.setItem("ll_merchant_redeems", JSON.stringify(items));
    };

    // ========== 中文错误消息映射 ==========
    /**
     * 将 Solidity revert 错误翻译为中文用户友好提示
     * @param {Error|string} error - 原始错误对象或消息
     * @returns {string} 翻译后的中文消息
     */
    LL.translateError = function (error) {
        if (!error) return "操作失败：未知错误";

        // 用户主动取消交易
        if (error && error.code === 4001) {
            return "操作取消：您在 MetaMask 中拒绝了交易";
        }

        var msg = "";
        if (typeof error === "string") {
            msg = error;
        } else if (error.message) {
            msg = error.message;
        } else {
            msg = String(error);
        }

        // 精确匹配常见 revert 消息
        if (msg.indexOf("Not a merchant") !== -1 || msg.indexOf("LoyaltyToken: Not a merchant") !== -1) {
            return "操作失败：当前账户不是联盟商家，请联系管理员添加";
        }
        if (msg.indexOf("Target not a merchant") !== -1) {
            return "操作失败：结算目标地址不是注册商家";
        }
        if (msg.indexOf("Insufficient balance") !== -1 || msg.indexOf("LoyaltyToken: Insufficient balance") !== -1) {
            return "操作失败：用户积分余额不足，无法完成此操作";
        }
        if (msg.indexOf("Faucet cooldown not elapsed") !== -1) {
            return "操作失败：水龙头冷却时间未到，请稍后再领取";
        }
        if (msg.indexOf("Rate must be positive") !== -1) {
            return "操作失败：汇率必须大于 0";
        }
        if (msg.indexOf("EnforcedPause") !== -1) {
            return "操作失败：合约已被管理员暂停，所有积分操作暂时冻结";
        }
        if (msg.indexOf("OwnableUnauthorizedAccount") !== -1) {
            return "操作失败：仅管理员可执行此操作，请切换到管理员账户";
        }
        if (msg.indexOf("ERC20InsufficientBalance") !== -1) {
            return "操作失败：积分余额不足，无法完成转账";
        }
        if (msg.indexOf("ERC20InvalidReceiver") !== -1) {
            return "操作失败：接收地址无效（不能为零地址）";
        }

        // 用户拒绝了网络切换
        if (msg.indexOf("切换网络被拒绝") !== -1) {
            return "操作失败：" + msg;
        }

        // 兜底：返回原始错误信息的前200个字符
        if (msg.length > 200) {
            msg = msg.substring(0, 200) + "...";
        }
        return "操作失败：" + msg;
    };

    // ========== 通用确认对话框 ==========
    /**
     * 弹出确认对话框，返回 Promise<boolean>
     * @param {string} title - 对话框标题
     * @param {string} message - 确认内容（支持 \n 换行）
     * @returns {Promise<boolean>} 用户确认返回 true，取消返回 false
     */
    LL.confirm = function (title, message) {
        return new Promise(function (resolve) {
            // 移除已有的对话框（避免重复）
            var existing = document.getElementById("ll-confirm-overlay");
            if (existing) existing.parentNode.removeChild(existing);

            // 创建对话框 DOM
            var overlay = document.createElement("div");
            overlay.id = "ll-confirm-overlay";
            overlay.className = "dialog-overlay show";

            var box = document.createElement("div");
            box.className = "dialog-box";

            var h3 = document.createElement("h3");
            h3.innerText = title;

            var p = document.createElement("p");
            // 支持换行
            p.style.whiteSpace = "pre-line";
            p.innerText = message;

            var btnGroup = document.createElement("div");
            btnGroup.className = "dialog-buttons";

            var cancelBtn = document.createElement("button");
            cancelBtn.className = "button-secondary";
            cancelBtn.innerText = "取消";

            var confirmBtn = document.createElement("button");
            confirmBtn.innerText = "确认";

            btnGroup.appendChild(cancelBtn);
            btnGroup.appendChild(confirmBtn);
            box.appendChild(h3);
            box.appendChild(p);
            box.appendChild(btnGroup);
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            // 关闭函数
            function closeDialog(result) {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                resolve(result);
            }

            // 事件绑定
            confirmBtn.addEventListener("click", function () { closeDialog(true); });
            cancelBtn.addEventListener("click", function () { closeDialog(false); });
            overlay.addEventListener("click", function (e) {
                if (e.target === overlay) closeDialog(false);
            });
        });
    };

    // ========== 按钮 Loading 状态 ==========
    /**
     * 将按钮置为加载中状态（禁用+改文字）
     * @param {HTMLElement|string} btnOrId - 按钮元素或 id
     * @param {string} loadingText - 加载中显示的文字
     * @returns {function} 恢复函数，调用后恢复按钮原始状态
     */
    LL.setButtonLoading = function (btnOrId, loadingText) {
        var btn = typeof btnOrId === "string" ? document.getElementById(btnOrId) : btnOrId;
        if (!btn) return function () {};

        var originalText = btn.innerText;
        var originalDisabled = btn.disabled;

        btn.disabled = true;
        btn.innerHTML = "<span class=\"loading-spinner\"></span>" + (loadingText || "处理中...");

        return function () {
            btn.disabled = originalDisabled;
            btn.innerText = originalText;
        };
    };

    // ========== 表单字段校验提示 ==========
    /**
     * 在输入框下方显示红色错误提示
     * @param {HTMLElement|string} inputOrId - 输入框元素或 id
     * @param {string} message - 错误提示文字
     */
    LL.showFieldError = function (inputOrId, message) {
        var input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
        if (!input) return;

        // 查找或创建 .field-error 元素
        var errorEl = input.parentNode.querySelector(".field-error");
        if (!errorEl) {
            errorEl = document.createElement("span");
            errorEl.className = "field-error";
            input.parentNode.insertBefore(errorEl, input.nextSibling);
        }

        errorEl.innerText = message;
        errorEl.classList.add("show");
        input.classList.add("input-error");
    };

    /**
     * 清除指定输入框的错误提示
     * @param {HTMLElement|string} inputOrId - 输入框元素或 id
     */
    LL.clearFieldError = function (inputOrId) {
        var input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
        if (!input) return;

        input.classList.remove("input-error");
        var errorEl = input.parentNode.querySelector(".field-error");
        if (errorEl) {
            errorEl.classList.remove("show");
            errorEl.innerText = "";
        }
    };

    /**
     * 清除页面上所有字段的错误提示
     */
    LL.clearAllFieldErrors = function () {
        var errors = document.querySelectorAll(".field-error");
        for (var i = 0; i < errors.length; i++) {
            errors[i].classList.remove("show");
            errors[i].innerText = "";
        }
        var inputs = document.querySelectorAll(".input-error");
        for (var j = 0; j < inputs.length; j++) {
            inputs[j].classList.remove("input-error");
        }
    };

    // ========== 钱包事件监听 ==========
    console.log("[LoyaltyLink] common.js 已加载，LL.connectWallet =", typeof LL.connectWallet);
    if (window.ethereum) {
        window.ethereum.on("accountsChanged", function () {
            location.reload();
        });
        window.ethereum.on("chainChanged", function () {
            location.reload();
        });
    }
})();
