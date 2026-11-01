// Jack-o'-lanterns: carved pumpkins with a flickering HDR face (bloom) and a halo, lit by the engine's NearestLights
// pool (a few real point lights on the lanterns nearest the view; the rest glow emissively). Running into one kicks it
// to pieces, landing on one stomps it (more candy, a bounce). Smashing uses the engine's fracture module: the pumpkin's
// hull is cut ahead of time by fracturePieces (seeded planes, two variants), each piece drawn with pieceGeometry
// (orange rind outside, pale flesh on the cut faces) and thrown as a real dynamic body on the shared DynamicsWorld,
// so the shards tumble and bounce over the terrain heightfield and gravestones; they sink away after a few seconds.
// A smashed lantern regrows after REGROW seconds.
import * as THREE from 'three';
import { Shapes, fracturePieces } from '@vibe/engine/physics';
import { pieceGeometry } from '@vibe/engine/render';
import { NearestLights } from '@vibe/engine/world';
import { pumpkinGeometry } from './world.js';

const R = 0.46;          // lantern radius (m)
const REGROW = 26;       // s until a smashed lantern is back
const SHARD_LIFE = 2.8;  // s before the shards sink away
const SLOTS = 4;         // smashes whose shards can be alive at once
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _qa = [0, 0, 0, 1];

/** Convex hull points of the lantern body (a squashed sphere sitting on y = 0, centred at y = 0.76 R). */
function hullPoints() {
  const pts = [];
  for (let j = 0; j <= 4; j++) {
    const v = j / 4, ph = v * Math.PI, y = Math.cos(ph) * R * 0.78 + 0.76 * R, rr = Math.sin(ph) * R * 0.97;
    const n = j === 0 || j === 4 ? 1 : 8;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + j * 0.4; pts.push(Math.cos(a) * rr, y, Math.sin(a) * rr); }
  }
  return pts;
}

