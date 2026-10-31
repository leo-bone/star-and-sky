#!/bin/bash
# Star & Sky — 一键提交并推送（双击运行，或在终端 bash PUSH.command）
# 说明：本脚本在你本机终端执行，不走 WorkBuddy 沙箱，可正常联网提交。
cd "$(dirname "$0")" || exit 1
echo "== 提交并推送 Star & Sky 改动 =="
# 清掉可能残留的 git 锁（正常无锁则无副作用）
rm -f .git/index.lock
# 暂存本次改动（.env / node_modules / generated-images 已被 .gitignore 忽略，不会入库）
git add index.html js/ DEPLOY-BSC.command PUSH.command package-lock.json
git commit -m "v20261049：星空页空闲停重绘(掉帧优化)+首页序章仅首播+证书装饰星座名本地化+nameTaken大小写归一" || echo "（无新改动或已提交，继续推送）"
git push origin main
echo ""
echo "== 完成！若上面没有红字报错，star.uichain.org 约 1-3 分钟后更新 =="
echo "建议到网站按 Cmd+Shift+R 强制刷新验证。"
echo "按任意键关闭窗口..."
read -n 1
