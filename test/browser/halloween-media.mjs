// Social media capture for Midnight Candy Run (samples/halloween/): stills and short videos for X, LinkedIn and
// Instagram, rendered frame by frame in headless Chrome (the game's loop is stopped and engine.tick(1/30) is called by
// hand, the HUD's CSS animations are stepped by the same 1/30 s), so every frame is sharp and the clips play at an even
// 30 fps however slow the GPU readback is. Input is real: CDP touches on the phone layouts (a floating-stick left
// thumb steering in smooth arcs, a right thumb tapping BOO / JUMP), keys + a right-button mouse look on desktop.
//
//   node test/browser/halloween-media.mjs                     # build, serve, capture everything (a few minutes)
//   node test/browser/halloween-media.mjs --only=hero,xclip   # hero | xclip | reel (+ the story) | ig
//   --out=<dir>        final assets (default ../social/halloween-2026 next to this repository)
//   --work=<dir>       build + frames (default <tmp>/halloween-media; the build goes to <work>/media-build)
//   --no-build         reuse the existing build in <work>/media-build
//   --port=<n>         first port to try for the static server (default 8095)
//   --seed=<n>         Math.random seed in the page (default 7)   --no-captions   IG slides without the text column
//   --keep-frames      keep the video frames (<work>/frames/<clip>/)   --headed   show the browser
//
// It builds its own copy (vite build --outDir <work>/media-build) and serves it with python3 -m http.server on
// 127.0.0.1, so it never touches dist/ or the dev server. Scenes are staged through window.__game (the test hook):
// a short bot pre-roll (real play, the candy counter is earned), then the kid is placed on a fixed route from the
// spawn to the graveyard gate (moon ahead), candy is laid along it, two ghosts rise from graves ahead, chase, and
// get BOOed. The results screen comes from a full round played to midnight by the same bot. No audio.
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { devices } from 'playwright';
import { repoRoot, parseArgs, launchChrome, headlessArgs, headedArgs, withTimeout, onSignals } from './playwright.config.mjs';

