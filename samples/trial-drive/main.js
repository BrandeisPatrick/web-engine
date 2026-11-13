// Night circuit: a small driving game built only from @vibe/engine's public API (a usability trial sample).
// A car (VehicleController) on a ~600 m loop over gentle hills at night: checkpoints, a lap timer, street lamps on
// ClusteredLights, headlights, tyre dust on GpuParticleSystem, a PBR asphalt set, a HUD, engine sound and the
// desktop / mobile quality tiers. Ground and road are this sample's own meshes over a heightfield (see FRICTION.md
// in the trial notes for why the world layer was not used).
import * as THREE from 'three';
import {
  Engine, PhysicsWorld, VehicleController, Atmosphere, PostFX, ClusteredLights, syncClustered, GpuParticleSystem,
  loadTextureSet, loadTextureManifest, TextureSets, VehicleInput, ChaseRig, resolveQuality,
} from '@vibe/engine';
import { UILayer, Panel, Readout, QualityMenu } from '@vibe/engine/ui';
import { VehicleAudio } from '@vibe/engine/audio';

const BASE = import.meta.env.BASE_URL;

// ---------------------------------------------------------------- quality tiers
const Q = resolveQuality({
  overrides: {
    desktop: { postfx: { volumetric: false, motionBlur: 0.5 }, shadows: { cascades: 2, kernel: 'pcss' } },
    mobile: { textures: { maxSize: 1024 } },
  },
});
const QS = Q.settings;
const MOBILE = Q.tier === 'mobile';

// ---------------------------------------------------------------- terrain and track (pure functions)
const groundH = (x, z) => 2.2 * Math.sin(x * 0.018) * Math.cos(z * 0.022) + 1.2 * Math.sin(x * 0.041 + z * 0.033);
const trackAt = (t) => {
  const a = t * Math.PI * 2;
  return [120 * Math.cos(a), 72 * Math.sin(a) + 18 * Math.sin(2 * a)];
};
const N = 480, ROAD_W = 10;
const track = [];
for (let i = 0; i < N; i++) {
  const [x, z] = trackAt(i / N), [x1, z1] = trackAt((i + 1) / N);
  const dx = x1 - x, dz = z1 - z, l = Math.hypot(dx, dz);
  track.push({ x, z, tx: dx / l, tz: dz / l, len: l });
}
let trackLen = 0; for (const p of track) { p.s = trackLen; trackLen += p.len; }

function buildGround() {
  const g = new THREE.PlaneGeometry(700, 560, 175, 140).rotateX(-Math.PI / 2);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, groundH(P.getX(i), P.getZ(i)));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1d2a16, roughness: 0.95 }));
  m.receiveShadow = true; m.name = 'ground';
  return m;
}

function buildRoad(tex) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = track[i % N], nx = -p.tz, nz = p.tx, v = (i === N ? trackLen : p.s) / (tex ? tex.size * 2 : 6);
    for (const side of [-1, 1]) {
      const x = p.x + nx * side * ROAD_W / 2, z = p.z + nz * side * ROAD_W / 2;
      pos.push(x, groundH(x, z) + 0.03, z); uv.push(side < 0 ? 0 : ROAD_W / (tex ? tex.size * 2 : 6), v);
    }
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // damp asphalt: low roughness so the SSR pass picks up the lamps
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.28, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (tex) { mat.map = tex.map; mat.normalMap = tex.normalMap || null; mat.roughnessMap = tex.roughnessMap || null; }
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.name = 'road';
  if (g.attributes.normal.getY(0) < 0) { // winding: we want +Y normals
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx); g.computeVertexNormals();
  }
  return m;
}

