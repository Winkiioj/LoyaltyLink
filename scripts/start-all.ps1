# ============================================================
# LoyaltyLink - One-click startup script (PowerShell)
# ============================================================
# Starts: Ganache -> Compile -> Deploy -> Init demo data -> Frontend
# Prereqs: Node.js, npm install completed
# ============================================================

param(
    [int]$GanachePort = 7545,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

Set-Location $projectDir

$GanacheRPC = "http://127.0.0.1:${GanachePort}"
$Mnemonic = "maid notable twist mutual dune speed come dolphin wet gaze scout sort"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  LoyaltyLink One-Click Startup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 0. Pre-flight checks
# ============================================================
Write-Host "[0/5] Pre-flight checks..." -ForegroundColor Yellow

try {
    $null = Get-Command node -ErrorAction Stop
    Write-Host "  [OK] node: $(node --version)" -ForegroundColor Green
} catch {
    Write-Host "  [ERR] node not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

try {
    $null = Get-Command npm -ErrorAction Stop
    Write-Host "  [OK] npm: $(npm --version)" -ForegroundColor Green
} catch {
    Write-Host "  [ERR] npm not found." -ForegroundColor Red
    exit 1
}

$nodeModulesPath = Join-Path $projectDir "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "  [!] node_modules missing, running npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERR] npm install failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [OK] node_modules exists" -ForegroundColor Green
}

Write-Host ""

# ============================================================
# 1. Start Ganache
# ============================================================
Write-Host "[1/5] Start Ganache..." -ForegroundColor Yellow

function Test-GanacheRunning {
    try {
        $body = '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
        $response = Invoke-RestMethod -Uri $GanacheRPC -Method Post `
            -Body $body -ContentType "application/json" -TimeoutSec 2
        return $response.result -ne $null
    } catch {
        return $false
    }
}

if (Test-GanacheRunning) {
    Write-Host "  [OK] Ganache already running on port $GanachePort" -ForegroundColor Green
} else {
    Write-Host "  Ganache not running, starting..."

    $ganacheCmd = Join-Path $projectDir "node_modules\.bin\ganache.cmd"
    if (-not (Test-Path $ganacheCmd)) {
        Write-Host "  [ERR] ganache CLI not found. Run 'npm install' first." -ForegroundColor Red
        exit 1
    }

    Write-Host "  Launching: npx ganache --port $GanachePort --chain.chainId 1337"
    Write-Host "  (running in a new terminal window)"

    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "title Ganache-LoyaltyLink && npx ganache --port $GanachePort --chain.chainId 1337 --wallet.mnemonic `"$Mnemonic`"" -WindowStyle Normal

    Write-Host "  Waiting for Ganache to be ready..."
    $timeout = 30
    $elapsed = 0
    while (-not (Test-GanacheRunning) -and $elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
        if ($elapsed % 5 -eq 0) {
            Write-Host "    ... ${elapsed}s / ${timeout}s"
        }
    }

    if (Test-GanacheRunning) {
        Write-Host "  [OK] Ganache started successfully (${elapsed}s)" -ForegroundColor Green
    } else {
        Write-Host "  [ERR] Ganache startup timed out." -ForegroundColor Red
        Write-Host "  Manual start: npx ganache --port $GanachePort --chain.chainId 1337 --wallet.mnemonic `"$Mnemonic`""
        exit 1
    }
}

Write-Host ""

# ============================================================
# 2. Compile contracts
# ============================================================
Write-Host "[2/5] Compile contracts..." -ForegroundColor Yellow

$compileResult = npx hardhat compile 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERR] Compilation failed:" -ForegroundColor Red
    Write-Host $compileResult
    exit 1
}
Write-Host "  [OK] Compilation succeeded" -ForegroundColor Green
Write-Host ""

# ============================================================
# 3. Deploy contracts
# ============================================================
Write-Host "[3/5] Deploy to Ganache..." -ForegroundColor Yellow

$deployResult = npx hardhat run scripts/deploy-direct.js --network ganache 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERR] Deployment failed:" -ForegroundColor Red
    Write-Host $deployResult
    exit 1
}
Write-Host $deployResult
Write-Host "  [OK] Deployment done" -ForegroundColor Green
Write-Host ""

# ============================================================
# 4. Initialize demo data
# ============================================================
Write-Host "[4/5] Initialize demo data..." -ForegroundColor Yellow

$initResult = node scripts/init-demo-data.js 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [!] Init script returned non-zero:" -ForegroundColor Yellow
    Write-Host $initResult
    Write-Host "  (You can re-run: node scripts/init-demo-data.js)" -ForegroundColor Yellow
} else {
    Write-Host $initResult
    Write-Host "  [OK] Demo data ready" -ForegroundColor Green
}
Write-Host ""

# ============================================================
# 5. Start frontend server
# ============================================================
Write-Host "[5/5] Start frontend server..." -ForegroundColor Yellow
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Environment Ready!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:${FrontendPort}" -ForegroundColor Cyan
Write-Host "  Ganache  : ${GanacheRPC}" -ForegroundColor Cyan
Write-Host "  Chain ID : 1337" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Pages:" -ForegroundColor Cyan
Write-Host "    /index.html    - User home (balance, transfer)" -ForegroundColor Cyan
Write-Host "    /shop.html     - Points shop" -ForegroundColor Cyan
Write-Host "    /redeem.html   - Redeem rewards" -ForegroundColor Cyan
Write-Host "    /merchant.html - Merchant backend" -ForegroundColor Cyan
Write-Host "    /history.html  - Transaction history" -ForegroundColor Cyan
Write-Host "    /admin.html    - Admin panel" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "MetaMask accounts (import private keys from Ganache to use):" -ForegroundColor Yellow
Write-Host "  Account 0 = Admin (Owner)" -ForegroundColor Yellow
Write-Host "  Account 1 = Merchant (whitelisted)" -ForegroundColor Yellow
Write-Host "  Account 2 = User A (initial 5000 LYL)" -ForegroundColor Yellow
Write-Host "  Account 4 = User B (initial 2000 LYL)" -ForegroundColor Yellow
Write-Host ""

Write-Host "Press Ctrl+C to stop the frontend server" -ForegroundColor DarkGray
Write-Host "Close the Ganache terminal window to stop the blockchain" -ForegroundColor DarkGray
Write-Host ""

npx http-server frontend/ -p $FrontendPort -c-1
