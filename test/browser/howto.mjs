// Runs the browser-only recipes of docs/HOWTO.md (source: test/howto/recipes.js) on the starter-drive page in headless
// Chrome with real WebGL, in three page loads:
//   1. desktop tier: clustered lights from the tier switch (lamps-tier), headlights as clustered spots, GPU particles,
//      the vehicle sound;
//   2. mobile tier: the tier switch's NearestLights pool, the clustered-lights recipe (garden and street lamps), the
//      headlights as one real SpotLight;
//   3. get in and out of a vehicle (the starter's own game system switched off): drive, stop, E out, walk, E in, drive,
//      and the car overlay's OUT button through its virtual source.
// The headlight checks compare captures with the lights on and off: the road ahead of the car gets brighter, the road
// behind it does not. Needs Chrome and the GPU, so it is not part of `npm test`; run it through the machine's GPU lock:
//   node test/browser/howto.mjs
// Exit code 1 on a failed check, a console error or a page error.
import { startVite, resolvePage, launchChrome, watchErrors, loadSample, repoRoot } from './playwright.config.mjs';

const vite = await startVite();
const browser = await launchChrome();
const fs = `/@fs${repoRoot.replace(/\/$/, '')}`;
const urls = { recipes: `${fs}/test/howto/recipes.js`, render: `${fs}/src/render/index.js`, core: `${fs}/src/core/index.js`, physics: `${fs}/src/physics/index.js` };
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

async function open(tier) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = watchErrors(page);
  const session = await loadSample(page, vite.base + (await resolvePage(vite, 'starter-drive')) + `?quality=${tier}`, errors);
  if (session.status !== 'ready') throw new Error(`starter-drive (${tier}) not ready: ${session.note}`);
  return { page, errors };
}

// in the page: mean brightness change (0..255) that the headlights make around the screen points of world positions ahead
// of and behind the car (each a 9 x 9 box of 4 px cells). Captured on, off, on again: the mean of the two "on" captures
// minus the "off" one cancels a slow drift of the whole frame (lamps fading in, exposure) between the captures.
const LIGHT_PROBE = `
  window.__probe = (h, on1, off, on2, worldPoints) => {
    const cam = h.engine.camera, out = [], a = off, k = a.scale * a.scale;
    for (const p of worldPoints) {
      const v = p.clone().project(cam), cx = Math.round((v.x * 0.5 + 0.5) * a.w), cy = Math.round((0.5 - v.y * 0.5) * a.h);
      let sum = 0, n = 0;
      for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
        if (x < 0 || y < 0 || x >= a.w || y >= a.h) continue;
        const o = (y * a.w + x) * 4;
        for (let c = 0; c < 3; c++) sum += ((on1.data[o + c] + on2.data[o + c]) / 2 - off.data[o + c]) / (3 * k);
        n++;
      }
      out.push(n ? +(sum / n).toFixed(2) : NaN);
    }
    return out;
  };`;

