// The Dune Road: a two-lane coastal road built along the back of the beach (between Lummus Park's palms and the
// dunes), the setting of the hero shot. It follows the beach line from South Beach's southern blocks to the north
// end of Ocean Drive's park, rolls over low crests (one just ahead of the start, so the road meets the afterglow at
// the vanishing point), and has natural edges instead of kerbs: dry worn asphalt with a double yellow line and no
// edge line, gravel / coral-rock shoulders with real stones, a cut bank and scrub on the park side, a dune bank with
// grass and coral-rock outcrops on the sea side, palms and sea-grape scrub as silhouettes against the glow, and a
// single street lamp near the first crest.
//
//   const road = buildDuneRoad({ rows, sandHeight, lod, asphalt, seed });   // rows: the beach rows (world.js)
//   road.group (meshes), road.heightAt(x, z) (-Infinity off the road corridor), road.surfaceAt(x, z) -> 'road' |
//   'gravel' | null, road.start(back) -> { x, z, heading } (on the northbound lane, `back` m before the first crest),
//   road.colliders (boxes for the big rocks), road.lamp ({ x, y, z })
// World frame (x east, z south); the road runs north (towards -z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LANE = 3.35, HALF = 3.6, SHOULDER = 5.4;   // half width of the asphalt (with 25 cm of edge), gravel to 5.4 m
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const vnoise = (x) => { const i = Math.floor(x), f = x - i, h = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; };

