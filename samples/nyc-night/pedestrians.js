// People on the sidewalks: clones of the CC0 Quaternius "Man" / "Animated Woman" (samples/public/nyc/models), each with
// its own AnimationMixer (walk, a few idle), walking the sidewalk lines of the named streets around the walker and
// respawning ahead of / around the walker when they fall more than `keep` metres behind. The Man's six flat materials
// are baked into one vertex-coloured material per clone (one draw instead of six, and per-person coat / trouser
// colours); the Woman is textured and keeps her material (tinted per clone). Seeded, so bench poses reproduce.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roadStyle } from '@vibe/engine/world';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Bake a multi-material (skinned) mesh into one MeshStandardMaterial with vertex colours. `recolour` maps a material
 * name (Shirt, Pants, ...) to a colour (hex / THREE.Color); others keep theirs. Clones the geometry (per person).
 */
export function bakeVertexColours(mesh, recolour = {}) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const g = mesh.geometry.clone();
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : n, materialIndex: 0 }];
  const c = new THREE.Color();
  for (const gr of groups) {
    const m = mats[gr.materialIndex] || mats[0];
    if (recolour[m.name] !== undefined) c.set(recolour[m.name]); else c.copy(m.color || c.set(0xffffff));
    for (let i = gr.start; i < gr.start + gr.count; i++) {
      const v = g.index ? g.index.getX(i) : i;
      col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.clearGroups();
  mesh.geometry = g;
  mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, name: 'baked' });
  return mesh;
}

/**
 * GLTFLoader splits a multi-material skinned mesh into sibling SkinnedMeshes (one per primitive) that share one
 * skeleton: merge siblings with untextured materials into ONE SkinnedMesh with vertex colours (recoloured by material
 * name), so a person is one draw call.
 */
function mergeSkinnedParts(root, recolour) {
  const groups = new Map();
  root.traverse((o) => { if (o.isSkinnedMesh && !o.material.map) { const k = o.parent; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); } });
  const c = new THREE.Color();
  for (const [parent, parts] of groups) {
    // (SkeletonUtils.clone gives each part its own Skeleton object over the same bones: compare the bones)
    const sameBones = (p) => p.skeleton.bones.length === parts[0].skeleton.bones.length && p.skeleton.bones.every((b, i) => b === parts[0].skeleton.bones[i]);
    if (parts.length < 2 || !parts.every(sameBones)) continue;
    const geos = parts.map((p) => {
      const g = p.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      const name = p.material.name;
      if (recolour[name] !== undefined) c.set(recolour[name]); else c.copy(p.material.color);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const first = parts[0];
    const mesh = new THREE.SkinnedMesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, name: 'baked' }));
    mesh.name = first.name; mesh.position.copy(first.position); mesh.quaternion.copy(first.quaternion); mesh.scale.copy(first.scale);
    mesh.bind(first.skeleton, first.bindMatrix);
    for (const p of parts) parent.remove(p);
    parent.add(mesh);
  }
}

/** A clone of a glTF character, normalised to `height` with its feet at 0, facing +Z, inside a wrapper group. */
export function cloneCharacter(gltf, height, recolour, tint) {
  const model = SkeletonUtils.clone(gltf.scene);
  mergeSkinnedParts(model, recolour || {});
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    if (Array.isArray(o.material) && o.material.length > 1) bakeVertexColours(o, recolour || {});
    else if (o.material.name !== 'baked') { o.material = (Array.isArray(o.material) ? o.material[0] : o.material).clone(); if (tint) o.material.color.multiply(tint); }
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y, s = h > 1e-6 ? height / h : 1;
  const fit = new THREE.Group(); fit.scale.setScalar(s);
  fit.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  fit.add(model);
  return { fit, model };
}

const clip = (anims, key) => anims.find((a) => a.name.toLowerCase().endsWith(key)) || anims.find((a) => a.name.toLowerCase().includes(key)) || null;
const COATS = [0x1e2430, 0x2b2622, 0x3a1f22, 0x1d2b25, 0x24272c, 0x4a4036, 0x15171b, 0x5a2a20, 0x2c3440];
const TROUSERS = [0x16171b, 0x22252d, 0x2a2420, 0x1b1d26, 0x303339];

