// Miami Beach buildings: a MapWorld plugin that claims the district's flat-roofed OSM footprints (`_lm`) and builds
// them itself, from the real footprints and heights, as the four kinds of building South Beach is made of:
//   deco   Art Deco hotels, 2-8 storeys: pastel / white stucco, rounded street corners, cantilevered eyebrows over the
//          windows (per window or wrapping the corners), racing-stripe bands, a stepped central pylon with portholes,
//          a stepped parapet, corner ribbon windows, a porch with columns and a terrace railing on the beach front
//   mimo   mid-century hotels / apartment slabs, 6-15 storeys: rows of projecting balconies with railings and sliding
//          doors behind, exposed slab edges, brise-soleil fins, breeze-block stair screens, a glazed lobby under a
//          canopy, a roof deck with a lift bulkhead and railings
//   tower  condo towers, 15-40 storeys: a parking podium screened with louvres and a pool deck on it, a tower with
//          rounded corners, white slab edges every floor, floor-to-ceiling glass, deep balconies with glass rails,
//          a louvred mechanical crown and antennae
//   shop   small commercial blocks: shopfront glazing, a lit signage band, striped awnings, rooftop air-conditioning
// Wiring: main.js passes miamiBuildingsPlugin({ tier }) to MapWorld after the `miami` plugin (world.js), whose
// option decoTrim: false then drops its own eyebrow / porch / lobby dressing (the neon stays). ?bld=engine: the old way.
// Everything is drawn with the engine's facade material (Buildings.js createFacadeMaterials: stucco / concrete PBR
// layers, interior-mapped curtain glass that reflects the sky probe, grate railings / louvres, fabric awnings), merged
// per tile, in three additive levels: L0 (massing, glass, slabs, eyebrows, parapets, big roof structures; every tile
// in view range), L1 (railings, columns, fins, roof plant; within ~320 m) and L2 (sills, wall air-conditioners,
// downpipes, planters, steps; built on demand within ~110 m, freed behind). Phones: L0 + L1 only, nearer ranges.
//   house  pitched-roof villas (Mediterranean revival): stucco, casements, a door canopy, a terracotta hip / pyramid roof
//   raised parts on stilts and courtyard blocks are claimed too (soffit + ribbon glass; courtyard walls with windows)
// Human scale (round 2): walls are cut round every opening and windows sit in real reveals (jambs, head soffit), typed
// per building (deco casement / jalousie / awning, MiMo slider / picture, frosted bathrooms, a glass-block stair), with
// blinds, side curtains, open sashes and sliders; balconies carry chairs, tables, plants, towels, bikes, dishes and a
// light under the slab, railings are solid / glass / pickets with real posts; hotel entrances open onto a lobby (desk,
// armchairs, palms, pendant lights, the name on the back wall) behind mullions and doors, with steps, terrazzo and
// uplights; porches have café tables; side walls get service doors, meters, pipes and hedges; podiums a parking mouth
// with a barrier; roofs have plant on pads with pipes and, on some hotels, a lettered roof sign. Names (world.js
// NEON_NAMES) are lettered on canopies, shop boards and roof signs from one canvas atlas (building-materials.js), lit at
// dusk. The weathering (stucco float texture, patches, cracks, streaks, damp, fading, mildew, formwork, roof stains)
// and the far level's window bays are a shader pass in building-materials.js.
// Colliders for the claimed footprints are registered here (MapWorld skips claimed ones).
import * as THREE from 'three';
import { GeoBuf, NullBuf, BuildingBuilder, MODE, enc, PBR, FACADE, WIN_RECTS, tintBytes, insetRing, RBIT, signedArea, pointInRing, localizeMeshOrigin } from '@vibe/engine/world';
import { polygonToBoxes } from '@vibe/engine/physics';
import { releaseStaticGeometry } from '@vibe/engine/render';
import { miamiFacadeMaterials, signAtlas, CL } from './building-materials.js';
import { NEON_NAMES } from './world.js';

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const tb = (c, v = 1) => tintBytes(new THREE.Color().setRGB(Math.min(1, c[0] * v), Math.min(1, c[1] * v), Math.min(1, c[2] * v), THREE.SRGBColorSpace));
const pick = (a, r) => a[Math.min(a.length - 1, Math.floor(r * a.length))];

// ------------------------------------------------------------------ palette (sRGB, multiplied onto the grey PBR albedo)
const WHITES = [[0.97, 0.96, 0.93], [0.96, 0.93, 0.86], [0.93, 0.89, 0.8], [0.98, 0.98, 0.97], [0.92, 0.91, 0.89], [0.95, 0.9, 0.82]];
// pastels a quarter of the way to white (sun-faded stucco), lilac the rarest
const PASTELS = [[0.99, 0.8, 0.82], [0.76, 0.94, 0.85], [0.7, 0.9, 0.93], [0.99, 0.93, 0.68], [1.0, 0.83, 0.7], [0.88, 0.83, 0.96], [0.76, 0.86, 0.97], [0.98, 0.76, 0.7], [0.82, 0.95, 0.74], [0.99, 0.8, 0.82], [0.7, 0.9, 0.93]].map((c) => c.map((v) => v + (1 - v) * 0.25));
const ACCENTS = [[0.25, 0.68, 0.72], [0.93, 0.48, 0.55], [0.98, 0.7, 0.32], [0.45, 0.55, 0.85], [0.35, 0.72, 0.52], [0.86, 0.38, 0.4]];
const GLASS = [[0.66, 0.78, 0.84], [0.6, 0.7, 0.72], [0.74, 0.8, 0.86], [0.76, 0.72, 0.64], [0.56, 0.7, 0.78], [0.84, 0.88, 0.9]];
const TOWER_GLASS = [[0.56, 0.7, 0.82], [0.62, 0.76, 0.84], [0.5, 0.62, 0.7], [0.7, 0.8, 0.86]];
const AWNING = [[0.1, 0.42, 0.45], [0.75, 0.2, 0.28], [0.12, 0.2, 0.38], [0.95, 0.55, 0.2], [0.18, 0.4, 0.22], [0.9, 0.84, 0.72]];
const DECO_ROADS = /^(Ocean Drive|Collins Avenue|Washington Avenue|Española Way|Espanola Way|Drexel Avenue)$/;

const INFO = {
  plain: (pbr, seed, cls = -1) => [cls, -1, seed, enc(pbr, MODE.PLAIN)],
  wall: (S) => [CL.WALL, Math.round(S.base * 20), S.seed, enc(S.wallPbr, MODE.PLAIN)], // y: the street height (x 20) for the damp band
  conc: (S) => [CL.CONCRETE, -1, S.seed, enc(PBR.CONCRETE_PANEL, MODE.PLAIN)],
  trim: (S, pbr = PBR.PLAIN) => [CL.TRIM, -1, S.seed, enc(pbr, MODE.PLAIN)],
  led: (seed) => [0, -1, seed, enc(PBR.PLAIN, MODE.LED)],
  glass: (variant, seed) => [variant, -1, seed, enc(PBR.PLAIN, MODE.CURTAIN)],
  grate: (pat, seed) => [pat, -1, seed, enc(PBR.PLAIN, MODE.GRATE)],
  sign: (len, seed) => [1, Math.round(len), seed, enc(PBR.PLAIN, MODE.SIGN)],
  awning: (stripes, seed) => [0, stripes ? 1 : 0, seed, enc(PBR.FABRIC, MODE.SIGN)],
};

// ------------------------------------------------------------------ geometry primitives (an edge frame f: a + d s + o out)
const at = (f, s, y, out = 0) => [f.ax + f.dx * s + f.ox * out, y, f.az + f.dz * s + f.oz * out];
function quad4(buf, a, b, c, d, n, info, tA, tB = tA, uv = null) {
  const k0 = buf.v(a[0], a[1], a[2], n[0], n[1], n[2], uv ? uv[0] : 0, uv ? uv[1] : 0, info, tA);
  const k1 = buf.v(b[0], b[1], b[2], n[0], n[1], n[2], uv ? uv[2] : 0, uv ? uv[1] : 0, info, tA);
  const k2 = buf.v(c[0], c[1], c[2], n[0], n[1], n[2], uv ? uv[2] : 0, uv ? uv[3] : 0, info, tB);
  const k3 = buf.v(d[0], d[1], d[2], n[0], n[1], n[2], uv ? uv[0] : 0, uv ? uv[3] : 0, info, tB);
  buf.quad(k0, k1, k2, k3);
}
/** Vertical quad on the edge plane (offset `out`), s0..s1 x y0..y1; uv = [u0, v0, u1, v1]. */
function face(buf, f, s0, s1, y0, y1, out, info, tA, tB, uv) {
  quad4(buf, at(f, s0, y0, out), at(f, s1, y0, out), at(f, s1, y1, out), at(f, s0, y1, out), [f.ox, 0, f.oz], info, tA, tB, uv);
}
/** Box against the wall: along s0..s1, y0..y1, from out o0 to o1. faces: t top, b bottom, f front, e ends. */
function slab(buf, f, s0, s1, y0, y1, o0, o1, info, tint, faces = 'tbfe', tUnder = null) {
  if (faces.includes('t')) quad4(buf, at(f, s0, y1, o0), at(f, s1, y1, o0), at(f, s1, y1, o1), at(f, s0, y1, o1), [0, 1, 0], info, tint);
  if (faces.includes('b')) quad4(buf, at(f, s0, y0, o0), at(f, s1, y0, o0), at(f, s1, y0, o1), at(f, s0, y0, o1), [0, -1, 0], info, tUnder || tint);
  if (faces.includes('f')) face(buf, f, s0, s1, y0, y1, o1, info, tint);
  if (faces.includes('e')) {
    quad4(buf, at(f, s0, y0, o0), at(f, s0, y0, o1), at(f, s0, y1, o1), at(f, s0, y1, o0), [-f.dx, 0, -f.dz], info, tint);
    quad4(buf, at(f, s1, y0, o0), at(f, s1, y0, o1), at(f, s1, y1, o1), at(f, s1, y1, o0), [f.dx, 0, f.dz], info, tint);
  }
}
// the facade shader scales the glass's sky reflection with fv (floors above the street, 2..25): offset so low windows
// reflect as strongly as a tower's
const FV = 24;
/** Curtain glass (interior mapped, reflective): pane width `pane` m, fv0..fv1 floor units, fu offset per window. */
function glass(buf, f, s0, s1, y0, y1, out, variant, tint, seed, pane, fu0, fv0, fv1) {
  face(buf, f, s0, s1, y0, y1, out, INFO.glass(variant, seed), tint, tint, [fu0, fv0 + FV, fu0 + (s1 - s0) / pane, fv1 + FV]);
}
/**
 * Shop / lobby glazing: the engine's storefront window layer in PANE mode (framed glass with a bulkhead and a door in
 * one bay of four, interior-mapped rooms that are lit like shops at night), its glass top at yTop.
 */
function storefront(buf, S, f, s0, s1, yTop, bayW, tint) {
  const h = (yTop - S.base) / 0.8, nb = Math.max(1, Math.round((s1 - s0) / bayW));
  face(buf, f, s0, s1, S.base, S.base + h, 0.03, [FACADE.STOREFRONT, -1, S.seed, enc(S.wallPbr, MODE.PANE)], tint, tint, [0, 0, nb, 1]);
}
/** Railing / louvre / screen: a grate quad (bars in the shader, discarded between). pat 0 balusters, 1 slats. */
function grate(buf, f, s0, s1, y0, y1, out, pat, tint, seed, back = false) {
  const uv = pat === 0 ? [s0, 0, s1, 1] : [0, y0, 1, y1];
  face(buf, f, s0, s1, y0, y1, out, INFO.grate(pat, seed), tint, tint, uv);
  // the back of the bars (seen from balconies above / the side)
  if (back) quad4(buf, at(f, s1, y0, out - 0.01), at(f, s0, y0, out - 0.01), at(f, s0, y1, out - 0.01), at(f, s1, y1, out - 0.01), [-f.ox, 0, -f.oz], INFO.grate(pat, seed), tint, tint, pat === 0 ? [s1, 0, s0, 1] : [0, y0, 1, y1]);
}
/**
 * A balcony / terrace railing along f from s0 to s1 at out, 1 m high: 'solid' a stucco balustrade (L0) with a
 * coping (L1), 'glass' a glass panel with a metal top rail (L1), 'pickets' top and bottom rails (L1) with the
 * balusters as a grate near the camera only (L2: a grate turns to dither noise further out).
 */
function railing(S, f, s0, s1, y0, out, kind, tint) {
  const [L0, L1, L2] = S.bufs, h = 1.02;
  if (s1 - s0 < 0.1) return;
  if (kind === 'solid') {
    slab(L0, f, s0, s1, y0, y0 + h, out - 0.12, out, INFO.wall(S), tint, 'f');
    slab(L1, f, s0 - 0.02, s1 + 0.02, y0 + h, y0 + h + 0.06, out - 0.15, out + 0.03, INFO.trim(S), S.trim, 'tfb');
  } else if (kind === 'glass') {
    glass(L1, f, s0, s1, y0 + 0.05, y0 + h - 0.04, out, 1, tb([0.78, 0.86, 0.88]), S.seed, 1.25, 0, 0, 0.99);
    slab(L1, f, s0, s1, y0 + h - 0.05, y0 + h + 0.01, out - 0.05, out + 0.02, INFO.trim(S, PBR.METAL), tint, 'tfb');
    for (let q = 0, np = Math.max(1, Math.round((s1 - s0) / 1.5)); q <= np; q++) { const sp = s0 + ((s1 - s0) * q) / np; slab(L1, f, sp - 0.025, sp + 0.025, y0, y0 + h, out - 0.05, out + 0.01, INFO.trim(S, PBR.METAL), tint, 'f'); }
  } else {
    // pickets: top and bottom rails and posts every 1.2 m as geometry (they hold at any distance), the balusters
    // between them as thin bars near the camera (L2)
    const mi = INFO.trim(S, PBR.METAL);
    slab(L1, f, s0, s1, y0 + h - 0.05, y0 + h + 0.01, out - 0.06, out, mi, tint, 'tfb');
    slab(L1, f, s0, s1, y0 + 0.06, y0 + 0.1, out - 0.04, out, mi, tint, 'ft');
    const np = Math.max(1, Math.round((s1 - s0) / 1.2));
    for (let q = 0; q <= np; q++) { const sp = s0 + ((s1 - s0) * q) / np; slab(L1, f, sp - 0.03, sp + 0.03, y0, y0 + h, out - 0.06, out, mi, tint, 'f'); }
    for (let sp = s0 + 0.16; sp < s1 - 0.05; sp += 0.16) slab(L2, f, sp - 0.012, sp + 0.012, y0 + 0.1, y0 + h - 0.05, out - 0.035, out - 0.01, mi, tint, 'f');
  }
}
/** The railing's return from the wall at s back to the wall (perpendicular, depth m out); sign: which side faces out. */
function railingSide(S, f, s, y0, depth, kind, tint, sign) {
  const g = sign > 0 ? { ax: f.ax + f.dx * s, az: f.az + f.dz * s, dx: f.ox, dz: f.oz, ox: -f.dx, oz: -f.dz } : { ax: f.ax + f.dx * s + f.ox * depth, az: f.az + f.dz * s + f.oz * depth, dx: -f.ox, dz: -f.oz, ox: f.dx, oz: f.dz };
  railing(S, g, 0.02, depth - 0.02, y0, 0, kind, tint);
}
/**
 * What lives on a balcony (L2, a light fitting under the slab above in L1): plastic chairs and a little table, a
 * potted plant, a towel or swimwear over the rail, a bike against the wall, a satellite dish; some are bare.
 */
