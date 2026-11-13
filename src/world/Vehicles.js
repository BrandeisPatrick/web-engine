// Procedural vehicle library: real-proportioned cars, vans, trucks and a 40 ft low-floor city bus built from
// lofted side profiles (smooth bevelled bodies with tumblehome, wheel arches cut into the sill line,
// glass / pillars / lamps assigned per face), lathe wheels (tyre, sidewall, 5/6-spoke rims), mirrors,
// door seams, grille, plates and lamps. ~700-1,400 triangles each (LOD 0), ~300-450 (LOD 1).
// HD level (lod: 'hd', the car body types in VEHICLE_HD_TYPES; ~36-40k triangles, 25-55 ms): the same car from the
// same anchors (HD-only overrides: a real nose face under a raised hood edge, a squarer plan to the tail corners, a
// straight boot-lid edge) with spline sections, crisp character / shut lines, rolled ends, bumpers with depth,
// pocketed lamps with reflectors and ribbed tail cells (hot cores, warm emission) behind lenses, a recessed plate,
// see-through glass over an interior, 3D wheels (rounded tyres with tread, 5- / 6+6-spoke alloys or pressed steel with
// hubcaps, discs, calipers) and a closed underside. Mid level (lod: 'mid'; 8-9.5k triangles, ~8 ms): the same body
// at fewer stations / section points with the same crisp lines, recessed lamp units, real wheel shapes, opaque dark
// glass, no interior, one draw. Both are indexed and packed (~1.5 / ~0.4 MB per type), carry a surface atlas mapping
// (getVehicleAtlas: plates, tyre lettering + tread, paint flake + orange peel, disc machining, lens flutes / prisms,
// fabric, grain, the taxi sign) and are drawn with createVehicleMaterial({ hd: true }). Vans / box truck / bus: their
// LOD 0 under the same API.
//
// Geometry (LOD 0 / 1) is non-indexed with attributes the vehicle material reads:
//   color (vec3, linear), aPaint (1 = body paint, multiplied by the instance colour), aLamp (0 none,
//   1 head, 2 tail/brake, 3 amber, 4 lit sign, 5/6 police red/blue; HD / mid use n +- d for a part that glows
//   at 1 - 2d of its lamp, e.g. 2.35 = a tail-lamp rib at 30 %), aSurf (roughness, metalness, clearcoat).
//   HD / mid pack these as aSurf4 (roughness, metalness, clear coat, paint) and aUvT (atlas u, v, tile code, aLamp).
// Local frame: forward = -Z, up = +Y, right = +X, origin on the ground between the axles.
//
//   makeVehicleGeometry(type, { lod, livery }) -> THREE.BufferGeometry; LOD 0 / 1: a fresh clone (userData: tris, spec)
//                                          livery (bus only): { lower, stripe } vertex materials ({ c, rough, metal, cc })
//                                          for the lower body band and the window-line stripe (DEFAULT_BUS_LIVERY)
//                                          lod 'hd' / 'mid': ONE shared, cached object per type and level (do not mutate;
//                                          use a view geometry for per-mesh attributes): 'hd' groups [0 opaque, 1 glass +
//                                          lenses] -> [createVehicleMaterial({ hd: true }), ({ glass: true, hd: true })];
//                                          'mid' one material; userData: tris, glassTris, bytes, buildMs, shared
//   makeVehicleParts(type, { lod: 'hd' }) -> { body, glass, interior, wheels { FL, FR, RL, RR }, calipers { .. },
//                                          wheelFL..wheelRR, pivots { FL: Vector3 .. }, spec, tris, buildMs }: wheels and
//                                          calipers in their own frame (hub at the origin, axle X) for a drivable car
//   VEHICLE_HD_TYPES                    -> types with a real HD build
//   getVehicleAtlas()                   -> the shared 512 x 512 surface atlas (DataTexture, built once)
//   geometryBytes(geometry)             -> bytes of a geometry's typed arrays
//   VEHICLE_SPECS[type]                 -> { L, W, H, Hc, WB, wheelR, ... } (L/W/Hc drive traffic colliders)
//   pickVehicleColor(rnd, kind, out)    -> realistic paint distribution ('car' | 'taxi' | 'truck' | 'bus' | 'police')
//   createVehicleMaterial({ brake, lamps, glass, hd, envIntensity }) -> MeshPhysicalMaterial (clearcoat) with
//                                          userData.u.uDark; brake: reads the per-instance `aBrake` attribute (traffic);
//                                          glass (opt-in): the HD glass / lens material (blended, opacity in aSurf.y);
//                                          hd (opt-in): reads the HD / mid packed layout + the atlas (see its JSDoc)
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ part builder (shared with furniture.js)
/**
 * Accumulates non-indexed triangles with per-vertex material data. Material objects:
 * { c: [r,g,b] linear, paint 0|1, lamp, rough, metal, cc (clearcoat), emit }.
 */
export class PartBuilder {
  constructor() { this.P = []; this.N = []; this.C = []; this.A = []; }
  get triCount() { return this.P.length / 9; }
  _v(p, n, m) {
    this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.C.push(m.c[0], m.c[1], m.c[2]);
    this.A.push(m.paint || 0, m.lamp || 0, m.rough ?? 0.5, m.metal ?? 0, m.cc ?? 0, m.emit ?? 0);
  }
  /** Triangle; with vertex normals the winding is fixed to agree with them, else flat & as given. */
  tri(a, b, c, m, na, nb, nc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const fl = Math.hypot(fx, fy, fz);
    if (fl < 1e-10) return;
    fx /= fl; fy /= fl; fz /= fl;
    if (na) {
      if (fx * (na[0] + nb[0] + nc[0]) + fy * (na[1] + nb[1] + nc[1]) + fz * (na[2] + nb[2] + nc[2]) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
      this._v(a, na, m); this._v(b, nb, m); this._v(c, nc, m);
    } else { const n = [fx, fy, fz]; this._v(a, n, m); this._v(b, n, m); this._v(c, n, m); }
  }
  /** Quad a-b-c-d with an outward normal hint n (flat). */
  quad(a, b, c, d, m, n) {
    if (n) { this.tri(a, b, c, m, n, n, n); this.tri(a, c, d, m, n, n, n); } else { this.tri(a, b, c, m); this.tri(a, c, d, m); }
  }
  /** Add a THREE geometry (indexed or not) transformed by matrix; mat may be a function(triIndex, centroid) -> material. */
  geo(g, mat, matrix) {
    const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index;
    const M = matrix || new THREE.Matrix4(), NM = new THREE.Matrix3().getNormalMatrix(M);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const cnt = idx ? idx.count : pos.count;
    const P = [], Nn = [];
    for (let i = 0; i < cnt; i++) {
      const k = idx ? idx.getX(i) : i;
      v.fromBufferAttribute(pos, k).applyMatrix4(M); P.push([v.x, v.y, v.z]);
      if (nor) { n.fromBufferAttribute(nor, k).applyMatrix3(NM).normalize(); Nn.push([n.x, n.y, n.z]); }
    }
    for (let i = 0; i + 2 < cnt; i += 3) {
      const m = typeof mat === 'function' ? mat(i / 3, P[i], P[i + 1], P[i + 2]) : mat;
      if (!m) continue;
      if (nor) this.tri(P[i], P[i + 1], P[i + 2], m, Nn[i], Nn[i + 1], Nn[i + 2]);
      else this.tri(P[i], P[i + 1], P[i + 2], m);
    }
    return this;
  }
  /** Axis-aligned box (optionally rotated about Y by yaw / X by pitch) from centre + size. */
  box(cx, cy, cz, sx, sy, sz, m, { yaw = 0, pitch = 0, roll = 0, skipBottom = false } = {}) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    const M = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1));
    if (skipBottom) return this.geo(g, (t, a, b, c) => (t === 6 || t === 7 ? null : m), M);
    return this.geo(g, m, M);
  }
  /**
   * Lathe around the local Y axis: profile [[r, y], ...]; seg radial segments; mat(j, i) per band/segment.
   * Vertex normals from the profile (smooth around). matrix places it. A profile point with r = 0 closes a fan.
   */
  lathe(profile, seg, mat, matrix, phase = 0) {
    const M = matrix || new THREE.Matrix4(), NM = new THREE.Matrix3().getNormalMatrix(M);
    const n2 = [];
    for (let j = 0; j < profile.length - 1; j++) {
      const dr = profile[j + 1][0] - profile[j][0], dy = profile[j + 1][1] - profile[j][1], l = Math.hypot(dr, dy) || 1;
      n2.push([dy / l, -dr / l]);
    }
    const pn = profile.map((_, j) => {
      const a = n2[Math.max(0, j - 1)], b = n2[Math.min(n2.length - 1, j)];
      const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1;
      return [x / l, y / l];
    });
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const P = (j, i, segNorm) => {
      const ph = phase + (i / seg) * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
      const [r, y] = profile[j];
      v.set(r * c, y, r * s).applyMatrix4(M);
      const nr = segNorm ? segNorm[0] : pn[j][0], ny = segNorm ? segNorm[1] : pn[j][1];
      nn.set(nr * c, ny, nr * s).applyMatrix3(NM).normalize();
      return [[v.x, v.y, v.z], [nn.x, nn.y, nn.z]];
    };
    for (let j = 0; j < profile.length - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const m = typeof mat === 'function' ? mat(j, i) : mat;
        if (!m) continue;
        const flat = m.flat ? n2[j] : null;
        const [a, na] = P(j, i, flat), [b, nb] = P(j, i + 1, flat), [c, nc] = P(j + 1, i + 1, flat), [d, nd] = P(j + 1, i, flat);
        this.tri(a, b, c, m, na, nb, nc); // zero-area triangles (fan at the axis) are skipped
        this.tri(a, c, d, m, na, nc, nd);
      }
    }
    return this;
  }
  /** Tube along a polyline of [x,y,z] points (seg sides), constant or per-point radius. */
  tube(pts, radius, seg, m, { caps = false } = {}) {
    const rad = (i) => (Array.isArray(radius) ? radius[i] : radius);
    const T = new THREE.Vector3(), Nr = new THREE.Vector3(), Bn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const rings = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      const ref = Math.abs(T.dot(up)) > 0.9 ? new THREE.Vector3(1, 0, 0) : up;
      Nr.crossVectors(ref, T).normalize(); Bn.crossVectors(T, Nr).normalize();
      const ring = [];
      for (let k = 0; k < seg; k++) {
        const ph = (k / seg) * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
        const nx = Nr.x * c + Bn.x * s, ny = Nr.y * c + Bn.y * s, nz = Nr.z * c + Bn.z * s;
        ring.push([[pts[i][0] + nx * rad(i), pts[i][1] + ny * rad(i), pts[i][2] + nz * rad(i)], [nx, ny, nz]]);
      }
      rings.push(ring);
    }
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < seg; k++) {
      const [a, na] = rings[i][k], [b, nb] = rings[i][(k + 1) % seg], [c, nc] = rings[i + 1][(k + 1) % seg], [d, nd] = rings[i + 1][k];
      this.tri(a, b, c, m, na, nb, nc); this.tri(a, c, d, m, na, nc, nd);
    }
    if (caps) for (const i of [0, pts.length - 1]) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...t) || 1, sg = i === 0 ? -1 : 1;
      const n = [t[0] / l * sg, t[1] / l * sg, t[2] / l * sg];
      for (let k = 0; k < seg; k++) this.tri(pts[i], rings[i][k][0], rings[i][(k + 1) % seg][0], m, n, n, n);
    }
    return this;
  }
  /**
   * Build a BufferGeometry. layout 'vehicle': aPaint, aLamp, aSurf(rough, metal, clearcoat);
   * 'furniture': aSurf(rough, metal, emit, paint).
   */
  build(layout = 'vehicle') {
    const n = this.P.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    const A = this.A;
    if (layout === 'vehicle') {
      const pa = new Float32Array(n), la = new Float32Array(n), su = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pa[i] = A[i * 6]; la[i] = A[i * 6 + 1]; su[i * 3] = A[i * 6 + 2]; su[i * 3 + 1] = A[i * 6 + 3]; su[i * 3 + 2] = A[i * 6 + 4]; }
      g.setAttribute('aPaint', new THREE.BufferAttribute(pa, 1));
      g.setAttribute('aLamp', new THREE.BufferAttribute(la, 1));
      g.setAttribute('aSurf', new THREE.BufferAttribute(su, 3));
    } else {
      const su = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { su[i * 4] = A[i * 6 + 2]; su[i * 4 + 1] = A[i * 6 + 3]; su[i * 4 + 2] = A[i * 6 + 5]; su[i * 4 + 3] = A[i * 6]; }
      g.setAttribute('aSurf', new THREE.BufferAttribute(su, 4));
    }
    g.computeBoundingBox(); g.computeBoundingSphere();
    g.userData.tris = n / 3;
    return g;
  }
}

// ------------------------------------------------------------------ vertex materials
export const VM = {
  paint: { c: [1, 1, 1], paint: 1, rough: 0.36, metal: 0.4, cc: 1 },
  glass: { c: [0.022, 0.027, 0.032], rough: 0.03, metal: 0.2, cc: 1 },
  trim: { c: [0.028, 0.028, 0.03], rough: 0.72, metal: 0.0, cc: 0 },
  trimGloss: { c: [0.016, 0.016, 0.018], rough: 0.3, metal: 0.1, cc: 0.7 },
  chrome: { c: [0.8, 0.8, 0.82], rough: 0.12, metal: 1, cc: 0 },
  head: { c: [0.5, 0.52, 0.55], lamp: 1, rough: 0.05, metal: 0.9, cc: 1 },
  tail: { c: [0.3, 0.012, 0.016], lamp: 2, rough: 0.12, metal: 0.1, cc: 1 },
  amber: { c: [0.55, 0.24, 0.02], lamp: 3, rough: 0.12, metal: 0.1, cc: 1 },
  sign: { c: [0.92, 0.8, 0.42], lamp: 4, rough: 0.3, metal: 0, cc: 0.5 },
  dest: { c: [0.05, 0.04, 0.02], lamp: 4, rough: 0.2, metal: 0, cc: 0.8 },
  lbRed: { c: [0.42, 0.02, 0.02], lamp: 5, rough: 0.15, metal: 0, cc: 1 },
  lbBlue: { c: [0.02, 0.05, 0.45], lamp: 6, rough: 0.15, metal: 0, cc: 1 },
  tyre: { c: [0.026, 0.026, 0.028], rough: 0.92, metal: 0 },
  rim: { c: [0.6, 0.61, 0.63], rough: 0.26, metal: 0.92 },
  rimDark: { c: [0.035, 0.035, 0.04], rough: 0.55, metal: 0.4 },
  steelRim: { c: [0.72, 0.72, 0.71], rough: 0.35, metal: 0.7 },
  hubBlack: { c: [0.05, 0.05, 0.055], rough: 0.45, metal: 0.5 },
  plate: { c: [0.78, 0.8, 0.84], rough: 0.4, metal: 0.2 },
  grille: { c: [0.03, 0.031, 0.034], rough: 0.4, metal: 0.5 },
  under: { c: [0.016, 0.016, 0.018], rough: 0.95, metal: 0 },
  liner: { c: [0.03, 0.03, 0.032], rough: 0.88, metal: 0 },
  seam: { c: [0.008, 0.008, 0.009], rough: 0.8, metal: 0, cc: 0 },
  white: { c: [0.84, 0.85, 0.84], rough: 0.3, metal: 0.05, cc: 1 },
  black: { c: [0.012, 0.012, 0.014], rough: 0.28, metal: 0.25, cc: 1 },
  skirt: { c: [0.07, 0.07, 0.075], rough: 0.6, metal: 0.1, cc: 0 },
  frame: { c: [0.09, 0.09, 0.095], rough: 0.4, metal: 0.4, cc: 0.4 },
};

// ------------------------------------------------------------------ specs
// Profiles are [fraction of length from the nose, value]; heights in metres; plan = half-width factor.
const CAR_PLAN = [[0, 0.83], [0.012, 0.9], [0.04, 0.955], [0.12, 0.99], [0.25, 1], [0.8, 1], [0.92, 0.985], [0.975, 0.95], [0.993, 0.9], [1, 0.85]];
const BASE = {
  sedan: {
    L: 4.72, W: 1.83, H: 1.45, WB: 2.8, ohF: 0.95, wheelR: 0.335, wheelW: 0.225, track: 1.58, rim: 'alloy',
    top: [[0, 0.64], [0.012, 0.74], [0.05, 0.795], [0.16, 0.85], [0.31, 0.95], [0.4, 1.24], [0.46, 1.41], [0.53, 1.45], [0.64, 1.44], [0.72, 1.37], [0.8, 1.17], [0.86, 1.03], [0.95, 1.02], [0.985, 0.97], [1, 0.84]],
    belt: [0.94, 1.02], bot: [[0, 0.4], [0.05, 0.32], [0.2, 0.3], [0.8, 0.3], [0.95, 0.33], [1, 0.42]], plan: CAR_PLAN, roofW: 0.76,
    zones: { cowl: 0.31, roofF: 0.46, roofR: 0.72, deck: 0.86 }, side: [[0.315, 0.553], [0.574, 0.79]], seams: [0.3, 0.563, 0.797],
    lights: { head: [0, 0.05], tail: [0.95, 1] },
  },
  hatchback: {
    L: 4.26, W: 1.79, H: 1.47, WB: 2.63, ohF: 0.86, wheelR: 0.32, wheelW: 0.215, track: 1.54, rim: 'alloy',
    top: [[0, 0.64], [0.012, 0.75], [0.05, 0.81], [0.16, 0.87], [0.33, 0.97], [0.42, 1.25], [0.49, 1.43], [0.56, 1.47], [0.8, 1.455], [0.86, 1.42], [0.93, 1.25], [0.975, 1.05], [0.99, 0.99], [1, 0.86]],
    belt: [0.96, 1.04], bot: [[0, 0.4], [0.05, 0.32], [0.2, 0.3], [0.8, 0.3], [0.95, 0.33], [1, 0.42]], plan: CAR_PLAN, roofW: 0.77,
    zones: { cowl: 0.33, roofF: 0.49, roofR: 0.86, deck: 0.975 }, side: [[0.335, 0.6], [0.62, 0.83]], seams: [0.32, 0.61, 0.835],
    lights: { head: [0, 0.05], tail: [0.93, 1] },
  },
  suv: {
    L: 4.6, W: 1.86, H: 1.69, WB: 2.69, ohF: 0.93, wheelR: 0.36, wheelW: 0.235, track: 1.6, rim: 'alloy', cladding: true, roofRails: true,
    top: [[0, 0.78], [0.012, 0.88], [0.05, 0.94], [0.16, 1.0], [0.3, 1.08], [0.38, 1.38], [0.445, 1.62], [0.51, 1.68], [0.88, 1.665], [0.935, 1.63], [0.975, 1.3], [0.99, 1.12], [1, 0.98]],
    belt: [1.08, 1.16], bot: [[0, 0.5], [0.05, 0.42], [0.2, 0.4], [0.8, 0.4], [0.95, 0.44], [1, 0.52]], plan: CAR_PLAN, roofW: 0.8,
    zones: { cowl: 0.3, roofF: 0.445, roofR: 0.935, deck: 0.985 }, side: [[0.305, 0.545], [0.565, 0.755], [0.772, 0.905]], seams: [0.295, 0.555, 0.762],
    lights: { head: [0, 0.05], tail: [0.935, 0.99] },
  },
  pickup: {
    L: 5.4, W: 1.91, H: 1.79, WB: 3.24, ohF: 0.9, wheelR: 0.385, wheelW: 0.25, track: 1.61, rim: 'chrome', cladding: true, bed: 0.6,
    top: [[0, 0.92], [0.012, 1.02], [0.04, 1.08], [0.13, 1.13], [0.255, 1.2], [0.32, 1.48], [0.37, 1.73], [0.42, 1.79], [0.57, 1.78], [0.59, 1.74], [0.598, 1.3], [0.6, 1.26], [1, 1.26]],
    belt: [1.2, 1.26], bot: [[0, 0.56], [0.05, 0.48], [0.2, 0.48], [0.85, 0.48], [0.95, 0.52], [1, 0.58]],
    plan: [[0, 0.86], [0.012, 0.92], [0.04, 0.965], [0.12, 0.995], [0.25, 1], [0.97, 1], [0.995, 0.985], [1, 0.97]], roofW: 0.82,
    zones: { cowl: 0.255, roofF: 0.37, roofR: 0.59, deck: 0.598 }, side: [[0.26, 0.445], [0.462, 0.575]], seams: [0.25, 0.453, 0.585],
    lights: { head: [0, 0.04], tail: [0.985, 1] },
  },
  minivan: {
    L: 5.16, W: 1.99, H: 1.74, WB: 3.0, ohF: 0.98, wheelR: 0.35, wheelW: 0.235, track: 1.7, rim: 'alloy',
    top: [[0, 0.74], [0.012, 0.84], [0.05, 0.9], [0.13, 0.96], [0.22, 1.05], [0.3, 1.38], [0.39, 1.69], [0.45, 1.74], [0.91, 1.73], [0.955, 1.68], [0.985, 1.25], [0.995, 1.08], [1, 0.96]],
    belt: [1.05, 1.13], bot: [[0, 0.46], [0.05, 0.38], [0.2, 0.36], [0.8, 0.36], [0.95, 0.4], [1, 0.48]], plan: CAR_PLAN, roofW: 0.8,
    zones: { cowl: 0.22, roofF: 0.39, roofR: 0.955, deck: 0.988 }, side: [[0.225, 0.39], [0.405, 0.655], [0.672, 0.925]], seams: [0.215, 0.398, 0.665],
    lights: { head: [0, 0.05], tail: [0.955, 0.99] },
  },
  police: {
    L: 5.05, W: 2.0, H: 1.78, WB: 3.03, ohF: 0.98, wheelR: 0.38, wheelW: 0.245, track: 1.7, rim: 'steel', lightbar: true, pushBar: true,
    top: [[0, 0.82], [0.012, 0.93], [0.05, 0.99], [0.16, 1.05], [0.28, 1.12], [0.36, 1.42], [0.43, 1.72], [0.49, 1.78], [0.9, 1.765], [0.945, 1.73], [0.98, 1.32], [0.992, 1.14], [1, 1.0]],
    belt: [1.12, 1.2], bot: [[0, 0.52], [0.05, 0.44], [0.2, 0.42], [0.8, 0.42], [0.95, 0.46], [1, 0.54]], plan: CAR_PLAN, roofW: 0.8,
    zones: { cowl: 0.28, roofF: 0.43, roofR: 0.945, deck: 0.988 }, side: [[0.285, 0.535], [0.553, 0.74], [0.757, 0.915]], seams: [0.275, 0.545, 0.746],
    lights: { head: [0, 0.05], tail: [0.945, 0.99] }, livery: 'bw',
  },
};
BASE.taxi = { ...BASE.sedan, rim: 'steel', taxiSign: true };
BASE.police_sedan = { ...BASE.sedan, rim: 'steel', lightbar: true, pushBar: true, livery: 'bw' };
BASE.boxtruck = {
  L: 7.4, W: 2.44, H: 3.42, WB: 4.3, ohF: 1.1, wheelR: 0.4, wheelW: 0.24, wheelWR: 0.5, track: 1.74, rim: 'truck',
  cabL: 2.15, cabW: 2.04,
  top: [[0, 1.22], [0.02, 1.38], [0.05, 1.45], [0.2, 2.3], [0.26, 2.42], [0.96, 2.42], [1, 2.36]],
  belt: [1.45, 1.52], bot: [[0, 0.62], [0.05, 0.56], [1, 0.56]], plan: [[0, 0.9], [0.02, 0.955], [0.06, 1], [1, 1]], roofW: 0.9,
  zones: { cowl: 0.05, roofF: 0.205, roofR: 0.985, deck: 1.01 }, side: [[0.06, 0.56]], seams: [0.04, 0.58],
};
BASE.bus = { L: 12.2, W: 2.59, H: 3.02, WB: 7.0, ohF: 2.45, wheelR: 0.5, wheelW: 0.3, wheelWR: 0.52, track: 2.1, rim: 'truck' };

