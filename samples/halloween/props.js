// Props of Midnight Candy Run: a small procedural modelling kit and one builder per prop, so a level can place any of
// them anywhere (world.js lays out today's map with them). Everything is built once at load into vertex-coloured,
// indexed, uv-less geometry that world.js merges into ONE props mesh (+ ONE unlit glow mesh), so the props cost the
// same few draw calls however many there are. The look is hand-painted toy-like: chunky bevelled shapes, a light top /
// dark bottom gradient and a little colour jitter baked into every part, cracks and moss painted in as geometry.
//
// Kit (pure geometry, no scene):
//   paint(g, color, scale)          indexed, no uv, a colour attribute (linear; scale > 1 for glow)
//   place(g, x, y, z, ry, rx, rz, sx, sy, sz)     compose a transform into the vertices (Euler YXZ)
//   shade(g, fn)                    multiply the colours per vertex by fn(x, y, z, nx, ny, nz) (local space)
//   vgrad(g, bottom, top, jitter, seed)  a vertical light gradient (+ per-vertex jitter) across the part's height
//   sweep(points, radius, sides, o) a tube along a polyline (parallel-transport frames): radius(t) or number, o.flat
//                                   (cross-section x scale), o.caps, o.close; smooth normals
//   lathe(profile, segs, o)         a surface of revolution of [[r, y], ...] with o.mod(theta, t) -> radius factor,
//                                   o.dy(theta, t) -> y offset, o.phi0 / o.phiLen (an open sheet), smooth normals
//   bevelBox(w, h, d, r)            a box with rounded (chamfered) edges (three's RoundedBoxGeometry, 1 segment)
//   slab(w, h, d, top, r)           a gravestone slab outline (top: 'round' | 'arch' | 'shoulder' | 'flat' | 'broken'),
//                                   extruded with a bevel
//   crack(B, pts, w, color)         a thin dark ribbon along a polyline (cracks, engraved lines), lying on a face
//   Batch                           collects painted parts, merges them (+ the baked ground contact shading)
// Builders (each appends to a Batch B, glow parts to a glow Batch G; ctx = { glow(kind, amount) -> light group,
//   spot(x, y, z, size, r, g, b, flicker, group), groundAt(x, z) }):
//   gravestone(B, o)  deadTree(B, o)  ironFence(B, ...)  gatePost(B, ...)  gateArch(B, ...)  gateLeafParts(...)
//   picketFence(B, ...)  hauntedHouse(B, G, ctx, o)  crypt(B, G, ctx, o)  scarecrow(B, G, ctx, o)
//   cauldron(B, G, ctx, o)  hayBale(B, o)  candleLantern(B, G, x, y, z, ry)  pumpkinGeometry(...)  pumpkinLeafGeometry()
// Builders never touch the level's random stream: every variation comes from a local seeded stream (seedOf(x, z)), so
// placing a prop never moves anything else (world.js still draws the same numbers it always did).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from '@vibe/engine/render';

