// Headless checks for the agent-usability additions: ROAD_CAR_SPEC (an ordinary car, no flight), loadTextureSet's
// role keys and its warnings, AnimationController's missing-clip error, PhysicsWorld.addStaticBox's object forms,
// NearestLights from the render layer (and the world re-export) and PoseInterpolator. No browser, no WebGL.
// Run: node test/agent-usability.mjs
import * as THREE from 'three';
import { VehicleController, ROAD_CAR_SPEC, ROADSTER_SPEC, PhysicsWorld } from '../src/physics/index.js';
import { loadTextureSet, loadTextureManifest, TextureSets } from '../src/render/TextureSets.js';
import { NearestLights as RenderNearestLights } from '../src/render/index.js';
import { NearestLights as WorldNearestLights } from '../src/world/NearestLights.js';
import { AnimationController } from '../src/anim/index.js';
import { PoseInterpolator } from '../src/core/index.js';

let failed = 0, n = 0;
const check = (name, ok, got) => { n++; if (!ok) { failed++; console.log(`FAIL  ${name}`, got ?? ''); } else console.log(`PASS  ${name}`); };
/** Run fn with console.warn captured; returns [result, warnings]. */
async function captureWarn(fn) {
  const real = console.warn, out = [];
  console.warn = (...a) => out.push(a.join(' '));
  try { return [await fn(), out]; } finally { console.warn = real; }
}

// ---- 3a. ROAD_CAR_SPEC: an ordinary road car
{
  const DT = 1 / 120, world = new PhysicsWorld();
  const car = new VehicleController(ROAD_CAR_SPEC);
  car.reset(new THREE.Vector3(), 0, world);
  let t100 = NaN, maxY = 0;
  for (let i = 0; i < 40 * 120; i++) {
    car.step(DT, { throttle: 1, thrust: 1 }, world); // full lift input too: must not fly
    if (!(t100 > 0) && car.forwardSpeed >= 100 / 3.6) t100 = (i + 1) * DT;
    maxY = Math.max(maxY, car.position.y);
  }
  check('ROAD_CAR_SPEC: 0-100 km/h in 5..12 s', t100 >= 5 && t100 <= 12, t100);
  check('ROAD_CAR_SPEC: top speed 160..210 km/h', car.forwardSpeed * 3.6 >= 160 && car.forwardSpeed * 3.6 <= 210, car.forwardSpeed * 3.6);
  check('ROAD_CAR_SPEC: a lift input does not fly (mode ground, stays on the ground)', car.mode === 'ground' && maxY < 0.2 && car.spec.flight === false, { mode: car.mode, maxY });
  check('ROAD_CAR_SPEC: frozen, partial (contact geometry derived from its dimensions)', Object.isFrozen(ROAD_CAR_SPEC) && !('wheels' in ROAD_CAR_SPEC)
    && car.wheels[0].x === -ROAD_CAR_SPEC.halfTrack && car.wheels[0].z === ROAD_CAR_SPEC.axleFront);
  check('ROADSTER_SPEC unchanged as the default', new VehicleController().spec === ROADSTER_SPEC && ROADSTER_SPEC.flight === true && ROADSTER_SPEC.motorPower === 1.0e6);
}

