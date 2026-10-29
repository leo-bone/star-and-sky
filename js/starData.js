import { hashString, mulberry32, rand, randInt, pick } from './rng.js?v=20261029';
import { pickRealStar } from './catalog.js?v=20261029';
import { t } from './i18n.js?v=20261029';

// 光谱类型：颜色、温度区间、权重（恒星形态）
const SPECTRAL = {
  O: { c1:'#a9c8ff', c2:'#3b5bd0', t:[30000,48000], w:0.02, name:'蓝特超巨星' },
  B: { c1:'#bcd2ff', c2:'#5a7ae0', t:[11000,30000], w:0.05, name:'蓝白星' },
  A: { c1:'#dfe9ff', c2:'#8fb0e8', t:[7500,11000],  w:0.08, name:'白色星' },
  F: { c1:'#fff0c0', c2:'#efb85e', t:[6000,7500],   w:0.13, name:'黄白星' },
  G: { c1:'#ffd66b', c2:'#d2711c', t:[5200,6000],   w:0.18, name:'类太阳黄星' },
  K: { c1:'#ffb866', c2:'#c25a1e', t:[3700,5200],   w:0.27, name:'橙矮星' },
  M: { c1:'#ff8a5c', c2:'#a5291a', t:[2400,3700],   w:0.27, name:'红矮星' }
};

// 星座元数据：中文名 / 拉丁生格(genitive, 国际命名用) / IAU 三字母缩写 / 天球坐标范围
// 生格与缩写采用国际天文学联合会(IAU)标准，使命名具备真实天文惯例的逻辑
const CONSTELLATIONS = [
  { zh:'猎户座', gen:'Orionis',          iau:'Ori', ra:[4.8,6.0],   dec:[-11,23]  },
  { zh:'天琴座', gen:'Lyrae',            iau:'Lyr', ra:[18.0,19.2], dec:[25,47]   },
  { zh:'仙女座', gen:'Andromedae',       iau:'And', ra:[0.0,2.7],   dec:[21,53]   },
  { zh:'天蝎座', gen:'Scorpii',          iau:'Sco', ra:[16.0,17.7], dec:[-45,-8]  },
  { zh:'大熊座', gen:'Ursae Majoris',    iau:'UMa', ra:[8.0,14.7],  dec:[28,73]   },
  { zh:'小熊座', gen:'Ursae Minoris',    iau:'UMi', ra:[14.0,18.0], dec:[65,90]   },
  { zh:'天鹰座', gen:'Aquilae',          iau:'Aql', ra:[18.5,20.5], dec:[-11,18]  },
  { zh:'天鹅座', gen:'Cygni',            iau:'Cyg', ra:[19.0,22.0], dec:[27,60]   },
  { zh:'武仙座', gen:'Herculis',         iau:'Her', ra:[16.0,18.5], dec:[4,51]    },
  { zh:'英仙座', gen:'Persei',           iau:'Per', ra:[1.5,4.5],   dec:[30,59]   },
  { zh:'双子座', gen:'Geminorum',        iau:'Gem', ra:[5.5,8.0],   dec:[10,35]   },
  { zh:'狮子座', gen:'Leonis',           iau:'Leo', ra:[9.0,11.7],  dec:[-6,33]   },
  { zh:'室女座', gen:'Virginis',         iau:'Vir', ra:[11.0,15.0], dec:[-22,14]  },
  { zh:'天秤座', gen:'Librae',           iau:'Lib', ra:[14.0,16.0], dec:[-25,9]   },
  { zh:'麒麟座', gen:'Monocerotis',      iau:'Mon', ra:[5.5,8.5],   dec:[-11,12]  },
  { zh:'船底座', gen:'Carinae',          iau:'Car', ra:[6.0,11.0],  dec:[-75,-50] },
  { zh:'御夫座', gen:'Aurigae',          iau:'Aur', ra:[4.5,7.0],   dec:[28,56]   },
  { zh:'北冕座', gen:'Coronae Borealis', iau:'CrB', ra:[15.0,16.3], dec:[26,39]   },
  { zh:'蛇夫座', gen:'Ophiuchi',         iau:'Oph', ra:[16.0,18.5], dec:[-30,14]  },
  { zh:'长蛇座', gen:'Hydrae',           iau:'Hya', ra:[8.0,15.0],  dec:[-35,7]   }
];