export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** A seed from a position (and a salt): local, deterministic variation without the level's random stream. */
export function seedOf(x, z, salt = 0) {
  let h = Math.imul(Math.round(x * 97) ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(Math.round(z * 131) + salt * 7919, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 13;
  return h >>> 0;
}
export const rngAt = (x, z, salt = 0) => mulberry32(seedOf(x, z, salt));

// ------------------------------------------------------------------ painting + placing
const _col = new THREE.Color();
/** Prepare a primitive for merging: indexed, no uv, normals, a colour attribute (linear, may exceed 1 for glow). */
export function paint(g, color, scale = 1) {
  if (g.index === null) { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  if (!g.attributes.normal) g.computeVertexNormals();
  _col.set(color);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _col.r * scale; c[i * 3 + 1] = _col.g * scale; c[i * 3 + 2] = _col.b * scale; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function place(g, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  return g.applyMatrix4(_m);
}
/** Multiply the colours by fn(x, y, z, nx, ny, nz) (a number, or [r, g, b]) per vertex, in the geometry's space. */
export function shade(g, fn) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array;
  for (let i = 0; i < P.length; i += 3) {
    const k = fn(P[i], P[i + 1], P[i + 2], N[i], N[i + 1], N[i + 2]);
    if (typeof k === 'number') { C[i] *= k; C[i + 1] *= k; C[i + 2] *= k; } else { C[i] *= k[0]; C[i + 1] *= k[1]; C[i + 2] *= k[2]; }
  }
  return g;
}
/** Hand-painted light: bottom .. top factor across the part's height, + upward faces a touch lighter, + jitter. */
export function vgrad(g, bottom = 0.78, top = 1.12, jitter = 0.06, seed = 1) {
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, dy = Math.max(1e-6, y1 - y0), r = mulberry32(seed);
  return shade(g, (x, y, z, nx, ny) => (bottom + (top - bottom) * smooth((y - y0) / dy)) * (1 + 0.08 * ny) * (1 + (r() - 0.5) * 2 * jitter));
}

// ------------------------------------------------------------------ shapes
const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _a = new THREE.Vector3();
/**
 * A tube along `points` ([[x, y, z], ...] or Vector3s): `sides` around, radius a number or radius(t, i) (t 0..1 along
 * the length). o.flat: the cross-section's x scale (a ribbon-like lock of hair, a flattened branch), o.twist (rad over
 * the length), o.caps: [start, end] (close with a fan), o.up: the first frame's normal hint.
 */
export function sweep(points, radius, sides = 6, o = {}) {
  const pts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
  const n = pts.length, flat = o.flat ?? 1, twist = o.twist ?? 0;
  const caps = o.caps ?? [false, true];
  // arc length parameter
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const len = L[n - 1] || 1;
  const pos = [], idx = [];
  let N0 = null;
  for (let i = 0; i < n; i++) {
    if (i === 0) _t.subVectors(pts[1], pts[0]); else if (i === n - 1) _t.subVectors(pts[n - 1], pts[n - 2]); else _t.subVectors(pts[i + 1], pts[i - 1]);
    _t.normalize();
    if (N0 === null) {
      N0 = new THREE.Vector3();
      const up = o.up ? _a.set(o.up[0], o.up[1], o.up[2]) : Math.abs(_t.y) < 0.9 ? _a.set(0, 1, 0) : _a.set(1, 0, 0);
      N0.copy(up).addScaledVector(_t, -up.dot(_t)).normalize();
    } else {
      N0.addScaledVector(_t, -N0.dot(_t));
      if (N0.lengthSq() < 1e-10) N0.set(_t.y, -_t.x, 0);
      N0.normalize();
    }
    _b.crossVectors(_t, N0);
    const u = L[i] / len, r = typeof radius === 'function' ? radius(u, i) : radius, tw = twist * u;
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + tw, ca = Math.cos(a) * flat, sa = Math.sin(a);
      pos.push(pts[i].x + (N0.x * ca + _b.x * sa) * r, pts[i].y + (N0.y * ca + _b.y * sa) * r, pts[i].z + (N0.z * ca + _b.z * sa) * r);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k, b = i * sides + ((k + 1) % sides), c = a + sides, d = b + sides;
      idx.push(a, b, c, b, d, c);
    }
  }
  if (caps[0]) { const c = pos.length / 3; pos.push(pts[0].x, pts[0].y, pts[0].z); for (let k = 0; k < sides; k++) idx.push(c, (k + 1) % sides, k); }
  if (caps[1]) {
    const c = pos.length / 3, o2 = (n - 1) * sides;
    const tip = pts[n - 1].clone().addScaledVector(_t, typeof caps[1] === 'number' ? caps[1] : 0);
    pos.push(tip.x, tip.y, tip.z);
    for (let k = 0; k < sides; k++) idx.push(c, o2 + k, o2 + ((k + 1) % sides));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Points of a Catmull-Rom curve through `ctrl` ([[x, y, z], ...]), `n` samples. */
export function curve(ctrl, n = 12, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', tension);
  return c.getPoints(n - 1);
}

/**
 * Surface of revolution of profile [[r, y], ...] around +Y: segs around (full circle unless o.phiLen), o.mod(theta,
 * t) multiplies the radius (ribs, folds), o.dy(theta, t) offsets y (a scalloped hem), t = profile parameter 0..1.
 * A profile end at r = 0 closes with one pole vertex. Smooth normals. Facing: a profile that runs up faces out
 * (away from the axis), one that runs outward faces down (list a solid's outline counter-clockwise in (r, y): up the
 * outside); o.flip turns it inside out (a lining).
 */
export function lathe(profile, segs = 16, o = {}) {
  const full = o.phiLen === undefined, phi0 = o.phi0 ?? 0, phiLen = o.phiLen ?? Math.PI * 2;
  const cols = full ? segs : segs + 1, m = profile.length;
  const pos = [], idx = [], ring = [];
  for (let j = 0; j < m; j++) {
    const [r, y] = profile[j], t = m > 1 ? j / (m - 1) : 0;
    if (r === 0 && (j === 0 || j === m - 1)) { ring.push(pos.length / 3); pos.push(0, y, 0); continue; }
    ring.push(pos.length / 3);
    for (let k = 0; k < cols; k++) {
      const th = phi0 + (k / segs) * phiLen;
      const rr = r * (o.mod ? o.mod(th, t) : 1), yy = y + (o.dy ? o.dy(th, t) : 0);
      pos.push(Math.sin(th) * rr, yy, Math.cos(th) * rr);
    }
  }
  const isPole = (j) => profile[j][0] === 0 && (j === 0 || j === m - 1);
  for (let j = 0; j < m - 1; j++) {
    const a0 = ring[j], b0 = ring[j + 1];
    for (let k = 0; k < (full ? segs : segs); k++) {
      const k1 = full ? (k + 1) % segs : k + 1;
      if (isPole(j)) idx.push(a0, b0 + k1, b0 + k);
      else if (isPole(j + 1)) idx.push(a0 + k, a0 + k1, b0);
      else idx.push(a0 + k, a0 + k1, b0 + k, a0 + k1, b0 + k1, b0 + k);
    }
  }
  if (o.flip) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A box with rounded edges of radius r (one segment: a chamfer that catches the light). */
export function bevelBox(w, h, d, r = 0.03) {
  return new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}

/**
 * Gravestone outline (w wide, h tall, base at y = 0) extruded d deep with a bevel; top: 'round' (a half circle),
 * 'arch' (gothic, pointed), 'shoulder' (a tablet with rounded ears), 'flat', 'broken' (a jagged break, seed).
 */
export function slab(w, h, d, top = 'round', bevel = 0.025, seed = 1) {
  const s = new THREE.Shape(), hw = w / 2;
  s.moveTo(-hw, 0); s.lineTo(hw, 0);
  if (top === 'round') { const r = hw; s.lineTo(hw, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); }
  else if (top === 'arch') {
    const sh = h - w * 0.62;
    s.lineTo(hw, sh); s.quadraticCurveTo(hw, h - w * 0.2, 0, h); s.quadraticCurveTo(-hw, h - w * 0.2, -hw, sh);
  } else if (top === 'shoulder') {
    const r = w * 0.16, sh = h - w * 0.32;
    s.lineTo(hw, sh); s.absarc(hw - r, sh, r, 0, Math.PI / 2, false);
    s.quadraticCurveTo(hw * 0.35, sh + r, 0, h); s.quadraticCurveTo(-hw * 0.35, sh + r, -hw + r, sh + r);
    s.absarc(-hw + r, sh, r, Math.PI / 2, Math.PI, false);
  } else if (top === 'broken') {
    const r = mulberry32(seed), y0 = h * 0.72;
    s.lineTo(hw, y0 + r() * h * 0.12);
    for (let k = 1; k < 6; k++) s.lineTo(hw - (w * k) / 6, y0 + (r() - 0.3) * h * 0.22 + (k === 2 ? h * 0.14 : 0));
    s.lineTo(-hw, y0 - r() * h * 0.08);
  } else s.lineTo(hw, h);
  s.lineTo(-hw, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: top === 'round' ? 10 : 6 });
  g.translate(0, 0, -(d - 2 * bevel) / 2);
  g.deleteAttribute('uv');
  // the extrude's sides and caps are separate vertices (hard edges): keep them, an indexed copy for merging
  return g;
}

/**
 * A thin ribbon along `pts` ([[x, y, z], ...]) lying on a face with normal `nrm` (a crack, an engraved line), `w`
 * wide; painted `color` and pushed into B.
 */
export function crack(B, pts, w, color, nrm = [0, 0, 1]) {
  const P = [], I = [];
  const N = new THREE.Vector3(nrm[0], nrm[1], nrm[2]).normalize();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    _t.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    _b.crossVectors(N, _t).normalize();
    const ww = w * (i === 0 || i === pts.length - 1 ? 0.25 : 1);
    P.push(pts[i][0] + _b.x * ww, pts[i][1] + _b.y * ww, pts[i][2] + _b.z * ww, pts[i][0] - _b.x * ww, pts[i][1] - _b.y * ww, pts[i][2] - _b.z * ww);
    if (i > 0) { const k = (i - 1) * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const nn = new Float32Array(P.length);
  for (let i = 0; i < nn.length; i += 3) { nn[i] = N.x; nn[i + 1] = N.y; nn[i + 2] = N.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  g.setIndex(I);
  B.push(paint(g, color));
  return g;
}

/** A jagged crack polyline from (x0, y0) going `len` in direction a (2D, on a face), `n` kinks. */
export function crackPath(x0, y0, len, a, n, r) {
  const out = [[x0, y0]];
  let x = x0, y = y0;
  for (let k = 0; k < n; k++) { const aa = a + (r() - 0.5) * 1.3, l = (len / n) * (0.7 + r() * 0.6); x += Math.cos(aa) * l; y += Math.sin(aa) * l; out.push([x, y]); }
  return out;
}

/** A five-pointed star prism (r outer, inner ratio k, thickness t) in the xy plane, facing +z. */
export function star(r, t = 0.01, k = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, rr = i % 2 ? r * k : r; if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  g.deleteAttribute('uv');
  return g;
}

// ------------------------------------------------------------------ merging
const MOSS = new THREE.Color('#26331f');
export class Batch {
  constructor() { this.parts = []; this.group = -1; }
  add(g, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx, glow = 1) {
    const p = place(paint(g, color, glow), x, y, z, ry, rx, rz, sx, sy, sz);
    this.push(p);
    return p;
  }
  /** A painted, placed part; a glow batch tags it with its light group (this.group: the flicker the game drives). */
  push(g) {
    if (this.group >= 0) g.setAttribute('grp', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(this.group), 1));
    this.parts.push(g);
    return g;
  }
  /** Append the parts of another batch (already painted and placed). */
  take(other) { for (const p of other.parts) this.push(p); other.parts.length = 0; }
  /** Every part added from now on goes through fn(g) (e.g. a transform); returns the previous hook. */
  /**
   * ground (optional, heightAt): darken and moss-tint vertex colours near the ground (baked contact shading).
   * sway: every part gets the tree-sway attribute (vec2 weight, phase; zeros where a part has none), so one material
   * serves trees and everything else. split(x, z) -> tile key (optional): a Group of one mesh per tile instead.
   */
  build(material, name, ground = null, sway = false, split = null) {
    if (!this.parts.length) return null;
    if (split) {
      // static geometry merged, then tiled (ENGINE.md conventions): one mesh per tile, so the frustum (and each shadow
      // pass) skips the tiles out of view; a part goes whole to the tile split(centre x, centre z) names
      const tiles = new Map(), all = this.parts;
      for (const p of all) {
        p.computeBoundingBox();
        const b = p.boundingBox, k = split((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2);
        if (!tiles.has(k)) tiles.set(k, []);
        tiles.get(k).push(p);
      }
      const out = new THREE.Group(); out.name = name;
      for (const [k, list] of [...tiles].sort((a, b) => a[0] - b[0])) {
        const T = new Batch(); T.group = this.group; T.parts = list;
        out.add(T.build(material, `${name}${k}`, ground, sway));
      }
      this.parts = [];
      return out;
    }
    for (const p of this.parts) {
      if (sway && !p.attributes.sway) p.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count * 2), 2));
      if (this.group >= 0 && !p.attributes.grp) p.setAttribute('grp', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count), 1));
      // ExtrudeGeometry / RoundedBox groups do not matter once merged into one material
      p.clearGroups();
    }
    const g = mergeGeometries(this.parts);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    if (ground) {
      const P = g.attributes.position.array, C = g.attributes.color.array;
      for (let i = 0; i < P.length; i += 3) {
        const h = P[i + 1] - ground(P[i], P[i + 2]), k = smooth(h / 1.1), m = (1 - smooth(h / 0.45)) * 0.35;
        const f = 0.52 + 0.48 * k;
        C[i] = (C[i] + (MOSS.r - C[i]) * m) * f; C[i + 1] = (C[i + 1] + (MOSS.g - C[i + 1]) * m) * f; C[i + 2] = (C[i + 2] + (MOSS.b - C[i + 2]) * m) * f;
      }
    }
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name;
    return mesh;
  }
}
export { clamp };

// ------------------------------------------------------------------ pumpkins
/** Pumpkin profile [r, y] in radii: a squat body on y = 0, a dimple round the stem at the top (bottom -> top). */
export const PUMPKIN_PROFILE = [[0, 0.06], [0.42, 0], [0.8, 0.12], [0.98, 0.5], [1, 0.76], [0.93, 1.08], [0.72, 1.33], [0.36, 1.46], [0.13, 1.41], [0, 1.37]];
/** A lighter profile (same silhouette, fewer rings) for the many decor pumpkins. */
export const PUMPKIN_LITE = [[0, 0.06], [0.55, 0], [0.93, 0.24], [1, 0.72], [0.86, 1.16], [0.45, 1.44], [0, 1.37]];
/** Lobe factor at angle th (lathe convention: x = sin th r, z = cos th r): 1 at a lobe's middle, 0 in a crease. */
export const pumpkinLobe = (th, lobes) => Math.pow(Math.abs(Math.cos((th * lobes) / 2)), 0.6);
function profileRadius(prof, y) { // the side of the profile (monotonic in y between the widest points)
  for (let j = 2; j < prof.length - 3; j++) {
    const [r0, y0] = prof[j], [r1, y1] = prof[j + 1];
    if (y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
  }
  return y < prof[2][1] ? prof[2][0] : prof[prof.length - 3][0];
}
/**
 * The front of a pumpkin of radius r: (x, y) in the face plane (object metres) -> [px, py, pz, nx, ny, nz] on the
 * ribbed surface (for carved faces laid on it).
 */
export function pumpkinFront(r, lobes = 8, depth = 0.1) {
  const surf = (th, y) => { const rr = profileRadius(PUMPKIN_PROFILE, y / r) * r * (1 - depth + depth * pumpkinLobe(th, lobes)); return [Math.sin(th) * rr, y, Math.cos(th) * rr]; };
  const thAt = (x, y) => { let th = 0; for (let k = 0; k < 6; k++) { const p = surf(th, y), rr = Math.hypot(p[0], p[2]); th = Math.asin(clamp(x / Math.max(1e-4, rr), -0.99, 0.99)); } return th; };
  return (x, y) => {
    const th = thAt(x, y), p = surf(th, y), e = 0.004;
    const a = surf(th + e, y), b = surf(th - e, y), c = surf(th, y + e * r), d = surf(th, y - e * r);
    const tx = a[0] - b[0], ty = a[1] - b[1], tz = a[2] - b[2], ux = c[0] - d[0], uy = c[1] - d[1], uz = c[2] - d[2];
    let nx = ty * uz - tz * uy, ny = tz * ux - tx * uz, nz = tx * uy - ty * ux;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    return [p[0], p[1], p[2], nx, ny, nz];
  };
}
/**
 * A pumpkin of radius r sitting on y = 0: `lobes` ribs (deep creases, painted darker), a curved woody stem with a
 * flared foot, optionally a curly vine and a leaf at the stem; vertex coloured (bodyColor white: tinted per instance).
 * segs: around (4-5 per lobe). o: lobes (8), depth (crease depth 0.1), vine, leaf, seed, glow (fn(x, y, z) -> a
 * `glow` attribute on every part).
 */
export function pumpkinGeometry(r = 0.4, segs = 40, _rows = 0, bodyColor = '#ffffff', stemColor = '#4d6a2a', o = {}) {
  const lobes = o.lobes ?? 8, depth = o.depth ?? 0.1, rnd = mulberry32(o.seed ?? 3);
  const body = lathe((o.lite ? PUMPKIN_LITE : PUMPKIN_PROFILE).map(([a, b]) => [a * r, b * r]), segs, { mod: (th) => 1 - depth + depth * pumpkinLobe(th, lobes) });
  paint(body, bodyColor);
  // creases darker, the base darker, the shoulders a touch lighter (hand-painted), a little jitter per vertex
  shade(body, (x, y, z) => {
    const lobe = pumpkinLobe(Math.atan2(x, z), lobes), h = y / (1.46 * r);
    return (0.5 + 0.5 * lobe) * (0.68 + 0.42 * smooth(h * 1.6) - 0.12 * smooth((h - 0.85) / 0.15)) * (0.96 + rnd() * 0.08);
  });
  const parts = [body];
  // stem: curved, tapering, a flared foot; the cut end lighter
  const sb = 1.37 * r, lean = rnd() * Math.PI * 2, cl = Math.cos(lean), sl = Math.sin(lean);
  const sp = [[0, sb - 0.02 * r, 0], [0.02 * r * cl, sb + 0.12 * r, 0.02 * r * sl], [0.07 * r * cl, sb + 0.24 * r, 0.07 * r * sl], [0.15 * r * cl, sb + 0.3 * r, 0.15 * r * sl]];
  const stem = paint(sweep(curve(sp, o.lite ? 4 : 6), (t) => 0.06 * r + 0.07 * r * (1 - t) ** 4, o.lite ? 5 : 6, { caps: [false, 0] }), stemColor);
  shade(stem, (x, y) => 0.75 + 0.55 * smooth((y - sb) / (0.3 * r)));
  parts.push(stem);
  if (o.vine) { // a curly tendril from the stem's foot, spiralling out over the top
    const pts = [], a0 = lean + 2.4, dx = Math.cos(a0), dz = Math.sin(a0);
    for (let k = 0; k <= 26; k++) {
      const u = k / 26, out = 0.08 * r + 0.5 * r * u, coil = u * Math.PI * 5, cr = 0.1 * r * (1 - 0.55 * u);
      // along the outward direction, coiling in the vertical plane through it
      const ox = dx * (out + Math.sin(coil) * cr), oz = dz * (out + Math.sin(coil) * cr);
      pts.push([ox, sb + 0.04 * r + 0.08 * r * u + (1 - Math.cos(coil)) * cr, oz]);
    }
    parts.push(paint(sweep(pts, (t) => 0.026 * r * (1 - 0.55 * t), 4, { caps: [false, false] }), '#2f5a1c'));
  }
  if (o.leaf) { // a lobed pumpkin leaf lying against the shoulder by the stem
    const g = pumpkinLeafGeometry(0.42 * r);
    g.rotateX(-1.2).rotateY(lean + Math.PI * 0.8).translate(Math.cos(lean + 0.9) * 0.28 * r, sb - 0.02 * r, Math.sin(lean + 0.9) * 0.28 * r);
    parts.push(paint(g, '#3c6b2a'));
    shade(parts[parts.length - 1], () => 0.8 + rnd() * 0.3);
  }
  // rib = 1 on the body (looks.js patchRibs bends its normals into crisp creases), 0 on the stem, vine and leaf
  for (const p of parts) p.setAttribute('rib', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count).fill(p === body ? 1 : 0), 1));
  if (o.glow) for (const p of parts) { const P = p.attributes.position.array, G = new Float32Array(P.length / 3); for (let i = 0; i < G.length; i++) G[i] = o.glow(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); p.setAttribute('glow', new THREE.BufferAttribute(G, 1)); }
  for (const p of parts) p.clearGroups();
  const out = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return out;
}
/** A five-lobed pumpkin leaf (size s), flat in xz (normal +y), slightly cupped; its stem end at the origin. */
export function pumpkinLeafGeometry(s = 0.3) {
  const sh = new THREE.Shape();
  const N = 5, pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI * 0.95 + (i / 40) * Math.PI * 1.9, lob = Math.abs(Math.sin(((a + Math.PI * 0.95) / (Math.PI * 1.9)) * N * Math.PI));
    const rr = s * (0.55 + 0.45 * Math.pow(lob, 0.7)) * (i % 2 ? 0.96 : 1);
    pts.push([Math.sin(a) * rr, Math.cos(a) * rr + s * 0.25]);
  }
  sh.moveTo(0, -0.02 * s); for (const [x, y] of pts) sh.lineTo(x, y); sh.closePath();
  const g = new THREE.ShapeGeometry(sh, 2);
  g.rotateX(-Math.PI / 2);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); P.setY(i, (0.12 * (x * x + z * z)) / s); }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ more shapes
