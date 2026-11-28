// Dev-only page for described buildings (not in the build; the dev server serves it as /dev/buildings.html):
// world/BuildingDescriptors.js + BuildingForms.js on bare footprints, without a map.
//   row A    seven towers, each from one descriptor (Atlanta's skyline as the examples)
//   row B    the lower forms: a capitol with a gold dome, a hotel slab, a church, a stadium, an arena, a parking deck,
//            a brick loft, a concrete library, a warehouse
//   pair     one footprint twice: as the generic builder makes it from the OSM tags, and from its descriptor
//   city     a small grid city, built twice on the same footprints: the generic builder, and `infer: true` with six
//            landmarks matched through a landmarks.json (applyBuildingDescriptors, by point); the `city` setting
//            switches between the two
// Query: ?time=noon|golden|dusk|night, ?pose=<id>, ?city=described|generic, ?shot=1 (no UI), ?bench=1&size=WxH.
// window.__sample (the bench harness): poses rowA, rowB, crowns, street, pair, skyline, skylineLow, block; settings
// `time`, `city`; counts() -> triangles and meshes per group.
import * as THREE from 'three';
import { Engine, createBenchHarness, readBenchParams, resolveQuality } from '@vibe/engine/core';
import { Atmosphere, PostFX, TextureSets, mulberry32 } from '@vibe/engine/render';
import { BuildingBuilder, createFacadeMaterials, enableFacadeDetail, makeFacadeTextures, loadPbrTextures, applyBuildingDescriptors } from '@vibe/engine/world';

const q = new URLSearchParams(location.search);
if (q.get('shot') || q.get('bench')) document.body.classList.add('shot');
const BASE = import.meta.env.BASE_URL;
const S = resolveQuality().settings;

