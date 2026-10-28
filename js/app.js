// 3D 宇宙背景依赖 three.js（CDN）+ WebGL；改为动态 import，
// 即使 CDN 抽风或 WebGL 不可用，也只是降级为空操作，绝不拖垮整站（开门/问答/证书照常）
import { initQuiz } from './quiz.js';
import { generateStar, starParamList } from './starData.js';
import { initKingdom } from './kingdom.js';
import { initCertificate } from './certificate.js';
import { encodeStar, shareLink, copyText, parseCodeFromURL, decodeStar } from './share.js';
import { starKey, pushStar, listStars, addMessage, listMessages, nameTaken } from './cloud.js';
import { initSkyMap } from './skymap.js';
import { loadCatalog } from './catalog.js';
import { t, getLang, setLang, applyI18n, initLangToggle } from './i18n.js';

const SESSION_KEY = 'star-sky-session-v1';
const CLAIM_KEY = 'star-sky-claim-v1';   // 已认领星球（与问答进度分离，独立持久化，刷新/重开不丢失）

// 已认领星球：以分享码形式持久化，恢复时解码即得与证书、云端完全一致的星与王国。
// 独立密钥，避免“重新认领/重开”误删已认领记录。
function saveClaim(star, kd){
  try {
    const code = encodeStar(star, kd || {});
    localStorage.setItem(CLAIM_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch(e){ console.warn('[claim] 保存认领记录失败', e); }
}
function loadClaim(){
  try {
    const raw = localStorage.getItem(CLAIM_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.code) return null;
    const data = decodeStar(o.code);
    if (!data) return null;
    return { star: data.star, kingdom: data.kd, ts: o.ts };
  } catch(e){ return null; }
}
function hasClaim(){ return !!loadClaim(); }

// 3D 宇宙背景依赖 three.js（CDN）+ WebGL；若不可用则降级为空操作桩，绝不因此拖垮整站
const NULL_UNIVERSE = { setStar(){}, showHero(){}, hideHero(){}, setControl(){}, setFocus(){}, setActive(){} };
let universe = NULL_UNIVERSE;
import('./universe.js').then(m => {
  try { universe = m.initUniverse(document.getElementById('cosmos')); }
  catch (e) { console.warn('3D 宇宙背景初始化失败，已降级为静态背景', e); }
}).catch(e => console.warn('3D 宇宙背景模块加载失败（CDN/WebGL），已降级为空操作', e));
const kingdom = initKingdom();
const card = initCertificate();
// 3D 星球视口依赖 three.js（CDN）；若不可用则降级为空操作桩，绝不拖垮整站
const NULL_PLANET3D = { setStar(){}, show(){}, hide(){}, resize(){} };
let planet3d = NULL_PLANET3D;
import('./planet3d.js').then(m => {
  try {
    planet3d = m.initPlanet3D(document.getElementById('planet-canvas'));
    if (currentStar && screens.universe && screens.universe.classList.contains('active')){
      planet3d.setStar(currentStar); planet3d.show();
    }
  }
  catch (e) { console.warn('3D 星球视口初始化失败，已降级', e); }
}).catch(e => console.warn('3D 星球视口模块加载失败（CDN/WebGL），已降级为空操作', e));

let currentStar = null;
let currentAnswers = null;
let currentKingdom = null; // 含 flagSVG
let isShared = false;      // 是否处于“浏览他人分享星图”的只读模式
let currentScreen = 'home';
let lastSkyInfo = null;    // 最近一次星空信息卡数据（语言切换时重绘）
let quizCtl = null;        // 问答控制器（含 redraw，供语言切换重绘）

// ---------- 首屏大图延迟加载 ----------
// 神庙照片 700KB+、星云图 440KB+，若由 CSS background 承载会在样式解析阶段
// 就下载并阻塞首屏绘制。改为：首屏先渲染纯色底 + 标题，浏览器空闲后再加载并淡入。
(function loadGateAssetsLate(){
  const img = document.getElementById('gate-photo-img');
  const sky = document.querySelector('.gate-sky');
  const cosmos = document.querySelector('.gate-cosmos');

  const loadPhoto = ()=>{
    if (!img) return;
    img.onload = ()=> img.classList.add('loaded');
    img.onerror = ()=>{ /* 加载失败则保持纯色底，不影响可用性 */ };
    img.src = 'assets/greek_temple.jpg';
  };
  const loadCosmos = ()=>{
    if (!sky || !cosmos || sky.dataset.cosmosLoaded) return;
    sky.dataset.cosmosLoaded = '1';
    sky.style.backgroundImage = "url('assets/cosmos.jpg')";
    cosmos.style.backgroundImage = "url('assets/cosmos.jpg')";
  };

  const idle = (fn)=> ('requestIdleCallback' in window)
    ? requestIdleCallback(fn, { timeout: 1500 })
    : setTimeout(fn, 150);
  idle(loadPhoto);
  idle(loadCosmos);
})();

// ---------- 电影开场：首页序章定时器 ----------
// 必须显式声明：此前 homeTimers 是隐式全局，首次调用 playHome() 时为 undefined，
// `undefined.forEach` 抛 TypeError 会中断整个 playHome()，
// 导致字幕/推门按钮永远不出现（首页"看不到字、没有按钮"）。
let homeTimers = [];

// 屏幕导航
const screens = {
  home: document.getElementById('screen-home'),
  quiz: document.getElementById('screen-quiz'),
  universe: document.getElementById('screen-universe'),
  explore: document.getElementById('screen-explore'),
  claim: document.getElementById('screen-claim'),
  share: document.getElementById('screen-share'),
};
const navSteps = [...document.querySelectorAll('.nav-step')];

function go(name){
  currentScreen = name;
  // 导航是全局骨架：任何子步骤抛错都不能让整页卡死/白屏，
  // 因此把各段包在 try/catch 里，失败只记日志不阻断导航。
  try{
    Object.values(screens).forEach(s => s.classList.toggle('active', s.id === 'screen-'+name));
    navSteps.forEach(n => n.classList.toggle('active', n.dataset.step === name));
  }catch(e){ console.warn('[nav] 切换屏幕失败', e); }

  try{
    // 宇宙恒星与控制的显隐：宇宙页用右侧专用 3D 视口（可拖拽旋转），隐藏全屏 hero 以免叠加
    if (name === 'universe'){
      universe.setFocus(0); universe.hideHero(); universe.setControl(false);
      if (currentStar) planet3d.setStar(currentStar);
      planet3d.show();
    } else {
      universe.setFocus(0); universe.hideHero(); universe.setControl(false);
      planet3d.hide();
    }
    // 全屏宇宙背景：首页被神庙照片完全盖住，无需渲染；其余页面作为星空衬底才渲染（省 GPU）
    universe.setActive(name !== 'home');
  }catch(e){ console.warn('[nav] 3D 场景切换失败', e); }

  try{
    // 分享横幅仅在“浏览他人分享星图”时显示，自己认领/续看时务必隐藏，避免残留
    if (name === 'share'){
      const sb = document.getElementById('shared-banner');
      if (sb) sb.style.display = isShared ? 'flex' : 'none';
      loadNotes();
      renderCloudWall();
    }
  }catch(e){ console.warn('[nav] 分享页渲染失败', e); }

  // 认领页需先有星
  if (name === 'claim' && !currentStar){
    toast('先完成问答，认领一颗属于你的星'); go('quiz'); return;
  }
  try{
    // 真实星空：可独立探索（无需先认领），直接对标 ISR 的静态纸星图
    if (name === 'explore'){
      ensureSky();
      skyMap.resize();
      if (currentStar) skyMap.setUserStar(mapUserStar());
      loadCloudStars();
    }
  }catch(e){ console.warn('[nav] 星空页初始化失败', e); }

  // 电影开场：每次回到首页都重放开门序章
  if (name === 'home'){
    document.body.classList.add('cinema-mode');
    try{ playHome(); }catch(e){ console.warn('[nav] 首页序章播放失败', e); }
  }
  else {
    document.body.classList.remove('cinema-mode');
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}
function playHome(){
  homeTimers.forEach(clearTimeout); homeTimers = [];
  const cinema = document.getElementById('cinema');
  if (!cinema) return;
  // 复位上一轮的动画状态（可能残留 opening / opacity:0）
  cinema.classList.remove('opening', 'played');
  cinema.style.transition = ''; cinema.style.opacity = '';
  const cta = document.getElementById('cinema-cta'); if (cta) cta.classList.remove('show');
  const lines = [...document.querySelectorAll('.ct-line')];
  lines.forEach(l => l.classList.remove('show'));
  // 序章文字与按钮分阶段浮现
  homeTimers.push(setTimeout(() => cinema.classList.add('played'), 100));
  lines.forEach((l, i) => homeTimers.push(setTimeout(() => l.classList.add('show'), 600 + i * 1100)));
  homeTimers.push(setTimeout(() => cta && cta.classList.add('show'), 600 + lines.length * 1100 + 300));
}
function openDoor(){
  if (hasClaim()){ openMyStar(); return; }   // 已认领：直接打开自己的星（每人限一颗）
  const cinema = document.getElementById('cinema');
  if (!cinema || cinema.classList.contains('opening')) return;
  cinema.classList.add('opening');
  setTimeout(() => {
    cinema.style.transition = 'opacity .8s ease';
    cinema.style.opacity = '0';
    setTimeout(() => {
      cinema.style.opacity = '';
      cinema.style.transition = '';
      go('quiz');
    }, 800);
  }, 2050);
}

// 随时查阅：打开已认领的星球（从持久化的分享码解码，与证书/云端完全一致）
function openMyStar(){
  const c = loadClaim();
  if (!c){ toast(t('你还没有认领星球，先去认领一颗吧 ✦')); go('quiz'); return; }
  currentStar = c.star; currentKingdom = c.kingdom; isShared = false;
  card.build(currentStar, currentKingdom);
  renderWall();
  go('share');
}

document.querySelectorAll('[data-go]').forEach(el=>{
  el.addEventListener('click', ()=> go(el.dataset.go));
});
navSteps.forEach(n=> n.addEventListener('click', ()=> go(n.dataset.step)));

// ---------- 我的星球：随时查阅已认领的星（顶部常驻 + 首页副按钮）----------
const btnMine = document.getElementById('btn-mine');
if (btnMine) btnMine.addEventListener('click', openMyStar);
const btnMineHome = document.getElementById('btn-mine-home');
if (btnMineHome) btnMineHome.addEventListener('click', openMyStar);

// ---------- 问答 → 生成星星 ----------
quizCtl = initQuiz({
  stage: document.getElementById('quiz-stage'),
  bar: document.getElementById('quiz-bar'),
  count: document.getElementById('quiz-count'),
  prevBtn: document.getElementById('quiz-prev'),
  nextBtn: document.getElementById('quiz-next'),
  onDone: (answers)=>{
    currentAnswers = answers;
    currentStar = generateStar(answers);
    populateUniverse(currentStar);
    saveSession('universe');
    go('universe');
  }
});

function populateUniverse(star){
  document.getElementById('uni-flavor').textContent = star.flavor;
  const box = document.getElementById('star-params');
  const map = new Map(starParamList(star));
  // 三组呈现，清爽不挤：基础信息 / 物理参数 / 天体坐标
  const GROUPS = [
    { title:t('基础信息'), keys:['恒星编号','国际命名','星表编号','行星类型','所在星座','所属星系','行星数量','卫星数量'] },
    { title:t('物理参数'), keys:['光谱类型','表面温度','直径','质量','光度','表面重力','自转周期','星龄'] },
    { title:t('天体坐标'), keys:['天球坐标','距地球','物质构成','大气构成','含氧量'] },
  ];
  box.innerHTML = GROUPS.map(g=>{
    const rows = g.keys.filter(k=>map.has(k)).map(k=>
      `<div class="sp"><span>${k}</span><b>${map.get(k)}</b></div>`).join('');
    if (!rows) return '';
    return `<div class="sp-group"><div class="sp-group-title">${g.title}</div><div class="sp-grid">${rows}</div></div>`;
  }).join('');
  universe.setStar(star);
  planet3d.setStar(star);
}

// ---------- 认领 ----------
document.getElementById('btn-claim').addEventListener('click', ()=>{
  if (hasClaim()){ openMyStar(); return; }   // 已认领：不重复认领，直接打开自己的星
  const saved = loadSession();
  if (saved && saved.kingdom) kingdom.restore(saved.kingdom);
  go('claim');
});

// ---------- 生成星图 ----------
document.getElementById('btn-generate').addEventListener('click', async ()=>{
  const name = document.getElementById('kingdom-name').value.trim();
  if (!name){ toast(t('先给你的星辰王国起个名字吧')); return; }
  // 命名去重：不同用户不能拥有同名星辰（云不可用时放行，由数据库唯一约束兜底）
  let nameFree = true;
  try { nameFree = !(await nameTaken(name)); } catch(e){ nameFree = true; }
  if (!nameFree){
    toast(t('「') + name + t('」这颗星辰已被认领，换个名字再建国吧 ✦'));
    document.getElementById('kingdom-name').focus();
    return;
  }
  if (currentStar) currentStar.name = name;
  const state = kingdom.getState();
  state.flagSVG = kingdom.buildFlagSVG();
  currentKingdom = state;
  kingdom.save();
  saveSession('share');
  card.build(currentStar, currentKingdom);
  pushWall(currentStar, currentKingdom);
  // 同步到云端共享星图（与好友一起看）
  try {
    const _code = encodeStar(currentStar, currentKingdom);
    await pushStar({
      code: starKey(_code), share: _code,
      name: currentStar.name, designation: currentStar.designation,
      catalogNo: currentStar.catalogNo,
      ra: currentStar.ra, dec: currentStar.dec,
      color1: currentStar.color1, color2: currentStar.color2,
      spec: currentStar.spec, constellation: currentStar.constellation,
      owner_name: currentKingdom.name, mag: currentStar.mag, distLy: currentStar.distLy,
      message: currentKingdom.message
    });
  } catch(e){
    if (e && e.code === '23505_name'){
      toast(t('「') + name + t('」') + ' ' + t('刚刚被认领，换个名字再点生成') + ' ✦');
    } else {
      console.warn('[cloud] 星上云失败', e);
    }
  }
  saveClaim(currentStar, currentKingdom);   // 落盘“已认领”记录（与问答进度分离，刷新/重开不丢）
  // 已认领后，首页主 CTA 与副按钮切换为“我的星球”，避免重复认领
  const od = document.getElementById('btn-open-door');
  if (od){ od.textContent = t('查看我的星球 ✦'); od.removeAttribute('data-i18n'); }
  const mh = document.getElementById('btn-mine-home'); if (mh) mh.style.display = '';
  renderWall();
  go('share');
});

// ---------- 下载 / 分享 / 重置 ----------
document.getElementById('btn-download').addEventListener('click', ()=> card.download(currentStar));
document.getElementById('btn-share-link').addEventListener('click', async ()=>{
  if (!currentStar || !currentKingdom){ toast(t('还没有可分享的星图')); return; }
  const code = encodeStar(currentStar, currentKingdom);
  const link = shareLink(code);
  try {
    await copyText(link);
    toast(t('分享链接已复制，去送给朋友吧 ✦'));
  } catch(e){
    window.prompt('复制下面的链接，分享给朋友：', link);
  }
});
document.getElementById('btn-restart').addEventListener('click', ()=>{
  if (isShared){
    isShared = false;
    // 清除 URL 分享参数，避免刷新后重新进入只读模式
    try { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]code=[^&]+/, '')); } catch(e){}
    location.hash = '';
    // 若已认领则回到自己的星，否则去认领（均不清除认领记录）
    if (hasClaim()) openMyStar(); else go('quiz');
    return;
  }
  // 查看自己的星时：返回首页（保留认领记录，不做破坏性清除）
  go('home');
});

