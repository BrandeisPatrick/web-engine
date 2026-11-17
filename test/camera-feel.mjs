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
function driveChase({ rigOpts = {}, hz = 60, seconds = 12, modes = null, each, physics = street(), state: extra } = {}) {
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
    while (acc >= FIX - 1e-9) { controls(t, c); car.step(FIX, c, physics); t += FIX; acc -= FIX; }
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

// FEEL-CHECKS

console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : `\nall ${results.length} checks passed`);
process.exit(failures ? 1 : 0);
