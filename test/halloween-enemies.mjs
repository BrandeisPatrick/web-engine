// Headless checks for the Halloween game's enemies (samples/halloween/hands.js, thief.js; DESIGN pass 3): the grave
// hands' cycle (a 0.8 s telegraph, 2.5 s up), the grab (within 0.9 m, feet under 0.6 m, held 1.0 s, then let go: on
// the timer, a release() or the round's end; never while safe or sneaking, nor in the grace after a release; a long
// randomised run never holds the kid longer than the hold), BOO retracting hands within 4 m, at most 4 out, none on
// the village green, the Witching Hour's faster cycle; the candy thief coming out, running to a cluster and eating it
// at 2 per second, never stepping within 6 m of a kid who stands still, bolting from one within 4 m, a BOO within
// 7.5 m stunning it 1.8 s, a touch while stunned tagging it (its sack + 5) and sending it home for 25 s, a cornered
// touch, the Witching Hour's 10-candy sack, its way round a wall; and the allocation per frame in TurboFan
// (test/helpers/alloc.mjs): none for the hands; for the thief only the boxed arguments of two engine calls (its ground
// height, the collider probe), no object or array. No browser, no WebGL: the modules run on three.js objects, the
// engine's PhysicsWorld and the game's Candy pool. Run: node --import ./test/helpers/dom-shim.mjs test/halloween-enemies.mjs
import * as THREE from 'three';
import { ALLOC, BOXED, bytesPerCall, describe, functionsOf } from './helpers/alloc.mjs';
import { PhysicsWorld } from '../src/physics/PhysicsWorld.js';
import { heightAt } from '../samples/halloween/world.js';
import { Candy } from '../samples/halloween/candy.js';
import { Glows } from '../samples/halloween/effects.js';
import { Hands, HAND } from '../samples/halloween/hands.js';
import { Thief, THIEF } from '../samples/halloween/thief.js';
import { HAND_SPOTS, THIEF_DEN } from '../samples/halloween/hand-spots.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  return ok;
}
const DT = 1 / 120;
const near = (a, b, eps) => Math.abs(a - b) <= eps;
/** A seeded stream (the hidden times are the module's `rnd`). */
const lcg = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

const scene = new THREE.Scene();
const physics = new PhysicsWorld({ cellSize: 8 });
const candySpot = (out, ax = 1e9, az = 1e9) => { out[0] = ax + 20; out[1] = heightAt(ax + 20, az); out[2] = az; return true; };
const candy = new Candy({ scene, heightAt, candySpot });
const glows = new Glows(400);
const kid = { x: 0, y: 0, z: 0, vx: 0, vz: 0, safe: false, sneak: false };
const put = (x, z, lift = 0) => { kid.x = x; kid.z = z; kid.y = heightAt(x, z) + lift; kid.vx = kid.vz = 0; };

// ================================================================ grave hands
const hands = new Hands({ scene, heightAt, spots: HAND_SPOTS, rnd: lcg(7) });
const H = hands, K = 2; // the aisle spot (16, -26)
/** Steps until pred() or `max` s; returns the seconds taken (Infinity when it never held). */
const stepsUntil = (pred, max, step = () => H.fixedUpdate(DT, kid, true)) => { for (let i = 0; i < max / DT; i++) { step(); if (pred()) return (i + 1) * DT; } return Infinity; };
const quiet = () => { H.reset(); H.awake = false; for (let k = 0; k < H.n; k++) H.wait[k] = 99; };

