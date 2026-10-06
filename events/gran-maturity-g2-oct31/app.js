/* ---------- datos del cartel ---------- */
// Cuadras tal como aparecen en el cartel. Las parejas son de DEMO (columna izquierda contra derecha) hasta que salga el programa.
const IZQ=[['LA VICTORIA','Veracruz'],['TRES COMPADRES','Querétaro'],['ANGELITO','Estado de México'],['H/M RACING','Puebla'],['LA NARANJA 1','Hidalgo'],['LA NARANJA 2','Hidalgo'],
 ['RJS','Estado de México','Toluca'],['HERNANDEZ','Estado de México','Toluca'],['ZAMBRANO','Estado de México'],['JFR RANCH','Estado de México','Toluca'],['CAZADORES','Hidalgo'],['ACOSTA RANCH','Hidalgo']];
const DER=[['JMGO','Estado de México','Toluca'],['SANTA ISABEL','Hidalgo','Tulancingo'],['4 AMIGOS 1','Tlaxcala'],['4 AMIGOS 2','Tlaxcala'],['4 AMIGOS 3','Tlaxcala'],['4 AMIGOS 4','Tlaxcala'],
 ['CIELITO','Hidalgo'],['DEL GORDO','Estado de México','Toluca'],['3 REYES','Estado de México'],['LA BENDICION','Puebla'],['PALOMAS GONZALEZ','Estado de México','Toluca']];
const ALL=[...IZQ,...DER];const NC=ALL.length;
const byState={};ALL.forEach(c=>byState[c[1]]=(byState[c[1]]||0)+1);
const fam=n=>{const m=n.match(/^(.*?)\s*\d+$/);return m?m[1]:null};const famN={};ALL.forEach(c=>{const f=fam(c[0]);if(f)famN[f]=(famN[f]||0)+1});
const RACES=IZQ.map((a,i)=>({n:i+1,a,b:DER[i]||null}));const NR=RACES.length;
const $=s=>document.querySelector(s);const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const IO=x=>{x=clamp(x);return x*x*(3-2*x)};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const d=Math.ceil((new Date(2026,9,31)-new Date())/864e5);
$('#days').textContent=d>1?`Faltan ${d} días`:d===1?'Es mañana':d===0?'Es hoy':'';
$('#tick').innerHTML=[...ALL,...ALL].map(c=>c[0]).join('<b>/</b>');

/* ---------- tarjetas de carrera ---------- */
const NIMG=22;const img=i=>`img/h${String((i-1)%NIMG+1).padStart(2,'0')}.jpg?v=5`;
const loc=c=>c[2]?`${c[2]}, ${c[1]}`:c[1];
function analysis(r){
  const A=r.a,B=r.b;if(!B)return `<h3>Análisis</h3><p class="sub">Rival por anunciar.</p><dl class="rows"><div><dt>Estado</dt><dd>${A[1]}</dd></div><div><dt>Historial</dt><dd class="tbc">sin datos todavía</dd></div></dl>`;
  const head=A[1]===B[1]?`Duelo entre dos cuadras de ${A[1]}.`:`${A[1]} contra ${B[1]}.`;
  const extra=[A,B].map(c=>{const f=fam(c[0]);return f&&famN[f]>1?`<div><dt>${f}</dt><dd>${famN[f]} caballos inscritos</dd></div>`:''}).join('');
  return `<p class="lbl" style="margin-bottom:6px">Primera vez que se ven</p><h3>${head}</h3>
  <dl class="rows"><div><dt>${A[0]}</dt><dd>${loc(A)}</dd></div><div><dt>${B[0]}</dt><dd>${loc(B)}</dd></div>
  <div><dt>Cuadras de ${A[1]}</dt><dd>${byState[A[1]]} de ${NC}</dd></div>${A[1]!==B[1]?`<div><dt>Cuadras de ${B[1]}</dt><dd>${byState[B[1]]} de ${NC}</dd></div>`:''}${extra}
  <div><dt>Historial entre ellos</dt><dd class="tbc">sin datos todavía</dd></div></dl>
  <p class="lec">Sin carreras registradas entre estas cuadras. Cuando se capturen resultados, aquí sale quién sube, quién llega mejor o si van parejos.</p>
  <p class="note">Cláusula: cuadras G2, sin carreras ganadas en Calpulalpan.</p>`}
function team(c,side){if(!c)return '';const msg=encodeURIComponent(`Datos de ${c[0]} para el Gran Maturity G2:\nCaballo: \nDueño: \nEntrenador: \nJinete: `);
  return `<p class="side ${side}">${c[0]}</p><dl class="rows"><div><dt>Cuadra</dt><dd>${c[0]}</dd></div><div><dt>Caballo</dt><dd class="tbc">por confirmar</dd></div><div><dt>Dueño</dt><dd class="tbc">por confirmar</dd></div><div><dt>Entrenador</dt><dd class="tbc">por confirmar</dd></div><div><dt>Jinete</dt><dd class="tbc">por confirmar</dd></div></dl>`}
