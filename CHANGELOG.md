# Changelog

## Unreleased
- PostFX `renderScale` (option, `set('renderScale', s)` / `get`, s in [0.5, 1], default 1 = unchanged: no new define,
  every shader text pinned to the previous one): temporal upscaling, in effect only under TAA (else 1, the request
  kept). The scene / G-buffer target, exposure, AO, SSR, volumetrics and the camera jitter run at the drawing buffer
  x s (`internalWidth` / `internalHeight`, `renderScaleInEffect`, `onInternalResize(w, h)` for the clustered-light
  tile mapping and the scene copy); the TAA resolve upscales (define `TAA_UPSCALE`: each output pixel windows the
  internal 3x3 by the distance from where each texel sampled the scene this frame, the history at output resolution,
  the variance clip from the internal neighbourhood, and a per-frame weight that grows when the nearest sample lands
  on the pixel centre, so detail above the internal resolution accumulates from the jitter; `TAAPass.setUpscale`,
  `upscaleWindow`, `upscaleProximity`, `taaUpscaleMeanWeight`); the final pass, motion blur and DoF map their depth /
  G-buffer reads to the internal texel (`FINAL_UPSCALE`, `MB_UPSCALE`, `DOF_UPSCALE`). Resizes, TAA off / on, live
  scale changes and G-buffer rebuilds restart the history. Measured on the city demos' desktop poses at 2268x1473
  (converged captures against scale 1, alternating in-page A/B): s 0.87 saves 1.0-1.4 ms a frame, 0.8 1.6-2.3,
  0.75 1.9-2.9 (miami beach about half) at 96-99 % of the sharpness (a bilinear upscale of a native 0.75 frame:
  50-60 %), but nyc-night's square and sidewalk exceed the perf image guard at every scale (0.38 / 0.53 mean at
  0.87, mostly wet-road sparkle, the LED billboard and foliage shaded at the lower resolution) and the per-pixel
  flicker at rest is 8-64 % above scale 1 on every pose; a TAA blend of 0.96 under upscaling brings miami-drive to
  about scale 1's flicker but not its car pose's sharpness. So the demos stay at scale 1. nyc-night and miami-drive
  now size the world's clustered lights / scene copy from PostFX's internal size (identical at scale 1).
- Bench harness: `converged(frames = 48, scale, into)` captures a pose as TAA converges at rest (the sample's new
  `converge: { begin, end }` hook: TAA jittered and accumulating from a reset history, everything else as `quiet()`
  holds it), then returns to the held state; repeated converged captures hash equal and leave held captures as they
  were (the smoke test checks both on every pose). The three demos pass the hook.
- SSR `interval` (SSRPass option and `postfx.set('ssr.interval', n)`, integer 1..4, default 1 = unchanged): trace and
  denoise every n-th frame and reuse the buffer in between; the TAA composite (new define `TAA_SSR_REUSE`) reads the
  reused buffer where each pixel's surface was when it was traced (G-buffer velocity x frames since, plus the jitter
  change). A trace is forced after a history reset / pose / cut, a skipped frame, a resize, `reset()` (PostFX calls it
  when TAA's history restarts, so held bench captures are this frame's own trace) and any option change; without TAA
  the interval is 1 in effect (the request is kept). `ssrPass.age` / `tracedJitter`, `taaPass.resetPending` are new.
  nyc-night and miami-drive use interval 2 on the desktop tier: 0.3-0.5 ms a frame saved on nyc-night, 0.25-0.4 ms on
  miami-drive (in-page A/B), static captures unchanged; in motion the reused frames lag one frame where reflected
  content moves differently from its surface (wet-street highlights walking forward), and SSR's cost now falls on
  every other frame.
- Surface shaders skip work whose weight is zero (the picture is unchanged): the sidewalk / kerb material
  (`MapWorld`) reads its cast-concrete scan only where a face is not flat (`textureGrad`, gradients taken outside the
  branch); nyc-night's facade lamp wash skips each lamp beyond its fall-off reach, and its street surface runs the
  long-crack, oil-blot and paint-chip noises only where their zone or the paint is non-zero.
- nyc-night: the facade lamp wash takes the 4 nearest lamp heads, not 12 (8 on mobile): the loop costs every wall
  pixel whether a lamp reaches it or not, and the lamps stand 60 m and more apart with a 17 m pool, so the 5th
  nearest is a pool of a few pixels over 100 m away.
- Bench harness (`createBenchHarness`, `src/core/Bench.js`): an optional `live: { dt, begin, frame, end }` hook group.
  With it, `bench()` (and so `run()`, `report()` and `npm run perf`) measures frames as played: `begin()` undoes what
  `quiet()` holds (TAA and volumetric jitter and history, eye adaptation), each warm-up and timed frame is
  `frame(dt)` (the play loop's render-side work: atmosphere and shadow-cascade schedules, clustered light lists, GPU
  steam, the car probe; no gameplay, physics, traffic or streaming) and then the render, warm-up is at least 12
  frames (whole 12-frame cycles until 150 ms ran, while the GPU clocks up), and `end()` (puts back exactly what the
  frames moved), `quiet()` and warm frames (as many renders in all as a held bench, modulo 12: renderFn's shadow-map
  cadences end in the same phase) return the harness to the capture state: captures after a bench hash equal to
  captures before it, and `info()` counts the same passes. The three demos pass one. Measured ms rise (a held frame
  resolved TAA from a fresh history and skipped the far cascade, light uploads, particles and the probe); the
  pictures do not change. Without `live`, `bench()` is unchanged.
- nyc-night: in play the moon's near shadow map is tied to the frames between the far map's (it was a counter of its
  own that happened to alternate with it; with both maps on the same frames the bench read about 0.7 ms more).
- `TextureSets.options.maxAnisotropy` caps the texture arrays and `loadTextureSet` maps (unset = the GPU maximum, as
  before); the two city demos pass the desktop tier's `textures.anisotropy` (8): 16x on grazing streets costs GPU time.
