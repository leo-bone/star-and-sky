// 星球认领证书 —— 整张证书以单张高分辨率 canvas 绘制（深空档案 / 庄重纪念风）
// 设计语言：深蓝炭黑底 + 低饱和暗紫星云 + 稀疏分层星点 + 细哑光金线 + 四角卷草纹
// 中心「星球档案组件」图层顺序：星盘刻度环 → 轨道后半 → 星球本体 → 轨道前半(遮挡) → 星座连线/星点/坐标小字
import { hashString, mulberry32 } from './rng.js';
import { t } from './i18n.js';

const DW = 1240, DH = 1754;   // A4 竖版设计尺寸（约 1:1.414）
const K = 2;                  // 内部分辨率倍数，导出更清晰

let grainTile = null;          // 证书底纹噪点（缓存，一次性生成）

// ===== 配色（克制、哑光）=====
const C = {
  bgTop:  '#0e1a3a',
  bgBot:  '#05080f',
  neb1:   'rgba(86,66,128,0.16)',   // 暗紫星云
  neb2:   'rgba(60,84,150,0.14)',   // 蓝调星云
  gold:   '#e7c98a',                // 浅金（标题/钢印/参数）
  goldB:  '#f4dcab',                // 亮金（小面积点缀）
  goldLine: 'rgba(207,168,106,0.55)',// 哑光金线（外框）
  goldLine2:'rgba(207,168,106,0.30)',
  goldDim: 'rgba(207,168,106,0.30)',
  ink:    '#ece4d0',                // 暖白正文
  inkSoft:'#d7cdb4',
  grayBlue:'#8190b4',               // 免责声明灰蓝
};

