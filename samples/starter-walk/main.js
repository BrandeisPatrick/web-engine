// Starter: a third-person walker. Copy this folder to start a game: an animated GLB character (idle / walk / run) with a
// contact shadow in a park corner at dusk (a lamp, a path, a bench, trees: world/Scenery.js, replace it with your level),
// post-processing, a game shell (loading bar, start card, pause with volume and quality, saved), one HUD readout and sound
// (footsteps, a landing thump, a dusk bed, the lamp's hum). Every block says what a game would change. Controls: WASD /
// arrows, mouse (right-drag or click to lock), Space jumps, Shift runs, Esc / P pause; gamepad and touch; ?autostart=1.
// The `// #region howto:` markers are for docs/HOWTO.md, which copies those blocks (test/docs.mjs checks the copies).
import * as THREE from 'three';
import { Engine, Assets, PoseInterpolator, resolveQuality, createBenchHarness } from '@vibe/engine/core';
import { PhysicsWorld, CharacterController } from '@vibe/engine/physics';
import { Atmosphere, PostFX, NearestLights, AirParticles, registerRenderLoaders, loadTextureManifest, loadTextureSet, softDotTexture, applyPatches, weathering } from '@vibe/engine/render';
import { parkCorner, groundCover, finishPerson } from '@vibe/engine/world';
import { AnimationController } from '@vibe/engine/anim';
import { CharacterInput } from '@vibe/engine/input';
import { ThirdPersonRig } from '@vibe/engine/camera';
import { AudioBus, SoundBank, Footsteps } from '@vibe/engine/audio';
import { UILayer, Panel, Readout, GameShell } from '@vibe/engine/ui';
const BASE = import.meta.env.BASE_URL; // asset URLs go through it, so the page also works under a sub-path

// ---- quality tier: 'desktop' or 'mobile' (?quality=mobile forces one; the pause card stores a choice)
// #region howto:quality
const Q = resolveQuality();
const S = Q.settings;
// #endregion howto:quality
// ---- loading bar, start card, pause with volume and quality (saved). The start click also starts the audio
// #region howto:game-shell
const shell = new GameShell({ title: 'Starter Walk', quality: Q, storageKey: 'starter-walk',
  controls: [['W A S D', 'Walk'], ['Right-drag', 'Look'], ['Space', 'Jump'], ['Shift', 'Run']] });
// #endregion howto:game-shell

