// The Engine's adaptive resolution (src/core/Engine.js, header "Adaptive resolution"), run on a stand-in engine
// (Engine.prototype, Node has no WebGL) against modelled frames: a frame's work is a fixed part plus a part that scales
// with the pixel count (pixel ratio squared), and its interval is the work, or the display's period when the work is
// shorter (vsync, frames pipelined as Chrome presents them). A frame held up by a stall (the work does not depend on
// the pixels) keeps its full ratio instead of sliding to 1 (a step down that does not help is undone, retried after
// 30, 60, 120, 240 s); a GPU-bound frame steps down to the ratio that fits and stays; after a start-up hitch, or when
// the load drops, the ratio climbs back, also on a 60 Hz screen where the interval cannot go under the budget (a probe,
// undone when it does not fit, with the same back-off). With internal scales (renderScales + onRenderScale, TAA
// upscaling) the same controller steps the scale first and the ratio below the lowest scale, the canvas kept; without
// them the ratio alone, as above. Run: node test/adaptive-resolution.mjs
import { Engine } from '../src/core/Engine.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

/**
 * Run the controller for `secs` seconds of modelled frames.
 * @param {(pr: number, t: number) => number} work  frame work (ms) at the effective ratio pr (pixel ratio x scale), time t (s)
 * @param {{ maxPR?: number, hz?: number, targetFps?: number, secs?: number, scales?: number[] }} o  hz: display rate
 *   (0: vsync off); scales: renderScales with onRenderScale set unless wired is false (changes: [t, ratio, scale])
 */
function run(work, { maxPR = 1.5, hz = 0, targetFps = 0, secs = 600, scales = null, wired = true } = {}) {
  const e = Object.create(Engine.prototype);
  const changes = [];
  Object.assign(e, { adaptive: true, maxPR, pixelRatio: maxPR, targetFps, refreshRate: hz, renderScale: 1, renderScales: scales || [], onRenderScale: null });
  const log = () => changes.push(scales ? [+t.toFixed(2), e.pixelRatio, e.renderScale] : [+t.toFixed(2), e.pixelRatio]);
  e.setPixelRatio = function (pr) { this.pixelRatio = pr; log(); };
  if (scales && wired) e.onRenderScale = log;
  e._resetAdaptive();
  let t = 0;
  const timeAt = new Map(); // pixel ratio -> seconds spent there
  const after = (t0) => { const m = new Map(); return { add: (pr, dt) => { if (t >= t0) m.set(pr, (m.get(pr) || 0) + dt); }, m }; };
  const tail = after(secs - 60);
  const period = hz > 0 ? 1000 / hz : 0, cap = targetFps > 0 ? 1000 / targetFps : 0;
  while (t < secs) {
    const ms = Math.max(work(e.pixelRatio * e.renderScale, t), period, cap);
    const dt = ms / 1000, k = scales ? `${e.pixelRatio}x${e.renderScale}` : e.pixelRatio;
    timeAt.set(k, (timeAt.get(k) || 0) + dt);
    tail.add(k, dt);
    t += dt;
    if (dt < 0.2) e._adapt(dt); // as tick() calls it
  }
  const share = (pr, m = timeAt) => (m.get(pr) || 0) / [...m.values()].reduce((a, b) => a + b, 0);
  return { changes, final: e.pixelRatio, scale: e.renderScale, share, tailShare: (pr) => share(pr, tail.m), downs: changes.filter((c, i) => c[1] < (i ? changes[i - 1][1] : maxPR)).length };
}
const fmt = (r) => `final ${r.final}${r.scale !== 1 ? `x${r.scale}` : ''}, ${r.changes.length} changes: ${r.changes.slice(0, 10).map((c) => `${c[0]}s->${c.slice(1).join('x')}`).join(' ')}${r.changes.length > 10 ? ' ...' : ''}`;

