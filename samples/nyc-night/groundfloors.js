// Ground floors at human scale, as real geometry, along the streets the walker uses (the shop bays and entrance canopies
// signage.js places; the engine's own shop-front boards / awnings are off: MapWorld buildings.style.storeDressing).
//   shop fronts  a pilaster at each end, a stall riser with a polished cap, glazing bars + transom bar over the
//                photographed interior (signage.js's parallax plane, set back behind the bars), a recessed doorway
//                (returns, threshold, a framed glass door with a push bar), a fascia with a moulded cornice and two
//                downlights in its soffit, a retractable awning on some (striped fabric that sags between the arms, a
//                valance, folding arms);
//   closed       a roller shutter: housing box, guide rails, horizontal slats (ribbed shading in the shader), a bottom
//                rail with a handle and two padlock boxes;
//   service      now and then a steel service door with a louvre and a caged bulkhead light, or a loading-dock shutter
//                with bumper posts on the big blocks;
//   lobbies      at signage.js's entrance canopies: a cantilevered canopy with a bronze edge, a soffit of downlights and
//                tie rods to the wall, stone portal piers, a revolving door (drum, curved glass, four wings) or a pair
//                of bronze-framed glass doors, side lights showing a dim lobby (interior mapping), a brass plaque;
//   the wall     a granite base course, wall lights with visible fixtures at the light positions signage.js already
//                lights (no more light without a lamp), standpipe connections, drainpipes on the low blocks, a few
//                security cameras, louvred vents.
// Merged geometry (vertex colour + per-vertex roughness / metalness / glow / pattern, MeshStandardMaterial patched; no
// shadow casting), shared with windowkit.js and split into the four quadrants round the square so the frustum culls them (kitMeshes), and
// one instanced mesh of interior planes on signage.js's material. Beyond
// `radius` the old cheap front (a plane + a header box + a bulkhead box) is kept. Seeded.
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }; // sRGB hex -> linear rgb

// pattern ids (aMat.w): 0 plain, 1 slats (shutters, louvres), 2 stone (polished, veined), 3 fabric, 4 brushed metal, 5 striped fabric
const P_PLAIN = 0, P_SLATS = 1, P_STONE = 2, P_FABRIC = 3, P_METAL = 4;
export const MAT = {
  paint: [0.55, 0, 0, P_PLAIN], gloss: [0.3, 0, 0, P_PLAIN], metal: [0.38, 0.85, 0, P_METAL], bronze: [0.32, 0.9, 0, P_METAL],
  steel: [0.5, 0.75, 0, P_METAL], stone: [0.32, 0, 0, P_STONE], rough: [0.85, 0, 0, P_STONE], fabric: [0.9, 0, 0, P_FABRIC],
  stripes: [0.9, 0, 0, 5], stripesUnder: [0.9, 0, 0, 7], slats: [0.42, 0.7, 0, P_SLATS], louvre: [0.6, 0.5, 0, P_SLATS], rubber: [0.9, 0, 0, P_PLAIN], glass: [0.06, 0, 0, P_PLAIN],
};
export const glow = (k) => [0.6, 0, k, P_PLAIN];

/** Merged geometry with explicit normals; triangles wound to agree with the normal. */
export class Kit {
  constructor() { this.p = []; this.n = []; this.c = []; this.m = []; this.i = []; }
  get tris() { return this.i.length / 3; }
  quad(A, B, C, D, N, col, mat) {
    const b = this.p.length / 3;
    for (const v of [A, B, C, D]) { this.p.push(v[0], v[1], v[2]); this.n.push(N[0], N[1], N[2]); this.c.push(col[0], col[1], col[2]); this.m.push(mat[0], mat[1], mat[2], mat[3]); }
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * N[0] + cy * N[1] + cz * N[2] >= 0) this.i.push(b, b + 1, b + 2, b, b + 2, b + 3); else this.i.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  tri(A, B, C, N, col, mat) {
    const b = this.p.length / 3;
    for (const v of [A, B, C]) { this.p.push(v[0], v[1], v[2]); this.n.push(N[0], N[1], N[2]); this.c.push(col[0], col[1], col[2]); this.m.push(mat[0], mat[1], mat[2], mat[3]); }
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * N[0] + cy * N[1] + cz * N[2] >= 0) this.i.push(b, b + 1, b + 2); else this.i.push(b, b + 2, b + 1);
  }
  /** Split into the four XZ quadrants around `c` {x, z} (by triangle centroid): a geometry per non-empty quadrant. */
  split(c) {
    const P = this.p, I = this.i, groups = new Map(), cx = c.x, cz = c.z;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const key = ((P[a] + P[b] + P[c]) / 3 > cx ? 1 : 0) + ((P[a + 2] + P[b + 2] + P[c + 2]) / 3 > cz ? 2 : 0);
      let g = groups.get(key); if (!g) groups.set(key, (g = []));
      g.push(I[t], I[t + 1], I[t + 2]);
    }
    const out = [];
    for (const idx of groups.values()) {
      // compact the vertices this cell uses
      const map = new Map(), sub = new Kit();
      for (const v of idx) {
        let j = map.get(v);
        if (j === undefined) { j = sub.p.length / 3; map.set(v, j); sub.p.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); sub.n.push(this.n[v * 3], this.n[v * 3 + 1], this.n[v * 3 + 2]); sub.c.push(this.c[v * 3], this.c[v * 3 + 1], this.c[v * 3 + 2]); sub.m.push(this.m[v * 4], this.m[v * 4 + 1], this.m[v * 4 + 2], this.m[v * 4 + 3]); }
        sub.i.push(j);
      }
      out.push(sub.geometry());
    }
    return out;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.m, 4));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/** A facade frame: s along the wall, y up (absolute), o out of the wall. */