/** A box with chamfered edges (w x h x d, chamfer b): an extruded rectangle with a one-segment bevel, 28 triangles. */
export function chamferBox(w, h, d, b = 0.02) {
  b = Math.min(b, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const s = new THREE.Shape(), hw = w / 2 - b, hh = h / 2 - b;
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-3, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  g.deleteAttribute('uv');
  return g;
}
/** Flat-shaded copy (hard edges: a 4-sided obelisk, a pyramid roof). */
export function flat(g) { const f = g.index ? g.toNonIndexed() : g; f.computeVertexNormals(); return f; }

/** Parts built in a prop's local frame; into(B, ...) moves them all into place and hands them to B. */
export class Parts {
  constructor() { this.list = []; }
  add(g, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    const p = place(paint(g, color), x, y, z, ry, rx, rz, sx, sy, sz);
    this.list.push(p);
    return p;
  }
  push(g) { this.list.push(g); return g; }
  /** Apply fn(x, y, z) -> [x, y, z] to every vertex (a lean, a sag); normals are left as they are (small bends). */
  bend(fn, from = 0) {
    for (let k = from; k < this.list.length; k++) {
      const P = this.list[k].attributes.position.array;
      for (let i = 0; i < P.length; i += 3) { const q = fn(P[i], P[i + 1], P[i + 2]); P[i] = q[0]; P[i + 1] = q[1]; P[i + 2] = q[2]; }
    }
  }
  into(B, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    for (const g of this.list) B.push(place(g, x, y, z, ry, rx, rz));
    this.list.length = 0;
  }
}
const lineOn = (L, pts, w, color, nrm) => crack(L, pts, w, color, nrm);
/** A few low, flattened moss cushions around (x, y, z) (local), spread `sx` x `sz`. */
function moss(L, r, x, y, z, sx, sz, n = 3, size = 0.07) {
  for (let k = 0; k < n; k++) {
    const g = L.add(new THREE.SphereGeometry(size * (0.6 + r() * 0.7), 5, 3), r() < 0.5 ? '#4b6b2c' : '#3d5a26',
      x + (r() - 0.5) * sx, y, z + (r() - 0.5) * sz, r() * 6.28, 0, 0, 1.5, 0.42, 1);
    vgrad(g, 0.7, 1.15, 0.08, (r() * 1e6) | 0);
  }
}

// ------------------------------------------------------------------ gravestones
const STONE_DARK = '#25212b';
/**
 * A gravestone at (x, y, z) (y: the ground), yaw / tilt / roll (rad), kind 0 slab (a round, gothic-arch or shouldered
 * top), 1 cross (plain or Celtic), 2 obelisk, 3 low marker (sometimes broken); w / h / d its size (the top of kinds 0
 * and 1 at h - 0.05, the obelisk's tip at h + 0.28, as the crows expect); on a chamfered plinth, an engraving, cracks
 * and moss. Returns its top (local height).
 */
export function gravestone(B, { x, y, z, yaw = 0, tilt = 0, roll = 0, kind = 0, w = 0.8, h = 1, d = 0.2, shade = '#6f6b78' }) {
  const r = rngAt(x, z, 11), L = new Parts();
  const stone = (g, a = 0.78, b = 1.12) => vgrad(g, a, b, 0.05, (r() * 1e6) | 0);
  let top = h - 0.05;
  const zf = d / 2 + 0.004; // the front face
  if (kind === 0) {
    const t = r(), shape = t < 0.42 ? 'round' : t < 0.72 ? 'arch' : 'shoulder';
    stone(L.add(chamferBox(w + 0.18, 0.16, d + 0.16, 0.03), shade, 0, -0.03, 0), 0.6, 0.95);
    stone(L.add(slab(w, h - 0.1, d, shape, 0.022, (r() * 1e6) | 0), shade, 0, 0.05, 0));
    // an engraving: three lines of an epitaph, or a cross, under a carved arch line
    const ey = 0.05 + (h - 0.1) * 0.62;
    if (r() < 0.55) for (const [k, ww] of [[0, 0.5], [1, 0.36], [2, 0.44]]) lineOn(L, [[-w * ww / 2, ey - k * 0.09, zf], [w * ww / 2, ey - k * 0.09, zf]], 0.011, STONE_DARK);
    else { lineOn(L, [[0, ey + 0.12, zf], [0, ey - 0.16, zf]], 0.013, STONE_DARK); lineOn(L, [[-0.09, ey + 0.03, zf], [0.09, ey + 0.03, zf]], 0.013, STONE_DARK); }
    if (shape !== 'shoulder') {
      const ar = w * 0.36, cy = h - 0.05 - w / 2 - 0.02, pts = [];
      for (let k = 0; k <= 8; k++) { const a = Math.PI * (k / 8); pts.push([Math.cos(a) * ar, cy + Math.sin(a) * ar * (shape === 'arch' ? 1.2 : 0.85), zf]); }
      lineOn(L, pts, 0.007, '#3a3540');
    }
    // a crack down from the top edge (half of them), moss on the top and at the foot
    if (r() < 0.55) { const cx = (r() - 0.5) * w * 0.5; lineOn(L, crackPath(cx, h - 0.12, (h - 0.2) * 0.55, -Math.PI / 2 + (r() - 0.5) * 0.6, 5, r).map(([a, b]) => [a, b, zf + 0.001]), 0.009, '#1e1b22'); }
    moss(L, r, 0, h - 0.07 - w * 0.12, 0, w * 0.5, d * 0.5, 1 + ((r() * 2) | 0), 0.065);
    moss(L, r, 0, 0.06, d / 2 + 0.06, w * 0.8, 0.08, 1, 0.055);
  } else if (kind === 1) {
    stone(L.add(chamferBox(0.52, 0.14, 0.36, 0.03), shade, 0, -0.02, 0), 0.6, 0.9);
    stone(L.add(chamferBox(0.34, 0.14, 0.26, 0.025), shade, 0, 0.11, 0), 0.7, 1);
    stone(L.add(chamferBox(0.16, h - 0.2, 0.13, 0.025), shade, 0, 0.15 + (h - 0.2) / 2, 0));
    const ay = h * 0.72;
    stone(L.add(chamferBox(w, 0.15, 0.13, 0.025), shade, 0, ay, 0));
    if (r() < 0.45) { // Celtic: a ring round the crossing
      stone(L.add(new THREE.TorusGeometry(0.16, 0.028, 4, 14), shade, 0, ay, 0));
    }
    if (r() < 0.5) lineOn(L, crackPath((r() - 0.5) * 0.04, ay - 0.1, h * 0.3, -Math.PI / 2, 4, r).map(([a, b]) => [a, b, 0.07]), 0.008, '#1e1b22');
    moss(L, r, (r() - 0.5) * w * 0.6, ay + 0.08, 0, 0.1, 0.06, 2, 0.045);
    moss(L, r, 0, 0.19, 0, 0.3, 0.2, 2, 0.05);
  } else if (kind === 2) {
    stone(L.add(chamferBox(0.68, 0.16, 0.68, 0.03), shade, 0, 0.03, 0), 0.6, 0.9);
    stone(L.add(chamferBox(0.5, 0.14, 0.5, 0.025), shade, 0, 0.17, 0), 0.7, 1);
    const sh = h - 0.24;
    stone(L.add(flat(new THREE.CylinderGeometry(0.14, 0.21, sh, 4, 1).rotateY(Math.PI / 4)), shade, 0, 0.24 + sh / 2, 0), 0.75, 1.15);
    stone(L.add(chamferBox(0.25, 0.05, 0.25, 0.012), '#5a5664', 0, h - 0.04, 0), 0.9, 1.1);
    stone(L.add(flat(new THREE.ConeGeometry(0.16, 0.3, 4).rotateY(Math.PI / 4)), shade, 0, h + 0.13, 0), 0.9, 1.2);
    lineOn(L, [[-0.07, sh * 0.55, 0.19], [0.07, sh * 0.55, 0.19]], 0.012, STONE_DARK, [0, 0.17, 1]);
    moss(L, r, 0, 0.25, 0, 0.45, 0.45, 3, 0.06);
    top = h + 0.28;
  } else {
    const shape = r() < 0.4 ? 'broken' : r() < 0.6 ? 'flat' : 'round';
    stone(L.add(slab(w, h - 0.05, 0.16, shape, 0.02, (r() * 1e6) | 0), shade, 0, -0.05, 0));
    lineOn(L, [[-w * 0.25, (h - 0.05) * 0.45, 0.084], [w * 0.25, (h - 0.05) * 0.45, 0.084]], 0.01, STONE_DARK);
    moss(L, r, 0, h - 0.12, 0, w * 0.6, 0.1, 2, 0.05);
    if (shape === 'broken') { // the broken-off piece lying in the grass behind it
      stone(L.add(slab(w * 0.55, 0.22, 0.14, 'round', 0.015, 3), shade, w * 0.25, 0.02, -0.25, 0.4, -1.45, 0.1));
    }
  }
  L.into(B, x, y, z, yaw, tilt, roll);
  return top;
}

// ------------------------------------------------------------------ dead trees
/**
 * A gnarled dead tree, its foot at (x, y, z): a knotted trunk that flares into roots and leans, forks into 3 limbs,
 * each forking again into crooked branches ending in hooked twigs (lod 0: fewer, coarser: the hills outside the
 * fence). h: height, r: trunk radius, phase / crown: the wind sway (attribute sway = (weight, phase), the props
 * material bends it), seed: the local variation, yaw0: the first limb's heading.
 */
export function deadTree(B, { x, y, z, h, r, phase, crown, seed = 1, yaw0 = 0, lod = 1, bark = '#3b3036' }) {
  const rnd = mulberry32(seed), parts = [];
  const barkC = new THREE.Color(bark);
  const col = (k) => `#${barkC.clone().multiplyScalar(k).getHexString()}`;
  const tube = (pts, rad, sides, color, light = [0.7, 1.05]) => { const g = paint(sweep(pts, rad, sides, { caps: [false, 0] }), color); vgrad(g, light[0], light[1], 0.05, (rnd() * 1e6) | 0); parts.push(g); return g; };
  // trunk: from below the ground to the fork, leaning, knotted (its radius wobbles), flaring at the foot
  const lean = rnd() * Math.PI * 2, ln = (0.06 + rnd() * 0.1) * h;
  const fork = new THREE.Vector3(Math.cos(lean) * ln, h * (0.46 + rnd() * 0.1), Math.sin(lean) * ln);
  const tw = lean + 1.6 + rnd();
  const tp = curve([[0, -0.3, 0], [Math.cos(tw) * 0.06 * h, h * 0.16, Math.sin(tw) * 0.06 * h], [fork.x * 0.35 - Math.cos(tw) * 0.04 * h, fork.y * 0.5, fork.z * 0.35 - Math.sin(tw) * 0.04 * h], [fork.x * 0.85, fork.y * 0.82, fork.z * 0.85], [fork.x, fork.y, fork.z]], lod ? 8 : 5);
  const wob = rnd() * 10;
  tube(tp, (t) => r * (1 + 0.9 * Math.pow(Math.max(0, 1 - t * 2.6), 3)) * (1 - 0.32 * t) * (1 + 0.13 * Math.sin(t * 17 + wob) + 0.07 * Math.sin(t * 41 + wob * 2)), lod ? 6 : 5, col(1), [0.55, 1]);
  // a dark knot hole
  if (lod) {
    const t = 0.4, p = tp[Math.round(t * (tp.length - 1))], a = rnd() * Math.PI * 2;
    const g = paint(new THREE.SphereGeometry(r * 0.32, 6, 4).scale(0.8, 1.3, 0.35), '#120d12');
    place(g, p.x + Math.cos(a) * r * 0.86, p.y, p.z + Math.sin(a) * r * 0.86, Math.PI / 2 - a);
    parts.push(g);
  }
  // roots: crawling out from the foot and diving into the ground
  for (let k = 0, n = lod ? 4 : 3; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.8, ca = Math.cos(a), sa = Math.sin(a), L1 = r * (2.6 + rnd() * 1.6);
    tube(curve([[ca * r * 0.5, 0.35 * r, sa * r * 0.5], [ca * r * 1.3, 0.12 * r, sa * r * 1.3], [ca * L1 * 0.75, 0.0, sa * L1 * 0.75], [ca * L1, -0.15, sa * L1]], 4), (t) => r * 0.5 * (1 - 0.8 * t) + 0.01, 4, col(0.85), [0.5, 0.8]);
  }
  // limbs, branches, twigs
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  const branch = (o, dir, len, rad, depth) => {
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (side.lengthSq() < 0.1) side.set(1, 0, 0);
    const bendUp = depth >= 2 ? 0.16 : depth === 1 ? 0.02 : -0.08, k1 = (rnd() - 0.5) * 0.9, k2 = (rnd() - 0.5) * 0.9, k3 = (rnd() - 0.5) * 0.5;
    const p1 = o.clone().addScaledVector(dir, len * 0.3).addScaledVector(side, len * k1 * 0.22).addScaledVector(up, len * k3 * 0.15);
    const p2 = o.clone().addScaledVector(dir, len * 0.58).addScaledVector(up, len * bendUp * 0.7).addScaledVector(side, len * k2 * 0.22);
    const p3 = o.clone().addScaledVector(dir, len * 0.82).addScaledVector(up, len * bendUp).addScaledVector(side, -len * k1 * 0.12);
    const end = o.clone().addScaledVector(dir, len).addScaledVector(up, len * bendUp * 1.3).addScaledVector(side, len * k2 * 0.1);
    const pts = [o, p1, p2, p3, end];
    if (depth === 0 && lod) { // a hooked twig tip: it curls down and back
      tmp.copy(dir).multiplyScalar(-0.3).addScaledVector(up, -1).normalize();
      pts.push(end.clone().addScaledVector(dir, len * 0.12).addScaledVector(up, -len * 0.02), end.clone().addScaledVector(dir, len * 0.16).addScaledVector(tmp, len * 0.12));
    }
    const cp = curve(pts.map((p) => [p.x, p.y, p.z]), depth >= 2 ? 6 : 5);
    tube(cp, (t) => (rad * (1 - 0.62 * t) + 0.006) * (1 + 0.12 * Math.sin(t * 13 + depth * 2.1) * (depth >= 1 ? 1 : 0)), depth >= 2 ? (lod ? 5 : 4) : depth === 1 ? 4 : 3, col(1 + (2 - depth) * 0.07), [0.85, 1.12]);
    if (depth <= 0) return;
    const kids = depth >= 2 ? (lod ? 2 : 1) : lod ? 1 : 0;
    for (let k = 0; k < kids; k++) {
      const t = 0.55 + k * 0.3 + rnd() * 0.1, q = cp[Math.min(cp.length - 1, Math.round(t * (cp.length - 1)))];
      const a = (k ? 1 : -1) * (0.5 + rnd() * 0.5);
      const d2 = dir.clone().applyAxisAngle(up, a).addScaledVector(up, 0.25 + rnd() * 0.35).normalize();
      branch(q.clone(), d2, len * (0.5 + rnd() * 0.2), rad * 0.55, depth - 1);
    }
    if (depth === 1 && lod) branch(end.clone(), dir.clone().addScaledVector(up, 0.4).normalize(), len * 0.35, rad * 0.45, 0);
  };
  for (let k = 0; k < 3; k++) {
    const a = yaw0 + (k / 3) * Math.PI * 2 + rnd() * 0.9, el = 0.55 + rnd() * 0.45;
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(el), Math.cos(el), Math.sin(a) * Math.sin(el)).normalize();
    branch(fork.clone(), dir, h * (0.42 + rnd() * 0.18), r * 0.62, 2);
  }
  // wind sway: weight (height / crown)^2, one phase per tree; then into place
  for (const g of parts) {
    const P = g.attributes.position.array, W = new Float32Array((P.length / 3) * 2);
    for (let i = 0; i < P.length / 3; i++) { const k = Math.min(1, Math.max(0, P[i * 3 + 1] / crown)); W[i * 2] = k * k; W[i * 2 + 1] = phase; }
    g.setAttribute('sway', new THREE.BufferAttribute(W, 2));
    B.push(place(g, x, y, z));
  }
}

