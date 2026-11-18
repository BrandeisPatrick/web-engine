# AGENTS.md: building a game with `@vibe/engine`

`@vibe/engine` is a browser game engine on three.js and WebGL2, written as plain ES modules with JSDoc types. It
gives you a fixed-step loop, physics (a query world, vehicle and character controllers, rigid bodies, cloth),
rendering (sky, shadows, post-processing, clustered lights, GPU particles), animation, input, camera rigs, synth
audio and DOM HUD widgets. You write the game; the engine has no scene editor and no game rules.

## Start a game: copy a starter

| Starter | What it is |
|---|---|
| `samples/starter-walk/` | Third-person walker: animated GLB, controller, camera rig with a landing dip, input, a park corner at dusk (`parkCorner`: path, bench, fence, boulders, trees; `groundCover` grass patches), a lamp, HUD readout, game shell (start card, pause, saved settings), footsteps, a dusk bed and a lamp hum |
| `samples/starter-drive/` | HD hatchback (`createCarVisual`) on `VehicleController(visual.spec)`, steering assist, skid marks and smoke, chase camera with road feel, a country road (`countryRoad`: lay-by, lane lines, verges, fences, poles, trees) with textured asphalt, static posts, car sounds, game shell, speed readout |

In this repository: copy the folder to `samples/<name>/`, run `npm run dev` and open `http://localhost:5190/<name>/`.
No registration is needed (`vite.config.js` finds every `samples/<name>/index.html`); add a link on
`samples/index.html`. Each starter is one `main.js` of under 200 lines; every block says what a game would change.
[docs/HOWTO.md](docs/HOWTO.md) has the same code one task at a time.

## Commands

Two test levels: run **`npm run check` for every change** (about 1.5 minutes on an M4) and **`npm run check:full`
before `npm run deploy` or a release** (about 6.5 minutes). Both need Chrome and the GPU. Each runs its steps in order (listed in
`test/check.mjs`), stops at the first failing step and ends with a table of step, result and seconds.

