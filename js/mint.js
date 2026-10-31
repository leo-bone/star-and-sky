// 建国门禁：普通用户需连接钱包并把「王国凭证（Kingdom Pass）」真实铸造上链，
// 才能解锁旗帜设计与建国。支持两条链：
//   · BSC（BNB Smart Chain）—— 自写 ERC-721 合约（contracts/StarSkyBSC.sol），ethers v6 调合约
//   · Solana —— Metaplex Core（官方预部署程序，无需自部署合约），@solana/web3.js + UMI
// 铸造流程：连钱包 → 上传证书 PNG + metadata 到 IPFS(Pinata) → 调链上铸造 → 本地存证 + 证书展示核验链接
import { t } from './i18n.js?v=20261050';
import { encodeStar } from './share.js?v=20261050';

// ===== 部署后填入的配置 =====
export const CONFIG = {
  // Pinata IPFS：去 https://pinata.cloud 注册 → API Keys → 生成 JWT（推荐，留空则走 data-URI 兜底）
  pinata: {
    jwt: '',
    gateway: 'https://ipfs.io/ipfs/'
  },
  chains: {
    bsc: {
      label: 'BNB Chain',
      chainId: 56,                       // 主网 56；测试网换 97
      rpc: 'https://bsc-dataseed.bnbchain.org',
      explorer: 'https://bscscan.com',   // 测试网：https://testnet.bscscan.com
      contract: ''                       // ★ 主网合约地址（Hardhat 部署后填入，见 scripts/deploy-bsc.js）
      // 测试网示例：contract:'0x...', chainId:97, rpc:'https://data-seed-prebsc-1-s1.bnbchain.org:8545', explorer:'https://testnet.bscscan.com'
    },
    solana: {
      label: 'Solana',
      rpc: 'https://api.mainnet-beta.solana.com',   // 测试网：https://api.devnet.solana.com
      explorer: 'https://explorer.solana.com'        // 测试网：https://explorer.solana.com?cluster=devnet
    }
  }
};

const PFX = 'star-sky-mint-';          // 本地凭证键前缀（按星编号 + 链隔离）
const KYC_NONE = '__none__';

function mintKey(starCode){ return PFX + (starCode || KYC_NONE); }

// 读取某颗星的全部铸造凭证（本地，跨链）
export function getAllMints(starCode){
  try {
    const raw = localStorage.getItem(mintKey(starCode));
    return raw ? JSON.parse(raw) : [];
  } catch(e){ return []; }
}
// 主凭证：最后一次铸造记录
export function getMint(starCode){
  const arr = getAllMints(starCode);
  return arr.length ? arr[arr.length - 1] : null;
}
// 是否已铸造（任一链均可解锁建国）
export function isMinted(starCode){
  return getAllMints(starCode).some(r => r && r.address && r.txHash);
}
// 铸造者钱包地址（用于写入证书 / 分享记录的 minter 字段）
export function mintAddress(starCode){
  const m = getMint(starCode);
  return (m && m.address) || null;
}

// 当前已连接的 EVM 地址（不触发弹窗）
export async function getAddress(){
  if (typeof window === 'undefined' || !window.ethereum) return null;
  try {
    const accts = await window.ethereum.request({ method: 'eth_accounts' });
    return (accts && accts[0]) || null;
  } catch(e){ return null; }
}

// 连接钱包（按链分发：EVM=window.ethereum；Solana=Phantom）
export async function connectWallet(chain){
  if (chain === 'solana'){
    const w = window.solana;
    if (!w) throw new Error(t('请安装 Phantom'));
    try { const acc = await w.connect(); return acc && acc.publicKey ? acc.publicKey.toBase58() : (w.publicKey && w.publicKey.toBase58()); }
    catch(e){ throw new Error(t('连接已取消')); }
  }
  // 默认 / bsc → EVM
  if (typeof window === 'undefined' || !window.ethereum){
    throw new Error(t('请安装 MetaMask 等账户工具'));
  }
  const accts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accts || !accts[0]) throw new Error(t('未获取到账户'));
  return accts[0];
}