let ph=0;
$('#races').innerHTML=RACES.map(r=>{const ia=++ph,ib=r.b?++ph:0;const B=r.b||['Por anunciar','Rival por confirmar'];
 return `<section class="card race" data-n="${r.n}">
  <div class="meta"><span>Eliminatoria · Carrera ${r.n} de ${NR}</span><span>200 varas</span></div>
  <div class="tabs"><button class="on">Carrera</button><button>Equipo</button><button>Análisis</button></div>
  <div class="strip">
   <div class="panel">
    <div class="half ha"><button class="ph" type="button" aria-label="Ver foto de ${r.a[0]}"><img src="${img(ia)}" alt="" decoding="async"></button><div class="who"><small>${loc(r.a)}</small><b>${r.a[0]}</b></div><span class="ph-note">Foto de ejemplo · toca para ver</span></div>
    <div class="half hb">${ib?`<button class="ph" type="button" aria-label="Ver foto de ${B[0]}"><img src="${img(ib)}" alt="" decoding="async"></button>`:'<div style="width:100%;height:100%;background:#151821"></div>'}<div class="who"><small>${r.b?loc(B):'Por confirmar'}</small><b>${B[0]}</b></div>${ib?'<span class="ph-note">Foto de ejemplo · toca para ver</span>':''}</div>
    <div class="vs">VS</div>
    <div class="picks"><div class="q">¿Quién gana?<span>cambia tu pick antes de la carrera</span></div>
     <div class="bt"><button class="pa" data-p="a">${r.a[0]}</button>${r.b?`<button class="pb" data-p="b">${B[0]}</button>`:''}</div></div>
   </div>
   <div class="panel"><div class="pad"><h3>Equipo</h3><p class="sub">La cuadra y el dueño no siempre son los mismos. Cada caballo tiene su propio equipo.</p>${team(r.a,'a')}${team(r.b,'b')}
    <a class="btn" href="https://wa.me/?text=${encodeURIComponent('Datos para la carrera '+r.n+' del Gran Maturity G2 en Calpulalpan:')}">Mandar datos del equipo por WhatsApp</a></div></div>
   <div class="panel"><div class="pad">${analysis(r)}</div></div>
  </div></section>`}).join('');

/* anuncios entre carreras: tocar voltea la tarjeta y revela el especial */
const wa=t=>'https://wa.me/?text='+encodeURIComponent(t);
const shoe=`<svg class="shoe" viewBox="0 0 120 120" aria-hidden="true"><path class="u" d="M30 18v42a30 30 0 0 0 60 0V18"/><g class="holes"><circle cx="30" cy="34" r="3"/><circle cx="30" cy="50" r="3"/><circle cx="90" cy="34" r="3"/><circle cx="90" cy="50" r="3"/></g><path class="bolt" d="M66 22 44 64h16l-8 36 26-46H62z"/></svg>`;
const AD=[
 {after:4,cls:'ad-caos',front:`<p class="adl">Anuncio</p>${shoe}<h2 class="adt">CAOS</h2><p class="ads">Built different · Run different</p><p class="adtap">Toca para ver el especial ↻</p>`,
  back:`<p class="adl">Especial Gran Maturity</p><h2 class="adt">Gorras CAOS</h2><p class="adx">Precio y promo por confirmar</p><p class="adn">Ejemplo de especial: 2x1 el día de la carrera</p><a class="adb" href="${wa('Quiero una gorra CAOS (Gran Maturity G2)')}" target="_blank" rel="noopener">Pedir por WhatsApp</a><p class="adtap">Toca para regresar</p>`},
 {after:8,cls:'ad-slot',front:`<p class="adl">Anuncio</p><div class="lanes" aria-hidden="true"><i></i><i></i><i></i><i></i></div><h2 class="adt"><span>Tu marca</span><span>aquí</span></h2><p class="ads">Entre carrera y carrera, frente a cada persona que hace sus picks.</p><p class="adtap">Toca para ver el especial ↻</p>`,
  back:`<p class="adl">Especial para patrocinadores</p><h2 class="adt">Tu promo sale aquí</h2><p class="adx">Cuando la gente voltea la tarjeta, ve tu especial.</p><p class="adn">2 espacios en este evento · precio por confirmar</p><a class="adb" href="${wa('Quiero anunciarme en el Gran Maturity G2')}" target="_blank" rel="noopener">Quiero anunciarme</a><p class="adtap">Toca para regresar</p>`},
];
AD.forEach(a=>document.querySelector(`.race[data-n="${a.after}"]`).insertAdjacentHTML('afterend',
 `<section class="card ad ${a.cls}"><div class="flip"><div class="face front">${a.front}</div><div class="face back">${a.back}</div></div></section>`));
