// Measured mix: render a scripted scene through an AudioBus in an OfflineAudioContext (as fast as the machine can,
// no speakers) and check the result against fixed limits. The analysis (analyseMix) is plain JavaScript and runs in
// Node; audioSelfTest needs a browser.
//
//   const r = await audioSelfTest({
//     seconds: 10,
//     build(bus) {                                  // bus: AudioBus({ master: 'safe', context: <offline> })
//       const sfx = new SoundBank(bus); sfx.loop('amb.dusk', { gain: 0.5 });
//       return (t, dt) => { if (t >= 2 && !hit) { hit = true; sfx.play('impact.wood'); } };   // per step, 60 Hz
//     },
//   });
//   r.ok, r.failures, r.peak, r.clipped, r.nan, r.dc, r.loudness (dBFS per 0.5 s), r.samples ([left, right])
//   const wav = encodeWav(r.samples, r.sampleRate);                // dsp.js
//
// Game code steps inside the render: the context is suspended at every step time (ctx.suspend(t), all scheduled up
// front, 1 / stepHz apart), the step function runs, and rendering resumes. Limits (MIX_LIMITS): no NaN, no sample at
// or over 1 (clipped), peak at most 0.85, no half-second quieter than -60 dBFS (silent), none more than 12 dB over the
// median half-second, |DC| under 0.01.
import { AudioBus } from './AudioBus.js';

/**
 * @typedef {object} MixLimits
 * @property {number} peak  largest |sample| allowed
 * @property {number} clipped  samples at or over 1 allowed
 * @property {number} silentDb  a half-second below this (dBFS RMS) is silent
 * @property {number} overMedianDb  a half-second this far over the median fails
 * @property {number} dc  largest |mean| per channel
 */
/** @type {MixLimits} */
export const MIX_LIMITS = Object.freeze({ peak: 0.85, clipped: 0, silentDb: -60, overMedianDb: 12, dc: 0.01 });

/**
 * @typedef {object} MixReport
 * @property {boolean} ok
 * @property {string[]} failures  one line per broken limit
 * @property {number} peak
 * @property {number} clipped  samples with |x| >= 1
 * @property {number} nan  samples that are not finite
 * @property {number} dc  largest |mean| of a channel
 * @property {number[]} loudness  RMS dBFS of each 0.5 s window (both channels)
 * @property {number} median  median of `loudness`
 * @property {number} quietest  dBFS
 * @property {number} loudest  dBFS
 */

/**
 * Measure a rendered mix against limits.
 * @param {Float32Array[]} channels
 * @param {number} sampleRate
 * @param {Partial<MixLimits>} [limits]
 * @returns {MixReport}
 */
export function analyseMix(channels, sampleRate, limits = {}) {
  const L = { ...MIX_LIMITS, ...limits }, n = channels[0].length;
  let peak = 0, clipped = 0, nan = 0, dc = 0;
  for (const x of channels) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = x[i];
      if (!Number.isFinite(v)) { nan++; continue; }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= 1) clipped++;
      sum += v;
    }
    dc = Math.max(dc, Math.abs(sum / (n || 1)));
  }
  const win = Math.round(sampleRate * 0.5), loudness = [];
  for (let s = 0; s + win <= n; s += win) {
    let sq = 0;
    for (const x of channels) for (let i = s; i < s + win; i++) { const v = x[i]; if (Number.isFinite(v)) sq += v * v; }
    const rms = Math.sqrt(sq / (win * channels.length));
    loudness.push(rms > 1e-6 ? +(20 * Math.log10(rms)).toFixed(2) : -120);
  }
  const sorted = [...loudness].sort((a, b) => a - b);
  const median = sorted.length ? sorted[sorted.length >> 1] : -120;
  const quietest = sorted.length ? sorted[0] : -120, loudest = sorted.length ? sorted[sorted.length - 1] : -120;
  const failures = [];
  if (nan) failures.push(`${nan} samples are NaN or infinite`);
  if (clipped > L.clipped) failures.push(`${clipped} samples clipped (|x| >= 1)`);
  if (peak > L.peak) failures.push(`peak ${peak.toFixed(3)} over ${L.peak}`);
  if (dc > L.dc) failures.push(`DC ${dc.toFixed(4)} over ${L.dc}`);
  loudness.forEach((db, i) => {
    if (db < L.silentDb) failures.push(`silent half-second at ${(i * 0.5).toFixed(1)} s (${db} dBFS)`);
    if (db > median + L.overMedianDb) failures.push(`half-second at ${(i * 0.5).toFixed(1)} s is ${(db - median).toFixed(1)} dB over the median (${db} vs ${median} dBFS)`);
  });
  return { ok: failures.length === 0, failures, peak, clipped, nan, dc, loudness, median, quietest, loudest };
}

/**
 * @typedef {MixReport & { samples: Float32Array[], sampleRate: number, seconds: number, renderMs: number }} SelfTestReport
 */

/**
 * Render a scripted scene offline through a fresh AudioBus and measure it (browser only: needs OfflineAudioContext).
 * @param {object} o
 * @param {(bus: AudioBus, ctx: OfflineAudioContext) => (void | ((t: number, dt: number) => void) | Promise<void | ((t: number, dt: number) => void)>)} o.build
 *   make the scene's sound objects on `bus` (before it starts); return the per-step function, if any
 * @param {number} [o.seconds=10]
 * @param {number} [o.sampleRate=48000]
 * @param {number} [o.stepHz=60]  game steps per second inside the render
 * @param {'safe'|'default'} [o.master='safe']
 * @param {number} [o.volume=1]  master volume (1: the loudest a player can set)
 * @param {Partial<MixLimits>} [o.limits]
 * @returns {Promise<SelfTestReport>}
 */
export async function audioSelfTest({ build, seconds = 10, sampleRate = 48000, stepHz = 60, master = 'safe', volume = 1, limits } = /** @type {any} */ ({})) {
  const OAC = globalThis.OfflineAudioContext || /** @type {any} */ (globalThis).webkitOfflineAudioContext;
  if (!OAC) throw new Error('audioSelfTest needs OfflineAudioContext (a browser)');
  const t0 = performance.now();
  const ctx = new OAC(2, Math.round(seconds * sampleRate), sampleRate);
  const bus = new AudioBus({ master, context: ctx, volume });
  const step = await build(bus, ctx);
  await bus.start();
  if (typeof step === 'function') {
    const dt = 1 / stepHz;
    step(0, 0);
    for (let k = 1; k * dt < seconds - dt; k++) {
      ctx.suspend(k * dt).then(() => {
        try { step(ctx.currentTime, dt); } finally { ctx.resume(); }
      });
    }
  }
  const out = await ctx.startRendering();
  const samples = [];
  for (let c = 0; c < out.numberOfChannels; c++) samples.push(out.getChannelData(c));
  const report = analyseMix(samples, sampleRate, limits);
  bus.dispose();
  return { ...report, samples, sampleRate, seconds, renderMs: Math.round(performance.now() - t0) };
}
