// Street kit of the Night NYC walk: what is set into the road and the sidewalk, the kerbs, and the street furniture that
// comes closest to the camera, from one baked atlas (samples/public/nyc/street/, tools/bake-street.mjs: Poly Haven CC0
// scans + procedural cast iron / steel / granite crops; 2048 px desktop, 1024 px mobile) in ONE BatchedMesh, plus one
// instanced mesh of soft contact shadows. Placement is by rules on the engine's road network (world.net.list: polyline,
// style, junctions), the occupancy raster (RBIT.SIDEWALK / ROAD / BUILDING) and the engine's furniture grid; seeded.
//   set into the road     manhole covers (a scanned water cover + two cast-iron designs, some with a darker saw-cut
//                         patch ring), steel road plates on ramped cold patch, valve boxes, catch-basin grates in the
//                         gutter before each corner (the engine's manhole / drain decals are hidden)
//   set into the sidewalk vault doors and hatch plates along the frontage, valve boxes by the kerb, tree pits (cast-iron
//                         grate, open soil, or Belgian-block cobbles) under every sidewalk tree
//   kerbs                 granite stones 1.2 - 2.4 m with dark joints and a rounded, worn arris, laid over the engine's
//                         hard-edged kerb on every straight sidewalk edge
//   props                 hydrants (two finishes; the engine's procedural hydrants are hidden), galvanised trash cans at
//                         corners (the engine's bins hidden), piles of black and clear garbage bags with crates and
//                         cardboard at the kerb, Jersey barriers closing the pedestrian plazas, signal controller boxes
//                         by the corner poles; the engine's single-space parking meters are thinned to the odd one left
//                         (Midtown has pay-and-display kiosks now)
//   contact shadows       a dark radial blob under every prop, pile, parked car and kept engine furniture piece
// LOD: props swap to a 1/5 mesh beyond LOD_DIST; per-instance distance culling (throttled, like Props.updateCulling).
// Nothing here casts into the shadow maps (the dusk moon is too dim to plant anything): the blobs do the grounding.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RBIT, samplePolyline } from '@vibe/engine/world';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Grid { // proximity test for what this kit placed
  constructor(cell = 4) { this.c = cell; this.m = new Map(); }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(x, z) { const k = this.key(Math.floor(x / this.c), Math.floor(z / this.c)); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(x, z); }
  near(x, z, r) {
    const c = this.c;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
      const a = this.m.get(this.key(i, j)); if (!a) continue;
      for (let q = 0; q < a.length; q += 2) if ((a[q] - x) ** 2 + (a[q + 1] - z) ** 2 < r * r) return true;
    }
    return false;
  }
}

/** World-space triangle soup for one chunk of flat kit (insets, kerb stones): position / normal / uv(atlas) / index. */
class Soup {
  constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, v) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); return this.p.length / 3 - 1; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const CHUNK = 96; // m, flat-kit chunk cells

/**
 * @param {object} o { world, scene, base (url of samples/public/nyc/), desk (tier), seed, center {x,z}, radius }
 * @returns {Promise<{ update(cam), group, counts, mesh, shadows }>}
 */
