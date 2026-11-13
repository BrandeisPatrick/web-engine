# AGENTS.md: building a game with `@vibe/engine`

`@vibe/engine` is a browser game engine on three.js and WebGL2, written as plain ES modules with JSDoc types. It
gives you a fixed-step loop, physics (a query world, vehicle and character controllers, rigid bodies, cloth),
rendering (sky, shadows, post-processing, clustered lights, GPU particles), animation, input, camera rigs, synth
audio and DOM HUD widgets. You write the game; the engine has no scene editor and no game rules.

## Start a game: copy a starter

| Starter | What it is |
|---|---|
| `samples/starter-walk/` | Third-person walker: animated GLB, controller, camera rig, input, textured ground, a lamp, HUD readout, sound |
| `samples/starter-drive/` | Box car on `VehicleController(ROAD_CAR_SPEC)`, chase camera, textured road, static posts, speed readout |

In this repository: copy the folder to `samples/<name>/`, run `npm run dev` and open `http://localhost:5190/<name>/`.
No registration is needed (`vite.config.js` finds every `samples/<name>/index.html`); add a link on
`samples/index.html`. Each starter is one `main.js` of under 200 lines; every block says what a game would change.
[docs/HOWTO.md](docs/HOWTO.md) has the same code one task at a time.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install (Node 20.19 or newer) |
| `npm run dev` | Dev server at http://localhost:5190 (port is strict: stop it when done) |
| `npm test` | Every Node suite in `test/all.mjs`, no browser (includes the docs and recipe checks) |
| `npm run types && npm run types:check` | Emit `types/` from the JSDoc, then compile a strict TypeScript consumer |
| `npm run build` | Build every page into `dist/` |
| `npm run smoke` | Every demo and starter on both quality tiers in headless Chrome (needs Chrome and a GPU) |
| `node test/browser/check-page.mjs <name>` | Load one page headlessly, hold W for 2 s, fail on any console or page error |

**The page contract.** The browser scripts wait for `window.__sample.ready`; a page without it fails after the timeout.
End `boot()` with `window.__sample = createBenchHarness(engine, { name: '<name>' }).setReady();` (core), as the
starters do. The harness is `test/browser/playwright.config.mjs` (`startVite`, `launchChrome`, `loadSample`,
`watchErrors`); it starts and stops its own dev server.

## Conventions that cause silent mistakes

- **Units and axes.** Metres, seconds, radians, Y up. Heading / yaw 0 faces **-Z**; positive turns left, as
  `Object3D.rotation.y`. Cars, rigs and the character's `facing` all use it.