// ---------------------------------------------------------------------------------------- stall-bound frame
{
  // 20 ms whatever the pixel count (a main thread waiting on the GPU process), vsync off: the EMA is over 18.5 ms
  const r = run((pr) => 20 + 0.3 * pr * pr);
  check('stall: ends at the full ratio (before: slid to 1 and stayed)', r.final === 1.5, fmt(r));
  check('stall: under 5 % of the time below the full ratio', r.share(1.5) > 0.95, `${(100 * r.share(1.5)).toFixed(1)} % at 1.5`);
  check('stall: step-down retries back off (30, 60, 120, 240 s): at most 5 in 10 min', r.downs <= 5 && r.downs >= 3, `${r.downs} steps down`);
  check('stall: never below the first step (1.25)', r.changes.every((c) => c[1] >= 1.25), fmt(r));
}
{
  // the same on a 60 Hz screen
  const r = run((pr) => 21 + 0.3 * pr * pr, { hz: 60 });
  check('stall, 60 Hz: ends at the full ratio, under 5 % of the time below it', r.final === 1.5 && r.share(1.5) > 0.95, fmt(r));
}

// ------------------------------------------------------------------------------------------ GPU-bound frame
{
  // 2 ms + 9 ms per pixel-ratio^2: 22.3 ms at 1.5, 16.1 at 1.25 (fits), vsync off
  const r = run((pr) => 2 + 9 * pr * pr);
  check('GPU-bound: one step down to the ratio that fits, then holds it', r.final === 1.25 && r.changes.length === 1, fmt(r));
}
{
  // 3 ms + 12 per pr^2: 30 ms at 1.5, 21.8 at 1.25, 15 at 1.0
  const r = run((pr) => 3 + 12 * pr * pr);
  check('GPU-bound, heavy: two steps down to 1.0, then holds it', r.final === 1 && r.changes.length === 2 && r.changes[1][1] === 1, fmt(r));
}
{
  // 60 Hz, 2 + 8 per pr^2: 20 ms at 1.5 (misses the budget), 14.5 at 1.25 (fits): probes up are undone and back off
  const r = run((pr) => 2 + 8 * pr * pr, { hz: 60 });
  check('GPU-bound, 60 Hz: settles at 1.25', r.final === 1.25 && r.tailShare(1.25) > 0.95, fmt(r));
  const ups = r.changes.filter((c) => c[1] === 1.5).length;
  check('GPU-bound, 60 Hz: probes back off (at most 6 in 10 min), under 5 % of the time over budget', ups <= 6 && r.share(1.5) < 0.05,
    `${ups} probes, ${(100 * r.share(1.5)).toFixed(1)} % at 1.5`);
}

// ------------------------------------------------------------------------------------------- climbing back
{
  // a start-up hitch that scales with the pixels (40 ms frames at 1.5 for 5 s: the steps down help), then a light
  // scene (9.8 ms at 1.5), vsync off
  const r = run((pr, t) => (t < 5 ? 18 * pr * pr : 3 + 3 * pr * pr), { secs: 120 });
  const back = r.changes.find((c) => c[0] > 5 && c[1] === 1.5);
  check('after a start-up hitch: back to the full ratio within 10 s and stays', r.final === 1.5 && back && back[0] < 15 && r.tailShare(1.5) > 0.99, fmt(r));
}
{
  // the same on a 60 Hz screen: the interval never goes under 16.7 ms, so the way back is a probe
  const r = run((pr, t) => (t < 5 ? 18 * pr * pr : 3 + 3 * pr * pr), { hz: 60, secs: 60 });
  const back = r.changes.find((c) => c[0] > 5 && c[1] === 1.5);
  check('after a start-up hitch, 60 Hz: back to the full ratio within 10 s (before: stayed down under vsync)', r.final === 1.5 && back && back[0] < 15, fmt(r));
}
{
  // heavy for 60 s (down to 1.0), then the load drops (6 ms at 1.0, 11 at 1.5). Vsync off: the interval shows the
  // room at once. 60 Hz: the probes made while the load was heavy failed, so the next one waits out their back-off
  for (const [hz, within] of [[0, 10], [60, 250]]) {
    const r = run((pr, t) => (t < 60 ? 3 + 12 * pr * pr : 2 + 4 * pr * pr), { hz, secs: 400 });
    const back = r.changes.find((c) => c[0] > 60 && c[1] === 1.5);
    check(`load drops${hz ? ', 60 Hz' : ''}: climbs from 1.0 back to the full ratio within ${within} s and stays`, r.changes.some((c) => c[0] < 60 && c[1] === 1) && back && back[0] < 60 + within
      && r.final === 1.5 && r.tailShare(1.5) > 0.99, fmt(r));
  }
}
{
  // a frame that fits all along: no change at all (vsync off, 60 Hz, 120 Hz), and none on a 2x screen at 2.0
  for (const [hz, maxPR] of [[0, 1.5], [60, 1.5], [120, 1.5], [120, 2]]) {
    const r = run((pr) => 4 + 3 * pr * pr, { hz, maxPR });
    check(`fits at the full ratio (${hz || 'vsync off'}${hz ? ' Hz' : ''}, max ${maxPR}): never changes`, r.changes.length === 0, fmt(r));
  }
}
{
  // targetFps 120 on a 120 Hz screen: budget 8.3 ms; 1 + 4 per pr^2 = 10 ms at 1.5, 7.25 at 1.25, 5 at 1.0
  const r = run((pr) => 1 + 4 * pr * pr, { hz: 120, targetFps: 120 });
  check('targetFps 120 at 120 Hz: settles at the ratio that fits 8.3 ms (1.25)', r.final === 1.25 && r.tailShare(1.25) > 0.95, fmt(r));
}

