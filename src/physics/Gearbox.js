// Gearbox: engine speed, gear and shift events for a car on VehicleController, which has no gearbox (its drive force
// follows a power curve). It gives the engine sound (EngineAudio), a rev counter and a gear readout what they need, and
// a short torque cut at each upshift (`cut`) that the game takes off the throttle, so the driver feels each shift as a
// brief dip in the pull and hears the revs drop.
//
// An automatic: under full throttle it shifts up at `upshift` rpm, under part throttle earlier (down to `cruise` rpm
// with the pedal barely pressed, so a cruise runs in a high gear at low revs); it shifts down when the revs fall under
// `downshift` (`kickdown` under full throttle), never twice within `hold` seconds, and only into a gear whose revs land
// between the two points (no hunting). First gear slips like a torque converter at a launch (the revs rise with the
// speed instead of sitting still), the revs run free in the air, reverse uses first gear's ratio.
// Pure (no three.js, no DOM), Node-safe, no allocation per update.
//
//   const gb = new Gearbox({ ratios: [300, 186, 133, 102, 80, 64], idle: 750, redline: 6200 });  // rpm per m/s per gear
//   per frame: gb.update(dt, car, input.throttle); controls.throttle = input.throttle * (1 - gb.cut);
//   read: gb.rpm, gb.gear (-1 reverse, 1..n), gb.load (0..1, the sound's engine load), gb.cut (0..1), gb.shifted
//   (+1 an upshift, -1 a downshift in this update, else 0)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * @typedef {object} GearboxOptions
 * @property {number[]} [ratios]  rpm per m/s of wheel speed, first gear first (default: a five-speed hatchback on
 *   0.32 m wheels)
 * @property {number} [idle=850]  rpm
 * @property {number} [redline=6500]  rpm: the revs never go past it
 * @property {number} [upshift=6000]  rpm of an upshift under full throttle
 * @property {number} [cruise=2100]  rpm of an upshift with the pedal barely pressed
 * @property {number} [downshift=1300]  rpm under which it shifts down with the pedal up
 * @property {number} [kickdown=3000]  rpm under which it shifts down under full throttle
 * @property {number} [launch=2600]  rpm the slipping first gear holds at a full-throttle launch
 * @property {number} [shiftTime=0.2]  s the revs take to settle into the new gear
 * @property {number} [cutTime=0.12]  s of torque cut at an upshift under load
 * @property {number} [hold=0.7]  s after a shift before the next one
 */

/** The default gearbox: a five-speed hatchback (ROAD_CAR_SPEC's 0.32 m wheels; ~190 km/h in fifth at 5500 rpm). */
export const GEARBOX_DEFAULTS = Object.freeze({
  ratios: Object.freeze([428, 245, 171, 128, 104]),
  idle: 850, redline: 6500, upshift: 6000, cruise: 2100, downshift: 1300, kickdown: 3000, launch: 2600,
  shiftTime: 0.2, cutTime: 0.12, hold: 0.7,
});

export class Gearbox {
  /** @param {GearboxOptions} [opts] */
  constructor(opts = {}) {
    /** @type {Required<GearboxOptions>} */
    this.o = { ...GEARBOX_DEFAULTS, ...opts };
    this.ratios = this.o.ratios.slice();
    /** -1 reverse, 1..ratios.length */
    this.gear = 1;
    /** engine speed, rpm */
    this.rpm = this.o.idle;
    /** 0..1: the engine's load for the sound (the throttle less the cut, a blip at a downshift) */
    this.load = 0;
    /** 0..1: the share of the throttle to take off this frame (torque cut at an upshift) */
    this.cut = 0;
    /** +1 an upshift, -1 a downshift during the last update, else 0 */
    this.shifted = 0;
    this._shiftT = 0; this._cutT = 0; this._hold = 0; this._blip = 0;
  }

  /** The revs a gear would turn at wheel speed v (m/s). */
  rpmIn(gear, v) { return Math.abs(v) * this.ratios[Math.max(1, gear) - 1]; }

  /**
   * Per frame, after the car's step.
   * @param {number} dt  s
   * @param {{ wheelSpeed?: number, forwardSpeed?: number, grounded?: boolean, reversing?: boolean }} car  a
   *   VehicleController (wheelSpeed: the driven wheels' surface speed, m/s)
   * @param {number} throttle  0..1, the driver's pedal
   * @returns {this}
   */
  update(dt, car, throttle) {
    const o = this.o, R = this.ratios, n = R.length;
    const thr = clamp(Number.isFinite(throttle) ? throttle : 0, 0, 1);
    const v = Math.abs(car.wheelSpeed ?? car.forwardSpeed ?? 0), grounded = car.grounded !== false;
    this.shifted = 0;
    this._hold -= dt; this._shiftT -= dt; this._cutT -= dt; this._blip -= dt;
    if (car.reversing) this.gear = -1;
    else if (this.gear < 1) this.gear = 1;
    if (this.gear >= 1 && grounded && this._hold <= 0) {
      const up = o.cruise + (o.upshift - o.cruise) * thr, down = o.downshift + (o.kickdown - o.downshift) * thr;
      const r = this.rpmIn(this.gear, v);
      if (this.gear < n && r > up && this.rpmIn(this.gear + 1, v) > down * 1.1) this._shift(1, thr);
      else if (this.gear > 1 && r < down && this.rpmIn(this.gear - 1, v) < up * 0.9) this._shift(-1, thr);
    }
    // target revs: the gear's, a slipping first gear at a launch, free in the air, never under idle or over redline
    let target = this.rpmIn(this.gear, v);
    if (this.gear === 1 && thr > 0.05) target = Math.max(target, o.idle + thr * (o.launch - o.idle) + 0.25 * target);
    if (!grounded) target += thr * 2500;
    target = clamp(target, o.idle, o.redline);
    // the revs follow: fast while the clutch pulls them into the new gear, as an engine spins up otherwise
    const k = this._shiftT > 0 ? 22 : target > this.rpm ? 9 : 6;
    this.rpm += (target - this.rpm) * Math.min(1, dt * k);
    this.cut = this._cutT > 0 ? 0.85 : 0;
    this.load = Math.max(thr * (1 - this.cut), this._blip > 0 ? 0.45 : 0);
    return this;
  }

  _shift(dir, thr) {
    this.gear += dir; this.shifted = dir;
    this._shiftT = this.o.shiftTime; this._hold = this.o.hold;
    if (dir > 0 && thr > 0.3) this._cutT = this.o.cutTime;
    if (dir < 0 && thr < 0.3) this._blip = 0.15; // a blip to match the revs on the way down
  }

  /** Back to first gear at idle (a reset). */
  reset() { this.gear = 1; this.rpm = this.o.idle; this.load = 0; this.cut = 0; this.shifted = 0; this._shiftT = this._cutT = this._hold = this._blip = 0; return this; }
}