- **Models face +Z.** The GLBs in `samples/public/` face +Z: rotate the model by `Math.PI` inside a parent group.
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
| Run a loop | `Engine` (core) | `new Engine({ container, physics })`, `engine.addSystem({ fixedUpdate, update, lateUpdate })`, `engine.start()` | starters |
| Sky, sun, shadows | `Atmosphere` (render) | `new Atmosphere({ scene, renderer, camera, timeOfDay: 'dusk', shadows })`; per frame `atmosphere.update(camera.position, dt)` | starters |
| Post-processing | `PostFX` (render) | `new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio, ...S.postfx })`; `engine.renderFn = (sc, cam, dt) => postfx.render(dt)` | HOWTO "Engine and quality tiers" |
| Walk a character | `CharacterController` (physics), `CharacterInput` (input), `ThirdPersonRig` (camera) | `cc.step(dt, moveX, moveZ, jump, sprint, physics)` | `samples/starter-walk/main.js` |
| Load a GLB, play clips | `Assets` (core), `registerRenderLoaders` (render), `AnimationController` (anim) | `assets.get(key).instantiate()`; states name clips by exact string | `samples/starter-walk/main.js` |
| Drive a car | `VehicleController`, `ROAD_CAR_SPEC` (physics), `VehicleInput` (input), `ChaseRig` (camera) | `car.step(dt, { throttle, brake, steer, handbrake }, physics)` | `samples/starter-drive/main.js` |
| Smooth motion | `PoseInterpolator` (core) | `save()` / `apply(obj, alpha)` / `snap()` | HOWTO "Smooth rendering" |
| A few lamps | `NearestLights` (render) | `setPositions([[x, y, z], ...])`; per frame `update(dt, { position }, intensity)` | `samples/starter-walk/main.js` |
| Many lamps | `ClusteredLights`, `installClusteredChunks`, `syncClustered` (render) | five calls: HOWTO "Clustered lights" | `test/howto/recipes.js` |
| Texture a mesh | `loadTextureSet`, `loadTextureManifest` (render) | `loadTextureSet(id, { renderer, base, manifest })` -> `{ map, normalMap, roughnessMap, size }` | `samples/starter-walk/main.js` |
| HUD text | `UILayer`, `Panel`, `Readout` (ui) | `panel.add(new Readout({ label, unit })).set(value)` | starters |
| A sound | `AudioBus`, `playTone` (audio) | `bus.unlockOnGesture()`; `playTone(bus.ctx, bus.bus('ui'), { pitch, peak, decay })` | `samples/starter-walk/main.js` |
| Car engine sound | `VehicleAudio` (audio) | `audio.start()` in a gesture; per frame `audio.update(dt, { speedKmh, rpmLike, grounded, ... })` | `test/howto/recipes.js` |
| Particles | `GpuParticleSystem` (render) | `dust.emit(params)`; per frame `dust.update(dt, camera)` | `test/howto/recipes.js` |
| Walls and crates | `PhysicsWorld`, `DynamicsWorld`, `attachToPhysicsWorld`, `boxShape` (physics) | `physics.addStaticBox({ center, size })`; `dyn.addBody({ shape, position, mass })` | `test/howto/recipes.js` |
| Hills, a small track | `PhysicsWorld` (physics) | `new PhysicsWorld({ heightfield: (x, z) => y })`, `setSurfaceProvider(fn)` | `test/howto/recipes.js` |
| Desktop / phone tiers | `resolveQuality` (core), `QualityMenu` (ui) | `const S = resolveQuality().settings`; `new QualityMenu({ quality })` | starters |
| A whole city | `MapWorld` (world) | only for map-scale cities from baked OpenStreetMap data | `samples/nyc-night/main.js` |

Everything else, layer by layer: [ENGINE.md](ENGINE.md). Every source file starts with a header documenting its API.

## Known traps

- `new VehicleController()` with no spec is the **Roadster**: 2 t, about 1 MW, flies on `thrust`. A partial spec
  inherits every field you leave out from it. Start from `ROAD_CAR_SPEC` and spread it to tune.
- Fitting a skinned GLB to a height with `new THREE.Box3().setFromObject(model)` gives wrong bounds unless
  `model.updateMatrixWorld(true)` runs first.
- Animation clip names are the GLB's exact names (`HumanArmature|Man_Walk`, not `Walk`). A wrong name throws and lists
  the real ones.
- Lamp intensity is three.js `PointLight` intensity: about 8 for a garden lamp (reach 12 m, decay 1.5), up to 260 for
  a city street lamp (reach 48 m, decay 2). At 1 the lamp is invisible and nothing warns you.
- Clustered lights need five calls in three places (HOWTO "Clustered lights"); skip one and lamps silently do not
  light. `lights: { clustered: true }` is a `MapWorld` option only.
- `loadTextureSet` needs `base`: the default folder does not exist in this repository. The sets live in
  `samples/public/nyc/textures/` and `samples/public/miami/textures/`.
- Tier `passes` (AO, bloom) are applied by the game, not by `PostFX`.
- `addStaticBox` positional order is `minX, minY, maxX, maxY, minZ, maxZ`; prefer `{ center, size }`. Shape builders
  (`boxShape`) take half extents.
- Audio needs a user gesture: `bus.bus(name)` is null and nothing plays until then.
- The world layer (`MapWorld`) wants a baked `city.json`; given little data it builds a procedural city instead.

## Assets

<!-- assets-link -->
Use only what is in `samples/public/`. Each demo folder lists every file, author and licence in its `CREDITS.md`
(`samples/public/nyc/CREDITS.md`, `samples/public/miami/CREDITS.md`, `samples/public/halloween/CREDITS.md`).

## Using the engine from another project

`npm install three github:BrandeisPatrick/web-engine` (it is not on the npm registry). The package ships `src/`,
`types/`, `tools/`, this file, `ENGINE.md`, `docs/HOWTO.md` and the two starter folders under
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
- Audio output: the sounds start without errors in headless Chrome, but no one has listened to them.
- Neither starter has been run on a real phone; the mobile tier was checked only through `?quality=mobile`.
- The "using from another project" steps above were checked against what `npm pack` ships, not by installing into a
  fresh project.
