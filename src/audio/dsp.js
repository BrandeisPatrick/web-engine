// DSP kit in plain JavaScript on Float32Arrays: what the sound presets (presets.js) are rendered with, and the
// measurements their tests and the mixer self-test use. No Web Audio here, so all of it runs in Node.
//
//   const rand = rng(seedFor(1, 'step.wood', 0));          // deterministic per (seed, name, variant)
//   const x = noise(n, rand, 'pink');                       // 'white' | 'pink' | 'brown'
//   biquad(x, sr, { type: 'bandpass', freq: 1200, Q: 0.8 });          // in place; freq may be a function of t (0..1)
//   envelope(x, sr, { attack: 0.002, decay: 0.05 });        // exponential decay, time constant `decay`
//   glide(out, sr, { f0: 140, f1: 60, tau: 0.03, amp: 0.5, decay: 0.05 });   // sine with a falling pitch, added
//   modes(out, sr, [{ f: 420, decay: 0.2, amp: 1 }, ...]);  // modal synthesis (decaying sines), added
//   crackle(out, sr, rand, { count: 30, spread: 0.12 });    // short noise grains, added
//   saturate(x, 1.5); removeDC(x); normalize(x, 0.5); edgeFades(x, sr);  // 0.3 ms in, 12 ms out
//   const loop = loopify(x, sr, 0.25);                       // equal-power crossfade: a seamless loop, shorter by 0.25 s
//   measure(x, sr) -> { peak, rms, dc, nan, maxStep, stepP99, first, last, centroid, seconds }
//   hashSamples(x) -> 'a1b2c3d4'; encodeWav(samples | [left, right], sampleRate) -> Uint8Array (16-bit PCM WAV)

/**
 * Seeded generator (mulberry32): a function returning floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a hash of a string (32 bit, unsigned).
 * @param {string} s
 * @returns {number}
 */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * The seed of one sound variant: the same (seed, name, variant) always renders the same samples.
 * @param {number} seed
 * @param {string} name
 * @param {number} variant
 */
export function seedFor(seed, name, variant) { return hashString(`${seed}|${name}|${variant}`); }

/** Sweep from a to b as t goes 0..1: a (b / a)^(t^k) (a and b > 0). */
export function sweep(a, b, t, k = 1) { return a * Math.pow(b / a, Math.pow(t < 0 ? 0 : t > 1 ? 1 : t, k)); }

/**
 * Noise of `n` samples.
 * @param {number} n
 * @param {() => number} rand
 * @param {'white'|'pink'|'brown'} [color='white']
 * @returns {Float32Array}
 */
export function noise(n, rand, color = 'white') {
  const x = new Float32Array(n);
  if (color === 'pink') { // Paul Kellet's filter (economy version), about -3 dB per octave
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = rand() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    }
  } else if (color === 'brown') { // leaky integrator, about -6 dB per octave above ~8 Hz
    let last = 0;
    for (let i = 0; i < n; i++) { last = (last + 0.02 * (rand() * 2 - 1)) / 1.02; x[i] = last * 3.5; }
  } else {
    for (let i = 0; i < n; i++) x[i] = rand() * 2 - 1;
  }
  return x;
}

/**
 * @typedef {object} BiquadOptions
 * @property {'lowpass'|'highpass'|'bandpass'|'peaking'|'lowshelf'|'highshelf'} [type='lowpass']
 * @property {number|((t: number) => number)} freq  Hz, or a function of t = 0..1 over the buffer (coefficients are
 *   recomputed every 32 samples)
 * @property {number} [Q=0.707]
 * @property {number} [gain=0]  dB (peaking and shelves)
 */

