import * as THREE from 'three';
import {TTFLoader} from 'three/addons/loaders/TTFLoader.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

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
$('#days').textContent=d>1?`faltan ${d} días`:d===1?'mañana':d===0?'hoy':'sábado 31 de octubre';

/* ---------- tarjetas de carrera ---------- */
const NIMG=22;const img=i=>`img/h${String((i-1)%NIMG+1).padStart(2,'0')}.jpg`;
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
    <div class="half ha"><img src="${img(ia)}" alt="" loading="lazy"><div class="who"><small>${loc(r.a)}</small><b>${r.a[0]}</b></div><span class="ph-note">foto de ejemplo</span></div>
    <div class="half hb">${ib?`<img src="${img(ib)}" alt="" loading="lazy">`:'<div style="width:100%;height:100%;background:#151821"></div>'}<div class="who"><small>${r.b?loc(B):'Por confirmar'}</small><b>${B[0]}</b></div>${ib?'<span class="ph-note">foto de ejemplo</span>':''}</div>
    <div class="vs">VS</div>
    <div class="picks"><div class="q">¿Quién gana?<span>cambia tu pick antes de la carrera</span></div>
     <div class="bt"><button class="pa" data-p="a">${r.a[0]}</button>${r.b?`<button class="pb" data-p="b">${B[0]}</button>`:''}</div></div>
   </div>
   <div class="panel"><div class="pad"><h3>Equipo</h3><p class="sub">La cuadra y el dueño no siempre son los mismos. Cada caballo tiene su propio equipo.</p>${team(r.a,'a')}${team(r.b,'b')}
    <a class="btn" href="https://wa.me/?text=${encodeURIComponent('Datos para la carrera '+r.n+' del Gran Maturity G2 en Calpulalpan:')}">Mandar datos del equipo por WhatsApp</a></div></div>
   <div class="panel"><div class="pad">${analysis(r)}</div></div>
  </div></section>`}).join('');

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
document.querySelectorAll('.half img').forEach(im=>im.addEventListener('click',()=>{const h=im.closest('.half');lb.querySelector('img').src=im.src;lb.querySelector('b').textContent=h.querySelector('.who b').textContent;lb.querySelector('small').textContent=h.querySelector('.who small').textContent+' · foto de ejemplo';lb.classList.add('open')}));
lb.addEventListener('click',()=>lb.classList.remove('open'));
addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('open')});

/* riel de progreso: una marca por tarjeta */
const feed=$('#feed');const cards=[...feed.querySelectorAll('.card')];const railEl=$('#rail');
railEl.innerHTML=cards.map(()=>'<i></i>').join('');
function rail(){const i=Math.round(feed.scrollTop/innerHeight);[...railEl.children].forEach((m,j)=>{m.classList.toggle('on',i===j);const c=cards[j];m.classList.toggle('done',c.classList.contains('race')&&!!picks[c.dataset.n]&&i!==j)})}
feed.addEventListener('scroll',rail,{passive:true});paint();

/* ---------- 3D: título en oro que reacciona al scroll ---------- */
const canvas=$('#gl');const intro=$('#intro');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x070a14);scene.fog=new THREE.Fog(0x070a14,22,70);
scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),0.03).texture;scene.environmentIntensity=0.9;
const cam=new THREE.PerspectiveCamera(34,1,0.1,200);
let fontData;try{fontData=await new TTFLoader().loadAsync('fonts/anton-latin-400-normal.woff')}catch(e){fontData=await new TTFLoader().loadAsync('fonts/LiberationSans-BoldItalic.ttf')}
const font=new FontLoader().parse(fontData);
const gold=new THREE.MeshStandardMaterial({color:0xe0a82a,metalness:1,roughness:0.24});
const goldDark=new THREE.MeshStandardMaterial({color:0x8a5a10,metalness:1,roughness:0.4});
const chrome=new THREE.MeshStandardMaterial({color:0xdfe3ea,metalness:1,roughness:0.2});
const shear=new THREE.Matrix4().set(1,0.16,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1);
function text(str,mat,{w=null,h=null,depth=0.5}={}){
  const g=new TextGeometry(str,{font,size:1,depth,curveSegments:10,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.026,bevelSegments:5});
  g.applyMatrix4(shear);g.computeBoundingBox();const b=g.boundingBox;
  const s=w?w/(b.max.x-b.min.x):h/(b.max.y-b.min.y);
  g.translate(-(b.max.x+b.min.x)/2,-(b.max.y+b.min.y)/2,-(b.max.z+b.min.z)/2);
  const m=new THREE.Mesh(g,mat);m.scale.setScalar(s);m.userData.h=(b.max.y-b.min.y)*s;m.userData.w=(b.max.x-b.min.x)*s;return m}
const root=new THREE.Group();scene.add(root);
const L={gran:text('GRAN',chrome,{h:0.95,depth:0.35}),mat:text('MATURITY',gold,{w:6.3,depth:0.55}),g2:text('G2',gold,{h:2.3,depth:0.7}),
  var:text('EN 200 VARAS',chrome,{w:4.0,depth:0.3}),sab:text('SÁBADO 31 DE OCTUBRE',gold,{w:5.7,depth:0.25}),fin:text('ELIMINATORIA 31 OCT  ·  GRAN FINAL 28 NOV',chrome,{w:5.7,depth:0.15})};
const coinR=1.0;
const order=[['coin',coinR*2.2,0.45],['gran',L.gran.userData.h,0.28],['mat',L.mat.userData.h,0.34],['g2',L.g2.userData.h,0.5],['var',L.var.userData.h+0.45,0.42],['sab',L.sab.userData.h,0.3],['fin',L.fin.userData.h,0]];
const total=order.reduce((a,[,h,g])=>a+h+g,0);let yy=total/2;const Y={};
order.forEach(([k,h,g])=>{Y[k]=yy-h/2;yy-=h+g});
Object.entries(L).forEach(([k,m])=>{m.userData.y=Y[k];root.add(m)});
const plate=new THREE.Mesh(new THREE.BoxGeometry(L.var.userData.w+0.8,L.var.userData.h+0.45,0.12),new THREE.MeshStandardMaterial({color:0x0b0d12,metalness:0.6,roughness:0.4}));plate.position.set(0,Y.var,-0.28);root.add(plate);
const rim=new THREE.Mesh(new THREE.BoxGeometry(L.var.userData.w+0.9,L.var.userData.h+0.55,0.06),goldDark);rim.position.set(0,Y.var,-0.36);root.add(rim);
const tex=await new THREE.TextureLoader().loadAsync('medal.png');tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
const coin=new THREE.Group();
const cb=new THREE.Mesh(new THREE.CylinderGeometry(coinR,coinR,0.16,64),gold);cb.rotation.x=Math.PI/2;coin.add(cb);
const fa=new THREE.Mesh(new THREE.CircleGeometry(coinR*0.89,64),new THREE.MeshStandardMaterial({map:tex,metalness:0.25,roughness:0.45}));fa.position.z=0.085;coin.add(fa);
const fb=fa.clone();fb.position.z=-0.085;fb.rotation.y=Math.PI;coin.add(fb);coin.add(new THREE.Mesh(new THREE.TorusGeometry(coinR,0.08,16,64),gold));
coin.position.y=Y.coin;root.add(coin);
/* rayos + resplandor de la base + chispas */
const sb=document.createElement('canvas');sb.width=sb.height=1024;{const g=sb.getContext('2d');g.translate(512,512);for(let i=0;i<16;i++){const a0=i*Math.PI*2/16,a1=a0+Math.PI/40;const gr=g.createRadialGradient(0,0,20,0,0,512);gr.addColorStop(0,'rgba(255,140,40,.9)');gr.addColorStop(.6,'rgba(255,90,20,.25)');gr.addColorStop(1,'rgba(255,60,10,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,0);g.arc(0,0,512,a0,a1);g.closePath();g.fill()}}
const rays=new THREE.Mesh(new THREE.PlaneGeometry(52,52),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sb),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.22,fog:false}));rays.position.set(0,0,-10);scene.add(rays);
const gl2=document.createElement('canvas');gl2.width=gl2.height=512;{const g=gl2.getContext('2d');const gr=g.createRadialGradient(256,256,0,256,256,256);gr.addColorStop(0,'rgba(255,90,25,.85)');gr.addColorStop(.5,'rgba(170,30,15,.35)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,512,512)}
const base=new THREE.Mesh(new THREE.PlaneGeometry(44,16),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(gl2),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.5,fog:false}));base.position.set(0,-7,-8);scene.add(base);
const NP=700,pos=new Float32Array(NP*3),seed=[];let sd=11;const rnd=()=>((sd=sd*16807%2147483647)/2147483647);
for(let i=0;i<NP;i++)seed.push([(rnd()-.5)*16,rnd()*18,-4+rnd()*6,0.4+rnd()*1.4,rnd()*6.28]);
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
const dc=document.createElement('canvas');dc.width=dc.height=64;{const g=dc.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'#ffe9b0');gr.addColorStop(.3,'#ff9a2a');gr.addColorStop(1,'#ff4a0000');g.fillStyle=gr;g.fillRect(0,0,64,64)}
const pts=new THREE.Points(pg,new THREE.PointsMaterial({size:0.17,map:new THREE.CanvasTexture(dc),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(pts);
const key=new THREE.PointLight(0xfff1c8,60,40,1.6);scene.add(key);
const rimL=new THREE.PointLight(0xff7a2a,30,30,1.8);rimL.position.set(-6,2,4);scene.add(rimL);
const blue=new THREE.PointLight(0x4a78ff,30,30,1.8);blue.position.set(6,4,3);scene.add(blue);
/* tamaño: el bloque completo cabe en pantalla */
const D0=22.5,DF=D0-3.4;let K=1,BASEY=0;
function resize(){const w=intro.clientWidth,h=intro.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
  const vh=2*DF*Math.tan(THREE.MathUtils.degToRad(cam.fov/2)),vw=vh*cam.aspect;K=Math.min(vw*0.84/6.3,vh*0.76/total);root.scale.setScalar(K);BASEY=vh*0.07;}
addEventListener('resize',resize);resize();
/* línea de tiempo */
const E=x=>x<0?0:x>1?1:1-Math.pow(1-x,3);
const BK=x=>{x=clamp(x);const c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const t0=performance.now();
function fly(m,at,from,rot=0){const k=BK((T-at)/0.55);m.position.set(from[0]*(1-k),m.userData.y+from[1]*(1-k),from[2]*(1-k));m.rotation.y=rot*(1-k);m.visible=T>=at}
let T=0;
function frame(){
  T=reduce?9:(window.__T??(performance.now()-t0)/1000);
  const p=clamp(feed.scrollTop/innerHeight);
  if(p<0.999){
    const shake=(!reduce&&T>1.55&&T<1.95)?Math.sin(T*120)*0.09*(1-(T-1.55)/0.4):0;
    const a=Math.sin(T*0.5)*0.2+p*0.55,dist=D0-IO(T/6)*3.4-p*7;
    cam.position.set(Math.sin(a)*dist+shake,0.2+Math.sin(T*.7)*.25,Math.cos(a)*dist);cam.lookAt(0,0,0);cam.rotation.z+=Math.sin(T*0.6)*0.012;
    root.position.set(0,BASEY+p*7*K,p*9);root.rotation.y=p*1.2;
    coin.position.y=Y.coin+Math.sin(T*1.6)*0.1;coin.rotation.y=T*1.5;coin.scale.setScalar(E((T-0.2)/0.8));
    fly(L.gran,0.9,[0,2,-34],0.5);fly(L.mat,1.15,[0,0,-38],-0.4);fly(L.g2,1.55,[0,0,-30],0.6);
    const kv=IO((T-2.2)/0.5);L.var.position.set(-9*(1-kv),Y.var,0);L.var.visible=T>2.2;plate.position.x=rim.position.x=9*(1-kv);plate.visible=rim.visible=T>2.2;
    const sk=E((T-3.4)/0.6);L.sab.visible=T>3.4;L.sab.position.set(0,Y.sab-(1-sk)*0.8,0);
    const fk=E((T-4.3)/0.6);L.fin.visible=T>4.3;L.fin.position.set(0,Y.fin-(1-fk)*0.6,0);
    rays.rotation.z=T*0.05;base.material.opacity=0.5+0.15*Math.sin(T*3);
    const sw=((T-1.6)%2.4)/2.4;key.position.set(-8+16*sw,3.5,6);
    const arr=pg.attributes.position.array;for(let i=0;i<NP;i++){const q=seed[i];const life=((T*q[3]*0.9+q[1])%18);arr[i*3]=q[0]+Math.sin(T*0.8+q[4])*0.6;arr[i*3+1]=-7+life;arr[i*3+2]=q[2]}pg.attributes.position.needsUpdate=true;
    renderer.render(scene,cam);
  }
  requestAnimationFrame(frame);
}
window.__ready=true;frame();
