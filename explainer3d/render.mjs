#!/usr/bin/env node
// Frame-by-frame renderer: headless Chromium (WebGL via SwiftShader) -> JPEG frames -> ffmpeg (H.264 1080x1920) + audio.
// Usage:
//   node render.mjs <projectDir> [--out video.mp4] [--from 0] [--to 30] [--stills 1.2,4.5,9] [--fps 30] [--workers N]
// <projectDir> must contain timeline.json and scene.js (see SKILL.md).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const projectDir = path.resolve(args[0] || '.');
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(opt('out', path.join(projectDir, 'out.mp4')));
const stills = opt('stills', null);

// locate three.js
const cands = [process.env.THREE_DIR, path.join(projectDir, 'node_modules'), path.join(process.cwd(), 'node_modules'), path.join(HERE, 'node_modules')].filter(Boolean);
const modulesDir = cands.find(d => fs.existsSync(path.join(d, 'three/build/three.module.js')));
if (!modulesDir) { console.error('three.js not found. Run: npm i three@0.170.0  (in the project or current folder)'); process.exit(1); }

// locate playwright (local or global)
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const g = execSync('npm root -g').toString().trim();
  ({ chromium } = createRequire(path.join(g, 'x.js'))('playwright'));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f;
  if (u === '/' || u === '/index.html') f = path.join(HERE, 'engine/index.html');
  else if (u.startsWith('/engine/')) f = path.join(HERE, u);
  else if (u.startsWith('/node_modules/')) f = path.join(modulesDir, u.slice('/node_modules/'.length));
  else if (u.startsWith('/project/')) f = path.join(projectDir, u.slice('/project/'.length));
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + u); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// GPU=1 uses the real GPU (much faster on a Mac/PC with a graphics card); default is SwiftShader (CPU, works everywhere)
const glArgs = process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// cloud container: use the preinstalled Chromium (CHROMIUM_PATH overrides)
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ args: glArgs, headless: true, ...(exe ? { executablePath: exe } : {}) });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/?project=project`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error(err); process.exit(1); }
const info = await page.evaluate(() => window.__info);
const fps = Number(opt('fps', info.fps));
const timeline = JSON.parse(fs.readFileSync(path.join(projectDir, 'timeline.json'), 'utf8'));
const root = await page.$('#root');

if (stills) {
  const dir = path.join(projectDir, 'stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(',').map(Number)) {
    await page.evaluate(i => window.__renderFrame(i), Math.round(s * info.fps));
    const f = path.join(dir, `still_${s.toFixed(2)}.png`); await root.screenshot({ path: f }); console.log(f);
  }
  await browser.close(); server.close(); process.exit(0);
}

const from = Math.round(Number(opt('from', 0)) * fps);
const to = Math.min(info.frames, Math.round(Number(opt('to', info.duration)) * fps));
const silent = path.join(projectDir, '.video_noaudio.mp4');
// parallel workers: each renders a contiguous chunk in its own page (own renderer process) -> segment, then concat
const workers = Math.max(1, Number(opt('workers', Math.max(1, Math.min(6, (await import('node:os')).cpus().length - 1)))));
const t0 = Date.now(); let done = 0;
async function renderChunk(pg, a, b, file) {
  const rt = await pg.$('#root');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = a; i < b; i++) {
    await pg.evaluate(n => window.__renderFrame(n), Math.round(i * info.fps / fps));
    const buf = await rt.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 15 === 0) { const el = (Date.now() - t0) / 1000; process.stdout.write(`\r${done}/${to - from} frames  ${(done / el).toFixed(1)} fps  eta ${Math.round((to - from - done) / (done / el))}s   `); }
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
const pages = [page];
for (let k = 1; k < workers; k++) {
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${port}/?project=project`);
  await p.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
  pages.push(p);
}
const n = to - from, size = Math.ceil(n / workers), segs = [];
await Promise.all(pages.map((p, k) => {
  const a = from + k * size, b = Math.min(to, a + size); if (a >= b) return null;
  const f = path.join(projectDir, `.seg_${k}.mp4`); segs[k] = f; return renderChunk(p, a, b, f);
}));
const list = path.join(projectDir, '.segs.txt');
fs.writeFileSync(list, segs.filter(Boolean).map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', silent], { stdio: 'inherit' });
segs.filter(Boolean).forEach(f => fs.unlinkSync(f)); fs.unlinkSync(list);
await browser.close(); server.close();

// mux audio: voice (timeline.audio) + optional music bed (timeline.music, timeline.musicVolume)
const voice = timeline.audio && path.join(projectDir, timeline.audio);
const music = timeline.music && path.join(projectDir, timeline.music);
const ss = (from / fps).toFixed(3), dur = ((to - from) / fps).toFixed(3);
const inputs = ['-i', silent]; let filter = null, maps = ['-map', '0:v'];
if (voice && fs.existsSync(voice)) inputs.push('-ss', ss, '-t', dur, '-i', voice);
if (music && fs.existsSync(music)) inputs.push('-ss', ss, '-t', dur, '-i', music);
const nA = (inputs.filter(x => x === '-i').length) - 1;
if (nA === 1) maps.push('-map', '1:a');
if (nA === 2) { filter = `[2:a]volume=${timeline.musicVolume ?? 0.12}[m];[1:a][m]amix=inputs=2:duration=first:normalize=0[a]`; maps.push('-map', '[a]'); }
if (nA === 0) fs.renameSync(silent, out);
else {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...inputs, ...(filter ? ['-filter_complex', filter] : []), ...maps, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg mux failed'); process.exit(1); }
  fs.unlinkSync(silent);
}
console.log(`\nDone -> ${out}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
