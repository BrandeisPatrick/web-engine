# `@vibe/engine` reference

What the engine provides today, layer by layer, with the real signatures. [README.md](README.md) is the overview and
the place to start; [docs/DESIGN-NOTES.md](docs/DESIGN-NOTES.md) keeps the history, the measurements and the reasoning
behind the decisions (links below point to it where the reasoning helps). The release is in `package.json` and
[CHANGELOG.md](CHANGELOG.md).

Paths are relative to the repository root. `src/<layer>/index.js` is the public surface of a layer and is importable as
`@vibe/engine/<layer>`; `@vibe/engine` re-exports every layer. Deep imports are unsupported. Every source file starts
with a header comment that documents its API; this file says what exists and where to look.

Contents: [Layers](#layers) · [Conventions to know first](#conventions-to-know-first) · [Core](#core) ·
[Physics](#physics) · [Render](#render) · [Animation, input and camera](#animation-input-and-camera) ·
[Audio and UI](#audio-and-ui) · [World](#world) · [Engineering conventions](#engineering-conventions) ·
[Packaging](#packaging)

## Layers

Order: core < physics < render < anim / input / camera / audio / ui < world. Lower layers never import higher ones.

| Layer | Import | Main exports |
|---|---|---|
| core | `@vibe/engine/core` | `Engine` (renderer, scene, camera, fixed-step loop, systems, resize, adaptive pixel ratio), `Profiler`, `ProfilerOverlay`, `Events`, `Clock`, `Entity` / `EntitySystem`, `Assets`, `MathDet` and the `det*` functions, quality tiers (`resolveQuality`, `QUALITY_TIERS`, `defineTier`), the bench harness (`createBenchHarness`, `readBenchParams`) |
| physics | `@vibe/engine/physics` | `PhysicsWorld` (query hub), `VehicleController` + `ROADSTER_SPEC`, `CharacterController`, `DynamicsWorld` (XPBD rigid bodies, joints, particles), `Cloth`, `Rope`, `SoftBody`, `Buoyancy`, `FracturedBody`, `DynamicsClient` (worker), the shape builders (`boxShape`, `sphereShape`, `capsuleShape`, ...) |
| render | `@vibe/engine/render` | `Atmosphere`, `PostFX` and its passes, `GBuffer`, `ClusteredLights`, `GpuParticleSystem`, `ParticleSystem`, `TextureSets` / `loadTextureSet`, `registerRenderLoaders`, `InstancedPool`, `LODGroup`, impostors (`bakeImpostors`, `ImpostorBatch`), `DecalTrail`, `ChunkCuller`, `PhysicsDebug`, `ClothMesh` / `RopeMesh` / `SoftBodyMesh`, `FractureMesh`, LUT helpers |
| anim | `@vibe/engine/anim` | `AnimationController`, `TwoBoneIK`, `CCDIK`, `Ragdoll` |
| input | `@vibe/engine/input` | `InputMap`, `CharacterInput`, `VehicleInput`, `TouchControls`, `PointerLock`, `GamepadState`, the action presets (`CHARACTER_ACTIONS`, `VEHICLE_ACTIONS`) |
| camera | `@vibe/engine/camera` | `CameraRig`, `CameraCollision`, `ChaseRig`, `OrbitRig`, `FreeFlyRig`, `ThirdPersonRig`, `FirstPersonRig` |
| audio | `@vibe/engine/audio` | `AudioBus`, the synth voices (`playTone`, `playNoiseBurst`, `OscStack`, `NoiseVoice`, ...), `PositionalAudio`, `SamplePlayer`, `registerAudioLoader`, `VehicleAudio`, `CityAmbience` |
| ui | `@vibe/engine/ui` | `UILayer`, `Panel`, `Readout`, `Gauge`, `Bar`, `Badge`, `Segments`, `Minimap`, `Flash`, `GMeter`, `AttitudeIndicator`, `HelpOverlay`, `LoadingScreen`, `QualityMenu`, the theme (`setTheme`, `theme`) |
| world | `@vibe/engine/world` | `MapWorld` and its systems (terrain, roads, buildings, props, vegetation, water, traffic), `TileStreamer`, `NearestLights` |

## Conventions to know first

- **Units and axes.** Metres, seconds, radians; Y is up (three.js). A heading or yaw of 0 faces -Z and a positive
  value turns left (counter-clockwise seen from above), the same as `Object3D.rotation.y`: `VehicleController`, the
  camera rigs and the rig target's `facing` all use it.
- **Models face +Z.** The glTF characters under `samples/public/` face +Z while the engine's forward is -Z;
  `samples/nyc-night/player.js` puts the model in a child group with `rotation.y = Math.PI`.
- **Fixed step.** `Engine` runs `fixedUpdate(dt)` at `fixedHz` (default 120) up to `maxSubsteps` (default 4) times per
  frame; `update(dt, alpha)` runs once per frame with the interpolation factor. Simulation goes in `fixedUpdate`;
  anything drawn from simulated state blends the last two steps with `alpha` ("Render interpolation" below).
- **Everything is opt-in.** `PostFX` features (G-buffer, TAA, SSR, volumetrics, motion blur, depth of field, LUT) are
  off by default; quality tiers are plain data that the game spreads into the constructors ("Quality tiers").
- **World data frame.** The baked city data uses metres around a centre, x east, z SOUTH; `MapWorld` shifts it so the
  spawn is the origin ("Data contracts").

## Core

### Engine and systems
The loop, the systems and the main render objects, with the real signatures:
```js
import { Engine, Atmosphere, PostFX, PhysicsWorld, DynamicsWorld, attachToPhysicsWorld } from '@vibe/engine';
const physics = new PhysicsWorld();                                           // static boxes, heightfield, dynamic providers
const engine = new Engine({ container: document.body, fixedHz: 120, maxSubsteps: 4, physics, targetFps: 0 });
const { scene, camera, renderer } = engine;
const atmo = new Atmosphere({ scene, renderer, camera, timeOfDay: 'noon', shadows: { cascades: 3, kernel: 'pcss' } });
const postfx = new PostFX(renderer, scene, camera, { atmosphere: atmo, width: innerWidth, height: innerHeight,
  pixelRatio: engine.pixelRatio,
  gbuffer: true, aa: 'taa', ssr: true, volumetric: true });                  // every 0.7.0+ feature is an option, off by default
engine.renderFn = (sc, cam, dt) => postfx.render(dt);
engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);  // PostFX keeps its first size otherwise
const dyn = new DynamicsWorld({ physics, substeps: 4, maxParticles: 4096 }); // rigid bodies, joints, particles, cloth, ...
attachToPhysicsWorld(dyn, physics);                                           // the hub sees the bodies as 'rigid' colliders
engine.addSystem({ fixedUpdate: (dt) => dyn.step(dt) }, 'dynamics'); // hooks: load?, earlyUpdate?, fixedUpdate?, update?, lateUpdate?, dispose?
engine.addSystem({ lateUpdate: (dt) => atmo.update(camera.position, dt) }, 'world');
await engine.load((p, label) => {});                                          // every system's load(progress), weighted
engine.start();
```
- A system is any object with some of `load?(onProgress)`, `earlyUpdate?(dt)` (before the fixed steps: input),
  `fixedUpdate?(fixedDt)`, `update?(dt, alpha)`, `lateUpdate?(dt, alpha)` (after every update: things that follow
  the final camera), `dispose?()` (header of `src/core/Engine.js`).
- `fixedUpdate(dt)` runs at the fixed rate (`engine.clock` pauses or scales it); `update(dt, alpha)` runs per frame
  with the interpolation factor; registration order is run order unless a system passes `priority`; `engine.setSystemEnabled(system, false)` skips a system.
- `engine.physics` is the `PhysicsWorld` the controllers and rigs query; `DynamicsWorld` bodies reach it through
  `attachToPhysicsWorld` (or the world's own `colliderProvider`).
- `engine.profiler.frame` gives per-system CPU ms and per-pass GPU ms (`EXT_disjoint_timer_query_webgl2`);
  `Profiler.benchThroughput` is the GPU-synchronised bench the measurements in the design notes come from.

### Core services
The 0.5.0 pass makes the engine usable beyond the driving game without adding a framework on top of three.js. Each
service is opt-in and `Engine` behaves exactly as before when none is used (`npm test` and the sample captures are
unchanged).
- `Events` (`core/Events.js`): a typed emitter, `on / once / off / has / emit(type, a, b, c, d)`, positional args,
  registration order, listeners may be added or removed during an emit (removals are compacted after the emit),
  and `emit` allocates nothing (dense arrays per type). Used by `AnimationController.events`.
- `Clock` (`core/Clock.js`, `engine.clock`): `timeScale`, `paused`, `step(n)` (n fixed steps while paused),
  `time` / `unscaledTime` / `frame`. `Engine.tick` scales the frame dt for every system and the fixed accumulator;
  the profiler, overlay and adaptive resolution keep the wall dt. `engine.clock.pause()` keeps rendering.
- `Entity` / `EntitySystem` (`core/Entity.js`): a thin component layer over `Object3D` — `entity.addComponent(c)`,
  components with `onAttach / onDetach / fixedUpdate(dt) / update(dt, alpha) / lateUpdate(dt, alpha)`, one
  `EntitySystem` registered with `engine.addSystem`, dense per-phase arrays (no per-frame `if (c.update)` probing),
  safe add / remove / destroy during a phase loop. No engine layer depends on it; samples use it for per-object
  behaviour.
- `Engine` additions: a system's numeric `priority` orders it before higher values (registration order within a
  priority); `engine.setSystemEnabled(systemOrName, false)` skips a system in every phase (a dedicated flag:
  InputMap, Ambience and the rigs keep their own `enabled` semantics).
- `Assets` (`core/Assets.js`): loader registry with cache, URL dedupe, refcounts (`release` disposes at zero),
  weighted progress and `assets.system()` for `engine.load`. `registerRenderLoaders(assets, renderer, { dracoPath,
  ktx2, meshopt })` adds `gltf` (`{ scene, animations, instantiate() }`, KTX2 through the TextureSets support,
  meshopt on demand, Draco when a decoder path is given), `texture`, `hdr` (`{ pmrem }`), `lut` (`.cube` ->
  `Data3DTexture`); `registerAudioLoader(assets, bus)` adds `audio` (decoded in an OfflineAudioContext before the bus has
  started, so a loading screen never waits for a gesture; `{ offline: false }` waits for the bus) and `SamplePlayer` plays buffers through the existing bus / positional emitters.
- `MathDet` (`core/mathDet.js`): `mulberry32`, `hashU32 / hashF64 / hashF64Array` (determinism hashes) and
  `detAtan2 / detAcos / detAsin / detAtan` built from + - * / sqrt only (max error 4.4e-16 vs `Math.*`), for
  simulation code that must be bit-identical on every JS engine.
- `createBenchHarness` (`core/Bench.js`): see "Bench harness and the page contract" below.
- Tooling: `npm test` runs `test/all.mjs` (every headless suite); `npm run types` emits `types/` from the JSDoc
  (`tsconfig.types.json`); `npm run smoke` / `npm run bench` drive the samples in Chrome through Playwright
  (`test/browser/`); `.github/workflows/ci.yml` runs test + build + types on every push and pull request.

### Quality tiers

`src/core/Quality.js`. `resolveQuality()` returns `{ tier, recommended, source, settings }` for the tier `desktop` or
`mobile`: `?quality=desktop|mobile` first, then the stored choice (localStorage `vibe.quality`), then
`recommendTier()`. `settings` is plain data in groups (`QUALITY_TIERS`); nothing reads it for you:

| Group | Goes to |
|---|---|
| `engine` | `new Engine({ ...settings.engine })` |
| `shadows` | `new Atmosphere({ shadows: settings.shadows })` |
| `postfx` | `new PostFX(renderer, scene, camera, { ...settings.postfx })` |
| `passes` | set by the game on the built PostFX: `postfx.aoPass.enabled`, `postfx.bloomPass.enabled` |
| `lights` | `MapWorld` `lights`, or your own `NearestLights` / `ClusteredLights` choice |
| `world`, `textures`, `effects` | read by the game (stream radius, traffic, texture size, particle budgets) |

A game may add its own groups (`resolveQuality({ overrides })`, `defineTier`). `new QualityMenu({ quality })` (ui
layer) is the gear button; a change stores the tier and reloads the page.

### Bench harness and the page contract

`createBenchHarness(engine, { poses, settings, after, quiet })` (`src/core/Bench.js`) creates `window.__sample`: `pose(id)` stops the loop, places the camera,
runs the sample's `after` (culling, LOD partitions, atmosphere) and `quiet` (particles off, exposure frozen) hooks
and renders two frames with dt = 0; `bench(frames)` is `Profiler.benchThroughput` over `engine.renderFn` (CPU
submission + GPU execution, no vsync); `capture(scale)` reads the default framebuffer right after a render and
box-downsamples it; `diff(a, b)` gives `meanAbs / p99 / max / pctOver2 / pctOver8`; `run(plan)` crosses poses and
settings into a table. `?bench=1&size=WxH` pins the drawing buffer at pixel ratio 1.

`harness.setReady()` sets `window.__sample.ready`; the browser scripts in `test/browser/` (through
`test/browser/playwright.config.mjs`: `startVite`, `launchChrome`, `loadSample`, `watchErrors`) wait for it, so a page
without it fails after the timeout. How to make captures reproduce across page loads, and the measured sweeps, are in
[the design notes](docs/DESIGN-NOTES.md#measurement-protocol).

### Render interpolation

Physics runs at the fixed rate and frames arrive at a variable rate, so a frame may hold 0, 1 or more steps. Showing
the latest step makes motion judder. The engine passes `alpha` (the fraction of a step left in the accumulator) to
`update(dt, alpha)`; an object driven by fixed-step physics keeps its previous pose and blends:
position `lerp(prev, cur, alpha)`, rotation `slerp(prev, cur, alpha)`. The camera then follows the blended pose. Why
and what it measured: [design notes, "Render interpolation"](docs/DESIGN-NOTES.md#render-interpolation-fix-for-judder-2026-10-18).

## Physics

Two cooperating worlds, both pure JS, deterministic and Node-safe (`npm test` runs them headless):
- `PhysicsWorld` (`physics/PhysicsWorld.js`) is the **query hub**: static AABB grid (buildings, props,
  walls), heightfield ground, pluggable dynamic providers (traffic, rigid bodies), surface provider, raycasts and
  sphere casts, `supportAt`. The controllers drive on its queries: `VehicleController` (sprung body on four spring /
  damper units with anti-roll and bump stops, tyre slip model, speed-sensitive steering, boost, thruster flight,
  landing / impact events; parameterised by a spec object; see "Vehicle model" below) and
  `CharacterController` (kinematic capsule, see "Animation, input and camera").
- `DynamicsWorld` (`physics/dynamics/`, 0.6.0) is the **unified XPBD rigid-body solver** (Müller, Macklin et al.
  2020, substepped position-based dynamics with velocity-level restitution and friction), plugged into the
  PhysicsWorld through `attachToPhysicsWorld(dyn, physics)`: every alive non-static body appears to the query hub as
  a `kind: 'rigid'` box record (pooled, allocation-free), so the car and the character collide with crates without
  knowing the solver, and the solver reads the PhysicsWorld's static boxes and heightfield as its static world.
- `new PhysicsWorld({ heightfield, groundLevel, surface })`: `heightfield` is `{ heightAt(x, z, y) }` or `(x, z, y) => height`
  (without one the ground is flat at `groundLevel`, default 0). Static boxes take their bounds in this order:
  `physics.addStaticBox(minX, minY, maxX, maxY, minZ, maxZ, kind)` (x and y pairs first, then z).

### DynamicsWorld (0.6.0)
Modules under `src/physics/dynamics/`, each independently testable (`test/dyn-*.mjs` in `npm test`):
- `state.js`: the shared data layout — `BodyStore` (structure-of-arrays Float64 state indexed by a dense body id:
  pos / quat / prevPos / prevQuat / vel / angVel (world) / invMass / body-frame inverse inertia tensor / forces /
  type / flags / layer / mask / aabb / sleep / kinematic target), `ContactBuffer` (normal from a to b, depth > 0 =
  penetration, negative = speculative, persistent feature `key`, warm-start `lambdaN / lambdaT`), `pairKey`,
  `WORLD_BODY`.
- `shapes.js`: `sphere / capsule / box / convex (hull via three's ConvexHull, re-centred, `offset`) / trimesh
  (static, median-split BVH) / compound`, with `inertia`, `aabb`, `support`, `project` as allocation-free scalar
  methods (every shape shares one hidden class).
- `broadphase.js`: dynamic AABB tree in typed arrays (Box2D-style, surface-area insertion, rotations), fat-margin
  re-insertion, an incremental candidate list, pair keys radix-sorted ascending; the pair set is a pure function of
  the bodies, never of insertion history (2000 bodies: 0.06 ms per update, 10 000: 0.4 ms).
- `narrowphase.js`: closed forms for sphere / capsule / box pairs, 15-axis SAT + reference-face clipping for
  box-box, GJK / EPA + face clipping for convex pairs, one-sided trimesh triangles through the BVH, compound
  recursion, heightfield sampling under the lowest points; <= 4 points per manifold with stable feature keys and a
  typed-array persistent table carrying warm-start impulses across steps.
- `xpbd.js` + `joints.js`: the positional / angular XPBD corrections with compliance, the substep integrator
  (implicit-midpoint gyroscopic term), velocity recovery, and `JointStore` with fixed / ball / hinge (limits,
  motor, servo) / slider / distance (spring, rope) / d6 (per-axis locks, swing cone, twist) joints solved as joint
  trees by a sparse LDLᵀ elimination per pass (a 20-link chain keeps its length to 1e-6 m; Gauss-Seidel stretched it
  by 8 mm), `breakForce`.
- `DynamicsWorld.js` + `islands.js`: the hub and its step: kinematic targets -> AABBs -> broadphase -> narrowphase
  (pairs, static boxes, heightfield) -> substeps (integrate; position pass: manifold blocks with patch friction,
  swept forward then backward, then joints; velocities from positions; velocity pass: restitution, Coulomb friction,
  joint damping / motors) -> warm-start store -> islands (union-find) and sleeping -> events (`began` / `ended`
  pair lists). Public API in the file header; `addJoint` takes string or `JOINT` types; `serialize() / from()`
  round-trip bit-identically.
- `queries.js` / `bridge.js` / `debug.js`: ray / shape casts and overlaps against body shapes, the PhysicsWorld
  bridge (`attachToPhysicsWorld`, `syncKinematicFromObject`), debug line generation (`render/PhysicsDebug.js`
  draws it).
- `DynamicsClient.js` + `dynamics.worker.js`: the same API over a module Worker (command stream in a Float64Array,
  ids mirrored synchronously on the main thread, double-buffered transferable snapshots like the traffic worker,
  extrapolated `getPose`, snapshot `queryColliders`); `{ worker: false }` runs in-thread with one code path.
  Worker mode sees the static boxes it was created with and no heightfield / providers / raycasts.
Determinism: the step path uses only `+ - * /`, `Math.sqrt` and comparisons (angles through `MathDet.detAtan2`),
iterates every array in ascending index order, never a Set or Map, so Node and every browser produce the same
bits (the suites pin golden hashes). Allocation: zero retained growth per step; V8 still boxes some doubles across
function calls (~3 KB per step at 300 contacts), which is noise, not garbage pressure.

What is not there: continuous collision detection (fast thin bodies can tunnel, and destruction stays local for
the same reason: "Unified XPBD (0.9.0)"), compounds off their centroid rotate about the shape origin, and the car
treats bridged bodies as immovable walls (the character couples both ways since 0.9.0, the vehicle does not).

### Unified XPBD (0.9.0): particles, cloth, ropes, soft bodies, coupling, buoyancy, fracture, ragdolls
The rigid solver gains a particle store and a solver-plugin seam, and everything deformable is built on it; the rigid
path without `maxParticles` steps bit-identically to 0.8.0 (pinned).
- **Particles** (`dynamics/particles.js`): `new DynamicsWorld({ maxParticles, particleDamping })` owns
  `world.particles` (SoA `ParticleStore`: pos / prevPos / vel / invMass / radius / mass / flags / group, free-list
  ids with free hooks) and `world.constraints` (`ParticleConstraints`: distance, quick bending, attachment to a body
  point, one-sided tethers, body tethers; XPBD compliance, one Gauss-Seidel sweep per position iteration).
  `world.addParticleSolver(solver)` registers `{ name, beginStep, solvePositions(world, h, it),
  solveVelocities(world, h, it), endStep, serialize, restore }` plugins that run inside every substep after the
  built-in constraints (also on worlds without particles); `world.isActive(id)`, `world.particleAabb(group, out)`,
  `world.recollidePairs(ids, n)` for pairs a plugin unglued in its beginStep. Builders `Cloth.grid` (structural /
  shear / bend constraints, tethers to the pins when stretch is 0, pins by name / index / body) and `Rope.chain`.
  Serialize / from carry the store, the constraints and the plugins by name; the worker client falls back to
  in-thread with particles (no snapshot protocol for them yet). Sleeping: a body held by a loaded attachment stays
  awake only while its particle moves or the load changes.
- **Soft bodies** (`dynamics/softbody.js`): `SoftBody.lattice` (box / voxel sphere, 6 tets per cell, edge distance
  constraints + XPBD tet-volume constraints, optional global `pressure` constraint that holds the total volume to
  0.02 %), `tetrahedralize`, `SoftBody.skin` (any mesh bound by barycentric coordinates, nearest-tet rule outside),
  `VolumeConstraints` as a plugin.
- **Coupling and buoyancy** (`dynamics/coupling.js`): `ParticleCollider` (particles vs rigid bodies, static boxes,
  the heightfield and trimeshes: contacts found once per step from each group's AABB, solved every substep as
  unilateral XPBD constraints with the body's generalized inverse mass, Coulomb + static friction, two-way; a body
  carried by particles stays awake), `Buoyancy` (sample-point submerged volume per shape, buoyant force + linear /
  angular drag as per-step forces; particles by submerged fraction; `fluid.heightAt(x, z, t)` so the world's Gerstner
  `waveHeight` plugs in), `closestPointOnShape`.
- **Fracture** (`dynamics/fracture.js`, `render/Fracture.js`): `fracturePieces` (seeded plane cuts of a hull,
  adjacency tracked as contact polygons, minimum fragment fraction), `FracturedBody` (pieces as bodies glued by FIXED
  joints anchored at the shared faces, `breakForce` 15 kN + `breakStress` per area, `compliance` 5e-7 m/N so a hit
  stays local; `update()` reports and removes broken joints, `breakNear`, `impactBreak(contacts, { impulse, radius })`
  for deterministic game-side shattering), `FractureMesh` (one mesh per piece, interior material). The joint solver
  now bounds a breaking joint's rows at `breakForce` per substep, so the struck piece keeps the impulse instead of
  the whole assembly.
- **Character dynamics** (`CharacterController.attachDynamics(dyn, { pushMass, pushForce, ride })`): light
  dynamic bodies are pushed with bounded impulses (and a body that cannot yield becomes a moving wall), moving
  platforms carry the character (velocity frame switches on landing / leaving); `platformVelocity`, `pushedBody`,
  `rideBody`. Without it the controller is bit-identical.
- **Ragdoll** (`anim/Ragdoll.js`): `Ragdoll.fromSkeleton` maps a skeleton (auto by name: the procedural rig,
  mixamo / RobotExpressive) to capsules + ball / hinge joints with limits measured from the rest pose,
  `activate` from the current bone transforms, `update` drives the bones from the bodies, `deactivate` hands them
  back; `AnimationController.resync()` after writing bones by hand.

Known / deferred: no particle-particle contacts or self-collision, no CCD (fast thin bodies tunnel; a ragdoll
dropped from 3 m first contacts 5 cm deep), particles in-thread only, one Gauss-Seidel pass (stiff edges fight
rigid tets: use `pressure`; cloth corners pinched by static friction at 4 substeps), rolling spheres / capsules
gain spin on the ground (under investigation), the buoyancy scene's wave height uses Math.sin so it is bit-equal
within one JS engine only.

### Vehicle model (`src/physics/VehicleController.js`)

`new VehicleController(spec)` with a plain spec object; missing fields come from `ROADSTER_SPEC` (`resolveVehicleSpec`),
which is an electric hypercar with a thruster flight package. For a ground car pass `flight: false` (no thrusters,
`mode` always `'ground'`) and set the powertrain (`mass`, `motorPower`, `motorPeakForce`, `vMax`); the full field list
with comments is `ROADSTER_SPEC` in the source. `samples/miami-drive/spec.js` is a road-car spec that
`test/miami-car.mjs` checks. Per fixed step: `vc.step(dt, controls, world)` with a controls object
`{ throttle, brake, steer, handbrake, thrust, pitch, yaw, boost }` and a `PhysicsWorld`; `VehicleInput` outputs those
values as fields and the game copies them in once per frame (`samples/miami-drive/car.js`); `vc.reset(position, heading,
world)` places it; `vc.hold = true` freezes it on the ground (countdowns) and `reset()` leaves it set.
`PhysicsWorld.setSurfaceProvider(fn)` / `surfaceAt(x, z, out)` give per-wheel `{ mu, crr, tag }` multipliers.
The suspension and contact model:

- Each wheel hangs from an attach point at the top of its travel along body-down and sits on its support within
  `suspensionTravel` (`wheels[i].y`, `compression`, `contact`); beyond the travel it is in the air (`wheelGaps[i]`).
  The support under a rolling tyre is sampled with the tyre radius (centre + 0.6 R ahead / behind along the velocity,
  box corners within R lift the wheel along the tyre's circle), so a kerb is climbed over several steps.
- Spring rate per corner = static load / sag (`suspensionSag` x travel), damping ratio `suspensionDamping`, anti-roll
  bar `antiRoll` x the axle rate. Forces act along body up at the contact points and give the body pitch / roll
  torques about the CG (`cgHeight`, `pitchInertia`, `rollInertia`); tyre forces act at the contact patches, so braking
  dives, acceleration squats, cornering leans outward; downforce is applied at the axles (`downforceFront`). Axle
  loads for the tyre model are the spring loads (the old smoothed weight-transfer terms are gone).
- `position` is still the reference point that rests at ground height at the static load; the body moves within
  +-travel of it (top speed downforce: -1 cm). Travel exhausted -> the body clamp acts as a bump stop (velocity into
  the surface removed, hard touchdowns above `hardLandingSpeed` still bounce and damage). Body points use the
  wheel-level step reference: a surface more than `stepHeight` above the wheels is an obstacle, never a floor.
- Boxes low enough to be driven onto (top within `stepHeight` of the reference) are supports, not walls, for the body
  OBB. Traffic boxes carry `vx / vz`; the contact response runs in the box's frame so a moving car shoves with its
  momentum.
- Flight is armed by a lift input (`flightArmThrust`) and disarmed by touchdown: airborne without it is ballistic
  with auto-level only (`mode` stays `'ground'`, no hover assist); a lift tap in the air arms at once.
- `reset()` and `hold` fit the body to the plane through the supports with the wheels at static compression (no
  first-step snap when spawning on a hill).

The measurements behind it: [design notes, "Suspension & contact model"](docs/DESIGN-NOTES.md#suspension--contact-model-2026-10-19).

### Rapier plug-in contract (1.0)
The engine's own solver is `DynamicsWorld`; a Rapier (or Jolt, or any other) backend is a class with the same surface,
so that everything reading a dynamics world keeps working. What reads it, and therefore what a replacement must
provide (the header of `physics/dynamics/DynamicsWorld.js` is the normative text):
- **Readers.** `attachToPhysicsWorld(dyn, physics)` (bridge.js) publishes `dyn.bodies` to the query hub: it needs a
  `BodyStore`-shaped `bodies` (dense ids, `alive` / `type` / `flags` / `kind` / `layer`, `aabb` (6 per body, margin
  included), `vel`), or the world's own `colliderProvider` / `queryColliders(x, z, r, out)` appending the pooled
  `{ minX .. maxZ, kind, id, vx, vz }` records. `render/PhysicsDebug.js` calls `debugLines(out, max)`. `DynamicsClient`
  (the worker protocol) needs `serialize()` / `from(desc)` and reads poses as `bodies.pos` (3 per id) / `bodies.quat`
  (4 per id). `Ragdoll`, `FracturedBody`, `CharacterController.attachDynamics` and the
  particle plugins read `bodies.pos / quat / vel / angVel / invMass` by id and call the methods below.
- **Methods.** `addBody({ type, shape, position, quaternion, mass | density, friction, restitution, linearDamping,
  angularDamping, layer, mask, kind, userData, noGravity }) -> id` (stable ids, lowest free first; shapes from
  `dynamics/shapes.js`: sphere / capsule / box / convex / trimesh / compound, read through `describeShape`),
  `removeBody(id)`, `setPose` / `getPose` (positional or array / `{x, y, z, w}` forms), `setVelocity` / `getVelocity`,
  `applyImpulse` / `applyForce` / `applyTorque`, `setKinematicTarget`, `setGravity`, `addJoint(desc) -> id` /
  `removeJoint(id)` with the `JOINT` types fixed / ball / hinge / slider / distance / d6 (limits, motor, compliance,
  damping, `breakForce`, `collideConnected`), `wake` / `sleep` / `isAwake` / `isActive`, `step(dt)` (fixed dt, no
  allocation once warm), `raycast(origin, dir, maxDist, opts)` / `shapeCast` / `overlap` / `pointInBody`,
  `getGroundHeight` / `surfaceAt` passthrough to `physics`, `serialize()` / `static from(desc, { physics })`,
  `dispose()`.
- **Fields and events.** `contacts` (last step: `a`, `b`, point, normal, `depth`, `lambdaN` / `lambdaT`), `began` /
  `ended` (`{ count, keys }` pair keys `a * 65536 + b`), `stats` (bodies, awake, pairs, contacts, joints, islands, ms
  with `timing`), `time`, `stepCount`, `gravity`, `substeps`.
- **Not part of the contract.** `particles`, `constraints`, `addParticleSolver`, `recollidePairs`, `particleAabb`:
  the particle store and its solver plugins (cloth, ropes, soft bodies, coupling, buoyancy, the fracture impact
  plugin) are the XPBD solver's own and stay on `DynamicsWorld`; a Rapier world would carry rigid bodies and joints
  only, and those features would stay on the JS solver.
- **Determinism.** The `dyn-*` suites pin this solver's bits (golden hashes, 1e-9 range checks); a WASM backend with
  f32 math will not reproduce them and needs its own pins. `test/car-sim.mjs` and `test/world-build.mjs` do not
  touch the dynamics world and stay the gate for any backend.
An adapter would own a `RAPIER.World`, create its colliders from the shape descriptors, mirror every body's pose /
velocity into a `BodyStore` after each `step` (so the readers above work unchanged), map the joint descriptors to
Rapier's impulse joints, answer the queries through Rapier's query pipeline and build its `contacts` from the event
queue. Nothing in the engine imports `DynamicsWorld` by class check: the samples and the controllers only call the
surface above.

## Render

### Lighting
- Atmosphere: physically based sky, sun disc + lensflare, procedural cloud layer, height fog, time of day (hours or
  presets), moon/stars; PMREM environment refreshed on time change; emissive scaling by darkness.
- Shadows: camera-following cascaded shadow maps (2 by default, up to 4: `shadows.cascades`), texel snapping to
  stop shimmer, per-light bias; kernels `'pcf'` (three's), `'fast'` (5 hardware-compare taps) and `'pcss'`
  (blocker search + contact-hardening penumbra), switchable at runtime (`atmo.setShadowKernel`).
- Post: GTAO (half-res + denoise), bloom (threshold per time of day), FXAA or 4x MSAA by day (forward path) or TAA
  over the G-buffer path (0.7.0), filmic grade, vignette, height fog pass. Everything resolution-aware.
- Local lights: `NearestLights` (world layer, `src/world/NearestLights.js`) keeps a pool of real point lights
  (default 8) on the lamps nearest the view, or, with `mode: 'clustered'` and a `ClusteredLights` instance, pushes
  every lamp in range into the clustered list. `MapWorld` does this for its street lamps (its `lights: { clustered:
  true }` option); a game without `MapWorld` creates the `NearestLights` / `ClusteredLights` itself. Intensities are
  three's `PointLight` units (linear colour x intensity).
- Moonlit scattering (opt-in, `new Atmosphere({ moonScatter: amount })`, default 0 = off): at night, while the moon
  is the shadow-casting light (`lightDir = moonDir`), the post fog's forward-scatter glow (`fogParams.sunScatter`,
  otherwise 0 at night) is `amount`, and `atmo.scatterDir` / `atmo.scatterColor` follow the moon (`moonDir`,
  `moonColor`). PostFX's fog glow and the volumetric pass read those fields (falling back to `sunDir` / `sunColor`),
  so with `volumetric` on the pass marches moonlight shafts through the cascades that follow the moon, coloured
  `moonColor * moonIntensity`. Without the option both fields ARE the `sunDir` / `sunColor` objects: output
  unchanged, and by day nothing differs with it either (`test/volumetric.mjs`). The Halloween sample uses it (phones:
  the analytic glow only; desktop: the volumetric pass at `intensity` 0.07, 50 m).

### Render pipeline (0.7.0): G-buffer, TAA, clustered lights, cascades, GPU particles
Two paths, chosen per `PostFX` instance; the forward path is the default and renders bit-identically to 0.6.0.
- **Forward** (`gbuffer: false`): ScenePass (4x MSAA HDR R11G11B10F + depth) -> Exposure -> AO -> Bloom -> Final
  (FXAA when MSAA is off: above `msaaMaxPixels` or by night).
- **G-buffer** (`gbuffer: true`): the scene pass renders into a 3-attachment MRT target (`render/GBuffer.js`:
  colour R11G11B10F, normal RGBA8 = octahedral view-space normal + roughness + metalness nibble / flags, velocity
  RG16F in UV units) with `samples: 0` (MSAA + MRT would resolve every attachment and depth per attachment), then
  Exposure -> AO -> **TAA** (`passes/TAAPass.js`: 5-tap Catmull-Rom history, YCoCg variance clip, velocity
  reprojection for objects that wrote one, depth reprojection otherwise, blend 0 on disocclusion / off-screen /
  noHistory) -> Bloom -> Final, with Bloom and Final reading `postfx.colorSource`. `aa: 'auto' | 'msaa' | 'fxaa' |
  'taa'` ('auto' = today's rule forward, TAA with the G-buffer); `CameraHistory` jitters the projection (Halton
  16) and publishes the unjittered / previous view-projection to every pass and to the G-buffer uniforms.
- **Writing the G-buffer** is a global chunk patch under the per-material define `ENGINE_GBUFFER` (the
  `shadowKernel.js` pattern): declarations in `clipping_planes_pars_fragment`, captures in `normal_fragment_maps` /
  `roughnessmap_fragment` / `metalnessmap_fragment`, the writes in `dithering_fragment`, the velocity varyings via a
  `project_vertex` tail. Materials that replace those chunks append the exported tails (vegetation, impostors,
  water, buildings do). Blended / unlit / non-mesh materials write zeros to the extra outputs (`ENGINE_GBUFFER_ZERO`;
  on ANGLE/Metal that is faster than narrowing the draw buffers, which ends the render pass); an `autoSync` hook
  classifies materials on their first draw so nothing disappears from the MRT target. Velocity sources: instanced
  objects through `InstancedPool({ velocity: true })` (previous-matrix attribute), moving meshes through
  `postfx.track(mesh)` (a unique material + previous model-view uniform; `postfx.trackPool(pool)` for pools), both
  kept by PostFX and replayed whenever the G-buffer is rebuilt, everything else camera-only; skinned meshes get
  model-matrix velocity.
- **Clustered lights** (`render/ClusteredLights.js`): a CPU froxel grid (16 x 9 x 24 exponential slices) assigns
  point / spot lights (`maxLights`, default 1024) to cells, uploaded as one RGBA32F light texture and one RGBA32UI cells + index
  texture (+2 texture units); a global `lights_pars_begin` / `lights_fragment_begin` patch under `ENGINE_CLUSTERED`
  loops over the fragment's cell and calls three's `RE_Direct` with the stock attenuation, so 8 clustered lights
  render pixel-identically to 8 real `PointLight`s. No shadows on clustered lights (real three lights keep theirs).
  The world layer's `NearestLights({ mode: 'clustered' })` pushes every lamp within `clusteredRange`.
- **Cascades and PCSS** (`shadowCascade.js`, `shadowKernel.js`, `Atmosphere`): `shadows.cascades` 1-4 (middle
  cascades `sunMid` / `sunMid2` between the near `sun` and the far `sunFar`, round-robin map updates), `kernel:
  'pcss'` (8-tap blocker search on the packed map, penumbra from receiver - blocker, 12-tap rotated compare disc),
  `atmo.shadowCascadeInfo(out)` for later passes (volumetrics in 0.8.0).
- **GPU particles** (`render/GpuParticles.js`): the `ParticleSystem` API (same `spawn` / `emit` / `update`) over
  `GPUComputationRenderer` ping-pong textures, 65k particles, deterministic slot assignment, optional depth-buffer
  collision.
- **Temporal upscaling** (`renderScale` < 1, TAA only, default 1): the scene and the passes before TAA run at the
  drawing buffer x s and the TAA resolve upscales; `postfx.set('renderScale', s)` changes it live. The demos keep 1
  ([design notes](docs/DESIGN-NOTES.md#from-render-pipeline-070-the-measurements-enginemd-lines-128-179-at-d959298)
  has the measurements).
- **Velocity for TAA and motion blur.** `postfx.track(object3d)` gives a moving mesh per-object velocity. A material
  shared with other meshes is cloned for it, with a one-line `[GBuffer] track()` console warning; nothing else needs
  doing.

### Render pipeline (0.8.0): screen-space reflections, volumetrics, water refraction, lens passes, LUT
Five opt-in stages on top of the 0.7.0 pipeline, composed by `PostFX` in the order Scene -> Exposure -> AO -> **SSR**
-> **Volumetric** -> TAA -> **MotionBlur** -> **DoF** -> Bloom -> Final (`postfx.colorSource` is the output of the
last enabled pass of TAA -> MotionBlur -> DoF, read by Bloom and Final). Every option is off by default and the
default output is byte-identical to 0.7.0: the new GLSL lives under defines that are absent by default (`FINAL_SSR`,
`FINAL_VOLUMETRIC`, `FINAL_LUT`, `TAA_SSR`), pinned by sha1 in `test/postfx-options.mjs`, and `npm run smoke` hashes
every default pose equal to the 0.7.0 gate. All knobs are live through `postfx.set(path, value)` / `postfx.get(path)`
(`'ssr'`, `'ssr.<option>'`, `'volumetric'`, `'volumetric.<option>'`, `'motionBlur'` (0 removes the pass),
`'motionBlur.<option>'`, `'dof'` (null | true | options), `'dof.<option>'`, `'lut'`, `'lut.strength'`,
`'ao.normals'`); passes that need the G-buffer (ssr, motionBlur, `ao.normals: 'gbuffer'`) throw without
`gbuffer: true` and are rebuilt whenever the G-buffer is, volumetrics need an Atmosphere.
- **Screen-space reflections** (`passes/SSRPass.js`, `ssr: { scale 0.5, maxPixels, steps 24, refine 4, maxDistance
  80, thickness 0.4, thicknessScale 0, maxRoughness 0.5, edgeFade 0.1, jitter false, metalTint true }`): a
  perspective-correct screen-space march on the scene depth from the G-buffer normal, bisection refinement, the
  current frame's colour at the hit; the output is PREMULTIPLIED (rgb = reflection * w, a = w, w = hit confidence *
  the Fresnel / env-BRDF specular share * edge / roughness / distance fades), composited as `col * (1 - a) + rgb`
  inside the TAA resolve (every 3x3 tap, so the variance clip keeps the reflection) or in the final pass when TAA is
  off. The G-buffer has no base colour, so the specular share of metals is a heuristic (capped so a pixel never
  reflects more than it renders; an F0 nibble in the G-buffer is a 0.9.0 item), and there is no roughness blur: a
  mirror-sharp hit fades out between roughness 0.3 and 0.5. `jitter` is off because the TAA hook composites one
  reflection sample into all nine taps, so a jittered march cannot converge through the clip box.
- **GTAO on G-buffer normals** (`AOPass({ normals: 'gbuffer' })`, `ao.normals`): one normal fetch replaces the
  nine-tap depth reconstruction and normal maps feed the AO; the image changes (and can show dark fringes on
  normal-mapped grazing surfaces), so it stays opt-in.
- **Volumetric sun light** (`passes/VolumetricPass.js`, `volumetric: { scale 0.25, maxPixels, steps 16, maxDistance
  400, g 0.55, density 1, temporal true, blend 0.9, jitter true, intensity 1 }`): a quarter-resolution march through
  THE SAME medium the final pass fogs with (the atmosphere's haze + mist exponential layers, `density` scales it),
  accumulating the sun's single scattering (Henyey-Greenstein phase, transmittance from the closed-form optical
  depth, visibility from the cascade shadow maps: compare-mode depth textures for 'fast' / 'pcss', packed maps for
  'pcf', the same cascade walk as `shadowCascade.js`), temporally accumulated with the camera history (2x2
  depth-aware disocclusion). Output RG16F: r = in-scatter per unit sun irradiance, g = linear depth; the final pass
  adds `sunColor * sun.intensity * intensity * upsample(r)` after the fog and drops the analytic sun-glow term. The
  units are physical: in thin haze (optical depth ~0.08 over 400 m) and in air shadowed by walls the shafts are
  faint by construction; `density` and `intensity` are the look knobs.
  Past the far cascade box (260 m by default) the air counts as lit. At night the pass is dark unless the
  Atmosphere's `moonScatter` is on: then it marches the moon (see "Lighting").
- **Water refraction** (`world/Water.js` `createWaterMaterial({ refraction })`, `MapWorld({ water: { refraction:
  false } })`, `world.setWaterRefraction`, `render/SceneCopy.js`): `SceneCopy` copies the bound scene target's
  colour + depth into a half-resolution RGBA16F + R32F pair right before the water draws (its `onBeforeRender`, one
  copy per frame shared by every attached mesh, the target / viewport restored as three's own Reflector does), and
  the water samples it with a slope-driven uv distortion, Beer-Lambert absorption by water depth, murk toward the
  body colour and depth foam at pilings and walls. It needs a single-sampled scene target (the G-buffer path or
  `aa: 'fxaa'`: an MSAA target resolves only at the end of the frame), skips with one warning otherwise, and the bay
  has no floor, so open water reads as full murk and the effect shows along seawalls, piers and boats.
- **Motion blur** (`passes/MotionBlurPass.js`, `motionBlur: strength | { strength 1, maxBlur 24, tileSize 20,
  samples 8, shutter 0 }`): McGuire 2012 tile-max / neighbour-max / reconstruction on the G-buffer velocity (camera
  reprojection where nothing wrote one); a static frame is an exact pass-through; `shutter` (seconds) makes the
  streak length frame-rate independent.
- **Depth of field** (`passes/DoFPass.js`, `dof: { focusDistance 12, focalLength 50, fStop 2, sensorHeight 24,
  maxCoC 12, scale 0.5, samples 24, nearBlur true, stableDepth false }`, `circleOfConfusion()`): a signed thin-lens
  circle of confusion from the depth, half-resolution far / near gathers (Vogel disc; the near field dilated so it
  spreads over sharp objects), full-resolution composite; in-focus pixels are an exact pass-through.
- **3D LUT grading** (`render/Lut.js`, `lut: { texture, size, strength 1 }`, the Assets `lut` value from a `.cube`
  file): applied to the sRGB output before grain / dither; `identityLut` / `lutFromFunction` / `lutLookup` for tests
  and procedural grades (`samples/public/luts/` has `warm.cube`, `bleach.cube` and `identity.cube`).

### Textures (PBR sets, KTX2)

`src/render/TextureSets.js` loads photo-scanned PBR sets (`diff` / `nor_gl` / `rough` / `ao` JPGs in one folder per
set id, optional `.ktx2` twins) listed in a `manifest.json`, with procedural fallbacks so a missing file never breaks
a game. In this repository the sets live per demo: `samples/public/miami/textures/`, `samples/public/miami/road/`,
`samples/public/nyc/textures/` (each folder has its `manifest.json` and `CREDITS.md`), served at
`${import.meta.env.BASE_URL}miami/textures/` and so on.

- `loadTextureSet(id, { renderer, base, manifest })` -> `{ map, normalMap, roughnessMap, size }` (plus `aoMap` when
  `maps` asks for it), or null. `id` is the set's folder name, the manifest entry's `id` (for example
  `leafy_grass`), not the manifest key (`grass`): with a manifest, an id it does not list returns null without a
  warning. `base` is the folder URL ending in `/`; the default, `${BASE_URL}textures/`, does not exist in this
  repository, so pass it. `size` is metres per tile (from the manifest). Never throws.
- `loadTextureManifest(base)` -> the manifest or null.
- `TextureSets.configure({ base, basisPath, maxAnisotropy, ... })` sets the defaults for later calls. KTX2 needs the
  Basis transcoder; the default `basisPath()` is `${BASE_URL}basis/`, which does not exist here either; Miami ships
  it at `samples/public/miami/basis/` (`basisPath: `${BASE_URL}miami/basis/``). Without a transcoder the JPGs load.
- `makeTextureArray(renderer, sets, opts)` packs several sets into two RGBA8 `DataArrayTexture`s for shaders that
  index a layer (the building facades).
- `TextureSets.stats` and one `[TextureSets]` console line per load wave report the path (ktx2 / jpg / procedural),
  bytes and timings. `?ktx2=0` forces JPGs.

`tools/fetch-textures.mjs` downloads Poly Haven sets and writes a manifest; `tools/compress-textures.mjs` writes the
`.ktx2` twins and copies three's transcoder ([tools/README.md](tools/README.md)). The codec choices and their measured
cost are in [the design notes](docs/DESIGN-NOTES.md#textures-pbr-sets-ktx2).

## Animation, input and camera

- `CharacterController` (`physics/CharacterController.js`): a kinematic capsule over the `PhysicsWorld` query API
  (`getGroundHeight`, `queryColliders`, optional `surfaceAt`), `step(dt, moveX, moveZ, jump, sprint, world)` with
  world-space move direction, step climbing up to `stepHeight`, slope limit, wall slide, ground snapping, coyote
  time and jump buffering (the jump edge is detected internally), crouch via `setHeight(h, world)` / `canStand`
  (auto-crouch under a ceiling); outputs polled per step like `VehicleController` (`grounded`, `landedThisStep`,
  …). You cannot stand on a vehicle. Deterministic: the step path uses no trig.
  `test/character-sim.mjs` pins it by ranges and a golden hash.
- `ThirdPersonRig` / `FirstPersonRig` (`camera/`): orbit-behind and eye-height rigs on `CameraRig` with
  `look(dx, dy)`, damped follow, `CameraCollision` pull-in (the ChaseRig method) and ground clamp; yaw 0 = -Z,
  positive yaw turns left; `getForward / getRight` give the yaw basis for camera-relative movement. Target facing
  is read from the state getter (`facing` / `heading`), head bob from `speed` / `grounded`.
- `CharacterInput` (`input/`): the `CHARACTER_ACTIONS` preset (move / look / jump / sprint / crouch / interact /
  toggleCamera / menu) with touch layout; look deltas are radians per frame and only flow under pointer lock or a
  right-button hold; `PointerLock` wraps the DOM API (`request() -> Promise<boolean>`, `releasedByUser`). Phone
  options (opt-in, the default layout is unchanged): `touchOptions: { safeArea: true }` (offsets from
  `env(safe-area-inset-*)`), per-entry `portrait` overrides re-applied on rotation, `floating` sticks (the base follows
  the thumb inside a zone), `TouchControls.setProgress(id, p)` cooldown rings, button `hitSlop` (an invisible hit
  ring around a button), touchpad `slop` (a drag counts from that many px), `touchReveal` (controls on the first
  touch, hidden on a key press) and `isTouchDevice({ multiTouch: true })` (iPads with a keyboard); `samples/halloween/`
  uses them all.
- `anim` layer: `AnimationController` (states, 1D blend trees, transition table, markers, root motion with the
  hips' horizontal track neutralised) and `TwoBoneIK` / CCD helpers.
- A working example of the whole stack: `samples/nyc-night/player.js` (controller, animation, the state the rig reads)
  and `samples/nyc-night/main.js` (input and rig).
- `ChaseRig` (`src/camera/ChaseRig.js`) follows a vehicle: `rig.setTarget(object3d, () => state)` (`CameraRig`), where
  the state getter returns what the rig reads (`velocity`, `speedKmh`, `mode`, `grounded`, ...; the list is in the
  ChaseRig source). `VehicleInput` (`src/input/VehicleInput.js`) reads keyboard, gamepad and touch into
  `throttle`, `brake`, `steer`, `handbrake`, ... fields, the values `VehicleController.step` takes.

## Audio and UI

- `AudioBus` (`src/audio/AudioBus.js`): the WebAudio context and mixer. No context exists until `bus.start()` runs
  inside a user gesture (`bus.unlockOnGesture()` does it on the first key or pointer press); `bus.bus(name)` is null
  before that. Default buses: `engine`, `effects`, `ambience`, `ui` (`DEFAULT_BUSES`); other names are created on
  demand.
- Synth voices (`src/audio/Synth.js`): `playTone(bus.ctx, bus.bus('ui'), { pitch, peak, decay, ... })` for one-shot
  blips, `playNoiseBurst`, `OscStack`, `NoiseVoice`, `LFO`. `PositionalAudio` attaches emitters to Object3Ds;
  `SamplePlayer` plays decoded files (`registerAudioLoader` adds an `audio` loader to `Assets`).
- `VehicleAudio` (`src/audio/VehicleAudio.js`) is an electric motor plus thruster synth: `audio.start()` in a gesture,
  then `audio.update(dt, state)` per frame with `{ speedKmh, rpmLike, thrust, grounded, mode, wheelSlip, ... }`.
  `CityAmbience` is a wind / city / gulls bed. The Miami V8 sound is the demo's own (`samples/miami-drive/audio.js`).
- UI (`src/ui/`): DOM widgets on a CSS-variable theme. `new UILayer()` is the overlay, `new Panel({ parent, corner })`
  a box in a corner, `panel.add(new Readout({ label, unit }))` a value with `set()`; gauges, bars, badges, a
  minimap, a loading screen, a help overlay and `QualityMenu`. Call `setTheme()` before building widgets that bake
  the accent colour (see the header of `src/ui/index.js`).

## World

### World layer (`src/world`)
`MapWorld` composes a whole city from map data + options + plugins; every system is also usable on its own. It is
built for map-scale cities: `validateMapData` wants a `city.json` with roads and buildings and otherwise falls back to
a procedural city. For a small track or arena, use a `PhysicsWorld({ heightfield })`, your own ground and road
meshes and `PhysicsWorld.setSurfaceProvider` instead.

| Module | Public API (main exports) |
|---|---|
| `MapWorld.js` | `MapWorld` (below), `DEFAULT_WATER_LEVEL`, `DEFAULT_STREAMING` |
| `TileStreamer.js` | `TileStreamer({ budgetMs, maxConcurrent, uploadBytesPerFrame, lookAhead, urgentRadius, altitudeScale })` (`addLayer`, `addTile`, `update(view, dt)`, `prewarm(view, { radius })`, `stats`), see "Streaming" |
| `MapData.js` | `loadMapData(url)`, `validateMapData(data)`, `prepareMapData(data, spawnOpts)` -> `{ offset, bounds, outerBox, spawn }`, `findSpawn(data, bounds, { road, at })`, `generateProceduralCity(seed, { waterfrontName, center })`, `MAP_KEYS`, `assetBase()` |
| `Terrain.js` | `Terrain` (`load(url)`, `setData(json)`, `setOffset`, `heightAt`, `rawHeightAt`, `normalAt`, `attachSurface`), `GroundSurface` (nested lattice; `applyCorridors`, `finalize`, `heightAt`, `normalAt`), `sampleLevel`, `drapePolygon`, `clipConvex`, `latticeSplit` |
| `RoadNetwork.js` | `RoadNetwork({ roads, rail, raster, isWater, surface, deckHolds })` (`prepare`, `build`, `meshes`, `list`, `deckHash`, `segHash`, `corridors`, `heldDecks`), `roadStyle`, `RBIT`, `createRoadMaterial`, `createTactileMaterial`, `SolidBuf`, `samplePolyline`, `quadUp`, `DEFAULT_DECK_HOLD` |
| `Buildings.js` + `FacadeTextures.js` | `BuildingBuilder(region, { groundAt, streetAt, offset, baseGrid, detailGrid, lodDist, detailFloors, maxWindows, style, nearDetail, grid })` (`add(b, rnd, footprint?)`, `footprint(b)`, `build`), `TileBuildingBuilder(region, opts, 'low' \| 'full' \| 'near')` (`meshes(mats)` generator), `NullBuf`, `DEFAULT_BUILDING_STYLE` (`oldProb(xb, zb)`, `victorianProb(xb, zb)`, `namedRe`), `createFacadeMaterials`, `GeoBuf`, `MODE`, `enc`, `tintOf`, `insetRing`, `offsetRing`; `FACADE`, `WIN_RECTS`, `makeFacadeTextures`, `PBR`, `PBR_SETS`, `GROUND_SETS`, `loadPbrTextures` |
| `Props.js` + `Furniture.js` + `Vehicles.js` | `Props({ net, raster, colliders, data, isLand, groundAt, seed, streets, signStyle, treeRules, treeMix })`; furniture library (`makeFurnitureGeometry`, `FURNITURE_META`, `buildSignAtlas(names, style)`, `DEFAULT_SIGN_STYLE`, materials); vehicle library (`makeVehicleGeometry(type, { lod, livery })`, `VEHICLE_SPECS`, `pickVehicleColor`, `createVehicleMaterial`, `DEFAULT_BUS_LIVERY`, `PartBuilder`) |
| `Traffic.js` | presenter: `Traffic({ world, data, net, props, seed, count, camera, busLivery, worker })` (`build`, `ready`, `update`, `queryColliders`, `setPlayer`, `setCamera`, `summary`, `pose(i)`, `mode`, `perf`, `sim`) |
| `TrafficSim.js` + `traffic.worker.js` | simulation core (no scene objects): `TrafficSim({ roads, signals, groundAt \| baked, spawn, seed, count })` (`build`, `update(dt)`, `setView`, `setPlayer`, `readSignals`, `writePoses`, `queryColliders`, `summary`, `bakeError`, `lanes`, `vehicles`), `TrafficSim.roadsFrom(net)`, `buildSignalInfos({ data, net, props })`, `playerInfoFrom(src)`, `TRAFFIC_TYPES`, `POSE_STRIDE`, `typeCounts`; the module worker that runs it |
| `Vegetation.js` (+ `VegModels.js`, `VegTextures.js`, `VegMaterials.js`) | `buildTreeMeshes(placements, { groundAt, colliders, seed, rules, mix })`, `bakeVegImpostors`, `SPECIES`, `makeVegAtlas`, `createVegMaterial`, `createVegImpostorMaterial` |
| `Water.js` / `Shore.js` / `Boats.js` | `Water`, `createWaterMaterial({ ..., refraction })` (0.8.0: `setWaterRefraction`, `setWaterSceneTextures`, `updateWaterRefraction`, `WATER_REFRACTION_DEFAULTS`), `buildShoreField`, Gerstner `waveHeight` / `waveSlope`; `Waterfront({ world, renderer, level, waterMat, pondMat, groundMat, ferryDock, islandFill, boats, farland })`, `createGroundMaterial`, `bakeLandClass`, `buildFarLand(json, world, level, opts)`; `Boats({ ..., ferryDock, ferryRoute, ferries, shipRoute, sailZones, sailCount, bridge })` |
| `geom.js` | `hashStr`, `signedArea`, `pointInRing`, `RingIndex` (exact row-bucketed pointInRing for big rings), `pointInPoly`, `ringBounds`, `centroid`, `sanitizeRing`, `polylineLength` (+ re-exports of `render/noise.js`) |
| `MeshChunker.js`, `ShadowPasses.js`, `NearestLights.js` | tiled static meshes, per-cascade shadow casters, nearest-N real lights (see Conventions) |

```js
const world = new MapWorld({
  scene, renderer,
  data: { mapUrl, terrainUrl, farlandUrl },            // or data.map = a preloaded city.json; farlandUrl: false = none
  timeOfDay: 'golden', atmosphere: { /* render/Atmosphere.js options */ }, waterLevel: -0.6,
  spawn: { road: /^Main Street$/ },                      // or { at: { x, z, heading } } (bake frame)
  roads: { deckHolds: [{ name: /bay bridge/i, top: 58, lowerGap: 9 }] },
  buildings: { style: { oldProb(xb, zb) {}, victorianProb(xb, zb) {}, namedRe } },
  props: { seed, streets: { lampStyle(name) {}, featureLamps: [{ road, style, step }], boulevard, promenade, utilityPoles },
           signStyle: { posters, manholeText, blade } },
  vegetation: { rules: [{ road: /harbor/i, species: 'palm', share: 1, radius: 30 }], mix },
  traffic: { count: 250, seed: 7, busLivery, worker: true } /* or a count, or false; worker: default = module Workers
                                                           available and no ?noworker=1 (Node: in-thread) */,
  streaming: { radius: 900, keep: 250, budgetMs: 3, spawnRadius: 500, pin(building, data) {} } /* DEFAULT_STREAMING;
                                                           false or ?nostream=1 = build everything at load */,
  shore: { ferryDock: { x, z, dir }, islandFill(landPoly) {}, boats: { ferryRoute, shipRoute, sailZones, avoidRoads },
           farland: { natural(bx, bz) {}, urbanMax(bx, bz) {}, clusters, cranes: { region, max, spacing }, blockAngle(bx, bz) {} } },
  chunk: { buildings: 320, structures: 320, ground: 640 }, filler: true, clearZones: [{ x, z, r }],
  plugins: [myBridgePlugin(), myLandmarksPlugin()], physics: false,
});
await world.load((p, label) => {});                      // or engine.addSystem(world.system({ camera }))
world.update(dt, camera.position);                       // per frame, after the camera moved
world.getGroundHeight(x, z, y?); world.queryColliders(x, z, r); world.getSpawn(); world.isLand(x, z);
world.getMinimapData(); world.sunDirection; world.setTimeOfDay('night'); world.stats; world.createPhysics();
world.streamer.stats; world.buildingTiles; world.streamLog;  // streaming: scheduler stats, resident tiles, pop-in log
world.traffic.mode; world.traffic.perf;                   // 'worker' | 'main'; main-thread ms, worker step ms, bytes
```

All game rules default to neutral behaviour (generic cobra lamps, per-class tree mixes, no ferries / ship / cranes,
a blue-striped bus, 0.4 pre-war share); a game passes its own values as options.

**Plugin hooks** (how game-specific structures stay in the game): a plugin is
`{ name, beforeBuildings?(ctx), afterBuildings?(ctx), afterProps?(ctx), clearZones?(), chunk?(world), update?(dt, cameraPos, darkness, world), instance? }`
with `ctx = { world, data, net, colliders, mat, tex, groundAt, renderer, offset }`. A phase hook may return an
Object3D (added to `world.group`); afterwards `world[name] = plugin.instance ?? plugin` (null and skipped from then
on if the hook threw). Phases: `beforeBuildings` (roads exist; claim OSM footprints with `b._lm = key` so the
generic builder skips them), `afterBuildings` (merged buildings exist, their colliders are registered right after;
edit merged geometry here - with streaming only the tiles built at load exist: pin the tiles you edit with
`streaming.pin`, or they come back unedited when they are rebuilt), `afterProps` (street furniture exists, e.g. add deck lamps to `world.props.lampHeads`;
traffic is built next). `clearZones()` -> bake-frame circles kept free of filler lots; `chunk(world)` ->
`[{ mesh, cell }]` tiled in the final MeshChunker pass; `update` runs after the props and before traffic.

**Data contracts** (bake frame = metres around `center`, x east, z SOUTH; MapWorld shifts everything by
`world.offset` so the spawn is the origin):

| File | Shape | Baker |
|---|---|---|
| `city.json` | `{ v, source, center: {lat, lon}, size, outer, bounds: {minX, maxX, minZ, maxZ}, buildings: [{ p: ring, hl?, h, mh?, lv?, t?, r?, rh?, c?, m?, rc?, n? }], roads: [{ p: polyline, c: class, l?, o?, w?, n?, b?, ly?, x?: junction indices, g?: [grounded ends], sv? }], water / land / piers / parks (k) / parking / plazas: [{ p, hl? }], rail: [{ p, k, b?, e? }], trees / signals / lamps: [[x, z]] }` (rings `[[x, z], ...]`, 0.1 m) | `tools/bake-map.mjs` (Overpass) |
| `terrain.json` | `{ origin: [x0, z0], cell, nx, nz, h: Int16 decimetres row-major (z rows, then x), outer?: { origin, cell, nx, nz, h }, center, source, datum, frame }` | `tools/bake-terrain.mjs` (Terrarium) |
| `farland.json` | `{ origin: [x0, z0], cell, nx, nz, h: integer metres (water clamped to sea), sea, center, units, frame }` | `tools/bake-farland.mjs` |
| texture `manifest.json` | `{ source, resolution, sets: { role: { id, name, size: [w, h] m, maps, ktx2?, ktx2Maps?: { Diffuse\|nor_gl\|Rough\|AO: { file, bytes, codec, srgb, width, height, levels, src, srcBytes, psnr, params } } } }, ktx2? }` + `<id>/{diff,nor_gl,rough,ao}.jpg` (+ `.ktx2`) | `tools/fetch-textures.mjs` (+ `compress-textures.mjs`) |

Bakers (`tools/`, see [tools/README.md](tools/README.md)): parameterised Node CLIs (`--lat --lon --size --outer ...`,
`--out`, `--cache`, `--refresh`, `--dry-run`, `--help`, `--config file.json`) whose defaults are the San Francisco
bake of the retired Roadster game (pass `--lat` / `--lon` for a new bake); each also exports an async function with
the same options.

### Streaming (building tiles, `src/world/TileStreamer.js`)
`MapWorld` builds the city's building geometry per tile around the camera instead of all at load (default with a
renderer; `streaming: false` or `?nostream=1` = the full build, kept for A/B and used headless).
- **Global at load** (unchanged): map data, terrain + ground, road network + lane graph, water / far land, props +
  vegetation, landmark / bridge plugins, traffic, and every building's footprint + colliders (`BuildingBuilder.footprint`
  gives exactly what `add()` builds on; the collider boxes are identical to the full build).
- **Tiles.** District tiles = the full build's 7 x 7 base chunks (same buildings, same order, same per-building seeds:
  a built tile is byte-identical to its chunk), filler-ring tiles = 640 m squares. A tile holds the building shells
  plus, per detail cell, a `THREE.LOD` with the far level (flat shells). Each detail cell of a district tile is a child
  tile that adds the near level (real window openings + instanced window units) to its parent's LOD, so near detail
  exists only around the camera. LOD positions / distances are those of the full build, so switching is unchanged.
- **Scheduler** (`TileStreamer`, generic): tiles keyed by (i, j) per layer, each with `build(level)` (a generator that
  yields after every building / geometry, so one tile is spread over several frames), `dispose()`; priority = distance
  to the layer threshold from where the camera will be in `lookAhead` s (direction of travel first); budget `budgetMs`
  per frame, `maxConcurrent` builds, results committed (meshes attached, GPU upload on the next render) within
  `uploadBytesPerFrame`; hysteresis `keep`; tiles closer than `urgentRadius` with nothing built (teleport / reset) are
  built regardless of the budget. Children only build while their parent is built and are freed with it. `stats`:
  `{ tiles, built, pending, building, builds, disposed, cancelled, msThisFrame, maxMsFrame, residentBytes }`.
- **Policy** (`DEFAULT_STREAMING`): district tiles within `radius` 900 m + `heightReach` 2.5 x the tile's tallest
  building (<= 900 m: skylines are seen from far) + `altitudeScale` 6 m per metre of camera height above the ground
  (300 m up = +1.8 km: the whole district) + `openRadius` 1.2 km over open water; filler ring within 3 km (cheap, seen
  across the bay); detail cells within `lodDist` x 1.05 + `detailMargin` 150 m of their LOD point (3D, as THREE.LOD
  measures). Freed beyond those + `keep` / `fillerKeep` / `detailKeep`. Far tiles never build near detail.
- **Load.** Only tiles within `spawnRadius` 500 m of the spawn (plus pinned ones) are built before `load()` resolves;
  the rest streams in during the first seconds of play. Plugin hooks see only those tiles: pin the tiles a plugin
  edits with `streaming.pin`.
- **Scratch buffers** of tile builds are pooled (`TileBuildingBuilder`, up to 4) while tiles stream and handed back to the
  GC after 5 s without streaming work.
- Not streamed, by measurement: street furniture / parked cars (placement registers colliders and is order dependent;
  the batched meshes hold 4.9 MB and are already culled per instance), vegetation (near models are already a
  camera-partitioned instanced subset of 4k trees; 0.6 s of the 0.7 s "Street furniture" phase is the atlas + impostor
  bake, which is global), sidewalks / structures (the bridge plugin edits that merged mesh, and it carries the decks seen
  from km away), the outer context lots (one 0.3 MB instanced mesh).

Measurements: [design notes, "From Streaming"](docs/DESIGN-NOTES.md#from-streaming-the-measurements-enginemd-lines-581-610-at-d959298).

### Traffic simulation (`TrafficSim.js` core, `traffic.worker.js`, `Traffic.js` presenter)
- **Split.** `TrafficSim` = lane graph build + per-step AI, THREE math only (runs in Node: `test/world-build.mjs` runs it headless). `Traffic` = main-thread presenter: instanced meshes (tiered per shadow cascade), headlight
  beams, material uniforms, `queryColliders`, `setPlayer` / `setCamera`, `count`, `typeNames`, `pose(i)`.
- **Ground heights are baked** into the lane graph at build time: every lane and junction connector is sampled every
  1.5 m with `world.getGroundHeight(x, z, yRef)` walked along the lane as a vehicle queried it (bridge lanes follow
  their deck profile, ground lanes ignore decks overhead), then kept at 3 / 6 m spacing where the street is evenly
  graded (161 k floats = 0.65 MB with the real terrain). Vehicles interpolate it at their axles (y = mean, pitch from
  the difference).
- **Worker** (`traffic: { worker }`, default when module Workers exist and no `?noworker=1`; Node: in-thread). The
  main thread builds the same sim (graph + bake + initial spawn: the fallback, and what dev tools read), posts the
  road data + baked heights; the worker rebuilds the identical graph (checked: max initial pose difference 0). Per
  frame ONE message each way: main -> worker `{ dt, camera position + view-projection, player footprint, the
  signal phases the bulbs show (copied from Props.signals[].state, so lights and AI always agree), returned pose
  buffers }` (297 B + the buffer, transferred); worker -> main a transferable `Float32Array` of poses (9 floats x 250
  = 9 kB: x, y, z, yaw, pitch, brake, speed, yaw rate, flags), double-buffered. Respawns / recycling stay in the
  worker. The presenter draws the newest snapshot extrapolated to the current frame (speed + yaw rate; one frame when
  on time, more if a snapshot is late), and `queryColliders` answers from that snapshot with the same oriented AABB
  slices (computed lazily per touched vehicle). The player's hard rule (never into its box, stop 5 m behind) uses
  the pose of the frame the step belongs to, exactly as in-thread. If the worker fails to start / answer within 5 s
  the in-thread sim takes over (logged once). Vite bundles the worker (`new Worker(new URL('./traffic.worker.js',
  import.meta.url), { type: 'module' })`).

## Engineering conventions

- **Shadow casters per cascade.** three.js draws every `castShadow` mesh into every shadow map and tests caster
  layers against the *main* camera, so layers alone cannot pick casters per cascade. Per-pass control goes through
  the object's own `onBeforeShadow` / `onAfterShadow` hooks (`src/world/ShadowPasses.js`), which needs no
  change to the shadow renderer:
  - `shadowCount(instancedMesh, (shadowCamera, n) => count)`: draw only an instance prefix in a pass. Traffic packs
    its instances `[near-cascade casters | rest of the view | off-screen casters whose shadow can reach the view]`
    every frame and draws a different prefix in the main pass and each cascade (membership = sphere vs. that pass's
    frustum via `shadowFrustum`, which reads the light without touching its shadow camera).
  - `shadowDrawRange(mesh, (shadowCamera) => indexCount)` / `skipShadowPasses(mesh, (shadowCamera) => bool)`.
  - **Layer 1 (`NEAR_SHADOW_LAYER`) = "near-shadow-only casters"**: `skipShadowPasses(mesh, isFarCascade)` tags the
    mesh with layer 1 (in addition to layer 0). A render layer that filters casters per cascade natively should skip
    layer-1 objects in every cascade except the near one. (No world mesh uses it at the moment.)
- **Static geometry is merged, then tiled.** World meshes are merged per material while building and split into
  XZ tiles at the end of `MapWorld.load` (`src/world/MeshChunker.js`, `MapWorld._chunkStatic`): sidewalks /
  structures 320 m tiles in the district (x2 in the filler ring, x8 beyond), ground 640 m, plugin meshes via their
  `chunk()` hook (Bay Bridge steel 400 m), the four filler-ring building sectors 640 m (district buildings are
  already built in a 7 x 7 grid of ~315 m chunks). Code that edits merged geometry in place (plugins: bridge,
  landmarks) must run before the tiling step. With streaming (default) buildings are not chunked: they are built per
  tile (district 7 x 7 chunks, 640 m squares in the filler ring) and marked `userData.streamed`.
- **Real point lights: at most 8** (`src/world/NearestLights.js`): forward-lit materials loop over every light
  on every fragment and on Apple GPUs the cost per light climbs steeply past ~8 (16 lamp lights: +4.6 ms at the
  Embarcadero at night). Lights go to lamps whose light sphere reaches the view frustum, nearest to a point ahead of
  the camera; the rest of the city's lamps are emissive only.
- **View-dependent world updates** read the camera from `world.atmo.camera` (the game sets it after load);
  `MapWorld.update(dt, cameraPos)` builds one view frustum per frame and hands it to the systems that cull.
- **Window units** (real openings + instanced window frames) exist only in detail cells within 300 m (8 x 8 cells,
  THREE.LOD with 5 % hysteresis); beyond that the parallax texture windows of the shell take over.
- **API evolution.** New behaviour arrives as an option or spec field whose default reproduces the previous
  behaviour (`test/car-sim.mjs` pins the Roadster spec bit-identically). Options that encode one game's world
  rules (tree canopies on kind-2 trunks, thin kinds 2/3) are opt-in in the base class and switched on by the
  game-facing preset (`ChaseRig`), never baked into lower layers.
- **Per-frame calls take positional args or reuse caller-owned objects** (`Minimap.update(dt, x, z, ...)`,
  `PhysicsWorld.surfaceAt(x, z, out)`, `DecalTrail.feed(..., normal)`); nothing in an update path allocates.
- **Rigs and controllers are inert until told otherwise where a switcher owns them:** camera rigs accept
  `{ active: false }`; `VehicleController.hold = true` freezes a vehicle on the ground (countdowns) and is
  never cleared by `reset()`.
- **Input that must survive a disabled map is declared, not hand-wired:** `alwaysOn: true` on an action (or a
  binding) keeps it live while `InputMap.enabled === false` (debug cameras, time-of-day / mute keys).

## Packaging

This repository is the package `@vibe/engine` (MIT): plain ES modules, `three >= 0.170` the only (peer) dependency,
subpath exports per layer (`@vibe/engine`, `@vibe/engine/<layer>`, `@vibe/engine/tools/*`), each with a `types`
condition pointing at the declarations `npm run types` emits from the JSDoc into `types/` (gitignored; `prepack`
emits them, so `npm pack` ships them). The `files` list in `package.json` says what ships; `npm run pack:check` lists
the tarball and its size. `npm run types:check` compiles `test/types/check.ts`, a strict TypeScript consumer of the
root and every subpath, so a JSDoc gap that would emit a wrong type fails CI. It installs from GitHub
(`npm install three github:BrandeisPatrick/web-engine`); it is not on the npm registry.
