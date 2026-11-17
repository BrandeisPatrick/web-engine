// The sound kit in headless Chrome: load samples/sound-check/, run its self-test (the ten-second scene rendered in an
// OfflineAudioContext through the safe master chain, measured against MIX_LIMITS), print the numbers and fail on any
// broken limit or console error. Optionally save the mix and a screenshot:
//   node test/browser/sound-check.mjs [--wav=out.wav] [--shot=out.png]
// Run it through the machine's GPU lock when other jobs share the machine.
import fs from 'node:fs';
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, parseArgs } from './playwright.config.mjs';

const args = parseArgs();
const vite = await startVite();
const browser = await launchChrome();
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = watchErrors(page);
  const session = await loadSample(page, vite.base + await resolvePage(vite, 'sound-check'), errors);
  const fail = session.status === 'ready' ? await page.evaluate(() => window.__sample.selfTest()) : `page ${session.status}`;
  const r = await page.evaluate(() => window.__sample.report());
  if (r) {
    console.log(`self-test: ${r.ok ? 'PASS' : 'FAIL'}  peak ${r.peak.toFixed(3)}, clipped ${r.clipped}, NaN ${r.nan}, DC ${r.dc.toExponential(1)}, `
      + `quietest ${r.quietest} dBFS, loudest ${r.loudest} dBFS (median ${r.median}, +${(r.loudest - r.median).toFixed(1)} dB), rendered in ${r.renderMs} ms`);
    console.log(`loudness per 0.5 s (dBFS): ${r.loudness.join(' ')}`);
  }
  if (fail) console.log(`failures: ${fail}`);
  if (args.wav && r) {
    fs.writeFileSync(String(args.wav), Buffer.from(await page.evaluate(() => window.__sample.wavBase64()), 'base64'));
    console.log(`wrote ${args.wav}`);
  }
  if (args.shot) { await page.screenshot({ path: String(args.shot), fullPage: true }); console.log(`wrote ${args.shot}`); }
  for (const e of errors) console.log(`  error: ${e}`);
  ok = session.status === 'ready' && !fail && errors.length === 0;
} finally {
  await browser.close(); await vite.close();
}
process.exit(ok ? 0 : 1);
