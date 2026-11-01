// Midnight Candy Run — the 2026 Halloween game, built only on the engine (src/**) and three.js.
// A kid in a witch costume runs through a moonlit pumpkin patch and graveyard collecting candy before the clock strikes
// midnight (a 3-minute round). Jack-o'-lanterns smash into real fracture pieces and spill candy; bedsheet ghosts
// (XPBD cloth on kinematic heads) wander, chase and steal candy on touch; BOO scares the nearby ones away and shakes
// candy out of them. Best score in localStorage.
// Wiring: Engine (120 Hz fixed step, render interpolation, adaptive resolution) + PhysicsWorld (heightfield + static
// boxes) + CharacterController + AnimationController (the kid, kid.js) + DynamicsWorld (ghost cloth, kinematic heads,
// pumpkin shards) + Atmosphere (night, moon light + cascaded shadow, indigo night sky, moonScatter: the mist glows
// toward the moon) + PostFX (bloom, fog, grade; desktop: volumetric moon shafts; lighter on phones) + NearestLights pool
// (lantern point lights) + looks.js (world-space detail, rims, grass wind) + ThirdPersonRig (drag-to-look, auto-recentre)
// / OrbitRig (title, results) + CharacterInput (keyboard, mouse, gamepad, touch: floating stick, look pad, JUMP / BOO
// with a cooldown ring, safe-area aware, portrait + landscape layouts) + AudioBus synth (audio.js) + DOM HUD (hud.js).
// Query: ?touch=1|0 (force the touch UI), ?quality=low|high, ?nofx=1, ?round=<s> (round length), ?shadows=0, ?fps=N.
// Touch: on for phones and tablets (isTouchDevice multiTouch: an iPad with a keyboard too); anywhere else (a laptop with
// a touchscreen) the first touch reveals the controls and a key press hides them again (CharacterInput touchReveal).
// Haptics (navigator.vibrate: Android; iOS has none) on candy, smashes, BOO and catches while the touch UI is on.
// window.__game exposes the state for tests (test/browser/halloween.mjs).
import * as THREE from 'three';
import { Engine } from '@vibe/engine/core';
import { PhysicsWorld, CharacterController, DynamicsWorld } from '@vibe/engine/physics';
import { Atmosphere, PostFX, DEFAULT_GRADE, DEFAULT_LOOKS } from '@vibe/engine/render';
import { AnimationController } from '@vibe/engine/anim';
import { CharacterInput, CHARACTER_ACTIONS, PointerLock, isTouchDevice, PAD_BUTTONS as PB } from '@vibe/engine/input';
import { ThirdPersonRig, OrbitRig } from '@vibe/engine/camera';
import { LoadingScreen } from '@vibe/engine/ui';
import { buildWorld, heightAt, PLAY } from './world.js';
import { buildKid } from './kid.js';
import { Lanterns } from './pumpkins.js';
import { Candy, CANDY_KIND } from './candy.js';
import { Ghosts } from './ghosts.js';
import { Effects, Glows, Bats } from './effects.js';
import { GameAudio } from './audio.js';
import { HUD, ACCENT, applyTheme } from './hud.js';
import { LOOK } from './looks.js';

const params = new URLSearchParams(location.search);
const flag = (k) => params.has(k) && params.get(k) !== '0';
const FORCED = params.has('touch') ? flag('touch') : null; // ?touch=1 / ?touch=0 pin the touch UI on / off
const TOUCH = FORCED ?? isTouchDevice({ multiTouch: true });  // at load; later touches / keys can switch (touchUI)
const LOW = params.has('quality') ? params.get('quality') === 'low' : TOUCH;
const NOFX = flag('nofx');
const SHADOWS = !(params.has('shadows') && params.get('shadows') === '0');
const ROUND = Math.max(10, +params.get('round') || 180);
const BEST_KEY = 'midnight-candy-run.best';
const SPAWN = [0, 6];
const BOO_CD = 5, BOO_R = 7.5, SAFE_T = 2.2;
const RECENTRE_TOUCH = 0.7, RECENTRE_DESK = 1.3; // s without look input before the camera eases behind a running kid
// haptic pulses (ms); a candy streak buzzes at most every CANDY_BUZZ_GAP s
const BUZZ = { candy: 8, pop: 30, smash: 35, stomp: [30, 40, 50], boo: 22, caught: [70, 50, 90] }, CANDY_BUZZ_GAP = 0.09;
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const CANDY_TARGET = LOW ? 55 : 65;
const GHOSTS = LOW ? 5 : 6;
// round seconds (of 180) at which the next ghost rises: one early (it teaches BOO), then one about every 30 s
const WAKE_AT = [5, 24, 50, 80, 110, 140];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// night grade: moonlit indigo shadows, warm lantern highlights, more contrast than the stock night grade, bloom for
// the lanterns and the moon, a vignette
const GRADE = DEFAULT_GRADE.map((g) => (g.el > -8 ? g : {
  ...g, exp: 1.45, aeMax: 1.45, bT: 0.8, bS: 0.85, bR: 0.66, sat: 1.18, con: 0.24, split: 1.25,
  sh: [0.002, -0.004, 0.03], hi: [0.036, 0.016, -0.018], vig: 0.5, grain: 0.018, wb: [0.97, 0.97, 1.06],
}));
// night sky looks: clouds lit from the moon side (silver tops, dark bodies) instead of a flat purple smudge
const LOOKS = DEFAULT_LOOKS.map((l) => (l.el > -12 ? l : { ...l, cover: 0.34, cop: 0.9, cs: [0.07, 0.075, 0.13], ca: [0.012, 0.01, 0.026] }));

