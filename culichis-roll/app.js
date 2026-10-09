/* Culichi's Roll: menú para recoger. Todo dato sale de esta lista (del sitio y anuncio del cliente).
   Lo que no está aquí se contesta "no lo tengo, pregunta al llamar". Nunca se piden tarjetas. */
const PHONE='+19704046638',PHONE_TXT='970-404-6638';
const MENU=[
 {id:'horneado',img:'horneado',ghost:'HORNEADO',name:'Horneado Boneless',price:'$23',
  blurb:'Gratinado con queso chihuahua y boneless en salsa BBQ, con cebollín. Uno de los favoritos de la casa.',
  has:['Queso chihuahua gratinado','Boneless en salsa BBQ','Cebollín'],
  opts:[{n:'Horneado Boneless',p:23}],rm:['Cebollín'],keys:['horneado','boneless','gratinado','bbq']},
 {id:'res',img:'rollo_res',ghost:'ROLLOS',name:'Rollo de Res',price:'desde $22',
  blurb:'Res, aguacate y queso philadelphia por dentro. Cortado al momento, con ensalada y salsa de la casa.',
  has:['Res','Aguacate','Queso philadelphia','Ensalada y salsa de la casa al lado'],
  opts:[{n:'Rollo de Res',p:22,from:true}],rm:['Aguacate','Queso philadelphia','Ensalada'],keys:['res','carne','rollo de res','philadelphia','rollo']},
 {id:'papas',img:'papas',ghost:'PAPAS',name:'Super Papas',price:'$20',
  blurb:'Papas fritas con res, pollo o mixtas, aguacate, queso para nachos, queso gratinado, aderezo de chipotle y cebollín.',
  has:['Res, pollo o mixtas','Aguacate','Queso para nachos','Queso gratinado','Aderezo de chipotle','Cebollín'],
  opts:[{n:'Super Papas de res',p:20,l:'Res'},{n:'Super Papas de pollo',p:20,l:'Pollo'},{n:'Super Papas mixtas',p:20,l:'Mixtas'}],pick:'Carne',rm:['Aguacate','Queso para nachos','Chipotle','Cebollín'],keys:['papas','papa','fries','super papas']},
 {id:'especial',img:'especial',ghost:'ESPECIAL',name:'Rollos Especiales',price:'desde $23',
  blurb:'Aguacate, salsa de anguila, spicy mayo y ajonjolí encima. Sushi estilo Culiacán, hecho al momento.',
  has:['Aguacate','Salsa de anguila','Spicy mayo','Ajonjolí'],
  opts:[{n:'Rollo Especial',p:23,from:true}],rm:['Aguacate','Spicy mayo','Salsa de anguila','Ajonjolí'],keys:['especial','especiales','anguila','spicy','picante','pica']},
 {id:'charola',img:'charola',ghost:'CHAROLA',name:'Charolas',price:'$60 · $70 · $100',
  blurb:'3 rollos por $60 o 5 rollos por $100. La Charola Familiar trae 2 rollos, 8 alitas o boneless y papas por $70.',
  has:['3 rollos: $60','5 rollos: $100','Familiar: 2 rollos + 8 alitas o boneless + papas: $70'],
  opts:[{n:'Charola de 3 rollos',p:60,l:'3 rollos'},{n:'Charola Familiar',p:70,l:'Familiar',sub:['8 alitas','8 boneless']},{n:'Charola de 5 rollos',p:100,l:'5 rollos'}],pick:'Tamaño',rm:[],keys:['charola','charolas','familiar','familia','compartir','alitas','3 rollos','5 rollos','tres rollos','cinco rollos']},
];
const $=s=>document.querySelector(s);
const feed=$('#feed');
const money=n=>'$'+n;
const say=(t,lang='es-MX')=>{try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t.replace(/\$(\d+)/g,'$1 dólares'));u.lang=lang;u.rate=1.05;speechSynthesis.speak(u)}catch(e){}};
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),1800)};
const buzz=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};

