// Headless checks for the reactive camera options (ChaseRig feel: 'road', rig.addTrauma, landingDip / sprintFov on the
// character rigs): no browser, no DOM element.
//   1. With the new options off, every rig gives the same poses as before they existed: the scenarios below were run on
//      main's rigs and their poses saved in test/camera-feel-ref.json (`node test/camera-feel.mjs --record` rewrites it;
//      only do that on purpose, from code whose poses you mean to keep).
//   2. Road feel: 1 g braking shortens the boom 0.2 to 0.5 m, the corner sway goes to the outside, the follow yaw lags
//      the car by at most 0.35 rad, the camera never ends inside a collider, and 30, 60 and 120 Hz agree within 2 cm.
//   3. Trauma: shake is trauma squared, decays at 1.7 per second, rotates only, and is gone afterwards.
//   4. Landing dip and sprint FOV on ThirdPersonRig / FirstPersonRig.
// Run: node test/camera-feel.mjs
import fs from 'node:fs';
import { PerspectiveCamera, Object3D, Vector3, Quaternion } from 'three';
import { ChaseRig } from '../src/camera/ChaseRig.js';
import { ThirdPersonRig } from '../src/camera/ThirdPersonRig.js';
import { FirstPersonRig } from '../src/camera/FirstPersonRig.js';
import { OrbitRig } from '../src/camera/OrbitRig.js';
import { FreeFlyRig } from '../src/camera/FreeFlyRig.js';
import { VehicleController, ROAD_CAR_SPEC } from '../src/physics/VehicleController.js';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.js';