// 光谱型→中文名：同一光谱型按推算半径区分光度级（矮星/巨星/超巨星），
// 避免把红超巨星（如参宿四）错标为“红矮星”这类天文错误。
// 这里只产出“原始中文键”，展示时由 localizedSpecName 按当前语言翻译，保证切换语言即时生效。
function spectralNameRaw(spec, radiusSolar){
  const base = SPECTRAL[spec] ? SPECTRAL[spec].name : '恒星';
  const r = radiusSolar || 0;
  if (spec === 'M'){ if (r > 50) return '红超巨星'; if (r > 10) return '红巨星'; return '红矮星'; }
  if (spec === 'K'){ if (r > 20) return '橙巨星'; return '橙矮星'; }
  if (spec === 'G'){ if (r > 15) return '黄巨星'; return '类太阳黄星'; }
  if (spec === 'F'){ if (r > 20) return '黄白巨星'; return '黄白星'; }
  return base;
}
export function localizedSpecName(spec, radiusSolar){ return t(spectralNameRaw(spec, radiusSolar)); }

// 拜耳命名希腊字母（IAU 标准 24 个）；早期字母更稀有，符合真实星表分布
const GREEK = ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π','ρ','σ','τ','υ','φ','χ','ψ','ω'];

// 依据星座与坐标，生成符合国际惯例的星体命名：
//  · 拜耳(Bayer)/佛兰斯蒂德(Flamsteed) 生格名  例：α Orionis / 58 Orionis
//  · HD / HIP 星表编号（亨利·德雷伯星表 / 依巴谷星表）
//  · J 变星式坐标命名（SSS Jhhmm±dd），与我们的注册局前缀一致
function makeDesignations(rng, cst, raVal, decVal){
  const flam = randInt(rng, 1, 98);
  const gIdx = Math.min(GREEK.length-1, Math.floor(Math.pow(rng(), 1.8) * GREEK.length));
  const greek = GREEK[gIdx];
  const useBayer = rng() < 0.34;
  const desig = useBayer ? `${greek} ${cst.gen}` : `${flam} ${cst.gen}`;
  const hd  = 1000 + randInt(rng, 0, 357000);
  const hip = randInt(rng, 1, 120000);
  const raH = Math.floor(((raVal%24)+24)%24);
  const raM = Math.floor((((raVal%24)+24)%24 - raH)*60);
  const jRA = String(raH).padStart(2,'0') + String(raM).padStart(2,'0');
  const sign = decVal >= 0 ? '+' : '-';
  const jDec = String(Math.abs(Math.round(decVal))).padStart(2,'0');
  const jname = `SSS J${jRA}${sign}${jDec}`;
  return { desig, iau:cst.iau, gen:cst.gen, hd:`HD ${hd}`, hip:`HIP ${hip}`, jname,
           catalogNo:`SSS-${String(randInt(rng,100000,999999))}` };
}

function fmtRA(hours){
  hours = ((hours % 24) + 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.round(((hours - h) * 60 - m) * 60);
  return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
}
function fmtDec(deg){
  const sign = deg >= 0 ? '+' : '−';
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60);
  return `${sign}${d}° ${String(m).padStart(2,'0')}′ ${String(s).padStart(2,'0')}″`;
}

const GALAXIES = {
  explore:  ['银河系悬臂边缘','本星系群外围','室女座超星系团','拉尼亚凯亚巨引源'],
  freedom:  ['银河系银晕','大麦哲伦云','小麦哲伦云','仙女座外围'],
  truth:    ['银河系猎户臂','三角座星系','玉夫座矮星系','天炉座星系团'],
  love:     ['银河系旋臂','M81星系群','鲸鱼座超星系团','后发座星系团'],
  order:    ['银河系核球外缘','室女座超团','巨引源附近','本超星系团中心'],
  create:   ['银河系尘埃带','船底座星云','玫瑰星云','鹰状星云']
};

const GAS = ['氢 H','氦 He','氧 O₂','氮 N₂','二氧化碳 CO₂','甲烷 CH₄','氨 NH₃','水蒸气 H₂O','氖 Ne'];

