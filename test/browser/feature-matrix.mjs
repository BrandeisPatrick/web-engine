// Feature matrix: every rendering option drawn on the real GPU and checked, so a shader that does not compile on
// ANGLE / Metal, a pass that renders black or an option that changes nothing cannot pass unnoticed. One page, nyc-night
// on the desktop tier at 1280x720 (clustered street-lamp spots, shadows, SSR on wet streets, volumetric light, the
// walker in the `sidewalk` pose; dusk), loaded once per shadow cascade count (?cascades=1..4: the count is fixed when
// the Atmosphere is built); the shadow rows use the `square` pose at 11:00, where the sun's cascades show. Each pose is
// visited once after a load before any row (its first visit still loads and later captures differ a little). Each row
// applies its settings on the live page, poses through the bench harness (src/core/Bench.js pose / settle / capture /
// diff), then restores the state it found. Per row:
//   - no console error, page error, shader compile / link error, and gl.getError() clean after the row;
//   - the picture is sane: not black, not blown out, not tinted (smoke's look gate, SANE_LOOK below);
//   - two captures of the row agree within perf's image guard (mean 0.35 / 255, 1 % of pixels over 8);
//   - against its reference row the picture changes by a mean in [min, max] / 255: a row equal to its reference is a
//     dead option, one far beyond it a broken pass; `same` rows must equal their reference (pass-through promises:
//     motion blur on a still frame, PCSS falling back to PCF at 4 cascades, the canvas back at its first size).
// Rows: every PostFX option and pass on / off, the anti-aliasing modes with the G-buffer on and off, shadow kernels
// 'pcf' / 'fast' / 'pcss' x 1-4 cascades, clustered lights on / off, both quality tiers' own defaults
// (core/Quality.js QUALITY_TIERS), the camera and walker travelling (velocity, TAA history, motion blur in motion),
// and the canvas resized, its pixel ratio changed and one adaptive-resolution step forced, then back to the start.
// Prints one table (row, result, measured difference) and exits 1 on any failing row that is not KNOWN_FAILING.
//
//   node test/browser/feature-matrix.mjs [--headed] [--only=<substring>]
import {
  readyTimeoutMs, parseArgs, startVite, launchChrome, watchErrors, loadSample, evalStep, withTimeout,
  onSignals, formatTable, lookFailure, PAGE_LOOK,
} from './playwright.config.mjs';
import { QUALITY_TIERS } from '../../src/core/Quality.js';
import { lookStats } from '../../src/core/Bench.js';

// Rows that fail because of a known engine bug, with the reason: reported as KNOWN, not counted as a failure. Remove a
// row from here when its bug is fixed (the script then holds it again).
const KNOWN_FAILING = {
};

const POSE = 'sidewalk', DAY = { hours: 11, pose: 'square' }, SIZE = { w: 1280, h: 720 }, SCALE = 4;
const SAME = { meanAbs: 0.35, pctOver8: 1.0 }; // perf's image guard (test/browser/perf.mjs TOL.imgMean / imgOver8)
const SANE_LOOK = PAGE_LOOK['nyc-night-low'].default; // not black, not blown out (smoke's limits for any look)
const TINT = { palette: PAGE_LOOK['nyc-night'].default.palette, off: 4, hue: 20 }; // smoke's nyc-night cast limits

// A quality tier's own defaults as a row (shadow kernel, PostFX options, passes, clustered lights); `{}` = the
// pass's default options, so the tier's values replace the page's tuning.
const tierRow = (t) => {
  const Q = QUALITY_TIERS[t], p = Q.postfx, on = (v) => (v === true ? {} : v);
  return {
    kernel: Q.shadows.kernel, lights: Q.lights.clustered ? 'clustered' : 'pool',
    set: { gbuffer: p.gbuffer, aa: p.aa, ssr: on(p.ssr), volumetric: on(p.volumetric), motionBlur: p.motionBlur, 'ao.enabled': Q.passes.ao, 'bloom.enabled': Q.passes.bloom },
  };
};

