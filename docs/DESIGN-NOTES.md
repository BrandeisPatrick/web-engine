# Design notes and measurements

This file keeps the history of `@vibe/engine`: design reasoning, measurements, changelog-style findings and the notes
about samples that no longer exist. It was split out of [ENGINE.md](../ENGINE.md) on 2026-11-13 (from commit
`d959298`) so that ENGINE.md describes only the engine as it is today. Everything below is copied verbatim from
ENGINE.md; only the `##` headings in *italics* above some blocks were added, to say where a block came from.

How to read it:
- Paths written `engine/src/...` and `engine/tools/...` are relative to a game that embedded the engine as `engine/`
  (the retired Roadster game). In this repository they are `src/...` and `tools/...`.
- The samples named here (`canyon-run`, `city`, `character`, `sandbox`) were removed; they are in git history at
  commit `fc73161` (for example `git show fc73161:samples/canyon-run/main.js`). The current demos are
  `samples/nyc-night/`, `samples/miami-drive/` and `samples/halloween/`.
- `dev/...` scripts (`dev/traffic-sim.mjs`, `dev/drive-sim.mjs`, ...) belonged to the Roadster game and are not in
  this repository.
- The numbers are left as they were measured, on the hardware and builds named next to them.


## *The original title, note and introduction of ENGINE.md* (ENGINE.md lines 1-28 at d959298)

# Browser game engine — `@vibe/engine` 1.0

> **Note (samples replaced, after 1.0):** the `canyon-run`, `city`, `character` and `sandbox` samples that the
> measurements and decisions below name were removed when the NYC night walk (`samples/nyc-night/`) and Miami drive
> (`samples/miami-drive/`) demos replaced them; they live in git history (`main` before the change: commit
> `fc73161`, e.g. `git show fc73161:samples/canyon-run/main.js`). The Roadster game repository is retired too, so its
> mentions below are history, not instructions. The measured numbers are left as they were taken. Quality tiers
> (`src/core/Quality.js`: `desktop` / `mobile`, `resolveQuality`, `QualityMenu` in `src/ui/`) are in `CHANGELOG.md`.

> Design notes, measurements and the record of decisions of `@vibe/engine` (repository `inbrowser-game-engine`): the
> browser game engine extracted from the Roadster flying-car game and grown, over the 0.5.0 - 1.0.0 phases, into a
> general engine. Paths written as `engine/src/...` in the older sections are relative to a game that embeds the
> engine as `engine/` (roadster does); here they are `src/...`. Sections by release: 0.5.0 "Core services",
> "Character stack", "Measurement protocol"; 0.6.0 "DynamicsWorld"; 0.7.0 and 0.8.0 "Render pipeline"; 0.9.0
> "Unified XPBD"; 1.0 "Rapier plug-in contract", "Packaging", "Measured (1.0)". `CHANGELOG.md` has the per-release
> lists.

Goal, reached with 1.0: a reusable, optimised engine for **browser games** (WebGL2 via Three.js, with data layouts a
WebGPU port can reuse), with first-class lighting and physics, usable for the driving game and for other genres: a
fixed-step core with services, a deterministic pure-JS physics stack (query hub, vehicle and character controllers, the
unified XPBD solver for rigid bodies, joints, particles, cloth, ropes, soft bodies, buoyancy and fracture), a measured
render pipeline (forward MSAA or G-buffer + TAA, clustered lights, cascades, SSR, volumetrics, water, lens passes, GPU
particles), animation (state machine, IK, ragdolls), input, camera rigs, synth audio, UI widgets and the data-driven
city world. Zero runtime dependencies beyond `three`; Rapier stays a possible plug-in behind the `DynamicsWorld`
contract ("Rapier plug-in contract"), KTX2 textures an optional loader.

Code lives in `src/` (one folder per layer, each a package subpath); games import `@vibe/engine` /
`@vibe/engine/<layer>`. The Roadster game is a thin consumer: map data, car tuning, HUD skin.

## *The original layer table (with what moved in from the Roadster game)* (ENGINE.md lines 30-44 at d959298)

## Layers (each folder is independently importable; lower layers never import higher ones)

Order: core < physics < render < anim / input / camera / audio / ui < world.

| Layer | Folder | What moves in from the game | New |
|---|---|---|---|
| core | `src/core` | fixed-step loop (120 Hz, max substeps), resize, adaptive pixel ratio (`main.js`) | `Engine` (renderer + scene + systems registry + render interpolation, `clock`), `Profiler` (CPU timers per system, GPU timer queries, `benchThroughput`), `Events`, `Clock`, `Entity` / `EntitySystem`, `Assets` (glTF with KTX2 / Draco / meshopt, textures, LUTs, HDR, audio), deterministic math (`MathDet`), the bench harness (`createBenchHarness`) |
| render | `src/render` | `Atmosphere` (sun / sky / clouds / fog / time of day), PostFX, shadow cascades, texture-set loader + canvas fallbacks (`TextureSets`), vegetation impostor baker, facade texture arrays | `PostFX` (Scene -> Exposure -> AO -> SSR -> Volumetric -> TAA -> MotionBlur -> DoF -> Bloom -> Final: GTAO, bloom, FXAA / 4x MSAA / TAA, filmic grade, 3D LUT), `GBuffer` + `CameraHistory`, `ClusteredLights`, 1-4 cascades with 'pcf' / 'fast' / 'pcss' kernels, `GpuParticleSystem`, `InstancedPool` + `LODGroup` + `Impostor` utilities, `MaterialPatches`, `DecalTrail`, pooled `ParticleSystem`, `ChunkCuller`, `PhysicsDebug`, `SoftMeshes` / `FractureMesh` |
| physics | `src/physics` | `VehicleController` (arcade-realistic, deterministic, Node-testable), AABB `ColliderGrid`, heightfield queries, OBB-vs-AABB SAT, sub-stepped sweeps | `PhysicsWorld` (query hub: static colliders, heightfield, dynamic providers, raycast / spherecast), `CharacterController` (kinematic capsule; pushes and rides `DynamicsWorld` bodies), `DynamicsWorld` (`dynamics/`: unified XPBD rigid bodies, joints, particles, cloth, ropes, soft bodies, coupling, buoyancy, fracture) and its `DynamicsClient` worker |
| world | `engine/src/world` | **extracted**: terrain heightfield + draping, map data + procedural fallback, road network, building builder + facade layers, props / furniture / vehicle library, vegetation, traffic AI, water / shore / boats / far relief; bakers in `engine/tools` (the Bay Bridge and the landmarks stay in the game as MapWorld plugins) | `MapWorld` (options + plugin hooks), data contracts for city / terrain / farland JSON, parameterised bakers; `TileStreamer` (building tiles built / freed around the camera, see "Streaming"); traffic AI in a Web Worker (`TrafficSim` core, see "Traffic simulation") |
| anim | `src/anim` | — | `AnimationController` (state machine + 1D blend trees + transitions + root motion over `AnimationMixer`), `TwoBoneIK`, `CCDIK`, `Ragdoll` (skeleton -> capsules + joints on the dynamics world, 0.9.0) |
| input | `src/input` | `Input.js` (keyboard / gamepad, analog smoothing, edge flags) | `InputMap` (action maps, contexts, rebinding, `alwaysOn`), `VehicleInput`, `CharacterInput`, `PointerLock` |
| camera | `src/camera` | `ChaseCamera` (modes, occlusion avoidance) | `CameraRig` base + `CameraCollision`, `ChaseRig`, `OrbitRig`, `FreeFlyRig`, `ThirdPersonRig`, `FirstPersonRig` |
| audio | `src/audio` | WebAudio synth bus (`Audio.js`) | `AudioBus` (mixer, positional emitters, synth voices), `SamplePlayer` (decoded samples) |
| ui | `engine/src/ui` | HUD widgets (gauges, minimap, flash, attitude indicator) | DOM widget kit, theme |

## *From "Render pipeline (0.7.0)": the measurements* (ENGINE.md lines 128-179 at d959298)

### Measured (0.7.0, Apple M4, the app's Chromium, `bench/results/2026-10-29-125*-*-p3-*.json`)
Same-page A/B through `run(plan)`, 24 GPU-synchronised frames per cell after 3 warm-up frames; cross-load diffs
(cascades) against a fresh load of the default page. Canyon Run poses straight / chase / aerial / ahead. The sample
caps MSAA at 4 Mpx, so the default is FXAA at 3024x1964 and 4x MSAA at 2560x1440: that is why the G-buffer path,
which cannot use MSAA, is *cheaper* than the default at the smaller size (the Apple-GPU MSAA resolve costs more
than the extra attachments) and dearer at the larger one.

