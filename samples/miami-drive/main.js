// Neon Coast: a dusk drive through Miami Beach. The engine's showcase for asset quality (a code-built 90s coupe with
// clear-coated paint, glass, lamps that light the road), driving feedback (chase camera, synth engine / tyres /
// wind, skid marks, smoke, sparks, rumble) and physics (VehicleController on an OpenStreetMap city, traffic, props on
// the DynamicsWorld knocked about by the car, a beach ramp).
//
// Wiring: resolveQuality() picks the tier ('desktop' | 'mobile', ?quality= forces one, the gear menu stores one);
// its groups are spread into Engine / MapWorld (Atmosphere, lights, streaming, traffic) / PostFX, and this demo's own
// budgets go through `overrides`. World (world.js): MapWorld + the `miami` plugin (neon, beach, wet asphalt, extra
// clustered lights) + the `miamiBuildings` plugin (buildings.js: the district's buildings, ?bld=engine for the generic
// builder). Car (car.js on car-model.js / car-sdf.js / spec.js). Props + ramps (props.js). Sound (audio.js).
// HUD (hud.js). Harness: window.__sample (poses chase / strip / beach / car, knobs), window.__miami for the console.
// Query: ?quality=desktop|mobile, ?t=dusk|night|noon|golden|<hours>, ?bench=1&size=WxH, ?notraffic, ?nofx=1, ?profile=N.
import * as THREE from 'three';
import {
  Engine, PostFX, ChaseRig, VehicleInput, PAD_BUTTONS as B, PAD_AXES as AX, inputRamp, LoadingScreen,
  createBenchHarness, readBenchParams, resolveQuality, isTouchDevice, lutFromFunction, DEFAULT_GRADE, TextureSets, loadTextureSet, loadTextureManifest,
} from '@vibe/engine';
import { createMemoryTrim } from '@vibe/engine/render';
import { QualityMenu } from '@vibe/engine/ui';
import { MapWorld, ExtraLights, miamiPlugin, miamiWorldOptions, prepareMiamiData, MIAMI_MAP_URL, MIAMI_PRESETS } from './world.js';
import { buildCarModel } from './car-model.js';
import { HeroCar } from './car.js';
import { Props, rampHeight } from './props.js';
import { CarAudio } from './audio.js';
import { HUD, ACCENT, applyTheme } from './hud.js';
import { DuskSky } from './sky.js';
import { loadCarGlb } from './car-glb.js';
import { buildRoadside } from './roadside.js';
import { buildNearPalms } from './palm.js';
import { miamiBuildingsPlugin } from './buildings.js';

const params = new URLSearchParams(location.search);
const flag = (k) => params.has(k) && params.get(k) !== '0';
const NOFX = flag('nofx');
const BASE = import.meta.env.BASE_URL;

// ------------------------------------------------------------------ quality tiers (this demo's budgets as overrides)
const Q = resolveQuality({
  overrides: {
    desktop: {
      engine: { maxPixelRatio: 1.5 }, // 2268x1473 on a 14" Retina under TAA: see the bench table (native 3024x1964 is ~18 ms)
      shadows: { cascades: 2, kernel: 'fast' },
      postfx: { gbuffer: true, aa: 'taa', ssr: { scale: 0.4, steps: 20, maxRoughness: 0.55, maxDistance: 90, thickness: 0.5, jitter: false, denoise: 4, interval: 2 }, volumetric: { scale: 0.25, steps: 12, intensity: 0.55, density: 1.2 }, motionBlur: { strength: 0.45, samples: 6, maxBlur: 16 } },
      lights: { clustered: true, clusteredRange: 85 },
      world: { streamRadius: 800, traffic: 70, trafficHd: { count: 3, radius: 22, midCount: 10, midRadius: 60, parked: true } },
      car: { lod: 'high' },
      effects: { particles: 1, decals: 1 },
    },
    mobile: {
      engine: { maxPixelRatio: 1.25 },
      shadows: { cascades: 1, kernel: 'fast', singleMapSize: 1024 },
      postfx: { gbuffer: false, aa: 'fxaa', ssr: false, volumetric: false, motionBlur: 0 },
      lights: { clustered: false },
      world: { streamRadius: 420, traffic: 24, trafficHd: { count: 0, midCount: 4, midRadius: 35, parked: true } },
      textures: { maxSize: 1024 },
      car: { lod: 'low' },
      effects: { particles: 0.35, decals: 0.5 },
    },
  },
});
const QS = Q.settings;
const MOBILE = Q.tier === 'mobile';

// ------------------------------------------------------------------ input
const PEDAL = inputRamp(0.14, 0.07), STEER = inputRamp(0.2, 0.09);
const ACTIONS = {
  throttle: { type: 'axis', range: [0, 1], smoothing: PEDAL, bindings: ['KeyW', 'ArrowUp', { padButton: B.RT }, { virtual: 'gas' }] },
  brake: { type: 'axis', range: [0, 1], smoothing: PEDAL, bindings: ['KeyS', 'ArrowDown', { padButton: B.LT }, { virtual: 'brake' }] },
  steer: { type: 'axis', range: [-1, 1], smoothing: STEER, bindings: [
    { key: 'KeyD', value: 1 }, { key: 'ArrowRight', value: 1 }, { key: 'KeyA', value: -1 }, { key: 'ArrowLeft', value: -1 },
    { padAxis: AX.LX }, { virtual: 'stick.x' }] },
  handbrake: { type: 'button', bindings: ['Space', { padButton: B.B }, { padButton: B.RB }, { virtual: 'hb' }] },
  lookBack: { type: 'button', bindings: ['KeyB', { padButton: B.DOWN }] },
  toggleCamera: { type: 'button', bindings: ['KeyC', { padButton: B.Y }, { virtual: 'cam' }] },
  reset: { type: 'button', bindings: ['KeyR', { padButton: B.X }, { virtual: 'reset' }] },
  toggleHelp: { type: 'button', bindings: ['KeyH', { padButton: B.BACK }, { virtual: 'help' }] },
  mute: { type: 'button', alwaysOn: true, bindings: ['KeyM'] },
};
const TIME_KEYS = ['dusk', 'night', 'golden', 'noon'];
const TIME_ACTIONS = TIME_KEYS.map((name, i) => { const a = `time.${name}`; ACTIONS[a] = { type: 'button', alwaysOn: true, bindings: [`Digit${i + 1}`] }; return a; });
const TOUCH = [
  { type: 'stick', id: 'stick', side: 'left', x: 112, y: 112, radius: 62, floating: true },
  { type: 'button', id: 'gas', label: 'GAS', side: 'right', x: 78, y: 112, size: 84 },
  { type: 'button', id: 'brake', label: 'BRK', side: 'right', x: 178, y: 86, size: 62 },
  { type: 'button', id: 'hb', label: 'HB', side: 'right', x: 178, y: 168, size: 52 },
  { type: 'button', id: 'cam', label: 'CAM', side: 'right', x: 36, y: 172, size: 42, top: true, fontSize: 10 },
  { type: 'button', id: 'reset', label: 'RST', side: 'right', x: 88, y: 172, size: 42, top: true, fontSize: 10 },
  { type: 'button', id: 'help', label: '?', side: 'left', x: 36, y: 300, size: 40, top: true },
];

