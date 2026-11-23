// Headless checks for the Miami drive hero car (samples/miami-drive/spec.js) on the engine's VehicleController:
// 0-100 km/h (with its Gearbox's torque cut, as on the page), top speed, braking distance from 100 km/h, a steady-state
// bend that stays on the road, a handbrake turn, a slide that is caught, a ramp jump without NaN, kerb compliance,
// determinism, and the keyboard driver's corner: a steer key held for 4 s at 60, 100 and 140 km/h (the page's 0.2 s
// key ramp, the throttle held or lifted) never spins the car, turns in without a dart, and the lock at speed is about
// the grip limit; a 100 km/h cruise runs in top gear at low revs. Deterministic: fixed 120 Hz steps on synthetic
// worlds, no randomness. Run: node test/miami-car.mjs
import { Vector3 } from 'three';
import { VehicleController, Gearbox } from '@vibe/engine/physics';
import { CAR_SPEC, GEARBOX } from '../samples/miami-drive/spec.js';

const DT = 1 / 120;
let failures = 0;
const lines = [];
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(2).padStart(8) : String(x).padStart(8));
function check(name, v, lo, hi, unit = '') {
  const ok = Number.isFinite(v) && v >= lo && v <= hi;
  if (!ok) failures++;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(70)} ${fmt(v)} ${unit.padEnd(5)} [${lo} .. ${hi}]`);
  return v;
}
const flat = (boxes = [], ground = () => 0) => ({
  getGroundHeight: (x, z) => ground(x, z),
  queryColliders: (x, z, r) => boxes.filter((b) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ),
});
const ctl = (o = {}) => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, thrust: 0, pitch: 0, yaw: 0, ...o });
const newCar = (world, heading = 0, x = 0, z = 0) => { const c = new VehicleController(CAR_SPEC); c.reset(new Vector3(x, 0, z), heading, world); return c; };
const sane = (c) => [c.position.x, c.position.y, c.position.z, c.velocity.x, c.velocity.y, c.velocity.z, c.quaternion.w].every(Number.isFinite);
const kmh = (ms) => ms * 3.6;

// 1. 0-100 km/h
const world = flat();
{
  const c = newCar(world), gb = new Gearbox(GEARBOX);
  let t = NaN;
  for (let i = 0; i < 20 * 120; i++) {
    c.step(DT, ctl({ throttle: 1 - gb.cut }), world); gb.update(DT, c, 1);
    if (c.forwardSpeed >= 100 / 3.6) { t = (i + 1) * DT; break; }
  }
  check('0-100 km/h (torque cut at the upshifts)', t, 4.6, 6.6, 's');
}
// 2. top speed (60 s flat out)
{
  const c = newCar(world);
  for (let i = 0; i < 60 * 120; i++) c.step(DT, ctl({ throttle: 1 }), world);
  check('top speed', kmh(c.forwardSpeed), 230, 262, 'km/h');
}
// 3. braking 100-0
{
  const c = newCar(world);
  for (let i = 0; i < 30 * 120 && c.forwardSpeed < 100 / 3.6; i++) c.step(DT, ctl({ throttle: 1 }), world);
  const z0 = c.position.z; let pitchMax = 0;
  for (let i = 0; i < 10 * 120 && c.forwardSpeed > 0.05; i++) {
    c.step(DT, ctl({ brake: 1 }), world);
    pitchMax = Math.max(pitchMax, -c.wheels[0].y + c.wheels[2].y);
  }
  check('braking distance 100-0 km/h', Math.abs(c.position.z - z0), 32, 42, 'm');
  check('nose dive under braking (front vs rear wheel y)', pitchMax * 100, 2, 16, 'cm');
}
// 4. steady-state cornering: a 60 m radius bend at 80 km/h with a simple pilot; the car stays within 1.5 m of the line
{
  const R = 60, V = 80 / 3.6;
  const c = newCar(world, 0, R, 0); // circle centred at the origin, counter-clockwise (left turn), start heading -Z
  let maxErr = 0, rollMax = 0;
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  for (let i = 0; i < 25 * 120; i++) {
    const p = c.position, r = Math.hypot(p.x, p.z), lat = r - R;
    // pure pursuit: aim at the point of the circle 14 m ahead (counter-clockwise seen from above = a left turn)
    const ang = Math.atan2(p.z, p.x) - 14 / R;
    const lx = R * Math.cos(ang), lz = R * Math.sin(ang);
    const err = wrap(Math.atan2(-(lx - p.x), -(lz - p.z)) - c.heading); // > 0: the target is to the left
    const spd = c.forwardSpeed;
    c.step(DT, ctl({ throttle: spd < V ? Math.min(1, (V - spd) * 0.5) : 0, brake: spd > V + 1 ? 0.2 : 0, steer: Math.max(-1, Math.min(1, -err * 4)) }), world);
    if (i > 10 * 120) { maxErr = Math.max(maxErr, Math.abs(lat)); rollMax = Math.max(rollMax, Math.abs(c.wheels[0].y - c.wheels[1].y)); }
  }
  check('60 m bend at 80 km/h: speed held', kmh(c.forwardSpeed), 74, 86, 'km/h');
  check('60 m bend at 80 km/h: max off-line', maxErr, 0, 1.5, 'm');
  check('body roll (left vs right front wheel y)', rollMax * 100, 1, 14, 'cm');
}
// 5. handbrake turn at 60 km/h: yaws > 90 deg within 2 s
{
  const c = newCar(world);
  for (let i = 0; i < 20 * 120 && c.forwardSpeed < 60 / 3.6; i++) c.step(DT, ctl({ throttle: 1 }), world);
  const h0 = c.heading; let slipMax = 0;
  for (let i = 0; i < 2 * 120; i++) { c.step(DT, ctl({ steer: -1, handbrake: i < 90 }), world); slipMax = Math.max(slipMax, c.wheelSlip); }
  let d = c.heading - h0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  check('handbrake turn from 60 km/h: yaw in 2 s', Math.abs(d) * 180 / Math.PI, 90, 220, 'deg');
  check('handbrake turn: tyre slip reported', slipMax, 0.4, 1, '');
}
// 6. a power slide is catchable: full throttle + full lock at 50 km/h for 1 s, then counter-steer, off throttle: the
//    yaw rate settles and the car keeps going (no spin to a stop)
{
  const c = newCar(world);
  for (let i = 0; i < 20 * 120 && c.forwardSpeed < 50 / 3.6; i++) c.step(DT, ctl({ throttle: 1 }), world);
  let slipMax = 0;
  for (let i = 0; i < 120; i++) { c.step(DT, ctl({ throttle: 1, steer: 1 }), world); slipMax = Math.max(slipMax, c.wheelSlip); }
  for (let i = 0; i < 3 * 120; i++) c.step(DT, ctl({ throttle: 0.2, steer: 0.8 * Math.sign(c.angularVelocity.y) * Math.min(1, Math.abs(c.angularVelocity.y)) }), world);
  check('power slide: slip builds', slipMax, 0.2, 1, '');
  check('slide caught: yaw rate after 3 s', Math.abs(c.angularVelocity.y), 0, 0.15, 'rad/s');
  check('slide caught: still moving', kmh(c.speed), 15, 120, 'km/h');
}
// 7. ramp jump: a 1.2 m wedge over 8 m taken at 90 km/h; airborne, lands, no NaN, upright
{
  const ramp = (x, z) => (z < -40 && z > -48 ? Math.min(1.2, (-40 - z) * 0.15) : 0);
  const w = flat([], ramp);
  const c = newCar(w, 0, 0, 40);
  let air = 0, landing = 0, ok = true;
  for (let i = 0; i < 12 * 120; i++) {
    const v = c.forwardSpeed;
    c.step(DT, ctl({ throttle: v < 25 ? 1 : 0 }), w);
    if (!c.grounded) air += DT;
    if (c.landedThisStep) landing = Math.max(landing, c.landingImpact);
    if (!sane(c)) { ok = false; break; }
  }
  check('jump: no NaN', ok ? 1 : 0, 1, 1);
  check('jump: airtime', air, 0.25, 3, 's');
  check('jump: upright after landing (body up y)', 1 - 2 * (c.quaternion.x ** 2 + c.quaternion.z ** 2), 0.97, 1.0001);
  void landing;
}
// 8. kerb: a 0.15 m sidewalk step taken at 30 km/h is climbed (no wall hit) and bumps the body
{
  const kerb = { minX: -20, maxX: 20, minY: -1, maxY: 0.15, minZ: -60, maxZ: -20, kind: 'static' };
  const w = flat([kerb]);
  const c = newCar(w, 0, 0, 0);
  let impact = 0, yMax = 0;
  for (let i = 0; i < 6 * 120; i++) {
    c.step(DT, ctl({ throttle: c.forwardSpeed < 30 / 3.6 ? 0.6 : 0 }), w);
    impact = Math.max(impact, c.impact); yMax = Math.max(yMax, c.position.y);
  }
  check('kerb 15 cm at 30 km/h: climbed (on top)', c.position.y, 0.1, 0.3, 'm');
  check('kerb: still moving after it', kmh(c.speed), 15, 40, 'km/h');
}
// 9. determinism: two identical runs produce identical state
{
  const run = () => { const c = newCar(world); for (let i = 0; i < 1200; i++) c.step(DT, ctl({ throttle: 1, steer: Math.sin(i * 0.01) }), world); return [c.position.x, c.position.z, c.velocity.x, c.heading].join(','); };
  check('determinism (two runs equal)', run() === run() ? 1 : 0, 1, 1);
}

// 10. a steer key held through a corner (the page's 0.2 s key ramp): no spin with the throttle held or lifted, a turn-in
//     without a dart (peak yaw rate over the settled one), the lock at speed about the grip limit
for (const kmh of [60, 100, 140]) {
  for (const hold of [true, false]) {
    const c = newCar(world);
    for (let i = 0; i < 30 * 120 && c.forwardSpeed < kmh / 3.6; i++) c.step(DT, ctl({ throttle: 1 }), world);
    let s = 0, beta = 0, peak = 0; const yaw = [];
    for (let i = 0; i < 4 * 120; i++) {
      s = Math.min(1, s + DT / 0.2);
      c.step(DT, ctl({ steer: -s, throttle: hold ? Math.max(0, Math.min(1, (kmh / 3.6 - c.forwardSpeed) * 0.4)) : 0 }), world);
      const q = c.quaternion, rx = 1 - 2 * (q.y * q.y + q.z * q.z), rz = 2 * (q.x * q.z - q.w * q.y);
      beta = Math.max(beta, Math.abs(Math.atan2(c.velocity.x * rx + c.velocity.z * rz, Math.max(1, Math.abs(c.forwardSpeed)))));
      peak = Math.max(peak, c.angularVelocity.y); yaw.push(c.angularVelocity.y);
    }
    check(`key held 4 s at ${kmh} km/h, throttle ${hold ? 'held' : 'lifted'}: max sideslip (no spin)`, beta * 180 / Math.PI, 0, 15, 'deg');
    if (hold && kmh === 140) check('turn-in at 140 km/h: peak / settled yaw rate (no dart)', peak / (yaw.slice(-120).reduce((a, b) => a + b, 0) / 120), 1, 1.7);
  }
}
{
  const c = newCar(world);
  for (let i = 0; i < 30 * 120 && c.forwardSpeed < 100 / 3.6; i++) c.step(DT, ctl({ throttle: 1 }), world);
  c.step(DT, ctl({ steer: 1 }), world);
  check('full lock at 100 km/h', c.steerLimit * 180 / Math.PI, 2.5, 4.5, 'deg');
}
// 11. the gearbox: a 100 km/h cruise in top gear at low revs
{
  const c = newCar(world), gb = new Gearbox(GEARBOX);
  for (let i = 0; i < 40 * 120; i++) {
    const thr = i < 8 * 120 ? 1 : Math.max(0, Math.min(1, 0.2 + (100 / 3.6 - c.forwardSpeed) * 0.3));
    c.step(DT, ctl({ throttle: thr * (1 - gb.cut) }), world); gb.update(DT, c, thr);
  }
  check('cruise 100 km/h: top gear', gb.gear, GEARBOX.ratios.length, GEARBOX.ratios.length);
  check('cruise 100 km/h: revs', gb.rpm, 1500, 2200, 'rpm');
}

console.log('Miami drive hero car (samples/miami-drive/spec.js)');
for (const l of lines) console.log(l);
console.log(failures ? `${failures} FAILED` : `all ${lines.length} checks passed`);
process.exit(failures ? 1 : 0);
