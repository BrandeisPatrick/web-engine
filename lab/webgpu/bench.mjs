// Runs the renderer comparison (lab/webgpu/index.html) in Chrome and prints one table. Lab tooling, not a check.
//   node lab/webgpu/bench.mjs [--runs=3] [--modes=gl,gpu,gpu-gl] [--post] [--bundle] [--ts] [--lights=N] [--frames=300] [--sync=60]
//                             [--headed] [--json=file] [--pics=dir]
//   node lab/webgpu/bench.mjs --poses     capture poses.json from the production nyc-night page (its bench poses)
// Headless Chrome on macOS gives the real GPU to both WebGL (ANGLE on Metal) and WebGPU (Dawn on Metal) with the
// engine's headlessArgs; vsync and the frame-rate limit are off, so a frame interval is the frame's real cost.
// Every run prints which backend actually rendered (WebGPURenderer falls back to WebGL2 without a word).
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, headlessArgs, headedArgs, parseArgs, startVite, launchChrome, watchErrors, loadSample, withTimeout, onSignals, formatTable } from '../../test/browser/playwright.config.mjs';

const args = parseArgs();
const here = path.join(repoRoot, 'lab', 'webgpu');
const vite = await startVite({ configFile: path.join(repoRoot, 'lab', 'vite.config.js') });
const flags = ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--enable-webgpu-developer-features'];
// a new browser (a new temporary profile) per page load: Chrome keeps compiled programs per profile, so a second load
// in the same browser would start warm and its first frame would not be a cold start
const browsers = new Set();
onSignals(async () => { for (const b of browsers) await b.close().catch(() => {}); await vite.close(); });
const newPage = async () => {
  const b = await launchChrome({ headless: !args.headed, args: [...(args.headed ? headedArgs : headlessArgs), ...flags] });
  browsers.add(b);
  const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  // WebGPU validation errors arrive as console warnings, and an invalid pipeline voids the whole frame's command buffer
  // (nothing drawn, impossibly fast timings): any such warning fails the run
  page.on('console', (m) => { if (m.type() === 'warning' && /Invalid|While validating/.test(m.text())) errors.push(`pageerror (WebGPU validation): ${m.text().split('\n')[0]}`); });
  return { ctx: { close: () => { browsers.delete(b); return b.close(); } }, page, errors: watchErrors(page) };
};

