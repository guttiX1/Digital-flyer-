// 3D characters that ride on the eye engine: each one reads the eye's state (gaze, blink, squish,
// sleep, talk, listen, mood) and adds pick-up, tilt and its own little parts (leaf, wings, hat).
import * as THREE from 'three';
import {RoomEnvironment} from './vendor/jsm/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from './vendor/jsm/geometries/RoundedBoxGeometry.js';

export const W=480,H=516; // same shape as the eye's 400x430 box
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const mat=(c,o={})=>new THREE.MeshPhysicalMaterial(Object.assign({color:c,roughness:.32,metalness:0,clearcoat:1,clearcoatRoughness:.18},o));
const matte=(c,o={})=>mat(c,Object.assign({roughness:.75,clearcoat:0},o));
const basic=c=>new THREE.MeshBasicMaterial({color:c});
const SPH=(r,a=40,b=28)=>new THREE.SphereGeometry(r,a,b);
function M(geo,m,p,s,rot){const x=new THREE.Mesh(geo,m);if(p)x.position.set(...p);if(s!=null){if(typeof s==='number')x.scale.setScalar(s);else x.scale.set(...s)}if(rot)x.rotation.set(...rot);return x}
// z of the front surface of an ellipsoid at (x,y)
const zOn=(x,y,sx,sy,sz,cy=0)=>sz*Math.sqrt(Math.max(0,1-(x/sx)**2-((y-cy)/sy)**2));

function rig(def){const r={root:new THREE.Group(),body:new THREE.Group(),eyes:[],cheeks:[],feet:[],sway:null,flap:[],tint:[],def,float:false,mouth:null};
 r.root.add(r.body);
 r.skin=(k=0,o)=>{const m=mat(def,o);r.tint.push([m,k]);return m};
 r.skinMatte=(k=0,o)=>{const m=matte(def,o);r.tint.push([m,k]);return m};
 return r}
function eye(r,parent,x,y,z,rad,kind='ball'){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);const open=new THREE.Group();g.add(open);const pg=new THREE.Group();open.add(pg);let pu;
 if(kind==='ball'){open.add(M(SPH(rad),mat('#ffffff',{roughness:.15})));pu=M(SPH(rad*.52,28,20),mat('#111111',{roughness:.1}),[0,0,rad*.62]);pg.add(pu);pg.add(M(SPH(rad*.14,12,10),basic('#ffffff'),[-rad*.2,rad*.22,rad*.98]))}
 else if(kind==='dot'){pu=M(SPH(rad,28,20),mat('#141414',{roughness:.1}),null,[.8,1.15,.5]);pg.add(pu);pg.add(M(SPH(rad*.25,12,10),basic('#ffffff'),[-rad*.25,rad*.4,rad*.45]))}
 else {pu=M(new THREE.CapsuleGeometry(rad*.6,rad*.9,8,16),basic('#5ee0ff'));pg.add(pu)}
 const shut=M(new THREE.TorusGeometry(rad*.62,rad*.13,10,28,Math.PI),kind==='screen'?basic('#5ee0ff'):mat('#3a1408'),[0,0,kind==='ball'?rad*.95:rad*.5]);shut.visible=false;g.add(shut);
 const e={g,open,pg,pu,shut,kind,rad};r.eyes.push(e);return e}
function mouth(r,parent,x,y,z,s=1,c='#5a1408',glow=false){const m=glow?basic(c):mat(c);
 z+=.035;const sm=M(new THREE.TorusGeometry(.1*s,.025*s,12,32,Math.PI),m,[x,y,z],null,[0,0,Math.PI]);
 const oh=M(SPH(.07*s,20,14),glow?basic(c):mat(c,{roughness:.4}),[x,y-.03*s,z+.01],[1,1,.4]);oh.visible=false;parent.add(sm,oh);r.mouth={sm,oh}}
function cheeks(r,parent,pts,c='#ff9fb0'){pts.forEach(([x,y,z])=>{const m=M(SPH(.13,24,16),matte(c,{transparent:true,opacity:.7}),[x,y,z],[1,.55,.3]);parent.add(m);r.cheeks.push(m)})}
function feet(r,pts,m){pts.forEach(([x,y,z])=>{const f=M(SPH(.22,24,16),m||r.skin(-.12),[x,y,z],[1,.6,1.2]);r.root.add(f);r.feet.push(f)})}
function lathe(pts,m,seg=64){return new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),seg),m)}
function tube(pts,rad,m,seg=40){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),seg,rad,12,false),m)}
// a round "bean" body with face, used by the office, magic and Halloween crews
function bean(r,o={}){const sx=.95,sy=1.05,sz=.9;r.body.add(M(SPH(1,64,48),o.matte?r.skinMatte(0):r.skin(0),null,[sx,sy,sz]));
 const ey=o.ey??.2,ex=.3,er=o.er??.18;const ez=zOn(ex,ey,sx,sy,sz)-er*.75;
 eye(r,r.body,-ex,ey,ez,er);eye(r,r.body,ex,ey,ez,er);
 if(!o.noMouth)mouth(r,r.body,0,o.my??-.15,zOn(0,o.my??-.15,sx,sy,sz)-.02);
 if(!o.noCheeks)cheeks(r,r.body,[[-.52,-.05,zOn(.52,-.05,sx,sy,sz)-.06],[.52,-.05,zOn(.52,-.05,sx,sy,sz)-.06]]);
 if(!o.float)feet(r,[[-.42,-.92,.12],[.42,-.92,.12]],o.feetMat);else r.float=true;
 return {sx,sy,sz}}
function hand(r,x,y,z){r.body.add(M(SPH(.14,20,14),r.skin(-.05),[x,y,z]))}
function shirt(r,o,c,from=.6){r.body.add(M(new THREE.SphereGeometry(1.025,56,32,0,Math.PI*2,Math.PI*from,Math.PI*(1-from)),mat(c,{roughness:.5}),null,[o.sx,o.sy,o.sz]))}
function glasses(parent,ex,ey,ez,rr,c='#1b1b1f'){const m=mat(c,{roughness:.3});[-ex,ex].forEach(x=>parent.add(M(new THREE.TorusGeometry(rr,.035,10,36),m,[x,ey,ez])));
 parent.add(M(new THREE.CylinderGeometry(.025,.025,ex*2-rr*2,8),m,[0,ey+.02,ez],null,[0,0,Math.PI/2]))}
function tie(r,y,z,c='#d93a3a'){const m=mat(c);r.body.add(M(SPH(.075,16,12),m,[0,y,z+.03],[1,.8,.6]));
 r.body.add(M(new THREE.ConeGeometry(.12,.42,4),m,[0,y-.26,z-.02],[1,1,.35],[Math.PI-.12,0,Math.PI/4]))
 const w=matte('#ffffff');[-1,1].forEach(s=>r.body.add(M(new THREE.BoxGeometry(.2,.07,.05),w,[s*.13,y+.03,z-.03],null,[0,0,s*.55])))}

