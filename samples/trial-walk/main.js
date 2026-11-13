// Dusk walk (usability trial sample): a third-person walker on a small textured field at dusk collects glowing items.
// Engine pieces used: Engine (fixed step 120 Hz), PhysicsWorld (ground, static obstacles), DynamicsWorld (loose boxes
// the walker pushes: CharacterController.attachDynamics), CharacterInput (keyboard / touch), ThirdPersonRig,
// Assets + registerRenderLoaders (the Quaternius Man in Suit GLB), AnimationController (idle / walk / run blend tree),
// Atmosphere (dusk sky, sun, fog, shadows), PostFX (TAA + bloom on desktop), loadTextureSet (leafy_grass PBR set),
// NearestLights (lamps: a PointLight pool, or ClusteredLights on the desktop tier), UI kit (score Readout,
// QualityMenu), AudioBus + playTone (pickup chirp), resolveQuality (desktop / mobile tiers).
// window.__sample: { ready, auto, state() } for the headless check (test drives `auto` = a move direction).
import * as THREE from 'three';
import { Engine, Assets, resolveQuality } from '@vibe/engine/core';
import { PhysicsWorld, CharacterController, DynamicsWorld, attachToPhysicsWorld, boxShape } from '@vibe/engine/physics';
import { Atmosphere, PostFX, registerRenderLoaders, loadTextureSet, loadTextureManifest, ClusteredLights, installClusteredChunks, syncClustered } from '@vibe/engine/render';
import { AnimationController } from '@vibe/engine/anim';
import { CharacterInput } from '@vibe/engine/input';
import { ThirdPersonRig } from '@vibe/engine/camera';
import { AudioBus, playTone } from '@vibe/engine/audio';
import { UILayer, Panel, Readout, QualityMenu } from '@vibe/engine/ui';
import { NearestLights } from '@vibe/engine/world';

const BASE = import.meta.env.BASE_URL;

// ------------------------------------------------------------------ quality tiers
const Q = resolveQuality({
  storageKey: 'vibe.quality.trial-walk',
  overrides: {
    desktop: { walk: { lamps: 6, boxes: 6, items: 10 } },
    mobile: { walk: { lamps: 3, boxes: 3, items: 8 } },
  },
});
const S = Q.settings, W = S.walk, DESK = Q.tier === 'desktop';

