// Starter: a driving game. Copy this folder to start one: a field with a country road through it (a lay-by, lane lines,
// verges, fences, poles and trees from world/Scenery.js: replace it with your level), an HD hatchback on the engine's
// VehicleController (an ordinary road car) with the steering assist, skid marks and tyre smoke, a chase camera that
// reacts to the car, car sounds, golden-hour sky with distance haze, post-processing, a game shell (loading bar, start
// card, pause with volume, assist and quality, all saved) and a speed readout. Every block says what a game would change.
// Controls: W / S or arrows drive and brake (brake from a stop reverses), A / D steer, X handbrake, C camera, R reset,
// Esc / P pause; gamepad and touch work too. ?autostart=1 skips the start card (tests that press keys need it).
// The `// #region howto:` markers are for docs/HOWTO.md, which copies those blocks (test/docs.mjs checks the copies).
import * as THREE from 'three';
import { Engine, PoseInterpolator, resolveQuality, createBenchHarness } from '@vibe/engine/core';
import { PhysicsWorld, VehicleController } from '@vibe/engine/physics';
import { Atmosphere, PostFX, TyreFx, loadTextureManifest, loadTextureSet, applyPatches, weathering } from '@vibe/engine/render';
import { VehicleInput } from '@vibe/engine/input';
import { ChaseRig } from '@vibe/engine/camera';
import { createCarVisual, countryRoad, groundCover } from '@vibe/engine/world';
import { AudioBus, SoundBank, VehicleAudio } from '@vibe/engine/audio';
import { UILayer, Panel, Readout, GameShell } from '@vibe/engine/ui';

const BASE = import.meta.env.BASE_URL; // asset URLs go through it, so the page also works under a sub-path

// ---- quality tier: 'desktop' or 'mobile' (?quality=mobile forces one; the pause card stores a choice)
const Q = resolveQuality();
const S = Q.settings;

// #region howto:road-car-spec
// ---- the car: an HD hatchback body and its physics, ROAD_CAR_SPEC resized to that body (wheels where the body has them).
// Other bodies: 'sedan', 'suv', 'pickup', 'minivan', 'taxi', 'police'. Tune by spreading: { ...visual.spec, motorPower: 200e3 }.
// (Without a spec VehicleController is the Roadster, a 400 km/h car that flies on the thrust input.)
const visual = createCarVisual('hatchback', { color: 0x8a1418, shadowOpacity: 0.9 });
const SPEC = visual.spec; // ROAD_CAR_SPEC with this body's size, axles, track and wheel radius
// #endregion howto:road-car-spec

// ---- loading bar, start card, pause with volume, the assist toggle and quality (saved in localStorage)
const shell = new GameShell({ title: 'Starter Drive', quality: Q, storageKey: 'starter-drive', defaults: { assist: true },
  controls: [['W S', 'Drive, brake'], ['A D', 'Steer'], ['X', 'Handbrake'], ['C', 'Camera'], ['R', 'Reset']] });

