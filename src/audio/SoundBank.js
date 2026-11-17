// SoundBank: the sound kit's named sounds (presets.js) played through an AudioBus with a voice policy (VoicePool),
// per-play variation and optional 3D position.
//
//   const bus = new AudioBus({ master: 'safe' }); bus.unlockOnGesture();
//   const sfx = new SoundBank(bus, { listener: camera });       // seed: 1, maxVoices: 24
//   sfx.play('impact.metal', { at: post.position, gain: 0.8 }); // -> voice { playing, stop(fade), setGain, setRate }
//   const hum = sfx.loop('lamp.hum', { at: lamp });              // -> { setGain(g), setRate(r), stop(fade), playing }
//   sfx.update(dt);                                              // per frame: listener and moving voices follow
//
// play() before the bus has started (no gesture yet) returns an inert voice (playing false, methods no-ops), never
// null. loop() before the start returns a live handle that begins (fading in) when the bus starts, keeping the gain
// and rate set on it meanwhile. Unknown names throw, listing the known ones.
// Per play: a variant round-robin (skipping one 30 % of the time), pitch jitter (preset `jitter`, default +-3.5 %;
// UI sounds +-1 %) and gain -0..8 %; all from the bank's seeded generator. `at`: an Object3D (followed while it plays),
// a { x, y, z } or an [x, y, z]; it routes the voice through a PannerNode (inverse distance, the preset's refDistance
// and rolloff, equal-power panning). Buffers are rendered on first use (a few ms per variant) and cached.
// bank.render(name, variant) is the finished Float32Array (runs in Node); bank.define(name, spec) adds a sound.
import { AudioListener3D } from './Positional.js';
import { SOUND_PRESETS, renderPreset, PRESET_SAMPLE_RATE } from './presets.js';
import { VoicePool } from './VoicePool.js';
import { rng } from './dsp.js';

const noop = function () { return this; };

/**
 * @typedef {object} SoundVoice  what play() returns
 * @property {boolean} playing
 * @property {string} name
 * @property {(fade?: number) => SoundVoice} stop  stop now, or fade out over `fade` s
 * @property {(g: number, t?: number) => SoundVoice} setGain  at once, or ramped over `t` s
 * @property {(r: number) => SoundVoice} setRate  playback rate (1 = as rendered)
 */

/**
 * @typedef {object} LoopHandle  what loop() returns
 * @property {boolean} playing  false once stopped (true while waiting for the bus to start)
 * @property {string} name
 * @property {(g: number, tc?: number) => LoopHandle} setGain  smoothed (time constant tc, default 0.08 s)
 * @property {(r: number, tc?: number) => LoopHandle} setRate  smoothed (default 0.05 s)
 * @property {(fade?: number) => LoopHandle} stop  fade out (default 0.3 s) and end
 */

/**
 * @typedef {import('three').Object3D | { x: number, y: number, z: number } | number[]} SoundPosition
 */

/** The voice play() returns while nothing can play.
 * @type {SoundVoice} */
export const INERT_VOICE = Object.freeze({ playing: false, name: '', stop: noop, setGain: noop, setRate: noop });

function readPos(at, out) {
  if (Array.isArray(at)) { out[0] = at[0]; out[1] = at[1]; out[2] = at[2]; return out; }
  const o = /** @type {any} */ (at);
  if (o.matrixWorld) { o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements; out[0] = e[12]; out[1] = e[13]; out[2] = e[14]; return out; }
  out[0] = o.x; out[1] = o.y; out[2] = o.z; return out;
}
const _p = [0, 0, 0];

class BankVoice {
  constructor(bank, name, src, gain, panner, follow) {
    this.bank = bank; this.name = name; this.source = src; this.gain = gain; this.panner = panner; this.follow = follow;
    this.playing = true;
    src.onended = () => this._end();
  }
  stop(fade = 0) {
    if (!this.playing) return this;
    const ctx = this.source.context, t = ctx.currentTime;
    if (fade > 0) {
      const g = this.gain.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade);
      try { this.source.stop(t + fade + 0.005); } catch { /* not started */ }
    } else { try { this.source.stop(); } catch { /* not started */ } }
    this._release();
    return this;
  }
  setGain(g, t = 0) {
    const p = this.gain.gain, now = this.source.context.currentTime;
    p.cancelScheduledValues(now);
    if (t > 0) { p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(g, now + t); } else p.setValueAtTime(g, now);
    return this;
  }
  setRate(r) { this.source.playbackRate.setValueAtTime(r, this.source.context.currentTime); return this; }
  /** Leave the pool (the voice may still be fading out). */
  _release() { if (this.bank) { this.bank.pool.remove(this); this.bank._followers.delete(this); } this.playing = false; }
  _end() {
    this._release();
    this.source.onended = null;
    try { this.source.disconnect(); this.gain.disconnect(); if (this.panner) this.panner.disconnect(); } catch { /* gone */ }
    this.bank = null;
  }
}

