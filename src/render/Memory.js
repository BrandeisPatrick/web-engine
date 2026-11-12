// CPU-side copies of GPU data: what a built scene keeps on the JS heap and what can go. three keeps every
// BufferAttribute's typed array and every DataTexture's / CompressedTexture's pixels after the upload; for a large
// static world nothing reads them again, and they are most of the heap (a city: 50-100 MB of vertex arrays, 2 x 17-22
// MB of vegetation atlases, every compressed mip chain). Everything here is OPT-IN and one-way: a released attribute
// or texture cannot be uploaded again (a lost WebGL context cannot restore it, and code that reads the arrays, such
// as a raycast against the mesh or a geometry merge, finds them empty), so call it on finished, static content only.
//
//   releaseStaticGeometry(root)                -> bytes that will be freed: every static-draw attribute of every plain
//                                                 Mesh under root drops its array right after its upload (three's
//                                                 onUpload hook); bounding volumes are computed first (culling needs them)
//   releaseTextureData(root, renderer, { minBytes }) -> bytes: DataTextures / DataArrayTextures / CompressedTextures
//                                                 used by materials under root drop their pixels once uploaded
//   createMemoryTrim(root, { renderer, interval = 3, minBytes })  -> a system { update(dt), releasedBytes, sweep() }
//                                                 that repeats both sweeps every `interval` seconds, for content that
//                                                 arrives later (streamed tiles, late textures)
// Skipped on purpose: BatchedMesh / SkinnedMesh / morph targets (their attributes are read or rewritten at run time),
// every per-instance attribute (InstancedBufferAttribute: instance matrices, colours, a game's own per-instance data),
// dynamic-usage attributes, interleaved buffers, canvas / image / video textures (the browser owns those), textures
// under `minBytes` (default 1 MB: not worth the risk). An InstancedMesh keeps its instance data and drops only the
// per-vertex arrays of the shape it instances (a 40 k-triangle vehicle drawn eight times holds its vertices once).
import * as THREE from 'three';

function dropArray() { this.array = new this.array.constructor(0); }

function releaseGeometry(g) {
  if (!g || g.userData.cpuReleased) return 0;
  if (!g.boundingSphere) g.computeBoundingSphere();
  if (!g.boundingBox) g.computeBoundingBox();
  g.userData.cpuReleased = true;
  let bytes = 0;
  const one = (a) => {
    if (!a || a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute || a.usage !== THREE.StaticDrawUsage || !a.array || !a.array.byteLength) return;
    bytes += a.array.byteLength;
    a.onUpload(dropArray);
  };
  for (const k in g.attributes) one(g.attributes[k]);
  one(g.index);
  return bytes;
}

/**
 * Static meshes under `root` drop their CPU vertex arrays after their next upload (see the header for what is skipped).
 * @param {THREE.Object3D} root
 * @param {{ filter?: (mesh: THREE.Mesh) => boolean }} [o]  filter: return false to keep a mesh's arrays
 * @returns {number} bytes that will be freed
 */
export function releaseStaticGeometry(root, { filter = null } = {}) {
  let bytes = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.isBatchedMesh || o.isSkinnedMesh || o.morphTargetInfluences) return;
    if (!o.geometry || o.userData.keepCpu) return;
    if (filter && filter(o) === false) return;
    bytes += releaseGeometry(o.geometry);
  });
  return bytes;
}

const texBytes = (t) => {
  let b = 0;
  if (t.image && t.image.data && t.image.data.byteLength) b += t.image.data.byteLength;
  if (t.mipmaps) for (const m of t.mipmaps) if (m && m.data && m.data.byteLength) b += m.data.byteLength;
  return b;
};
function dropPixels(t) {
  if (t.image && t.image.data && t.image.data.byteLength) t.image.data = new t.image.data.constructor(0);
  if (t.mipmaps) for (const m of t.mipmaps) if (m && m.data && m.data.byteLength) m.data = new m.data.constructor(0);
}

/**
 * Data and compressed textures used by materials under `root` drop their CPU pixels once uploaded.
 * @param {THREE.Object3D} root
 * @param {THREE.WebGLRenderer|null} [renderer]  with it, a texture that is already uploaded is released at once
 * @param {{ minBytes?: number }} [o]
 * @returns {number} bytes freed or scheduled to be freed
 */
export function releaseTextureData(root, renderer = null, { minBytes = 1e6 } = {}) {
  let bytes = 0;
  const seen = new Set();
  const one = (t) => {
    if (!t || seen.has(t) || t.userData.cpuReleased || t.userData.keepCpu) return;
    if (!(t.isDataTexture || t.isDataArrayTexture || t.isData3DTexture || t.isCompressedTexture)) return;
    const b = texBytes(t);
    if (b < minBytes) return;
    seen.add(t); t.userData.cpuReleased = true; bytes += b;
    const p = renderer && renderer.properties.get(t);
    if (p && p.__webglTexture && p.__version === t.version) { dropPixels(t); return; }
    const prev = t.onUpdate;
    t.onUpdate = function () { if (prev) prev.call(this, this); dropPixels(this); this.onUpdate = null; };
  };
  root.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k in m) { const v = m[k]; if (v && v.isTexture) one(v); }
      if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) one(v); }
      if (m.userData && m.userData.u) for (const k in m.userData.u) { const v = m.userData.u[k] && m.userData.u[k].value; if (v && v.isTexture) one(v); }
    }
  });
  return bytes;
}

/**
 * A system that runs both sweeps now and again every `interval` seconds (content that streams in later).
 * @param {THREE.Object3D} root
 * @param {{ renderer?: THREE.WebGLRenderer|null, interval?: number, minBytes?: number, filter?: (mesh: THREE.Mesh) => boolean }} [o]
 * @returns {{ update(dt: number): void, sweep(): number, readonly releasedBytes: number }}
 */
export function createMemoryTrim(root, { renderer = null, interval = 3, minBytes = 1e6, filter = null } = {}) {
  let t = 0, total = 0;
  const sweep = () => { const b = releaseStaticGeometry(root, { filter }) + releaseTextureData(root, renderer, { minBytes }); total += b; return b; };
  sweep();
  return {
    get releasedBytes() { return total; },
    sweep,
    update(dt) { t += dt; if (t >= interval) { t = 0; sweep(); } },
  };
}
