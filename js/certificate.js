// 星球认领证书 —— 整张证书以单张高分辨率 canvas 绘制（深空档案 / 庄重纪念风）
// 设计语言：深蓝炭黑底 + 低饱和暗紫星云 + 稀疏分层星点 + 细哑光金线 + 四角卷草纹
// 中心「星球档案组件」图层顺序：星盘刻度环 → 轨道后半 → 星球本体 → 轨道前半(遮挡) → 星座连线/星点/坐标小字
import { hashString, mulberry32 } from './rng.js';
import { t } from './i18n.js';
import { shareLink, encodeStar } from './share.js';
// 与 3D 认星页共用同一套程序化星球表面（bodyTexture.js），
// 确保证书上的星球与网页里「认领的星星」完全一致（修复此前两张图对不上的问题）。
import { getBodySurface, uvFromDir } from './bodyTexture.js';

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

// 羊皮纸信息卡配色（浅底深字 + 暗金线，与深色背景形成古典证书对比）
const P = {
  bg1:   '#f8f0d9',
  bg2:   '#ecdfc0',
  ink:   '#2b2718',    // 深墨正文（值）
  label: '#7a6334',    // 标签（暗金棕，加粗）
  gold:  '#b8923f',    // 卡片金线 / 分隔 / 菱形
  gold2: 'rgba(184,146,63,0.55)',
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

    // ---- 中心星球档案组件（视觉核心：星球 + 金线星盘 + 星座连线）----
    const archCx = DW / 2, archCy = 520, archR = 236;
    drawArchive(ctx, archCx, archCy, archR, star);

    // ---- 米白羊皮纸信息卡（承载正式信息，古典证书语言）----
    drawParchmentCard(ctx, star, kd);

    // ---- 页脚：圆形印章 + 寄语 + 二维码 + 免责声明 ----
    drawFooter(ctx, star, kd);

    // ---- 信封半包裹：背板装裱边 + 顶部封舌 + 底部口袋，营造"证书装在信封中"的质感 ----
    drawEnvelopeBack(ctx);
    drawEnvelopeFlap(ctx);
    drawEnvelopePocket(ctx);
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
// 背景：深空渐变 + 银河带 + 多层星云（带纹理）+ 稀疏三层星点 + 底纹
// ============================================================
function drawBackground(ctx, star){
  // 深空渐变：顶部偏冷蓝紫、底部近黑，中段微微透出星云暖意
  const bg = ctx.createLinearGradient(0, 0, DW*0.3, DH);
  bg.addColorStop(0, '#0c1430');
  bg.addColorStop(0.45, C.bgTop);
  bg.addColorStop(1, C.bgBot);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, DW, DH);

  // 暗角（压住四角，强化纵深）
  const vig = ctx.createRadialGradient(DW/2, DH*0.42, DH*0.22, DW/2, DH*0.5, DH*0.82);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.7, 'rgba(0,0,0,0.18)');
  vig.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, DW, DH);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // 银河带：一道极淡、倾斜的弥漫星雾，横贯画面，制造真正的"深空"层次
  ctx.save();
  ctx.translate(DW*0.5, DH*0.5);
  ctx.rotate(-0.32);
  const mw = ctx.createLinearGradient(0, -DH*0.34, 0, DH*0.34);
  mw.addColorStop(0, 'rgba(0,0,0,0)');
  mw.addColorStop(0.5, 'rgba(120,108,170,0.10)');
  mw.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mw; ctx.fillRect(-DW*0.9, -DH*0.34, DW*1.8, DH*0.68);
  // 银河内细密星尘（沿带点缀），让"雾"有颗粒质感而非死板色块
  const rngMw = mulberry32(hashString('milkyway'));
  for (let i = 0; i < 900; i++){
    const x = (rngMw()-0.5)*DW*1.7;
    const y = (rngMw()-0.5)*DH*0.34*1.4;
    const a = 0.06 + rngMw()*0.28;
    ctx.fillStyle = rngMw()>0.7 ? `rgba(255,228,196,${a})` : `rgba(214,226,255,${a})`;
    const rr = 0.4 + rngMw()*0.9;
    ctx.fillRect(x, y, rr, rr);
  }
  ctx.restore();

  // 多层星云（暗紫 / 蓝 / 暖金），带柔边与色相变化，叠加出生动深空
  const nebBlobs = [
    [DW*0.28, DH*0.28, DW*0.52, 'rgba(94,70,150,0.20)'],
    [DW*0.74, DH*0.40, DW*0.48, 'rgba(58,92,168,0.16)'],
    [DW*0.66, DH*0.82, DW*0.55, 'rgba(150,96,168,0.15)'],
    [DW*0.26, DH*0.74, DW*0.50, 'rgba(70,108,170,0.14)'],
    [DW*0.52, DH*0.50, DW*0.60, 'rgba(120,96,170,0.12)'],  // 中央极淡，避免纯色方框
  ];
  nebBlobs.forEach(([x, y, r, col])=>{
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(0.6, col.replace(/[\d.]+\)$/, '0.04)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, DW, DH);
  });

  // 星云纹理：低频云絮（半透明叠加），赋予"雾气"而非纯色块的质感
  if (!nebTex) nebTex = makeNebulaTexture();
  ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(nebTex, 'repeat');
  ctx.fillRect(0, 0, DW, DH);
  ctx.restore();

  // 稀疏三层星点（大星少、细碎弱星铺满，禁止密密麻麻；少量亮星带柔光与星芒）
  const rng = mulberry32(hashString((star && star.catalogNo || 'star') + 'bg'));
  const stars = [];
  for (let i = 0; i < 8; i++)  stars.push({ x: rng()*DW, y: rng()*DH, r: 1.8 + rng()*1.8, a: 0.6 + rng()*0.35, big: true });
  for (let i = 0; i < 34; i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 0.9 + rng()*0.8, a: 0.4 + rng()*0.35 });
  for (let i = 0; i < 150; i++) stars.push({ x: rng()*DW, y: rng()*DH, r: 0.5 + rng()*0.6, a: 0.16 + rng()*0.22 });

  stars.forEach(s=>{
    const warm = rng() > 0.84;
    const col = warm ? `rgba(255,226,188,${s.a})` : `rgba(228,236,255,${s.a})`;
    if (s.big){
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r*5);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r*5, 0, Math.PI*2); ctx.fill();
      // 极淡四向星芒，强化"亮星"
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const sp = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
      sp.forEach(ang=>{
        const ex = s.x + Math.cos(ang)*s.r*7, ey = s.y + Math.sin(ang)*s.r*7;
        const lg = ctx.createLinearGradient(s.x, s.y, ex, ey);
        lg.addColorStop(0, col); lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ex, ey); ctx.stroke();
      });
      ctx.restore();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
  });

  // 微弱底纹（档案质感）：极淡噪点叠加，避免纯色死板
  if (!grainTile) grainTile = makeGrain();
  ctx.save();
  ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, DW, DH);
  ctx.restore();
}

