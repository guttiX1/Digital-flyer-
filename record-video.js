const puppeteer = require('puppeteer');
const chromium = puppeteer;
const path = require('path');
const fs = require('fs');

const FFMPEG = require('ffmpeg-static');
const { spawn } = require('child_process');

const EVENT = 'chango-malo-vs-comandante';
const HTML = `file://${path.resolve(__dirname, `events/${EVENT}/video-ad.html`)}`;
const OUT = path.resolve(__dirname, `events/${EVENT}/chango-vs-comandante.mp4`);
const FRAMES = '/tmp/vcframes';
const W = 540, H = 960;
const DURATION = 31000;

if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',
           `--window-size=${W},${H}`],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(HTML, { waitUntil: 'networkidle0' });

  // auto-click play
  await page.evaluate(() => {
    const p = document.getElementById('play-overlay');
    if (p) p.click();
  });

  await new Promise(r => setTimeout(r, 300));

  console.log(`Capturing ${DURATION/1000}s...`);
  const t0 = Date.now();
  let n = 0;
  while (Date.now() - t0 < DURATION) {
    await page.screenshot({
      path: path.join(FRAMES, `f${String(n).padStart(5,'0')}.jpg`),
      type: 'jpeg', quality: 92,
    });
    n++;
    if (n % 15 === 0) process.stdout.write(`\r  ${n} frames | ${((Date.now()-t0)/1000).toFixed(1)}s`);
  }
  const secs = (Date.now()-t0)/1000;
  const fps  = (n/secs).toFixed(3);
  console.log(`\nCaptured ${n} frames @ ${fps}fps`);
  await browser.close();

  // encode with ffmpeg-static — no scale filter (avoid segfault), output at 1080x1920 via setsar
  console.log('Encoding MP4...');
  await run(FFMPEG, [
    '-y',
    '-framerate', fps,
    '-i', path.join(FRAMES, 'f%05d.jpg'),
    '-vf', `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-r', '30',
    '-movflags', '+faststart',
    OUT,
  ]);

  fs.rmSync(FRAMES, { recursive: true });
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅  ${OUT}  (${mb} MB)`);
})().catch(e => { console.error(e); process.exit(1); });

function run(bin, args) {
  return new Promise((res, rej) => {
    const p = spawn(bin, args);
    p.stderr.on('data', d => process.stdout.write('.'));
    p.on('close', code => code === 0 ? res() : rej(new Error(`exit ${code}`)));
  });
}
