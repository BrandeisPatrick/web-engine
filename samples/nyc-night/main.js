// Night NYC drive: the engine's showcase for buildings and light, driven. A car of your choice (cars.js: a yellow cab,
// a sedan, an interceptor; picked on the start card or in the pause card, saved) on 7th Avenue in Midtown Manhattan
// baked from OpenStreetMap (samples/public/nyc/map/city.json, tools/bake-map.mjs around 40.7565, -73.9865, 1.5 km),
// after the rain: wet asphalt (wet.js; screen-space reflections on the desktop tier, a city-light environment fake on
// mobile), every street lamp + every sign + the nearest cars' headlights + the traffic signals' phase colours + the
// player's own headlights and tail lamps as clustered lights (lights.js; mobile: one spot light for the headlights),
// invented signage and street frontage (signage.js: framed LED screens, corner wraps, rooftop signs, marquees, neon
// fascias and blades, a news ticker, parallax shop-front interiors, entrance canopies, wall lights), people on the
// sidewalks who step clear of the car (pedestrians.js), steam (steam.js), a near-black city sky, traffic kept close
// (MapWorld traffic area / mix: cabs; it brakes for the player), haze and moonlit volumetrics, TAA, bloom and a night
// grade + LUT (look.js); the JS heap trimmed after load (the engine's world.trimMemory, render/Memory.js).
// Driving: VehicleController on the car's spec with the steering assist, a chase camera with the road feel, skid marks
// and tyre smoke, each car's engine (EngineAudio on its Gearbox) with road, wind and tyre sounds and the city's hum, a
// speed readout, R puts the car back on the nearest street; the edge of the
// baked map is a wall (the city past it is a low context ring). GameShell: loading bar, start card with the car choice,
// pause (Esc / P) with volume, assist, the car and the quality tiers.
// Buildings up close: CC0 wall scans with their relief, grime and curtains read in the dusk light (walls.js), shop fronts,
// lobbies and what is fixed to the wall as real geometry (groundfloors.js), window frames and AC units placed from the
// engine's real window layout (windowkit.js), setbacks / crowns / screens / turrets on the tall blocks (crowns.js).
// Quality tiers (core/Quality.js): 'desktop' (G-buffer, TAA, SSR, volumetrics, clustered lights) and 'mobile'
// (forward, FXAA, 8-lamp pool, smaller textures / radius / traffic); ?quality=desktop|mobile forces one.
// Query: ?autostart=1 (no start card), ?bench=1&size=WxH (window.__sample: poses avenue / square / sidewalk, settings
// below; the car is out of every pose), ?notraffic, ?nostream=1, ?nofiller, ?nostreet (street.js kit off), ?nowalls
// (walls.js off), ?keepcpu, ?memlog=1, ?cascades=N, ?touch=1, ?profile=N, ?fps=60, ?look=low (the earlier low-key
// grade). window.__nyc for the console.
import * as THREE from 'three';
import { Engine, Assets, PoseInterpolator, createBenchHarness, readBenchParams, resolveQuality } from '@vibe/engine/core';
import { VehicleController, Gearbox } from '@vibe/engine/physics';
import { PostFX, registerRenderLoaders, TextureSets, ClusteredLights, installClusteredChunks, applyPatches, weathering, TyreFx, AirParticles } from '@vibe/engine/render';
import { VehicleInput, VEHICLE_ACTIONS, PAD_BUTTONS as B } from '@vibe/engine/input';
import { ChaseRig } from '@vibe/engine/camera';
import { GameShell } from '@vibe/engine/ui';
import { AudioBus, SoundBank, EngineAudio, CityAmbience } from '@vibe/engine/audio';
import { MapWorld, roadStyle, applyFoliageLightingTo, createCarVisual } from '@vibe/engine/world';
import { makeStreetsWet, makeCityEnv } from './wet.js';
import { buildSignage, updateSignage, quietBuildingSigns } from './signage.js';
import { ExtraLights } from './lights.js';
import { Steam } from './steam.js';
import { CARS, DEFAULT_CAR, carById, carSpec } from './cars.js';
import { Pedestrians, PEOPLE } from './pedestrians.js';
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
import { nightLooks, nightGrade, nightLook, nightLut, cityNightSky, duskLooks, cityDuskSky, OPEN_DUSK_SKY, NYC_SUN, DUSK_HOURS } from './look.js';
import { HUD, applyTheme } from './hud.js';

const params = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL;
const NYC = `${BASE}nyc/`;
const DEG = Math.PI / 180;
// map geo frame (tools/bake-map.mjs proj): the bowtie of the square, between 43rd and 47th
const R_EARTH = 6378137;

