import { starParamList } from './starData.js';
import { hashString, mulberry32 } from './rng.js';
import { getPlanetTexture, whenPlanetTexture } from './textures.js';
import { getBodySurface, sampleHeight } from './bodyTexture.js';
import { encodeStar, shareLink } from './share.js';
import { flagLayers } from './kingdom.js';
import { t } from './i18n.js';

export function initCard(){
  const card = document.getElementById('star-card');
  const no = document.getElementById('card-no');
  const starname = document.getElementById('card-starname');
  const registrant = document.getElementById('card-registrant');
  const flagBox = document.getElementById('card-flag');
  const crestWrap = document.getElementById('card-crest');
  const paramsLeft = document.getElementById('card-params-left');
  const paramsRight = document.getElementById('card-params-right');
  const ribbon = document.getElementById('card-ribbon');
  const orbCanvas = document.getElementById('card-orb-canvas');

  function build(star, kd){
    if (!star) return;
    kd = kd || {};
    const reg = star.registry || (star.catalogNo || '').replace('SSS-', '');
    no.textContent = 'No. ' + reg;
    starname.textContent = star.name;
    registrant.textContent = kd.ruler || t('星际公民');
    ribbon.textContent = reg;

    // 旗帜（建国页生成，随星保存在云端）—— 有则作为羊皮纸顶部纹章
    const svg = kd.flagSVG || (kd.flag ? flagLayers(kd.flag) : '') || '';
    flagBox.innerHTML = svg ? svg.replace('<svg ', '<svg class="flag-img" ') : '';
    if (crestWrap) crestWrap.style.display = svg ? '' : 'none';

    // 星球主视觉（程序化 3D 质感球面重投影）
    drawCelestial(orbCanvas, star);

    // 双列参数 —— 每人认领的星球各不相同，全部动态生成
    const specLabel = star.form === 'planet' ? t('行星类型') : t('光谱类型');
    const specVal = star.form === 'planet'
      ? (star.planetTypeName || '—')
      : (((star.spec || '') + ' 型 · ' + (star.specName || '')).trim() || '—');
    const temp = star.form === 'planet' ? (star.pTemp != null ? star.pTemp : star.temp) : star.temp;
    const diam = star.form === 'planet' ? star.pDiameterKm : star.diameterKm;
    const mass = star.form === 'planet'
      ? ((star.pMassEarth != null ? star.pMassEarth : '—') + ' M⊕')
      : ((star.massSolar != null ? star.massSolar : '—') + ' M☉');
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    const regTime = d.getFullYear() + '.' + p2(d.getMonth()+1) + '.' + p2(d.getDate())
      + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ' UTC';
    const rows = [
      [t('天球坐标'), star.coord || '—'],
      [specLabel, specVal],
      [t('表面温度'), (temp != null ? Number(temp).toLocaleString() + ' K' : '—')],
      [t('距地球'), star.distance || '—'],
      [t('所在星座'), star.constellation || '—'],
      [t('直径'), ((diam || 0).toLocaleString() + ' km')],
      [t('质量'), mass],
      [t('注册时间'), regTime]
    ];
    const mid = Math.ceil(rows.length / 2);
    const renderCol = arr => arr.map(([k, v]) =>
      `<div class="cp-row"><span class="cp-k">${escapeHtml(k)}</span>`
      + `<span class="cp-v" title="${escapeHtml(v)}">${escapeHtml(v)}</span></div>`).join('');
    paramsLeft.innerHTML = renderCol(rows.slice(0, mid));
    paramsRight.innerHTML = renderCol(rows.slice(mid));

    // 星球寄语（建国页填写，随星保存在云端）
    const msgEl = document.getElementById('card-message');
    if (msgEl){
      if (kd.message){
        msgEl.style.display = '';
        msgEl.innerHTML = `<span class="cm-cap">${t('星球寄语')}</span>“${escapeHtml(kd.message)}”`;
      } else {
        msgEl.style.display = 'none';
      }
    }

    // 二维码：编码这颗星专属分享链接，扫码直达该星
    const qrCanvas = document.getElementById('cert-qr');
    if (qrCanvas && typeof window.qrcode === 'function'){
      try {
        const code = encodeStar(star, kd);
        const qr = window.qrcode(0, 'L');
        qr.addData(shareLink(code));
        qr.make();
        const dim = qr.getModuleCount();
        const cell = 4, pad = 10;
        const size = dim * cell + pad * 2;
        qrCanvas.width = size; qrCanvas.height = size;
        const ctx = qrCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#0a0e24';
        for (let r = 0; r < dim; r++) for (let c = 0; c < dim; c++){
          if (qr.isDark(r, c)) ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
        }
      } catch(e){ /* 二维码不可用时保持空白即可 */ }
    }
  }

  // ===== 星球绘制 =====
  function drawCelestial(canvas, star){
    canvas.width = 560; canvas.height = 560; // 提高内部分辨率，导出更清晰
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cx=canvas.width/2, cy=canvas.height/2, r=Math.min(cx,cy)*0.86;
    if (star.form === 'planet'){
      const img = getPlanetTexture(star.planetType);
      if (img){ drawCelestialImage(canvas, ctx, cx, cy, r, star, img); return; }
      // 贴图尚未加载：先画程序化兜底，加载完成后再重绘为真实贴图
      drawPlanet(ctx, cx, cy, r, star);
      whenPlanetTexture(star.planetType, im => { drawCelestialImage(canvas, ctx, cx, cy, r, star, im); });
      return;
    }
    // 恒星：与 3D 视口共用同一套程序化表面（bodyTexture.js），保证两处质感一致
    const surface = getBodySurface(star);
    drawBodySurface(canvas, ctx, cx, cy, r, star, surface);
  }

  // 共享表面渲染：等距柱状彩色图 + 高度场浮雕 → 球面 UV 重投影 + 方向光照 + 大气边缘
  function drawBodySurface(canvas, ctx, cx, cy, r, star, surface){
    const off = document.createElement('canvas');
    off.width = surface.width; off.height = surface.imgH;
    const octx = off.getContext('2d'); octx.drawImage(surface.color, 0, 0);
    const TW = off.width, TH = off.height;
    const tex = octx.getImageData(0,0,TW,TH).data;
    const sample = (u,v)=>{
      u = ((u % 1) + 1) % 1; v = Math.max(0, Math.min(1, v));
      const x = Math.min(TW-1, Math.floor(u * TW));
      const y = Math.min(TH-1, Math.floor((1-v) * TH));
      const i = (y * TW + x) * 4;
      return [tex[i], tex[i+1], tex[i+2]];
    };
    const p = surface.profile;
    const atr = hex2rgb(rgbToHex(p.atmo));
    // 光源（左上前方），与 3D 视口的主光方向保持一致
    let Lx=-0.52, Ly=0.46, Lz=0.72; const ll=Math.hypot(Lx,Ly,Lz); Lx/=ll;Ly/=ll;Lz/=ll;
    const d = Math.ceil(r*2)+4;
    const out = ctx.createImageData(d, d);
    const data = out.data;
    // 浮雕强度：与 3D 视口 bumpScale 同一量级，保证证书与视口观感一致
    const bump = p.normalScale * 1.6;
    for (let py = 0; py < d; py++){
      for (let px = 0; px < d; px++){
        const idx = py*d+px, o = idx*4;
        const dx = px - r, dy = py - r, dist = Math.hypot(dx, dy);
        if (dist > r){ data[o+3] = 0; continue; }
        const nx = dx/r, ny = dy/r, nz = Math.sqrt(Math.max(0, 1 - nx*nx - ny*ny));
        if (nz < 0.02){ data[o+3] = 0; continue; }
        const lon = Math.atan2(nx, nz);
        const lat = Math.asin(ny);
        const u = lon/(Math.PI*2) + 0.5;
        const v = 0.5 - lat/Math.PI;
        let [R,G,B] = sample(u, v);

        // ---- 浮雕：由高度场梯度扰动法线，得到真实的凹凸阴影 ----
        const eu = 1/TW, ev = 1/TH;
        const hL = sampleHeight(surface, u - eu, v);
        const hR = sampleHeight(surface, u + eu, v);
        const hD = sampleHeight(surface, u, v - ev);
        const hU = sampleHeight(surface, u, v + ev);
        // 球面切空间基（T 沿 +u，B 沿 +v）
        const st = Math.sqrt(Math.max(0, 1 - ny*ny));
        const Tx = st > 1e-4 ? (nz/st) : 0, Tz = st > 1e-4 ? (-nx/st) : 0;
        const Bx = -ny*Tx, By = st*st, Bz = -ny*Tz;
        // 梯度按贴图像素归一化（不再乘贴图宽高），避免浮雕被放大成噪点
        const dhdu = (hR - hL);
        const dhdv = -(hU - hD);
        let pnx = nx - (Tx*dhdu + Bx*dhdv) * bump;
        let pny = ny - (0*dhdu + By*dhdv) * bump;
        let pnz = nz - (Tz*dhdu + Bz*dhdv) * bump;
        const pl = Math.hypot(pnx, pny, pnz) || 1;
        pnx/=pl; pny/=pl; pnz/=pl;

        // ---- 光照：主光 + 环境光 + 边缘补光 ----
        // 昼夜过渡带放宽，避免出现生硬的明暗分界线
        const ndl = pnx*Lx + pny*Ly + pnz*Lz;
        const day = smoothstep(-0.22, 0.58, ndl);
        const lit = 0.08 + day * 0.92;
        R*=lit; G*=lit; B*=lit;
        // 背面补一点冷色，避免死黑
        const back = smoothstep(0.15, -0.45, ndl) * 0.18;
        R += atr[0]*back; G += atr[1]*back; B += atr[2]*back;
        // 边缘大气散射
        const rim = Math.pow(Math.max(0, 1 - nz), 3.0);
        R += atr[0]*rim*0.75; G += atr[1]*rim*0.75; B += atr[2]*rim*0.75;

        const aa = smoothstep(r+1.4, r-1.4, dist);
        data[o]   = clamp255(R);
        data[o+1] = clamp255(G);
        data[o+2] = clamp255(B);
        data[o+3] = Math.round(255*aa);
      }
    }
    ctx.putImageData(out, cx - r - 2, cy - r - 2);

    // 外层日冕辉光（大小 / 强度随星而异）
    const glowR = r * (p.glowScale * 0.62);
    const glow = ctx.createRadialGradient(cx, cy, r*0.86, cx, cy, glowR);
    const cHex = rgbToHex(p.atmo);
    glow.addColorStop(0, hexA(cHex, 0));
    glow.addColorStop(0.45, hexA(cHex, 0.14 + p.glowI*0.10));
    glow.addColorStop(1, hexA(cHex, 0));
    ctx.fillStyle = glow; ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  // 真实贴图：等距柱状图按球面 UV 逐像素重投影 + 方向光照 + 大气边缘，呈现照片级星球
  function drawCelestialImage(canvas, ctx, cx, cy, r, star, img){
    const off = document.createElement('canvas');
    off.width = img.naturalWidth || img.width; off.height = img.naturalHeight || img.height;
    const octx = off.getContext('2d'); octx.drawImage(img, 0, 0);
    const TW = off.width, TH = off.height;
    const tex = octx.getImageData(0,0,TW,TH).data;
    const sample = (u,v)=>{
      u = ((u % 1) + 1) % 1; v = Math.max(0, Math.min(1, v));
      const x = Math.min(TW-1, Math.floor(u * TW));
      const y = Math.min(TH-1, Math.floor(v * TH));
      const i = (y * TW + x) * 4;
      return [tex[i], tex[i+1], tex[i+2]];
    };
    const atr = hex2rgb(star.pAtmo || '#9cc4ff');
    // 光源（左上前方）
    let Lx=-0.5, Ly=0.55, Lz=0.72; const ll=Math.hypot(Lx,Ly,Lz); Lx/=ll;Ly/=ll;Lz/=ll;
    const d = Math.ceil(r*2)+4;
    const out = ctx.createImageData(d, d);
    const data = out.data;
    for (let py=0; py<d; py++){
      for (let px=0; px<d; px++){
        const idx = py*d+px, o = idx*4;
        const dx = px - r, dy = py - r, dist = Math.hypot(dx, dy);
        if (dist > r){ data[o+3] = 0; continue; }
        const nx = dx/r, ny = dy/r, nz = Math.sqrt(Math.max(0, 1 - nx*nx - ny*ny));
        if (nz < 0.02){ data[o+3] = 0; continue; }
        const lon = Math.atan2(nx, nz);          // -π..π
        const lat = Math.asin(ny);                // -π/2..π/2
        const u = lon/(Math.PI*2) + 0.5;
        const v = 0.5 - lat/Math.PI;
        let [R,G,B] = sample(u, v);
        const ndl = nx*Lx + ny*Ly + nz*Lz;
        const day = smoothstep(-0.12, 0.5, ndl);
        const lit = 0.04 + day*0.96;
        R*=lit; G*=lit; B*=lit;
        // 边缘大气散射（菲涅尔蓝光边）
        const rim = Math.pow(Math.max(0, 1 - nz), 3.0);
        R += atr[0]*rim*0.9; G += atr[1]*rim*0.9; B += atr[2]*rim*0.9;
        const aa = smoothstep(r+1.4, r-1.4, dist);
        data[o]   = clamp255(R); data[o+1] = clamp255(G); data[o+2] = clamp255(B);
        data[o+3] = Math.round(255*aa);
      }
    }
    ctx.putImageData(out, cx - r - 2, cy - r - 2);
    // 外层大气辉光
    const halo = ctx.createRadialGradient(cx, cy, r*0.92, cx, cy, r*1.34);
    halo.addColorStop(0, hexA(star.pAtmo || '#9cc4ff', 0));
    halo.addColorStop(0.62, hexA(star.pAtmo || '#9cc4ff', 0.16));
    halo.addColorStop(1, hexA(star.pAtmo || '#9cc4ff', 0));
    ctx.fillStyle = halo; ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  // ---- Perlin 3D 噪声（平滑、无缝，避免极点/边缘扭曲） ----
  function makePerlin(rng){
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i=0;i<256;i++) p[i]=i;
    for (let i=255;i>0;i--){ const j=Math.floor(rng()*(i+1)); const t=p[i]; p[i]=p[j]; p[j]=t; }
    for (let i=0;i<512;i++) perm[i]=p[i&255];
    const fade=t=>t*t*t*(t*(t*6-15)+10);
    const lerp=(a,b,t)=>a+(b-a)*t;
    const grad=(h,x,y,z)=>{ const u=(h&1)?-x:x; const v=(h&2)?-y:y; const w=(h&4)?-z:z; return u+v+w; };
    return (x,y,z)=>{
      const X=Math.floor(x)&255, Y=Math.floor(y)&255, Z=Math.floor(z)&255;
      x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);
      const u=fade(x), v=fade(y), w=fade(z);
      const A=perm[X]+Y, AA=perm[A]+Z, AB=perm[A+1]+Z;
      const B=perm[X+1]+Y, BA=perm[B]+Z, BB=perm[B+1]+Z;
      return lerp(
        lerp(lerp(grad(perm[AA],x,y,z),   grad(perm[BA],x-1,y,z),   u),
             lerp(grad(perm[AB],x,y-1,z), grad(perm[BB],x-1,y-1,z), u), v),
        lerp(lerp(grad(perm[AA+1],x,y,z-1), grad(perm[BA+1],x-1,y,z-1), u),
             lerp(grad(perm[AB+1],x,y-1,z-1), grad(perm[BB+1],x-1,y-1,z-1), u), v),
        w);
    };
  }
  function fbm3(noise, x,y,z, oct){
    let s=0,a=0.5,f=1;
    for(let o=0;o<oct;o++){ s+=a*noise(x*f,y*f,z*f); f*=2; a*=0.5; }
    return s;
  }

  // 在高度场中叠加撞击坑（真实立体阴影，而非贴图）
  function addCraters(hm, d, R, rng, count, maxRfrac, depth){
    for (let c=0;c<count;c++){
      const ang=rng()*Math.PI*2, rad=rng()*0.74;
      const ccx=R+Math.cos(ang)*rad*R, ccy=R+Math.sin(ang)*rad*R;
      const rr=R*maxRfrac*(0.4+rng()*0.6);
      const x0=Math.max(0,Math.floor(ccx-rr)), x1=Math.min(d-1,Math.ceil(ccx+rr));
      const y0=Math.max(0,Math.floor(ccy-rr)), y1=Math.min(d-1,Math.ceil(ccy+rr));
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const idx=y*d+x; if(isNaN(hm[idx])) continue;
        const dist=Math.hypot(x-ccx,y-ccy); if(dist>rr) continue;
        const t=dist/rr;                       // 0 中心 → 1 边缘
        const bowl=1-t*t;                       // 碗状凹陷
        const rim=Math.max(0,(t-0.78))/0.22;    // 边缘环脊
        hm[idx]-=depth*(bowl - 0.55*rim);
      }
    }
  }

  function drawPlanet(ctx, cx, cy, r, star){
    const pt = star.planetType;
    const c1=hex2rgb(star.pColor1), c2=hex2rgb(star.pColor2), c3=hex2rgb(star.pColor3), atr=hex2rgb(star.pAtmo);
    const gas = pt === 'gas';
    const rng = mulberry32(hashString(star.catalogNo));
    const perl = makePerlin(rng);
    const warp = makePerlin(mulberry32(hashString(star.catalogNo+'_w')));
    const ox=rng()*50, oy=rng()*50, oz=rng()*50;
    const d = Math.ceil(r*2)+4;
    const hm = new Float32Array(d*d);
    const clm = new Float32Array(d*d);
    for(let py=0;py<d;py++){
      for(let px=0;px<d;px++){
        const dx=px-r, dy=py-r; const dist=Math.hypot(dx,dy);
        const idx=py*d+px;
        if(dist>r){ hm[idx]=NaN; clm[idx]=NaN; continue; }
        const nx=dx/r, ny=dy/r; const nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
        if(gas){
          const tw=warp(nx*1.4+ox, ny*1.4+oy, nz*1.4+oz)*0.7;
          const bands=Math.sin((ny*2.2 + tw*1.8)*Math.PI*1.4)*0.5+0.5;
          const turb=perl(nx*2.0+ox, ny*2.0+oy, nz*2.0+oz)*0.5+0.5;
          hm[idx]=bands*0.55+turb*0.45;
          clm[idx]=perl(nx*3.0+ox+9, ny*3.0+oy+9, nz*3.0+oz+9)*0.5+0.5;
        } else {
          const wx=warp(nx*1.1+ox, ny*1.1+oy, nz*1.1+oz)*0.9;
          const wy=warp(nx*1.1+ox+4, ny*1.1+oy+2, nz*1.1+oz+6)*0.9;
          let e=0,a=0.5,f=1.6;
          for(let o=0;o<6;o++){ e+=a*perl((nx+wx)*f+ox,(ny+wy)*f+oy,nz*f+oz); f*=2; a*=0.5; }
          hm[idx]=e; // ~[-1,1]
          clm[idx]=perl(nx*2.6+ox+20, ny*2.6+oy+20, nz*2.6+oz+20)*0.5+0.5;
        }
      }
    }
    // 撞击坑：月球最密，荒漠/冰原次之，类地少量
    if(!gas){
      const cfg = pt==='lunar' ? [34,0.26,0.55] : pt==='desert' ? [18,0.18,0.42]
               : pt==='ice'   ? [10,0.16,0.34] : [5,0.12,0.26];
      addCraters(hm, d, r, mulberry32(hashString(star.catalogNo+'cr')), cfg[0], cfg[1], cfg[2]);
    }

    // 光照方向（左上前方）
    let Lx=0.46, Ly=0.52, Lz=0.70; const ll=Math.hypot(Lx,Ly,Lz); Lx/=ll;Ly/=ll;Lz/=ll;
    const sea = 0.02;
    const img = ctx.createImageData(d,d); const data=img.data;
    const city = (pt==='terran'||pt==='desert');

    const H=(px,py)=>{ if(px<0||py<0||px>=d||py>=d) return NaN; return hm[py*d+px]; };

    for(let py=0;py<d;py++){
      for(let px=0;px<d;px++){
        const idx=py*d+px; const dist=Math.hypot(px-r,py-r);
        const o=idx*4;
        if(isNaN(hm[idx]) || dist>r+1){ data[o+3]=0; continue; }
        const nx=(px-r)/r, ny=(py-r)/r; const nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
        let R,G,B;
        if(gas){
          const m=hm[idx];
          const c=mix3(c2,c1,Math.min(1,Math.max(0,(m-0.3)/0.7)));
          R=c[0];G=c[1];B=c[2];
          const sx=0.33, sy=0.20, sd=Math.hypot(nx-sx,ny-sy);
          if(sd<0.18){ const tt=1-sd/0.18; const sp=mix3(c, mix3(atr,[255,255,255],0.3), 0.45*tt*tt); R=sp[0];G=sp[1];B=sp[2]; }
          const cl=clm[idx]; const b=0.9+cl*0.22; R*=b;G*=b;B*=b;
        } else {
          const e=hm[idx];
          let c;
          if(pt==='lunar'){
            const h=Math.min(1,Math.max(0,(e+1)/2));
            c = mix3(c2, c3, h*h);                 // 灰调，高地为亮、坑底为暗
          } else if(pt==='desert'){
            if(e>sea){ const h=(e-sea)/(1-sea); c=mix3(c2, c1, Math.min(1,h*1.25)); if(h<0.12) c=mix3(c, c3, 0.4); }
            else { c=mix3(c2, scale3(c2,0.42), Math.min(1,(sea-e)/sea)); }   // 暗色月海/低地
          } else if(pt==='ice'){
            if(e>sea){ const h=(e-sea)/(1-sea); c=mix3(mix3(c3,c2,0.5), c3, Math.min(1,h*1.1)); }
            else { c=mix3(c1, scale3(c1,0.55), Math.min(1,(sea-e)/sea)); }
          } else { // terran（类地/地球）
            if(e>sea){ const h=(e-sea)/(1-sea);
              if(h<0.16) c=mix3(c1, c2, 0.55);     // 近岸浅海→绿
              else c=mix3(c2, c3, Math.min(1,(h-0.16)/0.8));
            } else { const dep=Math.min(1,(sea-e)/sea); c=mix3(scale3(c1,0.5), c1, dep); } // 深海
          }
          R=c[0];G=c[1];B=c[2];
          const polar=Math.abs(ny);
          if(polar>0.66){
            const tt=Math.min(1,(polar-0.66)/0.34);
            const ice=mix3([R,G,B],[240,246,255], tt*0.95);
            R=ice[0];G=ice[1];B=ice[2];
          }
        }
        // 法线：高度梯度 → 球面切向扰动
        const hl=H(px-1,py), hr=H(px+1,py), hd=H(px,py-1), hu=H(px,py+1);
        let gx=(isNaN(hl)||isNaN(hr))?0:(hr-hl);
        let gy=(isNaN(hd)||isNaN(hu))?0:(hu-hd);
        const bump = gas ? 0.12 : 0.5;
        gx*=bump; gy*=bump;
        // 切向基
        let Tx=-ny, Ty=nx, Tz=0; const tl=Math.hypot(Tx,Ty,Tz)||1; Tx/=tl;Ty/=tl;Tz/=tl;
        let Bx=ny*Tz-nz*Ty, By=nz*Tx-nx*Tz, Bz=nx*Ty-ny*Tx;
        // 扰动向量（屏幕 x→T, 屏幕 y→B），注意屏幕 y 向下
        let nxv=nx + (Tx*gx + Bx*(-gy));
        let nyv=ny + (Ty*gx + By*(-gy));
        let nzv=nz + (Tz*gx + Bz*(-gy));
        const nll=Math.hypot(nxv,nyv,nzv)||1; nxv/=nll;nyv/=nll;nzv/=nll;
        const ndl = nxv*Lx + nyv*Ly + nzv*Lz;
        const day = smoothstep(-0.15, 0.45, ndl);
        // 基础受光（留一点压暗，避免过曝发白）
        let lit = 0.04 + day*0.96;
        R=R*lit;G=G*lit;B=B*lit;
        // 海面/冰面 镜面高光
        const specv=Math.pow(Math.max(0,(nxv*(-Lx)+nyv*(-Ly)+nzv*(1-Lz))),28);
        const spk=(!gas && pt!=='lunar' && hm[idx]<=sea)?specv*0.5: gas?specv*0.12:0;
        R+=spk*255;G+=spk*255;B+=spk*255;
        // 云层（类地/冰原，含柔影）
        if((pt==='terran'||pt==='ice') && !gas){
          const cl=clm[idx]; const clA=smoothstep(0.52,0.84,cl)*0.74;
          if(clA>0){ const shadow=clA*0.26*(0.4+day);
            R*=(1-shadow);G*=(1-shadow);B*=(1-shadow);
            R=R*(1-clA)+255*clA; G=G*(1-clA)+255*clA; B=B*(1-clA)+255*clA; }
        }
        // 夜侧城市灯火（类地陆地近海）
        if(city && day<0.30 && !gas){
          const nl=smoothstep(0.30,0.62, fbm3(perl, nx*16+ox+40, ny*16+oy+40, nz*16+oz+40, 3)*0.5+0.5);
          const landMask = (hm[idx]>sea && hm[idx]<sea+0.18)?1:0;
          const night = Math.max(0, 0.30-day)/0.30;
          const lv = nl*landMask*night*0.6;
          R+=255*lv*0.85; G+=200*lv*0.7; B+=120*lv*0.5;
        }
        // 大气临边散射（边缘辉光）
        const rim = Math.pow(Math.max(0,1-nz), 3.0);
        const atm = (pt==='lunar') ? rim*0.16 : rim*(0.5+day*0.5);
        R+=atr[0]*atm;G+=atr[1]*atm;B+=atr[2]*atm;

        // 边缘抗锯齿
        const aa = smoothstep(r+1.4, r-1.4, dist);
        data[o]=clamp255(R); data[o+1]=clamp255(G); data[o+2]=clamp255(B); data[o+3]=Math.round(255*aa);
      }
    }
    // 外层大气辉光（柔和多层）
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
    ctx.putImageData(img, cx-r-2, cy-r-2);
    ctx.restore();
    const halo=ctx.createRadialGradient(cx,cy,r*0.9, cx,cy,r*1.34);
    halo.addColorStop(0, hexA(star.pAtmo,0.0));
    halo.addColorStop(0.6, hexA(star.pAtmo, pt==='lunar'?0.10:0.16));
    halo.addColorStop(1, hexA(star.pAtmo,0));
    ctx.fillStyle=halo; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);

    // 气态巨行星光环（在行星盘之后绘制，仅环绕外侧，干净立体）
    if (gas){
      const rc = hex2rgb(star.pColor3);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);
      ctx.arc(cx,cy,r*0.98,0,Math.PI*2,true);   // 以圆盘为洞，挖空
      ctx.clip('evenodd');
      ctx.translate(cx,cy); ctx.rotate(-0.52);
      const bands=11;
      for(let k=0;k<bands;k++){
        const rr = r*1.34 + k*(r*0.62/bands);
        const a = (k===0||k===bands-1)?0.18 : 0.32 + 0.30*Math.abs(Math.sin(k*1.7));
        ctx.strokeStyle=`rgba(${rc[0]},${rc[1]},${rc[2]},${a.toFixed(3)})`;
        ctx.lineWidth = r*0.62/bands + 1.2;
        ctx.beginPath();
        ctx.ellipse(0,0, rr, rr*0.34, 0, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawStar(ctx, cx, cy, r, star){
    const v = starVariant(star);
    const c1 = hexHueRotate(star.color1, v.hueShift);
    const c2 = hexHueRotate(star.color2, v.hueShift);
    const R = Math.min(cx,cy) * 0.40;
    const rng = mulberry32(hashString(star.catalogNo));
    const perl = makePerlin(rng);
    const ox=rng()*50, oy=rng()*50, oz=rng()*50;
    const d = Math.ceil(R*2)+4;
    const hm = new Float32Array(d*d);   // 米粒（粗 + 细）
    const spm = new Float32Array(d*d);  // 黑子场
    for(let py=0;py<d;py++){
      for(let px=0;px<d;px++){
        const dx=px-R, dy=py-R; const dist=Math.hypot(dx,dy);
        const idx=py*d+px;
        if(dist>R){ hm[idx]=NaN; spm[idx]=NaN; continue; }
        const nx=dx/R, ny=dy/R; const nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
        const g = fbm3(perl, nx*v.granScale+ox, ny*v.granScale+oy, nz*v.granScale+oz, 5);
        const fine = fbm3(perl, nx*v.fineScale+ox+13, ny*v.fineScale+oy+13, nz*v.fineScale+oz+13, 3);
        hm[idx] = g*0.7 + fine*0.3;
        spm[idx] = fbm3(perl, nx*2.4+ox+50, ny*2.4+oy+50, nz*2.4+oz+50, 4)*0.5+0.5;
      }
    }
    // 体积光晕（大小 / 强度按星可变化）
    const glowR = Math.min(cx,cy) * v.coronaScale;
    const glow = ctx.createRadialGradient(cx,cy,R*0.45, cx,cy,glowR);
    glow.addColorStop(0, hexA(rgb2hex(c1), Math.min(0.72, 0.30+v.coronaI*1.3)));
    glow.addColorStop(0.32, hexA(rgb2hex(c1), 0.14+v.coronaI*0.5));
    glow.addColorStop(1, hexA(rgb2hex(c1), 0));
    ctx.fillStyle=glow; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);

    // 衍射星芒（四向主芒 + 斜向副芒）
    const spikes=[0, Math.PI/2, Math.PI, 3*Math.PI/2, Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
    spikes.forEach((ang,i)=>{
      const main=(i<4);
      const len=main?Math.min(cx,cy)*0.95:Math.min(cx,cy)*0.55;
      const ex=cx+Math.cos(ang)*len, ey=cy+Math.sin(ang)*len;
      const g=ctx.createLinearGradient(cx,cy,ex,ey);
      g.addColorStop(0, `rgba(${c1[0]},${c1[1]},${c1[2]},${main?0.55:0.30})`);
      g.addColorStop(1, `rgba(${c1[0]},${c1[1]},${c1[2]},0)`);
      ctx.strokeStyle=g; ctx.lineWidth=main?2.6:1.3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(ex,ey); ctx.stroke();
    });

    // 星面（米粒 + 带半影黑子 + 光斑 + 临边昏暗 + 色球环）
    const img=ctx.createImageData(d,d); const data=img.data;
    const light=c1, dark=scale3(c1,0.40), umb=scale3(c1,0.10), pen=scale3(c1,0.34);
    const fac=[Math.min(255,c1[0]+45),Math.min(255,c1[1]+45),Math.min(255,c1[2]+45)];
    for(let py=0;py<d;py++){
      for(let px=0;px<d;px++){
        const idx=py*d+px; const dist=Math.hypot(px-R,py-R);
        const o=idx*4;
        if(isNaN(hm[idx]) || dist>R+1){ data[o+3]=0; continue; }
        const nx=(px-R)/R, ny=(py-R)/R; const nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
        const gran=hm[idx]*0.5+0.5;
        const t=smoothstep(0.22,0.78,gran);
        let col=mix3(dark, light, t);
        const sp=spm[idx];
        if (sp < v.spotCov){
          const penM=smoothstep(v.spotCov, v.spotCov-0.06, sp);
          const umbM=smoothstep(v.spotCov-0.06, v.spotCov-0.16, sp);
          col=mix3(col, pen, penM*0.55);
          col=mix3(col, umb, umbM*v.spotDark);
        } else if (sp < v.spotCov+0.045){
          const f=smoothstep(v.spotCov+0.045, v.spotCov, sp);
          col=mix3(col, fac, f*0.35);
        }
        // 临边昏暗
        const limb=Math.pow(Math.max(0,nz),0.6);
        const dn=mix(0.20,1.18,limb);
        col=[col[0]*dn,col[1]*dn,col[2]*dn];
        // 色球边缘微光
        const chrom=Math.pow(Math.max(0,1-nz),3.2);
        col=mix3(col, c1, chrom*0.30);
        const aa=smoothstep(R+1.4,R-1.4,dist);
        data[o]=clamp255(col[0]); data[o+1]=clamp255(col[1]); data[o+2]=clamp255(col[2]); data[o+3]=Math.round(255*aa);
      }
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
    ctx.putImageData(img, cx-R-2, cy-R-2);
    ctx.restore();
    // 高光边缘
    ctx.strokeStyle=hexA(rgb2hex(c1),0.5); ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
  }

  // ===== 星座星图（雕版星图，更精致立体） =====
  function drawSkyChart(canvas, star){
    canvas.width = 480; canvas.height = 320;
    const ctx=canvas.getContext('2d');
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    // 深蓝底 + 渐变
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#102044'); bg.addColorStop(1,'#060a1a');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    // 暗角
    const vig=ctx.createRadialGradient(W/2,H/2,H*0.2, W/2,H/2,H*0.72);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
    // 银河斜带（提升深空立体层次）
    ctx.save();
    ctx.translate(W/2,H/2); ctx.rotate(-0.5);
    const mw=ctx.createLinearGradient(0,-H*0.22,0,H*0.22);
    mw.addColorStop(0,'rgba(120,150,235,0)');
    mw.addColorStop(0.5,'rgba(150,175,245,0.20)');
    mw.addColorStop(1,'rgba(120,150,235,0)');
    ctx.fillStyle=mw; ctx.fillRect(-W,H*0.22*-1,H*2,H*0.44);
    ctx.restore();

    const rs=mulberry32(hashString(star.catalogNo+'sky'));
    // 极淡星云底色
    const neb=ctx.createRadialGradient(W*0.3,H*0.32,4, W*0.3,H*0.32,W*0.6);
    neb.addColorStop(0,'rgba(70,95,170,0.22)'); neb.addColorStop(1,'rgba(70,95,170,0)');
    ctx.fillStyle=neb; ctx.fillRect(0,0,W,H);
    const neb2=ctx.createRadialGradient(W*0.72,H*0.72,4, W*0.72,H*0.72,W*0.45);
    neb2.addColorStop(0,'rgba(160,90,130,0.18)'); neb2.addColorStop(1,'rgba(160,90,130,0)');
    ctx.fillStyle=neb2; ctx.fillRect(0,0,W,H);
    // 背景星点（含星芒，更密更亮）
    for(let i=0;i<170;i++){
      const x=16+rs()*(W-32), y=14+rs()*(H-28);
      const rad=0.5+rs()*2.0, o=0.45+rs()*0.55;
      const c= rs()>0.8 ? (rs()>0.5?'rgba(190,208,255,':'rgba(255,225,190,') : 'rgba(255,255,255,';
      ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2);
      ctx.fillStyle=`${c}${o.toFixed(2)})`; ctx.fill();
      if(rs()>0.82){
        ctx.strokeStyle=`rgba(200,220,255,${(o*0.55).toFixed(2)})`; ctx.lineWidth=0.5;
        ctx.beginPath(); ctx.moveTo(x,y-rad*4.2); ctx.lineTo(x,y+rad*4.2);
        ctx.moveTo(x-rad*4.2,y); ctx.lineTo(x+rad*4.2,y); ctx.stroke();
      }
    }

    // 结构化星座（一条清晰的折线 + 节点，金色更亮）
    const n=7+Math.floor(rs()*3);
    const pts=[];
    let px=30+rs()*(W*0.18), py=24+rs()*(H*0.2);
    for(let i=0;i<n;i++){
      pts.push([px,py]);
      px=Math.max(34,Math.min(W-34, px + 36+rs()*(W-90)/n));
      py=Math.max(24,Math.min(H-30, py + (rs()-0.5)*(H*0.5)));
    }
    ctx.strokeStyle='rgba(225,190,120,0.7)'; ctx.lineWidth=0.9;
    ctx.beginPath();
    pts.forEach((p,i)=> i? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]));
    ctx.stroke();
    pts.forEach((p,i)=>{
      ctx.beginPath(); ctx.arc(p[0],p[1], i===0?2.3:1.9, 0, Math.PI*2);
      ctx.fillStyle= i===0?'#fff0c8':'#ffe9b0'; ctx.fill();
      if(i===0){ ctx.strokeStyle='rgba(255,233,176,.5)'; ctx.lineWidth=0.6;
        ctx.beginPath(); ctx.arc(p[0],p[1],5,0,Math.PI*2); ctx.stroke(); }
    });

    // RA / Dec 坐标刻度（边缘标注，强化“星图”专业感）
    ctx.fillStyle='rgba(159,180,255,0.5)'; ctx.font='8px "Space Grotesk"'; ctx.textAlign='center';
    for(let k=1;k<6;k++){
      const x=18 + (W-36)*k/6;
      ctx.fillRect(x,10,1,3); ctx.fillRect(x,H-13,1,3);
      ctx.fillText((k*4)+'h', x, H-4);
    }
    ctx.textAlign='left';
    for(let k=1;k<4;k++){
      const y=16 + (H-32)*k/4;
      ctx.fillRect(10,y,3,1); ctx.fillRect(W-13,y,3,1);
      ctx.fillText((60-k*30)+'°', 14, y+3);
    }

    // 目标星（光晕 + 红圈标位 + 十字 + 标签）
    const tx=Math.max(34,Math.min(W-34, 40 + (star.ra/24)*(W-96)));
    const ty=Math.max(32,Math.min(H-30, 34 + ((star.dec+90)/180)*(H-68)));
    const hg=ctx.createRadialGradient(tx,ty,0,tx,ty,22);
    hg.addColorStop(0,'rgba(255,150,150,0.5)'); hg.addColorStop(1,'rgba(255,150,150,0)');
    ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(tx,ty,22,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,96,96,0.95)'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.arc(tx,ty,12,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=0.9; ctx.globalAlpha=0.85;
    ctx.beginPath(); ctx.moveTo(tx,ty-18); ctx.lineTo(tx,ty+18);
    ctx.moveTo(tx-18,ty); ctx.lineTo(tx+18,ty); ctx.stroke();
    ctx.globalAlpha=1;
    const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,6);
    tg.addColorStop(0,'#fff'); tg.addColorStop(1,'#ff9a9a');
    ctx.beginPath(); ctx.arc(tx,ty,4.6,0,Math.PI*2); ctx.fillStyle=tg; ctx.fill();
    ctx.fillStyle='rgba(255,210,210,0.96)'; ctx.font='bold 10px "Space Grotesk"'; ctx.textAlign='center';
    ctx.fillText(star.name.toUpperCase(), tx, ty-21);
    ctx.fillStyle='rgba(255,170,170,0.8)'; ctx.font='8px "Space Grotesk"';
    ctx.fillText(t('★ 你的星'), tx, ty+24);

    // 底部坐标
    ctx.fillStyle='rgba(159,180,255,0.92)'; ctx.font='9px "Space Grotesk"';
    ctx.fillText(`${star.constellation}  ·  ${star.coordShort||''}`, W/2, H-19);
    // 外金框
    ctx.strokeStyle='rgba(207,168,106,0.55)'; ctx.lineWidth=1.2;
    ctx.strokeRect(2,2,W-4,H-4);
  }

  // html2canvas 仅在导出证书时需要：按需动态加载，不阻塞首屏
  let h2cLoading = null;
  function ensureHtml2Canvas(){
    if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
    if (h2cLoading) return h2cLoading;
    h2cLoading = new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.async = true;
      s.onload = ()=> resolve(window.html2canvas);
      s.onerror = ()=>{ h2cLoading = null; reject(new Error('html2canvas 加载失败')); };
      document.head.appendChild(s);
    });
    return h2cLoading;
  }

  async function download(star){
    const btn=document.getElementById('btn-download');
    const old=btn.textContent; btn.textContent='生成中…'; btn.disabled=true;
    try {
      const h2c = await ensureHtml2Canvas();
      const canvas=await h2c(card, { backgroundColor:null, scale:2, useCORS:true, logging:false });
      const link=document.createElement('a');
      link.download=`${t('星与星空')}_${star.name}.png`;
      link.href=canvas.toDataURL('image/png');
      link.click();
      toast(t('星图已保存，去分享吧 ✦'));
    } catch(e){ toast(t(e && e.message === 'html2canvas 加载失败' ? '截图组件加载失败，请检查网络后重试' : '生成失败，请重试')); console.error(e); }
    btn.textContent=old; btn.disabled=false;
  }

  function toast(msg){
    const t=document.getElementById('toast');
    t.textContent=msg; t.classList.add('show');
    clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2000);
  }

  return { build, download };
}

// ===== 颜色与数学辅助 =====
function hexA(hex,a){
  const h=(hex||'#888888').replace('#','');
  const r=parseInt(h.substring(0,2),16), g=parseInt(h.substring(2,4),16), b=parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function hex2rgb(hex){
  const h=(hex||'#888888').replace('#','');
  return [parseInt(h.substring(0,2),16),parseInt(h.substring(2,4),16),parseInt(h.substring(4,6),16)];
}
function mix3(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function scale3(a,t){ return [a[0]*t, a[1]*t, a[2]*t]; }
function mix(a,b,t){ return a+(b-a)*t; }
function smoothstep(e0,e1,x){ const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0))); return t*t*(3-2*t); }
function clamp255(v){ return v<0?0:(v>255?255:v); }
function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// RGB 数组 → #hex（供日冕辉光等处使用）
function rgbToHex(c){
  const h = n => ('0' + Math.round(Math.max(0, Math.min(255, n))).toString(16)).slice(-2);
  return '#' + h(c[0]) + h(c[1]) + h(c[2]);
}
