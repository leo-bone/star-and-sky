// 认领与王国建造：旗帜设计器 + 律法 + 议会 + 本地存储
import { hashString, mulberry32 } from './rng.js?v=20261035';
import { t } from './i18n.js?v=20261035';

const KEY = 'star-sky-claim-v1';

// 旗帜可元素（开/关）
export const ELEMENT_KEYS = ['star','moon','ring','rays','band','vband','diag','mountain','border','text','glow','nebula'];

// 配色预设（点击一键取色，告别"只有黄色"）
export const PALETTES = {
  bg:     ['#0b1026','#11244d','#163a2c','#3a1626','#102a3e','#2c2510','#1e2230','#0d2c24','#241038','#2a1208'],
  accent: ['#f5c97b','#5fe0ff','#ff7a6e','#9b8cff','#74e39b','#ff9d5c','#ffffff','#e0b3ff','#ffd24d','#8fd0ff']
};

// 渐变底色：每种渐变由两组色相生成，模拟星云的深浅过渡
// [起始色, 终止色, 渐变角度]
export const GRADIENTS = {
  none:     null,
  linear:   { name:'极光',   a:'#0b1026', b:'#2a4f8f', angle:135 },
  radial:   { name:'星核',   a:'#1b1040', b:'#3a1a5c', angle:0   },
  nebula:   { name:'星云',   a:'#0a1636', b:'#5a2a6e', angle:160 },
  aurora:   { name:'极光带', a:'#062a2e', b:'#1f6f7a', angle:120 },
  ember:    { name:'余烬',   a:'#2a0a12', b:'#7a2418', angle:145 },
  ice:      { name:'冰晶',   a:'#08182e', b:'#2a5a8f', angle:110 },
  royal:    { name:'帝星',   a:'#12082a', b:'#4a2a7a', angle:150 },
  dawn:     { name:'黎明',   a:'#2a1230', b:'#a85a3a', angle:125 },
};

// 成品预设（一键套用整套设计）
export const PRESETS = [
  { name:'雅典',   bg:'#0b1026', accent:'#f5c97b', elements:{ star:true, band:true, border:true }, starCount:1, text:'ΑΘΗΝΑ' },
  { name:'星海',   bg:'#0a1a3a', accent:'#5fe0ff', elements:{ star:true, ring:true, border:true }, starCount:5, text:'' },
  { name:'赤焰',   bg:'#2a0f12', accent:'#ff7a4d', elements:{ star:true, rays:true, band:true }, starCount:1, text:'' },
  { name:'翠垣',   bg:'#102a1e', accent:'#74e39b', elements:{ mountain:true, star:true, border:true }, starCount:3, text:'' },
  { name:'月邦',   bg:'#101a30', accent:'#d9e2ff', elements:{ moon:true, star:true, border:true }, starCount:1, text:'LUNA' },
  { name:'紫宸',   bg:'#1a1030', accent:'#c9a3ff', elements:{ star:true, ring:true, rays:true }, starCount:3, text:'' },
  // 渐变预设：更有宇宙感
  { name:'极光',   grad:'aurora',   accent:'#7ff0e0', elements:{ star:true, glow:true, border:true }, starCount:5, text:'' },
  { name:'星云',   grad:'nebula',   accent:'#ffb0e0', elements:{ star:true, nebula:true, rays:true }, starCount:3, text:'' },
  { name:'帝星',   grad:'royal',    accent:'#ffd24d', elements:{ star:true, glow:true, border:true, ring:true }, starCount:1, text:'' },
  { name:'冰封',   grad:'ice',      accent:'#bfe8ff', elements:{ star:true, nebula:true, border:true }, starCount:5, text:'' },
  { name:'余烬',   grad:'ember',    accent:'#ff9d5c', elements:{ star:true, rays:true, band:true, glow:true }, starCount:1, text:'' },
  { name:'黎明',   grad:'dawn',     accent:'#ffe0a8', elements:{ star:true, glow:true, mountain:true, border:true }, starCount:3, text:'' },
];