const SYL_A = ['Ly','Astra','Vey','Cael','Nox','Sol','Ther','Or','Vel','Zar','Lumi','Kor','Eos','Myr','Aur','Pyx','Hel','Cyg'];
const SYL_B = ['ra','xis','ion','ara','eth','une','ora','is','ux','ael','wyn','os','ara','ium','en','aris','oth','yra'];

function makeName(rng){
  const a = pick(rng, SYL_A), b = pick(rng, SYL_B);
  const c = pick(rng, SYL_B);
  return (a + b + (rng() > .5 ? c : '')).replace(/^\w/, m => m.toUpperCase());
}

function weightedSpectral(rng, bias){
  const entries = Object.entries(SPECTRAL);
  let total = 0;
  const weights = entries.map(([k,v]) => {
    let w = v.w;
    if (bias && bias[k]) w *= bias[k];
    total += w; return w;
  });
  let r = rng() * total;
  for (let i=0;i<entries.length;i++){ r -= weights[i]; if (r<=0) return entries[i][0]; }
  return 'G';
}

const ZODIAC_BIAS = {
  '白羊座':{O:2,B:1.6,A:1.3}, '狮子座':{O:1.8,B:1.5,A:1.2}, '射手座':{B:1.4,A:1.2,F:1.1},
  '双子座':{A:1.4,F:1.3}, '天秤座':{F:1.4,G:1.2}, '水瓶座':{A:1.5,F:1.3},
  '巨蟹座':{K:1.5,M:1.2}, '天蝎座':{M:1.6,K:1.3}, '双鱼座':{M:1.5,K:1.3},
  '金牛座':{K:1.4,G:1.2}, '处女座':{G:1.4,K:1.2}, '摩羯座':{K:1.5,G:1.2}
};

function sizeFromPersonality(p){
  let factor = 0.6 + (p.extrovert?0.6:0) + (p.leader?0.5:0) + (p.adventurous?0.3:0);
  factor = Math.max(0.4, Math.min(2.4, factor));
  return factor;
}

// ===== 行星形态 =====
const PLANET_TYPES = {
  terran: { name:'类地行星', w:0.34, c1:'#143b73', c2:'#3f7a3f', c3:'#b9a06a', atmo:'#8fc4ff',
            desc:'蔚蓝海洋与翠绿大陆交织，云带在赤道轻轻缠绕，夜半球点亮万家灯火。' },
  desert: { name:'荒漠行星', w:0.24, c1:'#bb4e26', c2:'#5e2810', c3:'#d9a866', atmo:'#f0a85a',
            desc:'赭红沙丘连绵，暗色月海与远古河床的遗迹遍布，两极残留白冠。' },
  ice:    { name:'冰封行星', w:0.18, c1:'#cfe4f2', c2:'#6f9fc0', c3:'#ffffff', atmo:'#cfe8ff',
            desc:'纯白冰原与靛蓝冰海，极冠一路延伸向赤道。' },
  lunar:  { name:'月球型行星', w:0.14, c1:'#8f8f99', c2:'#56565f', c3:'#cfcfd8', atmo:'#9aa0b0',
            desc:'灰白的表面布满陨石坑，寂静地反射着恒星的光。' },
  gas:    { name:'气态巨行星', w:0.10, c1:'#d49a5e', c2:'#8f5026', c3:'#edcf95', atmo:'#f5cf8e',
            desc:'琥珀色风暴带翻涌，一只大红斑如凝视的眼。' }
};
const PLANET_ATMO = {
  terran: [{g:'氮 N₂',w:3.2},{g:'氧 O₂',w:1},{g:'氩 Ar',w:0.12}],
  desert: [{g:'二氧化碳 CO₂',w:4},{g:'氮 N₂',w:1}],
  ice:    [{g:'氮 N₂',w:3},{g:'甲烷 CH₄',w:1}],
  lunar:  [{g:'氮 N₂',w:1},{g:'氩 Ar',w:0.1}],
  gas:    [{g:'氢 H₂',w:5},{g:'氦 He',w:1}]
};
function weightedPick(rng, obj){
  const entries = Object.entries(obj);
  let total = 0; const w = entries.map(([k,v]) => { const x = v.w ?? 1; total += x; return x; });
  let r = rng() * total;
  for (let i=0;i<entries.length;i++){ r -= w[i]; if (r<=0) return entries[i][0]; }
  return entries[0][0];
}
function atmoStr(rng, pt){
  const list = PLANET_ATMO[pt];
  const total = list.reduce((a,b)=>a+b.w,0);
  const comp = list.map(({g,w})=>({gas:g, pct:+(w/total*100).toFixed(1)}));
  const oxygen = pt==='terran' ? +((comp.find(c=>c.gas.includes('氧'))||{}).pct||0).toFixed(1) : 0;
  const str = comp.map(c=>`${c.gas} ${c.pct}%`).join(' · ');
  return { comp, str, oxygen };
}