export async function buildStreetKit(o) {
  const { world, scene, desk } = o;
  const R = rng(o.seed ?? 20261111);
  const dir = `${o.base}street/`, tdir = desk ? dir : `${dir}atlas512/`;
  const tl = new THREE.TextureLoader();
  const tex = (f, srgb) => new Promise((res) => tl.load(tdir + f, (t) => { t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = desk ? 8 : 4; t.generateMipmaps = true; t.needsUpdate = true; res(t); }, undefined, () => res(null)));
  const [gltf, diff, nor, arm] = await Promise.all([
    new GLTFLoader().loadAsync(`${dir}street.gltf`).catch((e) => { console.warn('[street] kit failed to load', e); return null; }),
    tex('atlas_diff.jpg', true), tex('atlas_nor.jpg', false), tex('atlas_arm.jpg', false),
  ]);
  if (!gltf || !diff) return null;
  const AT = gltf.parser.json.asset.extras.atlas; // name -> [u, v, w, h] (image space, v down)
  const geo = {};
  gltf.scene.traverse((m) => { if (m.isMesh) geo[m.name] = m.geometry; });

  const counts = { manholes: 0, plates: 0, valves: 0, grates: 0, vaults: 0, hatches: 0, pits: 0, kerbStones: 0, hydrants: 0, cans: 0, piles: 0, bags: 0, barriers: 0, boxes: 0, metersHidden: 0, shadows: 0 };
  const raster = world.raster, net = world.net, props = world.props;
  const sw = (x, z) => !!(raster && raster.get(x, z) & RBIT.SIDEWALK);
  const isRoad = (x, z) => !!(raster && raster.get(x, z) & RBIT.ROAD);
  const isBld = (x, z) => !!(raster && raster.get(x, z) & RBIT.BUILDING);
  const gy = (x, z) => world.getGroundHeight(x, z);
  const base = (x, z) => (world._groundAt ? world._groundAt(x, z) : 0);
  const C = o.center || { x: 0, z: 0 }, RAD2 = (o.radius || 1e9) ** 2;
  const inArea = (x, z) => (x - C.x) ** 2 + (z - C.z) ** 2 < RAD2;
  const mine = new Grid(4); // everything this kit placed above the ground
  const busy = (x, z, r) => mine.near(x, z, r) || (props && props.grid && props.grid.near(x, z, r)) || (props && props.treeGrid && props.treeGrid.near(x, z, r + 0.4));
  const blobs = []; // contact shadows: [x, y, z, yaw, sx, sz, k]
  const spots = { piles: [], cans: [], hydrants: [], boxes: [], barriers: [] }; // for the console / screenshots

  // ---------------------------------------------------------------- flat kit: chunked world-space soups
  const soups = new Map();
  const soup = (x, z) => { const k = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`; let s = soups.get(k); if (!s) soups.set(k, s = new Soup()); return s; };
  const uvOf = (name, u, v) => { const r = AT[name]; return [r[0] + u * r[2], r[1] + v * r[3]]; };
  /** a flat rectangle (centre, yaw = along-axis heading (dx,dz), length along, width across), texture `name` */
  const rect = (name, x, y, z, dx, dz, len, wid, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
    const S = soup(x, z), rx = -dz, rz = dx, hl = len / 2, hw = wid / 2;
    const c = [[-hl, -hw, u0, v0], [hl, -hw, u1, v0], [hl, hw, u1, v1], [-hl, hw, u0, v1]].map(([a, b, u, v]) => { const [uu, vv] = uvOf(name, u, v); return S.v(x + dx * a + rx * b, y, z + dz * a + rz * b, 0, 1, 0, uu, vv); });
    S.quad(c[0], c[3], c[2], c[1]);
  };
  /** a flat disc (radius r), planar-mapped to the square texture `name` (the disc fills it) */
  const disc = (name, x, y, z, r, rot, seg = 20, inner = 0, scale = 1) => {
    const S = soup(x, z), ring = [], ringI = [];
    const ctr = S.v(x, y, z, 0, 1, 0, ...uvOf(name, 0.5, 0.5));
    for (let k = 0; k <= seg; k++) {
      const a = rot + k / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      ring.push(S.v(x + ca * r, y, z + sa * r, 0, 1, 0, ...uvOf(name, 0.5 + Math.cos(k / seg * Math.PI * 2) * 0.5 * scale, 0.5 + Math.sin(k / seg * Math.PI * 2) * 0.5 * scale)));
      if (inner) ringI.push(S.v(x + ca * inner, y, z + sa * inner, 0, 1, 0, ...uvOf(name, 0.5 + Math.cos(k / seg * Math.PI * 2) * 0.5 * scale * inner / r, 0.5 + Math.sin(k / seg * Math.PI * 2) * 0.5 * scale * inner / r)));
    }
    for (let k = 0; k < seg; k++) { if (inner) S.quad(ringI[k], ringI[k + 1], ring[k + 1], ring[k]); else S.i.push(ctr, ring[k + 1], ring[k]); }
  };
  const ROADY = 0.056, WALKY = 0.174; // just above the road surface (0.05) / the paving (0.17): polygon offset does the rest

  // ---------------------------------------------------------------- instanced kit (props + scanned manholes)
  const inst = []; // { g: geometry name, lod1, x, y, z, yaw, tilt, s, col, cull }
  const put = (g, x, y, z, yaw, s = 1, extra = {}) => inst.push({ g, x, y, z, yaw, s, ...extra });

  // ---------------------------------------------------------------- hide / thin the engine's own kinds
  const F = props && props.furniture, types = props && props.F ? [...props.F.types.entries()] : [];
  const engineAt = {}; // type -> [{x,y,z,yaw}]
  if (F) {
    let k = 0;
    for (const [type, list] of types) {
      engineAt[type] = list;
      for (let i = 0; i < list.length; i++, k++) {
        const hide = type === 'hydrant' || type === 'trashCan' || type === 'meter';
        if (!hide) continue;
        F.r2[k] = -1; F.vis[k] = 0; F.mesh.setVisibleAt(F.ids[k], false);
        if (type === 'meter') { list[i]._hidden = true; counts.metersHidden++; }
      }
    }
  }
  // the engine's road decals (manholes, storm drains): this kit's covers and grates take their place
  const engineManholes = [];
  if (props && props.decalMesh) {
    const m0 = new THREE.Matrix4().makeScale(0, 0, 0);
    props.decals.forEach((d, i) => { if (d.a === 'manhole' || d.a === 'drain') { props.decalMesh.setMatrixAt(i, m0); if (d.a === 'manhole') engineManholes.push(d); } });
    props.decalMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- road insets
  const manhole = (x, z, inRoad) => {
    if (!inArea(x, z)) return;
    const y = inRoad ? ROADY : WALKY, k = R(), rot = R() * 6.283;
    if (R() < 0.55) disc('ring', x, y - 0.001, z, 0.62 + R() * 0.12, rot, 22, 0.36, 1); // saw-cut patch ring of newer asphalt
    if (k < 0.45) put('manhole', x, gy(x, z) - 0.012, z, rot, 1.1, { flat: true, col: 0.5 });
    else disc(k < 0.8 ? 'mh_con' : 'mh_grid', x, y + 0.001, z, 0.39, rot, 24, 0, 0.98);
    counts.manholes++;
  };
  for (const d of engineManholes) manhole(d.x, d.z, isRoad(d.x, d.z));

  const along = (Rd, s, lat) => { const [x, z, dx, dz] = samplePolyline(Rd.pts, Rd.pp, Math.max(0, Math.min(Rd.pp.L, s))); return { x: x - dz * lat, z: z + dx * lat, dx, dz }; };
  const nearInt = (Rd, s, pad) => Rd.ints.some((it) => Math.abs(it.s - s) < Math.abs(it.r) + pad);
  const COMMERCIAL = /^(primary|secondary|tertiary|unclassified|trunk)$/;
  const kerbHit = new Grid(2);

  for (const Rd of net.list) {
    const st = Rd.st;
    if (!Rd || Rd.filler || Rd.bridge || st.minor || !Rd.pp || Rd.pp.L < 8) continue;
    const L = Rd.pp.L, hw = st.hw, swW = st.sidewalk || 0, commercial = COMMERCIAL.test(st.base);
    const mid = along(Rd, L / 2, 0);
    if (!inArea(mid.x, mid.z) && (Rd.pts[0][0] - C.x) ** 2 + (Rd.pts[0][1] - C.z) ** 2 > RAD2) continue;

    // ---- manholes down the lanes, valve boxes, road plates
    if (hw > 2.5) {
      for (let s = 10 + R() * 30; s < L - 6; s += 30 + R() * 40) {
        if (nearInt(Rd, s, 1.5)) continue;
        const lane = (Math.floor(R() * Math.max(1, st.lanes)) + 0.5) / Math.max(1, st.lanes);
        const p = along(Rd, s, (lane * 2 - 1) * (hw - st.parkW - 0.6));
        if (isRoad(p.x, p.z)) manhole(p.x, p.z, true);
      }
      for (let s = 6 + R() * 20; s < L - 4; s += 25 + R() * 35) {
        const side = R() < 0.5 ? -1 : 1, p = along(Rd, s, side * (hw - 0.9 - R() * 1.5));
        if (isRoad(p.x, p.z) && inArea(p.x, p.z)) { disc('valve', p.x, ROADY + 0.001, p.z, 0.13, R() * 6.28, 12, 0, 0.98); counts.valves++; }
      }
      if (/^(primary|secondary|trunk)$/.test(st.base)) for (let s = 30 + R() * 80; s < L - 20; s += 90 + R() * 120) {
        if (R() > (desk ? 0.45 : 0.3) || nearInt(Rd, s, 6)) continue;
        const lane = Math.floor(R() * Math.max(1, st.lanes));
        const p = along(Rd, s, ((lane + 0.5) / Math.max(1, st.lanes) * 2 - 1) * (hw - st.parkW - 0.4));
        if (!isRoad(p.x, p.z) || !inArea(p.x, p.z)) continue;
        // steel plate over a trench: raised 2.5 cm on a ramp of cold patch
        const len = 1.5, wid = 2.4, H = 0.025, ex = 0.14, y0 = ROADY, y1 = ROADY + H, S = soup(p.x, p.z);
        const ax = p.dx, az = p.dz, bx = -p.dz, bz = p.dx;
        const P2 = (a, b, y, name, u, v) => S.v(p.x + ax * a + bx * b, y, p.z + az * a + bz * b, 0, 1, 0, ...uvOf(name, u, v));
        const t = [P2(-len / 2, -wid / 2, y1, 'plate', 0, 0), P2(len / 2, -wid / 2, y1, 'plate', 1, 0), P2(len / 2, wid / 2, y1, 'plate', 1, 1), P2(-len / 2, wid / 2, y1, 'plate', 0, 1)];
        S.quad(t[0], t[3], t[2], t[1]);
        const o = [[-len / 2 - ex, -wid / 2 - ex], [len / 2 + ex, -wid / 2 - ex], [len / 2 + ex, wid / 2 + ex], [-len / 2 - ex, wid / 2 + ex]];
        const ic = [[-len / 2, -wid / 2], [len / 2, -wid / 2], [len / 2, wid / 2], [-len / 2, wid / 2]];
        for (let e = 0; e < 4; e++) { // ramps (dark patch asphalt)
          const a = P2(ic[e][0], ic[e][1], y1, 'ring', 0.1 + 0.2 * e, 0.3), b = P2(ic[(e + 1) % 4][0], ic[(e + 1) % 4][1], y1, 'ring', 0.3 + 0.2 * e, 0.3);
          const c = P2(o[(e + 1) % 4][0], o[(e + 1) % 4][1], y0, 'ring', 0.3 + 0.2 * e, 0.5), d = P2(o[e][0], o[e][1], y0, 'ring', 0.1 + 0.2 * e, 0.5);
          S.quad(a, d, c, b);
        }
        counts.plates++;
      }
    }

    // ---- per side: kerb stones, catch basins, sidewalk insets, garbage piles
    if (!swW) continue;
    for (const side of [-1, 1]) {
      const kerbAt = (s) => {
        const a = along(Rd, s, side * (hw + 0.15)), b = along(Rd, s, side * (hw + 0.6)), c = along(Rd, s, side * (hw - 0.35));
        return sw(a.x, a.z) && sw(b.x, b.z) && !sw(c.x, c.z) && isRoad(c.x, c.z);
      };
      // granite kerb stones over the engine kerb (straight runs only, not inside junction boxes)
      for (let s = 0.5; s < L - 1.3;) {
        const len = 1.2 + R() * 1.2, s1 = Math.min(L - 0.3, s + len);
        if (s1 - s < 0.6 || nearInt(Rd, s, 2.2) || nearInt(Rd, s1, 2.2) || !kerbAt(s) || !kerbAt(s1) || !kerbAt((s + s1) / 2)) { s += 0.6; continue; }
        const pa = along(Rd, s, side * hw), pb = along(Rd, s1, side * hw), mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2;
        if (kerbHit.near(mx, mz, 0.5) || !inArea(mx, mz)) { s = s1; continue; }
        kerbHit.add(mx, mz);
        kerbStone(soup(mx, mz), Rd, s + 0.004, s1 - 0.004, side, hw, R() < 0.5 ? 'kerb' : 'kerb2', R() * 0.25, (R() - 0.5) * 0.004);
        counts.kerbStones++;
        s = s1;
      }
      // catch basins in the gutter before each corner (+ a kerb inlet throat: dark slot in the kerb face)
      for (const it of Rd.ints) for (const dirS of [-1, 1]) {
        if (R() > 0.65) continue;
        const s = it.s + dirS * (Math.abs(it.r) + 6 + R() * 3);
        if (s < 2 || s > L - 2 || !kerbAt(s)) continue;
        const p = along(Rd, s, side * (hw - 0.28));
        if (!isRoad(p.x, p.z) || !inArea(p.x, p.z)) continue;
        rect('grate', p.x, ROADY + 0.001, p.z, p.dx, p.dz, 0.95, 0.5);
        counts.grates++;
      }
      // sidewalk: vault doors and hatches near the frontage, valve boxes by the kerb
      for (let s = 8 + R() * 20; s < L - 8; s += 18 + R() * 30) {
        if (nearInt(Rd, s, 3)) continue;
        const r = R();
        if (commercial && r < 0.32) {
          const p = along(Rd, s, side * (hw + swW - 0.75));
          const ok = [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].every(([a, b]) => sw(p.x + p.dx * a - p.dz * b, p.z + p.dz * a + p.dx * b) && !isBld(p.x + p.dx * a - p.dz * b, p.z + p.dz * a + p.dx * b));
          if (ok && !busy(p.x, p.z, 1.3) && inArea(p.x, p.z)) { rect('vault', p.x, WALKY, p.z, p.dx, p.dz, 1.9, 0.95); counts.vaults++; }
        } else if (r < 0.5) {
          const p = along(Rd, s, side * (hw + 0.9 + R() * Math.max(0.2, swW - 1.6)));
          if (sw(p.x, p.z) && !busy(p.x, p.z, 0.7) && inArea(p.x, p.z)) { rect('hatch', p.x, WALKY, p.z, p.dx, p.dz, 0.62, 0.62); counts.hatches++; }
        } else if (r < 0.75) {
          const p = along(Rd, s, side * (hw + 0.55));
          if (sw(p.x, p.z) && !busy(p.x, p.z, 0.4) && inArea(p.x, p.z)) { disc('valve', p.x, WALKY, p.z, 0.12, R() * 6.28, 12, 0, 0.98); counts.valves++; }
        }
      }
      // garbage at the kerb: black and clear bags in a heap, now and then a crate or flattened cardboard
      if (commercial || st.base === 'residential') for (let s = 12 + R() * 30; s < L - 10; s += 26 + R() * 40) {
        if (R() > (desk ? 0.5 : 0.28) || nearInt(Rd, s, 4)) continue;
        const p = along(Rd, s, side * (hw + 0.62 + R() * 0.25));
        if (!sw(p.x, p.z) || busy(p.x, p.z, 1.6) || !kerbAt(s) || !inArea(p.x, p.z)) continue;
        pile(p, side, s);
      }
      // trash cans at the corners (NYC: one per corner on most avenues)
      for (const it of Rd.ints) {
        if (R() > (desk ? 0.4 : 0.25)) continue;
        const dS = (R() < 0.5 ? -1 : 1) * (Math.abs(it.r) + 3.5 + R() * 2);
        const p = along(Rd, it.s + dS, side * (hw + 0.6));
        if (it.s + dS < 1 || it.s + dS > L - 1 || !sw(p.x, p.z) || busy(p.x, p.z, 1.2) || !inArea(p.x, p.z)) continue;
        can(p.x, p.z, R() * 6.28, true);
      }
    }
  }

  function kerbStone(S, Rd, s0, s1, side, hw, name, uOff, dy) {
    // profile (lateral l from the road edge, outward; y): face 3.5 cm proud of the engine kerb, a rounded arris that
    // encloses the engine's hard corner, then the top 5 mm above the paving
    const prof = [[-0.035, 0.044, 0.94], [-0.035, 0.125, 0.74]];
    for (let k = 1; k <= 4; k++) { const a = Math.PI - k / 4 * Math.PI / 2; prof.push([0.015 + Math.cos(a) * 0.05, 0.125 + Math.sin(a) * 0.05, 0.74 - k * 0.03]); }
    prof.push([0.30, 0.175, 0.0]);
    const ends = [s0, s1].map((s) => { const [x, z, dx, dz] = samplePolyline(Rd.pts, Rd.pp, s); return { x, z, nx: -dz * side, nz: dx * side }; });
    const rows = ends.map((e, ei) => prof.map(([l, y, v], pi) => {
      // normal of the profile: face -> outward (toward the road), arc -> radial, top -> up
      let nl, ny;
      if (pi < 2) { nl = -1; ny = 0; } else if (pi < prof.length - 1) { const a = Math.PI - (pi - 1) / 4 * Math.PI / 2; nl = Math.cos(a); ny = Math.sin(a); } else { nl = 0; ny = 1; }
      const X = e.x + e.nx * (hw + l), Z = e.z + e.nz * (hw + l), Y = base(X, Z) + y + (y > 0.1 ? dy : 0);
      return S.v(X, Y, Z, e.nx * nl, ny, e.nz * nl, ...uvOf(name, uOff + ei * 0.75, v));
    }));
    for (let k = 0; k < prof.length - 1; k++) {
      // orientation: quads wound so the outward side is front-facing
      if (side > 0) S.quad(rows[0][k], rows[1][k], rows[1][k + 1], rows[0][k + 1]); else S.quad(rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]);
    }
    // the joint at the start: a dark 8 mm strip over the face, the arris and the top (the grate's black void)
    {
      const e = ends[0], tx = e.nz, tz = -e.nx, [ju, jv] = uvOf('grate', 0.5, 0.3);
      const pts = [prof[0], prof[1], prof[3], prof[5], prof[6]].map(([l, y]) => { const X = e.x + e.nx * (hw + l), Z = e.z + e.nz * (hw + l); return [X, base(X, Z) + y + 0.0008, Z]; });
      const ns = [[-e.nx, 0, -e.nz], [-e.nx, 0, -e.nz], [-e.nx * 0.7, 0.7, -e.nz * 0.7], [0, 1, 0], [0, 1, 0]];
      const row = (o) => pts.map(([X, Y, Z], i) => S.v(X + tx * o, Y, Z + tz * o, ...ns[i], ju, jv));
      const a = row(-0.004), b = row(0.004);
      for (let k = 0; k < pts.length - 1; k++) { if (side > 0) S.quad(a[k], b[k], b[k + 1], a[k + 1]); else S.quad(a[k], a[k + 1], b[k + 1], b[k]); }
    }
  }

  function pile(p, side, s) {
    const n = 3 + Math.floor(R() * (desk ? 7 : 4));
    const ox = -p.dz * side, oz = p.dx * side; // toward the buildings
    for (let i = 0; i < n; i++) {
      const a = (R() - 0.5) * 2.2, b = (R() - 0.5) * 0.7;
      const x = p.x + p.dx * a + ox * b, z = p.z + p.dz * a + oz * b;
      const onTop = i > 3 && R() < 0.6;
      const clear = R() < 0.28;
      put(clear ? 'bagclear' : 'bag', x, gy(x, z) + (onTop ? 0.28 : -0.01), z, R() * 6.28, 0.85 + R() * 0.4, { tilt: (R() - 0.5) * (onTop ? 0.7 : 0.25), roll: (R() - 0.5) * 0.3, col: clear ? null : 0.75 + R() * 0.4 });
      counts.bags++;
    }
    const r = R();
    if (r < 0.3) { const a = (R() - 0.5) * 2, x = p.x + p.dx * a + ox * 0.5, z = p.z + p.dz * a + oz * 0.5; put('crate', x, gy(x, z), z, R() * 6.28, 1); if (R() < 0.5) put('crate', x, gy(x, z) + 0.255, z, R() * 6.28, 1); }
    else if (r < 0.55) { const a = (R() - 0.5) * 2, x = p.x + p.dx * a + ox * 0.45, z = p.z + p.dz * a + oz * 0.45; put('box', x, gy(x, z), z, R() * 6.28, 0.9 + R() * 0.3, { tilt: (R() - 0.5) * 0.2 }); }
    blobs.push([p.x + ox * 0.05, gy(p.x, p.z), p.z + oz * 0.05, Math.atan2(p.dx, p.dz), 1.5, 3.2, 0.95]);
    mine.add(p.x, p.z); mine.add(p.x + p.dx, p.z + p.dz); mine.add(p.x - p.dx, p.z - p.dz);
    const y = gy(p.x, p.z);
    world.colliders.add(p.x - Math.abs(p.dx) * 1.1 - Math.abs(p.dz) * 0.4, y - 0.2, p.x + Math.abs(p.dx) * 1.1 + Math.abs(p.dz) * 0.4, y + 0.55, p.z - Math.abs(p.dz) * 1.1 - Math.abs(p.dx) * 0.4, p.z + Math.abs(p.dz) * 1.1 + Math.abs(p.dx) * 0.4, 3);
    counts.piles++; spots.piles.push([p.x, p.z]);
  }
  function can(x, z, yaw, collide) {
    put(R() < 0.55 ? 'can_rust' : 'can', x, gy(x, z), z, yaw, 0.95 + R() * 0.1);
    blobs.push([x, gy(x, z), z, 0, 0.95, 0.95, 0.9]);
    mine.add(x, z);
    if (collide) { const y = gy(x, z); world.colliders.add(x - 0.3, y - 0.2, x + 0.3, y + 0.92, z - 0.3, z + 0.3, 3); }
    counts.cans++;
  }

  // ---------------------------------------------------------------- the engine's hydrant and bin spots (colliders kept)
  for (const h of engineAt.hydrant || []) { put(R() < 0.6 ? 'hydrant_aged' : 'hydrant', h.x, h.y, h.z, h.yaw + Math.PI / 2, 1.08); blobs.push([h.x, h.y, h.z, 0, 0.95, 0.95, 1]); mine.add(h.x, h.z); counts.hydrants++; spots.hydrants.push([h.x, h.z]); }
  for (const h of engineAt.trashCan || []) can(h.x, h.z, h.yaw, false);

  // ---------------------------------------------------------------- tree pits (every sidewalk tree trunk)
  const seg = (x, z, r) => { let best = null, bd = r * r; net.segHash.forEachNear(x, z, r, (sg) => { if (!sg.road || sg.road.st.minor) return; const dx = sg.bx - sg.ax, dz = sg.bz - sg.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - sg.ax) * dx + (z - sg.az) * dz) / L2)), d = (sg.ax + dx * t - x) ** 2 + (sg.az + dz * t - z) ** 2; if (d < bd) { bd = d; best = sg; } }); return best; };
  for (const b of world.colliders.boxes || []) {
    if (b.kind !== 2) continue;
    const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2;
    if (!sw(x, z) || !inArea(x, z)) continue;
    const sg = seg(x, z, 14); if (!sg) continue;
    const L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az) || 1, dx = (sg.bx - sg.ax) / L, dz = (sg.bz - sg.az) / L;
    const k = R();
    if (k < 0.4) rect('treegrate', x, WALKY, z, dx, dz, 1.5, 1.5);
    else if (k < 0.75) { rect('soil', x, WALKY, z, dx, dz, 1.7, 1.15); pitEdge(x, z, dx, dz, 1.7, 1.15); }
    else { rect('cobble', x, WALKY, z, dx, dz, 1.8, 1.25, 0, 1.5, 0, 1); rect('soil', x, WALKY + 0.002, z, dx, dz, 0.8, 0.6); pitEdge(x, z, dx, dz, 1.8, 1.25); }
    counts.pits++;
  }

  // a steel angle edging round an open pit: four thin strips, 1 cm proud
  function pitEdge(x, z, dx, dz, len, wid) {
    const e = 0.05, rx = -dz, rz = dx;
    rect('plate', x + dx * (len / 2), WALKY + 0.008, z + dz * (len / 2), -dz, dx, wid + e, e, 0.1, 0.9, 0.45, 0.5);
    rect('plate', x - dx * (len / 2), WALKY + 0.008, z - dz * (len / 2), -dz, dx, wid + e, e, 0.1, 0.9, 0.5, 0.55);
    rect('plate', x + rx * (wid / 2), WALKY + 0.008, z + rz * (wid / 2), dx, dz, len + e, e, 0.1, 0.9, 0.55, 0.6);
    rect('plate', x - rx * (wid / 2), WALKY + 0.008, z - rz * (wid / 2), dx, dz, len + e, e, 0.1, 0.9, 0.6, 0.65);
  }

  // ---------------------------------------------------------------- Jersey barriers across the pedestrian plaza ends
  for (const Rd of net.list) {
    if (!Rd || Rd.filler || Rd.st.cls !== 'pedestrian' || !Rd.pp || Rd.pp.L < 6) continue;
    for (const s of [1.6, Rd.pp.L - 1.6]) {
      const p = along(Rd, s, 0);
      if (!inArea(p.x, p.z)) continue;
      let traffic = false;
      net.segHash.forEachNear(p.x, p.z, 7, (sg) => { if (sg.road && sg.road !== Rd && !sg.road.st.minor && sg.road.st.drivable && sg.road.st.base !== 'service') traffic = true; });
      if (!traffic) continue;
      const W = Math.min(Rd.st.hw, 9), n = Math.max(2, Math.round((W * 2) / 2.4));
      for (let i = 0; i < n; i++) {
        if (R() < 0.15) continue; // a gap here and there
        const lat = (i + 0.5 - n / 2) * 2.4, q = along(Rd, s, lat);
        if (busy(q.x, q.z, 0.9)) continue;
        const yaw = Math.atan2(-q.dz, q.dx) + Math.PI / 2 + (R() - 0.5) * 0.12;
        put('barrier', q.x, gy(q.x, q.z), q.z, yaw, 1);
        blobs.push([q.x, gy(q.x, q.z), q.z, yaw, 2.1, 0.75, 1]);
        const y = gy(q.x, q.z), ex = Math.abs(Math.cos(yaw)) * 0.8 + 0.25, ez = Math.abs(Math.sin(yaw)) * 0.8 + 0.25;
        world.colliders.add(q.x - ex, y - 0.2, q.x + ex, y + 1.1, q.z - ez, q.z + ez, 3);
        mine.add(q.x, q.z); counts.barriers++;
      }
    }
  }

  // ---------------------------------------------------------------- signal controller boxes by a corner pole
  const done = new Grid(16);
  for (const pp of (props && props._sigPolePts) || []) {
    const [x, z] = pp;
    if (done.near(x, z, 22) || R() > 0.7 || !inArea(x, z)) continue;
    const sg = seg(x, z, 20); if (!sg) continue;
    const L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az) || 1, dx = (sg.bx - sg.ax) / L, dz = (sg.bz - sg.az) / L;
    let nx = -dz, nz = dx; if ((x - sg.ax) * nx + (z - sg.az) * nz < 0) { nx = -nx; nz = -nz; }
    const bx = x + nx * 0.9 + dx * 0.7, bz = z + nz * 0.9 + dz * 0.7;
    if (!sw(bx, bz) || isBld(bx, bz) || busy(bx, bz, 0.7)) continue;
    const yaw = Math.atan2(nx, nz) + Math.PI;
    put('ubox', bx, gy(bx, bz), bz, yaw, 1.05);
    blobs.push([bx, gy(bx, bz), bz, yaw, 0.85, 0.75, 1]);
    const y = gy(bx, bz); world.colliders.add(bx - 0.32, y - 0.2, bx + 0.32, y + 1.18, bz - 0.32, bz + 0.32, 3);
    mine.add(bx, bz); done.add(x, z); counts.boxes++; spots.boxes.push([bx, bz]);
  }

  // ---------------------------------------------------------------- contact shadows for the engine's kept furniture + parked cars
  const BLOB = { meter: [0.45, 0.45, 0.8], mailbox: [0.9, 0.9, 0.9], newsBox: [0.9, 0.8, 0.85], bench: [2.0, 0.9, 0.8], bikeRack: [1.2, 0.5, 0.5],
    planter: [1.5, 1.0, 0.85], signPost: [0.35, 0.35, 0.7], cobra: [0.6, 0.6, 0.8], cobraRes: [0.55, 0.55, 0.8], mastPole: [0.7, 0.7, 0.85], pedPole: [0.5, 0.5, 0.8],
    acorn: [0.6, 0.6, 0.8], bollard: [0.4, 0.4, 0.8], aframe: [0.8, 0.6, 0.7], pot: [0.8, 0.8, 0.85], cafeSet: [1.6, 1.6, 0.6], shelter: [3.6, 1.8, 0.55], utilityPole: [0.6, 0.6, 0.8] };
  for (const [type, list] of types) {
    const b = BLOB[type]; if (!b) continue;
    for (const it of list) { if (it._hidden || !inArea(it.x, it.z)) continue; blobs.push([it.x, it.y, it.z, it.yaw || 0, b[0], b[1], b[2]]); }
  }
  if (props && props.parked) {
    const P = props.parked, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < P.ids.length; i++) {
      if (!inArea(P.x[i], P.z[i])) continue;
      P.mesh.getMatrixAt(P.ids[i], m4); m4.decompose(v, q, sc); e.setFromQuaternion(q, 'YXZ');
      blobs.push([P.x[i], gy(P.x[i], P.z[i]), P.z[i], e.y, 2.5, 5.6, 0.95]);
    }
  }

  // ---------------------------------------------------------------- one BatchedMesh: props (2 LODs), scanned manholes, flat chunks
  const mat = new THREE.MeshStandardMaterial({
    map: diff, normalMap: nor, roughnessMap: arm, metalnessMap: arm, aoMap: arm, aoMapIntensity: 0.9,
    roughness: 0.85, metalness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
  mat.normalScale.set(1, -1); // atlas normals are OpenGL (green up) in an image-space (v down) uv set
  const chunkList = [...soups.entries()].map(([k, s]) => ({ k, g: s.geometry() }));
  const geoms = new Map();
  let maxV = 0, maxI = 0;
  const need = new Set(inst.map((i) => i.g));
  for (const n of need) { for (const g of [geo[n], geo[`${n}_lod1`]]) if (g) { maxV += g.attributes.position.count; maxI += g.index.count; } }
  for (const c of chunkList) { maxV += c.g.attributes.position.count; maxI += c.g.index.count; }
  const nInst = inst.length + chunkList.length;
  const bm = new THREE.BatchedMesh(nInst, maxV, maxI, mat);
  bm.name = 'nyc-street-kit';
  const gid = (n) => { if (!geoms.has(n)) geoms.set(n, geo[n] ? bm.addGeometry(geo[n]) : -1); return geoms.get(n); };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), col = new THREE.Color();
  const cx = new Float32Array(nInst), cz = new Float32Array(nInst), cy = new Float32Array(nInst), far2 = new Float32Array(nInst), lod2 = new Float32Array(nInst);
  const ids = new Int32Array(nInst), g0 = new Int32Array(nInst), g1 = new Int32Array(nInst), st = new Int8Array(nInst).fill(9);
  const PROP_FAR = desk ? 170 : 95, LOD_DIST = desk ? 22 : 12, FLAT_FAR = desk ? 115 : 75, MH_FAR = desk ? 110 : 60;
  let k = 0, tris = 0;
  for (const it of inst) {
    const a = gid(it.g); if (a < 0) continue;
    const b = geo[`${it.g}_lod1`] ? gid(`${it.g}_lod1`) : a;
    const id = bm.addInstance(a);
    q.setFromEuler(e.set(it.tilt || 0, it.yaw, it.roll || 0, 'YXZ'));
    bm.setMatrixAt(id, m4.compose(P.set(it.x, it.y, it.z), q, Sc.setScalar(it.s)));
    if (it.col) bm.setColorAt(id, col.setRGB(it.col, it.col, it.col));
    ids[k] = id; g0[k] = a; g1[k] = b; cx[k] = it.x; cy[k] = it.y; cz[k] = it.z;
    far2[k] = (it.flat ? MH_FAR : PROP_FAR) ** 2; lod2[k] = it.flat ? 1e12 : LOD_DIST ** 2;
    tris += geo[it.g].index.count / 3; k++;
  }
  for (const c of chunkList) {
    const id = bm.addInstance(bm.addGeometry(c.g));
    bm.setMatrixAt(id, m4.identity());
    const bs = c.g.boundingSphere;
    ids[k] = id; g0[k] = g1[k] = -1; cx[k] = bs.center.x; cy[k] = bs.center.y; cz[k] = bs.center.z; far2[k] = (FLAT_FAR + bs.radius) ** 2; lod2[k] = 1e12;
    tris += c.g.index.count / 3; k++;
  }
  const n = k;
  // the batch holds its own copy of every geometry: drop the build-time soups and sources (JS heap)
  for (const c of chunkList) c.g.dispose();
  for (const g of Object.values(geo)) g.dispose();
  chunkList.length = 0; soups.clear();
  bm.perObjectFrustumCulled = true; bm.sortObjects = false; bm.frustumCulled = false;
  bm.castShadow = false; bm.receiveShadow = true;
  scene.add(bm);
  counts.instances = inst.length; counts.chunks = n - inst.length; counts.trisAll = Math.round(tris); inst.length = 0;

  // ---------------------------------------------------------------- contact shadows (one instanced quad per blob)
  let shadows = null;
  if (blobs.length) {
    const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.3, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.65, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const bt = new THREE.CanvasTexture(c);
    const sm = new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), sm, blobs.length);
    blobs.forEach(([x, y, z, yaw, sx, sz, kk], i) => { q.setFromAxisAngle(P.set(0, 1, 0), yaw); shadows.setMatrixAt(i, m4.compose(P.set(x, y + 0.012, z), q, Sc.set(sx * kk, 1, sz * kk))); }); // k: a weaker blob is a smaller one
    shadows.instanceMatrix.needsUpdate = true; shadows.computeBoundingSphere();
    shadows.name = 'nyc-street-contact-shadows'; shadows.renderOrder = 1; shadows.castShadow = false; shadows.receiveShadow = false;
    scene.add(shadows);
    counts.shadows = blobs.length;
    blobs.length = 0;
  }

  // ---------------------------------------------------------------- distance culling + LOD (throttled)
  // runs from the batch's own onBeforeRender (live frames and the bench harness's held frames alike): a full pass at
  // most every 0.4 s, or at once after the camera moved 5 m
  const last = new THREE.Vector3(1e9, 0, 0);
  let lastT = -1e9;
  const update = (cam, force = false) => {
    const now = performance.now();
    if (!force && now - lastT < 400 && last.distanceToSquared(cam) < 25) return;
    lastT = now; last.copy(cam);
    for (let i = 0; i < n; i++) {
      const d2 = (cx[i] - cam.x) ** 2 + (cy[i] - cam.y) ** 2 + (cz[i] - cam.z) ** 2;
      const s = d2 > far2[i] ? -1 : d2 > lod2[i] ? 1 : 0;
      if (s === st[i]) continue;
      if (s < 0) bm.setVisibleAt(ids[i], false);
      else {
        if (st[i] < 0 || st[i] === 9) bm.setVisibleAt(ids[i], true);
        if (g0[i] >= 0) bm.setGeometryIdAt(ids[i], s === 0 ? g0[i] : g1[i]);
      }
      st[i] = s;
    }
  };
  const own = bm.onBeforeRender;
  bm.onBeforeRender = function (renderer, scn, camera, ...rest) { update(camera.position); return own.call(this, renderer, scn, camera, ...rest); };
  console.info('[street] kit', counts);
  return { update, mesh: bm, shadows, counts, spots, material: mat };
}
