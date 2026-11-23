// The sound kit in headless Chrome: load samples/sound-check/, run its self-test (the ten-second scene rendered in an
// OfflineAudioContext through the safe master chain, measured against MIX_LIMITS), print the numbers and fail on any
// broken limit or console error. Then the car engine on its own (EngineAudio, a four-cylinder, on a Gearbox: idle, full
// throttle through two upshifts, a lift), checked as an engine: the strongest tone is the firing frequency the revs
// give (cylinders / 2 per turn) or a low harmonic of it, most of the sound is that harmonic series, the pitch drops at
// each upshift, the idle is audible and well under full throttle, no clicks or clipping. Optionally save the mix and a
// screenshot:
//   node test/browser/sound-check.mjs [--wav=out.wav] [--shot=out.png]
// Run it through the machine's GPU lock when other jobs share the machine.
import fs from 'node:fs';
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, parseArgs, repoRoot } from './playwright.config.mjs';
import { fft } from '../../src/audio/dsp.js';

const args = parseArgs();
const vite = await startVite();
const browser = await launchChrome();
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = watchErrors(page);
  const session = await loadSample(page, vite.base + await resolvePage(vite, 'sound-check'), errors);
  const fail = session.status === 'ready' ? await page.evaluate(() => window.__sample.selfTest()) : `page ${session.status}`;
  const r = await page.evaluate(() => window.__sample.report());
  if (r) {
    console.log(`self-test: ${r.ok ? 'PASS' : 'FAIL'}  peak ${r.peak.toFixed(3)}, clipped ${r.clipped}, NaN ${r.nan}, DC ${r.dc.toExponential(1)}, `
      + `quietest ${r.quietest} dBFS, loudest ${r.loudest} dBFS (median ${r.median}, +${(r.loudest - r.median).toFixed(1)} dB), rendered in ${r.renderMs} ms`);
    console.log(`loudness per 0.5 s (dBFS): ${r.loudness.join(' ')}`);
  }
  if (fail) console.log(`failures: ${fail}`);
  if (args.wav && r) {
    fs.writeFileSync(String(args.wav), Buffer.from(await page.evaluate(() => window.__sample.wavBase64()), 'base64'));
    console.log(`wrote ${args.wav}`);
  }
  if (args.shot) { await page.screenshot({ path: String(args.shot), fullPage: true }); console.log(`wrote ${args.shot}`); }
  const engineFails = session.status === 'ready' ? engineCheck(await page.evaluate(renderEngine, `/@fs${repoRoot.replace(/\/$/, '')}`)) : 1;
  for (const e of errors) console.log(`  error: ${e}`);
  ok = session.status === 'ready' && !fail && !engineFails && errors.length === 0;
} finally {
  await browser.close(); await vite.close();
}
process.exit(ok ? 0 : 1);

// in the page: 7 s of the engine alone, offline: idle to 1 s, full throttle on a 5.5 m/s^2 speed ramp to 6 s, then a lift
async function renderEngine(fsb) {
  const { EngineAudio, audioSelfTest } = await import(`${fsb}/src/audio/index.js`), { Gearbox } = await import(`${fsb}/src/physics/index.js`);
  const log = [];
  const r = await audioSelfTest({ seconds: 7, sampleRate: 44100, build(bus) {
    const engine = new EngineAudio({ bus, cylinders: 4, idle: 850, redline: 6500 }), gb = new Gearbox(), car = { wheelSpeed: 0 };
    return (t, dt) => {
      const thr = t >= 1 && t < 6 ? 1 : 0;
      if (thr) car.wheelSpeed += 5.5 * dt;
      engine.update(dt, gb.update(dt, car, thr));
      log.push([t, gb.rpm, gb.gear]);
    };
  } });
  return { x: Array.from(r.samples[0]), sr: r.sampleRate, log, peak: r.peak, clipped: r.clipped };
}

