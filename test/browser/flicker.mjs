// Flicker at rest on nyc-night's bench poses in headless Chrome: the frames a player sees standing still (the bench's
// live frames: TAA jittered and accumulating, eye adaptation, signs and steam as in play; the camera held, film grain
// off), every frame read back, the per-pixel second difference of the luma |f(t) - (f(t-1) + f(t+1)) / 2| averaged
// over 48 frames after an 18-frame start (a still view's flicker: smooth change cancels out), and one-frame flashes
// (a pixel that steps up then down, or down then up, by 6 / 255 or more both times) per 10 000 pixel-frames.
// It guards the far glass: before the curtain walls' mullions flattened their two rounded faces as they get under a
// pixel and a half wide (src/world/Buildings.js), the glass tower down the sidewalk pose's street canyon flickered
// under TAA's jitter (sidewalk 0.379 mean, 45.5 flashes; 0.307 / 32.4 after, Apple M4). Each pose has a budget about 12 % above what it
// measured when it was set (BUDGETS); a pose over it fails. Heat maps of the flicker with --out=<dir>.
// Needs Chrome and the GPU (part of `npm run check:full`); run it through the machine's GPU lock:
//   node test/browser/flicker.mjs [--out=<dir>]
// Exit code 1 on a pose over budget, a console error or a page error.
import fs from 'node:fs';
import path from 'node:path';
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, parseArgs, formatTable } from './playwright.config.mjs';

// per pose: mean second difference (0..255) and one-frame flashes per 10 000 pixel-frames
const BUDGETS = { avenue: { d2: 0.34, flashes: 32 }, square: { d2: 0.36, flashes: 50 }, sidewalk: { d2: 0.34, flashes: 38 } };
const SIZE = { w: 1280, h: 720 }, START = 18, FRAMES = 66;

const args = parseArgs();
const out = args.out ? path.resolve(args.out) : null;
if (out) fs.mkdirSync(out, { recursive: true });
const vite = await startVite();
const browser = await launchChrome();
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: SIZE.w, height: SIZE.h } });
  const errors = watchErrors(page);
  const session = await loadSample(page, `${vite.base}${await resolvePage(vite, 'nyc-night')}?quality=desktop&bench=1&size=${SIZE.w}x${SIZE.h}`, errors);
  if (session.status !== 'ready') throw new Error(`nyc-night not ready: ${session.note}`);
  const rows = await page.evaluate(async ({ poses, start, frames, heat }) => {
    const h = window.__sample, E = h.engine, P = window.__nyc.postfx, gl = E.renderer.getContext();
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, n = W * H, buf = new Uint8Array(n * 4);
    const L = [new Float32Array(n), new Float32Array(n), new Float32Array(n)], acc = new Float32Array(n);
    const res = [];
    for (const pose of poses) {
      h.pose(pose); await h.settle();
      h.live.begin(h);
      acc.fill(0);
      let sum = 0, flashes = 0, cnt = 0;
      for (let i = 0; i < frames; i++) {
        h.live.frame(1 / 60, h);
        P.uniforms.uGrain.value = 0; // film grain: noise on purpose, not flicker
        E.renderFn(E.scene, E.camera, 1 / 60);
        E.renderer.setRenderTarget(null); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const c = L[i % 3];
        for (let p = 0, q = 0; p < n; p++, q += 4) c[p] = 0.2126 * buf[q] + 0.7152 * buf[q + 1] + 0.0722 * buf[q + 2];
        if (i < start) continue;
        const a = L[(i + 1) % 3], b = L[(i + 2) % 3]; // f(t-1), f(t); c = f(t+1)
        for (let p = 0; p < n; p++) {
          const d = Math.abs(b[p] - 0.5 * (a[p] + c[p])), u = b[p] - a[p], v = c[p] - b[p];
          sum += d; acc[p] += d;
          if (u * v < 0 && Math.min(Math.abs(u), Math.abs(v)) >= 6) flashes++;
        }
        cnt++;
      }
      h.live.end(h);
      let url = null;
      if (heat) { // the last frame dimmed, the mean second difference over it (black, red, yellow, white at 6 / 255)
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const g = cv.getContext('2d'), im = g.createImageData(W, H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4, p = (H - 1 - y) * W + x, t = Math.min(1, acc[p] / cnt / 6), k = Math.min(1, t * 1.5), gr = L[(frames - 1) % 3][p] * 0.35;
          im.data[o] = gr * (1 - k) + 255 * Math.min(1, t * 3) * k;
          im.data[o + 1] = gr * (1 - k) + 255 * Math.min(1, Math.max(0, t * 3 - 1)) * k;
          im.data[o + 2] = gr * (1 - k) + 255 * Math.min(1, Math.max(0, t * 3 - 2)) * k;
          im.data[o + 3] = 255;
        }
        g.putImageData(im, 0, 0); url = cv.toDataURL('image/png');
      }
      res.push({ pose, d2: sum / cnt / n, flashes: 1e4 * flashes / cnt / n, url });
    }
    return res;
  }, { poses: Object.keys(BUDGETS), start: START, frames: FRAMES, heat: !!out });
  const table = rows.map((r) => {
    const b = BUDGETS[r.pose], ok = r.d2 <= b.d2 && r.flashes <= b.flashes;
    if (!ok) failed++;
    if (out && r.url) fs.writeFileSync(path.join(out, `flicker-${r.pose}.png`), Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64'));
    return { pose: r.pose, d2: r.d2.toFixed(3), 'd2 budget': b.d2, flashes: r.flashes.toFixed(1), 'flashes budget': b.flashes, result: ok ? 'pass' : 'FAIL' };
  });
  console.log(formatTable(table));
  if (out) console.log(`heat maps in ${out}`);
  for (const e of errors) { console.log(e); failed++; }
} catch (e) {
  console.error(e); failed++;
} finally {
  await browser.close(); await vite.close();
}
process.exit(failed ? 1 : 0);
