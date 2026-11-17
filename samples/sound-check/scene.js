// The self-test scene: ten seconds of a dusk road, scripted, wired the way the starters wire the kit. audioSelfTest
// renders it offline; the page plays the same scene live with "Play the scene".
//   0.0 s  dusk bed (amb.dusk + CityAmbience at dusk), a lamp hum two metres away, a UI click
//   0.4 s  footsteps at a 2 m/s walk on concrete, gravel from 1.5 s; a wooden knock at 2.0 s; a landing at 2.6 s
//   3.0 s  the car (VehicleAudio, its own wind and tyre layers off) pulls away and sweeps to 150 km/h by 8.5 s, with
//          road roar and wind from the kit; a metal hit at 5.0 s; a slide (tyre.squeal) from 7.0 to 8.3 s;
//          a thud at 8.0 s; lift off at 8.5 s
//   9.3 s  a pickup chime
import { SoundBank, Footsteps, VehicleAudio, CityAmbience } from '@vibe/engine/audio';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * The kit's car loops from speed and slip (what starter-drive does each frame).
 * @param {{ roar: any, wind: any, squeal: any }} loops
 * @param {number} speed  m/s
 * @param {number} slip  0..1
 */
export function driveLoops({ roar, wind, squeal }, speed, slip) {
  roar.setGain(0.22 * clamp(speed / 30, 0, 1)).setRate(0.8 + 0.6 * clamp(speed / 50, 0, 1));
  const w = clamp(speed / 55, 0, 1);
  wind.setGain(0.3 * w * w).setRate(0.9 + 0.3 * w);
  const s = clamp((slip - 0.15) * 1.4, 0, 1) * clamp(speed / 6, 0, 1);
  squeal.setGain(0.22 * s).setRate(0.96 + 0.08 * s);
}

/**
 * Build the scene on `bus` (before it starts). Returns the step function audioSelfTest calls 60 times a second.
 * @param {import('@vibe/engine/audio').AudioBus} bus
 * @returns {(t: number, dt: number) => void}
 */
export function buildScene(bus) {
  const sfx = new SoundBank(bus, { seed: 1 });
  sfx.loop('amb.dusk', { gain: 0.14 });
  sfx.loop('lamp.hum', { at: [2, 1.5, -1], gain: 0.2 });
  const city = new CityAmbience(bus, { gulls: false, level: 0.2 });
  city.setEnvironment({ darkness: 0.75 });
  const car = new VehicleAudio({ bus, ambience: false, topSpeed: 200 / 3.6, wind: false, tyres: false });
  bus.setBusVolume('engine', 0.35); // VehicleAudio is mixed hot for a car on its own; under the kit it sits lower
  const loops = { roar: sfx.loop('road.roar', { gain: 0 }), wind: sfx.loop('wind.rush', { gain: 0 }), squeal: sfx.loop('tyre.squeal', { gain: 0 }) };
  const steps = new Footsteps(sfx, { surface: 'concrete' });
  const cues = [[0.3, () => sfx.play('ui.click')], [2.0, () => sfx.play('impact.wood', { at: [-3, 0, -2] })],
    [5.0, () => sfx.play('impact.metal', { at: [4, 0.5, -6] })], [8.0, () => sfx.play('impact.thud', { gain: 0.7 })],
    [9.3, () => sfx.play('pickup.chime')]];
  let cue = 0;
  return (t, dt) => {
    while (cue < cues.length && t >= cues[cue][0]) cues[cue++][1]();
    // the walker: 2 m/s until 2.4 s, a hop, lands at 2.6 s, walks on to 3.0 s
    steps.surface = t < 1.5 ? 'concrete' : 'gravel';
    const air = t >= 2.4 && t < 2.6, landed = t >= 2.6 && t - dt < 2.6;
    steps.update(dt, { speed: t >= 0.4 && t < 3 ? 2 : 0, grounded: !air, landed, landingSpeed: 4.2 });
    // the car
    const kmh = 150 * clamp((t - 3) / 5.5, 0, 1), speed = kmh / 3.6;
    const slip = t >= 7 && t < 8.3 ? 0.8 : 0;
    car.update(dt, { speedKmh: kmh, rpmLike: t >= 3 && t < 8.5 ? 0.8 : 0.15, grounded: true, wheelSlip: slip });
    driveLoops(loops, speed, slip);
    city.update(dt, { speedN: 0 });
    sfx.update(dt);
  };
}
