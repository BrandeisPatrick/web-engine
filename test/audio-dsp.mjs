// Headless checks for the sound kit's DSP (src/audio/dsp.js) and every preset (src/audio/presets.js): the building
// blocks do what they say (filters, loop seams, centroid, WAV header), and every variant of all 18 presets is finite,
// at its declared peak, free of DC, starts and ends at zero (one-shots) or wraps without a step larger than a normal
// one (loops), has its spectral centroid inside its declared band, renders the same for the same seed and differs
// between variants and seeds. Prints one row per variant.
// Run: node test/audio-dsp.mjs
import { SOUND_PRESETS, PRESET_SAMPLE_RATE as SR, renderSound } from '../src/audio/presets.js';
import { rng, noise, biquad, loopify, measure, spectralCentroid, hashSamples, encodeWav, edgeFades, modes, removeDC } from '../src/audio/dsp.js';
import * as audio from '@vibe/engine/audio';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

// ================================================================================================= building blocks
{
  const n = SR, sine = (f) => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = Math.sin(2 * Math.PI * f * i / SR); return x; };
  const c = spectralCentroid(sine(1000), SR);
  check('centroid of a 1 kHz sine is 1 kHz (within 3 %)', Math.abs(c - 1000) < 30, c.toFixed(1));
  const hi = biquad(sine(8000), SR, { type: 'lowpass', freq: 500 }), lo = biquad(sine(100), SR, { type: 'lowpass', freq: 500 });
  const mh = measure(hi.subarray(2000), SR), ml = measure(lo.subarray(2000), SR);
  check('lowpass 500 Hz: 8 kHz down > 40 dB, 100 Hz passes', mh.peak < 0.01 && ml.peak > 0.9, `${mh.peak.toFixed(4)} / ${ml.peak.toFixed(3)}`);
  const sw = biquad(noise(n, rng(3)), SR, { type: 'bandpass', freq: (t) => 500 + 3000 * t, Q: 4 });
  const first = spectralCentroid(sw.subarray(0, n / 4), SR), last = spectralCentroid(sw.subarray(3 * n / 4), SR);
  check('moving bandpass: centroid rises with the sweep', last > first + 1000, `${first.toFixed(0)} -> ${last.toFixed(0)}`);
  const w = noise(n, rng(4));
  const l = loopify(w, SR, 0.2), m = measure(l, SR);
  check('loopify: 0.2 s shorter, seam step <= a normal (99th percentile) step', l.length === n - Math.round(0.2 * SR) && m.seam <= m.stepP99, `seam ${m.seam.toFixed(3)} p99 ${m.stepP99.toFixed(3)}`);
  const f = edgeFades(new Float32Array(2000).fill(0.5), SR);
  check('edgeFades: first and last sample 0, middle untouched', f[0] === 0 && f[1999] === 0 && f[1000] === 0.5);
  const d = new Float32Array(SR).fill(0.3); removeDC(d, SR);
  check('removeDC: a constant goes to ~0 mean', Math.abs(measure(d, SR).dc) < 1e-4);
  const md = modes(new Float32Array(SR), SR, [{ f: 440, decay: 0.1, amp: 1 }]);
  check('modes: starts at 0, rings at its frequency, decays', md[0] === 0 && Math.abs(spectralCentroid(md.subarray(0, 4096), SR) - 440) < 40 && Math.abs(md[SR - 1]) < 1e-3);
  check('rng: same seed same stream, other seed differs', rng(9)() === rng(9)() && rng(9)() !== rng(10)());
  const wav = encodeWav([new Float32Array([0, 0.5, -1, 2]), new Float32Array([0, -0.5, 1, -2])], 48000);
  const dv = new DataView(wav.buffer), tag = (o) => String.fromCharCode(...wav.subarray(o, o + 4));
  check('encodeWav: RIFF/WAVE, 2 ch, 48 kHz, 16 bit, 4 frames, clamped', tag(0) === 'RIFF' && tag(8) === 'WAVE' && tag(36) === 'data' && dv.getUint16(22, true) === 2
    && dv.getUint32(24, true) === 48000 && dv.getUint16(34, true) === 16 && dv.getUint32(40, true) === 16 && wav.length === 60
    && dv.getInt16(44 + 4 * 3, true) === 32767 && dv.getInt16(44 + 4 * 3 + 2, true) === -32768);
  check('encodeWav: mono Float32Array accepted', encodeWav(new Float32Array(10), 44100).length === 64);
}

