/* ---------- programa (tal como viene en el cartel del 11 de octubre) ---------- */
// [caballo, cuadra, foto]. Fotos = imágenes del cartel hasta tener fotos reales.
const RACES=[
 {time:'10:40',dist:'350 yds',h:[['EL JOCKER','C. FE','h01'],['EL CAÑERO','C. Cañeros','h02']]},
 {time:'11:20',dist:'250 yds',h:[['EL MACHETE','C. Don Chuy','h03'],['EL HUEVOS DE ORO','C. FE','h04']]},
 {time:'12:00',dist:'200 yds',h:[['EL MAL EJEMPLO','C. Tilichas','h05'],['EL ROJO','C. Cañeros','h06']]},
 {time:'12:40',dist:'400 yds',h:[['LA KORITA','C. Tilichas','h07'],['EL ALQAEDA','C. Ramírez','h08']]},
 {time:'1:20',dist:'200 yds',c:['#d62718','#e8710c','#7b3fc4','#1f5fd6'],h:[['EL VOLCÁN','C. Rancho Viejo','h09'],['EL INVASOR','C. Jerusalem','h10'],['EL PATAS BLANCAS','C. Hernández','h11'],['LA EMMA','C. Venzor','h12']]},
 {time:'2:00',dist:'350 yds',h:[['LA DRAMÁTICA','C. Tilichas','h13',' (blanco)'],['EL VIEJITO','C. Ramírez','h14']]},
 {time:'2:40',dist:'225 o 250 yds',h:[['LA MEDIA NOCHE','C. RO','h15'],['LA TORMENTA','C. Jerusalem','h16']]},
].map((r,i)=>({...r,n:i+1}));
const NR=RACES.length;
// del cartel del 9 de agosto (mismo carril): quién ya corrió aquí
const AGO9={'LA DRAMÁTICA':'contra El Comandante (C. Venzor), 300 yds','EL ALQAEDA':'contra El Gorrión (C. Tilichas), 300 yds'};
const ALL=RACES.flatMap(r=>r.h);const byCuadra={};ALL.forEach(h=>(byCuadra[h[1]]=byCuadra[h[1]]||[]).push(h[0]));
const COL0=['#d62718','#1f5fd6'];const COL=r=>r.c||COL0;
const $=s=>document.querySelector(s);
const tc=s=>s.toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase());
const d=Math.ceil((new Date(2026,9,11)-new Date(new Date().toDateString()))/864e5);
$('#days').textContent=d>1?`Faltan ${d} días`:d===1?'Es mañana':d===0?'Es hoy':'';
$('#tick').innerHTML=[...ALL,...ALL].map(h=>h[0]).join('<b>/</b>');

/* programa */
$('#pl').innerHTML=RACES.map(r=>`<button data-go="${r.n}"><i>${r.time}</i><span>${r.h.map(h=>`<b>${tc(h[0])}</b>`).join('<em>vs</em>')}</span><small>${r.dist}</small></button>`).join('');

/* ---------- tarjetas de carrera ---------- */
const img=k=>`../gran-maturity-g2-oct31/img/${k}.jpg?v=5`;
function datos(r){
  const rows=r.h.map(h=>{const otros=byCuadra[h[1]].filter(x=>x!==h[0]);return `<div><dt>${tc(h[0])}</dt><dd>${h[1]}${otros.length?`<small>también corre ${otros.map(tc).join(' y ')}</small>`:''}</dd></div>`}).join('');
  const ya=r.h.filter(h=>AGO9[h[0]]).map(h=>`<div><dt>${tc(h[0])}</dt><dd>${AGO9[h[0]]}<small>resultado sin capturar</small></dd></div>`).join('');
  return `<h3>Datos</h3><p class="sub">${r.h.length===2?'Mano a mano':'Carrera de '+r.h.length}, ${r.dist}, ${r.time}.</p>
  <dl class="rows">${rows}</dl>
  ${ya?`<p class="lbl" style="margin:20px 0 4px">Ya corrieron en el Potosino (9 de agosto)</p><dl class="rows">${ya}</dl>`:''}
  <p class="lec">${r.h.length===2?'Sin carreras registradas entre estos dos.':'Cuatro cuadras distintas, una sola carrera.'} Cuando se capturen resultados, aquí sale quién llega mejor.</p>`}
