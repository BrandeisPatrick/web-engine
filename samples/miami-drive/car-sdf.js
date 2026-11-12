// The hero car's body as a signed distance field, meshed with marching cubes (no asset file: the car is code).
// An original early-90s full-size three-box sedan: long flat hood, raked windscreen, long flat roof, an upright rear
// window over a long trunk deck, wide ribbed tail lamps. Side views are polygons with hard corners where the body has
// creases, intersected with plan / cross-section widths with 1.5-3 cm blends, so panel edges stay crisp. Wheel wells,
// lamp pockets, grille, plate and exhaust openings are subtracted from it. One marching-cubes pass over a narrow
// band around the surface (mirror-symmetric: only x >= 0 is evaluated), vertex normals from the field's gradient.
// Regions (glass, frit, lamps, grille, plate, wells, underside) are not split into meshes: the uber material in
// car-model.js evaluates the same masks per pixel in object space (CAR_GLSL), so every edge is exact.
// Pure: three.js math only, runs in Node.
//
//   const { geometry, stats } = buildCarBody({ voxel: 0.02 });
//
// Car frame: x right, y up (0 = the tyre contact plane at the static load), z towards the REAR (forward = -Z, the
// engine's convention). Length 4.86 m (z -2.43 .. 2.43), width 1.80 m, height 1.40 m, wheels at z -1.42 / +1.30.
import * as THREE from 'three';
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; }

// ------------------------------------------------------------------ 2D profiles (Catmull-Rom sampled polygons)
function catmull(points, perSeg) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n - 1, i + 2)];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  const l = points[n - 1]; out.push(l[0], l[1]);
  return out;
}
/** Polygon as a flat [u, v, ...] array + a coarse distance grid for fast lookups. */
class Profile {
  constructor(flat, cell = 0.004) {
    this.v = Float64Array.from(flat);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < flat.length; i += 2) { u0 = Math.min(u0, flat[i]); u1 = Math.max(u1, flat[i]); v0 = Math.min(v0, flat[i + 1]); v1 = Math.max(v1, flat[i + 1]); }
    const pad = 0.12;
    this.u0 = u0 - pad; this.v0 = v0 - pad; this.cell = cell;
    this.nu = Math.ceil((u1 - u0 + 2 * pad) / cell) + 1; this.nv = Math.ceil((v1 - v0 + 2 * pad) / cell) + 1;
    const g = this.g = new Float32Array(this.nu * this.nv);
    for (let j = 0; j < this.nv; j++) for (let i = 0; i < this.nu; i++) g[j * this.nu + i] = this.exact(this.u0 + i * cell, this.v0 + j * cell);
  }
  exact(px, py) { // iq's polygon SDF
    const V = this.v, n = V.length / 2;
    let d = (px - V[0]) ** 2 + (py - V[1]) ** 2, s = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const ex = V[2 * j] - V[2 * i], ey = V[2 * j + 1] - V[2 * i + 1];
      const wx = px - V[2 * i], wy = py - V[2 * i + 1];
      const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
      const bx = wx - ex * h, by = wy - ey * h;
      d = Math.min(d, bx * bx + by * by);
      const c1 = py >= V[2 * i + 1], c2 = py < V[2 * j + 1], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  }
  at(u, v) { // bilinear lookup; outside the grid: distance to the grid plus its edge value
    const fu = (u - this.u0) / this.cell, fv = (v - this.v0) / this.cell;
    const iu = Math.floor(fu), iv = Math.floor(fv);
    if (iu < 0 || iv < 0 || iu >= this.nu - 1 || iv >= this.nv - 1) {
      const cu = clamp(iu, 0, this.nu - 1), cv = clamp(iv, 0, this.nv - 1);
      return this.g[cv * this.nu + cu] + Math.hypot(Math.max(0, Math.abs(fu - cu)) * this.cell, Math.max(0, Math.abs(fv - cv)) * this.cell);
    }
    const tu = fu - iu, tv = fv - iv, g = this.g, k = iv * this.nu + iu;
    return (g[k] * (1 - tu) + g[k + 1] * tu) * (1 - tv) + (g[k + this.nu] * (1 - tu) + g[k + this.nu + 1] * tu) * tv;
  }
}