// ------------------------------------------------------------------ ironwork
const IRON = '#1b1822';
/**
 * Wrought-iron fence from (ax, az) to (bx, bz) on the ground groundAt(x, z): square posts with a collar and a flame
 * finial every ~1.2 m, two rails, three spear-tipped bars and a ring between the top rails per bay; gap(x, z) leaves
 * out posts and bays (the exits).
 */
export function ironFence(B, ax, az, bx, bz, groundAt, gap = null) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.2)), dx = (bx - ax) / n, dz = (bz - az) / n, yaw = Math.atan2(dx, dz);
  const L = new Parts();
  for (let i = 0; i <= n; i++) {
    const x = ax + dx * i, z = az + dz * i;
    if (gap && i > 0 && i < n && gap(x, z)) continue;
    const y = groundAt(x, z);
    L.add(new THREE.BoxGeometry(0.065, 1.5, 0.065), IRON, x, y + 0.72, z, yaw);
    L.add(new THREE.BoxGeometry(0.1, 0.05, 0.1), IRON, x, y + 1.47, z, yaw);
    L.add(new THREE.OctahedronGeometry(1, 0), IRON, x, y + 1.6, z, yaw, 0, 0, 0.045, 0.11, 0.045);
    if (i < n && !(gap && gap(x + dx / 2, z + dz / 2))) {
      const y1 = (y + groundAt(x + dx, z + dz)) / 2, l = Math.hypot(dx, dz);
      for (const hh of [0.3, 1.12, 1.24]) L.add(new THREE.BoxGeometry(0.035, 0.04, l), IRON, x + dx / 2, y1 + hh, z + dz / 2, yaw);
      for (let k = 1; k < 4; k++) { // bars with flat spear tips (in the fence's plane)
        const f = k / 4, xx = x + dx * f, zz = z + dz * f, yy = groundAt(xx, zz);
        L.add(new THREE.BoxGeometry(0.024, 1.32, 0.024), IRON, xx, yy + 0.64, zz, yaw);
        L.add(new THREE.OctahedronGeometry(1, 0), IRON, xx, yy + 1.37, zz, yaw, 0, 0, 0.012, 0.075, 0.032);
      }
      L.add(new THREE.TorusGeometry(0.05, 0.009, 3, 6), IRON, x + dx * 0.5, y1 + 1.18, z + dz * 0.5, yaw + Math.PI / 2);
    }
  }
  L.into(B);
}

/** A stone gate pillar on the ground at (x, y, z): plinth, a panelled shaft, a band, an overhanging cap, a ball finial. */
export function gatePost(B, x, y, z) {
  const r = rngAt(x, z, 5), L = new Parts(), S = '#5a5563';
  const st = (g, a = 0.72, b = 1.1) => vgrad(g, a, b, 0.05, (r() * 1e6) | 0);
  st(L.add(chamferBox(0.7, 0.4, 0.7, 0.04), '#4f4a58', 0, 0.08, 0), 0.6, 0.95);
  st(L.add(chamferBox(0.6, 0.08, 0.6, 0.02), '#5d5866', 0, 0.31, 0));
  st(L.add(chamferBox(0.5, 2.0, 0.5, 0.03), S, 0, 1.3, 0));
  for (const [a, b] of [[0, 0.255], [Math.PI / 2, 0.255]]) { // recessed panels on all four faces (dark outlines)
    for (const s of [1, -1]) {
      const c = Math.cos(a) * s, sn = Math.sin(a) * s, nrm = [sn, 0, c];
      const P = (u, v) => [u * Math.cos(a) + sn * b, v, -u * Math.sin(a) + c * b];
      lineOn(L, [P(-0.15, 0.55), P(0.15, 0.55), P(0.15, 1.45), P(-0.15, 1.45), P(-0.15, 0.55)], 0.012, '#2b2731', nrm);
    }
  }
  st(L.add(chamferBox(0.56, 0.08, 0.56, 0.02), '#514c5a', 0, 1.62, 0));
  st(L.add(chamferBox(0.66, 0.12, 0.66, 0.03), '#66616f', 0, 2.33, 0), 0.85, 1.2);
  st(L.add(chamferBox(0.5, 0.07, 0.5, 0.02), '#5d5866', 0, 2.42, 0));
  st(L.add(new THREE.CylinderGeometry(0.09, 0.15, 0.1, 10), '#5d5866', 0, 2.47, 0));
  st(L.add(new THREE.SphereGeometry(0.28, 12, 9), '#6b6675', 0, 2.68, 0), 0.75, 1.2);
  moss(L, r, 0, 2.4, 0, 0.5, 0.5, 3, 0.07);
  if (r() < 0.7) lineOn(L, crackPath(0.1, 2.0, 0.6, -Math.PI / 2 - 0.3, 4, r).map(([a, b]) => [a, b, 0.252]), 0.01, '#24202a');
  L.into(B, x, y, 0 + z);
}

