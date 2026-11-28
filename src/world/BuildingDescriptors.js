// Building descriptors: what a building IS, as data, so a city does not leave its landmarks to the seeded style pick.
//
// A city ships a sidecar `landmarks.json` next to its `city.json`:
//   { "v": 1, "city": "atlanta", "buildings": [ {
//     "match": { "name": "Bank of America Plaza", "osm": "way/123", "at": [lon, lat], "xz": [x, z] },  // any of
//     "name": "...", "year": 1992, "floors": 55, "height": 312, "roofHeight": 264,   // metres; height = architectural top
//     "archetype": "glass-tower",                                                      // ARCHETYPES: the defaults below
//     "massing": { "plan": "footprint", "width": 50, "depth": 50, "podium": { "floors": 3, "height": 14, "inset": 0.15 },
//                  "setbacks": [ { "at": 0.8, "inset": 0.15 } ], "taper": 0 },
//     "facade": { "system": "piers", "material": "granite", "color": "#8a5a44", "glass": "#2b3a45", "glassReflect": 0.6,
//                 "vertical": 0.7, "bay": 1.5, "floorHeight": 3.9 },
//     "crown": { "type": "pyramid-spire", "height": 48, "material": "gold", "color": "#d8b060", "lit": "#ffb030" },
//     "ground": { "use": "lobby", "height": 8 },
//     "night": { "crownLight": "#ffa040", "sign": { "text": "WESTIN", "color": "#ffffff" }, "litFraction": 0.3 },
//     "notes": "...", "confidence": "high" } ] }
// Every field but `match` is optional: an archetype fills what the descriptor leaves out. Unknown field names and
// unknown enum values throw and list the valid ones (validateLandmarks).
//
// API
//   validateLandmarks(file) -> file                 throws on a schema error
//   resolveDescriptor(d) -> resolved                archetype defaults merged, colours parsed; idempotent
//   applyBuildingDescriptors(data, file, { offset }) -> { matched, suppressed, unmatched: [name] }
//       matches every descriptor to a city.json building and sets `building.d` (the resolved descriptor), which
//       BuildingBuilder honours. Matching, first hit wins: `osm` against the building's `id` (when the bake keeps
//       it), `at` [lon, lat] / `xz` [x, z] (bake frame, metres) inside a footprint, `name` (case and punctuation
//       ignored). Of several candidates (OSM building parts) the largest footprint at least half as tall as the
//       tallest candidate takes the descriptor; parts that stand inside it are dropped (`_dsup`), a wider podium
//       footprint around it stays a generic building.
//   inferDescriptor(b, fp) -> resolved | null       opt-in (BuildingBuilder `infer`): a descriptor deduced from the
//       OSM tags (type, name keywords, height, footprint): parking decks, churches, hotels, hospitals, civic
//       buildings, stadiums / arenas, warehouses, tall slim towers, houses. Deterministic (a hash of the footprint).
//   ARCHETYPES, PLANS, FACADE_SYSTEMS, FACADE_MATERIALS, CROWN_TYPES, CROWN_MATERIALS, GROUND_USES   the enums
//   signRuns(text) -> { w, runs: [[col0, col1, row]] }   a sign's lettering as runs of lit 5 x 7 pixels (row 0 on top)
import { signedArea, centroid, pointInRing, ringBounds, hashStr } from './geom.js';

export const ARCHETYPES = ['glass-tower', 'stone-tower', 'precast-grid', 'brick-loft', 'artdeco-setback', 'brutalist', 'hotel-slab', 'cylinder-tower', 'civic-classical', 'stadium', 'arena', 'parking-deck', 'church', 'warehouse', 'house'];
export const PLANS = ['footprint', 'square', 'rect', 'cylinder', 'octagon'];
export const FACADE_SYSTEMS = ['curtain-wall', 'punched', 'ribbon', 'piers'];
export const FACADE_MATERIALS = ['granite', 'glass', 'brick', 'precast', 'limestone', 'marble', 'metal', 'concrete', 'stucco'];
export const CROWN_TYPES = ['pyramid-spire', 'stepped', 'flat', 'cylinder', 'dome', 'mansard', 'open-lattice', 'antenna'];
export const CROWN_MATERIALS = ['gold', 'copper', 'steel', 'stone', 'glass', 'concrete'];
export const GROUND_USES = ['lobby', 'retail', 'arcade', 'plaza'];
const CONFIDENCE = ['high', 'medium', 'low'];

