// Camera rig base + shared camera collision utilities.
//
//   class MyRig extends CameraRig { update(dt) { ... this.camera.position ... } }
//   const rig = new MyRig(camera, { getGroundHeight, queryColliders })   // game-world style queries
//   const rig = new MyRig(camera, { physics: engine.physics })            // or a PhysicsWorld-like object
//   const rig = new MyRig(camera, { physics, active: false })             // starts inactive (rig switchers)
//   rig.setTarget(object3d, () => state); rig.snap(); rig.update(dt);
//
// CameraCollision answers "how far can the camera go along pivot -> desired before it hits something":
// padded slab tests against collider AABBs near the target ({minX..maxZ, kind}), sampled terrain, plus
// near-plane push-out and ground clamp. Two world-specific rules are opt-in: tree-canopy ellipsoids inferred
// from colliders (canopyFromCollider, e.g. treeCanopy for the Roadster's kind-2 trunks) and "thin" kinds that
// only block near the camera (thinKinds, e.g. poles). ChaseRig turns both on with the Roadster rules unless
// given canopyFromCollider: null / thinKinds: [] (or its own).
// With only a `raycast(origin, dir, maxDist) -> {distance}|null` (no queryColliders) it falls back to rays.
// No allocations per frame (apart from what queryColliders itself returns).
//
// Trauma (every rig): rig.addTrauma(x) adds x (0..1, clamped) to rig.trauma; while it is above 0 the rig ends each
// update with a small rotation-only shake of strength trauma^2 (sums of 5..14 Hz sines; peak pitch / yaw / roll from
// traumaShake, default 0.025 / 0.025 / 0.035 rad at trauma 1), and trauma falls by traumaDecay (1.7) per second. With
// trauma 0 the rig's pose is exactly what it was without it. LandingSpring is the dip the character rigs use
// (landingDip): a kick of min(0.36 * fall speed, 3.2) m/s into a spring of stiffness 150 and damping 17.
import * as THREE from 'three';

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smooth01(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
/** Frame-rate independent exponential smoothing factor (lerp weight for this frame). */
export function damp(rate, dt) { return 1 - Math.exp(-rate * dt); }
export function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
/**
 * Frame-rate independent form of "move a fraction k of the way each 1/60 s frame": the weight for a step of h seconds,
 * 1 - (1 - k)^(h * 60). (k = 1 - exp(-rate / 60) gives the same as damp(rate, h).)
 */
export function damp60(k, h) { return 1 - Math.pow(1 - k, h * 60); }
/** Critically/under-damped spring step on a Vector3 (pos, vel toward goal). zeta 1 = critical. */
export function springStep(pos, vel, goal, k, zeta, dt, tmp) {
  const c = 2 * zeta * Math.sqrt(k);
  tmp.copy(goal).sub(pos).multiplyScalar(k).addScaledVector(vel, -c);
  vel.addScaledVector(tmp, dt);
  pos.addScaledVector(vel, dt);
}

/**
 * Default canopy heuristic for the Roadster world contract: trunk colliders (kind 2) carry a crown.
 * Writes [cx, cy, cz, rh, rv] into out at offset o and returns true, or returns false (no canopy).
 */
export function treeCanopy(b, out, o) {
  if (b.kind !== 2) return false;
  const h = b.maxY - b.minY, wdt = b.maxX - b.minX;
  let cy, rh, rv;
  if (h > 8) {            // palm-like: crown at the top of a tall trunk
    const s = h / 12;
    cy = b.maxY + 0.3; rh = 4.6 * s; rv = 2.8 * s;
  } else {                // broadleaf: crown sits on the trunk, size scales with trunk height
    // (incl. the leaf-card overhang: London plane trunk box 4.5 m -> crown ~2..13 m up, ~6 m radius)
    let R = clamp(h, 2.6, 7);
    if (wdt > 0.9) R *= 1.3;   // thick trunk -> wide crown (cypress / oak)
    cy = b.maxY + 0.75 * R; rh = 1.32 * R; rv = 1.25 * R;
  }
  out[o] = (b.minX + b.maxX) / 2; out[o + 1] = cy; out[o + 2] = (b.minZ + b.maxZ) / 2;
  out[o + 3] = rh; out[o + 4] = rv;
  return true;
}

export class CameraCollision {
  /**
   * @param {object} [o]
   * @param {Function} [o.getGroundHeight]  (x, z, refY) => height
   * @param {Function} [o.queryColliders]   (x, z, r) => AABB[] ({minX,minY,minZ,maxX,maxY,maxZ,kind})
   * @param {object} [o.physics]            PhysicsWorld-like: getGroundHeight / queryColliders / raycast
   * @param {boolean} [o.occlusion=true]
   * @param {Function|null} [o.canopyFromCollider=null]  (box, out, offset) => bool: canopy ellipsoid for a
   *                                        collider (opt-in; treeCanopy = the Roadster rule)
   * @param {Array|null} [o.thinKinds=[]]   collider kinds that only block near the camera (opt-in; Roadster: [2, 3])
   * @param {number} [o.maxCanopies=96]
   * @param {number} [o.nearMargin=0.3]     keep the camera this far out of solid boxes
   */
  constructor(o = {}) {
    const P = o.physics || null;
    this.physics = P;
    this.getGroundHeight = o.getGroundHeight || (P && typeof P.getGroundHeight === 'function' ? (x, z, y) => P.getGroundHeight(x, z, y) : null);
    this.queryColliders = o.queryColliders || (P && typeof P.queryColliders === 'function' ? (x, z, r) => P.queryColliders(x, z, r, this._qOut) || this._qOut : null);
    this.raycast = o.raycast || (P && typeof P.raycast === 'function' ? (orig, dir, max) => P.raycast(orig, dir, max) : null);
    this.occlusion = o.occlusion !== false;
    this.canopyFromCollider = typeof o.canopyFromCollider === 'function' ? o.canopyFromCollider : null;
    this.thinKinds = new Set(o.thinKinds || []);
    this.maxCanopies = o.maxCanopies || 96;
    this.nearMargin = o.nearMargin ?? 0.3;
    this.focus = new THREE.Vector3();        // target position (refY for terrain, push-out rules)
    this.boxes = null;
    this.canopies = new Float64Array(this.maxCanopies * 5);   // cx, cy, cz, rh, rv
    this.nCan = 0;
    this._qOut = [];
    this._dir = new THREE.Vector3();
  }

  ground(x, z, refY) {
    if (!this.getGroundHeight) return 0;
    const g = this.getGroundHeight(x, z, refY);
    return Number.isFinite(g) ? g : 0;
  }

  /** One collider query per frame around the focus; canopy ellipsoids inferred from colliders. */
  gather(focus, radius) {
    this.focus.copy(focus);
    this.boxes = null; this.nCan = 0;
    if (!this.queryColliders || !this.occlusion) return;
    const p = focus;
    const boxes = this.queryColliders(p.x, p.z, radius);
    if (!boxes || !boxes.length) return;
    this.boxes = boxes;
    const fn = this.canopyFromCollider;
    if (!fn) return;
    const C = this.canopies, max = this.maxCanopies;
    let n = 0;
    for (let i = 0; i < boxes.length && n < max; i++) if (fn(boxes[i], C, n * 5)) n++;
    this.nCan = n;
  }

  /** Normalised ellipsoid distance (<1 inside) of point (x,y,z) from canopy i. */
  canopyD(i, x, y, z) {
    const C = this.canopies, o = i * 5;
    const dx = (x - C[o]) / C[o + 3], dy = (y - C[o + 1]) / C[o + 4], dz = (z - C[o + 2]) / C[o + 3];
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * First hit fraction t in [0,1] along a -> b (1 = clear). Solid boxes are padded; thin boxes (trunks,
   * poles) only count near the camera end; canopies and terrain are included.
   */
  segHit(a, b, pad) {
    if (!this.occlusion) return 1;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return 1;
    let best = 1;
    const boxes = this.boxes, thinKinds = this.thinKinds;
    if (boxes) {
      for (let i = 0; i < boxes.length; i++) {
        const bx = boxes[i];
        const thin = thinKinds.has(bx.kind);
        const p = thin ? 0.25 : pad;
        const x0 = bx.minX - p, x1 = bx.maxX + p, y0 = bx.minY - p, y1 = bx.maxY + p, z0 = bx.minZ - p, z1 = bx.maxZ + p;
        // pivot already inside (target hugging it): ignore this box
        if (a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1 && a.z > z0 && a.z < z1) continue;
        let tmin = 0, tmax = best;
        if (Math.abs(dx) < 1e-9) { if (a.x < x0 || a.x > x1) continue; } else {
          let t0 = (x0 - a.x) / dx, t1 = (x1 - a.x) / dx; if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
          if (t0 > tmin) tmin = t0; if (t1 < tmax) tmax = t1; if (tmin > tmax) continue;
        }
        if (Math.abs(dy) < 1e-9) { if (a.y < y0 || a.y > y1) continue; } else {
          let t0 = (y0 - a.y) / dy, t1 = (y1 - a.y) / dy; if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
          if (t0 > tmin) tmin = t0; if (t1 < tmax) tmax = t1; if (tmin > tmax) continue;
        }
        if (Math.abs(dz) < 1e-9) { if (a.z < z0 || a.z > z1) continue; } else {
          let t0 = (z0 - a.z) / dz, t1 = (z1 - a.z) / dz; if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
          if (t0 > tmin) tmin = t0; if (t1 < tmax) tmax = t1; if (tmin > tmax) continue;
        }
        if (thin && (1 - tmin) * len > 1.6) continue;   // a pole between target and camera is fine
        if (tmin < best) best = tmin;
      }
    } else if (this.raycast && !this.queryColliders) {
      // generic physics backend: one ray (no padding information available)
      this._dir.set(dx / len, dy / len, dz / len);
      const hit = this.raycast(a, this._dir, len);
      const dist = hit == null ? Infinity : typeof hit === 'number' ? hit : hit.distance ?? (hit.t != null ? hit.t * len : Infinity);
      if (dist < len) best = Math.max(0, (dist - pad) / len);
    }
    // canopies: ray vs ellipsoid (scaled unit sphere)
    const C = this.canopies;
    for (let i = 0; i < this.nCan; i++) {
      const o = i * 5, rh = C[o + 3], rv = C[o + 4];
      const ox = (a.x - C[o]) / rh, oy = (a.y - C[o + 1]) / rv, oz = (a.z - C[o + 2]) / rh;
      const vx = dx / rh, vy = dy / rv, vz = dz / rh;
      const A = vx * vx + vy * vy + vz * vz, Bq = 2 * (ox * vx + oy * vy + oz * vz), Cq = ox * ox + oy * oy + oz * oz - 1;
      if (Cq < 0) continue;            // pivot inside a crown (flying through a tree): don't fight it
      const disc = Bq * Bq - 4 * A * Cq;
      if (disc < 0) continue;
      const t = (-Bq - Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t < best) best = t;
    }
    // terrain between the target and the camera
    if (this.getGroundHeight) {
      const refY = this.focus.y + 1.5;
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        if (t >= best) break;
        const x = a.x + dx * t, y = a.y + dy * t, z = a.z + dz * t;
        if (y < this.ground(x, z, Math.min(refY, y + 1)) + 0.25) { best = Math.max(0, t - 1 / 6); break; }
      }
    }
    return best;
  }

  /** Keep point p out of solid boxes by at least nearMargin (near-plane safety). */
  pushOut(p) {
    const boxes = this.boxes;
    if (!boxes) return;
    const m = this.nearMargin, carY = this.focus.y;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const x0 = b.minX - m, x1 = b.maxX + m, y0 = b.minY - m, y1 = b.maxY + m, z0 = b.minZ - m, z1 = b.maxZ + m;
      if (!(p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 && p.z > z0 && p.z < z1)) continue;
      let best = x1 - p.x, ax = 0, sg = 1;
      if (p.x - x0 < best) { best = p.x - x0; ax = 0; sg = -1; }
      if (z1 - p.z < best) { best = z1 - p.z; ax = 2; sg = 1; }
      if (p.z - z0 < best) { best = p.z - z0; ax = 2; sg = -1; }
      if (y1 - p.y < best) { best = y1 - p.y; ax = 1; sg = 1; }
      if (b.minY > carY + 1.5 && p.y - y0 < best) { best = p.y - y0; ax = 1; sg = -1; }
      if (ax === 0) p.x += sg * best; else if (ax === 1) p.y += sg * best; else p.z += sg * best;
    }
  }

  /** Lift pos so it is at least minY above the ground (sampled relative to the focus height). */
  clampAboveGround(pos, minY) {
    let floor = minY;
    if (this.getGroundHeight) floor = this.ground(pos.x, pos.z, Math.min(pos.y, this.focus.y + 1.5)) + minY;
    if (pos.y < floor) pos.y = floor;
  }
}