export function buildDuneRoad(o) {
  const rows = o.rows, r = rnd(o.seed ?? 911), low = o.lod === 'low';
  // ---- the centre line: the back of the beach + 30 m (clear of the park trees), smoothed over +-40 m, sampled every 4 m along z
  const zs = rows.map((R) => R.z), z0 = Math.min(...zs) + 60, z1 = Math.max(...zs) - 60;
  const STEP = 4, N = Math.floor((z1 - z0) / STEP) + 1;
  const X = new Float64Array(N);
  const rowAt = (z) => { let best = rows[0]; for (const R of rows) if (Math.abs(R.z - z) < Math.abs(best.z - z)) best = R; return best; };
  const raw = new Float64Array(N);
  for (let i = 0; i < N; i++) raw[i] = rowAt(z0 + i * STEP).x0 + (o.offset ?? 30);
  for (let i = 0; i < N; i++) { let s = 0, n = 0; for (let k = -10; k <= 10; k++) { const j = i + k; if (j >= 0 && j < N) { s += raw[j]; n++; } } X[i] = s / n; }
  const xAt = (z) => { const f = Math.min(N - 1.001, Math.max(0, (z - z0) / STEP)), i = Math.floor(f), t = f - i; return X[i] * (1 - t) + X[i + 1] * t; };
  const slope = (z) => (xAt(z + 2) - xAt(z - 2)) / 4; // dx / dz
  // ---- the vertical profile: the sand level + 0.35 m, a 2.4 m crest at zCrest, gentle rolls elsewhere
  const mid = (z0 + z1) / 2;
  const zCrest = o.crestZ ?? mid;
  const rolls = [[zCrest, 2.5, 46], [zCrest - 260, 1.1, 55], [zCrest + 240, 0.9, 60], [zCrest - 520, 1.4, 70], [zCrest + 470, 1.0, 50]];
  const base = (z) => 0.38 + 0.15 * Math.sin(z * 0.013);
  const roadY = (z) => { let h = base(z); for (const [c, a, s] of rolls) h += a * Math.exp(-(((z - c) / s) ** 2)); return h; };
  const duneH = (z) => 1.8 + 1.2 * vnoise(z * 0.018) + 0.6 * vnoise(z * 0.07 + 3);
  // lateral position (m, + = east) and height of the corridor
  const lateral = (x, z) => (x - xAt(z)) / Math.sqrt(1 + slope(z) ** 2);
  const sandAt = (x, z) => { const v = o.sandHeight(x, z); return Number.isFinite(v) ? v : 0.1; };
  const heightAt = (x, z) => {
    if (z < z0 || z > z1) return -Infinity;
    const d = lateral(x, z);
    if (d < -16 || d > 30) return -Infinity;
    const ry = roadY(z);
    if (Math.abs(d) <= HALF) return ry + 0.03 * (1 - (d / HALF) ** 2); // crowned
    if (Math.abs(d) <= SHOULDER) return ry - 0.06 * (Math.abs(d) - HALF) / (SHOULDER - HALF);
    const sand = sandAt(x, z);
    if (d < 0) { const t = smooth(-SHOULDER, -15, d); return ry - 0.06 + (sand - ry) * t + 0.45 * Math.sin(Math.PI * t) * smooth(-SHOULDER, -8, d); } // the cut bank
    // the dune: up from the shoulder to the crest 9-13 m out, down to the sand by 30 m
    const H = Math.max(ry + 0.4, sand + duneH(z));
    const up = smooth(SHOULDER, 11, d), down = 1 - smooth(14, 30, d);
    return Math.max(sand, (ry - 0.06) * (1 - up) + H * up * down + sand * up * (1 - down));
  };
  const surfaceAt = (x, z) => { if (z < z0 || z > z1) return null; const d = Math.abs(lateral(x, z)); return d <= HALF ? 'road' : d <= SHOULDER + 0.8 ? 'gravel' : null; };

  const group = new THREE.Group(); group.name = 'dune-road';
  // ---- the corridor surface: one grid from -16 to +30 m (road, shoulders, bank, dune), vertex-coloured per zone
  const cols = [-16, -13, -10, -8, -6.6, -SHOULDER, -HALF, -LANE, -1.7, 0, 1.7, LANE, HALF, SHOULDER, 6.6, 8, 10, 12, 14, 17, 20, 24, 30];
  const rowsN = Math.floor((z1 - z0) / 2) + 1;
  const pos = [], col = [], uv = [], zone = [], idx = [];
  for (let j = 0; j < rowsN; j++) {
    const z = z0 + j * 2, xc = xAt(z), sl = slope(z), inv = 1 / Math.sqrt(1 + sl * sl);
    for (const d of cols) {
      const x = xc + d * inv, y = heightAt(x, z);
      pos.push(x, y + (Math.abs(d) <= SHOULDER ? 0.02 : 0.03), z);
      uv.push(d, z);
      const k = Math.abs(d) <= HALF ? 0 : Math.abs(d) <= SHOULDER + 0.6 ? 1 : 2;
      zone.push(k);
      const c = k === 0 ? [1, 1, 1] : k === 1 ? [0.2, 0.17, 0.14] : d < 0 ? [0.11, 0.1, 0.07] : [0.16, 0.14, 0.09];
      col.push(c[0], c[1], c[2]);
    }
  }
  const C = cols.length;
  for (let j = 0; j < rowsN - 1; j++) for (let i = 0; i < C - 1; i++) { const a = j * C + i, b = a + 1, c = a + C, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aZone', new THREE.Float32BufferAttribute(zone, 1));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = corridorMaterial(o.asphalt);
  const surf = new THREE.Mesh(g, mat); surf.name = 'dune-road-surface'; surf.receiveShadow = true;
  group.add(surf);

  // ---- stones on the shoulders and the bank (instanced, flattened icosahedra in warm greys)
  const stoneGeo = new THREE.IcosahedronGeometry(1, 0);
  const nStones = low ? 1400 : 5200;
  const stones = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, name: 'stones' }), nStones);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), cc = new THREE.Color();
  let ns = 0;
  for (let k = 0; k < nStones; k++) {
    const z = z0 + r() * (z1 - z0), side = r() < 0.55 ? 1 : -1;
    const d = side * (HALF + 0.2 + Math.pow(r(), 1.6) * (side > 0 ? 6.5 : 4.5));
    const x = xAt(z) + d, y = heightAt(x, z);
    if (!Number.isFinite(y)) continue; // off the corridor (its ends)
    const s = 0.03 + Math.pow(r(), 3) * 0.14;
    e.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(e);
    m4.compose(p.set(x, y + s * 0.25, z), q, sc.set(s * (1 + r()), s * (0.5 + r() * 0.4), s * (1 + r())));
    stones.setMatrixAt(ns, m4);
    const l = 0.06 + r() * 0.08; stones.setColorAt(ns, cc.setRGB(l * 1.05, l * 0.95, l * 0.85));
    ns++;
  }
  stones.count = ns; stones.castShadow = !low; stones.receiveShadow = true; stones.name = 'dune-stones';
  stones.instanceMatrix.needsUpdate = true; if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
  group.add(stones);

  // ---- coral-rock outcrops on the dune (big displaced boulders, silhouettes against the sky), static colliders
  const rocks = [], colliders = [];
  const outcrops = [[zCrest - 40, 15, 3.6], [zCrest - 70, 12, 2.4], [zCrest + 30, 17, 2.8], [zCrest - 150, 13, 3.2], [zCrest - 330, 16, 4.2], [zCrest + 180, 14, 2.6], [zCrest - 470, 12, 3.0]];
  for (const [z, d, s] of outcrops) {
    if (z < z0 || z > z1) continue;
    for (let k = 0; k < 3; k++) {
      const zz = z + (r() - 0.5) * s * 2, dd = d + (r() - 0.5) * s, x = xAt(zz) + dd, y = heightAt(x, zz);
      const sz = s * 0.7 * (0.55 + r() * 0.5);
      const gr = new THREE.IcosahedronGeometry(1, low ? 1 : 3);
      const pa = gr.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        p.fromBufferAttribute(pa, i);
        const n = 0.7 + 0.45 * vnoise(p.x * 2.1 + k * 7 + p.y * 3.3) + 0.15 * vnoise(p.z * 6.3 + p.y * 5.1) + 0.06 * vnoise(p.x * 17 + p.z * 13);
        p.multiplyScalar(n); p.y *= 0.5; pa.setXYZ(i, p.x, p.y, p.z); // low, half-buried slabs
      }
      gr.computeVertexNormals();
      gr.scale(sz, sz, sz * (0.8 + r() * 0.5)); gr.rotateY(r() * 6); gr.translate(x, y + sz * 0.08, zz);
      rocks.push(gr);
      colliders.push([x - sz * 0.8, y - 1, x + sz * 0.8, y + sz, zz - sz * 0.8, zz + sz * 0.8]);
    }
  }
  if (rocks.length) {
    const rm = new THREE.Mesh(mergeGeometries(rocks), new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.95, metalness: 0, name: 'coralRock' }));
    rm.castShadow = true; rm.receiveShadow = true; rm.name = 'dune-rocks'; group.add(rm);
  }
  // ---- scrub: sea-grape clumps on the park side and the dune top, dark irregular silhouettes
  const bush = [];
  const nb = low ? 160 : 520;
  for (let k = 0; k < nb; k++) {
    const z = z0 + r() * (z1 - z0), west = r() < 0.6;
    const d = west ? -(SHOULDER + 2 + r() * 9) : SHOULDER + 7 + r() * 18;
    const x = xAt(z) + d, y = heightAt(x, z);
    if (!Number.isFinite(y)) continue; // off the corridor (its ends)
    const parts = 2 + Math.floor(r() * 3), s0 = 0.3 + r() * 0.55;
    for (let b = 0; b < parts; b++) {
      const gb = new THREE.IcosahedronGeometry(s0 * (0.5 + r() * 0.6), low ? 0 : 1);
      gb.scale(1, 0.5 + r() * 0.3, 1);
      gb.translate(x + (r() - 0.5) * s0 * 1.6, y + s0 * 0.45 + r() * s0 * 0.5, z + (r() - 0.5) * s0 * 1.6);
      bush.push(gb.index ? gb.toNonIndexed() : gb);
    }
  }
  const bm = new THREE.Mesh(mergeGeometries(bush.map((b) => { b.deleteAttribute('uv'); return b; })), new THREE.MeshStandardMaterial({ color: 0x1d2414, roughness: 0.9, flatShading: true, name: 'scrub' }));
  bm.castShadow = !low; bm.receiveShadow = true; bm.name = 'dune-scrub'; group.add(bm);
  // ---- grass: blade fans on the bank and the dune
  const blades = [], cnt = low ? 2500 : 9000;
  for (let k = 0; k < cnt; k++) {
    const z = z0 + r() * (z1 - z0), west = r() < 0.4;
    const d = west ? -(SHOULDER + 0.5 + r() * 9) : SHOULDER + 0.8 + r() * 20;
    const x = xAt(z) + d, y = heightAt(x, z);
    if (!Number.isFinite(y)) continue; // off the corridor (its ends)
    const hh = 0.25 + r() * 0.5;
    for (let b = 0; b < 4; b++) {
      const a = r() * Math.PI * 2, lean = 0.2 + r() * 0.3, w = 0.022;
      const tx = x + Math.cos(a) * lean * hh, tz = z + Math.sin(a) * lean * hh;
      blades.push(x - Math.sin(a) * w, y, z + Math.cos(a) * w, x + Math.sin(a) * w, y, z - Math.cos(a) * w, tx, y + hh * (0.8 + r() * 0.4), tz);
    }
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3)); gg.computeVertexNormals();
  const grass = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: 0x4a4426, roughness: 0.9, side: THREE.DoubleSide, name: 'dunegrass' }));
  grass.name = 'dune-grass2'; grass.receiveShadow = true; group.add(grass);
  // ---- one street lamp on the park side, just before the first crest
  const lz = zCrest + 34, lx = xAt(lz) - (SHOULDER + 0.9), ly = heightAt(lx, lz);
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 7.2, 8).translate(lx, ly + 3.6, lz);
  const arm = new THREE.BoxGeometry(1.6, 0.08, 0.1).translate(lx + 0.8, ly + 7.1, lz);
  const lampMesh = new THREE.Mesh(mergeGeometries([pole, arm].map((x) => { x.deleteAttribute('uv'); return x.index ? x.toNonIndexed() : x; })), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.5 }));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.26).translate(lx + 1.55, ly + 7.0, lz), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.55, 0.9), name: 'duneLampHead' }));
  lampMesh.name = 'dune-lamp'; head.name = 'dune-lamp-head'; lampMesh.castShadow = true;
  group.add(lampMesh, head);
  const lamp = { x: lx + 1.55, y: ly + 6.85, z: lz, mat: head.material };
  colliders.push([lx - 0.15, ly - 1, lx + 0.15, ly + 7, lz - 0.15, lz + 0.15]);

  /** A start pose on the northbound (right-hand, east) lane, `back` m south of the first crest. */
  const start = (back = 70, laneOffset = LANE / 2) => {
    const z = zCrest + back, sl = slope(z), n = Math.sqrt(1 + sl * sl);
    const dx = -sl / n, dz = -1 / n;           // northwards along the road
    const rx = -dz, rz = dx;                   // right of travel (east)
    return { x: xAt(z) + rx * laneOffset, z: z + rz * laneOffset, heading: Math.atan2(-dx, -dz), dir: [dx, dz], right: [rx, rz] };
  };
  return { group, heightAt, surfaceAt, start, colliders, lamp, xAt, zCrest, z0, z1, mat, half: HALF, shoulder: SHOULDER, lateral, stats: { length: Math.round(z1 - z0), stones: ns, rocks: rocks.length, bushes: nb, grass: cnt } };
}

