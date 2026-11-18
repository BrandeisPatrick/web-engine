// Runs every headless suite (`npm test`): each file is a standalone Node script that exits non-zero on failure; suites
// that build world geometry need the no-op canvas shim. The suites run in parallel, a pool of (CPUs - 1) processes
// (`--jobs=N` to change it, `--jobs=1` runs them one by one), and each suite's output is printed in one block when it
// ends. `slow` suites start first, so the longest one does not start last. `alone` suites run one at a time after the
// pool, on a quiet machine, because a loaded one moves a reading they hold to a tight limit:
//   - CPU work timed against a limit under 10x its idle reading (on an M4 with every suite in the pool, car-visual's
//     sedan build took 172 of its 400 ms, 78 idle; every other timed check stayed at least 6x under its limit);
//   - a retained heap (heapUsed after gc, one reading) held to a few KB: heapUsed counts code space, and under load a
//     background compile can finish inside the window (dyn-soft read 1.38 KB of its 1 KB once, -0.08 otherwise).
//     The GC-free windows of test/helpers/alloc.mjs count bytes per call over hundreds of calls or more: they held.
// Mark a new suite `alone` by the same rules. Add new suites here, keep car-sim first (it is the determinism gate for
// the roadster vehicle model).
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const SHIM = here('./helpers/dom-shim.mjs');
const SUITES = [
  { file: 'car-sim.mjs' },
  { file: 'world-build.mjs', shim: true },
  { file: 'world-lights.mjs', shim: true },
  // alone: 1e6 event emits in 21 ms idle, limit 150 (44 under load)
  { file: 'core.mjs', alone: true },
  // the Engine's start-up and failure paths: warmUp (dt 0, no fixed step, GPU fence polled), lost context, frame errors
  { file: 'engine-start.mjs' },
  { file: 'look-stats.mjs' },
  { file: 'memory.mjs' },
  { file: 'texture-manifest.mjs' },
  // world: the high-detail vehicle level (lod 'hd'), with LOD 0 / 1 pinned byte-identical
  { file: 'vehicles-hd.mjs', shim: true },
  // createCarVisual: every HD type, wheels on the physics within 1 cm, a 10 s drive, lamps, contact shadow
  // (alone: each type builds in under 400 ms, 78 idle, 172 under load)
  { file: 'car-visual.mjs', alone: true },
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
  // alone: retained heap over 4800 substeps under 4 KB
  { file: 'dyn-joints.mjs', alone: true },
  { file: 'dyn-world.mjs', slow: true },
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
  { file: 'dyn-cloth.mjs', slow: true },
  { file: 'cloth-mesh.mjs' },
  // alone: retained heap over 500 steps under 1 KB
  { file: 'dyn-soft.mjs', alone: true },
  // alone: the cloth collider step in under 20 ms (4 idle); the hooks' retained heap under 4 KB
  { file: 'dyn-buoyancy.mjs', alone: true },
  { file: 'dyn-fracture.mjs', slow: true },
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
const jobs = /^--jobs=(\d+)$/.exec(process.argv.find((a) => a.startsWith('--jobs=')) || '');
const JOBS = Math.max(1, jobs ? +jobs[1] : availableParallelism() - 1);
const logs = mkdtempSync(join(tmpdir(), 'vibe-test-'));
const failures = [];
let ran = 0;

// One suite, its output into a file (a file is written synchronously, a pipe on macOS is not: a suite's last lines
// before process.exit() could be lost), printed whole when the suite ends.
function run(s) {
  const file = here(`./${s.file}`);
  if (!existsSync(file)) { console.log(`skip  ${s.file} (missing)`); return; }
  const log = join(logs, `${s.file}.log`), fd = openSync(log, 'w'), t = performance.now();
  const child = spawn(process.execPath, s.shim ? ['--import', SHIM, file] : [file], { stdio: ['ignore', fd, fd] });
  closeSync(fd);
  return new Promise((done) => child.on('close', (code, signal) => {
    const ms = Math.round(performance.now() - t);
    process.stdout.write(readFileSync(log, 'utf8'));
    ran++;
    if (code !== 0) { failures.push(s.file); console.log(`FAIL  ${s.file} (exit ${code ?? signal}, ${ms} ms)`); } else console.log(`ok    ${s.file} (${ms} ms)`);
    done();
  }));
}
// The suites, at most n at a time, in the order given.
async function pool(suites, n) {
  const queue = [...suites];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
}

const t0 = performance.now();
const alone = SUITES.filter((s) => s.alone), rest = SUITES.filter((s) => !s.alone);
await pool([...rest.filter((s) => s.slow), ...rest.filter((s) => !s.slow)], JOBS);
await pool(alone, 1);
rmSync(logs, { recursive: true, force: true });
console.log(`\n${ran - failures.length}/${ran} suites passed in ${Math.round(performance.now() - t0)} ms (${JOBS} at a time, then ${alone.length} alone)`);
if (failures.length) console.log(`failed: ${failures.join(', ')}`);
process.exitCode = failures.length ? 1 : 0; // no process.exit(): it could cut off the output still being written
