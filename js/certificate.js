// 星球认领证书 —— 单张高分辨率 canvas 绘制（按参考图 1:1 复刻：深空星图凭证）
// 版式：顶部标题 → 上半深空+中央大星球(土星环+圆形刻度盘+星座连线) → 中部羊皮纸信息卡 → 底部深蓝区(徽章+标语+二维码)
// 中心星球与 3D 认星页共用同一套 bodyTexture 表面，保证证书星 == 网页「认领的星星」。
import { hashString, mulberry32 } from './rng.js';
import { t } from './i18n.js';
import { shareLink, encodeStar, qrLinkForStar } from './share.js';
import { getBodySurface, uvFromDir } from './bodyTexture.js';

const DW = 1240, DH = 1754;   // A4 竖版设计尺寸
const K = 2;                  // 内部分辨率倍数

let grainTile = null;          // 证书底纹噪点（缓存）
let nebTex = null;             // 星云纹理 tile（缓存）

// ===== 配色 =====
const C = {
  bgTop:  '#0e1a3a',
  bgBot:  '#05080f',
  gold:   '#e7c98a',
  goldB:  '#f4dcab',
  goldLine: 'rgba(207,168,106,0.55)',
  goldLine2:'rgba(207,168,106,0.30)',
  ink:    '#ece4d0',
};

// 羊皮纸信息卡配色（浅底深字 + 暗金线）
const P = {
  bg1:   '#f8f0d9',
  bg2:   '#ecdfc0',
  ink:   '#2b2718',
  label: '#7a6334',
  gold:  '#b8923f',
  gold2: 'rgba(184,146,63,0.55)',
  band:  'rgba(120,86,40,0.55)',
};

export function initCertificate(){
  const canvas = document.getElementById('cert-canvas');
  let lastStar = null, lastKd = null;

  function build(star, kd){
    if (!star || !canvas) return;
    lastStar = star; lastKd = kd || {};
    render();
    if (document.fonts && document.fonts.ready){
      document.fonts.ready.then(()=>{ if (lastStar) render(); });
    }
  }

  function render(){
    const star = lastStar, kd = lastKd;
    canvas.width = DW * K; canvas.height = DH * K;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.clearRect(0, 0, DW, DH);

    drawBackground(ctx, star);
    drawEyebrow(ctx);
    drawTitle(ctx);

    // 中心星球档案组件（核心）：星座连线 → 圆形刻度盘 → 土星环后半 → 星球 → 土星环前半
    const cx = DW / 2, cy = 555, R = 270;
    drawPlanetAssembly(ctx, cx, cy, R, star);

    drawParchmentCard(ctx, star, kd);
    drawFooter(ctx, star, kd);
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
// 背景：极深暗蓝黑渐变 + 仅边缘低透明星云 + 三层星点（远/中/近）
// ============================================================
function drawBackground(ctx, star){
  const bg = ctx.createLinearGradient(0, -80, DW * 0.4, DH + 80);
  bg.addColorStop(0,   '#0e1838');
  bg.addColorStop(0.5, '#080b1c');
  bg.addColorStop(1,   '#03040a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, DW, DH);

  // 四角 / 边缘低透明星云（主体区保持干净深色，不被白雾覆盖）
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const corners = [
    [60, 60, 'rgba(86,66,128,0.18)'],
    [DW - 60, 70, 'rgba(58,84,150,0.15)'],
    [80, DH - 80, 'rgba(96,64,140,0.10)'],
    [DW - 80, DH - 80, 'rgba(50,80,140,0.10)'],
  ];
  corners.forEach(([x, y, col]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 520);
    g.addColorStop(0,   col);
    g.addColorStop(0.6, col.replace(/[\d.]+\)$/, '0.03)'));
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH);
  });
  if (!nebTex) nebTex = makeNebulaTexture();
  ctx.globalAlpha = 0.14; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(nebTex, 'repeat');
  ctx.fillRect(0, 0, DW, DH);
  ctx.restore();

  // 暗角（压住四角，强化纵深）
  const vig = ctx.createRadialGradient(DW/2, DH*0.4, DH*0.25, DW/2, DH*0.5, DH*0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.7, 'rgba(0,0,0,0.28)');
  vig.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, DW, DH);

  drawStarField(ctx, star);

  if (!grainTile) grainTile = makeGrain();
  ctx.save();
  ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, DW, DH);
  ctx.restore();
}