// in Node: measure it as an engine
function engineCheck({ x, sr, log, peak, clipped }) {
  const cyl = 4;
  const at = (t) => log.reduce((b, e) => (Math.abs(e[0] - t) < Math.abs(b[0] - t) ? e : b));
  const frame = (t, N = 4096) => { // power spectrum of N samples around t, with the firing frequency then
    const re = new Float64Array(N), im = new Float64Array(N), s = Math.round(t * sr) - N / 2;
    for (let i = 0; i < N; i++) re[i] = (x[s + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
    fft(re, im);
    const P = new Float64Array(N / 2); for (let k = 0; k < N / 2; k++) P[k] = re[k] ** 2 + im[k] ** 2;
    return { P, f0: at(t)[1] / 60 * cyl / 2, bin: sr / N };
  };
  const band = (P, bin, a, b) => { let e = 0; for (let k = Math.ceil(a / bin); k <= b / bin; k++) e += P[k] || 0; return e; };
  const db = (t) => { let e = 0; const n = Math.round(0.25 * sr), s = Math.round(t * sr); for (let i = s; i < s + n; i++) e += x[i] * x[i]; return 10 * Math.log10(e / n + 1e-12); };
  const pitch = (t) => { const { P, f0, bin } = frame(t); let fw = 0, w = 0; for (let k = Math.ceil(f0 * 0.7 / bin); k <= f0 * 1.3 / bin; k++) { fw += k * bin * P[k]; w += P[k]; } return w > 0 ? fw / w : 0; };
  let fails = 0;
  const check = (name, okk, detail) => { if (!okk) fails++; console.log(`engine: ${okk ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
  for (const [t, N] of [[0.6, 16384], [3.0, 4096]]) { // idle: 2.7 Hz bins for a 28 Hz firing frequency
    const { P, f0, bin } = frame(t, N);
    let pk = 0, pf = 0; for (let k = Math.ceil(25 / bin); k < 1500 / bin; k++) if (P[k] > pk) { pk = P[k]; pf = k * bin; }
    let harm = 0; for (let h = 1; h <= 8; h++) harm += band(P, bin, h * f0 * 0.96, h * f0 * 1.04);
    const share = harm / band(P, bin, 20, 2000);
    const h = Math.round(pf / f0);
    check(`t ${t} s: the strongest tone is the firing frequency or its 2nd / 3rd harmonic`, h >= 1 && h <= 3 && Math.abs(pf / f0 - h) < 0.08 * h, `${pf.toFixed(0)} Hz, firing ${f0.toFixed(0)} Hz at ${at(t)[1].toFixed(0)} rpm`);
    check(`t ${t} s: the firing harmonics carry most of the sound (an engine, not noise)`, share > 0.4, `${(100 * share).toFixed(0)} % of 20 Hz - 2 kHz`);
  }
  const ups = []; for (let i = 1; i < log.length; i++) if (log[i][2] > log[i - 1][2] && log[i][0] < 6) ups.push(log[i][0]);
  check('upshifts under full throttle', ups.length >= 2, `${ups.length} at ${ups.map((t) => t.toFixed(2)).join(', ')} s`);
  for (const t of ups) { const a = pitch(t - 0.12), b = pitch(t + 0.2); check(`upshift at ${t.toFixed(2)} s: the pitch drops`, b < a * 0.85, `${a.toFixed(0)} -> ${b.toFixed(0)} Hz`); }
  const idle = db(0.4), full = db(4);
  check('idle audible, well under full throttle', idle > -45 && idle < full - 6, `idle ${idle.toFixed(1)} dBFS, full throttle ${full.toFixed(1)} dBFS`);
  let clicks = 0; for (let i = 2; i < x.length; i++) if (Math.abs(x[i] - 2 * x[i - 1] + x[i - 2]) > 0.25) clicks++;
  check('no clicks or clipping', clicks === 0 && clipped === 0 && peak < 0.85, `${clicks} clicks, peak ${peak.toFixed(2)}`);
  return fails;
}
