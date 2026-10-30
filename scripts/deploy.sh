#!/usr/bin/env bash
#
# Star & Sky — BSC 一键部署脚本
# 自动完成：.env 校验 → npm install → 部署合约 → 回填合约地址到前端 → 版本号自增 → 本地提交
# 用法：
#   bash scripts/deploy.sh            # 部署到主网 (bscMainnet)
#   bash scripts/deploy.sh testnet    # 部署到测试网 (bscTestnet)
# 注意：脚本只做本地 commit，push 需你手动执行（见末尾提示）。
#
set -euo pipefail

# 回到项目根目录（本脚本位于 scripts/）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NETWORK="${1:-bscMainnet}"
[ "$NETWORK" = "testnet" ] && NETWORK="bscTestnet"

echo "🌐 目标网络: $NETWORK"

# 1) .env 检查
if [ ! -f .env ]; then
  echo "⚠️  未找到 .env，已从 .env.example 复制，请填入 PRIVATE_KEY 后重跑。"
  cp .env.example .env
  exit 1
fi
if grep -q "YOUR_DEPLOYER_PRIVATE_KEY_HERE" .env; then
  echo "❌ .env 中 PRIVATE_KEY 仍为占位符，请先填入真实私钥（部署钱包需含 BNB 付 gas）。"
  exit 1
fi

# 2) 依赖检查
if [ ! -d node_modules ]; then
  echo "📦 首次安装依赖（可能耗时 1-2 分钟）..."
  npm install
fi

# 3) 部署
echo "🚀 部署 StarSkyBSC 到 $NETWORK ..."
npx hardhat run scripts/deploy-bsc.js --network "$NETWORK"

# 4) 自动回填合约地址 + 版本号自增 + 提交
if [ -f .bsc-contract-address ]; then
  ADDR="$(tr -d '[:space:]' < .bsc-contract-address)"
  echo "🔧 回填合约地址到 js/mint.js: $ADDR"
  perl -0pi -e "s/(contract:\s*)''(\s*\/\/)/\$1'$ADDR'\$2/" js/mint.js

  # 版本号自增（覆盖 ?v= 与独立版本串，避免浏览器缓存旧 mint.js）
  OLDVER="$(grep -rhoE '\?v=[0-9]{8}' js index.html 2>/dev/null | grep -oE '[0-9]{8}' | sort -n | tail -1)"
  NEWVER="$((10#$OLDVER + 1))"
  echo "🔢 版本号 $OLDVER → $NEWVER"
  find . -maxdepth 2 -type f \( -name '*.js' -o -name '*.html' \) \
    -exec perl -pi -e "s/\?v=$OLDVER/?v=$NEWVER/g" {} +
  find . -maxdepth 2 -type f \( -name '*.js' -o -name '*.html' \) \
    -exec perl -pi -e "s/(?<![0-9])$OLDVER(?![0-9])/$NEWVER/g" {} +

  rm -f .bsc-contract-address
  git add js/mint.js
  git commit -m "BSC 合约地址回填 + 版本号 $NEWVER"
  echo ""
  echo "✅ 已本地提交。请手动执行以下命令推送到线上："
  echo "     git push origin main"
  echo "   约 1-3 分钟后 star.uichain.org 生效，届时即可在 BSC 链铸造。"
else
  echo "⚠️  未生成 .bsc-contract-address，部署可能失败，请检查上方 hardhat 输出。"
  exit 1
fi
