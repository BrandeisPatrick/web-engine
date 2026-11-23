// The cars of the Night NYC drive, slow to fast: each one an HD body from the engine (createCarVisual type) with its
// own physics spread over that body's spec (carSpecFor: ROAD_CAR_SPEC resized to the body, so the wheels sit in their
// arches). Data only: the page (main.js) and the Node test (test/nyc-cars.mjs) drive exactly these cars.
// Targets (held by test/nyc-cars.mjs): the cab 0-100 km/h in about 13 s and 160 km/h flat out; the sedan about 8.5 s
// and 200 km/h; the interceptor about 5 s and 250 km/h.
import { carSpecFor } from '@vibe/engine/world';

const DEG = Math.PI / 180;

export const CARS = [
  {
    id: 'taxi', type: 'taxi', color: 0xf3b51b, name: 'Yellow cab', blurb: 'Slow and heavy. Soft springs, leans in corners.',
    // a worn fleet sedan with a partition and a meter: heavier, a tired engine, soft and floaty, all-season tyres
    tune: { massAdd: 220, motorPower: 82e3, motorPeakForce: 5200, vMax: 45, limiterRamp: 3, mu: 0.92, Bf: 9, Br: 10,
      suspensionTravel: 0.18, suspensionSag: 0.45, suspensionDamping: 0.42, antiRoll: 0.25, brakeDecel: 8.5, maxSteer: 36 * DEG },
  },
  {
    id: 'sedan', type: 'sedan', color: 0x7a1015, name: 'Sedan', blurb: 'Balanced. Quick enough, grips well.',
    tune: { motorPower: 125e3, motorPeakForce: 6000, vMax: 57, mu: 1.0, brakeDecel: 10 },
  },
  {
    id: 'interceptor', type: 'police_sedan', color: 0x101114, name: 'Interceptor', blurb: 'Fast. Big power, stiff and sharp.',
    // a pursuit-rated sedan: a big engine, all-wheel drive, stiff springs and bars, sticky tyres, big brakes
    tune: { massAdd: 120, motorPower: 280e3, motorPeakForce: 10000, frontDrive: 0.4, vMax: 72, limiterRamp: 5, CdA: 0.62, ClA: 0.3,
      mu: 1.12, Bf: 12, Br: 13, suspensionTravel: 0.12, suspensionSag: 0.35, suspensionDamping: 0.7, antiRoll: 0.75, brakeDecel: 12 },
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
