// Headless checks for TyreFx (src/render/TyreFx.js) fed by VehicleController's wheels[i].slideHeat on ROAD_CAR_SPEC:
// a clean 0.8 g corner and hard straight braking leave no marks and no smoke; a handbrake slide leaves marks (mostly
// from the rear tyres) and thin smoke; budgets hold; deterministic; clear(); no allocation per update; an empty
// ParticleSystem stays visible until its first draw (so warmUp compiles it). 120 Hz physics, TyreFx at 60 Hz with the
// car's own pose (no body). Run: node test/tyre-fx.mjs
import './helpers/dom-shim.mjs';
import { Vector3 } from 'three';
import { VehicleController, ROAD_CAR_SPEC } from '../src/physics/index.js';
import { TyreFx } from '../src/render/TyreFx.js';
import { DecalTrail } from '../src/render/Decals.js';
import { ParticleSystem } from '../src/render/Particles.js';
import { ALLOC, bytesPerCall, gate, functionsOf } from './helpers/alloc.mjs';

const DT = 1 / 120, FRAME = 1 / 60, G = 9.81;
let failures = 0;
const lines = [];
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(3).padStart(9) : String(x).padStart(9));
function check(name, v, lo, hi, unit = '') {
  const ok = Number.isFinite(v) && v >= lo && v <= hi;
  if (!ok) failures++;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(64)} ${fmt(v)} ${unit.padEnd(4)} [${lo} .. ${hi}]`);
  return ok;
}
const note = (s) => lines.push(`      ${s}`);

/** Run `seconds` with controls(t, car) at 120 Hz, TyreFx at 60 Hz. Returns the car, the fx and the max heat seen. */
function run({ seconds, v0, controls, budget, seed = 1 }) {
  const car = new VehicleController(ROAD_CAR_SPEC);
  car.reset(new Vector3(0, 0, 0), 0, null);
  car.velocity.set(0, 0, -v0);
  const fx = new TyreFx({ budget, seed });
  let heatMax = 0, latMax = 0, liveMax = 0, alphaMax = 0;
  const heatPerWheel = [0, 0, 0, 0];
  for (let f = 0; f < Math.round(seconds / FRAME); f++) {
    const t = f * FRAME;
    for (let s = 0; s < 2; s++) car.step(DT, controls(t + s * DT, car), null);
    fx.update(FRAME, car);
    for (let i = 0; i < 4; i++) { heatMax = Math.max(heatMax, car.wheels[i].slideHeat); heatPerWheel[i] += car.wheels[i].slideHeat * FRAME; }
    if (t > 1) latMax = Math.max(latMax, Math.abs(car.localAccel.x) / G);
    liveMax = Math.max(liveMax, fx.smoke.count);
    for (let p = 0; p < fx.smoke.count; p++) alphaMax = Math.max(alphaMax, fx.smoke.a0[p]);
  }
  return { car, fx, heatMax, latMax, liveMax, alphaMax, heatPerWheel };
}

// ---- 1. a clean 0.8 g corner: steer held by a yaw-rate controller onto the 0.8 g circle at 20 m/s ------------------
{
  const v = 20, yawTarget = (0.8 * G) / v;
  let steer = 0;
  const r = run({
    seconds: 8, v0: v,
    controls: (t, car) => { steer = Math.max(-1, Math.min(1, steer - (yawTarget - car.angularVelocity.y) * 0.02)); return { throttle: Math.max(0, Math.min(1, (v - car.speed) * 0.5)), steer }; },
  });
  note(`0.8 g corner: lateral max ${r.latMax.toFixed(2)} g, front slip ${(Math.abs(r.car.slipFront) / r.car.slipPeakFront).toFixed(2)} x peak, max slideHeat ${r.heatMax.toFixed(2)} kW`);
  check('clean corner: it is a 0.8 g corner (lateral, after 1 s)', r.latMax, 0.75, 0.9, 'g');
  check('clean corner: max slideHeat on any tyre', r.heatMax, 0, 0, 'kW');
  check('clean corner: mark segments', r.fx.marks.count, 0, 0);
  check('clean corner: smoke puffs spawned', r.fx.stats.puffs, 0, 0);
}

// ---- 2. hard straight braking 25 -> 0 m/s: ABS-capped, no lock-up marks ----------------------------------------------
{
  const r = run({ seconds: 4, v0: 25, controls: () => ({ brake: 1 }) });
  check('hard braking: max slideHeat', r.heatMax, 0, 0, 'kW');
  check('hard braking: mark segments + puffs', r.fx.marks.count + r.fx.stats.puffs, 0, 0);
}

// ---- 3. a handbrake slide: 20 m/s, steer left with the handbrake for 1.2 s, then release ---------------------------
let slide;
{
  const budget = { marks: 600, smoke: 120 };
  slide = run({ seconds: 3, v0: 20, budget, controls: (t) => (t < 1.2 ? { steer: -1, handbrake: true } : { throttle: 0.2 }) });
  const r = slide, hw = r.heatPerWheel;
  note(`handbrake slide: max slideHeat ${r.heatMax.toFixed(0)} kW, heat x s per wheel [${hw.map((h) => h.toFixed(0)).join(', ')}], marks ${r.fx.marks.count} segments, puffs ${r.fx.stats.puffs} (live max ${r.liveMax}), puff alpha max ${r.alphaMax.toFixed(3)}`);
  check('slide: slideHeat passes the smoke threshold (25 kW)', r.heatMax, 25, Infinity, 'kW');
  check('slide: mark segments laid', r.fx.marks.count, 20, 600);
  check('slide: the rear tyres slide hardest (rear heat / all)', (hw[2] + hw[3]) / (hw[0] + hw[1] + hw[2] + hw[3]), 0.6, 1);
  check('slide: smoke puffs spawned', r.fx.stats.puffs, 5, Infinity);
  check('slide: live puffs within the budget (120)', r.liveMax, 1, 120);
  check('slide: thin smoke (max puff alpha)', r.alphaMax, 0.01, 0.12);
  // the marks are where the rear wheels slid: within a car length of the path, at road height (+ lift)
  const P = r.fx.marks.pos.array;
  let yMin = Infinity, yMax = -Infinity;
  for (let q = 0; q < r.fx.marks.count * 4; q++) { yMin = Math.min(yMin, P[q * 3 + 1]); yMax = Math.max(yMax, P[q * 3 + 1]); }
  check('slide: mark vertices sit on the road (y, lift 0.03)', yMax - yMin + Math.abs(yMin - 0.03), 0, 0.12, 'm');
  const fx2 = run({ seconds: 3, v0: 20, budget, controls: (t) => (t < 1.2 ? { steer: -1, handbrake: true } : { throttle: 0.2 }) }).fx;
  let same = fx2.marks.count === r.fx.marks.count && fx2.stats.puffs === r.fx.stats.puffs ? 1 : 0;
  for (let q = 0; q < r.fx.marks.count * 12 && same; q++) if (fx2.marks.pos.array[q] !== P[q]) same = 0;
  for (let q = 0; q < r.fx.smoke.count * 3 && same; q++) if (fx2.smoke.p[q] !== r.fx.smoke.p[q]) same = 0;
  check('deterministic: two slides give identical marks and puffs', same, 1, 1);
  // budget: a long slide keeps the ring and the puffs at their caps
  const long = run({ seconds: 6, v0: 25, budget: { marks: 40, smoke: 30, rate: 30 }, controls: () => ({ steer: -1, handbrake: true, throttle: 0.5 }) });
  check('budget: marks ring capped (40)', long.fx.marks.count, 1, 40);
  check('budget: live puffs capped (30)', long.liveMax, 1, 30);
  r.fx.clear();
  check('clear(): no marks, no puffs left', r.fx.marks.count + r.fx.smoke.count, 0, 0);
}

// ---- 4. allocation per update (a slide in progress: ribbons and puffs) ---------------------------------------------
// Two readings: smoke only (marks switched off by their heat range) must be 0 B; with marks, the remaining bytes are
// DecalTrail's own: its _quad() takes two freshly computed alphas (32 B per segment laid, existing code), and here a
// segment is laid every 5th call per wheel. ParticleSystem.update alone is read too (0 B).
{
  const force = functionsOf(TyreFx, DecalTrail, ParticleSystem);
  // each reading is taken with its gate's budget: a reading over it is retried (a real allocation reads the same on
  // every try). Read with the default 1 B, the smoke gate (0.5) failed on a single 0.9 B window (1 of 300 CI runs)
  const reading = (opts, budget) => {
    const car = new VehicleController(ROAD_CAR_SPEC);
    car.reset(new Vector3(), 0, null); car.velocity.set(0, 0, -25);
    const c = { steer: -1, handbrake: true, throttle: 0.5 };
    const fx = new TyreFx({ budget: { marks: 4000, smoke: 400 }, ...opts });
    for (let i = 0; i < 60; i++) { car.step(DT, c, null); fx.update(FRAME, car); }
    let sink = 0;
    // the car holds its slide pose (heat stays up) and moves 5 cm per call, so the ribbons keep extending
    const m = bytesPerCall((n) => { for (let i = 0; i < n; i++) { car.position.z -= 0.05; fx.update(FRAME, car); sink += fx.smoke.count; } }, 2000, { force, budget });
    if (!Number.isFinite(sink)) failures++;
    return { m, fx };
  };
  const smokeOnly = reading({ markHeat: [1e9, 2e9] }, 0.5);
  check('alloc: smoke-only run spawns puffs (sanity)', smokeOnly.fx.stats.puffs, 10, Infinity);
  gate(check, note, 'TyreFx.update(), smoke only, x2000', smokeOnly.m, { budget: 0.5 });
  const both = reading({}, 32);
  gate(check, note, 'TyreFx.update(), marks + smoke, x2000 (DecalTrail._quad: 32 B per segment)', both.m, { budget: 32 });
  if (!ALLOC.ok) note(ALLOC.reason);
}

// ---- 5. _writePuff writes what ParticleSystem.spawn writes -----------------------------------------------------------
{
  const fx = new TyreFx({ budget: { smoke: 8 } });
  const ref = new ParticleSystem({ max: 8 });
  Object.assign(fx._puff, { x: 1, y: 2, z: 3, vx: 4, vy: 5, vz: 6, life: 2, size0: 0.4, size1: 2, alpha: 0.1, r: 0.7, g: 0.71, b: 0.72, r1: 0.6, g1: 0.61, b1: 0.62, drag: 1.3, gravity: -0.08, rot: 1, rotV: 0.2 });
  fx._writePuff();
  const P = fx._puff;
  ref.spawn(P.x, P.y, P.z, P.vx, P.vy, P.vz, P.life, P.size0, P.size1, P.alpha, P.r, P.g, P.b, P.r1, P.g1, P.b1, P.drag, P.gravity);
  ref.rot[0] = P.rot; ref.rotV[0] = P.rotV; // spawn draws these from Math.random
  let same = fx.smoke.count === ref.count ? 1 : 0;
  for (const k of ['p', 'v', 'age', 'life', 's0', 's1', 'a0', 'rot', 'rotV', 'c', 'c1', 'dragA', 'grav']) {
    for (let j = 0; j < ref[k].length; j++) if (fx.smoke[k][j] !== ref[k][j]) { same = 0; note(`_writePuff differs from spawn() in ${k}[${j}]`); break; }
  }
  check('_writePuff: the same arrays as ParticleSystem.spawn', same, 1, 1);
}

// ---- 6. an empty ParticleSystem is drawn until its first draw, so engine.warmUp() compiles it -----------------------
{
  const ps = new ParticleSystem({ max: 8 });
  ps.update(0);
  const before = ps.mesh.visible;
  ps.mesh.onAfterRender();
  ps.update(0);
  check('ParticleSystem: empty, visible until drawn once, then hidden', before && !ps.mesh.visible ? 1 : 0, 1, 1);
}

console.log(lines.join('\n'));
console.log(failures ? `\n${failures} tyre-fx check(s) FAILED` : '\nall tyre-fx checks passed');
process.exit(failures ? 1 : 0);