| setting (3024x1964) | ms | pixel change vs default (mean of 0..255) |
|---|---|---|
| forward, FXAA, 'fast' shadows, 2 cascades (default) | 8.25 / 8.62 / 8.80 / 5.60 | — |
| G-buffer + FXAA | 8.54 / 8.94 / 9.25 / 5.78 | 0 (colour attachment identical) |
| G-buffer + TAA (defaults) | 10.65 / 11.09 / 11.38 / 7.83 | 0.31-0.36 (edges; 2.4-2.6 % of pixels > 2) |
| kernel 'pcf' (three's 17 taps) | 9.91 / 10.67 / 10.90 / 6.51 | 0.002-0.012 |
| kernel 'pcss' | 9.12 / 9.58 / 10.51 / 6.15 | 0.002-0.018 (contact-hardening penumbrae) |
| 3 cascades ('fast') | 8.45 / 8.93 / 9.25 / 5.75 | 0.004 / 0.007 / 0.003 / 0.014 |
| 4 cascades ('fast') | 8.58 / 9.07 / 9.69 / 5.85 | 0.004 / 0.009 / 0.006 / 0.017 |

| setting (2560x1440) | ms | pixel change vs default |
|---|---|---|
| forward, 4x MSAA (default) | 7.54 / 7.55 / 8.69 / 5.27 | — |
| G-buffer + FXAA | 6.00 / 6.37 / 6.98 / 4.09 | 0.32-0.39 (FXAA vs MSAA) |
| G-buffer + TAA | 7.33 / 7.73 / 8.27 / 5.46 | 0.22-0.31 |
| kernel 'pcf' / 'pcss' | 8.41 / 9.02 / 10.45 / 6.05 and 7.58 / 8.00 / 9.27 / 5.42 | 0.002-0.011 / 0.002-0.020 |
| 3 / 4 cascades | 7.37 / 7.74 / 8.96 / 5.30 and 7.42 / 7.79 / 9.41 / 5.41 | 0.003-0.012 / 0.005-0.014 |

The TAA pass costs 2.1-2.3 ms at 3024x1964 over G-buffer + FXAA and is bound by full-screen texture reads
(RGBA16F history in and out, colour 3x3, depth, velocity, flags), not arithmetic. Measured knobs (`taa.*`, all
off by default, `p3-taa-variants.json`): `reject: 'early'` ±0.0 ms (0.001-0.003 mean), `snap` -0.15 ms on static
poses (≤ 0.003), `velocityFirst` 0 on static poses (velocity is 0 there), `reject: 'single'` -0.05 ms
(≤ 0.005), `stableDepth: true` +0.13 ms (0.005), `filter: 'bilinear'` -0.25 ms, `historyFormat: 'r11g11b10'`
-0.58 ms but a 0.38-0.68 mean fixed bias (the 10 % per-frame update is below its mantissa), so RGBA16F stays.

Temporal upscaling (`renderScale` < 1, TAA only): the scene and the passes before TAA run at the drawing buffer x s,
the TAA resolve upscales (TAAPass "Upscaling"). City demos, desktop poses at 2268x1473, converged captures against
scale 1: s 0.87 saves 1.0-1.4 ms, 0.8 1.6-2.3 ms, 0.75 1.9-2.9 ms (miami beach about half), sharpness 96-99 % of
scale 1 (a bilinear upscale of a native 0.75 frame: 50-60 %), but the perf image guard is exceeded on nyc-night's square and
sidewalk at every scale (0.38 / 0.53 mean / 255 at 0.87: lower-resolution shading of wet-road sparkle, the LED billboard and
foliage, not the resolve) and the per-pixel flicker at rest is 8-64 % higher than at scale 1. So the demos stay at
1; `postfx.set('renderScale', s)` is there to try.

City at night (`?clustered&t=night`, 698 lamps in the map; 27 within 220 m of the `high` pose, 15 of them in the
frustum's clusters), poses street / crossing / high: 8-light pool 11.12 / 11.46 / 11.29 ms, every lamp clustered 11.69 / 12.43 / 11.28
(0.97-2.27 mean: the whole street is lit), clustered + G-buffer + TAA 14.70 / 15.49 / 14.80; at 2560x1440 (MSAA
default) 8.26 / 8.18 / 8.02, 8.23 / 8.83 / 7.94 and 10.13 / 10.82 / 10.06. Character (idle / run / aerial):
forward 5.45 / 5.03 / 4.70 at 3024x1964, G-buffer + FXAA 5.02 / 5.19 / 4.70 (identical), G-buffer + TAA 7.09 /
7.28 / 6.86; at 2560x1440 4.95 / 4.72 / 4.44 (MSAA), 3.50 / 3.69 / 3.26 and 4.84 / 4.92 / 4.71. Sandbox stack
(overview / close, `?gbuffer=1` so the body pools carry per-instance velocity): 5.21 / 5.52, 4.87 / 5.30
(identical), 6.98 / 7.38 at 3024x1964; 4.61 / 5.18 (MSAA), 3.32 / 3.68, 4.62 / 4.97 at 2560x1440. GPU particles:
65k live with 4096 spawns per frame cost 0.2 ms of CPU in headless Chrome (author's measurement; the Canyon Run
devils switch in 0.8.0). TAA captures are not bit-stable across frames by construction (0.3 % of pixels move
> 2 / 255 per frame), so TAA gates use `meanAbs` on converged frames (`quiet` resets the history and renders 32
frames).

## *From "Render pipeline (0.8.0)": the samples bullet* (ENGINE.md lines 236-240 at d959298)

- **Samples**: every sample takes `?ssr=1&volumetric=1&motionblur=<s>&dof=1&lut=warm&aonormals=gbuffer`
  (`samples/shared/fx-flags.js`, harness settings `postfx.<path>` for every knob); Canyon Run `?lamps=1` (118
  trackside lamps on `ClusteredLights`, poses `night-lamps`), `?gpuparticles=1[&devilscollide=1]` (the dust devils
  on `GpuParticleSystem`, seeded, pose `devils`); the city `?water=refraction` and a `shore` pose; `npm run smoke`
  adds the `canyon-night` and `city-water` pages.

## *From "Render pipeline (0.8.0)": the measurements* (ENGINE.md lines 242-294 at d959298)

### Measured (0.8.0, Apple M4, the app's Chromium, `bench/results/2026-10-29-15*-*-p4-*.json`)
Same-page A/B through `run(plan)` (24 GPU-synchronised frames after 3 warm-up frames per cell, every knob restored
between settings), pixel change = `meanAbs` against the reference setting on 4x4 box sums (0..255). Canyon Run poses
straight / chase / aerial / ahead on the G-buffer + TAA page (`?gbuffer=1`): the reference is 10.60 / 11.08 / 11.35
/ 7.80 ms at 3024x1964 and 7.27 / 7.56 / 8.17 / 5.32 ms at 2560x1440 (the 0.7.0 numbers within noise).

| knob (Canyon Run, G-buffer + TAA) | +ms at 3024x1964 | +ms at 2560x1440 | pixel change |
|---|---|---|---|
| `ssr` (scale 0.5, 24 steps, maxRoughness 0.5) | 0.55 / 0.51 / 0.54 / 0.49 | 0.37 / 0.34 / 0.35 / 0.33 | 0.001 / 0.007 / 0 / 0 (nothing glossy in view) |
| `ssr.scale` 0.25; `steps` 16; `steps` 32 + `refine` 6 | -0.08; +0.02; +0.03 | -0.07; -0.03; -0.01 | same |
| `ssr.maxRoughness` 0.7 | 0.00 | 0.00 | 0.03 / 1.24 / 0.002 / 0 (the gantry's roughness-0.5 paint reflects) |
| `volumetric` (scale 0.25, 16 steps) | 0.58 / 0.44 / 0.62 / 0.75 | 0.45 / 0.34 / 0.43 / 0.52 | 0.16 / 0.013 / 0.035 / 0.15 |
| `volumetric.scale` 0.5; `steps` 32; `steps` 8 | +1.45 / +1.06 / +1.53 / +1.90; +0.84 / +0.60 / +0.87 / +1.12; +0.45 / +0.36 / +0.47 / +0.55 | +0.95 / +0.69 / +1.02 / +1.30; +0.57 / +0.45 / +0.60 / +0.79; +0.33 / +0.24 / +0.31 / +0.38 | identical to 3 decimals (the medium converges at 8 steps on these poses) |
| `motionBlur` 1 (static pose: exact pass-through) | 2.08 / 2.09 / 2.12 / 1.98 | 1.35 / 1.34 / 1.37 / 1.26 | 0 |
| `motionBlur.samples` 16 | same (the static early-out) | same | 0 |
| `dof` (12 m, f/2, scale 0.5, 24 taps) | 2.69 / 2.65 / 2.64 / 2.60 | 1.72 / 1.68 / 1.71 / 1.67 | 1.68 / 0.70 / 1.17 / 1.02 |
| `dof.scale` 1; `samples` 16; `nearBlur` false | +6.25 / +6.32 / +6.20 / +6.16; -0.13; -0.62 / -0.65 / -0.50 / -0.46 | +4.01 / +3.93 / +3.91 / +3.89; -0.09; -0.41 / -0.45 / -0.33 / -0.33 | 1.56 / 0.58 / 1.13 / 0.97; 1.65 / 0.69 / 1.16 / 1.01; 1.63 / 0.70 / 1.17 / 1.02 |
| `lut` (warm.cube, 16^3) | 0.04 / -0.03 / 0.04 / 0.04 | 0.03 / 0.01 / 0.00 / 0.02 | 8.1 / 7.6 / 7.6 / 8.7 (the grade) |
| `ao.normals: 'gbuffer'` | 0.09 / 0.07 / 0.09 / 0.08 | 0.05 / 0.07 / 0.08 / 0.04 | 0.020 / 0.022 / 0.001 / 0.010 |
| all of the above on | 6.00 / 5.92 / 6.06 / 6.05 | 3.83 / 3.77 / 3.86 / 3.85 | 9.4 / 8.1 / 8.2 / 9.4 |

Forward path (no G-buffer; FXAA at 3024x1964, 4x MSAA at 2560x1440; reference 8.50 / 8.59 / 8.80 / 5.55 and 7.42 /
7.56 / 8.63 / 5.23 ms): `volumetric` +0.32 / +0.51 / +0.60 / +0.81 and +0.14 / +0.24 / +0.36 / +0.54 (scale 0.5:
+1.19 / +1.13 / +1.53 / +2.02 and +0.68 / +0.64 / +1.03 / +1.30), `dof` +2.18 / +2.52 / +2.35 / +2.46 and +1.30 /
+1.58 / +1.52 / +1.48, `lut` 0, all three +2.83 / +3.07 / +3.11 / +3.27 and +1.78 / +1.83 / +1.94 / +2.08.
The lens passes are bandwidth: motion blur always pays its full-resolution velocity + tile passes and the
reconstruction's two reads (2.0 ms at 5.9 Mpx even when every pixel early-outs), DoF its prefilter + two
half-resolution gathers + composite (2.6 ms; `scale` 1 triples the gathers). SSR and volumetrics are cheap on these
scenes because most pixels early-out (rough surfaces, shadowed air) and the march runs at a quarter / sixteenth of
the pixels; `steps` barely moves either.

Canyon Run at night (`?lamps=1&t=night`, 118 clustered lamps, 12 in the `night-lamps` view, forward path): lamps off
8.01 / 8.72 / 8.35 ms (night-lamps / chase / straight) -> on 8.28 / 9.14 / 8.85 at 3024x1964 (5.73 / 6.24 / 5.89 ->
5.74 / 6.40 / 6.24 at 2560x1440); pixel change 24.5 / 18.1 / 28.6 (the track is lit). The `devils` pose on
`GpuParticleSystem` renders at 8.74 ms (3024x1964, 90 live particles, frozen between captures; the per-frame
compute cost is the 0.7.0 author's 0.2 ms CPU figure, not re-measured here).

City (`?notraffic&nostream=1`): water refraction on the G-buffer + FXAA page, poses shore / street: off 8.08 / 10.16
ms -> on 8.80 / 10.75 at 3024x1964 (5.82 / 7.52 -> 6.29 / 7.89 at 2560x1440), pixel change 0.026 / 0 (open water is
full murk; the effect lives along walls and piers); the copy's own size hardly matters (`copyScale` 0.25: +0.59 /
+0.45, 1.0: +1.29 / +1.09; `copyClear` false: same as default): the cost is the mid-frame target switch, and it is
paid whenever the bay draws (it is never frustum-culled), water in view or not. G-buffer + TAA page, poses shore /
street / high (reference 10.11 / 12.55 / 13.00 and 7.11 / 9.13 / 9.24 ms): `ssr` +1.58 / +0.49 / +0.79 and +0.85 /
+0.36 / +0.45 (pixel change 1.44 / 0.10 / 0.48: the bay mirrors the warehouse and the piers), `volumetric` +0.94 /
+0.35 / +0.45 and +0.65 / +0.21 / +0.28, `dof` +2.63 / +2.67 / +2.67 and +1.70 / +1.68 / +1.66, `motionBlur` +2.00 /
+2.08 / +2.11 and +1.28 / +1.28 / +1.25, `ao.normals: 'gbuffer'` +0.06 / +0.03 / +0.18 and +0.06 / +0.02 / 0.00
(pixel change 0.29 / 1.31 / 0.19: the normal-mapped facades), all on +7.28 / +5.98 / +6.21 and +4.57 / +3.73 /
+4.00. Character (idle / run / aerial, G-buffer + TAA, 7.08 / 7.07 / 6.73 and 4.82 / 4.86 / 4.55 ms): `ssr` +0.52
(0 change: nothing glossy), `volumetric` +0.49 / +0.56 / +0.56 and +0.32 / +0.37 / +0.37 (0.80 / 0.75 / 0.14: the
shafts through the playground), `motionBlur` +2.02, `dof` +2.65 / +2.68 / +2.62 and +1.69, `lut` 0, all on +5.85 and
+3.74 / +3.75 / +3.83. Sandbox stack (overview / close, 6.93 / 7.32 and 4.61 / 4.95 ms): `ssr` +0.52 / +0.48 (0),
`volumetric` +0.50 / +0.47, `motionBlur` +2.06 / +2.03, `dof` +2.58 / +2.66, all on +5.85 / +5.80 and +3.73 / +3.73.
Defaults unchanged by these numbers: nothing is cheap enough to turn on for free, and every pass is a look choice.

## *From "DynamicsWorld (0.6.0)": the sandbox measurement* (ENGINE.md lines 349-354 at d959298)

Measured (Apple M4, Chrome, `samples/sandbox`): a 10-box stack is stable for 10 s with 3e-15 m drift; 1000 mixed
bodies dropped into a pit step at 6.5 ms while falling and 9.5 ms with 960 still awake after 14 s at 60 Hz (mixed
shapes keep rolling; the all-box pit in `test/dyn-world.mjs` sleeps in 9 s) in-thread, or 10.7 ms in the worker
with 0.5 ms of main-thread time; 5 ragdolls (11 capsules, 10 joints each) settle and sleep within 17 s. The
sandbox's bench poses reset the scene and hand-step a fixed number of steps, so their captures reproduce across
page loads (stack overview / close hashes equal on every load).

## *From "Unified XPBD (0.9.0)": the samples bullet* (ENGINE.md lines 399-403 at d959298)

- **Samples**: sandbox scenes `cloth`, `rope`, `soft`, `buoyancy` (a pool with the world's Gerstner surface),
  `destructible` (`render/SoftMeshes.js`: `ClothMesh`, `RopeMesh`, `SoftBodyMesh`, `ParticleMesh`; `ClothMesh`'s
  opt-in `subdivide: k` draws a k x finer Catmull-Rom grid through the particles: smooth folds from a coarse cloth);
  the character pushes crates, rides an elevator, ragdolls on a hard fall (or K) and mantles ledges with planted
  hands (poses `push`, `ragdoll`); `npm run smoke` adds the five sandbox pages.

## *From "Unified XPBD (0.9.0)": the measurements* (ENGINE.md lines 410-431 at d959298)

#### Measured (0.9.0, Node 26 on the Apple M4, the same V8 as the app's Chromium; `bench/results/2026-10-29-1734-node-p5-dynamics.json`)
ms per 1/120 s step at 4 substeps and 1 position iteration (240 timed steps after 60 warm-up steps):

| scene | ms / step | what |
|---|---|---|
| cloth 32x32 + collider | 0.40 | 1024 particles, 8 648 constraints, falling onto the ground |
| cloth 64x64 + collider | 1.63 | 4096 particles, 35 720 constraints |
| 1000 bodies pit + 200 rope particles | 3.23 | the 0.6.0 pit (box / sphere / capsule) with ten 20-segment ropes over it, ~2 400 contacts |
| soft cubes 6^3 x 2 + 8^3 + collider | 0.89 | 1 415 particles, 7 892 constraints (edges + tets) |
| buoyancy, 200 boxes on a wave | 1.93 | 8^3 sample points per shape, a sine `heightAt` (80 k calls / step dominate) |
| fractured wall, 40 pieces glued at rest | 3.29 | 141 FIXED glue joints solved as one joint tree (LDL^T) |
| the same wall after the hit | 3.09 | pieces freed, joints removed as they break |

The sandbox scenes in the app (1280x720): cloth 0.70 ms / step, soft 0.68, rope 0.05, buoyancy 0.03, destructible 3.9
at 120 Hz (two steps per frame). The glue tree is the expensive part of fracture: a glued wall costs as much as
1000 loose bodies; broken joints are removed so the cost falls as it shatters.
What the destructible scene shows is honest about the solver: the hit opens a hole and throws a few pieces (3 on
the scene's hand-picked cut pattern, 0-2 on most seeds), while 90-98 % of the wall stays glued; a full collapse
needs continuous collision (a 20 m/s ball first contacts 12 cm deep at 1/120 s) and a softer contact model, both
1.0+ items. The rolling-contact fix (anchors of a body whose top-level shape is a sphere or a capsule are re-seated
on the surface every substep; compounds keep material anchors) changes every scene with rolling spheres / capsules
(the sandbox stack ball's captures moved at 1280x720), car-sim and world-build pins are untouched.

## *From "World layer": the Roadster defaults sentence* (ENGINE.md lines 516-517 at d959298)

All game rules default to neutral behaviour (generic cobra lamps, per-class tree mixes, no ferries / ship / cranes,
a blue-striped bus, 0.4 pre-war share); Roadster passes its San Francisco values from `src/world/World.js`.

## *From "World layer": the Roadster plugin examples* (ENGINE.md lines 527-530 at d959298)

traffic is built next). `clearZones()` -> bake-frame circles kept free of filler lots; `chunk(world)` ->
`[{ mesh, cell }]` tiled in the final MeshChunker pass; `update` runs after the props and before traffic. Roadster:
`bayBridgePlugin()` (src/world/bridge.js: afterProps + chunk + update) and `landmarksPlugin()` (src/world/landmarks.js:
beforeBuildings + afterBuildings + clearZones + update).

## *The "Streaming" section as written for the Roadster game (ENGINE.md keeps a current version)* (ENGINE.md lines 546-579 at d959298)

## Streaming (building tiles, `engine/src/world/TileStreamer.js`)
`MapWorld` builds the city's building geometry per tile around the camera instead of all at load (default with a
renderer; `streaming: false` or `?nostream=1` = the full build, kept for A/B and used headless).
- **Global at load** (unchanged): map data, terrain + ground, road network + lane graph, water / far land, props +
  vegetation, landmark / bridge plugins, traffic, and every building's footprint + colliders (`BuildingBuilder.footprint`
  gives exactly what `add()` builds on; the 306 k collider boxes are identical to the full build).
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
  the rest streams in during the first seconds of play. Plugin hooks see only those tiles: Roadster pins the tiles of
  the tall OSM blocks beside the Bay Bridge deck (`streaming.pin` in src/world/World.js), which `bridge.js` collapses
  in the merged geometry (verified: 188 vertices / 18 colliders hidden, as before).
- **Scratch buffers** of tile builds are pooled (`TileBuildingBuilder`, up to 4) while tiles stream and handed back to the
  GC after 5 s without streaming work: the flight's heap peak fell from 885 to 627 MB with the pool.
- Not streamed, by measurement: street furniture / parked cars (placement registers colliders and is order dependent;
  the batched meshes hold 4.9 MB and are already culled per instance), vegetation (near models are already a
  camera-partitioned instanced subset of 4k trees; 0.6 s of the 0.7 s "Street furniture" phase is the atlas + impostor
  bake, which is global), sidewalks / structures (the bridge plugin edits that merged mesh, and it carries the decks seen
  from km away), the outer context lots (one 0.3 MB instanced mesh).

## *From "Streaming": the measurements* (ENGINE.md lines 581-610 at d959298)

**Measured** (main game, M4 / headless Chrome 155 at 1280x800, static build, golden hour; "before" = the tree before
this change, 3 loads each; settled = 8 s after the first frame, after a forced GC):

| | before | streaming (default) | `?nostream=1` |
|---|---|---|---|
| `world.stats.loadMs` | 3031 | 2635 | 2861 |
| time to first frame (navigation -> first engine frame) | 3902 ms | 3486 ms | 3738 ms |
| "Buildings" load phase | 543 ms | 175 ms (19 tiles + footprints / colliders of all 5263) | 379 ms |
| peak JS heap during load | 1131 MB | 889 MB | 1079 MB |
| JS heap at the spawn, settled | 559 MB | 526 MB | 554 MB |
| scene geometry (unique attribute + index bytes) at the spawn | 199 MB | 168 MB (district 40/42 tiles, detail 45/147 cells) | 199 MB |
| renderer geometries at the first frame / settled | 311 / 311 | 318 / 364 | 311 / 311 |

Scripted 60 s runs (camera only; car parked at the spawn; 4 s warm-up at the start pose, then measured; CPU ms per
`engine.tick`):

| | drive (2.4 km of streets at 40 m/s, 2.2 m eye height) | flight (3.6 km at 300 m, 60 m/s) |
|---|---|---|
| frame CPU mean / p99 / max, before | 2.83 / 3.9 / 201.4 ms (one 200 ms hitch at the same spot every run: 10-200 ms) | 2.95 / 3.9 / 4.7 ms |
| frame CPU mean / p99 / max, streaming | 2.57 / 3.9 / 9.8 ms (max - mean 7.2 ms: the same spot, not streaming) | 2.58 / 5.2 / 6.1 ms (max - mean 3.5) |
| streaming work per frame (mean / max) | 0.03 / 3.4 ms; 148 builds, 79 frees | 0.07 / 3.4 ms; 204 builds, 135 frees |
| frames > 8 ms above the mean / frame gaps > 18.9 ms | 0 / 0 | 0 / 0 |
| nearest distance a new tile appeared / late near detail | 992 m / 0 of 34 | none appeared (all resident from 300 m) / 0 of 88 |
| scene geometry at the end, before -> streaming | 199 -> 136 MB | 199 -> 169 MB |
| JS heap after GC at the end, before -> streaming (peak during the run) | 556 -> 495 MB (593 -> 596) | 555 -> 528 MB (862 -> 627) |

Fixed-pose A/B frames (no post-FX, traffic / boats / car hidden, fixed clock; base == base is bit-identical):
spawn street, a street 600 m west, an oblique district view, the 300 m flight view, the skyline from the bay and a
far district corner are pixel-identical to the full build except 0.01 % of the pixels of the flight view (coplanar
roof / shell faces now in different tile meshes, so their draw order differs); `?nostream=1` is bit-identical.

## *The "Traffic simulation" section as written for the Roadster game (ENGINE.md keeps a current version)* (ENGINE.md lines 612-635 at d959298)

## Traffic simulation (`TrafficSim.js` core, `traffic.worker.js`, `Traffic.js` presenter)
- **Split.** `TrafficSim` = lane graph build + per-step AI, THREE math only (runs in Node: `dev/traffic-sim.mjs`
  imports it directly). `Traffic` = main-thread presenter: instanced meshes (tiered per shadow cascade), headlight
  beams, material uniforms, `queryColliders`, `setPlayer` / `setCamera`, `count`, `typeNames`, `pose(i)`.
- **Ground heights are baked** into the lane graph at build time: every lane and junction connector is sampled every
  1.5 m with `world.getGroundHeight(x, z, yRef)` walked along the lane as a vehicle queried it (bridge lanes follow
  their deck profile, ground lanes ignore decks overhead), then kept at 3 / 6 m spacing where the street is evenly
  graded (161 k floats = 0.65 MB with the real terrain). Vehicles interpolate it at their axles (y = mean, pitch from
  the difference). Measured against the live query every 0.5 m (809 k points, real terrain): p99 1.2 cm, p99.9 3.2 cm, 99.98 % within 10 cm; the
  rest sit on discontinuities of the live surface (deck seams / gaps, a water patch under a filler street), which the
  bake bridges and the old per-vehicle query jumped across. Bake: 48 ms in the browser (dev/traffic.html: H).
- **Worker** (`traffic: { worker }`, default when module Workers exist and no `?noworker=1`; Node: in-thread). The
  main thread builds the same sim (graph + bake + initial spawn: the fallback, and what dev tools read), posts the
  road data + baked heights; the worker rebuilds the identical graph (checked: max initial pose difference 0). Per
  frame ONE message each way: main -> worker `{ dt, camera position + view-projection, player footprint, the 169
  signal phases the bulbs show (copied from Props.signals[].state, so lights and AI always agree), returned pose
  buffers }` (297 B + the buffer, transferred); worker -> main a transferable `Float32Array` of poses (9 floats x 250
  = 9 kB: x, y, z, yaw, pitch, brake, speed, yaw rate, flags), double-buffered. Respawns / recycling stay in the
  worker. The presenter draws the newest snapshot extrapolated to the current frame (speed + yaw rate; one frame when
  on time, more if a snapshot is late), and `queryColliders` answers from that snapshot with the same oriented AABB
  slices (computed lazily per touched vehicle). The player's hard rule (never into its box, stop 5 m behind) uses
  the pose of the frame the step belongs to, exactly as in-thread. If the worker fails to start / answer within 5 s
  the in-thread sim takes over (logged once). Vite bundles the worker (`new Worker(new URL('./traffic.worker.js',
  import.meta.url), { type: 'module' })`, 88 kB).

## *From "Traffic simulation": the measurements and behaviour checks* (ENGINE.md lines 637-653 at d959298)

**Measured** (same setup, car parked at the spawn, 10 s sampled at 50 us + a direct timer around `Traffic.update`;
per frame):

| | before | worker (default) | `?noworker=1` |
|---|---|---|---|
| main thread: `Traffic.update` | 0.55 ms | 0.077 ms | 0.49 ms |
| main thread: `queryColliders` (3 queries / frame from the car physics) | 0.007 ms | 0.010 ms | 0.007 ms |
| worker step (in the worker) | - | 0.37-0.62 ms | - |
| messages / frame | - | 1 out (297 B + returned buffer) + 1 back (9 kB, transferred) | - |
| late snapshots / 4253 | - | 0 | - |
| presented position second difference p50 / p99 (jitter) | - | 0.78 / 3.99 mm | 0.69 / 3.78 mm |
| traffic build on the main thread at load (graph + bake + spawn) | 115 ms | 158 ms (worker rebuilds in parallel: 107 ms) | 158 ms |

Behaviour checks: `node dev/traffic-sim.mjs 60 250` reproduces the old run exactly (93 respawns, 19.8 km/h, 456
junction entries at signals, 0 on red, 0 vehicle overlaps; `PLAYER=1`: 0 overlaps with the player, 1.50 m minimum
clearance); in the game (worker mode, 40 s) no vehicle ever overlapped the parked car, one queued 4.95 m behind it and
0 of 318 signal entries were on red. `?noworker=1` / a worker that throws or fails its build fall back with one warning.

## Optimisation plan (measured, not guessed)
1. Profiler first: CPU per system, GPU per pass; stats overlay (`F3`), `?profile=1` dumps a table after 10 s.
2. Render: merged static chunks with frustum + distance culling, `BatchedMesh`/`InstancedMesh` everywhere, impostors beyond LOD distance, texture arrays to cut draw calls, KTX2/Basis compression of the PBR sets (done: see "Textures" below), shadow cascade budget, half-res post passes, adaptive resolution with a frame-time controller.
3. Simulation: traffic AI in a Worker with transferable pose buffers (done: "Traffic simulation"); vegetation LOD partitioning stays on the main thread (a ~4k-tree distance pass every 20 m of camera travel); spatial hashes reused per frame; zero per-frame allocation policy enforced with an allocation counter in dev.
4. Loading: building tiles streamed around the camera, only the spawn neighbourhood at load (done: "Streaming"), texture packing in parallel with map parsing, cached bakes.
5. Budgets (M-series Mac, 1500×1300): ≤ 12 ms frame by day, ≤ 15 ms at night, ≤ 200 draw calls, ≤ 3 M triangles, load ≤ 4 s.

## Migration steps
1. Core + profiler (new, no game changes) → game loop switched to `Engine` once the post-FX agent lands.
2. Physics: move `Physics.js` + `spatial.js` into `engine/src/physics`, expose `PhysicsWorld`; game keeps `Car.js` as the visual wrapper.
3. Render: move `sky.js`, PostFX, `textures.js` loader, impostor baker; add `InstancedPool`/`LODGroup`.
4. World: move terrain/roads/buildings/props/traffic/water behind a `MapWorld` system; bakers into `engine/tools`. **Done**
   (src/world/World.js is a ~120-line SF composition; screenshots and sims identical).
5. Input/camera/audio/ui moved as-is with small API cleanups.
6. Second game sample (e.g. a drone or a boat on the same map, or a small procedural track) to prove generality.

## *The "Textures" section as written for the Roadster game (ENGINE.md keeps a current version)* (ENGINE.md lines 671-734 at d959298)

## Textures (PBR sets, KTX2)
`engine/src/render/TextureSets.js` loads the CC0 photo sets listed in `textures/manifest.json` (fetched by
`engine/tools/fetch-textures.mjs`, 21 Poly Haven sets at 1K: `diff` / `nor_gl` / `rough` / `ao` JPGs) through two paths,
both with procedural fallbacks so nothing ever fails:
- `loadTextureSet(id, { renderer, manifest })` -> plain textures for `MeshStandardMaterial` slots (MapWorld's road,
  sidewalk, grass ground sets);
- `makeTextureArray(renderer, sets)` -> two RGBA8 `DataArrayTexture`s packed per texel (A: sRGB albedo + AO in alpha,
  tintable layers normalised to a neutral mean; N: normal xy + roughness in b) for shaders that index a layer
  (building facades, Canyon Run terrain / course / props).

**KTX2 / Basis Universal.** `engine/tools/compress-textures.mjs` (`npm run textures:compress`) writes a `.ktx2` twin
next to every JPG and records it in the manifest (`ktx2Maps`; JPGs stay as the fallback):

| Map | Codec | Notes |
|---|---|---|
| `diff` | ETC1S (BasisLZ), quality 160, sRGB | 0.27x the JPG bytes; mean PSNR 33 dB vs the JPG (noisy grass / mud / asphalt 25-27 dB, fine in game) |
| `nor_gl` | UASTC LDR 4x4 + Zstandard, linear, normal-map preset, renormalised mips | 1.36x the JPG bytes (ETC1S normals are visibly blocky); 38.6 dB |
| `rough`, `ao` | ETC1S, linear | ~0.3x the JPG bytes; 41.7 / 35.2 dB |

Every file has a full mip chain generated with wrap addressing (the sets tile) and is Y-flipped at encode time
(`KTXorientation: ru`), so a `CompressedTexture` (which cannot be flipped on upload) matches a JPG uploaded with
`flipY`. All 21 sets: 50.96 MB of JPG -> 33.76 MB of KTX2, 84 maps in 28 s wall (209 s CPU) on 8 worker threads (Apple M4).
Encoder: the official Basis Universal 2.50 encoder compiled to WASM, from the `ktx2-encoder` npm package (MIT wrapper,
Apache-2.0 Basis Universal; no `toktx` / `basisu` binary needed), driven through its low-level `BasisEncoder` API so
mip filtering, sRGB, Y flip, normal-map preset and Zstandard can be set per map; `jpeg-js` decodes the JPGs and
`ktx-parse` writes the orientation key. These three are devDependencies of the game; the runtime needs none of them.
`--uastc id/map` promotes one map to UASTC (~6x the ETC1S bytes, 42-52 dB) if ETC1S artefacts ever show; `--etc1s nor_gl`
does the opposite. The transcoder (`basis_transcoder.js` / `.wasm`, the version three's `KTX2Loader` expects) is copied
from `three/examples/jsm/libs/basis` to `public/basis/` by the same tool (`npm run textures:basis`, also `prebuild`).

**Loader.** `loadTextureSet` uses one shared `KTX2Loader` (`setTranscoderPath(basisPath())`, `detectSupport(renderer)`)
when the GPU has a compressed format: UASTC -> ASTC 4x4 (Apple / mobile) or BC7 (desktop), ETC1S -> BC7 / ETC2 / BC1
(three's priority order). Albedo sRGB, data linear, repeat wrap, max anisotropy. Downloads start before the transcoder
is ready; a missing / non-WASM transcoder, a missing / corrupt `.ktx2` or a 20 s transcode timeout falls back to the JPG
for that map. Without a compressed format (the transcoder would produce RGBA8) it uses the JPG directly.
`makeTextureArray` keeps its RGBA8 arrays: layers pack channels from several maps and tintable albedos are rescaled on
the CPU, neither of which can be done to compressed blocks, and a `CompressedArrayTexture` would also need every layer
(including the procedural plain / fabric facade layers) in one transcoded format. So it transcodes `.ktx2` to RGBA8 in
a small worker pool of its own (layer order first, workers retire after 10 s idle) and packs exactly as before; per map
it takes whichever of `.ktx2` / `.jpg` is smaller (`TextureSets.options.arrayKtx2: 'auto'`; normals mostly stay JPG,
since UASTC is usually larger and both end up RGBA8). Output differs from the JPG path only by the codec error. A future
`CompressedArrayTexture` path would need pre-packed per-layer KTX2 (albedo+AO, normal+roughness, baked tint
normalisation) from the compressor and compressed procedural layers.

**Measured** (main game, M4 / Chrome 152, 1K sets, localhost so network time ~0):

| | JPG (`?ktx2=0`) | KTX2 |
|---|---|---|
| bytes downloaded by the loader (13 facade + 5 ground sets) | 39.6 MB | 22.5 MB |
| ground textures in GPU memory (15) | 80 MB RGBA8 | 20 MB (BC7 albedo / rough, ASTC normals) |
| all loader textures in GPU memory | ~240 MB | ~180 MB (the facade arrays are 160 MB RGBA8 either way) |
| load + GPU upload, all 18 sets (isolated, warm HTTP cache, 3 runs) | 317-348 ms + 199-230 ms (original loader: 330 + 200 ms) | 326-347 ms + 86-87 ms |
| main-thread packing of the facade array | 208-239 ms | 175 ms (no canvas readback for KTX2 maps) |
| Canyon Run (3 array sets): bytes / textures ready (in-game, noisy) | 8.6 MB / ~760 ms | 4.6 MB / ~760-900 ms |

A/B screenshots (no post-FX, fixed camera, 960x640): brick close-up mean |diff| 0.73/255 (p99 4, max 12), brick facade
0.34, stucco 0.23, road asphalt 1.63 (p99 9), street 0.68; Canyon Run dirt 1.16 (p99 6), rock wall 0.88, vista 0.65;
JPG-vs-JPG reloads are bit-identical except moving traffic.

**Stats.** `TextureSets.stats` -> `{ ktx2: { formats } | false, sets: { 'set:asphalt_02': { path: 'ktx2' | 'jpg' |
'mixed' | 'procedural' | 'missing', maps, bytes, mapBytes, ms, decodeMs, packMs, gpuBytes, formats }, ... }, totals }`, plus one
console line per load wave: `[TextureSets] 20 sets: ktx2 6 / jpg 1 / mixed 11 / procedural 2 · 22.5 MB downloaded
(ktx2 14.4, jpg 8.0) · ~180 MB GPU · ready in ... · RGBA8 array, BC7, ASTC 4x4`. `?ktx2=0` (or `?nokx`) forces JPG for
A/B comparisons; `TextureSets.configure({ ktx2, arrayKtx2, basisPath, workers, log })` changes the defaults.

## Changelog / sample findings (Canyon Run, `samples/canyon-run/`)
The second sample was built only from engine imports; every workaround it needed became an engine fix, and the
sample now uses the engine behaviour directly.
- **Physics** (`VehicleController`, `PhysicsWorld`):
  - `_clampToSurface` removes only the velocity component *into* the ground normal (was: `velocity.y = 0` on any
    contact, which killed the downhill speed and made cars skip off downslopes); the hard-landing bounce stays.
    Touchdown impact / bounce in `step()` use the same normal component (a landing on a downslope keeps its
    downhill speed). Roadster car-sim numbers are unchanged.
  - Ground heading is measured under the current tilt (`_headingUnder`), so steep ground no longer adds a
    spurious yaw every step (bit-identical on flat ground).
  - `spec.normalClamp` (default 0.15 m = before): the ground-plane fit's kerb clamp, which also caps the
    followed slope at ~atan(0.15 / wheelbase) (~3 deg for the Roadster); off-road vehicles use ~1.
  - `liftMaxG: 0` no longer produces NaN (guarded divisions); `spec.flight: false` drops the thruster / flight
    package (thrusterLevel 1, thrust 0, mode always 'ground'); new getters `thrusterLevel`, `thrust`.
  - `spec.airControl: 'flight' | 'arcade' | 'none'` (+ `airPitchRate`, `airYawRate`); flight: false defaults to
    'arcade'.
  - Surface hook: `PhysicsWorld.setSurfaceProvider(fn)` / `surfaceAt(x, z, out)` -> per-wheel `{ mu, crr, tag }`
    multipliers (grip per axle, rolling resistance); `wheels[i]` also carry `load`, `compression`, `mu`, `crr`,
    `tag` (`spec.suspensionTravel`, `spec.suspensionSag` scale the visual compression).
  - `vc.hold = true` freezes the vehicle (no velocity / integration, still rests on the ground).
- **Render**: Atmosphere's twilight term clamps `towards` before `pow()` (NaN on ANGLE/Metal smeared over the
  PMREM environment -> black PBR surfaces around sunset); `DEFAULT_LOOKS` and `DEFAULT_GRADE` gained an el 90
  key (high sun held with slightly clearer air / lower exposure; <= 50 deg unchanged). Noise: seeded
  non-repeating `Simplex` (2D / 3D, fBm, ridged), `simplex2` / `simplex3`, exported with the other noise helpers
  (also as the `Noise` namespace). `ParticleSystem`: `floorAt(x, z)` terrain collision, `lit` / `litAmbient` /
  `sun` (number, function or Atmosphere; `atmosphereSunFactor`). `DecalTrail`: `lift` option + optional feed
  normal.
- **Input**: `VehicleInput` tolerates missing actions; `InputMap` always-on actions / bindings; modifier keys
  (Shift / Alt / Ctrl / Meta) are tracked as bindable keys.
- **Camera**: rigs take `{ active: false }`; `ChaseRig` `flightFraming: true | false | 'auto'`
  (+ `flightFramingDelay`); `CameraCollision` canopy / thin-kind rules are opt-in (ChaseRig keeps the Roadster
  rules by default; `canopyFromCollider: null`, `thinKinds: []` disable them); `FreeFlyRig` takes an `InputMap`
  (`input`, always-on `freeFly.*` actions via `freeFlyActions()`), raw keys remain the fallback.
- **Core / UI**: `Profiler.gpuApprox` (timer query on ANGLE/Metal is indicative only; shown as `gpu~`) and
  `Profiler.benchThroughput(renderFn, frames)` (ms / frame, GPU-synchronised); `Minimap.update` takes positional
  args or its own `map.view`, and follows `theme.accent` live unless given an accent (other widgets bake the
  theme at build time: call `setTheme()` first, see `engine/src/ui/index.js`).

## Changelog: world streaming + traffic worker
- **World**: `TileStreamer` (new, generic) + MapWorld `streaming` option (default on with a renderer; `?nostream=1`
  / `streaming: false` = full build). `BuildingBuilder.footprint(b)`, `add(b, rnd, footprint)`, options `nearDetail`
  and `grid`; `TileBuildingBuilder` (per-tile builder, modes low / full / near) and `NullBuf`. `_chunkStatic` skips
  `userData.streamed` meshes. Plugin hooks see only the tiles built at load; `streaming.pin(building, data)` keeps
  plugin-edited tiles resident (Roadster: the OSM tower block under the Bay Bridge).
- **Traffic**: `Traffic.js` split into `TrafficSim.js` (core, Node / worker safe) + `Traffic.js` (presenter) +
  `traffic.worker.js`; `traffic: { worker }` (default on in browsers with Workers, `?noworker=1` off); ground heights
  baked into the lane graph (the sim no longer queries the world); `summary()` also reports junction entries at signals /
  on red and vehicles held by the player rules; `TrafficSim.bakeError()` dev check. `dev/traffic-sim.mjs` runs the core
  directly and checks the bake (fails on > 0.1 % of samples off by > 10 cm). Behaviour is bit-identical in x / z: the
  60 s headless runs reproduce the old respawn / speed / signal counts exactly.
- **Speed-ups on the way**: `geom.RingIndex` (exact, row-bucketed point-in-ring) for the coastline in
  `MapWorld.isLand` outside the district raster (10x; the full build's "Buildings" phase 514 -> 376 ms, a 152 k-sample
  lane-height bake 110 -> 24 ms in Node); presenter matrices written directly (no Euler / quaternion), frustum planes flattened, shadow-box
  sphere pre-reject.

## *The "Packaging" section as it was (ENGINE.md keeps a current version)* (ENGINE.md lines 832-841 at d959298)

## Packaging
This repository is the npm package `@vibe/engine` (MIT): pure ES modules, `three >= 0.170` the only (peer) dependency,
subpath exports per layer (`@vibe/engine`, `@vibe/engine/<layer>`, `@vibe/engine/tools/*`), each with a `types`
condition pointing at the declarations `npm run types` emits from the JSDoc into `types/` (gitignored; `prepack` emits
them, so `npm pack` / `npm publish` ship them: `files` = `src`, `types`, `tools`, README, LICENSE, CHANGELOG; ~285
files, ~1.1 MB). `npm run types:check` compiles `test/types/check.ts`, a strict TypeScript consumer of the root and
every subpath with `skipLibCheck` off, so a JSDoc gap that would emit a wrong type fails CI (1.0 fixed 20 of them).
Layer `index.js` files are the public surface (deep imports are unsupported). The Roadster game embeds the repository
as the `engine/` submodule listed in its `workspaces`. `CHANGELOG.md` tracks releases; `npm run pack:check` lists the
tarball.

## Render interpolation (fix for judder, 2026-10-18)
Physics runs at a fixed 120 Hz while frames arrive at a variable rate, so a frame may contain 1, 2 or 3 steps.
Showing the latest step directly made the car's per-frame displacement swing by ~30 %, which reads as the whole
screen shaking at speed (worse on high-DPI screens where frames are slower). The engine already exposes
`alpha = accumulator / fixedDt` to `update(dt, alpha)`; game objects driven by fixed-step physics must keep the
previous pose and blend: `Car.interpolate(alpha)` lerps position and slerps rotation between the last two steps
(measured frame-to-frame speed variation 0.4 % vs 30 % raw). The camera then follows the blended pose. Also:
moving vehicles are 'thin' for camera occlusion (`thinKinds: [2, 3, 'vehicle']`), so traffic passing behind the
player no longer yanks the chase camera in.

## Suspension & contact model (2026-10-19)
**Why.** The first vehicle model clamped a rigid body to the plane through its four wheel supports every step.
Measured on the real map with the new street-drive harness (`node dev/drive-sim.mjs`: a pure-pursuit pilot drives the
Roadster along 23 downtown streets, 21 km at 50 km/h, 80 on the Embarcadero, with terrain, decks, building / pier /
furniture colliders built exactly as the game builds them), that meant: 926 one-step grounded/airborne flickers (each
one zeroed the wheel loads, ran the flight attitude loop for a step and fired a landing event), pitch snaps of up to
7 deg in a single step, 5 cm single-wheel hops along lanes (the +0.05 asphalt lift came from 1 m raster pixels),
wheels hanging 0.2 m in the air on hills, 1-1.8 m teleports onto overpass decks whose ends sat above the street, and
a crest jump entered "flight mode" so the hover assist floated the car down.

**Vehicle (`engine/src/physics/VehicleController.js`).**
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

**World (`MapWorld`, `RoadNetwork`, `Props`).**
- `getGroundHeight` adds `pavingLift`: asphalt +0.05 inside the exact ribbon geometry (`net.segHash`, round end caps,
  0.35 m ramp outside the edge), sidewalk slabs / kerb tops +0.17 (raster), else the ground mesh. `surfaceAt`
  (`SURFACES`): asphalt, paving, grass, bare ground and water (mu 0.12, crr x30: the bay is not a road, the car bogs
  down and needs its thrusters). `getGroundHeight(x, z, y, step)`: the physics passes `deckStep` 0.35 (a deck a car
  cannot climb must not become its ground; the traffic lane bake keeps 1.6).
- Deck solver: grounded deck ends are pinned to the ground and a piece whose other end is too high for 6 % gets the
  grade it needs (Harrison Street over the freeway cut: a 2 m cliff at the ramp foot is now a 10 % ramp); deck nodes
  over a crossed street get a lower bound of street + 4.6 m.
- Parked cars at an angle are registered as three AABB slices (one box of a 30-degree car bulged 0.7 m into the
  lane); traffic-signal poles are never placed on a carriageway.

**Measured (drive-sim, same 23 streets).**
| | before | after |
|---|---|---|
| grounded/airborne flickers | 926 | 1 |
| pitch snaps > 0.5 deg/step | 153 | 0 |
| roll snaps > 0.5 deg/step | 140 | 11 (kerbs the pilot clips) |
| vertical hops > 2 cm/step | 167 | 10 |
| flight-mode entries without thrust | 6 | 0 |
| impacts | 21513 (pilot in the parking lane / median) | 26 |

`test/car-sim.mjs` (then `tools/car-sim.mjs`) grew 24 suspension checks (rest, ring-down, 12 cm kerb, rounded slope break, dive / squat / roll
signs, ledge drop, arming, traffic shove, reset on a slope); 73 checks pass.

**Known map artifact (fixed in the deck solver, 2026-10-19).** The feet of the freeway and Transbay bus ramps at 1st,
2nd and Harrison Street overlapped the street they merge into for the first ~30 m of ramp (OSM ends the bridge way
where the span ends, a few metres past the street; the approach beyond is a ground road here); the deck climbed at 6 %
from that foot and hung 0.5-1.3 m over the asphalt, exempt from the clearance bound, and the car drove through the slab.
`RoadNetwork.footZones` now walks from every grounded deck end and pins the deck to the ground while its centre line
runs over another road's carriageway (a street within 15 m of the foot / the previous hit, a service road within 30 m):
that ramp-foot zone is street, not deck (rasterised as road, in `segHash`, ribbon sampled from the ground 2 cm above the
street's, no `deckHash` entry, no slab), and the climb starts at the carriageway edge with the grade it needs.
`node dev/ramp-foot-probe.mjs` lists deck samples 0.4-3.2 m over a ground carriageway: 51 before (nine zones now,
four pieces lie on the ground entirely), 0 after; drive-sim sunk-wheel steps 438 -> 0, everything else unchanged.

## Optimisation pass (2026-10-27): measured
**Method.** Canyon Run in the desktop app's Chromium (ANGLE over Metal, Apple M4), `Profiler.benchThroughput` (CPU
submission + GPU execution per frame, GPU-synchronised) with the viewport emulated at 2560x1440, fixed camera poses,
particles cleared; the world layer headless in Node (the procedural city, `test/world-build.mjs`) with `--cpu-prof`;
every "same output" change checked by content hash (textures) or sampled world positions (meshes, <= 0.06 mm).

**Where a frame goes** (Canyon Run, driving view along the canyon, 2560x1440, MSAA 4x, GTAO, bloom; 10.6 ms):

| part | ms | how measured |
|---|---|---|
| terrain splat shading (sample shader: 10 array fetches, biplanar rock) | ~4.0 | plain MeshStandardMaterial on the chunks: 6.6 |
| terrain shadow sampling (2 cascades, PCF) | 1.4 | `receiveShadow` off on the chunks: 9.2 |
| MSAA 4x (R11G11B10 target + resolve) | 1.9 | `setMSAA(0)` (FXAA): 8.6 |
| GTAO (half res, 8 samples, bilateral blur) | 1.55 | AO pass off: 9.0 |
| shadow map rendering (near 2048 every frame, far 4096 every other) | 0.9 | `shadowMap.autoUpdate = false`: 9.6 |
| bloom / sky / far ring / props / impostors / ribbon / gates / buggy / decals | 0.4 / 0.25 / <= 0.05 each | hidden one at a time |
| CPU of the whole tick at 1024x768 | ~1.0 (render 0.8, HUD 0.1, the rest < 0.1 each) | `?profile=` |

At 1024x768 the sample runs 60 fps with ~1 ms of CPU and ~3 ms GPU-synchronised: on this machine the CPU side of the
engine is not where frame time goes; what remains is per-pixel work (the sample's terrain shader, the post stack) and
content (a dust devil in view costs 1-10 ms of alpha-blended fill at 2560x1440).

**Draw order and overdraw.** three.js sorts opaque objects front to back by *object position*; every merged static
mesh (chunk tiles, building shells, the sample's terrain chunks) sat at the world origin, so they all sorted equal and
drew in creation order. `chunkMesh` tiles and the city's building shells now sit at their XZ centre with local vertices
(`localizeMeshOrigin`; world positions unchanged). Measured on the M4: no difference in any pose (within 0.1 ms, same
page, chunks moved back and forth), and a depth pre-pass of the terrain made every pose slower (+1.3 to +3 ms): Apple's
tile-based deferred renderer already shades each opaque pixel once, so order only matters on immediate-mode GPUs
(desktop NVIDIA / AMD / Intel), where the change is kept for.

**Impostor bake** (`render/Impostors.js`, 80 views of 4 Canyon Run models, 128 px cells): 273-302 ms per fresh page load,
of which the CPU box filter of the 2x supersampled cells took 56-154 ms and the dilate + mip post 53-90 ms, the GPU
render + readback 29 ms. The filter now runs on the GPU (alpha-weighted K x K `texelFetch`, one quarter-size readback per
row) and the atlas is only as tall as its cells need (640 px -> a 1024-row texture instead of 2048): 137-148 ms cold,
64 ms warm; atlas texels within +-1 of the CPU result. Phase times are printed with the bake line.

**Headless world layer.** `Atmosphere` without a renderer skips PMREM / sky cube / horizon sampling / flare, so
`MapWorld({ renderer: null })` builds in Node (it threw before). The procedural city (1775 buildings, 41 roads, 7927
colliders, 250 vehicles) builds in ~1.5 s: buildings 265 ms, props 260 (vegetation atlas 126), roads 204, traffic 140,
ground + water 154, procedural canvas textures ~330 (noise-bound: asphalt 80, ground 65, cloud atlas 83, water normals
30), static tiling 41; `world.update` at the spawn 0.24 ms per frame with the traffic in-thread (0.16 ms per sim step
for 250 vehicles), `getGroundHeight` 0.2 us. The build is deterministic (same stats, same traffic summary and poses
across runs), which `test/world-build.mjs` pins. Next load-time lever, not taken here: the procedural textures off the
main thread (OffscreenCanvas worker) or cached, ~300 ms of every load.

**Kept only what measured.** Painter / mip-chain / tiling micro-changes: ~10 % on the procedural painters,
hash-identical output. Tried and dropped: a per-cell corner cache for `pnoise` (12 ns per call either way), an
octave-major cloud fBm (same time), the depth pre-pass, and chunk sort order on Apple GPUs (above).

## MacBook pass (2026-10-28): Retina, Apple GPUs, ProMotion
**Method.** As the optimisation pass above, with the viewport emulated at a 14-inch MacBook Pro's pixel count
(3024x1964, 5.9 Mpx, pixel ratio 1), fixed camera poses, particles cleared, auto-exposure frozen; every quality-affecting
change A/B'd by reading the framebuffer back at full resolution (mean / max absolute RGB difference and the share of
pixels changed by more than 2 and 8 of 255). The coding was done by subagents on disjoint files; every number here was
measured in the browser afterwards. Baseline (Canyon Run, driving view): 15.8 ms with 0.3 ms of CPU: terrain 7.7
(sample splat shader ~5, shadow sampling 1.5), GTAO 2.7, MSAA 4x 2.7 (4x -> 2x saves only 0.4: the cost is the
resolve), final pass ~1.6, shadow maps 1.0, bloom 0.5.

| change | ms at 3024x1964 (driving / chase view) | pixel change vs before | default |
|---|---|---|---|
| `PostFX.lateClear`: scene target cleared by three's autoClear after the shadow maps instead of by RenderPass before them (ANGLE/Metal opened a render pass just for the clear and stored + reloaded all 4 samples) | -1.0 / -1.3 | none (identical) | on |
| AO buffers capped at 0.6 Mpx (`ao.maxPixels`; 961x624 here instead of 1512x982) + depth-aware upsample in the final pass (`ao.upsample: 'depth'`) + RG16F buffers (`ao.compact`) | -1.3 / -1.7 (0.8 Mpx: -1.0 / -1.3; 0.45 Mpx: -1.5 / -2.0) | mean 0.036-0.042, < 0.5 % of pixels > 2, ~0.03 % > 8 | on |
| `'fast'` shadow kernel: 5 hardware-compare (bilinear) taps on a DepthTexture attached to the same shadow render, instead of three's 17 unpacked taps; the same penumbra width | -1.9 / -2.1 | mean 0.008-0.015, < 0.2 % > 2, 0.003 % > 16 | opt-in (`shadows.kernel`); Canyon Run on |
| FXAA instead of 4x MSAA above `msaaMaxPixels` drawing-buffer pixels | -2.8 / -3.2 (city street view -3.2) | mean 0.5-1.4, 5-17 % of pixels > 2 (edges, facades) | opt-in; Canyon Run 4e6 |
| all of the above | 15.8 -> 9.9 / 17.1 -> 10.1; aerial 12.6 | as above | |
| `Engine.targetFps` tick pacing + `refreshRate` | not a frame-time change: 60 on a 120 Hz display runs every second callback (half the GPU/CPU work per second, for battery and heat); verified 28.4 ticks/s with `?fps=30` on a 60 Hz pane | - | 0 (uncapped) |
| procedural texture-array layers in a worker pool (`proceduralTextures.worker.js`) | main-thread cost per layer 24-68 ms -> 3-5 ms (Canyon Run's three layers: 102-195 ms -> 23-26 ms on the main thread; end-to-end load unchanged there, since little overlaps and a fresh worker's cold JIT runs a layer ~2x slower; the city's 15-layer facade array: 15 ms main-thread, 228 ms off-thread while the main thread builds roads) | none (byte-identical, hash-checked) | on in browsers |
| city street / crossing view (`/city`, procedural city, 147 draw calls, quiet machine): engine defaults (late clear + AO cap), then `'fast'` shadows, then the FXAA rule | 15.7 -> 12.6 -> 12.0 -> 8.9; 16.2 -> 12.7 -> 12.2 -> 9.1 | as above | |
| Canyon Run terrain shader (sample): fetches skipped where their weight is provably 0 (steep walls: rockW exactly 1, no dirt fetches; floor: no rock fetches), biplanar gradients hoisted out of the branch (fixes wrong mips along the wall foot) | -0.9 / -1.1 (aerial) | 1 LSB in 54-92 of 5.5 M pixels | on (sample) |
| terrain detail uniforms: biplanar projections under a 0.02 weight skipped (faded over 0.02-0.04), dirt normal / second sample faded 40-120 m, rock normals and 2-projection rock 300-600 m | -0.8 / -0.4 / -2.7 (aerial) | mean <= 0.03, max 18 on 0.004 % of pixels | on (sample; `uDetail`, `uDetailRock`) |
| everything, same page, all knobs off -> on (driving / chase / aerial) | 15.9 -> 8.2, 17.1 -> 8.7, 20.6 -> 8.8 | | |

**What the Retina frame cannot shed.** The MSAA resolve (`blitFramebuffer` of colour + depth from the multisampled
target into the texture / DepthTexture that the AO, fog and flare passes read) has no cheaper path in WebGL2:
multisampled textures cannot be sampled, a multisampled depth blit must be same-size and NEAREST, `copyTexSubImage2D`
cannot copy depth, `WEBGL_multisampled_render_to_texture` is not implemented in Chromium, and `resolveDepthBuffer:
false` would leave the DepthTexture unwritten. The remaining per-pixel costs are the sample's terrain splat shader
and MSAA itself, which is why FXAA above a pixel budget is the one visible-quality knob offered.

**ProMotion.** Uncapped, the engine keeps the 60 fps frame budget of the adaptive-resolution controller, so a 120 Hz
display runs at full resolution and 60 fps as before; `targetFps: 120` makes the controller chase 120 fps at a lower
pixel ratio, `targetFps: 60` halves the work per second on a 120 Hz display. The F3 overlay shows ticks per second and
the display rate. Known limits: a cap of 30 runs the 120 Hz simulation ~9 % slow (every tick needs the full 4
substeps; raise `maxSubsteps`), and the controller only ever lowers the pixel ratio under vsync (as it always did).

## *From "Character stack": the removed character sample* (ENGINE.md lines 1062-1063 at d959298)

- `samples/character/`: third-person playground (glTF via `?model=` or `tools/fetch-models.mjs`, procedural rigged
  fallback built in code, so no binary asset is committed).

## Measurement protocol
Every sample page exposes `window.__sample` (`createBenchHarness`): `pose(id)` stops the loop, places the camera,
runs the sample's `after` (culling, LOD partitions, atmosphere) and `quiet` (particles off, exposure frozen) hooks
and renders two frames with dt = 0; `bench(frames)` is `Profiler.benchThroughput` over `engine.renderFn` (CPU
submission + GPU execution, no vsync); `capture(scale)` reads the default framebuffer right after a render and
box-downsamples it; `diff(a, b)` gives `meanAbs / p99 / max / pctOver2 / pctOver8`; `run(plan)` crosses poses and
settings into a table. `?bench=1&size=WxH` pins the drawing buffer at pixel ratio 1.
What makes a capture reproducible across page loads (learned on 0.5.0 while moving the vite root):
- the sky's cloud time is wall-clock driven (`uTime`, `uCloudOffset` advance in `Atmosphere.update`): pin both;
- the shared time uniforms (`createTimeUniforms`) hold the wind phase and, in `uViewPos`, the camera position the
  dither fades measure distance from: pin `uTime` and copy the camera position (a stale `uViewPos` moved 2-5 %
  of Canyon Run's pixels by up to 190 / 255);
- LOD partitions have hysteresis and throttles: run the poses in a fixed order from a fresh page load (the smoke
  script does), or force the partitions (the city harness calls `world.update(1, …)` three times);
- freeze auto-exposure (`postfx.autoExposure = false; postfx.setTimeOfDay(darkness)`) and clear particles;
- (0.7.0) stop the loop at `setReady()` under `?bench=1` (`harness.freeze()`; every sample does): `pose()` only
  freezes the loop when it is called, so the live ticks between page load and the first pose (the car settling on
  its suspension, animation clocks) made Canyon Run's car poses differ by up to 0.28 mean across loads;
- (0.7.0) give every harness setting a getter (`{ get, set }`): `run(plan)` restores each knob to the value the
  getter returned before the first setting, so a plain setter without a getter makes the plan cumulative (the
  0.7.0 'pcf' / 'pcss' rows were first measured with TAA still on from the previous row).
With that, every pose of Canyon Run, the city, the character and the sandbox hashes identically across reloads in
the desktop app's browser (0.7.0: two fresh loads of Canyon Run diff to exactly 0 on every pose). Headless Chrome under Playwright
reproduces most poses but not all: Canyon Run's `straight` and `ahead` hashes drift between smoke runs while
`chase` / `aerial` and every city / character / sandbox pose stay equal, so cross-phase pixel gates are read in the
app's browser (or as same-page A/B through `run(plan)`), and the smoke's job is boot + stability within a load. `npm run smoke` asserts two equal captures per pose
on every page; `npm run bench` writes `bench/results/<date>-<HHMM>-<page>-<WxH>-<label>.json`.

The 1.0 sweep (`bench/release-sweep.js`; results `bench/results/2026-10-30-*-p6-*.json`; tables in "Measured
(1.0)"): one plan per sample page, poses x settings `default` / `gbuffer+taa` / `max` (every 0.7.0 - 0.9.0 render
feature on, plus the night / clustered / refraction variants where the page has them), run from the page's console in
the desktop app's browser pane at `?bench=1&size=3024x1964` and `2560x1440`, 24 frames per cell after 3 warm-up
frames, the pixel diff against the `default` row of the same pose. GPU numbers are comparable only from an idle GPU:
the first 1.0 run read 2.5-3x the 0.9.0 figures while another process held the GPU at 99 % (`ioreg -r -c
IOAccelerator -d 1` shows the utilisation), and was discarded.

### Phase 1 baseline (0.5.0, `bench/results/2026-10-29-*-p1-baseline.json`)
Headed Chrome 142 (Playwright, `--use-angle=metal`), Apple M4, pixel ratio 1, 24 frames per pose after 3 warm-up frames,
engine defaults of each sample (Canyon Run: 'fast' shadows, MSAA under 4 Mpx; city: engine defaults, traffic on).
The in-app browser measures the same poses within 0.1-0.2 ms (Canyon Run straight 8.22, chase 8.63, aerial 8.78 ms at
3024x1964); the first headed run after a cold start read about 1 ms higher on every pose, so compare numbers only
from warm runs in one environment.

| sample | pose | ms at 3024x1964 | ms at 2560x1440 | draw calls | triangles |
|---|---|---|---|---|---|
| canyon-run | straight | 8.39 | 8.43 | 55 | 0.57 M |
| canyon-run | chase | 8.71 | 8.45 | 59 | 0.70 M |
| canyon-run | aerial | 8.85 | 9.76 | 54 | 0.74 M |
| canyon-run | ahead | 5.65 | 5.93 | 44 | 0.59 M |
| character | idle | 5.47 | 5.14 | 62 | 0.01 M |
| character | run | 4.91 | 5.07 | 62 | 0.01 M |
| character | aerial | 4.48 | 4.80 | 63 | 0.01 M |
| city | street | 13.31 | 10.27 | 172 | 0.86 M |
| city | crossing | 12.65 | 9.99 | 174 | 0.84 M |
| city | high | 13.25 | 10.42 | 176 | 0.86 M |

## Measured (1.0): every sample, every pose, both sizes
Apple M4, the desktop app's Chromium 152 (ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)), drawing buffer pinned at pixel ratio 1, 24 frames per cell after 3 warm-up frames, GPU otherwise idle. `diff` = mean absolute per-pixel difference (0..255) against the `default` row of the same pose at that size; `draws` / `tris` from the default row at 3024x1964.

What the tables say (the per-knob costs of each feature are in the 0.7.0 / 0.8.0 tables; this is the whole engine at
once):
- **Defaults are where they were.** Every default pose is within 0.1-0.8 ms of its 0.5.0 baseline and 0.9.0 figure
  (Canyon Run straight 8.25 ms at 3024x1964 against 8.39 in 0.5.0; city street 12.54 against 13.31; character idle
  5.34 against 5.47): six releases of features added nothing to a scene that does not switch them on.
- **G-buffer + TAA** costs +2.4-2.8 ms at 3024x1964 on Canyon Run (the TAA resolve is bandwidth-bound at 5.9 Mpx,
  0.7.0 finding) and is *cheaper* than the default at 2560x1440 (7.32 against 7.59: the default there is 4x MSAA, whose
  resolve the G-buffer path does not pay). The city and the character pay 0-2.3 ms at 3024 and nothing at 2560.
- **Everything on** (SSR, volumetrics, depth of field, motion blur, G-buffer AO normals, PCSS where the page has it)
  is +8-10 ms at 3024x1964 and +4-5 ms at 2560x1440 on every page (Canyon Run straight 17.18 / 11.57, city street
  18.72 / 12.91, character idle 13.43 / 8.79, sandbox stack 12.73 / 8.70): DoF and motion blur are the two largest
  shares (0.8.0 table), both resolution-bound, so a 60 Hz budget at 3024x1964 picks among them and a 120 Hz one at
  2560x1440 keeps two or three.
- **Night city with every lamp clustered** (plus everything on, plus water refraction): 21.1 ms at 3024x1964, 14.2 at
  2560x1440, 2.4 ms over the day `max` row; its `diff` of 43-73 is day against night, not a defect.
- **Pixel diffs.** `gbuffer+taa` against the default is the anti-aliasing difference (0.1-0.36 mean on Canyon Run and
  the character; 0.8-2.5 on the city, whose default is FXAA at these sizes and whose streaming state can differ by a
  tile between settings); `max` moves 1-5 mean (depth of field, reflections and in-scatter are meant to change the
  image). The sandbox scenes render their frozen pose only (the physics step is measured in "Unified XPBD (0.9.0)").

### canyon-run (canyon)
| pose | setting | ms 3024x1964 | ms 2560x1440 | diff 3024 | diff 2560 | draws | tris |
|---|---|---|---|---|---|---|---|
| straight | default | 8.25 | 7.59 | ref | ref | 53 | 0.56 M |
| straight | gbuffer+taa | 10.66 | 7.32 | 0.317 | 0.312 | 54 | 0.56 M |
| straight | max | 17.18 | 11.57 | 1.852 | 1.539 | 67 | 0.56 M |
| chase | default | 8.63 | 7.65 | ref | ref | 57 | 0.69 M |
| chase | gbuffer+taa | 11.10 | 7.85 | 0.356 | 0.264 | 58 | 0.69 M |
| chase | max | 17.83 | 12.05 | 0.829 | 0.697 | 71 | 0.69 M |
| aerial | default | 8.78 | 8.72 | ref | ref | 54 | 0.74 M |
| aerial | gbuffer+taa | 11.43 | 8.34 | 0.350 | 0.224 | 55 | 0.74 M |
| aerial | max | 18.18 | 12.83 | 1.244 | 1.084 | 68 | 0.74 M |
| ahead | default | 5.57 | 5.86 | ref | ref | 44 | 0.59 M |
| ahead | gbuffer+taa | 7.87 | 5.62 | 0.344 | 0.228 | 45 | 0.59 M |
| ahead | max | 14.12 | 9.55 | 1.194 | 1.058 | 58 | 0.59 M |

### canyon-run (canyon-night)
| pose | setting | ms 3024x1964 | ms 2560x1440 | diff 3024 | diff 2560 | draws | tris |
|---|---|---|---|---|---|---|---|
| night-lamps | default (lamps, gpu particles) | 8.58 | 5.99 | ref | ref | 58 | 0.68 M |
| night-lamps | max | 16.83 | 11.12 | 1.395 | 1.167 | 71 | 0.69 M |
| devils | default (lamps, gpu particles) | 9.16 | 6.26 | ref | ref | 50 | 0.71 M |
| devils | max | 17.65 | 11.77 | 1.472 | 1.333 | 63 | 0.71 M |
| chase | default (lamps, gpu particles) | 9.32 | 6.53 | ref | ref | 62 | 0.82 M |
| chase | max | 18.02 | 11.85 | 0.835 | 0.778 | 75 | 0.82 M |

### city (city)
| pose | setting | ms 3024x1964 | ms 2560x1440 | diff 3024 | diff 2560 | draws | tris |
|---|---|---|---|---|---|---|---|
| street | default | 12.54 | 9.26 | ref | ref | 167 | 0.86 M |
| street | gbuffer+taa | 12.22 | 8.71 | 0.975 | 1.065 | 159 | 0.75 M |
| street | max | 18.72 | 12.91 | 4.246 | 3.907 | 172 | 0.77 M |
| street | night max clustered | 21.10 | 14.17 | 43.586 | 42.474 | 155 | 0.69 M |
| crossing | default | 12.99 | 9.40 | ref | ref | 163 | 0.82 M |
| crossing | gbuffer+taa | 12.93 | 8.99 | 2.454 | 2.229 | 155 | 0.72 M |
| crossing | max | 19.35 | 13.35 | 5.023 | 4.819 | 169 | 0.73 M |
| crossing | night max clustered | 21.51 | 14.72 | 45.576 | 43.758 | 145 | 0.64 M |
| high | default | 13.60 | 9.59 | ref | ref | 164 | 0.84 M |
| high | gbuffer+taa | 13.07 | 9.19 | 0.963 | 1.007 | 155 | 0.74 M |
| high | max | 22.44 | 13.79 | 4.370 | 3.843 | 169 | 0.76 M |
| high | night max clustered | 22.57 | 15.23 | 43.950 | 44.456 | 153 | 0.69 M |
| shore | default | 10.17 | 7.22 | ref | ref | 77 | 0.40 M |
| shore | gbuffer+taa | 10.37 | 7.29 | 0.761 | 0.803 | 80 | 0.40 M |
| shore | max | 18.80 | 12.47 | 4.053 | 3.768 | 98 | 0.42 M |
| shore | night max clustered | 20.63 | 13.50 | 73.271 | 71.778 | 82 | 0.34 M |

### character (character)
| pose | setting | ms 3024x1964 | ms 2560x1440 | diff 3024 | diff 2560 | draws | tris |
|---|---|---|---|---|---|---|---|
| idle | default | 5.34 | 4.94 | ref | ref | 62 | 0.01 M |
| idle | gbuffer+taa | 7.12 | 4.85 | 0.154 | 0.097 | 63 | 0.01 M |
| idle | max | 13.43 | 8.79 | 1.709 | 1.690 | 76 | 0.01 M |
| run | default | 5.03 | 4.58 | ref | ref | 62 | 0.01 M |
| run | gbuffer+taa | 7.36 | 4.85 | 0.156 | 0.092 | 63 | 0.01 M |
| run | max | 13.81 | 9.01 | 1.608 | 1.605 | 76 | 0.01 M |
| aerial | default | 4.50 | 4.27 | ref | ref | 63 | 0.01 M |
| aerial | gbuffer+taa | 6.80 | 4.56 | 0.353 | 0.151 | 64 | 0.01 M |
| aerial | max | 13.39 | 8.72 | 1.472 | 1.155 | 77 | 0.01 M |
| push | default | 5.39 | 5.05 | ref | ref | 64 | 0.01 M |
| push | gbuffer+taa | 7.67 | 5.31 | 0.180 | 0.106 | 65 | 0.01 M |
| push | max | 13.90 | 9.25 | 1.535 | 1.587 | 78 | 0.01 M |
| ragdoll | default | 5.81 | 5.45 | ref | ref | 64 | 0.01 M |
| ragdoll | gbuffer+taa | 7.73 | 5.31 | 0.217 | 0.087 | 65 | 0.01 M |
| ragdoll | max | 14.08 | 9.26 | 1.179 | 1.136 | 78 | 0.01 M |

### sandbox (scenes; render only, the loop is frozen at the pose)
| scene | overview default 3024 / 2560 | overview max 3024 / 2560 | close default 3024 / 2560 | close max 3024 / 2560 | max diff (overview, 3024) | draws | tris |
|---|---|---|---|---|---|---|---|
| bench1000 | 5.53 / 5.28 | 13.38 / 9.23 | 6.09 / 5.80 | 14.28 / 9.95 | 2.439 | 39 | 0.71 M |
| buoyancy | 5.71 / 5.64 | 13.46 / 8.69 | 6.20 / 5.82 | 14.96 / 9.70 | 1.722 | 39 | 0.02 M |
| cloth | 5.37 / 5.30 | 13.54 / 8.92 | 5.43 / 5.15 | 13.53 / 9.01 | 1.332 | 27 | 0.01 M |
| rope | 5.09 / 5.01 | 12.56 / 8.28 | 5.04 / 4.65 | 13.07 / 8.65 | 0.792 | 43 | 0.01 M |
| soft | 5.57 / 5.01 | 13.25 / 8.70 | 5.44 / 5.04 | 13.45 / 8.98 | 1.086 | 29 | 0.00 M |
| stack | 5.25 / 4.75 | 12.73 / 8.70 | 5.06 / 4.76 | 13.04 / 8.93 | 0.876 | 25 | 0.00 M |
| destructible | 5.31 / 4.68 | 13.47 / 8.40 | 5.56 / 5.29 | 13.66 / 8.99 | 1.006 | 183 | 0.00 M |

Files: `2026-10-30-0016-canyon-run-2560x1440-p6-canyon.json`, `2026-10-30-0016-canyon-run-3024x1964-p6-canyon.json`, `2026-10-30-0017-canyon-run-2560x1440-p6-canyon-night.json`, `2026-10-30-0017-canyon-run-3024x1964-p6-canyon-night.json`, `2026-10-30-0017-city-3024x1964-p6-city.json`, `2026-10-30-0018-character-2560x1440-p6-character.json`, `2026-10-30-0018-character-3024x1964-p6-character.json`, `2026-10-30-0018-city-2560x1440-p6-city.json`, `2026-10-30-0019-sandbox-3024x1964-p6-sandbox-bench1000.json`, `2026-10-30-0019-sandbox-3024x1964-p6-sandbox-buoyancy.json`, `2026-10-30-0019-sandbox-3024x1964-p6-sandbox-cloth.json`, `2026-10-30-0019-sandbox-3024x1964-p6-sandbox-rope.json`, `2026-10-30-0019-sandbox-3024x1964-p6-sandbox-soft.json`, `2026-10-30-0019-sandbox-3024x1964-p6-sandbox-stack.json`, `2026-10-30-0020-sandbox-2560x1440-p6-sandbox-bench1000.json`, `2026-10-30-0020-sandbox-2560x1440-p6-sandbox-buoyancy.json`, `2026-10-30-0020-sandbox-2560x1440-p6-sandbox-cloth.json`, `2026-10-30-0020-sandbox-2560x1440-p6-sandbox-rope.json`, `2026-10-30-0020-sandbox-2560x1440-p6-sandbox-soft.json`, `2026-10-30-0020-sandbox-2560x1440-p6-sandbox-stack.json`, `2026-10-30-0020-sandbox-3024x1964-p6-sandbox-destructible.json`, `2026-10-30-0021-sandbox-2560x1440-p6-sandbox-destructible.json`.
