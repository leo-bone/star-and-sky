// 沉浸问答：爱好 / 星座 / 性格 / 人生信念
import { t } from './i18n.js?v=20261055';
const HOBBIES = [
  { id:'艺术 / 音乐', ico:'🎨', sub:'Art & Music' },
  { id:'科学 / 探索', ico:'🔭', sub:'Science' },
  { id:'自然 / 旅行', ico:'🌿', sub:'Nature' },
  { id:'竞技 / 挑战', ico:'⚔️', sub:'Challenge' },
  { id:'安静 / 思考', ico:'🌙', sub:'Quiet' },
  { id:'社交 / 联结', ico:'🤝', sub:'Social' },
];
const ZODIAC = [
  { id:'白羊座', ico:'♈' },{ id:'金牛座', ico:'♉' },{ id:'双子座', ico:'♊' },
  { id:'巨蟹座', ico:'♋' },{ id:'狮子座', ico:'♌' },{ id:'处女座', ico:'♍' },
  { id:'天秤座', ico:'♎' },{ id:'天蝎座', ico:'♏' },{ id:'射手座', ico:'♐' },
  { id:'摩羯座', ico:'♑' },{ id:'水瓶座', ico:'♒' },{ id:'双鱼座', ico:'♓' },
];
const PERSONA = [
  { key:'extrovert',   a:'外向', b:'内向' },
  { key:'rational',    a:'理性', b:'感性' },
  { key:'adventurous', a:'冒险', b:'稳健' },
  { key:'leader',      a:'领导者', b:'协作者' },
];
const BELIEFS = [
  { id:'explore', ico:'🚀', name:'探索', sub:'探索未知' },
  { id:'freedom', ico:'🕊️', name:'自由', sub:'自由不羁' },
  { id:'truth',   ico:'🔆', name:'真理', sub:'追寻真理' },
  { id:'love',    ico:'💗', name:'仁爱', sub:'悲悯仁爱' },
  { id:'order',   ico:'⚖️', name:'秩序', sub:'建立秩序' },
  { id:'create',  ico:'🛠️', name:'创造', sub:'创造万物' },
];

// 星座选择（IAU 三字母代码，供真实星表按星座认领；random=交给宇宙决定）
const CONSTS = [
  { id:'Ori', zh:'猎户座', ico:'🏹' },{ id:'Lyr', zh:'天琴座', ico:'🎵' },
  { id:'And', zh:'仙女座', ico:'👸' },{ id:'Sco', zh:'天蝎座', ico:'🦂' },
  { id:'UMa', zh:'大熊座', ico:'🐻' },{ id:'UMi', zh:'小熊座', ico:'⭐' },
  { id:'Aql', zh:'天鹰座', ico:'🦅' },{ id:'Cyg', zh:'天鹅座', ico:'🦢' },
  { id:'Her', zh:'武仙座', ico:'💪' },{ id:'Per', zh:'英仙座', ico:'⚔️' },
  { id:'Gem', zh:'双子座', ico:'👬' },{ id:'Leo', zh:'狮子座', ico:'🦁' },
  { id:'Vir', zh:'室女座', ico:'🌾' },{ id:'Lib', zh:'天秤座', ico:'⚖️' },
  { id:'Mon', zh:'麒麟座', ico:'🦄' },{ id:'Car', zh:'船底座', ico:'⛵' },
  { id:'Aur', zh:'御夫座', ico:'🛞' },{ id:'CrB', zh:'北冕座', ico:'👑' },
  { id:'Oph', zh:'蛇夫座', ico:'🐍' },{ id:'Hya', zh:'长蛇座', ico:'🐉' },
  { id:'random', zh:'宇宙决定', ico:'🎲' }
];

