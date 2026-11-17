// The sound kit's named sounds (SOUND_PRESETS, 18 of them), rendered in plain JavaScript with dsp.js, so they render
// and are measured in Node. SoundBank plays them; renderSound(name, variant) is what SoundBank.render returns.
//
//   import { SOUND_PRESETS, renderSound } from '@vibe/engine/audio';
//   const x = renderSound('step.gravel', 2, { seed: 1 });   // Float32Array at 44.1 kHz, finished (DC removed, faded,
//                                                           // normalised to the preset's peak)
//
// A preset is data plus a render function (SoundPreset below). One-shots get the kit's 0.3 ms / 12 ms edge fades and
// a DC blocker; loops are made seamless by an equal-power crossfade (or by rendering whole cycles, lamp.hum). Every
// preset declares the band its spectral centroid must fall in and its peak; test/audio-dsp.mjs holds each variant to
// those. The design aim is restraint: a quiet dusk road, footsteps, a car; nothing arcade-like.
import {
  rng, seedFor, noise, biquad, envelope, glide, modes, crackle, mix, saturate, removeDC, normalize, edgeFades, loopify,
} from './dsp.js';

/** Sample rate the presets render at. */
export const PRESET_SAMPLE_RATE = 44100;

/**
 * @typedef {object} RenderContext
 * @property {number} sr  sample rate
 * @property {() => number} rand  seeded per (seed, name, variant)
 * @property {number} variant
 * @property {number} n  samples to render (seconds * sr)
 */

/**
 * @typedef {object} SoundPreset
 * @property {'shot'|'loop'} kind  one-shot, or a seamless loop (SoundBank.loop)
 * @property {number} seconds  rendered length (a loop is this long after its crossfade)
 * @property {number} variants  how many different renders play round-robin
 * @property {string} bus  AudioBus bus name: 'ui', 'effects', 'ambience' or 'engine'
 * @property {number} peak  each variant is normalised to this peak
 * @property {[number, number]} centroid  allowed spectral-centroid band, Hz
 * @property {number} [gain=1]  default playback gain
 * @property {number} [cap=4]  most voices of this sound at once (one-shots)
 * @property {number} [priority=5]  1..10: who may steal whose voice
 * @property {number} [refDistance=4]  m, for positional plays (inverse distance model)
 * @property {number} [rolloff=1]
 * @property {number} [loopFade=0.25]  s, crossfade of a loop's seam (0: rendered whole cycles, no crossfade)
 * @property {(c: RenderContext) => Float32Array} render  raw samples; the kit finishes them (fades, DC, peak)
 */

const buf = (c) => new Float32Array(c.n);
const jit = (c, amount) => 1 + amount * (c.rand() * 2 - 1);
/** Noise of the whole length, filtered and enveloped, added into out. */
function burst(out, c, { color = 'white', filters = [], attack = 0.001, decay, delay = 0, amp = 1 }) {
  const x = noise(out.length, c.rand, color);
  for (const f of filters) biquad(x, c.sr, f);
  envelope(x, c.sr, { attack, decay, delay });
  return mix(out, x, amp);
}
/** A soft sine note with a little 2nd / 3rd harmonic. */
function note(out, c, { f, delay = 0, decay, amp = 1, attack = 0.004 }) {
  for (const [k, a] of [[1, 1], [2, 0.16], [3, 0.05]]) glide(out, c.sr, { f0: f * k, f1: f * k, tau: 1, amp: amp * a, decay: decay / k, delay, attack });
  return out;
}
const TAU = Math.PI * 2;

