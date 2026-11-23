// Night NYC is a driving game (samples/nyc-night): the page loads with ?autostart=1 on the desktop tier with no console
// or page error, the player is the car on 7th Avenue (no walker), holding W drives it down the avenue (at least 12 m
// along its start heading in 3 s, faster than 25 km/h, still on the avenue's line), and picking another car in the
// shell's settings puts that car's body and spec on the street. Then the engine sound, after the key press that starts
// the audio: for each car (each picked in turn, so each is also a swap) its EngineAudio exists, exactly one engine voice
// feeds the engine bus (the old car's is gone), the bus is audible standing at idle (an analyser on it: RMS over -50
// dBFS), and under full throttle it is louder or higher (RMS or spectral centroid up). Exit code 1 on any failure. Optional --out=<file.png>
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
  // count what feeds each audio node: AudioNode.connect / disconnect() wrapped before the page's scripts run
  await page.addInitScript(() => {
    const into = window.__into = new WeakMap(), from = new WeakMap(), P = AudioNode.prototype, con = P.connect, dis = P.disconnect;
    P.connect = function (dst, ...a) {
      if (dst instanceof AudioNode && !a.length) { if (!into.has(dst)) into.set(dst, new Set()); into.get(dst).add(this); if (!from.has(this)) from.set(this, new Set()); from.get(this).add(dst); }
      return con.call(this, dst, ...a);
    };
    P.disconnect = function (...a) {
      if (!a.length && from.has(this)) { for (const d of from.get(this)) into.get(d)?.delete(this); from.delete(this); }
      return dis.apply(this, a);
    };
  });
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
    // the engine sound per car
    await page.keyboard.press('ShiftLeft'); // a gesture: the bus starts on the first one (?autostart=1)
    await page.waitForFunction(() => window.__nyc.audio.started, null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => {
      const A = window.__nyc.audio, ctx = A.ctx, an = ctx.createAnalyser(), mute = ctx.createGain();
      an.fftSize = 8192; mute.gain.value = 0; A.bus('engine').connect(an); an.connect(mute); mute.connect(ctx.destination);
      window.__meter = () => {
        const t = new Float32Array(an.fftSize), f = new Float32Array(an.frequencyBinCount); an.getFloatTimeDomainData(t); an.getFloatFrequencyData(f);
        let e = 0; for (const v of t) e += v * v;
        let w = 0, wf = 0; for (let i = 1; i < f.length; i++) { const p = 10 ** (f[i] / 10); w += p; wf += p * i * ctx.sampleRate / an.fftSize; }
        return { db: 10 * Math.log10(e / t.length + 1e-20), hz: w ? wf / w : 0 };
      };
    });
    const meter = async () => { const m = []; for (let i = 0; i < 6; i++) { m.push(await page.evaluate(() => window.__meter())); await page.waitForTimeout(100); } return { db: m.reduce((a, x) => a + x.db, 0) / m.length, hz: m.reduce((a, x) => a + x.hz, 0) / m.length }; };
    check('the audio started on a key press', await page.evaluate(() => window.__nyc.audio.started));
    for (const id of ['taxi', 'sedan', 'interceptor']) {
      const v = await page.evaluate((id) => {
        const N = window.__nyc, old = N.motor();
        N.shell.settings.set('car', id); N.placeCar(N.CAR_START.x, N.CAR_START.z, N.CAR_START.h);
        const m = N.motor(), feeds = [...(window.__into.get(N.audio.bus('engine')) || [])].length;
        return { ok: !!m && m !== old && m.constructor.name === 'EngineAudio', oldGone: !old || old._disposed === true, feeds, cyl: N.drive.def.engine.cylinders };
      }, id);
      check(`${id}: its engine voice (${v.cyl} cylinders) replaced the old one`, v.ok && v.oldGone && v.feeds === 1, `${v.feeds} voice(s) on the engine bus`);
      await page.waitForTimeout(1200);
      const idle = await meter();
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1800);
      const full = await meter(), rpm = await page.evaluate(() => Math.round(window.__nyc.drive.gearbox.rpm));
      await page.keyboard.up('KeyW');
      check(`${id}: audible at idle`, idle.db > -50, `${idle.db.toFixed(1)} dBFS, centroid ${idle.hz.toFixed(0)} Hz`);
      check(`${id}: louder or higher under full throttle`, full.db > idle.db + 3 || full.hz > idle.hz * 1.2, `${full.db.toFixed(1)} dBFS, centroid ${full.hz.toFixed(0)} Hz at ${rpm} rpm`);
    }
    if (typeof args.out === 'string') await page.screenshot({ path: args.out });
  }
  check('no console or page error', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close(); await vite.close();
}
console.log(fails.length ? `nyc-drive: ${fails.length} FAILED` : 'nyc-drive: pass');
process.exit(fails.length ? 1 : 0);
