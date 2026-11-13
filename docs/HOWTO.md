# How to: one recipe per task

Short recipes for the things a small game needs. Every code block here is a copy of a marked region
(`// #region howto:<id>`) in code that runs, and `npm test` fails if a copy drifts from its source:

- `samples/starter-walk/main.js` and `samples/starter-drive/main.js`, the two starters (headless Chrome:
  `npm run smoke`, `test/browser/check-page.mjs`);
- `test/howto/recipes.js`, run in Node by `test/howto.mjs` (part of `npm test`) and in headless Chrome by
  `test/browser/howto.mjs`;
- `test/browser/check-page.mjs`.

The fastest start is to copy a starter folder (see [AGENTS.md](../AGENTS.md)); the recipes show the same code one task at
a time. Names such as `engine`, `scene`, `camera`, `renderer`, `physics` and `postfx` are the objects the starters
create first. [ENGINE.md](../ENGINE.md) has the full API.

Contents: [Engine and quality tiers](#engine-and-quality-tiers) ·
[Character with camera, input and animation](#character-with-camera-input-and-animation) ·
[Load a GLB and play its clips](#load-a-glb-and-play-its-clips) · [Drive a car](#drive-a-car) ·
[Smooth rendering between fixed steps](#smooth-rendering-between-fixed-steps) ·
[Lamps without MapWorld](#lamps-without-mapworld) · [Clustered lights](#clustered-lights) ·
[A textured mesh from a texture set](#a-textured-mesh-from-a-texture-set) · [HUD text](#hud-text) ·
[Play a sound](#play-a-sound) · [Vehicle sound](#vehicle-sound) · [GPU particles](#gpu-particles) ·
[Static and loose physics bodies](#static-and-loose-physics-bodies) ·
[A small track without the world layer](#a-small-track-without-the-world-layer) ·
[Add a sample page](#add-a-sample-page) · [Test a page headlessly](#test-a-page-headlessly)

## Engine and quality tiers

Pick the tier once, at the top of the module. `resolveQuality` (`@vibe/engine/core`) returns `{ tier, settings, ... }`:
`?quality=desktop|mobile` first, then the player's stored choice, then a guess from the device.

<!-- from: samples/starter-walk/main.js#quality -->
```js
const Q = resolveQuality();
const S = Q.settings;
```

Spread the tier's groups into the constructors (`Engine` from core, `PhysicsWorld` from physics, `Atmosphere` from
render):

<!-- from: samples/starter-walk/main.js#walk-engine -->
```js
// ---- engine + physics. PhysicsWorld() is flat ground at y = 0; add a heightfield / static boxes for a real level
const physics = new PhysicsWorld();
const engine = new Engine({ container: document.getElementById('app'), physics, renderer: { antialias: false }, ...S.engine });
const { scene, camera, renderer } = engine;

// ---- sky, sun, fog and shadows. timeOfDay: hours 0..24 or 'dawn' | 'noon' | 'golden' | 'dusk' | 'night'
const atmosphere = new Atmosphere({ scene, renderer, camera, timeOfDay: 'dusk', shadows: S.shadows });
```

Post-processing, the `passes` group (nothing applies it for you) and resize handling. Without `onResize`, PostFX keeps
its first size when the window changes:

<!-- from: samples/starter-walk/main.js#postfx -->
```js
const { width, height } = engine.size;
const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx });
if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;          // `passes` is the game's to apply
if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
postfx.track(player); // per-object velocity for TAA / motion blur on moving meshes
engine.renderFn = (sc, cam, dt) => postfx.render(dt);
engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
```

The tier gear button is `new QualityMenu({ quality: Q, corner: 'tr' })` (ui); a change stores the tier and reloads the
page. `S.lights`, `S.world`, `S.textures` and `S.effects` are for the game to read.

## Character with camera, input and animation

Imports: `CharacterController` (physics), `PoseInterpolator` (core), `CharacterInput` (input), `ThirdPersonRig`
(camera). The controller is a capsule stepped at the fixed rate; `player` is the Group that holds the model (next
recipe).

<!-- from: samples/starter-walk/main.js#character-controller -->
```js
const cc = new CharacterController({ radius: 0.32, height: 1.8 });
const smooth = new PoseInterpolator(cc); // the controller has no rotation: the game turns `player` itself
const state = { facing: 0 };            // read by the camera rig (it turns behind `facing`)
```

<!-- from: samples/starter-walk/main.js#character-camera -->
```js
const input = new CharacterInput({ element: renderer.domElement });
const rig = new ThirdPersonRig(camera, renderer.domElement, { physics, distance: 4.2, height: 1.6 });
rig.setTarget(player, () => state);
```

The game loop is one system, `engine.addSystem({ earlyUpdate, fixedUpdate, update, lateUpdate }, 'game')`, with
`const move = { x: 0, z: 0 }, fwd = new THREE.Vector3(), right = new THREE.Vector3()` beside it. Input per frame,
turned into a camera-relative direction:

<!-- from: samples/starter-walk/main.js#walk-input -->
```js
earlyUpdate(dt) {
  input.update(dt);
  const c = input.controls;
  rig.turn(-c.lookX, -c.lookY);
  rig.getForward(fwd); rig.getRight(right); // camera-relative movement
  move.x = right.x * c.moveX + fwd.x * c.moveY; move.z = right.z * c.moveX + fwd.z * c.moveY;
},
```

Simulation per fixed step (`hop` is the sound in "Play a sound"):

<!-- from: samples/starter-walk/main.js#walk-step -->
```js
fixedUpdate(dt) {
  smooth.save(); // before the step: the pose PoseInterpolator blends from
  const c = input.controls;
  cc.step(dt, move.x, move.z, c.jumpHeld, c.sprint, physics);
  if (cc.jumpedThisStep) hop();
  walked += cc.speed * dt;
},
```

Drawing per frame: blend the pose, turn toward the movement (heading 0 faces -Z), drive the animation by speed:

<!-- from: samples/starter-walk/main.js#walk-draw -->
```js
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
```

## Load a GLB and play its clips

Imports: `Assets` (core), `registerRenderLoaders` (render), `AnimationController` (anim). `assets.get()` returns
`{ scene, animations, instantiate() }`; `instantiate()` returns an Object3D (a skinning-safe clone).

<!-- from: samples/starter-walk/main.js#glb-load -->
```js
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
```

`BASE` is `import.meta.env.BASE_URL`. Clip names are the GLB's own and must match exactly; a wrong name throws and lists
the names the file has. The Quaternius characters in `samples/public/nyc/models/` use `HumanArmature|Man_Idle`,
`HumanArmature|Man_Walk`, `HumanArmature|Man_Run`.

<!-- from: samples/starter-walk/main.js#glb-anim -->
```js
// states name clips by string (the GLB's names; a wrong name throws and lists the right ones); the tree blends by speed
const anim = new AnimationController(model, gltf.animations, {
  states: { idle: { clip: 'HumanArmature|Man_Idle' }, walk: { clip: 'HumanArmature|Man_Walk' }, run: { clip: 'HumanArmature|Man_Run' } },
  trees: { move: { type: '1d', param: 'speed', points: [{ at: 0, state: 'idle' }, { at: 2, state: 'walk' }, { at: 5.5, state: 'run' }] } },
});
anim.play('move');
```

Per frame: `anim.setParam('speed', cc.speed).update(dt)`.

## Drive a car

Imports: `VehicleController`, `ROAD_CAR_SPEC` (physics), `VehicleInput` (input), `ChaseRig` (camera),
`PoseInterpolator` (core). `new VehicleController()` with no spec is the Roadster: 2 t, about 1 MW, flies on the
`thrust` input. A partial spec inherits every field you leave out from it, so start from `ROAD_CAR_SPEC`.

<!-- from: samples/starter-drive/main.js#road-car-spec -->
```js
// ---- the car's physics: an ordinary road car. Spread it to tune: { ...ROAD_CAR_SPEC, motorPower: 200e3, vMax: 70 }.
// (Without a spec VehicleController is the Roadster, a 400 km/h car that flies on the thrust input.)
const SPEC = ROAD_CAR_SPEC;
```

<!-- from: samples/starter-drive/main.js#drive-car -->
```js
const car = new VehicleController(SPEC);
const START = new THREE.Vector3(0, 0, 0);
car.reset(START, 0, physics); // heading 0 faces -Z (down the road)
```

`body` is the Group you draw (boxes in the starter, a GLB in a real game). The controls object is what `car.step()`
reads; `state` is what the chase rig reads (`ChaseTargetState`):

<!-- from: samples/starter-drive/main.js#drive-controls -->
```js
const input = new VehicleInput(renderer.domElement, { touch: 'auto' });
const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false }; // what car.step() reads
const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0 };
const rig = new ChaseRig(camera, renderer.domElement, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false });
rig.setTarget(body, () => state);
```

The loop (`smooth = new PoseInterpolator(car)`, `wheels` are the four wheel meshes):

<!-- from: samples/starter-drive/main.js#drive-input -->
```js
earlyUpdate(dt) {
  input.update(dt);
  controls.throttle = input.throttle; controls.brake = input.brake; controls.steer = input.steer; controls.handbrake = input.handbrake;
  if (input.reset) { car.reset(START, 0, physics); smooth.snap(); rig.snap(); } // back to the start
  if (input.toggleCamera) rig.cycleMode();
},
```

<!-- from: samples/starter-drive/main.js#drive-step -->
```js
fixedUpdate(dt) {
  smooth.save(); // before the step: the pose PoseInterpolator blends from
  car.step(dt, controls, physics);
},
```

<!-- from: samples/starter-drive/main.js#drive-draw -->
```js
update(dt, alpha) {
  smooth.apply(body, alpha);
  for (let i = 0; i < 4; i++) { // roll the wheels, steer the front pair
    wheels[i].rotation.x -= (car.forwardSpeed * dt) / SPEC.wheelRadius;
    if (i < 2) wheels[i].rotation.y = car.steerAngle;
  }
  state.speedKmh = car.speed * 3.6; state.grounded = car.grounded; state.wheelSlip = car.wheelSlip;
  rig.update(dt);
},
```

## Smooth rendering between fixed steps

Physics steps at 120 Hz, frames come at the display's rate. Draw a simulated body at the blend of its last two steps,
or it judders. `PoseInterpolator` (core) keeps the previous pose; `save()` goes BEFORE the step:

<!-- from: test/howto/recipes.js#pose-interpolator -->
```js
const smooth = new PoseInterpolator(car);   // anything with .position and (optionally) .quaternion
engine.addSystem({
  fixedUpdate(dt) {
    smooth.save();                           // BEFORE the step: the pose to blend from
    car.step(dt, controls, physics);
  },
  update(dt, alpha) {
    smooth.apply(carMesh, alpha);            // position lerp + quaternion slerp between the last two steps
  },
});
car.reset(new THREE.Vector3(0, 0, 0), 0, physics); smooth.snap(); // after a teleport: no blend from the old place
```

A `CharacterController` has no quaternion, so only the position is blended; turn the model yourself (see the
character recipe).

## Lamps without MapWorld

`NearestLights` (render; `@vibe/engine/world` re-exports it) keeps a small pool of real point lights on the lamps
nearest the view. Give it every lamp position; it spends the pool where you can see it.

<!-- from: samples/starter-walk/main.js#lamp -->
```js
const lamps = new NearestLights({ count: 1, color: 0xffb070, distance: 12, decay: 1.5, parent: scene });
lamps.setPositions([[lampAt.x, lampAt.y, lampAt.z]]);
```

Per frame, after the camera moved (in `lateUpdate`):

<!-- from: samples/starter-walk/main.js#lamp-update -->
```js
lamps.update(dt, { position: camera.position }, 8); // PointLight intensity: ~8 for a garden lamp at 12 m reach
```

Intensity is three.js `PointLight` intensity. The demos use about 7.5 to 8 for garden lamps (reach 9 to 12 m, decay
1.5) and up to 260 for city street lamps (reach 48 m, decay 2, 6 m up). At 1 a lamp is invisible at dusk. Keep the
pool at 8 or fewer: every real light costs on every lit pixel. For more lamps, use clustered lights.

## Clustered lights

Every lamp lights the scene, and a pixel pays only for the lights that reach it. The wiring is five calls in three
places (imports from render: `ClusteredLights`, `installClusteredChunks`, `syncClustered`). `lamps` is an array of
`[x, y, z]`:

<!-- from: test/howto/recipes.js#clustered-lights -->
```js
installClusteredChunks();                                  // 1. once per page, before materials compile
const cl = new ClusteredLights({ maxLights: 256 });        // 2. the light list
lamps.forEach(([x, y, z], i) => cl.setLight(i, x, y, z, 14, 6, 4.2, 2.4, 1.5)); // range m, colour x intensity, decay
syncClustered(scene, true);                                // 3. lit materials use it (also ones added later)
postfx.onInternalResize = (w, h) => cl.setSize(w, h);      // 4. the scene target's size in pixels...
postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight); // ...now and on every resize
engine.addSystem({ lateUpdate() { cl.update(camera); } }, 'lights'); // 5. per frame, after the camera moved
```

Clustered lights cast no shadows. `NearestLights` can feed them instead of a pool:
`new NearestLights({ mode: 'clustered', clustered: cl, ... })`. `MapWorld` does all of this itself with its
`lights: { clustered: true }` option.

## A textured mesh from a texture set

`loadTextureSet` and `loadTextureManifest` (render). `base` is the folder that holds `manifest.json` and one folder per
set; pass it (the default `${BASE_URL}textures/` does not exist in this repository). The sets are listed in
`samples/public/nyc/textures/manifest.json` and `samples/public/miami/textures/manifest.json`. The id is the set's
folder name (`leafy_grass`) or the manifest's role key (`grass`).

<!-- from: samples/starter-walk/main.js#ground-texture -->
```js
const texBase = `${BASE}nyc/textures/`;
const grass = await loadTextureSet('leafy_grass', { renderer, base: texBase, manifest: await loadTextureManifest(texBase) });
if (grass) {
  for (const t of [grass.map, grass.normalMap, grass.roughnessMap]) if (t) t.repeat.set(80 / grass.size, 80 / grass.size); // size: metres per tile
  Object.assign(ground.material, { map: grass.map, normalMap: grass.normalMap, roughnessMap: grass.roughnessMap, color: new THREE.Color(0xffffff) });
}
```

Sets with `.ktx2` files (`samples/public/miami/road/`) also need the Basis transcoder:
`basisPath: `${BASE}miami/basis/`` in the options. Without one, the JPGs load.

## HUD text

`UILayer`, `Panel`, `Readout`, `QualityMenu` (ui):

<!-- from: samples/starter-walk/main.js#hud -->
```js
const panel = new Panel({ parent: new UILayer(), corner: 'tl' });
const distance = panel.add(new Readout({ label: 'WALKED', value: '0', unit: 'm' }));
new QualityMenu({ quality: Q, corner: 'tr' });
```

Update it per frame with `distance.set(walked.toFixed(0))`.

## Play a sound

`AudioBus`, `playTone` (audio). Browsers start audio only after a click or key press; `unlockOnGesture()` waits for
the first one, and until then `audio.started` is false and `audio.bus(name)` is null. Buses: `engine`, `effects`,
`ambience`, `ui`.

<!-- from: samples/starter-walk/main.js#sound -->
```js
const audio = new AudioBus({ volume: 0.7 });
audio.unlockOnGesture();
const hop = () => { if (audio.started) playTone(audio.ctx, audio.bus('ui'), { type: 'triangle', pitch: [[0, 660], [0.08, 990]], peak: 0.2, decay: 0.2 }); };
```

## Vehicle sound

`VehicleAudio` (audio) is an electric motor and thruster synth with no sample files. Give it the car's state each
frame:

<!-- from: test/howto/recipes.js#vehicle-sound -->
```js
const audio = new VehicleAudio({ volume: 0.6, ambience: false });
addEventListener('keydown', () => audio.start(), { once: true });  // browsers start audio only in a gesture
const sound = { speedKmh: 0, rpmLike: 0, thrust: 0, grounded: true, mode: 'ground', wheelSlip: 0 };
engine.addSystem({
  update(dt) {
    sound.speedKmh = Math.abs(car.forwardSpeed) * 3.6;
    sound.rpmLike = controls.throttle;                    // motor load 0..1
    sound.grounded = car.grounded; sound.wheelSlip = car.wheelSlip;
    audio.update(dt, sound);
  },
}, 'car-sound');
```

The Miami demo's straight-six is its own synth (`samples/miami-drive/audio.js`), not the engine's.

## GPU particles

`GpuParticleSystem` (render): tens of thousands of sprites simulated on the GPU, with the `ParticleSystem` spawn API.
`atmosphere` may be null.

<!-- from: test/howto/recipes.js#gpu-particles -->
```js
if (!GpuParticleSystem.isSupported(renderer)) return null; // WebGL2 + float render targets; else use ParticleSystem
const dust = new GpuParticleSystem(renderer, { max: 16384, blending: 'normal', drag: 0.25, lit: true, sun: atmosphere });
scene.add(dust.mesh);
const p = { x: 0, y: 0.2, z: -6, vx: 0, vy: 1.5, vz: 0, life: 2, size0: 0.3, size1: 1.2, alpha: 0.5, r: 0.8, g: 0.75, b: 0.65 };
engine.addSystem({
  update(dt) {
    for (let i = 0; i < 20; i++) {                         // reuse one params object: no allocation per spawn
      p.vx = (Math.random() - 0.5) * 2; p.vz = (Math.random() - 0.5) * 2;
      dust.emit(p);
    }
    dust.update(dt, camera);                               // after the camera moved
  },
}, 'dust');
```

## Static and loose physics bodies

`PhysicsWorld`, `DynamicsWorld`, `attachToPhysicsWorld`, `boxShape`, `sphereShape` (physics). Static boxes take a
`{ center, size }` or `{ min, max }` object (the positional form is `minX, minY, maxX, maxY, minZ, maxZ`: x and y
first). Shape builders take HALF extents.

<!-- from: test/howto/recipes.js#physics-bodies -->
```js
const physics = new PhysicsWorld();                                    // flat ground at y = 0
physics.addStaticBox({ center: [0, 1, -10], size: [8, 2, 1] });        // a wall, like BoxGeometry(8, 2, 1)
physics.addStaticBox({ min: [4, 0, -4], max: [6, 0.5, 4], kind: 'kerb' });

const dyn = new DynamicsWorld({ physics, substeps: 4 });               // loose bodies; the static world is `physics`
attachToPhysicsWorld(dyn, physics);                                    // controllers and cars now collide with them
const crate = dyn.addBody({ shape: boxShape(0.4, 0.4, 0.4), position: [0, 3, -5], mass: 20 }); // HALF extents
const ball = dyn.addBody({ shape: sphereShape(0.3), position: [1, 5, -5], restitution: 0.5 });
const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8));      // full size = 2 x the half extents

// per fixed step, then copy the pose onto the mesh
const step = (dt) => { dyn.step(dt); dyn.getPose(crate, mesh.position, mesh.quaternion); };
```

Call `step` from a system's `fixedUpdate`. A character pushes loose bodies after `cc.attachDynamics(dyn)`. The starter
drive's roadside posts are the same `addStaticBox` calls:

<!-- from: samples/starter-drive/main.js#static-posts -->
```js
const postMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 });
for (let z = 80; z > -900; z -= 40) {
  for (const x of [-ROAD_W / 2 - 1, ROAD_W / 2 + 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), postMat);
    p.position.set(x, 0.6, z); p.castShadow = true; scene.add(p);
    physics.addStaticBox({ center: [x, 0.6, z], size: [0.3, 1.2, 0.3], kind: 'post' });
  }
}
```

## A small track without the world layer

`MapWorld` is for map-scale cities. For a track or an arena, give `PhysicsWorld` a height function and a surface
provider, and build the ground mesh from the same function:

<!-- from: test/howto/recipes.js#small-track -->
```js
const hills = (x, z) => 3 * Math.sin(x / 60) * Math.cos(z / 80);       // metres; any (x, z, y) => height works
const physics = new PhysicsWorld({ heightfield: hills });
physics.setSurfaceProvider((x, z, out) => {                            // per wheel, per step
  const onRoad = Math.abs(x) < 5;                                      // a straight road along z, 10 m wide
  out.mu = onRoad ? 1 : 0.6; out.crr = onRoad ? 1 : 4; out.tag = onRoad ? 'asphalt' : 'grass';
  return out;
});
const car = new VehicleController(ROAD_CAR_SPEC);
car.reset(new THREE.Vector3(0, hills(0, 0), 0), 0, physics);           // heading 0 faces -Z, down the road

// the ground mesh: a plane with the same heights, so what you see is what the car drives on
const ground = new THREE.PlaneGeometry(400, 400, 100, 100).rotateX(-Math.PI / 2);
const p = ground.attributes.position;
for (let i = 0; i < p.count; i++) p.setY(i, hills(p.getX(i), p.getZ(i)));
ground.computeVertexNormals();
```

`mu` scales tyre grip and `crr` rolling resistance. A road mesh is your own ribbon along the path, a few centimetres
above the ground.

## Add a sample page

Copy a starter folder to `samples/<name>/`. Every `samples/<name>/index.html` is a page: the dev server serves it at
`/<name>/` and `npm run build` includes it (`vite.config.js` finds it; `public`, `shared` and `dev` are not pages).
Add a link to `samples/index.html` so people can find it, and keep the page contract at the end of `boot()` so the
browser tests can tell when it is ready:

<!-- from: samples/starter-walk/main.js#page-contract -->
```js
window.__sample = Object.assign(createBenchHarness(engine, { name: 'starter-walk' }), { cc, anim }).setReady();
```

## Test a page headlessly

`test/browser/check-page.mjs` loads one page in headless Chrome through the repo's harness
(`test/browser/playwright.config.mjs`), waits for `window.__sample.ready`, holds W for two seconds and fails on any
console or page error. Run `node test/browser/check-page.mjs <name>`. On a machine shared with other GPU jobs, run it
through the lock wrapper you were given. The whole script:

<!-- from: test/browser/check-page.mjs#check-page -->
```js
import { startVite, resolvePage, launchChrome, watchErrors, loadSample } from './playwright.config.mjs';

const id = process.argv[2] || 'starter-walk';
const vite = await startVite();                       // its own dev server on a free port; closed below
const browser = await launchChrome();                 // headless Chrome with the GPU flags the harness uses
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);                   // console errors + page errors
  const path = await resolvePage(vite, id);
  const session = await loadSample(page, vite.base + path, errors); // waits for window.__sample.ready
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
  const draws = await page.evaluate(() => window.__sample.info().drawCalls);
  ok = session.status === 'ready' && errors.length === 0;
  console.log(`${id}: ${session.status} in ${session.loadMs} ms, ${draws} draw calls, ${errors.length} errors`);
  for (const e of errors) console.log('  ' + e);
} finally {
  await browser.close(); await vite.close();
}
process.exit(ok ? 0 : 1);
```

`npm run smoke` loads every demo and starter on both quality tiers: the starters are checked for a clean boot and
something drawn, the demos also for stable captures and look limits.
