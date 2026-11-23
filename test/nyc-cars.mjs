// Headless checks for the Night NYC drive's cars (samples/nyc-night/cars.js) on the engine's VehicleController: per car
// 0-100 km/h and top speed in its class, braking from 100 km/h, a city corner (a 25 m radius at 45 km/h, a junction
// turn) held on the line, a steer key held at 60, 100 and 140 km/h without a spin, the gearbox (every gear used, a cruise in top gear), and the order slow to fast (the interceptor clearly quicker than the cab). Fixed 120 Hz
// steps on a flat synthetic world, no randomness. Run: node test/nyc-cars.mjs
import { Vector3 } from 'three';
import { VehicleController, Gearbox } from '@vibe/engine/physics';
import { CARS, carSpec } from '../samples/nyc-night/cars.js';

const DT = 1 / 120;
let failures = 0;
const lines = [];
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(2).padStart(8) : String(x).padStart(8));
function check(name, v, lo, hi, unit = '') {
  const ok = Number.isFinite(v) && v >= lo && v <= hi;
  if (!ok) failures++;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${fmt(v)} ${unit.padEnd(5)} [${lo} .. ${hi}]`);
  return v;
}
const world = { getGroundHeight: () => 0, queryColliders: () => [] };
const ctl = (o = {}) => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...o });
const kmh = (ms) => ms * 3.6;
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
const newCar = (spec, x = 0) => { const c = new VehicleController(spec); c.reset(new Vector3(x, 0, 0), 0, world); return c; };

// per class: [0-100 s], [top km/h], [100-0 m]
const CLASS = {
  taxi: { t100: [11, 16], top: [150, 170], brake: [42, 56] },
  sedan: { t100: [7, 10], top: [190, 212], brake: [36, 46] },
  interceptor: { t100: [4, 6], top: [235, 265], brake: [30, 40] },
};
const got = {};
for (const car of CARS) {
  const spec = carSpec(car), K = CLASS[car.id], g = got[car.id] = {};
  if (!K) { check(`${car.id}: has a class in this test`, 0, 1, 1); continue; }
  { // 0-100 km/h
    const c = newCar(spec);
    let t = NaN;
    for (let i = 0; i < 30 * 120; i++) { c.step(DT, ctl({ throttle: 1 }), world); if (c.forwardSpeed >= 100 / 3.6) { t = (i + 1) * DT; break; } }
    g.t100 = check(`${car.id}: 0-100 km/h`, t, ...K.t100, 's');
  }
  { // top speed: 70 s flat out
    const c = newCar(spec);
    for (let i = 0; i < 70 * 120; i++) c.step(DT, ctl({ throttle: 1 }), world);
    g.top = check(`${car.id}: top speed`, kmh(c.forwardSpeed), ...K.top, 'km/h');
  }
  { // braking 100-0
    const c = newCar(spec);
    for (let i = 0; i < 30 * 120 && c.forwardSpeed < 100 / 3.6; i++) c.step(DT, ctl({ throttle: 1 }), world);
    const z0 = c.position.z;
    for (let i = 0; i < 10 * 120 && c.forwardSpeed > 0.05; i++) c.step(DT, ctl({ brake: 1 }), world);
    check(`${car.id}: braking distance 100-0 km/h`, Math.abs(c.position.z - z0), ...K.brake, 'm');
  }
  { // a city corner: 25 m radius at 45 km/h (0.64 g), a pure-pursuit pilot; stays within 1 m of the line
    const R = 25, V = 45 / 3.6;
    const c = newCar(spec, R); // circle about the origin, counter-clockwise (a left turn), start heading -Z
    let maxErr = 0, vMin = Infinity;
    for (let i = 0; i < 12 * 120; i++) {
      const p = c.position, lat = Math.hypot(p.x, p.z) - R;
      const ang = Math.atan2(p.z, p.x) - 8 / R, lx = R * Math.cos(ang), lz = R * Math.sin(ang);
      const err = wrap(Math.atan2(-(lx - p.x), -(lz - p.z)) - c.heading);
      const spd = c.forwardSpeed;
      c.step(DT, ctl({ throttle: spd < V ? Math.min(1, (V - spd) * 0.5) : 0, brake: spd > V + 1 ? 0.2 : 0, steer: Math.max(-1, Math.min(1, -err * 4)) }), world);
      if (i > 5 * 120) { maxErr = Math.max(maxErr, Math.abs(lat)); vMin = Math.min(vMin, kmh(c.forwardSpeed)); }
    }
    check(`${car.id}: 25 m corner at 45 km/h, max off the line`, maxErr, 0, 1, 'm');
    check(`${car.id}: 25 m corner at 45 km/h, slowest speed`, vMin, 40, 50, 'km/h');
  }
  { // the gearbox: a flat-out run uses every gear, a 100 km/h cruise sits in top gear at low revs
    const c = newCar(spec), gb = new Gearbox(car.gearbox), n = car.gearbox.ratios.length;
    let top = 0;
    for (let i = 0; i < 40 * 120; i++) { c.step(DT, ctl({ throttle: 1 - gb.cut }), world); gb.update(DT, c, 1); top = Math.max(top, gb.gear); }
    check(`${car.id}: gears used flat out (of ${n})`, top, n, n);
    const d = newCar(spec), gd = new Gearbox(car.gearbox);
    for (let i = 0; i < 30 * 120; i++) { const t = Math.max(0, Math.min(1, (100 / 3.6 - d.forwardSpeed) * 0.3)); d.step(DT, ctl({ throttle: t }), world); gd.update(DT, d, t); }
    check(`${car.id}: 100 km/h cruise: gear / revs`, gd.gear === n ? gd.rpm : NaN, 1500, 3600, 'rpm');
  }
  // a steer key held for 4 s at 60, 100 and 140 km/h (the 0.2 s key ramp; the throttle held to the speed or lifted):
  // the car turns and never spins (the slide angle stays small)
  for (const kmh of [60, 100, 140]) for (const hold of [true, false]) {
    const c = newCar(spec);
    for (let i = 0; i < 30 * 120 && c.forwardSpeed < kmh / 3.6; i++) c.step(DT, ctl({ throttle: 1 }), world);
    let s = 0, beta = 0;
    for (let i = 0; i < 4 * 120; i++) {
      s = Math.min(1, s + DT / 0.2);
      c.step(DT, ctl({ steer: -s, throttle: hold ? Math.max(0, Math.min(1, (kmh / 3.6 - c.forwardSpeed) * 0.4)) : 0 }), world);
      const q = c.quaternion, rx = 1 - 2 * (q.y * q.y + q.z * q.z), rz = 2 * (q.x * q.z - q.w * q.y);
      beta = Math.max(beta, Math.abs(Math.atan2(c.velocity.x * rx + c.velocity.z * rz, Math.max(1, Math.abs(c.forwardSpeed)))));
    }
    check(`${car.id}: key held 4 s at ${kmh} km/h, throttle ${hold ? 'held' : 'lifted'}: max slide`, beta * 180 / Math.PI, 0, 15, 'deg');
  }
}
// slow to fast
if (got.taxi && got.interceptor && got.sedan) {
  check('interceptor 0-100 at most 0.5x the cab\'s', got.interceptor.t100 / got.taxi.t100, 0, 0.5);
  check('top speed: interceptor - cab', got.interceptor.top - got.taxi.top, 60, 120, 'km/h');
  check('sedan between them (0-100)', got.sedan.t100 > got.interceptor.t100 && got.sedan.t100 < got.taxi.t100 ? 1 : 0, 1, 1);
}

console.log('Night NYC drive cars (samples/nyc-night/cars.js)');
for (const l of lines) console.log(l);
console.log(failures ? `${failures} FAILED` : `all ${lines.length} checks passed`);
process.exit(failures ? 1 : 0);