/**
 * The corridor's material: vertex colours per zone; on the asphalt (zone 0) a worn grey-brown base from the photo
 * asphalt (if given) or noise, darker patched rectangles, polished wheel tracks, a worn double yellow line (no edge
 * line); on the gravel (zone 1) a pebbly noise; dry everywhere (roughness 0.8-0.95).
 */
/**
 * Give the corridor scanned ground (roadside.js). `scan` = { diff, nor, rough } (the coral gravel set: the shoulder at
 * 1.5 m per tile, rubble spilling onto the bank); optional `road` = { diff, nor, rough } (a 2k asphalt scan, 3 m per
 * tile, sampled at two scales) and `bank` = { diff, nor, rough, disp } (a sand-and-rock scan with parallax relief, 4.5 m
 * per tile on the bank and the dune). Recompiles the material once. `mat.userData.uDusk.value` (0 day .. 1 dusk) lifts
 * the albedo at dusk only, so the roadside reads in the low light as the reference's does without a washed-out noon.
 */
export function setCorridorScan(mat, scan) {
  const all = [scan.diff, scan.nor, scan.rough];
  if (scan.road) all.push(scan.road.diff, scan.road.nor, scan.road.rough);
  if (scan.bank) all.push(scan.bank.diff, scan.bank.nor, scan.bank.rough, scan.bank.disp);
  for (const t of all) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; }
  scan.nor.repeat.set(1 / 1.5, 1 / 1.5);
  mat.userData.scan = scan;
  // (listed for the engine's heap trim, render/Memory.js: these textures are bound only as shader uniforms)
  mat.userData.u = Object.fromEntries(all.filter(Boolean).map((t, i) => [`t${i}`, { value: t }]));
  mat.normalMap = scan.nor; mat.normalScale.set(1, 1);
  mat.envMapIntensity = 1.9; // the roadside reads in the reference: the corridor catches more of the dusk sky
  mat.needsUpdate = true;
}

