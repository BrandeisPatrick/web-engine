#!/usr/bin/env node
// Bake people for the samples: avatars of the Microsoft Rocketbox Avatar Library (MIT, Copyright (c) 2020 Microsoft:
// https://github.com/microsoft/Microsoft-Rocketbox) into one compact GLB each under samples/public/people/. The source
// is an FBX in centimetres with 2048 px TGA textures per body part and 81 bones; a baked person is in metres, feet at
// y = 0, facing +Z, with
//   - one opaque primitive (body and head on one 1536 x 1024 JPEG atlas) and, when the avatar has hair cards, one
//     alpha-tested primitive (512 px PNG): 1 or 2 draw calls
//   - quantised vertices (KHR_mesh_quantization: 8-bit normals and weights, 16-bit UVs), welded and indexed
//   - the body skeleton only: the facial bones are folded into the head (about 50 joints with the fingers)
//   - the clips Idle, Walk and Run from the library's animation set (m_ / f_ by sex): rotations only, the root's
//     height scaled to the avatar's legs and its feet put on the ground, keys reduced, 16-bit quaternions
//   - a `_PEOPLE` vertex attribute (three reads it as `_people`) for the engine's people shader (world/People.js):
//     R = cloth on the upper body, G = cloth on the legs (both 0 on skin, hair and shoes, so a tint changes the
//     clothes only), B = ambient occlusion. Other glTF viewers ignore it
// The files are parsed with three's FBXLoader in Node (no native converter). Nothing here runs in the package.
//
//   node tools/bake-people.mjs --src <dir> [--out samples/public/people] [--only id,id] [--fetch] [--dry-run]
//   export async function bakePeople(opts)         (same options, camelCase)
// <dir> holds the source files as the library lays them out (only the files named below are read):
//   <dir>/Avatars/Adults/<Avatar>/Export/<Avatar>.fbx, <dir>/Avatars/Adults/<Avatar>/Textures/*.tga and
//   <dir>/Animations/all_animations_max_motextr_{static,xy}/<clip>.max.fbx
// --fetch downloads the missing ones from raw.githubusercontent.com first (about 90 MB per avatar, the TGAs).
// To add a person: add a row to PEOPLE, bake, add the file to tools/asset-registry.mjs and to the CREDITS.md.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as THREE from 'three';
import { runCli } from './cli.mjs';

/** The baked people: id (file name), the library's avatar folder, sex (which animation set), what they wear. */
export const PEOPLE = [
  { id: 'man-grey-jacket', avatar: 'Male_Adult_07', sex: 'm', note: 'grey jacket, jeans' },
  { id: 'man-blazer', avatar: 'Male_Adult_03', sex: 'm', note: 'older, grey blazer, dark trousers' },
  { id: 'man-hooded-jacket', avatar: 'Male_Adult_04', sex: 'm', note: 'dark hooded jacket, khaki trousers' },
  { id: 'man-denim-jacket', avatar: 'Male_Adult_12', sex: 'm', note: 'denim jacket, light jeans' },
  { id: 'woman-leather-jacket', avatar: 'Female_Adult_04', sex: 'f', note: 'brown leather jacket, khaki trousers, boots' },
  { id: 'woman-dark-jacket', avatar: 'Female_Adult_07', sex: 'f', note: 'dark jacket, jeans, boots' },
  { id: 'woman-blazer', avatar: 'Female_Adult_09', sex: 'f', note: 'beige blazer, black trousers' },
  { id: 'woman-beige-jacket', avatar: 'Female_Adult_14', sex: 'f', note: 'beige jacket, dark jeans, boots' },
];
/** Clip name -> the library's animation (folder, file with the sex prefix), whether it loops and its sample rate. */
export const CLIPS = {
  Idle: { dir: 'all_animations_max_motextr_static', file: 'idle_neutral_01', fps: 15 },
  Walk: { dir: 'all_animations_max_motextr_xy', file: 'walk_neutral_02', fps: 30 }, // 1.35 m/s (m), 1.32 (f)
  Run: { dir: 'all_animations_max_motextr_xy', file: 'run_fast_01', fps: 30 },      // 5.8 m/s (m), 5.4 (f)
};
export const SOURCE = { repo: 'https://github.com/microsoft/Microsoft-Rocketbox', raw: 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets', licence: 'MIT', copyright: 'Copyright (c) 2020 Microsoft' };
export const ATLAS = { w: 1536, h: 1024, slots: [[0, 0, 1024, 1024], [1024, 0, 512, 512], [1024, 512, 512, 512]], hair: 512 };

export const SPEC = {
  src: { type: 'string', def: '', help: 'folder with the library files (Avatars/, Animations/)' },
  out: { type: 'string', def: 'samples/public/people', help: 'output directory' },
  only: { type: 'string', def: '', help: 'bake only these ids (comma separated)' },
  fetch: { type: 'bool', def: false, help: 'download missing source files first' },
  quality: { type: 'number', def: 84, help: 'JPEG quality of the atlas' },
  'dry-run': { type: 'bool', def: false, help: 'print the plan only (no network, no files)' },
};

// ------------------------------------------------------------------------------------------------ images
/** Decode a true-colour TGA (type 2, or 10 = run-length) to top-down RGBA. */
export function decodeTga(b) {
  const idLen = b[0], type = b[2], w = b.readUInt16LE(12), h = b.readUInt16LE(14), bpp = b[16], topDown = !!(b[17] & 0x20);
  if ((type !== 2 && type !== 10) || (bpp !== 24 && bpp !== 32)) throw new Error(`TGA type ${type} with ${bpp} bits is not supported`);
  const ch = bpp / 8, n = w * h, px = Buffer.alloc(n * ch);
  let p = 18 + idLen;
  if (type === 2) b.copy(px, 0, p, p + n * ch);
  else for (let o = 0; o < n * ch;) {
    const c = b[p++], len = ((c & 127) + 1) * ch;
    if (c & 128) { for (let i = 0; i < len; i++) px[o + i] = b[p + (i % ch)]; p += ch; } else { b.copy(px, o, p, p + len); p += len; }
    o += len;
  }
  const data = new Uint8Array(n * 4);
  for (let y = 0; y < h; y++) {
    const sy = topDown ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const s = (sy * w + x) * ch, d = (y * w + x) * 4;
      data[d] = px[s + 2]; data[d + 1] = px[s + 1]; data[d + 2] = px[s]; data[d + 3] = ch === 4 ? px[s + 3] : 255;
    }
  }
  return { width: w, height: h, data, alpha: ch === 4 };
}

