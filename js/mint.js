// 建国门禁：普通用户需连接钱包并铸造「王国凭证（Kingdom Pass）」才能解锁建国。
// 采用钱包签名（personal_sign）生成不可伪造的凭证，存于本地 + 尽力同步云端；
// 凭证通过后才解锁旗帜设计与建国表单。建国数据随 currentKingdom 进入证书 / 分享。
import { t } from './i18n.js?v=20261038';

const PFX = 'star-sky-mint-';          // 本地凭证键前缀（按星编号隔离）
const KYC_NONE = '__none__';           // 未指定星时的全局键

function mintKey(starCode){
  return PFX + (starCode || KYC_NONE);
}

// 读取某颗星的铸造凭证（本地）
export function getMint(starCode){
  try {
    const raw = localStorage.getItem(mintKey(starCode));
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}

// 是否已铸造（解锁建国）
export function isMinted(starCode){
  const m = getMint(starCode);
  return !!(m && m.address && m.signature);
}

// 当前已连接的钱包地址（不触发弹窗）
export async function getAddress(){
  if (typeof window === 'undefined' || !window.ethereum) return null;
  try {
    const accts = await window.ethereum.request({ method: 'eth_accounts' });
    return (accts && accts[0]) || null;
  } catch(e){ return null; }
}

// 连接钱包（触发授权弹窗）
export async function connectWallet(){
  if (typeof window === 'undefined' || !window.ethereum){
    throw new Error(t('请安装 MetaMask 等钱包'));
  }
  const accts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accts || !accts[0]) throw new Error(t('未获取到钱包账户'));
  return accts[0];
}

// 铸造王国凭证：连接钱包 → 签名 → 存证
export async function mint(starCode, starName){
  const address = await connectWallet();
  const nonce = Math.random().toString(36).slice(2, 12);
  const ts = Date.now();
  const msg =
    'STAR & SKY · Kingdom Pass\n' +
    'Star: ' + (starName || starCode || '—') + '\n' +
    'Code: ' + (starCode || KYC_NONE) + '\n' +
    'Nonce: ' + nonce + '\n' +
    'Time: ' + new Date(ts).toISOString();
  let signature;
  try {
    signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [msg, address]
    });
  } catch(e){
    throw new Error(t('签名被取消或失败'));
  }
  const record = { address, signature, message: msg, starCode: starCode || KYC_NONE, ts };
  try { localStorage.setItem(mintKey(starCode), JSON.stringify(record)); } catch(e){}
  // 尽力同步云端（若后端可用）；失败不影响本地解锁
  try { await syncMintToCloud(record); } catch(e){}
  return record;
}

// 云端同步（best-effort）：随王国数据一起，便于后续校验与证书展示
async function syncMintToCloud(record){
  if (typeof fetch !== 'function') return;
  const ep = '/.cloud/mint-kingdom';   // 部署方可在 Worker / 后端实现该端点
  await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  }).catch(()=>{});
}

// 取当前星的铸造地址（用于写入证书 / 分享记录的 minter 字段）
export function mintAddress(starCode){
  const m = getMint(starCode);
  return (m && m.address) || null;
}
