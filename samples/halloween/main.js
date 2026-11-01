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
// Desktop: START / RESUME / PLAY AGAIN (and Enter / Space) capture the mouse (pointer lock), so plain movement looks;
// Esc frees it (and pauses); a refused lock falls back to click-the-view / right-drag; the arrow keys turn.
// Thumbs: the stick has a dead zone and reaches full speed at 3/4 deflection; BOO / JUMP have a forgiving hit ring;
// BOO glows while a chaser is in reach. Catches cost 10 % (2..12) and spill it back as candy to grab again; after a
// catch the pack backs off, and on phones at most two ghosts chase at once. Until a player's first BOO lands (kept in
// localStorage), the first ghost is a lesson: it rises in view ahead, drifts in slowly and cannot catch for 12 s.
// Edge markers point at an off-screen big pop and at ghosts coming from off screen or from behind.
// Score chasing: ranks (hud.js RANKS) with the next one's threshold on the candy pill and a call-out on reaching one,
// the pace against the best run (kept in localStorage) every 20 s, "NEW BEST!" when the run passes it. A streak of
// quick pickups fills a meter; every 10th pickup of one adds a bonus. The Witching Hour (the last 30 s) counts candy
// double, relights every lantern, rains candy around the kid and caps a catch at 6. Juice: a small camera shake on
// smashes and catches, an FOV punch on BOO, a hitstop on smash / BOO / catch (gentler on phones; no motion with
// prefers-reduced-motion). The results share the score (Web Share on phones, else the clipboard).
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
import { HUD, ACCENT, applyTheme, RANKS, rankIndex, rankFor, nextRankAt } from './hud.js';
import { LOOK } from './looks.js';

const params = new URLSearchParams(location.search);
const flag = (k) => params.has(k) && params.get(k) !== '0';
const FORCED = params.has('touch') ? flag('touch') : null; // ?touch=1 / ?touch=0 pin the touch UI on / off
const TOUCH = FORCED ?? isTouchDevice({ multiTouch: true });  // at load; later touches / keys can switch (touchUI)
const LOW = params.has('quality') ? params.get('quality') === 'low' : TOUCH;
const NOFX = flag('nofx');
const SHADOWS = !(params.has('shadows') && params.get('shadows') === '0');
const ROUND = Math.max(10, +params.get('round') || 180);
const BEST_KEY = 'midnight-candy-run.best', TAUGHT_KEY = 'midnight-candy-run.taught', PACE_KEY = 'midnight-candy-run.pace';
const SPAWN = [0, 6];
const BOO_CD = 5, BOO_R = 7.5, SAFE_T = 3.0;
const RECENTRE_TOUCH = 0.7, RECENTRE_DESK = 0.8; // s without look input before the camera eases behind a running kid
// touch stick response: nothing below STICK_DEAD (a resting thumb's wobble), full speed at STICK_FULL deflection
const STICK_DEAD = 0.12, STICK_FULL = 0.75;
// a catch costs 10 % of the candy (2..12); 3 catches within MERCY_WINDOW s calm the ghosts (difficulty -MERCY) for MERCY_T s
const CATCH_SHARE = 0.10, CATCH_MIN = 2, CATCH_MAX = 12, MERCY = 0.35, MERCY_WINDOW = 30, MERCY_T = 20;
const MAX_CHASERS_TOUCH = 2, MAX_CHASERS_DESK = 3;
const MAGNET_TOUCH = 3.2, MAGNET_DESK = 2.4; // candy pull radius (m)
// candy where the player looks: while the view is "dry" (fewer than DRY_NEED candies on screen within DRY_R m),
// AHEAD_SHARE of the respawns land in a ring ahead of the camera (inside the view: at most ±50°, less in portrait, with
// a clear straight run to it); after DRY_T s of a dry view, a far resting candy (off screen, > FAR m away) moves into
// the nearer DRY_RING every respawn tick (a narrow portrait view used to show no candy at all for two thirds of a
// round). A view with candy in it keeps the uniform respawns: good players get no extra help. Big pops rise POP_R m
// away (inside the view while it is dry).
const AHEAD_SHARE = 0.6, AHEAD_R = [9, 22], AHEAD_HALF = 50 * Math.PI / 180, POP_R = [14, 26];
const DRY_R = 15, DRY_NEED = 2, DRY_T = 3, FAR = 30, DRY_RING = [8, 15];
// the first desktop round shows how the mouse looks for LOOK_HINT_T s or until LOOK_HINT_RAD of look input
const LOOK_HINT_T = 4, LOOK_HINT_RAD = 0.3;
// haptic pulses (ms); a candy streak buzzes at most every CANDY_BUZZ_GAP s
const BUZZ = { candy: 8, pop: 30, smash: 35, stomp: [30, 40, 50], boo: 22, caught: [70, 50, 90] }, CANDY_BUZZ_GAP = 0.09;
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const CANDY_TARGET = LOW ? 55 : 65;
const GHOSTS = LOW ? 5 : 6;
// round seconds (of 180) at which the next ghost rises: one early (it teaches BOO), then one about every 30 s
const WAKE_AT = [5, 24, 50, 80, 110, 140];
// the BOO lesson (until the first BOO that scares a ghost): the first ghost rises TUTOR_R m ahead, tame for TUTOR_T s
const TUTOR_R = [9, 11], TUTOR_T = 12, LANTERN_HINT = { until: 20, r: 6 };
// the best run's candy at PACE_N even moments of the round (every 10 s of 3 minutes); every PACE_SHOW-th of them the
// HUD says how the run compares ("+12 VS BEST")
const PACE_N = 18, PACE_SHOW = 2;
// Witching Hour, the finale: the last WITCH_S s (of 180; scaled with ?round=) candy counts WITCH_MULT times, every
// smashed lantern relights, WITCH_RAIN candies rain over WITCH_RAIN_T s into a ring WITCH_RAIN_R m around the kid
// (WITCH_VIEW of them inside the view), a catch costs at most WITCH_CATCH (and spills that much back in value)
const WITCH_S = 30, WITCH_MULT = 2, WITCH_RAIN = 20, WITCH_RAIN_T = 10, WITCH_RAIN_R = [6, 14], WITCH_VIEW = 0.65, WITCH_CATCH = 6;
// a streak: pickups less than STREAK_GAP s apart; every STREAK_EVERY-th pickup of one adds STREAK_BONUS candy (the pips
// under the candy pill show from STREAK_SHOW)
const STREAK_GAP = 0.9, STREAK_EVERY = 10, STREAK_BONUS = 3, STREAK_SHOW = 5;
// juice: camera shake [m, s, roll rad] (phones get SHAKE_TOUCH of it; none with reduced motion), BOO's FOV punch (deg
// over s), hitstop (s of game time at HITSTOP_SCALE)
const SHAKE = { smash: [0.05, 0.12, 0], stomp: [0.1, 0.18, 0], catch: [0.18, 0.3, 4 * Math.PI / 180] }, SHAKE_TOUCH = 0.6;
const FOV_PUNCH = -5, FOV_PUNCH_T = 0.3, HITSTOP_SCALE = 0.15;
const HITSTOP = { smash: 0.035, stomp: 0.07, boo: 0.05, boo3: 0.08, catch: 0.09 };
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
// The arrow keys turn the camera (left / right) instead of strafing; up / down still run, so up + left curves like a car.
const ACTIONS = {
  ...CHARACTER_ACTIONS,
  moveX: { ...CHARACTER_ACTIONS.moveX, bindings: CHARACTER_ACTIONS.moveX.bindings.filter((b) => !(b.key === 'ArrowLeft' || b.key === 'ArrowRight')) },
  lookX: { ...CHARACTER_ACTIONS.lookX, bindings: [...CHARACTER_ACTIONS.lookX.bindings, { key: 'ArrowLeft', value: -1 }, { key: 'ArrowRight', value: 1 }] },
  interact: { type: 'button', bindings: ['KeyE', 'KeyF', 'KeyB', 'KeyQ', { padButton: PB.X }, { padButton: PB.B }, { virtual: 'boo' }] },
  menu: { type: 'button', alwaysOn: true, bindings: ['Escape', 'KeyP', { padButton: PB.START }] },
  start: { type: 'button', alwaysOn: true, bindings: ['Enter', 'NumpadEnter', 'Space', { padButton: PB.A }] },
  mute: { type: 'button', alwaysOn: true, bindings: ['KeyM', { padButton: PB.BACK }] },
};
// touch: floating move stick (left part of the screen), drag-to-look pad (right; a drag counts after 8 px, so a tap
// that slides does not turn the view), JUMP + BOO by the right thumb, each with a 16 px forgiving hit ring.
// Portrait overrides keep the buttons stacked inside a narrow screen's thumb reach, BOO (the key action) lowest, where
// the thumb rests.
const TOUCH_LAYOUT = [
  { type: 'touchpad', id: 'look', side: 'right', width: 0.56, top: 70, bottom: 0, slop: 8, portrait: { width: 0.5, top: 120 } },
  { type: 'stick', id: 'stick', side: 'left', x: 112, y: 112, radius: 60, floating: true, zone: { width: 0.44, top: 70 },
    portrait: { x: 96, y: 150, radius: 58, zone: { width: 0.5, top: 170 } } },
  { type: 'button', id: 'jump', label: 'JUMP', side: 'right', x: 84, y: 92, size: 98, fontSize: 15, hitSlop: 16, portrait: { x: 84, y: 250, size: 80 } },
  { type: 'button', id: 'boo', label: 'BOO!', side: 'right', x: 200, y: 66, size: 82, fontSize: 16, hitSlop: 16, portrait: { x: 76, y: 128, size: 96 } },
];