export function frameOf(f) {
  const T = [f.tx, 0, f.tz], N = [f.nx, 0, f.nz], U = [0, 1, 0];
  const P = (s, y, o) => [f.a[0] + f.tx * s + f.nx * o, y, f.a[1] + f.tz * s + f.nz * o];
  return { T, N, U, P, mT: [-f.tx, 0, -f.tz], mN: [-f.nx, 0, -f.nz], mU: [0, -1, 0] };
}

/** Box in a facade frame: s0..s1, y0..y1, o0..o1; faces: f front, t top, b bottom, l / r ends, k back. */
export function box(K, F, s0, s1, y0, y1, o0, o1, col, mat, faces = 'ftblr') {
  const { P } = F;
  if (faces.includes('f')) K.quad(P(s0, y0, o1), P(s1, y0, o1), P(s1, y1, o1), P(s0, y1, o1), F.N, col, mat);
  if (faces.includes('k')) K.quad(P(s0, y0, o0), P(s1, y0, o0), P(s1, y1, o0), P(s0, y1, o0), F.mN, col, mat);
  if (faces.includes('t')) K.quad(P(s0, y1, o0), P(s1, y1, o0), P(s1, y1, o1), P(s0, y1, o1), F.U, col, mat);
  if (faces.includes('b')) K.quad(P(s0, y0, o0), P(s1, y0, o0), P(s1, y0, o1), P(s0, y0, o1), F.mU, col, mat);
  if (faces.includes('l')) K.quad(P(s0, y0, o0), P(s0, y0, o1), P(s0, y1, o1), P(s0, y1, o0), F.mT, col, mat);
  if (faces.includes('r')) K.quad(P(s1, y0, o0), P(s1, y0, o1), P(s1, y1, o1), P(s1, y1, o0), F.T, col, mat);
}
/** Square bar of side w between two world points (4 sides, open ends). */
export function bar(K, A, B, w, col, mat) {
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(d[0], d[1], d[2]) || 1;
  const e = [d[0] / L, d[1] / L, d[2] / L];
  let u = Math.abs(e[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let s = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]]; const sl = Math.hypot(...s); s = s.map((v) => v / sl);
  u = [s[1] * e[2] - s[2] * e[1], s[2] * e[0] - s[0] * e[2], s[0] * e[1] - s[1] * e[0]];
  const h = w / 2, off = (a, b) => [a[0] * h + b[0] * h, a[1] * h + b[1] * h, a[2] * h + b[2] * h];
  const corners = [off(s, u), off(s.map((v) => -v), u), off(s.map((v) => -v), u.map((v) => -v)), off(s, u.map((v) => -v))];
  for (let k = 0; k < 4; k++) {
    const c0 = corners[k], c1 = corners[(k + 1) % 4], nn = [c0[0] + c1[0], c0[1] + c1[1], c0[2] + c1[2]], nl = Math.hypot(...nn) || 1;
    K.quad([A[0] + c0[0], A[1] + c0[1], A[2] + c0[2]], [A[0] + c1[0], A[1] + c1[1], A[2] + c1[2]], [B[0] + c1[0], B[1] + c1[1], B[2] + c1[2]], [B[0] + c0[0], B[1] + c0[1], B[2] + c0[2]], nn.map((v) => v / nl), col, mat);
  }
}
/** Cylinder (axis up) in world space, open ends unless capTop; arc a0..a1 (radians, 0 = facade normal). */
function cyl(K, F, cs, co, y0, y1, r, n, col, mat, a0 = 0, a1 = Math.PI * 2, capTop = false) {
  const { P } = F;
  const at = (a, y, rr = r) => P(cs + Math.sin(a) * rr, y, co + Math.cos(a) * rr);
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n, tm = (t0 + t1) / 2;
    const nn = [F.T[0] * Math.sin(tm) + F.N[0] * Math.cos(tm), 0, F.T[2] * Math.sin(tm) + F.N[2] * Math.cos(tm)];
    K.quad(at(t0, y0), at(t1, y0), at(t1, y1), at(t0, y1), nn, col, mat);
    if (capTop) K.tri(at(t0, y1), at(t1, y1), P(cs, y1, co), F.U, col, mat);
  }
}

const FASCIA = ['#1d2a22', '#151515', '#3a1414', '#13203a', '#2e2a24', '#4a3a22', '#202326', '#5a1e16'].map(lin);
const AWNING = [['#6e1414', '#d8d0c0'], ['#14402a', '#d8d0c0'], ['#1a2a50', '#d8d0c0'], ['#121212', '#121212'], ['#7a5a1c', '#7a5a1c'], ['#3a1028', '#d8d0c0'], ['#6e1414', '#6e1414']].map(([a, b]) => [lin(a), lin(b)]);
const RISER = ['#151515', '#2a2622', '#3a3632', '#1a1d22', '#3c2a1e'].map(lin);

