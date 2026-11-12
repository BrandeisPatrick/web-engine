// Bake the Night NYC walk's street kit (samples/nyc-night/street*.js) into data files under samples/public/nyc/street/:
//   street.gltf + street.bin   every prop as one simplified mesh (POSITION / NORMAL / TEXCOORD_0, UVs already in atlas
//                              space), no materials; asset.extras.atlas = the atlas rectangles of the procedural insets
//   atlas_{diff,nor,arm}.jpg   2048 px (desktop tier): albedo, OpenGL normal, AO / roughness / metalness (glTF ARM)
//   atlas512/...               the same at 1024 px (mobile tier)
// Sources: Poly Haven CC0 glTF models at 1k (fetched by hand into --src, one folder per asset id, see CREDITS.md), two
// photo sets already in the repo (granite kerb stones, asphalt for the patch rings), and procedural insets drawn here
// (manhole covers, road plates, catch-basin grates, valve boxes, vault doors, hatches, tree-pit grates, cobbles, mulch).
// Geometry: node transforms applied, the chosen nodes merged per prop, simplified with meshoptimizer (attribute-aware,
// seams kept), UVs remapped into the prop's atlas slot. Images: composed in headless Chrome (canvas), so no image
// library is needed. Downloaded files are read as data only.
//
//   node samples/nyc-night/tools/bake-street.mjs --src=<folder with the Poly Haven downloads>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)=?(.*)$/.exec(a); return m ? [m[1], m[2] || true] : [a, true]; }));
const SRC = args.src;
if (!SRC) { console.error('usage: --src=<downloads>'); process.exit(1); }
const OUT = path.join(repo, 'samples/public/nyc/street');
const TEX = path.join(repo, 'samples/public/nyc/textures');
fs.mkdirSync(path.join(OUT, 'atlas512'), { recursive: true });

// ------------------------------------------------------------------ atlas layout (2048 px; 8 px gutters inside each slot)
const A = 2048;
const SLOTS = {
  // props (photo sets)
  hydrant: [0, 0, 512, 512], hydrant_aged: [512, 0, 512, 512], can: [1024, 0, 512, 512], can_rust: [1536, 0, 512, 512],
  bag: [0, 512, 512, 512], barrier: [512, 512, 512, 512], ubox: [1024, 512, 512, 512], manhole_scan: [1536, 512, 512, 512],
  crate: [0, 1024, 256, 256], box: [256, 1024, 256, 256],
  // procedural insets + photo crops
  mh_con: [512, 1024, 256, 256], mh_grid: [768, 1024, 256, 256], ring: [1024, 1024, 256, 256], valve: [1280, 1024, 128, 128],
  hatch: [1408, 1024, 128, 128], grate: [1280, 1152, 256, 128], soil: [1536, 1024, 256, 256], cobble: [1792, 1024, 256, 256],
  plate: [0, 1280, 512, 256], vault: [512, 1280, 512, 256], treegrate: [1024, 1280, 512, 512],
  kerb: [0, 1536, 1024, 128], kerb2: [0, 1664, 1024, 128], flag: [1536, 1280, 512, 512],
  paint: [0, 1792, 512, 256], bagclear: [512, 1792, 512, 256],
};
const PAD = 8;
const inner = (k) => { const [x, y, w, h] = SLOTS[k]; return [x + PAD, y + PAD, w - 2 * PAD, h - 2 * PAD]; };
const uvRect = (k) => { const [x, y, w, h] = inner(k); return [x / A, y / A, w / A, h / A]; };

// ------------------------------------------------------------------ props: which nodes, which slot per material, budgets
const PROPS = [
  { name: 'hydrant', id: 'fire_hydrant', nodes: [0, 1, 2, 3], mats: { 0: 'hydrant' }, tris: 2400 },
  { name: 'hydrant_aged', id: 'fire_hydrant', nodes: [5, 6, 7, 8], mats: { 1: 'hydrant_aged' }, tris: 2400 },
  { name: 'can', id: 'metal_trash_can', nodes: [0, 1, 2, 3], mats: { 0: 'can' }, tris: 1500 },
  { name: 'can_rust', id: 'metal_trash_can', nodes: [4, 5, 6, 7], mats: { 1: 'can_rust', 2: 'can_rust' }, tris: 1500 },
  { name: 'bag', id: 'trashbag', nodes: [0], mats: { 0: 'bag' }, tris: 900 },
  { name: 'bagclear', id: 'trashbag', nodes: [0], mats: { 0: 'bagclear' }, tris: 900 },
  { name: 'barrier', id: 'concrete_road_barrier_02', nodes: [0], mats: { 0: 'barrier' }, tris: 1400 },
  { name: 'ubox', id: 'utility_box_01', nodes: [0], mats: { 0: 'ubox' }, tris: 900 },
  { name: 'crate', id: 'plastic_crate_02', nodes: [0], mats: { 0: 'crate' }, tris: 1200 },
  { name: 'box', id: 'cardboard_box_01', nodes: [0], mats: { 0: 'box' }, tris: 500 },
  { name: 'manhole', id: 'water_manhole_cover', nodes: [0, 1], mats: { 0: 'manhole_scan' }, tris: 700, keepY: true },
];

// ------------------------------------------------------------------ glTF reading (data only)
function readGltf(id) {
  const dir = path.join(SRC, id), g = JSON.parse(fs.readFileSync(path.join(dir, `${id}.gltf`), 'utf8'));
  const bins = g.buffers.map((b) => fs.readFileSync(path.join(dir, b.uri)));
  const acc = (i) => {
    const a = g.accessors[i], bv = g.bufferViews[a.bufferView], buf = bins[bv.buffer];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * C.BYTES_PER_ELEMENT;
    const out = new (C === Float32Array ? Float32Array : Uint32Array)(a.count * n);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const o = off + k * stride + c * C.BYTES_PER_ELEMENT;
      out[k * n + c] = C === Float32Array ? dv.getFloat32(o, true) : C === Uint32Array ? dv.getUint32(o, true) : C === Uint16Array ? dv.getUint16(o, true) : dv.getUint8(o);
    }
    return out;
  };
  return { g, acc, dir };
}

