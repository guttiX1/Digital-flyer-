// Mochi: a 3D character that rides on the same eye engine (gaze, blink, squish, sleep, talk).
import * as THREE from 'three';
import {RoomEnvironment} from './vendor/jsm/environments/RoomEnvironment.js';

const W=480,H=516; // same shape as the eye's 400x430 box
let R,scene,cam,M;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;

function mat(c,o={}){return new THREE.MeshPhysicalMaterial(Object.assign({color:c,roughness:.32,metalness:0,clearcoat:1,clearcoatRoughness:.18},o))}

function build(){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const skin=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),mat('#ff7a59'));skin.scale.set(1.08,.9,1);body.add(skin);
 const eyes=[-.34,.34].map(x=>{
  const g=new THREE.Group();g.position.set(x,.12,.78);body.add(g);
  const open=new THREE.Group();g.add(open);
  open.add(new THREE.Mesh(new THREE.SphereGeometry(.2,40,28),mat('#ffffff',{roughness:.15})));
  const pg=new THREE.Group();open.add(pg);
  const pu=new THREE.Mesh(new THREE.SphereGeometry(.104,28,20),mat('#111111',{roughness:.1}));pu.position.z=.124;pg.add(pu);
  const hl=new THREE.Mesh(new THREE.SphereGeometry(.028,12,10),new THREE.MeshBasicMaterial({color:'#ffffff'}));hl.position.set(-.04,.045,.196);pg.add(hl);
  // closed eye: a little curve (sleep = smile line, happy = ^)
  const shut=new THREE.Mesh(new THREE.TorusGeometry(.12,.026,10,28,Math.PI),mat('#5a1408'));shut.position.z=.19;shut.visible=false;g.add(shut);
  return {g,open,pg,pu,shut}});
 const cheeks=[-.58,.58].map(x=>{const c=new THREE.Mesh(new THREE.SphereGeometry(.13,24,16),mat('#ff9fb0',{roughness:.6,clearcoat:0,transparent:true,opacity:.7}));c.scale.set(1,.55,.3);c.position.set(x,-.12,.86);body.add(c);return c});
 const smile=new THREE.Mesh(new THREE.TorusGeometry(.1,.025,12,32,Math.PI),mat('#5a1408'));smile.rotation.z=Math.PI;smile.position.set(0,-.1,.94);body.add(smile);
 const oh=new THREE.Mesh(new THREE.SphereGeometry(.07,20,14),mat('#5a1408',{roughness:.4}));oh.scale.set(1,1,.4);oh.position.set(0,-.13,.985);oh.visible=false;body.add(oh);
 const feet=[-.45,.45].map(x=>{const f=new THREE.Mesh(new THREE.SphereGeometry(.22,24,16),mat('#e85a3c'));f.scale.set(1,.6,1.2);f.position.set(x,-.85,.15);root.add(f);return f});
 const sprout=new THREE.Group();sprout.position.set(0,.84,0);body.add(sprout);
 const st=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.35,12),mat('#2f8f4f'));st.position.y=.16;sprout.add(st);
 const lf=new THREE.Mesh(new THREE.SphereGeometry(.2,24,16),mat('#3fbf6f'));lf.scale.set(1.6,.35,.8);lf.position.set(.2,.34,0);lf.rotation.z=.4;sprout.add(lf);
 const sh=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:.12}));sh.rotation.x=-Math.PI/2;sh.position.y=-1.12;scene.add(sh);
 scene.add(root);
 return {root,body,eyes,cheeks,smile,oh,feet,sprout,sh}}

/* tilt the phone: Mochi leans and rolls toward the low side */
const tilt={x:0,y:0,vx:0,tx:0,ty:0,on:false};
// only the change counts: however you hold the phone, Mochi drifts back to the middle
const base={g:null,b:null};
function onTilt(e){if(e.gamma==null)return;const g=e.gamma,bt=e.beta||0;
 if(base.g==null){base.g=g;base.b=bt}
 base.g+=(g-base.g)*.03;base.b+=(bt-base.b)*.03;
 tilt.on=true;tilt.tx=clamp((g-base.g)/25,-1,1);tilt.ty=clamp((bt-base.b)/30,-1,1)}
function askTilt(){const D=window.DeviceOrientationEvent;if(!D)return;
 if(typeof D.requestPermission==='function')D.requestPermission().then(p=>{if(p==='granted')addEventListener('deviceorientation',onTilt)}).catch(()=>{});
 else addEventListener('deviceorientation',onTilt)}

const per=new WeakMap();
function stateOf(E){let s=per.get(E);if(!s){s={cv:null,ctx:null,lean:0,zz:0,hello:false};per.set(E,s)}return s}

function place(E,s){const svg=E.svg,par=svg.parentElement;if(!par)return false;
 if(!s.cv){s.cv=document.createElement('canvas');s.cv.className='m3c';s.cv.width=W;s.cv.height=H;s.ctx=s.cv.getContext('2d');
  if(getComputedStyle(par).position==='static')par.style.position='relative';par.appendChild(s.cv)}
 if(s.cv.parentElement!==par)par.appendChild(s.cv);
 const r=svg.getBoundingClientRect(),pr=par.getBoundingClientRect();
 if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth||!r.width)return false;
 const k=pr.width?par.offsetWidth/pr.width:1; // undo any CSS scale on the parent
 const st=s.cv.style;st.left=((r.left-pr.left)*k)+'px';st.top=((r.top-pr.top)*k)+'px';st.width=(r.width*k)+'px';st.height=(r.height*k)+'px';return true}