/** Public dimensions (metres). Hc = collision height incl. roof equipment. */
export const VEHICLE_SPECS = {};
for (const [k, s] of Object.entries(BASE)) {
  const extra = s.lightbar ? 0.13 : s.taxiSign ? 0.28 : k === 'bus' ? 0.24 : 0;
  VEHICLE_SPECS[k] = { L: s.L, W: s.W, H: s.H, Hc: +(s.H + extra).toFixed(2), WB: s.WB, wheelR: s.wheelR, track: s.track, ohF: s.ohF };
}
export const VEHICLE_TYPES = Object.keys(BASE);

// ------------------------------------------------------------------ helpers
/** Monotone cubic (PCHIP) interpolation through [[x, y], ...] sorted by x; clamps outside. */
function pchip(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (n === 1) return () => ys[0];
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])); }
  const m = new Array(n).fill(0);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
function linear(pts) {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) if (x <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]));
    return pts[pts.length - 1][1];
  };
}
function stationList(raw, z0, z1, maxGap, minGap = 0.025) {
  const zs = raw.filter((z) => z >= z0 - 1e-6 && z <= z1 + 1e-6).map((z) => clamp(z, z0, z1)).sort((a, b) => a - b);
  zs.unshift(z0); zs.push(z1);
  const out = [];
  for (const z of zs) if (!out.length || z - out[out.length - 1] > minGap) out.push(z); else if (z === z1) out[out.length - 1] = z1;
  const res = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const g = out[i] - out[i - 1], k = Math.ceil(g / maxGap);
    for (let j = 1; j < k; j++) res.push(out[i - 1] + (g * j) / k);
    res.push(out[i]);
  }
  return res;
}

/**
 * Loft cross-sections (half sections, bottom-outer -> top-centre, mirrored) along stations zs.
 * classify(band, zMid, kMin, i) -> material. Smooth vertex normals across the skin. Returns the rings.
 */
function loft(B, zs, sec, classify, { bandIds = null, pick = null } = {}) {
  const S = zs.length;
  const secs = zs.map((z) => sec(z));
  if (pick) for (const s of secs) s.pts = pick.map((j) => s.pts[j]);
  const n = secs[0].pts.length, R = 2 * n - 1;
  const G = secs.map((s, i) => {
    const r = [];
    for (let j = 0; j < n; j++) r.push([s.pts[j][0], s.pts[j][1], zs[i]]);
    for (let j = n - 2; j >= 0; j--) r.push([-s.pts[j][0], s.pts[j][1], zs[i]]);
    return r;
  });
  const NN = G.map((r) => r.map(() => [0, 0, 0]));
  const acc = (i, k, f) => { const a = NN[i][k]; a[0] += f[0]; a[1] += f[1]; a[2] += f[2]; };
  const fnorm = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  };
  for (let i = 0; i < S - 1; i++) for (let k = 0; k < R - 1; k++) {
    const a = G[i][k], b = G[i][k + 1], c = G[i + 1][k + 1], d = G[i + 1][k];
    const f1 = fnorm(a, b, c), f2 = fnorm(a, c, d);
    acc(i, k, f1); acc(i, k + 1, f1); acc(i + 1, k + 1, f1);
    acc(i, k, f2); acc(i + 1, k + 1, f2); acc(i + 1, k, f2);
  }
  for (const r of NN) for (const v of r) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; }
  for (let i = 0; i < S - 1; i++) {
    const zm = (zs[i] + zs[i + 1]) * 0.5, kmin = Math.min(secs[i].k ?? 1, secs[i + 1].k ?? 1);
    for (let k = 0; k < R - 1; k++) {
      const hb = k < n - 1 ? k : R - 2 - k;
      const m = classify(bandIds ? bandIds[hb] : hb, zm, kmin, i, k < n - 1 ? 1 : -1);
      if (!m) continue;
      const a = G[i][k], b = G[i][k + 1], c = G[i + 1][k + 1], d = G[i + 1][k];
      // winding a-b-c / a-c-d is outward by construction (du x dv); pass normals for smooth shading
      pushTri(B, a, b, c, m, NN[i][k], NN[i][k + 1], NN[i + 1][k + 1]);
      pushTri(B, a, c, d, m, NN[i][k], NN[i + 1][k + 1], NN[i + 1][k]);
    }
  }
  return { G, secs, n };
}
function pushTri(B, a, b, c, m, na, nb, nc) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-9) return;
  B._v(a, na, m); B._v(b, nb, m); B._v(c, nc, m);
}
/** Planar cap over a ring (earcut), facing +/-Z. mat may be a function(centroidY) -> material. */
function cap(B, ring, z, dir, mat) {
  const pts = [];
  for (const p of ring) { const l = pts[pts.length - 1]; if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-4) pts.push(p); }
  if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-4) pts.pop();
  if (pts.length < 3) return;
  const faces = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const n = [0, 0, dir];
  for (const f of faces) {
    const a = [pts[f[0]][0], pts[f[0]][1], z], b = [pts[f[1]][0], pts[f[1]][1], z], c = [pts[f[2]][0], pts[f[2]][1], z];
    const m = typeof mat === 'function' ? mat((a[1] + b[1] + c[1]) / 3, (a[0] + b[0] + c[0]) / 3) : mat;
    if (m) B.tri(a, b, c, m, n, n, n);
  }
}
/** Wheel: lathe tyre + rim around the X axis at (x, r, z); side = +1 right / -1 left. */
function wheel(B, x, z, r, w, side, style, lod) {
  const seg = lod ? 6 : 10;
  const prof = lod
    ? [[r, -0.45 * w], [r, 0.4 * w], [0.66 * r, 0.5 * w], [0, 0.44 * w]]
    : [[r, -0.45 * w], [r, 0.38 * w], [0.9 * r, 0.5 * w], [0.64 * r, 0.47 * w], [0.2 * r, 0.4 * w], [0, 0.42 * w]];
  const rimM = style === 'chrome' ? VM.chrome : style === 'steel' ? VM.steelRim : style === 'truck' ? VM.steelRim : VM.rim;
  const spokes = style === 'steel' ? 0 : style === 'truck' ? 2 : 1;
  const mat = (j, i) => {
    if (lod) return j < 2 ? VM.tyre : rimM;
    if (j < 3) return VM.tyre;
    if (j === 3) return spokes === 1 ? (i % 2 ? VM.rimDark : rimM) : spokes === 2 ? (i % 3 === 0 ? VM.rimDark : rimM) : (style === 'steel' ? VM.hubBlack : rimM);
    return style === 'steel' ? VM.steelRim : rimM;
  };
  const M = new THREE.Matrix4().makeRotationZ(side > 0 ? -Math.PI / 2 : Math.PI / 2).setPosition(x, r, z);
  B.lathe(prof, seg, mat, M, 0);
}

/** Wheel-well liner: inner wall + arch roof quads (stop the eye seeing through the arch). */
function archLiner(B, sd, xIn, xOut, za, rA, top) {
  const z0 = za - rA * 0.95, z1 = za + rA * 0.95, y0 = 0.12;
  B.quad([sd * xIn, y0, z0], [sd * xIn, y0, z1], [sd * xIn, top, z1], [sd * xIn, top, z0], VM.under, [sd, 0, 0]);
  B.quad([sd * xIn, top, z0], [sd * xIn, top, z1], [sd * xOut, top, z1], [sd * xOut, top, z0], VM.under, [0, -1, 0]);
}

// ------------------------------------------------------------------ cars (sedan, hatch, SUV, pickup, minivan, taxi, police)
function buildCar(B, s, lod) {
  const L = s.L, z0 = -L / 2, z1 = L / 2, hwMax = s.W / 2;
  const F = (f) => z0 + f * L, fr = (z) => (z - z0) / L;
  const topF = pchip(s.top), botF = linear(s.bot), planF = pchip(s.plan);
  const Z = s.zones;
  const zF = z0 + s.ohF, zR = zF + s.WB, rA = s.wheelR + 0.055;
  const archY = (z) => {
    let y = -1;
    for (const za of [zF, zR]) { const d = z - za; if (Math.abs(d) < rA) y = Math.max(y, s.wheelR + Math.sqrt(rA * rA - d * d)); }
    return y;
  };
  const beltF = (f) => lerp(s.belt[0], s.belt[1], clamp((f - Z.cowl) / (Z.deck - Z.cowl), 0, 1));
  const sec = (z) => {
    const f = fr(z), top = topF(f), belt = beltF(f);
    const yb = Math.max(botF(f), archY(z));
    let ym = Math.min(top, belt), yt = Math.max(top, ym);
    if (f < Z.cowl - 0.005 || f > Z.deck + 0.003) { ym = top; yt = top; }
    const k = sstep(0.015, 0.28, yt - ym);
    const hw = planF(f) * hwMax, hwT = hw * s.roofW, H = Math.max(0.02, ym - yb);
    const p = [[hw * 0.93, yb], [hw * 0.995, yb + 0.34 * H], [hw, yb + 0.74 * H], [hw * 0.955, ym - 0.012 * Math.min(1, H / 0.1)]];
    if (s.bed && f >= s.bed - 1e-4) {
      p.push([hw * 0.905, ym], [hw * 0.875, ym - 0.42], [hw * 0.6, ym - 0.44], [0, ym - 0.44]);
    } else {
      const wbX = lerp(hw * 0.7, lerp(hw * 0.92, hwT, 0.22), k), wbY = lerp(ym + 0.012, ym + 0.02, k);
      const wtX = lerp(hw * 0.45, hwT, k), wtY = lerp(ym + 0.022, yt - 0.06, k);
      const reX = Math.max(0.05, wtX - lerp(hw * 0.2, 0.09, k)), reY = lerp(ym + 0.028, yt - 0.012, k);
      p.push([wbX, wbY], [wtX, wtY], [reX, reY], [0, lerp(ym + 0.032, yt + 0.02, k)]);
    }
    return { pts: p, k, f, hw, ym, yt, yb };
  };
  // stations
  const raw = [];
  for (const k of ['cowl', 'roofF', 'roofR', 'deck']) raw.push(F(Z[k]));
  if (!lod) { for (const [f] of s.top) raw.push(F(f)); for (const [a, b] of s.side) raw.push(F(a), F(b)); raw.push(F(0.004), F(0.996)); }
  else { raw.push(F(s.lights ? s.lights.head[1] : 0.04), F(0.97)); if (s.side.length > 1) raw.push(F(s.side[0][1])); }
  if (s.bed) raw.push(F(s.bed), F(s.bed - 0.002), F(Z.roofR));
  const archT = lod ? [-1, -0.5, 0.5, 1] : [-1, -0.85, -0.4, 0.4, 0.85, 1];
  for (const za of [zF, zR]) for (const t of archT) raw.push(za + t * rA);
  const zs = stationList(raw, z0, z1, lod ? 1.6 : 0.7, lod ? 0.06 : 0.045);

  const inSide = (f) => { // 1 glass, 2 pillar between windows, 0 none
    for (const [a, b] of s.side) if (f >= a && f <= b) return 1;
    if (f > s.side[0][0] && f < s.side[s.side.length - 1][1]) return 2;
    return 0;
  };
  const bumpF = fr(zF - rA - 0.02), bumpR = fr(zR + rA + 0.02);
  const liv = s.livery === 'bw';
  const livWhite = (band, f, region) => (band <= 3 && f > s.seams[0] && f < s.seams[2]) || ((band === 5 || band === 6) && region === 'roof');
  const classify = (band, zm, kmin, i, side) => {
    const f = fr(zm);
    const region = f < Z.cowl ? 'nose' : f < Z.roofF ? 'ws' : f < Z.roofR ? 'roof' : f < Z.deck ? 'rw' : 'tail';
    let m = VM.paint;
    if (band === 0) { if (s.cladding || f < bumpF || f > bumpR) m = VM.trim; }
    else if (band === 3) { if (kmin > 0.5) m = VM.trimGloss; }
    else if (band === 4) { if (kmin > 0.15 && region !== 'nose' && region !== 'tail') { const g = inSide(f); m = g === 1 ? VM.glass : g === 2 ? VM.trimGloss : VM.paint; } }
    else if (band === 6) { if ((region === 'ws' || region === 'rw') && kmin > 0.03) m = VM.glass; }
    if (s.bed && f > s.bed - 0.004 && band >= 4) m = VM.liner;
    // wrap-around lamps on the nose / tail strips
    if (s.lights && !(s.bed && f > s.bed)) {
      const hl = s.lights.head, tl = s.lights.tail;
      if (f >= hl[0] && f <= hl[1] && (band === 2 || band === 3)) m = VM.head;
      if (f >= hl[0] && f <= hl[1] * 0.3 && band === 1) m = VM.amber;
      if (f >= tl[0] && f <= tl[1] && (band === 2 || band === 3)) m = VM.tail;
    }
    if (liv && m === VM.paint) m = livWhite(band, f, region) ? VM.white : VM.black;
    return m;
  };
  const { G, secs } = loft(B, zs, sec, classify, lod ? { pick: [0, 2, 3, 5, 7], bandIds: [0, 2, 4, 6] } : {});
  // caps: front fascia / rear panel
  const fascia = liv ? VM.black : VM.paint;
  cap(B, G[0].map((p) => [p[0], p[1]]), z0, -1, (y) => (y < secs[0].yb + 0.1 ? VM.trim : fascia));
  const S = G.length - 1;
  cap(B, G[S].map((p) => [p[0], p[1]]), z1, 1, (y) => (y < secs[S].yb + 0.1 ? VM.trim : fascia));
  if (s.bed) cap(B, G[S].map((p) => [p[0], p[1]]), z1 - 0.04, -1, (y) => (y > secs[S].ym - 0.46 ? VM.liner : null));
  // underbody + wheels
  const hwm = hwMax * 0.98, sill = s.bot[2][1], uy0 = 0.16, uy1 = sill + 0.06;
  B.box(0, (uy0 + uy1) / 2, (zF + zR) / 2, s.track - s.wheelW - 0.1, uy1 - uy0, s.WB + 2 * rA, VM.under);
  for (const za of [zF, zR]) {
    for (const sd of [-1, 1]) wheel(B, sd * (s.track / 2), za, s.wheelR, s.wheelW, sd, s.rim, lod);
    if (!lod) for (const sd of [-1, 1]) archLiner(B, sd, s.track / 2 - s.wheelW / 2 - 0.05, hwm - 0.02, za, rA, s.wheelR + rA - 0.01);
  }
  // fascia details
  const y0 = secs[0].yb, yTopF = topF(0);
  const fw = planF(0) * hwMax;
  if (!lod) {
    const gy = lerp(y0, yTopF, 0.62);
    B.box(0, gy, z0 - 0.006, Math.min(0.75, fw * 0.85), (yTopF - y0) * 0.36, 0.03, VM.grille);
    B.box(0, lerp(y0, yTopF, 0.17), z0 - 0.004, fw * 1.25, (yTopF - y0) * 0.2, 0.03, VM.trim);
    B.box(0, lerp(y0, yTopF, 0.3), z0 - 0.012, 0.305, 0.152, 0.012, VM.plate);
    const yr = lerp(secs[S].yb, topF(1), 0.62);
    B.box(0, yr, z1 + 0.008, 0.305, 0.152, 0.012, VM.plate);
    // mirrors
    const fm = Z.cowl + 0.035, zm = F(fm), hm = planF(fm) * hwMax, ym = beltF(fm) + 0.07;
    for (const sd of [-1, 1]) {
      B.box(sd * (hm + 0.03), ym - 0.03, zm + 0.04, 0.08, 0.05, 0.11, VM.trim);
      B.box(sd * (hm + 0.11), ym + 0.02, zm + 0.05, 0.17, 0.115, 0.085, liv ? VM.black : VM.paint, { yaw: sd * 0.12 });
    }
    // door seams: thin dark strips over the lower side bands
    for (const fs of s.seams) {
      const zsm = F(fs), sc = sec(zsm), p = sc.pts;
      for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) {
        const a = p[j], b = p[j + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;
        const o = 0.004, w = 0.006;
        const A = [sd * (a[0] + nx * o), a[1] + ny * o], Bp = [sd * (b[0] + nx * o), b[1] + ny * o];
        B.quad([A[0], A[1], zsm - w], [Bp[0], Bp[1], zsm - w], [Bp[0], Bp[1], zsm + w], [A[0], A[1], zsm + w], VM.seam, [sd * nx, ny, 0]);
      }
    }
  }
  // roof equipment
  const roofY = (f) => topF(f) + 0.02;
  if (s.roofRails && !lod) {
    const a = Z.roofF + 0.04, b = Z.roofR - 0.02, fm = (a + b) / 2, hwT = planF(fm) * hwMax * s.roofW * 0.86;
    for (const sd of [-1, 1]) B.box(sd * hwT, roofY(fm) + 0.035, F(fm), 0.04, 0.05, (b - a) * L, VM.trimGloss);
  }
  if (s.lightbar) {
    const fm = (Z.roofF + Z.roofR) / 2 - 0.04, y = roofY(fm), zc = F(fm);
    B.box(0, y + 0.03, zc, 1.2, 0.05, 0.28, VM.trim);
    B.box(-0.3, y + 0.09, zc, 0.56, 0.07, 0.24, VM.lbRed);
    B.box(0.3, y + 0.09, zc, 0.56, 0.07, 0.24, VM.lbBlue);
  }
  if (s.pushBar) {
    B.box(0, lerp(y0, yTopF, 0.45), z0 - 0.12, fw * 1.3, 0.34, 0.06, VM.trim);
    if (!lod) for (const sd of [-1, 1]) B.box(sd * 0.32, lerp(y0, yTopF, 0.5), z0 - 0.07, 0.06, 0.42, 0.12, VM.trim);
  }
  if (s.bed) for (const sd of [-1, 1]) B.box(sd * (planF(1) * hwMax - 0.05), 1.0, z1 + 0.004, 0.1, 0.36, 0.03, VM.tail);
  if (s.taxiSign) {
    const fm = (Z.roofF + Z.roofR) / 2, y = roofY(fm), zc = F(fm);
    B.box(0, y + 0.02, zc, 0.5, 0.04, 0.2, VM.trim);
    B.box(0, y + 0.14, zc, 0.62, 0.2, 0.2, VM.sign);
  }
}

