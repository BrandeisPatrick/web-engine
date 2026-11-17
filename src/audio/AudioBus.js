// AudioBus — WebAudio context lifecycle + mixer.
//
//   const bus = new AudioBus({ volume: 0.7 });
//   bus.unlockOnGesture();                 // or call bus.start() inside your own keydown / pointerdown handler
//   bus.onStart((ctx) => buildGraph(ctx)); // runs once, synchronously, as soon as the context exists
//   voice.connect(bus.bus('effects'));     // buses: engine, effects, ambience, ui (+ any name, created on demand)
//   bus.setMuted(true); bus.toggleMute(); bus.setVolume(0.5); bus.setBusVolume('ambience', 0.3);
//   const send = bus.reverbSend(node, 0.2); // simple algorithmic reverb (created lazily)
//
// Graph: bus gains -> master gain -> compressor -> destination; reverb return -> master.
// Safe to import in Node (no AudioContext until start()).
//
// Options that change nothing unless given:
//   new AudioBus({ master: 'safe' })     // the sound kit's master chain (below); the default chain is unchanged
//   new AudioBus({ context: offlineCtx }) // use this context instead of creating one (an OfflineAudioContext for the
//                                         // self-test, or a fake one in tests); start() then needs no gesture
//   bus.setPaused(true, 0.15);            // fade every bus but the dry ones ('ui') to silence, and back
//   bus.setMuffle(0..1);                  // low-pass the world buses: cut-off 20000 * 0.03^z Hz (a hit, under water)
//   bus.duck('ambience', 0.5, 3.5);       // drop a bus to 0.5 of its volume, recover at rate 3.5 per second
// 'safe' graph: world buses -> muffle low-pass -> sum; dry buses ('ui') -> sum; sum -> compressor (SAFE_MASTER) ->
// make-up gain -> soft clipper (linear to 0.6, then 0.6 + 0.4 tanh((x - 0.6) / 0.4)) -> volume -> destination. In
// 'safe' mode the context is also suspended while the tab is hidden. In the default mode setMuffle() inserts its
// low-pass on first use; setPaused() and duck() work on the bus gains in both modes.

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export const DEFAULT_BUSES = ['engine', 'effects', 'ambience', 'ui'];

/**
 * The 'safe' master chain's settings (AudioBus({ master: 'safe', safe: {...} }) overrides any of them).
 * @typedef {object} SafeMasterSettings
 * @property {number} threshold  compressor threshold, dB
 * @property {number} knee  dB
 * @property {number} ratio
 * @property {number} attack  s
 * @property {number} release  s
 * @property {number} makeup  gain after the compressor
 * @property {number} clip  where the soft clipper leaves linear (0..1)
 */
/** @type {SafeMasterSettings} */
// makeup 1: Chrome's DynamicsCompressorNode already adds its own make-up gain (about +1.8 dB at these settings)
export const SAFE_MASTER = Object.freeze({ threshold: -12, knee: 6, ratio: 4, attack: 0.003, release: 0.15, makeup: 1, clip: 0.6 });

/**
 * Soft-clipper curve for a WaveShaper fed with x / 2 (so inputs up to +-2 are shaped): linear to `clip`, then
 * clip + (1 - clip) tanh((|x| - clip) / (1 - clip)).
 * @param {number} [clip=0.6]
 * @param {number} [n=2048]
 * @returns {Float32Array}
 */
export function safeClipCurve(clip = 0.6, n = 2048) {
  const c = new Float32Array(n), r = 1 - clip;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= clip ? a : clip + r * Math.tanh((a - clip) / r));
  }
  return c;
}

export class AudioBus {
  /**
   * @param {object} [o]
   * @param {number} [o.volume=0.7]  master volume 0..1
   * @param {string[]} [o.buses]     bus names created at start
   * @param {object|null} [o.compressor]  DynamicsCompressor settings (null = none)
   * @param {number} [o.reverbSeconds=2.4]  impulse length of the reverb send
   * @param {string} [o.latencyHint='interactive']
   * @param {'default'|'safe'} [o.master='default']  'safe': compressor, make-up gain, soft clipper, volume (SAFE_MASTER)
   * @param {Partial<SafeMasterSettings>} [o.safe]  overrides of SAFE_MASTER
   * @param {BaseAudioContext} [o.context]  use this context (e.g. an OfflineAudioContext) instead of creating one
   * @param {string[]} [o.dryBuses=['ui']]  buses that setPaused / setMuffle leave alone
   */
  constructor(o = {}) {
    this.ctx = null;
    this.volume = o.volume ?? 0.7;
    this.muted = false;
    this.busNames = o.buses || DEFAULT_BUSES;
    this.compressorSettings = o.compressor === undefined ? { threshold: -14, knee: 12, ratio: 4, attack: 0.005, release: 0.2 } : o.compressor;
    this.reverbSeconds = o.reverbSeconds ?? 2.4;
    this.latencyHint = o.latencyHint || 'interactive';
    this.master = null;
    this.compressor = null;
    this.buses = {};
    this._busVolume = {};
    this._reverb = null;
    this._onStart = [];
    this._unlock = null;
    this.mode = o.master === 'safe' ? 'safe' : 'default';
    this.safeSettings = { ...SAFE_MASTER, ...(o.safe || {}) };
    this.dryBuses = o.dryBuses || ['ui'];
    this._context = o.context || null;
    /** Final volume node of the 'safe' chain (null in the default mode, where `master` carries the volume). */
    this.output = null;
    this.paused = false;
    this.muffle = 0;
    this._muffle = null;
    this._onVis = null;
    this._hiddenSuspended = false;
  }