/** @type {Record<string, SoundPreset>} */
export const SOUND_PRESETS = {
  // ---------------------------------------------------------------- UI: short, soft, mid-high
  'ui.click': {
    kind: 'shot', seconds: 0.05, variants: 3, bus: 'ui', peak: 0.28, centroid: [1500, 6000], cap: 4, priority: 9,
    render(c) {
      const x = buf(c);
      burst(x, c, { filters: [{ type: 'bandpass', freq: 3200 * jit(c, 0.05), Q: 1.1 }], attack: 0.0003, decay: 0.0028, amp: 1 });
      modes(x, c.sr, [{ f: 2500 * jit(c, 0.03), decay: 0.006, amp: 0.35 }, { f: 4100 * jit(c, 0.03), decay: 0.004, amp: 0.15 }]);
      return x;
    },
  },
  'ui.confirm': {
    kind: 'shot', seconds: 0.42, variants: 2, bus: 'ui', peak: 0.26, centroid: [500, 2200], cap: 2, priority: 9,
    render(c) {
      const x = buf(c), d = jit(c, 0.004);
      note(x, c, { f: 587.33 * d, decay: 0.09, amp: 0.8 });                 // D5
      note(x, c, { f: 880 * d, delay: 0.085, decay: 0.15, amp: 1 });         // A5
      return biquad(x, c.sr, { type: 'lowpass', freq: 3500, Q: 0.6 });
    },
  },
  'ui.back': {
    kind: 'shot', seconds: 0.3, variants: 2, bus: 'ui', peak: 0.24, centroid: [350, 1800], cap: 2, priority: 9,
    render(c) {
      const x = buf(c), d = jit(c, 0.004);
      note(x, c, { f: 659.26 * d, decay: 0.06, amp: 0.8 });                  // E5
      note(x, c, { f: 493.88 * d, delay: 0.07, decay: 0.1, amp: 1 });        // B4
      return biquad(x, c.sr, { type: 'lowpass', freq: 3000, Q: 0.6 });
    },
  },
  'pickup.chime': {
    kind: 'shot', seconds: 1.0, variants: 3, bus: 'effects', peak: 0.3, centroid: [900, 4500], cap: 3, priority: 7, refDistance: 3,
    render(c) {
      const x = buf(c), f = 1046.5 * (1 + 0.02 * (c.variant - 1));   // C6, a hair apart per variant
      const bell = (f0, delay, amp) => modes(x, c.sr, [
        { f: f0, decay: 0.45, amp }, { f: f0 * 2.01, decay: 0.26, amp: amp * 0.3 }, { f: f0 * 2.76, decay: 0.16, amp: amp * 0.2 },
        { f: f0 * 4.07, decay: 0.09, amp: amp * 0.1 }, { f: f0 * 5.4, decay: 0.05, amp: amp * 0.05 },
      ], delay);
      bell(f, 0, 1);
      bell(f * 1.4983, 0.075, 0.7);                                   // a fifth up
      burst(x, c, { filters: [{ type: 'highpass', freq: 3000 }], attack: 0.0003, decay: 0.002, amp: 0.08 });
      return x;
    },
  },

  // ---------------------------------------------------------------- footsteps: one footfall each, close and dry
  'step.concrete': {
    kind: 'shot', seconds: 0.22, variants: 6, bus: 'effects', peak: 0.3, centroid: [600, 3500], cap: 4, priority: 5, refDistance: 2,
    render(c) {
      const x = buf(c);
      glide(x, c.sr, { f0: 150 * jit(c, 0.1), f1: 70, tau: 0.02, amp: 0.45, decay: 0.03 });           // heel weight
      burst(x, c, { filters: [{ type: 'highpass', freq: 900 }, { type: 'lowpass', freq: 5000 }], attack: 0.0005, decay: 0.006, amp: 0.9 }); // heel tick
      burst(x, c, { filters: [{ type: 'bandpass', freq: 2200 * jit(c, 0.15), Q: 0.8 }], attack: 0.003, decay: 0.028, delay: 0.045 + 0.02 * c.rand(), amp: 0.35 }); // sole scuff
      return biquad(x, c.sr, { type: 'lowpass', freq: 7000 });
    },
  },
  'step.grass': {
    kind: 'shot', seconds: 0.3, variants: 6, bus: 'effects', peak: 0.24, centroid: [1200, 5000], cap: 4, priority: 5, refDistance: 2,
    render(c) {
      const x = buf(c), f0 = 2200 * jit(c, 0.15);
      burst(x, c, { filters: [{ type: 'bandpass', freq: (t) => f0 * (1 + 0.6 * t), Q: 0.7 }], attack: 0.02, decay: 0.06, amp: 1 }); // blades swish
      const g = new Float32Array(c.n);
      crackle(g, c.sr, c.rand, { count: 14, start: 0.01, spread: 0.12, grain: 0.001, amp: 0.5, bunch: 1.4 });
      mix(x, biquad(g, c.sr, { type: 'highpass', freq: 2000 }));
      glide(x, c.sr, { f0: 110, f1: 60, tau: 0.02, amp: 0.12, decay: 0.03 });
      biquad(x, c.sr, { type: 'lowpass', freq: 5000, Q: 0.6 });
      return biquad(x, c.sr, { type: 'lowpass', freq: 7000, Q: 0.6 });
    },
  },
  'step.gravel': {
    kind: 'shot', seconds: 0.3, variants: 6, bus: 'effects', peak: 0.28, centroid: [1500, 6000], cap: 4, priority: 5, refDistance: 2,
    render(c) {
      const x = buf(c), g = new Float32Array(c.n);
      crackle(g, c.sr, c.rand, { count: 45, start: 0.004, spread: 0.16, grain: 0.0012, amp: 0.8, bunch: 1.7 });
      mix(x, biquad(g, c.sr, { type: 'bandpass', freq: 3500 * jit(c, 0.15), Q: 0.6 }));
      burst(x, c, { filters: [{ type: 'bandpass', freq: 1200, Q: 0.7 }], attack: 0.002, decay: 0.05, amp: 0.25 });
      glide(x, c.sr, { f0: 130, f1: 65, tau: 0.02, amp: 0.15, decay: 0.03 });
      biquad(x, c.sr, { type: 'lowpass', freq: 6000, Q: 0.6 });
      return biquad(x, c.sr, { type: 'lowpass', freq: 8000, Q: 0.6 });
    },
  },
  'step.wood': {
    kind: 'shot', seconds: 0.25, variants: 6, bus: 'effects', peak: 0.32, centroid: [250, 1600], cap: 4, priority: 5, refDistance: 2,
    render(c) {
      const x = buf(c), j = jit(c, 0.04);
      modes(x, c.sr, [{ f: 165 * j, decay: 0.06, amp: 1 }, { f: 390 * j, decay: 0.045, amp: 0.6 }, { f: 720 * j, decay: 0.03, amp: 0.4 }, { f: 1240 * j, decay: 0.02, amp: 0.25 }]);
      burst(x, c, { filters: [{ type: 'lowpass', freq: 3000 }], attack: 0.0004, decay: 0.004, amp: 0.5 });
      glide(x, c.sr, { f0: 120, f1: 70, tau: 0.02, amp: 0.4, decay: 0.03 });
      return x;
    },
  },
  'land.soft': {
    kind: 'shot', seconds: 0.4, variants: 3, bus: 'effects', peak: 0.4, centroid: [80, 700], cap: 2, priority: 6, refDistance: 2,
    render(c) {
      const x = buf(c);
      glide(x, c.sr, { f0: 120 * jit(c, 0.08), f1: 50, tau: 0.05, amp: 1, decay: 0.09, attack: 0.002 });
      burst(x, c, { color: 'brown', filters: [{ type: 'lowpass', freq: 700 }], attack: 0.002, decay: 0.07, amp: 1.2 });
      burst(x, c, { filters: [{ type: 'bandpass', freq: 1800, Q: 0.8 }], attack: 0.004, decay: 0.035, delay: 0.02, amp: 0.08 });
      return x;
    },
  },
  'land.hard': {
    kind: 'shot', seconds: 0.55, variants: 3, bus: 'effects', peak: 0.5, centroid: [100, 900], cap: 2, priority: 6, refDistance: 2,
    render(c) {
      const x = buf(c);
      glide(x, c.sr, { f0: 95 * jit(c, 0.08), f1: 42, tau: 0.06, amp: 1, decay: 0.14, attack: 0.0015 });
      burst(x, c, { color: 'brown', filters: [{ type: 'lowpass', freq: 1100 }], attack: 0.0015, decay: 0.1, amp: 1.4 });
      burst(x, c, { filters: [{ type: 'bandpass', freq: 260, Q: 1.2 }], attack: 0.002, decay: 0.12, amp: 0.6 });
      const g = new Float32Array(c.n);
      crackle(g, c.sr, c.rand, { count: 20, start: 0.003, spread: 0.1, grain: 0.0012, amp: 0.15, bunch: 1.6 });
      mix(x, biquad(g, c.sr, { type: 'bandpass', freq: 1800, Q: 0.8 }));
      return biquad(x, c.sr, { type: 'lowpass', freq: 3000, Q: 0.6 });
    },
  },

  // ---------------------------------------------------------------- impacts
  'impact.metal': {
    kind: 'shot', seconds: 1.2, variants: 4, bus: 'effects', peak: 0.5, centroid: [700, 4000], cap: 3, priority: 7, refDistance: 6,
    render(c) {
      const x = buf(c), f = 380 * jit(c, 0.08);
      const R = [1, 1.58, 2.24, 2.92, 3.71, 4.93, 6.31, 8.1], list = [];
      R.forEach((r, i) => {
        const decay = 0.35 / (1 + 0.55 * i), amp = 1 / (1 + 0.5 * i);
        list.push({ f: f * r * jit(c, 0.01), decay, amp }, { f: f * r * 1.003, decay, amp: amp * 0.5 }); // slow beating
      });
      modes(x, c.sr, list);
      burst(x, c, { filters: [{ type: 'highpass', freq: 2000 }], attack: 0.0003, decay: 0.003, amp: 0.6 });
      glide(x, c.sr, { f0: 90, f1: 45, tau: 0.03, amp: 0.35, decay: 0.06 });
      return saturate(normalize(x, 1), 1.2);
    },
  },
  'impact.wood': {
    kind: 'shot', seconds: 0.45, variants: 4, bus: 'effects', peak: 0.48, centroid: [250, 1500], cap: 3, priority: 7, refDistance: 6,
    render(c) {
      const x = buf(c), j = jit(c, 0.06);
      modes(x, c.sr, [210, 480, 830, 1330, 2100].map((f, i) => ({ f: f * j * jit(c, 0.01), decay: [0.09, 0.06, 0.045, 0.03, 0.02][i], amp: [1, 0.7, 0.45, 0.3, 0.15][i] })));
      burst(x, c, { filters: [{ type: 'lowpass', freq: 2500 }], attack: 0.0004, decay: 0.005, amp: 0.7 });
      glide(x, c.sr, { f0: 110, f1: 55, tau: 0.03, amp: 0.4, decay: 0.05 });
      return x;
    },
  },
  'impact.thud': {
    kind: 'shot', seconds: 0.7, variants: 4, bus: 'effects', peak: 0.55, centroid: [40, 450], cap: 3, priority: 7, refDistance: 6,
    render(c) {
      const x = buf(c);
      glide(x, c.sr, { f0: 80 * jit(c, 0.08), f1: 36, tau: 0.1, amp: 1, decay: 0.18, attack: 0.0015 });
      burst(x, c, { color: 'brown', filters: [{ type: 'lowpass', freq: 350 }], attack: 0.001, decay: 0.12, amp: 1.2 });
      burst(x, c, { filters: [{ type: 'bandpass', freq: 160, Q: 1 }], attack: 0.002, decay: 0.08, amp: 0.4 });
      burst(x, c, { filters: [{ type: 'bandpass', freq: 1400, Q: 0.9 }], attack: 0.001, decay: 0.03, amp: 0.06 }); // panel rattle
      return x;
    },
  },

  // ---------------------------------------------------------------- loops (SoundBank.loop; the game sets gain / rate)
  'tyre.squeal': {
    kind: 'loop', seconds: 3, variants: 1, bus: 'effects', peak: 0.5, centroid: [800, 2200], refDistance: 5,
    render(c) {
      const x = new Float32Array(c.n), L = c.n / c.sr, p1 = c.rand() * TAU, p2 = c.rand() * TAU;
      const wob = (t) => 40 * Math.sin(TAU * 7 * t + p1) + 25 * Math.sin(TAU * 19 * t + p2); // whole cycles over the loop
      const a = biquad(noise(c.n, c.rand), c.sr, { type: 'bandpass', freq: (t) => 1000 + wob(t), Q: 16 });
      const b = biquad(noise(c.n, c.rand), c.sr, { type: 'bandpass', freq: (t) => 1480 + 1.4 * wob(t), Q: 20 });
      const h = biquad(noise(c.n, c.rand), c.sr, { type: 'bandpass', freq: (t) => 2000 + 2 * wob(t), Q: 25 });
      for (let i = 0; i < c.n; i++) {
        const t = i / c.sr;
        const judder = 1 + 0.18 * Math.sin(TAU * Math.round(23 * L) / L * t) + 0.1 * Math.sin(TAU * Math.round(31 * L) / L * t + p1);
        x[i] = (a[i] + 0.5 * b[i] + 0.2 * h[i]) * judder;
      }
      biquad(x, c.sr, { type: 'lowpass', freq: 2600, Q: 0.6 });
      return biquad(x, c.sr, { type: 'highpass', freq: 500, Q: 0.6 });
    },
  },
  'road.roar': {
    kind: 'loop', seconds: 4, variants: 1, bus: 'effects', peak: 0.5, centroid: [90, 700], refDistance: 5,
    render(c) {
      const x = biquad(noise(c.n, c.rand, 'brown'), c.sr, { type: 'bandpass', freq: 170, Q: 0.7 });
      const t = biquad(noise(c.n, c.rand, 'pink'), c.sr, { type: 'bandpass', freq: 600, Q: 0.8 }); // tread texture
      mix(x, t, 0.5);
      return biquad(x, c.sr, { type: 'lowpass', freq: 1500 });
    },
  },
  'wind.rush': {
    kind: 'loop', seconds: 4, variants: 1, bus: 'effects', peak: 0.5, centroid: [200, 1400],
    render(c) {
      const x = biquad(noise(c.n, c.rand), c.sr, { type: 'lowpass', freq: 900, Q: 0.5 });
      biquad(x, c.sr, { type: 'lowpass', freq: 1400, Q: 0.6 });
      biquad(x, c.sr, { type: 'highpass', freq: 120 });
      const w = biquad(noise(c.n, c.rand), c.sr, { type: 'bandpass', freq: 1800, Q: 2 });
      const ph = c.rand() * TAU;
      for (let i = 0; i < c.n; i++) {
        const t = i / c.n;
        x[i] = (x[i] + 0.15 * w[i]) * (1 + 0.25 * Math.sin(TAU * 2 * t) + 0.15 * Math.sin(TAU * 5 * t + ph)); // gusts
      }
      return biquad(x, c.sr, { type: 'lowpass', freq: 2200, Q: 0.6 });
    },
  },
  'amb.dusk': {
    kind: 'loop', seconds: 8, variants: 1, bus: 'ambience', peak: 0.45, centroid: [150, 1600], loopFade: 0.6,
    render(c) {
      const x = biquad(noise(c.n, c.rand, 'brown'), c.sr, { type: 'lowpass', freq: 250, Q: 0.5 }); // far traffic
      const air = biquad(noise(c.n, c.rand, 'pink'), c.sr, { type: 'bandpass', freq: 700, Q: 0.6 });
      for (let i = 0; i < c.n; i++) x[i] += 0.12 * air[i] * (0.6 + 0.4 * Math.sin(TAU * i / c.n + 1));
      // a few crickets, far off: trains of three 12 ms pulses near 4.3 kHz
      let t = 0.2 + 0.4 * c.rand();
      while (t < c.n / c.sr - 0.3) {
        const f = 4300 * jit(c, 0.02);
        for (let k = 0; k < 3; k++) {
          const i0 = Math.round((t + k * 0.03) * c.sr), len = Math.round(0.012 * c.sr);
          for (let i = 0; i < len && i0 + i < c.n; i++) x[i0 + i] += 0.012 * Math.sin(Math.PI * i / len) * Math.sin(TAU * f * i / c.sr);
        }
        t += 0.7 + 0.6 * c.rand();
      }
      return x;
    },
  },
  'lamp.hum': {
    kind: 'loop', seconds: 2, variants: 1, bus: 'effects', peak: 0.4, centroid: [100, 700], loopFade: 0, refDistance: 1.5, rolloff: 1.4,
    render(c) {
      // mains hum: 100 Hz and its harmonics (whole cycles in 2 s, so the loop needs no crossfade), a slow flutter
      const x = new Float32Array(c.n), H = [[1, 1], [2, 0.45], [3, 0.3], [4, 0.12], [5, 0.08]];
      for (let k = 6; k <= 14; k++) H.push([k, 0.03 / (k - 5)]);
      const ph = H.map(() => c.rand() * TAU);
      for (let i = 0; i < c.n; i++) {
        const t = i / c.sr;
        let s = 0;
        for (let h = 0; h < H.length; h++) s += H[h][1] * Math.sin(TAU * 100 * H[h][0] * t + ph[h]);
        x[i] = s * (1 + 0.08 * Math.sin(TAU * 2 * t));
      }
      return x;
    },
  },
};