const _c = new Float64Array(5);
function coeffs(type, f, Q, gainDb, sr) {
  const w = 2 * Math.PI * Math.min(Math.max(f, 1), sr * 0.49) / sr, cw = Math.cos(w), sw = Math.sin(w);
  const alpha = sw / (2 * Math.max(Q, 1e-3)), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'highpass': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
    case 'peaking': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
    case 'lowshelf': case 'highshelf': {
      const s = type === 'lowshelf' ? 1 : -1, sq = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - s * (A - 1) * cw + sq); b1 = s * 2 * A * ((A - 1) - s * (A + 1) * cw); b2 = A * ((A + 1) - s * (A - 1) * cw - sq);
      a0 = (A + 1) + s * (A - 1) * cw + sq; a1 = -s * 2 * ((A - 1) + s * (A + 1) * cw); a2 = (A + 1) + s * (A - 1) * cw - sq;
      break;
    }
    default: b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; // lowpass
  }
  _c[0] = b0 / a0; _c[1] = b1 / a0; _c[2] = b2 / a0; _c[3] = a1 / a0; _c[4] = a2 / a0;
  return _c;
}

/**
 * Biquad filter (RBJ cookbook), in place. Returns x.
 * @param {Float32Array} x
 * @param {number} sr  sample rate
 * @param {BiquadOptions} o
 * @returns {Float32Array}
 */
export function biquad(x, sr, { type = 'lowpass', freq, Q = 0.707, gain = 0 }) {
  const n = x.length, moving = typeof freq === 'function';
  let c = coeffs(type, moving ? freq(0) : freq, Q, gain, sr);
  let b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    if (moving && (i & 31) === 0 && i) {
      c = coeffs(type, freq(i / n), Q, gain, sr); b0 = c[0]; b1 = c[1]; b2 = c[2]; a1 = c[3]; a2 = c[4];
    }
    const xi = x[i], y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

/**
 * Attack / decay envelope, in place: 0 before `delay`, a raised-cosine rise over `attack`, then exp(-t / decay).
 * @param {Float32Array} x
 * @param {number} sr
 * @param {{ attack?: number, decay: number, delay?: number }} o  seconds
 * @returns {Float32Array}
 */
export function envelope(x, sr, { attack = 0.001, decay, delay = 0 }) {
  const d0 = Math.round(delay * sr), na = Math.max(1, Math.round(attack * sr)), k = Math.exp(-1 / (decay * sr));
  let g = 1;
  for (let i = 0; i < x.length; i++) {
    const j = i - d0;
    if (j < 0) { x[i] = 0; continue; }
    if (j < na) { x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * j / na); continue; }
    x[i] *= g; g *= k;
  }
  return x;
}

/**
 * Add a sine whose pitch glides f(t) = f1 + (f0 - f1) e^(-t / tau), amplitude amp e^(-t / decay), from `delay`.
 * @param {Float32Array} out
 * @param {number} sr
 * @param {{ f0: number, f1: number, tau: number, amp?: number, decay: number, delay?: number, attack?: number }} o
 * @returns {Float32Array}
 */
export function glide(out, sr, { f0, f1, tau, amp = 1, decay, delay = 0, attack = 0.001 }) {
  const d0 = Math.round(delay * sr), na = Math.max(1, Math.round(attack * sr));
  let ph = 0;
  for (let i = d0; i < out.length; i++) {
    const t = (i - d0) / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t / tau);
    const a = amp * Math.exp(-t / decay) * (i - d0 < na ? 0.5 - 0.5 * Math.cos(Math.PI * (i - d0) / na) : 1);
    out[i] += a * Math.sin(ph);
    ph += 2 * Math.PI * f / sr;
  }
  return out;
}

/**
 * Modal synthesis: add sum of amp e^(-t / decay) sin(2 pi f t) from `delay` (each mode starts at phase 0: no click).
 * @param {Float32Array} out
 * @param {number} sr
 * @param {{ f: number, decay: number, amp?: number }[]} list
 * @param {number} [delay=0]  seconds
 * @returns {Float32Array}
 */
export function modes(out, sr, list, delay = 0) {
  const d0 = Math.round(delay * sr);
  for (const m of list) {
    const w = 2 * Math.PI * m.f / sr, k = Math.exp(-1 / (m.decay * sr));
    // recursive oscillator: s[n] = 2 cos(w) s[n-1] - s[n-2], scaled by the decaying gain
    const c2 = 2 * Math.cos(w);
    let s1 = 0, s2 = -Math.sin(w), g = m.amp ?? 1;
    for (let i = d0; i < out.length; i++) {
      const s = c2 * s1 - s2; s2 = s1; s1 = s;
      out[i] += g * s2; // s2 holds sin(w (i - d0))
      g *= k;
      if (g < 1e-6) break;
    }
  }
  return out;
}