// ------------------------------------------------------------------ box truck (cab-over cab + rounded box body)
function roundedBox(B, x0, x1, y0, y1, za, zb, r, m, { endA = m, endB = m, seg = 3 } = {}) {
  const prof = [];
  const cx = [x1 - r, x0 + r], cy = [y0 + r, y1 - r];
  const corner = (px, py, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; prof.push([px + Math.cos(a) * r, py + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); } };
  corner(cx[0], cy[0], -Math.PI / 2); corner(cx[0], cy[1], 0); corner(cx[1], cy[1], Math.PI / 2); corner(cx[1], cy[0], Math.PI);
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], q = prof[(i + 1) % prof.length];
    const a = [p[0], p[1], za], b = [q[0], q[1], za], c = [q[0], q[1], zb], d = [p[0], p[1], zb];
    const na = [p[2], p[3], 0], nb = [q[2], q[3], 0];
    B.tri(a, b, c, m, na, nb, nb); B.tri(a, c, d, m, na, nb, na);
  }
  const ctr = [(x0 + x1) / 2, (y0 + y1) / 2];
  for (const [z, dir, mm] of [[za, -1, endA], [zb, 1, endB]]) {
    if (!mm) continue;
    const n = [0, 0, dir];
    for (let i = 0; i < prof.length; i++) {
      const p = prof[i], q = prof[(i + 1) % prof.length];
      B.tri([ctr[0], ctr[1], z], [p[0], p[1], z], [q[0], q[1], z], mm, n, n, n);
    }
  }
}
function buildBoxTruck(B, s, lod) {
  const L = s.L, z0 = -L / 2, z1 = L / 2, Lc = s.cabL, hwc = s.cabW / 2;
  const zF = z0 + s.ohF, zR = zF + s.WB, rA = s.wheelR + 0.06;
  // cab: reuse the car loft with a cab-only spec
  const cab = { ...s, L: Lc, W: s.cabW, ohF: s.ohF, WB: 99, lights: null, seams: s.seams, cladding: false };
  const topF = pchip(s.top), botF = linear(s.bot), planF = pchip(s.plan), Z = s.zones;
  const F = (g) => z0 + g * Lc, gr = (z) => (z - z0) / Lc;
  const archY = (z) => { const d = z - zF; return Math.abs(d) < rA ? s.wheelR + Math.sqrt(rA * rA - d * d) : -1; };
  const sec = (z) => {
    const g = gr(z), top = topF(g), belt = lerp(s.belt[0], s.belt[1], g);
    const yb = Math.max(botF(g), archY(z));
    let ym = Math.min(top, belt), yt = Math.max(top, ym);
    if (g < Z.cowl - 0.005) { ym = top; yt = top; }
    const k = sstep(0.015, 0.3, yt - ym);
    const hw = planF(g) * hwc, hwT = hw * s.roofW, H = Math.max(0.02, ym - yb);
    const p = [[hw * 0.96, yb], [hw * 0.995, yb + 0.34 * H], [hw, yb + 0.74 * H], [hw * 0.985, ym - 0.01]];
    const wbX = lerp(hw * 0.75, lerp(hw * 0.97, hwT, 0.3), k), wbY = lerp(ym + 0.01, ym + 0.02, k);
    const wtX = lerp(hw * 0.5, hwT, k), wtY = lerp(ym + 0.02, yt - 0.07, k);
    const reX = Math.max(0.05, wtX - lerp(hw * 0.2, 0.1, k)), reY = lerp(ym + 0.026, yt - 0.012, k);
    p.push([wbX, wbY], [wtX, wtY], [reX, reY], [0, lerp(ym + 0.03, yt + 0.015, k)]);
    return { pts: p, k, yb, ym, yt };
  };
  const raw = [];
  for (const k of ['cowl', 'roofF', 'roofR']) raw.push(F(Z[k]));
  if (!lod) { for (const [g] of s.top) raw.push(F(g)); for (const [a, b] of s.side) raw.push(F(a), F(b)); }
  for (const t of (lod ? [-1, -0.5, 0.5, 1] : [-1, -0.85, -0.4, 0.4, 0.85, 1])) raw.push(zF + t * rA);
  const zs = stationList(raw, z0, z0 + Lc, lod ? 1.2 : 0.6, lod ? 0.06 : 0.04);
  const classify = (band, zm, kmin) => {
    const g = gr(zm);
    const region = g < Z.cowl ? 'nose' : g < Z.roofF ? 'ws' : 'roof';
    if (band === 0) return VM.trim;
    if (band === 3 && kmin > 0.5) return VM.trimGloss;
    if (band === 4 && kmin > 0.15 && region !== 'nose') { for (const [a, b] of s.side) if (g >= a && g <= b) return VM.glass; }
    if (band === 6 && region === 'ws' && kmin > 0.03) return VM.glass;
    return VM.paint;
  };
  void cab;
  const { G, secs } = loft(B, zs, sec, classify, lod ? { pick: [0, 2, 3, 5, 7], bandIds: [0, 2, 4, 6] } : {});
  cap(B, G[0].map((p) => [p[0], p[1]]), z0, -1, (y) => (y < secs[0].yb + 0.12 ? VM.trim : VM.paint));
  const S = G.length - 1;
  cap(B, G[S].map((p) => [p[0], p[1]]), z0 + Lc, 1, VM.trim);
  // grille + bumper + lamps on the cab front
  B.box(0, 0.95, z0 - 0.01, 1.2, 0.34, 0.03, VM.grille);
  B.box(0, 0.62, z0 - 0.06, s.cabW + 0.04, 0.24, 0.14, VM.trim);
  for (const sd of [-1, 1]) {
    B.box(sd * (hwc - 0.24), 1.02, z0 - 0.012, 0.3, 0.16, 0.03, VM.head);
    B.box(sd * (hwc - 0.04), 1.05, z0 + 0.06, 0.04, 0.12, 0.14, VM.amber);
    if (!lod) { // west-coast mirrors on arms
      B.box(sd * (hwc + 0.12), 1.9, z0 + 0.45, 0.22, 0.03, 0.03, VM.frame);
      B.box(sd * (hwc + 0.24), 1.85, z0 + 0.45, 0.05, 0.42, 0.18, VM.trim);
    }
  }
  if (!lod) B.box(0, 0.62, z0 - 0.141, 0.305, 0.152, 0.01, VM.plate);
  // box body
  const bz0 = z0 + Lc + 0.1, bz1 = z1 - 0.02, hwb = s.W / 2, by0 = 1.04, by1 = s.H;
  roundedBox(B, -hwb, hwb, by0, by1, bz0, bz1, 0.07, VM.paint, { seg: lod ? 1 : 3, endB: VM.paint });
  // rear: roll-up door frame, slats, lamps, bumper, plate
  if (!lod) {
    for (let k = 1; k < 9; k++) { const y = by0 + 0.08 + k * ((by1 - by0 - 0.2) / 9); B.quad([-hwb + 0.12, y, bz1 + 0.004], [hwb - 0.12, y, bz1 + 0.004], [hwb - 0.12, y + 0.012, bz1 + 0.004], [-hwb + 0.12, y + 0.012, bz1 + 0.004], VM.seam, [0, 0, 1]); }
    for (const sd of [-1, 1]) B.box(sd * (hwb - 0.06), (by0 + by1) / 2, bz1 + 0.01, 0.08, by1 - by0 - 0.06, 0.02, VM.frame);
    B.box(0, by1 - 0.06, bz1 + 0.01, s.W - 0.04, 0.08, 0.02, VM.frame);
    B.box(0, 1.25, bz1 + 0.013, 0.305, 0.152, 0.01, VM.plate);
  }
  for (const sd of [-1, 1]) {
    B.box(sd * (hwb - 0.2), 1.12, bz1 + 0.012, 0.22, 0.12, 0.02, VM.tail);
    B.box(sd * (hwb - 0.01), by1 - 0.08, bz1 - 0.05, 0.03, 0.06, 0.06, VM.amber);
  }
  B.box(0, 0.62, bz1 - 0.05, s.W - 0.3, 0.12, 0.1, VM.trim);
  // chassis: rails, fuel tank, steps, mudflaps, under-box shadow block
  B.box(0, 0.8, (z0 + Lc + z1) / 2 - 0.2, 0.95, 0.24, z1 - z0 - Lc - 0.2, VM.under);
  B.box(0, 0.97, (bz0 + bz1) / 2, s.W - 0.1, 0.12, bz1 - bz0 - 0.1, VM.trim);
  if (!lod) {
    const tank = new THREE.CylinderGeometry(0.24, 0.24, 0.9, 10, 1).rotateX(Math.PI / 2);
    B.geo(tank, VM.chrome, new THREE.Matrix4().setPosition(-0.75, 0.62, zF + 1.5));
    for (const sd of [-1, 1]) B.box(sd * (hwb - 0.15), 0.62, zR + s.wheelR + 0.2, 0.36, 0.5, 0.03, VM.trim);
  }
  // wheels: single front, wide (dual-look) rear
  for (const sd of [-1, 1]) {
    wheel(B, sd * (s.track / 2), zF, s.wheelR, s.wheelW, sd, 'truck', lod);
    wheel(B, sd * (s.track / 2 + 0.06), zR, s.wheelR, s.wheelWR, sd, 'truck', lod);
  }
}

/** Bus livery (vertex materials): lower body band + window-line stripe. Games pass their own (e.g. a transit agency's). */
export const DEFAULT_BUS_LIVERY = {
  lower: { c: [0.36, 0.37, 0.39], rough: 0.32, metal: 0.55, cc: 1 },
  stripe: { c: [0.03, 0.13, 0.42], rough: 0.32, metal: 0.05, cc: 1 },
};

// ------------------------------------------------------------------ city bus (40 ft low-floor)
function buildBus(B, s, lod, livery = DEFAULT_BUS_LIVERY) {
  const LOWER = livery.lower || DEFAULT_BUS_LIVERY.lower, STRIPE = livery.stripe || DEFAULT_BUS_LIVERY.stripe;
  const L = s.L, z0 = -L / 2, z1 = L / 2, hwM = s.W / 2;
  const zF = z0 + s.ohF, zR = zF + s.WB, rA = s.wheelR + 0.06;
  const planF = pchip([[0, 0.93], [0.006, 0.975], [0.018, 1], [0.985, 1], [0.995, 0.975], [1, 0.95]]);
  const archY = (z) => { let y = -1; for (const za of [zF, zR]) { const d = z - za; if (Math.abs(d) < rA) y = Math.max(y, s.wheelR + Math.sqrt(rA * rA - d * d)); } return y; };
  const sec = (z) => {
    const f = (z - z0) / L, hw = planF(f) * hwM;
    const yb = Math.max(0.32, archY(z));
    const y1 = Math.max(yb + 0.03, 0.44), y2 = Math.max(y1 + 0.03, 0.98), y3 = Math.max(y2 + 0.03, 1.2);
    const p = [[hw * 0.985, yb], [hw, y1], [hw, y2], [hw, y3], [hw * 0.993, 2.36], [hw * 0.958, 2.8], [hw * 0.83, 2.975], [0, 3.01]];
    return { pts: p, k: 1, yb };
  };
  const raw = lod ? [z0 + 0.1, z1 - 0.1] : [z0 + 0.03, z0 + 0.1, z0 + 0.25, z1 - 0.25, z1 - 0.1, z1 - 0.03];
  for (const za of [zF, zR]) for (const t of (lod ? [-1, -0.5, 0.5, 1] : [-1, -0.8, -0.4, 0.4, 0.8, 1])) raw.push(za + t * rA);
  const zs = stationList(raw, z0, z1, lod ? 4 : 2.5, 0.03);
  const classify = (band, zm) => {
    const f = (zm - z0) / L;
    if (band === 0) return VM.skirt;
    if (band === 1) return LOWER;
    if (band === 2) return STRIPE;
    if (band === 3) return f > 0.004 && f < 0.975 ? VM.glass : VM.white;
    return VM.white;
  };
  const { G } = loft(B, zs, sec, classify, lod ? { pick: [0, 2, 3, 4, 7], bandIds: [1, 2, 3, 4] } : {});
  cap(B, G[0].map((p) => [p[0], p[1]]), z0, -1, (y) => (y < 0.6 ? VM.skirt : VM.white));
  cap(B, G[G.length - 1].map((p) => [p[0], p[1]]), z1, 1, (y) => (y < 0.6 ? VM.skirt : y < 0.98 ? LOWER : VM.white));
  const fw = hwM * 0.93;
  // front: windscreen, destination sign, lamps, bumper, bike rack
  const zf = z0 - 0.006;
  B.quad([-fw + 0.08, 1.0, zf], [fw - 0.08, 1.0, zf], [fw - 0.1, 2.55, zf], [-fw + 0.1, 2.55, zf], VM.glass, [0, 0, -1]);
  B.quad([-fw + 0.22, 2.6, zf], [fw - 0.22, 2.6, zf], [fw - 0.22, 2.86, zf], [-fw + 0.22, 2.86, zf], VM.dest, [0, 0, -1]);
  B.box(0, 0.45, z0 - 0.06, s.W - 0.1, 0.26, 0.14, VM.trim);
  for (const sd of [-1, 1]) {
    B.box(sd * (fw - 0.26), 0.74, z0 - 0.01, 0.34, 0.14, 0.03, VM.head);
    B.box(sd * (fw - 0.06), 0.74, z0 + 0.04, 0.04, 0.12, 0.1, VM.amber);
  }
  if (!lod) {
    B.box(0, 0.62, z0 - 0.32, 1.5, 0.04, 0.04, VM.frame);
    B.box(0, 0.98, z0 - 0.32, 1.5, 0.04, 0.04, VM.frame);
    for (const x of [-0.7, 0, 0.7]) B.box(x, 0.8, z0 - 0.22, 0.04, 0.4, 0.22, VM.frame);
    B.box(0, 0.6, z0 - 0.14, 0.305, 0.152, 0.01, VM.plate);
    for (const sd of [-1, 1]) { // mirrors on bent arms
      B.box(sd * (hwM + 0.12), 2.62, z0 + 0.2, 0.26, 0.04, 0.04, VM.frame);
      B.box(sd * (hwM + 0.24), 2.3, z0 - 0.02, 0.06, 0.55, 0.2, VM.trim);
    }
  }
  // rear: window, lamps, bumper
  const zb = z1 + 0.006;
  B.quad([-fw + 0.35, 1.9, zb], [fw - 0.35, 1.9, zb], [fw - 0.35, 2.45, zb], [-fw + 0.35, 2.45, zb], VM.glass, [0, 0, 1]);
  B.box(0, 0.45, z1 + 0.05, s.W - 0.1, 0.26, 0.12, VM.trim);
  for (const sd of [-1, 1]) {
    B.box(sd * (fw - 0.08), 1.25, z1 + 0.01, 0.16, 0.6, 0.03, VM.tail);
    B.box(sd * (fw - 0.08), 0.85, z1 + 0.01, 0.16, 0.14, 0.03, VM.amber);
  }
  // side: window pillars, doors (kerb side = +X), wheel skirts
  const xs = hwM + 0.004;
  if (!lod) {
    for (let z = zF + 0.7; z < z1 - 0.5; z += 1.42) {
      if (z > 1.45 && z < 2.85) continue; // rear door
      for (const sd of [-1, 1]) B.quad([sd * xs, 1.2, z - 0.04], [sd * xs, 1.2, z + 0.04], [sd * xs * 0.993, 2.36, z + 0.04], [sd * xs * 0.993, 2.36, z - 0.04], VM.frame, [sd, 0, 0]);
    }
  }
  for (const [za, zb2] of [[z0 + 0.3, z0 + 1.48], [1.55, 2.72]]) {
    B.quad([xs + 0.002, 0.36, za], [xs + 0.002, 0.36, zb2], [xs + 0.002, 2.5, zb2], [xs + 0.002, 2.5, za], VM.glass, [1, 0, 0]);
    if (!lod) {
      const zc = (za + zb2) / 2;
      B.quad([xs + 0.004, 0.36, zc - 0.03], [xs + 0.004, 0.36, zc + 0.03], [xs + 0.004, 2.5, zc + 0.03], [xs + 0.004, 2.5, zc - 0.03], VM.frame, [1, 0, 0]);
      B.quad([xs + 0.004, 2.46, za], [xs + 0.004, 2.46, zb2], [xs + 0.004, 2.52, zb2], [xs + 0.004, 2.52, za], VM.frame, [1, 0, 0]);
    }
  }
  // roof pods (batteries / HVAC)
  B.box(0, 3.1, 1.2, 1.9, 0.2, 3.6, VM.white);
  if (!lod) { B.box(0, 3.08, -2.6, 1.5, 0.16, 1.6, VM.white); B.box(0, 3.14, 4.6, 2.0, 0.26, 1.8, LOWER); }
  // underbody + wheels
  B.box(0, 0.3, (zF + zR) / 2, s.W - 0.3, 0.2, s.WB + 2 * rA, VM.under);
  for (const sd of [-1, 1]) {
    wheel(B, sd * (s.track / 2 + 0.04), zF, s.wheelR, s.wheelW, sd, 'truck', lod);
    wheel(B, sd * (s.track / 2 + 0.1), zR, s.wheelR, s.wheelWR, sd, 'truck', lod);
    if (!lod) for (const za of [zF, zR]) B.box(sd * (s.track / 2 - 0.25), 0.75, za, 0.04, 0.85, rA * 1.9, VM.under);
  }
}

// ------------------------------------------------------------------ HD level (lod: 'hd')
// The same cars at ~20-40k triangles, made to be looked at from 2 m. Every anchor is computed exactly as buildCar does
// (top / belt / bot / plan profiles, zones, wheel arches, the 8 LOD-0 section points), so proportions are unchanged;
// the HD section is a chain of curves through those anchors: underside flange, rolled sill / arch lip, lower side, a
// crisp character line, rounded shoulder, belt ledge, glass with tumblehome, rounded roof edge (drip rail), crowned
// roof. Section features: V-groove shut lines (door bottoms, bumper line, hood / trunk edges), a raised rubbing strip,
// arch flares. Stations are spaced by profile curvature (2-3 cm through nose, tail, pillars; ~12 cm along the doors)
// plus forced stations (window edges, arches, V-groove door / hood / trunk / bumper shut lines), the ends roll inward
// over a 4 cm radius onto planar fascia / rear panels that carry real pockets (lamps, grille, plate recess).
// Hard edges on purpose: a section point is duplicated where two curves meet with a kink; the copies keep their
// one-sided normals above ~9 deg of kink and blend to one normal below ~3 deg (no accidental facets or melted edges).
// Glass and lenses go to a separate list (drawn blended: createVehicleMaterial({ glass: true }), aSurf.y = opacity),
// inset 6 mm behind rubber reveals, with an interior (door cards, headliner, seats, dash, wheel, shelf) behind them.
// Wheels are built in their own frame (hub at the origin, axle = X) so games can spin / steer them (makeVehicleParts).
// ------------------------------------------------------------------ HD / mid surface atlas (shared, generated once)
// 512 x 512 RGBA, 4 x 4 tiles of 128 px: RGB = albedo multiplier (64 = x1), A = height (bump). Tiles (aTex.x):
//   0 paint flake   1 tread sipes   2 tyre sidewall lettering   3 disc machining   4 fluted lens   5 prismatic reflector
//   6 seat fabric   7 plastic grain   8 licence plate             9 taxi sign face   10 orange peel (clear coat)
// Mapped by the HD / mid geometry's aUv (box-mapped metres by default, explicit on wheels, plates, the sign) times
// aTex.y (tiles per unit); read by createVehicleMaterial({ hd: true }). Built in plain JS (no DOM): Node and workers too.
const FONT5x7 = {
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12], A: [14, 17, 17, 31, 17, 17, 17], C: [14, 17, 16, 16, 16, 17, 14],
  D: [28, 18, 17, 17, 17, 18, 28], E: [31, 16, 16, 30, 16, 16, 31], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31], M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4], V: [17, 17, 17, 17, 17, 10, 4], X: [17, 17, 10, 4, 10, 17, 17], Y: [17, 17, 10, 4, 4, 4, 4],
  '/': [1, 1, 2, 4, 8, 16, 16], '-': [0, 0, 0, 31, 0, 0, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
};
let _atlas = null;
/** The shared vehicle surface atlas (THREE.DataTexture, built on first use). */
export function getVehicleAtlas() {
  if (_atlas) return _atlas;
  const N = 512, T = 128, D = new Uint8Array(N * N * 4);
  let seed = 0x9e3779b9;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const tileNoise = (P) => { const g = Array.from({ length: P * P }, rnd); return (u, v) => { // tileable smooth value noise, period 1
    const x = u * P, y = v * P, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const G = (a, b) => g[((b % P + P) % P) * P + ((a % P + P) % P)];
    return lerp(lerp(G(i, j), G(i + 1, j), sx), lerp(G(i, j + 1), G(i + 1, j + 1), sx), sy);
  }; };
  const put = (id, fn) => { // fn(u, v, px, py) -> [r, g, b, a] (0..255)
    const cx = (id % 4) * T, cy = Math.floor(id / 4) * T;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const c = fn((x + 0.5) / T, (y + 0.5) / T, x, y), o = ((cy + y) * N + cx + x) * 4;
      D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = c[3];
    }
  };
  const text = (str, px, py, sx, sy) => { // glyph mask lookup for a tile: (x, y) -> 0 | 1
    return (x, y) => {
      const gx = Math.floor((x - px) / sx), gy = Math.floor((y - py) / sy);
      if (gy < 0 || gy > 6 || gx < 0) return 0;
      const ci = Math.floor(gx / 6), col = gx % 6; if (ci >= str.length || col > 4) return 0;
      const row = (FONT5x7[str[ci]] || FONT5x7[' '])[6 - gy];
      return (row >> (4 - col)) & 1;
    };
  };
  const n0 = tileNoise(32), n1 = tileNoise(8), n2 = tileNoise(16), n3 = tileNoise(4);
  put(0, () => { const h = rnd(); return [64, 64, 64, Math.floor(h * h * 255)]; }); // metallic flake: sparse bright facets
  put(1, (u, v) => { // tread block: a diagonal sipe and two lateral slits
    const d = Math.abs(((u + v * 0.6) % 1) - 0.5), s = Math.abs(v - 0.5) < 0.04 || Math.abs(v - 0.15) < 0.025 || Math.abs(v - 0.85) < 0.025;
    return [64, 64, 64, d < 0.05 || s ? 40 : 230];
  });
  { // sidewall: a maker word + size twice round the tyre, a rim rib, fine radial ribs near the tread
    const w = text('ROVERA  205/65 R15', 6, 52, 1, 3);
    put(2, (u, v, x, y) => { const l = w(x, y), rib = v > 0.86 ? 120 + 60 * Math.sin(u * 900) : v < 0.1 ? 170 : 128; return l ? [118, 118, 120, 230] : [64, 64, 64, rib]; });
  }
  put(3, (u, v) => { const s = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 9); return [58 + 12 * s, 58 + 12 * s, 60 + 12 * s, 100 + 60 * s]; });
  put(4, (u) => { const t = 2 * ((u * 4) % 1) - 1; return [64, 64, 64, Math.floor(255 * Math.sqrt(Math.max(0, 1 - t * t)))]; });
  put(5, (u, v) => { const a = Math.abs(((u * 4) % 1) - 0.5) + Math.abs(((v * 4) % 1) - 0.5); return [66, 66, 66, Math.floor(255 * (1 - a))]; });
  put(6, (u, v) => { const wv = ((Math.floor(u * 32) + Math.floor(v * 32)) & 1) ? Math.sin((u * 32 % 1) * Math.PI) : Math.sin((v * 32 % 1) * Math.PI), k = 0.85 + 0.3 * n2(u, v); return [64 * k * (0.9 + 0.1 * wv), 64 * k * (0.9 + 0.1 * wv), 64 * k * (0.9 + 0.1 * wv), 90 + 140 * wv]; });
  put(7, (u, v) => { const h = 0.6 * n0(u, v) + 0.4 * n2(u, v), k = 0.94 + 0.12 * h; return [64 * k, 64 * k, 64 * k, h * 255]; });
  { // plate: light ground, an embossed invented number, a state band, a dark frame
    const main = text('7KR-418', 9, 30, 2, 9), band = text('VEHICLE', 43, 108, 1, 1);
    put(8, (u, v, x, y) => {
      if (x < 4 || x > 123 || y < 5 || y > 122) return [24, 24, 26, 200];
      if (main(x, y)) return [10, 16, 40, 240];
      if (band(x, y)) return [70, 20, 18, 170];
      const g = 0.92 + 0.08 * n1(u, v); return [100 * g, 102 * g, 106 * g, 128];
    });
  }
  { // taxi sign face: lit word on a dim panel inside a frame
    const w = text('TAXI', 22, 36, 3, 8);
    put(9, (u, v, x, y) => (x < 5 || x > 122 || y < 8 || y > 119 ? [12, 12, 12, 128] : w(x, y) ? [255, 255, 255, 128] : [22, 21, 18, 128]));
  }
  put(10, (u, v) => [64, 64, 64, Math.floor(255 * (0.55 * n3(u, v) + 0.45 * n1(u, v)))]);
  for (const id of [11, 12, 13, 14, 15]) put(id, () => [64, 64, 64, 128]);
  const t = new THREE.DataTexture(D, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; t.name = 'vehicle-atlas';
  return (_atlas = t);
}

/**
 * PartBuilder that also records aUv (box-mapped metres by the triangle's dominant axis, or `uv(p, n, id)` when set)
 * and aTex (atlas tile, tiles per unit) per vertex, from the material's tex / ts or the TEXOF table.
 */
class TexBuilder extends PartBuilder {
  constructor() { super(); this.U = []; this.X = []; this.uv = null; this._ax = 2; this._uvq = null; }
  tri(a, b, c, m, na, nb, nc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const fx = Math.abs(uy * vz - uz * vy), fy = Math.abs(uz * vx - ux * vz), fz = Math.abs(ux * vy - uy * vx);
    this._ax = fx >= fy && fx >= fz ? 0 : fy >= fz ? 1 : 2;
    const t = texOf(m);
    this._uvq = null;
    if (t && this.uv) { // explicit mapping [u, v, period], unwrapped across its period inside the triangle
      const q = [this.uv(a, t[0]), this.uv(b, t[0]), this.uv(c, t[0])];
      if (q[0] && q[1] && q[2]) {
        const per = q[0][2] || 0;
        if (per) { const mx = Math.max(q[0][0], q[1][0], q[2][0]); for (const e of q) if (mx - e[0] > per / 2) e[0] += per; }
        q[0].src = a; q[1].src = b; q[2].src = c; this._uvq = q;
      }
    }
    super.tri(a, b, c, m, na, nb, nc);
    this._uvq = null;
  }
  _v(p, n, m) {
    super._v(p, n, m);
    const t = texOf(m);
    let u = 0, v = 0;
    const q = this._uvq && this._uvq.find((e) => e.src === p);
    if (q) { u = q[0]; v = q[1]; } else if (t) { const ax = this._ax; u = ax === 0 ? p[2] : p[0]; v = ax === 1 ? p[2] : p[1]; }
    this.U.push(u, v); this.X.push(t ? t[0] : -1, t ? t[1] : 0);
  }
}

