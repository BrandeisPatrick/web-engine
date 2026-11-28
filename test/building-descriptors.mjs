// Building descriptors (world/BuildingDescriptors.js, BuildingForms.js, the `b.d` path of BuildingBuilder), headless:
//   - the schema: unknown field names and enum values throw and list the valid ones; archetype defaults; idempotent;
//   - matching a landmarks.json to city.json buildings: by name, by a point (metres, lon / lat), by OSM id; the widest
//     tall candidate takes the descriptor, OSM parts inside it are dropped, a podium round it stays;
//   - the gate: buildings without a descriptor are built exactly as before descriptors existed (a pinned fingerprint
//     of a tagged set of 400 footprints, and byte-identical next to described buildings in the same builder);
//   - every archetype, crown, plan, facade system and ground use builds: finite, deterministic, within a triangle budget,
//     the architectural top where the descriptor puts it, colliders at the roof height;
//   - inference from OSM tags (opt-in): which tags give which archetype, never for OSM parts, deterministic;
//   - MapWorld: `buildings: { landmarks, infer }` on the procedural city.
// Run: node --import ./test/helpers/dom-shim.mjs test/building-descriptors.mjs
import * as THREE from 'three';
import {
  BuildingBuilder, MapWorld, generateProceduralCity,
  ARCHETYPES, PLANS, FACADE_SYSTEMS, FACADE_MATERIALS, CROWN_TYPES, GROUND_USES,
  validateLandmarks, resolveDescriptor, applyBuildingDescriptors, inferDescriptor, describedRoofHeight, signRuns, planRing, packGrid, packSurf, rgb555,
} from '@vibe/engine/world';
import { mulberry32 } from '@vibe/engine/render';
import { hashBuildingMeshes } from './helpers/building-hash.mjs';