const REF = new URL('./camera-feel-ref.json', import.meta.url);
const RECORD = process.argv.includes('--record');
let failures = 0;
const results = [];
function check(name, value, lo, hi, unit = '') {
  const ok = Number.isFinite(value) && value >= lo && value <= hi;
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(64)} ${fmt(value)} ${unit}   [${lo} .. ${hi}]`);
  return ok;
}
const fmt = (x) => (Number.isFinite(x) ? (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : x.toFixed(4)).padStart(10) : String(x).padStart(10));
const camera = () => new PerspectiveCamera(60, 16 / 9, 0.1, 1000);
const pose = (cam) => [cam.position.x, cam.position.y, cam.position.z, cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w, cam.fov];

// ---------------------------------------------------------------- scenarios (shared by the reference and the checks)
/** A street: flat ground, a wall on the right, a post row on the left, a low barrier across the road far ahead. */
function street() {
  const physics = new PhysicsWorld();
  physics.addStaticBox({ center: [6, 1.5, -60], size: [0.5, 3, 120], kind: 'wall' });
  for (let z = 0; z > -160; z -= 12) physics.addStaticBox({ center: [-5, 0.6, z], size: [0.3, 1.2, 0.3], kind: 'post' });
  physics.addStaticBox({ center: [0, 0.5, -200], size: [12, 1, 1], kind: 'barrier' });
  return physics;
}
/** Scripted controls: accelerate, weave, hard brake, a left turn, a right turn toward the wall, a stop. */
function controls(t, c) {
  c.throttle = t < 4 ? 1 : t < 5.5 ? 0 : t < 8 ? 0.6 : 0.3;
  c.brake = t >= 4 && t < 5.5 ? 1 : t >= 10.5 ? 1 : 0;
  c.steer = t < 2 ? 0 : t < 3 ? 0.4 * Math.sin((t - 2) * Math.PI * 2) : t >= 5.5 && t < 7.5 ? -0.6 : t >= 7.5 && t < 9.5 ? 0.5 : 0;
  c.handbrake = false;
  return c;
}
/**
 * Drive a VehicleController through the scripted controls at 120 Hz and update a ChaseRig at `hz` (frames drawn at the
 * end of each frame's steps, no interpolation). each(t, rig, cam, car, body) after every rig update.
 */
function driveChase({ rigOpts = {}, hz = 60, seconds = 12, modes = null, each, physics = street(), state: extra, ctl = controls, intSteps = false } = {}) {
  const car = new VehicleController(ROAD_CAR_SPEC);
  car.reset(new Vector3(0, 0, 0), 0, physics);
  const body = new Object3D();
  const cam = camera();
  const rig = new ChaseRig(cam, null, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false, ...rigOpts });
  const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0, gForce: 1, accel: car.localAccel, ...extra };
  rig.setTarget(body, () => state);
  const c = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const FIX = 1 / 120, frame = 1 / hz;
  let acc = 0, t = 0;
  const n = Math.round(seconds * hz);
  for (let f = 0; f < n; f++) {
    acc += frame;
    if (intSteps) { // exactly 120 / hz steps per frame (rates compare at the same simulated instants)
      const spf = Math.round(120 / hz);
      for (let i = 0; i < spf; i++) { ctl((f * spf + i) / 120, c); car.step(FIX, c, physics); }
    } else while (acc >= FIX - 1e-9) { ctl(t, c); car.step(FIX, c, physics); t += FIX; acc -= FIX; }
    body.position.copy(car.position); body.quaternion.copy(car.quaternion); body.updateMatrixWorld(true);
    state.speedKmh = car.speed * 3.6; state.grounded = car.grounded; state.wheelSlip = car.wheelSlip; state.gForce = car.gForce;
    if (modes) { const m = modes(f / hz); if (m && rig.mode !== m) rig.mode = m; }
    rig.update(frame);
    if (each) each(f / hz, rig, cam, car, body);
  }
  return { rig, cam, car, body };
}
function moving(t) { // a walker: circles, stops, walks into a box
  const p = new Vector3(Math.sin(t * 0.7) * 6, 0, -t * 1.5);
  return p;
}
const SCENARIOS = {
  'chase follow (drive, wall, posts)': () => {
    const out = [];
    driveChase({ each: (t, rig, cam) => { if (Math.round(t * 60) % 6 === 0) out.push(pose(cam)); } });
    return out;
  },
  'chase modes (hood, cockpit, cinematic, look back)': () => {
    const out = [];
    const modes = (t) => (t < 2 ? 'chase' : t < 3.5 ? 'hood' : t < 5 ? 'cockpit' : t < 9 ? 'cinematic' : 'chase');
    driveChase({ modes, each: (t, rig, cam) => { rig.setLookBack(t > 10 && t < 11); if (Math.round(t * 60) % 6 === 0) out.push(pose(cam)); } });
    return out;
  },
  'chase follow at 30 Hz': () => {
    const out = [];
    driveChase({ hz: 30, seconds: 8, each: (t, rig, cam) => { if (Math.round(t * 30) % 3 === 0) out.push(pose(cam)); } });
    return out;
  },
  'third person (look, zoom, box)': () => {
    const physics = new PhysicsWorld();
    physics.addStaticBox({ center: [0, 1.5, -9], size: [4, 3, 1], kind: 'wall' });
    const cam = camera(), rig = new ThirdPersonRig(cam, null, { physics, distance: 4.2, height: 1.6, autoRecentre: 1.5 });
    const t0 = new Object3D(), state = { facing: 0, sprint: false };
    rig.setTarget(t0, () => state);
    const out = [];
    for (let f = 0; f < 600; f++) {
      const t = f / 60;
      t0.position.copy(moving(t)); state.facing = Math.sin(t * 0.5); state.sprint = t > 3 && t < 6; t0.updateMatrixWorld(true);
      if (t > 1 && t < 2) rig.look(4, 1.5);
      if (f === 300) rig.zoom(1.4);
      rig.update(1 / 60);
      if (f % 6 === 0) out.push(pose(cam));
    }
    return out;
  },
  'first person (bob, look, ground)': () => {
    const cam = camera(), rig = new FirstPersonRig(cam, null, { bob: 0.04, getGroundHeight: (x, z) => 0.1 * Math.sin(x) });
    const t0 = new Object3D(), state = { speed: 0, grounded: true, sprint: false };
    rig.setTarget(t0, () => state);
    const out = [];
    for (let f = 0; f < 480; f++) {
      const t = f / 60;
      t0.position.copy(moving(t)); state.speed = t < 5 ? 1.5 + t : 0; state.grounded = !(t > 6 && t < 6.5); state.sprint = t > 2 && t < 4;
      t0.updateMatrixWorld(true);
      rig.look(Math.sin(t) * 3, 0.5);
      rig.update(1 / 60);
      if (f % 6 === 0) out.push(pose(cam));
    }
    return out;
  },
  'orbit and free-fly': () => {
    const cam = camera(), orbit = new OrbitRig(cam, null, { autoRotate: 0.3, getGroundHeight: () => 0 });
    const t0 = new Object3D();
    orbit.setTarget(t0);
    const out = [];
    for (let f = 0; f < 240; f++) { t0.position.copy(moving(f / 60)); t0.updateMatrixWorld(true); orbit.update(1 / 60); if (f % 6 === 0) out.push(pose(cam)); }
    const cam2 = camera(), fly = new FreeFlyRig(cam2, null, { speed: 10 });
    cam2.position.set(1, 5, 3);
    for (let f = 0; f < 120; f++) { fly.look(2, 1); fly.update(1 / 60); if (f % 6 === 0) out.push(pose(cam2)); }
    return out;
  },
};

// ---------------------------------------------------------------- 1. options off == main
{
  const now = {};
  for (const [k, fn] of Object.entries(SCENARIOS)) now[k] = fn();
  if (RECORD) {
    fs.writeFileSync(REF, JSON.stringify(now));
    console.log(`recorded ${Object.keys(now).length} scenarios to ${REF.pathname}`);
  }
  const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
  for (const [k, poses] of Object.entries(ref)) {
    const cur = now[k];
    let worst = 0;
    if (!cur || cur.length !== poses.length) worst = Infinity;
    else for (let i = 0; i < poses.length; i++) for (let j = 0; j < 8; j++) worst = Math.max(worst, Math.abs(cur[i][j] - poses[i][j]));
    check(`options off = main: ${k} (${poses.length} poses), max |diff|`, worst, 0, 1e-9);
  }
}


// ---------------------------------------------------------------- 2. road feel
const horiz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const insideBox = (p, b) => p.x > b.minX && p.x < b.maxX && p.y > b.minY && p.y < b.maxY && p.z > b.minZ && p.z < b.maxZ;
/** A synthetic target at constant speed down -Z with a fixed state.accel from t = 2 s; returns the boom (m). */
function syntheticBoom(accel, seconds = 5, feel = 'road') {
  const cam = camera(), rig = new ChaseRig(cam, null, { feel, canopyFromCollider: null, thinKinds: [] });
  const body = new Object3D(), vel = new Vector3(0, 0, -20), acc = new Vector3();
  const state = { velocity: vel, accel: acc };
  rig.setTarget(body, () => state);
  let boom = 0, lat = 0;
  for (let f = 0; f < seconds * 60; f++) {
    if (f === 120) acc.copy(accel);
    body.position.z -= 20 / 60; body.updateMatrixWorld(true);
    rig.update(1 / 60);
    boom = horiz(cam.position, body.position); lat = cam.position.x - body.position.x;
  }
  return { boom, lat };
}
{
  const base = syntheticBoom(new Vector3(0, 0, 0));
  const brake = syntheticBoom(new Vector3(0, 0, -9.81));
  const gas = syntheticBoom(new Vector3(0, 0, 0.3 * 9.81));
  const left = syntheticBoom(new Vector3(-0.8 * 9.81, 0, 0));
  check('road feel, synthetic: 1 g braking shortens the boom by', base.boom - brake.boom, 0.2, 0.5, 'm');
  check('road feel, synthetic: 0.3 g acceleration lengthens it by', gas.boom - base.boom, 0.1, 0.4, 'm');
  check('road feel, synthetic: 0.8 g left turn sways right (outside) by', left.lat - base.lat, 0.25, 0.45, 'm');
}
// the real car: full brake from ~25 m/s, the same drive with road feel vs road feel fed no acceleration
{
  const brakeCtl = (t, c) => { c.throttle = t < 5 ? 1 : 0; c.brake = t >= 5 ? 1 : 0; c.steer = 0; c.handbrake = false; return c; };
  const zero = new Vector3();
  const booms = [[], []], decel = [];
  for (const [i, extra] of [[0, undefined], [1, { accel: zero }]]) {
    driveChase({ rigOpts: { feel: 'road' }, seconds: 6.2, ctl: brakeCtl, state: extra, physics: new PhysicsWorld(), each: (t, rig, cam, car, body) => {
      booms[i].push(horiz(cam.position, body.position)); if (i === 0) decel.push(-car.localAccel.z / 9.81);
    } });
  }
  const at = Math.round(5.9 * 60);
  check('road feel, car: deceleration 0.9 s into full braking', decel[at], 0.85, 1.15, 'g');
  check('road feel, car: boom shorter under that braking by', booms[1][at] - booms[0][at], 0.2, 0.5, 'm');
}
// steady left turn on the real car: the camera sits to the outside (right of the car's heading)
{
  const turn = (t, c) => { c.throttle = t < 3 ? 0.8 : 0.35; c.brake = 0; c.steer = t > 3 ? -0.5 : 0; c.handbrake = false; return c; };
  let side = 0, latG = 0;
  const on = driveChase({ rigOpts: { feel: 'road' }, seconds: 7, ctl: turn, physics: new PhysicsWorld(), each: (t, rig, cam, car, body) => {
    if (t > 6.9) { const right = new Vector3(1, 0, 0).applyQuaternion(body.quaternion); side = cam.position.clone().sub(body.position).dot(right); latG = car.localAccel.x / 9.81; }
  } });
  let sideOff = 0;
  driveChase({ rigOpts: { feel: 'road' }, state: { accel: new Vector3() }, seconds: 7, ctl: turn, physics: new PhysicsWorld(), each: (t, rig, cam, car, body) => {
    if (t > 6.9) { const right = new Vector3(1, 0, 0).applyQuaternion(body.quaternion); sideOff = cam.position.clone().sub(body.position).dot(right); }
  } });
  void on;
  check('road feel, car: steady left turn, lateral g', latG, -1.2, -0.3, 'g');
  check('road feel, car: steady left turn, sway to the outside (vs no accel)', side - sideOff, 0.15, 0.5, 'm');
}
// lag cap: a handbrake slide; the follow direction never trails the heading by more than 0.35 rad
{
  const slide = (t, c) => { c.throttle = t < 4 ? 1 : 0.2; c.brake = 0; c.steer = t > 4 && t < 5.5 ? -1 : t >= 5.5 && t < 6.5 ? 0.6 : 0; c.handbrake = t > 4.2 && t < 5; return c; };
  let worst = 0, worstOff = 0, maxBeta = 0;
  const lagOf = (rig, body) => { // the follow frame's forward vs the car's heading, horizontal
    const h = new Vector3(0, 0, -1).applyQuaternion(body.quaternion), f = new Vector3(0, 0, -1).applyQuaternion(rig._qFollow);
    h.y = 0; f.y = 0; h.normalize(); f.normalize(); return Math.acos(Math.min(1, h.dot(f)));
  };
  driveChase({ rigOpts: { feel: 'road' }, seconds: 9, ctl: slide, physics: new PhysicsWorld(), each: (t, rig, cam, car, body) => {
    worst = Math.max(worst, lagOf(rig, body));
    const v = car.velocity, h = new Vector3(0, 0, -1).applyQuaternion(body.quaternion);
    if (car.speed > 3) maxBeta = Math.max(maxBeta, Math.acos(Math.min(1, (v.x * h.x + v.z * h.z) / Math.hypot(v.x, v.z))));
  } });
  driveChase({ seconds: 9, ctl: slide, physics: new PhysicsWorld(), each: (t, rig, cam, car, body) => { worstOff = Math.max(worstOff, lagOf(rig, body)); } });
  results.push(`info  handbrake slide: max sideslip ${maxBeta.toFixed(2)} rad, follow lag without feel ${worstOff.toFixed(3)} rad`);
  check('road feel, car: handbrake slide, max follow lag behind the heading', worst, 0, 0.35 + 1e-6, 'rad');
}
// colliders: the street drive (wall on the right, posts, the barrier) with road feel and hits; never inside a box
{
  const physics = street(), boxes = physics.queryColliders(0, -100, 400, []).map((b) => ({ ...b }));
  let inside = 0, minClear = Infinity, frames = 0;
  const long = (t, c) => { controls(t, c); if (t > 12) { c.throttle = 1; c.brake = 0; c.steer = t < 13 ? 0.7 : 0; } return c; };
  driveChase({ rigOpts: { feel: 'road' }, seconds: 20, ctl: long, physics, each: (t, rig, cam, car) => {
    if (car.impact > 1) rig.addTrauma(Math.min(0.6, car.impact / 15));
    frames++;
    for (const b of boxes) {
      if (insideBox(cam.position, b)) inside++;
      const dx = Math.max(b.minX - cam.position.x, 0, cam.position.x - b.maxX), dy = Math.max(b.minY - cam.position.y, 0, cam.position.y - b.maxY), dz = Math.max(b.minZ - cam.position.z, 0, cam.position.z - b.maxZ);
      minClear = Math.min(minClear, Math.hypot(dx, dy, dz));
    }
  } });
  check(`road feel, street drive with hits: frames with the camera inside a box (of ${frames})`, inside, 0, 0);
  check('road feel, street drive: closest approach of the camera to a box', minClear, 0.05, Infinity, 'm');
}
// a wall right behind the start and a wall along the right side: surge and sway push the camera toward them
{
  const physics = new PhysicsWorld();
  physics.addStaticBox({ center: [0, 2, 4], size: [20, 4, 1], kind: 'wall' });          // 3.5 m behind the car
  physics.addStaticBox({ center: [3.2, 2, -60], size: [0.6, 4, 130], kind: 'wall' });    // 2.9 m right of its path
  const boxes = physics.queryColliders(0, -60, 200, []).map((b) => ({ ...b }));
  const hug = (t, c) => { c.throttle = t < 5 ? 1 : 0.4; c.brake = t > 7 && t < 8 ? 1 : 0; c.steer = t > 2 && t < 2.6 ? 0.25 : t > 2.6 && t < 3.2 ? -0.25 : t > 8.5 ? -0.3 : 0; c.handbrake = false; return c; };
  let inside = 0, minClear = Infinity;
  driveChase({ rigOpts: { feel: 'road' }, seconds: 10, ctl: hug, physics, each: (t, rig, cam) => {
    for (const b of boxes) {
      if (insideBox(cam.position, b)) inside++;
      const dx = Math.max(b.minX - cam.position.x, 0, cam.position.x - b.maxX), dy = Math.max(b.minY - cam.position.y, 0, cam.position.y - b.maxY), dz = Math.max(b.minZ - cam.position.z, 0, cam.position.z - b.maxZ);
      minClear = Math.min(minClear, Math.hypot(dx, dy, dz));
    }
  } });
  check('road feel, walls behind and beside: frames with the camera inside a box', inside, 0, 0);
  check('road feel, walls behind and beside: closest approach to a wall', minClear, 0.05, 2, 'm');
}
// frame rate: the street drive at 30, 60 and 120 Hz, compared at the same instants (every 1/30 s)
{
  const run = (hz, feel) => { const out = []; const every = hz / 30; driveChase({ rigOpts: { feel }, hz, seconds: 12, intSteps: true, each: (t, rig, cam) => { out.push(cam.position.clone()); } }); return out.filter((_, i) => (i + 1) % every === 0); };
  const cmp = (a, b) => { let w = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) w = Math.max(w, a[i].distanceTo(b[i])); return w; };
  const r30 = run(30, 'road'), r60 = run(60, 'road'), r120 = run(120, 'road');
  const o30 = run(30, null), o120 = run(120, null);
  results.push(`info  without feel, 30 vs 120 Hz max camera distance ${cmp(o30, o120).toFixed(4)} m (the plain follow is not sub-stepped)`);
  check('road feel: 30 vs 60 Hz, max camera distance (12 s drive)', cmp(r30, r60), 0, 0.02, 'm');
  check('road feel: 60 vs 120 Hz, max camera distance', cmp(r60, r120), 0, 0.02, 'm');
  check('road feel: 30 vs 120 Hz, max camera distance', cmp(r30, r120), 0, 0.02, 'm');
}

// ---------------------------------------------------------------- 3. trauma
{
  const mk = () => { const cam = camera(), rig = new ThirdPersonRig(cam, null, { distance: 4 }); const t0 = new Object3D(); rig.setTarget(t0); return { cam, rig }; };
  const a = mk(), b = mk();
  a.rig.update(1 / 60); b.rig.update(1 / 60);
  a.rig.addTrauma(0.7); a.rig.addTrauma(0.7);
  check('trauma: addTrauma clamps to 1', a.rig.trauma, 1, 1);
  let maxAng = 0, maxPos = 0, t03 = NaN;
  const q = new Quaternion();
  for (let f = 0; f < 60; f++) {
    a.rig.update(1 / 60); b.rig.update(1 / 60);
    maxAng = Math.max(maxAng, a.cam.quaternion.angleTo(b.cam.quaternion));
    maxPos = Math.max(maxPos, a.cam.position.distanceTo(b.cam.position));
    if (f === 17) t03 = a.rig.trauma;
  }
  void q;
  check('trauma 1: largest shake angle', maxAng, 0.01, 0.06, 'rad');
  check('trauma: the shake rotates only (position change)', maxPos, 0, 1e-12, 'm');
  check('trauma: after 0.3 s (decay 1.7 / s)', t03, 1 - 1.7 * 0.3 - 0.01, 1 - 1.7 * 0.3 + 0.01);
  check('trauma: gone after 1 s, pose back to the calm rig (angle)', a.cam.quaternion.angleTo(b.cam.quaternion) + a.rig.trauma, 0, 1e-6, 'rad');
  // every rig has it
  const half = (rig, cam, step) => { step(); const q0 = cam.quaternion.clone(); rig.addTrauma(1); step(); return cam.quaternion.angleTo(q0); };
  const t1 = new Object3D();
  const rigs = { ChaseRig: () => new ChaseRig(camera(), null), FirstPersonRig: () => new FirstPersonRig(camera(), null), OrbitRig: () => new OrbitRig(camera(), null), FreeFlyRig: () => new FreeFlyRig(camera(), null) };
  for (const [name, make] of Object.entries(rigs)) {
    const rig = make(); if (rig.setTarget && name !== 'FreeFlyRig') rig.setTarget(t1, () => ({}));
    check(`trauma: ${name} shakes after addTrauma(1)`, half(rig, rig.camera, () => rig.update(1 / 60)), 1e-4, 0.08, 'rad');
  }
}

// ---------------------------------------------------------------- 4. landing dip, sprint FOV
for (const [name, Rig] of [['ThirdPersonRig', ThirdPersonRig], ['FirstPersonRig', FirstPersonRig]]) {
  const dipRun = (hz, gain, speed = 4.4) => {
    const cam = camera(), rig = new Rig(cam, null, { landingDip: gain });
    const t0 = new Object3D(); rig.setTarget(t0, () => ({}));
    rig.update(1 / hz);
    const y0 = cam.position.y;
    rig.land(speed);
    let min = 0, end = 0;
    for (let f = 0; f < hz * 1.5; f++) { rig.update(1 / hz); min = Math.min(min, cam.position.y - y0); end = cam.position.y - y0; }
    return { min, end };
  };
  const d60 = dipRun(60, 1), d30 = dipRun(30, 1), d120 = dipRun(120, 1), off = dipRun(60, 0), big = dipRun(60, 1, 20);
  check(`${name} landingDip 1: dip after a 4.4 m/s landing (1 m fall)`, -d60.min, 0.04, 0.1, 'm');
  check(`${name} landingDip 1: dip at the 3.2 m/s kick cap (20 m/s landing)`, -big.min, 0.08, 0.16, 'm');
  check(`${name} landingDip 1: settled after 1.5 s`, Math.abs(d60.end), 0, 1e-4, 'm');
  check(`${name} landingDip: 30 vs 120 Hz peak`, Math.abs(d30.min - d120.min), 0, 0.005, 'm');
  check(`${name} landingDip 0: land() does nothing`, Math.abs(off.min), 0, 0, 'm');
  const cam = camera(), rig = new Rig(cam, null, { sprintFov: 6 }), st = { sprint: true };
  rig.setTarget(new Object3D(), () => st);
  for (let f = 0; f < 60; f++) rig.update(1 / 60);
  const wide = cam.fov;
  st.sprint = false;
  for (let f = 0; f < 90; f++) rig.update(1 / 60);
  check(`${name} sprintFov 6: FOV after 1 s of sprint (base 60)`, wide, 65.7, 66.01, 'deg');
  check(`${name} sprintFov 6: FOV 1.5 s after the sprint`, cam.fov, 59.99, 60.01, 'deg');
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : `\nall ${results.length} checks passed`);
process.exit(failures ? 1 : 0);
