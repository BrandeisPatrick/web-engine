# WIRING: P4 Car and camera (`feat/car-camera`) — for the integration agent; delete after integrating

## What this branch adds
- `src/world/CarVisual.js` (new): `createCarVisual(type, { color, castShadow, contactShadow, shadowOpacity })` ->
  `{ root, body, glass, interior, wheels, spinners, shadow, reverseLamps, spec, type, materials, lamps, update(dt, car, { darkness, lights, brake, reverse }), setColor, dispose }`,
  and `carSpecFor(type)`. Exported from `src/world/index.js`.
- Camera (`src/camera/`): `rig.addTrauma(x)` on every rig (CameraRig: `trauma`, `traumaDecay` 1.7, `traumaShake`);
  `new ChaseRig(cam, el, { feel: 'road' })` (or an object over `ROAD_FEEL`); `landingDip` / `sprintFov` options and
  `rig.land(speed)` on `ThirdPersonRig` and `FirstPersonRig`. New exports from `src/camera/index.js`: `ROAD_FEEL`,
  `LandingSpring`, `SprintFov`, `CameraMath.damp60`, type `ChaseFeel`. Defaults are off and give main's poses exactly
  (`test/camera-feel.mjs` section 1, against `test/camera-feel-ref.json` recorded from main).
- Tests: `test/car-visual.mjs`, `test/camera-feel.mjs` (+ `test/camera-feel-ref.json`), `test/rigs.mjs` (a block
  added), `test/browser/car-camera.mjs`.

## test/all.mjs
Add after `{ file: 'rigs.mjs' },`:
```js
  // camera feel: options off = main's poses (camera-feel-ref.json), road feel, trauma, landing dip, sprint FOV
  { file: 'camera-feel.mjs' },
```
and after `{ file: 'vehicles-hd.mjs', shim: true },`:
```js
  // createCarVisual: every HD type, wheels on the physics within 1 cm, a 10 s drive, lamps, contact shadow
  { file: 'car-visual.mjs' },
```
(Neither needs the canvas shim; together about 6 s.) The browser script is run by hand like the others:
`node test/browser/car-camera.mjs [--out=dir]` (through the GPU lock).

## test/types/check.ts
After the existing `const chase = new ChaseRig(...)` block (line ~147), add:
```ts
import { createCarVisual, carSpecFor, type CarVisual } from '@vibe/engine/world';
import { ROAD_FEEL, type ChaseFeel } from '@vibe/engine/camera';
const visual: CarVisual = createCarVisual('hatchback', { color: 0x9e1416 });
const vcar = new VehicleController(visual.spec);
visual.update(1 / 60, vcar, { darkness: 0.4 });
visual.update(1 / 60, null, { brake: 1, reverse: false, lights: true });
const suvSpec = carSpecFor('suv'); void suvSpec;
const roadChase = new ChaseRig(engine.camera, null, { physics, feel: 'road' });
const tuned = new ChaseRig(engine.camera, null, { feel: { sway: 0.4, lagCap: 0.3 } as Partial<ChaseFeel> });
roadChase.addTrauma(0.5).addTrauma(0.2); void tuned; void ROAD_FEEL.surge;
const tpDip = new ThirdPersonRig(engine.camera, null, { landingDip: 1, sprintFov: 6 });
tpDip.land(4.4);
```
(Tried in place: `npm run types:check` passes with these lines; not committed.)

## tools/asset-registry.mjs (then `npm run catalog`)
One code-built entry next to the vehicles (after `...Object.entries(VEH).map(vehicleEntry),`):
```js
  {
    id: 'engine-car-visual', name: 'Drivable car (createCarVisual)', category: 'vehicle', module: 'src/world/CarVisual.js', export: 'createCarVisual',
    usedBy: ['starter-drive'], tags: ['car', 'drivable', 'hd', 'wheels', 'lamps', 'procedural', 'player'],
    facts: { types: "VEHICLE_HD_TYPES (sedan, hatchback, suv, pickup, minivan, police, taxi, police_sedan)", physics: 'visual.spec = ROAD_CAR_SPEC resized to the body' },
    description: 'A drivable HD car in one call: makeVehicleParts body, glass, interior and four wheels that roll, steer and ride the suspension of a VehicleController built from visual.spec (ROAD_CAR_SPEC resized to the body, so the wheels sit where the physics has them), brake / reverse / head lamps and a soft contact shadow. Faces -Z; the origin is on the ground at the middle of the body length, the controller\'s reference point. Call visual.update(dt, car, { darkness }) each frame after placing visual.root on the car\'s pose.',
    snippet: `import * as THREE from 'three';