const out = console.log.bind(console); // the builders log their stats: console.log / info / warn are silenced below
let failures = 0, checks = 0;
const ok = (cond, name, detail = '') => { checks++; if (!cond) { failures++; out(`FAIL  ${name}${detail ? '  ' + detail : ''}`); } };
const throws = (fn, re, name) => { let msg = ''; try { fn(); } catch (e) { msg = String(e.message); } ok(re.test(msg), name, `got "${msg}"`); };
for (const k of ['info', 'log', 'warn']) console[k] = () => {};
const rect = (x, z, w, d) => [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
const NOMATS = { facade: null, windows: null, depth: null, winDepth: null };
const REGION = { minX: -700, maxX: 700, minZ: -700, maxZ: 700 };
const group = (bb) => { const g = new THREE.Group(); for (const m of bb.build(NOMATS)) g.add(m); return g; };

// ---------------------------------------------------------------- schema
{
  throws(() => validateLandmarks({ v: 1, buildings: [{ match: { name: 'A' }, colour: 'red' }] }), /unknown field 'colour' \(match, name, year, floors, height/, 'unknown descriptor field throws with the valid names');
  throws(() => validateLandmarks({ v: 1, buildings: [{ match: { name: 'A' }, facade: { sytem: 'piers' } }] }), /facade: unknown field 'sytem' \(system, material/, 'unknown facade field throws with the valid names');
  throws(() => validateLandmarks({ v: 1, buildings: [{ match: { name: 'A' }, archetype: 'skyscraper' }] }), /unknown value 'skyscraper' \(glass-tower, stone-tower/, 'unknown archetype throws with the valid ones');
  throws(() => validateLandmarks({ v: 1, buildings: [{ match: { name: 'A' }, crown: { type: 'spire' } }] }), /crown.type: unknown value 'spire' \(pyramid-spire/, 'unknown crown type throws with the valid ones');
  throws(() => validateLandmarks({ v: 1, buildings: [{ match: { name: 'A' }, facade: { color: 'brown' } }] }), /expected a colour '#rrggbb'/, 'a colour that is not hex throws');
  throws(() => validateLandmarks({ v: 1, buildings: [{ name: 'A' }] }), /match needs one of name, osm, at, xz/, 'a descriptor without a match throws');
  throws(() => validateLandmarks({ v: 2, buildings: [] }), /unknown version 2/, 'an unknown version throws');
  throws(() => validateLandmarks({ v: 1, building: [] }), /unknown field 'building' \(v, city, buildings/, 'unknown top-level field throws');
  throws(() => resolveDescriptor({ massing: { setbacks: [{ at: 1.5 }] } }), /setbacks\[0\]\.at: expected a number in 0\.02 \.\. 0\.98/, 'a setback outside the building throws');
  const d = resolveDescriptor({ archetype: 'artdeco-setback', height: 120, facade: { color: '#8a5a44' }, night: { sign: { text: 'westin' } } });
  ok(d._r && d.system === 'piers' && d.material === 'limestone' && d.crown.type === 'stepped' && d.setbacks.length === 2 && d.ground.use === 'lobby', 'archetype defaults fill what the descriptor leaves out');
  ok(Math.abs(d.color[0] - 0x8a / 255) < 1e-9 && d.night.sign.text === 'WESTIN' && d.night.sign.color[0] === 1, 'colours parsed, sign text upper case, default sign colour white');
  ok(resolveDescriptor(d) === d, 'resolveDescriptor is idempotent');
  ok(describedRoofHeight(resolveDescriptor({ height: 312, roofHeight: 264 }), 100) === 264 && describedRoofHeight(resolveDescriptor({ height: 150 }), 100) === 150 && describedRoofHeight(resolveDescriptor({}), 100) === 100, 'roof height: the descriptor\'s, else the architectural height of a flat top, else OSM\'s');
  ok(describedRoofHeight(resolveDescriptor({ height: 200, crown: { type: 'pyramid-spire', height: 40 } }), 100) === 160, 'roof height under a crown: height - crown height');
  for (const a of ARCHETYPES) ok(resolveDescriptor({ archetype: a }).archetype === a, `archetype ${a} resolves`);
  const r = signRuns('I-1');
  ok(r.w === 17 && r.runs.length === 7 + 1 + 7 && r.runs.every(([a, b, row]) => a <= b && b < 17 && row >= 0 && row < 7), 'signRuns: runs of lit pixels in a 5 x 7 font, one column between letters');
  ok(packGrid({ pier: 0.75, span: 0.75, emph: 3, kind: 3, lit: 1 }) === 32767 && packSurf({ metal: 1, rough: 1, glow: 4, pat: 7 }) === 32767 && rgb555([1, 1, 1]) === 32767, 'packed vertex info fits a signed 16-bit component');
}

// ---------------------------------------------------------------- matching
{
  const mk = () => ({
    center: { lat: 33.75, lon: -84.39 },
    buildings: [
      { p: rect(0, 0, 40, 40), h: 200, n: 'Bank Plaza', part: 1 },              // 0 the shaft
      { p: rect(-30, -30, 100, 100), h: 18, n: 'Bank Plaza', part: 1 },          // 1 a podium round it
      { p: rect(10, 10, 12, 12), h: 240, mh: 200, n: 'Bank Plaza', part: 1 },    // 2 a part on top of the shaft
      { p: rect(300, 0, 30, 30), h: 60, n: 'The Westin Peachtree Plaza, Atlanta' }, // 3
      { p: rect(500, 0, 30, 30), h: 40, id: 'way/123' },                         // 4
      { p: rect(700, 0, 30, 30), h: 40 },                                        // 5
    ],
  });
  let data = mk();
  let res = applyBuildingDescriptors(data, { v: 1, city: 't', buildings: [
    { match: { name: 'bank plaza' }, archetype: 'stone-tower', height: 250, roofHeight: 210 },
    { match: { name: 'Westin Peachtree Plaza Atlanta' }, archetype: 'cylinder-tower' },
    { match: { osm: 'w123' }, archetype: 'church' },
    { match: { xz: [715, 15] }, archetype: 'parking-deck' },
    { match: { name: 'Nowhere Tower' } },
  ] });
  ok(res.matched === 4 && res.unmatched.length === 1 && res.unmatched[0] === 'Nowhere Tower', 'four descriptors matched, the missing one reported', JSON.stringify(res));
  ok(data.buildings[0].d && data.buildings[0].d.archetype === 'stone-tower' && !data.buildings[1].d, 'by name: the widest candidate at least half as tall as the tallest takes the descriptor');
  ok(data.buildings[2]._dsup === 1 && !data.buildings[1]._dsup && res.suppressed === 1, 'the OSM part inside the described footprint is dropped, the podium round it stays');
  ok(data.buildings[3].d && data.buildings[3].d.archetype === 'cylinder-tower', 'names match without case, punctuation or "the"');
  ok(data.buildings[4].d && data.buildings[4].d.archetype === 'church', 'by OSM id (way/123 = w123)');
  ok(data.buildings[5].d && data.buildings[5].d.archetype === 'parking-deck', 'by a point inside the footprint (metres)');
  // lon / lat: the baker's projection (x east, z south, metres around the centre), and MapWorld's offset
  data = mk();
  const DEG = Math.PI / 180, R = 6378137, lon = -84.39 + 315 / (DEG * R * Math.cos(33.75 * DEG)), lat = 33.75 - 15 / (DEG * R);
  res = applyBuildingDescriptors(data, { v: 1, buildings: [{ match: { at: [lon, lat] }, archetype: 'hotel-slab' }] });
  ok(res.matched === 1 && data.buildings[3].d, 'by a point inside the footprint ([lon, lat] through the city.json centre)');
  data = mk();
  for (const b of data.buildings) for (const p of b.p) { p[0] -= 1000; p[1] += 50; } // the map shifted so its spawn is the origin
  res = applyBuildingDescriptors(data, { v: 1, buildings: [{ match: { at: [lon, lat] }, archetype: 'hotel-slab' }] }, { offset: { x: 1000, z: -50 } });
  ok(res.matched === 1 && data.buildings[3].d, 'the same point after the map was shifted (offset)');
  const bb = new BuildingBuilder(REGION, {});
  ok(bb.footprint(data.buildings[3]) && bb.footprint({ ...mk().buildings[2], _dsup: 1 }) === null, 'a dropped part has no footprint (no geometry, no collider)');
}

// ---------------------------------------------------------------- the gate: undescribed buildings are unchanged
const TYPES = ['yes', 'office', 'apartments', 'hotel', 'parking', 'church', 'warehouse', 'house', 'retail', 'industrial', 'hospital', 'roof', 'commercial', 'university'];
function taggedSet() {
  const roofs = ['', '', 'gabled', 'hipped', 'pyramidal', 'dome', 'skillion', 'flat'], mats = ['', '', 'brick', 'glass', 'stone', 'concrete'];
  const names = ['', 'Grand Hotel', 'First Bank Tower', 'St Mary Church', 'City Parking', '', 'Memorial Hospital', 'Plaza Center'];
  const R = mulberry32(4242), list = [];
  for (let i = 0; i < 400; i++) {
    const x = (i % 20) * 60 - 600, z = Math.floor(i / 20) * 60 - 600, w = 8 + R() * 40, d = 8 + R() * 40;
    const b = { p: rect(x, z, w, d), h: 4 + R() ** 3 * 220, t: TYPES[Math.floor(R() * TYPES.length)] };
    const r0 = roofs[Math.floor(R() * roofs.length)]; if (r0) b.r = r0;
    const m0 = mats[Math.floor(R() * mats.length)]; if (m0) b.m = m0;
    const n0 = names[Math.floor(R() * names.length)]; if (n0) b.n = n0;
    if (R() < 0.3) b.lv = Math.max(1, Math.round(b.h / 3.5));
    if (R() < 0.1) b.c = '#a05030';
    if (R() < 0.1) b.mh = Math.min(b.h - 2, 4);
    if (R() < 0.1 && w > 20 && d > 20) b.hl = [[[x + 6, z + 6], [x + w - 6, z + 6], [x + w - 6, z + d - 6], [x + 6, z + d - 6]]];
    if (R() < 0.15) b.p = [[x, z], [x + w, z], [x + w, z + d * 0.5], [x + w * 0.5, z + d * 0.5], [x + w * 0.5, z + d], [x, z + d]];
    if (i % 50 === 49) b.lod = 1;
    list.push(b);
  }
  return list;
}
const OPTS = { baseGrid: [3, 3], detailGrid: [4, 4], lodDist: 300, detailFloors: 4, style: { storeProb: { prewar: 0.8 } } };
{
  const bb = new BuildingBuilder(REGION, OPTS);
  taggedSet().forEach((b, i) => bb.add(b, mulberry32(i * 7919 + 13)));
  const h = hashBuildingMeshes(group(bb));
  // Pinned at the commit before descriptors existed (7275d18): mesh, triangle and window counts of the generic builder
  // on this set. An intended change to the generic builder updates them (and says so in its commit).
  ok(h.meshes === 57 && h.tris === 113469 && bb.stats.windows === 11210 && bb.stats.baseTris === 39953 && bb.stats.nearTris === 72272 && bb.stats.detailed === 104 && bb.described === 0,
    'generic builder on the tagged set: counts as before descriptors', JSON.stringify({ ...h, ...bb.stats }));
  // The exact bytes, as measured on that commit with this script (V8's Math functions are the same code on every
  // platform; if a new Node changes one, this line alone fails: compare the counts above, then update the hash).
  ok(h.hash === '78a35041b948e6bcddc24774b8353fee969425a8', 'generic builder on the tagged set: bytes as before descriptors', h.hash);
  // The same buildings next to described ones, in separate builders that share nothing: the generic output of one
  // builder does not depend on what else the module built.
  const b2 = new BuildingBuilder(REGION, OPTS);
  b2.add({ p: rect(900, 900, 40, 40), h: 100, d: { archetype: 'stone-tower', crown: { type: 'dome' } } }, mulberry32(1));
  const b3 = new BuildingBuilder(REGION, OPTS);
  taggedSet().forEach((b, i) => b3.add(b, mulberry32(i * 7919 + 13)));
  ok(hashBuildingMeshes(group(b3)).hash === h.hash, 'generic output unchanged after described buildings were built');
}

// ---------------------------------------------------------------- described buildings build
function buildOne(d, o = {}) {
  const bb = new BuildingBuilder(REGION, { baseGrid: [1, 1], detailGrid: [1, 1], groundAt: o.groundAt || null });
  const b = { p: o.p || rect(-23, -19, 46, 38), h: o.h ?? 120, d, ...(o.b || {}) };
  const added = bb.add(b, mulberry32(o.seed ?? 77));
  const buf = bb.base[0], P = buf.pos;
  let bad = 0, top = -Infinity, bottom = Infinity;
  for (let k = 0; k < buf.n * 3; k++) { if (!Number.isFinite(P[k])) bad++; if (k % 3 === 1) { top = Math.max(top, P[k]); bottom = Math.min(bottom, P[k]); } }
  return { bb, added, tris: buf.tris, bad, top, bottom, hash: hashBuildingMeshes(group(bb)).hash, collider: bb.colliders[0] };
}
{
  const cases = [];
  for (const a of ARCHETYPES) cases.push([{ archetype: a }, /stadium|arena/.test(a) ? { p: Array.from({ length: 36 }, (_, i) => [Math.cos(-i / 36 * Math.PI * 2) * 110, Math.sin(-i / 36 * Math.PI * 2) * 90]), h: 45 } : /house|church|warehouse|parking/.test(a) ? { h: 16 } : {}]);
  for (const c of CROWN_TYPES) cases.push([{ archetype: 'stone-tower', height: 200, roofHeight: 160, crown: { type: c, lit: '#ffb030' } }, {}]);
  for (const c of CROWN_TYPES) cases.push([{ archetype: 'glass-tower', crown: { type: c } }, { p: [[0, 0], [50, 0], [50, 22], [25, 22], [25, 44], [0, 44]] }]);
  for (const p of PLANS) cases.push([{ archetype: 'glass-tower', massing: { plan: p, podium: { floors: 3 }, setbacks: [{ at: 0.7, inset: 0.2 }], taper: 0.2 }, night: { sign: { text: 'WESTIN & CO', color: '#ffffff' }, litFraction: 0.3 } }, {}]);
  for (const s of FACADE_SYSTEMS) for (const m of FACADE_MATERIALS) cases.push([{ archetype: 'precast-grid', facade: { system: s, material: m, color: '#8a5a44' } }, {}]);
  for (const g of GROUND_USES) cases.push([{ archetype: 'stone-tower', ground: { use: g, height: 8 } }, {}]);
  let maxTris = 0, sum = 0, fails = 0, same = 0;
  for (const [d, o] of cases) {
    let r;
    try { r = buildOne(d, o); } catch (e) { fails++; out('FAIL  build', JSON.stringify(d), String(e.stack).split('\n').slice(0, 3).join(' | ')); continue; }
    if (!r.added || r.bad || r.tris < 10) { fails++; out('FAIL  build', JSON.stringify(d), JSON.stringify({ added: r.added, bad: r.bad, tris: r.tris })); }
    if (buildOne(d, o).hash === r.hash) same++;
    maxTris = Math.max(maxTris, r.tris); sum += r.tris;
  }
  ok(fails === 0, `${cases.length} described buildings build (finite coordinates, some geometry)`, `${fails} failed`);
  ok(same === cases.length, `${cases.length} described buildings are deterministic (two builds, the same bytes)`, `${same} of ${cases.length}`);
  ok(maxTris <= 2600, 'the heaviest described building stays under 2600 triangles', String(maxTris));
  ok(sum / cases.length <= 420, 'described buildings average under 420 triangles', (sum / cases.length).toFixed(0));
  out(`      ${cases.length} described buildings: mean ${(sum / cases.length).toFixed(0)} triangles, heaviest ${maxTris}`);

  // heights: the descriptor's architectural top, the collider at the roof
  const t = buildOne({ archetype: 'stone-tower', height: 312, roofHeight: 264, crown: { type: 'pyramid-spire' } }, { h: 150 });
  ok(Math.abs(t.top - 312) < 0.6 && t.collider[3] === 264 && t.bottom === 0, 'a spire ends at the architectural height; the collider at the roof height', JSON.stringify({ top: t.top, collider: t.collider[3], bottom: t.bottom }));
  const g = buildOne({ archetype: 'glass-tower' }, { groundAt: (x, z) => 5 + 0.05 * x });
  ok(Math.abs(g.bottom - (5 - 0.05 * 23 - 1)) < 1e-3, 'on a slope the building stands on its lowest outline point, the walls 1 m below it', String(g.bottom));
  // plan override: the outline becomes the plan (colliders too); under a podium the OSM outline stays
  const cyl = buildOne({ archetype: 'cylinder-tower', massing: { plan: 'cylinder', width: 30 } });
  ok(cyl.collider[0].length >= 16 && Math.abs(Math.hypot(cyl.collider[0][0][0], cyl.collider[0][0][1]) - 15) < 0.01, 'a cylinder plan replaces the outline: a 16+-gon of the given width');
  const pod = buildOne({ archetype: 'cylinder-tower', massing: { plan: 'cylinder', width: 30, podium: { floors: 4 } } });
  ok(pod.collider[0].length === 4, 'under a podium the OSM outline stays the collider');
  ok(planRing(rect(0, 0, 60, 30), { plan: 'square', planW: null }, 1800).length === 4 && planRing(rect(0, 0, 60, 30), { plan: 'octagon', planW: null }, 1800).length === 8, 'plan rings: square, octagon');
  // a raised part starts at its min height; a lit crown and a sign add geometry
  const raised = buildOne({ archetype: 'glass-tower' }, { b: { mh: 30 } });
  ok(Math.abs(raised.bottom - 30) < 1e-6, 'a raised part starts at its min height', String(raised.bottom));
  ok(buildOne({ archetype: 'hotel-slab', night: { sign: { text: 'HYATT' } } }).tris > buildOne({ archetype: 'hotel-slab' }).tris + 80, 'a sign is real letters: one quad per run of lit pixels, on two faces');
}

// ---------------------------------------------------------------- inference
{
  const fpOf = (b) => new BuildingBuilder(REGION, {}).footprint(b);
  const inf = (b) => { const d = inferDescriptor(b, fpOf(b)); return d ? d.archetype : null; };
  const big = rect(0, 0, 60, 50), small = rect(0, 0, 12, 10), slim = rect(0, 0, 40, 40);
  ok(inf({ p: big, h: 20, t: 'parking' }) === 'parking-deck' && inf({ p: big, h: 20, t: 'yes', n: 'Courtland Street Parking Deck' }) === 'parking-deck', 'parking by type and by name');
  ok(inf({ p: rect(0, 0, 20, 40), h: 30, t: 'church' }) === 'church' && inf({ p: rect(0, 0, 20, 40), h: 30, t: 'yes', n: 'First Baptist Church' }) === 'church', 'church by type and by name');
  ok(inf({ p: big, h: 80, t: 'hotel' }) === 'hotel-slab' && inferDescriptor({ p: big, h: 80, t: 'yes', n: 'Hilton Atlanta' }, fpOf({ p: big, h: 80 })).night.sign.text === 'HILTON', 'hotel by type; a known name gets its sign');
  ok(inf({ p: big, h: 40, t: 'hospital' }) === 'precast-grid' && inf({ p: big, h: 30, t: 'yes', n: 'Fulton County Courthouse' }) === 'civic-classical', 'hospital, civic');
  ok(inferDescriptor({ p: big, h: 40, n: 'Georgia State Capitol' }, fpOf({ p: big, h: 40 })).crown.type === 'dome', 'a capitol gets a dome');
  ok(inf({ p: rect(0, 0, 200, 180), h: 50, t: 'stadium' }) === 'stadium' && inf({ p: rect(0, 0, 100, 90), h: 30, n: 'State Farm Arena' }) === 'arena', 'stadium, arena');
  ok(inf({ p: big, h: 10, t: 'warehouse' }) === 'warehouse' && inf({ p: small, h: 7, t: 'house' }) === 'house', 'warehouse, house');
  ok(/tower|setback/.test(inf({ p: slim, h: 150, t: 'office' })) && inf({ p: slim, h: 30, t: 'office' }) === null && inf({ p: slim, h: 30, t: 'apartments' }) === null, 'a tall slim footprint is a tower; mid-rise street buildings stay with the generic builder');
  ok(inf({ p: slim, h: 150, t: 'office', part: 1 }) === null && inf({ p: slim, h: 150, t: 'office', mh: 20 }) === null && inf({ p: slim, h: 150, t: 'office', r: 'pyramidal' }) === null, 'never for OSM parts, raised parts or tagged roof shapes');
  const a = JSON.stringify(inferDescriptor({ p: slim, h: 150, t: 'office', n: 'First National Bank Building' }, fpOf({ p: slim, h: 150 })));
  ok(a === JSON.stringify(inferDescriptor({ p: slim, h: 150, t: 'office', n: 'First National Bank Building' }, fpOf({ p: slim, h: 150 }))), 'inference is deterministic');
  // through the builder: infer off = the generic builder; on = described, and a house gets a pitched roof
  const set = taggedSet();
  const on = new BuildingBuilder(REGION, { ...OPTS, infer: true });
  set.forEach((b, i) => on.add(b, mulberry32(i * 7919 + 13)));
  ok(on.described > 20 && on.count === 400, 'infer: true describes a share of the tagged set', `${on.described} of ${on.count}`);
  const house = { p: rect(0, 0, 11, 9), h: 6.5, t: 'house' };
  const flat = new BuildingBuilder(REGION, { baseGrid: [1, 1] }), pitched = new BuildingBuilder(REGION, { baseGrid: [1, 1], infer: true });
  flat.add({ ...house }, mulberry32(5)); pitched.add({ ...house }, mulberry32(5));
  const topOf = (bb) => { let t = -Infinity; for (let k = 1; k < bb.base[0].n * 3; k += 3) t = Math.max(t, bb.base[0].pos[k]); return t; };
  ok(topOf(flat) < 7.2 && Math.abs(topOf(pitched) - 6.5) < 0.2 && pitched.base[0].tris !== flat.base[0].tris, 'an inferred house keeps the generic builder and gets a pitched roof');
}

// ---------------------------------------------------------------- MapWorld
{
  const probe = generateProceduralCity(1337), tall = probe.buildings.reduce((a, b) => (b.h > a.h ? b : a));
  const cx = (tall.p[0][0] + tall.p[2][0]) / 2, cz = (tall.p[0][1] + tall.p[2][1]) / 2;
  const landmarks = { v: 1, city: 'procedural', buildings: [
    { match: { xz: [cx, cz] }, name: 'Tallest', archetype: 'stone-tower', height: 300, roofHeight: 250, crown: { type: 'pyramid-spire', material: 'gold', lit: '#ffb030' }, night: { sign: { text: 'TALLEST' } } },
    { match: { name: 'Not In This City' }, archetype: 'church' },
  ] };
  const load = async (buildings) => { const w = new MapWorld({ scene: new THREE.Scene(), renderer: null, forceProcedural: true, traffic: false, streaming: false, buildings }); await w.load(() => {}); return w; };
  const plain = await load(undefined), world = await load({ landmarks, infer: true });
  ok(plain.landmarks === null && hashBuildingMeshes(plain.group).hash === '1903c59857cecbd3e45a4ba48aef5d02674592a5', 'MapWorld without landmarks: the procedural city\'s buildings, bytes as before descriptors', hashBuildingMeshes(plain.group).hash);
  ok(world.landmarks.matched === 1 && world.landmarks.unmatched.length === 1 && world.landmarks.unmatched[0] === 'Not In This City', 'MapWorld: landmarks matched in the shifted map, the missing one reported', JSON.stringify(world.landmarks));
  ok(world.stats.buildings === plain.stats.buildings && world.buildingSamples.filter((s) => s.described).length > 10, 'MapWorld: the same buildings, a share of them described (the landmark and inferred ones)');
  let top = 0;
  world.group.traverse((m) => { if (m.isMesh && /^buildings/.test(m.name)) { m.geometry.computeBoundingBox(); top = Math.max(top, m.geometry.boundingBox.max.y + m.position.y); } });
  ok(Math.abs(top - 300) < 1.5 && world.maxBuildingHeight >= 300, 'MapWorld: the landmark\'s spire is the tallest thing in the city, and the shadow range knows it', `${top.toFixed(1)} ${world.maxBuildingHeight}`);
  let boxes = 0; for (const b of world.queryColliders(cx - world.offset.x, cz - world.offset.z, 5)) boxes++;
  ok(boxes > 0, 'MapWorld: the described building has colliders');
  await ok(await (async () => { try { await load({ landmarks: { v: 1, buildings: [{ match: { name: 'x' }, bogus: 1 }] } }); return false; } catch (e) { return /unknown field 'bogus'/.test(String(e.message)); } })(), 'MapWorld: a schema error in the landmarks rejects load()');
}

out(failures ? `\n${failures} of ${checks} building descriptor check(s) FAILED` : `All ${checks} building descriptor checks passed.`);
process.exit(failures ? 1 : 0);