// ------------------------------------------------------------------ schema
const KEYS = {
  file: ['v', 'city', 'buildings', 'source', 'notes'],
  building: ['match', 'name', 'year', 'floors', 'height', 'roofHeight', 'archetype', 'massing', 'facade', 'crown', 'ground', 'night', 'notes', 'confidence'],
  match: ['name', 'osm', 'at', 'xz'],
  massing: ['plan', 'width', 'depth', 'podium', 'setbacks', 'taper'],
  podium: ['floors', 'height', 'inset'],
  setback: ['at', 'inset'],
  facade: ['system', 'material', 'color', 'glass', 'glassReflect', 'vertical', 'bay', 'floorHeight'],
  crown: ['type', 'height', 'material', 'color', 'lit'],
  ground: ['use', 'height'],
  night: ['crownLight', 'sign', 'litFraction'],
  sign: ['text', 'color'],
};
function keys(o, kind, where) {
  if (o == null) return;
  if (typeof o !== 'object' || Array.isArray(o)) throw new Error(`[landmarks] ${where}: expected an object`);
  for (const k in o) if (!KEYS[kind].includes(k)) throw new Error(`[landmarks] ${where}: unknown field '${k}' (${KEYS[kind].join(', ')})`);
}
function oneOf(v, list, where) { if (v != null && !list.includes(v)) throw new Error(`[landmarks] ${where}: unknown value '${v}' (${list.join(', ')})`); }
function num(v, where, lo = -Infinity, hi = Infinity) {
  if (v == null) return;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new Error(`[landmarks] ${where}: expected a number${Number.isFinite(lo) ? ` in ${lo} .. ${hi}` : ''}, got ${JSON.stringify(v)}`);
}
/** '#rgb' / '#rrggbb' -> [r, g, b] sRGB 0..1; null when absent; throws on anything else. */
export function parseHex(s, where = 'colour') {
  if (s == null) return null;
  if (Array.isArray(s) && s.length === 3 && s.every((v) => typeof v === 'number')) return s; // already parsed (a resolved descriptor)
  const m = typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) throw new Error(`[landmarks] ${where}: expected a colour '#rrggbb', got ${JSON.stringify(s)}`);
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
function point(v, where) { if (v != null && !(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))) throw new Error(`[landmarks] ${where}: expected [a, b] numbers`); }

/** Check one raw descriptor (field names, enums, ranges). `where` names it in the error. */
export function validateDescriptor(d, where = 'descriptor') {
  keys(d, 'building', where);
  keys(d.match, 'match', `${where}.match`);
  if (d.match) { point(d.match.at, `${where}.match.at`); point(d.match.xz, `${where}.match.xz`); }
  oneOf(d.archetype, ARCHETYPES, `${where}.archetype`);
  oneOf(d.confidence, CONFIDENCE, `${where}.confidence`);
  num(d.floors, `${where}.floors`, 1, 250); num(d.height, `${where}.height`, 2, 1000); num(d.roofHeight, `${where}.roofHeight`, 2, 1000);
  const m = d.massing;
  keys(m, 'massing', `${where}.massing`);
  if (m) {
    oneOf(m.plan, PLANS, `${where}.massing.plan`);
    num(m.width, `${where}.massing.width`, 2, 600); num(m.depth, `${where}.massing.depth`, 2, 600); num(m.taper, `${where}.massing.taper`, -0.3, 0.9);
    keys(m.podium, 'podium', `${where}.massing.podium`);
    if (m.podium) { num(m.podium.floors, `${where}.massing.podium.floors`, 1, 40); num(m.podium.height, `${where}.massing.podium.height`, 2, 200); num(m.podium.inset, `${where}.massing.podium.inset`, 0, 0.6); }
    if (m.setbacks != null) {
      if (!Array.isArray(m.setbacks)) throw new Error(`[landmarks] ${where}.massing.setbacks: expected an array`);
      m.setbacks.forEach((s, i) => { keys(s, 'setback', `${where}.massing.setbacks[${i}]`); num(s.at, `${where}.massing.setbacks[${i}].at`, 0.02, 0.98); num(s.inset, `${where}.massing.setbacks[${i}].inset`, 0, 0.6); });
    }
  }
  const f = d.facade;
  keys(f, 'facade', `${where}.facade`);
  if (f) {
    oneOf(f.system, FACADE_SYSTEMS, `${where}.facade.system`); oneOf(f.material, FACADE_MATERIALS, `${where}.facade.material`);
    parseHex(f.color, `${where}.facade.color`); parseHex(f.glass, `${where}.facade.glass`);
    num(f.glassReflect, `${where}.facade.glassReflect`, 0, 1); num(f.vertical, `${where}.facade.vertical`, 0, 1);
    num(f.bay, `${where}.facade.bay`, 0.6, 20); num(f.floorHeight, `${where}.facade.floorHeight`, 2.4, 40);
  }
  const c = d.crown;
  keys(c, 'crown', `${where}.crown`);
  if (c) { oneOf(c.type, CROWN_TYPES, `${where}.crown.type`); oneOf(c.material, CROWN_MATERIALS, `${where}.crown.material`); num(c.height, `${where}.crown.height`, 0, 300); parseHex(c.color, `${where}.crown.color`); parseHex(c.lit, `${where}.crown.lit`); }
  keys(d.ground, 'ground', `${where}.ground`);
  if (d.ground) { oneOf(d.ground.use, GROUND_USES, `${where}.ground.use`); num(d.ground.height, `${where}.ground.height`, 2.5, 30); }
  const n = d.night;
  keys(n, 'night', `${where}.night`);
  if (n) {
    parseHex(n.crownLight, `${where}.night.crownLight`); num(n.litFraction, `${where}.night.litFraction`, 0, 1);
    keys(n.sign, 'sign', `${where}.night.sign`);
    if (n.sign) { if (typeof n.sign.text !== 'string' || !n.sign.text.trim()) throw new Error(`[landmarks] ${where}.night.sign.text: expected a string`); parseHex(n.sign.color, `${where}.night.sign.color`); }
  }
  return d;
}