// input: the character preset with BOO on interact (E / F / B / Q, pad X / B, touch 'boo'), pause (Esc / P / pad Start),
// start (Enter / Space / pad A), mute (M / pad Back): a Bluetooth gamepad paired to a phone plays the whole game too
const ACTIONS = {
  ...CHARACTER_ACTIONS,
  interact: { type: 'button', bindings: ['KeyE', 'KeyF', 'KeyB', 'KeyQ', { padButton: PB.X }, { padButton: PB.B }, { virtual: 'boo' }] },
  menu: { type: 'button', alwaysOn: true, bindings: ['Escape', 'KeyP', { padButton: PB.START }] },
  start: { type: 'button', alwaysOn: true, bindings: ['Enter', 'NumpadEnter', 'Space', { padButton: PB.A }] },
  mute: { type: 'button', alwaysOn: true, bindings: ['KeyM', { padButton: PB.BACK }] },
};
// touch: floating move stick (left part of the screen), drag-to-look pad (right), JUMP + BOO by the right thumb.
// Portrait overrides keep the buttons stacked inside a narrow screen's thumb reach.
const TOUCH_LAYOUT = [
  { type: 'touchpad', id: 'look', side: 'right', width: 0.56, top: 70, bottom: 0, portrait: { width: 0.5, top: 120 } },
  { type: 'stick', id: 'stick', side: 'left', x: 112, y: 112, radius: 60, floating: true, zone: { width: 0.44, top: 70 },
    portrait: { x: 96, y: 150, radius: 58, zone: { width: 0.5, top: 170 } } },
  { type: 'button', id: 'jump', label: 'JUMP', side: 'right', x: 84, y: 92, size: 98, fontSize: 15, portrait: { x: 76, y: 128, size: 92 } },
  { type: 'button', id: 'boo', label: 'BOO!', side: 'right', x: 200, y: 66, size: 82, fontSize: 16, portrait: { x: 84, y: 250, size: 84 } },
];

function loadBest() { try { return Math.max(0, parseInt(localStorage.getItem(BEST_KEY), 10) || 0); } catch { return 0; } }
function saveBest(n) { try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* private mode / blocked storage */ } }

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