// 星云纹理 tile：低频云絮（多色柔斑叠加），让大面积深空具备"雾气"质感而非纯色块
let nebTex = null;
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
  ctx.fillText('STAR & SKY  ·  星与星空', DW/2, 152);
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
  ctx.fillText(t('星球认领证书'), DW/2, 206);
  ctx.letterSpacing = '0px';
  // 英文副标题
  setFont(ctx, '400 19px "Cormorant Garamond", "Times New Roman", serif');
  ctx.fillStyle = C.goldB; ctx.globalAlpha = 0.9;
  ctx.letterSpacing = '6px';
  ctx.fillText('PLANET CLAIM CERTIFICATE', DW/2, 236);
  ctx.letterSpacing = '0px';
  // 短金线分隔
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(DW/2 - 60, 262); ctx.lineTo(DW/2 + 60, 262); ctx.stroke();
  // 线两端小菱形
  [DW/2 - 60, DW/2 + 60].forEach(x=>{
    ctx.save(); ctx.translate(x, 262); ctx.rotate(Math.PI/4);
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
  const rng = mulberry32(hashString((starSeedKey(star)) + 'dial'));
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

// 中心星球本体：与 3D 认星页共用同一套 bodyTexture 表面，
// 保证证书上的星球 == 网页里「认领的星星」（此前两张图不一致，根因在此）。
function drawCelestialBody(ctx, cx, cy, r, star){
  const surface = getBodySurface(star);
  drawBodyGlow(ctx, cx, cy, r, surface.profile);
  drawLitSphere(ctx, cx, cy, r, surface);
}

// 日冕 / 大气辉光：取自 bodyTexture 的 atmo 色与 glow 参数，与 3D 视口一致
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

// 球面本体：以 bodyTexture 的彩色图 + 高度场做逐像素光照（Lambert + 浮雕 + 边缘大气），
// 与 3D 视口的质感、配色、轮廓完全一致。
function drawLitSphere(ctx, cx, cy, r, surface){
  const W = surface.width, H = surface.imgH;
  const cctx = surface.color.getContext('2d');
  const cdata = cctx.getImageData(0, 0, W, H).data;
  const height = surface.heightField;
  const profile = surface.profile;
  const atmo = profile.atmo;

  const d = Math.ceil(r*2) + 4;
  const img = ctx.createImageData(d, d); const data = img.data;
  // 主光方向（与 3D 视口一致：左上偏前）
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
      // 浮雕：用相邻高度扰动法线，显现表面凹凸（与 3D bump 一致）
      const e = 0.0045;
      const hL = hAt(u-e, v), hR = hAt(u+e, v), hD = hAt(u, v-e), hU = hAt(u, v+e);
      const sx = (hL - hR) * 2.4, sy = (hD - hU) * 2.4;
      let Nx = nx - sx, Ny = ny - sy, Nz = nz;
      const nl = Math.hypot(Nx, Ny, Nz) || 1; Nx/=nl; Ny/=nl; Nz/=nl;
      const ndl = Nx*Lx + Ny*Ly + Nz*Lz;
      const day = smoothstep(-0.15, 0.5, ndl);
      const lit = 0.10 + day * 0.95;
      let R = base[0]*lit, G = base[1]*lit, B = base[2]*lit;
      // 边缘大气（菲涅尔）：冷调，强化球体轮廓
      const fres = Math.pow(Math.max(0, 1 - nz), 2.2);
      R += atmo[0]*fres*0.55; G += atmo[1]*fres*0.55; B += atmo[2]*fres*0.55;
      // 高光（水面/冰面偏亮）
      const spec = Math.pow(Math.max(0, ndl), 20) * 0.22;
      R += 255*spec; G += 255*spec; B += 255*spec;
      const aa = smoothstep(r+1.2, r-1.2, dist);
      data[o]=clamp255(R); data[o+1]=clamp255(G); data[o+2]=clamp255(B); data[o+3]=Math.round(255*aa);
    }
  }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  ctx.drawImage(toOffscreen(img, d), cx - r - 2, cy - r - 2, d, d);
  ctx.restore();
  // 轮廓淡金/大气边
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = rgba(atmo, 0.45); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

// 星座：金色细线 + 金色星点（图案随星座名确定），附极小坐标标注
function drawConstellation(ctx, cx, cy, R, star){
  const seed = hashString((star && star.constellation) ? star.constellation : (starSeedKey(star) + 'con'));
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
      x = x + (rng()-0.4) * R*0.30;
      y = y + (rng()-0.5) * R*0.30;
    }
    // 夹紧，避免星座连线越界压到标题或信息卡
    pts.forEach(p=>{ p[0]=Math.max(96,Math.min(1144,p[0])); p[1]=Math.max(300,Math.min(800,p[1])); });
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
// 正文区 · 米白羊皮纸信息卡（古典证书语言：浅底深字 + 暗金线）
// ============================================================
function drawParchmentCard(ctx, star, kd){
  const x0 = 124, y0 = 858, w = DW - 248, h = 592;
  ctx.save();
  // 卡片底（奶油渐变 + 极淡投影）
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
  roundRectPath(ctx, x0, y0, w, h, 10);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  // 颗粒质感（极淡，模拟羊皮纸）
  if (grainTile){
    ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
    roundRectPath(ctx, x0, y0, w, h, 10); ctx.fill(); ctx.restore();
  }
  // 金双线边框 + 四角括角装饰
  ctx.strokeStyle = P.gold; ctx.lineWidth = 2;
  roundRectPath(ctx, x0 + 10, y0 + 10, w - 20, h - 20, 8); ctx.stroke();
  ctx.strokeStyle = P.gold2; ctx.lineWidth = 1;
  roundRectPath(ctx, x0 + 18, y0 + 18, w - 36, h - 36, 6); ctx.stroke();
  drawCardCorners(ctx, x0, y0, w, h);

  // —— 文案（居中对齐，注册人为视觉焦点）——
  const cx = DW / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let y = y0 + 58;
  setFont(ctx, '500 16px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '3px';
  ctx.fillText(t('兹证明 · 此星已被正式认领'), cx, y); ctx.letterSpacing = '0px';
  y += 50;
  setFont(ctx, '500 17px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '2px';
  ctx.fillText(t('星球名称'), cx, y); ctx.letterSpacing = '0px';
  y += 42;
  setFont(ctx, '600 30px "Noto Serif SC", serif'); ctx.fillStyle = P.ink;
  ctx.fillText(star.name || '—', cx, y);
  y += 28; drawDiamond(ctx, cx, y, 5, P.gold); y += 36;
  setFont(ctx, '500 16px "Noto Serif SC", serif'); ctx.fillStyle = P.label; ctx.letterSpacing = '2px';
  ctx.fillText(t('注册人'), cx, y); ctx.letterSpacing = '0px';
  y += 56;
  setFont(ctx, '700 46px "Noto Serif SC", serif'); ctx.fillStyle = P.ink;
  ctx.fillText((kd && kd.ruler) || t('星际公民'), cx, y);
  y += 32;
  ctx.strokeStyle = P.gold; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 90, y); ctx.lineTo(cx + 90, y); ctx.stroke();
  // 两栏参数表
  drawParamTable(ctx, star, y + 50);
  // 缎带编号
  drawRibbon(ctx, star, y0 + h - 56);
  ctx.restore();
}

function drawCardCorners(ctx, x0, y0, w, h){
  const m = 18, len = 26;
  const pts = [[x0 + m, y0 + m, 1, 1], [x0 + w - m, y0 + m, -1, 1],
              [x0 + m, y0 + h - m, 1, -1], [x0 + w - m, y0 + h - m, -1, -1]];
  ctx.save(); ctx.strokeStyle = P.gold; ctx.lineWidth = 2; ctx.lineCap = 'round';
  pts.forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * len); ctx.lineTo(x, y); ctx.lineTo(x + sx * len, y); ctx.stroke();
  });
  ctx.restore();
}

