import * as THREE from './vendor/three/build/three.module.js?v=20261059';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js?v=20261059';
import { EffectComposer } from './vendor/three/examples/jsm/postprocessing/EffectComposer.js?v=20261059';
import { RenderPass } from './vendor/three/examples/jsm/postprocessing/RenderPass.js?v=20261059';
import { UnrealBloomPass } from './vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js?v=20261059';
import { OutputPass } from './vendor/three/examples/jsm/postprocessing/OutputPass.js?v=20261059';

// ============ Ashima 3D simplex noise ============
const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

// ============ 恒星着色器（真实对流胞 + 米粒 + 黑子 + 临边昏暗 + 色球） ============
const STAR_VERT = `
varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
void main(){
  vPos = position;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = SNOISE + `
uniform vec3 uColor1; uniform vec3 uColor2; uniform float uTime;
varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p=p*2.03+vec3(11.1,3.7,7.3); a*=0.5;} return v;}
void main(){
  vec3 p = normalize(vPos);
  float t = uTime*0.04;
  // 对流胞(中频) + 米粒组织(高频) + 细纹
  float cells = fbm(p*2.2 + vec3(0.0, t, 0.0));
  float gran  = fbm(p*15.0 + vec3(t*1.4, t, 0.0));
  float fine  = fbm(p*36.0 + vec3(t*2.0, 0.0, t*0.6));
  float h = cells*0.55 + gran*0.35 + fine*0.10;
  h = h*0.5 + 0.5;
  // 强对比表面：暗胞间 -> 亮胞（细节清晰，但峰值受控，避免被色调映射烧成白块）
  float surf = smoothstep(0.25, 0.86, h);
  vec3 col = mix(uColor2*0.55, uColor1, surf);
  // 明亮网络（米粒边界发亮，克制）
  float net = smoothstep(0.55, 0.95, gran*0.5+0.5);
  col += uColor1 * net * 0.16;
  // 黑子：明显暗斑
  float spot = smoothstep(0.05, -0.35, cells);
  col *= (1.0 - spot*0.85);
  // 临边昏暗：中心亮、边缘明显变暗 -> 球体体积感（峰值 0.95，保留星色不泛白）
  float ndv = max(dot(vNormal, vView), 0.0);
  float limb = pow(ndv, 0.62);
  col *= mix(0.16, 0.95, limb);
  // 薄薄内缘色球辉光（克制，靠 bloom 轻微提亮而非烧白）
  float chrom = pow(1.0 - ndv, 3.6);
  col += uColor1 * chrom * 0.14;
  gl_FragColor = vec4(col, 1.0);
}`;

// ============ 辉光 / 日冕（菲涅尔） ============
const GLOW_VERT = `
varying vec3 vNormal; varying vec3 vView;
void main(){
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FRAG = `
uniform vec3 uColor; varying vec3 vNormal; varying vec3 vView;
void main(){
  // BackSide 渲染时球壳法线背对相机，dot 为负；必须取 abs()，
  // 否则 max(...,0) 会把负值钳成 0，使菲涅尔项恒为 1，
  // 整块壳以不透明度 1 加法混合铺满全屏。
  float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
  gl_FragColor = vec4(uColor, fres);
}`;

// ============ 行星着色器（程序化大陆/海洋/极冠/大气 + 光环） ============
const PLANET_VERT = `
varying vec3 vPos; varying vec3 vNormal;
void main(){
  vPos = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;
const PLANET_FRAG = SNOISE + `
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uAtmo;
uniform float uTime; uniform float uGas; uniform vec3 uLightDir; uniform float uCity;
varying vec3 vPos; varying vec3 vNormal;
float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p=p*2.03+vec3(11.1,3.7,7.3); a*=0.5;} return v;}
void main(){
  vec3 p = normalize(vPos);
  float lat = p.y;
  vec3 col;
  if (uGas > 0.5){
    // 气态巨行星：纬向条纹 + 湍流 + 大红斑
    float bands = fbm(vec3(p.x*1.5, p.y*7.0 + fbm(p*2.0)*1.6, p.z*1.5) + vec3(0.0,uTime*0.025,0.0));
    float b = bands*0.5+0.5;
    col = mix(uC2, uC1, smoothstep(0.12,0.88,b));
    col = mix(col, uC3, smoothstep(0.60,0.96,b));
    float spot = smoothstep(0.20,0.0, length(p - normalize(vec3(0.65,-0.28,0.7))));
    col = mix(col, uC3*1.2, spot*0.75);
  } else {
    // 固体行星：高度场 -> 深海/浅海/陆地/高山
    float h  = fbm(p*2.3 + vec3(0.0,uTime*0.008,0.0));
    float h2 = fbm(p*6.0);
    float height = h*0.72 + h2*0.28;
    float sea = 0.04;
    vec3 deep   = uC1*0.4;
    vec3 shallow= mix(uC1, uC2, 0.5);
    vec3 ocean  = height < sea ? mix(deep, shallow, smoothstep(-0.5, sea, height)) : uC2;
    vec3 land   = mix(uC2, uC3, smoothstep(sea, 0.55, height));
    col = height < sea ? ocean : land;
    // 极冠
    float ice = smoothstep(0.60, 0.9, abs(lat));
    col = mix(col, vec3(0.94,0.97,1.0), ice*0.92);
    // 云带（缓慢移动）
    float cloud = smoothstep(0.5,0.85, fbm(p*2.6 + vec3(uTime*0.018,0.0,0.0)));
    col = mix(col, vec3(1.0), cloud*0.22);
  }
  // 法线扰动（凹凸立体感，增强）
  float eps = 0.02;
  float hC = fbm(p*3.0);
  float hX = fbm((p+vec3(eps,0.0,0.0))*3.0);
  float hY = fbm((p+vec3(0.0,eps,0.0))*3.0);
  float hZ = fbm((p+vec3(0.0,0.0,eps))*3.0);
  vec3 grad = vec3(hX-hC, hY-hC, hZ-hC)/eps;
  vec3 N = normalize(vNormal - grad*0.42);
  vec3 L = normalize(uLightDir);
  float ndl = dot(N, L);
  // 平滑昼夜分界
  float day = smoothstep(-0.12, 0.32, ndl);
  // 昼侧受光
  col *= (0.05 + day*1.05);
  // 夜侧：类地行星城市灯火（暖色微光）
  if (uCity > 0.5 && uGas < 0.5){
    float lights = smoothstep(0.55, 0.95, fbm(p*14.0)) * (1.0 - day);
    col += vec3(1.0,0.78,0.42) * lights * 0.5;
  }
  // 海洋镜面高光
  vec3 V = vec3(0.0,0.0,1.0);
  float spec = pow(max(dot(reflect(-L, N), V),0.0), 26.0);
  col += spec * 0.5 * (uGas<0.5 ? 1.0 : 0.15);
  // 边缘大气散射（瑞利感蓝光边，增强）
  float fres = pow(1.0 - max(dot(normalize(vNormal), V),0.0), 3.0);
  col += uAtmo * fres * 1.0;
  gl_FragColor = vec4(col, 1.0);
}`;

// ============ 星点 ============
const PT_VERT = `
attribute float aSize; attribute float aPhase; attribute vec3 aColor; attribute float aTw;
varying float vTw; varying vec3 vCol; uniform float uTime;
void main(){
  // 仅近景层 aTw=1 做缓慢呼吸；远景/中景 aTw=0 保持稳定不闪烁，避免整屏杂乱
  vTw = mix(1.0, 0.55 + 0.45*sin(uTime*0.9 + aPhase), aTw);
  vCol = aColor;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = aSize * (340.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PT_FRAG = `
varying float vTw; varying vec3 vCol;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if(d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * vTw;
  gl_FragColor = vec4(vCol, a);
}`;

// ============ 纹理生成 ============
function makeSoftTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(0.4,'rgba(255,255,255,0.35)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,128,128);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
// 不规则星云云团（多个偏置柔光斑叠加，避免完美圆形）
function makeNebulaTexture(){
  const S=256; const c=document.createElement('canvas'); c.width=c.height=S;
  const ctx=c.getContext('2d'); ctx.translate(S/2,S/2);
  for(let i=0;i<16;i++){
    const a=Math.random()*Math.PI*2, d=Math.random()*S*0.30;
    const x=Math.cos(a)*d, y=Math.sin(a)*d;
    const r=18+Math.random()*58;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(255,255,255,0.45)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  }
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t;
}
// 远景旋涡星系（双旋臂 + 核心），增强深空纵深
function makeGalaxyTexture(){
  const S=256; const c=document.createElement('canvas'); c.width=c.height=S;
  const ctx=c.getContext('2d'); ctx.translate(S/2,S/2);
  const core=ctx.createRadialGradient(0,0,0,0,0,28);
  core.addColorStop(0,'rgba(255,246,228,0.95)'); core.addColorStop(1,'rgba(255,246,228,0)');
  ctx.fillStyle=core; ctx.beginPath(); ctx.arc(0,0,28,0,7); ctx.fill();
  ctx.globalCompositeOperation='lighter';
  for(let arm=0;arm<2;arm++){
    const phase=arm*Math.PI;
    for(let i=0;i<70;i++){
      const tt=i/70, ang=phase + tt*Math.PI*2.5;
      const rad=tt*98, x=Math.cos(ang)*rad, y=Math.sin(ang)*rad*0.46;
      const r=2.5+tt*9;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(206,224,255,0.5)'); g.addColorStop(1,'rgba(206,224,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    }
  }
  ctx.globalCompositeOperation='source-over';
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t;
}
// 行星光环（径向条带，UV 由几何体手动映射为"半径"方向）
function makeRingTexture(){
  const W=8,H=256; const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  for(let y=0;y<H;y++){
    const t=y/H;
    const v=0.5+0.5*Math.sin(t*46.0)+(Math.random()-0.5)*0.25;
    const a=(t>0.04 && t<0.96)? Math.max(0,Math.min(1,v))*0.85 : 0;
    const s=210 - t*70;
    ctx.fillStyle=`rgba(${s|0},${(s*0.92)|0},${(s*0.74)|0},${a})`;
    ctx.fillRect(0,y,W,1);
  }
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t;
}
function makeCoronaTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,255,255,0.5)');
  g.addColorStop(0.35,'rgba(255,255,255,0.14)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
  ctx.save(); ctx.translate(128,128);
  for(let i=0;i<120;i++){
    const a = Math.random()*Math.PI*2;
    const len = 70 + Math.random()*70;
    const w = 0.6 + Math.random()*1.6;
    ctx.strokeStyle = 'rgba(255,255,255,'+(0.04+Math.random()*0.10).toFixed(3)+')';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*30, Math.sin(a)*30);
    ctx.lineTo(Math.cos(a)*len, Math.sin(a)*len);
    ctx.stroke();
  }
  ctx.restore();
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
function makeFlareTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64,64);
  const grad = (a)=>{ const g=ctx.createLinearGradient(0,0,Math.cos(a)*64,Math.sin(a)*64);
    g.addColorStop(0,'rgba(255,255,255,0.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); return g; };
  for(const a of [0, Math.PI/2, Math.PI*0.25, Math.PI*0.75]){
    ctx.strokeStyle = grad(a); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-Math.cos(a)*60,-Math.sin(a)*60); ctx.lineTo(Math.cos(a)*60,Math.sin(a)*60); ctx.stroke();
  }
  const g = ctx.createRadialGradient(0,0,0,0,0,26);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.5,'rgba(255,255,255,0.5)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,26,0,7); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
// 真实感银河天幕：银河带 + 尘埃暗带 + 发射/反射星云色区 + 幂律星等 + 真实色温
function makeMilkyWayTexture(){
  const W=3072,H=1536;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const ctx=c.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#04050c'); bg.addColorStop(0.5,'#070915'); bg.addColorStop(1,'#03040a');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  const bandY=(x)=> H*0.5 + Math.sin(x/W*Math.PI*2*1.0 + 1.2)*H*0.17 + Math.sin(x/W*Math.PI*2*3 + 0.6)*H*0.045;
  const bandW=H*0.19;

  // 1) 银河主带：大量柔光斑（暖白）叠出体积感
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<2400;i++){
    const x=Math.random()*W;
    const off=(Math.random()+Math.random()-1)*bandW;
    const y=bandY(x)+off;
    const r=18+Math.random()*70;
    const a=0.012+Math.random()*0.045;
    const warm=Math.random();
    const col= warm>0.66 ? 'rgba(255,214,170,' : (warm<0.28?'rgba(150,178,255,':'rgba(220,228,255,');
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, col+a+')'); g.addColorStop(1, col+'0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  }
  // 2) 发射/反射星云色区：沿带选簇，分别画粉红(HII)与蓝(反射)
  const clusters=16;
  for(let k=0;k<clusters;k++){
    const cx=Math.random()*W, cy=bandY(cx)+(Math.random()-0.5)*bandW*1.4;
    const isEmission=Math.random()<0.55;
    const baseCol= isEmission ? [255,120,150] : [120,160,255];
    const blobs=40+Math.floor(Math.random()*40);
    for(let i=0;i<blobs;i++){
      const x=cx+(Math.random()-0.5)*bandW*2.2;
      const y=cy+(Math.random()-0.5)*bandW*1.1;
      const r=24+Math.random()*90;
      const a=(isEmission?0.018:0.014)+Math.random()*0.03;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},${a})`);
      g.addColorStop(1,`rgba(${baseCol[0]},${baseCol[1]},${baseCol[2]},0)`);
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    }
  }
  // 3) 尘埃暗带（multiply，沿带内更暗的丝状结构）
  ctx.globalCompositeOperation='multiply';
  for(let i=0;i<340;i++){
    const x=Math.random()*W; const cy=bandY(x);
    const y=cy+(Math.random()-0.5)*bandW*0.9;
    const r=22+Math.random()*90;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(20,16,28,0.55)'); g.addColorStop(1,'rgba(20,16,28,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';

  // 4) 星点：幂律亮度分布（暗星极多、亮星极少）+ 真实色温，带内更密
  const drawStar=(x,y,r,a,col)=>{
    ctx.globalAlpha=a; ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.globalAlpha=1;
  };
  for(let i=0;i<10000;i++){
    let x=Math.random()*W, y=Math.random()*H;
    const inBand=Math.abs(y-bandY(x))<bandW*1.6;
    if(!inBand && Math.random()>0.22) continue;
    const mag=Math.pow(Math.random(),3.2);
    const r=0.4+mag*2.4;
    const a=0.25+mag*0.7;
    const t=Math.random();
    let col='#ffffff';
    if(t>0.86){ col = Math.random()>0.5 ? '#bcd0ff' : '#ffe1c0'; }
    else if(t>0.7){ col = '#dbe4ff'; }
    drawStar(x,y,r,a,col);
    if(mag>0.93){
      ctx.globalAlpha=a*0.5; ctx.strokeStyle=col; ctx.lineWidth=0.5;
      const L=r*4;
      ctx.beginPath(); ctx.moveTo(x-L,y); ctx.lineTo(x+L,y); ctx.moveTo(x,y-L); ctx.lineTo(x,y+L); ctx.stroke();
      ctx.globalAlpha=1;
    }
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.needsUpdate=true; return t;
}

export function initUniverse(canvas){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // 电影级色调映射
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060f, 0.00035);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 4000);
  camera.position.set(0, 0, 7);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3; controls.maxDistance = 16;
  controls.autoRotate = true; controls.autoRotateSpeed = 0.5;
  controls.enabled = false;

  // ---- 银河天幕（远背景球） ----
  const skyTex = makeMilkyWayTexture();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 80, 56),
    new THREE.MeshBasicMaterial({ map:skyTex, side:THREE.BackSide, depthWrite:false, fog:false })
  );
  scene.add(sky);

  // ---- 星点：双层（近景密集 + 远景稀疏）形成纵深 ----
  const starGroup = new THREE.Group(); scene.add(starGroup);
  const palette = [
    new THREE.Color('#9bb0ff'), new THREE.Color('#aab9ff'), new THREE.Color('#cdd9ff'),
    new THREE.Color('#f8f7ff'), new THREE.Color('#fff3e8'), new THREE.Color('#ffd2a1'),
    new THREE.Color('#ffb27a')
  ];
  // twinkle: 是否缓慢呼吸(仅近景为1)；bright: 整体亮度系数；big: 是否允许少量大亮星
  function buildStars(N, rMin, rMax, sizeBias, twinkle, bright, big){
    const pos = new Float32Array(N*3), sizes = new Float32Array(N), phase = new Float32Array(N), twi = new Float32Array(N);
    const colArr = new Float32Array(N*3);
    for (let i=0;i<N;i++){
      const r = rMin + Math.random()*(rMax-rMin);
      const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
      pos[i*3]   = r*Math.sin(ph)*Math.cos(th);
      pos[i*3+1] = r*Math.sin(ph)*Math.sin(th);
      pos[i*3+2] = r*Math.cos(ph);
      const isBig = big && Math.random() > 0.985;
      sizes[i] = isBig ? 3.0 + Math.random()*3.6 : 0.42 + Math.pow(Math.random(),3)*sizeBias;
      phase[i] = Math.random()*Math.PI*2;
      twi[i] = twinkle;
      const ci = Math.min(palette.length-1, Math.floor(Math.pow(Math.random(),1.6)*palette.length));
      const c = palette[ci];
      colArr[i*3]=c.r*bright; colArr[i*3+1]=c.g*bright; colArr[i*3+2]=c.b*bright;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes,1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase,1));
    g.setAttribute('aTw', new THREE.BufferAttribute(twi,1));
    g.setAttribute('aColor', new THREE.BufferAttribute(colArr,3));
    return new THREE.Points(g, ptMat);
  }
  const ptMat = new THREE.ShaderMaterial({
    uniforms:{ uTime:{value:0} },
    vertexShader: PT_VERT, fragmentShader: PT_FRAG,
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
  });
  // ---- 星点：远 / 中 / 近 三层纵深 ----
  // 远景：数量最多、极小、微弱、不闪烁，作深空背景（亮度进一步压低，拉开纵深）
  starGroup.add(buildStars(9000, 620, 1700, 0.42, 0.0, 0.5, false));
  // 中景：占大多数、中等大小、正常亮度、稳定不闪，构成主体星场
  starGroup.add(buildStars(4500, 140, 560, 1.25, 0.0, 0.95, false));
  // 近景：少量、更大更亮、缓慢呼吸、含少量大亮星（配 bloom 形成极柔光晕），作视觉亮点
  starGroup.add(buildStars(520, 26, 120, 2.7, 1.0, 1.6, true));

  // ---- 亮星 + 星芒层（ astrophotography 质感） ----
  const flareTex = makeFlareTexture();
  const flareColors = ['#ffffff','#bcd0ff','#ffe6c0','#c9a8ff'];
  for(let i=0;i<28;i++){
    const m = new THREE.SpriteMaterial({ map:flareTex, color:new THREE.Color(flareColors[i%flareColors.length]),
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.85, fog:false });
    const s = new THREE.Sprite(m);
    const r = 200 + Math.random()*900;
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    s.position.set(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph));
    const sc = 6 + Math.random()*16; s.scale.set(sc,sc,1);
    starGroup.add(s);
  }

  // ---- 彩色星云（严格贴角落/边缘，极低透明，杜绝全屏灰雾） ----
  const nebTex = makeNebulaTexture();
  const nebColors = ['#3a3160','#27406e','#3a2f5e','#1f4f57','#2f3f66','#4a3344'];  // 更深、更哑光的蓝紫
  const nebula = new THREE.Group(); scene.add(nebula);
  // 5 个点全部推到四角或边缘外，中心与主体内容区完全让出
  const nebSpots = [[1,1],[-1,1],[1,-1],[-1,-1],[0.96,0.82]];
  for (let i=0;i<nebSpots.length;i++){
    const m = new THREE.SpriteMaterial({ map:nebTex, color:new THREE.Color(nebColors[i%nebColors.length]),
      transparent:true, blending:THREE.AdditiveBlending, opacity:0.045 + Math.random()*0.03, depthWrite:false, fog:false });
    const s = new THREE.Sprite(m);
    const [sx,sy] = nebSpots[i];
    const r = 540 + Math.random()*420;
    s.position.set(sx*r, sy*r*0.62, -260 - Math.random()*320);
    const sc = 280 + Math.random()*240; s.scale.set(sc, sc, 1);
    nebula.add(s);
  }

  // ---- 远景深空星系（旋涡星系精灵，增强浩瀚感；低透明，避免加色偏亮显灰） ----
  const galTex = makeGalaxyTexture();
  for(let i=0;i<3;i++){
    const m = new THREE.SpriteMaterial({ map:galTex, color:new THREE.Color('#cfe0ff'),
      transparent:true, blending:THREE.AdditiveBlending, opacity:0.3, depthWrite:false, fog:false });
    const s = new THREE.Sprite(m);
    const r = 800 + Math.random()*500;
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    s.position.set(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph));
    const sc = 120 + Math.random()*120; s.scale.set(sc, sc*0.5, 1);
    s.material.rotation = Math.random()*Math.PI;
    nebula.add(s);
  }

  // ---- 英雄：恒星 ----
  const hero = new THREE.Group(); scene.add(hero);
  const RAD = 1.25;
  const starGeo = new THREE.SphereGeometry(RAD, 192, 192);
  const starMat = new THREE.ShaderMaterial({
    uniforms:{ uColor1:{value:new THREE.Color('#ffd27a')}, uColor2:{value:new THREE.Color('#c25a16')}, uTime:{value:0} },
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG
  });
  const starMesh = new THREE.Mesh(starGeo, starMat); hero.add(starMesh);

  const glowGeo = new THREE.SphereGeometry(RAD*1.18, 64, 64);
  const glowMat = new THREE.ShaderMaterial({
    uniforms:{ uColor:{value:new THREE.Color('#ffb358')} },
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    side:THREE.BackSide, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat); hero.add(glowMesh);

  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map:makeCoronaTexture(), color:new THREE.Color('#ffb358'),
    transparent:true, blending:THREE.AdditiveBlending, opacity:0.12, depthWrite:false }));
  corona.scale.set(RAD*2.9, RAD*2.9, 1); hero.add(corona);

  // ---- 英雄：行星 ----
  const planetGeo = new THREE.SphereGeometry(RAD, 192, 192);
  const planetMat = new THREE.ShaderMaterial({
    uniforms:{ uC1:{value:new THREE.Color('#2f7fc4')}, uC2:{value:new THREE.Color('#5fa84e')},
      uC3:{value:new THREE.Color('#e9e3d2')}, uAtmo:{value:new THREE.Color('#a9d6ff')},
      uTime:{value:0}, uGas:{value:0}, uLightDir:{value:new THREE.Vector3(0.6,0.5,0.85).normalize()}, uCity:{value:1} },
    vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG
  });
  const planetMesh = new THREE.Mesh(planetGeo, planetMat); hero.add(planetMesh);

  const paGeo = new THREE.SphereGeometry(RAD*1.16, 64, 64);
  const paMat = new THREE.ShaderMaterial({
    uniforms:{ uColor:{value:new THREE.Color('#a9d6ff')} },
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    side:THREE.BackSide, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false
  });
  const planetAtmo = new THREE.Mesh(paGeo, paMat); hero.add(planetAtmo);

  // 气态巨行星光环
  const ringGeo = new THREE.RingGeometry(RAD*1.45, RAD*2.5, 128, 1);
  const rpos = ringGeo.attributes.position; const ruv = ringGeo.attributes.uv;
  const inner=RAD*1.45, outer=RAD*2.5;
  for(let i=0;i<rpos.count;i++){
    const x=rpos.getX(i), y=rpos.getY(i);
    const r=Math.sqrt(x*x+y*y);
    const radial=(r-inner)/(outer-inner);
    const ang=Math.atan2(y,x);
    ruv.setXY(i, (ang/(Math.PI*2))+0.5, radial);
  }
  ruv.needsUpdate=true;
  const ringMat = new THREE.MeshBasicMaterial({ map:makeRingTexture(), color:new THREE.Color('#d9c08a'),
    side:THREE.DoubleSide, transparent:true, opacity:0.9, depthWrite:false, fog:false });
  const planetRing = new THREE.Mesh(ringGeo, ringMat);
  planetRing.rotation.x = -1.15; hero.add(planetRing);
  planetRing.visible = false;

  planetMesh.visible = false; planetAtmo.visible = false;

  hero.visible = false; hero.scale.setScalar(0.01);

  // ---- 后期：辉光 + 电影级输出（ACES） ----
  // Bloom 阈值提高、强度降低：只让最亮的日冕/临边微微发光，恒星盘面保留星色与颗粒细节，不再被烧成白块
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Bloom 强度再下调、阈值上调：仅最亮的近景大星与日冕极微发光，彻底去除整场雾感发闷，保持通透
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.10, 0.55, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- 循环 ----
  const clock = new THREE.Clock();
  // active=false 时（首页被神庙照片盖住 / 标签页隐藏）跳过昂贵的渲染，省 GPU 与电量
  let active = true;
  function animate(){
    requestAnimationFrame(animate);
    if (!active || document.hidden) return;
    const t = clock.getElapsedTime();
    ptMat.uniforms.uTime.value = t;
    starMat.uniforms.uTime.value = t;
    planetMat.uniforms.uTime.value = t;
    starMesh.rotation.y = t * 0.10;
    planetMesh.rotation.y = t * 0.07;
    glowMesh.rotation.y = -t * 0.04;
    planetAtmo.rotation.y = -t * 0.03;
    planetRing.rotation.z = t * 0.04;
    corona.material.opacity = 0.24 + 0.05 * Math.sin(t * 1.1);
    corona.scale.setScalar(RAD*3.2 + 0.14 * Math.sin(t * 0.8));
    nebula.rotation.y = t * 0.008;
    sky.rotation.y = t * 0.002;
    controls.update();
    composer.render();
  }
  animate();

  let viewFrac = 0;
  function applyView(){
    if (viewFrac > 0){
      camera.setViewOffset(window.innerWidth, window.innerHeight,
        -Math.round(window.innerWidth*viewFrac), 0, window.innerWidth, window.innerHeight);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    applyView();
  });

  return {
    setStar(star){
      planetRing.visible = false;
      if (star.form === 'planet'){
        starMesh.visible = false; glowMesh.visible = false; corona.visible = false;
        planetMesh.visible = true; planetAtmo.visible = true;
        planetMat.uniforms.uC1.value.set(star.pColor1);
        planetMat.uniforms.uC2.value.set(star.pColor2);
        planetMat.uniforms.uC3.value.set(star.pColor3);
        planetMat.uniforms.uAtmo.value.set(star.pAtmo);
        planetMat.uniforms.uGas.value = (star.planetType === 'gas') ? 1 : 0;
        planetMat.uniforms.uCity.value = (star.planetType === 'terran' || star.planetType === 'desert') ? 1 : 0;
        paMat.uniforms.uColor.value.set(star.pAtmo);
        if (star.planetType === 'gas') planetRing.visible = true;
      } else {
        starMesh.visible = true; glowMesh.visible = true; corona.visible = true;
        planetMesh.visible = false; planetAtmo.visible = false;
        starMat.uniforms.uColor1.value.set(star.color1);
        starMat.uniforms.uColor2.value.set(star.color2);
        glowMat.uniforms.uColor.value.set(star.color1);
        corona.material.color.set(star.color1);
      }
    },
    showHero(){
      hero.visible = true;
      const start = performance.now();
      const from = hero.scale.x, to = 1;
      camera.position.z = 13;
      (function grow(){
        const k = Math.min(1, (performance.now()-start)/1500);
        const e = 1 - Math.pow(1-k, 3);
        hero.scale.setScalar(from + (to-from)*e);
        camera.position.z = 13 + (7-13)*e;
        if (k < 1) requestAnimationFrame(grow);
      })();
    },
    hideHero(){ hero.visible = false; hero.scale.setScalar(0.01); camera.position.z = 7; },
    setControl(on){ controls.enabled = on; controls.autoRotate = on; },
    setFocus(frac){ viewFrac = frac; applyView(); },
    setActive(on){ active = !!on; }
  };
}
