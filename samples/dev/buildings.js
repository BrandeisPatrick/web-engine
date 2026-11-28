// Dev-only page for described buildings (not in the build; the dev server serves it as /dev/buildings.html):
// world/BuildingDescriptors.js + BuildingForms.js on bare footprints, without a map. The descriptors are a real
// landmarks.json (samples/dev/buildings.landmarks.json), matched to the page's footprints by name.
//   rowA     seven towers (Atlanta's skyline as the examples)
//   rowB     the lower forms: a capitol with a gold dome, a hotel slab, a church, a parking deck, a brick loft, a
//            concrete library, a warehouse
//   venues   a stadium and an arena
//   pair     one footprint twice: as the generic builder makes it from the OSM tags, and from its descriptor
//   city     a small grid city, built twice on the same footprints: the generic builder, and `infer: true` with six
//            landmarks matched by a point; the `city` setting switches between the two
//   map      ?map=<folder URL>: a bake's city.json with the landmarks.json beside it, built at the origin (no terrain,
//            roads or streaming; texture windows only), again twice: generic, and landmarks + infer. Poses mapS / mapW /
//            mapN / mapE (the skyline from 1.5 km), mapTop, and `look` (the `look` setting names a described building)
// Query: ?time=noon|golden|dusk|night, ?pose=<id>, ?city=described|generic, ?shot=1 (no UI), ?bench=1&size=WxH.
// window.__sample (the bench harness): poses rowA, crowns, lattice, street, lobby, rowB, rowB1, rowB2, venues, pair,
// skyline, skylineLow, block; settings `time`, `city`, `look`; counts() -> the builders' triangle counts per group;
// matched() -> what applyBuildingDescriptors returned per group.
import * as THREE from 'three';
import { Engine, createBenchHarness, readBenchParams, resolveQuality } from '@vibe/engine/core';
import { Atmosphere, PostFX, TextureSets, mulberry32 } from '@vibe/engine/render';
import { BuildingBuilder, createFacadeMaterials, enableFacadeDetail, makeFacadeTextures, loadPbrTextures, applyBuildingDescriptors } from '@vibe/engine/world';
import LANDMARKS from './buildings.landmarks.json';

const q = new URLSearchParams(location.search);
if (q.get('shot') || q.get('bench')) document.body.classList.add('shot');
const BASE = import.meta.env.BASE_URL;
const S = resolveQuality().settings;

// ------------------------------------------------------------------ footprints (what a city.json holds: p, h, t, n)
const ellipse = (rx, rz, n = 40) => (x, z) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * rx, z + Math.sin((i / n) * Math.PI * 2) * rz]);
const rect = (w, d) => (x, z) => [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]];
const TOWERS = [['Bank of America Plaza', rect(50, 50), 312], ['Westin Peachtree Plaza', rect(50, 50), 220], ['191 Peachtree Tower', rect(50, 50), 235], ['One Atlantic Center', rect(50, 50), 250],
  ['Georgia-Pacific Tower', rect(50, 50), 212], ['Equitable Building', rect(54, 34), 138], ['Blue glass tower', rect(50, 50), 190]];
const LOWER = [['Georgia State Capitol', rect(90, 46), 26, 'government'], ['Hyatt Regency', rect(70, 24), 66, 'hotel'], ['First Church', rect(22, 46), 36, 'church'], ['Parking deck', rect(64, 36), 22, 'parking'],
  ['Brick loft', rect(60, 30), 40], ['Central Library', rect(56, 40), 34, 'public'], ['Warehouse', rect(70, 40), 11, 'warehouse']];