// ------------------------------------------------------------------ the grade: low key, one warm hue family
// After sunset the frame is a near-silhouette lit by the sky: fixed low exposure (no eye adaptation brightening the
// dark), neutral-warm blacks (no teal / blue split toning), restrained saturation, bloom only on lamp cores (high
// threshold, small radius), a slight vignette and fine grain. DUSK_EXPOSURE is the look knob (?exposure= overrides).
const DUSK_EXPOSURE = +(new URLSearchParams(location.search).get('exposure') || 0.62);
const DUSK_GRADE = DEFAULT_GRADE.map((g) => {
  const dusk = g.el < 6 && g.el > -20;
  return {
    ...g,
    aeS: 0,
    exp: dusk ? g.exp * DUSK_EXPOSURE : g.exp,
    sat: dusk ? 0.82 : g.sat, con: dusk ? g.con + 0.04 : g.con,
    wb: dusk ? [1.04, 1.0, 0.94] : g.wb,
    sh: dusk ? [0.004, 0.001, -0.004] : g.sh, hi: dusk ? [0.01, 0.004, -0.01] : g.hi, split: dusk ? 0.6 : g.split,
    bT: dusk ? 4.5 : g.bT, bS: dusk ? 0.2 : g.bS, bR: dusk ? 0.28 : g.bR,
    vig: dusk ? 0.5 : g.vig, grain: dusk ? 0.03 : g.grain,
  };
});
/** A filmic display LUT: a long toe (the darks sink without crushing), warm-neutral shadows, a soft shoulder. */
function duskLut() {
  return lutFromFunction(17, (r, g, b, out) => {
    const c = [r, g, b];
    for (let i = 0; i < 3; i++) {
      const v = Math.min(1, Math.max(0, c[i]));
      const toe = v * v / (v + 0.06) * 1.06;              // long toe
      out[i] = Math.min(1, toe < 0.8 ? toe : 0.8 + (toe - 0.8) * 0.6);
    }
    const l = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2], sh = Math.max(0, 1 - l * 2.4);
    // the darks go towards a neutral grey (photographic shadows carry little chroma)
    for (let i = 0; i < 3; i++) out[i] = out[i] + (l - out[i]) * 0.75 * sh;
  }, 'miami-dusk');
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