const args = parseArgs();
const OUT = path.resolve(String(args.out || path.join(repoRoot, '../social/halloween-2026')));
const WORK = path.resolve(String(args.work || path.join(os.tmpdir(), 'halloween-media')));
const BUILD = path.join(WORK, 'media-build');
const FRAMES = path.join(WORK, 'frames');
const STILLS = path.join(WORK, 'stills');
const ONLY = new Set(String(args.only || 'hero-clean,hero,xclip,reel,ig').split(',').map((s) => s.trim()));
const SEED = Number.isFinite(+args.seed) ? +args.seed : 7;
const CAPTIONS = !args['no-captions'];
const FPS = 30, DT = 1 / FPS;
const T0 = Date.now();
const log = (...a) => console.log(`[media ${String(Math.round((Date.now() - T0) / 1000)).padStart(4)} s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const d of [OUT, WORK, FRAMES, STILLS]) fs.mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------------------------------------------- layouts
const LAYOUTS = {
  // X / LinkedIn hero: the desktop layout at 1200 x 675 CSS px, rendered at 3x and downscaled
  hero: { viewport: { width: 1200, height: 675 }, deviceScaleFactor: 3 },
  // X / LinkedIn clip: desktop 16:9, rendered at 2x (2560 x 1440) and downscaled to 1280 x 720
  xclip: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
  // the clean hero: a 16:9 phone in landscape (iPhone 8 Plus, 736 x 414) with the touch controls, rendered at 4x
  herotouch: { ...devices['iPhone 8 Plus landscape'], viewport: { width: 736, height: 414 }, screen: { width: 736, height: 414 }, deviceScaleFactor: 4 },
  // Instagram carousel: an iPhone 13 running the game full screen (home-screen web app), notch insets
  ig: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3,
    safe: { top: 47, bottom: 34, left: 0, right: 0 } },
  // Reel: a 9:16 phone (iPhone 8 Plus, 414 x 736) full screen, rendered at 3x and downscaled to 1080 x 1920
  reel: { ...devices['iPhone 8 Plus'], viewport: { width: 414, height: 736 }, screen: { width: 414, height: 736 }, deviceScaleFactor: 3 },
};

// Routes (world metres, x east / z south). VIDEO: from the south field, a JUMP onto the jack-o'-lantern at (-4, 28)
// (a stomp), up the path past the spawn, straight through the lantern at (4.5, -3.5) (a kick; heading NNE, toward the
// moon), east along the graveyard fence where two ghosts rise from the first row of graves, come over the fence and get
// BOOed in the open, then north through the gate and up the aisle to a big lollipop. HERO: the shorter route the
// approved desktop hero was shot on (its ghosts close in at the gate).
const ROUTES = {
  video: {
    pts: [[-5.5, 41.5], [-4.8, 35], [-4, 28], [-2.6, 22], [-0.6, 15.5], [0.9, 9], [2.4, 3], [4.5, -3.5], [9, -4.4], [13.4, -4.2], [16, -5.4], [16, -10.8], [16, -16], [16, -21]],
    stomp: [-4, 28], kick: [4.5, -3.5], riseAt: 8, graves: [[13.2, -14.8], [19.6, -14.3]], pop: [16, -15.2], skipR: 2.6, to: 90,
  },
  hero: {
    pts: [[-1.2, 29], [0.3, 23.5], [1.8, 17], [1.0, 10.5], [0.6, 6], [2.6, 1.0], [4.5, -3.5], [8.4, -6.3], [12.6, -8.6], [16.0, -10.8], [16.0, -17], [16.0, -24]],
    stomp: null, kick: [4.5, -3.5], riseAt: 5, graves: [[12.5, -18], [20, -18]], pop: [16.0, -15.5], skipR: 2.2, to: 75,
  },
};
const GHOST_GRAVES = ROUTES.hero.graves;

// IG slide text (kicker, headline, sub). Plain claims only: everything here is in the game.
const IG_TEXT = {
  'ig-1-title': ['HALLOWEEN NIGHT', 'Midnight Candy Run', 'A 3-minute candy dash through a haunted pumpkin patch. Plays in the browser, phone or desktop.'],
  'ig-2-gameplay': ['11:57 PM', 'Grab every sweet before midnight', 'Run the moonlit patch and the graveyard. Candy flies into your pail.'],
  'ig-3-boo': ['GHOSTS!', 'Let them close in. Then BOO!', 'Bedsheet ghosts of real simulated cloth chase you down. A BOO sends them flying.'],
  'ig-4-smash': ['SMASH!', 'Kick a jack-o\'-lantern', 'It breaks into real physics pieces and the candy spills out.'],
  'ig-5-results': ['12:00 AM', 'How much candy can you carry?', 'The clock strikes twelve. Beat your best score.'],
};

// ---------------------------------------------------------------------------------------------------- in-page helpers
/** Runs before the game's scripts: seeded Math.random, optional no-fullscreen (iPhone Safari), window.__media. */
function mediaInit({ seed, noFullscreen }) {
  let s = seed >>> 0;
  Math.random = function random() { // mulberry32
    s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (noFullscreen) {
    for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) {
      try { Object.defineProperty(Document.prototype, k, { configurable: true, get: () => false }); } catch { /* ignore */ }
    }
  }
  const animT = new WeakMap();
  const S = { sx: 0, sy: 0 };
  let _f = null, _r = null;
  const basis = () => {
    const g = window.__game;
    if (!_f) { _f = new g.THREE.Vector3(); _r = new g.THREE.Vector3(); }
    g.rig.getForward(_f); g.rig.getRight(_r);
    return [_f, _r];
  };
  const M = window.__media = {
    ready: () => !!(window.__game && !document.querySelector('.ui-loading')),
    /** Stop the game's own loop and adaptive resolution; render at a fixed pixel ratio. */
    setup(pr) {
      const e = window.__game.engine;
      e.stop(); e.adaptive = false; e.maxPR = pr; e.setPixelRatio(pr);
      return { pr: e.pixelRatio, w: e.renderer.domElement.width, h: e.renderer.domElement.height, touch: window.__game.TOUCH, low: window.__game.LOW };
    },
    /** Advance every CSS animation / transition by ms of virtual time (they are paused and driven by hand). */
    stepAnims(ms) {
      for (const a of document.getAnimations()) {
        let t = animT.get(a);
        if (t === undefined) { a.pause(); t = a.currentTime || 0; } else t += ms;
        try { a.currentTime = t; } catch { /* ignore */ }
        animT.set(a, t);
      }
    },
    /** n frames of dt: engine.tick + CSS animations. Returns a snapshot. */
    frame(dt, n = 1) {
      const e = window.__game.engine;
      for (let i = 0; i < n; i++) { e.tick(dt); M.stepAnims(dt * 1000); }
      return M.snap();
    },
    snap() {
      const g = window.__game, G = g.G, p = g.cc.position, v = g.cc.velocity, [f] = basis();
      let chaser = Infinity, awake = 0;
      for (const q of g.ghosts.list) {
        if (q.state === 'dormant') continue;
        awake++;
        if (q.state === 'chase' || q.state === 'wander') chaser = Math.min(chaser, Math.hypot(q.x - p.x, q.z - p.z) + (q.state === 'chase' ? 0 : 100));
      }
      const call = document.querySelector('.hw-call'), callout = call ? +getComputedStyle(call).opacity : 0;
      return { callout, state: G.state, t: G.time, left: G.left, candy: G.candy, smashed: G.smashed, booed: G.booed, caught: G.caught, pops: G.pops, booT: G.booT,
        x: p.x, y: p.y, z: p.z, speed: Math.hypot(v.x, v.z), grounded: g.cc.grounded, yaw: g.rig.yaw, fx: f.x, fz: f.z, chaser, awake,
        ghosts: g.ghosts.list.filter((q) => q.state !== 'dormant').map((q) => ({ k: q.k, state: q.state, x: +q.x.toFixed(2), z: +q.z.toFixed(2) })) };
    },
    /** Stick (x right, y forward, camera-relative), eased toward the direction of (tx, tz) at strength mag. */
    plan({ tx, tz, mag = 1, smooth = 6, dt }) {
      const g = window.__game, p = g.cc.position, [f, r] = basis();
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1e-6, ux = dx / d, uz = dz / d;
      const wx = ux * r.x + uz * r.z, wy = ux * f.x + uz * f.z;
      const k = 1 - Math.exp(-smooth * dt);
      S.sx += (wx * mag - S.sx) * k; S.sy += (wy * mag - S.sy) * k;
      const l = Math.hypot(S.sx, S.sy); if (l > 1) { S.sx /= l; S.sy /= l; }
      return { sx: S.sx, sy: S.sy, err: Math.atan2(wx, wy), d };
    },
    resetStick() { S.sx = 0; S.sy = 0; },
    /** Round state for staging: no scheduled ghosts or big pops (the director stages them). */
    calm() { const G = window.__game.G; G.wakeIdx = 99; G.popT = 1e9; },
    /** Put the kid at (x, z) facing (and the camera looking) along yaw; clears ghosts, shards and candy near the route. */
    place(x, z, yaw, pitch = -0.2) {
      const g = window.__game;
      g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); g.cc.velocity.set(0, 0, 0);
      g.camState.facing = yaw; g.player.rotation.y = yaw; g.rig.yaw = yaw; g.rig.pitch = pitch; g.rig.snap();
      g.ghosts.reset(); g.lanterns.reset(); g.G.safeT = 0; S.sx = 0; S.sy = 0;
    },
    /** Lay candy along a polyline (every `step` m, alternating `side` m left / right), skipping near `skip` points. */
    layCandy(pts, { step = 1.9, side = 0.55, from = 0, to = Infinity, skip = [], skipR = 2.2, pop = null } = {}) {
      const g = window.__game, C = g.candy, H = g.world.heightAt;
      let acc = 0, n = 0, run = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
        for (let s = step - acc; s <= L; s += step) {
          const at = run + s;
          if (at < from || at > to) continue;
          const x0 = ax + (bx - ax) * s / L, z0 = az + (bz - az) * s / L;
          if (skip.some(([qx, qz]) => Math.hypot(qx - x0, qz - z0) < skipR)) continue;
          const o = (n % 2 ? 1 : -1) * side * (0.6 + 0.4 * Math.sin(n * 1.7)), x = x0 + nx * o, z = z0 + nz * o;
          if (g.physics.queryColliders(x, z, 0.4, []).length) continue;
          C.place(x, H(x, z), z, n % 3 === 1 ? 1 : 0); n++;
        }
        acc = (acc + L) % step; run += L;
      }
      if (pop) C.place(pop[0], H(pop[0], pop[1]), pop[1], 2);
      return n;
    },
    /** Raise ghosts out of the graves nearest each point (the game's wake(), at a chosen grave). */
    rise(points) {
      const g = window.__game, gh = g.ghosts, p = g.cc.position, out = [];
      for (const [px, pz] of points) {
        const q = gh.list.find((o) => o.state === 'dormant'); if (!q) break;
        let best = null, bd = Infinity;
        for (const gr of g.world.graves) { const d = Math.hypot(gr.x - px, gr.z - pz); if (d < bd) { bd = d; best = gr; } }
        const x = best.x, z = best.z + 0.9, y = g.world.heightAt(x, z) - 1.2;
        q.yaw = Math.atan2(-(p.x - x), -(p.z - z));
        gh._teleport(q, x, y, z);
        q.state = 'rise'; q.t = 0; q.alpha = 0; q.calm = 0; q.mesh.mesh.visible = true; q.tx = x; q.tz = z;
        out.push([+x.toFixed(2), +z.toFixed(2)]);
      }
      return out;
    },
    /**
     * Play by itself for `seconds` (or until the round ends) through the input map's virtual stick / buttons (the
     * same path the touch controls write to): greedy for candy and lanterns, BOO when a chasing ghost comes within
     * 3.5 m, run from chasers while BOO recharges, jump out when stuck. render=false skips drawing (fast).
     */
    autoplay(seconds, { render = false, dt = 1 / 30 } = {}) {
      const g = window.__game, e = g.engine, G = g.G, m = g.input.map, C = g.candy, L = g.lanterns, p = g.cc.position;
      const rf = e.renderFn; if (!render) e.renderFn = () => {};
      const steps = Math.round(seconds / dt);
      let tgt = null, tgtT = 0, lastX = p.x, lastZ = p.z, checkT = 0, detourT = 0, detourA = 0, sx = 0, sy = 0, jumpPulse = false, booPulse = false;
      const pick = () => {
        let best = null, bs = Infinity;
        for (let i = 0; i < C.state.length; i++) {
          const st = C.state[i]; if (st !== 1 && st !== 2) continue;
          const x = C.p[i * 3], z = C.p[i * 3 + 2], d = Math.hypot(x - p.x, z - p.z), s = d - (C.kind[i] === 2 ? 12 : 0);
          if (s < bs) { bs = s; best = { x, z }; }
        }
        for (let i = 0; i < L.n; i++) {
          if (!L.alive[i] || L.grow[i] < 1) continue;
          const d = Math.hypot(L.x[i] - p.x, L.z[i] - p.z) - 5;
          if (d < bs) { bs = d; best = { x: L.x[i], z: L.z[i] }; }
        }
        return best || { x: 0, z: 0 };
      };
      let i = 0;
      for (; i < steps && G.state === 'play'; i++) {
        let near = null, nd = Infinity;
        for (const q of g.ghosts.list) { if (q.state !== 'chase') continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < nd) { nd = d; near = q; } }
        const boo = near && nd < 3.5 && G.booT >= 4.99;
        if ((tgtT -= dt) <= 0 || !tgt) { tgt = pick(); tgtT = 0.4; }
        let dx = tgt.x - p.x, dz = tgt.z - p.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        if (near && G.booT < 4.99 && nd < 6) { const fx = p.x - near.x, fz = p.z - near.z, fl = Math.hypot(fx, fz) || 1; dx = dx * 0.4 + fx / fl * 1.6; dz = dz * 0.4 + fz / fl * 1.6; }
        if ((checkT += dt) > 0.8) { if (Math.hypot(p.x - lastX, p.z - lastZ) < 1.2 && detourT <= 0) { detourT = 0.9; detourA = (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random()); jumpPulse = true; } checkT = 0; lastX = p.x; lastZ = p.z; }
        if (detourT > 0) { detourT -= dt; const c = Math.cos(detourA), s = Math.sin(detourA); const nx = dx * c - dz * s, nz = dx * s + dz * c; dx = nx; dz = nz; }
        const [f, r] = basis(), wx = dx * r.x + dz * r.z, wy = dx * f.x + dz * f.z, k = 1 - Math.exp(-8 * dt);
        sx += (wx - sx) * k; sy += (wy - sy) * k;
        m.setVirtual('stick.x', sx); m.setVirtual('stick.y', -sy);
        m.setVirtual('boo', boo && !booPulse ? 1 : 0); booPulse = !!boo && !booPulse;
        m.setVirtual('jump', jumpPulse ? 1 : 0); jumpPulse = false;
        e.tick(dt); M.stepAnims(dt * 1000);
      }
      for (const v of ['stick.x', 'stick.y', 'boo', 'jump']) m.setVirtual(v, 0);
      e.renderFn = rf;
      return { ticks: i, ...M.snap() };
    },
  };
}

// ---------------------------------------------------------------------------------------------------- build + serve
function build() {
  log(`vite build -> ${BUILD}`);
  const r = spawnSync('npx', ['vite', 'build', '--outDir', BUILD, '--emptyOutDir', '--logLevel', 'warn'], { cwd: repoRoot, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('vite build failed');
}
const portFree = (p) => new Promise((res) => { const s = net.createServer().once('error', () => res(false)).once('listening', () => s.close(() => res(true))).listen(p, '127.0.0.1'); });
async function serve() {
  let port = +args.port || 8095;
  while (!(await portFree(port))) port++;
  const py = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: BUILD, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { const r = await fetch(`${base}/halloween/`); if (r.ok) return { py, base }; } catch { /* not up yet */ } await sleep(100); }
  py.kill(); throw new Error('static server did not start');
}

// ---------------------------------------------------------------------------------------------------- ffmpeg
function ff(argv, what) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${what})`);
}
/** Lanczos downscale of a still to w x h (PNG). */
const downscale = (src, dst, w, h) => ff(['-i', src, '-vf', `scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int`, dst], `downscale ${path.basename(src)}`);
/** JPEG frames -> H.264 (yuv420p, BT.709, 30 fps, high bitrate, fast start). */
function encode(dir, out, w, h) {
  ff(['-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'),
    '-vf', `scale=${w}:${h}:flags=lanczos+accurate_rnd:in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-maxrate', '40M', '-bufsize', '80M', '-profile:v', 'high', '-level', '4.2',
    '-g', String(FPS), '-r', String(FPS), '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', '-an', out], `encode ${path.basename(out)}`);
}

// ---------------------------------------------------------------------------------------------------- session
let browser = null, server = null;
const cleanup = async () => { if (browser) await browser.close().catch(() => {}); if (server) server.py.kill(); };
onSignals(cleanup);

async function openGame(name) {
  const L = LAYOUTS[name], phone = !!L.hasTouch;
  const { safe, ...ctxOpts } = L;
  const ctx = await browser.newContext({ ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(mediaInit, { seed: SEED, noFullscreen: phone });
  const cdp = await ctx.newCDPSession(page);
  if (safe) {
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safe.top, topMax: safe.top, bottom: safe.bottom, bottomMax: safe.bottom, left: safe.left, leftMax: safe.left, right: safe.right, rightMax: safe.right } }); }
    catch { log(`${name}: safe-area emulation unavailable in this Chrome (no notch insets)`); }
  }
  await page.goto(`${server.base}/halloween/?quality=high`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__media && window.__media.ready(), null, { timeout: 90000, polling: 100 });
  const info = await page.evaluate((pr) => window.__media.setup(pr), L.deviceScaleFactor);
  log(`${name}: ${L.viewport.width}x${L.viewport.height} css @${L.deviceScaleFactor}x -> canvas ${info.w}x${info.h}, touch ${info.touch}, quality ${info.low ? 'low' : 'high'}`);
  if (info.touch !== phone) throw new Error(`${name}: expected touch ${phone}, got ${info.touch}`);
  const S = { name, L, ctx, page, cdp, phone, errors, snap: null, vp: L.viewport };
  S.ev = (fn, arg) => withTimeout(page.evaluate(fn, arg), 120000, `${name} evaluate`);
  S.frame = async (n = 1) => (S.snap = await S.ev(([dt, k]) => window.__media.frame(dt, k), [DT, n]));
  S.raf = () => S.ev(() => new Promise((r) => requestAnimationFrame(() => r())));
  S.rect = (sel) => S.ev((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
  S.png = async (file) => { await page.screenshot({ path: file, type: 'png' }); return file; };
  S.close = async () => { await ctx.close(); };
  return S;
}

/** Touch fingers through CDP (Chrome turns them into pointer events with pointerType 'touch'). */
class Fingers {
  constructor(cdp) { this.cdp = cdp; this.f = new Map(); }
  send(type, pts) { return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 9, radiusY: 9, force: 1 })) }); }
  all() { return [...this.f.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })); }
  async down(id, x, y) { this.f.set(id, { x, y }); await this.send('touchStart', this.all()); }
  async move(id, x, y) { this.f.set(id, { x, y }); await this.send('touchMove', this.all()); }
  async up(id) { const p = this.f.get(id); if (!p) return; this.f.delete(id); await this.send('touchEnd', [{ id, x: p.x, y: p.y }]); }
  async upAll() { if (this.f.size) { this.f.clear(); await this.send('touchEnd', []); } }
  has(id) { return this.f.has(id); }
}

/** Phone controls: the left thumb on the floating stick, the right thumb taps BOO / JUMP. */
class PhoneController {
  constructor(S) { this.S = S; this.fingers = new Fingers(S.cdp); this.tapF = 0; this.tapId = 0; this.t = 0; }
  async init() {
    const S = this.S;
    const zone = await S.rect('.ui-touch-zone'), boo = await S.rect('.hw-boo-btn'), jump = await S.rect('.ui-touch-btn:not(.hw-boo-btn)');
    const radius = await S.ev(() => { const s = window.__game.input.touch.get('stick'); return (s && (s.radius || (s.cfg && s.cfg.radius))) || 58; });
    this.zone = zone; this.boo = boo; this.jump = jump; this.R = Math.min(60, radius) * 0.92;
    // where the left thumb rests: in the zone's lower part, and far enough left that the knob never enters the middle
    // third of the screen (the Story's link sticker goes in the lower middle)
    this.base = { x: Math.min(zone.x + zone.w * 0.46, S.vp.width / 3 - this.R - 6), y: zone.y + zone.h * 0.66 };
  }
  /** stick: null (thumb up) or { sx, sy } (x right, y forward); press: 'boo' | 'jump' starts a 3-frame tap. */
  async apply(stick, press) {
    const F = this.fingers; this.t += DT;
    if (stick) {
      // a thumb is not a robot: a slow wobble of a pixel or two, and never quite at the rim
      const wob = { x: Math.sin(this.t * 2.3) * 1.6 + Math.sin(this.t * 5.1) * 0.8, y: Math.cos(this.t * 1.9) * 1.4 };
      let { sx, sy } = stick; const l = Math.hypot(sx, sy); if (l > 1) { sx /= l; sy /= l; }
      const x = this.base.x + sx * this.R + wob.x, y = this.base.y - sy * this.R + wob.y;
      if (!F.has(1)) { await F.down(1, this.base.x + wob.x, this.base.y + wob.y); }
      await F.move(1, x, y);
    } else if (F.has(1)) await F.up(1);
    if (press && !this.tapF) {
      const b = press === 'boo' ? this.boo : this.jump;
      this.tapId = 2 + (this.tapId % 7); this.tapF = 3;
      await F.down(this.tapId + 10, b.cx - 4 + Math.sin(this.t * 7) * 3, b.cy + 3);
    } else if (this.tapF && --this.tapF === 0) await F.up(this.tapId + 10);
  }
  async release() { this.tapF = 0; await this.fingers.upAll(); }
}

/** Desktop controls: W held while running, right mouse button held to look (mouse x steers), E = BOO, Space = jump. */
class DesktopController {
  constructor(S) { this.S = S; this.w = false; this.held = false; this.mx = 0; this.my = 0; this.vx = 0; this.keyUp = null; }
  async init() {
    const { width, height } = this.S.vp; this.cx = width / 2; this.cy = height * 0.55; this.mx = this.cx; this.my = this.cy;
    await this.S.page.mouse.move(this.mx, this.my);
  }
  async apply(stick, press, err = 0) {
    const page = this.S.page, kb = page.keyboard;
    if (this.keyUp) { await kb.up(this.keyUp); this.keyUp = null; }
    const run = !!stick && Math.hypot(stick.sx, stick.sy) > 0.25;
    if (run !== this.w) { if (run) await kb.down('KeyW'); else await kb.up('KeyW'); this.w = run; }
    // mouse: turn toward the target, eased like a hand (rad -> px at the game's 0.002 rad / px)
    const want = stick ? Math.max(-0.07, Math.min(0.07, err * (1 - Math.exp(-3.2 * DT)))) / 0.002 : 0;
    this.vx += (want - this.vx) * (1 - Math.exp(-10 * DT));
    if (Math.abs(this.vx) > 0.15) {
      if (!this.held) { await page.mouse.down({ button: 'right' }); this.held = true; }
      if (this.mx + this.vx < 40 || this.mx + this.vx > this.S.vp.width - 40) { // out of desk: lift, recentre, press again
        await page.mouse.up({ button: 'right' }); this.mx = this.cx; await page.mouse.move(this.mx, this.my); await page.mouse.down({ button: 'right' });
      }
      this.mx += this.vx; await page.mouse.move(this.mx, this.my + Math.sin(this.mx * 0.05) * 0.6);
    }
    if (press) { this.keyUp = press === 'boo' ? 'KeyE' : 'Space'; await kb.down(this.keyUp); }
  }
  async release() { const kb = this.S.page.keyboard; if (this.w) await kb.up('KeyW'); this.w = false; if (this.keyUp) await kb.up(this.keyUp); this.keyUp = null; if (this.held) await this.S.page.mouse.up({ button: 'right' }); this.held = false; }
}

/** Pure pursuit along a polyline: the point `look` m ahead of the kid's projection (monotonic progress). */
function pursuit(P, st, x, z, look) {
  let best = { i: st.i, t: 0, d: Infinity };
  for (let i = st.i; i < Math.min(P.length - 1, st.i + 3); i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < best.d) best = { i, t, d };
  }
  st.i = best.i;
  let i = best.i, t = best.t, rem = look;
  while (i < P.length - 1) {
    const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]), avail = (1 - t) * L;
    if (avail >= rem) { t += rem / L; rem = 0; break; }
    rem -= avail; i++; t = 0;
  }
  if (i >= P.length - 1) { st.end = best.i === P.length - 2 && best.t > 0.98; return { x: P[P.length - 1][0], z: P[P.length - 1][1] }; }
  return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * t, z: P[i][1] + (P[i + 1][1] - P[i][1]) * t };
}

/**
 * Start a round with a real tap / click, earn some candy with the bot (off screen), then stage the route: the kid
 * placed `lead` m before route point `startAt`, candy laid along the route.
 */
async function stageRoute(S, { route = ROUTES.video, preroll = 22, startAt = 0, pop = true, pitch = -0.2, step = 2.6, side = 0.85 } = {}) {
  const start = await S.rect('.hw-start');
  if (S.phone) { const F = new Fingers(S.cdp); await F.down(1, start.cx, start.cy); await sleep(60); await F.up(1); }
  else await S.page.mouse.click(start.cx, start.cy);
  for (let i = 0; i < 40 && (await S.ev(() => window.__game.G.state)) !== 'play'; i++) { await S.raf(); await S.frame(); }
  await S.ev(() => window.__media.calm());
  const pre = await S.ev((sec) => window.__media.autoplay(sec), preroll);
  log(`${S.name}: pre-roll ${preroll} s of bot play: candy ${pre.candy}, lanterns ${pre.smashed}`);
  const P = route.pts.slice(startAt);
  const yaw = Math.atan2(-(P[1][0] - P[0][0]), -(P[1][1] - P[0][1]));
  await S.ev(([x, z, y, pt]) => window.__media.place(x, z, y, pt), [P[0][0], P[0][1], yaw, pitch]);
  const skip = [route.kick, route.stomp].filter(Boolean);
  const n = await S.ev((o) => window.__media.layCandy(o.pts, o.opts), { pts: P, opts: { from: 5, skip, skipR: route.skipR, to: route.to, step, side, pop: pop ? route.pop : null } });
  log(`${S.name}: route from (${P[0]}) with ${n} candies laid`);
  await S.frame(2);
  return { ...route, pts: P, riseAt: route.riseAt - startAt };
}

/**
 * Drive the route frame by frame. onFrame(f, snap, ev) after each frame (ev: pick / smash / boo / chase flags);
 * returns when the route ends + tail frames, or after maxFrames.
 */
async function runRoute(S, ctl, R, { onFrame, maxFrames = 900, tail = 24, booDist = 3.3, graves = R.graves, lureMag = 0.3, jumpD = +(args['jump-d'] || 2.9) } = {}) {
  const P = R.pts;
  const st = { i: 0, end: false };
  let phase = 'run', phaseT = 0, risen = false, endF = -1, prev = S.snap, wantBoo = false, jumped = !R.stomp;
  const marks = { smash: -1, chase: -1, boo: -1, end: -1 };
  for (let f = 0; f < maxFrames; f++) {
    const s = S.snap;
    // ---- director
    phaseT += DT;
    let wantJump = false;
    if (!jumped && Math.hypot(s.x - R.stomp[0], s.z - R.stomp[1]) < jumpD) { wantJump = true; jumped = true; }
    if (!risen && phase === 'run' && st.i >= R.riseAt) {
      const at = await S.ev((pts) => window.__media.rise(pts), graves); risen = true;
      log(`${S.name}: ghosts rise at ${JSON.stringify(at)} (frame ${f})`);
    }
    if (phase === 'run' && risen && s.chaser < 9.5) { phase = 'lure'; phaseT = 0; marks.chase = f; }
    if (phase === 'lure' && s.chaser < booDist && s.booT >= 4.99) { phase = 'boo'; phaseT = 0; wantBoo = true; }
    if (phase === 'boo' && phaseT > 0.5) { phase = 'after'; phaseT = 0; }
    let target = pursuit(P, st, s.x, s.z, phase === 'lure' ? 2.2 : 3.2), mag = 1;
    if (phase === 'lure') mag = Math.max(lureMag, 1 - phaseT * 1.6); // ease off the stick: let them come
    if (phase === 'boo') mag = 0.3;
    if (st.end && endF < 0) endF = f;
    const stick = endF >= 0 && f > endF + 6 ? null : await S.ev((o) => window.__media.plan(o), { tx: target.x, tz: target.z, mag, dt: DT, smooth: phase === 'lure' ? 4 : 6 });
    const press = wantBoo ? 'boo' : wantJump ? 'jump' : null; wantBoo = false;
    await ctl.apply(stick, press, stick ? stick.err : 0);
    await S.raf();
    const n = await S.frame();
    const ev = { pick: n.candy > prev.candy, smash: n.smashed > prev.smashed, boo: n.booed > prev.booed || (press === 'boo'), phase, stomp: n.smashed > prev.smashed && !n.grounded };
    if (press === 'boo') marks.boo = f;
    if (ev.smash) { if (marks.smash < 0) marks.smash = f; log(`${S.name}: ${ev.stomp ? 'STOMP' : 'kick'} at frame ${f}`); }
    prev = n;
    if (onFrame) { const r = await onFrame(f, n, ev); if (r === 'stop') return { last: f, marks }; }
    if (endF >= 0 && f > endF + tail) { marks.end = f; return { last: f, marks }; }
  }
  return { last: maxFrames, marks };
}

// ---------------------------------------------------------------------------------------------------- jobs
async function jobVideo(name, { out, w, h, startAt, preroll, lead = 18, maxSec = 19, story = false }) {
  const S = await openGame(name);
  const dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let res = null, k = 0;
  try {
    const P = await stageRoute(S, { preroll, startAt });
    const ctl = S.phone ? new PhoneController(S) : new DesktopController(S); await ctl.init();
    const t0 = Date.now();
    res = await runRoute(S, ctl, P, {
      maxFrames: Math.round(maxSec * FPS) + lead,
      onFrame: async (f) => {
        if (f < lead) return; // the run-up: the first recorded frame is already mid-stride
        await S.page.screenshot({ path: path.join(dir, `f${String(k++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 100 });
      },
    });
    await ctl.release();
    for (const key of Object.keys(res.marks)) if (res.marks[key] >= 0) res.marks[key] -= lead; // -> recorded frame index
    log(`${name}: ${k} frames (${(k / FPS).toFixed(1)} s) in ${Math.round((Date.now() - t0) / 1000)} s; candy ${S.snap.candy}, booed ${S.snap.booed}, smashed ${S.snap.smashed}; marks ${JSON.stringify(res.marks)}`);
    if (S.errors.length) log(`${name}: page errors: ${S.errors.slice(0, 3).join(' | ')}`);
  } finally { await S.close(); }
  encode(dir, path.join(OUT, out), w, h);
  log(`${name}: -> ${out}`);
  if (story) await makeStory(dir, k, res.marks);
  if (!args['keep-frames']) fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Instagram Story (9:16, 10-15 s) from the reel's frames: a title overlay near the top (under the HUD clock), the
 * lower middle of the frame left free for a link sticker. Also a still (the BOO moment).
 */
