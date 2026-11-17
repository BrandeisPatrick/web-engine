// Sound check page: a card per sound kit preset (waveform of variant 0, its measurements, click to play) and the
// measured self-test: scene.js rendered offline for ten seconds through AudioBus({ master: 'safe' }) at full volume,
// checked against MIX_LIMITS (no NaN, nothing clipped, peak <= 0.85, no silent or > 12 dB-over-median half-second).
// window.__sample: the smoke test's hooks (ready, poses, info, selfTest -> '' or the failures) plus report() (the
// last self-test's numbers) and wavBase64() (its mix as a 16-bit WAV, for test/browser/sound-check.mjs).
import { AudioBus, SoundBank, SOUND_PRESETS, PRESET_SAMPLE_RATE, audioSelfTest, encodeWav, dsp } from '@vibe/engine/audio';
import { buildScene } from './scene.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter((k) => k != null)); return e; };

const bus = new AudioBus({ master: 'safe', volume: 0.8 });
bus.unlockOnGesture();
const sfx = new SoundBank(bus);
const loops = new Map();
let last = null, lastWav = null;

function drawWave(canvas, x) {
  const w = canvas.width = 520, h = canvas.height = 112, g = canvas.getContext('2d');
  g.fillStyle = '#4b7bec';
  const per = x.length / w;
  for (let c = 0; c < w; c++) {
    let lo = 0, hi = 0;
    for (let i = Math.floor(c * per); i < Math.floor((c + 1) * per); i++) { const v = x[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    g.fillRect(c, h / 2 - hi * h / 2, 1, Math.max(1, (hi - lo) * h / 2));
  }
}

function renderCards() {
  const grid = $('grid');
  for (const name of sfx.names) {
    const s = SOUND_PRESETS[name], x = sfx.render(name, 0), m = dsp.measure(x, PRESET_SAMPLE_RATE);
    const canvas = el('canvas');
    drawWave(canvas, x);
    const nums = `peak ${m.peak.toFixed(2)} · centroid ${m.centroid.toFixed(0)} Hz (${s.centroid[0]}–${s.centroid[1]})\n`
      + `${m.seconds.toFixed(2)} s · ${s.variants} variant${s.variants > 1 ? 's' : ''} · bus ${s.bus} · ${dsp.hashSamples(x)}`;
    const btn = el('button', { type: 'button', className: 'card' },
      el('div', { className: 'row' }, el('b', { textContent: name }), el('span', { className: 'kind', textContent: s.kind === 'loop' ? 'loop' : 'one-shot' })),
      canvas, el('div', { className: 'nums', textContent: nums, style: 'white-space: pre-line' }));
    btn.addEventListener('click', async () => {
      await bus.start();
      if (s.kind === 'loop') {
        const l = loops.get(name);
        if (l) { l.stop(0.3); loops.delete(name); btn.setAttribute('aria-pressed', 'false'); } else { loops.set(name, sfx.loop(name, { gain: 0.8 })); btn.setAttribute('aria-pressed', 'true'); }
      } else sfx.play(name);
    });
    grid.append(el('li', {}, btn));
  }
}

const dbText = (v) => `${v.toFixed(1)} dBFS`;
function showReport(r) {
  const tb = $('table').tBodies[0];
  const row = (k, v, ok) => el('tr', {}, el('th', { textContent: k }), el('td', { textContent: v, className: ok === undefined ? '' : ok ? 'ok' : 'bad' }));
  tb.replaceChildren(
    row('peak', `${r.peak.toFixed(3)}  (limit 0.85)`, r.peak <= 0.85),
    row('clipped samples', String(r.clipped), r.clipped === 0),
    row('NaN samples', String(r.nan), r.nan === 0),
    row('DC', r.dc.toExponential(1), r.dc < 0.01),
    row('quietest half-second', `${dbText(r.quietest)}  (limit -60)`, r.quietest >= -60),
    row('loudest half-second', `${dbText(r.loudest)}  (${(r.loudest - r.median).toFixed(1)} dB over the median ${dbText(r.median)}, limit 12)`, r.loudest - r.median <= 12),
    row('rendered', `${r.seconds} s at ${r.sampleRate} Hz in ${r.renderMs} ms`),
  );
  $('table').hidden = false;
  const c = $('chart'), g = c.getContext('2d'), n = r.loudness.length, bw = c.width / n, y = (db) => c.height * (1 - (db + 60) / 60);
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = '#262b35'; g.fillRect(0, y(r.median), c.width, 1);
  r.loudness.forEach((db, i) => {
    g.fillStyle = db - r.median > 12 || db < -60 ? '#e0745f' : '#4b7bec';
    g.fillRect(i * bw + 2, y(db), bw - 4, c.height - y(db));
  });
  g.fillStyle = '#8e97a6'; g.font = '12px system-ui'; g.fillText('loudness per 0.5 s, -60..0 dBFS; line: median', 6, 14);
  c.hidden = false;
  const st = $('status');
  st.textContent = r.ok ? 'Pass: every limit holds.' : `Fail: ${r.failures.join('; ')}`;
  st.className = `st-status ${r.ok ? 'ok' : 'bad'}`;
}

async function runSelfTest() {
  $('status').textContent = 'Rendering ten seconds offline...';
  const r = await audioSelfTest({ seconds: 10, build: buildScene });
  last = r;
  lastWav = encodeWav(r.samples, r.sampleRate);
  const a = $('wav');
  if (a.href) URL.revokeObjectURL(a.href);
  a.href = URL.createObjectURL(new Blob([lastWav], { type: 'audio/wav' }));
  a.hidden = false;
  showReport(r);
  return r;
}

$('run').addEventListener('click', async () => { $('run').disabled = true; try { await runSelfTest(); } finally { $('run').disabled = false; } });
$('play').addEventListener('click', async () => {
  // the same scene, live, on its own bus (stepped by a timer from the context clock)
  $('play').disabled = true;
  const live = new AudioBus({ master: 'safe', volume: 0.8 });
  const step = buildScene(live);
  await live.start();
  const t0 = live.now;
  let prev = 0;
  const id = setInterval(() => {
    const t = live.now - t0;
    step(t, t - prev); prev = t;
    if (t > 10) { clearInterval(id); live.setPaused(true, 0.3); setTimeout(() => { live.dispose(); $('play').disabled = false; }, 600); }
  }, 1000 / 60);
});

renderCards();
window.__sample = {
  ready: true, poses: [],
  info: () => ({ renderer: '', drawCalls: 0, triangles: 0, size: { w: innerWidth, h: innerHeight, pixelRatio: devicePixelRatio } }),
  /** Run the scene offline and measure it: '' when every limit holds, else the failures. */
  async selfTest() { try { const r = await runSelfTest(); return r.ok ? '' : r.failures.join('; '); } catch (e) { return String(e && e.message || e); } },
  /** The last self-test's numbers (no samples). */
  report: () => last && { ok: last.ok, failures: last.failures, peak: last.peak, clipped: last.clipped, nan: last.nan, dc: last.dc, loudness: last.loudness, median: last.median, quietest: last.quietest, loudest: last.loudest, renderMs: last.renderMs },
  /** The last self-test's mix as a WAV file, base64. */
  wavBase64() {
    if (!lastWav) return '';
    let s = '';
    for (let i = 0; i < lastWav.length; i += 0x8000) s += String.fromCharCode(...lastWav.subarray(i, i + 0x8000));
    return btoa(s);
  },
};
