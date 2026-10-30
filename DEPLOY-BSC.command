#!/bin/bash
# Star & Sky — BSC 合约一键部署（双击运行，或在终端 bash DEPLOY-BSC.command）
# 安全设计：私钥仅在运行时临时输入并存入内存环境变量，不写入任何文件、不落盘。
cd "$(dirname "$0")" || exit 1
echo "== BSC 合约部署 =="

# 确保存在 .env（供 hardhat 读取 RPC 等；不含私钥也不影响，私钥走下方内存变量）
if [ ! -f .env ]; then
  cp .env.example .env
fi

# 直接在这里让你粘贴私钥（输入时不显示），仅存入本次会话的内存环境变量，不写磁盘
echo "请输入【专用部署钱包】私钥（0x 开头的 64 位十六进制，粘贴后回车；输入时屏幕不显示，且不会被保存到任何文件）："
read -s PK
echo ""
if [ -z "$PK" ]; then
  echo "未输入私钥，已退出。需要时重新双击本脚本。"
  exit 1
fi
export PRIVATE_KEY="$PK"
echo "✅ 私钥已载入内存，开始部署（部署完关闭终端即清除）"

# 部署（scripts/deploy.sh 内部会：干净安装依赖 → 编译验证 → 部署 → 回填地址到 js/mint.js → 本地提交）
# 注意：请用【仅含少量 BNB 的专用钱包】，不要用存大资产的钱包。
bash scripts/deploy.sh

# 部署成功后自动推送（合约地址回填随之上线；后台备用，不影响前台 Solana 单链）
if [ -d .git ]; then
  echo "== 推送合约地址回填到线上 =="
  git push origin main || echo "推送失败，请手动执行：git push origin main"
fi

echo ""
echo "== 完成！约 1-3 分钟后 star.uichain.org 后端即具备 BSC 铸造能力（前台仍仅显示 Solana，无 BSC/BNB 字样） =="
echo "按任意键关闭窗口..."
read -n 1
