// TyreFx: skid marks and tyre smoke from how hard each tyre is actually sliding. It reads VehicleController's
// wheels[i].slideHeat (kW: load x sliding speed once a tyre is past its peak slip, x4 for a handbrake-locked wheel)
// and feeds the engine's existing renderers: one DecalTrail (marks, one ribbon per wheel, one draw call) and one CPU
// ParticleSystem (smoke, one instanced draw). A clean fast corner keeps every tyre under its peak, so it leaves
// nothing; a handbrake turn or a slide past the limit leaves dark marks and thin, pale smoke.
//
//   const tyres = new TyreFx({ scene, atmosphere, budget: S.effects?.tyres });   // budget: { marks, smoke, rate }
//   per frame, after the car's pose is drawn: tyres.update(dt, car, body);         // body: the drawn Object3D
//   on a teleport / reset: tyres.clear();
//
// Thresholds (LibreCorsa's tyre-slide-fx): marks fade in from `markHeat[0]` kW to full at `markHeat[1]`, smoke from
// `smokeHeat[0]` to `smokeHeat[1]`. Restraint is the default: marks are near-black and soft-edged, smoke is pale grey
// at alpha <= ~0.12 per puff, about twenty puffs per second per sliding tyre, so a slide reads as a thin haze, not a cloud.
//
// Budget (draw and fill): one draw call each for marks and smoke. `budget.marks` caps the ring of mark quads (the
// oldest fade out and are reused), `budget.smoke` caps the live puffs (each a camera-facing quad of up to ~3 m, so it
// bounds the fill), `budget.rate` caps the puffs per second per tyre. CPU per update: four point transforms, at most
// one ribbon segment per wheel, a few spawns, and the particle step (allocation-free; measured in
// test/browser/drive-feel.mjs).
//
// Contact points: the wheel's contact point in the car frame (spec wheels with the suspension's wheels[i].y), taken
// through `body`'s world matrix when given (the interpolated pose, so ribbons are smooth between fixed steps), else
// through the car's own position / quaternion. `lift` raises the ribbons off the surface (the starter's road plane
// sits 2 cm above the physics ground). `groundAt(x, z)`, when given, puts each mark on that height instead.
import * as THREE from 'three';
import { DecalTrail } from './Decals.js';
import { ParticleSystem } from './Particles.js';

const _p = new THREE.Vector3(), _side = new THREE.Vector3(), _q = new THREE.Quaternion();
// Allocation: V8 boxes every double passed to a call it does not inline (16 B each). So the mark intensity goes to
// DecalTrail.feed as one of 65 pre-boxed levels (k / 64, in an array with generic elements), the half width as a
// pre-boxed value, and puffs are written straight into the ParticleSystem's arrays (_writePuff) instead of through
// spawn()'s 18 double arguments.
const boxed = (xs) => { const a = [null, ...xs]; a.shift(); return a; };
const LEVELS = boxed(Array.from({ length: 65 }, (_, k) => k / 64));
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * @typedef {object} TyreFxBudget
 * @property {number} [marks=1200]  ring capacity of mark quads (segments of ~0.25 m; 4 tyres share it)
 * @property {number} [smoke=240]  live smoke puffs at most
 * @property {number} [rate=22]  puffs per second per tyre at full smoke
 */
/**
 * @typedef {object} TyreFxOptions
 * @property {THREE.Object3D} [scene]  the meshes are added here (else add tyres.marks.mesh / tyres.smoke.mesh yourself)
 * @property {object|number} [atmosphere]  the Atmosphere (or a 0..1 sun factor): smoke is lit by the sun, dim at night
 * @property {TyreFxBudget} [budget]
 * @property {[number, number]} [markHeat=[12, 90]]  kW: marks fade in over this range
 * @property {[number, number]} [smokeHeat=[25, 150]]  kW: smoke fades in over this range
 * @property {number} [markColor=0x060606]
 * @property {number} [markOpacity=0.72]  mark alpha at full heat
 * @property {number} [tyreWidth=0.2]  m, mark width
 * @property {number} [lift=0.03]  m, ribbons raised off the contact point
 * @property {number} [smokeShade=0.78]  smoke grey level (linear, 0..1): pale
 * @property {number} [smokeAlpha=0.12]  puff alpha at full smoke
 * @property {((x: number, z: number) => number)|null} [groundAt]  surface height under a mark (default the contact point)
 * @property {number} [seed=1]  puff jitter (deterministic)
 */

