// Trial: night courier. Drive a van around a hilly loop lit by street lamps, stop at the depot, get out (E / F or
// the SWITCH button), walk the yard collecting parcels, get back in (E near the van) and drive on.
// Built from samples/starter-drive and samples/starter-walk plus docs/HOWTO.md recipes.
import * as THREE from 'three';
import { Engine, Assets, PoseInterpolator, resolveQuality, createBenchHarness } from '@vibe/engine/core';
import { PhysicsWorld, CharacterController, VehicleController, ROAD_CAR_SPEC, DynamicsWorld, attachToPhysicsWorld, boxShape } from '@vibe/engine/physics';
import {
  Atmosphere, PostFX, NearestLights, ClusteredLights, installClusteredChunks, syncClustered, GpuParticleSystem,
  registerRenderLoaders, loadTextureManifest, loadTextureSet,
} from '@vibe/engine/render';
import { AnimationController } from '@vibe/engine/anim';
import { CharacterInput, VehicleInput } from '@vibe/engine/input';
import { ThirdPersonRig, ChaseRig } from '@vibe/engine/camera';
import { AudioBus, playTone, VehicleAudio } from '@vibe/engine/audio';
import { UILayer, Panel, Readout, QualityMenu } from '@vibe/engine/ui';
import { makeVehicleGeometry, createVehicleMaterial, makeFurnitureGeometry, createFurnitureMaterial, buildTreeMeshes } from '@vibe/engine/world';

const BASE = import.meta.env.BASE_URL;
const Q = resolveQuality();
const S = Q.settings;
const CLUSTERED = !!S.lights.clustered; // desktop: every lamp lights; mobile: a pool of the nearest few

// ---- the level: an elliptical road loop over gentle hills, with a flat depot yard inside the loop
const RX = 120, RZ = 60, ROAD_W = 8;
const YARD = { x: 0, z: 38, w: 26, d: 16 };
const rawHills = (x, z) => 1.6 * Math.sin(x / 28) * Math.cos(z / 33) + 0.8 * Math.sin(z / 19 + x / 40);
const YARD_Y = rawHills(YARD.x, YARD.z);
const yardBlend = (x, z) => { // 1 inside the yard, 0 a few metres outside
  const dx = Math.max(0, Math.abs(x - YARD.x) - YARD.w / 2), dz = Math.max(0, Math.abs(z - YARD.z) - YARD.d / 2);
  const d = Math.hypot(dx, dz); return d >= 6 ? 0 : 1 - d / 6;
};
const hills = (x, z) => { const k = yardBlend(x, z); return rawHills(x, z) * (1 - k) + YARD_Y * k; };
const loopAt = (t) => [RX * Math.cos(t), RZ * Math.sin(t)];
const roadDist = (x, z) => Math.abs(Math.hypot(x / RX, z / RZ) - 1) * Math.min(RX, RZ); // rough metres from the centre line