const B={
 mochi:()=>{const r=rig('#ff7a59');r.body.add(M(SPH(1,64,48),r.skin(0),null,[1.08,.9,1]));
  eye(r,r.body,-.34,.12,.78,.2);eye(r,r.body,.34,.12,.78,.2);cheeks(r,r.body,[[-.58,-.12,.86],[.58,-.12,.86]]);mouth(r,r.body,0,-.1,.965);
  feet(r,[[-.45,-.85,.15],[.45,-.85,.15]]);
  const sp=new THREE.Group();sp.position.set(0,.84,0);r.body.add(sp);r.sway=sp;
  sp.add(M(new THREE.CylinderGeometry(.03,.03,.35,12),mat('#2f8f4f'),[0,.16,0]));sp.add(M(SPH(.2,24,16),mat('#3fbf6f'),[.2,.34,0],[1.6,.35,.8],[0,0,.4]));return r},
 blob:()=>{const r=rig('#ff5a4a');const pts=[];for(let i=40;i>=0;i--){const t=Math.PI*i/40;pts.push([Math.max(.0001,1.3*Math.sin(t)*Math.sin(t/2)),1.15*Math.cos(t)])}
  r.body.add(lathe(pts,r.skin(0)));eye(r,r.body,-.3,-.25,.79,.19);eye(r,r.body,.3,-.25,.79,.19);mouth(r,r.body,0,-.58,.95);cheeks(r,r.body,[[-.55,-.45,.78],[.55,-.45,.78]]);r.float=true;return r},
 fuzz:()=>{const r=rig('#ffc22e');r.body.add(M(SPH(.92,48,32),r.skin(0)));const fm=r.skin(.06),cg=new THREE.ConeGeometry(.13,.34,8);const N=120;
  for(let i=0;i<N;i++){const y=1-2*(i+.5)/N,rr=Math.sqrt(1-y*y),a=i*2.39996;const d=new THREE.Vector3(Math.cos(a)*rr,y,Math.sin(a)*rr);if(d.z>.5&&d.y>-.55&&d.y<.6)continue;
   const c=new THREE.Mesh(cg,fm);c.position.copy(d.clone().multiplyScalar(.98));c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);r.body.add(c)}
  eye(r,r.body,0,.15,.62,.34);mouth(r,r.body,0,-.36,.84,1.3);feet(r,[[-.35,-.95,.1],[.35,-.95,.1]],mat('#c98a00'));return r},
 boo:()=>{const r=rig('#4fd1a0');const m=r.skin(0,{side:THREE.DoubleSide});r.body.add(M(new THREE.SphereGeometry(.85,48,24,0,Math.PI*2,0,Math.PI/2),m,[0,.25,0]));
  const cy=new THREE.CylinderGeometry(.85,.88,1.15,48,6,true);const p=cy.attributes.position;for(let i=0;i<p.count;i++){if(p.getY(i)<-.5){const a=Math.atan2(p.getX(i),p.getZ(i));p.setY(i,p.getY(i)+Math.sin(a*7)*.09)}}cy.computeVertexNormals();
  r.body.add(M(cy,m,[0,-.325,0]));eye(r,r.body,-.25,.32,.8,.12,'dot');eye(r,r.body,.25,.32,.8,.12,'dot');mouth(r,r.body,0,.02,.86);cheeks(r,r.body,[[-.45,.08,.72],[.45,.08,.72]],'#9a8f8a');r.float=true;return r},
 pip:()=>{const r=rig('#4a86f5');r.body.add(M(SPH(1,64,48),r.skin(0)));eye(r,r.body,0,.15,.66,.36);mouth(r,r.body,0,-.45,.88,1.3);
  const sp=new THREE.Group();sp.position.set(0,.78,0);r.body.add(sp);r.sway=sp;const am=r.skin(-.5);
  [-1,1].forEach(s=>{sp.add(tube([[s*.2,0,0],[s*.33,.38,0],[s*.55,.7,0]],.035,am));sp.add(M(SPH(.11,20,14),mat('#ffb000'),[s*.55,.72,0]))});feet(r,[[-.4,-.9,.15],[.4,-.9,.15]]);return r},
 tako:()=>{const r=rig('#e84393');r.body.add(M(SPH(1,64,48),r.skin(0),[0,.25,0],[1,1.05,.95]));eye(r,r.body,-.33,.32,.76,.21);eye(r,r.body,.33,.32,.76,.21);mouth(r,r.body,0,0,.96,.8);
  const tg=new THREE.Group();r.body.add(tg);r.sway=tg;const tm=r.skin(0);
  for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2+.3,pts=[];for(let k=0;k<=8;k++){const t=k/8;pts.push([Math.cos(a)*(.55+t*.55),-.45-t*.55+Math.sin(t*3+i)*.08,Math.sin(a)*(.5+t*.5)+.15])}
   tg.add(tube(pts,.13,tm));tg.add(M(SPH(.13,16,12),tm,pts[8]))}r.float=true;return r},
 rex:()=>{const r=rig('#3fbf6f');r.body.add(M(new THREE.CapsuleGeometry(.75,.7,16,48),r.skin(0)));r.body.add(M(SPH(.62,40,30),mat('#c9f2d6',{clearcoat:.4}),[0,-.25,.52],[.9,1.05,.45]));
  eye(r,r.body,-.28,.45,.6,.19);eye(r,r.body,.28,.45,.6,.19);mouth(r,r.body,0,.18,.74,1.2);
  for(let i=0;i<5;i++){const a=-.9+i*.45;r.body.add(M(new THREE.ConeGeometry(.16,.32,20),mat('#ffb000'),[0,.95*Math.cos(a)+.15,-.55*Math.sin(Math.abs(a))-.15],null,[-.6+i*.05,0,0]))}
  [-.78,.78].forEach(x=>r.body.add(M(new THREE.CapsuleGeometry(.11,.25,8,16),r.skin(-.1),[x,-.15,.25],null,[0,0,x>0?-.7:.7])));feet(r,[[-.38,-1.08,.12],[.38,-1.08,.12]]);return r},
 byte:()=>{const r=rig('#e9edf2');r.body.add(new THREE.Mesh(new RoundedBoxGeometry(2,1.6,1.4,8,.42),r.skin(0,{roughness:.25})));
  r.body.add(M(new RoundedBoxGeometry(1.55,1.05,.1,6,.22),mat('#14181f',{roughness:.12}),[0,0,.68]));eye(r,r.body,-.35,.08,.75,.2,'screen');eye(r,r.body,.35,.08,.75,.2,'screen');mouth(r,r.body,0,-.22,.75,1.6,'#5ee0ff',true);
  [-1.05,1.05].forEach(x=>r.body.add(M(new THREE.CylinderGeometry(.18,.18,.2,24),mat('#2f6fe8'),[x,0,0],null,[0,0,Math.PI/2])));
  const sp=new THREE.Group();sp.position.set(0,.8,0);r.body.add(sp);r.sway=sp;sp.add(M(new THREE.CylinderGeometry(.04,.04,.45,12),mat('#9aa3ad'),[0,.22,0]));sp.add(M(SPH(.13,24,16),mat('#ff5a36'),[0,.48,0]));r.float=true;return r},
 toro:()=>{const r=rig('#d8453a');r.body.add(M(SPH(1,64,48),r.skin(0),null,[1.05,.95,1]));
  r.body.add(M(SPH(.55,40,28),mat('#f2a49a'),[0,-.32,.7],[1.15,.75,.6]));[-.17,.17].forEach(x=>r.body.add(M(SPH(.07,16,12),mat('#5a1408'),[x,-.28,1.0],[1,1.3,.5])));
  r.body.add(M(new THREE.TorusGeometry(.13,.03,10,28),mat('#e8b23a',{metalness:.6,roughness:.25}),[0,-.5,1.0]));
  const hm=mat('#f3e2c0');[-1,1].forEach(s=>{r.body.add(M(new THREE.ConeGeometry(.13,.65,20),hm,[s*.88,.62,0],null,[0,0,-s*1.05]));r.body.add(M(SPH(.18,20,14),r.skin(-.15),[s*1.0,.22,0],[1.4,.6,.6]))});
  eye(r,r.body,-.33,.25,.72,.19);eye(r,r.body,.33,.25,.72,.19);
  const bm=mat('#3a1010');[-1,1].forEach(s=>r.body.add(M(new THREE.BoxGeometry(.26,.06,.05),bm,[s*.33,.5,.82],null,[0,0,s*.3])));
  mouth(r,r.body,0,-.68,.9,.9);feet(r,[[-.42,-.86,.12],[.42,-.86,.12]],mat('#3a2a22'));return r},
 hoot:()=>{const r=rig('#2fae7d');r.body.add(M(SPH(1,64,48),r.skin(0),null,[1,1.08,.95]));r.body.add(M(SPH(.7,40,28),r.skin(.6),[0,-.3,.6],[1,1.05,.5]));
  [-1,1].forEach(s=>r.body.add(M(new THREE.ConeGeometry(.2,.5,16),r.skin(-.35),[s*.58,.98,0],null,[0,0,-s*.45])));
  eye(r,r.body,-.33,.25,.66,.25);eye(r,r.body,.33,.25,.66,.25);glasses(r.body,.33,.25,.9,.3);
  r.body.add(M(new THREE.ConeGeometry(.09,.24,16),mat('#f5a623'),[0,.02,.95],null,[Math.PI/2+.4,0,0]));mouth(r,r.body,0,-.14,.93,.7);
  feet(r,[[-.35,-.97,.12],[.35,-.97,.12]],mat('#f5a623'));return r},
 // office crew
 clip:()=>{const r=rig('#8cc8ff');const o=bean(r);glasses(r.body,.3,.2,.86,.22);tie(r,-.42,.8);return r},
 boss:()=>{const r=rig('#ffcf6b');const o=bean(r,{my:-.25});const navy=mat('#1f2a44',{roughness:.45});
  r.body.add(M(new THREE.SphereGeometry(1.025,56,32,0,Math.PI*2,Math.PI*.6,Math.PI*.4),navy,null,[o.sx,o.sy,o.sz]));tie(r,-.48,.74,'#c62828');
  const mu=mat('#5b3a1e',{roughness:.6});[-1,1].forEach(s=>r.body.add(M(new THREE.CapsuleGeometry(.05,.16,6,12),mu,[s*.11,-.1,.88],null,[0,0,s*1.2])));
  const bw=mat('#3b2614');[-1,1].forEach(s=>r.body.add(M(new THREE.BoxGeometry(.24,.06,.05),bw,[s*.3,.46,.78],null,[0,0,-s*.12])));return r},
 tech:()=>{const r=rig('#9be26a');bean(r);const k=mat('#22252b',{roughness:.4});
  r.body.add(M(new THREE.TorusGeometry(.97,.05,12,48,Math.PI),k,[0,.05,0]));[-1,1].forEach(s=>r.body.add(M(new THREE.CylinderGeometry(.2,.2,.16,24),k,[s*.97,.05,0],null,[0,0,Math.PI/2])));
  r.body.add(tube([[-.95,-.05,.15],[-.8,-.35,.55],[-.38,-.42,.85]],.025,k));r.body.add(M(SPH(.07,16,12),k,[-.36,-.42,.86]));return r},
 hardy:()=>{const r=rig('#ffb38a');const o=bean(r,{ey:.12,my:-.25});const y=mat('#ffc400',{roughness:.3});
  r.body.add(M(new THREE.SphereGeometry(.82,48,24,0,Math.PI*2,0,Math.PI/2),y,[0,.62,0],[1.18,1,1.1]));r.body.add(M(new THREE.CylinderGeometry(1.08,1.08,.05,48),y,[0,.62,.08],[1,1,1.05]));
  r.body.add(M(new THREE.BoxGeometry(.14,.1,1.5),y,[0,1.42,0],null,[0,0,0]));
  r.body.add(M(new THREE.SphereGeometry(1.03,56,32,0,Math.PI*2,Math.PI*.62,Math.PI*.38),matte('#ff7a1a'),null,[o.sx,o.sy,o.sz]));
  r.body.add(M(new THREE.TorusGeometry(.6,.035,8,48),matte('#e9eef2'),[0,-.62,0],[1,.86,1],[Math.PI/2,0,0]));return r},
 // magic crew
 merlo:()=>{const r=rig('#4f7be8');bean(r,{my:-.12});const hm=r.skin(-.4);
  r.body.add(M(new THREE.CylinderGeometry(1.02,1.02,.06,48),hm,[0,.82,0]));const hat=M(new THREE.ConeGeometry(.72,1.5,48),hm,[0,1.58,0],null,[0,0,.12]);r.body.add(hat);
  const gold=mat('#f2c230',{metalness:.3});[[.18,1.25,.55],[-.25,1.6,.4],[.12,1.95,.25]].forEach(p=>r.body.add(M(new THREE.OctahedronGeometry(.09),gold,p)));
  r.body.add(M(new THREE.ConeGeometry(.42,.85,32),matte('#f4f4f4'),[0,-.68,.72],[1,1,.5],[Math.PI+.25,0,0]));
  const wb=matte('#f4f4f4');[-1,1].forEach(s=>r.body.add(M(new THREE.BoxGeometry(.24,.07,.05),wb,[s*.3,.44,.8],null,[0,0,-s*.15])));return r},
 sage:()=>{const r=rig('#c98a4b');bean(r,{matte:false});const wpaint=matte('#ffffff');
  [-1,1].forEach(s=>[0,1].forEach(k=>r.body.add(M(new THREE.BoxGeometry(.2,.035,.03),wpaint,[s*(.5+k*.02),-.08-k*.09,zOn(.5,-.1,.95,1.05,.9)+.005],null,[0,s*.5,0]))));
  r.body.add(M(new THREE.TorusGeometry(.72,.06,10,48),mat('#1fb5a3'),[0,.66,0],[1.05,1,1],[Math.PI/2,0,0]));
  const fc=['#e2452b','#ffb000','#1fb5a3','#ffb000','#e2452b'],fg=new THREE.Group();fg.position.set(0,.8,0);r.body.add(fg);r.sway=fg;
  fc.forEach((c,i)=>{const a=(i-2)*.38;const f=M(SPH(.12,20,14),matte(c),[Math.sin(a)*.5,.3+Math.cos(a)*.1,.25-Math.abs(a)*.15],[1,4,.3],[0,0,-a*.9]);fg.add(f)});
  const bc=['#e2452b','#f4f4f4','#1fb5a3'];for(let i=0;i<14;i++){const a=Math.PI*(.15+.7*i/13);r.body.add(M(SPH(.07,14,10),mat(bc[i%3]),[Math.cos(a)*-.72,-.55-Math.sin(a)*.12,Math.sin(a)*.66+.02]))}return r},
 fae:()=>{const r=rig('#ff9ccf');bean(r,{float:true});const wm=mat('#e6f6ff',{transparent:true,opacity:.6,roughness:.1,side:THREE.DoubleSide});
  [-1,1].forEach(s=>{const g=new THREE.Group();g.position.set(s*.45,.3,-.6);const w1=M(SPH(.5,32,20),wm,[s*.45,.25,0],[.55,1,.06],[0,0,-s*.5]);const w2=M(SPH(.32,32,20),wm,[s*.38,-.35,0],[.6,1,.06],[0,0,s*.6]);g.add(w1,w2);r.body.add(g);r.flap.push([g,s])});
  const sp=new THREE.Group();sp.position.set(0,.9,0);r.body.add(sp);r.sway=sp;const am=r.skin(-.4);
  [-1,1].forEach(s=>{sp.add(tube([[s*.15,0,.1],[s*.25,.3,.15],[s*.35,.55,.1]],.025,am));sp.add(M(new THREE.OctahedronGeometry(.1),mat('#ffd84a',{metalness:.2}),[s*.36,.6,.1]))});return r},
 genie:()=>{const r=rig('#2bb8a8');const o=bean(r,{float:true,my:-.2});
  r.body.add(M(new THREE.ConeGeometry(.55,1.0,32),r.skin(-.08),[.15,-1.15,0],null,[0,0,Math.PI+.35]));
  r.body.add(M(SPH(.2,24,16),r.skin(-.3),[0,1.08,0]));r.body.add(M(new THREE.CylinderGeometry(.22,.22,.08,24),mat('#f2c230',{metalness:.4}),[0,.96,0]));
  r.body.add(M(new THREE.TorusGeometry(.1,.025,8,24),mat('#f2c230',{metalness:.5,roughness:.2}),[.93,-.12,.05],null,[0,Math.PI/2,0]));
  const mu=mat('#1d1d22');[-1,1].forEach(s=>r.body.add(M(new THREE.CapsuleGeometry(.04,.2,6,12),mu,[s*.14,-.06,.86],null,[0,0,s*1.3])));return r},
 // business crew
 mega:()=>{const r=rig('#ff6b4a');bean(r);hand(r,.88,-.15,.4);const w=matte('#ffffff'),o=mat('#ff8a1f');
  const mg=new THREE.Group();mg.position.set(1.05,.0,.45);mg.rotation.set(0,-.5,-.35);r.body.add(mg);
  mg.add(M(new THREE.CylinderGeometry(.09,.3,.55,32,1,true),mat('#ffffff',{side:THREE.DoubleSide}),[0,.28,0]));mg.add(M(new THREE.TorusGeometry(.3,.03,8,32),o,[0,.56,0],null,[Math.PI/2,0,0]));mg.add(M(new THREE.CylinderGeometry(.1,.1,.12,20),o,[0,-.02,0]));
  const sw=new THREE.Group();sw.position.set(1.25,.45,.6);r.body.add(sw);r.sway=sw;[0,1,2].forEach(i=>sw.add(M(new THREE.TorusGeometry(.12+i*.1,.022,8,24,Math.PI*.7),o,[i*.05,i*.06,0],null,[0,0,-.6])));return r},
 pixel:()=>{const r=rig('#e84393');bean(r);hand(r,.85,-.1,.35);
  const sg=new THREE.Group();sg.position.set(.95,-.05,.35);r.body.add(sg);r.sway=sg;sg.add(M(new THREE.CylinderGeometry(.03,.03,1.1,10),mat('#8a6a4a',{roughness:.6}),[0,.5,0]));
  const bd=new THREE.Group();bd.position.set(0,1.15,0);sg.add(bd);['#e2452b','#ffffff','#e2452b','#ffffff','#e2452b'].forEach((c,i)=>bd.add(M(new THREE.CylinderGeometry(.34-i*.068,.34-i*.068,.04+i*.012,40),matte(c),[0,0,0],null,[Math.PI/2,0,0])));
  return r},
 buzz:()=>{const r=rig('#2fb5c8');bean(r);hand(r,.82,-.2,.45);
  r.body.add(M(new RoundedBoxGeometry(.38,.66,.06,4,.06),mat('#1d1d22',{roughness:.2}),[.92,.0,.5],null,[0,-.4,-.15]));r.body.add(M(new RoundedBoxGeometry(.32,.56,.02,4,.04),basic('#ffd84a'),[.935,.0,.535],null,[0,-.4,-.15]));
  const ht=new THREE.Group();ht.position.set(-.6,1.15,.3);r.body.add(ht);r.sway=ht;const hm=mat('#ff3b5c');ht.add(M(SPH(.13,24,16),hm,[-.09,0,0]));ht.add(M(SPH(.13,24,16),hm,[.09,0,0]));ht.add(M(new THREE.ConeGeometry(.18,.24,24),hm,[0,-.14,0],null,[Math.PI,0,0]));return r},
 deal:()=>{const r=rig('#4a86f5');bean(r);tie(r,-.42,.8,'#ffb000');hand(r,.82,-.55,.3);
  const bc=new THREE.Group();bc.position.set(1.0,-.75,.25);r.body.add(bc);bc.add(new THREE.Mesh(new RoundedBoxGeometry(.6,.42,.18,4,.05),mat('#7a4a2a',{roughness:.45})));bc.add(M(new THREE.TorusGeometry(.1,.025,8,20,Math.PI),mat('#3a2414'),[0,.22,0]));bc.add(M(new THREE.BoxGeometry(.08,.05,.02),mat('#f2c230',{metalness:.5}),[0,.08,.1]));
  r.body.add(M(SPH(.62,32,16,0,Math.PI*2,0,Math.PI*.3),mat('#4a2e1a',{roughness:.55}),[0,.42,0],[1.4,1.2,1.3]));return r},
 cash:()=>{const r=rig('#3fbf6f');bean(r,{ey:.15});const g=mat('#1f9a5a',{transparent:true,opacity:.85});
  r.body.add(M(new THREE.TorusGeometry(.86,.05,8,48),mat('#1d1d22'),[0,.52,0],[1,.95,1],[Math.PI/2,0,0]));r.body.add(M(new THREE.CylinderGeometry(.6,.6,.03,32,1,false,-Math.PI*.5,Math.PI),g,[0,.5,.5],[1,1,1.1]));
  hand(r,.6,-.55,.6);const cl=new THREE.Group();cl.position.set(.45,-.55,.85);cl.rotation.set(-.5,-.2,0);r.body.add(cl);cl.add(new THREE.Mesh(new RoundedBoxGeometry(.42,.56,.08,4,.05),mat('#e9edf2')));
  cl.add(M(new THREE.BoxGeometry(.32,.12,.02),basic('#9ee6b8'),[0,.16,.045]));for(let i=0;i<3;i++)for(let j=0;j<3;j++)cl.add(M(new THREE.BoxGeometry(.08,.06,.03),mat(i===2&&j===2?'#ff8a1f':'#3a3f48'),[-.1+j*.1,-.02-i*.1,.045]));return r},
 ink:()=>{const r=rig('#ffc22e');bean(r);glasses(r.body,.3,.2,.86,.21);hand(r,.85,-.1,.4);
  const pc=new THREE.Group();pc.position.set(1.0,.1,.4);pc.rotation.z=-.5;r.body.add(pc);r.sway=pc;pc.add(M(new THREE.CylinderGeometry(.07,.07,.9,6),mat('#ffb000'),[0,0,0]));pc.add(M(new THREE.ConeGeometry(.07,.18,6),mat('#f3d6a8',{roughness:.6}),[0,-.54,0],null,[Math.PI,0,0]));
  pc.add(M(new THREE.ConeGeometry(.025,.06,6),mat('#2a2a2e'),[0,-.62,0],null,[Math.PI,0,0]));pc.add(M(new THREE.CylinderGeometry(.075,.075,.08,12),mat('#b0b5bd',{metalness:.5}),[0,.48,0]));pc.add(M(new THREE.CylinderGeometry(.07,.07,.1,12),mat('#ff8fa3'),[0,.57,0]));return r},
 arty:()=>{const r=rig('#ff9ccf');bean(r);const be=mat('#d93a3a',{roughness:.6});r.body.add(M(SPH(.62,32,20),be,[.12,.95,0],[1.25,.38,1.15],[0,0,-.2]));r.body.add(M(new THREE.CylinderGeometry(.03,.03,.12,8),be,[.1,1.18,0]));
  hand(r,-.85,-.25,.4);const pl=new THREE.Group();pl.position.set(-.95,-.3,.45);pl.rotation.set(1.1,0,.3);r.body.add(pl);pl.add(M(SPH(.36,32,16),matte('#e6c79a'),null,[1.2,1,.12]));
  ['#e2452b','#ffb000','#3fbf6f','#4a86f5','#ffffff'].forEach((c,i)=>{const a=i/5*Math.PI*1.4-.3;pl.add(M(SPH(.06,12,10),mat(c),[Math.cos(a)*.26,Math.sin(a)*.2,.04],[1,1,.4]))});
  const br=new THREE.Group();br.position.set(.95,.05,.4);br.rotation.z=-.7;r.body.add(br);r.sway=br;hand(r,.85,-.1,.4);br.add(M(new THREE.CylinderGeometry(.03,.03,.7,8),mat('#8a6a4a'),[0,0,0]));br.add(M(new THREE.ConeGeometry(.06,.16,10),mat('#4a86f5'),[0,.42,0]));return r},
 plan:()=>{const r=rig('#2fae7d');bean(r);hand(r,-.62,-.5,.6);
  const cb=new THREE.Group();cb.position.set(-.48,-.42,.85);cb.rotation.set(-.35,.25,.12);r.body.add(cb);cb.add(new THREE.Mesh(new RoundedBoxGeometry(.5,.66,.05,3,.03),mat('#a0754a',{roughness:.5})));
  cb.add(M(new THREE.BoxGeometry(.42,.54,.01),matte('#ffffff'),[0,-.03,.03]));cb.add(M(new THREE.BoxGeometry(.2,.08,.05),mat('#b0b5bd',{metalness:.6}),[0,.32,.03]));
  for(let i=0;i<4;i++){cb.add(M(new THREE.BoxGeometry(.05,.05,.01),basic(i<2?'#1d9e6a':'#c8ccd2'),[-.14,.13-i*.12,.04]));cb.add(M(new THREE.BoxGeometry(.22,.025,.01),basic('#c8ccd2'),[.04,.13-i*.12,.04]))}
  r.body.add(M(SPH(.08,12,10),mat('#1d1d22'),[.93,.1,.15]));return r},
 pony:()=>{const r=rig('#9a5a2e');r.body.add(M(SPH(1,56,40),r.skin(0),null,[.85,1.12,.88]));
  r.body.add(M(SPH(.62,40,28),r.skin(.22),[0,-.55,.5],[.9,.6,.75]));[-.17,.17].forEach(x=>r.body.add(M(SPH(.075,14,10),mat('#2a1a12'),[x,-.48,.95],[1,1.4,.5])));
  const mn=r.skin(-.62);[-1,1].forEach(s=>{r.body.add(M(new THREE.ConeGeometry(.16,.55,20),r.skin(0),[s*.36,1.12,-.08],null,[0,0,-s*.22]));r.body.add(M(new THREE.ConeGeometry(.08,.34,14),matte('#f0c9b8'),[s*.35,1.08,.03],null,[0,0,-s*.22]))});
  for(let k=0;k<6;k++){const t=k/5;r.body.add(M(SPH(.21,20,14),mn,[.18+.62*t,1.02-.95*t,-.28],[.8,1,.9]))}
  const fl=new THREE.Group();fl.position.set(0,1.0,.45);r.body.add(fl);r.sway=fl;fl.add(M(SPH(.16,20,14),mn,[.07,-.12,.12],[.75,1.5,.55],[0,0,-.35]));fl.add(M(SPH(.14,20,14),mn,[-.08,-.08,.1],[.75,1.4,.55],[0,0,.35]));
  r.body.add(M(new THREE.OctahedronGeometry(.1),matte('#ffffff'),[0,.58,.75],[1,1.5,.4]));
  eye(r,r.body,-.36,.3,.67,.17);eye(r,r.body,.36,.3,.67,.17);mouth(r,r.body,0,-.75,.87,.9);
  feet(r,[[-.38,-1.0,.12],[.38,-1.0,.12]],mat('#2a2a2e'));return r},
 // stable crew: cute horse people (body color = skin tone)
 coach:()=>{const r=rig('#e0ac82');const o=bean(r,{my:-.22,feetMat:mat('#5a3a22')});shirt(r,o,'#3b6fb5');
  const hm=mat('#8a5a35',{roughness:.55});r.body.add(M(new THREE.CylinderGeometry(1.25,1.25,.05,48),hm,[0,.72,0],[1,1,.85]));r.body.add(M(new RoundedBoxGeometry(1.1,.55,.95,4,.2),hm,[0,1.0,-.02]));r.body.add(M(new THREE.CylinderGeometry(.57,.57,.1,32),mat('#3a2414'),[0,.78,0],[1,1,.85]));
  const mu=mat('#5b3a1e',{roughness:.6});[-1,1].forEach(s=>r.body.add(M(new THREE.CapsuleGeometry(.05,.16,6,12),mu,[s*.11,-.08,.88],null,[0,0,s*1.2])));
  hand(r,.85,-.25,.4);const sw=new THREE.Group();sw.position.set(.98,-.18,.5);r.body.add(sw);r.sway=sw;sw.add(M(new THREE.CylinderGeometry(.17,.17,.07,28),mat('#c8ccd2',{metalness:.6,roughness:.25}),null,null,[Math.PI/2,0,0]));
  sw.add(M(new THREE.CircleGeometry(.14,28),basic('#ffffff'),[0,0,.036]));sw.add(M(new THREE.BoxGeometry(.015,.1,.01),basic('#e2452b'),[.02,.03,.04],null,[0,0,-.4]));sw.add(M(new THREE.CylinderGeometry(.04,.04,.07,12),mat('#c8ccd2',{metalness:.6}),[0,.2,0]));return r},
 jockey:()=>{const r=rig('#c98a5e');const o=bean(r,{my:-.2,feetMat:mat('#1d1d22')});const sk=mat('#e2452b'),wt=mat('#ffffff');shirt(r,o,'#e2452b');
  [[-.35,-.55],[.35,-.55],[0,-.78]].forEach(([x,y])=>r.body.add(M(new THREE.OctahedronGeometry(.1),wt,[x,y,zOn(x,y,o.sx,o.sy,o.sz)+.02],[1,1.3,.3])));
  r.body.add(M(new THREE.SphereGeometry(.9,48,24,0,Math.PI*2,0,Math.PI*.5),sk,[0,.42,0],[1.08,1.05,1.02]));r.body.add(M(new THREE.SphereGeometry(.9,48,24,0,Math.PI*2,0,Math.PI*.5),wt,[0,.425,0],[.25,1.06,1.03]));
  r.body.add(M(new THREE.CylinderGeometry(.42,.42,.04,32,1,false,-Math.PI*.5,Math.PI),mat('#1d1d22'),[0,.46,.7],[1,1,.7]));
  const gm=mat('#1d1d22');[-.22,.22].forEach(x=>r.body.add(M(new THREE.TorusGeometry(.13,.035,8,24),gm,[x,1.0,.55],null,[-.5,0,0])));r.body.add(M(new THREE.TorusGeometry(.98,.025,8,48),gm,[0,.9,0],null,[Math.PI/2,0,0]));
  hand(r,.85,-.3,.4);const wh=new THREE.Group();wh.position.set(.92,-.25,.45);wh.rotation.z=-.6;r.body.add(wh);r.sway=wh;wh.add(M(new THREE.CylinderGeometry(.02,.012,1.0,8),mat('#1d1d22'),[0,.45,0]));wh.add(M(new THREE.BoxGeometry(.06,.12,.02),mat('#1d1d22'),[0,.98,0]));return r},
 groom:()=>{const r=rig('#8d5a3b');const o=bean(r,{my:-.2,feetMat:mat('#3a3a3a')});shirt(r,o,'#3f9a5a');
  const cp=mat('#ffb000',{roughness:.5});r.body.add(M(new THREE.SphereGeometry(.92,48,24,0,Math.PI*2,0,Math.PI*.45),cp,[0,.45,0],[1.05,1,1]));r.body.add(M(new THREE.CylinderGeometry(.45,.45,.04,32,1,false,-Math.PI*.5,Math.PI),cp,[0,.68,.62],[1,1,.9],[.15,0,0]));
  hand(r,-.85,-.3,.4);const br=new THREE.Group();br.position.set(-.95,-.3,.5);br.rotation.set(.2,0,.4);r.body.add(br);r.sway=br;br.add(new THREE.Mesh(new RoundedBoxGeometry(.42,.16,.24,3,.06),mat('#8a5a35',{roughness:.5})));
  for(let i=0;i<5;i++)br.add(M(new THREE.BoxGeometry(.05,.1,.18),matte('#e9d8b0'),[-.16+i*.08,-.12,0]));
  r.body.add(M(new THREE.CylinderGeometry(.28,.24,.4,24),mat('#4a86f5',{roughness:.4}),[.95,-.7,.2]));r.body.add(M(new THREE.TorusGeometry(.27,.02,8,24,Math.PI),mat('#6b7078'),[.95,-.5,.2]));return r},
 doc:()=>{const r=rig('#e3b08a');const o=bean(r,{my:-.2,feetMat:mat('#2a2a2e')});shirt(r,o,'#eaf2f8',.6);
  r.body.add(M(new THREE.SphereGeometry(1.0,48,24,0,Math.PI*2,0,Math.PI*.3),mat('#5b3a1e',{roughness:.6}),[0,.05,0],[o.sx*1.02,o.sy*1.02,o.sz*1.02]));
  glasses(r.body,.3,.2,.9,.2,'#2f6fe8');const st=mat('#2a2a2e',{roughness:.4});r.body.add(tube([[-.42,-.45,.62],[-.2,-.7,.78],[0,-.62,.85],[.2,-.7,.78],[.42,-.45,.62]],.03,st));
  r.body.add(tube([[.1,-.66,.84],[.15,-.85,.82],[.1,-.98,.72]],.025,st));r.body.add(M(new THREE.CylinderGeometry(.08,.08,.04,20),mat('#c8ccd2',{metalness:.6}),[.1,-1.0,.7],null,[Math.PI/2,0,0]));
  r.body.add(M(new THREE.BoxGeometry(.18,.18,.03),basic('#e2452b'),[-.4,-.5,.72],null,[0,-.4,0]));r.body.add(M(new THREE.BoxGeometry(.06,.14,.035),basic('#ffffff'),[-.4,-.5,.735],null,[0,-.4,0]));r.body.add(M(new THREE.BoxGeometry(.14,.06,.035),basic('#ffffff'),[-.4,-.5,.735],null,[0,-.4,0]));return r},
 smith:()=>{const r=rig('#b07a55');const o=bean(r,{my:-.2,feetMat:mat('#3a2414')});shirt(r,o,'#5b6470');
  r.body.add(M(new THREE.SphereGeometry(1.03,48,24,-Math.PI*.35,Math.PI*.7,Math.PI*.55,Math.PI*.45),mat('#7a4a2a',{roughness:.6,side:THREE.DoubleSide}),null,[o.sx,o.sy,o.sz]));
  r.body.add(M(new THREE.TorusGeometry(.98,.07,10,48),mat('#e2452b',{roughness:.6}),[0,.62,0],[.98,1,.95],[Math.PI/2,0,0]));
  const mu=mat('#2a1a10',{roughness:.7});[-1,1].forEach(s=>r.body.add(M(new THREE.CapsuleGeometry(.05,.16,6,12),mu,[s*.11,-.08,.88],null,[0,0,s*1.2])));
  hand(r,.85,-.3,.4);const hm=new THREE.Group();hm.position.set(.95,-.25,.45);hm.rotation.z=-.5;r.body.add(hm);r.sway=hm;hm.add(M(new THREE.CylinderGeometry(.035,.035,.7,10),mat('#8a6a4a'),[0,.3,0]));hm.add(M(new THREE.BoxGeometry(.32,.12,.12),mat('#6b7078',{metalness:.6,roughness:.3}),[0,.68,0]));
  r.body.add(M(new THREE.TorusGeometry(.18,.05,8,24,Math.PI*1.2),mat('#9aa3ad',{metalness:.6}),[-.95,-.62,.25],null,[0,0,-.3]));return r},
 owner:()=>{const r=rig('#e8b48f');const o=bean(r,{my:-.22,feetMat:mat('#1d1d22')});shirt(r,o,'#1f2a44');tie(r,-.44,.78,'#f2c230');
  const hm=mat('#d8c39a',{roughness:.6});r.body.add(M(new THREE.CylinderGeometry(1.15,1.15,.05,48),hm,[0,.74,0],[1,1,.9]));r.body.add(M(new THREE.CylinderGeometry(.58,.64,.5,32),hm,[0,.98,0],[1,1,.9]));r.body.add(M(new THREE.CylinderGeometry(.645,.645,.12,32),mat('#1d1d22'),[0,.8,0],[1,1,.9]));
    hand(r,.85,-.35,.4);r.body.add(M(new RoundedBoxGeometry(.4,.22,.06,3,.03),mat('#3fbf6f'),[.98,-.32,.5],null,[0,-.3,-.2]));return r},
 // business crew, gadget style: the tools themselves come alive
 horn:()=>{const r=rig('#ff6b4a');const sk=r.skin(0,{side:THREE.DoubleSide});r.body.add(M(new THREE.CylinderGeometry(.88,.38,1.75,56,1,true),sk));
  r.body.add(M(new THREE.CircleGeometry(.84,48),mat('#2a2a2e',{side:THREE.DoubleSide}),[0,.8,0],null,[-Math.PI/2,0,0]));const w=mat('#ffffff');
  r.body.add(M(new THREE.TorusGeometry(.88,.06,12,56),w,[0,.875,0],null,[Math.PI/2,0,0]));r.body.add(M(new THREE.TorusGeometry(.44,.05,12,40),w,[0,-.62,0],null,[Math.PI/2,0,0]));
  r.body.add(M(new THREE.CircleGeometry(.38,40),sk,[0,-.875,0],null,[Math.PI/2,0,0]));
  eye(r,r.body,-.22,.05,.55,.17);eye(r,r.body,.22,.05,.55,.17);mouth(r,r.body,0,-.3,.5);cheeks(r,r.body,[[-.38,-.12,.5],[.38,-.12,.5]]);
  const sw=new THREE.Group();sw.position.set(0,1.05,0);r.body.add(sw);r.sway=sw;[0,1,2].forEach(i=>sw.add(M(new THREE.TorusGeometry(.25+i*.16,.03,8,32,Math.PI*.6),mat('#ffb000'),[0,i*.12,0],null,[0,0,Math.PI*.2])));
  feet(r,[[-.3,-.95,.1],[.3,-.95,.1]],mat('#2a2a2e'));return r},
 target:()=>{const r=rig('#e2452b');const d=new THREE.Group();d.rotation.x=Math.PI/2;r.body.add(d);d.add(new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,.42,64),r.skin(-.15)));
  const rd=r.skin(0);[[.95,rd],[.76,matte('#ffffff')],[.57,rd],[.38,matte('#ffffff')],[.19,rd]].forEach(([rr,m],i)=>r.body.add(M(new THREE.CircleGeometry(rr,64),m,[0,0,.212+i*.003])));
  eye(r,r.body,-.3,.3,.26,.17);eye(r,r.body,.3,.3,.26,.17);mouth(r,r.body,0,-.47,.2);
  const ar=new THREE.Group();ar.position.set(.42,.38,.22);ar.rotation.set(-.5,.6,0);r.body.add(ar);r.sway=ar;ar.add(M(new THREE.CylinderGeometry(.03,.03,1.0,8),mat('#8a6a4a'),[0,0,.5],null,[Math.PI/2,0,0]));
  [0,1,2].forEach(i=>ar.add(M(new THREE.BoxGeometry(.02,.16,.22),mat('#ffb000'),[0,0,.95],null,[0,0,i*Math.PI/3])));feet(r,[[-.38,-1.0,0],[.38,-1.0,0]],mat('#2a2a2e'));return r},
 phone:()=>{const r=rig('#2fb5c8');r.body.add(new THREE.Mesh(new RoundedBoxGeometry(1.2,1.95,.24,6,.18),r.skin(0)));r.body.add(M(new RoundedBoxGeometry(1.04,1.75,.02,4,.12),basic('#f2f9ff'),[0,0,.12]));
  r.body.add(M(new THREE.CapsuleGeometry(.05,.22,6,12),basic('#1d1d22'),[0,.8,.135],null,[0,0,Math.PI/2]));
  eye(r,r.body,-.24,.35,.16,.11,'dot');eye(r,r.body,.24,.35,.16,.11,'dot');mouth(r,r.body,0,.08,.1,.9);cheeks(r,r.body,[[-.36,.18,.12],[.36,.18,.12]]);
  ['#e2452b','#ffb000','#3fbf6f','#4a86f5','#e84393','#2a2a2e'].forEach((c,i)=>r.body.add(M(new RoundedBoxGeometry(.22,.22,.03,3,.05),basic(c),[-.3+(i%3)*.3,-.35-Math.floor(i/3)*.3,.135])));
  const ht=new THREE.Group();ht.position.set(.62,1.0,.2);r.body.add(ht);r.sway=ht;const hm=mat('#ff3b5c');ht.add(M(SPH(.26,24,16),hm,null,[1,1,.5]));
  ht.add(M(SPH(.07,16,12),basic('#ffffff'),[-.035,.02,.12],[1,1,.4]));ht.add(M(SPH(.07,16,12),basic('#ffffff'),[.035,.02,.12],[1,1,.4]));ht.add(M(new THREE.ConeGeometry(.09,.1,16),basic('#ffffff'),[0,-.05,.12],[1,1,.4],[Math.PI,0,0]));
  feet(r,[[-.32,-1.02,0],[.32,-1.02,0]],mat('#2a2a2e'));return r},
 brief:()=>{const r=rig('#8a5a35');r.body.add(new THREE.Mesh(new RoundedBoxGeometry(1.95,1.35,.78,6,.14),r.skin(0,{roughness:.45})));r.body.add(M(new THREE.BoxGeometry(1.96,.05,.8),r.skin(-.35),[0,.25,0]));
  const g=mat('#f2c230',{metalness:.5,roughness:.25});[-.5,.5].forEach(x=>r.body.add(M(new THREE.BoxGeometry(.16,.14,.05),g,[x,.25,.4])));r.body.add(M(new THREE.TorusGeometry(.3,.07,12,24,Math.PI),mat('#3a2414'),[0,.68,0]));
  eye(r,r.body,-.32,-.08,.35,.17);eye(r,r.body,.32,-.08,.35,.17);mouth(r,r.body,0,-.38,.36);cheeks(r,r.body,[[-.6,-.25,.39],[.6,-.25,.39]]);feet(r,[[-.45,-.75,0],[.45,-.75,0]],mat('#2a2a2e'));return r},
 calc:()=>{const r=rig('#3fbf6f');r.body.add(new THREE.Mesh(new RoundedBoxGeometry(1.3,1.85,.42,6,.16),r.skin(0)));r.body.add(M(new RoundedBoxGeometry(1.06,.5,.04,4,.06),basic('#2a3a30'),[0,.55,.2]));r.body.add(M(new THREE.BoxGeometry(.96,.4,.01),basic('#bdf5cd'),[0,.55,.225]));
  eye(r,r.body,-.22,.6,.23,.1,'dot');eye(r,r.body,.22,.6,.23,.1,'dot');mouth(r,r.body,0,.44,.2,.8,'#1d3a2a',true);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)r.body.add(M(new RoundedBoxGeometry(.2,.16,.06,3,.04),mat(j===3?'#ff8a1f':i===3&&j===2?'#e2452b':'#f4f4f4'),[-.36+j*.24,.08-i*.22,.21]));
  feet(r,[[-.3,-1.0,0],[.3,-1.0,0]],mat('#2a2a2e'));return r},
 pencil:()=>{const r=rig('#ffc22e');const b=M(new THREE.CylinderGeometry(.5,.5,1.4,6),r.skin(0),null,null,[0,Math.PI/6,0]);r.body.add(b);
  r.body.add(M(new THREE.ConeGeometry(.5,.55,6),matte('#f3d6a8'),[0,.975,0],null,[0,Math.PI/6,0]));r.body.add(M(new THREE.ConeGeometry(.13,.15,6),mat('#2a2a2e'),[0,1.18,0],null,[0,Math.PI/6,0]));
  r.body.add(M(new THREE.CylinderGeometry(.51,.51,.16,24),mat('#b0b5bd',{metalness:.6,roughness:.3}),[0,-.78,0]));r.body.add(M(new THREE.CylinderGeometry(.5,.48,.22,24),mat('#ff8fa3'),[0,-.97,0]));
  eye(r,r.body,-.18,.15,.39,.14);eye(r,r.body,.18,.15,.39,.14);glasses(r.body,.18,.15,.47,.16);mouth(r,r.body,0,-.2,.41,.9);r.float=true;return r},
 bucket:()=>{const r=rig('#e84393');const mt=mat('#c8ccd2',{metalness:.55,roughness:.3});r.body.add(M(new THREE.CylinderGeometry(.82,.7,1.5,48),mt));r.body.add(M(new THREE.CylinderGeometry(.84,.75,.95,48),r.skin(0),[0,-.1,0]));
  r.body.add(M(new THREE.CircleGeometry(.8,40),r.skin(.15),[0,.76,0],null,[-Math.PI/2,0,0]));[[-.5,.3],[.1,.45],[.55,.25],[-.15,.2]].forEach(([x,h],i)=>{const z=Math.sqrt(Math.max(0,.82*.82-x*x));r.body.add(M(new THREE.CapsuleGeometry(.07,h,6,12),r.skin(.15),[x,.75-h/2,z]))});
  r.body.add(M(new THREE.TorusGeometry(.8,.025,8,40,Math.PI),mat('#6b7078',{metalness:.5}),[0,.75,0],null,[0,0,0]));
  eye(r,r.body,-.26,0,.68,.16);eye(r,r.body,.26,0,.68,.16);mouth(r,r.body,0,-.3,.7);
  const br=new THREE.Group();br.position.set(.3,.7,-.1);r.body.add(br);r.sway=br;br.add(M(new THREE.CylinderGeometry(.04,.04,.9,8),mat('#8a6a4a'),[0,.3,0],null,[0,0,-.35]));br.add(M(new THREE.ConeGeometry(.1,.25,12),r.skin(.15),[.27,.78,0],null,[0,0,-.35]));
  feet(r,[[-.32,-.85,.1],[.32,-.85,.1]],mat('#2a2a2e'));return r},
 cal:()=>{const r=rig('#e2452b');r.body.add(new THREE.Mesh(new RoundedBoxGeometry(1.6,1.75,.16,4,.08),matte('#ffffff')));r.body.add(M(new RoundedBoxGeometry(1.6,.46,.2,4,.08),r.skin(0),[0,.65,0]));
  const k=mat('#2a2a2e');[-.5,0,.5].forEach(x=>r.body.add(M(new THREE.TorusGeometry(.09,.025,8,20),k,[x,.88,0],null,[0,Math.PI/2,0])));
  const cv=document.createElement('canvas');cv.width=256;cv.height=96;const c=cv.getContext('2d');c.fillStyle='#fff';c.font='700 60px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('OCT',128,52);
  const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;r.body.add(M(new THREE.PlaneGeometry(.8,.3),new THREE.MeshBasicMaterial({map:tx,transparent:true}),[0,.65,.105]));
  for(let i=0;i<2;i++)for(let j=0;j<6;j++)r.body.add(M(new THREE.BoxGeometry(.13,.1,.01),basic(i===0&&j<3?'#3fbf6f':'#e3e5e8'),[-.55+j*.22,-.5-i*.17,.085]));
  eye(r,r.body,-.25,.12,.1,.13,'dot');eye(r,r.body,.25,.12,.1,.13,'dot');mouth(r,r.body,0,-.14,.06);cheeks(r,r.body,[[-.45,-.02,.08],[.45,-.02,.08]]);feet(r,[[-.38,-.98,0],[.38,-.98,0]],mat('#2a2a2e'));return r},
 // business crew, animal style
 fox:()=>{const r=rig('#ff7a1a');r.body.add(M(SPH(1,56,40),r.skin(0),null,[1,.95,.95]));const w=matte('#ffffff');r.body.add(M(SPH(.7,40,28),w,[0,-.35,.52],[1.05,.6,.62]));
  r.body.add(M(SPH(.09,16,12),mat('#1d1d22'),[0,-.2,.95],[1.2,.9,1]));[-1,1].forEach(s=>{r.body.add(M(new THREE.ConeGeometry(.3,.6,24),r.skin(0),[s*.52,.9,0],null,[0,0,-s*.35]));r.body.add(M(new THREE.ConeGeometry(.12,.22,16),mat('#2a2a2e'),[s*.64,1.18,0],null,[0,0,-s*.35]));r.body.add(M(new THREE.ConeGeometry(.16,.34,16),w,[s*.5,.86,.12],null,[0,0,-s*.35]))});
  eye(r,r.body,-.33,.18,.79,.17);eye(r,r.body,.33,.18,.79,.17);mouth(r,r.body,0,-.4,.88,.8);
  const tl=new THREE.Group();tl.position.set(.65,-.55,-.4);r.body.add(tl);r.sway=tl;tl.add(M(SPH(.42,32,20),r.skin(0),[.35,.3,0],[.75,1.25,.75],[0,0,-.6]));tl.add(M(SPH(.22,24,16),w,[.62,.75,0],[.8,1,.8],[0,0,-.6]));
  feet(r,[[-.4,-.88,.12],[.4,-.88,.12]],mat('#2a2a2e'));return r},
 peacock:()=>{const r=rig('#1f8fd1');r.body.add(M(SPH(1,56,40),r.skin(0),null,[.9,1.05,.9]));
  const fan=new THREE.Group();fan.position.set(0,.1,-.55);r.body.add(fan);r.sway=fan;for(let i=0;i<9;i++){const a=-1.25+i*.3125;const f=new THREE.Group();f.rotation.z=a;fan.add(f);f.add(M(SPH(.3,24,16),mat('#2e9e5b'),[0,1.15,0],[.65,1.9,.15]));f.add(M(SPH(.13,16,12),mat('#f2c230'),[0,1.55,.05],[1,1.2,.3]));f.add(M(SPH(.08,16,12),mat('#1f5fd1'),[0,1.55,.09],[1,1.2,.3]))}
  [-.15,0,.15].forEach((x,i)=>{r.body.add(M(new THREE.CylinderGeometry(.015,.015,.35,6),mat('#1d1d22'),[x,1.2,0],null,[0,0,-x]));r.body.add(M(SPH(.06,12,10),mat('#1f5fd1'),[x*1.4,1.38,0]))});
  eye(r,r.body,-.28,.3,.73,.16);eye(r,r.body,.28,.3,.73,.16);r.body.add(M(new THREE.ConeGeometry(.08,.22,16),mat('#ffb000'),[0,.08,.9],null,[Math.PI/2+.3,0,0]));mouth(r,r.body,0,-.12,.85,.7);
  feet(r,[[-.3,-1.0,.1],[.3,-1.0,.1]],mat('#ffb000'));return r},
 bee:()=>{const r=rig('#ffc22e');r.body.add(M(SPH(1,56,40),r.skin(0),null,[1.05,.95,1]));const k=mat('#1d1d22',{roughness:.4});
  [[.64,.07],[.79,.07]].forEach(([t,l])=>r.body.add(M(new THREE.SphereGeometry(1.012,56,12,0,Math.PI*2,Math.PI*t,Math.PI*l),k,null,[1.05,.95,1])));
  const wm=mat('#e6f6ff',{transparent:true,opacity:.6,roughness:.1,side:THREE.DoubleSide});[-1,1].forEach(s=>{const g=new THREE.Group();g.position.set(s*.35,.7,-.35);g.add(M(SPH(.5,32,20),wm,[s*.35,.35,0],[.6,1,.06],[0,0,-s*.7]));r.body.add(g);r.flap.push([g,s])});
  const sp=new THREE.Group();sp.position.set(0,.85,.2);r.body.add(sp);r.sway=sp;[-1,1].forEach(s=>{sp.add(tube([[s*.15,0,0],[s*.25,.3,.08],[s*.38,.5,.05]],.025,k));sp.add(M(SPH(.07,12,10),k,[s*.38,.52,.05]))});
  r.body.add(M(new THREE.ConeGeometry(.1,.25,12),k,[0,-.3,-.98],null,[-Math.PI/2,0,0]));eye(r,r.body,-.33,.15,.83,.19);eye(r,r.body,.33,.15,.83,.19);mouth(r,r.body,0,-.2,.9);cheeks(r,r.body,[[-.6,-.1,.75],[.6,-.1,.75]]);r.float=true;return r},
 shark:()=>{const r=rig('#6b8fb5');r.body.add(M(SPH(1,56,40),r.skin(0),null,[1,.95,.95]));r.body.add(M(SPH(.75,40,28),matte('#f4f6f8'),[0,-.35,.45],[1.05,.6,.65]));
  r.body.add(M(new THREE.ConeGeometry(.35,.7,3),r.skin(-.1),[0,1.05,-.1],[1,1,.35],[0,0,0]));[-1,1].forEach(s=>r.body.add(M(SPH(.3,24,16),r.skin(-.1),[s*.95,-.25,.1],[.35,1,.6],[0,0,s*.9])));
  eye(r,r.body,-.32,.22,.79,.16);eye(r,r.body,.32,.22,.79,.16);mouth(r,r.body,0,-.22,.86,1.6);const tm=mat('#ffffff');[-.12,-.04,.04,.12].forEach(x=>r.body.add(M(new THREE.ConeGeometry(.03,.07,8),tm,[x,-.27,.93],null,[Math.PI,0,0])));
  tie(r,-.55,.72,'#e2452b');feet(r,[[-.38,-.88,.12],[.38,-.88,.12]],r.skin(-.2));return r},
 piggy:()=>{const r=rig('#ff9fb5');r.body.add(M(SPH(1,56,40),r.skin(0),null,[1.05,.95,1]));r.body.add(M(new THREE.CylinderGeometry(.27,.29,.16,32),r.skin(.25),[0,-.12,.96],null,[Math.PI/2,0,0]));
  [-.09,.09].forEach(x=>r.body.add(M(SPH(.05,12,10),mat('#8a3a4a'),[x,-.12,1.05],[1,1.4,.5])));[-1,1].forEach(s=>r.body.add(M(new THREE.ConeGeometry(.22,.38,4),r.skin(-.05),[s*.55,.82,.15],null,[.4,0,-s*.5])));
  r.body.add(M(new THREE.BoxGeometry(.5,.05,.12),mat('#3a1a22'),[0,.95,0]));const cn=new THREE.Group();cn.position.set(0,1.0,0);r.body.add(cn);r.sway=cn;cn.add(M(new THREE.CylinderGeometry(.24,.24,.06,32),mat('#f2c230',{metalness:.6,roughness:.25}),[0,.14,0],null,[Math.PI/2,0,0]));
  r.body.add(M(new THREE.TorusGeometry(.12,.035,8,20,Math.PI*1.6),r.skin(0),[.2,-.2,-1.02]));eye(r,r.body,-.34,.25,.83,.16);eye(r,r.body,.34,.25,.83,.16);mouth(r,r.body,0,-.42,.86);
  cheeks(r,r.body,[[-.6,0,.75],[.6,0,.75]],'#ff6f8f');feet(r,[[-.42,-.86,.12],[.42,-.86,.12]],r.skin(-.15));return r},
 penguin:()=>{const r=rig('#2a2d36');r.body.add(M(SPH(1,56,40),r.skin(0),null,[.92,1.05,.9]));const w=matte('#ffffff');r.body.add(M(SPH(.8,40,28),w,[0,-.12,.38],[.95,1.15,.68]));
  eye(r,r.body,-.25,.35,.76,.15);eye(r,r.body,.25,.35,.76,.15);r.body.add(M(new THREE.ConeGeometry(.09,.24,16),mat('#ffa21f'),[0,.15,.95],null,[Math.PI/2+.25,0,0]));mouth(r,r.body,0,-.02,.89,.7);
  cheeks(r,r.body,[[-.45,.15,.72],[.45,.15,.72]]);r.body.add(M(new THREE.TorusGeometry(.72,.09,12,40),mat('#e2452b'),[0,-.32,0],[1.1,1,1.05],[Math.PI/2,0,0]));
  const fl=new THREE.Group();fl.position.set(.82,-.15,.15);fl.rotation.z=.5;r.body.add(fl);r.sway=fl;fl.add(M(SPH(.3,24,16),r.skin(0),[0,0,0],[.35,1,.6]));
  const q=new THREE.Group();q.position.set(.1,.25,.2);q.rotation.z=-.3;fl.add(q);q.add(M(SPH(.2,24,16),w,[0,.35,0],[.45,1.8,.12]));q.add(M(new THREE.ConeGeometry(.04,.16,8),mat('#f2c230',{metalness:.5}),[0,-.05,0],null,[Math.PI,0,0]));
  feet(r,[[-.35,-1.02,.18],[.35,-1.02,.18]],mat('#ffa21f'));return r},
 chameleon:()=>{const r=rig('#5ccf6a');r.body.add(M(SPH(1,56,40),r.skin(0),null,[1.05,.9,.95]));for(let i=0;i<6;i++){const a=-.9+i*.36;r.body.add(M(new THREE.ConeGeometry(.08,.2,10),r.skin(-.25),[0,.9*Math.cos(a)*1.0,.9*Math.sin(a)*.95-0],null,[a,0,0]))}
  [-1,1].forEach(s=>r.body.add(M(SPH(.3,32,20),r.skin(-.08),[s*.44,.28,.62])));eye(r,r.body,-.44,.28,.78,.2);eye(r,r.body,.44,.28,.78,.2);mouth(r,r.body,0,-.25,.86,1.3);
  [['#ff5a8a',[-.6,-.35,.65]],['#ffc22e',[.7,-.1,.6]],['#4a86f5',[.3,-.55,.72]],['#ff8a1f',[-.25,.62,.62]]].forEach(([c,p])=>r.body.add(M(SPH(.1,16,12),mat(c),p,[1,1,.5])));
  const tl=new THREE.Group();tl.position.set(.7,-.5,-.45);r.body.add(tl);r.sway=tl;const pts=[];for(let k=0;k<=30;k++){const t=k/30,a=t*Math.PI*3.2,rr=.45*(1-t*.75);pts.push([.2+Math.sin(a)*rr*.3+t*.25,Math.cos(a)*rr,-Math.sin(a)*rr*.6])}
  tl.add(tube(pts,.09,r.skin(0),60));feet(r,[[-.4,-.84,.12],[.4,-.84,.12]],r.skin(-.15));return r},
 beaver:()=>{const r=rig('#a0693a');r.body.add(M(SPH(1,56,40),r.skin(0),null,[1,1,.95]));r.body.add(M(SPH(.5,32,20),r.skin(.35),[0,-.25,.68],[1.1,.75,.6]));
  r.body.add(M(SPH(.1,16,12),mat('#2a1a10'),[0,-.08,.98],[1.3,.9,1]));const tm=matte('#ffffff');[-.07,.07].forEach(x=>r.body.add(M(new RoundedBoxGeometry(.12,.2,.05,2,.02),tm,[x,-.47,.96])));
  [-1,1].forEach(s=>r.body.add(M(SPH(.16,20,14),r.skin(-.2),[s*.62,.78,0],[1,1,.6])));eye(r,r.body,-.32,.25,.8,.16);eye(r,r.body,.32,.25,.8,.16);mouth(r,r.body,0,-.3,.97,.7);
  const tl=new THREE.Group();tl.position.set(0,-.75,-.75);r.body.add(tl);r.sway=tl;tl.add(M(new RoundedBoxGeometry(.75,.12,1.0,4,.06),mat('#4a3020',{roughness:.6}),[0,0,-.3],null,[.35,0,0]));
  hand(r,.82,-.3,.42);r.body.add(M(new THREE.CylinderGeometry(.09,.09,.75,16),mat('#4a86f5',{roughness:.5}),[.9,-.3,.45],null,[.3,0,1.2]));
  r.body.add(M(new THREE.CylinderGeometry(.03,.03,.4,6),mat('#ffb000'),[-.62,.55,.45],null,[0,0,.9]));feet(r,[[-.42,-.9,.12],[.42,-.9,.12]],r.skin(-.3));return r},
 // Halloween crew
 jack:()=>{const r=rig('#ff8a1f');const g=SPH(1,72,48),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),k=1-.07*Math.pow(Math.abs(Math.sin(a*4)),.6);p.setXYZ(i,x*k,y,z*k)}g.computeVertexNormals();
  r.body.add(M(g,r.skin(0),null,[1.12,.88,1.02]));eye(r,r.body,-.34,.12,.77,.19);eye(r,r.body,.34,.12,.77,.19);mouth(r,r.body,0,-.2,.93);cheeks(r,r.body,[[-.6,-.12,.8],[.6,-.12,.8]],'#ff5a3a');
  const sp=new THREE.Group();sp.position.set(0,.8,0);r.body.add(sp);r.sway=sp;sp.add(M(new THREE.CylinderGeometry(.07,.11,.32,12),mat('#6b4a2a',{roughness:.7}),[0,.12,0],null,[0,0,.25]));
  sp.add(M(SPH(.16,20,14),mat('#3f9a4a'),[.2,.12,.05],[1.4,.3,.9],[0,0,-.3]));feet(r,[[-.42,-.82,.15],[.42,-.82,.15]]);return r},
 nyx:()=>{const r=rig('#4a4058');r.body.add(M(SPH(.88,56,40),r.skin(0)));
  [-1,1].forEach(s=>{r.body.add(M(new THREE.ConeGeometry(.24,.6,24),r.skin(0),[s*.42,.88,0],null,[0,0,-s*.32]));r.body.add(M(new THREE.ConeGeometry(.13,.36,16),matte('#f39fb4'),[s*.43,.84,.12],null,[0,0,-s*.32]))});
  const sh=new THREE.Shape();sh.moveTo(0,.2);sh.lineTo(.6,.55);sh.lineTo(1.3,.45);sh.lineTo(1.2,-.2);sh.quadraticCurveTo(1.0,.05,.8,-.15);sh.quadraticCurveTo(.6,0,.4,-.2);sh.quadraticCurveTo(.2,0,0,-.2);sh.lineTo(0,.2);
  const wg=new THREE.ExtrudeGeometry(sh,{depth:.04,bevelEnabled:false}),wm=r.skin(-.25,{side:THREE.DoubleSide});
  [-1,1].forEach(s=>{const g=new THREE.Group();g.position.set(s*.62,.05,-.15);const w=M(wg,wm,[0,0,0],[s,1,1]);g.add(w);r.body.add(g);r.flap.push([g,s])});
  eye(r,r.body,-.3,.15,.62,.2);eye(r,r.body,.3,.15,.62,.2);mouth(r,r.body,0,-.22,.84);
  const fm=mat('#ffffff');[-1,1].forEach(s=>r.body.add(M(new THREE.ConeGeometry(.04,.12,10),fm,[s*.08,-.3,.82],null,[Math.PI,0,0])));r.float=true;return r},
 wrap:()=>{const r=rig('#efe6cf');const o=bean(r,{matte:true,ey:.22});const bm=r.skinMatte(-.1);
  [-.8,-.55,-.3,-.05,.5,.78].forEach((y,i)=>{const f=Math.sqrt(Math.max(.05,1-(y/o.sy)**2));const t=M(new THREE.TorusGeometry(1,.045,8,64),bm,[0,y,0],[o.sx*f+.01,o.sz*f+.01,1],[Math.PI/2+(i%2?.08:-.08),0,0]);r.body.add(t)});
  r.body.add(M(new THREE.BoxGeometry(.12,.4,.03),bm,[.55,-.75,.62],null,[.3,0,.4]));return r},
 hex:()=>{const r=rig('#7fd36b');bean(r,{my:-.2});const k=mat('#1d1b22',{roughness:.5});
  r.body.add(M(new THREE.CylinderGeometry(1.15,1.15,.06,48),k,[0,.84,0]));r.body.add(M(new THREE.CylinderGeometry(.66,.68,.14,40),mat('#ff8a1f'),[0,.94,0]));
  r.body.add(M(new THREE.BoxGeometry(.18,.16,.05),mat('#f2c230',{metalness:.4}),[0,.94,.67]));
  const hat=new THREE.Group();hat.position.set(0,.9,0);r.body.add(hat);r.sway=hat;hat.add(M(new THREE.ConeGeometry(.64,1.25,40),k,[0,.7,0]));hat.add(M(new THREE.ConeGeometry(.2,.5,20),k,[.28,1.42,0],null,[0,0,-.9]));
  r.body.add(M(SPH(.1,16,12),r.skin(-.15),[0,.02,.9],[1,1,1.3]));return r},
};
export const CHAR_KEYS=Object.keys(B);
export const DEF_COLOR=Object.fromEntries(CHAR_KEYS.map(k=>[k,null]));

