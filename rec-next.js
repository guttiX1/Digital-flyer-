const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const HTML = `file:///home/user/Digital-flyer-/events/chango-malo-vs-comandante/nextlevel.html`;
const OUT  = '/home/user/Digital-flyer-/events/chango-malo-vs-comandante/nextlevel.mp4';
const FRAMES = '/tmp/nlframes';
const W = 540, H = 960, DURATION = 16000;

if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, {recursive:true});
fs.mkdirSync(FRAMES, {recursive:true});

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',`--window-size=${W},${H}`],
  });
  const page = await browser.newPage();
  await page.setViewport({width:W, height:H, deviceScaleFactor:2});
  await page.goto(HTML, {waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,500));

  console.log(`Capturing ${DURATION/1000}s...`);
  const t0 = Date.now(); let n = 0;
  while (Date.now()-t0 < DURATION) {
    await page.screenshot({path:`${FRAMES}/f${String(n).padStart(5,'0')}.jpg`, type:'jpeg', quality:95});
    n++;
    if (n%20===0) process.stdout.write(`\r  ${n} frames | ${((Date.now()-t0)/1000).toFixed(1)}s`);
  }
  const secs = (Date.now()-t0)/1000;
  console.log(`\nCaptured ${n} frames in ${secs.toFixed(1)}s`);
  await browser.close();

  const srcFps = n/secs;
  const rep = Math.max(1, Math.round(30/srcFps));
  console.log(`Encoding (src ${srcFps.toFixed(1)}fps, repeat x${rep})...`);

  const py = `
import cv2, glob, os
frames = sorted(glob.glob('${FRAMES}/f*.jpg'))
img0 = cv2.imread(frames[0])
h, w = img0.shape[:2]
print(f'  {len(frames)} frames @ {w}x{h}')
out = cv2.VideoWriter('${OUT}', cv2.VideoWriter_fourcc(*'mp4v'), 30, (w,h))
for f in frames:
    img = cv2.imread(f)
    for _ in range(${rep}): out.write(img)
out.release()
mb = os.path.getsize('${OUT}')/1024/1024
print(f'  Done: {mb:.1f} MB')
`;
  fs.writeFileSync('/tmp/enc.py', py);
  await new Promise((res,rej)=>{
    const p = spawn('python3',['/tmp/enc.py'],{stdio:'inherit'});
    p.on('close', code => code===0?res():rej(new Error('encode failed')));
  });
  fs.rmSync(FRAMES,{recursive:true});
  console.log('✅', OUT);
})().catch(e=>{console.error(e);process.exit(1);});