async function boot() {
  const t0 = performance.now();
  applyTheme();
  const loading = new LoadingScreen({ title: 'NEON COAST', label: 'Loading Miami Beach…', accent: ACCENT, background: '#0d0714' });
  const touch = isTouchDevice();
  const engine = new Engine({
    container: document.getElementById('app'), fixedHz: 120, maxSubsteps: 4, renderer: { antialias: NOFX }, far: 5000, fov: 60,
    profile: params.get('profile') ? +params.get('profile') : false, ...QS.engine,
  });
  const { scene, camera, renderer } = engine;
  // the demo's texture sets (Poly Haven, CC0) live in public/miami/textures (~20 MB of JPGs); phones read an empty
  // manifest (textures-lite: every layer procedural, nothing to download) and fetch only the beach sand (~2 MB)
  TextureSets.configure({ base: MOBILE ? `${BASE}miami/textures-lite/` : `${BASE}miami/textures/`, basisPath: `${BASE}miami/basis/` }); // KTX2 maps (tools/compress-textures.mjs); the transcoder lives with the demo
  // desktop: the tier's anisotropy (8, not the GPU's 16x: grazing roads at 3024x1964); mobile keeps the GPU maximum,
  // the look its image guard holds (and it is inside its budget)
  if (!MOBILE) TextureSets.configure({ maxAnisotropy: QS.textures.anisotropy });
  const tParam = params.get('t');
  const timeOfDay = tParam == null ? 'dusk' : Number.isFinite(+tParam) ? +tParam : tParam;

  // ---------------------------------------------------------------- world
  const mapP = fetch(MIAMI_MAP_URL).then((r) => { if (!r.ok) throw new Error(`city.json ${r.status}`); return r.json(); });
  const sandP = loadTextureManifest(`${BASE}miami/textures/`).then((m) => loadTextureSet('coast_sand_01', { renderer, base: `${BASE}miami/textures/`, manifest: m })).catch(() => null);
  loading.setProgress(0.02, 'Reading the map…');
  const map = prepareMiamiData(await mapP);
  const extra = QS.lights.clustered ? new ExtraLights(128) : null;
  const plugin = miamiPlugin({ lights: extra, lod: QS.car.lod, sand: await sandP, maxLights: 20, boardwalkLamps: false, wet: flag('wet'), decoTrim: params.get('bld') === 'engine' });
  const mbld = params.get('bld') === 'engine' ? null : miamiBuildingsPlugin({ tier: Q.tier }); // the Miami buildings (buildings.js); ?bld=engine: the generic builder
  const world = new MapWorld(miamiWorldOptions({
    scene, renderer, map, q: { ...QS, world: { ...QS.world, traffic: flag('notraffic') ? 0 : QS.world.traffic } }, timeOfDay, plugins: [plugin, mbld], camera,
  }));
  engine.addSystem(world.system({ camera, loadWeight: 6 }), 'world');
  const W = {};
  engine.addSystem({
    async load(progress) {
      progress(0.1, 'Building the car…'); await nextFrame();
      // the hero model: ?car=concept (the Khronos Car Concept glTF, desktop) or ?car=sedan (the generated sedan)
      const kind = params.get('car') || (MOBILE ? 'sedan' : 'concept');
      if (kind === 'concept' && !MOBILE) {
        W.model = await loadCarGlb({ url: `${BASE}miami/models/car-concept.glb`, paint: 0x4c0a20 })
          .catch((e) => { console.warn('[miami] car glb unavailable, using the generated sedan', e); return null; });
      }
      if (!W.model) W.model = buildCarModel({ lod: QS.car.lod, paint: 0x5c0c18 });
      progress(1, 'Ready');
    },
  }, 'car-load');
  await engine.load((p, label) => loading.setProgress(0.04 + 0.92 * p, label));
  const atmo = world.atmo;
  // memory: the road network keeps its build buffers (plain JS arrays of every road / sidewalk vertex, ~60 MB of heap)
  // after the meshes exist; nothing reads them after load
  world.trimMemory(renderer); // (frees the network's build buffers; the scene-wide trim below keeps sweeping)
  // (the static world meshes drop their CPU vertex arrays through the heap trim below: createMemoryTrim)
  console.info('[miami] world', world.stats, 'plugin', plugin.stats, 'car', W.model.stats);

  // ---------------------------------------------------------------- physics: the ground gets the sand and the ramps
  const physics = world.physics;
  const spawn = world.getSpawn();
  const sx = -Math.sin(spawn.headingRad), sz = -Math.cos(spawn.headingRad);
  const ramps = [];
  if (plugin.beachRows && plugin.beachRows.length) {
    // the ramp on the beach nearest the spawn's z, pointing north along the sand
    let best = plugin.beachRows[0];
    for (const R of plugin.beachRows) if (Math.abs(R.z - spawn.position.z) < Math.abs(best.z - spawn.position.z)) best = R;
    const rx = best.x0 + (best.x1 - 22 - best.x0) * 0.42, rz = best.z + 30;
    ramps.push({ x: rx, z: rz, yaw: 0, len: 9, width: 4.5, height: 1.5, y: plugin.sandHeight(rx, rz) });
  }
  const baseGround = (x, z, y) => world.getGroundHeight(x, z, y, 0.35);
  physics.setHeightfield((x, z, y) => {
    let h = baseGround(x, z, y);
    const s = plugin.sandHeight ? plugin.sandHeight(x, z) : -Infinity;
    if (s > -Infinity && (y === undefined || y < s + 3)) h = Math.max(h, s);
    if (ramps.length) { const r = rampHeight(ramps, x, z); if (r > 0) h += r; }
    return h;
  });
  const SAND = { mu: 0.74, crr: 5, tag: 'sand' }, ASPHALT = { mu: 1, crr: 1, tag: 'asphalt' }, GRAVEL = { mu: 0.82, crr: 2.2, tag: 'gravel' };
  physics.setSurfaceProvider((x, z, out) => {
    const rs = plugin.duneRoad ? plugin.duneRoad.surfaceAt(x, z) : null;
    if (rs === 'road') return ASPHALT;
    if (rs === 'gravel') return GRAVEL;
    if (plugin.sandHeight && plugin.sandHeight(x, z) > -Infinity && rampHeight(ramps, x, z) === 0) return SAND;
    return world.surfaceAt(x, z, out);
  });

  // ---------------------------------------------------------------- post-processing
  let postfx = null;
  const lut = duskLut();
  if (!NOFX) {
    try {
      const { width, height } = engine.size;
      postfx = new PostFX(renderer, scene, camera, {
        atmosphere: atmo, width, height, pixelRatio: engine.pixelRatio, grade: DUSK_GRADE,
        ao: { radius: 1.4, thickness: 1.2, samples: 6, maxPixels: 0.45e6 }, bloom: { strength: 0.2, radius: 0.28, threshold: 4.5 }, autoExposure: false,
        ...QS.postfx, lut: { texture: lut.texture, size: lut.size, strength: 1 },
      });
      postfx.aoPass.enabled = !!QS.passes.ao; postfx.bloomPass.enabled = QS.passes.bloom !== false;
    } catch (e) { console.warn('[miami] post-processing unavailable', e); atmo.setFogMode('scene'); postfx = null; }
  }
  // dusk / night: the shadow caster is the moon (the sun is below the horizon) and its shadows are faint, so the near
  // map re-renders every 3rd frame (three refreshes a shadow matrix only when it renders the map, so the pair stays
  // consistent; the far cascades are already round-robin in the Atmosphere)
  // below the horizon the moon is the caster: its shadows are faint, so trees, buildings and street furniture stop
  // casting (the car, the props and the palms by the beach still do); re-applied every 60 frames (tiles stream in)
  let casterLow = null, casterT = 0; // casterT: frames since the last full pass
  const casterRe = /^(veg-|buildings|building-|context-blocks|street-furniture|parked-cars|deco-trim|sidewalks)/;
  const syncCasters = (force) => {
    const low = atmo.sunDir.y < 0;
    if (!force && low === casterLow) return;
    casterLow = low;
    scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh || o.isBatchedMesh) && casterRe.test(o.name)) { if (o.userData.cast0 === undefined) o.userData.cast0 = o.castShadow; o.castShadow = low ? false : o.userData.cast0; } });
  };
  let shadowFrame = 0, probeFrame = 0;
  const hold = { still: false }; // the bench harness holds TAA still (quiet): every harness frame resolves from a fresh history
  const nearShadow = atmo.sun.shadow;
  engine.renderFn = (sc, cam, dt) => {
    const low = atmo.sunDir.y < 0;
    nearShadow.autoUpdate = !low;
    if (low && (shadowFrame++ % 3) === 0) nearShadow.needsUpdate = true;
    if (casterLow === null || ++casterT >= 60) { casterT = 0; syncCasters(true); } else syncCasters(false);
    if (hold.still && postfx && postfx.taaPass) postfx.taaPass._reset = true;
    if (postfx) postfx.render(dt); else { renderer.render(sc, cam); atmo.renderFlare(renderer, cam); }
    if (!hold.still && (++probeFrame & 3) === 0) car.updateProbe(1); // after the main pass (its shadow maps are this frame's); a face every 4th frame (a full cube in 24 frames)
  };
  engine.onResize = (w, h, pr) => { if (postfx) postfx.setSize(w, h, pr); world.setSize(w, h, pr); };
  world.setSize(engine.size.width, engine.size.height, engine.pixelRatio);

  // ---------------------------------------------------------------- the car
  const car = new HeroCar({ scene, renderer, physics, model: W.model, lights: extra, lod: QS.car.lod, effects: QS.effects.particles, postfx, atmosphere: atmo });
  if (!MOBILE) {
    car.enableProbe(scene, 128);
    // the bay / ponds sample the main view's scene copy (refraction): not drawn into the probe
    if (world.waterfront && world.waterfront.water) car.probe.hide.push(world.waterfront.water.mesh);
    if (world._ponds) car.probe.hide.push(world._ponds);
  }
  const placeCar = (x, z, heading) => { car.reset(x, physics.getGroundHeight(x, z, 50), z, heading); car.updateProbe(6); };
  // the drive starts on the Dune Road, 70 m short of its first crest, northbound towards the afterglow
  const START = plugin.duneRoad ? plugin.duneRoad.start(70) : { x: spawn.position.x, z: spawn.position.z, heading: spawn.headingRad };
  placeCar(START.x, START.z, START.heading);
  // the photographic dusk sky (sky.js), its glow at the Dune Road's vanishing point
  const sky = await new DuskSky({ scene, renderer, atmo, 
    glowAzimuth: START.dir ? Math.atan2(START.dir[0], -START.dir[1]) : 0, exposure: 1 }).load().catch((e) => { console.warn('[miami] dusk sky unavailable', e); return null; });
  if (sky) car.sceneEnvWhen = () => sky.active; // phones: the paint reflects the graded dome (desktop: the live probe)
  if (sky) { sky.update(camera); engine.addSystem({ lateUpdate: () => sky.update(camera) }, 'sky'); }
  // the roadside from free scans (roadside.js): gravel ground, scanned pebbles / rocks, scrub and grass impostors
  const roadside = plugin.duneRoad && !flag('noroadside') ? await buildRoadside({ road: plugin.duneRoad, base: `${BASE}miami/roadside/`, roadBase: `${BASE}miami/road/`, renderer, scene, lod: QS.car.lod })
    .catch((e) => { console.warn('[miami] roadside scans unavailable', e); return null; }) : null;
  // memory: the engine's heap trim (render/Memory.js) over the whole scene: static meshes drop their vertex arrays and
  // data / compressed textures >= 1 MB (KTX2 mip chains, the 2k road / bank scans listed in the corridor material's
  // userData.u, the impostor atlases) drop their pixels once uploaded; re-swept every 3 s for late content
  const memTrim = flag('notrim') ? { update() {}, sweep() {} } : createMemoryTrim(scene, { renderer });
  engine.addSystem({ lateUpdate: (dt) => memTrim.update(dt || 0) }, 'memory-trim');
  // the detailed near palms (palm.js, desktop): placed where the cheap coconut palms stand, dithered in within 52 m
  const nearPalms = !MOBILE && plugin.palmInstances && plugin.palmInstances.length ? buildNearPalms(plugin.palmInstances, { near: 52, fade: plugin.palmFade }) : null;
  if (nearPalms) { scene.add(nearPalms.group); console.info('[miami] near palms', nearPalms.stats); engine.addSystem({ lateUpdate: (dt) => nearPalms.update(camera, hold.still ? 0 : dt || 1 / 60) }, 'near-palms'); if (car.probe) car.probe.hide.push(nearPalms.group); }
  if (roadside && car.probe) car.probe.hide.push(roadside.group); // (the paint's probe does not need the near-field plants)
  if (roadside) { console.info('[miami] roadside', roadside.stats); engine.addSystem({ lateUpdate: (dt) => roadside.update(camera, atmo.darkness, hold.still ? 0 : dt || 1 / 60) }, 'roadside'); } // (the wind holds still for harness captures)

  // ---------------------------------------------------------------- props: cones down Ocean Drive, café sets by the neon, bins, the beach stack
  const spots = [];
  const P0 = spawn.position, rx = -sz, rz = sx; // right of the spawn heading
  for (let i = 0; i < 9; i++) spots.push({ type: 'cone', x: P0.x + sx * (45 + i * 5) + rx * (i % 2 ? 1.3 : -1.3), z: P0.z + sz * (45 + i * 5) + rz * (i % 2 ? 1.3 : -1.3) });
  let cafes = 0;
  for (const s of plugin.signs) {
    if (s.kind !== 'h' || cafes >= (MOBILE ? 8 : 18)) continue;
    if ((s.x - P0.x) ** 2 + (s.z - P0.z) ** 2 > 600 * 600) continue;
    const nx = Math.sin(s.yaw), nz = Math.cos(s.yaw), ux = Math.cos(s.yaw), uz = -Math.sin(s.yaw);
    const cx = s.x + nx * 3.2, cz = s.z + nz * 3.2;
    if (physics.queryStatic(cx, cz, 1.2, []).some((b) => b.maxY > physics.getGroundHeight(cx, cz, 50) + 0.4)) continue;
    spots.push({ type: 'table', x: cx, z: cz });
    spots.push({ type: 'chair', x: cx + ux * 0.8, z: cz + uz * 0.8, yaw: s.yaw + Math.PI / 2 });
    spots.push({ type: 'chair', x: cx - ux * 0.8, z: cz - uz * 0.8, yaw: s.yaw - Math.PI / 2 });
    spots.push({ type: 'chair', x: cx + nx * 0.85, z: cz + nz * 0.85, yaw: s.yaw });
    if (cafes % 2 === 0) spots.push({ type: 'bin', x: cx + ux * 2.6, z: cz + uz * 2.6 });
    cafes++;
  }
  if (ramps.length) {
    const r = ramps[0];
    // a stack of cardboard boxes past the landing and crates beside it
    const bx = r.x + 1.5, bz = r.z - r.len - 58; // just past where a 100 km/h jump lands
    for (let lx = 0; lx < 3; lx++) for (let ly = 0; ly < 4; ly++) for (let lz = 0; lz < 2; lz++) {
      spots.push({ type: 'box', x: bx + (lx - 1) * 0.58, y: (r.y ?? 0) + ly * 0.49, z: bz + (lz - 0.5) * 0.58 });
    }
    for (let k = 0; k < 4; k++) spots.push({ type: 'crate', x: bx + 3 + (k % 2) * 0.75, y: (r.y ?? 0) + Math.floor(k / 2) * 0.73, z: bz + 2 });
    for (let k = 0; k < 6; k++) spots.push({ type: 'cone', x: r.x - 2.6 + (k % 2) * 5.2, z: r.z + 2 + Math.floor(k / 2) * 4 });
  }
  for (const b of plugin.beachProps || []) spots.push(b);
  const props = new Props({ scene, physics, spots, ramps, lod: QS.car.lod });

  // ---------------------------------------------------------------- street names (nearest named road, coarse grid)
  const streets = buildStreetIndex(world.data.roads);
  const streetName = (p) => (plugin.duneRoad && plugin.duneRoad.surfaceAt(p.x, p.z) ? 'Dune Road' : streets.at(p.x, p.z));

  // ---------------------------------------------------------------- input, camera, audio, HUD
  const input = new VehicleInput(renderer.domElement, { actions: ACTIONS, touchLayout: TOUCH, touch: touch ? true : false });
  const hud = new HUD({ world, touch: !!(input.touch && input.touch.visible) });
  const audio = new CarAudio({ volume: 0.7 });
  audio.bus.unlockOnGesture();
  const menu = new QualityMenu({ quality: Q, corner: 'tr' });
  void menu;
  const rig = new ChaseRig(camera, renderer.domElement, { minY: 0.6, physics, canopyFromCollider: null, thinKinds: [3, 'vehicle'], flightFraming: false, shakeScale: 0.7 });
  Object.assign(rig, { distMin: 7.6, distMax: 8.8, heightMin: 2.2, heightMax: 2.6, fovMin: 45, fovMax: 70, speedForMax: 62 });
  rig.offsets.hood.set(0, 1.12, -0.6);
  rig.offsets.cockpit.set(-0.36, 1.08, 0.1);
  rig.setTarget(car.object3d, () => car.state);
  rig.activate(); rig.snap();
  // impact kick on top of the rig's own shake (decays in ~0.4 s)
  const kick = { amp: 0, t: 0 };

  // ---------------------------------------------------------------- systems
  let timeIdx = 0;
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt);
      const m = input.map;
      for (let k = 0; k < TIME_ACTIONS.length; k++) if (m.justPressed(TIME_ACTIONS[k])) { timeIdx = k; atmo.setTimeOfDay(TIME_KEYS[k]); hud.flash.show(TIME_KEYS[k]); }
      if (m.justPressed('mute')) hud.flash.show(audio.toggleMute() ? 'MUTED' : 'SOUND ON');
      if (input.toggleHelp) hud.toggleHelp();
      if (input.toggleCamera) hud.flash.show(`CAMERA · ${rig.cycleMode().toUpperCase()}`);
      if (input.reset) { resetToRoad(); hud.flash.show('BACK ON THE ROAD'); }
      rig.setLookBack(input.lookBack);
      car.setInput(input, true);
    },
  }, 'input');
  engine.addSystem({
    fixedUpdate(dt) {
      car.fixedUpdate(dt);
      const hit = props.couple(car);
      if (hit > 1) { car.events.prop = Math.max(car.events.prop || 0, hit); }
      props.step(dt);
    },
    update(dt, alpha) {
      car.update(dt, alpha, atmo.darkness);
      props.render();
      // events -> camera kick, sparks, sound, rumble
      const ev = car.events;
      if (ev.impact > 2.5) {
        const s = Math.min(1, ev.impact / 14);
        kick.amp = Math.max(kick.amp, 0.01 + 0.03 * s);
        audio.thump(0.2 + 0.7 * s);
        const p = car.object3d.position, v = car.vc.velocity, l = Math.hypot(v.x, v.z) || 1;
        if (ev.impact > 5) car.sparkBurst(p.x + v.x / l * 2.2, p.y + 0.5, p.z + v.z / l * 2.2, Math.round(20 + 40 * s * QS.effects.particles), s);
        input.map.gamepad.rumble(0.3 + 0.7 * s, 140 + 200 * s);
      }
      if (ev.landing > 2) { const s = Math.min(1, ev.landing / 8); kick.amp = Math.max(kick.amp, 0.008 + 0.02 * s); audio.thump(0.15 + 0.5 * s); input.map.gamepad.rumble(0.25 + 0.6 * s, 160); }
      if (ev.scrape > 4) { const p = car.object3d.position; car.sparkBurst(p.x, p.y + 0.1, p.z, 6, 0.4); }
      if (ev.prop > 1) { audio.knock(Math.min(0.5, ev.prop / 20)); kick.amp = Math.max(kick.amp, 0.004); input.map.gamepad.rumble(0.15, 60); }
      if (car.shifted) audio.backfire();
      ev.impact = 0; ev.landing = 0; ev.scrape = 0; ev.prop = 0;
    },
  }, 'vehicle');
  engine.addSystem({
    update(dt) {
      rig.update(dt);
      if (kick.amp > 1e-4) {
        kick.t += dt;
        camera.rotateX(Math.sin(kick.t * 61) * kick.amp); camera.rotateZ(Math.sin(kick.t * 47 + 1) * kick.amp * 0.6);
        kick.amp *= Math.exp(-dt * 9);
      }
    },
  }, 'camera');
  const aState = { rpm: 900, throttle: 0, speed: 0, slip: 0, grounded: true, surface: 'asphalt', beach: 0, gear: 1 };
  let haptT = 0;
  engine.addSystem({
    lateUpdate(dt) {
      const vc = car.vc;
      aState.rpm = car.rpm; aState.throttle = car.controls.throttle; aState.speed = vc.speed; aState.slip = vc.wheelSlip;
      aState.grounded = vc.grounded; aState.surface = vc.wheels[2].tag || 'asphalt'; aState.gear = car.gear;
      aState.beach = plugin.beachRows ? beachProximity(plugin, car.object3d.position) : 0;
      audio.update(dt, aState);
      // slip rumble on the pad (light, continuous while sliding)
      haptT -= dt;
      if (haptT <= 0 && vc.wheelSlip > 0.35 && vc.grounded && vc.speed > 5) { input.map.gamepad.rumble(0.12 + 0.25 * vc.wheelSlip, 90); haptT = 0.08; }
      hud.update(dt, car, streetName(car.object3d.position), atmo.hours);
    },
  }, 'hud');
  // motion blur only when it shows (speed): the pass costs ~1.3 ms even when the frame is static
  if (postfx && QS.postfx.motionBlur) {
    const mb = typeof QS.postfx.motionBlur === 'object' ? QS.postfx.motionBlur.strength : QS.postfx.motionBlur;
    let on = false;
    postfx.set('motionBlur', 0); // off at rest (the pass costs ~1.4 ms at 2560x1440 even on a static frame)
    engine.addSystem({ lateUpdate() { const want = car.vc.speed > 22; if (want !== on) { on = want; postfx.set('motionBlur', want ? mb : 0); } } }, 'motionblur');
  }
  // water refraction (the scene copy costs ~0.6-1 ms whenever the sea draws) only near the beach, with hysteresis
  if (postfx && QS.postfx.gbuffer && plugin.beachRows) {
    const near = (p) => { const rows = plugin.beachRows, z0 = rows[0].z, st = plugin.beachStep || 2; const R = rows[Math.max(0, Math.min(rows.length - 1, Math.round((p.z - z0) / st)))]; return R ? Math.abs(p.x - (R.x1 - 22)) : 1e9; };
    plugin.refractionAt = (p) => world.setWaterRefraction(near(p) < 240); // the harness poses use it too
    plugin.refractionAt(camera.position);
    engine.addSystem({ lateUpdate() { const d = near(camera.position), on = world.waterRefraction; if (on && d > 260) world.setWaterRefraction(false); else if (!on && d < 220) world.setWaterRefraction(true); } }, 'refraction-range');
  }

  function resetToRoad() {
    const p = car.object3d.position;
    if (plugin.duneRoad && plugin.duneRoad.surfaceAt(p.x, p.z) !== null || (plugin.duneRoad && Math.abs(p.x - plugin.duneRoad.xAt(p.z)) < 25 && p.z > plugin.duneRoad.z0 && p.z < plugin.duneRoad.z1)) {
      const st = plugin.duneRoad.start(p.z - plugin.duneRoad.zCrest);
      const fx = -Math.sin(car.vc.heading), fz = -Math.cos(car.vc.heading);
      if (fx * st.dir[0] + fz * st.dir[1] < 0) { const sb = plugin.duneRoad.start(p.z - plugin.duneRoad.zCrest, -1.7); placeCar(sb.x, sb.z, sb.heading + Math.PI); } else placeCar(st.x, st.z, st.heading);
      rig.snap(); return;
    }
    const r = streets.nearest(p.x, p.z);
    if (!r) { placeCar(START.x, START.z, START.heading); rig.snap(); return; }
    // heading along the road, keeping the car's rough direction
    let h = Math.atan2(-(r.dx), -(r.dz));
    const fwd = car.headingDeg * Math.PI / 180, cur = Math.atan2(-Math.sin(fwd), -(-Math.cos(fwd)));
    void cur;
    const fx = -Math.sin(car.vc.heading), fz = -Math.cos(car.vc.heading);
    if (fx * r.dx + fz * r.dz < 0) h += Math.PI;
    placeCar(r.x, r.z, h); rig.snap();
  }

  // ---------------------------------------------------------------- harness
  renderer.compile(scene, camera);
  const loadMs = Math.round(performance.now() - t0);
  memTrim.sweep();
  // the harness's live frames start renderFn's frame counters at a fixed phase and put them back afterwards
  const cadence = { get: () => [shadowFrame, probeFrame, casterT], set: (c) => { [shadowFrame, probeFrame, casterT] = c; } };
  const harness = makeHarness({ engine, world, atmo, postfx, car, props, rig, placeCar, plugin, spawn, ramps, physics, extra, input, hud, hold, streets, QS, START, sky, roadside, nearPalms, cadence });
  // a resumed loop after bench poses: TAA / volumetric jitter back on
  engine.addSystem({ lateUpdate() { if (hold.still && !harness.frozen) { hold.still = false; if (postfx && postfx.history) postfx.set('jitter', true); if (postfx && postfx.volumetric) { postfx.set('volumetric.jitter', true); postfx.set('volumetric.temporal', true); } } } }, 'unhold');
  window.__miami = { THREE, engine, world, atmo, postfx, car, props, rig, input, audio, hud, plugin, quality: Q, loadMs, physics, ramps, extra, resetToRoad, placeCar, streets };
  console.info(`[miami] ready in ${loadMs} ms · tier ${Q.tier} (${Q.source}, recommended ${Q.recommended}: ${Q.reason}) · car ${W.model.stats.triangles} tris · props ${props.bodies.length} · neon ${plugin.stats.signs} signs`);
  const bp = readBenchParams(location.search); if (bp.size) harness.resize(bp.size.w, bp.size.h);
  harness.setReady();
  engine.start();
  if (bp.enabled) harness.freeze();
  loading.hide(500);
  if (!bp.enabled && !touch && !flag('nohelp')) setTimeout(() => { if (!hud.help.visible) hud.toggleHelp(); setTimeout(() => { if (hud.help.visible) hud.toggleHelp(); }, 6000); }, 600);
}

