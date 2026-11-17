// Headless checks for the steering assist (src/input/SteeringAssist.js) on ROAD_CAR_SPEC, driven through VehicleInput
// with fake key events (the real keyboard ramps), 60 Hz frames of two 120 Hz physics steps, throttle held by a speed
// controller. Every scenario runs twice, without and with the assist, and prints both:
//   1. full lock at 30 m/s: the front tyre settles within 5 % of its peak slip, with no less lateral grip than raw input;
//   2. a handbrake slide at 25 m/s (A + X for 0.45 s, then nothing held) recovers to under 3 degrees of sideslip within
//      2 s, sooner than without;
//   3. an 8 s key slalom at 28 m/s (three periods) never spins;
//   4. at 5 m/s the full-lock turning circle grows under 5 %;
//   plus: off by default and identical to raw input, the live toggle, pass-through cases, determinism, no allocation;
//   and VehicleHaptics' output values (rumble cannot be felt headless): quiet when driving clean, layered, ringing out.
// Run: node test/steering-assist.mjs
import { Vector3 } from 'three';
import { VehicleController, ROAD_CAR_SPEC } from '../src/physics/index.js';
import { VehicleInput } from '../src/input/VehicleInput.js';
import { SteeringAssist } from '../src/input/SteeringAssist.js';
import { VehicleHaptics } from '../src/input/VehicleHaptics.js';
import { ALLOC, BOXED, bytesPerCall, gate, functionsOf } from './helpers/alloc.mjs';

