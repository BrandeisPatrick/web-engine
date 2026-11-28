// Atlanta drive: downtown Atlanta at golden hour, built from data. The third city demo, and the one that shows how a
// real city is described rather than hand-dressed:
//   - the map is baked OpenStreetMap (samples/public/atlanta/map/city.json, tools/bake-map.mjs: 2.8 km around
//     33.7606, -84.3905: Peachtree Street, Centennial Olympic Park, the Downtown Connector, the Capitol);
//   - the buildings a visitor would recognise are DESCRIBED in samples/public/atlanta/map/landmarks.json (height,
//     floors, cladding and its colour, plan, podium, setbacks, crown, night lighting: facts from public sources, the
//     rest deduced and marked so), and the engine's builder turns each descriptor into that building
//     (world/BuildingDescriptors.js): the mirrored cylinder of the Westin, the gold lattice pyramid of Bank of America
//     Plaza, the twin crowns of 191 Peachtree, the Capitol's gold dome;
//   - every other building is INFERRED from what the map says about it (`buildings.infer`: parking decks, churches,
//     hotels, towers with a top, warehouses) instead of the seeded style pick;
//   - street trees and parks (the "city in a forest"), traffic, people on the sidewalks, and pollen in the low sun
//     (the engine's AirParticles).
// The light is the engine's default daylight look (the measured sun-to-sky ratio): a warm low sun from the west-south-
// west down the cross streets, cool sky fill in the shade. No screen-space reflections (a dry city has nothing for
// them to do); light shafts at 0.4. Driving: a sedan on VehicleController with the steering assist, chase camera with
// the road feel, skid marks, engine and road sound, a speed readout and the street's name; R puts the car back on the
// nearest street; the edge of the baked map is a wall. GameShell: loading bar, start card, pause with volume, assist
// and the quality tiers.
// Query: ?autostart=1, ?quality=desktop|mobile, ?t=<hours>|noon|golden|dusk|night, ?bench=1&size=WxH (window.__sample:
// poses peachtree / park / skyline / capitol / drive), ?notraffic, ?nopeople, ?noinfer (the seeded style pick for
// undescribed buildings), ?nolandmarks (no descriptors: the generic builder everywhere, for an A/B).
import * as THREE from 'three';
import { Engine, PoseInterpolator, createBenchHarness, readBenchParams, resolveQuality } from '@vibe/engine/core';
import { VehicleController, Gearbox } from '@vibe/engine/physics';
import { PostFX, TextureSets, ClusteredLights, installClusteredChunks, TyreFx, AirParticles } from '@vibe/engine/render';
import { VehicleInput } from '@vibe/engine/input';
import { ChaseRig } from '@vibe/engine/camera';
import { GameShell, UILayer, Panel, Readout } from '@vibe/engine/ui';
import { AudioBus, SoundBank, EngineAudio } from '@vibe/engine/audio';
import { MapWorld, createCarVisual, roadStyle } from '@vibe/engine/world';

const params = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL, ATL = `${BASE}atlanta/`;
const DEG = Math.PI / 180, R_EARTH = 6378137;

// ---------------------------------------------------------------- quality tiers (this demo's budgets as overrides)
const Q = resolveQuality({
  storageKey: 'vibe.quality.atlanta',
  overrides: {
    desktop: {
      engine: { maxPixelRatio: 1.5, adaptiveResolution: true },
      shadows: { cascades: 3, kernel: 'fast', nearMapSize: 2048, farInterval: 4 }, // towers throw long shadows at this hour
      postfx: { ssr: false, volumetric: { scale: 0.25, steps: 12, maxDistance: 320, intensity: 0.4, density: 1 } },
      lights: { clustered: true, clusteredRange: 160, cutoff: 0.0025 },
      world: { streamRadius: 1000, traffic: 90, trafficHd: { count: 3, radius: 18, midCount: 8, midRadius: 45, parked: true } },
      atl: { textures: 'textures', pbrSize: 1024 },
    },
    mobile: {
      engine: { maxPixelRatio: 1.25, adaptiveResolution: true },
      shadows: { cascades: 1, kernel: 'fast', singleMapSize: 1024 },
      lights: { clustered: false },
      world: { streamRadius: 500, traffic: 30, trafficHd: { count: 0, midCount: 4, midRadius: 30, parked: true } },
      atl: { textures: 'textures-512', pbrSize: 512 },
    },
  },
});
const S = Q.settings, DESK = Q.tier === 'desktop';

