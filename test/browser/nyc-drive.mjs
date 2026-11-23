// Night NYC is a driving game (samples/nyc-night): the page loads with ?autostart=1 on the desktop tier with no console
// or page error, the player is the car on 7th Avenue (no walker), holding W drives it down the avenue (at least 12 m
// along its start heading in 3 s, faster than 25 km/h, still on the avenue's line), and picking another car in the
// shell's settings puts that car's body and spec on the street. Exit code 1 on any failure. Optional --out=<file.png>
// saves the last frame.
//   node test/browser/nyc-drive.mjs [--out=shot.png]
import { parseArgs, startVite, resolvePage, launchChrome, watchErrors, loadSample } from './playwright.config.mjs';

const args = parseArgs();
const vite = await startVite();
const browser = await launchChrome();
const fails = [];
const check = (name, ok, note = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  (${note})` : ''}`); if (!ok) fails.push(name); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);
  const session = await loadSample(page, `${vite.base}${await resolvePage(vite, 'nyc-night')}?autostart=1&quality=desktop`, errors);
  check('loads and is ready', session.status === 'ready', `${session.status} in ${session.loadMs} ms`);
  if (session.status === 'ready') {
    const car = () => page.evaluate(() => { const N = window.__nyc, c = N.drive.car; return { id: N.drive.id, type: N.drive.visual.type, x: c.position.x, z: c.position.z, h: c.heading, kmh: c.speed * 3.6, mass: N.drive.spec.mass, walker: 'player' in N || !!N.engine.scene.getObjectByName('player') }; });
    const a = await car();
    check('the player is a car, no walker', !a.walker && !!a.type, `${a.id} (${a.type})`);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(3000);
    const b = await car();
    await page.keyboard.up('KeyW');
    const fx = -Math.sin(a.h), fz = -Math.cos(a.h), along = (b.x - a.x) * fx + (b.z - a.z) * fz, side = Math.abs((b.x - a.x) * -fz + (b.z - a.z) * fx);
    check('W drives it down the avenue', along > 12 && b.kmh > 25 && side < 4, `${along.toFixed(1)} m along, ${side.toFixed(1)} m off the line, ${b.kmh.toFixed(0)} km/h`);
    await page.evaluate(() => window.__nyc.shell.settings.set('car', 'interceptor'));
    const c = await car();
    check('another car from the settings', c.id === 'interceptor' && c.type === 'police_sedan' && c.mass !== a.mass, `${c.id} (${c.type}, ${c.mass} kg)`);
    if (typeof args.out === 'string') await page.screenshot({ path: args.out });
  }
  check('no console or page error', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close(); await vite.close();
}
console.log(fails.length ? `nyc-drive: ${fails.length} FAILED` : 'nyc-drive: pass');
process.exit(fails.length ? 1 : 0);
