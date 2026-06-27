/**
 * CDP Screencast recorder — uses Chrome's native Page.startScreencast
 * which delivers JPEG frames via events at Chrome's actual render rate.
 * Encodes frames to MP4 using OpenCV (python3 -c ...) — no system ffmpeg needed.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

const EVENT    = 'comandante-vs-pilloncillo';
const HTML     = `file://${path.resolve(__dirname, `events/${EVENT}/tiktok-fuego.html`)}`;
const FRAMES   = '/tmp/cdpframes';
const OUT      = path.resolve(__dirname, `events/${EVENT}/tiktok-fuego.mp4`);
const W = 540, H = 960;
const DURATION = 32000;

if (fs.existsSync(FRAMES)) fs.rmSync(FRAMES, { recursive: true });
fs.mkdirSync(FRAMES, { recursive: true });

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${W},${H}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto(HTML, { waitUntil: 'networkidle0' });

  // Open CDP session
  const client = await page.createCDPSession();

  let frameNum = 0;
  let capturing = true;
  const timestamps = [];

  client.on('Page.screencastFrame', async (event) => {
    if (!capturing) return;
    const fname = path.join(FRAMES, `f${String(frameNum).padStart(5,'0')}.jpg`);
    fs.writeFileSync(fname, Buffer.from(event.data, 'base64'));
    timestamps.push(event.metadata.timestamp);
    frameNum++;
    if (frameNum % 20 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r  ${frameNum} frames | ${elapsed}s`);
    }
    // Ack each frame so Chrome keeps sending
    try {
      await client.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    } catch(_) {}
  });

  // Start CDP screencast at max quality
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 88,
    maxWidth: W * 2,   // deviceScaleFactor:2
    maxHeight: H * 2,
    everyNthFrame: 1,
  });

  const startTime = Date.now();
  console.log(`CDP screencast started — recording ${DURATION/1000}s...`);
  await new Promise(r => setTimeout(r, DURATION));

  capturing = false;
  await client.send('Page.stopScreencast');
  await browser.close();

  const elapsed = (Date.now() - startTime) / 1000;
  const fps = (frameNum / elapsed).toFixed(2);
  console.log(`\nCaptured ${frameNum} frames in ${elapsed.toFixed(1)}s → ${fps} fps`);

  if (frameNum < 10) {
    console.error('Too few frames captured, aborting.');
    process.exit(1);
  }

  // Encode with OpenCV via Python (no system ffmpeg needed)
  console.log('Encoding MP4 with OpenCV...');
  const pyScript = `
import cv2, glob, os, sys

frames_dir = '${FRAMES}'
out_path   = '${OUT}'
fps_in     = ${fps}

files = sorted(glob.glob(os.path.join(frames_dir, 'f*.jpg')))
if not files:
    print('No frames found', file=sys.stderr)
    sys.exit(1)

first = cv2.imread(files[0])
h, w = first.shape[:2]
print(f'Frame size: {w}x{h}, count: {len(files)}, fps: {fps_in:.2f}')

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
writer = cv2.VideoWriter(out_path, fourcc, float(fps_in), (w, h))
for i, f in enumerate(files):
    img = cv2.imread(f)
    if img is not None:
        writer.write(img)
    if (i+1) % 50 == 0:
        print(f'  encoded {i+1}/{len(files)}')

writer.release()
print(f'Done: {out_path}')
`;

  const py = spawn('python3', ['-c', pyScript]);
  py.stdout.on('data', d => process.stdout.write(d.toString()));
  py.stderr.on('data', d => process.stderr.write(d.toString()));
  await new Promise((res, rej) => py.on('close', code => code === 0 ? res() : rej(new Error(`python exit ${code}`))));

  fs.rmSync(FRAMES, { recursive: true });

  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅  ${OUT}  (${mb} MB)`);
})().catch(e => { console.error(e); process.exit(1); });
