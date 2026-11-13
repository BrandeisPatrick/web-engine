// Runs the browser-only recipes of docs/HOWTO.md (source: test/howto/recipes.js) on the starter-drive page in headless
// Chrome with real WebGL: clustered lights (wired into a PostFX), GPU particles and the vehicle sound. Needs Chrome
// and the GPU, so it is not part of `npm test`; run it through the machine's GPU lock:
//   node test/browser/howto.mjs
// Exit code 1 on a failed check, a console error or a page error.
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, repoRoot } from './playwright.config.mjs';

const vite = await startVite();
const browser = await launchChrome();
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);
  const session = await loadSample(page, vite.base + (await resolvePage(vite, 'starter-drive')), errors);
  if (session.status !== 'ready') throw new Error(`starter-drive not ready: ${session.note}`);
  const fs = `/@fs${repoRoot.replace(/\/$/, '')}`;
  // the same URL the starter's '@vibe/engine/render' import resolves to, so both share one module instance
  const out = await page.evaluate(async ([recipesUrl, renderUrl]) => {
    const R = await import(recipesUrl);
    const { PostFX } = await import(renderUrl);
    const h = window.__sample, engine = h.engine, { scene, camera, renderer } = engine;
    // a second PostFX only to read the internal size from (the starter's own is not exposed); the starter's renders
    const { width, height } = engine.size;
    const postfx = new PostFX(renderer, scene, camera, { width, height, pixelRatio: engine.pixelRatio });
    const lamps = []; for (let z = 0; z > -200; z -= 12) lamps.push([-7, 4, z], [7, 4, z]);
    const cl = R.clusteredLights({ scene, camera, postfx, engine, lamps });
    const atmosphere = null;
    const dust = R.gpuParticles({ renderer, scene, camera, engine, atmosphere });
    const controls = { throttle: 0 };
    const { audio } = R.vehicleSound({ car: h.car, controls, engine });
    window.__howtoAudio = audio;
    await new Promise((r) => setTimeout(r, 1500));            // ~90 live frames
    return {
      clusteredLights: cl.stats.lights, clusteredCount: cl.count, clSize: [postfx.internalWidth, postfx.internalHeight],
      particles: dust ? dust.count : -1, audioStarted: !!audio.started,
      drawCalls: h.info().drawCalls,
    };
  }, [`${fs}/test/howto/recipes.js`, `${fs}/src/render/index.js`]);
  await page.keyboard.press('KeyW');                          // the gesture the recipe waits for
  await page.waitForTimeout(500);
  out.audioAfterKey = await page.evaluate(() => ({ started: !!window.__howtoAudio.started, state: window.__howtoAudio.bus.ctx && window.__howtoAudio.bus.ctx.state }));
  console.log(JSON.stringify(out));
  const check = (name, ok) => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
  check('clustered-lights: lights listed and in view', out.clusteredCount === 34 && out.clusteredLights > 0);
  check('gpu-particles: particles alive', out.particles > 0);
  check('vehicle-sound: silent until a key press', out.audioStarted === false);
  check('vehicle-sound: started by the key press (output not listened to)', out.audioAfterKey.started === true);
  check('no console or page errors', errors.length === 0);
  for (const e of errors) console.log('  ' + e);
} catch (e) {
  failed++; console.log('FAIL  ' + e.message);
} finally {
  await browser.close(); await vite.close();
}
process.exit(failed ? 1 : 0);