// ------------------------------------------------------------------ the sedan (an original early-90s three-box design)
// 4.85 m long, 1.80 m wide, 1.40 m tall, 2.72 m wheelbase. Side views are polygons with hard corners where the car has
// creases (the nose, the hood and trunk edges, the deck end, the roof edges); the corners that should be soft are
// sampled as short arcs. Blend radii are 1.5-3 cm, so the panel edges stay crisp at chase-camera distance.
const arc = (cz, cy, r, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); o.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
// side view of the lower body (z, y): bumper, nose, hood, cowl, the flat deck of the long trunk, the tail panel, floor
const LOWER = [
  [-2.3, 0.2], [-2.39, 0.27], [-2.43, 0.38], [-2.43, 0.52], [-2.41, 0.6], [-2.36, 0.665], [-2.22, 0.705],
  [-1.6, 0.775], [-1.0, 0.835], [-0.72, 0.86], [0.2, 0.875], [1.2, 0.9],
  [1.4, 0.93], [2.28, 0.955], [2.37, 0.94], [2.41, 0.88], [2.43, 0.72], [2.43, 0.56], [2.41, 0.4], [2.37, 0.28], [2.3, 0.2],
  [1.6, 0.152], [0, 0.145], [-1.6, 0.152],
];
// side view of the cabin (z, y): raked windscreen, a long flat roof, an upright rear window down to the deck
const CABIN = [
  [-0.86, 0.72], [-0.7, 0.855], [-0.16, 1.345], ...arc(-0.05, 1.29, 0.1, 2.0, 1.65, 3), [0.85, 1.395], ...arc(0.86, 1.3, 0.095, 1.45, 0.9, 3),
  [1.3, 0.94], [1.42, 0.9], [1.42, 0.7], [-0.86, 0.7],
];
let PROFILES = null;
function profiles() {
  if (PROFILES) return PROFILES;
  PROFILES = { lower: new Profile(LOWER.flat(), 0.003), cabin: new Profile(CABIN.flat(), 0.003) };
  return PROFILES;
}

const WHEELS_Z = [-1.42, 1.30], WHEEL_Y = 0.33, WELL_R = 0.385;
const gauss = (x) => Math.exp(-x * x);

/** Half width of the lower body at (y, z): square corners in plan with a 12 cm radius, a slab side with a slight
 *  tumblehome above the shoulder line and a stepped rocker. */
function lowerHalfWidth(y, z) {
  let w = 0.9;
  const fz = Math.max(0, -2.31 - z), rz = Math.max(0, z - 2.31);           // the last 12 cm of each end round off
  const e = Math.min(0.12, Math.max(fz, rz));
  if (e > 0) w -= 0.12 - Math.sqrt(0.0144 - e * e);
  w -= 0.012 * smooth(-1.6, -2.4, z);                                       // the nose a touch narrower
  if (y > 0.76) w -= (y - 0.76) * 0.22;                                      // tumblehome above the shoulder line
  w += 0.006 * gauss((y - 0.76) / 0.01);                                     // the shoulder crease
  w -= 0.022 * smooth(0.31, 0.29, y);                                        // the rocker step
  return w;
}
function cabinHalfWidth(y, z) {
  const t = clamp((y - 0.85) / 0.55, 0, 1);
  let w = 0.82 - 0.17 * t;
  w -= 0.03 * smooth(0.7, 1.35, z) + 0.02 * smooth(-0.3, -0.75, z);
  return w;
}
// side window outline: the A-pillar line follows the windscreen, the C-pillar the rear window (z as a function of y)
const zA = (y) => -0.7 + ((y - 0.855) / 0.49) * 0.54 + 0.11;
const zC = (y) => 1.2 - ((y - 0.94) / 0.4) * 0.38;

