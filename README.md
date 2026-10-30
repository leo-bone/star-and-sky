# 星与星空 · STAR & SKY

一个纯前端的沉浸式星空互动站点。认领属于你的一颗星、在 3D 可旋转星球之间漫游、用真实星表仰望银河，并生成可分享的「星辰证书」。

A pure front-end, immersive stargazing experience. Claim your own star, roam among
realistically textured 3D planets, browse a real star catalog, and generate a shareable
"Certificate of Star" — all in the browser, no build step required.

> 在线体验 / Live demo: https://star.uichain.org/

## 功能特性 / Features

- **真 3D 可旋转星球** — Three.js 程序化生成的火星 / 木星 / 金星等级地表质感，支持鼠标拖拽旋转、缩放。
- **建国留言（云端保存）** — 认领星球、设计旗帜、撰写铭文，数据通过 WorkBuddy Cloud Service 持久化，名称去重。
- **Find Your Star** — 依据问答生成专属星辰，展示编号、距离、个性化寄语，并可一键分享（base64 载荷链接）。
- **真实星表** — 内置真实恒星数据（`data/stars.json`，约 5000 颗亮星，含 HIP/HD 编号、拜耳/佛兰斯蒂德命名、真实坐标）与星座连线（`data/constellations.lines.json`），世界星图墙支持云端共享。
- **星辰证书** — 球面重投影渲染证书，含坐标、参数表、签发签名与免责声明，支持下载与链接分享。
- **中英文切换** — 顶部 `EN / 中文` 按钮一键国际化，未翻译文案自动回退中文，保证界面不破。
- **零构建** — 原生 ES Modules + importmap 从 CDN 加载 Three.js，直接静态托管即可运行。
- **区块链铸造（NFT）** — 建国门禁的「王国凭证」可真实铸造上链：BSC（ERC-721）与 Solana（Metaplex Core），铸造后证书展示交易哈希与浏览器核验链接。详见下方「NFT 铸造」。

## 技术栈 / Tech

- 原生 ES Modules（无打包工具）
- [Three.js](https://threejs.org/) 0.160.0 + OrbitControls（importmap / CDN）
- [ethers.js](https://docs.ethers.org/) v6（BSC / EVM 链上铸造，动态 import）
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) + Metaplex Core UMI（Solana 铸造，动态 import）
- WorkBuddy Cloud Service（PostgreSQL + PostgREST 风格 SDK）实现云端星图墙与建国留言
- Canvas 程序化等距柱状贴图、SVG 旗帜渐变
- IPFS（Pinata）持久化 NFT 元数据与证书图片

## NFT 铸造 / On-chain Minting

建国门禁的「王国凭证（Kingdom Pass）」可真实铸造上链，目前支持两条链：

- **BSC（BNB Smart Chain）** — 标准 ERC-721 合约（`contracts/StarSkyBSC.sol`），用 ethers v6 调用。
  部署：`npx hardhat run scripts/deploy-bsc.js --network bscMainnet`（或先用 `bscTestnet` 试水）。
  铸造时用户支付极少量 BNB 作为 gas。
- **Solana** — 通过 Metaplex Core 程序铸造（无需自部署合约），用 `@solana/web3.js` + UMI。
  铸造时用户支付极少量 SOL。

铸造流程：在门禁选链（BNB Chain / Solana）→ 连接钱包 →（BSC 自动切到对应网络）→
上传证书图片与 metadata 到 IPFS（Pinata，未配 key 时自动回退 data-URI）→ 调用链上铸造 →
证书与门禁展示 `Minted on <链> · <地址>`、`tx <哈希>` 与区块链浏览器核验链接。

> 配置项集中在 `js/mint.js` 顶部的 `CONFIG`：各链的合约地址（BSC）、RPC、浏览器前缀、Pinata JWT。
> 把 BSC 主网合约地址填入 `CONFIG.chains.bsc.contract` 即可启用主网铸造。
> `contracts/`、`scripts/`、`hardhat.config.js`、`package.json` 仅为本地部署工具，不属于静态站点本身。

### 一键部署（推荐）

本地已提供 `scripts/deploy.sh` 与 `.env.example`，把部署步骤打包，降低手动出错：

```bash
cp .env.example .env          # 填入 PRIVATE_KEY（部署钱包需含 BNB 付 gas）
bash scripts/deploy.sh        # 主网；末尾加 testnet 参数走 BSC 测试网
```

脚本会自动：校验 `.env` → 安装依赖 → 部署合约 → 把地址回填到 `js/mint.js` →
版本号自增（强制浏览器刷新缓存的 mint.js）→ 本地 `git commit`。
**推送需你手动执行** `git push origin main`，约 1–3 分钟后 `star.uichain.org` 生效，即可在 BSC 链铸造。
Solana 无需部署合约（用官方 Metaplex Core 程序），只需在 `js/mint.js` 配好 Pinata 即可。

> 免责：本证书与 NFT 为私人纪念藏品，非国际天文学联合会（IAU）官方命名；星体坐标引自真实星表，但「认领」仅为纪念性质，不代表任何天体权属。

## 目录结构 / Structure

```
index.html            入口页面（含 i18n 标记）
css/style.css         全站样式
js/
  app.js              应用主控 / 路由 / 语言切换挂载
  i18n.js             中英文切换核心（t / setLang / applyI18n）
  quiz.js             问答生成专属星辰
  starData.js         星辰数据 / 光谱名 / 星系
  kingdom.js          建国 + 旗帜设计（含 XSS 白名单防御）
  certificate.js      星辰证书渲染与下载
  skymap.js           真实星空（3D 星图墙 · 找星）
  mint.js             区块链铸造（BSC ERC-721 / Solana Metaplex Core）
  cloud.js / share.js / universe.js / ...
  bodyTexture.js      程序化星球贴图
  planet3d.js         3D 星球渲染
data/
  stars.json                   真实恒星数据
  constellations.lines.json    星座连线
assets/                       背景与行星贴图
contracts/
  StarSkyBSC.sol              BSC 上发行的 ERC-721 合约（铸造王国凭证）
scripts/
  deploy-bsc.js               Hardhat 部署脚本（BSC 测试网/主网）
  deploy.sh                   一键部署（校验 .env → 装依赖 → 部署 → 回填地址 → 版本号自增 → 本地提交）
```

## 本地运行 / Run locally

由于使用 ES Modules，需通过 HTTP 提供服务（不能直接 `file://` 打开）：

```bash
# 任选其一
python3 -m http.server 8080
npx serve .
```

然后浏览器访问 `http://localhost:8080`。

## 部署 / Deploy

静态站点，可托管于任意静态空间（GitHub Pages / uichain.org / Nginx 等）。
当前线上地址：`https://star.uichain.org/`

## 许可 / License

MIT — 自由使用、修改与再分发。