const TOWELS = [[0.95, 0.4, 0.45], [0.25, 0.6, 0.85], [0.98, 0.8, 0.3], [0.95, 0.95, 0.92], [0.3, 0.75, 0.6], [0.85, 0.35, 0.7]];
function balconyLife(S, f, sc, w, y, yC, depth, railKind) {
  const [, L1, L2] = S.bufs, r = S.r;
  const p = at(f, sc, 0, depth * 0.45);
  quad4(L1, at(f, sc - 0.12, yC - 0.03, depth * 0.45 - 0.12), at(f, sc + 0.12, yC - 0.03, depth * 0.45 - 0.12), at(f, sc + 0.12, yC - 0.03, depth * 0.45 + 0.12), at(f, sc - 0.12, yC - 0.03, depth * 0.45 + 0.12), [0, -1, 0], INFO.led(S.seed), tb([1, 0.94, 0.8]), tb([1, 0.94, 0.8]), [0.25, 0.4, 0.45, 0.6]);
  void p;
  const roll = r(), pl = r(), tw = r(), dish = r(), col = pick([[0.96, 0.96, 0.94], [0.95, 0.95, 0.94], [0.2, 0.22, 0.25], [0.85, 0.55, 0.35]], r());
  if (roll < 0.15) return;
  if (roll < 0.7) {
    chair(L2, S, f, sc - 0.55, depth * 0.55, y, col, -1);
    if (roll < 0.5) chair(L2, S, f, sc + 0.55, depth * 0.55, y, col, -1);
    table(L2, S, f, sc, depth * 0.55, y, col);
  }
  if (pl < 0.55) pottedPlant(L2, S, f, sc + (pl < 0.3 ? -1 : 1) * (w / 2 - 0.35), depth - 0.35, y, pl < 0.15);
  if (tw < 0.35 && railKind !== 'glass') {
    const tc = tb(pick(TOWELS, r())), ts = sc + (r() - 0.5) * (w - 1.2);
    face(L2, f, ts - 0.35, ts + 0.35, y + 0.35, y + 1.06, depth + 0.015, INFO.plain(PBR.FABRIC, S.seed), tc, tc);
    quad4(L2, at(f, ts + 0.35, y + 0.55, depth - 0.14), at(f, ts - 0.35, y + 0.55, depth - 0.14), at(f, ts - 0.35, y + 1.06, depth - 0.14), at(f, ts + 0.35, y + 1.06, depth - 0.14), [-f.ox, 0, -f.oz], INFO.plain(PBR.FABRIC, S.seed), tc);
  } else if (tw > 0.85) {
    // a bike against the wall
    const bs = sc + w / 2 - 1.1, dk = tb([0.12, 0.12, 0.13]);
    for (const k of [-0.5, 0.5]) boxF(L2, S, f, bs + k, 0.2, y, 0.62, 0.04, 0.62, INFO.trim(S, PBR.METAL), dk);
    boxF(L2, S, f, bs, 0.2, y + 0.45, 0.9, 0.04, 0.05, INFO.trim(S, PBR.METAL), tb(pick(TOWELS, r())));
  }
  if (dish < 0.18) {
    const ds = sc + (dish < 0.09 ? -1 : 1) * (w / 2 - 0.3), q = at(f, ds, 0, 0.35);
    S.P.helper.cylinder(L2, q[0], q[2], yC - 0.75, 0.32, 0.06, 10, INFO.trim(S), tb([0.92, 0.92, 0.9]));
    boxF(L2, S, f, ds, 0.15, yC - 0.85, 0.05, 0.3, 0.05, INFO.trim(S, PBR.METAL), tb([0.6, 0.6, 0.6]));
  }
}
function polyV(buf, pts, n, info, tint, uvs) {
  const k = pts.map((p, i) => buf.v(p[0], p[1], p[2], n[0], n[1], n[2], uvs ? uvs[i][0] : 0, uvs ? uvs[i][1] : 0, info, tint));
  for (let i = 1; i + 1 < k.length; i++) buf.tri(k[0], k[i], k[i + 1]);
}
function frameOf(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
  if (L < 0.05) return null;
  return { ax: a[0], az: a[1], dx: dx / L, dz: dz / L, ox: dz / L, oz: -dx / L, L, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2 };
}

// ------------------------------------------------------------------ rings
/** Round the convex corners `which` (Set of vertex indices) with radius R (segs per arc). Returns { ring, arcFrom } */
function roundRing(ring, which, R, segs) {
  const n = ring.length, out = [], src = [];
  const sA = Math.sign(signedArea(ring));
  for (let i = 0; i < n; i++) {
    const p = ring[i], a = ring[(i + n - 1) % n], b = ring[(i + 1) % n];
    const ux = a[0] - p[0], uz = a[1] - p[1], La = Math.hypot(ux, uz), vx = b[0] - p[0], vz = b[1] - p[1], Lb = Math.hypot(vx, vz);
    const cr = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    const cosA = (ux * vx + uz * vz) / (La * Lb);
    if (!which.has(i) || Math.sign(cr) !== sA || cosA < -0.5 || cosA > 0.5) { out.push(p); src.push({ v: i, arc: false }); continue; }
    const r = Math.min(R, La * 0.4, Lb * 0.4);
    if (r < 0.8) { out.push(p); src.push({ v: i, arc: false }); continue; }
    const t1 = [p[0] + ux / La * r, p[1] + uz / La * r], t2 = [p[0] + vx / Lb * r, p[1] + vz / Lb * r];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t;
      // quadratic Bezier pulled out to read as a circular arc
      const q = [w0 * t1[0] + w1 * p[0] + w2 * t2[0], w0 * t1[1] + w1 * p[1] + w2 * t2[1]];
      out.push(q); src.push({ v: i, arc: k < segs });
    }
  }
  return { ring: out, src };
}
function ringOK(r, outer) {
  if (!r || r.length < 3) return false;
  if (signedArea(r) <= 0 === signedArea(outer) > 0) return false;
  for (const p of r) if (!pointInRing(p[0], p[1], outer)) return false;
  return true;
}

// ------------------------------------------------------------------ the plugin
/**
 * @param {object} o tier: 'desktop' | 'mobile'
 */
export function miamiBuildingsPlugin(o = {}) {
  const MOB = o.tier === 'mobile';
  const RANGE = { view: MOB ? 560 : 1150, near: MOB ? 150 : 185, l1: MOB ? 100 : 160, l2: MOB ? 0 : 70, hyst: 12 };
  const T0 = 240, T1 = 120; // tile sizes: L0, L1 / L2
  const P = {
    name: 'miamiBuildings', lite: MOB || /[?&]bldlite=1/.test((globalThis.location && globalThis.location.search) || ''), list: [], group: new THREE.Group(), stats: {}, tiles0: [], tiles1: [], frame: 0, mats: null,
    beforeBuildings(ctx) {
      const { data, world } = ctx;
      const BO = world._buildingOpts();
      const probe = new BuildingBuilder(world.bounds, { ...BO, grid: false });
      const raster = world.raster;
      const deco = data.roads.filter((r) => r.n && DECO_ROADS.test(r.n) && r.c !== 'footway').map((r) => r.p);
      const ocean = data.roads.filter((r) => r.n === 'Ocean Drive' && r.c !== 'footway' && r.c !== 'path').map((r) => r.p);
      const colGrid = new Map();
      for (let i = 0; i < data.buildings.length; i++) {
        const b = data.buildings[i];
        if (!b || b._lm || b.lod || !b.p || b.p.length < 3) continue;
        if (/^(roof|carport|lifeguard_tower|bridge|pavilion|tent|tweak)$/.test(b.t || '')) continue;
        const pitched = b.r && b.r !== 'flat' ? b.r : null;
        let fp = null;
        try { fp = probe.footprint(b); } catch { fp = null; }
        if (!fp || fp.area < 20 || fp.h < 3) continue;
        if (!world.isLand(fp.c[0], fp.c[1])) continue;
        const seed = hash(`mb${fp.c[0].toFixed(1)},${fp.c[1].toFixed(1)}`);
        const r = rnd(seed);
        const dDeco = deco.length ? distToPolylines(fp.c[0], fp.c[1], deco).d : Infinity;
        const dOcean = ocean.length ? distToPolylines(fp.c[0], fp.c[1], ocean).d : Infinity;
        const h = fp.h, t = b.t || 'yes';
        let kind;
        if (fp.mh > 0.5) kind = 'raised';                      // a canopy / bridge / upper floors on stilts
        else if (pitched && h < 20) kind = 'house';            // pitched (Mediterranean revival): a tiled roof
        else if (h >= 44 && fp.holes.length) kind = 'mimo';    // a tower round a courtyard: a slab treatment
        else if (h >= 44) kind = 'tower';
        else if (h < 8.5 && fp.area < 1800 && (/commercial|retail/.test(t) || r() < 0.55)) kind = 'shop';
        else if (h < 30 && (dDeco < 90 || (h < 16 && r() < 0.55))) kind = 'deco';
        else kind = 'mimo';
        const B = { i, b, fp, kind, seed, h, dDeco, dOcean, pitched, onOcean: kind !== 'raised' && kind !== 'house' && dOcean < 70 && h <= 40 && h >= 6 };
        // colours: most white / cream / sand, a share in pastels; never the same as a neighbour
        const pastelShare = kind === 'deco' ? (dDeco < 60 ? 0.48 : 0.3) : kind === 'shop' ? 0.35 : kind === 'mimo' ? 0.16 : 0.04;
        const gx = Math.floor(fp.c[0] / 30), gz = Math.floor(fp.c[1] / 30);
        const near = [];
        for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const q of colGrid.get(`${gx + a},${gz + c}`) || []) if (Math.hypot(q.c[0] - fp.c[0], q.c[1] - fp.c[1]) < 34) near.push(q.key);
        let key = '', col = null;
        for (let k = 0; k < 8; k++) {
          const pastel = r() < pastelShare;
          const idx = Math.floor(r() * (pastel ? PASTELS.length : WHITES.length));
          key = (pastel ? 'p' : 'w') + idx; col = pastel ? PASTELS[idx] : WHITES[idx];
          if (!near.includes(key)) break;
        }
        B.pastel = key[0] === 'p';
        B.body = col;
        const cell = `${gx},${gz}`; if (!colGrid.has(cell)) colGrid.set(cell, []); colGrid.get(cell).push({ c: fp.c, key });
        // party walls / street faces of the footprint's edges
        const ring = fp.outer, n = ring.length;
        B.edges = [];
        for (let e = 0; e < n; e++) {
          const f = frameOf(ring[e], ring[(e + 1) % n]);
          if (!f) { B.edges.push({ f: null, kind: 'party' }); continue; }
          let party = 0;
          for (const s of [0.2, 0.5, 0.8]) { const x = f.ax + f.dx * f.L * s + f.ox * 1.4, z = f.az + f.dz * f.L * s + f.oz * 1.4; if (raster && raster.any(x, z, 0.45, RBIT.BUILDING)) party++; }
          const street = f.L > 2.5 && raster ? raster.any(f.mx + f.ox * 4.5, f.mz + f.oz * 4.5, 1.6, RBIT.ROAD | RBIT.SIDEWALK) : false;
          B.edges.push({ f, kind: party >= 2 ? 'party' : street ? 'street' : 'side' });
        }
        // the front: world.js's choice for the Ocean Drive hotels (its neon / steps sit on it), else the longest street edge
        let front = -1, bestD = Infinity;
        if (B.onOcean) {
          for (let e = 0; e < n; e++) {
            const E = B.edges[e]; if (!E.f || E.f.L < 7) continue;
            const d = distToPolylines(E.f.mx, E.f.mz, ocean).d;
            if (d < bestD) { bestD = d; front = e; }
          }
          if (bestD > 32) { front = -1; B.onOcean = false; }
        }
        if (front < 0) { let L = 0; for (let e = 0; e < n; e++) { const E = B.edges[e]; if (E.f && E.kind === 'street' && E.f.L > L) { L = E.f.L; front = e; } } }
        if (front < 0) { let L = 0; for (let e = 0; e < n; e++) { const E = B.edges[e]; if (E.f && E.kind !== 'party' && E.f.L > L) { L = E.f.L; front = e; } } }
        if (front >= 0) B.edges[front].kind = 'front';
        B.front = front;
        B.nameI = Math.floor(r() * NEON_NAMES.length);
        b._lm = 'miami-bld';
        P.list.push(B);
      }
      P.stats.claimed = P.list.length;
      P.stats.kinds = P.list.reduce((a, B) => { a[B.kind] = (a[B.kind] || 0) + 1; return a; }, {});
      return null;
    },
    afterBuildings(ctx) {
      const t0 = performance.now();
      const { world } = ctx;
      P.world = world;
      P.mats = miamiFacadeMaterials(world, { weather: !MOB });
      P.atlas = signAtlas();
      P.signList = [];
      P.helper = new BuildingBuilder(world.bounds, { grid: false });
      // colliders (MapWorld skips claimed footprints)
      for (const B of P.list) {
        const fp = B.fp, y0 = fp.base + (fp.mh > 0 ? fp.mh : -1);
        for (const bx of polygonToBoxes(fp.outer, fp.holes)) ctx.colliders.add(bx[0], y0, bx[2], fp.base + fp.h, bx[1], bx[3], 1);
      }
      // tiles
      const tiles0 = new Map(), tiles1 = new Map();
      for (const B of P.list) {
        const [cx, cz] = B.fp.c;
        const k0 = `${Math.floor(cx / T0)},${Math.floor(cz / T0)}`, k1 = `${Math.floor(cx / T1)},${Math.floor(cz / T1)}`;
        if (!tiles0.has(k0)) tiles0.set(k0, { list: [], bb: bbox() });
        if (!tiles1.has(k1)) tiles1.set(k1, { list: [], bb: bbox() });
        tiles0.get(k0).list.push(B); tiles1.get(k1).list.push(B);
        for (const p of B.fp.outer) { grow(tiles0.get(k0).bb, p); grow(tiles1.get(k1).bb, p); }
      }
      let tris0 = 0, tris1 = 0, trisF = 0;
      for (const t of tiles0.values()) {
        const b0 = new GeoBuf(8192), nul = new NullBuf();
        for (const B of t.list) { const k0 = b0.ni; P.collect = true; buildOne(P, B, [b0, nul, nul]); P.collect = false; const bk = (P.stats.byKind = P.stats.byKind || {}); bk[B.kind] = (bk[B.kind] || 0) + (b0.ni - k0) / 3; }
        t.mesh = finish(b0, P.mats, 'buildings-miami', true);
        tris0 += b0.tris;
        if (t.mesh) { P.group.add(t.mesh); t.mesh.visible = false; }
        // the far version (deco / mimo as parallax shells; towers and shops as near)
        const bf = new GeoBuf(4096);
        for (const B of t.list) buildOne(P, B, [bf, nul, nul], true);
        t.far = finish(bf, P.mats, 'buildings-miami-far', true);
        trisF += bf.tris;
        if (t.far) { P.group.add(t.far); t.far.visible = false; }
        P.tiles0.push(t);
      }
      for (const t of tiles1.values()) {
        const b1 = new GeoBuf(4096), nul = new NullBuf();
        for (const B of t.list) { const k0 = b1.ni; buildOne(P, B, [nul, b1, nul]); const bk = (P.stats.byKind1 = P.stats.byKind1 || {}); bk[B.kind] = (bk[B.kind] || 0) + (b1.ni - k0) / 3; }
        t.mesh = finish(b1, P.mats, 'buildings-miami-l1', true);
        tris1 += b1.tris;
        if (t.mesh) { P.group.add(t.mesh); t.mesh.visible = false; }
        t.near = null;
        P.tiles1.push(t);
      }
      // upload every tile now (into a 1 x 1 target, nothing on screen): the GPU buffers are then made and the CPU
      // arrays dropped (releaseStaticGeometry in finish()); a tile left unseen would keep its arrays on the heap
      if (P.atlas && P.signList.length) { const sm = signMesh(P.signList, P.atlas); if (sm) P.group.add(sm); P.stats.signs = P.signList.length; }
      P.signList = null;
      uploadAll(ctx.renderer, P.group);
      P.stats.tiles = [P.tiles0.length, P.tiles1.length];
      P.stats.tris = { l0: tris0, l1: tris1, far: trisF };
      P.stats.ms = Math.round(performance.now() - t0);
      P.group.name = 'miami-buildings';
      console.info('[miami] buildings', JSON.stringify(P.stats));
      return P.group;
    },
    update(dt, cam, darkness = 0) {
      if (!cam || !P.mats) return;
      if (P.atlas) P.atlas.setLit(THREE.MathUtils.smoothstep(darkness, 0.08, 0.3));
      const x = cam.x, y = cam.y, z = cam.z;
      for (const t of P.tiles0) {
        const d = boxDist(t.bb, x, y, z);
        // near L0 within RANGE.near (hysteresis), the far shells beyond, nothing past the view range
        const nearOn = t.nearOn = t.nearOn ? d < RANGE.near + RANGE.hyst : d < RANGE.near;
        if (t.mesh) t.mesh.visible = nearOn || (!t.far && d < RANGE.view);
        if (t.far) t.far.visible = !nearOn && d < RANGE.view;
      }
      let built = 0;
      for (const t of P.tiles1) {
        const d = boxDist(t.bb, x, y, z);
        if (t.mesh) {
          const on = t.mesh.visible ? d < RANGE.l1 + RANGE.hyst : d < RANGE.l1;
          t.mesh.visible = on;
        }
        if (RANGE.l2 > 0) {
          if (!t.near && d < RANGE.l2 && built < 3) {
            const b2 = new GeoBuf(4096), nul = new NullBuf();
            for (const B of t.list) buildOne(P, B, [nul, nul, b2]);
            t.near = finish(b2, P.mats, 'buildings-miami-l2', false);
            if (t.near) P.group.add(t.near);
            else t.near = EMPTY;
            built++;
          } else if (t.near && d > RANGE.l2 * 1.9 + 40) {
            if (t.near !== EMPTY) { P.group.remove(t.near); t.near.geometry.dispose(); }
            t.near = null;
          }
          if (t.near && t.near !== EMPTY) t.near.visible = d < RANGE.l2 + RANGE.hyst;
        }
      }
    },
  };
  return P;
}
const EMPTY = { isEmpty: true };

