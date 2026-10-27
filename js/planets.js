// 真实行星（含太阳/月球）低精度位置计算 —— J2000 轨道根数 + 开普勒方程
// 元素来源：in-the-sky.org（Explanatory Supplement to the Astronomical Almanac）
// 精度：外行星约角分级，足够星图示意。仅供可视化，非导航用途。

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// 行星 J2000 根数：[a0(AU), e0, i0(deg), Om0(Ω,deg), w0(ω,deg), M0(deg),
//                  a', e', i', Om', w', M'(deg/世纪)]
const PLANETS = {
  Mercury: [0.38709927,0.20563593,7.00498,48.33077,29.12703,174.79253,
            0.00000037,0.00001906,-0.00595,-0.12534,0.28582,149472.51363],
  Venus:   [0.72333566,0.00677672,3.39468,76.67984,54.92262,50.37663,
            0.00000390,-0.00004107,-0.00079,-0.27769,0.28038,58517.81270],
  Earth:   [1.00000011,0.01671022,0.00005,-11.26064,102.94719,100.46435,
            0.00000000,-0.00003804,0.00000,-0.00569,0.32200,35999.37200],
  Mars:    [1.52371034,0.09339410,1.84969,49.55954,-73.50317,19.39020,
            0.00001847,0.00007882,-0.00813,-0.29257,0.73698,19139.85827],
  Jupiter: [5.20288700,0.04838624,1.30440,100.47391,-85.74543,19.66796,
            -0.00011607,-0.00013253,-0.00184,0.20469,0.00784,3034.53360],
  Saturn:  [9.53667594,0.05386179,2.48599,113.66242,-21.06355,-42.64463,
            -0.00125060,-0.00050991,0.00194,-0.28868,-0.13029,1222.91259],
  Uranus:  [19.18916464,0.04725744,0.77264,74.01693,96.93735,142.28383,
            -0.00196176,-0.00004397,-0.00243,0.04241,0.36565,428.07398],
  Neptune: [30.06992276,0.00859048,1.77004,131.78423,-86.81946,-100.08479,
            0.00026291,0.00005105,0.00035,-0.00509,-0.31733,218.78187],
};

const COLORS = {
  Mercury:'#b9b09a', Venus:'#f4e6c8', Earth:'#8fb6ff', Mars:'#ff7b54',
  Jupiter:'#e8c98a', Saturn:'#e6d2a0', Uranus:'#a9e3e8', Neptune:'#7d9bff',
  Sun:'#fff2b0', Moon:'#e8e8ee',
};
const MAG = { // 典型视星等（仅用于星图大小/亮度）
  Mercury:0.2, Venus:-4.0, Mars:-1.0, Jupiter:-2.2, Saturn:0.6,
  Uranus:5.6, Neptune:7.8, Sun:-26.7, Moon:-12.0,
};

export function julianDate(d){
  return d.getTime() / 86400000 + 2440587.5;
}

function norm360(x){ x %= 360; return x < 0 ? x + 360 : x; }

// 地球日心 → 由太阳地心位置取反得到，更可靠
function earthHelio(date){
  const n = julianDate(date) - 2451545.0;
  const L = norm360(280.460 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2*g)) * DEG;
  const r = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2*g);
  // 太阳地心黄道坐标
  const sx = r * Math.cos(lambda), sy = r * Math.sin(lambda), sz = 0;
  // 地球日心 = 太阳地心取反
  return { x:-sx, y:-sy, z:-sz };
}

// 解开普勒方程（度）
function solveKepler(M, e){
  M = norm360(M) * DEG;
  let E = M;
  for (let k=0;k<10;k++){
    const dE = (E - e*Math.sin(E) - M) / (1 - e*Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

// 行星日心黄道坐标（AU）
function planetHelio(name, T){
  const e0 = PLANETS[name];
  const a = e0[0] + e0[6]*T;
  const e = e0[1] + e0[7]*T;
  const i = (e0[2] + e0[8]*T) * DEG;
  const Om = (e0[3] + e0[9]*T) * DEG;
  const w = (e0[4] + e0[10]*T) * DEG;
  const M = e0[5] + e0[11]*T;
  const E = solveKepler(M, e);
  const xv = a*(Math.cos(E) - e);
  const yv = a*Math.sqrt(1 - e*e)*Math.sin(E);
  const r = Math.sqrt(xv*xv + yv*yv);
  const v = Math.atan2(yv, xv); // 真近点角
  const u = w + v; // 近日点+真近点角
  // 旋转到黄道坐标系
  const cosOm=Math.cos(Om), sinOm=Math.sin(Om);
  const cosi=Math.cos(i),  sini=Math.sin(i);
  const cosu=Math.cos(u),  sinu=Math.sin(u);
  const x = r*( cosOm*cosu - sinOm*sinu*cosi );
  const y = r*( sinOm*cosu + cosOm*sinu*cosi );
  const z = r*( sinu*sini );
  return { x, y, z };
}

function eclipticToEquatorial(x, y, z, date){
  const T = (julianDate(date) - 2451545.0) / 36525;
  const eps = (23.43928 - 0.00000036 * (julianDate(date) - 2451545.0)) * DEG;
  const ce=Math.cos(eps), se=Math.sin(eps);
  const xq = x;
  const yq = y*ce - z*se;
  const zq = y*se + z*ce;
  const r = Math.sqrt(xq*xq + yq*yq + zq*zq);
  let ra = Math.atan2(yq, xq) * RAD; if (ra<0) ra+=360;
  const dec = Math.asin(zq / r) * RAD;
  return { ra, dec, r };
}

// 月球低精度位置（Astronomical Almanac 近似）
function moonGeo(date){
  const n = julianDate(date) - 2451545.0;
  const L = norm360(218.316 + 13.176396 * n);
  const M = norm360(134.963 + 13.064993 * n);
  const F = norm360(93.272 + 13.229350 * n);
  const l = L + 6.289 * Math.sin(M*DEG);
  // 黄纬
  const b = 5.128 * Math.sin(F*DEG);
  const lambda = l * DEG;
  const beta = b * DEG;
  const r = 1; // 月地距离对方向影响小，忽略
  const x = r*Math.cos(beta)*Math.cos(lambda);
  const y = r*Math.cos(beta)*Math.sin(lambda);
  const z = r*Math.sin(beta);
  return { x, y, z };
}

// 返回当前日期所有可见天体（太阳/月球/行星）的地心 RA/Dec
export function planetPositions(date){
  date = date || new Date();
  const T = (julianDate(date) - 2451545.0) / 36525;
  const earth = earthHelio(date);
  const out = [];
  // 太阳（地心）
  const sunE = eclipticToEquatorial(-earth.x, -earth.y, -earth.z, date);
  out.push({ name:'Sun', ra:sunE.ra, dec:sunE.dec, mag:MAG.Sun, color:COLORS.Sun, kind:'sun' });
  // 月球
  const moon = moonGeo(date);
  const mg = eclipticToEquatorial(moon.x - earth.x, moon.y - earth.y, moon.z - earth.z, date);
  out.push({ name:'Moon', ra:mg.ra, dec:mg.dec, mag:MAG.Moon, color:COLORS.Moon, kind:'moon' });
  // 行星
  for (const name of ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune']){
    const p = planetHelio(name, T);
    const g = eclipticToEquatorial(p.x - earth.x, p.y - earth.y, p.z - earth.z, date);
    out.push({ name, ra:g.ra, dec:g.dec, mag:MAG[name], color:COLORS[name], kind:'planet' });
  }
  return out;
}
