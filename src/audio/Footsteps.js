// Footsteps: a footfall sound every so many metres travelled on the ground, and a landing sound by impact speed.
//
//   const steps = new Footsteps(sfx, { surface: 'grass', at: player });   // sfx: a SoundBank
//   // per fixed step or per frame, from a CharacterController:
//   steps.update(dt, { speed: cc.speed, grounded: cc.grounded, landed: cc.landedThisStep, landingSpeed: cc.landingSpeed });
//   steps.surface = 'wood';                                                 // or surface: (x, z) => 'gravel'
//
// Distance between footfalls goes from `stride` at `walkSpeed` to `runStride` at `runSpeed` (metres per footfall;
// the defaults give about 2.1 steps a second at a 2 m/s walk and 2.6 at a 5.5 m/s run, CharacterController's
// defaults). Footfalls get louder with speed. A landing at under 2.5 m/s plays a footfall, under 6 m/s `land.soft`,
// faster `land.hard`, and restarts the stride. Surfaces: 'concrete', 'grass', 'gravel', 'wood' (the step.* sounds).

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/**
 * @typedef {object} FootstepState
 * @property {number} speed  horizontal m/s
 * @property {boolean} grounded
 * @property {boolean} [landed]  touched down this step
 * @property {number} [landingSpeed]  m/s down at touchdown
 */

export class Footsteps {
  /**
   * @param {import('./SoundBank.js').SoundBank} bank
   * @param {object} [o]
   * @param {number} [o.stride=0.95]  metres per footfall at walkSpeed
   * @param {number} [o.runStride=2.1]  metres per footfall at runSpeed
   * @param {number} [o.walkSpeed=2]
   * @param {number} [o.runSpeed=5.5]
   * @param {string|((x: number, z: number) => string)} [o.surface='concrete']  name, or a lookup by the `at` position
   * @param {number} [o.gain=1]
   * @param {import('./SoundBank.js').SoundPosition} [o.at]  where the feet are (an Object3D is read per footfall)
   */
  constructor(bank, { stride = 0.95, runStride = 2.1, walkSpeed = 2, runSpeed = 5.5, surface = 'concrete', gain = 1, at = null } = {}) {
    this.bank = bank;
    this.stride = stride; this.runStride = runStride; this.walkSpeed = walkSpeed; this.runSpeed = runSpeed;
    this.surface = surface; this.gain = gain; this.at = at;
    this.enabled = true;
    /** Footfalls played so far (for tests and HUDs). */
    this.count = 0;
    /** Last sound played ('' before any). */
    this.last = '';
    this._dist = stride * 0.6; // the first footfall comes after 0.4 of a stride
  }

  _surface() {
    const s = this.surface;
    if (typeof s !== 'function') return s;
    const a = /** @type {any} */ (this.at);
    let x = 0, z = 0;
    if (a && a.matrixWorld) { a.updateWorldMatrix(true, false); x = a.matrixWorld.elements[12]; z = a.matrixWorld.elements[14]; } else if (Array.isArray(a)) { x = a[0]; z = a[2]; } else if (a) { x = a.x; z = a.z; }
    return s(x, z);
  }

  _play(name, gain) {
    this.last = name;
    return this.bank.play(name, this.at ? { at: this.at, gain: gain * this.gain } : { gain: gain * this.gain });
  }

  /**
   * Per step: advance the stride and play what is due.
   * @param {number} dt  seconds
   * @param {FootstepState} s
   * @returns {string}  the sound played this call, or ''
   */
  update(dt, { speed = 0, grounded = true, landed = false, landingSpeed = 0 }) {
    if (!this.enabled) return '';
    if (landed) {
      this._dist = 0;
      const ls = Math.abs(landingSpeed);
      const name = ls >= 6 ? 'land.hard' : ls >= 2.5 ? 'land.soft' : `step.${this._surface()}`;
      this._play(name, ls >= 2.5 ? clamp(0.5 + ls / 12, 0.5, 1) : 0.7);
      this.count++;
      return name;
    }
    if (!grounded || speed < 0.3) { if (speed < 0.3) this._dist = Math.min(this._dist, this.stride * 0.6); return ''; }
    const k = clamp((speed - this.walkSpeed) / (this.runSpeed - this.walkSpeed), 0, 1);
    const stride = this.stride + (this.runStride - this.stride) * k;
    this._dist += speed * dt;
    if (this._dist < stride) return '';
    this._dist -= stride;
    if (this._dist > stride) this._dist = 0;
    const name = `step.${this._surface()}`;
    this._play(name, clamp(0.55 + 0.45 * (speed / this.runSpeed), 0.4, 1));
    this.count++;
    return name;
  }
}