{ // the cycle: hidden -> tell 0.8 s -> up 2.5 s -> down -> hidden 7..12 s
  quiet(); put(0, 30); H.awake = true; H.wait[K] = 0.5;
  const tTell = stepsUntil(() => H.st[K] === 1, 2);
  const tUp = stepsUntil(() => H.st[K] === 2, 2);
  const tDown = stepsUntil(() => H.st[K] === 3, 4);
  const tHide = stepsUntil(() => H.st[K] === 0, 2);
  check('hands: the telegraph lasts 0.8 s, the hands stand 2.5 s, then sink', near(tTell, 0.5, 2 * DT) && near(tUp, HAND.TELL, 2 * DT) && near(tDown, HAND.UP, 2 * DT) && near(tHide, HAND.DOWN, 2 * DT),
    `tell after ${tTell.toFixed(3)} s, up after ${tUp.toFixed(3)}, down after ${tDown.toFixed(3)}, hidden after ${tHide.toFixed(3)}`);
  check('hands: hidden 7..12 s before the next telegraph', H.wait[K] >= HAND.HIDDEN[0] && H.wait[K] <= HAND.HIDDEN[1], `${H.wait[K].toFixed(2)} s`);
  quiet(); H.awake = false; H.wait[K] = 0.01;
  check('hands: asleep (before 0:40) nothing rises', stepsUntil(() => H.st[K] !== 0, 3) === Infinity);
}
{ // the grab: a grounded kid in reach while they stand; held 1.0 s, then let go once; the grace after it
  quiet(); const x = H.x[K], z = H.z[K];
  put(x + 0.5, z); H.st[K] = 1; H.t[K] = 0;
  const tGrab = stepsUntil(() => H.events.grab >= 0, 2);
  const held = H.holding === K;
  let releases = 0, at = -1;
  const tRel = stepsUntil(() => { if (H.events.release >= 0) { releases++; at = H.events.release; } return H.holding < 0; }, 3);
  const after = H.st[K];
  H.st[K] = 2; H.t[K] = 0.2; // up again at once: the grace after a release
  const regrab = stepsUntil(() => { if (H.events.release >= 0) releases++; return H.events.grab >= 0; }, HAND.GRACE - 0.05);
  check('hands: a grounded kid 0.5 m from them is grabbed as they rise', held && near(tGrab, HAND.TELL, 2 * DT), `grab after ${tGrab.toFixed(3)} s`);
  check('hands: the grab holds 1.0 s, then lets go (one release, the hands go down)', near(tRel, HAND.HOLD, 2 * DT) && releases === 1 && at === K && after === 3, `held ${tRel.toFixed(3)} s, ${releases} release(s), state ${after}`);
  check('hands: no grab in the 1.2 s after a release', regrab === Infinity && H.grace <= 0.05 + DT, `regrab ${regrab}, grace ${H.grace.toFixed(3)}`);
}
{ // the rules: reach 0.9 m, feet under 0.6 m, not safe, not sneaking
  const tryGrab = (dx, lift, safe = false, sneak = false) => {
    quiet(); put(H.x[K] + dx, H.z[K], 0); kid.y = H.gy[K] + lift; kid.safe = safe; kid.sneak = sneak;
    H.st[K] = 2; H.t[K] = 0.2; H.fixedUpdate(DT, kid, true);
    const g = H.events.grab === K; H.release(); kid.safe = false; kid.sneak = false; return g;
  };
  check('hands: reach 0.9 m (0.88 grabbed, 0.92 not)', tryGrab(0.88, 0) && !tryGrab(0.92, 0));
  check('hands: a kid whose feet are over 0.6 m (a jump) is not grabbed; at 0.58 m it is', !tryGrab(0, 0.62) && !tryGrab(0, 1.4) && tryGrab(0, 0.58));
  check('hands: no grab while safe (after a catch) or sneaking', !tryGrab(0, 0, true) && !tryGrab(0, 0, false, true));
  // a jump across: from 2.6 m before the spot, 6.5 m/s on, 4.5 m/s up (the kid's arc): through the ring, never grabbed
  quiet(); H.st[K] = 2; H.t[K] = 0; let y = 0.65, vy = 4.5, grabbed = false, inRing = 0;
  for (let t = 0; t < 1.2; t += DT) {
    const x = H.x[K], z = H.z[K] - 2.6 + 6.5 * t; vy -= 9.9 * DT; y = Math.max(0, y + vy * DT);
    kid.x = x; kid.z = z; kid.y = heightAt(x, z) + y;
    H.t[K] = 0.3; H.fixedUpdate(DT, kid, true);
    if (Math.hypot(kid.x - H.x[K], kid.z - H.z[K]) < HAND.REACH) inRing++;
    if (H.events.grab >= 0) grabbed = true;
  }
  check('hands: a running jump over standing hands is not grabbed (and counts as jumped)', !grabbed && inRing > 5 && H.stats.jumped === 1 && H.stats.crossed === 1, `${inRing} steps inside, crossed ${H.stats.crossed}, jumped ${H.stats.jumped}`);
}
{ // BOO: telling / standing hands within 4 m retract; a BOO in a grab lets go
  quiet(); H.st[K] = 2; H.t[K] = 0.3; H.st[3] = 1; H.t[3] = 0.2; // (16, -26) up, (16, -32) telling
  const n1 = H.boo(16, -26 - 3.9), n2 = H.boo(16, -26 + 4.2);
  check('hands: BOO within 4 m retracts (standing and telling), from farther it does not', n1 === 2 && H.st[K] === 3 && H.st[3] === 3 && n2 === 0, `retracted ${n1}, then ${n2}`);
  quiet(); put(H.x[K], H.z[K]); H.st[K] = 2; H.t[K] = 0.3; H.fixedUpdate(DT, kid, true);
  const was = H.holding; H.boo(kid.x, kid.z); H.fixedUpdate(DT, kid, true);
  check('hands: a BOO in a grab lets go at once (reported on the next step)', was === K && H.holding < 0 && H.events.release === K && H.st[K] === 3);
}
{ // release always: the round's end, release() (a catch); and a long run with the kid on the spots never held > 1 s
  quiet(); put(H.x[K], H.z[K]); H.st[K] = 2; H.t[K] = 0.3; H.fixedUpdate(DT, kid, true);
  const a = H.holding; H.fixedUpdate(DT, kid, false);
  const endFree = a === K && H.holding < 0 && H.events.release === K;
  quiet(); put(H.x[K], H.z[K]); H.st[K] = 2; H.t[K] = 0.3; H.fixedUpdate(DT, kid, true);
  const r = H.release(); H.fixedUpdate(DT, kid, true);
  check('hands: a grab ends when the round does, and on release() (a catch)', endFree && r === K && H.holding < 0 && H.events.release === K);
  H.reset(); H.awake = true; const rnd = lcg(99);
  let longest = 0, cur = 0, grabs = 0, maxOut = 0, onGreen = 0, k = 0, hop = 0;
  for (let i = 0; i < 600 / DT; i++) {
    if (i % 90 === 0) { k = (rnd() * H.n) | 0; hop = rnd() < 0.3 ? 0.8 : 0; } // a kid wandering from spot to spot, hopping now and then
    put(H.x[k] + (rnd() - 0.5) * 1.6, H.z[k] + (rnd() - 0.5) * 1.6, hop * rnd()); kid.safe = rnd() < 0.05;
    if (rnd() < 0.002) H.boo(kid.x, kid.z);
    H.fixedUpdate(DT, kid, rnd() > 0.001);
    if (H.events.grab >= 0) grabs++;
    cur = H.holding >= 0 ? cur + DT : 0; longest = Math.max(longest, cur); maxOut = Math.max(maxOut, H.out);
  }
  kid.safe = false;
  for (let j = 0; j < H.n; j++) if (Math.hypot(H.x[j], H.z[j] - 2) < 11) onGreen++;
  check('hands: 600 s on the spots: grabbed again and again, never held longer than 1.0 s', grabs > 20 && longest <= HAND.HOLD + 1.5 * DT, `${grabs} grabs, longest hold ${longest.toFixed(3)} s`);
  check('hands: at most 4 tell or stand at once', maxOut === HAND.MAX_UP, `max ${maxOut}`);
  check('hands: ten spots, none on the village green (r 11 round (0, 2))', H.n === 10 && onGreen === 0);
}
{ // the Witching Hour: hidden 3..6 s; the instanced draw only while some are out
  quiet(); put(0, 30); H.setWitch(true); H.awake = true; H.wait[K] = 0.01;
  let w = -1;
  stepsUntil(() => { if (H.st[K] === 3 && H.t[K] >= HAND.DOWN - DT * 0.5) { H.fixedUpdate(DT, kid, true); w = H.wait[K]; return true; } return false; }, 5);
  check('hands: the Witching Hour hides them 3..6 s', w >= HAND.HIDDEN_WITCH[0] && w <= HAND.HIDDEN_WITCH[1], `${w.toFixed(2)} s`);
  quiet(); H.update(1 / 60, glows, 0, 0);
  const off = !H.mesh.visible && H.mesh.count === 0;
  H.st[K] = 2; H.t[K] = 0.5; const g = H.update(1 / 60, glows, 0, 1);
  check('hands: drawn (2 instances a spot, its ring in the glows) only while out', off && H.mesh.visible && H.mesh.count === 2 && g === 11, `count ${H.mesh.count}, glows ${g}`);
}