/* ---------- tarjetas de platillo ---------- */
$('#dishes').innerHTML=MENU.map((d,i)=>`<section class="card dish" data-i="${i}" id="d-${d.id}">
 <div class="ghost" aria-hidden="true">${d.ghost}</div>
 <div class="strip">
  <div class="panel p0">
   <div class="stage"><div class="pool"></div><img class="food" src="food/${d.img}.webp" alt="${d.name}" draggable="false"></div>
   <div class="sticker"><small>${d.price.startsWith('desde')?'desde':d.opts.length>1&&d.id==='charola'?'desde':'solo'}</small><b>${d.id==='charola'?'$60':d.price.replace('desde ','')}</b></div>
   <div class="txt"><h2>${d.name}</h2><p class="bl">${d.blurb}</p>
    <div class="acts"><button class="add" type="button">+ Agregar</button><button class="more" type="button">Personalizar →</button></div></div>
  </div>
  <div class="panel p1"><div class="pad">
   <p class="lbl">Personaliza</p><h3>${d.name}</h3>
   <p class="lleva">Lleva: ${d.has.join(' · ')}</p>
   ${d.opts.length>1?`<p class="gl">${d.pick}</p><div class="seg" data-g="o">${d.opts.map((o,j)=>`<button type="button" data-v="${j}" class="${j?'':'on'}"><span>${o.l}</span><b>${money(o.p)}</b></button>`).join('')}</div>`:''}
   ${d.opts.some(o=>o.sub)?`<div class="subw"><p class="gl">Con</p><div class="seg" data-g="s">${d.opts.find(o=>o.sub).sub.map((x,j)=>`<button type="button" data-v="${j}" class="${j?'':'on'}"><span>${x}</span></button>`).join('')}</div></div>`:''}
   ${d.rm.length?`<p class="gl">Sin… <small>toca para quitar</small></p><div class="tg">${d.rm.map(x=>`<button type="button" data-x="${x}">${x}</button>`).join('')}</div>`:''}
   <p class="gl">Nota para la cocina</p><input class="nota" maxlength="80" placeholder="Ej. salsa aparte">
   <div class="qrow"><div class="stp"><button type="button" data-q="-1" aria-label="Menos">−</button><b class="qn">1</b><button type="button" data-q="1" aria-label="Más">+</button></div>
    <button class="go" type="button">Agregar · <span class="gp"></span></button></div>
   <button class="back" type="button">← Volver al platillo</button>
  </div></div>
 </div></section>`).join('');
$('#dots').innerHTML=['intro',...MENU.map(d=>'d-'+d.id),'info'].map(id=>`<i data-go="${id}"></i>`).join('');

