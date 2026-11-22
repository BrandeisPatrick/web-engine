// Browser smoke test: every sample page boots in headless Chrome without console errors, and every bench pose renders a
// deterministic frame. Starts the Vite dev server in-process (free port from playwright.config.mjs), opens
// /<page>/?bench=1&size=1280x720&nofx=0 (plus PAGE_QUERY), waits for window.__sample.ready (90 s), then per pose:
// pose(id), settle(), two capture(4) calls (separate tasks) must hash equal (one retry: the first frame after a pose
// may still adapt), two converged(48) captures must hash equal and leave the held capture as it was (pages with a
// converge hook, src/core/Bench.js), and info() is recorded. Every page step runs under a 90 s watchdog; a page that
// reloads after it was ready is waited out and the pose redone once. A page without a harness (it loads and sets a
// legacy global such as window.__game, the play-mode state of the retired Halloween game: under ?bench=1 a page builds
// its world and exposes the harness) or without a page on this server is SKIPPED, not failed: it still fails on a console error while
// loading. On macOS a SwiftShader renderer (no GPU) fails. Exit code 1 on any failure. The `-mobile` pages are the same
// sample on the mobile quality tier (`?quality=mobile`, core/Quality.js); the `-low` pages are a demo in its earlier
// low-key look (`?look=low`) on one pose.
//
//   node test/browser/smoke.mjs                        # nyc-night, miami-drive, the starters, their -mobile variants, the demos' -low (?look=low) pages, assets, sound-check
//   node test/browser/smoke.mjs nyc-night --headed --size=1600x900 [--config=other.vite.config.js] [--no-look]
import {
  defaultSize, repoRoot, legacyGlobals, readyTimeoutMs, parseArgs, parseSize, startVite, resolvePage, launchChrome,
  watchErrors, loadSample, evalStep, withTimeout, onSignals, formatTable, PAGE_LOOK, lookFailure,
} from './playwright.config.mjs';

// extra query per page (the desktop pages pin their tier too, so a stored choice in the profile cannot change them)
const PAGE_QUERY = {
  'nyc-night': 'quality=desktop', 'nyc-night-mobile': 'quality=mobile', 'nyc-night-low': 'quality=desktop&look=low',
  'miami-drive': 'quality=desktop', 'miami-drive-mobile': 'quality=mobile', 'miami-drive-low': 'quality=desktop&look=low',
  'starter-walk': 'quality=desktop', 'starter-walk-mobile': 'quality=mobile',
  'starter-drive': 'quality=desktop', 'starter-drive-mobile': 'quality=mobile',
};
// pages that are another page with a different query, and the poses they run (default: all)
const PAGE_PATH = {
  'nyc-night-mobile': 'nyc-night', 'nyc-night-low': 'nyc-night', 'miami-drive-mobile': 'miami-drive', 'miami-drive-low': 'miami-drive',
  'starter-walk-mobile': 'starter-walk', 'starter-drive-mobile': 'starter-drive',
};
const PAGE_POSES = { 'nyc-night-low': ['avenue'], 'miami-drive-low': ['chase'] };
// in-page checks after each pose: a failure message or ''
const PAGE_CHECK = {};
// The look gate (PAGE_LOOK, lookFailure): playwright.config.mjs.
const STEP_MS = 90000;

const args = parseArgs();
const pages = args._.length ? args._ : args.pages ? String(args.pages).split(',') : [
  'nyc-night', 'nyc-night-mobile', 'miami-drive', 'miami-drive-mobile',
  // the earlier low-key look (?look=low), one pose each: not black, not blown out
  'nyc-night-low', 'miami-drive-low',
  // the starters (samples/starter-*): no poses, so they are checked for booting clean and drawing something
  'starter-walk', 'starter-walk-mobile', 'starter-drive', 'starter-drive-mobile',
  // the Asset library page
  'assets',
  // the sound kit page: its selfTest() renders the ten-second scene offline and checks the mix limits
  'sound-check',
];
const size = parseSize(args.size || defaultSize);
const headless = !args.headed;
const NO_LOOK = !!args['no-look'];
const mac = process.platform === 'darwin';

