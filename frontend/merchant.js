// ========== 全局变量 ==========
let web3;
let contract;
const contractAddress = "0x2645b2fEf0e4f9c4edb462eB0637ceC1bD8f0035";

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
        
        await loadContract();
        await updateBalance();
    } catch (error) {
        console.error('连接失败:', error);
        showStatus('连接钱包失败: ' + error.message, 'error');
    }
}

// ========== 加载合约 ==========
async function loadContract() {
    try {
        const response = await fetch('./abi.json');
        const abi = await response.json();
        contract = new web3.eth.Contract(abi, contractAddress);
    } catch (error) {
        console.warn('ABI 未加载，等待成员3提供 abi.json');
    }
}

// ========== 更新余额 ==========
async function updateBalance() {
    try {
        if (!contract) return;
        const accounts = await web3.eth.getAccounts();
        const balance = await contract.methods.balanceOf(accounts[0]).call();
        document.getElementById('balance').innerText = `余额: ${balance} LYL`;
    } catch (error) {
        console.error('查询余额失败:', error);
    }
}

// ========== 发放积分（reward） ==========
async function reward() {
    try {
        const to = document.getElementById('rewardAddress').value.trim();
        const amount = document.getElementById('rewardAmount').value.trim();
        
        if (!to || !amount) {
            showStatus('请填写完整信息', 'error');
            return;
        }
        
        showStatus('发放积分中...', 'pending');
        const accounts = await web3.eth.getAccounts();
        await contract.methods.reward(to, amount).send({ from: accounts[0] });
        await updateBalance();
        showStatus(`成功向 ${to.substring(0, 6)}... 发放 ${amount} LYL`, 'success');
        
        document.getElementById('rewardAddress').value = '';
        document.getElementById('rewardAmount').value = '';
    } catch (error) {
        console.error('发放失败:', error);
        showStatus('发放失败: ' + error.message, 'error');
    }
}

// ========== 扣除积分（spend） ==========
async function spend() {
    try {
        const from = document.getElementById('spendAddress').value.trim();
        const amount = document.getElementById('spendAmount').value.trim();
        
        if (!from || !amount) {
            showStatus('请填写完整信息', 'error');
            return;
        }
        
        showStatus('扣除积分中...', 'pending');
        const accounts = await web3.eth.getAccounts();
        await contract.methods.spend(from, amount).send({ from: accounts[0] });
        await updateBalance();
        showStatus(`成功从 ${from.substring(0, 6)}... 扣除 ${amount} LYL`, 'success');
        
        document.getElementById('spendAddress').value = '';
        document.getElementById('spendAmount').value = '';
    } catch (error) {
        console.error('扣除失败:', error);
        showStatus('扣除失败: ' + error.message, 'error');
    }
}

// ========== 事件绑定 ==========
document.getElementById('connectBtn').addEventListener('click', connectWallet);
document.getElementById('rewardBtn').addEventListener('click', reward);
document.getElementById('spendBtn').addEventListener('click', spend);