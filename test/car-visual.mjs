// Headless checks for createCarVisual (src/world/CarVisual.js): every HD type builds, faces -Z like the controller, its
// spec puts the controller's wheels under the visual's hubs (within 1 cm), the reverse lamps are found, and a 10 s
// drive on VehicleController(visual.spec) stays stable with the wheels, lamps and contact shadow following it.
// Run: node test/car-visual.mjs
import * as THREE from 'three';
import { createCarVisual, carSpecFor } from '../src/world/CarVisual.js';
import { VEHICLE_HD_TYPES, VEHICLE_SPECS } from '../src/world/Vehicles.js';
import { VehicleController, ROAD_CAR_SPEC } from '../src/physics/VehicleController.js';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.js';

let failures = 0;
const results = [];
function check(name, value, lo, hi, unit = '') {
  const ok = Number.isFinite(value) && value >= lo && value <= hi;
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(66)} ${fmt(value)} ${unit}   [${lo} .. ${hi}]`);
  return ok;
}
const fmt = (x) => (Number.isFinite(x) ? (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : x.toFixed(4)).padStart(10) : String(x).padStart(10));
const FIX = 1 / 120;

// the hatchback spec against ROAD_CAR_SPEC (the reference the resize starts from)
{
  const s = carSpecFor('hatchback');
  check('hatchback spec: mass close to ROAD_CAR_SPEC (similar body)', s.mass, ROAD_CAR_SPEC.mass * 0.95, ROAD_CAR_SPEC.mass * 1.05, 'kg');
  check('hatchback spec: wheelbase = the body\'s (2.63 m)', s.axleRear - s.axleFront, 2.629, 2.631, 'm');
  check('hatchback spec: motor power unchanged', s.motorPower, ROAD_CAR_SPEC.motorPower, ROAD_CAR_SPEC.motorPower, 'W');
}

for (const type of VEHICLE_HD_TYPES) {
  const t0 = performance.now();
  const vis = createCarVisual(type, { color: 0x2c5ca8 });
  const ms = performance.now() - t0;
  const V = VEHICLE_SPECS[type];
  check(`${type}: builds (ms)`, ms, 0, 400, 'ms');
  let tris = 0, bad = 0;
  vis.root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, p = g.attributes.position.array;
    tris += g.index ? g.index.count / 3 : p.length / 9;
    for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) bad++;
  });
  check(`${type}: triangles`, tris, 20000, 80000);
  check(`${type}: non-finite positions`, bad, 0, 0);
  check(`${type}: four wheel hubs`, vis.wheels.length, 4, 4);

  // facing: head lamps (aLamp ~1) at the front (-Z), tail lamps (~2) at the back (+Z)
  {
    const g = vis.body.geometry, P = g.attributes.position.array, U = g.attributes.aUvT.array;
    let hz = 0, hn = 0, tz = 0, tn = 0;
    for (let i = 0; i < P.length / 3; i++) { const l = U[i * 4 + 3]; if (l > 0.5 && l < 1.5) { hz += P[i * 3 + 2]; hn++; } else if (l > 1.5 && l < 2.5) { tz += P[i * 3 + 2]; tn++; } }
    check(`${type}: head lamps at the front (mean z, -Z forward)`, hz / hn, -V.L / 2, -V.L / 4, 'm');
    check(`${type}: tail lamps at the back (mean z)`, tz / tn, V.L / 4, V.L / 2, 'm');
  }

  // the controller from visual.spec: contact points under the hubs (within 1 cm), wheel radius = hub height
  const car = new VehicleController(vis.spec);
  car.reset(new THREE.Vector3(0, 0, 0), 0, null);
  vis.update(1 / 60, car);
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    const w = car.wheels[i], hub = vis.wheels[i].position;
    worst = Math.max(worst, Math.hypot(hub.x - w.x, hub.y - (vis.spec.wheelRadius + w.y), hub.z - w.z));
  }
  check(`${type}: hub vs controller wheel (contact + radius), worst`, worst, 0, 0.01, 'm');
  check(`${type}: wheel radius = the body's tyre`, Math.abs(vis.spec.wheelRadius - V.wheelR), 0, 1e-9, 'm');
  check(`${type}: reverse lamps found`, vis.reverseLamps.length, type === 'pickup' ? 0 : 2, 2);

  // 10 s drive: accelerate, weave, brake hard, reverse, on a world with a kerb box; the visual follows each frame
  const physics = new PhysicsWorld();
  physics.addStaticBox({ center: [0, 0.06, -40], size: [6, 0.12, 2], kind: 'kerb' });
  car.reset(new THREE.Vector3(0, 0, 0), 0, physics);
  const c = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  let nan = 0, minUp = 1, maxBrake = 0, brakeWhileBraking = 1, maxRev = 0, revWhileFwd = 0, maxDy = 0, minZ = 0, maxSpin = 0, maxSteer = 0, shadowY = 0;
  const up = new THREE.Vector3();
  for (let f = 0; f < 600; f++) {
    const t = f / 60;
    c.throttle = t < 4 ? 1 : 0; c.brake = t >= 4 && t < 7 ? 1 : t >= 7.5 ? 1 : 0; c.steer = t > 1 && t < 3 ? 0.5 * Math.sin(t * 3) : 0;
    for (let k = 0; k < 2; k++) car.step(FIX, c, physics);
    vis.root.position.copy(car.position); vis.root.quaternion.copy(car.quaternion);
    vis.update(1 / 60, car, { darkness: 0.5 });
    vis.root.updateMatrixWorld(true);
    for (const v of [car.position.x, car.position.y, car.position.z, vis.wheels[0].position.y, vis.lamps.brake, vis.shadow.matrixWorld.elements[13]]) if (!Number.isFinite(v)) nan++;
    minUp = Math.min(minUp, up.set(0, 1, 0).applyQuaternion(car.quaternion).y);
    maxDy = Math.max(maxDy, Math.abs(car.position.y));
    minZ = Math.min(minZ, car.position.z);
    maxSpin = Math.max(maxSpin, Math.abs(vis.spinners[2].rotation.x));
    maxSteer = Math.max(maxSteer, Math.abs(vis.wheels[0].rotation.y));
    if (car.braking && t > 4.2 && t < 6.5) brakeWhileBraking = Math.min(brakeWhileBraking, vis.lamps.brake);
    maxBrake = Math.max(maxBrake, vis.lamps.brake);
    if (car.reversing) maxRev = Math.max(maxRev, vis.lamps.reverse);
    if (t < 3.9) revWhileFwd = Math.max(revWhileFwd, vis.lamps.reverse + (vis.reverseLamps.some((q) => q.visible) ? 1 : 0));
    if (t > 3 && t < 3.5) shadowY = Math.max(shadowY, Math.abs(new THREE.Vector3().setFromMatrixPosition(vis.shadow.matrixWorld).y - 0.012));
  }
  check(`${type}: 10 s drive, non-finite values`, nan, 0, 0);
  check(`${type}: 10 s drive, lowest body up.y (stays upright)`, minUp, 0.9, 1);
  check(`${type}: 10 s drive, largest |position.y| (on the ground, kerb included)`, maxDy, 0, 0.3, 'm');
  check(`${type}: drove forward along -Z (furthest z)`, minZ, -400, -20, 'm');
  check(`${type}: rear wheels rolled (|rotation.x|)`, maxSpin, 10, Infinity, 'rad');
  check(`${type}: front wheels steered (|rotation.y|)`, maxSteer, 0.02, 0.7, 'rad');
  check(`${type}: brake lamps at full while braking`, brakeWhileBraking, 0.99, 1);
  check(`${type}: no reverse lamp while driving forward`, revWhileFwd, 0, 0);
  if (vis.reverseLamps.length) check(`${type}: reverse lamps lit while reversing`, maxRev, 0.99, 1);
  check(`${type}: contact shadow stays on the ground under load (|y - 0.012|)`, shadowY, 0, 0.03, 'm');
  vis.dispose();
}