/**
 * Landing dip spring (Saltline's values): land(speed) kicks the spring downward by gain * min(0.36 * speed, 3.2) m/s;
 * step(dt) integrates stiffness 150 / damping 17 (damping ratio 0.69) in sub-steps of at most 1/240 s, so it is the
 * same at any frame rate. `y` is the vertical offset in metres (negative = down). Gain 1 dips ~7 cm after a 4.4 m/s
 * landing (a 1 m fall) and ~13 cm at the cap.
 */
export class LandingSpring {
  /** @param {number} [gain=1] */
  constructor(gain = 1) { this.gain = gain; this.y = 0; this.v = 0; }
  /** @param {number} speed  downward speed at touchdown (m/s, positive) */
  kick(speed) { if (speed > 0 && this.gain > 0) this.v -= this.gain * Math.min(0.36 * speed, 3.2); return this; }
  /** @param {number} dt */
  step(dt) {
    if (this.y === 0 && this.v === 0) return 0;
    const n = Math.max(1, Math.ceil(dt * 240 - 1e-6)), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-150 * this.y - 17 * this.v) * h; this.y += this.v * h; }
    if (Math.abs(this.y) < 1e-5 && Math.abs(this.v) < 1e-4) { this.y = 0; this.v = 0; }
    return this.y;
  }
  /** @returns {number} 0 */
  reset() { this.y = 0; this.v = 0; return 0; }
}

