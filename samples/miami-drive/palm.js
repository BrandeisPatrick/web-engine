// Detailed coconut palms for the near field (the demo's signature silhouette). Built in code, no asset file:
//   - trunk: a curved, tapered tube (14 sides x 36 rings) with ring scars (a shader band pattern on colour and
//     normal along the trunk) and leaf-base "boots" (short wedges) under the crown; a green crown shaft
//   - fronds: 15-20 per crown, each a curved rachis (a thin ribbon) with ~26 pairs of drooping leaflets (two-triangle
//     lanceolate blades, geometry, so there is no alpha-tested overdraw), arching up and out then drooping
//   - 5-7 dead brown fronds hanging under the crown, a coconut cluster (8-11 nuts)
//   - two crown variants (frond count, length, droop) plus per-instance scale for fullness variation; height, lean, yaw
//   - wind: a sway that travels along each frond from base to tip (aSway = (t along the frond, phase)), a slight
//     trunk sway, all in the vertex shader
// Instanced per 60 m chunk; chunks are drawn only within `near` m of the camera and each instance dithers in over
// [near - 4, near] while the cheap palms (world.js coconutPalms) dither out over the same band (shared uniforms).
//
//   const np = buildNearPalms(instances, { near: 48 });  scene.add(np.group);  per frame: np.update(camera, dt)
//   instances: [{ x, y, z, h, yaw, lean, leanDir }]   (y = ground, h = trunk height)
//   np.fade = { uViewPos, uNear }   (the cheap palms read the same uniforms)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The trunk's centre line for a unit-height palm: a gentle S-free bow (x) that the instance scales by its height. */
const BOW = 0.07;
const trunkAt = (t) => new THREE.Vector3(Math.sin(t * 1.3) * BOW * t, t, 0);