let R,scene,cam,shadow,cur=null;const rigs={};
function getRig(k){if(rigs[k])return rigs[k];const r=B[k]();r.key=k;DEF_COLOR[k]=r.def;
 // fit every character to the same box, feet on the floor
 const box=new THREE.Box3().setFromObject(r.root),h=box.max.y-box.min.y,w=box.max.x-box.min.x,s=Math.min(1,2.3/h,2.45/w);
 r.fit=new THREE.Group();r.fit.add(r.root);r.fit.scale.setScalar(s);r.fit.position.y=-1.12+(r.float?.12:0)-box.min.y*s;r.fs=s;
 r.sway0=r.sway?r.sway.rotation.clone():null;rigs[k]=r;return r}
const C1=new THREE.Color(),BLK=new THREE.Color(0,0,0),WHT=new THREE.Color(1,1,1);
function tint(r,hex){if(r.tinted===hex)return;r.tinted=hex;r.tint.forEach(([m,k])=>{C1.set(hex);if(k<0)C1.lerp(BLK,-k);else if(k>0)C1.lerp(WHT,k);m.color.copy(C1)})}
function use(r){if(cur===r)return;if(cur)scene.remove(cur.fit);scene.add(r.fit);cur=r}

/* tilt the phone: the character leans toward the low side, then drifts back to the middle */
const tilt={x:0,y:0,vx:0,tx:0,ty:0};const base={g:null,b:null};
function onTilt(e){if(e.gamma==null)return;const g=e.gamma,bt=e.beta||0;if(base.g==null){base.g=g;base.b=bt}
 base.g+=(g-base.g)*.03;base.b+=(bt-base.b)*.03;tilt.tx=clamp((g-base.g)/25,-1,1);tilt.ty=clamp((bt-base.b)/30,-1,1)}
