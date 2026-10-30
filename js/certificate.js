// 星球认领证书 —— 单张高分辨率 canvas 绘制（按《星球认领证书｜通用视觉规范》重构）
// 版本：9:12 竖版 · 深空档案风 · 版式骨架锁死，仅星球/名称/注册信息可变
// 中心星球与 3D 认星页共用同一套 bodyTexture 表面，保证证书星 == 网页「认领的星星」。
import { hashString, mulberry32 } from './rng.js?v=20261048';
import { shareLink, encodeStar, qrLinkForStar } from './share.js?v=20261048';
import { getBodySurface, uvFromDir } from './bodyTexture.js?v=20261048';
import { t } from './i18n.js?v=20261048';
import { localizedSpecName } from './starData.js?v=20261048';

// ===== 画布：9:12 竖版（3:4）=====
const DW = 1240, DH = 1653;   // 设计尺寸（3:4）
const K = 2;                  // 内部分辨率倍数

let grainTile = null;          // 证书底纹噪点（缓存）
let nebTex = null;             // 星云纹理 tile（缓存）

// ===== 全局配色（固定色卡，所有证书共用）=====
const C = {
  bgTop:  '#0a0e22',          // 深空背景（保持 #080B1A 基调，不换成纯黑/浅蓝）
  bgMid:  '#080B1A',
  bgBot:  '#05070f',
  gold:   '#C8A86E',          // 主金色（文字 / 边框 / 星环）
  goldB:  '#E7D2A0',          // 浅金（英文副标题）
  ink:    '#ECE4D0',          // 深空区浅色文字
  gray:   '#7A7468',          // 辅助文字灰
};

// 信息卡（象牙米 + 哑光金）
const P = {
  bg1:   '#F8F2E4',
  bg2:   '#EDE4D2',
  ink:   '#2b2718',           // 卡片主文字（深墨）
  name:  '#7c5e22',           // 卡片主名称（深青铜金，保证可读）
  label: '#7A7468',           // 辅助小字灰
  gold:  '#C8A86E',           // 卡片金线 / 封签
  goldD: '#9a7a30',           // 封签深金
  line:  'rgba(200,168,110,0.45)',
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

    // —— 固定分区：标题 20% / 星球 38% / 卡片 30% / 页脚 12% ——
    drawBackground(ctx, star);
    drawEyebrow(ctx);
    drawTitle(ctx);

    const cx = DW / 2, cy = 636, R = 205;   // 星球主体：占比锁定
    drawPlanetAssembly(ctx, cx, cy, R, star);

    const card = { x0: 110, y0: 945, w: 1020, h: 500 };
    drawInfoCard(ctx, card, star, kd);

    drawFooter(ctx, star, kd);
  }

  function download(star){
    if (!canvas) return;
    let dataUrl;
    try { dataUrl = canvas.toDataURL('image/png'); }
    catch (e){ toast(t('生成失败，请重试')); console.error(e); return; }

    // 移动端 / 微信：a.download 被拦截 → 内联图片，用户长按保存至相册
    const ua = navigator.userAgent || '';
    const isTouch = /Mobi|Android|iPhone|iPad|iPod|MicroMessenger/i.test(ua)
      || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (isTouch){
      const lb = document.getElementById('cert-lightbox');
      const img = document.getElementById('cert-lightbox-img');
      if (lb && img){
        img.src = dataUrl;
        lb.hidden = false;
        toast(t('长按图片即可保存到手机相册') + ' ✦');
        return;
      }
    }

    // 桌面端：传统文件下载
    try {
      const link = document.createElement('a');
      link.download = `星球认领证书_${star.name}.png`;
      link.href = dataUrl;
      link.click();
      toast(t('星图已保存，去分享吧 ✦'));
    } catch (e){
      toast(t('生成失败，请重试'));
      console.error(e);
    }
  }

  // 长按保存灯箱：关闭 / 点击遮罩关闭
  const lb = document.getElementById('cert-lightbox');
  const lbInner = document.getElementById('clb-inner');
  const lbClose = document.getElementById('clb-close');
  if (lb){
    const closeLb = ()=>{ lb.hidden = true; const im = document.getElementById('cert-lightbox-img'); if (im) im.src = ''; };
    if (lbClose) lbClose.addEventListener('click', closeLb);
    lb.addEventListener('click', (e)=>{ if (!lbInner || !lbInner.contains(e.target)) closeLb(); });
  }

  return { build, download };
}