// 三层星点：远景(极小暗多) / 中景(适中) / 近景(少稍大带柔光星芒)
function drawStarField(ctx, star){
  const rng = mulberry32(hashString((star && star.catalogNo || 'star') + 'stars'));
  const stars = [];
  for (let i = 0; i < 300; i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 0.4 + rng()*0.6, a: 0.10 + rng()*0.22, far: true });
  for (let i = 0; i < 70;  i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 1.0 + rng()*0.9, a: 0.35 + rng()*0.40, mid: true });
  for (let i = 0; i < 14;  i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 2.0 + rng()*1.6, a: 0.60 + rng()*0.35, near: true });

  stars.forEach(s => {
    const warm = rng() > 0.85;
    const col = warm ? `rgba(255,228,190,${s.a})` : `rgba(224,234,255,${s.a})`;
    if (s.near){
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      [0, Math.PI/2, Math.PI, 3*Math.PI/2].forEach(ang => {
        const ex = s.x + Math.cos(ang) * s.r * 5, ey = s.y + Math.sin(ang) * s.r * 5;
        const lg = ctx.createLinearGradient(s.x, s.y, ex, ey);
        lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ex, ey); ctx.stroke();
      });
      ctx.restore();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  });
}

function makeNebulaTexture(){
  const S = 320;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const x = cv.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  const rng = mulberry32(hashString('nebtex'));
  const cols = ['rgba(120,100,180,0.5)','rgba(70,110,180,0.5)','rgba(150,110,180,0.5)','rgba(90,130,170,0.5)'];
  for (let i = 0; i < 70; i++){
    const cx = rng()*S, cy = rng()*S, r = 20 + rng()*90;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const c = cols[Math.floor(rng()*cols.length)];
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  return cv;
}

// ============================================================
// 标题区
// ============================================================
function drawEyebrow(ctx){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.gold; ctx.globalAlpha = 0.82;
  setFont(ctx, '500 15px "Space Grotesk", "Noto Serif SC", serif');
  ctx.letterSpacing = '6px';
  ctx.fillText('STAR & SKY  ·  星与星空', DW/2, 86);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

function drawTitle(ctx){
  ctx.save();
  ctx.textAlign = 'center';
  setFont(ctx, '600 60px "Noto Serif SC", serif');
  ctx.fillStyle = C.gold;
  ctx.letterSpacing = '8px';
  ctx.fillText(t('星球认领证书'), DW/2, 156);
  ctx.letterSpacing = '0px';
  setFont(ctx, '400 19px "Cormorant Garamond", "Times New Roman", serif');
  ctx.fillStyle = C.goldB; ctx.globalAlpha = 0.9;
  ctx.letterSpacing = '4px';
  ctx.fillText('PLANET CLAIM CERTIFICATE', DW/2, 188);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(DW/2 - 60, 210); ctx.lineTo(DW/2 + 60, 210); ctx.stroke();
  [DW/2 - 60, DW/2 + 60].forEach(x=>{
    ctx.save(); ctx.translate(x, 210); ctx.rotate(Math.PI/4);
    ctx.fillStyle = C.gold; ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  });
  ctx.restore();
}

// ============================================================
// 星球档案组件（核心）
// ============================================================
function drawPlanetAssembly(ctx, cx, cy, R, star){
  // 1) 星座连线（背景，星球两侧空白区）
  drawConstellationCluster(ctx, 175, 580, 5, starSeedKey(star) + 'cl');
  drawConstellationCluster(ctx, 1045, 580, 5, starSeedKey(star) + 'cr');

  // 2) 外圈圆形刻度盘（完整圆，位于星球之后、卡片之前）
  drawDial(ctx, cx, cy, R, star);

  // 3) 土星环后半（星球之后）
  drawSaturnRing(ctx, cx, cy, R, 'back');

  // 4) 中心星球本体 + 环境光晕
  drawCelestialBody(ctx, cx, cy, R, star);

  // 5) 土星环前半（星球之前，形成遮挡）
  drawSaturnRing(ctx, cx, cy, R, 'front');
}

// 圆形刻度盘：细金双圈 + 刻度线 + 星座名标注 + 顶部菱形
function drawDial(ctx, cx, cy, R, star){
  const rOut = R * 1.26, rIn = R * 1.12;
  ctx.save();
  ctx.strokeStyle = 'rgba(207,168,106,0.55)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy, rOut, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(207,168,106,0.32)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rIn, 0, Math.PI*2); ctx.stroke();

  const N = 96;
  for (let i = 0; i < N; i++){
    const a = i / N * Math.PI * 2;
    const major = (i % 8 === 0);
    const r1 = rOut, r2 = rOut - (major ? 15 : 7);
    ctx.strokeStyle = major ? 'rgba(231,201,138,0.9)' : 'rgba(207,168,106,0.45)';
    ctx.lineWidth = major ? 1.8 : 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a)*r1, cy + Math.sin(a)*r1);
    ctx.lineTo(cx + Math.cos(a)*r2, cy + Math.sin(a)*r2);
    ctx.stroke();
  }

  // 星座名标注（贴在刻度盘外缘，分布在上 220° 弧，避免被底部卡片覆盖）
  const names = ['LYRA','CYGNUS','DRACO','HERCULES','ORION','TAURUS','ANDROMEDA','PERSEUS'];
  setFont(ctx, '10px "Space Grotesk", monospace');
  ctx.fillStyle = 'rgba(228,236,255,0.72)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lr = rOut + 15;
  const span = 170, mid = -90;   // 上 170° 弧，避开底部卡片与左右星座簇
  for (let i = 0; i < names.length; i++){
    const a = (mid + (i - (names.length - 1) / 2) * (span / (names.length - 1))) * Math.PI / 180;
    ctx.fillText(names[i], cx + Math.cos(a)*lr, cy + Math.sin(a)*lr);
  }
  // 顶部菱形
  drawDiamond(ctx, cx, cy - rIn, 6, C.gold);
  ctx.restore();
}