// 高级版 / 周边：候补名单（仅本地预留，无后端，不强制）
const premiumEmail = document.getElementById('premium-email');
const premiumNote = document.getElementById('premium-note');
try {
  if (localStorage.getItem('star-sky-waitlist')){
    premiumNote.textContent = t('已加入候补名单 ✦ 高级版首发时我们会通过邮箱通知你。');
    if (premiumEmail) premiumEmail.value = localStorage.getItem('star-sky-waitlist');
  }
} catch(e){}
document.getElementById('btn-premium')?.addEventListener('click', ()=>{
  const v = (premiumEmail && premiumEmail.value || '').trim();
  if (!v || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){ toast(t('请填写有效的邮箱地址')); return; }
  try { localStorage.setItem('star-sky-waitlist', v); } catch(e){}
  premiumNote.textContent = t('已加入候补名单 ✦ 高级版首发时我们会通过邮箱通知你。');
  toast(t('已加入候补名单，感谢支持 ✦'));
});

// ---------- 会话存储（支持“继续我的星空”） ----------
function saveSession(progress){
  try {
    const data = {
      answers: currentAnswers,
      kingdom: currentKingdom || (kingdom.getState()),
      progress,
      flagSVG: currentKingdom ? currentKingdom.flagSVG : null,
      // 数据层预留：高级版 / 周边付费配置（当前均为免费）
      premium: { tier: 'free', waitlist: !!localStorage.getItem('star-sky-waitlist') },
      ts: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch(e){}
}
function loadSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch(e){ return null; }
}

// ---------- 世界星图墙（本地累积，演示“全世界的星”） ----------
const WALL_KEY = 'star-sky-wall-v1';
function loadWall(){
  try { return JSON.parse(localStorage.getItem(WALL_KEY) || '[]'); }
  catch(e){ return []; }
}
function pushWall(star, kd){
  try {
    const wall = loadWall().filter(w => w.star.catalogNo !== star.catalogNo);
    wall.unshift({ star, kingdom: kd, ts: Date.now() });
    localStorage.setItem(WALL_KEY, JSON.stringify(wall.slice(0, 80)));
  } catch(e){}
}
function renderWall(){
  const wall = loadWall();
  const box = document.getElementById('world-wall');
  const count = document.getElementById('wall-count');
  count.textContent = t('已被认领') + ' ' + wall.length + ' ' + t('颗星辰');
  if (!wall.length){ box.innerHTML = '<div class="wall-empty">' + t('还没有星辰被点亮。认领你的第一颗，让世界星图墙亮起来。') + '</div>'; return; }
  box.innerHTML = wall.map((w, i)=>{
    const s = w.star, k = w.kingdom || {};
    const kname = k.name || s.name + t(' 王国');
    const desig = s.desig || '';
    // 星球寄语：认领者留下的心意，在星图墙上也要看得见
    const msg = (k.message || s.message || '').trim();
    const msgHtml = msg ? `<div class="wt-msg">“${escapeHtml(msg)}”</div>` : '';
    return `<div class="wall-tile" data-i="${i}" style="color:${s.color1};animation-delay:${(i*0.37).toFixed(2)}s">
      <div class="wt-orb" style="background:radial-gradient(circle at 35% 30%, #fff, ${s.color1} 45%, ${s.color2} 82%, #2a0f00)"></div>
      <div class="wt-name">${escapeHtml(s.name)}</div>
      <div class="wt-desig">${escapeHtml(desig)}</div>
      <div class="wt-meta">${escapeHtml(kname)} · ${s.constellation}</div>
      <div class="wt-coord">${escapeHtml(s.coordShort || '')}</div>
      ${msgHtml}
    </div>`;
  }).join('');
  box.querySelectorAll('.wall-tile').forEach(t=>{
    t.onclick = ()=>{
      const w = wall[+t.dataset.i];
      currentStar = w.star; currentKingdom = w.kingdom;
      card.build(currentStar, currentKingdom);
      window.scrollTo({ top:0, behavior:'smooth' });
      toast(t('已调阅 ') + w.star.name);
    };
  });
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- 云端共享星图 ----------
function openSharedStar(marker){
  if (!marker || !marker.share) return;
  const data = decodeStar(marker.share);
  if (!data){ toast(t('无法打开这颗星')); return; }
  currentStar = data.star; currentKingdom = data.kd; isShared = true;
  card.build(currentStar, currentKingdom);
  showSharedBanner();
  go('share');
}

async function loadCloudStars(){
  if (!skyMap) return;
  await ensureCloudSeed();
  const arr = await listStars(400);
  let myKey = null;
  if (currentStar && currentKingdom){
    try { myKey = starKey(encodeStar(currentStar, currentKingdom)); } catch(e){}
  }
  // 排除"我自己那颗"：既按分享码排除，也按登记号+星名排除。
  // 只按分享码排除不够 —— 恢复会话时重新生成的星，其分享码可能与当初推送的不一致，
  // 结果自己的星会在星图上出现两次（一次"我的星"、一次"好友星"）。
  const myNo = currentStar ? (currentStar.catalogNo || '') : '';
  const myName = currentStar ? (currentStar.name || '') : '';
  const filtered = arr.filter(s=>{
    if (myKey && s.code === myKey) return false;
    if (myNo && s.catalog_no && s.catalog_no === myNo && s.name === myName) return false;
    return true;
  });
  skyMap.setStars(filtered);
  if (filtered.length) toast(t('云端已点亮') + ' ' + filtered.length + ' ' + t('颗星辰 ✦'));
}

let notesKey = null;
async function loadNotes(){
  const box = document.getElementById('notes-list');
  if (!box) return;
  if (!currentStar || !currentKingdom){
    box.innerHTML = '<div class="notes-empty">' + t('先生成你的星图，再来留言吧 ✦') + '</div>';
    return;
  }
  let code; try { code = encodeStar(currentStar, currentKingdom); } catch(e){ box.innerHTML=''; return; }
  notesKey = starKey(code);
  const msgs = await listMessages(notesKey);
  if (!msgs.length){
    box.innerHTML = '<div class="notes-empty">' + t('还没有星语，写下第一句吧 ✦') + '</div>';
    return;
  }
  box.innerHTML = msgs.map(m=>{
    const t = new Date(m.created_at);
    const ts = isNaN(t.getTime()) ? '' : `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    return `<div class="note-item"><div class="note-head"><b>${escapeHtml(m.nick||'匿名旅人')}</b><span>${ts}</span></div><div class="note-text">${escapeHtml(m.text)}</div></div>`;
  }).join('');
}

async function postNote(){
  const text = (document.getElementById('notes-text').value||'').trim();
  const nick = (document.getElementById('notes-nick').value||'').trim();
  if (!text){ toast(t('写点什么再留下吧')); return; }
  if (!notesKey){ toast(t('星图还没准备好')); return; }
  const btn = document.getElementById('notes-submit');
  btn.disabled = true;
  try {
    await addMessage(notesKey, nick, text);
    document.getElementById('notes-text').value = '';
    await loadNotes();
    toast(t('星语已留在云端 ✦'));
  } catch(e){
    toast(t('留言发送失败，稍后再试'));
  } finally { btn.disabled = false; }
}

// 当云端尚为空时，写入若干演示星辰（含有效分享码），让“世界星图墙”与星空金色光点立即可见。
// 仅在空库时执行一次；演示星使用固定 code，重复写入会被唯一约束忽略，天然幂等。
let cloudSeeded = false;
async function ensureCloudSeed(){
  if (cloudSeeded) return; cloudSeeded = true;
  try {
    const existing = await listStars(60);
    if (existing && existing.length > 0) return;
  } catch(e){ return; }
  const flag = { bg:'#0b1026', accent:'#f5c97b', elements:{ star:true, border:true, band:true }, starCount:5, text:'' };
  const demos = [
    { i:'DEMO01', name:'织梦者',   kingdom:'微光联邦', zodiac:'随机', belief:'explore', hobbies:[], ra:88,  dec:22,  message:'愿每个仰望你的人，都被温柔以待。' },
    { i:'DEMO02', name:'远帆',     kingdom:'银帆共和国', zodiac:'天蝎座', belief:'freedom', hobbies:[], ra:250, dec:-22, message:'把烦恼留给地球，把目光交给星海。' },
    { i:'DEMO03', name:'Aether',   kingdom:'以太协约', zodiac:'天琴座', belief:'love',   hobbies:[], ra:285, dec:38,  message:'在群星之间，你从不渺小。' },
    { i:'DEMO04', name:'北辰',     kingdom:'不眠守望', zodiac:'小熊座', belief:'order',  hobbies:[], ra:230, dec:78,  message:'我守着这里，等你也亮起来。' },
    { i:'DEMO05', name:'余烬',     kingdom:'灰烬王朝', zodiac:'猎户座', belief:'create', hobbies:[], ra:83,  dec:0,   message:'熄灭之前，再烧旺一点。' },
    { i:'DEMO06', name:'Lumen',    kingdom:'流明城邦', zodiac:'狮子座', belief:'explore', hobbies:[], ra:160, dec:18, message:'光不为被看见而存在，却因你而动人。' },
    { i:'DEMO07', name:'潮音',     kingdom:'潮汐议会', zodiac:'双鱼座', belief:'truth',  hobbies:[], ra:350, dec:-8,  message:'宇宙很低语，只有安静的人听见。' },
    { i:'DEMO08', name:'炽心',     kingdom:'赤心联邦', zodiac:'白羊座', belief:'freedom', hobbies:[], ra:40,  dec:20,  message:'燃烧是星的本分，温柔是选的。' },
    { i:'DEMO09', name:'Nyx',      kingdom:'夜幕同盟', zodiac:'武仙座', belief:'order',  hobbies:[], ra:255, dec:30,  message:'夜越深，星越亮。' },
    { i:'DEMO10', name:'归航',     kingdom:'归航灯塔', zodiac:'仙女座', belief:'love',   hobbies:[], ra:30,  dec:40,  message:'无论走多远，总有一颗星等你回头。' }
  ];
  for (const d of demos){
    try {
      const answers = { zodiac: d.zodiac === '随机' ? 'random' : d.zodiac, constellation: 'random', beliefs: d.belief, hobbies: d.hobbies, personality: {} };
      const star = generateStar(answers);
      star.name = d.name;
      const kd = { name: d.kingdom, ruler: '星语旅人', message: d.message, laws: [], council: [], flag };
      const code = encodeStar(star, kd);
      await pushStar({
        code: d.i, share: code, name: star.name, designation: star.designation,
        ra: star.ra, dec: star.dec, color1: star.color1, color2: star.color2,
        spec: star.spec, constellation: star.constellation, owner_name: kd.name,
        mag: star.mag, distLy: star.distLy, message: kd.message
      }).catch(()=>{});
    } catch(e){ /* 单颗失败不影响其余 */ }
  }
}

async function renderCloudWall(){
  const box = document.getElementById('world-wall');
  const count = document.getElementById('wall-count');
  await ensureCloudSeed();
  const arr = await listStars(120);
  // 排除当前正在查看的星（自己的或正在浏览的分享星），避免星图墙上出现重复光点
  let curCode = null;
  if (currentStar && currentKingdom){ try { curCode = encodeStar(currentStar, currentKingdom); } catch(e){} }
  const shown = arr.filter(s => !(curCode && s.share === curCode));
  if (count) count.textContent = t('云端已点亮') + ' ' + shown.length + ' ' + t('颗星辰');
  if (!box) return;
  if (!shown.length){
    box.innerHTML = '<div class="wall-empty">' + t('还没有星辰被点亮。认领你的第一颗，让世界星图墙亮起来。') + '</div>';
    return;
  }
  box.innerHTML = shown.map((s,i)=>{
    const col = s.color1 || '#ffd27a';
    const kname = s.owner_name ? escapeHtml(s.owner_name) + t(' 的星') : (escapeHtml(s.name) + t(' 王国'));
    const desig = s.designation || '';
    // 星球寄语：来自云端 stars.message，让全世界的留言在星图墙上可见
    const msg = (s.message || '').trim();
    const msgHtml = msg ? `<div class="wt-msg">“${escapeHtml(msg)}”</div>` : '';
    return `<div class="wall-tile" data-share="${encodeURIComponent(s.share)}" style="color:${col};animation-delay:${(i*0.37).toFixed(2)}s">
      <div class="wt-orb" style="background:radial-gradient(circle at 35% 30%, #fff, ${col} 45%, ${col} 82%, #2a0f00)"></div>
      <div class="wt-name">${escapeHtml(s.name)}</div>
      <div class="wt-desig">${escapeHtml(desig)}</div>
      <div class="wt-meta">${kname} · ${escapeHtml(s.constellation||'')}</div>
      ${msgHtml}
    </div>`;
  }).join('');
  box.querySelectorAll('.wall-tile').forEach(t=>{
    t.onclick = ()=> openSharedStar({ share: decodeURIComponent(t.dataset.share) });
  });
}

// ---------- 真实星空场景 ----------
let skyMap = null;
function ensureSky(){
  if (skyMap) return;
  const host = document.getElementById('sky-host');
  skyMap = initSkyMap(host, { onSelect: showSkyInfo, onMarker: openSharedStar });
}
function mapUserStar(){
  return {
    ra: currentStar.ra, dec: currentStar.dec, name: currentStar.name,
    designation: currentStar.designation, catalogNo: currentStar.catalogNo,
    con: currentStar.constellation,
    mag: currentStar.mag, d: currentStar.distLy, dr: currentStar.dr,
    message: currentKingdom ? currentKingdom.message : '',
    label: currentStar.name
  };
}
function showSkyInfo(info){
  const box = document.getElementById('sky-info');
  lastSkyInfo = info;
  document.getElementById('si-name').textContent = info.name || '—';
  document.getElementById('si-desig').textContent = info.desig || '';
  const noEl = document.getElementById('si-no');
  noEl.textContent = info.no || '—';
  document.getElementById('si-coord').textContent = info.coord || '';
  document.getElementById('si-mag').textContent = info.mag || '—';
  document.getElementById('si-dist').textContent = info.dist || '—';
  // 星球寄语：紧跟编号下方，是认领者留下的心意
  const msgEl = document.getElementById('si-msg');
  if (info.message){
    msgEl.style.display = 'block';
    msgEl.innerHTML = '<span class="si-msg-cap">' + t('星球寄语') + '</span><span class="si-msg-txt">' + escapeHtml(info.message) + '</span>';
  } else {
    msgEl.style.display = 'none';
    msgEl.innerHTML = '';
  }
  // 归属者（好友的星）
  const ownerEl = document.getElementById('si-owner');
  if (info.owner_name){
    ownerEl.style.display = 'block';
    ownerEl.textContent = '认领者 · ' + info.owner_name;
  } else {
    ownerEl.style.display = 'none';
  }
  box.style.display = 'block';
}
document.getElementById('btn-to-explore').addEventListener('click', ()=> go('explore'));
document.getElementById('btn-sky-teaser')?.addEventListener('click', ()=> go('explore'));

// 电影开场：开门
document.getElementById('btn-open-door')?.addEventListener('click', openDoor);
document.getElementById('btn-skip-intro')?.addEventListener('click', ()=>{
  if (hasClaim()){ openMyStar(); return; }
  go('quiz');
});
const theDoor = document.getElementById('the-door');
if (theDoor){
  theDoor.addEventListener('click', openDoor);
  theDoor.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDoor(); } });
}
document.getElementById('explore-back').addEventListener('click', ()=> go('universe'));
document.getElementById('explore-next').addEventListener('click', ()=>{
  if (hasClaim()){ openMyStar(); return; }
  go('claim');
});
document.getElementById('sky-mine').addEventListener('click', ()=>{
  if (currentStar){ skyMap.setUserStar(mapUserStar()); toast(t('已定位你的星 ✦')); }
});
function doFind(){
  const q = document.getElementById('sky-search').value;
  if (!skyMap){ toast(t('星图加载中…')); return; }
  if (!skyMap.find(q)) toast(t('未找到该星，换个名字或编号试试'));
}
document.getElementById('sky-find').addEventListener('click', doFind);
document.getElementById('sky-search').addEventListener('keydown', e=>{ if (e.key === 'Enter') doFind(); });
document.getElementById('sky-zoom-in').addEventListener('click', ()=> skyMap && skyMap.zoomBy(1.4));
document.getElementById('sky-zoom-out').addEventListener('click', ()=> skyMap && skyMap.zoomBy(1/1.4));
document.getElementById('sky-reset').addEventListener('click', ()=> skyMap && skyMap.recenter());
document.querySelectorAll('.layer-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    const on = b.classList.toggle('active');
    skyMap && skyMap.setLayer(b.dataset.layer, on);
  });
});
document.getElementById('notes-form')?.addEventListener('submit', e=>{ e.preventDefault(); postNote(); });

// 提前预取真实星表，确保认领时即用
loadCatalog().catch(()=>{});

// 继续
const btnResume = document.getElementById('btn-resume');
btnResume.addEventListener('click', ()=>{
  const s = loadSession();
  if (!s || !s.answers){ toast(t('还没有进行中的星空')); return; }
  currentAnswers = s.answers;
  currentStar = generateStar(s.answers);
  // 还原用户为这颗星命的名：generateStar 生成的是天文名，
  // 而建国时用户把 currentStar.name 改成了自己的名字（并存进 kingdom.name）。
  // 不还原的话，"继续我的星空"后我的星在星图上会变回天文名，
  // 搜自己的星名就搜不到，编号/留言也会对不上。
  if (s.kingdom && s.kingdom.name) currentStar.name = s.kingdom.name;
  populateUniverse(currentStar);
  if (s.kingdom){ kingdom.restore(s.kingdom); }
  if (s.progress === 'share' && s.kingdom){
    currentKingdom = s.kingdom;
    if (s.flagSVG) currentKingdom.flagSVG = s.flagSVG;
    card.build(currentStar, currentKingdom);
    renderWall();
    go('share');
  } else if (s.progress === 'claim'){
    go('claim');
  } else {
    go('universe');
  }
});

if (!loadSession()) btnResume.style.display = 'none';

// 已认领：首页主 CTA 改为“查看我的星球”，并显式展示首页副按钮，保证随时可查阅
if (hasClaim()){
  const od = document.getElementById('btn-open-door');
  if (od){ od.textContent = t('查看我的星球 ✦'); od.removeAttribute('data-i18n'); }
  if (btnMineHome) btnMineHome.style.display = '';
}

// ---------- 启动 ----------
function showSharedBanner(){
  const b = document.getElementById('shared-banner');
  if (b) b.style.display = 'flex';
  const r = document.getElementById('btn-restart');
  if (r) r.textContent = hasClaim() ? t('查看我的星球 ✦') : t('我也要认一颗星 ✦');
}
function parseShareFromURL(){
  const data = parseCodeFromURL();
  if (!data) return false;
  currentStar = data.star; currentKingdom = data.kd; isShared = true;
  card.build(currentStar, currentKingdom);
  showSharedBanner();
  go('share');
  return true;
}

if (!parseShareFromURL()){
  go('home');
}

// 初始化语言切换按钮（含静态文案首轮翻译，依据 localStorage 记忆）
initLangToggle();

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 2000);
}

// ---------- 中英文切换：切换后重渲染当前页动态内容 ----------
function refreshI18n(){
  applyI18n();
  if (currentScreen === 'quiz' && quizCtl && quizCtl.redraw) quizCtl.redraw();
  else if (currentScreen === 'universe' && currentStar) populateUniverse(currentStar);
  else if (currentScreen === 'explore'){ if (lastSkyInfo) showSkyInfo(lastSkyInfo); }
  else if (currentScreen === 'claim'){ if (kingdom.applyFlag) kingdom.applyFlag(); }
  else if (currentScreen === 'share'){ if (currentStar && currentKingdom) card.build(currentStar, currentKingdom); renderWall(); }
}
window.__onLangChange = refreshI18n;