function genStar(rng, answers, sizeFactor){
  const spec = weightedSpectral(rng, ZODIAC_BIAS[answers.zodiac]);
  const sp = SPECTRAL[spec];
  const temp = Math.round(rand(rng, sp.t[0], sp.t[1])/10)*10;
  const radiusSolar = +(rand(rng,0.3,6)*sizeFactor).toFixed(2);
  const diameterKm = Math.round(radiusSolar*1392700);
  const massSolar = +(radiusSolar*rand(rng,0.6,1.4)).toFixed(2);
  const luminosity = +(Math.pow(radiusSolar,2)*Math.pow(temp/5778,4)/10).toFixed(1);
  const gravity = +(rand(rng,0.3,2.6)*sizeFactor).toFixed(2);
  return { spec, specName:sp.name, color1:sp.c1, color2:sp.c2, temp, radiusSolar, diameterKm, massSolar, luminosity, gravity };
}
function genStarAtmo(rng){
  const gases=[...GAS].sort(()=>rng()-0.5).slice(0,randInt(rng,3,4));
  const oxyIndex=gases.indexOf('氧 O₂');
  const oxygen = oxyIndex>=0 ? +rand(rng,0,28).toFixed(1) : 0;
  const raw=gases.map(()=>rand(rng,0.2,1));
  const sum=raw.reduce((a,b)=>a+b,0);
  const comp=gases.map((g,i)=>({gas:g,pct:+((raw[i]/sum)*(100-oxygen)).toFixed(1)}));
  if (oxyIndex>=0) comp.splice(oxyIndex,0,{gas:'氧 O₂',pct:oxygen});
  const compStr=comp.map(c=>`${c.gas} ${c.pct}%`).join(' · ');
  return { comp, compStr, oxygen };
}
function genPlanet(rng, answers, sizeFactor){
  const pt = weightedPick(rng, PLANET_TYPES);
  const def = PLANET_TYPES[pt];
  const rE = +(rand(rng,0.5,11)*(0.7+0.3*sizeFactor)).toFixed(2);
  const diameterKm = Math.round(rE*12742);
  const massEarth = +(rE*rand(rng,0.7,1.3)).toFixed(2);
  const gravity = +(rand(rng,0.4,2.4)*sizeFactor).toFixed(2);
  const tr = { terran:[200,330], desert:[280,520], ice:[60,210], gas:[90,560] }[pt];
  const pTemp = Math.round(rand(rng,tr[0],tr[1]));
  const a = atmoStr(rng, pt);
  return { planetType:pt, planetTypeName:def.name, planetDesc:t(def.desc), // 类型名存原始中文键，展示时按语言翻译
    pColor1:def.c1, pColor2:def.c2, pColor3:def.c3, pAtmo:def.atmo,
    pRadiusEarth:rE, pDiameterKm:diameterKm, pMassEarth:massEarth,
    pTemp, pAtmoStr:a.str, oxygen:a.oxygen, atmoComp:a.comp, gravity };
}