async function makeStory(dir, n, marks) {
  const overlay = path.join(STILLS, 'story-overlay.png');
  await storyOverlay(overlay);
  // 14.5 s ending ~2.3 s after the BOO (the candy it shakes out gets collected), at least 10 s
  const want = Math.round(14.5 * FPS);
  let end = marks.boo >= 0 ? Math.min(n, marks.boo + Math.round(2.3 * FPS)) : n;
  let start = Math.max(0, end - want);
  end = Math.min(n, Math.max(end, start + Math.round(10 * FPS)));
  const frames = end - start;
  const vf = `[0:v]scale=1080:1920:flags=lanczos+accurate_rnd:in_range=full:in_color_matrix=bt601,format=gbrp[b];[b][1:v]overlay=0:0:format=gbrp`;
  ff(['-framerate', String(FPS), '-start_number', String(start), '-i', path.join(dir, 'f%05d.jpg'), '-i', overlay,
    '-filter_complex', `${vf},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`, '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-maxrate', '40M', '-bufsize', '80M', '-profile:v', 'high', '-level', '4.2',
    '-g', String(FPS), '-r', String(FPS), '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', '-an', path.join(OUT, 'ig-story-1080x1920.mp4')], 'story');
  log(`story: frames ${start}..${end - 1} (${(frames / FPS).toFixed(1)} s) -> ig-story-1080x1920.mp4`);
  const still = marks.boo >= 0 ? Math.min(n - 1, marks.boo + 5) : Math.round(n / 2);
  const png = path.join(STILLS, 'story-still.png');
  ff(['-i', path.join(dir, `f${String(still).padStart(5, '0')}.jpg`), '-i', overlay, '-filter_complex', `${vf},format=rgb24`, '-frames:v', '1', png], 'story still');
  await toJpeg(png, path.join(OUT, 'ig-story-1080x1920.jpg'), 1080, 1920);
  log(`story: still from frame ${still} -> ig-story-1080x1920.jpg`);
}