function fitGhosts(){document.querySelectorAll('.ghost').forEach(g=>{g.style.fontSize='100px';const w=g.scrollWidth||1;g.style.fontSize=Math.min(innerHeight*.13,100*innerWidth*.9/w)+'px'})}
document.fonts.ready.then(fitGhosts);addEventListener('resize',fitGhosts);
/* inclinación: la comida sigue tu dedo o el teléfono */
document.querySelectorAll('.dish').forEach(c=>{const st=c.querySelector('.stage'),f=c.querySelector('.food');
  let tx=0,ty=0;const set=()=>f.style.setProperty('--rx',ty+'deg')||f.style.setProperty('--ry',tx+'deg');
  st.addEventListener('pointermove',e=>{const r=st.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5)*24;ty=-((e.clientY-r.top)/r.height-.5)*18;f.style.setProperty('--ry',tx+'deg');f.style.setProperty('--rx',ty+'deg')});
  st.addEventListener('pointerleave',()=>{f.style.setProperty('--ry','0deg');f.style.setProperty('--rx','0deg')});
  const strip=c.querySelector('.strip');
  c.querySelector('.more').addEventListener('click',()=>strip.scrollTo({left:strip.clientWidth,behavior:'smooth'}));
  c.querySelector('.back').addEventListener('click',()=>strip.scrollTo({left:0,behavior:'smooth'}));
  const d=MENU[c.dataset.i];
  c.querySelector('.add').addEventListener('click',()=>{if(d.opts.length>1)strip.scrollTo({left:strip.clientWidth,behavior:'smooth'});else{add(d,0);fly(f)}});
  const cs={o:0,s:0,x:new Set(),q:1};const p1=c.querySelector('.p1');
  const price=()=>{const o=d.opts[cs.o];p1.querySelector('.gp').textContent=(o.from?'desde ':'')+money(o.p*cs.q);const sw=p1.querySelector('.subw');if(sw)sw.style.display=o.sub?'':'none'};
  p1.querySelectorAll('.seg').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;g.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));cs[g.dataset.g]=+b.dataset.v;price()}));
  p1.querySelectorAll('.tg button').forEach(b=>b.addEventListener('click',()=>{b.classList.toggle('off');b.classList.contains('off')?cs.x.add(b.dataset.x):cs.x.delete(b.dataset.x)}));
  p1.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{cs.q=Math.max(1,Math.min(20,cs.q+ +b.dataset.q));p1.querySelector('.qn').textContent=cs.q;price()}));
  p1.querySelector('.go').addEventListener('click',()=>{const o=d.opts[cs.o];const mods=[];if(o.sub)mods.push('con '+o.sub[cs.s]);cs.x.forEach(x=>mods.push('sin '+x.toLowerCase()));const nt=p1.querySelector('.nota').value.trim();if(nt)mods.push('"'+nt+'"');
    add(d,cs.o,cs.q,mods.join(', '));fly(f);strip.scrollTo({left:0,behavior:'smooth'});
    cs.q=1;cs.x.clear();p1.querySelector('.qn').textContent=1;p1.querySelectorAll('.tg button').forEach(b=>b.classList.remove('off'));p1.querySelector('.nota').value='';price()});
  price();
});
addEventListener('deviceorientation',e=>{if(e.gamma==null)return;document.querySelectorAll('.dish.live .food').forEach(f=>{f.style.setProperty('--ry',Math.max(-14,Math.min(14,e.gamma*.5))+'deg');f.style.setProperty('--rx',Math.max(-10,Math.min(10,(e.beta-50)*-.3))+'deg')})});

/* comida que vuela a la bolsa */
function fly(img){const r=img.getBoundingClientRect(),b=$('#bagBtn').getBoundingClientRect();const g=img.cloneNode();g.className='flyer';
  Object.assign(g.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});document.body.appendChild(g);
  requestAnimationFrame(()=>{g.style.transform=`translate(${b.left+b.width/2-r.left-r.width/2}px,${b.top+b.height/2-r.top-r.height/2}px) scale(.08) rotate(25deg)`;g.style.opacity='.4'});
  setTimeout(()=>g.remove(),700)}

/* entra en pantalla */
const io=new IntersectionObserver(es=>es.forEach(e=>{e.target.classList.toggle('live',e.isIntersecting);if(e.isIntersecting){const id=e.target.id;document.body.classList.toggle('onintro',id==='intro');document.querySelectorAll('#dots i').forEach(i=>i.classList.toggle('on',i.dataset.go===id))}}),{threshold:.55});
document.querySelectorAll('.card').forEach(c=>io.observe(c));
$('#dots').addEventListener('click',e=>{const i=e.target.closest('[data-go]');if(i)$('#'+i.dataset.go).scrollIntoView({behavior:'smooth'})});
/* portada: carrusel 3D de los 5 platillos */
(()=>{const ring=$('#ring'),N=MENU.length;let k=0,t=null;
 ring.innerHTML=MENU.map((d,i)=>`<button class="rf" data-i="${i}" type="button" aria-label="${d.name}"><img src="food/${d.img}.webp" alt="" draggable="false"></button>`).join('');
 $('#hbars').innerHTML=MENU.map(()=>'<i><u></u></i>').join('');
 const els=[...ring.children],bars=[...$('#hbars').children];
 function show(n){k=(n+N)%N;els.forEach((e,i)=>{let o=((i-k)%N+N)%N;if(o>N/2)o-=N;e.dataset.o=o});
  const d=MENU[k];const g=$('#hghost');g.textContent=d.ghost;g.classList.remove('in');void g.offsetWidth;g.classList.add('in');fitHero();
  $('#hname').textContent=d.name;$('#hprice').textContent=d.price;['#hname','#hprice'].forEach(s=>{const e=$(s);e.classList.remove('in');void e.offsetWidth;e.classList.add('in')});
  bars.forEach((b,i)=>b.className=i<k?'done':i===k?'on':'');clearTimeout(t);t=setTimeout(()=>show(k+1),3200)}
 function fitHero(){const g=$('#hghost');g.style.fontSize='100px';g.style.fontSize=Math.min(innerHeight*.15,100*innerWidth*.94/(g.scrollWidth||1))+'px'}
 els.forEach(e=>e.addEventListener('click',()=>{const o=+e.dataset.o;if(o)show(k+o);else $('#d-'+MENU[k].id).scrollIntoView({behavior:'smooth'})}));
 let x0=null;ring.addEventListener('touchstart',e=>x0=e.touches[0].clientX,{passive:true});
 ring.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40)show(k+(dx<0?1:-1));x0=null});
 document.fonts.ready.then(()=>show(0));addEventListener('resize',fitHero)})();
