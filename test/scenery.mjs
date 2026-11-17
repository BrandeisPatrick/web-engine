// Headless checks for the starters' scenery (src/world/Scenery.js): countryRoad and parkCorner build, are deterministic,
// put their colliders into the PhysicsWorld (and none on the road or the path), paint faces up with the right dashes,
// and groundCover packs its path segments (capped at COVER_MAX_SEGMENTS). No browser: trees build their colliders only.
// Run: node test/scenery.mjs
import * as THREE from 'three';
import { countryRoad, parkCorner, groundCover, paintedLines, COVER_MAX_SEGMENTS } from '../src/world/Scenery.js';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.js';

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  ' + detail : ''}`);
}
const staticMesh = (r) => r.group.children.find((o) => o.name === 'sceneryStatic');
const hashPos = (g) => { let h = 0; const a = g.getAttribute('position').array; for (let i = 0; i < a.length; i += 7) h = (h * 31 + Math.round(a[i] * 1000)) | 0; return h; };

// ---- road paint: faces up, dash counts
{
  const m = paintedLines([{ x: 0, from: 0, to: -120, dash: [3, 9] }, { x: 3, from: 0, to: -10 }, { x: -3, from: -10, to: 0 }]);
  const P = m.geometry.getAttribute('position').array, I = m.geometry.index.array;
  let up = 0;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
    if (new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).y > 0) up++;
  }
  check('paint: every triangle faces up (either direction along Z)', up === I.length / 3, `${up} / ${I.length / 3}`);
  check('paint: 120 m of 3 m dashes every 12 m = 10 dashes, plus two solid lines', I.length / 6 === 12, `${I.length / 6} quads`);
}

// ---- countryRoad
{
  const physics = new PhysicsWorld(), before = physics.staticBoxes.length;
  const r = countryRoad({ physics });
  const boxes = physics.staticBoxes.slice(before);
  const g = staticMesh(r).geometry;
  check('road: static mesh built', g.getAttribute('position').count > 3000, `${g.getAttribute('position').count} vertices`);
  check('road: two asphalt surfaces (road, lay-by)', r.surfaces.length === 2 && r.surfaces.every((s) => s.mesh.isMesh));
  check('road: gravel paths for groundCover (two verges, a track)', r.paths.length === 3);
  check('road: fence posts both sides', r.counts.posts > 600, `${r.counts.posts}`);
  check('road: trees planted (near, field, tree line)', r.counts.trees > 300, `${r.counts.trees}`);
  check('road: colliders added (poles, sign, trunks)', boxes.length > 30, `${boxes.length}`);
  const onRoad = boxes.filter((b) => b.maxX > -12 && b.minX < 5 && b.maxZ > -110 && b.minZ < 10);
  check('road: no collider on the road or the lay-by', onRoad.length === 0, `${onRoad.length}`);
  const r2 = countryRoad({ physics: new PhysicsWorld() });
  check('road: deterministic (same seed, same geometry)', hashPos(g) === hashPos(staticMesh(r2).geometry));
  const r3 = countryRoad({ seed: 9 });
  check('road: another seed differs', hashPos(g) !== hashPos(staticMesh(r3).geometry));
  r.update(1 / 60, new THREE.Vector3(), 0); // no throw without a GPU group
}

// ---- parkCorner
{
  const physics = new PhysicsWorld();
  const r = parkCorner({ physics, lamp: [3, -6] });
  const boxes = physics.staticBoxes;
  check('park: static mesh built (fence)', staticMesh(r).geometry.getAttribute('position').count > 1000);
  const rocks = r.group.children.find((o) => o.name === 'boulders');
  check('park: boulders, one indexed mesh with smooth normals and vertex colours', !!rocks && !!rocks.geometry.index && !!rocks.geometry.getAttribute('color') && rocks.geometry.getAttribute('position').count === 7 * 642, rocks ? `${rocks.geometry.getAttribute('position').count} vertices` : 'none');
  check('park: bench instance', r.group.children.some((o) => o.isInstancedMesh));
  check('park: one path for groundCover', r.paths.length === 1 && r.paths[0].points.length >= 4);
  const p = r.paths[0].points, segD = (x, z) => Math.min(...p.slice(1).map(([bx, bz], i) => {
    const [ax, az] = p[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t);
  }));
  const onPath = boxes.filter((b) => segD((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2) < 0.85 + Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2);
  check('park: colliders (bench, fence, boulders, trunks), none on the path', boxes.length > 30 && onPath.length === 0, `${boxes.length} boxes, ${onPath.length} on the path`);
  check('park: the walker\'s start (0, 0) is clear', !boxes.some((b) => b.minX < 0.4 && b.maxX > -0.4 && b.minZ < 0.4 && b.maxZ > -0.4));
}

// ---- groundCover
{
  const c = groundCover({ paths: [{ points: [[0, 0], [0, -10], [5, -20]], width: 2 }] });
  check('cover: patch shape (world position, surface code)', c.worldPosition === true && typeof c.fragmentSurface === 'string' && c.key === 'cover');
  check('cover: two segments, half widths', c.uniforms.uScN.value === 2 && c.uniforms.uScHalf.value[0] === 1);
  const many = groundCover({ paths: [{ points: Array.from({ length: 40 }, (_, i) => [i, 0]) }] });
  check('cover: capped at COVER_MAX_SEGMENTS', many.uniforms.uScN.value === COVER_MAX_SEGMENTS && many.uniforms.uScSeg.value.length === COVER_MAX_SEGMENTS);
}

console.log(failures ? `\n${failures} scenery check(s) failed` : '\nall scenery checks passed');
process.exit(failures ? 1 : 0);