function askTilt(){const D=window.DeviceOrientationEvent;if(!D)return;
 if(typeof D.requestPermission==='function')D.requestPermission().then(p=>{if(p==='granted')addEventListener('deviceorientation',onTilt)}).catch(()=>{});
 else addEventListener('deviceorientation',onTilt)}

const per=new WeakMap();
function stateOf(E){let s=per.get(E);if(!s){s={cv:null,ctx:null,lean:0,ox:0,oy:0,vx:0,vy:0,held:false};per.set(E,s)}return s}
function place(E,s){const svg=E.svg,par=svg.parentElement;if(!par)return false;
 if(!s.cv){s.cv=document.createElement('canvas');s.cv.className='m3c';s.cv.width=W;s.cv.height=H;s.ctx=s.cv.getContext('2d');
  if(getComputedStyle(par).position==='static')par.style.position='relative';par.appendChild(s.cv)}
 if(s.cv.parentElement!==par)par.appendChild(s.cv);
 const r=svg.getBoundingClientRect(),pr=par.getBoundingClientRect();
 if(r.bottom<-150||r.top>innerHeight+150||r.right<0||r.left>innerWidth||!r.width)return false;
 const k=pr.width?par.offsetWidth/pr.width:1; // undo any CSS scale on the parent
 const st=s.cv.style;st.left=((r.left-pr.left)*k)+'px';st.top=((r.top-pr.top)*k)+'px';st.width=(r.width*k)+'px';st.height=(r.height*k)+'px';
 st.transform=`translate(${s.ox.toFixed(1)}px,${s.oy.toFixed(1)}px)`;return true}