/** The iron arch over a gate between gate posts at x0..x1 (z, ground y): two bars, scrolls between, a crescent moon. */
export function gateArch(B, x0, x1, y, z) {
  const L = new Parts(), cx = (x0 + x1) / 2, R = (x1 - x0) / 2;
  L.add(new THREE.TorusGeometry(R, 0.055, 4, 24, Math.PI), IRON, cx, y + 2.3, z);
  L.add(new THREE.TorusGeometry(R - 0.32, 0.04, 4, 22, Math.PI), IRON, cx, y + 2.3, z);
  for (let k = 1; k < 8; k++) { // C-scrolls between the two bars
    const a = (k / 8) * Math.PI, rr = R - 0.16, px = cx + Math.cos(a) * rr, py = y + 2.3 + Math.sin(a) * rr;
    L.add(new THREE.TorusGeometry(0.1, 0.02, 3, 10, Math.PI * 1.5), IRON, px, py, z, 0, 0, a + Math.PI * 0.25);
  }
  // a crescent moon at the top
  const moon = new THREE.Shape();
  moon.absarc(0, 0, 0.32, Math.PI * 0.3, Math.PI * 1.7, false);
  moon.absarc(0.14, 0, 0.25, Math.PI * 1.55, Math.PI * 0.45, true);
  L.add(new THREE.ExtrudeGeometry(moon, { depth: 0.04, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.02), IRON, cx, y + 2.3 + R + 0.32, z);
  L.add(star(0.09, 0.03).translate(0, 0, -0.015), IRON, cx + 0.06, y + 2.3 + R + 0.32, z);
  L.into(B);
}

// ------------------------------------------------------------------ the haunted house
const WOOD = '#3a2e33';
/** One window's dressing (local frame of a wall facing +z at z0): frame, mullions, sill, lintel, shutters. */
function windowDressing(L, r, lx, ly, z0, ww, hh, { trim = '#4e3f58', shutter = '#2d3a35', crooked = false, boarded = false } = {}) {
  const FR = '#16101a';
  // frame + mullions (the cross) in front of the glow
  L.add(chamferBox(ww + 0.16, 0.1, 0.1, 0.02), trim, lx, ly + hh / 2 + 0.04, z0 + 0.04);
  L.add(chamferBox(0.1, hh + 0.08, 0.1, 0.02), trim, lx - ww / 2 - 0.04, ly, z0 + 0.04);
  L.add(chamferBox(0.1, hh + 0.08, 0.1, 0.02), trim, lx + ww / 2 + 0.04, ly, z0 + 0.04);
  L.add(new THREE.BoxGeometry(ww, 0.07, 0.05), FR, lx, ly + 0.05, z0 + 0.06);
  L.add(new THREE.BoxGeometry(0.07, hh, 0.05), FR, lx, ly, z0 + 0.06);
  // a sill and a peaked lintel
  vgrad(L.add(chamferBox(ww + 0.36, 0.09, 0.22, 0.025), trim, lx, ly - hh / 2 - 0.06, z0 + 0.08), 0.8, 1.2);
  const ped = new THREE.Shape(); ped.moveTo(-(ww + 0.4) / 2, 0); ped.lineTo((ww + 0.4) / 2, 0); ped.lineTo(0, 0.26); ped.closePath();
  L.add(new THREE.ExtrudeGeometry(ped, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06), trim, lx, ly + hh / 2 + 0.1, z0 + 0.06);
  // shutters: louvred boards either side, one hanging askew now and then
  for (const s of [-1, 1]) {
    const sx = lx + s * (ww / 2 + 0.3), tilt = crooked && s > 0 ? -0.35 : 0;
    const g = L.add(chamferBox(0.42, hh + 0.05, 0.05, 0.015), shutter, 0, 0, 0);
    for (let k = 0; k < 5; k++) lineOn({ push: (q) => L.list.push(q) }, [[-0.15, -hh / 2 + 0.15 + k * (hh - 0.3) / 4, 0.03], [0.15, -hh / 2 + 0.15 + k * (hh - 0.3) / 4, 0.03]], 0.018, '#1b2420');
    // move this shutter (and its louvres) into place: pivot about its hinge for the crooked one
    const from = L.list.indexOf(g);
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    L.bend((x, y, z) => { // about the hinge: the shutter's top corner on the window side
      const px = x + s * 0.21, py = y - hh / 2, rx = px * c - py * sn, ry = px * sn + py * c;
      return [rx - s * 0.21 + sx, ry + hh / 2 + ly, z + z0 + 0.03];
    }, from);
  }
  if (boarded) for (const [a, oy] of [[0.5, 0.15], [-0.45, -0.2]]) {
    vgrad(L.add(chamferBox(ww + 0.35, 0.16, 0.05, 0.012), '#4a3a32', lx, ly + oy, z0 + 0.12, 0, 0, a), 0.8, 1.15);
  }
}

/**
 * The haunted house: footprint w x d at (x, y, z) turned by yaw (the front faces local +z), a stone foundation, clapboard
 * walls that lean a little, corner boards, a shingled gable roof with ragged rows and a crooked brick chimney, a corner
 * tower under a bent witch-hat roof with a weathervane, dressed windows (shutters, sills, lintels; one boarded up), an
 * arched door and a porch with turned posts, a railing, steps and a lantern. The glowing window panes, the lantern
 * flame and their halos go through ctx (light groups the game flickers).
 */
export function hauntedHouse(B, G, ctx, { x, y, z, w, d, yaw }) {
  const r = rngAt(x, z, 21), L = new Parts();
  const WALL = '#33293d', WALL2 = '#3d3148', ROOF = '#241c2b', TRIM = '#6b5a78', STONE = '#454050';
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  // ---- foundation + walls + siding + corner boards (main block)
  vgrad(L.add(chamferBox(w + 0.3, 0.8, d + 0.3, 0.05), STONE, 0, 0.2, 0), 0.6, 0.95);
  vgrad(L.add(new THREE.BoxGeometry(w, 5.6, d), WALL, 0, 3.2, 0), 0.75, 1.1);
  const siding = (len, axis, at, nrm, y0, y1) => {
    for (let yy = y0; yy < y1; yy += 0.34) {
      const pts = axis === 'x' ? [[-len / 2, yy, at], [len / 2, yy, at]] : [[at, yy, -len / 2], [at, yy, len / 2]];
      lineOn(L, pts, 0.014, '#1d1724', nrm);
    }
  };
  siding(w, 'x', d / 2 + 0.003, [0, 0, 1], 0.75, 6.0); siding(w, 'x', -d / 2 - 0.003, [0, 0, -1], 0.75, 6.0);
  siding(d, 'z', w / 2 + 0.003, [1, 0, 0], 0.75, 6.0); siding(d, 'z', -w / 2 - 0.003, [-1, 0, 0], 0.75, 6.0);
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.add(chamferBox(0.26, 5.6, 0.26, 0.03), TRIM, cx * w / 2, 3.2, cz * d / 2);
  vgrad(L.add(chamferBox(w + 0.5, 0.28, d + 0.5, 0.04), TRIM, 0, 6.05, 0), 0.8, 1.15);
  L.add(chamferBox(w + 0.12, 0.16, d + 0.12, 0.03), TRIM, 0, 3.4, 0); // the floor band
  // ---- gable roof: ridge along x; two slabs, ragged shingle rows, a ridge cap, gable ends with a round attic window
  const rh = 3.2, half = d / 2 + 0.6, slope = Math.atan2(rh, half), sl = Math.hypot(rh, half);
  for (const sd of [1, -1]) {
    L.add(chamferBox(w + 1.1, 0.16, sl + 0.1, 0.04), ROOF, 0, 6.2 + rh / 2, sd * half / 2, 0, sd * slope, 0);
    const rows = 11;
    for (let k = 0; k < rows; k++) { // shingle rows, bottom up, in 3-5 ragged pieces; a gap here and there
      const u = (k + 0.5) / rows, ry = 6.2 + rh * (1 - u) + 0.1, rz = sd * half * u;
      let xx = -(w + 1.1) / 2;
      while (xx < (w + 1.1) / 2 - 0.2) {
        const pw = Math.min((w + 1.1) / 2 - xx, 1.4 + r() * 2.2);
        if (r() > 0.06) {
          const g = L.add(new THREE.BoxGeometry(pw - 0.04, 0.07, sl / rows + 0.14), r() < 0.5 ? '#3b3046' : '#33293d', xx + pw / 2, ry + 0.04 + r() * 0.02, rz, (r() - 0.5) * 0.04, sd * (slope - 0.08), (r() - 0.5) * 0.05);
          vgrad(g, 0.85, 1.25, 0.06, (r() * 1e6) | 0);
        }
        xx += pw;
      }
    }
  }
  vgrad(L.add(chamferBox(w + 1.2, 0.18, 0.3, 0.05), '#2d2434', 0, 6.2 + rh + 0.12, 0), 0.9, 1.3);
  for (const sx of [-1, 1]) {
    const tri = new THREE.Shape(); tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, rh - 0.1); tri.closePath();
    vgrad(L.add(new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1), WALL2, sx * (w / 2 - 0.05), 6.2, 0, Math.PI / 2), 0.8, 1.05);
    L.add(new THREE.TorusGeometry(0.42, 0.07, 4, 16), TRIM, sx * (w / 2 + 0.07), 7.3, 0, Math.PI / 2);
    L.add(new THREE.CircleGeometry(0.4, 14), '#120c14', sx * (w / 2 + 0.06), 7.3, 0, sx * Math.PI / 2);
  }
  // ---- a cross gable over the right half of the front: its own little roof and a round attic window
  {
    const gx = 2.4, gw = 4.4, gh = 2.4, gd = 2.6, z0 = d / 2 - gd / 2 + 0.3, gs = Math.atan2(gh, gw / 2 + 0.3), gl = Math.hypot(gh, gw / 2 + 0.3);
    const tri = new THREE.Shape(); tri.moveTo(-gw / 2, 0); tri.lineTo(gw / 2, 0); tri.lineTo(0, gh); tri.closePath();
    vgrad(L.add(new THREE.ExtrudeGeometry(tri, { depth: gd, bevelEnabled: false }).translate(0, 0, -gd / 2), WALL2, gx, 6.15, z0), 0.85, 1.1);
    for (let yy = 6.4; yy < 6.15 + gh - 0.3; yy += 0.34) { const hw = (gw / 2) * (1 - (yy - 6.15) / gh) - 0.05; lineOn(L, [[gx - hw, yy, z0 + gd / 2 + 0.003], [gx + hw, yy, z0 + gd / 2 + 0.003]], 0.014, '#1d1724'); }
    for (const sd of [-1, 1]) {
      vgrad(L.add(chamferBox(0.16, gl + 0.2, gd + 0.5, 0.04), ROOF, gx + sd * (gw / 4 + 0.08), 6.15 + gh / 2 + 0.06, z0 + 0.2, 0, 0, sd * (Math.PI / 2 - gs)), 0.85, 1.25);
      L.add(chamferBox(0.1, gl + 0.15, 0.12, 0.02), TRIM, gx + sd * (gw / 4 + 0.02), 6.15 + gh / 2 - 0.02, z0 + gd / 2 + 0.3, 0, 0, sd * (Math.PI / 2 - gs));
    }
    L.add(new THREE.TorusGeometry(0.42, 0.08, 4, 16), TRIM, gx, 7.1, z0 + gd / 2 + 0.06);
    L.add(new THREE.CircleGeometry(0.4, 14), '#120c14', gx, 7.1, z0 + gd / 2 + 0.03);
    L.add(new THREE.BoxGeometry(0.06, 0.8, 0.04), TRIM, gx, 7.1, z0 + gd / 2 + 0.07);
    L.add(new THREE.BoxGeometry(0.8, 0.06, 0.04), TRIM, gx, 7.1, z0 + gd / 2 + 0.07);
  }
  // ---- the crooked chimney (bricks stacked off true), a cap, and a cowl
  {
    let cy = 7.4, ox = w / 2 - 2.0, oz = -0.9, k = 0;
    for (; k < 8; k++) {
      const g = L.add(chamferBox(0.72, 0.42, 0.72, 0.04), k % 2 ? '#4f3238' : '#462c33', ox, cy, oz, (r() - 0.5) * 0.12, (r() - 0.5) * 0.05, -0.04 * k);
      vgrad(g, 0.8, 1.1, 0.08, (r() * 1e6) | 0);
      lineOn(L, [[ox - 0.36, cy + 0.21, oz + 0.362], [ox + 0.36, cy + 0.21, oz + 0.362]], 0.012, '#24161a');
      cy += 0.4; ox -= 0.03 * k;
    }
    vgrad(L.add(chamferBox(0.92, 0.14, 0.92, 0.03), '#2b2230', ox - 0.05, cy - 0.12, oz, 0.1, 0, -0.18), 0.9, 1.2);
  }
  // ---- the tower (front left): walls, siding, bands, and a witch-hat roof with a bent tip and a weathervane
  const tx = -w / 2 + 1, tz = d / 2 - 1, TW = 3.2;
  const towerFrom = L.list.length;
  vgrad(L.add(chamferBox(TW + 0.2, 0.8, TW + 0.2, 0.05), STONE, tx, 0.2, tz), 0.6, 0.95);
  vgrad(L.add(new THREE.BoxGeometry(TW, 8.9, TW), WALL2, tx, 4.85, tz), 0.75, 1.1);
  for (const [nx, nz] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const at = (nx ? tx + nx * (TW / 2 + 0.003) : tz + nz * (TW / 2 + 0.003));
    for (let yy = 0.75; yy < 9.2; yy += 0.34) lineOn(L, nx ? [[at, yy, tz - TW / 2], [at, yy, tz + TW / 2]] : [[tx - TW / 2, yy, at], [tx + TW / 2, yy, at]], 0.014, '#1d1724', [nx, 0, nz]);
  }
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.add(chamferBox(0.24, 8.9, 0.24, 0.03), TRIM, tx + cx * TW / 2, 4.85, tz + cz * TW / 2);
  for (const by of [3.4, 6.2]) L.add(chamferBox(TW + 0.14, 0.16, TW + 0.14, 0.03), TRIM, tx, by, tz);
  vgrad(L.add(chamferBox(TW + 0.6, 0.26, TW + 0.6, 0.05), TRIM, tx, 9.4, tz), 0.85, 1.2);
  {
    // the roof: a flared eave ring of shingles, then a cone that bends over at the top
    const brim = lathe([[2.55, 9.45], [2.35, 9.75], [1.9, 10.2]], 8, { mod: (th) => 1 + 0.02 * Math.cos(th * 16) });
    brim.rotateY(Math.PI / 8);
    L.add(brim, ROOF, tx, 0, tz);
    for (let k = 0; k < 3; k++) { const rr = 2.0 - k * 0.42, yy = 10.15 + k * 0.62; L.add(flat(new THREE.CylinderGeometry(rr - 0.5, rr, 0.62, 8, 1, true).rotateY(Math.PI / 8)), k % 2 ? '#271e2d' : ROOF, tx, yy + 0.31, tz); }
    const sp = curve([[0, 12.0, 0], [0.04, 12.9, 0.05], [0.25, 13.7, 0.15], [0.7, 14.1, 0.25], [1.0, 13.9, 0.3]], 12);
    const cone = sweep(sp, (t) => 0.82 * Math.pow(1 - t, 0.9) + 0.02, 8, { caps: [false, 0.05] });
    vgrad(L.add(cone, ROOF, tx, 0, tz), 0.85, 1.25);
    // weathervane: a rod, an arrow and a little cat on the tip
    const vx = tx + 1.0, vy = 13.95, vz = tz + 0.3;
    L.add(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4), '#141016', vx, vy + 0.45, vz);
    L.add(new THREE.BoxGeometry(0.7, 0.03, 0.03), '#141016', vx, vy + 0.75, vz, 0.6);
    L.add(new THREE.ConeGeometry(0.07, 0.16, 4).rotateZ(-Math.PI / 2), '#141016', vx + Math.cos(0.6) * 0.38, vy + 0.75, vz - Math.sin(0.6) * 0.38, 0.6);
    const cat = new THREE.Shape(); // sitting cat silhouette
    cat.moveTo(-0.12, 0); cat.lineTo(0.12, 0); cat.quadraticCurveTo(0.16, 0.18, 0.06, 0.26); cat.lineTo(0.09, 0.36); cat.lineTo(0.03, 0.31); cat.lineTo(-0.03, 0.31); cat.lineTo(-0.09, 0.36); cat.lineTo(-0.06, 0.26); cat.quadraticCurveTo(-0.16, 0.18, -0.12, 0); cat.closePath();
    L.add(new THREE.ExtrudeGeometry(cat, { depth: 0.03, bevelEnabled: false }).translate(0, 0, -0.015), '#141016', vx, vy + 0.9, vz, 0.6);
  }
  // the tower leans the other way a touch
  L.bend((px, py, pz) => [px - 0.018 * Math.max(0, py - 0.6), py, pz + 0.008 * Math.max(0, py - 0.6)], towerFrom);
  // ---- windows (front: two floors; the tower), the glow panes in G (light groups)
  const winF = [[-2.2, 2.2], [3.6, 2.2], [-2.2, 4.6], [1.2, 4.6], [3.6, 4.6]];
  winF.forEach(([lx, ly], i) => windowDressing(L, r, lx, ly, d / 2, 1, 1.3, { crooked: i === 1 || i === 4, boarded: i === 2 }));
  windowDressing(L, r, tx, 7.6, d / 2 + 0.6, 0.9, 1.2, { crooked: true });
  windowDressing(L, r, tx, 4.2, d / 2 + 0.6, 0.8, 1.1, {});
  // ---- the door (arched, panelled, a brass knob) in a trimmed frame
  vgrad(L.add(slab(1.3, 2.35, 0.1, 'round', 0.02), '#3b1d2b', 1.2, 0.3, d / 2 + 0.02), 0.75, 1.1);
  for (const [px, py] of [[-0.3, 0.75], [0.3, 0.75], [-0.3, 1.55], [0.3, 1.55]]) lineOn(L, [[1.2 + px - 0.18, 0.3 + py - 0.25, d / 2 + 0.075], [1.2 + px + 0.18, 0.3 + py - 0.25, d / 2 + 0.075], [1.2 + px + 0.18, 0.3 + py + 0.25, d / 2 + 0.075], [1.2 + px - 0.18, 0.3 + py + 0.25, d / 2 + 0.075], [1.2 + px - 0.18, 0.3 + py - 0.25, d / 2 + 0.075]], 0.012, '#24101a');
  L.add(new THREE.SphereGeometry(0.06, 8, 6), '#d6a640', 1.7, 1.45, d / 2 + 0.11);
  for (const sx of [-0.78, 0.78]) L.add(chamferBox(0.16, 2.55, 0.16, 0.03), TRIM, 1.2 + sx, 1.5, d / 2 + 0.04);
  vgrad(L.add(slab(1.75, 0.4, 0.16, 'round', 0.02), TRIM, 1.2, 2.4, d / 2 + 0.04), 0.85, 1.15);
  // ---- the porch: a planked deck, steps, turned posts, a railing, a roof with brackets
  const pz = d / 2 + 1.0;
  vgrad(L.add(chamferBox(4.6, 0.3, 2.0, 0.04), WOOD, 1.2, 0.35, pz), 0.75, 1.1);
  for (let k = -4; k <= 4; k++) lineOn(L, [[1.2 + k * 0.48, 0.505, pz - 0.95], [1.2 + k * 0.48, 0.505, pz + 0.95]], 0.012, '#1f171a', [0, 1, 0]);
  for (const [sy, sz] of [[0.22, pz + 1.2], [0.08, pz + 1.55]]) vgrad(L.add(chamferBox(1.6, 0.16, 0.38, 0.03), WOOD, 1.2, sy, sz), 0.75, 1.1);
  for (const px of [-0.95, 3.35]) {
    L.add(chamferBox(0.26, 0.2, 0.26, 0.03), TRIM, px, 0.6, pz + 0.85);
    const post = lathe([[0.09, 0.0], [0.11, 0.15], [0.07, 0.4], [0.075, 1.2], [0.1, 1.35], [0.075, 1.5], [0.075, 2.1], [0.11, 2.25], [0.11, 2.4]], 8);
    vgrad(L.add(post, TRIM, px, 0.7, pz + 0.85), 0.8, 1.1);
    // a scrolled bracket under the porch roof
    const br = sweep(curve([[0, 2.95, 0], [0.3, 2.92, 0], [0.45, 3.05, 0]], 6).map((p) => p), 0.035, 3, { caps: [false, false] });
    L.add(br, TRIM, px + (px < 1 ? 0.08 : -0.08), 0, pz + 0.85, px < 1 ? 0 : Math.PI);
  }
  for (const [x0, x1] of [[-0.95, 0.35], [2.05, 3.35]]) { // railing (leaving the steps clear)
    L.add(chamferBox(x1 - x0, 0.08, 0.1, 0.02), TRIM, (x0 + x1) / 2, 1.45, pz + 0.85);
    for (let bx2 = x0 + 0.2; bx2 < x1 - 0.1; bx2 += 0.22) L.add(new THREE.BoxGeometry(0.05, 0.85, 0.05), TRIM, bx2, 1.02, pz + 0.85);
  }
  vgrad(L.add(chamferBox(4.9, 0.18, 2.3, 0.04), ROOF, 1.2, 3.12, pz + 0.05, 0, 0.12), 0.85, 1.2);
  L.add(chamferBox(4.9, 0.22, 0.08, 0.02), TRIM, 1.2, 3.0, pz + 1.18, 0, 0.12);
  // the whole house leans a little (the porch and the tower with it, the tower adds its own)
  L.bend((px, py, pz2) => [px + 0.03 * Math.max(0, py - 0.6), py - 0.004 * px * Math.max(0, py - 0.6) / 6, pz2]);
  L.into(B, x, y, z, yaw);
  // ---- glow: the porch lantern (a flame group), the windows (window groups: blink near midnight)
  {
    const [px, pz2] = W(2.3 + 0.03 * 2.3, d / 2 + 1.2);
    const LT = new Parts();
    LT.add(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), '#141016', 0, 2.72, 0);
    LT.add(new THREE.ConeGeometry(0.17, 0.14, 4).rotateY(Math.PI / 4), '#141016', 0, 2.53, 0);
    for (const [ex, ez] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) LT.add(new THREE.BoxGeometry(0.02, 0.26, 0.02), '#141016', ex * 0.085, 2.34, ez * 0.085);
    LT.add(new THREE.BoxGeometry(0.2, 0.03, 0.2), '#141016', 0, 2.2, 0);
    LT.into(B, px, y, pz2, yaw);
    const gp = ctx.glow('flame', 1);
    G.add(new THREE.BoxGeometry(0.15, 0.22, 0.15), '#ffb253', px, y + 2.34, pz2, yaw, 0, 0, 1, 1, 1, 2.4);
    ctx.spot(px, y + 2.34, pz2, 2.2, 0.55, 0.26, 0.07, 1, gp);
  }
  const lean = (lx, ly) => lx + 0.03 * Math.max(0, ly - 0.6);
  const win = (lx, ly, lz, ww, hh, col, k) => { const [px, pz2] = W(lx, lz); G.add(new THREE.PlaneGeometry(ww, hh), col, px, y + ly, pz2, yaw, 0, 0, 1, 1, 1, k); };
  for (const [lx, ly] of winF) {
    const green = ly > 4 && lx > 3, gw = ctx.glow('window', 0.2);
    win(lean(lx, ly), ly, d / 2 + 0.02, 1, 1.3, green ? '#9dff7a' : '#ffb347', 3.2);
    const [px, pz2] = W(lean(lx, ly), d / 2 + 0.5); // a soft halo in the air just outside each lit window
    ctx.spot(px, y + ly, pz2, 2.6, ...(green ? [0.08, 0.26, 0.06] : [0.32, 0.15, 0.04]), 0.2, gw);
  }
  ctx.glow('window', 0.2); win(lean(tx, 7.6) - 0.018 * 7, 7.6, d / 2 + 0.62 + 0.008 * 7, 0.9, 1.2, '#ffcf6a', 4);
  ctx.glow('window', 0.2); win(lean(tx, 4.2) - 0.018 * 3.6, 4.2, d / 2 + 0.62 + 0.008 * 3.6, 0.8, 1.1, '#ff9a3a', 3);
  ctx.glow('steady', 0);
}

