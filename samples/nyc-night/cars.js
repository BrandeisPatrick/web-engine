// The cars of the Night NYC drive, slow to fast: each one an HD body from the engine (createCarVisual type) with its
// own physics spread over that body's spec (carSpecFor: ROAD_CAR_SPEC resized to the body, so the wheels sit in their
// arches), its engine voice (EngineAudio options) and its automatic gearbox (Gearbox options: revs, shifts, the torque
// cut at an upshift). Data only: the page (main.js) and the Node test (test/nyc-cars.mjs) drive exactly these cars.
// Targets (held by test/nyc-cars.mjs): the cab 0-100 km/h in about 13 s and 160 km/h flat out; the sedan about 8.5 s
// and 200 km/h; the interceptor about 5 s and 250 km/h.
import { carSpecFor } from '@vibe/engine/world';

const DEG = Math.PI / 180;
// every car: the Miami car's fix for a steer key held through a fast bend (the tail swung round at 60 km/h and up): the
// rear holds a little more than the front, so at the limit the nose runs wide first, and full key at speed asks for
// about what the grip can give (a lower lock floor, less lock added for a slide)
const HOLDS = { rearGrip: 1.1, steerBase: 0.02, steerGain: 1.05, steerSlipGain: 0.3 };

export const CARS = [
  {
    id: 'taxi', type: 'taxi', color: 0xf3b51b, name: 'Yellow cab', blurb: 'Slow and heavy. Soft springs, leans in corners.',
    // a tired four-cylinder on a four-speed automatic that shifts early and lugs (100 km/h in fourth at ~3300 rpm)
    engine: { cylinders: 4, gain: 0.9, seed: 3 },
    gearbox: { ratios: [390, 225, 158, 120], idle: 800, redline: 5600, upshift: 5000, cruise: 1900, kickdown: 2600, launch: 2300 },
    // a worn fleet sedan with a partition and a meter: heavier, a tired engine, soft and floaty, all-season tyres
    tune: { massAdd: 220, motorPower: 82e3, motorPeakForce: 5200, vMax: 45, limiterRamp: 3, mu: 0.92, Bf: 9, Br: 10,
      suspensionTravel: 0.18, suspensionSag: 0.45, suspensionDamping: 0.42, antiRoll: 0.25, brakeDecel: 8.5, maxSteer: 36 * DEG, ...HOLDS },
  },
  {
    id: 'sedan', type: 'sedan', color: 0x7a1015, name: 'Sedan', blurb: 'Balanced. Quick enough, grips well.',
    // a smooth straight-six on a five-speed (100 km/h in fifth at ~2800 rpm)
    engine: { cylinders: 6, gain: 1, seed: 5 },
    gearbox: { ratios: [400, 240, 168, 128, 102], idle: 700, redline: 6800, upshift: 6300, cruise: 2100, launch: 2600 },
    tune: { motorPower: 125e3, motorPeakForce: 6000, vMax: 57, mu: 1.0, brakeDecel: 10, ...HOLDS },
  },
  {
    id: 'interceptor', type: 'police_sedan', color: 0x101114, name: 'Interceptor', blurb: 'Fast. Big power, stiff and sharp.',
    // a big V8 on a six-speed (100 km/h in sixth at ~2200 rpm, ~5600 rpm flat out)
    engine: { cylinders: 8, gain: 1.15, seed: 7 },
    gearbox: { ratios: [310, 190, 137, 108, 92, 80], idle: 650, redline: 6200, upshift: 5800, cruise: 2000, launch: 2900 },
    // a pursuit-rated sedan: a big engine, all-wheel drive, stiff springs and bars, sticky tyres, big brakes
    tune: { massAdd: 120, motorPower: 280e3, motorPeakForce: 10000, frontDrive: 0.4, vMax: 72, limiterRamp: 5, CdA: 0.62, ClA: 0.3,
      mu: 1.12, Bf: 12, Br: 13, suspensionTravel: 0.12, suspensionSag: 0.35, suspensionDamping: 0.7, antiRoll: 0.75, brakeDecel: 12, ...HOLDS },
  },
];

export const DEFAULT_CAR = 'sedan';

/** The car with this id (the default for an unknown one). */
export const carById = (id) => CARS.find((c) => c.id === id) || CARS.find((c) => c.id === DEFAULT_CAR);

/** The VehicleController spec of a car: its body's spec with the car's tune over it (massAdd: kg on the body's mass). */
export function carSpec(car) {
  const base = carSpecFor(car.type), { massAdd = 0, ...tune } = car.tune;
  const mass = base.mass + massAdd;
  return { ...base, ...tune, mass, yawInertia: Math.round(base.yawInertia * mass / base.mass) };
}
