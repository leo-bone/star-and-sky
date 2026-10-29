// 认领星球处的"可拖拽旋转 / 滚轮缩放" 3D 星球视口。
// 表面：程序化生成彩色图 + 法线图（等距柱状），由 bodyTexture.js 统一产出，
//       3D 视口与认证书共用同一套贴图，两处质感完全一致。
// 光照：方向光 + 法线贴图 → 昼夜终止线与浮雕凹凸，转动时能明确看出球面体积。
// 交互：OrbitControls 允许相机环绕（拖拽旋转 / 滚轮缩放），星体自身缓慢自转。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getBodySurfaceAsync } from './bodyTexture.js?v=20261042';

// ---------- 光晕 ----------
// ① 边缘辉光：球壳 + 菲涅尔。BackSide 渲染时球壳法线背对相机，
//    dot(vN,vView) 恒为负，必须取 abs() 才能得到"中心透明、边缘发亮"的正确轮廓。
//    （此前误用 max(...,0) 把负值钳成 0，导致菲涅尔项恒为 1，
//      整块球壳以不透明度 1 加法混合铺满全屏 —— 扁平橙色圆盘的根因。）
// ② 外层光晕：面向相机的径向渐变片，中心透明，只在外围柔和扩散。
function makeGlowTexture(){
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  // 中心完全透明（避免叠在星球表面形成白斑），从 0.42 处开始泛起
  g.addColorStop(0.00, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.60)');
  g.addColorStop(0.70, 'rgba(255,255,255,0.24)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.07)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 边缘辉光壳层着色器：f = pow(1 - |N·V|, power)
const ATMO_VERT = `
varying vec3 vN; varying vec3 vView;
void main(){
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const ATMO_FRAG = `
uniform vec3 uColor; uniform float uPower; uniform float uIntensity;
varying vec3 vN; varying vec3 vView;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), uPower) * uIntensity;
  gl_FragColor = vec4(uColor, f);
}`;


export function initPlanet3D(canvas){
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch(e){ return { setStar(){}, show(){}, hide(){}, resize(){} }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 0.15, 3.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableRotate = true; controls.enableZoom = true; controls.rotateSpeed = 1.0;
  controls.minDistance = 1.7; controls.maxDistance = 9;
  controls.zoomSpeed = 0.9; controls.zoomToCursor = true;
  controls.autoRotate = false;   // 交由用户手动拖拽，星体自身缓慢自转

  // 视口内星场背景：增强空间纵深，旋转 / 缩放时明显感知 3D 构图（克制密度，少即是多）
  const starGeo = new THREE.BufferGeometry();
  const STAR_N = 600;
  const sp = new Float32Array(STAR_N * 3);
  for (let i = 0; i < STAR_N; i++){
    const r = 40 + Math.random() * 40;
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    sp[i * 3] = r * s * Math.cos(t); sp[i * 3 + 1] = r * u; sp[i * 3 + 2] = r * s * Math.sin(t);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false
  }));
  scene.add(starField);

  // 光照：主光（产生昼夜终止线 → 球体体积感）+ 冷色环境光 + 边缘补光
  const key = new THREE.DirectionalLight(0xfff4e0, 3.1);
  key.position.set(-1.3, 0.9, 1.7); scene.add(key);
  scene.add(new THREE.AmbientLight(0x2a3a55, 0.45));
  const rim = new THREE.DirectionalLight(0x88aaff, 0.7);
  rim.position.set(1.4, -0.4, -1.2); scene.add(rim);

  const geo = new THREE.SphereGeometry(1, 160, 160);

  // 球体材质：程序化彩色图 + bumpMap 浮雕（屏幕空间导数求凹凸，UV 任意布局都正确）
  const bodyMat = new THREE.MeshStandardMaterial({
    roughness: 0.92, metalness: 0.0, color: 0xffffff,
    map: null, bumpMap: null, bumpScale: 0.035,
    emissive: new THREE.Color('#000000'), emissiveIntensity: 1.0,
  });

  // 占位贴图：贴图生成完成前先显示一颗素雅星球，避免出现空白视口
  function makePlaceholderTexture(){
    const W = 256, H = 128;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let py = 0; py < H; py++){
      const v = 1 - (py + 0.5) / H;
      for (let px = 0; px < W; px++){
        const u = (px + 0.5) / W;
        const phi = u * Math.PI * 2, theta = (1 - v) * Math.PI;
        const st = Math.sin(theta);
        const d = [-Math.cos(phi)*st, Math.cos(theta), Math.sin(phi)*st];
        // 极轻的带状起伏，暗示这是一颗有表面的天体
        const band = 0.5 + 0.06 * Math.sin(d[1] * 9 + Math.cos(phi) * 2);
        const base = 0.30 + band * 0.32;
        const i = (py*W + px) * 4;
        img.data[i]   = clamp8(base * 205);
        img.data[i+1] = clamp8(base * 178);
        img.data[i+2] = clamp8(base * 150);
        img.data[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function clamp8(v){ return v < 0 ? 0 : (v > 255 ? 255 : v); }
  const placeholder = makePlaceholderTexture();

  const mesh = new THREE.Mesh(geo, bodyMat); scene.add(mesh);

  // 日冕 / 大气辉光
  // ① 边缘辉光：略微放大的球壳（BackSide），只在轮廓处发亮 —— 强化"球"的立体轮廓
  const atmGeo = new THREE.SphereGeometry(1.10, 64, 64);
  const atmMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#9cc4ff') },
      uPower: { value: 3.0 },
      uIntensity: { value: 0.8 },
    },
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const atm = new THREE.Mesh(atmGeo, atmMat); scene.add(atm);

  // ② 外层光晕：面向相机的径向渐变片，中心透明，只在外围柔和扩散
  const glowTex = makeGlowTexture();
  const coronaMat = new THREE.SpriteMaterial({
    map: glowTex, color: 0xffb358, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const corona = new THREE.Sprite(coronaMat); corona.visible = false; scene.add(corona);

  // ②-2 外层弥散光晕：更大更淡、淡紫调，缓慢弥散，营造层次而非均匀灰雾
  const outerCoronaMat = new THREE.SpriteMaterial({
    map: glowTex, color: 0x9a86ff, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const outerCorona = new THREE.Sprite(outerCoronaMat); outerCorona.visible = false; scene.add(outerCorona);

  // 气态巨行星光环：始终朝向相机的倾斜椭圆环，
  // 用 Sprite + 程序化环状贴图实现 —— 避免真实环形几何在近水平时
  // 外径超出视锥被裁切成"色块"，且能随缩放自适应大小。
  const ringTex = (function(){
    const S = 256;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0,0,S,S);
    // 椭圆环带（外径 0.98，内径 0.62），带内外柔化边缘
    ctx.save();
    ctx.translate(S/2, S/2);
    ctx.scale(1, 0.30);          // 压扁成椭圆，模拟倾斜视角
    for (let i = 0; i < 26; i++){
      const t = i / 25;
      const rad = S * (0.62 + t * 0.36);
      const alpha = 0.30 * Math.sin(Math.PI * t) + 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,238,196,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = S * 0.014;
      ctx.stroke();
    }
    ctx.restore();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const ringMat = new THREE.SpriteMaterial({
    map: ringTex, color: 0xffe6b8, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const ring = new THREE.Sprite(ringMat);
  ring.scale.setScalar(2.5);
  ring.visible = false; scene.add(ring);

  let currentStar = null;
  let spinSpeed = 0.10;
  let pendingKey = '';

  // 表面贴图由 bodyTexture.js 统一生成（3D 与认证书共用），此处只需转成 three 贴图
  const texCache = {};
  function applySurface(surface){
    const key = (currentStar && (currentStar.catalogNo || currentStar.name)) || 'x';
    if (!texCache[key]){
      const map = new THREE.CanvasTexture(surface.color);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping; map.wrapT = THREE.ClampToEdgeWrapping;
      map.anisotropy = 8;
      const bump = new THREE.CanvasTexture(surface.bump);
      bump.wrapS = THREE.RepeatWrapping; bump.wrapT = THREE.ClampToEdgeWrapping;
      bump.anisotropy = 4;
      texCache[key] = { map, bump, profile: surface.profile };
    }
    const t = texCache[key];
    const p = t.profile;

    mesh.material = bodyMat;
    bodyMat.map = t.map;
    bodyMat.bumpMap = t.bump;
    bodyMat.bumpScale = 0.012 + p.normalScale * 0.016;   // 浮雕强度随星而异
    bodyMat.color.set(0xffffff);
    bodyMat.roughness = p.flavor === 'icy' ? 0.72 : 0.93;
    bodyMat.needsUpdate = true;

    // 日冕 / 大气：取该星大气色，混入淡紫 + 浅金，分层渲染（内层紧贴 / 外层弥散），去除灰雾感
    const atmoCol = new THREE.Color(p.atmo[0]/255, p.atmo[1]/255, p.atmo[2]/255);
    const warmGold = new THREE.Color(0xf5c97b);
    const softViolet = new THREE.Color(0x9a86ff);
    // 内层光晕：紧贴星球，暖金偏紫，较亮
    coronaMat.color.copy(atmoCol).lerp(warmGold, 0.18);
    coronaMat.opacity = 0.34 + p.glowI * 0.28;
    corona.scale.setScalar(p.glowScale * 0.96);
    corona.visible = true;
    // 外层弥散光晕：淡紫、更大更淡，缓慢弥散
    outerCoronaMat.color.copy(atmoCol).lerp(softViolet, 0.35);
    outerCoronaMat.opacity = 0.14 + p.glowI * 0.12;
    outerCorona.scale.setScalar(p.glowScale * 1.55);
    outerCorona.visible = true;

    // 边缘菲涅尔辉光：冷调蓝紫，克制强度，作为轮廓而非灰雾
    atmMat.uniforms.uColor.value.copy(atmoCol).lerp(softViolet, 0.15);
    atmMat.uniforms.uIntensity.value = 0.45 + p.glowI * 0.5;
    atmMat.uniforms.uPower.value = 2.6 + p.glowI * 1.4;
    atm.scale.setScalar(1 + p.glowScale * 0.035);
    atm.visible = true;

    ring.visible = (p.flavor === 'banded');
    if (ring.visible){
      ringMat.color.setRGB(p.pal.bright[0]/255, p.pal.bright[1]/255, p.pal.bright[2]/255);
      ringMat.opacity = 0.45 + p.glowI * 0.25;
      ring.scale.setScalar(2.35 + p.glowScale * 0.08);
    }

    spinSpeed = p.spin;
  }

  function setStar(star){
    currentStar = star;
    if (!star) return;
    const key = (star.catalogNo || star.name || 'x');
    if (key === pendingKey) return;
    pendingKey = key;

    // 先上占位贴图 + 依据光谱色的临时光晕，保证视口立刻有内容
    const cached = texCache[key];
    if (cached){
      const p = cached.profile;
      bodyMat.map = cached.map; bodyMat.bumpMap = cached.bump;
      bodyMat.bumpScale = 0.012 + p.normalScale * 0.016;
      bodyMat.needsUpdate = true;
      const ac = new THREE.Color(p.atmo[0]/255, p.atmo[1]/255, p.atmo[2]/255);
      const wg = new THREE.Color(0xf5c97b), sv = new THREE.Color(0x9a86ff);
      coronaMat.color.copy(ac).lerp(wg, 0.18); coronaMat.opacity = 0.55 + p.glowI * 0.28;
      corona.scale.setScalar(p.glowScale * 0.96); corona.visible = true;
      outerCoronaMat.color.copy(ac).lerp(sv, 0.35); outerCoronaMat.opacity = 0.14 + p.glowI * 0.12;
      outerCorona.scale.setScalar(p.glowScale * 1.55); outerCorona.visible = true;
      atmMat.uniforms.uColor.value.copy(ac).lerp(sv, 0.15);
      atmMat.uniforms.uIntensity.value = 0.45 + p.glowI * 0.5;
      atmMat.uniforms.uPower.value = 2.6 + p.glowI * 1.4;
      atm.scale.setScalar(1 + p.glowScale * 0.035); atm.visible = true;
      ring.visible = (p.flavor === 'banded');
      spinSpeed = p.spin;
      return;
    }
    bodyMat.map = placeholder; bodyMat.bumpMap = null; bodyMat.needsUpdate = true;
    const tmp = new THREE.Color(star.color1 || '#ffd66b');
    const wg = new THREE.Color(0xf5c97b), sv = new THREE.Color(0x9a86ff);
    coronaMat.color.copy(tmp).lerp(wg, 0.18); coronaMat.opacity = 0.42; corona.scale.setScalar(2.8); corona.visible = true;
    outerCoronaMat.color.copy(tmp).lerp(sv, 0.35); outerCoronaMat.opacity = 0.16; outerCorona.scale.setScalar(4.2); outerCorona.visible = true;
    atmMat.uniforms.uColor.value.copy(tmp).lerp(sv, 0.15);
    atmMat.uniforms.uIntensity.value = 0.6; atmMat.uniforms.uPower.value = 3.0;
    atm.scale.setScalar(1.1); atm.visible = true;

    // 异步生成真实表面（分帧执行，不阻塞 UI），完成后替换占位贴图
    getBodySurfaceAsync(star, (surface) => {
      if (pendingKey !== key) return;   // 期间用户已切换到别的星，丢弃
      applySurface(surface);
    });
  }

  function resize(){
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 320;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  let running = false, rafId = 0;
  const clock = new THREE.Clock();
  function loop(){
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    // 星体缓慢自转（轴向），表面纹理随之流动 → 立体旋转一目了然
    mesh.rotation.y += dt * spinSpeed;
    controls.update();
    renderer.render(scene, camera);
  }

  function show(){
    canvas.style.visibility = 'visible';
    requestAnimationFrame(() => { resize(); });
    if (!running){ running = true; clock.start(); loop(); }
  }
  function hide(){
    canvas.style.visibility = 'hidden';
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  window.addEventListener('resize', resize);
  resize();

  return { setStar, show, hide, resize };
}