const TRAUMA_SHAKE = Object.freeze({ pitch: 0.025, yaw: 0.025, roll: 0.035 });
const TAU = Math.PI * 2;

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{ traumaDecay?: number, traumaShake?: { pitch?: number, yaw?: number, roll?: number }, [key: string]: any }} [opts]
   *   minY (ground clearance), active (default true; false = start inactive until activate()) + CameraCollision
   *   options; traumaDecay (1.7: trauma lost per second, see addTrauma), traumaShake (peak shake angles in rad at
   *   trauma 1, default { pitch: 0.025, yaw: 0.025, roll: 0.035 })
   */
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.enabled = opts.active !== false;
    this.minY = opts.minY ?? 0.6;
    this.collision = new CameraCollision(opts);
    this.target = null;
    this.getState = null;
    this._snapPending = true;
    /** 0..1: shake strength is trauma^2; falls by traumaDecay per second (addTrauma) */
    this.trauma = 0;
    this.traumaDecay = opts.traumaDecay ?? 1.7;
    /** @type {{ pitch: number, yaw: number, roll: number }} */
    this.traumaShake = { ...TRAUMA_SHAKE, ...(opts.traumaShake || {}) };
    this._shakeT = 0;
  }

  /**
   * Add trauma (a hit, a crash, an explosion): x 0..1 is added to `trauma` (clamped to 0..1). The camera shakes with
   * strength trauma^2, rotation only, and calms down as trauma falls by traumaDecay (1.7) per second: 0.5 shakes for
   * ~0.3 s, 1 for ~0.6 s. Typical: rig.addTrauma(Math.min(0.6, car.impact / 15)) after a collision.
   * @param {number} x
   * @returns {this}
   */
  addTrauma(x) {
    const v = this.trauma + (Number.isFinite(x) ? x : 0);
    this.trauma = v < 0 ? 0 : v > 1 ? 1 : v;
    return this;
  }

  /** End of update(): the trauma shake (rotation only), then decay. Does nothing at trauma 0. */
  _applyTrauma(dt) {
    if (!(this.trauma > 0)) return;
    const s = this.trauma * this.trauma, S = this.traumaShake, cam = this.camera;
    const t = (this._shakeT += dt);
    cam.rotateX(S.pitch * s * (0.65 * Math.sin(t * TAU * 7.3) + 0.35 * Math.sin(t * TAU * 11.9 + 1.1)));
    cam.rotateY(S.yaw * s * (0.65 * Math.sin(t * TAU * 6.1 + 0.5) + 0.35 * Math.sin(t * TAU * 13.7 + 2.3)));
    cam.rotateZ(S.roll * s * (0.65 * Math.sin(t * TAU * 5.3 + 1.7) + 0.35 * Math.sin(t * TAU * 9.1 + 0.4)));
    this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
  }

  // world-query passthroughs (assignable after construction, like the old ChaseCamera fields)
  get getGroundHeight() { return this.collision.getGroundHeight; }
  set getGroundHeight(f) { this.collision.getGroundHeight = f || null; }
  get queryColliders() { return this.collision.queryColliders; }
  set queryColliders(f) { this.collision.queryColliders = f || null; }
  get occlusion() { return this.collision.occlusion; }
  set occlusion(on) { this.collision.occlusion = !!on; }

  /**
   * Follow an Object3D (or anything with matrixWorld). `stateGetter` is called every update and returns the plain
   * state object the rig reads (ChaseRig: ChaseTargetState; ThirdPersonRig: { facing }); a non-function is used as the
   * state itself. Keep returning the same object and update its fields (no allocation per frame):
   *   const state = { velocity: car.velocity, speedKmh: 0, grounded: true };  rig.setTarget(carMesh, () => state);
   * @param {THREE.Object3D} object3d
   * @param {(() => object)|object|null} [stateGetter]
   */
  setTarget(object3d, stateGetter) {
    this.target = object3d;
    this.getState = typeof stateGetter === 'function' ? stateGetter : () => stateGetter;
    this._snapPending = true;
  }

  /** Teleport to the ideal pose on the next update (e.g. right after a respawn). */
  snap() { this._snapPending = true; }

  /** Called by a rig switcher when this rig becomes / stops being the active one. */
  activate() { this.enabled = true; this._snapPending = true; }
  deactivate() { this.enabled = false; }

  // eslint-disable-next-line no-unused-vars
  update(dt) {}

  dispose() {}
}
