// Spooky sound, all synthesised on the engine's AudioBus (no sample files):
//   music     a D-minor loop (i - VI - iv - V): music-box arpeggios with reverb, a plucked bass, a slow organ pad and a
//             clock tick-tock; scheduled ahead on the audio clock (per frame, ~0.2 s look-ahead). intensity() speeds it
//             up and adds a second arpeggio voice as midnight nears.
//   ambience  wind gusts, crickets, an owl now and then, a distant wolf.
//   sfx       candy chimes (rising with the pickup streak), the pumpkin smash, the jump / land, the BOO shout, a ghost's
//             moan and squeal, caught, bells (the midnight tolls), the final ticks, UI blips.
// The context starts on the first gesture (bus.unlockOnGesture + the start button), so iOS / Chrome allow it.
import { AudioBus, OscStack, NoiseVoice, LFO, noiseBuffer, playTone, playNoiseBurst } from '@vibe/engine/audio';

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// chords as MIDI notes: Dm, Bb, Gm, A (harmonic minor: C#)
const CHORDS = [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]];
const BASS = [38, 34, 31, 33];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
const PENTA = [72, 74, 77, 79, 81, 84, 86, 89, 91, 93]; // pickup chime ladder (D minor pentatonic-ish)

export class GameAudio {
  constructor() {
    this.bus = new AudioBus({ volume: 0.8, reverbSeconds: 2.8 });
    this.ready = false;
    this.musicOn = true;
    this.tempo = 104; this._intensity = 0;
    this._next = 0; this._step = 0; this._bar = 0;
    this._owlT = 9; this._wolfT = 24; this._cricketT = 1; this._gustT = 0; this._gust = 0.5;
    this.bus.onStart((ctx) => this._build(ctx));
  }
  unlock() { this.bus.unlockOnGesture(); }
  start() { return this.bus.start(); }
  toggleMute() { return this.bus.toggleMute(); }
  get muted() { return this.bus.muted; }

  _build(ctx) {
    const B = this.bus;
    this.white = noiseBuffer(ctx, 'white', 2.2);
    this.pink = noiseBuffer(ctx, 'pink', 2.6);
    const brown = noiseBuffer(ctx, 'brown', 4.1);
    this.music = B.bus('music');
    B.setBusVolume('music', 0.55); B.setBusVolume('ambience', 0.7); B.setBusVolume('effects', 0.9); B.setBusVolume('ui', 0.8);
    this.musicVerb = B.reverbSend(this.music, 0.35);
    // organ pad: three detuned saw pairs through a low-pass (chord tones glide on each bar)
    this.pad = [0, 1, 2].map(() => new OscStack(ctx, {
      voices: [{ type: 'sawtooth', gain: 0.5 }, { type: 'sawtooth', gain: 0.5, detune: 9 }, { type: 'triangle', gain: 0.6, ratio: 0.5 }],
      filter: { type: 'lowpass', frequency: 700, Q: 0.7 }, gain: 0, out: this.music, frequency: 220,
    }));
    this.padLfo = new LFO(ctx, { frequency: 0.13, depth: 220, target: this.pad[0].filter.frequency });
    // wind
    const amb = B.bus('ambience');
    this.wind = new NoiseVoice(ctx, { buffer: brown, rate: 0.7, filters: [{ type: 'lowpass', frequency: 420, Q: 0.6 }, { type: 'highpass', frequency: 40 }], gain: 0, out: amb });
    this.whistle = new NoiseVoice(ctx, { buffer: this.pink, rate: 0.8, filters: [{ type: 'bandpass', frequency: 900, Q: 6 }], gain: 0, out: amb });
    this.ambVerb = B.reverbSend(amb, 0.3);
    this.ready = true;
    this._next = ctx.currentTime + 0.1;
  }