const HM = {
  rubber: { c: [0.011, 0.011, 0.012], rough: 0.8, metal: 0, cc: 0 },
  seam: { c: [0.004, 0.004, 0.0045], rough: 0.9, metal: 0, cc: 0 },
  frit: { c: [0.006, 0.006, 0.007], rough: 0.3, metal: 0, cc: 1 },
  // glassy: drawn by the glass material, where aSurf.y (metal) is the opacity
  glass: { c: [0.012, 0.014, 0.016], rough: 0.02, metal: 0.5, cc: 1, glassy: true },
  lensTail: { c: [0.3, 0.006, 0.008], lamp: 2.4, rough: 0.04, metal: 0.5, cc: 1, glassy: true },
  lensHead: { c: [0.32, 0.33, 0.35], lamp: 1.45, rough: 0.03, metal: 0.14, cc: 1, glassy: true },
  lensAmber: { c: [0.55, 0.22, 0.02], lamp: 3.3, rough: 0.04, metal: 0.38, cc: 1, glassy: true },
  lensClear: { c: [0.2, 0.19, 0.19], rough: 0.03, metal: 0.35, cc: 1, glassy: true },
  reflector: { c: [0.78, 0.78, 0.8], rough: 0.16, metal: 1, cc: 0 },
  reverse: { c: [0.32, 0.32, 0.33], rough: 0.3, metal: 0.9, cc: 0 },
  plate: { c: [0.5, 0.52, 0.55], rough: 0.45, metal: 0.15 },
  headRefl: { c: [0.72, 0.73, 0.75], lamp: 1.42, rough: 0.1, metal: 1, cc: 0 },
  bowl: { c: [0.8, 0.8, 0.82], lamp: 1.3, rough: 0.08, metal: 1, cc: 0 },
  bulb: { c: [0.9, 0.88, 0.8], lamp: 1, rough: 0.1, metal: 0, cc: 1 },
  tailCell: { c: [0.36, 0.03, 0.015], lamp: 2.2, rough: 0.25, metal: 0.25, cc: 0.6 },
  tailRib: { c: [0.13, 0.004, 0.006], lamp: 2.35, rough: 0.3, metal: 0.2, cc: 0.4 },
  tailWall: { c: [0.1, 0.004, 0.005], lamp: 2.42, rough: 0.35, metal: 0.3, cc: 0 },
  alloy: { c: [0.42, 0.43, 0.45], rough: 0.28, metal: 0.95, cc: 0.3 },
  amberCell: { c: [0.52, 0.2, 0.015], lamp: 3, rough: 0.25, metal: 0.3, cc: 0.5 },
  reflRed: { c: [0.32, 0.01, 0.012], lamp: 2, rough: 0.2, metal: 0.3, cc: 1 },
  housing: { c: [0.016, 0.016, 0.018], rough: 0.5, metal: 0.3, cc: 0 },
  mirror: { c: [0.86, 0.87, 0.9], rough: 0.03, metal: 1, cc: 0 },
  seat: { c: [0.026, 0.024, 0.023], rough: 0.85, metal: 0 },
  dash: { c: [0.016, 0.016, 0.017], rough: 0.65, metal: 0 },
  card: { c: [0.03, 0.029, 0.028], rough: 0.8, metal: 0 },
  headliner: { c: [0.07, 0.068, 0.064], rough: 0.92, metal: 0 },
  carpet: { c: [0.012, 0.012, 0.013], rough: 0.95, metal: 0 },
  disc: { c: [0.3, 0.29, 0.28], rough: 0.42, metal: 0.9 },
  caliper: { c: [0.045, 0.045, 0.05], rough: 0.5, metal: 0.4 },
  sidewall: { c: [0.028, 0.028, 0.03], rough: 0.82, metal: 0 },
  tread: { c: [0.02, 0.02, 0.021], rough: 0.95, metal: 0 },
  groove: { c: [0.009, 0.009, 0.01], rough: 0.95, metal: 0 },
  barrel: { c: [0.2, 0.2, 0.21], rough: 0.4, metal: 0.85 },
  plateTxt: { c: [0.02, 0.04, 0.12], rough: 0.5, metal: 0 },
  exhaust: { c: [0.3, 0.29, 0.28], rough: 0.4, metal: 0.9 },
  // mid level: glass drawn opaque (dark, reflective; nothing behind it)
  glassMid: { c: [0.016, 0.019, 0.022], rough: 0.04, metal: 0.35, cc: 1 },
  // tail-lamp cells glow hottest in the middle of each cell (n +- d codes: 1 - 2d)
  tailHot: { c: [0.42, 0.06, 0.03], lamp: 2, rough: 0.25, metal: 0.25, cc: 0.6 },
  tailDim: { c: [0.2, 0.012, 0.01], lamp: 2.38, rough: 0.3, metal: 0.25, cc: 0.4 },
  headCore: { c: [0.95, 0.93, 0.88], lamp: 1, rough: 0.1, metal: 0, cc: 1 },
  signFace: { c: [0.92, 0.8, 0.42], lamp: 4.4, rough: 0.3, metal: 0, cc: 0.5, tex: 9, ts: 1 },
  signShell: { c: [0.86, 0.82, 0.66], rough: 0.35, metal: 0, cc: 0.5 },
};
/** Atlas tile + tiles per unit of a material (HD / mid TexBuilder): own { tex, ts } or this table (shared VM keys). */
const TEXOF = new Map([
  [VM.paint, [0, 14]], [VM.white, [0, 14]], [VM.black, [0, 14]], [VM.trim, [7, 25]], [VM.trimGloss, [7, 25]], [VM.grille, [7, 25]],
  [HM.dash, [7, 25]], [HM.card, [7, 25]], [HM.housing, [7, 25]], [HM.seat, [6, 30]], [HM.headliner, [6, 30]], [HM.carpet, [6, 50]],
  [HM.tread, [1, 1]], [HM.groove, [1, 1]], [HM.sidewall, [2, 1]], [HM.disc, [3, 1]], [HM.lensHead, [4, 40]], [HM.lensAmber, [4, 40]],
  [HM.headRefl, [5, 45]], [HM.bowl, [5, 60]], [HM.lensTail, [5, 40]], [HM.plate, [8, 1]],
]);
const texOf = (m) => (m.tex != null ? [m.tex, m.ts ?? 1] : TEXOF.get(m) || null);
const v2n = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const bz2 = (a, b, c, t) => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]; };
const bz3 = (a, b, c, d, t) => {
  const u = 1 - t, A = u * u * u, Bq = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t;
  return [A * a[0] + Bq * b[0] + C * c[0] + D * d[0], A * a[1] + Bq * b[1] + C * c[1] + D * d[1]];
};
const rot2 = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
const mix2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const same2 = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/** buildCar's anchor maths (profiles, zones, arches, the 8 LOD-0 section points), shared by the HD level. */
function carFrame(s) {
  const L = s.L, z0 = -L / 2, z1 = L / 2, hwMax = s.W / 2;
  const F = (f) => z0 + f * L, fr = (z) => (z - z0) / L;
  // HD: the same top anchors, but the last span (deck / tailgate edge -> tail) is straight, so the boot lid ends on a
  // deliberate edge at the last-but-one anchor instead of rolling round into the rear panel
  // the nose: the hood's leading edge raised to just under its height 5 % back (a real fascia under it, not a wedge),
  // the bumper's lower edge brought down to the sill line (an air dam below a deep bumper)
  const topIn = pchip(s.top), he = topIn(0.05) - 0.015, top = s.top.map((p) => p.slice());
  top[0][1] = Math.max(top[0][1], he - 0.04); if (top[1][0] < 0.03) top[1][1] = Math.max(top[1][1], he - 0.01);
  const top0 = pchip(top), tA = top[top.length - 2], tB = top[top.length - 1];
  const topF = (f) => (f <= tA[0] ? top0(f) : f >= tB[0] ? tB[1] : lerp(tA[1], tB[1], (f - tA[0]) / (tB[0] - tA[0])));
  const bot = s.bot.map((p) => p.slice()), nb = bot.length;
  bot[0][1] = Math.min(bot[0][1], bot[1][1] + 0.01); bot[nb - 1][1] = Math.min(bot[nb - 1][1], bot[nb - 2][1] + 0.05);
  // plan: nearly full width to the tail corner (the rolled end rounds it) and a squarer nose (no pear / wedge in plan)
  const planIn = pchip(s.plan), pT = planIn(0.92), pN = planIn(0.1);
  const planF = (f) => Math.max(planIn(f), f > 0.92 ? lerp(pT, 0.975, (f - 0.92) / 0.08) : f < 0.1 ? lerp(0.915, pN, f / 0.1) : 0);
  const botF = linear(bot), Z = s.zones;
  const zF = z0 + s.ohF, zR = zF + s.WB, rA = s.wheelR + 0.055;
  const archY = (z) => {
    let y = -1;
    for (const za of [zF, zR]) { const d = z - za; if (Math.abs(d) < rA) y = Math.max(y, s.wheelR + Math.sqrt(rA * rA - d * d)); }
    return y;
  };
  const beltF = (f) => lerp(s.belt[0], s.belt[1], clamp((f - Z.cowl) / (Z.deck - Z.cowl), 0, 1));
  const anchors = (z) => {
    const f = fr(z), top = topF(f), belt = beltF(f), ybs = botF(f), yb = Math.max(ybs, archY(z));
    let ym = Math.min(top, belt), yt = Math.max(top, ym);
    if (f < Z.cowl - 0.005 || f > Z.deck + 0.003) { ym = top; yt = top; }
    const k = sstep(0.015, 0.28, yt - ym);
    // HD: the glass reaches its full width sooner where the greenhouse meets the hood / deck (broad windscreen and
    // rear window bases instead of LOD 0's wedge); heights (and so every silhouette) are buildCar's
    const kx = sstep(0, 0.1, yt - ym);
    const hw = planF(f) * hwMax, hwT = hw * s.roofW, H = Math.max(0.02, ym - yb), Hn = Math.max(0.02, ym - ybs);
    const p = [[hw * 0.93, yb], [hw * 0.995, yb + 0.34 * H], [hw, yb + 0.74 * H], [hw * 0.955, ym - 0.012 * Math.min(1, H / 0.1)]];
    const bed = !!(s.bed && f >= s.bed - 1e-4);
    if (bed) p.push([hw * 0.905, ym], [hw * 0.875, ym - 0.42], [hw * 0.6, ym - 0.44], [0, ym - 0.44]);
    else {
      const wbX = lerp(hw * 0.7, lerp(hw * 0.92, hwT, 0.22), k), wbY = lerp(ym + 0.012, ym + 0.02, k);
      const wtX = lerp(hw * 0.45, hwT, kx), wtY = lerp(ym + 0.022, yt - 0.06, k);
      const reX = Math.max(0.05, wtX - lerp(hw * 0.2, 0.09, kx)), reY = lerp(ym + 0.028, yt - 0.012, k);
      p.push([wbX, wbY], [wtX, wtY], [reX, reY], [0, lerp(ym + 0.032, yt + 0.02, k)]);
    }
    return { pts: p, k, f, hw, ym, yt, yb, ybs, bed, y1n: ybs + 0.34 * Hn, y2n: ybs + 0.74 * Hn };
  };
  return { L, z0, z1, hwMax, F, fr, topF, botF, planF, Z, zF, zR, rA, archY, beltF, anchors };
}

/**
 * HD half section (right side, bottom-inner -> roof centre) at a station { z, zq, off, zg }: zq = profile station
 * (fillet stations reuse the end section), off = inward offset (rolled ends), zg = V-groove depth at this station.
 * Returns { pts, L (interval labels), idx, k, f, bed, rsOn, door, bump, hood }.
 */
function hdSection(K, s, lay, lo = false) {
  const { anchors, Z, zF, zR, rA } = K;
  return (st) => {
    const a = anchors(st.zq), { hw, yb, ym, f, bed } = a, A = a.pts;
    const k = bed ? 1 : a.k;
    const P = [], L = [], O = [], idx = {};
    const add = (p, l, o = 0, name = null) => { if (name) idx[name] = P.length; P.push([p[0], p[1]]); L.push(l); O.push(o); };
    const H = Math.max(0.02, ym - yb), rs = Math.min(0.055, 0.3 * H), Hn = Math.max(0.02, ym - a.ybs), rsn = Math.min(0.055, 0.3 * Hn);
    // A: underside flange, then the rolled sill (or the arch lip) turning up into the side. The side (B) keeps the
    // heights it has away from the arches (a straight character line, horizontal flow lines); over an arch its
    // points below the lip collapse onto the lip instead of being squeezed into the remaining band
    // (the character line rises over an arch top only as far as it must, along a smooth max: an eyebrow, not a kink)
    const smax = (u, v, w) => (u + v + Math.sqrt((u - v) * (u - v) + w * w)) / 2;
    const yQ = yb + rs, yQn = a.ybs + rsn, y1 = Math.max(a.y1n, yQn + 0.012), y2 = Math.max(smax(a.y2n, yQ + 0.05, 0.08), y1 + 0.012);
    const xB = pchip([[yQn, hw * 0.978], [y1, A[1][0]], [y2, A[2][0]]]);
    const Q = [xB(yQ), yQ], sQ = (xB(yQ + 0.002) - Q[0]) / 0.002;
    const U1 = [hw * 0.925, yb], Uc = [Q[0] - sQ * rs, yb];
    add([hw * 0.86, yb + 0.006], 'U'); add(U1, 'A', 0, 'U1'); if (!lo) add(bz2(U1, Uc, Q, 0.5), 'A');
    // B: lower side with the door-bottom groove, the rubbing strip and the bumper line, placed by height
    const yBt = f < 0.5 ? lay.yBtF : lay.yBtR, yRs = lerp(lay.yRsF, lay.yRsR, clamp(f, 0, 1)), yDb = a.ybs + 0.085;
    const fw = [0.0025, 0.0175, 0.0025];
    let gap = 0.003;
    const top = y2 - 0.012, sc = Math.min(1, (top - yQn) / (2 * (fw[0] + fw[1] + fw[2]) + 4 * gap));
    gap *= sc; for (let q = 0; q < 3; q++) fw[q] *= sc; // little side over the arches (features masked off there)
    // stacked bottom-up from their nominal heights, then pushed down from the top: continuous in z (no wrinkles)
    const c = [Math.max(yDb, yQn + fw[0] + gap), 0, 0];
    c[1] = Math.max(yRs, c[0] + fw[0] + fw[1] + gap); c[2] = Math.max(yBt, c[1] + fw[1] + fw[2] + gap);
    c[2] = Math.min(c[2], top - fw[2] - gap); c[1] = Math.min(c[1], c[2] - fw[2] - fw[1] - gap); c[0] = Math.min(c[0], c[1] - fw[1] - fw[0] - gap);
    const door = f > lay.door0 && f < lay.door1 ? 1 : 0, bump = f < lay.bumpF || f > lay.bumpR ? 1 : 0;
    const rsOn = sstep(yQ + 0.006, yQ + 0.02, c[1] - fw[1]);
    const dDb = 0.0032 * door * sstep(yQ + 0.002, yQ + 0.01, c[0] - fw[0]);
    // over an arch the side points spread evenly over the band left above the lip (w: how far the lip has risen)
    let yPrev = yQ, rank = 0;
    const wA = clamp((yQ - yQn) / 0.1, 0, 1);
    const pt = (y) => { const yy = yPrev = Math.max(y, yPrev + 0.0004, yQ + (y2 - yQ) * (++rank / 13) * wA); return [xB(yy), yy]; }, sl = Math.min(0.005, fw[1] * 0.3);
    add(Q, 'B1', 0, lo ? 'DBc' : null);
    if (!lo) { add(pt(c[0] - fw[0]), 'DB'); add(pt(c[0]), 'DB', -dDb, 'DBc'); add(pt(c[0] + fw[0]), 'B1b'); }
    add(pt(c[1] - fw[1]), 'RS'); add(pt(c[1] - fw[1] + sl), 'RS', 0.006 * rsOn); add(pt(c[1] + fw[1] - sl), 'RS', 0.006 * rsOn); add(pt(c[1] + fw[1]), 'B2a', 0, lo ? 'BTc' : null);
    if (!lo) { add(pt(c[2] - fw[2]), 'BT'); add(pt(c[2]), 'BT', -0.0032 * bump, 'BTc'); add(pt(c[2] + fw[2]), 'B2b'); }
    add(pt((c[2] + fw[2] + y2) / 2), 'B2c');
    const P2 = [xB(y2), y2];
    add(P2, 'dup', 0, 'P2'); add(P2, 'C');
    // C: character line -> rounded shoulder (tangent to P3->P4 at R1)
    const P3 = A[3], P4 = A[4], P5 = A[5], P6 = A[6], P7 = A[7];
    const l34 = Math.hypot(P4[0] - P3[0], P4[1] - P3[1]), d34 = v2n(P4[0] - P3[0], P4[1] - P3[1]);
    const R1 = [P3[0] + d34[0] * Math.min(0.03, 0.4 * l34), P3[1] + d34[1] * Math.min(0.03, 0.4 * l34)];
    const C1 = mix2(P2, P3, 0.5);
    if (lo) add(bz3(P2, C1, P3, R1, 0.6), 'C'); else { add(bz3(P2, C1, P3, R1, 0.4), 'C'); add(bz3(P2, C1, P3, R1, 0.75), 'C'); }
    // D: belt ledge / hood / deck with the hood-edge groove and the window seal strip
    const lD = Math.max(1e-3, Math.hypot(P4[0] - R1[0], P4[1] - R1[1])), g = Math.min(0.08, 0.0025 / lD);
    const sealT = Math.max(0.72, 1 - 0.015 / lD);
    const hood = !bed && (f < Z.cowl - 0.004 || f > Z.deck + 0.003) ? 1 : 0;
    add(R1, 'D1', 0, lo ? 'HGc' : null);
    if (!lo) { add(mix2(R1, P4, 0.25), 'D1'); add(mix2(R1, P4, 0.45 - g), 'HG'); add(mix2(R1, P4, 0.45), 'HG', -0.003 * hood, 'HGc'); add(mix2(R1, P4, 0.45 + g), 'D2'); }
    add(mix2(R1, P4, sealT), 'Ds'); add(P4, 'dup', 0, 'P4'); add(P4, 'E');
    // E: side glass (bowed out a little: tumblehome) / hood crown
    const ch = v2n(P5[0] - P4[0], P5[1] - P4[1]), lE = Math.hypot(P5[0] - P4[0], P5[1] - P4[1]);
    const cr4 = v2n(P5[0] - P3[0], P5[1] - P3[1]), cr5 = v2n(P6[0] - P4[0], P6[1] - P4[1]), bw = bed ? 0 : 0.07;
    const r4 = rot2(ch, -bw), r5 = rot2(ch, bw);
    const T4 = v2n(lerp(cr4[0], r4[0], k), lerp(cr4[1], r4[1], k)), T5 = v2n(lerp(cr5[0], r5[0], k), lerp(cr5[1], r5[1], k));
    const E1 = [P4[0] + T4[0] * lE / 3, P4[1] + T4[1] * lE / 3], E2 = [P5[0] - T5[0] * lE / 3, P5[1] - T5[1] * lE / 3];
    if (lo) add(bz3(P4, E1, E2, P5, 0.5), 'E'); else { add(bz3(P4, E1, E2, P5, 1 / 3), 'E'); add(bz3(P4, E1, E2, P5, 2 / 3), 'E'); }
    add(P5, 'dup', 0, 'P5'); add(P5, 'Fs');
    // F: drip rail seal + rounded roof edge
    const cornerF = [lerp(P5[0], P6[0], 0.12), lerp(P5[1], P6[1], 0.88)], Cf = mix2(mix2(P5, P6, 0.5), cornerF, k);
    const lF = Math.max(1e-3, Math.hypot(P6[0] - P5[0], P6[1] - P5[1])), uS = Math.min(0.35, 0.015 / lF);
    add(bz2(P5, Cf, P6, uS), 'F'); if (lo) add(bz2(P5, Cf, P6, 0.6), 'F'); else { add(bz2(P5, Cf, P6, 0.45), 'F'); add(bz2(P5, Cf, P6, 0.75), 'F'); }
    // G: roof crown (frit strip first) / windscreen / rear window / hood centre
    const tF = v2n(P6[0] - Cf[0], P6[1] - Cf[1]), lG = Math.hypot(P7[0] - P6[0], P7[1] - P6[1]);
    const G1 = [P6[0] + tF[0] * lG / 3, P6[1] + tF[1] * lG / 3], G2 = [P7[0] + lG / 3, P7[1]];
    add(P6, 'Gf', 0, 'P6'); for (const u of lo ? [0.1, 0.45, 0.78] : [0.1, 0.32, 0.56, 0.8]) add(bz3(P6, G1, G2, P7, u), 'G');
    add(P7, '-');
    // arch flares: the side below the character line bulges out around the arches
    let fl = 0;
    for (const za of [zF, zR]) fl = Math.max(fl, sstep(rA + 0.22, rA - 0.02, Math.abs(st.zq - za)));
    if (fl > 0 && !bed) for (let j = 0; j < idx.P2; j++) P[j][0] += 0.004 * fl * sstep(y2 + 0.005, y2 - 0.2, P[j][1]);
    // where the character line lifts over an arch (eyebrow) its crease softens to a smooth normal: no lumps at the lip
    const soft = clamp((y2 - a.y2n) / 0.03, 0, 1);
    // offsets along the section normal: features, the station's V-groove, the rolled-end inset
    const n = P.length, N = new Array(n);
    for (let j = 0; j < n; j++) {
      let i0 = j - 1; while (i0 >= 0 && same2(P[i0], P[j])) i0--;
      let i1 = j + 1; while (i1 < n && same2(P[i1], P[j])) i1++;
      const pa = i0 >= 0 ? P[i0] : P[j], pb = i1 < n ? P[i1] : P[j];
      N[j] = v2n(pb[1] - pa[1], -(pb[0] - pa[0]));
    }
    N[n - 1] = [0, 1];
    if (st.zg) {
      const r = st.zg.type === 'door' ? [idx.DBc, idx.P4 + 1] : st.zg.type === 'hood' ? [idx.HGc, n - 1] : [idx.U1, idx.BTc];
      if (st.zg.type !== 'hood' || hood) for (let j = r[0]; j <= r[1]; j++) O[j] -= st.zg.d;
    }
    for (let j = 0; j < n; j++) { const o = O[j] - (st.off || 0); P[j][0] += N[j][0] * o; P[j][1] += N[j][1] * o; }
    P[n - 1][0] = 0;
    return { pts: P, L, idx, k, f, bed, rsOn, door, bump, hood, a, soft };
  };
}

