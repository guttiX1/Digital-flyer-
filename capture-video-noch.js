const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = (() => {
  try { return require('@ffmpeg-installer/ffmpeg').path; }
  catch (e) { return require('ffmpeg-static'); }
})();
const HTML = `file://${path.resolve(__dirname, 'events/el-nochistlense-ago15/video-ad.html')}`;
const FRAMES_DIR = '/tmp/vid-frames-noch';
const OUT_VIDEO = path.resolve(__dirname, 'events/el-nochistlense-ago15/nochistlense-video-ad.mp4');

const DURATION_MS = 15000;
const WIDTH = 540;
const HEIGHT = 960;

if (fs.existsSync(FRAMES_DIR)) fs.rmSync(FRAMES_DIR, { recursive: true });
fs.mkdirSync(FRAMES_DIR, { recursive: true });

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      `--window-size=${WIDTH},${HEIGHT}`,
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.goto(HTML, { waitUntil: 'load' });

  await page.evaluate(() => {
    const skip = document.getElementById('skip');
    if (skip) skip.style.display = 'none';
    const replay = document.getElementById('replay');
    if (replay) replay.style.display = 'none';
  });

  await new Promise(r => setTimeout(r, 150));

  console.log(`Capturing for ${DURATION_MS/1000}s...`);
  const start = Date.now();
  let f = 0;

  while (Date.now() - start < DURATION_MS) {
    await page.screenshot({
      path: path.join(FRAMES_DIR, `frame${String(f).padStart(5,'0')}.jpg`),
      type: 'jpeg', quality: 90
    });
    f++;
    if (f % 10 === 0) {
      const e = ((Date.now()-start)/1000).toFixed(1);
      process.stdout.write(`\r  ${f} frames | ${e}s | ~${(f/parseFloat(e)).toFixed(1)}fps`);
    }
  }

  const actualDuration = (Date.now()-start)/1000;
  const sourceFPS = (f / actualDuration).toFixed(3);
  console.log(`\nCaptured ${f} frames in ${actualDuration.toFixed(1)}s -> ${sourceFPS}fps`);
  await browser.close();

  console.log('Encoding intermediate...');
  const intermediate = '/tmp/intermediate-noch.mp4';
  await ffmpegRun([
    '-y',
    '-framerate', sourceFPS,
    '-i', path.join(FRAMES_DIR, 'frame%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-pix_fmt', 'yuv420p',
    intermediate,
  ]);

  console.log('\nInterpolating to 30fps...');
  const interpolated = '/tmp/interpolated-noch.mp4';
  await ffmpegRun([
    '-y',
    '-i', intermediate,
    '-vf', 'minterpolate=fps=30:mi_mode=blend',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-pix_fmt', 'yuv420p',
    interpolated,
  ]);

  console.log('\nScaling to 1080x1920...');
  await ffmpegRun([
    '-y', '-i', interpolated,
    '-vf', 'scale=1080:1920:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT_VIDEO,
  ]);

  const mb = (fs.statSync(OUT_VIDEO).size/1024/1024).toFixed(1);
  console.log(`\nDone: ${OUT_VIDEO} (${mb} MB)`);

  fs.rmSync(FRAMES_DIR, { recursive: true });
  fs.unlinkSync(intermediate);
  fs.unlinkSync(interpolated);
})().catch(e => { console.error(e); process.exit(1); });

function ffmpegRun(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args);
    ff.stderr.on('data', d => process.stdout.write('.'));
    ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
  });
}
