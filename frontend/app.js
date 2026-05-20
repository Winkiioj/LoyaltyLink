// ========== 全局变量 ==========
let web3;

// ========== 显示状态信息 ==========
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerText = message;
    statusDiv.className = type;
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// ========== 连接钱包 ==========
async function connectWallet() {
    try {
        if (!window.ethereum) {
            showStatus('请先安装 MetaMask 插件！', 'error');
            return;
        }
        web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        const accounts = await web3.eth.getAccounts();
        document.getElementById('account').innerText =
            `账户: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`;

        await updateBalance();
    } catch (error) {
        console.error('连接失败:', error);
        showStatus('连接钱包失败: ' + error.message, 'error');
    }
}

// ========== 更新 ETH 余额 ==========
async function updateBalance() {
    try {
        const accounts = await web3.eth.getAccounts();
        const balanceWei = await web3.eth.getBalance(accounts[0]);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
        document.getElementById('balance').innerText = `余额: ${parseFloat(balanceEth).toFixed(4)} ETH`;
    } catch (error) {
        console.error('查询余额失败:', error);
    }
}

// ========== 转账 ETH ==========
async function transfer() {
    try {
        const to = document.getElementById('toAddress').value.trim();
        const amount = document.getElementById('transferAmount').value.trim();

        if (!to || !amount) {
            showStatus('请填写完整信息', 'error');
            return;
        }

        showStatus('交易处理中...', 'pending');
        const accounts = await web3.eth.getAccounts();
        await web3.eth.sendTransaction({
            from: accounts[0],
            to: to,
            value: web3.utils.toWei(amount, 'ether')
        });
        await updateBalance();
        showStatus('转账成功！', 'success');

        document.getElementById('toAddress').value = '';
        document.getElementById('transferAmount').value = '';
    } catch (error) {
        console.error('转账失败:', error);
        showStatus('转账失败: ' + error.message, 'error');
    }
}

// ========== 事件绑定 ==========
document.getElementById('connectBtn').addEventListener('click', connectWallet);
document.getElementById('transferBtn').addEventListener('click', transfer);
