// What says "New York" in outline and at street level: wooden rooftop water tanks on steel legs (instanced: tank,
// conical roof, legs, a band of hoops), and sidewalk sheds (the green plywood scaffold decks over the sidewalk, posts at
// the kerb and at the wall, a fluorescent tube every few metres under the deck, a dim clustered light). Sheds register
// box colliders for their kerb posts, so the walker goes round them. Seeded.
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Wooden staves: vertical planks with dark seams, weathered (a small canvas texture). */
function staveTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'), R = rng(3);
  for (let x = 0; x < 256; x += 8) { const v = 40 + R() * 30; g.fillStyle = `rgb(${v + 22},${v + 8},${v - 6})`; g.fillRect(x, 0, 8, 64); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 1, 64); }
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(20,14,8,${0.15 + R() * 0.25})`; g.fillRect(R() * 256, R() * 64, 2 + R() * 10, 1 + R() * 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

/**
 * o: { world, scene, square: {x,z}, facades (from buildSignage), radius = 650, towers = 90, sheds = 14, lights (array to
 * push { x, y, z, range, r, g, b, kind } into) }. Returns { group, counts }.
 */
export function buildStructures(o) {
  const { world } = o, R = rng(o.seed ?? 1977);
  const group = new THREE.Group(); group.name = 'structures-nyc';
  const counts = { towers: 0, sheds: 0, shedPosts: 0 };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3();

  // ---------------------------------------------------------------- water towers
  const T = [];
  const SQ = o.square, R2 = (o.radius ?? 650) ** 2;
  for (const b of world.data.buildings) {
    if (T.length >= (o.towers ?? 90)) break;
    const p = b && b.p; if (!p || p.length < 4 || !(b.h > 14) || b.h > 75 || (b.mh || 0) > 0.5 || (o.skip && o.skip.has(b))) continue; // skip: crowns.js tops
    let cx = 0, cz = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const v of p) { cx += v[0]; cz += v[1]; minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]); minZ = Math.min(minZ, v[1]); maxZ = Math.max(maxZ, v[1]); }
    cx /= p.length; cz /= p.length;
    if ((cx - SQ.x) ** 2 + (cz - SQ.z) ** 2 > R2 || maxX - minX < 12 || maxZ - minZ < 12 || R() > 0.3) continue;
    const ox = (R() - 0.5) * (maxX - minX) * 0.4, oz = (R() - 0.5) * (maxZ - minZ) * 0.4;
    const gy = world.getGroundHeight(cx, cz);
    T.push({ x: cx + ox, y: gy + b.h, z: cz + oz, r: 1.8 + R() * 1.0, h: 3.6 + R() * 1.4, legs: 2.4 + R() * 1.6, yaw: R() * 6.28 });
  }
  if (T.length) {
    const wood = new THREE.MeshStandardMaterial({ map: staveTexture(), roughness: 0.92, metalness: 0 });
    const roofM = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.8, metalness: 0.2 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6, metalness: 0.7 });
    const tank = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.04, 1, 20, 1, false).translate(0, 0.5, 0), wood, T.length);
    const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(1.06, 0.55, 20).translate(0, 0.27, 0), roofM, T.length);
    const hoops = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.05, 1.05, 0.06, 20, 1, true), steel, T.length * 3);
    const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 0.16).translate(0, 0.5, 0), steel, T.length * 5);
    T.forEach((t, i) => {
      q.setFromAxisAngle(up, t.yaw);
      tank.setMatrixAt(i, m4.compose(P.set(t.x, t.y + t.legs, t.z), q, S.set(t.r, t.h, t.r)));
      roof.setMatrixAt(i, m4.compose(P.set(t.x, t.y + t.legs + t.h, t.z), q, S.set(t.r, t.r * 1.2, t.r)));
      for (let k = 0; k < 3; k++) hoops.setMatrixAt(i * 3 + k, m4.compose(P.set(t.x, t.y + t.legs + t.h * (0.2 + k * 0.3), t.z), q, S.set(t.r, 1, t.r)));
      for (let k = 0; k < 4; k++) {
        const a = t.yaw + k * Math.PI / 2 + Math.PI / 4, rr = t.r * 0.72;
        legs.setMatrixAt(i * 5 + k, m4.compose(P.set(t.x + Math.cos(a) * rr, t.y, t.z + Math.sin(a) * rr), q, S.set(1, t.legs, 1)));
      }
      legs.setMatrixAt(i * 5 + 4, m4.compose(P.set(t.x, t.y + t.legs - 0.12, t.z), q, S.set(t.r * 9, 0.24, t.r * 9))); // the platform
    });
    for (const m of [tank, roof, hoops, legs]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    counts.towers = T.length;
  }

  // ---------------------------------------------------------------- sidewalk sheds
  const sheds = [];
  for (const f of o.facades || []) {
    if (sheds.length >= (o.sheds ?? 14)) break;
    if (f.d > 520 || f.len < 16 || f.len > 70 || f.b.h < 15 || R() > 0.1) continue;
    sheds.push(f);
  }
  if (sheds.length) {
    const deckM = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.85, metalness: 0 });
    const postM = new THREE.MeshStandardMaterial({ color: 0x23402e, roughness: 0.7, metalness: 0.3 });
    const tubeM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdde8ff, emissiveIntensity: 0.9 });
    const deckL = [], postL = [], tubeL = [];
    const W = 2.6, Hd = 3.3;
    for (const f of sheds) {
      const yaw = Math.atan2(f.nx, f.nz), gy = world.getGroundHeight(f.mx, f.mz);
      const at = (s, out) => [f.a[0] + f.tx * s + f.nx * out, f.a[1] + f.tz * s + f.nz * out];
      const s0 = 1, s1 = f.len - 1, L = s1 - s0;
      const [dx, dz] = at((s0 + s1) / 2, W / 2 + 0.3);
      deckL.push([dx, gy + Hd + 0.15, dz, yaw, L, 0.3, W + 0.1]);
      const [ex, ez] = at((s0 + s1) / 2, W + 0.35);
      deckL.push([ex, gy + Hd + 0.55, ez, yaw, L, 0.8, 0.06]); // the parapet board along the kerb edge
      for (let s = s0; s <= s1 + 0.01; s += 2.4) {
        for (const out of [0.7, W + 0.3]) {
          const [px, pz] = at(Math.min(s, s1), out);
          postL.push([px, gy + Hd / 2, pz, yaw, 0.14, Hd, 0.14]);
          if (out > 1) { world.colliders.add(px - 0.12, gy - 0.2, px + 0.12, gy + Hd, pz - 0.12, pz + 0.12, 3); counts.shedPosts++; }
        }
      }
      for (let s = s0 + 1.5; s < s1; s += 4.8) {
        const [tx, tz] = at(s, W / 2 + 0.3);
        tubeL.push([tx, gy + Hd - 0.04, tz, yaw + Math.PI / 2, 1.2, 0.05, 0.08]);
        if (o.lights && (s - s0) % 9.6 < 4.8) o.lights.push({ kind: 'shed', sx: tx, sy: gy + Hd - 0.2, sz: tz, nx: f.nx, nz: f.nz, x: tx, y: gy + Hd - 0.3, z: tz, range: 6, k: 1, anim: null, r: 0.55, g: 0.6, b: 0.62 });
      }
      counts.sheds++;
    }
    const mk = (list, mat, name, shadow) => {
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
      list.forEach((e, i) => { q.setFromAxisAngle(up, e[3]); im.setMatrixAt(i, m4.compose(P.set(e[0], e[1], e[2]), q, S.set(e[4], e[5], e[6]))); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.name = name; im.castShadow = shadow; im.receiveShadow = true;
      group.add(im);
    };
    mk(deckL, deckM, 'shed-decks', true); mk(postL, postM, 'shed-posts', true); mk(tubeL, tubeM, 'shed-tubes', false);
  }
  o.scene.add(group);
  return { group, counts };
}