const LETTER_TEMP = { O:40000,B:18000,A:9000,F:6800,G:5700,K:4500,M:3100 };
function letterFromBv(bv){
  if (bv == null) return 'G';
  if (bv < -0.30) return 'B';
  if (bv <  0.30) return 'A';
  if (bv <  0.60) return 'F';
  if (bv <  0.90) return 'G';
  if (bv <  1.40) return 'K';
  return 'M';
}
// 由真实星等 +（真实/估算）距离 + 色指数，推算真实物理参数（半径/光度/温度/质量/重力）
function derivePhysics(mag, bv, dLy){
  if (!dLy || dLy <= 0) return null;
  const dpc = dLy / 3.262; if (dpc <= 0) return null;
  const Mv = mag - 5 * (Math.log10(dpc) - 1);
  let L = Math.pow(10, (4.83 - Mv) / 2.5); L = Math.max(1e-4, Math.min(1e7, L));
  const temp = LETTER_TEMP[letterFromBv(bv)] || 5778;
  let R = Math.sqrt(L) * Math.pow(5778 / temp, 2); R = Math.max(1e-3, Math.min(5000, R));
  let M = Math.pow(Math.max(L, 1e-3), 1/3.5); M = Math.max(0.02, Math.min(80, M));
  const g = 6.674e-11 * (M * 1.989e30) / Math.pow(R * 6.96e8, 2) / 9.81; // 地表重力(g)
  return { temp:Math.round(temp/10)*10, radiusSolar:+R.toFixed(3), diameterKm:Math.round(R*1392700),
           massSolar:+M.toFixed(2), luminosity:+L.toFixed(2), gravity:+g.toFixed(2) };
}
const MILKY_GALAXIES = {
  explore:['银河系 · 猎户臂边缘','本星系群 · 银晕','银河系 · 旋臂','银心 · 核球外缘'],
  freedom:['银河系 · 银晕','大麦哲伦云','小麦哲伦云','银河系 · 远银极'],
  truth:['银河系 · 猎户臂','三角座星系外围','玉夫座矮星系','天炉座星系团边缘'],
  love:['银河系 · 旋臂','M81 星系群','鲸鱼座超星系团','后发座星系团边缘'],
  order:['银河系 · 核球外缘','室女座超团边缘','巨引源附近','本超星系团外缘'],
  create:['银河系 · 尘埃带','船底座星云区','玫瑰星云区','鹰状星云区']
};

