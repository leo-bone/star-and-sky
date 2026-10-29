// 认领星球的"表面"生成器 —— 3D 视口与认证书共用同一套程序化贴图。
//
// 设计目标（对齐真实天体质感）：
//   1. 每颗星按注册号确定性派生 → 外观 / 配色 / 光晕各不相同，且同星永远一致
//   2. 表面具备真实浮雕（法线贴图）→ 旋转时能看出凹凸与球面体积，而非平面贴纸
//   3. 五种表面原型：星表米粒(granular) / 金星云幔(cloudy) / 木星条带(banded)
//      / 火星岩质(rocky) / 冰壳世界(icy)，各自有专属色板与地貌特征
//   4. 输出等距柱状(equirectangular)彩色图 + 法线图，3D 可直接作球面 UV

import { hashString, mulberry32 } from './rng.js?v=20261041';

const TAU = Math.PI * 2;
const FLAVORS = ['granular', 'cloudy', 'banded', 'rocky', 'icy'];

// ---------------- 颜色工具 ----------------
function hexToRgb(hex){
  const h = String(hex || '#ffffff').replace('#','');
  const s = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const n = parseInt(s, 16) || 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r, g, b){
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const l = (max+min)/2;
  let h = 0, s = 0;
  if (max !== min){
    const d = max-min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    if (max === r) h = ((g-b)/d + (g<b?6:0));
    else if (max === g) h = ((b-r)/d + 2);
    else h = ((r-g)/d + 4);
    h/=6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l){
  h = ((h % 1) + 1) % 1;
  if (s === 0){ const v = Math.round(l*255); return [v,v,v]; }
  const q = l < 0.5 ? l*(1+s) : l+s-l*s;
  const p = 2*l - q;
  const f = t => {
    t = ((t % 1) + 1) % 1;
    if (t < 1/6) return p + (q-p)*6*t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q-p)*(2/3 - t)*6;
    return p;
  };
  return [Math.round(f(h+1/3)*255), Math.round(f(h)*255), Math.round(f(h-1/3)*255)];
}
function mix3(a, b, t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function clamp255(v){ return v<0?0:(v>255?255:v); }

// ---------------- 3D 值噪声（球面上无接缝、无极点挤压） ----------------
function fade(t){ return t*t*(3-2*t); }
function h3(i, j, k){
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(j ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(k ^ 0x165667b1, 0x9e3779b9);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, z){
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x-xi, yf = y-yi, zf = z-zi;
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const c000=h3(xi,yi,zi), c100=h3(xi+1,yi,zi), c010=h3(xi,yi+1,zi), c110=h3(xi+1,yi+1,zi);
  const c001=h3(xi,yi,zi+1), c101=h3(xi+1,yi,zi+1), c011=h3(xi,yi+1,zi+1), c111=h3(xi+1,yi+1,zi+1);
  const x00=c000+(c100-c000)*u, x10=c010+(c110-c010)*u;
  const x01=c001+(c101-c001)*u, x11=c011+(c111-c011)*u;
  const y0=x00+(x10-x00)*v, y1=x01+(x11-x01)*v;
  return (y0+(y1-y0)*w)*2-1;   // -1..1
}
// 分形噪声：频率用无理步进(2.03)避免轴向条纹
function fbm(x, y, z, oct){
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i=0; i<oct; i++){
    s += a * vnoise(x*f, y*f, z*f);
    n += a; f *= 2.03; a *= 0.5;
  }
  return s / n;   // 归一化到 -1..1
}
function ridged(x, y, z, oct){
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i=0; i<oct; i++){
    s += a * (1 - Math.abs(vnoise(x*f, y*f, z*f)));
    n += a; f *= 2.07; a *= 0.5;
  }
  return s / n;   // 0..1
}

