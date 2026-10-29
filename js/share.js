// 分享编解码：把一颗星 + 王国信息压成可放进 URL 的短码，免登录即可分享给全世界。

import { starKey } from './cloud.js?v=20261033';   // 短码哈希（纯函数，不会引起云 SDK 网络副作用）

function slimStar(s){
  // 只保留展示与参数表需要的字段，减小体积（真实星表认领 + 国际命名 + 真实坐标）
  return {
    name: s.name, catalogNo: s.catalogNo, form: s.form, planetType: s.planetType, registry: s.registry,
    desig: s.desig, jname: s.jname, hd: s.hd, hip: s.hip,
    designation: s.designation || `${s.jname} · ${s.desig}`,
    constellation: s.constellation, coord: s.coord, coordShort: s.coordShort,
    ra: s.ra, dec: s.dec, mag: s.mag, distLy: s.distLy, dr: s.dr,
    galaxy: s.galaxy, distance: s.distance, compStr: s.compStr,
    oxygen: s.oxygen, gravity: s.gravity, rotation: s.rotation,
    planets: s.planets, moons: s.moons, age: s.age, realStar: s.realStar,
    flavor: s.flavor, trait: s.trait,
    // 恒星字段
    spec: s.spec, specName: s.specName, color1: s.color1, color2: s.color2,
    temp: s.temp, diameterKm: s.diameterKm, massSolar: s.massSolar, luminosity: s.luminosity,
  };
}

// UTF-8 安全的 base64
function b64encode(str){
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(b64){
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeStar(star, kd){
  const payload = {
    s: slimStar(star),
    k: {
      name: kd.name || '', ruler: kd.ruler || '', message: kd.message || '',
      laws: kd.laws || [], council: kd.council || [],
      // 存“旗帜状态”而非渲染后的 SVG 字符串：体积更小，二维码才扫得动；解码时再重绘
      flag: kd.flag || null
    }
  };
  return b64encode(JSON.stringify(payload));
}

export function decodeStar(code){
  try {
    const p = JSON.parse(b64decode(code));
    if (!p || !p.s || !p.s.name) return null;
    // 分享码可能缺少王国信息(kd)，兜底为空对象，避免下游 kd.name 抛错导致白屏/崩溃
    return { star: p.s, kd: p.k || {} };
  } catch(e){ return null; }
}

export function shareLink(code){
  // 保留当前查询串（含部署网关的 ?sharecode=…），否则分享出去的链接在需要网关的部署上会 403 打不开
  const base = location.origin + location.pathname + (location.search || '');
  return base + '#star=' + code;
}

// 证书二维码专用：用云端短码（#c=）替代完整分享码（#star=）。
// 理由：完整分享码 base64 后可达 1500+ 字符，生成的二维码是 ~149 模块的超密版，
// 证书上只有 116px，手机基本扫不出；短码仅 ~12 位，二维码降到 ~40 模块，轻松可扫。
// 扫码后由 app 端 #c= 解析逻辑去云端取回完整星。
export function qrLinkForStar(code){
  const base = location.origin + location.pathname + (location.search || '');
  return base + '#c=' + starKey(code);
}

export function copyText(text){
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text);
  }
  return new Promise((res, rej)=>{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); res(); } catch(e){ rej(e); }
    ta.remove();
  });
}

export function parseCodeFromURL(){
  const m = (location.hash || '').match(/star=([^&]+)/);
  if (!m) return null;
  // 链接可能被平台百分号编码（+→%2B、/→%2F 等），先解码再解析，否则 atob 失败
  try { return decodeStar(decodeURIComponent(m[1])); }
  catch(e){ return decodeStar(m[1]); }
}