// ===== 认领真实恒星：从真实星表按种子确定性选取，叠加 AI 人格 =====
export function generateStar(answers, salt = 0){
  const seedStr = JSON.stringify(answers) + '|STAR&SKY' + (salt ? '|' + salt : '');
  const seed = hashString(seedStr);
  const rng = mulberry32(seed);

  // 用户所选星座（IAU 代码；'random' 或空则交给宇宙决定）
  const conZh = (answers && answers.constellation) || null;
  const cstDef = CONSTELLATIONS.find(c => c.iau === conZh) || pick(rng, CONSTELLATIONS);
  const conIau = (conZh && conZh !== 'random') ? cstDef.iau : null;
  const real = pickRealStar(seed, conIau);

  let constellation;
  const beliefKey = answers.beliefs || 'explore';
  const galaxy = pick(rng, MILKY_GALAXIES[beliefKey] || MILKY_GALAXIES.explore); // 存原始中文键，展示时再按语言翻译
  const sizeFactor = sizeFromPersonality(answers.personality);
  const registry = 'RX' + String((Math.abs(seed) % 1000000)).padStart(6, '0');

  let raVal, decVal, mag, bv, hd, hip, desig, designation, name, distance, catalogNo, distLy, dr, spec, specName, color1, color2;

  if (real){
    raVal = real.ra; decVal = real.dec; mag = real.mag; bv = real.bv;
    hd = real.hd ? 'HD ' + real.hd : '—';
    hip = real.hip ? 'HIP ' + real.hip : '—';
    distLy = real.d; dr = real.dr || 0;
    const proper = real.n || '';
    const cinfo = CONSTELLATIONS.find(c => c.iau === real.c);
    const gen = cinfo ? cinfo.gen : real.c;
    constellation = cinfo ? cinfo.zh : (cstDef ? cstDef.zh : real.c);
    if (real.b) desig = `${real.b} ${gen}`;
    else if (real.f) desig = `${real.f} ${gen}`;
    else desig = real.hd ? 'HD ' + real.hd : (real.hip ? 'HIP ' + real.hip : '匿名星');
    designation = (proper ? proper + ' · ' : '') + desig;
    spec = letterFromBv(bv); const sp = SPECTRAL[spec]; specName = sp.name; color1 = sp.c1; color2 = sp.c2;
    name = proper || makeName(rng);
    catalogNo = real.hip ? 'HIP ' + real.hip : (real.hd ? 'HD ' + real.hd : registry);
    distance = distLy != null ? (dr ? distLy.toLocaleString() + ' 光年' : '≈' + distLy.toLocaleString() + ' 光年') : '—';
  } else {
    // 目录未就绪时的合成兜底（保持原有逻辑）
    const r2 = mulberry32(seed + 7);
    spec = weightedSpectral(r2, ZODIAC_BIAS[answers.zodiac]);
    const sp = SPECTRAL[spec]; specName = sp.name; color1 = sp.c1; color2 = sp.c2;
    const cc = { ra:cstDef.ra, dec:cstDef.dec };
    raVal = rand(r2, cc.ra[0], cc.ra[1]); decVal = rand(r2, cc.dec[0], cc.dec[1]);
    mag = +(rand(r2, 0.5, 6)).toFixed(2); bv = null;
    const cat = makeDesignations(r2, cstDef, raVal, decVal);
    hd = cat.hd; hip = cat.hip; desig = cat.desig; designation = cat.jname + ' · ' + cat.desig;
    name = makeName(r2); catalogNo = cat.catalogNo;
    const synD = randInt(r2, 4, 48000);
    distance = synD.toLocaleString() + ' 光年'; distLy = synD; dr = 0; // 合成星：给出可行的展示距离（≈）
    constellation = cstDef.zh;
  }

  const coord = `RA ${fmtRA(raVal)} · Dec ${fmtDec(decVal)}`;
  const raH = Math.floor(raVal/15), raM = Math.floor((raVal/15 - raH)*60);
  const coordShort = `RA ${raH}h${String(raM).padStart(2,'0')}m · Dec ${decVal>=0?'+':''}${Math.round(decVal)}°`;

  // 物理参数（优先真实推算，否则合成尺寸）
  let radiusSolar, diameterKm, massSolar, luminosity, gravity, temp;
  if (real){
    const ph = derivePhysics(mag, bv, distLy);
    if (ph){ ({radiusSolar, diameterKm, massSolar, luminosity, gravity, temp} = ph); }
    else {
      const g = genStar(rng, answers, sizeFactor);
      radiusSolar=g.radiusSolar; diameterKm=g.diameterKm; massSolar=g.massSolar;
      luminosity=g.luminosity; gravity=g.gravity; temp=LETTER_TEMP[spec];
    }
  } else {
    const g = genStar(rng, answers, sizeFactor);
    radiusSolar=g.radiusSolar; diameterKm=g.diameterKm; massSolar=g.massSolar;
    luminosity=g.luminosity; gravity=g.gravity; temp=g.temp;
  }

  // 按真实推算半径修正光谱中文名（光度级），避免红超巨星被错标为红矮星
  specName = spectralNameRaw(spec, radiusSolar);

  const age = +rand(rng, 0.6, 12.8).toFixed(1);
  const rotIsDays = rng() > .5;
  const rotVal = (rotIsDays ? rand(rng, 1, 90) : rand(rng, 6, 200)).toFixed(1);
  const rotation = rotVal + (rotIsDays ? ' 天' : ' 小时'); // 兼容旧字段；rotVal/rotUnit 供展示时按语言翻译
  const rotationVal = rotVal, rotationUnit = rotIsDays ? '天' : '小时';
  const planets = randInt(rng, 0, 11);
  const moons = randInt(rng, 0, 42);

  const hobbyTraits = {
    '艺术 / 音乐': '表面荡漾着极光般的光谱涟漪，被视为宇宙的乐器。',
    '科学 / 探索': '周围环绕可观测的尘埃环，是天然的恒星实验室。',
    '自然 / 旅行': '拥有一颗含液态水的宜居卫星，绿意盎然。',
    '竞技 / 挑战': '磁场极强，耀斑喷发如战旗猎猎。',
    '安静 / 思考': '自转极慢，光芒沉稳如冥想之火。',
    '社交 / 联结': '被伴星环绕，构成稳定的多星系统。'
  };
  const trait = (answers.hobbies||[]).map(h=>t(hobbyTraits[h])).filter(Boolean)[0]
    || t('这是一颗沉默燃烧、等待被命名的星。');
  const flavor = t(pick(rng, [
    '在亿万光年之外，它为你而亮。',
    '它的光，出发时世界还很年轻。',
    '你与它的相遇，是宇宙级别的巧合。',
    '它不属于任何机构，此刻它属于你。'
  ]));

  const base = { name, catalogNo, desig, jname: designation, hd, hip, designation,
    form:'star', constellation, ra:raVal, dec:decVal, coord, coordShort, mag,
    galaxy, distance, belief:beliefKey, age, rotation, rotationVal, rotationUnit, planets, moons, trait, flavor,
    realStar: !!real, registry, distLy, dr };

  const a = genStarAtmo(rng);
  return { ...base, spec, specName, color1, color2, temp, radiusSolar, diameterKm,
    massSolar, luminosity, gravity, comp:a.comp, compStr:a.compStr, oxygen:a.oxygen };
}

