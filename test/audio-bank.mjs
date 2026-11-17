// Headless checks for SoundBank without Web Audio and for the mix analyser the self-test uses: bank.render runs in
// Node and equals renderSound, a seed changes it, define() adds a sound (and validates it), the bank knows the 18
// presets; analyseMix passes a steady mix and catches NaN, clipping, a peak over 0.85, DC, a silent half-second and a
// half-second more than 12 dB over the median; audioSelfTest says plainly that it needs a browser.
// Run: node test/audio-bank.mjs
import { SoundBank, renderSound, SOUND_PRESETS, analyseMix, audioSelfTest, MIX_LIMITS, AudioBus, dsp } from '@vibe/engine/audio';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

// ================================================================================================= SoundBank in Node
{
  const bus = new AudioBus();
  const sfx = new SoundBank(bus);
  check('bank knows the 18 presets', sfx.names.length === 18 && sfx.names.every((n) => SOUND_PRESETS[n]));
  const a = sfx.render('impact.metal', 2);
  check('bank.render runs in Node and equals renderSound', a instanceof Float32Array && dsp.hashSamples(a) === dsp.hashSamples(renderSound('impact.metal', 2)));
  check('bank.render: variant index wraps', dsp.hashSamples(sfx.render('impact.metal', 6)) === dsp.hashSamples(a));
  check('bank seed changes the renders', dsp.hashSamples(new SoundBank(bus, { seed: 7 }).render('impact.metal', 2)) !== dsp.hashSamples(a));
  check('play / loop before any context: inert voice, waiting loop', sfx.play('ui.click').playing === false && sfx.loop('amb.dusk').playing === true && bus.ctx === null);
  sfx.define('door.knock', {
    kind: 'shot', seconds: 0.3, variants: 2, bus: 'effects', peak: 0.4, centroid: [100, 2000],
    render: (c) => dsp.modes(new Float32Array(c.n), c.sr, [{ f: 180 + 20 * c.variant, decay: 0.05 }, { f: 460, decay: 0.03, amp: 0.4 }]),
  });
  const k = sfx.render('door.knock', 1), m = dsp.measure(k, 44100);
  check('define: a new sound renders finished (peak, zero ends) and leaves SOUND_PRESETS alone', Math.abs(m.peak - 0.4) < 1e-6 && m.first === 0 && m.last === 0 && !SOUND_PRESETS['door.knock']);
  let threw = false;
  try { sfx.define('bad', { kind: 'shot' }); } catch { threw = true; }
  check('define: a spec without render throws', threw);
}

// ================================================================================================= analyseMix
{
  const sr = 8000, n = sr * 4;
  const steady = () => { const r = dsp.rng(1), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = 0.1 * Math.sin(2 * Math.PI * 220 * i / sr) + 0.02 * (r() * 2 - 1); return x; };
  const good = analyseMix([steady(), steady()], sr);
  check('analyseMix: a steady mix passes', good.ok && good.loudness.length === 8 && good.clipped === 0 && good.nan === 0, good.failures.join('; '));
  check('analyseMix: loudness in dBFS per half-second (about -23 dBFS here)', Math.abs(good.median + 22.9) < 0.6, `${good.median}`);
  const fails = (x, re) => { const r = analyseMix([x], sr); return !r.ok && r.failures.some((f) => re.test(f)); };
  let x = steady(); x[100] = NaN;
  check('analyseMix: NaN fails', fails(x, /NaN/));
  x = steady(); x[200] = 1.2;
  check('analyseMix: a sample over 1 is clipped', fails(x, /clipped/) && analyseMix([x], sr).clipped === 1);
  x = steady(); x[300] = 0.9;
  check(`analyseMix: peak over ${MIX_LIMITS.peak} fails`, fails(x, /peak 0\.900/));
  x = steady(); for (let i = 0; i < n; i++) x[i] += 0.02;
  check('analyseMix: DC fails', fails(x, /DC/));
  x = steady(); x.fill(0, sr, sr + sr / 2);
  check('analyseMix: a silent half-second fails', fails(x, /silent half-second at 1\.0 s/));
  x = steady(); for (let i = 2 * sr; i < 2.5 * sr; i++) x[i] *= 4.5;
  check('analyseMix: a half-second 13 dB over the median fails', fails(x, /at 2\.0 s is 1[2-4]\.\d dB over the median/));
  x = steady(); for (let i = 2 * sr; i < 2.5 * sr; i++) x[i] *= 3.5;
  check('analyseMix: 11 dB over the median passes', analyseMix([x], sr).ok);
}

// ================================================================================================= audioSelfTest in Node
{
  let msg = '';
  try { await audioSelfTest({ build() {} }); } catch (e) { msg = e.message; }
  check('audioSelfTest in Node rejects with "needs OfflineAudioContext"', /OfflineAudioContext/.test(msg), msg);
}

for (const r of results) console.log(r);
console.log(`\naudio-bank: ${results.length - failures} / ${results.length} checks pass`);
process.exit(failures ? 1 : 0);