export class Pedestrians {
  /**
   * o: { scene, world, man, woman (loaded glTFs, either may be null), count, center (Vector3-like), radius (m of
   * sidewalk lines kept), keep (m behind before a respawn), seed, postfx (track velocity) }
   */
  constructor(o) {
    this.R = rng(o.seed ?? 4711);
    this.world = o.world; this.keep = o.keep ?? 85;
    this.people = [];
    this.group = new THREE.Group(); this.group.name = 'pedestrians';
    o.scene.add(this.group);
    // sidewalk lines: both sides of every named street with a sidewalk, within `radius` of the centre
    const segs = this.segs = [];
    const C = o.center, R2 = (o.radius ?? 450) ** 2;
    for (const r of o.world.data.roads) {
      if (!r || !r.p || r.p.length < 2 || r.b) continue;
      const st = roadStyle(r);
      if (st.minor || !st.sidewalk) continue;
      const off = st.hw + st.sidewalk * 0.55;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 8 || ((a[0] + b[0]) / 2 - C.x) ** 2 + ((a[1] + b[1]) / 2 - C.z) ** 2 > R2) continue;
        const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
        for (const side of [-1, 1]) {
          const ox = -tz * off * side, oz = tx * off * side;
          // trim the ends so people turn before the crosswalks rather than walking into the junction
          segs.push({ ax: a[0] + ox + tx * 4, az: a[1] + oz + tz * 4, tx, tz, len: L - 8 });
        }
      }
    }
    const n = segs.length ? o.count : 0;
    // sources: [{ gltf, height, textured }] (people in long trousers and coats); legacy man / woman still work
    const srcs = o.sources || [o.man && { gltf: o.man, height: 1.76 }, o.woman && { gltf: o.woman, height: 1.66, textured: true }].filter(Boolean);
    for (let i = 0; i < n && srcs.length; i++) {
      const S = srcs[i % srcs.length], src = S.gltf, woman = !!S.textured;
      const R = this.R;
      const coat = COATS[(R() * COATS.length) | 0], trousers = TROUSERS[(R() * TROUSERS.length) | 0];
      const recolour = { Shirt: coat, Suit: coat, Pants: trousers, Socks: 0x1a1a1a };
      const tint = woman ? new THREE.Color().setHSL(0.05 + R() * 0.08, 0.12, 0.3 + R() * 0.2) : null;
      const { fit } = cloneCharacter(src, S.height + (R() - 0.5) * 0.1, recolour, tint);
      const holder = new THREE.Group(); const view = new THREE.Group(); view.rotation.y = Math.PI; view.add(fit); holder.add(view);
      this.group.add(holder);
      const mixer = new THREE.AnimationMixer(fit);
      const walk = clip(src.animations, '_walk') || clip(src.animations, 'walk') || clip(src.animations, 'walking'), idle = clip(src.animations, '|idle') || clip(src.animations, '_idle') || clip(src.animations, 'idle');
      const standing = R() < 0.18 && idle;
      const act = mixer.clipAction(standing ? idle : walk || idle);
      act.play(); act.time = R() * 2;
      const speed = standing ? 0 : 1.15 + R() * 0.45;
      act.timeScale = standing ? 1 : speed / (woman ? 1.25 : 1.4);
      const p = { holder, mixer, speed, seg: 0, s: 0, dir: 1 };
      this.people.push(p);
      if (o.postfx) holder.traverse((m) => { if (m.isMesh) o.postfx.track(m); });
    }
    this._t = 0;
  }

  /** Put person p on a random sidewalk point between dMin and dMax metres from (x, z) (any point if none). */
  _place(p, x, z, dMin, dMax) {
    const R = this.R, S = this.segs;
    for (let k = 0; k < 40; k++) {
      const i = (R() * S.length) | 0, g = S[i], s = R() * g.len;
      const px = g.ax + g.tx * s, pz = g.az + g.tz * s, d = Math.hypot(px - x, pz - z);
      if (k < 39 && (d < dMin || d > dMax)) continue;
      p.seg = i; p.s = s; p.dir = R() < 0.5 ? 1 : -1;
      return;
    }
  }

  /** Spread everyone around (x, z) (load, respawn key, bench). */
  scatter(x, z, seed) {
    if (seed !== undefined) this.R = rng(seed);
    for (const p of this.people) { this._place(p, x, z, 4, 70); p.mixer.setTime(this.R() * 2); }
    this.update(0, x, z);
  }

  update(dt, x, z) {
    const S = this.segs;
    if (!S.length) return;
    for (const p of this.people) {
      let g = S[p.seg];
      p.s += p.speed * p.dir * dt;
      if (p.s < 0 || p.s > g.len) { // end of the block: turn round (a crossing is not modelled)
        p.dir = -p.dir; p.s = Math.max(0, Math.min(g.len, p.s));
      }
      const px = g.ax + g.tx * p.s, pz = g.az + g.tz * p.s;
      if ((px - x) ** 2 + (pz - z) ** 2 > this.keep * this.keep) { this._place(p, x, z, 30, 70); g = S[p.seg]; }
      const qx = g.ax + g.tx * p.s, qz = g.az + g.tz * p.s;
      const h = p.holder;
      h.position.set(qx, this.world.getGroundHeight(qx, qz), qz);
      h.rotation.y = Math.atan2(-g.tx * p.dir, -g.tz * p.dir);
      if (dt > 0) p.mixer.update(dt);
    }
  }
}