// ================================================================ the candy thief
const thief = new Thief({ scene, heightAt, physics, candy, den: THIEF_DEN });
const T = thief;
const run = (sec, onStep = null) => { for (let i = 0; i < sec / DT; i++) { T.fixedUpdate(DT, kid, true); if (onStep) onStep(i); } };
const clearCandy = () => candy.reset();
const plant = (x, z, n, r = 0.4) => { for (let i = 0; i < n; i++) { const a = i * 2.4, d = r * Math.sqrt((i + 0.5) / n); candy.place(x + Math.cos(a) * d, heightAt(x, z), z + Math.sin(a) * d, 0); } };
const resting = () => candy.restingCount;

{ // out at 1:00, to the cluster the kid is near (>= 8 m from it), eating 2 a second
  T.reset(); clearCandy(); put(-20, 0);
  run(1);
  const away = T.stateName === 'away' && !T.root.visible;
  T.awake = true; let appeared = false;
  run(0.05, () => { if (T.events.appear) appeared = true; });
  plant(-30, -6, 6); // 11.7 m from the kid, 12.4 m from the den
  let tEat = Infinity, t = 0;
  run(8, () => { t += DT; if (T.stateName === 'eat' && tEat === Infinity) tEat = t; });
  check('thief: in its den until 1:00, then out of it (appear)', away && appeared);
  check('thief: runs to a cluster of resting candy >= 8 m from the kid and eats it', tEat < 4 && T.eaten >= 6 && resting() === 0 && T.sack === T.eaten, `eating after ${tEat.toFixed(2)} s, eaten ${T.eaten}, ${resting()} left, sack ${T.sack}`);
  // the rate: a planted cluster, the thief on it
  clearCandy(); T.sack = 0; T.eaten = 0; T.x = -30; T.z = -6; T._set(3); T.eatT = 0;
  plant(-30, -6, 10, 0.5);
  run(2.0 + DT);
  check('thief: eats one candy every 0.5 s (4 in 2 s)', T.eaten === 4 && T.sack === 4 && resting() === 6, `eaten ${T.eaten}, ${resting()} left`);
  T.sack = THIEF.SACK_MAX; run(1.2);
  check('thief: stops eating with a full sack (20)', T.eaten === 4 && T.sack === THIEF.SACK_MAX && T.stateName !== 'eat');
}
{ // wary: never within 6 m of a kid standing still, whatever it is after; bolts from a kid within 4 m
  T.reset(); clearCandy(); put(0, 0); T.awake = true;
  plant(0, 9, 5); plant(-9, 0, 5); plant(6.5, -6.5, 5); plant(0, -12, 5); // clusters round the kid, some just past 8 m
  T.x = 14; T.z = 14; T._set(2); T.minKid = Infinity;
  let minD = Infinity;
  run(40, () => { minD = Math.min(minD, Math.hypot(T.x - kid.x, T.z - kid.z)); if (resting() < 10) plant(0, 9, 5); });
  check('thief: never comes within 6 m of a kid who stands still (40 s round its clusters)', minD >= THIEF.KEEP - 1e-6 && T.eaten > 0, `closest ${minD.toFixed(3)} m, eaten ${T.eaten}`);
  T.x = kid.x + 3.8; T.z = kid.z; T._set(2); T.retarget = 1;
  T.fixedUpdate(DT, kid, true);
  const bolted = T.stateName === 'bolt';
  let far = 0; run(1.5); far = Math.hypot(T.x - kid.x, T.z - kid.z);
  check('thief: bolts from a kid within 4 m (6.5 m/s, zigzag) and gets away', bolted && far > 3.8 + 1.5 * 5, `bolt ${bolted}, ${far.toFixed(1)} m away after 1.5 s`);
}
{ // BOO: within 7.5 m it is stunned 1.8 s, then it bolts; a touch while stunned tags it
  T.reset(); clearCandy(); put(0, 0); T.awake = true; T.z = 0; T._set(2); // (the game's BOO: at the kid, BOO_R 7.5)
  T.x = 7.6; const miss = T.boo(0, 0, 7.5);
  T.x = 7.4; const hit = T.boo(0, 0, 7.5);
  let tBolt = Infinity, t = 0;
  run(2.5, () => { t += DT; if (T.stateName === 'bolt' && tBolt === Infinity) tBolt = t; });
  check('thief: BOO within 7.5 m stuns it 1.8 s (from 7.6 m nothing), then it bolts', !miss && hit && near(tBolt, THIEF.STUN, 2 * DT), `stunned ${hit}, bolting after ${tBolt.toFixed(3)} s`);
  // the tag: stunned with 7 in the sack, the kid touches it
  T.x = 3; T.z = 0; T._set(2); T.sack = 7; T.boo(0, 0, 7.5);
  put(2.1, 0); let tag = 0;
  run(DT * 2, () => { if (T.events.tag) tag = T.events.tag; });
  check('thief: a touch while stunned is a TAG: its sack + 5 (7 + 5 = 12), then it runs home', tag === 12 && T.sack === 0 && T.tags === 1 && T.stateName === 'home', `tag ${tag}, state ${T.stateName}`);
  // home: it runs to the den, stays in, and comes out 25 s after the tag
  let tHome = Infinity, tOut = Infinity; t = 0;
  run(30, () => { t += DT; if (T.events.home && tHome === Infinity) tHome = t; if (T.events.appear && tOut === Infinity) tOut = t; });
  check('thief: home in its den, out again 25 s after the tag (an empty sack)', tHome < 12 && near(tOut, THIEF.HOME_T, 3 * DT) && T.sack === 0, `home after ${tHome.toFixed(1)} s, out after ${tOut.toFixed(2)} s`);
}
{ // a cornered thief's touch: it snatches (the game takes 5) and bolts; never from a safe kid; the Witching Hour
  T.reset(); clearCandy(); put(0, 0); T.awake = true; T.x = 0.5; T.z = 0; T._set(3); kid.safe = true;
  T.fixedUpdate(DT, kid, true); const safeSteal = T.events.steal;
  T.x = 0.5; T.z = 0; T._set(3); kid.safe = false;
  T.fixedUpdate(DT, kid, true); const steal = T.events.steal, st = T.stateName;
  T.stole(5);
  check('thief: a cornered touch snatches (sack +5) and it bolts; not from a safe kid', steal && !safeSteal && st === 'bolt' && T.sack === 5);
  T.reset(); T.awake = true; run(0.1); T.tags = 0;
  T.x = 30; T.z = 30; T._set(6); // on its way home
  T.setWitch(true);
  check('thief: the Witching Hour brings it back at once with 10 in its sack', T.stateName === 'emerge' && T.sack === THIEF.WITCH_SACK && T.events.appear);
}
{ // its way round a wall (one probe a step): a 6 m wall between it and its cluster, it gets there (round or over)
  physics.addStaticBox(-40.2, -1, -39.8, 3, -9, 3);
  T.reset(); clearCandy(); put(-20, 20); T.awake = true; T.x = -44; T.z = -3; T._set(2);
  plant(-34, -3, 6);
  let t = 0, tEat = Infinity;
  run(10, () => { t += DT; if (T.stateName === 'eat' && tEat === Infinity) tEat = t; });
  check('thief: a wall between it and its cluster: it gets round (or hops it) and eats', tEat < 6 && T.eaten > 0, `eating after ${tEat.toFixed(2)} s`);
}

