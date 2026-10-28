// Cloudflare Worker：反代 WorkBuddy Cloud 部署网关
// 关键修复：WorkBuddy 部署网关会拦截微信内置浏览器 UA（MicroMessenger），导致微信里打不开。
// 这里把 UA 里的 MicroMessenger 抹掉，让源站当普通浏览器处理（已验证：去掉后即返回 200）。
// 同时补 CORS，为将来“前端迁 GitHub Pages、API 仍走本 Worker 反代”做准备。
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const ORIGIN = "star-and-sky.app.workbuddy.host";
  // 部署网关访问令牌：缺它源站直接返回 403，必须随每个请求带上
  const GATEWAY = "O6SHDCEYS2";

  const src = new URL(request.url);
  const target = new URL(src);
  target.hostname = ORIGIN;

  // 注入部署网关访问令牌（服务器侧注入，访客浏览器地址栏仍保持干净的 star.uichain.org）
  if (!target.searchParams.has('sharecode')) {
    target.searchParams.set('sharecode', GATEWAY);
  }

  const headers = new Headers(request.headers);
  headers.set("Host", ORIGIN);

  // 修复微信打不开：去掉 UA 中的 MicroMessenger 标记
  const ua = headers.get("User-Agent") || "";
  if (/MicroMessenger/i.test(ua)) {
    const cleaned = ua.replace(/MicroMessenger[^\s;)]*/gi, '').replace(/\s{2,}/g, ' ').trim();
    headers.set("User-Agent", cleaned || "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile");
  }

  const init = {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: "manual"
  };

  const resp = await fetch(new Request(target, init));

  // 跨域：为将来 GitHub Pages 托管前端做准备（当前同源无影响）
  const outHeaders = new Headers(resp.headers);
  outHeaders.set("Access-Control-Allow-Origin", "*");

  // 若源站返回 3xx 且 Location 指向真实源站，替回我们的域名，避免暴露 origin
  if (resp.status >= 300 && resp.status < 400) {
    const loc = resp.headers.get("Location");
    if (loc && loc.includes(ORIGIN)) {
      const u = new URL(loc);
      u.hostname = src.hostname;
      outHeaders.set("Location", u.toString());
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: outHeaders
      });
    }
  }
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders
  });
}