// ---------------- 球面方向工具（与 three.js SphereGeometry 的 UV 对齐） ----------------
// u: 0..1 绕 Y 轴；v: 0..1 自北极(1)到南极(0)
export function dirFromUV(u, v){
  const phi = u * TAU;
  const theta = (1 - v) * Math.PI;
  const st = Math.sin(theta);
  return [-Math.cos(phi)*st, Math.cos(theta), Math.sin(phi)*st];
}
export function uvFromDir(x, y, z){
  const len = Math.hypot(x, y, z) || 1;
  const ny = y/len, nx = x/len, nz = z/len;
  let phi = Math.atan2(nz, -nx);
  if (phi < 0) phi += TAU;
  const theta = Math.acos(Math.max(-1, Math.min(1, ny)));
  return [phi / TAU, 1 - theta / Math.PI];
}

// ---------------- 每颗星的视觉档案（确定性派生） ----------------
export function bodyProfile(star){
  const key = (star && (star.catalogNo || star.name)) || 'star';
  const rng = mulberry32(hashString(key + '|body'));

  const flavor = FLAVORS[Math.floor(rng() * FLAVORS.length)];
  const hueShift   = (rng() - 0.5) * 0.13;   // 色相微扰
  const satScale   = 0.82 + rng() * 0.40;    // 饱和度
  const brightScale= 0.88 + rng() * 0.28;    // 明度
  const cellScale  = 2.4 + rng() * 3.2;      // 地貌主尺度
  const detailScale= 12 + rng() * 16;        // 细节尺度
  const bandCount  = 5 + Math.floor(rng() * 7);
  const spotCount  = 2 + Math.floor(rng() * 7);
  const spotSize   = 0.09 + rng() * 0.12;
  const craterCount= 14 + Math.floor(rng() * 24);
  const craterSize = 0.035 + rng() * 0.055;
  const stormCount = 1 + Math.floor(rng() * 3);
  const glowScale  = 2.65 + rng() * 1.35;    // 日冕大小
  const glowI      = 0.55 + rng() * 0.38;    // 日冕强度
  const normalScale= 1.6 + rng() * 1.8;      // 浮雕强度
  const spin       = 0.06 + rng() * 0.10;    // 自转速度

  // 基础色：由恒星光谱色出发，再按表面原型整体调性化
  const c1 = hexToRgb((star && star.color1) || '#ffd66b');
  const c2 = hexToRgb((star && star.color2) || '#c8761f');
  const [h1,s1,l1] = rgbToHsl(c1[0], c1[1], c1[2]);
  const [h2,s2,l2] = rgbToHsl(c2[0], c2[1], c2[2]);
  const baseHue = h1 + hueShift;
  const pal = {
    bright: hslToRgb(baseHue, Math.min(1, s1*satScale), Math.min(0.97, l1*brightScale)),
    mid:    hslToRgb((baseHue + h2 - h1)*0.5 + baseHue*0.5, Math.min(1, (s1+s2)/2*satScale), Math.min(0.9, (l1+l2)/2*brightScale)),
    dark:   hslToRgb(h2 + hueShift, Math.min(1, s2*satScale), Math.max(0.05, l2*0.72*brightScale)),
  };
  // 大气 / 日冕色：主色相偏移 + 提亮
  const atmo = hslToRgb(baseHue + 0.06, Math.min(1, s1*1.05), Math.min(0.86, 0.52 + l1*0.34));

  return { flavor, hueShift, satScale, brightScale, cellScale, detailScale, bandCount,
           spotCount, spotSize, craterCount, craterSize, stormCount, glowScale, glowI,
           normalScale, spin, pal, atmo, key };
}