/**
 * Add `count` short noise grains (crackle, grit, gravel) between `start` and `start + spread` seconds. Grain times
 * bunch toward the start with `bunch` > 1.
 * @param {Float32Array} out
 * @param {number} sr
 * @param {() => number} rand
 * @param {{ count: number, start?: number, spread: number, grain?: number, amp?: number, bunch?: number }} o
 * @returns {Float32Array}
 */
export function crackle(out, sr, rand, { count, start = 0, spread, grain = 0.0015, amp = 1, bunch = 1 }) {
  for (let g = 0; g < count; g++) {
    const t0 = start + spread * Math.pow(rand(), bunch);
    const len = Math.max(4, Math.round(grain * (0.4 + rand()) * sr)), a = amp * (0.3 + 0.7 * rand());
    const i0 = Math.round(t0 * sr), k = Math.exp(-4 / len);
    let e = 1;
    for (let i = i0; i < Math.min(out.length, i0 + len); i++) { out[i] += a * e * (rand() * 2 - 1); e *= k; }
  }
  return out;
}

/** Add b * gain into a (in place, up to the shorter length). Returns a. */
export function mix(a, b, gain = 1) { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) a[i] += b[i] * gain; return a; }

/** tanh saturation normalised so that 1 maps to 1, in place. */
export function saturate(x, drive = 1.5) {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(drive * x[i]) * k;
  return x;
}

/** Remove DC: a one-pole high-pass at `hz` (default 12 Hz), then subtract what mean is left. In place. */
export function removeDC(x, sr = 44100, hz = 12) {
  const r = Math.exp(-2 * Math.PI * hz / sr);
  let xp = 0, yp = 0;
  for (let i = 0; i < x.length; i++) { const y = x[i] - xp + r * yp; xp = x[i]; yp = y; x[i] = y; }
  let m = 0; for (let i = 0; i < x.length; i++) m += x[i];
  m /= x.length || 1;
  for (let i = 0; i < x.length; i++) x[i] -= m;
  return x;
}

/** Scale so that the largest |sample| is `peak` (silence stays silence). In place. */
export function normalize(x, peak = 0.5) {
  let p = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; }
  if (p > 0) { const k = peak / p; for (let i = 0; i < x.length; i++) x[i] *= k; }
  return x;
}

/** Raised-cosine fades at both ends (default 0.3 ms in, 12 ms out), in place: first and last sample are 0. */
export function edgeFades(x, sr, fadeIn = 0.0003, fadeOut = 0.012) {
  const n = x.length, a = Math.min(n >> 1, Math.max(1, Math.round(fadeIn * sr))), b = Math.min(n >> 1, Math.max(1, Math.round(fadeOut * sr)));
  for (let i = 0; i < a; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / a);
  for (let i = 0; i < b; i++) x[n - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / b);
  return x;
}

/**
 * Seamless loop by equal-power crossfade: returns a new buffer `fade` seconds shorter whose end runs straight into its
 * start (the head is a crossfade from the material after the loop end into the material at the start).
 * @param {Float32Array} x
 * @param {number} sr
 * @param {number} [fade=0.25]  seconds
 * @returns {Float32Array}
 */
export function loopify(x, sr, fade = 0.25) {
  const f = Math.min(Math.round(fade * sr), x.length >> 1), n = x.length - f, y = x.slice(0, n);
  for (let i = 0; i < f; i++) {
    const t = (i + 0.5) / f;
    y[i] = x[i] * Math.sin(t * Math.PI / 2) + x[n + i] * Math.cos(t * Math.PI / 2);
  }
  return y;
}

// ------------------------------------------------------------------------------------------------- measurement

