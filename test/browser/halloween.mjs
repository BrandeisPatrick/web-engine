// Browser check of the Halloween game (samples/halloween/): drives it in headless Chrome on a desktop viewport and in
// phone emulation (iPhone 13 and Pixel 7 portrait and landscape, a small 360x640 Android, an iPhone SE in landscape and
// a tall 430x932 iPhone; touch input through CDP, the iPhones with safe-area insets), and saves screenshots.
//
//   node test/browser/halloween.mjs                 # starts its own Vite server (vite.config.js) on a free port
//   node test/browser/halloween.mjs --url=http://localhost:5190/halloween/   # use a running dev server instead
//   node test/browser/halloween.mjs --only=desktop,iphone-portrait --headed
//   node test/browser/halloween.mjs --only=pixel-portrait --perf              # + the 4x CPU-throttled stress check
//   --out=<dir>   screenshots (default test/browser/out/halloween/, gitignored)
//
// Per profile it checks: the title screen, start (a click / a touch tap: the gesture that also starts audio), that the
// kid moves (keys, or a drag on the floating touch stick), looking (mouse right-drag / the touch look pad), JUMP, BOO
// (its cooldown starts; the touch button shows the cooldown ring), smashing a jack-o'-lantern by running into it (it
// spills candy), collecting candy (the counter goes up), pause / resume, the round ending at midnight (results screen,
// best score saved), Play Again; on phones also that the touch controls and HUD stay inside the viewport and do not
// overlap (and stay inside the safe-area insets), a portrait -> landscape rotation mid-game (canvas and controls
// re-laid out), the browser chrome changing the viewport height, the left thumb holding the stick while the right one
// taps BOO and JUMP, the camera not spinning while the stick points sideways or back, backgrounding the tab (the round
// pauses, the audio suspends on every screen; simulated: headless Chrome never hides a page), and on iphone-portrait
// five rounds back to back with flat renderer / physics / DOM / listener counts. Console errors and warnings and WebGL
// errors fail the run. --perf: under 4x CPU throttling, the frame time with every ghost up, lanterns breaking all at
// once and a candy shower stays within budget.
// Gameplay: desktop START captures the mouse (pointer lock, stubbed: headless Chrome refuses a real one) so plain
// movement looks, Esc (a lock lost) pauses and RESUME captures again, a refused capture shows the click / arrows hint,
// the arrow keys turn the camera (up still runs), the controls line names mouse look and the arrows; phones never ask
// for the lock (nor does the touchscreen laptop after a touch start). Phones: the stick's dead zone (a small push or a
// wobbling thumb neither moves nor turns the kid; 44 px runs at full speed), BOO / JUMP hit rings (taps 50 px off
// centre still land), a sliding tap on the look pad does not turn the view, BOO sits below JUMP in portrait. Everywhere:
// a catch costs 10 % (2..12) with "GRAB IT BACK!", the safety window, the pack backing off after a catch, at most 2
// chasers at once on phones (3 on desktop), BOO glowing while a chaser is in reach, the edge markers for an off-screen
// big pop and a ghost behind the kid; the BOO lesson of a first session (the first ghost rises in view ahead, tame) and
// its end after the first BOO that lands (localStorage); desktop: the graveyard fence stops a walk and a jump clears it.
// Mobile controls: every button (title, HUD, pause, how-to-play, results) is at least 44 x 44 px inside the safe area,
// HOW TO PLAY opens and closes by touch, the sound and pause buttons work, the full-screen button exists exactly where
// the Fullscreen API does and toggles, haptics fire on candy / smash / BOO / catch (navigator.vibrate stubbed; none on
// desktop), the stick stays held while the other thumb drags to look, the manifest + icons load (pixel-portrait), a
// stubbed Bluetooth gamepad plays (pixel-landscape: stick moves, A jumps, X BOOs), and the 'hybrid' profile (a laptop
// with a touchscreen: no touch reported) shows the touch controls on its first touch and hides them on a key press.
// Screenshots: <out>/<profile>-{title,play,end,...}.png. The few committed in samples/halloween/screenshots/ are
// picked from these by hand (downscaled JPEGs). Uses the system Google Chrome like the other browser scripts.
import fs from 'node:fs';
import path from 'node:path';
import { devices } from 'playwright';
import { repoRoot, parseArgs, startVite, launchChrome, headlessArgs, headedArgs, watchErrors, withTimeout, onSignals } from './playwright.config.mjs';

const args = parseArgs();
const OUT = path.resolve(args.out ? String(args.out) : path.join(repoRoot, 'test/browser/out/halloween'));
fs.mkdirSync(OUT, { recursive: true });
const tall = devices['iPhone 15 Pro Max'];
const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  'iphone-portrait': { ...devices['iPhone 13'] },
  'iphone-landscape': { ...devices['iPhone 13 landscape'] },
  'pixel-portrait': { ...devices['Pixel 7'] },
  'pixel-landscape': { ...devices['Pixel 7 landscape'] },
  'small-portrait': { ...devices['Galaxy S III'] },                       // 360 x 640
  'se-landscape': { ...devices['iPhone SE (3rd gen) landscape'] },        // 667 x 375
  'tall-portrait': { ...tall, viewport: { width: 430, height: 932 }, screen: { width: 430, height: 932 } },
  hybrid: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, // reports no touch (fine pointer, 0 points)
};
// safe-area insets (px) emulated on the notched iPhones (viewport-fit=cover makes env(safe-area-inset-*) non-zero)
const SAFE = {
  'iphone-portrait': { top: 47, bottom: 34, left: 0, right: 0 },
  'iphone-landscape': { top: 0, bottom: 21, left: 47, right: 47 },
  'tall-portrait': { top: 59, bottom: 34, left: 0, right: 0 },
};
const only = args.only ? String(args.only).split(',') : Object.keys(PROFILES);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failures = 0;
function check(profile, name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${profile.padEnd(17)} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
  return ok;
}

let vite = null, browser = null;
const cleanup = async () => { if (browser) await browser.close().catch(() => {}); if (vite) await vite.close().catch(() => {}); };
onSignals(cleanup);

const G = (page, fn, arg) => withTimeout(page.evaluate(fn, arg), 20000, 'evaluate');
const state = (page) => G(page, () => {
  const g = window.__game, p = g.cc.position;
  return { state: g.G.state, candy: g.G.candy, smashed: g.G.smashed, booT: g.G.booT, x: p.x, y: p.y, z: p.z, yaw: g.rig.yaw, left: g.G.left, audio: g.audio.bus.ctx ? g.audio.bus.ctx.state : 'none', best: g.G.best, touch: g.TOUCH };
});
const waitFor = async (page, fn, arg, ms = 8000) => {
  const t0 = Date.now();
  for (;;) { if (await G(page, fn, arg)) return true; if (Date.now() - t0 > ms) return false; await sleep(100); }
};

/** CDP touch helpers (real touch input: Chrome turns it into pointer events with pointerType 'touch'). */
function touchApi(cdp) {
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 })) });
  return {
    async tap(x, y, id = 1) { await send('touchStart', [{ x, y, id }]); await sleep(60); await send('touchEnd', []); },
    /** Drag one finger from (x, y) by (dx, dy) over `steps`, hold `hold` ms, release; `extra` = a static second finger. */
    async drag(x, y, dx, dy, { steps = 8, hold = 0, id = 1 } = {}) {
      await send('touchStart', [{ x, y, id }]);
      for (let i = 1; i <= steps; i++) { await send('touchMove', [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps, id }]); await sleep(16); }
      if (hold) await sleep(hold);
      await send('touchEnd', []);
    },
    start: (pts) => send('touchStart', pts), move: (pts) => send('touchMove', pts), end: () => send('touchEnd', []),
    /** Lift only these fingers (CDP: a touchEnd lists the points that lift; the other fingers stay down). */
    lift: (pts) => send('touchEnd', pts),
  };
}