// ---- 3b. loadTextureSet: role keys, warnings
{
  const manifest = { sets: { grass: { id: 'leafy_grass', size: [2, 2] } } };
  const realFetch = globalThis.fetch, prevDoc = globalThis.document, calls = [];
  const fakeImg = () => { const ls = {}; return { width: 4, height: 4, addEventListener: (k, f) => { ls[k] = f; }, removeEventListener() {}, set src(v) { setTimeout(() => ls.load.call(this), 0); } }; };
  globalThis.document = { createElementNS: fakeImg };
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (/missing\//.test(url)) return { ok: false, status: 404 };
    if (/manifest\.json$/.test(url)) return /\/ok\//.test(url) ? { ok: true, json: async () => manifest } : { ok: false, status: 404 };
    return { ok: true, blob: async () => new Blob([new Uint8Array(8)]) };
  };
  const prevLog = TextureSets.options.log;
  TextureSets.configure({ log: false });
  try {
    const [byId] = await captureWarn(() => loadTextureSet('leafy_grass', { base: '/ok/', manifest, maps: ['map'] }));
    const [byRole, w0] = await captureWarn(() => loadTextureSet('grass', { base: '/ok/', manifest, maps: ['map'] }));
    check('loadTextureSet: set id loads, size from the manifest', byId && byId.map && byId.size === 2);
    check('loadTextureSet: a role key loads the same set (its id folder), no warning', byRole && byRole.size === 2 && calls.includes('/ok/leafy_grass/diff.jpg') && !calls.includes('/ok/grass/diff.jpg') && w0.length === 0, { calls, w0 });
    const [none, w1] = await captureWarn(() => loadTextureSet('rock', { base: '/ok/', manifest, maps: ['map'] }));
    const [none2, w2] = await captureWarn(() => loadTextureSet('rock', { base: '/ok/', manifest, maps: ['map'] }));
    check('loadTextureSet: an unlisted id -> null with ONE warning naming the ids and roles', none === null && none2 === null && w1.length === 1 && w2.length === 0
      && /'rock'/.test(w1[0]) && /leafy_grass/.test(w1[0]) && /grass/.test(w1[0]), w1);
    const [q, wq] = await captureWarn(() => loadTextureSet('rock2', { base: '/ok/', manifest, maps: ['map'], quiet: true }));
    check('loadTextureSet: quiet: true -> no warning', q === null && wq.length === 0, wq);
    const [miss, w3] = await captureWarn(() => loadTextureSet('leafy_grass', { base: '/missing/', maps: ['map'] }));
    check('loadTextureSet: no manifest, albedo missing -> null with a warning naming the URL tried', miss === null && w3.length === 1 && w3[0].includes('/missing/leafy_grass/diff.jpg'), w3);
    const [man, w4] = await captureWarn(() => loadTextureManifest('/nomanifest/'));
    const [, w5] = await captureWarn(() => loadTextureManifest('/nomanifest/'));
    check('loadTextureManifest: a missing manifest -> null with one warning per root', man === null && w4.length === 1 && /\/nomanifest\/manifest\.json/.test(w4[0]) && w5.length === 0, w4);
    const [, w6] = await captureWarn(() => loadTextureManifest('/optional/', { quiet: true }));
    check('loadTextureManifest: quiet: true -> no warning', w6.length === 0, w6);
  } finally {
    globalThis.fetch = realFetch; globalThis.document = prevDoc;
    TextureSets.configure({ log: prevLog });
  }
}

// ---- 3c. AnimationController: a missing clip name lists the available ones
{
  const root = new THREE.Object3D();
  const clip = (name) => new THREE.AnimationClip(name, 1, [new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 1])]);
  const clips = [clip('HumanArmature|Man_Idle'), clip('HumanArmature|Man_Walk')];
  let msg = '';
  try { new AnimationController(root, clips, { states: { walk: { clip: 'Walk' } } }); } catch (e) { msg = e.message; }
  check('AnimationController: unknown clip throws, naming the state and clip', /state 'walk'/.test(msg) && /clip 'Walk' not found/.test(msg), msg);
  check('AnimationController: the error lists every clip name', msg.includes("'HumanArmature|Man_Idle'") && msg.includes("'HumanArmature|Man_Walk'"), msg);
  check('AnimationController: and suggests the one ending with the name', msg.includes("Did you mean 'HumanArmature|Man_Walk'?"), msg);
  const ok = new AnimationController(root, clips, { states: { walk: { clip: 'HumanArmature|Man_Walk' } } });
  check('AnimationController: exact names still work', ok.states.walk && ok.states.walk.clip.name === 'HumanArmature|Man_Walk');
}

