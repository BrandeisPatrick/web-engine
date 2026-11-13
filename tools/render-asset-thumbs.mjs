// Render the asset catalogue's thumbnails (samples/public/catalog/thumbs/<id>.jpg, 480 x 320 JPEG) in headless Chrome,
// one page load per entry of samples/dev/asset-thumbs.html, which runs the entry's code snippet in the asset runtime's
// neutral studio (samples/assets/runtime.js). Every snippet therefore runs here: a snippet that throws or logs an
// error fails this script. The facts measured on the way (triangles, meshes, animation names) go to
// tools/asset-measurements.json, and the catalogue is rebuilt at the end (tools/catalog-assets.mjs).
//
//   node tools/render-asset-thumbs.mjs                      every entry
//   node tools/render-asset-thumbs.mjs --only=id1,id2       some entries
//   node tools/render-asset-thumbs.mjs --category=vehicle   one category
//   node tools/render-asset-thumbs.mjs --missing            entries without a thumbnail
//   --quality=0.8 (JPEG quality)  --headed
import fs from 'node:fs';
import path from 'node:path';
import { startVite, launchChrome, watchErrors, parseArgs, withTimeout, onSignals } from '../test/browser/playwright.config.mjs';
import { buildCatalog, ROOT, CATALOG_JSON, MARKDOWN, THUMB_DIR, MEASUREMENTS } from './catalog-assets.mjs';

const args = parseArgs();
const abs = (p) => path.join(ROOT, p);
// the catalogue the page reads must list the current registry
let built = await buildCatalog();
fs.writeFileSync(abs(CATALOG_JSON), built.json);
let list = built.catalog.entries;
if (args.only) { const ids = String(args.only).split(','); list = list.filter((e) => ids.includes(e.id)); }
if (args.category) list = list.filter((e) => e.category === args.category);
if (args.missing) list = list.filter((e) => !fs.existsSync(abs(`samples/public/${e.thumb}`)));
const quality = +(args.quality || 0.8);

const measurements = fs.existsSync(abs(MEASUREMENTS)) ? JSON.parse(fs.readFileSync(abs(MEASUREMENTS), 'utf8')) : {};
let vite = null, browser = null;
const cleanup = async () => { if (browser) await browser.close().catch(() => {}); browser = null; if (vite) await vite.close().catch(() => {}); vite = null; };
onSignals(cleanup);
const failures = [];
try {
  vite = await startVite();
  let context = null;
  // a fresh browser when the last one went away (a GPU process crash in a long run closes it)
  const ensureBrowser = async () => {
    if (browser && browser.isConnected()) return;
    if (browser) await browser.close().catch(() => {});
    browser = await launchChrome({ headless: !args.headed });
    context = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
  };
  fs.mkdirSync(abs(THUMB_DIR), { recursive: true });
  let i = 0;
  for (const e of list) {
    i++;
    await ensureBrowser();
    const page = await context.newPage();
    const errors = watchErrors(page);
    const t0 = Date.now();
    try {
      await page.goto(`${vite.base}/dev/asset-thumbs.html?id=${encodeURIComponent(e.id)}&q=${quality}`, { waitUntil: 'load', timeout: 60000 });
      await withTimeout(page.waitForFunction(() => window.__thumb && window.__thumb.done, null, { timeout: 120000, polling: 100 }), 125000, e.id);
      const r = await page.evaluate(() => window.__thumb);
      if (r.error) throw new Error(r.error.split('\n').slice(0, 3).join(' | '));
      if (errors.length) throw new Error(errors.join(' | '));
      const buf = Buffer.from(r.dataUrl.split(',')[1], 'base64');
      fs.writeFileSync(abs(`${THUMB_DIR}/${e.id}.jpg`), buf);
      if (r.facts) measurements[e.id] = r.facts; else delete measurements[e.id];
      console.log(`[thumbs] ${String(i).padStart(3)}/${list.length} ${e.id}  ${(buf.length / 1024).toFixed(1)} KB  ${((Date.now() - t0) / 1000).toFixed(1)} s${r.facts && r.facts.triangles ? `  ${r.facts.triangles} tris` : ''}`);
    } catch (err) {
      failures.push(`${e.id}: ${err.message.split('\n')[0]}`);
      console.log(`[thumbs] ${String(i).padStart(3)}/${list.length} ${e.id}  FAILED: ${err.message.split('\n')[0].slice(0, 400)}`);
    }
    await page.close().catch(() => {});
  }
} finally {
  await cleanup();
}
const sorted = Object.fromEntries(Object.keys(measurements).sort().map((k) => [k, measurements[k]]));
fs.writeFileSync(abs(MEASUREMENTS), `${JSON.stringify(sorted, null, 1)}\n`);
built = await buildCatalog();
fs.writeFileSync(abs(CATALOG_JSON), built.json);
fs.writeFileSync(abs(MARKDOWN), built.markdown);
const total = fs.readdirSync(abs(THUMB_DIR)).reduce((s, f) => s + fs.statSync(abs(`${THUMB_DIR}/${f}`)).size, 0);
console.log(`[thumbs] ${list.length - failures.length} rendered, ${failures.length} failed; thumbnails total ${(total / 1024 / 1024).toFixed(2)} MB; catalogue rebuilt (${built.problems.length} problem(s))`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
