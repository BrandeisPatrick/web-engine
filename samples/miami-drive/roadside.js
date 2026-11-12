// The Dune Road's roadside from free scans (Poly Haven, CC0; see public/miami/CREDITS.md): the reference's richest
// detail is the strip beside the road, so it is built from photographed material rather than procedural noise.
//   - the corridor ground: the "Coral Gravel" scan (colour, normal, roughness) on the gravel shoulder at 1.5 m per
//     tile and, darker, on the bank / dune face (dune-road.js setCorridorScan)
//   - stones: the "Rock 07" scan decimated to 67 triangles (pebbles, 4-30 cm, scattered thickly on the shoulders so
//     single stones catch the sky light) and to ~1000 triangles (rocks, 0.5-2.5 m, on the bank and the dune top),
//     instanced in 100 m chunks along the road so off-screen chunks are culled
//   - scrub and ground cover (desktop): the "Shrub 04" scan as instanced meshes with wind within ~28 m (40 m chunks)
//     and as billboard impostors (src/render/Impostors.js) beyond, at 0.5 - 4.6 m, irregular sizes and tints
// The procedural stones / rocks / scrub of dune-road.js are hidden when this loads. Everything is low-key: the
// scans' own albedo, darkened slightly, lit only by the dusk sky and the car's lamps.
//
//   const rs = await buildRoadside({ road, base, scene, lod });   per frame: rs.update(camera)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeImpostors, ImpostorBatch, loadTextureSet, loadTextureManifest } from '@vibe/engine/render';
import { setCorridorScan } from './dune-road.js';

function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const firstMesh = (gltf) => { let m = null; gltf.scene.traverse((o) => { if (!m && o.isMesh) m = o; }); return m; };

/**
 * @param {{ road: object, base: string, scene: THREE.Scene, lod?: 'high'|'low' }} o
 * @returns {Promise<{ group: THREE.Group, update(camera: THREE.Camera): void, stats: object }>}
 */
// CPU copies are dropped once a texture / geometry is on the GPU (the page's heap is at its ceiling)
function freeTex(t) {
  if (!t) return t;
  const prev = t.onUpdate;
  t.onUpdate = () => { if (prev) prev(); if (t.isCompressedTexture && t.mipmaps) for (const m of t.mipmaps) m.data = new Uint8Array(0); t.onUpdate = null; };
  return t;
}
function freeGeo(g) {
  for (const k in g.attributes) { const a = g.attributes[k]; if (!a.isInterleavedBufferAttribute) a.onUpload(function () { this.array = new this.array.constructor(0); }); }
  if (g.index) g.index.onUpload(function () { this.array = new this.array.constructor(0); });
  return g;
}