// ------------------------------------------------------------------ the crypt
/**
 * A mausoleum at (x, y, z) facing +z: stepped plinth, a block of rusticated stone with pilasters, a cornice, a stone
 * roof whose ridge runs along x (its cap top at 5.06: the crows' perch), a portico of two fluted columns under a
 * pediment with a wreath, a banded double door, ivy, cracks and moss; the door candles and the green glow under the
 * door go through ctx.
 */
export function crypt(B, G, ctx, { x, y, z }) {
  const r = rngAt(x, z, 31), L = new Parts(), STONE = '#58535f', DARK = '#3b3743', LIGHT = '#6a6574';
  const st = (g, a = 0.75, b = 1.12) => vgrad(g, a, b, 0.05, (r() * 1e6) | 0);
  st(L.add(chamferBox(6.2, 0.32, 5.6, 0.05), DARK, 0, 0.1, 0.1), 0.6, 0.9);
  st(L.add(chamferBox(5.7, 0.3, 5.1, 0.05), STONE, 0, 0.4, 0.05), 0.65, 0.95);
  st(L.add(new THREE.BoxGeometry(5, 3.0, 4.4), STONE, 0, 2.05, 0));
  for (let yy = 0.85; yy < 3.5; yy += 0.42) { // courses of stone
    lineOn(L, [[-2.5, yy, 2.203], [2.5, yy, 2.203]], 0.016, '#34303b');
    for (const sx of [-1, 1]) lineOn(L, [[sx * 2.503, yy, -2.2], [sx * 2.503, yy, 2.2]], 0.016, '#34303b', [sx, 0, 0]);
  }
  for (const sx of [-1, 1]) st(L.add(chamferBox(0.36, 3.0, 0.36, 0.04), LIGHT, sx * 2.45, 2.05, 2.15));
  st(L.add(chamferBox(5.6, 0.32, 5.0, 0.05), DARK, 0, 3.6, 0), 0.8, 1.15);
  // the roof: two sloped slabs up to the ridge (along x), a ridge cap at 5.06, end blocks
  const rh = 1.2, half = 2.55, slope = Math.atan2(rh, half), sl = Math.hypot(rh, half);
  for (const sd of [1, -1]) st(L.add(chamferBox(5.5, 0.22, sl + 0.1, 0.05), DARK, 0, 3.76 + rh / 2, sd * half / 2, 0, sd * slope, 0), 0.8, 1.2);
  st(L.add(chamferBox(5.6, 0.2, 0.36, 0.05), '#46414f', 0, 4.96, 0), 0.9, 1.25);
  for (const sx of [-1, 1]) { const tri = new THREE.Shape(); tri.moveTo(-2.45, 0); tri.lineTo(2.45, 0); tri.lineTo(0, 1.1); tri.closePath(); st(L.add(new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1), STONE, sx * 2.6, 3.76, 0, Math.PI / 2)); }
  // portico: fluted columns with a base and a capital, a pediment with a wreath
  for (const sx of [-1.8, 1.8]) {
    const col = lathe([[0.3, 0], [0.3, 0.12], [0.25, 0.2], [0.24, 0.3], [0.21, 2.75], [0.26, 2.85], [0.32, 2.98]], 12, { mod: (th, t) => (t > 0.2 && t < 0.8 ? 1 - 0.07 * Math.abs(Math.sin(th * 6)) : 1) });
    st(L.add(col, LIGHT, sx, 0.55, 2.55), 0.75, 1.1);
    st(L.add(chamferBox(0.7, 0.12, 0.7, 0.03), LIGHT, sx, 3.58, 2.55));
  }
  st(L.add(chamferBox(4.6, 0.26, 0.8, 0.04), STONE, 0, 3.75, 2.55), 0.85, 1.15);
  {
    const tri = new THREE.Shape(); tri.moveTo(-2.35, 0); tri.lineTo(2.35, 0); tri.lineTo(0, 0.95); tri.closePath();
    st(L.add(new THREE.ExtrudeGeometry(tri, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }).translate(0, 0, -0.25), STONE, 0, 3.88, 2.55), 0.85, 1.2);
    st(L.add(new THREE.TorusGeometry(0.22, 0.05, 5, 14), LIGHT, 0, 4.22, 2.83));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; L.add(new THREE.SphereGeometry(0.05, 5, 3), '#4f6b33', Math.cos(a) * 0.22, 4.22 + Math.sin(a) * 0.22, 2.87, a, 0, 0, 1.4, 0.7, 0.6); }
  }
  // the door: banded iron double door, ring handles, a stone frame
  L.add(new THREE.BoxGeometry(1.6, 2.38, 0.1), '#141017', 0, 1.81, 2.22);
  for (const yy of [1.0, 1.75, 2.5]) L.add(new THREE.BoxGeometry(1.62, 0.07, 0.04), '#2c2832', 0, yy, 2.29);
  L.add(new THREE.BoxGeometry(0.04, 2.4, 0.04), '#2c2832', 0, 1.75, 2.29);
  for (const sx of [-0.18, 0.18]) L.add(new THREE.TorusGeometry(0.07, 0.014, 4, 10), '#3b3540', sx, 1.6, 2.31);
  st(L.add(chamferBox(2.0, 0.3, 0.3, 0.04), LIGHT, 0, 3.08, 2.22));
  for (const sx of [-0.9, 0.9]) st(L.add(chamferBox(0.22, 2.5, 0.28, 0.03), LIGHT, sx, 1.8, 2.22));
  st(L.add(chamferBox(3.6, 0.3, 1.2, 0.04), DARK, 0, 0.1, 2.9), 0.6, 0.95);
  // ivy up the front corners, cracks, moss
  for (const sx of [-1, 1]) {
    const pts = []; let px = sx * 2.25, py = 0.6;
    for (let k = 0; k < 12; k++) { pts.push([px, py, 2.25]); px += (r() - 0.5) * 0.35 - sx * 0.04; py += 0.25; }
    L.add(sweep(pts.map(([a, b, c]) => new THREE.Vector3(a, b, c)), 0.025, 3, { caps: [false, false] }), '#24361c');
    for (let k = 1; k < 12; k++) { const [a, b, c] = pts[k]; const g = L.add(new THREE.SphereGeometry(0.09, 5, 3), r() < 0.5 ? '#2f4a22' : '#3a5a28', a + (r() - 0.5) * 0.2, b, c + 0.03, r() * 6, 0, 0, 1.3, 0.9, 0.35); vgrad(g, 0.8, 1.2, 0.1, k); }
  }
  for (let k = 0; k < 3; k++) lineOn(L, crackPath((r() - 0.5) * 3, 3.3 - r() * 1.5, 1.0, -Math.PI / 2 + (r() - 0.5), 5, r).map(([a, b]) => [a, b, 2.205]), 0.014, '#24202a');
  moss(L, r, 0, 3.78, 2.3, 5, 0.3, 6, 0.1);
  moss(L, r, 0, 0.58, 2.35, 5, 0.3, 5, 0.09);
  L.into(B, x, y, z);
  // candles by the door (flame groups) + an eerie green crack of light under the door
  for (const sx of [-0.9, 0.9]) {
    const gc = ctx.glow('flame', 1);
    B.add(new THREE.CylinderGeometry(0.05, 0.055, 0.25, 6), '#d8d0c0', x + sx, y + 0.37, z + 2.75);
    B.add(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 3), '#1a1418', x + sx, y + 0.515, z + 2.75);
    G.add(new THREE.SphereGeometry(0.06, 6, 4).scale(1, 1.6, 1), '#ffcc66', x + sx, y + 0.57, z + 2.75, 0, 0, 0, 1, 1, 1, 5);
    ctx.spot(x + sx, y + 0.6, z + 2.75, 0.9, 0.45, 0.24, 0.06, 1, gc);
  }
  const gd = ctx.glow('brew', 0.5);
  G.add(new THREE.PlaneGeometry(1.5, 0.07), '#7dff9a', x, y + 0.585, z + 2.2, 0, 0, 0, 1, 1, 1, 4);
  ctx.spot(x, y + 0.75, z + 2.6, 2.2, 0.05, 0.22, 0.09, 0, gd);
  ctx.glow('steady', 0);
}

