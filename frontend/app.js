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

        await updateBalance();

        showStatus("钱包连接成功", "success");
    } catch (error) {
        console.error("连接失败:", error);
        showStatus("连接钱包失败: " + error.message, "error");
    }
}

// ========== 更新 LYL 和 ETH 余额 ==========
async function updateBalance() {
    try {
        if (!contract || !currentAccount) return;

        const symbol = await contract.methods.symbol().call();

        const tokenBalanceRaw = await contract.methods.balanceOf(currentAccount).call();
        const tokenBalance = web3.utils.fromWei(tokenBalanceRaw, "ether");

        const ethBalanceWei = await web3.eth.getBalance(currentAccount);
        const ethBalance = web3.utils.fromWei(ethBalanceWei, "ether");

        document.getElementById("balance").innerText =
            `LYL 余额: ${tokenBalance} ${symbol}`;

        document.getElementById("ethBalance").innerText =
            `ETH 余额: ${parseFloat(ethBalance).toFixed(4)} ETH`;
    } catch (error) {
        console.error("查询余额失败:", error);
        showStatus("查询余额失败: " + error.message, "error");
    }
}

// ========== 转账 LYL ==========
async function transfer() {
    try {
        if (!contract || !currentAccount) {
            showStatus("请先连接钱包", "error");
            return;
        }

        const to = document.getElementById("toAddress").value.trim();
        const amount = document.getElementById("transferAmount").value.trim();

        if (!to || !amount) {
            showStatus("请填写完整信息", "error");
            return;
        }

        if (!web3.utils.isAddress(to)) {
            showStatus("接收地址格式错误", "error");
            return;
        }

        if (Number(amount) <= 0) {
            showStatus("转账数量必须大于 0", "error");
            return;
        }

        const amountRaw = web3.utils.toWei(amount, "ether");

        showStatus("LYL 转账处理中...", "pending");

        await contract.methods.transfer(to, amountRaw).send({
            from: currentAccount
        });

        await updateBalance();

        showStatus("LYL 转账成功！", "success");

        document.getElementById("toAddress").value = "";
        document.getElementById("transferAmount").value = "";
    } catch (error) {
        console.error("转账失败:", error);
        showStatus("转账失败: " + (error.message || "未知错误"), "error");
    }
}

// ========== 事件绑定 ==========
document.getElementById("connectBtn").addEventListener("click", connectWallet);
document.getElementById("transferBtn").addEventListener("click", transfer);

if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
}