// ---- textures painted in code (no files): grass blades and a dry palm frond, both with alpha
function paintedTexture(w, h, paint) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// grass: a two-variant atlas (left / right half) of blades splaying out from a point at the bottom centre, arching over
// under their own weight; tips taper to nothing, the base fades out (no hard cut-off edge), bases darker than tips.
// Neutral straw-to-green values: the per-instance colour sets the hue (dry straw, olive, green).
function bladeTexture() {
  return paintedTexture(512, 256, (g, W, h) => {
    const r = rnd(91), w = W / 2;
    for (let v = 0; v < 2; v++) {
      const ox = v * w, n = v ? 46 : 64;
      for (let k = 0; k < n; k++) {
        const dir = (r() - 0.5) * 2, len = h * (v ? 0.6 + 0.4 * r() : 0.4 + 0.5 * r()), bw = 1.8 + r() * 3.2;
        const bx = ox + w / 2 + dir * w * 0.06, by = h;
        const tx = ox + w / 2 + dir * w * (0.3 + 0.2 * r()), ty = h - len * (0.55 + 0.4 * (1 - Math.abs(dir)));
        const droop = Math.abs(dir) * len * (0.15 + 0.3 * r());          // tips fall back under their own weight
        const cx = (bx + tx) / 2 + dir * w * 0.02, cy = ty - len * 0.25;
        const lum = 0.55 + 0.45 * r(), dry = r();
        const grd = g.createLinearGradient(0, by, 0, ty - 10);
        const c = (k2) => `rgb(${(150 + 70 * dry) * lum * k2 | 0},${(150 + 40 * dry) * lum * k2 | 0},${(95 + 20 * dry) * lum * k2 | 0})`;
        grd.addColorStop(0, c(0.45)); grd.addColorStop(0.6, c(0.85)); grd.addColorStop(1, c(1.05));
        g.fillStyle = grd;
        g.beginPath(); g.moveTo(bx - bw, by); g.quadraticCurveTo(cx - bw * 0.5, cy, tx, ty + droop);
        g.quadraticCurveTo(cx + bw * 0.5, cy, bx + bw, by); g.fill();
      }
    }
    // the base fades out instead of ending in a straight edge
    g.globalCompositeOperation = 'destination-in';
    const fade = g.createLinearGradient(0, h, 0, h * 0.8); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fade; g.fillRect(0, 0, W, h);
  });
}
/** Sine-free 2D value noise, identical in JS and in the corridor shader (dune-road.js grassDensity). */
const _h2 = (x, y) => { let a = (x * 0.1031) % 1, b = (y * 0.1031) % 1, c = (x * 0.1031) % 1; if (a < 0) a += 1; if (b < 0) b += 1; if (c < 0) c += 1; const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d; const f = ((a + b) * c) % 1; return f < 0 ? f + 1 : f; };
const _vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = _h2(ix, iy), b = _h2(ix + 1, iy), c = _h2(ix, iy + 1), d = _h2(ix + 1, iy + 1); return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy; };
/** Grass density 0..1 at corridor coordinates (d across, z along): patches ~6-10 m with ~2-3 m detail. */
export const grassDensity = (d, z) => _vn(d / 6.0, z / 9.0) * 0.7 + _vn(d / 2.3 + 17.0, z / 3.1) * 0.3;
function frondTexture() {
  return paintedTexture(512, 128, (g, w, h) => {
    const r = rnd(17);
    g.strokeStyle = 'rgb(120,92,58)'; g.lineWidth = 5; g.beginPath(); g.moveTo(4, h / 2); g.lineTo(w - 4, h / 2); g.stroke();
    for (let k = 0; k < 60; k++) {
      const x = 12 + (w - 30) * (k / 60), len = h * 0.46 * Math.sin(Math.PI * Math.min(1, (k / 60) * 1.1)) * (0.7 + r() * 0.3);
      for (const sd of [-1, 1]) {
        if (r() < 0.2) continue;
        const v = 0.7 + r() * 0.3; g.strokeStyle = `rgb(${135 * v | 0},${100 * v | 0},${60 * v | 0})`; g.lineWidth = 2 + r() * 2;
        g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + len * 0.5, h / 2 + sd * len); g.stroke();
      }
    }
  });
}
// a clump: n trapezoid cards (narrow at the base, wide at the top) at jittered angles, splaying outward from the root;
// 1 m tall, base at y = 0; normals bent up (lit like a canopy, no flashing card faces); uv.x spans one atlas half
function grassClump(n = 4, seed = 5) {
  const r = rnd(seed), P = [], U = [], N = [], I = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI + (r() - 0.5) * 0.5, ca = Math.cos(a), sa = Math.sin(a);
    const tilt = (r() - 0.5) * 0.5, tx = -sa * tilt, tz = ca * tilt, top = 0.45 + 0.1 * r(), bot = 0.08;
    const b = P.length / 3;
    P.push(-ca * bot, 0, -sa * bot, ca * bot, 0, sa * bot, ca * top + tx, 1, sa * top + tz, -ca * top + tx, 1, -sa * top + tz);
    U.push(0.38, 0, 0.62, 0, 1, 1, 0, 1);
    for (let q = 0; q < 4; q++) N.push(0, 1, 0);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
  return g;
}
/** Flat thatch: one horizontal card of the blade texture lying on the ground (dead grass between the tufts). */
function thatchCard() {
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0.015, 0);
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

