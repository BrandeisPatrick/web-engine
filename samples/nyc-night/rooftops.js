// What breaks the straight roof cut against the dusk sky, and the small things stuck to a New York wall: mechanical
// penthouses, stair bulkheads, HVAC boxes, stepped parapets (a raised panel at the middle of the street face), antenna
// masts (red beacons on the tall ones: returned for airglow.js), a few rooftop sign frames (steel lattice), satellite
// dishes, and window air-conditioner boxes on the street faces of the mid-rise blocks. Every box is one instance of a
// single InstancedMesh (per-instance colour), the dishes a second: two draw calls, no shadows (at dusk they are
// silhouettes). Boxes are turned to the footprint's longest edge and kept inside the footprint. Seeded.
// The night walk now passes ac: 0 (windowkit.js puts AC units in real window openings) and skip = the towers crowns.js
// tops (no penthouse box through a crown tier).
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function inPoly(p, x, z) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/**
 * o: { world, scene, center: {x,z}, radius = 700, max = 420 (buildings), facades (buildSignage), acRadius = 320,
 *   ac = 900 (max units), skip (Set of buildings whose roofs crowns.js built) }. Returns { group, beacons: [[x,y,z]], counts }.
 */
export function buildRooftops(o) {
  const { world } = o, R = rng(o.seed ?? 4242);
  const group = new THREE.Group(); group.name = 'rooftops-nyc';
  const boxes = [], dishes = [], beacons = [];
  const counts = { roofs: 0, boxes: 0, dishes: 0, ac: 0, beacons: 0 };
  const C = o.center, R2 = (o.radius ?? 700) ** 2;
  const grey = (v, w = 0) => [v + w * 0.02, v, v - w * 0.015];

  // nearest the centre first (the cap keeps the walker's blocks)
  const cand = [];
  for (const b of world.data.buildings) { const p = b && b.p; if (!p || p.length < 4) continue; cand.push([(p[0][0] - o.center.x) ** 2 + (p[0][1] - o.center.z) ** 2, b]); }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, b] of cand) {
    if (counts.roofs >= (o.max ?? 420)) break;
    const p = b && b.p; if (!p || p.length < 4 || !(b.h > 12) || (b.mh || 0) > 0.5 || (o.skip && o.skip.has(b))) continue; // skip: crowns.js tops
    let cx = 0, cz = 0;
    for (const v of p) { cx += v[0]; cz += v[1]; }
    cx /= p.length; cz /= p.length;
    if ((cx - C.x) ** 2 + (cz - C.z) ** 2 > R2) continue;
    // frame: the longest edge
    let L = 0, ux = 1, uz = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (l > L) { L = l; ux = (c[0] - a[0]) / l; uz = (c[1] - a[1]) / l; }
    }
    const vx = -uz, vz = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of p) { const u = (q[0] - cx) * ux + (q[1] - cz) * uz, v = (q[0] - cx) * vx + (q[1] - cz) * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const W = u1 - u0, D = v1 - v0;
    if (W < 7 || D < 7) continue;
    const yaw = Math.atan2(-uz, ux); // box local x along (ux, uz)
    const top = world.getGroundHeight(cx, cz) + b.h;
    const at = (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v];
    // a box at (u, v) in the footprint frame, size (sw along u, sd along v), height hh, standing on y0
    const put = (u, v, sw, sd, hh, y0, col, list = boxes) => {
      const corners = [[u - sw / 2, v - sd / 2], [u + sw / 2, v - sd / 2], [u + sw / 2, v + sd / 2], [u - sw / 2, v + sd / 2], [u, v]];
      for (const [cu, cv] of corners) { const [x, z] = at(cu, cv); if (!inPoly(p, x, z)) return false; }
      const [x, z] = at(u, v);
      list.push([x, y0 + hh / 2, z, yaw, sw, hh, sd, col]);
      return true;
    };
    const ru = () => u0 + W * (0.2 + 0.6 * R()), rv = () => v0 + D * (0.2 + 0.6 * R());
    const roofCol = grey(0.1 + R() * 0.08, R());
    let any = false;
    // mechanical penthouse (most of the mid and tall blocks)
    if (R() < 0.6) {
      const sw = W * (0.22 + R() * 0.22), sd = D * (0.22 + R() * 0.25), hh = 3 + R() * 3 + Math.min(4, b.h / 60);
      for (let k = 0; k < 4 && !any; k++) any = put(ru(), rv(), sw, sd, hh, top, roofCol);
      if (any && R() < 0.35) { const last = boxes[boxes.length - 1]; boxes.push([last[0], top + hh + 0.9, last[2], yaw, sw * 0.55, 1.8, sd * 0.6, roofCol]); } // a second tier
    }
    // stair bulkhead
    if (R() < 0.65) for (let k = 0; k < 4; k++) if (put(ru(), rv(), 2.6, 3.4, 2.8 + R() * 0.6, top, grey(0.14 + R() * 0.06, 1))) { any = true; break; }
    // HVAC boxes
    if (R() < 0.55) { const n = 2 + Math.floor(R() * 4), u = ru(), v = rv(); for (let k = 0; k < n; k++) if (put(u + (k % 3) * 2.2, v + Math.floor(k / 3) * 2.4, 1.8, 1.3, 1.1 + R() * 0.6, top, grey(0.2 + R() * 0.06))) any = true; }
    // stepped parapet: a raised panel at the middle of the long (street) edge
    if (b.h < 90 && R() < 0.6) for (const side of [v0 + 0.3, v1 - 0.3]) {
      if (R() < 0.35) continue;
      const sw = W * (0.2 + R() * 0.3), hh = 1.2 + R() * 1.8, uc = 0.5 * (u0 + u1) + (R() - 0.5) * W * 0.3;
      if (put(uc, side, sw, 0.45, hh, top, roofCol)) { any = true; if (R() < 0.5) put(uc, side, sw * 0.45, 0.45, hh * 0.6, top + hh, roofCol); }
    }
    // a bulkhead or elevator overrun pushed to the street edge (seen from the sidewalk over the parapet)
    if (R() < 0.35) { const side = R() < 0.5 ? v0 + 2.2 : v1 - 2.2; if (put(u0 + W * (0.15 + R() * 0.7), side, 3 + R() * 3, 3.6, 3 + R() * 2.5, top, roofCol)) any = true; }
    // antenna masts (beacons on the tall ones), small whips on the mid-rise
    if ((b.h > 45 && R() < 0.55) || R() < 0.18) {
      const n = b.h > 45 ? 1 + Math.floor(R() * 3) : 1;
      for (let k = 0; k < n; k++) {
        const hh = b.h > 45 ? 6 + R() * 12 : 3 + R() * 4, u = ru(), v = rv();
        if (put(u, v, 0.18, 0.18, hh, top, grey(0.12))) {
          any = true; put(u, v, 0.05, 1.6, 0.05, top + hh * 0.7, grey(0.12)); // a cross arm
          if (b.h > 100 && k === 0) { const [x, z] = at(u, v); beacons.push([x, top + hh + 0.15, z]); }
        }
      }
    }
    // satellite dishes
    if (R() < 0.3) { const u = ru(), v = rv(), [x, z] = at(u, v); if (inPoly(p, x, z)) { dishes.push([x, top + 1.2, z, R() * 6.28, 0.6 + R() * 0.6]); boxes.push([x, top + 0.6, z, yaw, 0.12, 1.2, 0.12, grey(0.15)]); } }
    // a rooftop sign frame (steel lattice, the board itself long gone or facing away)
    if (b.h > 14 && b.h < 60 && R() < 0.16) {
      const side = R() < 0.5 ? v0 + 1.4 : v1 - 1.4, sw = Math.min(W * 0.7, 9 + R() * 5), hh = 4 + R() * 3, u = 0.5 * (u0 + u1), col = grey(0.09);
      if (put(u, side, sw, 0.2, 0.2, top + hh, col)) {
        for (let k = 0; k <= 3; k++) put(u - sw / 2 + (k * sw) / 3, side, 0.18, 0.18, hh, top, col);
        put(u, side, sw, 0.12, 0.12, top + hh * 0.5, col);
        put(u, side, sw, 0.12, 0.12, top + 0.4, col);
        for (let k = 0; k < 3; k++) put(u - sw / 2 + ((k + 0.5) * sw) / 3, side - 1.0, 0.12, 0.12, hh * 0.8, top, col); // back braces
        any = true;
      }
    }
    if (any) counts.roofs++;
  }

  // the street edges themselves (what the walker sees over the parapet from across the street): stepped parapet
  // panels, overruns set a few metres back, pipe railings, a sign frame now and then
  const E2 = (o.edgeRadius ?? 600) ** 2;
  let edges = 0;
  for (const f of o.facades || []) {
    if (edges >= (o.edges ?? 1400)) break;
    const b = f.b, p = b.p;
    if (!(b.h > 12) || (b.mh || 0) > 0.5 || (o.skip && o.skip.has(b)) || f.len < 8 || (f.mx - C.x) ** 2 + (f.mz - C.z) ** 2 > E2) continue;
    const top = world.getGroundHeight(f.mx, f.mz) + b.h, yaw = Math.atan2(-f.tz, f.tx);
    const fput = (s, inward, sw, sd, hh, y0, col) => {
      for (const [ds, di] of [[-sw / 2, inward - sd / 2], [sw / 2, inward - sd / 2], [sw / 2, inward + sd / 2], [-sw / 2, inward + sd / 2]]) {
        const x = f.a[0] + f.tx * (s + ds) - f.nx * di, z = f.a[1] + f.tz * (s + ds) - f.nz * di;
        if (!inPoly(p, x, z)) return false;
      }
      boxes.push([f.a[0] + f.tx * s - f.nx * inward, y0 + hh / 2, f.a[1] + f.tz * s - f.nz * inward, yaw, sw, hh, sd, col]);
      return true;
    };
    const col = grey(0.1 + R() * 0.08, R());
    const r = R(), K = Math.min(3.5, Math.max(1, b.h / 35)); // the tall blocks get crowns in proportion (seen from far below)
    if (r < 0.35) { const sw = f.len * (0.2 + R() * 0.3), hh = (1.0 + R() * 2.2) * K, s = f.len * (0.3 + R() * 0.4); if (fput(s, 0.25, sw, 0.4, hh, top, col)) { edges++; if (R() < 0.4) fput(s, 0.25, sw * 0.4, 0.4, hh * 0.7, top + hh, col); } }
    else if (r < 0.7 || (r >= 0.85 && b.h >= 70)) { const sw = Math.min(14 * K, f.len * (0.25 + R() * 0.35)); if (fput(f.len * (0.2 + R() * 0.6), (3 + R() * 4) * Math.sqrt(K), sw, (4 + R() * 3) * Math.sqrt(K), (3 + R() * 4) * K, top, col)) edges++; }
    else if (r < 0.85) { // pipe railing with posts
      const s0 = f.len * R() * 0.3, s1 = f.len * (0.7 + R() * 0.3), rc = grey(0.08);
      if (fput((s0 + s1) / 2, 0.9, s1 - s0, 0.05, 0.05, top + 1.05, rc)) { for (let s = s0; s <= s1; s += 2.5) fput(s, 0.9, 0.05, 0.05, 1.1, top, rc); edges++; }
    } else { // sign frame along the edge
      const sw = Math.min(f.len * 0.7, 8 + R() * 6), hh = 3.5 + R() * 3, s = f.len / 2, fc = grey(0.08);
      if (fput(s, 1.2, sw, 0.18, 0.18, top + hh, fc)) {
        for (let k = 0; k <= 3; k++) fput(s - sw / 2 + (k * sw) / 3, 1.2, 0.16, 0.16, hh, top, fc);
        fput(s, 1.2, sw, 0.1, 0.1, top + hh * 0.55, fc);
        for (let k = 0; k < 3; k++) fput(s - sw / 2 + ((k + 0.5) * sw) / 3, 2.3, 0.1, 0.1, hh * 0.85, top, fc);
        edges++;
      }
    }
  }
  counts.edges = edges;

  // window air-conditioner boxes on the street faces of mid-rise blocks near the walker
  const AC2 = (o.acRadius ?? 320) ** 2, acMax = o.ac ?? 900;
  let ac = 0;
  for (const f of o.facades || []) {
    if (ac >= acMax) break;
    if ((f.mx - C.x) ** 2 + (f.mz - C.z) ** 2 > AC2 || !(f.b.h >= 10 && f.b.h <= 60) || f.len < 6 || R() > 0.55) continue;
    const gy = world.getGroundHeight(f.mx, f.mz), fh = 3.3 + R() * 0.4, bay = 2.8 + R() * 0.6;
    const floors = Math.floor((f.b.h - 1) / fh), yaw = Math.atan2(f.nx, f.nz), dens = 0.08 + R() * 0.14;
    const col = grey(0.42 + R() * 0.15, 1);
    for (let fl = 2; fl < floors; fl++) {
      for (let s = bay * 0.5 + 0.6; s < f.len - 1; s += bay) {
        if (R() > dens || ac >= acMax) continue;
        const x = f.a[0] + f.tx * s + f.nx * 0.22, z = f.a[1] + f.tz * s + f.nz * 0.22;
        boxes.push([x, gy + fl * fh + 0.85, z, yaw, 0.66, 0.42, 0.5, col.map((c) => c * (0.8 + R() * 0.4))]);
        ac++;
      }
    }
  }
  counts.ac = ac;

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(), col = new THREE.Color();
  if (boxes.length) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.05 });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, boxes.length);
    boxes.forEach((e, i) => {
      q.setFromAxisAngle(up, e[3]);
      im.setMatrixAt(i, m4.compose(P.set(e[0], e[1], e[2]), q, S.set(e[4], e[5], e[6])));
      im.setColorAt(i, col.setRGB(e[7][0], e[7][1], e[7][2]));
    });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
    im.name = 'rooftop-boxes'; im.castShadow = false; im.receiveShadow = true;
    group.add(im);
  }
  if (dishes.length) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a88, roughness: 0.6, metalness: 0.2 });
    const g = new THREE.CylinderGeometry(1, 0.55, 0.22, 14, 1);
    const im = new THREE.InstancedMesh(g, mat, dishes.length);
    const tilt = new THREE.Quaternion();
    dishes.forEach((d, i) => {
      q.setFromAxisAngle(up, d[3]); tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.0); q.multiply(tilt);
      im.setMatrixAt(i, m4.compose(P.set(d[0], d[1], d[2]), q, S.set(d[4], 1, d[4])));
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.name = 'rooftop-dishes'; im.castShadow = false;
    group.add(im);
  }
  counts.boxes = boxes.length; counts.dishes = dishes.length; counts.beacons = beacons.length;
  o.scene.add(group);
  return { group, beacons, counts };
}
