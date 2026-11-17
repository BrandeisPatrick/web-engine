// Start-up and failure paths of every demo and starter in headless Chrome, in play mode (no ?bench, no ?quality: the
// tier comes from the recommendation, each run in a fresh browser context so nothing is stored):
//   (a) the loading overlay (.ui-loading, ui LoadingScreen) is still on the page when the first frame reaches the
//       canvas (a draw into the default framebuffer before its fade starts: Engine.warmUp), no rAF callback after the
//       overlay is removed runs longer than LONG_MS and no gap between two callbacks exceeds LONG_MS, and the page is
//       not black right after the removal (a screenshot's mean luma over MIN_LUMA);
//   (b) after WEBGL_lose_context.loseContext() on the engine's canvas the engine's notice with a Reload button appears,
//       the loop stops (engine.contextLost), and no page error or console error arrives in the SETTLE_MS after it;
//   (c) clicking Reload loads the page again in the same tab, lighter: its resolved quality (window.__sample.quality,
//       the Halloween game's window.__game.QUALITY) has lighter: true, contextLosses 1 and, on a desktop-recommended
//       machine, tier 'mobile'; on the phone profile (iPhone 15 Pro emulation: recommended 'mobile') the engine's
//       pixel ratio is capped at 1.
// Every page runs on the desktop profile; starter-walk also on the phone profile. Exit code 1 on any failure.
//
//   node test/browser/phone-start.mjs                       # nyc-night miami-drive halloween starter-walk starter-drive (+ starter-walk phone)
//   node test/browser/phone-start.mjs nyc-night --phone     # the given pages on the phone profile only
//   node test/browser/phone-start.mjs --shots=<dir>         # also save the loading label, the first frame and the notice
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import {
  parseArgs, startVite, resolvePage, launchChrome, watchErrors, withTimeout, onSignals, formatTable, readyTimeoutMs,
} from './playwright.config.mjs';

const LONG_MS = 250, MIN_LUMA = 8, SETTLE_MS = 3000, WATCH_MS = 1500;
const args = parseArgs();
const PAGES = ['nyc-night', 'miami-drive', 'halloween', 'starter-walk', 'starter-drive'];
const runs = args._.length
  ? args._.map((page) => ({ page, profile: args.phone ? 'phone' : 'desktop' }))
  : [...PAGES.map((page) => ({ page, profile: args.phone ? 'phone' : 'desktop' })), ...(args.phone ? [] : [{ page: 'starter-walk', profile: 'phone' }])];
const shots = typeof args.shots === 'string' ? path.resolve(args.shots) : '';
if (shots) fs.mkdirSync(shots, { recursive: true });

// in the page, before any script: draws into the canvas's default framebuffer, the overlay's fade and removal, rAF
// callback durations and gaps
function probe() {
  const P = window.__start = { draws: 0, firstDrawAt: 0, hideAt: 0, drawsAtHide: 0, goneAt: 0, label: '', long: [], gaps: [], last: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    const a = performance.now();
    if (P.goneAt && P.last > P.goneAt) P.gaps.push(Math.round(a - P.last));
    P.last = a;
    try { cb(t); } finally { const d = performance.now() - a; if (P.goneAt && a > P.goneAt && d > 50) P.long.push(Math.round(d)); }
  });
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = getContext.call(this, type, attrs);
    if (gl && type === 'webgl2' && !gl.__startProbe) {
      gl.__startProbe = true;
      let fb = null;
      const bind = gl.bindFramebuffer.bind(gl);
      gl.bindFramebuffer = (target, f) => { if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) fb = f; return bind(target, f); };
      for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
        const f = gl[k].bind(gl);
        gl[k] = (...a) => { if (fb === null && this.width > 64) { P.draws++; if (!P.firstDrawAt) P.firstDrawAt = performance.now(); } return f(...a); };
      }
    }
    return gl;
  };
  const watch = () => {
    const el = document.querySelector('.ui-loading');
    if (!el) return false;
    const label = el.querySelector('small');
    new MutationObserver(() => {
      if (!P.hideAt && el.style.opacity === '0') { P.hideAt = performance.now(); P.drawsAtHide = P.draws; P.label = label ? label.textContent : ''; }
    }).observe(el, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(() => { if (!P.goneAt && !el.isConnected) P.goneAt = performance.now(); }).observe(document.body, { childList: true });
    return true;
  };
  const iv = setInterval(() => { if (document.body && watch()) clearInterval(iv); }, 2);
}
const engineOf = () => (window.__sample && window.__sample.engine) || (window.__game && window.__game.engine) || null;
const qualityOf = () => {
  const q = (window.__sample && window.__sample.quality) || (window.__game && window.__game.QUALITY) || null;
  return q && { tier: q.tier, source: q.source, reason: q.reason, lighter: q.lighter, contextLosses: q.contextLosses };
};

