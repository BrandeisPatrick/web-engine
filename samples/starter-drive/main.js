// Starter: a driving game. Copy this folder to start one: flat ground, a straight textured road, a box car on the
// engine's VehicleController (an ordinary road car), a chase camera, golden-hour sky, post-processing, the desktop /
// mobile quality tiers and a speed readout. Every block says what it is and what a game would change.
// Controls: W / S or arrows drive and brake (brake from a stop reverses), A / D steer, X handbrake, C camera, R reset;
// gamepad and touch work too.
import * as THREE from 'three';
import { Engine, PoseInterpolator, resolveQuality, createBenchHarness } from '@vibe/engine/core';
import { PhysicsWorld, VehicleController, ROAD_CAR_SPEC } from '@vibe/engine/physics';
import { Atmosphere, PostFX, loadTextureManifest, loadTextureSet } from '@vibe/engine/render';
import { VehicleInput } from '@vibe/engine/input';
import { ChaseRig } from '@vibe/engine/camera';
import { UILayer, Panel, Readout, QualityMenu } from '@vibe/engine/ui';

const BASE = import.meta.env.BASE_URL; // asset URLs go through it, so the page also works under a sub-path

// ---- quality tier: 'desktop' or 'mobile' (?quality=mobile forces one; the gear button stores a choice)
const Q = resolveQuality();
const S = Q.settings;

// ---- the car's physics: an ordinary road car. Spread it to tune: { ...ROAD_CAR_SPEC, motorPower: 200e3, vMax: 70 }.
// (Without a spec VehicleController is the Roadster, a 400 km/h car that flies on the thrust input.)
const SPEC = ROAD_CAR_SPEC;

async function boot() {
  // ---- engine + physics. PhysicsWorld() is flat ground at y = 0; PhysicsWorld({ heightfield: (x, z) => y }) for hills
  const physics = new PhysicsWorld();
  const engine = new Engine({ container: document.getElementById('app'), physics, renderer: { antialias: false }, ...S.engine });
  const { scene, camera, renderer } = engine;

  // ---- sky, sun, fog and shadows. timeOfDay: hours 0..24 or 'dawn' | 'noon' | 'golden' | 'dusk' | 'night'
  const atmosphere = new Atmosphere({ scene, renderer, camera, timeOfDay: 'golden', shadows: S.shadows });

  // ---- ground and a straight road (z from +100 to -900). A real track: your own ribbon mesh along a path
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4d5a3a, roughness: 1 }));
  ground.receiveShadow = true;
  const ROAD_W = 10, ROAD_L = 1000;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_L).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.6 }));
  road.position.set(0, 0.02, 100 - ROAD_L / 2); road.receiveShadow = true;
  scene.add(ground, road);
  // asphalt PBR set: `base` is the folder holding manifest.json and one folder per set id
  const texBase = `${BASE}nyc/textures/`;
  const asphalt = await loadTextureSet('asphalt_02', { renderer, base: texBase, manifest: await loadTextureManifest(texBase) });
  if (asphalt) {
    for (const t of [asphalt.map, asphalt.normalMap, asphalt.roughnessMap]) if (t) t.repeat.set(ROAD_W / asphalt.size, ROAD_L / asphalt.size);
    Object.assign(road.material, { map: asphalt.map, normalMap: asphalt.normalMap, roughnessMap: asphalt.roughnessMap, color: new THREE.Color(0xffffff) });
  }
  // a row of posts beside the road, as static colliders the car bounces off
  const postMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 });
  for (let z = 80; z > -900; z -= 40) {
    for (const x of [-ROAD_W / 2 - 1, ROAD_W / 2 + 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), postMat);
      p.position.set(x, 0.6, z); p.castShadow = true; scene.add(p);
      physics.addStaticBox({ center: [x, 0.6, z], size: [0.3, 1.2, 0.3], kind: 'post' });
    }
  }

  // ---- the car: the simulation (VehicleController) and what you see (a Group of boxes). Swap in a GLB model here
  const car = new VehicleController(SPEC);
  const START = new THREE.Vector3(0, 0, 0);
  car.reset(START, 0, physics); // heading 0 faces -Z (down the road)
  const body = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x8a0f16, roughness: 0.3, metalness: 0.5 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(SPEC.width, 0.55, SPEC.length), paint); hull.position.y = 0.6;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(SPEC.width * 0.85, 0.45, SPEC.length * 0.5), new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.1 }));
  cabin.position.set(0, 1.1, 0.2);
  body.add(hull, cabin);
  const wheelGeo = new THREE.CylinderGeometry(SPEC.wheelRadius, SPEC.wheelRadius, 0.25, 16).rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const wheels = car.wheels.map((w) => { // [FL, FR, RL, RR] contact points in the car's frame
    const m = new THREE.Mesh(wheelGeo, wheelMat); m.position.set(w.x, SPEC.wheelRadius, w.z); body.add(m); return m;
  });
  body.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(body);
  const smooth = new PoseInterpolator(car); // draws the car between fixed steps (position lerp + rotation slerp)
  smooth.apply(body, 1);

  // ---- post-processing with the tier's settings (desktop: G-buffer + TAA + SSR; mobile: FXAA), resize hook
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;          // `passes` is the game's to apply
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  postfx.track(body); // per-object velocity for TAA / motion blur
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);

  // ---- input and the chase camera. The rig reads `state` each frame (ChaseTargetState: velocity, speedKmh, ...)
  const input = new VehicleInput(renderer.domElement, { touch: 'auto' });
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false }; // what car.step() reads
  const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0 };
  const rig = new ChaseRig(camera, renderer.domElement, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false });
  rig.setTarget(body, () => state);

  // ---- HUD: one readout, and the quality menu
  const panel = new Panel({ parent: new UILayer(), corner: 'bl' });
  const speed = panel.add(new Readout({ label: 'SPEED', value: '0', unit: 'km/h' }));
  new QualityMenu({ quality: Q, corner: 'tr' });

  // ---- the game loop: input per frame, simulation per fixed step, drawing per frame
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt);
      controls.throttle = input.throttle; controls.brake = input.brake; controls.steer = input.steer; controls.handbrake = input.handbrake;
      if (input.reset) { car.reset(START, 0, physics); smooth.snap(); rig.snap(); } // back to the start
      if (input.toggleCamera) rig.cycleMode();
    },
    fixedUpdate(dt) {
      smooth.save(); // before the step: the pose PoseInterpolator blends from
      car.step(dt, controls, physics);
    },
    update(dt, alpha) {
      smooth.apply(body, alpha);
      for (let i = 0; i < 4; i++) { // roll the wheels, steer the front pair
        wheels[i].rotation.x -= (car.forwardSpeed * dt) / SPEC.wheelRadius;
        if (i < 2) wheels[i].rotation.y = car.steerAngle;
      }
      state.speedKmh = car.speed * 3.6; state.grounded = car.grounded; state.wheelSlip = car.wheelSlip;
      rig.update(dt);
    },
    lateUpdate(dt) {
      atmosphere.update(camera.position, dt);
      speed.set(Math.round(Math.abs(car.forwardSpeed) * 3.6));
    },
  }, 'game');
  engine.start();

  // ---- page contract for the browser tests (npm run smoke): window.__sample with `ready`
  window.__sample = Object.assign(createBenchHarness(engine, { name: 'starter-drive' }), { car }).setReady();
}

boot().catch((e) => console.error('[starter-drive] boot failed', e));