/** The lettered boards (canopy fascias, roof signs) merged into one mesh on the atlas material. */
function signMesh(list, atlas) {
  const pos = [], nor = [], uv = [], idx = [];
  for (const q of list) {
    const [u0, v0, u1, v1] = atlas.cell(q.name, q.style), k = pos.length / 3;
    const uvq = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]]; // (s runs to the viewer's left on the front)
    for (let i = 0; i < 4; i++) { pos.push(...q.p[i]); nor.push(...q.n); uv.push(...uvq[i]); }
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, atlas.material); m.name = 'buildings-miami-signs'; m.castShadow = false; m.receiveShadow = true;
  m.matrixAutoUpdate = false; m.updateMatrix();
  releaseStaticGeometry(m);
  return m;
}
/** A lettered board facing out of f (s0..s1, y0..y1 at out); both faces when `both`. */
function signBoard(S, f, s0, s1, y0, y1, out, style, both = false, backOff = 0.02) {
  if (!S.P.collect || S.far || !S.P.signList) return;
  const name = S.B.nameI;
  // the quad's winding follows three's default (counter-clockwise seen from the front)
  S.P.signList.push({ name, style, n: [f.ox, 0, f.oz], p: [at(f, s1, y0, out), at(f, s0, y0, out), at(f, s0, y1, out), at(f, s1, y1, out)] });
  if (both) S.P.signList.push({ name, style, back: true, n: [-f.ox, 0, -f.oz], p: [at(f, s0, y0, out - backOff), at(f, s1, y0, out - backOff), at(f, s1, y1, out - backOff), at(f, s0, y1, out - backOff)] });
}

function uploadAll(renderer, group) {
  if (!renderer) return;
  const rt = new THREE.WebGLRenderTarget(1, 1), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1);
  const prev = renderer.getRenderTarget(), auto = renderer.autoClear, shadows = renderer.shadowMap.enabled;
  renderer.setRenderTarget(rt); renderer.shadowMap.enabled = false; renderer.autoClear = false;
  const scene = new THREE.Scene();
  for (const m of group.children.slice()) {
    if (!m.isMesh) continue;
    const parent = m.parent, vis = m.visible, fc = m.frustumCulled;
    scene.add(m); m.visible = true; m.frustumCulled = false;
    try { renderer.render(scene, cam); } catch (e) { console.warn('[miami] building upload failed', e); }
    scene.remove(m); parent.add(m); m.visible = vis; m.frustumCulled = fc;
  }
  renderer.setRenderTarget(prev); renderer.shadowMap.enabled = shadows; renderer.autoClear = auto;
  rt.dispose();
}

function finish(buf, mats, name, cast) {
  if (!buf.n) return null;
  const m = buf.build(mats, name);
  if (!m) return null;
  m.castShadow = cast;
  localizeMeshOrigin(m);
  m.updateMatrix();
  releaseStaticGeometry(m);
  return m;
}
const bbox = () => ({ minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
const grow = (bb, p) => { if (p[0] < bb.minX) bb.minX = p[0]; if (p[0] > bb.maxX) bb.maxX = p[0]; if (p[1] < bb.minZ) bb.minZ = p[1]; if (p[1] > bb.maxZ) bb.maxZ = p[1]; };
const boxDist = (bb, x, y, z) => { const dx = Math.max(bb.minX - x, 0, x - bb.maxX), dz = Math.max(bb.minZ - z, 0, z - bb.maxZ); return Math.hypot(dx, dz, Math.max(0, y - 60) * 0.5); };

export function distToPolylines(x, z, lines) {
  let best = Infinity, bi = -1, bs = 0;
  for (let li = 0; li < lines.length; li++) {
    const P = lines[li];
    for (let i = 0; i < P.length - 1; i++) {
      const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; bi = li; bs = i + t; }
    }
  }
  return { d: best, line: bi, s: bs };
}

// ================================================================== one building
/**
 * Emit building B into bufs [L0, L1, L2] (NullBuf for levels not being built). Deterministic: the same draws for
 * every level, so a level built later (L2 on demand) lines up with the others.
 */
function buildOne(P, B, bufs, far = false) {
  const r = rnd(B.seed);
  const seed = (B.seed % 997) / 997;
  const fp = B.fp, base = fp.base, H = fp.h, kind = B.kind;
  const S = {
    B, r, seed, base, bufs, P, groundAt: P.world ? (x, z) => P.world._groundAt(x, z) : () => base,
    body: tb(B.body), bodyDark: tb(B.body, 0.84), bodyShade: tb(B.body, 0.72), bodyStreak: tb(B.body, 0.86),
    trim: tb(B.pastel ? WHITES[3] : WHITES[Math.floor(r() * 3)]),
    accent: tb(B.pastel ? B.body.map((c) => c * 0.82) : pick(ACCENTS, r())),
    accentRaw: B.pastel ? B.body.map((c) => c * 0.82) : null,
    glassT: tb(pick(GLASS, r())), slabT: tb([0.93, 0.93, 0.91]), metal: tb([0.85, 0.86, 0.86]), dark: tb([0.08, 0.08, 0.09]),
    roofT: tb(pick([[0.86, 0.86, 0.84], [0.74, 0.74, 0.72], [0.9, 0.88, 0.84]], r())),
    wallPbr: r() < 0.75 ? PBR.STUCCO_B : PBR.STUCCO_A, far,
  };
  if (!B.pastel) S.trim = tb([1, 1, 1]);
  S.openings = new Map(); S.edgeI = null;
  S.glassRaw = pick(GLASS, r());
  S.reveal = kind === 'deco' ? 0.2 + r() * 0.08 : 0.14 + r() * 0.06;
  S.winKinds = kind === 'deco' ? pick([['casement', 'casement', 'jalousie'], ['awning', 'awning', 'casement'], ['jalousie', 'jalousie', 'awning'], ['casement', 'awning']], r())
    : kind === 'mimo' ? pick([['slider', 'slider', 'picture'], ['picture', 'slider'], ['slider']], r()) : ['casement', 'picture'];
  S.frameT = r() < 0.6 ? S.trim : tb(pick([[0.75, 0.76, 0.76], [0.22, 0.22, 0.24], [0.8, 0.72, 0.55]], r()));
  if (kind === 'tower') { S.glassT = tb(pick(TOWER_GLASS, r())); S.body = tb(pick([[0.97, 0.97, 0.96], [0.94, 0.94, 0.93], [0.9, 0.91, 0.92]], r())); S.bodyDark = S.body; S.wallPbr = PBR.CONCRETE_PANEL; }
  if (kind === 'mimo' && r() < 0.4) S.wallPbr = PBR.CONCRETE_PANEL;
  S.defer = [];
  if (kind === 'house') buildHouse(S, fp, H);
  else if (kind === 'raised') buildRaised(S, fp, H);
  else if (kind === 'deco') buildDeco(S, fp, H);
  else if (kind === 'mimo') buildMimo(S, fp, H);
  else if (kind === 'tower') buildTower(S, fp, H);
  else buildShop(S, fp, H);
  for (const fn of S.defer) fn();
  S.defer = null;
  // courtyard walls: plain stucco with texture windows (seen only from inside the block)
  for (const hr of fp.holes) {
    for (let i = 0; i < hr.length; i++) {
      const f = frameOf(hr[i], hr[(i + 1) % hr.length]); if (!f) continue;
      const nb = Math.max(1, Math.round(f.L / 3.2));
      face(bufs[0], f, 0, f.L, base - 0.6, base + H - 0.9, 0, [FACADE.PUNCHED, -1, S.seed, enc(S.wallPbr, MODE.WALL)], S.body, S.body, [0, -0.2, nb, (H - 0.3) / 3.1]);
    }
  }
}

/** Floors: ground storey gH, the rest at ~fh up to `top` (all relative to the base). */
function floorsOf(top, gH, fh) {
  if (top < gH + fh * 0.8) return { gH: top, fh: top, n: 1, ys: [0, top] };
  const nUp = Math.max(1, Math.round((top - gH) / fh)), f = (top - gH) / nUp, ys = [0, gH];
  for (let k = 1; k <= nUp; k++) ys.push(gH + f * k);
  return { gH, fh: f, n: nUp + 1, ys };
}

/**
 * Shell walls of a ring: the openings recorded for each edge (S.openings, by ring edge index) are cut out, so the
 * windows sit in real reveals; per floor the stucco darkens towards the overhang above when `shade` says so.
 */
function walls(S, ring, src, edgeKind, y0, ys, opts) {
  // drawn after the facade elements in front of them (glass, eyebrows, slabs): the depth test then rejects the wall
  // fragments behind them instead of shading them twice
  if (S.defer) { S.defer.push(() => walls({ ...S, defer: null }, ring, src, edgeKind, y0, ys, opts)); return; }
  const [L0] = S.bufs;
  const n = ring.length;
  let per = 0;
  const info = opts.pbr != null ? [CL.WALL, Math.round(S.base * 20), S.seed, enc(opts.pbr, MODE.PLAIN)] : INFO.wall(S);
  const yTop = S.base + ys[ys.length - 1];
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const f = frameOf(a, b); if (!f) continue;
    const k = edgeKind(i);
    const wall = { u0: per, sg: 1, k: 1, ax: f.ax, az: f.az, dx: f.dx, dz: f.dz, gy: S.groundAt, ao: -1e4 };
    per += f.L;
    const body = opts.tint || S.body;
    // tint at height y: darker towards the top of a shaded floor
    const tintAt = (y) => {
      if (!opts.shade) return body;
      for (let j = 0; j + 1 < ys.length; j++) {
        const ya = S.base + ys[j], yb = S.base + ys[j + 1];
        if (y >= ya - 1e-3 && y <= yb + 1e-3) { if (!opts.shade(j, k)) return body; const t = Math.max(0, (y - ya) / (yb - ya)); return mixT(body, S.bodyShade, t * t); }
      }
      return body;
    };
    const ops = (S.openings && S.openings.get(i)) || [];
    const yb0 = opts.shade ? [y0, ...ys.slice(1, -1).map((v) => S.base + v), yTop] : [y0, yTop];
    void wall;
    for (let j = 0; j + 1 < yb0.length; j++) cutRect(L0, f, yb0[j], yb0[j + 1], ops, info, tintAt);
  }
}
const mixT = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
/** The wall rectangle [0, L] x [ya, yb] of edge f minus the openings: horizontal bands split round the openings. */
function cutRect(buf, f, ya, yb, ops, info, tintAt) {
  const ys = [ya, yb];
  for (const o of ops) { if (o.y0 > ya && o.y0 < yb) ys.push(o.y0); if (o.y1 > ya && o.y1 < yb) ys.push(o.y1); }
  ys.sort((p, q) => p - q);
  for (let j = 0; j + 1 < ys.length; j++) {
    const y0 = ys[j], y1 = ys[j + 1];
    if (y1 - y0 < 1e-3) continue;
    const cover = ops.filter((o) => o.y0 <= y0 + 1e-3 && o.y1 >= y1 - 1e-3).sort((p, q) => p.s0 - q.s0);
    let s = 0;
    const tA = tintAt(y0), tB = tintAt(y1);
    for (const o of cover) { if (o.s0 > s + 0.005) face(buf, f, s, o.s0, y0, y1, 0, info, tA, tB); s = Math.max(s, o.s1); }
    if (f.L > s + 0.005) face(buf, f, s, f.L, y0, y1, 0, info, tA, tB);
  }
}

function roofAndParapet(S, ring, yRoof, parH, capT) {
  const [L0] = S.bufs;
  S.P.helper.flatPolygon(L0, ring, S.B.fp.holes, yRoof, [CL.ROOF, -1, S.seed, enc(PBR.ROOF_TAR, MODE.PLAIN)], S.roofT, true);
  if (parH > 0.1) S.P.helper.parapet(L0, ring, yRoof, parH, INFO.wall(S), S.body, [CL.CONCRETE, -1, S.seed, enc(PBR.CONCRETE_PANEL, MODE.PLAIN)], capT || S.trim, true);
}

/** Edges of the shell ring with their kinds (arcs take the street kind of their corner's edges). */
function shellRing(S, fp, roundWhich, R) {
  const B = S.B;
  if (!roundWhich || !roundWhich.size) return { ring: fp.outer, kind: (i) => B.edges[i].kind, srcEdge: (i) => i, arc: () => false };
  const { ring, src } = roundRing(fp.outer, roundWhich, R, 3);
  const n0 = fp.outer.length;
  return {
    ring,
    srcEdge: (i) => src[i].v,
    arc: (i) => src[i].arc,
    kind: (i) => {
      if (!src[i].arc) return B.edges[src[i].v].kind;
      const a = B.edges[(src[i].v + n0 - 1) % n0].kind, b = B.edges[src[i].v].kind;
      return a === 'front' || b === 'front' ? 'street' : a === 'street' || b === 'street' ? 'street' : 'side';
    },
  };
}

function cornersToRound(S, fp, kinds, minEdge) {
  const B = S.B, n = fp.outer.length, set = new Set();
  for (let i = 0; i < n; i++) {
    const ea = B.edges[(i + n - 1) % n], eb = B.edges[i];
    if (!ea.f || !eb.f || ea.f.L < minEdge || eb.f.L < minEdge) continue;
    if (kinds.includes(ea.kind) && kinds.includes(eb.kind) && (ea.kind !== 'side' || eb.kind !== 'side')) set.add(i);
  }
  return set;
}

/** Window bays of a wall of length L: centres (s) of nb bays. */
function bays(L, bw, margin) {
  const use = L - 2 * margin;
  if (use < bw * 0.55) return [];
  const nb = Math.max(1, Math.round(use / bw)), w = use / nb, out = [];
  for (let k = 0; k < nb; k++) out.push(margin + w * (k + 0.5));
  return out;
}

/** A punched window: glass (some with blinds), at L2 a sill and a frame. */
/** Record an opening in the current edge's wall and line it with a reveal (jambs, head soffit, sill) d deep. */
function recess(S, f, s0, s1, y0, y1, d) {
  const L0 = S.bufs[0];
  if (S.P.lite) return; // phones: the glass sits on the wall (no cut, no reveal)
  if (S.openings && S.edgeI != null) { let a = S.openings.get(S.edgeI); if (!a) S.openings.set(S.edgeI, (a = [])); a.push({ s0, s1, y0, y1 }); }
  const wi = INFO.wall(S);
  quad4(L0, at(f, s0, y0, 0), at(f, s0, y0, -d), at(f, s0, y1, -d), at(f, s0, y1, 0), [f.dx, 0, f.dz], wi, S.bodyDark);
  quad4(L0, at(f, s1, y0, 0), at(f, s1, y0, -d), at(f, s1, y1, -d), at(f, s1, y1, 0), [-f.dx, 0, -f.dz], wi, S.bodyDark);
  quad4(L0, at(f, s0, y1, 0), at(f, s1, y1, 0), at(f, s1, y1, -d), at(f, s0, y1, -d), [0, -1, 0], wi, S.bodyShade);
  if (y0 - S.base < 1.6) quad4(L0, at(f, s0, y0, 0), at(f, s1, y0, 0), at(f, s1, y0, -d), at(f, s0, y0, -d), [0, 1, 0], wi, S.body); // (only seen from above eye height)
}
const CURTAINS = [[0.95, 0.93, 0.86], [0.88, 0.88, 0.85], [0.9, 0.84, 0.76], [0.8, 0.84, 0.78], [0.92, 0.84, 0.82], [0.72, 0.76, 0.8], [0.98, 0.97, 0.95], [0.96, 0.94, 0.9]];
/**
 * A window set into the wall: a reveal (recess), glass of the building type's kinds (deco: casement / jalousie /
 * awning, MiMo: slider / picture, bathroom: frosted), a frame with mullions and a sill (L1), and life behind it:
 * blinds at different drops, side curtains, an awning sash or a slider left open. Pane tint varies window to window.
 */