function starPts(cx, cy, R){
  const ri = R * 0.42, pts = [];
  for (let i = 0; i < 10; i++){
    const ang = -Math.PI/2 + i * Math.PI/5;
    const r = (i % 2) ? ri : R;
    pts.push((cx + Math.cos(ang)*r).toFixed(1) + ',' + (cy + Math.sin(ang)*r).toFixed(1));
  }
  return pts.join(' ');
}

// 半透明叠加：把点缀色以不同透明度叠加到底色上，产生层次与通透感
function hexA(hex, a){
  const h = String(hex||'#888888').replace('#','');
  const s = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const n = parseInt(s,16) || 0x888888;
  const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  return `rgba(${r},${g},${b},${a})`;
}

// 安全颜色：仅允许 #rgb / #rrggbb；其它（如攻击者通过分享码注入的 "><script>…）一律回退，杜绝 SVG 属性注入
function safeColor(hex, fallback){
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(hex||'')) ? hex : fallback;
}

// 渐变底：返回 <defs> 中的渐变定义 id 与引用
function gradDefs(f){
  const g = GRADIENTS[f.grad];
  if (!g) return { defs:'', fill: safeColor(f.bg, '#0b1026') };
  const a = f.gradA || g.a, b = f.gradB || g.b;
  const ang = f.gradAngle != null ? f.gradAngle : g.angle;
  const rad = (ang * Math.PI) / 180;
  const x1 = 150 - Math.cos(rad) * 150, y1 = 100 - Math.sin(rad) * 100;
  const x2 = 150 + Math.cos(rad) * 150, y2 = 100 + Math.sin(rad) * 100;
  const gid = 'fg-' + (f.grad || 'none');
  const defs = `<linearGradient id="${gid}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}">`
    + `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  return { defs, fill: `url(#${gid})` };
}

// 星云纹理：多层半透明椭圆 + 星点，铺在底色上，制造深邃宇宙感
// 注意：SVG 会被压进分享链接（进而进二维码），所以这里的元素数量要克制
function nebulaLayer(f){
  const a = f.accent;
  const rng = mulberry32(hashString((f.seed || 'n') + '|neb'));
  let s = '';
  // 几团半透明星云（点缀色与冷蓝交替）
  for (let i = 0; i < 4; i++){
    const cx = 40 + rng() * 220, cy = 30 + rng() * 140;
    const rx = 34 + rng() * 62, ry = 20 + rng() * 38;
    const rot = rng() * 180;
    const c = i % 2 ? a : '#5fe0ff';
    s += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" fill="${hexA(c, (0.09 + rng() * 0.11).toFixed(3))}" transform="rotate(${rot.toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
  }
  // 细密星点：多数用点缀色（少数纯白），避免把旗帜冲成一片白
  for (let i = 0; i < 34; i++){
    const cx = rng() * 300, cy = rng() * 200, r = 0.5 + rng() * 1.1;
    const white = rng() < 0.25;
    const col = white ? '#ffffff' : a;
    s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" fill="${hexA(col, (0.2 + rng() * 0.45).toFixed(2))}"/>`;
  }
  return s;
}

// 由旗帜状态生成所有图层（z 轴从下到上）
export function flagLayers(f){
  // 分享码携带的 flag 来自外部，必须白名单校验颜色与渐变，避免 XSS/属性注入
  const a = safeColor(f.accent, '#f5c97b');
  const b = safeColor(f.bg, '#0b1026');
  const E = f.elements || {};
  const G = gradDefs(f);
  let s = `<defs>${G.defs}</defs>`;
  // 底：渐变或纯色
  s += `<rect x="0" y="0" width="300" height="200" fill="${G.fill}"/>`;
  // 半透明底色叠加层（让纯色也能有通透的空间感；渐变底本身已有层次，叠加更轻）
  const layerA = GRADIENTS[f.grad] ? 0.06 : 0.11;
  s += `<rect x="0" y="0" width="300" height="200" fill="${hexA(a, layerA)}"/>`;
  s += `<rect x="0" y="0" width="300" height="200" fill="${hexA('#5fe0ff', GRADIENTS[f.grad] ? 0.03 : 0.06)}"/>`;
  // 星云层
  if (E.nebula) s += `<g>${nebulaLayer(f)}</g>`;
  // 光晕层（底部辉光）
  if (E.glow){
    s += `<radialGradient id="fglow" cx="50%" cy="50%" r="50%">`
      + `<stop offset="0" stop-color="${hexA(a,0.42)}"/><stop offset="0.6" stop-color="${hexA(a,0.10)}"/><stop offset="1" stop-color="${hexA(a,0)}"/>`
      + `</radialGradient>`;
    s += `<ellipse cx="150" cy="100" rx="170" ry="120" fill="url(#fglow)"/>`;
  }
  if (E.diag)    s += `<polygon points="0,0 300,0 300,200" fill="${hexA(a, 0.55)}"/>`;
  if (E.vband)   s += `<rect x="120" y="0" width="60" height="200" fill="${hexA(a, 0.58)}"/>`;
  if (E.band)    s += `<rect x="0" y="80" width="300" height="40" fill="${hexA(a, 0.62)}"/>`;
  if (E.mountain)s += `<polygon points="0,200 55,122 110,168 165,108 225,162 300,118 300,200" fill="${hexA(a, 0.62)}"/>`;
  if (E.ring){
    s += `<ellipse cx="150" cy="100" rx="80" ry="30" fill="none" stroke="${hexA(a,0.85)}" stroke-width="6" transform="rotate(-18 150 100)"/>`;
    s += `<circle cx="206" cy="86" r="9" fill="${hexA(a,0.92)}"/>`;
  }
  if (E.moon){
    s += `<circle cx="214" cy="58" r="26" fill="${hexA(a,0.9)}"/>`;
    s += `<circle cx="223" cy="52" r="22" fill="${hexA(b,0.92)}"/>`;
  }
  if (E.rays){
    s += `<g stroke="${hexA(a,0.72)}" stroke-width="5" stroke-linecap="round">`;
    for (let i = 0; i < 12; i++){
      const ang = i * Math.PI/6;
      s += `<line x1="${(150+Math.cos(ang)*30).toFixed(1)}" y1="${(100+Math.sin(ang)*30).toFixed(1)}" x2="${(150+Math.cos(ang)*44).toFixed(1)}" y2="${(100+Math.sin(ang)*44).toFixed(1)}"/>`;
    }
    s += `</g><circle cx="150" cy="100" r="20" fill="${hexA(a,0.92)}"/>`;
  }
  if (E.star){
    const pos = f.starCount === 1 ? [[150,100,60]]
              : f.starCount === 3 ? [[150,66,46],[96,132,34],[204,132,34]]
              : [[150,54,40],[92,108,30],[208,108,30],[120,160,26],[180,160,26]];
    for (const [x,y,r] of pos) s += `<polygon points="${starPts(x,y,r)}" fill="${hexA(a,0.95)}"/>`;
  }
  if (E.border)  s += `<rect x="7" y="7" width="286" height="186" fill="none" stroke="${hexA(a,0.68)}" stroke-width="6"/>`
                    + `<rect x="15" y="15" width="270" height="170" fill="none" stroke="${hexA(a,0.38)}" stroke-width="2"/>`;
  if (E.text && f.text) s += `<text x="150" y="186" text-anchor="middle" fill="${hexA(a,0.95)}" font-size="15" font-family="Space Grotesk" letter-spacing="2">${escapeHtml(f.text)}</text>`;
  return s;
}

export function initKingdom(){
  const bg = document.getElementById('fc-bg');
  const accent = document.getElementById('fc-accent');
  const textIn = document.getElementById('fc-text');
  const flagSvg = document.getElementById('flag-svg');

  // 默认旗帜：深蓝底 + 金色星徽（5 颗）
  const elements = { star:true, moon:false, ring:false, rays:false, band:false, vband:false, diag:false, mountain:false, border:false, text:false, glow:false, nebula:false };
  let starCount = 5;
  let grad = 'none';          // 当前渐变底
  let gradA = null, gradB = null;  // 渐变自定义色（null 时用预设色）

  const toggleBtns = [...document.querySelectorAll('#flag-elements .flag-toggle')];
  const scBtns = [...document.querySelectorAll('#star-count-row .sc-btn')];

  function currentFlag(){
    return { bg:bg.value, accent:accent.value, elements, starCount, text:textIn.value.trim(),
             grad, gradA, gradB, seed:(bg.value||'') + (accent.value||'') };
  }
  function applyFlag(){
    flagSvg.innerHTML = flagLayers(currentFlag());
  }

  toggleBtns.forEach(btn=>{
    btn.onclick = ()=>{
      const el = btn.dataset.el;
      elements[el] = !elements[el];
      btn.classList.toggle('on', elements[el]);
      // 星数控件仅在“星徽”开启时显示
      document.getElementById('star-count-row').style.display = elements.star ? 'flex' : 'none';
      applyFlag();
    };
  });
  scBtns.forEach(b=>{
    b.onclick = ()=>{
      starCount = +b.dataset.n;
      scBtns.forEach(x=> x.classList.toggle('on', x === b));
      applyFlag();
    };
  });

  // 调色板（底色 / 点缀）
  function buildPalette(host, list, target){
    host.innerHTML = '';
    list.forEach(c=>{
      const sw = document.createElement('button');
      sw.className = 'palette-sw';
      sw.style.background = c;
      sw.title = c;
      sw.onclick = ()=>{ target.value = c; applyFlag(); };
      host.appendChild(sw);
    });
  }
  buildPalette(document.getElementById('palette-bg'), PALETTES.bg, bg);
  buildPalette(document.getElementById('palette-accent'), PALETTES.accent, accent);

  // 渐变底调色板：每个色块展示预设的渐变效果，点击即切换
  const gradHost = document.getElementById('palette-grad');
  if (gradHost){
    Object.keys(GRADIENTS).forEach(key=>{
      const g = GRADIENTS[key];
      const sw = document.createElement('button');
      sw.className = 'palette-sw grad-sw';
      if (!g){
        sw.style.background = bg.value;
        sw.title = t('纯色');
      } else {
        sw.style.background = `linear-gradient(135deg, ${g.a} 0%, ${g.b} 100%)`;
        sw.title = t(g.name);
      }
      sw.dataset.grad = key;
      sw.onclick = ()=>{
        grad = key;
        gradA = null; gradB = null;
        gradHost.querySelectorAll('.grad-sw').forEach(x=>x.classList.toggle('on', x===sw));
        applyFlag();
      };
      gradHost.appendChild(sw);
    });
    // 默认选中"纯色"
    const first = gradHost.querySelector('[data-grad="none"]');
    if (first) first.classList.add('on');
  }

  // 成品预设
  const presetHost = document.getElementById('flag-presets');
  PRESETS.forEach(p=>{
    const b = document.createElement('button');
    b.className = 'preset-btn';
    const g = p.grad ? GRADIENTS[p.grad] : null;
    const chip = g
      ? `<span class="preset-chip" style="background:linear-gradient(135deg,${g.a},${g.b})"><i style="background:${p.accent}"></i></span>`
      : `<span class="preset-chip" style="background:${p.bg}"><i style="background:${p.accent}"></i></span>`;
    b.innerHTML = chip + '<span class="preset-name" data-i18n="' + p.name + '">' + p.name + '</span>';
    b.onclick = ()=>{
      bg.value = p.bg || '#11244d';
      accent.value = p.accent; starCount = p.starCount || 5; textIn.value = p.text || '';
      grad = p.grad || 'none'; gradA = null; gradB = null;
      if (gradHost) gradHost.querySelectorAll('.grad-sw').forEach(x=>x.classList.toggle('on', x.dataset.grad===grad));
      ELEMENT_KEYS.forEach(k=> elements[k] = !!(p.elements && p.elements[k]));
      toggleBtns.forEach(x=> x.classList.toggle('on', !!elements[x.dataset.el]));
      scBtns.forEach(x=> x.classList.toggle('on', +x.dataset.n === starCount));
      document.getElementById('star-count-row').style.display = elements.star ? 'flex' : 'none';
      applyFlag();
    };
    presetHost.appendChild(b);
  });

  bg.oninput = applyFlag; accent.oninput = applyFlag; textIn.oninput = applyFlag;

  // 律法
  const lawList = document.getElementById('law-list');
  const lawInput = document.getElementById('law-input');
  function addLaw(){
    const v = lawInput.value.trim(); if (!v) return;
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(v)}</span><span class="x">✕</span>`;
    li.querySelector('.x').onclick = ()=> li.remove();
    lawList.appendChild(li); lawInput.value = '';
  }
  document.getElementById('law-add').onclick = addLaw;
  lawInput.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); addLaw(); } };

  // 议会
  const councilList = document.getElementById('council-list');
  const councilInput = document.getElementById('council-input');
  function addCouncil(){
    const v = councilInput.value.trim(); if (!v) return;
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(v)}</span><span class="x">✕</span>`;
    li.querySelector('.x').onclick = ()=> li.remove();
    councilList.appendChild(li); councilInput.value = '';
  }
  document.getElementById('council-add').onclick = addCouncil;
  councilInput.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); addCouncil(); } };

  function getLaws(){ return [...lawList.querySelectorAll('li span:first-child')].map(s=>s.textContent); }
  function getCouncil(){ return [...councilList.querySelectorAll('li span:first-child')].map(s=>s.textContent); }

  function getState(){
    return {
      name: document.getElementById('kingdom-name').value.trim(),
      ruler: document.getElementById('ruler-title').value.trim(),
      message: document.getElementById('star-message').value.trim(),
      laws: getLaws(),
      council: getCouncil(),
      flag: { bg:bg.value, accent:accent.value, elements:{...elements}, starCount, text:textIn.value.trim(),
              grad, gradA, gradB }
    };
  }

  function buildFlagSVG(){
    return `<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">${flagLayers(currentFlag())}</svg>`;
  }

  function save(){
    try { localStorage.setItem(KEY, JSON.stringify({ state:getState(), ts:Date.now() })); } catch(e){}
  }
  function load(){
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d ? d.state : null;
    } catch(e){ return null; }
  }
  function restore(s){
    if (!s) return;
    document.getElementById('kingdom-name').value = s.name || '';
    document.getElementById('ruler-title').value = s.ruler || '';
    document.getElementById('star-message').value = s.message || '';
    (s.laws||[]).forEach(v=>{ lawInput.value=v; addLaw(); });
    (s.council||[]).forEach(v=>{ councilInput.value=v; addCouncil(); });
    if (s.flag){
      bg.value = s.flag.bg; accent.value = s.flag.accent; textIn.value = s.flag.text||'';
      starCount = s.flag.starCount || 5;
      grad = s.flag.grad || 'none'; gradA = s.flag.gradA || null; gradB = s.flag.gradB || null;
      if (gradHost) gradHost.querySelectorAll('.grad-sw').forEach(x=>x.classList.toggle('on', x.dataset.grad===grad));
      ELEMENT_KEYS.forEach(k=>{
        elements[k] = !!(s.flag.elements && s.flag.elements[k]);
        const tb = toggleBtns.find(x=> x.dataset.el === k); if (tb) tb.classList.toggle('on', elements[k]);
      });
      scBtns.forEach(x=> x.classList.toggle('on', +x.dataset.n === starCount));
      document.getElementById('star-count-row').style.display = elements.star ? 'flex' : 'none';
      applyFlag();
    }
  }

  // 高级旗帜细节：折叠面板（默认收起，只展示核心元素）
  const advToggle = document.getElementById('flag-adv-toggle');
  const advBox = document.getElementById('flag-adv');
  if (advToggle && advBox){
    advToggle.onclick = ()=>{
      const open = advBox.hasAttribute('hidden');
      if (open){ advBox.removeAttribute('hidden'); advToggle.classList.add('open'); }
      else { advBox.setAttribute('hidden',''); advToggle.classList.remove('open'); }
    };
  }

  // 初始渲染
  document.getElementById('star-count-row').style.display = 'flex';
  applyFlag();

  // 切换语言时，重译“渐变色块”的悬浮提示（预设名已用 data-i18n 自动翻译）
  function refreshTexts(){
    if (!gradHost) return;
    gradHost.querySelectorAll('.grad-sw').forEach(sw=>{
      const key = sw.dataset.grad;
      const g = GRADIENTS[key];
      sw.title = g ? t(g.name) : t('纯色');
    });
  }

  return { getState, buildFlagSVG, save, load, restore, applyFlag, refreshTexts };
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
