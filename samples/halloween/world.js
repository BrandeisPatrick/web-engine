// The level: a moonlit valley with a pumpkin patch (west), a fenced graveyard with a crypt (north-east), a haunted
// house (north-west), a witch's cauldron (south-east), dead trees, dirt paths from the spawn, a picket fence around the
// playable square and low hills beyond it. Built once at load:
//   - terrain: one displaced plane (vertex colours: grass / paths / graveyard soil) on the PhysicsWorld heightfield
//   - static props: ONE merged vertex-coloured mesh (stones, fences, trees, house, crypt, scarecrow, bales, cauldron)
//     + ONE merged unlit glow mesh (windows, candles, cauldron brew), so the whole level is a handful of draw calls
//   - instanced decor pumpkins + leaves (1 draw each), grass tufts (1 draw; fewer on phones)
//   - sky dressing: a big moon billboard + halo and a ring of tree-line silhouettes, both depth-less (the post fog reads
//     them as sky) and following the camera
// Colliders go to the PhysicsWorld as static boxes (gravestones, fences, trunks, buildings). Exposes the spots the
// game needs: lantern positions, ghost spawn points, a candy spawn sampler.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvas, finishTexture, mulberry32 } from '@vibe/engine/render';

export const PLAY = 50;     // fence half size (m): the playable square
export const HALF = 64;     // terrain half size
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ------------------------------------------------------------------ paths (polylines, metres)
export const PATHS = [
  [[0, 6], [3, -3], [10, -7], [16, -10], [16, -24]],         // spawn -> graveyard gate -> aisle
  [[0, 6], [-7, 7], [-16, 10], [-26, 15], [-36, 19]],         // -> pumpkin patch
  [[0, 6], [-4, -8], [-13, -20], [-24, -30]],                // -> haunted house
  [[0, 6], [7, 12], [15, 19], [22, 24]],                     // -> cauldron
  [[0, 6], [2, 18], [-2, 32], [4, 44]],                      // -> south field
];
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  const x = ax + dx * t - px, z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}
export function pathDist(x, z) {
  let d = Infinity;
  for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) d = Math.min(d, segDist(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
  return d;
}

// ------------------------------------------------------------------ regions
export const GRAVEYARD = { x0: 8, x1: 46, z0: -46, z1: -10, gate: [13.5, 18.5] };
export const PATCH = { x0: -47, x1: -12, z0: -3, z1: 42 };
export const HOUSE = { x: -31, z: -37, w: 11, d: 9, yaw: 0.25 };
export const CRYPT = { x: 35, z: -38 };
export const CAULDRON = { x: 25, z: 27 };
export const SCARECROW = { x: -29, z: 22 };
const inGraveyard = (x, z, m = 0) => x > GRAVEYARD.x0 - m && x < GRAVEYARD.x1 + m && z > GRAVEYARD.z0 - m && z < GRAVEYARD.z1 + m;
const inPatch = (x, z, m = 0) => x > PATCH.x0 - m && x < PATCH.x1 + m && z > PATCH.z0 - m && z < PATCH.z1 + m;

/** Terrain height (m): gentle rolls inside the fence, hills rising outside it, path beds sunk 6 cm. */
export function heightAt(x, z) {
  let h = 0.5 * Math.sin(x * 0.071 + 0.4) * Math.cos(z * 0.063 - 0.8) + 0.28 * Math.sin(x * 0.17 + 1.3) * Math.sin(z * 0.13 + 0.4)
    + 0.08 * Math.sin(x * 0.41 + z * 0.37);
  const r = Math.max(Math.abs(x), Math.abs(z));
  const e = smooth((r - PLAY + 1) / 12);
  h += e * (5 + 2.5 * Math.sin(x * 0.11 + z * 0.07));
  const pd = pathDist(x, z);
  if (pd < 1.6) h -= 0.06 * (1 - pd / 1.6);
  return h;
}

// ------------------------------------------------------------------ geometry helpers
const _col = new THREE.Color();
/** Prepare a primitive for merging: indexed, no uv, a colour attribute (linear, may exceed 1 for glow). */
function paint(g, color, scale = 1) {
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
function place(g, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  return g.applyMatrix4(_m);
}

class Batch {
  constructor() { this.parts = []; }
  add(g, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx, glow = 1) {
    this.parts.push(place(paint(g, color, glow), x, y, z, ry, rx, rz, sx, sy, sz));
  }
  build(material, name) {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name;
    return mesh;
  }
}

// ------------------------------------------------------------------ textures
function groundDetailTexture(renderer) {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d');
  const img = g.createImageData(S, S), d = img.data, rnd = mulberry32(7);
  for (let i = 0; i < S * S; i++) { const v = 200 + rnd() * 55; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  // soft blotches (clumps and bare patches)
  for (let k = 0; k < 90; k++) {
    const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 26, a = 0.05 + rnd() * 0.12, dark = rnd() < 0.6;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return finishTexture(new THREE.CanvasTexture(c), renderer, false); // a linear albedo multiplier (0.78..1), repeating
}

/** Moon disc with maria and a soft limb, plus a separate glow texture. */
function moonTextures() {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d'), rnd = mulberry32(31);
  const R = S * 0.46;
  const gr = g.createRadialGradient(S * 0.46, S * 0.44, R * 0.1, S / 2, S / 2, R);
  gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.7, '#f3e7c4'); gr.addColorStop(1, '#d9c79c');
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.clip();
  for (let k = 0; k < 26; k++) {
    const x = S / 2 + (rnd() - 0.5) * R * 1.7, y = S / 2 + (rnd() - 0.5) * R * 1.7, r = 4 + rnd() * (k < 6 ? 34 : 12);
    g.fillStyle = `rgba(150,130,100,${0.16 + rnd() * 0.22})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  const disc = new THREE.CanvasTexture(c); disc.colorSpace = THREE.SRGBColorSpace;
  const c2 = makeCanvas(128), g2 = c2.getContext('2d');
  const h = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  h.addColorStop(0, 'rgba(255,240,210,0.55)'); h.addColorStop(0.25, 'rgba(230,200,255,0.22)'); h.addColorStop(0.6, 'rgba(160,110,220,0.07)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = h; g2.fillRect(0, 0, 128, 128);
  const halo = new THREE.CanvasTexture(c2); halo.colorSpace = THREE.SRGBColorSpace;
  return { disc, halo };
}

/** Tree-line silhouettes for the horizon ring (alpha only; tiles 4x around). */
function skylineTexture() {
  const W = 1024, H = 128, c = makeCanvas(W, H), g = c.getContext('2d'), rnd = mulberry32(5);
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff';
  // rolling ground line
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H - 18 - 10 * Math.sin(x * 0.012) - 6 * Math.sin(x * 0.041 + 1));
  g.lineTo(W, H); g.closePath(); g.fill();
  // bare trees: trunks + forked branches
  const branch = (x, y, len, a, w, depth) => {
    const x1 = x + Math.sin(a) * len, y1 = y - Math.cos(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
    if (depth > 0) for (let k = 0; k < 2 + (rnd() < 0.4 ? 1 : 0); k++) branch(x1, y1, len * (0.55 + rnd() * 0.2), a + (rnd() - 0.5) * 1.4, w * 0.6, depth - 1);
  };
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  for (let x = 10; x < W; x += 22 + rnd() * 40) {
    if (rnd() < 0.18) continue;
    const base = H - 16 - 10 * Math.sin(x * 0.012);
    branch(x, base, 16 + rnd() * 30, (rnd() - 0.5) * 0.3, 2.5 + rnd() * 3, 3);
  }
  // a distant church spire and a windmill
  g.fillRect(610, H - 70, 14, 60); g.beginPath(); g.moveTo(606, H - 70); g.lineTo(617, H - 104); g.lineTo(628, H - 70); g.fill();
  g.fillRect(300, H - 58, 10, 40);
  g.lineWidth = 3; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; g.beginPath(); g.moveTo(305, H - 58); g.lineTo(305 + Math.cos(a) * 24, H - 58 + Math.sin(a) * 24); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1);
  return t;
}

// ------------------------------------------------------------------ props
function deadTree(B, x, z, s, rnd, physics) {
  const y = heightAt(x, z) - 0.15;
  const bark = rnd() < 0.5 ? '#2e2530' : '#3a2e33';
  const limb = (x0, y0, z0, len, r, yaw, pitch, depth) => {
    const g = new THREE.CylinderGeometry(r * 0.62, r, len, depth >= 2 ? 6 : 4, 1, true).translate(0, len / 2, 0);
    // orientation: tilt `pitch` from vertical toward `yaw`
    _q.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ'));
    _m.compose(_p.set(x0, y0, z0), _q, _s.set(1, 1, 1));
    g.applyMatrix4(_m);
    B.parts.push(paint(g, bark));
    const tip = new THREE.Vector3(0, len, 0).applyQuaternion(_q).add(new THREE.Vector3(x0, y0, z0));
    if (depth <= 0) return;
    const n = depth >= 2 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const yw = yaw + (k / n) * Math.PI * 2 + rnd() * 1.2;
      limb(tip.x, tip.y, tip.z, len * (0.5 + rnd() * 0.25), r * 0.6, yw, pitch * 0.5 + 0.45 + rnd() * 0.5, depth - 1);
    }
  };
  const h = (2.4 + rnd() * 1.6) * s;
  limb(x, y, z, h, 0.22 * s, rnd() * 6.28, (rnd() - 0.5) * 0.15, 3);
  // roots
  for (let k = 0; k < 4; k++) B.add(new THREE.ConeGeometry(0.12 * s, 0.7 * s, 5).rotateZ(Math.PI / 2 - 0.25).translate(0.3 * s, 0.05, 0), bark, x, y + 0.1, z, k * 1.57 + rnd());
  physics.addStaticBox(x - 0.28 * s, y - 1, x + 0.28 * s, y + h, z - 0.28 * s, z + 0.28 * s);
}

function gravestone(B, x, z, kind, rnd, physics) {
  const y = heightAt(x, z), yaw = (rnd() - 0.5) * 0.25, tilt = (rnd() - 0.5) * 0.18, roll = (rnd() - 0.5) * 0.14;
  const shade = ['#6f6b78', '#5f5b69', '#7d7886', '#565264'][Math.floor(rnd() * 4)];
  let w = 0.7, h = 1, d = 0.2;
  if (kind === 0) { // rounded slab
    w = 0.7 + rnd() * 0.2; h = 0.85 + rnd() * 0.35;
    B.add(new THREE.BoxGeometry(w, h - w / 2, d), shade, x, y + (h - w / 2) / 2 - 0.05, z, yaw, tilt, roll);
    B.add(new THREE.CylinderGeometry(w / 2, w / 2, d, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), shade, x, y + h - w / 2 - 0.05, z, yaw, tilt, roll);
  } else if (kind === 1) { // cross
    h = 1.3 + rnd() * 0.3; w = 0.6;
    B.add(new THREE.BoxGeometry(0.16, h, 0.14), shade, x, y + h / 2 - 0.05, z, yaw, tilt, roll);
    B.add(new THREE.BoxGeometry(w, 0.15, 0.14), shade, x, y + h * 0.72, z, yaw, tilt, roll);
  } else if (kind === 2) { // obelisk
    h = 1.6 + rnd() * 0.6; w = 0.42;
    B.add(new THREE.CylinderGeometry(0.15, 0.24, h, 4).rotateY(Math.PI / 4), shade, x, y + h / 2, z, yaw, tilt * 0.4, 0);
    B.add(new THREE.ConeGeometry(0.17, 0.3, 4).rotateY(Math.PI / 4), shade, x, y + h + 0.13, z, yaw, tilt * 0.4, 0);
    B.add(new THREE.BoxGeometry(0.6, 0.18, 0.6), '#4f4b59', x, y + 0.05, z, yaw);
  } else { // low marker + grave mound
    h = 0.5; w = 0.6;
    B.add(new THREE.BoxGeometry(w, h, 0.16), shade, x, y + h / 2 - 0.05, z, yaw, tilt * 2, roll);
  }
  // mound in front of each stone (soil)
  B.add(new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.22, 1.8), '#2b2026', x + Math.sin(yaw) * 1.1, y - 0.03, z + Math.cos(yaw) * 1.1, yaw);
  const hw = Math.max(w, d) / 2 + 0.05;
  physics.addStaticBox(x - hw, y - 1, x + hw, y + h, z - 0.18, z + 0.18);
  return { x, z, y };
}

function ironFence(B, ax, az, bx, bz, physics, gap = null) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.2)), dx = (bx - ax) / n, dz = (bz - az) / n, yaw = Math.atan2(dx, dz);
  const IRON = '#1a1720';
  for (let i = 0; i <= n; i++) {
    const x = ax + dx * i, z = az + dz * i;
    if (gap && i > 0 && i < n && gap(x, z)) continue;
    const y = heightAt(x, z);
    B.add(new THREE.BoxGeometry(0.06, 1.5, 0.06), IRON, x, y + 0.72, z);
    B.add(new THREE.ConeGeometry(0.06, 0.18, 4), IRON, x, y + 1.55, z);
    if (i < n && !(gap && gap(x + dx / 2, z + dz / 2))) {
      const y1 = (y + heightAt(x + dx, z + dz)) / 2, l = Math.hypot(dx, dz);
      for (const hh of [0.35, 1.25]) B.add(new THREE.BoxGeometry(0.04, 0.05, l), IRON, x + dx / 2, y1 + hh, z + dz / 2, yaw);
      for (let k = 1; k < 4; k++) { // thin bars between posts
        const f = k / 4, xx = x + dx * f, zz = z + dz * f, yy = heightAt(xx, zz);
        B.add(new THREE.BoxGeometry(0.025, 1.3, 0.025), IRON, xx, yy + 0.65, zz);
        B.add(new THREE.ConeGeometry(0.035, 0.12, 4), IRON, xx, yy + 1.36, zz);
      }
    }
  }
}

function picketFence(B, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 2.5), dx = (bx - ax) / n, dz = (bz - az) / n, yaw = Math.atan2(dx, dz);
  const WOOD = '#4a3a33', WOOD2 = '#3b2e2a';
  for (let i = 0; i <= n; i++) {
    const x = ax + dx * i, z = az + dz * i, y = heightAt(x, z), lean = Math.sin(i * 7.3) * 0.08;
    B.add(new THREE.BoxGeometry(0.14, 1.3, 0.14), WOOD, x, y + 0.6, z, yaw, lean, 0);
    if (i < n) {
      const y1 = (y + heightAt(x + dx, z + dz)) / 2, l = Math.hypot(dx, dz) + 0.1;
      B.add(new THREE.BoxGeometry(0.06, 0.12, l), WOOD2, x + dx / 2, y1 + 0.45, z + dz / 2, yaw, 0, Math.sin(i) * 0.03);
      B.add(new THREE.BoxGeometry(0.06, 0.12, l), WOOD2, x + dx / 2, y1 + 0.95, z + dz / 2, yaw, 0, Math.sin(i * 1.7) * 0.04);
    }
  }
}

function house(B, G, physics) {
  const { x, z, w, d, yaw } = HOUSE, y = heightAt(x, z) - 0.2;
  const WALL = '#2d2534', WALL2 = '#3a2f43', ROOF = '#1c1622', TRIM = '#4b3d55';
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const box = (bw, bh, bd, lx, ly, lz, col, ry = 0) => { const [px, pz] = L(lx, lz); B.add(new THREE.BoxGeometry(bw, bh, bd), col, px, y + ly, pz, yaw + ry); };
  box(w, 6, d, 0, 3, 0, WALL);
  box(w + 0.3, 0.25, d + 0.3, 0, 6.1, 0, TRIM);
  // gable roof: a triangular prism along x
  { const g = new THREE.CylinderGeometry(1, 1, w + 0.8, 3, 1).rotateZ(Math.PI / 2).scale(1, 3.6 / 1.5, (d + 1) / 1.73); const [px, pz] = L(0, 0); B.add(g, ROOF, px, y + 6.2 + 1.2, pz, yaw); }
  // tower with a cone roof (front-left)
  box(3.2, 9.5, 3.2, -w / 2 + 1, 4.75, d / 2 - 1, WALL2);
  { const [px, pz] = L(-w / 2 + 1, d / 2 - 1); B.add(new THREE.ConeGeometry(2.5, 4.2, 8), ROOF, px, y + 9.5 + 2.1, pz, yaw); B.add(new THREE.ConeGeometry(0.06, 1.2, 4), '#111', px, y + 14.3, pz); }
  // porch + door
  box(3.6, 0.3, 1.6, 1.2, 0.15, d / 2 + 0.8, TRIM);
  for (const sx of [-1.6, 4]) box(0.2, 2.8, 0.2, sx, 1.6, d / 2 + 1.5, TRIM);
  box(4.2, 0.2, 1.9, 1.2, 3, d / 2 + 0.8, ROOF);
  box(1.3, 2.3, 0.1, 1.2, 1.4, d / 2 + 0.03, '#120c10');
  // glowing windows (front, side, tower): warm and one sickly green
  const win = (lx, ly, lz, ww, hh, col, k = 3) => { const [px, pz] = L(lx, lz); G.add(new THREE.PlaneGeometry(ww, hh), col, px, y + ly, pz, yaw, 0, 0, 1, 1, 1, k); };
  for (const [lx, ly] of [[-2.2, 2.2], [3.6, 2.2], [-2.2, 4.6], [1.2, 4.6], [3.6, 4.6]]) win(lx, ly, d / 2 + 0.06, 1, 1.3, ly > 4 && lx > 3 ? '#9dff7a' : '#ffb347', 3.2);
  win(-w / 2 + 1, 7.6, d / 2 + 0.56, 0.9, 1.2, '#ffcf6a', 4);
  win(-w / 2 + 1, 4.2, d / 2 + 0.56, 0.8, 1.1, '#ff9a3a', 3);
  // window frames (crosses) in front of the glow
  for (const [lx, ly] of [[-2.2, 2.2], [3.6, 2.2], [-2.2, 4.6], [1.2, 4.6], [3.6, 4.6]]) { box(1.1, 0.08, 0.06, lx, ly, d / 2 + 0.1, '#140f15'); box(0.08, 1.4, 0.06, lx, ly, d / 2 + 0.1, '#140f15'); }
  // collider: the rotated footprint's bounding box (house + tower + porch)
  const pts = [L(-w / 2 - 0.2, -d / 2), L(w / 2, -d / 2), L(w / 2, d / 2 + 1.6), L(-w / 2 - 0.2, d / 2 + 1.6)];
  physics.addStaticBox(Math.min(...pts.map((p) => p[0])) + 0.4, y - 1, Math.max(...pts.map((p) => p[0])) - 0.4, y + 9, Math.min(...pts.map((p) => p[1])) + 0.4, Math.max(...pts.map((p) => p[1])) - 0.4);
}

function crypt(B, G, physics) {
  const { x, z } = CRYPT, y = heightAt(x, z) - 0.15, STONE = '#57525f', DARK = '#3b3743';
  B.add(new THREE.BoxGeometry(5, 3.4, 4.4), STONE, x, y + 1.7, z);
  B.add(new THREE.BoxGeometry(5.6, 0.35, 5), DARK, x, y + 3.5, z);
  B.add(new THREE.CylinderGeometry(1, 1, 5.4, 3, 1).rotateX(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 1.4 / 1.5, 1).rotateY(Math.PI / 2), DARK, x, y + 4.15, z, 0, 0, 0, 1, 1, 1);
  for (const sx of [-1.8, 1.8]) B.add(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 10), '#6a6574', x + sx, y + 1.6, z + 2.45);
  B.add(new THREE.BoxGeometry(1.6, 2.4, 0.1), '#0c0a0e', x, y + 1.2, z + 2.22);
  B.add(new THREE.BoxGeometry(3.6, 0.3, 1.2), DARK, x, y + 0.1, z + 2.9);
  // candles by the door (glow) + an eerie green crack of light under the door
  for (const sx of [-0.9, 0.9]) { B.add(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), '#d8d0c0', x + sx, y + 0.37, z + 2.75); G.add(new THREE.SphereGeometry(0.06, 6, 4).scale(1, 1.6, 1), '#ffcc66', x + sx, y + 0.57, z + 2.75, 0, 0, 0, 1, 1, 1, 5); }
  G.add(new THREE.PlaneGeometry(1.4, 0.08), '#7dff9a', x, y + 0.06, z + 2.28, 0, 0, 0, 1, 1, 1, 4);
  physics.addStaticBox(x - 2.6, y - 1, x + 2.6, y + 4.5, z - 2.3, z + 2.5);
}

function cauldron(B, G, physics) {
  const { x, z } = CAULDRON, y = heightAt(x, z);
  B.add(new THREE.SphereGeometry(0.85, 16, 10, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), '#16141a', x, y + 0.75, z);
  B.add(new THREE.TorusGeometry(0.66, 0.07, 6, 18).rotateX(Math.PI / 2), '#26232b', x, y + 1.24, z);
  for (let k = 0; k < 3; k++) { const a = k * 2.094; B.add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 5), '#16141a', x + Math.cos(a) * 0.55, y + 0.15, z + Math.sin(a) * 0.55, 0, Math.cos(a) * 0.3, Math.sin(a) * 0.3); }
  for (let k = 0; k < 9; k++) { const a = k * 0.698; B.add(new THREE.DodecahedronGeometry(0.22, 0), '#4a4550', x + Math.cos(a) * 1.25, y + 0.05, z + Math.sin(a) * 1.25, a, 0.3, 0.2, 1, 0.6, 1); }
  // logs and embers under it
  for (let k = 0; k < 3; k++) B.add(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6).rotateZ(Math.PI / 2), '#2c1d14', x, y + 0.1, z, k * 1.05);
  G.add(new THREE.SphereGeometry(0.3, 8, 4).scale(1.6, 0.25, 1.6), '#ff6a1a', x, y + 0.12, z, 0, 0, 0, 1, 1, 1, 3);
  G.add(new THREE.CircleGeometry(0.62, 18).rotateX(-Math.PI / 2), '#5dff6e', x, y + 1.18, z, 0, 0, 0, 1, 1, 1, 2.6);
  physics.addStaticBox(x - 0.95, y - 1, x + 0.95, y + 1.25, z - 0.95, z + 0.95);
}

function scarecrow(B, G, physics) {
  const { x, z } = SCARECROW, y = heightAt(x, z);
  B.add(new THREE.CylinderGeometry(0.07, 0.08, 2.6, 6), '#3d2c1e', x, y + 1.3, z);
  B.add(new THREE.CylinderGeometry(0.05, 0.05, 2, 6).rotateZ(Math.PI / 2), '#3d2c1e', x, y + 1.85, z);
  B.add(new THREE.CylinderGeometry(0.3, 0.42, 0.9, 8), '#5a3d6e', x, y + 1.5, z);                   // purple coat
  B.add(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 6).rotateZ(Math.PI / 2), '#5a3d6e', x - 0.55, y + 1.85, z);
  B.add(new THREE.CylinderGeometry(0.16, 0.1, 0.8, 6).rotateZ(Math.PI / 2), '#5a3d6e', x + 0.55, y + 1.85, z);
  for (const sx of [-1.02, 1.02]) B.add(new THREE.ConeGeometry(0.1, 0.25, 6).rotateZ(sx > 0 ? -Math.PI / 2 : Math.PI / 2), '#c9a24a', x + sx, y + 1.85, z);
  B.add(new THREE.SphereGeometry(0.3, 12, 8).scale(1, 0.85, 1), '#ff7a1a', x, y + 2.3, z);           // pumpkin head
  B.add(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 12), '#2a2030', x, y + 2.52, z);
  B.add(new THREE.ConeGeometry(0.22, 0.5, 10), '#2a2030', x, y + 2.78, z, 0, -0.25, 0.1);
  G.add(new THREE.PlaneGeometry(0.28, 0.12), '#ffd27a', x, y + 2.32, z + 0.29, 0, 0, 0, 1, 1, 1, 3);
  physics.addStaticBox(x - 0.3, y - 1, x + 0.3, y + 2.6, z - 0.3, z + 0.3);
}

function hayBale(B, x, z, ry, physics) {
  const y = heightAt(x, z);
  B.add(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 14).rotateZ(Math.PI / 2), '#a8843f', x, y + 0.55, z, ry);
  for (const k of [-0.3, 0.3]) B.add(new THREE.TorusGeometry(0.6, 0.02, 4, 16).rotateY(Math.PI / 2), '#6b5126', x + Math.cos(ry) * k, y + 0.55, z - Math.sin(ry) * k, ry);
  physics.addStaticBox(x - 0.65, y - 1, x + 0.65, y + 1.1, z - 0.65, z + 0.65);
}

/** Ribbed pumpkin sitting on y = 0 (radius r), with a stem; vertex coloured (body white-ish for instance tint). */
export function pumpkinGeometry(r = 0.4, ws = 16, hs = 11, bodyColor = '#ffffff', stemColor = '#4d6a2a') {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), rib = 1 - 0.09 * Math.pow(Math.abs(Math.sin(a * 4)), 0.7), yy = y / r;
    x *= rib; z *= rib; y *= 0.78;
    if (yy > 0.75) y -= (yy - 0.75) * 0.5 * r;
    p.setXYZ(i, x, y + 0.76 * r, z);
  }
  g.computeVertexNormals();
  paint(g, bodyColor);
  const stem = paint(new THREE.CylinderGeometry(0.032 * r / 0.4, 0.05 * r / 0.4, 0.17 * r / 0.4, 6).rotateZ(0.25).translate(0.01, 1.42 * r, 0), stemColor);
  const out = mergeGeometries([g, stem]);
  g.dispose(); stem.dispose();
  return out;
}

// ------------------------------------------------------------------ build
export function buildWorld({ scene, renderer, physics, low }) {
  const rnd = mulberry32(2026);
  physics.setHeightfield(heightAt);
  const B = new Batch(), G = new Batch();

  // ---- terrain
  const N = low ? 96 : 140;
  const tg = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N, N).rotateX(-Math.PI / 2);
  {
    const p = tg.attributes.position, c = new Float32Array(p.count * 3);
    const grass = new THREE.Color('#24331f'), grass2 = new THREE.Color('#2f3a1f'), dirt = new THREE.Color('#4a3729'), soil = new THREE.Color('#2a2a2c'), hill = new THREE.Color('#1d2420'), patch = new THREE.Color('#3a3420');
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, heightAt(x, z));
      const n = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2) * Math.cos(z * 0.27 - x * 0.05);
      tmp.copy(grass).lerp(grass2, n);
      if (inGraveyard(x, z, 2)) tmp.lerp(soil, 0.55 * smooth(1 - Math.max(0, Math.max(GRAVEYARD.x0 - x, x - GRAVEYARD.x1, GRAVEYARD.z0 - z, z - GRAVEYARD.z1)) / 2));
      if (inPatch(x, z, 2)) tmp.lerp(patch, 0.45);
      const pd = pathDist(x, z);
      if (pd < 1.7) tmp.lerp(dirt, smooth((1.7 - pd) / 0.8));
      const r = Math.max(Math.abs(x), Math.abs(z));
      if (r > PLAY) tmp.lerp(hill, smooth((r - PLAY) / 8));
      c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(c, 3));
    tg.computeVertexNormals();
    const uv = tg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 3.2, p.getZ(i) / 3.2);
  }
  const detail = groundDetailTexture(renderer);
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96, metalness: 0 }));
  terrain.name = 'terrain'; terrain.receiveShadow = true;
  scene.add(terrain);

  // ---- graveyard: stones in rows, an aisle up the middle, the crypt at the back, an iron fence with a gate
  const graves = [];
  for (let zz = GRAVEYARD.z1 - 4.5; zz > GRAVEYARD.z0 + 2.5; zz -= 3.6) {
    for (let xx = GRAVEYARD.x0 + 2.5; xx < GRAVEYARD.x1 - 2; xx += 3.1) {
      const x = xx + (rnd() - 0.5) * 0.9, z = zz + (rnd() - 0.5) * 0.7;
      if (Math.abs(x - 16) < 2.2) continue;                                  // the aisle
      if (Math.hypot(x - CRYPT.x, z - CRYPT.z) < 5.5) continue;
      if (rnd() < 0.17) continue;
      const k = rnd(), kind = k < 0.45 ? 0 : k < 0.7 ? 1 : k < 0.85 ? 2 : 3;
      graves.push(gravestone(B, x, z, kind, rnd, physics));
    }
  }
  const G0 = GRAVEYARD, gateGap = (x, z) => Math.abs(z - G0.z1) < 0.3 && x > G0.gate[0] && x < G0.gate[1];
  ironFence(B, G0.x0, G0.z1, G0.x1, G0.z1, physics, gateGap);
  ironFence(B, G0.x1, G0.z1, G0.x1, G0.z0, physics);
  ironFence(B, G0.x1, G0.z0, G0.x0, G0.z0, physics);
  ironFence(B, G0.x0, G0.z0, G0.x0, G0.z1, physics);
  // fence colliders (the gate is open)
  physics.addStaticBox(G0.x0 - 0.1, -5, G0.gate[0], 6, G0.z1 - 0.1, G0.z1 + 0.1);
  physics.addStaticBox(G0.gate[1], -5, G0.x1 + 0.1, 6, G0.z1 - 0.1, G0.z1 + 0.1);
  physics.addStaticBox(G0.x0 - 0.1, -5, G0.x1 + 0.1, 6, G0.z0 - 0.1, G0.z0 + 0.1);
  physics.addStaticBox(G0.x0 - 0.1, -5, G0.x0 + 0.1, 6, G0.z0, G0.z1);
  physics.addStaticBox(G0.x1 - 0.1, -5, G0.x1 + 0.1, 6, G0.z0, G0.z1);
  // gate posts with stone caps + an arch sign
  for (const gx of G0.gate) { const y = heightAt(gx, G0.z1); B.add(new THREE.BoxGeometry(0.5, 2.4, 0.5), '#5a5563', gx, y + 1.2, G0.z1); B.add(new THREE.SphereGeometry(0.28, 10, 8), '#6b6675', gx, y + 2.6, G0.z1); }
  { const y = heightAt(16, G0.z1); B.add(new THREE.TorusGeometry(2.5, 0.06, 4, 20, Math.PI), '#1a1720', 16, y + 2.3, G0.z1); }
  crypt(B, G, physics);

  // ---- haunted house, cauldron, scarecrow, hay bales
  house(B, G, physics);
  cauldron(B, G, physics);
  scarecrow(B, G, physics);
  for (const [x, z, r] of [[-15, 3, 0.4], [-17, 4.5, 1.2], [-40, 31, 0.2], [-24, 38, 1.5], [-44, 5, 0.9], [9, 30, 0.7]]) hayBale(B, x, z, r, physics);

  // ---- dead trees (kept off paths, buildings and the graveyard aisle)
  const treeSpots = [];
  const okTree = (x, z) => pathDist(x, z) > 3 && Math.hypot(x - HOUSE.x, z - HOUSE.z) > 10 && Math.hypot(x - CAULDRON.x, z - CAULDRON.z) > 5
    && Math.hypot(x - CRYPT.x, z - CRYPT.z) > 6 && Math.hypot(x, z - 6) > 8 && !(inGraveyard(x, z, 1) && Math.abs(x - 16) < 4) && !inPatch(x, z, -2)
    && treeSpots.every(([a, b]) => Math.hypot(a - x, b - z) > 7);
  for (let tries = 0; treeSpots.length < (low ? 16 : 22) && tries < 2000; tries++) {
    const x = (rnd() * 2 - 1) * (PLAY - 3), z = (rnd() * 2 - 1) * (PLAY - 3);
    if (!okTree(x, z)) continue;
    if (inGraveyard(x, z, 0) && graves.some((g) => Math.hypot(g.x - x, g.z - z) < 2)) continue;
    treeSpots.push([x, z]);
    deadTree(B, x, z, 0.85 + rnd() * 0.5, rnd, physics);
  }
  // a few trees outside the fence on the hills (no colliders needed, but harmless)
  for (let k = 0; k < (low ? 10 : 18); k++) {
    const a = rnd() * Math.PI * 2, r = PLAY + 4 + rnd() * 8;
    deadTree(B, Math.cos(a) * r, Math.sin(a) * r, 1.1 + rnd() * 0.6, rnd, physics);
  }

  // ---- outer picket fence + its colliders
  const F = PLAY;
  picketFence(B, -F, -F, F, -F); picketFence(B, F, -F, F, F); picketFence(B, F, F, -F, F); picketFence(B, -F, F, -F, -F);
  physics.addStaticBox(-F - 2, -5, F + 2, 8, -F - 2, -F + 0.2);
  physics.addStaticBox(-F - 2, -5, F + 2, 8, F - 0.2, F + 2);
  physics.addStaticBox(-F - 2, -5, -F + 0.2, 8, -F, F);
  physics.addStaticBox(F - 0.2, -5, F + 2, 8, -F, F);

  // ---- merged static meshes
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 });
  const props = B.build(propMat, 'props');
  props.castShadow = true; props.receiveShadow = true;
  scene.add(props);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glow = G.build(glowMat, 'glow');
  scene.add(glow);

  // ---- pumpkin patch: rows of decor pumpkins (instanced) + leaves
  const decor = [];
  for (let zz = PATCH.z0 + 1.5; zz < PATCH.z1 - 1; zz += 3.2) {
    for (let xx = PATCH.x0 + 1.5; xx < PATCH.x1 - 1; xx += 1.7) {
      const x = xx + (rnd() - 0.5) * 0.9, z = zz + (rnd() - 0.5) * 0.8;
      if (pathDist(x, z) < 2 || Math.hypot(x - SCARECROW.x, z - SCARECROW.z) < 2) continue;
      if (rnd() < (low ? 0.45 : 0.3)) continue;
      decor.push([x, z, 0.55 + rnd() * 0.7, rnd() * 6.28, rnd()]);
    }
  }
  for (let k = 0; k < 26; k++) { // strays elsewhere
    const x = (rnd() * 2 - 1) * (PLAY - 4), z = (rnd() * 2 - 1) * (PLAY - 4);
    if (pathDist(x, z) < 2.5 || inGraveyard(x, z, 1) || Math.hypot(x - HOUSE.x, z - HOUSE.z) < 9) continue;
    decor.push([x, z, 0.5 + rnd() * 0.6, rnd() * 6.28, rnd()]);
  }
  const pg = pumpkinGeometry(0.4, low ? 10 : 12, low ? 7 : 8);
  const pMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  const pumpkins = new THREE.InstancedMesh(pg, pMat, decor.length);
  pumpkins.name = 'decorPumpkins'; pumpkins.castShadow = false; pumpkins.receiveShadow = true;
  const leafGeo = new THREE.SphereGeometry(0.3, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.18, 0.7);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#2c4a22', roughness: 0.85 }), decor.length * 2);
  leaves.name = 'leaves'; leaves.receiveShadow = true;
  const tint = new THREE.Color();
  decor.forEach(([x, z, s, yaw, v], i) => {
    const y = heightAt(x, z) - 0.03;
    _q.setFromEuler(_e.set(0, yaw, (v - 0.5) * 0.2));
    pumpkins.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(s, s * (0.85 + v * 0.3), s)));
    if (v < 0.08) tint.set('#e9e2d0'); else if (v < 0.14) tint.set('#6f8a3a'); else tint.setHSL(0.065 + v * 0.03, 0.95, 0.42 + v * 0.1);
    pumpkins.setColorAt(i, tint);
    for (let k = 0; k < 2; k++) {
      const a = yaw + k * 2.6 + 0.6, lx = x + Math.cos(a) * 0.45 * s, lz = z + Math.sin(a) * 0.45 * s;
      _q.setFromEuler(_e.set(0.1, -a, 0));
      leaves.setMatrixAt(i * 2 + k, _m.compose(_p.set(lx, heightAt(lx, lz) + 0.02, lz), _q, _s.set(s * 1.3, s, s * 1.3)));
    }
  });
  pumpkins.instanceMatrix.needsUpdate = true; if (pumpkins.instanceColor) pumpkins.instanceColor.needsUpdate = true;
  pumpkins.computeBoundingSphere(); leaves.computeBoundingSphere();
  scene.add(pumpkins, leaves);

  // ---- grass tufts (crossed blades, instanced)
  let tufts = null;
  {
    const count = low ? 1100 : 2800;
    const blade = [];
    for (let k = 0; k < 5; k++) { // five thin blades leaning out from the centre
      const a = k * 1.2566 + 0.3, ca = Math.cos(a), sa = Math.sin(a), w = 0.022, lean = 0.1 + (k % 2) * 0.06, h = 0.26 + (k % 3) * 0.07;
      blade.push(-sa * w + ca * 0.03, 0, ca * w + sa * 0.03, sa * w + ca * 0.03, 0, -ca * w + sa * 0.03, ca * lean, h, sa * lean);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(blade, 3));
    g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // lit like the ground
    tufts = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: '#3d5a2c', roughness: 0.9, side: THREE.DoubleSide }), count);
    tufts.name = 'grass';
    let n2 = 0;
    for (let tries = 0; n2 < count && tries < count * 4; tries++) {
      const x = (rnd() * 2 - 1) * (PLAY + 6), z = (rnd() * 2 - 1) * (PLAY + 6);
      if (pathDist(x, z) < 1.6 || inPatch(x, z, -1)) continue;
      const s = 0.6 + rnd() * 0.9;
      _q.setFromEuler(_e.set((rnd() - 0.5) * 0.3, rnd() * 6.28, 0));
      tufts.setMatrixAt(n2, _m.compose(_p.set(x, heightAt(x, z) - 0.02, z), _q, _s.set(s, s * (0.8 + rnd() * 0.9), s)));
      tint.setHSL(0.22 + rnd() * 0.1, 0.45, 0.2 + rnd() * 0.12); tufts.setColorAt(n2, tint);
      n2++;
    }
    tufts.count = n2;
    tufts.instanceMatrix.needsUpdate = true; tufts.instanceColor.needsUpdate = true;
    tufts.computeBoundingSphere();
    tufts.receiveShadow = true;
    scene.add(tufts);
  }

  // ---- sky dressing: moon billboard + halo, horizon silhouettes (depth-less: the post fog sees sky there)
  const moonTex = moonTextures();
  const moonMat = new THREE.MeshBasicMaterial({ map: moonTex.disc, transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.6, 1.5, 1.3) });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1, 48), moonMat);
  moon.name = 'moon'; moon.renderOrder = 1; moon.frustumCulled = false;
  const haloMat = new THREE.MeshBasicMaterial({ map: moonTex.halo, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.2, 1.1, 1.3) });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), haloMat);
  halo.renderOrder = 0; halo.frustumCulled = false;
  scene.add(halo, moon);
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 56, 48, 1, true).translate(0, 12, 0),
    new THREE.MeshBasicMaterial({ color: '#07040d', alphaMap: skylineTexture(), transparent: true, depthWrite: false, side: THREE.BackSide, fog: false }));
  sky.name = 'skyline'; sky.renderOrder = 2; sky.frustumCulled = false;
  scene.add(sky);
  const _moonDir = new THREE.Vector3();

  // ---- spots for the game
  const lanternSpots = [
    [-20, 4], [-26, 9], [-34, 6], [-41, 12], [-22, 20], [-37, 24], [-44, 30], [-27, 31], [-18, 37], [-34, 38], // patch
    [12.5, -14], [24, -19], [41, -17], [21, -33], [37, -28], [12, -41], [28, -43],                             // graveyard
    [4.5, -3.5], [-9, 9.5], [10, 15], [-11, -16], [-21, -28], [19, 25], [29, 31], [31, 6], [41, 37], [-4, 28], [7, 42], [44, 8], [-44, -12], [-6, -40], [43, -2],
  ].filter(([x, z]) => physics.queryColliders(x, z, 0.7, []).length === 0);
  const ghostSpawns = graves.map((g) => [g.x, g.z]).concat([[CRYPT.x, CRYPT.z + 3.5], [HOUSE.x + 2, HOUSE.z + 7]]);
  const _cols = [];
  /** A random free spot for a candy (inside the fence, not in a collider, away from (ax, az)). */
  const candySpot = (out, ax = 1e9, az = 1e9, minDist = 6) => {
    for (let t = 0; t < 40; t++) {
      // half the candies near paths and in the graveyard / patch (where the action is), the rest anywhere
      let x, z;
      const k = rnd();
      if (k < 0.3) { const P = PATHS[Math.floor(rnd() * PATHS.length)], i = Math.floor(rnd() * (P.length - 1)), f = rnd(); x = P[i][0] + (P[i + 1][0] - P[i][0]) * f + (rnd() - 0.5) * 3; z = P[i][1] + (P[i + 1][1] - P[i][1]) * f + (rnd() - 0.5) * 3; }
      else if (k < 0.5) { x = GRAVEYARD.x0 + 1 + rnd() * (GRAVEYARD.x1 - GRAVEYARD.x0 - 2); z = GRAVEYARD.z0 + 1 + rnd() * (GRAVEYARD.z1 - GRAVEYARD.z0 - 2); }
      else if (k < 0.65) { x = PATCH.x0 + rnd() * (PATCH.x1 - PATCH.x0); z = PATCH.z0 + rnd() * (PATCH.z1 - PATCH.z0); }
      else { x = (rnd() * 2 - 1) * (PLAY - 3); z = (rnd() * 2 - 1) * (PLAY - 3); }
      if (Math.abs(x) > PLAY - 2 || Math.abs(z) > PLAY - 2) continue;
      if ((x - ax) * (x - ax) + (z - az) * (z - az) < minDist * minDist) continue;
      _cols.length = 0;
      if (physics.queryColliders(x, z, 0.6, _cols).length) continue;
      out[0] = x; out[1] = heightAt(x, z); out[2] = z;
      return true;
    }
    return false;
  };

  return {
    terrain, props, glow, pumpkins, leaves, tufts, moon, halo, sky, lanternSpots, ghostSpawns, graves, candySpot, heightAt,
    /** Per frame: the sky dressing follows the camera (moon along the atmosphere's moon direction). */
    update(camera, moonDir) {
      const cp = camera.position;
      _moonDir.copy(moonDir).normalize();
      const D = 420, R = 30;
      moon.position.copy(cp).addScaledVector(_moonDir, D);
      moon.lookAt(cp); moon.scale.setScalar(R);
      halo.position.copy(cp).addScaledVector(_moonDir, D + 5);
      halo.lookAt(cp); halo.scale.setScalar(R * 4.2);
      sky.position.set(cp.x, 0, cp.z);
    },
  };
}