export function groundMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 1 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMat; varying vec4 vGMat; varying vec3 vGPos; varying vec3 vGNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGMat = aMat; vGPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vGNrm = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vGMat; varying vec3 vGPos; varying vec3 vGNrm;
float gH(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float gN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gH(i), gH(i + vec2(1.0, 0.0)), f.x), mix(gH(i + vec2(0.0, 1.0)), gH(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float gPat = floor(vGMat.w + 0.5);
vec2 gT = vec2(dot(vGPos.xz, normalize(vec2(-vGNrm.z, vGNrm.x) + 1e-5)), vGPos.y); // along the surface, up
float gSlat = 0.0;
if (gPat == 1.0) { float ph = fract(gT.y / 0.075); gSlat = ph; diffuseColor.rgb *= 0.62 + 0.38 * smoothstep(0.0, 0.18, ph) * (1.0 - 0.5 * smoothstep(0.8, 1.0, ph));
  // weathered paint: blotches, rust runs from the slat joints, a dirtier bottom
  diffuseColor.rgb *= 0.72 + 0.4 * gN(gT * vec2(1.3, 0.9)) ;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.08, 0.04), 0.35 * smoothstep(0.7, 0.95, gN(vec2(gT.x * 9.0, gT.y * 0.6))));
}
else if (gPat == 2.0) { float v = gN(gT * vec2(3.0, 5.0)) * 0.6 + gN(gT * 17.0) * 0.4; diffuseColor.rgb *= 0.82 + 0.36 * v; }
else if (gPat == 3.0 || gPat == 5.0 || gPat == 7.0) { // fabric: weave; 5 / 7 = striped to cream (7: the underside, in shade)
  diffuseColor.rgb *= 0.86 + 0.14 * gN(gT * vec2(60.0, 6.0));
  if (gPat > 4.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.46, 0.44, 0.4) * (gPat > 6.5 ? 0.5 : 1.0) * (0.86 + 0.14 * gN(gT * 50.0)), step(0.5, fract(gT.x / 0.62)));
}
else if (gPat == 4.0) { diffuseColor.rgb *= 0.9 + 0.2 * gN(vec2(gT.x * 2.0, gT.y * 90.0)); }
`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
roughnessFactor = vGMat.x * (gPat == 2.0 ? 0.8 + 0.5 * gN(gT * 9.0) : 1.0);
metalnessFactor = vGMat.y;
#ifdef ENGINE_GBUFFER
engineGbRoughness = roughnessFactor;
#endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (gPat == 1.0) { // slats: each rib rounded top to bottom (lamps and the sky read them)
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  normal = normalize(normal + upV * (0.9 * cos(gSlat * 6.2832)));
}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGMat.z;');
  };
  m.customProgramCacheKey = () => 'nyc-ground-1';
  return m;
}

/**
 * o: { world, scene, signs (buildSignage result), center {x,z}, radius = 320 (full geometry; beyond: the cheap front),
 *   lobbyIndex (interior atlas row of the lobby), clutter = 1 (share of the wall clutter), seed }.
 * Returns { group, counts }.
 */
export function buildGroundFloors(o) {
  const { world, signs } = o, R = rng(o.seed ?? 9091), C = o.center, R2 = (o.radius ?? 320) ** 2;
  const K = o.kit || new Kit(), counts = { shops: 0, closed: 0, simple: 0, awnings: 0, service: 0, docks: 0, lobbies: 0, lights: 0, standpipes: 0, drains: 0, cameras: 0, vents: 0 };
  const glass = []; // interior planes: { x, y, z, yaw, w, h, rect, anim, look }
  const gyAt = (x, z) => world.getGroundHeight(x, z);
  const near = (x, z) => (x - C.x) ** 2 + (z - C.z) ** 2 < R2;
  const clutter = o.clutter ?? 1;
  const lobbyK = o.lobbyIndex ?? 0, nShop = signs.shopCount || 1;
  const rect4 = (k) => [0, 1 - (k + 1) / nShop, 1, 1 / nShop];
  const addGlass = (F, s0, s1, y0, y1, oo, k, look, anim = [1, 0, 2, 3]) => {
    const [x, y, z] = F.P((s0 + s1) / 2, (y0 + y1) / 2, oo);
    glass.push({ x, y, z, yaw: Math.atan2(F.N[0], F.N[2]), w: s1 - s0, h: y1 - y0, rect: rect4(k), anim, look: [look[0], look[1], s1 - s0, y1 - y0] });
  };

  // lobbies claim their stretch of the facade
  const claimed = new Map();
  for (const c of signs.canopies || []) {
    if (!claimed.has(c.f)) claimed.set(c.f, []);
    claimed.get(c.f).push([c.s - c.w / 2 - 0.4, c.s + c.w / 2 + 0.4]);
  }
  const isClaimed = (f, a, b) => (claimed.get(f) || []).some(([p, q]) => b > p && a < q);

  // ---------------------------------------------------------------- shop bays
  const bays = new Map();
  for (const sh of signs.shops || []) {
    const f = sh.f, F = frameOf(f), s0 = sh.s0, s1 = sh.s0 + sh.w;
    if (isClaimed(f, s0, s1)) continue;
    if (!bays.has(f)) bays.set(f, []);
    bays.get(f).push([s0, s1]);
    const mid = F.P((s0 + s1) / 2, 0, 0.6), g = gyAt(mid[0], mid[2]);
    if (!near(mid[0], mid[2])) {
      // far: the old cheap front (glass plane with the drawn frame / shutter, a header box, a bulkhead box)
      addGlass(F, s0, s1, g + 0.1, g + 3.1, 0.55, sh.k, sh.look, [1, sh.open ? 0 : 1, 1, 3]);
      box(K, F, s0 - 0.2, s1 + 0.2, g + 3.1, g + 3.66, 0.47, 0.77, FASCIA[1], MAT.paint, 'ftb');
      box(K, F, s0 - 0.05, s1 + 0.05, g + 0.1, g + 0.54, 0.5, 0.74, FASCIA[1], MAT.paint, 'ft');
      counts.simple++;
      continue;
    }
    const r = R();
    const fasc = FASCIA[Math.floor(R() * FASCIA.length)], rise = RISER[Math.floor(R() * RISER.length)];
    const yG = g + 2.95, yF = g + 3.8, oG = 0.3, oF = 0.4;
    // pilasters (stone) and the fascia with its cornice and soffit downlights
    const pil = rise.map((v) => v * 1.6 + 0.04);
    box(K, F, s0, s0 + 0.32, g - 0.1, yF, 0, oF + 0.02, pil, MAT.stone, 'flr');
    box(K, F, s1 - 0.32, s1, g - 0.1, yF, 0, oF + 0.02, pil, MAT.stone, 'flr');
    box(K, F, s0 - 0.04, s1 + 0.04, yF - 0.02, yF + 0.1, 0, oF + 0.12, fasc.map((v) => v * 1.3), MAT.gloss, 'ftblr');
    box(K, F, s0 + 0.32, s1 - 0.32, yG, yF - 0.02, 0, oF, fasc, MAT.gloss, 'fb');
    box(K, F, s0 + 0.32, s1 - 0.32, yG + 0.04, yG + 0.12, oF, oF + 0.03, fasc.map((v) => v * 1.5), MAT.metal, 'ftb'); // a bead along the fascia foot
    const service = !sh.open && r < 0.12, dock = service && f.b.h > 40 && sh.w > 5 && R() < 0.5;
    if (sh.open) {
      // doorway: one end or the middle, recessed to the wall line
      const dw = 1.05, pos = R(), ds = pos < 0.35 ? s0 + 0.32 + 0.15 : pos < 0.7 ? s1 - 0.32 - 0.15 - dw : (s0 + s1) / 2 - dw / 2, de = ds + dw;
      const yR = g + 0.5 + R() * 0.15;
      // stall risers either side of the doorway, glazing above them
      for (const [a, b] of [[s0 + 0.32, ds - 0.05], [de + 0.05, s1 - 0.32]]) {
        if (b - a < 0.3) continue;
        box(K, F, a, b, g - 0.1, yR, 0, oG + 0.06, rise, MAT.stone, 'f');
        box(K, F, a - 0.02, b + 0.02, yR, yR + 0.05, 0, oG + 0.1, rise.map((v) => v * 1.4 + 0.02), MAT.stone, 'ftb'); // the polished cap
        addGlass(F, a, b, yR + 0.05, yG, oG, sh.k, [sh.look[0] * 1.5, sh.look[1]]); // brighter than the far planes: an open shop reads open
        const nb = Math.max(1, Math.round((b - a) / 1.5));
        for (let i = 1; i < nb; i++) { const sm = a + ((b - a) * i) / nb; box(K, F, sm - 0.025, sm + 0.025, yR + 0.05, yG, oG - 0.03, oG + 0.05, fasc, MAT.metal, 'flr'); }
        box(K, F, a, b, yG - 0.47, yG - 0.41, oG - 0.03, oG + 0.05, fasc, MAT.metal, 'ftb'); // transom bar
        box(K, F, a, b, yG - 0.05, yG, oG - 0.03, oG + 0.05, fasc, MAT.metal, 'fb'); // head
        box(K, F, a - 0.03, a + 0.02, yR + 0.05, yG, oG - 0.03, oG + 0.05, fasc, MAT.metal, 'fl'); box(K, F, b - 0.02, b + 0.03, yR + 0.05, yG, oG - 0.03, oG + 0.05, fasc, MAT.metal, 'fr');
      }
      // the recess: glazed returns, a tiled threshold, the door at the wall line, a transom light above it
      box(K, F, ds - 0.05, ds, g, yG, 0.02, oG + 0.05, fasc, MAT.metal, 'fr');
      box(K, F, de, de + 0.05, g, yG, 0.02, oG + 0.05, fasc, MAT.metal, 'fl');
      K.quad(F.P(ds, g + 0.02, 0.02), F.P(de, g + 0.02, 0.02), F.P(de, g + 0.02, oG + 0.06), F.P(ds, g + 0.02, oG + 0.06), F.U, lin('#6a6058'), MAT.stone);
      addGlass(F, ds + 0.06, de - 0.06, g + 0.14, g + 2.2, 0.035, sh.k, [sh.look[0] * 0.8, sh.look[1] + 0.3]);
      box(K, F, ds, de, g + 2.2, g + 2.3, 0.02, 0.06, fasc, MAT.metal, 'ftb');
      addGlass(F, ds + 0.04, de - 0.04, g + 2.3, yG - 0.03, 0.03, sh.k, sh.look);
      box(K, F, ds, ds + 0.06, g, g + 2.2, 0.02, 0.07, fasc, MAT.metal, 'fr'); box(K, F, de - 0.06, de, g, g + 2.2, 0.02, 0.07, fasc, MAT.metal, 'fl');
      box(K, F, ds + 0.06, de - 0.06, g, g + 0.14, 0.02, 0.07, lin('#7a6a4a'), MAT.bronze, 'ft'); // kick plate
      box(K, F, ds + 0.2, de - 0.2, g + 1.0, g + 1.04, 0.07, 0.11, lin('#b8b4ac'), MAT.steel, 'ftb'); // push bar
      // the shop's own sign on the fascia board (signage.js's neon fascias where it already hung one over this bay)
      if (!(signs.fasciaAt || []).some((q) => q.f === f && q.s1 > s0 && q.s0 < s1) && signs.fasciaRects) {
        const fr = signs.fasciaRects[Math.floor(R() * signs.fasciaRects.length)], sw = Math.min(s1 - s0 - 0.9, (yF - yG - 0.16) * 4);
        if (sw > 1) { const sm = (s0 + s1) / 2, [x, y, z] = F.P(sm, (yG + yF) / 2 + 0.02, oF + 0.006); glass.push({ x, y, z, yaw: Math.atan2(F.N[0], F.N[2]), w: sw, h: sw / 4, rect: fr, anim: [1, R() * 50, 1, 2], look: [0.45 + R() * 0.45, R(), 0, 0] }); counts.signs = (counts.signs || 0) + 1; }
      }
      // two downlights in the fascia soffit
      for (const u of [0.25, 0.75]) { const sm = s0 + (s1 - s0) * u; K.quad(F.P(sm - 0.07, yG - 0.005, 0.12), F.P(sm + 0.07, yG - 0.005, 0.12), F.P(sm + 0.07, yG - 0.005, 0.26), F.P(sm - 0.07, yG - 0.005, 0.26), F.mU, lin('#ffd9a8'), glow(1.6)); }
      // retractable awning: striped fabric sagging between the arms, a valance, folding arms
      if (R() < 0.42) {
        const [ca, cb] = AWNING[Math.floor(R() * AWNING.length)], out = 1.25 + R() * 0.35, drop = 0.45 + R() * 0.2, ya = yG + 0.02;
        const nS = Math.max(2, Math.round((s1 - s0 - 0.5) / 1.6)), nD = 2, sA = s0 + 0.28, sB = s1 - 0.28, striped = ca !== cb;
        const fm = striped ? MAT.stripes : MAT.fabric, fu = striped ? MAT.stripesUnder : MAT.fabric;
        const at = (i, j) => { const u = i / nS, v = j / nD, s = sA + (sB - sA) * u; const sag = 0.07 * Math.sin(Math.PI * v) * (0.6 + 0.4 * Math.sin(Math.PI * ((u * (sB - sA)) / 2.2 % 1))); return F.P(s, ya - drop * v - sag, 0.05 + out * v); };
        const nrm = (() => { const L = Math.hypot(out, drop); return [F.N[0] * drop / L, out / L, F.N[2] * drop / L]; })();
        const col = ca;
        for (let i = 0; i < nS; i++) {
          for (let j = 0; j < nD; j++) {
            K.quad(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), nrm, col, fm);
            K.quad(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), nrm.map((v) => -v), col.map((v) => v * 0.55), fu);
          }
          // valance (its hem is drawn by the shader)
          const v0 = at(i, nD), v1 = at(i + 1, nD), hy = 0.24;
          K.quad(v0, v1, [v1[0], v1[1] - hy, v1[2]], [v0[0], v0[1] - hy, v0[2]], F.N, col, fm);
          K.quad(v0, v1, [v1[0], v1[1] - hy, v1[2]], [v0[0], v0[1] - hy, v0[2]], F.mN, col.map((v) => v * 0.55), fu);
        }
        box(K, F, sA - 0.02, sB + 0.02, ya - 0.05, ya + 0.07, 0.01, 0.13, lin('#2a2a2a'), MAT.metal, 'ftb'); // roller cassette
        for (const s of [sA + 0.15, sB - 0.15]) { // folding arms (two links under the fabric)
          const A = F.P(s, ya - 0.95, 0.03), M = F.P(s + (s < (sA + sB) / 2 ? 0.35 : -0.35), ya - 0.62, out * 0.55), B = F.P(s, ya - drop * 0.98, out * 0.98);
          bar(K, A, M, 0.035, lin('#3a3a3a'), MAT.metal); bar(K, M, B, 0.035, lin('#3a3a3a'), MAT.metal);
        }
        counts.awnings++;
      }
      counts.shops++;
    } else if (service) {
      // a steel service door (with a louvre and a caged light) or a loading-dock shutter; plain wall around it
      const steel = lin(R() < 0.5 ? '#3a3e40' : '#4a2a20');
      if (dock) {
        const a = (s0 + s1) / 2 - 1.8, b = (s0 + s1) / 2 + 1.8, yt = Math.min(yG + 0.3, g + 3.3);
        box(K, F, a - 0.08, a, g, yt, 0, 0.12, steel, MAT.steel, 'fl'); box(K, F, b, b + 0.08, g, yt, 0, 0.12, steel, MAT.steel, 'fr');
        K.quad(F.P(a, g + 0.12, 0.06), F.P(b, g + 0.12, 0.06), F.P(b, yt - 0.25, 0.06), F.P(a, yt - 0.25, 0.06), F.N, lin('#5a5e60'), MAT.slats);
        box(K, F, a - 0.1, b + 0.1, yt - 0.25, yt + 0.05, 0, 0.3, steel, MAT.steel, 'ftb');
        box(K, F, a, b, g + 0.04, g + 0.12, 0.04, 0.1, lin('#222'), MAT.steel, 'ft');
        for (const s of [a - 0.45, b + 0.45]) { box(K, F, s - 0.09, s + 0.09, g, g + 1.0, 0.25, 0.43, lin('#c8a020'), MAT.paint, 'ftlr'); box(K, F, s - 0.095, s + 0.095, g + 0.6, g + 0.75, 0.245, 0.435, lin('#151515'), MAT.paint, 'flr'); }
        counts.docks++;
      } else {
        const a = s0 + 0.32 + R() * Math.max(0, s1 - s0 - 2.4), b = a + 1.0;
        box(K, F, a - 0.07, a, g, g + 2.25, 0, 0.09, steel, MAT.steel, 'fl'); box(K, F, b, b + 0.07, g, g + 2.25, 0, 0.09, steel, MAT.steel, 'fr');
        box(K, F, a - 0.07, b + 0.07, g + 2.18, g + 2.25, 0, 0.09, steel, MAT.steel, 'ft');
        box(K, F, a, b, g, g + 2.18, 0, 0.04, steel.map((v) => v * 0.8), MAT.steel, 'f');
        box(K, F, b - 0.16, b - 0.06, g + 1.0, g + 1.06, 0.04, 0.09, lin('#9a9890'), MAT.steel, 'ftb'); // lever handle
        box(K, F, a + 0.15, b - 0.15, g + 2.4, g + 2.8, 0, 0.05, lin('#4a4c4c'), MAT.louvre, 'ftb'); // louvre
        box(K, F, (a + b) / 2 - 0.12, (a + b) / 2 + 0.12, g + 2.95, g + 3.15, 0, 0.16, lin('#1a1a1a'), MAT.metal, 'ftblr'); // bulkhead light
        K.quad(F.P((a + b) / 2 - 0.1, g + 2.95, 0.02), F.P((a + b) / 2 + 0.1, g + 2.95, 0.02), F.P((a + b) / 2 + 0.1, g + 2.95, 0.14), F.P((a + b) / 2 - 0.1, g + 2.95, 0.14), F.mU, lin('#ffe2b0'), glow(1.2));
        counts.service++;
      }
    } else {
      // roller shutter: housing, guide rails, slats, bottom rail with a handle and padlock boxes
      const a = s0 + 0.32, b = s1 - 0.32, yH = yG - 0.3, oS = 0.27, sc = lin(R() < 0.6 ? '#7a7c7a' : R() < 0.5 ? '#5a6062' : '#6a5a48');
      box(K, F, a, b, yH, yG, 0, 0.38, sc.map((v) => v * 0.8), MAT.steel, 'fb');
      box(K, F, a, a + 0.07, g, yH, 0.2, 0.36, sc.map((v) => v * 0.7), MAT.steel, 'flr'); box(K, F, b - 0.07, b, g, yH, 0.2, 0.36, sc.map((v) => v * 0.7), MAT.steel, 'flr');
      K.quad(F.P(a + 0.07, g + 0.1, oS), F.P(b - 0.07, g + 0.1, oS), F.P(b - 0.07, yH, oS), F.P(a + 0.07, yH, oS), F.N, sc.map((v) => v * (0.75 + 0.25 * R())), MAT.slats);
      box(K, F, a + 0.07, b - 0.07, g + 0.02, g + 0.1, oS - 0.02, oS + 0.05, sc.map((v) => v * 0.6), MAT.steel, 'ftb');
      const m = (a + b) / 2;
      box(K, F, m - 0.12, m + 0.12, g + 0.1, g + 0.14, oS + 0.02, oS + 0.06, lin('#2a2a2a'), MAT.steel, 'ftb'); // handle
      for (const s of [a + 0.35, b - 0.35]) { box(K, F, s - 0.05, s + 0.05, g + 0.03, g + 0.15, oS + 0.05, oS + 0.11, lin('#8a8478'), MAT.steel, 'ftblr'); box(K, F, s - 0.035, s + 0.035, g + 0.15, g + 0.22, oS + 0.07, oS + 0.09, lin('#b0aca0'), MAT.steel, 'ftlr'); }
      counts.closed++;
    }
  }

  // ---------------------------------------------------------------- lobbies
  for (const c of signs.canopies || []) {
    const f = c.f, F = frameOf(f), mid = F.P(c.s, 0, 1), g = gyAt(mid[0], mid[2]);
    if (!near(mid[0], mid[2])) {
      box(K, F, c.s - c.w / 2, c.s + c.w / 2, g + 3.39, g + 3.71, 0, c.d, lin('#15161a'), MAT.metal, 'ftblr');
      K.quad(F.P(c.s - c.w / 2 + 0.2, g + 3.38, 0.2), F.P(c.s + c.w / 2 - 0.2, g + 3.38, 0.2), F.P(c.s + c.w / 2 - 0.2, g + 3.38, c.d - 0.2), F.P(c.s - c.w / 2 + 0.2, g + 3.38, c.d - 0.2), F.mU, lin('#ffb870'), glow(0.55));
      continue;
    }
    const s0 = c.s - c.w / 2, s1 = c.s + c.w / 2, yC = g + 3.5, bronze = lin('#5a4024'), stone = lin(R() < 0.5 ? '#8a8276' : '#4a4644');
    // portal piers and a stone lintel
    box(K, F, s0 - 0.5, s0, g - 0.1, yC + 0.9, 0, 0.18, stone, MAT.stone, 'flr'); box(K, F, s1, s1 + 0.5, g - 0.1, yC + 0.9, 0, 0.18, stone, MAT.stone, 'flr');
    box(K, F, s0 - 0.5, s1 + 0.5, yC + 0.35, yC + 0.9, 0, 0.18, stone, MAT.stone, 'ftb');
    // the canopy: slab with a bronze edge, a soffit of downlights, tie rods to the wall
    box(K, F, s0, s1, yC, yC + 0.3, 0.18, c.d, lin('#1a1a1c'), MAT.metal, 'tblr');
    box(K, F, s0 - 0.03, s1 + 0.03, yC - 0.02, yC + 0.32, c.d, c.d + 0.05, bronze, MAT.bronze, 'ftblr');
    for (let s = s0 + 0.5; s < s1 - 0.3; s += 0.8) for (let d = 0.6; d < c.d - 0.2; d += 0.8) K.quad(F.P(s - 0.06, yC - 0.005, d - 0.06), F.P(s + 0.06, yC - 0.005, d - 0.06), F.P(s + 0.06, yC - 0.005, d + 0.06), F.P(s - 0.06, yC - 0.005, d + 0.06), F.mU, lin('#ffdcb0'), glow(2.2));
    for (const s of [s0 + 0.3, s1 - 0.3]) bar(K, F.P(s, yC + 0.3, c.d - 0.1), F.P(s, yC + 2.2, 0.02), 0.035, lin('#2a2a2a'), MAT.steel);
    // doors: a revolving door or a pair of glass doors; side lights with the lobby behind
    const revolving = R() < 0.5, dc = c.s;
    if (revolving) {
      const r = 1.0;
      cyl(K, F, dc, 0.15, g + 2.25, g + 2.45, r + 0.05, 16, bronze, MAT.bronze, 0, Math.PI * 2, true);
      cyl(K, F, dc, 0.15, g + 0.02, g + 2.25, r, 8, lin('#0a0c0e'), MAT.glass, Math.PI * 0.3, Math.PI * 0.7);
      cyl(K, F, dc, 0.15, g + 0.02, g + 2.25, r, 8, lin('#0a0c0e'), MAT.glass, Math.PI * 1.3, Math.PI * 1.7);
      const a0 = R() * Math.PI / 2;
      for (let k = 0; k < 4; k++) { const a = a0 + (k * Math.PI) / 2; const E = F.P(dc + Math.sin(a) * r * 0.97, 0, 0.15 + Math.cos(a) * r * 0.97); bar(K, [E[0], g + 0.05, E[2]], [E[0], g + 2.2, E[2]], 0.05, bronze, MAT.bronze); bar(K, F.P(dc, g + 1.0, 0.15), [E[0], g + 1.0, E[2]], 0.04, bronze, MAT.bronze); }
      bar(K, F.P(dc, g + 0.02, 0.15), F.P(dc, g + 2.25, 0.15), 0.08, bronze, MAT.bronze);
      addGlass(F, dc - 1.0, dc + 1.0, g + 0.05, g + 2.25, 0.02, lobbyK, [0.42, R()]);
    } else {
      for (const sg of [-1, 1]) {
        const a = sg < 0 ? dc - 0.92 : dc + 0.02, b = a + 0.9;
        addGlass(F, a + 0.08, b - 0.08, g + 0.12, g + 2.3, 0.03, lobbyK, [0.42, R()]);
        box(K, F, a, a + 0.08, g, g + 2.4, 0.02, 0.08, bronze, MAT.bronze, 'flr'); box(K, F, b - 0.08, b, g, g + 2.4, 0.02, 0.08, bronze, MAT.bronze, 'flr');
        box(K, F, a, b, g + 2.3, g + 2.4, 0.02, 0.08, bronze, MAT.bronze, 'ftb'); box(K, F, a, b, g, g + 0.12, 0.02, 0.08, bronze, MAT.bronze, 'ft');
        bar(K, F.P(sg < 0 ? b - 0.18 : a + 0.18, g + 0.8, 0.14), F.P(sg < 0 ? b - 0.18 : a + 0.18, g + 1.6, 0.14), 0.035, lin('#c8b080'), MAT.bronze); // pull handles
      }
    }
    // side lights to the piers, a transom over the whole entrance
    const sideA = revolving ? dc - 1.05 : dc - 0.95, sideB = revolving ? dc + 1.05 : dc + 0.95;
    for (const [a, b] of [[s0 + 0.05, sideA], [sideB, s1 - 0.05]]) {
      if (b - a < 0.4) continue;
      addGlass(F, a, b, g + 0.35, yC - 0.05, 0.04, lobbyK, [0.38, R()]);
      box(K, F, a, b, g - 0.1, g + 0.35, 0, 0.1, stone, MAT.stone, 'ft');
      const nb = Math.max(1, Math.round((b - a) / 1.2));
      for (let i = 0; i <= nb; i++) { const sm = a + ((b - a) * i) / nb; box(K, F, sm - 0.03, sm + 0.03, g + 0.35, yC, 0.02, 0.09, bronze, MAT.bronze, 'flr'); }
    }
    box(K, F, s0, s1, g + 2.45, g + 2.52, 0.02, 0.09, bronze, MAT.bronze, 'ftb');
    // the brass address plaque on the left pier
    box(K, F, s0 - 0.42, s0 - 0.08, g + 1.45, g + 1.75, 0.18, 0.2, lin('#b8904a'), [0.25, 1, 0.08, P_METAL], 'ftblr');
    counts.lobbies++;
  }

  // ---------------------------------------------------------------- the wall: base course, fixtures, pipes, cameras, vents
  const seenB = new Set();
  for (const f of signs.facades || []) {
    const F = frameOf(f), mid = F.P(f.len / 2, 0, 0.6);
    if (!near(mid[0], mid[2]) || f.b.h < 5) continue;
    const g = gyAt(mid[0], mid[2]);
    // base course along the whole front (behind the fronts, visible on the piers between them)
    box(K, F, 0.02, f.len - 0.02, g - 0.15, g + 0.38, 0, 0.05, lin('#4a4846'), MAT.rough, 'ft');
    if (R() > clutter) continue;
    const fb = bays.get(f) || [];
    const gap = (s) => !fb.some(([a, b]) => s > a - 0.05 && s < b + 0.05) && !isClaimed(f, s - 0.3, s + 0.3);
    // standpipe connection on the tall blocks: on a pier near an end
    if (f.b.h > 25 && R() < 0.7) {
      const s = [0.3, f.len - 0.3].find(gap);
      if (s != null) {
        const br = lin('#9a7a3a');
        box(K, F, s - 0.18, s + 0.18, g + 0.62, g + 0.74, 0.05, 0.2, br, MAT.bronze, 'ftblr');
        for (const d of [-0.11, 0.11]) box(K, F, s + d - 0.05, s + d + 0.05, g + 0.6, g + 0.76, 0.2, 0.27, lin('#c09a50'), MAT.bronze, 'ftblr');
        box(K, F, s - 0.04, s + 0.04, g, g + 0.62, 0.05, 0.13, lin('#6a2a1a'), MAT.paint, 'flr');
        counts.standpipes++;
      }
    }
    // drainpipe down a corner of the low blocks
    if (f.b.h < 32 && !seenB.has(f.b) && R() < 0.6) {
      seenB.add(f.b);
      const s = R() < 0.5 ? 0.14 : f.len - 0.14, top = g + f.b.h - 0.3, pc = lin(R() < 0.5 ? '#2a2c2c' : '#3e3a34');
      box(K, F, s - 0.05, s + 0.05, g + 0.1, top, 0.04, 0.14, pc, MAT.metal, 'flr');
      for (let y = g + 1.5; y < top; y += 2.2) box(K, F, s - 0.07, s + 0.07, y, y + 0.05, 0.02, 0.16, pc, MAT.metal, 'ftblr');
      box(K, F, s - 0.06, s + 0.06, g, g + 0.3, 0.04, 0.24, pc, MAT.metal, 'ftlr'); // shoe
      counts.drains++;
    }
    // a security camera over an end of the fronts
    if (R() < 0.3 && fb.length) {
      const s = fb[0][0] + 0.2, y = g + 4.05;
      box(K, F, s - 0.04, s + 0.04, y, y + 0.08, 0, 0.2, lin('#d0d0cc'), MAT.paint, 'ftblr');
      box(K, F, s - 0.07, s + 0.07, y - 0.1, y + 0.02, 0.12, 0.42, lin('#e0e0dc'), MAT.gloss, 'ftblr');
      K.quad(F.P(s - 0.04, y - 0.08, 0.425), F.P(s + 0.04, y - 0.08, 0.425), F.P(s + 0.04, y, 0.425), F.P(s - 0.04, y, 0.425), F.N, lin('#ff2010'), glow(0.6));
      counts.cameras++;
    }
    // louvred vents above the fronts
    if (R() < 0.35) {
      const s = 1 + R() * Math.max(0.5, f.len - 2.5), y = g + 4.25;
      box(K, F, s - 0.4, s + 0.4, y, y + 0.5, 0, 0.06, lin('#5a5c5a'), MAT.louvre, 'ftblr');
      counts.vents++;
    }
  }
  // wall lights with a fixture where signage.js already lights the wall (a gooseneck shade over the fronts)
  for (const l of signs.signLights || []) {
    if (l.kind !== 'wash' || !near(l.sx, l.sz)) continue;
    const wx = l.sx - l.nx * 1.6, wz = l.sz - l.nz * 1.6, y = l.sy + 0.3;
    const f = { a: [wx, wz], tx: -l.nz, tz: l.nx, nx: l.nx, nz: l.nz }, F = frameOf(f), dark = lin('#141414');
    box(K, F, -0.09, 0.09, y - 0.15, y + 0.15, 0, 0.03, dark, MAT.metal, 'ftblr');
    bar(K, F.P(0, y, 0.03), F.P(0, y + 0.18, 0.35), 0.035, dark, MAT.metal);
    bar(K, F.P(0, y + 0.18, 0.35), F.P(0, y + 0.05, 0.6), 0.035, dark, MAT.metal);
    // the shade (a shallow pyramid) and its lit lens
    const c = F.P(0, y + 0.05, 0.6), r = 0.16, ys = y - 0.06;
    const ring = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([a, b]) => F.P(a, ys, 0.6 + b));
    for (let k = 0; k < 4; k++) { const A = ring[k], B = ring[(k + 1) % 4]; const mx = (A[0] + B[0]) / 2 - c[0], mz = (A[2] + B[2]) / 2 - c[2], ml = Math.hypot(mx, mz) || 1; K.tri(A, B, c, [mx / ml * 0.6, 0.8, mz / ml * 0.6], dark, MAT.metal); }
    const lens = [[-r * 0.6, -r * 0.6], [r * 0.6, -r * 0.6], [r * 0.6, r * 0.6], [-r * 0.6, r * 0.6]].map(([a, b]) => F.P(a, ys - 0.005, 0.6 + b));
    K.quad(ring[0], ring[1], ring[2], ring[3], [0, -1, 0], dark, MAT.metal);
    K.quad(lens[0], lens[1], lens[2], lens[3], [0, -1, 0], lin('#ffb468'), glow(1.3));
    counts.lights++;
  }

  // ---------------------------------------------------------------- meshes
  const group = new THREE.Group(); group.name = 'ground-floors';
  const mat = o.material || groundMaterial();
  let mesh = null;
  if (!o.kit) { mesh = new THREE.Mesh(K.geometry(), mat); mesh.name = 'ground-floors'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh); }
  if (glass.length) {
    const n = glass.length, geo = new THREE.PlaneGeometry(1, 1), ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index;
    for (const k of ['position', 'normal', 'uv']) ig.setAttribute(k, geo.getAttribute(k));
    const aRect = new Float32Array(n * 4), aAnim = new Float32Array(n * 4), aLook = new Float32Array(n * 4);
    glass.forEach((s, i) => { aRect.set(s.rect, i * 4); aAnim.set(s.anim, i * 4); aLook.set(s.look, i * 4); });
    ig.setAttribute('aRect', new THREE.InstancedBufferAttribute(aRect, 4));
    ig.setAttribute('aAnim', new THREE.InstancedBufferAttribute(aAnim, 4));
    ig.setAttribute('aLook', new THREE.InstancedBufferAttribute(aLook, 4));
    const im = new THREE.InstancedMesh(ig, signs.material, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();
    glass.forEach((s, i) => { q.setFromAxisAngle(up, s.yaw); im.setMatrixAt(i, m4.compose(P.set(s.x, s.y, s.z), q, S.set(s.w, s.h, 1))); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.name = 'shop-glass'; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
    group.add(im);
    counts.glass = n;
  }
  counts.tris = K.tris;
  o.scene.add(group);
  return { group, mesh, counts, material: mat };
}

/** The merged street-level geometry (groundfloors.js + windowkit.js share one Kit) as one mesh per quadrant round `center`. */
export function kitMeshes(K, material, { center, name = 'street-kit' } = {}) {
  const group = new THREE.Group(); group.name = name;
  for (const g of K.tris ? K.split(center) : []) {
    const m = new THREE.Mesh(g, material);
    m.name = name; m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false;
    group.add(m);
  }
  return group;
}