// 土星式行星环：倾斜椭圆，2~3 条带，带辉光；后半在星球后、前半在星球前
function drawSaturnRing(ctx, cx, cy, R, pass){
  const tilt = -0.22;   // 左低右高
  const rings = [
    { rx: R*1.55, ry: R*0.30, w: 18, b: 1.0 },   // 主亮环
    { rx: R*1.68, ry: R*0.325, w: 7,  b: 0.6 },  // 副环 1
    { rx: R*1.80, ry: R*0.348, w: 3,  b: 0.4 },  // 副环 2
  ];
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(tilt);
  // 辉光（仅在后半绘制一次，置于星球之后）
  if (pass === 'back'){
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, 0, R*0.9, 0, 0, R*1.9);
    g.addColorStop(0, 'rgba(231,201,138,0)');
    g.addColorStop(0.5, 'rgba(231,201,138,0.10)');
    g.addColorStop(1, 'rgba(231,201,138,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R*1.9, R*0.62, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // 将后半环裁切到星球圆盘之外：确保被星球利落遮断（在星球边缘处明确断开）
    ctx.beginPath();
    ctx.rect(-2200, -2200, 4400, 4400);
    ctx.arc(0, 0, R, 0, Math.PI*2);
    ctx.clip('evenodd');
  }
  rings.forEach(rg => drawRingBand(ctx, rg, pass));
  ctx.restore();
}

function drawRingBand(ctx, rg, pass){
  const { rx, ry, w, b } = rg;
  const a0 = pass === 'back' ? Math.PI : 0;
  const a1 = pass === 'back' ? Math.PI*2 : Math.PI;
  // 后半（星球之后）明显更暗，体现纵深；前半（星球之前）明亮
  const pa = pass === 'back' ? 0.34 : 1.0;
  // 外暗金
  ctx.strokeStyle = `rgba(150,110,60,${0.5*b*pa})`; ctx.lineWidth = w;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
  // 主亮金
  ctx.strokeStyle = `rgba(226,196,128,${0.85*b*pa})`; ctx.lineWidth = w*0.6;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
  // 内高光（亮白金）
  ctx.strokeStyle = `rgba(255,240,210,${0.7*b*pa})`; ctx.lineWidth = w*0.16;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
  // 环缝纹理（几条更细的暗线，营造分层）
  ctx.strokeStyle = `rgba(110,80,45,${0.4*b*pa})`; ctx.lineWidth = 1;
  [0.86, 0.93, 0.98].forEach(f => {
    ctx.beginPath(); ctx.ellipse(0, 0, rx*f, ry*f, 0, a0, a1); ctx.stroke();
  });
}

