// ========== 全局变量 ==========
let web3;
let contract;
let currentAccount;

const contractAddress = "0x51566FbC6251682a434E57714Cb14e1D6b69B0df";
const requiredChainId = "0x539"; // 1337

// ========== 显示状态信息 ==========
function showStatus(message, type) {
    const statusDiv = document.getElementById("status");
    statusDiv.innerText = message;
    statusDiv.className = type;
    statusDiv.style.display = "block";

    // 错误消息不自动消失，方便排查
    if (type !== "error") {
        setTimeout(() => {
            statusDiv.style.display = "none";
        }, 3000);
    }
}

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
        throw new Error(`ABI 加载失败 (HTTP ${response.status})`);
    }

    const abi = await response.json();
    contract = new web3.eth.Contract(abi, contractAddress);

    // 验证合约是否存在
    try {
        const code = await web3.eth.getCode(contractAddress);
        if (code === "0x" || code === "0x0") {
            throw new Error(`合约未部署到地址 ${contractAddress}，请重新运行部署脚本`);
        }
    } catch (e) {
        if (e.message.includes("合约未部署")) throw e;
        // getCode 本身失败也意味着合约不存在
        throw new Error(`无法在 ${contractAddress} 找到合约，请确认 Ganache 已启动且合约已部署`);
    }

    const name = await contract.methods.name().call();
    const symbol = await contract.methods.symbol().call();
    const decimals = await contract.methods.decimals().call();

    document.getElementById("tokenInfo").innerText =
        `代币: ${name} (${symbol}), 小数位: ${decimals}`;
}