// ------------------------------------------------------------------ descriptors (what a landmarks.json holds)
const TOWERS = [
  { name: 'Bank of America Plaza', year: 1992, floors: 55, height: 312, roofHeight: 264, archetype: 'stone-tower',
    massing: { setbacks: [{ at: 0.93, inset: 0.1 }] },
    facade: { system: 'piers', material: 'granite', color: '#9a6a58', glass: '#2b3a45', glassReflect: 0.45, vertical: 0.9, bay: 3 },
    crown: { type: 'open-lattice', height: 48, material: 'gold', lit: '#ffb030' }, ground: { use: 'lobby', height: 9 },
    night: { crownLight: '#ffa040', litFraction: 0.3 }, confidence: 'high' },
  { name: 'Westin Peachtree Plaza', year: 1976, floors: 73, height: 220, roofHeight: 204, archetype: 'cylinder-tower',
    massing: { plan: 'cylinder', width: 36, podium: { floors: 5 } },
    facade: { glass: '#27323c', glassReflect: 0.85, bay: 1.6, floorHeight: 2.9 },
    crown: { type: 'cylinder', height: 16, material: 'steel' }, night: { sign: { text: 'WESTIN', color: '#ffffff' }, litFraction: 0.35 } },
  { name: '191 Peachtree Tower', year: 1990, floors: 50, height: 235, roofHeight: 205, archetype: 'stone-tower',
    massing: { setbacks: [{ at: 0.86, inset: 0.1 }] },
    facade: { system: 'punched', material: 'granite', color: '#b08a78', glass: '#2a333b', vertical: 0.7, bay: 3 },
    crown: { type: 'stepped', height: 30, material: 'stone', lit: '#fff0d0' }, night: { crownLight: '#fff0d0' } },
  { name: 'One Atlantic Center', year: 1987, floors: 50, height: 250, roofHeight: 200, archetype: 'stone-tower',
    massing: { setbacks: [{ at: 0.8, inset: 0.14 }] },
    facade: { system: 'piers', material: 'granite', color: '#c09a8a', vertical: 1, bay: 2.8 },
    crown: { type: 'pyramid-spire', height: 50, material: 'copper', lit: '#ffe0b0' } },
  { name: 'Georgia-Pacific Tower', year: 1982, floors: 52, height: 212, archetype: 'stone-tower',
    massing: { setbacks: [{ at: 0.55, inset: 0.18 }, { at: 0.76, inset: 0.2 }] },
    facade: { system: 'punched', material: 'granite', color: '#b98a80', vertical: 0.3, bay: 3.2 }, crown: { type: 'flat' } },
  { name: 'Equitable Building', year: 1968, floors: 32, height: 138, archetype: 'glass-tower',
    facade: { system: 'curtain-wall', material: 'metal', color: '#1c1d1f', glass: '#15181b', glassReflect: 0.5, vertical: 0.8, bay: 1.5 },
    crown: { type: 'flat' }, night: { sign: { text: 'EQUITABLE', color: '#ffffff' } } },
  { name: 'Blue glass tower', floors: 44, height: 205, roofHeight: 170, archetype: 'glass-tower',
    massing: { taper: 0.18, podium: { floors: 4 } }, facade: { glass: '#3f6a8c', glassReflect: 0.7, vertical: 0.2 },
    crown: { type: 'antenna', height: 35 }, night: { crownLight: '#60a0ff' } },
];
const ellipse = (cx, cz, rx, rz, n = 40) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cz + Math.sin((i / n) * Math.PI * 2) * rz]);
const rect = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
const LOWER = [
  [{ name: 'Georgia State Capitol', year: 1889, height: 83, roofHeight: 26, archetype: 'civic-classical', facade: { color: '#d9d2c0' },
    crown: { type: 'dome', height: 57, material: 'gold', lit: '#ffd070' } }, (x, z) => rect(x, z, 90, 46), 26],
  [{ name: 'Hyatt Regency', year: 1967, floors: 22, height: 74, roofHeight: 66, archetype: 'hotel-slab', facade: { material: 'concrete', color: '#cdc7ba' },
    crown: { type: 'dome', height: 8, material: 'glass', color: '#2a60c0', lit: '#3070ff' }, night: { sign: { text: 'HYATT REGENCY', color: '#ffffff' } } }, (x, z) => rect(x, z, 70, 24), 66],
  [{ name: 'First Church', archetype: 'church', facade: { material: 'brick', color: '#8a4d3c' } }, (x, z) => rect(x, z, 22, 46), 36],
  [{ name: 'Parking deck', archetype: 'parking-deck', floors: 7 }, (x, z) => rect(x, z, 64, 36), 22],
  [{ name: 'Brick loft', archetype: 'brick-loft', floors: 9, ground: { use: 'retail', height: 5 } }, (x, z) => rect(x, z, 60, 30), 40],
  [{ name: 'Central Library', archetype: 'brutalist', floors: 8, facade: { system: 'ribbon', color: '#aaa49a' } }, (x, z) => rect(x, z, 56, 40), 34],
  [{ name: 'Warehouse', archetype: 'warehouse' }, (x, z) => rect(x, z, 70, 40), 11],
];
const VENUES = [
  [{ name: 'Stadium', archetype: 'stadium', night: { litFraction: 0.5 } }, (x, z) => ellipse(x, z, 120, 100), 58],
  [{ name: 'Arena', archetype: 'arena', night: { sign: { text: 'ARENA', color: '#ffd9a0' } } }, (x, z) => ellipse(x, z, 60, 48, 28), 36],
];