// ------------------------------------------------------------------ the scarecrow
/**
 * A scarecrow at (x, y, z) facing +z: a crooked post and crossbar, a ragged patched coat with a rope belt, sleeves
 * stuffed with straw (tufts at the cuffs, the collar and the hem), a carved pumpkin head (its face glows: a flame
 * group through ctx) under a floppy hat with a bent tip. Its arms are at 1.85 m (the crows sit on them).
 */
export function scarecrow(B, G, ctx, { x, y, z }) {
  const r = rngAt(x, z, 41), L = new Parts(), COAT = '#5a3d6e', STRAW = '#d4ac4f', POST = '#3d2c1e';
  L.add(sweep(curve([[0, -0.2, 0], [0.03, 1.2, 0.01], [-0.02, 2.4, 0]], 6), (t) => 0.075 - 0.02 * t, 6, { caps: [false, 0] }), POST);
  L.add(sweep(curve([[-1.0, 1.84, 0], [0, 1.86, 0], [1.0, 1.83, 0.02]], 5), 0.05, 6, { caps: [true, 0] }), POST);
  // the coat: a ragged bell from the shoulders, zigzag hem, patches, a rope belt, buttons
  const coat = lathe([[0.46, 1.0], [0.4, 1.25], [0.33, 1.6], [0.3, 1.85], [0.22, 2.0], [0.1, 2.05]], 18, {
    mod: (th, t) => 1 + 0.06 * (1 - t) * Math.cos(th * 7),
    dy: (th, t) => (t < 0.2 ? -0.09 * Math.abs(Math.sin(th * 4.5)) * (0.2 - t) / 0.2 : 0),
  });
  vgrad(L.add(coat, COAT), 0.7, 1.1);
  L.add(new THREE.BoxGeometry(0.16, 0.18, 0.02), '#7a5a3a', 0.12, 1.35, 0.375, 0, -0.1, 0.2);
  L.add(new THREE.BoxGeometry(0.14, 0.12, 0.02), '#3e5a6a', -0.16, 1.65, 0.32, 0, -0.15, -0.3);
  for (const [a, b, c, d] of [[0.06, 1.42, 0.12, 1.28], [0.18, 1.42, 0.06, 1.28]]) lineOn(L, [[a, b, 0.392], [c, d, 0.392]], 0.008, '#2a1c14');
  L.add(new THREE.TorusGeometry(0.385, 0.025, 4, 18).rotateX(Math.PI / 2), '#8a6a3a', 0, 1.4, 0);
  for (const yy of [1.55, 1.72]) L.add(new THREE.SphereGeometry(0.025, 6, 4), '#c9a24a', 0, yy, 0.33);
  // sleeves along the crossbar, ragged cuffs, straw spilling out
  for (const s of [1, -1]) {
    L.add(sweep(curve([[s * 0.2, 1.85, 0], [s * 0.55, 1.86, 0], [s * 0.88, 1.84, 0]], 5), (t) => 0.16 - 0.04 * t, 8, { caps: [false, false] }), COAT);
    L.add(lathe([[0.12, 0], [0.15, 0.08], [0.17, 0.12]], 10, { dy: (th, t) => (t > 0.5 ? -0.04 * Math.abs(Math.sin(th * 3)) : 0) }).rotateZ(-s * Math.PI / 2), '#4a3060', s * 0.86, 1.85, 0);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; L.add(new THREE.ConeGeometry(0.018, 0.22, 3).rotateZ(-s * Math.PI / 2), STRAW, s * (1.02 + r() * 0.05), 1.85 + Math.sin(a) * 0.06, Math.cos(a) * 0.06, 0, (r() - 0.5) * 0.6, (r() - 0.5) * 0.8); }
  }
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; L.add(new THREE.ConeGeometry(0.02, 0.2, 3).rotateX(Math.PI), STRAW, Math.sin(a) * 0.4, 0.95, Math.cos(a) * 0.4, 0, Math.cos(a) * 0.3, -Math.sin(a) * 0.3); }
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; L.add(new THREE.ConeGeometry(0.016, 0.16, 3), STRAW, Math.sin(a) * 0.14, 2.07, Math.cos(a) * 0.14, 0, Math.cos(a) * 0.6, -Math.sin(a) * 0.6); }
  // the head: a small ribbed pumpkin, a floppy hat with a band and a bent tip
  const head = pumpkinGeometry(0.29, 24, 0, '#ff7a1a', '#4a5a22', { lobes: 6, depth: 0.1, seed: 9 });
  head.deleteAttribute('rib');
  L.push(place(head, 0, 2.02, 0));
  const hb = lathe([[0.22, 2.44], [0.4, 2.42], [0.46, 2.46], [0.4, 2.45], [0.22, 2.47]], 20, { mod: (th) => 1 + 0.05 * Math.sin(th * 3), dy: (th, t) => (t > 0.2 && t < 0.9 ? -0.05 * Math.cos(th * 2) : 0) });
  L.add(hb, '#2a2030');
  L.add(sweep(curve([[0, 2.44, 0], [0, 2.62, -0.02], [0.03, 2.8, -0.08], [0.1, 2.88, -0.18], [0.16, 2.82, -0.26]], 12), (t) => 0.22 * Math.pow(1 - t, 0.9) + 0.01, 10, { caps: [false, 0.02] }), '#2a2030');
  L.add(new THREE.CylinderGeometry(0.225, 0.22, 0.06, 14, 1, true), '#7a2a3a', 0, 2.48, 0);
  L.into(B, x, y, z);
  // the carved face glows (a flame group)
  ctx.glow('flame', 0.6); // the face's light group
  const face = new THREE.BufferGeometry(), v = [], R = 0.29;
  const tri = (pts) => { for (const [px, py] of pts) { const zz = Math.sqrt(Math.max(0.01, R * R * 0.94 - px * px - (py * 1.2) ** 2)) * 1.0 + 0.012; v.push(px, py, zz); } };
  tri([[-0.15, 0.04], [-0.04, 0.04], [-0.095, 0.13]]); tri([[0.04, 0.04], [0.15, 0.04], [0.095, 0.13]]);
  for (let i = 0; i < 6; i++) { const a0 = -0.9 + i * 0.3, a1 = a0 + 0.3; tri([[Math.sin(a0) * 0.15, -0.05 - Math.cos(a0) * 0.05], [Math.sin(a0) * 0.12, -0.07 - Math.cos(a0) * 0.015 - (i === 2 ? 0.02 : 0)], [Math.sin(a1) * 0.15, -0.05 - Math.cos(a1) * 0.05]]); tri([[Math.sin(a0) * 0.12, -0.07 - Math.cos(a0) * 0.015 - (i === 2 ? 0.02 : 0)], [Math.sin(a1) * 0.12, -0.07 - Math.cos(a1) * 0.015], [Math.sin(a1) * 0.15, -0.05 - Math.cos(a1) * 0.05]]); }
  face.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  G.add(face, '#ffd27a', x, y + 2.02 + 0.76 * R * 0.9, z, 0, 0, 0, 1, 1, 1, 3);
  ctx.glow('steady', 0);
}