/** The Story's title, in the game's logo style, on a transparent 1080 x 1920 PNG. */
async function storyOverlay(out) {
  const page = await comp();
  await page.setViewportSize({ width: 1080, height: 1920 });
  // below the HUD clock (which ends ~330 px down in the 414 x 736 phone layout at 1080 wide), above the call-outs (~600 px)
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1080px;height:1920px;background:transparent;overflow:hidden}
  .wrap{position:absolute;left:0;right:0;top:352px;display:flex;flex-direction:column;align-items:center;gap:2px;
    font-family:"Avenir Next","Avenir","Segoe UI",system-ui,sans-serif;font-weight:900;text-align:center;line-height:1.04}
  .scrim{position:absolute;left:90px;right:90px;top:322px;height:250px;border-radius:120px;
    background:radial-gradient(closest-side,rgba(12,4,24,.55),rgba(12,4,24,.32) 60%,rgba(12,4,24,0));filter:blur(14px)}
  .l{font-size:84px;letter-spacing:.005em;white-space:nowrap}
  .g{background:linear-gradient(180deg,#ffe27a 0%,#ff9a2a 48%,#ff5a14 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .sh{filter:drop-shadow(0 5px 0 rgba(20,6,30,.55)) drop-shadow(0 0 22px rgba(255,120,30,.55))}
  .e{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-weight:400;font-size:80px;margin-left:12px;vertical-align:-2px}
  </style></head><body><div class="scrim"></div><div class="wrap">
  <div class="l sh"><span class="g">My yearly Halloween</span></div>
  <div class="l sh"><span class="g">web game</span><span class="e">🎃</span></div>
  </div></body></html>`);
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
  await sleep(100);
  await page.screenshot({ path: out, type: 'png', omitBackground: true });
}

/**
 * A 16:9 hero still: the route run up to the ghosts closing in; candidate frames while the nearest chaser is between
 * `range` m, the one nearest `pickD` m is kept. hint: false = no "GHOST! PRESS E / TAP BOO!" banner (a player who
 * has BOOed before never sees it again).
 */
async function jobHero(name, { out, preroll = 14, graves = GHOST_GRAVES, booDist = 3.3, lureMag = 0.3, hint = true, wheel = 0, range = [4.6, 3.4], pickD = 3.8, pickAt = null, every = 1, pop = true, clean = false, pitch = -0.2, nohud = false }) {
  const S = await openGame(name);
  const cand = path.join(STILLS, name);
  fs.rmSync(cand, { recursive: true, force: true }); fs.mkdirSync(cand, { recursive: true });
  try {
    const P = await stageRoute(S, { route: ROUTES.hero, preroll, startAt: 3, pop, pitch, step: 1.9, side: 0.55 });
    if (!hint) await S.ev(() => { window.__game.G.hintBoo = false; });
    // nohud: the same shot with every DOM overlay (HUD, touch controls, banners) hidden; only the 3D canvas shows.
    // visibility (not display) so the layout, and with it the touch input, stays exactly as in the HUD version
    if (nohud) await S.ev(() => { const st = document.createElement('style'); st.id = 'media-nohud'; st.media = 'not all'; st.textContent = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(st); });
    // the style is switched on only for the instant of each capture: hidden controls would not receive the touches
    const snap = async (file) => {
      if (!nohud) return S.png(file);
      await S.ev(() => { document.getElementById('media-nohud').media = 'all'; });
      try { return await S.png(file); } finally { await S.ev(() => { document.getElementById('media-nohud').media = 'not all'; }); }
    };
    if (wheel) { await S.page.mouse.move(S.vp.width / 2, S.vp.height * 0.56); await S.page.mouse.wheel(0, wheel); }
    const ctl = S.phone ? new PhoneController(S) : new DesktopController(S); await ctl.init();
    const shots = [];
    await runRoute(S, ctl, P, {
      graves, booDist, lureMag,
      onFrame: async (f, s, ev) => {
        if (ev.phase === 'lure' && s.chaser < range[0] && s.chaser > range[1] && f % every === 0 && (!clean || s.callout < 0.02)) shots.push({ file: await snap(path.join(cand, `c${String(shots.length).padStart(2, '0')}-d${s.chaser.toFixed(1)}.png`)), d: s.chaser });
        if (ev.phase !== 'run' && ev.phase !== 'lure') return 'stop';
        if (ev.phase === 'lure' && s.chaser <= range[1]) return 'stop';
      },
    });
    await ctl.release();
    if (!shots.length) throw new Error(`${name}: no candidate frame`);
    const pick = pickAt != null ? shots[Math.min(shots.length - 1, Math.floor(shots.length * pickAt))]
      : shots.reduce((a, b) => (Math.abs(b.d - pickD) < Math.abs(a.d - pickD) ? b : a), shots[0]);
    const small = path.join(STILLS, `${name}-1200.png`);
    downscale(pick.file, small, 1200, 675);
    await toJpeg(small, path.join(OUT, out), 1200, 675);
    log(`${name}: ${shots.length} candidates in ${cand}; picked ${path.basename(pick.file)} -> ${out}`);
  } finally { await S.close(); }
}

async function jobIG() {
  const S = await openGame('ig');
  const raw = {};
  try {
    // ---- 1: the title screen (the orbit camera and the ghosts drifting behind it)
    await S.frame(45);
    raw['ig-1-title'] = await S.png(path.join(STILLS, 'ig-1-title.png'));
    // ---- 2-4: the route
    const P = await stageRoute(S, { preroll: 14, startAt: 0 });
    const ctl = new PhoneController(S); await ctl.init();
    let pickN = 0, smashF = -1, booF = -1;
    await runRoute(S, ctl, P, {
      onFrame: async (f, s, ev) => {
        if (ev.pick) pickN++;
        if (pickN === 5 && ev.pick && !raw['ig-2-gameplay']) { await S.frame(0); raw['ig-2-gameplay'] = 'pending'; S._gpF = f + 3; }
        if (S._gpF === f) raw['ig-2-gameplay'] = await S.png(path.join(STILLS, 'ig-2-gameplay.png'));
        if (ev.smash && smashF < 0) smashF = f;
        if (smashF >= 0 && f === smashF + 4) raw['ig-4-smash'] = await S.png(path.join(STILLS, 'ig-4-smash.png'));
        if (ev.boo && booF < 0) booF = f;
        if (booF >= 0 && f === booF + 6) raw['ig-3-boo'] = await S.png(path.join(STILLS, 'ig-3-boo.png'));
        if (booF >= 0 && f > booF + 8) return 'stop';
      },
    });
    await ctl.release();
    // ---- 5: play the rest of the round to midnight (the bot), then the results screen
    await S.ev(() => { const G = window.__game.G; G.wakeIdx = 0; G.popT = 6; });
    const end = await S.ev(() => window.__media.autoplay(400));
    log(`ig: round played to midnight: candy ${end.candy}, lanterns ${end.smashed}, booed ${end.booed}, caught ${end.caught}, pops ${end.pops}`);
    for (let i = 0; i < 200 && (await S.ev(() => window.__game.G.state)) !== 'over'; i++) await S.frame(3);
    await S.frame(60);
    raw['ig-5-results'] = await S.png(path.join(STILLS, 'ig-5-results.png'));
  } finally { await S.close(); }
  for (const k of Object.keys(IG_TEXT)) {
    if (!raw[k] || raw[k] === 'pending') { log(`ig: ${k} was not captured`); continue; }
    await composeIG(raw[k], path.join(OUT, `${k}.jpg`), IG_TEXT[k], k === 'ig-1-title');
    log(`ig: -> ${k}.jpg`);
  }
}

// ---------------------------------------------------------------------------------------------------- composition
let compPage = null;
async function comp() {
  if (!compPage) { const ctx = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 }); compPage = await ctx.newPage(); }
  return compPage;
}
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
/** A PNG shown 1:1 on a w x h page, saved as a JPEG (Chrome's encoder, quality 95). */
async function toJpeg(png, out, w, h) {
  const page = await comp();
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:#000"><img src="${dataUrl(png)}" style="display:block;width:${w}px;height:${h}px"></body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: out, type: 'jpeg', quality: 95 });
}
/** Instagram slide 1080 x 1350: the phone screenshot in a phone frame on a dark purple canvas, with a text column. */
async function composeIG(png, out, [kicker, head, sub], first) {
  const page = await comp();
  await page.setViewportSize({ width: 1080, height: 1350 });
  // the phone: screen 390 x 844 css -> 560 x 1212 px, a 12 px bezel
  const SH = CAPTIONS ? 1212 : 1236, SW = Math.round(SH * 390 / 844), B = 12, W = SW + 2 * B, H = SH + 2 * B;
  const left = CAPTIONS ? 1080 - 58 - W : Math.round((1080 - W) / 2), top = Math.round((1350 - H) / 2);
  const screen = path.join(STILLS, `${path.basename(out, '.jpg')}-screen.png`);
  downscale(png, screen, SW, SH);
  const k = SW / 390; // css px of the game -> px here
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1080px;height:1350px;overflow:hidden;position:relative;font-family:"Avenir Next","Avenir","Segoe UI",system-ui,sans-serif;color:#fff;
    background:radial-gradient(ellipse 90% 70% at 70% 45%,#2c1450 0%,#170a2b 55%,#0a0514 100%)}
  .bg{position:absolute;inset:-80px;background:url(${dataUrl(screen)}) center/cover;filter:blur(70px) saturate(1.3);opacity:.32}
  .glow{position:absolute;left:${left - 120}px;top:${top + 120}px;width:${W + 240}px;height:${H - 240}px;border-radius:50%;
    background:radial-gradient(closest-side,rgba(255,120,30,.28),rgba(155,92,255,.18) 55%,transparent);filter:blur(30px)}
  .moon{position:absolute;left:${CAPTIONS ? 70 : 60}px;top:${CAPTIONS ? 1000 : 70}px;width:120px;height:120px;border-radius:50%;
    background:radial-gradient(circle at 40% 38%,#fff6da,#ffe2a0 45%,#e8b86a 70%);box-shadow:0 0 60px 14px rgba(255,226,160,.35),0 0 160px 40px rgba(180,120,255,.18);opacity:${CAPTIONS ? 0.9 : 0}}
  .phone{position:absolute;left:${left}px;top:${top}px;width:${W}px;height:${H}px;border-radius:${Math.round(47 * k + B)}px;padding:${B}px;
    background:linear-gradient(145deg,#3a3446,#141018 40%,#0c0a10 60%,#2c2636);box-shadow:0 0 0 2px rgba(255,255,255,.08),0 30px 80px rgba(0,0,0,.65),0 0 120px rgba(155,92,255,.22)}
  .screen{position:relative;width:${SW}px;height:${SH}px;border-radius:${Math.round(47 * k)}px;overflow:hidden;background:#000}
  .screen img{display:block;width:${SW}px;height:${SH}px}
  .notch{position:absolute;left:50%;top:0;transform:translateX(-50%);width:${Math.round(156 * k)}px;height:${Math.round(31 * k)}px;background:#07060a;
    border-radius:0 0 ${Math.round(20 * k)}px ${Math.round(20 * k)}px}
  .txt{position:absolute;left:62px;top:0;bottom:0;width:${left - 62 - 44}px;display:flex;flex-direction:column;justify-content:center;gap:22px}
  .kick{font-size:21px;font-weight:700;letter-spacing:.32em;color:#d9c2ff;text-shadow:0 0 18px rgba(160,100,255,.9)}
  .head{font-size:${first ? 66 : 58}px;line-height:1.02;font-weight:900;letter-spacing:-.005em;
    background:linear-gradient(180deg,#ffe27a 0%,#ff9a2a 50%,#ff5a14 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 4px 0 rgba(0,0,0,.35)) drop-shadow(0 0 26px rgba(255,120,30,.35))}
  .sub{font-size:25px;line-height:1.36;font-weight:500;color:rgba(255,240,225,.88)}
  .brand{position:absolute;left:62px;bottom:52px;font-size:15px;font-weight:800;letter-spacing:.34em;color:rgba(255,226,170,.7)}
  </style></head><body>
  <div class="bg"></div><div class="glow"></div><div class="moon"></div>
  ${CAPTIONS ? `<div class="txt"><div class="kick">${kicker}</div><div class="head">${head}</div><div class="sub">${sub}</div></div>${first ? '' : '<div class="brand">MIDNIGHT CANDY RUN</div>'}` : ''}
  <div class="phone"><div class="screen"><img src="${dataUrl(screen)}"><div class="notch"></div></div></div>
  </body></html>`;
  await page.setContent(html);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete) && document.fonts.ready);
  await sleep(100);
  await page.screenshot({ path: out, type: 'jpeg', quality: 95 });
}