async function waitFor(page, fn, arg, ms, what) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = await withTimeout(page.evaluate(fn, arg), 10000, what); } catch { /* navigating */ }
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`${what}: not after ${Math.round(ms / 1000)} s`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
function meanLuma(buf) {
  const { data, width, height } = jpeg.decode(buf, { useTArray: true });
  let s = 0;
  for (let i = 0; i < width * height * 4; i += 4) s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return s / (width * height);
}

let vite = null, browser = null;
const cleanup = async () => {
  if (browser) { const b = browser; browser = null; await withTimeout(b.close(), 15000, 'browser close').catch(() => {}); }
  if (vite) { const v = vite; vite = null; await v.close().catch(() => {}); }
};
onSignals(cleanup);
const rows = [], failures = [];
try {
  vite = await startVite();
  browser = await launchChrome();
  const { devices } = await import('playwright');
  console.log(`[phone-start] vite ${vite.base}, headless Chrome`);
  for (const { page: id, profile } of runs) {
    const tag = `${id} (${profile})`, fail = (m) => failures.push(`${tag}: ${m}`);
    const row = { page: id, profile, warm_draws: null, label: '', long_ms: null, gap_ms: null, luma: null, notice: '', errors_after: null, next: '' };
    rows.push(row);
    const pathOf = await resolvePage(vite, id);
    if (!pathOf) { fail('no such page on this server'); continue; }
    const phone = { ...devices['iPhone 15 Pro'] }; delete phone.defaultBrowserType;
    const context = await browser.newContext(profile === 'phone' ? phone : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await context.addInitScript(probe);
    const page = await context.newPage();
    const errors = watchErrors(page);
    try {
      // ---- (a) the first frames under the loading screen
      await page.goto(vite.base + pathOf, { waitUntil: 'load', timeout: readyTimeoutMs });
      if (shots && id === 'nyc-night' && profile === 'desktop') {
        await waitFor(page, () => /Compiling/.test(document.querySelector('.ui-loading small')?.textContent || ''), null, readyTimeoutMs, 'the warm-up label');
        await page.screenshot({ path: path.join(shots, `${id}-${profile}-warmup-label.png`) });
      }
      await waitFor(page, () => window.__start.goneAt > 0, null, readyTimeoutMs, 'the loading overlay removed');
      const shot = await page.screenshot({ type: 'jpeg', quality: 80 });
      if (shots) fs.writeFileSync(path.join(shots, `${id}-${profile}-first-frame.jpg`), shot);
      row.luma = +meanLuma(shot).toFixed(1);
      await page.waitForTimeout(WATCH_MS);
      const st = await page.evaluate(() => ({ ...window.__start, long: window.__start.long.slice(), gaps: window.__start.gaps.slice() }));
      row.warm_draws = st.drawsAtHide; row.label = st.label;
      row.long_ms = Math.max(0, ...st.long); row.gap_ms = Math.max(0, ...st.gaps);
      if (!(st.drawsAtHide > 0 && st.firstDrawAt > 0 && st.firstDrawAt < st.hideAt)) fail(`no frame reached the canvas before the loading screen started to hide (draws ${st.drawsAtHide}, first draw ${Math.round(st.firstDrawAt)} ms, hide ${Math.round(st.hideAt)} ms)`);
      if (!/Compiling shaders/.test(st.label)) fail(`loading label while it hid: '${st.label}'`);
      if (row.long_ms > LONG_MS) fail(`a rAF callback of ${row.long_ms} ms after the loading screen went (limit ${LONG_MS})`);
      if (row.gap_ms > LONG_MS) fail(`a ${row.gap_ms} ms gap between frames after the loading screen went (limit ${LONG_MS})`);
      if (!(st.gaps.length > 10)) fail(`the loop did not run after the loading screen went (${st.gaps.length} frames)`);
      if (row.luma < MIN_LUMA) fail(`black right after the loading screen went (mean luma ${row.luma})`);
      const before = await page.evaluate(qualityOf);
      if (!before || before.lighter !== false || before.contextLosses !== 0) fail(`first load: quality ${JSON.stringify(before)}`);
      if (errors.length) fail(`errors before the context loss: ${errors.join(' | ')}`);

      // ---- (b) a lost context: the notice, the loop stopped, no further errors
      const nErr = errors.length;
      const lost = await page.evaluate(() => {
        const e = (window.__sample && window.__sample.engine) || (window.__game && window.__game.engine);
        const ext = e.renderer.getContext().getExtension('WEBGL_lose_context');
        if (!ext) return false;
        window.__loseExt = ext; ext.loseContext();
        return true;
      });
      if (!lost) { fail('no WEBGL_lose_context'); continue; }
      const notice = await waitFor(page, () => {
        const n = document.querySelector('.engine-notice-notice'), b = n && n.querySelector('button');
        return n && b && getComputedStyle(n).display !== 'none' ? { text: n.firstChild.textContent, button: b.textContent } : null;
      }, null, 10000, 'the lost-context notice');
      row.notice = notice.button;
      if (!/graphics were reset/i.test(notice.text) || notice.button !== 'Reload') fail(`notice: ${JSON.stringify(notice)}`);
      if (shots && profile === 'phone' || shots && id === 'nyc-night') await page.screenshot({ path: path.join(shots, `${id}-${profile}-context-lost.png`) });
      await page.waitForTimeout(SETTLE_MS);
      const after = await page.evaluate(() => {
        const e = (window.__sample && window.__sample.engine) || (window.__game && window.__game.engine);
        return { lost: e.contextLost, running: e._running, frames: e.frameCount };
      });
      await page.waitForTimeout(300);
      const frames2 = await page.evaluate(() => ((window.__sample && window.__sample.engine) || (window.__game && window.__game.engine)).frameCount);
      if (!after.lost || after.running || frames2 !== after.frames) fail(`the loop did not stop: ${JSON.stringify(after)} -> ${frames2} frames`);
      row.errors_after = errors.length - nErr;
      if (errors.length > nErr) fail(`errors after the context loss: ${errors.slice(nErr).join(' | ')}`);

      // ---- (c) Reload: the same tab comes up lighter
      await Promise.all([page.waitForEvent('load', { timeout: readyTimeoutMs }), page.click('.engine-notice-notice button')]);
      const next = await waitFor(page, (qf) => {
        const q = (window.__sample && window.__sample.ready && window.__sample.quality) || (window.__game && window.__game.QUALITY);
        const e = (window.__sample && window.__sample.engine) || (window.__game && window.__game.engine);
        return q && e && window.__start.goneAt > 0 ? { tier: q.tier, source: q.source, reason: q.reason, lighter: q.lighter, contextLosses: q.contextLosses, maxPR: e.maxPR, pr: e.renderer.getPixelRatio() } : null;
      }, null, readyTimeoutMs, 'the reloaded page');
      row.next = `${next.tier}${next.lighter ? ' lighter' : ''} pr ${next.maxPR}`;
      if (!next.lighter || next.contextLosses !== 1 || next.source !== 'recommended' || !/lighter after a graphics reset/.test(next.reason)) fail(`reload: not lighter: ${JSON.stringify(next)}`);
      if (profile === 'desktop' && next.tier !== 'mobile') fail(`reload: desktop-recommended machine should step down to mobile: ${JSON.stringify(next)}`);
      if (profile === 'phone' && !(next.tier === 'mobile' && next.maxPR <= 1 && next.pr <= 1)) fail(`reload: phone should cap the pixel ratio at 1: ${JSON.stringify(next)}`);
      await page.waitForTimeout(500);
      if (errors.length > nErr) fail(`errors after the reload: ${errors.slice(nErr).join(' | ')}`);
    } catch (e) {
      fail(e.message.split('\n')[0]);
    } finally {
      await withTimeout(context.close(), 15000, 'context close').catch(() => {});
    }
  }
} catch (e) {
  failures.push(`phone-start: ${e.stack || e.message}`);
} finally {
  await cleanup();
}
console.log(`\n${formatTable(rows, ['page', 'profile', 'warm_draws', 'label', 'long_ms', 'gap_ms', 'luma', 'notice', 'errors_after', 'next'])}`);
if (failures.length) { console.log(`\n${failures.length} failure(s):`); for (const f of failures) console.log(`  - ${f}`); }
console.log(`\n[phone-start] ${failures.length ? 'FAILED' : 'OK'} (${rows.length} runs)`);
process.exit(failures.length ? 1 : 0);
