// Night NYC walk: the engine's showcase for buildings and light. A walker (third person, V for first person) in
// Midtown Manhattan baked from OpenStreetMap (samples/public/nyc/map/city.json, tools/bake-map.mjs around 40.7565,
// -73.9865, 1.5 km), after the rain: wet asphalt (wet.js; screen-space reflections on the desktop tier, a city-light
// environment fake on mobile), every street lamp + every sign + the nearest cars' headlights + the traffic signals'
// phase colours as clustered lights (lights.js), invented signage and street frontage (signage.js: framed LED screens,
// corner wraps, rooftop signs, marquees, neon fascias and blades, a news ticker, parallax shop-front interiors,
// entrance canopies, wall lights), people on the sidewalks (pedestrians.js), steam (steam.js), a near-black city
// sky, traffic kept close (MapWorld traffic area / mix: cabs), haze and moonlit volumetrics, TAA, bloom and a night
// grade + LUT (look.js); the JS heap trimmed after load (the engine's world.trimMemory, render/Memory.js).
// Buildings up close: CC0 wall scans with their relief, grime and curtains read in the dusk light (walls.js), shop fronts,
// lobbies and what is fixed to the wall as real geometry (groundfloors.js), window frames and AC units placed from the
// engine's real window layout (windowkit.js), setbacks / crowns / screens / turrets on the tall blocks (crowns.js).
// Quality tiers (core/Quality.js + ui/QualityMenu.js): 'desktop' (G-buffer, TAA, SSR, volumetrics, clustered lights)
// and 'mobile' (forward, FXAA, 8-lamp pool, smaller textures / radius / traffic); ?quality=desktop|mobile forces one.
// Query: ?bench=1&size=WxH (window.__sample: poses avenue / square / sidewalk, settings below), ?notraffic,
// ?nostream=1, ?nofiller, ?nostreet (street.js kit off), ?nowalls (walls.js off), ?keepcpu, ?memlog=1, ?cascades=N, ?touch=1, ?profile=N, ?fps=60. window.__nyc for the console.
import * as THREE from 'three';
import { Engine, Assets, createBenchHarness, readBenchParams, resolveQuality } from '@vibe/engine/core';
import { CharacterController } from '@vibe/engine/physics';
import { PostFX, registerRenderLoaders, TextureSets, ClusteredLights, installClusteredChunks } from '@vibe/engine/render';
import { CharacterInput, PointerLock, CHARACTER_ACTIONS } from '@vibe/engine/input';
import { ThirdPersonRig, FirstPersonRig } from '@vibe/engine/camera';
import { LoadingScreen, QualityMenu } from '@vibe/engine/ui';
import { MapWorld, roadStyle } from '@vibe/engine/world';
import { makeStreetsWet, makeCityEnv } from './wet.js';
import { buildSignage, updateSignage, quietBuildingSigns } from './signage.js';
import { ExtraLights } from './lights.js';
import { Steam } from './steam.js';
import { makeCharacter, Player } from './player.js';
import { Pedestrians } from './pedestrians.js';
import { buildStructures } from './structures.js';
import { CarShadows } from './carshadows.js';
import { buildStreet } from './street.js';
import { gradeFacades } from './facades.js';
import { dressWalls } from './walls.js';
import { buildGroundFloors, Kit, groundMaterial, kitMeshes } from './groundfloors.js';
import { buildWindowKit } from './windowkit.js';
import { buildCrowns } from './crowns.js';
import { AirGlow } from './airglow.js';
import { buildRooftops } from './rooftops.js';
import { nightLooks, nightGrade, nightLut, cityNightSky, duskLooks, cityDuskSky, NYC_SUN, DUSK_HOURS } from './look.js';
import { HUD, ACCENT } from './hud.js';

const params = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL;
const NYC = `${BASE}nyc/`;
const DEG = Math.PI / 180;
const HEIGHT = 1.75;
// map geo frame (tools/bake-map.mjs proj): the bowtie of the square, between 43rd and 47th
const R_EARTH = 6378137;

// ---------------------------------------------------------------- quality tiers (this demo's budgets as overrides)
const Q = resolveQuality({
  storageKey: 'vibe.quality.nyc',
  overrides: {
    desktop: {
      engine: { maxPixelRatio: 1.5, adaptiveResolution: true }, // 2268x1473 on a 14" Retina, as miami-drive: native 3024x1964 is 16.5-18 ms, this 10.7-11.6
      shadows: { cascades: 2, kernel: 'fast', nearMapSize: 2048 },
      postfx: { ssr: { scale: 0.4, steps: 22, refine: 4, maxDistance: 120, thickness: 0.6, maxRoughness: 0.45, edgeFade: 0.2, jitter: false, denoise: 5 }, volumetric: { scale: 0.25, steps: 12, maxDistance: 220, intensity: 1, density: 1 } },
      lights: { clustered: true, clusteredRange: 200 },
      world: { streamRadius: 900, traffic: 110, trafficHd: { count: 3, radius: 18, midCount: 10, midRadius: 50, parked: true } },
      nyc: { pedestrians: 16, signRange: 150, cars: 16, steam: 1, textures: 'textures', pbrSize: 1024, maxScreens: 90, gpuParticles: true },
    },
    mobile: {
      engine: { maxPixelRatio: 1.25, adaptiveResolution: true },
      shadows: { cascades: 1, kernel: 'fast', singleMapSize: 1024 },
      lights: { clustered: false },
      world: { streamRadius: 450, traffic: 36, trafficHd: { count: 0, midCount: 4, midRadius: 30, parked: true } },
      nyc: { pedestrians: 6, signRange: 0, cars: 0, steam: 0.45, textures: 'textures-512', pbrSize: 512, maxScreens: 60, gpuParticles: false },
    },
  },
});
const S = Q.settings, NY = S.nyc, DESK = Q.tier === 'desktop';
const NIGHT = params.get('t') === 'night';
// A/B knobs: ?cascades=1..4, ?shadowkernel=fast|pcf|pcss, ?shadownear=<m> (near cascade half size)
if (params.has('cascades')) S.shadows.cascades = +params.get('cascades') || 1;
if (params.has('shadowkernel')) S.shadows.kernel = params.get('shadowkernel');
if (params.has('shadownear')) S.shadows.near = +params.get('shadownear');

