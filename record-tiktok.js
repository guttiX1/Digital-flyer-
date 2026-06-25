const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const cv = require('child_process');

const HTML = `file://${path.resolve(__dirname, 'events/chango-malo-vs-comandante/tiktok-animated.html')}`;
const OUT  = path.resolve(__dirname, 'events/chango-malo-vs-comandante/tiktok-draw-reveal.mp4');
const FRAMES = '/tmp/tikframes';
const W = 540, H = 960;
const DURATION = 22000; // 22s covers full animation sequence

if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
           '--disable-gpu', `--window-size=${W},${H}`],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(HTML, { waitUntil: 'networkidle0' });

  // Wait for fonts to load
  await new Promise(r => setTimeout(r, 800));

  console.log(`Capturing ${DURATION/1000}s of draw animation...`);
  const t0 = Date.now();
  let n = 0;

  while (Date.now() - t0 < DURATION) {
    await page.screenshot({
      path: path.join(FRAMES, `f${String(n).padStart(5,'0')}.jpg`),
      type: 'jpeg', quality: 94,
    });
    n++;
    if (n % 20 === 0) process.stdout.write(`\r  ${n} frames | ${((Date.now()-t0)/1000).toFixed(1)}s`);
  }

  const secs = (Date.now() - t0) / 1000;
  console.log(`\nCaptured ${n} frames in ${secs.toFixed(1)}s`);
  await browser.close();

  // Encode with Python/opencv
  console.log('Encoding MP4...');
  const pyScript = `
import cv2, glob, os
frames = sorted(glob.glob('${FRAMES}/f*.jpg'))
print(f'Encoding {len(frames)} frames...')
img0 = cv2.imread(frames[0])
h, w = img0.shape[:2]
print(f'Size: {w}x{h}')
fps_out = 30
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter('${OUT}', fourcc, fps_out, (w, h))
src_fps = ${n} / ${secs}
repeat = max(1, round(fps_out / src_fps))
print(f'Source fps: {src_fps:.1f}, repeat each frame x{repeat}')
for i, f in enumerate(frames):
    img = cv2.imread(f)
    for _ in range(repeat):
        out.write(img)
out.release()
size = os.path.getsize('${OUT}') / 1024 / 1024
print(f'Done: ${OUT} ({size:.1f} MB)')
`;

  fs.writeFileSync('/tmp/encode.py', pyScript);
  await new Promise((res, rej) => {
    const p = cv.spawn('python3', ['/tmp/encode.py'], { stdio: 'inherit' });
    p.on('close', code => code === 0 ? res() : rej(new Error('encode failed')));
  });

  fs.rmSync(FRAMES, { recursive: true });
  console.log('\n✅ Done:', OUT);
})().catch(e => { console.error(e); process.exit(1); });