// ===== IPFS =====
async function blobToDataURL(blob){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(r.result); r.onerror = ()=> rej(r.error);
    r.readAsDataURL(blob);
  });
}
// 上传二进制（证书 PNG）到 IPFS；无 Pinata key 时回退 data-URI
async function uploadBlob(blob, name){
  if (CONFIG.pinata.jwt){
    try {
      const fd = new FormData();
      fd.append('file', blob, name);
      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST', headers: { Authorization: 'Bearer ' + CONFIG.pinata.jwt }, body: fd
      });
      const j = await res.json();
      if (!j.IpfsHash) throw new Error('Pinata 返回异常');
      return { uri: 'ipfs://' + j.IpfsHash, url: CONFIG.pinata.gateway + j.IpfsHash };
    } catch(e){ console.warn('[ipfs] 上传失败，回退 data-URI', e); }
  }
  const d = await blobToDataURL(blob);
  return { uri: d, url: d };
}
// 上传元数据 JSON 到 IPFS；无 key 时回退 data-URI
async function uploadJson(json){
  if (CONFIG.pinata.jwt){
    try {
      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + CONFIG.pinata.jwt },
        body: JSON.stringify({ pinataContent: json })
      });
      const j = await res.json();
      if (j.IpfsHash) return 'ipfs://' + j.IpfsHash;
    } catch(e){ console.warn('[ipfs] JSON 上传失败，回退 data-URI', e); }
  }
  return 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(json))));
}

// 取证书 canvas 的 PNG blob（铸造用的 NFT 图片）
function getCertBlob(){
  const cv = document.getElementById('cert-canvas');
  if (!cv) return null;
  return new Promise((res)=>{
    try { cv.toBlob(b=> res(b), 'image/png'); } catch(e){ res(null); }
  });
}

// 组装元数据
function buildMetadata(star, kd, chainLabel, imageUri){
  const share = (()=>{ try { return encodeStar(star, kd || {}); } catch(e){ return ''; } })();
  const external = location.origin + location.pathname + (location.search || '') + '#star=' + share;
  return {
    name: (star.name || 'Star') + ' · Kingdom Pass',
    description: 'Star & Sky 星辰王国凭证 —— 纪念在浩瀚宇宙中认领的一颗星，并记录其王国、旗帜与寄语。',
    image: imageUri,
    external_url: external,
    attributes: [
      { trait_type: 'Constellation', value: t(star.constellation || '—') },
      { trait_type: 'Collection', value: 'Star & Sky' },
      { trait_type: 'Registrant', value: (kd && (kd.ruler || kd.name)) || 'Star Citizen' },
      { trait_type: 'Registry', value: star.registry || star.catalogNo || '—' }
    ]
  };
}

// ===== BSC 铸造 =====
async function mintBSC(cfg, tokenURI, to){
  const eth = await import('https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm');
  const { BrowserProvider, Contract } = eth;
  const provider = new BrowserProvider(window.ethereum);
  await ensureBscChain(cfg);
  const signer = await provider.getSigner();
  const abi = [ 'function mint(string uri) returns (uint256 tokenId)', 'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)' ];
  if (!cfg.contract) throw new Error(t('该方式暂未开放'));
  const contract = new Contract(cfg.contract, abi, signer);
  const tx = await contract.mint(tokenURI);
  const receipt = await tx.wait();
  let tokenId = null;
  for (const log of receipt.logs){
    try { const ev = contract.interface.parseLog(log); if (ev && ev.name === 'Transfer'){ tokenId = ev.args.tokenId.toString(); break; } } catch(e){}
  }
  return { txHash: tx.hash, tokenId };
}
async function ensureBscChain(cfg){
  const eth = await import('https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm');
  const { BrowserProvider } = eth;
  const provider = new BrowserProvider(window.ethereum);
  const wid = await provider.send('eth_chainId', []);
  if (Number(wid) !== cfg.chainId){
    const hex = '0x' + cfg.chainId.toString(16);
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch(e){
      if (e && e.code === 4902){
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hex, chainName: cfg.label, rpcUrls: [cfg.rpc],
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            blockExplorerUrls: [cfg.explorer]
          }]
        });
      } else throw e;
    }
  }
}