// ---------------------------------------------------------------------------------------------------- main
let failed = 0;
try {
  if (!args['no-build']) build();
  else if (!fs.existsSync(path.join(BUILD, 'halloween/index.html'))) throw new Error(`no build in ${BUILD} (drop --no-build)`);
  server = await serve();
  log(`serving ${BUILD} at ${server.base}`);
  browser = await launchChrome({ headless: !args.headed, args: args.headed ? headedArgs : headlessArgs });
  const jobs = [ // X / LinkedIn first, then the reel + the Instagram Story, then the (optional) carousel
    // the LinkedIn / X hero on a phone in landscape (touch controls, BOO button, no hint banner) ...
    ['hero-clean', () => jobHero('herotouch', { out: 'x-linkedin-1200x675-clean.jpg', hint: false, pop: false, clean: true, graves: [[13.5, -19], [19.5, -17.5]], range: [5.6, 3.4], pickD: 4.2, pitch: +(args['hero-pitch'] ?? -0.02) })],
    // ... the same shot with no HUD at all (no text or buttons) ...
    ['hero-nohud', () => jobHero('herotouch', { out: 'x-1200x675-nohud.jpg', hint: false, pop: false, clean: true, nohud: true, graves: [[13.5, -19], [19.5, -17.5]], range: String(args['hero-range'] || '5.6,3.4').split(',').map(Number), pickD: +(args['hero-pickd'] || 4.2), booDist: +(args['hero-boo'] || 3.3), pitch: +(args['hero-pitch'] ?? -0.02) })],
    // ... and the first desktop version (keyboard HUD, the "GHOST! PRESS E" hint), kept as it was approved
    ['hero', () => jobHero('hero', { out: 'x-linkedin-1200x675.jpg', preroll: 30, range: [6.8, 3.4], pickAt: 0.45, every: 2 })],
    ['xclip', () => jobVideo('xclip', { out: 'x-clip-1280x720.mp4', w: 1280, h: 720, startAt: 3, preroll: 14, maxSec: 14.5 })],
    ['reel', () => jobVideo('reel', { out: 'reel-1080x1920.mp4', w: 1080, h: 1920, startAt: 0, preroll: 14, maxSec: 19, story: true })],
    ['ig', () => jobIG()],
  ];
  for (const [name, fn] of jobs) {
    if (!ONLY.has(name)) continue;
    try { await fn(); } catch (e) { failed++; log(`${name} FAILED: ${e.stack || e}`); }
  }
} catch (e) {
  failed++; console.error(e);
} finally {
  await cleanup();
}
log(failed ? `${failed} job(s) failed` : `done -> ${OUT}`);
process.exit(failed ? 1 : 0);