function windowAt(S, f, sc, w, y0, y1, fl, opt = {}) {
  const [L0, L1, L2] = S.bufs, r = S.r;
  const s0 = sc - w / 2, s1 = sc + w / 2, d = S.P.lite ? -0.03 : opt.depth ?? S.reveal ?? 0.18;
  recess(S, f, s0, s1, y0, y1, d);
  const kinds = opt.kinds || S.winKinds || ['casement'];
  const type = opt.type || pick(kinds, r());
  const gRaw = opt.glassRaw || S.glassRaw || [0.7, 0.78, 0.82], jt = 0.88 + r() * 0.24;
  const g = tb(gRaw.map((c, i) => c * jt * (i === 2 ? 0.97 + r() * 0.06 : 1)));
  const gO = -d + 0.03, fu = Math.floor(r() * 40) * 2;
  const frT = opt.frameT || S.frameT || S.trim, frI = INFO.trim(S, PBR.METAL);
  const life = r(), lk = r(), cc = tb(pick(CURTAINS, r()));
  if (type === 'bath') {
    face(L0, f, s0, s1, y0, y1, gO, INFO.trim(S), tb([0.84, 0.88, 0.88]));
  } else {
    let panes = type === 'casement' ? 2 : type === 'picture' ? 1 : type === 'slider' ? 2 : type === 'jalousie' ? 1 : 2;
    if (w > 1.7 && type === 'casement') panes = 3;
    // life behind the glass (in front of it by a hair, so the reflective pane does not hide it; emitted first so
    // the depth test spares the glass shading behind it)
    if (life < 0.2 && type !== 'slider') {
      const k = 0.12 + lk * lk * 0.7, ym = y1 - (y1 - y0) * k;
      face(L0, f, s0, s1, ym, y1, gO + 0.004, INFO.plain(PBR.FABRIC, S.seed), cc, mixT(cc, [255, 255, 255], 0.2));
    } else if (life < 0.42) {
      const cw = (s1 - s0) * (0.14 + lk * 0.22);
      face(L0, f, s0, s0 + cw, y0, y1, gO + 0.004, INFO.plain(PBR.FABRIC, S.seed), cc, cc);
      face(L0, f, s1 - cw * (0.6 + r() * 0.8), s1, y0, y1, gO + 0.004, INFO.plain(PBR.FABRIC, S.seed), cc, cc);
    }
    if (type === 'slider' && life < 0.18) {
      // a slider left half open: one pane slid behind the other, a curtain moving in the gap
      const sm = (s0 + s1) / 2;
      glass(L0, f, s0, sm, y0, y1, gO, 1, g, S.seed, w / 2, fu, fl, fl + 0.99);
      face(L0, f, sm, s1, y0, y1, gO - 0.35, INFO.plain(PBR.FABRIC, S.seed), cc, cc);
      quad4(L0, at(f, sm, y0, gO), at(f, sm, y0, gO - 0.35), at(f, sm, y1, gO - 0.35), at(f, sm, y1, gO), [-f.dx, 0, -f.dz], INFO.plain(PBR.PLAIN, S.seed), tb([0.2, 0.19, 0.18]));
    } else glass(L0, f, s0, s1, y0, y1, gO, 1, g, S.seed, (s1 - s0) / panes, fu, fl, fl + 0.99);
    // frame and mullions, the type's own parts (L2: further out the reveal carries the depth and the glass shader
    // draws the mullions)
    slab(L2, f, s0, s0 + 0.05, y0, y1, gO - 0.01, gO + 0.04, frI, frT, 'f');
    slab(L2, f, s1 - 0.05, s1, y0, y1, gO - 0.01, gO + 0.04, frI, frT, 'f');
    slab(L2, f, s0, s1, y1 - 0.06, y1, gO - 0.01, gO + 0.04, frI, frT, 'f');
    slab(L2, f, s0, s1, y0, y0 + 0.05, gO - 0.01, gO + 0.04, frI, frT, 'f');
    for (let q = 1; q < panes; q++) { const sm = s0 + ((s1 - s0) * q) / panes; slab(L2, f, sm - 0.025, sm + 0.025, y0, y1, gO - 0.01, gO + 0.04, frI, frT, 'f'); }
    if (type === 'jalousie') for (let y = y0 + 0.2; y < y1 - 0.08; y += 0.2) quad4(L2, at(f, s0 + 0.05, y - 0.05, gO + 0.005), at(f, s1 - 0.05, y - 0.05, gO + 0.005), at(f, s1 - 0.05, y, gO + 0.05), at(f, s0 + 0.05, y, gO + 0.05), norm([f.ox, 0.9, f.oz]), frI, frT, mixT(frT, [255, 255, 255], 0.3));
    if (type === 'awning' || type === 'picture') {
      const ym = y0 + (y1 - y0) * (type === 'awning' ? 0.55 : 0.78);
      slab(L2, f, s0, s1, ym - 0.03, ym + 0.03, gO - 0.01, gO + 0.04, frI, frT, 'f');
      if (type === 'awning' && lk > 0.65) {
        // the upper sash pushed open on its top hinge
        const yo = ym + 0.06 + (y1 - ym) * 0.1, o2 = gO + 0.28;
        quad4(L1, at(f, s0 + 0.06, yo, o2), at(f, s1 - 0.06, yo, o2), at(f, s1 - 0.06, y1 - 0.07, gO + 0.04), at(f, s0 + 0.06, y1 - 0.07, gO + 0.04), norm([f.ox, 0.75, f.oz]), INFO.glass(1, S.seed), g, g, [0, FV + fl, 2, FV + fl + 0.6]);
        slab(L2, f, s0 + 0.06, s1 - 0.06, yo - 0.04, yo, o2 - 0.03, o2 + 0.01, frI, frT, 'ftb');
      }
    }
  }
  if (opt.noTrim) return;
  // sill (L1 on the street faces) and the rain streak washing down from it
  slab(L2, f, s0 - 0.08, s1 + 0.08, y0 - 0.07, y0 + 0.02, -0.02, 0.09, INFO.conc(S), S.trim, 'tf');
}

/** A wall-mounted air-conditioner (L1: a small box that still reads at 150 m and breaks the window grid). */
function wallAC(S, f, s, y) {
  const L2 = S.bufs[1];
  slab(L2, f, s - 0.36, s + 0.36, y, y + 0.46, 0, 0.42, INFO.trim(S, PBR.METAL), tb([0.86, 0.86, 0.84]), 'tbfe', tb([0.5, 0.5, 0.5]));
  slab(L2, f, s - 0.3, s + 0.3, y - 0.06, y, 0.05, 0.3, INFO.plain(PBR.PLAIN, S.seed), S.dark, 'f');
  // rust / water staining run down from the bracket, the condensate pipe
  if (y - S.base > 1.5) face(L2, f, s - 0.22, s + 0.18, Math.max(S.base + 0.3, y - 1.6 - S.r() * 1.2), y, 0.005, INFO.wall(S), mixT(S.bodyStreak, [150, 110, 80], 0.15), S.body);
  slab(S.bufs[2], f, s + 0.3, s + 0.33, Math.max(S.base, y - 1.2), y + 0.05, 0.02, 0.05, INFO.trim(S, PBR.METAL), tb([0.9, 0.9, 0.88]), 'f');
}

/** Rooftop plant: lift / stair bulkhead, AC units, a water tank, railings. level 0 big things, 1 small. */
function roofPlant(S, ring, yRoof, area, opt = {}) {
  const [L0, L1, L2] = S.bufs, r = S.r, hp = S.P.helper;
  const bb = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const p of ring) grow(bb, p);
  const ang = longAngle(ring);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const fits = (cx, cz, hx, hz) => { for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz], [0, 0]]) { const qx = cx + x * ca - z * sa, qz = cz + x * sa + z * ca; if (!pointInRing(qx, qz, ring) || S.B.fp.holes.some((h) => pointInRing(qx, qz, h))) return false; } return true; };
  const place = (hx, hz) => { for (let t = 0; t < 10; t++) { const cx = bb.minX + r() * (bb.maxX - bb.minX), cz = bb.minZ + r() * (bb.maxZ - bb.minZ); if (fits(cx, cz, hx + 0.9, hz + 0.9)) return [cx, cz]; } return null; };
  const wallI = INFO.plain(S.wallPbr, S.seed), roofI = INFO.plain(PBR.ROOF_TAR, S.seed), metI = INFO.plain(PBR.METAL, S.seed);
  if (opt.bulkhead && area > 90) {
    const p = place(2.2, 1.8);
    if (p) {
      const bh = 3.0 + r() * 0.8;
      hp.box(L0, p[0], p[1], yRoof, 4.4, 3.6, bh, ang, wallI, opt.bulkT || S.body, roofI, S.roofT);
      // a door and a vent louvre on the bulkhead (L2)
      const f = frameOf([p[0] - 2.2 * ca + 1.8 * sa, p[1] - 2.2 * sa - 1.8 * ca], [p[0] + 2.2 * ca + 1.8 * sa, p[1] + 2.2 * sa - 1.8 * ca]);
      if (f) { face(L2, f, 0.6, 1.5, yRoof, yRoof + 2.1, 0.02, INFO.plain(PBR.METAL, S.seed), tb([0.55, 0.57, 0.58])); grate(L2, f, 2.4, 3.8, yRoof + 1.2, yRoof + 2.2, 0.02, 1, tb([0.6, 0.6, 0.6]), S.seed); }
    }
  }
  const nAC = Math.min(opt.maxAC ?? 6, Math.floor(area / 160) + 1);
  for (let k = 0; k < nAC; k++) {
    const sx = 1.0 + r() * 1.6, sz = 0.9 + r() * 1.1, sy = 0.9 + r() * 0.7;
    const p = place(sx / 2, sz / 2);
    if (!p) continue;
    hp.box(k < 1 ? L0 : L1, p[0], p[1], yRoof, sx + 0.5, sz + 0.5, 0.15, ang, [CL.CONCRETE, -1, S.seed, enc(PBR.CONCRETE_PANEL, MODE.PLAIN)], tb([0.8, 0.79, 0.76])); // the pad
    hp.box(k < 1 ? L0 : L1, p[0], p[1], yRoof + 0.15, sx, sz, sy, ang, INFO.trim(S, PBR.METAL), tb([0.82, 0.83, 0.82]), INFO.plain(PBR.PLAIN, S.seed), tb([0.32, 0.33, 0.34]));
    hp.cylinder(L2, p[0], p[1], yRoof + 0.15 + sy, Math.min(sx, sz) * 0.32, 0.06, 8, INFO.plain(PBR.PLAIN, S.seed), tb([0.2, 0.2, 0.21]));
    // refrigerant / condensate pipes running off across the roof on blocks
    const pl = 2 + r() * 4, px = p[0] + ca * (sx / 2 + pl / 2), pz = p[1] + sa * (sx / 2 + pl / 2);
    if (fits(px, pz, pl / 2 - 0.9, -0.8)) { hp.box(L2, px, pz, yRoof + 0.18, pl, 0.08, 0.08, ang, INFO.trim(S, PBR.METAL), tb([0.78, 0.55, 0.35])); hp.box(L2, px, pz + 0.12, yRoof + 0.18, pl, 0.06, 0.06, ang, INFO.trim(S, PBR.METAL), tb([0.2, 0.2, 0.2])); }
  }
  if (opt.tank && r() < opt.tank) {
    const rr = 1.0 + r() * 0.6, p = place(rr + 0.3, rr + 0.3);
    if (p) {
      for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) hp.box(L1, p[0] + lx * rr * 0.6, p[1] + lz * rr * 0.6, yRoof, 0.16, 0.16, 1.6, 0, metI, tb([0.3, 0.3, 0.31]));
      hp.cylinder(L1, p[0], p[1], yRoof + 1.6, rr, 2.2, 10, INFO.plain(PBR.METAL, S.seed), tb([0.86, 0.86, 0.84]), 'cone', 0.5, INFO.plain(PBR.METAL, S.seed), tb([0.7, 0.7, 0.7]));
    }
  }
  if (opt.antenna) {
    for (let k = 0; k < opt.antenna; k++) { const p = place(0.3, 0.3); if (p) hp.box(L1, p[0], p[1], yRoof, 0.25, 0.25, 6 + r() * 10, 0, metI, tb([0.7, 0.7, 0.72])); }
  }
  // a roof sign on a lattice frame, the hotel's name facing the street (lit at dusk)
  if (opt.sign && S.B.front >= 0) {
    const fe = S.B.edges[S.B.front].f, sw = Math.min(fe.L * 0.6, 9), sh = sw * 0.19 + 0.4;
    const g = { ...fe }, sc = fe.L / 2, out = -1.6, yb = yRoof + 1.1;
    const mi = INFO.trim(S, PBR.METAL), mt = tb([0.32, 0.33, 0.34]);
    for (const k of [-0.45, -0.15, 0.15, 0.45]) { slab(L1, g, sc + k * sw - 0.05, sc + k * sw + 0.05, yRoof, yb + sh, out - 0.25, out - 0.15, mi, mt, 'fe'); slab(L1, g, sc + k * sw - 0.04, sc + k * sw + 0.04, yRoof, yb + 0.1, out - 1.4, out - 0.25, mi, mt, 'te'); }
    slab(L1, g, sc - sw / 2, sc + sw / 2, yb - 0.08, yb, out - 0.25, out - 0.15, mi, mt, 'tfb');
    slab(L0, g, sc - sw / 2, sc + sw / 2, yb, yb + sh, out - 0.14, out - 0.05, INFO.trim(S), tb([0.9, 0.9, 0.88]), 'te');
    signBoard(S, g, sc - sw / 2, sc + sw / 2, yb, yb + sh, out, 1, true, 0.16);
  }
  // vent stacks (L2)
  for (let k = 0; k < 3; k++) { const p = place(0.2, 0.2); if (p) hp.cylinder(L2, p[0], p[1], yRoof, 0.12, 0.8 + r() * 0.6, 6, metI, tb([0.6, 0.6, 0.6])); }
}
function longAngle(ring) {
  let best = 0, L = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > L) { L = l; best = Math.atan2(b[1] - a[1], b[0] - a[0]); } }
  return best;
}
/** Roof-deck railing round a ring (inset), L1. */
function roofRail(S, ring, y, inset, tint) {
  const R = insetRing(ring, inset);
  if (!R) return;
  for (let i = 0; i < R.length; i++) { const f = frameOf(R[i], R[(i + 1) % R.length]); if (f && f.L > 0.5) railing(S, f, 0, f.L, y, 0.06, 'pickets', tint); }
}

