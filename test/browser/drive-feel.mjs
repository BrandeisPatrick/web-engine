// Drive feel in the browser: TyreFx (skid marks and smoke from wheels[i].slideHeat) and the SteeringAssist on the
// starter-drive page in headless Chrome with real WebGL. The starter is not edited: its own game system is switched off
// and a scripted one drives its car (VehicleController(ROAD_CAR_SPEC)) and draws its body, importing the engine's
// render / input / core layers through /@fs the way test/browser/howto.mjs imports the recipes.
//   1. a handbrake slide at 22 m/s (A + X for 0.45 s; then the assist, with nothing held, catches it), then a stop:
//      marks laid and smoke spawned while sliding, the road darker where the wheels slid (marks shown vs hidden at the
//      marks' screen points) and unchanged on clean road beside them, the car still on the road;
//   2. clean 0.7 g corners at 18 m/s further down the road (a 4 s weave of left and right bends that stays on the
//      asphalt): no new marks, no smoke;
//   3. TyreFx.update CPU cost per frame while sliding (the decision asks for under 0.3 ms) and its draw calls.
// Screenshots go to <out> (default test/browser/out/drive-feel/): mid-slide with smoke, the marks after the stop,
// the clean corner. Needs Chrome and the GPU; run it through the machine's GPU lock:
//   node test/browser/drive-feel.mjs [--out=<dir>]
// Exit code 1 on a failed check, a console error or a page error.
import fs from 'node:fs';
import path from 'node:path';
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, repoRoot, parseArgs } from './playwright.config.mjs';

const args = parseArgs();
const outDir = path.resolve(args.out || path.join(repoRoot, 'test/browser/out/drive-feel'));
fs.mkdirSync(outDir, { recursive: true });
const vite = await startVite();
const browser = await launchChrome();
const fsBase = `/@fs${repoRoot.replace(/\/$/, '')}`;
const urls = { render: `${fsBase}/src/render/index.js`, input: `${fsBase}/src/input/index.js`, core: `${fsBase}/src/core/index.js` };
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

