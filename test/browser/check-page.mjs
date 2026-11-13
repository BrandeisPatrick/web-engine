// Load one sample page in headless Chrome, wait for window.__sample.ready, hold W for two seconds and report errors.
// The smallest use of the repo's browser harness, and the source of the "test a page headlessly" recipe in
// docs/HOWTO.md. Run it through the machine's GPU lock when other jobs share the machine:
//   node test/browser/check-page.mjs starter-walk        (or starter-drive, or your own samples/<name>)
// Exit code 1 on a console error, a page error or a page that never became ready.
// #region howto:check-page
import { startVite, resolvePage, launchChrome, watchErrors, loadSample } from './playwright.config.mjs';

const id = process.argv[2] || 'starter-walk';
const vite = await startVite();                       // its own dev server on a free port; closed below
const browser = await launchChrome();                 // headless Chrome with the GPU flags the harness uses
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);                   // console errors + page errors
  const path = await resolvePage(vite, id);
  const session = await loadSample(page, vite.base + path, errors); // waits for window.__sample.ready
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
  const draws = await page.evaluate(() => window.__sample.info().drawCalls);
  ok = session.status === 'ready' && errors.length === 0;
  console.log(`${id}: ${session.status} in ${session.loadMs} ms, ${draws} draw calls, ${errors.length} errors`);
  for (const e of errors) console.log('  ' + e);
} finally {
  await browser.close(); await vite.close();
}
process.exit(ok ? 0 : 1);
// #endregion howto:check-page