// id, load (cascade count of the page), what it applies, its reference row and the change expected against it: mean
// difference / 255, about a quarter to four times what an Apple M4 measured (2026-11-21), so a dead option and a
// broken pass both fall outside
const ROWS = [
  { id: 'base', load: 2 },
  { id: 'ao off', load: 2, set: { 'ao.enabled': false }, ref: 'base', change: [0.1, 2] },
  { id: 'ao normals gbuffer', load: 2, set: { 'ao.normals': 'gbuffer' }, ref: 'base', change: [0.015, 0.5] },
  { id: 'ssr off', load: 2, set: { ssr: false }, ref: 'base', change: [0.1, 3] },
  { id: 'volumetric off', load: 2, set: { volumetric: false }, ref: 'base', change: [0.05, 1.5] },
  { id: 'bloom off', load: 2, set: { 'bloom.enabled': false }, ref: 'base', change: [0.02, 1] },
  { id: 'taa -> fxaa', load: 2, set: { aa: 'fxaa' }, ref: 'base', change: [0.08, 2] },
  { id: 'renderScale 0.75', load: 2, set: { renderScale: 0.75 }, ref: 'base', change: [0.25, 4] },
  { id: 'dof', load: 2, set: { dof: true }, ref: 'base', change: [0.5, 8] },
  { id: 'motion blur, still', load: 2, set: { motionBlur: 1 }, ref: 'base', same: true },
  { id: 'gbuffer off, msaa', load: 2, set: { gbuffer: false, aa: 'msaa' }, ref: 'base', change: [0.2, 4] },
  { id: 'gbuffer off, fxaa', load: 2, set: { gbuffer: false, aa: 'fxaa' }, ref: 'gbuffer off, msaa', change: [0.1, 2.5] },
  { id: 'clustered off', load: 2, lights: 'pool', ref: 'base', change: [1.5, 15] },
  { id: 'moving', load: 2, move: true },
  { id: 'moving, motion blur', load: 2, move: true, set: { motionBlur: 1 }, ref: 'moving', change: [0.1, 3] },
  // kernels x cascades, late morning in the square (at dusk the sun's shadows barely show, and the sidewalk view ends
  // inside the near cascade): each kernel against 'pcf' of its page, each count's 'pcf' against 2 cascades' 'pcf'
  ...[2, 1, 3, 4].flatMap((c) => [
    { id: `pcf x${c}`, load: c, ...DAY, kernel: 'pcf', ...(c === 2 ? {} : { ref: 'pcf x2', change: [0.03, 1.5] }) },
    { id: `fast x${c}`, load: c, ...DAY, kernel: 'fast', ref: `pcf x${c}`, change: [0.008, 0.4] },
    // 4 cascades leave too few texture units for PCSS: it warns and stays on PCF (Atmosphere._fastShadowsOk)
    c === 4 ? { id: 'pcss x4 (pcf fallback)', load: c, ...DAY, kernel: 'pcss', ref: 'pcf x4', same: true, kernelIs: 'pcf' }
      : { id: `pcss x${c}`, load: c, ...DAY, kernel: 'pcss', ref: `pcf x${c}`, change: [0.025, 1] },
  ]),
  { id: 'desktop tier', load: QUALITY_TIERS.desktop.shadows.cascades, ...tierRow('desktop'), ref: 'base', change: [0.15, 3] },
  { id: 'mobile tier', load: QUALITY_TIERS.mobile.shadows.cascades, ...tierRow('mobile'), ref: 'base', change: [1.5, 15] },
  // resize: portrait canvas, pixel ratio 1.5, one adaptive step down (1.5 -> 1.25), then back to the first capture
  { id: 'portrait 540x960', load: 2, size: { w: 540, h: 960 } },
  { id: 'pixel ratio 1.5', load: 2, size: { w: 1280, h: 720, pr: 1.5 } },
  { id: 'adaptive step', load: 2, size: { w: 1280, h: 720, pr: 1.5, adapt: true }, prIs: 1.25 },
  { id: 'back to start', load: 2, size: { w: 1280, h: 720 }, ref: 'base', same: true },
];