/** Area-average resize of an RGBA image. With `weighted` the colour is weighted by alpha (no dark fringe at a cut-out). */
export function resizeImage(im, W, H, weighted = false) {
  const out = new Uint8Array(W * H * 4), kx = im.width / W, ky = im.height / H;
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * ky), y1 = Math.max(y0 + 1, Math.floor((y + 1) * ky));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * kx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * kx));
      let r = 0, g = 0, b = 0, a = 0, wsum = 0, n = 0;
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
        const s = (j * im.width + i) * 4, wt = weighted ? im.data[s + 3] + 1e-3 : 1;
        r += im.data[s] * wt; g += im.data[s + 1] * wt; b += im.data[s + 2] * wt; a += im.data[s + 3]; wsum += wt; n++;
      }
      const d = (y * W + x) * 4;
      out[d] = Math.round(r / wsum); out[d + 1] = Math.round(g / wsum); out[d + 2] = Math.round(b / wsum); out[d + 3] = Math.round(a / n);
    }
  }
  return { width: W, height: H, data: out, alpha: im.alpha };
}

/** Spread the colour of covered texels into the empty ones next to them (`rounds` texels far), so filtering finds hair. */
function dilateColour(im, rounds = 6) {
  const { width: W, height: H, data } = im;
  let has = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) has[i] = data[i * 4 + 3] > 8 ? 1 : 0;
  for (let k = 0; k < rounds; k++) {
    const next = has.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (has[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!has[j]) continue;
        r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++;
      }
      if (n) { data[i * 4] = r / n; data[i * 4 + 1] = g / n; data[i * 4 + 2] = b / n; next[i] = 1; }
    }
    has = next;
  }
  // what is still empty takes the mean colour (PNG then stores long runs of one value)
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < W * H; i++) if (has[i]) { r += data[i * 4]; g += data[i * 4 + 1]; b += data[i * 4 + 2]; n++; }
  if (n) for (let i = 0; i < W * H; i++) if (!has[i]) { data[i * 4] = r / n; data[i * 4 + 1] = g / n; data[i * 4 + 2] = b / n; }
  return im;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Encode RGBA as a PNG (8 bits, the filter per row that leaves the smallest residual). */
export function encodePng(im) {
  const { width: W, height: H, data } = im, stride = W * 4, raw = Buffer.alloc((stride + 1) * H);
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < H; y++) {
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      let sum = 0; const c = cand[f];
      for (let i = 0; i < stride; i++) {
        const v = data[y * stride + i], a = i >= 4 ? data[y * stride + i - 4] : 0, b = y ? data[(y - 1) * stride + i] : 0, cc = y && i >= 4 ? data[(y - 1) * stride + i - 4] : 0;
        let pr = 0;
        if (f === 1) pr = a; else if (f === 2) pr = b; else if (f === 3) pr = (a + b) >> 1;
        else if (f === 4) { const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : cc; }
        const d = (v - pr) & 255; c[i] = d; sum += d < 128 ? d : 256 - d;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    raw[y * (stride + 1)] = best; cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), body]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------------------------------------ FBX
let _fbx = null;
/** Parse an FBX with three's FBXLoader in Node. Textures are not loaded: each map's file name is in map.userData.file. */
async function parseFbx(file) {
  if (!_fbx) {
    // the loader builds <img> elements for the embedded / referenced images: give it inert ones
    globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
    globalThis.window ??= globalThis;
    _fbx = (await import('three/addons/loaders/FBXLoader.js')).FBXLoader;
  }
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\.tga$/i, { setPath() { return this; }, load(url) { const t = new THREE.Texture(); t.userData.file = path.basename(String(url).replace(/\\/g, '/')); return t; } });
  const buf = fs.readFileSync(file), warn = console.warn;
  console.warn = () => {};
  try { return new _fbx(manager).parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), ''); } finally { console.warn = warn; }
}

const V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), M = new THREE.Matrix4();

/**
 * The avatar as plain arrays: the kept bones (parents first; local rest pose in metres, inverse bind matrices), the
 * welded vertices of each part and the texture files. Facial bones are folded into the head.
 */