async function boot() {
  if (CLUSTERED) installClusteredChunks(); // before any material compiles
  const physics = new PhysicsWorld({ heightfield: hills });
  physics.setSurfaceProvider((x, z, out) => {
    const onRoad = roadDist(x, z) < ROAD_W / 2;
    out.mu = onRoad ? 1 : 0.6; out.crr = onRoad ? 1 : 4; out.tag = onRoad ? 'asphalt' : 'grass';
    return out;
  });
  const engine = new Engine({ container: document.getElementById('app'), physics, renderer: { antialias: false }, ...S.engine });
  const { scene, camera, renderer } = engine;
  const atmosphere = new Atmosphere({ scene, renderer, camera, timeOfDay: 'night', shadows: S.shadows, moonScatter: 0.4 });

  // ---- ground, road ribbon and yard, all draped on the same height function
  const drape = (geo, lift) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hills(p.getX(i), p.getZ(i)) + lift); geo.computeVertexNormals(); return geo; };
  const ground = new THREE.Mesh(drape(new THREE.PlaneGeometry(400, 400, 160, 160).rotateX(-Math.PI / 2), 0), new THREE.MeshStandardMaterial({ color: 0x3d4a30, roughness: 1 }));
  const N = 256, pos = [], uv = [], idx = [];
  let along = 0;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2, [x, z] = loopAt(t);
    const tx = -RX * Math.sin(t), tz = RZ * Math.cos(t), tl = Math.hypot(tx, tz), nx = tz / tl, nz = -tx / tl;
    if (i > 0) { const [px, pz] = loopAt(((i - 1) / N) * Math.PI * 2); along += Math.hypot(x - px, z - pz); }
    for (const s of [-1, 1]) {
      const vx = x + nx * s * ROAD_W / 2, vz = z + nz * s * ROAD_W / 2;
      pos.push(vx, hills(vx, vz) + 0.06, vz); uv.push((s + 1) / 2, along / ROAD_W);
    }
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  roadGeo.setIndex(idx); roadGeo.computeVertexNormals();
  if (roadGeo.attributes.normal.getY(0) < 0) { idx.reverse(); roadGeo.setIndex(idx); roadGeo.computeVertexNormals(); } // winding: face up
  const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.35 })); // damp: low roughness for SSR
  const yard = new THREE.Mesh(drape(new THREE.PlaneGeometry(YARD.w, YARD.d, 26, 16).rotateX(-Math.PI / 2).translate(YARD.x, 0, YARD.z), 0.05), new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 }));
  for (const m of [ground, road, yard]) { m.receiveShadow = true; scene.add(m); }
  const texBase = `${BASE}nyc/textures/`, manifest = await loadTextureManifest(texBase);
  const texture = async (mesh, id, rx, ry) => {
    const set = await loadTextureSet(id, { renderer, base: texBase, manifest });
    if (!set) return;
    for (const t of [set.map, set.normalMap, set.roughnessMap]) if (t) t.repeat.set(rx / set.size, ry / set.size);
    Object.assign(mesh.material, { map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, color: new THREE.Color(0xffffff) });
  };
  await Promise.all([texture(road, 'asphalt_02', ROAD_W, ROAD_W), texture(yard, 'concrete_pavement', YARD.w, YARD.d), texture(ground, 'leafy_grass', 400, 400)]);

  // ---- solid obstacles: the depot shed at the back of the yard and concrete blocks; loose crates in the yard
  const solid = (x, z, w, h, d, color) => {
    const y = hills(x, z) + h / 2, m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m);
    physics.addStaticBox({ center: [x, y, z], size: [w, h, d], kind: 'wall' });
  };
  solid(YARD.x, YARD.z - YARD.d / 2 - 1.5, 16, 4, 3, 0x6b6157);
  for (const [x, z] of [[-40, 20], [45, -15], [20, -30], [-55, -10]]) solid(x, z, 2, 1.2, 2, 0x8a8a84);
  const dyn = new DynamicsWorld({ physics, substeps: 4 });
  attachToPhysicsWorld(dyn, physics);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b6a3e, roughness: 0.8 });
  const crates = [[-6, 36], [-4.8, 36.2], [6, 40], [7, 34], [-9, 42]].map(([x, z]) => {
    const body = dyn.addBody({ shape: boxShape(0.4, 0.4, 0.4), position: [x, hills(x, z) + 0.45, z], mass: 20 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat); mesh.castShadow = true; scene.add(mesh);
    return { body, mesh };
  });

  // ---- ready-made engine assets: cobra street lights round the loop, bollards at the yard, oak trees
  const lampGeo = makeFurnitureGeometry('cobraRes'), lampMat = createFurnitureMaterial();
  if (lampMat.userData.u?.uNight) lampMat.userData.u.uNight.value = 1;
  lampGeo.computeBoundingBox();
  const armReach = lampGeo.boundingBox.max.x, lampTop = lampGeo.boundingBox.max.y;
  const LAMPS = 24, lampPos = [], lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, LAMPS), mtx = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < LAMPS; i++) {
    const t = (i / LAMPS) * Math.PI * 2, [cx, cz] = loopAt(t);
    const nx = Math.cos(t) / RX, nz = Math.sin(t) / RZ, nl = Math.hypot(nx, nz); // outward normal of the ellipse
    const ox = nx / nl, oz = nz / nl, x = cx + ox * (ROAD_W / 2 + 1.2), z = cz + oz * (ROAD_W / 2 + 1.2), y = hills(x, z);
    const yaw = Math.atan2(oz, -ox); // the arm (+X) points back over the road
    mtx.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    lampMesh.setMatrixAt(i, mtx); lampMesh.setColorAt(i, new THREE.Color(0x404448));
    lampPos.push([x - ox * (armReach - 0.4), y + lampTop - 0.3, z - oz * (armReach - 0.4)]);
    physics.addStaticBox({ center: [x, y + 2, z], size: [0.3, 4, 0.3], kind: 'post' });
  }
  lampMesh.castShadow = true; scene.add(lampMesh);
  const bollGeo = makeFurnitureGeometry('bollard'), bollPts = [];
  for (let x = -YARD.w / 2; x <= YARD.w / 2; x += 2.6) if (Math.abs(x) > 5) bollPts.push([x, YARD.z + YARD.d / 2]);
  const bollards = new THREE.InstancedMesh(bollGeo, createFurnitureMaterial(), bollPts.length);
  bollPts.forEach(([x, z], i) => {
    bollards.setMatrixAt(i, mtx.makeTranslation(x, hills(x, z), z)); bollards.setColorAt(i, new THREE.Color(0xd8b020));
    physics.addStaticBox({ center: [x, hills(x, z) + 0.5, z], size: [0.3, 1, 0.3], kind: 'post' });
  });
  scene.add(bollards);
  const treeSpots = [];
  for (let i = 0; i < 28; i++) { const t = i * 0.83, r = 1.4 + 0.2 * Math.sin(i * 2.1); treeSpots.push({ x: RX * r * Math.cos(t), z: RZ * r * Math.sin(t), s: 1, hue: (i % 5) / 5, kind: 'park', ctx: { park: 'park' } }); }
  const trees = buildTreeMeshes(treeSpots, { groundAt: hills, mix: { park: [['oak', 1]] } });
  scene.add(trees.group);

  // ---- lamps: clustered (desktop, every lamp lit) or a NearestLights pool (mobile)
  let cl = null, pool = null;
  const LAMP_RANGE = 30, LAMP_I = 150;
  if (CLUSTERED) {
    cl = new ClusteredLights({ maxLights: 64 });
    lampPos.forEach(([x, y, z], i) => cl.setLight(i, x, y, z, LAMP_RANGE, LAMP_I * 1.0, LAMP_I * 0.72, LAMP_I * 0.42, 2));
    syncClustered(scene, true);
  } else {
    pool = new NearestLights({ count: 4, color: 0xffb870, distance: LAMP_RANGE, decay: 2, parent: scene });
    pool.setPositions(lampPos);
  }

  // ---- the van: VehicleController (an ordinary road car sized like the minivan) under the engine's minivan body
  const SPEC = { ...ROAD_CAR_SPEC, length: 5.16, width: 1.99, height: 1.74, mass: 2100, motorPower: 95e3, vMax: 42 };
  const car = new VehicleController(SPEC);
  const T0 = Math.PI / 2 + 0.25, [sx, sz] = loopAt(T0);
  const START = new THREE.Vector3(sx, hills(sx, sz), sz), START_YAW = Math.atan2(-RX * Math.sin(T0), RZ * Math.cos(T0)); // heading along -dt
  car.reset(START, START_YAW, physics);
  const body = new THREE.Group();
  const vanGeo = makeVehicleGeometry('minivan', { lod: 'hd' });
  const vanMats = [createVehicleMaterial({ hd: true, brake: false }), createVehicleMaterial({ hd: true, glass: true, brake: false })];
  for (const m of vanMats) if (m.userData.u?.uDark) m.userData.u.uDark.value = 1; // lamps on
  const van = new THREE.InstancedMesh(vanGeo, vanMats, 1);
  van.setMatrixAt(0, new THREE.Matrix4()); van.setColorAt(0, new THREE.Color(0xe8e4dc)); van.castShadow = true; van.frustumCulled = false;
  body.add(van);
  for (const sx2 of [-0.7, 0.7]) { // headlights
    const head = new THREE.SpotLight(0xfff2dd, 60, 60, 0.5, 0.5, 1.5);
    head.position.set(sx2, 0.8, -2.4); head.target.position.set(sx2, 0, -20);
    body.add(head, head.target);
  }
  scene.add(body);
  const carSmooth = new PoseInterpolator(car); carSmooth.snap(); carSmooth.apply(body, 1);

  // ---- the walker (starter-walk's character)
  const assets = new Assets({ base: `${BASE}nyc/models/` });
  registerRenderLoaders(assets, renderer);
  assets.add('hero', { type: 'gltf', url: 'ManInSuit.glb' });
  engine.addSystem(assets.system(), 'assets');
  await engine.load();
  const gltf = assets.get('hero'), model = gltf.instantiate();
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), k = 1.8 / (box.max.y - box.min.y);
  model.scale.multiplyScalar(k); model.position.y = -box.min.y * k; model.rotation.y = Math.PI;
  const player = new THREE.Group(); player.add(model); player.visible = false; scene.add(player);
  const anim = new AnimationController(model, gltf.animations, {
    states: { idle: { clip: 'HumanArmature|Man_Idle' }, walk: { clip: 'HumanArmature|Man_Walk' }, run: { clip: 'HumanArmature|Man_Run' } },
    trees: { move: { type: '1d', param: 'speed', points: [{ at: 0, state: 'idle' }, { at: 2, state: 'walk' }, { at: 5.5, state: 'run' }] } },
  });
  anim.play('move');
  const cc = new CharacterController({ radius: 0.32, height: 1.8 });
  cc.attachDynamics(dyn); // pushes the crates
  const ccSmooth = new PoseInterpolator(cc);
  const walkState = { facing: 0 };

  // ---- post-processing (tier: desktop G-buffer + TAA + SSR, mobile FXAA), with the clustered resize hook
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  postfx.track(body); postfx.track(player);
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  if (cl) { postfx.onInternalResize = (w, h) => cl.setSize(w, h); postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight); }

  // ---- dust behind the rear wheels (GPU particles; budget from the tier)
  const dust = GpuParticleSystem.isSupported(renderer) && S.effects.particles > 0
    ? new GpuParticleSystem(renderer, { max: Math.round(16384 * S.effects.particles), blending: 'normal', drag: 0.25, lit: true, sun: atmosphere }) : null;
  if (dust) scene.add(dust.mesh);
  const dp = { x: 0, y: 0, z: 0, vx: 0, vy: 0.8, vz: 0, life: 1.6, size0: 0.25, size1: 1.1, alpha: 0.35, r: 0.55, g: 0.5, b: 0.42 };
  const wheelW = new THREE.Vector3();

  // ---- inputs and cameras: one of each per mode
  const carInput = new VehicleInput(renderer.domElement, { touch: 'auto' });
  const walkInput = new CharacterInput({ element: renderer.domElement });
  const touchDevice = !!carInput.touch; // touch: 'auto' built the on-screen controls only on a touch-first device
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const carState = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0 };
  const chase = new ChaseRig(camera, renderer.domElement, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false });
  chase.setTarget(body, () => carState);
  const third = new ThirdPersonRig(camera, renderer.domElement, { physics, distance: 4.2, height: 1.6 });
  third.setTarget(player, () => walkState);

  // ---- HUD and sound
  const ui = new UILayer();
  const panel = new Panel({ parent: ui, corner: 'tl' });
  const speedRo = panel.add(new Readout({ label: 'SPEED', value: '0', unit: 'km/h' }));
  const parcelRo = panel.add(new Readout({ label: 'PARCELS', value: '0', unit: '' }));
  const modeRo = panel.add(new Readout({ label: 'MODE', value: 'DRIVE', unit: '' }));
  new QualityMenu({ quality: Q, corner: 'tr' });
  const btn = Object.assign(document.createElement('button'), { textContent: 'SWITCH (E)' });
  Object.assign(btn.style, { position: 'fixed', right: '16px', bottom: '200px', zIndex: 40, padding: '10px 14px', font: '600 13px system-ui', borderRadius: '8px', border: '0', background: '#f0c060' });
  document.body.appendChild(btn);
  const audio = new AudioBus({ volume: 0.7 });
  audio.unlockOnGesture();
  const vanSound = new VehicleAudio({ volume: 0.5, ambience: false });
  const startVan = () => vanSound.start();
  addEventListener('keydown', startVan, { once: true }); addEventListener('pointerdown', startVan, { once: true });
  const sound = { speedKmh: 0, rpmLike: 0, thrust: 0, grounded: true, mode: 'ground', wheelSlip: 0 };
  const chime = () => { if (audio.started) playTone(audio.ctx, audio.bus('ui'), { type: 'sine', pitch: [[0, 880], [0.1, 1320]], peak: 0.25, decay: 0.35 }); };

  // ---- parcels in the yard
  const parcelMat = new THREE.MeshStandardMaterial({ color: 0xc89040, emissive: 0x402000, roughness: 0.6 });
  const parcels = [[-3, 44], [3, 45], [9, 38], [-10, 36], [0, 33], [11, 44]].map(([x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), parcelMat); m.position.set(x, hills(x, z) + 0.6, z); m.castShadow = true; scene.add(m);
    return m;
  });
  let collected = 0;

  // ---- switching: E / F (CharacterInput's interact keys) or the button
  let mode = 'drive', switchReq = false;
  const setMode = (m) => {
    mode = m;
    const walking = m === 'walk';
    player.visible = walking; walkInput.enabled = walking; carInput.map.enabled = !walking;
    if (touchDevice) { carInput.enableTouch(!walking); walkInput.enableTouch(walking); } // one set of on-screen controls at a time
    modeRo.set(walking ? 'WALK' : 'DRIVE');
  };
  const trySwitch = () => {
    if (mode === 'drive' && car.speed < 1.5) {
      const h = car.heading, rx = Math.cos(h), rz = -Math.sin(h); // the van's right side
      const x = car.position.x + rx * 2.3, z = car.position.z + rz * 2.3;
      cc.teleport(x, hills(x, z) + 0.05, z); ccSmooth.snap(); walkState.facing = h; third.yaw = h;
      setMode('walk');
    } else if (mode === 'walk' && cc.position.distanceTo(car.position) < 4.5) setMode('drive');
  };
  addEventListener('keydown', (e) => { if ((e.code === 'KeyE' || e.code === 'KeyF') && !e.repeat) switchReq = true; });
  btn.addEventListener('click', () => { switchReq = true; });
  setMode('drive');

  const move = { x: 0, z: 0 }, fwd = new THREE.Vector3(), right = new THREE.Vector3();
  let time = 0;
  engine.addSystem({
    earlyUpdate(dt) {
      carInput.update(dt); walkInput.update(dt);
      if (switchReq) { switchReq = false; trySwitch(); }
      if (mode === 'drive') {
        controls.throttle = carInput.throttle; controls.brake = carInput.brake; controls.steer = carInput.steer; controls.handbrake = carInput.handbrake;
        if (carInput.toggleCamera) chase.cycleMode();
        move.x = move.z = 0;
      } else {
        controls.throttle = 0; controls.brake = 1; controls.steer = 0; controls.handbrake = true; // parked
        const c = walkInput.controls;
        third.turn(-c.lookX, -c.lookY);
        third.getForward(fwd); third.getRight(right);
        move.x = right.x * c.moveX + fwd.x * c.moveY; move.z = right.z * c.moveX + fwd.z * c.moveY;
      }
    },
    fixedUpdate(dt) {
      carSmooth.save(); car.step(dt, controls, physics);
      if (mode === 'walk') { ccSmooth.save(); cc.step(dt, move.x, move.z, walkInput.controls.jumpHeld, walkInput.controls.sprint, physics); }
      dyn.step(dt);
    },
    update(dt, alpha) {
      time += dt;
      carSmooth.apply(body, alpha);
      for (const c of crates) dyn.getPose(c.body, c.mesh.position, c.mesh.quaternion);
      carState.speedKmh = car.speed * 3.6; carState.grounded = car.grounded; carState.wheelSlip = car.wheelSlip;
      if (mode === 'walk') {
        ccSmooth.apply(player, alpha);
        if (move.x * move.x + move.z * move.z > 0.01) {
          const d = Math.atan2(-move.x, -move.z) - walkState.facing;
          walkState.facing += Math.atan2(Math.sin(d), Math.cos(d)) * (1 - Math.exp(-10 * dt));
        }
        player.rotation.y = walkState.facing;
        anim.setParam('speed', cc.speed).update(dt);
        third.update(dt);
        for (const p of parcels) if (p.visible && p.position.distanceTo(cc.position) < 1.4) { p.visible = false; collected++; chime(); }
      } else chase.update(dt);
      for (const p of parcels) p.rotation.y += dt;
      // dust from the rear wheels, more off the road
      if (dust) {
        const n = car.speed > 2 ? Math.round((roadDist(car.position.x, car.position.z) < ROAD_W / 2 ? 2 : 6) * Math.min(1, car.speed / 15)) : 0;
        for (let w = 2; w < 4 && n; w++) {
          wheelW.set(car.wheels[w].x, 0.15, car.wheels[w].z).applyQuaternion(body.quaternion).add(body.position);
          for (let i = 0; i < n; i++) {
            dp.x = wheelW.x; dp.y = wheelW.y; dp.z = wheelW.z; dp.vx = (Math.random() - 0.5) * 1.5; dp.vz = (Math.random() - 0.5) * 1.5;
            dust.emit(dp);
          }
        }
      }
      sound.speedKmh = mode === 'drive' ? Math.abs(car.forwardSpeed) * 3.6 : 0; sound.rpmLike = controls.throttle; sound.grounded = car.grounded; sound.wheelSlip = car.wheelSlip;
      vanSound.update(dt, sound);
    },
    lateUpdate(dt) {
      atmosphere.update(camera.position, dt);
      if (cl) cl.update(camera); else pool.update(dt, { position: camera.position }, LAMP_I);
      trees.update(dt, camera.position, 0, time);
      if (dust) dust.update(dt, camera);
      speedRo.set(Math.round(Math.abs(car.forwardSpeed) * 3.6));
      parcelRo.set(String(collected));
    },
  }, 'game');
  engine.start();

  window.__sample = Object.assign(createBenchHarness(engine, { name: 'trial-courier' }), {
    car, cc, parcels, third, crates: crates.map((c) => c.mesh), game: () => ({ mode, collected }),
    aimAt(x, z) { const dx = x - cc.position.x, dz = z - cc.position.z; third.yaw = Math.atan2(-dx, -dz); },
  }).setReady();
}

boot().catch((e) => console.error('[trial-courier] boot failed', e));