class BankLoop {
  constructor(bank, name, o) {
    this.bank = bank; this.name = name; this.o = o;
    this.gainValue = o.gain ?? 1; this.rateValue = o.rate ?? 1;
    this.playing = true; this.voice = null;
  }
  _realise() {
    if (!this.playing || this.voice) return;
    this.voice = this.bank._start(this.name, this.o, true, this.gainValue, this.rateValue);
  }
  setGain(g, tc = 0.08) {
    this.gainValue = g;
    const v = this.voice;
    if (v) v.gain.gain.setTargetAtTime(g, v.source.context.currentTime, tc);
    return this;
  }
  setRate(r, tc = 0.05) {
    this.rateValue = r;
    const v = this.voice;
    if (v) v.source.playbackRate.setTargetAtTime(r, v.source.context.currentTime, tc);
    return this;
  }
  stop(fade = 0.3) {
    if (!this.playing) return this;
    this.playing = false;
    if (this.voice) this.voice.stop(fade);
    this.bank._loops.delete(this);
    return this;
  }
}

export class SoundBank {
  /**
   * @param {import('./AudioBus.js').AudioBus} bus
   * @param {object} [o]
   * @param {import('three').Object3D} [o.listener]  the camera: the context's listener follows it in update()
   * @param {number} [o.seed=1]  renders and per-play variation are deterministic per seed
   * @param {number} [o.maxVoices=24]  one-shot voices at once (loops are not counted)
   * @param {number} [o.sampleRate=44100]  render rate
   * @param {Record<string, import('./presets.js').SoundPreset>} [o.presets]  extra or replacement presets
   */
  constructor(bus, { listener = null, seed = 1, maxVoices = 24, sampleRate = PRESET_SAMPLE_RATE, presets = null } = {}) {
    this.bus = bus;
    this.listenerObject = listener;
    this.seed = seed;
    this.sampleRate = sampleRate;
    /** @type {Record<string, import('./presets.js').SoundPreset>} */
    this.presets = { ...SOUND_PRESETS, ...(presets || {}) };
    this.pool = new VoicePool({ max: maxVoices });
    this._rand = rng(seed * 7919 + 17);
    this._rr = {};
    this._buffers = new Map();
    /** @type {Set<BankLoop>} */
    this._loops = new Set();
    /** @type {Set<BankVoice>} */
    this._followers = new Set();
    this._listener = null;
    bus.onStart((ctx) => {
      this._listener = new AudioListener3D(ctx);
      for (const l of this._loops) l._realise();
    });
  }

  /** Names of every sound this bank knows. */
  get names() { return Object.keys(this.presets); }
  /** One-shot voices sounding now. */
  get voices() { return this.pool.size; }

  /**
   * Add or replace a sound. Missing fields default to a one-shot of 1 s, 1 variant, bus 'effects', peak 0.5.
   * @param {string} name
   * @param {Partial<import('./presets.js').SoundPreset> & { render: (c: import('./presets.js').RenderContext) => Float32Array }} spec
   */
  define(name, spec) {
    if (!spec || typeof spec.render !== 'function') throw new Error(`SoundBank.define('${name}'): spec.render(c) must return a Float32Array`);
    this.presets[name] = { variants: 1, bus: 'effects', peak: 0.5, centroid: [20, 20000], seconds: 1, kind: 'shot', ...spec };
    for (const k of [...this._buffers.keys()]) if (k.startsWith(`${name}#`)) this._buffers.delete(k);
    return this;
  }

  _spec(name) {
    const s = this.presets[name];
    if (!s) throw new Error(`SoundBank: no sound '${name}' (have: ${this.names.join(', ')})`);
    return s;
  }

  /**
   * The finished samples of one variant (mono, at `sampleRate`); runs without Web Audio.
   * @param {string} name
   * @param {number} [variant=0]
   * @returns {Float32Array}
   */
  render(name, variant = 0) { return renderPreset(this._spec(name), name, variant, { seed: this.seed, sampleRate: this.sampleRate }); }

  _buffer(name, variant) {
    const key = `${name}#${variant}`;
    let b = this._buffers.get(key);
    if (!b) {
      const x = this.render(name, variant), ctx = this.bus.ctx;
      b = ctx.createBuffer(1, x.length, this.sampleRate);
      if (b.copyToChannel) b.copyToChannel(x, 0); else b.getChannelData(0).set(x);
      this._buffers.set(key, b);
    }
    return b;
  }

