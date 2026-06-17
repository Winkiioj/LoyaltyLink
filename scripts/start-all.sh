#!/usr/bin/env bash
# ============================================================
# LoyaltyLink — 启动脚本 (Bash / Git Bash)
# ============================================================
# 前提: Ganache GUI 已手动打开（端口 7545, Chain ID 1337）
#
# 只做三件事:
#   1. 检查 Ganache → 检查合约 → 如需则编译+部署
#   2. 检查数据 → 如需则初始化
#   3. 启动前端服务器
#
# 幂等: 再次运行跳过部署和初始化，只启动前端
# ============================================================

set -e

GANACHE_PORT="${1:-7545}"
FRONTEND_PORT="${2:-3000}"
GANACHE_RPC="http://127.0.0.1:${GANACHE_PORT}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; GRAY='\033[0;90m'; NC='\033[0m'

trap 'echo ""; echo -e "${GRAY}Bye${NC}"; exit 0' INT TERM

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  LoyaltyLink${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ============================================================
# Step 0: Verify Ganache GUI is running
# ============================================================
echo -e "${YELLOW}[0] Check Ganache...${NC}"

if ! curl -s -X POST "$GANACHE_RPC" -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1; then
    echo -e "${RED}  Ganache not found at ${GANACHE_RPC}${NC}"
    echo ""
    echo "  Please manually open Ganache GUI:"
    echo "    - Port:    7545"
    echo "    - Chain ID: 1337"
    echo -n "    - Mnemonic: "
    echo "maid notable twist mutual dune speed come dolphin wet gaze scout sort"
    echo "    - Enable: Save workspace / persist chain data"
    echo ""
    exit 1
fi
echo -e "${GREEN}  Ganache running${NC}"
echo ""

# ============================================================
# Step 1: Compile + deploy (if needed)
# ============================================================
echo -e "${YELLOW}[1] Check contract...${NC}"

NEED_DEPLOY=false
NEED_INIT=false

if node scripts/health-check.js --deployed 2>/dev/null; then
    CONTRACT_ADDR=$(node scripts/health-check.js --contract 2>/dev/null)
    echo -e "${GREEN}  Deployed: ${CONTRACT_ADDR}${NC}"
else
    echo -e "${YELLOW}  Not deployed${NC}"
    NEED_DEPLOY=true
fi

if node scripts/health-check.js --data 2>/dev/null; then
    echo -e "${GREEN}  Data ready${NC}"
else
    echo -e "${YELLOW}  Data incomplete${NC}"
    NEED_INIT=true
fi
echo ""

if $NEED_DEPLOY; then
    echo -e "${YELLOW}  Compiling...${NC}"
    npx hardhat compile
    echo ""
    echo -e "${YELLOW}  Deploying...${NC}"
    npx hardhat run scripts/deploy-direct.js --network ganache
    echo ""
    NEED_INIT=true
fi

# ============================================================
# Step 2: Init data (if needed)
# ============================================================
if $NEED_INIT; then
    echo -e "${YELLOW}[2] Init data...${NC}"
    node scripts/init-demo-data.js || echo -e "${YELLOW}  (retry: npm run init)${NC}"
    echo ""
else
    echo -e "${YELLOW}[2] Data OK (skip)${NC}"
    echo ""
fi

# ============================================================
# Step 3: Start frontend
# ============================================================
echo -e "${YELLOW}[3] Start frontend...${NC}"

# Release port if occupied
FRONT_PID=$(netstat -ano 2>/dev/null | grep ":${FRONTEND_PORT} " | grep LISTENING | awk '{print $NF}' | head -1)
if [ -n "$FRONT_PID" ]; then
    cmd //c "taskkill /F /PID $FRONT_PID" 2>/dev/null || true
    sleep 1
fi

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  http://localhost:${FRONTEND_PORT}${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo "  Account 0 = Admin     Account 2 = User A (5000 LYL)"
echo "  Account 1 = Merchant  Account 4 = User B (2000 LYL)"
echo ""
echo -e "${GRAY}  Ctrl+C to stop${NC}"
echo ""

npx http-server frontend/ -p "$FRONTEND_PORT" -c-1
