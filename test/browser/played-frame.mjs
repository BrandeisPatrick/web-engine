// The played frame (`npm run check:full`): the two city demos as a player gets them, timed by their frame intervals.
// `npm run perf` times GPU-synchronised renders, so it cannot see a main thread that waits on the GPU in the middle of
// a frame; this can. It came from a stall that made nyc-night's played frame 16 ms for 9 ms of GPU work: three read
// the unpack pixel-store state with gl.getParameter on every partial texture upload, a round trip to the GPU process
// each time (src/core/PixelStoreShadow.js now answers those reads).
//
// Per page (bench/budgets.json "played"): the production build (dist/, built first when it is missing or older than a
// source file) served as static files, headless Chrome on the real GPU with vsync and the frame-rate limit off (a
// frame then takes as long as its work), 1920x1080 at DPR 1, `?autostart=1&quality=desktop`, the camera at the
// start. After `warm` ms of play the rAF intervals over `window` ms give the median and the p95, each held to the
// page's budget. Also counted in that window, by a wrapper on the WebGL2 prototype installed before the page's
// scripts (so a call the shadow answers is not counted): gl.getParameter round trips for the unpack pixel-store state,
// which must be 0, and the other calls that read state back from the context (getParameter of anything else,
// getError, readPixels, checkFramebufferStatus, get*Parameter, clientWaitSync, getBufferSubData, finish), reported per
// frame (the profiler's GPU timer reads, GPU_DISJOINT_EXT and getQueryParameter, are answered without a wait).
// Takes about 30 s. Run it through the machine's GPU lock when other GPU jobs share the machine: their load moves the
// intervals.
//   node test/browser/played-frame.mjs [page ...] [--json]
// Exit code: 0 within budget, 1 over budget, a round trip, an error or a page that did not load.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { repoRoot, headlessArgs, parseArgs, launchChrome, watchErrors, loadSample, withTimeout, onSignals, formatTable } from './playwright.config.mjs';

const args = parseArgs();
const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'bench', 'budgets.json'), 'utf8')).played;
const pages = args._.length ? args._ : Object.keys(cfg.pages);
for (const p of pages) if (!cfg.pages[p]) { console.error(`[played-frame] unknown page '${p}' (bench/budgets.json played: ${Object.keys(cfg.pages).join(', ')})`); process.exit(1); }
const [W, H] = cfg.size.split('x').map(Number);
const dist = path.join(repoRoot, 'dist');