function team(r){return r.h.map((h,i)=>`<p class="side" style="color:${COL(r)[i]}">${tc(h[0])}</p><dl class="rows"><div><dt>Cuadra</dt><dd>${h[1]}</dd></div><div><dt>Dueño</dt><dd class="tbc">por confirmar</dd></div><div><dt>Entrenador</dt><dd class="tbc">por confirmar</dd></div><div><dt>Jinete</dt><dd class="tbc">por confirmar</dd></div></dl>`).join('')}
function face(r,i,cls){const h=r.h[i];return `<div class="half ${cls}" style="--c:${COL(r)[i]}"><button class="ph" type="button" aria-label="Ver foto de ${h[0]}"><img src="${img(h[2])}" alt="" decoding="async"></button><div class="who"><small>${h[1]}</small><b>${h[0]}</b>${h[3]?`<em>${h[3].trim()}</em>`:''}</div></div>`}
$('#races').innerHTML=RACES.map(r=>{const four=r.h.length>2;
 return `<section class="card race${four?' four':''}" data-n="${r.n}">
  <div class="meta"><span>${r.time} · Carrera ${r.n} de ${NR}</span><span>${r.dist}</span></div>
  <div class="tabs"><button class="on">Carrera</button><button>Equipo</button><button>Datos</button></div>
  <div class="strip">
   <div class="panel">
    ${four?`<div class="quad">${r.h.map((h,i)=>face(r,i,'q q'+i)).join('')}</div><div class="vs vs4">VS</div>`
          :`${face(r,0,'ha')}${face(r,1,'hb')}<div class="vs">VS</div>`}
    <span class="ph-note">Foto de ejemplo · toca para ver</span>
    <div class="picks"><div class="q">¿Quién gana?<span>cambia tu pick antes de la carrera</span></div>
     <div class="bt">${r.h.map((h,i)=>`<button data-p="${i}" style="--c:${COL(r)[i]}">${tc(h[0])}</button>`).join('')}</div></div>
   </div>
   <div class="panel"><div class="pad"><h3>Equipo</h3><p class="sub">La cuadra y el dueño no siempre son los mismos.</p>${team(r)}
    <a class="btn" href="https://wa.me/?text=${encodeURIComponent('Datos para la carrera '+r.n+' del Carril Potosino (11 de octubre):\nCaballo: \nDueño: \nEntrenador: \nJinete: ')}">Mandar datos del equipo por WhatsApp</a></div></div>
   <div class="panel"><div class="pad">${datos(r)}</div></div>
  </div></section>`}).join('');

/* anuncios entre carreras */
const AD=[
 {after:2,cls:'ad-caos',name:'CAOS',sub:'Built different · Run different',loop:'../gran-maturity-g2-oct31/caos.mp4?v=1',poster:'../gran-maturity-g2-oct31/caos.jpg',
  full:`<video src="../gran-maturity-g2-oct31/caos-full.mp4?v=1" poster="../gran-maturity-g2-oct31/caos.jpg" controls playsinline autoplay></video>`,
  info:'<small>Anuncio</small><b>CAOS</b><span>Built different · Run different</span>'},
 {after:5,cls:'ad-vm',name:'Valley Meats',sub:'Ordena de tu cell · Carbondale, CO',loop:'../gran-maturity-g2-oct31/valley.mp4?v=1',poster:'../gran-maturity-g2-oct31/valley.jpg',
  full:`<img src="../gran-maturity-g2-oct31/valley-poster.jpg?v=1" alt="Valley Meats La Carnicería: ordena de tu cell con nuestra nueva página">`,
  info:'<small>Anuncio · Carbondale, CO</small><b>Valley Meats</b><span class="vwb"><a href="tel:+19707049614">Llamar 970-704-9614</a><a href="https://www.google.com/maps/search/?api=1&amp;query=Valley%20Meats%20774%20State%20Route%20133%20Carbondale%20CO" target="_blank" rel="noopener">Cómo llegar</a></span>'},
];
AD.forEach(a=>document.querySelector(`.race[data-n="${a.after}"]`).insertAdjacentHTML('afterend',
 `<section class="card ad ${a.cls}"><button class="adbox" type="button" aria-label="Ver anuncio de ${a.name}"><video class="adv" src="${a.loop}" poster="${a.poster}" muted loop playsinline preload="metadata"></video><span class="advx"><span class="adl">Anuncio</span><span class="advt"><b>${a.name}</b><span>${a.sub}</span></span><span class="adtap">▶ Toca para ver</span></span></button></section>`));
document.body.insertAdjacentHTML('beforeend','<div class="lb vw" id="vw" role="dialog" aria-label="Anuncio"><div class="vwm"></div><p><span class="vwi"></span><button type="button" class="vwx">Cerrar</button></p></div>');
const vw=$('#vw');
document.querySelectorAll('.ad .adbox').forEach((btn,i)=>btn.addEventListener('click',()=>{const a=AD[i];btn.querySelector('video').pause();
 vw.querySelector('.vwm').innerHTML=a.full;vw.querySelector('.vwi').innerHTML=a.info;vw.classList.add('open')}));