// 星座连线图：金色连线 + 星点 + 极小坐标标注（背景装饰）
function drawConstellationCluster(ctx, bx, by, n, seed){
  const rng = mulberry32(hashString(seed));
  const pts = [];
  let x = bx, y = by;
  for (let i = 0; i < n; i++){
    pts.push([x, y]);
    x += (rng() - 0.3) * 72; y += (rng() - 0.5) * 72;
    x = Math.max(120, Math.min(DW - 120, x));
    y = Math.max(300, Math.min(820, y));
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(226,206,150,0.42)'; ctx.lineWidth = 1;
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke();
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p[0], p[1], i === 0 ? 3 : 2, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,242,205,${i === 0 ? 0.9 : 0.7})`; ctx.fill();
  });
  ctx.fillStyle = 'rgba(170,190,255,0.4)';
  setFont(ctx, '8px "Space Grotesk", monospace');
  ctx.fillText((rng()*24).toFixed(1) + 'h', pts[0][0] + 5, pts[0][1] - 4);
  ctx.restore();
}

// 中心星球本体：与 3D 认星页共用 bodyTexture 表面
function drawCelestialBody(ctx, cx, cy, r, star){
  const surface = getBodySurface(star);
  drawAmbientHalo(ctx, cx, cy, r, surface.profile);
  drawBodyGlow(ctx, cx, cy, r, surface.profile);
  drawLitSphere(ctx, cx, cy, r, surface);
}

function drawAmbientHalo(ctx, cx, cy, r, profile){
  const atmo = profile.atmo;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const R = r * 1.55;
  const g = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, R);
  g.addColorStop(0,   rgba(atmo, 0));
  g.addColorStop(0.22, rgba(atmo, 0.11));
  g.addColorStop(0.6, rgba(atmo, 0.05));
  g.addColorStop(1,   rgba(atmo, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBodyGlow(ctx, cx, cy, r, profile){
  const atmo = profile.atmo;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const R = r * (1.0 + profile.glowScale * 0.5);
  const g = ctx.createRadialGradient(cx, cy, r * 0.62, cx, cy, R);
  g.addColorStop(0,   rgba(atmo, 0));
  g.addColorStop(0.55, rgba(atmo, 0.10 * profile.glowI));
  g.addColorStop(1,   rgba(atmo, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawLitSphere(ctx, cx, cy, r, surface){
  const W = surface.width, H = surface.imgH;
  const cctx = surface.color.getContext('2d');
  const cdata = cctx.getImageData(0, 0, W, H).data;
  const height = surface.heightField;
  const profile = surface.profile;
  const atmo = profile.atmo;

  const d = Math.ceil(r*2) + 4;
  const img = ctx.createImageData(d, d); const data = img.data;
  let Lx = -0.45, Ly = 0.50, Lz = 0.74;
  const ll = Math.hypot(Lx, Ly, Lz); Lx/=ll; Ly/=ll; Lz/=ll;

  const colAt = (u, v) => {
    const x = Math.max(0, Math.min(W-1, Math.round(u * W - 0.5)));
    const y = Math.max(0, Math.min(H-1, Math.round((1 - v) * H - 0.5)));
    const i = (y * W + x) * 4;
    return [cdata[i], cdata[i+1], cdata[i+2]];
  };
  const hAt = (u, v) => {
    const x = Math.max(0, Math.min(W-1, Math.round(u * W - 0.5)));
    const y = Math.max(0, Math.min(H-1, Math.round((1 - v) * H - 0.5)));
    return height[y * W + x];
  };

  for (let py = 0; py < d; py++){
    for (let px = 0; px < d; px++){
      const o = (py*d + px)*4;
      const dx = px - r, dy = py - r, dist = Math.hypot(dx, dy);
      if (dist > r){ data[o+3] = 0; continue; }
      const nx = dx/r, ny = dy/r, nz = Math.sqrt(Math.max(0, 1 - nx*nx - ny*ny));
      const uv = uvFromDir(nx, ny, nz);
      const u = uv[0], v = uv[1];
      const base = colAt(u, v);
      const e = 0.0045;
      const hL = hAt(u-e, v), hR = hAt(u+e, v), hD = hAt(u, v-e), hU = hAt(u, v+e);
      const sx = (hL - hR) * 2.4, sy = (hD - hU) * 2.4;
      let Nx = nx - sx, Ny = ny - sy, Nz = nz;
      const nl = Math.hypot(Nx, Ny, Nz) || 1; Nx/=nl; Ny/=nl; Nz/=nl;
      const ndl = Nx*Lx + Ny*Ly + Nz*Lz;
      const day = smoothstep(-0.15, 0.5, ndl);
      const lit = 0.10 + day * 0.95;
      let R = base[0]*lit, G = base[1]*lit, B = base[2]*lit;
      const fres = Math.pow(Math.max(0, 1 - nz), 2.2);
      R += atmo[0]*fres*0.55; G += atmo[1]*fres*0.55; B += atmo[2]*fres*0.55;
      const spec = Math.pow(Math.max(0, ndl), 20) * 0.22;
      R += 255*spec; G += 255*spec; B += 255*spec;
      const aa = smoothstep(r+1.2, r-1.2, dist);
      data[o]=clamp255(R); data[o+1]=clamp255(G); data[o+2]=clamp255(B); data[o+3]=Math.round(255*aa);
    }
  }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  ctx.drawImage(toOffscreen(img, d), cx - r - 2, cy - r - 2, d, d);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = rgba(atmo, 0.45); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

// ============================================================
// 羊皮纸信息卡（古典证书语言）
// ============================================================
function drawParchmentCard(ctx, star, kd){
  const x0 = 110, y0 = 862, w = 1020, h = 520;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 12;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
  roundRectPath(ctx, x0, y0, w, h, 14);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';

  // 上下皮封边（深色皮质翻折感）
  drawCardBand(ctx, x0, y0, w, h);

  if (grainTile){
    ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
    roundRectPath(ctx, x0, y0, w, h, 14); ctx.fill(); ctx.restore();
  }

  // 金双线边框
  ctx.strokeStyle = P.gold; ctx.lineWidth = 2.4;
  roundRectPath(ctx, x0 + 12, y0 + 12, w - 24, h - 24, 10); ctx.stroke();
  ctx.strokeStyle = P.gold2; ctx.lineWidth = 1;
  roundRectPath(ctx, x0 + 20, y0 + 20, w - 40, h - 40, 8); ctx.stroke();

  // 四角 L 形金饰
  drawCardCorners(ctx, x0, y0, w, h);

  // 文案（居中，注册人为视觉焦点）
  const cx = DW / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let y = y0 + 54;
  setFont(ctx, '500 16px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '3px';
  ctx.fillText(t('兹证明 · 此星已被正式认领'), cx, y); ctx.letterSpacing = '0px';
  y += 38;
  setFont(ctx, '500 16px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '2px';
  ctx.fillText(t('星球名称'), cx, y); ctx.letterSpacing = '0px';
  y += 36;
  setFont(ctx, '600 30px "Noto Serif SC", serif'); ctx.fillStyle = P.ink;
  ctx.fillText(star.name || '—', cx, y);
  y += 24; drawDiamond(ctx, cx, y, 5, P.gold); y += 34;
  setFont(ctx, '500 16px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '2px';
  ctx.fillText(t('注册人'), cx, y); ctx.letterSpacing = '0px';
  y += 52;
  setFont(ctx, '700 44px "Noto Serif SC", serif'); ctx.fillStyle = P.ink;
  ctx.fillText((kd && kd.ruler) || t('星际公民'), cx, y);
  y += 30;
  ctx.strokeStyle = P.gold; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 100, y); ctx.lineTo(cx + 100, y); ctx.stroke();

  drawParamTable(ctx, star, y + 40);
  drawRibbon(ctx, star, y0 + h - 52);
  ctx.restore();
}

function drawCardBand(ctx, x0, y0, w, h){
  const bh = 26;
  let g = ctx.createLinearGradient(0, y0, 0, y0 + bh);
  g.addColorStop(0, P.band); g.addColorStop(1, 'rgba(120,86,40,0)');
  ctx.fillStyle = g; ctx.fillRect(x0 + 12, y0 + 12, w - 24, bh);
  let g2 = ctx.createLinearGradient(0, y0 + h, 0, y0 + h - bh);
  g2.addColorStop(0, P.band); g2.addColorStop(1, 'rgba(120,86,40,0)');
  ctx.fillStyle = g2; ctx.fillRect(x0 + 12, y0 + h - 12 - bh, w - 24, bh);
}

function drawCardCorners(ctx, x0, y0, w, h){
  const m = 22, len = 34;
  const pts = [[x0 + m, y0 + m, 1, 1], [x0 + w - m, y0 + m, -1, 1],
              [x0 + m, y0 + h - m, 1, -1], [x0 + w - m, y0 + h - m, -1, -1]];
  ctx.save(); ctx.strokeStyle = P.gold; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  pts.forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * len); ctx.lineTo(x, y); ctx.lineTo(x + sx * len, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + sx * (len - 6), y + sy * (len - 6), 2.2, 0, Math.PI*2); ctx.fillStyle = P.gold; ctx.fill();
  });
  ctx.restore();
}

function drawParamTable(ctx, star, y){
  const colL = DW / 2 - 300, colR = DW / 2 + 30;
  const left = [[t('赤经 RA'), raStr(star)], [t('赤纬 Dec'), decStr(star)],
                [t('视星等'), magStr(star)], [t('注册时间'), claimDateTime()]];
  const right = [[t('光谱类型'), specStr(star)], [t('距离地球'), star.distance || '—'],
                 [t('所属星座'), star.constellation || '—'], [t('证书编号'), star.registry || star.catalogNo || '—']];
  const rowH = 42;
  left.forEach(([k, v], i) => drawParamRow(ctx, colL, y + i * rowH, k, v));
  right.forEach(([k, v], i) => drawParamRow(ctx, colR, y + i * rowH, k, v));
}

function drawParamRow(ctx, x, y, k, v){
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  setFont(ctx, '600 17px "Noto Serif SC", serif'); ctx.fillStyle = P.label;
  ctx.fillText(k, x, y);
  const kw = ctx.measureText(k).width;
  setFont(ctx, '400 18px "Noto Serif SC", serif'); ctx.fillStyle = P.ink;
  ctx.fillText(v, x + kw + 8, y);
}

function drawRibbon(ctx, star, cy){
  const txt = star.registry || star.catalogNo || '—';
  setFont(ctx, '700 22px "Cormorant Garamond", "Noto Serif SC", serif');
  const tw = ctx.measureText(txt).width;
  const bw = tw + 96, bh = 44;
  const bx = DW / 2 - bw / 2, by = cy - bh / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = P.gold;
  ctx.beginPath();
  ctx.moveTo(bx + 14, by); ctx.lineTo(bx + bw - 14, by);
  ctx.lineTo(bx + bw, by + bh / 2); ctx.lineTo(bx + bw - 14, by + bh);
  ctx.lineTo(bx + 14, by + bh); ctx.lineTo(bx, by + bh / 2);
  ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#fff8e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, DW / 2, cy + 1);
  ctx.restore();
}

// ============================================================
// 页脚：深蓝区（圆形注册徽章 + 寄语 + 二维码）
// ============================================================
function drawFooter(ctx, star, kd){
  // 顶部细金分隔线
  ctx.strokeStyle = 'rgba(207,168,106,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(160, 1450); ctx.lineTo(DW - 160, 1450); ctx.stroke();

  drawSeal(ctx, 232, 1608, 80, star);

  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.gold;
  setFont(ctx, 'italic 400 21px "Noto Serif SC", serif');
  ctx.fillText(t('仰望星辰，不是为了拥有，'), 630, 1600);
  ctx.fillText(t('而是为了让记忆在宇宙中有坐标。'), 630, 1632);
  ctx.restore();

  let link = '';
  try { if (star){ const code = encodeStar(star, kd || {}); link = qrLinkForStar(code); } } catch(e){ link = ''; }
  drawQR(ctx, 1008, 1604, 116, link);
}

function drawSeal(ctx, cx, cy, r, star){
  ctx.save();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r - 6, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 1;

  drawArcText(ctx, 'PLANET REGISTRY', cx, cy, r - 20, Math.PI*1.20, Math.PI*1.80, false);
  drawArcText(ctx, '星球注册档案章', cx, cy, r - 20, Math.PI*0.20, Math.PI*0.80, true);

  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.4);
  ctx.strokeStyle = C.gold; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 7, 0, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawQR(ctx, cx, cy, size, link){
  const x0 = cx - size / 2, y0 = cy - size / 2;
  roundRectPath(ctx, x0 - 7, y0 - 7, size + 14, size + 14, 10);
  ctx.fillStyle = '#fbfbf7'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.fillStyle = '#1c2026';
  const canReal = (typeof window !== 'undefined') && typeof window.qrcode === 'function' && !!link;
  if (canReal){
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(link); qr.make();
      const count = qr.getModuleCount();
      const quiet = 2;
      const total = count + quiet * 2;
      const cell = size / total;
      const ox = x0 + (size - cell * total) / 2;
      const oy = y0 + (size - cell * total) / 2;
      for (let r = 0; r < count; r++) for (let c = 0; c < count; c++){
        if (qr.isDark(r, c)) ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell + 0.6, cell + 0.6);
      }
    } catch(e){
      decorativeQR(ctx, x0, y0, size);
    }
  } else {
    decorativeQR(ctx, x0, y0, size);
  }
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.gold; ctx.globalAlpha = 0.9;
  setFont(ctx, '400 13px "Noto Serif SC", serif');
  ctx.fillText(t('扫码分享这颗星球记录'), cx, cy + size / 2 + 22);
  ctx.restore();
}

function decorativeQR(ctx, x0, y0, size){
  const n = 21, cell = size / n;
  const rng = mulberry32(hashString('qr-fallback'));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++){
    if (rng() > 0.52) ctx.fillRect(x0 + c * cell, y0 + r * cell, cell * 0.92, cell * 0.92);
  }
  drawFinder(ctx, x0, y0, cell);
  drawFinder(ctx, x0 + (n - 7) * cell, y0, cell);
  drawFinder(ctx, x0, y0 + (n - 7) * cell, cell);
}

function drawFinder(ctx, x, y, cell){
  ctx.fillStyle = '#1c2026'; ctx.fillRect(x, y, cell * 7, cell * 7);
  ctx.fillStyle = '#fbfbf7'; ctx.fillRect(x + cell, y + cell, cell * 5, cell * 5);
  ctx.fillStyle = '#1c2026'; ctx.fillRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3);
}

function drawDiamond(ctx, cx, cy, r, col){
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = col; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
}

function drawArcText(ctx, text, cx, cy, r, a0, a1, flip){
  const n = text.length;
  setFont(ctx, '500 12px "Noto Serif SC", serif');
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

function raStr(star){
  const ra = star.ra; if (ra == null) return '—';
  const h = (((ra % 360) + 360) % 360) / 15;
  const rh = Math.floor(h), rm = Math.floor((h - rh) * 60);
  return String(rh).padStart(2, '0') + 'h' + String(rm).padStart(2, '0') + 'm';
}
function decStr(star){
  const dec = star.dec; if (dec == null) return '—';
  const sign = dec >= 0 ? '+' : '−';
  const a = Math.abs(dec), d = Math.floor(a), m = Math.floor((a - d) * 60);
  return sign + String(d).padStart(2, '0') + '°' + String(m).padStart(2, '0') + '′';
}
function magStr(star){
  const mag = star.mag; if (mag == null) return '—';
  return (mag >= 0 ? '+' : '') + Number(mag).toFixed(2);
}
function specStr(star){
  const s = star.spec, n = star.specName;
  if (!s && !n) return '—';
  return [s, n].filter(Boolean).join(' · ');
}

function claimDateTime(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth()+1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}
function starSeedKey(star){ return (star && (star.catalogNo || star.name)) || 'star'; }

function setFont(ctx, f){ ctx.font = f; }

function toOffscreen(img, d){
  const off = document.createElement('canvas'); off.width = d; off.height = d;
  off.getContext('2d').putImageData(img, 0, 0);
  return off;
}
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
