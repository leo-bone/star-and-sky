// 真实星表加载（单次缓存），供 skymap 与 generateStar 共用
let _cat = null, _promise = null;

export function loadCatalog(){
  if (_cat) return Promise.resolve(_cat);
  if (_promise) return _promise;
  _promise = fetch('data/stars.json')
    .then(r => r.json())
    .then(d => { _cat = d; return d; })
    .catch(e => { _cat = null; _promise = null; throw e; });
  return _promise;
}
export function getCatalog(){ return _cat; }

// 依据种子确定性地认领一颗真实恒星（偏向较亮、可被指认的星）
// conIau：可选，限定在该星座内认领（对标 ISR「选星座」）；若不足则回退全局亮星池
export function pickRealStar(seed, conIau){
  const cat = _cat;
  if (!cat || !cat.length) return null;
  let pool;
  if (conIau){
    const bright = cat.filter(s => s.c === conIau && s.mag != null && s.mag < 4.6);
    const mid    = cat.filter(s => s.c === conIau && s.mag != null && s.mag < 5.6);
    const any    = cat.filter(s => s.c === conIau && s.mag != null);
    pool = bright.length >= 3 ? bright : (mid.length >= 3 ? mid : (any.length >= 3 ? any : cat.filter(s => s.mag != null && s.mag < 4.6 && s.c)));
  } else {
    pool = cat.filter(s => s.mag != null && s.mag < 4.6 && s.c);
  }
  if (!pool.length) return null;
  const idx = ((Math.abs(seed|0) % pool.length) + pool.length) % pool.length;
  return pool[idx];
}
