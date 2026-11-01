// Headless checks for render/SoftMeshes.js ClothMesh: the plain grid is the particle grid (default, unchanged), and the
// opt-in `subdivide: k` grid is a Catmull-Rom surface through the particles (its every k-th vertex is a particle,
// straight rows stay straight, a flat cloth stays flat, uv spans the fine grid, normals unit length), interpolating
// refined captures matches refining interpolated particles (the refinement is linear; its scratch is allocated once).
// No browser, no WebGL. Run: node test/cloth-mesh.mjs
import { DynamicsWorld } from '../src/physics/dynamics/DynamicsWorld.js';
import { Cloth } from '../src/physics/dynamics/particles.js';
import { ClothMesh } from '../src/render/SoftMeshes.js';
import * as THREE from 'three';

let failures = 0, total = 0;
const results = [];
function check(name, ok, detail = '') {
  total++;
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const Q_FLAT = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const mat = new THREE.MeshBasicMaterial();

function world(nx = 7, ny = 5) {
  const w = new DynamicsWorld({ maxParticles: 256 });
  const cloth = Cloth.grid(w, { nx, ny, spacing: 0.1, position: [0, 2, 0], quaternion: Q_FLAT, pins: ['top-left', 'top-right'] });
  return { w, cloth };
}

// ---- default: the plain particle grid, exactly as before
{
  const { w, cloth } = world();
  const cm = new ClothMesh(w.particles, cloth, mat);
  const P = cm.geometry.attributes.position.array, pos = w.particles.pos;
  let err = 0;
  for (let v = 0; v < cloth.nx * cloth.ny; v++) for (let c = 0; c < 3; c++) err = Math.max(err, Math.abs(P[v * 3 + c] - pos[cm.ids[v] * 3 + c]));
  check('default: one vertex per particle', cm.geometry.attributes.position.count === cloth.nx * cloth.ny && cm.subdivide === 1);
  check('default: vertices are the particles', err < 1e-6, `max err ${err.toExponential(2)}`);
  check('default: two triangles per cell', cm.geometry.index.count === (cloth.nx - 1) * (cloth.ny - 1) * 6);
}

// ---- subdivide 3 on a draped cloth
{
  const { w, cloth } = world();
  for (let i = 0; i < 90; i++) w.step(1 / 60);
  const k = 3, cm = new ClothMesh(w.particles, cloth, mat, { subdivide: k });
  const NX = (cloth.nx - 1) * k + 1, NY = (cloth.ny - 1) * k + 1;
  check('subdivide: grid size', cm.gridX === NX && cm.gridY === NY && cm.geometry.attributes.position.count === NX * NY, `${cm.gridX} x ${cm.gridY}`);
  check('subdivide: index covers the fine grid', cm.geometry.index.count === (NX - 1) * (NY - 1) * 6);
  const P = cm.geometry.attributes.position.array, pos = w.particles.pos;
  let err = 0;
  for (let j = 0; j < cloth.ny; j++) for (let i = 0; i < cloth.nx; i++) {
    const v = i * k + j * k * NX, p = cm.ids[i + j * cloth.nx] * 3;
    for (let c = 0; c < 3; c++) err = Math.max(err, Math.abs(P[v * 3 + c] - pos[p + c]));
  }
  check('subdivide: every k-th vertex is its particle', err < 1e-5, `max err ${err.toExponential(2)}`);
  const uv = cm.geometry.attributes.uv.array;
  check('subdivide: uv spans the fine grid', uv[0] === 0 && uv[1] === 0 && Math.abs(uv[(NX * NY - 1) * 2] - 1) < 1e-6 && Math.abs(uv[(NX * NY - 1) * 2 + 1] - 1) < 1e-6);
  const N = cm.geometry.attributes.normal.array;
  let nerr = 0;
  for (let i = 0; i < N.length; i += 3) nerr = Math.max(nerr, Math.abs(Math.hypot(N[i], N[i + 1], N[i + 2]) - 1));
  check('subdivide: unit normals', nerr < 1e-4, `max err ${nerr.toExponential(2)}`);
  // interpolation: capture twice around a step, then update(0.5) = refine(lerp(particles))
  const prevPos = Float64Array.from(w.particles.pos);
  w.step(1 / 60);
  const nextPos = Float64Array.from(w.particles.pos);
  for (let i = 0; i < prevPos.length; i++) w.particles.pos[i] = (prevPos[i] + nextPos[i]) / 2;
  const fresh = new ClothMesh(w.particles, cloth, mat, { subdivide: k });
  fresh.capture(); fresh.update(1); // reads the store as it is now
  // a mesh fed snapshot A then B, update(0.5), against `fresh` (refined from the particles' midpoint)
  let ierr = 0;
  for (let i = 0; i < prevPos.length; i++) w.particles.pos[i] = prevPos[i];
  const lerpMesh = new ClothMesh(w.particles, cloth, mat, { subdivide: k });
  lerpMesh.capture();
  for (let i = 0; i < nextPos.length; i++) w.particles.pos[i] = nextPos[i];
  lerpMesh.capture();
  lerpMesh.update(0.5);
  const A = lerpMesh.geometry.attributes.position.array, B = fresh.geometry.attributes.position.array;
  for (let i = 0; i < A.length; i++) ierr = Math.max(ierr, Math.abs(A[i] - B[i]));
  check('subdivide: interpolated refined grid = refined interpolated particles', ierr < 1e-5, `max err ${ierr.toExponential(2)}`);
}

// ---- a flat, straight cloth stays flat and its rows straight (linear precision of the refinement)
{
  const w = new DynamicsWorld({ maxParticles: 256 });
  const cloth = Cloth.grid(w, { nx: 5, ny: 4, spacing: 0.2, position: [0, 1, 0], quaternion: Q_FLAT });
  const cm = new ClothMesh(w.particles, cloth, mat, { subdivide: 4 });
  const P = cm.geometry.attributes.position.array, y0 = P[1];
  let flat = 0;
  for (let i = 1; i < P.length; i += 3) flat = Math.max(flat, Math.abs(P[i] - y0));
  // the fine vertices of the first row are evenly spaced along it
  const NX = cm.gridX, dx0 = P[3] - P[0];
  let even = 0;
  for (let I = 1; I < NX; I++) even = Math.max(even, Math.abs((P[I * 3] - P[(I - 1) * 3]) - dx0) + Math.abs(P[I * 3 + 2] - P[2]));
  check('subdivide: a flat cloth stays flat', flat < 1e-6, `max dy ${flat.toExponential(2)}`);
  check('subdivide: a straight row stays straight and evenly spaced', even < 1e-5, `max err ${even.toExponential(2)}`);
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} of ${total} check(s) FAILED` : `\nall ${total} checks passed`);
process.exit(failures ? 1 : 0);
