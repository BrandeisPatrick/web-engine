// Gearbox (physics/Gearbox.js) on the hatchback a starter drives (createCarVisual('hatchback').spec, the default
// gearbox): a full-throttle run shifts up through the gears with a torque cut and a rev drop at each upshift and never
// shifts back while the pedal stays down; the launch revs rise with the speed (no flat drone); a cruise at 100 km/h runs
// in top gear at low revs; braking to a stop shifts down one gear at a time to first, never under idle; the revs stay
// within idle .. redline; deterministic. Run: node test/gearbox.mjs
import { Vector3 } from 'three';
import { VehicleController, Gearbox, GEARBOX_DEFAULTS, ROAD_CAR_SPEC } from '@vibe/engine/physics';

const DT = 1 / 120, FRAME = 1 / 60;
let failures = 0;
const check = (name, v, lo, hi, unit = '') => {
  const ok = Number.isFinite(v) && v >= lo && v <= hi;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${Number.isFinite(v) ? v.toFixed(2).padStart(8) : v} ${unit.padEnd(5)} [${lo} .. ${hi}]`);
};
const world = { getGroundHeight: () => 0, queryColliders: () => [] };
const O = GEARBOX_DEFAULTS;

// drive the car by frames (two physics steps each) with the torque cut applied, as the starter does
function drive(seconds, pedal, car, gb, onFrame) {
  for (let t = 0; t < seconds; t += FRAME) {
    const p = pedal(t, car);
    for (let k = 0; k < 2; k++) car.step(DT, { throttle: p.throttle * (1 - gb.cut), brake: p.brake || 0, steer: 0, handbrake: false }, world);
    gb.update(FRAME, car, p.throttle);
    onFrame && onFrame(t, gb, car);
  }
}
const newCar = () => { const c = new VehicleController(ROAD_CAR_SPEC); c.reset(new Vector3(), 0, world); return c; };

// 1. full throttle from rest for 16 s
{
  const car = newCar(), gb = new Gearbox();
  const ups = [], drops = [], cuts = []; let downs = 0, lo = Infinity, hi = 0, launch = [];
  drive(16, () => ({ throttle: 1 }), car, gb, (t, g) => {
    if (g.shifted > 0) { ups.push(t); drops.push(g.rpm); }
    if (g.shifted < 0) downs++;
    if (g.cut > 0) cuts.push(t);
    lo = Math.min(lo, g.rpm); hi = Math.max(hi, g.rpm);
    if (t > 0.2 && t < 1.4) launch.push(g.rpm);
  });
  check('full throttle: upshifts in 16 s', ups.length, 3, 4);
  check('full throttle: no downshift while the pedal is down', downs, 0, 0);
  check('torque cut frames per upshift (60 Hz)', cuts.length / Math.max(1, ups.length), 5, 9);
  check('launch: revs rise while the clutch slips (0.2 .. 1.4 s)', launch[launch.length - 1] - launch[0], 300, 3000, 'rpm');
  check('revs never past redline', hi, 0, O.redline);
  check('revs never under idle', lo, O.idle, O.redline);
  // the rev drop at an upshift: 0.2 s after the shift the revs sit at least 20 % under the shift point
  const c2 = newCar(), g2 = new Gearbox(); let before = 0, after = 0, tUp = -1;
  drive(6, () => ({ throttle: 1 }), c2, g2, (t, g) => { if (tUp < 0 && g.shifted > 0) { tUp = t; before = O.upshift; } if (tUp > 0 && Math.abs(t - tUp - 0.2) < FRAME / 2) after = g.rpm; });
  check('first upshift: revs 0.2 s later vs the shift point', after / before, 0.45, 0.8);
}
// 2. cruise at 100 km/h: top gear, low revs
{
  const car = newCar(), gb = new Gearbox();
  drive(40, (t, c) => ({ throttle: t < 12 ? 1 : Math.max(0, Math.min(1, 0.2 + (100 / 3.6 - c.forwardSpeed) * 0.3)) }), car, gb);
  check('cruise 100 km/h: speed', car.forwardSpeed * 3.6, 95, 105, 'km/h');
  check('cruise 100 km/h: top gear', gb.gear, gb.ratios.length, gb.ratios.length);
  check('cruise 100 km/h: revs', gb.rpm, 2000, 3300, 'rpm');
  // 3. brake to a stop: down one gear at a time to first
  const seq = [gb.gear];
  drive(8, (t, c) => ({ throttle: 0, brake: c.forwardSpeed > 0.3 ? 0.6 : 0 }), car, gb, (t, g) => { if (g.shifted) seq.push(g.gear); });
  check('braking to a stop: ends in first', gb.gear, 1, 1);
  check('braking: each shift is one gear down', seq.every((g, i) => i === 0 || g === seq[i - 1] - 1) ? 1 : 0, 1, 1);
  check('stopped: idle revs', gb.rpm, O.idle, O.idle + 50, 'rpm');
}
// 4. determinism
{
  const run = () => { const c = newCar(), g = new Gearbox(); drive(10, (t) => ({ throttle: t % 3 < 2 ? 1 : 0 }), c, g); return `${g.gear},${g.rpm},${c.position.z}`; };
  check('determinism (two runs equal)', run() === run() ? 1 : 0, 1, 1);
}
console.log(failures ? `${failures} FAILED` : 'all gearbox checks passed');
process.exit(failures ? 1 : 0);
