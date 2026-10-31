// 云端共享星图客户端 —— 基于 WorkBuddy Cloud Service（PostgreSQL 数据面）。
// 公开配置（endpoint / publishableKey）为前端可暴露值，无需自建后端。
// 用途：把每颗被认领的星的坐标 + 留言同步到云端，好友凭链接或星图墙即可一起看到。

const PUBLIC_CONFIG = {
  // 走自定义域名 star.uichain.org（Cloudflare Worker 已把该域名整体反代到 WorkBuddy Cloud）。
  // 好处：① 与前端同源（前端也经 Worker 提供），避免跨域 403；
  //       ② 为“前端迁 GitHub Pages”铺路——届时只需让 Worker 对 /rest/v1/* 加 CORS 即可跨域调用云端。
  endpoint: 'https://star.uichain.org',
  publishableKey: 'wbpk_bCE5ZXrk8G16hFrzUJ6aQ2_VSDrieq5pMlW72WBFOSoygPY5SVyBTVv',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth'
};

// 云端 SDK 自托管到本地（js/vendor/），零外链，国内/国外均稳定加载。
const SDK_LOCAL = 'js/vendor/workbuddy-cloud-sdk.global.js?v=20261059';

let _cloud = null;
let _sdkPromise = null;

function loadScript(src){
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => window.WorkBuddyCloud ? resolve(window.WorkBuddyCloud)
                                           : reject(new Error('cloud-sdk-global-missing:' + src));
    s.onerror = () => reject(new Error('cloud-sdk-load-failed:' + src));
    document.head.appendChild(s);
  });
}

// 云端 SDK 本地自托管优先（同源，必可达）；不再回退任何境外 CDN，确保零外链。
function loadSdk(){
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = (async () => {
    if (window.WorkBuddyCloud) return window.WorkBuddyCloud;
    return await loadScript(SDK_LOCAL);
  })();
  return _sdkPromise;
}

export async function getCloud(){
  if (_cloud) return _cloud;
  const WB = await loadSdk();
  _cloud = WB.createWorkBuddyCloud({
    endpoint: PUBLIC_CONFIG.endpoint,
    oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
    publishableKey: PUBLIC_CONFIG.publishableKey
  });
  return _cloud;
}