vw.querySelector('.vwx').addEventListener('click',()=>{vw.classList.remove('open');vw.querySelector('.vwm').innerHTML=''});
const adIO=new IntersectionObserver(es=>es.forEach(e=>{e.target.classList.toggle('in',e.isIntersecting);const v=e.target.querySelector('video');if(v){if(e.isIntersecting)v.play().catch(()=>{});else v.pause()}}),{threshold:.6});
document.querySelectorAll('.ad,.intro').forEach(c=>adIO.observe(c));
/* la tarjeta que está en pantalla se anima al entrar */
const cardIO=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('live',e.isIntersecting)),{threshold:.55});
document.querySelectorAll('.race,.aviso,.prog').forEach(c=>cardIO.observe(c));

/* picks: se guardan en este teléfono */
const KEY='potosino-oct11-picks';let picks={};try{picks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const savePicks=()=>{try{localStorage.setItem(KEY,JSON.stringify(picks))}catch(e){}};
function paint(){document.querySelectorAll('.race').forEach(c=>{const v=picks[c.dataset.n];const bt=c.querySelector('.bt');bt.classList.toggle('picked',v!=null);bt.querySelectorAll('button').forEach(b=>b.classList.toggle('me',b.dataset.p===v))});
  const np=Object.keys(picks).length;$('#pk').textContent=`PICKS ${np}/${NR}`;
  const nm=(r,p)=>tc(r.h[+p][0]);
  $('#ml').innerHTML=RACES.map(r=>{const v=picks[r.n];return `<button data-go="${r.n}"><i>${r.time}</i><span>${r.h.map(h=>tc(h[0])).join(' vs ')}</span><b ${v!=null?`class="on" style="background:${COL(r)[+v]}"`:''}>${v!=null?'✓ '+nm(r,v):'Elegir'}</b></button>`}).join('');
  $('#mineSub').textContent=np===NR?'Tienes las '+NR+' carreras.':`Llevas ${np} de ${NR}. Toca una carrera para elegir.`;
  const txt='Mis picks para el Carril Potosino (domingo 11 de octubre):\n'+RACES.filter(r=>picks[r.n]!=null).map(r=>`${r.time} C${r.n}: ${nm(r,picks[r.n])}`).join('\n');
  const sh=$('#share');sh.href='https://wa.me/?text='+encodeURIComponent(txt);sh.classList.toggle('off',!np);
  document.querySelectorAll('#pl button').forEach(b=>b.classList.toggle('done',picks[b.dataset.go]!=null));rail()}
document.querySelectorAll('.race').forEach(c=>{
  c.querySelectorAll('.bt button').forEach(b=>b.addEventListener('click',()=>{const n=c.dataset.n;if(picks[n]===b.dataset.p)delete picks[n];else picks[n]=b.dataset.p;savePicks();paint();
    if(navigator.vibrate)navigator.vibrate(12)}));
  const strip=c.querySelector('.strip'),tabs=[...c.querySelectorAll('.tabs button')];
  tabs.forEach((t,i)=>t.addEventListener('click',()=>strip.scrollTo({left:i*strip.clientWidth,behavior:'smooth'})));
  let raf;strip.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const i=Math.round(strip.scrollLeft/strip.clientWidth);tabs.forEach((t,j)=>t.classList.toggle('on',i===j))})},{passive:true});
});

const goCard=el=>$('#feed').scrollTo({top:el.offsetTop,behavior:'smooth'});
const goRace=e=>{const b=e.target.closest('[data-go]');if(b)goCard(document.querySelector(`.race[data-n="${b.dataset.go}"]`))};
$('#ml').addEventListener('click',goRace);$('#pl').addEventListener('click',goRace);
$('#pk').addEventListener('click',()=>goCard($('#mine')));
const lb=$('#lb');
document.querySelectorAll('.half .ph').forEach(btn=>{const h=btn.closest('.half'),im=btn.querySelector('img');btn.addEventListener('click',()=>{lb.querySelector('img').src=im.src;lb.querySelector('b').textContent=h.querySelector('.who b').textContent;lb.querySelector('small').textContent=h.querySelector('.who small').textContent+' · foto de ejemplo';lb.classList.add('open')})});
lb.addEventListener('click',()=>lb.classList.remove('open'));
addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('open')});

const feed=$('#feed');const cards=[...feed.querySelectorAll('.card')];const railEl=$('#rail');
railEl.innerHTML=cards.map(()=>'<i></i>').join('');
function rail(){const y=feed.scrollTop+innerHeight*.3;let i=0;cards.forEach((c,j)=>{if(c.offsetTop<=y)i=j});[...railEl.children].forEach((m,j)=>{m.classList.toggle('on',i===j);const c=cards[j];m.classList.toggle('done',c.classList.contains('race')&&picks[c.dataset.n]!=null&&i!==j)})}
feed.addEventListener('scroll',rail,{passive:true});paint();
$('#go').addEventListener('click',()=>goCard($('#prog')));
