// Hands-free: the front camera watches your hand (on this phone only, nothing is sent anywhere).
// Point and the characters look at your fingertip. Thumbs up = done. Open palm = stop talking.
// Swipe your hand left/right/up/down in the air to move between cards.
// Uses Google's MediaPipe hand tracker (Apache-2.0), hosted next to this file.
const BASE=new URL('./vendor/mediapipe/',import.meta.url).href;
let lm=null,video=null,stream=null,timer=0,bubble=null,running=false,stateCb=null;
const hist=[];let lastG=0,hold={g:null,t:0},lastSeen=0;

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
  const tick=()=>{if(!running)return;const now=performance.now();
   if(video.readyState>=2){const r=lm.detectForVideo(video,now);const p=r.landmarks&&r.landmarks[0];
    if(p){lastSeen=now;const tip=p[8];
     // mirror x (selfie view) and stretch a little so a small move reaches the screen edges
     const x=Math.min(1,Math.max(0,.5+((1-tip.x)-.5)*1.5)),y=Math.min(1,Math.max(0,.5+(tip.y-.5)*1.5));
     onPoint&&onPoint(x*innerWidth,y*innerHeight);
     const g=pose(p);
     if(g==='thumbs'||g==='palm'){if(hold.g!==g){hold={g,t:now}}else if(now-hold.t>550&&now-lastG>1200){lastG=now;hold={g:null,t:0};onGesture&&onGesture(g)}}else hold={g:null,t:0};
     // swipes: a fast move of the whole hand
     hist.push({t:now,x:1-p[9].x,y:p[9].y});while(hist.length&&now-hist[0].t>320)hist.shift();
     if(hist.length>3&&now-lastG>900){const a=hist[0],b=hist[hist.length-1],dx=b.x-a.x,dy=b.y-a.y;
      if(Math.abs(dx)>.3&&Math.abs(dx)>2*Math.abs(dy)){lastG=now;hist.length=0;onGesture&&onGesture(dx>0?'right':'left')}
      else if(Math.abs(dy)>.3&&Math.abs(dy)>2*Math.abs(dx)){lastG=now;hist.length=0;onGesture&&onGesture(dy>0?'down':'up')}}}
    // no hand for 5 minutes: switch off to save battery
    if(now-lastSeen>300000){stopHands();return}}
   timer=setTimeout(tick,66)};tick();
  document.addEventListener('visibilitychange',vis);
 }catch(e){running=false;cleanup();onState&&onState('error',e);}}
function vis(){if(document.hidden)stopHands()}
function cleanup(){clearTimeout(timer);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(bubble)bubble.remove();bubble=null;video=null;document.removeEventListener('visibilitychange',vis)}
export function stopHands(){const was=running;running=false;cleanup();if(was&&stateCb)stateCb('off')}
export const handsOn=()=>running;