| Command | What it does |
|---|---|
| `npm ci` | Install (Node 20.19 or newer) |
| `npm run dev` | Dev server at http://localhost:5190 (port is strict: stop it when done) |
| `npm run check` | The quick level: `npm test`, `npm run types:check`, `npm run build`, then in headless Chrome `check-page` on both starters, `sound-check`, `shell` and `howto` |
| `npm run check:full` | The quick level, then `npm run smoke`, `phone-start`, `drive-feel`, `car-camera`, `flicker` and `npm run perf` (exit code 2: perf's noise, run it again) |
| `npm test` | Every Node suite in `test/all.mjs`, no browser (includes the docs and recipe checks); in parallel, one process per CPU but one (`npm test -- --jobs=1` runs them one at a time) |
| `npm run types && npm run types:check` | Emit `types/` from the JSDoc, then compile a strict TypeScript consumer |
| `npm run build` | Build every page into `dist/` |
| `npm run smoke` | Every demo and starter on both quality tiers in headless Chrome (needs Chrome and a GPU) |
| `node test/browser/check-page.mjs <name>` | Load one page headlessly (`?autostart=1`), hold W for 2 s, fail on any console or page error |
| `node test/browser/sound-check.mjs --wav=mix.wav` | Render the sound kit's ten-second self-test scene in headless Chrome, print its measurements and save the mix |
| `node test/browser/flicker.mjs [--out=dir]` | Flicker of nyc-night's bench views standing still (TAA jittering as in play), each held to a budget; `--out` saves heat maps of where it flickers |
| `node test/browser/phone-start.mjs [name]` | Start-up and lost-context paths of every demo and starter (loading screen until a frame is drawn, no long frame after it, the Reload notice, a lighter reload) |

**The start-up.** The first frames compile every shader and upload every texture, seconds on a phone, so they are
drawn and finished under the loading screen (`engine.warmUp()`: dt 0, nothing moves). Without it a phone shows a
black canvas under the HUD until the first frame is done. With a `GameShell` (the starters) end `boot()` with
`await shell.ready()` and do not call `engine.start()` yourself: it warms up under the shell's loading bar, starts the
loop, then shows the start card over a drawn frame. Without a shell, end `boot()` with
`loading.setLabel('Compiling shaders…'); await engine.warmUp(); engine.start(); loading.hide();` (a `LoadingScreen`
from ui, created first). docs/HOWTO.md "Start without a stall". If the device later drops the WebGL context, the
engine stops, shows a message with a Reload button (over the shell's cards) and the next `resolveQuality()` in that
tab comes up lighter; do not try to restore the context.

**The page contract.** The browser scripts wait for `window.__sample.ready`; a page without it fails after the timeout.
End `boot()` with `window.__sample = createBenchHarness(engine, { name: '<name>' }).setReady();` (core), as the
starters do. The harness is `test/browser/playwright.config.mjs` (`startVite`, `launchChrome`, `loadSample`,
`watchErrors`); it starts and stops its own dev server. Fields added with `Object.assign` are copied once, by value:
expose state that changes through a function (`{ game: () => ({ mode, score }) }`).

## Conventions that cause silent mistakes

- **Units and axes.** Metres, seconds, radians, Y up. Heading / yaw 0 faces **-Z**; positive turns left, as
  `Object3D.rotation.y`. Cars, rigs and the character's `facing` all use it.
- **Models face +Z.** The GLBs in `samples/public/` face +Z: rotate the model by `Math.PI` inside a parent group. The
  engine's own procedural vehicles and furniture already face -Z (no flip; origin and size per asset in docs/ASSETS.md).
- **Fixed step.** `fixedUpdate(dt)` runs at 120 Hz (`fixedHz`), `update(dt, alpha)` once per frame. Simulate in
  `fixedUpdate`; draw simulated bodies with `PoseInterpolator` (core): `save()` before the step, `apply(obj, alpha)`
  in `update`, `snap()` after a teleport. Without it motion judders.
- **Quality tiers are data.** `resolveQuality().settings` has groups (`engine`, `shadows`, `postfx`, `passes`,
  `lights`, `world`, `textures`, `effects`). Nothing applies them for you: spread `engine` into `Engine`, `shadows`
  into `Atmosphere`, `postfx` into `PostFX`, and set `postfx.aoPass.enabled` / `postfx.bloomPass.enabled` from
  `passes` yourself. Add your own groups freely.
- **Everything in PostFX is off by default**, and PostFX keeps its first size unless you set
  `engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr)`.
- **Asset URLs** go through `import.meta.env.BASE_URL`, so a page works under a sub-path.

## API by task

| I want to... | Import (from `@vibe/engine/...`) | The call | Working example |
|---|---|---|---|
| Run a loop | `Engine` (core) | `new Engine({ container, physics })`, `engine.addSystem({ fixedUpdate, update, lateUpdate })`, `await engine.warmUp()`, `engine.start()` | starters |
| Sky, sun, shadows | `Atmosphere` (render) | `new Atmosphere({ scene, renderer, camera, timeOfDay: 'dusk', shadows })`; per frame `atmosphere.update(camera.position, dt)` | starters |
| Post-processing | `PostFX` (render) | `new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio, ...S.postfx })`; `engine.renderFn = (sc, cam, dt) => postfx.render(dt)` | HOWTO "Engine and quality tiers" |
| Walk a character | `CharacterController` (physics), `CharacterInput` (input), `ThirdPersonRig` (camera) | `cc.step(dt, moveX, moveZ, jump, sprint, physics)` | `samples/starter-walk/main.js` |
| Load a GLB, play clips | `Assets` (core), `registerRenderLoaders` (render), `AnimationController` (anim) | `assets.get(key).instantiate()`; states name clips by exact string | `samples/starter-walk/main.js` |
| Drive a car | `VehicleController` (physics), `createCarVisual` (world), `VehicleInput` (input), `ChaseRig` (camera) | `const visual = createCarVisual('hatchback'); car = new VehicleController(visual.spec); car.step(dt, { throttle, brake, steer, handbrake }, physics); visual.update(dt, car, { darkness })` | `samples/starter-drive/main.js` |
| Keyboard steering that holds the grip limit and catches slides | `VehicleInput`, `SteeringAssist` (input) | `new VehicleInput(el, { assist: true })`; per frame `input.update(dt, car)`; `input.assist.enabled` toggles it | `samples/starter-drive/main.js` |
| Skid marks and tyre smoke | `TyreFx` (render) | `new TyreFx({ scene, atmosphere })`; per frame `tyres.update(dt, car, body)`; `tyres.clear()` on reset | `samples/starter-drive/main.js` |
| A car body with wheels and lamps | `createCarVisual` (world) | `createCarVisual(type, { color })` -> `{ root, spec, update(dt, car, { darkness }) }` | `samples/starter-drive/main.js` |
| A camera that reacts | `ChaseRig`, `ThirdPersonRig` (camera) | `new ChaseRig(cam, el, { feel: 'road' })` + `state.accel = car.localAccel`; `rig.addTrauma(x)` on a hit; `ThirdPersonRig({ landingDip: 1 })` + `rig.land(speed)` | starters |
| Drive and walk on one page | `VehicleInput`, `CharacterInput` (input), `ChaseRig`, `ThirdPersonRig` (camera) | `input.enabled = false`, `rig.activate()`: HOWTO "Get in and out of a vehicle" | `test/howto/recipes.js` |
| Headlights | `THREE.SpotLight`, or `ClusteredLights` (render) | `cl.setSpot(...)` per frame: HOWTO "Headlights" | `test/howto/recipes.js` |
| Smooth motion | `PoseInterpolator` (core) | `save()` / `apply(obj, alpha)` / `snap()` | HOWTO "Smooth rendering" |
| A few lamps | `NearestLights` (render) | `setPositions([[x, y, z], ...])`; per frame `update(dt, { position }, intensity)` | `samples/starter-walk/main.js` |
| Many lamps | `ClusteredLights`, `installClusteredChunks`, `syncClustered` (render) | five calls: HOWTO "Clustered lights" | `test/howto/recipes.js` |
| Texture a mesh | `loadTextureSet`, `loadTextureManifest` (render) | `loadTextureSet(id, { renderer, base, manifest })` -> `{ map, normalMap, roughnessMap, size }` | `samples/starter-walk/main.js` |
| HUD text | `UILayer`, `Panel`, `Readout` (ui) | `panel.add(new Readout({ label, unit })).set(value)` | starters |
| Loading, start screen, pause, saved settings | `GameShell` (ui) | `new GameShell({ title, controls, quality, storageKey })`, `shell.use({ engine, audio, inputs })`, `await shell.ready()` | starters |
| A sound | `AudioBus`, `SoundBank` (audio) | `new AudioBus({ master: 'safe' })` started by `GameShell`'s start click (or `bus.unlockOnGesture()`); `new SoundBank(bus, { listener: camera }).play('impact.wood', { at })`; hear and check them on `samples/sound-check/` | `samples/starter-walk/main.js` |
| Footsteps, ambience | `Footsteps`, `SoundBank` (audio) | `steps.update(dt, { speed, grounded, landed, landingSpeed })`; `sfx.loop('amb.dusk', { gain: 0.14 })` | `samples/starter-walk/main.js` |
| Car sounds | `VehicleAudio`, `SoundBank` (audio) | `motor.update(dt, { speedKmh, rpmLike, grounded })`; loops `road.roar`, `wind.rush`, `tyre.squeal` with `setGain` | `samples/starter-drive/main.js` |
| Particles | `GpuParticleSystem` (render) | `dust.emit(params)`; per frame `dust.update(dt, camera)` | `test/howto/recipes.js` |
| Walls and crates | `PhysicsWorld`, `DynamicsWorld`, `attachToPhysicsWorld`, `boxShape` (physics) | `physics.addStaticBox({ center, size })`; `dyn.addBody({ shape, position, mass })` | `test/howto/recipes.js` |
| Hills, a small track | `PhysicsWorld` (physics) | `new PhysicsWorld({ heightfield: (x, z) => y })`, `setSurfaceProvider(fn)` | `test/howto/recipes.js` |
| Desktop / phone tiers | `resolveQuality` (core), `GameShell` / `QualityMenu` (ui) | `const S = resolveQuality().settings`; `new GameShell({ quality })` puts the tiers in the pause card (or `new QualityMenu({ quality })` without a shell) | starters |
| Weathered walls and props | `applyPatches`, `weathering` (render) | `applyPatches(mat, [weathering({ grime: 0.4, streaks: 0.35 })])`; props: `weathering({ ground: 'origin' })` | HOWTO "Weathered walls and props", `samples/starter-drive/main.js` |
| Lit clouds and a key light after sunset | `Atmosphere` (render) | `new Atmosphere({ ..., cloudStyle: 'lit', lowSunEnv: true, twilightKey: true })` | `samples/miami-drive/world.js` |
| Leaves lit like leaves (wrap, light through, rim) | `applyFoliageLightingTo`, `buildTreeMeshes` (world) | `applyFoliageLightingTo(group, true)` or `buildTreeMeshes(p, { foliageLight: true })` | `samples/nyc-night/main.js` |
| Facade windows with dim rooms, shades and panes that differ | `createFacadeMaterials`, `enableFacadeDetail` (world) | `enableFacadeDetail(createFacadeMaterials(...), { dimRooms: 0.22 })` | `samples/nyc-night/facades.js` |
| AO only on the ambient, a lifted black, TAA sharpen | `PostFX` (render) | `new PostFX(..., { look: { aoLit: 0.8, aoTint: [0, 0.03, 0.07], lift: [0.002, 0.003, 0.004] }, taa: { sharpen: 0.25 } })` | `samples/nyc-night/main.js` |
| Lamp light in round pools on the ground, the pole left dark | `NearestLights` (render) | `new NearestLights({ mode: 'clustered', clustered, spot: { cosInner: 0.82, cosOuter: 0.12, near: 5 } })`; `near` (m) shields the first metres below the head; a spot's decay must stay below 8 for it (`ClusteredLights.setSpot(..., near)`) | `samples/nyc-night/main.js` |
| A small place to start in: a road or a park corner | `countryRoad`, `parkCorner`, `groundCover` (world) | `const place = countryRoad({ physics }); scene.add(place.group)`; per frame `place.update(dt, camera.position, darkness)`; `applyPatches(ground.material, [groundCover({ paths: place.paths })])` | starters |
| See a demo's earlier low-key grade | the demos' own flag | open `nyc-night/` or `miami-drive/` with `?look=low` (the default is the brighter two-temperature open look, the one the smoke look gate checks) | `samples/nyc-night/main.js` (`LOOK`) |
| A whole city | `MapWorld` (world) | only for map-scale cities from baked OpenStreetMap data | `samples/nyc-night/main.js` |

Everything else, layer by layer: [ENGINE.md](ENGINE.md). Every source file starts with a header documenting its API.

## Known traps

- `new VehicleController()` with no spec is the **Roadster**: 2 t, about 1 MW, flies on `thrust`. A partial spec
  inherits every field you leave out from it. Start from `ROAD_CAR_SPEC` and spread it to tune.
- Fitting a skinned GLB to a height with `new THREE.Box3().setFromObject(model)` gives wrong bounds unless
  `model.updateMatrixWorld(true)` runs first.
- Animation clip names are the GLB's exact names (`HumanArmature|Man_Walk`, not `Walk`). A wrong name throws and lists
  the real ones.
- Lamp intensity is three.js `PointLight` intensity: 8 to 12 for a garden lamp (reach 12 m, decay 1.5; 12 over dark
  gravel and earth, as starter-walk), up to 260 for a city street lamp (reach 48 m, decay 2). At 1 the lamp is invisible
  and nothing warns you. The lamp's glass needs `emissiveIntensity` about 8 to glow through the dusk bloom.
- Clustered lights need five calls in three places (HOWTO "Clustered lights"); skip one and lamps silently do not
  light. `lights: { clustered: true }` is a `MapWorld` option only.
- `loadTextureSet` needs `base`: the default folder does not exist in this repository. The sets live in
  `samples/public/nyc/textures/` and `samples/public/miami/textures/`.
- Tier `passes` (AO, bloom) are applied by the game, not by `PostFX`.
- `addStaticBox` positional order is `minX, minY, maxX, maxY, minZ, maxZ`; prefer `{ center, size }`. Shape builders
  (`boxShape`) take half extents.
- Audio needs a user gesture: `bus.bus(name)` is null and nothing plays until `bus.start()` runs inside a click or a
  key press. `GameShell` does it on its start click (pass `audio: bus`); without a shell call `bus.unlockOnGesture()`.
  Before that `SoundBank.play` returns an inert voice (never null) and `SoundBank.loop` waits and starts with the bus.
  Mix quietly: the kit's beds sit near -30 dBFS, so start loops at the gains the starters use, not at 1.
- Sound names are exact (`step.gravel`, not `gravel`); an unknown name throws and lists the 18.
- Behind the `GameShell` start card the inputs are off: a script that presses keys must load the page with
  `?autostart=1`.
- `VehicleInput.update(dt)` without the car never runs the assist, even with `{ assist: true }`: pass the car,
  `input.update(dt, car)`.
- `createCarVisual`'s spec is the body's: build the controller from `visual.spec` (or spread it), not from
  `ROAD_CAR_SPEC`, or the wheels float off their arches. Place `visual.root` on the car's pose before
  `visual.update`. Only `VEHICLE_HD_TYPES` have separate wheels (a bus / box truck throws).
- The world layer (`MapWorld`) wants a baked `city.json`; given little data it builds a procedural city instead.

## Assets

[docs/ASSETS.md](docs/ASSETS.md) lists every asset in the repository: the downloaded textures, models and environments,
and the vehicles, buildings, props, plants, characters, skies and sounds made in code. Each entry says where it is,
whether it is part of the engine package or lives in a demo, its licence, and a snippet that loads or creates it (every
snippet was run to render its thumbnail). The same list is data in `samples/public/catalog/catalog.json`, and a
browsable page with 3D previews at `samples/assets/` (`npm run dev`, then `/assets/`). Look there before making or
downloading something. After adding an asset, add it to `tools/asset-registry.mjs` if no texture manifest describes it,
then run `npm run catalog`; `test/asset-catalog.mjs` fails until the catalogue covers every file in `samples/public/`.

Use only what is in `samples/public/`. Each demo folder lists every file, author and licence in its `CREDITS.md`
(`samples/public/nyc/CREDITS.md`, `samples/public/miami/CREDITS.md`).

## Using the engine from another project

`npm install three github:BrandeisPatrick/web-engine` (it is not on the npm registry). The package ships `src/`,
`types/`, `tools/`, this file, `ENGINE.md`, `docs/HOWTO.md`, `docs/ASSETS.md` and the two starter folders under
`node_modules/@vibe/engine/`. It does not ship `samples/public/`, so the starters' model and texture files are not
there:

1. Copy `node_modules/@vibe/engine/samples/starter-walk/` (or `starter-drive/`) into your project; its imports
   (`@vibe/engine/core`, `three`, ...) resolve from `node_modules`. Serve it with Vite or any bundler that handles
   `import.meta.env.BASE_URL`.
2. Copy the asset files it loads from the engine repository's `samples/public/` into your public folder at the same
   paths (`nyc/models/ManInSuit.glb`, `nyc/textures/manifest.json` and the set folders it uses), or change the
   paths. Keep each file's licence and credit from the `CREDITS.md` next to it.
3. Remove or replace the page contract line if you do not use the repo's browser tests.

## What nobody has verified

- Touch controls (`touch: 'auto'`) are wired in both starters but have not been tested on a touch device.
- Audio is measured, not listened to: every preset's peak, DC, loop seam and spectral band, and a ten-second mix
  (`samples/sound-check/`: no clipping, peak <= 0.85, no silent or over-loud half-second) are checked by machine, and
  the starters' sound was measured flowing in headless Chrome. No person has listened to any of it.
- The steering assist, the chase camera's road feel and the gamepad rumble were checked by scripted drives and numbers;
  nobody has driven them by hand.
- Neither starter has been run on a real phone; the mobile tier was checked only through `?quality=mobile`.
- No page has been run on a real phone since the start-up warm-up and the lost-context notice were added: both were
  checked in headless Chrome and in Playwright's WebKit with an iPhone profile on a Mac, whose GPU is far faster.
- The "using from another project" steps above were checked against what `npm pack` ships, not by installing into a
  fresh project.