$('#goMenu').addEventListener('click',()=>$('#dishes .card').scrollIntoView({behavior:'smooth'}));

/* ---------- la orden ---------- */
const KEY='culichis-order';let bag=[];try{bag=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(bag))}catch(e){}};
function add(d,j,q=1,m=''){const o=d.opts[j];const it=bag.find(x=>x.n===o.n&&(x.m||'')===m);if(it)it.q+=q;else bag.push({n:o.n,p:o.p,from:!!o.from,q,m});save();paintBag();buzz(18);
  const b=$('#bagBtn');b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');toast(`✓ ${q>1?q+' × ':''}${o.n}`);return o}
function paintBag(){const n=bag.reduce((a,x)=>a+x.q,0),tot=bag.reduce((a,x)=>a+x.p*x.q,0),from=bag.some(x=>x.from);$('#bagN').textContent=n;$('#bagBtn').classList.toggle('has',n>0);
  const txt=`Hola Culichi's Roll, quiero ordenar para recoger:\n${bag.map(x=>`${x.q} × ${x.n}${x.m?' ('+x.m+')':''}`).join('\n')}\nTotal aprox: ${money(tot)}\nNombre: `;
  $('#bagBody').innerHTML=n?`<ul class="lines">${bag.map((x,i)=>`<li><span class="q"><button data-m="${i}" aria-label="Quitar uno">−</button><b>${x.q}</b><button data-p="${i}" aria-label="Agregar uno">+</button></span><span class="nm">${x.n}${x.m?`<small>${x.m}</small>`:''}</span><b>${x.from?'desde ':''}${money(x.p*x.q)}</b></li>`).join('')}</ul>
   <p class="tot"><span>Total${from?' aprox.':''}</span><b>${money(tot)}</b></p>
   ${from?'<p class="note">Algunos rollos son "desde": el precio final te lo confirman al ordenar.</p>':''}
   <a class="b-red big" href="tel:${PHONE}">📞 Llamar para ordenar</a>
   <a class="b-ink big" href="sms:${PHONE}?&body=${encodeURIComponent(txt)}">💬 Mandar la orden por texto</a>
   <p class="note">Solo para recoger en Rifle. Pagas al recoger. Nunca te pedimos tu tarjeta por aquí.</p>
   <button class="clear" type="button" id="clr">Vaciar la orden</button>`
   :`<p class="empty">Tu orden está vacía.<br>Toca <b>+ Agregar</b> en un platillo, o dile al micrófono "quiero un horneado".</p>`;
  $('#bagBody').querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const x=bag[b.dataset.m];x.q--;if(!x.q)bag.splice(b.dataset.m,1);save();paintBag()});
  $('#bagBody').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{bag[b.dataset.p].q++;save();paintBag()});
  const c=$('#clr');if(c)c.onclick=()=>{bag=[];save();paintBag()}}
paintBag();

/* hojas */
const open=id=>{document.querySelectorAll('.sheet').forEach(s=>s.classList.toggle('open',s.id===id));document.body.classList.add('sheeting')};
const close=()=>{document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('open'));document.body.classList.remove('sheeting');stopListen()};
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
$('#bagBtn').addEventListener('click',()=>open('bag'));
document.querySelectorAll('.sheet .sh').forEach(h=>{let y0=null;h.addEventListener('touchstart',e=>y0=e.touches[0].clientY,{passive:true});h.addEventListener('touchend',e=>{if(y0!=null&&e.changedTouches[0].clientY-y0>60)close();y0=null})});
$('#adBtn').addEventListener('click',()=>{$('#vw').classList.add('open');$('#vwv').play().catch(()=>{})});
$('#vwx').addEventListener('click',()=>{$('#vw').classList.remove('open');$('#vwv').pause()});