async function boot() {
  // ---------------------------------------------------------------- engine, physics, sky
  const physics = new PhysicsWorld(); // flat ground at y = 0
  const engine = new Engine({ container: document.getElementById('app'), fixedHz: 120, maxSubsteps: 4, physics, renderer: { antialias: false }, ...S.engine });
  const { scene, camera, renderer } = engine;
  const atmo = new Atmosphere({ scene, renderer, camera, timeOfDay: 'dusk', shadows: S.shadows });

  // ---------------------------------------------------------------- ground (PBR set from the NYC demo's textures)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x6f7a5a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const texBase = `${BASE}nyc/textures/`;
  const texP = loadTextureManifest(texBase).then((manifest) => loadTextureSet('leafy_grass', { renderer, base: texBase, manifest }));

  // ---------------------------------------------------------------- static obstacles: crates of stone + lamp posts
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.8 });
  const addBlock = (x, z, sx, sy, sz) => {
    physics.addStaticBox(x - sx / 2, 0, x + sx / 2, sy, z - sz / 2, z + sz / 2); // (minX, minY, maxX, maxY, minZ, maxZ)
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), stone);
    m.position.set(x, sy / 2, z); m.castShadow = m.receiveShadow = true; scene.add(m);
  };
  addBlock(-6, -8, 3, 1.2, 2); addBlock(7, -4, 2, 2.5, 2); addBlock(-3, 6, 4, 0.8, 1.5); addBlock(9, 8, 1.5, 1.6, 4);
  const lampXZ = [[-4, -3], [4, -10], [-8, 4], [6, 4], [0, -16], [-12, -10]].slice(0, W.lamps);
  const pole = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.5, metalness: 0.6 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 6 });
  const lampPos = [];
  for (const [x, z] of lampXZ) {
    physics.addStaticBox(x - 0.1, 0, x + 0.1, 3.2, z - 0.1, z + 0.1);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), pole); p.position.set(x, 1.6, z); p.castShadow = true;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), bulbMat); b.position.set(x, 3.25, z);
    scene.add(p, b); lampPos.push([x, 3.1, z]);
  }

  // ---------------------------------------------------------------- loose boxes (DynamicsWorld, pushed by the walker)
  const dyn = new DynamicsWorld({ physics });
  attachToPhysicsWorld(dyn, physics);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xa0703c, roughness: 0.7 });
  const boxes = [];
  for (let i = 0; i < W.boxes; i++) {
    const h = 0.35, x = -2 + (i % 3) * 1.1, z = -5 - Math.floor(i / 3) * 1.1;
    const id = dyn.addBody({ shape: boxShape(h, h, h), position: [x, h + 0.01, z], density: 60, friction: 0.6 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(2 * h, 2 * h, 2 * h), crateMat); m.castShadow = m.receiveShadow = true;
    scene.add(m); boxes.push({ id, m });
  }

  // ---------------------------------------------------------------- the walker model (GLB + clips)
  const assets = new Assets({ base: `${BASE}nyc/` });
  registerRenderLoaders(assets, renderer, { ktx2: false, meshopt: false });
  assets.add('man', { type: 'gltf', url: 'models/ManInSuit.glb' });
  engine.addSystem(assets.system(), 'assets');
  await engine.load();
  const gltf = assets.get('man');
  const inst = gltf.instantiate();
  const model = inst.isObject3D ? inst : inst.scene;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; } });
  model.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(model), k = 1.8 / (bb.max.y - bb.min.y);
  model.scale.multiplyScalar(k); model.position.y = -bb.min.y * k;
  const player = new THREE.Group(), view = new THREE.Group();
  view.rotation.y = Math.PI; // GLB faces +Z, the rig / controller forward is -Z
  view.add(model); player.add(view); scene.add(player);
  const anim = new AnimationController(model, gltf.animations, {
    states: { idle: { clip: 'HumanArmature|Man_Idle' }, walk: { clip: 'HumanArmature|Man_Walk' }, run: { clip: 'HumanArmature|Man_Run' } },
    trees: { move: { type: '1d', param: 'speed', points: [{ at: 0, state: 'idle' }, { at: 2, state: 'walk' }, { at: 5.5, state: 'run' }] } },
    transitions: { default: 0.15 },
  });
  anim.play('move');

  const cc = new CharacterController({ radius: 0.32, height: 1.8 });
  cc.attachDynamics(dyn);
  cc.teleport(0, 0, 0);
  const state = { facing: 0, speed: 0, grounded: true, velocity: cc.velocity }; // read by the rig
  const prev = new THREE.Vector3(), cur = new THREE.Vector3();

  // ---------------------------------------------------------------- collectibles
  const itemMat = new THREE.MeshStandardMaterial({ color: 0x103040, emissive: 0x40e0ff, emissiveIntensity: 4 });
  const itemGeo = new THREE.OctahedronGeometry(0.25);
  const items = [];
  for (let i = 0; i < W.items; i++) {
    const a = i * 2.39996, r = i === 0 ? 3 : 4 + i * 1.6; // item 0 straight ahead of the start (on -Z)
    const x = i === 0 ? 0 : Math.cos(a) * r, z = i === 0 ? -3 : Math.sin(a) * r;
    const m = new THREE.Mesh(itemGeo, itemMat); m.position.set(x, 0.9, z); scene.add(m); items.push(m);
  }
  let score = 0;

  // ---------------------------------------------------------------- lamps: NearestLights (pool, or clustered on desktop)
  let clustered = null;
  if (S.lights.clustered) { installClusteredChunks(); clustered = new ClusteredLights({ zFar: 200 }); }
  const lamps = new NearestLights({ count: 8, color: 0xffb070, distance: 12, decay: 1.5, parent: scene, mode: clustered ? 'clustered' : 'pool', clustered });
  lamps.setPositions(lampPos);

  // ---------------------------------------------------------------- post
  const tex = await texP;
  if (tex) {
    for (const t of [tex.map, tex.normalMap, tex.roughnessMap]) if (t) t.repeat.set(80 / tex.size, 80 / tex.size);
    Object.assign(ground.material, { map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap, color: new THREE.Color(0xffffff) });
    ground.material.needsUpdate = true;
  } else console.warn('[trial-walk] grass texture set not found');
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, { atmosphere: atmo, width, height, pixelRatio: engine.pixelRatio, ...S.postfx, ssr: false, volumetric: false, motionBlur: 0 });
  postfx.setTimeOfDay(atmo.darkness);
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom !== false;
  if (postfx.aoPass && !S.passes.ao) postfx.aoPass.enabled = false;
  model.traverse((o) => { if (o.isMesh) postfx.track(o); });
  for (const b of boxes) postfx.track(b.m);
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  if (clustered) {
    syncClustered(scene, true);
    postfx.onInternalResize = (w, h) => clustered.setSize(w, h);
    postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight);
  }

  // ---------------------------------------------------------------- input, camera, HUD, audio
  const canvas = renderer.domElement;
  const input = new CharacterInput({ element: canvas });
  const rig = new ThirdPersonRig(camera, canvas, { physics, distance: 4.2, height: 1.6 });
  rig.setTarget(player, () => state);
  rig.snap();
  const layer = new UILayer();
  const panel = new Panel({ parent: layer, corner: 'tl' });
  const readout = new Readout({ label: 'ITEMS', value: '0', unit: `/${items.length}` });
  panel.add(readout);
  new QualityMenu({ quality: Q, corner: 'tr' });
  const bus = new AudioBus({ volume: 0.7 });
  bus.unlockOnGesture();
  let chirps = 0;
  const chirp = () => {
    chirps++;
    const out = bus.started ? bus.bus('ui') : null;
    if (out) playTone(bus.ctx, out, { type: 'triangle', pitch: [[0, 880], [0.09, 1320]], peak: 0.2, attack: 0.003, decay: 0.25, when: bus.ctx.currentTime });
  };

  // ---------------------------------------------------------------- systems
  const auto = { on: false, x: 0, z: 0 }; // scripted drive for the headless check
  const intent = { x: 0, z: 0, jump: false, sprint: false };
  const _f = new THREE.Vector3(), _r = new THREE.Vector3();
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt);
      const c = input.controls;
      if (c.lookX || c.lookY) rig.turn(-c.lookX, -c.lookY);
      rig.getForward(_f); rig.getRight(_r);
      intent.x = _r.x * c.moveX + _f.x * c.moveY; intent.z = _r.z * c.moveX + _f.z * c.moveY;
      if (auto.on) { intent.x = auto.x; intent.z = auto.z; }
      intent.sprint = c.sprint; if (c.jump) intent.jump = true;
    },
    fixedUpdate(dt) {
      prev.copy(cur);
      cc.step(dt, intent.x, intent.z, intent.jump, intent.sprint, physics);
      intent.jump = false;
      cur.copy(cc.position);
      for (const m of items) {
        if (!m.visible) continue;
        const dx = m.position.x - cc.position.x, dz = m.position.z - cc.position.z;
        if (dx * dx + dz * dz < 0.7 * 0.7) { m.visible = false; scene.remove(m); score++; readout.set(String(score), `/${items.length}`); chirp(); }
      }
    },
    update(dt, alpha) {
      player.position.lerpVectors(prev, cur, alpha);
      if (intent.x * intent.x + intent.z * intent.z > 0.01) {
        const goal = Math.atan2(-intent.x, -intent.z);
        let d = goal - state.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        state.facing += d * (1 - Math.exp(-10 * dt));
      }
      player.rotation.y = state.facing;
      state.speed = cc.speed; state.grounded = cc.grounded;
      anim.setParam('speed', cc.speed).update(dt);
      for (const m of items) m.rotation.y += dt * 2;
    },
  }, 'player');
  engine.addSystem({ fixedUpdate: (dt) => dyn.step(dt) }, 'dynamics');
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion();
  engine.addSystem({ update() { for (const b of boxes) { dyn.getPose(b.id, _p, _q); b.m.position.copy(_p); b.m.quaternion.copy(_q); } } }, 'boxes');
  engine.addSystem({ update: (dt) => rig.update(dt) }, 'camera');
  engine.addSystem({
    lateUpdate(dt) {
      atmo.update(camera.position, dt);
      lamps.update(dt, { position: camera.position }, 8); // intensity: 1 is invisible against the dusk sky light
      if (clustered) clustered.update(camera);
    },
  }, 'world');
  engine.start();

  window.__sample = {
    ready: true, tier: Q.tier, auto, bus, lamps, clustered, anim, get chirps() { return chirps; },
    state: () => ({ x: cc.position.x, y: cc.position.y, z: cc.position.z, score, items: items.length, walkWeight: anim.getWeight('walk'), speed: cc.speed, boxes: boxes.map((b) => { dyn.getPose(b.id, _p, null); return [_p.x, _p.y, _p.z]; }) }),
  };
}

boot().catch((e) => { console.error('[trial-walk] boot failed', e); });