/** Region masks (negative inside), mirrored by CAR_GLSL in car-model.js. */
const M = {
  windscreen(x, y, z) { return smax(smax(z + 0.15, 0.89 - y, 0.03), Math.abs(x) - (cabinHalfWidth(y, z) - 0.075), 0.04); },
  rear(x, y, z) { return smax(smax(Math.max(0.94 - z, z - 1.28), 0.95 - y, 0.03), Math.abs(x) - (cabinHalfWidth(y, z) - 0.09), 0.05); },
  side(x, y, z) {
    const a = smax(smax(0.9 - y, y - 1.33, 0.02), smax(zA(y) - z, z - zC(y), 0.03), 0.03);
    return Math.max(a, (cabinHalfWidth(y, z) - 0.06) - Math.abs(x));
  },
  head(x, y, z) { const ax = Math.abs(x); return smax(smax(Math.max(0.39 - ax, ax - 0.8), Math.max(0.56 - y, y - 0.655), 0.012), z + 2.3, 0.01); },
  tail(x, y, z) { const ax = Math.abs(x); return smax(smax(Math.max(0.42 - ax, ax - 0.835), Math.max(0.7 - y, y - 0.84), 0.012), 2.3 - z, 0.01); },
  grille(x, y, z) { const ax = Math.abs(x); return Math.min(smax(smax(ax - 0.34, Math.max(0.565 - y, y - 0.65), 0.01), z + 2.3, 0.01), smax(smax(ax - 0.62, Math.max(0.28 - y, y - 0.4), 0.04), z + 2.3, 0.01)); },
  plate(x, y, z) { const ax = Math.abs(x); return smax(smax(ax - 0.25, Math.max(0.7 - y, y - 0.835), 0.01), 2.3 - z, 0.01); },
  handle(x, y, z) { const ax = Math.abs(x); return Math.max(Math.min(smax(Math.abs(z - 0.28) - 0.075, Math.abs(y - 0.79) - 0.016, 0.01), smax(Math.abs(z - 0.8) - 0.075, Math.abs(y - 0.79) - 0.016, 0.01)), 0.6 - ax); },
};
// pockets carved into the skin (m deep); the glass is flush and drawn by the material from the same masks
const RECESS = { head: 0.02, tail: 0.016, grille: 0.03, plate: 0.008, handle: 0.006 };
const CARVE = Object.keys(RECESS);

function wellSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = Infinity;
  for (const wz of WHEELS_Z) d = Math.min(d, Math.hypot(z - wz, y - WHEEL_Y) - WELL_R);
  return Math.max(d, 0.48 - ax);
}

/** The body before any carving (lower body + cabin, wells cut, arch lips). */
function baseSdf(x, y, z) {
  const P = profiles(), ax = Math.abs(x);
  const lower = smax(P.lower.at(z, y), ax - lowerHalfWidth(y, z), 0.022);
  const cabin = smax(P.cabin.at(z, y), ax - cabinHalfWidth(y, z), 0.03);
  let d = smin(lower, cabin, 0.02);
  if (y > 0.2 && ax > 0.72) for (const wz of WHEELS_Z) {
    const r = Math.hypot(z - wz, y - WHEEL_Y);
    if (Math.abs(r - WELL_R) > 0.1) continue;
    const ring = Math.hypot(r - (WELL_R + 0.01), ax - (lowerHalfWidth(y, z) - 0.002)) - 0.018;
    d = smin(d, ring, 0.012);
  }
  return smax(d, -wellSdf(x, y, z), 0.006);
}