async function boot() {
  const t0 = performance.now();
  applyTheme();
  const loading = new LoadingScreen({ title: 'MIDNIGHT CANDY RUN', label: 'Carving pumpkins…', accent: ACCENT, background: '#0b0612' });
  installPhoneGuards();
  const physics = new PhysicsWorld({ cellSize: 8 });
  const engine = new Engine({
    container: document.getElementById('app'), fixedHz: 120, maxSubsteps: 4, physics, fov: 58, near: 0.1, far: 1500,
    renderer: { antialias: NOFX, powerPreference: 'high-performance' }, maxPixelRatio: LOW ? 1.5 : 2, shadows: SHADOWS,
    targetFps: +params.get('fps') || (TOUCH ? 60 : 0),
  });
  const { scene, camera, renderer } = engine;
  const atmo = new Atmosphere({
    scene, renderer, camera, timeOfDay: 23.6, skyRadius: 1000, flare: false, cloudWind: [4, 1.5], looks: LOOKS,
    moon: { azimuth: 22, elevation: 13 }, moonIntensity: 1.9, moonColor: [0.68, 0.74, 1.0], fogDensity: [0.022, 0],
    moonScatter: 0.05, // the ground mist glows toward the moon (and the desktop volumetric pass marches moonlight)
    shadows: LOW ? { cascades: 1, single: 24, singleMapSize: 1024, kernel: 'fast' } : { cascades: 1, single: 34, singleMapSize: 2048, kernel: 'fast' },
    maxCasterHeight: 24,
  });
  // Halloween night: a deep indigo zenith over a violet horizon glow, on both the visible sky and the one the
  // environment / fog colour come from, then re-bake (setTime rebuilds the PMREM environment, the fog colour, horizon)
  for (const sky of [atmo.sky, atmo.envSky]) {
    const u = sky.material.uniforms;
    u.uNightZen.value.setRGB(0.004, 0.0045, 0.022);
    u.uNightHor.value.setRGB(0.042, 0.028, 0.09);
    u.uPollution.value.setRGB(0.032, 0.012, 0.04);
  }
  atmo.setTime(atmo.timeOfDay);
  // the visible sky lights its clouds from the moon (silver edges toward it); the night sky model itself ignores the
  // sun position, and the baked environment keeps the real one
  atmo.sky.material.uniforms.sunPosition.value.copy(atmo.moonDir);
  // less flat ambient, more moon: shapes read by moonlight and shadow instead of an even purple fill
  atmo.hemi.intensity = 0.34; atmo.hemi.color.set('#5b5ccf'); atmo.hemi.groundColor.set('#2c2230');
  scene.environmentIntensity = 0.55;
  const fp = atmo.fogParams; fp.haze = 0.0048; fp.hazeK = 1 / 26; fp.mist = 0.05; fp.mistK = 1.6;

  // ---------------------------------------------------------------- world + game objects (one loading system)
  const W = {};
  engine.addSystem({
    async load(progress) {
      progress(0.1, 'Raising the graveyard…'); await nextFrame();
      W.world = buildWorld({ scene, renderer, physics, low: LOW });
      progress(0.45, 'Carving jack-o\'-lanterns…'); await nextFrame();
      W.dyn = new DynamicsWorld({ physics, substeps: 1, maxParticles: GHOSTS * 13 * 13 + 64, maxBodies: 128, sleep: { linear: 0.08, angular: 0.08, time: 0.4 } });
      W.lanterns = new Lanterns({ scene, dyn: W.dyn, spots: W.world.lanternSpots, heightAt, lights: LOW ? 4 : 5 });
      progress(0.65, 'Waking the ghosts…'); await nextFrame();
      // desktop / high: the nearest ghost also lights its surroundings (lights: 5 lanterns + the pail + this = 7 of 8)
      W.ghosts = new Ghosts({ scene, dyn: W.dyn, heightAt, spawns: W.world.ghostSpawns, count: GHOSTS, grid: LOW ? 11 : 13, light: !LOW });
      W.ghosts.settle(LOW ? 120 : 150);
      progress(0.85, 'Unwrapping candy…'); await nextFrame();
      W.candy = new Candy({ scene, heightAt, candySpot: W.world.candySpot });
      W.fx = new Effects({ scene, heightAt, low: LOW });
      W.glows = new Glows(320);
      scene.add(W.glows.mesh);
      W.bats = new Bats({ scene, count: LOW ? 6 : 9 });
      progress(1, 'Ready');
    },
  }, 'world-load');
  await engine.load((p, label) => loading.setProgress(p, label));
  const { world, dyn, lanterns, ghosts, candy, fx, glows, bats } = W;

  // ---------------------------------------------------------------- the kid
  const kid = buildKid();
  const view = new THREE.Group(); view.name = 'kidView'; view.rotation.y = Math.PI; view.add(kid.root);
  const player = new THREE.Group(); player.name = 'player'; player.add(view);
  scene.add(player);
  const pailLight = new THREE.PointLight(0xffa040, 2.6, 7.5, 1.5);
  pailLight.position.set(0.25, 0.75, -0.35); player.add(pailLight);
  const ctl = new AnimationController(kid.root, kid.clips, {
    states: { idle: { clip: 'Idle' }, walk: { clip: 'Walking', speed: 1.3 }, run: { clip: 'Running', speed: 1.45 }, jump: { clip: 'Jump', loop: false, clamp: true, speed: 1.15 } },
    trees: { locomotion: { type: '1d', param: 'speed', sync: true, points: [{ at: 0, state: 'idle' }, { at: 2.2, state: 'walk' }, { at: 5.2, state: 'run' }] } },
    transitions: { default: 0.15, '*->jump': 0.06 },
  });
  ctl.play('locomotion');
  let animMode = 'loco';
  ctl.events.on('end', (s) => { if ((s === 'jump' || (s && s.name === 'jump')) && cc.grounded) { animMode = 'loco'; ctl.play('locomotion'); } });
  const cc = new CharacterController({ radius: 0.3, height: 1.3, walk: 6, run: 6, jumpSpeed: 5.8, accel: 34, decel: 30, airControl: 0.6, stepHeight: 0.32 });
  const intent = { moveX: 0, moveZ: 0, jump: false, fwd: 0 };
  const camState = { facing: 0, speed: 0, grounded: true, velocity: cc.velocity };
  const prev = new THREE.Vector3(), cur = new THREE.Vector3();
  let yOff = 0;
  // secondary motion: the cape swings back with the speed (and flutters), the hat tip flops, the body leans into a
  // run, a hard landing squashes the kid for a moment
  const motion = { cape: 0.12, hat: 0, lean: 0, squash: 0, t: 0 };

  // ---------------------------------------------------------------- audio, HUD, input, camera
  const audio = new GameAudio();
  audio.unlock();
  const best0 = loadBest();
  const G = { // round state (also what window.__game shows)
    state: 'title', time: 0, left: ROUND, candy: 0, best: best0, smashed: 0, booed: 0, caught: 0, pops: 0,
    booT: BOO_CD, safeT: 0, streak: 0, lastPick: -9, wakeIdx: 0, spawnT: 0, popT: 12, endT: 0, lastCount: 99, music: true,
    pickups: 0, hintBoo: false, hintT: 0, newBest: false,
  };
  let booedEver = false;
  const hud = new HUD({
    touch: TOUCH,
    onStart: () => startRound(),
    onPause: () => setPaused(true),
    onResume: () => setPaused(false),
    onRestart: () => startRound(),
    onTitle: () => toTitle(),
    onMute: () => { hud.setMuted(audio.toggleMute()); },
    onMusic: () => { G.music = !G.music; audio.setMusic(G.music); hud.setMusicLabel(G.music); },
  });
  const canvas = renderer.domElement;
  let touchUI = TOUCH; // the touch presentation is on (controls, HUD texts, camera recentre, haptics)
  const setTouchUI = (on) => {
    touchUI = on;
    hud.setTouch(on);
    if (on && input.touch) { const b = input.touch.get('boo'); if (b) b.el.classList.add('hw-boo-btn'); }
  };
  const input = new CharacterInput({
    element: canvas, actions: ACTIONS, touch: TOUCH, touchLayout: TOUCH_LAYOUT, touchOptions: { safeArea: true }, touchSpeed: 0.0055, holdButton: 2,
    touchReveal: FORCED === null ? { hideOnKey: true, onChange: setTouchUI } : null,
  });
  setTouchUI(TOUCH);
  let buzzT = 0;
  const buzz = (pattern) => { if (!canVibrate || !touchUI) return; try { navigator.vibrate(pattern); } catch { /* blocked */ } };
  const rig = new ThirdPersonRig(camera, canvas, { active: false, physics, distance: 5.4, height: 1.2, shoulder: 0, pitch: [-1.0, 0.45], damping: 10, autoRecentre: RECENTRE_TOUCH, recentreRate: 1.5, zoom: [3, 9], minDistance: 1.4, wheelZoom: true });
  rig.setTarget(player, () => camState);
  const orbitTarget = new THREE.Object3D(); orbitTarget.position.set(-2, 0, -4); scene.add(orbitTarget);
  const orbit = new OrbitRig(camera, null, { active: false, target: orbitTarget, distance: 30, elevation: 0.3, azimuth: 0.4, autoRotate: 0.07, minElevation: 0.05, physics, offsetY: 2 });
  let rigOn = null;
  const setRig = (r) => { for (const q of [rig, orbit]) if (q !== r) q.deactivate(); rigOn = r; r.activate(); r.snap(); };
  const lock = new PointerLock({ element: canvas, onChange(locked) { if (!locked && lock.releasedByUser && G.state === 'play') setPaused(true); } });
  canvas.addEventListener('click', () => { if (!touchUI && G.state === 'play' && !lock.locked) lock.request(); });

  // portrait phones: a wider view and the camera a bit further back
  const fitCamera = (w, h) => {
    const portrait = h > w;
    camera.fov = portrait ? 74 : 58; camera.updateProjectionMatrix();
    rig.distance = portrait ? 6.4 : 5.4; rig.height = portrait ? 1.35 : 1.2;
  };

  // ---------------------------------------------------------------- post-processing
  let postfx = null;
  if (!NOFX) {
    try {
      const { width, height } = engine.size;
      postfx = new PostFX(renderer, scene, camera, {
        atmosphere: atmo, width, height, pixelRatio: engine.pixelRatio, grade: GRADE, aa: 'fxaa', msaaMaxPixels: 0,
        ao: { radius: 0.7, thickness: 0.7, samples: LOW ? 6 : 8, maxPixels: LOW ? 0.25e6 : 0.6e6 },
        bloom: { strength: 0.9, radius: 0.6, threshold: 0.9, resolutionScale: LOW ? 0.35 : 0.5 },
        // desktop / high: moonlight shafts through the mist (the volumetric pass marching the moon: Atmosphere
        // moonScatter), shadowed by the moon's map (so not with ?shadows=0); phones keep the fog's analytic moon glow
        volumetric: LOW || !SHADOWS ? false : { maxDistance: 50, steps: 16, intensity: 0.07 },
      });
      if (LOW) postfx.ao.enabled = false;
    } catch (e) { console.warn('[halloween] post-processing unavailable', e); postfx = null; }
  }
  if (!postfx) atmo.setFogMode('scene');
  engine.renderFn = (sc, cam, dt) => { if (postfx) postfx.render(dt); else renderer.render(sc, cam); };
  engine.onResize = (w, h, pr) => { fitCamera(w, h); if (postfx) postfx.setSize(w, h, pr); };
  fitCamera(engine.size.width, engine.size.height);
  const relayout = () => engine.resize();
  window.addEventListener('orientationchange', () => { setTimeout(relayout, 120); setTimeout(relayout, 500); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);

  // the audio follows one wish, held (paused / hidden tab) or not: a suspend() issued while a resume() is still pending
  // (RESUME, then the tab hidden a moment later) used to lose, leaving the music playing behind the pause screen
  let audioHeld = false;
  const holdAudio = (on, tries = 2) => {
    audioHeld = on;
    (on ? audio.bus.suspend() : audio.bus.resume()).then(() => {
      const ctx = audio.bus.ctx; // the context ended up against the latest wish: apply it again (bounded)
      if (ctx && tries > 0 && (ctx.state === 'running') === audioHeld) holdAudio(audioHeld, tries - 1);
    }, () => {});
  };

  // ---------------------------------------------------------------- round flow
  const placeKid = () => {
    const x = SPAWN[0], z = SPAWN[1];
    cc.teleport(x, heightAt(x, z) + 0.05, z);
    prev.copy(cc.position); cur.copy(cc.position); player.position.copy(cc.position); yOff = 0;
    camState.facing = 0; player.rotation.y = 0; intent.moveX = intent.moveZ = intent.fwd = 0; intent.jump = false;
    animMode = 'loco'; ctl.play('locomotion');
  };
  const fillCandy = () => {
    candy.reset();
    for (let i = 0; i < CANDY_TARGET; i++) candy.spawnRandom(SPAWN[0], SPAWN[1], undefined, 3);
  };
  function startRound() {
    audioHeld = false; audio.start(); audio.ui();
    Object.assign(G, { state: 'play', time: 0, left: ROUND, candy: 0, smashed: 0, booed: 0, caught: 0, pops: 0, booT: BOO_CD, safeT: 0, streak: 0, lastPick: -9, wakeIdx: 0, spawnT: 0, popT: 12, endT: 0, lastCount: 99, pickups: 0 });
    if (engine.clock.paused) engine.clock.resume();
    lanterns.reset(); ghosts.reset(); fx.clear(); fillCandy(); placeKid();
    hud.setCandy(0, false); hud.setClock(ROUND, ROUND); hud.showPlay(); hud.setDanger(0);
    input.map.enabled = true;
    rig.yaw = 0; rig.pitch = -0.3; setRig(rig); rig.recentre();
    G.skipJump = true;
    G.hintBoo = !booedEver; G.hintT = 0.6; buzzT = -1; // "GRAB THE CANDY!" just after the start; the BOO hint until a first BOO hits
  }
  function toTitle() {
    if (lock.locked) lock.exit();
    if (engine.clock.paused) setClockPaused(false);
    holdAudio(false);
    G.state = 'title';
    lanterns.reset(); ghosts.reset(); fx.clear(); fillCandy(); placeKid();
    orbitTarget.position.set(-2, 0, -4); orbit.distance = 30; orbit.elevation = 0.3; orbit.azimuth = 0.4; // title framing
    hud.showTitle(G.best); setRig(orbit);
    for (let i = 0; i < 3; i++) ghosts.wake(SPAWN[0], SPAWN[1]); // a few ghosts drift around behind the title
  }
  function setClockPaused(on) { if (on) engine.clock.pause(); else engine.clock.resume(); }
  function setPaused(on) {
    if (on && G.state !== 'play') return;
    if (!on && G.state !== 'paused') return;
    G.state = on ? 'paused' : 'play';
    setClockPaused(on);
    hud.showPause(on);
    input.touch && input.touch.releaseAll();
    if (on && lock.locked) lock.exit();
    holdAudio(on);
  }
  function endRound() {
    G.state = 'ending'; G.endT = 0;
    // the best is saved right at midnight (closing the tab during the bells must not lose it)
    G.newBest = G.candy > G.best;
    if (G.newBest) { G.best = G.candy; saveBest(G.best); }
    audio.bell(12, 0.5, 174); hud.flash(); hud.callout('MIDNIGHT!', 'warn');
    input.touch && input.touch.releaseAll();
    if (lock.locked) lock.exit();
    while (ghosts.awake < ghosts.list.length) if (!ghosts.wake(cc.position.x, cc.position.z)) break;
  }
  function showResults() {
    G.state = 'over';
    hud.showResults({ candy: G.candy, best: G.best, isBest: G.newBest, smashed: G.smashed, booed: G.booed, caught: G.caught, pops: G.pops });
    orbitTarget.position.copy(cc.position); orbit.distance = 12; orbit.elevation = 0.35; orbit.azimuth = rig.yaw + Math.PI;
    setRig(orbit);
  }
  // backgrounding: a round pauses (and stays paused on return); on every screen the audio is suspended while hidden
  // (the wind and the organ pad are continuous voices) and resumes on return unless the game sits paused
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.state === 'play') setPaused(true); holdAudio(true); }
    else if (G.state !== 'paused') holdAudio(false);
  });

  // ---------------------------------------------------------------- gameplay helpers
  const _f = new THREE.Vector3(), _r = new THREE.Vector3();
  const kidInfo = { x: 0, y: 0, z: 0, vx: 0, vz: 0, safe: false };
  const OFFSTAGE = { x: 1e6, y: 0, z: 1e6 }; // the magnet's "kid" while no round runs
  const doBoo = () => {
    if (G.booT < BOO_CD) { audio.tick(); return; }
    G.booT = 0;
    const p = cc.position;
    fx.boo(p.x, p.y, p.z, BOO_R); audio.boo(); buzz(BUZZ.boo);
    const scared = ghosts.boo(p.x, p.z, BOO_R);
    if (scared.length) {
      G.booed += scared.length; audio.scared(scared.length); booedEver = true; G.hintBoo = false;
      for (const g of scared) { candy.spill(g.x, g.y - 0.3, g.z, 2, 2.5, 0.25, 10); fx.burst(g.x, g.y, g.z, 18, 0.7, 0.6, 1.6, 3, 1.5); fx.flash(g.x, g.y, g.z, 3.4, 0.35, 0.55, 1.1, 0.4); }
      hud.callout(scared.length > 1 ? `BOO! ×${scared.length}` : 'BOO!', 'boo');
    } else hud.callout('BOO!', 'boo');
  };
  const onPick = (i, kind, x, y, z) => {
    const t = G.time;
    G.streak = t - G.lastPick < 0.9 ? G.streak + 1 : 0; G.lastPick = t;
    G.pickups++;
    if (t - buzzT > CANDY_BUZZ_GAP) { buzzT = t; buzz(kind === CANDY_KIND.POP ? BUZZ.pop : BUZZ.candy); }
    if (kind === CANDY_KIND.POP) { G.pops++; audio.candy(0, true); fx.flash(x, y + 0.8, z, 5, 1.2, 0.35, 0.9, 0.5); fx.burst(x, y + 0.6, z, 40, 1.6, 0.5, 1.4, 4, 2.5, 1); hud.callout('+5 BIG POP!', 'good'); }
    else { audio.candy(G.streak); fx.burst(x, y, z, 8, 1.4, 1.0, 0.5, 1.6, 1.4, 0.45, 0.09); }
  };
  const smash = (i, stomp) => {
    const v = cc.velocity, sp = Math.hypot(v.x, v.z);
    const kx = sp > 0.3 ? v.x / sp : 0, kz = sp > 0.3 ? v.z / sp : 0;
    const c = lanterns.smash(i, kx, kz, stomp ? 1.5 : 1);
    G.smashed++;
    candy.spill(c.x, c.y + 0.2, c.z, stomp ? 7 : 4, stomp ? 3.4 : 2.6, 0.3, 14);
    fx.flash(c.x, c.y + 0.3, c.z, stomp ? 5 : 4, 1.4, 0.55, 0.1, 0.4);
    fx.burst(c.x, c.y, c.z, 34, 2.2, 0.9, 0.2, 3.5, 2.5, 0.9, 0.14);
    fx.burst(c.x, c.y, c.z, 14, 1.8, 1.6, 0.6, 2, 3.5, 0.6, 0.08);
    audio.smash(stomp); buzz(stomp ? BUZZ.stomp : BUZZ.smash);
    if (stomp) { v.y = 6.4; hud.callout('STOMP!', ''); }
  };
  const caught = (g) => {
    G.caught++; G.safeT = SAFE_T;
    const lose = Math.min(G.candy, 3 + Math.floor(G.candy * 0.12));
    G.candy -= lose; hud.setCandy(G.candy);
    const p = cc.position, dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz) || 1;
    cc.velocity.set(dx / d * 6.5, 4.6, dz / d * 6.5);
    if (lose > 0) { candy.spill(p.x, p.y + 0.8, p.z, lose, 4.5, 0.9, 7); hud.plusText(`−${lose}`, true); }
    fx.burst(p.x, p.y + 0.8, p.z, 24, 0.8, 0.6, 1.8, 3, 2);
    hud.callout(lose > 0 ? `CAUGHT! −${lose}` : 'CAUGHT!', 'bad');
    audio.caught(); buzz(BUZZ.caught);
  };

  // ---------------------------------------------------------------- systems (registration order = run order)
  engine.addSystem({
    earlyUpdate(dt) {
      input.update(dt);
      const c = input.controls, m = input.map;
      if (m.justPressed('mute')) hud.setMuted(audio.toggleMute());
      if (G.state === 'title' || G.state === 'over') { if (m.justPressed('start') && (G.state === 'title' || G.endT > 1.5)) startRound(); return; }
      if (c.menu) { if (G.state === 'play') setPaused(true); else if (G.state === 'paused') setPaused(false); return; }
      if (G.state !== 'play') { intent.moveX = intent.moveZ = intent.fwd = 0; intent.jump = false; return; }
      if (c.lookX || c.lookY) rig.turn(-c.lookX, -c.lookY);
      rig.getForward(_f); rig.getRight(_r);
      let mx = _r.x * c.moveX + _f.x * c.moveY, mz = _r.z * c.moveX + _f.z * c.moveY;
      const l2 = mx * mx + mz * mz;
      if (l2 > 1) { const k = 1 / Math.sqrt(l2); mx *= k; mz *= k; }
      intent.moveX = mx; intent.moveZ = mz;
      // how much the stick / keys point "into the screen" (1 straight ahead, 0 sideways, < 0 toward the camera)
      const ml = Math.hypot(c.moveX, c.moveY);
      intent.fwd = ml > 0.2 ? c.moveY / ml : 0;
      if (c.jump && !G.skipJump) intent.jump = true;
      G.skipJump = false;
      if (c.interact) doBoo();
    },
  }, 'input');

  engine.addSystem({
    fixedUpdate(dt) {
      prev.copy(cur);
      const playing = G.state === 'play';
      cc.step(dt, playing ? intent.moveX : 0, playing ? intent.moveZ : 0, playing && intent.jump, false, physics);
      intent.jump = false;
      if (cc.jumpedThisStep) { audio.jump(); if (animMode !== 'jump') { animMode = 'jump'; ctl.play('jump'); } }
      if (cc.landedThisStep) {
        if (cc.landingSpeed > 3) { audio.land(cc.landingSpeed); motion.squash = Math.min(0.14, cc.landingSpeed * 0.016); }
        if (animMode === 'jump') { animMode = 'loco'; ctl.play('locomotion'); }
      }
      if (cc.steppedUp) yOff -= cc.position.y - prev.y;
      const p = cc.position;
      if (playing) {
        const li = lanterns.touching(p.x, p.y, p.z, cc.radius);
        if (li >= 0) smash(li, !cc.grounded && cc.velocity.y < -0.5 && p.y > lanterns.y[li] + 0.3);
      }
      cur.copy(p);
      kidInfo.x = p.x; kidInfo.y = p.y; kidInfo.z = p.z; kidInfo.vx = cc.velocity.x; kidInfo.vz = cc.velocity.z; kidInfo.safe = G.safeT > 0;
      ghosts.fixedUpdate(dt, kidInfo, playing);
      if (ghosts.events.caught >= 0 && playing) caught(ghosts.list[ghosts.events.caught]);
      if (ghosts.events.chaseStart >= 0 && playing) {
        if (Math.random() < 0.7) audio.moan();
        if (G.hintBoo) { G.hintBoo = false; hud.callout(touchUI ? 'GHOST! TAP BOO!' : 'GHOST! PRESS E', 'boo'); }
      }
      lanterns.fixedUpdate(dt);
      dyn.step(dt);
      ghosts.capture();
    },
  }, 'sim');

  engine.addSystem({
    update(dt, alpha) {
      // the kid: interpolated pose, facing toward the move intent, animation, blink while safe
      yOff *= Math.exp(-20 * dt);
      player.position.lerpVectors(prev, cur, alpha); player.position.y += yOff;
      if (intent.moveX * intent.moveX + intent.moveZ * intent.moveZ > 0.01) {
        const goal = Math.atan2(-intent.moveX, -intent.moveZ);
        camState.facing = wrapPi(camState.facing + wrapPi(goal - camState.facing) * (1 - Math.exp(-12 * dt)));
      }
      player.rotation.y = camState.facing;
      camState.speed = cc.speed; camState.grounded = cc.grounded;
      // the camera swings in behind the kid only while it runs forward-ish (standing still, a look around stays put).
      // Not while the stick points sideways or back: the move is camera-relative, so swinging toward a sideways /
      // backward facing turns "left" / "back" with the camera and the kid runs in tight circles while the view spins
      // (holding the stick back spun it more than 2 turns in 3 s). There the kid runs across / toward the view instead.
      const fwd = intent.fwd;
      rig.autoRecentre = cc.speed > 1.5 && fwd > 0.3 ? (touchUI ? RECENTRE_TOUCH : RECENTRE_DESK) : 0;
      rig.recentreRate = 1.5 * Math.min(1, fwd * 1.25);
      ctl.setParam('speed', cc.speed); ctl.update(dt);
      view.visible = !(G.safeT > 0 && Math.floor(G.safeT * 12) % 2 === 0);
      // secondary motion (after the clips: the cape / hat-tip bones are never keyed)
      const sp = Math.min(1, cc.speed / 6), air = cc.grounded ? 0 : 1, M = motion;
      M.t += dt;
      const ease = 1 - Math.exp(-7 * dt);
      M.cape += (0.12 + 0.85 * sp + 0.35 * air + (air ? clamp(-cc.velocity.y * 0.06, -0.3, 0.3) : 0) - M.cape) * ease;
      M.hat += (0.12 + 0.35 * sp + 0.2 * air - M.hat) * ease;
      M.lean += (0.12 * sp * (1 - air) - M.lean) * ease;
      M.squash *= Math.exp(-9 * dt);
      kid.cape.rotation.x = M.cape + Math.sin(M.t * 11.3) * 0.07 * sp + Math.sin(M.t * 2.1) * 0.03;
      kid.cape.rotation.z = Math.sin(M.t * 7.7) * 0.05 * sp;
      kid.hatTip.rotation.x = -M.hat + Math.sin(M.t * 9.4) * 0.07 * sp;
      kid.hatTip.rotation.z = Math.sin(M.t * 6.1 + 1) * (0.05 + 0.08 * sp);
      view.rotation.x = -M.lean;
      view.scale.set(1 + M.squash * 0.6, 1 - M.squash, 1 + M.squash * 0.6);
    },
  }, 'player');

  engine.addSystem({
    update(dt) {
      const playing = G.state === 'play';
      G.time += dt;
      const p = cc.position;
      if (playing) {
        G.left -= dt;
        G.booT = Math.min(BOO_CD, G.booT + dt);
        if (G.hintT > 0 && (G.hintT -= dt) <= 0) hud.callout('GRAB THE CANDY!', 'good');
        G.safeT = Math.max(0, G.safeT - dt);
        const prog = 1 - G.left / ROUND;
        ghosts.difficulty = prog; audio.intensity(prog);
        // ghosts rise on schedule
        const elapsed = ROUND - G.left;
        while (G.wakeIdx < WAKE_AT.length && elapsed >= WAKE_AT[G.wakeIdx] * ROUND / 180) { G.wakeIdx++; if (ghosts.wake(p.x, p.z) && G.wakeIdx > 3) hud.callout('A GHOST RISES…', 'bad'); }
        // candy trickles back; big pops now and then
        G.spawnT -= dt;
        if (G.spawnT <= 0) { G.spawnT = 1.2; if (candy.restingCount < CANDY_TARGET) { const i = candy.spawnRandom(p.x, p.z); if (i >= 0) fx.motes(candy.p[i * 3], candy.p[i * 3 + 1], candy.p[i * 3 + 2], 6, 1.2, 0.8, 1.6); } }
        G.popT -= dt;
        if (G.popT <= 0) { G.popT = 20 + Math.random() * 8; if (candy.countKind(CANDY_KIND.POP) < 2 && candy.spawnRandom(p.x, p.z, CANDY_KIND.POP, 16) >= 0) hud.callout('BIG POP SPOTTED!', 'good'); }
        // the clock: warnings and the last ten seconds
        const s = Math.ceil(G.left);
        if (s !== G.lastCount) {
          if (s === 60) { hud.callout('ONE MINUTE TO MIDNIGHT', 'warn'); audio.bell(1); }
          else if (s === 30) { hud.callout('30 SECONDS!', 'warn'); audio.bell(2, 0.8); }
          else if (s <= 10 && s > 0) { hud.countdown(s); audio.tick(s <= 3); }
          G.lastCount = s;
        }
        if (G.left <= 0) { G.left = 0; endRound(); }
      } else if (G.state === 'ending') {
        G.endT += dt;
        if (G.endT > 3.4) showResults();
      } else if (G.state === 'over') G.endT += dt;
      // candy pickups only during the round (after midnight, candy spilled next to the kid must not vanish into it
      // uncounted); the candy still animates on every screen
      candy.update(dt, playing ? cc.position : OFFSTAGE, G.time, playing ? onPick : null);
      if (playing && candy.valueThisFrame > 0) {
        G.candy += candy.valueThisFrame; hud.setCandy(G.candy);
        if (candy.popThisFrame === 0) hud.plusText(`+${candy.valueThisFrame}`);
      }
    },
  }, 'game');

  engine.addSystem({ update: (dt) => { if (rigOn) rigOn.update(dt); } }, 'camera');

  const _pm = new THREE.Matrix4(), _frustum = new THREE.Frustum(), _dir = new THREE.Vector3();
  const lightView = { position: camera.position, frustum: _frustum, direction: _dir };
  const WISPS = 14;
  engine.addSystem({
    lateUpdate(dt) {
      camera.updateMatrixWorld();
      atmo.update(camera.position, dt);
      LOOK.update(dt, camera, atmo.moonDir);
      world.update(camera, atmo.moonDir);
      _frustum.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      camera.getWorldDirection(_dir);
      const t = G.time;
      lanterns.update(dt, lightView, t, (i) => { fx.motes(lanterns.x[i], lanterns.y[i] + 0.3, lanterns.z[i], 10, 2, 1, 0.3); });
      let n = lanterns.glow(glows, 0, t);
      n += candy.glow(glows, n, t, camera.position);
      n += ghosts.update(dt, engine.alpha, glows, n, camera.position);
      for (let k = 0; k < WISPS; k++) { // will-o'-wisps drifting over the graveyard
        const a = t * (0.13 + k * 0.011) + k * 2.4;
        const x = 27 + Math.sin(a) * 15 + Math.sin(a * 2.3 + k) * 3, z = -28 + Math.cos(a * 0.8 + k) * 14;
        const y = heightAt(x, z) + 1.1 + Math.sin(t * 1.7 + k) * 0.5, f = 0.75 + 0.25 * Math.sin(t * 5 + k * 3);
        glows.set(n++, x, y, z, 0.7, 0.25 * f, 0.9 * f, 0.4 * f);
      }
      n += fx.glow(glows, n);
      const GS = world.glowSpots;
      for (let k = 0; k < GS.length; k++) { // halos over the static glowing props (gate lanterns, windows, crypt, cauldron)
        const q = GS[k], f = 1 - q[7] * (0.12 + 0.1 * Math.sin(t * 9.3 + k * 2.1) + 0.06 * Math.sin(t * 23.1 + k));
        glows.set(n++, q[0], q[1], q[2], q[3], q[4] * f, q[5] * f, q[6] * f);
      }
      glows.commit(n);
      bats.update(dt);
      fx.update(dt);
    },
  }, 'world');

  let hudT = 0;
  engine.addSystem({
    lateUpdate(dt) {
      if (G.state === 'play' || G.state === 'ending') {
        hudT -= dt;
        if (hudT <= 0) { hudT = 0.1; hud.setClock(G.left, ROUND); }
        hud.setBoo(G.booT / BOO_CD);
        if (input.touch) input.touch.setProgress('boo', G.booT / BOO_CD);
        const d = ghosts.nearestChaser(cc.position.x, cc.position.z);
        hud.setDanger(G.state === 'play' ? clamp((7 - d) / 5, 0, 1) * 0.9 : 0);
      }
    },
  }, 'hud');
  engine.addSystem({ lateUpdate: (dt) => audio.update(dt, G.state === 'play') }, 'audio');

  // ---------------------------------------------------------------- go
  toTitle();
  hud.setMusicLabel(true);
  renderer.compile(scene, camera);
  // warm-up: draw once every mesh that is hidden or off-screen at the start (each ghost's sheet and face texture, the
  // pumpkin shards, the BOO rings), so their geometry and textures upload now instead of in a frame mid-round (a
  // hitch on a phone, and the first sight of a ghost no longer adds GPU resources during play)
  {
    const warm = [fx.ring, fx.ring2, fx.dome];
    for (const g of ghosts.list) warm.push(g.mesh.mesh);
    for (const sl of lanterns.slots) warm.push(...sl.meshes);
    const was = warm.map((o) => [o.visible, o.frustumCulled]);
    for (const o of warm) { o.visible = true; o.frustumCulled = false; }
    renderer.render(scene, camera);
    warm.forEach((o, i) => { o.visible = was[i][0]; o.frustumCulled = was[i][1]; });
  }
  const loadMs = Math.round(performance.now() - t0);
  window.__game = {
    THREE, engine, G, cc, ctl, camState, rig, orbit, input, hud, audio, world, dyn, lanterns, ghosts, candy, fx, postfx, atmo, physics, player,
    loadMs, TOUCH, LOW, startRound, toTitle, setPaused, endRound,
    get touchUI() { return touchUI; },
    /** Test hook: jump the clock (seconds left). */
    setTimeLeft(s) { G.left = s; },
  };
  console.info(`[halloween] ready in ${loadMs} ms · touch ${TOUCH} · quality ${LOW ? 'low' : 'high'} · ${lanterns.n} lanterns · ${ghosts.list.length} ghosts · ${physics.staticBoxes.length} colliders · pr ${engine.pixelRatio}`);
  engine.start();
  loading.hide(450);
}

/** No page scroll / pinch / double-tap zoom / long-press menus on phones (the CSS does most of it; iOS needs these). */
function installPhoneGuards() {
  const prevent = (e) => e.preventDefault();
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  document.addEventListener('dblclick', prevent, { passive: false });
  document.addEventListener('contextmenu', prevent);
  document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => { const now = performance.now(); if (now - lastTouch < 300 && e.cancelable && !e.target.closest('button')) e.preventDefault(); lastTouch = now; }, { passive: false });
}

boot().catch((err) => {
  console.error(err);
  const l = document.querySelector('.ui-loading small');
  if (l) l.textContent = `Failed to start: ${err.message}`;
});