function pose(r,E,s,dt,T){
 const b=clamp(E.b||0,0,1),sleep=!!E.sleep&&!E.talking&&!E.listening,happy=E.happy||0,held=s.held;
 const sp=Math.hypot(s.vx,s.vy),stretch=clamp(sp*.0007,0,.28);
 const sq=(1+(E.sq-1)*1.7)*(1+stretch*.6);
 const bob=sleep?Math.sin(T*1.1)*.025:Math.sin(T*(E.night?.9:2.2)+E.ex)*(r.float?.09:.05);
 const hop=happy>.3&&!held?Math.abs(Math.sin(T*9))*.12*happy:0;
 const jit=E.nervous?Math.sin(T*47)*.02:0;
 r.root.position.set(tilt.x*.22+jit,bob+hop-(sleep?.06:0)+(held?.12:0),0);
 const up=held?1.07:1;r.root.scale.set(up/sq,up*sq,up/sq);
 s.lean=lerp(s.lean,E.listening?.22:0,dt*6);
 r.root.rotation.set(E.gy*.22+s.lean+tilt.y*.12,E.gx*.4+tilt.x*.35,-tilt.x*.32+(sleep?.12:0)-clamp(s.vx*.0016,-.6,.6));
 const lookX=clamp(E.gx+tilt.x*.8,-1,1),lookY=clamp(E.gy,-1,1);
 r.eyes.forEach(e=>{const shut=(sleep||happy>.6)&&!held;e.open.visible=!shut;e.shut.visible=shut;
  if(shut){e.shut.rotation.z=sleep?Math.PI:0;e.shut.position.y=sleep?.02:-.03}
  e.open.scale.y=Math.max(.08,1-b)*(held?1.15:1);e.open.scale.x=held?1.15:1;
  if(e.kind==='ball'){e.pu.scale.setScalar(clamp(E.pu/.36,.7,1.5)*(held?.7:1));e.pg.position.set(lookX*e.rad*.35,-lookY*e.rad*.3,0);e.pg.rotation.set(lookY*.4,lookX*.5,0)}
  else e.pg.position.set(lookX*e.rad*.3,-lookY*e.rad*.25,0)});
 if(r.mouth){const talk=E.talking?Math.abs(Math.sin(T*16)):0;const ohOn=sleep||!!E.talking||!!E.listening||held;r.mouth.oh.visible=ohOn;r.mouth.sm.visible=!ohOn;
  if(ohOn)r.mouth.oh.scale.set(E.talking?1.2:.8,E.talking?.4+1.4*talk:held?1.3:E.listening?1:.6,.4);r.mouth.sm.scale.setScalar(1+happy*.6)}
 r.cheeks.forEach(c=>{c.material.opacity=.55+happy*.45;c.scale.set(1+happy*.25,.55+happy*.15,.3)});
 r.feet.forEach((f,i)=>{f.position.y=f.userData.y0??(f.userData.y0=f.position.y);f.position.y=f.userData.y0+(held?-.12+Math.sin(T*14+i*Math.PI)*.05:happy>.3?Math.max(0,Math.sin(T*12+i*Math.PI))*.08:0)});
 if(r.sway){r.sway.rotation.z=r.sway0.z+Math.sin(T*2.1)*.12+(E.sv||0)*.8-tilt.x*.4+(sleep?.5:0)-clamp(s.vx*.002,-.5,.5);r.sway.rotation.x=r.sway0.x+(E.listening?-.3:0)}
 r.flap.forEach(([g,sd])=>{const sp2=sleep?1:held?22:happy>.3?16:7;g.rotation.y=sd*(Math.sin(T*sp2)*(sleep?.05:.45)+(sleep?.6:0))});
 shadow.scale.set((1.15-bob-hop-(held?.35:0))*(1/sq)*(r.float?.8:1),1,.4);shadow.position.x=r.root.position.x;shadow.material.opacity=.13-hop*.4-(held?.06:0)}