// ========== 连接钱包 ==========
async function connectWallet() {
    try {
        if (!window.ethereum) {
            showStatus("请先安装 MetaMask 插件！", "error");
            return;
        }

        showStatus("正在连接钱包...", "pending");

        web3 = new Web3(window.ethereum);

        await window.ethereum.request({ method: "eth_requestAccounts" });
        await checkNetwork();

        const accounts = await web3.eth.getAccounts();
        currentAccount = accounts[0];

        document.getElementById("account").innerText =
            `账户: ${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;

        showStatus("正在加载合约...", "pending");
        await loadContract();

        showStatus("正在获取管理员信息...", "pending");
        await updateAdminInfo();

        showStatus("正在加载商家白名单...", "pending");
        await loadMerchantList();

        showStatus("钱包连接成功", "success");
    } catch (error) {
        console.error("连接失败:", error);
        showStatus("连接失败: " + (error.message || "未知错误"), "error");
    }
}

// ========== 更新管理员信息 ==========
async function updateAdminInfo() {
    try {
        if (!contract || !currentAccount) return;

        const owner = await contract.methods.owner().call();
        const isAdmin = owner.toLowerCase() === currentAccount.toLowerCase();

        const ethBalanceWei = await web3.eth.getBalance(currentAccount);
        const ethBalance = web3.utils.fromWei(ethBalanceWei, "ether");

        document.getElementById("ownerInfo").innerText =
            `Owner: ${owner}`;

        document.getElementById("adminStatus").innerText =
            isAdmin ? "管理员状态: 是管理员，可以添加/移除商家" : "管理员状态: 不是管理员，只能查询";

        document.getElementById("ethBalance").innerText =
            `ETH 余额: ${parseFloat(ethBalance).toFixed(4)} ETH`;
    } catch (error) {
        console.error("更新管理员信息失败:", error);
        showStatus("更新管理员信息失败: " + error.message, "error");
    }
}

// ========== 添加商家 ==========
async function addMerchant() {
    try {
        if (!contract || !currentAccount) {
            showStatus("请先连接钱包", "error");
            return;
        }

        const merchant = document.getElementById("addMerchantAddress").value.trim();

        if (!merchant) {
            showStatus("请输入商家地址", "error");
            return;
        }

        if (!web3.utils.isAddress(merchant)) {
            showStatus("商家地址格式错误", "error");
            return;
        }

        showStatus("添加商家处理中...", "pending");

        await contract.methods.addMerchant(merchant).send({
            from: currentAccount
        });

        document.getElementById("addMerchantAddress").value = "";

        await loadMerchantList();

        showStatus("商家添加成功", "success");
    } catch (error) {
        console.error("添加商家失败:", error);
        showStatus("添加商家失败: " + (error.message || "未知错误"), "error");
    }
}

// ========== 移除商家 ==========
async function removeMerchant() {
    try {
        if (!contract || !currentAccount) {
            showStatus("请先连接钱包", "error");
            return;
        }

        const merchant = document.getElementById("removeMerchantAddress").value.trim();

        if (!merchant) {
            showStatus("请输入商家地址", "error");
            return;
        }

        if (!web3.utils.isAddress(merchant)) {
            showStatus("商家地址格式错误", "error");
            return;
        }

        showStatus("移除商家处理中...", "pending");

        await contract.methods.removeMerchant(merchant).send({
            from: currentAccount
        });

        document.getElementById("removeMerchantAddress").value = "";

        await loadMerchantList();

        showStatus("商家移除成功", "success");
    } catch (error) {
        console.error("移除商家失败:", error);
        showStatus("移除商家失败: " + (error.message || "未知错误"), "error");
    }
}

// ========== 查询指定地址是否为商家 ==========
async function checkMerchant() {
    try {
        if (!contract) {
            showStatus("请先连接钱包", "error");
            return;
        }

        const address = document.getElementById("checkMerchantAddress").value.trim();

        if (!address) {
            showStatus("请输入查询地址", "error");
            return;
        }

        if (!web3.utils.isAddress(address)) {
            showStatus("查询地址格式错误", "error");
            return;
        }

        const isMerchant = await contract.methods.merchants(address).call();

        document.getElementById("checkMerchantResult").innerText =
            isMerchant ? "查询结果: 是商家" : "查询结果: 不是商家";
    } catch (error) {
        console.error("查询商家状态失败:", error);
        showStatus("查询失败: " + error.message, "error");
    }
}

// ========== 加载当前商家白名单 ==========
// 按时间顺序重放 Add/Remove 事件，保证最终状态正确
async function loadMerchantList() {
    try {
        if (!contract) return;

        const addedEvents = await contract.getPastEvents("MerchantAdded", {
            fromBlock: 0,
            toBlock: "latest"
        });

        const removedEvents = await contract.getPastEvents("MerchantRemoved", {
            fromBlock: 0,
            toBlock: "latest"
        });

        // 合并并按区块号+交易索引排序，确保按时间顺序重放
        const allEvents = [
            ...addedEvents.map(e => ({ ...e, _type: "add" })),
            ...removedEvents.map(e => ({ ...e, _type: "remove" }))
        ].sort((a, b) => {
            if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
            return a.transactionIndex - b.transactionIndex;
        });

        const merchantMap = new Map();

        for (const event of allEvents) {
            const merchant = event.returnValues.merchant;
            if (event._type === "add") {
                merchantMap.set(merchant.toLowerCase(), merchant);
            } else {
                merchantMap.delete(merchant.toLowerCase());
            }
        }

        const listDiv = document.getElementById("merchantList");

        if (merchantMap.size === 0) {
            listDiv.innerHTML = "暂无商家";
            return;
        }

        let html = "<ul>";

        for (const merchant of merchantMap.values()) {
            html += `<li style="word-break: break-all; margin: 8px 0;">${merchant}</li>`;
        }

        html += "</ul>";

        listDiv.innerHTML = html;
    } catch (error) {
        console.error("加载商家白名单失败:", error);
        showStatus("加载商家白名单失败: " + error.message, "error");
    }
}

// ========== 事件绑定 ==========
document.getElementById("connectBtn").addEventListener("click", connectWallet);
document.getElementById("refreshBtn").addEventListener("click", loadMerchantList);
document.getElementById("addMerchantBtn").addEventListener("click", addMerchant);
document.getElementById("removeMerchantBtn").addEventListener("click", removeMerchant);
document.getElementById("checkMerchantBtn").addEventListener("click", checkMerchant);

if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
}