/** Final body SDF: the base with every region recessed (walls 'rubber', floors 'glass' / lamps / grille ...). */
function bodySdf(x, y, z) {
  const b = baseSdf(x, y, z);
  if (b > 0.06 || b < -0.12) return b; // far from the skin: no carving
  let d = b;
  for (let i = 0; i < CARVE.length; i++) {
    const k = CARVE[i], m = M[k](x, y, z);
    if (m > 0.02) continue;
    const cut = Math.max(m, -(b + RECESS[k]));
    d = Math.max(d, -cut);
  }
  return d;
}

// ------------------------------------------------------------------ marching cubes (narrow band, mirrored in x)
// corner offsets and edges in three's MarchingCubes order (see examples/jsm/objects/MarchingCubes.js)
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const EDGE = [[0, 0], [1, 1], [3, 0], [0, 1], [4, 0], [5, 1], [7, 0], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2]]; // [corner, axis]

/**
 * Mesh an SDF over a box with marching cubes. Returns { pos: Float32Array, nrm: Float32Array, idx: Uint32Array }.
 * Only cells within `band` x the cell diagonal of the surface (from a coarse pre-pass) are evaluated.
 */
export function marchSdf(sdf, box, h) {
  let [x0, y0, z0, x1, y1, z1] = box;
  const sym = Math.abs(x0 + x1) < 1e-9;
  if (sym) { const half = Math.ceil(x1 / h); x0 = -half * h; x1 = half * h; } // exact mirror grid: x_i = -x_(nx-1-i)
  const nx = Math.round((x1 - x0) / h) + 1, ny = Math.ceil((y1 - y0) / h) + 1, nz = Math.ceil((z1 - z0) / h) + 1;
  const N = nx * ny * nz;
  const field = new Float32Array(N).fill(NaN);
  const C = 4, cnx = Math.ceil((nx - 1) / C) + 1, cny = Math.ceil((ny - 1) / C) + 1, cnz = Math.ceil((nz - 1) / C) + 1;
  const val = (i, j, k) => {
    const q = (k * ny + j) * nx + i;
    let v = field[q];
    if (v === v) return v;
    if (sym && i < (nx - 1) / 2) { v = val(nx - 1 - i, j, k); field[q] = v; return v; }
    v = sdf(x0 + i * h, y0 + j * h, z0 + k * h); field[q] = v; return v;
  };
  // coarse pass
  const cv = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    cv[(k * cny + j) * cnx + i] = val(Math.min(nx - 1, i * C), Math.min(ny - 1, j * C), Math.min(nz - 1, k * C));
  }
  const reach = C * h * 1.75 * 1.4; // block diagonal x a Lipschitz allowance
  const pos = [], idx = [];
  const vmap = new Map();
  const vertexOn = (i, j, k, axis, va, vb) => {
    const key = ((k * ny + j) * nx + i) * 3 + axis;
    let id = vmap.get(key);
    if (id !== undefined) return id;
    const t = va / (va - vb);
    const p = [x0 + i * h, y0 + j * h, z0 + k * h];
    p[axis] += t * h;
    id = pos.length / 3; pos.push(p[0], p[1], p[2]); vmap.set(key, id);
    return id;
  };
  const f = new Float32Array(8), ev = new Int32Array(12);
  for (let bk = 0; bk < cnz - 1; bk++) for (let bj = 0; bj < cny - 1; bj++) for (let bi = 0; bi < cnx - 1; bi++) {
    let near = false;
    for (let c = 0; c < 8 && !near; c++) {
      const v = cv[((bk + CORNER[c][2]) * cny + bj + CORNER[c][1]) * cnx + bi + CORNER[c][0]];
      if (Math.abs(v) < reach) near = true;
    }
    if (!near) continue;
    for (let k = bk * C; k < Math.min(nz - 1, (bk + 1) * C); k++) for (let j = bj * C; j < Math.min(ny - 1, (bj + 1) * C); j++) for (let i = bi * C; i < Math.min(nx - 1, (bi + 1) * C); i++) {
      let cube = 0;
      for (let c = 0; c < 8; c++) { const v = f[c] = val(i + CORNER[c][0], j + CORNER[c][1], k + CORNER[c][2]); if (v > 0) cube |= 1 << c; } // bit = outside
      const bits = edgeTable[cube];
      if (!bits) continue;
      for (let e = 0; e < 12; e++) {
        if (!(bits & (1 << e))) continue;
        const [c, axis] = EDGE[e], o = CORNER[c];
        const c2 = axis === 0 ? (c === 0 ? 1 : c === 3 ? 2 : c === 4 ? 5 : 6) : axis === 1 ? (c === 0 ? 3 : c === 1 ? 2 : c === 4 ? 7 : 6) : c + 4;
        ev[e] = vertexOn(i + o[0], j + o[1], k + o[2], axis, f[c], f[c2]);
      }
      const T = cube * 16;
      for (let t = 0; triTable[T + t] !== -1; t += 3) idx.push(ev[triTable[T + t]], ev[triTable[T + t + 1]], ev[triTable[T + t + 2]]);
    }
  }
  // normals from the field gradient (central differences on the analytic SDF)
  const P = Float32Array.from(pos), Nn = new Float32Array(P.length), e = h * 0.18;
  for (let v = 0; v < P.length; v += 3) {
    const x = P[v], y = P[v + 1], z = P[v + 2];
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1; Nn[v] = gx / l; Nn[v + 1] = gy / l; Nn[v + 2] = gz / l;
  }
  // winding: make the geometric normal agree with the gradient (checked on the first big triangle)
  const I = Uint32Array.from(idx);
  let agree = 0;
  for (let t = 0; t < Math.min(I.length, 3000); t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    agree += Math.sign(cx * Nn[a] + cy * Nn[a + 1] + cz * Nn[a + 2]);
  }
  if (agree < 0) for (let t = 0; t < I.length; t += 3) { const s = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = s; }
  return { pos: P, nrm: Nn, idx: I, evals: field.reduce((n, v) => n + (v === v ? 1 : 0), 0) };
}