/** x of the outer side surface at height y (from a section's points up to the shoulder), and its 2D normal. */
function sideAt(sc, y) {
  const P = sc.pts, e = sc.idx.P4;
  for (let j = 0; j < e; j++) {
    const a = P[j], b = P[j + 1];
    if ((a[1] - y) * (b[1] - y) <= 0 && Math.abs(b[1] - a[1]) > 1e-6) {
      const t = (y - a[1]) / (b[1] - a[1]);
      return { x: lerp(a[0], b[0], t), n: v2n(b[1] - a[1], -(b[0] - a[0])) };
    }
  }
  return { x: P[sc.idx.P2][0], n: [1, 0] };
}
/** Highest / lowest y of a closed 2D ring at x (vertical line intersections). */
function ringYAt(ring, x, hi = true) {
  let y = hi ? -Infinity : Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if ((a[0] - x) * (b[0] - x) <= 0 && Math.abs(b[0] - a[0]) > 1e-9) {
      const v = lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
      y = hi ? Math.max(y, v) : Math.min(y, v);
    }
  }
  return y;
}
function rrect(x0, y0, x1, y1, r, seg = 3) {
  r = Math.min(r, (x1 - x0) / 2 - 1e-4, (y1 - y0) / 2 - 1e-4);
  const out = [], cs = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
/** Planar polygon (with holes) at z facing dir (+1 / -1 along Z); mat(cy, cx) -> material (or null). */
function planar(B, ring, z, dir, holes, mat) {
  const clean = (r) => { const o = []; for (const p of r) { const l = o[o.length - 1]; if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-5) o.push(p); } if (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1e-5) o.pop(); return o; };
  const c = clean(ring), hs = holes.map(clean);
  const cv = c.map((p) => new THREE.Vector2(p[0], p[1])), hv = hs.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
  const faces = THREE.ShapeUtils.triangulateShape(cv, hv);
  const all = cv.concat(...hv), n = [0, 0, dir];
  for (const f of faces) {
    const a = all[f[0]], b = all[f[1]], d = all[f[2]];
    const m = typeof mat === 'function' ? mat((a.y + b.y + d.y) / 3, (a.x + b.x + d.x) / 3) : mat;
    if (m) B.tri([a.x, a.y, z], [b.x, b.y, z], [d.x, d.y, z], m, n, n, n);
  }
}
/** Pocket walls behind a hole polygon in a planar panel at z (panel faces dir): walls face the pocket's centre. */
function pocketWalls(B, poly, z, dir, depth, m) {
  let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length;
  const zb = z - dir * depth;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const nn = v2n(cx - (p[0] + q[0]) / 2, cy - (p[1] + q[1]) / 2), n = [nn[0], nn[1], 0];
    B.tri([p[0], p[1], z], [q[0], q[1], z], [q[0], q[1], zb], m, n, n, n);
    B.tri([p[0], p[1], z], [q[0], q[1], zb], [p[0], p[1], zb], m, n, n, n);
  }
  return zb;
}