- Atmosphere `shadows: { skipUnlit: true }` (on in both quality tiers; Halloween passes the tier's): the directional
  light loop skips RE_Direct where the light is black at the pixel (cascade lights, full shadow), which adds exactly 0
  there; `installSkipUnlitChunk` (`render/shadowSkipUnlit.js`), `test/skip-unlit.mjs`. Off, the shaders are unchanged.
- `world/Shore.js` reads its texture sets from the shared texture root (`textureBase()`, so `TextureSets.options.base`
  applies) and no longer requests a set the root's `manifest.json` does not list: a game that ships its own sets gets
  no 404 per map (the two city demos logged eight each), and the procedural stand-in is used at once. Without a
  manifest the maps are tried as before. `sharedTextureManifest(base)` (one request per root per page, used by
  `loadPbrTextures` and the shore) and `manifestListsSet(manifest, id)` are exported from `@vibe/engine/render`;
  `test/texture-manifest.mjs`. The rendered frames are unchanged (pixel differences at load-to-load noise).
- `samples/index.html` declares an empty icon (no favicon 404).
- `test/vehicles-hd.mjs`: the build-time check is a blow-up guard (1500 ms), not a machine-speed limit.
- `samples/nyc-night`: the desktop tier caps the pixel ratio at 1.5 (2268x1473 on a 14-inch MacBook Pro), as
  `samples/miami-drive` already did; `bench/budgets.json` measures the two city demos' desktop views at that size
  (10.7-11.6 ms and 6.3-11.5 ms against the 12 ms budget; native 3024x1964 was 16.5-18.1 and 10.0-16.9).
- `SSRPass` denoise: where the centre and all eight taps of the reflection buffer are 0 the blur writes 0 without
  reading the full-resolution depth and normal (fewer reads, the same output).

## 1.1.0-beta.1 — 2026-11-12 — NYC and Miami demos, quality tiers, asset detail
A pre-release from the `feat/nyc-miami-demos` branch. Before / after captures: `docs/BEFORE-AFTER.md`. Known open
point: the two city demos' desktop tier misses its 12 ms frame budget at 3024x1964 (15-19 ms on an Apple M4); the
mobile tier, memory and download sizes are inside every budget (`npm run perf`). This release also carries the
"Halloween 2026" section below, which had not been released.
- High-detail vehicles (`src/world/Vehicles.js`): `makeVehicleGeometry(type, { lod: 'hd' | 'mid' })` for the eight car
  types. `'hd'` (36-40 k triangles): the same profiles as LOD 0 resampled into a smooth body with deliberate hard
  edges and shut lines, recessed head and tail lamp units with ribbed cells, a grille, mirrors, handles, wipers,
  blended glass over a modelled interior, tyres with tread and three rim designs over discs and calipers, a floor pan
  and exhaust. `'mid'` (8-9 k): the same body at fewer stations, opaque glass, no interior. One shared, indexed,
  packed geometry per type and level (about 1.5 MB / 0.4 MB), built on first use. `makeVehicleParts(type, { lod })`
  returns body, glass, interior, the four wheels and calipers and their pivots for a drivable car;
  `createVehicleMaterial({ hd, glass, envIntensity })`; `getVehicleAtlas()` (plates, tyre lettering, tread, paint
  flake, lens patterns, generated once). LOD 0 and LOD 1 are byte-identical (pinned in `test/vehicles-hd.mjs`).
- `Traffic` / `MapWorld({ traffic })`: opt-in `hd: { count, radius, midCount, midRadius, parked, shadowProxy }` draws
  the nearest moving and parked cars at the high-detail level and a second ring at the mid level, with hysteresis,
  G-buffer velocity for TAA and low-poly shadow proxies; `traffic.refreshHD(position)`, `prepareHD()`, `hdStats()`.
  Also opt-in: `mix` (fleet share per vehicle type) and `area` (recycle / spawn radii, for denser streets from the
  same fleet).
- `src/render/Memory.js` (`releaseStaticGeometry`, `releaseTextureData`, `createMemoryTrim`) and
  `world.trimMemory(renderer)`: opt-in, one-way release of CPU copies after upload (static vertex arrays, the
  per-vertex arrays of instanced shapes, data and compressed texture pixels, the road network's build buffers).
  Tested in `test/memory.mjs`.
- `Buildings.js`: `buildingStyle(...)` (the style a building resolves to, for code that dresses the engine's facades),
  `style.storeProb` and `style.storeDressing: false`; all default to the previous output.
- `TextureSets.options.base` and `options.manifestIds` (a sample's own texture folder, and its own scan per role).
- KTX2 texture compression runs in this repository: `ktx2-encoder`, `jpeg-js` and `ktx-parse` are devDependencies
  (`tools/compress-textures.mjs`); the Miami demo ships compressed sets beside the JPG fallbacks.
- Night NYC walk (`samples/nyc-night`): Midtown baked from OpenStreetMap at late dusk (`?t=night` for full night);
  a damp street surface with scanned asphalt, cracks, seams, patches, worn paint, granite kerbs, manholes, plates and
  tree pits; photoscanned street furniture (hydrants, cans, garbage-bag piles, barriers); facades with scanned
  masonry, grime, graded light, sparse lit windows, window frames and air-conditioners placed from the real window
  layout; shop fronts, shutters and lobbies as geometry; tower crowns and rooftop plant; original LED screens and
  neon as clustered lights; lamp cones and haze halos; steam; a walker (first and third person) and pedestrians.
- Miami drive (`samples/miami-drive`): South Beach baked from OpenStreetMap at dusk (`?t=13` for daylight); a dune
  road with a 2k scanned surface, a parallax bank, stones, shrubs, grass and detailed palms; 2,001 buildings built
  from their footprints as Art Deco hotels, mid-century slabs, towers and shops with recessed windows, balconies,
  lobbies, signs and weathered stucco; a calibrated dusk sky with procedural cumulus; the hero car (the Khronos
  "Car Concept" sample model, CC-BY 4.0, on the desktop tier; a generated sedan on phones) on the engine's
  `VehicleController` with a tested road-car spec (`test/miami-car.mjs`), a live reflection probe, synth engine
  sound, skid marks, smoke, knockable props and a minimap HUD.
- The look gate: `npm run smoke` fails a sample pose whose tone or palette leaves its limits (low-key exposure,
  nothing clipped, one hue family), measured by `window.__sample.look()`.
- Performance ratchet: `npm run perf` (`test/browser/perf.mjs`) measures every sample view (page x quality tier at a
  fixed size, `bench/budgets.json`) and reduces the result to one score, 100 x the geometric mean of frame budget /
  measured ms over every pose; it compares with the committed `bench/baseline/<machine>.json`, guards the picture
  (golden images of the baseline, load-to-load noise calibrated), the draw-call / triangle / heap / asset counters and
  the run's own noise, and records kept, accepted and dropped changes in `bench/LOG.md`. `--costs` adds the pixel share
  of the frame and the cost of every on / off knob. `bench/README.md` documents it; `bench/LOOP.md` is the runbook for
  an optimisation loop.
- Bench harness (`src/core/Bench.js`): `look()` / `lookStats(capture)` (tone and palette statistics of a frame:
  luminance mean / median / percentiles, shares of dark and bright pixels, mean saturation, saturated share per hue),
  gated per page and pose in `npm run smoke`; `report()` and `?perfreport=1` (an on-device measurement of every pose
  with a copyable JSON result, for phones and tablets).
- `SSRPass`: opt-in `denoise` (a separable depth- and normal-aware blur of the reflection buffer, radius by roughness;
  default 0 = off, output unchanged).
- Samples replaced: the four test samples `canyon-run`, `city`, `character` and `sandbox` are removed (they are in
  git history: `main` at fc73161). Two demos take their place: `samples/nyc-night/` ("Night NYC walk": buildings and
  night lighting) and `samples/miami-drive/` ("Miami drive": assets, driving feel and physics). `samples/halloween/`
  (Midnight Candy Run) stays. `vite.config.js`, `samples/index.html`, the browser smoke / bench scripts and
  `bench/release-sweep.js` list the three; the smoke script also runs `nyc-night-mobile`, `miami-drive-mobile` and
  `halloween-mobile` (the same page with `?quality=mobile`), and reports the Halloween game (no bench harness:
  `window.__game`) as loaded-and-skipped, failing on console errors.
- Quality tiers (`src/core/Quality.js`, exported from `@vibe/engine/core`): two presets, `desktop` (Macs, laptops and
  desktops with a real GPU) and `mobile` (phones and tablets), as plain option groups a sample spreads into Engine /
  Atmosphere / PostFX / MapWorld (`QUALITY_TIERS`, `tierSettings(tier, overrides)` deep-merges without touching the
  presets, `defineTier(tier, patch)` adds a game's own keys). `recommendTier()` picks from the device (phone or tablet
  user agent, an iPad reporting a Mac, a coarse multi-touch screen, a software or weak integrated GPU, 4 GB or 4 cores
  and below: mobile). `resolveQuality()` takes `?quality=desktop|mobile` (legacy `high` / `low` map to them), else the
  stored choice (`storeTier`, localStorage `vibe.quality` or a game's own key), else the recommendation. Node-safe:
  it checks `window` before `localStorage`, so Node 22+ prints no ExperimentalWarning. Tested in `test/quality.mjs`.
- `QualityMenu` (`src/ui/QualityMenu.js`, exported from `@vibe/engine/ui`): a settings gear and panel listing both
  tiers, the device's pick tagged "Recommended"; a change stores the tier and reloads (or calls `onChange`);
  `addRow(label, control)` for a game's own settings.
- Midnight Candy Run uses the tiers: its light look (`LOW`) is the mobile tier, picked by `resolveQuality` (phones and
  tablets as before; `?quality=low|high` still work), and the title's gear / the pause screen's GRAPHICS button open
  the quality panel, centred over the screen, never during play. The look of each tier is unchanged.
- Midnight Candy Run look remaster (no rule, balance, layout, collider or pickup change; `?look=classic` keeps the
  first look): a cool, desaturated moonlit night with a violet lean where the lanterns, windows and candy are the
  saturated accents, exposure kept off the clip (a 384 px procedural moon with maria and craters, smaller halos with a
  tighter core, lit windows that show a room); CC0 Poly Haven ground scans (grass, leaf litter, the lane's gravel) on
  the terrain with normal maps on desktop (`samples/public/halloween/CREDITS.md`, 5.4 MB, phones load 435 KB of 512 px
  albedo); pools of light from the porch lamps and the gate's candles on the ground and facades (desktop); a
  two-layer tree line at 4x the resolution; denser, drier grass; weathered prop grain; desktop on the G-buffer path
  with TAA; quieter HUD pills. `?bench=1` builds the world without a round and exposes the bench harness
  (`window.__sample`: gate, graveyard, village, house), and the smoke test gates its look (`PAGE_LOOK.halloween`).
- Midnight Candy Run remaster, round 2 (objects; same rules): CC0 material scans on the props (boards, slate,
  masonry, lichened stone, bark; normal maps on desktop) chosen per part by a `surf` vertex attribute (props.js SURF,
  looks.js patchSurfaces), rust on the iron; pumpkins with a skin (streaks, scars, a waxy sheen) and finer decor
  pumpkins; candy in cellophane with crinkles and a small sharp highlight; trees with rounder trunks and a third level
  of branches (desktop); clumped grass, leaf drifts against fences, walls, graves and trunks, twigs, mushrooms, stones
  along the lane, puddles (ground cover, instanced); sample-side cumulus puffs with a silver rim toward the moon
  (`samples/halloween/clouds.js`); ghost sheets thinner at the silhouette; a contact shadow under the kid. Desktop adds
  5.8 MB of scans, phones 0.58 MB; the phones' frame time is unchanged (props without the procedural detail fetch).
  `?bench=1&closeups=1` adds look-development close-ups (not in the smoke / perf views).
- Midnight Candy Run remaster, round 3: the cumulus billboards are off by default (`?clouds=1`; the sky shader's
  cover is back to 0.36). Desktop under its 12 ms budget at 3024x1964 (gate 14.6 -> 11.8 ms): grass and the small
  dressing fold away with distance, the ground's normal maps and second sample only within ~30 m (normals at 2x
  anisotropy), the lamp pools limited to the 3 nearest, AO at 0.4 MP; the bench registers cost knobs for
  `perf.mjs --costs` (G-buffer / TAA, volumetrics, grass, cover, mist, pools, ground normals, bloom, AO). Objects
  (desktop unless noted): smooth jack-o'-lanterns (a spline-resampled profile, ~3.4k triangles) each with its own
  build (squat, tall, lopsided), carved faces that show the lit hollow through a deeper cut, a lid seam; smoother decor
  pumpkins; carved epitaphs on the slab gravestones (R.I.P., names and dates, a winged skull, a willow; one
  instanced decal); porch lamps as lanterns with muntins and a small flame core (both tiers); chimney pots, sagging
  gutters and downpipes on the cottages; slate rows follow the roof's slope (the east cottage); a faint sky fill on
  boards and masonry facing away from the moon; per-part material kinds on the witch (weave on cloth, strands on the
  braids). Phones: frame time equal to the classic look within 0.02 ms.
- The Roadster repository is retired: the README no longer links it, and `tools/README.md` marks its San Francisco
  defaults as historical. Older entries below that mention Roadster or the removed samples are kept as they were.

## Halloween 2026 (first released in 1.1.0-beta.1)
Phone touch options for the input layer, all opt-in (without them the touch controls are placed and behave exactly as
in 1.0.0), driven by the new Halloween game sample (`samples/halloween/`, "Midnight Candy Run").
- `TouchControls`: `safeArea: true` measures every offset from `env(safe-area-inset-*)` (notch, home indicator);
  per-entry `portrait: { ... }` overrides re-applied on rotation (`relayout()`; listeners only when an entry has one);
  `floating: true` sticks whose base jumps under the thumb anywhere in their `zone` and returns on release;
  `setProgress(id, p)` draws a cooldown ring on a button (no string built per call), `setLabel(id, text)`, `get(id)`.
  New helpers `isPortrait()`, `resolveTouchEntry(entry, portrait)`, `touchEdge(px, edge, safeArea)` (pure, tested in
  `test/character-input.mjs`).
- `CharacterInput`: `touchOptions` (passed to TouchControls, e.g. `{ safeArea: true }`); touchpad entries take the
  safe-area insets and `portrait` overrides too; `touchReveal: { hideOnKey, onChange }` shows hidden touch controls on
  the first real touch (a laptop with a touchscreen) and hides them on a key press; `touchShown`.
- `TouchControls` button entries take `hitSlop: px` (opt-in): an invisible ring that far around the button presses it
  too, so a thumb that lands a little off still hits; the drawn button and its bounding box keep their size (portrait
  overrides apply; `setLabel` keeps the ring).
- `CharacterInput` touchpad entries take `slop: px` (opt-in, default 0): a drag only turns the view once the finger has
  moved that far from where it landed (the travel up to there is dropped), so a tap that slides does not look around.
- `isTouchDevice({ multiTouch: true })` also counts a coarse multi-touch device with a fine pointer attached (an iPad
  with a keyboard / trackpad: iPadOS Safari reports a Mac user agent; a phone with a stylus). Without the option the
  rule is unchanged.
- `Atmosphere({ moonScatter })` (default 0 = off): at night the post fog glows toward the moon with that amount, and
  the new `scatterDir` / `scatterColor` fields (the `sunDir` / `sunColor` objects themselves without the option)
  follow the moon, so PostFX's fog glow and its volumetric pass light the night mist with moonlight shafts instead of
  going dark. PostFX and VolumetricPass read the new fields (falling back to `sunDir` / `sunColor`); without the
  option the output is unchanged, and by day nothing differs with it (`test/volumetric.mjs`).
- Halloween visuals pass (`samples/halloween/`): a deep indigo sky with moon-lit cloud edges and bats crossing the
  moon; less flat ambient and a stronger moon key; ground mist that glows toward the moon (desktop: volumetric moon
  shafts); world-space stone / bark / grass detail on the props and terrain (`looks.js`), contact shading and moss
  baked at the ground; stone gate pillars with candle lanterns, a porch lantern, halos over the lit windows, the crypt
  and the cauldron; denser grass that sways in the wind; the kid with a moonlit rim, a self fill that keeps its colours
  readable, a cape and hat tip that swing with the run, a lean and a landing squash; translucent ghosts with a cyan rim
  and a wispy hem, and (desktop) the nearest ghost casting a cold light; a two-ripple BOO shockwave and glow flashes on
  smashes, scares and big pops; a warmer, more contrasted night grade. Phones keep the same budget: no G-buffer, TAA,
  SSR or volumetrics, the 1.5 pixel-ratio cap and adaptive resolution; the hidden meshes (ghost sheets, shards, BOO
  rings) are drawn once at load so their GPU resources upload before play.
- Samples: `samples/halloween/` (third-person candy hunt: CharacterController + AnimationController, XPBD cloth ghosts on
  kinematic heads, fracturePieces pumpkin shards on the DynamicsWorld, NearestLights lantern lights, night Atmosphere +
  PostFX, synth music / SFX, phone-first touch HUD); `test/browser/halloween.mjs` drives it on desktop and in phone
  emulation (iPhone / Pixel / small / tall, portrait, landscape, rotation, safe-area insets, two-thumb input,
  backgrounding, five rounds with flat resource counts, `--perf` under 4x CPU throttling) and saves screenshots to the
  gitignored `test/browser/out/halloween/`.
- Midnight Candy Run gameplay pass from a bot playtest (phones first): desktop START captures the mouse (Esc frees it),
  the arrow keys turn; catches cost 10 % (2..12) and say "GRAB IT BACK!", the pack backs off, at most two chasers on
  phones; a stick dead zone with full speed at 3/4 deflection, BOO / JUMP hit rings, BOO lowest in portrait and glowing
  while a ghost is in reach; candy respawns ahead of the camera, a wider pull on phones, an edge marker for an
  off-screen big pop, ghost chevrons for chasers behind the kid, a directional moan, a steeper portrait camera, a
  first-session BOO lesson, and three more graveyard exits with a fence a jump clears (it was a 6 m wall, one gate).
- Midnight Candy Run gameplay round 2 (phones first, no engine change): ranks retuned from the bots for the new economy
  (0 / 40 / 90 / 160 / 260 / 420; the first is now "Little Pumpkin"), the next rank's threshold on the candy pill,
  rank-up and "NEW BEST!" call-outs, the pace against the best run in the clock line every 20 s and a rank ladder on
  the results; the Witching Hour finale (the last 30 s: candy x2, every lantern relit, a candy rain, catches capped at
  6, orange ghost auras, the countdown under the clock); a small camera shake, an FOV punch on BOO and a hitstop
  (gentler on phones, no motion with prefers-reduced-motion) and outlined call-outs; sweet streaks (a meter on the
  candy pill, +3 every 10th quick pickup); sharing a score (Web Share on phones, else the clipboard); a faint ring
  showing BOO's reach while a ghost is inside it; ghosts stay a veil at the lens; on touchscreens a push straight into
  a gravestone, tree or fence slides round it.
- Midnight Candy Run environment pass (`samples/halloween/environment.js`, phones first): the night escalates with the
  round clock from a breezy 11:57 to a storm at midnight. Wind gusts bend the grass and the dead trees (and their
  shadows) and blow autumn leaves through the view; the kid kicks leaves up as it runs; clouds thicken and race across
  the moon, which dims the graveyard while one covers it, and turns blood red in the last seconds; the ground mist
  thickens, mist banks drift, a grave breathes out mist as a ghost rises; soft sheet lightning with thunder in the
  last minutes; crows on the gate, the scarecrow, the crypt and the stones lift off when the kid runs near (or a BOO /
  thunder) and glide back later; flames gutter in the gusts, the house windows blink near midnight; the gate's leaves
  swing and creak; wind, thunder, caws and the creak are synthesized on the game's AudioBus. All GPU-animated from a
  few uniforms: three new draws (leaves and crows in one, the mist, the clouds over the moon), the trees and the gate
  through the props mesh, the lamps through light groups of the existing glow mesh, and the moon and its halo merged
  into one quad (one draw fewer); no per-frame allocation, its own seeded random stream; `heightAt` measures only the
  path segments near the point (same values, less work per spark). `prefers-reduced-motion` slows it and keeps the
  lightning a dim, slow swell. The Witching Hour calls `env.setFinale(true)`: the storm, the lightning and the blood
  moon at their peak (until Play Again or the title). No engine changes.
- `ClothMesh(store, cloth, material, { subdivide: k })` (opt-in, default 1 = unchanged): draws a k times finer grid
  through the particles, a Catmull-Rom surface (tensor product, borders extrapolated linearly) whose every k-th vertex
  is a particle, so a coarse cloth folds smoothly instead of in facets; refined once per `capture()` into scratch
  allocated once (linear in the particles, so interpolating refined grids is exact); `subdivide`, `gridX`, `gridY`.
  `test/cloth-mesh.mjs`.
- Midnight Candy Run assets pass (`samples/halloween/`, models only, all still built in code: no model, texture or
  sound files). The kid: chibi proportions, a toon face (glossy eyes with catchlights, blush, freckles, a smile),
  bangs and two braids that stick out sideways, a floppy brim and a bent drooping hat tip, a pleated cape with a
  crimson lining and stars, trumpet sleeves, a zigzag hem, curly-toed boots, the pail merged into the one skinned mesh
  (a per-vertex glow; three draws fewer), its own run / walk / idle / jump clips and a landing pose. Jack-o'-lanterns:
  ribbed (crisp creases per pixel), a curved stem and a curly vine, a carved face with depth (a mask texture of three
  faces and a parallax march into the cut), shards shaded with the ribs and with fibres and seeds. Ghosts: a round
  head and a hanging skirt on the same cloth (pinned lower on a taller dome, 2x subdivided), a scalloped hem, a cute
  face at twice the texel density (a radial uv warp). Candy: bow-tie wrappers, candy-corn kernels, a chunky swirl
  lollipop, hand-shaded. Props from reusable builders in the new `props.js` (gravestones, ironwork, gnarled trees, the
  house, the crypt, the scarecrow, the cauldron, hay bales, decor pumpkins), still merged into one mesh. The layout,
  colliders and hit radii are unchanged.
- Midnight Candy Run trick-or-treat porches (`samples/halloween/porches.js`, design pass 2, phones first, no engine
  change): six lit porches; stepping onto a lit doormat is a treat (a knock, the door swings open, 8 candies pour out
  onto the lane side, the lamp dark for 40 s and fading back up over its last 3 s), a BOO on the mat a trick (14, dark
  60 s, and a resident ghost drops from the chimney 0.6 s later and chases), the haunted porch trick-only (22, two
  residents, 70 s); a porch that relights lays a trail of 5 candies along the lane (in place of ordinary respawns; a dry
  view still gets its candy in view); treating or tricking all five lane porches pays the Full Round (+25), each visited
  porch keeping a lit jack-o'-lantern on its post (no HUD); the Witching Hour relights every porch at once and its candy
  rain drops from 20 to 12. Residents come from the ghost pool (`ghosts.summon`: a dormant ghost from the chimney, else
  the nearest wandering one; it takes a chase slot). Until the map pass builds the cottages (`porch-spots.js` stands in
  for its `PORCHES`), each porch is a stand-in front built from the `props.js` kit (one merged mesh, its glowing parts
  in another, the doors one instanced mesh: three draws; the stub turns P1 and P6 along the axes, as the stand-in walls
  collide as boxes). Hints go through paced call-outs (`hud.say`: one per 2.5 s, duplicates and stale ones dropped; a
  trick, a catch or the Witching Hour hold the screen a second against a streak's), once-per-device lessons in `taught`
  (localStorage `midnight-candy-run.taught.*`; "BOO AT THE DOOR / = TRICK!" with BOO glowing at an opening door until
  the first trick), "A GHOST RISES..." once a round; ranks v2 (0 / 60 / 140 / 230 / 360 / 520, retuned on the phone
  bots); the results show porches n/5, tricks, BOOs, catches and the best streak.
- Midnight Candy Run map v2 (`samples/halloween/world.js` + the new `village.js`, design pass 1, no engine change):
  the same 100 x 100 m square as a village. A lane ring with four spokes from the spawn's green (3 m of dirt) replaces
  the five radial paths; a 4.5 m knoll (a term of `heightAt`) carries the haunted house on its plateau; a creek crosses
  the south third (z 19..22.5, its bed 1.2 m down, bank walls in 4 m pieces: falling in is allowed, a JUMP gets out,
  "JUMP OUT!" once) with three plank footbridges and candle lanterns; five cottages (the gatekeeper's by the green,
  Porch Row along the lane behind picket fences with gate gaps, the east cottage) and the haunted house are the porch
  houses (`PORCHES`, which `porch-spots.js` now exports: each house leaves a 1.12 x 2.14 m doorway with a vestibule for
  the porch logic's door, its lamp and railing are light groups of the merged glow mesh); the witch's hollow (the
  cauldron in a ring of standing stones), the Bale Yard's stacked stair to a 2.2 m platform, the hollow oak, the well,
  a signpost; the graveyard as it was. New `props.js` builders (cottages, footbridges, bank walls and reeds, standing
  stones, bale blocks, the well, the signpost, the hollow oak, a bench, picket fences, path stones, small
  jack-o'-lanterns, doormats); everything static is still the one props mesh and the one glow mesh, plus the creek's
  water (one additive mesh with the moon's glint and low mist). 34 lanterns; candy spawns by zone share (the lane 30 %,
  the graveyard 22, the patch 13, porch approaches 10, the creek's bed 8, the knoll 7, anywhere 10); `world.js` exports
  `HAND_SPOTS`, `BRIDGES`, `CREEK`, `POP_SPOTS`, `SECRETS`, `CAULDRON`, `VANTAGE`, `THIEF_DEN` for the later passes.
  Every collider is an axis-aligned box (every house faces along an axis). Spilled candy lands on a deck, a bridge or a
  bale (`Candy` `floorAt`); the dry-view candy's clear run ignores what a jump clears; lit windows dim near the camera;
  the touch slide-around follows a wall through the boxes that continue it (a picket fence into a cottage front) and
  takes an open way out of an inside corner (a bot stood 85 s in the graveyard's corner pushing at the gatekeeper's lit
  mat beyond it).
- Midnight Candy Run enemies (design pass 3, phones first, no engine change, no new light, physics body or HUD box):
  **grave hands** (`samples/halloween/hands.js`) at ten fixed spots (the graveyard aisle, among the graves, and where
  the creek's three bridges: the map's `HAND_SPOTS` through `hand-spots.js`): hidden 7..12 s (3..6 s in the Witching
  Hour), a 0.8 s telegraph (a crimson soil ring, dirt puffs, a crack, the fingertips poking out), then two bony hands
  stand 2.5 s; at most 4 out at once, awake from 0:40. A grounded kid in reach (0.9 m, feet under 0.6 m) is grabbed:
  held 1.0 s (`cc.hold`, the kid wiggles), then let go with 3 candies spilled round it. JUMP clears them, BOO within 4 m
  sends them down; a grab always ends (its timer, a BOO, a ghost's catch, midnight), never while safe, and not again for
  1.2 s. One instanced mesh drawn only while some are out; the ring and puffs use the shared glows and sparks. **The
  candy thief** (`thief.js`): a raccoon in a little bedsheet with eye holes and a pink sack that swells and glows with
  its loot (one skinned mesh, 13 bones posed in code). It comes out of its den at 1:00 ("A CANDY THIEF!" and an edge
  marker while off screen), runs at 5 m/s to the cluster of candy the kid is heading for and eats one every 0.5 s (sack
  max 20; it takes nothing within 12 m of a lit porch's mat, whose trail stays the kid's), keeps 6 m from the kid and
  bolts (6.5 m/s, zigzag) when the kid comes within 4 m; cornered, its touch snatches 5. BOO within 7.5 m stuns it 1.8 s
  (stars); a touch then TAGS it: its sack + 5 spill out ("TAGGED! +N") and it runs home for 25 s. The Witching Hour
  brings it back with 10 in its sack. Lessons once per device: "JUMP THE HANDS!" at the first telegraph in view, "BOO
  IT, / THEN TAG IT!" when it is in reach; BOO glows with the thief in reach. Sounds: the crack, the hands bursting out,
  a grab's rattle, the chitter, the stun's stars, the tag's chimes. The results add TAGS. `test/halloween-enemies.mjs`
  (headless, in `npm test`) pins their rules and their allocation per frame (none for the hands; for the thief only the
  boxed arguments of two engine calls).
- Midnight Candy Run: the far-candy move into a dry view (`relocateFar`) fires below `CANDY_TARGET` too, after 2.4 s
  of a dry view (was 3.6 s, and only with the full target resting, which play keeps a few under, so it never fired).
- Midnight Candy Run depth and replay (design pass 4, phones first, no engine change, no new light, physics body or HUD
  box). **Potions** (`samples/halloween/potions.js`): the cauldron's brew cycles green / violet / pink every 3 s;
  walking into its ring while it glows takes the colour showing, and the brew goes dark for 30 s (fading up over its
  last 3). ZOOM runs 8.5 m/s for 8 s, SNEAK hides the kid from the ghosts (no chase, no catch: chasers drop to
  wandering), the grave hands (no grab) and the thief (no bolting; a stunned one is still tagged) for 8 s, SWEET TOOTH
  pulls candy from 7 m and picks it up at 1.2 m for 12 s; one at a time (a new one replaces), the pail's light and an
  aura round the kid take its colour and blink in its last 2 s; "WALK INTO / THE BREW" once per device. The brew's
  colour is the glow mesh's one tinted light group (its parts and its halo; `world.glowTint`). **Stomp chains**
  (`chain.js`): a stomp within 1.6 s of the last pays 7, 10, 13 ("CHAIN ×2!"). **Secrets** (`secrets.js`, no markers):
  BOO by the well (an echo, 4 candies), BOO at the crypt's door (it sinks into the plinth: its own small mesh, the map's
  crypt is built without its leaf; 12 + a pop, a ghost rises at it), walking into the hollow oak (8 + a pop; the
  Witching Hour refills it); each once a round. **Fixed big pops** on the knoll's plateau and the Bale Yard's platform,
  back 45 s after they are taken (`Candy.fixed`: not field candy, not the roaming pop's cap or edge marker; five pop
  beams, culled off screen). **Badges** (`badges.js`, results only, kept on the device: Full Round, Trickster,
  Untouchable, Chain King, Tagger, Explorer, Potion Master; up to 3 new ones named, a locked one's four-word hint) and
  the results' BEST CHAIN. **Tonight's Patch** (`rng.js`): the night's seed (the local date, or `?seed=<n>` from a
  shared link) lays out each round's candy (`candySpot`, kinds, the dry-view and pop draws), the porches' relight
  jitter (+-2 s, new) and the grave hands' cycles, re-seeded every round; the title shows "TONIGHT'S PATCH · NOV 1"
  (a friend's: "A FRIEND'S PATCH"), the results and the title keep tonight's best (`midnight-candy-run.daily.<seed>`),
  the share carries the date and the seed. Tuning on the phone bots: mercy after 2 catches in 30 s (was 3), with one
  chaser at a time and the pack calm 8 s after each catch while it lasts; a dry view's respawns land 6..14 m ahead, 0.8
  of them (were 9..22 m, 0.6); the final ranks 0 / 60 / 140 / 240 / 360 / 560 (were 230 and 520). `test/halloween-depth.mjs` (headless, in `npm test`) pins the rules, the seed and no allocation per frame
  for the potions and the secrets; the browser suite adds the pass-4 checks and two page loads of one seed.

## 1.0.0 — 2026-10-30
The release of the 1.0 roadmap (phases 0.5.0 - 0.9.0, ENGINE.md): a general engine with its graphics and physics pushed as
far as the phases took them, measured. No engine behaviour changes against 0.9.0: the source changes are JSDoc comments,
two namespace imports of three and one rest parameter. Canyon Run's eight day poses capture pixel-identical to 0.8.0 in
the app's browser at both sizes, `npm run smoke` passes on all 12 pages (every pose it printed hashes as in earlier
runs), and the car-sim / world-build pins are untouched since 0.4.0.
- Package: the TypeScript declarations emitted from the JSDoc ship with the package (`types/`, emitted by `prepack`)
  and are exported for the root and every subpath (`"types"`, `exports[*].types`); a strict TypeScript consumer
  compiles against them with `skipLibCheck` off (`test/types/check.ts`, `npm run types:check`, run by CI). JSDoc fixes
  in 20 source files for that (option bags and overrides that emitted wrong or incomplete types; the two a consumer
  hit first: the `Cloth.grid` / `Rope.chain` option lists and `Events.emit` with its four positional args optional;
  no runtime change). The package description and keywords say what the engine is now.
- CI runs on Node 26, the V8 the allocation budgets are calibrated on (0.9.0 note), and runs `types:check`.
- Docs: README and ENGINE.md consolidated for 1.0 (the stale SMAA and Rapier-backend claims gone; "Engine API" is the
  real one; "Rapier plug-in contract" states the DynamicsWorld surface a replacement must provide; "Measurement
  protocol" covers the 1.0 sweep, whose plan is `bench/release-sweep.js`).
- Measured (1.0): every sample page, every pose, at 3024x1964 and 2560x1440, engine defaults against everything on, in
  the desktop app's browser (`bench/results/2026-10-30-*-p6-*.json`; tables in ENGINE.md "Measured (1.0)").
  Defaults within 0.1-0.8 ms of the 0.5.0 baseline (Canyon Run straight 8.25 ms at 3024x1964, city street 12.54,
  character idle 5.34, sandbox stack 5.25); G-buffer + TAA +2.4-2.8 ms at 3024x1964 on Canyon Run and cheaper than
  the 4x MSAA default at 2560x1440 (7.32 vs 7.59); everything on (SSR, volumetrics, DoF, motion blur, G-buffer AO
  normals, PCSS) +8-10 ms at 3024x1964 and +4-5 ms at 2560x1440 on every page (Canyon Run 17.18 / 11.57, city
  18.72 / 12.91, character 13.43 / 8.79, sandbox 12.73 / 8.70); the night city with every lamp clustered 21.1 / 14.2.

## 0.9.0 — 2026-10-29
Unified XPBD (phase 5 of the 1.0 roadmap, ENGINE.md "Unified XPBD (0.9.0)"): particles, cloth, ropes, soft bodies,
particle-rigid coupling, buoyancy, pre-fractured bodies, character dynamics and ragdolls, all on the 0.6.0 solver; a
world without `maxParticles` steps bit-identically to 0.8.0 (pinned), every sample pose of 0.8.0 hashes the same.
- Physics: `DynamicsWorld({ maxParticles, particleDamping })` with `world.particles` (ParticleStore), `world.constraints`
  (distance / bending / attachment / tether), `addParticleSolver` plugins (`{ beginStep, solvePositions, solveVelocities,
  endStep, serialize, restore }`), `isActive`, `particleAabb`, `recollidePairs(ids, n)` (narrowphase + contact setup
  for pairs a plugin unglued in its beginStep; beginStep only); plugins also work on worlds without particles;
  `Cloth.grid`, `Rope.chain`; serialize / from carry particles and plugins; the worker client runs particles in-thread.
- Physics: `SoftBody.lattice` / `tetrahedralize` / `SoftBody.skin` / `VolumeConstraints` (tet volume + global pressure).
- Physics: `ParticleCollider` (particles vs bodies / static boxes / heightfield / trimeshes, two-way, friction) and
  `Buoyancy` (sample-point volumes, drag, `fluid.heightAt`), `closestPointOnShape`.
- Physics: `fracturePieces`, `FracturedBody` (glue joints with breakForce 15 kN, compliance 5e-7, breakStress,
  `impactBreak`), `FractureMesh`; the joint solver bounds a breaking joint's rows at breakForce per substep.
- Physics: `CharacterController.attachDynamics` (push light bodies, ride moving platforms; bit-identical without it).
- Anim: `Ragdoll.fromSkeleton` / activate / update / deactivate, `AnimationController.resync()`.
- Samples: sandbox `?scene=cloth|rope|soft|buoyancy|destructible` (+ `render/SoftMeshes.js`), character crates /
  elevator / ragdoll (K) / mantle with hand IK, poses `push` / `ragdoll`; smoke pages for the five scenes.
- Tests: `dyn-cloth` (181), `dyn-soft` (112), `dyn-buoyancy` (126), `dyn-fracture` (139), `character-dyn` (97),
  `ragdoll` (108); `npm test` runs 31 suites.
- Physics fix: a sphere or capsule rolling on the ground gained spin exponentially (0.6.0 stored contact points as
  material anchors that rotated with the body); contact anchors of bodies whose top-level shape is a sphere or a
  capsule are now re-seated on the surface every substep (a compound of spheres keeps the old anchors). Rolling
  scenes change (the sandbox stack ball), the box-only pins do not.
- Measured (Node 26, M4, ms per 1/120 s step with 4 substeps): cloth 32x32 0.40, 64x64 1.63; 1000 bodies + 200 rope
  particles 3.23; three soft cubes 0.89; 200 floating boxes on a wave 1.93; a 40-piece glued wall 3.29 (the joint
  tree), 3.09 after the hit. Destruction is local (a hole and a few thrown pieces; 90-98 % of a wall stays glued):
  a full collapse needs CCD, a 1.0+ item.

## 0.8.0 — 2026-10-29
Screen-space and volumetric rendering (phase 4 of the 1.0 roadmap, ENGINE.md "Render pipeline (0.8.0)"): reflections,
volumetric sun light, water refraction, motion blur, depth of field and 3D-LUT grading, composed by `PostFX` in the
order Scene -> Exposure -> AO -> SSR -> Volumetric -> TAA -> MotionBlur -> DoF -> Bloom -> Final. Every option is off
by default and the default output is byte-identical to 0.7.0 (shader texts pinned by sha1 with the new blocks under
absent defines; `npm run smoke` hashes every default pose equal to the 0.7.0 gate).
- Render: `PostFX({ ssr, volumetric, motionBlur, dof, lut, ao: { normals } })`, `postfx.set(path, value)` /
  `postfx.get(path)` for every knob (`'ssr'`, `'ssr.<opt>'`, `'volumetric'`, `'volumetric.<opt>'`, `'motionBlur'`,
  `'dof'`, `'lut'`, `'lut.strength'`, `'ao.normals'`, ...), passes created / removed / disposed at runtime,
  `colorSource` = the last enabled of TAA -> MotionBlur -> DoF; FinalPass hooks `FINAL_SSR` / `FINAL_VOLUMETRIC` /
  `FINAL_LUT`, TAA hook `TAA_SSR` (the reflection composited into every 3x3 tap so the variance clip keeps it).
- Render: `SSRPass` — half-resolution screen-space reflections on the G-buffer normal / roughness (perspective-correct
  march, bisection, premultiplied output `col * (1 - a) + rgb`); the specular share of metals is a capped heuristic
  until an F0 nibble lands in the G-buffer (0.9.0), no roughness blur yet, `jitter` off by default (the TAA hook
  cannot converge a jittered march). Canyon Run at 3024x1964: +0.5 ms (0.33-0.37 at 2560x1440), the city's shore
  +1.6 ms (the bay mirrors the warehouse: 1.44 mean change); `steps` / `scale` move it by < 0.1 ms.
- Render: `AOPass({ normals: 'gbuffer' })` — GTAO on the G-buffer normal instead of depth-reconstructed normals.
- Render: `VolumetricPass` — quarter-resolution shadowed sun in-scatter through the final pass's own haze + mist
  layers (Henyey-Greenstein, closed-form optical depth, cascade shadow taps on compare-mode or packed maps, the
  cascade walk of `shadowCascade.js`), temporally accumulated with a 2x2 depth-aware disocclusion; output per unit sun
  irradiance, composited as `sunColor * sun.intensity * intensity * r` after the fog (the analytic sun glow is dropped
  while it is on). Physical units: faint in thin desert air and inside a shadowed canyon; `density` / `intensity` are
  the look knobs. +0.4-0.8 ms at 3024x1964 (scale 0.5: +1.1-1.9), +0.3-0.5 at 2560x1440.
- Render: `MotionBlurPass` (McGuire tile-max reconstruction on the G-buffer velocity, camera reprojection elsewhere,
  exact pass-through when static, `shutter` for frame-rate-independent streaks) and `DoFPass` (signed thin-lens CoC,
  half-resolution far / near gathers, exact pass-through in focus, `circleOfConfusion()`); `Lut.js` (`LUT_GLSL`,
  `identityLut`, `lutFromFunction`, `lutLookup`) with the Assets `lut` value applied in the final pass. Motion blur
  costs 2.0-2.1 ms at 3024x1964 (1.3 at 2560x1440) even on a static frame (the velocity / tile passes are
  bandwidth), DoF 2.6 ms (1.7; `scale` 1 +6.2), the LUT 0 ms; `ao.normals: 'gbuffer'` < 0.1 ms.
- Render: `SceneCopy` — the opaque scene's colour + depth copied mid-frame from a mesh's `onBeforeRender` (one copy
  per frame, target / viewport restored), for refractive materials; needs a single-sampled scene target.
- World: `createWaterMaterial({ refraction })`, `MapWorld({ water: { refraction } })`, `world.setWaterRefraction`: the
  bay sees the scene behind its surface (slope-driven distortion, Beer-Lambert absorption, murk, depth foam);
  refraction off is byte-identical (shader hashes pinned); world-build pins untouched. +0.6-0.7 ms at 3024x1964
  (+0.4-0.5 at 2560x1440), the mid-frame target switch, paid whenever the bay draws.
- Samples: `?ssr=1 ?volumetric=1 ?motionblur=<s> ?dof=1[&focus=&fstop=] ?lut=warm|bleach|identity ?aonormals=gbuffer`
  on every sample (`samples/shared/fx-flags.js`, harness settings `postfx.<path>`); Canyon Run `?lamps=1` (118
  trackside lamps on `ClusteredLights`, +0.3-0.5 ms at night at 3024x1964, pose `night-lamps`, setting
  `lamps.enabled`), `?gpuparticles=1[&devilscollide=1]`
  (dust devils on `GpuParticleSystem`, seeded, pose `devils`); city `?water=refraction` + pose `shore`; procedural
  `.cube` LUTs under `samples/public/luts`; `npm run smoke` adds `canyon-night` and `city-water`.
- Tests: `ssr-ao`, `volumetric` (130), `blur-dof-lut` (128), `water` (117), `postfx-options` 141 -> 264; `npm test`
  runs 25 suites.

## 0.7.0 — 2026-10-29
Render foundations (phase 3 of the 1.0 roadmap, ENGINE.md "Render pipeline (0.7.0)"): a G-buffer path with TAA,
clustered lighting for hundreds of lights, 2-4 shadow cascades with a PCSS kernel, and GPU particles. Every knob is
opt-in and the forward path renders bit-identically to 0.6.0 (same-page A/B diffs 0 / 0.0005 mean).
- Render: `PostFX({ gbuffer: false, aa: 'auto' | 'msaa' | 'fxaa' | 'taa', taa: { blend, clamp, sharpen, filter,
  historyFormat, stableDepth }, jitter })` — the MRT scene pass (`GBuffer`: colour + octahedral normal / roughness /
  metalness / flags + velocity), `CameraHistory` jitter and matrices, `TAAPass` (Catmull-Rom history, variance
  clip, velocity or depth reprojection), `postfx.set(path, value)` knobs, `atmosphere: null` support. Canyon Run at
  3024x1964 (FXAA default): G-buffer + FXAA +0.3-0.5 ms with identical colour, G-buffer + TAA +2.2-2.5 ms (10.65 /
  11.09 / 11.38 / 7.83 ms vs 8.25 / 8.62 / 8.80 / 5.60); at 2560x1440 (4x MSAA default) the G-buffer path is
  cheaper than MSAA: + FXAA -1.2-1.7 ms, + TAA -0.2-0.4 ms. `taa.{stableDepth, reject, snap, velocityFirst}` are
  measured knobs, all off (≤ 0.15 ms either way on static poses).
  `InstancedPool({ velocity: true })` + `postfx.trackPool(pool)` and `postfx.track(mesh)` give moving objects their
  own velocity (PostFX keeps the lists and replays them whenever the G-buffer is rebuilt).
- Render: `ClusteredLights` — up to 1024 point / spot lights in a froxel grid, +2 texture units, a global chunk
  patch under `ENGINE_CLUSTERED` calling three's own `RE_Direct`: 8 clustered lights match 8 real PointLights
  pixel-exactly. World: `MapWorld({ lights: { clustered: true, clusteredRange } })` and `NearestLights({ mode:
  'clustered' })` light every lamp in range instead of the nearest 8: the night city with every lamp within 220 m
  costs +0.6 / +1.0 / 0.0 ms over the pool at 3024x1964 (11.69 / 12.43 / 11.28 vs 11.12 / 11.46 / 11.29).
  `world.setLightMode` switches at runtime; `npm run smoke` runs the clustered night page.
- Render: `shadows.cascades: 1-4` (middle cascades, round-robin updates; 3: +0.2-0.5 ms, 4: +0.3-0.9 ms, pixel
  change 0.003-0.017 mean) and `kernel: 'pcss'` (blocker search + contact-hardening penumbra: 9.1-10.5 ms vs
  'fast' 8.2-8.8 and 'pcf' 9.9-10.9 in Canyon Run at 3024x1964); `atmo.shadowCascadeInfo(out)`; the 2-cascade
  'pcf' chunk text is byte-identical to 0.6.0 (pinned by `test/shadows.mjs`).
- Render: `GpuParticleSystem` — the `ParticleSystem` API over GPUComputationRenderer (65k particles, deterministic
  slots, depth collision), matches the CPU system to 1e-5 m; 0.2 ms CPU for 65k live + 4096 spawns per frame.
- Samples: `?gbuffer=1`, `?aa=`, `?cascades=`, `?shadows=pcss` on every sample (the car, the character and the
  sandbox's instanced bodies are velocity sources); city `?clustered[&range=]`;
  harness `quiet` hooks reset the TAA history and converge 32 frames so captures reproduce.
- Tooling: samples freeze the loop at `setReady()` under `?bench=1` and every harness setting has a getter, so
  captures reproduce across page loads (Canyon Run's car poses differed by up to 0.28 mean before) and
  `__sample.run(plan)` restores knobs between settings (see ENGINE.md "Measurement protocol"); `npm run smoke`
  gains a `city-clustered` night page with an in-page clustered-lights check.
- Tests: `gbuffer-chunks` (251 checks), `clustered` (93), `shadows`, `postfx-options` (141), `gpu-particles`
  (63), `world-lights` (63); `npm test` runs 21 suites.

## 0.6.0 — 2026-10-29
Unified XPBD rigid-body dynamics (phase 2 of the 1.0 roadmap, ENGINE.md "Physics" / "DynamicsWorld"): a pure-JS,
deterministic, Node-testable solver that plugs into the existing `PhysicsWorld` so the vehicle and character
controllers collide with rigid bodies without changes. Opt-in: nothing moves unless a game creates a
`DynamicsWorld`; `npm test` keeps the roadster model bit-identical and the 0.5.0 samples render identically.
- Physics: `DynamicsWorld` — bodies (dynamic / static / kinematic) with sphere, capsule, box, convex hull, static
  triangle mesh and compound shapes; substepped XPBD with manifold contacts, Coulomb friction with persistent
  anchors, restitution, damping, islands and sleeping, kinematic targets that push, forces / impulses, `began` /
  `ended` contact events, ray / shape casts and overlaps, `serialize() / from()` (bit-identical). Joints: fixed,
  ball, hinge (limits, motor, servo), slider, distance (spring / rope), d6 (swing cone, twist), `breakForce`,
  solved exactly per joint tree. `attachToPhysicsWorld(dyn, physics)` bridges bodies into the query hub as
  `kind: 'rigid'` records (layer bit 25). `DynamicsClient` runs the same API in a module Worker (`worker: true`)
  or in-thread. `PhysicsDebug` (render layer) draws shapes, contacts and joints. 7 new headless suites
  (`test/dyn-*.mjs`, 600+ checks: analytic contacts to 1e-15, pendulum period within 0.2 %, chain gap 1e-6 m,
  10-stack drift 3e-15 m, 1000-body pit determinism hash, worker round trip bit-identical).
- Samples: `samples/sandbox/` at `/sandbox/` — scenes `stack`, `joints`, `chain`, `ragdoll`, `car` (the roadster
  controller among crates, `?solid=0` bulldozes them through a kinematic proxy) and `bench1000` (`?bodies=`);
  `?worker=1`, `?debug=1` (F4), `?substeps=`, `?seed=`, bench poses `overview` / `close`. Measured on the M4 in
  Chrome: 1000 mixed bodies 6.5 ms per step falling, 9.5 ms with 960 awake at 60 Hz, worker 10.7 ms off-thread
  with 0.5 ms on the main thread; 5 ragdolls sleep within 17 s; bench poses reset + hand-step so captures
  reproduce across loads.
- Physics: `PhysicsWorld` reserves `layerOf('rigid')` = bit 25; `CharacterController` and the rigs are unchanged
  (bridged bodies are walls to them; two-way coupling is phase 5).

## 0.5.0 — 2026-10-29
General-engine foundations (phase 1 of the 1.0 roadmap, ENGINE.md "Core services", "Character stack",
"Measurement protocol"): the services a non-driving game needs, a third-person character stack, and the tooling
that turns the manual measurement protocol into scripts. Every addition is opt-in; `Engine`, Canyon Run and the
city page render pixel-identically to 0.4.0 (captures hash-equal across page loads with the pinned protocol) and
`npm test` keeps the roadster vehicle model bit-identical.
- Core: `Events` (typed emitter, positional `emit`, allocation-free, safe add/remove during emit), `Clock`
  (`engine.clock`: `timeScale`, `paused`, `step(n)`; the Engine scales the system dt and the fixed accumulator,
  the profiler and adaptive resolution keep the wall dt), `Entity` / `EntitySystem` (thin component layer over
  `Object3D`, dense per-phase arrays), `Engine` systems gain `priority` (ordering) and `engine.setSystemEnabled(s, false)` (skip);
  defaults reproduce 0.4.0 exactly. `test/core.mjs` (107 checks).
- Core: `Assets` loader registry (cache, URL dedupe, refcounts, weighted progress, `assets.system()` for
  `engine.load`) with `registerRenderLoaders` (glTF + KTX2 / Draco / meshopt, texture, HDR with PMREM, `.cube`
  LUT -> `Data3DTexture`) and `registerAudioLoader` / `SamplePlayer` (decoded samples through the existing bus and
  positional emitters; decoding runs in an OfflineAudioContext before the bus starts, so loading never waits for
  a gesture; `disposeInstance(root)` frees a clone's skeletons). `test/assets.mjs` (119 checks).
- Core: `MathDet` deterministic math (`mulberry32`, `hashU32 / hashF64 / hashF64Array`, `detAtan2 / detAcos /
  detAsin / detAtan` from + - * / sqrt only, max error 4.4e-16) for simulation code that must be bit-identical on
  every JS engine.
- Physics: `CharacterController`, a kinematic capsule over the `PhysicsWorld` query API: step climbing, slope
  limit, wall slide, ground snapping, coyote time, jump buffering (the jump edge is detected internally), vehicle
  shove, crouch via `setHeight(h, world)` / `canStand` with auto-crouch under a ceiling; no trig in the step path;
  `test/character-sim.mjs` (134 range checks incl. a golden determinism hash, 12000 steps in ~6 ms).
- Camera: `ThirdPersonRig` and `FirstPersonRig` on `CameraRig` (damped follow, ChaseRig-style collision pull-in,
  ground clamp, `turn(dyaw, dpitch)` in radians, yaw basis for camera-relative movement, head bob).
  `test/rigs.mjs` (83 checks).
- Input: `CharacterInput` (`CHARACTER_ACTIONS` + touch layout; look deltas in radians, live only under pointer
  lock or a right-button hold), `PointerLock` (`request() -> Promise<boolean>`, `releasedByUser`) and
  `InputMap.readSources(name, out)` (per-kind raw sums of an action's bindings). `test/character-input.mjs`
  (45 checks).
- Anim (new layer, `@vibe/engine/anim`): `AnimationController` (states, 1D blend trees with cycle sync,
  transition table, markers, `end` / `loop` / `marker` events, root motion extracted from the hips with the
  horizontal track neutralised on cloned clips; a finished one-shot holds its last frame by default), `TwoBoneIK`,
  `CCDIK` / `makeIKChain` over three's CCDIKSolver. `test/anim.mjs` (78 checks).
- Samples: `samples/` is now a multi-page vite root (`/`, `/canyon-run/`, `/city/`, `/character/`; the dev-only
  `/city` plugin is gone, `vite build` emits every page). New `samples/character/`: third-person playground with
  the CC0 RobotExpressive glTF (`node tools/fetch-models.mjs`, never committed) or a procedural rigged fallback
  built in code, Entity components for motor / animator / facing, pointer-lock mouse look, three rigs.
- Tooling: `createBenchHarness` (`window.__sample` on every sample: poses, GPU-synced bench, captures, diffs,
  `run(plan)`), `npm run smoke` (headless Chrome: boot, no console errors, two equal captures per pose) and
  `npm run bench` (headed Chrome, writes `bench/results/*.json`) through Playwright; `npm test` = `test/all.mjs`;
  `npm run types` emits `types/` from the JSDoc; GitHub Actions CI runs test + build + types.
- Measurement protocol: captures reproduce across page loads only with the sky time, cloud offset, wind time and
  dither-fade view position pinned, exposure frozen and poses run in a fixed order from a fresh load (a stale
  `uViewPos` alone moved 2-5 % of Canyon Run's pixels). The harness hooks in both samples do this.

## 0.4.0 — 2026-10-28
MacBook pass (Apple M-series, Retina 2x, ProMotion): measured in the desktop app's Chromium at a 14-inch MacBook Pro's
pixel count (3024x1964) with `Profiler.benchThroughput`, pixel diffs read back from the framebuffer. Canyon Run's
driving view went from 15.9 to 8.2 ms, the chase view from 17.1 to 8.7 and the aerial view from 20.6 to 8.8 ms, with every
quality-affecting knob measured by full-resolution pixel diff (ENGINE.md, "MacBook pass").
- Render: `PostFX` clears the scene target after the shadow maps (`lateClear`, default on: identical output, ~1 ms
  saved on Apple GPUs where the early clear stored and reloaded the whole multisampled target), caps the AO buffers at
  `ao.maxPixels` (default 0.6 Mpx) with a depth-aware upsample in the final pass (`ao.upsample: 'depth'`, default)
  and compact RG16F AO buffers (`ao.compact`, default on): -1.3 to -2.5 ms at Retina, full-resolution pixel change
  <= 0.04 / 255 mean. `setAOResolution({ scale, maxPixels, upsample })`. The final pass skips chromatic-aberration
  taps and the sun-scatter pow when they are off, and reads the exposure once per vertex (identical output).
- Render: `msaaMaxPixels` (default Infinity): `msaa: 'auto'` uses FXAA above that drawing-buffer pixel count; the 4x
  resolve (colour + depth blit, unavoidable in WebGL2) costs 2.7 ms at 3024x1964 and 4x -> 2x saves only 0.4. Visible
  on high-frequency facades (17 % of pixels change by > 2 / 255 in the city), so it is opt-in; Canyon Run sets 4e6
  (`?msaamax=`).
- Render: opt-in `'fast'` directional shadow kernel (`Atmosphere({ shadows: { kernel: 'fast' } })`,
  `atmo.setShadowKernel('fast' | 'pcf')` at runtime, `render/shadowKernel.js`): 5 hardware-compare taps per lookup
  (a DepthTexture with LEQUAL compare on the same shadow render) instead of three's 17 unpacked taps, the same
  penumbra width: -2 ms at 3024x1964, full-resolution pixel change <= 0.015 / 255 mean. Falls back to 'pcf' with a
  warning when the shadow type is not PCF or another shadow-casting directional light exists. Canyon Run uses it
  (`?shadows=pcf` to compare).
- Core: `Engine({ targetFps })` (live `engine.targetFps`, default 0 = every rAF callback): paces ticks from the
  rAF stream (60 on a 120 Hz ProMotion display ticks every second callback), `engine.refreshRate` (display Hz,
  estimated from the raw callbacks; F3 overlay and `?profile=` table), adaptive resolution with a frame budget of
  1000 / min(targetFps, max(refreshRate, 60)) ms when capped and the original 60 fps budget when not (a 120 Hz
  display keeps full resolution at 60 fps as before; targetFps 120 chases 120 fps at lower resolution). Canyon Run:
  `?fps=60`.
- Textures: the procedural fallback layers of `makeTextureArray` are generated in a module-worker pool
  (`render/proceduralTextures.worker.js`, `render/proceduralPbr.js`; `TextureSets.configure({ proceduralWorkers })`,
  `?procworkers=0`), byte-identical to the in-thread path (checked by hash): main-thread cost per layer 24-68 ms ->
  3-5 ms; in-thread in Node and as the fallback. Stats gain `procIn`, `workerMs`, `procMs`; `makeTextureArray`
  takes `free: false` to keep the CPU copies.
- Dev: `samples/city/` renders the procedural city in the browser at http://localhost:5190/city (served by a
  vite.config.js plugin, dev only; `?t=`, `?traffic=`, `?notraffic`, `?nostream=1`, `?nofx=1`, `?profile=`), so the
  world layer can be seen and measured without the game repository.
- Canyon Run: the terrain splat shader skips fetches whose weight is provably zero (no dirt fetches on steep walls where
  the rock weight is exactly 1, no rock fetches where it is 0; output-neutral, 1 LSB in < 100 of 5.5 M pixels), moves the
  biplanar gradients out of the per-pixel branch (the old code computed them inside it from neighbours that skipped
  it: wrong mips along the wall foot, up to 17 / 255) and gains live detail uniforms (`uDetail` fades, projection
  cut): with the sample's defaults the terrain costs 4.2 ms instead of 7.7 at 3024x1964, pixel change mean <= 0.03 / 255.
- Textures: with little else to overlap, Canyon Run's end-to-end load is unchanged by the worker path (a fresh worker's
  cold JIT makes a layer ~2x slower off-thread); the city's 15-layer facade array keeps its main thread free for the
  rest of its build (15 ms instead of ~130 ms on the main thread).

First pass, 2026-10-27 (same branch; measured on the same M4, see ENGINE.md "Optimisation pass (2026-10-27)"):
- Perf: `bakeImpostors` box-filters the 2x supersampled cells on the GPU (alpha-weighted, one small readback per row)
  instead of on the CPU, and sizes the atlas to the rows its cells need (power of two) instead of the full square, so
  the dilate / mip post-processing and the texture memory scale with the model count. Canyon Run's 80-view bake:
  273-302 ms -> 137-148 ms on a fresh page load, 141 -> 64 ms warm (Apple M4); atlas texels within +-1 of the CPU
  filter. Phase times (context, render, downsample, post) are printed with the bake line and returned via `timing`.
- Perf: merged static meshes get a local origin. `chunkMesh` tiles (`chunkGeometry({ localOrigin })`, on by default
  in `chunkMesh`) and the city's building shells (`MapWorld`, after the plugin hooks; streamed tiles on attach) sit at
  their XZ centre with local vertices, so three.js's front-to-back sort of opaque objects orders them by distance
  instead of creation order (every merged mesh sat at the world origin: identical sort keys). World positions are
  unchanged (<= 0.06 mm, float32). Measured no difference on Apple GPUs (tile-based: opaque overdraw is already
  free); it is for immediate-mode GPUs. New helper `localizeMeshOrigin(mesh)`. Plugins that edit merged building
  geometry by world coordinates still run before the change (tiling step).
- Headless: `Atmosphere` accepts `renderer: null` (lights, sun direction, darkness; no PMREM / sky cube / horizon
  sampling / flare), so `MapWorld` builds in Node as documented; `bakeImpostors` returns null without WebGL instead
  of throwing into a warning. New `test/world-build.mjs` (run by `npm test` through `test/helpers/dom-shim.mjs`, a
  no-op canvas shim) builds the procedural city headless and pins its stats, colliders, physics queries, building
  origins and 10 s of deterministic traffic.
- Perf (bit-identical, content-hash checked): `paintCanvas` hands painters a reusable `[r, g, b]` (no per-texel
  array), `pnoise` without its per-call closure, the mip chain's colour-space branch hoisted out of the texel loop,
  `fillTransparent` / `dilateRGB` without a per-texel offsets array, procedural texture-array layers tiled as 32-bit
  texels. About 10 % on the procedural painters; a per-cell corner cache for `pnoise` and an octave-major cloud fBm
  measured no faster and were not kept.
- Canyon Run: terrain chunks placed at their chunk centre (same local-origin reasoning; physics and visuals unchanged).
- ENGINE.md: "Optimisation pass (2026-10-27)" - the method and the numbers behind the above, including where a
  2560x1440 frame of the sample goes and what did not help (depth pre-pass, draw order on Apple GPUs).

## 0.3.1 — 2026-10-21
- Standalone repository (`inbrowser-game-engine`): the Canyon Run sample, `test/car-sim.mjs` and ENGINE.md moved in
  from the game; `npm run dev` / `npm run build` serve and build the sample, `npm test` runs the physics checks.
  The game ([roadster](https://github.com/BrandeisPatrick/roadster)) embeds this repository as a submodule.

## 0.3.0 — 2026-10-19
- Physics: `VehicleController` is a sprung body — per-wheel spring / damper / anti-roll suspension with bump stops, body
  pitch and roll about the CG (`cgHeight`, `pitchInertia`, `rollInertia`, `suspensionDamping`, `antiRoll`), tyre-radius
  support sampling (kerbs are climbed over several steps), axle loads from the springs. New outputs `wheels[i].y`,
  `.contact`, `bottomed`, `flightArmed`.
- Physics: flight must be armed by a lift input (`flightArmThrust`); a crest jump is ballistic (`mode` stays `'ground'`,
  no hover assist). Step-height boxes are supports, not walls, for the body box. Moving boxes (`vx`, `vz`) shove with
  their velocity. `reset()` / `hold` fit the body to the ground plane (no first-step snap on a hill).
- Physics: `PhysicsWorld.fromWorld({ deckStep })` forwards a deck acceptance height to `world.getGroundHeight(x, z, y, step)`.
- World: `MapWorld.pavingLift` / `carriagewayAt` (exact asphalt ribbon +0.05 with end caps and an edge ramp, sidewalk
  slabs +0.17), `MapWorld.surfaceAt` + `SURFACES` (asphalt / paving / grass / ground / water), `ROAD_LIFT`,
  `SIDEWALK_LIFT`. `RoadNetwork` ground segments carry `ext: hw`.
- World: deck solver pins grounded ends to the ground with the grade a piece needs, and keeps decks 4.6 m above the
  streets they cross. Parked cars at an angle become three collider slices; signal poles never stand on a carriageway.
- Game: the Roadster's body mesh rides on the physical suspension; wheels follow their contact points. The Canyon Run
  buggy does the same.
- Dev: `dev/drive-sim.mjs` drives the car along 23 real streets headless and reports snaps, hops, flickers, impacts.

## 0.2.0 — 2026-10-18
- Fix: chase-camera shake used g-force with a 0.3 g baseline, so a car at rest (1 g) trembled at 6–15 Hz; now only load above 1.15 g shakes, at lower frequencies, default `shakeScale` 0.6 (0 disables).
- Fix: fixed-step judder — vehicles interpolate between physics steps (`alpha`); traffic is 'thin' for camera occlusion.
- Packaged as an npm workspace (`@vibe/engine`) with subpath exports per layer.
- World layer: `MapWorld` with plugin hooks, data contracts (city/terrain/farland JSON), parameterised bakers in `tools/`.
- KTX2/Basis texture pipeline (`tools/compress-textures.mjs`, `TextureSets` KTX2 path with JPG/procedural fallback).
- Traffic simulation core split for Worker execution; tile streaming (`TileStreamer`) around the camera.
- Physics: `PhysicsWorld` (static grid, heightfield, dynamic providers, raycast/sphereCast, surfaces), `VehicleController`
  spec object (`flight`, `airControl`, `normalClamp`, `hold`, per-wheel load), fixes found by the Canyon Run sample.
- Render: Atmosphere (sun/clouds/stars, 2-cascade shadows), PostFX (HDR, eye adaptation, GTAO, bloom, fog, grading),
  InstancedPool / LODGroup / ChunkCuller / Impostors / Decals / Particles, noise.
- Input (action maps, gamepad, touch), camera rigs (chase/orbit/free-fly with occlusion), audio bus + synth, UI widgets.

## 0.1.0 — 2026-10-17
- Core loop + profiler extracted from the Roadster flying-car game.