function corridorMaterial(asphalt) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, name: 'duneRoad' });
  if (asphalt && asphalt.map) { m.map = asphalt.map; }
  m.userData.uDusk = { value: 1 }; m.userData.uPx = { value: 1 }; m.userData.uDetail = { value: 1 }; // (bench knobs)
  m.onBeforeCompile = (sh) => {
    const scan = m.userData.scan;
    sh.uniforms.uDusk = m.userData.uDusk; sh.uniforms.uPx = m.userData.uPx; sh.uniforms.uDetail = m.userData.uDetail;
    if (scan) {
      Object.assign(sh.uniforms, { uScanDiff: { value: scan.diff }, uScanRough: { value: scan.rough }, uScanNor: { value: scan.nor } });
      sh.defines = { ...(sh.defines || {}), SCAN: 1 };
      if (scan.road) { Object.assign(sh.uniforms, { uAspD: { value: scan.road.diff }, uAspN: { value: scan.road.nor }, uAspR: { value: scan.road.rough } }); sh.defines.ROADSCAN = 1; }
      if (scan.bank) { Object.assign(sh.uniforms, { uBnkD: { value: scan.bank.diff }, uBnkN: { value: scan.bank.nor }, uBnkR: { value: scan.bank.rough }, uBnkH: { value: scan.bank.disp } }); sh.defines.BANKSCAN = 1; }
    }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aZone; varying float vZone; varying vec2 vRd;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvZone = aZone; vRd = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vZone; varying vec2 vRd;
uniform float uDusk, uPx, uDetail;
float dh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dh(i), dh(i + vec2(1, 0)), f.x), mix(dh(i + vec2(0, 1)), dh(i + vec2(1, 1)), f.x), f.y); }
float dfbm(vec2 p) { return dn(p) * 0.5 + dn(p * 2.1) * 0.25 + dn(p * 4.3) * 0.125 + dn(p * 8.7) * 0.0625; }
#ifdef SCAN
uniform sampler2D uScanDiff, uScanRough, uScanNor;
#endif
#ifdef ROADSCAN
uniform sampler2D uAspD, uAspN, uAspR;
#endif
#ifdef BANKSCAN
uniform sampler2D uBnkD, uBnkN, uBnkR, uBnkH;
#endif
// grass density (identical to roadside.js grassDensity: sine-free value noise in corridor coordinates)
float gh2(vec2 q) { vec3 p3 = fract(vec3(q.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gvn(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh2(i), gh2(i + vec2(1.0, 0.0)), f.x), mix(gh2(i + vec2(0.0, 1.0)), gh2(i + vec2(1.0, 1.0)), f.x), f.y); }
float grassDensity(float d, float z) { return gvn(vec2(d / 6.0, z / 9.0)) * 0.7 + gvn(vec2(d / 2.3 + 17.0, z / 3.1)) * 0.3; }
float scanK = 0.0, cAsp = 0.0, cGrav = 0.0, cBank = 0.0, cFlat = 0.0, cPaint = 0.0;
vec2 bankUv = vec2(0.0);`)
      .replace('#include <map_fragment>', `
float roadK = 1.0 - step(0.5, vZone), gravK = step(0.5, vZone) * (1.0 - step(1.5, vZone));
float dRd = vRd.x, zRd = vRd.y;
// each zone's work below runs only where its weight is non-zero; a texture read inside such a branch would get
// undefined implicit derivatives where a 2x2 quad straddles two zones (wrong-mip speckles), so the uv derivatives are
// taken here, outside every branch, and the branched reads pass them to textureGrad scaled as their uv is
vec2 gx = dFdx(vRd), gy = dFdy(vRd);
#ifndef ROADSCAN
#ifdef USE_MAP
vec4 sampledDiffuseColor = texture2D(map, vec2(dRd, zRd) / 6.0);
#else
vec4 sampledDiffuseColor = vec4(vec3(0.3), 1.0);
#endif
#endif
float dRough = 0.88;
{
  float ad = abs(dRd);
  float aa = fwidth(dRd) * 0.8 + 0.004;   // (outside the branches: a derivative)
  float bankK = 1.0 - roadK - gravK;
  float aspK = 0.0;
  if (roadK > 0.0) {
    // the asphalt's edge crumbles into the shoulder: a ragged boundary 0.2-0.6 m inside the geometric edge
    float rag = dn(vec2(zRd * 1.7, dRd * 3.0)) * 0.4 + dn(vec2(zRd * 6.0, dRd)) * 0.2;
    aspK = roadK * (1.0 - smoothstep(3.0 - rag, 3.15 - rag, ad));
  }
  // ---- asphalt (asp / rAsp / cPaint only ever count multiplied by aspK)
  vec3 asp = vec3(0.0); float rAsp = 0.0;
  if (aspK > 0.0) {
#ifndef ROADSCAN
  float agg = dfbm(vec2(dRd, zRd) * 3.0);
  asp = vec3(0.15, 0.125, 0.11) * (0.75 + 0.5 * agg) * mix(vec3(1.0), sampledDiffuseColor.rgb * 2.2, 0.35);
#endif
#ifdef ROADSCAN
  // the 2k scan at its 3 m tile, a 0.9 m detail octave (holds from 1 m) and a 25 m macro variation (holds from afar)
  vec3 a3 = textureGrad(uAspD, vec2(dRd, zRd) / 3.0, gx / 3.0, gy / 3.0).rgb, a1 = vec3(0.3);
  if (uDetail > 0.5) a1 = textureGrad(uAspD, vec2(zRd, -dRd) / 0.9, vec2(gx.y, -gx.x) / 0.9, vec2(gy.y, -gy.x) / 0.9).rgb;
  float macro = dfbm(vec2(dRd, zRd) / 25.0);
  asp = a3 * (0.7 + 0.6 * dot(a1, vec3(0.333)) / 0.3) * (0.8 + 0.4 * macro) * vec3(0.92, 0.88, 0.84);
  float ar = textureGrad(uAspR, vec2(dRd, zRd) / 3.0, gx / 3.0, gy / 3.0).r;
#else
  float ar = 0.9;
#endif
  float patchN = dfbm(vec2(dRd * 0.35, zRd * 0.06));
  asp *= mix(1.0, 0.75, smoothstep(0.55, 0.6, patchN));
  // rectangular repair patches (darker, smoother), crack lines, tar-sealed seams (black, glossy)
  vec2 pc = vec2(dRd / 2.6, zRd / 5.0), pi = floor(pc), pf = fract(pc);
  float patchR = step(0.82, dh(pi + 3.7)) * step(0.12, pf.x) * step(pf.x, 0.88) * step(0.1, pf.y) * step(pf.y, 0.8);
  asp = mix(asp, asp * 0.6, patchR);
  float crack = 1.0 - smoothstep(0.0, 0.025, abs(dn(vec2(dRd * 1.3, zRd * 0.35)) - 0.5) - 0.002);
  asp *= 1.0 - 0.35 * crack * smoothstep(0.4, 0.7, dfbm(vec2(dRd, zRd) * 0.5));
  float seamX = abs(abs(dRd + 0.15 * sin(zRd * 0.07)) - 1.75) , seamZ = abs(fract(zRd / 11.0 + 0.1 * dn(vec2(dRd, 3.0))) - 0.5) * 11.0;
  float seam = max(1.0 - smoothstep(0.03, 0.03 + aa * 2.0, seamX), (1.0 - smoothstep(0.025, 0.025 + aa * 2.0, seamZ)) * step(ad, 3.2)) * step(0.35, dn(vec2(zRd * 0.05, dRd * 0.2)));
  asp = mix(asp, vec3(0.025, 0.022, 0.02), seam * 0.85);
  // polished wheel tracks: smoother, a touch darker, slightly damp-looking toward the afterglow (not a mirror)
  float lane = ad - 1.68, track = 1.0 - smoothstep(0.25, 0.55, abs(abs(lane) - 0.8));
  track *= 0.7 + 0.3 * dn(vec2(zRd * 0.2, dRd));
  asp *= 1.0 - 0.12 * track;
  rAsp = mix(mix(0.82, 0.95, ar), 0.42, track * 0.85);
  rAsp = mix(rAsp, 0.66, patchR); rAsp = mix(rAsp, 0.35, seam);
  // the double yellow: thick paint, worn through to the aggregate in places, broken into lengths with gaps
  float wear = smoothstep(0.25, 0.7, dfbm(vec2(dRd * 4.0, zRd * 0.9)));
#ifdef ROADSCAN
  wear *= smoothstep(0.15, 0.4, dot(a1, vec3(0.333)));   // the paint sits on the aggregate's high points
#endif
  float broken = smoothstep(0.3, 0.42, dn(vec2(zRd * 0.09, dRd > 0.0 ? 1.0 : 7.0)));
  float yl = (1.0 - smoothstep(0.05 - aa, 0.05 + aa, abs(ad - 0.11))) * (0.3 + 0.65 * wear) * broken;
  asp = mix(asp, vec3(0.5, 0.35, 0.08), yl); rAsp = mix(rAsp, 0.6, yl); cPaint = yl;
  }
  // ---- gravel shoulder (and where the asphalt has crumbled)
  float gK = gravK + roadK - aspK;   // gravel where the asphalt has gone
  vec3 grav = vec3(0.0); float rGrav = 0.9;
#ifdef SCAN
  // the rubble runs on 3-4 m past the shoulder before the soil takes over (wider on the dune side)
  float spill = 0.0;
  if (bankK > 0.0) spill = bankK * (1.0 - smoothstep(5.6, dRd > 0.0 ? 9.5 : 7.5, ad + 1.2 * dn(vec2(zRd * 0.15, dRd))));
  vec3 gRaw = vec3(0.0);   // one read of the gravel scan, for the shoulder and the spill
  if (gK > 0.0 || spill > 0.0) {
    gRaw = textureGrad(uScanDiff, vec2(dRd, zRd) / 1.5, gx / 1.5, gy / 1.5).rgb;
    if (gK > 0.0) {
      grav = mix(vec3(dot(gRaw, vec3(0.3, 0.55, 0.15))), gRaw, 0.55) * vec3(0.82, 0.8, 0.76);   // the coral scan muted toward limestone grey
      rGrav = textureGrad(uScanRough, vec2(dRd, zRd) / 1.5, gx / 1.5, gy / 1.5).r;
    }
  }
#else
  vec2 gp = vec2(dRd, zRd) * 9.0;
  float peb = smoothstep(0.55, 0.75, dn(gp)) * (0.6 + 0.4 * dn(gp * 2.7));
  grav = vec3(0.09, 0.08, 0.07) + vec3(0.16, 0.14, 0.12) * peb;
#endif
  vec3 col = aspK * asp + gK * grav + (1.0 - roadK - gravK) * vec3(1.0);
  dRough = aspK * rAsp + gK * rGrav + (1.0 - roadK - gravK) * 0.92;
  diffuseColor.rgb *= col;
  // dirt / sand blown over the edges of the asphalt
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.19, 0.15), aspK * smoothstep(2.4, 3.1, ad) * 0.45);
  if (bankK > 0.0) {
    float gv = dfbm(vec2(dRd, zRd) * 0.4);
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.85, 0.7) + 0.4 * gv, bankK);
  }
  cAsp = aspK; cGrav = gK;