/** HD wheel in its own frame: hub at the origin, axle along X, outboard face toward side * X. -> { W (spins), C (caliper) } */
function wheelHD(s, side, lo = false) {
  const r = s.wheelR, w = s.wheelW, hw = w / 2, style = s.rim;
  const W = new TexBuilder(), C = new TexBuilder();
  const rimR = r * (style === 'steel' ? 0.585 : 0.62);
  // atlas mapping round the axle: tread blocks, sidewall lettering (twice round), disc machining rings
  W.uv = (p, id) => {
    if (id !== 1 && id !== 2 && id !== 3) return null;
    const ang = Math.atan2(p[2], p[1]) / (Math.PI * 2) + 0.5, rho = Math.hypot(p[1], p[2]);
    if (id === 1) return [ang * 30, p[0] * side / w + 0.5, 30];
    if (id === 2) return [-ang * 2 * side, 1 - clamp((rho - rimR) / (r - rimR), 0, 1), 2];
    return [ang * 6, rho * 12, 6];
  };
  const rimM = style === 'chrome' ? VM.chrome : style === 'steel' ? VM.steelRim : HM.alloy;
  // lathe around X: prof [[rho, a]], ring angles angs, rmod(j, i, rho) -> rho, mat(j, i) -> material
  const lx = (prof, angs, mat, rmod = null) => {
    const np = prof.length, sn = [];
    for (let j = 0; j < np - 1; j++) { const dr = prof[j + 1][0] - prof[j][0], da = prof[j + 1][1] - prof[j][1]; sn.push(v2n(da, -dr)); }
    const pn = prof.map((_, j) => { const A = sn[Math.max(0, j - 1)], Bn = sn[Math.min(sn.length - 1, j)]; return v2n(A[0] + Bn[0], A[1] + Bn[1]); });
    const ring = (i) => {
      const t = angs[i], c = Math.cos(t), sv = Math.sin(t);
      return prof.map((p, j) => { const rho = rmod ? rmod(j, i, p[0]) : p[0]; return [[side * p[1], rho * c, rho * sv], [side * pn[j][1], pn[j][0] * c, pn[j][0] * sv]]; });
    };
    const nA = angs.length, first = ring(0);
    let R0 = first;
    for (let i = 0; i < nA; i++) {
      const R1 = i + 1 < nA ? ring(i + 1) : first;
      for (let j = 0; j < np - 1; j++) {
        const m = typeof mat === 'function' ? mat(j, i) : mat;
        if (!m) continue;
        const [a, na] = R0[j], [b, nb] = R0[j + 1], [cc, nc] = R1[j + 1], [d, nd] = R1[j];
        W.tri(a, b, cc, m, na, nb, nc); W.tri(a, cc, d, m, na, nc, nd);
      }
      R0 = R1;
    }
  };
  const uni = (n, ph = 0) => Array.from({ length: n }, (_, i) => ph + (i / n) * Math.PI * 2);
  // tyre: rounded shoulders, bulging sidewalls, a circumferential groove and a sawtooth lateral tread (30 blocks)
  const rb = rimR + 0.008, r1 = lerp(rimR, r, 0.55);
  const tp = [
    [rb, -hw * 0.84], [rimR + 0.03, -hw * 0.95], [r1, -hw], [r - 0.03, -hw * 0.96], [r - 0.011, -hw * 0.87], [r - 0.002, -hw * 0.74],
    [r, -hw * 0.56], [r, -hw * 0.16], [r - 0.007, -hw * 0.1], [r - 0.007, hw * 0.1], [r, hw * 0.16], [r, hw * 0.56],
    [r - 0.002, hw * 0.74], [r - 0.011, hw * 0.87], [r - 0.03, hw * 0.96], [r1, hw], [rimR + 0.03, hw * 0.95], [rb, hw * 0.84]];
  if (lo) { // mid: the same section in 8 points, 20 sides; tread and lettering from the atlas
    const tl = [[rb, -hw * 0.84], [r1, -hw], [r - 0.012, -hw * 0.88], [r, -hw * 0.55], [r, hw * 0.55], [r - 0.012, hw * 0.88], [r1, hw], [rb, hw * 0.84]];
    lx(tl, uni(20), (j) => (j >= 2 && j <= 4 ? HM.tread : HM.sidewall));
  } else {
    const nb = 30, tAng = [];
    for (let b = 0; b < nb; b++) { const t0 = (b / nb) * Math.PI * 2; tAng.push(t0, t0 + (0.74 / nb) * Math.PI * 2); }
    const treadJ = new Set([6, 7, 10, 11]);
    lx(tp, tAng, (j, i) => (j >= 5 && j <= 11 ? (i % 2 ? HM.groove : HM.tread) : HM.sidewall), (j, i, rho) => (treadJ.has(j) && i % 2 ? rho - 0.0065 : rho));
  }
  // rim: lip, barrel (seen between the spokes), back wall
  const ang40 = uni(lo ? 16 : 40);
  const lip = lo ? [[rimR + 0.012, hw * 0.88], [rimR - 0.004, hw * 0.975], [rimR - 0.016, hw * 0.7], [rimR - 0.016, -hw * 0.6], [rimR * 0.4, -hw * 0.6]]
    : [[rimR + 0.004, hw * 0.84], [rimR + 0.014, hw * 0.9], [rimR + 0.01, hw * 0.97], [rimR - 0.004, hw * 0.975], [rimR - 0.014, hw * 0.92],
      [rimR - 0.016, hw * 0.7], [rimR - 0.016, -hw * 0.8], [rimR * 0.4, -hw * 0.8]];
  lx(lip, ang40, (j) => (j < (lo ? 2 : 4) ? rimM : j < (lo ? 3 : 6) ? HM.barrel : VM.hubBlack));
  // brake disc (spins with the wheel), behind the spokes
  lx(lo ? [[rimR - 0.045, -hw * 0.18], [0.08, -hw * 0.18]] : [[rimR - 0.045, -hw * 0.42], [rimR - 0.045, -hw * 0.18], [0.08, -hw * 0.18], [0.075, hw * 0.2]], uni(lo ? 12 : 28), HM.disc);
  const spokes = (nS, m, faceA, faceB, wRoot, wTip, ph) => {
    const r0 = 0.06, r1s = rimR - 0.012;
    for (let q = 0; q < nS; q++) {
      const t = ph + (q / nS) * Math.PI * 2, u = [0, Math.cos(t), Math.sin(t)], tg = [0, -Math.sin(t), Math.cos(t)], e = [side, 0, 0];
      const P = (rho, a, sv) => [e[0] * a + u[0] * rho + tg[0] * sv, u[1] * rho + tg[1] * sv, u[2] * rho + tg[2] * sv];
      const rows = [], ns = lo ? 2 : 4;
      for (let i = 0; i <= ns; i++) {
        const v = i / ns, rho = lerp(r0, r1s, v), aF = lerp(faceA, faceB, Math.pow(v, 0.8)), aB = aF - 0.032, ww = lerp(wRoot, wTip, v);
        rows.push({ L: P(rho, aF - 0.003, -ww), M: P(rho, aF + 0.002, 0), R: P(rho, aF - 0.003, ww), LB: P(rho, aB, -ww * 1.12), RB: P(rho, aB, ww * 1.12) });
      }
      const ex = [side, 0, 0], nt = [-tg[0], -tg[1], -tg[2]];
      for (let i = 0; i < ns; i++) {
        const A = rows[i], Bn = rows[i + 1];
        const h1 = [ex[0] - tg[0] * 0.25, -tg[1] * 0.25, -tg[2] * 0.25], h2 = [ex[0] + tg[0] * 0.25, tg[1] * 0.25, tg[2] * 0.25], hl = Math.hypot(...h1);
        W.quad(A.L, A.M, Bn.M, Bn.L, m, h1.map((v) => v / hl));
        W.quad(A.M, A.R, Bn.R, Bn.M, m, h2.map((v) => v / hl));
        W.quad(A.L, Bn.L, Bn.LB, A.LB, m, nt);
        W.quad(A.R, A.RB, Bn.RB, Bn.R, m, tg);
      }
    }
  };
  const hubAt = (a0, capM) => {
    const M = new THREE.Matrix4().makeRotationZ(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    // lathe profiles are [r, y] around local Y; rotated so local +Y = outboard
    W.lathe([[0.085, a0 - 0.02], [0.08, a0], [0.036, a0], [0.03, a0 + 0.012], [0.016, a0 + 0.019], [0, a0 + 0.021]], lo ? 10 : 24, (j) => (j < 2 ? rimM : capM), M);
    if (!lo) for (let q = 0; q < 5; q++) { // lug nuts
      const t = (q / 5) * Math.PI * 2 + 0.3, Mq = M.clone().multiply(new THREE.Matrix4().makeTranslation(Math.cos(t) * 0.055, 0, Math.sin(t) * 0.055));
      W.lathe([[0.0095, a0 - 0.002], [0.0095, a0 + 0.011], [0.006, a0 + 0.015], [0, a0 + 0.016]], 6, VM.chrome, Mq);
    }
  };
  if (style === 'steel') {
    // pressed steel wheel: dished face with 8 vent holes, chrome hubcap
    const face = [[rimR - 0.016, hw * 0.7], [rimR * 0.9, hw * 0.66], [rimR * 0.76, hw * 0.5], [rimR * 0.6, hw * 0.47], [rimR * 0.5, hw * 0.52], [0.09, hw * 0.56], [0.085, hw * 0.5]];
    lx(lo ? [face[0], face[2], face[3], face[5], face[6]] : face, lo ? uni(20) : ang40, (j, i) => (j === (lo ? 1 : 2) && i % 5 < 2 ? VM.hubBlack : VM.steelRim));
    const M = new THREE.Matrix4().makeRotationZ(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    W.lathe(lo ? [[0.12, hw * 0.56], [0.1, hw * 0.7], [0.04, hw * 0.78], [0, hw * 0.79]] : [[0.12, hw * 0.56], [0.118, hw * 0.62], [0.1, hw * 0.7], [0.06, hw * 0.76], [0.02, hw * 0.785], [0, hw * 0.79]], lo ? 12 : 32, VM.chrome, M);
  } else {
    const nS = style === 'chrome' ? 6 : 5;
    spokes(nS, rimM, hw * 0.5, hw * 0.88, style === 'chrome' ? 0.018 : 0.026, style === 'chrome' ? 0.013 : 0.017, 0.2);
    if (style === 'chrome' && !lo) spokes(nS, rimM, hw * 0.5, hw * 0.86, 0.012, 0.009, 0.2 + Math.PI / nS);
    hubAt(hw * 0.5, style === 'chrome' ? VM.chrome : HM.alloy);
  }
  // caliper (does not spin): rear-top of the disc
  const ph = 0.95, rc = rimR - 0.062;
  C.box(side * -hw * 0.3, rc * Math.cos(ph), rc * Math.sin(ph), 0.05, 0.07, 0.12, HM.caliper, { pitch: ph });
  return { W, C, rimR };
}

/**
 * HD car: returns PartBuilders { B body, G glass (+ lenses), I interior, wheels {FL..}, calipers {FL..}, pivots }.
 * Same spec as buildCar (sedan / hatchback / suv / pickup / minivan / police / taxi / police_sedan).
 */
function buildCarHD(s, lo = false) {
  const K = carFrame(s), { L, z0, z1, hwMax, F, fr, topF, planF, Z, zF, zR, rA, beltF, anchors } = K;
  const B = new TexBuilder(), G = new TexBuilder(), I = new TexBuilder();
  void L;
  const liv = s.livery === 'bw';
  const rE = 0.04, zA = z0 + rE, zB = z1 - rE;
  const hwAt = (z) => planF(fr(z)) * hwMax;
  const bumpF = fr(zF - rA - 0.015), bumpR = fr(zR + rA + 0.015);
  const seamsF = s.seams.map(F);
  // ---- stations: curvature-spaced + forced (window edges, arches, V-grooves), rolled ends
  const st = (z, o = {}) => ({ z, zq: z, off: 0, zg: null, dup: false, ...o });
  const forced = [], grooves = [];
  // (mid: door lines as 5 mm dark bands between two stations, no V depth; fewer arch / window / frit stations)
  const V = (zc, type, d = 0.003) => {
    if (zc < zA + 0.01 || zc > zB - 0.01) return;
    forced.push(st(zc - 0.0025), ...(lo ? [] : [st(zc, { zg: { type, d } })]), st(zc + 0.0025)); grooves.push({ zc, type });
  };
  for (const zs of seamsF) V(zs, 'door');
  if (!lo) {
    V(F(Z.cowl - 0.006), 'hood');
    if (!s.bed && F(Z.deck + 0.006) < zB - 0.03) V(F(Z.deck + 0.006), 'hood');
    V(zF - rA - 0.015, 'bump'); V(zR + rA + 0.015, 'bump');
  }
  for (const [a, b] of s.side) forced.push(st(F(a)), st(F(b)), ...(lo ? [] : [st(F(a) + 0.015), st(F(b) - 0.015)]));
  for (const k of ['cowl', 'roofF', 'roofR']) forced.push(st(F(Z[k])));
  if (!s.bed) forced.push(st(F(Z.deck)), ...(lo ? [] : [st(F(Z.roofR) + 0.025), st(F(Z.deck) - 0.03)]));
  if (!lo) forced.push(st(F(Z.cowl) + 0.03), st(F(Z.roofF) - 0.025));
  const archT = lo ? [-1.004, -1, -0.88, -0.55, 0, 0.55, 0.88, 1, 1.004] : [-1.004, -1, -0.97, -0.9, -0.78, -0.6, -0.35, 0, 0.35, 0.6, 0.78, 0.9, 0.97, 1, 1.004];
  for (const za of [zF, zR]) for (const t of archT) forced.push(st(za + t * rA));
  if (s.bed) { const zb = F(s.bed); forced.push(st(zb - 0.004), st(zb - 0.004, { dup: true }), st(zb), st(zb, { dup: true }), st(F(Z.roofR))); }
  forced.push(st(zA), st(zB));
  // curvature density of the anchors that the profiles drive (P3..P7), 1 cm samples
  const h = 0.01, Wz = [], Zs = [];
  const ap = (z) => anchors(z).pts;
  for (let z = zA; z <= zB + 1e-9; z += h) {
    const a = ap(z - h), b = ap(z), c = ap(z + h);
    let cv = 0;
    for (let j = 3; j < 8; j++) cv += Math.hypot(a[j][0] - 2 * b[j][0] + c[j][0], a[j][1] - 2 * b[j][1] + c[j][1]) / (h * h);
    Zs.push(z); Wz.push(lo ? Math.min(12, 1.6 + 2.6 * Math.sqrt(cv)) : Math.min(34, 4.5 + 6.5 * Math.sqrt(cv)));
  }
  let tot = 0; const cum = [0];
  for (let i = 1; i < Zs.length; i++) { tot += 0.5 * (Wz[i] + Wz[i - 1]) * (Zs[i] - Zs[i - 1]); cum.push(tot); }
  const nAd = Math.round(tot), adapt = [];
  for (let q = 1; q < nAd; q++) {
    const target = (q / nAd) * tot; let i = 1; while (i < cum.length - 1 && cum[i] < target) i++;
    const t = (target - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    adapt.push(lerp(Zs[i - 1], Zs[i], t));
  }
  const fz = forced.map((f) => f.z);
  let stations = forced.slice();
  for (const z of adapt) if (fz.every((x) => Math.abs(x - z) > (lo ? 0.03 : 0.008))) stations.push(st(z));
  stations.sort((a, b) => a.z - b.z || (a.dup ? 1 : 0) - (b.dup ? 1 : 0));
  const dd = [];
  for (const sv of stations) {
    const l = dd[dd.length - 1];
    if (l && !sv.dup && Math.abs(sv.z - l.z) < 0.0015) { if (sv.zg && !l.zg) dd[dd.length - 1] = sv; continue; }
    dd.push(sv);
  }
  stations = dd.filter((sv) => sv.z >= zA - 1e-9 && sv.z <= zB + 1e-9);
  const fil = (zc, dir) => (lo ? [Math.PI / 2, Math.PI / 4] : [Math.PI / 2, Math.PI / 3, Math.PI / 6]).map((p) => st(zc + dir * rE * Math.sin(p), { zq: zc, off: rE * (1 - Math.cos(p)) }));
  stations = [...fil(zA, -1), ...stations, ...fil(zB, 1).reverse()];
  // ---- layout of the fascia / rear panel (lamps, grille, plate), from the end rings; drives the bumper line too
  const ybs0 = K.botF(0), ybs1 = K.botF(1);
  const lay = { yBtF: ybs0 + 0.36 * (topF(0) - ybs0), yBtR: ybs1 + 0.4 * (topF(1) - ybs1), door0: s.seams[0] + 0.002, door1: s.seams[s.seams.length - 1] - 0.002, bumpF, bumpR, yRsF: 0, yRsR: 0 };
  lay.yRsF = lay.yBtF - 0.05; lay.yRsR = lay.yBtR - 0.05;
  const ringOf = (sc) => { const p = sc.pts, r = p.map((q) => [q[0], q[1]]); for (let j = p.length - 2; j >= 0; j--) r.push([-p[j][0], p[j][1]]); return r; };
  let secF = hdSection(K, s, lay, lo);
  const ringR0 = ringOf(secF(stations[stations.length - 1])), ringF0 = ringOf(secF(stations[0]));
  { // front: a lamp / grille band of ~16 cm under the hood edge, the bumper below it
    const xe = Math.max(...ringF0.map((p) => p[0])), yl = Math.min(...ringF0.map((p) => p[1])), hx1 = xe - 0.035, hx0 = hx1 - clamp(0.42 * xe, 0.24, 0.4);
    const top = Math.min(ringYAt(ringF0, hx1), ringYAt(ringF0, hx0)) - 0.026;
    lay.yBtF = clamp(top - 0.16 - 0.016, yl + 0.1, top - 0.08); lay.yRsF = lay.yBtF - 0.055;
  }
  const xeR = Math.max(...ringR0.map((p) => p[0])), yloR = Math.min(...ringR0.map((p) => p[1]));
  const R = {}; // rear layout
  if (s.bed) {
    const ymE = anchors(z1).ym;
    R.lx = [xeR - 0.1, xeR - 0.018]; R.ly = [ymE - 0.4, ymE - 0.07]; R.plateY = ybs1 + 0.2; R.bed = true;
    lay.yBtR = ybs1 + 0.1; lay.yRsR = lay.yBtR - 0.05;
  } else {
    const wT = clamp(0.5 * xeR, 0.3, 0.46), lx1 = xeR - 0.035, lx0 = lx1 - wT;
    const y1 = Math.min(ringYAt(ringR0, lx1), ringYAt(ringR0, lx0)) - 0.03, hT = clamp(0.38 * (y1 - yloR), 0.1, 0.17), y0 = y1 - hT;
    const pc = (y0 + y1) / 2 - 0.025;
    R.lx = [lx0, lx1]; R.ly = [y0, y1]; R.plateY = pc; R.rec = [pc - 0.09, pc + 0.09];
    lay.yBtR = Math.min(pc - 0.09, y0) - 0.025; lay.yRsR = lay.yBtR - 0.05;
  }
  secF = hdSection(K, s, lay, lo);
  const secs = stations.map(secF);
  // ---- grid + normals (area weighted; duplicated points = creases, blended back below ~3 deg)
  const nP = secs[0].pts.length, NR = 2 * nP - 1, S = stations.length, LB = secs[0].L, idx = secs[0].idx;
  for (const sc of secs) if (sc.pts.length !== nP) throw new Error('HD section topology changed');
  const GR = secs.map((sc, i) => { const z = stations[i].z, r = new Array(NR); for (let j = 0; j < nP; j++) { r[j] = [sc.pts[j][0], sc.pts[j][1], z]; if (j < nP - 1) r[NR - 1 - j] = [-sc.pts[j][0], sc.pts[j][1], z]; } return r; });
  const NN = GR.map((r) => r.map(() => [0, 0, 0]));
  const fnorm = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
  const acc = (i, k, f) => { const a = NN[i][k]; a[0] += f[0]; a[1] += f[1]; a[2] += f[2]; };
  const area = new Float64Array((S - 1) * (NR - 1));
  for (let i = 0; i < S - 1; i++) for (let k = 0; k < NR - 1; k++) {
    const a = GR[i][k], b = GR[i][k + 1], c = GR[i + 1][k + 1], d = GR[i + 1][k];
    const f1 = fnorm(a, b, c), f2 = fnorm(a, c, d);
    area[i * (NR - 1) + k] = Math.hypot(...f1) + Math.hypot(...f2);
    acc(i, k, f1); acc(i, k + 1, f1); acc(i + 1, k + 1, f1); acc(i, k, f2); acc(i + 1, k + 1, f2); acc(i + 1, k, f2);
  }
  for (let i = 0; i < S; i++) for (let k = 0; k < NR; k++) {
    const v = NN[i][k], l = Math.hypot(v[0], v[1], v[2]);
    if (l > 1e-12) { v[0] /= l; v[1] /= l; v[2] /= l; } else v[0] = NaN;
  }
  for (let i = 0; i < S; i++) for (let k = 0; k < NR; k++) if (Number.isNaN(NN[i][k][0])) { // no face: borrow a neighbour
    const o = NN[i > 0 ? i - 1 : i + 1][k]; NN[i][k] = Number.isNaN(o[0]) ? [0, 1, 0] : o.slice();
  }
  const dups = []; for (let j = 0; j < nP - 1; j++) if (LB[j] === 'dup') dups.push(j);
  const c3 = Math.cos(3 * Math.PI / 180), c9 = Math.cos(9 * Math.PI / 180);
  for (let i = 0; i < S; i++) for (const j of dups) for (const [ka, kb] of [[j, j + 1], [NR - 1 - j, NR - 2 - j]]) {
    const na = NN[i][ka], nb = NN[i][kb], d = na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2];
    const t = sstep(c3, c9, d) * (j === idx.P2 ? 1 - secs[i].soft : 1); // 0 = blend fully, 1 = keep hard
    if (t >= 1) continue;
    const avg = [na[0] + nb[0], na[1] + nb[1], na[2] + nb[2]];
    const al = Math.hypot(...avg) || 1;
    for (const v of [na, nb]) { const x = lerp(avg[0] / al, v[0], t), y = lerp(avg[1] / al, v[1], t), z = lerp(avg[2] / al, v[2], t), l = Math.hypot(x, y, z) || 1; v[0] = x / l; v[1] = y / l; v[2] = z / l; }
  }
  // ---- classification
  const inSide = (f) => { for (const [a, b] of s.side) if (f >= a && f <= b) return 1; if (f > s.side[0][0] && f < s.side[s.side.length - 1][1]) return 2; return 0; };
  const nearWinEdge = (z) => { for (const [a, b] of s.side) if (z >= F(a) - 1e-6 && z <= F(b) + 1e-6) return z - F(a) < 0.0151 || F(b) - z < 0.0151; return false; };
  const paintAt = (lab, f, region) => {
    if (!liv) return VM.paint;
    const low = ['U', 'A', 'B1', 'DB', 'B1b', 'RS', 'B2a', 'BT', 'B2b', 'B2c', 'C', 'D1', 'HG', 'D2', 'Ds'].includes(lab);
    return (low && f > s.seams[0] && f < s.seams[2]) || ((lab === 'F' || lab === 'G' || lab === 'Gf' || lab === 'Fs') && region === 'roof') ? VM.white : VM.black;
  };
  const doorL = new Set(['DB', 'B1b', 'RS', 'B2a', 'BT', 'B2b', 'B2c', 'C', 'D1', 'HG', 'D2', 'Ds']);
  const hoodL = new Set(['HG', 'D2', 'Ds', 'E', 'Fs', 'F', 'Gf', 'G']);
  const bumpL = new Set(['A', 'B1', 'DB', 'B1b', 'RS', 'B2a', 'BT']);
  const cladL = new Set(['U', 'A', 'B1', 'DB', 'B1b']);
  const zCab0 = F(Z.cowl) + 0.01, zCab1 = s.bed ? F(s.bed) - 0.012 : F(Z.deck) - 0.004;
  const classify = (lab, i) => {
    const a = secs[i], b = secs[i + 1], z = (stations[i].z + stations[i + 1].z) / 2, f = fr(z), kmin = Math.min(a.k, b.k);
    const region = f < Z.cowl ? 'nose' : f < Z.roofF ? 'ws' : f < Z.roofR ? 'roof' : f < Z.deck ? 'rw' : 'tail';
    const paint = paintAt(lab, f, region);
    if (a.bed !== b.bed) return lab === 'U' ? VM.under : paint; // pickup cab back / bed front wall
    if (a.bed) return lab === 'U' ? VM.under : ['E', 'Fs', 'F', 'Gf', 'G'].includes(lab) ? VM.liner : cladL.has(lab) && s.cladding ? VM.trim : paint;
    for (const gv of grooves) if (Math.abs(z - gv.zc) < 0.0026) {
      const set = gv.type === 'door' ? doorL : gv.type === 'hood' ? hoodL : bumpL;
      if (set.has(lab) && (gv.type !== 'hood' || (a.hood && b.hood))) return HM.seam;
    }
    const bumper = f < bumpF || f > bumpR;
    switch (lab) {
      case 'U': return VM.under;
      case 'A': case 'B1': return s.cladding ? VM.trim : bumper ? VM.trim : paint;
      case 'DB': return a.door && b.door ? HM.seam : s.cladding ? VM.trim : paint;
      case 'B1b': return s.cladding ? VM.trim : paint;
      case 'RS': return Math.min(a.rsOn, b.rsOn) > 0.5 ? VM.trim : paint;
      case 'BT': return a.bump && b.bump ? HM.seam : paint;
      case 'HG': return a.hood && b.hood ? HM.seam : paint;
      case 'Ds': if (kmin > 0.5 && region !== 'nose' && region !== 'tail') { const g = inSide(f); if (g === 1) return HM.rubber; } return paint;
      case 'E':
        if (kmin > 0.15 && region !== 'nose' && region !== 'tail') { const g = inSide(f); if (g === 1) return nearWinEdge(z) ? HM.rubber : HM.glass; if (g === 2) return VM.trimGloss; }
        return paint;
      case 'Fs': if (kmin > 0.5 && region !== 'nose' && region !== 'tail' && inSide(f)) return HM.rubber; return paint;
      case 'Gf': return (region === 'ws' || region === 'rw') && kmin > 0.03 ? HM.frit : paint;
      case 'G':
        if ((region === 'ws' || region === 'rw') && kmin > 0.03) {
          const e = region === 'ws' ? z < F(Z.cowl) + 0.03 || z > F(Z.roofF) - 0.025 : z < F(Z.roofR) + 0.025 || z > F(Z.deck) - 0.03;
          return e ? HM.frit : HM.glass;
        }
        return paint;
      default: return paint;
    }
  };
  // ---- emit: body / glass (inset, rubber reveals) / interior shell (door cards, headliner)
  const INS = 0.006, cls = [];
  for (let i = 0; i < S - 1; i++) {
    const row = [];
    for (let k = 0; k < NR - 1; k++) row.push(area[i * (NR - 1) + k] < 1e-12 ? null : classify(LB[k < nP - 1 ? k : NR - 2 - k], i));
    cls.push(row);
  }
  const glassAt = (i, k, di, dk) => { // the first non-degenerate quad from (i, k) stepping (di, dk)
    for (let q = 1; q < 4; q++) {
      const ii = i + di * q, kk = k + dk * q;
      if (ii < 0 || ii >= S - 1 || kk < 0 || kk >= NR - 1) return false;
      const m = cls[ii][kk]; if (m) return !!m.glassy;
    }
    return false;
  };
  const sub3 = (p, n, d) => [p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d];
  for (let i = 0; i < S - 1; i++) {
    for (let k = 0; k < NR - 1; k++) {
      const m = cls[i][k]; if (!m) continue;
      const a = GR[i][k], b = GR[i][k + 1], c = GR[i + 1][k + 1], d = GR[i + 1][k];
      const na = NN[i][k], nb = NN[i][k + 1], nc = NN[i + 1][k + 1], nd = NN[i + 1][k];
      if (m.glassy && lo) { B.tri(a, b, c, HM.glassMid, na, nb, nc); B.tri(a, c, d, HM.glassMid, na, nc, nd); continue; }
      if (m.glassy) {
        G.tri(sub3(a, na, INS), sub3(b, nb, INS), sub3(c, nc, INS), m, na, nb, nc);
        G.tri(sub3(a, na, INS), sub3(c, nc, INS), sub3(d, nd, INS), m, na, nc, nd);
        const ctr = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4];
        for (const [p, q, np, nq, di, dk] of [[a, d, na, nd, 0, -1], [b, c, nb, nc, 0, 1], [a, b, na, nb, -1, 0], [d, c, nd, nc, 1, 0]]) {
          if (glassAt(i, k, di, dk)) continue;
          const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], nm = [np[0] + nq[0], np[1] + nq[1], np[2] + nq[2]];
          const hn = [ctr[0] - mid[0] + nm[0] * 0.002, ctr[1] - mid[1] + nm[1] * 0.002, ctr[2] - mid[2] + nm[2] * 0.002], hl = Math.hypot(...hn) || 1;
          const n = [hn[0] / hl, hn[1] / hl, hn[2] / hl];
          B.tri(p, q, sub3(q, nq, INS), HM.rubber, n, n, n); B.tri(p, sub3(q, nq, INS), sub3(p, np, INS), HM.rubber, n, n, n);
        }
        continue;
      }
      B.tri(a, b, c, m, na, nb, nc); B.tri(a, c, d, m, na, nc, nd);
    }
  }
  if (!lo) { // interior shell (door cards below the glass, pillars, headliner): a coarse inward copy of the cabin, facing in
    const pick = [idx.DBc, idx.P2, idx.P4, idx.P5, idx.P5 + 4, idx.P5 + 6, nP - 1], T = 0.035;
    const zl = [zCab0];
    for (const [a, b] of s.side) zl.push(F(a), F(b));
    for (let q = 1; q < 14; q++) zl.push(lerp(zCab0, zCab1, q / 14));
    zl.push(zCab1);
    const zs = [...new Set(zl.filter((z) => z >= zCab0 && z <= zCab1).map((z) => Math.round(z * 1e4) / 1e4))].sort((a, b) => a - b);
    const rings = zs.map((z) => {
      const sc = secF(st(z)), p = pick.map((j) => sc.pts[j]), r = [];
      for (let j = 0; j < p.length; j++) {
        const pa = p[Math.max(0, j - 1)], pb = p[Math.min(p.length - 1, j + 1)], n = j === p.length - 1 ? [0, 1] : v2n(pb[1] - pa[1], -(pb[0] - pa[0]));
        r.push([p[j][0] - n[0] * T, p[j][1] - n[1] * T, -n[0], -n[1]]);
      }
      return { z, r, k: sc.k };
    });
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], Bz = rings[i + 1], f = fr((A.z + Bz.z) / 2), kmin = Math.min(A.k, Bz.k);
      const region = f < Z.roofF ? 'ws' : f < Z.roofR ? 'roof' : 'rw';
      for (let j = 0; j < pick.length - 1; j++) {
        let m = j < 2 ? HM.card : HM.headliner;
        if (j === 2 && inSide(f) === 1) m = null; // side glass
        if (j >= 3 && region !== 'roof' && kmin > 0.03) m = j === 3 ? HM.headliner : null; // windscreen / rear window
        if (!m) continue;
        for (const sd of [-1, 1]) {
          const P = (R, q) => [sd * R[q][0], R[q][1], 0], N = (R, q) => [sd * R[q][2], R[q][3], 0];
          const a = [...P(A.r, j)], b = [...P(A.r, j + 1)], c = [...P(Bz.r, j + 1)], d = [...P(Bz.r, j)];
          a[2] = b[2] = A.z; c[2] = d[2] = Bz.z;
          I.tri(a, b, c, m, N(A.r, j), N(A.r, j + 1), N(Bz.r, j + 1)); I.tri(a, c, d, m, N(A.r, j), N(Bz.r, j + 1), N(Bz.r, j));
        }
      }
    }
  }
  // ---- end panels with pockets: rear (tail lamps, plate recess), front (headlamps, grille)
  const ringF = GR[0].map((p) => [p[0], p[1]]), ringR = GR[S - 1].map((p) => [p[0], p[1]]);
  const zf = GR[0][0][2], zr = GR[S - 1][0][2];
  const xeF = Math.max(...ringF.map((p) => p[0])), yloF = Math.min(...ringF.map((p) => p[1]));
  const bumperM = s.cladding ? VM.trim : null;
  const panelMat = (yBt, ylo) => (y) => (y < ylo + 0.035 ? VM.trim : y < yBt ? (bumperM || (liv ? VM.black : VM.paint)) : liv ? VM.black : VM.paint);
  const mirrorX = (poly) => poly.map((p) => [-p[0], p[1]]).reverse();
  // rear
  const holesR = [];
  let tailL = null;
  if (R.bed) {
    tailL = rrect(R.lx[0], R.ly[0], R.lx[1], R.ly[1], 0.012);
    holesR.push(tailL, mirrorX(tailL));
  } else {
    tailL = rrect(R.lx[0], R.ly[0], R.lx[1], R.ly[1], 0.014);
    holesR.push(tailL, mirrorX(tailL), rrect(-0.175, R.rec[0], 0.175, R.rec[1], 0.01));
  }
  planar(B, ringR, zr, 1, holesR, panelMat(lay.yBtR, yloR));
  // per-vertex materials on one triangle: lamp cells glow hottest in their middle and fall off to their edges
  const tri3 = (Bq, a, b, c, ma, mb, mc, n) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const f = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (Math.hypot(f[0], f[1], f[2]) < 1e-10) return;
    if (f[0] * n[0] + f[1] * n[1] + f[2] * n[2] < 0) { [b, c] = [c, b]; [mb, mc] = [mc, mb]; }
    Bq._ax = 2; Bq._uvq = null; Bq._v(a, n, ma); Bq._v(b, n, mb); Bq._v(c, n, mc);
  };
  const quad4 = (Bq, p, mm, n) => { tri3(Bq, p[0], p[1], p[2], mm[0], mm[1], mm[2], n); tri3(Bq, p[0], p[2], p[3], mm[0], mm[2], mm[3], n); };
  const tailUnit = (x0, x1, y0, y1, sd) => {
    const poly = rrect(x0, y0, x1, y1, 0.014), dep = lo ? 0.025 : 0.05, rib = lo ? 0.007 : 0.012;
    const zb = pocketWalls(B, sd > 0 ? poly : mirrorX(poly), zr, 1, dep, HM.tailWall);
    { // black bezel round the lens
      const cx = sd * (x0 + x1) / 2, w2 = x1 - x0, t = 0.009, zz = zr + 0.0025;
      B.box(cx, y1 + t / 2, zz, w2 + 2 * t, t, 0.005, VM.trimGloss); B.box(cx, y0 - t / 2, zz, w2 + 2 * t, t, 0.005, VM.trimGloss);
      for (const xx of [x0 - t / 2, x1 + t / 2]) B.box(sd * xx, (y0 + y1) / 2, zz, t, y1 - y0, 0.005, VM.trimGloss);
    }
    const xin = sd > 0 ? x0 : -x0, xout = sd > 0 ? x1 : -x1, w = x1 - x0;
    const xr = R.bed ? null : xin + sd * w * 0.26; // inner quarter: reverse lamp
    const xa = Math.min(xr ?? xin, xout), xb = Math.max(xr ?? xin, xout);
    const nr = lo ? 3 : Math.max(3, Math.round((y1 - y0) / 0.024)), hr = (y1 - y0) / nr, nc = Math.max(2, Math.round((xb - xa) / 0.075));
    const dn = [0, -0.6, 0.8], up = [0, 0.6, 0.8], D = HM.tailDim, Wm = HM.tailCell, Hm = HM.tailHot;
    for (let q = 0; q < nr; q++) for (let c = 0; c < nc; c++) { // ribbed cells: ridge hot at the cell centre, valleys dim
      const ya = y0 + q * hr, ym2 = ya + hr * 0.55, yb2 = ya + hr, zt = zb + rib;
      const xl = lerp(xa, xb, c / nc), xm = lerp(xa, xb, (c + 0.5) / nc), xh = lerp(xa, xb, (c + 1) / nc);
      for (const [u0, u1, m0, m1] of [[xl, xm, Wm, Hm], [xm, xh, Hm, Wm]]) {
        quad4(B, [[u0, ya, zb], [u1, ya, zb], [u1, ym2, zt], [u0, ym2, zt]], [D, D, m1, m0], dn);
        quad4(B, [[u0, ym2, zt], [u1, ym2, zt], [u1, yb2, zb], [u0, yb2, zb]], [m0, m1, D, D], up);
      }
    }
    if (!lo) for (let q = 1; q < nc; q++) { const x = lerp(xa, xb, q / nc); for (const sx of [-1, 1]) B.quad([x, y0, zb], [x, y1, zb], [x, y1, zr - 0.005], [x, y0, zr - 0.005], HM.tailRib, [sx, 0, 0]); }
    if (xr != null) {
      B.quad([Math.min(xin, xr), y0, zb + 0.001], [Math.max(xin, xr), y0, zb + 0.001], [Math.max(xin, xr), y1, zb + 0.001], [Math.min(xin, xr), y1, zb + 0.001], HM.reverse, [0, 0, 1]);
      for (const sx of [-1, 1]) B.quad([xr, y0, zb], [xr, y1, zb], [xr, y1, zr - 0.003], [xr, y0, zr - 0.003], HM.housing, [sx, 0, 0]);
    }
    // lens: red (and clear over the reverse lamp), flush with the panel, faintly lit itself (HD only: mid shows the cells)
    if (!lo) planar(G, sd > 0 ? poly : mirrorX(poly), zr + 0.0015, 1, [], (cy, cx) => (xr != null && (sd > 0 ? cx < xr : cx > xr) ? HM.lensClear : HM.lensTail));
  };
  tailUnit(R.lx[0], R.lx[1], R.ly[0], R.ly[1], 1); tailUnit(R.lx[0], R.lx[1], R.ly[0], R.ly[1], -1);
  if (!R.bed) { // plate recess + plate
    const rec = rrect(-0.175, R.rec[0], 0.175, R.rec[1], 0.01), zb = pocketWalls(B, rec, zr, 1, 0.016, liv ? VM.black : VM.paint);
    planar(B, rec, zb, 1, [], VM.under);
    plate(B, 0, R.plateY, zb + 0.004, 1);
  } else plate(B, 0, R.plateY, zr + 0.012, 1);
  // bumpers with depth: a bar rounded along its length (profile in Y-Z), proud of the panel, rubbing strip on its face
  const bumpM = s.cladding ? VM.trim : liv ? VM.black : VM.paint;
  const bar = (x0, x1, y0, y1, za, zb, r, m) => {
    const T = new PartBuilder();
    roundedBox(T, za, zb, y0, y1, x0, x1, r, m, { seg: lo ? 2 : 4 }); // built with X and Z swapped ...
    B.geo(T.build(), m, new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)); // ... and swapped back
  };
  if (!R.bed) {
    bar(-xeR - 0.012, xeR + 0.012, yloR - 0.02, lay.yBtR - 0.006, zr - 0.05, zr + 0.045, 0.035, bumpM);
    B.box(0, lay.yRsR, zr + 0.049, 2 * (xeR - 0.03), 0.035, 0.008, VM.trim);
    { // the tail lamps' light spilling on the bumper top: a faint glow strongest under each lamp's middle
      const yT = lay.yBtR - 0.006 + 0.0012, sp = (k) => ({ ...bumpM, lamp: k }), mC = sp(2.4), mE = sp(2.49);
      for (const sd of [-1, 1]) {
        const xa = sd * R.lx[0], xb = sd * R.lx[1], xm = (xa + xb) / 2;
        for (const [u0, u1, m0, m1] of [[xa, xm, mE, mC], [xm, xb, mC, mE]]) quad4(B, [[u0, yT, zr - 0.03], [u1, yT, zr - 0.03], [u1, yT, zr + 0.009], [u0, yT, zr + 0.009]], [m0, m1, mE, mE], [0, 1, 0]);
      }
    }
    for (const sd of [-1, 1]) B.box(sd * (xeR - 0.13), lay.yRsR, zr + 0.0535, 0.1, 0.022, 0.002, HM.reflRed);
  }
  // front
  const yBtF = lay.yBtF, wL = clamp(0.42 * xeF, 0.24, 0.4), hx1 = xeF - 0.035, hx0 = hx1 - wL;
  let hy1 = Math.min(ringYAt(ringF, hx1), ringYAt(ringF, hx0)) - 0.026, hy0 = yBtF + 0.016;
  if (hy1 - hy0 < 0.07) hy0 = hy1 - 0.07;
  const headL = rrect(hx0, hy0, hx1, hy1, 0.012), gx = hx0 - 0.03, grille = rrect(-gx, hy0 + 0.006, gx, hy1 - 0.004, 0.012);
  planar(B, ringF, zf, -1, [mirrorX(headL), headL, grille], panelMat(yBtF, yloF));
  void tailL;
  for (const sd of [-1, 1]) {
    const poly = sd > 0 ? headL : mirrorX(headL);
    const zb = pocketWalls(B, poly, zf, -1, lo ? 0.035 : 0.07, HM.housing), xs = (v) => sd * v;
    const xa = hx1 - wL * 0.2; // outer fifth: amber indicator
    B.quad([xs(hx0), hy0, zb], [xs(xa), hy0, zb], [xs(xa), hy1, zb], [xs(hx0), hy1, zb], HM.headRefl, [0, 0, -1]);
    B.quad([xs(xa), hy0, zb], [xs(hx1), hy0, zb], [xs(hx1), hy1, zb], [xs(xa), hy1, zb], HM.amberCell, [0, 0, -1]);
    for (const sx of [-1, 1]) B.quad([xs(xa), hy0, zb], [xs(xa), hy1, zb], [xs(xa), hy1, zf + 0.004], [xs(xa), hy0, zf + 0.004], HM.housing, [sx, 0, 0]);
    const Rb = Math.min(0.46 * (hy1 - hy0), (xa - hx0) * 0.24), yc = (hy0 + hy1) / 2, bd = lo ? 0.02 : 0.045;
    for (const t of [0.27, 0.72]) { // reflector bowls (open toward the lens, softly lit) round a hot bulb core
      const M = new THREE.Matrix4().makeTranslation(xs(lerp(hx0, xa, t)), yc, zb).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      B.lathe(lo ? [[Rb, bd], [Rb * 0.5, bd * 0.3], [0, 0]] : [[Rb, 0.045], [Rb * 0.75, 0.024], [Rb * 0.4, 0.008], [0, 0]], lo ? 8 : 16, HM.bowl, M);
      B.lathe(lo ? [[0, 0.016], [0.011, 0.012], [0, 0.008]].reverse() : [[0, 0.034], [0.009, 0.028], [0.011, 0.02], [0.008, 0.012], [0, 0.01]].reverse(), lo ? 6 : 8, HM.headCore, M);
    }
    if (!lo) planar(G, poly, zf - 0.0015, -1, [], (cy, cx) => (Math.abs(cx) > xa ? HM.lensAmber : HM.lensHead));
  }
  { // grille: pocket, chrome surround, horizontal slats, centre bar
    const zb = pocketWalls(B, grille, zf, -1, 0.05, HM.housing);
    planar(B, grille, zb, -1, [], HM.housing);
    const gy0 = hy0 + 0.006, gy1 = hy1 - 0.004, ns = lo ? 4 : Math.max(3, Math.round((gy1 - gy0) / 0.02));
    for (let q = 1; q < ns; q++) B.box(0, lerp(gy0, gy1, q / ns), zf + 0.014, 2 * gx - 0.01, 0.006, 0.026, VM.grille);
    B.box(0, (gy0 + gy1) / 2, zf + 0.012, 0.012, gy1 - gy0 - 0.004, 0.024, VM.grille);
    B.box(0, gy1 + 0.003, zf - 0.003, 2 * gx + 0.01, 0.007, 0.008, VM.chrome);
    B.box(0, gy0 - 0.003, zf - 0.003, 2 * gx + 0.01, 0.006, 0.008, VM.chrome);
    for (const sd of [-1, 1]) B.box(sd * (gx + 0.002), (gy0 + gy1) / 2, zf - 0.003, 0.007, gy1 - gy0 + 0.012, 0.008, VM.chrome);
  }
  bar(-xeF - 0.012, xeF + 0.012, yloF - 0.025, yBtF - 0.006, zf - 0.05, zf + 0.05, 0.035, bumpM);
  B.box(0, yloF - 0.032, zf - 0.02, 2 * (xeF - 0.1), 0.026, 0.07, VM.trim); // air dam lip
  B.box(0, lay.yRsF, zf - 0.054, 2 * (xeF - 0.03), 0.035, 0.008, VM.trim);
  const fpY = yBtF - 0.03;
  B.box(0, fpY, zf - 0.054, 0.33, 0.17, 0.008, VM.trim);
  plate(B, 0, fpY, zf - 0.06, -1);
  // side markers (front amber / rear red) on the bumper corners
  for (const [zc, m, d] of [[zA + 0.09, HM.amberCell, -1], [zB - 0.09, HM.tailCell, 1]]) {
    const y = (d < 0 ? yBtF : lay.yBtR) - 0.045, sc = secF(st(zc)), sc2 = secF(st(zc + 0.02)), p = sideAt(sc, y), p2 = sideAt(sc2, y);
    const yaw = Math.atan2(p2.x - p.x, 0.02);
    for (const sd of [-1, 1]) B.box(sd * (p.x + 0.002), y, zc, 0.006, 0.026, 0.07, m, { yaw: sd * yaw });
  }
  // ---- side details: mirrors, door handles, fuel flap, wipers, antenna
  const atZ = (z) => secF(st(z));
  {
    const fm = Z.cowl + 0.035, zm = F(fm), sc = atZ(zm), ym = beltF(fm) + 0.07, xm = sc.pts[idx.P4][0];
    for (const sd of [-1, 1]) {
      // housing: a rounded box, the mirror glass set into its back face; a foot on the door
      // (black textured plastic like most cars of the period; smaller than before: 16 x 10 cm)
      const xa = xm + 0.06, xb = xm + 0.215, y0 = ym - 0.02, y1 = ym + 0.08, za = zm + 0.03, zb2 = zm + 0.11;
      roundedBox(B, sd > 0 ? xa : -xb, sd > 0 ? xb : -xa, y0, y1, za, zb2, 0.03, VM.trimGloss, { seg: lo ? 2 : 4 });
      B.quad([sd * (xa + 0.012), y0 + 0.012, zb2 + 0.001], [sd * (xb - 0.012), y0 + 0.012, zb2 + 0.001], [sd * (xb - 0.012), y1 - 0.012, zb2 + 0.001], [sd * (xa + 0.012), y1 - 0.012, zb2 + 0.001], HM.mirror, [0, 0, 1]);
      B.box(sd * (xm + 0.035), ym - 0.005, zm + 0.075, 0.07, 0.03, 0.05, VM.trim, { yaw: sd * 0.12 });
      if (!lo) { // the sail: a black triangle filling the window corner the mirror sits on
        const x = sd * (xm + 0.004), yb = ym - 0.04, zq = zm + 0.005;
        B.tri([x, yb, zq], [x, yb, zq + 0.14], [x, yb + 0.12, zq + 0.02], VM.trimGloss, [sd, 0, 0], [sd, 0, 0], [sd, 0, 0]);
      }
    }
  }
  if (!lo) for (const fs of [s.seams[1], s.seams[2]]) { // pull handles just under the character line, forward of each door's rear edge
    const z = F(fs) - 0.1, sc = atZ(z), y = sc.pts[idx.P2][1] - 0.035, p = sideAt(sc, y);
    for (const sd of [-1, 1]) {
      B.box(sd * (p.x + 0.0005), y, z, 0.002, 0.04, 0.12, HM.seam);
      B.box(sd * (p.x + 0.007), y, z, 0.012, 0.026, 0.15, liv ? VM.black : VM.trimGloss);
    }
  }
  if (!lo) { // fuel flap outline (right rear quarter)
    const zc = zR + 0.12, sc = atZ(zc), y = sc.pts[idx.P2][1] - 0.075, x = sideAt(sc, y).x + 0.0008, hw2 = 0.085, hh = 0.055, t = 0.002;
    for (const [a, b] of [[[zc - hw2, y - hh], [zc + hw2, y - hh]], [[zc - hw2, y + hh], [zc + hw2, y + hh]]]) B.quad([x, a[1] - t, a[0]], [x, a[1] - t, b[0]], [x, a[1] + t, b[0]], [x, a[1] + t, a[0]], HM.seam, [1, 0, 0]);
    for (const zz of [zc - hw2, zc + hw2]) B.quad([x, y - hh, zz - t], [x, y + hh, zz - t], [x, y + hh, zz + t], [x, y - hh, zz + t], HM.seam, [1, 0, 0]);
  }
  if (!lo) { // wipers resting on the windscreen base
    const zw = F(Z.cowl) + 0.045, yw = topF(fr(zw)) + 0.035;
    for (const [x, len] of [[-0.3, 0.56], [0.2, 0.5]]) {
      B.box(x, yw, zw, len, 0.01, 0.018, VM.trim, { yaw: 0.06 });
      B.box(x - 0.02, yw + 0.008, zw + 0.012, len * 0.85, 0.008, 0.012, VM.trim, { yaw: 0.06 });
    }
  }
  if (!lo) { // whip antenna at the rear of the roof
    const fa = s.bed ? Z.roofR - 0.03 : Z.roofR - 0.06, za = F(fa), ya = topF(fa) + 0.015;
    B.box(0, ya + 0.008, za, 0.03, 0.016, 0.05, VM.trim);
    B.tube([[0, ya + 0.01, za], [0, ya + 0.33, za + 0.08], [0, ya + 0.62, za + 0.16]], [0.0035, 0.0025, 0.0018], 5, VM.trimGloss);
  }
  // ---- roof equipment
  const roofY = (f) => topF(f) + 0.02;
  if (s.roofRails) {
    const a = Z.roofF + 0.04, b = Z.roofR - 0.02, fm = (a + b) / 2, hwT = planF(fm) * hwMax * s.roofW * 0.86;
    for (const sd of [-1, 1]) {
      const pts = []; for (let q = 0; q <= 8; q++) { const f = lerp(a, b, q / 8); pts.push([sd * hwT, roofY(f) + 0.05, F(f)]); }
      B.tube(pts, 0.014, 8, VM.trimGloss, { caps: true });
      for (const f of [a + 0.01, fm, b - 0.01]) B.box(sd * hwT, roofY(f) + 0.02, F(f), 0.03, 0.05, 0.05, VM.trim);
    }
  }
  if (s.lightbar) {
    const fm = (Z.roofF + Z.roofR) / 2 - 0.04, y = roofY(fm), zc = F(fm);
    roundedBox(B, -0.6, 0.6, y + 0.005, y + 0.055, zc - 0.14, zc + 0.14, 0.02, VM.trim);
    roundedBox(B, -0.58, -0.02, y + 0.055, y + 0.125, zc - 0.12, zc + 0.12, 0.025, VM.lbRed);
    roundedBox(B, 0.02, 0.58, y + 0.055, y + 0.125, zc - 0.12, zc + 0.12, 0.025, VM.lbBlue);
  }
  if (s.taxiSign) {
    const fm = (Z.roofF + Z.roofR) / 2, y = roofY(fm), zc = F(fm);
    // a dimly lit shell with lit faces: TAXI from the atlas, front and back
    roundedBox(B, -0.25, 0.25, y, y + 0.04, zc - 0.1, zc + 0.1, 0.012, VM.trim);
    roundedBox(B, -0.31, 0.31, y + 0.04, y + 0.24, zc - 0.1, zc + 0.1, 0.03, HM.signShell, { seg: lo ? 2 : 3 });
    for (const dz of [-1, 1]) {
      const yf = y + 0.055, zz = zc + dz * 0.1012;
      B.uv = (p, id) => (id === 9 ? [dz < 0 ? (0.285 - p[0]) / 0.57 : (p[0] + 0.285) / 0.57, (p[1] - yf) / 0.17, 0] : null);
      B.quad([-0.285, yf, zz], [0.285, yf, zz], [0.285, yf + 0.17, zz], [-0.285, yf + 0.17, zz], HM.signFace, [0, 0, dz]);
      B.uv = null;
    }
  }
  if (s.pushBar) {
    const y0 = yloF, y1 = hy1;
    for (const sd of [-1, 1]) B.tube([[sd * 0.32, y0 + 0.02, zf + 0.02], [sd * 0.32, y0 + 0.02, zf - 0.11], [sd * 0.32, y1 + 0.02, zf - 0.11], [sd * 0.32, y1 + 0.02, zf + 0.02]], 0.022, 8, VM.trim);
    B.box(0, lerp(y0, y1, 0.45), zf - 0.12, 0.62, 0.3, 0.035, VM.trim);
  }
  if (s.bed) { // tailgate (to the rail height) with its inner face, step bumper
    const ymE = anchors(z1).ym, xi = anchors(z1).hw * 0.875;
    B.box(0, (ymE - 0.44 + ymE - 0.02) / 2, zr - 0.025, 2 * xi, 0.42, 0.05, liv ? VM.black : VM.paint);
    B.box(0, ybs1 + 0.06, zr + 0.06, 2 * (xeR - 0.04), 0.13, 0.12, VM.chrome);
  }
  // ---- arch liners (never see through the arches), underbody, exhaust
  for (const za of [zF, zR]) for (const sd of [-1, 1]) {
    const xi = s.track / 2 - s.wheelW / 2 - 0.035, xo = hwAt(za) * 0.875, Rr = rA + 0.006, tm = 1.45, nseg = lo ? 8 : 16, arc = [];
    for (let q = 0; q <= nseg; q++) { const t = -tm + (2 * tm * q) / nseg; arc.push([za + Rr * Math.sin(t), s.wheelR + Rr * Math.cos(t), t]); }
    for (let q = 0; q < nseg; q++) {
      const [za0, y0, t0] = arc[q], [za1, y1, t1] = arc[q + 1];
      const n0 = [0, -Math.cos(t0), -Math.sin(t0)], n1 = [0, -Math.cos(t1), -Math.sin(t1)];
      B.tri([sd * xi, y0, za0], [sd * xo, y0, za0], [sd * xo, y1, za1], VM.liner, n0, n0, n1);
      B.tri([sd * xi, y0, za0], [sd * xo, y1, za1], [sd * xi, y1, za1], VM.liner, n0, n1, n1);
    }
    const wall = arc.map((p) => [p[0], p[1]]); wall.push([za + Rr * Math.sin(tm), 0.14], [za - Rr * Math.sin(tm), 0.14]);
    const faces = THREE.ShapeUtils.triangulateShape(wall.map((p) => new THREE.Vector2(p[0], p[1])), []), n = [sd, 0, 0];
    for (const f of faces) B.tri([sd * xi, wall[f[0]][1], wall[f[0]][0]], [sd * xi, wall[f[1]][1], wall[f[1]][0]], [sd * xi, wall[f[2]][1], wall[f[2]][0]], VM.liner, n, n, n);
  }
  const sill = s.bot[2][1], uy0 = 0.16, uy1 = sill + 0.06;
  B.box(0, (uy0 + uy1) / 2, (zF + zR) / 2, s.track - s.wheelW - 0.1, uy1 - uy0, s.WB + 2 * rA - 0.06, VM.under);
  { // closed floor pan from bumper to bumper (narrowed between the wheels): solid shadows, nothing hollow from below
    const xin = s.track / 2 - s.wheelW / 2 - 0.04, segs = [[zA, zF - rA, 0], [zF - rA, zF + rA, 1], [zF + rA, zR - rA, 0], [zR - rA, zR + rA, 1], [zR + rA, zB, 0]];
    for (const [za, zb2, narrow] of segs) {
      const ya = K.botF(fr(za)) + 0.012, yb2 = K.botF(fr(zb2)) + 0.012, xa = narrow ? xin : hwAt(za) * 0.87 - 0.01, xb = narrow ? xin : hwAt(zb2) * 0.87 - 0.01;
      B.quad([-xa, ya, za], [xa, ya, za], [xb, yb2, zb2], [-xb, yb2, zb2], VM.under, [0, -1, 0]);
    }
  }
  for (const [za, zb2, yy] of [[zA, zF - rA - 0.02, K.botF(0) + 0.02], [zR + rA + 0.02, zB, K.botF(1) + 0.02]]) {
    const xw = Math.min(hwAt(za), hwAt(zb2)) * 0.86, n = [0, -1, 0];
    B.quad([-xw, yy, za], [xw, yy, za], [xw, yy, zb2], [-xw, yy, zb2], VM.under, n);
  }
  if (lo) B.tube([[-0.42, 0.24, zR + 0.4], [-0.42, Math.max(0.2, K.botF(1) - 0.06), zB - 0.03]], 0.03, 6, HM.exhaust);
  else { // exhaust: pipe to a transverse silencer, tail pipe under the rear bumper (left)
    const xp = -0.42, yp = 0.24, zs0 = zR + 0.15;
    B.tube([[0, yp + 0.02, zF + 0.4], [-0.05, yp, zF + 1.2], [xp + 0.1, yp, zR - 0.4], [xp, yp, zR - 0.2]], 0.026, 8, HM.exhaust);
    B.tube([[-0.42, yp + 0.04, zs0], [0.32, yp + 0.04, zs0]], 0.075, 12, HM.exhaust, { caps: true });
    const zt = zB - 0.03, yt = Math.max(0.2, K.botF(1) - 0.06);
    B.tube([[xp, yp + 0.04, zs0 + 0.05], [xp, yt, zt - 0.25], [xp, yt, zt]], 0.028, 10, HM.exhaust);
    const Mt = new THREE.Matrix4().makeTranslation(xp, yt, zt).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    B.lathe([[0.034, -0.03], [0.036, 0.02], [0.03, 0.022], [0.028, -0.01], [0, -0.012]], 14, (j) => (j < 3 ? VM.chrome : VM.under), Mt);
  }
  // ---- interior: floor, dash, steering wheel, seats + headrests, shelf, mirror (HD only: mid glass is opaque)
  const pivots = {}, wheels = {}, calipers = {};
  const wh = { 1: wheelHD(s, 1, lo), [-1]: wheelHD(s, -1, lo) };
  for (const [nm, sd, za] of [['FL', -1, zF], ['FR', 1, zF], ['RL', -1, zR], ['RR', 1, zR]]) {
    pivots[nm] = [sd * (s.track / 2), s.wheelR, za];
    wheels[nm] = wh[sd].W; calipers[nm] = wh[sd].C;
  }
  if (lo) {
    if (!s.bed && Z.deck >= 0.95) { const fh = Z.roofR + 0.005, yh = topF(fh) + 0.02; B.box(0, yh - 0.01, F(fh) + 0.0305, 0.32, 0.03, 0.03, VM.tail); }
    return { B, G, I, wheels, calipers, pivots };
  }
  const yFloor = sill + 0.1, zc0 = F(Z.cowl), hwIn = (f) => planF(f) * hwMax - 0.08;
  I.quad([-hwIn(Z.cowl + 0.05), yFloor, zc0], [hwIn(Z.cowl + 0.05), yFloor, zc0], [hwIn(0.6), yFloor, zCab1], [-hwIn(0.6), yFloor, zCab1], HM.carpet, [0, 1, 0]);
  const yDash = beltF(Z.cowl) + 0.005, wD = hwIn(Z.cowl + 0.05);
  roundedBox(I, -wD, wD, yDash - 0.3, yDash, zc0 - 0.05, zc0 + 0.5, 0.05, HM.dash);
  roundedBox(I, -0.6, -0.14, yDash, yDash + 0.04, zc0 + 0.32, zc0 + 0.48, 0.02, HM.dash); // instrument hood
  I.box(0, yDash - 0.18, zc0 + 0.6, 0.22, 0.32, 0.3, HM.dash); // console
  {
    const cx = -0.37, cy = yDash + 0.0, cz = zc0 + 0.66, tilt = 0.42, pts = [];
    for (let q = 0; q <= 24; q++) { const t = (q / 24) * Math.PI * 2; pts.push([cx + Math.cos(t) * 0.18, cy + Math.sin(t) * 0.18 * Math.cos(tilt), cz - Math.sin(t) * 0.18 * Math.sin(tilt)]); }
    I.tube(pts, 0.015, 6, HM.dash);
    I.box(cx, cy, cz, 0.08, 0.08, 0.05, HM.dash, { pitch: -tilt });
    for (const t of [0, Math.PI, -Math.PI / 2]) I.box(cx + Math.cos(t) * 0.09, cy + Math.sin(t) * 0.09 * Math.cos(tilt), cz - Math.sin(t) * 0.09 * Math.sin(tilt), Math.abs(Math.cos(t)) * 0.14 + 0.02, Math.abs(Math.sin(t)) * 0.12 + 0.02, 0.012, HM.dash, { pitch: -tilt });
    I.tube([[cx, cy, cz], [cx, cy - 0.1, cz - 0.25]], 0.03, 8, HM.dash);
  }
  const seat = (x, zBack, w, bench) => {
    const yS = yFloor + 0.22, sd = 0.48, tilt = 0.22;
    roundedBox(I, x - w / 2, x + w / 2, yS - 0.12, yS, zBack - sd, zBack, 0.04, HM.seat); // cushion
    I.box(x, yS + 0.25, zBack + 0.02 + Math.sin(tilt) * 0.25, w, 0.54, 0.12, HM.seat, { pitch: -tilt }); // back
    const hx = bench ? [x - w * 0.32, x + w * 0.32] : [x], zh = zBack + 0.05 + Math.sin(tilt) * 0.58;
    for (const xh of hx) {
      roundedBox(I, xh - 0.13, xh + 0.13, yS + 0.58, yS + 0.74, zh, zh + 0.1, 0.04, HM.seat);
      for (const sx of [-0.06, 0.06]) I.box(xh + sx, yS + 0.55, zh + 0.05, 0.012, 0.07, 0.012, VM.chrome);
    }
  };
  // seats: front backrests a third of the way along the roof, the bench as far back as its headrests clear the roof
  const zFB = F(lerp(Z.roofF, Z.roofR, 0.33));
  let zRB = Math.min(F(Z.roofR) + 0.06, zFB + 0.95, zCab1 - 0.2);
  while (zRB > zFB + 0.62 && topF(fr(zRB + 0.32)) - 0.07 < yFloor + 0.22 + 0.74) zRB -= 0.02;
  for (const sd of [-1, 1]) seat(sd * 0.37, zFB, 0.5, false);
  seat(0, zRB, 2 * hwIn(fr(zRB)) - 0.08, true);
  if (!s.bed && Z.deck < 0.95) { // sedan: parcel shelf + high-mount stop lamp, bulkhead behind the bench
    const ysh = beltF(Z.deck) + 0.0, zs0 = zRB + 0.14, zs1 = F(Z.deck) + 0.01, w = hwIn(Z.deck);
    I.quad([-w, ysh, zs0], [w, ysh, zs0], [w, ysh, zs1], [-w, ysh, zs1], HM.seat, [0, 1, 0]);
    I.quad([-w, yFloor, zs0], [w, yFloor, zs0], [w, ysh, zs0], [-w, ysh, zs0], HM.card, [0, 0, -1]);
    roundedBox(B, -0.16, 0.16, ysh, ysh + 0.04, zs1 - 0.07, zs1 - 0.03, 0.012, VM.trim);
    B.box(0, ysh + 0.02, zs1 - 0.0295, 0.28, 0.022, 0.002, VM.tail);
  } else if (!s.bed) { // hatch / SUV / van: cargo floor, tailgate inner panel, high-mount lamp at the roof end
    const yc = yFloor + 0.12, zc1 = F(Z.deck) - 0.02, w = hwIn(Z.deck - 0.02);
    I.quad([-w, yc, zRB + 0.1], [w, yc, zRB + 0.1], [w, yc, zc1], [-w, yc, zc1], HM.carpet, [0, 1, 0]);
    I.quad([-w, yc, zc1], [w, yc, zc1], [w, beltF(Z.deck) + 0.02, zc1], [-w, beltF(Z.deck) + 0.02, zc1], HM.card, [0, 0, -1]);
    const fh = Z.roofR + 0.005, yh = topF(fh) + 0.02;
    roundedBox(B, -0.18, 0.18, yh - 0.025, yh + 0.005, F(fh) - 0.02, F(fh) + 0.03, 0.01, VM.trim);
    B.box(0, yh - 0.01, F(fh) + 0.0305, 0.32, 0.016, 0.002, VM.tail);
  }
  { // rear-view mirror
    const fm = Z.roofF + 0.012, ym = topF(fm) - 0.1;
    I.box(0, ym, F(fm) + 0.05, 0.25, 0.065, 0.03, HM.dash);
    I.box(0, ym + 0.05, F(fm) + 0.04, 0.02, 0.06, 0.02, HM.dash);
  }
  return { B, G, I, wheels, calipers, pivots };
}