// In the page: apply a row, pose, capture twice, restore. Returns the second capture (data as a plain array), the
// stability diff, the diff against `ref` (sent in) and what the row could observe (kernel in effect, size, light count).
async function runRow({ row, pose, scale, ref }) {
  const h = window.__sample, N = window.__nyc, P = N.postfx, E = h.engine, gl = E.renderer.getContext();
  while (gl.getError() !== gl.NO_ERROR) { /* drain errors of earlier rows */ }
  const keep = {
    gbuffer: P.get('gbuffer'), aa: P.get('aa'), renderScale: P.get('renderScale'), 'ao.enabled': P.get('ao.enabled'),
    'ao.normals': P.get('ao.normals'), 'bloom.enabled': P.get('bloom.enabled'), ssr: P.ssr ? { ...P.ssrOptions } : false,
    volumetric: P.volumetric ? { ...P.volumetricOptions } : false, motionBlur: P.get('motionBlur'), dof: P.get('dof'),
  };
  const kernel = N.atmo.shadowKernel, hours = N.atmo.hours, lights = N.world.props.lightPool.mode, maxPR = E.maxPR;
  const shot = () => {
    h.pose(row.pose || pose);
    if (row.move) { // camera and walker travel together at 9 m/s, TAA jittering and accumulating from a reset history
      const cam = E.camera, ent = N.player.entity, f = cam.getWorldDirection(new cam.position.constructor()).setY(0).normalize();
      h.converge.begin(h);
      for (let i = 0; i < 25; i++) {
        cam.position.addScaledVector(f, 0.15); ent.position.addScaledVector(f, 0.15);
        cam.updateMatrixWorld(); ent.updateMatrixWorld(true);
        if (i < 24) h.render();
      }
    }
    return h.capture(scale);
  };
  try {
    if (row.size) {
      h.resize(row.size.w, row.size.h); // pixel ratio 1, adaptive off
      if (row.size.pr) { E.maxPR = row.size.pr; E.setPixelRatio(row.size.pr); }
      if (row.size.adapt) { // frames of 50 ms at a 60 fps budget: the controller steps the pixel ratio down once
        E._resetAdaptive();
        for (let i = 0; i < 60 && E.pixelRatio === row.size.pr; i++) E._adapt(0.05);
      }
    }
    if (row.hours) N.atmo.setTime(row.hours);
    if (row.lights) N.world.setLightMode(row.lights);
    for (const k in row.set || {}) P.set(k, row.set[k]);
    if (row.kernel) N.atmo.setShadowKernel(row.kernel);
    await h.settle();
    const a = shot(), b = shot();
    const out = {
      w: b.w, h: b.h, data: Array.from(b.data), stable: h.diff(a, b), kernel: N.atmo.shadowKernel,
      size: h.size, cascades: N.atmo.cascadeCount, clustered: N.world.clustered ? N.world.clustered.count : 0, glError: gl.getError(),
    };
    if (ref) out.vs = ref.w === b.w && ref.h === b.h ? h.diff({ ...ref, scale, data: Uint16Array.from(ref.data) }, b) : 'size';
    return out;
  } finally {
    if (row.kernel) N.atmo.setShadowKernel(kernel);
    if (row.hours) N.atmo.setTime(hours);
    for (const k of ['gbuffer', 'aa', 'renderScale', 'ao.enabled', 'ao.normals', 'bloom.enabled', 'ssr', 'volumetric', 'motionBlur', 'dof']) {
      if (row.set && k in row.set) P.set(k, keep[k]);
    }
    if (row.lights) N.world.setLightMode(lights);
    E.maxPR = maxPR;
  }
}

const args = parseArgs();
const picked = ROWS.filter((r) => !args.only || r.id.includes(args.only));
const rows = ROWS.filter((r) => picked.includes(r) || picked.some((p) => p.ref === r.id)); // --only keeps references
const results = [], caps = new Map(), t0 = Date.now();
let vite = null, browser = null, page = null;
const cleanup = async () => {
  if (browser) { const b = browser; browser = null; await withTimeout(b.close(), 15000, 'browser close').catch(() => {}); }
  if (vite) { const v = vite; vite = null; await v.close().catch(() => {}); }
};
onSignals(cleanup);

const r2 = (v) => Math.round(v * 100) / 100;
function judge(row, res, newErrors) {
  const bad = [];
  if (newErrors.length) bad.push(...newErrors.map((e) => e.slice(0, 300)));
  if (res.glError) bad.push(`gl.getError() 0x${res.glError.toString(16)}`);
  if (res.stable.meanAbs > SAME.meanAbs || res.stable.pctOver8 > SAME.pctOver8) bad.push(`two captures differ: mean ${res.stable.meanAbs}, ${res.stable.pctOver8} % over 8`);
  const look = lookStats({ w: res.w, h: res.h, scale: SCALE, data: res.data });
  const lk = lookFailure(look, { ...SANE_LOOK, ...TINT });
  if (lk) bad.push(`look: ${lk}`);
  if (res.cascades !== row.load) bad.push(`${res.cascades} shadow cascades in effect, expected ${row.load}`);
  if (row.kernelIs && res.kernel !== row.kernelIs) bad.push(`kernel in effect ${res.kernel}, expected ${row.kernelIs}`);
  if (row.prIs && res.size.pixelRatio !== row.prIs) bad.push(`pixel ratio ${res.size.pixelRatio} after the adaptive step, expected ${row.prIs}`);
  if (row.size && (res.size.w !== Math.floor(row.size.w * (row.prIs || row.size.pr || 1)) || res.size.h !== Math.floor(row.size.h * (row.prIs || row.size.pr || 1)))) bad.push(`drawing buffer ${res.size.w}x${res.size.h}`);
  if (row.ref) {
    const d = res.vs;
    if (d === 'size') bad.push(`not the size of '${row.ref}'`);
    else if (!d) bad.push(`no reference '${row.ref}'`);
    else if (row.same) { if (d.meanAbs > SAME.meanAbs || d.pctOver8 > SAME.pctOver8) bad.push(`differs from '${row.ref}' (mean ${d.meanAbs}, ${d.pctOver8} % over 8), expected the same picture`); }
    else if (d.meanAbs < row.change[0]) bad.push(`changes the picture by ${d.meanAbs} (min ${row.change[0]}): a dead option`);
    else if (d.meanAbs > row.change[1]) bad.push(`changes the picture by ${d.meanAbs} (max ${row.change[1]})`);
  }
  return { bad, look };
}

