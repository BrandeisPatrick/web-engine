// render/Memory.js: opt-in release of CPU copies (static geometry arrays, data / compressed texture pixels) after upload.
import * as THREE from 'three';
import { releaseStaticGeometry, releaseTextureData, createMemoryTrim } from '../src/render/Memory.js';

let failed = 0, n = 0;
const check = (name, ok, got) => { n++; if (!ok) { failed++; console.log(`FAIL  ${name}`, got ?? ''); } else console.log(`PASS  ${name}`); };
const upload = (g) => { for (const k in g.attributes) g.attributes[k].onUploadCallback.call(g.attributes[k]); if (g.index) g.index.onUploadCallback.call(g.index); };

{
  const root = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 4);
  const dyn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  dyn.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const kept = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial()); kept.userData.keepCpu = true;
  root.add(box, inst, dyn, kept);
  const before = box.geometry.attributes.position.array.byteLength + box.geometry.attributes.normal.array.byteLength + box.geometry.attributes.uv.array.byteLength + box.geometry.index.array.byteLength;
  const instBytes = ['position', 'normal', 'uv'].reduce((a, k) => a + inst.geometry.attributes[k].array.byteLength, 0) + inst.geometry.index.array.byteLength;
  const bytes = releaseStaticGeometry(root);
  const dynRest = dyn.geometry.attributes.normal.array.byteLength + dyn.geometry.attributes.uv.array.byteLength + dyn.geometry.index.array.byteLength;
  check('bytes = the static mesh, the static attributes of the mixed one and the instanced shape', bytes === before + dynRest + instBytes, [bytes, before, dynRest, instBytes]);
  check('nothing is dropped before the upload', box.geometry.attributes.position.array.byteLength > 0);
  check('bounding volumes exist before the arrays go', !!box.geometry.boundingSphere && !!box.geometry.boundingBox && box.geometry.boundingSphere.radius > 1.7);
  upload(box.geometry); upload(dyn.geometry);
  check('after upload: arrays empty, count kept, same array type', box.geometry.attributes.position.array.byteLength === 0 && box.geometry.attributes.position.count === 24 && box.geometry.attributes.position.array instanceof Float32Array && box.geometry.index.array.byteLength === 0);
  check('dynamic attribute kept', dyn.geometry.attributes.position.array.byteLength > 0);
  check('keepCpu mesh untouched; the instanced shape waits for its upload', kept.geometry.attributes.position.array.byteLength > 0 && !kept.geometry.userData.cpuReleased && inst.geometry.attributes.position.array.byteLength > 0);
  inst.geometry.setAttribute('aBrake', new THREE.InstancedBufferAttribute(new Float32Array(4), 1)); upload(inst.geometry);
  check('instanced mesh: per-vertex arrays dropped after upload, instance matrices and per-instance attributes kept', inst.geometry.attributes.position.array.byteLength === 0 && inst.instanceMatrix.array.byteLength === 64 * 4 && inst.geometry.attributes.aBrake.array.byteLength === 16);
  check('a second sweep finds nothing new', releaseStaticGeometry(root) === 0);
  check('filter can keep a mesh', (() => { const r = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()); r.add(m); return releaseStaticGeometry(r, { filter: () => false }) === 0 && !m.geometry.userData.cpuReleased; })());
}
{
  const big = new THREE.DataTexture(new Uint8Array(1024 * 512 * 4), 1024, 512), small = new THREE.DataTexture(new Uint8Array(64 * 64 * 4), 64, 64);
  const comp = new THREE.CompressedTexture([{ data: new Uint8Array(900000), width: 1024, height: 1024 }, { data: new Uint8Array(300000), width: 512, height: 512 }], 1024, 1024);
  const canvasLike = new THREE.Texture({ width: 4096, height: 4096 });
  const root = new THREE.Group();
  const m1 = new THREE.MeshStandardMaterial({ map: big, roughnessMap: small, normalMap: canvasLike });
  const m2 = new THREE.ShaderMaterial({ uniforms: { tA: { value: comp }, tB: { value: big } } });
  root.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m1), new THREE.Mesh(new THREE.PlaneGeometry(1, 1), [m2]));
  const bytes = releaseTextureData(root, null, { minBytes: 1e6 });
  check('bytes: the big data texture once and the compressed mip chain; small and image textures skipped', bytes === 1024 * 512 * 4 + 1200000, bytes);
  check('pixels stay until the upload', big.image.data.byteLength > 0 && comp.mipmaps[0].data.byteLength > 0);
  big.onUpdate(big); comp.onUpdate(comp);
  check('after upload: pixels and mips empty, size kept, hook cleared', big.image.data.byteLength === 0 && big.image.width === 1024 && comp.mipmaps[0].data.byteLength === 0 && comp.mipmaps[1].data.byteLength === 0 && big.onUpdate === null);
  check('small texture untouched', small.image.data.byteLength === 64 * 64 * 4 && !small.userData.cpuReleased);
  // an already-uploaded texture is released at once when the renderer knows it
  const t = new THREE.DataTexture(new Uint8Array(2e6), 1000, 500);
  const r2 = new THREE.Group(); r2.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t })));
  const fake = { properties: { get: (x) => (x === t ? { __webglTexture: {}, __version: t.version } : {}) } };
  releaseTextureData(r2, fake);
  check('already uploaded: released immediately', t.image.data.byteLength === 0);
  // an existing onUpdate hook still runs
  const t2 = new THREE.DataTexture(new Uint8Array(2e6), 1000, 500); let ran = 0; t2.onUpdate = () => { ran++; };
  const r3 = new THREE.Group(); r3.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t2 })));
  releaseTextureData(r3); t2.onUpdate(t2);
  check('a previous onUpdate hook is chained', ran === 1 && t2.image.data.byteLength === 0);
}
{
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  const trim = createMemoryTrim(root, { interval: 2 });
  const first = trim.releasedBytes;
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())); // a tile that streams in later
  trim.update(1); const mid = trim.releasedBytes; trim.update(1.1);
  check('createMemoryTrim: sweeps at once, then again every interval', first > 0 && mid === first && trim.releasedBytes === 2 * first, [first, mid, trim.releasedBytes]);
}
console.log(failed ? `${failed} of ${n} check(s) FAILED` : `all ${n} checks passed`);
process.exit(failed ? 1 : 0);