/** Licence plate on a panel facing dir (+1 rear / -1 front): plate, embossed characters. */
function plate(B, x, y, z, dir) { // the number, frame and band come from the atlas (tile 8)
  const prev = B.uv;
  B.uv = (p, id) => (id === 8 ? [dir > 0 ? (p[0] - x) / 0.305 + 0.5 : (x - p[0]) / 0.305 + 0.5, (p[1] - y) / 0.152 + 0.5, 0] : null);
  B.box(x, y, z, 0.305, 0.152, 0.004, HM.plate);
  B.uv = prev;
}

/**
 * Indexed, compact copy of PartBuilders (each with an optional translation): identical vertices merged (the
 * deliberate hard edges keep their duplicates, which differ in normal): position float32, normal int8 and colour
 * uint16 (normalized), aSurf4 uint8 (normalized: roughness, metalness, clear coat, paint), aUvT float32 (atlas u, v,
 * tile + 1 + 32 x tiles per unit, aLamp). 41 B per unique vertex (a non-indexed layout: 72 B per triangle corner).
 * Five vertex attributes, so an instanced draw with colour, brake and previous matrices stays within 16: read only
 * by createVehicleMaterial({ hd: true }). Groups: [start, count] in indices.
 */
function packGeometry(list) {
  let n = 0; for (const { B } of list) n += B.P.length / 3;
  const pos = new Float32Array(n * 3), nor = new Int8Array(n * 3), col = new Uint16Array(n * 3), pai = new Uint8Array(n), lam = new Float32Array(n);
  const sur = new Uint8Array(n * 3), uv = new Float32Array(n * 2), tx = new Int8Array(n * 2), index = new Uint32Array(n);
  const posI = new Int32Array(pos.buffer), uvI = new Int32Array(uv.buffer), lamI = new Int32Array(lam.buffer);
  let cap = 1; while (cap < n * 2) cap <<= 1;
  const table = new Int32Array(cap).fill(-1), mask = cap - 1, q = new Int32Array(19), f32 = new Float32Array(1), i32 = new Int32Array(f32.buffer);
  const fb = (v) => { f32[0] = v; return i32[0]; };
  let u = 0, o = 0;
  for (const { B, t } of list) {
    const P = B.P, N = B.N, C = B.C, A = B.A, U = B.U, X = B.X, m = P.length / 3, tx0 = t ? t[0] : 0, ty0 = t ? t[1] : 0, tz0 = t ? t[2] : 0;
    for (let i = 0; i < m; i++, o++) {
      const k = i * 3, a = i * 6;
      q[0] = fb(P[k] + tx0); q[1] = fb(P[k + 1] + ty0); q[2] = fb(P[k + 2] + tz0);
      q[3] = Math.round(N[k] * 127); q[4] = Math.round(N[k + 1] * 127); q[5] = Math.round(N[k + 2] * 127);
      q[6] = Math.round(clamp(C[k], 0, 1) * 65535); q[7] = Math.round(clamp(C[k + 1], 0, 1) * 65535); q[8] = Math.round(clamp(C[k + 2], 0, 1) * 65535);
      q[9] = A[a] ? 255 : 0; q[10] = fb(A[a + 1]);
      q[11] = Math.round(clamp(A[a + 2], 0, 1) * 255); q[12] = Math.round(clamp(A[a + 3], 0, 1) * 255); q[13] = Math.round(clamp(A[a + 4], 0, 1) * 255);
      q[14] = U ? fb(U[i * 2]) : 0; q[15] = U ? fb(U[i * 2 + 1]) : 0; q[16] = X ? X[i * 2] : -1; q[17] = X ? Math.round(X[i * 2 + 1]) : 0;
      let h = 2166136261;
      for (let j = 0; j < 18; j++) h = Math.imul(h ^ q[j], 16777619);
      h &= mask;
      let found = -1;
      for (;;) {
        const e = table[h];
        if (e < 0) break;
        const e3 = e * 3, e2 = e * 2;
        if (posI[e3] === q[0] && posI[e3 + 1] === q[1] && posI[e3 + 2] === q[2] && nor[e3] === q[3] && nor[e3 + 1] === q[4] && nor[e3 + 2] === q[5]
          && col[e3] === q[6] && col[e3 + 1] === q[7] && col[e3 + 2] === q[8] && pai[e] === q[9] && lamI[e] === q[10]
          && sur[e3] === q[11] && sur[e3 + 1] === q[12] && sur[e3 + 2] === q[13] && uvI[e2] === q[14] && uvI[e2 + 1] === q[15] && tx[e2] === q[16] && tx[e2 + 1] === q[17]) { found = e; break; }
        h = (h + 1) & mask;
      }
      if (found < 0) {
        found = u++; table[h] = found;
        const e3 = found * 3, e2 = found * 2;
        posI[e3] = q[0]; posI[e3 + 1] = q[1]; posI[e3 + 2] = q[2]; nor[e3] = q[3]; nor[e3 + 1] = q[4]; nor[e3 + 2] = q[5];
        col[e3] = q[6]; col[e3 + 1] = q[7]; col[e3 + 2] = q[8]; pai[found] = q[9]; lamI[found] = q[10];
        sur[e3] = q[11]; sur[e3 + 1] = q[12]; sur[e3 + 2] = q[13]; uvI[e2] = q[14]; uvI[e2 + 1] = q[15]; tx[e2] = q[16]; tx[e2 + 1] = q[17];
      }
      index[o] = found;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, u * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor.slice(0, u * 3), 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(col.slice(0, u * 3), 3, true));
  // packed for the vertex-attribute limit (16: traffic adds instance matrix x4, colour, brake, previous matrix x4):
  // aSurf4 = (roughness, metalness, clear coat, paint), aUvT = (u, v, tile + 1 + 32 x tiles per unit, aLamp)
  const s4 = new Uint8Array(u * 4), ut = new Float32Array(u * 4);
  for (let i = 0; i < u; i++) {
    s4[i * 4] = sur[i * 3]; s4[i * 4 + 1] = sur[i * 3 + 1]; s4[i * 4 + 2] = sur[i * 3 + 2]; s4[i * 4 + 3] = pai[i];
    ut[i * 4] = uv[i * 2]; ut[i * 4 + 1] = uv[i * 2 + 1]; ut[i * 4 + 2] = tx[i * 2] + 1 + 32 * tx[i * 2 + 1]; ut[i * 4 + 3] = lam[i];
  }
  g.setAttribute('aSurf4', new THREE.BufferAttribute(s4, 4, true));
  g.setAttribute('aUvT', new THREE.BufferAttribute(ut, 4));
  g.setIndex(new THREE.BufferAttribute(u > 65535 ? index : new Uint16Array(index), 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData.tris = n / 3;
  return g;
}
/** Bytes of the typed arrays a geometry holds (attributes + index). */
export function geometryBytes(g) {
  let b = g.index ? g.index.array.byteLength : 0;
  for (const k in g.attributes) b += g.attributes[k].array.byteLength;
  return b;
}
const HD_TYPES = new Set(['sedan', 'hatchback', 'suv', 'pickup', 'minivan', 'police', 'taxi', 'police_sedan']);
const _hdCache = new Map();
/** HD ('hd') or mid ('mid') builders of a type (not cached: the packed geometry is, see hdGeometry). */
function hdBuild(type, level) {
  const s = BASE[type] || BASE.sedan;
  if (!HD_TYPES.has(type)) { // vans / box truck / bus: the LOD-0 build, no separate glass
    const Bq = new PartBuilder();
    if (type === 'bus') buildBus(Bq, s, 0, DEFAULT_BUS_LIVERY); else if (type === 'boxtruck') buildBoxTruck(Bq, s, 0); else buildCar(Bq, s, 0);
    return { B: Bq, G: new PartBuilder(), I: new PartBuilder(), wheels: null, calipers: null, pivots: null };
  }
  return buildCarHD(s, level === 'mid');
}
/**
 * The packed, shared geometry of a type at 'hd' / 'mid' (cached: ONE copy per type and level; the builders' arrays
 * are garbage once it exists). Rebuilt if a caller released its CPU arrays (render/Memory.js) since.
 */
function hdGeometry(type, level = 'hd') {
  const key = `${type}:${level}`;
  let g = _hdCache.get(key);
  if (g && g.attributes.position.array.length) return g;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const r = hdBuild(type, level), spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.sedan;
  const opaque = [{ B: r.B }, { B: r.I }];
  if (r.wheels) for (const k of ['FL', 'FR', 'RL', 'RR']) opaque.push({ B: r.wheels[k], t: r.pivots[k] }, { B: r.calipers[k], t: r.pivots[k] });
  let nO = 0; for (const { B } of opaque) nO += B.P.length / 3;
  g = packGeometry([...opaque, { B: r.G }]);
  if (level !== 'mid') { g.addGroup(0, nO, 0); g.addGroup(nO, g.index.count - nO, 1); }
  g.userData.spec = spec; g.userData.type = type; g.userData.lod = level;
  g.userData.glassTris = r.G.triCount; g.userData.shared = true;
  g.userData.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  g.userData.bytes = geometryBytes(g);
  _hdCache.set(key, g);
  return g;
}

// ------------------------------------------------------------------ public API
const _cache = new Map();
/**
 * Vehicle geometry (vehicle attribute layout). LOD 0 / 1: non-indexed, a clone (callers may add attributes).
 * 'hd' / 'mid': indexed and packed (int8 normals, uint16 colours, uint8 surface data, float aLamp / aUv, int8 aTex),
 * the SAME shared object on every call (one copy per type and level): do not mutate it; draw it through a view
 * geometry that shares its attributes when you need per-mesh attributes (Traffic does). Draw with
 * createVehicleMaterial({ hd: true }) ('hd' groups: 0 opaque, 1 glass + lenses -> ({ glass: true, hd: true })).
 * @param {string} type one of VEHICLE_TYPES
 * @param {{lod?: 0|1|'hd'|'mid', livery?: {lower?: object, stripe?: object}}} [opts] livery: bus colours (DEFAULT_BUS_LIVERY)
 */
export function makeVehicleGeometry(type, opts = {}) {
  if (opts.lod === 'hd' || opts.lod === 'mid') return hdGeometry(type, opts.lod);
  const lod = opts.lod ? 1 : 0;
  const livery = type === 'bus' && opts.livery ? opts.livery : null;
  const key = livery ? `${type}:${lod}:${JSON.stringify(livery)}` : `${type}:${lod}`;
  let g = _cache.get(key);
  if (!g) {
    const s = BASE[type] || BASE.sedan;
    const B = new PartBuilder();
    if (type === 'bus') buildBus(B, s, lod, livery || DEFAULT_BUS_LIVERY);
    else if (type === 'boxtruck') buildBoxTruck(B, s, lod);
    else buildCar(B, s, lod);
    g = B.build('vehicle');
    g.userData.spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.sedan;
    g.userData.type = type; g.userData.lod = lod;
    _cache.set(key, g);
  }
  const c = g.clone();
  c.userData = { ...g.userData };
  return c;
}

/** Types with a real HD build (the others' HD level is their LOD 0 with an empty glass group). */
export const VEHICLE_HD_TYPES = [...HD_TYPES];

/**
 * HD car as separate geometries for a drivable / hero car (built fresh on every call, not cached: the caller owns
 * them; packed and indexed like the 'hd' level):
 * { body, glass, interior, wheels: { FL, FR, RL, RR }, calipers: { FL, ... }, wheelFL, wheelFR, wheelRL, wheelRR,
 *   pivots: { FL: THREE.Vector3, ... }, spec, tris, buildMs }.
 * Wheels and calipers are in the wheel frame (hub at the origin, axle along X): place them at their pivot, spin the
 * wheel about its local X, steer wheel + caliper about Y. body + interior + wheels + calipers use
 * createVehicleMaterial({ hd: true }); glass (windows, lenses) createVehicleMaterial({ glass: true, hd: true }). Merging every part
 * at its pivot gives makeVehicleGeometry(type, { lod: 'hd' }) (same triangles). Types outside VEHICLE_HD_TYPES:
 * the LOD-0 build as `body`, empty glass / interior, no wheels.
 * @param {string} type @param {{lod?: 'hd'}} [opts]
 */
export function makeVehicleParts(type, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const r = hdBuild(type, opts.lod === 'mid' ? 'mid' : 'hd');
  const one = (B) => packGeometry([{ B }]), bw = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, B]) => [k, one(B)])) : null);
  const wheels = bw(r.wheels);
  const out = {
    body: one(r.B), glass: one(r.G), interior: one(r.I), wheels, calipers: bw(r.calipers),
    pivots: r.pivots ? Object.fromEntries(Object.entries(r.pivots).map(([k, p]) => [k, new THREE.Vector3(p[0], p[1], p[2])])) : null,
    spec: VEHICLE_SPECS[type] || VEHICLE_SPECS.sedan,
  };
  out.tris = [out.body, out.glass, out.interior, ...Object.values(wheels || {}), ...Object.values(out.calipers || {})].reduce((a, g) => a + g.userData.tris, 0);
  out.buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  if (wheels) { out.wheelFL = wheels.FL; out.wheelFR = wheels.FR; out.wheelRL = wheels.RL; out.wheelRR = wheels.RR; }
  return out;
}

