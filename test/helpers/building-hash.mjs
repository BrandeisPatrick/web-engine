// Hash of every building geometry buffer of a built world (test helper): the gate that buildings without a descriptor
// are byte-identical to what the generic builder made before descriptors existed (test/building-descriptors.mjs).
import { createHash } from 'node:crypto';

/** sha1 over name, attribute arrays and index of every mesh whose name starts with `buildings` (in scene order). */
export function hashBuildingMeshes(root) {
  const h = createHash('sha1');
  let meshes = 0, tris = 0;
  root.traverse((m) => {
    if (!m.isMesh || !/^building/.test(m.name)) return;
    meshes++;
    const g = m.geometry;
    h.update(m.name);
    for (const k of Object.keys(g.attributes).sort()) {
      const a = g.attributes[k].array;
      h.update(k); h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    }
    if (g.index) { const a = g.index.array; h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); tris += a.length / 3; }
  });
  return { hash: h.digest('hex'), meshes, tris };
}