// ================================================================== Art Deco hotel
function buildDeco(S, fp, H) {
  const { r, base, B } = S;
  const [L0, L1, L2] = S.bufs;
  const parH = H > 9 ? 0.9 + r() * 0.6 : 0.7;
  const top = H - parH;
  const F = floorsOf(top, Math.min(4.2, top), 3.1 + r() * 0.2);
  const roundR = 1.6 + r() * 1.4;
  const roundSet = r() < 0.75 ? cornersToRound(S, fp, ['front', 'street', 'side'], 6) : new Set();
  const SR = shellRing(S, fp, roundSet, roundR);
  const ring = SR.ring, n = ring.length;
  const eyebrowMode = r() < 0.5 ? 'band' : 'window';      // continuous bands wrapping the corners, or one per window
  const cornerRibbon = roundSet.size && r() < 0.55;        // ribbon windows round the rounded corners
  const winW = 1.3 + r() * 0.6, pair = r() < 0.3, winH = 1.45 + r() * 0.25, sill = 0.85;
  const stripes = r() < 0.6, stripeY = r() < 0.5 ? 'top' : 'first';
  const ebDepth = 0.45 + r() * 0.3;
  const pylon = r() < 0.7 || B.onOcean;
  const groundShop = !B.onOcean && r() < 0.45;
  if (S.far) { farShell(S, fp, H, { F, top, parH, SR: { ring: fp.outer, kind: (i) => B.edges[i].kind, arc: () => false }, layer: pair ? FACADE.PAIR : winW > 1.6 ? FACADE.PUNCHED : FACADE.SMALL, bw: pair ? 3.4 : 3.1, bands: (k) => k === 'front' || k === 'street', store: (k) => (k === 'front' && !B.onOcean) || (groundShop && k === 'street'), pylon, ribbon: cornerRibbon, ebDepth, wf: (pair ? 2.0 : winW) / (pair ? 3.4 : 3.1), hf: winH / Math.max(2.6, F.fh) }); return; }
  // walls: darker just under each eyebrow / band (the overhang's shade), the ground storey plain
  walls(S, ring, null, SR.kind, base - 0.6, [...F.ys.slice(0, -1), H], { shade: (j, k) => j >= 1 && k !== 'party' && eyebrowMode === 'band' && j < F.n });
  roofAndParapet(S, ring, base + top, parH, S.trim);
  // corner parapet steps (small raised blocks at the rounded corners)
  const frontE = B.front >= 0 ? B.edges[B.front].f : null;
  let pylonS = null;
  for (let i = 0; i < n; i++) {
    const f = frameOf(ring[i], ring[(i + 1) % n]);
    if (!f) continue;
    const k = SR.kind(i), arc = SR.arc(i);
    S.edgeI = i;
    if (k === 'party') continue;
    const isFront = k === 'front';
    // break the grid: this face's own window width, a stair bay of glass block on some side faces
    const faceW = Math.min(winW * (k === 'side' ? 0.8 + r() * 0.35 : 1), f.L - 0.8);
    const csAll = arc || f.L < 2.2 ? [] : bays(f.L, pair ? 3.4 : 3.1, 0.7);
    const stairI = k === 'side' && csAll.length >= 3 && F.n >= 3 && r() < 0.55 ? 1 + Math.floor(r() * (csAll.length - 2)) : -1;
    const street = k === 'street' || isFront;
    // front: pylon zone at the middle of the footprint's front edge
    let pz = null;
    if (isFront && frontE && pylon && frontE.L >= 11) {
      const sc = (frontE.mx - f.ax) * f.dx + (frontE.mz - f.az) * f.dz;
      pz = [sc - 1.3, sc + 1.3]; pylonS = { f, sc };
    }
    // ---- per floor
    for (let j = 1; j < F.n; j++) {
      const fy = base + F.ys[j], y0 = fy + sill * (F.fh / 3.1), y1 = Math.min(y0 + winH, base + F.ys[j + 1] - 0.35);
      if (arc) {
        if (cornerRibbon) glass(L0, f, 0, f.L, y0, y1, 0.03, 1, S.glassT, S.seed, 0.9, j * 7, j, j + 0.99);
        if (eyebrowMode === 'band' && street) slab(L0, f, -0.02, f.L + 0.02, y1 + 0.12, y1 + 0.24, 0, ebDepth, INFO.conc(S), S.trim, 'bf', S.bodyShade);
        continue;
      }
      if (f.L < 2.2) continue;
      const cs = csAll;
      for (let bi = 0; bi < cs.length; bi++) {
        const sc = cs[bi];
        if (pz && sc > pz[0] - 0.6 && sc < pz[1] + 0.6) continue;
        if (bi === stairI) continue;
        const roll = r();
        if (roll < 0.05 && !street) continue; // a blank bay
        if (roll < 0.15 && !street) { windowAt(S, f, sc, 0.6, y1 - 0.65, y1, j, { type: 'bath' }); continue; } // a bathroom
        if (pair) { windowAt(S, f, sc - 0.55, 0.8, y0, y1, j, { street }); windowAt(S, f, sc + 0.55, 0.8, y0, y1, j, { street }); }
        else windowAt(S, f, sc, faceW, y0, y1, j, { street });
        if (eyebrowMode === 'window' && (street || r() < 0.4)) {
          const w = (pair ? 2.0 : faceW) + 0.5;
          slab(L0, f, sc - w / 2, sc + w / 2, y1 + 0.1, y1 + 0.22, 0, ebDepth, INFO.conc(S), S.trim, 'bf', S.bodyShade);
        }
        if (r() < (street ? 0.12 : 0.3)) wallAC(S, f, sc + (r() - 0.5) * 0.4, y0 - 0.55);
      }
      if (eyebrowMode === 'band' && (street || k === 'side')) {
        if (pz) { slab(L0, f, -0.02, pz[0], y1 + 0.12, y1 + 0.24, 0, ebDepth, INFO.conc(S), S.trim, 'bfe', S.bodyShade); slab(L0, f, pz[1], f.L + 0.02, y1 + 0.12, y1 + 0.24, 0, ebDepth, INFO.conc(S), S.trim, 'bfe', S.bodyShade); }
        else slab(L0, f, -0.02, f.L + 0.02, y1 + 0.12, y1 + 0.24, 0, ebDepth, INFO.conc(S), S.trim, street ? 'bf' : 'bfe', S.bodyShade);
      }
    }
    // the stair: a glass-block strip up the stair bay
    if (stairI >= 0) { const sc = csAll[stairI], y0 = base + F.ys[1] + 0.5, y1 = base + top - 0.7; recess(S, f, sc - 0.5, sc + 0.5, y0, y1, 0.12); face(L0, f, sc - 0.5, sc + 0.5, y0, y1, -0.1, [CL.GLASSBLOCK, -1, S.seed, enc(PBR.PLAIN, MODE.PLAIN)], S.trim, S.trim); }
    // ---- racing stripes (three thin painted bands, a hair proud, crisp) on street faces, wrapping the corners
    if (stripes && (street || arc)) {
      const ys = stripeY === 'top' ? base + top - 0.95 : base + F.gH + 0.15;
      for (let q = 0; q < 3; q++) slab(q === 0 ? L0 : L1, f, -0.01, f.L + 0.01, ys + q * 0.22, ys + q * 0.22 + 0.09, 0, 0.025, INFO.trim(S), S.accent, 'ftb');
    }
    // ---- ground storey
    if (!arc && f.L >= 2.5) {
      const gy = base, gH = F.gH;
      if (isFront && B.onOcean) decoPorch(S, f, gH, pz);
      else if (street && (groundShop || isFront)) shopfront(S, f, gH, isFront && !groundShop);
      else if (k !== 'party') {
        const gb = bays(f.L, 3.4, 0.8), door = k === 'side' && gb.length >= 2 && r() < 0.6 ? Math.floor(r() * gb.length) : -1;
        gb.forEach((sc, q) => { if (q === door) serviceDoor(S, f, sc); else if (r() < 0.8) windowAt(S, f, sc, 1.3, gy + 0.9, gy + Math.min(gH - 0.5, 2.6), 0, { street }); });
        if (k === 'side' || k === 'street') baseDetail(S, f, gb, door);
      }
    }
    // a downpipe at the end of some faces (L2)
    if (!arc && f.L > 4 && r() < 0.35) slab(L2, f, f.L - 0.35, f.L - 0.25, base, base + top, 0.02, 0.12, INFO.plain(PBR.METAL, S.seed), tb([0.8, 0.8, 0.78]), 'fe');
  }
  // ---- pylon: a stepped central fin above the entrance, grooves and portholes, rising above the parapet
  if (pylonS) {
    const { f, sc } = pylonS;
    const yb = base + F.gH + (B.onOcean ? 0.2 : 0), yt = base + H + (B.onOcean ? 0.15 : 1.8 + r() * 1.6);
    const pT = B.pastel ? S.trim : S.accent, pI = INFO.wall(S);
    const gBlock = r() < 0.4;
    slab(L0, f, sc - 1.25, sc + 1.25, yb, yt, 0, 0.38, pI, pT, 'tfe');
    for (const dx of [-0.55, 0, 0.55]) slab(L1, f, sc + dx - 0.07, sc + dx + 0.07, yb + 0.5, yt - 0.4, 0.38, 0.5, pI, pT, 'tfe');
    // portholes (octagons of glass) down the pylon on its sides (L0), with rings (L2)
    if (gBlock) for (const side of [-1, 1]) face(L0, f, sc + side * 0.95 - 0.22, sc + side * 0.95 + 0.22, yb + 0.6, yt - 1.2, 0.395, [CL.GLASSBLOCK, -1, S.seed, enc(PBR.PLAIN, MODE.PLAIN)], S.trim, S.trim);
    const nP = gBlock ? 0 : Math.max(1, Math.min(4, F.n - 1));
    for (let q = 0; q < nP; q++) {
      const cy = base + F.ys[q + 1] + F.fh * 0.55;
      for (const side of [-1, 1]) {
        const cx = sc + side * 0.95, pts = [], uvs = [];
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; pts.push(at(f, cx + Math.cos(a) * 0.28, cy + Math.sin(a) * 0.28, 0.4)); uvs.push([0.5 + Math.cos(a) * 0.35, FV + q + 0.5 + Math.sin(a) * 0.35]); }
        polyV(L0, pts, [f.ox, 0, f.oz], INFO.glass(1, S.seed), S.glassT, uvs);
        for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2 + Math.PI / 8, a1 = ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8; quad4(L1, at(f, cx + Math.cos(a0) * 0.28, cy + Math.sin(a0) * 0.28, 0.41), at(f, cx + Math.cos(a1) * 0.28, cy + Math.sin(a1) * 0.28, 0.41), at(f, cx + Math.cos(a1) * 0.36, cy + Math.sin(a1) * 0.36, 0.43), at(f, cx + Math.cos(a0) * 0.36, cy + Math.sin(a0) * 0.36, 0.43), [f.ox, 0, f.oz], INFO.plain(PBR.PLAIN, S.seed), S.trim); }
      }
    }
    // the stepped crown of the pylon (three setbacks), as world.js puts its neon on the top step for the Ocean fronts
    const fe = B.onOcean ? B.edges[B.front].f : null;
    if (fe) {
      const g = { ...fe }, w0 = Math.min(fe.L * 0.5, 8);
      const scF = fe.L / 2;
      for (let k = 0; k < 3; k++) { const w = w0 * (1 - k * 0.28); slab(L0, g, scF - w / 2, scF + w / 2, base + H + 0.15 + k * 0.7, base + H + 0.85 + k * 0.7, -0.1, 0.4, pI, k === 1 ? S.accent : S.trim, 'tbfe'); }
    } else {
      for (let k = 0; k < 2; k++) slab(L0, f, sc - 1.25 + (k + 1) * 0.3, sc + 1.25 - (k + 1) * 0.3, yt + k * 0.6, yt + (k + 1) * 0.6, 0, 0.38 - (k + 1) * 0.08, pI, pT, 'tfe');
    }
  }
  // ---- corner parapet blocks at rounded corners (stepped)
  if (roundSet.size) for (const vi of roundSet) {
    const p = fp.outer[vi];
    const c = fp.c, dx = c[0] - p[0], dz = c[1] - p[1], l = Math.hypot(dx, dz) || 1;
    if (r() < 0.5) S.P.helper.box(L1, p[0] + dx / l * roundR * 0.9, p[1] + dz / l * roundR * 0.9, base + H, 1.2, 1.2, 0.7, Math.atan2(dz, dx), INFO.plain(S.wallPbr, S.seed), S.trim);
  }
  roofPlant(S, ring, base + top, fp.area, { bulkhead: F.n >= 3, tank: 0.25, maxAC: 4, sign: H >= 9 && r() < 0.22 });
  void L0; void L1; void L2;
}

/** Record an opening (no reveal: an entrance or a garage mouth lines its own sides). */
function opening(S, s0, s1, y0, y1) {
  if (!S.openings || S.edgeI == null) return;
  let a = S.openings.get(S.edgeI); if (!a) S.openings.set(S.edgeI, (a = [])); a.push({ s0, s1, y0, y1 });
}
/** Box against the wall frame f at s (centre), out (centre), y: sx along, sz out, sy up. */
function boxF(buf, S, f, s, out, y, sx, sz, sy, info, tint, topInfo = null, topTint = null) {
  const p = at(f, s, 0, out);
  S.P.helper.box(buf, p[0], p[2], y, sx, sz, sy, Math.atan2(f.dz, f.dx), info, tint, topInfo, topTint);
}
const WOOD = [0.42, 0.28, 0.18], TERRAZZO = [0.93, 0.89, 0.82];
/** A plastic / rattan chair facing `face` (+1 out of the wall, -1 in). */
function chair(buf, S, f, s, out, y, col, facing = 1) {
  const c = tb(col);
  boxF(buf, S, f, s, out, y + 0.02, 0.44, 0.44, 0.42, INFO.trim(S), mixT(c, [0, 0, 0], 0.25), INFO.trim(S), c); // seat on its legs (a darker block)
  boxF(buf, S, f, s, out - facing * 0.2, y + 0.44, 0.44, 0.05, 0.42, INFO.trim(S), c);
}
function table(buf, S, f, s, out, y, col) {
  const p = at(f, s, 0, out), c = tb(col);
  S.P.helper.cylinder(buf, p[0], p[2], y + 0.7, 0.36, 0.04, 6, INFO.trim(S), c);
  S.P.helper.cylinder(buf, p[0], p[2], y, 0.04, 0.7, 5, INFO.plain(PBR.METAL, S.seed), tb([0.25, 0.25, 0.26]));
}
function pottedPlant(buf, S, f, s, out, y, big = false) {
  const p = at(f, s, 0, out), k = big ? 1.6 : 1;
  S.P.helper.cylinder(buf, p[0], p[2], y, 0.2 * k, 0.36 * k, 7, INFO.plain(PBR.CONCRETE_PANEL, S.seed), tb([0.72, 0.42, 0.3]));
  S.P.helper.cylinder(buf, p[0], p[2], y + 0.36 * k, 0.34 * k, 0.42 * k, 7, INFO.plain(PBR.GRASS, S.seed), tb([0.55, 0.72, 0.42]));
  S.P.helper.cylinder(buf, p[0], p[2], y + 0.78 * k, 0.24 * k, 0.22 * k, 7, INFO.plain(PBR.GRASS, S.seed), tb([0.6, 0.76, 0.46]));
}
/**
 * A hotel entrance you could walk into: the opening (sc +- w/2, up to yTop) shows a lobby room (terrazzo floor,
 * ceiling, back wall with the hotel's name, a reception desk, armchairs, a potted palm, pendant lights), framed by
 * mullions with a pair of doors (pulls), a step and terrazzo landing outside, uplights either side.
 */