async function boot() {
  // ---- engine + physics. PhysicsWorld() is flat ground at y = 0; PhysicsWorld({ heightfield: (x, z) => y }) for hills
  const physics = new PhysicsWorld();
  const engine = new Engine({ container: document.getElementById('app'), physics, renderer: { antialias: false }, ...S.engine });
  const { scene, camera, renderer } = engine;

  // ---- sky, sun, fog and shadows. timeOfDay: hours 0..24 or 'dawn' | 'noon' | 'golden' | 'dusk' | 'night'
  // cloudStyle 'lit': soft clouds lit by the low sun; lowSunEnv: a warmer, brighter fill while the sun is low (opt-in)
  const atmosphere = new Atmosphere({ scene, renderer, camera, timeOfDay: 'golden', shadows: S.shadows, cloudStyle: 'lit', lowSunEnv: true });

  // ---- the place: a field, and a quiet country road through it (z from +100 to -900) with a lay-by beside the start,
  // lane and edge lines, gravel verges, fences, utility poles, a side track with a sign and trees (world/Scenery.js)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4d5a3a, roughness: 1 }));
  ground.receiveShadow = true;
  const ROAD_W = 10; // asphalt width: two 3.5 m lanes and hard shoulders
  const place = countryRoad({ physics, width: ROAD_W, from: 100, to: -900 });
  scene.add(ground, place.group);
  // broad patches of dry and lush grass on the field, and the gravel verges and track
  applyPatches(ground.material, [groundCover({ paths: place.paths })]);
  shell.setProgress(0.2, 'Road');
  // PBR sets: `base` is the folder holding manifest.json and one folder per set id; repeat = metres / tile size
  const texBase = `${BASE}nyc/textures/`, manifest = await loadTextureManifest(texBase);
  const [asphalt, grass] = await Promise.all(['asphalt_02', 'leafy_grass'].map((id) => loadTextureSet(id, { renderer, base: texBase, manifest })));
  const surfaces = [...place.surfaces, { mesh: ground, w: 6000, l: 6000, set: grass }]; // place.surfaces: the road and lay-by
  for (const { mesh, w, l, set = asphalt } of surfaces) {
    if (!set) continue; // a set that did not load leaves the plain colour
    const maps = [set.map, set.normalMap, set.roughnessMap].map((t) => t && t.clone());
    for (const t of maps) if (t) t.repeat.set(w / set.size, l / set.size);
    Object.assign(mesh.material, { map: maps[0], normalMap: maps[1], roughnessMap: maps[2], color: new THREE.Color(set === asphalt ? 0x9a9a9a : 0xffffff) });
  }
  // distance haze (PostFX's fog): the far road and the field fade into the sky instead of meeting it at a hard line
  atmosphere.fogParams.haze = 0.002;
  // a row of marker posts beside the road (two InstancedMeshes: post and band), as static colliders the car bounces off
  // #region howto:static-posts
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.1, 12), bandGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.14, 12);
  const at = [];
  for (let z = -120; z > -900; z -= 40) for (const x of [-ROAD_W / 2 - 1, ROAD_W / 2 + 1]) at.push([x, z]);
  const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.85 }), at.length);
  const bands = new THREE.InstancedMesh(bandGeo, new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.5 }), at.length);
  const m = new THREE.Matrix4();
  at.forEach(([x, z], i) => {
    posts.setMatrixAt(i, m.makeTranslation(x, 0.55, z)); bands.setMatrixAt(i, m.makeTranslation(x, 0.9, z));
    physics.addStaticBox({ center: [x, 0.55, z], size: [0.22, 1.1, 0.22], kind: 'post' });
  });
  posts.castShadow = bands.castShadow = true;
  scene.add(posts, bands);
  // #endregion howto:static-posts
  // weathering (render): world-space breakup, no UVs: dirt splashed up the posts from the ground, a little rain streaking
  applyPatches(posts.material, [weathering({ grime: 0.5, grimeHeight: 0.5, streaks: 0.25, seed: 2 })]);

  // ---- the car: the simulation (VehicleController) and what you see (visual.root: body, glass, wheels, lamps, shadow)
  // #region howto:drive-car
  const car = new VehicleController(SPEC);
  const START = new THREE.Vector3(1.75, 0, 0); // the middle of the right-hand lane
  car.reset(START, 0, physics); // heading 0 faces -Z (down the road)
  // #endregion howto:drive-car
  const body = visual.root; // faces -Z like the controller; its origin is the controller's reference point
  scene.add(body);
  const smooth = new PoseInterpolator(car); // draws the car between fixed steps (position lerp + rotation slerp)
  smooth.apply(body, 1);

  // ---- post-processing with the tier's settings (desktop: G-buffer + TAA + SSR; mobile: FXAA), resize hook
  const { width, height } = engine.size;
  // look.aoLit: AO darkens only the ambient light (sunlit faces keep their light); aoTint: a cool tint in what AO leaves
  const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx, look: { aoLit: 0.8, aoTint: [0, 0.03, 0.07] } });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;          // `passes` is the game's to apply
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  postfx.track(body); // per-object velocity for TAA / motion blur
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);

  // ---- input, tyre marks and the chase camera. The rig reads `state` each frame (ChaseTargetState: velocity, accel, ...)
  // #region howto:drive-controls
  const input = new VehicleInput(renderer.domElement, { touch: 'auto', assist: true }); // assist: lock at the grip limit, catches slides
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false }; // what car.step() reads
  const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0, accel: car.localAccel };
  const tyres = new TyreFx({ scene, atmosphere, lift: 0.04 }); // skid marks + thin smoke from wheels[i].slideHeat
  // feel: 'road': the camera eases back under acceleration, closes in under braking and leans out in corners
  const rig = new ChaseRig(camera, renderer.domElement, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false, feel: 'road' });
  rig.setTarget(body, () => state);
  // #endregion howto:drive-controls

  // #region howto:drive-sound
  // ---- sound: the safe mixer (compressor + soft clipper), the motor (VehicleAudio), road roar, wind and squeal loops
  const audio = new AudioBus({ master: 'safe', volume: 0.7 });
  audio.setBusVolume('engine', 0.35);
  const motor = new VehicleAudio({ bus: audio, ambience: false, topSpeed: 200 / 3.6, wind: false, tyres: false });
  const sfx = new SoundBank(audio, { listener: camera }); // the named sounds (SOUND_PRESETS); loops start with the bus
  const roar = sfx.loop('road.roar', { gain: 0 }), wind = sfx.loop('wind.rush', { gain: 0 }), squeal = sfx.loop('tyre.squeal', { gain: 0 });
  // #endregion howto:drive-sound

  // ---- the shell gets the parts: the start click starts the audio, pause stops the clock and mutes, inputs wait
  shell.use({ engine, audio, inputs: [input] });
  shell.addToggle('assist', 'Steering assist');
  shell.settings.on('assist', (on) => { input.assist.enabled = !!on; }); // runs now with the saved value, then on change

  // ---- HUD: one readout (the quality tiers are in the pause card)
  const panel = new Panel({ parent: new UILayer(), corner: 'bl' });
  const speed = panel.add(new Readout({ label: 'SPEED', value: '0', unit: 'km/h' }));

  // ---- the game loop: input per frame, simulation per fixed step, drawing per frame
  let hitCool = 0;
  const reset = () => { car.reset(START, 0, physics); smooth.snap(); rig.snap(); tyres.clear(); };
  engine.addSystem({
    // #region howto:drive-input
    earlyUpdate(dt) {
      input.update(dt, car); // with the car: steer comes out assisted (input.assist.enabled toggles it)
      controls.throttle = input.throttle; controls.brake = input.brake; controls.steer = input.steer; controls.handbrake = input.handbrake;
      if (input.reset) reset(); // back to the start, marks cleared
      if (input.toggleCamera) rig.cycleMode();
    },
    // #endregion howto:drive-input
    // #region howto:drive-step
    fixedUpdate(dt) {
      smooth.save(); // before the step: the pose PoseInterpolator blends from
      car.step(dt, controls, physics);
      hitCool -= dt; // a hit (car.impact, m/s into a post or the ground): a thud and a short camera shake
      if (car.impact > 3 && hitCool <= 0) {
        sfx.play('impact.thud', { at: body, gain: Math.min(1, car.impact / 12) }); rig.addTrauma(Math.min(0.6, car.impact / 15)); hitCool = 0.25;
      }
    },
    // #endregion howto:drive-step
    // #region howto:drive-draw
    update(dt, alpha) {
      smooth.apply(body, alpha);
      visual.update(dt, car, { darkness: atmosphere.darkness }); // wheels roll, steer and ride; brake / reverse / head lamps
      tyres.update(dt, car, body);
      state.speedKmh = car.speed * 3.6; state.grounded = car.grounded; state.wheelSlip = car.wheelSlip;
      rig.update(dt);
    },
    // #endregion howto:drive-draw
    lateUpdate(dt) {
      // #region howto:drive-sound-update
      // car sounds from the car's state: motor by speed and throttle, roar and wind by speed, squeal by wheel slip
      const v = car.speed, w = Math.min(v / 55, 1), slide = Math.min(Math.max((car.wheelSlip - 0.15) * 1.4, 0), 1) * Math.min(v / 6, 1);
      motor.update(dt, { speedKmh: v * 3.6, rpmLike: controls.throttle, grounded: car.grounded });
      roar.setGain(car.grounded ? 0.22 * Math.min(v / 30, 1) : 0).setRate(0.8 + 0.6 * Math.min(v / 50, 1));
      wind.setGain(0.3 * w * w).setRate(0.9 + 0.3 * w);
      squeal.setGain(car.grounded ? 0.22 * slide : 0).setRate(0.96 + 0.08 * slide);
      sfx.update(dt);
      // #endregion howto:drive-sound-update
      atmosphere.update(camera.position, dt);
      place.update(dt, camera.position, atmosphere.darkness); // tree wind and the near / far tree split
      speed.set(Math.round(Math.abs(car.forwardSpeed) * 3.6));
    },
  }, 'game');

  // ---- start: the shell draws the first frames under its loading bar (engine.warmUp(): shaders compile, textures
  // upload, nothing moves), starts the loop, and shows the start card once a frame is drawn. It does not wait for the click
  await shell.ready();
  shell.onStart(reset); // the run starts from the line

  // ---- page contract for the browser tests (npm run smoke): window.__sample with `ready`
  window.__sample = Object.assign(createBenchHarness(engine, { name: 'starter-drive', quality: Q }), { car, body, visual, input, tyres, shell }).setReady();
}

boot().catch((e) => { console.error('[starter-drive] boot failed', e); shell.error(`Failed to start: ${e.message}`); });
