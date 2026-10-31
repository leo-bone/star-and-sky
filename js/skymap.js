// 真实星空图：基于真实星表的全天交互星图（赤道坐标等距投影）
// 能力：真实恒星/星座连线/星座名/银河带/行星/用户星与好友星高亮/按名或注册号搜索定位/
//       平移缩放/图层开关/真实行星实时位置/点击好友星打开其星页
import { planetPositions } from './planets.js?v=20261056';
import { loadCatalog } from './catalog.js?v=20261056';
import { t, getLang } from './i18n.js?v=20261056';

const CON_NAMES = {
  And:'仙女座',Ant:'唧筒座',Aps:'天燕座',Aql:'天鹰座',Aqr:'宝瓶座',Ara:'天坛座',Ari:'白羊座',
  Aur:'御夫座',Boo:'牧夫座',Cae:'雕具座',Cam:'鹿豹座',Cnc:'巨蟹座',CVn:'猎犬座',CMa:'大犬座',
  Cmi:'小犬座',Cap:'摩羯座',Car:'船底座',Cas:'仙后座',Cen:'半人马座',Cep:'仙王座',Cet:'鲸鱼座',
  Cha:'蝘蜓座',Cir:'圆规座',Col:'天鸽座',Com:'后发座',CrA:'南冕座',CrB:'北冕座',Crv:'乌鸦座',
  Crt:'巨爵座',Cru:'南十字座',Cyg:'天鹅座',Del:'海豚座',Dor:'剑鱼座',Dra:'天龙座',Equ:'小马座',
  Eri:'波江座',For:'天炉座',Gem:'双子座',Gru:'天鹤座',Her:'武仙座',Hor:'时钟座',Hya:'长蛇座',
  Hyi:'水蛇座',Ind:'印第安座',Lac:'蝎虎座',Leo:'狮子座',LMi:'小狮座',Lep:'天兔座',Lib:'天秤座',
  Lup:'豺狼座',Lyn:'天猫座',Lyr:'天琴座',Men:'山案座',Mic:'显微镜座',Mon:'麒麟座',Mus:'苍蝇座',
  Nor:'矩尺座',Oct:'南极座',Oph:'蛇夫座',Ori:'猎户座',Pav:'孔雀座',Peg:'飞马座',Per:'英仙座',
  Phe:'凤凰座',Pic:'绘架座',PsA:'南鱼座',Pyx:'罗盘座',Ret:'网罟座',Sge:'天箭座',
  Sgr:'人马座',Sco:'天蝎座',Scl:'玉夫座',Sct:'盾牌座',Ser:'巨蛇座',Sex:'六分仪座',Tau:'金牛座',
  Tel:'望远镜座',Tri:'三角座',TrA:'南三角座',Tuc:'杜鹃座',UMa:'大熊座',UMi:'小熊座',Vel:'船帆座',
  Vir:'室女座',Vol:'飞鱼座',Vul:'狐狸座'
};