/** Carved face (eyes, nose, a toothy grin) on the front (+Z) of the lantern's surface, as flat triangles. */
function faceGeometry() {
  const tris = [];
  const T = (a, b, c) => tris.push([a, b, c]);
  // eyes: triangles; nose: small triangle; mouth: a crescent with two teeth notches
  for (const s of [-1, 1]) T([s * 0.09, 0.045], [s * 0.2, 0.05], [s * 0.15, 0.14]);
  T([-0.035, -0.005], [0.035, -0.005], [0, 0.055]);
  const M = 9;
  for (let i = 0; i < M; i++) {
    const a0 = -0.95 + (i / M) * 1.9, a1 = -0.95 + ((i + 1) / M) * 1.9;
    const o0 = [Math.sin(a0) * 0.24, -0.04 - Math.cos(a0) * 0.12], o1 = [Math.sin(a1) * 0.24, -0.04 - Math.cos(a1) * 0.12];
    const tooth = i === 2 || i === 6 ? 0.045 : 0;
    const i0 = [Math.sin(a0) * 0.2, -0.06 - Math.cos(a0) * 0.05 - tooth], i1 = [Math.sin(a1) * 0.2, -0.06 - Math.cos(a1) * 0.05 - tooth];
    T(o0, i0, o1); T(i0, i1, o1);
  }
  const v = [];
  for (const t of tris) for (const [x, y] of t) {
    const yy = y * 1.05; // onto the squashed sphere's front: x^2 + (y / 0.78)^2 + z^2 = R^2
    const z = Math.sqrt(Math.max(0.01, R * R * 0.97 * 0.97 - x * x - (yy / 0.78) ** 2)) + 0.012;
    v.push(x, yy + 0.76 * R, z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

export class Lanterns {
  /** @param {object} o  scene, dyn (DynamicsWorld), spots ([x, z][]), heightAt, effects, glows, lights (pool size), low */
  constructor({ scene, dyn, spots, heightAt, lights = 5 }) {
    this.dyn = dyn; this.heightAt = heightAt;
    const n = this.n = spots.length;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n); this.yaw = new Float32Array(n);
    this.alive = new Uint8Array(n); this.regrow = new Float32Array(n); this.grow = new Float32Array(n); this.flick = new Float32Array(n);
    spots.forEach(([x, z], i) => {
      this.x[i] = x; this.z[i] = z; this.y[i] = heightAt(x, z) - 0.04;
      this.yaw[i] = Math.atan2(-x, 6 - z) + (Math.sin(i * 12.9) * 0.6); // roughly facing the spawn
      this.flick[i] = i * 1.37;
    });
    // intact lanterns: body (lit, instanced) + face (unlit HDR, instanced)
    this.bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: '#ff4a00', emissiveIntensity: 0.18 });
    this.body = new THREE.InstancedMesh(pumpkinGeometry(R, 18, 12, '#ff7518', '#3f5a22'), this.bodyMat, n);
    this.body.name = 'lanterns'; this.body.castShadow = true; this.body.receiveShadow = true;
    this.faceMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    this.face = new THREE.InstancedMesh(faceGeometry(), this.faceMat, n);
    this.face.name = 'lanternFaces';
    this.face.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    scene.add(this.body, this.face);
    // light pool: real point lights on the lanterns nearest the view
    this.lightPos = new Float32Array(n * 3);
    this.pool = new NearestLights({ count: lights, color: 0xff7a26, distance: 9, decay: 1.6, parent: scene, lead: 6, fade: 0.3, name: 'lanternLight' });
    // fracture pieces: two seeded variants of the same hull
    const hull = Shapes.convex(hullPoints());
    // convex() re-centres on the centre of mass: the hull's body sits at the lantern origin + this (piece offsets are
    // relative to it)
    this.hullC = [-hull.offset[0], -hull.offset[1], -hull.offset[2]];
    this.variants = [3, 17].map((seed) => {
      const pieces = fracturePieces(hull, { pieces: 7, seed, minFraction: 0.08 });
      return pieces.map((pc) => ({ piece: pc, geometry: pieceGeometry(pc, true) }));
    });
    this.rindMat = new THREE.MeshStandardMaterial({ color: '#ff6f12', roughness: 0.55, emissive: '#ff3a00', emissiveIntensity: 0.25 });
    this.fleshMat = new THREE.MeshStandardMaterial({ color: '#ffd27a', roughness: 0.8, emissive: '#ffb030', emissiveIntensity: 0.6 });
    this.slots = [];
    for (let s = 0; s < SLOTS; s++) {
      const v = this.variants[s % this.variants.length], meshes = [];
      for (const p of v) {
        const m = new THREE.Mesh(p.geometry, [this.rindMat, this.fleshMat]);
        m.visible = false; m.castShadow = true; m.frustumCulled = false;
        scene.add(m); meshes.push(m);
      }
      this.slots.push({ v, meshes, bodies: new Int32Array(v.length).fill(-1), t: 0, active: false });
    }
    this.nextSlot = 0;
    for (let i = 0; i < n; i++) this.alive[i] = 1;
    this._sync(true);
  }

  reset() {
    for (let i = 0; i < this.n; i++) { this.alive[i] = 1; this.regrow[i] = 0; this.grow[i] = 1; }
    for (const s of this.slots) this._clearSlot(s);
    this._sync(true);
  }

  _clearSlot(s) {
    for (let k = 0; k < s.bodies.length; k++) { if (s.bodies[k] >= 0) this.dyn.removeBody(s.bodies[k]); s.bodies[k] = -1; s.meshes[k].visible = false; }
    s.active = false;
  }

  /** Index of an intact lantern the kid (feet x, y, z, capsule radius r) touches, or -1. */
  touching(x, y, z, r) {
    const rr = (R + r) * (R + r);
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i] || this.grow[i] < 0.8) continue;
      const dx = x - this.x[i], dz = z - this.z[i];
      if (dx * dx + dz * dz < rr && y < this.y[i] + R * 1.7) return i;
    }
    return -1;
  }

  /** Smash lantern i, kicked along (kx, kz) (unit) with `power` (1 kick, 1.6 stomp). */
  smash(i, kx, kz, power = 1) {
    this.alive[i] = 0; this.regrow[i] = REGROW; this.grow[i] = 0;
    const s = this.slots[this.nextSlot]; this.nextSlot = (this.nextSlot + 1) % SLOTS;
    this._clearSlot(s);
    const x = this.x[i], y = this.y[i], z = this.z[i], yaw = this.yaw[i];
    _q.setFromEuler(_e.set(0, yaw, 0)); _qa[0] = _q.x; _qa[1] = _q.y; _qa[2] = _q.z; _qa[3] = _q.w;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (let k = 0; k < s.v.length; k++) {
      const pc = s.v[k].piece, o = pc.offset, h = this.hullC, ox0 = o[0] + h[0], oz0 = o[2] + h[2];
      const px = x + ox0 * c + oz0 * sn, py = y + o[1] + h[1], pz = z - ox0 * sn + oz0 * c;
      const id = this.dyn.addBody({ shape: pc.shape, position: [px, py, pz], quaternion: _qa, density: 350, friction: 0.7, restitution: 0.25, linearDamping: 0.15, angularDamping: 0.3 });
      if (id < 0) continue;
      // outward from the centre + the kick + up
      const ox = px - x, oy = py - (y + 0.76 * R), oz = pz - z, ol = Math.hypot(ox, oy, oz) || 1;
      const out = 2.2 * power;
      this.dyn.setVelocity(id, ox / ol * out + kx * 2.5 * power, 2.4 * power + oy / ol * out + Math.random(), oz / ol * out + kz * 2.5 * power,
        (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      s.bodies[k] = id; s.meshes[k].visible = true; s.meshes[k].scale.setScalar(1);
    }
    s.active = true; s.t = 0;
    this.lightPos[i * 3 + 1] = -1000; // out of the light pool's candidates (re-selected within 0.3 s)
    this._sync(false);
    return { x, y: y + 0.76 * R, z };
  }

  /** Every smashed lantern grows back now (the Witching Hour); onRelight(i) per lantern. */
  relightAll(onRelight) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.alive[i]) continue;
      this.alive[i] = 1; this.regrow[i] = 0; this.grow[i] = 0.001; any = true;
      if (onRelight) onRelight(i);
    }
    if (any) this._sync(false);
  }

  /** Fixed step: shard lifetimes (bodies removed at the end). */
  fixedUpdate(dt) {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t > SHARD_LIFE + 0.6) this._clearSlot(s);
    }
  }

  /** Per frame: regrowth, flicker, shard poses, light pool. Returns indices of lanterns that just regrew via cb. */
  update(dt, view, time, onRegrow) {
    let dirty = false;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) {
        this.regrow[i] -= dt;
        if (this.regrow[i] <= 0) { this.alive[i] = 1; this.grow[i] = 0.001; dirty = true; if (onRegrow) onRegrow(i); }
      } else if (this.grow[i] < 1) { this.grow[i] = Math.min(1, this.grow[i] + dt / 0.7); dirty = true; }
    }
    if (dirty) this._sync(false);
    // flicker the faces (instance colours, HDR)
    const C = this.face.instanceColor.array;
    for (let i = 0; i < this.n; i++) {
      const f = this.flick[i] + time;
      const k = 0.82 + 0.1 * Math.sin(f * 9.1) + 0.07 * Math.sin(f * 23.7 + 1.3) + 0.05 * Math.sin(f * 3.3);
      C[i * 3] = 5.2 * k; C[i * 3 + 1] = 2.3 * k; C[i * 3 + 2] = 0.45 * k;
    }
    this.face.instanceColor.needsUpdate = true;
    // shards: poses from the bodies, sinking + shrinking at the end
    for (const s of this.slots) {
      if (!s.active) continue;
      const sink = s.t > SHARD_LIFE ? Math.min(1, (s.t - SHARD_LIFE) / 0.6) : 0;
      for (let k = 0; k < s.bodies.length; k++) {
        const id = s.bodies[k], m = s.meshes[k];
        if (id < 0) continue;
        this.dyn.getPose(id, m.position, m.quaternion);
        if (sink > 0) { m.position.y -= sink * 0.3; m.scale.setScalar(Math.max(0.001, 1 - sink)); }
      }
    }
    this.pool.update(dt, view, 7.5);
  }

  _sync(lightsToo) {
    const P = this.lightPos;
    for (let i = 0; i < this.n; i++) {
      const g = this.alive[i] ? this.grow[i] : 0;
      const sc = g < 1 ? Math.max(0.001, g * (1 + 0.25 * Math.sin(g * Math.PI))) : 1; // a little overshoot as it regrows
      _q.setFromEuler(_e.set(0, this.yaw[i], 0));
      _m.compose(_p.set(this.x[i], this.y[i], this.z[i]), _q, _s.set(sc, sc, sc));
      this.body.setMatrixAt(i, _m); this.face.setMatrixAt(i, _m);
      if (this.alive[i] || lightsToo) { P[i * 3] = this.x[i]; P[i * 3 + 1] = this.alive[i] ? this.y[i] + 0.5 : -1000; P[i * 3 + 2] = this.z[i]; }
    }
    this.body.instanceMatrix.needsUpdate = true; this.face.instanceMatrix.needsUpdate = true;
    if (lightsToo) { this.body.computeBoundingSphere(); this.face.computeBoundingSphere(); this.pool.setPositions(P); }
  }

  /** Halo glows for the intact lanterns into `glows` from slot `base`; returns slots used. */
  glow(glows, base, time) {
    let n = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      const g = this.grow[i], f = this.flick[i] + time, k = (0.85 + 0.15 * Math.sin(f * 7.3)) * g;
      glows.set(base + n++, this.x[i], this.y[i] + 0.42, this.z[i], 2.6, 0.5 * k, 0.2 * k, 0.04 * k);
    }
    return n;
  }
}