// ================================================================================================= presets
const NAMES = ['ui.click', 'ui.confirm', 'ui.back', 'pickup.chime', 'step.grass', 'step.concrete', 'step.gravel', 'step.wood',
  'land.soft', 'land.hard', 'impact.metal', 'impact.wood', 'impact.thud', 'tyre.squeal', 'road.roar', 'wind.rush', 'amb.dusk', 'lamp.hum'];
const LOOPS = ['tyre.squeal', 'road.roar', 'wind.rush', 'amb.dusk', 'lamp.hum'];
check('exactly the 18 named presets', Object.keys(SOUND_PRESETS).sort().join() === [...NAMES].sort().join(), Object.keys(SOUND_PRESETS).length);
check('loops are the five named loops', Object.keys(SOUND_PRESETS).filter((k) => SOUND_PRESETS[k].kind === 'loop').sort().join() === [...LOOPS].sort().join());
check('audio index exports the kit', audio.SOUND_PRESETS === SOUND_PRESETS && typeof audio.SoundBank === 'function' && typeof audio.Footsteps === 'function'
  && typeof audio.audioSelfTest === 'function' && typeof audio.encodeWav === 'function' && typeof audio.dsp.biquad === 'function');

const rows = [];
let renderMs = 0;
for (const name of NAMES) {
  const s = SOUND_PRESETS[name], hashes = new Set();
  for (let v = 0; v < s.variants; v++) {
    const t0 = performance.now();
    const x = renderSound(name, v);
    renderMs += performance.now() - t0;
    const m = measure(x, SR), h = hashSamples(x);
    hashes.add(h);
    const bad = [];
    if (m.nan) bad.push(`${m.nan} non-finite`);
    if (!(m.peak <= s.peak + 1e-6 && m.peak >= s.peak * 0.9)) bad.push(`peak ${m.peak.toFixed(3)} not in ${(s.peak * 0.9).toFixed(3)}..${s.peak}`);
    if (Math.abs(m.dc) >= 0.01) bad.push(`DC ${m.dc.toFixed(4)}`);
    if (s.kind === 'shot' && (Math.abs(m.first) > 1e-3 || Math.abs(m.last) > 1e-3)) bad.push(`ends ${m.first.toFixed(4)} / ${m.last.toFixed(4)}`);
    if (s.kind === 'loop' && m.seam > m.stepP99) bad.push(`seam step ${m.seam.toFixed(4)} > normal step ${m.stepP99.toFixed(4)}`);
    if (!(m.centroid >= s.centroid[0] && m.centroid <= s.centroid[1])) bad.push(`centroid ${m.centroid.toFixed(0)} Hz not in ${s.centroid[0]}..${s.centroid[1]}`);
    if (Math.abs(m.seconds - s.seconds) > 0.01) bad.push(`length ${m.seconds.toFixed(3)} s, declared ${s.seconds}`);
    check(`${name} #${v}: finite, peak, DC, ends / seam, centroid, length`, bad.length === 0, bad.join('; '));
    if (v === 0) check(`${name}: same seed renders the same samples`, hashSamples(renderSound(name, 0)) === h);
    rows.push({ name, v, peak: m.peak.toFixed(3), rms: m.rms.toFixed(3), dc: m.dc.toExponential(1), centroid: m.centroid.toFixed(0), band: `${s.centroid[0]}..${s.centroid[1]}`, edge: s.kind === 'loop' ? `seam ${m.seam.toFixed(4)} <= ${m.stepP99.toFixed(4)}` : `${m.first.toFixed(4)} / ${m.last.toFixed(4)}`, hash: h });
  }
  check(`${name}: ${s.variants} variants all differ`, hashes.size === s.variants, `${hashes.size} distinct`);
  check(`${name}: another seed renders differently`, hashSamples(renderSound(name, 0, { seed: 2 })) !== hashSamples(renderSound(name, 0)));
}
check('rendering every variant of every preset takes under 2 s in Node', renderMs < 2000, `${renderMs.toFixed(0)} ms`);

const cols = ['name', 'v', 'peak', 'rms', 'dc', 'centroid', 'band', 'edge', 'hash'];
const wd = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
console.log(cols.map((c, i) => c.padEnd(wd[i])).join('  '));
for (const r of rows) console.log(cols.map((c, i) => String(r[c]).padEnd(wd[i])).join('  '));
console.log('');
for (const r of results) if (r.startsWith('FAIL')) console.log(r);
console.log(`\naudio-dsp: ${results.length - failures} / ${results.length} checks pass`);
process.exit(failures ? 1 : 0);