// IAU 标准英文名（拉丁名，即英文通用名），用于英文模式下的星座标注
const CON_NAMES_EN = {
  And:'Andromeda',Ant:'Antlia',Aps:'Apus',Aql:'Aquila',Aqr:'Aquarius',Ara:'Ara',Ari:'Aries',
  Aur:'Auriga',Boo:'Boötes',Cae:'Caelum',Cam:'Camelopardalis',Cnc:'Cancer',CVn:'Canes Venatici',
  CMa:'Canis Major',Cmi:'Canis Minor',Cap:'Capricornus',Car:'Carina',Cas:'Cassiopeia',Cen:'Centaurus',
  Cep:'Cepheus',Cet:'Cetus',Cha:'Chamaeleon',Cir:'Circinus',Col:'Columba',Com:'Coma Berenices',
  CrA:'Corona Australis',CrB:'Corona Borealis',Crv:'Corvus',Crt:'Crater',Cru:'Crux',Cyg:'Cygnus',
  Del:'Delphinus',Dor:'Dorado',Dra:'Draco',Equ:'Equuleus',Eri:'Eridanus',For:'Fornax',Gem:'Gemini',
  Gru:'Grus',Her:'Hercules',Hor:'Horologium',Hya:'Hydra',Hyi:'Hydrus',Ind:'Indus',Lac:'Lacerta',
  Leo:'Leo',LMi:'Leo Minor',Lep:'Lepus',Lib:'Libra',Lup:'Lupus',Lyn:'Lynx',Lyr:'Lyra',Men:'Mensa',
  Mic:'Microscopium',Mon:'Monoceros',Mus:'Musca',Nor:'Norma',Oct:'Octans',Oph:'Ophiuchus',Ori:'Orion',
  Pav:'Pavo',Peg:'Pegasus',Per:'Perseus',Phe:'Phoenix',Pic:'Pictor',PsA:'Piscis Austrinus',Pyx:'Pyxis',
  Ret:'Reticulum',Sge:'Sagitta',Sgr:'Sagittarius',Sco:'Scorpius',Scl:'Sculptor',Sct:'Scutum',Ser:'Serpens',
  Sex:'Sextans',Tau:'Taurus',Tel:'Telescopium',Tri:'Triangulum',TrA:'Triangulum Australe',Tuc:'Tucana',
  UMa:'Ursa Major',UMi:'Ursa Minor',Vel:'Vela',Vir:'Virgo',Vol:'Volans',Vul:'Vulpecula'
};

// 按当前语言返回星座名：中文用 CON_NAMES；英文优先用 IAU 码映射 CON_NAMES_EN，
// 若传入的是中文名（如用户星 constellation 存的是中文），则经 t() 翻成英文，避免回退成中文。
function conName(code){
  if (getLang() !== 'en') return CON_NAMES[code] || code;
  if (CON_NAMES_EN[code]) return CON_NAMES_EN[code];   // IAU 码 → 英文（如 'Leo'→'Leo'）
  const en = t(code);                                  // 中文名 → 英文（如 '狮子座'→'Leo'）
  return (en && en !== code) ? en : code;
}

function bvColor(bv){
  if (bv == null) return [255,255,255];
  if (bv < -0.30) return [155,176,255];
  if (bv <  0.00) return [175,196,255];
  if (bv <  0.30) return [202,215,255];
  if (bv <  0.55) return [248,247,255];
  if (bv <  0.80) return [255,244,234];
  if (bv <  1.10) return [255,210,161];
  if (bv <  1.45) return [255,181,108];
  if (bv <  1.85) return [255,148,92];
  return [255,128,90];
}
function magRadius(mag){
  let r = 3.0 - 0.55*mag;
  if (mag < 2) r *= 1.3;          // 亮星更突出
  return Math.max(0.18, Math.min(8, r));
}

// 银道坐标(l,b) → 赤道(ra,dec)  J2000
const RA_NGP = 192.85948*Math.PI/180, DEC_NGP = 27.12825*Math.PI/180, L_NCP = 122.93192*Math.PI/180;
function galToEq(l_deg, b_deg){
  const l = l_deg*Math.PI/180, b = b_deg*Math.PI/180;
  const sinDec = Math.sin(b)*Math.sin(DEC_NGP) + Math.cos(b)*Math.cos(DEC_NGP)*Math.cos(l - L_NCP);
  const dec = Math.asin(Math.max(-1,Math.min(1,sinDec)));
  const y = Math.sin(l - L_NCP)*Math.cos(b);
  const x = Math.cos(l - L_NCP)*Math.cos(b)*Math.sin(DEC_NGP) - Math.sin(b)*Math.cos(DEC_NGP);
  let ra = Math.atan2(y, x) + RA_NGP;
  ra = ra*180/Math.PI; ra = ((ra%360)+360)%360;
  return { ra, dec: dec*180/Math.PI };
}