// ---------------- 地貌元素：陨石坑 / 风暴 / 黑子（球面分布） ----------------
function randomDirs(rng, count, minDot){
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 60){
    const z = rng()*2-1, a = rng()*TAU, r = Math.sqrt(Math.max(0, 1-z*z));
    const d = [Math.cos(a)*r, z, Math.sin(a)*r];
    let ok = true;
    for (const o of out){ if (dot(d, o) > minDot){ ok = false; break; } }
    if (ok) out.push(d);
  }
  return out;
}
function dot(a, b){ return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
function angBetween(a, b){
  const c = Math.max(-1, Math.min(1, dot(a, b)));
  return Math.acos(c);
}

// ---------------- 主入口：生成彩色图 + 高度图 ----------------
const cache = new Map();

// 同步生成（证书等一次性场景使用；已缓存则立即返回）
export function getBodySurface(star){
  const key = (star && (star.catalogNo || star.name)) || 'star';
  if (cache.has(key)) return cache.get(key);
  const built = buildSurface(star);
  cache.set(key, built);
  return built;
}

// 异步生成：把逐像素循环按行分批，每批之间让出主线程，
// 保证生成期间页面依然可交互、可滚动（否则 600ms 的同步计算会卡住 UI）。
export function getBodySurfaceAsync(star, onReady){
  const key = (star && (star.catalogNo || star.name)) || 'star';
  if (cache.has(key)){ onReady(cache.get(key)); return; }
  if (pending.has(key)){ pending.get(key).push(onReady); return; }
  pending.set(key, [onReady]);

  const p = bodyProfile(star);
  const job = createJob(star, p);
  const ROWS_PER_FRAME = 48;

  function step(){
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    // 在时间预算内尽量多处理行，超时就让出主线程
    while (job.py < job.H && ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) < 12){
      const end = Math.min(job.H, job.py + ROWS_PER_FRAME);
      for (; job.py < end; job.py++) job.renderRow(job.py);
      if (job.py >= job.H) break;
    }
    if (job.py >= job.H){
      job.finish();
      const built = job.result;
      cache.set(key, built);
      const cbs = pending.get(key) || [];
      pending.delete(key);
      cbs.forEach(cb => { try { cb(built); } catch(e){ console.warn(e); } });
    } else {
      (typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (fn => setTimeout(fn, 16)))(step);
    }
  }
  step();
}
const pending = new Map();

// ---------------- 地貌元素的空间分桶 ----------------
// 每像素遍历全部元素（且每次都要 acos）会拖垮生成速度。
// 改为把元素按经纬度落到网格里，每像素只检查邻近格子的少量元素。
function buildBuckets(elements, cols, rows){
  const buckets = new Array(cols * rows);
  for (const el of elements){
    const [u, v] = uvFromDir(el.d[0], el.d[1], el.d[2]);
    // 元素半径换算成经纬度的覆盖范围（角半径 → 纬度 ±r，经度 ±r/cos(lat)）
    const lat = Math.asin(Math.max(-1, Math.min(1, el.d[1])));
    const cosLat = Math.max(0.08, Math.cos(lat));
    const dLat = el.r / Math.PI;
    const dLon = el.r / TAU / cosLat;
    const v0 = Math.max(0, Math.floor((v - dLat) * rows));
    const v1 = Math.min(rows - 1, Math.floor((v + dLat) * rows));
    const u0 = Math.floor((u - dLon) * cols);
    const u1 = Math.floor((u + dLon) * cols);
    for (let bv = v0; bv <= v1; bv++){
      for (let bu = u0; bu <= u1; bu++){
        const buw = ((bu % cols) + cols) % cols;
        const idx = bv * cols + buw;
        (buckets[idx] || (buckets[idx] = [])).push(el);
      }
    }
  }
  return buckets;
}