import { createCarVisual } from '@vibe/engine/world';
import { VehicleController } from '@vibe/engine/physics';
const visual = createCarVisual('hatchback', { color: 0x9e1416 });
scene.add(visual.root);
const car = new VehicleController(visual.spec);
visual.update(0, car, { darkness: 0 });`,
    preview: { az: 140, el: 16 },
  },
```
Note for the existing vehicle entries' text: "origin on the ground between the axles" — the origin is at the middle of
the body length (`z0 = -L / 2`), not the axle midpoint (for the hatchback the axles are at -1.27 and +1.36). Not changed.

## ENGINE.md
- Layer table, camera row: append `ROAD_FEEL`, `LandingSpring`, `SprintFov`.
- After the `ChaseRig` bullet (line ~558) add:
  > - Reactive cameras (opt-in, defaults give the old poses): `rig.addTrauma(x)` on every rig (shake = trauma², rotation
  >   only, trauma falls 1.7 / s; ~0.6 s at 1). `ChaseRig({ feel: 'road' })` reads `state.accel` (a VehicleController's
  >   `localAccel`): the boom lengthens under acceleration and shortens ~0.3 m under 1 g braking, the camera sways to the
  >   outside of a corner (~0.35 m at 0.8 g) with a <1° horizon tilt, high-passed vertical G gives a small heave, the
  >   follow frame never trails the heading by more than 0.35 rad, and the follow is sub-stepped (30 / 60 / 120 Hz agree
  >   within 2 cm). Tune with an object over `ROAD_FEEL`. `ThirdPersonRig` / `FirstPersonRig`: `landingDip` (gain; 1 ≈
  >   6 cm after a 1 m fall, 11 cm at the cap) with `rig.land(cc.landingSpeed)`, `sprintFov` (degrees while
  >   `state.sprint`).
- World table, the `Props.js + Furniture.js + Vehicles.js` row: add a row
  `| CarVisual.js | createCarVisual(type, { color, castShadow, contactShadow, shadowOpacity }) -> { root, wheels, spinners, spec, lamps, update(dt, car, { darkness, lights, brake, reverse }), setColor, dispose }, carSpecFor(type) |`

## AGENTS.md
- Starter table, starter-drive row: `HD hatchback (createCarVisual) on VehicleController(visual.spec), chase camera with road feel, textured road, static posts, speed readout`.
- API table, replace the "Drive a car" row's call column with
  `const visual = createCarVisual('hatchback'); car = new VehicleController(visual.spec); car.step(...); visual.update(dt, car, { darkness })`
  and its imports with `VehicleController (physics), createCarVisual (world), VehicleInput (input), ChaseRig (camera)`.
- New rows:
  `| A car body with wheels and lamps | createCarVisual (world) | createCarVisual(type, { color }) -> { root, spec, update(dt, car, { darkness }) } | samples/starter-drive/main.js |`
  `| A camera that reacts | ChaseRig, ThirdPersonRig (camera) | new ChaseRig(cam, el, { feel: 'road' }) + state.accel = car.localAccel; rig.addTrauma(x) on a hit; ThirdPersonRig({ landingDip: 1 }) + rig.land(speed) | starters |`
- Known traps, add: "`createCarVisual`'s spec is the body's: build the controller from `visual.spec` (or spread it),
  not from `ROAD_CAR_SPEC`, or the wheels float off their arches. Place `visual.root` on the car's pose before
  `visual.update`. Only `VEHICLE_HD_TYPES` have separate wheels (a bus / box truck throws)."

## docs/HOWTO.md recipe (new section after "Drive a car", or fold into it)
```md
## A real car body and a camera that reacts

Imports: `createCarVisual` (world), `VehicleController` (physics), `ChaseRig` (camera), `PoseInterpolator` (core).
`createCarVisual(type)` builds an HD body (sedan, hatchback, suv, pickup, minivan, taxi, police, police_sedan) and
returns `visual.spec`, ROAD_CAR_SPEC resized to that body, so the controller's wheels sit under the visual's.

(the starter's `road-car-spec`, `drive-controls`, `drive-step` and `drive-draw` regions, copied by test/docs.mjs)

`feel: 'road'` reads `state.accel`; leave it out for the plain follow. `rig.addTrauma(x)` works on every rig. On foot:
`new ThirdPersonRig(camera, el, { landingDip: 1 })` and `if (cc.landedThisStep) rig.land(cc.landingSpeed)`.
```