export function initQuiz({ stage, bar, count, prevBtn, nextBtn, onDone }){
  const answers = {
    hobbies: [],
    constellation: null,
    zodiac: null,
    personality: { extrovert:false, rational:false, adventurous:false, leader:false },
    beliefs: null
  };
  let step = 0;
  const TOTAL = 5;

  function render(){
    bar.style.width = ((step+1)/TOTAL*100) + '%';
    count.textContent = String(step+1).padStart(2,'0') + ' / ' + String(TOTAL).padStart(2,'0');
    prevBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = step === TOTAL-1 ? t('生成我的星星') + ' ✦' : t('下一题');
    stage.innerHTML = card(step);
    bind(step);
  }

  function card(i){
    if (i===0){
      const opts = HOBBIES.map(h=>`
        <div class="opt ${answers.hobbies.includes(h.id)?'sel':''}" data-h="${h.id}">
          <span class="ico">${h.ico}</span>
          <span>${t(h.id)}<span class="sub">${h.sub}</span></span>
        </div>`).join('');
      return `<div class="q-card">
        <div class="q-title">${t('你被什么吸引？')}</div>
        <div class="q-desc">${t('选择 1–3 项爱好，它们会塑造你星辰的禀赋。（可多选）')}</div>
        <div class="q-options cols3">${opts}</div></div>`;
    }
    if (i===1){
      const opts = CONSTS.map(c=>`
        <div class="opt ${answers.constellation===c.id?'sel':''}" data-c="${c.id}">
          <span class="ico">${c.ico}</span><span>${t(c.zh)}</span></div>`).join('');
      return `<div class="q-card">
        <div class="q-title">${t('你的星，落在哪片星座？')}</div>
        <div class="q-desc">${t('选一片星座，我们便在那片天区里为你认领一颗真实恒星；也可交给宇宙决定。')}</div>
        <div class="zodiac-grid">${opts}</div></div>`;
    }
    if (i===2){
      const opts = ZODIAC.map(z=>`
        <div class="opt ${answers.zodiac===z.id?'sel':''}" data-z="${z.id}">
          <span class="ico">${z.ico}</span><span>${t(z.id)}</span></div>`).join('');
      return `<div class="q-card">
        <div class="q-title">${t('你属于哪片星象？')}</div>
        <div class="q-desc">${t('你的星座，将影响恒星的光谱与温度。')}</div>
        <div class="zodiac-grid">${opts}</div></div>`;
    }
    if (i===3){
      const rows = PERSONA.map(p=>{
        const v = answers.personality[p.key];
        return `<div class="q-options" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div class="opt ${v===false?'sel':''}" data-p="${p.key}" data-v="0">${t(p.a)}</div>
          <div class="opt ${v===true?'sel':''}" data-p="${p.key}" data-v="1">${t(p.b)}</div>
        </div>`;
      }).join('');
      return `<div class="q-card">
        <div class="q-title">${t('你怎样存在于世界？')}</div>
        <div class="q-desc">${t('每组选一个，它们决定恒星的体积、质量与自转。')}</div>${rows}</div>`;
    }
    const opts = BELIEFS.map(b=>`
      <div class="opt ${answers.beliefs===b.id?'sel':''}" data-b="${b.id}">
        <span class="ico">${b.ico}</span>
        <span>${t(b.name)}<span class="sub">${t(b.sub)}</span></span></div>`).join('');
    return `<div class="q-card">
      <div class="q-title">${t('你信奉什么？')}</div>
      <div class="q-desc">${t('人生信念，将指引你的星辰落入哪片星系。')}</div>
      <div class="q-options cols3">${opts}</div></div>`;
  }

  function bind(i){
    if (i===0){
      stage.querySelectorAll('[data-h]').forEach(el=>{
        el.onclick = ()=>{
          const id = el.dataset.h;
          const idx = answers.hobbies.indexOf(id);
          if (idx>=0) answers.hobbies.splice(idx,1);
          else { if (answers.hobbies.length>=3){ flash(el); return; } answers.hobbies.push(id); }
          el.classList.toggle('sel');
        };
      });
    } else if (i===1){
      stage.querySelectorAll('[data-c]').forEach(el=>{
        el.onclick = ()=>{ answers.constellation = el.dataset.c;
          stage.querySelectorAll('[data-c]').forEach(x=>x.classList.remove('sel'));
          el.classList.add('sel'); };
      });
    } else if (i===2){
      stage.querySelectorAll('[data-z]').forEach(el=>{
        el.onclick = ()=>{ answers.zodiac = el.dataset.z;
          stage.querySelectorAll('[data-z]').forEach(x=>x.classList.remove('sel'));
          el.classList.add('sel'); };
      });
    } else if (i===3){
      stage.querySelectorAll('[data-p]').forEach(el=>{
        el.onclick = ()=>{
          const k = el.dataset.p, v = el.dataset.v==='1';
          answers.personality[k] = v;
          const group = el.parentElement.querySelectorAll('[data-p]');
          group.forEach(x=>x.classList.remove('sel'));
          el.classList.add('sel');
        };
      });
    } else {
      stage.querySelectorAll('[data-b]').forEach(el=>{
        el.onclick = ()=>{ answers.beliefs = el.dataset.b;
          stage.querySelectorAll('[data-b]').forEach(x=>x.classList.remove('sel'));
          el.classList.add('sel'); };
      });
    }
  }

  function flash(el){ el.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:300}); }

  function valid(){
    if (step===0 && answers.hobbies.length===0) return t('请至少选择一项爱好');
    if (step===1 && !answers.constellation) return t('请选择一片星座，或交给宇宙决定');
    if (step===2 && !answers.zodiac) return t('请选择一个星座');
    if (step===4 && !answers.beliefs) return t('请选择一种人生信念');
    return null;
  }

  prevBtn.onclick = ()=>{ if (step>0){ step--; render(); } };
  nextBtn.onclick = ()=>{
    const err = valid();
    if (err){ toast(err); return; }
    if (step < TOTAL-1){ step++; render(); }
    else onDone(answers);
  };

  render();
  return { answers, redraw: render };
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 1800);
}
