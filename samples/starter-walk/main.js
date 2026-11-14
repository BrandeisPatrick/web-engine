// Starter: a third-person walker. Copy this folder to start a game: flat textured ground, an animated GLB character
// (idle / walk), a lamp, dusk sky, post-processing, the desktop / mobile quality tiers, one HUD readout and one sound.
// Every block says what it is and what a game would change. Controls: WASD / arrows, mouse (right-drag or click to
// lock), Space jumps, Shift runs; gamepad and touch work too.
// The `// #region howto:` markers are for docs/HOWTO.md, which copies those blocks (test/docs.mjs checks the copies).
import * as THREE from 'three';
import { Engine, Assets, PoseInterpolator, resolveQuality, createBenchHarness } from '@vibe/engine/core';
import { PhysicsWorld, CharacterController } from '@vibe/engine/physics';
import { Atmosphere, PostFX, NearestLights, registerRenderLoaders, loadTextureManifest, loadTextureSet } from '@vibe/engine/render';
import { AnimationController } from '@vibe/engine/anim';
import { CharacterInput } from '@vibe/engine/input';
import { ThirdPersonRig } from '@vibe/engine/camera';
import { AudioBus, playTone } from '@vibe/engine/audio';
import { UILayer, Panel, Readout, QualityMenu } from '@vibe/engine/ui';

const BASE = import.meta.env.BASE_URL; // asset URLs go through it, so the page also works under a sub-path

// ---- quality tier: 'desktop' or 'mobile' (?quality=mobile forces one; the gear button stores a choice)
// #region howto:quality
const Q = resolveQuality();
const S = Q.settings;
// #endregion howto:quality

