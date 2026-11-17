// VehicleHaptics: gamepad rumble from what the car is doing. Cues are layered as acc + m (1 - acc) (LibreCorsa's
// gamepad-haptics), so they stack without clipping: the weak (high-frequency) motor carries texture (tyres sliding,
// a light road buzz with speed), the strong motor heavy cues (landings, hits, a locked wheel), each hit ringing out.
//
//   const haptics = new VehicleHaptics();
//   per frame: haptics.update(dt, car, input.map.gamepad);   // a GamepadState, a Gamepad, or null (values only)
//   haptics.weak / haptics.strong: the last magnitudes 0..1 (a HUD meter, or another output)
//
// Sending: Chrome's vibrationActuator.playEffect('dual-rumble', { duration, strongMagnitude, weakMagnitude }), re-sent
// only when a magnitude moved by more than `resend` or the last effect is about to run out, and once with zeros when
// everything falls quiet. Unsupported pads and browsers are ignored (no throw). Not verifiable headless beyond its
// output values; nobody has felt it yet.
//
// Reads from the car (VehicleController outputs): grounded, speed, slipFront / slipRear and their peaks,
// wheels[i].slideHeat, landedThisStep / landingImpact, impact. Allocation-free after the first send.

const noop = () => {};
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * @typedef {object} VehicleHapticsOptions
 * @property {number} [gain=1]  overall scale of both motors
 * @property {number} [slide=0.45]  weak motor at a fully sliding tyre (from 0.85 x peak slip to 1.4 x)
 * @property {number} [road=0.05]  weak motor road buzz at 50 m/s
 * @property {number} [lock=0.35]  strong motor at a locked, sliding wheel (slideHeat 150 kW and up)
 * @property {number} [landing=0.12]  strong motor per m/s of landing speed (capped at 1)
 * @property {number} [hit=0.08]  strong motor per m/s of impact speed (capped at 1)
 * @property {number} [ring=0.3]  s: a landing or hit rings out over this
 * @property {number} [duration=90]  ms per sent effect
 * @property {number} [resend=0.04]  magnitude change that re-sends the effect
 */

/**
 * The car fields VehicleHaptics reads (VehicleController has them all).
 * @typedef {object} VehicleHapticsCar
 * @property {boolean} [grounded]
 * @property {number} [speed]
 * @property {number} [slipFront] @property {number} [slipRear]
 * @property {number} [slipPeakFront] @property {number} [slipPeakRear]
 * @property {Array<{ slideHeat?: number }>} [wheels]
 * @property {boolean} [landedThisStep] @property {number} [landingImpact] @property {number} [impact]
 */

export class VehicleHaptics {
  /** @param {VehicleHapticsOptions} [o] */
  constructor(o = {}) {
    this.gain = o.gain ?? 1;
    this.slide = o.slide ?? 0.45;
    this.road = o.road ?? 0.05;
    this.lock = o.lock ?? 0.35;
    this.landing = o.landing ?? 0.12;
    this.hit = o.hit ?? 0.08;
    this.ring = o.ring ?? 0.3;
    this.duration = o.duration ?? 90;
    this.resend = o.resend ?? 0.04;
    /** false: no effects are sent (values are still computed) */
    this.enabled = true;
    /** last weak (high-frequency) motor magnitude 0..1 */
    this.weak = 0;
    /** last strong (low-frequency) motor magnitude 0..1 */
    this.strong = 0;
    this._shock = 0;     // ringing landing / hit level 0..1
    this._sentWeak = 0; this._sentStrong = 0; this._sentAge = 1e9; // ms since the last send
    this._fx = { duration: this.duration, startDelay: 0, strongMagnitude: 0, weakMagnitude: 0 };
    /** effects sent (for tests) */
    this.sent = 0;
  }

  /**
   * Compute this frame's rumble and send it to the pad.
   * @param {number} dt  seconds
   * @param {VehicleHapticsCar|null} car
   * @param {{ pad?: any, vibrationActuator?: any }|null} [pad]  a GamepadState (its `pad`), a Gamepad, or null
   * @returns {this}
   */
  update(dt, car, pad = null) {
    let weak = 0, strong = 0;
    // hits and landings ring out (a fresh one replaces a weaker ringing one)
    this._shock *= this.ring > 0 ? Math.exp(-dt / (this.ring / 3)) : 0;
    if (car) {
      let kick = 0;
      if (car.landedThisStep) kick = (car.landingImpact || 0) * this.landing;
      if (car.impact > 0.5) kick = Math.max(kick, car.impact * this.hit);
      if (kick > this._shock) this._shock = Math.min(1, kick);
      if (car.grounded !== false) {
        const nf = car.slipPeakFront ? Math.abs(car.slipFront || 0) / car.slipPeakFront : 0;
        const nr = car.slipPeakRear ? Math.abs(car.slipRear || 0) / car.slipPeakRear : 0;
        const slip = ss((Math.max(nf, nr) - 0.85) / 0.55);
        const sp = car.speed || 0;
        const road = this.road * clamp(sp / 50, 0, 1);
        weak = road; weak += slip * this.slide * clamp(sp / 8, 0, 1) * (1 - weak);
        const W = car.wheels;
        let heat = 0;
        if (W) for (let i = 0; i < W.length; i++) heat = Math.max(heat, W[i].slideHeat || 0);
        strong = this.lock * ss((heat - 60) / 90);
      }
    }
    strong += this._shock * (1 - strong);
    weak += this._shock * 0.5 * (1 - weak);
    this.weak = clamp(weak * this.gain, 0, 1);
    this.strong = clamp(strong * this.gain, 0, 1);
    this._send(dt, pad);
    return this;
  }

  _send(dt, pad) {
    this._sentAge += dt * 1000;
    const g = pad && pad.pad !== undefined ? pad.pad : pad;
    const act = g && g.vibrationActuator;
    if (!this.enabled || !act || typeof act.playEffect !== 'function') return;
    const quiet = this.weak < 0.01 && this.strong < 0.01;
    const wasQuiet = this._sentWeak < 0.01 && this._sentStrong < 0.01;
    if (quiet && wasQuiet) return;
    const changed = Math.abs(this.weak - this._sentWeak) > this.resend || Math.abs(this.strong - this._sentStrong) > this.resend;
    const expiring = this._sentAge > this.duration * 0.7;
    if (!changed && !(expiring && !quiet) && !(quiet && !wasQuiet)) return;
    const fx = this._fx;
    fx.duration = this.duration; fx.weakMagnitude = quiet ? 0 : this.weak; fx.strongMagnitude = quiet ? 0 : this.strong;
    this._sentWeak = fx.weakMagnitude; this._sentStrong = fx.strongMagnitude; this._sentAge = 0;
    this.sent++;
    try { const r = act.playEffect('dual-rumble', fx); if (r && typeof r.catch === 'function') r.catch(noop); } catch { /* unsupported */ }
  }

  /** Stop any rumble now. @param {{ pad?: any, vibrationActuator?: any }|null} [pad] */
  stop(pad = null) {
    this.weak = 0; this.strong = 0; this._shock = 0;
    const g = pad && pad.pad !== undefined ? pad.pad : pad;
    const act = g && g.vibrationActuator;
    this._sentWeak = 0; this._sentStrong = 0;
    if (act && typeof act.reset === 'function') { try { const r = act.reset(); if (r && typeof r.catch === 'function') r.catch(noop); } catch { /* unsupported */ } }
  }
}