// ------------------------------------------------------------------ the cauldron
/**
 * A witch's cauldron at (x, y, z): a pot-bellied iron pot with a rolled rim, claw feet and ring handles, bubbling
 * glowing brew with a ladle in it and goo dripping over the rim, on crossed logs over embers in a ring of stones (the
 * brew and the embers are light groups through ctx). Its rim is at 1.24 m.
 */
export function cauldron(B, G, ctx, { x, y, z }) {
  const r = rngAt(x, z, 51), L = new Parts(), IRONC = '#1d1a23';
  const pot = lathe([[0, 0.12], [0.35, 0.14], [0.72, 0.35], [0.88, 0.7], [0.82, 1.02], [0.66, 1.18], [0.62, 1.22]], 22);
  vgrad(L.add(pot, IRONC), 0.7, 1.35);
  L.add(new THREE.TorusGeometry(0.66, 0.075, 6, 24).rotateX(Math.PI / 2), '#2a2631', 0, 1.24, 0);
  L.add(lathe([[0.6, 1.22], [0.55, 1.1]], 22), '#0d0b10'); // the inside below the brew
  for (let k = 0; k < 3; k++) { // claw feet
    const a = k * 2.094 + 0.5, ca = Math.cos(a), sa = Math.sin(a);
    L.add(sweep(curve([[ca * 0.45, 0.32, sa * 0.45], [ca * 0.62, 0.12, sa * 0.62], [ca * 0.72, -0.02, sa * 0.72], [ca * 0.84, 0.0, sa * 0.84]], 5), (t) => 0.1 - 0.06 * t, 5, { caps: [false, 0.02] }), IRONC);
  }
  for (const s of [1, -1]) L.add(new THREE.TorusGeometry(0.13, 0.025, 4, 12), '#2a2631', s * 0.86, 0.95, 0, Math.PI / 2);
  // the ladle: a handle leaning out of the brew, its bowl under the surface
  L.add(sweep(curve([[0.2, 1.0, 0.1], [0.42, 1.5, 0.25], [0.52, 1.8, 0.32]], 5), 0.04, 5, { caps: [false, 0.012] }), '#3a2618');
  // logs (bark brown, pale cut ends) and a ring of rounded stones
  for (let k = 0; k < 3; k++) {
    const a = k * 1.05 + 0.3;
    L.add(new THREE.CylinderGeometry(0.09, 0.1, 1.2, 7).rotateZ(Math.PI / 2), '#3a2618', 0, 0.1, 0, a);
    for (const s of [1, -1]) L.add(new THREE.CircleGeometry(0.085, 7), '#9a7a52', Math.cos(a) * s * 0.605, 0.1, -Math.sin(a) * s * 0.605, a + (s > 0 ? Math.PI / 2 : -Math.PI / 2));
  }
  for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2 + r() * 0.2, g = L.add(new THREE.DodecahedronGeometry(0.2 + r() * 0.08, 0), r() < 0.5 ? '#4a4550' : '#55505c', Math.cos(a) * 1.25, 0.04, Math.sin(a) * 1.25, a, 0.3, 0.2, 1, 0.6, 1); vgrad(g, 0.65, 1.15, 0.06, k); }
  L.into(B, x, y, z);
  // embers, the brew with bubbles and drips over the rim (glow)
  const ge = ctx.glow('ember', 1);
  G.add(new THREE.SphereGeometry(0.3, 8, 4).scale(1.6, 0.25, 1.6), '#ff6a1a', x, y + 0.12, z, 0, 0, 0, 1, 1, 1, 3);
  for (let k = 0; k < 5; k++) { const a = r() * 6.28, d = r() * 0.4; G.add(new THREE.SphereGeometry(0.05, 4, 3), '#ffb04a', x + Math.cos(a) * d, y + 0.16, z + Math.sin(a) * d, 0, 0, 0, 1, 1, 1, 3); }
  const gb = ctx.glow('brew', 0.4);
  G.add(new THREE.CircleGeometry(0.62, 22).rotateX(-Math.PI / 2), '#5dff6e', x, y + 1.18, z, 0, 0, 0, 1, 1, 1, 2.6);
  for (let k = 0; k < 7; k++) { const a = r() * 6.28, d = r() * 0.45, s2 = 0.04 + r() * 0.06; G.add(new THREE.SphereGeometry(s2, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#8dff8a', x + Math.cos(a) * d, y + 1.18, z + Math.sin(a) * d, 0, 0, 0, 1, 1, 1, 2.8); }
  for (let k = 0; k < 2; k++) { // goo dripping down the outside
    const a = (k / 3) * Math.PI * 2 + r(), ca = Math.cos(a), sa = Math.sin(a), len = 0.08 + r() * 0.14;
    G.add(sweep(curve([[ca * 0.72, 1.27, sa * 0.72], [ca * 0.82, 1.12, sa * 0.82], [ca * 0.87, 1.12 - len, sa * 0.87]], 5), (t) => 0.022 * (1 - 0.3 * t) + (t > 0.85 ? 0.01 : 0), 4, { caps: [false, 0.02] }), '#4ad85a', x, y, z, 0, 0, 0, 1, 1, 1, 0.9);
  }
  ctx.spot(x, y + 1.45, z, 3.2, 0.1, 0.42, 0.12, 0.4, gb);
  ctx.spot(x, y + 0.2, z, 2.2, 0.5, 0.18, 0.03, 1, ge);
  ctx.glow('steady', 0);
}

// ------------------------------------------------------------------ hay bales
/**
 * A round hay bale lying at (x, y, z), its axis along ry: rounded edges, a sagging belly, straw streaks round the
 * barrel and a spiral painted on the ends, two twine bands, a few loose straws.
 */
export function hayBale(B, { x, y, z, ry = 0 }) {
  const r = rngAt(x, z, 61), L = new Parts(), R = 0.6, H = 0.55;
  const prof = [[0, -H], [0.25, -H], [0.45, -H + 0.005], [R - 0.06, -H + 0.03], [R, -H + 0.16], [R, H - 0.16], [R - 0.06, H - 0.03], [0.45, H - 0.005], [0.25, H], [0, H]];
  const g = lathe(prof, 18, { mod: (th, t) => 1 + 0.02 * Math.sin(th * 9 + t * 7) });
  paint(g, '#c9a04c');
  const ph = r() * 10;
  shade(g, (px, py, pz) => {
    const rr = Math.hypot(px, pz), a = Math.atan2(px, pz);
    const end = Math.abs(py) > H - 0.03 ? 1 : 0;
    const spiral = end ? 0.82 + 0.25 * (0.5 + 0.5 * Math.sin(rr * 42 + a * 1.0 + ph)) : 1; // rings on the ends
    const streak = end ? 1 : 0.85 + 0.25 * (0.5 + 0.5 * Math.sin(a * 37 + Math.sin(py * 13) * 2 + ph));
    return spiral * streak * (0.9 + r() * 0.15);
  });
  g.rotateZ(Math.PI / 2); // axis along x
  const P = g.attributes.position.array;
  for (let i = 0; i < P.length; i += 3) if (P[i + 1] < 0) P[i + 1] *= 0.86; // it sags where it sits
  g.computeVertexNormals();
  L.push(place(g, 0, R * 0.86, 0));
  for (const k of [-0.28, 0.28]) L.add(new THREE.TorusGeometry(R + 0.008, 0.016, 3, 16).rotateY(Math.PI / 2), '#5e4520', k, R * 0.86, 0, 0, 0, 0, 1, 0.93, 1);
  for (let k = 0; k < 5; k++) { const a = r() * 6.28, sx = (r() - 0.5) * 0.9; L.add(new THREE.ConeGeometry(0.012, 0.22, 3), '#d8b25a', sx, R * 0.86 + Math.cos(a) * R * 0.95, Math.sin(a) * R, 0, Math.sin(a) * 1.2 + (r() - 0.5), (r() - 0.5) * 1.2); }
  L.into(B, x, y, z, ry);
}