#ifdef SCAN
  if (bankK > 0.0) {
    vec3 bs = textureGrad(uScanDiff, vec2(dRd, zRd) / 4.0, gx / 4.0, gy / 4.0).rgb;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.45 + 1.1 * bs), bankK * 0.85);
  }
#ifdef BANKSCAN
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);   // (outside the branch: derivatives)
  // the bank / dune face: a sand-and-rock scan with parallax relief (4 steps along the view ray in tangent space)
  if (bankK > 0.0) {
    float pxK = uPx * (1.0 - smoothstep(22.0, 30.0, length(vViewPosition)));   // relief only where it can be seen
    vec2 s0 = gx, s1 = gy;
    vec3 Nn = normalize(vNormal), q1p = cross(q1, Nn), q0p = cross(Nn, q0);
    vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
    float sc = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12)); T *= sc; B *= sc;
    vec3 V = normalize(vViewPosition);
    vec2 dir = vec2(dot(V, T), dot(V, B)) / max(dot(V, Nn), 0.25);
    vec2 uv0 = vec2(dRd, zRd) / 4.5, pStep = -dir * 0.12 / 4.5 / 3.0;   // 12 cm of relief, 3 steps, within 30 m
    // (these reads keep their implicit derivatives, as before the zones were branched: this block always was inside
    // this branch, and the marched uv's own derivatives pick the mip the relief was tuned with)
    float hz = 1.0, h = texture2D(uBnkH, uv0).r; vec2 uv = uv0;
    for (int i = 0; i < 3; i++) { if (h >= hz || pxK < 0.5) break; hz -= 0.3333; uv += pStep; h = texture2D(uBnkH, uv).r; }
    bankUv = uv;
    vec3 bd = texture2D(uBnkD, uv).rgb * (0.5 + 0.6 * smoothstep(0.1, 0.7, h));   // crevices darker
    diffuseColor.rgb = mix(diffuseColor.rgb, bd * vec3(1.05, 0.98, 0.9), bankK * 0.95);
    dRough = mix(dRough, texture2D(uBnkR, uv).r, bankK);
    cBank = bankK;
  }