  _variant(name, spec) {
    const n = spec.variants || 1;
    if (n === 1) return 0;
    let v = ((this._rr[name] ?? -1) + 1) % n;
    if (n > 2 && this._rand() < 0.3) v = (v + 1) % n;
    this._rr[name] = v;
    return v;
  }

  _start(name, o, loop, gain, rate) {
    const spec = this._spec(name), ctx = this.bus.ctx;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = this._buffer(name, loop ? 0 : this._variant(name, spec));
    src.loop = loop;
    src.playbackRate.value = rate;
    const t = ctx.currentTime + Math.max(0, o.delay || 0);
    if (loop) { g.gain.value = 0; g.gain.setTargetAtTime(gain, t, (o.fadeIn ?? 0.3) / 3); } else g.gain.value = gain;
    let panner = null, follow = null;
    if (o.at) {
      panner = ctx.createPanner();
      panner.panningModel = o.panningModel || 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = o.refDistance ?? spec.refDistance ?? 4;
      panner.rolloffFactor = spec.rolloff ?? 1;
      panner.maxDistance = 1000;
      readPos(o.at, _p);
      if (panner.positionX) { panner.positionX.value = _p[0]; panner.positionY.value = _p[1]; panner.positionZ.value = _p[2]; } else panner.setPosition(_p[0], _p[1], _p[2]);
      if (/** @type {any} */ (o.at).matrixWorld) follow = o.at;
      src.connect(g).connect(panner).connect(this.bus.bus(o.bus || spec.bus || 'effects'));
    } else src.connect(g).connect(this.bus.bus(o.bus || spec.bus || 'effects'));
    const v = new BankVoice(this, name, src, g, panner, follow);
    if (follow) this._followers.add(v);
    src.start(t, loop ? (o.offset ?? 0) : 0);
    return v;
  }

  /**
   * Play a one-shot (a loop preset plays once through). Returns the voice, or INERT_VOICE before the bus started or
   * when the voice policy refuses it.
   * @param {string} name
   * @param {{ at?: SoundPosition, gain?: number, rate?: number, bus?: string, delay?: number, refDistance?: number, panningModel?: PanningModelType }} [o]
   * @returns {SoundVoice}
   */
  play(name, o = {}) {
    const spec = this._spec(name);
    if (!this.bus.ctx || !this.bus.bus(spec.bus || 'effects')) return INERT_VOICE;
    const pri = spec.priority ?? 5;
    const d = this.pool.admit(name, pri, spec.cap ?? 4);
    if (!d) return INERT_VOICE;
    if (d.steal) /** @type {BankVoice} */ (d.steal).stop(0.004);
    const j = spec.jitter ?? (spec.bus === 'ui' ? 0.01 : 0.035);
    const rate = (o.rate ?? 1) * (1 + j * (this._rand() * 2 - 1));
    const gain = (o.gain ?? spec.gain ?? 1) * (1 - 0.08 * this._rand());
    const v = this._start(name, o, false, gain, rate);
    this.pool.add(v, name, pri);
    return v;
  }

  /**
   * Start a loop (fading in over `fadeIn`, default 0.3 s). Before the bus has started the handle waits and begins
   * on start.
   * @param {string} name
   * @param {{ at?: SoundPosition, gain?: number, rate?: number, bus?: string, fadeIn?: number, offset?: number, refDistance?: number, panningModel?: PanningModelType }} [o]
   * @returns {LoopHandle}
   */
  loop(name, o = {}) {
    this._spec(name);
    const l = new BankLoop(this, name, { ...o, gain: o.gain ?? this.presets[name].gain ?? 1 });
    this._loops.add(l);
    if (this.bus.ctx) l._realise();
    return l;
  }

  /**
   * Per frame (no allocation): the listener follows the camera, voices playing at an Object3D follow it.
   * @param {number} [dt]
   */
  update(dt = 0) { // eslint-disable-line no-unused-vars -- dt kept for the per-frame signature
    const ctx = this.bus.ctx;
    if (!ctx) return;
    if (this._listener && this.listenerObject) this._listener.update(this.listenerObject);
    const t = ctx.currentTime;
    for (const v of this._followers) {
      readPos(v.follow, _p);
      const p = v.panner;
      if (p.positionX) { p.positionX.setTargetAtTime(_p[0], t, 0.02); p.positionY.setTargetAtTime(_p[1], t, 0.02); p.positionZ.setTargetAtTime(_p[2], t, 0.02); } else p.setPosition(_p[0], _p[1], _p[2]);
    }
  }

  /** Stop every one-shot and loop (fading over `fade` s). */
  stopAll(fade = 0.1) {
    for (const v of [...this.pool.voices]) /** @type {BankVoice} */ (v).stop(fade);
    for (const l of [...this._loops]) l.stop(fade);
  }

  dispose() { this.stopAll(0); this._buffers.clear(); this._followers.clear(); }
}
