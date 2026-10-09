/* ---------- programa del cartel (domingo 11 de octubre, Mack CO) ---------- */
// [caballo, cuadra, foto de ejemplo, nota]
const RACES=[
 {time:'10:40',h24:'10:40',dist:'350 yds',y:350,h:[['EL JOCKER','C. FE','h01'],['EL CAÑERO','C. Cañeros','h02']]},
 {time:'11:20',h24:'11:20',dist:'250 yds',y:250,h:[['EL MACHETE','C. Don Chuy','h09'],['EL HUEVOS DE ORO','C. FE','h04']]},
 {time:'12:00',h24:'12:00',dist:'200 yds',y:200,h:[['EL MAL EJEMPLO','C. Tilichas','h05'],['EL ROJO','C. Cañeros','h06']]},
 {time:'12:40',h24:'12:40',dist:'400 yds',y:400,h:[['LA KORITA','C. Tilichas','h07'],['EL ALQAEDA','C. Ramírez','h08']]},
 {time:'1:20',h24:'13:20',dist:'200 yds',y:200,c:['#d62718','#e8710c','#7b3fc4','#1f5fd6'],h:[['EL VOLCÁN','C. Rancho Viejo','h10'],['EL INVASOR','C. Jerusalem','h14'],['EL PATAS BLANCAS','C. Hernández','h03'],['LA EMMA','C. Venzor','h12']]},
 {time:'2:00',h24:'14:00',dist:'350 yds',y:350,h:[['LA DRAMÁTICA','C. Tilichas','h13','caballo blanco'],['EL VIEJITO','C. Ramírez','h21']]},
 {time:'2:40',h24:'14:40',dist:'225 o 250 yds',y:250,h:[['LA MEDIA NOCHE','C. RO','h15'],['LA TORMENTA','C. Jerusalem','h16']]},
].map((r,i)=>({...r,n:i+1,at:new Date(`2026-10-11T${r.h24}:00-06:00`)}));
const NR=RACES.length;
const AGO9={'LA DRAMÁTICA':'contra El Comandante (C. Venzor), 300 yds','EL ALQAEDA':'contra El Gorrión (C. Tilichas), 300 yds'};
const ALL=RACES.flatMap(r=>r.h);const byCuadra={};ALL.forEach(h=>(byCuadra[h[1]]=byCuadra[h[1]]||[]).push(h[0]));
const COL=r=>r.c||['#d62718','#1f5fd6'];
const $=s=>document.querySelector(s);
const tc=s=>s.toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase());
const img=k=>`../gran-maturity-g2-oct31/img/${k}.jpg?v=5`;
const buzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};

/* ---------- cuenta regresiva ---------- */
const FIRST=RACES[0].at;
function left(t){const s=Math.floor((t-Date.now())/1000);if(s<=0)return null;return {d:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60}}
function sale(r){const l=left(r.at);if(!l)return 'Ya salió';if(l.d)return `Sale en ${l.d}d ${l.h}h`;if(l.h)return `Sale en ${l.h}h ${l.m}m`;return `Sale en ${l.m} min`}
function tickClock(){const l=left(FIRST);const b=$('#clock').querySelectorAll('b');
  if(!l){$('#clock').innerHTML='<p class="now">¡Hoy se corre!</p>'}
  else [l.d,l.h,l.m,l.s].forEach((v,i)=>{const t=i?String(v).padStart(2,'0'):String(v);if(b[i]&&b[i].textContent!==t){b[i].textContent=t;b[i].classList.remove('flip');void b[i].offsetWidth;b[i].classList.add('flip')}});
  document.querySelectorAll('.race .cd').forEach(e=>e.textContent=sale(RACES[e.dataset.n-1]))}

/* ---------- programa: línea de tiempo ---------- */
$('#tl').innerHTML=RACES.map(r=>`<li style="--d:${r.n*.07}s"><button data-go="${r.n}"><time>${r.time}</time><span>${r.h.map(h=>`<b>${tc(h[0])}</b>`).join('<em>vs</em>')}</span><small>${r.dist}</small></button></li>`).join('');

/* ---------- tarjetas de carrera ---------- */
function side(r,i,cls){const h=r.h[i];return `<button class="side ${cls}" data-p="${i}" style="--c:${COL(r)[i]}" aria-label="Elegir a ${h[0]}">
  <img src="${img(h[2])}" alt="" decoding="async"><span class="nm"><small>${h[1]}${h[3]?' · '+h[3]:''}</small><b>${h[0]}</b></span><span class="stamp">Mi pick</span></button>`}