// ================================================================ allocation: a frame of each, in TurboFan
{
  T.reset(); clearCandy(); put(0, 0); T.awake = true; H.reset(); H.awake = true;
  plant(0, 10, 6); plant(-10, 0, 6);
  for (let k = 0; k < H.n; k++) H.wait[k] = 0.1;
  const rnd = lcg(5), path = new Float64Array(4096 * 2);
  for (let i = 0; i < 4096; i++) { path[i * 2] = HAND_SPOTS[i % H.n][0] + (rnd() - 0.5) * 2; path[i * 2 + 1] = HAND_SPOTS[i % H.n][1] + (rnd() - 0.5) * 2; }
  // a 60 fps frame at 120 Hz: two fixed steps and an update of each; the clock's values are boxed numbers (a double
  // computed in the loop and passed to a call would be boxed by the loop itself: test/helpers/alloc.mjs BOXED)
  const TIMES = BOXED(...Array.from({ length: 64 }, (_, i) => 0.37 + i * 0.016)), FDT = BOXED(1 / 60);
  // what it eats comes back from boxed positions (the measured loop's own calls must not box: replant() is the test's)
  const RX = BOXED(...Array.from({ length: 6 }, (_, i) => Math.cos(i * 2.4) * 0.35)), RZ = BOXED(...Array.from({ length: 6 }, (_, i) => 10 + Math.sin(i * 2.4) * 0.35)), RY = BOXED(heightAt(0, 10));
  const replant = () => { for (let i = 0; i < 6; i++) candy.place(RX[i], RY[0], RZ[i], 0); };
  let f = 0, sink = 0;
  const handsFrame = () => {
    for (let s = 0; s < 2; s++) { const i = (f++ & 4095) * 2; kid.x = path[i]; kid.z = path[i + 1]; kid.y = 0; H.fixedUpdate(DT, kid, true); }
    sink += H.update(FDT[0], glows, 0, TIMES[f & 63]);
  };
  const thiefFrame = () => {
    for (let s = 0; s < 2; s++) { const i = (f++ & 4095) * 2; kid.x = path[i]; kid.z = path[i + 1]; kid.y = 0; T.fixedUpdate(DT, kid, true); }
    if (T.state === 7 || T.state === 0) { T.homeT = 0; T.state = 2; }
    if (T.sack > 15) T.sack = 0;
    if (candy.restingCount < 6) replant();
    sink += T.update(FDT[0], glows, 40, TIMES[f & 63]);
  };
  for (let i = 0; i < 3000; i++) { handsFrame(); thiefFrame(); }
  const force = [...functionsOf(Hands, Thief), ...functionsOf(THREE)];
  const mh = bytesPerCall((k) => { for (let q = 0; q < k; q++) handsFrame(); }, 2000, { warm: 2000, budget: 1, force });
  const mt = bytesPerCall((k) => { for (let q = 0; q < k; q++) thiefFrame(); }, 2000, { warm: 2000, budget: 64, force });
  if (ALLOC.ok) {
    check('alloc: a frame of the grave hands (2 fixed steps + update), TurboFan: 0 B', mh.per <= 1 && mh.control > 1, `${mh.per.toFixed(3)} B / frame, control ${mh.control.toFixed(1)} B`);
    // the thief's only allocations are the boxed arguments of two engine calls: the ground under it (heightAt, once a
    // frame) and the collider probe while it steers (PhysicsWorld.queryColliders): no object or array
    check('alloc: a frame of the thief (2 fixed steps + update): <= 64 B (boxed engine-call arguments)', mt.per <= 64 && mt.control > 64, `${mt.per.toFixed(3)} B / frame, control ${mt.control.toFixed(1)} B`);
  }
  results.push(`NOTE  alloc: hands ${describe(mh, 'frame')}`, `NOTE  alloc: thief ${describe(mt, 'frame')} (sink ${sink > 0})`);
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll Halloween enemy checks passed.');
process.exit(failures ? 1 : 0);