function drawParamTable(ctx, star, y){
  const colL = DW / 2 - 300, colR = DW / 2 + 30;
  const left = [[t('赤经 RA'), raStr(star)], [t('赤纬 Dec'), decStr(star)],
                [t('视星等'), magStr(star)], [t('注册时间'), claimDateTime()]];
  const right = [[t('光谱类型'), specStr(star)], [t('距离地球'), star.distance || '—'],
                 [t('所属星座'), star.constellation || '—'], [t('证书编号'), star.registry || star.catalogNo || '—']];
  const rowH = 48;
  left.forEach(([k, v], i) => drawParamRow(ctx, colL, y + i * rowH, k, v));
  right.forEach(([k, v], i) => drawParamRow(ctx, colR, y + i * rowH, k, v));
}

function drawParamRow(ctx, x, y, k, v){
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  setFont(ctx, '600 18px "Noto Serif SC", serif'); ctx.fillStyle = P.label;
  ctx.fillText(k, x, y);
  const kw = ctx.measureText(k).width;
  setFont(ctx, '400 19px "Noto Serif SC", serif'); ctx.fillStyle = P.ink;
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

// —— 页脚：圆形印章（左下）+ 寄语（中）+ 二维码（右下）+ 免责声明 ——
function drawFooter(ctx, star, kd){
  drawSeal(ctx, 232, 1562, 72, star);
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.gold;
  setFont(ctx, 'italic 400 19px "Noto Serif SC", serif');
  ctx.fillText(t('仰望星辰，不是为了拥有，'), DW / 2, 1552);
  ctx.fillText(t('而是为了让记忆在宇宙中有坐标。'), DW / 2, 1582);
  ctx.restore();
  // 真实可扫码链接：把当前星 + 王国编码进 URL 哈希，扫码即可在任何设备打开这颗星
  let link = '';
  try { if (star) link = shareLink(encodeStar(star, kd || {})); } catch(e){ link = ''; }
  drawQR(ctx, 1006, 1560, 116, link);
  drawDisclaimer(ctx);
}

function drawQR(ctx, cx, cy, size, link){
  const x0 = cx - size / 2, y0 = cy - size / 2;
  // 白底卡片（羊皮纸证书上的二维码位）
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
      const quiet = 2;                       // 静区（quiet zone），提升扫码识别率
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
  // 文案
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = C.gold; ctx.globalAlpha = 0.9;
  setFont(ctx, '400 13px "Noto Serif SC", serif');
  ctx.fillText(t('扫码分享这颗星球记录'), cx, cy + size / 2 + 22);
  ctx.restore();
}

// 库未加载时的装饰性回退：确定性伪二维码（不可真扫，仅占位，保证证书不崩）
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

// 底部免责声明（最小字号，灰蓝但保证可读；位置让开底部信封口袋）
function drawDisclaimer(ctx){
  ctx.save();
  ctx.textAlign = 'center';
  // 上方短金线分隔
  ctx.strokeStyle = C.goldLine2; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(DW/2 - 72, DH - 170); ctx.lineTo(DW/2 + 72, DH - 170); ctx.stroke();
  setFont(ctx, '400 14px "Noto Serif SC", serif');
  ctx.fillStyle = '#c2cde6';
  ctx.fillText(t('备注：本证书为平台纪念性质认领证书，并非 IAU 国际天文学联合会官方天体命名凭证，仅作为数字纪念藏品。'), DW/2, DH - 144);
  ctx.restore();
}

// ============================================================
// 信封半包裹：背板装裱边 + 顶部封舌（折下）+ 底部口袋（证书半插其中）
// 营造"证书装在信封中"的质感 —— 这正是参考图要求的"信封半包裹"效果。
// ============================================================
const EP = { edge:'rgba(184,146,63,0.9)' };
let envPaper = null;
function makeEnvPaper(){
  const S = 200;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#f3e8ca'); g.addColorStop(1, '#e2d2ab');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // 极淡纤维斜纹，赋予纸张纹理质感
  x.globalAlpha = 0.05; x.strokeStyle = '#b9923f'; x.lineWidth = 1;
  for (let i = -S; i < S; i += 6){ x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); }
  x.globalAlpha = 1;
  if (grainTile){
    x.globalAlpha = 0.06; x.globalCompositeOperation = 'multiply';
    x.fillStyle = x.createPattern(grainTile, 'repeat'); x.fillRect(0, 0, S, S);
  }
  return cv;
}
function rrSub(ctx, x, y, w, h, r){
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawEnvelopeBack(ctx){
  // 外缘装裱边：在证书四周覆一层薄信封纸，呈现"证书装在信封 / 文件夹中"
  const m = 20;
  if (!envPaper) envPaper = makeEnvPaper();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
  ctx.beginPath();
  rrSub(ctx, 0, 0, DW, DH, 6);
  rrSub(ctx, m, m, DW - m*2, DH - m*2, 4);
  ctx.fillStyle = '#e6d6ad'; ctx.fill('evenodd');
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = EP.edge; ctx.lineWidth = 1.4;
  ctx.beginPath(); rrSub(ctx, m, m, DW - m*2, DH - m*2, 4); ctx.stroke();
  ctx.restore();
}
function drawEnvelopeFlap(ctx){
  // 顶部封舌：向下折叠的三角形，尖端居中，露出门户"开口"。
  // 注意：封舌与火漆印绘制在最上层，必须收在顶部留白区（≤118px），
  // 否则会压住下方的标题/眉题文字（此前 tipY=150 时火漆印压住了眉题）。
  const tipY = 118;
  if (!envPaper) envPaper = makeEnvPaper();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(DW, 0); ctx.lineTo(DW/2, tipY); ctx.closePath();
  ctx.fillStyle = '#ecdcb6'; ctx.fill();
  ctx.shadowColor = 'transparent';
  // 纸质纹理（裁剪在封舌内）
  ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(envPaper, 'repeat');
  ctx.fillRect(0, 0, DW, tipY + 2);
  ctx.restore();
  // 沿封舌斜边描金
  ctx.strokeStyle = EP.edge; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(DW/2, tipY); ctx.lineTo(DW, 0); ctx.stroke();
  // 中央火漆印 / 徽记（随封舌尖端上移，避免压住眉题）
  drawFlapSeal(ctx, DW/2, tipY - 6);
  ctx.restore();
}
function drawFlapSeal(ctx, cx, cy){
  ctx.save();
  const r = 18;
  const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, r);
  g.addColorStop(0, '#f6dca0'); g.addColorStop(1, '#b07a2e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI*2); ctx.stroke();
  // ✦ 印记
  ctx.strokeStyle = '#5a3a12'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let a = 0; a < 4; a++){
    const ang = a * Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang)*9, cy + Math.sin(ang)*9); ctx.stroke();
  }
  ctx.restore();
}
function drawEnvelopePocket(ctx){
  // 底部口袋：证书下半截插入此处，上沿金线缝 + 向上投下的阴影，强化"插进信封"
  const top = DH - 120;
  if (!envPaper) envPaper = makeEnvPaper();
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.42)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = -7;
  ctx.beginPath(); roundRectPath(ctx, 0, top, DW, DH - top, 6);
  ctx.fillStyle = '#e6d6ad'; ctx.fill();
  ctx.shadowColor = 'transparent';
  // 纸质纹理
  ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.5; ctx.fillStyle = ctx.createPattern(envPaper, 'repeat');
  ctx.fillRect(0, top, DW, DH - top); ctx.restore();
  // 上沿金线缝 + 下方高光
  ctx.strokeStyle = EP.edge; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(DW, top); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, top + 2); ctx.lineTo(DW, top + 2); ctx.stroke();
  ctx.restore();
}

// ============================================================
// 工具
// ============================================================
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

// ---- Perlin 噪声（星球表面）已迁移至 bodyTexture.js，证书端复用其输出 ----