try {
  if (args.poses) {
    // the production page's bench poses at 1920x1080 (16:9: the sidewalk pose's distance depends on the aspect)
    const { ctx, page, errors } = await newPage();
    const s = await loadSample(page, `${vite.base}/samples/nyc-night/?bench=1&size=1920x1080&quality=desktop`, errors);
    if (s.status !== 'ready') throw new Error(`nyc-night not ready: ${s.note} ${errors.join(' | ')}`);
    const poses = await page.evaluate(async () => {
      const h = window.__sample, cam = h.engine.camera, w = window.__nyc.world, out = {};
      for (const id of h.poses) { h.pose(id); await h.settle(); out[id] = { position: cam.position.toArray(), quaternion: cam.quaternion.toArray() }; }
      return { offset: { x: w.offset.x, z: w.offset.z }, fov: cam.fov, near: cam.near, far: cam.far, poses: out };
    });
    fs.writeFileSync(path.join(here, 'poses.json'), `${JSON.stringify(poses, null, 1)}\n`);
    console.log(`poses.json: ${Object.keys(poses.poses).join(', ')}`);
    await ctx.close();
  } else {
    const modes = String(args.modes || 'gl,gpu,gpu-gl').split(','), runs = +args.runs || 3;
    const extra = `${args.post ? '&post=1' : ''}${args.bundle ? '&bundle=1' : ''}${args.ts ? '&ts=1' : ''}${args.lights ? `&lights=${+args.lights}` : ''}&frames=${+args.frames || 300}&sync=${+args.sync || 60}`;
    const all = [];
    for (let run = 1; run <= runs; run++) {
      for (const mode of modes) {
        const { ctx, page, errors } = await newPage();
        await page.goto(`${vite.base}/lab/webgpu/?r=${mode}${extra}`, { waitUntil: 'load' });
        // poll until the page is done; a page error (a module that failed to load never sets __lab) ends the run
        for (const t0 = Date.now(); !(await withTimeout(page.evaluate(() => !!(window.__lab && (window.__lab.ready || window.__lab.error))), 60000, 'poll').catch(() => false));) {
          if (errors.some((e) => e.startsWith('pageerror'))) throw new Error(`${mode}: ${errors.join(' | ')}`);
          if (Date.now() - t0 > 15 * 60000) throw new Error(`${mode} run ${run} timed out`);
          await new Promise((r) => setTimeout(r, 2000));
        }
        const lab = await page.evaluate(() => ({ ...window.__lab, showPose: undefined }));
        if (args.pics) {
          fs.mkdirSync(args.pics, { recursive: true });
          for (const r of lab.rows) {
            await page.evaluate((id) => window.__lab.showPose(id), r.pose);
            await page.locator('#c').screenshot({ path: path.join(args.pics, `${mode}${args.post ? '-post' : ''}${args.bundle ? '-bundle' : ''}${args.lights ? `-lights${args.lights}` : ''}-${r.pose}.png`) });
          }
        }
        await ctx.close();
        if (lab.error) throw new Error(`${mode}: ${lab.error}`);
        if (errors.length) console.warn(`${mode}: ${errors.length} console error(s): ${errors[0]}`);
        console.log(`run ${run} ${mode}: backend ${lab.backend}; adapter ${lab.adapter.webgpu} / ${lab.adapter.webgl}; start ${JSON.stringify(lab.start)}; scene ${JSON.stringify({ kept: lab.scene.kept, materials: lab.scene.materials, dropped: lab.scene.dropped })}`);
        if (run === 1 && mode === modes[0]) console.log(`user agent: ${lab.adapter.ua}\ndropped meshes: ${lab.scene.droppedNames.join('; ')}`);
        for (const r of lab.rows) all.push({ run, mode, backend: lab.backend, ...r, firstCall: lab.start.firstRenderCallMs, firstPresented: lab.start.firstPresentedMs });
      }
    }
    console.log(`\nper run (ms)\n${formatTable(all.map(({ backend, heapMB, ...r }) => ({ ...r, heapMB })))}`);
    // across runs: the median of each column's per-run medians and the spread (max - min) / median
    const keys = ['cpuMed', 'frameMed', 'frameP95', 'loopMs', 'syncMed', 'syncP95', 'syncMax', 'gpuTsMed', 'firstCall', 'firstPresented'];
    const sum = [];
    for (const mode of modes) for (const pose of [...new Set(all.map((r) => r.pose))]) {
      const rs = all.filter((r) => r.mode === mode && r.pose === pose), row = { mode, pose };
      for (const k of keys) {
        const v = rs.map((r) => r[k]).filter((x) => x != null).sort((a, b) => a - b);
        if (!v.length) { row[k] = '-'; continue; }
        const m = v[v.length >> 1], sp = m ? (100 * (v.at(-1) - v[0])) / m : 0;
        row[k] = `${m}${v.length > 1 ? ` ±${sp.toFixed(0)}%${sp > 10 ? '!' : ''}` : ''}`;
      }
      row.draws = rs[0].draws; row.tris = rs[0].tris;
      sum.push(row);
    }
    console.log(`\nmedian of ${runs} run(s), spread = (max - min) / median, ! over 10 %\n${formatTable(sum)}`);
    if (args.json) fs.writeFileSync(args.json, JSON.stringify({ args, rows: all, summary: sum }, null, 1));
  }
} finally {
  for (const b of browsers) await b.close().catch(() => {});
  await vite.close();
}