/**
 * Render one variant of a preset spec, finished: one-shots get a DC blocker, 0.3 ms / 12 ms edge fades, then their
 * peak; loops get their seam (crossfade unless loopFade is 0), the mean removed and their peak.
 * @param {SoundPreset} spec
 * @param {string} name  part of the seed
 * @param {number} [variant=0]
 * @param {{ seed?: number, sampleRate?: number }} [o]
 * @returns {Float32Array}
 */
export function renderPreset(spec, name, variant = 0, { seed = 1, sampleRate = PRESET_SAMPLE_RATE } = {}) {
  const sr = sampleRate, v = ((variant % spec.variants) + spec.variants) % spec.variants;
  const rand = rng(seedFor(seed, name, v));
  if (spec.kind === 'loop') {
    const fade = spec.loopFade ?? 0.25;
    let x = spec.render({ sr, rand, variant: v, n: Math.round((spec.seconds + fade) * sr) });
    if (fade > 0) x = loopify(x, sr, fade);
    let m = 0; for (let i = 0; i < x.length; i++) m += x[i];
    m /= x.length; for (let i = 0; i < x.length; i++) x[i] -= m;
    return normalize(x, spec.peak);
  }
  const x = spec.render({ sr, rand, variant: v, n: Math.round(spec.seconds * sr) });
  removeDC(x, sr);
  edgeFades(x, sr);
  return normalize(x, spec.peak);
}

/**
 * Render a named preset (SOUND_PRESETS, or `presets`).
 * @param {string} name
 * @param {number} [variant=0]
 * @param {{ seed?: number, sampleRate?: number, presets?: Record<string, SoundPreset> }} [o]
 * @returns {Float32Array}
 */
export function renderSound(name, variant = 0, o = {}) {
  const spec = (o.presets || SOUND_PRESETS)[name];
  if (!spec) throw new Error(`renderSound: no sound '${name}' (have: ${Object.keys(o.presets || SOUND_PRESETS).join(', ')})`);
  return renderPreset(spec, name, variant, o);
}