/** Check a landmarks.json (field names, enums, ranges); returns it. Throws with the valid names on an unknown one. */
export function validateLandmarks(file) {
  keys(file, 'file', 'landmarks.json');
  if (!file || !Array.isArray(file.buildings)) throw new Error('[landmarks] landmarks.json: expected { v, city, buildings: [...] }');
  if (file.v != null && file.v !== 1) throw new Error(`[landmarks] landmarks.json: unknown version ${file.v} (1)`);
  file.buildings.forEach((d, i) => {
    const where = `buildings[${i}]${d && (d.name || (d.match && d.match.name)) ? ` (${d.name || d.match.name})` : ''}`;
    validateDescriptor(d, where);
    const m = d.match;
    if (!m || (m.name == null && m.osm == null && m.at == null && m.xz == null)) throw new Error(`[landmarks] ${where}: match needs one of ${KEYS.match.join(', ')}`);
  });
  return file;
}

// ------------------------------------------------------------------ archetypes
// What each archetype stands for; a descriptor's own fields win. `form` picks the builder in BuildingForms.js.
const A = {
  'glass-tower': { facade: { system: 'curtain-wall', material: 'glass', glass: '#3d5468', glassReflect: 0.6, vertical: 0.3, bay: 1.5, floorHeight: 3.9 }, crown: { type: 'flat' }, ground: { use: 'lobby' } },
  'stone-tower': { facade: { system: 'piers', material: 'granite', color: '#b4a595', glass: '#27323a', glassReflect: 0.35, vertical: 0.8, bay: 3, floorHeight: 3.9 }, crown: { type: 'flat' }, ground: { use: 'lobby' } },
  'precast-grid': { facade: { system: 'punched', material: 'precast', color: '#c9c3b6', glass: '#2a3238', glassReflect: 0.3, vertical: 0.5, bay: 3.2, floorHeight: 3.7 }, crown: { type: 'flat' }, ground: { use: 'lobby' } },
  'brick-loft': { facade: { system: 'punched', material: 'brick', color: '#8c4c3c', glass: '#30363a', glassReflect: 0.25, vertical: 0.6, bay: 3.6, floorHeight: 4.2 }, crown: { type: 'flat' }, ground: { use: 'retail' } },
  'artdeco-setback': { facade: { system: 'piers', material: 'limestone', color: '#d2c7b0', glass: '#2c3338', glassReflect: 0.3, vertical: 0.95, bay: 2.6, floorHeight: 3.7 }, massing: { setbacks: [{ at: 0.62, inset: 0.14 }, { at: 0.82, inset: 0.2 }] }, crown: { type: 'stepped' }, ground: { use: 'lobby' } },
  brutalist: { facade: { system: 'punched', material: 'concrete', color: '#a09a90', glass: '#22282c', glassReflect: 0.2, vertical: 0.45, bay: 3.8, floorHeight: 3.8 }, crown: { type: 'flat' }, ground: { use: 'arcade' } },
  'hotel-slab': { facade: { system: 'punched', material: 'precast', color: '#d6cfc0', glass: '#2a3440', glassReflect: 0.35, vertical: 0.4, bay: 3.9, floorHeight: 3.1 }, crown: { type: 'flat' }, ground: { use: 'lobby' }, night: { litFraction: 0.42 } },
  'cylinder-tower': { massing: { plan: 'cylinder' }, facade: { system: 'curtain-wall', material: 'glass', glass: '#2e3c48', glassReflect: 0.8, vertical: 0.2, bay: 1.6, floorHeight: 3.6 }, crown: { type: 'cylinder' }, ground: { use: 'lobby' } },
  'civic-classical': { facade: { system: 'piers', material: 'limestone', color: '#dcd5c3', glass: '#252b30', glassReflect: 0.25, vertical: 1, bay: 3.6, floorHeight: 4.8 }, crown: { type: 'flat' }, ground: { use: 'arcade' } },
  stadium: { form: 'stadium', facade: { system: 'piers', material: 'concrete', color: '#b9b5ac', glass: '#28323a', glassReflect: 0.4, vertical: 0.45, bay: 8, floorHeight: 7 }, crown: { type: 'flat' }, ground: { use: 'plaza' } },
  arena: { form: 'arena', facade: { system: 'curtain-wall', material: 'glass', glass: '#34485a', glassReflect: 0.5, vertical: 0.4, bay: 2.4, floorHeight: 5 }, crown: { type: 'dome', material: 'steel' }, ground: { use: 'plaza' } },
  'parking-deck': { form: 'parking', facade: { system: 'ribbon', material: 'concrete', color: '#b3afa6', vertical: 0.1, bay: 8, floorHeight: 3.2 }, crown: { type: 'flat' } },
  church: { form: 'church', facade: { system: 'piers', material: 'limestone', color: '#b9ab95', glass: '#2a2630', glassReflect: 0.2, vertical: 1, bay: 4.2 }, crown: { type: 'pyramid-spire', material: 'copper' } },
  warehouse: { form: 'warehouse', facade: { system: 'ribbon', material: 'metal', color: '#a9aaa6', glass: '#2c3438', glassReflect: 0.2, vertical: 0.2, bay: 6 }, crown: { type: 'flat' } },
  house: { form: 'house' },
};
const DEFAULT_ARCHETYPE = 'precast-grid';
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * A descriptor with its archetype's defaults merged and colours parsed (what BuildingBuilder reads). Idempotent: a
 * resolved descriptor is returned as it is. Validates the raw descriptor first.
 * @param {object} d  raw descriptor (see the header)
 * @returns {object} resolved: { name, archetype, form, height, roofHeight, floors, plan, planW, planD, podium, setbacks,
 *   taper, system, material, color, glass, glassReflect, vertical, bay, floorHeight, crown: { type, height, material,
 *   color, lit }, ground: { use, height }, night: { crownLight, sign: { text, color }, litFraction } }; colours are
 *   [r, g, b] sRGB 0..1 or null
 */