function readAvatar(root) {
  root.updateMatrixWorld(true);
  const meshes = []; root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  if (!meshes.length) throw new Error('no skinned mesh in the FBX');
  const skel = meshes[0].skeleton;
  for (const m of meshes) if (m.skeleton.bones.length !== skel.bones.length || m.skeleton.bones.some((b, i) => b !== skel.bones[i])) throw new Error('the meshes do not share one skeleton');
  const head = skel.bones.find((b) => /Head$/.test(b.name));
  const underHead = (b) => { for (let p = b.parent; p; p = p.parent) if (p === head) return true; return false; };
  // which source bone each skin index ends on (a facial bone -> the head)
  const target = skel.bones.map((b) => (head && underHead(b) ? head : b));
  const used = new Set();
  const parts = new Map(); // texture file -> { file, alpha, verts: Map(key -> index), pos, nrm, uv, ji, jw, idx }
  const part = (file, alpha) => { if (!parts.has(file)) parts.set(file, { file, alpha, keys: new Map(), pos: [], nrm: [], uv: [], ji: [], jw: [], idx: [] }); return parts.get(file); };
  const n3 = new THREE.Matrix3();
  for (const mesh of meshes) {
    const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const bind = M.copy(mesh.bindMatrix); n3.getNormalMatrix(bind);
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : P.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0], file = mat.map && mat.map.userData.file;
      if (!file) throw new Error(`material ${mat.name} has no texture file`);
      const pt = part(file, /opacity/i.test(file) || /opacity/i.test(mat.name));
      for (let k = gr.start; k < gr.start + gr.count; k++) {
        const i = g.index ? g.index.getX(k) : k;
        V.fromBufferAttribute(P, i).applyMatrix4(bind).multiplyScalar(0.01);
        const px = V.x, py = V.y, pz = V.z;
        V.fromBufferAttribute(N, i).applyMatrix3(n3).normalize();
        const nx = Math.round(V.x * 127), ny = Math.round(V.y * 127), nz = Math.round(V.z * 127);
        const u = U.getX(i), v = 1 - U.getY(i);
        // skin: fold onto the kept bones, merge, keep the 4 largest, 8-bit weights that sum to 255
        const acc = new Map();
        for (let c = 0; c < 4; c++) { const w = SW.getComponent(i, c); if (w > 0) { const b = target[SI.getComponent(i, c)]; acc.set(b, (acc.get(b) || 0) + w); } }
        const inf = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = inf.reduce((s, x) => s + x[1], 0) || 1;
        const w8 = inf.map((x) => Math.round(x[1] / sum * 255)); w8[0] += 255 - w8.reduce((s, x) => s + x, 0);
        for (const [b] of inf) used.add(b);
        const key = `${px.toFixed(5)},${py.toFixed(5)},${pz.toFixed(5)},${nx},${ny},${nz},${u.toFixed(5)},${v.toFixed(5)},${inf.map((x, c) => `${x[0].id}:${w8[c]}`).join(',')}`;
        let vi = pt.keys.get(key);
        if (vi === undefined) {
          vi = pt.pos.length / 3; pt.keys.set(key, vi);
          pt.pos.push(px, py, pz); pt.nrm.push(nx, ny, nz); pt.uv.push(u, v);
          for (let c = 0; c < 4; c++) { pt.ji.push(inf[c] ? inf[c][0] : null); pt.jw.push(inf[c] ? w8[c] : 0); }
        }
        pt.idx.push(vi);
      }
    }
  }
  // kept bones: the weighted ones and their ancestors that are bones, parents first
  const keep = new Set();
  for (const b of used) for (let p = b; p && p.isBone; p = p.parent) keep.add(p);
  const bones = [];
  const walk = (o) => { if (o.isBone && keep.has(o)) bones.push(o); for (const c of o.children) walk(c); };
  walk(root);
  const index = new Map(bones.map((b, i) => [b, i]));
  const out = bones.map((b) => {
    const parent = b.parent && index.has(b.parent) ? index.get(b.parent) : -1;
    const local = parent < 0 ? b.matrixWorld.clone() : new THREE.Matrix4().copy(b.parent.matrixWorld).invert().multiply(b.matrixWorld);
    local.decompose(V, Q, S);
    if (Math.abs(S.x - 1) > 1e-3 || Math.abs(S.y - 1) > 1e-3 || Math.abs(S.z - 1) > 1e-3) throw new Error(`bone ${b.name} is scaled (${S.toArray()})`);
    const si = skel.bones.indexOf(b), ibm = si >= 0 ? skel.boneInverses[si].clone() : b.matrixWorld.clone().invert(); // (a bone without weights)
    ibm.elements[12] *= 0.01; ibm.elements[13] *= 0.01; ibm.elements[14] *= 0.01;
    return { name: b.name, parent, t: [V.x * 0.01, V.y * 0.01, V.z * 0.01], r: [Q.x, Q.y, Q.z, Q.w], ibm: ibm.elements.slice() };
  });
  for (const pt of parts.values()) { pt.ji = pt.ji.map((b) => (b ? index.get(b) : 0)); delete pt.keys; }
  return { bones: out, parts: [...parts.values()] };
}

// ------------------------------------------------------------------------------------------------ animation
/** Sample a clip of an animation FBX on the avatar's bones: per bone a quaternion per frame, and the root's position. */
function sampleClip(animRoot, avatar, fps) {
  const clip = animRoot.animations[0];
  if (!clip) throw new Error('no animation in the FBX');
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1), dt = clip.duration / (frames - 1);
  const track = (name) => clip.tracks.find((t) => t.name === name);
  const interp = (t) => (t ? t.createInterpolant() : null);
  const rot = avatar.bones.map((b) => interp(track(`${b.name}.quaternion`)));
  const rootName = avatar.bones[0].name, pos = interp(track(`${rootName}.position`));
  const quats = avatar.bones.map((b, i) => (rot[i] ? new Float32Array(frames * 4) : null)), rootPos = pos ? new Float32Array(frames * 3) : null;
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f * dt);
    avatar.bones.forEach((b, i) => { if (rot[i]) quats[i].set(rot[i].evaluate(t), f * 4); });
    if (pos) rootPos.set(pos.evaluate(t), f * 3);
  }
  // the animation skeleton's legs, to scale the root's motion to the avatar's
  const leg = (name) => { const o = animRoot.getObjectByName(name); return o ? o.position.length() * 0.01 : 0; };
  return { frames, dt, duration: clip.duration, quats, rootPos, legs: leg('Bip01_L_Calf') + leg('Bip01_L_Foot') };
}

/** Make a sampled clip loop: when the last frame is not the first, blend the last `n` frames into the first. */
function closeLoop(c, n) {
  const a = new THREE.Quaternion(), b = new THREE.Quaternion();
  for (const q of c.quats) {
    if (!q) continue;
    b.fromArray(q, 0);
    for (let k = 0; k < n; k++) {
      const f = c.frames - n + k, w = (k + 1) / n;
      a.fromArray(q, f * 4).slerp(b, w * w * (3 - 2 * w)).toArray(q, f * 4);
    }
  }
  if (c.rootPos) for (let k = 0; k < n; k++) {
    const f = c.frames - n + k, w = (k + 1) / n, s = w * w * (3 - 2 * w);
    for (let d = 0; d < 3; d++) c.rootPos[f * 3 + d] += (c.rootPos[d] - c.rootPos[f * 3 + d]) * s;
  }
}