// 生成作业：prepare 阶段做一次性计算，renderRow 逐行渲染，finish 收尾。
// 同步入口 buildSurface 复用同一套代码，只是把逐行循环一次性跑完。
function createJob(star, p){
  // 分辨率权衡：512×256 在球面上足以表现地表细节，
  // 且生成耗时只有 768×384 的约 1/2.2（贴图本身有 8× 放大也不失真）
  const W = 512, H = 256;

  // ---- 低频层：256×128 计算，再双线性上采样（大幅降低生成耗时） ----
  const LW = 192, LH = 96;
  const low = new Float32Array(LW * LH);
  const warpA = new Float32Array(LW * LH);
  const warpB = new Float32Array(LW * LH);
  const off = p.key.length * 3.7;
  for (let py = 0; py < LH; py++){
    const v = 1 - (py + 0.5) / LH;
    for (let px = 0; px < LW; px++){
      const u = (px + 0.5) / LW;
      const d = dirFromUV(u, v);
      // 域扭曲：让云带/条带呈现湍流漩涡感
      const w1 = fbm(d[0]*1.7 + off, d[1]*1.7, d[2]*1.7 + off, 2);
      const w2 = fbm(d[0]*1.7 + off + 11.3, d[1]*1.7 + 5.1, d[2]*1.7 - off, 2);
      warpA[py*LW+px] = w1;
      warpB[py*LW+px] = w2;
      // 扭曲后的方向（球面重新投影）
      const lon = Math.atan2(d[2], -d[0]) + w1 * 0.42;
      const lat = Math.asin(Math.max(-1, Math.min(1, d[1]))) + w2 * 0.30;
      const cl = Math.cos(lat);
      const d2 = [-Math.cos(lon)*cl, Math.sin(lat), Math.sin(lon)*cl];
      low[py*LW+px] = fbm(d2[0]*p.cellScale, d2[1]*p.cellScale, d2[2]*p.cellScale, 3);
    }
  }
  const sampleLow = (u, v) => {
    const fx = u * LW - 0.5, fy = (1 - v) * LH - 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const xi = (x) => ((x % LW) + LW) % LW;
    const yi = (y) => Math.max(0, Math.min(LH-1, y));
    const a = low[yi(y0)*LW + xi(x0)], b = low[yi(y0)*LW + xi(x0+1)];
    const c = low[yi(y0+1)*LW + xi(x0)], e = low[yi(y0+1)*LW + xi(x0+1)];
    const top = a+(b-a)*tx, bot = c+(e-c)*tx;
    return top + (bot - top) * ty;
  };
  const sampleWarp = (arr, u, v) => {
    const fx = u * LW - 0.5, fy = (1 - v) * LH - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const xi = (x) => ((x % LW) + LW) % LW;
    const yi = (y) => Math.max(0, Math.min(LH-1, y));
    const a = arr[yi(y0)*LW + xi(x0)], b = arr[yi(y0)*LW + xi(x0+1)];
    const c = arr[yi(y0+1)*LW + xi(x0)], e = arr[yi(y0+1)*LW + xi(x0+1)];
    const t = a+(b-a)*tx, u2 = c+(e-c)*tx;
    return t + (u2-t)*ty;
  };

  // ---- 地貌元素 ----
  const rngEl = mulberry32(hashString(p.key + '|el'));
  const craters = randomDirs(rngEl, p.craterCount, 0.90).map(d => ({
    d, r: p.craterSize * (0.45 + rngEl() * 1.1)
  }));
  const storms = randomDirs(rngEl, p.stormCount, 0.55).map(d => ({
    d, r: 0.10 + rngEl() * 0.13, tone: rngEl()
  }));
  const spots = randomDirs(rngEl, p.spotCount, 0.80).map(d => ({
    d, r: p.spotSize * (0.55 + rngEl() * 0.9)
  }));

  // 空间分桶：每像素只检查邻近格子的少量元素
  const BC = 32, BR = 16;
  const craterBk = buildBuckets(craters, BC, BR);
  const stormBk  = buildBuckets(storms, BC, BR);
  const spotBk   = buildBuckets(spots, BC, BR);
  const bucketAt = (bk, u, v) => {
    const bu = Math.min(BC-1, Math.max(0, Math.floor(u * BC)));
    const bv = Math.min(BR-1, Math.max(0, Math.floor(v * BR)));
    return bk[bv * BC + bu];
  };

  // ---- 逐像素着色 + 高度场 ----
  const colorCv = document.createElement('canvas');
  colorCv.width = W; colorCv.height = H;
  const cctx = colorCv.getContext('2d');
  const img = cctx.createImageData(W, H);
  const data = img.data;
  const height = new Float32Array(W * H);

  const pal = p.pal;
  // 各原型的专属色板（在基础色基础上做气质化偏移）
  const palettes = {
    granular: { a: pal.bright, b: pal.mid, c: pal.dark, spot: mix3(pal.dark, [120,28,10], 0.55), warm: 1 },
    cloudy:   { a: hslToRgb(p.hueShift+0.10, 0.42*Math.min(1,p.satScale+0.2), 0.90), b: hslToRgb(p.hueShift+0.07, 0.50*Math.min(1,p.satScale+0.2), 0.74), c: hslToRgb(p.hueShift+0.04, 0.55*Math.min(1,p.satScale+0.2), 0.50), spot: [190,150,96], warm: 0 },
    banded:   { a: pal.bright, b: pal.mid, c: pal.dark, spot: mix3(pal.dark, [168,64,34], 0.62), warm: 0 },
    rocky:    { a: hslToRgb(0.045+p.hueShift*0.5, 0.55, 0.62), b: hslToRgb(0.035+p.hueShift*0.5, 0.48, 0.44), c: hslToRgb(0.03+p.hueShift*0.5, 0.40, 0.26), spot: [70,38,26], warm: 0 },
    icy:      { a: hslToRgb(0.55+p.hueShift*0.5, 0.30, 0.93), b: hslToRgb(0.55+p.hueShift*0.5, 0.38, 0.80), c: hslToRgb(0.58+p.hueShift*0.5, 0.45, 0.62), spot: [96,132,168], warm: 0 },
  };
  const P = palettes[p.flavor] || palettes.granular;

  const job = { W, H, p, P, data, height, img, cctx, colorCv, py: 0, low, warpA, warpB,
                sampleLow, sampleWarp, bucketAt, craterBk, stormBk, spotBk, off };

  // 逐行渲染：把原来的内层循环体提取出来，供同步/异步两条路径共用
  job.renderRow = function(py){
    const v = 1 - (py + 0.5) / H;
    for (let px = 0; px < W; px++){
      const u = (px + 0.5) / W;
      const d = dirFromUV(u, v);
      const base = sampleLow(u, v);                     // -1..1 主地貌
      const w1 = sampleWarp(warpA, u, v);
      const w2 = sampleWarp(warpB, u, v);

      // 细节层（全分辨率）：颗粒 / 细纹
      const det = fbm(d[0]*p.detailScale + off, d[1]*p.detailScale, d[2]*p.detailScale - off, 2);
      const fine = det * 0.7 + fbm(d[0]*p.detailScale*2.7, d[1]*p.detailScale*2.7 + 3.3, d[2]*p.detailScale*2.7, 1) * 0.3;

      let h = 0.5;
      let col;

      if (p.flavor === 'granular'){
        // 米粒组织：明亮胞间网络 + 细密颗粒
        const cell = ridged(d[0]*p.cellScale*1.9 + off, d[1]*p.cellScale*1.9, d[2]*p.cellScale*1.9, 2);
        const gran = 0.5 + base*0.26 + det*0.16 + (cell-0.55)*0.22;
        h = gran;
        col = mix3(P.c, P.b, Math.max(0, Math.min(1, (gran-0.28)/0.46)));
        col = mix3(col, P.a, Math.max(0, Math.min(1, (gran-0.56)/0.34)) * 0.85);
        // 光斑网络
        col = mix3(col, mix3(P.a,[255,255,255],0.55), Math.max(0, fine)*0.22);
      } else if (p.flavor === 'cloudy'){
        // 金星式：厚密云幔、柔和漩涡、明暗层次弱
        const cloud = 0.5 + base*0.30 + w1*0.18 + det*0.10;
        h = cloud;
        col = mix3(P.c, P.b, Math.max(0, Math.min(1, (cloud-0.26)/0.50)));
        col = mix3(col, P.a, Math.max(0, Math.min(1, (cloud-0.58)/0.36)));
        // 暗色 UV 斑纹
        const streak = Math.max(0, fbm(d[0]*3.4+off, d[1]*3.4, d[2]*3.4+off, 2));
        col = mix3(col, P.c, streak*0.28);
      } else if (p.flavor === 'banded'){
        // 木星式：纬向条带 + 湍流边界 + 巨型风暴
        const lat = Math.asin(Math.max(-1, Math.min(1, d[1])));
        const band = Math.sin((lat * p.bandCount + w1 * 0.9) * Math.PI);
        const zone = 0.5 + band * 0.30 + base * 0.16 + det * 0.09;
        h = zone;
        col = mix3(P.c, P.b, Math.max(0, Math.min(1, (zone-0.30)/0.44)));
        col = mix3(col, P.a, Math.max(0, Math.min(1, (zone-0.60)/0.34)) * 0.9);
        // 丝缕状细节
        const fil = Math.max(0, fbm(d[0]*7.5+off, d[1]*7.5, d[2]*7.5, 2));
        col = mix3(col, P.a, fil*0.20);
      } else if (p.flavor === 'rocky'){
        // 火星式：铁锈地表 + 高地暗海 + 撞击坑
        const terra = 0.5 + base*0.34 + det*0.14;
        h = terra;
        col = mix3(P.c, P.b, Math.max(0, Math.min(1, (terra-0.30)/0.48)));
        col = mix3(col, P.a, Math.max(0, Math.min(1, (terra-0.62)/0.34)) * 0.9);
        // 沙尘亮区
        col = mix3(col, mix3(P.a,[226,196,160],0.6), Math.max(0, fine)*0.16);
      } else { // icy
        const sheet = 0.5 + base*0.30 + det*0.12;
        h = sheet;
        col = mix3(P.c, P.b, Math.max(0, Math.min(1, (sheet-0.28)/0.50)));
        col = mix3(col, P.a, Math.max(0, Math.min(1, (sheet-0.60)/0.36)));
        // 冰裂缝
        const crack = ridged(d[0]*6.2+off, d[1]*6.2, d[2]*6.2, 2);
        const ck = Math.max(0, (crack-0.80)/0.20);
        col = mix3(col, P.c, ck*0.55);
        h -= ck*0.10;
      }

      // ---- 极冠（范围收窄、过渡柔和，避免在等距柱状图上形成生硬白带） ----
      const polar = Math.abs(d[1]);
      const polarTh = p.flavor === 'icy' ? 0.82 : (p.flavor === 'rocky' ? 0.90 : 0.88);
      if (polar > polarTh){
        const t = (polar - polarTh) / (1 - polarTh);
        const tt = t * t * (3 - 2 * t);
        col = mix3(col, [242,246,252], tt * 0.85);
        h += tt * 0.04;
      }

      // ---- 撞击坑（球面，碗状凹陷 + 亮环） ----
      const crList = bucketAt(craterBk, u, v);
      if (crList) for (const cr of crList){
        const ang = angBetween(d, cr.d);
        if (ang < cr.r){
          const t = ang / cr.r;
          const bowl = 1 - t*t;
          const rim = Math.max(0, (t - 0.74) / 0.26);
          h -= bowl * 0.22 - rim * 0.07;
          col = mix3(col, P.c, bowl * 0.42);
          col = mix3(col, P.a, rim * 0.26);
        }
      }

      // ---- 风暴涡旋（椭圆拉伸 + 内部旋纹） ----
      const stList = bucketAt(stormBk, u, v);
      if (stList) for (const st of stList){
        const ang = angBetween(d, st.d);
        if (ang < st.r){
          const t = ang / st.r;
          const core = 1 - t*t;
          h += core * 0.06;
          const swirl = 0.5 + 0.5 * Math.sin(t * 14 + st.tone * 6.28);
          col = mix3(col, P.spot, core * (0.55 + swirl * 0.35));
        }
      }

      // ---- 恒星黑子（本影 + 半影 + 周边光斑） ----
      const spList = bucketAt(spotBk, u, v);
      if (spList) for (const sp of spList){
        const ang = angBetween(d, sp.d);
        if (ang < sp.r){
          const t = ang / sp.r;
          const umb = Math.max(0, 1 - t / 0.55);
          const pen = Math.max(0, 1 - Math.abs(t - 0.75) / 0.25);
          h -= umb * 0.16;
          col = mix3(col, P.spot, umb * 0.80);
          col = mix3(col, mix3(P.c, P.spot, 0.5), pen * 0.45);
        }
      }

      // 高度 → 颜色做一点浮雕感提亮（顶亮底暗），强化体积
      const relief = (h - 0.5) * 0.5;
      col = [col[0]*(1+relief), col[1]*(1+relief), col[2]*(1+relief)];

      const i4 = (py*W + px) * 4;
      data[i4] = clamp255(col[0]);
      data[i4+1] = clamp255(col[1]);
      data[i4+2] = clamp255(col[2]);
      data[i4+3] = 255;
      height[py*W+px] = h;
    }
  };

  // 收尾：把彩色像素写回画布，并生成高度图（灰度）供 bumpMap 使用
  job.finish = function(){
    cctx.putImageData(img, 0, 0);
    // 高度图用作 three.js 的 bumpMap（屏幕空间导数求浮雕，任何 UV 布局都正确），
    // 证书 2D 端则直接读取高度场自行做光照，两者共用同一份数据。
    const bumpCv = document.createElement('canvas');
    bumpCv.width = W; bumpCv.height = H;
    const bctx = bumpCv.getContext('2d');
    const bimg = bctx.createImageData(W, H);
    const bd = bimg.data;
    for (let i = 0; i < W*H; i++){
      const g = clamp255(height[i] * 255);
      bd[i*4] = g; bd[i*4+1] = g; bd[i*4+2] = g; bd[i*4+3] = 255;
    }
    bctx.putImageData(bimg, 0, 0);
    // 注意：height 键只能出现一次 —— 高度场数组用 heightField，画布高度用 imgH
    job.result = { color: colorCv, bump: bumpCv, heightField: height, profile: p, width: W, imgH: H };
    return job.result;
  };

  return job;
}