#endif
  if (spill > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, gRaw * vec3(0.85, 0.8, 0.75), spill);
  cGrav = max(cGrav, spill); cBank *= 1.0 - spill;
  scanK = 1.0;
  // the ground under dense grass: darker and tinted (thatch, humus), so tufts do not sit on bright dirt
  if (roadK < 1.0 && ad >= 3.8) {   // (where (1 - roadK) * step(3.8, ad) is non-zero)
    float gDen = smoothstep(0.35, 0.75, grassDensity(dRd, zRd)) * (1.0 - roadK) * step(3.8, ad);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.6, 0.48), gDen * 0.8);
  }
  // dusk only: the scans carry real albedo; lift the corridor so it reads like the reference's roadside in low light
  diffuseColor.rgb *= mix(1.0, mix(1.65, 2.1, 1.0 - roadK), uDusk);
#endif
}`)
      .replace('#include <color_fragment>', `#if defined(SCAN) && defined(USE_COLOR)
  diffuseColor.rgb *= mix(vColor, vec3(1.0), cBank * 0.9);   // (vertex colour after the map stage: keep it off the scanned bank)
#else
#include <color_fragment>
#endif`)
      .replace('#include <normal_fragment_maps>', `
#ifdef SCAN
{
  // per-zone tangent-space normals: asphalt (two scales, flattened on the tracks), gravel, bank (parallax uv)
  // (each zone's normal read only where its weight is non-zero, with the map stage's gradients: see there)
  vec3 mapN = vec3(0.0);
  if (cGrav > 0.0) {
    vec3 nG = textureGrad(uScanNor, vec2(dRd, zRd) / 1.5, gx / 1.5, gy / 1.5).xyz * 2.0 - 1.0;
    mapN = nG * cGrav;
  }
#ifdef ROADSCAN
  if (cAsp > 0.0) {
  vec3 nA = textureGrad(uAspN, vec2(dRd, zRd) / 3.0, gx / 3.0, gy / 3.0).xyz * 2.0 - 1.0;
  if (uDetail > 0.5) { vec3 nA1 = textureGrad(uAspN, vec2(zRd, -dRd) / 0.9, vec2(gx.y, -gx.x) / 0.9, vec2(gy.y, -gy.x) / 0.9).xyz * 2.0 - 1.0; nA.xy = nA.xy + nA1.yx * vec2(1.0, -1.0) * 0.6; }
  float lane2 = abs(dRd) - 1.68, track2 = 1.0 - smoothstep(0.25, 0.55, abs(abs(lane2) - 0.8));
  nA.xy *= 1.0 - 0.6 * track2;
  // the paint's thickness: flatter on the line, a ridge at its edges
  nA.xy = mix(nA.xy, vec2(0.0), cPaint * 0.7);
  mapN += nA * cAsp;
  }
#else
  mapN += vec3(0.0, 0.0, 1.0) * cAsp;
#endif
#ifdef BANKSCAN
  if (cBank > 0.0) mapN += (textureGrad(uBnkN, bankUv, gx / 4.5, gy / 4.5).xyz * 2.0 - 1.0) * cBank;
#endif
  mapN += vec3(0.0, 0.0, 1.0) * max(0.0, 1.0 - cAsp - cGrav - cBank);
  mapN.xy *= normalScale;
  normal = normalize(tbn * normalize(mapN));
}
#else
#include <normal_fragment_maps>
#endif`)
      .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace('float roughnessFactor = roughness;', 'float roughnessFactor = dRough;') + `
#ifdef ENGINE_GBUFFER
engineGbRoughness = max(roughnessFactor, 0.6); // no screen-space reflections on the corridor: its sheen is the environment's
#endif`);
  };
  m.customProgramCacheKey = () => { const sc = m.userData.scan; return `miami-dune-road-${asphalt && asphalt.map ? 1 : 0}-${sc ? 1 : 0}${sc && sc.road ? 'r' : ''}${sc && sc.bank ? 'b' : ''}`; };
  return m;
}
