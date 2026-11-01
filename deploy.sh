#!/usr/bin/env bash
#
# deploy.sh — 一键上线 + 自动清 Cloudflare 缓存
#
# 解决的问题：之前“硬刷后整页坏掉”是 GitHub Pages 与 Cloudflare 的部署时间差——
# HTML 已更新、JS 还没到位，Cloudflare 把“新 HTML + 旧 JS”错配组合按新 URL 缓存住。
# 本脚本在推送后先轮询确认 GitHub Pages 已完全传播（新版本戳上线），
# 再清空 Cloudflare 缓存，确保各边缘节点只会回源到“已就绪”的新内容。
#
# 流程：
#   1) 自动把缓存戳 ?v=NNNN +1（强制浏览器拉新资源，顺带清掉旧错配）
#   2) git add + commit（bump 提交） + git push origin main
#   3) 轮询直到线上 app.js 已是新版本戳（最多 ~6 分钟）
#   4) 调 Cloudflare API 整站清缓存
#
# 前置：
#   - 当前在 main 分支、工作树可提交（无未跟踪/未提交的关键改动由脚本检查）
#   - Cloudflare API Token（仅需 Zone:Cache Purge 权限，绑定 star.uichain.org 这个 zone）
#     提供方式二选一：
#       a) 环境变量： export CF_API_TOKEN=xxxx
#       b) 本地文件： 新建 .cloudflare.env（已被 .gitignore 忽略，不会提交）写入 CF_API_TOKEN=xxxx
#
set -euo pipefail

DOMAIN="star.uichain.org"

# ---------- 读取 Cloudflare 凭证（两种方式二选一） ----------
#   方式 1（推荐，细粒度）：Bearer API Token
#     CF_API_TOKEN=xxxx
#   方式 2（Global API Key + 邮箱）：
#     CF_API_KEY=xxxx
#     CF_EMAIL=you@example.com
if [ -z "${CF_API_TOKEN:-}${CF_API_KEY:-}" ] && [ -f .cloudflare.env ]; then
  set -a; source .cloudflare.env; set +a
fi

AUTH=()
if [ -n "${CF_API_TOKEN:-}" ]; then
  AUTH=(-H "Authorization: Bearer ${CF_API_TOKEN}")
elif [ -n "${CF_API_KEY:-}" ] && [ -n "${CF_EMAIL:-}" ]; then
  AUTH=(-H "X-Auth-Email: ${CF_EMAIL}" -H "X-Auth-Key: ${CF_API_KEY}")
else
  echo "❌ 未找到 Cloudflare 凭证。请二选一：" >&2
  echo "     a) export CF_API_TOKEN=xxxx        （Bearer API Token）" >&2
  echo "     b) export CF_API_KEY=xxxx CF_EMAIL=you@example.com  （Global API Key + 邮箱）" >&2
  echo "    或写入 .cloudflare.env（已被 gitignore，不会提交）" >&2
  exit 1
fi

# ---------- 安全检查：必须在 main ----------
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "❌ 当前分支是 $BRANCH，请在 main 分支执行" >&2
  exit 1
fi

# ---------- 1) 自动 bump 缓存戳 ----------
OLD_V=$(grep -oE 'app\.js\?v=[0-9]+' index.html | grep -oE '[0-9]+' | head -1)
if [ -z "${OLD_V:-}" ]; then
  echo "❌ 无法从 index.html 解析当前版本戳" >&2
  exit 1
fi
NEW_V=$((OLD_V + 1))
echo "▶ 缓存戳 ${OLD_V} -> ${NEW_V}"
grep -rl "${OLD_V}" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.workbuddy \
  | xargs perl -pi -e "s/${OLD_V}/${NEW_V}/g"

# ---------- 提交 bump ----------
git add -A
git commit -m "deploy: bump cache version ${OLD_V} -> ${NEW_V}"

# ---------- 2) 推送 ----------
echo "▶ 推送 origin/main ..."
git push origin main

# ---------- 3) 等待 GitHub Pages 传播 ----------
echo "▶ 等待 GitHub Pages 传播版本 ${NEW_V}（最多 ~6 分钟）..."
OK=0
for i in $(seq 1 36); do
  LIVE=$(curl -s --max-time 15 "https://${DOMAIN}/js/app.js?v=${NEW_V}" \
          | grep -oE "2026[0-9]+" | sort -u | head -1)
  if [ "$LIVE" = "$NEW_V" ]; then
    echo "✅ 已传播 ($LIVE)"; OK=1; break
  fi
  sleep 10
done
if [ "$OK" -ne 1 ]; then
  echo "⚠️  超时仍未检测到新版本（可能只是检测慢），仍继续清缓存" >&2
fi

# ---------- 解析 Cloudflare Zone ID ----------
echo "▶ 解析 Cloudflare Zone ID (${DOMAIN}) ..."
ZONE_ID=$(curl -s --max-time 15 "${AUTH[@]}" \
  "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" \
  | grep -oE "\"id\":\"[A-Za-z0-9]+\",\"name\":\"${DOMAIN}\"" \
  | grep -oE '"id":"[A-Za-z0-9]+"' | sed 's/"id":"//;s/"//' | head -1)
if [ -z "${ZONE_ID:-}" ]; then
  echo "❌ 无法解析 Zone ID。请检查：token 是否有该域名的 Cache Purge 权限、域名拼写是否正确" >&2
  exit 1
fi

# ---------- 4) 清缓存 ----------
echo "▶ 清空 Cloudflare 缓存 (zone ${ZONE_ID}) ..."
RESP=$(curl -s --max-time 20 -X POST \
  "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache")
if echo "$RESP" | grep -q '"success":true'; then
  echo "✅ Cloudflare 缓存已清空，全网边缘将在下次请求回源拉取新内容"
else
  echo "❌ 清缓存失败：$RESP" >&2
  exit 1
fi

echo ""
echo "🎉 部署完成：${DOMAIN} 现已为版本 ${NEW_V}（缓存已清，无需用户硬刷）"