document.querySelectorAll('.ad .flip').forEach(f=>f.addEventListener('click',e=>{if(e.target.closest('a'))return;f.classList.toggle('on')}));
const adIO=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('in',e.isIntersecting)),{threshold:.6});
document.querySelectorAll('.ad').forEach(c=>adIO.observe(c));

/* picks: se guardan en este teléfono */
const KEY='gm-g2-picks';let picks={};try{picks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const savePicks=()=>{try{localStorage.setItem(KEY,JSON.stringify(picks))}catch(e){}};
function paint(){document.querySelectorAll('.race').forEach(c=>{const v=picks[c.dataset.n];const bt=c.querySelector('.bt');bt.classList.toggle('picked',!!v);bt.querySelectorAll('button').forEach(b=>b.classList.toggle('me',b.dataset.p===v))});
  const np=Object.keys(picks).length;$('#pk').textContent=`PICKS ${np}/${NR}`;
  const nm=(r,p)=>p==='a'?r.a[0]:(r.b||['Por anunciar'])[0];
  $('#ml').innerHTML=RACES.map(r=>{const v=picks[r.n];return `<button data-go="${r.n}"><i>C${r.n}</i><span>${r.a[0]} vs ${r.b?r.b[0]:'Por anunciar'}</span><b class="${v||''}">${v?'✓ '+nm(r,v):'Elegir'}</b></button>`}).join('');
  $('#mineSub').textContent=np===NR?'Tienes las '+NR+' carreras.':`Llevas ${np} de ${NR}. Toca una carrera para elegir.`;
  const txt='Mis picks para el Gran Maturity G2 (Calpulalpan, 31 oct):\n'+RACES.filter(r=>picks[r.n]).map(r=>`C${r.n}: ${nm(r,picks[r.n])}`).join('\n');
  const sh=$('#share');sh.href='https://wa.me/?text='+encodeURIComponent(txt);sh.classList.toggle('off',!np);rail()}
document.querySelectorAll('.race').forEach(c=>{
  c.querySelectorAll('.bt button').forEach(b=>b.addEventListener('click',()=>{const n=c.dataset.n;picks[n]=picks[n]===b.dataset.p?undefined:b.dataset.p;if(!picks[n])delete picks[n];savePicks();paint()}));
  const strip=c.querySelector('.strip'),tabs=[...c.querySelectorAll('.tabs button')];
  tabs.forEach((t,i)=>t.addEventListener('click',()=>strip.scrollTo({left:i*strip.clientWidth,behavior:'smooth'})));
  let raf;strip.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const i=Math.round(strip.scrollLeft/strip.clientWidth);tabs.forEach((t,j)=>t.classList.toggle('on',i===j))})},{passive:true});
});

/* ir a una carrera desde Mis picks / ir a Mis picks desde el contador */
const goCard=el=>$('#feed').scrollTo({top:el.offsetTop,behavior:'smooth'});
$('#ml').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)goCard(document.querySelector(`.race[data-n="${b.dataset.go}"]`))});
$('#pk').addEventListener('click',()=>goCard($('#mine')));
/* foto completa al tocar el caballo */
const lb=$('#lb');
document.querySelectorAll('.half .ph').forEach(btn=>{const h=btn.closest('.half'),im=btn.querySelector('img');btn.addEventListener('click',()=>{lb.querySelector('img').src=im.src;lb.querySelector('b').textContent=h.querySelector('.who b').textContent;lb.querySelector('small').textContent=h.querySelector('.who small').textContent+' · foto de ejemplo';lb.classList.add('open')})});
lb.addEventListener('click',()=>lb.classList.remove('open'));
addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('open')});

/* riel de progreso: una marca por tarjeta */
const feed=$('#feed');const cards=[...feed.querySelectorAll('.card')];const railEl=$('#rail');
railEl.innerHTML=cards.map(()=>'<i></i>').join('');
function rail(){const i=Math.round(feed.scrollTop/innerHeight);[...railEl.children].forEach((m,j)=>{m.classList.toggle('on',i===j);const c=cards[j];m.classList.toggle('done',c.classList.contains('race')&&!!picks[c.dataset.n]&&i!==j)})}
feed.addEventListener('scroll',rail,{passive:true});paint();

$('#go').addEventListener('click',()=>goCard(document.querySelector('.race')));