// ---- 3d. PhysicsWorld.addStaticBox object forms
{
  const w = new PhysicsWorld();
  const iPos = w.addStaticBox(1, 0, 3, 2, -4, -1, 'wall');
  const iMin = w.addStaticBox({ min: [1, 0, -4], max: [3, 2, -1], kind: 'wall' });
  const iVec = w.addStaticBox({ min: new THREE.Vector3(1, 0, -4), max: new THREE.Vector3(3, 2, -1), kind: 'wall' });
  const iCen = w.addStaticBox({ center: [2, 1, -2.5], size: [2, 2, 3], kind: 'wall' });
  const B = w.staticBoxes, same = (a, b) => ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ', 'kind'].every((k) => a[k] === b[k]);
  check('addStaticBox: { min, max } equals the positional form', same(B[iPos], B[iMin]) && same(B[iPos], B[iVec]), [B[iPos], B[iMin]]);
  check('addStaticBox: { center, size } equals it too', same(B[iPos], B[iCen]), B[iCen]);
  const d = w.addStaticBox({ min: [0, 0, 0], max: [1, 1, 1] });
  check('addStaticBox: kind defaults to 0', B[d].kind === 0);
  let threw = '';
  try { w.addStaticBox({ x: 1 }); } catch (e) { threw = e.message; }
  check('addStaticBox: a bad object throws naming both forms', /min.*max/.test(threw) && /center.*size/.test(threw), threw);
}

// ---- 3e. NearestLights from the render layer; the world layer re-exports the same class
{
  check('NearestLights: render and world exports are the same class', RenderNearestLights === WorldNearestLights);
  const parent = new THREE.Object3D();
  const pool = new RenderNearestLights({ count: 1, distance: 12, decay: 1.5, parent });
  pool.setPositions([[0, 3, -5]]);
  pool.update(0.016, { position: new THREE.Vector3() }, 8);
  pool.update(1, { position: new THREE.Vector3() }, 8);
  check('NearestLights (render): a one-lamp pool lights its lamp at the given intensity', pool.lights.length === 1 && pool.lights[0].intensity === 8 && pool.lights[0].position.z === -5);
}

// ---- 3f. PoseInterpolator
{
  const body = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  const smooth = new PoseInterpolator(body);
  const target = new THREE.Object3D();
  smooth.save(); body.position.set(10, 0, 0); body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  smooth.apply(target, 0.25);
  const yaw = 2 * Math.atan2(target.quaternion.y, target.quaternion.w);
  check('PoseInterpolator: position lerp by alpha', Math.abs(target.position.x - 2.5) < 1e-9, target.position.x);
  check('PoseInterpolator: quaternion slerp by alpha', Math.abs(yaw - Math.PI / 8) < 1e-6, yaw);
  smooth.apply(target, 1);
  check('PoseInterpolator: alpha 1 = the current pose', target.position.x === 10);
  smooth.snap(); smooth.apply(target, 0);
  check('PoseInterpolator: snap() drops the previous pose (no blend from the old place)', target.position.x === 10);
  const cc = { position: new THREE.Vector3(0, 0, 0) }, sm2 = new PoseInterpolator(cc), o = new THREE.Object3D();
  o.rotation.y = 1; sm2.save(); cc.position.z = -2; sm2.apply(o, 0.5);
  check('PoseInterpolator: a source without a quaternion leaves the rotation alone', o.position.z === -1 && Math.abs(o.rotation.y - 1) < 1e-12 && sm2.rotation === false);
  const car = new VehicleController(ROAD_CAR_SPEC), world = new PhysicsWorld(), mesh = new THREE.Object3D(), vs = new PoseInterpolator(car);
  car.reset(new THREE.Vector3(), 0, world); vs.snap();
  for (let i = 0; i < 120; i++) { vs.save(); car.step(1 / 120, { throttle: 1 }, world); }
  vs.apply(mesh, 0.5);
  check('PoseInterpolator: works on a VehicleController (between its last two steps)', mesh.position.z < vs.prevPosition.z + 1e-9 && mesh.position.z > car.position.z - 1e-9 && mesh.position.z < 0);
}

console.log(failed ? `${failed} of ${n} check(s) FAILED` : `all ${n} checks passed`);
process.exit(failed ? 1 : 0);