// ------------------------------------------------------------------------------------------- production build
/** Newest modification time (ms) of a file under `dir`, skipping folders named in `skip`. */
function newest(dir, skip) {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!skip.has(p)) t = Math.max(t, newest(p, skip)); } else t = Math.max(t, fs.statSync(p).mtimeMs);
  }
  return t;
}
const builtAt = fs.existsSync(path.join(dist, 'index.html')) ? fs.statSync(path.join(dist, 'index.html')).mtimeMs : 0;
const sourceAt = Math.max(newest(path.join(repoRoot, 'src'), new Set()), newest(path.join(repoRoot, 'samples'), new Set([path.join(repoRoot, 'samples', 'public')])));
if (builtAt < sourceAt) {
  console.log(`[played-frame] ${builtAt ? 'dist/ is older than the sources' : 'no dist/'}: npm run build`);
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

// ------------------------------------------------------------------------------------------------ static server
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!p.startsWith(dist) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// ------------------------------------------------------------------------------------------------ in-page parts
// before the page's scripts: count the synchronous WebGL calls that reach the context while __played.on
function countSyncCalls() {
  const S = window.__played = { on: false, unpack: 0, other: {} };
  const UNPACK = new Set([0x0cf2, 0x0cf3, 0x0cf4, 0x806d, 0x806e]); // ROW_LENGTH, SKIP_ROWS, SKIP_PIXELS, SKIP_IMAGES, IMAGE_HEIGHT
  const SYNC = ['getParameter', 'getError', 'readPixels', 'checkFramebufferStatus', 'getProgramParameter', 'getShaderParameter',
    'getQueryParameter', 'getSyncParameter', 'clientWaitSync', 'getBufferSubData', 'getFramebufferAttachmentParameter', 'finish'];
  for (const G of [window.WebGL2RenderingContext && WebGL2RenderingContext.prototype]) {
    if (!G) continue;
    for (const n of SYNC) {
      const o = G[n]; if (typeof o !== 'function') continue;
      G[n] = function (p) {
        if (S.on) {
          if (n === 'getParameter' && UNPACK.has(p)) S.unpack++;
          else { const k = n === 'getParameter' ? `getParameter(0x${Number(p).toString(16)})` : n; S.other[k] = (S.other[k] || 0) + 1; }
        }
        return o.apply(this, arguments);
      };
    }
  }
}
// the window: rAF intervals for `ms`, with the calls counted
function playWindow(ms) {
  return new Promise((resolve) => {
    const S = window.__played, t = [], end = performance.now() + ms;
    S.unpack = 0; S.other = {}; S.on = true;
    const f = (x) => { t.push(performance.now()); if (t.at(-1) < end) requestAnimationFrame(f); else { S.on = false; done(); } };
    const done = () => {
      const e = window.__sample.engine, gl = e.renderer.getContext();
      resolve({ t, unpack: S.unpack, other: S.other, buffer: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`, shadow: !!e.pixelStore, pixelRatio: e.pixelRatio });
    };
    requestAnimationFrame(f);
  });
}

// ---------------------------------------------------------------------------------------------------------- run
const browser = await launchChrome({ headless: true, args: [...headlessArgs, '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
onSignals(async () => { await browser.close().catch(() => {}); server.close(); });
const rows = [], problems = [], out = [];
const q = (s, p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
try {
  for (const id of pages) {
    const b = cfg.pages[id], t0 = Date.now();
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.addInitScript(countSyncCalls);
    const session = await loadSample(page, `${base}/${id}/?autostart=1&quality=desktop`, errors);
    if (session.status !== 'ready') { problems.push(`${id}: not ready (${session.note})`); rows.push({ page: id, result: 'FAIL', note: session.note }); await ctx.close(); continue; }
    await page.waitForTimeout(cfg.warm);
    const r = await withTimeout(page.evaluate(playWindow, cfg.window), cfg.window + 30000, `${id} window`);
    await ctx.close();
    const d = r.t.slice(1).map((x, i) => x - r.t[i]), s = [...d].sort((x, y) => x - y);
    const med = q(s, 0.5), p95 = q(s, 0.95), mean = d.reduce((x, y) => x + y, 0) / d.length, n = d.length;
    const other = Object.values(r.other).reduce((x, y) => x + y, 0) / n;
    const bad = [];
    if (errors.length) bad.push(`${errors.length} page error(s): ${errors[0]}`);
    if (r.buffer !== cfg.size) bad.push(`drawing buffer ${r.buffer}, not ${cfg.size}`);
    if (!r.shadow) bad.push('engine.pixelStore is not installed');
    if (r.unpack > 0) bad.push(`${r.unpack} getParameter round trips for the unpack pixel-store state (${(r.unpack / n).toFixed(1)} per frame): the stall is back`);
    if (med > b.median) bad.push(`median ${med.toFixed(1)} ms over its budget of ${b.median}`);
    if (p95 > b.p95) bad.push(`p95 ${p95.toFixed(1)} ms over its budget of ${b.p95}`);
    for (const x of bad) problems.push(`${id}: ${x}`);
    rows.push({ page: id, frames: n, median: med.toFixed(1), p95: p95.toFixed(1), budget: `${b.median} / ${b.p95}`, fps: (1000 / mean).toFixed(0),
      'unpack reads': r.unpack, 'other reads / frame': other.toFixed(1), s: ((Date.now() - t0) / 1000).toFixed(0), result: bad.length ? 'FAIL' : 'pass' });
    out.push({ page: id, frames: n, medianMs: +med.toFixed(2), p95Ms: +p95.toFixed(2), meanMs: +mean.toFixed(2), budget: b, unpackReads: r.unpack,
      otherReadsPerFrame: Object.fromEntries(Object.entries(r.other).map(([k, v]) => [k, +(v / n).toFixed(2)])), buffer: r.buffer });
  }
} catch (e) {
  problems.push(`error: ${e && e.message ? e.message.split('\n')[0] : e}`);
} finally {
  await browser.close().catch(() => {});
  server.close();
}
if (args.json) console.log(JSON.stringify(out, null, 2));
console.log(`\nplayed frame, ${cfg.size} at DPR 1, vsync off, ${cfg.window / 1000} s after ${cfg.warm / 1000} s of play (budget: median / p95 ms)\n`);
console.log(formatTable(rows));
for (const o of out) if (Object.keys(o.otherReadsPerFrame).length) console.log(`${o.page}: other reads per frame ${JSON.stringify(o.otherReadsPerFrame)}`);
if (problems.length) { console.log(`\nFAIL\n${problems.map((p) => `  ${p}`).join('\n')}`); process.exitCode = 1; } else console.log('\nplayed frame: pass');