// ------------------------------------------------------------------ helpers
function beachProximity(plugin, p) {
  const rows = plugin.beachRows, step = plugin.beachStep || 2, z0 = rows[0].z;
  const i = Math.round((p.z - z0) / step);
  const R = rows[Math.max(0, Math.min(rows.length - 1, i))];
  if (!R) return 0;
  const shore = R.x1 - 22;
  return Math.max(0, 1 - Math.abs(p.x - shore) / 160) * (Math.abs(R.z - p.z) < 60 ? 1 : 0.4);
}

/** Nearest named road (name + a point and direction on it) from a 40 m grid of road segments. */
function buildStreetIndex(roads) {
  const C = 40, grid = new Map(), segs = [];
  const key = (i, j) => i * 100003 + j;
  for (const r of roads) {
    if (!r.n || !r.p || r.c === 'footway' || r.c === 'path' || r.c === 'cycleway' || r.c === 'steps') continue;
    for (let k = 0; k < r.p.length - 1; k++) {
      const a = r.p[k], b = r.p[k + 1], id = segs.length;
      segs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], n: r.n, drivable: !/^(pedestrian|service)$/.test(r.c) || r.n });
      const i0 = Math.floor(Math.min(a[0], b[0]) / C), i1 = Math.floor(Math.max(a[0], b[0]) / C), j0 = Math.floor(Math.min(a[1], b[1]) / C), j1 = Math.floor(Math.max(a[1], b[1]) / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const kk = key(i, j); let l = grid.get(kk); if (!l) grid.set(kk, (l = [])); l.push(id); }
    }
  }
  const res = { x: 0, z: 0, dx: 0, dz: 0, name: '' };
  const nearest = (x, z, maxD = 120) => {
    let best = Infinity, bs = null, bt = 0;
    const ci = Math.floor(x / C), cj = Math.floor(z / C), R = Math.ceil(maxD / C);
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
      const l = grid.get(key(i, j)); if (!l) continue;
      for (const id of l) {
        const s = segs[id], dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
        const d = (x - s.ax - dx * t) ** 2 + (z - s.az - dz * t) ** 2;
        if (d < best) { best = d; bs = s; bt = t; }
      }
    }
    if (!bs || best > maxD * maxD) return null;
    const dx = bs.bx - bs.ax, dz = bs.bz - bs.az, L = Math.hypot(dx, dz) || 1;
    res.x = bs.ax + dx * bt; res.z = bs.az + dz * bt; res.dx = dx / L; res.dz = dz / L; res.name = bs.n;
    return res;
  };
  return { nearest, at: (x, z) => { const r = nearest(x, z, 30); return r ? r.name : null; } };
}