// ===== Solana 铸造（Metaplex Core，无需自部署合约）=====
async function mintSolana(cfg, tokenURI, to){
  const { createUmi } = await import('https://esm.sh/@metaplex-foundation/umi-bundle-defaults@0.9.2');
  const { generateSigner } = await import('https://esm.sh/@metaplex-foundation/umi@0.9.2');
  const { create } = await import('https://esm.sh/@metaplex-foundation/mpl-core@0.8.2');
  const { unsafeWalletAdapterIdentity } = await import('https://esm.sh/@metaplex-foundation/umi-signer-wallet-adapters@0.9.2');
  const web3 = await import('https://esm.sh/@solana/web3.js@1.95.3');

  const wallet = window.solana;
  if (!wallet) throw new Error(t('请安装 Phantom'));
  if (!wallet.publicKey) await wallet.connect();

  const umi = createUmi(cfg.rpc || 'https://api.mainnet-beta.solana.com');
  const adapter = {
    publicKey: new web3.PublicKey(wallet.publicKey.toBase58()),
    signTransaction: (tx)=> wallet.signTransaction(tx),
    signAllTransactions: (txs)=> wallet.signAllTransactions(txs),
    signMessage: (msg)=> wallet.signMessage(msg),
    connect: ()=> wallet.connect(),
    disconnect: ()=> Promise.resolve()
  };
  umi.use(unsafeWalletAdapterIdentity(adapter));

  const asset = generateSigner(umi);
  const builder = await create(umi, { asset, name: 'Star & Sky Kingdom Pass', uri: tokenURI });
  const sig = await builder.sendAndConfirm(umi);
  const signature = (sig && sig.signature) ? sig.signature : (typeof sig === 'string' ? sig : null);
  return { txHash: signature, tokenId: asset.publicKey.toString(), assetAddress: asset.publicKey.toString() };
}

export function explorerTxUrl(chain, txHash){
  const cfg = CONFIG.chains[chain]; if (!cfg || !txHash) return '';
  return cfg.explorer + (chain === 'solana' ? '/tx/' + txHash : '/tx/' + txHash);
}

// ===== 主铸造入口 =====
export async function mint(chain, starCode, star, kd){
  const code = starCode || KYC_NONE;
  const cfg = CONFIG.chains[chain];
  if (!cfg) throw new Error(t('不支持的方式'));

  // 1) 连钱包（已连则复用）
  const address = await connectWallet(chain);

  // 2) 证书图片 → IPFS
  const blob = await getCertBlob();
  if (!blob) throw new Error(t('证书尚未生成，请稍候'));
  const img = await uploadBlob(blob, (star && star.name || 'star') + '.png');

  // 3) 元数据 → IPFS
  const meta = buildMetadata(star, kd, cfg.label, img.uri);
  const tokenURI = await uploadJson(meta);

  // 4) 链上铸造
  let onChain;
  if (chain === 'bsc') onChain = await mintBSC(cfg, tokenURI, address);
  else if (chain === 'solana') onChain = await mintSolana(cfg, tokenURI, address);
  else throw new Error(t('不支持的方式'));

  const record = {
    chain, address, signature: onChain.txHash, txHash: onChain.txHash,
    tokenId: onChain.tokenId || null, assetAddress: onChain.assetAddress || null,
    tokenURI, image: img.uri, starCode: code, ts: Date.now()
  };
  // 5) 本地存证（按星 + 链隔离，可多链各铸一次）
  try {
    const arr = getAllMints(code).filter(r => r.chain !== chain);
    arr.push(record);
    localStorage.setItem(mintKey(code), JSON.stringify(arr.slice(-6)));
  } catch(e){}
  // 尽力同步云端（若存在端点）
  try { await syncMintToCloud(record); } catch(e){}
  return record;
}

async function syncMintToCloud(record){
  if (typeof fetch !== 'function') return;
  try {
    await fetch('/.cloud/mint-kingdom', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record)
    }).catch(()=>{});
  } catch(e){}
}
