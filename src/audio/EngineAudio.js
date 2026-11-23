// EngineAudio — a combustion engine, synthesised (no sample files) on an AudioBus, for any car with an rpm: a Gearbox
// (physics) gives it one. The electric car with thrusters is VehicleAudio.
//
//   const engine = new EngineAudio({ bus, cylinders: 8, idle: 750, redline: 6200 });   // bus: an AudioBus
//   per frame: engine.update(dt, gearbox);           // or { rpm, load } (load 0..1; `throttle` is read when no load)
//   engine.pop(0.6);                                 // an exhaust pop (a shift, a lift at high revs)
//
// How it is made (a source and a filter, as an engine is a pulse train through pipes):
//   - pulses: one oscillator per voice plays a PeriodicWave of a whole four-stroke cycle (two turns of the crank, so
//     its frequency is rpm / 120) holding one exhaust pulse per cylinder. The pulses are not equal: their strength and
//     timing differ a little (a crossplane V8's bank pattern for eight cylinders, a fixed seeded scatter otherwise), so
//     besides the firing harmonics (cylinders / 2 per turn) the half orders a real engine has are there too: the
//     burble at idle, the growl under load. Two waves, a sharp one on load and a soft one off it, cross-fade with load.
//   - roughness: a slow random wobble (filtered brown noise) on the oscillators' pitch, larger at idle, so no two
//     cycles are the same (an idle that is not a pure tone).
//   - rasp: white noise multiplied by the pulse wave (noise in bursts at each firing), band-passed, louder on load.
//   - intake: pink noise through a band-pass that rises with the revs, on load only.
//   - body: a soft clip driven harder on load, a low-pass that opens with revs and load, two fixed resonances (the
//     exhaust's pipes), the level by revs and load.
//   - overrun: off the throttle at high revs it pops now and then for a second or two (a seeded generator).
// Every change is a setTargetAtTime ramp (no zipper noise); the waves are band-limited by the browser (no aliasing).
import { noiseBuffer, makeFilter, makeGain, makeShaper, chain, playNoiseBurst } from './Synth.js';
import { AudioBus } from './AudioBus.js';
import { rng } from './dsp.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// a crossplane V8's exhaust pulses as one listener hears them: the banks alternate unevenly (the burble)
const V8_BANKS = [1, 0.72, 1, 0.95, 0.7, 1, 0.74, 0.78];

/**
 * One four-stroke cycle's pulse train as Fourier coefficients (PeriodicWave input).
 * @param {number} cylinders
 * @param {number} sharp  the pulse's bandwidth in firing orders (higher: brighter)
 * @param {number[]} amp  per-pulse strength
 * @param {number[]} lag  per-pulse timing offset (fraction of a firing interval)
 * @returns {{ real: Float32Array, imag: Float32Array }}
 */
export function engineCycle(cylinders, sharp, amp, lag) {
  const H = Math.min(160, cylinders * 14), real = new Float32Array(H + 1), imag = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) {
    let re = 0, im = 0;
    for (let k = 0; k < cylinders; k++) { const ph = -2 * Math.PI * h * (k + lag[k]) / cylinders; re += amp[k] * Math.cos(ph); im += amp[k] * Math.sin(ph); }
    const env = 1 / Math.sqrt(1 + (h / (cylinders * sharp)) ** 2); // a decaying pulse: -6 dB per octave past `sharp`
    real[h] = re * env; imag[h] = im * env;
  }
  return { real, imag };
}

/**
 * @typedef {object} EngineAudioState  what EngineAudio.update reads (a Gearbox has these)
 * @property {number} rpm
 * @property {number} [load]  0..1 engine load (else `throttle`)
 * @property {number} [throttle]  0..1
 */

export class EngineAudio {
  /**
   * @param {object} [o]
   * @param {AudioBus} [o.bus]  share a bus (else one is created; start it with engine.bus.start() in a gesture)
   * @param {number} [o.cylinders=4]  4, 6, 8 ... (8: a crossplane V8's burble)
   * @param {number} [o.idle=850]  rpm
   * @param {number} [o.redline=6500]  rpm
   * @param {number} [o.gain=1]  level
   * @param {string} [o.out='engine']  the bus it plays on
   * @param {number} [o.seed=1]  the pulse scatter and the overrun pops
   */
  constructor(o = {}) {
    this._ownBus = !o.bus;
    this.bus = o.bus || new AudioBus();
    this.cylinders = Math.max(1, Math.round(o.cylinders ?? 4));
    this.idle = o.idle ?? 850; this.redline = o.redline ?? 6500;
    this.gain = o.gain ?? 1;
    this.outName = o.out || 'engine';
    this.seed = o.seed ?? 1;
    this._rand = rng(this.seed * 7919 + 1);
    this._lift = 9; this._prevLoad = 0; this._popT = 0;
    this._n = null;
    this.bus.onStart((ctx) => this._build(ctx));
  }