/** Before any page script: a net count of event listeners (window.__listeners.n) and lost WebGL contexts. */
function instrument() {
  const reg = new WeakMap(), L = (window.__listeners = { n: 0 });
  const key = (t, o) => `${t}|${typeof o === 'boolean' ? o : !!(o && o.capture)}`;
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, fn, o) {
    if (fn && !(o && o.once)) {
      let m = reg.get(this); if (!m) reg.set(this, (m = new Map()));
      const k = key(t, o); let set = m.get(k); if (!set) m.set(k, (set = new Set()));
      if (!set.has(fn)) { set.add(fn); L.n++; }
    }
    return add.call(this, t, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (t, fn, o) {
    const m = reg.get(this), set = m && m.get(key(t, o));
    if (set && set.delete(fn)) L.n--;
    return rem.call(this, t, fn, o);
  };
  window.__vib = [];
  Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value(p) { window.__vib.push(p); return true; } });
  window.__glLost = 0;
  window.addEventListener('webglcontextlost', () => { window.__glLost++; }, true);
  // pointer lock: headless Chrome refuses a real one (WrongDocumentError), so requests are counted and granted here
  // (or refused while window.__lockRefuse); window.__unlock() drops the lock the way Esc does
  let lockEl = null;
  window.__lockReq = 0; window.__lockRefuse = false;
  const lockChanged = () => document.dispatchEvent(new Event('pointerlockchange'));
  Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => lockEl });
  Element.prototype.requestPointerLock = function () {
    window.__lockReq++;
    if (window.__lockRefuse) return Promise.reject(new DOMException('refused (test)', 'NotAllowedError'));
    const el = this;
    return Promise.resolve().then(() => { lockEl = el; lockChanged(); });
  };
  Document.prototype.exitPointerLock = function () { if (lockEl) { lockEl = null; Promise.resolve().then(lockChanged); } };
  window.__unlock = () => { lockEl = null; lockChanged(); };
}
/** Resource counts that must stay flat from round to round. */
const counts = (page) => G(page, () => {
  const g = window.__game, i = g.engine.renderer.info;
  return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0, bodies: g.dyn.stats.bodies,
    sceneObjects: (() => { let n = 0; g.engine.scene.traverse(() => n++); return n; })(), dom: document.getElementsByTagName('*').length, listeners: window.__listeners.n };
});
/** Simulate the tab going to the background / coming back (headless Chrome never hides a page by itself). */
const setHidden = (page, hidden) => G(page, (h) => {
  if (h) { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); }
  else { delete document.hidden; delete document.visibilityState; }
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
/** Every visible button on the current screens: at least 44 x 44 CSS px. */
const buttons = (page, sel = '.hw-screen:not(.off) button, .hw-hud:not(.off) button') => G(page, (q) => [...document.querySelectorAll(q)]
  .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
  .map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, t: (e.textContent || e.getAttribute('aria-label') || '').trim() }; }), sel);
const audioState = (page) => G(page, () => window.__game.audio.bus.ctx ? window.__game.audio.bus.ctx.state : 'none');

async function rect(page, sel) { return G(page, (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel); }
const overlaps = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a, vp) => a && a.x >= -1 && a.y >= -1 && a.x + a.w <= vp.width + 1 && a.y + a.h <= vp.height + 1;

/** Put the kid 1.7 m south of the nearest intact lantern, camera behind (yaw 0 = facing north, toward it). */
const lineUpLantern = (page) => G(page, () => {
  const g = window.__game, L = g.lanterns, p = g.cc.position;
  let best = -1, bd = Infinity;
  for (let i = 0; i < L.n; i++) {
    if (!L.alive[i]) continue;
    const x = L.x[i], z = L.z[i] + 1.7;
    if (g.physics.queryColliders(x, z, 0.5, []).length) continue;
    const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = i; }
  }
  const x = L.x[best], z = L.z[best] + 1.7;
  g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z);
  g.rig.yaw = 0; g.rig.pitch = -0.3; g.camState.facing = 0; g.player.rotation.y = 0; g.rig.snap();
  for (const q of g.ghosts.list) if (q.state === 'chase') q.state = 'wander'; // keep the test deterministic
  g.G.safeT = 3;
  return best;
});
/** Put the kid 1.6 m from the nearest resting candy (the magnet pulls it in). */
const nearCandy = (page) => G(page, () => {
  const g = window.__game, C = g.candy;
  for (let i = 0; i < C.state.length; i++) {
    if (C.state[i] !== 1 || C.kind[i] === 2) continue;
    const x = C.p[i * 3] + 1.6, z = C.p[i * 3 + 2];
    if (g.physics.queryColliders(x, z, 0.5, []).length) continue;
    g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); g.G.safeT = 3;
    return true;
  }
  return false;
});