export function resolveDescriptor(d) {
  if (!d) return null;
  if (d._r) return d;
  validateDescriptor(d);
  const arch = d.archetype || DEFAULT_ARCHETYPE, P = A[arch];
  const m = { ...(P.massing || {}), ...(d.massing || {}) }, f = { ...(P.facade || {}), ...(d.facade || {}) };
  const c = { ...(P.crown || {}), ...(d.crown || {}) }, g = { ...(P.ground || {}), ...(d.ground || {}) }, n = { ...(P.night || {}), ...(d.night || {}) };
  const system = f.system || 'punched';
  // an all-glass material on a masonry system (or the reverse) follows the system: the wall between the windows is glass
  const material = f.material || (system === 'curtain-wall' ? 'glass' : 'precast');
  return {
    _r: true, name: d.name || (d.match && d.match.name) || '', archetype: arch, form: P.form || 'tiers',
    height: d.height ?? null, roofHeight: d.roofHeight ?? null, floors: d.floors ?? null,
    plan: m.plan || 'footprint', planW: m.width ?? null, planD: m.depth ?? null,
    podium: m.podium ? { floors: m.podium.floors ?? null, height: m.podium.height ?? null, inset: m.podium.inset ?? 0.18 } : null,
    setbacks: (m.setbacks || []).map((s) => ({ at: s.at ?? 0.8, inset: s.inset ?? 0.15 })).sort((a, b) => a.at - b.at),
    taper: m.taper || 0,
    system, material, color: parseHex(f.color), glass: parseHex(f.glass) || [0.17, 0.21, 0.25], glassReflect: clamp01(f.glassReflect ?? 0.4),
    vertical: clamp01(f.vertical ?? 0.5), bay: f.bay ?? null, floorHeight: f.floorHeight ?? null,
    crown: { type: c.type || 'flat', height: c.height ?? null, material: c.material || null, color: parseHex(c.color), lit: parseHex(c.lit) },
    ground: { use: g.use || null, height: g.height ?? null },
    night: { crownLight: parseHex(n.crownLight), sign: n.sign ? { text: String(n.sign.text).toUpperCase().trim().slice(0, 24), color: parseHex(n.sign.color) || [1, 1, 1] } : null, litFraction: n.litFraction ?? null },
  };
}

