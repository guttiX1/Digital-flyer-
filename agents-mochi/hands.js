// Hands-free: the front camera watches your hand (on this phone only, nothing is sent anywhere).
// It works like a mouse in the air: a dot follows your finger (and the characters look at it).
// Pinch (thumb + index together) = tap. Pinch, move, let go = swipe (scroll cards or tabs).
// Thumbs up = done. Open hand = stop talking.
// Uses Google's MediaPipe hand tracker (Apache-2.0), hosted next to this file.
const BASE=new URL('./vendor/mediapipe/',import.meta.url).href;
let lm=null,video=null,stream=null,timer=0,bubble=null,running=false,stateCb=null,cur=null;
let lastG=0,hold={g:null,t:0},lastSeen=0;

const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fingers(p){const w=p[0];const ext=(tip,pip)=>d(w,p[tip])>d(w,p[pip])*1.18;
 return {thumb:d(p[4],p[5])>d(p[3],p[5])*1.25&&d(w,p[4])>d(w,p[3]),index:ext(8,6),middle:ext(12,10),ring:ext(16,14),pinky:ext(20,18)}}
function pose(p){const f=fingers(p),n=[f.index,f.middle,f.ring,f.pinky].filter(Boolean).length;
 if(n===0&&f.thumb&&p[4].y<p[5].y-.06&&p[4].y<p[9].y-.06)return 'thumbs';
 if(n===4&&f.thumb)return 'palm';
 if(f.index&&n===1)return 'point';
 return 'other'}

function makeBubble(){const b=document.createElement('div');b.style.cssText='position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:60;width:64px;height:64px;border-radius:50%;overflow:hidden;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.2);background:#111';
 video.style.cssText='width:100%;height:100%;object-fit:cover;transform:scaleX(-1)';b.appendChild(video);
 const dot=document.createElement('i');dot.style.cssText='position:absolute;right:4px;top:4px;width:10px;height:10px;border-radius:50%;background:#1d9e6a;border:2px solid #fff';b.appendChild(dot);
 b.title='Hands-free is on';document.body.appendChild(b);return b}

export async function startHands({onPoint,onGesture,onState}={}){if(running)return;running=true;stateCb=onState;
 try{onState&&onState('loading');
  const {FilesetResolver,HandLandmarker}=await import(BASE+'vision_bundle.mjs');
  const files=await FilesetResolver.forVisionTasks(BASE+'wasm');
  lm=lm||await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:BASE+'hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:1});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:480},height:{ideal:360}},audio:false});
  video=document.createElement('video');video.playsInline=true;video.muted=true;video.srcObject=stream;await video.play();
  bubble=makeBubble();onState&&onState('on');lastSeen=performance.now();
  cur=document.createElement('div');cur.style.cssText='position:fixed;left:0;top:0;z-index:70;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #17171a;background:rgba(255,255,255,.55);pointer-events:none;transition:width .12s,height .12s,margin .12s,background .12s;display:none';document.body.appendChild(cur);
  let cx=-1,cy=-1,pinched=false,start=null,lostAt=0;
  const tick=()=>{if(!running)return;const now=performance.now();
   if(video.readyState>=2){const r=lm.detectForVideo(video,now);const p=r.landmarks&&r.landmarks[0];
    if(p){lastSeen=now;lostAt=0;
     // the "pinch point" between thumb and index tip, mirrored (selfie view) and stretched so small moves reach the edges
     const mx=1-(p[4].x+p[8].x)/2,my=(p[4].y+p[8].y)/2;
     const tx=Math.min(1,Math.max(0,.5+(mx-.5)*1.6))*innerWidth,ty=Math.min(1,Math.max(0,.5+(my-.5)*1.6))*innerHeight;
     if(cx<0){cx=tx;cy=ty}else{cx+=(tx-cx)*.55;cy+=(ty-cy)*.55}
     cur.style.display='block';cur.style.transform=`translate(${cx}px,${cy}px)`;onPoint&&onPoint(cx,cy);
     const size=d(p[0],p[9])||.1,gap=d(p[4],p[8])/size;
     if(!pinched&&gap<.28){pinched=true;start={x:cx,y:cy,t:now};cur.style.background='#17171a';cur.style.width=cur.style.height='22px';cur.style.margin='-11px 0 0 -11px';if('vibrate' in navigator)navigator.vibrate(8)}
     else if(pinched&&gap>.42){pinched=false;cur.style.background='rgba(255,255,255,.55)';cur.style.width=cur.style.height='30px';cur.style.margin='-15px 0 0 -15px';
      const dx=cx-start.x,dy=cy-start.y;
      if(Math.hypot(dx,dy)<45)tapAt(start.x,start.y);
      else if(Math.abs(dy)>Math.abs(dx))onGesture&&onGesture(dy<0?'up':'down',start);
      else onGesture&&onGesture(dx<0?'left':'right',start);start=null}
     if(!pinched){const g=pose(p);
      if(g==='thumbs'||g==='palm'){if(hold.g!==g){hold={g,t:now}}else if(now-hold.t>550&&now-lastG>1200){lastG=now;hold={g:null,t:0};onGesture&&onGesture(g)}}else hold={g:null,t:0}}}
    else{if(!lostAt)lostAt=now;if(now-lostAt>400){cur.style.display='none';pinched=false;start=null}}
    // no hand for 5 minutes: switch off to save battery
    if(now-lastSeen>300000){stopHands();return}}
   timer=setTimeout(tick,50)};tick();
  document.addEventListener('visibilitychange',vis);
 }catch(e){running=false;cleanup();onState&&onState('error',e);}}
function tapAt(x,y){const el=document.elementFromPoint(x,y);if(!el)return;const o={bubbles:true,clientX:x,clientY:y,pointerId:99,isPrimary:true};
 el.dispatchEvent(new PointerEvent('pointerdown',o));el.dispatchEvent(new PointerEvent('pointerup',o));
 const c=el.closest('button,a,input,select,textarea,label,[data-tab]');if(c){if(/INPUT|TEXTAREA|SELECT/.test(c.tagName))c.focus();else c.click()}else el.dispatchEvent(new MouseEvent('click',o))}
function vis(){if(document.hidden)stopHands()}
function cleanup(){clearTimeout(timer);if(cur)cur.remove();cur=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(bubble)bubble.remove();bubble=null;video=null;document.removeEventListener('visibilitychange',vis)}
export function stopHands(){const was=running;running=false;cleanup();if(was&&stateCb)stateCb('off')}
export const handsOn=()=>running;