// 同步版本：一次性跑完全部行（证书等一次性场景）
function buildSurface(star){
  const p = bodyProfile(star);
  const job = createJob(star, p);
  while (job.py < job.H){ job.renderRow(job.py); job.py++; }
  return job.finish();
}

// ---------------- 高度场双线性采样（证书 2D 光照用） ----------------
export function sampleHeight(surface, u, v){
  const { heightField, width: W, imgH: H } = surface;
  const height = heightField;
  const x = Math.max(0, Math.min(W-1, u * W - 0.5));
  const y = Math.max(0, Math.min(H-1, (1 - v) * H - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const xi = (a) => ((a % W) + W) % W;
  const yi = (a) => Math.max(0, Math.min(H-1, a));
  const a = height[yi(y0)*W + xi(x0)],   b = height[yi(y0)*W + xi(x0+1)];
  const c = height[yi(y0+1)*W + xi(x0)], e = height[yi(y0+1)*W + xi(x0+1)];
  const t = a + (b-a)*tx, u2 = c + (e-c)*tx;
  return t + (u2 - t) * ty;
}

// ---------------- 采样工具（证书 2D 复用） ----------------
export function sampleCanvas(cv, u, v){
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const x = Math.max(0, Math.min(W-1, Math.floor(u * W)));
  const y = Math.max(0, Math.min(H-1, Math.floor((1 - v) * H)));
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]];
}