const pageRows = [], poseRows = [], failures = [];
let vite = null, browser = null;
const cleanup = async () => {
  if (browser) { const b = browser; browser = null; await withTimeout(b.close(), 15000, 'browser close').catch(() => {}); }
  if (vite) { const v = vite; vite = null; await v.close().catch(() => {}); }
};
onSignals(cleanup);

const fmtSize = (s) => `${s.w}x${s.h}@${s.pixelRatio}`;
const checkRenderer = (id, renderer) => {
  if (mac && /SwiftShader/i.test(renderer || '')) failures.push(`${id}: renderer is SwiftShader (no GPU): ${renderer}`);
};

try {
  vite = await startVite({ configFile: typeof args.config === 'string' ? args.config : undefined });
  console.log(`[smoke] vite ${vite.base} (root ${vite.server.config.root.replace(repoRoot, '')}), Chrome ${headless ? 'headless' : 'headed'}, ${size.w}x${size.h}`);
  browser = await launchChrome({ headless });
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });

  for (const id of pages) {
    const path = await resolvePage(vite, PAGE_PATH[id] || id);
    if (!path) { pageRows.push({ page: id, path: '-', status: 'SKIPPED', load_s: null, poses: 0, renderer: '', note: 'no such page on this server' }); continue; }
    const page = await context.newPage();
    const errors = watchErrors(page);
    const extra = PAGE_QUERY[id] ? `&${PAGE_QUERY[id]}` : '';
    const url = `${vite.base}${path}?bench=1&size=${size.w}x${size.h}&nofx=0${extra}`;
    const s = await loadSample(page, url, errors, { timeout: readyTimeoutMs });
    const row = { page: id, path: `${path}${extra ? ` (+${PAGE_QUERY[id]})` : ''}`, status: s.status.toUpperCase(), load_s: +(s.loadMs / 1000).toFixed(1), poses: 0, renderer: '', note: s.note };
    pageRows.push(row);
    const step = (fn, arg, what) => evalStep(page, errors, s, fn, arg, { ms: STEP_MS, what: `${id} ${what}` });
    try {
      if (s.status === 'ready') {
        const ids = (await step(() => window.__sample.poses.slice(), undefined, 'poses')).filter((p) => !PAGE_POSES[id] || PAGE_POSES[id].includes(p));
        row.poses = ids.length;
        if (!ids.length) {
          // pages without poses may test themselves (the Asset library opens a details view with a 3D preview); a page
          // that does not (the starters) must at least have drawn something
          const selfTests = await step(() => typeof window.__sample.selfTest === 'function', undefined, 'self test?');
          const self = selfTests ? await step(() => window.__sample.selfTest(), undefined, 'self test') : '';
          if (self) failures.push(`${id}: self test: ${self}`);
          const info = await step(() => window.__sample.info(), undefined, 'info');
          row.renderer = info.renderer;
          poseRows.push({ page: id, pose: '(none)', hash: '-', stable: '-', draws: info.drawCalls, tris: info.triangles, size: fmtSize(info.size) });
          if (!selfTests && !(info.drawCalls > 0)) failures.push(`${id}: the page is ready but drew nothing (info().drawCalls ${info.drawCalls})`);
        }
        for (const pose of ids) {
          const pr = { page: id, pose, hash: '', stable: '', draws: null, tris: null, size: '' };
          poseRows.push(pr);
          try {
            for (let attempt = 0; ; attempt++) {
              const reloads = s.reloads;
              await step((p) => { window.__sample.pose(p); }, pose, `pose ${pose}`);
              await step(() => (window.__sample.settle ? window.__sample.settle().then(() => true) : true), undefined, `settle ${pose}`);
              const cap = () => step(() => window.__sample.capture(4).hash, undefined, `capture ${pose}`);
              const a = await cap(), b = await cap();
              let ok = a === b, stable = ok ? 'yes' : '', hash = b;
              if (!ok) { const c = await cap(); ok = b === c; stable = ok ? 'retry' : `NO ${a}/${b}/${c}`; hash = c; }
              const info = await step(() => window.__sample.info(), undefined, `info ${pose}`);
              if (s.reloads !== reloads && attempt === 0) continue; // the page reloaded mid-pose: redo it on the new page
              Object.assign(pr, { hash, stable: s.reloads !== reloads ? `${stable} (reloaded)` : stable, draws: info.drawCalls, tris: info.triangles, size: fmtSize(info.size) });
              row.renderer = info.renderer;
              if (!ok) failures.push(`${id}/${pose}: captures differ (${stable})`);
              // converged captures (Bench.converged, the sample's converge hook): two hash equal, and the held capture
              // after them equals the one before (converged() returns to the capture state)
              const conv = await step(() => {
                const h = window.__sample;
                if (!h.converge) return null;
                const c1 = h.converged(48, 4).hash, c2 = h.converged(48, 4).hash;
                return { c1, c2, held: h.capture(4).hash };
              }, undefined, `converged ${pose}`);
              if (conv) {
                pr.converged = conv.c1 === conv.c2 && conv.held === hash ? 'yes'
                  : `NO ${conv.c1}/${conv.c2} held ${hash}/${conv.held}`;
                if (pr.converged !== 'yes') failures.push(`${id}/${pose}: converged captures: ${pr.converged}`);
              }
              if (PAGE_CHECK[id]) { const msg = await step(PAGE_CHECK[id], undefined, `check ${pose}`); if (msg) failures.push(`${id}/${pose}: ${msg}`); }
              const lk = !NO_LOOK && (PAGE_LOOK[id] || PAGE_LOOK[PAGE_PATH[id] || id]);
              if (lk) {
                const look = await step(() => (window.__sample.look ? window.__sample.look(4) : null), undefined, `look ${pose}`);
                if (look) {
                  pr.lum = look.lumMean; pr.sat = look.satMean; pr.over160 = look.over160;
                  const msg = lookFailure(look, lk[pose] || lk.default);
                  if (msg) failures.push(`${id}/${pose}: look: ${msg}`);
                }
              }
              break;
            }
          } catch (e) {
            pr.stable = 'ERROR';
            failures.push(`${id}/${pose}: ${e.message.split('\n')[0]}`);
            if (/timed out/.test(e.message)) break; // a hung page: skip its remaining poses
          }
        }
        if (s.reloads) row.note = `${row.note ? `${row.note}; ` : ''}reloaded ${s.reloads}x after ready`;
      } else if (s.status === 'skipped') {
        // no harness yet: still report what the page rendered with
        const g = await withTimeout(page.evaluate((names) => {
          for (const n of names) {
            const e = window[n] && window[n].engine;
            if (e && e.renderer) { const gl = e.renderer.getContext(); return { renderer: e.profiler ? e.profiler.gpuRenderer : '', w: gl.drawingBufferWidth, h: gl.drawingBufferHeight }; }
          }
          return null;
        }, legacyGlobals), STEP_MS, `${id} legacy info`).catch(() => null);
        if (g) { row.renderer = g.renderer; row.note += `; canvas ${g.w}x${g.h}`; }
      }
      checkRenderer(id, row.renderer);
    } catch (e) {
      failures.push(`${id}: ${e.message.split('\n')[0]}`);
    }
    if (errors.length) failures.push(...errors.map((e) => `${id}: ${e}`));
    if (s.status === 'failed' && !errors.length) failures.push(`${id}: ${s.note}`);
    if (failures.some((f) => f.startsWith(`${id}:`) || f.startsWith(`${id}/`))) row.status = 'FAILED';
    await withTimeout(page.close({ runBeforeUnload: false }), 15000, `${id} close`).catch(() => {});
  }
} catch (e) {
  failures.push(`smoke: ${e.stack || e.message}`);
} finally {
  await cleanup();
}

console.log(`\n${formatTable(pageRows, ['page', 'path', 'status', 'load_s', 'poses', 'renderer', 'note'])}`);
const POSE_COLS = ['page', 'pose', 'hash', 'stable', 'converged', 'draws', 'tris', 'size', 'lum', 'sat', 'over160'];
if (poseRows.length) console.log(`\n${formatTable(poseRows, POSE_COLS)}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) console.log(`  - ${f}`);
}
const failed = failures.length > 0;
console.log(`\n[smoke] ${failed ? 'FAILED' : 'OK'} (${pageRows.filter((r) => r.status === 'READY').length} ready, ${pageRows.filter((r) => r.status === 'SKIPPED').length} skipped)`);
process.exit(failed ? 1 : 0);
