// ========== 全局变量 ==========
let web3;
let contract;
let currentAccount;

const contractAddress = "0x8D36e0A3f6a23fCc12E206D735e71Ebd461d010d";
const requiredChainId = "0x539"; // 1337

// ========== 显示状态信息 ==========
function showStatus(message, type) {
    const statusDiv = document.getElementById("status");
    statusDiv.innerText = message;
    statusDiv.className = type;
    statusDiv.style.display = "block";

    setTimeout(() => {
        statusDiv.style.display = "none";
    }, 3000);
}

// ========== 校验网络 ==========
async function checkNetwork() {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    if (chainId !== requiredChainId) {
        showStatus("请切换到 Ganache Local 网络，Chain ID 必须是 1337", "error");
        throw new Error("Wrong network");
    }
}

// ========== 加载合约 ==========
async function loadContract() {
    const response = await fetch("abi.json");
    const abi = await response.json();

    contract = new web3.eth.Contract(abi, contractAddress);

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

        web3 = new Web3(window.ethereum);

        await window.ethereum.request({ method: "eth_requestAccounts" });
        await checkNetwork();

        const accounts = await web3.eth.getAccounts();
        currentAccount = accounts[0];

        document.getElementById("account").innerText =
            `账户: ${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;

        await loadContract();
        await updateAdminInfo();
        await loadMerchantList();

        showStatus("钱包连接成功", "success");
    } catch (error) {
        console.error("连接失败:", error);
        showStatus("连接钱包失败: " + error.message, "error");
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
// 合约没有商家数组，所以通过 MerchantAdded / MerchantRemoved 事件还原当前白名单
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

        const merchantMap = new Map();

        for (const event of addedEvents) {
            const merchant = event.returnValues.merchant;
            merchantMap.set(merchant.toLowerCase(), merchant);
        }

        for (const event of removedEvents) {
            const merchant = event.returnValues.merchant;
            merchantMap.delete(merchant.toLowerCase());
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