function loadBest() { try { return Math.max(0, parseInt(localStorage.getItem(BEST_KEY), 10) || 0); } catch { return 0; } }
function saveBest(n) { try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* private mode / blocked storage */ } }
function loadTaught() { try { return localStorage.getItem(TAUGHT_KEY) === '1'; } catch { return false; } }
function saveTaught() { try { localStorage.setItem(TAUGHT_KEY, '1'); } catch { /* private mode / blocked storage */ } }
function loadPace() {
  try { const a = JSON.parse(localStorage.getItem(PACE_KEY)); return Array.isArray(a) && a.length === PACE_N && a.every((v) => Number.isFinite(v)) ? a : null; } catch { return null; }
}
function savePace(a) { try { localStorage.setItem(PACE_KEY, JSON.stringify(a)); } catch { /* private mode / blocked storage */ } }
/** Copy text the old way (a hidden textarea + execCommand), for when the async clipboard is missing or refused. */
function copyText(text) {
  try {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return !!ok;
  } catch { return false; }
}

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
    catch1: -99, catch2: -99, mercyT: 0, lookHintT: 0, lookHintRad: 0, dryT: 0,
    witching: false, rainLeft: 0, rainT: 0, streakMax: 0, streakBonus: 0, bonusFrame: 0, rankMax: 0, passedBest: false,
    paceK: 0,
  };
  let pace = loadPace(); // the best run's candy at the PACE_N moments (null: no best run recorded yet)
  const paceRec = new Array(PACE_N).fill(0);
  let booedEver = loadTaught(), lookHinted = false, smashedEver = false;
  // START / RESUME / PLAY AGAIN run inside the click (a user gesture): the same call captures the mouse on desktop
  const hud = new HUD({
    touch: TOUCH, streak: STREAK_EVERY,
    onShare: () => shareScore(),
    onStart: () => { startRound(); captureMouse(); },
    onPause: () => setPaused(true),
    onResume: () => { setPaused(false); captureMouse(); },
    onRestart: () => { startRound(); captureMouse(); },
    onTitle: () => toTitle(),
    onMute: () => { hud.setMuted(audio.toggleMute()); },
    onMusic: () => { G.music = !G.music; audio.setMusic(G.music); hud.setMusicLabel(G.music); },
  });
  const canvas = renderer.domElement;
  let touchUI = TOUCH; // the touch presentation is on (controls, HUD texts, camera recentre, haptics)
  let booBtn = null, stickCtl = null, booHot = false;
  const setTouchUI = (on) => {
    touchUI = on;
    hud.setTouch(on);
    if (on && input.touch) { booBtn = input.touch.get('boo'); stickCtl = input.touch.get('stick'); if (booBtn) booBtn.el.classList.add('hw-boo-btn'); }
    // phones: a wider candy pull, and fewer ghosts on the kid at once (the thumbs are busier than a mouse hand)
    ghosts.maxChasers = on ? MAX_CHASERS_TOUCH : MAX_CHASERS_DESK;
    candy.magnet = on ? MAGNET_TOUCH : MAGNET_DESK;
  };
  const input = new CharacterInput({
    element: canvas, actions: ACTIONS, touch: TOUCH, touchLayout: TOUCH_LAYOUT, touchOptions: { safeArea: true }, touchSpeed: 0.0055, holdButton: 2, stickSpeed: 2.4,
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
  // desktop: capture the mouse (call inside a click / key gesture) so plain movement looks around. The look hint shows
  // in the first round (what the mouse does now) and again whenever a capture is refused (iframes, a re-lock within ~1 s
  // of Esc): then clicking the view, the right button or the arrow keys look
  const lookHint = (ok) => {
    if (G.state !== 'play') return;
    if (ok && lookHinted) { if (G.lookHintT > 0) { G.lookHintT = 0; hud.lookHint(null); } return; } // captured: no hint needed
    lookHinted = true; G.lookHintT = LOOK_HINT_T; G.lookHintRad = LOOK_HINT_RAD; hud.lookHint(ok);
  };
  const captureMouse = () => {
    if (touchUI || lock.locked) return;
    if (!lock.supported) { lookHint(false); return; }
    lock.request().then(lookHint);
  };
  canvas.addEventListener('click', () => { if (!touchUI && G.state === 'play') captureMouse(); });

  // portrait phones: a wider view, the camera higher, further back and pitched down more (more ground ahead, less of
  // the sky behind the HUD: a narrow portrait view used to show no candy at all for most of a round)
  const PITCH = { landscape: -0.3, portrait: -0.42 };
  let portraitCam = null, baseFov = camera.fov; // baseFov: the view's FOV before BOO's punch
  const fitCamera = (w, h) => {
    const portrait = h > w;
    camera.fov = baseFov = portrait ? 74 : 58; camera.updateProjectionMatrix();
    rig.distance = portrait ? 7.0 : 5.4; rig.height = portrait ? 1.6 : 1.2;
    if (portraitCam !== null && portraitCam !== portrait) rig.pitch += portrait ? PITCH.portrait - PITCH.landscape : PITCH.landscape - PITCH.portrait;
    portraitCam = portrait;
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
  let viewW = engine.size.width, viewH = engine.size.height; // CSS px (the HUD's edge markers; no layout read per frame)
  engine.onResize = (w, h, pr) => { viewW = w; viewH = h; fitCamera(w, h); if (postfx) postfx.setSize(w, h, pr); };
  fitCamera(viewW, viewH);
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
    Object.assign(G, { state: 'play', time: 0, left: ROUND, candy: 0, smashed: 0, booed: 0, caught: 0, pops: 0, booT: BOO_CD, safeT: 0, streak: 0, lastPick: -9, wakeIdx: 0, spawnT: 0, popT: 12, endT: 0, lastCount: 99, pickups: 0, catch1: -99, catch2: -99, mercyT: 0, lookHintT: 0, dryT: 0,
      witching: false, rainLeft: 0, rainT: 0, streakMax: 0, streakBonus: 0, bonusFrame: 0, rankMax: 0, passedBest: false, paceK: 0 });
    paceRec.fill(0);
    if (engine.clock.paused) engine.clock.resume();
    endJuice();
    lanterns.reset(); ghosts.reset(); fx.clear(); fillCandy(); placeKid();
    hud.setCandy(0, false); hud.setGoal(nextRankAt(0)); hud.setClock(ROUND, ROUND); hud.showPlay(); hud.setDanger(0);
    input.map.enabled = true;
    rig.yaw = 0; rig.pitch = portraitCam ? PITCH.portrait : PITCH.landscape; setRig(rig); rig.recentre();
    G.skipJump = true;
    G.hintBoo = !booedEver; G.hintT = 0.6; buzzT = -1; // "GRAB THE CANDY!" just after the start; the BOO hint until a first BOO hits
    G.tutor = !booedEver; G.tutorWake = null; G.lanternHint = !smashedEver; G.lanternHintT = 0; G.hintBooT = 0;
  }
  function toTitle() {
    if (lock.locked) lock.exit();
    if (engine.clock.paused) setClockPaused(false);
    holdAudio(false);
    G.state = 'title'; endJuice();
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
    endJuice();
    // the best is saved right at midnight (closing the tab during the bells must not lose it), with its pace
    for (let k = G.paceK; k < PACE_N; k++) paceRec[k] = G.candy;
    G.newBest = G.candy > G.best;
    if (G.newBest) { G.best = G.candy; saveBest(G.best); pace = paceRec.slice(); savePace(pace); }
    audio.bell(12, 0.5, 174); hud.flash(); hud.callout('MIDNIGHT!', 'warn');
    input.touch && input.touch.releaseAll();
    if (lock.locked) lock.exit();
    while (ghosts.awake < ghosts.list.length) if (!ghosts.wake(cc.position.x, cc.position.z)) break;
  }
  function showResults() {
    G.state = 'over';
    hud.showResults({ candy: G.candy, best: G.best, isBest: G.newBest, smashed: G.smashed, booed: G.booed, caught: G.caught, streak: G.streakMax });
    orbitTarget.position.copy(cc.position); orbit.distance = 12; orbit.elevation = 0.35; orbit.azimuth = rig.yaw + Math.PI;
    setRig(orbit);
  }
  // backgrounding: a round pauses (and stays paused on return); on every screen the audio is suspended while hidden
  // (the wind and the organ pad are continuous voices) and resumes on return unless the game sits paused
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.state === 'play') setPaused(true); holdAudio(true); }
    else if (G.state !== 'paused') holdAudio(false);
  });

  // ---------------------------------------------------------------- juice: camera shake, BOO's FOV punch, hitstop
  // The shake and the punch run on real time (they play through a hitstop) and are added after the rig placed the
  // camera; phones get SHAKE_TOUCH of the amplitude, and none of it moves with prefers-reduced-motion. A hitstop slows
  // the game clock (engine.clock.timeScale) for a few hundredths of a second of real time: a freeze, not a motion.
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const juice = { t: 1, dur: 1, amp: 0, roll: 0, seed: 0, pt: 1, pdur: 1, deg: 0, fov: false, stopUntil: 0, real: 0, shakes: 0, punches: 0, stops: 0 };
  const _cr = new THREE.Vector3(), _cu = new THREE.Vector3(), _qr = new THREE.Quaternion(), _zAxis = new THREE.Vector3(0, 0, 1);
  const calmMotion = () => !!(reducedMotion && reducedMotion.matches);
  /** A camera jolt [amp m, dur s, roll rad]; a stronger one still running is not cut short by a weaker one. */
  const jolt = (spec) => {
    if (calmMotion()) return;
    const k = touchUI ? SHAKE_TOUCH : 1, amp = spec[0] * k;
    if (juice.t < juice.dur && amp < juice.amp * (1 - juice.t / juice.dur)) return;
    juice.t = 0; juice.dur = spec[1]; juice.amp = amp; juice.roll = spec[2] * k; juice.seed = Math.random() * 50; juice.shakes++;
  };
  const fovPunch = () => { if (calmMotion()) return; juice.pt = 0; juice.pdur = FOV_PUNCH_T; juice.deg = FOV_PUNCH * (touchUI ? SHAKE_TOUCH : 1); juice.punches++; };
  const hitstop = (sec) => {
    const c = engine.clock;
    juice.stopUntil = Math.max(juice.stopUntil, c.unscaledTime + sec); c.timeScale = HITSTOP_SCALE; juice.stops++;
  };
  /** Every effect off at once (round start / end): full speed, no offset, the plain FOV. */
  const endJuice = () => {
    juice.t = juice.dur; juice.pt = juice.pdur; juice.stopUntil = 0; engine.clock.timeScale = 1;
    if (juice.fov) { juice.fov = false; camera.fov = baseFov; camera.updateProjectionMatrix(); }
  };
  /** After the rig: the shake offset / roll and the FOV punch on the camera (real-time dt). */
  const applyJuice = () => {
    const now = engine.clock.unscaledTime, rdt = Math.min(0.1, Math.max(0, now - juice.real)); juice.real = now;
    if (juice.t < juice.dur) {
      juice.t += rdt;
      const u = Math.min(1, juice.t / juice.dur), env = (1 - u) * (1 - u), a = juice.amp * env, w = juice.seed + juice.t;
      const q = camera.quaternion;
      _cr.set(1, 0, 0).applyQuaternion(q); _cu.set(0, 1, 0).applyQuaternion(q);
      camera.position.addScaledVector(_cr, a * Math.sin(w * 71)).addScaledVector(_cu, a * 0.8 * Math.sin(w * 53 + 1.3));
      if (juice.roll) q.multiply(_qr.setFromAxisAngle(_zAxis, juice.roll * env * Math.sin(w * 37 + 0.4)));
    }
    if (juice.pt < juice.pdur) {
      juice.pt += rdt;
      const u = Math.min(1, juice.pt / juice.pdur), c = u < 0.18 ? u / 0.18 : (1 - (u - 0.18) / 0.82) ** 2;
      camera.fov = baseFov + juice.deg * c; camera.updateProjectionMatrix(); juice.fov = true;
    } else if (juice.fov) { juice.fov = false; camera.fov = baseFov; camera.updateProjectionMatrix(); }
  };

  // ---------------------------------------------------------------- gameplay helpers
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _v = new THREE.Vector3();
  const kidInfo = { x: 0, y: 0, z: 0, vx: 0, vz: 0, safe: false };
  const OFFSTAGE = { x: 1e6, y: 0, z: 1e6 }; // the magnet's "kid" while no round runs
  const doBoo = () => {
    if (G.booT < BOO_CD) { audio.tick(); return; }
    G.booT = 0;
    const p = cc.position;
    fx.boo(p.x, p.y, p.z, BOO_R); audio.boo(); buzz(BUZZ.boo); fovPunch();
    const scared = ghosts.boo(p.x, p.z, BOO_R);
    if (scared.length) {
      G.booed += scared.length; audio.scared(scared.length); G.hintBoo = false;
      hitstop(scared.length >= 3 ? HITSTOP.boo3 : HITSTOP.boo);
      if (!booedEver) { booedEver = true; saveTaught(); } // the lesson is learnt: from now on the normal ghost schedule
      for (const g of scared) { candy.spill(g.x, g.y - 0.3, g.z, 2, 2.5, 0.25, 10); fx.burst(g.x, g.y, g.z, 18, 0.7, 0.6, 1.6, 3, 1.5); fx.flash(g.x, g.y, g.z, 3.4, 0.35, 0.55, 1.1, 0.4); }
      hud.callout(scared.length > 1 ? `BOO! ×${scared.length}` : 'BOO!', 'boo');
    } else hud.callout('BOO!', 'boo');
  };
  // a pickup: the streak (pickups under STREAK_GAP s apart; every STREAK_EVERY-th one adds a bonus: a call-out and a
  // golden burst from the pail), the chime rising with it, haptics, a pop's call-out
  const onPick = (i, kind, x, y, z) => {
    const t = G.time, mult = G.witching ? WITCH_MULT : 1;
    G.streak = t - G.lastPick < STREAK_GAP ? G.streak + 1 : 1; G.lastPick = t;
    if (G.streak > G.streakMax) G.streakMax = G.streak;
    G.pickups++;
    if (t - buzzT > CANDY_BUZZ_GAP) { buzzT = t; buzz(kind === CANDY_KIND.POP ? BUZZ.pop : BUZZ.candy); }
    if (kind === CANDY_KIND.POP) { G.pops++; audio.candy(0, true); fx.flash(x, y + 0.8, z, 5, 1.2, 0.35, 0.9, 0.5); fx.burst(x, y + 0.6, z, 40, 1.6, 0.5, 1.4, 4, 2.5, 1); hud.callout(`+${5 * mult} BIG POP!`, 'good'); }
    else { audio.candy(G.streak - 1); fx.burst(x, y, z, 8, 1.4, 1.0, 0.5, 1.6, 1.4, 0.45, 0.09); }
    if (G.streak % STREAK_EVERY === 0) {
      const b = STREAK_BONUS * mult, p = cc.position;
      G.bonusFrame += b; G.streakBonus += b;
      hud.callout('SWEET STREAK!', 'good', `+${b} BONUS`); audio.streak();
      fx.burst(p.x, p.y + 0.8, p.z, 30, 2.4, 1.6, 0.35, 2.6, 3, 0.8, 0.1); fx.flash(p.x, p.y + 0.9, p.z, 3.2, 0.9, 0.6, 0.15, 0.4);
    }
  };
  // the HUD's goal (the next rank's threshold) and a call-out on reaching a new rank / passing the best (once a round)
  const candyChanged = () => {
    hud.setCandy(G.candy); hud.setGoal(nextRankAt(G.candy));
    const ri = rankIndex(G.candy), up = ri > G.rankMax;
    if (up) G.rankMax = ri;
    if (!G.passedBest && G.best >= 20 && G.candy > G.best) { G.passedBest = true; hud.callout('NEW BEST!', 'rank', up ? RANKS[ri][1].toUpperCase() : ''); audio.rankUp(); }
    else if (up) { hud.callout(`${RANKS[ri][1].toUpperCase()}!`, 'rank', 'NEW RANK'); audio.rankUp(); }
  };
  const smash = (i, stomp) => {
    const v = cc.velocity, sp = Math.hypot(v.x, v.z);
    const kx = sp > 0.3 ? v.x / sp : 0, kz = sp > 0.3 ? v.z / sp : 0;
    const c = lanterns.smash(i, kx, kz, stomp ? 1.5 : 1);
    G.smashed++; smashedEver = true; G.lanternHint = false;
    candy.spill(c.x, c.y + 0.2, c.z, stomp ? 7 : 4, stomp ? 3.4 : 2.6, 0.3, 14);
    fx.flash(c.x, c.y + 0.3, c.z, stomp ? 5 : 4, 1.4, 0.55, 0.1, 0.4);
    fx.burst(c.x, c.y, c.z, 34, 2.2, 0.9, 0.2, 3.5, 2.5, 0.9, 0.14);
    fx.burst(c.x, c.y, c.z, 14, 1.8, 1.6, 0.6, 2, 3.5, 0.6, 0.08);
    audio.smash(stomp); buzz(stomp ? BUZZ.stomp : BUZZ.smash);
    jolt(stomp ? SHAKE.stomp : SHAKE.smash); hitstop(stomp ? HITSTOP.stomp : HITSTOP.smash);
    if (stomp) { v.y = 6.4; hud.callout('STOMP!', ''); }
  };
  // a catch costs 10 % (2..12; in the Witching Hour at most WITCH_CATCH): it used to be 3 + 12 % uncapped (-36 at
  // 0:10). The loss spills around the kid, quick to grab back (collectable after 0.45 s, gone after 10 s; in the
  // Witching Hour each candy counts double, so half as many spill); three catches within 30 s calm the ghosts a while
  const caught = (g) => {
    G.caught++; G.safeT = SAFE_T;
    const lose = Math.min(G.candy, clamp(Math.round(G.candy * CATCH_SHARE), CATCH_MIN, G.witching ? WITCH_CATCH : CATCH_MAX));
    G.candy -= lose; candyChanged();
    const p = cc.position, dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz) || 1;
    cc.velocity.set(dx / d * 6.5, 4.6, dz / d * 6.5);
    jolt(SHAKE.catch); hitstop(HITSTOP.catch);
    if (lose > 0) { candy.spill(p.x, p.y + 0.8, p.z, G.witching ? Math.ceil(lose / WITCH_MULT) : lose, 4.5, 0.45, 10); hud.plusText(`−${lose}`, true); }
    fx.burst(p.x, p.y + 0.8, p.z, 24, 0.8, 0.6, 1.8, 3, 2);
    if (lose > 0) hud.callout(`CAUGHT! −${lose}`, 'bad', 'GRAB IT BACK!'); else hud.callout('CAUGHT!', 'bad');
    audio.caught(); buzz(BUZZ.caught);
    if (G.time - G.catch2 < MERCY_WINDOW) G.mercyT = MERCY_T;
    G.catch2 = G.catch1; G.catch1 = G.time;
  };
  // a free spot for a candy in a ring around (px, pz): r in [r0, r1], within ±half of the bearing `yaw` (rig yaw
  // convention: forward = (-sin, -cos)); inside the fence, clear of colliders. Fills out [x, y, z]; false when none.
  // clear: also no collider on the straight run from the kid to it (no fence or grave between: it can be run to)
  const _cols = [], _spot = [0, 0, 0];
  const blocked = (x, z, r) => { _cols.length = 0; return physics.queryColliders(x, z, r, _cols).length > 0; };
  const ringSpot = (out, px, pz, r0, r1, yaw, half, clear = false) => {
    for (let t = 0; t < 12; t++) {
      const a = yaw + (Math.random() * 2 - 1) * half, r = r0 + Math.random() * (r1 - r0), sx = -Math.sin(a), sz = -Math.cos(a);
      const x = px + sx * r, z = pz + sz * r;
      if (Math.abs(x) > PLAY - 2 || Math.abs(z) > PLAY - 2 || blocked(x, z, 0.6)) continue;
      let ok = true;
      if (clear) for (let k = 1.5; k < r - 0.5 && ok; k += 1) ok = !blocked(px + sx * k, pz + sz * k, 0.35);
      if (!ok) continue;
      out[0] = x; out[1] = heightAt(x, z); out[2] = z;
      return true;
    }
    return false;
  };
  // the half-angle of the view a candy should land in: the horizontal half-FOV less a margin, at most AHEAD_HALF
  const viewHalf = () => Math.min(AHEAD_HALF, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) - 0.1);
  const randomKind = () => (Math.random() < 0.35 ? CANDY_KIND.CORN : CANDY_KIND.WRAP);
  /** Respawn one resting candy: while the view is dry, AHEAD_SHARE of them ahead of the camera; else anywhere. */
  const respawnCandy = (p, dry) => {
    if (dry && Math.random() < AHEAD_SHARE && ringSpot(_spot, p.x, p.z, AHEAD_R[0], AHEAD_R[1], rig.yaw, viewHalf(), true)) return candy.place(_spot[0], _spot[1], _spot[2], randomKind());
    return candy.spawnRandom(p.x, p.z);
  };
  // is (x, y, z) on screen (last frame's camera)? margin: NDC limit
  const onScreen = (x, y, z, margin = 0.95) => {
    _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    if (_v.z > -0.3) return false;
    _v.applyMatrix4(camera.projectionMatrix);
    return Math.abs(_v.x) < margin && Math.abs(_v.y) < margin;
  };
  /** At least `need` resting candies on screen within r m of the kid. */
  const candyInView = (p, r, need) => {
    const C = candy, P = C.p;
    let n = 0;
    for (let i = 0; i < C.state.length; i++) {
      if (C.state[i] !== 1) continue;
      const dx = P[i * 3] - p.x, dz = P[i * 3 + 2] - p.z;
      if (dx * dx + dz * dz < r * r && onScreen(P[i * 3], P[i * 3 + 1] + 0.3, P[i * 3 + 2]) && ++n >= need) return true;
    }
    return false;
  };
  /** A dry spell: the farthest off-screen resting candy (> FAR m away) moves into the ring ahead. Returns its slot or -1. */
  const relocateFar = (p) => {
    const C = candy, P = C.p;
    let best = -1, bd = FAR * FAR;
    for (let i = 0; i < C.state.length; i++) {
      if (C.state[i] !== 1 || C.kind[i] === CANDY_KIND.POP) continue;
      const dx = P[i * 3] - p.x, dz = P[i * 3 + 2] - p.z, d2 = dx * dx + dz * dz;
      if (d2 > bd && !onScreen(P[i * 3], P[i * 3 + 1] + 0.3, P[i * 3 + 2], 1.1)) { bd = d2; best = i; }
    }
    if (best < 0 || !ringSpot(_spot, p.x, p.z, DRY_RING[0], DRY_RING[1], rig.yaw, viewHalf(), true)) return -1;
    P[best * 3] = _spot[0]; P[best * 3 + 1] = _spot[1]; P[best * 3 + 2] = _spot[2];
    return best;
  };
  // the arrow toward a world point, from the camera's view: ahead / behind / left / right
  const arrowTo = (x, z) => {
    const p = cc.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) || 1;
    rig.getForward(_f); rig.getRight(_r);
    const ahead = (dx * _f.x + dz * _f.z) / d, side = (dx * _r.x + dz * _r.z) / d;
    return ahead > 0.82 ? '↑' : ahead < -0.7 ? '↓' : side > 0 ? '→' : '←';
  };
  // the BOO lesson: the first ghost rises 9..11 m ahead of the camera (in view), drifts in slowly and cannot catch
  const _tspot = [0, 0];
  const wakeTutor = (p) => {
    let g = null;
    if (ringSpot(_spot, p.x, p.z, TUTOR_R[0], TUTOR_R[1], rig.yaw, 0.25)) { _tspot[0] = _spot[0]; _tspot[1] = _spot[2]; g = ghosts.wake(p.x, p.z, Math.random, _tspot); }
    if (!g) g = ghosts.wake(p.x, p.z);
    if (!g) return;
    g.tame = TUTOR_T;
    rig.getForward(_f);
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz) || 1;
    G.tutorWake = { d: +d.toFixed(2), ahead: +((dx * _f.x + dz * _f.z) / d).toFixed(2) }; // (read by the browser test)
  };
  const lanternInView = (p) => {
    const L = lanterns;
    for (let i = 0; i < L.n; i++) {
      if (!L.alive[i] || L.grow[i] < 1) continue;
      const dx = L.x[i] - p.x, dz = L.z[i] - p.z;
      if (dx * dx + dz * dz > LANTERN_HINT.r * LANTERN_HINT.r) continue;
      if (onScreen(L.x[i], L.y[i] + 0.3, L.z[i], 0.85)) return true;
    }
    return false;
  };

  // Witching Hour: the finale (a call-out, bells, the x2 badge, every lantern lit again, orange ghost auras, candy rain)
  const WITCH_AT = Math.min(WITCH_S, ROUND / 6);
  const relit = (i) => fx.motes(lanterns.x[i], lanterns.y[i] + 0.3, lanterns.z[i], 12, 2, 1, 0.3);
  const startWitching = () => {
    G.witching = true; G.rainLeft = WITCH_RAIN; G.rainT = 0.8;
    hud.setWitching(true); hud.callout('WITCHING HOUR!', 'witch', `CANDY ×${WITCH_MULT}`);
    audio.bell(2, 0.8); audio.witching();
    lanterns.relightAll(relit);
    ghosts.witch = true;
  };
  /** One candy of the rain: falls from high up into the ring around the kid (most of them inside the view). */
  const rainCandy = (p) => {
    const half = Math.random() < WITCH_VIEW ? viewHalf() : Math.PI;
    if (!ringSpot(_spot, p.x, p.z, WITCH_RAIN_R[0], WITCH_RAIN_R[1], rig.yaw, half)) return;
    const i = candy.drop(_spot[0], _spot[1], _spot[2], randomKind(), 7);
    if (i >= 0) fx.burst(_spot[0], _spot[1] + 7, _spot[2], 6, 2, 1.3, 0.4, 0.8, 0, 0.6, 0.1);
  };
  // share the score without a server: the phone's share sheet (Web Share), else (or when it fails) the clipboard,
  // else a hidden textarea copy. Every browser call is guarded; a share the player cancels does nothing.
  const shareScore = () => {
    const n = G.candy, url = location.origin + location.pathname.replace(/index\.html$/, '');
    const text = `I grabbed ${n} candy before midnight (${rankFor(n)}) in Midnight Candy Run. Can you beat it?`;
    const copy = () => {
      const both = `${text} ${url}`, done = (ok) => hud.toast(ok ? 'SCORE COPIED!' : 'COULD NOT SHARE');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(both).then(() => done(true), () => done(copyText(both))); return; }
      } catch { /* no clipboard: the textarea copy below */ }
      done(copyText(both));
    };
    try {
      if (touchUI && typeof navigator.share === 'function') {
        navigator.share({ title: 'Midnight Candy Run', text, url }).catch((e) => { if (!e || e.name !== 'AbortError') copy(); });
        return;
      }
    } catch { /* share threw synchronously: copy instead */ }
    copy();
  };

  // ---------------------------------------------------------------- systems (registration order = run order)
  engine.addSystem({
    earlyUpdate(dt) {
      // a hitstop ends after its real time (whatever the scaled dt)
      if (juice.stopUntil > 0 && engine.clock.unscaledTime >= juice.stopUntil) { juice.stopUntil = 0; engine.clock.timeScale = 1; }
      input.update(dt);
      const c = input.controls, m = input.map;
      if (m.justPressed('mute')) hud.setMuted(audio.toggleMute());
      // Enter / Space start (a key press is a user gesture too: the mouse is captured from here, within its activation)
      if (G.state === 'title' || G.state === 'over') { if (m.justPressed('start') && (G.state === 'title' || G.endT > 1.5)) { startRound(); captureMouse(); } return; }
      if (c.menu) { if (G.state === 'play') setPaused(true); else if (G.state === 'paused') { setPaused(false); captureMouse(); } return; }
      if (G.state !== 'play') { intent.moveX = intent.moveZ = intent.fwd = 0; intent.jump = false; return; }
      if (c.lookX || c.lookY) {
        rig.turn(-c.lookX, -c.lookY);
        if (G.lookHintT > 0 && (G.lookHintRad -= Math.abs(c.lookX) + Math.abs(c.lookY)) <= 0) { G.lookHintT = 0; hud.lookHint(null); }
      }
      rig.getForward(_f); rig.getRight(_r);
      let sx = c.moveX, sy = c.moveY;
      if (stickCtl && stickCtl.pointer != null) {
        // touch stick: a dead zone (a resting thumb's wobble neither moves nor turns the kid), then full speed at 3/4
        // deflection (a comfortable push runs; the stick used to be linear, so most thumbs ran at 55-80 %)
        const sm = Math.hypot(sx, sy), k = sm < STICK_DEAD ? 0 : Math.min(1, (sm - STICK_DEAD) / (STICK_FULL - STICK_DEAD)) / sm;
        sx *= k; sy *= k;
      }
      let mx = _r.x * sx + _f.x * sy, mz = _r.z * sx + _f.z * sy;
      const l2 = mx * mx + mz * mz;
      if (l2 > 1) { const k = 1 / Math.sqrt(l2); mx *= k; mz *= k; }
      intent.moveX = mx; intent.moveZ = mz;
      // how much the stick / keys point "into the screen" (1 straight ahead, 0 sideways, < 0 toward the camera)
      const ml = Math.hypot(sx, sy);
      intent.fwd = ml > 0.2 ? sy / ml : 0;
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
        // the moan comes from the ghost's side of the view (every chase that starts close; 70 % of the far ones)
        const q = ghosts.list[ghosts.events.chaseStart], gx = q.x - p.x, gz = q.z - p.z, gd = Math.hypot(gx, gz) || 1;
        rig.getRight(_r);
        if (gd < 12 || Math.random() < 0.7) audio.moan(clamp((gx * _r.x + gz * _r.z) / gd, -1, 1));
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
      if (intent.moveX * intent.moveX + intent.moveZ * intent.moveZ > 1e-4) { // any real push (the stick dead zone is upstream)
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
        // until a first BOO lands: say it when a chaser is in reach and BOO is ready (the button glows then too)
        if (G.hintBoo && (G.hintBooT -= dt) <= 0 && G.booT >= BOO_CD && ghosts.nearestChaser(p.x, p.z) < BOO_R) {
          G.hintBooT = 6; hud.callout(touchUI ? 'GHOST! TAP BOO!' : 'GHOST! PRESS E', 'boo');
        }
        G.safeT = Math.max(0, G.safeT - dt);
        const prog = 1 - G.left / ROUND;
        if (G.mercyT > 0) G.mercyT -= dt;
        ghosts.difficulty = Math.max(0, prog - (G.mercyT > 0 ? MERCY : 0)); audio.intensity(prog);
        if (G.lookHintT > 0 && (G.lookHintT -= dt) <= 0) hud.lookHint(null);
        // ghosts rise on schedule
        const elapsed = ROUND - G.left;
        while (G.wakeIdx < WAKE_AT.length && elapsed >= WAKE_AT[G.wakeIdx] * ROUND / 180) {
          G.wakeIdx++;
          if (G.wakeIdx === 1 && G.tutor) { wakeTutor(p); continue; }
          if (ghosts.wake(p.x, p.z) && G.wakeIdx > 3) hud.callout('A GHOST RISES…', 'bad');
        }
        // the first lantern in kicking reach and in view (first 20 s, until one is smashed): say it can be kicked
        if (G.lanternHint && (G.lanternHintT -= dt) <= 0) {
          G.lanternHintT = 0.25;
          if (elapsed > LANTERN_HINT.until) G.lanternHint = false;
          else if (elapsed > 2.4 && lanternInView(p)) { G.lanternHint = false; hud.callout('KICK THE LANTERN!', 'good'); }
        }
        // candy trickles back; big pops now and then
        G.spawnT -= dt;
        if (G.spawnT <= 0) {
          G.spawnT = 1.2;
          const dry = !candyInView(p, DRY_R, DRY_NEED);
          G.dryT = dry ? G.dryT + 1.2 : 0;
          const i = candy.restingCount < CANDY_TARGET ? respawnCandy(p, dry) : G.dryT >= DRY_T ? relocateFar(p) : -1;
          if (i >= 0) fx.motes(candy.p[i * 3], candy.p[i * 3 + 1], candy.p[i * 3 + 2], 6, 1.2, 0.8, 1.6);
        }
        G.popT -= dt;
        if (G.popT <= 0) {
          // a big pop 14..26 m away, in view while the view is dry (it used to land anywhere 16+ m off: no novice or
          // casual bot ever got one); the call-out points at it, an edge marker shows it while it is off screen
          G.popT = 20 + Math.random() * 8;
          if (candy.countKind(CANDY_KIND.POP) < 2) {
            const dry = G.dryT > 0, i = ringSpot(_spot, p.x, p.z, POP_R[0], POP_R[1], rig.yaw, dry ? viewHalf() : Math.PI) ? candy.place(_spot[0], _spot[1], _spot[2], CANDY_KIND.POP) : candy.spawnRandom(p.x, p.z, CANDY_KIND.POP, 16);
            if (i >= 0) hud.callout(`BIG POP SPOTTED ${arrowTo(candy.p[i * 3], candy.p[i * 3 + 2])}`, 'good');
          }
        }
        // the clock: the one-minute warning, the Witching Hour, the last ten seconds
        const s = Math.ceil(G.left);
        if (s !== G.lastCount) {
          if (s === 60) { hud.callout('ONE MINUTE TO MIDNIGHT', 'warn'); audio.bell(1); }
          else if (s <= 10 && s > 0) { hud.countdown(s); audio.tick(s <= 3); }
          G.lastCount = s;
        }
        if (!G.witching && G.left <= WITCH_AT) startWitching();
        if (G.witching && G.rainLeft > 0 && (G.rainT -= dt) <= 0) { G.rainT = WITCH_RAIN_T / WITCH_RAIN; G.rainLeft--; rainCandy(p); }
        // the best run's pace: record this run's candy at each of the PACE_N moments; every PACE_SHOW-th, compare
        while (G.paceK < PACE_N - 1 && elapsed >= (G.paceK + 1) * ROUND / PACE_N) {
          paceRec[G.paceK] = G.candy;
          if (pace && (G.paceK + 1) % PACE_SHOW === 0) hud.pace(G.candy - pace[G.paceK]);
          G.paceK++;
        }
        if (G.left <= 0) { G.left = 0; endRound(); }
      } else if (G.state === 'ending') {
        G.endT += dt;
        if (G.endT > 3.4) showResults();
      } else if (G.state === 'over') G.endT += dt;
      // candy pickups only during the round (after midnight, candy spilled next to the kid must not vanish into it
      // uncounted); the candy still animates on every screen
      G.bonusFrame = 0;
      candy.update(dt, playing ? cc.position : OFFSTAGE, G.time, playing ? onPick : null);
      if (playing && candy.valueThisFrame > 0) {
        const gain = candy.valueThisFrame * (G.witching ? WITCH_MULT : 1) + G.bonusFrame;
        G.candy += gain; candyChanged();
        if (candy.popThisFrame === 0) hud.plusText(`+${gain}`);
      }
      if (playing) { // the streak meter, while a streak of STREAK_SHOW+ runs
        const on = G.streak >= STREAK_SHOW && G.time - G.lastPick < STREAK_GAP;
        hud.setStreak(on ? ((G.streak - 1) % STREAK_EVERY) + 1 : 0, on);
      }
    },
  }, 'game');

  engine.addSystem({ update: (dt) => { if (rigOn) rigOn.update(dt); if (rigOn === rig) applyJuice(); } }, 'camera');

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

  // edge markers: where on screen a world point is, or (off screen) a spot on an ellipse inside the HUD / thumb-free
  // band toward it, by its bearing from the kid in the camera's frame (0 = ahead / up, + = right; behind = bottom)
  const edge = { x: 0, y: 0, ang: 0, off: false };
  const placeEdge = (x, y, z) => {
    const p = cc.position, dx = x - p.x, dz = z - p.z;
    edge.ang = Math.atan2(dx * _r.x + dz * _r.z, dx * _f.x + dz * _f.z);
    _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); // camera space: in front when z < 0
    edge.off = true;
    if (_v.z < -0.2) { _v.applyMatrix4(camera.projectionMatrix); edge.off = Math.abs(_v.x) > 0.92 || Math.abs(_v.y) > 0.9; }
    const W = viewW, H = viewH, portrait = H > W;
    const rx = W / 2 - (portrait ? 40 : 92), ry = H * (portrait ? 0.13 : 0.16), cy = H * (portrait ? 0.4 : 0.42);
    edge.x = W / 2 + Math.sin(edge.ang) * rx; edge.y = cy - Math.cos(edge.ang) * ry;
    return edge;
  };
  const GHOST_WARN = 12, GHOST_WARN_FULL = 4;
  let hudT = 0;
  engine.addSystem({
    lateUpdate(dt) {
      if (G.state === 'play' || G.state === 'ending') {
        hudT -= dt;
        if (hudT <= 0) { hudT = 0.1; hud.setClock(G.left, ROUND); }
        hud.setBoo(G.booT / BOO_CD);
        if (input.touch) input.touch.setProgress('boo', G.booT / BOO_CD);
        const p = cc.position, playing = G.state === 'play';
        rig.getForward(_f); rig.getRight(_r);
        // the nearest chaser: the frost (thickest on its side), BOO's glow
        let d = Infinity, ang = 0;
        for (const g of ghosts.list) {
          if (g.state !== 'chase') continue;
          const gx = g.x - p.x, gz = g.z - p.z, gd = Math.hypot(gx, gz);
          if (gd < d) { d = gd; ang = Math.atan2(gx * _r.x + gz * _r.z, gx * _f.x + gz * _f.z); }
        }
        hud.setDanger(playing ? clamp((7 - d) / 5, 0, 1) * 0.9 : 0, ang);
        // BOO glows while it is ready and a chaser is in reach (novices had BOO ready at 25 of 28 catches)
        const hot = playing && G.booT >= BOO_CD && d < BOO_R;
        if (hot !== booHot) { booHot = hot; if (booBtn) booBtn.el.classList.toggle('hw-boo-hot', hot); hud.setBooHot(hot); }
        // the nearest big pop, while it is off screen
        let pi = -1, pd = Infinity;
        const C = candy;
        for (let i = 0; i < C.state.length; i++) {
          if (C.state[i] === 0 || C.kind[i] !== CANDY_KIND.POP) continue;
          const q = Math.hypot(C.p[i * 3] - p.x, C.p[i * 3 + 2] - p.z); if (q < pd) { pd = q; pi = i; }
        }
        if (playing && pi >= 0 && placeEdge(C.p[pi * 3], C.p[pi * 3 + 1] + 0.6, C.p[pi * 3 + 2]).off) hud.setEdge(hud.popEdge, true, edge.x, edge.y, edge.ang, 1, pd);
        else hud.setEdge(hud.popEdge, false);
        // ghosts closing in from off screen or from behind the kid (the camera side): a chevron, stronger as they near
        let k = 0;
        if (playing) {
          for (const g of ghosts.list) {
            if (g.state !== 'chase' || k >= hud.ghostEdges.length) continue;
            const gd = Math.hypot(g.x - p.x, g.z - p.z);
            if (gd > GHOST_WARN) continue;
            const e = placeEdge(g.x, g.y - 0.4, g.z), behind = (g.x - p.x) * _f.x + (g.z - p.z) * _f.z < 0;
            if (!e.off && !behind) continue;
            hud.setEdge(hud.ghostEdges[k++], true, e.x, e.y, e.ang, clamp((GHOST_WARN - gd) / (GHOST_WARN - GHOST_WARN_FULL), 0, 1));
          }
        }
        for (; k < hud.ghostEdges.length; k++) hud.setEdge(hud.ghostEdges[k], false);
      } else if (booHot) { booHot = false; if (booBtn) booBtn.el.classList.remove('hw-boo-hot'); hud.setBooHot(false); }
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
    loadMs, TOUCH, LOW, startRound, toTitle, setPaused, endRound, juice, paceRec, shareScore,
    get pace() { return pace; }, get baseFov() { return baseFov; },
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