/**
 * Build the body: one indexed geometry (position + normal) for the car's uber material. voxel: marching-cubes cell
 * (m): 0.02 desktop (~110 k triangles), 0.04 phones (~28 k). The flat floor pan (never seen but on jumps) is dropped:
 * car-model.js closes it with one dark plate.
 * @returns {{ geometry: THREE.BufferGeometry, stats: object }}
 */
export function buildCarBody({ voxel = 0.02 } = {}) {
  const t0 = performance.now();
  const box = [-0.96, 0.1, -2.5, 0.96, 1.45, 2.5];
  const m = marchSdf(bodySdf, box, voxel);
  const t1 = performance.now();
  const P = m.pos, Nn = m.nrm, I = m.idx, keep = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, ny = (Nn[a + 1] + Nn[b + 1] + Nn[c + 1]) / 3;
    const cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    if (cy < 0.16 && ny < -0.92 && Math.abs(cz) < 2.0) continue; // floor pan
    keep.push(I[t], I[t + 1], I[t + 2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(keep), 1));
  g.computeBoundingSphere();
  return { geometry: g, stats: { voxel, tris: keep.length / 3, verts: P.length / 3, evals: m.evals, marchMs: Math.round(t1 - t0), totalMs: Math.round(performance.now() - t0) } };
}

/** z of the body surface hit by a ray from (x, y, zFrom) along dir (+1 / -1 in z): for parts mounted on the skin. */
export function surfaceZ(x, y, zFrom, dir) {
  let z = zFrom;
  for (let i = 0; i < 200; i++) { const d = bodySdf(x, y, z); if (d < 0.0005) return z; z += dir * Math.max(d, 0.001); }
  return z;
}

export { baseSdf, bodySdf, M as CAR_MASKS, lowerHalfWidth, cabinHalfWidth, WHEELS_Z };