// ============================================================
// 背景：深空底色 #080B1A + 极轻星云 + 三层星点（远/中/近）+ 轻暗角
// ============================================================
function drawBackground(ctx, star){
  const bg = ctx.createLinearGradient(0, 0, 0, DH);
  bg.addColorStop(0,   C.bgTop);
  bg.addColorStop(0.5, C.bgMid);
  bg.addColorStop(1,   C.bgBot);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, DW, DH);

  // 仅边缘极轻星云（主体区保持干净深空，不被白雾覆盖）
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const corners = [
    [80, 90, 'rgba(82,64,128,0.12)'],
    [DW - 90, 100, 'rgba(58,84,150,0.10)'],
    [90, DH - 120, 'rgba(96,64,140,0.07)'],
    [DW - 100, DH - 120, 'rgba(50,80,140,0.07)'],
  ];
  corners.forEach(([x, y, col]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 560);
    g.addColorStop(0,   col);
    g.addColorStop(0.6, col.replace(/[\d.]+\)$/, '0.02)'));
    g.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH);
  });
  if (!nebTex) nebTex = makeNebulaTexture();
  ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(nebTex, 'repeat');
  ctx.fillRect(0, 0, DW, DH);
  ctx.restore();

  // 轻暗角（压住四角，强化纵深，但比旧版更淡，消除雾感）
  const vig = ctx.createRadialGradient(DW/2, DH*0.42, DH*0.30, DW/2, DH*0.5, DH*0.92);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.72, 'rgba(0,0,0,0.22)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, DW, DH);

  drawStarField(ctx, star);

  if (!grainTile) grainTile = makeGrain();
  ctx.save();
  ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, DW, DH);
  ctx.restore();
}