try {
  vite = await startVite();
  browser = await launchChrome({ headless: !args.headed });
  const context = await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, deviceScaleFactor: 1 });
  for (const load of [...new Set(rows.map((r) => r.load))]) {
    if (page) await withTimeout(page.close({ runBeforeUnload: false }), 15000, 'close').catch(() => {});
    page = await context.newPage();
    const errors = watchErrors(page);
    const url = `${vite.base}/nyc-night/?bench=1&size=${SIZE.w}x${SIZE.h}&quality=desktop&cascades=${load}`;
    const s = await loadSample(page, url, errors, { timeout: readyTimeoutMs });
    console.log(`[feature-matrix] cascades=${load}: ${s.status} in ${(s.loadMs / 1000).toFixed(1)} s${s.note ? ` (${s.note})` : ''}`);
    if (s.status !== 'ready') { results.push({ row: `load cascades=${load}`, result: 'FAIL', note: [s.note, ...errors].join('; ').slice(0, 400) }); continue; }
    // visit each pose of this page once first: the first visit still loads (a later capture of it differs a little)
    const poses = [...new Set(rows.filter((r) => r.load === load).map((r) => r.pose || POSE))];
    await evalStep(page, errors, s, async (ids) => {
      for (const id of ids) { window.__sample.pose(id); await window.__sample.settle(); await new Promise((r) => setTimeout(r, 1000)); }
    }, poses, { ms: 90000, what: 'warm poses' });
    for (const row of rows.filter((r) => r.load === load)) {
      const n0 = errors.length, tr = Date.now();
      let res, note = [];
      try {
        const ref = row.ref ? caps.get(row.ref) || null : null;
        res = await evalStep(page, errors, s, runRow, { row, pose: POSE, scale: SCALE, ref }, { ms: 90000, what: row.id });
        caps.set(row.id, { w: res.w, h: res.h, data: res.data });
        const j = judge(row, res, errors.slice(n0));
        note = j.bad;
        res.look = j.look;
      } catch (e) {
        note = [`${e.message.split('\n')[0]}`, ...errors.slice(n0)];
      }
      const known = KNOWN_FAILING[row.id];
      const result = note.length ? (known ? 'KNOWN' : 'FAIL') : known ? 'PASS (known?)' : 'pass';
      const d = res && res.vs && typeof res.vs === 'object' ? res.vs : null;
      results.push({
        row: row.id, result, vs: row.ref || '-', mean: d ? d.meanAbs : '-', over8: d ? `${d.pctOver8}%` : '-',
        expect: !row.ref ? '-' : row.same ? 'same' : `${row.change[0]}..${row.change[1]}`, stable: res ? res.stable.meanAbs : '-',
        lum: res && res.look ? r2(res.look.lumMean) : '-', size: res ? `${res.size.w}x${res.size.h}` : '-', s: ((Date.now() - tr) / 1000).toFixed(1),
        note: [...note, ...(known && note.length ? [`known: ${known}`] : [])].join('; ').slice(0, 400),
      });
    }
  }
} catch (e) {
  results.push({ row: 'feature-matrix', result: 'FAIL', note: e.stack || e.message });
} finally {
  await cleanup();
}

console.log(`\n${formatTable(results, ['row', 'result', 'vs', 'mean', 'over8', 'expect', 'stable', 'lum', 'size', 's', 'note'])}`);
const failed = results.filter((r) => r.result === 'FAIL');
console.log(`\n[feature-matrix] ${failed.length ? `FAILED (${failed.length} row(s))` : 'OK'} · ${results.length} rows · ${results.filter((r) => r.result === 'KNOWN').length} known failing · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failed.length ? 1 : 0);