$('#races').innerHTML=RACES.map(r=>{const four=r.h.length>2;
 return `<section class="card race${four?' four':''}" data-n="${r.n}">
  <div class="arena">${four?r.h.map((h,i)=>side(r,i,'q q'+i)).join(''):side(r,0,'sa')+side(r,1,'sb')}
   ${four?'':'<svg class="cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="58" x2="100" y2="42" vector-effect="non-scaling-stroke"/></svg>'}<b class="vs">VS</b></div>
  <div class="hud"><div class="hl"><span class="rn">Carrera ${r.n}<i>/${NR}</i></span><span class="tm">${r.time}</span></div>
   <div class="dist"><span>${r.dist}</span><i><u style="width:${r.y/400*100}%"></u></i><span class="cd" data-n="${r.n}"></span></div></div>
  <div class="foot"><span class="hint">Toca tu caballo</span><button class="more" type="button">Equipo y datos ↑</button></div>
 </section>`}).join('');

/* anuncios entre carreras (los mismos del Gran Maturity) */
const G='../gran-maturity-g2-oct31/';
const AD=[
 {after:2,name:'CAOS',sub:'Built different · Run different',loop:G+'caos.mp4?v=1',poster:G+'caos.jpg',
  full:`<video src="${G}caos-full.mp4?v=1" poster="${G}caos.jpg" controls playsinline autoplay></video>`,info:'<small>Anuncio</small><b>CAOS</b>'},
 {after:5,name:'Valley Meats',sub:'Ordena de tu cell · Carbondale, CO',loop:G+'valley.mp4?v=1',poster:G+'valley.jpg',
  full:`<img src="${G}valley-poster.jpg?v=1" alt="Valley Meats">`,info:'<small>Anuncio · Carbondale, CO</small><b>Valley Meats</b><span class="vwb"><a href="tel:+19707049614">Llamar 970-704-9614</a></span>'},
];
AD.forEach((a,i)=>document.querySelector(`.race[data-n="${a.after}"]`).insertAdjacentHTML('afterend',
 `<section class="card ad"><button class="adbox" type="button" data-ad="${i}"><video src="${a.loop}" poster="${a.poster}" muted loop playsinline preload="metadata"></video><span class="adl">Anuncio</span><span class="advt"><b>${a.name}</b><span>${a.sub}</span></span><span class="adtap">▶ Toca para ver</span></button></section>`));
const lb=$('#lb');
const closeLb=()=>{lb.classList.remove('open','vw');lb.querySelector('img').style.display='';const v=lb.querySelector('.vwm');if(v)v.remove()};
document.querySelectorAll('.adbox').forEach(b=>b.addEventListener('click',()=>{const a=AD[b.dataset.ad];b.querySelector('video').pause();closeLb();
  lb.classList.add('open','vw');lb.querySelector('img').style.display='none';lb.insertAdjacentHTML('afterbegin',`<div class="vwm">${a.full}</div>`);lb.querySelector('p span').innerHTML=a.info}));

/* ---------- picks ---------- */
const KEY='potosino-oct11-picks';let picks={};try{picks=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(picks))}catch(e){}};
const nm=(r,p)=>tc(r.h[+p][0]);
let cur=0;
document.querySelectorAll('.race').forEach(c=>{const r=RACES[c.dataset.n-1];
  c.querySelectorAll('.side').forEach(b=>b.addEventListener('click',()=>{const n=r.n;
    if(picks[n]===b.dataset.p)delete picks[n];else{picks[n]=b.dataset.p;buzz([14,40,22])}save();paint()}));
  c.querySelector('.more').addEventListener('click',()=>openSheet(r))});