/** Keys of a uniformly sampled quaternion track that a slerp between kept keys reproduces within `tol` radians. */
function reduceQuatKeys(q, frames, tol) {
  const keep = [0], a = new THREE.Quaternion(), b = new THREE.Quaternion(), c = new THREE.Quaternion(), m = new THREE.Quaternion();
  let i = 0;
  while (i < frames - 1) {
    let j = i + 1;
    for (let e = i + 2; e < frames; e++) {
      a.fromArray(q, i * 4); b.fromArray(q, e * 4);
      let ok = true;
      for (let k = i + 1; k < e && ok; k++) { m.copy(a).slerp(b, (k - i) / (e - i)); c.fromArray(q, k * 4); if (m.angleTo(c) > tol) ok = false; }
      if (!ok) break;
      j = e;
    }
    keep.push(j); i = j;
  }
  return keep;
}

// ------------------------------------------------------------------------------------------------ glb
class GlbWriter {
  constructor() { this.json = { asset: { version: '2.0' }, buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] }; this.chunks = []; this.length = 0; }
  view(bytes, extra = {}) {
    const pad = (4 - (this.length % 4)) % 4; if (pad) { this.chunks.push(Buffer.alloc(pad)); this.length += pad; }
    const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.json.bufferViews.push({ buffer: 0, byteOffset: this.length, byteLength: b.length, ...extra });
    this.chunks.push(b); this.length += b.length;
    return this.json.bufferViews.length - 1;
  }
  accessor(array, type, componentType, o = {}) {
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const acc = { bufferView: this.view(array, o.view), componentType, count: o.count ?? array.length / size, type };
    if (o.normalized) acc.normalized = true;
    if (o.minmax) {
      const min = new Array(size).fill(Infinity), max = new Array(size).fill(-Infinity);
      for (let i = 0; i < array.length; i++) { const c = i % size; if (array[i] < min[c]) min[c] = array[i]; if (array[i] > max[c]) max[c] = array[i]; }
      acc.min = min; acc.max = max;
    }
    this.json.accessors.push(acc);
    return this.json.accessors.length - 1;
  }
  build() {
    this.json.buffers[0].byteLength = this.length;
    let js = Buffer.from(JSON.stringify(this.json), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
    let bin = Buffer.concat(this.chunks); bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
    const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
    const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([head, jh, js, bh, bin]);
  }
}
const GL = { BYTE: 5120, UBYTE: 5121, SHORT: 5122, USHORT: 5123, UINT: 5125, FLOAT: 5126 };

// ------------------------------------------------------------------------------------------------ the bake
const rgbToHsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; } return [h * 60, mx ? d / mx : 0, mx / 255]; };

/**
 * The `_PEOPLE` attribute of the opaque part: R / G = cloth on the upper body / the legs, B = ambient occlusion.
 * Skin is what looks like this avatar's own hands (their median texel colour is the reference), decided by a majority
 * among the vertices within 5 cm, so a plaid or a khaki close to skin is not speckled: a garment is tinted whole or
 * not at all. Hands, head, neck and shoes (below the ankle) are never cloth. Upper body or legs: by the bones above
 * the hips and below the knees, by the nearer garment colour in between (a coat's hem hangs over the thighs), again
 * by majority. The edges are then softened over 3 cm. The occlusion is a cheap analytic one: under the chin, the
 * armpits, between the legs.
 */