export function initSkyMap(container, opts = {}){
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;touch-action:none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');

  let W=0, H=0, dpr=1, baseScale=1;
  let stars=[], constellations=null, mwPath=[];
  let markers=[];           // 用户星 / 好友星 / 搜索命中：{ra,dec,name,desig,con,mag,d,dr,type,color,share,owner_name}
  let mine=null;            // 指向“我的星”标记
  let selected=null;        // 当前聚焦的标记（脉冲 + 标签）
  let foundActive=false, pulse=0;
  let running=false, dirty=true;   // 渲染循环自暂停：空闲（无脉冲、无待重绘）时停 rAF，省 CPU/电量/移动端掉帧
  function wake(){ if (!running){ running = true; requestAnimationFrame(frame); } }
  const cam = { ra:180, dec:0, zoom:1 };
  const layers = { lines:true, names:true, mw:true, planets:true };
  let planets=[];
  let drag=null, downPt=null, dragMoved=false;
  const onSelect = opts.onSelect || (()=>{});
  const onMarker = opts.onMarker || (()=>{});

  function resize(){
    const r = container.getBoundingClientRect();
    W = Math.max(320, r.width); H = Math.max(240, r.height);
    dpr = Math.min(2, window.devicePixelRatio||1);
    for (const c of [canvas, base]){ c.width = Math.round(W*dpr); c.height = Math.round(H*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    bctx.setTransform(dpr,0,0,dpr,0,0);
    baseScale = Math.min(W/360, H/180);
    renderBase();
  }

  function project(ra, dec){
    let dRa = ra - cam.ra;
    dRa = ((dRa + 180) % 360 + 360) % 360 - 180;
    const x = W/2 + dRa * baseScale * cam.zoom;
    const y = H/2 - (dec - cam.dec) * baseScale * cam.zoom;
    return { x, y, dRa };
  }

  function buildMW(){
    mwPath=[];
    for (let l=0; l<=360; l+=3){ mwPath.push(galToEq(l,0)); }
  }

  function drawStar(c, s, x, y){
    const r = magRadius(s.mag) * Math.max(0.7, Math.min(1.6, cam.zoom*0.6+0.5));
    const col = bvColor(s.bv);
    if (s.mag < 2.1){            // 主星：强辉光
      const g = c.createRadialGradient(x,y,0,x,y,r*3.8);
      g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.72)`);
      g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x,y,r*3.8,0,7); c.fill();
    } else if (s.mag < 3.6){      // 次亮星：弱辉光，拉开层级
      const g = c.createRadialGradient(x,y,0,x,y,r*2.4);
      g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.28)`);
      g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x,y,r*2.4,0,7); c.fill();
    }
    const a = Math.max(0.10, Math.min(1, 1.3 - s.mag*0.16));   // 暗星更暗、亮星更亮，层次拉开
    c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    c.beginPath(); c.arc(x,y,r,0,7); c.fill();
  }

  function renderBase(){
    if (!W) return;
    bctx.clearRect(0,0,W,H);
    const bg = bctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#05070f'); bg.addColorStop(1,'#02030a');
    bctx.fillStyle = bg; bctx.fillRect(0,0,W,H);
    if (!stars.length) return;

    const ppd = baseScale * cam.zoom;

    // 银河带
    if (layers.mw && mwPath.length){
      bctx.lineJoin='round'; bctx.lineCap='round';
      bctx.beginPath();
      mwPath.forEach((p,i)=>{ const q=project(p.ra,p.dec); if(i===0)bctx.moveTo(q.x,q.y); else bctx.lineTo(q.x,q.y); });
      bctx.strokeStyle='rgba(150,170,230,0.05)'; bctx.lineWidth=Math.max(20, 16*ppd*0.6);
      bctx.stroke();
      bctx.strokeStyle='rgba(210,220,255,0.10)'; bctx.lineWidth=Math.max(6, 5*ppd*0.6);
      bctx.stroke();
      bctx.strokeStyle='rgba(255,245,220,0.06)'; bctx.lineWidth=Math.max(2, 1.6*ppd*0.6);
      bctx.stroke();
    }

    // 星座连线
    if (layers.lines && constellations){
      bctx.strokeStyle='rgba(120,150,210,0.30)'; bctx.lineWidth=0.8;
      for (const feat of constellations.features){
        const segs = feat.geometry.coordinates;
        for (const seg of segs){
          for (let i=0;i<seg.length-1;i++){
            const a=project(seg[i][0],seg[i][1]), b=project(seg[i+1][0],seg[i+1][1]);
            if (Math.abs(a.dRa-b.dRa)>180) continue;
            if ((a.x<-60||a.x>W+60)&&(b.x<-60||b.x>W+60)) continue;
            bctx.beginPath(); bctx.moveTo(a.x,a.y); bctx.lineTo(b.x,b.y); bctx.stroke();
          }
        }
      }
    }

    // 恒星（按星等升序，亮星后画在上层）
    const limit = cam.zoom < 1.6 ? 5.6 : 6.2;
    for (const s of stars){
      if (s.mag > limit) continue;
      const p = project(s.ra, s.dec);
      if (p.x < -20 || p.x > W+20 || p.y < -20 || p.y > H+20) continue;
      drawStar(bctx, s, p.x, p.y);
    }

    // 行星
    if (layers.planets && planets.length){
      for (const pl of planets){
        if (pl.kind==='sun') continue;
        const p = project(pl.ra, pl.dec);
        if (p.x<-20||p.x>W+20||p.y<-20||p.y>H+20) continue;
        const r = pl.kind==='moon'?4: (pl.mag<-1?5: pl.mag<2?4:3);
        const g=bctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.6);
        g.addColorStop(0,pl.color); g.addColorStop(1,'rgba(0,0,0,0)');
        bctx.fillStyle=g; bctx.beginPath(); bctx.arc(p.x,p.y,r*2.6,0,7); bctx.fill();
        bctx.fillStyle=pl.color; bctx.beginPath(); bctx.arc(p.x,p.y,r,0,7); bctx.fill();
        bctx.fillStyle='rgba(230,238,255,0.85)'; bctx.font='10px Space Grotesk, sans-serif';
        const tw = bctx.measureText(pl.name).width;
        let lx = p.x + r + 3;
        if (lx + tw > W - 4) lx = p.x - r - 3 - tw;
        if (lx < 4) lx = 4;
        bctx.fillText(pl.name, lx, p.y + 3);
      }
    }

    // 星座名：随缩放自适应字号与透明度；缩小时变淡、字号收窄，避免文字堆砌杂乱
    if (layers.names && constellations){
      const z = cam.zoom;
      const nameSize = Math.max(8, Math.min(15, 8.5 * Math.min(z, 1.7)));
      const nameAlpha = Math.max(0.12, Math.min(0.6, 0.16 + (z - 1) * 0.55));
      bctx.fillStyle = `rgba(176,194,238,${nameAlpha.toFixed(3)})`;
      bctx.font = `${nameSize}px "Noto Sans SC", sans-serif`; bctx.textAlign='center';
      for (const feat of constellations.features){
        const ab = feat.id; const nm = conName(ab); if(!nm) continue;
        let sx=0, sy=0, n=0;
        for (const seg of feat.geometry.coordinates) for (const pt of seg){
          const cr=Math.cos(pt[0]*Math.PI/180), sr=Math.sin(pt[0]*Math.PI/180);
          sx+=cr; sy+=sr; n++;
        }
        const cra=Math.atan2(sy,sx)*180/Math.PI; const cdec=feat._avgdec;
        const p=project(cra,cdec);
        if (p.x<-30||p.x>W+30||p.y<-30||p.y>H+30) continue;
        bctx.fillText(nm, p.x, p.y);
      }
      bctx.textAlign='start';
    }

    // 用户星 / 好友星 标记
    for (const m of markers){
      const p = project(m.ra, m.dec);
      if (p.x<-30||p.x>W+30||p.y<-30||p.y>H+30) continue;
      drawMarker(bctx, p.x, p.y, m);
    }
    dirty = true;   // 基础图层已重绘：标记待合成，确保 frame() 把离屏 base 贴到可见 canvas（否则按钮点击后画面不更新、看似失灵）
    wake();         // 唤醒渲染循环（空闲时自动停，省电不掉帧）
  }

  function drawMarker(c, x, y, m){
    const col = m.color || (m.type==='mine' ? '#5fe0ff' : '#ffd27a');
    const isMine = m.type === 'mine';
    // 发光星点（确保即使在暗星区也可见）
    const g = c.createRadialGradient(x,y,0,x,y,10);
    g.addColorStop(0, col); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.95; c.fillStyle = g;
    c.beginPath(); c.arc(x,y,10,0,7); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = col; c.beginPath(); c.arc(x,y,3.2,0,7); c.fill();
    // 准星
    c.strokeStyle = col; c.lineWidth = 1.4; c.globalAlpha = 0.9;
    c.beginPath();
    c.moveTo(x-14,y); c.lineTo(x-5,y); c.moveTo(x+5,y); c.lineTo(x+14,y);
    c.moveTo(x,y-14); c.lineTo(x,y-5); c.moveTo(x,y+5); c.lineTo(x,y+14);
    c.stroke();
    // 外环
    c.beginPath(); c.arc(x,y,9,0,7); c.stroke();
    c.globalAlpha = 1;
    if (isMine){
      c.fillStyle = '#cdeaff'; c.font = 'bold 12px "Noto Sans SC", sans-serif';
      c.fillText(t('我的星 ✦'), x + 14, y - 10);
    }
  }

  function frame(){
    running = true;
    // 标签页隐藏：保持循环存活，恢复后继续（不空转渲染）
    if (document.hidden){ requestAnimationFrame(frame); return; }
    const animating = !!(selected && foundActive);
    // 空闲（无选中脉冲 且 无待重绘）：绘制最后一帧后停止循环，避免一直满帧空转掉帧
    if (!animating && !dirty){ running = false; return; }
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(base,0,0,W,H);
    if (animating){
      const p = project(selected.ra, selected.dec);
      if (p.x>-40 && p.x<W+40 && p.y>-40 && p.y<H+40){
        const rr = 14 + Math.sin(pulse)*5;
        ctx.strokeStyle = `rgba(95,224,255,${0.5+0.3*Math.sin(pulse)})`; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(p.x,p.y,rr,0,7); ctx.stroke();
        // 标签
        const label = selected.owner_name && selected.type==='friend'
          ? `${selected.name} · ${selected.owner_name}`
          : (selected.label || selected.name || t('我的星'));
        ctx.font='bold 13px "Noto Sans SC", sans-serif';
        const w = ctx.measureText(label).width + 16;
        ctx.fillStyle='rgba(10,16,34,0.86)';
        ctx.fillRect(p.x+16, p.y-30, w, 22);
        ctx.strokeStyle='rgba(245,201,123,0.7)'; ctx.strokeRect(p.x+16, p.y-30, w, 22);
        ctx.fillStyle='#f3d79a'; ctx.fillText(label, p.x+24, p.y-14);
      }
    }
    pulse += 0.05;
    dirty = false;
    if (animating) requestAnimationFrame(frame);   // 脉冲持续：保持循环
    else running = false;                           // 静态帧已绘制：停止循环
  }

  // ---- 交互 ----
  canvas.addEventListener('pointerdown', e=>{
    drag={x:e.clientX,y:e.clientY,ra:cam.ra,dec:cam.dec};
    downPt={x:e.clientX,y:e.clientY}; dragMoved=false;
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing';
  });
  canvas.addEventListener('pointermove', e=>{
    if(!drag) return;
    if (downPt && (Math.abs(e.clientX-downPt.x)>5 || Math.abs(e.clientY-downPt.y)>5)) dragMoved=true;
    const ppd = baseScale*cam.zoom;
    cam.ra = drag.ra - (e.clientX-drag.x)/ppd; cam.ra=((cam.ra%360)+360)%360;
    cam.dec = Math.max(-89, Math.min(89, drag.dec + (e.clientY-drag.y)/ppd));
    renderBase();
  });
  const endDrag = ()=>{ drag=null; canvas.style.cursor='grab'; };
  canvas.addEventListener('pointerup', e=>{
    if (!dragMoved){ hitTestMarker(e); }
    endDrag();
  });
  canvas.addEventListener('pointerleave', endDrag);
  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    const f = e.deltaY<0 ? 1.18 : 1/1.18;
    cam.zoom = Math.max(1, Math.min(12, cam.zoom*f));
    renderBase();
  }, { passive:false });

  function hitTestMarker(e){
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best=null, bestD=18*18;
    for (const m of markers){
      const p = project(m.ra, m.dec);
      const dx=p.x-x, dy=p.y-y; const d=dx*dx+dy*dy;
      if (d<bestD){ bestD=d; best=m; }
    }
    if (best){
      selected = best; foundActive = true;
      onSelect(buildInfo(best));
      if (best.type==='friend' && best.share) onMarker(best);
      renderBase();
    }
  }

  // ---- 公共 API ----
  function setUserStar(star){
    if (!star) return;
    markers = markers.filter(m => m.type !== 'mine');
    const m = {
      ra: star.ra, dec: star.dec, name: star.name,
      desig: star.designation || star.desig, con: star.constellation || star.con,
      mag: star.mag, d: star.distLy, dr: star.dr, no: star.catalogNo, message: star.message,
      type: 'mine', color: '#5fe0ff', label: star.name, share: star.share || null
    };
    markers.push(m); mine = m;
    cam.ra = m.ra; cam.dec = m.dec; cam.zoom = Math.max(cam.zoom, 3);
    selected = m; foundActive = true;
    renderBase();
    onSelect(buildInfo(m));
  }
  function setStars(arr){
    markers = markers.filter(m => m.type !== 'friend');
    for (const s of (arr||[])){
      markers.push({
        ra: s.ra, dec: s.dec, name: s.name, desig: s.designation,
        con: s.constellation, mag: s.mag, d: s.dist_ly, dr: 0,
        // 编号优先用云端的登记号(catalog_no)，没有才退回天文编号
        no: s.catalog_no || s.designation,
        message: s.message || '',
        type: 'friend', color: s.color1 || '#ffd27a',
        share: s.share, owner_name: s.owner_name
      });
    }
    renderBase();
  }
  function addStar(m){ // 单颗添加（保留其它）
    markers.push(m); renderBase();
  }
  function buildInfo(s){
    const parts=[];
    if (s.desig) parts.push(s.desig);
    if (s.con){ const cn = conName(s.con); if (cn) parts.push(cn); }
    const raH=Math.floor(s.ra/15), raM=Math.floor((s.ra/15-raH)*60);
    const sign=s.dec>=0?'+':'−', ad=Math.abs(s.dec);
    const decD=Math.floor(ad), decM=Math.floor((ad-decD)*60);
    return {
      name: s.label||s.name||t('我的星'),
      desig: parts.join(' · '),
      no: s.no || (s.desig || ''),
      coord: `RA ${raH}h${String(raM).padStart(2,'0')}m  Dec ${sign}${decD}°${String(decM).padStart(2,'0')}′`,
      mag: s.mag!=null?s.mag.toFixed(2):'—',
      // 优先用数值距离（d）；若缺失（如旧版认领码未序列化 distLy），回退到已生成的 distance 文案，避免显示“—”
      dist: s.d!=null? (s.dr? '' : '≈') + s.d + t('光年') : (s.distance || '—'),
      message: s.message || '',
      owner_name: s.owner_name || '',
      ra: s.ra, dec: s.dec
    };
  }
  function find(query){
    const q=(query||'').trim().toLowerCase();
    if(!q) return false;
    let hit=null;

    // ---- 匹配优先级 ----
    // 1) 自己的星（精确名 > 部分名）—— 用户最可能找的是自己命名的星
    // 2) 好友的星（精确名 > 部分名）
    // 3) 真实星表
    // 早期版本让星表先匹配，会出现"我命名的 88 搜出来却是 HD 号含 88 的真星"，
    // 自己的星与留言根本找不到。
    const myName = ((mine && (mine.label||mine.name)) || '').toLowerCase();
    if (myName){
      if (myName === q) hit = { ...mine, n: mine.label||mine.name };
      else if (myName.includes(q)) hit = { ...mine, n: mine.label||mine.name };
    }
    // 好友的星
    if (!hit){
      const friends = markers.filter(m => m.type === 'friend');
      for (const m of friends){
        const nm = (m.name||m.label||'').toLowerCase();
        if (nm && nm === q){ hit = m; break; }
      }
      if (!hit) for (const m of friends){
        const cand = [m.name, m.label, m.no, m.desig, m.owner_name].filter(Boolean).join(' ').toLowerCase();
        if (cand.includes(q)){ hit = m; break; }
      }
    }
    // 真实星表
    if (!hit){
      for (const s of stars){
        const name=(s.n||'').toLowerCase();
        const bayer=(s.b||'')+(s.c||'');
        const flam=(s.f?s.f+' '+s.c:'').toLowerCase();
        const desig=(s.b?s.b+' '+s.c:(s.f?s.f+' '+s.c:'')).toLowerCase();
        if (name && name.includes(q)) { hit=s; break; }
        if (s.hd && ('hd '+s.hd).includes(q)) { hit=s; break; }
        if (s.hip && ('hip '+s.hip).includes(q)) { hit=s; break; }
        if (bayer.toLowerCase().includes(q) || desig.includes(q) || flam.includes(q)) { hit=s; break; }
      }
    }
    if (!hit) return false;

    // 统一成 marker 结构：保留编号、留言、归属者、分享码
    const isMine = hit === mine || (mine && hit.n === (mine.label||mine.name) && hit.ra === mine.ra);
    const m = {
      ra:hit.ra, dec:hit.dec, name:hit.n||hit.label||hit.name,
      desig:(hit.b?hit.b+' ':'')+(hit.f?hit.f+' ':'')+(hit.c||''),
      con:hit.c, mag:hit.mag, d:hit.d, dr:hit.dr,
      no: hit.no || hit.designation || hit.catalogNo || '',
      message: hit.message || '',
      owner_name: hit.owner_name || '',
      share: hit.share || null,
      type:'found', color:'#5fe0ff'
    };
    markers = markers.filter(x=>x.type!=='found'); markers.push(m);
    cam.ra=m.ra; cam.dec=m.dec; cam.zoom = Math.max(cam.zoom,3);
    selected=m; foundActive=true; renderBase(); onSelect(buildInfo(m));
    return true;
  }
  function setLayer(name, val){ layers[name]=val; renderBase(); }
  function zoomBy(f){ cam.zoom=Math.max(1,Math.min(12,cam.zoom*f)); renderBase(); }
  function recenter(){ cam.ra=180; cam.dec=0; cam.zoom=1; foundActive=false; selected=null; renderBase(); }

  // 数据加载失败时在星图容器上显示可见提示（不再静默吞掉，便于定位问题）
  function showSkyError(msg){
    try{
      let d = container.querySelector('.sky-loaderr');
      if (!d){
        d = document.createElement('div');
        d.className = 'sky-loaderr';
        d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
          + 'color:#ffd27a;font-size:14px;text-align:center;padding:24px;pointer-events:none;z-index:6';
        container.appendChild(d);
      }
      d.textContent = msg;
    }catch(e){ console.warn('星图错误提示渲染失败', e); }
  }

  async function init(){
    // 双数据源【独立】加载：任一失败都不拖垮另一个，避免出现“整片星空空白、按钮看似全部失灵”的假象
    let sd = null, cd = null;
    try { sd = await loadCatalog(); }
    catch(e){ console.warn('星表加载失败（stars.json）', e); }
    try {
      const r = await fetch('data/constellations.lines.json');
      cd = await r.json();
    } catch(e){ console.warn('星座连线数据加载失败（constellations.lines.json）', e); }

    if (sd) stars = sd;
    if (cd && cd.features){
      constellations = cd;
      for (const feat of constellations.features){
        try{
          let sy=0,n=0;
          for (const seg of feat.geometry.coordinates) for (const pt of seg){ sy+=pt[1]; n++; }
          feat._avgdec = sy/n;
        }catch(e){ /* 单条星座几何异常忽略，不影响其余 */ }
      }
    }
    buildMW();
    try { planets = planetPositions(new Date()); } catch(e){ console.warn('行星位置计算失败', e); planets = []; }

    resize();
    frame();

    // 可见化上报：核心数据缺失时明确提示，而不是静默空白让按钮“看起来失灵”
    if (!stars.length && !constellations){
      showSkyError(t('星图数据加载失败，请刷新页面或检查网络'));
    } else if (container && container.querySelector){
      const d = container.querySelector('.sky-loaderr'); if (d) d.remove();
    }
  }
  init();
  window.addEventListener('resize', resize);

  return { resize, setUserStar, setStars, addStar, find, setLayer, zoomBy, recenter, buildInfo };
}