// ---------------------------------------------------------------- boot
async function boot() {
  const physics = new PhysicsWorld({ heightfield: (x, z) => groundH(x, z) });
  const engine = new Engine({ container: document.getElementById('app'), fixedHz: 120, physics, ...QS.engine });
  const { scene, camera, renderer } = engine;

  const atmo = new Atmosphere({ scene, renderer, camera, timeOfDay: 'night', shadows: QS.shadows, moonScatter: 0.4 });

  // road texture (Poly Haven asphalt in the Miami demo's folder) through the engine's texture-set loader
  const roadBase = `${BASE}miami/road/`;
  TextureSets.configure({ basisPath: `${BASE}miami/basis/`, maxAnisotropy: QS.textures.anisotropy });
  const manifest = await loadTextureManifest(roadBase);
  const tex = await loadTextureSet('asphalt_02_2k', { renderer, base: roadBase, manifest, maps: MOBILE ? ['map'] : ['map', 'normalMap', 'roughnessMap'] });
  if (!tex) console.warn('[trial-drive] road texture set missing, plain asphalt colour');

  scene.add(buildGround());
  scene.add(buildRoad(tex));
  // off the road: grass grip
  const ROAD = { mu: 1, crr: 1, tag: 'asphalt' }, GRASS = { mu: 0.75, crr: 4, tag: 'grass' };
  const nearestIdx = (x, z, hint = -1) => {
    let best = 0, bd = Infinity;
    const from = hint < 0 ? 0 : hint - 12, to = hint < 0 ? N : hint + 12;
    for (let k = from; k < to; k++) { const i = ((k % N) + N) % N, p = track[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return { i: best, d: Math.sqrt(bd) };
  };
  physics.setSurfaceProvider((x, z) => (nearestIdx(x, z).d < ROAD_W / 2 + 0.5 ? ROAD : GRASS));

  // ---------------------------------------------------------------- lamps (clustered lights) and checkpoints
  const clustered = QS.lights.clustered ? new ClusteredLights({ maxLights: 128 }) : null;
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 8), headGeo = new THREE.SphereGeometry(0.28, 12, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6, metalness: 0.6 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc98a, emissiveIntensity: 6 });
  const LAMP_EVERY = 20;
  let li = 0, lamps = 0;
  for (let i = 0; i < N; i += LAMP_EVERY) {
    const p = track[i], side = (i / LAMP_EVERY) % 2 ? 1 : -1, nx = -p.tz * side, nz = p.tx * side;
    const x = p.x + nx * (ROAD_W / 2 + 1.5), z = p.z + nz * (ROAD_W / 2 + 1.5), y = groundH(x, z);
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(x, y + 3, z); pole.castShadow = true;
    const head = new THREE.Mesh(headGeo, bulbMat); head.position.set(x - nx * 1.2, y + 6, z - nz * 1.2);
    scene.add(pole, head); lamps++;
    physics.addStaticBox(x - 0.15, y, x + 0.15, y + 6, z - 0.15, z + 0.15, 'pole');
    if (clustered) clustered.setLight(li++, head.position.x, head.position.y - 0.4, head.position.z, 26, 18, 12.5, 7);
  }
  const lampCount = li;
  const CHECKPOINTS = [0, 0.25, 0.5, 0.75].map((f) => Math.round(f * N) % N);
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x29d3ff, emissiveIntensity: 3 });
  const startMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff3355, emissiveIntensity: 3 });
  for (const [k, i] of CHECKPOINTS.entries()) {
    const p = track[i], nx = -p.tz, nz = p.tx, mat = k === 0 ? startMat : gateMat;
    for (const s of [-1, 1]) {
      const x = p.x + nx * s * (ROAD_W / 2 + 0.6), z = p.z + nz * s * (ROAD_W / 2 + 0.6);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), mat); post.position.set(x, groundH(x, z) + 2, z); scene.add(post);
      physics.addStaticBox(x - 0.15, groundH(x, z), x + 0.15, groundH(x, z) + 4, z - 0.15, z + 0.15, 'gate');
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 1.2, 0.25, 0.25), mat);
    bar.position.set(p.x, groundH(p.x, p.z) + 4, p.z); bar.lookAt(p.x + p.tx, bar.position.y, p.z + p.tz);
    scene.add(bar);
  }

  // ---------------------------------------------------------------- the car (boxes) on the engine's vehicle controller
  const SPEC = { mass: 1400, length: 4.4, width: 1.9, height: 1.35, axleFront: -1.4, axleRear: 1.4, halfTrack: 0.82, wheelRadius: 0.34, flight: false, airControl: 'arcade', motorPower: 140e3, motorPeakForce: 6000, vMax: 50 };
  const vc = new VehicleController(SPEC);
  const car = new THREE.Group(); car.name = 'car';
  const paint = new THREE.MeshStandardMaterial({ color: 0x8a0f16, roughness: 0.3, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.1, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), paint); body.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 2.1), glass); cabin.position.set(0, 1.1, 0.25);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff2dd, emissiveIntensity: 8 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff1a1a, emissiveIntensity: 4 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.05), lampMat); h.position.set(s * 0.65, 0.72, -2.21); car.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.05), tailMat); t.position.set(s * 0.6, 0.75, 2.21); car.add(t);
  }
  car.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(SPEC.wheelRadius, SPEC.wheelRadius, 0.25, 16).rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const wheels = [[-1, SPEC.axleFront], [1, SPEC.axleFront], [-1, SPEC.axleRear], [1, SPEC.axleRear]].map(([s, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(s * SPEC.halfTrack, SPEC.wheelRadius, z); car.add(w); return w;
  });
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(car);
  const start = track[N - 6], startHeading = Math.atan2(-start.tx, -start.tz);
  vc.reset(new THREE.Vector3(start.x, groundH(start.x, start.z), start.z), startHeading, physics);
  const prevPos = vc.position.clone(), prevQuat = vc.quaternion.clone();
  car.position.copy(vc.position); car.quaternion.copy(vc.quaternion);
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false, thrust: 0, pitch: 0, yaw: 0, boost: false };
  const state = { velocity: vc.velocity, speedKmh: 0, mode: 'ground', thrust: 0, gForce: 1, grounded: true, wheelSlip: 0 };

  // headlights: two clustered spots (desktop) or one real SpotLight (mobile tier has clustered lights off)
  let headSpot = null;
  if (!clustered) {
    headSpot = new THREE.SpotLight(0xfff0dc, 60, 70, 0.5, 0.4, 1.6);
    headSpot.position.set(0, 0.7, -2.0); headSpot.target.position.set(0, -0.5, -20); car.add(headSpot, headSpot.target);
  }

  // ---------------------------------------------------------------- post-processing
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, {
    atmosphere: atmo, width, height, pixelRatio: engine.pixelRatio, ...QS.postfx,
    ssr: QS.postfx.ssr ? { maxRoughness: 0.5, maxDistance: 80 } : false,
    bloom: { strength: 0.35, radius: 0.3, threshold: 2.5 },
  });
  postfx.aoPass.enabled = !!QS.passes.ao;
  if (clustered) {
    syncClustered(scene, true);
    postfx.onInternalResize = (w, h) => clustered.setSize(w, h);
    postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight);
  }
  postfx.track(car); // velocity for TAA / motion blur
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  engine.renderFn = (sc, cam, dt) => { if (clustered) clustered.update(cam); postfx.render(dt); };

  // ---------------------------------------------------------------- dust / tyre smoke
  const particles = GpuParticleSystem.isSupported(renderer)
    ? new GpuParticleSystem(renderer, { max: Math.round(8192 * QS.effects.particles), blending: 'normal', drag: 1.5, gravity: -0.4, fadeIn: 0.1, lit: true, litAmbient: 0.25, sun: atmo })
    : null;
  if (particles) scene.add(particles.mesh);
  const puff = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1.6, size0: 0.4, size1: 2.2, alpha: 0.35, r: 0.55, g: 0.5, b: 0.45 };
  let puffAcc = 0;

  // ---------------------------------------------------------------- input, camera, HUD, audio, quality menu
  const input = new VehicleInput(renderer.domElement, { touch: 'auto' });
  const rig = new ChaseRig(camera, renderer.domElement, { physics, minY: 0.6, canopyFromCollider: null, thinKinds: ['pole', 'gate'], flightFraming: false });
  rig.setTarget(car, () => state); rig.activate(); rig.snap();

  const ui = new UILayer();
  const panel = new Panel({ parent: ui, corner: 'bl' });
  const speedR = panel.add(new Readout({ label: 'SPEED', unit: 'km/h', value: '0' }));
  const lapR = panel.add(new Readout({ label: 'LAP', value: '--:--.--', sub: 'best --' }));
  const cpR = panel.add(new Readout({ label: 'CHECKPOINT', value: `0 / ${CHECKPOINTS.length}` }));
  new QualityMenu({ quality: Q, corner: 'tr' });

  const audio = new VehicleAudio({ volume: 0.6, ambience: false, topSpeed: 60 });
  const unlock = () => { audio.start(); };
  addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);
  const aState = { speedKmh: 0, rpmLike: 0, thrust: 0, grounded: true, mode: 'ground', wheelSlip: 0, boostLevel: 0, thrusterLevel: 1, damage: 0, altitude: 0 };

  // lap logic: pass the checkpoints in order; crossing the start gate starts / finishes a lap
  const lap = { next: 0, started: false, t: 0, best: Infinity, laps: 0, idx: N - 6 };
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  let prevIdx = N - 6;

  // ---------------------------------------------------------------- systems
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt);
      controls.throttle = input.throttle; controls.brake = input.brake; controls.steer = input.steer; controls.handbrake = input.handbrake;
      if (input.reset) { const p = track[lap.idx]; vc.reset(tmp.set(p.x, groundH(p.x, p.z), p.z), Math.atan2(-p.tx, -p.tz), physics); prevPos.copy(vc.position); prevQuat.copy(vc.quaternion); rig.snap(); }
      if (input.toggleCamera) rig.cycleMode();
    },
    fixedUpdate(dt) {
      prevPos.copy(vc.position); prevQuat.copy(vc.quaternion);
      vc.step(dt, controls, physics);
    },
    update(dt, alpha) {
      car.position.lerpVectors(prevPos, vc.position, alpha);
      car.quaternion.slerpQuaternions(prevQuat, vc.quaternion, alpha);
      for (let i = 0; i < 4; i++) { wheels[i].rotation.x -= vc.forwardSpeed * dt / SPEC.wheelRadius; if (i < 2) wheels[i].rotation.y = vc.steerAngle; }
      state.speedKmh = vc.speed * 3.6; state.gForce = vc.gForce; state.grounded = vc.grounded; state.wheelSlip = vc.wheelSlip;
    },
  }, 'car');
  engine.addSystem({ update: (dt) => rig.update(dt) }, 'camera');
  engine.addSystem({
    lateUpdate(dt) {
      atmo.update(camera.position, dt);
      // headlights follow the car (clustered spots: world position + direction every frame)
      if (clustered) {
        fwd.set(0, -0.08, -1).applyQuaternion(car.quaternion);
        for (const [k, s] of [[0, -1], [1, 1]]) {
          tmp.set(s * 0.65, 0.75, -2.3).applyQuaternion(car.quaternion).add(car.position);
          clustered.setSpot(lampCount + k, tmp.x, tmp.y, tmp.z, 60, 40, 38, 34, 1.6, fwd.x, fwd.y, fwd.z, Math.cos(0.3), Math.cos(0.45));
        }
      }
      // dust behind the rear wheels, more with speed and slip
      if (particles) {
        puffAcc += dt * (vc.speed * 1.5 + vc.wheelSlip * 60) * QS.effects.particles;
        while (puffAcc >= 1) {
          puffAcc -= 1;
          const s = Math.random() < 0.5 ? -1 : 1;
          tmp.set(s * SPEC.halfTrack, 0.15, SPEC.axleRear + 0.3).applyQuaternion(car.quaternion).add(car.position);
          Object.assign(puff, { x: tmp.x, y: tmp.y, z: tmp.z, vx: -vc.velocity.x * 0.1 + (Math.random() - 0.5), vy: 0.4 + Math.random() * 0.6, vz: -vc.velocity.z * 0.1 + (Math.random() - 0.5) });
          particles.emit(puff);
        }
        particles.update(dt, camera);
      }
      // laps and checkpoints
      const near = nearestIdx(vc.position.x, vc.position.z, prevIdx);
      lap.idx = near.i;
      const cp = CHECKPOINTS[lap.next];
      const crossed = (a, b, c) => ((c - a + N) % N) <= ((b - a + N) % N) && a !== b && ((b - a + N) % N) < N / 2;
      if (near.d < ROAD_W && crossed(prevIdx, near.i, cp)) {
        if (lap.next === 0) {
          if (lap.started) { lap.laps++; lap.best = Math.min(lap.best, lap.t); }
          lap.started = true; lap.t = 0;
        }
        lap.next = (lap.next + 1) % CHECKPOINTS.length;
      }
      prevIdx = near.i;
      if (lap.started) lap.t += dt;
      speedR.set(Math.round(Math.abs(vc.forwardSpeed) * 3.6));
      lapR.set(lap.started ? fmt(lap.t) : '--:--.--');
      lapR.setSub(`best ${Number.isFinite(lap.best) ? fmt(lap.best) : '--'} · laps ${lap.laps}`);
      cpR.set(`${lap.next === 0 && lap.started ? CHECKPOINTS.length : lap.next} / ${CHECKPOINTS.length}`);
      // sound
      aState.speedKmh = vc.speed * 3.6; aState.rpmLike = Math.min(1, controls.throttle * 0.4 + vc.speed / 60); aState.grounded = vc.grounded; aState.wheelSlip = vc.wheelSlip;
      audio.update(dt, aState);
      // motion blur only at speed
      if (QS.postfx.motionBlur) { const want = vc.speed > 18 ? QS.postfx.motionBlur : 0; if (postfx.get('motionBlur') !== want) postfx.set('motionBlur', want); }
    },
  }, 'game');

  await engine.load();
  engine.start();
  // harness / console handle
  window.__sample = {
    ready: true, engine, vc, lap, track, input, postfx, quality: Q, clustered, particles,
    hud: () => ({ speed: speedR.valueEl.textContent, lap: lapR.valueEl.textContent, cp: cpR.valueEl.textContent }),
  };
  console.info(`[trial-drive] ready · tier ${Q.tier} (${Q.source}) · ${lamps} lamps (${lampCount} clustered) · track ${trackLen.toFixed(0)} m`);
}

boot().catch((e) => { console.error('[trial-drive] boot failed', e); });