export function initCertificate(){
  const canvas = document.getElementById('cert-canvas');
  let lastStar = null, lastKd = null;

  function build(star, kd){
    if (!star || !canvas) return;
    lastStar = star; lastKd = kd || {};
    render();
    // 字体可能尚未加载，加载完成后重绘一次以保证衬线字体生效
    if (document.fonts && document.fonts.ready){
      document.fonts.ready.then(()=>{ if (lastStar) render(); });
    }
  }

  function render(){
    const star = lastStar, kd = lastKd;
    canvas.width = DW * K; canvas.height = DH * K;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(K, 0, 0, K, 0, 0);   // 之后全部用设计坐标绘制
    ctx.clearRect(0, 0, DW, DH);

    drawBackground(ctx, star);
    drawFrame(ctx);

    // ---- 顶部标题区 ----
    drawEyebrow(ctx);
    drawTitle(ctx);

    // ---- 中心星球档案组件（放大，使“宇宙徽章”成为视觉核心）----
    const archCx = DW / 2, archCy = 556, archR = 288;
    drawArchive(ctx, archCx, archCy, archR, star);

    // ---- 正文区 ----
    drawBody(ctx, star, kd);

    // ---- 右下钢印 + 底部免责声明 ----
    drawSeal(ctx, DW - 56 - 92, DH - 56 - 196, 86, star);
    drawDisclaimer(ctx);
  }

  function download(star){
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `${t('星与星空')}_${star.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast(t('星图已保存，去分享吧 ✦'));
    } catch (e){
      toast(t('生成失败，请重试'));
      console.error(e);
    }
  }

  return { build, download };
}

// ============================================================
// 背景：深蓝渐变 + 低饱和暗紫星云 + 稀疏三层星点
// ============================================================
function drawBackground(ctx, star){
  const bg = ctx.createLinearGradient(0, 0, 0, DH);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBot);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, DW, DH);

  // 暗角
  const vig = ctx.createRadialGradient(DW/2, DH*0.42, DH*0.25, DW/2, DH*0.5, DH*0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, DW, DH);

  // 低饱和星云：中央 + 四角扩散，打破纯深蓝的死板感（screen 叠加，不盖文字）
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const nebBlobs = [
    [DW*0.30, DH*0.30, DW*0.55, C.neb1],
    [DW*0.72, DH*0.42, DW*0.50, C.neb2],
    [DW*0.66, DH*0.82, DW*0.55, C.neb1],
    [DW*0.28, DH*0.72, DW*0.50, C.neb2],
    [DW*0.50, DH*0.50, DW*0.66, 'rgba(72,62,112,0.10)'],   // 中央极淡星云，避免纯色方框
  ];
  nebBlobs.forEach(([x, y, r, col])=>{
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH);
  });
  ctx.restore();

  // 稀疏三层星点（大星少、细碎弱星铺满，禁止密密麻麻）
  const rng = mulberry32(hashString((star && star.catalogNo || 'star') + 'bg'));
  const stars = [];
  // 主星（少量，带极淡微光）
  for (let i = 0; i < 10; i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 1.6 + rng()*1.4, a: 0.55 + rng()*0.35, big: true });
  // 中星
  for (let i = 0; i < 34; i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 0.9 + rng()*0.8, a: 0.4 + rng()*0.35 });
  // 细碎弱星（大量但极淡）
  for (let i = 0; i < 150; i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 0.5 + rng()*0.6, a: 0.18 + rng()*0.22 });

  stars.forEach(s=>{
    const warm = rng() > 0.86;
    const col = warm ? `rgba(255,226,188,${s.a})` : `rgba(228,236,255,${s.a})`;
    if (s.big){
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r*4);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r*4, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
  });

  // 微弱底纹（档案质感）：极淡噪点叠加，避免纯色死板
  if (!grainTile) grainTile = makeGrain();
  ctx.save();
  ctx.globalAlpha = 0.04; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, DW, DH);
  ctx.restore();
}

// ============================================================
// 外框：细哑光金矩形 + 四角古希腊卷草纹
// ============================================================
function drawFrame(ctx){
  const M = 54;
  // 外：1px 哑光金边框（清晰利落，档案质感）
  ctx.strokeStyle = 'rgba(207,168,106,0.62)'; ctx.lineWidth = 1;
  roundRectPath(ctx, M, M, DW - M*2, DH - M*2, 6); ctx.stroke();
  // 内发丝金线（双线显精致）
  ctx.strokeStyle = C.goldLine2; ctx.lineWidth = 1;
  roundRectPath(ctx, M + 9, M + 9, DW - (M+9)*2, DH - (M+9)*2, 4); ctx.stroke();

  const corners = [
    [M + 9, M + 9, 1, 1],
    [DW - M - 9, M + 9, -1, 1],
    [M + 9, DH - M - 9, 1, -1],
    [DW - M - 9, DH - M - 9, -1, -1],
  ];
  corners.forEach(([x, y, sx, sy]) => drawCornerOrnament(ctx, x, y, sx, sy));
}

// 古希腊风：贴边双线与末端小卷草（volute）
function drawCornerOrnament(ctx, x, y, sx, sy){
  ctx.save();
  ctx.translate(x, y); ctx.scale(sx, sy);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.globalAlpha = 0.62;
  // 沿两条边的细金线（约 60px）
  ctx.beginPath();
  ctx.moveTo(0, 62); ctx.lineTo(0, 0); ctx.lineTo(62, 0);
  ctx.stroke();
  // 末端小卷草：螺旋 volute
  ctx.beginPath();
  const turns = 1.6, r0 = 1.2, r1 = 9;
  const steps = 40;
  for (let i = 0; i <= steps; i++){
    const a = i/steps * turns * Math.PI*2;
    const r = r0 + (r1 - r0) * (i/steps);
    const px = 14 + Math.cos(a) * r, py = 14 + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  // 卷草外侧一小点
  ctx.beginPath(); ctx.arc(14, 14, 1.4, 0, Math.PI*2); ctx.fillStyle = C.gold; ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ============================================================
// 标题区
// ============================================================
function drawEyebrow(ctx){
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.gold; ctx.globalAlpha = 0.85;
  setFont(ctx, '500 16px "Space Grotesk", "Noto Serif SC", serif');
  ctx.letterSpacing = '6px';
  ctx.fillText('STAR & SKY  ·  星与星空', DW/2, 116);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

function drawTitle(ctx){
  ctx.save();
  ctx.textAlign = 'center';
  // 主标题：衬线浅金、大字号、宽字距
  setFont(ctx, '600 62px "Noto Serif SC", serif');
  ctx.fillStyle = C.gold;
  ctx.letterSpacing = '14px';
  ctx.fillText(t('星球认领证书'), DW/2, 182);
  ctx.letterSpacing = '0px';
  // 英文副标题
  setFont(ctx, '400 19px "Cormorant Garamond", "Times New Roman", serif');
  ctx.fillStyle = C.goldB; ctx.globalAlpha = 0.9;
  ctx.letterSpacing = '6px';
  ctx.fillText('PLANET CLAIM CERTIFICATE', DW/2, 214);
  ctx.letterSpacing = '0px';
  // 短金线分隔
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(DW/2 - 60, 240); ctx.lineTo(DW/2 + 60, 240); ctx.stroke();
  // 线两端小菱形
  [DW/2 - 60, DW/2 + 60].forEach(x=>{
    ctx.save(); ctx.translate(x, 240); ctx.rotate(Math.PI/4);
    ctx.fillStyle = C.gold; ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  });
  ctx.restore();
}

// ============================================================
// 星球档案组件（核心：图层顺序严格分层 + 轨道前后遮挡）
// ============================================================
function drawArchive(ctx, cx, cy, R, star){
  // —— 图层 1：外圈刻度星盘 ——
  drawDial(ctx, cx, cy, R, star);

  // —— 图层 2/4：倾斜轨道环（后半在星球后，前半在星球前）——
  const tilt = -0.34;
  const rx = R * 0.82, ry = R * 0.30;
  const orb = orbitStyle(star);

  // 后半弧（上方，y<0）：先画，被星球遮挡
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(tilt);
  ctx.globalCompositeOperation = 'screen';
  strokeOrbit(ctx, rx, ry, orb, Math.PI, Math.PI*2);
  ctx.restore();

  // —— 图层 3：中心星球本体（放大，强化核心）——
  drawCelestialBody(ctx, cx, cy, R * 0.44, star);

  // 前半弧（下方，y>0）：后画，盖在星球前方实现遮挡
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(tilt);
  ctx.globalCompositeOperation = 'screen';
  strokeOrbit(ctx, rx, ry, orb, 0, Math.PI);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';

  // —— 图层 5：星座点位 + 连线 + 坐标小字 ——
  drawConstellation(ctx, cx, cy, R, star);
}

// 外圈刻度星盘：细圆环 + 天文刻度（密度/范围随星联动）
function drawDial(ctx, cx, cy, R, star){
  const rng = mulberry32(hashString((star_const(star)) + 'dial'));
  ctx.save();
  ctx.strokeStyle = 'rgba(207,168,106,0.85)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(207,168,106,0.45)';
  ctx.beginPath(); ctx.arc(cx, cy, R - 8, 0, Math.PI*2); ctx.stroke();

  const N = 72;                       // 刻度数量（随星可微调）
  const off = rng() * Math.PI * 2;
  for (let i = 0; i < N; i++){
    const a = off + i / N * Math.PI * 2;
    const major = (i % 6 === 0);
    const r1 = R, r2 = R - (major ? 14 : 7);
    ctx.strokeStyle = major ? 'rgba(231,201,138,0.92)' : 'rgba(207,168,106,0.5)';
    ctx.lineWidth = major ? 1.9 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a)*r1, cy + Math.sin(a)*r1);
    ctx.lineTo(cx + Math.cos(a)*r2, cy + Math.sin(a)*r2);
    ctx.stroke();
  }
  // 四方位小三角定位
  ctx.fillStyle = C.gold;
  [[0,'N'],[Math.PI/2,'E'],[Math.PI,'S'],[Math.PI*1.5,'W']].forEach(([a,lab])=>{
    const x = cx + Math.cos(a)*R, y = cy + Math.sin(a)*R;
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

function strokeOrbit(ctx, rx, ry, orb, a0, a1){
  // 双层：外淡 + 内亮，营造哑光金属环
  ctx.strokeStyle = orb.outer; ctx.lineWidth = orb.w;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
  ctx.strokeStyle = orb.inner; ctx.lineWidth = Math.max(1, orb.w * 0.4);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
}

// 轨道样式：随星球类型/参数联动（气态更宽更弥散，岩石更细；默认优雅金）
function orbitStyle(star){
  const base = { outer: 'rgba(206,176,116,0.38)', inner: 'rgba(231,201,138,0.70)', w: 7 };
  const f = (star && star.form);
  if (f === 'planet'){
    const pt = star.planetType;
    if (pt === 'gas') return { outer: 'rgba(206,176,116,0.34)', inner: 'rgba(231,201,138,0.62)', w: 10 };
    return { outer: 'rgba(196,176,150,0.34)', inner: 'rgba(224,214,196,0.64)', w: 5 };  // 岩石/月球更细银灰
  }
  return base;
}

// 中心星球本体：恒星（克制发光）/ 行星两种渲染，按数据动态切换
function drawCelestialBody(ctx, cx, cy, r, star){
  if (star && star.form === 'planet'){
    drawPlanetBody(ctx, cx, cy, r, star);
    return;
  }
  drawStarBody(ctx, cx, cy, r, star);
}

// 恒星：柔和体积光晕 + 星面 + 极淡星芒（拒绝爆炸强光）
function drawStarBody(ctx, cx, cy, r, star){
  const c1 = hexToRgb(star && star.color1 ? star.color1 : '#ffd9a0');
  const c2 = hexToRgb(star && star.color2 ? star.color2 : '#ff9d5c');
  const rng = mulberry32(hashString(star_const(star) + 'body'));
  const perl = makePerlin(rng);
  const ox = rng()*50, oy = rng()*50, oz = rng()*50;

  // 柔和体积光晕（低强度，screen 叠加）
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(cx, cy, r*0.5, cx, cy, r*2.1);
  glow.addColorStop(0, rgba(c1, 0.34));
  glow.addColorStop(0.45, rgba(c1, 0.12));
  glow.addColorStop(1, rgba(c1, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r*2.1, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // 星面（米粒 + 临边昏暗），逐像素
  const d = Math.ceil(r*2) + 4;
  const img = ctx.createImageData(d, d); const data = img.data;
  const light = c1, dark = scale3(c1, 0.45), fac = [Math.min(255,c1[0]+50), Math.min(255,c1[1]+50), Math.min(255,c1[2]+50)];
  for (let py = 0; py < d; py++){
    for (let px = 0; px < d; px++){
      const o = (py*d + px)*4;
      const dx = px - r, dy = py - r, dist = Math.hypot(dx, dy);
      if (dist > r){ data[o+3] = 0; continue; }
      const nx = dx/r, ny = dy/r, nz = Math.sqrt(Math.max(0, 1 - nx*nx - ny*ny));
      const g = (fbm3(perl, nx*3.2+ox, ny*3.2+oy, nz*3.2+oz, 4)*0.6
               + fbm3(perl, nx*7+ox+11, ny*7+oy+11, nz*7+oz+11, 3)*0.4);
      const tcol = mix3(dark, light, smoothstep(0.2, 0.8, g*0.5+0.5));
      const limb = Math.pow(Math.max(0, nz), 0.5);
      const dn = mix(0.32, 1.12, limb);
      let R = tcol[0]*dn, G = tcol[1]*dn, B = tcol[2]*dn;
      // 极淡高光斑
      if (g > 0.62){ const f = smoothstep(0.62, 0.85, g)*0.25; R=mix(R,fac[0],f); G=mix(G,fac[1],f); B=mix(B,fac[2],f); }
      const aa = smoothstep(r+1.2, r-1.2, dist);
      data[o]=clamp255(R); data[o+1]=clamp255(G); data[o+2]=clamp255(B); data[o+3]=Math.round(255*aa);
    }
  }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  ctx.drawImage(toOffscreen(img, d), cx - r - 2, cy - r - 2, d, d);
  ctx.restore();

  // 极淡四向星芒（克制）
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const spikes = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
  spikes.forEach(ang=>{
    const len = r * 1.5, ex = cx + Math.cos(ang)*len, ey = cy + Math.sin(ang)*len;
    const g = ctx.createLinearGradient(cx, cy, ex, ey);
    g.addColorStop(0, rgba(c1, 0.28)); g.addColorStop(1, rgba(c1, 0));
    ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
  });
  // 高光边缘
  ctx.strokeStyle = rgba(c1, 0.5); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

// 行星（岩石/月球/气态）：简洁球面光照，作为组件可切换类型之一
function drawPlanetBody(ctx, cx, cy, r, star){
  const c1 = hexToRgb(star.pColor1 || '#9fb4cc'), c2 = hexToRgb(star.pColor2 || '#5d6b82');
  const c3 = hexToRgb(star.pColor3 || '#c9d4e2');
  const lunar = star.planetType === 'lunar';
  const gas = star.planetType === 'gas';
  const rng = mulberry32(hashString(star_const(star) + 'pbody'));
  const perl = makePerlin(rng);
  const ox = rng()*40, oy = rng()*40, oz = rng()*40;
  const d = Math.ceil(r*2) + 4;
  const img = ctx.createImageData(d, d); const data = img.data;
  let Lx = 0.46, Ly = 0.52, Lz = 0.70; const ll = Math.hypot(Lx,Ly,Lz); Lx/=ll; Ly/=ll; Lz/=ll;
  for (let py = 0; py < d; py++){
    for (let px = 0; px < d; px++){
      const o = (py*d + px)*4;
      const dx = px - r, dy = py - r, dist = Math.hypot(dx, dy);
      if (dist > r){ data[o+3] = 0; continue; }
      const nx = dx/r, ny = dy/r, nz = Math.sqrt(Math.max(0, 1 - nx*nx - ny*ny));
      let R, G, B;
      if (gas){
        const bands = Math.sin((ny*2.4)*Math.PI*1.3)*0.5+0.5;
        const turb = fbm3(perl, nx*2+ox, ny*2+oy, nz*2+oz, 4)*0.5+0.5;
        const m = bands*0.55 + turb*0.45;
        const c = mix3(c2, c1, Math.min(1, Math.max(0, m)));
        R=c[0];G=c[1];B=c[2];
      } else {
        const e = fbm3(perl, nx*2+ox, ny*2+oy, nz*2+oz, 5);
        let c;
        if (lunar){ const h = Math.min(1, Math.max(0, (e+1)/2)); c = mix3(c2, c3, h*h); }
        else { c = mix3(c2, c1, Math.min(1, Math.max(0, (e+1)/2))); }
        R=c[0];G=c[1];B=c[2];
        const polar = Math.abs(ny);
        if (polar > 0.7){ const tt = (polar-0.7)/0.3; const ice = mix3([R,G,B],[240,246,255], tt*0.9); R=ice[0];G=ice[1];B=ice[2]; }
      }
      const ndl = nx*Lx + ny*Ly + nz*Lz;
      const day = smoothstep(-0.15, 0.5, ndl);
      const lit = 0.06 + day*0.94;
      R*=lit; G*=lit; B*=lit;
      const rim = Math.pow(Math.max(0, 1-nz), 3.0);
      const atm = lunar ? rim*0.14 : rim*0.4;
      const atr = hexToRgb(star.pAtmo || '#9cc4ff');
      R += atr[0]*atm; G += atr[1]*atm; B += atr[2]*atm;
      const aa = smoothstep(r+1.2, r-1.2, dist);
      data[o]=clamp255(R); data[o+1]=clamp255(G); data[o+2]=clamp255(B); data[o+3]=Math.round(255*aa);
    }
  }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  ctx.drawImage(toOffscreen(img, d), cx - r - 2, cy - r - 2, d, d);
  ctx.restore();
  ctx.strokeStyle = rgba(hexToRgb(star.pAtmo||'#9cc4ff'), lunar?0.1:0.18); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
}

// 星座：金色细线 + 金色星点（图案随星座名确定），附极小坐标标注
function drawConstellation(ctx, cx, cy, R, star){
  const seed = hashString((star && star.constellation) ? star.constellation : (star_const(star) + 'con'));
  const rng = mulberry32(seed);
  const clusters = [
    { bx: cx - R*0.74, by: cy - R*0.60, n: 6 + Math.floor(rng()*2) },
    { bx: cx + R*0.70, by: cy + R*0.64, n: 5 + Math.floor(rng()*2) },
  ];
  ctx.save();
  clusters.forEach(cl=>{
    const pts = [];
    let x = cl.bx + (rng()-0.5)*R*0.2, y = cl.by + (rng()-0.5)*R*0.2;
    for (let i = 0; i < cl.n; i++){
      pts.push([x, y]);
      x = x + (rng()-0.4) * R*0.34;
      y = y + (rng()-0.5) * R*0.34;
    }
    // 连线（加粗加亮，强化星盘视觉权重）
    ctx.strokeStyle = 'rgba(231,201,138,0.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    pts.forEach((p, i)=> i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke();
    // 星点（带极淡微光，主点更大更亮）
    pts.forEach((p, i)=>{
      ctx.beginPath(); ctx.arc(p[0], p[1], i === 0 ? 3.2 : 2.4, 0, Math.PI*2);
      ctx.fillStyle = i === 0 ? '#fff3d2' : '#ffeec0'; ctx.fill();
      if (i === 0){ ctx.strokeStyle = 'rgba(255,233,176,.6)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI*2); ctx.stroke(); }
    });
    // 极小坐标标注（装饰）
    ctx.fillStyle = 'rgba(159,180,255,0.5)';
    setFont(ctx, '8px "Space Grotesk", monospace');
    const ra = (rng()*24).toFixed(1) + 'h', dec = (rng()*180-90).toFixed(0) + '°';
    ctx.fillText(ra, pts[0][0] + 7, pts[0][1] - 6);
    ctx.fillText(dec, pts[pts.length-1][0] - 4, pts[pts.length-1][1] + 12);
  });
  ctx.restore();
}

// ============================================================
// 正文区
// ============================================================
function drawBody(ctx, star, kd){
  const x0 = DW/2;
  let y = 924;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // 兹证明（小金标签）
  setFont(ctx, '500 18px "Noto Serif SC", serif');
  ctx.fillStyle = C.gold; ctx.globalAlpha = 0.92; ctx.letterSpacing = '4px';
  ctx.fillText(t('兹证明'), x0, y); ctx.letterSpacing = '0px'; ctx.globalAlpha = 1;
  y += 46;

  // 认领句（暖白正文，姓名/日期 浅金）
  setFont(ctx, '400 23px "Noto Serif SC", serif');
  ctx.fillStyle = C.ink;
  const reg = kd.ruler || t('星际公民');
  const date = claimDate(star);
  const line = `${t('认领人')}　${reg}　${t('已于')}　${date}　${t('完成星球纪念认领')}`;
  ctx.fillText(line, x0, y);
  y += 52;

  // 星体档案 小标题（金 + 左右短金线）
  ctx.strokeStyle = C.goldLine; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 - 130, y - 8); ctx.lineTo(x0 - 18, y - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0 + 18, y - 8); ctx.lineTo(x0 + 130, y - 8); ctx.stroke();
  setFont(ctx, '500 20px "Noto Serif SC", serif');
  ctx.fillStyle = C.gold; ctx.letterSpacing = '3px';
  ctx.fillText(t('星体档案'), x0, y); ctx.letterSpacing = '0px';
  y += 44;

  // 三组参数（标签暖白，值浅金）
  const no = (star.registry || (star.catalogNo || '').replace('SSS-', '') || '—');
  const params = [
    [t('星球名称'), star.name || '—'],
    [t('星体编号'), no],
    [t('天体坐标'), star.coord || '—'],
  ];
  setFont(ctx, '400 22px "Noto Serif SC", serif');
  params.forEach(([k, v])=>{
    const label = `${k}　`;
    const full = label + v;
    const lw = ctx.measureText(label).width;
    const vw = ctx.measureText(v).width;
    const total = lw + vw;
    let lx = x0 - total/2;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink; ctx.fillText(label, lx, y);
    ctx.fillStyle = C.gold; ctx.fillText(v, lx + lw, y);
    ctx.textAlign = 'center';
    y += 40;
  });
  y += 14;

  // 纪念文案（居中、暖白、略斜）
  setFont(ctx, 'italic 400 19px "Noto Serif SC", serif');
  ctx.fillStyle = C.inkSoft; ctx.globalAlpha = 0.95;
  ctx.fillText(t('于浩瀚宇宙之中，认领属于自己的星辰，以此为记，恒久留存。'), x0, y);
  ctx.globalAlpha = 1;
}

// 右下圆形钢印：星辰档案 · 纪念存证（淡压印，不刺眼）
function drawSeal(ctx, cx, cy, r, star){
  ctx.save();
  // 压印阴影（极淡，模拟 emboss）
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx+1.5, cy+2, r, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // 双金圈
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 1;

  // 环形文字
  drawArcText(ctx, t('星辰档案'), cx, cy, r - 22, Math.PI*1.18, Math.PI*1.82, false);
  drawArcText(ctx, t('纪念存证'), cx, cy, r - 22, Math.PI*0.18, Math.PI*0.82, true);

  // 中心：简笔星球 + 环
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.4);
  ctx.strokeStyle = C.gold; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, 0, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawArcText(ctx, text, cx, cy, r, a0, a1, flip){
  const n = text.length;
  setFont(ctx, '500 13px "Noto Serif SC", serif');
  ctx.fillStyle = C.gold; ctx.globalAlpha = 0.9;
  for (let i = 0; i < n; i++){
    const a = a0 + (a1 - a0) * (i + 0.5) / n;
    const x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI/2 + (flip ? Math.PI : 0));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text[i], 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
}

// 底部免责声明（最小字号，灰蓝但保证可读）
function drawDisclaimer(ctx){
  ctx.save();
  ctx.textAlign = 'center';
  // 上方短金线分隔
  ctx.strokeStyle = C.goldLine2; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(DW/2 - 72, DH - 104); ctx.lineTo(DW/2 + 72, DH - 104); ctx.stroke();
  setFont(ctx, '400 14px "Noto Serif SC", serif');
  ctx.fillStyle = '#c2cde6';
  ctx.fillText(t('备注：本证书为平台纪念性质认领证书，并非 IAU 国际天文学联合会官方天体命名凭证，仅作为数字纪念藏品。'), DW/2, DH - 78);
  ctx.restore();
}

// ============================================================
// 工具
// ============================================================
function claimDate(star){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '.' + p(d.getMonth()+1) + '.' + p(d.getDate());
}
function star_const(star){ return (star && (star.catalogNo || star.name)) || 'star'; }

function setFont(ctx, f){ ctx.font = f; }
function spaced(s){ return s.split('').join(' '); }   // 极细字距（部分字体 letterSpacing 不支持时兜底）

function toOffscreen(img, d){
  const off = document.createElement('canvas'); off.width = d; off.height = d;
  off.getContext('2d').putImageData(img, 0, 0);
  return off;
}
// 极淡噪点底纹（档案质感）：缓存一张小 tile，整体以 overlay 极低透明度平铺
function makeGrain(){
  const S = 160;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const x = cv.getContext('2d');
  const img = x.createImageData(S, S); const d = img.data;
  for (let i = 0; i < d.length; i += 4){
    const v = 190 + Math.random() * 65;
    d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  x.putImageData(img, 0, 0);
  return cv;
}
function roundRectPath(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function hexToRgb(hex){
  const h = (hex||'#888888').replace('#','');
  return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
}
function rgba(c, a){ return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function mix3(a, b, t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function scale3(a, t){ return [a[0]*t, a[1]*t, a[2]*t]; }
function mix(a, b, t){ return a + (b-a)*t; }
function smoothstep(e0, e1, x){ const t = Math.min(1, Math.max(0, (x-e0)/(e1-e0))); return t*t*(3-2*t); }
function clamp255(v){ return v < 0 ? 0 : (v > 255 ? 255 : v); }

function toast(msg){
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(()=> el.classList.remove('show'), 2000);
}

// ---- Perlin 噪声（星球表面/行星用）----
function makePerlin(rng){
  const perm = new Uint8Array(512), p = new Uint8Array(256);
  for (let i=0;i<256;i++) p[i]=i;
  for (let i=255;i>0;i--){ const j=Math.floor(rng()*(i+1)); const t=p[i]; p[i]=p[j]; p[j]=t; }
  for (let i=0;i<512;i++) perm[i]=p[i&255];
  const fade=t=>t*t*t*(t*(t*6-15)+10);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const grad=(h,x,y,z)=>{ const u=(h&1)?-x:x, v=(h&2)?-y:y, w=(h&4)?-z:z; return u+v+w; };
  return (x,y,z)=>{
    const X=Math.floor(x)&255, Y=Math.floor(y)&255, Z=Math.floor(z)&255;
    x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);
    const u=fade(x), v=fade(y), w=fade(z);
    const A=perm[X]+Y, AA=perm[A]+Z, AB=perm[A+1]+Z;
    const B=perm[X+1]+Y, BA=perm[B]+Z, BB=perm[B+1]+Z;
    return lerp(
      lerp(lerp(grad(perm[AA],x,y,z), grad(perm[BA],x-1,y,z), u),
           lerp(grad(perm[AB],x,y-1,z), grad(perm[BB],x-1,y-1,z), u), v),
      lerp(lerp(grad(perm[AA+1],x,y,z-1), grad(perm[BA+1],x-1,y,z-1), u),
           lerp(grad(perm[AB+1],x,y-1,z-1), grad(perm[BB+1],x-1,y-1,z-1), u), v),
      w);
  };
}
function fbm3(noise, x, y, z, oct){
  let s=0, a=0.5, f=1;
  for (let o=0;o<oct;o++){ s += a*noise(x*f, y*f, z*f); f*=2; a*=0.5; }
  return s;
}