// lamps: headlamps off by day, on at night; forced on / off
{
  const vis = createCarVisual('sedan');
  vis.update(1 / 60, null, { darkness: 0.05 });
  check('lamps: uDark at golden hour (darkness 0.05)', vis.lamps.uDark, 0, 0);
  vis.update(1 / 60, null, { darkness: 0.9 });
  check('lamps: uDark at night (darkness 0.9)', vis.lamps.uDark, 1, 1);
  check('lamps: every material gets it', vis.materials.glass.userData.u.uDark.value + vis.materials.plain.userData.u.uDark.value, 2, 2);
  vis.update(1 / 60, null, { darkness: 0.9, lights: false });
  check('lamps: lights: false', vis.lamps.uDark, 0, 0);
  vis.update(1 / 60, null, { darkness: 0, lights: true });
  check('lamps: lights: true by day', vis.lamps.uDark, 0.35, 0.35);
  for (let i = 0; i < 30; i++) vis.update(1 / 60, null, { brake: 1 });
  check('lamps: opts.brake 1 (no car)', vis.body.geometry.attributes.aBrake.array[0], 1, 1);
  vis.dispose();
}

// contact shadow: fades as the car leaves the ground, back when it lands
{
  const vis = createCarVisual('hatchback'), car = new VehicleController(vis.spec), physics = new PhysicsWorld();
  car.reset(new THREE.Vector3(0, 0, 0), 0, physics);
  car.velocity.set(0, 6, -10);
  let minOp = 1, maxGap = 0, landed = 0;
  for (let f = 0; f < 240; f++) {
    for (let k = 0; k < 2; k++) car.step(FIX, {}, physics);
    vis.update(1 / 60, car);
    minOp = Math.min(minOp, vis.shadow.visible ? vis.shadow.material.opacity : 0);
    maxGap = Math.max(maxGap, car.wheelGaps[0]);
    landed = vis.shadow.material.opacity;
  }
  check('shadow: wheel gap in a 6 m/s hop', maxGap, 0.5, 3, 'm');
  check('shadow: faded at the top of the hop (opacity)', minOp, 0, 0.4);
  check('shadow: back after landing (opacity)', landed, 0.74, 0.76);
  vis.dispose();
}

{
  let threw = false;
  try { createCarVisual('bus'); } catch { threw = true; }
  check('a type without an HD build throws (bus)', threw ? 1 : 0, 1, 1);
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : `\nall ${results.length} checks passed`);
process.exit(failures ? 1 : 0);