function zzz(ctx,T){ctx.save();ctx.fillStyle='#5d6470';ctx.textAlign='center';
 for(let i=0;i<3;i++){const k=((T*.45+i/3)%1);ctx.globalAlpha=Math.sin(k*Math.PI)*.9;ctx.font=`700 ${Math.round(26+k*22)}px system-ui,sans-serif`;ctx.fillText('z',W*.74+k*50+Math.sin(T*2+i)*6,H*.32-k*120)}
 ctx.restore()}

const live=new Set();
function frame(dt,T){
 tilt.tx*=1-dt*.8;tilt.ty*=1-dt*.8;tilt.vx+=(160*(tilt.tx-tilt.x)-18*tilt.vx)*dt;tilt.x+=tilt.vx*dt;tilt.y=lerp(tilt.y,tilt.ty,dt*4);
 const list=(window.__eyes?window.__eyes():[]).filter(E=>B[E.sty]&&E.svg.isConnected);
 for(const E of list){const s=stateOf(E);
  // pick up: follow the finger, then spring back with a bounce
  const drag=E.y0!=null&&E.moved&&!E.listening,tx=drag?clamp(E.dragX||0,-150,150):0,ty=drag?clamp(E.dragY||0,-170,90):0;
  if(drag&&!s.held){s.held=true}if(!drag&&s.held){s.held=false;if(Math.hypot(s.ox,s.oy)>30){E.sv-=.14;if('vibrate' in navigator)navigator.vibrate(10)}}
  const kS=drag?520:170,kD=drag?40:9,n=Math.ceil(dt/.006),h=dt/n;for(let j=0;j<n;j++){s.vx+=(kS*(tx-s.ox)-kD*s.vx)*h;s.vy+=(kS*(ty-s.oy)-kD*s.vy)*h;s.ox+=s.vx*h;s.oy+=s.vy*h}
  if(!place(E,s))continue;const r=getRig(E.sty);use(r);tint(r,(window.__charColor&&window.__charColor(E))||r.def);
  pose(r,E,s,dt,T);R.render(scene,cam);
  s.ctx.clearRect(0,0,W,H);s.ctx.drawImage(R.domElement,0,0);
  if(E.sleep&&!E.talking&&!E.listening)zzz(s.ctx,T);
  E.svg.classList.add('live')}
 live.clear();for(const E of list){const s=per.get(E);if(s&&s.cv)live.add(s.cv)}
 document.querySelectorAll('canvas.m3c').forEach(c=>{if(!live.has(c))c.remove()})}

