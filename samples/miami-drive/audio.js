// The coupe's sound, all synthesised on the engine's AudioBus (no samples): a straight-six (sawtooth + sub-octave
// square + 1.5x harmonic through a soft clip and a resonant low-pass whose cut-off follows rpm and load, amplitude
// modulated at the firing rate), a turbo whistle that spools with load and a blow-off chirp on lift, tyre squeal
// (two narrow band-passed noises whose level and pitch follow the slip), road roar by speed and surface, wind by
// speed^2, impact thumps, prop knocks, a backfire crack on upshifts, and an ambience bed of surf (louder near the
// beach) and a distant city hum.
import { AudioBus, OscStack, NoiseVoice, LFO, noiseBuffer, playTone, playNoiseBurst } from '@vibe/engine';
import { GEARBOX } from './spec.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class CarAudio {
  constructor({ volume = 0.7 } = {}) {
    this.bus = new AudioBus({ volume });
    this.started = false; this._prevThr = 0; this._boost = 0; this._t = 0;
    this.bus.onStart((ctx) => { this._build(ctx); this.started = true; });
  }
  toggleMute() { return this.bus.toggleMute(); }

  _build(ctx) {
    const n = this.n = {};
    const eng = this.bus.bus('engine'), fx = this.bus.bus('effects'), amb = this.bus.bus('ambience');
    this.white = noiseBuffer(ctx, 'white', 2.1);
    const brown = noiseBuffer(ctx, 'brown', 3.3), pink = noiseBuffer(ctx, 'pink', 2.7);
    n.motor = new OscStack(ctx, {
      voices: [{ type: 'sawtooth', gain: 0.5 }, { type: 'square', gain: 0.3, ratio: 0.5 }, { type: 'sawtooth', gain: 0.22, ratio: 1.5, detune: 5 }, { type: 'triangle', gain: 0.25, ratio: 3 }],
      mix: 0.42, drive: 2.6, filter: { type: 'lowpass', frequency: 900, Q: 3 }, gain: 0, out: eng, frequency: 40,
    });
    n.firing = new LFO(ctx, { frequency: 40, depth: 0, target: n.motor.output.gain, type: 'triangle' });
    n.intake = new NoiseVoice(ctx, { buffer: pink, rate: 1, filters: [{ type: 'bandpass', frequency: 700, Q: 1.6 }], gain: 0, out: eng });
    n.turbo = new OscStack(ctx, { voices: [{ type: 'sine', gain: 1 }], mix: 1, drive: 1, filter: { type: 'bandpass', frequency: 3000, Q: 6 }, gain: 0, out: eng, frequency: 2500 });
    n.squeal = new NoiseVoice(ctx, { buffer: this.white, rate: 1, filters: [{ type: 'bandpass', frequency: 1050, Q: 14 }, { type: 'peaking', frequency: 2100, gain: 6, Q: 5 }], gain: 0, out: fx });
    n.squeal2 = new NoiseVoice(ctx, { buffer: pink, rate: 1.05, filters: [{ type: 'bandpass', frequency: 1450, Q: 18 }], gain: 0, out: fx });
    n.road = new NoiseVoice(ctx, { buffer: brown, rate: 1.2, filters: [{ type: 'bandpass', frequency: 180, Q: 0.8 }, { type: 'highshelf', frequency: 1500, gain: 3 }], gain: 0, out: fx });
    n.wind = new NoiseVoice(ctx, { buffer: this.white, rate: 0.7, filters: [{ type: 'lowpass', frequency: 600, Q: 0.5 }], gain: 0, out: fx });
    n.surf = new NoiseVoice(ctx, { buffer: brown, rate: 0.45, filters: [{ type: 'lowpass', frequency: 700, Q: 0.3 }, { type: 'peaking', frequency: 300, gain: 4, Q: 0.7 }], gain: 0, out: amb });
    n.hum = new NoiseVoice(ctx, { buffer: pink, rate: 0.5, filters: [{ type: 'lowpass', frequency: 260, Q: 0.4 }], gain: 0.03, out: amb });
  }
  _set(p, v, tc) { p.setTargetAtTime(v, this.bus.ctx.currentTime, tc); }

  /** s: { rpm, throttle, speed (m/s), slip (0..1), grounded, surface ('asphalt' | 'sand' | ...), beach (0..1 proximity), gear } */
  update(dt, s) {
    const ctx = this.bus.ctx;
    if (!ctx || ctx.state !== 'running' || !this.n) return;
    const n = this.n;
    this._t += dt;
    const rpm = s.rpm, f = rpm / 60 * 3;              // six cylinders: three firings per revolution
    const load = clamp(s.throttle, 0, 1), rN = rpm / GEARBOX.redline;
    this._set(n.motor.oscillators[0].frequency, f, 0.02);
    this._set(n.motor.oscillators[1].frequency, f * 0.5, 0.02);
    this._set(n.motor.oscillators[2].frequency, f * 1.5, 0.02);
    this._set(n.motor.oscillators[3].frequency, f * 3, 0.02);
    this._set(n.motor.filter.frequency, 300 + f * 4 + load * 1800 + rN * 900, 0.04);
    this._set(n.motor.output.gain, 0.07 + 0.13 * load + 0.05 * rN, 0.04);
    this._set(n.firing.osc.frequency, f * 0.5, 0.03);
    this._set(n.firing.depth.gain, 0.025 + 0.03 * (1 - rN) * load, 0.1);
    this._set(n.intake.output.gain, 0.015 + 0.05 * load * rN, 0.05);
    this._set(n.intake.filters[0].frequency, 400 + rpm * 0.25, 0.05);
    // turbo: spools with load x rpm, whistle pitch with boost; blow-off chirp when the throttle snaps shut
    const want = load * clamp((rpm - 2500) / 3500, 0, 1);
    this._boost += (want - this._boost) * Math.min(1, dt * (want > this._boost ? 2.2 : 6));
    this._set(n.turbo.oscillators[0].frequency, 1800 + this._boost * 3200, 0.05);
    this._set(n.turbo.filter.frequency, 1800 + this._boost * 3200, 0.05);
    this._set(n.turbo.output.gain, 0.012 * this._boost * this._boost, 0.05);
    if (this._prevThr > 0.7 && load < 0.2 && this._boost > 0.4) this.blowOff(this._boost);
    this._prevThr = load;
    // tyres
    const g = s.grounded ? 1 : 0, sp = clamp(s.speed / 6, 0, 1);
    const sq = g * clamp((s.slip - 0.15) * 1.4, 0, 1) * sp * (s.surface === 'sand' || s.surface === 'grass' ? 0.15 : 1);
    this._set(n.squeal.output.gain, 0.16 * sq, 0.04);
    this._set(n.squeal2.output.gain, 0.09 * sq * sq, 0.04);
    this._set(n.squeal.filters[0].frequency, 950 + 250 * sq + 40 * Math.sin(this._t * 23), 0.03);
    const sN = clamp(s.speed / 70, 0, 1);
    this._set(n.road.output.gain, g * (0.03 + (s.surface === 'sand' ? 0.25 : 0.12) * Math.min(1, s.speed / 30)), 0.08);
    this._set(n.road.filters[0].frequency, 120 + 380 * sN, 0.1);
    this._set(n.wind.output.gain, 0.32 * sN * sN, 0.1);
    this._set(n.wind.filters[0].frequency, 300 + 2600 * sN, 0.1);
    // surf rolls in and out (two slow cycles) near the beach
    const swell = 0.5 + 0.5 * Math.sin(this._t * 0.9) * Math.sin(this._t * 0.37 + 1);
    this._set(n.surf.output.gain, (0.02 + 0.16 * clamp(s.beach, 0, 1)) * (0.4 + 0.6 * swell), 0.4);
  }

  thump(strength) {
    const ctx = this.bus.ctx; if (!ctx || !this.n) return;
    playNoiseBurst(ctx, this.bus.bus('effects'), this.white, { peak: clamp(strength, 0.1, 0.9), decay: 0.22 + strength * 0.2, filter: { type: 'lowpass', frequency: 260 + strength * 300 }, rate: 0.6 });
    if (strength > 0.4) playNoiseBurst(ctx, this.bus.bus('effects'), this.white, { peak: strength * 0.25, decay: 0.35, filter: { type: 'bandpass', frequency: 2400 }, rate: 1.3 }); // metal crunch
  }
  knock(strength) { // a light prop (cone, chair, box): a hollow plastic / wood knock
    const ctx = this.bus.ctx; if (!ctx || !this.n) return;
    playTone(ctx, this.bus.bus('effects'), { type: 'triangle', pitch: [[0, 260 + Math.random() * 120], [0.08, 120]], peak: clamp(strength, 0.05, 0.4), decay: 0.12 });
    playNoiseBurst(ctx, this.bus.bus('effects'), this.white, { peak: clamp(strength * 0.6, 0.05, 0.4), decay: 0.08, filter: { type: 'bandpass', frequency: 900 }, rate: 1 });
  }
  backfire() {
    const ctx = this.bus.ctx; if (!ctx || !this.n) return;
    playNoiseBurst(ctx, this.bus.bus('engine'), this.white, { peak: 0.3, decay: 0.07, filter: { type: 'lowpass', frequency: 1400 }, rate: 0.9 });
  }
  blowOff(k) {
    const ctx = this.bus.ctx; if (!ctx || !this.n) return;
    playNoiseBurst(ctx, this.bus.bus('engine'), this.white, { peak: 0.06 * k, attack: 0.01, decay: 0.3, filter: { type: 'bandpass', frequency: 3200 }, rate: 1.4 });
  }
}
