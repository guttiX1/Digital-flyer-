const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const FFMPEG = require('ffmpeg-static');
const { spawn } = require('child_process');

const EVENT = 'chango-malo-vs-comandante';
const HTML  = `file://${path.resolve(__dirname, `events/${EVENT}/tiktok-pro.html`)}`;
const WEBM  = '/tmp/tiktok-raw.webm';
const OUT   = path.resolve(__dirname, `events/${EVENT}/tiktok-pro.mp4`);
const W = 540, H = 960;
const DURATION = 30000; // 30 seconds covers full animation sequence

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-gpu-rasterization',
      '--enable-accelerated-2d-canvas',
      `--window-size=${W},${H}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(HTML, { waitUntil: 'networkidle0' });

  // small settle time so particles are running before record starts
  await new Promise(r => setTimeout(r, 300));

  console.log('Starting native Chrome screencast...');
  const recorder = await page.screencast({ path: WEBM });

  console.log(`Recording ${DURATION/1000}s...`);
  await new Promise(r => setTimeout(r, DURATION));

  await recorder.stop();
  console.log('\nStopped recording.');
  await browser.close();

  const webmMB = (fs.statSync(WEBM).size / 1024 / 1024).toFixed(1);
  console.log(`WebM captured: ${webmMB} MB`);

  // Convert WebM → MP4 (no scale filter — stays at 1080x1920 from deviceScaleFactor:2)
  console.log('Converting to MP4...');
  await run(FFMPEG, [
    '-y', '-i', WEBM,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT,
  ]);

  fs.unlinkSync(WEBM);
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅  ${OUT}  (${mb} MB)`);
})().catch(e => { console.error(e); process.exit(1); });

function run(bin, args) {
  return new Promise((res, rej) => {
    const p = spawn(bin, args);
    p.stderr.on('data', d => process.stdout.write('.'));
    p.on('close', code => code === 0 ? res() : rej(new Error(`ffmpeg exit ${code}`)));
  });
}