/**
 * The VehicleController fields TyreFx reads.
 * @typedef {object} TyreFxCar
 * @property {Array<{ x: number, y: number, z: number, slideHeat?: number, contact?: boolean }>} wheels
 * @property {{ x: number, y: number, z: number }} position
 * @property {{ x: number, y: number, z: number, w: number }} quaternion
 * @property {{ x: number, y: number, z: number }} velocity
 * @property {boolean} [grounded]
 */

export class TyreFx {
  /** @param {TyreFxOptions} [o] */
  constructor(o = {}) {
    const B = o.budget || {};
    this.markHeat = o.markHeat || [12, 90];
    this.smokeHeat = o.smokeHeat || [25, 150];
    this.tyreWidth = o.tyreWidth ?? 0.2;
    this.smokeShade = o.smokeShade ?? 0.78;
    this.smokeAlpha = o.smokeAlpha ?? 0.12;
    this.rate = B.rate ?? 22;
    this.groundAt = typeof o.groundAt === 'function' ? o.groundAt : null;
    /** the skid-mark ribbons (one DecalTrail, one trail per wheel) */
    this.marks = new DecalTrail({
      maxQuads: Math.max(16, Math.round(B.marks ?? 1200)), trails: 4, color: o.markColor ?? 0x060606, opacity: o.markOpacity ?? 0.72,
      minSegment: 0.25, maxSegment: 2.5, fadeTail: 0.3, edge: 0.25, lift: o.lift ?? 0.03, name: 'tyreMarks',
    });
    /** the smoke puffs (one CPU ParticleSystem, normal blending, sun-lit) */
    this.smoke = new ParticleSystem({
      max: Math.max(8, Math.round(B.smoke ?? 240)), blending: 'normal', drag: 1.3, fadeIn: 0.25, spin: 0.5, name: 'tyreSmoke',
      lit: true, litAmbient: 0.45, sun: o.atmosphere ?? 1,
    });
    this.smoke.mesh.renderOrder = 9;
    if (o.scene) o.scene.add(this.marks.mesh, this.smoke.mesh);
    this._acc = new Float32Array(4);   // smoke spawn accumulators per wheel
    this._heat = new Float32Array(4);  // smoothed heat per wheel (kW)
    this._seed = new Uint32Array([(o.seed ?? 1) >>> 0]);  // puff jitter: mulberry32 state
    this._r = new Float64Array(4);                          // four jitter values per puff (written by _jitter)
    // one reused puff record, written into the smoke's arrays by _writePuff
    this._hw = boxed([this.tyreWidth * 0.5, 0]);
    this._puff = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size0: 0.5, size1: 1, alpha: 0.1, r: 0.5, g: 0.5, b: 0.5, r1: 0.5, g1: 0.5, b1: 0.5, drag: 1.3, gravity: -0.08, rot: 0, rotV: 0 };
    /** per wheel 0..1: the mark and smoke intensities of the last update (read-only, for HUDs / tests) */
    this.markLevel = new Float32Array(4);
    this.smokeLevel = new Float32Array(4);
    /** totals since construction / clear(): ribbon segments fed with intensity > 0, puffs spawned */
    this.stats = { marked: 0, puffs: 0 };
  }

  /**
   * Lay marks and spawn smoke for this frame, then step the smoke.
   * @param {number} dt  seconds
   * @param {TyreFxCar} car  the VehicleController
   * @param {THREE.Object3D|null} [body]  the drawn car (its world matrix places the contact points); default the car's pose
   */
  update(dt, car, body = null) {
    const W = car.wheels, R = this._r, P = this._puff;
    const mh = this.markHeat, sh = this.smokeHeat;
    const k = 1 - Math.exp(-dt / 0.05); // 50 ms heat smoothing: no flicker between fixed steps
    let m = null;
    if (body) { body.updateMatrixWorld(); m = body.matrixWorld; _side.setFromMatrixColumn(m, 0).normalize(); }
    else _side.set(1, 0, 0).applyQuaternion(_q.set(car.quaternion.x, car.quaternion.y, car.quaternion.z, car.quaternion.w));
    const v = car.velocity;
    for (let i = 0; i < 4; i++) {
      const w = W[i];
      const raw = car.grounded !== false && w.contact !== false ? w.slideHeat || 0 : 0;
      const heat = this._heat[i] += (raw - this._heat[i]) * k;
      // smoothstep over the heat ranges; a tyre that grips again (raw 0) ends its mark at once
      const mark = raw > 0 ? ss((heat - mh[0]) / (mh[1] - mh[0])) : 0;
      const puff = raw > 0 ? ss((heat - sh[0]) / (sh[1] - sh[0])) : 0;
      const level = Math.round(mark * 64);
      this.markLevel[i] = level / 64; this.smokeLevel[i] = puff;
      if (level <= 1 && puff <= 0) { this.marks.feed(i, _p, _side, 0, 0); this._acc[i] = 0; continue; }
      _p.set(w.x, w.y, w.z);
      if (m) _p.applyMatrix4(m);
      else _p.applyQuaternion(_q).add(/** @type {THREE.Vector3} */ (car.position));
      if (this.groundAt) _p.y = this.groundAt(_p.x, _p.z);
      this.marks.feed(i, _p, _side, this._hw[0], LEVELS[level]);
      if (level > 1) this.stats.marked++;
      if (puff > 0) {
        let acc = this._acc[i] + puff * this.rate * dt;
        const g = this.smokeShade;
        while (acc >= 1) {
          acc -= 1;
          this._jitter();
          const r0 = R[0], r1 = R[1], r2 = R[2], r3 = R[3];
          // the puffs rise about as fast as they grow, so a quad's dense middle never meets the ground (a camera-facing
          // quad cut by the road shows a hard straight edge: there are no soft particles)
          P.x = _p.x + (r1 - 0.5) * 0.3; P.y = _p.y + 0.25; P.z = _p.z + (r2 - 0.5) * 0.3;
          P.vx = v.x * 0.2 + (r3 - 0.5) * 1.2; P.vy = 0.55 + r0 * 0.5; P.vz = v.z * 0.2 + (r0 - 0.5) * 1.2;
          P.life = 1.6 + r0 * 1.2; P.size0 = 0.35 + r1 * 0.25; P.size1 = 1.1 + puff * 0.8 + r2 * 0.4;
          P.alpha = this.smokeAlpha * (0.5 + 0.5 * puff);
          P.r = g; P.g = g; P.b = g * 1.02; P.r1 = g * 0.97; P.g1 = g * 0.97; P.b1 = g;
          P.rot = r3 * 6.283; P.rotV = (r1 * 2 - 1) * 0.5;
          if (this._writePuff()) this.stats.puffs++;
        }
        this._acc[i] = acc;
      } else this._acc[i] = 0;
    }
    this.smoke.update(dt);
  }

  // ParticleSystem.spawn's writes, from this._puff (rotation from the jitter instead of Math.random). false when full.
  _writePuff() {
    const S = this.smoke, P = this._puff;
    if (S.count >= S.max) return false;
    const i = S.count++, i3 = i * 3;
    S.p[i3] = P.x; S.p[i3 + 1] = P.y; S.p[i3 + 2] = P.z;
    S.v[i3] = P.vx; S.v[i3 + 1] = P.vy; S.v[i3 + 2] = P.vz;
    S.age[i] = 0; S.life[i] = P.life > 1e-3 ? P.life : 1e-3; S.s0[i] = P.size0; S.s1[i] = P.size1; S.a0[i] = P.alpha;
    S.rot[i] = P.rot; S.rotV[i] = P.rotV;
    S.c[i3] = P.r; S.c[i3 + 1] = P.g; S.c[i3 + 2] = P.b;
    S.c1[i3] = P.r1; S.c1[i3 + 1] = P.g1; S.c1[i3 + 2] = P.b1;
    S.dragA[i] = P.drag; S.grav[i] = P.gravity;
    return true;
  }

  // four mulberry32 draws into this._r (no double crosses a call boundary: nothing is boxed)
  _jitter() {
    const S = this._seed, R = this._r;
    for (let k = 0; k < 4; k++) {
      const a = (S[0] = (S[0] + 0x6d2b79f5) >>> 0);
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      R[k] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  /** Remove every mark and puff (a reset or teleport). */
  clear() {
    this.marks.clear(); this.smoke.clear();
    this._acc.fill(0); this._heat.fill(0); this.markLevel.fill(0); this.smokeLevel.fill(0);
    this.stats.marked = 0; this.stats.puffs = 0;
  }

  /** Remove the meshes from their parent and free the GPU buffers. */
  dispose() {
    this.marks.mesh.removeFromParent(); this.smoke.mesh.removeFromParent();
    this.marks.dispose(); this.smoke.dispose();
  }
}
