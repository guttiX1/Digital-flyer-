const puppeteer = require('puppeteer');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FFMPEG = require('ffmpeg-static');
const HTML = path.resolve(__dirname, 'events/doble-rr-jun20/video-ad.html');
const OUT_DIR = path.resolve(__dirname, '/tmp/frames');
const OUT_VIDEO = path.resolve(__dirname, 'events/doble-rr-jun20/gran-final-doble-rr.mp4');

// Total duration in ms (sum of all scene durations except Infinity end card)
// Scenes: 550+620+1250+2000+2000+2000+2000+2000+850+780+2700 = 16750ms, plus 3s end card
const TOTAL_MS = 16750 + 3000;
const FPS = 30;
const TOTAL_FRAMES = Math.ceil((TOTAL_MS / 1000) * FPS);
const WIDTH = 1080;
const HEIGHT = 1920; // 9:16 portrait for mobile/Facebook Reels

if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  console.log(`Launching browser — ${TOTAL_FRAMES} frames at ${FPS}fps (${(TOTAL_MS/1000).toFixed(1)}s)...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--window-size=${WIDTH},${HEIGHT}`,
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  // Override Date/performance so animation time is controllable
  await page.goto(`file://${HTML}`, { waitUntil: 'networkidle0' });

  // Pause the auto-advance timer — we'll drive it frame by frame via fake time
  // Instead: let the page run normally but scrub through using virtual clock
  // Simplest reliable approach: use requestAnimationFrame-based screenshot loop

  // Inject a frame controller that replaces setTimeout/setInterval with fake clock
  await page.evaluate((totalMs) => {
    // Stop the real timer-based auto-advance; we'll control it manually
    // by directly calling goTo() on a schedule we control
    window.__frameTime = 0;
    // Override the skip button visibility
    const skip = document.getElementById('skip');
    if (skip) skip.style.display = 'none';
    const replay = document.getElementById('replay');
    if (replay) replay.style.display = 'none';
    const prog = document.getElementById('prog');
    if (prog) prog.style.display = 'none';
  }, TOTAL_MS);

  const SCENE_TIMES = [0, 550, 1170, 2420, 4420, 6420, 8420, 10420, 12420, 13270, 14050, 16750];
  // End card shows from 16750 to 19750 (3s)

  let lastScene = -1;

  console.log('Capturing frames...');
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const t = (f / FPS) * 1000; // current time in ms

    // Determine which scene we should be on
    let sceneIdx = SCENE_TIMES.length - 1;
    for (let s = 0; s < SCENE_TIMES.length; s++) {
      if (t < SCENE_TIMES[s + 1] || s === SCENE_TIMES.length - 1) {
        sceneIdx = s;
        break;
      }
    }

    if (sceneIdx !== lastScene) {
      await page.evaluate((idx) => {
        if (typeof goTo === 'function') goTo(idx);
      }, sceneIdx);
      lastScene = sceneIdx;
      // Small wait for CSS animations to start
      await new Promise(r => setTimeout(r, 80));
    }

    const framePath = path.join(OUT_DIR, `frame${String(f).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath, type: 'png' });

    if (f % 30 === 0) process.stdout.write(`\r  Frame ${f}/${TOTAL_FRAMES} (${Math.round(t/1000)}s)`);
  }

  await browser.close();
  console.log(`\nAll frames captured. Encoding MP4...`);

  await new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, [
      '-y',
      '-framerate', String(FPS),
      '-i', path.join(OUT_DIR, 'frame%05d.png'),
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-vf', `scale=${WIDTH}:${HEIGHT}`,
      '-movflags', '+faststart',
      OUT_VIDEO
    ]);
    ff.stderr.on('data', d => process.stdout.write('.'));
    ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });

  const size = (fs.statSync(OUT_VIDEO).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ Done! Video saved: ${OUT_VIDEO} (${size} MB)`);

  // Cleanup frames
  fs.rmSync(OUT_DIR, { recursive: true });
})().catch(e => { console.error(e); process.exit(1); });