/** Unit-height trunk (radius in metres for a 10 m palm, scaled with the instance's horizontal scale). */
function trunkGeometry() {
  const R = 14, H = 36, pos = [], nrm = [], uv = [], idx = [];
  for (let j = 0; j <= H; j++) {
    const t = j / H, c = trunkAt(t);
    const rad = (0.21 - 0.07 * t + 0.08 * Math.exp(-t * 18)) / 10; // flared base, taper (per metre of height)
    for (let i = 0; i <= R; i++) {
      const a = (i / R) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      pos.push(c.x + cx * rad, c.y, c.z + cz * rad); nrm.push(cx, 0, cz); uv.push(i / R, t);
    }
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < R; i++) { const a = j * (R + 1) + i, b = a + R + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/** A crown in metres around (0, 0, 0) = the trunk tip: shaft, boots, green fronds, dead fronds, coconuts. Vertex colour
 *  carries the tint, aSway (t along the frond, phase) drives the wind. */
function crownGeometry(seed, { fronds = 18, len = 4.3, droop = 1.0, dead = 6, nuts = 9 } = {}) {
  const r = rnd(seed), parts = [];
  const pushPart = (pos, idx, col, sway) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 2));
    g.setIndex(idx); g.computeVertexNormals(); parts.push(g);
  };
  // the crown shaft and the boots (old leaf bases) just under it
  {
    const pos = [], idx = [], col = [], sw = [], S = 10;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= S; i++) {
      const a = (i / S) * Math.PI * 2, y = -0.9 + j * 0.25, rad = 0.17 + 0.03 * Math.sin(j * 1.3);
      pos.push(Math.cos(a) * rad, y, Math.sin(a) * rad); col.push(0.32, 0.36, 0.2); sw.push(0, 0);
    }
    for (let j = 0; j < 4; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + S + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    pushPart(pos, idx, col, sw);
    const bp = [], bi = [], bc = [], bs = [];
    for (let k = 0; k < 14; k++) {
      const a = r() * Math.PI * 2, y = -1.5 + r() * 0.7, ca = Math.cos(a), sa = Math.sin(a), w = 0.09 + r() * 0.05, l = 0.35 + r() * 0.25;
      const b0 = bp.length / 3;
      bp.push(ca * 0.16 - sa * w, y, sa * 0.16 + ca * w, ca * 0.16 + sa * w, y, sa * 0.16 - ca * w, ca * (0.2 + l * 0.6), y + l, sa * (0.2 + l * 0.6));
      bi.push(b0, b0 + 1, b0 + 2);
      for (let q = 0; q < 3; q++) { bc.push(0.36, 0.28, 0.19); bs.push(0, 0); }
    }
    pushPart(bp, bi, bc, bs);
  }
  // fronds: a curved rachis with leaflet pairs; dead ones hang down, brown
  const frond = (a, l, rise, dr, green, ph) => {
    const pos = [], idx = [], col = [], sw = [];
    const N = 26, ca = Math.cos(a), sa = Math.sin(a);
    const P = (t) => { const d = l * t; return new THREE.Vector3(ca * d, rise * t - dr * t * t * l * 0.45, sa * d); };
    const tint = green ? [0.24 + r() * 0.06, 0.33 + r() * 0.06, 0.13] : [0.38, 0.27, 0.15];
    // rachis: a thin ribbon
    for (let s = 0; s <= 10; s++) {
      const t = s / 10, c = P(t), w = 0.03 * (1 - t) + 0.008;
      pos.push(c.x - sa * w, c.y, c.z + ca * w, c.x + sa * w, c.y, c.z - ca * w);
      for (let q = 0; q < 2; q++) { col.push(tint[0] * 1.15, tint[1] * 1.05, tint[2] * 0.95); sw.push(t, ph); }
      if (s < 10) { const b = s * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    // leaflets: N pairs, longest at mid-frond, drooping and angled forward
    for (let k = 1; k <= N; k++) {
      const t = 0.08 + 0.9 * (k / N), c = P(t);
      const ll = (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.05))) * (green ? 0.9 : 0.75) * (0.9 + r() * 0.2);
      const fwd = new THREE.Vector3(ca, 0, sa);
      for (const side of [-1, 1]) {
        if (!green && r() < 0.25) continue; // ragged dead fronds
        const sd = new THREE.Vector3(-sa * side, 0, ca * side);
        const tip = c.clone().addScaledVector(sd, ll * 0.85).addScaledVector(fwd, ll * 0.35); tip.y -= ll * (green ? 0.55 : 0.8) * (0.7 + 0.6 * t);
        const midp = c.clone().lerp(tip, 0.45); midp.y += 0.03;
        const wv = 0.075 * ll / 0.9;   // broad enough to hold as a shape at 10-40 m (thin blades alias)
        const b = pos.length / 3;
        pos.push(c.x, c.y, c.z, midp.x + fwd.x * wv, midp.y, midp.z + fwd.z * wv, midp.x - fwd.x * wv, midp.y, midp.z - fwd.z * wv, tip.x, tip.y, tip.z);
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        const v = 0.85 + r() * 0.3;
        for (let q = 0; q < 4; q++) { col.push(tint[0] * v, tint[1] * v, tint[2] * v); sw.push(t + (q === 3 ? 0.06 : 0), ph); }
      }
    }
    pushPart(pos, idx, col, sw);
  };
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + (r() - 0.5) * 0.3, l = len * (0.8 + r() * 0.35);
    frond(a, l, 0.9 + r() * 0.8, droop * (0.8 + r() * 0.6), true, r() * 6.28);
  }
  for (let f = 0; f < dead; f++) {
    const a = r() * Math.PI * 2, l = len * (0.7 + r() * 0.3);
    frond(a, l, -1.2 - r() * 0.8, 0.4, false, r() * 6.28);
  }
  // coconuts: a cluster under the crown
  for (let k = 0; k < nuts; k++) {
    const g = new THREE.IcosahedronGeometry(0.11 + r() * 0.03, 1);
    g.scale(1, 1.15, 1);
    const a = r() * Math.PI * 2, rad = 0.2 + r() * 0.12;
    g.translate(Math.cos(a) * rad, -0.55 - r() * 0.35, Math.sin(a) * rad);
    const n = g.attributes.position.count, col = [], sw = [];
    const ripe = r() < 0.4;
    for (let q = 0; q < n; q++) { if (ripe) col.push(0.42, 0.3, 0.14); else col.push(0.36, 0.4, 0.16); sw.push(0, 0); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 2));
    g.deleteAttribute('uv');
    parts.push(g.index ? g : g.toNonIndexed());
  }
  const norm = parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!/^(position|normal|color|aSway)$/.test(k)) n.deleteAttribute(k); if (!n.attributes.normal) n.computeVertexNormals(); return n; });
  return mergeGeometries(norm);
}