function entrance(S, f, sc, w, yTop, opt = {}) {
  const [L0, L1, L2] = S.bufs, base = S.base, r = S.r;
  if (S.P.lite) { glass(L0, f, sc - w / 2, sc + w / 2, base + 0.1, yTop, 0.03, 1, tb([0.6, 0.64, 0.66]), S.seed, 1.3, 0, 0, 0.99); return; } // phones: glazing
  const s0 = sc - w / 2, s1 = sc + w / 2, D = 4.6, yF = base + 0.15, yC = yTop + 0.2;
  opening(S, s0, s1, base - 0.6, yTop);
  // the room (L0: a hole must never show the inside of the shell)
  const floorI = [CL.TRIM, -1, S.seed, enc(PBR.GRANITE, MODE.PLAIN)];
  quad4(L0, at(f, s0, yF, 0), at(f, s1, yF, 0), at(f, s1, yF, -D), at(f, s0, yF, -D), [0, 1, 0], floorI, tb(TERRAZZO));
  quad4(L0, at(f, s0, yC, 0), at(f, s1, yC, 0), at(f, s1, yC, -D), at(f, s0, yC, -D), [0, -1, 0], INFO.trim(S), tb([0.95, 0.94, 0.9]));
  face(L0, f, s0, s1, yF, yC, -D, INFO.wall(S), mixT(S.body, [255, 250, 240], 0.4), mixT(S.body, [255, 250, 240], 0.4));
  quad4(L0, at(f, s0, yF, 0), at(f, s0, yF, -D), at(f, s0, yC, -D), at(f, s0, yC, 0), [f.dx, 0, f.dz], INFO.wall(S), S.bodyDark);
  quad4(L0, at(f, s1, yF, 0), at(f, s1, yF, -D), at(f, s1, yC, -D), at(f, s1, yC, 0), [-f.dx, 0, -f.dz], INFO.wall(S), S.bodyDark);
  face(L0, f, s0, s1, yTop, yC, -0.02, INFO.wall(S), S.bodyShade, S.bodyShade); // the soffit lip over the doors
  // the hotel's name on the back wall, a desk, chairs, a palm, pendant lights
  if (opt.shop) {
    // a shop: shelving along the back and sides, a display table with goods, a counter, a rail of clothes
    const sh = tb(pick([[0.95, 0.94, 0.9], [0.42, 0.3, 0.22], [0.2, 0.2, 0.22]], r()));
    boxF(L1, S, f, sc, -D + 0.3, yF, w - 0.4, 0.5, 2.1, INFO.trim(S), sh);
    for (let q = 0; q < 4; q++) boxF(L2, S, f, sc, -D + 0.56, yF + 0.45 + q * 0.42, w - 0.6, 0.06, 0.3, INFO.trim(S), tb(pick(TOWELS, r())));
    boxF(L1, S, f, sc - w * 0.18, -2.0, yF, 1.6, 0.9, 0.8, INFO.trim(S), tb(WOOD), INFO.trim(S), tb([0.92, 0.9, 0.86]));
    for (let q = 0; q < 5; q++) boxF(L2, S, f, sc - w * 0.18 - 0.6 + q * 0.3, -2.0, yF + 0.8, 0.2, 0.25 + r() * 0.2, 0.12 + r() * 0.25, INFO.trim(S), tb(pick(TOWELS, r())));
    boxF(L1, S, f, s1 - 1.0, -3.2, yF, 1.4, 0.6, 1.0, INFO.trim(S), sh);
    for (let q = 0; q < 6; q++) boxF(L2, S, f, sc + w * 0.2 - 0.6 + q * 0.22, -1.2, yF + 0.4, 0.12, 0.45, 1.0, INFO.plain(PBR.FABRIC, S.seed), tb(pick(CURTAINS.concat(TOWELS), r())));
  } else {
    signBoard(S, f, sc - Math.min(1.6, w * 0.3), sc + Math.min(1.6, w * 0.3), yTop - 1.0, yTop - 0.55, -D + 0.03, 0);
    boxF(L1, S, f, sc, -D + 1.1, yF, Math.min(2.6, w * 0.45), 0.7, 1.05, INFO.trim(S), tb(WOOD), INFO.trim(S), tb([0.9, 0.88, 0.84]));
    for (const k of [-1, 1]) chair(L2, S, f, sc + k * w * 0.32, -1.6, yF, r() < 0.5 ? [0.85, 0.5, 0.42] : [0.3, 0.52, 0.5], 1);
    table(L2, S, f, sc - w * 0.32 + 0.7, -1.6, yF, [0.95, 0.93, 0.88]);
    pottedPlant(L2, S, f, s0 + 0.5, -0.7, yF, true);
    pottedPlant(L2, S, f, s1 - 0.5, -0.7, yF, true);
  }
  for (const k of [-0.3, 0, 0.3]) { const p = at(f, sc + k * w, 0, -2.2); S.P.helper.cylinder(L1, p[0], p[2], yC - 0.75, 0.22, 0.3, 8, INFO.led(S.seed), tb([1, 0.92, 0.75]), 'flat', 0, INFO.led(S.seed), tb([1, 0.92, 0.75])); }
  // the frontage: mullions, a transom, the door pair in the middle with pulls
  const frI = INFO.trim(S, PBR.METAL), frT = opt.frameT || tb([0.72, 0.66, 0.5]);
  const nm = Math.max(2, Math.round(w / 1.3));
  for (let q = 0; q <= nm; q++) { const sm = s0 + (w * q) / nm; slab(L1, f, sm - 0.04, sm + 0.04, base, yTop, -0.06, 0.02, frI, frT, 'fe'); }
  slab(L1, f, s0, s1, yTop - 0.55, yTop - 0.48, -0.06, 0.02, frI, frT, 'fbt');
  for (const k of [-0.32, 0.32]) slab(L2, f, sc + k - 0.02, sc + k + 0.02, base + 0.9, base + 1.4, 0.02, 0.07, frI, tb([0.82, 0.74, 0.52]), 'fe');
  // step and landing, uplights
  slab(L1, f, s0 - 0.3, s1 + 0.3, base - 0.2, base + 0.15, 0, 1.3, floorI, tb(TERRAZZO), 'tfe');
  slab(L1, f, s0 - 0.1, s1 + 0.1, base - 0.2, base + 0.0, 1.3, 1.65, INFO.conc(S), tb([0.86, 0.84, 0.8]), 'tfe');
  for (const k of [s0 - 0.25, s1 + 0.25]) face(L1, f, k - 0.08, k + 0.08, base + 0.15, base + 0.3, 0.06, INFO.led(S.seed), tb([1, 0.9, 0.7]), tb([1, 0.9, 0.7]), [0.25, 0.4, 0.45, 0.6]);
}

/** Ocean Drive porch: a slab on round columns 2.2 m out, a stucco terrace balustrade, the entrance, café tables. */
function decoPorch(S, f, gH, pz) {
  const [L0, L1, L2] = S.bufs, r = S.r, base = S.base;
  const yS = base + gH - 0.55;
  slab(L0, f, 0.3, f.L - 0.3, yS, yS + 0.28, 0, 2.3, INFO.conc(S), S.trim, 'tbfe', tb([0.78, 0.76, 0.72]));
  slab(L1, f, 0.3, f.L - 0.3, yS + 0.05, yS + 0.14, 2.3, 2.33, INFO.trim(S), S.accent, 'ftb'); // fascia stripe
  const nCol = Math.max(2, Math.round((f.L - 0.8) / 3.2)), cols = [];
  for (let k = 0; k <= nCol; k++) {
    const s = 0.55 + (f.L - 1.1) * (k / nCol), p = at(f, s, 0, 2.0); cols.push(s);
    S.P.helper.cylinder(L1, p[0], p[2], base, 0.16, yS - base, 8, INFO.trim(S), S.trim);
    face(L2, f, s - 0.07, s + 0.07, base + 0.02, base + 0.14, 2.17, INFO.led(S.seed), tb([1, 0.9, 0.7]), tb([1, 0.9, 0.7]), [0.25, 0.4, 0.45, 0.6]); // uplight
  }
  railing(S, f, 0.4, f.L - 0.4, yS + 0.28, 2.3, 'solid', S.body);
  slab(L1, f, 0.4, f.L - 0.4, yS + 0.75, yS + 0.84, 2.3, 2.325, INFO.trim(S), S.accent, 'ftb');
  // the entrance in the middle, big windows either side under the porch
  const doorS = pz ? (pz[0] + pz[1]) / 2 : f.L / 2, ew = Math.min(6, f.L * 0.38);
  entrance(S, f, doorS, ew, yS - 0.35, {});
  for (const sc of bays(f.L, 3.0, 0.7)) if (Math.abs(sc - doorS) > ew / 2 + 1.1) windowAt(S, f, sc, 1.9, base + 0.7, yS - 0.45, 0, { street: true, type: 'casement', depth: 0.2 });
  // café tables under the porch
  for (let k = 0; k < nCol; k++) {
    const s = (cols[k] + cols[k + 1]) / 2;
    if (Math.abs(s - doorS) < ew / 2 + 0.8 || r() < 0.3) continue;
    table(L2, S, f, s, 1.25, base, [0.95, 0.95, 0.93]);
    chair(L2, S, f, s - 0.6, 1.25, base, [0.95, 0.95, 0.93], 1); chair(L2, S, f, s + 0.6, 1.25, base, [0.95, 0.95, 0.93], 1);
  }
  // planters at the ends
  for (const s of [0.9, f.L - 0.9]) {
    slab(L1, f, s - 0.4, s + 0.4, base, base + 0.6, 2.4, 3.1, INFO.conc(S), S.trim, 'tfe');
    slab(L1, f, s - 0.34, s + 0.34, base + 0.6, base + 0.72, 2.46, 3.04, INFO.plain(PBR.GRASS, S.seed), tb([0.55, 0.72, 0.45]), 't');
    pottedPlant(L2, S, f, s, 2.75, base + 0.6);
  }
  void L0;
}

/** A service door on a side wall: recessed steel door, frame, a step, an electricity meter and a pipe (L1 / L2). */
function serviceDoor(S, f, sc) {
  const [L0, L1, L2] = S.bufs, base = S.base;
  recess(S, f, sc - 0.5, sc + 0.5, base, base + 2.2, 0.12);
  face(L0, f, sc - 0.5, sc + 0.5, base, base + 2.2, -0.11, INFO.trim(S, PBR.METAL), tb(pick([[0.55, 0.6, 0.6], [0.35, 0.42, 0.45], [0.8, 0.78, 0.72]], S.r())));
  slab(L1, f, sc - 0.6, sc + 0.6, base - 0.1, base + 0.12, 0, 0.45, INFO.conc(S), tb([0.8, 0.79, 0.76]), 'tfe');
  slab(L2, f, sc + 0.75, sc + 1.15, base + 1.1, base + 1.65, 0, 0.18, INFO.trim(S, PBR.METAL), tb([0.7, 0.72, 0.7]), 'tbfe');
  slab(L2, f, sc + 1.3, sc + 1.36, base, base + 2.6, 0.03, 0.09, INFO.trim(S, PBR.METAL), tb([0.85, 0.8, 0.4]), 'fe');
  face(L1, f, sc - 0.12, sc + 0.12, base + 2.35, base + 2.5, 0.04, INFO.led(S.seed), tb([1, 0.9, 0.7]), tb([1, 0.9, 0.7]), [0.25, 0.4, 0.45, 0.6]);
}
/** Planting and services along the base of a wall: hedges between the openings, a gas meter and pipe (L1 / L2). */
function baseDetail(S, f, gb, door) {
  const [, L1, L2] = S.bufs, base = S.base, r = S.r;
  if (r() < 0.6) {
    const hT = tb(pick([[0.5, 0.68, 0.38], [0.56, 0.72, 0.42], [0.46, 0.64, 0.4]], r()));
    gb.forEach((sc, q) => { if (q === door) return; const s0 = Math.max(0.3, sc - 1.2), s1 = Math.min(f.L - 0.3, sc + 1.2); slab(L1, f, s0, s1, base, base + 0.75 + r() * 0.3, 0, 0.75, INFO.plain(PBR.GRASS, S.seed), hT, 'tfe'); });
  }
  if (r() < 0.5) { const s = f.L * (0.15 + r() * 0.7); slab(L2, f, s - 0.03, s + 0.03, base, base + 1.4, 0.02, 0.08, INFO.trim(S, PBR.METAL), tb([0.8, 0.75, 0.3]), 'fe'); slab(L2, f, s + 0.08, s + 0.38, base + 0.7, base + 1.0, 0, 0.2, INFO.trim(S, PBR.METAL), tb([0.75, 0.76, 0.74]), 'tfe'); }
}

