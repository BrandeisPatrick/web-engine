// The performance ratchet (`npm run perf`): measures every sample view (page x quality tier, bench/budgets.json) at its
// fixed size in headless Chrome on the real GPU, reduces the result to ONE score, compares it with the committed
// baseline of this machine and guards the image, so that a change can be judged by a number:
//
//   score = 100 x geometric mean over every pose of every view of (ms budget of the view / measured ms)
//           100 = on budget on average; higher is faster. A pose's ms is the median of `--repeats` GPU-synchronised
//           runs of `--frames` frames (window.__sample.bench, src/core/Bench.js).
//
// Guards (a faster frame that breaks one of them is not an improvement):
//   image     each pose's capture against the golden image of the baseline: identical hash, or a pixel difference
//             inside the baseline's own load-to-load noise (so "faster" cannot mean "renders less")
//   counters  draw calls, triangles, JS heap and downloaded asset bytes against the baseline (+5 / +5 / +10 / +3 %)
//   noise     a pose whose runs spread more than 6 % is inconclusive (exit 2): close other GPU work and run again
// The look gate (tone and palette limits) and frame stability stay in the smoke test (`npm run smoke`).
//
//   node test/browser/perf.mjs                       measure everything, compare with the baseline, write bench/last.json
//   node test/browser/perf.mjs nyc-night             only these views (ids from bench/budgets.json)
//   node test/browser/perf.mjs --costs               also the cost table: every on / off knob switched off, per view
//   node test/browser/perf.mjs --update --log="what changed"      ratchet: accept improvements as the new baseline
//   node test/browser/perf.mjs --update --accept="why"            accept a regression or an image change on purpose
//   node test/browser/perf.mjs --dropped="what was tried, why it lost"   record a dropped experiment in bench/LOG.md
// Options: --repeats (5), --frames (24), --headed, --config (another vite config), --json (print the result as JSON).
// Exit code: 0 no regression, 1 a regression / guard failure / error, 2 inconclusive (noise).
// Files: bench/budgets.json (goals), bench/baseline/<machine>.json (committed: the last accepted numbers; its git
// history is the performance history), bench/LOG.md (committed: one row per accepted or dropped change),
// bench/.golden/<machine>/ and bench/last.json (local, ignored: the baseline's images and the last run).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  repoRoot, headedArgs, headlessArgs, parseArgs, parseSize, startVite, resolvePage, launchChrome,
  watchErrors, loadSample, evalStep, withTimeout, onSignals, formatTable, today,
} from './playwright.config.mjs';

const args = parseArgs();
const REPEATS = Math.max(3, Number(args.repeats) || 5), FRAMES = Math.max(4, Number(args.frames) || 24);
const UPDATE = !!args.update, COSTS = !!args.costs, ACCEPT = typeof args.accept === 'string' ? args.accept : args.accept ? 'accepted' : '';
const NOTE = typeof args.log === 'string' ? args.log : '', DROPPED = typeof args.dropped === 'string' ? args.dropped : '';
const TOL = { ms: [0.04, 0.15], drawCalls: 0.05, triangles: 0.05, heapMB: 0.10, assetMB: 0.03, spread: 0.06, imgMean: 0.35, imgOver8: 1.0 };
const benchDir = path.join(repoRoot, 'bench');
const budgets = JSON.parse(fs.readFileSync(path.join(benchDir, 'budgets.json'), 'utf8'));
const wanted = args._.length ? args._ : Object.keys(budgets.views);
for (const id of wanted) if (!budgets.views[id]) { console.error(`[perf] unknown view '${id}' (bench/budgets.json: ${Object.keys(budgets.views).join(', ')})`); process.exit(1); }

const r2 = (v) => Math.round(v * 100) / 100, r1 = (v) => Math.round(v * 10) / 10;
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
// spread of the runs without the single fastest and slowest one (a stray hitch does not make a pose "noisy")
const spreadOf = (a) => { const s = [...a].sort((x, y) => x - y); const t = s.length >= 5 ? s.slice(1, -1) : s; return (t[t.length - 1] - t[0]) / median(a); };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function machineOf(renderer) { // 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)' -> 'apple-m4'
  const m = /Renderer:\s*([^,)]+)/i.exec(renderer) || /ANGLE \([^,]+,\s*([^,)]+)/i.exec(renderer);
  return slug(m ? m[1] : renderer) || 'unknown';
}
const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };

// ---------------------------------------------------------------------------------------------- in-page functions
function pageMeasure({ pose, repeats, frames }) {
  const s = window.__sample;
  s.pose(pose);
  return s.settle().then(() => {
    const ms = [];
    for (let i = 0; i < repeats; i++) ms.push(s.bench(frames));
    const info = s.info(), look = s.look ? s.look(4) : null, cap = s.capture(8);
    const u8 = new Uint8Array(cap.data.buffer, cap.data.byteOffset, cap.data.byteLength);
    let bin = '';
    for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return { ms, drawCalls: info.drawCalls, triangles: info.triangles, textures: info.memory.textures, geometries: info.memory.geometries,
      programs: info.memory.programs, renderer: info.renderer, size: info.size, look, hash: cap.hash, cap: { w: cap.w, h: cap.h, scale: cap.scale, b64: btoa(bin) } };
  });
}
function pageTotals() {
  if (typeof window.gc === 'function') { window.gc(); window.gc(); }
  const pm = performance.memory, re = /\.(jpe?g|png|webp|avif|ktx2|hdr|exr|glb|gltf|bin|json|cube|mp3|ogg|wav|wasm)(\?|$)/i;
  let bytes = 0;
  for (const e of performance.getEntriesByType('resource')) if (re.test(e.name) && !/node_modules|@vite|@fs/.test(e.name)) bytes += e.encodedBodySize || e.decodedBodySize || 0;
  return { heapMB: pm ? pm.usedJSHeapSize / 1048576 : null, assetMB: bytes / 1048576 };
}
async function pageCosts({ frames }) {
  const s = window.__sample, knobs = s.settings.filter((p) => { try { return s.get(p) === true; } catch { return false; } });
  // pixel share: the first pose at the full size and at half the width and height (a quarter of the pixels). With
  // ms = fixed + k x pixels, the part of the frame that scales with resolution is (full - half) x 4 / 3.
  const full = s.size, pose0 = s.poses[0];
  s.pose(pose0); await s.settle(); const msFull = s.bench(frames);
  s.resize(Math.max(2, full.w >> 1), Math.max(2, full.h >> 1)); s.pose(pose0); await s.settle(); const msHalf = s.bench(frames);
  s.resize(full.w, full.h); s.pose(pose0); await s.settle();
  const pixelShare = Math.max(0, Math.min(1, (msFull - msHalf) * 4 / 3 / msFull));
  if (!knobs.length) return { knobs, rows: [], pixelShare, pose0 };
  const r = await s.run({ poses: [], frames, warmup: 3, settings: [{ label: 'default', set: {} }, ...knobs.map((p) => ({ label: p, set: { [p]: false } }))] });
  return { knobs, rows: r.rows.map((x) => ({ setting: x.setting, pose: x.pose, ms: x.ms, meanAbs: x.meanAbs })), pixelShare, pose0 };
}

// ------------------------------------------------------------------------------------------------------- captures
const capData = (c) => { const b = Buffer.from(c.b64, 'base64'); return new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2); };
function capDiff(a, A, b, B) { // as Bench.js diff(): per pixel (|dr| + |dg| + |db|) / 3 in 0..255
  if (a.w !== b.w || a.h !== b.h || a.scale !== b.scale) return null;
  const n = a.w * a.h, q = 3 * a.scale * a.scale;
  let sum = 0, over8 = 0;
  for (let p = 0, k = 0; p < n; p++, k += 4) {
    const d = Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]);
    sum += d; if (d > 8 * q) over8++;
  }
  return { meanAbs: Math.round(1000 * sum / q / n) / 1000, pctOver8: r2(100 * over8 / n) };
}
const goldenFile = (machine, view, pose) => path.join(benchDir, '.golden', machine, `${view}-${pose}.json`);
function readGolden(machine, view, pose) {
  try { const g = JSON.parse(fs.readFileSync(goldenFile(machine, view, pose), 'utf8')); return { ...g, data: capData(g) }; } catch { return null; }
}
function writeGolden(machine, view, pose, hash, cap) {
  const f = goldenFile(machine, view, pose);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ hash, w: cap.w, h: cap.h, scale: cap.scale, b64: cap.b64 }));
}

