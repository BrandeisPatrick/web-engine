// The hero car's sound, all synthesised on the engine's AudioBus (no samples): the V8 is the engine's EngineAudio (eight
// uneven exhaust pulses per cycle, rasp, intake, overrun pops) driven by the hero car's Gearbox (rpm, load, shifts),
// with a pop at each upshift; tyre squeal (two narrow band-passed noises whose level and pitch follow the slip), road
// roar by speed and surface, wind by speed^2, impact thumps, prop knocks, and an ambience bed of surf (louder near the
// beach) and a distant city hum.
import { AudioBus, EngineAudio, NoiseVoice, noiseBuffer, playTone, playNoiseBurst } from '@vibe/engine';
import { GEARBOX } from './spec.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class CarAudio {
  /** @param {{ volume?: number, bus?: AudioBus }} [o]  bus: play on this one (e.g. an offline one for a recording) */
  constructor({ volume = 0.7, bus = null } = {}) {
    this.bus = bus || new AudioBus({ volume });
    this.started = false; this._t = 0;
    this.engine = new EngineAudio({ bus: this.bus, cylinders: 8, idle: GEARBOX.idle, redline: GEARBOX.redline, gain: 1.15 });
    this.bus.onStart((ctx) => { this._build(ctx); this.started = true; });
  }
  toggleMute() { return this.bus.toggleMute(); }

  _build(ctx) {
    const n = this.n = {};
    const eng = this.bus.bus('engine'), fx = this.bus.bus('effects'), amb = this.bus.bus('ambience');
    this.white = noiseBuffer(ctx, 'white', 2.1);
    const brown = noiseBuffer(ctx, 'brown', 3.3), pink = noiseBuffer(ctx, 'pink', 2.7);
    n.squeal = new NoiseVoice(ctx, { buffer: this.white, rate: 1, filters: [{ type: 'bandpass', frequency: 1050, Q: 14 }, { type: 'peaking', frequency: 2100, gain: 6, Q: 5 }], gain: 0, out: fx });
    n.squeal2 = new NoiseVoice(ctx, { buffer: pink, rate: 1.05, filters: [{ type: 'bandpass', frequency: 1450, Q: 18 }], gain: 0, out: fx });
    n.road = new NoiseVoice(ctx, { buffer: brown, rate: 1.2, filters: [{ type: 'bandpass', frequency: 180, Q: 0.8 }, { type: 'highshelf', frequency: 1500, gain: 3 }], gain: 0, out: fx });
    n.wind = new NoiseVoice(ctx, { buffer: this.white, rate: 0.7, filters: [{ type: 'lowpass', frequency: 600, Q: 0.5 }], gain: 0, out: fx });
    n.surf = new NoiseVoice(ctx, { buffer: brown, rate: 0.45, filters: [{ type: 'lowpass', frequency: 700, Q: 0.3 }, { type: 'peaking', frequency: 300, gain: 4, Q: 0.7 }], gain: 0, out: amb });
    n.hum = new NoiseVoice(ctx, { buffer: pink, rate: 0.5, filters: [{ type: 'lowpass', frequency: 260, Q: 0.4 }], gain: 0.03, out: amb });
  }
  _set(p, v, tc) { p.setTargetAtTime(v, this.bus.ctx.currentTime, tc); }

  /** s: { rpm, load (0..1, the gearbox's), speed (m/s), slip (0..1), grounded, surface ('asphalt' | 'sand' | ...), beach (0..1 proximity) } */
  update(dt, s) {
    const ctx = this.bus.ctx;
    if (!ctx || ctx.state !== 'running' || !this.n) return;
    const n = this.n;
    this._t += dt;
    this.engine.update(dt, s);
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
  backfire() { this.engine.pop(0.7); }
}