// ------------------------------------------------------------------ paint
const PALETTES = {
  // [weight, [sRGB hex variants]] - US fleet colour shares (white 24, black 20, grey 18, silver 14, blue 9, red 8, other 7)
  car: [
    [0.24, [0xeeeeea, 0xf4f3ee, 0xe1e3e2]], [0.2, [0x0a0a0c, 0x111215, 0x17181b]], [0.18, [0x4b4f54, 0x60646a, 0x383b3f, 0x707379]],
    [0.14, [0xa6a9ae, 0xb8bbc0, 0x9a9ea3]], [0.09, [0x1f3f7c, 0x2c5ca8, 0x14234a, 0x41689e]], [0.08, [0x9e1416, 0xb81e1e, 0x6d0f14]],
    [0.02, [0x2c4a33, 0x1e3b2b, 0x4d6b4a]], [0.015, [0xb9a27e, 0x9e8a6a]], [0.01, [0x5b3a28, 0x4a3326]], [0.008, [0xd1621b, 0xc4501a]],
    [0.005, [0xe2b92b]], [0.012, [0x2e7f86, 0x1f6b70]],
  ],
  taxi: [[0.7, [0xf2b705, 0xf5c518]], [0.15, [0x2e7d4f]], [0.1, [0xc8202a]], [0.05, [0xeeeeea]]],
  truck: [[0.68, [0xf2f2f0, 0xe9eae8]], [0.08, [0xc8102e]], [0.08, [0x1f4e9a]], [0.07, [0xd8d9db]], [0.05, [0xf2b705]], [0.04, [0x0f5a2c]]],
  bus: [[1, [0xffffff]]], police: [[1, [0xffffff]]],
};
/** Realistic paint colour into `out` (linear THREE.Color). rnd: () => [0,1). */
export function pickVehicleColor(rnd, kind = 'car', out = new THREE.Color()) {
  const P = PALETTES[kind] || PALETTES.car;
  let tot = 0; for (const [w] of P) tot += w;
  let r = rnd() * tot, e = P[P.length - 1];
  for (const p of P) { r -= p[0]; if (r <= 0) { e = p; break; } }
  const hex = e[1][Math.floor(rnd() * e[1].length) % e[1].length];
  out.setHex(hex);
  if (kind === 'car') out.multiplyScalar(0.94 + rnd() * 0.1);
  return out;
}

// ------------------------------------------------------------------ material
/**
 * Clearcoated paint, glass and lamps from the vertex attributes. userData.u.uDark (0..1) scales lamps.
 * @param {{brake?: boolean, lamps?: boolean, glass?: boolean, hd?: boolean, envIntensity?: number|null}} [o] brake: per-instance `aBrake` drives brake-light intensity;
 *        lamps: false = parked cars (no lit lamps)
 * @param {boolean} [o.glass] opt-in: the HD glass / lens material (geometry group 1 of the HD level, makeVehicleParts
 *        glass): blended (no depth write), metalness 0, aSurf.y = opacity; reflections and lamp light are not faded by
 *        the opacity (premultiplied: diffuse * a + specular + emissive), so thin dark glass still mirrors the sky
 * @param {boolean} [o.hd] opt-in, for HD / mid geometry (needs its aUv / aTex): the surface atlas (getVehicleAtlas:
 *        plates, tyre lettering + tread, metallic flake under the clear coat and orange peel on it, disc machining,
 *        fluted / prismatic lenses, fabric and plastic grain, the taxi sign's lettering) as albedo x bump, road dirt
 *        along the sills, warm tail lamps (orange-red, hot cell cores from the geometry's n +- d codes)
 * @param {number} [o.envIntensity] opt-in envMapIntensity (default 1)
 * @returns {THREE.MeshPhysicalMaterial & { userData: { u: { uDark: { value: number }, tVehAtlas?: { value: THREE.Texture } } } }}
 *   `material.userData.u.uDark.value` (0 day .. 1 night) lights the head, tail and sign lamps
 */
export function createVehicleMaterial({ brake = true, lamps = true, glass = false, hd = false, envIntensity = null } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.07 });
  if (glass) { m.transparent = true; m.depthWrite = false; m.premultipliedAlpha = true; m.clearcoatRoughness = 0.03; }
  if (envIntensity != null) m.envMapIntensity = envIntensity;
  const u = { uDark: { value: 0 } };
  if (hd) u.tVehAtlas = { value: getVehicleAtlas() };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDark = u.uDark;
    if (hd) sh.uniforms.tVehAtlas = u.tVehAtlas;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPaint; attribute float aLamp; attribute vec3 aSurf;${brake ? '\nattribute float aBrake;' : ''}
uniform float uDark; varying vec3 vLampE; varying vec3 vSurf;`)
      .replace('#include <color_vertex>', `
vColor = vec3( 1.0 );
#ifdef USE_COLOR
vColor *= color;
#endif
vec3 tintC = vec3( 1.0 );
#ifdef USE_INSTANCING_COLOR
tintC = instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
tintC = getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif
vColor = mix( vColor, vColor * tintC, aPaint );
vSurf = aSurf;
vLampE = vec3( 0.0 );
${lamps ? `float brk = ${brake ? 'aBrake' : '0.0'};
if ( aLamp > 0.5 && aLamp < 1.5 ) vLampE = vec3( 1.0, 0.93, 0.8 ) * ( 0.12 + uDark * 7.0 );
else if ( aLamp > 1.5 && aLamp < 2.5 ) vLampE = vec3( 1.0, 0.0, 0.0 ) * ( 0.03 + uDark * 0.45 + brk * ( 0.85 + uDark * 0.3 ) );
else if ( aLamp > 2.5 && aLamp < 3.5 ) vLampE = vec3( 1.0, 0.42, 0.04 ) * ( 0.02 + uDark * 0.6 );
else if ( aLamp > 3.5 && aLamp < 4.5 ) vLampE = vec3( 1.0, 0.72, 0.28 ) * ( 0.05 + uDark * 2.2 );
else if ( aLamp > 4.5 && aLamp < 5.5 ) vLampE = vec3( 1.0, 0.04, 0.04 ) * ( uDark * 0.5 );
else if ( aLamp > 5.5 ) vLampE = vec3( 0.08, 0.2, 1.0 ) * ( uDark * 0.5 );
vLampE *= 1.0 - 2.0 * abs( aLamp - floor( aLamp + 0.5 ) ); // HD: code n +- d glows at 1 - 2d (integer codes: x1)${hd ? `
if ( aLamp > 1.5 && aLamp < 2.5 ) vLampE = vec3( 1.0, 0.25, 0.11 ) * vLampE.r * ( 1.1 + uDark * 1.3 ); // warm tail / brake light, into the bloom at night` : ''}` : ''}${hd ? `
vTexP = vec3( aUv * aTex.y, aTex.x ); vObjPos = position; vPaint = aPaint;
vDirt = ( aLamp < 0.5 && aSurf.y < 0.95 && aTex.x > -0.5 ? 1.0 : 0.0 ) * ( 1.0 - smoothstep( 0.16, 0.52, position.y ) );` : ''}`);
    if (hd) sh.vertexShader = sh.vertexShader
      .replace('attribute float aPaint; attribute float aLamp; attribute vec3 aSurf;', 'attribute vec4 aSurf4; attribute vec4 aUvT;\n#define aPaint aSurf4.w\n#define aSurf aSurf4.xyz\n#define aUv aUvT.xy\n#define aLamp aUvT.w\n#define aTex vec2( mod( aUvT.z, 32.0 ) - 1.0, floor( aUvT.z / 32.0 ) )')
      .replace('#include <common>', '#include <common>\nvarying vec3 vTexP; varying vec3 vObjPos; varying float vPaint; varying float vDirt;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLampE; varying vec3 vSurf;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.y;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= vSurf.z;\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vLampE;');
    if (hd) sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tVehAtlas; varying vec3 vTexP; varying vec3 vObjPos; varying float vPaint; varying float vDirt;
float vehNoise( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  float a = fract( sin( dot( i, vec3( 12.99, 78.23, 37.71 ) ) ) * 43758.5 ), b = fract( sin( dot( i + vec3( 1, 0, 0 ), vec3( 12.99, 78.23, 37.71 ) ) ) * 43758.5 );
  float c = fract( sin( dot( i + vec3( 0, 0, 1 ), vec3( 12.99, 78.23, 37.71 ) ) ) * 43758.5 ), d = fract( sin( dot( i + vec3( 1, 0, 1 ), vec3( 12.99, 78.23, 37.71 ) ) ) * 43758.5 );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.z ); }
vec4 vehTile( float id, vec2 uv, vec2 gx, vec2 gy ) { vec2 cell = vec2( mod( id, 4.0 ), floor( id / 4.0 ) );
  return textureGrad( tVehAtlas, ( cell + 0.0078125 + fract( uv ) * 0.984375 ) * 0.25, gx * 0.246, gy * 0.246 ); }
vec3 vehBump( vec3 n, float h, vec3 sx, vec3 sy, float fd ) { vec2 dh = vec2( dFdx( h ), dFdy( h ) );
  vec3 r1 = cross( sy, n ), r2 = cross( n, sx ); float det = dot( sx, r1 ) * fd;
  return normalize( abs( det ) * n - sign( det ) * ( dh.x * r1 + dh.y * r2 ) ); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float vehId = floor( vTexP.z + 0.5 );
vec2 vehGx = dFdx( vTexP.xy ), vehGy = dFdy( vTexP.xy );
vec4 vehT = vehId > -0.5 ? vehTile( vehId, vTexP.xy, vehGx, vehGy ) : vec4( 0.25, 0.25, 0.25, 0.5 );
diffuseColor.rgb *= vehT.rgb * 4.0;
float vehBs = vehId < -0.5 ? 0.0 : vehId < 0.5 ? 0.00003 : vehId < 1.5 ? 0.002 : vehId < 2.5 ? 0.0006 : vehId < 3.5 ? 0.0002 : vehId < 5.5 ? 0.0005 : vehId < 7.5 ? 0.00025 : vehId < 8.5 ? 0.0005 : 0.0;
float vehH = vehT.a * vehBs;
vec2 vehPu = vTexP.xy * 0.15;
float vehPeel = textureGrad( tVehAtlas, ( vec2( 2.0 ) + 0.0078125 + fract( vehPu ) * 0.984375 ) * 0.25, vehGx * 0.037, vehGy * 0.037 ).a * 0.00035 * vPaint;
float vehDirt = vDirt * clamp( 0.25 + 0.9 * vehNoise( vObjPos * vec3( 6.0, 14.0, 6.0 ) ) * vehNoise( vObjPos * 1.7 ), 0.0, 1.0 );
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.05, 0.043, 0.035 ), vehDirt * 0.6 );`)
      .replace('float roughnessFactor = vSurf.x;', 'float roughnessFactor = mix( vSurf.x, 0.9, vehDirt * 0.7 );')
      .replace('#include <normal_fragment_maps>', `{ vec3 vehSx = dFdx( - vViewPosition ), vehSy = dFdy( - vViewPosition );
  vec3 vehNb = vehBump( normal, vehH, vehSx, vehSy, faceDirection ); if ( vehBs > 0.0 ) normal = vehNb; }
#include <normal_fragment_maps>`)
      .replace('#include <clearcoat_normal_fragment_begin>', `#include <clearcoat_normal_fragment_begin>
#ifdef USE_CLEARCOAT
{ vec3 vehCn = vehBump( clearcoatNormal, vehPeel, dFdx( - vViewPosition ), dFdy( - vViewPosition ), faceDirection ); if ( vPaint > 0.5 ) clearcoatNormal = vehCn; }
#endif`)
      .replace('totalEmissiveRadiance += vLampE;', 'totalEmissiveRadiance += vLampE * ( vehId > -0.5 ? vehT.rgb * 4.0 : vec3( 1.0 ) );');
    if (glass) {
      sh.fragmentShader = sh.fragmentShader
        .replace('float metalnessFactor = vSurf.y;', 'float metalnessFactor = 0.0;')
        .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\ndiffuseColor.a = vSurf.y;')
        .replace('#include <opaque_fragment>', 'gl_FragColor = vec4( totalDiffuse * diffuseColor.a + ( outgoingLight - totalDiffuse ), diffuseColor.a );')
        .replace('#include <premultiplied_alpha_fragment>', '');
    }
  };
  m.customProgramCacheKey = () => `roadster-vehicle-3-${brake ? 1 : 0}${lamps ? 1 : 0}${glass ? '-glass' : ''}${hd ? '-hd2' : ''}`;
  m.userData.u = u;
  return m;
}