function vertexMasks(pt, avatar, atlas, slotOfVertex) {
  const n = pt.pos.length / 3, col = new Uint8Array(n * 4);
  const bone = (re) => avatar.bones.findIndex((b) => re.test(b.name));
  const world = boneWorld(avatar);
  const y = (re) => { const i = bone(re); return i < 0 ? 0 : world[i].elements[13]; };
  const ankle = y(/L_Foot$/), knee = y(/L_Calf$/), hip = y(/Pelvis$/), neck = y(/Neck$/), headY = y(/Head$/);
  const is = (re) => avatar.bones.map((b) => re.test(b.name));
  const isHand = is(/Hand$|Finger/), isHead = is(/Head$|Neck$/), isShin = is(/Calf$|Foot$|Toe/), isThigh = is(/Thigh$/), isArm = is(/UpperArm$|Forearm$|Clavicle$/);
  const weight = (i, set) => { let w = 0; for (let k = 0; k < 4; k++) if (set[pt.ji[i * 4 + k]]) w += pt.jw[i * 4 + k] / 255; return w; };
  // texel colour at each vertex (a 5 x 5 mean)
  const rgb = new Float32Array(n * 3), hsv = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ax = Math.round(pt.uv[i * 2] * atlas.width), ay = Math.round(pt.uv[i * 2 + 1] * atlas.height);
    let r = 0, g = 0, b = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = ax + dx, yy = ay + dy; if (xx < 0 || yy < 0 || xx >= atlas.width || yy >= atlas.height) continue;
      const s = (yy * atlas.width + xx) * 4; r += atlas.data[s]; g += atlas.data[s + 1]; b += atlas.data[s + 2]; c++;
    }
    rgb.set([r / c, g / c, b / c], i * 3); hsv.set(rgbToHsv(r / c, g / c, b / c), i * 3);
  }
  const median = (list, d) => { const a = list.map((i) => rgb[i * 3 + d]).sort((p, q) => p - q); return a.length ? a[a.length >> 1] : 0; };
  const medianRgb = (list) => [median(list, 0), median(list, 1), median(list, 2)];
  const all = Array.from({ length: n }, (_, i) => i), body = all.filter((i) => slotOfVertex[i] === 0);
  // neighbours within a radius (a grid of that cell size)
  const near = (radius) => {
    const grid = new Map(), key = (x, yy, z) => `${Math.floor(x / radius)},${Math.floor(yy / radius)},${Math.floor(z / radius)}`;
    for (const i of body) { const k = key(pt.pos[i * 3], pt.pos[i * 3 + 1], pt.pos[i * 3 + 2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    return (i, fn) => {
      const x = pt.pos[i * 3], yy = pt.pos[i * 3 + 1], z = pt.pos[i * 3 + 2];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const list = grid.get(key(x + a * radius, yy + b * radius, z + c * radius)); if (!list) continue;
        for (const j of list) if ((pt.pos[j * 3] - x) ** 2 + (pt.pos[j * 3 + 1] - yy) ** 2 + (pt.pos[j * 3 + 2] - z) ** 2 <= radius * radius) fn(j);
      }
    };
  };
  const majority = (flag, each, rounds, among = null) => {
    for (let r = 0; r < rounds; r++) {
      const next = flag.slice();
      for (const i of body) { if (among && !among[i]) continue; let s = 0, c = 0; each(i, (j) => { if (!among || among[j]) { s += flag[j]; c++; } }); if (c) next[i] = s * 2 > c ? 1 : 0; }
      flag.set(next);
    }
  };
  // ---- skin: like the hands
  const hands = body.filter((i) => weight(i, isHand) > 0.6), ref = rgbToHsv(...medianRgb(hands));
  const skin = new Uint8Array(n);
  for (const i of body) {
    let dh = Math.abs(hsv[i * 3] - ref[0]); if (dh > 180) dh = 360 - dh;
    const v = hsv[i * 3 + 2] / Math.max(ref[2], 1e-3);
    skin[i] = hands.length && dh < 14 && Math.abs(hsv[i * 3 + 1] - ref[1]) < 0.2 && v > 0.6 && v < 1.5 ? 1 : 0;
  }
  const near5 = near(0.05);
  majority(skin, near5, 3);
  const cloth = new Uint8Array(n);
  for (const i of body) cloth[i] = !skin[i] && weight(i, isHand) < 0.5 && weight(i, isHead) < 0.4 && pt.pos[i * 3 + 1] > ankle + 0.02 ? 1 : 0;
  // ---- upper body or legs
  const sure = new Int8Array(n); // 1 top, -1 legs, 0 to decide
  for (const i of body) {
    if (!cloth[i]) continue;
    const py = pt.pos[i * 3 + 1];
    if (weight(i, isArm) > 0.5 || py > hip + 0.16) sure[i] = 1; else if (weight(i, isShin) > 0.5 || py < knee + 0.06) sure[i] = -1;
  }
  const refTop = medianRgb(body.filter((i) => sure[i] === 1 && Math.abs(pt.pos[i * 3]) < 0.2 && pt.pos[i * 3 + 1] < neck - 0.08));
  const refLegs = medianRgb(body.filter((i) => sure[i] === -1 && pt.pos[i * 3 + 1] > ankle + 0.1));
  const apart = Math.hypot(refTop[0] - refLegs[0], refTop[1] - refLegs[1], refTop[2] - refLegs[2]) > 28;
  const legs = new Uint8Array(n);
  for (const i of body) {
    if (!cloth[i]) continue;
    if (sure[i]) { legs[i] = sure[i] < 0 ? 1 : 0; continue; }
    const dt = Math.hypot(rgb[i * 3] - refTop[0], rgb[i * 3 + 1] - refTop[1], rgb[i * 3 + 2] - refTop[2]), dl = Math.hypot(rgb[i * 3] - refLegs[0], rgb[i * 3 + 1] - refLegs[1], rgb[i * 3 + 2] - refLegs[2]);
    legs[i] = apart ? (dl < dt ? 1 : 0) : (weight(i, isThigh) + weight(i, isShin) > 0.5 || pt.pos[i * 3 + 1] < hip - 0.04 ? 1 : 0);
  }
  majority(legs, near5, 3, cloth);
  // ---- soft edges, occlusion
  const near3 = near(0.03);
  for (let i = 0; i < n; i++) {
    const px = pt.pos[i * 3], py = pt.pos[i * 3 + 1];
    let top = 0, leg = 0, c = 0;
    if (slotOfVertex[i] === 0) near3(i, (j) => { top += cloth[j] && !legs[j] ? 1 : 0; leg += cloth[j] && legs[j] ? 1 : 0; c++; });
    col[i * 4] = c ? Math.round(255 * top / c) : 0;
    col[i * 4 + 1] = c ? Math.round(255 * leg / c) : 0;
    // occlusion: darker under the chin and jaw, in the armpits, at the crotch and the inner thighs, in the collar
    let ao = 1;
    const ny = pt.nrm[i * 3 + 1] / 127, nx = pt.nrm[i * 3] / 127;
    if (py > neck - 0.03 && py < headY + 0.05 && ny < -0.2) ao -= 0.38 * Math.min(1, (-ny - 0.2) / 0.5);
    if (py > hip + 0.25 && py < neck - 0.04 && Math.abs(px) > 0.1 && Math.abs(px) < 0.26 && ny < -0.25) ao -= 0.3;
    if (py < hip + 0.02 && py > hip - 0.34 && Math.abs(px) < 0.09 && nx * Math.sign(px || 1) < -0.3) ao -= 0.3 * (1 - (hip - py) / 0.4);
    if (weight(i, isHead) < 0.5 && py > neck - 0.1 && py < neck + 0.02 && Math.hypot(px, pt.pos[i * 3 + 2]) < 0.09) ao -= 0.15;
    col[i * 4 + 2] = Math.round(255 * Math.max(0.45, ao));
    col[i * 4 + 3] = 255;
  }
  return col;
}

/** World matrices of the avatar's bones in the rest pose (metres), or with `quats` / `rootPos` of one frame. */
function boneWorld(avatar, frame) {
  const out = [], l = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
  avatar.bones.forEach((b, i) => {
    Q.fromArray(frame && frame.quats[i] ? frame.quats[i] : b.r);
    V.fromArray(i === 0 && frame && frame.rootPos ? frame.rootPos : b.t);
    l.compose(V, Q, one);
    out.push(b.parent < 0 ? l.clone() : new THREE.Matrix4().multiplyMatrices(out[b.parent], l));
  });
  return out;
}

/** Lowest skinned vertex (y) of the avatar in a pose. */
function lowestPoint(avatar, world) {
  const skin = world.map((w, i) => new THREE.Matrix4().multiplyMatrices(w, M.fromArray(avatar.bones[i].ibm)));
  let min = Infinity;
  for (const pt of avatar.parts) for (let i = 0; i < pt.pos.length / 3; i++) {
    let y = 0;
    for (let k = 0; k < 4; k++) {
      const w = pt.jw[i * 4 + k]; if (!w) continue;
      const e = skin[pt.ji[i * 4 + k]].elements;
      y += (e[1] * pt.pos[i * 3] + e[5] * pt.pos[i * 3 + 1] + e[9] * pt.pos[i * 3 + 2] + e[13]) * w / 255;
    }
    if (y < min) min = y;
  }
  return min;
}

/** Bake one person: returns { glb: Buffer, stats }. files: { fbx, tga(name) -> path, clip(name) -> path }. */
export async function bakePerson(person, files, { quality = 84 } = {}) {
  const jpeg = (await import('jpeg-js')).default;
  const avatar = readAvatar(await parseFbx(files.fbx));
  const opaque = avatar.parts.filter((p) => !p.alpha), hair = avatar.parts.filter((p) => p.alpha);
  if (opaque.length > ATLAS.slots.length) throw new Error(`${opaque.length} opaque textures: the atlas has ${ATLAS.slots.length} slots`);
  // the body texture (the one with the most triangles) takes the large slot
  opaque.sort((a, b) => b.idx.length - a.idx.length);

  // ---- atlas
  const atlas = { width: ATLAS.w, height: ATLAS.h, data: new Uint8Array(ATLAS.w * ATLAS.h * 4) };
  opaque.forEach((pt, s) => {
    const [x0, y0, w, h] = ATLAS.slots[s], im = resizeImage(decodeTga(fs.readFileSync(files.tga(pt.file))), w, h);
    for (let y = 0; y < h; y++) atlas.data.set(im.data.subarray(y * w * 4, (y + 1) * w * 4), ((y0 + y) * ATLAS.w + x0) * 4);
  });
  // ---- one opaque part on the atlas
  const body = { pos: [], nrm: [], uv: [], ji: [], jw: [], idx: [] }, slotOfVertex = [];
  opaque.forEach((pt, s) => {
    const base = body.pos.length / 3, [x0, y0, w, h] = ATLAS.slots[s];
    for (let i = 0; i < pt.uv.length / 2; i++) {
      const u = pt.uv[i * 2], v = pt.uv[i * 2 + 1];
      if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) throw new Error(`${pt.file}: UV ${u}, ${v} repeats (cannot go on an atlas)`);
      const inset = 0.5; // half a texel inside the slot, so a neighbour does not bleed in
      body.uv.push((x0 + inset + Math.min(1, Math.max(0, u)) * (w - 2 * inset)) / ATLAS.w, (y0 + inset + Math.min(1, Math.max(0, v)) * (h - 2 * inset)) / ATLAS.h);
      slotOfVertex.push(s);
    }
    body.pos.push(...pt.pos); body.nrm.push(...pt.nrm); body.ji.push(...pt.ji); body.jw.push(...pt.jw);
    for (const i of pt.idx) body.idx.push(base + i);
  });
  const mask = vertexMasks(body, avatar, atlas, slotOfVertex);
  let hairPart = null, hairPng = null;
  if (hair.length) {
    if (hair.length > 1) throw new Error('more than one alpha texture');
    hairPart = hair[0];
    const im = dilateColour(resizeImage(decodeTga(fs.readFileSync(files.tga(hairPart.file))), ATLAS.hair, ATLAS.hair, true));
    // fewer distinct values deflate far better and hair does not show it: 5 bits of colour, 4 of coverage
    for (let i = 0; i < im.data.length; i += 4) { for (let d = 0; d < 3; d++) im.data[i + d] = (im.data[i + d] >> 3) * 255 / 31; im.data[i + 3] = (im.data[i + 3] >> 4) * 17; }
    hairPng = encodePng(im);
  }
  const atlasJpg = Buffer.from(jpeg.encode({ data: Buffer.from(atlas.data.buffer), width: ATLAS.w, height: ATLAS.h }, quality).data);

  // ---- glb
  const W = new GlbWriter(), J = W.json;
  J.asset.generator = '@vibe/engine tools/bake-people.mjs';
  J.asset.copyright = `Microsoft Rocketbox Avatar Library (${person.avatar}), ${SOURCE.copyright}, MIT License, ${SOURCE.repo}`;
  J.extensionsUsed = ['KHR_mesh_quantization']; J.extensionsRequired = ['KHR_mesh_quantization'];
  J.scene = 0; J.scenes = [{ nodes: [0] }];
  // nodes: 0 = the person, then the bones (parents first), then the mesh
  J.nodes = [{ name: person.id, children: [] }];
  avatar.bones.forEach((b, i) => {
    J.nodes.push({ name: b.name, translation: b.t, rotation: b.r });
    const parent = J.nodes[b.parent < 0 ? 0 : b.parent + 1]; (parent.children ||= []).push(i + 1);
  });
  const meshNode = J.nodes.length; J.nodes.push({ name: `${person.id}-mesh`, mesh: 0, skin: 0 }); J.nodes[0].children.push(meshNode);
  J.skins = [{ joints: avatar.bones.map((b, i) => i + 1), skeleton: 1, inverseBindMatrices: W.accessor(new Float32Array(avatar.bones.flatMap((b) => b.ibm)), 'MAT4', GL.FLOAT) }];
  const ARRAY = 34962, ELEMENT = 34963;
  const prim = (pt, material, colour) => {
    const n = pt.pos.length / 3, nrm = new Int8Array(n * 4), uv = new Uint16Array(n * 2);
    for (let i = 0; i < n; i++) { nrm[i * 4] = pt.nrm[i * 3]; nrm[i * 4 + 1] = pt.nrm[i * 3 + 1]; nrm[i * 4 + 2] = pt.nrm[i * 3 + 2]; }
    for (let i = 0; i < n * 2; i++) uv[i] = Math.round(Math.min(1, Math.max(0, pt.uv[i])) * 65535);
    if (n > 65535) throw new Error(`${n} vertices in one part`);
    const attributes = {
      POSITION: W.accessor(new Float32Array(pt.pos), 'VEC3', GL.FLOAT, { minmax: true, view: { target: ARRAY } }),
      NORMAL: W.accessor(nrm, 'VEC3', GL.BYTE, { normalized: true, count: n, view: { target: ARRAY, byteStride: 4 } }),
      TEXCOORD_0: W.accessor(uv, 'VEC2', GL.USHORT, { normalized: true, view: { target: ARRAY } }),
      JOINTS_0: W.accessor(new Uint8Array(pt.ji), 'VEC4', GL.UBYTE, { view: { target: ARRAY } }),
      WEIGHTS_0: W.accessor(new Uint8Array(pt.jw), 'VEC4', GL.UBYTE, { normalized: true, view: { target: ARRAY } }),
    };
    if (colour) attributes._PEOPLE = W.accessor(colour, 'VEC4', GL.UBYTE, { normalized: true, view: { target: ARRAY } });
    return { attributes, indices: W.accessor(new Uint16Array(pt.idx), 'SCALAR', GL.USHORT, { view: { target: ELEMENT } }), material };
  };
  J.meshes = [{ name: person.id, primitives: [prim(body, 0, mask)] }];
  J.images = [{ mimeType: 'image/jpeg', bufferView: W.view(atlasJpg), name: `${person.id}-atlas` }];
  J.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  J.textures = [{ sampler: 0, source: 0 }];
  J.materials = [{ name: 'person', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.82 } }];
  if (hairPart) {
    J.meshes[0].primitives.push(prim(hairPart, 1, null));
    J.images.push({ mimeType: 'image/png', bufferView: W.view(hairPng), name: `${person.id}-hair` });
    J.textures.push({ sampler: 0, source: 1 });
    J.materials.push({ name: 'hair', pbrMetallicRoughness: { baseColorTexture: { index: 1 }, metallicFactor: 0, roughnessFactor: 0.7 }, alphaMode: 'MASK', alphaCutoff: 0.4, doubleSided: true });
  }

  // ---- clips
  const restWorld = boneWorld(avatar), nameIndex = (re) => avatar.bones.findIndex((b) => re.test(b.name));
  const calf = nameIndex(/L_Calf$/), foot = nameIndex(/L_Foot$/);
  const legs = Math.hypot(...avatar.bones[calf].t) + Math.hypot(...avatar.bones[foot].t);
  const floor = lowestPoint(avatar, restWorld);
  J.animations = [];
  const clipStats = {};
  for (const [name, def] of Object.entries(CLIPS)) {
    const c = sampleClip(await parseFbx(files.clip(def.dir, `${person.sex}_${def.file}`)), avatar, def.fps);
    const k = legs / c.legs;
    let speed = 0; // metres per second the cycle covers (0: a clip that stays in place)
    if (c.rootPos) {
      // the root: centimetres -> metres at the avatar's leg length. The library's cycles travel (the body walks away
      // from the origin): take the steady travel out, which leaves the cycle in place and gives its speed; then keep
      // the body over the origin
      const T = c.frames - 1, dx = c.rootPos[T * 3] - c.rootPos[0], dz = c.rootPos[T * 3 + 2] - c.rootPos[2];
      speed = Math.hypot(dx, dz) * 0.01 * k / c.duration;
      if (speed > 0.15) for (let f = 0; f < c.frames; f++) { c.rootPos[f * 3] -= dx * f / T; c.rootPos[f * 3 + 2] -= dz * f / T; } else speed = 0;
      let mx = 0, mz = 0; for (let f = 0; f < c.frames; f++) { mx += c.rootPos[f * 3]; mz += c.rootPos[f * 3 + 2]; } mx /= c.frames; mz /= c.frames;
      for (let f = 0; f < c.frames; f++) { c.rootPos[f * 3] = (c.rootPos[f * 3] - mx) * 0.01 * k; c.rootPos[f * 3 + 1] *= 0.01 * k; c.rootPos[f * 3 + 2] = (c.rootPos[f * 3 + 2] - mz) * 0.01 * k; }
    }
    // loop: the cycles end on their first frame already; the idle is blended into it over 0.6 s
    const first = new THREE.Quaternion(), last = new THREE.Quaternion(); let gap = 0;
    for (const q of c.quats) if (q) gap = Math.max(gap, first.fromArray(q, 0).angleTo(last.fromArray(q, (c.frames - 1) * 4)));
    if (gap > 0.02) closeLoop(c, Math.max(2, Math.round(0.6 / c.dt)));
    if (c.rootPos) {
      let low = Infinity;
      for (let f = 0; f < c.frames; f++) low = Math.min(low, lowestPoint(avatar, boneWorld(avatar, { quats: c.quats.map((q) => (q ? q.subarray(f * 4, f * 4 + 4) : null)), rootPos: c.rootPos.subarray(f * 3, f * 3 + 3) })));
      for (let f = 0; f < c.frames; f++) c.rootPos[f * 3 + 1] -= low - floor;
    }
    const channels = [], samplers = [];
    const times = (keys) => W.accessor(new Float32Array(keys.map((f) => f * c.dt)), 'SCALAR', GL.FLOAT, { minmax: true });
    const all = Array.from({ length: c.frames }, (_, f) => f);
    let keysTotal = 0, allTimes = -1;
    avatar.bones.forEach((b, i) => {
      const q = c.quats[i]; if (!q) return;
      const keys = reduceQuatKeys(q, c.frames, 0.006);
      const out = new Int16Array(keys.length * 4);
      keys.forEach((f, n) => { for (let d = 0; d < 4; d++) out[n * 4 + d] = Math.round(Math.max(-1, Math.min(1, q[f * 4 + d])) * 32767); });
      keysTotal += keys.length;
      samplers.push({ input: times(keys), output: W.accessor(out, 'VEC4', GL.SHORT, { normalized: true }), interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: i + 1, path: 'rotation' } });
    });
    if (c.rootPos) {
      if (allTimes < 0) allTimes = times(all);
      samplers.push({ input: allTimes, output: W.accessor(new Float32Array(c.rootPos), 'VEC3', GL.FLOAT), interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: 1, path: 'translation' } });
    }
    J.animations.push({ name, channels, samplers, extras: { speed: +speed.toFixed(3) } });
    clipStats[name] = { seconds: +c.duration.toFixed(3), frames: c.frames, keys: keysTotal, speed: +speed.toFixed(3), loopGap: +gap.toFixed(4), legScale: +k.toFixed(3) };
  }
  let height = -Infinity; for (let i = 1; i < body.pos.length; i += 3) height = Math.max(height, body.pos[i]);
  // for the game: the person's height and the ground speed each cycle was made for (m/s, at this height)
  J.scenes[0].extras = { person: { height: +(height - floor).toFixed(3), speed: Object.fromEntries(Object.entries(clipStats).map(([n, c]) => [n, c.speed])) } };
  const glb = W.build();
  const stats = {
    id: person.id, avatar: person.avatar, bytes: glb.length, triangles: (body.idx.length + (hairPart ? hairPart.idx.length : 0)) / 3,
    vertices: body.pos.length / 3 + (hairPart ? hairPart.pos.length / 3 : 0), primitives: hairPart ? 2 : 1, joints: avatar.bones.length,
    height: +(height - floor).toFixed(3), atlasBytes: atlasJpg.length, hairBytes: hairPng ? hairPng.length : 0, clips: clipStats,
  };
  return { glb, stats };
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