function makeHarness({ engine, world, atmo, postfx, car, props, rig, placeCar, plugin, spawn, ramps, physics, extra, input, hud, hold, streets, QS, START, sky, roadside, nearPalms, cadence }) {
  const { camera } = engine;
  // the reference shot: on Ocean Drive, behind the car, looking along the street towards the glow
  const S = spawn.position, h0 = spawn.headingRad;
  const fx = -Math.sin(h0), fz = -Math.cos(h0);
  const look = (cam, px, py, pz, tx, ty, tz) => { cam.position.set(px, py, pz); cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz); };
  const carAt = (x, z, heading) => { placeCar(x, z, heading); car.update(0, 1, atmo.darkness); };
  const rx = -fz, rz = fx; // right of the spawn heading
  // the marquee nearest the spawn on the left (west) side: the car is parked in front of it for the 'car' pose
  let mq = null, md = Infinity;
  for (const s of plugin.signs) {
    if (s.kind !== 'h' || !s.onOcean || s.bh > 24) continue;
    const dx = s.x - S.x, dz = s.z - S.z, along = dx * fx + dz * fz, side = dx * rx + dz * rz;
    if (along < 5 || along > 140 || side > -4) continue;
    const d = along + Math.abs(side) * 0.2;
    if (d < md) { md = d; mq = s; }
  }
  let posed = '';
  // bench frames as played (Bench.js `live`): what a play frame renders differently from a held one. Of the play
  // loop's systems, kept: world.update (the atmosphere's cascade schedule, far map on even frames; lamps, the neon
  // plugin's lights, the clustered light list and its upload), the dusk sky, the near palms' wind, the roadside's
  // impostors, the props' instance matrices, and in renderFn the car's probe (a face every 4th frame) with hold.still
  // off. Left out: input, the car (physics and its visual update: wheels, lamps, dust and exhaust particles, random
  // and cleared for captures), the camera rig (the camera stays at the pose), traffic, the bay's boats and streaming
  // (held: they move vehicles and tiles), motion blur and water refraction (switched by speed and camera distance:
  // constant here), the heap trim (heap tooling on a timer), HUD and audio. The roadside's wind clock stays (dt 0): it
  // is private to roadside.js, so it could not be put back for the next capture, and it only moves a uniform. end()
  // puts back what the frames moved, as after() left it (after() itself is not idempotent: refreshHD; and the neon
  // clock only ever adds).
  // shownT / neonT: the world / neon times after()'s last update showed; palmT: the palms' wind clock; atmoF: the
  // atmosphere's frame count (its far-cascade schedule: a map still flagged when the probe pass runs is rendered there,
  // without the car; after() always leaves one flagged); cad / face: renderFn's frame counters and the probe's next face
  let shownT = 0, neonT = 0, palmT = 0, atmoF = 0, cad = null, face = 0;
  const _lp = new THREE.Vector3();
  const worldStep = (dt) => { // world.update with the traffic, the boats and the streamer held
    const T = world.traffic, tu = T && T.update, St = world.streamer, B = world.waterfront && world.waterfront.boats, bu = B && B.update;
    if (T) T.update = () => {};
    if (B) B.update = () => {};
    world.streamer = null;
    world.update(dt, _lp.copy(camera.position));
    world.streamer = St;
    if (T) T.update = tu;
    if (B) B.update = bu;
  };
  const poses = {
    // the reference shot: on the Dune Road at the start, behind the car, 2.2 m up and 7.6 m back, 45 deg fov, pitched down, the road
    // rising to its crest against the afterglow
    chase: (cam) => {
      posed = 'chase';
      if (world.traffic && world.traffic.group) world.traffic.group.visible = false;
      carAt(START.x, START.z, START.heading);
      const p = car.object3d.position, [dx, dz] = START.dir || [fx, fz];
      cam.fov = 45; cam.updateProjectionMatrix();
      look(cam, p.x - dx * 7.6, p.y + 2.2, p.z - dz * 7.6, p.x + dx * 30, p.y + 0.0, p.z + dz * 30);
    },
    strip: (cam) => {
      posed = 'strip';
      cam.fov = 60; cam.updateProjectionMatrix();
      if (world.traffic && world.traffic.group) world.traffic.group.visible = true;
      carAt(S.x + fx * 92 - rx * 1.5, S.z + fz * 92 - rz * 1.5, h0);
      look(cam, S.x + fx * 75 + rx * 2.5, S.y + 1.6, S.z + fz * 75 + rz * 2.5, S.x + fx * 120 - rx * 20, S.y + 6.5, S.z + fz * 120 - rz * 20);
    },
    beach: (cam) => {
      posed = 'beach';
      cam.fov = 60; cam.updateProjectionMatrix();
      if (world.traffic && world.traffic.group) world.traffic.group.visible = true;
      carAt(S.x, S.z, h0);
      const rows = plugin.beachRows;
      if (!rows) { look(cam, S.x, S.y + 2, S.z, S.x + fx * 60, S.y + 2, S.z + fz * 60); return; }
      // near the waterline, 30 m south of the hut nearest the spawn, looking north along the shore: the hut, the
      // loungers and the lit boardwalk on the left, the surf and the afterglow over the ocean on the right
      let H = null;
      for (const h of plugin.huts || []) if (!H || Math.abs(h.z - S.z) < Math.abs(H.z - S.z)) H = h;
      const z0 = H ? H.z + 30 : S.z;
      let R = rows[0];
      for (const q of rows) if (Math.abs(q.z - z0) < Math.abs(R.z - z0)) R = q;
      const shore = R.x1 - 22, x = shore - 5, y = plugin.sandHeight(x, R.z);
      look(cam, x, (Number.isFinite(y) ? y : 0) + 1.45, R.z, x + 14, 0.7, R.z - 120);
    },
    car: (cam) => {
      posed = 'car';
      cam.fov = 60; cam.updateProjectionMatrix();
      if (world.traffic && world.traffic.group) world.traffic.group.visible = false; // the asset alone (traffic passes the spot)
      carAt(START.x, START.z, START.heading); // at the start, rear three-quarter, against the glow
      const p = car.object3d.position, q = car.object3d.quaternion;
      const o = new THREE.Vector3(-2.3, 1.05, 5.1).applyQuaternion(q); // rear three-quarter, nearly behind: the road, scrub and glow behind, the hotel row out of frame
      look(cam, p.x + o.x, p.y + o.y, p.z + o.z, p.x, p.y + 0.6, p.z);
      void mq;
    },
  };
  return createBenchHarness(engine, {
    name: 'miami-drive',
    poses,
    after: (cam) => {
      // world past its throttles with the traffic held (its worker answers asynchronously: an answer landing between
      // two captures would move the cars)
      const T = world.traffic, tu = T && T.update;
      if (T) T.update = () => {};
      for (let i = 0; i < 3; i++) world.update(1, cam.position);
      if (T) T.update = tu;
      if (T && T.refreshHD) T.refreshHD(cam.position); // the detailed-car rings around the posed camera
      if (roadside) roadside.update(cam, atmo.darkness, 0);
      if (nearPalms) nearPalms.update(cam, 0);
      const cp = car.object3d.position;
      hud.update(0, car, (plugin.duneRoad && plugin.duneRoad.surfaceAt(cp.x, cp.z)) ? 'Dune Road' : streets.at(cp.x, cp.z), atmo.hours); // the minimap / speedo show the posed car
      if (sky) sky.update(cam);
      car.updateProbe(6);
      if (plugin.refractionAt) plugin.refractionAt(cam.position);
      const su = atmo.sky.material.uniforms; su.uTime.value = 0; su.uCloudOffset.value.set(0.13, 0.41);
      shownT = world.time; neonT = plugin.time;
      world.time = 0;
      if (world.mat && world.mat.water && world.mat.water.userData.u) world.mat.water.userData.u.uTime.value = 0;
      props.render();
    },
    quiet: () => {
      rig.deactivate();
      car.smoke.clear(); car.sparks.clear(); car.exhaust.clear(); car.flame.clear();
      if (postfx) { postfx.autoExposure = false; postfx.setTimeOfDay(atmo.darkness); }
      if (postfx && postfx.history) {
        hold.still = true;
        postfx.set('jitter', false);
        if (postfx.volumetric) { postfx.set('volumetric.jitter', false); postfx.set('volumetric.temporal', false); }
        if (postfx.ssr) postfx.set('ssr.jitter', false);
        postfx.history.reset();
        for (let i = 0; i < 48; i++) postfx.render(0);
        postfx.render(0);
      }
      void posed;
    },
    live: {
      begin: () => { // what quiet() holds, as in play: TAA and the volumetric march jittered and accumulating, the probe
        hold.still = false; world.time = shownT; atmoF = atmo._frame; // the clocks go on from what after() shows
        if (postfx && postfx.history) postfx.set('jitter', true);
        if (postfx && postfx.volumetric) { postfx.set('volumetric.jitter', true); postfx.set('volumetric.temporal', true); }
        if (postfx && postfx.ssr) postfx.set('ssr.jitter', QS.postfx.ssr.jitter !== false);
        if (nearPalms) palmT = nearPalms.fade.uTime.value;
        // every run and load the same schedule (Bench.js: a fixed phase): the near map and the probe counted from the
        // far map's frame parity, the casters' 60-frame re-sync outside the run
        cad = cadence.get(); cadence.set([atmoF & 1, atmoF & 1, 0]); face = car.probe ? car.probe.face : 0;
      },
      frame: (dt) => {
        worldStep(dt);
        if (sky) sky.update(camera);
        if (nearPalms) nearPalms.update(camera, dt);
        if (roadside) roadside.update(camera, atmo.darkness, 0);
        props.render();
      },
      end: () => {
        // as after()'s three updates (dt 0, at the shown times): neon, signals, lamps, the light list, the cascades' schedule
        plugin.time = neonT; world.time = shownT; atmo._frame = atmoF - 3;
        for (let i = 0; i < 3; i++) worldStep(0);
        world.time = 0;
        if (nearPalms) nearPalms.fade.uTime.value = palmT;
        cadence.set(cad);
        if (car.probe) car.probe.face = face;
        car.updateProbe(6); // the faces the frames rendered, again in the shown state
        const su = atmo.sky.material.uniforms; su.uTime.value = 0; su.uCloudOffset.value.set(0.13, 0.41);
        if (world.mat && world.mat.water && world.mat.water.userData.u) world.mat.water.userData.u.uTime.value = 0;
      },
    },
    // building tiles stream in after a camera jump: update (traffic held) until the streamer is idle
    async settle() {
      const St = world.streamer; if (!St) return;
      const T = world.traffic, tu = T && T.update;
      let idle = 0;
      for (let k = 0; k < 200 && idle < 3; k++) {
        if (T) T.update = () => {};
        world.update(0.016, camera.position);
        if (T) T.update = tu;
        await new Promise((r) => setTimeout(r, 25));
        idle = St.stats.pending || St.stats.building ? 0 : idle + 1;
      }
    },
    settings: {
      'postfx.ssr': { get: () => !!(postfx && postfx.ssr), set: (v) => { if (postfx && postfx.gbuffer) postfx.set('ssr', v ? QS.postfx.ssr || true : false); } },
      'postfx.ssr.denoise': { get: () => (postfx && postfx.ssr ? postfx.get('ssr.denoise') : 0), set: (v) => { if (postfx && postfx.ssr) postfx.set('ssr.denoise', +v); } },
      'postfx.volumetric': { get: () => !!(postfx && postfx.volumetric), set: (v) => { if (postfx) postfx.set('volumetric', v ? QS.postfx.volumetric || true : false); } },
      'postfx.motionBlur': { get: () => (postfx ? postfx.motionBlur : 0), set: (v) => { if (postfx && postfx.gbuffer) postfx.set('motionBlur', v); } },
      'postfx.ao': { get: () => !!(postfx && postfx.aoPass.enabled), set: (v) => { if (postfx) postfx.aoPass.enabled = !!v; } },
      'postfx.bloom': { get: () => !!(postfx && postfx.bloomPass.enabled), set: (v) => { if (postfx) postfx.bloomPass.enabled = !!v; } },
      'postfx.lut': { get: () => (postfx ? postfx.get('lut.strength') : 0), set: (v) => { if (postfx) postfx.set('lut.strength', +v); } },
      'water.refraction': { get: () => world.waterRefraction, set: (v) => world.setWaterRefraction(!!v) },
      'shadows.kernel': { get: () => atmo.shadowKernel, set: (v) => atmo.setShadowKernel(v) },
      'lights.mode': { get: () => (world.props && world.props.lightPool ? world.props.lightPool.mode : null), set: (v) => world.setLightMode(v) },
      'time': { get: () => atmo.timeOfDay, set: (v) => { atmo.setTimeOfDay(v); if (postfx) postfx.setTimeOfDay(atmo.darkness); } },
      'neon.lights': { get: () => plugin.maxLights, set: (v) => { plugin.maxLights = +v; for (let i = 0; i < 3; i++) world.update(0, camera.position); } },
      'car.probe': { get: () => !!(car.probe && car.probe.on !== false), set: (v) => { if (car.probe) car.probe.on = !!v; } },
      'car.fill': { get: () => car.fill !== false, set: (v) => { car.fill = !!v; car.update(0, 1, atmo.darkness); } },
      'roadside.plants': { get: () => !!(roadside && roadside.opt.plants), set: (v) => { if (roadside) { roadside.opt.plants = !!v; roadside.update(camera, atmo.darkness, 0); } } },
      'roadside.cover': { get: () => !!(roadside && roadside.opt.cover), set: (v) => { if (roadside) { roadside.opt.cover = !!v; roadside.update(camera, atmo.darkness, 0); } } },
      'palms.near': { get: () => !!(nearPalms && nearPalms.group.visible), set: (v) => { if (nearPalms) { nearPalms.group.visible = !!v; nearPalms.fade.uNear.value = v ? 52 : 0; } } },
      'roadside.stones': { get: () => !!(roadside && roadside.opt.stones), set: (v) => { if (roadside) { roadside.opt.stones = !!v; roadside.update(camera, atmo.darkness, 0); } } },
      'road.parallax': { get: () => !!(plugin.duneRoad && plugin.duneRoad.mat.userData.uPx.value > 0.5), set: (v) => { if (plugin.duneRoad) plugin.duneRoad.mat.userData.uPx.value = v ? 1 : 0; } },
      'road.detail': { get: () => !!(plugin.duneRoad && plugin.duneRoad.mat.userData.uDetail.value > 0.5), set: (v) => { if (plugin.duneRoad) plugin.duneRoad.mat.userData.uDetail.value = v ? 1 : 0; } },
      'sky.clouds': { get: () => !!(sky && sky.uniforms && sky.uniforms.uClouds.value > 0.5), set: (v) => { if (sky && sky.uniforms) { sky.uniforms.uClouds.value = v ? 1 : 0; sky.envDirty = true; } } },
      'car.visible': { get: () => car.object3d.visible, set: (v) => { car.object3d.visible = !!v; } },
      'traffic.visible': { get: () => !!(world.traffic && world.traffic.group ? world.traffic.group.visible : true), set: (v) => { if (world.traffic && world.traffic.group) world.traffic.group.visible = !!v; } },
    },
  });
  // (extra, input, physics, MIAMI_PRESETS: available on window.__miami)
}
void MIAMI_PRESETS;

boot().catch((err) => {
  console.error(err);
  const l = document.querySelector('.ui-loading small');
  if (l) l.textContent = `Failed to start: ${err.message}`;
});