  _build(ctx) {
    const n = this._n = {}, C = this.cylinders, r = rng(this.seed);
    const amp = [], lag = [];
    for (let k = 0; k < C; k++) { amp.push(C === 8 ? V8_BANKS[k] : 1 - 0.22 * r()); lag.push((r() - 0.5) * 0.06); }
    const wave = (sharp) => { const c = engineCycle(C, sharp, amp, lag); return ctx.createPeriodicWave(c.real, c.imag); };
    const osc = (w) => { const s = ctx.createOscillator(); s.setPeriodicWave(w); s.frequency.value = this.idle / 120; s.start(); return s; };
    const onWave = wave(5), offWave = wave(2.5);
    n.on = osc(onWave); n.off = osc(offWave); n.am = osc(onWave);
    n.gOn = makeGain(ctx, 0); n.gOff = makeGain(ctx, 1);
    // roughness: slow random pitch wobble (cents) on all three oscillators
    const brown = noiseBuffer(ctx, 'brown', 3.7), white = this._white = noiseBuffer(ctx, 'white', 2.3), pink = noiseBuffer(ctx, 'pink', 2.9);
    n.jit = ctx.createBufferSource(); n.jit.buffer = brown; n.jit.loop = true; n.jit.playbackRate.value = 0.5; n.jit.start();
    n.jitDepth = makeGain(ctx, 12);
    chain(n.jit, makeFilter(ctx, { type: 'lowpass', frequency: 14, Q: 0.5 }), n.jitDepth);
    for (const s of [n.on, n.off, n.am]) n.jitDepth.connect(s.detune);
    // rasp: noise x pulse wave, band-passed
    n.raspSrc = ctx.createBufferSource(); n.raspSrc.buffer = white; n.raspSrc.loop = true; n.raspSrc.start();
    n.raspAm = makeGain(ctx, 0); n.am.connect(n.raspAm.gain);
    n.raspBp = makeFilter(ctx, { type: 'bandpass', frequency: 900, Q: 0.8 });
    n.gRasp = makeGain(ctx, 0);
    chain(n.raspSrc, n.raspBp, n.raspAm, n.gRasp);
    // body: drive -> soft clip -> low-pass -> pipe resonances -> level
    n.drive = makeGain(ctx, 0.8);
    n.shaper = makeShaper(ctx, 1.8, '4x');
    n.lp = makeFilter(ctx, { type: 'lowpass', frequency: 900, Q: 0.6 });
    n.res1 = makeFilter(ctx, { type: 'peaking', frequency: 115, Q: 1.1, gain: 5 });
    n.res2 = makeFilter(ctx, { type: 'peaking', frequency: 420, Q: 1.4, gain: 3 });
    n.hp = makeFilter(ctx, { type: 'highpass', frequency: 28, Q: 0.7 });
    n.out = makeGain(ctx, 0);
    chain(n.on, n.gOn, n.drive); chain(n.off, n.gOff, n.drive); n.gRasp.connect(n.drive);
    chain(n.drive, n.shaper, n.lp, n.res1, n.res2, n.hp, n.out);
    // intake roar, past the clip
    n.intake = ctx.createBufferSource(); n.intake.buffer = pink; n.intake.loop = true; n.intake.start();
    n.inBp = makeFilter(ctx, { type: 'bandpass', frequency: 600, Q: 1.2 });
    n.gIn = makeGain(ctx, 0);
    chain(n.intake, n.inBp, n.gIn, n.out);
    n.out.connect(this.bus.bus(this.outName));
  }

  _set(p, v, tc) { p.setTargetAtTime(v, this.bus.ctx.currentTime, tc); }

  /**
   * Per frame.
   * @param {number} dt  s
   * @param {EngineAudioState} s  e.g. a Gearbox
   */
  update(dt, s) {
    if (!s || !this._n || !this.bus.live) return;
    const n = this._n, rpm = clamp(s.rpm || this.idle, 200, this.redline * 1.1);
    const load = clamp(s.load ?? s.throttle ?? 0, 0, 1), rN = clamp((rpm - this.idle) / (this.redline - this.idle), 0, 1);
    const f = rpm / 120;
    for (const o of [n.on, n.off, n.am]) this._set(o.frequency, f, 0.012);
    this._set(n.jitDepth.gain, 14 - 10 * rN, 0.2);
    this._set(n.gOn.gain, 0.15 + 0.85 * load, 0.04);
    this._set(n.gOff.gain, 0.9 - 0.6 * load, 0.04);
    this._set(n.gRasp.gain, 0.45 + 0.8 * load, 0.04);
    this._set(n.raspBp.frequency, 700 + 1400 * rN + 500 * load, 0.05);
    this._set(n.drive.gain, 0.7 + 1.1 * load, 0.04);
    this._set(n.lp.frequency, 650 + 1700 * rN + 2200 * load * (0.4 + 0.6 * rN), 0.04);
    this._set(n.inBp.frequency, 350 + 0.22 * rpm, 0.05);
    this._set(n.gIn.gain, 0.05 * load * (0.3 + rN), 0.05);
    this._set(n.out.gain, this.gain * 0.2 * (0.6 + 0.25 * rN + 0.3 * load), 0.04);
    // overrun: off the throttle from high revs, a few pops over the next two seconds
    if (load < 0.05 && this._prevLoad >= 0.05) this._lift = 0;
    this._prevLoad = load;
    this._lift += dt; this._popT -= dt;
    const want = load < 0.05 && this._lift < 2 && rN > 0.35 ? 6 * (rN - 0.3) * (1 - this._lift / 2) : 0;
    if (want > 0 && this._popT <= 0 && this._rand() < want * dt * 4) { this.pop(0.25 + 0.4 * this._rand()); this._popT = 0.07; }
  }

  /** An exhaust pop / crackle (0..1). */
  pop(strength = 0.6) {
    const ctx = this.bus.ctx; if (!ctx || !this._n || !this.bus.live) return;
    const s = clamp(strength, 0.05, 1), out = this._n.out;
    playNoiseBurst(ctx, out, this._white, { peak: 0.9 * s, attack: 0.002, decay: 0.035 + 0.05 * s, filter: { type: 'lowpass', frequency: 1300 + 900 * s }, rate: 0.8 });
  }

  /** Stop (and close the bus if the engine made it). */
  dispose() {
    if (this._ownBus) this.bus.dispose();
    else if (this._n) { for (const k of ['on', 'off', 'am', 'jit', 'raspSrc', 'intake']) this._n[k].stop(); this._n.out.disconnect(); }
    this._n = null;
  }
}