/* ---------- hablar con el menú (solo contesta con datos de MENU) ---------- */
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[¿?¡!.,]/g,' ');
const NUM={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,one:1,two:2,three:3,four:4,five:5};
function findDish(t){let best=null,len=0;MENU.forEach(d=>d.keys.forEach(k=>{if(t.includes(k)&&k.length>len){best=d;len=k.length}}));return best}
function pickOpt(d,t){if(d.id==='papas'){if(t.includes('mixt'))return 2;if(t.includes('pollo'))return 1;if(t.includes('res')||t.includes('carne'))return 0;return -1}
  if(d.id==='charola'){if(/famil|alitas/.test(t))return 1;if(/\b5\b|cinco/.test(t))return 2;if(/\b3\b|tres/.test(t))return 0;return -1}return 0}
function qty(t){t=t.replace(/(\d+|tres|cinco)\s+rollos?/g,' ');const m=t.match(/\b(\d+)\b/);if(m&&+m[1]<20)return +m[1];for(const w of t.split(/\s+/))if(NUM[w])return NUM[w];return 1}
function answer(raw){const t=' '+norm(raw)+' ';let d=findDish(t);
  if(/hola|buenas|hello|hi /.test(t)&&!d)return {a:'¡Hola! Pregúntame del menú: precios, qué lleva cada platillo, o dime qué quieres y te lo pongo en tu orden.'};
  if(/horario|hora|abren|cierran|open|hours|direcci|donde|ubica|address|where/.test(t))return {a:`Están en Rifle y es solo para recoger. Según Yelp abren fines de semana, más o menos de 11:45 a 6:30. La dirección no la tengo aquí. Confírmalo al ${PHONE_TXT}.`};
  if(/pago|tarjeta|card|cash|efectivo|pay/.test(t))return {a:'Pagas al recoger. Por aquí nunca te pido tu tarjeta.'};
  if(/delivery|domicilio|entrega|llevan|envian/.test(t))return {a:`Por ahora es solo para recoger en Rifle. Ordena al ${PHONE_TXT}.`};
  if(/como (ordeno|pido)|ordenar|how.*order/.test(t)&&!d)return {a:`Agrega lo que quieras aquí y luego toca "Llamar" o "Mandar por texto" al ${PHONE_TXT}. Pasas a recoger.`,act:'bag'};
  if(/mi orden|cuanto (es|va|llevo)|total/.test(t)&&!d){const tot=bag.reduce((a,x)=>a+x.p*x.q,0);return {a:bag.length?`Llevas ${bag.map(x=>x.q+' '+x.n).join(', ')}. Total aproximado ${money(tot)}.`:'Tu orden está vacía todavía.',act:'bag'}}
  if(/recomien|mejor|favorit|popular|que me (das|recomiendas)/.test(t)&&!d){d=MENU[0];return {a:`El Horneado Boneless es uno de los favoritos de la casa: queso chihuahua gratinado y boneless en BBQ, ${d.price}. Para compartir, la Charola Familiar por $70.`,go:d}}
  if(/pica|picante|spicy|enchiloso/.test(t)&&(!d||d.id==='especial'))return {a:'El que trae picosito es el Rollo Especial: spicy mayo, salsa de anguila, aguacate y ajonjolí. Desde $23. De cuánto pica exactamente, pregúntales al llamar.',go:MENU[3]};
  if(/menu|que (tienen|venden|hay)|opciones/.test(t)&&!d)return {a:'Hay Horneado Boneless $23, Rollo de Res desde $22, Super Papas $20, Rollos Especiales desde $23, y Charolas: 3 rollos $60, Familiar $70, 5 rollos $100.'};
  if(!d)return {a:`Eso no lo tengo en el menú de aquí. Puedo decirte de los horneados, rollos, super papas, especiales y charolas. Para lo demás llama al ${PHONE_TXT}.`};
  if(/quiero|dame|agrega|ponme|pon |orden|llevo|want|add|me das/.test(t)){const j=pickOpt(d,t);
    if(j<0)return {a:d.id==='papas'?'¿Las Super Papas de res, de pollo o mixtas?':'¿Cuál charola: de 3 rollos ($60), la Familiar ($70) o de 5 rollos ($100)?',go:d,wait:d};
    const q=qty(t);const o=add(d,j,q);return {a:`Listo, agregué ${q>1?q+' × ':''}${o.n}. ¿Algo más?`,go:d}}
  if(/lleva|trae|ingred|que es|tiene|contain/.test(t))return {a:`${d.name}: ${d.has.join(', ')}.`,go:d,side:1};
  if(/cuanto|precio|cuesta|vale|price|cost/.test(t))return {a:d.id==='charola'?'Charola de 3 rollos $60, Charola Familiar $70, de 5 rollos $100.':`${d.name}: ${d.price}.`,go:d};
  return {a:`${d.name}, ${d.price}. ${d.blurb}`,go:d}}