// The sun over Atlanta in early autumn: up at 7:25, down at 19:30 (EDT), 13 degrees up at golden hour (18:35). Its
// azimuth is art-directed (as the Miami demo's is): the real sun sets in the west, across Peachtree Street, which at
// this hour lies in shadow from kerb to kerb. This one stands in the south-south-west at golden hour, so the drive
// south down Peachtree runs toward the low sun: light along the street, shadows toward the car, the towers' west and
// south faces gold.
const ATL_SUN = { rise: 7.4, set: 19.5, maxElevation: 55, nightDepth: 35, nightRate: 13, azimuthStart: 47, azimuthSpan: 166 };
const ATL_TIMES = { dawn: 7.6, morning: 10, noon: 13.45, afternoon: 16.5, golden: 18.58, sunset: 19.4, dusk: 19.85, night: 22 };

const shell = new GameShell({
  title: 'Atlanta', subtitle: 'Downtown at golden hour.', quality: Q, storageKey: 'atlanta-drive', defaults: { assist: true },
  controls: [['W S', 'Drive, brake'], ['A D', 'Steer'], ['X', 'Handbrake'], ['C', 'Camera'], ['R', 'Back on the street']],
});

async function boot() {
  shell.setProgress(0, 'Reading the map…');
  const engine = new Engine({ container: document.getElementById('app'), fixedHz: 120, maxSubsteps: 4, far: 4200, fov: 60, renderer: { antialias: false }, ...S.engine });
  const { scene, camera, renderer } = engine;
  // the wall, road and ground photo sets are the ones the NYC demo ships (Poly Haven, CC0)
  TextureSets.configure({ base: `${BASE}nyc/${S.atl.textures}/` });
  if (DESK) TextureSets.configure({ maxAnisotropy: S.textures.anisotropy });

  // ---------------------------------------------------------------- the city
  let clustered = null;
  if (S.lights.clustered) { installClusteredChunks(); clustered = new ClusteredLights({ maxLights: 512, zFar: 360, cutoff: S.lights.cutoff || 0 }); }
  const t = params.get('t');
  const world = new MapWorld({
    scene, renderer,
    data: { mapUrl: `${ATL}map/city.json`, farlandUrl: false },
    terrain: false,
    timeOfDay: t == null ? 'golden' : Number.isFinite(+t) ? +t : t,
    atmosphere: { camera, shadows: S.shadows, sun: ATL_SUN, timePresets: ATL_TIMES, cloudStyle: 'lit', maxCasterHeight: 320 },
    // Peachtree Street at the north edge of the bake, southbound: Bank of America Plaza stands 110 m ahead
    spawn: { at: { x: 507.3, z: -1243.6, heading: 3.0499, name: 'Peachtree Street Northeast' } },
    buildings: {
      landmarks: params.has('nolandmarks') ? null : `${ATL}map/landmarks.json`, // what each known building is
      infer: !params.has('noinfer'),                                           // and a deduction for the rest
      style: { oldProb: () => 0.3, victorianProb: () => 0, storeProb: { prewar: 0.8, other: 0.5, curtain: 0.4, anyType: false } },
    },
    // the city in a forest: broad-crowned street trees on every street, denser in the parks
    vegetation: { rules: [{ road: () => true, species: 'round', share: 0.9, other: 'round', radius: 34 }] },
    traffic: params.has('notraffic') ? false : { count: S.world.traffic, seed: 23, hd: S.world.trafficHd, mix: { pickup: 0.12, bus: 0.03, police: 0.02 }, area: { recycleRadius: DESK ? 360 : 280, spawnRadius: DESK ? 280 : 220 } },
    streaming: { radius: S.world.streamRadius, spawnRadius: DESK ? 600 : 400 },
    lights: clustered ? { clustered, clusteredRange: S.lights.clusteredRange, clusteredFade: 30 } : undefined,
    physics: true,
    pbrSize: S.atl.pbrSize,
  });
  engine.addSystem(world.system({ camera, loadWeight: 6 }), 'world');
  await engine.load((p, label) => shell.setProgress(0.95 * p, label));
  const data = world.data, physics = world.physics, atmo = world.atmo;
  world.trimMemory(renderer);
  // bake frame (metres around the map's centre, x east, z south) -> world
  const C = data.center, COS0 = Math.cos(C.lat * DEG);
  const geo = (lat, lon) => ({ x: (lon - C.lon) * DEG * R_EARTH * COS0 - world.offset.x, z: -(lat - C.lat) * DEG * R_EARTH - world.offset.z });
  console.info('[atlanta] world', world.stats, 'described', world.described);

  // ---------------------------------------------------------------- post-processing
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, { atmosphere: atmo, width, height, pixelRatio: engine.pixelRatio, ...S.postfx, ao: { radius: 1.4, thickness: 1.2, samples: 6, maxPixels: 0.35e6 }, look: { aoLit: 0.8, aoTint: [0, 0.02, 0.05] } });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  world.postfx = postfx;
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  engine.onRenderScale = (s) => postfx.set('renderScale', s);
  if (clustered) postfx.onInternalResize = (w, h) => clustered.setSize(w, h);

  // pollen and seeds in the low sun (Atlanta is known for it)
  const air = new AirParticles({ preset: 'pollen', atmosphere: atmo, budget: S.effects.particles });
  scene.add(air.mesh);

  // ---------------------------------------------------------------- the car
  const visual = createCarVisual('sedan', { color: 0x2b3f5c, shadowOpacity: 0.9 });
  const car = new VehicleController(visual.spec), smooth = new PoseInterpolator(car), gearbox = new Gearbox();
  scene.add(visual.root); postfx.track(visual.root);
  const state = { velocity: car.velocity, speedKmh: 0, grounded: true, wheelSlip: 0, accel: car.localAccel };
  const placeCar = (x, z, h) => { car.reset(new THREE.Vector3(x, world.getGroundHeight(x, z), z), h, physics); smooth.snap(); smooth.apply(visual.root, 1); gearbox.reset(); };
  const sp = world.getSpawn();
  const START = { x: sp.position.x, z: sp.position.z, h: sp.headingRad };
  placeCar(START.x, START.z, START.h);
  if (world.traffic) world.traffic.setPlayer(() => (visual.root.visible ? visual.root : null));

  const canvas = renderer.domElement;
  const input = new VehicleInput(canvas, { touch: 'auto', assist: true });
  const controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const tyres = new TyreFx({ scene, atmosphere: atmo, groundAt: (x, z) => world.getGroundHeight(x, z) });
  const rig = new ChaseRig(camera, canvas, { physics, canopyFromCollider: null, thinKinds: [2, 3, 'vehicle'], flightFraming: false, feel: 'road' });
  rig.setTarget(visual.root, () => state); rig.activate(); rig.snap();

  // the edge of the baked map: a wall just inside it
  { const B = world.bounds, E = 6, x0 = B.minX + E, x1 = B.maxX - E, z0 = B.minZ + E, z1 = B.maxZ - E;
    for (const [mn, mx] of [[[x0 - 2, z0], [x0, z1]], [[x1, z0], [x1 + 2, z1]], [[x0, z0 - 2], [x1, z0]], [[x0, z1], [x1, z1 + 2]]]) physics.addStaticBox({ min: [mn[0], -20, mn[1]], max: [mx[0], 40, mx[1]], kind: 'edge' }); }

  // street names (the readout) and the nearest street (R)
  const SEGS = [];
  for (const r of data.roads) {
    if (!r || !r.n || !r.p || r.p.length < 2 || r.b) continue;
    if (roadStyle(r).minor) continue;
    for (let i = 0; i < r.p.length - 1; i++) SEGS.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], r.n]);
  }
  const segT = (s, x, z) => { const dx = s[2] - s[0], dz = s[3] - s[1], L2 = dx * dx + dz * dz || 1; return Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2)); };
  const segD = (s, x, z) => { const k = segT(s, x, z); return Math.hypot(s[0] + (s[2] - s[0]) * k - x, s[1] + (s[3] - s[1]) * k - z); };
  const nearest = (x, z, minLen = 0) => { let b = null, bd = Infinity; for (const s of SEGS) { if (minLen && Math.hypot(s[2] - s[0], s[3] - s[1]) < minLen) continue; const d = segD(s, x, z); if (d < bd) { bd = d; b = s; } } return bd < 60 || minLen ? b : null; };
  const resetCar = () => {
    const s = nearest(car.position.x, car.position.z, 20);
    if (!s) { placeCar(START.x, START.z, START.h); } else {
      const L = Math.hypot(s[2] - s[0], s[3] - s[1]); let dx = (s[2] - s[0]) / L, dz = (s[3] - s[1]) / L;
      if (dx * -Math.sin(car.heading) + dz * -Math.cos(car.heading) < 0) { dx = -dx; dz = -dz; }
      const k = Math.max(8, Math.min(L - 8, segT(s, car.position.x, car.position.z) * L)) / L;
      placeCar(s[0] + (s[2] - s[0]) * k, s[1] + (s[3] - s[1]) * k, Math.atan2(-dx, -dz));
    }
    rig.snap(); tyres.clear();
  };

  // ---------------------------------------------------------------- sound and HUD
  const audio = new AudioBus({ master: 'safe', volume: 0.7 });
  audio.setBusVolume('engine', 0.5);
  const motor = new EngineAudio({ bus: audio, cylinders: 6, idle: 750, redline: 6200 });
  const sfx = new SoundBank(audio, { listener: camera });
  const roar = sfx.loop('road.roar', { gain: 0 }), wind = sfx.loop('wind.rush', { gain: 0 }), squeal = sfx.loop('tyre.squeal', { gain: 0 });
  shell.use({ engine, audio, inputs: [input] });
  shell.addToggle('assist', 'Steering assist');
  shell.settings.on('assist', (on) => { input.assist.enabled = !!on; });
  const panel = new Panel({ parent: new UILayer(), corner: 'bl' });
  const speed = panel.add(new Readout({ label: 'SPEED', value: '0', unit: 'km/h' }));
  const street = panel.add(new Readout({ label: 'STREET', value: '' }));

  // ---------------------------------------------------------------- the loop
  let hitCool = 0, streetT = 0;
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt, car);
      controls.throttle = input.throttle * (1 - gearbox.cut); controls.brake = input.brake; controls.steer = input.steer; controls.handbrake = input.handbrake;
      if (input.reset) resetCar();
      if (input.toggleCamera) rig.cycleMode();
    },
    fixedUpdate(dt) {
      smooth.save();
      car.step(dt, controls, physics);
      hitCool -= dt;
      if (car.impact > 3 && hitCool <= 0) { sfx.play(car.impact > 8 ? 'impact.metal' : 'impact.thud', { at: visual.root, gain: Math.min(1, car.impact / 12) }); rig.addTrauma(Math.min(0.6, car.impact / 15)); hitCool = 0.25; }
    },
    update(dt, alpha) {
      smooth.apply(visual.root, alpha);
      visual.update(dt, car, { darkness: atmo.darkness });
      tyres.update(dt, car, visual.root);
      state.speedKmh = car.speed * 3.6; state.grounded = car.grounded; state.wheelSlip = car.wheelSlip;
      rig.update(dt);
    },
    lateUpdate(dt) {
      const v = car.speed, w = Math.min(v / 55, 1), slide = Math.min(Math.max((car.wheelSlip - 0.15) * 1.4, 0), 1) * Math.min(v / 6, 1);
      motor.update(dt, gearbox.update(dt, car, input.throttle));
      roar.setGain(car.grounded ? 0.22 * Math.min(v / 30, 1) : 0).setRate(0.8 + 0.6 * Math.min(v / 50, 1));
      wind.setGain(0.3 * w * w).setRate(0.9 + 0.3 * w);
      squeal.setGain(car.grounded ? 0.22 * slide : 0).setRate(0.96 + 0.08 * slide);
      sfx.update(dt);
      air.update(dt, camera);
      speed.set(Math.round(Math.abs(car.forwardSpeed) * 3.6));
      streetT -= dt;
      if (streetT <= 0) { streetT = 0.4; const s = nearest(car.position.x, car.position.z); street.set(s ? s[4].replace(/ (Northeast|Northwest|Southeast|Southwest)$/, '') : ''); }
    },
  }, 'game');

  // ---------------------------------------------------------------- bench harness (window.__sample)
  // a point on the street (named by `re`) nearest a latitude / longitude: poses stand in the road, never in a wall
  const onRoad = (lat, lon, re) => {
    const p = geo(lat, lon); let best = p, bd = Infinity;
    for (const g of SEGS) {
      if (re && !re.test(g[4])) continue;
      const k = segT(g, p.x, p.z), x = g[0] + (g[2] - g[0]) * k, z = g[1] + (g[3] - g[1]) * k, d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best;
  };
  const eye = (lat, lon, re, up, toLat, toLon, toUp) => (cam) => {
    const a = re === null ? geo(lat, lon) : onRoad(lat, lon, re), b = geo(toLat, toLon), gy = world.getGroundHeight(a.x, a.z);
    cam.position.set(a.x, gy + up, a.z); cam.up.set(0, 1, 0); cam.lookAt(b.x, gy + toUp, b.z);
    visual.root.visible = false;
  };
  const harness = createBenchHarness(engine, {
    name: 'atlanta-drive', quality: Q,
    poses: {
      // Peachtree Street at Peachtree Center, looking south at the Westin's cylinder and 191 Peachtree
      peachtree: eye(33.7625, -84.3874, /^Peachtree Street/, 1.7, 33.7588, -84.3877, 70),
      // by Centennial Olympic Park, looking east at the downtown towers
      park: eye(33.7605, -84.3932, /^Centennial Olympic Park Drive/, 1.7, 33.7598, -84.3880, 60),
      // from the air in the north-west: Bank of America Plaza on the left, downtown on the right
      skyline: eye(33.7690, -84.3990, null, 150, 33.7650, -84.3870, 90),
      // the Capitol's gold dome from Washington Street
      capitol: eye(33.7490, -84.3895, /^Washington Street/, 1.7, 33.7490, -84.3882, 38),
      drive(cam) { // the played frame: behind the car where it starts on Peachtree Street
        const r = visual.root; r.visible = true; placeCar(START.x, START.z, START.h); r.updateMatrixWorld(true);
        visual.update(0, car, { darkness: atmo.darkness });
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(r.quaternion);
        cam.position.copy(r.position).addScaledVector(f, -6.4); cam.position.y += 2.3; cam.up.set(0, 1, 0);
        cam.lookAt(r.position.x + f.x * 16, r.position.y + 1.4, r.position.z + f.z * 16);
      },
    },
    after(cam) {
      const T = world.traffic, tu = T && T.update;
      if (T) T.update = () => {};
      for (let i = 0; i < 3; i++) world.update(1, cam.position);
      if (T) T.update = tu;
      if (T && T.refreshHD) T.refreshHD(cam.position);
      air.time = 5; air.update(0, cam);
    },
    async settle() {
      const St = world.streamer; if (!St) return;
      const T = world.traffic, tu = T && T.update, cam = engine.camera;
      let idle = 0;
      for (let k = 0; k < 240 && idle < 3; k++) {
        if (T) T.update = () => {};
        world.update(0.016, cam.position);
        if (T) T.update = tu;
        await new Promise((r) => setTimeout(r, 25));
        idle = St.stats.pending || St.stats.building ? 0 : idle + 1;
      }
    },
    quiet() {
      postfx.autoExposure = false; postfx.setTimeOfDay(atmo.darkness);
      if (postfx.history) { postfx.set('jitter', false); if (postfx.volumetric) { postfx.set('volumetric.jitter', false); postfx.set('volumetric.temporal', false); } postfx.history.reset(); for (let i = 0; i < 24; i++) postfx.render(0); }
    },
    converge: { begin() { if (!postfx.history) return; postfx.set('jitter', true); postfx.history.reset(); postfx.taaPass.reset(); } },
    settings: {
      'postfx.volumetric': { get: () => !!postfx.volumetric, set: (v) => postfx.set('volumetric', v ? S.postfx.volumetric || true : false) },
      'postfx.ao': { get: () => !!postfx.aoPass.enabled, set: (v) => { postfx.aoPass.enabled = !!v; } },
      'postfx.bloom': { get: () => !!postfx.get('bloom.enabled'), set: (v) => postfx.set('bloom.enabled', !!v) },
      'air': { get: () => air.mesh.visible, set: (v) => { air.mesh.visible = !!v; } },
      'time': { get: () => atmo.hours, set: (v) => { atmo.setTimeOfDay(v); postfx.setTimeOfDay(atmo.darkness); } },
    },
  });
  const bp = readBenchParams(location.search);
  if (bp.enabled && bp.size) harness.resize(bp.size.w, bp.size.h);
  if (bp.enabled) engine.start = () => engine;
  await shell.ready();
  if (bp.enabled) { delete engine.start; harness.freeze(); }
  shell.onStart(() => { placeCar(START.x, START.z, START.h); rig.snap(); tyres.clear(); });
  window.__atlanta = { THREE, engine, world, postfx, atmo, car, visual, input, rig, air, geo, shell, harness, quality: Q };
  window.__sample = Object.assign(harness, { shell }).setReady();
}

boot().catch((e) => { console.error('[atlanta] boot failed', e); shell.error(`Failed to start: ${e.message}`); });
