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
const AD=[
 {after:4,cls:'ad-caos',name:'CAOS',sub:'Built different · Run different',loop:'caos.mp4?v=1',poster:'caos.jpg',
  full:`<video src="caos-full.mp4?v=1" poster="caos.jpg" controls playsinline autoplay></video>`,
  info:'<small>Anuncio</small><b>CAOS</b><span>Built different · Run different</span>'},
 {after:8,cls:'ad-vm',name:'Valley Meats',sub:'Ordena de tu cell · Carbondale, CO',loop:'valley.mp4?v=1',poster:'valley.jpg',
  full:`<img src="valley-poster.jpg?v=1" alt="Valley Meats La Carnicería: ordena de tu cell con nuestra nueva página">`,
  info:'<small>Anuncio · Carbondale, CO</small><b>Valley Meats</b><span class="vwb"><a href="tel:+19707049614">Llamar 970-704-9614</a><a href="https://www.google.com/maps/search/?api=1&amp;query=Valley%20Meats%20774%20State%20Route%20133%20Carbondale%20CO" target="_blank" rel="noopener">Cómo llegar</a></span>'},
];
AD.forEach(a=>document.querySelector(`.race[data-n="${a.after}"]`).insertAdjacentHTML('afterend',
 `<section class="card ad ${a.cls}"><button class="adbox" type="button" aria-label="Ver anuncio de ${a.name}"><video class="adv" src="${a.loop}" poster="${a.poster}" muted loop playsinline preload="metadata"></video><span class="advx"><span class="adl">Anuncio</span><span class="advt"><b>${a.name}</b><span>${a.sub}</span></span><span class="adtap">▶ Toca para ver</span></span></button></section>`));
/* visor del anuncio: video completo con sonido o el póster completo */
document.body.insertAdjacentHTML('beforeend','<div class="lb vw" id="vw" role="dialog" aria-label="Anuncio"><div class="vwm"></div><p><span class="vwi"></span><button type="button" class="vwx">Cerrar</button></p></div>');
const vw=$('#vw');
const closeVw=()=>{vw.classList.remove('open');vw.querySelector('.vwm').innerHTML=''};
document.querySelectorAll('.ad .adbox').forEach((btn,i)=>btn.addEventListener('click',()=>{const a=AD[i];btn.querySelector('video').pause();
 vw.querySelector('.vwm').innerHTML=a.full;vw.querySelector('.vwi').innerHTML=a.info;vw.classList.add('open')}));
vw.querySelector('.vwx').addEventListener('click',closeVw);
const adIO=new IntersectionObserver(es=>es.forEach(e=>{e.target.classList.toggle('in',e.isIntersecting);const v=e.target.querySelector('video');if(v){if(e.isIntersecting)v.play().catch(()=>{});else v.pause()}}),{threshold:.6});
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
function rail(){const y=feed.scrollTop+innerHeight*.3;let i=0;cards.forEach((c,j)=>{if(c.offsetTop<=y)i=j});[...railEl.children].forEach((m,j)=>{m.classList.toggle('on',i===j);const c=cards[j];m.classList.toggle('done',c.classList.contains('race')&&!!picks[c.dataset.n]&&i!==j)})}
feed.addEventListener('scroll',rail,{passive:true});paint();

$('#go').addEventListener('click',()=>goCard(document.querySelector('.race')));