/** Roof height (top of the main mass, m) a resolved descriptor asks for, given the OSM height; the crown stands on it. */
export function describedRoofHeight(d, osmH) {
  if (d.roofHeight != null) return d.roofHeight;
  const flat = d.crown.type === 'flat' || d.crown.type === 'antenna';
  if (d.height != null) return flat ? d.height : Math.max(d.height * 0.5, d.height - (d.crown.height ?? d.height * 0.14));
  if (d.floors != null && d.floorHeight != null) return d.floors * d.floorHeight;
  return osmH;
}

// ------------------------------------------------------------------ matching
const R_EARTH = 6378137, DEG = Math.PI / 180;
const normName = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(the)\b/g, ' ').replace(/\s+/g, ' ').trim();
const normOsm = (s) => { const m = /^(?:(way|relation|node|w|r|n)[/:\s]*)?(\d+)$/i.exec(String(s).trim()); return m ? (m[1] ? m[1][0].toLowerCase() : 'w') + m[2] : String(s).trim().toLowerCase(); };

/**
 * Match the descriptors of a landmarks.json to the buildings of a city.json and attach them (`building.d`).
 * @param {{ buildings: object[], center?: { lat: number, lon: number } }} data  city.json (its buildings in the frame
 *   `offset` describes: bake = data + offset; MapWorld passes its own after prepareMapData)
 * @param {object} file  landmarks.json (validated here)
 * @param {{ offset?: { x: number, z: number } }} [o]
 * @returns {{ matched: number, suppressed: number, unmatched: string[] }}
 */