## Starters (tried locally, not committed: both pages load ready with no console errors, the drive page renders the car)
`samples/starter-drive/main.js` (136 lines after; was 145):
```diff
-import { PhysicsWorld, VehicleController, ROAD_CAR_SPEC } from '@vibe/engine/physics';
+import { PhysicsWorld, VehicleController } from '@vibe/engine/physics';
 import { ChaseRig } from '@vibe/engine/camera';
+import { createCarVisual } from '@vibe/engine/world';
 // #region howto:road-car-spec
-// ---- the car's physics: an ordinary road car. Spread it to tune: { ...ROAD_CAR_SPEC, motorPower: 200e3, vMax: 70 }.
+// ---- the car: an HD hatchback body and its physics, ROAD_CAR_SPEC resized to that body (wheels where the body has them).
+// Other bodies: 'sedan', 'suv', 'pickup', 'minivan', 'taxi', 'police'. Tune by spreading: { ...visual.spec, motorPower: 200e3 }.
 // (Without a spec VehicleController is the Roadster, a 400 km/h car that flies on the thrust input.)
-const SPEC = ROAD_CAR_SPEC;
+const visual = createCarVisual('hatchback', { color: 0x9e1416 });
+const SPEC = visual.spec; // ROAD_CAR_SPEC with this body's size, axles, track and wheel radius
 // #endregion howto:road-car-spec
@@ the box car (12 lines from `const body = new THREE.Group();` to `body.traverse(...)`) becomes:
+  const body = visual.root; // body, glass, wheels, lamps and a contact shadow; faces -Z like the controller
   scene.add(body);
@@ drive-controls
-  const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0 };
-  const rig = new ChaseRig(camera, renderer.domElement, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false });
+  const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0, accel: car.localAccel };
+  // feel: 'road': the camera eases back under acceleration, closes in under braking and leans out in corners
+  const rig = new ChaseRig(camera, renderer.domElement, { physics, canopyFromCollider: null, thinKinds: ['post'], flightFraming: false, feel: 'road' });
@@ drive-step (fixedUpdate, after car.step)
+      if (car.impact > 1.5) rig.addTrauma(Math.min(0.6, car.impact / 15)); // a short shake on a hit
@@ drive-draw (update): the 4-line wheel loop becomes
+      visual.update(dt, car, { darkness: atmosphere.darkness }); // wheels roll, steer and ride; brake / reverse / head lamps
```
The full patch is `/private/tmp/claude-501/-Users-patrickli-Documents-claudecode/aa822f53-c70d-4c62-8b29-c63c41529243/scratchpad/work/car-camera/starters.patch` (`git apply` from the repo root).

`samples/starter-walk/main.js` (+1 line, 177 after):
```diff
-  const rig = new ThirdPersonRig(camera, renderer.domElement, { physics, distance: 4.2, height: 1.6 });
+  const rig = new ThirdPersonRig(camera, renderer.domElement, { physics, distance: 4.2, height: 1.6, landingDip: 1 });
@@ walk-step (fixedUpdate, after cc.step)
+      if (cc.landedThisStep) rig.land(cc.landingSpeed); // a small camera dip on landing
```
Optional there: `sprintFov: 5` plus `state.sprint = c.sprint && cc.speed > 3` in `update`.

## Things the starter change breaks elsewhere (fix during integration)
- `test/browser/howto.mjs` line 144 checks the headlight target at `-4.3 / 2 - 0.05 - 20` from `ROAD_CAR_SPEC`
  ("the starter's car", lines 57 and 121): the hatchback is 4.26 m, so the check is off by 0.02 m (> 0.01): use
  `h.car.spec.length` (or expose `visual`).
- `test/browser/howto.mjs` step 3 builds the walker capsule from `h.body.children[0].clone()` (the box hull). With the
  visual, `children[0]` is the body InstancedMesh: build the capsule from its own geometry instead.
- HOWTO's "Drive a car" copies the `road-car-spec` region (test/docs.mjs checks the copy) and the van recipe keeps
  `ROAD_CAR_SPEC`, which is still right for a box car.
- The starter now imports `@vibe/engine/world`: check that the starter-drive build still loads 4 scripts and how much
  the world chunk adds (tree shaking should keep it to Vehicles.js + CarVisual.js + physics; not measured).
- If anything adds the car to the scene after `PostFX` is built, call `postfx.syncGBuffer()` and `postfx.track(visual.root)`.