export async function buildRoadside(o) {
  const { road, base } = o;
  const low = o.lod === 'low';
  const tl = new THREE.TextureLoader(), gl = new GLTFLoader();
  const tex = (f, srgb, b = base) => tl.loadAsync(b + f).then((t) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; });
  // the desktop tier also gets the 2k road / bank scans (KTX2 through TextureSets, JPG fallback)
  const roadBase = o.roadBase;
  const roadMan = !low && roadBase ? await loadTextureManifest(roadBase) : null;
  const set = (id) => (roadMan ? loadTextureSet(id, { renderer: o.renderer, base: roadBase, manifest: roadMan }).catch(() => null) : null);
  const [diff, nor, rough, rockLo, rockHi, shrub, shrubMid, shrubLo, roadSet, bankSet, bankH] = await Promise.all([
    tex('coral_gravel_diff.jpg', true), tex('coral_gravel_nor_gl.jpg'), tex('coral_gravel_rough.jpg'),
    gl.loadAsync(base + 'rock_07_lo.glb'), gl.loadAsync(base + 'rock_07_hi.glb'),
    low ? null : gl.loadAsync(base + 'shrub_04.glb'), low ? null : gl.loadAsync(base + 'shrub_04_mid.glb'), low ? null : gl.loadAsync(base + 'shrub_04_lo.glb'),
    set('asphalt_02_2k'), set('coast_sand_rocks_02_2k'), roadMan ? tex('coast_sand_rocks_02_2k/disp.jpg', false, roadBase).catch(() => null) : null,
  ]);
  const ts = (S) => (S && S.map && S.normalMap && S.roughnessMap ? { diff: freeTex(S.map), nor: freeTex(S.normalMap), rough: freeTex(S.roughnessMap) } : null);
  const scan = { diff, nor, rough, road: ts(roadSet), bank: ts(bankSet) };
  if (scan.bank && bankH) scan.bank.disp = bankH; else scan.bank = null;
  setCorridorScan(road.mat, scan);
  // the procedural stand-ins go
  road.group.traverse((m) => { if (/^(dune-stones|dune-rocks|dune-scrub)$/.test(m.name) || (!low && m.name === 'dune-grass2')) m.visible = false; });

  const group = new THREE.Group(); group.name = 'roadside';
  const r = rnd(4242);
  const HALF = road.half, SH = road.shoulder, z0 = road.z0, z1 = road.z1;
  const CH = 100, nCh = Math.ceil((z1 - z0) / CH);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qq = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const yAt = (x, z) => { const y = road.heightAt(x, z); return Number.isFinite(y) ? y : null; };
  let tris = 0;
  // ---- stones: per chunk instanced meshes (culled per chunk)
  const stoneMesh = (src, list, name, tint) => {
    const geo = src.geometry, mat = src.material.clone();
    mat.color.setRGB(tint * 1.15, tint * 1.1, tint * 1.05); mat.roughness = 0.8; mat.envMapIntensity = 1.9;
    // embedded stones: the lower part darkens toward the ground (a contact shadow without a shadow pass)
    const y0 = geo.boundingBox ? geo.boundingBox.min.y : (geo.computeBoundingBox(), geo.boundingBox.min.y), hy = geo.boundingBox.max.y - y0;
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vStoneH;').replace('#include <begin_vertex>', `#include <begin_vertex>\nvStoneH = (position.y - (${y0.toFixed(4)})) / ${hy.toFixed(4)};`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vStoneH;').replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= mix(0.25, 1.0, smoothstep(0.0, 0.45, vStoneH));\nreflectedLight.indirectSpecular *= mix(0.3, 1.0, smoothstep(0.0, 0.45, vStoneH));');
    };
    mat.customProgramCacheKey = () => `roadside-stone-${name}`;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => {
      e.set(s.rx, s.ry, s.rz); q.setFromEuler(e);
      m4.compose(p.set(s.x, s.y, s.z), q, sc.set(s.s * s.ax, s.s * s.ay, s.s * s.az));
      im.setMatrixAt(i, m4);
      const l = s.l; im.setColorAt(i, col.setRGB(l * 1.02, l * 0.98, l * 0.92));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.castShadow = !low && name === 'roadside-rocks'; im.receiveShadow = true; im.name = name;
    tris += list.length * (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    return im;
  };
  const lo = firstMesh(rockLo), hi = firstMesh(rockHi);
  const pebbles = Array.from({ length: nCh }, () => []), rocks = Array.from({ length: nCh }, () => []);
  const nPeb = Math.round((z1 - z0) * (low ? 0.8 : 3.0));
  for (let k = 0; k < nPeb; k++) {
    const z = z0 + r() * (z1 - z0), side = r() < 0.55 ? 1 : -1;
    // thick at the asphalt edge, thinning across the gravel, a few out onto the bank
    const t = Math.pow(r(), 1.5), d = side * (HALF - 0.15 + t * (SH - HALF + (side > 0 ? 5 : 3)));
    const x = road.xAt(z) + d, y = yAt(x, z); if (y == null) continue;
    const s = (0.3 + Math.pow(r(), 2.2) * 1.7) * (1 - 0.35 * t);   // 5-60 cm stones
    pebbles[Math.min(nCh - 1, Math.floor((z - z0) / CH))].push({ x, y: y - 0.045 * s /* a third sunk in */, z, s, ax: 0.8 + r() * 0.5, ay: 0.6 + r() * 0.5, az: 0.8 + r() * 0.5, rx: r() * 0.6, ry: r() * 6.3, rz: r() * 0.6, l: 0.8 + r() * 0.7 });
  }
  const nRock = Math.round((z1 - z0) * (low ? 0.025 : 0.06));
  for (let k = 0; k < nRock; k++) {
    const z = z0 + r() * (z1 - z0), side = r() < 0.65 ? 1 : -1;
    const d = side * (SH + 0.5 + r() * (side > 0 ? 16 : 7));
    const x = road.xAt(z) + d, y = yAt(x, z); if (y == null) continue;
    const s = 3 + Math.pow(r(), 2) * 9;
    rocks[Math.min(nCh - 1, Math.floor((z - z0) / CH))].push({ x, y: y - 0.04 * s, z, s, ax: 0.8 + r() * 0.6, ay: 0.5 + r() * 0.5, az: 0.8 + r() * 0.6, rx: (r() - 0.5) * 0.4, ry: r() * 6.3, rz: (r() - 0.5) * 0.4, l: 0.5 + r() * 0.35 });
  }
  const stoneChunks = []; // distance-culled: pebbles within 160 m, rocks within 400 m (the road runs straight ahead for 1 km)
  for (let c = 0; c < nCh; c++) {
    const ctr = new THREE.Vector3(road.xAt(z0 + (c + 0.5) * CH), 0, z0 + (c + 0.5) * CH);
    if (pebbles[c].length) { const m = stoneMesh(lo, pebbles[c], 'roadside-pebbles', 0.9); group.add(m); stoneChunks.push({ m, ctr, r: 120 + CH / 2 }); }
    if (rocks[c].length) { const m = stoneMesh(hi, rocks[c], 'roadside-rocks', 0.8); group.add(m); stoneChunks.push({ m, ctr, r: 400 + CH / 2 }); }
  }
  // ---- scrub and coarse grass (desktop): real instanced meshes (reduced-LOD scans, a little wind) within ~45 m of
  // the camera, in 40 m chunks shown by distance and dithered out between 40 and 52 m, where impostors baked from the
  // same scans fade in; every plant stands on the ground (the corridor height under its base)
  let batch = null, nPlants = 0, baked0 = null;
  const near = [], uWind = { value: 0 }, uViewPos = { value: new THREE.Vector3() };
  if (shrub && shrubMid && shrubLo) {
    const P = [];
    const nShrub = Math.round((z1 - z0) * 0.75), nGrass = Math.round((z1 - z0) * 1.8);
    const place = (n, model, nearD, far, scale) => {
      for (let k = 0; k < n; k++) {
        const z = z0 + r() * (z1 - z0), side = r() < 0.6 ? 1 : -1;
        const d = side * (nearD + Math.pow(r(), 1.6) * (side > 0 ? far : far * 0.5)); // dense near the shoulder
        const x = road.xAt(z) + d, y = yAt(x, z); if (y == null) continue;
        const sz = scale[0] + Math.pow(r(), 1.6) * (scale[1] - scale[0]);
        const tint = 0.6 + r() * 0.5;
        P.push({ x, y: y - 0.04, z, yaw: r() * 6.3, sx: sz * (0.8 + r() * 0.4), sy: sz * (0.7 + r() * 0.6), model, t: [tint, tint * (0.95 + r() * 0.1), tint * 0.85] });
      }
    };
    place(nShrub, 0, SH + 0.4, 22, [2.8, 8.0]);   // shrub_04 is 0.58 m across: 1.6 - 4.6 m clumps
    place(nGrass, 1, SH - 0.3, 20, [0.9, 2.2]);   // low ground cover: the same scrub scan, small (0.5 - 1.3 m), a lighter LOD
    // (the Grass Bermuda scan read as pale spikes under this lighting; it stays out of the near field and the impostors)
    nPlants = P.length;
    const sm = firstMesh(shrub);
    const baked = baked0 = bakeImpostors([sm], { label: 'roadside plants', name: 'roadside-plant', cellPx: 128, texSize: 1024, alphaTest: 0.4 });
    if (baked) {
      batch = new ImpostorBatch(baked, { capacity: P.length, fade: { start: 20, end: 28 }, color: new THREE.Color(0.62, 0.6, 0.5) });
      batch.material.envMapIntensity = 1.6; batch.mesh.name = 'roadside-plants-far';
      P.forEach((q, i) => { batch.setInstance(i, q.x, q.y, q.z, q.yaw, q.sx, q.sy, 0); batch.setColor(i, ...q.t); });
      batch.count = P.length;
      group.add(batch.mesh);
    }
    // near-field meshes: one material per plant with wind and the distance dither
    const plantMat = (src, name) => {
      const mat = src.material.clone(); mat.side = THREE.DoubleSide; mat.envMapIntensity = 1.2; mat.metalness = 0; mat.metalnessMap = null; // (the glTF leaves metallic at its default 1)
      mat.color.setRGB(0.62, 0.6, 0.5);
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uWind = uWind; sh.uniforms.uViewPos2 = uViewPos;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind; varying vec3 vPlantW;')
          .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), 0.65)); // foliage: lit like a canopy, not like blades')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
  float sway = sin(uWind * 1.6 + ph) * 0.6 + sin(uWind * 3.7 + ph * 2.0) * 0.25;
  transformed.xz += vec2(sway, sway * 0.6) * 0.18 * max(transformed.y, 0.0);
  vPlantW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#endif`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uViewPos2; varying vec3 vPlantW;')
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  { float dd = distance(vPlantW, uViewPos2); float k = smoothstep(20.0, 28.0, dd);
    float bayer = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + 0.125 * mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0) + 0.0625);
    if (k > bayer) discard; }`);
      };
      mat.customProgramCacheKey = () => `roadside-plant-${name}`;
      return mat;
    };
    // near field: decimated copies with the scan's own normals kept, ~1,560 triangles (scrub) and ~530 (ground cover),
    // within ~26 m in 20 m chunks; impostors of the full scan beyond
    const lodMesh = [firstMesh(shrubMid), firstMesh(shrubLo)];
    const mats = [plantMat(lodMesh[0], 'scrub'), plantMat(lodMesh[1], 'cover')];
    const NC = 20, nn = Math.ceil((z1 - z0) / NC);
    const buckets = Array.from({ length: nn }, () => [[], []]);
    for (const q of P) buckets[Math.min(nn - 1, Math.floor((q.z - z0) / NC))][q.model].push(q);
    for (let c = 0; c < nn; c++) {
      const cg = new THREE.Group(); cg.name = 'roadside-plants-near'; cg.visible = false;
      cg.userData.center = new THREE.Vector3(road.xAt(z0 + (c + 0.5) * NC), 0, z0 + (c + 0.5) * NC);
      for (let mdl = 0; mdl < 2; mdl++) {
        const list = buckets[c][mdl]; if (!list.length) continue;
        const im = new THREE.InstancedMesh(lodMesh[mdl].geometry, mats[mdl], list.length);
        list.forEach((q, i) => {
          e.set(0, q.yaw, 0); qq.setFromEuler(e);
          m4.compose(p.set(q.x, q.y, q.z), qq, sc.set(q.sx, q.sy, q.sx));
          im.setMatrixAt(i, m4); im.setColorAt(i, col.setRGB(...q.t));
        });
        im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = true;
        cg.add(im);
      }
      group.add(cg); near.push(cg);
    }
    for (const lm of lodMesh) { lm.geometry.computeBoundingSphere(); freeGeo(lm.geometry); }
  }
  // ---- ground cover (desktop): grass clumps as crossed alpha cards (a blade texture painted in code, wind, dense near
  // the road and thinning with distance), dead palm fronds and coconut husks on the ground, driftwood and seaweed on
  // the beach side, the odd can or tyre scrap in the gravel. Per 40 m chunk, drawn within ~90 m.
  const coverChunks = [];
  if (!low) {
    const blade = bladeTexture(), frondT = frondTexture();
    const grassMat = new THREE.MeshStandardMaterial({ map: blade, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.92, color: new THREE.Color(1, 1, 1), name: 'roadside-grass' }); // (alpha-tested, depth written: no sorting, little overdraw)
    grassMat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = uWind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind; varying float vGy;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
#if defined(USE_INSTANCING) && defined(USE_MAP)
  vMapUv.x = vMapUv.x * 0.5 + step(0.5, fract(instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.71)) * 0.5;   // atlas half per clump
#endif`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  vGy = position.y;
#ifdef USE_INSTANCING
  { float ph = instanceMatrix[3].x * 0.53 + instanceMatrix[3].z * 0.29; float sw = sin(uWind * 2.2 + ph) * 0.5 + sin(uWind * 4.1 + ph * 1.7) * 0.2;
    transformed.xz += vec2(sw, sw * 0.5) * 0.12 * position.y * position.y; }
#endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGy;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.6, vGy));   // darker in the clump\'s heart')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.06 * smoothstep(0.3, 1.0, vGy);   // a little light through the blades');
    };
    grassMat.customProgramCacheKey = () => 'roadside-grass';
    const frondMat = new THREE.MeshStandardMaterial({ map: frondT, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95, name: 'roadside-deadfrond' });
    const husk = new THREE.IcosahedronGeometry(0.13, 1); husk.scale(1, 0.8, 1.2);
    const huskMat = new THREE.MeshStandardMaterial({ color: 0x5a4126, roughness: 0.95 });
    const drift = new THREE.CylinderGeometry(0.06, 0.09, 1, 6, 3); drift.rotateZ(Math.PI / 2);
    { const pa = drift.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) + Math.sin(pa.getX(i) * 3.0) * 0.03); drift.computeVertexNormals(); }
    const driftMat = new THREE.MeshStandardMaterial({ color: 0x8c8172, roughness: 0.9 });
    const weed = new THREE.PlaneGeometry(1, 0.25, 6, 1); weed.rotateX(-Math.PI / 2); weed.translate(0, 0.01, 0);
    const weedMat = new THREE.MeshStandardMaterial({ color: 0x2c2716, roughness: 0.6, side: THREE.DoubleSide });
    const can = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10); can.rotateZ(Math.PI / 2);
    const canMat = new THREE.MeshStandardMaterial({ color: 0x8a2a24, metalness: 0.8, roughness: 0.35 });
    const tyre = new THREE.TorusGeometry(0.3, 0.09, 6, 12, Math.PI * 0.9); tyre.rotateX(Math.PI / 2);
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 });
    const frondG = new THREE.PlaneGeometry(1, 0.25, 4, 1); { const pa = frondG.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + 0.5) * Math.PI) * 0.05); } frondG.rotateX(-Math.PI / 2); frondG.translate(0, 0.04, 0);
    const KINDS = [
      { geo: grassClump(4, 5), mat: grassMat, perM: 60, near: HALF + 0.2, far: 22, s: [0.2, 1.0], up: true, grass: true, name: 'roadside-grass' },
      { geo: grassClump(3, 9), mat: grassMat, perM: 22, near: HALF + 0.4, far: 18, s: [0.5, 1.1], up: true, grass: true, creep: true, name: 'roadside-creep' },
      { geo: thatchCard(), mat: grassMat, perM: 10, near: HALF + 0.5, far: 18, s: [0.5, 1.4], grass: true, flat: true, name: 'roadside-thatch' },
      { geo: frondG, mat: frondMat, perM: 0.25, near: SH - 0.5, far: 18, s: [2.2, 3.4], name: 'roadside-deadfronds' },
      { geo: husk, merge: true, col: [0.35, 0.25, 0.15], perM: 0.35, near: SH - 0.8, far: 14, s: [0.8, 1.3], name: 'roadside-husks' },
      { geo: drift, merge: true, col: [0.55, 0.5, 0.44], perM: 0.08, near: SH + 14, far: 10, s: [1.2, 3.2], side: 1, name: 'roadside-driftwood' },
      { geo: weed, merge: true, col: [0.17, 0.15, 0.09], perM: 0.25, near: SH + 15, far: 9, s: [1.5, 3.5], side: 1, name: 'roadside-seaweed' },
      { geo: can, merge: true, col: [0.55, 0.16, 0.14], perM: 0.03, near: HALF + 0.1, far: 2.0, s: [1, 1], name: 'roadside-litter' },
      { geo: tyre, merge: true, col: [0.05, 0.05, 0.05], perM: 0.008, near: HALF + 0.4, far: 3, s: [0.8, 1.1], name: 'roadside-litter' },
    ];
    const CC = 60, nc = Math.ceil((z1 - z0) / CC);
    const debrisMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, name: 'roadside-debris' });
    const buck = Array.from({ length: nc }, () => KINDS.map(() => []));
    KINDS.forEach((K, ki) => {
      const n = Math.round((z1 - z0) * K.perM);
      for (let k = 0; k < n; k++) {
        const z = z0 + r() * (z1 - z0), side = K.side || (r() < 0.55 ? 1 : -1);
        // thinning with distance from the road: most near the shoulder
        const d = side * (K.near + Math.pow(r(), K.up ? 1.8 : 1.2) * (side > 0 ? K.far : K.far * 0.6));
        const x = road.xAt(z) + d, y = yAt(x, z); if (y == null) continue;
        let sc = K.s[0] + r() * (K.s[1] - K.s[0]), col3 = null, sy = 1, sw = 1;
        if (K.grass) {
          // patches and bare gaps from the density map; denser = taller and greener; hue patches from a second field
          const dens = grassDensity(d, z), keepP = K.flat ? 1 - Math.abs(dens - 0.45) * 2 : (dens - 0.32) / 0.38;
          if (r() > Math.max(0, Math.min(1, keepP))) continue;
          const hue = _vn(d / 4 + 40, z / 6), v = 0.8 + r() * 0.35;
          const straw = [0.92, 0.8, 0.52], olive = [0.6, 0.6, 0.36], green = [0.4, 0.52, 0.24];
          const mix3 = (a, b, t) => a.map((x2, i) => x2 + (b[i] - x2) * t);
          col3 = (hue < 0.5 ? mix3(straw, olive, hue * 2) : mix3(olive, green, (hue - 0.5) * 2)).map((x2) => x2 * v);
          if (K.flat) col3 = mix3(col3, straw, 0.6);
          sc *= 0.7 + 0.6 * Math.min(1, Math.max(0, dens)); sw = 0.6 + r() * 0.9; sy = K.creep ? 0.14 + r() * 0.12 : 0.7 + r() * 0.8;
        }
        buck[Math.min(nc - 1, Math.floor((z - z0) / CC))][ki].push({ x, y, z, sc, sw, sy, col3, yaw: r() * 6.3, tilt: K.up ? (r() - 0.5) * (K.grass ? 0.6 : 0.2) : (r() - 0.5) * 0.15, tint: 0.75 + r() * 0.45 });
      }
    });
    for (let c = 0; c < nc; c++) {
      const cg = new THREE.Group(); cg.name = 'roadside-cover'; cg.userData.ctr = new THREE.Vector3(road.xAt(z0 + (c + 0.5) * CC), 0, z0 + (c + 0.5) * CC);
      const debris = [];
      KINDS.forEach((K, ki) => {
        const L = buck[c][ki]; if (!L.length) return;
        if (K.merge) { // small solid debris: baked into one vertex-coloured mesh per chunk (one draw)
          for (const q2 of L) {
            e.set(q2.tilt, q2.yaw, 0); qq.setFromEuler(e); m4.compose(p.set(q2.x, q2.y - 0.01, q2.z), qq, sc.set(q2.sc, q2.sc, q2.sc));
            const g = (K.geo.index ? K.geo.toNonIndexed() : K.geo.clone()).applyMatrix4(m4);
            for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
            const n = g.attributes.position.count, cc = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { cc[i * 3] = K.col[0] * q2.tint; cc[i * 3 + 1] = K.col[1] * q2.tint; cc[i * 3 + 2] = K.col[2] * q2.tint; }
            g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); debris.push(g);
          }
          return;
        }
        const im = new THREE.InstancedMesh(K.geo, K.mat, L.length);
        L.forEach((q2, i) => {
          e.set(q2.tilt, q2.yaw, K.up ? q2.tilt * 0.5 : 0); qq.setFromEuler(e);
          if (K.grass) m4.compose(p.set(q2.x, q2.y - (K.up ? 0.05 : 0.0), q2.z), qq, sc.set(q2.sc * q2.sw, K.flat ? 1 : q2.sc * q2.sy, q2.sc * q2.sw));
          else m4.compose(p.set(q2.x, q2.y - (K.up ? 0.03 : 0.01), q2.z), qq, sc.set(q2.sc, K.up ? q2.sc * (0.8 + q2.tint * 0.4) : q2.sc, q2.sc));
          im.setMatrixAt(i, m4);
          if (q2.col3) im.setColorAt(i, col.setRGB(q2.col3[0], q2.col3[1], q2.col3[2])); else im.setColorAt(i, col.setRGB(q2.tint, q2.tint, q2.tint * 0.95));
        });
        im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
        im.castShadow = false; im.receiveShadow = true; im.name = K.name; cg.add(im);
      });
      if (debris.length) { const dm = new THREE.Mesh(mergeGeometries(debris), debrisMat); dm.name = 'roadside-debris'; dm.receiveShadow = true; cg.add(dm); }
      group.add(cg); coverChunks.push(cg);
    }
  }
  freeGeo(lo.geometry); freeGeo(hi.geometry);
  o.scene.add(group);
  const _c = new THREE.Vector3();
  const opt = { plants: true, stones: true, cover: true };
  const textures = [batch && batch.material.userData && batch.material.userData.uAtlasTex, ...(baked0 ? [baked0.albedo, baked0.normal] : []), scan.road && scan.road.diff, scan.road && scan.road.nor, scan.road && scan.road.rough, scan.bank && scan.bank.diff, scan.bank && scan.bank.nor, scan.bank && scan.bank.rough].filter(Boolean);
  return {
    group, textures, opt,
    /** per frame: camera (impostor view, near-field chunks), darkness 0..1 (dusk albedo lift), dt (wind) */
    update(camera, darkness = 1, dt = 1 / 60) {
      if (batch) { batch.update(camera.position); batch.mesh.visible = opt.plants; }
      uViewPos.value.copy(camera.position); uWind.value += dt;
      road.mat.userData.uDusk.value = Math.min(1, Math.max(0, (darkness - 0.15) / 0.35));
      for (const cg of near) { _c.copy(cg.userData.center); _c.y = camera.position.y; cg.visible = opt.plants && _c.distanceTo(camera.position) < 32; }
      for (const s of stoneChunks) { _c.copy(s.ctr); _c.y = camera.position.y; s.m.visible = opt.stones && _c.distanceTo(camera.position) < s.r; }
      for (const cg of coverChunks) { _c.copy(cg.userData.ctr); _c.y = camera.position.y; cg.visible = opt.cover && _c.distanceTo(camera.position) < 75; }
    },
    stats: { pebbles: pebbles.reduce((a, l) => a + l.length, 0), rocks: rocks.reduce((a, l) => a + l.length, 0), plants: nPlants, nearChunks: near.length, chunks: nCh, stoneTris: Math.round(tris), roadScan: !!scan.road, bankScan: !!scan.bank },
  };
}