const DT = 1 / 120, FRAME = 1 / 60, DEG = 180 / Math.PI;
let failures = 0;
const lines = [];
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(3).padStart(9) : String(x).padStart(9));
function check(name, v, lo, hi, unit = '') {
  const ok = Number.isFinite(v) && v >= lo && v <= hi;
  if (!ok) failures++;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(70)} ${fmt(v)} ${unit.padEnd(4)} [${lo} .. ${hi}]`);
  return ok;
}
const note = (s) => lines.push(`      ${s}`);
const keyEvt = (code) => ({ code, target: null, repeat: false, preventDefault() {} });
const press = (input, code, on) => (on ? input.map._onKeyDown(keyEvt(code)) : input.map._onKeyUp(keyEvt(code)));

/** body-frame sideslip (rad, + = sliding right) */
function sideslip(car) {
  const q = car.quaternion, v = car.velocity;
  const rx = 1 - 2 * (q.y * q.y + q.z * q.z), ry = 2 * (q.x * q.y + q.w * q.z), rz = 2 * (q.x * q.z - q.w * q.y);
  return Math.atan2(v.x * rx + v.y * ry + v.z * rz, Math.max(Math.abs(car.forwardSpeed), 1));
}

/**
 * Drive one scenario. keys(t) -> the key codes held; speed: target for the throttle controller (null: throttle(t)).
 * Returns per-step samples { t, speed, aF, aR, latG, beta, yaw }.
 */
function drive({ assist, seconds, v0, keys, speed = null, throttle = () => 0 }) {
  const car = new VehicleController(ROAD_CAR_SPEC);
  car.reset(new Vector3(0, 0, 0), 0, null);
  car.velocity.set(0, 0, -v0);
  const input = new VehicleInput(null, { touch: false, assist });
  const held = new Set();
  const out = [];
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const frames = Math.round(seconds / FRAME);
  for (let f = 0; f < frames; f++) {
    const t = f * FRAME;
    const want = new Set(keys(t));
    for (const k of held) if (!want.has(k)) { press(input, k, false); held.delete(k); }
    for (const k of want) if (!held.has(k)) { press(input, k, true); held.add(k); }
    input.update(FRAME, car);
    controls.steer = input.steer; controls.handbrake = input.handbrake;
    controls.throttle = speed == null ? throttle(t) : Math.max(0, Math.min(1, (speed - car.speed) * 0.5));
    for (let s = 0; s < 2; s++) {
      car.step(DT, controls, null);
      out.push({ t: t + (s + 1) * DT, speed: car.speed, aF: car.slipFront, aR: car.slipRear, latG: Math.abs(car.localAccel.x) / 9.81, beta: sideslip(car), yaw: car.angularVelocity.y });
    }
  }
  return { car, out, input };
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const window_ = (out, t0, t1) => out.filter((o) => o.t >= t0 && o.t < t1);
const peakF = new VehicleController(ROAD_CAR_SPEC).slipPeakFront;

// ---- 0. defaults: off, identical to raw input; the live toggle; pass-through cases -----------------------------------
{
  const a = drive({ assist: undefined, seconds: 3, v0: 30, speed: 30, keys: (t) => (t < 2 ? ['KeyA'] : []) });
  const car = new VehicleController(ROAD_CAR_SPEC); car.reset(new Vector3(), 0, null); car.velocity.set(0, 0, -30);
  const raw = new VehicleInput(null, { touch: false });
  check('default: input.assist exists and is off', raw.assist && raw.assist.enabled === false ? 1 : 0, 1, 1);
  // the same key sequence through update(dt) (no car) and update(dt, car) with the assist off: the same steer
  const r1 = new VehicleInput(null, { touch: false }), r2 = new VehicleInput(null, { touch: false });
  let same = 1;
  press(r1, 'KeyD', true); press(r2, 'KeyD', true);
  for (let i = 0; i < 30; i++) { r1.update(FRAME); r2.update(FRAME, car); if (r1.steer !== r2.steer || r2.steer !== r2.rawSteer) same = 0; }
  check('assist off: update(dt, car) steer === update(dt) steer === rawSteer', same, 1, 1);
  check('assist off: a 3 s drive ran (sanity)', a.out.length, 360, 360);
  // live toggle: at speed with the key held, enabling changes steer, disabling restores the raw value
  for (let i = 0; i < 90; i++) car.step(DT, { throttle: 0.5, steer: -1 }, null); // into a full-lock corner
  const t = new VehicleInput(null, { touch: false });
  press(t, 'KeyA', true);
  for (let i = 0; i < 20; i++) t.update(FRAME, car);
  const off = t.steer;
  t.assist.enabled = true; t.update(FRAME, car); const on = t.steer;
  t.assist.enabled = false; t.update(FRAME, car); const back = t.steer;
  check('toggle: assist.enabled = true changes the steer at 30 m/s', Math.abs(on - off), 0.05, 2);
  check('toggle: assist.enabled = false gives the raw steer back', Math.abs(back - t.rawSteer) + Math.abs(back - off), 0, 0);
  check('opts.assist: true builds it on', new VehicleInput(null, { touch: false, assist: true }).assist.enabled ? 1 : 0, 1, 1);
  check('opts.assist: { peak: 0.9 } builds it on with the option', new VehicleInput(null, { touch: false, assist: { peak: 0.9 } }).assist.peak, 0.9, 0.9);
  const sa = new SteeringAssist();
  check('apply: no car returns the input', sa.apply(FRAME, 0.4, null), 0.4, 0.4);
  check('apply: disabled returns the input', Object.assign(new SteeringAssist({ enabled: false })).apply(FRAME, -0.7, car), -0.7, -0.7);
  check('apply: handbrake held returns the input', sa.apply(FRAME, -0.7, car, false, true), -0.7, -0.7);
  const air = Object.assign(Object.create(car), { grounded: false });
  check('apply: airborne returns the input', sa.apply(FRAME, 0.3, air), 0.3, 0.3);
  const slow = new VehicleController(ROAD_CAR_SPEC); slow.reset(new Vector3(), 0, null); slow.velocity.set(0, 0, -4); slow.step(DT, {}, null);
  check('apply: below fadeSpeed[0] (4 m/s) returns the input', sa.apply(FRAME, 1, slow), 1, 1);
  const rev = new VehicleController(ROAD_CAR_SPEC); rev.reset(new Vector3(), 0, null); rev.velocity.set(0, 0, 10); rev.step(DT, {}, null);
  check('apply: in reverse returns the input', sa.apply(FRAME, -1, rev), -1, -1);
  check('apply: NaN input reads as 0 (self-steer only)', Math.abs(sa.apply(FRAME, NaN, car) - sa.apply(FRAME, 0, car)), 0, 0);
}

// ---- 1. full lock at 30 m/s ---------------------------------------------------------------------------------------
{
  const run = (assist) => drive({ assist, seconds: 6, v0: 30, speed: 30, keys: () => ['KeyA'] });
  const raw = run(false), as = run(true);
  const fr = (r) => window_(r.out, 4, 6).map((o) => o.aF / peakF);
  const latRaw = mean(window_(raw.out, 1, 6).map((o) => o.latG)), latAs = mean(window_(as.out, 1, 6).map((o) => o.latG));
  const latRawBest = Math.max(...raw.out.map((o, i, a) => (i >= 60 ? mean(a.slice(i - 60, i).map((p) => p.latG)) : 0)));
  const fAs = fr(as), fRaw = fr(raw);
  note(`full lock 30 m/s, raw:    front slip / peak 4-6 s mean ${mean(fRaw).toFixed(2)} (range ${Math.min(...fRaw).toFixed(2)} .. ${Math.max(...fRaw).toFixed(2)}), lateral ${latRaw.toFixed(3)} g mean 1-6 s (best 0.5 s ${latRawBest.toFixed(3)} g), max sideslip ${(Math.max(...raw.out.map((o) => Math.abs(o.beta))) * DEG).toFixed(1)} deg, end speed ${raw.car.speed.toFixed(1)} m/s`);
  note(`full lock 30 m/s, assist: front slip / peak 4-6 s mean ${mean(fAs).toFixed(2)} (range ${Math.min(...fAs).toFixed(2)} .. ${Math.max(...fAs).toFixed(2)}), lateral ${latAs.toFixed(3)} g mean 1-6 s, max sideslip ${(Math.max(...as.out.map((o) => Math.abs(o.beta))) * DEG).toFixed(1)} deg, end speed ${as.car.speed.toFixed(1)} m/s`);
  check('lock: assisted front slip settles within 5 % of peak (mean 4-6 s)', mean(fAs), 0.95, 1.05, 'x pk');
  check('lock: assisted front slip stays within 10 % of peak (every step 4-6 s)', Math.max(...fAs.map((x) => Math.abs(x - 1))), 0, 0.1);
  check('lock: assisted lateral grip (mean 1-6 s) >= raw input\'s', latAs - latRaw, 0, Infinity, 'g');
  check('lock: assisted lateral grip >= raw input\'s best 0.5 s', latAs - latRawBest, 0, Infinity, 'g');
  check('lock: assisted max sideslip', Math.max(...as.out.map((o) => Math.abs(o.beta))) * DEG, 0, 15, 'deg');
}

// ---- 2. handbrake slide at 25 m/s ----------------------------------------------------------------------------------
{
  const T = 0.45, END = 4;
  const run = (assist) => drive({ assist, seconds: END, v0: 25, throttle: (t) => (t < T ? 0 : 0.3), keys: (t) => (t < T ? ['KeyA', 'KeyX'] : []) });
  // recovered: from this time on to the end, |sideslip| < 3 deg while still driving (> 10 m/s); END - T if never
  const recovery = (r) => {
    let last = -1;
    for (let i = 0; i < r.out.length; i++) { const o = r.out[i]; if (Math.abs(o.beta) * DEG >= 3 || o.speed < 10) last = i; }
    return last + 1 < r.out.length ? r.out[last + 1].t - T : END - T; // never: the whole run after release
  };
  const raw = run(false), as = run(true);
  const atRel = (r) => r.out.find((o) => o.t >= T);
  const tRaw = recovery(raw), tAs = recovery(as);
  for (const [n, r, tr] of [['raw   ', raw, tRaw], ['assist', as, tAs]]) {
    note(`handbrake 25 m/s, ${n}: sideslip at release ${(atRel(r).beta * DEG).toFixed(1)} deg, max ${(Math.max(...r.out.map((o) => Math.abs(o.beta))) * DEG).toFixed(1)} deg, recovered under 3 deg ${tr < END - T ? tr.toFixed(2) + ' s after release' : 'never (spun)'}, end speed ${r.car.speed.toFixed(1)} m/s`);
  }
  check('handbrake: same slide at release with and without (assist stands back)', Math.abs(atRel(raw).beta - atRel(as).beta) * DEG, 0, 0.5, 'deg');
  check('handbrake: the slide is real (sideslip at release)', Math.abs(atRel(as).beta) * DEG, 10, 90, 'deg');
  check('handbrake: assisted recovers to < 3 deg within 2 s of release', tAs, 0, 2, 's');
  check('handbrake: assisted recovers sooner than raw (raw - assisted; raw never = run length)', tRaw - tAs, 0.25, Infinity, 's');
}

// ---- 3. slalom 8 s at 28 m/s ----------------------------------------------------------------------------------------
for (const per of [0.8, 1.0, 1.4]) {
  const run = (assist) => drive({ assist, seconds: 8, v0: 28, speed: 28, keys: (t) => [Math.floor(t / per) % 2 ? 'KeyD' : 'KeyA'] });
  const raw = run(false), as = run(true);
  const bmax = (r) => Math.max(...r.out.map((o) => Math.abs(o.beta))) * DEG;
  const lat = (r) => mean(r.out.map((o) => o.latG));
  note(`slalom ${per} s, raw:    max sideslip ${bmax(raw).toFixed(1)} deg, mean lateral ${lat(raw).toFixed(2)} g, end speed ${raw.car.speed.toFixed(1)} m/s`);
  note(`slalom ${per} s, assist: max sideslip ${bmax(as).toFixed(1)} deg, mean lateral ${lat(as).toFixed(2)} g, end speed ${as.car.speed.toFixed(1)} m/s`);
  check(`slalom ${per} s: assisted never spins (max sideslip)`, bmax(as), 0, 20, 'deg');
  check(`slalom ${per} s: assisted keeps its speed (end speed)`, as.car.speed, 25, 30, 'm/s');
}

// ---- 4. low-speed turning circle -------------------------------------------------------------------------------------
{
  const R = (assist) => {
    const r = drive({ assist, seconds: 8, v0: 5, speed: 5, keys: () => ['KeyA'] });
    return mean(window_(r.out, 6, 8).map((o) => o.speed / Math.abs(o.yaw)));
  };
  const rRaw = R(false), rAs = R(true);
  note(`turning circle at 5 m/s: raw ${rRaw.toFixed(2)} m, assist ${rAs.toFixed(2)} m`);
  check('5 m/s: turning circle growth with the assist', rAs / rRaw - 1, -0.05, 0.05, 'x');
}

// ---- 5. determinism, allocation -------------------------------------------------------------------------------------
{
  const sig = () => { const r = drive({ assist: true, seconds: 4, v0: 28, speed: 28, keys: (t) => [Math.floor(t / 0.8) % 2 ? 'KeyD' : 'KeyA'] }); const p = r.car.position; return [p.x, p.z, r.car.velocity.x, r.car.quaternion.y, r.input.steer].join(','); };
  check('deterministic: two assisted slaloms end bit-identical', sig() === sig() ? 1 : 0, 1, 1);
  const car = new VehicleController(ROAD_CAR_SPEC); car.reset(new Vector3(), 0, null); car.velocity.set(0, 0, -25);
  for (let i = 0; i < 60; i++) car.step(DT, { throttle: 0.3, steer: -1 }, null);
  const sa = new SteeringAssist();
  const IN = BOXED(-1, -0.5, 0, 0.5, 1); let sink = 0;
  // apply() itself allocates nothing (0 B with its return replaced by `return 0`); the one cost is V8 boxing the
  // returned fraction at a call it does not inline: one 16 B HeapNumber (25.6 B mean measured here, Node 26), short-lived.
  // The budget goes to bytesPerCall too: without it the measurement took 25.6 B as over its default budget of 1 B,
  // retried all 5 windows and kept only the last, so a GC in that one window read NaN and failed the gate.
  const m = bytesPerCall((n) => { for (let i = 0; i < n; i++) sink += sa.apply(FRAME, IN[i % 5], car, (i & 1) === 1); }, 1e4, { budget: 32, force: functionsOf(SteeringAssist) });
  gate(check, note, 'SteeringAssist.apply() x1e4 (the boxed return value only)', m, { budget: 32 });
  if (!ALLOC.ok) note(ALLOC.reason);
  if (!Number.isFinite(sink)) failures++;
}

// ---- 6. VehicleHaptics: output values and what it sends (a fake pad records the effects) ---------------------------
{
  const effects = [];
  const pad = { vibrationActuator: { playEffect: (type, fx) => { effects.push({ type, ...fx }); return Promise.resolve('complete'); } } };
  const h = new VehicleHaptics();
  const car = new VehicleController(ROAD_CAR_SPEC); car.reset(new Vector3(), 0, null);
  for (let i = 0; i < 120; i++) { car.step(DT, {}, null); h.update(DT, car, pad); }
  check('haptics: parked car is silent (weak + strong)', h.weak + h.strong, 0, 0.001);
  check('haptics: nothing sent while silent', effects.length, 0, 0);
  car.velocity.set(0, 0, -25);
  for (let i = 0; i < 120; i++) { car.step(DT, { throttle: 0.3 }, null); h.update(DT, car, pad); }
  const cruise = h.weak;
  check('haptics: straight at 25 m/s: a light road buzz on the weak motor', cruise, 0.01, 0.05);
  check('haptics: ... and nothing on the strong one', h.strong, 0, 0);
  let wMax = 0, sMax = 0;
  for (let i = 0; i < 120; i++) { car.step(DT, { steer: -1, handbrake: true }, null); h.update(DT, car, pad); wMax = Math.max(wMax, h.weak); sMax = Math.max(sMax, h.strong); }
  check('haptics: handbrake slide: weak motor (slide texture)', wMax, 0.3, 0.6);
  check('haptics: handbrake slide: strong motor (locked wheel)', sMax, 0.1, 0.4);
  check('haptics: layered, never past 1', Math.max(...effects.map((e) => Math.max(e.weakMagnitude, e.strongMagnitude))), 0, 1);
  check('haptics: dual-rumble effects sent, all of them', effects.filter((e) => e.type === 'dual-rumble').length, 3, effects.length);
  const sentBefore = effects.length;
  // a 6 m/s landing: a strong kick that rings out over ~0.3 s
  const fake = { grounded: true, speed: 0, slipFront: 0, slipRear: 0, slipPeakFront: 0.2, slipPeakRear: 0.2, wheels: [], landedThisStep: true, landingImpact: 6, impact: 0 };
  h.update(DT, fake, pad); const kick = h.strong;
  fake.landedThisStep = false;
  for (let i = 0; i < 36; i++) h.update(DT, fake, pad);
  check('haptics: 6 m/s landing kicks the strong motor', kick, 0.6, 0.8);
  check('haptics: ... rung out after 0.3 s (fraction left)', h.strong / kick, 0, 0.06);
  for (let i = 0; i < 60; i++) h.update(DT, fake, pad);
  check('haptics: a zero effect is sent when it falls quiet', effects.at(-1).weakMagnitude + effects.at(-1).strongMagnitude, 0, 0);
  check('haptics: not re-sent every frame (sends per frame over the landing)', (effects.length - sentBefore) / 97, 0, 0.5);
  const n = effects.length; h.update(DT, fake, pad); h.update(DT, fake, null); h.update(DT, null, {});
  check('haptics: quiet frames, null car and padless calls send nothing', effects.length - n, 0, 0);
}

console.log(lines.join('\n'));
console.log(failures ? `\n${failures} steering-assist check(s) FAILED` : '\nall steering-assist checks passed');
process.exit(failures ? 1 : 0);
