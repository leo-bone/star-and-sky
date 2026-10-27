// 真实星球贴图 + 宇宙星云图（AI 生成，本地 assets/）的预加载与按需读取
// 等距柱状(equirectangular)贴图可直接用于球面 UV，证书 2D 渲染与 3D 视口共用同一套图。

const PLANET_FILES = {
  terran: 'assets/earth.jpg',
  desert: 'assets/mars.jpg',
  lunar:  'assets/moon.jpg',
  gas:    'assets/gas.jpg',
  ice:    'assets/ice.jpg',
};

export const COSMOS_FILE = 'assets/cosmos.jpg';

const cache = {};        // type -> HTMLImageElement（已加载）
const waiters = {};       // type -> [cb]

function load(type, src){
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    cache[type] = img;
    (waiters[type] || []).forEach(fn => fn(img));
    delete waiters[type];
  };
  img.onerror = () => { delete waiters[type]; };
  img.src = src;
}

export function preloadTextures(){
  Object.keys(PLANET_FILES).forEach(t => load(t, PLANET_FILES[t]));
}

// 取已加载的星球贴图；未加载完返回 null
export function getPlanetTexture(planetType){
  return cache[planetType] || null;
}

// 若已加载立即回调，否则加载完成后回调（用于“证书生成时贴图尚未到位”的兜底重绘）
export function whenPlanetTexture(planetType, cb){
  const t = cache[planetType];
  if (t){ cb(t); return; }
  (waiters[planetType] = waiters[planetType] || []).push(cb);
}