export function applyBuildingDescriptors(data, file, o = {}) {
  validateLandmarks(file);
  const off = o.offset || { x: 0, z: 0 }, list = data.buildings || [], C = data.center || null;
  const cos0 = C ? Math.cos(C.lat * DEG) : 1;
  const info = new Array(list.length); // lazily: { bb, area, c, h }
  const inf = (i) => {
    if (info[i] !== undefined) return info[i];
    const b = list[i];
    if (!b || !Array.isArray(b.p) || b.p.length < 3 || b._lm) return (info[i] = null);
    return (info[i] = { bb: ringBounds(b.p), area: Math.abs(signedArea(b.p)), c: centroid(b.p), h: Number(b.h) > 0 ? Number(b.h) : 10 });
  };
  const byName = new Map(), byId = new Map();
  list.forEach((b, i) => {
    if (!b) return;
    if (b.n) { const k = normName(b.n); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(i); }
    if (b.id != null) byId.set(normOsm(b.id), i);
  });
  const containing = (x, z) => {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const q = inf(i);
      if (q && x >= q.bb.minX && x <= q.bb.maxX && z >= q.bb.minZ && z <= q.bb.maxZ && pointInRing(x, z, list[i].p)) out.push(i);
    }
    return out;
  };
  // of several candidates (parts of one building): the widest one that is at least half as tall as the tallest
  const primary = (ids) => {
    let maxH = 0; for (const i of ids) maxH = Math.max(maxH, inf(i).h);
    let best = -1;
    for (const i of ids) if (inf(i).h >= 0.5 * maxH && (best < 0 || inf(i).area > inf(best).area)) best = i;
    return best;
  };
  const res = { matched: 0, suppressed: 0, unmatched: [] };
  for (const raw of file.buildings) {
    const m = raw.match, label = raw.name || m.name || JSON.stringify(m);
    let ids = [];
    if (m.osm != null && byId.has(normOsm(m.osm))) ids = [byId.get(normOsm(m.osm))];
    if (!ids.length && (m.xz || (m.at && C))) {
      const x = m.xz ? m.xz[0] - off.x : (m.at[0] - C.lon) * DEG * R_EARTH * cos0 - off.x;
      const z = m.xz ? m.xz[1] - off.z : -(m.at[1] - C.lat) * DEG * R_EARTH - off.z;
      ids = containing(x, z);
      if (ids.length > 1 && m.name) { const k = normName(m.name), named = ids.filter((i) => normName(list[i].n) === k); if (named.length) ids = named; }
    }
    if (!ids.length && m.name) ids = (byName.get(normName(m.name)) || []).filter((i) => inf(i));
    ids = ids.filter((i) => inf(i) && !list[i].d);
    if (!ids.length) { res.unmatched.push(label); continue; }
    const pi = primary(ids), P = list[pi], Q = inf(pi), key = P.n ? normName(P.n) : null;
    P.d = resolveDescriptor(raw);
    res.matched++;
    // the parts that stand inside the described footprint are its massing in OSM's words: the descriptor replaces them
    for (let i = 0; i < list.length; i++) {
      if (i === pi) continue;
      const q = inf(i), b = list[i];
      if (!q || b.d || b._dsup || !(b.part || (key && b.n && normName(b.n) === key))) continue;
      if (q.c[0] < Q.bb.minX || q.c[0] > Q.bb.maxX || q.c[1] < Q.bb.minZ || q.c[1] > Q.bb.maxZ) continue;
      if (q.area <= 1.2 * Q.area && pointInRing(q.c[0], q.c[1], P.p)) { b._dsup = 1; res.suppressed++; }
    }
  }
  return res;
}