// ------------------------------------------------------------------------------------------------------------ run
let vite = null, browser = null;
const cleanup = async () => {
  if (browser) { const b = browser; browser = null; await withTimeout(b.close(), 15000, 'browser close').catch(() => {}); }
  if (vite) { const v = vite; vite = null; await v.close().catch(() => {}); }
};
onSignals(cleanup);

async function measureView(id, { costs = false } = {}) {
  const v = budgets.views[id], size = parseSize(v.size);
  const pagePath = await resolvePage(vite, v.page);
  if (!pagePath) return { id, skipped: 'no such page on this server' };
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  // the resource-timing buffer holds 250 entries by default: a dev server's module requests fill it before the
  // assets load, and pageTotals() would miss them
  await context.addInitScript(() => { try { performance.setResourceTimingBufferSize(20000); } catch { /* not supported */ } });
  const page = await context.newPage(), errors = watchErrors(page);
  try {
    const url = `${vite.base}${pagePath}?bench=1&size=${size.w}x${size.h}&quality=${v.tier}`;
    const s = await loadSample(page, url, errors);
    if (s.status === 'skipped') return { id, skipped: 'the page has no bench harness (window.__sample)' };
    if (s.status !== 'ready') throw new Error(`${id}: ${s.note}${errors.length ? `\n  ${errors.join('\n  ')}` : ''}`);
    const poses = await evalStep(page, errors, s, () => window.__sample.poses.slice(), undefined, { what: 'poses' });
    const out = { id, loadMs: s.loadMs, poses: {}, caps: {}, renderer: '', errors };
    for (const pose of poses) {
      const m = await evalStep(page, errors, s, pageMeasure, { pose, repeats: REPEATS, frames: FRAMES }, { ms: 60000 + REPEATS * FRAMES * 400, what: `measure ${pose}` });
      out.renderer = m.renderer;
      out.caps[pose] = m.cap;
      out.poses[pose] = { ms: r2(median(m.ms)), spread: Math.round(1000 * spreadOf(m.ms)) / 1000, runs: m.ms.map(r2), drawCalls: m.drawCalls, triangles: m.triangles,
        textures: m.textures, programs: m.programs, look: m.look, hash: m.hash };
    }
    const t = await evalStep(page, errors, s, pageTotals, undefined, { what: 'totals' });
    out.heapMB = t.heapMB === null ? null : r1(t.heapMB); out.assetMB = r2(t.assetMB);
    if (costs) {
      const c = await evalStep(page, errors, s, pageCosts, { frames: FRAMES }, { ms: 600000, what: 'costs' });
      const base = new Map(c.rows.filter((x) => x.setting === 'default').map((x) => [x.pose, x.ms]));
      out.costs = c.knobs.map((k) => {
        const rows = c.rows.filter((x) => x.setting === k);
        return { knob: k, ms: r2(rows.reduce((a, x) => a + (base.get(x.pose) - x.ms), 0) / (rows.length || 1)), image: r2(rows.reduce((a, x) => a + (x.meanAbs || 0), 0) / (rows.length || 1)) };
      }).sort((a, b) => b.ms - a.ms);
      out.pixelShare = r2(c.pixelShare); out.pixelPose = c.pose0;
    }
    if (errors.length) throw new Error(`${id}: console errors\n  ${errors.join('\n  ')}`);
    return out;
  } finally {
    await context.close().catch(() => {});
  }
}