// 把较长的分享码压成稳定短键，作为数据库唯一键 / 留言外键，规避长文本唯一索引溢出。
export function starKey(code){
  let h1 = 0x9e3779b9 ^ code.length, h2 = 0x85ebca6b ^ code.length;
  for (let i = 0; i < code.length; i++){
    const ch = code.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

const T_STARS = 'stars';
const T_MSGS = 'star_messages';

// 检查某星名是否已被认领（不同用户不能拥有同名星辰）。云不可用时返回 false（放行，由数据库唯一约束兜底）。
export async function nameTaken(name){
  const n = (name || '').trim();
  if (!n) return false;
  try {
    const cloud = await getCloud();
    const { data, error } = await cloud.database.from(T_STARS)
      .select('name');
    if (error) throw error;
    const low = n.toLowerCase();
    // 与数据库 lower(name) 唯一索引保持一致：大小写不敏感比对，
    // 避免 "Orion" / "orion" 被误判为可用、随后插入触发 23505 的体验断层。
    return !!(data && data.some(r => (r.name || '').toLowerCase() === low));
  } catch(e){ console.warn('[cloud] nameTaken 失败', e); return false; }
}

// 检查某星表编号（catalog_no，即星的“物理身份”）是否已被认领。
// 不同用户不能认领同一颗真实恒星——星体唯一的最终兜底在数据库 stars_catalog_no_unique 唯一索引。
export async function catalogTaken(catalogNo){
  const c = (catalogNo || '').trim();
  if (!c) return false;
  try {
    const cloud = await getCloud();
    const { data, error } = await cloud.database.from(T_STARS)
      .select('code').eq('catalog_no', c).limit(1);
    if (error) throw error;
    return !!(data && data.length);
  } catch(e){ console.warn('[cloud] catalogTaken 失败', e); return false; }
}

// 把一颗认领的星同步到云端。
//  · code 重复 → 视为幂等成功（同一颗星重复推送，不报错）
//  · name 重复 → 抛出 e.code='23505_name'，由上层拦截、提示用户换名
//  · owner_id 重复 → 一人一星硬限制（已由 stars_owner_id_unique 唯一索引在数据库层兜底，前端误吞逻辑已修复）
// 注：stars_name_unique(lower(name)) / stars_catalog_no_unique / stars_owner_id_unique 三个唯一索引均已落地，是并发撞名/撞星/一人一星的最终兜底。
export async function pushStar(record){
  const cloud = await getCloud();
  const row = {
    code: record.code,
    share: record.share,
    name: record.name,
    designation: record.designation,
    ra: record.ra, dec: record.dec,
    color1: record.color1, color2: record.color2,
    spec: record.spec, constellation: record.constellation,
    owner_name: record.owner_name,
    mag: record.mag, dist_ly: record.distLy,
    catalog_no: record.catalogNo || '',
    message: record.message || '',
    owner_id: record.ownerId || null
  };
  try {
    const { error } = await cloud.database.from(T_STARS).insert(row);
    if (error) throw error;
  } catch(e){
    // 仅当 owner_id 列确实不存在（迁移未就绪，Postgres 错误码 42703 “column does not exist”）时，
    // 才剥除该列重试，避免认领被卡死。
    // 重要：owner_id 唯一冲突（23505 / stars_owner_id_unique）绝对不能在此剥除——否则会绕过“一人一星”硬约束。
    const em = (e.message || '') + ' ' + (e.code || '');
    if (/owner_id/.test(em) && /does not exist|42703/.test(em)){
      delete row.owner_id;
      const r2 = await cloud.database.from(T_STARS).insert(row);
      if (r2.error){ if (r2.error.code === '23505') return handle23505(r2.error); throw r2.error; }
      return true;
    }
    if (e.code === '23505') return handle23505(e);
    throw e;
  }
  return true;
}
function handle23505(error){
  const msg = (error.message || '') + ' ' + (error.details || '');
  if (/stars_name_unique/.test(msg)){
    const e = new Error('该星名已被认领'); e.code = '23505_name'; throw e;
  }
  if (/stars_catalog_no_unique/.test(msg)){
    const e = new Error('这颗星刚刚被别人认领了'); e.code = '23505_catalog'; throw e;
  }
  if (/stars_owner_id_unique/.test(msg)){
    const e = new Error('你已在宇宙中点亮过一颗星，无法重复认领'); e.code = '23505_owner'; throw e;
  }
  return true; // code 重复：幂等成功
}

// 升级建国：按 catalog_no（星的物理身份）更新同一颗星的王国 / 铸造信息。
// 不新增行，避免与 stars_catalog_no_unique 唯一约束碰撞导致“换一颗星”。
export async function updateStar(catalogNo, fields){
  if (!catalogNo) return false;
  try {
    const cloud = await getCloud();
    const { error } = await cloud.database.from(T_STARS).update(fields).eq('catalog_no', catalogNo);
    if (error) throw error;
    return true;
  } catch(e){
    console.warn('[cloud] updateStar 失败', e);
    return false;
  }
}

// 一人一星：查该设备/身份是否已认领过（数据库 stars_owner_id_unique 唯一索引已兜底；此处为应用层提前拦截，减少无效请求）
export async function ownerIdExists(ownerId){
  if (!ownerId || ownerId === 'anon') return false;
  try {
    const cloud = await getCloud();
    const { data, error } = await cloud.database.from(T_STARS)
      .select('code').eq('owner_id', ownerId).limit(1);
    if (error){ if (/owner_id/.test((error.message||'')+(error.code||''))) return false; throw error; }
    return !!(data && data.length);
  } catch(e){ console.warn('[cloud] ownerIdExists 失败', e); return false; }
}

// 列出云端全部公开星（用于“和朋友一起看”的共享星图）
export async function listStars(limit = 300){
  try {
    const cloud = await getCloud();
    const { data, error } = await cloud.database.from(T_STARS)
      .select('code,share,name,designation,catalog_no,ra,dec,color1,color2,spec,constellation,owner_name,mag,dist_ly,message,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch(e){
    console.warn('[cloud] listStars 失败', e);
    return [];
  }
}

// 给某颗星留言（无需登录，游客内容）
export async function addMessage(starCode, nick, text){
  const cloud = await getCloud();
  const { data, error } = await cloud.database.from(T_MSGS)
    .insert({ star_code: starCode, nick: nick || '匿名旅人', text })
    .select();
  if (error) throw error;
  return (data && data[0]) || null;
}

// 读取某颗星的留言
export async function listMessages(starCode){
  try {
    const cloud = await getCloud();
    const { data, error } = await cloud.database.from(T_MSGS)
      .select('id,nick,text,created_at')
      .eq('star_code', starCode)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    return data || [];
  } catch(e){
    console.warn('[cloud] listMessages 失败', e);
    return [];
  }
}

// 按短码（starKey）取回完整分享码，供证书二维码（#c= 短码）扫码后解析出整颗星。
// 取不到（云不可用 / 星未落云）返回 null，由上层降级处理。
export async function getStarByKey(key){
  try {
    const cloud = await getCloud();
    const { data, error } = await cloud.database.from(T_STARS)
      .select('share, code').eq('code', key).limit(1);
    if (error) throw error;
    if (data && data.length && data[0].share) return data[0].share;
    return null;
  } catch(e){
    console.warn('[cloud] getStarByKey 失败', e);
    return null;
  }
}

// ---------- 联系站长 · 全局留言信箱 ----------
// 复用 star_messages 表，以专用 star_code='SITE_CONTACT' 区分“给站长的全局留言”与“按星留言（星语）”。
// 匿名写入/读取已验证可用（与“星语”同表同权），无需新建表、零 DDL 风险。
// 字段约定：nick = 昵称；text = JSON{name,contact,message}（旧/plain 文本整段作为留言，兼容降级）。
const SITE_CONTACT_CODE = 'SITE_CONTACT';

export async function addContact({ name, contact, message }){
  const cleanName = (name || '').trim() || '匿名访客';
  const cloud = await getCloud();
  const { data, error } = await cloud.database.from(T_MSGS)
    .insert({
      star_code: SITE_CONTACT_CODE,
      nick: cleanName,
      text: JSON.stringify({
        name: cleanName,
        contact: (contact || '').trim(),
        message: (message || '').trim()
      })
    })
    .select();
  if (error) throw error;
  return (data && data[0]) || null;
}

export async function listContacts(limit = 500){
  try {
    const cloud = await getCloud();
    const { data, error } = await cloud.database.from(T_MSGS)
      .select('id,nick,text,created_at')
      .eq('star_code', SITE_CONTACT_CODE)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(r => {
      let name = r.nick || '匿名访客', contact = '', message = r.text || '';
      try {
        const o = JSON.parse(r.text);
        if (o && typeof o === 'object'){
          name = o.name || r.nick || '匿名访客';
          contact = o.contact || '';
          message = o.message || '';
        }
      } catch(e){ /* 旧/plain 文本：整段作为留言 */ }
      return { id: r.id, name, contact, message, created_at: r.created_at };
    });
  } catch(e){
    console.warn('[cloud] listContacts 失败', e);
    return [];
  }
}

export async function deleteContact(id){
  try {
    const cloud = await getCloud();
    const { error } = await cloud.database.from(T_MSGS).delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch(e){
    console.warn('[cloud] deleteContact 失败', e);
    return false;
  }
}