const nextFrame = () => new Promise((r) => setTimeout(r, 0));
// ?memlog=1: JS heap (MB) at each boot stage, after a GC when the page runs with --js-flags=--expose-gc
const memlog = params.has('memlog') ? (label) => { if (globalThis.gc) globalThis.gc(); if (performance.memory) console.info(`[nyc] heap ${label}: ${Math.round(performance.memory.usedJSHeapSize / 1e6)} MB`); } : () => {};

async function boot() {
  const t0 = performance.now();
  const loading = new LoadingScreen({ title: 'MIDTOWN · NIGHT WALK', label: 'Baking the city…', accent: ACCENT, background: '#07080b' });
  memlog('start');
  const engine = new Engine({
    container: document.getElementById('app'), fixedHz: 120, maxSubsteps: 4, far: 3200, fov: 62, renderer: { antialias: false },
    profile: params.get('profile') ? +params.get('profile') : false, targetFps: +params.get('fps') || 0, ...S.engine,
  });
  const { scene, camera, renderer } = engine;
  TextureSets.configure({ base: `${NYC}${NY.textures}/`, manifestIds: true }); // the roles' folders: texture-sets.json ids (walls.js)
  // desktop: the tier's anisotropy (8, not the GPU's 16x: grazing street canyons at 3024x1964); mobile keeps the GPU
  // maximum, the look its image guard holds (and it is inside its budget)
  if (DESK) TextureSets.configure({ maxAnisotropy: S.textures.anisotropy });

  // ---------------------------------------------------------------- the city
  let clustered = null;
  if (S.lights.clustered) {
    installClusteredChunks();
    clustered = new ClusteredLights({ maxLights: 1024, zFar: 420 });
  }
  const world = new MapWorld({
    scene, renderer,
    data: { mapUrl: `${NYC}map/city.json`, farlandUrl: false },
    terrain: false,
    filler: !params.has('nofiller'), // the low context ring beyond the baked square (A/B: ?nofiller)
    // late dusk by default (the afterglow down the cross streets); ?t=night = 1 a.m., ?t=<hours> any hour
    timeOfDay: NIGHT ? 'night' : params.has('t') && Number.isFinite(+params.get('t')) ? +params.get('t') : DUSK_HOURS,
    atmosphere: {
      camera, shadows: S.shadows, sun: NYC_SUN, looks: NIGHT ? nightLooks() : duskLooks(), moonScatter: DESK ? 0.35 : 0.2, moonIntensity: 0.22,
      moon: { azimuth: 200, elevation: 48 }, maxCasterHeight: 420, skyGain: 0.2,
    },
    spawn: { road: /^7th Avenue$/ },
    // Midtown: shop fronts on nearly every street-facing ground floor (Buildings.js storeProb, opt-in)
    buildings: { style: { oldProb: () => 0.42, victorianProb: () => 0.01, storeProb: { prewar: 1, other: 0.95, curtain: 0.92, anyType: true }, storeDressing: false } }, // shop fronts: groundfloors.js
    traffic: params.has('notraffic') ? false : { count: S.world.traffic, seed: 11, hd: params.has('nohd') ? false : S.world.trafficHd, mix: { taxi: 0.3, police: 0.02, bus: 0.04, pickup: 0.02 },
      // a walking game: keep the fleet within ~300 m of the camera (denser streets, same fleet)
      area: { recycleRadius: DESK ? 320 : 260, spawnRadius: DESK ? 250 : 200 } },
    streaming: params.has('nostream') ? false : { radius: S.world.streamRadius, spawnRadius: DESK ? 600 : 400 },
    lights: clustered ? { clustered, clusteredRange: S.lights.clusteredRange, clusteredFade: 30 } : undefined,
    physics: true,
    pbrSize: NY.pbrSize,
  });
  engine.addSystem(world.system({ camera, loadWeight: 6 }), 'world');

  // the character model loads with the world
  const assets = new Assets({ base: NYC });
  registerRenderLoaders(assets, renderer, { ktx2: false, meshopt: false });
  assets.add('character', { type: 'gltf', url: 'models/BusinessMan.glb', weight: 1 });
  if (NY.pedestrians) { assets.add('suit', { type: 'gltf', url: 'models/ManInSuit.glb', weight: 1 }); assets.add('woman', { type: 'gltf', url: 'models/Woman.glb', weight: 1 }); }
  // photographed interiors for the open shops (Poly Haven CC0 indoor HDRIs, tone-mapped to 512 x 256 equirect JPGs) and
  // the night environment for glass, cars and the damp street (a CC0 urban night HDRI, dimmed)
  const loadImage = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  const INTERIORS = ['comfy_cafe', 'decor_shop', 'gear_store', 'warm_bar', 'warm_restaurant_night', 'cinema_lobby'];
  const interiorsP = Promise.all(INTERIORS.map((k) => loadImage(`${NYC}env/${k}.jpg`)));
  const nightEnvP = loadImage(`${NYC}env/modern_buildings_night.jpg`);
  engine.addSystem(assets.system({ loadWeight: 1 }), 'assets');
  try {
    await engine.load((p, label) => loading.setProgress(p, label === 'character' ? 'Waking the walker…' : label));
  } catch (e) {
    if (!e.key) throw e;
    console.warn('[nyc] character model failed to load, using a stand-in', e);
  }
  const loadWorldMs = Math.round(performance.now() - t0);
  memlog('world loaded');
  loading.setProgress(0.97, 'Lighting the signs…');
  await nextFrame();

  // ---------------------------------------------------------------- geo helpers (bake frame -> world)
  const data = world.data, C = data.center, COS0 = Math.cos(C.lat * DEG);
  const geo = (lat, lon) => ({ x: (lon - C.lon) * DEG * R_EARTH * COS0 - world.offset.x, z: -(lat - C.lat) * DEG * R_EARTH - world.offset.z });
  const SQUARE = geo(40.7576, -73.9857);

  if (NIGHT) cityNightSky(world.atmo); else cityDuskSky(world.atmo);
  memlog('sky');
  const trim = params.has('keepcpu') ? null : world.trimMemory(renderer); // ?keepcpu = A/B of the heap trim
  // ---------------------------------------------------------------- wet streets, signs, steam
  const interiors = (await interiorsP).filter(Boolean);
  // the Atmosphere rebuilds scene.environment from its sky on a time change: put the city back after it
  const pinEnv = () => { if (cityEnv && scene.environment !== cityEnv) { scene.environment = cityEnv; scene.environmentIntensity = 0.32; } };
  let cityEnv = null;
  { // a real night city as the environment (PMREM of the HDRI panorama), dimmed; the procedural one if it failed to load
    const im = await nightEnvP;
    if (im) {
      const t = new THREE.Texture(im); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      const pm = new THREE.PMREMGenerator(renderer); cityEnv = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
    } else cityEnv = makeCityEnv(renderer);
  }
  const wet = makeStreetsWet(world, { wet: 1, cover: 0.16, env: cityEnv }); // damp, puddles in the gutters and low spots
  quietBuildingSigns(world);
  // mobile (no TAA, no SSR to darken the glossy street): the signs a little dimmer, so highlights keep their colour
  const signGain = DESK ? 1 : 0.8;
  // lit windows dimmer than the engine's dusk tuning: rooms read as rooms (with the wet street and the signs brighter)
  if (world.mat.facade.userData.uniforms) world.mat.facade.userData.uniforms.uWinGain.value = DESK ? 0.5 : 0.42;
  const signs = buildSignage({ world, square: SQUARE, squareRadius: 210, shopRadius: DESK ? 560 : 380, maxScreens: NY.maxScreens, lightScale: 0.6, interiors });
  scene.add(signs.group);
  signs.uniforms.uSignGain.value = signGain;
  // cars: contact shadows, and glossy paint that picks up the sky glow and the lamps
  const carShadows = world.traffic ? new CarShadows({ scene, world, max: DESK ? 48 : 24 }) : null;
  if (world.traffic && world.traffic.material) world.traffic.material.envMapIntensity = 2.2;
  // street trees at dusk: near-black masses (the engine's foliage albedo is a daylight green), a little rim from lamps
  world.group.traverse((o) => { if (o.isMesh && /^veg-/.test(o.name) && o.material && o.material.color) o.material.color.setRGB(0.22, 0.24, 0.2); });
  // rooftop water tanks and sidewalk sheds (their under-deck tubes join the sign lights)
  // shop fronts, lobbies and what is fixed to the wall at street level, as geometry (groundfloors.js)
  const streetKit0 = new Kit(), streetMat = groundMaterial();
  const ground = buildGroundFloors({ world, scene, signs, kit: streetKit0, material: streetMat, center: SQUARE, radius: DESK ? 220 : 150, lobbyIndex: interiors.length === INTERIORS.length ? INTERIORS.length - 1 : 0, clutter: DESK ? 1 : 0.5 });
  // window frames and AC units placed from the engine's real window layout (windowkit.js)
  const kit = buildWindowKit({ world, scene, kit: streetKit0, material: streetMat, center: SQUARE, frameRadius: DESK ? 150 : 0, acRadius: DESK ? 230 : 140, frames: DESK });
  ground.group.add(kitMeshes(streetKit0, streetMat, { center: SQUARE })); // a mesh per quadrant round the square: the frustum culls them
  // tower tops: setbacks, crowns, mechanical screens, turrets on the tall blocks (crowns.js; the roof clutter skips them)
  const crowns = buildCrowns({ world, scene, center: SQUARE, radius: DESK ? 950 : 600, max: DESK ? 400 : 160 });
  const structs = buildStructures({ world, scene, square: SQUARE, skip: crowns.crowned, facades: signs.facades, lights: signs.lights, towers: DESK ? 90 : 50, sheds: DESK ? 14 : 8 });
  // the street: worn asphalt, flags, granite kerbs, what is set into them, scanned furniture with contact shadows (street.js)
  const streetKit = params.has('nostreet') ? null : await buildStreet({ world, scene, base: NYC, desk: DESK, center: SQUARE }); // A/B: ?nostreet
  // street lamps: sodium-warm pools with real falloff (a little brighter and shorter-reaching than the engine's dusk tuning)
  { const LP = world.props && world.props.lightPool; if (LP) { LP.color.setRGB(1.0, 0.62, 0.3).multiplyScalar(DESK ? 2.6 : 1.8); LP.reach = 15; LP._fresh = true; for (const l of LP.lights || []) { l.color.copy(LP.color); l.distance = 15; } } }
  // facade light (facades.js), roof lines and wall clutter (rooftops.js), light in the air (airglow.js)
  const westAz = (NYC_SUN.azimuthStart + NYC_SUN.azimuthSpan * Math.min(1.15, (DUSK_HOURS - NYC_SUN.rise) / (NYC_SUN.set - NYC_SUN.rise))) * DEG;
  const facadeGrade = gradeFacades({ world, west: { x: Math.sin(westAz), z: -Math.cos(westAz) }, lamps: 4, skyGain: NIGHT ? 0.3 : 1, canyon: DESK ? [0.32, 1.25] : [0.5, 1.25] });
  // wall relief in the dusk light, grime, curtains (walls.js; mobile: no streaks under the sills)
  const walls = params.has('nowalls') ? null : dressWalls({ world, west: { x: Math.sin(westAz), z: -Math.cos(westAz) }, sills: DESK }); // A/B: ?nowalls
  const roofs = buildRooftops({ world, scene, center: SQUARE, skip: crowns.crowned, facades: signs.facades, max: DESK ? 900 : 450, ac: 0 }); // window AC units: windowkit.js (real window layout)
  const air = new AirGlow({ scene, world, signs: signs.lights, beacons: roofs.beacons.concat(crowns.beacons), cones: DESK, maxCones: 40, cars: DESK ? 10 : 4 });
  console.info('[nyc] rooftops', roofs.counts, 'airglow', air.counts, 'ground floors', ground.counts, 'window kit', kit.counts, 'crowns', crowns.counts);
  memlog('signs');
  console.info('[nyc] signage', signs.counts, `${signs.lights.length} sign lights`);
  const lampPos = (world.props && world.props.lampHeads) || [];
  // vents: on the carriageway of named streets around the square (seeded), two of them under a striped stack
  const vents = [];
  {
    let s = 12345;
    const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const want = Math.round(10 * NY.steam) || 3;
    const cands = [];
    for (const r of data.roads) {
      if (!r || !r.n || !r.p || r.p.length < 2 || r.b) continue;
      const st = roadStyle(r); if (st.minor) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let d = 20; d < L - 20; d += 55) {
          const x = a[0] + (b[0] - a[0]) * d / L, z = a[1] + (b[1] - a[1]) * d / L;
          const dq = Math.hypot(x - SQUARE.x, z - SQUARE.z);
          if (dq < 380 && dq > 25) cands.push({ x, z, dq, k: R() });
        }
      }
    }
    cands.sort((p, q) => p.k - q.k);
    for (const c of cands) {
      if (vents.length >= want) break;
      if (vents.some((v) => Math.hypot(v.x - c.x, v.z - c.z) < 60)) continue;
      vents.push({ x: c.x, y: world.getGroundHeight(c.x, c.z), z: c.z, stack: vents.length < 2 });
    }
  }
  const steam = new Steam({ scene, renderer, gpu: NY.gpuParticles, vents, lights: signs.lights, lamps: lampPos, budget: NY.steam });

  memlog('steam');
  // ---------------------------------------------------------------- the walker
  const gltf = assets.peek ? assets.peek('character') : null;
  // dark street clothes: navy coat, charcoal trousers (the Man's flat materials, baked to vertex colours)
  // Quaternius Business Man: a dark suit and coat; the suit cloth a touch lighter so the folds read in lamp light
  const character = makeCharacter(gltf, { height: 1.78, recolour: { Suit: 0x1c1f26 }, rim: { color: [1.0, 0.85, 0.7], k: 0.35 } });
  const physics = world.physics;
  const cc = new CharacterController({ radius: 0.32, height: HEIGHT, walk: 1.8, run: 5.2, jumpSpeed: 4.6, stepHeight: 0.4 });
  const player = new Player({ scene, cc, physics, character });
  const SCREEN_WALL = (() => { // the sign light with most screen light around it
    let best = null, bs = -1;
    for (const l of signs.lights) { if (!l.anim) continue; let s = 0; for (const m of signs.lights) if (m.anim && Math.hypot(m.x - l.x, m.z - l.z) < 40) s += m.k; if (s > bs) { bs = s; best = l; } }
    return best || { sx: SQUARE.x, sy: 15, sz: SQUARE.z, nx: 0, nz: 1 };
  })();
  // start: on the Broadway plaza nearest the square, facing up the square (north-east along Broadway)
  const START = (() => {
    let best = null, bd = Infinity;
    for (const r of data.roads) {
      if (!r || !/^Broadway$/.test(r.n || '') || !r.p) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        for (let t = 0; t <= 1; t += 0.1) {
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          const d = Math.hypot(x - SQUARE.x, z - SQUARE.z);
          if (d < bd && !physics.queryColliders(x, z, 0.6, []).some((c) => c.maxY > 0.6)) { bd = d; best = { x, z, h: Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])) }; }
        }
      }
    }
    if (!best) { const sp = world.getSpawn(); best = { x: sp.position.x + 8, z: sp.position.z, h: sp.headingRad }; }
    // face west, toward the afterglow down the cross streets (at night: the densest wall of screens)
    const az = (NYC_SUN.azimuthStart + NYC_SUN.azimuthSpan * Math.min(1.15, (DUSK_HOURS - NYC_SUN.rise) / (NYC_SUN.set - NYC_SUN.rise))) * DEG;
    best.h = NIGHT ? Math.atan2(-(SCREEN_WALL.sx - best.x), -(SCREEN_WALL.sz - best.z)) : Math.atan2(-Math.sin(az), Math.cos(az));
    best.y = world.getGroundHeight(best.x, best.z);
    return best;
  })();
  player.teleport(START.x, START.y + 0.05, START.z, START.h);

  // ---------------------------------------------------------------- post
  let postfx = null;
  try {
    const { width, height } = engine.size;
    const lut = nightLut();
    postfx = new PostFX(renderer, scene, camera, {
      atmosphere: world.atmo, width, height, pixelRatio: engine.pixelRatio,
      ...S.postfx, ao: { radius: 1.2, thickness: 1.2, samples: 6, maxPixels: 0.25e6 }, grade: nightGrade({ exposure: DESK ? 1.45 : 1.3 }), lut: { texture: lut.texture, size: lut.size, strength: 1 }, // mobile a touch lower: no SSR / TAA there
    });
    if (!S.passes.ao) postfx.aoPass.enabled = false;
    postfx.setTimeOfDay(world.atmo.darkness);
    player.entity.traverse((o) => { if (o.isMesh) postfx.track(o); });
  } catch (e) { console.warn('[nyc] post-processing unavailable', e); world.atmo.setFogMode('scene'); postfx = null; }
  // the moon's near shadow map re-renders every other frame (the city is static, the walker and the cars move little
  // in 1/60 s); three refreshes a shadow matrix only when it renders the map, so the pair stays consistent
  const moonNear = world.atmo.sun.shadow;
  moonNear.autoUpdate = false;
  let shadowFrame = 0;
  let time = 0, heldStill = false; // heldStill: the bench harness holds TAA still (quiet)
  engine.renderFn = (sc, cam, dt) => {
    if ((shadowFrame++ & 1) === 0) moonNear.needsUpdate = true;
    if (heldStill && postfx && postfx.taaPass) postfx.taaPass._reset = true; // bench / smoke captures (see quiet)
    if (postfx) postfx.render(dt); else { renderer.render(sc, cam); world.atmo.renderFlare(renderer, cam); }
  };
  engine.onResize = (w, h, pr) => { if (postfx) postfx.setSize(w, h, pr); world.setSize(w, h, pr); };
  { const { width, height } = engine.size; world.setSize(width, height, engine.pixelRatio); }

  // traffic signals: one light per (junction, phase group) at the mean of its heads, coloured by the phase the bulbs show
  const signalLights = [];
  if (world.props && world.props.bulbs) {
    const bulbs = world.props.bulbs, m4 = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const sig of world.props.signals) {
      for (const g of [0, 1]) {
        let x = 0, y = 0, z = 0, n = 0;
        for (const h of sig.heads) { if (h.group !== g) continue; bulbs.getMatrixAt(h.idx[1], m4); v.setFromMatrixPosition(m4); x += v.x; y += v.y; z += v.z; n++; }
        if (n) signalLights.push({ sig, group: g, x: x / n, y: y / n - 0.8, z: z / n });
      }
    }
  }
  const extra = clustered ? new ExtraLights({ clustered, world, signs: signs.lights, signals: signalLights, signRange: NY.signRange, cars: NY.cars, player: player.entity }) : null;
  // people on the sidewalks
  const peds = NY.pedestrians && gltf ? new Pedestrians({ scene, world, sources: [gltf && { gltf, height: 1.78 }, assets.peek('suit') && { gltf: assets.peek('suit'), height: 1.76 }, assets.peek('woman') && { gltf: assets.peek('woman'), height: 1.66, textured: true }].filter(Boolean), count: NY.pedestrians, center: SQUARE, radius: 520, seed: 4711, postfx }) : null;
  if (peds) peds.scatter(START.x, START.z, 4711);

  // ---------------------------------------------------------------- input, camera rigs, HUD
  const hud = new HUD({ tier: Q.tier === 'desktop' ? 'Mac / desktop' : 'Phone / tablet' });
  const canvas = renderer.domElement;
  const TOUCH_LAYOUT = [
    { type: 'touchpad', id: 'look', side: 'right', width: 0.56, top: 70, bottom: 0, slop: 8, portrait: { width: 0.5, top: 120 } },
    { type: 'stick', id: 'stick', side: 'left', x: 112, y: 112, radius: 60, floating: true, zone: { width: 0.44, top: 70 },
      portrait: { x: 96, y: 150, radius: 56, zone: { width: 0.5, top: 170 } } },
    { type: 'button', id: 'jump', label: 'JUMP', side: 'right', x: 84, y: 92, size: 88, fontSize: 14, hitSlop: 14, portrait: { x: 76, y: 240, size: 76 } },
    { type: 'button', id: 'sprint', label: 'RUN', side: 'right', x: 196, y: 70, size: 72, fontSize: 13, hitSlop: 12, portrait: { x: 76, y: 136, size: 70 } },
    { type: 'button', id: 'cam', label: 'CAM', side: 'right', x: 60, y: 210, size: 52, fontSize: 11, hitSlop: 8, portrait: { x: 168, y: 92, size: 52 } },
  ];
  const touchForced = params.has('touch') ? params.get('touch') !== '0' : null;
  const input = new CharacterInput({
    element: canvas, actions: CHARACTER_ACTIONS, touch: touchForced ?? 'auto', touchLayout: TOUCH_LAYOUT, touchOptions: { safeArea: true },
    touchSpeed: 0.0055, stickSpeed: 2.4, touchReveal: touchForced === null ? { hideOnKey: true, onChange: (on) => hud.setTouch(on) } : null,
  });
  hud.setTouch(input.touchShown);
  hud.onHelp = (on) => { input.map.enabled = !on; };
  const third = new ThirdPersonRig(camera, canvas, { active: false, physics, distance: 3.4, height: 1.5, shoulder: 0.42, pitch: [-1.0, 0.95], zoom: [1.6, 7], minDistance: 0.8, damping: 11 });
  const first = new FirstPersonRig(camera, canvas, { active: false, physics, eyeHeight: 1.62, bob: 0.025 });
  third.setTarget(player.entity, () => player.state);
  first.setTarget(player.entity, () => player.state);
  player.fpRig = first;
  let rig = null, rigName = '';
  const setRig = (name) => {
    const prev = rig;
    for (const r of [third, first]) r.deactivate();
    rig = name === 'first' ? first : third; rigName = name;
    if (prev && prev !== rig) { rig.yaw = prev.yaw; rig.pitch = Math.max(rig.minPitch, Math.min(rig.maxPitch, prev.pitch)); }
    rig.activate(); rig.snap();
    player.firstPerson = name === 'first';
    hud.setCamera(name);
  };
  // portrait phones: a wider vertical field of view and the camera further back, so the walker does not fill the screen
  const fitAspect = () => {
    const portrait = camera.aspect < 1;
    const fov = portrait ? 74 : 62;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    third.distance = portrait ? 4.8 : 3.4; third.height = portrait ? 1.7 : 1.5; third.shoulder = portrait ? 0 : 0.42;
  };
  fitAspect();
  const onResize0 = engine.onResize;
  engine.onResize = (w, h, pr) => { onResize0(w, h, pr); fitAspect(); };
  third.yaw = START.h; third.pitch = -0.12; first.yaw = START.h; first.pitch = 0.05;
  setRig('first'); // first person by default (V: third person)
  let unlockedAt = -1e9;
  const lock = new PointerLock({
    element: canvas,
    onChange(locked) {
      hud.setLocked(locked);
      if (!locked) unlockedAt = performance.now();
      if (locked) hud.showHelp(false);
      else if (lock.releasedByUser) hud.showHelp(true);
    },
  });
  canvas.addEventListener('click', () => { if (!lock.locked && !input.touchShown) lock.request(); });
  const respawn = () => { player.teleport(START.x, START.y + 0.05, START.z, START.h); rig.yaw = START.h; rig.snap(); hud.flash.show('TIMES SQUARE'); };
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyH') hud.toggleHelp();
    else if (e.code === 'KeyR') respawn();
  });
  const menu = new QualityMenu({ quality: Q, corner: 'tr' });

  // ---------------------------------------------------------------- street names (HUD): nearest named street + cross street
  const SEGS = [];
  for (const r of data.roads) {
    if (!r || !r.n || !r.p || r.p.length < 2) continue;
    const st = roadStyle(r); if (st.minor && !/^Broadway$/.test(r.n)) continue;
    for (let i = 0; i < r.p.length - 1; i++) SEGS.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], r.n]);
  }
  const segD = (s, x, z) => { const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2)); return Math.hypot(s[0] + dx * t - x, s[1] + dz * t - z); };
  const streetAt = (x, z) => {
    let a = null, ad = 40, b = null, bd = 80;
    for (const s of SEGS) { const d = segD(s, x, z); if (d < ad) { ad = d; a = s[4]; } }
    if (a) for (const s of SEGS) { if (s[4] === a) continue; const d = segD(s, x, z); if (d < bd) { bd = d; b = s[4]; } }
    return [a, b];
  };
  let street = ['', ''], streetT = 1;

  // ---------------------------------------------------------------- systems (phase order = registration order)
  const _f = new THREE.Vector3(), _r = new THREE.Vector3();
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt);
      const c = input.controls;
      if (c.toggleCamera) setRig(rigName === 'third' ? 'first' : 'third');
      if (c.menu && performance.now() - unlockedAt > 300) hud.toggleHelp();
      if (c.lookX || c.lookY) rig.turn(-c.lookX, -c.lookY);
      rig.getForward(_f); rig.getRight(_r);
      let mx = _r.x * c.moveX + _f.x * c.moveY, mz = _r.z * c.moveX + _f.z * c.moveY;
      const l2 = mx * mx + mz * mz; if (l2 > 1) { const k = 1 / Math.sqrt(l2); mx *= k; mz *= k; }
      player.intent.moveX = mx; player.intent.moveZ = mz; player.intent.sprint = c.sprint;
      if (c.jump) player.intent.jump = true;
    },
    fixedUpdate: (dt) => player.fixedUpdate(dt),
    update: (dt, alpha) => player.update(dt, alpha),
  }, 'player');
  engine.addSystem({ update: (dt) => rig.update(dt) }, 'camera');
  engine.addSystem({
    lateUpdate(dt) {
      time += dt;
      // the near map on the frames between the far map's (Atmosphere: far on its even frames), never both in one frame:
      // the phase the bench's live frames run (with both maps on the same frames it read ~0.7 ms more per frame)
      shadowFrame = (world.atmo._frame & 1) ^ 1;
      camera.updateMatrixWorld();
      updateSignage(signs, time);
      facadeGrade.update(camera); air.update(camera);
      steam.update(dt, camera);
      if (carShadows) carShadows.update(camera.position);
      if (trim) trim.update(dt);
      pinEnv();
      if (peds) peds.update(dt, player.entity.position.x, player.entity.position.z);
      if (heldStill && !harness.frozen) { // a resumed loop after bench poses: TAA / volumetric jitter back on
        heldStill = false;
        if (postfx && postfx.history) postfx.set('jitter', true);
        if (postfx && postfx.volumetric) { postfx.set('volumetric.jitter', true); postfx.set('volumetric.temporal', true); }
      }
    },
  }, 'fx');
  engine.addSystem({
    lateUpdate(dt) {
      streetT += dt;
      if (streetT > 0.4) { streetT = 0; street = streetAt(player.entity.position.x, player.entity.position.z); }
      hud.update(dt, rig.yaw, street[0], street[1], engine.profiler.frame.fps);
    },
  }, 'hud');

  // ---------------------------------------------------------------- bench harness (window.__sample)
  // poses: `avenue` (eye height on 7th Avenue at the square, looking down the avenue), `square` (inside the bowtie
  // looking at the densest wall of screens), `sidewalk` (third-person behind the walker by the storefronts)
  const AV = (() => { // the 7th Avenue segment through the square: its direction
    let best = null, bd = Infinity;
    for (const r of data.roads) {
      if (!r || r.n !== '7th Avenue' || !r.p) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = Math.hypot(mx - SQUARE.x, mz - SQUARE.z);
        if (d < bd) { bd = d; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); best = { x: mx, z: mz, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L, hw: roadStyle(r).hw }; }
      }
    }
    return best || { x: SQUARE.x, z: SQUARE.z, dx: 0, dz: 1, hw: 8 };
  })();
  const AV2 = (() => { // a 7th Avenue point 200-300 m from the square, direction toward the square along the avenue
    let best = null, bs = -Infinity;
    for (const r of data.roads) {
      if (!r || r.n !== '7th Avenue' || !r.p) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 0.1; t < 1; t += 0.2) {
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, d = Math.hypot(x - SQUARE.x, z - SQUARE.z);
          if (d < 200 || d > 320) continue;
          let dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
          if (dx * (SQUARE.x - x) + dz * (SQUARE.z - z) < 0) { dx = -dx; dz = -dz; }
          const sc = (dx * (SQUARE.x - x) + dz * (SQUARE.z - z)) / d - Math.abs(d - 250) / 500;
          if (sc > bs) { bs = sc; best = { x, z, dx, dz, hw: roadStyle(r).hw }; }
        }
      }
    }
    return best || { ...AV, x: AV.x - AV.dx * 200, z: AV.z - AV.dz * 200 };
  })();
  // the west: where the afterglow is (the set sun's azimuth); crosstown streets point at it
  const sunAz = (NYC_SUN.azimuthStart + NYC_SUN.azimuthSpan * Math.min(1.15, (DUSK_HOURS - NYC_SUN.rise) / (NYC_SUN.set - NYC_SUN.rise))) * DEG;
  const WEST = { x: Math.sin(sunAz), z: -Math.cos(sunAz) };
  const clear = (x, z) => !physics.queryColliders(x, z, 1.2, []).some((c) => c.maxY > 0.8);
  const XTOWN = (() => { // hero view: a crosstown street near the square with a long straight run to the west
    let best = null, bs = -Infinity;
    for (const r of data.roads) {
      if (!r || !r.p || !/Street$/.test(r.n || '') || r.b) continue;
      const st = roadStyle(r); if (st.minor) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 60) continue;
        let dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
        const al = dx * WEST.x + dz * WEST.z;
        if (Math.abs(al) < 0.93) continue;
        // stand at the east end, looking west
        const e = al > 0 ? a : b; if (al < 0) { dx = -dx; dz = -dz; }
        const d = Math.hypot(e[0] - SQUARE.x, e[1] - SQUARE.z);
        const sc = Math.min(L, 400) - Math.abs(d - 220) * 0.7; // a side street a block or two off the square: quieter, a long run west
        if (sc > bs) { bs = sc; best = { x: e[0] + dx * 12, z: e[1] + dz * 12, dx, dz, hw: st.hw, sw: st.sidewalk }; }
      }
    }
    return best || { x: SQUARE.x, z: SQUARE.z, dx: WEST.x, dz: WEST.z, hw: 5, sw: 2.7 };
  })();
  const SQ_VIEW = (() => { // in the square: the heading within 70 deg of the west with the most screen light
    let best = null, bs = -1;
    const screensL = signs.lights.filter((l) => l.kind === 'screen');
    for (let k = 0; k < 9; k++) {
      const px = SQUARE.x + (k % 3 - 1) * 30, pz = SQUARE.z + (Math.floor(k / 3) - 1) * 30;
      if (!clear(px, pz)) continue;
      for (let a = 0; a < 48; a++) {
        const h = (a / 48) * Math.PI * 2, dx = Math.sin(h), dz = Math.cos(h);
        if (dx * WEST.x + dz * WEST.z < 0.35) continue; // the glow must be in the frame
        let sc = 0, near = false;
        for (let t = 2; t < 14 && !near; t += 2) for (const side of [-0.45, 0, 0.45]) { const cx = px + (dx + side * dz) * t, cz = pz + (dz - side * dx) * t; if (physics.queryColliders(cx, cz, 0.5, []).some((c) => c.maxY > 3)) near = true; }
        if (near) continue; // no wall filling the near frame
        for (const l of screensL) {
          const ox = l.sx - px, oz = l.sz - pz, d = Math.hypot(ox, oz);
          if (d < 30 || d > 230 || (ox * dx + oz * dz) / d < 0.85) continue;
          if (ox * l.nx + oz * l.nz > 0) continue;
          sc += l.k;
        }
        if (sc > bs) { bs = sc; best = { x: px, z: pz, dx, dz }; }
      }
    }
    return best || { x: SQUARE.x, z: SQUARE.z, dx: WEST.x, dz: WEST.z };
  })();
  const SIDE = (() => { // an open shop front on a crosstown sidewalk near the start: the walker walks west past it
    let best = null, bd = Infinity;
    for (const l of signs.lights) {
      if (l.kind !== 'shop' || Math.abs(l.nx * WEST.x + l.nz * WEST.z) > 0.3) continue; // fronts that face across the street
      const d = Math.hypot(l.x - START.x, l.z - START.z); if (d < bd) { bd = d; best = l; }
    }
    return best;
  })();
  // bench frames as played (Bench.js `live`): what a play frame renders differently from a held one. Of the play
  // loop's systems, kept: world.update (the atmosphere's cascade schedule, far map on even frames; lamps, signals, the
  // clustered light list and its upload, ExtraLights' writes included), signage, facade grade, air glow, the GPU steam
  // step, car contact shadows, the city environment. Left out: player / input and the camera rig (the camera stays at
  // the pose), traffic, boats and streaming (held: they move vehicles and tiles), pedestrians (a crowd simulation
  // that walks skinned people around), the heap trim (heap tooling on a timer) and the HUD (DOM). end() puts back what
  // the frames moved, as after() left it (after() itself is not idempotent: refreshHD, the steam's spawn accumulators).
  let shownT = 0, liveT = 0, steamAcc = null, atmoF = 0, shadowF = 0; // shownT: the world time after()'s last update
  // showed; atmoF: the atmosphere's frame count then (its far-cascade schedule); shadowF: renderFn's near-map count
  const _lp = new THREE.Vector3();
  const worldStep = (dt) => { // world.update with the traffic, the boats and the streamer held
    const T = world.traffic, tu = T && T.update, St = world.streamer, B = world.waterfront && world.waterfront.boats, bu = B && B.update;
    if (T) T.update = () => {};
    if (B) B.update = () => {};
    world.streamer = null;
    world.update(dt, _lp.copy(engine.camera.position));
    world.streamer = St;
    if (T) T.update = tu;
    if (B) B.update = bu;
  };
  const harness = createBenchHarness(engine, {
    name: 'nyc-night',
    poses: {
      avenue(cam) {
        // the hero view: crosstown, on the sidewalk edge, looking west down the street canyon into the afterglow
        const A = XTOWN, rx = -A.dz, rz = A.dx, off = A.hw + Math.min(1.6, (A.sw || 2) * 0.55);
        // step along the street until nothing stands in the first 8 m of the view (no mailbox in the foreground)
        let back = 0;
        for (let k = 0; k < 12; k++) {
          let hit = false;
          for (let t = 0.5; t < 8 && !hit; t += 1) hit = physics.queryColliders(A.x + rx * off + A.dx * (t - back), A.z + rz * off + A.dz * (t - back), 0.9, []).some((c) => c.maxY > 0.3);
          if (!hit) break; back -= 4;
        }
        const ox = A.dx * -back, oz = A.dz * -back;
        const gy = world.getGroundHeight(A.x + ox, A.z + oz);
        cam.position.set(A.x + ox + rx * off, gy + 1.65, A.z + oz + rz * off); cam.up.set(0, 1, 0);
        cam.lookAt(A.x + ox + A.dx * 300 + rx * off * 0.3, gy + 34, A.z + oz + A.dz * 300 + rz * off * 0.3); // tilted up a little: the sky slot and its glow
        player.entity.visible = false;
      },
      square(cam) {
        const V = SQ_VIEW, gy = world.getGroundHeight(V.x, V.z);
        cam.position.set(V.x, gy + 1.7, V.z); cam.up.set(0, 1, 0);
        cam.lookAt(V.x + V.dx * 120, gy + 20, V.z + V.dz * 120);
        player.entity.visible = false;
      },
      sidewalk(cam) {
        // third person behind the walker on a crosstown sidewalk, the shop fronts on one side, the glow ahead
        player.entity.visible = true;
        const l = SIDE || { sx: START.x, sz: START.z, nx: -WEST.z, nz: WEST.x };
        const gy = world.getGroundHeight(l.sx, l.sz);
        const nx = l.nx, nz = l.nz;
        const px = l.sx + nx * 2.4, pz = l.sz + nz * 2.4;
        const h = Math.atan2(-WEST.x, -WEST.z);
        player.teleport(px, world.getGroundHeight(px, pz), pz, h);
        player.pose(1.8);
        const back = cam.aspect < 1 ? 5.6 : 4.2;
        cam.position.set(px - WEST.x * back + nx * 0.9, gy + 1.8, pz - WEST.z * back + nz * 0.9); cam.up.set(0, 1, 0);
        cam.lookAt(px + WEST.x * 40 - nx * 2, gy + 4.5, pz + WEST.z * 40 - nz * 2);
      },
    },
    after(cam) {
      // world past its throttles (culling, LODs, light lists), with the traffic held: its worker answers asynchronously,
      // and an answer landing between two captures moved the cars (captures differed after a pose change)
      const T = world.traffic, tu = T && T.update;
      if (T) T.update = () => {};
      for (let i = 0; i < 3; i++) world.update(1, cam.position);
      if (T) T.update = tu;
      if (T && T.refreshHD) T.refreshHD(cam.position); // the detailed-car rings around the posed camera (held traffic keeps the old pick)
      if (carShadows) carShadows.update(cam.position);
      updateSignage(signs, 12.5);
      facadeGrade.update(cam, true); air.update(cam);
      pinEnv();
      const su = world.atmo.sky.material.uniforms; su.uTime.value = 0; su.uCloudOffset.value.set(0.13, 0.41);
      shownT = world.time;
      world.time = 0;
      steamAcc = steam.vents.map((v) => v.acc);
      steam.preroll(4, cam);
      if (peds) peds.scatter(cam.position.x, cam.position.z, 4711);
      if (player.entity.visible && peds) peds.update(0, player.entity.position.x, player.entity.position.z);
    },
    // building tiles stream in asynchronously after a camera jump: wait (world updates with the traffic held, so the
    // streamer commits) until nothing is pending or building, then the harness runs after() / quiet() again
    async settle() {
      const S = world.streamer; if (!S) return;
      const T = world.traffic, tu = T && T.update, cam = engine.camera;
      let idle = 0;
      for (let k = 0; k < 200 && idle < 3; k++) {
        if (T) T.update = () => {};
        world.update(0.016, cam.position);
        if (T) T.update = tu;
        await new Promise((r) => setTimeout(r, 25));
        idle = S.stats.pending || S.stats.building ? 0 : idle + 1;
      }
    },
    // captures must hash equal frame to frame: no exposure drift, and TAA / volumetric held still (no jitter) and
    // converged from a clean history; signage, steam and people only move in live frames (lateUpdate), never here
    quiet() {
      if (postfx) { postfx.autoExposure = false; postfx.setTimeOfDay(world.atmo.darkness); }
      if (postfx && postfx.history) {
        heldStill = true;
        postfx.set('jitter', false);
        if (postfx.volumetric) { postfx.set('volumetric.jitter', false); postfx.set('volumetric.temporal', false); } // its history drifts too
        postfx.history.reset();
        for (let i = 0; i < 48; i++) postfx.render(0);
        // a held history still drifts by ~0.001 / 255 a frame (the history is re-sampled every frame), so while held
        // each harness frame resolves TAA from a fresh history (renderFn: taaPass._reset): the same shader and cost,
        // the current (un-jittered) frame as its output, bit-stable
        postfx.render(0);
      }
    },
    live: {
      begin() { // what quiet() holds, as in play: TAA and the volumetric march jittered and accumulating, eye adaptation
        heldStill = false; liveT = 12.5; world.time = shownT; atmoF = world.atmo._frame; // the clocks go on from what after() shows
        // every run and load the same schedule (Bench.js: a fixed phase): the near map on the frames between the far
        // map's (in play the two counters run in lockstep from whatever phase the load left)
        shadowF = shadowFrame; shadowFrame = atmoF & 1;
        if (postfx) postfx.autoExposure = true;
        if (postfx && postfx.history) postfx.set('jitter', true);
        if (postfx && postfx.volumetric) { postfx.set('volumetric.jitter', true); postfx.set('volumetric.temporal', true); }
      },
      frame(dt) {
        const cam = engine.camera;
        worldStep(dt);
        liveT += dt;
        updateSignage(signs, liveT);
        facadeGrade.update(cam); air.update(cam);
        steam.update(dt, cam);
        if (carShadows) carShadows.update(cam.position);
        pinEnv();
      },
      end() {
        const cam = engine.camera;
        updateSignage(signs, 12.5);
        // as after()'s three updates (dt 0, at the shown time): signals, lamps, trees, water, the light list, the cascades' schedule
        world.time = shownT; world.atmo._frame = atmoF - 3;
        for (let i = 0; i < 3; i++) worldStep(0);
        world.time = 0;
        const su = world.atmo.sky.material.uniforms; su.uTime.value = 0; su.uCloudOffset.value.set(0.13, 0.41);
        facadeGrade.update(cam, true); air.update(cam);
        if (carShadows) carShadows.update(cam.position);
        if (steamAcc) steam.vents.forEach((v, i) => { v.acc = steamAcc[i]; });
        steam.preroll(4, cam); // the same pre-roll as after()'s (seeded, from the same accumulators)
        shadowFrame = shadowF;
      },
    },
    settings: {
      'postfx.ssr': { get: () => !!(postfx && postfx.ssr), set: (v) => { if (postfx && postfx.gbuffer) postfx.set('ssr', v ? S.postfx.ssr || true : false); } },
      'postfx.volumetric': { get: () => !!(postfx && postfx.volumetric), set: (v) => { if (postfx) postfx.set('volumetric', v ? S.postfx.volumetric || true : false); } },
      'postfx.ao': { get: () => !!(postfx && postfx.aoPass.enabled), set: (v) => { if (postfx) postfx.aoPass.enabled = !!v; } },
      'postfx.bloom': { get: () => !!(postfx && postfx.get('bloom.enabled')), set: (v) => { if (postfx) postfx.set('bloom.enabled', !!v); } },
      'postfx.aa': { get: () => (postfx ? postfx.aa : null), set: (v) => { if (postfx) postfx.set('aa', v); } },
      'postfx.lut': { get: () => (postfx && postfx.lut ? postfx.lut.strength : 0), set: (v) => { if (postfx && postfx.lut) postfx.set('lut.strength', +v); } },
      'shadows.kernel': { get: () => world.atmo.shadowKernel, set: (v) => world.atmo.setShadowKernel(v) },
      'lights.signs': { get: () => !!(extra && extra.signsOn), set: (v) => { if (extra) extra.signsOn = !!v; } },
      'lights.cars': { get: () => !!(extra && extra.carsOn), set: (v) => { if (extra) extra.carsOn = !!v; } },
      'lights.lamps': { get: () => (world.props && world.props.lightPool ? world.props.lightPool.mode : null), set: (v) => world.setLightMode(v) },
      'wet': { get: () => wet.uniforms.uWet.value, set: (v) => { wet.uniforms.uWet.value = +v; } },
      'postfx.ssr.denoise': { get: () => (postfx && postfx.ssr ? postfx.get('ssr.denoise') : 0), set: (v) => { if (postfx && postfx.ssr) postfx.set('ssr.denoise', +v); } },
      'steam': { get: () => steam.mesh ? steam.mesh.visible !== false : false, set: (v) => { if (steam.mesh) steam.mesh.visible = !!v; } },
    },
  });
  player.frozen = () => harness.frozen;
  const bp = readBenchParams(location.search);
  if (bp.enabled && bp.size) harness.resize(bp.size.w, bp.size.h);

  memlog('before compile');
  renderer.compile(scene, camera);
  const loadMs = Math.round(performance.now() - t0);
  window.__nyc = {
    THREE, engine, world, postfx, atmo: world.atmo, clustered, extra, signs, steam, wet, player, cc, input, hud, menu, harness,
    quality: Q, facadeGrade, walls, ground, kit, crowns, air, roofs, get rig() { return rig; }, setRig, START, SQUARE, loadMs, loadWorldMs, geo, streetAt,
  };
  console.info(`[nyc] ready in ${loadMs} ms (world ${loadWorldMs} ms) · tier ${Q.tier} (${Q.source}) · ${signs.lights.length} sign lights · ${world.stats.lamps} lamps · ${world.stats.vehicles} vehicles`);
  engine.start();
  loading.hide(400);
  harness.setReady();
  if (bp.enabled) harness.freeze();
}

boot().catch((err) => {
  console.error(err);
  const l = document.querySelector('.ui-loading small');
  if (l) l.textContent = `Failed to start: ${err.message}`;
});