let waitFor=null;
function bubble(t,who){const c=$('#chat');c.insertAdjacentHTML('beforeend',`<p class="${who}">${t}</p>`);c.scrollTop=c.scrollHeight}
function handle(text){if(!text.trim())return;bubble(text,'me');let r;
  if(waitFor&&!findDish(' '+norm(text)+' ')){const d=waitFor;waitFor=null;r=answer('quiero '+d.keys[0]+' '+text)}else r=answer(text);
  if(r.wait)waitFor=r.wait;
  setTimeout(()=>{bubble(r.a,'bot');say(r.a);if(r.go){const c=$('#d-'+r.go.id);c.scrollIntoView({behavior:'smooth'});if(r.side!=null)setTimeout(()=>{const s=c.querySelector('.strip');s.scrollTo({left:s.clientWidth*r.side,behavior:'smooth'})},500)}if(r.act==='bag')setTimeout(()=>open('bag'),1400)},250)}
const CH=['¿Qué me recomiendas?','¿Qué lleva el especial?','Quiero unas super papas mixtas','¿Cuánto es la charola familiar?','¿Cómo ordeno?'];
$('#chips').innerHTML=CH.map(c=>`<button type="button">${c}</button>`).join('');
$('#chips').addEventListener('click',e=>{const b=e.target.closest('button');if(b)handle(b.textContent)});
$('#ask').addEventListener('submit',e=>{e.preventDefault();handle($('#q').value);$('#q').value=''});
function openTalk(){open('talk');if(!$('#chat').children.length)bubble('¡Qué onda! Soy el menú de Culichi\'s Roll. Pregúntame precios, qué lleva cada platillo, o dime qué quieres y lo agrego a tu orden.','bot')}
$('#introTalk').addEventListener('click',()=>{openTalk();listen()});
$('#mic').addEventListener('click',()=>{openTalk();listen()});

/* voz: el reconocimiento se apaga solo si se queda trabado */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let rec=null,guard=null;
function stopListen(){document.body.classList.remove('listening');clearTimeout(guard);try{rec&&rec.abort()}catch(e){}rec=null}
function listen(){if(!SR){$('#q').focus();bubble('Tu navegador no deja usar el micrófono aquí. Escríbeme.','bot');return}
  if(rec){stopListen();return}
  try{speechSynthesis.cancel()}catch(e){}
  rec=new SR();rec.lang='es-MX';rec.interimResults=true;rec.maxAlternatives=1;let fin='';
  rec.onresult=e=>{let s='';for(const r of e.results){s+=r[0].transcript;if(r.isFinal)fin=s}$('#q').value=s};
  rec.onend=()=>{const t=fin||$('#q').value;stopListen();$('#q').value='';if(t)handle(t)};
  rec.onerror=()=>stopListen();
  document.body.classList.add('listening');guard=setTimeout(()=>{try{rec&&rec.stop()}catch(e){}},9000);
  try{rec.start()}catch(e){stopListen()}}
$('#hold').addEventListener('click',listen);
window.__answer=answer;