function init(opts={}){
 R=new THREE.WebGLRenderer(Object.assign({antialias:true,alpha:true},opts));
 R.setPixelRatio(1);R.setSize(W,H,false);R.toneMapping=THREE.ACESFilmicToneMapping;R.outputColorSpace=THREE.SRGBColorSpace;R.setClearColor(0x000000,0);
 scene=new THREE.Scene();scene.environment=new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(),.04).texture;
 const key=new THREE.DirectionalLight('#ffffff',1.6);key.position.set(-3,4,5);scene.add(key);scene.add(new THREE.AmbientLight('#ffffff',.35));
 cam=new THREE.PerspectiveCamera(30,W/H,.1,50);cam.position.set(0,.25,5.9);cam.lookAt(0,.05,0);
 shadow=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:.12}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.12;scene.add(shadow)}

export function start(){try{init()}catch(e){console.warn('no WebGL',e);return}
 addEventListener('pointerdown',askTilt,{once:true});window.mochiFrame=frame}

// still picture of one character (for previews and mockups)
const FAKE={sq:1,b:0,gx:0,gy:.05,pu:.36,happy:0,ex:0,sv:0};
export function still(k,color,T=.6,state={}){if(!R)init({preserveDrawingBuffer:true});const r=getRig(k);use(r);tint(r,color||r.def);
 pose(r,Object.assign({},FAKE,state),{lean:0,ox:0,oy:0,vx:0,vy:0,held:!!state.held},0,T);R.render(scene,cam);return R.domElement.toDataURL('image/png')}
