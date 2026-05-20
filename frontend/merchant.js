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
        document.getElementById('merchantAddress').innerText = accounts[0];

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

// ========== 发放 ETH（商家 → 用户） ==========
async function reward() {
    try {
        const to = document.getElementById('rewardAddress').value.trim();
        const amount = document.getElementById('rewardAmount').value.trim();

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
        showStatus(`成功向 ${to.substring(0, 6)}... 发放 ${amount} ETH`, 'success');

        document.getElementById('rewardAddress').value = '';
        document.getElementById('rewardAmount').value = '';
    } catch (error) {
        console.error('发放失败:', error);
        showStatus('发放失败: ' + error.message, 'error');
    }
}

// ========== 扣款（用户 → 商家） ==========
// 与智能合约扣积分不同，ETH 无法从他人钱包直接扣款。
// 此处生成扣款请求信息，用户需在用户端（index.html）连接钱包后向商家转账。
async function charge() {
    try {
        if (!web3) {
            showStatus('请先连接 MetaMask', 'error');
            return;
        }

        const userAddr = document.getElementById('chargeAddress').value.trim();
        const amount = document.getElementById('chargeAmount').value.trim();

        if (!userAddr || !amount) {
            showStatus('请填写完整信息', 'error');
            return;
        }

        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            showStatus('请先连接 MetaMask', 'error');
            return;
        }

        const merchantAddr = accounts[0];
        const chargeInfo = document.getElementById('chargeInfo');

        chargeInfo.innerHTML = '\n' +
            '            <p><strong>扣款请求已生成</strong></p>\n' +
            '            <p>用户地址: ' + userAddr + '</p>\n' +
            '            <p>商家地址: ' + merchantAddr + '</p>\n' +
            '            <p>金额: ' + amount + ' ETH</p>\n' +
            '            <p style="color:#856404;margin-top:8px;">请用户在 <strong>用户端 (index.html)</strong> 连接钱包后，向商家地址发送 ' + amount + ' ETH</p>\n' +
            '        ';
        chargeInfo.style.display = 'block';
        showStatus('已生成扣款请求', 'success');

        document.getElementById('chargeAddress').value = '';
        document.getElementById('chargeAmount').value = '';
    } catch (error) {
        console.error('扣款失败:', error);
        showStatus('扣款失败: ' + error.message, 'error');
    }
}

// ========== 事件绑定 ==========
document.getElementById('connectBtn').addEventListener('click', connectWallet);
document.getElementById('rewardBtn').addEventListener('click', reward);
document.getElementById('chargeBtn').addEventListener('click', charge);