const VENUES = [['Stadium', ellipse(120, 100), 58, 'stadium'], ['Arena', ellipse(60, 48, 28), 36]];

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
  const groups = {}, counts = {}, matched = {};
  const add = (name, builder, at = [0, 0]) => {
    const g = new THREE.Group(); g.name = name; g.position.set(at[0], 0, at[1]);
    for (const m of builder.build(mats)) g.add(m);
    scene.add(g); groups[name] = g;
    counts[name] = { ...builder.stats, buildings: builder.count, described: builder.described };
    return g;
  };
  // the rows stand on a street along their +z side (the camera's): entrances, shop fronts and signs face it
  const builder = (o = {}) => new BuildingBuilder({ minX: -1200, maxX: 1200, minZ: -1200, maxZ: 1200 }, { baseGrid: [1, 1], detailGrid: [2, 2], lodDist: 400, streetAt: (x, z) => z > 12, ...o });
  /** A row of footprints along x, their descriptors matched by name from the landmarks.json. */
  const row = (name, items, at, gap, seed) => {
    const ws = items.map(([, fp]) => { const r = fp(0, 0); return Math.max(...r.map((p) => p[0])) - Math.min(...r.map((p) => p[0])); });
    let x = -(ws.reduce((a, w) => a + w, 0) + gap * (items.length - 1)) / 2;
    const data = { buildings: items.map(([n, fp, h, t], i) => { x += ws[i] / 2; const b = { p: fp(x, 0), h, n, t: t || 'office' }; x += ws[i] / 2 + gap; return b; }) };
    matched[name] = applyBuildingDescriptors(data, LANDMARKS);
    const bb = builder();
    data.buildings.forEach((b, i) => bb.add(b, mulberry32(seed + i)));
    add(name, bb, at);
  };
  row('rowA', TOWERS, [0, 0], 34, 101);
  row('rowB', LOWER, [0, 900], 26, 303);
  row('venues', VENUES, [-1400, 900], 60, 505);
  // ---- pair: what OSM gives for the tallest tower, through the generic builder and through its descriptor
  {
    const osm = { h: 312, lv: 55, t: 'office', n: 'Bank of America Plaza' };
    const data = { buildings: [{ ...osm, p: rect(50, 50)(60, 0) }] };
    applyBuildingDescriptors(data, LANDMARKS);
    const bb = builder();
    bb.add({ ...osm, p: rect(50, 50)(-60, 0) }, mulberry32(11));
    bb.add(data.buildings[0], mulberry32(11));
    add('pair', bb, [0, 1800]);
  }
  // ---- city: the same footprints through the generic builder and through infer + six landmarks matched by a point
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
        const b = { p: rect(w - R() * 6, dz)(x, cz), h: Math.round(h * 10) / 10, t: kind === 'office' && R() < 0.4 ? 'yes' : kind };
        const nm = names[kind]; if (nm) { const n = nm[Math.floor(R() * nm.length)]; if (n) b.n = n; }
        list.push(b);
      }
    }
    const data = { buildings: list };
    if (described) {
      const mid = (b) => [(b.p[0][0] + b.p[2][0]) / 2, (b.p[0][1] + b.p[2][1]) / 2];
      const lots = list.map((b, i) => [Math.hypot(...mid(b)), i]).sort((a, b) => a[0] - b[0]).slice(0, 6);
      matched.city = applyBuildingDescriptors(data, { v: 1, city: 'dev', buildings: lots.map(([, i], k) => ({ ...LANDMARKS.buildings[k], match: { xz: mid(list[i]) } })) });
    }
    const bb = builder({ baseGrid: [2, 2], detailGrid: [4, 4], lodDist: 300, detailFloors: 4, streetAt: null, infer: described, style: { storeProb: { prewar: 0.8, other: 0.5, curtain: 0.4 } } });
    list.forEach((b, i) => bb.add(b, mulberry32(i * 7919 + 13)));
    return bb;
  };
  // ---- map: a bake and its landmarks.json (?map=<folder URL>), in place of the grid city
  const mapUrl = q.get('map'), named = new Map(), masses = []; // described buildings by name, every building: { x, z, h, r } (the `look` pose)
  const mapCity = async (described) => {
    const data = await (await fetch(`${mapUrl}city.json`)).json();
    if (described) {
      matched.map = applyBuildingDescriptors(data, await (await fetch(`${mapUrl}landmarks.json`)).json());
      for (const b of data.buildings) {
        const xs = b.p.map((p) => p[0]), zs = b.p.map((p) => p[1]);
        const m = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, h: b.d ? b.d.height || b.d.roofHeight || b.h : b.h, r: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) };
        masses.push(m); if (b.d) named.set(b.d.name, m);
      }
    }
    const half = (data.size || 3000) / 2;
    const bb = new BuildingBuilder({ minX: -half, maxX: half, minZ: -half, maxZ: half }, { baseGrid: [4, 4], detailGrid: [8, 8], lodDist: 300, nearDetail: false, infer: described });
    data.buildings.forEach((b, i) => { try { bb.add(b, mulberry32((i * 2654435761) >>> 0)); } catch (e) { console.warn('[dev] building failed', b.n, e); } });
    return bb;
  };
  const at = mapUrl ? [0, 0] : [3000, 0];
  add('cityDescribed', mapUrl ? await mapCity(true) : city(true), at);
  add('cityGeneric', mapUrl ? await mapCity(false) : city(false), at).visible = false;

  // ---- post-processing, time of day
  const { width, height } = engine.size;
  const postfx = new PostFX(renderer, scene, camera, { atmosphere, width, height, pixelRatio: engine.pixelRatio, ...S.postfx, volumetric: false });
  if (postfx.aoPass) postfx.aoPass.enabled = S.passes.ao;
  if (postfx.bloomPass) postfx.bloomPass.enabled = S.passes.bloom;
  engine.renderFn = (sc, cam, dt) => postfx.render(dt);
  engine.onResize = (w, h, pr) => postfx.setSize(w, h, pr);
  const state = { time: q.get('time') || 'noon', city: q.get('city') || 'described', pose: q.get('pose') || (mapUrl ? 'mapS' : 'rowA'), look: q.get('look') || '' };
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
    lattice: look([-212, 262, 78], [-252, 286, 0]),
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
  if (mapUrl) {
    Object.assign(poses, {
      mapS: look([0, 70, 1750], [0, 110, 0]), mapW: look([-1750, 70, 0], [0, 110, 0]), mapN: look([0, 70, -1750], [0, 110, 0]), mapE: look([1750, 70, 0], [0, 110, 0]),
      mapTop: look([500, 900, 1300], [0, 0, -100]),
      // the building the `look` setting names (the first described one by default), from the side with the fewest
      // buildings in the line of sight
      look: (cam) => {
        const t = named.get(state.look) || [...named.values()][0]; if (!t) return;
        const d = Math.max(90, t.h * 1.25, t.r * 1.5), y = t.h * 0.5 + d * 0.32;
        let best = null;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, cx = t.x + Math.cos(a) * d, cz = t.z + Math.sin(a) * d;
          let block = 0;
          for (const m of masses) {
            if (m === t) continue;
            const u = ((m.x - cx) * (t.x - cx) + (m.z - cz) * (t.z - cz)) / (d * d);
            if (u < -0.1 || u > 0.9) continue;
            if (Math.hypot(m.x - (cx + (t.x - cx) * u), m.z - (cz + (t.z - cz) * u)) < m.r * 0.6 + 6 && m.h > t.h * 0.25) block += Math.min(m.h, y) * m.r;
          }
          if (!best || block < best[0]) best = [block, cx, cz];
        }
        cam.position.set(best[1], y, best[2]); cam.lookAt(t.x, t.h * 0.5, t.z);
      },
    });
  }
  const harness = createBenchHarness(engine, {
    name: 'dev-buildings', poses,
    after: (cam) => atmosphere.update(cam.position, 0),
    quiet: () => { postfx.autoExposure = false; postfx.setTimeOfDay(atmosphere.darkness); },
    settings: { time: { get: () => state.time, set: setTime }, city: { get: () => state.city, set: setCity }, look: { get: () => state.look, set: (v) => { state.look = String(v); } } },
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
  window.__sample = Object.assign(harness, { counts: () => counts, matched: () => matched, groups: () => Object.keys(groups), atmosphere, postfx }).setReady();
}
boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;top:60px;left:10px;color:#f66">${String(e && e.stack || e)}</pre>`); });