function pose(E,s,dt,T){
 const b=clamp(E.b||0,0,1),sleep=!!E.sleep&&!E.talking&&!E.listening,happy=E.happy||0;
 const sq=1+(E.sq-1)*1.7;
 const bob=sleep?Math.sin(T*1.1)*.025:Math.sin(T*(E.night?.9:2.2)+E.ex)*.05;
 const hop=happy>.3?Math.abs(Math.sin(T*9))*.12*happy:0;
 const jit=E.nervous?Math.sin(T*47)*.02:0;
 M.root.position.set(tilt.x*.22+jit,.07+bob+hop-(sleep?.06:0),0);
 M.root.scale.set(1/sq,sq,1/sq);
 s.lean=lerp(s.lean,E.listening?.22:0,dt*6);
 M.root.rotation.set(E.gy*.22+s.lean+tilt.y*.12,E.gx*.4+tilt.x*.35,-tilt.x*.32+(sleep?.12:0));
 // eyes
 const lookX=clamp(E.gx+tilt.x*.8,-1,1),lookY=clamp(E.gy,-1,1);
 M.eyes.forEach(e=>{
  const shut=sleep||happy>.6;
  e.open.visible=!shut;e.shut.visible=shut;
  if(shut){e.shut.rotation.z=sleep?Math.PI:0;e.shut.position.y=sleep?.02:-.03}
  e.open.scale.y=Math.max(.08,1-b);
  const pr=.07*(E.pu/.36);e.pu.scale.setScalar(clamp(E.pu/.36,.7,1.5));
  e.pg.position.set(lookX*.07,-lookY*.06,0);e.pg.rotation.set(lookY*.4,lookX*.5,0);void pr});
 // mouth: talking opens and closes, sleeping is a small o, happy grows the smile
 const talk=E.talking?Math.abs(Math.sin(T*16)):0;
 M.oh.visible=sleep||!!E.talking||!!E.listening;M.smile.visible=!M.oh.visible;
 if(M.oh.visible)M.oh.scale.set(E.talking?1.2:.8,E.talking?.4+1.4*talk:E.listening?1:.6,.4);
 M.smile.scale.setScalar(1+happy*.6);
 M.cheeks.forEach(c=>{c.material.opacity=.55+happy*.45;c.scale.set(1+happy*.25,.55+happy*.15,.3)});
 // feet tap when happy, sprout sways and springs on a poke
 M.feet.forEach((f,i)=>{f.position.y=-.85+(happy>.3?Math.max(0,Math.sin(T*12+i*Math.PI))*.08:0)});
 M.sprout.rotation.z=Math.sin(T*2.1)*.12+(E.sv||0)*.8-tilt.x*.4+(sleep?.5:0);
 M.sprout.rotation.x=E.listening?-.35:0;
 M.sh.scale.set((1.15-bob-hop)*(1/sq),1,.4);M.sh.position.x=M.root.position.x;M.sh.material.opacity=.13-hop*.4;
 }

function zzz(ctx,T){ctx.save();ctx.fillStyle='#5d6470';ctx.textAlign='center';
 for(let i=0;i<3;i++){const k=((T*.45+i/3)%1);ctx.globalAlpha=Math.sin(k*Math.PI)*.9;ctx.font=`700 ${Math.round(26+k*22)}px system-ui,sans-serif`;ctx.fillText('z',W*.74+k*50+Math.sin(T*2+i)*6,H*.32-k*120)}
 ctx.restore()}

function frame(dt,T){
 tilt.tx*=1-dt*.8;tilt.ty*=1-dt*.8;tilt.vx+=(160*(tilt.tx-tilt.x)-18*tilt.vx)*dt;tilt.x+=tilt.vx*dt;tilt.y=lerp(tilt.y,tilt.ty,dt*4);
 const list=(window.__eyes?window.__eyes():[]).filter(E=>E.sty==='mochi'&&E.svg.isConnected);
 for(const E of list){const s=stateOf(E);if(!place(E,s))continue;
  pose(E,s,dt,T);R.render(scene,cam);
  s.ctx.clearRect(0,0,W,H);s.ctx.drawImage(R.domElement,0,0);
  if(E.sleep&&!E.talking&&!E.listening)zzz(s.ctx,T);
  E.svg.classList.add('live')}}

export function start(){
 try{R=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch(e){console.warn('no WebGL',e);return}
 R.setPixelRatio(1);R.setSize(W,H,false);R.toneMapping=THREE.ACESFilmicToneMapping;R.outputColorSpace=THREE.SRGBColorSpace;R.setClearColor(0x000000,0);
 scene=new THREE.Scene();scene.environment=new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(),.04).texture;
 const key=new THREE.DirectionalLight('#ffffff',1.6);key.position.set(-3,4,5);scene.add(key);scene.add(new THREE.AmbientLight('#ffffff',.35));
 cam=new THREE.PerspectiveCamera(30,W/H,.1,50);cam.position.set(0,.25,5.9);cam.lookAt(0,.05,0);
 M=build();
 addEventListener('pointerdown',askTilt,{once:true});
 window.mochiFrame=frame}