// 三层星点：远景(极小暗多) / 中景(适中白) / 近景(少稍大带柔光星芒)
// 星球主体附近星点适当减少，避免和星球纹理打架
function drawStarField(ctx, star){
  const cx = DW/2, cy = 636, R = 205, guard = R * 1.7;
  const rng = mulberry32(hashString((star && star.catalogNo || 'star') + 'stars'));
  const stars = [];
  // 远景：极小、很暗、数量多 → 纵深底噪，不抢主体
  for (let i = 0; i < 360; i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 0.3 + rng()*0.5, a: 0.05 + rng()*0.13, far: true });
  // 中景：为主体，适中亮度
  for (let i = 0; i < 72;  i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 0.9 + rng()*1.0, a: 0.34 + rng()*0.42, mid: true });
  // 近景：极少、稍大、带柔和光晕，避免平均散点感
  for (let i = 0; i < 10;  i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 2.2 + rng()*1.8, a: 0.55 + rng()*0.35, near: true });

  stars.forEach(s => {
    const dxp = s.x - cx, dyp = s.y - cy;
    if (Math.hypot(dxp, dyp) < guard) return;   // 星球附近留白
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
// 顶部标题区（固定模板）
// ============================================================
function drawEyebrow(ctx){
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.gold; ctx.globalAlpha = 0.9;
  setFont(ctx, '400 16px "Space Grotesk", monospace');  // 英文小字：细字重，精致对比
  ctx.letterSpacing = '5px';
  ctx.fillText('STAR & SKY · PLANET CLAIM CERTIFICATE', DW/2, 86);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

function drawTitle(ctx){
  const cx = DW/2;
  ctx.save();
  ctx.textAlign = 'center';
  // 主标题：更有力量的宋体、字重加粗至 900；宽度收紧至约星球直径的 60%（比例协调，不压星球）
  setFont(ctx, '900 38px "Noto Serif SC", serif');
  ctx.fillStyle = C.gold;
  ctx.letterSpacing = '4px';
  ctx.fillText(t('星球认领证书'), cx, 170);
  ctx.letterSpacing = '0px';
  // 英文副标题：细字重，放大形成精致对比
  setFont(ctx, '400 22px "Cormorant Garamond", "Times New Roman", serif');
  ctx.fillStyle = C.goldB; ctx.globalAlpha = 0.92;
  ctx.letterSpacing = '4px';
  ctx.fillText('PLANET CLAIM CERTIFICATE', cx, 208);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
  // 分隔线 + 菱形
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx - 64, 230); ctx.lineTo(cx + 64, 230); ctx.stroke();
  [cx - 64, cx + 64].forEach(x=>{
    ctx.save(); ctx.translate(x, 230); ctx.rotate(Math.PI/4);
    ctx.fillStyle = C.gold; ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
  });
  ctx.restore();
}

// ============================================================
// 星球档案组件（核心）：星座连线 → 外圈刻度盘 → 星环后半 → 星球 → 星环前半
// ============================================================
function drawPlanetAssembly(ctx, cx, cy, R, star){
  drawConstellationCluster(ctx, 200, 600, 5, starSeedKey(star) + 'cl');
  drawConstellationCluster(ctx, 1040, 600, 5, starSeedKey(star) + 'cr');

  drawDial(ctx, cx, cy, R, star);              // 外圈星座刻度环（档案框架，永远保留）
  drawSaturnRing(ctx, cx, cy, R, 'back');      // 星环后半（星球之后）
  drawCelestialBody(ctx, cx, cy, R, star);     // 中心星球本体 + 大气光晕
  drawSaturnRing(ctx, cx, cy, R, 'front');     // 星环前半（星球之前，遮挡）
}

// 外圈圆形刻度盘：细金双圈 + 刻度线 + 星座名标注（固定，与星球无关）
function drawDial(ctx, cx, cy, R, star){
  const rOut = R * 1.26, rIn = R * 1.12;
  ctx.save();
  ctx.strokeStyle = 'rgba(200,168,110,0.55)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy, rOut, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,168,110,0.32)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rIn, 0, Math.PI*2); ctx.stroke();

  const N = 96;
  for (let i = 0; i < N; i++){
    const a = i / N * Math.PI * 2;
    const major = (i % 8 === 0);
    const r1 = rOut, r2 = rOut - (major ? 15 : 7);
    ctx.strokeStyle = major ? 'rgba(231,210,160,0.9)' : 'rgba(200,168,110,0.45)';
    ctx.lineWidth = major ? 1.8 : 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a)*r1, cy + Math.sin(a)*r1);
    ctx.lineTo(cx + Math.cos(a)*r2, cy + Math.sin(a)*r2);
    ctx.stroke();
  }

  // 星座名标注（贴刻度盘外缘，固定在上弧，避开底部卡片）
  const names = ['LYRA','CYGNUS','DRACO','HERCULES','ORION','TAURUS','ANDROMEDA','PERSEUS'];
  setFont(ctx, '10px "Space Grotesk", monospace');
  ctx.fillStyle = 'rgba(228,236,255,0.72)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lr = rOut + 16;
  const span = 170, mid = -90;
  for (let i = 0; i < names.length; i++){
    const a = (mid + (i - (names.length - 1) / 2) * (span / (names.length - 1))) * Math.PI / 180;
    ctx.fillText(names[i], cx + Math.cos(a)*lr, cy + Math.sin(a)*lr);
  }
  drawDiamond(ctx, cx, cy - rIn, 6, C.gold);
  ctx.restore();
}

// 星环：固定倾斜椭圆（非正圆），金色体系；后半在星球后、前半在星球前形成环绕立体感
function drawSaturnRing(ctx, cx, cy, R, pass){
  const tilt = -0.22;   // 固定倾角（左低右高）
  const rings = [
    { rx: R*1.55, ry: R*0.30, w: 18, b: 1.0 },
    { rx: R*1.68, ry: R*0.325, w: 7,  b: 0.6 },
    { rx: R*1.80, ry: R*0.348, w: 3,  b: 0.4 },
  ];
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(tilt);
  if (pass === 'back'){
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, 0, R*0.9, 0, 0, R*1.9);
    g.addColorStop(0, 'rgba(200,168,110,0)');
    g.addColorStop(0.5, 'rgba(200,168,110,0.10)');
    g.addColorStop(1, 'rgba(200,168,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R*1.9, R*0.62, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // 后半环裁切到星球圆盘之外：被星球利落遮断
    ctx.beginPath();
    ctx.rect(-2200, -2200, 4400, 4400);
    ctx.arc(0, 0, R, 0, Math.PI*2);
    ctx.clip('evenodd');
  }
  rings.forEach(rg => drawRingBand(ctx, rg, pass));
  rings.forEach(rg => drawRingDecorations(ctx, rg, pass));
  ctx.restore();
}