/** Shared material patch: wind (travelling along aSway.x), trunk ring scars, and the near / far dither. */
function patch(mat, U, kind) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uViewPos: U.uViewPos, uNear: U.uNear });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uTime; varying vec3 vPW; varying float vTy;
${kind === 'crown' ? 'attribute vec2 aSway;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vTy = position.y;
#ifdef USE_INSTANCING
  float iph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
#else
  float iph = 0.0;
#endif
${kind === 'crown'
    ? `  { float t = aSway.x; float w = sin(uTime * 1.9 + aSway.y + iph - t * 3.2) * 0.5 + sin(uTime * 3.1 + aSway.y * 1.7 - t * 5.0) * 0.18;
    transformed.y += w * 0.22 * t * t; transformed.xz += vec2(cos(aSway.y), sin(aSway.y)) * w * 0.12 * t * t;
    transformed.x += sin(uTime * 0.7 + iph) * 0.06; }`
    : `  transformed.x += sin(uTime * 0.7 + iph) * 0.006 * position.y * position.y;`}
#ifdef USE_INSTANCING
vPW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uViewPos; uniform float uNear; varying vec3 vPW; varying float vTy;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  { float k = smoothstep(uNear - 4.0, uNear, distance(vPW, uViewPos));
    float bayer = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + 0.125 * mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0) + 0.0625);
    if (k > bayer) discard; }`)
      .replace('#include <color_fragment>', kind === 'trunk' ? `#include <color_fragment>
  { float ring = abs(fract(vTy * 85.0 + sin(vTy * 31.0) * 0.15) - 0.5);   // ring scars every ~12 cm of a 10 m trunk
    diffuseColor.rgb *= 0.78 + 0.32 * smoothstep(0.05, 0.22, ring);
    diffuseColor.rgb *= mix(0.85, 1.12, smoothstep(0.0, 0.15, vTy)) * mix(1.0, 0.8, smoothstep(0.85, 1.0, vTy)); }` : '#include <color_fragment>')
      .replace('#include <normal_fragment_maps>', kind === 'trunk' ? `#include <normal_fragment_maps>
  { float rr = fract(vTy * 85.0 + sin(vTy * 31.0) * 0.15); normal = normalize(normal + vec3(0.0, (smoothstep(0.0, 0.2, rr) - smoothstep(0.2, 0.4, rr)) * 0.6, 0.0)); }` : '#include <normal_fragment_maps>');
  };
  mat.customProgramCacheKey = () => `near-palm-${kind}`;
  return mat;
}

/**
 * @param {Array<{x:number,y:number,z:number,h:number,yaw:number,lean?:number,leanDir?:number}>} instances
 * @param {{ near?: number, seed?: number }} [o]
 */
export function buildNearPalms(instances, o = {}) {
  const near = o.near ?? 48;
  const F = o.fade || {};
  const U = { uTime: F.uTime || { value: 0 }, uViewPos: F.uViewPos || { value: new THREE.Vector3() }, uNear: F.uNear || { value: near } };
  U.uNear.value = near;
  const trunkG = trunkGeometry();
  const crowns = [
    crownGeometry(11, { fronds: 18, len: 4.4, droop: 1.0, dead: 6, nuts: 10 }),
    crownGeometry(23, { fronds: 15, len: 4.0, droop: 1.25, dead: 7, nuts: 8 }),
  ];
  const trunkMat = patch(new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.95, name: 'nearPalmTrunk' }), U, 'trunk');
  const crownMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, name: 'nearPalmCrown' }), U, 'crown');
  const group = new THREE.Group(); group.name = 'near-palms';
  const CH = 60, chunks = new Map();
  for (const p of instances) { const k = Math.floor(p.z / CH) + ':' + Math.floor(p.x / CH); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(p); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ql = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const list = [];
  let tris = 0;
  const count = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  for (const pts of chunks.values()) {
    const cg = new THREE.Group(); cg.name = 'near-palms-chunk'; cg.visible = false;
    const ctr = new THREE.Vector3(); for (const p of pts) ctr.add(v.set(p.x, p.y, p.z)); ctr.multiplyScalar(1 / pts.length);
    cg.userData.ctr = ctr;
    const tM = new THREE.InstancedMesh(trunkG, trunkMat, pts.length);
    const byVar = [[], []];
    pts.forEach((p, i) => {
      const sx = p.h / 10 * (0.9 + 0.2 * ((i * 7) % 5) / 4);
      q.setFromAxisAngle(v.set(0, 1, 0), p.yaw);
      ql.setFromAxisAngle(v.set(Math.cos(p.leanDir || 0), 0, Math.sin(p.leanDir || 0)), p.lean || 0);
      const rot = ql.clone().multiply(q);
      m4.compose(v.set(p.x, p.y - 0.05, p.z), rot, s.set(sx * 10, p.h, sx * 10)); tM.setMatrixAt(i, m4);
      // the crown at the trunk tip (the bow scaled by the height, then leaned and yawed)
      const tip = trunkAt(1).multiply(s.set(p.h, p.h, p.h)).applyQuaternion(rot);
      byVar[i % 2].push({ x: p.x + tip.x, y: p.y + tip.y - 0.05, z: p.z + tip.z, rot: rot.clone(), sc: 0.85 + sx * 0.25 });
    });
    tM.castShadow = true; tM.receiveShadow = true; tM.computeBoundingSphere(); cg.add(tM); tris += pts.length * count(trunkG);
    byVar.forEach((L, vI) => {
      if (!L.length) return;
      const cM = new THREE.InstancedMesh(crowns[vI], crownMat, L.length);
      L.forEach((c, i) => { m4.compose(v.set(c.x, c.y, c.z), c.rot, s.set(c.sc, c.sc, c.sc)); cM.setMatrixAt(i, m4); });
      cM.castShadow = true; cM.receiveShadow = true; cM.computeBoundingSphere(); cg.add(cM); tris += L.length * count(crowns[vI]);
    });
    group.add(cg); list.push(cg);
  }
  const _c = new THREE.Vector3();
  return {
    group, fade: U,
    stats: { palms: instances.length, chunks: list.length, crownTris: crowns.map(count), trunkTris: count(trunkG), totalTris: Math.round(tris) },
    update(camera, dt = 0) {
      U.uTime.value += dt; U.uViewPos.value.copy(camera.position);
      for (const cg of list) { _c.copy(cg.userData.ctr); cg.visible = _c.distanceTo(camera.position) < near + 30; } // (chunks are 60 m)
    },
  };
}