  /** True when the context renders offline (an injected OfflineAudioContext): it is never 'running' between steps. */
  get offline() { return !!this.ctx && typeof (/** @type {any} */ (this.ctx)).startRendering === 'function'; }
  /** Running, or an offline context: when per-frame code may schedule sound. */
  get live() { return this.running || this.offline; }

  get started() { return !!this.ctx; }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Must be called from a user gesture. Safe to call repeatedly. Resolves true when running. */
  start() {
    if (this._context && !this.ctx) {
      this.ctx = /** @type {AudioContext} */ (this._context);
      this._buildMaster();
      const cbs = this._onStart; this._onStart = [];
      for (const cb of cbs) cb(this.ctx, this);
    }
    if (this._context) return this.offline || this.ctx.state === 'running' || !this.ctx.resume ? Promise.resolve(true) : this.ctx.resume().then(() => true, () => false);
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return Promise.resolve(false);
    if (!this.ctx) {
      this.ctx = new AC({ latencyHint: this.latencyHint });
      this._buildMaster();
      const cbs = this._onStart; this._onStart = [];
      for (const cb of cbs) cb(this.ctx, this);
    }
    if (this.ctx.state !== 'running') return this.ctx.resume().then(() => true, () => false);
    return Promise.resolve(true);
  }

  /** Run cb(ctx, bus) once the context exists (immediately if it already does). */
  onStart(cb) { if (this.ctx) cb(this.ctx, this); else this._onStart.push(cb); return this; }

  /** Start on the first keydown / pointerdown / touchend on target. Returns a remover. */
  unlockOnGesture(target = typeof window !== 'undefined' ? window : null) {
    if (!target || this._unlock) return this._unlock || (() => {});
    const evs = ['keydown', 'pointerdown', 'touchend'];
    const go = () => { this.start(); off(); };
    const off = () => { for (const e of evs) target.removeEventListener(e, go); this._unlock = null; };
    for (const e of evs) target.addEventListener(e, go);
    this._unlock = off;
    return off;
  }

