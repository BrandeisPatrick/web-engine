// Browser smoke test: every sample page boots in headless Chrome without console errors, and every bench pose renders a
// deterministic frame. Starts the Vite dev server in-process (free port from playwright.config.mjs), opens
// /<page>/?bench=1&size=1280x720&nofx=0 (plus PAGE_QUERY), waits for window.__sample.ready (90 s), then per pose:
// pose(id), settle(), two capture(4) calls (separate tasks) must hash equal (one retry: the first frame after a pose
// may still adapt), two converged(48) captures must hash equal and leave the held capture as it was (pages with a
// converge hook, src/core/Bench.js), and info() is recorded. Every page step runs under a 90 s watchdog; a page that
// reloads after it was ready is waited out and the pose redone once. A page without a harness (it loads and sets a
// legacy global such as window.__game, the Halloween game's play-mode state: under ?bench=1 it builds its world and
// exposes the harness) or without a page on this server is SKIPPED, not failed: it still fails on a console error while
// loading. On macOS a SwiftShader renderer (no GPU) fails. Exit code 1 on any failure. The `-mobile` pages are the same
// sample on the mobile quality tier (`?quality=mobile`, core/Quality.js).
//
//   node test/browser/smoke.mjs                        # nyc-night, miami-drive, halloween, the starters and their -mobile variants
//   node test/browser/smoke.mjs nyc-night --headed --size=1600x900 [--config=other.vite.config.js] [--no-look]
import {
  defaultSize, repoRoot, legacyGlobals, readyTimeoutMs, parseArgs, parseSize, startVite, resolvePage, launchChrome,
  watchErrors, loadSample, evalStep, withTimeout, onSignals, formatTable,
} from './playwright.config.mjs';

// extra query per page (the desktop pages pin their tier too, so a stored choice in the profile cannot change them)
const PAGE_QUERY = {
  'nyc-night': 'quality=desktop', 'nyc-night-mobile': 'quality=mobile',
  'miami-drive': 'quality=desktop', 'miami-drive-mobile': 'quality=mobile',
  halloween: 'quality=desktop', 'halloween-mobile': 'quality=mobile',
  'starter-walk': 'quality=desktop', 'starter-walk-mobile': 'quality=mobile',
  'starter-drive': 'quality=desktop', 'starter-drive-mobile': 'quality=mobile',
};
// pages that are another page with a different query, and the poses they run (default: all)
const PAGE_PATH = {
  'nyc-night-mobile': 'nyc-night', 'miami-drive-mobile': 'miami-drive', 'halloween-mobile': 'halloween',
  'starter-walk-mobile': 'starter-walk', 'starter-drive-mobile': 'starter-drive',
};
const PAGE_POSES = {};
// in-page checks after each pose: a failure message or ''
const PAGE_CHECK = {};
// The look gate: tone and palette limits per page and pose, checked on window.__sample.look() (core/Bench.js
// lookStats; --no-look skips it). The numbers come from the reference frame the samples are art-directed to (a low-key
// dusk road: mean luminance 37 / 255, 64 % of pixels under 40, nothing over 180, mean saturation 0.34, the only
// saturated hues red and orange): exposure that keeps blacks black and never clips a light source, and one hue family
// plus at most a small accent. A limit is [min, max]; `palette` = hues that may be saturated, `off` = the largest
// share of the frame (%) saturated in any other hue. A `-mobile` page uses its base page's limits.
const WARM = ['red', 'orange', 'yellow', 'rose'];
const LOW_KEY = { lumMean: [26, 50], under40: [50, 100], over160: [0, 0.6], over240: [0, 0.05], satMean: [0.2, 0.44], palette: WARM, off: 3 };
const PAGE_LOOK = {
  // Midnight Candy Run's remaster: a moonlit blue-grey-violet night, the lanterns and windows its only warm colour
  halloween: { default: { lumMean: [24, 48], under40: [50, 100], over160: [0, 1.5], over240: [0, 0.1], satMean: [0, 0.48], palette: ['blue', 'azure', 'violet', 'red', 'orange', 'yellow'], off: 4 } },
  'miami-drive': { default: LOW_KEY, strip: { lumMean: [26, 60], under40: [40, 100], over160: [0, 2], over240: [0, 0.1], satMean: [0.2, 0.46], palette: WARM, off: 8 } },
  'nyc-night': {
    default: { lumMean: [22, 48], under40: [50, 100], over160: [0, 1.5], over240: [0, 0.1], satMean: [0.15, 0.42], palette: WARM, off: 6 },
    square: { lumMean: [26, 62], under40: [38, 100], over160: [0, 4], over240: [0, 0.3], satMean: [0.15, 0.46], palette: WARM, off: 12 },
  },
};
function lookFailure(look, lim) {
  const bad = [];
  for (const k of ['lumMean', 'under40', 'over160', 'over240', 'satMean']) {
    if (lim[k] && (look[k] < lim[k][0] || look[k] > lim[k][1])) bad.push(`${k} ${look[k]} outside ${lim[k][0]}..${lim[k][1]}`);
  }
  if (lim.palette) {
    let off = 0; const which = [];
    for (const h in look.hues) if (!lim.palette.includes(h)) { off += look.hues[h]; which.push(`${h} ${look.hues[h]}`); }
    if (off > lim.off) bad.push(`${off.toFixed(1)} % of the frame saturated outside ${lim.palette.join('/')} (max ${lim.off}: ${which.join(', ')})`);
  }
  return bad.join('; ');
}
const STEP_MS = 90000;

const args = parseArgs();
const pages = args._.length ? args._ : args.pages ? String(args.pages).split(',') : [
  'nyc-night', 'nyc-night-mobile', 'miami-drive', 'miami-drive-mobile', 'halloween', 'halloween-mobile',
  // the starters (samples/starter-*): no poses, so they are checked for booting clean and drawing something
  'starter-walk', 'starter-walk-mobile', 'starter-drive', 'starter-drive-mobile',
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
          const info = await step(() => window.__sample.info(), undefined, 'info');
          row.renderer = info.renderer;
          poseRows.push({ page: id, pose: '(none)', hash: '-', stable: '-', draws: info.drawCalls, tris: info.triangles, size: fmtSize(info.size) });
          if (!(info.drawCalls > 0)) failures.push(`${id}: the page is ready but drew nothing (info().drawCalls ${info.drawCalls})`);
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
              const lk = !NO_LOOK && PAGE_LOOK[PAGE_PATH[id] || id];
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