function buildProp(P, lod = 0) {
  const { g, acc } = readGltf(P.id);
  const pos = [], nor = [], uv = [], idx = [];
  const uvRange = {};
  for (const ni of P.nodes) {
    const n = g.nodes[ni];
    const M = new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1])));
    const NM = new THREE.Matrix3().getNormalMatrix(M);
    for (const pr of g.meshes[n.mesh].primitives) {
      const slot = P.mats[pr.material];
      if (!slot) throw new Error(`${P.name}: material ${pr.material} has no slot`);
      const p = acc(pr.attributes.POSITION), nn = acc(pr.attributes.NORMAL), t = acc(pr.attributes.TEXCOORD_0), ix = acc(pr.indices);
      const base = pos.length / 3, [rx, ry, rw, rh] = uvRect(slot);
      const v = new THREE.Vector3();
      const R = uvRange[slot] || (uvRange[slot] = [Infinity, -Infinity, Infinity, -Infinity]);
      for (let k = 0; k < p.length / 3; k++) {
        v.set(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]).applyMatrix4(M); pos.push(v.x, v.y, v.z);
        v.set(nn[k * 3], nn[k * 3 + 1], nn[k * 3 + 2]).applyMatrix3(NM).normalize(); nor.push(v.x, v.y, v.z);
        const u = t[k * 2], w = t[k * 2 + 1];
        R[0] = Math.min(R[0], u); R[1] = Math.max(R[1], u); R[2] = Math.min(R[2], w); R[3] = Math.max(R[3], w);
        // glTF uv: origin top-left, same as the atlas image (the runtime texture has flipY = false)
        uv.push(rx + Math.min(1, Math.max(0, u)) * rw, ry + Math.min(1, Math.max(0, w)) * rh);
      }
      for (let k = 0; k < ix.length; k++) idx.push(base + ix[k]);
    }
  }
  // centre on the floor (x / z centre of the bounds, min y = 0) unless keepY
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
  for (let k = 0; k < pos.length; k += 3) { x0 = Math.min(x0, pos[k]); x1 = Math.max(x1, pos[k]); y0 = Math.min(y0, pos[k + 1]); z0 = Math.min(z0, pos[k + 2]); z1 = Math.max(z1, pos[k + 2]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = P.keepY ? 0 : y0;
  for (let k = 0; k < pos.length; k += 3) { pos[k] -= cx; pos[k + 1] -= cy; pos[k + 2] -= cz; }
  // simplify (positions + normals + uv as attributes)
  const P32 = new Float32Array(pos), I32 = new Uint32Array(idx);
  const attr = new Float32Array((pos.length / 3) * 5);
  for (let k = 0; k < pos.length / 3; k++) { attr.set(nor.slice(k * 3, k * 3 + 3), k * 5); attr[k * 5 + 3] = uv[k * 2] * A / 512; attr[k * 5 + 4] = uv[k * 2 + 1] * A / 512; }
  const tris0 = idx.length / 3, target = lod ? Math.max(120, Math.round(P.tris / 5)) : P.tris;
  let out = I32;
  if (tris0 > target) {
    const [res, err] = MeshoptSimplifier.simplifyWithAttributes(I32, P32, 3, attr, 5, [0.5, 0.5, 0.5, 1, 1], null, target * 3, lod ? 0.2 : 0.05, []);
    out = res;
    console.log(`  ${P.name}${lod ? ' lod1' : ''}: ${tris0} -> ${res.length / 3} tris (error ${err.toFixed(4)})`);
  } else console.log(`  ${P.name}: ${tris0} tris (kept)`);
  // compact
  const remap = new Map(), np = [], nn2 = [], nu = [], ni2 = [];
  for (const i of out) {
    let j = remap.get(i);
    if (j === undefined) { j = np.length / 3; remap.set(i, j); np.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); nn2.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); nu.push(uv[i * 2], uv[i * 2 + 1]); }
    ni2.push(j);
  }
  for (const k in uvRange) { const r = uvRange[k]; if (r[0] < -0.01 || r[1] > 1.01 || r[2] < -0.01 || r[3] > 1.01) console.warn(`  ! ${P.name}/${k}: uv outside 0..1`, r.map((x) => x.toFixed(2))); }
  return { name: lod ? `${P.name}_lod1` : P.name, pos: np, nor: nn2, uv: nu, idx: ni2 };
}

// ------------------------------------------------------------------ glTF writing
function writeGltf(meshes, extras) {
  const chunks = [], bufferViews = [], accessors = [], gm = [], nodes = [];
  let off = 0;
  const push = (arr, target, type, comp, count, minmax) => {
    const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const pad = (4 - (b.length % 4)) % 4;
    chunks.push(b, Buffer.alloc(pad));
    bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length, target });
    off += b.length + pad;
    accessors.push({ bufferView: bufferViews.length - 1, componentType: comp, count, type, ...minmax });
    return accessors.length - 1;
  };
  for (const m of meshes) {
    const n = m.pos.length / 3;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < m.pos.length; k++) { mn[k % 3] = Math.min(mn[k % 3], m.pos[k]); mx[k % 3] = Math.max(mx[k % 3], m.pos[k]); }
    const p = push(new Float32Array(m.pos), 34962, 'VEC3', 5126, n, { min: mn, max: mx });
    const q = push(new Float32Array(m.nor), 34962, 'VEC3', 5126, n);
    const t = push(new Float32Array(m.uv), 34962, 'VEC2', 5126, n);
    const i = push(n > 65535 ? new Uint32Array(m.idx) : new Uint16Array(m.idx), 34963, 'SCALAR', n > 65535 ? 5125 : 5123, m.idx.length);
    gm.push({ name: m.name, primitives: [{ attributes: { POSITION: p, NORMAL: q, TEXCOORD_0: t }, indices: i }] });
    nodes.push({ name: m.name, mesh: gm.length - 1 });
  }
  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: '2.0', generator: 'samples/nyc-night/tools/bake-street.mjs', extras },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gm, accessors, bufferViews,
    buffers: [{ uri: 'street.bin', byteLength: bin.length }],
  };
  fs.writeFileSync(path.join(OUT, 'street.bin'), bin);
  fs.writeFileSync(path.join(OUT, 'street.gltf'), JSON.stringify(gltf));
  return bin.length;
}

