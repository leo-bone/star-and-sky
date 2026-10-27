# 星与星空 · STAR & SKY

一个纯前端的沉浸式星空互动站点。认领属于你的一颗星、在 3D 可旋转星球之间漫游、用真实星表仰望银河，并生成可分享的「星辰证书」。

A pure front-end, immersive stargazing experience. Claim your own star, roam among
realistically textured 3D planets, browse a real star catalog, and generate a shareable
"Certificate of Star" — all in the browser, no build step required.

> 在线体验 / Live demo: https://star-and-sky.app.workbuddy.host/?sharecode=O6SHDCEYS2

## 功能特性 / Features

- **真 3D 可旋转星球** — Three.js 程序化生成的火星 / 木星 / 金星等级地表质感，支持鼠标拖拽旋转、缩放。
- **建国留言（云端保存）** — 认领星球、设计旗帜、撰写铭文，数据通过 WorkBuddy Cloud Service 持久化，名称去重。
- **Find Your Star** — 依据问答生成专属星辰，展示编号、距离、个性化寄语，并可一键分享（base64 载荷链接）。
- **真实星表** — 内置 656 KB 真实恒星数据（`data/stars.json`）与星座连线（`data/constellations.lines.json`），世界星图墙支持云端共享。
- **星辰证书** — 球面重投影渲染证书，含坐标、参数表、议会铭文，支持下载与链接分享。
- **中英文切换** — 顶部 `EN / 中文` 按钮一键国际化，未翻译文案自动回退中文，保证界面不破。
- **零构建** — 原生 ES Modules + importmap 从 CDN 加载 Three.js，直接静态托管即可运行。

## 技术栈 / Tech

- 原生 ES Modules（无打包工具）
- [Three.js](https://threejs.org/) 0.160.0 + OrbitControls（importmap / CDN）
- WorkBuddy Cloud Service（PostgreSQL + PostgREST 风格 SDK）实现云端星图墙与建国留言
- Canvas 程序化等距柱状贴图、SVG 旗帜渐变

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
  card.js             星辰证书渲染与下载
  skymap.js           世界星图墙（3D 星点）
  cloud.js / share.js / universe.js / ...
  bodyTexture.js      程序化星球贴图
  planet3d.js         3D 星球渲染
data/
  stars.json                   真实恒星数据
  constellations.lines.json    星座连线
assets/                       背景与行星贴图
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
当前线上地址：`https://star-and-sky.app.workbuddy.host/?sharecode=O6SHDCEYS2`

## 许可 / License

MIT — 自由使用、修改与再分发。