function segs(){$('#segs').innerHTML=RACES.map(r=>`<button data-go="${r.n}" class="${picks[r.n]!=null?'done':''}${cur===r.n?' cur':''}" aria-label="Carrera ${r.n}"></button>`).join('')}
function paint(){
  document.querySelectorAll('.race').forEach(c=>{const v=picks[c.dataset.n];if(v!=null)c.dataset.pick=v;else delete c.dataset.pick;
    c.querySelector('.hint').textContent=v!=null?'✓ '+nm(RACES[c.dataset.n-1],v):'Toca tu caballo'});
  const np=Object.keys(picks).length;$('#pk').textContent=`BOLETO ${np}/${NR}`;$('#pk').classList.toggle('full',np===NR);
  document.querySelectorAll('#tl button').forEach(b=>b.classList.toggle('done',picks[b.dataset.go]!=null));
  $('#tk').innerHTML=`<div class="th"><img src="img/logo.jpg" alt=""><div><b>Boleto</b><span>Carril Potosino · Dom 11 oct · Mack, CO</span></div></div>
   <ol>${RACES.map(r=>{const v=picks[r.n];return `<li><button data-go="${r.n}"><time>${r.time}</time><span>${r.h.map(h=>tc(h[0])).join(' / ')}</span><b class="${v!=null?'on':''}" ${v!=null?`style="--c:${COL(r)[+v]}"`:''}>${v!=null?nm(r,v):'Elegir'}</b></button></li>`}).join('')}</ol>
   <p class="tf"><span>${np} de ${NR} carreras</span><span>${np===NR?'Boleto completo':'Faltan '+(NR-np)}</span></p>`;
  const txt='Mi boleto del Carril Potosino (domingo 11 de octubre):\n'+RACES.filter(r=>picks[r.n]!=null).map(r=>`${r.time} · ${nm(r,picks[r.n])}`).join('\n')+'\n'+location.href.split(/[?#]/)[0];
  const sh=$('#share');sh.href='https://wa.me/?text='+encodeURIComponent(txt);sh.classList.toggle('off',!np);$('#shareImg').classList.toggle('off',!np);segs()}

/* entrar en pantalla: anima la tarjeta, prende y apaga videos */
const io=new IntersectionObserver(es=>es.forEach(e=>{const t=e.target;t.classList.toggle('live',e.isIntersecting);const v=t.querySelector('video');if(v){if(e.isIntersecting)v.play().catch(()=>{});else v.pause()}
  if(e.isIntersecting){cur=t.classList.contains('race')?+t.dataset.n:0;document.body.classList.toggle('onrace',!!cur);segs()}}),{threshold:.55});

/* ---------- hoja de detalles ---------- */
const sheet=$('#sheet');let sr=null,st=0;
function sbody(){const r=sr;if(!r)return;let h='';
  if(st===0)h=r.h.map((x,i)=>`<p class="sd" style="color:${COL(r)[i]}">${tc(x[0])}</p><dl class="rows"><div><dt>Cuadra</dt><dd>${x[1]}</dd></div><div><dt>Dueño</dt><dd class="tbc">por confirmar</dd></div><div><dt>Entrenador</dt><dd class="tbc">por confirmar</dd></div><div><dt>Jinete</dt><dd class="tbc">por confirmar</dd></div></dl>`).join('')+
    `<a class="btn" href="https://wa.me/?text=${encodeURIComponent('Datos para la carrera '+r.n+' del Carril Potosino (11 de octubre):\nCaballo: \nDueño: \nEntrenador: \nJinete: ')}">Mandar datos del equipo por WhatsApp</a>`;
  if(st===1){const ya=r.h.filter(x=>AGO9[x[0]]);
    h=`<p class="sub">${r.h.length===2?'Mano a mano':'Carrera de '+r.h.length}, ${r.dist}, ${r.time}.</p><dl class="rows">${r.h.map(x=>{const o=byCuadra[x[1]].filter(y=>y!==x[0]);return `<div><dt>${tc(x[0])}</dt><dd>${x[1]}${o.length?`<small>también corre ${o.map(tc).join(' y ')}</small>`:''}</dd></div>`}).join('')}</dl>`+
    (ya.length?`<p class="lbl">Ya corrieron aquí el 9 de agosto</p><dl class="rows">${ya.map(x=>`<div><dt>${tc(x[0])}</dt><dd>${AGO9[x[0]]}<small>resultado sin capturar</small></dd></div>`).join('')}</dl>`:'')+
    `<p class="lec">Sin resultados capturados todavía. Cuando se suban, aquí sale quién llega mejor.</p>`}
  if(st===2)h=`<div class="ph2">${r.h.map(x=>`<button data-img="${x[2]}" data-nm="${x[0]}" data-cu="${x[1]}"><img src="${img(x[2])}" alt=""><span>${tc(x[0])}</span></button>`).join('')}</div><p class="note">Fotos de ejemplo hasta tener las reales.</p>`;
  $('#sbody').innerHTML=`<h3>Carrera ${r.n} · ${r.time}</h3>`+h;$('#sbody').scrollTop=0;
  sheet.querySelectorAll('.stabs button').forEach((b,i)=>b.classList.toggle('on',i===st))}
function openSheet(r){sr=r;st=0;sbody();sheet.classList.add('open');sheet.setAttribute('aria-hidden','false')}
const closeSheet=()=>{sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true')};
sheet.querySelectorAll('.stabs button').forEach((b,i)=>b.addEventListener('click',()=>{st=i;sbody()}));
$('#shx').addEventListener('click',closeSheet);
$('#sbody').addEventListener('click',e=>{const b=e.target.closest('[data-img]');if(!b)return;closeLb();
  lb.querySelector('img').src=img(b.dataset.img);lb.querySelector('b').textContent=b.dataset.nm;lb.querySelector('small').textContent=b.dataset.cu+' · foto de ejemplo';lb.classList.add('open')});
let y0=null;sheet.querySelector('.sh').addEventListener('touchstart',e=>{y0=e.touches[0].clientY},{passive:true});
sheet.querySelector('.sh').addEventListener('touchend',e=>{if(y0!=null&&e.changedTouches[0].clientY-y0>60)closeSheet();y0=null});
lb.querySelector('p button').addEventListener('click',closeLb);
addEventListener('keydown',e=>{if(e.key==='Escape'){closeSheet();closeLb()}});

/* navegación */
const feed=$('#feed');
const goCard=el=>{closeSheet();feed.scrollTo({top:el.offsetTop,behavior:'smooth'})};
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)goCard(document.querySelector(`.race[data-n="${b.dataset.go}"]`))});
$('#pk').addEventListener('click',()=>goCard($('#mine')));
$('#go').addEventListener('click',()=>goCard($('#prog')));