// in the page: mean luminance (0..255) of `on` minus `off` captures in a 5 x 5 cell box around the screen points of
// world points (cells of `scale` px), skipping points off-screen or behind the camera
const PROBE = `
  window.__lum = (cam, on, off, pts) => {
    const out = [];
    for (const p of pts) {
      const v = p.clone().project(cam);
      if (v.z > 1 || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) continue;
      const cx = Math.round((v.x * 0.5 + 0.5) * on.w), cy = Math.round((0.5 - v.y * 0.5) * on.h);
      let s = 0, n = 0;
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
        if (x < 0 || y < 0 || x >= on.w || y >= on.h) continue;
        const o = (y * on.w + x) * 4;
        s += (0.2126 * (on.data[o] - off.data[o]) + 0.7152 * (on.data[o + 1] - off.data[o + 1]) + 0.0722 * (on.data[o + 2] - off.data[o + 2])); n++;
      }
      if (n) out.push(s / n);
    }
    return out;
  };`;

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);
  globalThis.__page = page; globalThis.__errors = errors;
  const session = await loadSample(page, vite.base + (await resolvePage(vite, 'starter-drive')) + '?quality=desktop', errors);
  if (session.status !== 'ready') throw new Error(`starter-drive not ready: ${session.note}`);

  // ---- set up: the scripted driver, TyreFx, the assist, a camera that frames each phase -------------------------------
  await page.evaluate(async ([U, probe]) => {
    eval(probe); // eslint-disable-line no-eval
    const { TyreFx } = await import(U.render), { SteeringAssist } = await import(U.input), { PoseInterpolator } = await import(U.core);
    const h = window.__sample, engine = h.engine, { scene, camera } = engine, car = h.car, body = h.body, physics = engine.physics;
    engine.setSystemEnabled('game', false);        // the starter's input / step / camera: this script drives now
    const V = camera.position.constructor;
    const tyres = new TyreFx({ scene, lift: 0.04, budget: { marks: 1200, smoke: 240 } });
    const assist = new SteeringAssist();
    const smooth = new PoseInterpolator(car);
    const S = { phase: 'idle', t: 0, controls: { throttle: 0, brake: 0, steer: 0, handbrake: false }, cost: [], heatMax: 0, view: 'chase', focus: new V(), slidePath: [], cornerPath: [], puffsMax: 0 };
    const start = (phase, x, z, speed) => {
      car.reset(new V(x, 0, z), 0, physics); car.velocity.set(0, 0, -speed);
      smooth.snap(); S.phase = phase; S.t = 0; S.heatMax = 0;
    };
    engine.addSystem({
      fixedUpdate(dt) {
        if (S.phase === 'idle') return;
        const c = S.controls, t = (S.t += dt);
        c.throttle = 0; c.brake = 0; c.handbrake = false; let raw = 0;
        if (S.phase === 'slide') {
          if (t < 0.6) c.throttle = 0.3;
          else if (t < 1.05) { raw = -1; c.handbrake = true; }
          else if (t < 2.1) c.throttle = 0.1;
          else if (car.forwardSpeed > 1) c.brake = 1;
          else if (car.speed > 1) c.handbrake = true; // (spun: rolling backwards) stop it anyway
          else { S.phase = 'stopped'; S.heading = car.heading; }
          c.steer = assist.apply(dt, raw, car, false, c.handbrake);
        } else if (S.phase === 'corner') {
          // clean 0.7 g bends, left and right (yaw rate 0.7 g / v x cos(pi t): heading swings about the road axis): steered by a yaw-rate controller
          if (t < 4) {
            const yawT = ((0.7 * 9.81) / 18) * Math.cos(Math.PI * t), err = yawT - car.angularVelocity.y;
            S.yawI = (S.yawI || 0) + err * 0.02; // feed-forward (kinematic wheel angle x 2 for understeer) + P + I
            c.steer = Math.max(-1, Math.min(1, -(2 * yawT * 2.6 / 18) / (car.steerLimit || 0.19) - err - S.yawI));
            c.throttle = Math.max(0, Math.min(1, (18 - car.speed) * 0.5));
            if (t > 0.5) S.latMax = Math.max(S.latMax || 0, Math.abs(car.localAccel.x) / 9.81);
          }
          else if (t < 6) { c.steer = 0; c.throttle = 0.15; }   // straighten and let the yaw die first: braking hard
          else if (car.forwardSpeed > 1) { c.steer = 0; c.brake = 0.4; } else S.phase = 'stopped'; // while turning slides
        }
        smooth.save();
        car.step(dt, c, physics);
        for (const w of car.wheels) S.heatMax = Math.max(S.heatMax, w.slideHeat);
        if (S.phase === 'slide') S.slidePath.push([car.position.x, car.position.z]);
        if (S.phase === 'corner') S.cornerPath.push([car.position.x, car.position.z]);
      },
      update(dt, alpha) {
        smooth.apply(body, alpha);
        const t0 = performance.now();
        tyres.update(dt, car, body);
        if (S.phase === 'slide') S.cost.push(performance.now() - t0);
        S.puffsMax = Math.max(S.puffsMax, tyres.smoke.count);
        const p = body.position;
        if (S.view === 'chase') { camera.position.set(p.x + 7, 5, p.z + 11); camera.lookAt(p.x, 0.5, p.z - 2); }
        else { camera.position.set(S.focus.x + 3, 16, S.focus.z + 14); camera.lookAt(S.focus.x, 0, S.focus.z); }
        camera.updateMatrixWorld();
      },
    }, 'drive-feel');
    window.__df = { S, tyres, start, car, V };
  }, [urls, PROBE]);

  // ---- 1. the slide --------------------------------------------------------------------------------------------------
  await page.evaluate(() => window.__df.start('slide', 3, 60, 22));
  await page.waitForFunction(() => window.__df.S.t > 0.95, null, { timeout: 20000 });
  const mid = await page.evaluate(() => ({ puffs: window.__df.tyres.smoke.count, marks: window.__df.tyres.marks.count }));
  await page.screenshot({ path: path.join(outDir, 'drive-feel-slide.png') });
  await page.waitForFunction(() => window.__df.S.phase === 'stopped', null, { timeout: 20000 });
  await page.waitForTimeout(2500); // the smoke thins out
  const slide = await page.evaluate(async () => {
    const { S, tyres, car, V } = window.__df, h = window.__sample, cam = h.engine.camera;
    // frame the marks from above: centre on the ribbon vertices
    const P = tyres.marks.pos.array, n = tyres.marks.count;
    const c = new V(); for (let q = 0; q < n * 4; q++) c.add(new V(P[q * 3], P[q * 3 + 1], P[q * 3 + 2])); c.multiplyScalar(1 / (n * 4));
    S.focus.copy(c); S.view = 'top';
    await new Promise((r) => setTimeout(r, 600));
    // segment centres (marks) and points 2.5 m to the side of each (clean road, unless a mark is there too)
    const marks = [], clean = [];
    for (let q = 0; q < n; q += Math.max(1, Math.floor(n / 80))) {
      const m = new V(); for (let k = 0; k < 4; k++) m.add(new V(P[(q * 4 + k) * 3], P[(q * 4 + k) * 3 + 1], P[(q * 4 + k) * 3 + 2]));
      marks.push(m.multiplyScalar(0.25));
    }
    const near = (p) => { for (let q = 0; q < n * 4; q++) if (Math.hypot(P[q * 3] - p.x, P[q * 3 + 2] - p.z) < 0.9) return true; return false; };
    for (const m of marks) for (const dx of [-2.5, 2.5]) { const p = new V(m.x + dx, 0.02, m.z); if (Math.abs(p.x) < 4.5 && !near(p)) clean.push(p); }
    const wait = () => new Promise((r) => setTimeout(r, 400));
    const on1 = h.capture(2); tyres.marks.mesh.visible = false; await wait();
    const off = h.capture(2); tyres.marks.mesh.visible = true; await wait();
    const on2 = h.capture(2);
    const avg = { w: on1.w, h: on1.h, data: on1.data.map((x, i) => (x + on2.data[i]) / 2) };
    const far = marks.map((m) => new V(m.x < 0 ? m.x + 9 : m.x - 9, 0, m.z)); // grass beyond the road edge, same depth
    const dm = window.__lum(cam, avg, off, marks), dc = window.__lum(cam, avg, off, clean), df = window.__lum(cam, avg, off, far);
    const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
    const cost = S.cost.slice().sort((a, b) => a - b);
    const xs = S.slidePath.map((p) => p[0]);
    return {
      marks: n, marked: tyres.stats.marked, puffs: tyres.stats.puffs, puffsMax: S.puffsMax, heatMax: S.heatMax,
      darkMarks: mean(dm), nMarks: dm.length, darkClean: mean(dc), nClean: dc.length, darkFar: mean(df), nFar: df.length,
      costMean: mean(cost), costP95: cost[Math.floor(cost.length * 0.95)], costMax: cost[cost.length - 1], frames: cost.length,
      xMin: Math.min(...xs), xMax: Math.max(...xs), stopped: car.speed, headingDeg: S.heading * 180 / Math.PI,
    };
  });
  await page.screenshot({ path: path.join(outDir, 'drive-feel-marks.png') });
  console.log('[slide]', JSON.stringify({ mid, ...slide }));
  check('slide: smoke while sliding (live puffs mid-slide)', mid.puffs > 0, `${mid.puffs} puffs, ${mid.marks} mark segments`);
  check('slide: slideHeat passed the smoke threshold', slide.heatMax > 25, `${slide.heatMax.toFixed(0)} kW`);
  check('slide: marks laid', slide.marks > 20, `${slide.marks} segments`);
  check('slide: the road is darker where the wheels slid (luminance, marks shown - hidden)', slide.darkMarks < -6 && slide.nMarks >= 10, `${slide.darkMarks.toFixed(1)} over ${slide.nMarks} points`);
  // hiding the marks also moves the whole frame a little (auto exposure, TAA): judge clean road against the far grass
  check('slide: marks darken the road far more than the frame moves (marks - clean road)', slide.darkMarks - slide.darkClean < -15, `${(slide.darkMarks - slide.darkClean).toFixed(1)}`);
  check('slide: clean road beside the marks changes like the far grass (whole-frame drift only)', Math.abs(slide.darkClean - slide.darkFar) < 2 && slide.nClean >= 5 && slide.nFar >= 5, `clean ${slide.darkClean.toFixed(2)} (${slide.nClean} pts), far grass ${slide.darkFar.toFixed(2)} (${slide.nFar} pts)`);
  check('slide: the assist caught it (heading at the stop, 0 = down the road)', Math.abs(slide.headingDeg) < 20, `${slide.headingDeg.toFixed(1)} deg`);
  console.log(`      the slide's path: x ${slide.xMin.toFixed(1)} .. ${slide.xMax.toFixed(1)} m (the road is x -5 .. 5)`);
  check('slide: thin smoke (live puffs at most)', slide.puffsMax <= 60, `${slide.puffsMax}`);
  check('cost: TyreFx.update per frame while sliding (mean < 0.3 ms)', slide.costMean < 0.3, `mean ${slide.costMean.toFixed(3)} ms, p95 ${slide.costP95.toFixed(3)} ms, max ${slide.costMax.toFixed(3)} ms over ${slide.frames} frames`);

  // ---- 2. a clean corner further down the road -----------------------------------------------------------------------
  const before = await page.evaluate(() => ({ marked: window.__df.tyres.stats.marked, puffs: window.__df.tyres.stats.puffs }));
  await page.evaluate(() => { const d = window.__df; d.S.view = 'chase'; d.start('corner', 0.5, -300, 18); });
  await page.waitForFunction(() => window.__df.S.t > 3.2, null, { timeout: 20000 });
  await page.screenshot({ path: path.join(outDir, 'drive-feel-clean-corner.png') });
  await page.waitForFunction(() => window.__df.S.phase === 'stopped', null, { timeout: 20000 });
  const corner = await page.evaluate(() => {
    const { S, tyres } = window.__df, h = window.__sample;
    const xs = S.cornerPath.map((p) => p[0]);
    return { marked: tyres.stats.marked, puffs: tyres.stats.puffs, heatMax: S.heatMax, latMax: S.latMax, xMin: Math.min(...xs), xMax: Math.max(...xs), info: h.info() };
  });
  console.log('[corner]', JSON.stringify({ before, ...corner, info: undefined }));
  check('corner: real 0.7 g bends were driven (max lateral)', corner.latMax > 0.6 && corner.latMax < 0.85, `${corner.latMax.toFixed(2)} g`);
  check('corner: on the asphalt (x range of the path)', corner.xMin > -4.5 && corner.xMax < 4.5, `x ${corner.xMin.toFixed(1)} .. ${corner.xMax.toFixed(1)} m`);
  check('corner: no slideHeat', corner.heatMax === 0, `${corner.heatMax.toFixed(2)} kW`);
  check('corner: no new marks, no new smoke', corner.marked === before.marked && corner.puffs === before.puffs, `marks ${before.marked} -> ${corner.marked}, puffs ${before.puffs} -> ${corner.puffs}`);
  console.log(`[info] ${JSON.stringify(corner.info)}`);
  check('page: no console or page errors', errors.length === 0);
  for (const e of errors) console.log('  ' + e);
  console.log(`screenshots: ${outDir}`);
  await page.close();
} catch (e) {
  failed++; console.log('FAIL  ' + (e && e.stack || e));
  if (globalThis.__page) { try { console.log('state', JSON.stringify(await globalThis.__page.evaluate(() => { const d = window.__df; return d ? { phase: d.S.phase, t: d.S.t, speed: d.car.speed, frame: window.__sample.engine.frameCount } : null; }))); } catch { /* closed */ } }
  for (const e of globalThis.__errors || []) console.log('  ' + e);
} finally {
  await browser.close(); await vite.close();
}
process.exit(failed ? 1 : 0);
