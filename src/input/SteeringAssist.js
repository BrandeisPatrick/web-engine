// SteeringAssist: keyboard / gamepad steering that holds the front tyres at their grip limit and catches slides.
// The method of AC-Advanced-Gamepad-Assist (adam10603, MIT), fitted to VehicleController's one-tyre-per-axle model:
//
//   1. Lock at the limit. Full input asks for the wheel angle that puts the front axle at `peak` x its slip angle of
//      peak grip, measured against the front axle's actual direction of travel (not the car's heading). Past that
//      angle a tyre only scrubs: raw full lock at speed overshoots it, washes wide and can end in a spin.
//   2. Self-steer. With no input the front wheels point along the rear axle's direction of travel (minus a little yaw
//      damping), so when the tail steps out the wheels countersteer by themselves and the slide is caught.
//   3. Blend. Input s (0..1 either way) mixes the two: angle = (1 - |s|) * selfSteer + |s| * limit(sign s).
//   4. Slide catch (keys only). Past `slideCatch[0]` x the rear's peak slip the key hands over to self-steer, all of it
//      by `slideCatch[1]`; a stick or touch input (analog) keeps its authority, its player countersteers.
//   5. Handbrake. While it is held the input passes through, so a handbrake turn rotates the car as the player asks;
//      self-steer catches the slide once it is released.
//   6. Speed fade. Below `fadeSpeed[0]` m/s (and in reverse, and in the air) the input passes through untouched, so
//      parking and the low-speed turning circle stay as they were; fully on from `fadeSpeed[1]`.
// The controller already limits lock by speed (car.steerLimit); the assist works inside it: its output is an
// ordinary steer value -1..1 (+1 = right) that car.step() scales by steerLimit, as with raw input.
//
//   const assist = new SteeringAssist();
//   per frame: controls.steer = assist.apply(dt, input.steer, car, analog);   // or new VehicleInput(el, { assist: true })
//   input.update(dt, car) does this for you; input.assist.enabled = false switches it off live.
//
// Reads from the car: velocity, quaternion, angularVelocity.y, steerLimit, slipPeakFront / slipPeakRear (outputs of
// VehicleController; a car without steerLimit gets the raw input back), spec.axleFront / axleRear / tyreLowSpeed.
// Deterministic (no randomness, no clock), no allocation per call, safe in Node.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * @typedef {object} SteeringAssistOptions
 * @property {boolean} [enabled=true]  false: apply() returns the input unchanged
 * @property {number} [peak=0.97]  full input targets this fraction of the front tyre's peak slip angle
 * @property {number} [selfSteer=1]  0..1: how far the wheels turn toward the rear axle's travel with no input
 * @property {number} [yawDamping=0.06]  s: self-steer subtracts yawRate x this (rad of wheel angle)
 * @property {number} [countersteerMax=0.6]  rad: cap on the self-steer wheel angle either way
 * @property {number} [yawGuard=2.5]  when the car yaws faster than 1.1 x its path's curvature allows (lateral accel /
 *   speed), the lock toward the rotation shrinks by this x the excess turned into a wheel angle (excess x wheelbase / speed)
 * @property {[number, number]} [slideCatch=[0.85, 1.65]]  keys: rear slip (x its peak) over which the key hands over
 *   to self-steer
 * @property {[number, number]} [fadeSpeed=[6, 12]]  m/s forward speed over which the assist fades in
 */

/**
 * The car fields the assist reads (VehicleController has them all).
 * @typedef {object} SteeringAssistCar
 * @property {{ x: number, y: number, z: number }} velocity  world m/s
 * @property {{ x: number, y: number, z: number, w: number }} quaternion  body orientation (forward = local -Z)
 * @property {{ y: number }} angularVelocity  y = yaw rate, rad/s, + = left
 * @property {number} [steerLimit]  rad: the lock the last step allowed (0 in the air)
 * @property {number} [slipPeakFront]  rad
 * @property {number} [slipPeakRear]  rad
 * @property {boolean} [grounded]
 * @property {{ x: number }} [localAccel]  body-frame acceleration, x = right (m/s^2), for the yaw guard
 * @property {{ axleFront?: number, axleRear?: number, tyreLowSpeed?: number }} [spec]
 */