/* ---------- boleto como imagen (para historias y WhatsApp) ---------- */
async function ticketPng(){await document.fonts.ready;const W=1080,H=1920,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#0a0a0a';x.fillRect(0,0,W,H);
  const logo=new Image();logo.src='img/logo.jpg';await logo.decode().catch(()=>{});
  x.fillStyle='#f2b705';x.fillRect(60,120,960,1680);
  x.fillStyle='#0a0a0a';for(let i=0;i<24;i++){x.beginPath();x.arc(80+i*40,120,12,0,7);x.fill();x.beginPath();x.arc(80+i*40,1800,12,0,7);x.fill()}
  try{x.drawImage(logo,110,190,210,180)}catch(e){}
  x.fillStyle='#0a0a0a';x.font='150px Anton';x.fillText('BOLETO',350,340);
  x.font='700 40px Barlow';x.fillText('CARRIL POTOSINO · DOM 11 OCT · MACK, CO',110,450);
  x.fillRect(110,480,860,6);
  RACES.forEach((r,i)=>{const y=610+i*160,v=picks[r.n];x.fillStyle='#0a0a0a';x.font='64px Anton';x.fillText(r.time,110,y);
    x.font='700 32px Barlow';x.fillStyle='rgba(10,10,10,.6)';x.fillText(r.h.map(h=>tc(h[0])).join(' / ').slice(0,52),110,y+50);
    x.textAlign='right';x.font='56px Anton';x.fillStyle=v!=null?'#0a0a0a':'rgba(10,10,10,.3)';x.fillText(v!=null?r.h[+v][0]:'—',970,y);x.textAlign='left';
    x.fillStyle='rgba(10,10,10,.2)';x.fillRect(110,y+82,860,2)});
  x.fillStyle='#0a0a0a';x.font='700 34px Barlow';x.fillText('Arma el tuyo en la página del Carril Potosino',110,1740);
  return new Promise(res=>c.toBlob(res,'image/png'))}
$('#shareImg').addEventListener('click',async()=>{const b=await ticketPng();const f=new File([b],'boleto-carril-potosino.png',{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:'Mi boleto · Carril Potosino'})}catch(e){}return}
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=f.name;a.click()});
window.__ticket=ticketPng;

document.querySelectorAll('.card').forEach(c=>io.observe(c));paint();tickClock();setInterval(tickClock,1000);