/** Texture file names an avatar's FBX refers to (read from the file's text, so nothing else is needed to plan). */
function textureNames(fbx) {
  const names = new Set(), s = fs.readFileSync(fbx).toString('latin1');
  for (const m of s.matchAll(/([A-Za-z0-9_-]+_(?:body|head|opacity)_color\.tga)/g)) names.add(m[1]);
  return [...names];
}

/** Bake the people. opts: SPEC keys in camelCase + people (default PEOPLE). Returns the stats of each. */
export async function bakePeople(opts = {}) {
  const d = (k, def) => (opts[k] !== undefined ? opts[k] : def);
  const src = d('src', ''), out = path.resolve(d('out', SPEC.out.def)), only = String(d('only', '')).split(',').filter(Boolean);
  const people = (opts.people || PEOPLE).filter((p) => !only.length || only.includes(p.id));
  if (!src && !d('dryRun', false)) throw new Error('--src <dir> is required (the folder with the library files)');
  const all = [];
  for (const person of people) {
    const dir = path.join(src, 'Avatars', 'Adults', person.avatar), fbx = path.join(dir, 'Export', `${person.avatar}.fbx`);
    const clipFile = (folder, name) => path.join(src, 'Animations', folder, `${name}.max.fbx`);
    const needed = [[fbx, `${SOURCE.raw}/Avatars/Adults/${person.avatar}/Export/${person.avatar}.fbx`]];
    for (const def of Object.values(CLIPS)) needed.push([clipFile(def.dir, `${person.sex}_${def.file}`), `${SOURCE.raw}/Animations/${def.dir}/${person.sex}_${def.file}.max.fbx`]);
    if (d('dryRun', false)) { console.log(`${person.id}: ${person.avatar} (${person.note}) -> ${path.join(out, person.id + '.glb')}\n  ${needed.map((n) => n[1]).join('\n  ')}\n  + the *_color.tga files its FBX names (Textures/)`); continue; }
    for (const [file, url] of needed) if (!fs.existsSync(file)) { if (!d('fetch', false)) throw new Error(`missing ${file} (pass --fetch to download it)`); await download(url, file); }
    for (const t of textureNames(fbx)) { const file = path.join(dir, 'Textures', t); if (!fs.existsSync(file)) { if (!d('fetch', false)) throw new Error(`missing ${file} (pass --fetch to download it)`); await download(`${SOURCE.raw}/Avatars/Adults/${person.avatar}/Textures/${t}`, file); } }
    const { glb, stats } = await bakePerson(person, { fbx, tga: (name) => path.join(dir, 'Textures', name), clip: clipFile }, { quality: d('quality', SPEC.quality.def) });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, `${person.id}.glb`), glb);
    console.log(`${person.id}: ${stats.bytes} bytes, ${stats.triangles} triangles, ${stats.vertices} vertices, ${stats.primitives} primitive(s), ${stats.joints} joints, ${stats.height} m; atlas ${stats.atlasBytes}, hair ${stats.hairBytes}; ${Object.entries(stats.clips).map(([n, c]) => `${n} ${c.seconds}s ${c.keys} keys ${c.speed} m/s`).join(', ')}`);
    all.push(stats);
  }
  return all;
}

runCli(import.meta.url, 'tools/bake-people.mjs', 'bake Microsoft Rocketbox avatars (MIT) into the people GLBs of the samples', SPEC, bakePeople);
