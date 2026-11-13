// Runs the Node-capable recipes of docs/HOWTO.md (their source is test/howto/recipes.js) and checks they do what the
// recipe says: PoseInterpolator blends between steps, static boxes and loose bodies collide, a car drives a small
// track over a heightfield with a surface provider. The browser-only recipes run in test/browser/howto.mjs.
import * as THREE from 'three';
import { poseInterpolator, physicsBodies, smallTrack } from './howto/recipes.js';
import { PhysicsWorld } from '@vibe/engine/physics';

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
}
const DT = 1 / 120;

// --- pose-interpolator: a stand-in engine that runs the system's hooks like Engine does (fixed steps, then update)
{
  const systems = [];
  const engine = { addSystem: (s) => { systems.push(s); return s; } };
  const physics = new PhysicsWorld();
  const carMesh = new THREE.Object3D();
  const { car } = poseInterpolator({ engine, physics, carMesh });
  const sys = systems[0];
  for (let i = 0; i < 240; i++) sys.fixedUpdate(DT);            // 2 s of full throttle
  const prev = car.position.clone();
  sys.fixedUpdate(DT);
  sys.update(1 / 60, 0.5);
  const mid = prev.clone().lerp(car.position, 0.5);
  check('pose-interpolator: car moved under throttle', car.position.length() > 5, `${car.position.length().toFixed(2)} m`);
  check('pose-interpolator: alpha 0.5 draws halfway between the last two steps', carMesh.position.distanceTo(mid) < 1e-9);
  sys.update(1 / 60, 1);
  check('pose-interpolator: alpha 1 draws the current step', carMesh.position.distanceTo(car.position) < 1e-9);
}

// --- physics-bodies: the crate falls and rests on the ground, the ball bounces, the wall is a collider
{
  const { physics, dyn, crate, mesh, step } = physicsBodies();
  for (let i = 0; i < 600; i++) step(DT);                        // 5 s
  check('physics-bodies: the crate rests on the ground (centre at its half height)', Math.abs(mesh.position.y - 0.4) < 0.02, `y ${mesh.position.y.toFixed(3)}`);
  const hits = [];
  physics.queryColliders(0, -10, 1, hits);
  check('physics-bodies: the wall is a static collider', hits.some((b) => b.maxY > 1.9 && b.minZ < -10 && b.maxZ > -10));
  check('physics-bodies: both bodies exist', dyn.stats.bodies >= 2 || dyn.bodies.alive.filter(Boolean).length >= 2);
  const kerb = []; physics.queryColliders(5, 0, 0.5, kerb);
  check('physics-bodies: the kerb box (min / max form) is registered', kerb.length > 0);
  void crate;
}

// --- small-track: the car drives down the road over the hills and stays on the ground
{
  const { physics, car, hills, ground } = smallTrack();
  const c = { throttle: 0.6, brake: 0, steer: 0, handbrake: false };
  let maxGap = 0;
  for (let i = 0; i < 1200; i++) {                               // 10 s
    car.step(DT, c, physics);
    if (car.grounded) maxGap = Math.max(maxGap, Math.abs(car.position.y - hills(car.position.x, car.position.z)));
  }
  check('small-track: the car drove down the road (-Z)', car.position.z < -50, `z ${car.position.z.toFixed(1)}`);
  check('small-track: it stayed on the road', Math.abs(car.position.x) < 5, `x ${car.position.x.toFixed(2)}`);
  check('small-track: grounded on the heightfield', car.grounded && maxGap < 0.3, `max gap ${maxGap.toFixed(3)} m`);
  const out = physics.surfaceAt(20, 0);
  check('small-track: grass beside the road has less grip', out.tag === 'grass' && out.mu < 1);
  check('small-track: the ground mesh follows the heights', Math.abs(ground.attributes.position.getY(5000) - hills(ground.attributes.position.getX(5000), ground.attributes.position.getZ(5000))) < 1e-6);
}

console.log(failures ? `\n${failures} howto check(s) failed` : '\nhowto recipes: all checks passed');
process.exit(failures ? 1 : 0);
