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
// Environment (environment.js): the night escalates with the clock (storm level, cloud cover, the post fog's ground
// mist, the leaves in the air, the blood moon), a lightning strike flashes (softly) and makes the house windows
// stutter, every round starts calm again with nothing left in flight and no pooled effect or sound piling up (in the
// five-round run), and on pixel-portrait a second page with prefers-reduced-motion: reduce calms it (a slower,
// dimmer flash, slower leaves and clouds, less sway, no blinking windows) against the same probe on the normal page.
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
// Round 2: the candy pill's next-rank threshold and a rank-up call-out (white letters), a streak bonus on the 10th quick
// pickup (the meter on the pill), the pace against the best (localStorage, shown in the clock line in the next round),
// juice (a hitstop and a shake on a smash, an FOV punch on BOO, a shake on a catch; desktop: none of the motion with
// prefers-reduced-motion), the Witching Hour (call-out, x2 badge, every lantern relit, candy x2, candy rain, a catch
// capped at 6, orange auras), the last-ten countdown under the clock pill, the results' rank ladder and next-rank line,
// sharing (phones: Web Share, stubbed; desktop: the clipboard, stubbed, and a toast); phones: pushing straight into a
// gravestone slides round it, pushing into an inside corner (the graveyard fence's, Porch Row's) slides out along it.
// --perf also measures a finale storm (the Witching Hour on top of the storm).
// Porches (porches.js): a lit doormat is a treat (8 candies, the lamp dark for 40 s, "TRICK OR TREAT!"), a dark one pays
// nothing, BOO on a lit one is a trick (14, 60 s) whose resident ghost drops from the chimney and chases within a
// second, the haunted porch only knocks and its trick pays 22 with two residents (70 s), a visited porch lights its
// railing jack-o'-lantern, a relight fades the lamp up and lays a trail of 5, all five lane porches pay the Full Round
// once, a wandering ghost is the resident when none is dormant, the Witching Hour relights every porch, the results
// show porches n/5 and tricks, the ranks are v2; hints are paced (one call-out per 2.5 s, duplicates dropped). The
// --perf storm also tricks every porch at once.
// Grave hands and the candy thief (hands.js, thief.js; their rules in detail: test/halloween-enemies.mjs): the hands'
// lesson ("JUMP THE HANDS!" at the first telegraph in view), a 0.8 s telegraph then a grab ("GRABBED!") that holds the
// kid 1.0 s (a shove does not move it) and lets go with 3 spilled, a jump over standing hands is not grabbed, BOO
// within 4 m sends them down, a ghost's catch frees a grabbed kid, a grab still on at midnight ends with the round; the
// thief out at 1:00 ("A CANDY THIEF!", an edge marker), eating a planted cluster at 2 a second, never within 6 m of a
// kid standing still, BOO glowing with it in reach, a BOO stunning it 1.8 s, a touch then tagging it ("TAGGED! +12": its
// sack + 5), a cornered touch snatching 5; the Witching Hour bringing it back with 10 in its sack; TAGS on the results.
// The five-round check keeps both busy, and the --perf storms add four hands up and the thief bolting past.
// Mobile controls: every button (title, HUD, pause, how-to-play, results) is at least 44 x 44 px inside the safe area,
// HOW TO PLAY opens and closes by touch, the sound and pause buttons work, the full-screen button exists exactly where
// the Fullscreen API does and toggles, haptics fire on candy / smash / BOO / catch (navigator.vibrate stubbed; none on
// desktop), the stick stays held while the other thumb drags to look, the manifest + icons load (pixel-portrait), a
// stubbed Bluetooth gamepad plays (pixel-landscape: stick moves, A jumps, X BOOs), and the 'hybrid' profile (a laptop
// with a touchscreen: no touch reported) shows the touch controls on its first touch and hides them on a key press.
// Map v2 (desktop): the exports the rules build on (PORCHES, HAND_SPOTS, BRIDGES, CREEK, POP_SPOTS, SECRETS, CAULDRON),
// colliders <= 280 and 34 lanterns, every porch mat on its deck, the cottages' walls, the creek (walking out of its bed
// is blocked, a JUMP at the bank clears it, a running JUMP clears the creek, "JUMP OUT!" after 2 s in the bed), each
// footbridge end to end, the knoll path up to the haunted porch and down, every enclosure left on foot (the hollow oak,
// the Bale Yard's stair, Porch Row's yard, behind the east cottage, each porch), a flood fill of the whole map (no spot
// the kid can reach but not leave), the candy shares per zone, and a beacon within 30 m of anywhere on the lane. --perf
// also holds the map v2 budgets: the 4x storm's p95 <= 9.5 ms CPU and at most 166 draw calls a frame.
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
const RANKS_V2 = '0/60/140/230/360/520'; // hud.js RANKS thresholds (design 2.6, retuned on the pass-2 bots)
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
  // sharing: navigator.share and the async clipboard are recorded, not used
  window.__shared = []; window.__copied = [];
  Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value(d) { window.__shared.push(d); return Promise.resolve(); } });
  if (navigator.clipboard) navigator.clipboard.writeText = (t) => { window.__copied.push(t); return Promise.resolve(); };
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
/** The environment at `left` s to midnight after `ms` (its own easing), with the applied fog / sky values. */
const envAt = (page, left, ms = 3200) => G(page, ([L, ms]) => new Promise((done) => {
  const g = window.__game; g.setTimeLeft(L); g.G.safeT = 9;
  setTimeout(() => done({ ...g.env.stats(), fogMist: g.atmo.fogParams.mist, skyCover: g.atmo.sky.material.uniforms.uCover.value }), ms);
}), [left, ms]);
/**
 * The environment's motion 10 s before midnight with the gusts and the scheduled lightning held (so two pages compare
 * like for like): mean tree sway, leaf drift (m/s), cloud drift over the moon (m/s), then a strike(1): its flash 0.1 s
 * in, its peak, and the dimmest house window over the next 1.5 s.
 */
