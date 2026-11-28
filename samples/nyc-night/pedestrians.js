// People on the sidewalks: clones of the people GLBs (samples/public/people, baked from the Microsoft Rocketbox avatars
// by tools/bake-people.mjs: textured, clothed adults, one or two draw calls each), finished by the engine's
// world/People.js (cloth colours, height and build per person, the wrap / rim light a figure needs at night, culling
// bounds) with soft contact shadows under their feet (one draw call for everyone). Each has its own AnimationMixer
// (walk, a few idle; the walk plays at the speed its cycle was made for, so feet do not slide), walks the sidewalk
// lines of the named streets around the walker and respawns ahead of / around the player when they fall more than
// `keep` metres behind. They keep to the sidewalks (a block's end turns them round; they never cross a road), and they
// step clear of the player's car when it comes onto the sidewalk at them: aside, away from its path, within the
// sidewalk; one it would still reach steps out of the scene (respawned out of the way). Nobody is ever shown being
// hit, and nothing reacts to an impact. The low-poly CC0 Quaternius characters (samples/public/nyc/models) still work
// as sources: their flat materials are merged into one vertex-coloured mesh with per-person coat / trouser colours and
// smooth normals; the textured one is tinted per clone. Seeded, so bench poses reproduce.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { roadStyle, finishPerson, personVariety, ContactShadows } from '@vibe/engine/world';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The people GLBs (samples/public/people/<id>.glb), men and women alternating: load the first n for a smaller crowd. */
export const PEOPLE = ['man-grey-jacket', 'woman-leather-jacket', 'man-blazer', 'woman-dark-jacket', 'man-hooded-jacket', 'woman-blazer', 'man-denim-jacket', 'woman-beige-jacket'];

const clip = (anims, key) => anims.find((a) => a.name.toLowerCase().endsWith(key)) || anims.find((a) => a.name.toLowerCase().includes(key)) || null;
const COATS = [0x2a3446, 0x3d342c, 0x55282c, 0x26392f, 0x34383f, 0x6a5a48, 0x1c1f25, 0x7a3a2a, 0x3c4a5e, 0x8a8478];
const TROUSERS = [0x1c1e24, 0x2b3040, 0x38302a, 0x242838, 0x41454d];

/**
 * A clone of a glTF character as a person `height` metres tall with its feet at 0, facing -Z inside a holder group.
 * A baked person (tools/bake-people.mjs) takes its clothes, height and build from `look` (world personVariety); a
 * low-poly one its coat / trouser colours or tint from the generator R.
 * @returns {{ holder: THREE.Group, model: THREE.Object3D, scale: number }}  scale: the fit over the file's own height
 */
export function clonePerson(src, height, look, R) {
  const model = SkeletonUtils.clone(src.gltf.scene), baked = src.gltf.scene.userData.person || null;
  let fit;
  if (baked) fit = finishPerson(model, { height: (height || baked.height) * look.height, build: look.build, clothes: look.clothes });
  else {
    const coat = COATS[(R() * COATS.length) | 0], trousers = TROUSERS[(R() * TROUSERS.length) | 0];
    const tint = src.textured ? new THREE.Color().setHSL(0.05 + R() * 0.08, 0.12, 0.3 + R() * 0.2) : undefined;
    fit = finishPerson(model, { height: height * look.height, recolour: { Shirt: coat, Suit: coat, Pants: trousers, Socks: 0x1a1a1a }, tint });
  }
  const holder = new THREE.Group(), view = new THREE.Group();
  view.rotation.y = Math.PI; view.add(model); holder.add(view); // the GLBs face +Z, the holder's forward is -Z
  return { holder, model, scale: baked ? fit.height / baked.height : 1 };
}