  _buildMaster() {
    if (this.mode === 'safe') { this._buildSafe(); return; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    let out = ctx.destination;
    const c = this.compressorSettings;
    if (c) {
      const comp = this.compressor = ctx.createDynamicsCompressor();
      comp.threshold.value = c.threshold; comp.knee.value = c.knee; comp.ratio.value = c.ratio;
      comp.attack.value = c.attack; comp.release.value = c.release;
      comp.connect(ctx.destination);
      out = comp;
    }
    this.master.connect(out);
    for (const name of this.busNames) this.bus(name);
    this._applyMaster();
  }

  _buildSafe() {
    const ctx = this.ctx, s = this.safeSettings;
    this.master = ctx.createGain();                     // the sum of every bus
    const comp = this.compressor = ctx.createDynamicsCompressor();
    comp.threshold.value = s.threshold; comp.knee.value = s.knee; comp.ratio.value = s.ratio;
    comp.attack.value = s.attack; comp.release.value = s.release;
    const makeup = ctx.createGain(); makeup.gain.value = s.makeup * 0.5; // x 0.5: the clipper curve spans +-2
    const clip = ctx.createWaveShaper(); clip.curve = safeClipCurve(s.clip); clip.oversample = '2x';
    this.output = ctx.createGain(); this.output.gain.value = 0;
    this.master.connect(comp); comp.connect(makeup); makeup.connect(clip); clip.connect(this.output); this.output.connect(ctx.destination);
    this._ensureMuffle();
    for (const name of this.busNames) this.bus(name);
    this._applyMaster();
    if (!this.offline && typeof document !== 'undefined' && document.addEventListener) {
      this._onVis = () => {
        if (!this.ctx || this.offline) return;
        if (document.hidden && this.ctx.state === 'running') { this._hiddenSuspended = true; this.ctx.suspend(); }
        else if (!document.hidden && this._hiddenSuspended) { this._hiddenSuspended = false; this.ctx.resume(); }
      };
      document.addEventListener('visibilitychange', this._onVis);
    }
  }

  _isDry(name) { return this.dryBuses.includes(name); }
  /** Where a bus connects: the muffle filter for world buses once it exists, else the master sum. */
  _busOut(name) { return this._muffle && !this._isDry(name) ? this._muffle : this.master; }
  /** The gain a bus should sit at now (its volume, 0 while paused unless dry). */
  _busTarget(name) { return this.paused && !this._isDry(name) ? 0 : this._busVolume[name] ?? 1; }

  _ensureMuffle() {
    if (this._muffle || !this.ctx) return this._muffle;
    const f = this._muffle = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 0.5; f.frequency.value = 20000 * Math.pow(0.03, this.muffle);
    f.connect(this.master);
    for (const name in this.buses) if (!this._isDry(name)) { const g = this.buses[name]; try { g.disconnect(this.master); } catch { /* not connected */ } g.connect(f); }
    return f;
  }

  /** GainNode of a named bus (created on demand once started; null before start). */
  bus(name) {
    if (!this.ctx) return null;
    let g = this.buses[name];
    if (!g) {
      g = this.buses[name] = this.ctx.createGain();
      g.gain.value = this._busTarget(name);
      g.connect(this._busOut(name));
    }
    return g;
  }

  setBusVolume(name, v, tc = 0.05) {
    this._busVolume[name] = clamp(+v || 0, 0, 2);
    const g = this.ctx && this.bus(name);
    if (g) g.gain.setTargetAtTime(this._busTarget(name), this.ctx.currentTime, tc);
  }

  /**
   * Fade every bus except the dry ones ('ui') to silence (paused) or back to its volume.
   * @param {boolean} on
   * @param {number} [fade=0.15]  seconds (about three time constants)
   */
  setPaused(on, fade = 0.15) {
    this.paused = !!on;
    if (!this.ctx) return this;
    const t = this.ctx.currentTime;
    for (const name in this.buses) {
      if (this._isDry(name)) continue;
      const p = this.buses[name].gain;
      p.cancelScheduledValues(t); p.setTargetAtTime(this._busTarget(name), t, Math.max(0.001, fade / 3));
    }
    return this;
  }

  /**
   * Low-pass the world buses (every bus except the dry ones): 0 = open (20 kHz), 1 = 600 Hz. Cut-off 20000 * 0.03^z.
   * @param {number} z  0..1
   * @param {number} [tc=0.08]  smoothing time constant, s
   */
  setMuffle(z, tc = 0.08) {
    this.muffle = clamp(+z || 0, 0, 1);
    if (!this.ctx || (!this._muffle && this.muffle === 0)) return this;
    const f = this._ensureMuffle();
    f.frequency.setTargetAtTime(20000 * Math.pow(0.03, this.muffle), this.ctx.currentTime, tc);
    return this;
  }

  /**
   * Duck a bus: drop it to `to` times its volume now, then recover exponentially at `recoverPerSec` (time constant
   * 1 / recoverPerSec). Ignored while paused or before start.
   * @param {string} name
   * @param {number} [to=0.5]  0..1
   * @param {number} [recoverPerSec=3.5]
   */
  duck(name, to = 0.5, recoverPerSec = 3.5) {
    if (!this.ctx || (this.paused && !this._isDry(name))) return this;
    const p = this.bus(name).gain, t = this.ctx.currentTime, base = this._busTarget(name);
    p.cancelScheduledValues(t);
    p.setTargetAtTime(base * clamp(to, 0, 1), t, 0.01);
    p.setTargetAtTime(base, t + 0.04, 1 / Math.max(0.01, recoverPerSec));
    return this;
  }
  getBusVolume(name) { return this._busVolume[name] ?? 1; }

  setMuted(m) { this.muted = !!m; this._applyMaster(); }
  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  setVolume(v) { this.volume = clamp(+v || 0, 0, 1); this._applyMaster(); }

  _applyMaster() {
    if (!this.ctx || !this.master) return;
    const g = this.muted ? 0 : this.volume;
    (this.output || this.master).gain.setTargetAtTime(g, this.ctx.currentTime, 0.05);
  }

  /** Reverb input node (ConvolverNode with a generated stereo impulse), created on first use. */
  get reverb() {
    if (!this.ctx) return null;
    if (!this._reverb) {
      const ctx = this.ctx, sr = ctx.sampleRate, len = Math.max(1, Math.floor(sr * this.reverbSeconds));
      const ir = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
        }
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const ret = ctx.createGain(); ret.gain.value = 0.9;
      conv.connect(ret).connect(this.master);
      this._reverb = conv;
    }
    return this._reverb;
  }

  /** Route `node` into the reverb at `amount` (returns the send GainNode for later changes). */
  reverbSend(node, amount = 0.2) {
    const r = this.reverb;
    if (!r) return null;
    const g = this.ctx.createGain();
    g.gain.value = amount;
    node.connect(g).connect(r);
    return g;
  }

  suspend() { return this.ctx ? this.ctx.suspend() : Promise.resolve(); }
  resume() { return this.ctx ? this.ctx.resume() : Promise.resolve(); }

  dispose() {
    if (this._unlock) this._unlock();
    if (this._onVis) { document.removeEventListener('visibilitychange', this._onVis); this._onVis = null; }
    if (this.ctx && this.ctx.close && !this._context) this.ctx.close();
    this.ctx = null; this.master = null; this.buses = {}; this._reverb = null; this.output = null; this._muffle = null;
  }
}