async function runProfile(name) {
  const opts = PROFILES[name], phone = name !== 'desktop';
  const ctx = await browser.newContext({ ...opts });
  const page = await ctx.newPage();
  const errors = watchErrors(page), warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.addInitScript(instrument);
  const vp = page.viewportSize();
  const cdp = phone ? await ctx.newCDPSession(page) : null, T = cdp ? touchApi(cdp) : null;
  let sa = SAFE[name] || null;
  if (sa) { // a recent CDP method: an older Chrome runs these profiles without insets
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: sa.top, topMax: sa.top, bottom: sa.bottom, bottomMax: sa.bottom, left: sa.left, leftMax: sa.left, right: sa.right, rightMax: sa.right } }); }
    catch { results.push(`info  ${name.padEnd(17)} safe-area emulation unavailable in this Chrome: no insets`); sa = null; }
  }
  const S = sa || { top: 0, bottom: 0, left: 0, right: 0 };
  const inSafe = (a, v = vp) => a && a.x >= S.left - 1 && a.y >= S.top - 1 && a.x + a.w <= v.width - S.right + 1 && a.y + a.h <= v.height - S.bottom + 1;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    const ready = await waitFor(page, () => !!(window.__game && document.querySelector('.ui-loading') === null), null, 90000);
    check(name, 'loads (window.__game, loading screen gone)', ready);
    await sleep(1200);
    let s = await state(page);
    check(name, 'title screen first', s.state === 'title');
    check(name, `touch UI ${phone ? 'on' : 'off'}`, s.touch === phone);
    await page.screenshot({ path: path.join(OUT, `${name}-title.png`), scale: 'css' });
    const startBtn = await rect(page, '.hw-start');
    check(name, 'start button inside the viewport', inside(startBtn, vp), JSON.stringify(startBtn));
    const titleEls = await G(page, () => [...document.querySelectorAll('.hw-title-wrap .hw-logo, .hw-title-wrap .hw-tag, .hw-title-wrap .hw-start, .hw-title-wrap .hw-card, .hw-title-wrap .hw-ctrl, .hw-title-wrap button')]
      .filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, c: e.className }; }));
    check(name, 'title screen fits (logo, text, buttons, cards / controls line)', titleEls.length >= 5 && titleEls.every((r) => inSafe(r)), JSON.stringify(titleEls.filter((r) => !inSafe(r)).map((r) => [r.c, Math.round(r.y), Math.round(r.h)])));
    if (!phone) {
      const ctrl = await G(page, () => [...document.querySelectorAll('.hw-ctrl')].map((e) => e.textContent));
      check(name, 'controls line (title + help): mouse look, arrows turn', ctrl.length === 2 && ctrl.every((t) => /mouse look/.test(t) && t.includes('←') && t.includes('→')), ctrl[0]);
    }
    const tb = await buttons(page);
    check(name, 'title buttons >= 44 x 44 px, inside the safe area', tb.length >= 3 && tb.every((b) => b.w >= 44 && b.h >= 44 && inSafe(b)), JSON.stringify(tb.filter((b) => !(b.w >= 44 && b.h >= 44 && inSafe(b))).map((b) => [b.t, Math.round(b.w), Math.round(b.h)])));
    const fsApi = await G(page, () => !!document.fullscreenEnabled);
    check(name, 'full-screen button exactly where the Fullscreen API exists', (await G(page, () => document.querySelectorAll('.hw-fs').length)) === (fsApi ? 2 : 0));
    if (name === 'pixel-portrait') {
      // ---- home screen: the web app manifest (relative URLs: the game is also served under a sub-path) and icons
      const man = await cdp.send('Page.getAppManifest');
      let data = null; try { data = JSON.parse(man.data); } catch { /* none */ }
      const files = data ? await G(page, async (srcs) => {
        const base = document.querySelector('link[rel=manifest]').href, apple = document.querySelector('link[rel=apple-touch-icon]').href;
        const ok = async (u) => { const r = await fetch(u); return r.ok && /image\/png/.test(r.headers.get('content-type') || ''); };
        return { icons: await Promise.all(srcs.map((src) => ok(new URL(src, base).href))), apple: await ok(apple),
          rel: [...document.querySelectorAll('link[rel=manifest], link[rel=apple-touch-icon]')].every((l) => !/^(\/|https?:)/.test(l.getAttribute('href'))),
          meta: !!document.querySelector('meta[name=apple-mobile-web-app-capable][content=yes]') && !!document.querySelector('meta[name=theme-color]') };
      }, data.icons.map((i) => i.src)) : null;
      check(name, 'web app manifest + icons load (relative URLs, full screen display)', !!data && man.errors.length === 0 && data.start_url === './' && data.scope === './' && data.display === 'fullscreen'
        && files.icons.length >= 2 && files.icons.every(Boolean) && files.apple && files.rel && files.meta, JSON.stringify({ errors: man.errors, files }));
    }
    // ---- HOW TO PLAY: opens over the title, its cards and controls fit, GOT IT closes it
    const tap = async (r) => { if (phone) await T.tap(r.cx, r.cy); else await page.mouse.click(r.cx, r.cy); };
    await tap(await rect(page, '.hw-title-wrap [data-a=help]'));
    await sleep(500);
    const help = await G(page, () => [...document.querySelectorAll('.hw-help:not(.off) .hw-h1, .hw-help:not(.off) .hw-card, .hw-help:not(.off) .hw-ctrl, .hw-help:not(.off) button')]
      .map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, c: e.className }; }));
    check(name, 'HOW TO PLAY opens; cards, controls and GOT IT fit', help.length >= 6 && help.every((r) => inSafe(r)), JSON.stringify(help.filter((r) => !inSafe(r)).map((r) => [r.c, Math.round(r.y), Math.round(r.h)])));
    await page.screenshot({ path: path.join(OUT, `${name}-help.png`), scale: 'css' });
    await tap(await rect(page, '.hw-help [data-a=close]'));
    check(name, 'GOT IT closes it', await waitFor(page, () => document.querySelector('.hw-help').classList.contains('off'), null, 1500));
    // ---- start: a tap / click (also the audio gesture)
    if (phone) await T.tap(startBtn.cx, startBtn.cy); else await page.mouse.click(startBtn.cx, startBtn.cy);
    check(name, 'tap / click starts the round', await waitFor(page, () => window.__game.G.state === 'play'));
    await sleep(400);
    s = await state(page);
    check(name, 'audio context running after the gesture', s.audio === 'running', s.audio);
    const calmAll = () => G(page, () => { const g = window.__game; g.G.safeT = 3; for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; } });
    const home = () => G(page, () => { const g = window.__game; g.cc.teleport(0, g.world.heightAt(0, 6) + 0.05, 6); g.rig.yaw = 0; g.camState.facing = 0; g.player.rotation.y = 0; g.rig.snap(); });
    if (!phone) {
      // ---- desktop look: the START click captured the mouse; plain movement looks; Esc (lock lost) pauses; RESUME
      // captures again; refused: the click / arrows hint; the arrow keys turn the camera, up still runs
      const lk = await G(page, () => ({ req: window.__lockReq, locked: window.__game.input.pointerLocked, hint: document.querySelector('.hw-hint').textContent, on: document.querySelector('.hw-hint').classList.contains('on') }));
      check(name, 'CLICK TO START captures the mouse (1 pointer-lock request, locked)', lk.req === 1 && lk.locked, JSON.stringify(lk));
      check(name, 'look hint: "move the mouse to look"', lk.on && /MOVE THE MOUSE TO LOOK/.test(lk.hint), lk.hint);
      await calmAll(); await home();
      await page.mouse.move(500, 360); await sleep(200); // (the travel to the start point is looking too)
      await home(); await sleep(100);
      const y0 = (await state(page)).yaw;
      for (let i = 1; i <= 10; i++) { await page.mouse.move(500 + i * 25, 360); await sleep(16); }
      await sleep(120);
      const y1 = (await state(page)).yaw;
      check(name, 'locked: plain mouse movement (250 px, no button) turns the camera', Math.abs(y1 - y0) > 0.3, `${(y1 - y0).toFixed(2)} rad`);
      check(name, 'look hint hides after some looking', await waitFor(page, () => !document.querySelector('.hw-hint').classList.contains('on'), null, 1500));
      await G(page, () => window.__unlock()); // Esc: the browser frees the mouse
      check(name, 'Esc (lock lost) pauses', await waitFor(page, () => window.__game.G.state === 'paused', null, 1500));
      await sleep(500);
      let rb0 = await rect(page, '.hw-screen:not(.off) [data-a=resume]');
      await page.mouse.click(rb0.cx, rb0.cy);
      check(name, 'RESUME captures the mouse again (request #2)', await waitFor(page, () => window.__game.G.state === 'play' && window.__lockReq === 2 && window.__game.input.pointerLocked, null, 2000), `requests ${await G(page, () => window.__lockReq)}`);
      // a refused capture (iframe, re-lock right after Esc): the hint says how to look instead
      await G(page, () => { window.__lockRefuse = true; window.__unlock(); });
      await waitFor(page, () => window.__game.G.state === 'paused', null, 1500);
      await sleep(500);
      rb0 = await rect(page, '.hw-screen:not(.off) [data-a=resume]');
      await page.mouse.click(rb0.cx, rb0.cy);
      check(name, 'refused capture: playing, hint "click the view · or use ← →"', await waitFor(page, () => window.__game.G.state === 'play' && document.querySelector('.hw-hint').classList.contains('on') && /CLICK THE VIEW TO LOOK/.test(document.querySelector('.hw-hint').textContent), null, 2000));
      await G(page, () => { window.__lockRefuse = false; });
      await page.mouse.click(640, 400); // clicking the view captures it
      check(name, 'refused: clicking the view captures the mouse', await waitFor(page, () => window.__game.input.pointerLocked, null, 1500));
      // the arrow keys: left turns the camera (the kid stays put), up runs
      await calmAll(); await home(); await sleep(250);
      let a0 = await state(page);
      await page.keyboard.down('ArrowLeft'); await sleep(1000); await page.keyboard.up('ArrowLeft');
      await sleep(100);
      let b0 = await state(page);
      check(name, 'ArrowLeft (1 s) turns the camera, the kid stays', (b0.yaw - a0.yaw) > 1.5 && Math.hypot(b0.x - a0.x, b0.z - a0.z) < 0.3, `yaw ${(b0.yaw - a0.yaw).toFixed(2)} rad, moved ${Math.hypot(b0.x - a0.x, b0.z - a0.z).toFixed(2)} m`);
      await home(); await sleep(250);
      a0 = await state(page);
      await page.keyboard.down('ArrowUp'); await sleep(1300); await page.keyboard.up('ArrowUp');
      await sleep(100);
      b0 = await state(page);
      check(name, 'ArrowUp (1.3 s) runs', Math.hypot(b0.x - a0.x, b0.z - a0.z) > 3, `${Math.hypot(b0.x - a0.x, b0.z - a0.z).toFixed(2)} m`);
      // ---- the graveyard fence (x = 8, away from the west gap): running into it stops the kid, a jump clears it
      const lane = await G(page, () => {
        const g = window.__game, out = [];
        for (let z = -44; z <= -12; z += 0.5) {
          if (z > -31 && z < -24.5) continue; // the west gap
          let clear = true;
          for (let x = 3; x <= 14 && clear; x += 0.25) { if (Math.abs(x - 8) < 0.6) continue; out.length = 0; clear = g.physics.queryColliders(x, z, 0.45, out).length === 0; }
          if (clear) return z;
        }
        return null;
      });
      const fenceRun = async (jump) => {
        await calmAll();
        await G(page, (z) => { const g = window.__game; g.cc.teleport(13.5, g.world.heightAt(13.5, z) + 0.05, z); g.rig.yaw = Math.PI / 2; g.camState.facing = Math.PI / 2; g.rig.snap(); }, lane);
        await sleep(200);
        await page.keyboard.down('KeyW');
        let jumped = !jump; const t0 = Date.now();
        while (Date.now() - t0 < 2600) {
          const x = await G(page, () => window.__game.cc.position.x);
          if (!jumped && x < 10.4) { await page.keyboard.press('Space'); jumped = true; }
          if (x < 7.4) break;
          await sleep(15);
        }
        await page.keyboard.up('KeyW');
        return G(page, () => window.__game.cc.position.x);
      };
      if (lane == null) check(name, 'graveyard fence: a clear lane to test on', false);
      else {
        const walked = await fenceRun(false), hopped = await fenceRun(true);
        check(name, 'graveyard fence: walking into it stops, a JUMP clears it', walked > 8.15 && hopped < 7.6, `z ${lane}: walked to x ${walked.toFixed(2)}, jumped to x ${hopped.toFixed(2)}`);
      }
    } else {
      check(name, 'touch start: no pointer-lock request', (await G(page, () => window.__lockReq)) === 0);
    }
    if (phone) {
      // controls in the viewport, not overlapping each other or the HUD
      const stick = await rect(page, '.ui-touch-stick'), btns = await G(page, () => [...document.querySelectorAll('.ui-touch-btn')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, label: e.textContent }; }));
      const hudEls = await G(page, () => ['.hw-candy', '.hw-clock', '.hw-btns'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
      check(name, 'stick + JUMP + BOO inside the viewport', inside(stick, vp) && btns.every((b) => inside(b, vp)), JSON.stringify(btns.map((b) => [b.label, Math.round(b.x), Math.round(b.y)])));
      check(name, 'buttons at least 76 px', btns.every((b) => b.w >= 76));
      check(name, 'no control overlaps another control', !overlaps(stick, btns[0]) && !overlaps(stick, btns[1]) && !overlaps(btns[0], btns[1]));
      check(name, 'controls clear of the HUD', hudEls.every((h) => !overlaps(h, stick) && btns.every((b) => !overlaps(h, b))));
      check(name, 'HUD panels do not overlap', !overlaps(hudEls[0], hudEls[1]) && !overlaps(hudEls[1], hudEls[2]) && !overlaps(hudEls[0], hudEls[2]));
      check(name, `HUD + controls inside the safe area${sa ? ` (insets ${sa.top}/${sa.right}/${sa.bottom}/${sa.left})` : ''}`, [stick, ...btns, ...hudEls].every((r) => inSafe(r)));
      check(name, 'clock text on one line', await G(page, () => { const c = document.querySelector('.hw-clock .time'); return c.getClientRects().length === 1 && c.getBoundingClientRect().height < 40; }));
      const hb = await buttons(page, '.hw-btns button');
      check(name, 'HUD buttons (full screen / sound / pause) >= 44 x 44 px', hb.length >= 2 && hb.every((b) => b.w >= 44 && b.h >= 44 && inSafe(b)), hb.map((b) => `${b.t} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', '));
      // ---- the sound button mutes and unmutes (every sound button follows)
      const mb = await rect(page, '.hw-btns .hw-mute');
      await T.tap(mb.cx, mb.cy); await sleep(150);
      const m1 = await G(page, () => ({ muted: window.__game.audio.muted, pressed: [...document.querySelectorAll('.hw-mute')].every((b) => b.getAttribute('aria-pressed') === 'true') }));
      await T.tap(mb.cx, mb.cy); await sleep(150);
      const m2 = await G(page, () => window.__game.audio.muted);
      check(name, 'sound button mutes / unmutes by touch', m1.muted && m1.pressed && !m2);
      if (fsApi) {
        const fb = await rect(page, '.hw-btns .hw-fs');
        await T.tap(fb.cx, fb.cy);
        const inFs = await waitFor(page, () => !!document.fullscreenElement, null, 2000);
        await T.tap(fb.cx, fb.cy);
        const outFs = await waitFor(page, () => !document.fullscreenElement, null, 2000);
        await sleep(400);
        check(name, 'full-screen button enters and leaves full screen', inFs && outFs);
      }
    }
    // ---- move: hold forward (W / the floating stick pushed up)
    await G(page, () => { const g = window.__game; g.G.safeT = 3; for (const q of g.ghosts.list) if (q.state === 'chase') q.state = 'wander'; });
    let a = await state(page);
    if (phone) {
      const zone = await rect(page, '.ui-touch-zone');
      const x0 = zone.x + zone.w * 0.45, y0 = zone.y + zone.h * 0.7;
      await T.drag(x0, y0, 0, -70, { steps: 6, hold: 1200 });
    } else { await page.keyboard.down('KeyW'); await sleep(1300); await page.keyboard.up('KeyW'); }
    await sleep(150);
    let b = await state(page);
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    check(name, `${phone ? 'stick drag' : 'W key'} moves the kid`, moved > 3, `${moved.toFixed(2)} m`);
    // ---- look: drag on the right side (touch look pad) / right-button drag (mouse)
    a = await state(page);
    if (phone) { await T.drag(vp.width * 0.78, vp.height * 0.45, -90, 0, { steps: 8 }); }
    else { await page.mouse.move(800, 360); await page.mouse.down({ button: 'right' }); for (let i = 1; i <= 8; i++) { await page.mouse.move(800 - i * 12, 360); await sleep(16); } await page.mouse.up({ button: 'right' }); }
    await sleep(100);
    b = await state(page);
    check(name, 'look drag turns the camera', Math.abs(b.yaw - a.yaw) > 0.1, `${(b.yaw - a.yaw).toFixed(2)} rad`);
    // ---- jump
    a = await state(page);
    if (phone) { const j = await rect(page, '.ui-touch-btn:not(.hw-boo-btn)'); await T.tap(j.cx, j.cy); } else await page.keyboard.press('Space');
    const jumped = await waitFor(page, (y0) => window.__game.cc.position.y > y0 + 0.4, a.y, 1500);
    check(name, 'JUMP lifts the kid', jumped);
    await sleep(900);
    // ---- BOO
    if (phone) { const bo = await rect(page, '.hw-boo-btn'); await T.tap(bo.cx, bo.cy); } else await page.keyboard.press('KeyE');
    await sleep(150);
    s = await state(page);
    check(name, 'BOO fires (cooldown restarts)', s.booT < 1.5, `booT ${s.booT.toFixed(2)}`);
    if (phone) check(name, 'BOO button shows the cooldown ring', await G(page, () => document.querySelector('.hw-boo-btn').classList.contains('cooling')));
    if (phone) {
      // ---- two thumbs: the left one keeps the stick pushed up while the right one taps BOO, then JUMP
      await G(page, () => { const g = window.__game; g.G.booT = 5; g.G.safeT = 3; for (const q of g.ghosts.list) if (q.state === 'chase') q.state = 'wander'; });
      const zone = await rect(page, '.ui-touch-zone'), bo = await rect(page, '.hw-boo-btn'), ju = await rect(page, '.ui-touch-btn:not(.hw-boo-btn)');
      const hx = zone.x + Math.min(zone.w * 0.4, 110), hy = zone.y + zone.h * 0.7, held = { x: hx, y: hy - 60, id: 1 };
      await T.start([{ x: hx, y: hy, id: 1 }]);
      for (let i = 1; i <= 5; i++) { await T.move([{ x: hx, y: hy - i * 12, id: 1 }]); await sleep(16); }
      await sleep(250);
      await T.start([held, { x: bo.cx, y: bo.cy, id: 2 }]); await sleep(80); await T.lift([{ x: bo.cx, y: bo.cy, id: 2 }]);
      await sleep(120);
      const mid = await G(page, () => ({ moveY: window.__game.input.controls.moveY, booT: window.__game.G.booT, y: window.__game.cc.position.y }));
      await T.start([held, { x: ju.cx, y: ju.cy, id: 3 }]); await sleep(80); await T.lift([{ x: ju.cx, y: ju.cy, id: 3 }]);
      const hop = await waitFor(page, (y0) => window.__game.cc.position.y > y0 + 0.4, mid.y, 1500);
      const after = await G(page, () => ({ moveY: window.__game.input.controls.moveY, held: window.__game.input.touch.get('stick').pointer != null }));
      await T.end();
      check(name, 'two thumbs: BOO + JUMP while the stick stays held', mid.booT < 1 && hop && mid.moveY > 0.8 && after.moveY > 0.8 && after.held, `booT ${mid.booT.toFixed(2)}, jumped ${hop}, moveY ${mid.moveY.toFixed(2)} / ${after.moveY.toFixed(2)}`);
      // the right thumb drags on the look pad while the left keeps running
      await T.start([{ x: hx, y: hy, id: 1 }]);
      for (let i = 1; i <= 5; i++) { await T.move([{ x: hx, y: hy - i * 12, id: 1 }]); await sleep(16); }
      const y0 = (await state(page)).yaw, lx = vp.width * 0.72, ly = Math.min(vp.height * 0.45, ju.y - 40);
      await T.start([held, { x: lx, y: ly, id: 4 }]);
      for (let i = 1; i <= 8; i++) { await T.move([held, { x: lx - i * 12, y: ly, id: 4 }]); await sleep(16); }
      const look = await G(page, () => ({ yaw: window.__game.rig.yaw, moveY: window.__game.input.controls.moveY }));
      await T.lift([{ x: lx - 96, y: ly, id: 4 }]); await T.end();
      check(name, 'two thumbs: drag to look while the stick stays held', Math.abs(look.yaw - y0) > 0.15 && look.moveY > 0.8, `yaw ${(look.yaw - y0).toFixed(2)} rad, moveY ${look.moveY.toFixed(2)}`);
      await sleep(700);
      // ---- camera comfort: the stick held sideways, then back, for 1.5 s each: the kid runs, the view does not spin
      for (const [dir, sx, sy] of [['sideways', 1, 0], ['back', 0, 1]]) {
        await G(page, () => { const g = window.__game; g.G.safeT = 3; g.cc.teleport(0, g.world.heightAt(0, 6) + 0.05, 6); g.rig.yaw = 0; g.camState.facing = 0; g.rig.snap(); });
        await sleep(200);
        const a0 = await state(page);
        let turned = 0, prevYaw = a0.yaw;
        await T.start([{ x: hx, y: hy, id: 1 }]);
        for (let i = 1; i <= 4; i++) { await T.move([{ x: hx + sx * 14 * i, y: hy + sy * 14 * i, id: 1 }]); await sleep(16); }
        for (let i = 0; i < 6; i++) { await sleep(250); const b0 = await state(page); let d = b0.yaw - prevYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turned += d; prevYaw = b0.yaw; }
        await T.end();
        const b1 = await state(page);
        check(name, `camera holds still while the stick points ${dir}`, Math.abs(turned) < 0.35 && Math.hypot(b1.x - a0.x, b1.z - a0.z) > 4, `turned ${(turned * 180 / Math.PI).toFixed(0)} deg, kid moved ${Math.hypot(b1.x - a0.x, b1.z - a0.z).toFixed(1)} m`);
        await sleep(300);
      }
    }
    if (phone) {
      // ---- thumb feel: the stick's dead zone and full speed at 3/4 deflection, BOO / JUMP hit rings, the look pad's slop
      const zone = await rect(page, '.ui-touch-zone'), hx = zone.x + Math.min(zone.w * 0.4, 110), hy = zone.y + zone.h * 0.7;
      const push = async (px, ms, wobble = 0) => {
        await calmAll(); await home(); await sleep(150);
        const f0 = await G(page, () => window.__game.camState.facing);
        await T.start([{ x: hx, y: hy, id: 1 }]);
        for (let i = 1; i <= 3; i++) { await T.move([{ x: hx, y: hy - (px * i) / 3, id: 1 }]); await sleep(16); }
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { await T.move([{ x: hx + (Math.random() - 0.5) * 2 * wobble, y: hy - px + (Math.random() - 0.5) * 2 * wobble, id: 1 }]); await sleep(25); }
        const r = await G(page, (f) => { const g = window.__game, p = g.cc.position; return { speed: g.cc.speed, turn: Math.abs(g.camState.facing - f) * 180 / Math.PI, moved: Math.hypot(p.x, p.z - 6) }; }, f0);
        await T.end();
        return r;
      };
      const p6 = await push(6, 600), p44 = await push(44, 700), wob = await push(0, 1000, 3);
      check(name, 'stick dead zone: a 6 px push does not move the kid', p6.speed < 0.05 && p6.moved < 0.05, `${p6.speed.toFixed(2)} m/s, ${p6.moved.toFixed(2)} m`);
      check(name, 'stick: 44 px runs at full speed', p44.speed > 5.5, `${p44.speed.toFixed(2)} m/s`);
      check(name, 'stick: a resting thumb wobbling ±3 px neither turns nor moves the kid', wob.turn < 5 && wob.moved < 0.1, `${wob.turn.toFixed(1)} deg, ${wob.moved.toFixed(2)} m`);
      // BOO / JUMP: a tap 50 px off centre (that slides 6 px, as thumbs do) still lands
      const bo = await rect(page, '.hw-boo-btn'), ju = await rect(page, '.ui-touch-btn:not(.hw-boo-btn)');
      let hits = 0, looks = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, x = bo.cx + Math.cos(a) * 50, y = bo.cy + Math.sin(a) * 50;
        const y0 = await G(page, () => { window.__game.G.booT = 5; return window.__game.rig.yaw; });
        await T.start([{ x, y, id: 2 }]); await sleep(30); await T.move([{ x: x - 6, y: y + 3, id: 2 }]); await sleep(40); await T.end();
        await sleep(120);
        const r = await G(page, () => ({ booT: window.__game.G.booT, yaw: window.__game.rig.yaw }));
        if (r.booT < 1) hits++; else if (Math.abs(r.yaw - y0) > 0.005) looks++;
        await sleep(150);
      }
      check(name, 'BOO hit ring: taps 50 px off centre land (8 of 8)', hits === 8, `${hits} BOO, ${looks} turned the view`);
      await sleep(700);
      const away = Math.atan2(ju.cy - bo.cy, ju.cx - bo.cx); // from JUMP's centre, away from BOO
      const jy = (await state(page)).y;
      await T.tap(ju.cx + Math.cos(away) * 50, ju.cy + Math.sin(away) * 50, 5);
      check(name, 'JUMP hit ring: a tap 50 px off centre jumps', await waitFor(page, (y0) => window.__game.cc.position.y > y0 + 0.4, jy, 1500));
      await sleep(900);
      // the look pad: a tap that slides 6 px does not turn the view (a drag counts from 8 px)
      const lx = vp.width * 0.72, ly = Math.min(vp.height * 0.4, ju.y - 50);
      const ly0 = (await state(page)).yaw;
      await T.start([{ x: lx, y: ly, id: 4 }]); await sleep(30); await T.move([{ x: lx - 6, y: ly + 2, id: 4 }]); await sleep(40); await T.end();
      await sleep(100);
      check(name, 'look pad: a 6 px sliding tap does not turn the view', Math.abs((await state(page)).yaw - ly0) < 0.005);
      if (vp.height > vp.width) check(name, 'portrait: BOO sits below JUMP (where the thumb rests)', bo.cy > ju.cy + 40, `BOO ${Math.round(bo.cy)}, JUMP ${Math.round(ju.cy)}`);
      const rings = await G(page, () => [...document.querySelectorAll('.ui-touch-slop')].map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.width); }));
      check(name, 'BOO and JUMP carry a 16 px hit ring', rings.length === 2 && rings.every((w) => w >= 76 + 32), rings.join(', '));
    }
    // ---- the BOO lesson (a first session): the first ghost rose 9..11 m ahead of the camera, tame (slow, no catch)
    const tw = await waitFor(page, () => !!window.__game.G.tutorWake, null, 8000) && await G(page, () => ({ ...window.__game.G.tutorWake, tame: window.__game.ghosts.list.some((q) => q.tame > 0 || q.state !== 'dormant') }));
    check(name, 'BOO lesson: the first ghost rises in view, 9..11 m ahead', !!tw && tw.d > 8 && tw.d < 12 && tw.ahead > 0.85 && tw.tame, JSON.stringify(tw));
    // ---- smash a lantern by running into it
    await lineUpLantern(page);
    await sleep(200);
    a = await state(page);
    if (phone) { const zone = await rect(page, '.ui-touch-zone'); await T.drag(zone.x + zone.w * 0.45, zone.y + zone.h * 0.7, 0, -70, { steps: 4, hold: 900 }); }
    else { await page.keyboard.down('KeyW'); await sleep(900); await page.keyboard.up('KeyW'); }
    const smashed = await waitFor(page, (n) => window.__game.G.smashed > n, a.smashed, 2500);
    check(name, 'running into a jack-o\'-lantern smashes it', smashed);
    // ---- candy: spilled candy + a resting one get collected
    await sleep(1400);
    await nearCandy(page);
    const got = await waitFor(page, () => window.__game.G.candy > 0, null, 4000);
    s = await state(page);
    check(name, 'candy is collected (counter up)', got, `candy ${s.candy}`);
    await G(page, () => { window.__game.G.safeT = 0; }); // no invulnerability blink in the shot
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${name}-play.png`), scale: 'css' });
    if (name === 'pixel-landscape') {
      // ---- a Bluetooth gamepad paired to the phone (stubbed, standard mapping): left stick moves, A jumps, X BOOs
      await G(page, () => {
        const g = window.__game; g.G.safeT = 3; g.G.booT = 5;
        const pad = window.__pad = { id: 'Test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
        navigator.getGamepads = () => [pad, null, null, null];
      });
      const press = async (i) => { await G(page, (k) => { window.__pad.buttons[k] = { pressed: true, touched: true, value: 1 }; }, i); await sleep(120); await G(page, (k) => { window.__pad.buttons[k] = { pressed: false, touched: false, value: 0 }; }, i); };
      const g0 = await state(page);
      await G(page, () => { window.__pad.axes[1] = -1; }); await sleep(1100); await G(page, () => { window.__pad.axes[1] = 0; });
      const g1 = await state(page);
      await sleep(300);
      const gy = (await state(page)).y;
      await press(0);
      const padJump = await waitFor(page, (y0) => window.__game.cc.position.y > y0 + 0.4, gy, 1500);
      await sleep(700);
      await press(2);
      const padBoo = (await state(page)).booT < 1;
      await G(page, () => { navigator.getGamepads = () => [null, null, null, null]; });
      check(name, 'gamepad: left stick moves, A jumps, X BOOs', Math.hypot(g1.x - g0.x, g1.z - g0.z) > 3 && padJump && padBoo, `moved ${Math.hypot(g1.x - g0.x, g1.z - g0.z).toFixed(1)} m, jump ${padJump}, boo ${padBoo}`);
    }
    // ---- pause / resume (HUD button)
    const pb = await rect(page, '.hw-btns .hw-icon:last-child');
    if (phone) await T.tap(pb.cx, pb.cy); else await page.mouse.click(pb.cx, pb.cy);
    check(name, 'pause button pauses', await waitFor(page, () => window.__game.G.state === 'paused' && window.__game.engine.clock.paused, null, 2000));
    await sleep(700); // the overlay fades in
    if (phone) await page.screenshot({ path: path.join(OUT, `${name}-pause.png`), scale: 'css' });
    const pbs = await buttons(page, '.hw-screen:not(.off) button');
    check(name, 'pause buttons >= 44 x 44 px, inside the safe area', pbs.length >= 6 && pbs.every((b) => b.w >= 44 && b.h >= 44 && inSafe(b)), JSON.stringify(pbs.filter((b) => !(b.w >= 44 && b.h >= 44 && inSafe(b))).map((b) => [b.t, Math.round(b.w), Math.round(b.h)])));
    await tap(await rect(page, '.hw-screen:not(.off) [data-a=sound]'));
    const snd = await G(page, () => [window.__game.audio.muted, document.querySelector('[data-a=sound]').textContent]);
    await tap(await rect(page, '.hw-screen:not(.off) [data-a=sound]'));
    check(name, 'pause: SOUND toggles by touch', snd[0] === true && snd[1] === 'SOUND: OFF' && !(await G(page, () => window.__game.audio.muted)));
    await tap(await rect(page, '.hw-screen:not(.off) [data-a=help]'));
    const helpOver = await waitFor(page, () => !document.querySelector('.hw-help').classList.contains('off'), null, 1500);
    await sleep(400);
    await tap(await rect(page, '.hw-help [data-a=close]'));
    check(name, 'pause: HOW TO PLAY opens and closes', helpOver && await waitFor(page, () => document.querySelector('.hw-help').classList.contains('off') && window.__game.G.state === 'paused', null, 1500));
    await sleep(300);
    const rb = await rect(page, '.hw-screen:not(.off) [data-a=resume]');
    if (phone) await T.tap(rb.cx, rb.cy); else await page.mouse.click(rb.cx, rb.cy);
    check(name, 'resume', await waitFor(page, () => window.__game.G.state === 'play' && !window.__game.engine.clock.paused, null, 2000));
    // ---- backgrounding: the round pauses and the audio suspends; back in front it stays paused until RESUME
    await setHidden(page, true); await sleep(300);
    const bg = { state: (await state(page)).state, audio: await audioState(page) };
    await setHidden(page, false); await sleep(300);
    const fg = { state: (await state(page)).state, audio: await audioState(page) };
    check(name, 'tab hidden: round pauses, audio suspends; back: still paused', bg.state === 'paused' && bg.audio === 'suspended' && fg.state === 'paused' && fg.audio === 'suspended', `${JSON.stringify(bg)} -> ${JSON.stringify(fg)}`);
    const rb2 = await rect(page, '.hw-screen:not(.off) [data-a=resume]');
    if (phone) await T.tap(rb2.cx, rb2.cy); else await page.mouse.click(rb2.cx, rb2.cy);
    check(name, 'RESUME after backgrounding: playing, audio running', await waitFor(page, () => window.__game.G.state === 'play' && window.__game.audio.bus.ctx.state === 'running', null, 2000));
    // ---- a ghost comes for the kid; BOO sends it fleeing (and shakes candy out of it)
    await G(page, () => {
      const g = window.__game, gh = g.ghosts, q = gh.list.find((o) => o.state === 'dormant') || gh.list[0], p = g.cc.position;
      g.G.booT = 5; g.G.safeT = 1.5; // BOO ready; a short grace so the shot shows the chase, not a catch
      q.state = 'dormant';
      gh._teleport(q, p.x + 1.2, g.world.heightAt(p.x, p.z - 5) + 1.55, p.z - 5.5);
      q.state = 'chase'; q.t = 0; q.alpha = 1; q.mesh.mesh.visible = true; q.yaw = 0;
      g.rig.yaw = 0; g.rig.pitch = -0.22; g.camState.facing = 0; g.player.rotation.y = 0; g.rig.snap();
      window.__testGhost = q;
    });
    await sleep(700);
    if (name === 'desktop' || name === 'iphone-portrait') await page.screenshot({ path: path.join(OUT, `${name}-ghost.png`), scale: 'css' });
    a = await state(page);
    if (phone) { const bo = await rect(page, '.hw-boo-btn'); await T.tap(bo.cx, bo.cy); } else await page.keyboard.press('KeyE');
    const fled = await waitFor(page, () => window.__testGhost.state === 'flee' && window.__game.G.booed > 0, null, 1500);
    check(name, 'BOO scares a nearby ghost away', fled);
    check(name, 'the first BOO that lands ends the lesson for good (localStorage)', await G(page, () => { try { return localStorage.getItem('midnight-candy-run.taught') === '1'; } catch { return false; } }));
    await sleep(400);
    if (name === 'desktop' || name === 'iphone-portrait') await page.screenshot({ path: path.join(OUT, `${name}-boo.png`), scale: 'css' });
    // ---- BOO glows while it is ready and a chaser is in reach (and stops when none is)
    const hotSel = phone ? '.hw-boo-btn.hw-boo-hot' : '.hw-boo.hot';
    await G(page, () => {
      const g = window.__game, q = window.__testGhost, p = g.cc.position;
      for (const o of g.ghosts.list) { o.calm = 99; if (o.state === 'chase') o.state = 'wander'; }
      g.G.booT = 5; g.G.safeT = 0;
      g.ghosts._teleport(q, p.x + 6, p.y + 1.6, p.z); q.state = 'chase'; q.t = 0; q.calm = 0; q.alpha = 1; q.mesh.mesh.visible = true;
    });
    const hotOn = await waitFor(page, (q) => !!document.querySelector(q), hotSel, 1000);
    await G(page, () => { const q = window.__testGhost; q.state = 'wander'; q.calm = 99; window.__game.G.safeT = 3; });
    const hotOff = await waitFor(page, (q) => !document.querySelector(q), hotSel, 1000);
    check(name, 'BOO glows while a chaser is in reach (and only then)', hotOn && hotOff, `on ${hotOn}, off ${hotOff}`);
    // ---- at most 2 ghosts chase at once on phones (3 on desktop): every ghost up in a ring 7 m around the kid
    const cap = await G(page, () => new Promise((done) => {
      const g = window.__game, gh = g.ghosts, p = g.cc.position;
      while (gh.wake(p.x, p.z)) { /* every ghost up */ }
      gh.list.forEach((q, k) => { const a = (k / gh.list.length) * Math.PI * 2; gh._teleport(q, p.x + Math.cos(a) * 7, p.y + 1.6, p.z + Math.sin(a) * 7); q.state = 'wander'; q.t = 0; q.calm = 0; q.alpha = 1; q.retarget = 9; q.mesh.mesh.visible = true; });
      g.G.safeT = 0;
      let most = 0; const t0 = performance.now();
      const tick = () => {
        most = Math.max(most, gh.list.filter((q) => q.state === 'chase').length);
        if (performance.now() - t0 < 600) requestAnimationFrame(tick);
        else { g.G.safeT = 3; for (const q of gh.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; } done({ most, awake: gh.awake, max: gh.maxChasers }); }
      };
      requestAnimationFrame(tick);
    }));
    check(name, `at most ${phone ? 2 : 3} ghosts chase at once`, cap.most === (phone ? 2 : 3) && cap.max === cap.most, JSON.stringify(cap));
    // ---- edge markers: a big pop behind the camera (lollipop + distance), a ghost chasing from behind the kid (chevron)
    const popM = await G(page, () => {
      const g = window.__game, p = g.cc.position, f = new g.THREE.Vector3(); g.rig.getForward(f);
      for (let i = 0; i < g.candy.state.length; i++) if (g.candy.kind[i] === 2) g.candy.state[i] = 0; // no other pop around
      g.G.popT = 99;
      const x = p.x - f.x * 15, z = p.z - f.z * 15;
      window.__pop = g.candy.place(x, g.world.heightAt(x, z), z, 2);
      return window.__pop;
    });
    await sleep(300);
    const popEdge = await G(page, () => { const e = document.querySelector('.hw-edge.pop'), r = e.getBoundingClientRect(); return { on: e.classList.contains('on'), x: r.left, y: r.top, text: e.textContent.trim() }; });
    await G(page, (i) => { window.__game.candy.state[i] = 0; }, popM);
    const popGone = await waitFor(page, () => !document.querySelector('.hw-edge.pop').classList.contains('on'), null, 1000);
    check(name, 'edge marker: a big pop behind the camera (distance, inside the view), gone with the pop', popEdge.on && /1[45] m/.test(popEdge.text) && popEdge.x > 20 && popEdge.x < vp.width - 20 && popEdge.y > 60 && popEdge.y < vp.height - 60 && popGone, JSON.stringify(popEdge));
    await G(page, () => {
      const g = window.__game, q = window.__testGhost, p = g.cc.position, f = new g.THREE.Vector3(); g.rig.getForward(f);
      g.G.safeT = 0;
      g.ghosts._teleport(q, p.x - f.x * 8, p.y + 1.6, p.z - f.z * 8); q.state = 'chase'; q.t = 0; q.calm = 0;
    });
    const ghostEdge = await waitFor(page, () => [...document.querySelectorAll('.hw-edge.ghost.on')].some((e) => +e.style.opacity > 0.2), null, 600);
    await G(page, () => { const q = window.__testGhost; q.state = 'wander'; q.calm = 99; window.__game.G.safeT = 3; });
    check(name, 'edge marker: a ghost chasing from behind the kid shows a chevron', ghostEdge);
    // ---- a ghost catches the kid: it costs 10 % (2..12), the candy scatters to grab back, 3 s of safety, and the rest
    // of the pack (here a ghost 12 m off) backs off; then the haptics so far: candy, smash, BOO, catch on phones
    await G(page, () => {
      const g = window.__game, gh = g.ghosts, p = g.cc.position, q = gh.list.find((o) => o !== window.__testGhost) || window.__testGhost, w = window.__testGhost;
      g.G.safeT = 0; g.G.candy = 100; g.hud.setCandy(100);
      window.__minus = []; const plus = g.hud.plusText.bind(g.hud); g.hud.plusText = (t, bad) => { if (bad) window.__minus.push(t); plus(t, bad); };
      for (const o of gh.list) if (o.state === 'chase') o.state = 'wander';
      gh._teleport(w, p.x - 12, p.y + 1.6, p.z); w.state = 'wander'; w.calm = 0; w.retarget = 9;
      gh._teleport(q, p.x + 0.3, p.y + 1.6, p.z + 0.3);
      q.state = 'chase'; q.t = 0; q.alpha = 1; q.calm = 0; q.tame = 0; q.mesh.mesh.visible = true;
      window.__catcher = q;
    });
    const caughtOk = await waitFor(page, () => window.__game.G.caught > 0, null, 2000);
    check(name, 'a ghost touching the kid catches it', caughtOk);
    const cost = await G(page, () => ({ minus: window.__minus.join(' '), call: document.querySelector('.hw-call').textContent, safe: window.__game.G.safeT, calm: window.__testGhost.calm }));
    check(name, 'catch at 100 candy: costs 10, "GRAB IT BACK!", ~3 s safe, the pack within 14 m backs off', cost.minus === '−10' && /GRAB IT BACK/.test(cost.call) && cost.safe > 2.5 && cost.calm > 4, JSON.stringify(cost));
    await sleep(400);
    await G(page, () => {
      const g = window.__game, q = window.__catcher, p = g.cc.position;
      g.G.safeT = 0; g.G.candy = 300; g.hud.setCandy(300);
      g.ghosts._teleport(q, p.x + 0.3, p.y + 1.6, p.z + 0.3); q.state = 'chase'; q.t = 0; q.calm = 0;
    });
    const cost2 = await waitFor(page, () => window.__game.G.caught > 1, null, 2000) && await G(page, () => window.__minus.join(' '));
    check(name, 'catch at 300 candy: capped at 12', cost2 === '−10 −12', String(cost2));
    const vib = await G(page, () => window.__vib.map((v) => JSON.stringify(v)));
    const has = (v) => vib.includes(JSON.stringify(v));
    if (phone) check(name, 'haptics: candy, smash, BOO and catch pulses (navigator.vibrate)', has(8) && (has(35) || has([30, 40, 50])) && has(22) && has([70, 50, 90]), `${vib.length} calls: ${[...new Set(vib)].join(' ')}`);
    else check(name, 'no haptics with keyboard / mouse', vib.length === 0, `${vib.length} calls`);
    // ---- rotation mid-game (phones): portrait <-> landscape
    if (phone) {
      const before = await rect(page, '.ui-touch-btn:not(.hw-boo-btn)');
      await page.setViewportSize({ width: vp.height, height: vp.width });
      await sleep(900);
      const canvasOk = await G(page, () => { const c = window.__game.engine.renderer.domElement; return Math.abs(c.clientWidth - innerWidth) <= 1 && Math.abs(c.clientHeight - innerHeight) <= 1 && Math.abs(window.__game.engine.camera.aspect - innerWidth / innerHeight) < 0.01; });
      check(name, 'rotation: canvas + camera follow the new size', canvasOk);
      const after = await rect(page, '.ui-touch-btn:not(.hw-boo-btn)');
      const vp2 = page.viewportSize();
      check(name, 'rotation: JUMP re-laid out inside the viewport', inside(after, vp2) && (after.x !== before.x || after.y !== before.y), `${Math.round(before.x)},${Math.round(before.y)} -> ${Math.round(after.x)},${Math.round(after.y)}`);
      await page.screenshot({ path: path.join(OUT, `${name}-rotated.png`), scale: 'css' });
      await page.setViewportSize(vp);
      await sleep(700);
      // ---- the browser chrome (URL bar / toolbar) takes 70 px of the height, then gives it back
      await page.setViewportSize({ width: vp.width, height: vp.height - 70 });
      await sleep(600);
      const short = { width: vp.width, height: vp.height - 70 };
      const fit = await G(page, () => { const c = window.__game.engine.renderer.domElement; return Math.abs(c.clientHeight - innerHeight) <= 1 && Math.abs(window.__game.engine.camera.aspect - innerWidth / innerHeight) < 0.01; });
      const ctl = await G(page, () => [...document.querySelectorAll('.ui-touch-stick, .ui-touch-btn, .hw-btns, .hw-candy')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
      check(name, 'browser chrome height change: canvas follows, controls stay inside', fit && ctl.every((r) => inSafe(r, short)));
      await page.setViewportSize(vp);
      await sleep(500);
    }
    // ---- midnight: the round ends, results, best saved, play again
    await G(page, () => window.__game.setTimeLeft(1.2));
    check(name, 'the clock strikes midnight (ending)', await waitFor(page, () => window.__game.G.state === 'ending', null, 4000));
    check(name, 'results screen', await waitFor(page, () => window.__game.G.state === 'over' && !!document.querySelector('.hw-screen:not(.off) .hw-score'), null, 6000));
    await sleep(1800);
    s = await state(page);
    check(name, 'best score kept (localStorage)', s.best >= s.candy && (await G(page, () => { try { return +localStorage.getItem('midnight-candy-run.best'); } catch { return -1; } })) === s.best, `best ${s.best}`);
    await page.screenshot({ path: path.join(OUT, `${name}-end.png`), scale: 'css' });
    const again = await rect(page, '.hw-screen:not(.off) [data-a=again]');
    check(name, 'PLAY AGAIN inside the viewport', inside(again, vp));
    const rbs = await buttons(page, '.hw-screen:not(.off) button');
    check(name, 'results buttons >= 44 x 44 px, inside the safe area', rbs.length >= 2 && rbs.every((b) => b.w >= 44 && b.h >= 44 && inSafe(b)));
    if (phone) await T.tap(again.cx, again.cy); else await page.mouse.click(again.cx, again.cy);
    check(name, 'PLAY AGAIN restarts (candy 0, clock full; BOO learnt: no lesson ghost)', await waitFor(page, () => window.__game.G.state === 'play' && window.__game.G.candy === 0 && window.__game.G.left > 170 && !window.__game.G.tutor, null, 3000));
    if (name === 'iphone-portrait' || args.rounds) {
      // ---- five rounds back to back (lanterns smashed, every ghost up, candy spilled, then midnight, PLAY AGAIN):
      // geometries, textures, programs, physics bodies, scene objects, DOM nodes and listeners stay flat
      const seen = [];
      for (let r = 0; r < 5; r++) {
        await G(page, () => {
          const g = window.__game, p = g.cc.position;
          for (let i = 0, n = 0; i < g.lanterns.n && n < 4; i++) if (g.lanterns.alive[i]) { g.lanterns.smash(i, 1, 0, 1.5); n++; }
          while (g.ghosts.wake(p.x, p.z)) { /* every ghost up */ }
          g.candy.spill(p.x + 3, p.y + 1, p.z, 30, 3);
        });
        await sleep(1500);
        await G(page, () => window.__game.setTimeLeft(0.2));
        await waitFor(page, () => window.__game.G.state === 'over', null, 8000);
        await sleep(1000); // the results ignore taps for a moment (a thumb still on JUMP must not hit TITLE)
        seen.push(await counts(page));
        const ag = await rect(page, '.hw-screen:not(.off) [data-a=again]');
        if (phone) await T.tap(ag.cx, ag.cy); else await page.mouse.click(ag.cx, ag.cy);
        await waitFor(page, () => window.__game.G.state === 'play', null, 3000);
        await sleep(300);
      }
      const keys = Object.keys(seen[0]);
      const grew = keys.filter((k) => seen[4][k] > seen[1][k] + (k === 'dom' ? 2 : 0));
      check(name, '5 rounds back to back: resources and listeners flat', grew.length === 0, (grew.length ? grew : keys).map((k) => `${k} ${seen.map((c) => c[k]).join('>')}`).join(', '));
    }
    if (args.perf) {
      // ---- stress under 4x CPU throttling: every ghost chasing close by, 8 lanterns breaking at once, 80 candy flying
      const c2 = cdp || await ctx.newCDPSession(page);
      await c2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await sleep(1500);
      const sample = (ms) => G(page, (dur) => new Promise((done) => {
        const g = window.__game, out = [], t0 = performance.now();
        const tick = () => { out.push(g.engine.profiler.frame.ms); if (performance.now() - t0 < dur) requestAnimationFrame(tick); else done(out); };
        requestAnimationFrame(tick);
      }), ms);
      const calm = await sample(2000);
      const storm = sample(3000);
      await G(page, () => {
        const g = window.__game, p = g.cc.position;
        g.G.safeT = 99;
        while (g.ghosts.wake(p.x, p.z)) { /* every ghost up */ }
        for (const q of g.ghosts.list) { g.ghosts._teleport(q, p.x + (Math.random() - 0.5) * 8, p.y + 1.6, p.z + (Math.random() - 0.5) * 8); q.state = 'chase'; q.alpha = 1; }
        for (let i = 0, n = 0; i < g.lanterns.n && n < 8; i++) if (g.lanterns.alive[i]) { g.lanterns.smash(i, 1, 0, 1.5); n++; }
        g.candy.spill(p.x, p.y + 1, p.z, 80, 4);
      });
      const hot = await storm;
      await c2.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const q = (a, f) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; };
      const msg = `CPU ms per frame at 4x: calm p50 ${q(calm, 0.5).toFixed(1)} p95 ${q(calm, 0.95).toFixed(1)}; storm p50 ${q(hot, 0.5).toFixed(1)} p95 ${q(hot, 0.95).toFixed(1)} max ${Math.max(...hot).toFixed(1)}`;
      check(name, 'perf: 4x throttled storm stays under 16 ms CPU at p95', q(hot, 0.95) < 16, msg);
    }
    // page sanity: no scroll, no text selection
    const sane = await G(page, () => ({ sx: scrollX, sy: scrollY, sel: String(getSelection()), bodyScroll: document.scrollingElement.scrollHeight <= innerHeight + 1 }));
    check(name, 'page does not scroll / select', sane.sx === 0 && sane.sy === 0 && sane.sel === '' && sane.bodyScroll, JSON.stringify(sane));
    const perf = await G(page, () => { const f = window.__game.engine.profiler.frame; return { fps: Math.round(f.fps), cpu: +f.avg.toFixed(2), calls: f.calls, pr: window.__game.engine.pixelRatio }; });
    results.push(`info  ${name.padEnd(17)} ${JSON.stringify(perf)}`);
  } catch (e) {
    check(name, 'run', false, e.message.split('\n')[0]);
  }
  check(name, 'no console errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  check(name, 'no console warnings', warnings.length === 0, warnings.slice(0, 3).join(' || '));
  const gl = await withTimeout(page.evaluate(() => { const c = window.__game && window.__game.engine.renderer.getContext(); return c ? { err: c.getError(), lost: c.isContextLost() || window.__glLost > 0 } : null; }), 5000, 'gl').catch(() => null);
  check(name, 'no WebGL errors / context loss', !!gl && gl.err === 0 && !gl.lost, JSON.stringify(gl));
  await ctx.close();
}

/** A laptop with a touchscreen (reports no touch): the first touch reveals the controls, a key press hides them. */
async function runHybrid(name) {
  const ctx = await browser.newContext({ ...PROFILES[name] });
  const page = await ctx.newPage();
  const errors = watchErrors(page), warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.addInitScript(instrument);
  const cdp = await ctx.newCDPSession(page), T = touchApi(cdp), vp = page.viewportSize();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    check(name, 'loads', await waitFor(page, () => !!(window.__game && document.querySelector('.ui-loading') === null), null, 90000));
    await sleep(800);
    const v0 = await G(page, () => ({ touch: window.__game.TOUCH, ui: window.__game.touchUI, shown: window.__game.input.touchShown, label: document.querySelector('.hw-start').textContent, coarse: matchMedia('(pointer: coarse)').matches, points: navigator.maxTouchPoints }));
    check(name, 'reports no touch: keyboard / mouse presentation', !v0.touch && !v0.ui && !v0.shown && v0.label === 'CLICK TO START' && !v0.coarse && v0.points === 0, JSON.stringify(v0));
    const sb = await rect(page, '.hw-start');
    await T.tap(sb.cx, sb.cy); // a finger on TAP TO START
    check(name, 'the first touch reveals the touch controls (and the tap starts)', await waitFor(page, () => window.__game.touchUI && window.__game.input.touchShown && window.__game.G.state === 'play' && document.body.classList.contains('hw-touch-on'), null, 3000));
    await sleep(400);
    const ctl = await G(page, () => [...document.querySelectorAll('.ui-touch-stick, .ui-touch-btn')].filter((e) => getComputedStyle(e.closest('.ui-touch')).display !== 'none').length);
    check(name, 'stick, JUMP and BOO on screen', ctl === 3, `${ctl}`);
    await G(page, () => { const g = window.__game; g.G.safeT = 3; for (const q of g.ghosts.list) if (q.state === 'chase') q.state = 'wander'; });
    const a = await state(page), zone = await rect(page, '.ui-touch-zone');
    await T.drag(zone.x + zone.w * 0.45, zone.y + zone.h * 0.7, 0, -70, { steps: 6, hold: 1100 });
    const b = await state(page);
    check(name, 'the revealed stick moves the kid', Math.hypot(b.x - a.x, b.z - a.z) > 3, `${Math.hypot(b.x - a.x, b.z - a.z).toFixed(1)} m`);
    await page.screenshot({ path: path.join(OUT, `${name}-touch.png`), scale: 'css' });
    await page.keyboard.press('KeyW');
    check(name, 'a key press hides them again (keyboard presentation)', await waitFor(page, () => !window.__game.touchUI && !window.__game.input.touchShown && !document.body.classList.contains('hw-touch-on'), null, 2000));
    await T.tap(vp.width * 0.7, vp.height * 0.5);
    check(name, 'the next touch brings them back', await waitFor(page, () => window.__game.touchUI && window.__game.input.touchShown, null, 2000));
  } catch (e) {
    check(name, 'run', false, e.message.split('\n')[0]);
  }
  check(name, 'no console errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  check(name, 'no console warnings', warnings.length === 0, warnings.slice(0, 3).join(' || '));
  await ctx.close();
}

let url = args.url || null;
try {
  if (!url) { vite = await startVite(); url = `${vite.base}/halloween/`; }
  browser = await launchChrome({ headless: !args.headed, args: args.headed ? headedArgs : headlessArgs });
  for (const name of only) { if (name === 'hybrid') await runHybrid(name); else if (PROFILES[name]) await runProfile(name); else console.log(`unknown profile ${name}`); }
} catch (e) {
  console.error(e); failures++;
} finally {
  await cleanup();
}
console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll Halloween browser checks passed.');
console.log(`screenshots: ${path.relative(repoRoot, OUT)}/`);
process.exit(failures ? 1 : 0);