// 参数 → 用于展示的扁平列表（按形态区分）。
// 注意：这里在“展示时”才调用 t() 翻译，因此生成后切换语言也能即时生效，
// 不再依赖生成那一刻的语言环境（避免“中文星”切到英文仍显示中文）。
function fmtDist(s){
  if (s.distLy != null){
    return (s.dr ? '' : '≈') + Number(s.distLy).toLocaleString() + t('光年');
  }
  // 兜底：合成星等没有 distLy，翻译已生成字符串里的单位
  return (s.distance || '—').replace(/光年/g, t('光年').trim());
}
function fmtComp(s){
  const arr = s.comp || s.atmoComp || [];
  if (!arr.length) return '—';
  return arr.map(c => `${t(c.gas)} ${c.pct}%`).join(' · ');
}
function fmtRotation(s){
  const v = s.rotationVal != null ? s.rotationVal : (s.rotation || '').replace(/[^\d.]/g, '');
  if (!v) return '—';
  return v + ' ' + t(s.rotationUnit || '天');
}
export function starParamList(s){
  if (s.form === 'planet'){
    return [
      ['天体编号', s.catalogNo],
      ['国际命名', s.designation],
      ['星表编号', s.hd],
      ['行星类型', t(s.planetTypeName)],
      ['表面温度', s.pTemp.toLocaleString() + ' K'],
      ['直径', s.pDiameterKm.toLocaleString() + ' km'],
      ['质量', s.pMassEarth + ' M⊕'],
      ['表面重力', s.gravity + ' g'],
      ['距地球', fmtDist(s)],
      ['所属星系', t(s.galaxy)],
      ['所在星座', t(s.constellation)],
      ['天球坐标', s.coord],
      ['大气构成', fmtComp(s)],
      ['含氧量', s.oxygen + ' %'],
      ['自转周期', fmtRotation(s)],
      ['卫星数量', s.moons + ' 颗'],
      ['星龄', s.age + ' 亿年']
    ];
  }
  return [
    ['恒星编号', s.catalogNo],
    ['国际命名', s.designation],
    ['星表编号', s.hd],
    ['光谱类型', `${s.spec} 型 · ${localizedSpecName(s.spec, s.radiusSolar)}`],
    ['表面温度', s.temp.toLocaleString() + ' K'],
    ['直径', s.diameterKm.toLocaleString() + ' km'],
    ['质量', s.massSolar + ' M☉'],
    ['光度', s.luminosity + ' L☉'],
    ['距地球', fmtDist(s)],
    ['所属星系', t(s.galaxy)],
    ['所在星座', t(s.constellation)],
    ['天球坐标', s.coord],
    ['物质构成', fmtComp(s)],
    ['含氧量', s.oxygen + ' %'],
    ['表面重力', s.gravity + ' g'],
    ['自转周期', fmtRotation(s)],
    ['行星数量', s.planets + ' 颗'],
    ['卫星数量', s.moons + ' 颗'],
    ['星龄', s.age + ' 亿年']
  ];
}