/** In-place radix-2 FFT of re / im (length a power of two). @param {Float64Array} re @param {Float64Array} im */
export function fft(re, im) { // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const ar = re[i + k + h] * cr - im[i + k + h] * ci, ai = re[i + k + h] * ci + im[i + k + h] * cr;
        re[i + k + h] = re[i + k] - ar; im[i + k + h] = im[i + k] - ai;
        re[i + k] += ar; im[i + k] += ai;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/**
 * Magnitude spectral centroid (Hz) over Hann-windowed frames of `size` samples (hop size / 2; a short sound is one
 * zero-padded frame). 0 for silence.
 * @param {Float32Array} x
 * @param {number} sr
 * @param {number} [size=2048]  power of two
 */
export function spectralCentroid(x, sr, size = 2048) {
  const re = new Float64Array(size), im = new Float64Array(size), acc = new Float64Array(size >> 1);
  const hop = size >> 1;
  for (let s = 0; s === 0 || s + size <= x.length; s += hop) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < size && s + i < x.length; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
    fft(re, im);
    for (let k = 1; k < size >> 1; k++) acc[k] += Math.hypot(re[k], im[k]);
  }
  let num = 0, den = 0;
  for (let k = 1; k < size >> 1; k++) { num += k * sr / size * acc[k]; den += acc[k]; }
  return den > 0 ? num / den : 0;
}

/**
 * @typedef {object} SoundStats
 * @property {number} peak  largest |sample|
 * @property {number} rms
 * @property {number} dc  mean
 * @property {number} nan  count of samples that are not finite
 * @property {number} maxStep  largest |x[i] - x[i-1]|
 * @property {number} stepP99  99th percentile of |x[i] - x[i-1]| (a "normal" sample step)
 * @property {number} first  x[0]
 * @property {number} last  x[n-1]
 * @property {number} seam  |x[0] - x[n-1]|: the step a loop makes when it wraps
 * @property {number} centroid  Hz (spectralCentroid)
 * @property {number} seconds
 */

/**
 * Measure a mono buffer.
 * @param {Float32Array} x
 * @param {number} sr
 * @returns {SoundStats}
 */
export function measure(x, sr) {
  const n = x.length;
  let peak = 0, sum = 0, sq = 0, nan = 0, maxStep = 0;
  const steps = new Float32Array(Math.max(0, n - 1));
  for (let i = 0; i < n; i++) {
    const v = x[i];
    if (!Number.isFinite(v)) { nan++; continue; }
    const a = Math.abs(v); if (a > peak) peak = a;
    sum += v; sq += v * v;
    if (i) { const d = Math.abs(v - x[i - 1]); steps[i - 1] = d; if (d > maxStep) maxStep = d; }
  }
  steps.sort();
  return {
    peak, rms: Math.sqrt(sq / (n || 1)), dc: sum / (n || 1), nan, maxStep,
    stepP99: steps.length ? steps[Math.floor(steps.length * 0.99)] : 0,
    first: x[0] ?? 0, last: x[n - 1] ?? 0, seam: n ? Math.abs(x[0] - x[n - 1]) : 0,
    centroid: spectralCentroid(x, sr), seconds: n / sr,
  };
}

/**
 * Hash of the samples quantised to 16 bits (FNV-1a, 8 hex digits): equal for equal renders.
 * @param {Float32Array} x
 * @returns {string}
 */
export function hashSamples(x) {
  let h = 0x811c9dc5;
  for (let i = 0; i < x.length; i++) {
    const q = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))) & 0xffff;
    h ^= q & 0xff; h = Math.imul(h, 0x01000193);
    h ^= q >> 8; h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * 16-bit PCM WAV file of mono samples or a list of channels (interleaved in the file; clamped to -1..1).
 * @param {Float32Array|Float32Array[]} samples
 * @param {number} sampleRate
 * @returns {Uint8Array}
 */
export function encodeWav(samples, sampleRate) {
  const ch = Array.isArray(samples) ? samples : [samples], nc = ch.length, n = ch[0].length;
  const bytes = 44 + n * nc * 2, buf = new ArrayBuffer(bytes), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * nc * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      const s = Math.max(-1, Math.min(1, ch[c][i] || 0));
      v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2;
    }
  }
  return new Uint8Array(buf);
}