async function boot() {
  // #region howto:walk-engine
  // ---- engine + physics. PhysicsWorld() is flat ground at y = 0; add a heightfield / static boxes for a real level
  const physics = new PhysicsWorld();
  const engine = new Engine({ container: document.getElementById('app'), physics, renderer: { antialias: false }, ...S.engine });
  const { scene, camera, renderer } = engine;

  // ---- sky, sun, fog and shadows. timeOfDay: hours 0..24 or 'dawn' | 'noon' | 'golden' | 'dusk' | 'night'
  const atmosphere = new Atmosphere({ scene, renderer, camera, timeOfDay: 'dusk', shadows: S.shadows });
  // #endregion howto:walk-engine

  // ---- ground with a PBR texture set. `base` is the folder holding manifest.json and one folder per set id
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f7a5a }));
  ground.receiveShadow = true;
  scene.add(ground);
  // #region howto:ground-texture
  const texBase = `${BASE}nyc/textures/`;
  const grass = await loadTextureSet('leafy_grass', { renderer, base: texBase, manifest: await loadTextureManifest(texBase) });
  if (grass) {
    for (const t of [grass.map, grass.normalMap, grass.roughnessMap]) if (t) t.repeat.set(80 / grass.size, 80 / grass.size); // size: metres per tile
    Object.assign(ground.material, { map: grass.map, normalMap: grass.normalMap, roughnessMap: grass.roughnessMap, color: new THREE.Color(0xffffff) });
  }
  // #endregion howto:ground-texture

  // ---- one lamp: a post with a glowing bulb, lit by NearestLights (a pool of real lights; give it many positions)
  const lampAt = new THREE.Vector3(3, 3.2, -6);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.6, roughness: 0.5 }));
  post.position.set(lampAt.x, 1.6, lampAt.z); post.castShadow = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 6 }));
  bulb.position.copy(lampAt).y += 0.15;
  scene.add(post, bulb);
  physics.addStaticBox({ center: [lampAt.x, 1.6, lampAt.z], size: [0.2, 3.2, 0.2] }); // the walker cannot pass through it
  // #region howto:lamp
  const lamps = new NearestLights({ count: 1, color: 0xffb070, distance: 12, decay: 1.5, parent: scene });
  lamps.setPositions([[lampAt.x, lampAt.y, lampAt.z]]);
  // #endregion howto:lamp

  // ---- the character: a GLB with clips. Change the file, the height and the clip names for your own model
  // #region howto:glb-load
  const assets = new Assets({ base: `${BASE}nyc/models/` });
  registerRenderLoaders(assets, renderer);
  assets.add('hero', { type: 'gltf', url: 'ManInSuit.glb' });
  engine.addSystem(assets.system(), 'assets');
  await engine.load();
  /** @type {import('@vibe/engine/render').GltfAsset} */
  const gltf = assets.get('hero');
  const model = gltf.instantiate(); // an Object3D (a skinning-safe clone)
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  model.updateMatrixWorld(true); // bones too: the skinned bounds below read them
  const box = new THREE.Box3().setFromObject(model), k = 1.8 / (box.max.y - box.min.y); // fit to 1.8 m, feet at y = 0
  model.scale.multiplyScalar(k); model.position.y = -box.min.y * k;
  model.rotation.y = Math.PI; // this GLB faces +Z; the engine's forward is -Z
  const player = new THREE.Group();
  player.add(model);
  scene.add(player);
  // #endregion howto:glb-load
  // #region howto:glb-anim
  // states name clips by string (the GLB's names; a wrong name throws and lists the right ones); the tree blends by speed
  const anim = new AnimationController(model, gltf.animations, {
    states: { idle: { clip: 'HumanArmature|Man_Idle' }, walk: { clip: 'HumanArmature|Man_Walk' }, run: { clip: 'HumanArmature|Man_Run' } },
    trees: { move: { type: '1d', param: 'speed', points: [{ at: 0, state: 'idle' }, { at: 2, state: 'walk' }, { at: 5.5, state: 'run' }] } },
  });
  anim.play('move');
  // #endregion howto:glb-anim

  // ---- movement: a capsule controller stepped at the fixed rate, drawn between steps by PoseInterpolator
  // #region howto:character-controller
  const cc = new CharacterController({ radius: 0.32, height: 1.8 });
  const smooth = new PoseInterpolator(cc); // the controller has no rotation: the game turns `player` itself
  const state = { facing: 0 };            // read by the camera rig (it turns behind `facing`)
  // #endregion howto:character-controller

  // ---- post-processing with the tier's settings (desktop: G-buffer + TAA + SSR; mobile: FXAA), resize hook
  // #region howto:postfx
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;          // `passes` is the game's to apply
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  postfx.track(player); // per-object velocity for TAA / motion blur on moving meshes
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  // #endregion howto:postfx

  // ---- input and camera
  // #region howto:character-camera
  const input = new CharacterInput({ element: renderer.domElement });
  const rig = new ThirdPersonRig(camera, renderer.domElement, { physics, distance: 4.2, height: 1.6 });
  rig.setTarget(player, () => state);
  // #endregion howto:character-camera

  // ---- HUD (one readout), the quality menu, and a sound (Web Audio starts on the first click / key)
  // #region howto:hud
  const panel = new Panel({ parent: new UILayer(), corner: 'tl' });
  const distance = panel.add(new Readout({ label: 'WALKED', value: '0', unit: 'm' }));
  new QualityMenu({ quality: Q, corner: 'tr' });
  // #endregion howto:hud
  // #region howto:sound
  const audio = new AudioBus({ volume: 0.7 });
  audio.unlockOnGesture();
  const hop = () => { if (audio.started) playTone(audio.ctx, audio.bus('ui'), { type: 'triangle', pitch: [[0, 660], [0.08, 990]], peak: 0.2, decay: 0.2 }); };
  // #endregion howto:sound

  // ---- the game loop: input per frame, simulation per fixed step, drawing per frame
  const move = { x: 0, z: 0 }, fwd = new THREE.Vector3(), right = new THREE.Vector3();
  let walked = 0;
  engine.addSystem({
    // #region howto:walk-input
    earlyUpdate(dt) {
      input.update(dt);
      const c = input.controls;
      rig.turn(-c.lookX, -c.lookY);
      rig.getForward(fwd); rig.getRight(right); // camera-relative movement
      move.x = right.x * c.moveX + fwd.x * c.moveY; move.z = right.z * c.moveX + fwd.z * c.moveY;
    },
    // #endregion howto:walk-input
    // #region howto:walk-step
    fixedUpdate(dt) {
      smooth.save(); // before the step: the pose PoseInterpolator blends from
      const c = input.controls;
      cc.step(dt, move.x, move.z, c.jumpHeld, c.sprint, physics);
      if (cc.jumpedThisStep) hop();
      walked += cc.speed * dt;
    },
    // #endregion howto:walk-step
    // #region howto:walk-draw
    update(dt, alpha) {
      smooth.apply(player, alpha);
      if (move.x * move.x + move.z * move.z > 0.01) { // turn toward the move direction
        const d = Math.atan2(-move.x, -move.z) - state.facing;
        state.facing += Math.atan2(Math.sin(d), Math.cos(d)) * (1 - Math.exp(-10 * dt));
      }
      player.rotation.y = state.facing;
      anim.setParam('speed', cc.speed).update(dt);
      rig.update(dt);
    },
    // #endregion howto:walk-draw
    lateUpdate(dt) {
      atmosphere.update(camera.position, dt);
      // #region howto:lamp-update
      lamps.update(dt, { position: camera.position }, 8); // PointLight intensity: ~8 for a garden lamp at 12 m reach
      // #endregion howto:lamp-update
      distance.set(walked.toFixed(0));
    },
  }, 'game');
  engine.start();

  // ---- page contract for the browser tests (npm run smoke): window.__sample with `ready`
  // #region howto:page-contract
  window.__sample = Object.assign(createBenchHarness(engine, { name: 'starter-walk' }), { cc, anim }).setReady();
  // #endregion howto:page-contract
}

boot().catch((e) => console.error('[starter-walk] boot failed', e));