try {
  // ---------------------------------------------------------------- 1. desktop: tier switch (clustered), headlights
  {
    const { page, errors } = await open('desktop');
    const out = await page.evaluate(async ([U, probe]) => {
      eval(probe); // eslint-disable-line no-eval
      const R = await import(U.recipes), { PostFX } = await import(U.render), { resolveQuality } = await import(U.core);
      const { ROAD_CAR_SPEC: SPEC } = await import(U.physics);  // the starter's car
      const h = window.__sample, engine = h.engine, { scene, camera, renderer } = engine;
      const S = resolveQuality().settings;
      // a second PostFX only to read the internal size from (the starter's own is not exposed); the starter's renders
      const { width, height } = engine.size;
      const postfx = new PostFX(renderer, scene, camera, { width, height, pixelRatio: engine.pixelRatio });
      const lamps = []; for (let z = 0; z > -200; z -= 24) lamps.push([-7, 7, z], [7, 7, z]);
      const cl = R.lampsByTier({ S, scene, camera, postfx, engine, lamps });
      const head = R.headlights({ engine, body: h.body, SPEC, cl, slot: lamps.length });
      await new Promise((r) => setTimeout(r, 2500));
      // headlights on, off (the system off and its two entries cleared), on again; the car at rest at the start
      const V = h.body.position.constructor, pts = [[0, 0, -14], [0, 0, 3.5]].map(([x, y, z]) => h.body.localToWorld(new V(x, y, z)));
      const wait = () => new Promise((r) => setTimeout(r, 300));
      const on1 = h.capture(4);
      engine.setSystemEnabled(head.system, false);
      for (const i of [lamps.length, lamps.length + 1]) cl.setLight(i, 0, 0, 0, 1, 0, 0, 0);
      await wait(); const off = h.capture(4);
      engine.setSystemEnabled(head.system, true);
      await wait(); const on2 = h.capture(4);
      const [ahead, behind] = window.__probe(h, on1, off, on2, pts);
      const clCount = cl ? cl.count : -1, clLights = cl ? cl.stats.lights : -1;
      // then the particles and the sound
      const dust = R.gpuParticles({ renderer, scene, camera, engine, atmosphere: null });
      const controls = { throttle: 0 };
      const { audio } = R.vehicleSound({ car: h.car, controls, engine });
      window.__howtoAudio = audio;
      await new Promise((r) => setTimeout(r, 1000));
      return {
        tier: S.lights.clustered ? 'clustered' : 'pool', clCount, clLights,
        spot: !!head.spot, ahead, behind, particles: dust ? dust.count : -1, audioStarted: !!audio.started,
      };
    }, [urls, LIGHT_PROBE]);
    await page.keyboard.press('KeyW');                          // the gesture the sound recipe waits for
    await page.waitForTimeout(500);
    out.audioAfterKey = await page.evaluate(() => !!window.__howtoAudio.started);
    console.log('[desktop]', JSON.stringify(out));
    check('lamps-tier (desktop): the clustered branch, 18 lamps + 2 headlight spots listed', out.tier === 'clustered' && out.clCount === 20 && out.clLights > 0, `count ${out.clCount}`);
    check('headlights (clustered): no SpotLight on this tier', out.spot === false);
    check('headlights (clustered): the road 14 m ahead gets brighter (golden-hour sun: a small step)', out.ahead > 0.3, `+${out.ahead}`);
    check('headlights (clustered): the road 3.5 m behind (between the car and the camera) does not', Number.isFinite(out.behind) && Math.abs(out.behind) < 0.25, `${out.behind}`);
    check('gpu-particles: particles alive', out.particles > 0);
    check('vehicle-sound: silent until a key press', out.audioStarted === false);
    check('vehicle-sound: started by the key press (output not listened to)', out.audioAfterKey === true);
    check('desktop page: no console or page errors', errors.length === 0);
    for (const e of errors) console.log('  ' + e);
    await page.close();
  }

  // ---------------------------------------------------------------- 2. mobile: tier switch (pool), clustered recipe, SpotLight
  {
    const { page, errors } = await open('mobile');
    const out = await page.evaluate(async ([U, probe]) => {
      eval(probe); // eslint-disable-line no-eval
      const R = await import(U.recipes), { PostFX } = await import(U.render), { resolveQuality } = await import(U.core);
      const h = window.__sample, engine = h.engine, { scene, camera, renderer } = engine;
      const S = resolveQuality().settings;
      const { width, height } = engine.size;
      const postfx = new PostFX(renderer, scene, camera, { width, height, pixelRatio: engine.pixelRatio });
      const lamps = []; for (let z = 0; z > -200; z -= 24) lamps.push([-7, 7, z], [7, 7, z]);
      const tierCl = R.lampsByTier({ S, scene, camera, postfx, engine, lamps });
      const garden = [], street = [];
      for (let z = -300; z > -500; z -= 12) garden.push([-7, 4, z], [7, 4, z]);
      for (let z = -300; z > -500; z -= 40) street.push([0, 8, z]);
      const cl = R.clusteredLights({ scene, camera, postfx, engine, lamps: garden, streetLamps: street });
      const { ROAD_CAR_SPEC: SPEC } = await import(U.physics);
      const head = R.headlights({ engine, body: h.body, SPEC, cl: null, slot: 0 });
      await new Promise((r) => setTimeout(r, 2500));
      const pool = []; scene.traverse((o) => { if (o.isPointLight && o.visible) pool.push(o); });
      const V = h.body.position.constructor, pts = [[0, 0, -14], [0, 0, 3.5]].map(([x, y, z]) => h.body.localToWorld(new V(x, y, z)));
      h.body.updateMatrixWorld(true);
      const target = head.spot.target.getWorldPosition(new h.body.position.constructor());
      const local = h.body.worldToLocal(target.clone());
      const wait = () => new Promise((r) => setTimeout(r, 300));
      const on1 = h.capture(4);
      head.spot.intensity = 0;
      await wait(); const off = h.capture(4);
      head.spot.intensity = 520;
      await wait(); const on2 = h.capture(4);
      const [ahead, behind] = window.__probe(h, on1, off, on2, pts);
      return {
        tierCl: tierCl === null, pool: pool.length, clCount: cl.count, clLights: cl.stats.lights,
        spot: !!head.spot, targetLocal: local.toArray().map((v) => +v.toFixed(2)), ahead, behind,
      };
    }, [urls, LIGHT_PROBE]);
    console.log('[mobile]', JSON.stringify(out));
    check('lamps-tier (mobile): no ClusteredLights, a pool of 4 real lights', out.tierCl && out.pool === 4, `${out.pool} point lights`);
    check('clustered-lights: 34 garden + 5 street lamps listed', out.clCount === 39 && out.clLights >= 0, `count ${out.clCount}`);
    check('headlights (SpotLight): the target rides with the body, 20 m ahead', out.spot && Math.abs(out.targetLocal[2] - (-4.3 / 2 - 0.05 - 20)) < 0.01, `local ${out.targetLocal}`);
    check('headlights (SpotLight): the road 14 m ahead gets brighter', out.ahead > 1, `+${out.ahead}`);
    check('headlights (SpotLight): the road 3.5 m behind (between the car and the camera) does not', Number.isFinite(out.behind) && Math.abs(out.behind) < 0.25, `${out.behind}`);
    check('mobile page: no console or page errors', errors.length === 0);
    for (const e of errors) console.log('  ' + e);
    await page.close();
  }

  // ---------------------------------------------------------------- 3. get in and out of a vehicle
  {
    const { page, errors } = await open('desktop');
    await page.evaluate(async ([U]) => {
      const R = await import(U.recipes), { CharacterController } = await import(U.physics);
      const h = window.__sample, engine = h.engine, { scene, camera, renderer } = engine;
      engine.setSystemEnabled('game', false);                   // the starter's own loop: the recipe drives the car now
      const player = new h.body.constructor();             // a THREE.Group
      const capsule = h.body.children[0].clone(); capsule.scale.set(0.3, 3, 0.15); capsule.position.set(0, 0.9, 0);
      player.add(capsule); scene.add(player);
      const cc = new CharacterController({ radius: 0.32, height: 1.8 });
      const g = R.getInOut({ engine, camera, renderer, physics: engine.physics, car: h.car, carBody: h.body, cc, player });
      window.__gio = { ...g, cc, player };
    }, [urls]);
    const st = () => page.evaluate(() => { const s = window.__sample, g = window.__gio; return { driving: g.isDriving(), carIn: g.carInput.enabled, walkIn: g.walkInput.enabled, visible: g.player.visible, car: [s.car.position.x, s.car.position.z], speed: s.car.speed, cc: [g.cc.position.x, g.cc.position.z], gap: Math.hypot(g.cc.position.x - s.car.position.x, g.cc.position.z - s.car.position.z) }; });
    const s0 = await st();
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    const s1 = await st();
    await page.keyboard.down('KeyS');
    for (let i = 0; i < 100 && (await st()).speed > 0.5; i++) await page.waitForTimeout(50);
    await page.keyboard.up('KeyS'); await page.waitForTimeout(200);
    const sStop = await st();
    await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
    const s2 = await st();
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1000); await page.keyboard.up('KeyW'); await page.waitForTimeout(300);
    const s3 = await st();
    await page.keyboard.press('KeyF'); await page.waitForTimeout(300);
    const s4 = await st();
    await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    for (let i = 0; i < 100 && (await st()).speed > 0.5; i++) await page.waitForTimeout(50);
    await page.keyboard.up('KeyS'); await page.waitForTimeout(200);
    const s5 = await st();
    await page.evaluate(() => { window.__gio.carInput.map.setVirtual('out', 1); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__gio.carInput.map.setVirtual('out', 0); });
    await page.waitForTimeout(200);
    const s6 = await st();
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    console.log('[get-in-out]', JSON.stringify({ s0, s1, sStop, s2, s3, s4, s5, s6 }));
    check('get-in-out: starts driving (car input on, walker input off, walker hidden)', s0.driving && s0.carIn && !s0.walkIn && !s0.visible);
    check('get-in-out: W drives the car', d(s1.car, s0.car) > 2, `${d(s1.car, s0.car).toFixed(1)} m`);
    check('get-in-out: E after stopping gets out', !s2.driving && !s2.carIn && s2.walkIn && s2.visible, `stopped at ${sStop.speed.toFixed(2)} m/s`);
    check('get-in-out: the walker stands beside the car', s2.gap > 1.5 && s2.gap < 3, `${s2.gap.toFixed(2)} m`);
    check('get-in-out: W walks, the parked car stays', d(s3.cc, s2.cc) > 1 && d(s3.car, s2.car) < 0.1, `walked ${d(s3.cc, s2.cc).toFixed(2)} m, car ${d(s3.car, s2.car).toFixed(3)} m`);
    check('get-in-out: F next to the car gets back in', s4.driving && s4.carIn && !s4.walkIn && !s4.visible, `gap was ${s3.gap.toFixed(2)} m`);
    check('get-in-out: W drives again', d(s5.car, s4.car) > 1, `${d(s5.car, s4.car).toFixed(1)} m`);
    check('get-in-out: the OUT touch button (virtual \'out\') gets out', !s6.driving && s6.walkIn);
    check('get-in-out page: no console or page errors', errors.length === 0);
    for (const e of errors) console.log('  ' + e);
    await page.close();
  }
} catch (e) {
  failed++; console.log('FAIL  ' + e.message);
} finally {
  await browser.close(); await vite.close();
}
process.exit(failed ? 1 : 0);