  /** 0 (start of the round) .. 1 (midnight): tempo and layers. */
  intensity(v) { this._intensity = v; this.tempo = 104 + 22 * v * v; }
  setMusic(on) {
    this.musicOn = !!on;
    if (this.ready) this.bus.setBusVolume('music', on ? 0.55 : 0, 0.4);
  }

  update(dt, playing) {
    if (!this.ready) return;
    const ctx = this.bus.ctx;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this._next < now - 0.25) this._next = now + 0.05; // after a stall (hidden tab): no burst of late notes
    const step = 60 / this.tempo / 2; // eighth notes
    while (this._next < now + 0.2) { this._schedule(this._next, step); this._next += step; }
    // ambience
    this._gustT -= dt;
    if (this._gustT <= 0) { this._gustT = 2 + Math.random() * 4; this._gust = 0.2 + Math.random() * 0.8; }
    this.wind.output.gain.setTargetAtTime(0.06 + 0.1 * this._gust, now, 1.2);
    this.wind.filters[0].frequency.setTargetAtTime(260 + 380 * this._gust, now, 1.2);
    this.whistle.output.gain.setTargetAtTime(0.01 * this._gust * this._gust, now, 1.5);
    this._cricketT -= dt;
    if (this._cricketT <= 0) { this._cricketT = 0.6 + Math.random() * 1.8; this._crickets(now); }
    this._owlT -= dt;
    if (this._owlT <= 0) { this._owlT = 14 + Math.random() * 14; this.owl(); }
    this._wolfT -= dt;
    if (this._wolfT <= 0) { this._wolfT = 35 + Math.random() * 30; this.wolf(); }
  }

  _schedule(t, step) {
    const ctx = this.bus.ctx, out = this.music, s = this._step, bar = this._bar, chord = CHORDS[bar % 4];
    const inBar = s % 8;
    if (inBar === 0) {
      // pad: glide to the chord, swell
      for (let k = 0; k < 3; k++) {
        const o = this.pad[k];
        for (let v = 0; v < o.oscillators.length; v++) o.oscillators[v].frequency.setTargetAtTime(hz(chord[k] - 12) * o.voices[v].ratio, t, 0.08);
        o.output.gain.setTargetAtTime(this.musicOn ? 0.018 : 0, t, 0.5);
      }
    }
    // plucked bass on 1 and the "and" of 3
    if (inBar === 0 || inBar === 5) {
      const f = hz(BASS[bar % 4] + (inBar === 5 ? 12 : 0));
      playTone(ctx, out, { type: 'triangle', pitch: [[0, f], [0.25, f * 0.995]], peak: 0.28, attack: 0.005, decay: inBar === 0 ? 0.55 : 0.25, filter: { type: 'lowpass', frequency: 600 }, when: t });
      playTone(ctx, out, { type: 'square', pitch: [[0, f]], peak: 0.035, decay: 0.2, filter: { type: 'lowpass', frequency: 400 }, when: t });
    }
    // music box arpeggio (an octave up); a gap every 4th bar's end for breath
    if (!(bar % 4 === 3 && inBar >= 6)) {
      const note = chord[ARP[inBar]] + 12;
      const f = hz(note);
      playTone(ctx, out, { type: 'sine', pitch: [[0, f]], peak: 0.09, attack: 0.002, decay: 0.55, when: t });
      playTone(ctx, out, { type: 'sine', pitch: [[0, f * 4.01]], peak: 0.018, attack: 0.001, decay: 0.12, when: t });
    }
    // second voice (counter-melody) as midnight nears
    if (this._intensity > 0.55 && (inBar === 2 || inBar === 6)) {
      const f = hz(chord[(inBar / 2) % 3] + 24);
      playTone(ctx, out, { type: 'triangle', pitch: [[0, f], [0.08, f * 1.002]], peak: 0.05, decay: 0.3, when: t + step * 0.5 });
    }
    // clock: tick on the beat, tock off it
    if ((s & 1) === 0) playNoiseBurst(ctx, out, this.white, { peak: 0.06, attack: 0.001, decay: 0.03, filter: { type: 'bandpass', frequency: inBar % 4 === 0 ? 3200 : 2400 }, when: t });
    this._step++;
    if (this._step % 8 === 0) this._bar++;
  }

  _crickets(t) {
    const ctx = this.bus.ctx, out = this.bus.bus('ambience'), f = 4300 + Math.random() * 500;
    for (let k = 0; k < 3; k++) playTone(ctx, out, { type: 'sine', pitch: [[0, f]], peak: 0.012, attack: 0.003, decay: 0.035, when: t + k * 0.07, pan: Math.random() * 2 - 1 });
  }
  owl() {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('ambience'), t = ctx.currentTime, pan = Math.random() * 1.6 - 0.8;
    for (const [dt, len] of [[0, 0.32], [0.42, 0.2], [0.72, 0.5]]) playTone(ctx, out, { type: 'sine', pitch: [[0, 390], [len * 0.4, 410], [len, 340]], peak: 0.07, attack: 0.06, decay: len, when: t + dt, pan, filter: { type: 'lowpass', frequency: 1200 } });
  }
  wolf() {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('ambience'), t = ctx.currentTime, pan = Math.random() * 1.6 - 0.8;
    const pts = [];
    for (let k = 0; k <= 24; k++) { const u = k / 24, f = 300 + 330 * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) - 140 * Math.max(0, u - 0.7) / 0.3; pts.push([u * 2.6, f * (1 + 0.012 * Math.sin(k * 2.1))]); }
    pts[0][0] = 0;
    playTone(ctx, out, { type: 'sawtooth', pitch: pts, peak: 0.035, attack: 0.5, decay: 2.2, filter: { type: 'bandpass', frequency: 900, Q: 3 }, when: t, pan });
  }

  // ---------------------------------------------------------------- sfx
  candy(streak = 0, big = false) {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('ui'), t = ctx.currentTime, f = hz(PENTA[Math.min(streak, PENTA.length - 1)]);
    if (big) { [0, 4, 7, 12, 16].forEach((d, i) => playTone(ctx, out, { type: 'triangle', pitch: [[0, f * Math.pow(2, d / 12)]], peak: 0.13, decay: 0.35, when: t + i * 0.06 })); return; }
    playTone(ctx, out, { type: 'triangle', pitch: [[0, f], [0.05, f * 1.01]], peak: 0.13, attack: 0.002, decay: 0.18, when: t });
    playTone(ctx, out, { type: 'sine', pitch: [[0, f * 2]], peak: 0.05, attack: 0.002, decay: 0.12, when: t + 0.03 });
  }
  smash(stomp = false) {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('effects'), t = ctx.currentTime;
    playNoiseBurst(ctx, out, this.white, { peak: 0.5, attack: 0.002, decay: 0.22, filter: { type: 'lowpass', frequency: 900 }, rate: 0.8 });
    playNoiseBurst(ctx, out, this.pink, { peak: 0.3, attack: 0.001, decay: 0.09, filter: { type: 'bandpass', frequency: 2200 } });
    playTone(ctx, out, { type: 'sine', pitch: [[0, 150], [0.18, 48]], peak: 0.45, decay: 0.22, when: t });
    if (stomp) playTone(ctx, out, { type: 'square', pitch: [[0, 260], [0.16, 720]], peak: 0.06, decay: 0.2, filter: { type: 'lowpass', frequency: 2000 }, when: t + 0.02 });
  }
  jump() { if (!this.ready) return; const ctx = this.bus.ctx; playTone(ctx, this.bus.bus('effects'), { type: 'sine', pitch: [[0, 330], [0.1, 560]], peak: 0.07, decay: 0.12 }); }
  land(v) { if (!this.ready) return; playNoiseBurst(this.bus.ctx, this.bus.bus('effects'), this.white, { peak: Math.min(0.25, 0.04 * v), decay: 0.12, filter: { type: 'lowpass', frequency: 320 }, rate: 0.6 }); }
  boo() {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('effects'), t = ctx.currentTime;
    // "BOOO": a buzzy voice through an "oo" formant, falling; a whoosh under it
    playTone(ctx, out, { type: 'sawtooth', pitch: [[0, 150], [0.12, 175], [0.6, 105]], peak: 0.32, attack: 0.02, decay: 0.6, filter: { type: 'bandpass', frequency: 420, Q: 2.5 }, when: t });
    playTone(ctx, out, { type: 'square', pitch: [[0, 75], [0.6, 52]], peak: 0.12, attack: 0.02, decay: 0.55, filter: { type: 'lowpass', frequency: 300 }, when: t });
    playNoiseBurst(ctx, out, this.pink, { peak: 0.35, attack: 0.04, decay: 0.45, filter: { type: 'bandpass', frequency: 700, Q: 0.8 }, rate: 0.7 });
  }
  scared(n = 1) {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('effects'), t = ctx.currentTime;
    for (let k = 0; k < Math.min(3, n); k++) playTone(ctx, out, { type: 'triangle', pitch: [[0, 600 + k * 90], [0.25, 1500 + k * 120]], peak: 0.06, attack: 0.01, decay: 0.3, when: t + 0.12 + k * 0.1, pan: (k - 1) * 0.6 });
  }
  moan() {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('effects'), t = ctx.currentTime, f = 210 + Math.random() * 60;
    const pts = []; for (let k = 0; k <= 12; k++) pts.push([k * 0.11, f * (1 + 0.25 * Math.sin(k * 0.55)) * (1 + 0.02 * Math.sin(k * 3))]);
    pts[0][0] = 0;
    playTone(ctx, out, { type: 'sine', pitch: pts, peak: 0.07, attack: 0.3, decay: 1.1, filter: { type: 'lowpass', frequency: 900 }, when: t, pan: Math.random() - 0.5 });
  }
  caught() {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('effects'), t = ctx.currentTime;
    playTone(ctx, out, { type: 'square', pitch: [[0, 420], [0.18, 300], [0.36, 330], [0.6, 180]], peak: 0.1, decay: 0.62, filter: { type: 'lowpass', frequency: 1300 }, when: t });
    for (let k = 0; k < 5; k++) playTone(ctx, this.bus.bus('ui'), { type: 'triangle', pitch: [[0, hz(84 - k * 2)]], peak: 0.05, decay: 0.12, when: t + 0.05 + k * 0.05 });
  }
  bell(count = 1, gap = 1.1, base = 196) {
    if (!this.ready) return;
    const ctx = this.bus.ctx, out = this.bus.bus('effects'), t = ctx.currentTime;
    for (let n = 0; n < count; n++) {
      const w = t + n * gap;
      for (const [r, g, d] of [[0.5, 0.12, 3.5], [1, 0.2, 3], [2.0, 0.08, 2.2], [2.4, 0.07, 1.8], [3.0, 0.05, 1.4], [4.2, 0.03, 1.0]]) {
        playTone(ctx, out, { type: 'sine', pitch: [[0, base * r]], peak: g, attack: 0.004, decay: d, when: w });
      }
    }
  }
  tick(high = false) { if (!this.ready) return; playTone(this.bus.ctx, this.bus.bus('ui'), { type: 'square', pitch: [[0, high ? 1500 : 1100]], peak: 0.05, decay: 0.05, filter: { type: 'lowpass', frequency: 3000 } }); }
  ui() { if (!this.ready) return; playTone(this.bus.ctx, this.bus.bus('ui'), { type: 'triangle', pitch: [[0, 660], [0.06, 990]], peak: 0.08, decay: 0.12 }); }
  regrow() { if (!this.ready) return; playTone(this.bus.ctx, this.bus.bus('effects'), { type: 'sine', pitch: [[0, 220], [0.3, 440]], peak: 0.03, attack: 0.05, decay: 0.3 }); }
}