// ------------------------------------------------------------------ inference
const RE = {
  parking: /\b(parking|car ?park|parkade|garage|deck)\b/i,
  church: /\b(church|cathedral|chapel|basilica|baptist|methodist|presbyterian|episcopal|lutheran|synagogue|mosque|tabernacle|shrine|temple)\b/i,
  hotel: /\b(hotel|inn|suites|marriott|hilton|hyatt|westin|sheraton|ritz|omni|radisson|ramada|courtyard|doubletree|embassy|loews|motel|lodge)\b/i,
  brand: /\b(marriott|hilton|hyatt|westin|sheraton|omni|radisson|ramada|loews|ritz|doubletree)\b/i,
  hospital: /\b(hospital|medical|clinic|infirmary)\b/i,
  civic: /\b(capitol|city hall|court ?house|courthouse|town hall|museum|library|federal|post office|archives)\b/i,
  stadium: /\b(stadium|ballpark|speedway)\b/i,
  arena: /\b(arena|coliseum|colosseum|dome|forum|fieldhouse)\b/i,
  stone: /\b(bank|trust|federal|building|exchange|court|life|equitable|insurance)\b/i,
};
const T = {
  parking: /^(parking|garage|garages|carport)$/, church: /^(church|cathedral|chapel|synagogue|mosque|temple|religious|shrine)$/,
  hotel: /^(hotel|motel)$/, hospital: /^(hospital)$/, civic: /^(government|courthouse|townhall|civic|museum|library|public)$/,
  stadium: /^(stadium|grandstand)$/, arena: /^(sports_hall|sports_centre|arena)$/,
  warehouse: /^(warehouse|industrial|hangar|manufacture|storage|depot)$/,
  house: /^(house|detached|semidetached_house|residential|terrace|bungalow|cabin)$/,
};
const osmColour = (s) => { try { return typeof s === 'string' && /^#/.test(s) ? parseHex(s) && s : null; } catch { return null; } };

/**
 * A descriptor deduced from what OSM gives for a building without one (opt-in: BuildingBuilder `infer`). Returns null
 * where the generic builder does as well or better (mid-rise street buildings with real openings and shop fronts,
 * tagged roof shapes, raised parts, small sheds). Deterministic: the choices hash the footprint's centroid and name.
 * @param {object} b  city.json building ({ p, h, t?, n?, m?, c?, r?, lv?, mh?, lod?, water? })
 * @param {{ outer: number[][], holes: number[][][], h: number, mh: number, area: number, c: number[] }} fp  BuildingBuilder.footprint(b)
 * @returns {object|null} resolved descriptor
 */
export function inferDescriptor(b, fp) {
  if (!fp || b.water || b.part || fp.mh > 0.5 || fp.area < 60) return null; // OSM parts are a massing of their own
  const t = String(b.t || 'yes'), name = String(b.n || ''), h = fp.h, area = fp.area, side = Math.sqrt(area);
  const mat = String(b.m || '').toLowerCase(), col = osmColour(b.c);
  const r0 = hashStr(`${name}|${Math.round(fp.c[0] * 2)}|${Math.round(fp.c[1] * 2)}`), r1 = (r0 * 7.919) % 1, r2 = (r0 * 31.337) % 1, r3 = (r0 * 113.17) % 1;
  const facade = (o) => { const f = { ...o }; if (col) f.color = col; return f; };
  let d = null;
  if (T.house.test(t) && area < 420 && h < 12.5 && !b.lod) {
    return b.r ? null : resolveDescriptor({ archetype: 'house' });
  }
  if (b.r && b.r !== 'flat') return null; // a tagged roof shape: the generic builder models it
  if ((T.parking.test(t) || (RE.parking.test(name) && !/\b(office|tower|hotel)\b/i.test(name))) && h <= 45 && area > 400) {
    d = { archetype: 'parking-deck', facade: facade({}) };
  } else if ((T.church.test(t) || RE.church.test(name)) && area > 150 && area < 9000 && h < 80 && !b.lod) {
    const stone = /brick/.test(mat) ? { material: 'brick', color: '#8a4d3c' } : r1 < 0.45 ? { material: 'brick', color: '#8f5340' } : r1 < 0.8 ? { material: 'limestone', color: '#b9ab95' } : { material: 'granite', color: '#8f8a84' };
    d = { archetype: 'church', facade: facade(stone), crown: { type: 'pyramid-spire', material: r2 < 0.5 ? 'copper' : 'stone' } };
  } else if ((T.stadium.test(t) || RE.stadium.test(name)) && area > 9000) {
    d = { archetype: 'stadium', facade: facade({}) };
  } else if ((T.arena.test(t) || RE.arena.test(name)) && area > 4000 && h < 70) {
    d = { archetype: 'arena', facade: facade({}) };
  } else if ((T.hotel.test(t) || RE.hotel.test(name)) && h >= 14) {
    const brand = RE.brand.exec(name), tall = h >= 60;
    d = {
      archetype: 'hotel-slab',
      facade: facade(tall && r1 < 0.4 ? { system: 'curtain-wall', material: 'glass', glass: r2 < 0.5 ? '#35485a' : '#4a4338', glassReflect: 0.6, bay: 1.9 } : { color: ['#d6cfc0', '#c9bda8', '#b8b2a8', '#d9d6d0'][Math.floor(r2 * 4)] }),
      crown: { type: tall && r3 < 0.35 ? 'mansard' : 'flat', material: 'copper' },
      night: brand && h >= 24 ? { sign: { text: brand[1].toUpperCase(), color: '#ffffff' }, litFraction: 0.42 } : { litFraction: 0.42 },
    };
  } else if ((T.hospital.test(t) || RE.hospital.test(name)) && h >= 12) {
    d = { archetype: 'precast-grid', facade: facade({ system: 'ribbon', color: '#dedbd2', glass: '#2c3a44', vertical: 0.2, bay: 3.6 }), ground: { use: 'lobby' }, night: { litFraction: 0.5 } };
  } else if ((T.civic.test(t) || RE.civic.test(name)) && h >= 9 && h < 60 && area > 500 && !b.lod) {
    d = { archetype: 'civic-classical', facade: facade({}), crown: /capitol/i.test(name) ? { type: 'dome', material: 'gold', height: Math.max(18, h * 0.9) } : { type: 'flat' } };
  } else if ((T.warehouse.test(t) || (t === 'retail' && area > 2500)) && h <= 16 && area > 600) {
    d = { archetype: 'warehouse', facade: facade(/brick/.test(mat) || r1 < 0.3 ? { material: 'brick', color: '#84503f' } : r1 < 0.65 ? { material: 'metal', color: ['#a9aaa6', '#8e9499', '#b7b0a2'][Math.floor(r2 * 3)] } : { material: 'concrete', color: '#b5b1a8' }) };
  } else if (h >= 90 || (h >= 55 && h > 1.6 * side)) {
    // a tall slim footprint: a tower with a top (the generic builder ends every tower in a straight cut)
    const stone = /stone|granite|marble|brick|concrete|limestone|sandstone/.test(mat) || (!/glass|mirror/.test(mat) && (RE.stone.test(name) ? r1 < 0.7 : r1 < 0.3));
    const glassTints = ['#3d5468', '#2f4a4a', '#30363c', '#55483a', '#4a6074', '#27384a'];
    const stoneTints = [['granite', '#b4a595'], ['granite', '#8a6a5c'], ['limestone', '#d2c7b0'], ['precast', '#c5c0b4'], ['granite', '#6f6a66'], ['marble', '#e2dfd8']];
    const st = stoneTints[Math.floor(r2 * stoneTints.length)];
    const crown = r3 < 0.42 ? { type: 'flat' } : r3 < 0.58 ? { type: 'stepped' } : r3 < 0.72 && h > 110 ? { type: 'antenna', height: Math.round(h * 0.16) } : r3 < 0.84 ? { type: 'mansard', material: stone ? 'copper' : 'steel' } : r3 < 0.93 ? { type: 'pyramid-spire', material: stone ? 'copper' : 'steel' } : { type: 'flat' };
    d = stone
      ? { archetype: r1 < 0.12 && h < 160 ? 'artdeco-setback' : 'stone-tower', facade: facade({ material: st[0], color: st[1], system: r2 < 0.7 ? 'piers' : 'punched', vertical: 0.55 + 0.4 * r3 }), massing: r3 > 0.5 && h > 100 ? { setbacks: [{ at: 0.86, inset: 0.12 }] } : {}, crown }
      : { archetype: 'glass-tower', facade: facade({ glass: glassTints[Math.floor(r2 * glassTints.length)], glassReflect: 0.45 + 0.4 * r3, vertical: r1 < 0.2 ? 0.75 : 0.25, bay: 1.4 + 0.5 * r1 }), massing: r3 > 0.62 && h > 100 ? { setbacks: [{ at: 0.9, inset: 0.1 }] } : {}, crown };
    if (d.archetype === 'artdeco-setback') delete d.massing;
    if (h > 120 && r0 < 0.5) d.night = { crownLight: ['#ffd9a0', '#fff1d8', '#a8c8ff', '#ffb060'][Math.floor(r1 * 4)] };
  }
  return d ? resolveDescriptor(d) : null;
}

// ------------------------------------------------------------------ sign lettering (5 x 7 pixel capitals)
const FONT = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '11111001000010000100001000010011111',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
  3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
  9: '01110100011000101111000010001001100', '&': '01100100101010001000101011001001101', '-': '00000000000000011111000000000000000',
  '.': '00000000000000000000000000110001100', "'": '00100001000100000000000000000000000',
};
/**
 * A sign's lettering as horizontal runs of lit pixels in a 5 x 7 font (capitals, digits, & - . '), one column between
 * letters: { w: columns in all, runs: [[col0, col1, row]] } with row 0 on top and col1 inclusive. Unknown characters
 * are blanks. BuildingForms.js turns every run into one quad.
 */
export function signRuns(text) {
  const s = String(text || '').toUpperCase(), runs = [];
  for (let k = 0; k < s.length; k++) {
    const g = FONT[s[k]];
    if (!g) continue;
    for (let row = 0; row < 7; row++) {
      for (let c = 0; c < 5; c++) {
        if (g[row * 5 + c] !== '1') continue;
        let e = c; while (e + 1 < 5 && g[row * 5 + e + 1] === '1') e++;
        runs.push([k * 6 + c, k * 6 + e, row]);
        c = e;
      }
    }
  }
  return { w: Math.max(0, s.length * 6 - 1), runs };
}
