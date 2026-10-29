// Cloudflare Worker（star-proxy）：前端走 GitHub Pages，云端 API 反代 WorkBuddy Cloud
//
// 架构：
//   访客 → star.uichain.org（本 Worker）→ 前端静态资源来自 GitHub Pages(leo-bone.github.io/star-and-sky)
//                                       → 云端 API(/.cloud/...) 反代到 WorkBuddy，注入部署网关令牌
//
// 关键修复：WorkBuddy 部署网关会拦截微信内置浏览器 UA（MicroMessenger），导致微信里打不开。
//   这里把 UA 里的 MicroMessenger 抹掉，让源站当普通浏览器处理（已验证：去掉后即返回 200）。
//   同时补 CORS，保证前端即使直接跑在 github.io 也能跨域调用云端。
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const ORIGIN  = "star-and-sky.app.workbuddy.host"; // WorkBuddy 云端（API + 部署网关）
const GATEWAY = "O6SHDCEYS2";                      // 部署网关访问令牌（缺它源站 403）
const PAGES   = "https://leo-bone.github.io/star-and-sky"; // GitHub Pages 静态前端

async function handleRequest(request) {
  const src = new URL(request.url);

  // —— 云端数据/认证 API：反代到 WorkBuddy，注入网关令牌 + 抹掉微信 UA + 补 CORS ——
  if (src.pathname.startsWith("/.cloud/")) {
    const target = new URL(src);
    target.hostname = ORIGIN;
    if (!target.searchParams.has('sharecode')) target.searchParams.set('sharecode', GATEWAY);

    const headers = new Headers(request.headers);
    headers.set("Host", ORIGIN);
    const ua = headers.get("User-Agent") || "";
    if (/MicroMessenger/i.test(ua)) {
      const cleaned = ua.replace(/MicroMessenger[^\s;)]*/gi, '').replace(/\s{2,}/g, ' ').trim();
      headers.set("User-Agent", cleaned || "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile");
    }

    const resp = await fetch(new Request(target, {
      method: request.method, headers, body: request.body, redirect: "manual"
    }));

    const outHeaders = new Headers(resp.headers);
    outHeaders.set("Access-Control-Allow-Origin", "*");

    // 源站 3xx 且 Location 指向真实源站时，替回我们的域名，避免暴露 origin
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("Location");
      if (loc && loc.includes(ORIGIN)) {
        const u = new URL(loc); u.hostname = src.hostname;
        outHeaders.set("Location", u.toString());
        return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: outHeaders });
      }
    }
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: outHeaders });
  }

  // —— 其余（前端静态资源）：从 GitHub Pages 取 ——
  // 静态资源已自带 ?v= 版本号（每次部署变更），这里再补 no-cache，
  // 让浏览器/边缘每次重新校验，避免“部署了却看不到更新”。
  const target = PAGES + src.pathname + src.search;
  const resp = await fetch(target, {
    method: request.method, headers: request.headers, redirect: "follow"
  });
  const outH = new Headers(resp.headers);
  outH.set("Cache-Control", "no-cache");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: outH });
}
