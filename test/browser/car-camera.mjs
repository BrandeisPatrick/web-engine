// createCarVisual and ChaseRig's road feel on the running starter-drive page in headless Chrome with real WebGL. The
// starter is not edited: the script imports the engine modules through /@fs (as test/browser/howto.mjs does), switches
// the starter's own game system off, hides its box car, and drives a createCarVisual hatchback on the page's
// VehicleController with its own loop (PoseInterpolator, ChaseRig { feel: 'road' }, trauma on impacts, visual.update).
// Checks: the brake-lamp region brightens under braking (and a control region beside it does not), the reverse lamps
// light while reversing, the visual sits on its wheels (hub heights), no console or page errors. Screenshots go to
// --out (default: the scratch folder of this round, else test/browser/out/car-camera/): rest, braking, mid-corner with
// road feel, reversing, dusk, and one per HD type.
// Needs Chrome and the GPU, so it is not part of `npm test`; run it through the machine's GPU lock:
//   node test/browser/car-camera.mjs [--out dir]
// Exit code 1 on a failed check, a console error or a page error.
import fs from 'node:fs';
import path from 'node:path';
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, repoRoot, parseArgs } from './playwright.config.mjs';

const args = parseArgs();
const out = path.resolve(args.out || path.join(repoRoot, 'test/browser/out/car-camera'));
fs.mkdirSync(out, { recursive: true });
const vite = await startVite();
const browser = await launchChrome();
const root = `/@fs${repoRoot.replace(/\/$/, '')}`;
const urls = { world: `${root}/src/world/CarVisual.js`, camera: `${root}/src/camera/index.js`, core: `${root}/src/core/index.js`, render: `${root}/src/render/index.js` };
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const shot = async (page, name) => { const f = path.join(out, `${name}.png`); await page.screenshot({ path: f }); console.log(`  saved ${f}`); };

// in the page: the car swap and the loop (window.__cc)
async function setup([U]) {
  const { createCarVisual } = await import(U.world), { ChaseRig } = await import(U.camera), { PoseInterpolator } = await import(U.core);
  const { PostFX, Atmosphere } = await import(U.render);
  const h = window.__sample, engine = h.engine, { scene, camera } = engine, car = h.car, physics = engine.physics;
  // the starter's PostFX and Atmosphere are not exposed: catch them on their next call
  const grab = (C, m) => new Promise((res) => { const o = C.prototype[m]; C.prototype[m] = function (...a) { C.prototype[m] = o; res(this); return o.apply(this, a); }; });
  const [postfx, atmosphere] = await Promise.all([grab(PostFX, 'render'), grab(Atmosphere, 'update')]);
  engine.setSystemEnabled('game', false);
  h.body.visible = false;
  const ctl = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0, accel: car.localAccel };
  const rig = new ChaseRig(camera, null, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false, feel: 'road' });
  const cc = { ctl, rig, car, postfx, atmosphere, visual: null, smooth: null, impacts: 0, view: null };
  const V3 = car.position.constructor, _p = new V3(), _t = new V3();
  // a fixed view in the car's frame instead of the rig: [x, y, z, lookX, lookY, lookZ] (null: the chase rig)
  const placeView = () => {
    const v = cc.view, r = cc.visual.root;
    r.updateMatrixWorld(true);
    camera.position.copy(r.localToWorld(_p.set(v[0], v[1], v[2])));
    camera.up.set(0, 1, 0); camera.lookAt(r.localToWorld(_t.set(v[3], v[4], v[5])));
    if (camera.fov !== 45) { camera.fov = 45; camera.updateProjectionMatrix(); }
  };
  cc.use = (type, color) => {
    if (cc.visual) { scene.remove(cc.visual.root); postfx.untrack(cc.visual.root); cc.visual.dispose(); }
    const v = createCarVisual(type, { color });
    scene.add(v.root);
    postfx.syncGBuffer(); postfx.track(v.root);
    cc.visual = v;
    cc.smooth = new PoseInterpolator(car);
    cc.smooth.apply(v.root, 1);
    rig.setTarget(v.root, () => state);
    return { tris: 0 };
  };
  cc.reset = (z = 0, heading = 0) => { car.reset(new car.position.constructor(0, 0, z), heading, physics); cc.smooth.snap(); rig.snap(); };
  cc.info = () => {
    const v = cc.visual, hub = v.wheels.map((w) => +w.position.y.toFixed(4));
    return { speed: car.speed, braking: car.braking, reversing: car.reversing, lamps: { ...v.lamps }, hub, wr: v.spec.wheelRadius, z: car.position.z, impacts: cc.impacts, trauma: rig.trauma, darkness: atmosphere.darkness };
  };
  // screen positions (capture grid) of the tail lamps and of a control point on the bumper between them
  cc.tailPoints = () => {
    const v = cc.visual, g = v.body.geometry, P = g.attributes.position.array, A = g.attributes.aUvT.array;
    const side = { [-1]: [0, 0, 0, 0], 1: [0, 0, 0, 0] };
    for (let i = 0; i < P.length / 3; i++) {
      const l = A[i * 4 + 3];
      if (!(l > 1.5 && l < 2.5) || P[i * 3 + 2] < v.spec.length / 2 - 0.3) continue;
      const s = side[P[i * 3] < 0 ? -1 : 1]; s[0] += P[i * 3]; s[1] += P[i * 3 + 1]; s[2] += P[i * 3 + 2]; s[3]++;
    }
    const V3 = car.position.constructor, pts = [];
    for (const sd of [-1, 1]) { const s = side[sd]; pts.push(new V3(s[0] / s[3], s[1] / s[3], s[2] / s[3] + 0.02)); }
    pts.push(new V3(0, (pts[0].y + pts[1].y) / 2 - 0.28, pts[0].z)); // control: the bumper below the boot, no lamp
    v.root.updateMatrixWorld(true);
    return pts.map((p) => v.root.localToWorld(p));
  };
  cc.revPoints = () => { const v = cc.visual; v.root.updateMatrixWorld(true); return v.reverseLamps.map((q) => v.root.localToWorld(q.position.clone())); };
  cc.probe = (cap, pts, ch = 0) => {
    const out = [], k = cap.scale * cap.scale;
    for (const p of pts) {
      const s = p.clone().project(camera), cx = Math.round((s.x * 0.5 + 0.5) * cap.w), cy = Math.round((0.5 - s.y * 0.5) * cap.h);
      let sum = 0, n = 0;
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
        if (x < 0 || y < 0 || x >= cap.w || y >= cap.h) continue;
        const o = (y * cap.w + x) * 4; n++;
        // ch 0: red (tail lamps); ch -1: the smallest channel (whiteness: the reverse lamps against a pink reflector)
        sum += ch >= 0 ? cap.data[o + ch] / k : Math.min(cap.data[o], cap.data[o + 1], cap.data[o + 2]) / k;
      }
      out.push(n ? +(sum / n).toFixed(1) : NaN);
    }
    return out;
  };
  engine.addSystem({
    fixedUpdate(dt) { cc.smooth.save(); car.step(dt, ctl, physics); if (car.impact > 1.5) { rig.addTrauma(Math.min(0.6, car.impact / 15)); cc.impacts++; } },
    update(dt, alpha) {
      cc.smooth.apply(cc.visual.root, alpha);
      cc.visual.update(dt, car, { darkness: atmosphere.darkness });
      state.speedKmh = car.speed * 3.6; state.grounded = car.grounded; state.wheelSlip = car.wheelSlip;
      if (cc.view) placeView(); else rig.update(dt);
    },
    lateUpdate(dt) { atmosphere.update(camera.position, dt); },
  }, 'car-camera');
  cc.use('hatchback', 0x9e1416);
  cc.reset();
  window.__cc = cc;
}