const envMotion = (page) => G(page, () => new Promise((done) => {
  const g = window.__game, e = g.env;
  g.setTimeLeft(10); g.G.safeT = 9;
  const hold = () => { e._gustT = 1e9; e._gustAge = 99; e._boltT = 1e9; e.setFinale(false); }; // (the clock alone)
  hold();
  const out = { sway: 0, n: 0, drift: 0, clouds: 0, flash01: -1, flashMax: 0, windowMin: 1 };
  let t0 = 0, s0 = null, tS = 0;
  const tick = (now) => {
    hold();
    const s = e.stats();
    if (!t0) t0 = now;
    const el = (now - t0) / 1000;
    if (el > 1.8 && !s0) s0 = { ...s, now };
    if (s0 && el < 3.3) { out.sway += s.sway; out.n++; }
    if (el >= 3.3 && !tS) {
      out.drift = (s.leafDrift - s0.leafDrift) / ((now - s0.now) / 1000); out.clouds = (s.cloudPhase - s0.cloudPhase) / ((now - s0.now) / 1000);
      out.sway /= Math.max(1, out.n); out.storm = s.storm; e.strike(1); tS = now;
    }
    if (tS) {
      const k = (now - tS) / 1000;
      if (out.flash01 < 0 && k >= 0.1) out.flash01 = s.flash;
      out.flashMax = Math.max(out.flashMax, s.flash); out.windowMin = Math.min(out.windowMin, s.windowMin);
      if (k > 1.5) { out.flashEnd = s.flash; e._gustT = 1; e._boltT = 12; done(out); return; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
const envNormal = {}; // profile -> envMotion on the normal page (the reduced-motion run compares with it)

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

/**
 * The map v2 (world.js + village.js), on the keyboard profile: the exports the porch / enemy passes build against, the
 * collider budget, the lantern count, the mats on their decks, the cottages' walls, the creek (walking out of the bed is
 * blocked, a JUMP clears the bank, a running jump clears the whole creek, "JUMP OUT!" after 2 s in the bed), each bridge
 * end to end, the knoll path up to the haunted house's steps and back down, every enclosure left on foot (the hollow
 * oak, the Bale Yard's stair, Porch Row's yard through a gate gap and over the fence, the east cottage's back, every
 * porch deck), a flood fill over the whole map from the spawn (no free spot the kid cannot get back from), the candy
 * shares per zone over 1200 spawns, and the beacon rule (a lamp, lantern or candle within 30 m of anywhere on the lane).
 */
async function mapChecks(page, name) {
  const calm = () => G(page, () => { const g = window.__game; g.G.safeT = 30; for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; } });
  const put = (x, z, yaw = 0, y = null) => G(page, ([x, z, yaw, y]) => { const g = window.__game; g.cc.teleport(x, y ?? g.world.heightAt(x, z) + 0.05, z); g.cc.velocity.set(0, 0, 0); g.rig.yaw = yaw; g.camState.facing = yaw; g.rig.snap(); }, [x, z, yaw, y]);
  /**
   * Hold W and steer (the camera's yaw) through the points; jump: (state) -> bool presses Space once, autoJump: a JUMP
   * whenever the kid is held up for 0.2 s. Returns { done, trace, minY, maxY, last }.
   */
  const walk = async (pts, { timeout = 9000, jump = null, autoJump = false, near = 0.6 } = {}) => {
    await calm();
    await page.keyboard.down('KeyW');
    let i = 0, jumped = false, slow = 0, minY = Infinity, maxY = -Infinity;
    const t0 = Date.now(), trace = [];
    while (i < pts.length && Date.now() - t0 < timeout) {
      const s = await G(page, ([x, z]) => { const g = window.__game, p = g.cc.position, dx = x - p.x, dz = z - p.z; g.rig.yaw = Math.atan2(-dx, -dz); g.G.safeT = 30; return { x: p.x, y: p.y, z: p.z, d: Math.hypot(dx, dz), g: g.cc.grounded, v: g.cc.speed }; }, pts[i]);
      trace.push(s); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
      if (jump && !jumped && jump(s)) { await page.keyboard.press('Space'); jumped = true; }
      if (autoJump) { slow = s.g && s.v < 1.2 && Date.now() - t0 > 300 ? slow + 1 : 0; if (slow >= 5) { await page.keyboard.press('Space'); slow = 0; } }
      if (s.d < near) i++;
      await sleep(30);
    }
    await page.keyboard.up('KeyW');
    await sleep(150);
    const last = await G(page, () => { const p = window.__game.cc.position; return { x: p.x, y: p.y, z: p.z }; });
    return { done: i >= pts.length, trace, minY, maxY, last };
  };
  const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : String(v));
  // ---- the exports, the budgets
  const ex = await G(page, () => {
    const g = window.__game, w = g.world;
    return {
      porches: w.porches.map((p) => [p.id, p.haunted, Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.yaw) && ['x', 'z', 'w', 'd', 'y'].every((k) => Number.isFinite(p.mat[k]))
        && p.lamp > 0 && p.railing > 0 && p.chimney.length === 3 && p.chimney.every(Number.isFinite) && w.glowGroups[p.lamp][0] === 5 && w.glowGroups[p.railing][0] === 5]),
      hands: w.handSpots.length, bridges: w.bridges.map((b) => b.id + (Number.isFinite(b.y) ? '' : '?')).join(''), creek: w.creek, pops: w.popSpots.filter((p) => p.length === 3 && p.every(Number.isFinite)).length,
      secrets: ['well', 'crypt', 'oak'].every((k) => w.secrets[k]) && w.secrets.crypt.group > 0 && w.secrets.oak.group > 0, cauldron: w.cauldron.brew > 0 && w.cauldron.brewHalo >= 0,
      vantage: w.vantage.length === 2, den: Number.isFinite(w.thiefDen.x), colliders: g.physics.staticBoxes.length, lanterns: g.lanterns.n, doors: g.porches.doors.count,
    };
  });
  check(name, 'map v2 exports: PORCHES (P1..P6, P6 haunted; mats, lamp / railing groups, chimneys), HAND_SPOTS, BRIDGES, CREEK, POP_SPOTS, SECRETS, CAULDRON, VANTAGE, THIEF_DEN',
    ex.porches.length === 6 && ex.porches.every((p, i) => p[0] === `P${i + 1}` && p[2] && p[1] === (i === 5)) && ex.hands === 10 && ex.bridges === 'WCE' && ex.creek.z0 === 19 && ex.creek.z1 === 22.5 && ex.creek.depth === 1.2
    && ex.pops === 2 && ex.secrets && ex.cauldron && ex.vantage && ex.den && ex.doors === 6, JSON.stringify(ex));
  check(name, `colliders <= 280, 34 lanterns`, ex.colliders <= 280 && ex.lanterns === 34, `${ex.colliders} colliders, ${ex.lanterns} lanterns`);
  // ---- every mat lies on its deck: a kid dropped on it stands at mat.y
  const mats = [];
  for (let i = 0; i < 6; i++) {
    const m = await G(page, (k) => window.__game.world.porches[k].mat, i);
    await put(m.x, m.z, 0, m.y + 0.4); await sleep(450);
    const s = await G(page, () => ({ y: window.__game.cc.position.y, g: window.__game.cc.grounded }));
    mats.push([i + 1, +(s.y - m.y).toFixed(3), s.g]);
  }
  check(name, 'porch mats: a kid on each mat stands on its deck (mat.y)', mats.every(([, d, gr]) => Math.abs(d) < 0.06 && gr), JSON.stringify(mats));
  // ---- the cottages' walls block (P3 from behind: walking north into its back wall)
  await put(-4, 40.5, 0); await sleep(200);
  const wall = await walk([[-4, 33]], { timeout: 1800 });
  check(name, 'cottage walls block (P3, walked into from behind)', !wall.done && wall.last.z > 38.2, `stopped at z ${f2(wall.last.z)}`);
  // ---- the creek
  const C = ex.creek, bedZ = (C.z0 + C.z1) / 2;
  await put(10, bedZ, 0); await sleep(300);
  const bed0 = await G(page, () => window.__game.cc.position.y);
  const out1 = await walk([[10, 15]], { timeout: 2600 });
  const told = await G(page, () => document.querySelector('.hw-call').textContent);
  check(name, 'creek: walking out of the bed is blocked by the bank; "JUMP OUT!" after 2 s down there', !out1.done && out1.last.z > C.z0 + C.lip - 0.05 && out1.maxY < bed0 + 0.4 && /JUMP OUT/.test(told), `z ${f2(out1.last.z)}, rose ${f2(out1.maxY - bed0)} m, call "${told}"`);
  await put(10, bedZ, 0); await sleep(300);
  const out2 = await walk([[10, 15]], { timeout: 3000, jump: (s) => s.z < C.z0 + C.lip + 0.45 });
  check(name, 'creek: a JUMP at the bank gets the kid out', out2.done || out2.last.z < C.z0 - 0.5, `ended at z ${f2(out2.last.z)}`);
  await put(10, 11, Math.PI); await sleep(300);
  const leap = await walk([[10, 30]], { timeout: 3500, jump: (s) => s.z > 17 });
  const inBed = leap.trace.filter((s) => s.z > C.z0 + C.lip && s.z < C.z1 - C.lip && s.g && s.y < bed0 + 0.6).length;
  const land = leap.trace.find((s, k) => k > 0 && s.g && leap.trace[k - 1].z > 17 && s.z > C.z0);
  check(name, 'creek: a running JUMP at z 17 clears it (lands past z 23)', inBed === 0 && !!land && land.z > 23, `landed at z ${land ? f2(land.z) : '?'}, ${inBed} samples in the bed`);
  // ---- candy spilled on a bridge lands on its deck (not in the creek under it)
  await put(-10, 10, 0); await sleep(200);
  const spill = await G(page, () => new Promise((done) => {
    const g = window.__game, b = g.world.bridges.find((q) => q.id === 'C'), C = g.candy;
    C.spill(b.x, b.y + 1.2, b.z, 6, 0.6, 0.1, 30);
    setTimeout(() => {
      const ys = [];
      for (let i = 0; i < C.state.length; i++) if (C.state[i] === 2 && Math.hypot(C.p[i * 3] - b.x, C.p[i * 3 + 2] - b.z) < 1.25) ys.push(+(C.p[i * 3 + 1] - b.y).toFixed(2));
      done(ys);
    }, 1800);
  }));
  check(name, 'candy spilled on a footbridge lands on its deck', spill.length >= 3 && spill.every((dy) => Math.abs(dy) < 0.06), JSON.stringify(spill));
  // ---- each bridge, end to end (south from the green side), never down in the bed
  const br = [];
  for (const id of ['W', 'C', 'E']) {
    const b = await G(page, (k) => { const q = window.__game.world.bridges.find((o) => o.id === k); return { x: q.x, y: q.y }; }, id);
    await put(b.x, 15.5, Math.PI); await sleep(250);
    const r = await walk([[b.x, 26.5]], { timeout: 4000 });
    const onDeck = r.trace.filter((s) => s.z > C.z0 + 0.4 && s.z < C.z1 - 0.4);
    br.push([id, r.done, onDeck.length ? f2(Math.min(...onDeck.map((s) => s.y)) - b.y) : 'n/a']);
  }
  check(name, 'bridges W, C, E: walkable end to end (on the deck all the way)', br.every(([, d, dy]) => d && +dy > -0.15), JSON.stringify(br));
  // ---- the knoll: the spoke up to the vantage and the haunted house's steps, then back down to the lane
  await put(0, 6, 0); await sleep(250);
  const up = await walk([[-12, -8.3], [-17, -15], [-20.8, -16.3]], { timeout: 9000, near: 0.8 });
  const plateau = await G(page, () => { const w = window.__game.world, k = w.knoll; return w.heightAt(k.x, k.z); });
  const down = await walk([[-17, -15], [-12, -8.6], [-12, -6]], { timeout: 7000, near: 0.8 });
  check(name, 'knoll: the path walks up to the plateau (the haunted porch\'s steps) and back down', up.done && up.maxY > plateau - 0.6 && down.done && down.last.y < plateau - 3, `up ${up.done} (top ${f2(up.maxY)} of ${f2(plateau)}), down ${down.done} (y ${f2(down.last.y)})`);
  // ---- enclosures: in and out on foot
  const enc = {};
  await put(-41.2, -41.2, 0); await sleep(250);
  const oakIn = await walk([[-43.9, -43.9]], { timeout: 3000, near: 0.45 });
  const oakOut = await walk([[-41.6, -41.6], [-38, -38]], { timeout: 4000 });
  enc.oak = oakIn.done && oakOut.done;
  await put(37.7, 34.6, Math.PI); await sleep(250);
  const top = await G(page, () => window.__game.world.popSpots[1][2]);
  const climb = await walk([[38.3, 38.3], [40.2, 40.2], [42.75, 42.75]], { timeout: 9000, autoJump: true, near: 0.7 });
  const off = await walk([[46.5, 46.5]], { timeout: 3500 });
  enc.baleYard = climb.done && climb.maxY > top - 0.15 && off.done;
  await put(-4, 43, 0); await sleep(250);
  enc.rowGate = (await walk([[-15, 36], [-15, 30], [-4, 27]], { timeout: 7000 })).done;
  await put(-10.5, 34.5, 0); await sleep(250);
  enc.rowHop = (await walk([[-10.5, 29]], { timeout: 3000, jump: (s) => s.z < 33.1 })).done;
  await put(49.15, -2, Math.PI); await sleep(250);
  enc.p5Back = (await walk([[49.15, 3], [44, 4]], { timeout: 5000 })).done;
  // every porch: up its steps onto the mat from 6 m out, off again to the side round its railing, and straight out
  const decks = [];
  for (let i = 0; i < 6; i++) {
    const p = await G(page, (k) => { const q = window.__game.world.porches[k]; return { x: q.mat.x, z: q.mat.z, y: q.mat.y, yaw: q.yaw }; }, i);
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), sx = fz, sz = -fx; // out from the door; along the wall
    await put(p.x + fx * 6, p.z + fz * 6, p.yaw); await sleep(250);
    const onto = await walk([[p.x, p.z]], { timeout: 3500, near: 0.5 });
    const side = await walk([[p.x + fx * 1.2 + sx * 4, p.z + fz * 1.2 + sz * 4], [p.x + fx * 4 + sx * 4, p.z + fz * 4 + sz * 4]], { timeout: 4000, autoJump: true, near: 0.7 });
    await put(p.x, p.z, p.yaw + Math.PI, p.y + 0.3); await sleep(250);
    const out = await walk([[p.x + fx * 5, p.z + fz * 5]], { timeout: 3000 });
    decks.push(`${onto.done ? 1 : 0}${side.done ? 1 : 0}${out.done ? 1 : 0}`);
  }
  await G(page, () => window.__game.porches.reset(false));
  enc.decks = decks.every((d) => d === '111');
  check(name, 'enclosures: the hollow oak in and out, up the Bale Yard\'s stair to the pop and off, Porch Row\'s yard through a gate gap and over the fence, behind the east cottage; every porch onto its mat, off round the side, out the front', Object.values(enc).every(Boolean), JSON.stringify({ ...enc, decks }));
  // ---- the whole map: from the spawn, every free spot (0.5 m grid) is reachable and the kid can get back
  const flood = await G(page, () => {
    const g = window.__game, w = g.world, P = g.physics, S = 0.5, N = Math.round(99 / S) + 1, o = -49.5;
    const h = new Float32Array(N * N), free = new Uint8Array(N * N), out = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = o + i * S, z = o + j * S, k = j * N + i, ground = w.heightAt(x, z);
      // the kid (r 0.3) next to a low box stands at its top (a step, a jump); a box over 2.4 m (a wall, a house) blocks
      let top = ground, wall = false;
      for (const b of P.queryColliders(x, z, 0.3, out)) {
        if (b.minX === undefined || b.maxY < ground - 0.05) continue;
        if (b.maxY - ground > 2.4) wall = true; else top = Math.max(top, b.maxY);
      }
      h[k] = top; free[k] = wall ? 0 : 1;
    }
    // reachable from the spawn, moving to a neighbour no more than a jump (1.3 m) higher; and back: from each cell the
    // spawn's region is reachable on the reversed graph (a cell the kid can enter but not leave is a trap)
    const flow = (from, rev) => {
      const seen = new Uint8Array(N * N), q = [from]; seen[from] = 1;
      while (q.length) {
        const k = q.pop(), i = k % N, j = (k - i) / N;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue;
          const n = b * N + a; if (seen[n] || !free[n]) continue;
          if ((rev ? h[k] - h[n] : h[n] - h[k]) > 1.3) continue;
          seen[n] = 1; q.push(n);
        }
      }
      return seen;
    };
    const s0 = Math.round((6 - o) / S) * N + Math.round((0 - o) / S), fwd = flow(s0, false), back = flow(s0, true);
    let freeN = 0, unreached = 0; const traps = [];
    for (let k = 0; k < N * N; k++) { if (!free[k]) continue; freeN++; if (!fwd[k]) unreached++; else if (!back[k]) traps.push([+(o + (k % N) * S).toFixed(1), +(o + Math.floor(k / N) * S).toFixed(1)]); }
    return { free: freeN, unreached, traps: traps.length, sample: traps.slice(0, 8) };
  });
  check(name, 'no trap anywhere: every free spot reached from the spawn can get back to it (0.5 m grid, a jump climbs 1.3 m)', flood.traps === 0, JSON.stringify(flood));
  // ---- candy shares per zone (1200 spawns) and the beacon rule
  const shares = await G(page, () => {
    const w = window.__game.world, out = [0, 0, 0], n = {};
    for (let k = 0; k < 1200; k++) if (w.candySpot(out)) n[w.candySpot.zone] = (n[w.candySpot.zone] || 0) + 1;
    const tot = Object.values(n).reduce((a, b) => a + b, 0);
    return w.candySpot.shares.map(([z, want]) => [z, want, +((n[z] || 0) / tot).toFixed(3)]);
  });
  check(name, 'candy spawns: each zone\'s share within 5 % of the design (lane 30, graveyard 22, patch 13, porches 10, creek 8, knoll 7, anywhere 10)', shares.every(([, want, got]) => Math.abs(got - want) <= 0.05), JSON.stringify(shares));
  const trails = await G(page, () => {
    const P = window.__game.porches, T = P.trail, n = window.__game.PORCH.TRAIL;
    return { lane: P.spots.map((S, k) => [P.trailN[k], +Math.max(0, ...Array.from({ length: P.trailN[k] }, (_, j) => Math.hypot(T[(k * n + j) * 2] - S.mat.x, T[(k * n + j) * 2 + 1] - S.mat.z))).toFixed(1)]), spawn: P.startTrailN };
  });
  check(name, 'porch trails on the map: 5 spots along the lane within 12 m of each mat, 5 from the spawn to P1', trails.lane.every(([n, d]) => n === 5 && d <= 12.5) && trails.spawn === 5, JSON.stringify(trails));
  const beacon = await G(page, () => {
    const w = window.__game.world, B = w.beacons;
    let worst = 0, at = null;
    for (const L of w.paths) for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let s = 0; s <= n; s++) {
        const x = ax + ((bx - ax) * s) / n, z = az + ((bz - az) * s) / n;
        let d = Infinity; for (const b of B) d = Math.min(d, Math.hypot(b[0] - x, b[1] - z));
        if (d > worst) { worst = d; at = [+x.toFixed(1), +z.toFixed(1)]; }
      }
    }
    // the clutter cap (DESIGN 7.1): most porch lamps / lanterns inside one 20 m circle (2 m grid of centres)
    let lamps = 0, lan = 0;
    for (let x = -48; x <= 48; x += 2) for (let z = -48; z <= 48; z += 2) {
      let a = 0, b = 0; for (const q of B) if (Math.hypot(q[0] - x, q[1] - z) <= 10) { if (q[2] === 'porch') a++; else if (q[2] === 'lantern') b++; }
      lamps = Math.max(lamps, a); lan = Math.max(lan, b);
    }
    return { worst: +worst.toFixed(1), at, beacons: B.length, maxLampsIn20m: lamps, maxLanternsIn20m: lan };
  });
  check(name, 'beacons: a porch lamp, lantern or bridge candle within 30 m of anywhere on the lane', beacon.worst <= 30, JSON.stringify(beacon));
  // (standing on every mat treated the porches: back to a fresh round's porches for the porch checks)
  await G(page, () => { const g = window.__game; g.setTimeLeft(Math.max(g.G.left, 170)); g.porches.reset(false); g.hud.clearCalls(); });
}

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
    await G(page, () => { const g = window.__game.G; g.handsAt = 1e9; g.thiefAt = 1e9; }); // the hands and the thief: their own section
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
      await mapChecks(page, name); // the map v2: exports, budgets, the creek, bridges, the knoll, enclosures, candy shares
      await calmAll(); await home(); await sleep(200);
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
      // ---- slide around: the stick pushed straight at a free-standing gravestone 2 m ahead: the kid slides round it
      const grave = await G(page, () => { const g = window.__game; for (const s of g.world.graves) if (g.physics.queryColliders(s.x, s.z, 2.6, []).length === 1 && !g.physics.queryColliders(s.x, s.z + 2, 0.5, []).length) return [s.x, s.z]; return null; });
      if (!grave) check(name, 'slide around: a free-standing gravestone to test on', false);
      else {
        await calmAll();
        await G(page, ([x, z]) => { const g = window.__game; g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); g.rig.yaw = 0; g.camState.facing = 0; g.rig.snap(); }, [grave[0], grave[1] + 2]);
        await sleep(200);
        await T.start([{ x: hx, y: hy, id: 1 }]);
        for (let i = 1; i <= 4; i++) { await T.move([{ x: hx, y: hy - i * 13, id: 1 }]); await sleep(16); }
        const past = await waitFor(page, (gz) => window.__game.cc.position.z < gz - 0.7, grave[1], 1500);
        await T.end();
        const pe = await G(page, () => ({ x: window.__game.cc.position.x, z: window.__game.cc.position.z }));
        check(name, 'slide around: pushing straight into a gravestone slides round it (past within 1.5 s)', past && Math.abs(pe.x - grave[0]) < 3, `past ${past}, ended ${(pe.x - grave[0]).toFixed(2)} m to the side`);
      }
      // ---- (map v2) and out of an inside corner: in the graveyard's south-west and south-east corners, the stick pushed at
      // the lit mat beyond the fence (P1, P5; bots stood there 85 s), and on Porch Row's lane side where the picket fence
      // runs into P4's front, pushing at the yard behind: 20 degrees either side, the kid slides out along the wall
      // (world.js GRAVEYARD x0 8, x1 46, z1 -10; ROW_FENCE z 32, its stretch 8.2..14.4 ends at P4's west wall)
      const corners = [];
      for (const [x, z, k, tz] of [[8.45, -10.45, 0], [45.55, -10.45, 4], [13.95, 31.5, -1, 40]]) for (const err of [-0.35, 0.35]) {
        await calmAll();
        await G(page, ([x, z, k, tz, err]) => {
          const g = window.__game, m = k >= 0 ? g.world.porches[k].mat : { x, z: tz }, yaw = Math.atan2(-(m.x - x), -(m.z - z)) + err;
          g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); g.cc.velocity.set(0, 0, 0); g.rig.yaw = yaw; g.camState.facing = yaw; g.rig.snap();
        }, [x, z, k, tz ?? 0, err]);
        await sleep(200);
        await T.start([{ x: hx, y: hy, id: 1 }]);
        for (let i = 1; i <= 4; i++) { await T.move([{ x: hx, y: hy - i * 13, id: 1 }]); await sleep(16); }
        const out = await waitFor(page, ([x, z]) => Math.hypot(window.__game.cc.position.x - x, window.__game.cc.position.z - z) > 3, [x, z], 2500);
        await T.end();
        corners.push(out ? 1 : 0);
      }
      check(name, "slide around: pushed into an inside corner (the graveyard's SW and SE at a porch beyond, Porch Row's fence into P4; 20 degrees either side), the kid slides out along the wall (3 m in 2.5 s)", corners.every(Boolean), corners.join(''));
    }
    // ---- the BOO lesson (a first session): the first ghost rose 9..11 m ahead of the camera, tame (slow, no catch)
    const tw = await waitFor(page, () => !!window.__game.G.tutorWake, null, 8000) && await G(page, () => ({ ...window.__game.G.tutorWake, tame: window.__game.ghosts.list.some((q) => q.tame > 0 || q.state !== 'dormant') }));
    check(name, 'BOO lesson: the first ghost rises in view, 9..11 m ahead (6.5..9 with a house in the way)', !!tw && tw.d > 5.5 && tw.d < 12 && tw.ahead > 0.85 && tw.tame, JSON.stringify(tw));
    // ---- smash a lantern by running into it (and the juice: a hitstop, a camera shake)
    await lineUpLantern(page);
    await sleep(200);
    const juice0 = await G(page, () => { const g = window.__game, j = g.juice; window.__minTS = 1; const tick = () => { window.__minTS = Math.min(window.__minTS, g.engine.clock.timeScale); if (!window.__tsDone) requestAnimationFrame(tick); }; window.__tsDone = false; requestAnimationFrame(tick); return { shakes: j.shakes, stops: j.stops }; });
    a = await state(page);
    if (phone) { const zone = await rect(page, '.ui-touch-zone'); await T.drag(zone.x + zone.w * 0.45, zone.y + zone.h * 0.7, 0, -70, { steps: 4, hold: 900 }); }
    else { await page.keyboard.down('KeyW'); await sleep(900); await page.keyboard.up('KeyW'); }
    const smashed = await waitFor(page, (n) => window.__game.G.smashed > n, a.smashed, 2500);
    check(name, 'running into a jack-o\'-lantern smashes it', smashed);
    await sleep(300);
    const juice1 = await G(page, () => { window.__tsDone = true; const g = window.__game; return { shakes: g.juice.shakes, stops: g.juice.stops, minTS: window.__minTS, ts: g.engine.clock.timeScale }; });
    check(name, 'juice: a smash gives a hitstop (game speed 0.15, back to 1) and a camera shake', juice1.stops > juice0.stops && juice1.shakes > juice0.shakes && juice1.minTS === 0.15 && juice1.ts === 1, JSON.stringify(juice1));
    // ---- candy: spilled candy + a resting one get collected
    await sleep(1400);
    await nearCandy(page);
    const got = await waitFor(page, () => window.__game.G.candy > 0, null, 4000);
    s = await state(page);
    check(name, 'candy is collected (counter up)', got, `candy ${s.candy}`);
    // ---- ranks: the pill shows the next rank's threshold; a pickup that reaches a rank calls it out (white letters)
    const pick = (setup) => G(page, (src) => new Promise((done) => {
      const g = window.__game, p = g.cc.position, C = g.candy;
      g.cc.teleport(0, g.world.heightAt(0, 6) + 0.05, 6); // the spawn, with no candy in reach
      for (let i = 0; i < C.state.length; i++) if (C.state[i] && Math.hypot(C.p[i * 3], C.p[i * 3 + 2] - 6) < 5) C.state[i] = 0;
      g.G.safeT = 3; (0, eval)(src)(g); g.hud.setCandy(g.G.candy);
      C.place(p.x, p.y, p.z, 0);
      setTimeout(() => {
        const c = document.querySelector('.hw-call');
        done({ candy: g.G.candy, call: c.textContent, color: getComputedStyle(c).color, goal: document.querySelector('.hw-candy .goal').textContent,
          bonus: g.G.streakBonus, meter: [...document.querySelectorAll('.hw-streak i.f')].length, meterOn: document.querySelector('.hw-streak').classList.contains('on'),
          R: g.RANKS });
      }, 250);
    }), setup.toString());
    const ru = await pick((g) => { g.G.candy = g.RANKS[2][0] - 1; g.G.rankMax = 1; g.G.streak = 0; });
    check(name, 'ranks: a pickup reaching a rank calls it out (white), the pill shows the next threshold', ru.candy === ru.R[2][0] && ru.call.startsWith(`${ru.R[2][1].toUpperCase()}!`) && ru.color === 'rgb(255, 255, 255)' && ru.goal === `/${ru.R[3][0]}`, JSON.stringify({ candy: ru.candy, call: ru.call, color: ru.color, goal: ru.goal }));
    // ---- a streak: the 10th quick pickup in a row adds a bonus of 3 (the meter on the pill is full)
    const st = await pick((g) => { g.G.candy = 40; g.G.streak = 9; g.G.lastPick = g.G.time; g.G.streakBonus = 0; });
    check(name, 'streak: the 10th quick pickup adds +3 with "SWEET STREAK!", the meter full', st.candy === 44 && st.bonus === 3 && /SWEET STREAK/.test(st.call) && st.meterOn && st.meter === 10, JSON.stringify({ candy: st.candy, bonus: st.bonus, call: st.call, meter: st.meter, on: st.meterOn }));
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
    await G(page, () => { const g = window.__game; window.__minFov = 999; window.__fovDone = false; const tick = () => { window.__minFov = Math.min(window.__minFov, g.engine.camera.fov); if (!window.__fovDone) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    if (phone) { const bo = await rect(page, '.hw-boo-btn'); await T.tap(bo.cx, bo.cy); } else await page.keyboard.press('KeyE');
    const fled = await waitFor(page, () => window.__testGhost.state === 'flee' && window.__game.G.booed > 0, null, 1500);
    check(name, 'BOO scares a nearby ghost away', fled);
    await sleep(500);
    const punch = await G(page, () => { window.__fovDone = true; const g = window.__game; return { min: +window.__minFov.toFixed(2), fov: g.engine.camera.fov, base: g.baseFov }; });
    check(name, `juice: BOO punches the FOV in (${phone ? '-3' : '-5'} deg) and back`, punch.min < punch.base - (phone ? 1.5 : 2.5) && punch.min > punch.base - 5.5 && punch.fov === punch.base, JSON.stringify(punch));
    if (!phone) {
      // prefers-reduced-motion: no FOV punch (nor shake); the call-outs only fade
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await G(page, () => { const g = window.__game; g.G.booT = 5; window.__p0 = g.juice.punches; window.__minFov = 999; window.__fovDone = false; const tick = () => { window.__minFov = Math.min(window.__minFov, g.engine.camera.fov); if (!window.__fovDone) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await page.keyboard.press('KeyE');
      await sleep(150);
      const anim = await G(page, () => getComputedStyle(document.querySelector('.hw-call')).animationName);
      await sleep(300);
      const rm = { ...(await G(page, () => { window.__fovDone = true; const g = window.__game; return { punches: g.juice.punches - window.__p0, min: window.__minFov, base: g.baseFov, booT: g.G.booT }; })), anim };
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      check(name, 'reduced motion: BOO without the FOV punch, call-outs only fade', rm.booT < 1 && rm.punches === 0 && rm.min === rm.base && rm.anim === 'hwFade', JSON.stringify(rm));
    }
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
    await sleep(250); // the catch's hitstop is over
    const cj = await G(page, () => ({ shakes: window.__game.juice.shakes, ts: window.__game.engine.clock.timeScale }));
    check(name, 'juice: catches shake the camera (gentler on phones), game speed back to 1', cj.shakes >= (phone ? 3 : 3) && cj.ts === 1, JSON.stringify(cj));
    // ---- porches (porches.js): a treat on a lit mat (8, the lamp dark for 40 s), a dark mat (nothing), a trick (BOO on
    // the mat: 14, a resident drops from the chimney and chases, 60 s), the haunted porch (a knock only; a trick: 22 and
    // two residents, 70 s), the railing jack-o'-lanterns, a relight (the lamp, a trail), the Full Round (+25, once), the
    // paced call-outs (one per 2.5 s, duplicates dropped), a resident from a wandering ghost
    await G(page, () => {
      const g = window.__game, C = g.candy;
      g.setTimeLeft(120); g.G.popT = 99; g.G.riseSaid = true; g.G.wakeIdx = 99; // mid-round, no pop or ghost news meanwhile
      g.hud.clearCalls(); // (the last catch's call-out would hold the screen a second against the porch's)
      g.porches.reset(false); // (a check before may have walked the kid over a mat: the gatekeeper's is 17 m from the spawn)
      window.__spills = []; window.__calls = [];
      const sp = C.spill.bind(C); C.spill = (x, y, z, n, s, d, ttl) => { if (ttl === g.PORCH.SPILL_TTL) window.__spills.push(n); return sp(x, y, z, n, s, d, ttl); };
      const co = g.hud.callout.bind(g.hud); g.hud.callout = (t, ...r) => { window.__calls.push(t); return co(t, ...r); };
      g.G.candy = 10; g.hud.setCandy(10); g.G.streak = 0;
    });
    /** The kid onto porch k's mat (camera behind it on the lane side), the ghosts calm and away, no candy near. */
    const ontoMat = (k, safe = 9) => G(page, ([k, safe]) => {
      const g = window.__game, S = g.porches.spots[k], yaw = S.yaw, C = g.candy;
      g.G.safeT = safe; g.G.streak = 0;
      for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; }
      for (let i = 0; i < C.state.length; i++) if (C.state[i] && Math.hypot(C.p[i * 3] - S.mat.x, C.p[i * 3 + 2] - S.mat.z) < 9) C.state[i] = 0;
      g.rig.yaw = yaw; g.camState.facing = yaw; g.player.rotation.y = yaw;
      g.cc.teleport(S.mat.x, S.mat.y + 0.05, S.mat.z); g.cc.velocity.set(0, 0, 0); g.rig.snap();
      return { st: g.porches.st[k], spills: window.__spills.length };
    }, [k, safe]);
    const offMat = (k) => G(page, (k) => { const g = window.__game, S = g.porches.spots[k], x = S.mat.x + Math.sin(S.yaw) * 4, z = S.mat.z + Math.cos(S.yaw) * 4; g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); }, k);
    const pboo = async () => { if (phone) { const bo = await rect(page, '.hw-boo-btn'); await T.tap(bo.cx, bo.cy); } else await page.keyboard.press('KeyE'); };
    const psnap = () => G(page, () => window.__game.porches.snapshot());
    // a treat at P3
    const c0 = (await state(page)).candy;
    await ontoMat(2);
    const treated = await waitFor(page, () => window.__game.porches.st[2] === 2, null, 2000);
    const t1 = await G(page, () => ({ spills: window.__spills.slice(), call: document.querySelector('.hw-call').textContent, cd: window.__game.porches.cd[2], door: window.__game.porches.door[2], plus: document.querySelector('.hw-plus').textContent }));
    await sleep(1800);
    const t2 = await psnap(), c1 = (await state(page)).candy;
    check(name, 'porch: a lit mat is a treat (a knock, the door opens, 8 candies pour out, "TRICK OR TREAT!"), the lamp goes dark for 40 s',
      treated && t1.spills.join() === '8' && /TRICK OR TREAT/.test(t1.call) && t1.plus === '+8' && t1.cd > 39 && t1.cd <= 40 && t1.door > 0.1 && t2.porches[2].lamp < 0.05 && c1 - c0 >= 6,
      JSON.stringify({ treated, ...t1, lamp: t2.porches[2].lamp, gained: c1 - c0 }));
    check(name, 'porch: a visited porch lights the jack-o\'-lantern on its railing', t2.porches[2].visited && t2.porches[2].rail > 0.9 && t2.porches.filter((p) => p.rail > 0.05).length === 1, JSON.stringify(t2.porches.map((p) => p.rail)));
    // the map's porches (world.js PORCHES: lamp / railing light groups): no stand-in fronts, the levels in world.glowLevels
    const gl = await G(page, () => { const g = window.__game, w = g.world, P = g.porches; return { stand: P.stand, front: !!P.front, glow: !!P.glow, cols: P.colliders, lamps: P.spots.map((S) => +w.glowLevels[S.lamp].toFixed(3)), rails: P.spots.map((S) => +w.glowLevels[S.railing].toFixed(3)) }; });
    check(name, 'porch: the map\'s porches drive world.glowLevels (no stand-ins): the treated lamp dark, its railing lit, the rest lit / dark',
      !gl.stand && !gl.front && !gl.glow && gl.cols === 0 && gl.lamps[2] < 0.1 && gl.lamps.every((v, i) => i === 2 || v > 0.6) && gl.rails[2] > 0.8 && gl.rails.every((v, i) => i === 2 || v < 0.05), JSON.stringify(gl));
    // the dark mat: nothing
    await offMat(2); await sleep(200);
    const d0 = await ontoMat(2);
    await sleep(1300);
    const d1 = await G(page, () => ({ spills: window.__spills.length, st: window.__game.porches.st[2], door: window.__game.porches.door[2] }));
    check(name, 'porch: a dark mat pays nothing (no knock, no candy)', d0.st === 2 && d1.spills === d0.spills && d1.st === 2, JSON.stringify({ d0, d1 }));
    // a trick at P4: BOO on the lit mat; a resident drops from the chimney within a second
    await G(page, () => { const g = window.__game; g.ghosts.reset(); g.G.booT = 5; });
    await ontoMat(3, 0);
    await sleep(120);
    const booAt = Date.now();
    await pboo();
    const tricked = await waitFor(page, () => window.__game.porches.st[3] === 2, null, 1500);
    const tk = await G(page, () => ({ spills: window.__spills.slice(-1)[0], call: document.querySelector('.hw-call').textContent, cd: window.__game.porches.cd[3], tricks: window.__game.porches.tricks }));
    const resident = await waitFor(page, () => window.__game.ghosts.list.some((q) => q.state === 'chase'), null, 1600);
    const resMs = Date.now() - booAt;
    const rg = await G(page, () => { const q = window.__game.ghosts.list.find((o) => o.state === 'chase'), C = window.__game.porches.spots[3].chimney; return q ? { y: +q.y.toFixed(2), fromChimney: Math.hypot(q.x - C[0], q.z - C[2]) < 3, calm: q.calm } : null; });
    check(name, 'porch: BOO on a lit mat is a trick (14 candies, "TRICK! +14", dark for 60 s)', tricked && tk.spills === 14 && /^TRICK! \+14/.test(tk.call) && tk.cd > 59 && tk.cd <= 60 && tk.tricks === 1, JSON.stringify(tk));
    check(name, 'porch: the trick\'s resident ghost drops from the chimney and chases within a second', resident && resMs < 1700 && !!rg && rg.fromChimney && rg.calm <= 0, JSON.stringify({ resident, resMs, rg }));
    // the haunted porch (P6): stepping on is only a knock; a trick pays 22 and wakes two residents
    await G(page, () => { const g = window.__game; g.ghosts.reset(); g.G.booT = 5; });
    await ontoMat(5, 0);
    await sleep(1300);
    const h0 = await G(page, () => ({ spills: window.__spills.length, st: window.__game.porches.st[5], door: window.__game.porches.door[5], knocking: window.__game.porches.knocking }));
    await pboo();
    const hTricked = await waitFor(page, () => window.__game.porches.st[5] === 2, null, 1500);
    const hk = await G(page, () => ({ spills: window.__spills.slice(-1)[0], n: window.__spills.length, call: document.querySelector('.hw-call').textContent, cd: window.__game.porches.cd[5] }));
    const two = await waitFor(page, () => window.__game.ghosts.list.filter((q) => q.state === 'chase').length === 2, null, 1600);
    check(name, 'porch: the haunted porch only knocks (the door stays shut, no candy)', h0.st === 0 && h0.door === 0 && h0.knocking === 5, JSON.stringify(h0));
    check(name, 'porch: a trick at the haunted porch pays 22 with two residents chasing, dark for 70 s', hTricked && hk.spills === 22 && hk.n === h0.spills + 1 && /^TRICK! \+22/.test(hk.call) && hk.cd > 69 && hk.cd <= 70 && two, JSON.stringify({ ...hk, two }));
    await G(page, () => { const g = window.__game; g.G.safeT = 9; for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; } });
    // a relight: the lamp comes back up (fading over the last 3 s), a trail of 5 along the lane (the kid far away)
    const nearP3 = () => G(page, () => { const g = window.__game, P = g.porches, S = P.spots[2], C = g.candy; let n = 0; for (let i = 0; i < C.state.length; i++) if (C.state[i] === 1 && Math.hypot(C.p[i * 3] - S.mat.x, C.p[i * 3 + 2] - S.mat.z) <= 12.5) n++; return { st: P.st[2], lamp: +P.lampLv[2].toFixed(3), near: n }; });
    await G(page, () => { const g = window.__game; g.cc.teleport(0, g.world.heightAt(0, 6) + 0.05, 6); g.porches.cd[2] = 2.5; });
    const r0 = await nearP3();
    await sleep(1000);
    const rmid = (await nearP3()).lamp;
    await sleep(2000);
    const r1 = await nearP3();
    check(name, 'porch: a porch relights (the lamp fades back up over 3 s) and lays a trail of 5 along the lane', r0.st === 2 && r1.st === 0 && rmid > 0.25 && rmid < 0.8 && r1.lamp > 0.9 && r1.near >= r0.near + 5, JSON.stringify({ r0, rmid, r1 }));
    // the Full Round: P3, P4 visited; treat P1, P2, P5 -> +25 and "FULL ROUND!", once
    const f0 = (await state(page)).candy;
    for (const k of [0, 1, 4]) { await ontoMat(k); await waitFor(page, (k) => window.__game.porches.st[k] === 2, k, 2000); await sleep(400); }
    await sleep(600);
    const fr = await G(page, () => ({ full: window.__game.porches.fullPaid, lane: window.__game.porches.laneVisited, calls: window.__calls.filter((c) => c === 'FULL ROUND!').length, candy: window.__game.G.candy, rails: window.__game.porches.snapshot().porches.map((p) => p.rail > 0.9 ? 1 : 0).join('') }));
    await G(page, () => { window.__game.porches.cd[0] = 0.01; });
    await sleep(300);
    await ontoMat(0); await waitFor(page, () => window.__game.porches.st[0] === 2, null, 2000); await sleep(500);
    const fr2 = await G(page, () => window.__calls.filter((c) => c === 'FULL ROUND!').length);
    check(name, 'porch: treating all five lane porches pays the Full Round (+25, "FULL ROUND!") once; every railing lit', fr.full && fr.lane === 5 && fr.calls === 1 && fr.candy - f0 >= 30 && fr2 === 1 && fr.rails === '111111',
      JSON.stringify({ ...fr, gained: fr.candy - f0, again: fr2 }));
    // a resident from a wandering ghost (none dormant): the nearest one turns to chase where it is
    const wr = await G(page, () => {
      const g = window.__game, gh = g.ghosts, p = g.cc.position;
      while (gh.wake(p.x, p.z)) { /* every ghost up */ }
      gh.list.forEach((q, i) => { gh._teleport(q, p.x + 6 + i * 4, p.y + 1.6, p.z); q.state = 'wander'; q.calm = 0; q.alpha = 1; q.mesh.mesh.visible = true; });
      g.G.safeT = 0;
      const q = gh.summon(p.x, p.y + 6, p.z), near = gh.list[0];
      const out = { same: q === near, state: q && q.state, moved: q ? Math.abs(q.x - (p.x + 6)) < 0.5 : false };
      g.G.safeT = 9; for (const o of gh.list) { o.calm = 99; if (o.state === 'chase') o.state = 'wander'; }
      return out;
    });
    check(name, 'porch: with no dormant ghost the nearest wandering one is the resident (no teleport)', wr.same && wr.state === 'chase' && wr.moved, JSON.stringify(wr));
    // paced call-outs: one per 2.5 s, a duplicate dropped
    await sleep(2700);
    const pc = await G(page, () => new Promise((done) => {
      const h = window.__game.hud, d0 = h.dropped, seen = [];
      h.say('PACE A'); h.say('PACE B'); h.say('PACE A');
      const t0 = performance.now();
      const tick = () => {
        const t = (performance.now() - t0) / 1000, txt = document.querySelector('.hw-call').textContent;
        if (!seen.length || seen[seen.length - 1][1] !== txt) seen.push([+t.toFixed(2), txt]);
        if (t < 3.2) requestAnimationFrame(tick); else done({ seen, dropped: h.dropped - d0 });
      };
      requestAnimationFrame(tick);
    }));
    const bAt = (pc.seen.find((e) => e[1] === 'PACE B') || [99])[0];
    check(name, 'call-outs: hints are paced (one per 2.5 s), a duplicate is dropped', pc.seen[0][1] === 'PACE A' && bAt >= 2.4 && bAt < 3.1 && pc.dropped === 1 && pc.seen.filter((e) => e[1] === 'PACE A').length === 1, JSON.stringify(pc));
    // ---- grave hands and the candy thief (hands.js, thief.js). The hands: their lesson, a telegraph then a grab (held
    // 1.0 s, frozen, then let go with 3 spilled), a jump over them, BOO sending them down, a catch freeing a grabbed kid.
    // The thief: out at 1:00 ("A CANDY THIEF!", an edge marker), eating a planted cluster at 2 a second, never within
    // 6 m of a kid standing still, BOO glowing with it in reach, a BOO stunning it, a touch tagging it (its sack + 5), a
    // cornered touch snatching 5
    await G(page, () => {
      const g = window.__game;
      g.ghosts.reset(); g.G.wakeIdx = 99; g.G.popT = 99; g.G.streak = 0; g.hud.clearCalls();
      window.__hs = []; const sp = g.candy.spill.bind(g.candy);
      g.candy.spill = (x, y, z, n, sd, d, ttl) => { window.__hs.push([n, ttl, +x.toFixed(1), +z.toFixed(1)]); return sp(x, y, z, n, sd, d, ttl); };
    });
    const HK = 2; // the graveyard aisle spot (16, -26)
    /** Every hand under the soil, the kid at (dx, dz) from spot HK facing it, grounded, not safe. */
    const handStage = (dx, dz) => G(page, ([HK, dx, dz]) => {
      const g = window.__game, H = g.hands, x = H.x[HK] + dx, z = H.z[HK] + dz;
      if (H.holding >= 0) H.release();
      for (let k = 0; k < H.n; k++) { H.st[k] = 0; H.wait[k] = 99; }
      g.G.safeT = 0; H.grace = 0; g.G.booT = 5;
      for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; }
      g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); g.cc.velocity.set(0, 0, 0);
      const yaw = Math.abs(dx) + Math.abs(dz) > 1 ? Math.atan2(dx, dz) : 0;
      g.rig.yaw = yaw; g.camState.facing = yaw; g.player.rotation.y = yaw; g.rig.snap();
    }, [HK, dx, dz]);
    await handStage(0, 5);
    await G(page, (HK) => { const H = window.__game.hands; H.st[HK] = 1; H.t[HK] = 0; }, HK);
    const hLesson = await waitFor(page, () => /JUMP THE HANDS/.test(document.querySelector('.hw-call').textContent), null, 3200);
    check(name, 'hands: the first telegraph in view within 8 m says "JUMP THE HANDS!" (once per device)', hLesson && await G(page, () => window.__game.taught.has('hands')));
    await handStage(0.4, 0);
    await G(page, () => { const g = window.__game; g.G.candy = 40; g.hud.setCandy(40); window.__hs.length = 0; window.__calls.length = 0; g.hud.clearCalls(); });
    const hg = await G(page, (HK) => new Promise((done) => {
      const g = window.__game, H = g.hands, p = g.cc.position, out = { up: -1, grab: -1, rel: -1, frozen: true, hold: false, moved: 0 };
      let x0 = 0, z0 = 0;
      H.st[HK] = 1; H.t[HK] = 0;
      const t0 = g.G.time, r0 = performance.now(); // game time (a loaded machine runs the game slower than real time)
      const tick = () => {
        const t = g.G.time - t0;
        if (out.up < 0 && H.st[HK] === 2) out.up = +t.toFixed(2);
        if (out.grab < 0 && H.holding === HK) { out.grab = +t.toFixed(2); x0 = p.x; z0 = p.z; g.cc.velocity.set(4, 0, 0); } // a shove: it stays put
        if (out.grab >= 0 && out.rel < 0) { if (g.cc.hold) out.hold = true; out.moved = Math.max(out.moved, Math.hypot(p.x - x0, p.z - z0)); }
        if (out.grab >= 0 && out.rel < 0 && H.holding < 0) { out.rel = +t.toFixed(2); out.candy = g.G.candy; out.st = H.st[HK]; }
        if (t < 2.6 && performance.now() - r0 < 12000) requestAnimationFrame(tick); else { out.holdAfter = g.cc.hold; out.spills = window.__hs.slice(); out.calls = window.__calls.slice(); done(out); }
      };
      requestAnimationFrame(tick);
    }), HK);
    check(name, 'hands: a telegraph of 0.8 s, then they rise and grab a grounded kid in reach ("GRABBED!")', hg.up > 0.65 && hg.up < 0.98 && hg.grab >= hg.up && hg.grab - hg.up < 0.1 && hg.calls.includes('GRABBED!'), JSON.stringify(hg));
    check(name, 'hands: the grab holds the kid 1.0 s (frozen: a shove does not move it), then lets go: −3 spilled round it, the hands sink',
      hg.hold && hg.moved < 0.05 && hg.rel - hg.grab > 0.85 && hg.rel - hg.grab < 1.15 && hg.candy === 37 && hg.spills.some((q) => q[0] === 3 && q[1] === 10) && hg.st === 3 && !hg.holdAfter, JSON.stringify(hg));
    // a jump over standing hands: launched (the kid's own jump: 4.5 m/s up from 0.6 m, 6.5 m/s on) from 2.6 m before them
    await handStage(0, 2.6);
    const hj = await G(page, (HK) => new Promise((done) => {
      const g = window.__game, H = g.hands, p = g.cc.position, gr0 = H.stats.grabs;
      H.st[HK] = 2; H.t[HK] = 0.3; H.grace = 0;
      g.cc.teleport(p.x, p.y + 0.6, p.z); g.cc.velocity.set(0, 4.5, -6.5);
      let minFeet = 99, inside = 0; const t0 = performance.now();
      const tick = () => {
        H.t[HK] = Math.min(H.t[HK], 1); // they keep standing
        if (Math.hypot(p.x - H.x[HK], p.z - H.z[HK]) < 0.9) { inside++; minFeet = Math.min(minFeet, p.y - H.gy[HK]); }
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else done({ grabbed: H.stats.grabs - gr0, inside, minFeet: +minFeet.toFixed(2), past: +(H.z[HK] - p.z).toFixed(1) });
      };
      requestAnimationFrame(tick);
    }), HK);
    check(name, 'hands: a kid jumping over standing hands (feet above 0.6 m over them) is not grabbed', hj.grabbed === 0 && hj.inside > 0 && hj.minFeet > 0.6 && hj.past > 2, JSON.stringify(hj));
    // BOO within 4 m: they go back down (the ones 6 m off stay)
    await handStage(0, 3);
    await G(page, (HK) => { const H = window.__game.hands; H.st[HK] = 2; H.t[HK] = 0.3; H.st[HK + 1] = 2; H.t[HK + 1] = 0.3; }, HK);
    await sleep(100);
    await pboo();
    const hRet = await waitFor(page, (HK) => window.__game.hands.st[HK] === 3, HK, 800);
    check(name, 'hands: BOO within 4 m sends them back down (the ones 9 m off stay up)', hRet && (await G(page, (HK) => window.__game.hands.st[HK + 1], HK)) === 2);
    // a ghost's catch frees a grabbed kid at once (and knocks it away)
    await handStage(0.3, 0);
    await G(page, (HK) => { const H = window.__game.hands; H.st[HK] = 2; H.t[HK] = 0.3; }, HK);
    const hHeld = await waitFor(page, () => window.__game.hands.holding >= 0, null, 800);
    const hFree = await G(page, () => new Promise((done) => {
      const g = window.__game, gh = g.ghosts, p = g.cc.position, q = window.__catcher, c0 = g.G.caught, x0 = p.x, z0 = p.z, t0 = performance.now();
      gh._teleport(q, p.x + 0.3, p.y + 1.6, p.z + 0.3); q.state = 'chase'; q.t = 0; q.calm = 0; q.tame = 0; q.alpha = 1; q.mesh.mesh.visible = true;
      const tick = () => {
        if (g.G.caught > c0 && g.hands.holding < 0) { setTimeout(() => done({ ms: Math.round(performance.now() - t0), hold: g.cc.hold, moved: +Math.hypot(p.x - x0, p.z - z0).toFixed(2) }), 250); return; }
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else done({ ms: -1 });
      };
      requestAnimationFrame(tick);
    }));
    check(name, 'hands: a ghost catching a grabbed kid frees it at once (knocked away)', hHeld && hFree.ms >= 0 && hFree.ms < 400 && !hFree.hold && hFree.moved > 0.5, JSON.stringify(hFree));
    await G(page, () => { const g = window.__game; g.G.safeT = 9; for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; } const H = g.hands; for (let k = 0; k < H.n; k++) { H.st[k] = 0; H.wait[k] = 99; } });
    // the thief: out at 1:00, a call-out, an edge marker toward it while it is off screen
    await home();
    await G(page, () => { const g = window.__game; g.hud.clearCalls(); g.G.thiefSaid = false; g.thief.reset(); g.G.thiefAt = 0; });
    const tOut = await waitFor(page, () => window.__game.thief.out && /A CANDY THIEF/.test(document.querySelector('.hw-call').textContent), null, 3200);
    await sleep(200);
    const tEdge = await G(page, () => { const e = document.querySelector('.hw-edge.thief'); return { on: e.classList.contains('on'), text: e.querySelector('b').textContent, st: window.__game.thief.stateName }; });
    check(name, 'thief: out of its den at 1:00 with "A CANDY THIEF!" and an edge marker toward it (off screen, its distance)', tOut && tEdge.on && /^\d+ m$/.test(tEdge.text), JSON.stringify(tEdge));
    // eating: a cluster planted 10 m ahead, the thief on it: 4 in 2 s, the sack swells
    const tAte = await G(page, () => new Promise((done) => {
      const g = window.__game, T = g.thief, C = g.candy, p = g.cc.position, cx = p.x, cz = p.z - 10;
      for (let i = 0; i < C.state.length; i++) if (C.state[i] && Math.hypot(C.p[i * 3] - cx, C.p[i * 3 + 2] - cz) < 7) C.state[i] = 0;
      for (let i = 0; i < 6; i++) C.place(cx + Math.cos(i * 2.4) * 0.3, g.world.heightAt(cx, cz), cz + Math.sin(i * 2.4) * 0.3, 0);
      T.x = cx; T.z = cz; T.sack = 0; T.eaten = 0; T._set(3); T.eatT = 0;
      const s0 = T.bones.sack.scale.x, t0 = g.G.time, r0 = performance.now();
      const tick = () => {
        if (g.G.time - t0 < 2.15 && performance.now() - r0 < 12000) { requestAnimationFrame(tick); return; }
        let left = 0; for (let i = 0; i < C.state.length; i++) if (C.state[i] === 1 && Math.hypot(C.p[i * 3] - cx, C.p[i * 3 + 2] - cz) < 1) left++;
        done({ eaten: T.eaten, sack: T.sack, left, s0: +s0.toFixed(2), s1: +T.bones.sack.scale.x.toFixed(2), s: +(g.G.time - t0).toFixed(2) });
      };
      requestAnimationFrame(tick);
    }));
    check(name, 'thief: eats a cluster at 2 a second (4 of 6 in 2 s), its sack swelling', tAte.eaten >= 3 && tAte.eaten <= 5 && tAte.sack === tAte.eaten && tAte.left === 6 - tAte.eaten && tAte.s1 > tAte.s0, JSON.stringify(tAte));
    // wary: clusters 8.5 m round a kid who stands still; it never steps within 6 m
    const tKeep = await G(page, () => new Promise((done) => {
      const g = window.__game, T = g.thief, C = g.candy, p = g.cc.position;
      for (const [dx, dz] of [[8.5, 0], [-8.5, 0], [0, 8.5], [6, -6]]) for (let i = 0; i < 4; i++) C.place(p.x + dx + Math.cos(i) * 0.4, p.y, p.z + dz + Math.sin(i) * 0.4, 0);
      T.x = p.x + 12; T.z = p.z + 3; T.sack = 0; T._set(2); T.retarget = 0; T.minKid = Infinity;
      setTimeout(() => done({ min: +T.minKid.toFixed(2), eaten: T.eaten }), 4000);
    }));
    check(name, 'thief: never steps within 6 m of a kid who stands still (4 s round clusters 8.5 m off)', tKeep.min >= 5.95 && tKeep.min < 12, JSON.stringify(tKeep));
    // BOO: it glows with the thief in reach; a BOO stuns it (stars) 1.8 s; a touch then tags it: its sack + 5 spill
    await home();
    await G(page, () => { const g = window.__game, T = g.thief, p = g.cc.position; T.x = p.x + 0.4; T.z = p.z - 6.5; T.sack = 7; T._set(2); T.tx = T.x; T.tz = T.z; T.target = -1; T.retarget = 9; g.G.booT = 5; g.G.safeT = 0; g.hud.clearCalls(); window.__hs.length = 0; window.__calls.length = 0; });
    await sleep(250);
    const tHot = await G(page, () => document.querySelector('.hw-boo').classList.contains('hot') && (!document.querySelector('.hw-boo-btn') || document.querySelector('.hw-boo-btn').classList.contains('hw-boo-hot')));
    await pboo();
    const tStun = await waitFor(page, () => window.__game.thief.stateName === 'stun', null, 800);
    const tSt = await G(page, () => ({ stunT: +window.__game.thief.stunT.toFixed(2), d: +Math.hypot(window.__game.thief.x - window.__game.cc.position.x, window.__game.thief.z - window.__game.cc.position.z).toFixed(1) }));
    check(name, 'thief: BOO glows with it in reach; a BOO within 7.5 m stuns it (1.8 s)', tHot && tStun && tSt.stunT > 1.4 && tSt.stunT <= 1.8, JSON.stringify({ tHot, ...tSt }));
    await G(page, () => { const g = window.__game, T = g.thief, x = T.x, z = T.z + 0.6; g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); });
    const tTag = await waitFor(page, () => window.__game.thief.tags > 0, null, 800);
    await sleep(150);
    const tg = await G(page, () => ({ spills: window.__hs.slice(), calls: window.__calls.slice(), st: window.__game.thief.stateName, sack: window.__game.thief.sack }));
    check(name, 'thief: a touch while it is stunned TAGS it ("TAGGED! +12": its sack of 7 + 5 spill out) and it runs home', tTag && tg.spills.some((q) => q[0] === 12) && tg.calls.includes('TAGGED! +12') && tg.st === 'home' && tg.sack === 0, JSON.stringify(tg));
    // a cornered thief's touch snatches 5
    await G(page, () => {
      const g = window.__game, T = g.thief, p = g.cc.position, C = g.candy; // (no candy in reach: the tag's spill would add to the count)
      for (let i = 0; i < C.state.length; i++) if (C.state[i] && Math.hypot(C.p[i * 3] - p.x, C.p[i * 3 + 2] - p.z) < 12) C.state[i] = 0;
      g.G.candy = 30; g.hud.setCandy(30); g.G.safeT = 0; g.G.streak = 0; T.x = p.x + 0.4; T.z = p.z; T.sack = 0; T._set(2); window.__calls.length = 0; g.hud.clearCalls();
    });
    const tSn = await waitFor(page, () => window.__game.thief.steals > 0, null, 800);
    await sleep(100);
    const sn = await G(page, () => ({ candy: window.__game.G.candy, sack: window.__game.thief.sack, st: window.__game.thief.stateName, calls: window.__calls.slice() }));
    check(name, 'thief: cornered, its touch snatches 5 ("SNATCHED! −5") into its sack and it bolts', tSn && sn.candy === 25 && sn.sack === 5 && sn.st === 'bolt' && sn.calls.includes('SNATCHED! −5'), JSON.stringify(sn));
    const toDen = () => G(page, () => { const g = window.__game, T = g.thief; T._set(7); T.homeT = 1e9; T.root.visible = false; }); // in its den (its tags kept)
    await toDen(); await G(page, () => { window.__game.G.safeT = 3; });
    await G(page, () => { const g = window.__game; g.G.candy = 100; g.hud.setCandy(100); });
    // ---- the Witching Hour (the last 30 s): call-out, x2 badge, every lantern and porch relit, candy x2, rain, a catch costs <= 6
    await G(page, () => {
      const g = window.__game, L = g.lanterns;
      g.G.safeT = 3; for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; }
      for (let i = 0; i < L.n; i++) if (L.alive[i]) { L.smash(i, 1, 0, 1); break; }
      const C = g.candy, p = g.cc.position; // no spilled candy in reach (a streak call-out would cover the finale's)
      for (let i = 0; i < C.state.length; i++) if (C.state[i] && Math.hypot(C.p[i * 3] - p.x, C.p[i * 3 + 2] - p.z) < 8) C.state[i] = 0;
      g.G.streak = 0;
      window.__deadBefore = L.n - L.alive.reduce((a, v) => a + v, 0);
      window.__darkPorches = [...g.porches.st].filter((v) => v === 2).length;
      g.setTimeLeft(30.4);
    });
    await sleep(700);
    const wh = await G(page, () => { const g = window.__game, L = g.lanterns; return { on: g.G.witching, call: document.querySelector('.hw-call').textContent, badge: +getComputedStyle(document.querySelector('.hw-x2')).opacity, pill: document.querySelector('.hw-candy').classList.contains('wh'), dead: L.n - L.alive.reduce((a, v) => a + v, 0), before: window.__deadBefore, auras: g.ghosts.witch, rain: g.G.rainLeft, darkPorches: window.__darkPorches, porchesLit: [...g.porches.st].every((v) => v !== 2), lamps: Math.min(...g.porches.lampLv).toFixed(2) }; });
    check(name, 'Witching Hour: call-out, x2 badge on the pill, every lantern relit, orange auras', wh.on && /WITCHING HOUR/.test(wh.call) && wh.pill && wh.badge > 0.9 && wh.before >= 1 && wh.dead === 0 && wh.auras, JSON.stringify(wh));
    check(name, 'Witching Hour: every dark porch relights at once', wh.darkPorches >= 1 && wh.porchesLit && +wh.lamps > 0.75, JSON.stringify({ dark: wh.darkPorches, lit: wh.porchesLit, lamps: wh.lamps }));
    const whT = await G(page, () => ({ out: window.__game.thief.out, sack: window.__game.thief.sack, handsWitch: window.__game.hands.witch }));
    check(name, 'Witching Hour: the thief is back at once with a 10-candy sack; the hands cycle twice as fast', whT.out && whT.sack >= 10 && whT.handsWitch, JSON.stringify(whT));
    await toDen(); // (out of the way of the finale's catch check)
    const x2 = await pick((g) => { g.G.candy = 50; g.G.streak = 0; });
    check(name, 'Witching Hour: a candy counts 2', x2.candy === 52, `candy 50 -> ${x2.candy}`);
    await sleep(1500);
    const rain = await G(page, () => { const g = window.__game, C = g.candy; let n = 0; for (let i = 0; i < C.state.length; i++) if (C.state[i] === 2 && C.ttl[i] === 60) n++; return { left: g.G.rainLeft, falling: n }; });
    check(name, 'Witching Hour: candy rains in around the kid', rain.left <= 17 && rain.falling >= 2, JSON.stringify(rain));
    await G(page, () => {
      const g = window.__game, gh = g.ghosts, p = g.cc.position, q = window.__catcher;
      g.G.safeT = 0; g.G.candy = 100; g.hud.setCandy(100); window.__minus.length = 0;
      gh._teleport(q, p.x + 0.3, p.y + 1.6, p.z + 0.3); q.state = 'chase'; q.t = 0; q.calm = 0; q.tame = 0; q.alpha = 1; q.mesh.mesh.visible = true;
    });
    const whc = await waitFor(page, () => window.__minus.length > 0, null, 2000) && await G(page, () => window.__minus.join(' '));
    check(name, 'Witching Hour: a catch at 100 candy costs 6 (not 10)', whc === '−6', String(whc));
    await G(page, () => { const g = window.__game; g.G.safeT = 3; for (const q of g.ghosts.list) { q.calm = 99; if (q.state === 'chase') q.state = 'wander'; } });
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
    // ---- the night escalates with the clock (the finale held off: the clock alone): 11:57 vs 10 s to midnight; the
    // Witching Hour's hook drives it to its peak even at 11:57; then lightning (soft) and the motion probe
    await G(page, () => window.__game.env.setFinale(false));
    const early = await envAt(page, 176, 7000), late = await envAt(page, 10); // (7 s: the finale before this eases out)
    check(name, 'environment escalates with the clock (storm, cloud cover, ground mist, leaves, blood moon)',
      early.storm < 0.2 && late.storm > 0.8 && late.cover > early.cover + 0.15 && Math.abs(late.skyCover - late.cover) < 1e-3
      && late.mist > early.mist * 1.5 && Math.abs(late.fogMist - late.mist) < 1e-3 && late.leavesActive > early.leavesActive + 0.3 && early.blood < 0.05 && late.blood > 0.5,
      `storm ${early.storm} -> ${late.storm}, cover ${early.cover} -> ${late.cover}, mist ${early.mist} -> ${late.mist}, leaves ${early.leavesActive} -> ${late.leavesActive}, blood ${early.blood} -> ${late.blood}`);
    await G(page, () => window.__game.env.setFinale(true));
    const fin = await envAt(page, 176, 6000);
    await G(page, () => window.__game.env.setFinale(false));
    check(name, 'the Witching Hour hook (env.setFinale) drives the night to its peak (storm, blood moon) at any clock', fin.storm > 0.8 && fin.finale > 0.9 && fin.blood > 0.9, JSON.stringify({ storm: fin.storm, finale: fin.finale, blood: fin.blood }));
    const mo = envNormal[name] = await envMotion(page);
    check(name, 'lightning: a flash that stays soft (peak under 1.1, gone within 1.5 s), the house windows stutter', mo.flashMax > 0.75 && mo.flashMax < 1.1 && mo.flash01 > 0.2 && mo.flashEnd < 0.05 && mo.windowMin < 0.5, JSON.stringify(mo));
    await G(page, () => { const g = window.__game; g.env.setFinale(g.G.witching); });
    // ---- the last ten seconds count down just under the clock pill (not over the action at the centre)
    await G(page, () => window.__game.setTimeLeft(8.95));
    await sleep(450);
    const cd = await G(page, () => { const c = document.querySelector('.hw-count'), k = document.querySelector('.hw-clock'), a = c.getBoundingClientRect(), b = k.getBoundingClientRect(); return { text: c.textContent, top: Math.round(a.top), bottom: Math.round(a.bottom), cx: Math.round(a.left + a.width / 2), clockBottom: Math.round(b.bottom), clockCx: Math.round(b.left + b.width / 2), counting: document.querySelector('.hw-hud').classList.contains('counting'), h: innerHeight }; });
    check(name, 'countdown under the clock pill', cd.text === '9' && cd.top >= cd.clockBottom - 4 && Math.abs(cd.cx - cd.clockCx) < 3 && cd.bottom < cd.h * 0.45 && cd.counting, JSON.stringify(cd));
    // ---- midnight: the round ends, results, best saved, play again
    // a grab held past midnight (its timer stopped here on purpose) ends with the round
    await G(page, (HK) => { const g = window.__game, H = g.hands, x = H.x[HK], z = H.z[HK]; g.G.safeT = 0; H.grace = 0; g.cc.teleport(x, g.world.heightAt(x, z) + 0.05, z); H.st[HK] = 2; H.t[HK] = 0.2; }, HK);
    const midHeld = await waitFor(page, () => window.__game.hands.holding >= 0, null, 800);
    await G(page, () => { const g = window.__game; g.hands.holdT = 99; g.setTimeLeft(1.2); });
    check(name, 'the clock strikes midnight (ending)', await waitFor(page, () => window.__game.G.state === 'ending', null, 4000));
    await sleep(100);
    check(name, 'hands: a grab still on at midnight lets go with the round (the kid never stays held)', midHeld && await G(page, () => window.__game.hands.holding < 0 && !window.__game.cc.hold));
    check(name, 'results screen', await waitFor(page, () => window.__game.G.state === 'over' && !!document.querySelector('.hw-screen:not(.off) .hw-score'), null, 6000));
    await sleep(1800);
    s = await state(page);
    check(name, 'best score kept (localStorage)', s.best >= s.candy && (await G(page, () => { try { return +localStorage.getItem('midnight-candy-run.best'); } catch { return -1; } })) === s.best, `best ${s.best}`);
    await page.screenshot({ path: path.join(OUT, `${name}-end.png`), scale: 'css' });
    const lad = await G(page, () => ({ seg: document.querySelectorAll('.hw-screen:not(.off) .hw-ladder i').length, h: document.querySelector('.hw-ladder').getBoundingClientRect().height, next: document.querySelector('.hw-next').textContent, rank: document.querySelector('.hw-rank').textContent, candy: window.__game.G.candy, top: window.__game.RANKS[window.__game.RANKS.length - 1] }));
    const nextOk = lad.candy >= lad.top[0] ? lad.next === '' : /^\d+ MORE FOR [A-Z' -]+$/.test(lad.next);
    check(name, 'results: the rank ladder and what the next rank takes', lad.seg === 6 && lad.h >= 6 && nextOk && lad.rank.length > 0, JSON.stringify(lad));
    const rs = await G(page, () => ({ stats: [...document.querySelectorAll('.hw-screen:not(.off) .hw-stats div')].map((e) => [e.querySelector('b').textContent, e.querySelector('span').textContent]), lane: window.__game.porches.laneVisited, tricks: window.__game.porches.tricks, tags: window.__game.thief.tags, R: window.__game.RANKS.map((r) => r[0]).join('/') }));
    const stat = (l) => (rs.stats.find((e) => e[1] === l) || [null])[0];
    check(name, 'results: porches n/5, tricks, tags, BOOs, catches and best streak; ranks v2', rs.stats.length === 6 && stat('PORCHES') === `${rs.lane}/5` && stat('TRICKS') === String(rs.tricks) && rs.lane === 5 && rs.tricks === 2 && stat('TAGS') === String(rs.tags) && rs.tags === 1 && stat('BOOS') !== null && stat('CAUGHT') !== null && stat('BEST STREAK') !== null && rs.R === RANKS_V2, JSON.stringify(rs));
    const shb = await rect(page, '.hw-screen:not(.off) [data-a=share]');
    if (phone) await T.tap(shb.cx, shb.cy); else await page.mouse.click(shb.cx, shb.cy);
    await sleep(300);
    const sh = await G(page, () => ({ shared: window.__shared, copied: window.__copied, toast: document.querySelector('.hw-toast').textContent, candy: window.__game.G.candy, rank: document.querySelector('.hw-rank').textContent }));
    const shText = phone ? (sh.shared[0] ? `${sh.shared[0].text} ${sh.shared[0].url}` : '') : (sh.copied[0] || '');
    check(name, `share: ${phone ? 'Web Share' : 'copied to the clipboard + a toast'} with the score, the rank and the game URL`, shText.includes(`${sh.candy} candy`) && shText.includes(sh.rank) && /https?:\/\/\S+\/halloween\/$/.test(shText) && (phone ? sh.shared.length === 1 && sh.copied.length === 0 : sh.copied.length === 1 && sh.toast === 'SCORE COPIED!'), JSON.stringify(sh));
    const again = await rect(page, '.hw-screen:not(.off) [data-a=again]');
    check(name, 'PLAY AGAIN inside the viewport', inside(again, vp));
    const rbs = await buttons(page, '.hw-screen:not(.off) button');
    check(name, 'results buttons >= 44 x 44 px, inside the safe area', rbs.length >= 2 && rbs.every((b) => b.w >= 44 && b.h >= 44 && inSafe(b)));
    if (phone) await T.tap(again.cx, again.cy); else await page.mouse.click(again.cx, again.cy);
    check(name, 'PLAY AGAIN restarts (candy 0, clock full; BOO learnt: no lesson ghost)', await waitFor(page, () => window.__game.G.state === 'play' && window.__game.G.candy === 0 && window.__game.G.left > 170 && !window.__game.G.tutor, null, 3000));
    // ---- the best run's pace (kept with the best) shows in the clock line at 20 s of the next round
    const pk = await G(page, () => { let a = null; try { a = JSON.parse(localStorage.getItem('midnight-candy-run.pace')); } catch { /* */ } return { a, best: window.__game.G.best }; });
    await G(page, () => { const g = window.__game; g.G.safeT = 3; g.setTimeLeft(180 - 20.2); });
    const pacing = await waitFor(page, () => document.querySelector('.hw-clock').classList.contains('pacing'), null, 1500);
    const paceText = await G(page, () => document.querySelector('.hw-clock .pace').textContent);
    check(name, 'pace: the best run is kept (18 moments) and the next round compares at 20 s ("−N VS BEST")', Array.isArray(pk.a) && pk.a.length === 18 && pk.a[17] === pk.best && pacing && /^[+−]\d+ VS BEST$/.test(paceText), JSON.stringify({ n: pk.a && pk.a.length, last: pk.a && pk.a[17], best: pk.best, paceText }));
    const nb = await pick((g) => { g.G.candy = g.G.best; g.G.streak = 0; });
    check(name, 'passing the best mid-round calls out "NEW BEST!" (once)', nb.candy === pk.best + 1 && /^NEW BEST!/.test(nb.call), JSON.stringify({ candy: nb.candy, call: nb.call }));
    if (name === 'iphone-portrait' || args.rounds) {
      // ---- five rounds back to back (lanterns smashed, every ghost up, candy spilled, then midnight, PLAY AGAIN):
      // geometries, textures, programs, physics bodies, scene objects, DOM nodes and listeners stay flat
      const seen = [], calm = [];
      for (let r = 0; r < 5; r++) {
        await G(page, () => {
          const g = window.__game, p = g.cc.position;
          for (let i = 0, n = 0; i < g.lanterns.n && n < 4; i++) if (g.lanterns.alive[i]) { g.lanterns.smash(i, 1, 0, 1.5); n++; }
          while (g.ghosts.wake(p.x, p.z)) { /* every ghost up */ }
          g.candy.spill(p.x + 3, p.y + 1, p.z, 30, 3);
          const H = g.hands; g.G.handsAt = 0; g.G.thiefAt = 0; for (let k = 0; k < 4; k++) { H.st[k] = k % 2 ? 2 : 1; H.t[k] = 0; } // the hands out, the thief too
          const T = g.thief; T.awake = true; T._emerge(); T.x = p.x + 7; T.z = p.z; T.sack = 9; T._set(2); T.boo(p.x, p.z, 7.5);
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
        calm.push(await G(page, () => window.__game.env.stats()));
      }
      const keys = Object.keys(seen[0]);
      const grew = keys.filter((k) => seen[4][k] > seen[1][k] + (k === 'dom' ? 2 : 0));
      check(name, '5 rounds back to back: resources and listeners flat', grew.length === 0, (grew.length ? grew : keys).map((k) => `${k} ${seen.map((c) => c[k]).join('>')}`).join(', '));
      check(name, '5 rounds: every round starts calm (no storm, flash, blood moon or crows in flight), pools and sounds bounded',
        calm.every((e) => e.storm < 0.15 && e.flash < 0.01 && e.blood === 0 && e.crowsAway === 0 && e.kicked <= 20 && e.puffs <= 20 && e.sounds < 40),
        calm.map((e) => `${e.storm}/${e.flash}/${e.blood}/${e.crowsAway}/${e.kicked}/${e.puffs}/${e.sounds}`).join(' '));
    }
    if (args.perf) {
      // ---- stress under 4x CPU throttling: every ghost chasing close by, 8 lanterns breaking at once, 80 candy flying
      const c2 = cdp || await ctx.newCDPSession(page);
      await c2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await sleep(1500);
      let maxCalls = 0;
      const sample = (ms) => G(page, (dur) => new Promise((done) => {
        const g = window.__game, out = [], t0 = performance.now();
        let calls = 0;
        const tick = () => { out.push(g.engine.profiler.frame.ms); calls = Math.max(calls, g.engine.profiler.frame.calls); if (performance.now() - t0 < dur) requestAnimationFrame(tick); else done({ out, calls }); };
        requestAnimationFrame(tick);
      }), ms).then((r) => { maxCalls = Math.max(maxCalls, r.calls); return r.out; });
      const calm = await sample(2000);
      const storm = sample(3000);
      await G(page, () => {
        const g = window.__game, p = g.cc.position;
        g.G.safeT = 99;
        while (g.ghosts.wake(p.x, p.z)) { /* every ghost up */ }
        for (const q of g.ghosts.list) { g.ghosts._teleport(q, p.x + (Math.random() - 0.5) * 8, p.y + 1.6, p.z + (Math.random() - 0.5) * 8); q.state = 'chase'; q.alpha = 1; }
        for (let i = 0, n = 0; i < g.lanterns.n && n < 8; i++) if (g.lanterns.alive[i]) { g.lanterns.smash(i, 1, 0, 1.5); n++; }
        g.candy.spill(p.x, p.y + 1, p.z, 80, 4);
        // every porch tricked at once: six showers (92 candies), seven residents, six doors flung open
        const P = g.porches; P.st.fill(0); P.cd.fill(0);
        for (let k = 0; k < P.n; k++) { const S = P.spots[k]; P.boo(S.mat.x, S.mat.y, S.mat.z); }
        // the hands: four up (the most the game allows), the thief bolting past with a full sack
        const H = g.hands; for (let k = 0; k < 4; k++) { H.st[k] = 2; H.t[k] = 0; H.wait[k] = 99; }
        const T = g.thief; T.awake = true; T._emerge(); T.x = p.x + 5; T.z = p.z - 3; T.sack = 18; T._set(4); T.boltT = 99;
      });
      const hot = await storm;
      await c2.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const q = (a, f) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; };
      const msg = `CPU ms per frame at 4x: calm p50 ${q(calm, 0.5).toFixed(1)} p95 ${q(calm, 0.95).toFixed(1)}; storm p50 ${q(hot, 0.5).toFixed(1)} p95 ${q(hot, 0.95).toFixed(1)} max ${Math.max(...hot).toFixed(1)}`;
      check(name, 'perf: 4x throttled storm stays under 16 ms CPU at p95', q(hot, 0.95) < 16, msg);
      check(name, 'perf (map v2 budget): 4x throttled storm p95 <= 9.5 ms CPU', q(hot, 0.95) <= 9.5, msg);
      // the finale on top: the Witching Hour (candy rain, every lantern relit, orange auras), a storm again
      await c2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await G(page, () => { const g = window.__game; g.setTimeLeft(30.4); });
      await sleep(1000);
      const fin = sample(3000);
      await G(page, () => {
        const g = window.__game, p = g.cc.position;
        g.G.safeT = 99;
        for (const q of g.ghosts.list) { g.ghosts._teleport(q, p.x + (Math.random() - 0.5) * 8, p.y + 1.6, p.z + (Math.random() - 0.5) * 8); q.state = 'chase'; q.alpha = 1; }
        for (let i = 0, n = 0; i < g.lanterns.n && n < 8; i++) if (g.lanterns.alive[i]) { g.lanterns.smash(i, 1, 0, 1.5); n++; }
        g.candy.spill(p.x, p.y + 1, p.z, 80, 4);
        const H = g.hands; for (let k = 4; k < 8; k++) { H.st[k] = 2; H.t[k] = 0; H.wait[k] = 99; }
        const T = g.thief; T.x = p.x - 5; T.z = p.z - 3; T._set(4); T.boltT = 99;
      });
      const fh = await fin;
      await c2.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const fmsg = `finale storm at 4x: p50 ${q(fh, 0.5).toFixed(1)} p95 ${q(fh, 0.95).toFixed(1)} max ${Math.max(...fh).toFixed(1)} (witching ${await G(page, () => window.__game.G.witching)})`;
      check(name, 'perf: 4x throttled finale storm (Witching Hour) under 16 ms CPU at p95', q(fh, 0.95) < 16, fmsg);
      check(name, 'perf (map v2 budget): at most 166 draw calls a frame through both storms', maxCalls <= 166, `max ${maxCalls} calls`);
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

/** prefers-reduced-motion: reduce: the environment probe on a second page against the normal one (same profile). */
async function runReduced(name) {
  const ctx = await browser.newContext({ ...PROFILES[name], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = watchErrors(page), tag = `${name}-rm`;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    check(tag, 'loads', await waitFor(page, () => !!(window.__game && document.querySelector('.ui-loading') === null), null, 90000));
    await G(page, () => window.__game.startRound());
    await sleep(500);
    const rm = await envMotion(page), mo = envNormal[name];
    check(tag, 'reduced motion is honoured (prefers-reduced-motion)', await G(page, () => window.__game.env.reduced === true));
    check(tag, 'reduced motion: a slow, dim flash and no window blinking', rm.flashMax < 0.4 && rm.flash01 < 0.15 && rm.flashEnd < 0.2 && rm.windowMin > 0.9, JSON.stringify(rm));
    check(tag, 'reduced motion: slower leaves and clouds, less sway than the normal page', !!mo && rm.drift < 0.6 * mo.drift && rm.clouds < 0.6 * mo.clouds && rm.sway < 0.6 * mo.sway,
      mo ? `drift ${mo.drift.toFixed(2)} -> ${rm.drift.toFixed(2)}, clouds ${mo.clouds.toFixed(1)} -> ${rm.clouds.toFixed(1)}, sway ${mo.sway.toFixed(3)} -> ${rm.sway.toFixed(3)}` : 'no normal probe');
  } catch (e) {
    check(tag, 'run', false, e.message.split('\n')[0]);
  }
  check(tag, 'no console errors', errors.length === 0, errors.slice(0, 3).join(' || '));
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
  for (const name of only) {
    if (name === 'hybrid') await runHybrid(name); else if (PROFILES[name]) await runProfile(name); else console.log(`unknown profile ${name}`);
    if (name === 'pixel-portrait') await runReduced(name);
  }
} catch (e) {
  console.error(e); failures++;
} finally {
  await cleanup();
}
console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll Halloween browser checks passed.');
console.log(`screenshots: ${path.relative(repoRoot, OUT)}/`);
process.exit(failures ? 1 : 0);
