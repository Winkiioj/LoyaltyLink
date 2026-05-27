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

    try {
        const code = await web3.eth.getCode(contractAddress);
        if (code === "0x" || code === "0x0") {
            throw new Error(`合约未部署到地址 ${contractAddress}，请重新运行部署脚本`);
        }
    } catch (e) {
        if (e.message.includes("合约未部署")) throw e;
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

        await updateMerchantInfo();

        showStatus("钱包连接成功", "success");
    } catch (error) {
        console.error("连接失败:", error);
        showStatus("连接钱包失败: " + error.message, "error");
    }
}

// ========== 更新商家信息 ==========
async function updateMerchantInfo() {
    try {
        if (!contract || !currentAccount) return;

        const symbol = await contract.methods.symbol().call();

        const isMerchant = await contract.methods.merchants(currentAccount).call();

        const tokenBalanceRaw = await contract.methods.balanceOf(currentAccount).call();
        const tokenBalance = web3.utils.fromWei(tokenBalanceRaw, "ether");

        const ethBalanceWei = await web3.eth.getBalance(currentAccount);
        const ethBalance = web3.utils.fromWei(ethBalanceWei, "ether");

        document.getElementById("merchantStatus").innerText =
            isMerchant ? "商家状态: 是商家，可以发放/扣除积分" : "商家状态: 不是商家，不能调用 reward/spend";

        document.getElementById("balance").innerText =
            `LYL 余额: ${tokenBalance} ${symbol}`;

        document.getElementById("ethBalance").innerText =
            `ETH 余额: ${parseFloat(ethBalance).toFixed(4)} ETH`;
    } catch (error) {
        console.error("更新商家信息失败:", error);
        showStatus("更新商家信息失败: " + error.message, "error");
    }
}

// ========== 发放 LYL ==========
async function reward() {
    try {
        if (!contract || !currentAccount) {
            showStatus("请先连接钱包", "error");
            return;
        }

        const user = document.getElementById("rewardAddress").value.trim();
        const amount = document.getElementById("rewardAmount").value.trim();

        if (!user || !amount) {
            showStatus("请填写完整信息", "error");
            return;
        }

        if (!web3.utils.isAddress(user)) {
            showStatus("用户地址格式错误", "error");
            return;
        }

        if (Number(amount) <= 0) {
            showStatus("发放数量必须大于 0", "error");
            return;
        }

        const amountRaw = web3.utils.toWei(amount, "ether");

        showStatus("积分发放处理中...", "pending");

        await contract.methods.reward(user, amountRaw).send({
            from: currentAccount
        });

        await updateMerchantInfo();

        showStatus("LYL 积分发放成功！", "success");

        document.getElementById("rewardAddress").value = "";
        document.getElementById("rewardAmount").value = "";
    } catch (error) {
        console.error("发放失败:", error);
        showStatus("发放失败: " + (error.message || "未知错误"), "error");
    }
}

// ========== 扣除 LYL ==========
async function spend() {
    try {
        if (!contract || !currentAccount) {
            showStatus("请先连接钱包", "error");
            return;
        }

        const user = document.getElementById("spendAddress").value.trim();
        const amount = document.getElementById("spendAmount").value.trim();

        if (!user || !amount) {
            showStatus("请填写完整信息", "error");
            return;
        }

        if (!web3.utils.isAddress(user)) {
            showStatus("用户地址格式错误", "error");
            return;
        }

        if (Number(amount) <= 0) {
            showStatus("扣除数量必须大于 0", "error");
            return;
        }

        const amountRaw = web3.utils.toWei(amount, "ether");

        showStatus("积分扣除处理中...", "pending");

        await contract.methods.spend(user, amountRaw).send({
            from: currentAccount
        });

        await updateMerchantInfo();

        showStatus("LYL 积分扣除成功！", "success");

        document.getElementById("spendAddress").value = "";
        document.getElementById("spendAmount").value = "";
    } catch (error) {
        console.error("扣除失败:", error);
        showStatus("扣除失败: " + (error.message || "未知错误"), "error");
    }
}

// ========== 查询任意地址余额 ==========
async function queryBalance() {
    try {
        if (!contract) {
            showStatus("请先连接钱包", "error");
            return;
        }

        const address = document.getElementById("queryAddress").value.trim();

        if (!address) {
            showStatus("请输入查询地址", "error");
            return;
        }

        if (!web3.utils.isAddress(address)) {
            showStatus("查询地址格式错误", "error");
            return;
        }

        const symbol = await contract.methods.symbol().call();
        const balanceRaw = await contract.methods.balanceOf(address).call();
        const balance = web3.utils.fromWei(balanceRaw, "ether");

        document.getElementById("queryResult").innerText =
            `查询结果: ${balance} ${symbol}`;
    } catch (error) {
        console.error("查询失败:", error);
        showStatus("查询失败: " + error.message, "error");
    }
}

// ========== 事件绑定 ==========
document.getElementById("connectBtn").addEventListener("click", connectWallet);
document.getElementById("rewardBtn").addEventListener("click", reward);
document.getElementById("spendBtn").addEventListener("click", spend);
document.getElementById("queryBtn").addEventListener("click", queryBalance);

if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
}