// ------------------------------------------------------------------ images (headless Chrome canvas)
async function bakeImages() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  const data = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`;
  const sets = {};
  const tex = (id, slot, base) => { sets[slot] = ['diff', 'nor_gl', 'arm'].map((m) => data(path.join(SRC, id, 'textures', `${base}_${m}_1k.jpg`))); };
  tex('fire_hydrant', 'hydrant', 'fire_hydrant'); tex('fire_hydrant', 'hydrant_aged', 'fire_hydrant_aged');
  tex('metal_trash_can', 'can', 'metal_trash_can'); tex('metal_trash_can', 'can_rust', 'metal_trash_can_rust');
  tex('trashbag', 'bag', 'trashbag'); tex('concrete_road_barrier_02', 'barrier', 'concrete_road_barrier_02');
  tex('utility_box_01', 'ubox', 'utility_box_01'); tex('water_manhole_cover', 'manhole_scan', 'water_manhole_cover');
  tex('plastic_crate_02', 'crate', 'plastic_crate_02'); tex('cardboard_box_01', 'box', 'cardboard_box_01');
  sets.bagclear = sets.bag; // tinted milky in the page
  const photo = (id) => ['diff', 'nor_gl', 'rough'].map((m) => data(path.join(TEX, id, `${m}.jpg`)));
  const granite = photo('granite_tile_03'), asphalt = photo('clean_asphalt'), flag = photo('concrete_pavement');
  const out = await page.evaluate(async ({ A, PAD, SLOTS, sets, granite, asphalt, flag }) => {
    const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const D = mk(A, A), N = mk(A, A), R = mk(A, A);
    const d = D.getContext('2d'), n = N.getContext('2d'), r = R.getContext('2d');
    d.fillStyle = '#404040'; d.fillRect(0, 0, A, A); n.fillStyle = 'rgb(128,128,255)'; n.fillRect(0, 0, A, A); r.fillStyle = 'rgb(255,220,0)'; r.fillRect(0, 0, A, A);
    // draw `src` (canvas / image, region sx..) into slot k with the gutter filled by clamped edges
    const put = (ctx, k, src, sx = 0, sy = 0, sw = src.width, sh = src.height) => {
      const [x, y, w, h] = SLOTS[k], iw = w - 2 * PAD, ih = h - 2 * PAD;
      ctx.imageSmoothingQuality = 'high';
      const tmp = mk(iw, ih), t = tmp.getContext('2d'); t.imageSmoothingQuality = 'high';
      t.drawImage(src, sx, sy, sw, sh, 0, 0, iw, ih);
      ctx.drawImage(tmp, 0, 0, iw, 1, x + PAD, y, iw, PAD); ctx.drawImage(tmp, 0, ih - 1, iw, 1, x + PAD, y + h - PAD, iw, PAD);
      ctx.drawImage(tmp, 0, 0, 1, ih, x, y + PAD, PAD, ih); ctx.drawImage(tmp, iw - 1, 0, 1, ih, x + w - PAD, y + PAD, PAD, ih);
      for (const [cx, cy, dx, dy] of [[0, 0, x, y], [iw - 1, 0, x + w - PAD, y], [0, ih - 1, x, y + h - PAD], [iw - 1, ih - 1, x + w - PAD, y + h - PAD]]) ctx.drawImage(tmp, cx, cy, 1, 1, dx, dy, PAD, PAD);
      ctx.drawImage(tmp, x + PAD, y + PAD);
    };
    // photo sets of the props
    for (const k in sets) {
      const [di, ni, ai] = await Promise.all(sets[k].map(load));
      if (k === 'bagclear') { // a milky / clear bag: lift and desaturate the black bag's albedo, keep its folds
        const c = mk(di.width, di.height), g = c.getContext('2d'); g.drawImage(di, 0, 0);
        const im = g.getImageData(0, 0, c.width, c.height), p = im.data;
        for (let i = 0; i < p.length; i += 4) { const l = (p[i] + p[i + 1] + p[i + 2]) / 3; const v = 38 + l * 1.5; p[i] = Math.min(255, v * 0.95); p[i + 1] = Math.min(255, v * 0.97); p[i + 2] = Math.min(255, v); }
        g.putImageData(im, 0, 0); put(d, k, c);
      } else put(d, k, di);
      put(n, k, ni); put(r, k, ai);
    }
    // ---------------------------------------------------------------- procedural insets
    // each: a height canvas (white = high), albedo, roughness / metal / ao; normal from height (Sobel)
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const noiseCanvas = (w, h, base, amp, scale = 1) => { // speckled grime / rust
      const c = mk(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), p = im.data;
      for (let i = 0; i < w * h; i++) { const v = base + (rnd() - 0.5) * amp; p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = v; p[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
      if (scale > 1) { const c2 = mk(w, h), g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = true; g2.drawImage(c, 0, 0, w / scale, h / scale, 0, 0, w, h); return c2; }
      return c;
    };
    const blotches = (g, w, h, n, col, rmin, rmax, alpha) => {
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, y = rnd() * h, rr = rmin + rnd() * (rmax - rmin);
        const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, col.replace('A', String(alpha * (0.5 + rnd() * 0.5)))); gr.addColorStop(1, col.replace('A', '0'));
        g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
      }
    };
    const normalFrom = (H, strength) => {
      const w = H.width, h = H.height, hp = H.getContext('2d').getImageData(0, 0, w, h).data;
      const c = mk(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), p = im.data;
      const at = (x, y) => hp[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        // OpenGL convention (green up); image y grows down
        let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * w + x) * 4; p[i] = (nx * 0.5 + 0.5) * 255; p[i + 1] = (ny * 0.5 + 0.5) * 255; p[i + 2] = (nz * 0.5 + 0.5) * 255; p[i + 3] = 255;
      }
      g.putImageData(im, 0, 0); return c;
    };
    // arm from roughness / metal canvases and the height (cavities darker in AO)
    const armFrom = (H, rough, metal, aoK = 0.6) => {
      const w = H.width, h = H.height, hp = H.getContext('2d').getImageData(0, 0, w, h).data;
      const rp = rough.getContext('2d').getImageData(0, 0, w, h).data, mp = metal.getContext('2d').getImageData(0, 0, w, h).data;
      const c = mk(w, h), g = c.getContext('2d'), im = g.createImageData(w, h), p = im.data;
      for (let i = 0; i < w * h * 4; i += 4) { p[i] = 255 * (1 - aoK + aoK * hp[i] / 255); p[i + 1] = rp[i]; p[i + 2] = mp[i]; p[i + 3] = 255; }
      g.putImageData(im, 0, 0); return c;
    };
    const layer = (w, h) => { const c = mk(w, h); return [c, c.getContext('2d')]; };
    const finish = (k, H, Al, Ro, Me, strength = 6, aoK = 0.6) => { put(d, k, Al); put(n, k, normalFrom(H, strength)); put(r, k, armFrom(H, Ro, Me, aoK)); };
    const RES = (k) => [SLOTS[k][2] - 2 * PAD, SLOTS[k][3] - 2 * PAD];

    // cast-iron disc: shared base (rim, gap ring, rust and wear on the high points)
    const disc = (k, pattern) => {
      const [w, h] = RES(k), cx = w / 2, cy = h / 2, R0 = w * 0.47;
      const [H, hg] = layer(w, h), [Al, ag] = layer(w, h), [Ro, rg] = layer(w, h), [Me, mg] = layer(w, h);
      hg.fillStyle = '#000'; hg.fillRect(0, 0, w, h);
      hg.fillStyle = '#9a9a9a'; hg.beginPath(); hg.arc(cx, cy, R0, 0, 7); hg.fill();                 // frame top
      hg.fillStyle = '#202020'; hg.beginPath(); hg.arc(cx, cy, R0 * 0.93, 0, 7); hg.fill();           // the gap
      hg.fillStyle = '#707070'; hg.beginPath(); hg.arc(cx, cy, R0 * 0.9, 0, 7); hg.fill();            // cover (a touch sunk)
      hg.save(); hg.beginPath(); hg.arc(cx, cy, R0 * 0.86, 0, 7); hg.clip(); pattern(hg, w, h, cx, cy, R0 * 0.86); hg.restore();
      // albedo: dark iron, rust in the low parts, polished high points
      ag.fillStyle = '#3d3a35'; ag.fillRect(0, 0, w, h);
      ag.globalAlpha = 0.3; ag.drawImage(noiseCanvas(w, h, 128, 140, 2), 0, 0); ag.globalAlpha = 1;
      blotches(ag, w, h, 26, 'rgba(104,58,28,A)', w * 0.02, w * 0.12, 0.55);
      // low parts: grime; high parts: polished by tyres and feet
      ag.globalCompositeOperation = 'multiply'; ag.globalAlpha = 0.7; ag.filter = 'brightness(1.6)'; ag.drawImage(H, 0, 0); ag.filter = 'none'; ag.globalAlpha = 1;
      ag.globalCompositeOperation = 'screen'; ag.globalAlpha = 0.22; ag.filter = 'contrast(2.5) brightness(0.8)'; ag.drawImage(H, 0, 0); ag.filter = 'none'; ag.globalAlpha = 1; ag.globalCompositeOperation = 'source-over';
      ag.globalCompositeOperation = 'destination-in'; ag.fillStyle = '#fff'; ag.beginPath(); ag.arc(cx, cy, R0, 0, 7); ag.fill(); ag.globalCompositeOperation = 'destination-over'; ag.fillStyle = '#1e1d1b'; ag.fillRect(0, 0, w, h); ag.globalCompositeOperation = 'source-over';
      // roughness: polished high points smoother; metal on the worn bosses
      rg.fillStyle = '#c8c8c8'; rg.fillRect(0, 0, w, h); rg.globalCompositeOperation = 'difference'; rg.globalAlpha = 0.5; rg.drawImage(H, 0, 0); rg.globalAlpha = 1; rg.globalCompositeOperation = 'source-over';
      mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h); mg.globalAlpha = 0.55; mg.filter = 'contrast(3) brightness(0.6)'; mg.drawImage(H, 0, 0); mg.filter = 'none'; mg.globalAlpha = 1;
      finish(k, H, Al, Ro, Me, 7);
    };
    // Con Ed style: radial waffle of raised studs, ring of slots, a centre plate
    disc('mh_con', (g, w, h, cx, cy, R) => {
      for (let ring = 1; ring < 8; ring++) { const rr = R * ring / 8.2, cnt = Math.round(ring * 7); for (let i = 0; i < cnt; i++) { const a = i / cnt * Math.PI * 2 + ring; g.fillStyle = '#d0d0d0'; g.fillRect(cx + Math.cos(a) * rr - w * 0.012, cy + Math.sin(a) * rr - w * 0.012, w * 0.024, w * 0.024); } }
      g.strokeStyle = '#c0c0c0'; g.lineWidth = w * 0.018; g.beginPath(); g.arc(cx, cy, R * 0.97, 0, 7); g.stroke();
      g.fillStyle = '#a8a8a8'; g.beginPath(); g.arc(cx, cy, R * 0.2, 0, 7); g.fill();
      g.fillStyle = '#555'; for (let i = 0; i < 2; i++) g.fillRect(cx - R * 0.12 + i * R * 0.17, cy - R * 0.03, R * 0.07, R * 0.06);
    });
    // grid / diamond waffle with lettering bars (DEP / sewer)
    disc('mh_grid', (g, w, h, cx, cy, R) => {
      g.strokeStyle = '#c4c4c4'; g.lineWidth = w * 0.014;
      for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(cx + i * R / 6 - R * 2, cy - R * 2); g.lineTo(cx + i * R / 6 + R * 2, cy + R * 2); g.stroke(); g.beginPath(); g.moveTo(cx + i * R / 6 + R * 2, cy - R * 2); g.lineTo(cx + i * R / 6 - R * 2, cy + R * 2); g.stroke(); }
      g.fillStyle = '#707070'; g.fillRect(cx - R * 0.62, cy - R * 0.16, R * 1.24, R * 0.32);
      g.fillStyle = '#d4d4d4'; for (let i = 0; i < 9; i++) g.fillRect(cx - R * 0.55 + i * R * 0.125, cy - R * 0.1, R * 0.08, R * 0.2 * (0.6 + rnd() * 0.4));
      g.strokeStyle = '#c8c8c8'; g.lineWidth = w * 0.02; g.beginPath(); g.arc(cx, cy, R * 0.97, 0, 7); g.stroke();
    });
    // patch ring: a darker, newer asphalt disc around a cover (crop of the asphalt photo) with a tar-sealed saw cut
    {
      const k = 'ring', [w, h] = RES(k), [di] = await Promise.all(asphalt.map(load));
      const [Al, ag] = layer(w, h); ag.filter = 'brightness(0.55) contrast(1.15) saturate(0.6)'; ag.drawImage(di, 0, 0, di.width * 0.5, di.height * 0.5, 0, 0, w, h); ag.filter = 'none';
      blotches(ag, w, h, 10, 'rgba(10,10,10,A)', w * 0.05, w * 0.2, 0.35);
      ag.strokeStyle = 'rgba(8,8,8,0.9)'; ag.lineWidth = w * 0.025; ag.beginPath(); ag.arc(w / 2, h / 2, w * 0.47, 0, 7); ag.stroke();
      const [H, hg] = layer(w, h); hg.drawImage(noiseCanvas(w, h, 128, 70, 1), 0, 0); hg.strokeStyle = '#d0d0d0'; hg.lineWidth = w * 0.02; hg.beginPath(); hg.arc(w / 2, h / 2, w * 0.47, 0, 7); hg.stroke();
      const [Ro, rg] = layer(w, h); rg.fillStyle = '#c0c0c0'; rg.fillRect(0, 0, w, h); rg.strokeStyle = '#606060'; rg.lineWidth = w * 0.03; rg.beginPath(); rg.arc(w / 2, h / 2, w * 0.47, 0, 7); rg.stroke();
      const [Me, mg] = layer(w, h); mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h);
      finish(k, H, Al, Ro, Me, 3, 0.3);
    }
    // small round valve box (gas / water), and a square hatch plate
    disc('valve', (g, w, h, cx, cy, R) => { g.fillStyle = '#b0b0b0'; g.font = `bold ${Math.round(R * 0.7)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('W', cx, cy); g.strokeStyle = '#a0a0a0'; g.lineWidth = w * 0.04; g.beginPath(); g.arc(cx, cy, R * 0.8, 0, 7); g.stroke(); });
    const steel = (k, draw, rust = 0.5, diamond = false) => {
      const [w, h] = RES(k);
      const [H, hg] = layer(w, h), [Al, ag] = layer(w, h), [Ro, rg] = layer(w, h), [Me, mg] = layer(w, h);
      hg.fillStyle = '#808080'; hg.fillRect(0, 0, w, h);
      if (diamond) { // tread plate: alternating raised lozenges
        const s = Math.max(10, w / 26);
        for (let y = 0; y < h + s; y += s) for (let x = 0; x < w + s; x += s) { const o = ((y / s) & 1) ? s / 2 : 0; hg.save(); hg.translate(x + o, y); hg.rotate(((x / s + y / s) & 1) ? 0.785 : -0.785); hg.fillStyle = '#d8d8d8'; hg.fillRect(-s * 0.32, -s * 0.07, s * 0.64, s * 0.14); hg.restore(); }
      }
      draw(hg, w, h);
      ag.fillStyle = '#44413c'; ag.fillRect(0, 0, w, h);
      ag.globalAlpha = 0.35; ag.drawImage(noiseCanvas(w, h, 128, 160, 3), 0, 0); ag.globalAlpha = 1;
      blotches(ag, w, h, Math.round(30 * rust), 'rgba(96,54,24,A)', w * 0.02, w * 0.18, 0.6 * rust + 0.15);
      blotches(ag, w, h, 12, 'rgba(12,12,12,A)', w * 0.03, w * 0.2, 0.4);
      // scratches / tyre polish
      ag.strokeStyle = 'rgba(150,150,150,0.18)'; for (let i = 0; i < 70; i++) { ag.lineWidth = 0.5 + rnd() * 1.5; ag.beginPath(); const x = rnd() * w, y = rnd() * h; ag.moveTo(x, y); ag.lineTo(x + (rnd() - 0.5) * w * 0.4, y + (rnd() - 0.5) * h * 0.08); ag.stroke(); }
      ag.globalCompositeOperation = 'screen'; ag.globalAlpha = 0.2; ag.drawImage(H, 0, 0); ag.globalAlpha = 1; ag.globalCompositeOperation = 'source-over';
      rg.fillStyle = '#9a9a9a'; rg.fillRect(0, 0, w, h); rg.globalAlpha = 0.4; rg.drawImage(noiseCanvas(w, h, 128, 90, 4), 0, 0); rg.globalAlpha = 1;
      blotches(rg, w, h, Math.round(20 * rust), 'rgba(235,235,235,A)', w * 0.03, w * 0.15, 0.7);
      mg.fillStyle = '#909090'; mg.fillRect(0, 0, w, h); blotches(mg, w, h, Math.round(25 * rust), 'rgba(0,0,0,A)', w * 0.03, w * 0.18, 0.8);
      finish(k, H, Al, Ro, Me, 5, 0.5);
    };
    // road plate: smooth steel, bolt holes, a bevelled edge (asphalt ramp drawn by the runtime as darker band)
    steel('plate', (g, w, h) => {
      const e = h * 0.06; const gr = g.createLinearGradient(0, 0, 0, e); gr.addColorStop(0, '#303030'); gr.addColorStop(1, '#808080'); g.fillStyle = gr; g.fillRect(0, 0, w, e);
      const gr2 = g.createLinearGradient(0, h, 0, h - e); gr2.addColorStop(0, '#303030'); gr2.addColorStop(1, '#808080'); g.fillStyle = gr2; g.fillRect(0, h - e, w, e);
      const gl = g.createLinearGradient(0, 0, e, 0); gl.addColorStop(0, '#303030'); gl.addColorStop(1, '#808080'); g.fillStyle = gl; g.fillRect(0, 0, e, h);
      const gq = g.createLinearGradient(w, 0, w - e, 0); gq.addColorStop(0, '#303030'); gq.addColorStop(1, '#808080'); g.fillStyle = gq; g.fillRect(w - e, 0, e, h);
      g.fillStyle = '#202020'; for (const [x, y] of [[0.06, 0.15], [0.94, 0.15], [0.06, 0.85], [0.94, 0.85], [0.5, 0.12]]) { g.beginPath(); g.arc(x * w, y * h, h * 0.03, 0, 7); g.fill(); }
      g.strokeStyle = '#6a6a6a'; g.lineWidth = 2; g.strokeRect(w * 0.48, h * 0.4, w * 0.04, h * 0.2);
    }, 0.9);
    // sidewalk vault doors: two leaves of diamond plate, hinges, a lifting ring, a frame
    steel('vault', (g, w, h) => {
      g.strokeStyle = '#303030'; g.lineWidth = h * 0.05; g.strokeRect(h * 0.025, h * 0.025, w - h * 0.05, h - h * 0.05);
      g.fillStyle = '#202020'; g.fillRect(w / 2 - h * 0.015, 0, h * 0.03, h);
      g.fillStyle = '#c8c8c8'; for (const x of [0.1, 0.4, 0.6, 0.9]) g.fillRect(x * w - h * 0.06, h * 0.06, h * 0.12, h * 0.06), g.fillRect(x * w - h * 0.06, h * 0.88, h * 0.12, h * 0.06);
      g.strokeStyle = '#b0b0b0'; g.lineWidth = h * 0.025; for (const x of [0.44, 0.56]) { g.beginPath(); g.arc(x * w, h / 2, h * 0.07, 0, 7); g.stroke(); }
    }, 0.6, true);
    steel('hatch', (g, w, h) => { g.strokeStyle = '#303030'; g.lineWidth = w * 0.06; g.strokeRect(w * 0.03, h * 0.03, w * 0.94, h * 0.94); g.fillStyle = '#d0d0d0'; g.fillRect(w * 0.4, h * 0.45, w * 0.2, h * 0.1); }, 0.7, true);
    // catch-basin grate: bars across, black void between
    {
      const k = 'grate', [w, h] = RES(k);
      const [H, hg] = layer(w, h), [Al, ag] = layer(w, h), [Ro, rg] = layer(w, h), [Me, mg] = layer(w, h);
      hg.fillStyle = '#000'; hg.fillRect(0, 0, w, h); hg.fillStyle = '#b0b0b0'; hg.fillRect(0, 0, w, h * 0.12); hg.fillRect(0, h * 0.88, w, h * 0.12); hg.fillRect(0, 0, w * 0.05, h); hg.fillRect(w * 0.95, 0, w * 0.05, h);
      for (let x = w * 0.08; x < w * 0.94; x += w * 0.055) hg.fillRect(x, h * 0.1, w * 0.026, h * 0.8);
      hg.fillRect(0, h * 0.47, w, h * 0.06);
      ag.fillStyle = '#060606'; ag.fillRect(0, 0, w, h); ag.globalCompositeOperation = 'source-over';
      const [Ir, ig] = layer(w, h); ig.fillStyle = '#2e2924'; ig.fillRect(0, 0, w, h); blotches(ig, w, h, 30, 'rgba(100,58,28,A)', 4, 30, 0.6); ig.globalAlpha = 0.4; ig.drawImage(noiseCanvas(w, h, 128, 150, 2), 0, 0); ig.globalAlpha = 1;
      ig.globalCompositeOperation = 'destination-in'; ig.drawImage(H, 0, 0); ig.globalCompositeOperation = 'source-over';
      ag.drawImage(Ir, 0, 0); blotches(ag, w, h, 8, 'rgba(40,36,30,A)', 6, 26, 0.6); // leaves / grit stuck in the bars
      rg.fillStyle = '#d8d8d8'; rg.fillRect(0, 0, w, h); mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h); mg.globalAlpha = 0.4; mg.drawImage(H, 0, 0); mg.globalAlpha = 1;
      finish(k, H, Al, Ro, Me, 8, 0.85);
    }
    // tree-pit grate: square cast iron, radial slots around an opening for the trunk
    {
      const k = 'treegrate', [w, h] = RES(k), cx = w / 2, cy = h / 2;
      const [H, hg] = layer(w, h), [Al, ag] = layer(w, h), [Ro, rg] = layer(w, h), [Me, mg] = layer(w, h);
      hg.fillStyle = '#a8a8a8'; hg.fillRect(0, 0, w, h);
      hg.fillStyle = '#000'; for (let ring = 0; ring < 6; ring++) { const r0 = w * (0.13 + ring * 0.058), cnt = 18 + ring * 6; for (let i = 0; i < cnt; i++) { const a = (i + (ring & 1) * 0.5) / cnt * Math.PI * 2; hg.save(); hg.translate(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); hg.rotate(a); hg.fillRect(-w * 0.018, -w * 0.006, w * 0.036, w * 0.012); hg.restore(); } }
      hg.beginPath(); hg.arc(cx, cy, w * 0.1, 0, 7); hg.fill();
      hg.strokeStyle = '#000'; hg.lineWidth = 3; hg.beginPath(); hg.moveTo(cx, 0); hg.lineTo(cx, h); hg.stroke();
      hg.strokeStyle = '#d0d0d0'; hg.lineWidth = w * 0.02; hg.strokeRect(w * 0.01, h * 0.01, w * 0.98, h * 0.98);
      const [So, sg] = layer(w, h); sg.fillStyle = '#3a2c20'; sg.fillRect(0, 0, w, h); blotches(sg, w, h, 80, 'rgba(60,44,28,A)', 2, 10, 0.7); // mulch, soil, cigarette ends
      sg.fillStyle = 'rgba(200,190,170,0.6)'; for (let i = 0; i < 18; i++) sg.fillRect(rnd() * w, rnd() * h, 6, 2);
      ag.drawImage(So, 0, 0);
      const [Ir, ig] = layer(w, h); ig.fillStyle = '#26231f'; ig.fillRect(0, 0, w, h); blotches(ig, w, h, 40, 'rgba(98,56,26,A)', 6, 40, 0.55); ig.globalAlpha = 0.35; ig.drawImage(noiseCanvas(w, h, 128, 150, 2), 0, 0); ig.globalAlpha = 1;
      ig.globalCompositeOperation = 'destination-in'; ig.filter = 'contrast(8)'; ig.drawImage(H, 0, 0); ig.filter = 'none'; ig.globalCompositeOperation = 'source-over';
      ag.drawImage(Ir, 0, 0);
      rg.fillStyle = '#d0d0d0'; rg.fillRect(0, 0, w, h); mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h); mg.globalAlpha = 0.35; mg.filter = 'contrast(8)'; mg.drawImage(H, 0, 0); mg.filter = 'none'; mg.globalAlpha = 1;
      finish(k, H, Al, Ro, Me, 6, 0.8);
    }
    // soil / mulch (open tree pits) and Belgian-block cobbles (pit surrounds)
    {
      const k = 'soil', [w, h] = RES(k);
      const [H, hg] = layer(w, h), [Al, ag] = layer(w, h), [Ro, rg] = layer(w, h), [Me, mg] = layer(w, h);
      hg.drawImage(noiseCanvas(w, h, 128, 200, 2), 0, 0); blotches(hg, w, h, 60, 'rgba(255,255,255,A)', 2, 8, 0.6);
      ag.fillStyle = '#3b2d21'; ag.fillRect(0, 0, w, h); blotches(ag, w, h, 180, 'rgba(98,74,46,A)', 1.5, 7, 0.8); blotches(ag, w, h, 20, 'rgba(40,40,30,A)', 4, 14, 0.6);
      ag.fillStyle = 'rgba(190,180,160,0.5)'; for (let i = 0; i < 10; i++) ag.fillRect(rnd() * w, rnd() * h, 5, 1.5);
      rg.fillStyle = '#f0f0f0'; rg.fillRect(0, 0, w, h); mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h);
      finish(k, H, Al, Ro, Me, 4, 0.7);
    }
    {
      const k = 'cobble', [w, h] = RES(k);
      const [H, hg] = layer(w, h), [Al, ag] = layer(w, h), [Ro, rg] = layer(w, h), [Me, mg] = layer(w, h);
      hg.fillStyle = '#000'; hg.fillRect(0, 0, w, h); ag.fillStyle = '#141210'; ag.fillRect(0, 0, w, h);
      const bh = h / 6;
      for (let row = 0; row < 6; row++) { let x = -rnd() * w * 0.2; while (x < w) { const bw = w * (0.2 + rnd() * 0.12); const gr = hg.createRadialGradient(x + bw / 2, row * bh + bh / 2, 1, x + bw / 2, row * bh + bh / 2, bw * 0.6); gr.addColorStop(0, '#e0e0e0'); gr.addColorStop(1, '#707070'); hg.fillStyle = gr; hg.beginPath(); hg.roundRect(x + 3, row * bh + 3, bw - 6, bh - 6, 6); hg.fill(); const v = 60 + rnd() * 40; ag.fillStyle = `rgb(${v},${v * 0.97},${v * 0.93})`; ag.beginPath(); ag.roundRect(x + 3, row * bh + 3, bw - 6, bh - 6, 6); ag.fill(); x += bw; } }
      ag.globalAlpha = 0.3; ag.drawImage(noiseCanvas(w, h, 128, 160, 1), 0, 0); ag.globalAlpha = 1;
      rg.fillStyle = '#c0c0c0'; rg.fillRect(0, 0, w, h); rg.globalAlpha = 0.5; rg.filter = 'invert(1)'; rg.drawImage(H, 0, 0); rg.filter = 'none'; rg.globalAlpha = 1;
      mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h);
      finish(k, H, Al, Ro, Me, 5, 0.7);
    }
    // granite kerb stones: crops of the granite photo inside one tile (no joints), worn darker toward the road edge
    {
      const [gd, gn, gr] = await Promise.all(granite.map(load));
      for (const [k, sx] of [['kerb', 0.03], ['kerb2', 0.36]]) {
        const [w, h] = RES(k), sw = gd.width * 0.3, sh = sw / 3.8; // a 1.8 m stone: 0.3 m top + 0.17 m face
        const [Al, ag] = layer(w, h); ag.filter = 'saturate(0.3) brightness(0.62) contrast(1.1)'; ag.drawImage(gd, sx * gd.width, 0.04 * gd.height, sw, sh, 0, 0, w, h); ag.filter = 'none';
        // top band (v 0..0.62): the walking face; 0.62..0.72: the bevelled arris (lighter, polished); 0.72..1: the kerb face (dirtier)
        const g1 = ag.createLinearGradient(0, 0, 0, h); g1.addColorStop(0, 'rgba(20,18,16,0.35)'); g1.addColorStop(0.15, 'rgba(0,0,0,0)'); g1.addColorStop(0.55, 'rgba(0,0,0,0)'); g1.addColorStop(0.64, 'rgba(255,250,240,0.12)'); g1.addColorStop(0.72, 'rgba(0,0,0,0.05)'); g1.addColorStop(1, 'rgba(12,10,8,0.55)');
        ag.fillStyle = g1; ag.fillRect(0, 0, w, h);
        blotches(ag, w, h, 14, 'rgba(18,16,14,A)', 6, 30, 0.35);
        put(d, k, Al);
        const [Nn, ng] = layer(w, h); ng.drawImage(gn, sx * gn.width, 0.04 * gn.height, sw, sh, 0, 0, w, h); put(n, k, Nn);
        const [Rr, rg2] = layer(w, h); rg2.drawImage(gr, sx * gr.width, 0.04 * gr.height, sw, sh, 0, 0, w, h);
        const im = rg2.getImageData(0, 0, w, h), p = im.data; for (let i = 0; i < p.length; i += 4) { const v = p[i]; p[i] = 230; p[i + 1] = Math.min(255, v * 0.9 + 30); p[i + 2] = 0; } rg2.putImageData(im, 0, 0);
        put(r, k, Rr);
      }
    }
    // a fresh concrete flag (replaced square on the sidewalk): crop of the pavement photo, lighter and cleaner
    {
      const k = 'flag', [w, h] = RES(k), [fd, fn, fr] = await Promise.all(flag.map(load));
      const [Al, ag] = layer(w, h); ag.filter = 'brightness(1.12) saturate(0.6)'; ag.drawImage(fd, 0, 0, fd.width * 0.55, fd.height * 0.55, 0, 0, w, h); ag.filter = 'none';
      put(d, k, Al); const [Nn, ng] = layer(w, h); ng.drawImage(fn, 0, 0, fn.width * 0.55, fn.height * 0.55, 0, 0, w, h); put(n, k, Nn);
      const [Rr, rg2] = layer(w, h); rg2.drawImage(fr, 0, 0, fr.width * 0.55, fr.height * 0.55, 0, 0, w, h);
      const im = rg2.getImageData(0, 0, w, h), p = im.data; for (let i = 0; i < p.length; i += 4) { const v = p[i]; p[i] = 255; p[i + 1] = v; p[i + 2] = 0; } rg2.putImageData(im, 0, 0); put(r, k, Rr);
    }
    // litter (gutter scraps: paper, cups, leaves) on a dark transparent-free tile: drawn as the runtime's gutter strip
    {
      const k = 'paint', [w, h] = RES(k);
      const [Al, ag] = layer(w, h); ag.fillStyle = '#17150f'; ag.fillRect(0, 0, w, h); ag.globalAlpha = 0.5; ag.drawImage(noiseCanvas(w, h, 90, 120, 2), 0, 0); ag.globalAlpha = 1;
      blotches(ag, w, h, 50, 'rgba(58,44,26,A)', 3, 14, 0.7);
      for (let i = 0; i < 26; i++) { const v = 120 + rnd() * 110; ag.fillStyle = `rgba(${v},${v * 0.96},${v * 0.88},0.85)`; ag.save(); ag.translate(rnd() * w, rnd() * h); ag.rotate(rnd() * 6); ag.fillRect(-6 - rnd() * 8, -2 - rnd() * 4, 12 + rnd() * 16, 4 + rnd() * 8); ag.restore(); }
      for (let i = 0; i < 40; i++) { ag.fillStyle = `rgba(${70 + rnd() * 60},${40 + rnd() * 30},${12},0.8)`; ag.beginPath(); ag.ellipse(rnd() * w, rnd() * h, 3 + rnd() * 6, 2 + rnd() * 3, rnd() * 6, 0, 7); ag.fill(); }
      const [H, hg] = layer(w, h); hg.drawImage(noiseCanvas(w, h, 128, 160, 2), 0, 0);
      const [Ro, rg] = layer(w, h); rg.fillStyle = '#707070'; rg.fillRect(0, 0, w, h); const [Me, mg] = layer(w, h); mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h);
      finish(k, H, Al, Ro, Me, 3, 0.5);
    }
    const enc = async (c, q, size) => { let s = c; if (size !== c.width) { s = mk(size, size); const g = s.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, size, size); } return s.toDataURL('image/jpeg', q).split(',')[1]; };
    return {
      diff: await enc(D, 0.86, A), nor: await enc(N, 0.9, A), arm: await enc(R, 0.82, A),
      diff512: await enc(D, 0.84, A / 2), nor512: await enc(N, 0.88, A / 2), arm512: await enc(R, 0.8, A / 2),
    };
  }, { A, PAD, SLOTS, sets, granite, asphalt, flag });
  await browser.close();
  const sizes = {};
  for (const [k, f] of [['diff', 'atlas_diff.jpg'], ['nor', 'atlas_nor.jpg'], ['arm', 'atlas_arm.jpg'], ['diff512', 'atlas512/atlas_diff.jpg'], ['nor512', 'atlas512/atlas_nor.jpg'], ['arm512', 'atlas512/atlas_arm.jpg']]) {
    const b = Buffer.from(out[k], 'base64'); fs.writeFileSync(path.join(OUT, f), b); sizes[f] = b.length;
  }
  return sizes;
}

// ------------------------------------------------------------------ main
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
console.log('[bake-street] geometry');
const meshes = [...PROPS.map((P) => buildProp(P, 0)), ...PROPS.filter((P) => !P.keepY).map((P) => buildProp(P, 1))];
const atlas = {}; for (const k in SLOTS) atlas[k] = uvRect(k);
const binBytes = writeGltf(meshes, { atlas, size: A, pad: PAD });
const tris = meshes.reduce((t, m) => t + m.idx.length / 3, 0);
console.log(`[bake-street] street.bin ${binBytes} bytes, ${tris} triangles in ${meshes.length} meshes`);
if (!args['no-images']) {
  console.log('[bake-street] images');
  const sizes = await bakeImages();
  for (const f in sizes) console.log(`  ${f} ${sizes[f]} bytes`);
}