/** Shopfront: glazing in bays between piers, a bulkhead, a lit signage band and striped awnings. */
function shopfront(S, f, gH, lobby) {
  const [L0, L1, L2] = S.bufs, r = S.r, base = S.base;
  const gTop = base + Math.min(gH - 0.9, 3.2), sTop = base + Math.min(gH - 0.1, gTop - base + 0.85);
  const glassT = tb(r() < 0.5 ? [0.5, 0.5, 0.46] : [0.44, 0.5, 0.52]);
  const bayW = 2.2 + r() * 0.8; r();
  if (lobby) { const ew = Math.min(f.L * 0.4, 6); entrance(S, f, f.L / 2, ew, gTop - 0.1, {}); for (const sc of bays(f.L, 3.0, 0.6)) if (Math.abs(sc - f.L / 2) > ew / 2 + 1.0) windowAt(S, f, sc, 1.7, base + 0.8, gTop - 0.2, 0, { street: true, glassRaw: [0.6, 0.66, 0.68] }); void glassT; }
  else storefront(L0, S, f, 0.4, f.L - 0.4, gTop, bayW, S.body);
  const np = Math.max(1, Math.round(f.L / 4.2));
  if (!lobby) {
    slab(L1, f, 0.35, f.L - 0.35, base, base + 0.45, 0, 0.06, INFO.conc(S), S.trim, 'tf'); // bulkhead
    // piers every ~4 m
    for (let k = 0; k <= np; k++) { const s = 0.4 + (f.L - 0.8) * (k / np); slab(L1, f, s - 0.18, s + 0.18, base, gTop, 0, 0.1, INFO.wall(S), S.body, 'fe'); }
  }
  if (!lobby) {
    // sign band (lit lettering) and awnings
    if (r() < 0.75) { const bw = Math.min(f.L - 1.2, (sTop - gTop) * 5.3); slab(L0, f, f.L / 2 - bw / 2 - 0.05, f.L / 2 + bw / 2 + 0.05, gTop + 0.05, sTop - 0.02, 0, 0.06, INFO.trim(S), tb([0.2, 0.2, 0.22]), 'tbe'); signBoard(S, f, f.L / 2 - bw / 2, f.L / 2 + bw / 2, gTop + 0.08, sTop - 0.05, 0.065, S.B.seed % 2); }
    if (r() < 0.7) {
      const aw = tb(pick(AWNING, r())), stripes = r() < 0.6, d = 1.3 + r() * 0.5;
      for (let k = 0; k < np; k++) {
        const s0 = 0.4 + (f.L - 0.8) * (k / np) + 0.25, s1 = 0.4 + (f.L - 0.8) * ((k + 1) / np) - 0.25;
        const yA = gTop - 0.02, yB = gTop - 0.65;
        quad4(L0, at(f, s0, yA, 0.05), at(f, s1, yA, 0.05), at(f, s1, yB, d), at(f, s0, yB, d), norm([f.ox * 0.45, 0.9, f.oz * 0.45]), INFO.awning(stripes, S.seed), aw, aw, [s0, 0, s1, 1]);
        face(L0, f, s0, s1, yB - 0.25, yB, d, INFO.awning(stripes, S.seed), aw, aw, [s0, 0, s1, 1]);
        quad4(L1, at(f, s0, yA, 0.05), at(f, s0, yB, d), at(f, s0, yB - 0.25, d), at(f, s0, yB - 0.25, d - 0.01), [-f.dx, 0, -f.dz], INFO.awning(stripes, S.seed), aw);
      }
    }
  } else {
    // a canopy over the hotel entrance with the name on its fascia
    const sc = f.L / 2, cw = Math.min(f.L * 0.45, 7);
    slab(L0, f, sc - cw / 2, sc + cw / 2, gTop + 0.1, gTop + 0.42, 0, 2.6, INFO.conc(S), S.trim, 'tbfe', tb([0.7, 0.7, 0.68]));
    signBoard(S, f, sc - cw * 0.4, sc + cw * 0.4, gTop + 0.13, gTop + 0.39, 2.61, 0);
    for (const k of [-0.25, 0, 0.25]) { const p = at(f, sc + k * cw, 0, 1.4); S.P.helper.cylinder(L1, p[0], p[2], gTop + 0.02, 0.12, 0.08, 6, INFO.led(S.seed), tb([1, 0.92, 0.75])); }
  }
  // a door (L2)
  const ds = f.L * (0.25 + r() * 0.5);
  void ds; // (the storefront layer draws the door)
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ================================================================== far shell (deco / mimo beyond ~330 m)
/**
 * The far version of a deco hotel / MiMo slab: the same rounded massing and colours, the windows as the engine's
 * parallax texture windows (Buildings.js WALL mode with a window layer, sized to the near version's bays), the eyebrow
 * bands / slab edges and balcony slabs as geometry (the horizontals carry the silhouette), the pylon, a bulkhead.
 */
function farShell(S, fp, H, o) {
  const [L0] = S.bufs, base = S.base, B = S.B, { F, top, SR } = o;
  const ring = SR.ring, n = ring.length;
  const R = WIN_RECTS[o.layer][0];
  let per = 0;
  for (let i = 0; i < n; i++) {
    const f = frameOf(ring[i], ring[(i + 1) % n]); if (!f) continue;
    const k = SR.kind(i), arc = SR.arc(i);
    const wall = { u0: per, sg: 1, k: 1, ax: f.ax, az: f.az, dx: f.dx, dz: f.dz, gy: S.groundAt, ao: -1e4 };
    per += f.L;
    const plain = INFO.wall(S);
    L0.wall = wall;
    const balc = o.balc && o.balc.includes(i);
    const pack = (wf, hf) => Math.round(Math.min(0.99, wf) * 100) * 100 + Math.round(Math.min(0.99, hf) * 100);
    L0.wall = null;
    const farI = [CL.FAR, balc ? pack(0.95, 0.9) : arc ? pack(0.99, o.hf) : pack(o.wf, o.hf), S.seed, enc(S.wallPbr, MODE.PLAIN)];
    const layer = balc ? o.layerBalc : arc ? (o.ribbon ? FACADE.RIBBON : -1) : k === 'party' || f.L < 2.2 ? -1 : o.layer;
    const nb = Math.max(1, Math.round(f.L / o.bw));
    const yG = base + F.gH, yT = base + top;
    // ground storey (shop fronts as the storefront layer), the upper floors (window layer), the parapet
    if (o.store(k) && !arc) face(L0, f, 0, f.L, base - 0.6, yG, 0, [FACADE.STOREFRONT, -1, S.seed, enc(S.wallPbr, MODE.WALL)], S.body, S.body, [0, -0.6 / F.gH, nb, 1]);
    else face(L0, f, 0, f.L, base - 0.6, yG, 0, plain, S.body, S.body);
    // the near version's bays drawn by the weathering pass (class FAR): the same windows, reveals, blinds and lit rooms
    if (layer >= 0 && F.n > 1) face(L0, f, 0, f.L, yG, yT, 0, farI, S.body, S.body, [0, 0, arc ? f.L / 3 : nb, F.n - 1]);
    else face(L0, f, 0, f.L, yG, yT, 0, plain, S.body, S.body);
    face(L0, f, 0, f.L, yT, base + H, 0, plain, S.body, S.body);
    L0.wall = null;
    if (!o.bands(k) || F.n < 2) continue;
    for (let j = 1; j < F.n; j++) {
      const fy = base + F.ys[j];
      if (balc) slab(L0, f, 0.2, f.L - 0.2, fy - 0.08, fy + 0.14, 0, o.balcDepth, INFO.conc(S), o.slabT, 'tbf', S.bodyShade);
      else if (o.balc) slab(L0, f, -0.25, f.L + 0.25, fy - 0.16, fy + 0.18, 0, 0.32, INFO.conc(S), o.slabT, 'bf', S.bodyShade);
      else { const ye = fy + R[3] * F.fh + 0.1; slab(L0, f, -0.02, f.L + 0.02, ye, ye + 0.12, 0, o.ebDepth, INFO.conc(S), S.trim, 'bf', S.bodyShade); }
    }
  }
  S.P.helper.flatPolygon(L0, ring, fp.holes, base + H, [CL.ROOF, -1, S.seed, enc(PBR.ROOF_TAR, MODE.PLAIN)], S.roofT, true);
  if (o.pylon && B.front >= 0) {
    const fe = B.edges[B.front].f;
    if (fe && fe.L >= 11) { const sc = fe.L / 2; slab(L0, fe, sc - 1.25, sc + 1.25, base + F.gH, base + H + 2, 0, 0.38, INFO.plain(S.wallPbr, S.seed), B.pastel ? S.trim : S.accent, 'tfe'); }
  }
  if (F.n >= 3 && fp.area > 90 && pointInRing(fp.c[0], fp.c[1], fp.outer)) S.P.helper.box(L0, fp.c[0], fp.c[1], base + H, 4.4, 3.6, 3, longAngle(fp.outer), INFO.plain(S.wallPbr, S.seed), S.body, INFO.plain(PBR.ROOF_TAR, S.seed), S.roofT);
}

// ================================================================== mid-century (MiMo) slab
function buildMimo(S, fp, H) {
  const { r, base, B } = S;
  const [L0, L1, L2] = S.bufs;
  const parH = 1.0;
  const top = H - parH;
  const F = floorsOf(top, 4.4, 2.95);
  const ring = fp.outer, n = ring.length;
  const balcDepth = 1.3 + r() * 0.6, balcFull = r() < 0.6, railT = r() < 0.6 ? tb([0.95, 0.95, 0.94]) : tb([0.2, 0.22, 0.24]);
  const rk = r(), railKind = rk < 0.4 ? 'solid' : rk < 0.72 ? 'glass' : 'pickets';
  const railC = railKind === 'solid' ? (r() < 0.5 ? S.trim : S.body) : railT;
  const slabT = S.trim, glassT = S.glassT;
  const fins = r() < 0.4;
  const breeze = r() < 0.5;
  const fr = r(), faceStyle = fr < 0.4 ? 'ribbon' : fr < 0.7 ? 'pairs' : 'punched';
  // which faces get balconies: the two longest non-party faces with L >= 11, and every long street face
  const cand = B.edges.map((e, i) => ({ i, L: e.f ? e.f.L : 0, k: e.kind })).filter((e) => e.k !== 'party' && e.L >= 11).sort((a, b) => b.L - a.L).filter((e, q) => q < 2 || (e.k !== 'side' && e.L >= 16)).map((e) => e.i);
  if (S.far) {
    const SR = { ring, kind: (i) => B.edges[i].kind, arc: () => false };
    farShell(S, fp, H, { F, top, parH, SR, layer: FACADE.PUNCHED, bw: 3.0, bands: (k) => k === 'front' || k === 'street' || k === 'side', store: (k) => k === 'street' && r() < 0.5, balc: cand, balcDepth, slabT, layerBalc: FACADE.MODERN_RES, wf: 1.6 / 3.0, hf: (F.fh - 1.35) / F.fh });
    return;
  }
  walls(S, ring, null, (i) => B.edges[i].kind, base - 0.6, [...F.ys.slice(0, -1), H], {});
  roofAndParapet(S, ring, base + top, parH, slabT);
  for (let i = 0; i < n; i++) {
    const E = B.edges[i], f = E.f;
    S.edgeI = i;
    if (!f || E.kind === 'party' || f.L < 2) continue;
    const balc = cand.includes(i);
    const stairI = !balc && E.kind === 'side' && f.L >= 9 && r() < 0.5 ? Math.floor(r() * 3) : -1;
    for (let j = 1; j < F.n; j++) {
      const fy = base + F.ys[j], fyT = base + F.ys[j + 1];
      // exposed slab edge at every floor line (a strong horizontal)
      if (!balc) slab(L0, f, -0.25, f.L + 0.25, fy - 0.16, fy + 0.18, 0, 0.32, INFO.conc(S), slabT, 'bfe', S.bodyShade);
      if (balc) {
        // sliding glass doors behind the balcony, the balcony slab, its railing
        glass(L0, f, 0.35, f.L - 0.35, fy + 0.14, fyT - 0.3, 0.02, 1, glassT, S.seed, 1.2, j * 13, j, j + 0.99);
        if (balcFull) {
          slab(L0, f, 0.2, f.L - 0.2, fy - 0.08, fy + 0.14, 0.12, balcDepth, INFO.conc(S), slabT, 'tbfe', S.bodyShade);
          railing(S, f, 0.2, f.L - 0.2, fy + 0.14, balcDepth, railKind, railC);
          for (let q = 0, nq = Math.max(1, Math.round(f.L / 7)); q < nq; q++) balconyLife(S, f, (f.L * (q + 0.5)) / nq, Math.min(6.5, f.L / nq) - 0.6, fy + 0.14, fyT - 0.15, balcDepth, railKind);
          railingSide(S, f, 0.2, fy + 0.14, balcDepth, railKind, railC, 1);
          railingSide(S, f, f.L - 0.2, fy + 0.14, balcDepth, railKind, railC, -1);
          // dividers between flats (L1)
          const nd = Math.max(1, Math.round(f.L / 7));
          for (let k = 1; k < nd; k++) { const s = (f.L * k) / nd; slab(L1, f, s - 0.08, s + 0.08, fy + 0.14, fyT - 0.15, 0.12, balcDepth, INFO.plain(S.wallPbr, S.seed), S.body, 'fe'); }
        } else {
          // balconies in pairs of bays with gaps
          const bw = 3.6, cs = bays(f.L, bw * 1.6, 0.5);
          for (const sc of cs) {
            const s0 = sc - bw / 2, s1 = sc + bw / 2;
            slab(L0, f, s0, s1, fy - 0.08, fy + 0.14, 0.12, balcDepth, INFO.conc(S), slabT, 'tbfe', S.bodyShade);
            railing(S, f, s0, s1, fy + 0.14, balcDepth, railKind, railC);
            balconyLife(S, f, sc, bw - 0.4, fy + 0.14, fyT - 0.15, balcDepth, railKind);
            railingSide(S, f, s0, fy + 0.14, balcDepth, railKind, railC, 1);
            railingSide(S, f, s1, fy + 0.14, balcDepth, railKind, railC, -1);
            if (r() < 0.25) wallAC(S, f, s1 + 0.6, fy + 0.3);
          }
        }
      } else {
        // ribbon or punched windows between the slab edges
        if (f.L < 3) continue;
        if (breeze && E.kind === 'side' && f.L < 14) {
          // a breeze-block stair screen (pierced blocks over a dark stair) in the middle of the face
          const sc = f.L / 2;
          face(L0, f, sc - 1.4, sc + 1.4, fy + 0.15, fyT - 0.13, 0.04, INFO.glass(3, S.seed), tb([0.9, 0.9, 0.88]), tb([0.9, 0.9, 0.88]), [0, 0, 2.8 / 0.3, (fyT - fy - 0.28) / 0.3]);
          if (r() < 0.5) face(L0, f, sc - 1.4, sc + 1.4, fy + 0.15, fyT - 0.13, 0.045, [CL.GLASSBLOCK, -1, S.seed, enc(PBR.PLAIN, MODE.PLAIN)], S.trim, S.trim);
          continue;
        }
        const cs = bays(f.L, 3.0, 0.6);
        const yw0 = fy + 0.9, yw1 = fyT - 0.45;
        if (faceStyle === 'ribbon') {
          // a ribbon window between the slab edges, with a sill band
          recess(S, f, 0.5, f.L - 0.5, yw0, yw1, 0.14);
          glass(L0, f, 0.5, f.L - 0.5, yw0, yw1, -0.11, 1, glassT, S.seed, 1.25, j * 17, j, j + 0.99);
          for (let q = 1, nq = Math.round((f.L - 1) / 1.25); q < nq; q++) { const sm = 0.5 + ((f.L - 1) * q) / nq; slab(L1, f, sm - 0.03, sm + 0.03, yw0, yw1, -0.13, -0.08, INFO.trim(S, PBR.METAL), S.trim, 'f'); }
          slab(L1, f, 0.4, f.L - 0.4, yw0 - 0.08, yw0, -0.02, 0.1, INFO.conc(S), slabT, 'tf');
        } else cs.forEach((sc, bi) => {
          if (bi === stairI) { windowAt(S, f, sc, 0.7, fy - 0.9, fy + 0.5, j, { type: 'picture', noTrim: true }); return; } // the stair, half a floor down
          const roll = r();
          if (roll < 0.06) return;
          if (roll < 0.16) { windowAt(S, f, sc, 0.6, yw1 - 0.6, yw1, j, { type: 'bath', noTrim: true }); return; }
          if (faceStyle === 'pairs') { windowAt(S, f, sc - 0.5, 0.75, yw0, yw1, j, { noTrim: true }); windowAt(S, f, sc + 0.5, 0.75, yw0, yw1, j, { noTrim: true }); }
          else windowAt(S, f, sc, roll > 0.8 ? 2.2 : 1.6, yw0, yw1, j, { noTrim: true });
        });
        for (const sc of cs) if (r() < 0.3) wallAC(S, f, sc + 1.05, yw0 - 0.1);
      }
    }
    // brise-soleil: deep vertical fins between the bays, over every upper floor
    if (fins && !balc && f.L >= 6 && F.n > 2) for (const sc of bays(f.L, 3.0, 0.6)) slab(L0, f, sc + 1.38, sc + 1.5, base + F.ys[1] - 0.12, base + top, 0, 0.7, INFO.conc(S), slabT, 'fe');
    // ground: glazed lobby + canopy on the front, otherwise windows / shopfront
    if (E.kind === 'front') {
      const ew = Math.min(6, f.L * 0.35);
      entrance(S, f, f.L / 2, ew, base + F.gH - 0.7, {});
      for (const sc of bays(f.L, 3.2, 0.7)) if (Math.abs(sc - f.L / 2) > ew / 2 + 1.0) windowAt(S, f, sc, 2.2, base + 0.6, base + F.gH - 0.7, 0, { street: true, type: 'picture', glassRaw: [0.6, 0.66, 0.68] });
      // a porte-cochere over the drop-off on the long fronts, a canopy otherwise; the name on its fascia
      const pc = f.L >= 18 && r() < 0.6;
      const c0 = f.L * (pc ? 0.22 : 0.3), c1 = f.L * (pc ? 0.78 : 0.7), cd = pc ? 6.5 : 3.0 + r() * 1.5, cy = base + Math.min(F.gH - 0.6, 3.6);
      slab(L0, f, c0, c1, cy, cy + (pc ? 0.5 : 0.32), 0, cd, INFO.conc(S), S.trim, 'tbfe', tb([0.72, 0.72, 0.7]));
      signBoard(S, f, (c0 + c1) / 2 - Math.min(3, (c1 - c0) * 0.35), (c0 + c1) / 2 + Math.min(3, (c1 - c0) * 0.35), cy + 0.04, cy + (pc ? 0.46 : 0.29), cd + 0.01, 0);
      for (const s of pc ? [c0 + 0.5, c0 + (c1 - c0) * 0.36, c0 + (c1 - c0) * 0.64, c1 - 0.5] : [c0 + 0.4, c1 - 0.4]) { const p = at(f, s, 0, cd - 0.45); S.P.helper.cylinder(L1, p[0], p[2], base, pc ? 0.22 : 0.1, cy - base, 8, pc ? INFO.wall(S) : INFO.trim(S, PBR.METAL), pc ? S.trim : tb([0.8, 0.8, 0.8])); }
      for (const k of [0.3, 0.5, 0.7]) { const p = at(f, c0 + (c1 - c0) * k, 0, cd * 0.5); S.P.helper.cylinder(L1, p[0], p[2], cy - 0.06, 0.18, 0.06, 6, INFO.led(S.seed), tb([1, 0.92, 0.75])); }
      for (const s of [0.9, f.L - 0.9]) { slab(L2, f, s - 0.5, s + 0.5, base, base + 0.55, 0.3, 1.1, INFO.plain(PBR.CONCRETE_PANEL, S.seed), S.trim, 'tfe'); slab(L2, f, s - 0.44, s + 0.44, base + 0.55, base + 0.68, 0.36, 1.04, INFO.plain(PBR.GRASS, S.seed), tb([0.7, 0.85, 0.6]), 't'); }
    } else if (E.kind === 'street') {
      if (r() < 0.5) shopfront(S, f, F.gH, false);
      else { const gb = bays(f.L, 3.4, 0.8); gb.forEach((sc) => windowAt(S, f, sc, 1.6, base + 1.0, base + Math.min(F.gH - 0.6, 2.8), 0, { street: true })); baseDetail(S, f, gb, -1); }
    } else if (E.kind === 'side') {
      const gb = bays(f.L, 3.4, 0.8), door = gb.length >= 2 ? Math.floor(r() * gb.length) : -1;
      gb.forEach((sc, q) => { if (q === door) serviceDoor(S, f, sc); else if (r() < 0.6) windowAt(S, f, sc, 1.4, base + 1.2, base + Math.min(F.gH - 0.8, 2.8), 0); });
      baseDetail(S, f, gb, door);
    }
  }
  roofPlant(S, ring, base + top, fp.area, { bulkhead: true, tank: 0.15, maxAC: 6, sign: r() < 0.25 });
  roofRail(S, ring, base + top + parH, 0.5, railT);
  void L2;
}

// ================================================================== condo tower
function buildTower(S, fp, H) {
  const { r, base, B } = S;
  const [L0, L1, L2] = S.bufs;
  const podium = fp.area > 1100 && r() < 0.8;
  const pod = floorsOf(Math.min(13.5, H * 0.25), 5.2, 3.3);
  let tring = fp.outer;
  if (podium) {
    const ins = insetRing(fp.outer, 5 + r() * 3);
    if (ringOK(ins, fp.outer) && Math.abs(signedArea(ins)) > fp.area * 0.28) tring = ins; else tring = null;
  }
  const hasPod = podium && tring;
  if (!hasPod) tring = fp.outer;
  const y0T = hasPod ? pod.ys[pod.ys.length - 1] : 0;
  const crownH = 4 + r() * 3;
  const top = H - crownH * 0.6;
  const F = floorsOf(top - y0T, hasPod ? 3.15 : 5.5, 3.15);
  // rounded corners on the tower
  const allCorners = new Set(tring.map((_, i) => i));
  const rr = roundRing(tring, allCorners, 3 + r() * 3, 3);
  const ring = r() < 0.7 ? rr.ring : tring;
  const n = ring.length;
  const glassT = S.glassT, slabT = tb([0.97, 0.97, 0.96]);
  const balcDepth = 1.8 + r() * 0.8, glassRail = r() < 0.75;
  // ---- podium: louvred parking levels, a glazed lobby, a pool deck on top
  if (hasPod) {
    const pr = fp.outer, pTop = base + y0T;
    walls(S, pr, null, (i) => B.edges[i].kind, base - 0.6, pod.ys, { pbr: PBR.CONCRETE_PANEL, tint: tb([0.9, 0.9, 0.88]) });
    S.P.helper.flatPolygon(L0, pr, [], pTop, INFO.plain(PBR.CONCRETE_PANEL, S.seed), tb([0.82, 0.8, 0.76]), true);
    S.P.helper.parapet(L0, pr, pTop, 1.1, INFO.plain(PBR.CONCRETE_PANEL, S.seed), tb([0.9, 0.9, 0.88]), INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, true);
    let park = false;
    for (let i = 0; i < pr.length; i++) {
      const E = B.edges[i], f = E.f;
      S.edgeI = i;
      if (!f || f.L < 3 || E.kind === 'party') continue;
      if (!park && E.kind === 'street' && f.L > 12) { park = true; garageMouth(S, f, f.L * 0.25); }
      for (let j = 1; j < pod.n; j++) {
        const y0 = base + pod.ys[j] + 0.3, y1 = base + pod.ys[j + 1] - 0.3;
        face(L0, f, 0.6, f.L - 0.6, y0, y1, 0.02, INFO.plain(PBR.PLAIN, S.seed), tb([0.08, 0.08, 0.09]));
        for (let y = y0 + 0.1; y < y1 - 0.1; y += 0.42) quad4(L0, at(f, 0.6, y, 0.04), at(f, f.L - 0.6, y, 0.04), at(f, f.L - 0.6, y + 0.3, 0.22), at(f, 0.6, y + 0.3, 0.22), norm([f.ox, 0.8, f.oz]), INFO.plain(PBR.METAL, S.seed), tb([0.86, 0.87, 0.88]), tb([0.95, 0.95, 0.95]));
        slab(L0, f, -0.05, f.L + 0.05, base + pod.ys[j] - 0.15, base + pod.ys[j] + 0.15, 0, 0.2, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, 'bf');
      }
      if (E.kind === 'front' || E.kind === 'street') {
        glass(L0, f, 0.6, f.L - 0.6, base + 0.2, base + pod.gH - 0.5, 0.03, 1, tb([0.6, 0.66, 0.7]), S.seed, 2.4, 0, 0, 0.99);
        if (E.kind === 'front') slab(L0, f, f.L * 0.25, f.L * 0.75, base + pod.gH - 1.2, base + pod.gH - 0.9, 0, 6, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, 'tbfe', tb([0.66, 0.66, 0.64])); // porte-cochere
      }
    }
    // pool deck: a pool, loungers' canopies, a railing at the edge
    const pc = fp.c, ang = longAngle(pr), ca = Math.cos(ang), sa = Math.sin(ang);
    const spots = [];
    for (let t = 0; t < 14 && spots.length < 2; t++) {
      const x = pc[0] + (r() - 0.5) * Math.sqrt(fp.area) * 0.9, z = pc[1] + (r() - 0.5) * Math.sqrt(fp.area) * 0.9;
      let ok = true;
      for (const [lx, lz] of [[-6, -3], [6, -3], [6, 3], [-6, 3]]) { const qx = x + lx * ca - lz * sa, qz = z + lx * sa + lz * ca; if (!pointInRing(qx, qz, pr) || pointInRing(qx, qz, ring)) ok = false; }
      if (ok) spots.push([x, z]);
    }
    for (const [x, z] of spots.slice(0, 1)) {
      S.P.helper.box(L0, x, z, pTop, 10, 4.5, 0.12, ang, INFO.plain(PBR.CONCRETE_PANEL, S.seed), tb([0.9, 0.88, 0.84]), INFO.glass(1, S.seed), tb([0.3, 0.75, 0.82]));
      S.P.helper.box(L1, x + 7 * ca, z + 7 * sa, pTop, 2.6, 2.6, 2.6, ang, INFO.plain(PBR.FABRIC, S.seed), tb([0.95, 0.95, 0.92]));
    }
  }
  // ---- tower shaft
  const yBase = base + y0T;
  // which faces carry deep balconies: the faces with the best outlook (two longest)
  const lens = []; for (let i = 0; i < n; i++) { const f = frameOf(ring[i], ring[(i + 1) % n]); lens.push(f ? f.L : 0); }
  const order = lens.map((L, i) => [L, i]).sort((a, b) => b[0] - a[0]);
  const balcFaces = new Set(order.slice(0, 2).filter((e) => e[0] > 10).map((e) => e[1]));
  const yTopT = base + top;
  // spandrel walls are the glass itself: floor-to-ceiling glazing, a white slab edge at every floor
  for (let i = 0; i < n; i++) {
    const f = frameOf(ring[i], ring[(i + 1) % n]);
    if (!f) continue;
    const balc = balcFaces.has(i);
    const j0 = hasPod ? 0 : 1;
    // one curtain quad per face for the whole shaft (the shader draws a transom and a dark slab line at every floor)
    glass(L0, f, 0, f.L, yBase + F.ys[j0], yBase + F.ys[F.n], 0, 1, glassT, S.seed, 1.5, i * 31, j0 + 1, F.n + 1);
    for (let j = j0; j < F.n; j++) {
      const fy = yBase + F.ys[j], fyT = yBase + F.ys[j + 1];
      if (balc) {
        slab(L0, f, -0.02, f.L + 0.02, fy - 0.18, fy + 0.12, 0, balcDepth, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, 'tbf', tb([0.7, 0.7, 0.7]));
        railing(S, f, 0.05, f.L - 0.05, fy + 0.12, balcDepth, glassRail ? 'glass' : 'solid', glassRail ? tb([0.85, 0.86, 0.86]) : slabT);
      } else {
        slab(L0, f, -0.02, f.L + 0.02, fy - 0.2, fy + 0.15, 0, 0.22, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, 'f');
        slab(L1, f, -0.02, f.L + 0.02, fy - 0.2, fy + 0.15, 0, 0.22, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, 'b', tb([0.7, 0.7, 0.7]));
      }
    }
    // vertical white piers every ~8 m on the non-balcony faces (the structure behind the glass)
    if (!balc && f.L > 9) {
      const np = Math.round(f.L / 8);
      for (let k = 1; k < np; k++) { const s = (f.L * k) / np; slab(L1, f, s - 0.3, s + 0.3, yBase, yTopT, 0, 0.18, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, 'fe'); }
    }
  }
  if (!hasPod) {
    // a glazed double-height lobby at the foot
    for (let i = 0; i < n; i++) { const f = frameOf(ring[i], ring[(i + 1) % n]); if (f && f.L > 2) glass(L0, f, 0, f.L, base - 0.5, base + F.ys[1], 0, 1, tb([0.6, 0.66, 0.7]), S.seed, 2.5, 0, 0, 0.99); }
  }
  // roof + crown: the roof, a louvred mechanical screen set back, antennae
  S.P.helper.flatPolygon(L0, ring, [], yTopT, [CL.ROOF, -1, S.seed, enc(PBR.ROOF_TAR, MODE.PLAIN)], S.roofT, true);
  S.P.helper.parapet(L0, ring, yTopT, 1.2, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT, true);
  const crown = insetRing(ring, 3.5);
  if (ringOK(crown, ring)) {
    const yc = yTopT;
    for (let i = 0; i < crown.length; i++) {
      const f = frameOf(crown[i], crown[(i + 1) % crown.length]); if (!f) continue;
      face(L0, f, 0, f.L, yc, yc + crownH, 0, INFO.glass(2, S.seed), tb([0.8, 0.82, 0.84]), tb([0.8, 0.82, 0.84]), [0, 0, f.L / 1.2, crownH / 1.6]);
    }
    S.P.helper.flatPolygon(L0, crown, [], yc + crownH, INFO.plain(PBR.ROOF_TAR, S.seed), tb([0.5, 0.5, 0.5]), true);
    // a top band (the crown's cap) and fins at its corners
    S.P.helper.ledge(L0, crown, yc + crownH - 0.5, 0.5, 0.25, INFO.plain(PBR.CONCRETE_PANEL, S.seed), slabT);
    roofPlant(S, crown, yc + crownH, Math.abs(signedArea(crown)), { bulkhead: false, maxAC: 3, antenna: r() < 0.5 ? 2 : 0 });
  } else roofPlant(S, ring, yTopT, fp.area, { bulkhead: true, maxAC: 4, antenna: 1 });
  void L2;
}

/** The parking entrance: an opening into a dark ramp, a lit sign band, a booth and a striped barrier arm. */
function garageMouth(S, f, sc) {
  const [L0, L1, L2] = S.bufs, base = S.base, w = 6.4, h = 2.8;
  opening(S, sc - w / 2, sc + w / 2, base - 0.6, base + h);
  const dk = tb([0.06, 0.06, 0.07]);
  face(L0, f, sc - w / 2, sc + w / 2, base - 0.2, base + h, -6, INFO.conc(S), dk, dk);
  quad4(L0, at(f, sc - w / 2, base + h, 0), at(f, sc + w / 2, base + h, 0), at(f, sc + w / 2, base + h, -6), at(f, sc - w / 2, base + h, -6), [0, -1, 0], INFO.conc(S), tb([0.3, 0.3, 0.3]));
  quad4(L0, at(f, sc - w / 2, base + 0.02, 0), at(f, sc + w / 2, base + 0.02, 0), at(f, sc + w / 2, base - 0.6, -6), at(f, sc - w / 2, base - 0.6, -6), [0, 1, 0], INFO.conc(S), tb([0.35, 0.35, 0.34]));
  for (const e of [-1, 1]) quad4(L0, at(f, sc + e * w / 2, base - 0.6, 0), at(f, sc + e * w / 2, base - 0.6, -6), at(f, sc + e * w / 2, base + h, -6), at(f, sc + e * w / 2, base + h, 0), [-e * f.dx, 0, -e * f.dz], INFO.conc(S), tb([0.5, 0.5, 0.48]));
  for (let k = 0; k < 4; k++) { const p = at(f, sc, 0, -1 - k * 1.4); S.P.helper.cylinder(L1, p[0], p[2], base + h - 0.06, 0.15, 0.05, 6, INFO.led(S.seed), tb([1, 0.95, 0.85])); }
  face(L1, f, sc - w / 2, sc + w / 2, base + h, base + h + 0.45, 0.04, INFO.sign(w, S.seed), tb([0.1, 0.3, 0.55]), tb([0.1, 0.3, 0.55]), [0, 0, w, 1]);
  boxF(L1, S, f, sc + w / 2 - 0.7, -0.9, base, 1.0, 1.0, 2.3, INFO.trim(S), tb([0.9, 0.9, 0.88]), INFO.trim(S), tb([0.4, 0.4, 0.42]));
  for (let k = 0; k < 6; k++) boxF(L2, S, f, sc - w / 2 + 0.5 + k * 0.45 + 0.22, -0.4, base + 1.0, 0.45, 0.08, 0.08, INFO.trim(S), tb(k % 2 ? [0.95, 0.95, 0.93] : [0.85, 0.15, 0.12]));
  boxF(L1, S, f, sc - w / 2 + 0.25, -0.4, base, 0.3, 0.3, 1.05, INFO.trim(S, PBR.METAL), tb([0.85, 0.75, 0.2]));
}

// ================================================================== pitched-roof house / villa, raised parts
/** A Mediterranean-revival house: stucco, recessed casements, a door with a canopy, a tiled hip / pyramid roof. */
function buildHouse(S, fp, H) {
  const { r, base, B } = S;
  const [L0, L1] = S.bufs;
  const rh = Math.max(1.2, Math.min(4, Math.sqrt(fp.area) * 0.17)), wallTop = Math.max(2.8, H - rh);
  const F = floorsOf(wallTop, Math.min(3.4, wallTop), 3.1);
  const ring = fp.outer, n = ring.length;
  walls(S, ring, null, (i) => B.edges[i].kind, base - 0.6, [...F.ys.slice(0, -1), wallTop], {});
  for (let i = 0; i < n; i++) {
    const E = B.edges[i], f = E.f; S.edgeI = i;
    if (!f || E.kind === 'party' || f.L < 2.5) continue;
    const street = E.kind !== 'side';
    const gb = bays(f.L, 3.2, 0.8), door = E.kind === 'front' ? Math.floor(gb.length / 2) : -1;
    for (let j = 0; j < F.n; j++) {
      const fy = base + F.ys[j];
      gb.forEach((sc, q) => {
        if (j === 0 && q === door) { recess(S, f, sc - 0.55, sc + 0.55, base, base + 2.3, 0.2); face(L0, f, sc - 0.55, sc + 0.55, base, base + 2.3, -0.18, INFO.trim(S, PBR.WOOD_SIDING), tb(WOOD)); slab(L0, f, sc - 0.9, sc + 0.9, base + 2.45, base + 2.6, 0, 0.8, INFO.conc(S), S.trim, 'tbfe', S.bodyShade); return; }
        if (r() < 0.12) return;
        windowAt(S, f, sc, 1.1, fy + 0.9, Math.min(fy + 2.4, base + F.ys[j + 1] - 0.3), j, { street, type: 'casement' });
      });
    }
    if (street) baseDetail(S, f, gb, door);
  }
  // the roof: terracotta tiles on a hip (4 sides) or a pyramid, eaves out 0.45 m
  const tile = [CL.TRIM, -1, S.seed, enc(PBR.ROOF_SLATE, MODE.PLAIN)], tT = tb(pick([[0.86, 0.5, 0.36], [0.8, 0.45, 0.33], [0.9, 0.6, 0.45]], r()));
  if (ring.length === 4) S.P.helper.hipRoof(L0, ring, base + wallTop, rh, tile, tT, 0.45, S.seed, null);
  else S.P.helper.taperRoof(L0, ring, fp.c, base + wallTop, rh, [[1, 0], [0, 1]], tile, tT);
  void L1;
}
/** A part raised on stilts / a canopy / a bridge: concrete box from mh to the top, its soffit, ribbon glass. */
function buildRaised(S, fp, H) {
  const { base, B } = S;
  const [L0] = S.bufs, ring = fp.outer, mh = fp.mh;
  walls(S, ring, null, (i) => B.edges[i].kind, base + mh, [mh, H], { pbr: PBR.CONCRETE_PANEL, tint: tb([0.9, 0.9, 0.88]) });
  S.P.helper.flatPolygon(L0, ring, fp.holes, base + mh, INFO.conc(S), tb([0.72, 0.72, 0.7]), false);
  S.P.helper.flatPolygon(L0, ring, fp.holes, base + H, [CL.ROOF, -1, S.seed, enc(PBR.ROOF_TAR, MODE.PLAIN)], S.roofT, true);
  if (H - mh > 3.2) for (let i = 0; i < ring.length; i++) { const f = B.edges[i].f; if (f && f.L > 3) glass(L0, f, 0.3, f.L - 0.3, base + mh + 0.9, base + H - 0.8, 0.03, 1, tb(S.glassRaw), S.seed, 1.5, i * 9, 2, 2.99); }
}

// ================================================================== small commercial block
function buildShop(S, fp, H) {
  const { r, base, B } = S;
  const [L0, L1, L2] = S.bufs;
  const parH = 0.6 + r() * 0.5;
  const top = H - parH;
  const F = floorsOf(top, Math.min(top, 4.3), 3.2);
  const ring = fp.outer, n = ring.length;
  walls(S, ring, null, (i) => B.edges[i].kind, base - 0.6, [...F.ys.slice(0, -1), H], {});
  roofAndParapet(S, ring, base + top, parH, S.trim);
  for (let i = 0; i < n; i++) {
    const E = B.edges[i], f = E.f;
    S.edgeI = i;
    if (!f || f.L < 2.5 || E.kind === 'party') continue;
    if (E.kind === 'front' || E.kind === 'street') shopfront(S, f, F.gH, false);
    else for (const sc of bays(f.L, 4, 1)) if (r() < 0.5) windowAt(S, f, sc, 1.2, base + 1.1, base + Math.min(F.gH - 0.5, 2.3), 0);
    for (let j = 1; j < F.n; j++) {
      const fy = base + F.ys[j];
      for (const sc of bays(f.L, 3.2, 0.7)) windowAt(S, f, sc, 1.3, fy + 0.9, Math.min(fy + 2.4, base + F.ys[j + 1] - 0.3), j, { street: E.kind !== 'side' });
    }
    // a cornice band
    slab(L0, f, -0.05, f.L + 0.05, base + top - 0.35, base + top - 0.1, 0, 0.18, INFO.conc(S), S.trim, 'bf');
    if (r() < 0.3) slab(L2, f, f.L - 0.4, f.L - 0.3, base, base + top, 0.02, 0.12, INFO.plain(PBR.METAL, S.seed), tb([0.7, 0.7, 0.7]), 'fe');
  }
  roofPlant(S, ring, base + top, fp.area, { bulkhead: false, maxAC: 5 });
  void L1; void L2;
}