async function boot() {
  // #region howto:walk-engine
  // ---- engine + physics. PhysicsWorld() is flat ground at y = 0; add a heightfield / static boxes for a real level
  const physics = new PhysicsWorld();
  const engine = new Engine({ container: document.getElementById('app'), physics, renderer: { antialias: false }, ...S.engine });
  const { scene, camera, renderer } = engine;

  // ---- sky, sun, fog, shadows (timeOfDay: hours or 'dawn'..'night'); opt-in: soft clouds lit from the afterglow
  const atmosphere = new Atmosphere({ scene, renderer, camera, timeOfDay: 'dusk', shadows: S.shadows, cloudStyle: 'lit' });
  // #endregion howto:walk-engine
  atmosphere.fogParams.haze = 0.0022; // distance haze (PostFX's fog): the ground's far edge fades into the sky

  // ---- ground with a PBR texture set. `base` is the folder holding manifest.json and one folder per set id
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 96, 96).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f7a5a })); // segments: depth precision
  ground.receiveShadow = true; scene.add(ground);
  shell.setProgress(0.1, 'Textures');
  // #region howto:ground-texture
  const texBase = `${BASE}nyc/textures/`;
  const grass = await loadTextureSet('leafy_grass', { renderer, base: texBase, manifest: await loadTextureManifest(texBase) });
  if (grass) {
    for (const t of [grass.map, grass.normalMap, grass.roughnessMap]) if (t) t.repeat.set(6000 / grass.size, 6000 / grass.size); // size: metres per tile
    Object.assign(ground.material, { map: grass.map, normalMap: grass.normalMap, roughnessMap: grass.roughnessMap, color: new THREE.Color(0xffffff) });
  }
  // #endregion howto:ground-texture

  // ---- one lamp: a post on a base with a hooded lantern, lit by NearestLights (a pool of real lights; give it many
  // positions). The glass is emissive over the dusk bloom threshold (it glows); the light comes from the point light
  const lampAt = new THREE.Vector3(3, 3.2, -6);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1e2023, metalness: 0.6, roughness: 0.45 }), lamp = new THREE.Group();
  const parts = [[new THREE.CylinderGeometry(0.05, 0.07, 3.1, 10), 1.55], [new THREE.CylinderGeometry(0.16, 0.2, 0.3, 12), 0.15], [new THREE.ConeGeometry(0.26, 0.2, 12), 3.42]];
  for (const [geo, y] of parts) { const p = new THREE.Mesh(geo, iron); p.position.y = y; p.castShadow = true; lamp.add(p); }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb466, emissiveIntensity: 8 }));
  glass.position.y = 3.19; lamp.add(glass);
  lamp.position.set(lampAt.x, 0, lampAt.z); scene.add(lamp);
  applyPatches(iron, [weathering({ grime: 0.5, grimeHeight: 0.6, streaks: 0.2, seed: 4 })]); // dirt at its foot, rain runs
  physics.addStaticBox({ center: [lampAt.x, 1.6, lampAt.z], size: [0.2, 3.2, 0.2] }); // the walker cannot pass through it
  // #region howto:lamp
  const lamps = new NearestLights({ count: 1, color: 0xffb070, distance: 12, decay: 1.5, parent: scene });
  lamps.setPositions([[lampAt.x, lampAt.y, lampAt.z]]);
  // #endregion howto:lamp
  // ---- the place around the lamp (world/Scenery.js): a gravel path, a bench, a fence, boulders, trees (colliders too)
  const place = parkCorner({ physics, lamp: [lampAt.x, lampAt.z] }); scene.add(place.group);
  applyPatches(ground.material, [groundCover({ paths: place.paths })]); // broad lush / dry / bare patches, the path
  const air = new AirParticles({ preset: 'fireflies', budget: S.effects.particles }); scene.add(air.mesh); // fireflies over the grass (render)

  // ---- the character: a GLB with clips. Change the file, the height and the clip names for your own model
  // #region howto:glb-load
  const assets = new Assets({ base: `${BASE}people/` });
  registerRenderLoaders(assets, renderer);
  assets.add('hero', { type: 'gltf', url: 'man-grey-jacket.glb' });
  engine.addSystem(assets.system(), 'assets');
  await engine.load((p, label) => shell.setProgress(0.3 + 0.6 * p, label));
  /** @type {import('@vibe/engine/render').GltfAsset} */
  const gltf = assets.get('hero');
  const model = gltf.instantiate(); // an Object3D (a skinning-safe clone)
  // world/People.js: fit to 1.8 m with the feet at y = 0, cast shadows, and light the figure as cloth and skin (light
  // wraps past the terminator, a soft rim against the dusk); a low-poly model also gets smooth normals here
  finishPerson(model, { height: 1.8 });
  model.rotation.y = Math.PI; // this GLB faces +Z; the engine's forward is -Z
  const player = new THREE.Group().add(model); // the game moves and turns this group
  scene.add(player);
  // a soft contact shadow on the ground under the feet (the sun's shadow alone leaves the walker floating at dusk)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, map: softDotTexture(), transparent: true, opacity: 0.85, depthWrite: false }));
  scene.add(blob);
  // #endregion howto:glb-load
  // #region howto:glb-anim
  // states name clips by string (the GLB's names; a wrong name throws and lists the right ones); the tree blends by speed.
  // The points are the ground speeds the cycles were made for (this walk covers 1.35 m/s), so the feet do not slide
  const anim = new AnimationController(model, gltf.animations, {
    states: { idle: { clip: 'Idle' }, walk: { clip: 'Walk' }, run: { clip: 'Run' } },
    trees: { move: { type: '1d', param: 'speed', sync: true, points: [{ at: 0, state: 'idle' }, { at: 1.35, state: 'walk' }, { at: 5.5, state: 'run' }] } },
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
  const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx, look: { aoLit: 0.8, aoTint: [0, 0.03, 0.07] } });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;          // look.aoLit: AO only on the ambient light; `passes` is the game's
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  postfx.track(player); // per-object velocity for TAA / motion blur on moving meshes
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  engine.onRenderScale = (s) => postfx.set('renderScale', s); // frames too long: fewer pixels under TAA first (S.engine.renderScales)
  // #endregion howto:postfx

  // ---- input and camera
  // #region howto:character-camera
  const input = new CharacterInput({ element: renderer.domElement });
  const rig = new ThirdPersonRig(camera, renderer.domElement, { physics, distance: 4.2, height: 1.6, landingDip: 1 }); // dips on landing
  rig.setTarget(player, () => state);
  // #endregion howto:character-camera

  // ---- HUD (one readout; the quality tiers are in the pause card) and sound (it starts with the start click)
  // #region howto:hud
  const panel = new Panel({ parent: new UILayer(), corner: 'tl' });
  const distance = panel.add(new Readout({ label: 'WALKED', value: '0', unit: 'm' }));
  // #endregion howto:hud
  // #region howto:sound
  const audio = new AudioBus({ master: 'safe', volume: 0.7 }); // compressor + soft clipper: nothing can clip
  const sfx = new SoundBank(audio, { listener: camera });        // the named sounds (SOUND_PRESETS)
  const steps = new Footsteps(sfx, { surface: 'grass', at: player, gain: 2.4 }); // gain: footfalls and landings over the bed
  sfx.loop('amb.dusk', { gain: 0.1 });                           // a quiet dusk bed
  sfx.loop('lamp.hum', { at: lampAt, gain: 0.2 });               // the lamp hums when you are near it
  shell.use({ engine, audio, inputs: [input] }); // the start click calls audio.start(); pause mutes, Esc / P pause
  // #endregion howto:sound
  // ---- the game loop: input per frame, simulation per fixed step, drawing per frame
  const move = { x: 0, z: 0 }, fwd = new THREE.Vector3(), right = new THREE.Vector3(); let walked = 0;
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
      steps.update(dt, { speed: cc.speed, grounded: cc.grounded, landed: cc.landedThisStep, landingSpeed: cc.landingSpeed });
      if (cc.landedThisStep) rig.land(cc.landingSpeed); // a small camera dip on landing
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
      sfx.update(dt);
    },
    // #endregion howto:walk-draw
    lateUpdate(dt) {
      atmosphere.update(camera.position, dt); air.update(dt, camera);
      // #region howto:lamp-update
      lamps.update(dt, { position: camera.position }, 12); // PointLight intensity: 8-12 for a garden lamp at 12 m reach
      // #endregion howto:lamp-update
      place.update(dt, camera.position, atmosphere.darkness); // tree wind and the near / far tree split
      blob.position.set(player.position.x, 0.015, player.position.z); // the contact shadow fades as the feet leave the ground
      blob.material.opacity = 0.85 * Math.max(0, 1 - player.position.y / 1.2);
      distance.set(walked.toFixed(0));
    },
  }, 'game');
  // #region howto:start
  await shell.ready(); // under the loading bar: engine.warmUp() (shaders, uploads), engine.start(), a frame; then the card
  // #endregion howto:start
  // ---- page contract for the browser tests (npm run smoke): window.__sample with `ready`
  // #region howto:page-contract
  window.__sample = Object.assign(createBenchHarness(engine, { name: 'starter-walk', quality: Q }), { cc, anim, shell, audio, atmosphere, postfx, air }).setReady();
  // #endregion howto:page-contract
}
boot().catch((e) => { console.error('[starter-walk] boot failed', e); shell.error(`Failed to start: ${e.message}`); });