// 星环刻度 / 坐标节点 / 短辅助线：让星环成为“宇宙坐标系统”的一部分
// 后半（星球之后）更淡、被星球利落遮断；前半（星球之前）清晰
function drawRingDecorations(ctx, rg, pass){
  const { rx, ry, w, b } = rg;
  const back = (pass === 'back');
  const a0 = back ? Math.PI : 0, a1 = back ? Math.PI*2 : Math.PI;  // 后半=上半(在星球后)，前半=下半(在星球前)
  const pa = back ? 0.30 : 1.0;
  const N = 56;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i <= N; i++){
    const a = a0 + (a1 - a0) * i / N;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ix = rx*ca, iy = ry*sa;                     // 椭圆上的点
    // 椭圆法向（朝向环厚度方向，用于刻度内外延伸）
    let nx = ry*ca, ny = rx*sa; const nl = Math.hypot(nx, ny) || 1; nx/=nl; ny/=nl;
    const major = (i % 5 === 0);
    const tlen = major ? 9 : 4;
    const ox = ix + nx*(w/2 + tlen), oy = iy + ny*(w/2 + tlen);
    const inx = ix - nx*(w/2 + tlen), iny = iy - ny*(w/2 + tlen);
    ctx.strokeStyle = `rgba(222,198,140,${ (major?0.62:0.35) * b * pa })`;
    ctx.lineWidth = major ? 1.1 : 0.6;
    ctx.beginPath(); ctx.moveTo(inx, iny); ctx.lineTo(ox, oy); ctx.stroke();
    if (major){
      // 坐标节点（环上小圆点）
      ctx.fillStyle = `rgba(255,238,202,${0.8*b*pa})`;
      ctx.beginPath(); ctx.arc(ix, iy, 1.7, 0, Math.PI*2); ctx.fill();
      // 短辅助线：沿环切线方向横跨带面
      const ta = a + (a1-a0)/N * 2.4;
      const tx = rx*Math.cos(ta), ty = ry*Math.sin(ta);
      ctx.strokeStyle = `rgba(200,168,110,${0.26*b*pa})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(tx, ty); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRingBand(ctx, rg, pass){
  const { rx, ry, w, b } = rg;
  const a0 = pass === 'back' ? Math.PI : 0;
  const a1 = pass === 'back' ? Math.PI*2 : Math.PI;
  const pa = pass === 'back' ? 0.34 : 1.0;   // 后半更暗，体现纵深
  ctx.strokeStyle = `rgba(150,110,60,${0.5*b*pa})`; ctx.lineWidth = w;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
  ctx.strokeStyle = `rgba(214,184,118,${0.85*b*pa})`; ctx.lineWidth = w*0.6;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
  ctx.strokeStyle = `rgba(255,240,210,${0.7*b*pa})`; ctx.lineWidth = w*0.16;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke();
  ctx.strokeStyle = `rgba(110,80,45,${0.4*b*pa})`; ctx.lineWidth = 1;
  [0.86, 0.93, 0.98].forEach(f => {
    ctx.beginPath(); ctx.ellipse(0, 0, rx*f, ry*f, 0, a0, a1); ctx.stroke();
  });
}

// 星座连线图：金色连线 + 星点（背景装饰，固定两侧）
function drawConstellationCluster(ctx, bx, by, n, seed){
  const rng = mulberry32(hashString(seed));
  const pts = [];
  let x = bx, y = by;
  for (let i = 0; i < n; i++){
    pts.push([x, y]);
    x += (rng() - 0.3) * 72; y += (rng() - 0.5) * 72;
    x = Math.max(120, Math.min(DW - 120, x));
    y = Math.max(360, Math.min(840, y));
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(214,194,138,0.42)'; ctx.lineWidth = 1;
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

// 极淡大气光晕（8%~12%，避免贴纸硬边）
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

// 统一光照：右前方打光（右半边亮、左半边暗，缓慢过渡）；冷调高光、暗部不死黑
function drawLitSphere(ctx, cx, cy, r, surface){
  const W = surface.width, H = surface.imgH;
  const cctx = surface.color.getContext('2d');
  const cdata = cctx.getImageData(0, 0, W, H).data;
  const height = surface.heightField;
  const profile = surface.profile;
  const atmo = profile.atmo;

  const d = Math.ceil(r*2) + 4;
  const img = ctx.createImageData(d, d); const data = img.data;
  let Lx = 0.50, Ly = 0.42, Lz = 0.76;          // 右前方光源（固定，不随星球变）
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
      const sx = (hL - hR) * 3.0, sy = (hD - hU) * 3.0;
      let Nx = nx - sx, Ny = ny - sy, Nz = nz;
      const nl = Math.hypot(Nx, Ny, Nz) || 1; Nx/=nl; Ny/=nl; Nz/=nl;
      const ndl = Nx*Lx + Ny*Ly + Nz*Lz;
      const day = smoothstep(-0.15, 0.5, ndl);
      const lit = 0.12 + day * 0.95;                  // 暗部保留微弱反光，不死黑
      let R = base[0]*lit, G = base[1]*lit, B = base[2]*lit;
      const fres = Math.pow(Math.max(0, 1 - nz), 2.2);  // 边缘冷调大气反光
      R += atmo[0]*fres*0.60; G += atmo[1]*fres*0.60; B += atmo[2]*fres*0.60;
      // 高光随星球色温：蓝星→冷蓝、红星→冷红，避免一律死白
      const specCol = mix3(atmo, [255,255,255], 0.45);
      const spec = Math.pow(Math.max(0, ndl), 18) * 0.26;
      R += specCol[0]*spec; G += specCol[1]*spec; B += specCol[2]*spec;
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
// 证书信息卡片（信封/档案袋效果：容器固定，仅文字动态替换）
// ============================================================
function drawInfoCard(ctx, card, star, kd){
  const { x0, y0, w, h } = card;
  const cx = x0 + w/2;
  ctx.save();

  // 厚度 + 右下柔和投影
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 34; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 16;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
  roundRectPath(ctx, x0, y0, w, h, 16);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';

  // 卡片内极低透明度星图线稿（统一，每张都有）
  drawCardStarMap(ctx, x0, y0, w, h);

  if (grainTile){
    ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
    roundRectPath(ctx, x0, y0, w, h, 16); ctx.fill(); ctx.restore();
  }

  // 1.5–2px 哑光金边框 + 内细线
  ctx.strokeStyle = P.gold; ctx.lineWidth = 2;
  roundRectPath(ctx, x0 + 10, y0 + 10, w - 20, h - 20, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,168,110,0.4)'; ctx.lineWidth = 1;
  roundRectPath(ctx, x0 + 18, y0 + 18, w - 36, h - 36, 9); ctx.stroke();

  // 四角 L 形金饰
  drawCardCorners(ctx, x0, y0, w, h);

  // 顶部中央金色封签（PLANET REGISTRY），压在顶边框上，制造密封档案感
  drawTopSeal(ctx, cx, y0, 'PLANET REGISTRY');

  // —— 文案（居中，层级：证明语 → 名称 → 国际命名 → 注册人 → 参数 → 编号）——
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let y = y0 + 62;
  setFont(ctx, '700 17px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '3px';
  ctx.fillText(t('兹证明 · 此星已被正式认领'), cx, y); ctx.letterSpacing = '0px';
  y += 36;
  setFont(ctx, '700 14px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '2px';
  ctx.fillText(t('星球名称'), cx, y); ctx.letterSpacing = '0px';
  y += 50;
  setFont(ctx, '700 50px "Noto Serif SC", serif'); ctx.fillStyle = P.name;   // 核心：最大字号（放大）
  ctx.fillText(star.name || '—', cx, y);
  y += 18; drawDiamond(ctx, cx, y, 4, P.gold); y += 20;
  // 国际命名：星球真实天文编号（如 Sirius · α CMa / HD 48915）
  // 一键认领时星名即国际通用名，避免与「星球名称」重复显示
  const showDesig = star.designation && star.designation !== star.name;
  if (showDesig){
    setFont(ctx, '700 13px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '2px';
    ctx.fillText(t('国际命名'), cx, y); ctx.letterSpacing = '0px';
    y += 26;
    setFont(ctx, '400 18px "Space Grotesk", monospace'); ctx.fillStyle = P.name;
    ctx.fillText(star.designation || star.catalogNo || '—', cx, y);
    y += 22;
  } else {
    y += 22;
  }
  setFont(ctx, '700 14px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '2px';
  ctx.fillText(t('注册人'), cx, y); ctx.letterSpacing = '0px';
  y += 46;
  setFont(ctx, '700 36px "Noto Serif SC", serif'); ctx.fillStyle = P.name;   // 第二层级（放大）
  ctx.fillText((kd && kd.ruler) || t('星际公民'), cx, y);
  y += 18;
  ctx.strokeStyle = P.gold; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 110, y); ctx.lineTo(cx + 110, y); ctx.stroke();

  // 参数表（左右两栏，固定布局）
  drawParamTable(ctx, card, y + 28, star);

  // 底部金色标签（证书编号短码），压在底边框上
  drawBottomLabel(ctx, cx, y0 + h, shortCode(star));

  // 右下角：签发人英文手写签名（淡金、若隐若现、轻微旋转；中英版本一致保持英文）
  drawSignature(ctx, card);

  ctx.restore();
}

// 右下角签发人签名：President: Leo Win —— 英文潦草手写体，深古铜金墨色清晰可读，轻微旋转
// 与卡片主名称同色系（#7c5e22），在象牙底上醒目但不刺眼；中英文版本均固定英文
function drawSignature(ctx, card){
  const { x0, y0, w, h } = card;
  const xR = x0 + w - 66;     // 右对齐锚点（避开右下角 L 形金饰，距卡右 66px）
  const yB = y0 + h - 46;     // 基线锚点（距卡底 46px）
  ctx.save();
  ctx.translate(xR, yB);
  ctx.rotate(-6 * Math.PI / 180);
  ctx.globalAlpha = 0.72;       // 清晰可辨：签名是认证标记，应能被辨认，仍保留手写墨迹的轻微通透
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  // 签名墨色：深古铜金（与卡片主名称同色系，象牙底上清晰可读）
  const ink = 'rgba(124,94,34,1)';   // #7c5e22 深青铜金
  // 小字标签：President:
  setFont(ctx, 'italic 600 15px "Cormorant Garamond", "Noto Serif SC", serif');
  ctx.fillStyle = ink;
  ctx.fillText('President:', 0, -8);
  // 手写签名正文：Leo Win（Dancing Script，跨设备一致；Mac 回退 Snell Roundhand）
  setFont(ctx, '600 46px "Dancing Script", "Snell Roundhand", "Brush Script MT", cursive');
  ctx.fillText('Leo Win', 0, 28);
  ctx.restore();
}

// 卡片内极低透明度“星图纸纹”：淡蓝坐标网格 + 淡金星座连线 + 少量星点
// 像从深空截取的星图档案纸，而非普通奖状底纹
function drawCardStarMap(ctx, x0, y0, w, h){
  const rng = mulberry32(hashString('card-starmap'));
  ctx.save();
  roundRectPath(ctx, x0 + 18, y0 + 18, w - 36, h - 36, 9); ctx.clip();
  // 极淡星图网格（蓝调，坐标纸质感）
  ctx.strokeStyle = 'rgba(120,150,190,0.06)'; ctx.lineWidth = 1;
  const step = 44;
  for (let gx = x0 + 18; gx < x0 + w - 18; gx += step){
    ctx.beginPath(); ctx.moveTo(gx, y0 + 18); ctx.lineTo(gx, y0 + h - 18); ctx.stroke();
  }
  for (let gy = y0 + 18; gy < y0 + h - 18; gy += step){
    ctx.beginPath(); ctx.moveTo(x0 + 18, gy); ctx.lineTo(x0 + w - 18, gy); ctx.stroke();
  }
  // 淡金星座连线（少量、很轻）
  ctx.strokeStyle = 'rgba(200,168,110,0.10)'; ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++){
    let px = x0 + 50 + rng() * (w - 100), py = y0 + 60 + rng() * (h - 120);
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let s = 0; s < 5; s++){
      px += (rng() - 0.5) * 220; py += (rng() - 0.5) * 170;
      px = Math.max(x0 + 30, Math.min(x0 + w - 30, px));
      py = Math.max(y0 + 30, Math.min(y0 + h - 30, py));
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // 少量星点（淡金）
  ctx.fillStyle = 'rgba(200,168,110,0.14)';
  for (let k = 0; k < 26; k++){
    const px = x0 + 40 + rng() * (w - 80), py = y0 + 40 + rng() * (h - 80);
    ctx.beginPath(); ctx.arc(px, py, 1.3, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// 顶部金封签（圆角小封签 / 火漆封印感）
function drawTopSeal(ctx, cx, y, text){
  const w = 232, ht = 40;
  const x = cx - w/2, yy = y - ht/2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(0, yy, 0, yy + ht);
  g.addColorStop(0, '#d8b765'); g.addColorStop(1, P.goldD);
  roundRectPath(ctx, x, yy, w, ht, 18); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  drawDiamond(ctx, cx, y, 4, 'rgba(255,248,230,0.9)');
  setFont(ctx, '700 15px "Space Grotesk", monospace');
  ctx.fillStyle = '#3a2c0e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.fillText(text, cx, y + 1); ctx.letterSpacing = '0px';
  ctx.restore();
}

// 底部金色标签（证书编号短码）
function drawBottomLabel(ctx, cx, y, text){
  setFont(ctx, '700 20px "Space Grotesk", monospace');
  const tw = ctx.measureText(text).width;
  const bw = Math.max(240, tw + 90), bh = 40;
  const bx = cx - bw/2, by = y - bh/2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, '#d8b765'); g.addColorStop(1, P.goldD);
  roundRectPath(ctx, bx, by, bw, bh, 18); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  setFont(ctx, '700 20px "Space Grotesk", monospace');
  ctx.fillStyle = '#3a2c0e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, by + bh/2 + 1);
  ctx.restore();
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

// 参数表：左栏(赤经/赤纬/视星等/注册时间) ｜ 右栏(光谱类型/距离地球/所属星座/证书编号)
function drawParamTable(ctx, card, y, star){
  const cx = card.x0 + card.w/2;
  const colL = card.x0 + 90;
  const colR = cx + 60;
  const left = [[t('赤经 RA'), raStr(star)], [t('赤纬 Dec'), decStr(star)],
                [t('视星等'), magStr(star)], [t('注册时间 UTC'), claimDateTime(star)]];
  const right = [[t('光谱类型'), specStr(star)], [t('距离地球'), distStr(star)],
                 [t('所属星座'), t(star.constellation || '—')], [t('证书编号'), star.registry || star.catalogNo || '—']];
  const rowH = 32;
  // 中缝极淡竖线
  ctx.save(); ctx.strokeStyle = 'rgba(200,168,110,0.30)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, y - 18); ctx.lineTo(cx, y - 18 + left.length * rowH); ctx.stroke();
  ctx.restore();
  left.forEach(([k, v], i) => drawParamRow(ctx, colL, y + i * rowH, k, v));
  right.forEach(([k, v], i) => drawParamRow(ctx, colR, y + i * rowH, k, v));
}

function drawParamRow(ctx, x, y, k, v){
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  setFont(ctx, '700 16px "Noto Serif SC", serif'); ctx.fillStyle = P.label;
  ctx.fillText(k, x, y);
  const kw = ctx.measureText(k).width;
  setFont(ctx, '400 18px "Space Grotesk", monospace'); ctx.fillStyle = P.ink;  // 英文数值：细字重
  ctx.fillText(v, x + kw + 10, y);
}

function shortCode(star){
  return star.registry || star.catalogNo || star.share || '—';
}

// ============================================================
// 页脚（固定：左钢印 / 中标语 / 右二维码）
// ============================================================
function drawFooter(ctx, star, kd){
  ctx.strokeStyle = 'rgba(200,168,110,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(160, 1470); ctx.lineTo(DW - 160, 1470); ctx.stroke();

  // 底部极淡星图线稿：压住空白，不与印章/二维码/标语争视线
  drawFaintBottomChart(ctx);

  drawSeal(ctx, 232, 1563, 78, star);

  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.gold;
  setFont(ctx, 'italic 400 18px "Noto Serif SC", serif');  // 字号保持小
  ctx.letterSpacing = '4px';                                // 字距放宽
  ctx.fillText(t('仰望星辰，不是为了拥有，'), 620, 1552);
  ctx.fillText(t('而是为了让记忆在宇宙中有坐标。'), 620, 1586);
  ctx.letterSpacing = '0px';
  ctx.restore();

  // 铸造者钱包（王国凭证）：极淡小字，位于标语下方，不喧宾夺主
  if (kd && kd.minter){
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(200,168,110,0.55)';
    setFont(ctx, '400 11px "Space Grotesk", monospace'); ctx.letterSpacing = '1px';
    const label = 'Pass · ' + kd.minter;
    ctx.fillText(label, 620, 1612);
    ctx.letterSpacing = '0px'; ctx.restore();
  }

  let link = '';
  try { if (star){ const code = encodeStar(star, kd || {}); link = qrLinkForStar(code); } } catch(e){ link = ''; }
  drawQR(ctx, 1012, 1563, 120, link);

  // 页脚底部极小字免责声明（不显眼，避免冒充官方）：随语言切换中英
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  setFont(ctx, '400 10px "Space Grotesk", sans-serif'); ctx.fillStyle = 'rgba(200,168,110,0.5)';
  ctx.fillText(t('本证书为私人纪念档案，仅用于纪念，非国际天文学联合会官方颁发'), 620, 1640);
  ctx.restore();
}

// 底部极淡星图线稿：低透明度星座连线 + 少量星点，压住页脚空白，不抢印章/二维码/标语
function drawFaintBottomChart(ctx){
  const rng = mulberry32(hashString('bottom-chart'));
  const yTop = 1495, yBot = 1640;
  ctx.save();
  // 极淡星座连线（两侧与角落分布，避开中央标语区 470–770）
  ctx.strokeStyle = 'rgba(200,168,110,0.10)'; ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++){
    let px = 130 + rng() * (DW - 260), py = yTop + rng() * (yBot - yTop);
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let s = 0; s < 4; s++){
      px += (rng() - 0.5) * 300; py += (rng() - 0.5) * 110;
      px = Math.max(115, Math.min(DW - 115, px));
      py = Math.max(yTop, Math.min(yBot, py));
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // 少量极淡星点（避开中央标语区）
  ctx.fillStyle = 'rgba(220,232,255,0.12)';
  for (let k = 0; k < 46; k++){
    const px = 115 + rng() * (DW - 230), py = yTop + rng() * (yBot - yTop);
    if (px > 460 && px < 780) continue;
    ctx.beginPath(); ctx.arc(px, py, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawSeal(ctx, cx, cy, r, star){
  ctx.save();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, Math.PI*2); ctx.stroke();
  ctx.globalAlpha = 1;

  drawArcText(ctx, 'PLANET REGISTRY', cx, cy, r - 20, Math.PI*1.18, Math.PI*1.82, false);
  drawArcText(ctx, t('星案特册 注册星球'), cx, cy, r - 20, Math.PI*0.20, Math.PI*0.80, true);

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
  const s = star.spec, n = localizedSpecName(star.spec, star.radiusSolar);
  if (!s && !n) return '—';
  return [s, n].filter(Boolean).join(' · ');
}
function distStr(star){
  const d = star.distLy; if (d == null) return '—';
  const unit = t('光年');                       // 中文：光年；英文： ly
  const unitStr = (unit === '光年') ? (' ' + unit) : unit;
  return (star.dr ? '' : '≈') + Number(d).toLocaleString('en-US') + unitStr;
}

function claimDateTime(star){
  const ts = star && star.claimTs;
  const d = ts ? new Date(ts) : new Date();   // 已认领星固化时间戳，避免每次打开都变；预览/分享无时间戳时回退当前时间
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
