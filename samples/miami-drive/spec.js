// The hero car's physics: an original early-90s full-size rear-drive sedan with a big engine ("Corsa Vela" in the
// demo's fiction) as a
// VehicleController spec (merged over ROADSTER_SPEC by resolveVehicleSpec). Pure data, no three.js, so the Node test
// (test/miami-car.mjs) and the page drive exactly the same car; both quality tiers share it (identical physics).
//
// Targets (checked by test/miami-car.mjs): 0-100 km/h ~5.5 s, top speed ~250 km/h (drag-limited before the 72 m/s
// limiter), 100-0 km/h in ~37 m, a 60 m radius bend held at 80 km/h, a progressive rear-biased slide that comes
// back when the throttle is lifted, handbrake turns, and a soft enough suspension that kerbs, sidewalks and the
// beach ramp read through the body (dive, squat, roll); a steer key held through a fast bend (throttle held or lifted)
// never spins it (rearGrip), and full key at speed asks for about the grip limit (steerBase).
const DEG = Math.PI / 180;

export const CAR_SPEC = {
  // ---- chassis: 1480 kg, 4.36 x 2.0 x 1.31 m, 2.80 m wheelbase (the desktop hero model, car-glb.js; the phones'
  // generated sedan is within a few cm of it), 53 / 47 weight split
  mass: 1480,
  length: 4.36, width: 2.0, height: 1.31,
  axleFront: -1.40, axleRear: 1.40, halfTrack: 0.98,
  wheelRadius: 0.384,
  cgHeight: 0.5,
  yawInertia: 2550,
  pitchInertia: 2650,
  rollInertia: 580,
  bodyPoints: [
    [-0.92, 0.22, -2.25], [0.92, 0.22, -2.25], [-0.92, 0.25, 1.98], [0.92, 0.25, 1.98],
    [-1.0, 0.7, -2.15], [1.0, 0.7, -2.15], [-1.0, 0.85, 1.95], [1.0, 0.85, 1.95],
    [-0.62, 1.3, -0.3], [0.62, 1.3, -0.3], [-0.6, 1.25, 0.7], [0.6, 1.25, 0.7],
  ],
  obb: { centerY: 0.72, half: [1.0, 0.56, 2.2] },
  stepHeight: 0.24,          // a 17 cm kerb is driven over through the suspension; a 30 cm step is a wall
  normalClamp: 0.5,
  colliderRadius: 6,
  sweepStep: 0.3,
  // ---- suspension: soft-ish road car, visible dive / squat / roll
  suspensionTravel: 0.16,
  suspensionSag: 0.42,
  suspensionDamping: 0.52,
  antiRoll: 0.42,
  // ---- tyres: street rubber; lower B than the Roadster = a wider, more progressive peak (a slide you can catch)
  mu: 1.04, Bf: 10.5, Br: 11.5, C: 1.42,
  rearGrip: 1.1,             // the rear holds a little more than the front: at the limit the nose runs wide first (a
                             // held key no longer spins the car); throttle, a lift or the handbrake still bring the tail out
  tyreLowSpeed: 2.0,
  gripCap: 0.92,
  handbrakeGrip: 0.34,
  handbrakeForce: 0.85,
  // ---- steering: speed sensitive (full lock when parking, ~3.4 deg at 100 km/h, ~2 deg at 200): full key asks for
  // about the grip limit at speed, not 4x it (a darting turn-in); the slip term adds lock to catch a slide
  maxSteer: 34 * DEG,
  steerBase: 0.02, steerGain: 1.05, steerSlipGain: 0.3,
  airSteer: 0.1,
  // ---- powertrain: a 5.0 l V8 tuned well past stock, ~250 kW, rear-wheel drive (its sound: audio.js, EngineAudio)
  motorPeakForce: 8000,      // N at the contact patch in the low gears (traction-limited launch)
  motorPower: 250e3,
  vMax: 72,                  // m/s limiter (259 km/h); drag holds it near 250
  limiterRamp: 4,
  reverseMax: 8, reverseForce: 4800,
  frontDrive: 0,
  // ---- brakes
  brakeDecel: 11,
  // ---- aero: Cd 0.30 x 2.0 m^2
  CdA: 0.6, CdA_side: 2.4, CdA_top: 4.2, ClA: 0.22, downforceFront: 0.45, Crr: 0.012,
  // ---- no flight package: jumps are ballistic, a touch of arcade air control
  flight: false, boostPower: 1,
  airControl: 'arcade', airPitchRate: 0.35, airYawRate: 0.3,
  autoLevelTau: 1.4, levelPitchRateMax: 0.7, levelRollRateMax: 1.0, attitudeGain: 3, maxAngAccel: 2.5,
  authorityBase: 1, authorityTank: 0,
  // ---- impacts
  hardLandingSpeed: 7, hardLandingBounce: 0.18, landingDamageBase: 0, landingDamagePerMs: 0,
  wallRestitution: 0.18, wallFriction: 0.3, wallDamageSpeed: 99, wallDamagePerMs: 0, wallYawKick: 0.55,
  roofFriction: 0.7, autoRightDelay: 1.5, autoRightTau: 0.4,
};

/**
 * The six-speed automatic (the engine's Gearbox) for the engine sound, the rev counter and the gear readout, and the
 * short torque cut at each upshift: ratios as rpm per m/s of wheel speed (first tops out at ~70 km/h at the 5800 rpm
 * shift point; sixth cruises 100 km/h at ~1800 rpm).
 */
export const GEARBOX = {
  ratios: [300, 186, 133, 102, 80, 64],
  idle: 750, redline: 6200, upshift: 5800, cruise: 2000, downshift: 1200, kickdown: 3000, launch: 2800,
};
