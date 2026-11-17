// Runs every headless suite in sequence (`npm test`): each file is a standalone Node script that exits non-zero on
// failure; suites that build world geometry need the no-op canvas shim. Add new suites here, keep car-sim first
// (it is the determinism gate for the roadster vehicle model).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SHIM = here('./helpers/dom-shim.mjs');
const SUITES = [
  { file: 'car-sim.mjs' },
  { file: 'world-build.mjs', shim: true },
  { file: 'world-lights.mjs', shim: true },
  { file: 'core.mjs' },
  // the Engine's start-up and failure paths: warmUp (dt 0, no fixed step, GPU fence polled), lost context, frame errors
  { file: 'engine-start.mjs' },
  { file: 'look-stats.mjs' },
  { file: 'memory.mjs' },
  { file: 'texture-manifest.mjs' },
  // world: the high-detail vehicle level (lod 'hd'), with LOD 0 / 1 pinned byte-identical
  { file: 'vehicles-hd.mjs', shim: true },
  // createCarVisual: every HD type, wheels on the physics within 1 cm, a 10 s drive, lamps, contact shadow
  { file: 'car-visual.mjs' },
  // the starters' scenery (world/Scenery.js): country road, park corner, ground cover, road paint; colliders, determinism
  { file: 'scenery.mjs' },
  // quality tiers (desktop / mobile): device recommendation, ?quality= / stored precedence, preset merge
  { file: 'quality.mjs' },
  // ui: the game shell's state machine and saved settings (the DOM half is test/browser/shell.mjs)
  { file: 'shell.mjs' },
  { file: 'assets.mjs' },
  { file: 'rigs.mjs' },
  // camera feel: options off = main's poses (camera-feel-ref.json), road feel, trauma, landing dip, sprint FOV
  { file: 'camera-feel.mjs' },
  { file: 'character-input.mjs' },
  // drive feel: steering assist with and without on ROAD_CAR_SPEC (lock, handbrake catch, slalom, turning circle), rumble values
  { file: 'steering-assist.mjs' },
  { file: 'anim.mjs' },
  { file: 'character-sim.mjs' },
  // dynamics (0.6.0): shapes -> broadphase -> narrowphase -> xpbd/joints -> world -> queries/bridge -> worker protocol
  { file: 'dyn-shapes.mjs' },
  { file: 'dyn-broadphase.mjs' },
  { file: 'dyn-narrowphase.mjs' },
  { file: 'dyn-joints.mjs' },
  { file: 'dyn-world.mjs' },
  { file: 'dyn-bridge.mjs', shim: true },
  { file: 'dyn-serialize.mjs' },
  // render (0.7.0)
  { file: 'gpu-particles.mjs', shim: true },
  // skid marks and tyre smoke from wheels[i].slideHeat (TyreFx): clean corner leaves nothing, a slide marks and smokes
  { file: 'tyre-fx.mjs', shim: true },
  { file: 'clustered.mjs' },
  { file: 'shadows.mjs' },
  // directional lights black at the pixel skip their BRDF (shadows.skipUnlit)
  { file: 'skip-unlit.mjs' },
  { file: 'postfx-options.mjs' },
  // the weathering material patch: builds, deterministic, zero is identity, unpatched materials unchanged
  { file: 'surface-detail.mjs' },
  // PostFX renderScale (temporal upscaling): sizes, defines, scale-1 texts pinned, sequences, allocation
  { file: 'render-scale.mjs' },
  { file: 'gbuffer-chunks.mjs' },
  // render (0.8.0): screen-space reflections + AO normals, volumetrics, motion blur / DoF / LUT, water refraction
  { file: 'ssr-ao.mjs' },
  { file: 'volumetric.mjs' },
  { file: 'blur-dof-lut.mjs' },
  { file: 'water.mjs', shim: true },
  // physics (0.9.0): particles / cloth / rope, soft bodies, coupling + buoyancy, fracture, character dynamics, ragdoll
  { file: 'dyn-cloth.mjs' },
  { file: 'cloth-mesh.mjs' },
  { file: 'dyn-soft.mjs' },
  { file: 'dyn-buoyancy.mjs' },
  { file: 'dyn-fracture.mjs' },
  { file: 'character-dyn.mjs' },
  { file: 'ragdoll.mjs', shim: true },
  // the Miami drive sample: its road-car spec (samples/miami-drive/spec.js) on the VehicleController
  { file: 'miami-car.mjs' },
  // the NYC night walk sample's engine options: traffic fleet mix and the spawn area (TrafficSim)
  { file: 'nyc-traffic-mix.mjs' },
  // the asset catalogue (tools/catalog-assets.mjs): every samples/public file covered, entries resolvable, credits
  // complete, catalog.json and docs/ASSETS.md current
  { file: 'asset-catalog.mjs' },
  // agent usability: ROAD_CAR_SPEC, loadTextureSet role keys / warnings, missing-clip errors, addStaticBox object
  // forms, NearestLights from the render layer, PoseInterpolator
  { file: 'agent-usability.mjs' },
  // audio (sound kit): the DSP and every preset measured (peak, DC, ends / loop seam, centroid band, seeds), the voice
  // policy and the mixer graphs on a fake AudioContext, SoundBank / analyseMix without Web Audio
  { file: 'audio-dsp.mjs' },
  { file: 'audio-voices.mjs' },
  { file: 'audio-bank.mjs' },
  // the docs (README.md, ENGINE.md, AGENTS.md, docs/HOWTO.md) name only paths, links and exports that exist
  { file: 'docs.mjs' },
  // the Node-capable recipes of docs/HOWTO.md (test/howto/recipes.js) run and do what they say
  { file: 'howto.mjs' },
];
let failed = 0, ran = 0;
const t0 = performance.now();
for (const s of SUITES) {
  const file = here(`./${s.file}`);
  if (!existsSync(file)) { console.log(`skip  ${s.file} (missing)`); continue; }
  const args = s.shim ? ['--import', SHIM, file] : [file];
  const t = performance.now();
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  ran++;
  const ms = Math.round(performance.now() - t);
  if (r.status !== 0) { failed++; console.log(`FAIL  ${s.file} (exit ${r.status}, ${ms} ms)`); } else console.log(`ok    ${s.file} (${ms} ms)`);
}
console.log(`\n${ran - failed}/${ran} suites passed in ${Math.round(performance.now() - t0)} ms`);
process.exit(failed ? 1 : 0);