const set = (page, o) => page.evaluate((o) => Object.assign(window.__cc.ctl, { throttle: 0, brake: 0, steer: 0, handbrake: false }, o), o);
const info = (page) => page.evaluate(() => window.__cc.info());
const wait = (page, ms) => page.waitForTimeout(ms);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);
  const session = await loadSample(page, vite.base + (await resolvePage(vite, 'starter-drive')) + '?quality=desktop', errors);
  if (session.status !== 'ready') throw new Error(`starter-drive not ready: ${session.note}`);
  await page.evaluate(setup, [urls]);
  await wait(page, 1500);
  const i0 = await info(page);
  check('the car sits on its wheels at rest (hub height = wheel radius)', i0.hub.every((y) => Math.abs(y - i0.wr) < 0.01), `hubs ${i0.hub.join(' ')}, radius ${i0.wr}`);
  check('golden hour: head / tail lamps off (uDark 0)', i0.lamps.uDark === 0, `darkness ${i0.darkness.toFixed(2)}`);
  await shot(page, 'car-camera-rest');

  // cruise, then brake: the tail-lamp region against a control region on the bumper
  await set(page, { throttle: 1 }); await wait(page, 4500);
  await set(page, { throttle: 0.25 }); await wait(page, 800);
  const cruise = await page.evaluate(() => { const c = window.__cc, pts = c.tailPoints(); return { p: c.probe(window.__sample.capture(2), pts), i: c.info() }; });
  await set(page, { brake: 0.7 }); await wait(page, 350);
  const braking = await page.evaluate(() => { const c = window.__cc, pts = c.tailPoints(); return { p: c.probe(window.__sample.capture(2), pts), i: c.info() }; });
  await shot(page, 'car-camera-braking');
  console.log('[brake]', JSON.stringify({ cruise, braking }));
  const lampGain = (braking.p[0] + braking.p[1]) / 2 - (cruise.p[0] + cruise.p[1]) / 2, ctlGain = braking.p[2] - cruise.p[2];
  check('braking: the car is braking, brake lamps at full', braking.i.braking && braking.i.lamps.brake > 0.99, `brake ${braking.i.lamps.brake.toFixed(2)} at ${(braking.i.speed * 3.6).toFixed(0)} km/h`);
  check('braking: the brake-lamp regions brighten (red, 0..255)', lampGain > 25, `+${lampGain.toFixed(1)} (left ${cruise.p[0]} -> ${braking.p[0]}, right ${cruise.p[1]} -> ${braking.p[1]})`);
  check('braking: the bumper between them changes far less', Math.abs(ctlGain) < lampGain * 0.4, `${ctlGain.toFixed(1)}`);
  await set(page, { brake: 1 }); await wait(page, 2500);

  // mid-corner with road feel
  await set(page, { throttle: 1 }); await wait(page, 3500);
  await set(page, { throttle: 0.5, steer: -0.55 }); await wait(page, 900);
  const ci = await info(page);
  await shot(page, 'car-camera-corner-road-feel');
  check('corner: moving and turning', ci.speed > 10, `${(ci.speed * 3.6).toFixed(0)} km/h`);
  await set(page, { brake: 1 }); await wait(page, 3000);

  // reverse: brake from a stop reverses; a close view of the tail, by day and at dusk (by day the chrome reflector
  // already mirrors a bright sky, so the measured change is at dusk)
  await page.evaluate(() => { const c = window.__cc; c.reset(0, 0); c.view = [1.6, 1.3, 4.6, 0, 0.75, 1.6]; }); await wait(page, 600);
  await set(page, { brake: 1 }); await wait(page, 1200);
  const ri = await info(page);
  await shot(page, 'car-camera-reversing');
  check('reversing: reverse lamps lit, brake lamps off', ri.reversing && ri.lamps.reverse > 0.99 && ri.lamps.brake === 0, JSON.stringify(ri.lamps));
  await set(page, {}); await wait(page, 300);

  // dusk: head and tail lamps on; the reverse lamps against the parked tail
  await page.evaluate(() => { const c = window.__cc; c.atmosphere.setTimeOfDay('dusk'); c.postfx.setTimeOfDay(c.atmosphere.darkness); c.reset(0, 0); });
  await wait(page, 1200);
  const di = await info(page);
  check('dusk: lamps on (uDark > 0.3)', di.lamps.uDark > 0.3, `darkness ${di.darkness.toFixed(2)}, uDark ${di.lamps.uDark.toFixed(2)}`);
  const parked = await page.evaluate(() => { const c = window.__cc; return c.probe(window.__sample.capture(1), c.revPoints(), -1); });
  await set(page, { brake: 1 }); await wait(page, 1200);
  const backing = await page.evaluate(() => { const c = window.__cc; return c.probe(window.__sample.capture(1), c.revPoints(), -1); });
  await shot(page, 'car-camera-dusk-reversing');
  check('dusk reversing: the reverse-lamp regions turn white (smallest channel, 0..255)', backing.every((b, i) => b - parked[i] > 15), `${parked.join(', ')} -> ${backing.join(', ')}`);
  await set(page, {}); await page.evaluate(() => { window.__cc.view = null; window.__cc.reset(0, 0); });
  await wait(page, 1200);
  await shot(page, 'car-camera-dusk');
  await page.evaluate(() => { const c = window.__cc; c.atmosphere.setTimeOfDay('golden'); c.postfx.setTimeOfDay(c.atmosphere.darkness); });

  // one of each HD type, parked, from the chase camera's three-quarter: turn the rig by placing the car at a heading
  const types = await page.evaluate(async ([U]) => (await import(U.world.replace('CarVisual.js', 'Vehicles.js'))).VEHICLE_HD_TYPES, [urls]);
  const colors = [0x2c5ca8, 0x9e1416, 0x4b4f54, 0xeeeeea, 0x1e3b2b, 0xffffff, 0xf2b705, 0xffffff];
  for (let i = 0; i < types.length; i++) {
    await page.evaluate(([t, c]) => { const cc = window.__cc; cc.use(t, c); cc.reset(0, 0); cc.view = [-4.2, 1.6, -cc.visual.spec.length / 2 - 3.6, 0, 0.7, -0.3]; }, [types[i], colors[i]]);
    await wait(page, 900);
    const ti = await info(page);
    check(`${types[i]}: on its wheels`, ti.hub.every((y) => Math.abs(y - ti.wr) < 0.01), ti.hub.join(' '));
    await shot(page, `car-camera-type-${types[i]}`);
  }
  check('no console or page errors', errors.length === 0);
  for (const e of errors) console.log('  ' + e);
  await page.close();
} catch (e) {
  failed++; console.log('FAIL  ' + e.stack);
} finally {
  await browser.close(); await vite.close();
}
process.exit(failed ? 1 : 0);