// ------------------------------------------------------------------ the page
async function boot() {
  const engine = new Engine({ container: document.getElementById('app'), renderer: { antialias: false }, ...S.engine, adaptiveResolution: false });
  const { scene, camera, renderer } = engine;
  camera.fov = 50; camera.near = 0.5; camera.far = 9000; camera.updateProjectionMatrix();
  const atmosphere = new Atmosphere({ scene, renderer, camera, timeOfDay: q.get('time') || 'noon', shadows: S.shadows, cloudStyle: 'lit', lowSunEnv: true, twilightKey: true });
  atmosphere.maxBuildingHeight = 330;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b5d60, roughness: 0.92 }));
  ground.receiveShadow = true; scene.add(ground);

  TextureSets.configure({ base: `${BASE}nyc/textures/`, manifestIds: true });
  const mats = createFacadeMaterials(makeFacadeTextures(renderer), await loadPbrTextures(renderer, { size: 512 }));
  enableFacadeDetail(mats, { dimRooms: 0.22 });
  const U = mats.uniforms;
  const groups = {}, counts = {};
  const add = (name, builder, at = [0, 0]) => {
    const g = new THREE.Group(); g.name = name; g.position.set(at[0], 0, at[1]);
    for (const m of builder.build(mats)) g.add(m);
    scene.add(g); groups[name] = g;
    counts[name] = { ...builder.stats, buildings: builder.count, described: builder.described };
    return g;
  };
  // the rows stand on a street along their +z side (the camera's): entrances and shop fronts face it
  const builder = (o = {}) => new BuildingBuilder({ minX: -1200, maxX: 1200, minZ: -1200, maxZ: 1200 }, { baseGrid: [1, 1], detailGrid: [2, 2], lodDist: 400, streetAt: (x, z) => z > 12, ...o });
  const row = (name, items, at, gap, seed) => {
    const bb = builder(), ws = items.map(([, fp]) => { const r = fp(0, 0); return Math.max(...r.map((p) => p[0])) - Math.min(...r.map((p) => p[0])); });
    let x = -(ws.reduce((a, w) => a + w, 0) + gap * (items.length - 1)) / 2;
    items.forEach(([d, fp, h], i) => { x += ws[i] / 2; bb.add({ p: fp(x, 0), h, d }, mulberry32(seed + i)); x += ws[i] / 2 + gap; });
    add(name, bb, at);
  };

  // ---- row A: the towers (facing +z, the camera's side)
  {
    const bb = builder();
    TOWERS.forEach((d, i) => { const x = (i - (TOWERS.length - 1) / 2) * 84; bb.add({ p: d.name === 'Equitable Building' ? rect(x, 0, 54, 34) : rect(x, 0, 50, 50), h: d.height, d }, mulberry32(101 + i)); });
    add('rowA', bb);
  }
  // ---- row B: the lower forms; the venues
  row('rowB', LOWER, [0, 900], 26, 303);
  row('venues', VENUES, [-1400, 900], 60, 505);
  // ---- pair: what OSM gives for the tallest tower, through the generic builder and through its descriptor
  {
    const bb = builder(), osm = { h: 312, lv: 55, t: 'office', n: 'Bank of America Plaza' };
    bb.add({ ...osm, p: rect(-60, 0, 50, 50) }, mulberry32(11));
    bb.add({ ...osm, p: rect(60, 0, 50, 50), d: TOWERS[0] }, mulberry32(11));
    add('pair', bb, [0, 1800]);
  }
  // ---- city: the same footprints through the generic builder and through infer + six landmarks from a landmarks.json
  const city = (described) => {
    const R = mulberry32(2024), list = [];
    const names = { hotel: ['Hilton Garden Inn', 'Marriott Marquis', 'Omni Hotel', 'Sheraton Hotel'], church: ["St Luke's Church", 'First Baptist Church'], parking: ['Parking Deck', 'City Garage'], hospital: ['Grady Memorial Hospital'], office: ['Peachtree Center', 'First National Bank Building', 'Trust Company Tower', 'Plaza Tower', ''] };
    for (let i = -6; i <= 6; i++) for (let k = -4; k <= 4; k++) {
      const cx = i * 96, cz = k * 78, d = Math.hypot(cx, cz), dt = Math.exp(-((d / 330) ** 2));
      const lots = R() < 0.5 ? 1 : 2;
      for (let a = 0; a < lots; a++) {
        const w = lots === 1 ? 70 : 33, x = cx + (lots === 1 ? 0 : (a - 0.5) * 37), dz = 44 + R() * 12, r = R();
        const kind = r < 0.1 ? 'hotel' : r < 0.14 ? 'church' : r < 0.22 ? 'parking' : r < 0.25 ? 'hospital' : r < 0.36 ? 'apartments' : r < 0.42 ? 'warehouse' : 'office';
        let h = 10 + R() * 18 + dt * (30 + 190 * R() ** 1.6);
        if (kind === 'church') h = 22 + R() * 14; if (kind === 'parking') h = 14 + R() * 12; if (kind === 'warehouse') h = 8 + R() * 5;
        const b = { p: rect(x, cz, w - R() * 6, dz), h: Math.round(h * 10) / 10, t: kind === 'office' && R() < 0.4 ? 'yes' : kind };
        const nm = names[kind]; if (nm) { const n = nm[Math.floor(R() * nm.length)]; if (n) b.n = n; }
        list.push(b);
      }
    }
    const data = { buildings: list };
    if (described) {
      // six landmarks on the lots nearest the centre, matched by a point inside the footprint (bake-frame metres)
      const lots = list.map((b, i) => [Math.hypot((b.p[0][0] + b.p[2][0]) / 2, (b.p[0][1] + b.p[2][1]) / 2), i]).sort((a, b) => a[0] - b[0]).slice(0, 6);
      const file = { v: 1, city: 'dev', buildings: lots.map(([, i], k) => ({ ...TOWERS[k], match: { xz: [(list[i].p[0][0] + list[i].p[2][0]) / 2, (list[i].p[0][1] + list[i].p[2][1]) / 2] } })) };
      window.__landmarks = applyBuildingDescriptors(data, file);
    }
    const bb = builder({ baseGrid: [2, 2], detailGrid: [4, 4], lodDist: 300, detailFloors: 4, streetAt: null, infer: described, style: { storeProb: { prewar: 0.8, other: 0.5, curtain: 0.4 } } });
    list.forEach((b, i) => bb.add(b, mulberry32(i * 7919 + 13)));
    return bb;
  };
  add('cityDescribed', city(true), [3000, 0]);
  add('cityGeneric', city(false), [3000, 0]).visible = false;

  // ---- post-processing, time of day
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx, volumetric: false });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  const state = { time: q.get('time') || 'noon', city: q.get('city') || 'described', pose: q.get('pose') || 'rowA' };
  const setTime = (t) => {
    state.time = t;
    atmosphere.setTimeOfDay(isNaN(+t) ? t : +t);
    atmosphere.update(camera.position, 0);
    postfx.setTimeOfDay(atmosphere.darkness);
    U.uNight.value = atmosphere.windowGlow; U.uLitFrac.value = 0.2 + 0.14 * atmosphere.darkness;
  };
  const setCity = (v) => { state.city = v; groups.cityDescribed.visible = v !== 'generic'; groups.cityGeneric.visible = v === 'generic'; };
  engine.addSystem({ update: (dt) => { atmosphere.update(camera.position, dt); U.uTime.value += dt; } });

  const look = (p, t) => (cam) => { cam.position.set(...p); cam.lookAt(...t); };
  const poses = {
    rowA: look([40, 70, 470], [0, 150, 0]),
    crowns: look([-40, 250, 330], [-60, 255, 0]),
    street: look([-222, 1.7, 62], [-252, 16, 25]),
    lobby: look([-240, 1.7, 52], [-252, 4.5, 25]),
    rowB: look([-20, 60, 1300], [0, 30, 900]),
    rowB1: look([-165, 22, 1040], [-150, 26, 900]),
    rowB2: look([110, 14, 1010], [130, 13, 900]),
    venues: look([-1330, 120, 1240], [-1400, 10, 900]),
    pair: look([0, 120, 2260], [0, 165, 1800]),
    skyline: look([3000 + 200, 40, 640], [3000, 115, 0]),
    skylineLow: look([3000 - 420, 2.2, 520], [3000, 90, 0]),
    block: look([3000 + 150, 150, 330], [3000, 60, 0]),
  };
  const harness = createBenchHarness(engine, {
    name: 'dev-buildings', poses,
    after: (cam) => atmosphere.update(cam.position, 0),
    quiet: () => { postfx.autoExposure = false; postfx.setTimeOfDay(atmosphere.darkness); },
    settings: { time: { get: () => state.time, set: setTime }, city: { get: () => state.city, set: setCity } },
  });
  const bp = readBenchParams(location.search);
  if (bp.enabled && bp.size) harness.resize(bp.size.w, bp.size.h);
  setTime(state.time); setCity(state.city);
  poses[state.pose in poses ? state.pose : 'rowA'](camera);

  // ---- UI
  const $ = (id) => document.getElementById(id);
  for (const p of Object.keys(poses)) { const o = document.createElement('option'); o.textContent = p; $('pose').appendChild(o); }
  $('pose').value = state.pose; $('time').value = state.time; $('city').value = state.city;
  $('pose').onchange = (e) => { poses[e.target.value](camera); };
  $('time').onchange = (e) => setTime(e.target.value);
  $('city').onchange = (e) => setCity(e.target.value);
  setInterval(() => { $('stats').textContent = `${renderer.info.render.triangles} tris, ${renderer.info.render.calls} calls`; }, 500);

  await engine.warmUp();
  engine.start();
  window.__sample = Object.assign(harness, { counts: () => counts, groups: () => Object.keys(groups), atmosphere, postfx }).setReady();
}
boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;top:60px;left:10px;color:#f66">${String(e && e.stack || e)}</pre>`); });