let code = 0;
try {
  if (DROPPED && !UPDATE && !args._.length && !COSTS) { // only a log entry
    appendLog({ change: DROPPED, verdict: 'dropped', score: null, delta: null });
    console.log('[perf] logged a dropped experiment in bench/LOG.md');
    process.exit(0);
  }
  vite = await startVite({ configFile: typeof args.config === 'string' ? args.config : undefined });
  const headless = !args.headed;
  browser = await launchChrome({ headless, args: [...(headless ? headlessArgs : headedArgs), '--js-flags=--expose-gc'] });
  const views = [];
  for (const id of wanted) {
    process.stdout.write(`[perf] ${id} … `);
    let r;
    try { r = await measureView(id, { costs: COSTS }); } catch (e) { r = { id, failed: e.message }; }
    console.log(r.failed ? `FAILED\n  ${r.failed}` : r.skipped ? `skipped (${r.skipped})` : `${Object.keys(r.poses).length} poses, loaded in ${(r.loadMs / 1000).toFixed(1)} s`);
    views.push(r);
  }
  const done = views.filter((v) => !v.skipped && !v.failed), failedViews = views.filter((v) => v.failed);
  if (!done.length) throw new Error('nothing was measured');
  const machine = machineOf(done[0].renderer), baseFile = path.join(benchDir, 'baseline', `${machine}.json`);
  const baseline = fs.existsSync(baseFile) ? JSON.parse(fs.readFileSync(baseFile, 'utf8')) : { machine, views: {} };

  // ---- rows, score, comparison
  const rows = [], problems = failedViews.map((v) => `${v.id}: the view did not run (${v.failed.split('\n')[0]})`), notes = [], over = [];
  let logSum = 0, logN = 0, baseLogSum = 0, baseLogN = 0, noisy = 0, improved = 0;
  for (const v of done) {
    const bud = budgets.views[v.id], bv = baseline.views[v.id];
    for (const pose of Object.keys(v.poses)) {
      const p = v.poses[pose], bp = bv && bv.poses[pose];
      const ratio = bud.ms / p.ms;
      logSum += Math.log(ratio); logN++;
      const row = { view: v.id, pose, ms: p.ms, budget: bud.ms, 'x budget': r2(p.ms / bud.ms), spread: `${(100 * p.spread).toFixed(1)}%`, base: bp ? bp.ms : '-', 'Δ ms': '', image: '', draws: p.drawCalls, tris: p.triangles, status: '' };
      const st = [];
      if (p.spread > TOL.spread) { noisy++; st.push('NOISY'); }
      if (p.ms > bud.ms) over.push({ view: v.id, pose, ms: p.ms, budget: bud.ms, over: r2(p.ms - bud.ms) });
      if (bp) {
        baseLogSum += Math.log(bud.ms / bp.ms); baseLogN++;
        const d = p.ms - bp.ms, lim = bp.ms * TOL.ms[0] + TOL.ms[1];
        row['Δ ms'] = `${d >= 0 ? '+' : ''}${d.toFixed(2)}`;
        if (p.spread <= TOL.spread) {
          if (d > lim) { st.push('SLOWER'); problems.push(`${v.id}/${pose}: ${bp.ms} -> ${p.ms} ms (+${d.toFixed(2)}, limit +${lim.toFixed(2)})`); }
          else if (d < -lim) { st.push('faster'); improved++; }
        }
        for (const k of ['drawCalls', 'triangles']) if (p[k] > bp[k] * (1 + TOL[k])) { st.push(k); problems.push(`${v.id}/${pose}: ${k} ${bp[k]} -> ${p[k]}`); }
        // image guard
        if (p.hash === bp.hash) row.image = 'same';
        else {
          const g = readGolden(machine, v.id, pose), cur = v.caps[pose];
          const d2 = g && g.hash === bp.hash ? capDiff(g, g.data, cur, capData(cur)) : null;
          if (!d2) { row.image = 'changed (no golden)'; st.push('IMAGE?'); problems.push(`${v.id}/${pose}: the image changed and there is no golden image of the baseline to measure by how much (re-create it: run --update on the baseline commit)`); }
          else {
            const lm = Math.max(TOL.imgMean, 3 * (bp.imageNoise ? bp.imageNoise.meanAbs : 0)), l8 = Math.max(TOL.imgOver8, 3 * (bp.imageNoise ? bp.imageNoise.pctOver8 : 0));
            row.image = `${d2.meanAbs} / ${d2.pctOver8}%`;
            if (d2.meanAbs > lm || d2.pctOver8 > l8) { st.push('IMAGE'); problems.push(`${v.id}/${pose}: the image changed by mean ${d2.meanAbs} of 255 (limit ${r2(lm)}), ${d2.pctOver8} % of pixels by more than 8 (limit ${r2(l8)})`); }
          }
        }
      } else notes.push(`${v.id}/${pose}: no baseline yet`);
      row.status = st.join(' ') || 'ok';
      rows.push(row);
    }
    for (const k of ['heapMB', 'assetMB']) {
      if (v[k] === null) continue;
      if (v[k] > bud[k]) over.push({ view: v.id, pose: `(${k})`, ms: v[k], budget: bud[k], over: r2(v[k] - bud[k]) });
      if (bv && bv[k] !== null && bv[k] !== undefined && v[k] > bv[k] * (1 + TOL[k]) + 1) problems.push(`${v.id}: ${k} ${bv[k]} -> ${v[k]}`);
    }
    for (const k of ['drawCalls', 'triangles']) {
      const worst = Math.max(...Object.values(v.poses).map((p) => p[k]));
      if (worst > bud[k]) over.push({ view: v.id, pose: `(${k})`, ms: worst, budget: bud[k], over: worst - bud[k] });
    }
  }
  const score = r1(100 * Math.exp(logSum / logN));
  const baseScore = baseLogN === logN ? r1(100 * Math.exp(baseLogSum / baseLogN)) : null;
  const delta = baseScore === null ? null : r1(score - baseScore);

  console.log(`\n${formatTable(rows, ['view', 'pose', 'ms', 'budget', 'x budget', 'spread', 'base', 'Δ ms', 'image', 'draws', 'tris', 'status'])}`);
  console.log(`\n${formatTable(done.map((v) => ({ view: v.id, 'heap MB': v.heapMB, 'assets MB': v.assetMB, 'load s': (v.loadMs / 1000).toFixed(1), 'base heap': baseline.views[v.id] ? baseline.views[v.id].heapMB : '-', 'base assets': baseline.views[v.id] ? baseline.views[v.id].assetMB : '-' })))}`);
  if (COSTS) for (const v of done) if (v.costs) {
    console.log(`\n${v.id}: ${Math.round(100 * v.pixelShare)} % of the '${v.pixelPose}' frame scales with resolution (per-pixel work: shading, post passes, overdraw); the rest is per-frame work (geometry, shadow maps, CPU submission)`);
    if (v.costs.length) console.log(`cost of each knob (ms saved with it off, mean over the poses; image = mean pixel change of 255)\n${formatTable(v.costs)}`);
  }
  over.sort((a, b) => (b.ms / b.budget) - (a.ms / a.budget));
  if (over.length) console.log(`\nover budget (the backlog, worst first):\n${formatTable(over.map((o) => ({ view: o.view, what: o.pose, value: o.ms, budget: o.budget, 'x budget': r2(o.ms / o.budget) })))}`);
  console.log(`\nSCORE ${score}${baseScore === null ? '  (no complete baseline to compare with)' : `   baseline ${baseScore}   ${delta >= 0 ? '+' : ''}${delta}`}   · ${machine} · ${logN} poses · ${REPEATS} x ${FRAMES} frames`);
  if (notes.length) console.log(`\n${notes.length} pose(s) without a baseline (run with --update to record them)`);

  const result = { date: new Date().toISOString(), commit: git('rev-parse --short HEAD'), dirty: !!git('status --porcelain --untracked-files=no'), machine, renderer: done[0].renderer, chrome: browser.version(),
    score, baseScore, delta, noisy, improved, problems, over, rows, views: done.map((v) => ({ id: v.id, loadMs: v.loadMs, heapMB: v.heapMB, assetMB: v.assetMB, poses: v.poses, pixelShare: v.pixelShare, costs: v.costs })) };
  fs.writeFileSync(path.join(benchDir, 'last.json'), `${JSON.stringify(result, null, 2)}\n`);
  if (args.json) console.log(JSON.stringify(result));

  if (problems.length) console.log(`\n${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`);
  if (noisy) console.log(`\n${noisy} pose(s) were noisy (runs spread more than ${100 * TOL.spread} %): the result is inconclusive. Close other GPU work and run again.`);

  if (UPDATE) {
    if (noisy) throw new Error('--update refused: the run is noisy');
    if (problems.length && !ACCEPT) throw new Error('--update refused: there are regressions or image changes. If they are intended, pass --accept="why".');
    if (!NOTE && !ACCEPT) throw new Error('--update needs --log="what changed" (or --accept="why")');
    // load-to-load image noise: every view once more, each pose's capture against this run's
    console.log('\n[perf] measuring load-to-load image noise for the new baseline …');
    for (const v of done) {
      const again = await measureView(v.id);
      for (const pose of Object.keys(v.poses)) {
        const a = v.caps[pose], b = again.caps && again.caps[pose];
        const d = b ? capDiff(a, capData(a), b, capData(b)) : null;
        v.poses[pose].imageNoise = d || { meanAbs: 0, pctOver8: 0 };
        writeGolden(machine, v.id, pose, v.poses[pose].hash, a);
      }
    }
    const next = { machine, renderer: done[0].renderer, chrome: browser.version(), updated: today(), commit: result.commit, frames: FRAMES, repeats: REPEATS, score: null, views: { ...baseline.views } };
    for (const v of done) {
      const poses = {};
      for (const [pose, p] of Object.entries(v.poses)) poses[pose] = { ms: p.ms, spread: p.spread, drawCalls: p.drawCalls, triangles: p.triangles, textures: p.textures, programs: p.programs, hash: p.hash, imageNoise: p.imageNoise, look: p.look };
      next.views[v.id] = { size: budgets.views[v.id].size, tier: budgets.views[v.id].tier, heapMB: v.heapMB, assetMB: v.assetMB, loadMs: v.loadMs, poses };
    }
    let ls = 0, ln = 0;
    for (const [id, bv] of Object.entries(next.views)) for (const p of Object.values(bv.poses)) { ls += Math.log(budgets.views[id].ms / p.ms); ln++; }
    next.score = r1(100 * Math.exp(ls / ln));
    fs.mkdirSync(path.dirname(baseFile), { recursive: true });
    fs.writeFileSync(baseFile, `${JSON.stringify(next, null, 2)}\n`);
    appendLog({ change: NOTE || ACCEPT, verdict: ACCEPT ? `accepted: ${ACCEPT}` : 'kept', score: next.score, delta, machine });
    console.log(`[perf] baseline updated: bench/baseline/${machine}.json (score ${next.score}); logged in bench/LOG.md`);
  } else {
    if (DROPPED) { appendLog({ change: DROPPED, verdict: 'dropped', score, delta, machine }); console.log('[perf] logged as dropped in bench/LOG.md'); }
    if (problems.length) code = 1; else if (noisy) code = 2;
  }
} catch (e) {
  code = 1;
  console.error(`[perf] ${e.message}`);
} finally {
  await cleanup();
}
process.exit(code);

function appendLog({ change, verdict, score, delta, machine = '' }) {
  const f = path.join(benchDir, 'LOG.md');
  if (!fs.existsSync(f)) fs.writeFileSync(f, '# Performance log\n\nOne row per change that was measured with `npm run perf`: kept (the baseline moved), accepted (a regression or an image change taken on purpose) or dropped (tried, measured, reverted). Newest last.\n\n| date | commit | machine | score | Δ | change | verdict |\n|---|---|---|---|---|---|---|\n');
  const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  fs.appendFileSync(f, `| ${today()} | ${git('rev-parse --short HEAD')} | ${cell(machine)} | ${score ?? ''} | ${delta === null || delta === undefined ? '' : (delta >= 0 ? '+' : '') + delta} | ${cell(change)} | ${cell(verdict)} |\n`);
}