// ---------------------------------------------------------------- quality tiers (this demo's budgets as overrides)
const Q = resolveQuality({
  storageKey: 'vibe.quality.nyc',
  overrides: {
    desktop: {
      engine: { maxPixelRatio: 1.5, adaptiveResolution: true }, // 2268x1473 on a 14" Retina, as miami-drive: native 3024x1964 is 16.5-18 ms, this 10.7-11.6
      shadows: { cascades: 2, kernel: 'fast', nearMapSize: 2048, farInterval: 8 }, // far map every 8th frame
      // no volumetric pass: at dusk it marched the weak moon for a change of 0.16 (avenue) to 1.6 (square) of 255, a faint
      // veil, for about 0.4 ms a frame; the post fog's own glow toward the light stands in (as on the mobile tier), and the
      // time goes to bloom, which now has bright signs and lamps to work on (?volumetric=1 puts the pass back for an A/B)
      postfx: { ssr: { scale: 0.4, steps: 22, refine: 4, maxDistance: 120, thickness: 0.6, maxRoughness: 0.45, edgeFade: 0.2, jitter: false, denoise: 5, interval: 2 }, volumetric: params.has('volumetric') ? { scale: 0.25, steps: 12, maxDistance: 220, intensity: 1, density: 1 } : false },
      // cutoff: each point light ends, faded, where it stops showing (ClusteredLights): 0.45 ms a frame on square and
      // sidewalk for <= 0.012 / 255 mean (0.01 would save 0.1 ms more and take a soft far highlight off the pavement)
      lights: { clustered: true, clusteredRange: 200, cutoff: 0.0025 },
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
// The look (look.js): 'open' by default, the brighter two-temperature grade (the owner chose it on 2026-11-17; the smoke
// look gate holds it); ?look=low gives the earlier low-key dusk grade (?look=open is accepted too)
const LOOK = params.get('look') === 'low' ? 'low' : 'open';
// A/B knobs: ?cascades=1..4, ?shadowkernel=fast|pcf|pcss, ?shadownear=<m> (near cascade half size)
if (params.has('cascades')) S.shadows.cascades = +params.get('cascades') || 1;
if (params.has('shadowkernel')) S.shadows.kernel = params.get('shadowkernel');
if (params.has('shadownear')) S.shadows.near = +params.get('shadownear');

// The night HDRI (a Berlin plaza at blue hour) as this city's environment: its sky is a saturated royal blue and a blue
// floodlight burns on the left. Mirrored in the damp gutters at a grazing angle they showed as electric-blue streaks
// and a bright blue speck. Here the blues are pulled toward the dusk sky's slate blue-violet (half the saturation)
// and the cold highlights are capped; warm lights and the neutral stone are left as they are.
function tameNightEnv(im) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const D = g.getImageData(0, 0, c.width, c.height), d = D.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const blue = Math.max(0, Math.min(1, (b - Math.max(r, gg)) / 60)); // 0 neutral / warm .. 1 strongly blue
    if (blue <= 0) continue;
    // desaturate (nearly grey: a half-saturated blue building in the panorama showed as a bright blue patch in the
    // glossy gutter puddles, where nothing blue stands), dim the blues a little, hot blues more
    const k = 1 - 0.85 * blue, cap = (1 - 0.2 * blue) * (l > 150 ? 1 - 0.45 * blue * Math.min(1, (l - 150) / 80) : 1);
    d[i] = (l + (r - l) * k + 6 * blue) * cap; d[i + 1] = (l + (gg - l) * k) * cap; d[i + 2] = (l + (b - l) * k) * cap;
  }
  g.putImageData(D, 0, 0);
  return c;
}

// keyboard (W S / arrows, A D, Space or X handbrake, C camera, R back on the street, B look back), gamepad (RT / LT,
// left stick, B / right-stick click handbrake, Y camera, X reset) and touch (stick, GAS, BRK, HB, CAM, RST): the
// engine's driving actions without the flight ones (a ground car)
const { throttle, brake, steer, lookBack, toggleCamera, reset } = VEHICLE_ACTIONS;
const ACTIONS = { throttle, brake, steer, lookBack, toggleCamera, reset, handbrake: { type: 'button', bindings: ['Space', 'KeyX', { padButton: B.B }, { padButton: B.RS }, { virtual: 'hb' }] } };
const TOUCH = [
  { type: 'stick', id: 'stick', side: 'left', x: 112, y: 112, radius: 62, floating: true },
  { type: 'button', id: 'gas', label: 'GAS', side: 'right', x: 78, y: 112, size: 84 },
  { type: 'button', id: 'brake', label: 'BRK', side: 'right', x: 178, y: 86, size: 62 },
  { type: 'button', id: 'hb', label: 'HB', side: 'right', x: 178, y: 168, size: 52 },
  { type: 'button', id: 'cam', label: 'CAM', side: 'right', x: 36, y: 172, size: 42, top: true, fontSize: 10 },
  { type: 'button', id: 'reset', label: 'RST', side: 'right', x: 88, y: 172, size: 42, top: true, fontSize: 10 },
];

applyTheme();
const shell = new GameShell({
  title: 'Night NYC', subtitle: 'Midtown after the rain. Pick a car.', quality: Q, storageKey: 'nyc-night', defaults: { assist: true, car: DEFAULT_CAR },
  controls: [['W S', 'Drive, brake'], ['A D', 'Steer'], ['Space', 'Handbrake'], ['C', 'Camera'], ['R', 'Back on the street']],
  touchHelp: 'Left thumb steers; GAS, BRK and HB on the right',
});

const nextFrame = () => new Promise((r) => setTimeout(r, 0));
// ?memlog=1: JS heap (MB) at each boot stage, after a GC when the page runs with --js-flags=--expose-gc
const memlog = params.has('memlog') ? (label) => { if (globalThis.gc) globalThis.gc(); if (performance.memory) console.info(`[nyc] heap ${label}: ${Math.round(performance.memory.usedJSHeapSize / 1e6)} MB`); } : () => {};

async function boot() {
  const t0 = performance.now();
  shell.setProgress(0, 'Baking the city…');
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
    clustered = new ClusteredLights({ maxLights: 1024, zFar: 420, cutoff: S.lights.cutoff || 0 });
  }
  const world = new MapWorld({
    scene, renderer,
    data: { mapUrl: `${NYC}map/city.json`, farlandUrl: false },
    terrain: false,
    filler: !params.has('nofiller'), // the low context ring beyond the baked square (A/B: ?nofiller)
    // late dusk by default (the afterglow down the cross streets); ?t=night = 1 a.m., ?t=<hours> any hour
    timeOfDay: NIGHT ? 'night' : params.has('t') && Number.isFinite(+params.get('t')) ? +params.get('t') : DUSK_HOURS,
    atmosphere: {
      camera, shadows: S.shadows, sun: NYC_SUN, looks: NIGHT ? nightLooks() : duskLooks(LOOK), moonScatter: DESK ? 0.35 : 0.2, moonIntensity: 0.14, // a weak moon: its building shadows edge the lamp pools softly, not as hard bright slabs
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

  // the people's models load with the world
  const assets = new Assets({ base: NYC });
  registerRenderLoaders(assets, renderer, { ktx2: false, meshopt: false });
  // (samples/public/people: one file per person; a small crowd loads the first four, men and women alternate)
  const peopleIds = NY.pedestrians ? PEOPLE.slice(0, NY.pedestrians > 8 ? 8 : 4) : [];
  for (const id of peopleIds) assets.add(`person-${id}`, { type: 'gltf', url: `../people/${id}.glb`, weight: 1 });
  // photographed interiors for the open shops (Poly Haven CC0 indoor HDRIs, tone-mapped to 512 x 256 equirect JPGs) and
  // the night environment for glass, cars and the damp street (a CC0 urban night HDRI, dimmed)
  const loadImage = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  const INTERIORS = ['comfy_cafe', 'decor_shop', 'gear_store', 'warm_bar', 'warm_restaurant_night', 'cinema_lobby'];
  const interiorsP = Promise.all(INTERIORS.map((k) => loadImage(`${NYC}env/${k}.jpg`)));
  const nightEnvP = loadImage(`${NYC}env/modern_buildings_night.jpg`);
  engine.addSystem(assets.system({ loadWeight: 1 }), 'assets');
  try {
    await engine.load((p, label) => shell.setProgress(p, label));
  } catch (e) {
    if (!e.key) throw e;
    console.warn('[nyc] a person model failed to load: fewer people on the sidewalks', e);
  }
  const loadWorldMs = Math.round(performance.now() - t0);
  memlog('world loaded');
  shell.setProgress(0.97, 'Lighting the signs…');
  await nextFrame();

  // ---------------------------------------------------------------- geo helpers (bake frame -> world)
  const data = world.data, C = data.center, COS0 = Math.cos(C.lat * DEG);
  const geo = (lat, lon) => ({ x: (lon - C.lon) * DEG * R_EARTH * COS0 - world.offset.x, z: -(lat - C.lat) * DEG * R_EARTH - world.offset.z });
  const SQUARE = geo(40.7576, -73.9857);

  if (NIGHT) cityNightSky(world.atmo); else cityDuskSky(world.atmo, LOOK === 'open' ? OPEN_DUSK_SKY : undefined);
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
      const t = new THREE.Texture(tameNightEnv(im)); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      const pm = new THREE.PMREMGenerator(renderer); cityEnv = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose();
    } else cityEnv = makeCityEnv(renderer);
  }
  const wet = makeStreetsWet(world, { wet: 1, cover: 0.16, env: cityEnv }); // damp, puddles in the gutters and low spots
  quietBuildingSigns(world);
  // mobile (no TAA, no SSR to darken the glossy street): the signs a little dimmer, so highlights keep their colour
  // open look: the screens and signs are the brightest things on the street (2.2x: they bloom, light the trees and
  // show in the wet road), and lit rooms are bright enough to read from the car
  const LIT = LOOK === 'open' ? { sign: 2.2, win: 1.8, signLight: 2, shop: 1.5, lamp: 1.5 } : { sign: 1, win: 1, signLight: 1, shop: 1, lamp: 1 };
  const signGain = (DESK ? 1 : 0.8) * LIT.sign;
  // lit windows dimmer than the engine's dusk tuning: rooms read as rooms (with the wet street and the signs brighter)
  if (world.mat.facade.userData.uniforms) world.mat.facade.userData.uniforms.uWinGain.value = (DESK ? 0.5 : 0.42) * LIT.win;
  const signs = buildSignage({ world, square: SQUARE, squareRadius: 210, shopRadius: DESK ? 560 : 380, maxScreens: NY.maxScreens, lightScale: 0.6, interiors });
  scene.add(signs.group);
  signs.uniforms.uSignGain.value = signGain;
  // open shops spill warm light onto the pavement in front (the warm half of the two-temperature night)
  // (signage.js gives them ~1 cd, invisible beside a 9 m street lamp's pool: here a lit shop window's few candela)
  // Where: signage.js puts it 1.6 m out and 2.2 m up, which is inside the awning's valance (1.25-1.6 m out, its hem
  // 2.1-2.3 m up): the inverse square from a few cm lit the stripes there into a white blob with a bloom halo. Here it
  // stands 2.3 m out (0.65 m or more clear of every valance) and 2.3 m up, and falls off as 1 / d (decay 1: the window
  // is a broad source, not a bulb) at 0.475x the level, which keeps its light on the pavement below and on the awning
  // a metre or two away as it was, without a hot spot at the nearest stripe.
  for (const l of signs.lights) if (l.kind === 'shop') {
    const k = (LOOK === 'open' ? 6.5 : 3) / Math.max(0.3, l.r) * 0.475 * LIT.shop; l.r *= k; l.g *= k * 0.95; l.b *= k * 0.85; l.range = 10;
    l.x = l.sx + l.nx * 1.75; l.z = l.sz + l.nz * 1.75; l.y += 0.1; l.decay = 1;
  } else { l.r *= LIT.signLight; l.g *= LIT.signLight; l.b *= LIT.signLight; } // what a screen or a fascia throws on the street
  // cars: contact shadows, and glossy paint that picks up the sky glow and the lamps
  const carShadows = world.traffic ? new CarShadows({ scene, world, max: DESK ? 48 : 24 }) : null;
  if (world.traffic && world.traffic.material) world.traffic.material.envMapIntensity = 2.2;
  // street trees at dusk: a dark foliage albedo (the engine's is a daylight green), lit as leaves (VegMaterials.js
  // applyFoliageLighting: wrap, lamp light through the leaves, a rim against the glow, more sky) instead of black masses
  const isTree = (m, o) => /^veg-/.test(o.name);
  world.group.traverse((o) => { if (o.isMesh && isTree(o.material, o) && o.material && o.material.color) o.material.color.setRGB(0.24, 0.26, 0.21); });
  applyFoliageLightingTo(world.group, { wrap: 0.5, translucency: 0.5, rim: 1.0, ambient: 0.35, tint: [1.0, 0.8, 0.5] }, isTree);
  // rooftop water tanks and sidewalk sheds (their under-deck tubes join the sign lights)
  // shop fronts, lobbies and what is fixed to the wall at street level, as geometry (groundfloors.js)
  const streetKit0 = new Kit(), streetMat = groundMaterial();
  // weathering (MaterialPatches.js) on the street furniture and wall kit: broad value / roughness breakup, rain runs, dust on
  // the tops (no ground grime: the kit is one material over sloping ground)
  applyPatches(streetMat, [weathering({ grime: 0, streaks: 0.25, dust: 0.3, macro: 0.12, seed: 11 })]);
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
  // desktop (clustered): each lamp a spot aimed down, so it lays a round pool with a soft rim on the pavement and leaves
  // the wall above its head alone (a point light smeared the facade behind the pole); the spot sits in the lamp head,
  // not 35 cm under it, so the pole's top is not lit white from a hand's breadth away. The cone is a real luminaire's
  // (full to ~14 deg off straight down, gone by ~37 deg: a bright core about 4 m across under a 9 m head that falls off
  // over the next few metres; the old 72 deg cone lit the whole street evenly, so no pool read, and a 20 / 44 deg one
  // still lit the asphalt round a lamp flat beige in the kerb view), twice as bright inside it in ?look=low (1.5x in the default open look, whose exposure is higher), and shielded over its first
  // 5 m below the head (ClusteredLights setSpot near): the pole and the wall at head height stay out of it
  // pedestrian signal lenses (Props: a flat 8-sided disc, unlit colour): the engine's WALK white (1.7) and hand orange
  // (3.0) are daytime levels; under this grade's exposure the WALK disc clipped flat white. Night levels: lit, not blown.
  { const PC = world.props && world.props._colors; if (PC && PC.walk) { PC.walk.setRGB(0.3, 0.34, 0.33); PC.dont.setRGB(1.0, 0.34, 0.03); } }
  { const LP = world.props && world.props.lightPool; if (LP) { LP.color.setRGB(1.0, 0.62, 0.3).multiplyScalar((DESK ? (LOOK === 'open' ? 4.5 : 6.0) : 1.8) * LIT.lamp); LP.reach = 15; LP.spot = { cosInner: 0.97, cosOuter: 0.8, near: 5 }; if (DESK) LP.yOffset = 0.15; LP._fresh = true; for (const l of LP.lights || []) { l.color.copy(LP.color); l.distance = 15; } } }
  // facade light (facades.js), roof lines and wall clutter (rooftops.js), light in the air (airglow.js)
  const westAz = (NYC_SUN.azimuthStart + NYC_SUN.azimuthSpan * Math.min(1.15, (DUSK_HOURS - NYC_SUN.rise) / (NYC_SUN.set - NYC_SUN.rise))) * DEG;
  const facadeGrade = gradeFacades({ world, west: { x: Math.sin(westAz), z: -Math.cos(westAz) }, lamps: 4, skyGain: NIGHT ? 0.3 : 1, canyon: LOOK === 'open' ? (DESK ? [0.62, 1.25] : [0.72, 1.25]) : (DESK ? [0.45, 1.25] : [0.58, 1.25]) }); // the canyon floor dark, never black
  // wall relief in the dusk light, grime, curtains (walls.js; mobile: no streaks under the sills)
  const walls = params.has('nowalls') ? null : dressWalls({ world, west: { x: Math.sin(westAz), z: -Math.cos(westAz) }, sills: DESK }); // A/B: ?nowalls
  const roofs = buildRooftops({ world, scene, center: SQUARE, skip: crowns.crowned, facades: signs.facades, max: DESK ? 900 : 450, ac: 0 }); // window AC units: windowkit.js (real window layout)
  const air = new AirGlow({ scene, world, signs: signs.lights, beacons: roofs.beacons.concat(crowns.beacons), cones: DESK, maxCones: 40, cars: DESK ? 10 : 4 });
  console.info('[nyc] rooftops', roofs.counts, 'airglow', air.counts, 'ground floors', ground.counts, 'window kit', kit.counts, 'crowns', crowns.counts);
  memlog('signs');
  console.info('[nyc] signage', signs.counts, `${signs.lights.length} sign lights`);
  const lampPos = (world.props && world.props.lampHeads) || [];
  // a last drizzle in the air after the rain (the engine's AirParticles: one draw call, no CPU per drop). The drops only
  // show where light reaches them: the five street lamps nearest the camera and the car's own headlights
  const rain = new AirParticles({ preset: 'drizzle', lights: 6, budget: NY.steam, atmosphere: world.atmo });
  scene.add(rain.mesh);
  const rainLights = [], rainNear = [];
  let rainT = 0;
  const HEAD_AT = new THREE.Vector3();
  function rainLamps(cam, withCar) {
    const cx = cam.position.x, cz = cam.position.z;
    rainNear.length = 0;
    for (const hd of lampPos) { const d = (hd[0] - cx) * (hd[0] - cx) + (hd[2] - cz) * (hd[2] - cz); if (d < 60 * 60) rainNear.push([d, hd]); }
    rainNear.sort((p, q) => p[0] - q[0]);
    rainLights.length = 0;
    for (let i = 0; i < Math.min(5, rainNear.length); i++) rainLights.push({ position: rainNear[i][1], color: [1.0, 0.66, 0.36], intensity: 26, range: 14 });
    if (withCar && drive.visual && drive.visual.root.visible) { // the pool of the headlights, a few metres ahead of the bonnet
      HEAD_AT.set(0, 0.9, -5.5).applyMatrix4(drive.visual.root.matrixWorld);
      rainLights.push({ position: HEAD_AT, color: [0.9, 0.95, 1.0], intensity: 22, range: 11 });
    }
    rain.setLights(rainLights);
  }
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
  // ---------------------------------------------------------------- where things are
  const physics = world.physics;
  // the Broadway plaza point nearest the square (the people's first scatter and the sidewalk bench pose's shop front)
  const PLAZA = (() => {
    let best = null, bd = Infinity;
    for (const r of data.roads) {
      if (!r || !/^Broadway$/.test(r.n || '') || !r.p) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        for (let t = 0; t <= 1; t += 0.1) {
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          const d = Math.hypot(x - SQUARE.x, z - SQUARE.z);
          if (d < bd && !physics.queryColliders(x, z, 0.6, []).some((c) => c.maxY > 0.6)) { bd = d; best = { x, z }; }
        }
      }
    }
    if (!best) { const sp = world.getSpawn(); best = { x: sp.position.x + 8, z: sp.position.z }; }
    return best;
  })();
  // the car's start: 7th Avenue about 400 m north of the square (one way, southbound: the road's point order), facing
  // down the avenue into Times Square
  const CAR_START = (() => {
    let best = null, bs = Infinity;
    for (const r of data.roads) {
      if (!r || r.n !== '7th Avenue' || !r.p) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
        for (let t = 4; t < L - 4; t += 4) {
          const x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(x - SQUARE.x, z - SQUARE.z);
          if ((SQUARE.x - x) * dx + (SQUARE.z - z) * dz < 0.9 * d || Math.abs(d - 400) >= bs) continue;
          bs = Math.abs(d - 400); best = { x, z, h: Math.atan2(-dx, -dz) };
        }
      }
    }
    if (!best) { const sp = world.getSpawn(); best = { x: sp.position.x, z: sp.position.z, h: sp.headingRad }; }
    return best;
  })();

  // ---------------------------------------------------------------- post
  let postfx = null;
  try {
    const { width, height } = engine.size;
    const lut = nightLut(24, LOOK);
    postfx = new PostFX(renderer, scene, camera, {
      atmosphere: world.atmo, width, height, pixelRatio: engine.pixelRatio,
      ...S.postfx, ao: { radius: 1.2, thickness: 1.2, samples: 6, maxPixels: 0.25e6 }, grade: nightGrade({ look: LOOK, exposure: LOOK === 'open' ? (DESK ? 1.8 : 2.05) : (DESK ? 1.5 : 1.4) }), look: nightLook(LOOK), lut: { texture: lut.texture, size: lut.size, strength: 1 }, // open, mobile: higher (no reflections, sign lights or lamp pools from the cluster lift its street: at 1.65 it measured as dark as the low-key look)
    });
    if (!S.passes.ao) postfx.aoPass.enabled = false;
    postfx.setTimeOfDay(world.atmo.darkness);
  } catch (e) { console.warn('[nyc] post-processing unavailable', e); world.atmo.setFogMode('scene'); postfx = null; }
  // the moon's near shadow map re-renders every other frame (the city is static, its shadows faint, and the cars move
  // little in 1/60 s); three refreshes a shadow matrix only when it renders the map, so the pair stays consistent
  const moonNear = world.atmo.sun.shadow;
  moonNear.autoUpdate = false;
  let shadowFrame = 0;
  let time = 0, heldStill = false; // heldStill: the bench harness holds TAA still (quiet)
  engine.renderFn = (sc, cam, dt) => {
    if ((shadowFrame++ & 1) === 0) moonNear.needsUpdate = true;
    if (heldStill && postfx && postfx.taaPass) postfx.taaPass._reset = true; // bench / smoke captures (see quiet)
    if (postfx) postfx.render(dt); else { renderer.render(sc, cam); world.atmo.renderFlare(renderer, cam); }
  };
  // the clustered light grid and the scene copy map gl_FragCoord of the scene target: its size is PostFX's internal
  // size (the drawing buffer x renderScale under TAA), which PostFX reports on every change
  engine.onResize = (w, h, pr) => { if (postfx) postfx.setSize(w, h, pr); else world.setSize(w, h, pr); };
  if (postfx) {
    engine.onRenderScale = (s) => postfx.set('renderScale', s); // adaptive resolution: TAA's internal scale first
    postfx.onInternalResize = (w, h) => world.setSize(w, h, 1);
    postfx.onInternalResize(postfx.internalWidth, postfx.internalHeight);
  }
  else { const { width, height } = engine.size; world.setSize(width, height, engine.pixelRatio); }

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
  // ---------------------------------------------------------------- the car (cars.js), swapped from the cards
  // drive: what the systems, ExtraLights and the bench read; setCar() replaces its parts (a new body, controller and
  // interpolator at the old car's place, standing still)
  const drive = { id: '', def: null, visual: null, car: null, spec: null, smooth: null, gearbox: null };
  const state = { velocity: null, speedKmh: 0, grounded: true, wheelSlip: 0, accel: null }; // what the chase rig reads
  const placeCar = (x, z, h) => {
    drive.car.reset(new THREE.Vector3(x, world.getGroundHeight(x, z), z), h, physics);
    drive.smooth.snap(); drive.smooth.apply(drive.visual.root, 1);
    state.velocity = drive.car.velocity; state.accel = drive.car.localAccel;
    if (drive.gearbox) drive.gearbox.reset();
  };
  const setCar = (id) => {
    const def = carById(id);
    if (def.id === drive.id) return;
    const old = drive.car, at = old ? { x: old.position.x, z: old.position.z, h: old.heading } : CAR_START;
    if (drive.visual) { scene.remove(drive.visual.root); if (postfx) postfx.untrack(drive.visual.root); drive.visual.dispose(); }
    const visual = createCarVisual(def.type, { color: def.color, shadowOpacity: 0.9 });
    drive.id = def.id; drive.def = def; drive.visual = visual; drive.spec = carSpec(def);
    drive.car = new VehicleController(drive.spec);
    drive.smooth = new PoseInterpolator(drive.car);
    scene.add(visual.root);
    if (postfx) postfx.track(visual.root);
    placeCar(at.x, at.z, at.h);
    if (rig) { rig.setTarget(visual.root, () => state); rig.snap(); }
    if (tyres) tyres.clear();
    drive.gearbox = new Gearbox(def.gearbox);
    if (motor) motor.dispose();
    motor = new EngineAudio({ bus: audio, ...def.engine, idle: def.gearbox.idle, redline: def.gearbox.redline });
  };
  // headlights: the desktop tier writes two clustered spots and the tail lamps (lights.js); mobile has one real spot
  // light between the lamps (docs/HOWTO.md "Headlights"), always in the scene (a light that comes and goes changes
  // every lit material's program) and dark while the car is out of view (bench poses)
  const extra = clustered ? new ExtraLights({ clustered, world, signs: signs.lights, signals: signalLights, signRange: NY.signRange, cars: NY.cars, car: drive }) : null;
  const headSpot = clustered ? null : new THREE.SpotLight(0xfff0dc, 0, 70, 0.5, 0.45, 1.6);
  if (headSpot) scene.add(headSpot, headSpot.target);
  // people on the sidewalks
  const people = peopleIds.map((id) => assets.peek(`person-${id}`)).filter(Boolean).map((gltf) => ({ gltf })); // the height is the file's
  const peds = NY.pedestrians && people.length ? new Pedestrians({ scene, world, sources: people, count: NY.pedestrians, center: SQUARE, radius: 520, seed: 4711, postfx }) : null;
  if (peds) peds.scatter(CAR_START.x, CAR_START.z, 4711);
  // the traffic brakes for the player's car and never drives into it (TrafficSim)
  if (world.traffic) world.traffic.setPlayer(() => (drive.visual.root.visible ? drive.visual.root : null));

  // ---------------------------------------------------------------- input, chase camera, tyres, sound, HUD
  const hud = new HUD();
  const canvas = renderer.domElement;
  const touchForced = params.has('touch') ? params.get('touch') !== '0' : 'auto';
  const input = new VehicleInput(canvas, { actions: ACTIONS, touch: touchForced, touchLayout: TOUCH, assist: true });
  hud.setTouch(!!(input.touch && input.touch.visible));
  // the road feel: the camera eases back under acceleration, closes in under braking and leans out in corners; poles,
  // trunks and the traffic only block the view close to the camera
  const rig = new ChaseRig(camera, canvas, { physics, canopyFromCollider: null, thinKinds: [2, 3, 'vehicle'], flightFraming: false, feel: 'road' });
  const tyres = new TyreFx({ scene, atmosphere: world.atmo, lift: 0.04 });
  // the car's engine (EngineAudio: each car's own cylinders, its revs, load and shifts from its Gearbox), road roar, wind
  // and squeal loops, and the city's hum (CityAmbience, no gulls: no water near Midtown)
  const audio = new AudioBus({ master: 'safe', volume: 0.7 });
  audio.setBusVolume('engine', 0.5);
  let motor = null; // the current car's engine voice (setCar makes it)
  const city = new CityAmbience(audio, { gulls: false, level: 0.8 });
  city.setEnvironment({ darkness: world.atmo.darkness });
  const sfx = new SoundBank(audio, { listener: camera });
  const roar = sfx.loop('road.roar', { gain: 0 }), wind = sfx.loop('wind.rush', { gain: 0 }), squeal = sfx.loop('tyre.squeal', { gain: 0 });
  shell.use({ engine, audio, inputs: [input] });
  shell.addToggle('assist', 'Steering assist');
  shell.settings.on('assist', (on) => { input.assist.enabled = !!on; });
  setCar(shell.settings.get('car'));
  rig.setTarget(drive.visual.root, () => state); rig.activate(); rig.snap();
  hud.carChoice(shell, CARS);
  shell.settings.on('car', (id) => { if (drive.id && id !== drive.id) { setCar(id); hud.flash.show(drive.def.name.toUpperCase()); } });

  // ---------------------------------------------------------------- the edge of the baked map: a wall just inside it
  // (beyond it the city is a low context ring with no streets to drive), so the car stays in Midtown
  const EDGE = 6;
  { const B = world.bounds, x0 = B.minX + EDGE, x1 = B.maxX - EDGE, z0 = B.minZ + EDGE, z1 = B.maxZ - EDGE;
    for (const [mn, mx] of [[[x0 - 2, z0], [x0, z1]], [[x1, z0], [x1 + 2, z1]], [[x0, z0 - 2], [x1, z0]], [[x0, z1], [x1, z1 + 2]]]) physics.addStaticBox({ min: [mn[0], -20, mn[1]], max: [mx[0], 40, mx[1]], kind: 'edge' }); }

  // ---------------------------------------------------------------- street names (HUD) and the nearest street (reset)
  const SEGS = []; // [ax, az, bx, bz, name, one way]
  for (const r of data.roads) {
    if (!r || !r.n || !r.p || r.p.length < 2 || r.b) continue;
    const st = roadStyle(r); if (st.minor && !/^Broadway$/.test(r.n)) continue;
    for (let i = 0; i < r.p.length - 1; i++) SEGS.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], r.n, !!r.o]);
  }
  const segT = (s, x, z) => { const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz || 1; return Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2)); };
  const segD = (s, x, z) => { const t = segT(s, x, z); return Math.hypot(s[0] + (s[2] - s[0]) * t - x, s[1] + (s[3] - s[1]) * t - z); };
  const streetAt = (x, z) => {
    let a = null, ad = 40, b = null, bd = 80;
    for (const s of SEGS) { const d = segD(s, x, z); if (d < ad) { ad = d; a = s[4]; } }
    if (a) for (const s of SEGS) { if (s[4] === a) continue; const d = segD(s, x, z); if (d < bd) { bd = d; b = s[4]; } }
    return [a, b];
  };
  let street = ['', ''], streetT = 1;
  // R: the car back on the nearest street, standing, along it (with the traffic on a one-way street, else the way it
  // pointed), 8 m along from the nearest point so it is clear of the junction it may have hit
  const resetCar = () => {
    const c = drive.car, x = c.position.x, z = c.position.z;
    let best = null, bd = Infinity;
    for (const s of SEGS) { const d = segD(s, x, z); if (d < bd && Math.hypot(s[2] - s[0], s[3] - s[1]) > 20) { bd = d; best = s; } }
    if (!best) { placeCar(CAR_START.x, CAR_START.z, CAR_START.h); return; }
    const L = Math.hypot(best[2] - best[0], best[3] - best[1]);
    let dx = (best[2] - best[0]) / L, dz = (best[3] - best[1]) / L;
    if (!best[5] && dx * -Math.sin(c.heading) + dz * -Math.cos(c.heading) < 0) { dx = -dx; dz = -dz; }
    const t = Math.max(8, Math.min(L - 8, segT(best, x, z) * L + 8 * Math.sign(dx * (best[2] - best[0]) + dz * (best[3] - best[1]))));
    placeCar(best[0] + (best[2] - best[0]) * t / L, best[1] + (best[3] - best[1]) * t / L, Math.atan2(-dx, -dz));
    rig.snap(); tyres.clear();
  };

  // ---------------------------------------------------------------- systems (phase order = registration order)
  let hitCool = 0, edgeT = 0;
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false }; // what car.step() reads
  const carInfo = { x: 0, z: 0, fx: 0, fz: -1, hl: 2.4, hw: 0.95, speed: 0 }; // for the people (pedestrians.js)
  const _hp = new THREE.Vector3(), _ha = new THREE.Vector3();
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt, drive.car); // with the car: steer comes out assisted (the pause card's toggle)
      if (input.reset) { resetCar(); hud.flash.show('BACK ON THE STREET'); }
      if (input.toggleCamera) hud.flash.show(`CAMERA · ${rig.cycleMode().toUpperCase()}`);
      rig.setLookBack(input.lookBack);
    },
    fixedUpdate(dt) {
      const c = drive.car;
      drive.smooth.save();
      controls.throttle = input.throttle * (1 - drive.gearbox.cut); controls.brake = input.brake; controls.steer = input.steer; controls.handbrake = input.handbrake;
      c.step(dt, controls, physics); // the throttle less the gearbox's torque cut at an upshift
      hitCool -= dt; // a hit (car.impact, m/s into a wall, a pole or a car): a knock, a camera shake and a rumble
      if (c.impact > 3 && hitCool <= 0) {
        const k = Math.min(1, c.impact / 14);
        sfx.play(c.impact > 8 ? 'impact.metal' : 'impact.thud', { at: drive.visual.root, gain: 0.3 + 0.7 * k }); rig.addTrauma(Math.min(0.6, c.impact / 15));
        input.map.gamepad.rumble(0.3 + 0.7 * k, 140 + 200 * k); hitCool = 0.25;
      }
    },
    update(dt, alpha) {
      const c = drive.car, v = drive.visual, body = v.root;
      if (!harness.frozen) body.visible = true; // (the bench poses hide it)
      drive.smooth.apply(body, alpha);
      v.update(dt, c, { darkness: world.atmo.darkness }); // wheels roll, steer and ride; brake / reverse / head lamps
      tyres.update(dt, c, body);
      state.speedKmh = c.speed * 3.6; state.grounded = c.grounded; state.wheelSlip = c.wheelSlip;
      rig.update(dt);
      if (headSpot) { // mobile: the headlights' one spot light, between the lamps, aimed 20 m ahead and a little down
        const f = -drive.spec.length / 2 - 0.05;
        body.updateMatrixWorld();
        headSpot.position.copy(_hp.set(0, 0.62, f).applyMatrix4(body.matrixWorld));
        headSpot.target.position.copy(_ha.set(0, -0.6, f - 20).applyMatrix4(body.matrixWorld));
        headSpot.intensity = 520 * Math.min(1, Math.max(0, (world.atmo.darkness - 0.12) / 0.45));
      }
      carInfo.x = c.position.x; carInfo.z = c.position.z; carInfo.fx = -Math.sin(c.heading); carInfo.fz = -Math.cos(c.heading);
      carInfo.hl = drive.spec.length / 2; carInfo.hw = drive.spec.width / 2; carInfo.speed = c.speed;
    },
    lateUpdate(dt) {
      // car sounds from the car's state: motor by speed and throttle, roar and wind by speed, squeal by wheel slip
      const c = drive.car, v = c.speed, w = Math.min(v / 55, 1), slide = Math.min(Math.max((c.wheelSlip - 0.15) * 1.4, 0), 1) * Math.min(v / 6, 1);
      drive.gearbox.update(dt, c, input.throttle);
      if (motor) motor.update(dt, drive.gearbox);
      city.update(dt, { speedN: Math.min(v / 40, 1) });
      roar.setGain(c.grounded ? 0.22 * Math.min(v / 30, 1) : 0).setRate(0.8 + 0.6 * Math.min(v / 50, 1));
      wind.setGain(0.3 * w * w).setRate(0.9 + 0.3 * w);
      squeal.setGain(c.grounded ? 0.22 * slide : 0).setRate(0.96 + 0.08 * slide);
      sfx.update(dt);
      // near the wall at the map's edge: say so (R)
      const B = world.bounds, m = Math.min(c.position.x - B.minX, B.maxX - c.position.x, c.position.z - B.minZ, B.maxZ - c.position.z);
      edgeT -= dt;
      if (m < EDGE + 12 && edgeT <= 0) { hud.flash.show('EDGE OF MIDTOWN · R TO TURN BACK'); edgeT = 4; }
    },
  }, 'car');
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
      rainT -= dt; if (rainT <= 0) { rainT = 0.25; rainLamps(camera, true); }
      rain.update(dt, camera);
      if (carShadows) carShadows.update(camera.position);
      if (trim) trim.update(dt);
      pinEnv();
      if (peds) peds.update(dt, carInfo.x, carInfo.z, carInfo);
      if (heldStill && !harness.frozen) { // a resumed loop after bench poses: TAA / volumetric jitter back on
        heldStill = false;
        if (postfx && postfx.history) postfx.set('jitter', true);
        if (postfx && postfx.volumetric) { postfx.set('volumetric.jitter', true); postfx.set('volumetric.temporal', true); }
      }
    },
  }, 'fx');
  engine.addSystem({
    lateUpdate(dt) {
      const p = drive.car.position;
      streetT += dt;
      if (streetT > 0.4) { streetT = 0; street = streetAt(p.x, p.z); }
      hud.update(dt, drive.car.heading, Math.abs(drive.car.forwardSpeed) * 3.6, street[0], street[1], engine.profiler.frame.fps);
    },
  }, 'hud');

  // ---------------------------------------------------------------- bench harness (window.__sample)
  // poses: `avenue` (eye height on 7th Avenue at the square, looking down the avenue), `square` (inside the bowtie
  // looking at the densest wall of screens), `sidewalk` (by the storefronts, where the walk demo's third-person view
  // stood behind its walker). The car is out of every pose (hidden, its lights dark): the poses are the city's
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
  const SIDE = (() => { // an open shop front on a crosstown sidewalk near the Broadway plaza, the street running west
    let best = null, bd = Infinity;
    for (const l of signs.lights) {
      if (l.kind !== 'shop' || Math.abs(l.nx * WEST.x + l.nz * WEST.z) > 0.3) continue; // fronts that face across the street
      const d = Math.hypot(l.x - PLAZA.x, l.z - PLAZA.z); if (d < bd) { bd = d; best = l; }
    }
    return best;
  })();
  // bench frames as played (Bench.js `live`): what a play frame renders differently from a held one. Of the play
  // loop's systems, kept: world.update (the atmosphere's cascade schedule, far map on even frames; lamps, signals, the
  // clustered light list and its upload, ExtraLights' writes included), signage, facade grade, air glow, the GPU steam
  // step, car contact shadows, the city environment. Left out: the player's car / input and the camera rig (the camera stays at
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
  let posedAt = null; // the sidewalk pose's spot: the people are placed around it
  const hideCar = () => { drive.visual.root.visible = false; if (headSpot) headSpot.intensity = 0; posedAt = null; };
  const harness = createBenchHarness(engine, {
    name: 'nyc-night', quality: Q,
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
        hideCar();
      },
      square(cam) {
        const V = SQ_VIEW, gy = world.getGroundHeight(V.x, V.z);
        cam.position.set(V.x, gy + 1.7, V.z); cam.up.set(0, 1, 0);
        cam.lookAt(V.x + V.dx * 120, gy + 20, V.z + V.dz * 120);
        hideCar();
      },
      sidewalk(cam) {
        // on a crosstown sidewalk, the shop fronts on one side, the glow ahead
        hideCar();
        const l = SIDE || { sx: PLAZA.x, sz: PLAZA.z, nx: -WEST.z, nz: WEST.x };
        const gy = world.getGroundHeight(l.sx, l.sz);
        const nx = l.nx, nz = l.nz;
        const px = l.sx + nx * 2.4, pz = l.sz + nz * 2.4;
        posedAt = { x: px, z: pz };
        const back = cam.aspect < 1 ? 5.6 : 4.2;
        cam.position.set(px - WEST.x * back + nx * 0.9, gy + 1.8, pz - WEST.z * back + nz * 0.9); cam.up.set(0, 1, 0);
        cam.lookAt(px + WEST.x * 40 - nx * 2, gy + 4.5, pz + WEST.z * 40 - nz * 2);
      },
      // ?lookposes=1 only (picture review, not the perf bench): the close views where exposure and lamp pools show
      ...(params.has('lookposes') ? {
        drive(cam) { // the played frame: behind the player's car where it starts on 7th Avenue, its lamps on
          const r = drive.visual.root; r.visible = true; r.updateMatrixWorld(true); posedAt = null;
          drive.visual.update(0, drive.car, { darkness: world.atmo.darkness });
          const f = new THREE.Vector3(0, 0, -1).applyQuaternion(r.quaternion);
          cam.position.copy(r.position).addScaledVector(f, -6.4); cam.position.y += 2.3; cam.up.set(0, 1, 0);
          cam.lookAt(r.position.x + f.x * 16, r.position.y + 1.1, r.position.z + f.z * 16);
        },
        road(cam) { // the middle of the crosstown carriageway, looking west down the street
          const A = XTOWN, gy = world.getGroundHeight(A.x, A.z);
          cam.position.set(A.x - A.dx * 6, gy + 1.6, A.z - A.dz * 6); cam.up.set(0, 1, 0);
          cam.lookAt(A.x + A.dx * 200, gy + 9, A.z + A.dz * 200);
          hideCar();
        },
        kerb(cam) { // standing in the road by a street lamp, looking at the kerb and the pavement under it
          const A = XTOWN;
          let best = null, bd = Infinity;
          for (const h of lampPos) { const d = Math.hypot(h[0] - A.x, h[2] - A.z); if (d < bd && d > 20) { bd = d; best = h; } }
          const L = best || [A.x, 6, A.z];
          const t = (L[0] - A.x) * A.dx + (L[2] - A.z) * A.dz, cx = A.x + A.dx * (t - 7), cz = A.z + A.dz * (t - 7);
          const gy = world.getGroundHeight(cx, cz);
          cam.position.set(cx + (L[0] - (A.x + A.dx * t)) * 0.3, gy + 1.7, cz + (L[2] - (A.z + A.dz * t)) * 0.3); cam.up.set(0, 1, 0);
          cam.lookAt(L[0] + A.dx * 2, gy + 0.6, L[2] + A.dz * 2);
          hideCar();
        },
        shop(cam) { // square on to an open shop front, 6 m out
          const l = SIDE || { sx: PLAZA.x, sz: PLAZA.z, nx: -WEST.z, nz: WEST.x };
          const gy = world.getGroundHeight(l.sx, l.sz);
          cam.position.set(l.sx + l.nx * 6, gy + 1.65, l.sz + l.nz * 6); cam.up.set(0, 1, 0);
          cam.lookAt(l.sx, gy + 2.6, l.sz);
          hideCar();
        },
        shutter(cam) { // square on to the closed roller shutter nearest the sidewalk pose, 5 m out
          const l = SIDE || { sx: PLAZA.x, sz: PLAZA.z }, L = (ground && ground.closed) || [];
          let b = null, bd = Infinity;
          for (const c of L) { const d = Math.hypot(c.p[0] - l.sx, c.p[2] - l.sz); if (d < bd) { bd = d; b = c; } }
          if (!b) return;
          const x = b.p[0] + b.n[0] * 5, z = b.p[2] + b.n[2] * 5, gy = world.getGroundHeight(x, z);
          cam.position.set(x, gy + 1.65, z); cam.up.set(0, 1, 0);
          cam.lookAt(b.p[0], b.p[1], b.p[2]);
          hideCar();
        },
        facade(cam) { // from one sidewalk across the street at the facades opposite (the darkest walls)
          const A = XTOWN, rx = -A.dz, rz = A.dx, off = A.hw + Math.min(1.6, (A.sw || 2) * 0.55);
          const x = A.x + A.dx * 30 + rx * off, z = A.z + A.dz * 30 + rz * off, gy = world.getGroundHeight(x, z);
          cam.position.set(x, gy + 1.65, z); cam.up.set(0, 1, 0);
          cam.lookAt(x - rx * 30 + A.dx * 12, gy + 9, z - rz * 30 + A.dz * 12);
          hideCar();
        },
      } : {}),
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
      rainLamps(cam, true); rain.time = 4; rain.update(0, cam); // the drizzle held at a fixed moment (captures repeat)
      if (peds) peds.scatter(cam.position.x, cam.position.z, 4711);
      if (posedAt && peds) peds.update(0, posedAt.x, posedAt.z);
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
        rain.update(dt, cam);
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
        rain.time = 4; rain.update(0, cam);
        shadowFrame = shadowF;
      },
    },
    // converged captures (Bench.converged): TAA jittered and accumulating from a reset history (the jitter pattern
    // and a reused SSR buffer restart), everything else as quiet() holds it; quiet() afterwards holds the frame again
    converge: {
      begin() {
        if (!postfx || !postfx.history) return;
        heldStill = false;
        postfx.set('jitter', true);
        postfx.history.reset(); postfx.taaPass.reset();
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
      'rain': { get: () => rain.mesh.visible, set: (v) => { rain.mesh.visible = !!v; } },
    },
  });
  const bp = readBenchParams(location.search);
  if (bp.enabled && bp.size) harness.resize(bp.size.w, bp.size.h);

  // the programs, pipelines and uploads of the first frames, drawn under the loading bar (shell.ready: Engine warmUp, dt
  // 0, nothing moves) and finished on the GPU, so the first live frame does not stall with the city already showing;
  // then the loop starts and the start card shows. Bench: renderFn only, 12 frames (renderFn's every-2nd / 3rd /
  // 4th-frame counters end in the phase they started in), and the loop held until the poses (the city as loaded: no
  // live frame moves the traffic or the people first)
  memlog('before warm-up');
  if (bp.enabled) engine.start = () => engine;
  await shell.ready();
  if (bp.enabled) { delete engine.start; harness.freeze(); }
  const loadMs = Math.round(performance.now() - t0), warm = shell.warm || {};
  window.__nyc = {
    THREE, engine, world, postfx, atmo: world.atmo, clustered, extra, signs, steam, rain, wet, drive, input, rig, hud, shell, harness, peds,
    quality: Q, facadeGrade, walls, ground, kit, crowns, air, roofs, audio, motor: () => motor, setCar, placeCar, resetCar, CAR_START, SQUARE, loadMs, loadWorldMs, geo, streetAt,
  };
  console.info(`[nyc] ready in ${loadMs} ms (world ${loadWorldMs} ms, warm-up ${warm.ms} ms: compile ${warm.compileMs}, fence ${warm.fence}) · tier ${Q.tier} (${Q.source}${Q.lighter ? ', lighter after a graphics reset' : ''}) · ${signs.lights.length} sign lights · ${world.stats.lamps} lamps · ${world.stats.vehicles} vehicles · car ${drive.id}`);
  // page contract (the browser tests): window.__sample with `ready`; the shell for the start-up checks
  window.__sample = Object.assign(harness, { shell }).setReady();
}

boot().catch((err) => { console.error('[nyc] boot failed', err); shell.error(`Failed to start: ${err.message}`); });