// ------------------------------------------------------------------------- internal scales (TAA upscaling)
{
  const scales = [1, 0.87, 0.75, 0.67];
  // 2 ms + 9 per (ratio x scale)^2: 22.3 ms at 1.5, 17.3 at 1.5 x 0.87 (fits): one scale step, the ratio kept
  const a = run((q) => 2 + 9 * q * q, { scales });
  check('scales, GPU-bound: one scale step (0.87), the pixel ratio kept, then holds', a.final === 1.5 && a.scale === 0.87
    && a.changes.length === 1, fmt(a));
  // 3 + 14 per q^2: 34.5 ms at 1.5, 20.7 at 1.5 x 0.75, 17.1 at 1.5 x 0.67 (fits): every scale, no ratio step
  const b = run((q) => 3 + 14 * q * q, { scales });
  check('scales, heavy: down the scales to 0.67, the pixel ratio kept', b.final === 1.5 && b.scale === 0.67
    && b.changes.length === 3 && b.changes.every((c) => c[1] === 1.5), fmt(b));
  // 4 + 20 per q^2: 49 ms at 1.5, 24.2 at 1.5 x 0.67, 18.0 at 1.25 x 0.67 (fits): the ratio steps below the lowest scale
  const c = run((q) => 4 + 20 * q * q, { scales });
  check('scales, heavier: below the lowest scale the ratio steps (1.25 x 0.67)', c.final === 1.25 && c.scale === 0.67
    && c.changes.length === 4, fmt(c));
  // heavy for 60 s, then light: climbs back, the ratio first, then the scales, to 1.5 x 1
  const d = run((q, t) => (t < 60 ? 4 + 20 * q * q : 2 + 3 * q * q), { scales, secs: 120 });
  const up = d.changes.filter((ch) => ch[0] > 60);
  check('scales, load drops: climbs the ratio first, then the scales, back to 1.5 x 1', d.final === 1.5 && d.scale === 1
    && up[0][1] === 1.5 && up[0][2] === 0.67 && up.length === 4, fmt(d));
  // a stall (20 ms whatever the pixels): the scale steps are undone with the back-off, never below 0.87
  const e = run((q) => 20 + 0.3 * q * q, { scales });
  check('scales, stall: at full size over 95 % of the time, never below the first scale step', e.final === 1.5 && e.scale === 1
    && e.share('1.5x1') > 0.95 && e.changes.every((ch) => ch[1] === 1.5 && ch[2] >= 0.87), fmt(e));
  // the scales without onRenderScale (no TAA wired): the pixel ratio as before
  const f = run((q) => 3 + 12 * q * q, { scales, wired: false });
  check('scales without onRenderScale: the pixel ratio steps (to 1.0), the scale stays 1', f.final === 1 && f.scale === 1, fmt(f));
}

for (const r of results) console.log(r);
console.log(`\n${results.length - failures}/${results.length} adaptive-resolution checks passed`);
process.exit(failures ? 1 : 0);