export class SteeringAssist {
  /** @param {SteeringAssistOptions} [opts] */
  constructor(opts = {}) {
    /** false: apply() passes the input through */
    this.enabled = opts.enabled ?? true;
    this.peak = opts.peak ?? 0.97;
    this.selfSteer = opts.selfSteer ?? 1;
    this.yawDamping = opts.yawDamping ?? 0.06;
    this.countersteerMax = opts.countersteerMax ?? 0.6;
    this.yawGuard = opts.yawGuard ?? 2.5;
    /** @type {[number, number]} */
    this.slideCatch = opts.slideCatch ? [opts.slideCatch[0], opts.slideCatch[1]] : [0.85, 1.65];
    /** @type {[number, number]} */
    this.fadeSpeed = opts.fadeSpeed ? [opts.fadeSpeed[0], opts.fadeSpeed[1]] : [6, 12];
    // last call, for HUDs and tests (read-only)
    /** 0..1: how much of the assist the last call applied (speed fade) */
    this.fade = 0;
    /** 0..1: how much of the key input the slide catch handed to self-steer */
    this.slide = 0;
    /** rad (+ = left): the wheel angle the last call asked for (before the fade) */
    this.angle = 0;
    /** the last output, -1..1 (+1 = right) */
    this.steer = 0;
  }

  /**
   * Assisted steer for the next car.step().
   * @param {number} dt  seconds since the last call (unused today: the assist is a pure function of the car's state;
   *   kept so a smoothed version keeps the signature)
   * @param {number} steer  raw input -1..1, +1 = right (VehicleInput.steer before the assist)
   * @param {SteeringAssistCar|null|undefined} car  the VehicleController it steers; null returns `steer`
   * @param {boolean} [analog=false]  true for a stick or touch input (no slide catch)
   * @param {boolean} [handbrake=false]  true while the handbrake is held: the input passes through (a handbrake turn
   *   is a deliberate rotation), and self-steer catches the slide once it is released
   * @returns {number} steer -1..1, +1 = right
   */
  apply(dt, steer, car, analog = false, handbrake = false) {
    const s = clamp(Number.isFinite(steer) ? steer : 0, -1, 1);
    const lim = car ? car.steerLimit : 0;
    if (!this.enabled || !car || !(lim > 1e-4) || car.grounded === false || handbrake) { this.fade = 0; this.slide = 0; this.angle = 0; return (this.steer = s); }
    const v = car.velocity, q = car.quaternion, sp = car.spec || {};
    // body axes from the quaternion (forward = -Z, right = +X), without a Vector3
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const rx = 1 - 2 * (qy * qy + qz * qz), ry = 2 * (qx * qy + qw * qz), rz = 2 * (qx * qz - qw * qy);
    const fx = -2 * (qx * qz + qw * qy), fy = -2 * (qy * qz - qw * qx), fz = -(1 - 2 * (qx * qx + qy * qy));
    const u = v.x * fx + v.y * fy + v.z * fz;           // forward speed
    const wLat = v.x * rx + v.y * ry + v.z * rz;        // lateral speed, + = right
    const wy = car.angularVelocity.y;                   // yaw rate, + = left
    const fade = smoothstep(this.fadeSpeed[0], this.fadeSpeed[1], u);
    this.fade = fade;
    if (fade <= 0) { this.slide = 0; this.angle = 0; return (this.steer = s); }
    const a = -(sp.axleFront ?? -1.3), b = sp.axleRear ?? 1.3, uu = Math.max(u, sp.tyreLowSpeed ?? 2);
    const pkF = car.slipPeakFront || 0.2, pkR = car.slipPeakRear || 0.2;
    // directions of travel of the axles relative to the heading (rad, + = left)
    const thF = Math.atan2(-(wLat - a * wy), uu);
    const thR = Math.atan2(-(wLat + b * wy), uu);
    // self-steer: along the rear axle's travel, damped by the yaw rate, capped
    const cm = this.countersteerMax;
    const self = clamp(this.selfSteer * thR - this.yawDamping * wy, -cm, cm);
    // input: wheel angle that puts the front tyre at `peak` x its peak slip, toward the input's side (+ = left)
    const dir = s < 0 ? 1 : -1, mag = Math.abs(s);
    let limitAngle = thF + dir * this.peak * pkF;
    // yaw guard: rotating faster than the path curves (the rear is stepping out): less lock toward the rotation
    const aLat = car.localAccel ? Math.abs(car.localAccel.x) : 0;
    const excess = Math.abs(wy) - 1.1 * aLat / Math.max(5, uu);
    if (excess > 0 && this.yawGuard > 0) limitAngle -= Math.sign(wy) * this.yawGuard * excess * (a + b) / Math.max(5, uu);
    // keys: the slide catch hands the input over to self-steer while the rear is past its peak
    const slide = analog ? 0 : smoothstep(this.slideCatch[0], this.slideCatch[1], Math.abs(thR) / pkR); // |rear slip angle| / its peak
    this.slide = slide;
    const k = mag * (1 - slide);
    const angle = (1 - k) * self + k * limitAngle;
    this.angle = angle;
    const out = clamp(-angle / lim, -1, 1);
    return (this.steer = s + (out - s) * fade);
  }
}