export class Pedestrians {
  /**
   * o: { scene, world, sources ([{ gltf, height, textured }]: loaded glTFs; a baked person needs only `gltf`), count,
   * center (Vector3-like), radius (m of sidewalk lines kept), keep (m behind before a respawn), seed, postfx (track
   * velocity), shadowOpacity (the contact shadows, 0.8) }
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
          // n: away from the road; lo / hi: how far a person may step off the line toward the kerb / the wall
          segs.push({ ax: a[0] + ox + tx * 4, az: a[1] + oz + tz * 4, tx, tz, len: L - 8, nx: -tz * side, nz: tx * side,
            lo: -Math.max(0, st.sidewalk * 0.55 - 0.45), hi: Math.max(0, st.sidewalk * 0.45 - 0.35) });
        }
      }
    }
    const n = segs.length ? o.count : 0;
    // sources: [{ gltf, height, textured }]: baked people (height optional: the file's) or low-poly characters; the
    // legacy man / woman pair still works
    const srcs = o.sources || [o.man && { gltf: o.man, height: 1.76 }, o.woman && { gltf: o.woman, height: 1.66, textured: true }].filter(Boolean);
    this.shadows = n && srcs.length ? new ContactShadows({ parent: this.group, max: n, opacity: o.shadowOpacity ?? 0.8 }) : null;
    this._ground = (x, z) => this.world.getGroundHeight(x, z);
    for (let i = 0; i < n && srcs.length; i++) {
      const S = srcs[i % srcs.length], src = S.gltf, R = this.R;
      const { holder, model, scale } = clonePerson(S, S.height, personVariety(R), R);
      this.group.add(holder);
      const mixer = new THREE.AnimationMixer(model);
      const walk = clip(src.animations, '_walk') || clip(src.animations, 'walk') || clip(src.animations, 'walking'), idle = clip(src.animations, '|idle') || clip(src.animations, '_idle') || clip(src.animations, 'idle');
      const standing = R() < 0.18 && idle;
      const act = mixer.clipAction(standing ? idle : walk || idle);
      act.play(); act.time = R() * 2;
      // the ground speed the walk cycle covers at this person's size (baked people carry it; 1.4 / 1.25 m/s for the
      // low-poly man / woman): the person walks at 0.85 to 1.2 of it and the cycle is played at that rate
      const cycle = ((walk && walk.userData && walk.userData.speed) || (S.textured ? 1.25 : 1.4)) * scale, pace = 0.85 + R() * 0.35;
      const speed = standing ? 0 : cycle * pace;
      act.timeScale = standing ? 1 : pace;
      const p = { holder, mixer, speed, seg: 0, s: 0, dir: 1, off: 0 };
      this.people.push(p);
      if (this.shadows) this.shadows.add(holder, model);
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
      p.seg = i; p.s = s; p.dir = R() < 0.5 ? 1 : -1; p.off = 0;
      return;
    }
  }

  /** Spread everyone around (x, z) (load, respawn key, bench). */
  scatter(x, z, seed) {
    if (seed !== undefined) this.R = rng(seed);
    for (const p of this.people) { this._place(p, x, z, 4, 70); p.mixer.setTime(this.R() * 2); }
    this.update(0, x, z);
  }

  /**
   * Walk everyone on, around (x, z). car: the player's car or null, { x, z, fx, fz (forward), hl, hw (half length /
   * width), speed (m/s) }: who stands in its path steps aside (see the header).
   */
  update(dt, x, z, car = null) {
    const S = this.segs;
    if (!S.length) return;
    for (const p of this.people) {
      let g = S[p.seg];
      if (car && dt > 0) { this._clear(p, g, car, dt); g = S[p.seg]; }
      p.s += p.speed * p.dir * dt;
      if (p.s < 0 || p.s > g.len) { // end of the block: turn round (a crossing is not modelled)
        p.dir = -p.dir; p.s = Math.max(0, Math.min(g.len, p.s));
      }
      const px = g.ax + g.tx * p.s, pz = g.az + g.tz * p.s;
      if ((px - x) ** 2 + (pz - z) ** 2 > this.keep * this.keep) { this._place(p, x, z, 30, 70); g = S[p.seg]; }
      const qx = g.ax + g.tx * p.s + g.nx * p.off, qz = g.az + g.tz * p.s + g.nz * p.off;
      const h = p.holder;
      h.position.set(qx, this.world.getGroundHeight(qx, qz), qz);
      h.rotation.y = Math.atan2(-g.tx * p.dir, -g.tz * p.dir);
      if (dt > 0) p.mixer.update(dt);
    }
    if (this.shadows) this.shadows.update(this._ground);
  }

  /** Step person p (on segment g) out of the car's path: aside within the sidewalk, or out of the scene if it would still reach them. */
  _clear(p, g, car, dt) {
    const px = g.ax + g.tx * p.s + g.nx * p.off, pz = g.az + g.tz * p.s + g.nz * p.off;
    const rx = px - car.x, rz = pz - car.z, along = rx * car.fx + rz * car.fz, lat = rx * -car.fz + rz * car.fx;
    const ahead = car.hl + 1.5 + car.speed * 1.2;
    let goal = 0;
    if (car.speed > 0.5 && along > -car.hl - 1 && along < ahead && Math.abs(lat) < car.hw + 1.4) {
      // away from the car's centre line: the sidewalk direction (n) that grows |lat|
      const away = (lat >= 0 ? 1 : -1) * (g.nx * -car.fz + g.nz * car.fx);
      goal = away >= 0 ? g.hi : g.lo;
    }
    p.off += Math.max(-3.5 * dt, Math.min(3.5 * dt, goal - p.off)) * (goal ? 1 : 0.25); // quick aside, slowly back
    if (Math.abs(along) < car.hl + 0.5 && Math.abs(lat) < car.hw + 0.45) this._place(p, car.x, car.z, 40, 70); // it would reach them
  }
}
