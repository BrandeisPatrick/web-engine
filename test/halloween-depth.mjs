// Headless checks for the Halloween game's depth and replay rules (samples/halloween/: potions.js, chain.js, secrets.js,
// badges.js, rng.js; DESIGN pass 4): the brew's colour at the take decides the potion; ZOOM runs a real
// CharacterController at 8.5 m/s, SNEAK keeps every ghost from chasing (a chaser drops to wandering, nothing catches),
// the grave hands from grabbing and the thief from bolting, SWEET TOOTH pulls candy from 7 m and picks it up at 1.2 m;
// each lasts its time (8 / 8 / 12 s) and undoes itself, a second take replaces the first, the brew is dark 30 s; a
// chain of three stomps pays 7 + 10 + 13 within the 1.6 s window and 7 + 7 outside it; each secret pays once a round
// (the well, the crypt and the hollow oak; the oak once more after the Witching Hour's refill; all again after a
// reset), the fixed pops sit on their spots out of the field's count and grow back 45 s after they are taken; the
// night's seed lays out the same first 60 candies, porch relight jitter and hand cycles every time and another seed
// does not (the browser suite checks two real page loads, test/browser/halloween.mjs); badges persist on the device
// and a round's results name the right new ones (at most 3); the night's best; and no allocation per frame for the
// potions and the secrets in TurboFan (test/helpers/alloc.mjs). No browser, no WebGL: the map is built headless (the
// canvas shim), the modules run on three.js objects, the engine's physics and the game's Candy pool.
// Run: node --import ./test/helpers/dom-shim.mjs test/halloween-depth.mjs
import * as THREE from 'three';
import { ALLOC, BOXED, bytesPerCall, describe, functionsOf } from './helpers/alloc.mjs';
import { PhysicsWorld, DynamicsWorld, CharacterController } from '../src/physics/index.js';
import { buildWorld, heightAt, CAULDRON, SECRETS, POP_SPOTS } from '../samples/halloween/world.js';
import { Candy, CANDY_KIND } from '../samples/halloween/candy.js';
import { Glows } from '../samples/halloween/effects.js';
import { Ghosts } from '../samples/halloween/ghosts.js';
import { Hands, HAND } from '../samples/halloween/hands.js';
import { Thief } from '../samples/halloween/thief.js';
import { Porches, PORCH } from '../samples/halloween/porches.js';
import { Potions, POTION, ZOOM, SNEAK, SWEET } from '../samples/halloween/potions.js';
import { StompChain, CHAIN } from '../samples/halloween/chain.js';
import { Secrets, SECRET, WELL, CRYPT, OAK } from '../samples/halloween/secrets.js';
import { BadgeBook, BADGES, SHOW_NEW, earnedBy, dailyBest, saveDaily } from '../samples/halloween/badges.js';
import { rng, patchFor } from '../samples/halloween/rng.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  return ok;
}
const DT = 1 / 120;
const near = (a, b, eps) => Math.abs(a - b) <= eps;
// localStorage for the badges and the night's best (a Map; reset per check)
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear() };

const scene = new THREE.Scene();
const physics = new PhysicsWorld({ cellSize: 8 });
const world = buildWorld({ scene, physics, low: true });
const candy = new Candy({ scene, heightAt, candySpot: world.candySpot, rnd: rng.candy, floorAt: (x, z, y) => physics.supportAt(x, z, y, 0.05) });
const dyn = new DynamicsWorld({ physics, substeps: 1, maxParticles: 3 * 49 + 64, maxBodies: 16 });
const ghosts = new Ghosts({ scene, dyn, heightAt, spawns: world.ghostSpawns, count: 3, grid: 7 });
const glows = new Glows(400);
const kid = { x: 0, y: 0, z: 0, vx: 0, vz: 0, safe: false, sneak: false };
const put = (x, z, lift = 0) => { kid.x = x; kid.z = z; kid.y = heightAt(x, z) + lift; kid.vx = kid.vz = 0; };
const cc = new CharacterController({ radius: 0.3, height: 1.3, walk: 6, run: 6, jumpSpeed: 5.8, accel: 34, decel: 30, airControl: 0.6, stepHeight: 0.32 });
const pail = new THREE.PointLight(0xffa040, 2.6, 7.5, 1.5);
const potions = new Potions({ cauldron: CAULDRON, heightAt, world, cc, candy, pail });
const P = potions;
const stepP = (s, each = null) => { for (let i = 0; i < Math.round(s / DT); i++) { P.fixedUpdate(DT, kid, true); if (each) each(); } };
const ring = () => put(CAULDRON.x, CAULDRON.z + 1.3); // pressed against the pot (its collider is 0.95 m)

// ================================================================ potions
{ // the colour showing at the take decides the potion
  const got = [];
  for (const k of [ZOOM, SNEAK, SWEET]) {
    P.reset(); put(CAULDRON.x, CAULDRON.z + 4); P.phase = k * POTION.CYCLE + 1.4; stepP(0.2); // (out of the ring: nothing)
    const before = P.active; ring(); P.fixedUpdate(DT, kid, true);
    got.push([k, P.showing === k, before, P.active, P.events.take]);
  }
  check('potions: the brew cycles green / violet / pink every 3 s; walking into the ring takes the colour showing', got.every(([k, sh, b, a, e]) => sh && b === -1 && a === k && e === k), JSON.stringify(got));
  P.reset(); put(CAULDRON.x, CAULDRON.z + POTION.TAKE_R + 0.15); stepP(0.5);
  const missed = P.active;
  ring(); P.fixedUpdate(DT, kid, true); const took = P.active, dark = !P.lit;
  let relit = Infinity, t = 0; put(0, 0);
  stepP(31, () => { t += DT; if (P.lit && relit === Infinity) relit = t; });
  check('potions: none from outside the ring; the brew is dark 30 s after a take (none meanwhile), then lit again', missed === -1 && took >= 0 && dark && near(relit, POTION.CD, 2 * DT), `outside ${missed}, took ${took}, relit after ${relit.toFixed(3)} s`);
}
{ // ZOOM: a real CharacterController on the green runs 8.5 m/s, back to 6 after 8 s
  P.reset();
  const run = (s) => { cc.teleport(0, heightAt(0, 4) + 0.05, 4); for (let i = 0; i < Math.round(s / DT); i++) { cc.step(DT, 0, -1, false, false, physics); P.fixedUpdate(DT, kid, false); } return Math.hypot(cc.velocity.x, cc.velocity.z); };
  const v0 = run(0.6);
  P.take(ZOOM); const v1 = run(0.6);
  let ends = Infinity, t = 0; put(0, 30);
  stepP(9, () => { t += DT; if (P.events.end === ZOOM && ends === Infinity) ends = t + 0.6; });
  const v2 = run(0.6);
  check('potions: ZOOM runs 6 -> 8.5 m/s for 8 s (a real CharacterController), then 6 again', near(v0, 6, 0.05) && near(v1, POTION.ZOOM, 0.05) && near(ends, POTION.ZOOM_T, 2 * DT) && near(v2, 6, 0.05) && cc.walk === 6,
    `${v0.toFixed(2)} -> ${v1.toFixed(2)} m/s, ends after ${ends.toFixed(3)} s, then ${v2.toFixed(2)} m/s`);
}
{ // SNEAK: no ghost starts a chase, a chaser drops to wandering, nothing catches; the hands do not grab; the thief does not bolt
  ghosts.reset(); put(20, 26);
  const g = ghosts.wake(kid.x, kid.z, Math.random, [kid.x + 4, kid.z - 0.9]);
  const settle = () => { g.state = 'wander'; g.t = 0; g.calm = 0; g.alpha = 1; g.retarget = 9; };
  for (let i = 0; i < 240; i++) ghosts.fixedUpdate(DT, kid, true); // risen
  settle(); P.reset(); P.take(SNEAK); kid.sneak = P.sneak;
  let chased = false, caught = false;
  for (let i = 0; i < 2 / DT; i++) { ghosts._teleport(g, kid.x + 0.5, g.y, kid.z); ghosts.fixedUpdate(DT, kid, true); if (g.state === 'chase') chased = true; if (ghosts.events.caught >= 0) caught = true; }
  g.state = 'chase'; g.t = 0; ghosts.fixedUpdate(DT, kid, true); const dropped = g.state;
  kid.sneak = false; settle(); ghosts._teleport(g, kid.x + 4, g.y, kid.z);
  let seenAfter = Infinity; for (let i = 0; i < 0.5 / DT; i++) { ghosts.fixedUpdate(DT, kid, true); if (g.state === 'chase') { seenAfter = i * DT; break; } }
  check('potions: SNEAK: a ghost 0.5 m off never chases or catches; a chaser drops to wandering; seen again, it chases at once', P.sneak && !chased && !caught && dropped === 'wander' && seenAfter < 0.05, `chased ${chased}, caught ${caught}, chaser -> ${dropped}, chase after ${seenAfter} s unseen`);
  const hands = new Hands({ scene, heightAt, rnd: rng.hands }), H = hands, K = 2;
  H.reset(); for (let k = 0; k < H.n; k++) H.wait[k] = 99;
  put(H.x[K] + 0.4, H.z[K]); kid.sneak = true; H.st[K] = 2; H.t[K] = 0.2; H.fixedUpdate(DT, kid, true);
  const grabSneak = H.events.grab; kid.sneak = false; H.fixedUpdate(DT, kid, true); const grabSeen = H.events.grab; H.release();
  const thief = new Thief({ scene, heightAt, physics, candy }), T = thief;
  put(0, 0); T.awake = true; T.x = 3; T.z = 0; T._set(2); kid.sneak = true; T.fixedUpdate(DT, kid, true); const boltSneak = T.stateName;
  T.boo(0, 0, 7.5); put(2.2, 0); T.fixedUpdate(DT, kid, true); const tagSneak = T.events.tag;
  kid.sneak = false; T.reset(); put(0, 0); T.awake = true; T.x = 3; T.z = 0; T._set(2); T.fixedUpdate(DT, kid, true); const boltSeen = T.stateName;
  check('potions: SNEAK: standing hands do not grab (they do once seen); the thief does not bolt from 3 m (it does once seen), a stunned one is still tagged',
    grabSneak === -1 && grabSeen === K && boltSneak !== 'bolt' && boltSeen === 'bolt' && tagSneak > 0, `grab ${grabSneak} / ${grabSeen}, thief ${boltSneak} / ${boltSeen}, tag ${tagSneak}`);
  P.reset(); kid.sneak = false;
}
{ // SWEET TOOTH: the magnet pulls from 7 m (not from 7.6), the reach picks up at 1.2 m (not at 1.3); 12 s
  const at = (d, dy = 0) => { candy.reset(); put(10, 26); return candy.place(kid.x + d, kid.y + 0.35 + dy, kid.z, CANDY_KIND.WRAP); };
  const pulled = (d) => { at(d); candy.update(DT, kid, 0, null); return candy.state[0] === 3; };
  const picked = (d) => { at(0, 0); candy.p[0] = kid.x + d; candy.p[1] = kid.y + 0.35; candy.magnet = 0; let got = 0; candy.update(DT, kid, 0, () => { got++; }); candy.magnet = 2.4; return got === 1; };
  P.reset();
  const off = [pulled(6.5), picked(1.1)];
  P.take(SWEET);
  const on = [pulled(6.5), pulled(7.6), picked(1.15), picked(1.3)];
  let ends = Infinity, t = 0; stepP(13, () => { t += DT; if (P.events.end === SWEET && ends === Infinity) ends = t; });
  check('potions: SWEET TOOTH pulls candy from 7 m (6.5 m: yes, 7.6 m: no) and picks it up at 1.2 m (1.15: yes, 1.3: no) for 12 s, then 2.4 / 0.75 again',
    !off[0] && !off[1] && on[0] && !on[1] && on[2] && !on[3] && near(ends, POTION.SWEET_T, 2 * DT) && candy.boost === 0 && candy.reach === 0.75, JSON.stringify({ off, on, ends: +ends.toFixed(3) }));
  P.reset(); P.take(SNEAK); let sEnd = Infinity; t = 0; stepP(9, () => { t += DT; if (P.events.end === SNEAK && sEnd === Infinity) sEnd = t; });
  check('potions: SNEAK lasts 8 s', near(sEnd, POTION.SNEAK_T, 2 * DT) && !P.sneak, `${sEnd.toFixed(3)} s`);
  candy.reset();
}
{ // one at a time: a second take replaces the first (its effect undone), the pail and the aura take the colour, blink at the end
  P.reset(); P.take(ZOOM); const z = cc.walk;
  P.take(SWEET); const after = { active: P.active, walk: cc.walk, boost: candy.boost, left: P.left };
  P.update(0.016, glows, 0, 1, kid); const col = pail.color.clone(), auraN = P.update(0.016, glows, 0, 1, kid);
  P.left = 0.9; let blinkOff = 0; for (let f = 0; f < 16; f++) { P.left -= 0.05; if (P.update(0.05, glows, 0, f * 0.05, kid) === 0) blinkOff++; }
  P.reset(); P.update(0.016, glows, 0, 1, kid);
  check('potions: a second take replaces the first (ZOOM -> SWEET TOOTH: the run back to 6, the magnet on, 12 s); the pail and an aura take its colour and blink in its last 2 s',
    z === POTION.ZOOM && after.active === SWEET && after.walk === 6 && after.boost === POTION.SWEET_MAG && after.left === POTION.SWEET_T && col.r > col.g && auraN === 1 && blinkOff >= 4 && pail.color.getHex() === 0xffa040,
    JSON.stringify({ ...after, pail: col.getHexString(), auraN, blinkOff }));
  // the brew's light: its glow group's level and tint follow the colour, dark on the cooldown
  P.reset(); P.phase = POTION.CYCLE * 1 + 0.5; world.glowLevels.fill(1); P.update(1, glows, 0, 1, kid);
  const tint = world.glowTint.clone(), lv = world.glowLevels[CAULDRON.brew];
  P.take(SWEET); for (let f = 0; f < 60; f++) { world.glowLevels.fill(1); P.update(0.05, glows, 0, f * 0.05, kid); }
  const darkLv = world.glowLevels[CAULDRON.brew];
  P.reset(); P.phase = POTION.CYCLE * 1 + 0.5; world.glowLevels.fill(1); P.update(1, glows, 0, 1, kid); world.halos(glows, 0);
  const hd = glows.data, h = CAULDRON.brewHalo * 4, halo = [hd[h], hd[h + 1], hd[h + 2]];
  check('potions: the brew glows in the colour showing (violet: the glow group tinted, its halo violet), dimmed while dark', tint.z > tint.y && tint.x > tint.y && lv > 0.9 && darkLv < 0.2 && halo[2] > halo[1] && halo[0] > halo[1],
    JSON.stringify({ tint: tint.toArray().map((v) => +v.toFixed(2)), lv: +lv.toFixed(2), darkLv: +darkLv.toFixed(2), halo: halo.map((v) => +v.toFixed(3)) }));
  world.glowTint.set(1, 1, 1);
  P.reset();
}

// ================================================================ stomp chains
{
  const C = new StompChain();
  const within = [C.stomp(10), C.stomp(10 + 1.2), C.stomp(10 + 2.4), C.stomp(10 + 3.6)];
  const n3 = C.best, chains = C.chains;
  C.reset();
  const outside = [C.stomp(20), C.stomp(20 + CHAIN.WINDOW + 0.05)];
  check('chains: three stomps within 1.6 s of each other pay 7 + 10 + 13 (a fourth 13: the cap); outside the window 7 + 7', within.join() === '7,10,13,13' && n3 === 4 && chains === 1 && outside.join() === '7,7' && C.best === 1 && C.chains === 0,
    `${within.join(' + ')}, best x${n3}; outside ${outside.join(' + ')}`);
}

// ================================================================ the secrets and the fixed pops
const woken = [];
const S = new Secrets({ scene, heightAt, candy, ghosts: { wake: (x, z, r, sp) => { woken.push([sp[0], sp[1]]); return {}; } }, secrets: SECRETS, popSpots: POP_SPOTS, world });
const spills = [];
{
  const sp = candy.spill.bind(candy), dr = candy.drop.bind(candy);
  candy.spill = (x, y, z, n, ...a) => { spills.push(n); return sp(x, y, z, n, ...a); };
  candy.drop = (x, y, z, kind, ...a) => { if (kind === CANDY_KIND.POP) spills.push('pop'); return dr(x, y, z, kind, ...a); };
}
const stepS = (s) => { for (let i = 0; i < Math.round(s / DT); i++) S.fixedUpdate(DT, kid, true); };
{
  candy.reset(); S.reset(); spills.length = 0; woken.length = 0;
  const W = SECRETS.well, D = SECRETS.crypt.door, O = SECRETS.oak.inside;
  const far = S.boo(W.x + 3.2, 0, W.z);
  const w1 = S.boo(W.x + 2.2, 0, W.z), w2 = S.boo(W.x + 2.2, 0, W.z);
  const c1 = S.boo(D[0], 0, D[2] + 1.4), c2 = S.boo(D[0], 0, D[2] + 1.4);
  put(O[0] + 2.5, O[1] + 2.5); stepS(0.2); const outside = S.events.found;
  let o1 = -1; put(O[0], O[1]); stepS(0.05); for (let i = 0; i < 3; i++) { S.fixedUpdate(DT, kid, true); if (S.events.found >= 0) o1 = S.events.found; }
  if (S.has(OAK)) o1 = OAK;
  let o2 = -1; put(O[0] + 2.5, O[1] + 2.5); stepS(0.2); put(O[0], O[1]); for (let i = 0; i < 24; i++) { S.fixedUpdate(DT, kid, true); if (S.events.found >= 0) o2 = S.events.found; }
  const paid = spills.join();
  check('secrets: BOO by the well pays 4 once (not from 3.2 m); BOO at the crypt door pays 12 + a pop and wakes a ghost at it, once; the hollow oak pays 8 + a pop once',
    far === -1 && w1 === WELL && w2 === -1 && c1 === CRYPT && c2 === -1 && outside === -1 && o1 === OAK && o2 === -1 && paid === `${SECRET.WELL},${SECRET.CRYPT},pop,${SECRET.OAK},pop` && woken.length === 1 && Math.hypot(woken[0][0] - D[0], woken[0][1] - D[2]) < 3 && S.count === 3,
    JSON.stringify({ far, w1, w2, c1, c2, o1, o2, paid, woken }));
  // the crypt's door sinks into its plinth (then hidden), the oak's glint goes dark
  for (let f = 0; f < 120; f++) { world.glowLevels.fill(1); S.update(1 / 60, glows, 0, f / 60); }
  check('secrets: the crypt door sinks open (hidden once down), the doorway glows green; the empty oak\'s glint is dark',
    !S.door.visible && S.door.position.y < S.doorY - SECRET.DOOR_DROP + 0.01 && world.glowLevels[SECRETS.crypt.group] > 2 && world.glowLevels[SECRETS.oak.group] === 0, `door y ${S.door.position.y.toFixed(2)} (from ${S.doorY.toFixed(2)})`);
  // the Witching Hour refills the oak: it pays once more; a reset hides them all again
  spills.length = 0; S.setWitch(true); put(O[0] + 2.5, O[1] + 2.5); stepS(0.1); put(O[0], O[1]); stepS(0.1); stepS(0.5);
  const refill = spills.join(); spills.length = 0;
  S.reset(); const again = [S.boo(W.x + 1, 0, W.z), S.boo(D[0], 0, D[2] + 1.4)]; put(O[0], O[1]); stepS(0.05);
  check('secrets: the Witching Hour refills the hollow oak (it pays once more); after a reset each secret pays again', refill === `${SECRET.OAK},pop` && again.join() === `${WELL},${CRYPT}` && S.has(OAK) && S.door.visible === true && S.doorT === 0, `refill ${refill}, again ${again} (oak ${S.has(OAK)})`);
}
{ // the fixed pops: on the knoll's plateau and the Bale Yard's platform, out of the field's count; back 45 s after a take
  candy.reset(); S.reset();
  const at = Array.from(S.popSlot, (i, k) => (i >= 0 ? [candy.kind[i], candy.fixed[i], Math.hypot(candy.p[i * 3] - POP_SPOTS[k][0], candy.p[i * 3 + 2] - POP_SPOTS[k][1]), +(candy.p[i * 3 + 1] - POP_SPOTS[k][2]).toFixed(3)] : null));
  const counted = [candy.restingCount, candy.countKind(CANDY_KIND.POP)];
  candy.state[S.popSlot[1]] = 0; // the Bale Yard's pop taken
  let back = Infinity, t = 0; put(0, 0);
  for (let i = 0; i < 50 / DT; i++) { S.fixedUpdate(DT, kid, true); t += DT; if (S.events.regrow === 1 && back === Infinity) back = t; }
  check('secrets: a fixed pop rests on the knoll\'s plateau and one on the Bale Yard\'s platform (not counted as field candy); a taken one grows back after 45 s',
    at.every((q) => q && q[0] === CANDY_KIND.POP && q[1] > 0 && q[2] < 0.01 && Math.abs(q[3]) < 0.01) && counted.join() === '0,0' && near(back, SECRET.POP_EVERY, 2 * DT) && candy.state[S.popSlot[1]] === 1,
    JSON.stringify({ at, counted, back: +back.toFixed(3) }));
  candy.reset();
}

// ================================================================ Tonight's Patch: the night's seed
{
  const p0 = patchFor('', new Date(2026, 10, 1)), p1 = patchFor('?seed=20261031', new Date(2026, 10, 1)), p2 = patchFor('?x=1&seed=1234', new Date(2026, 10, 1)), p3 = patchFor('?seed=abc', new Date(2026, 10, 1));
  check('patch: tonight\'s seed is the date (20261101, "NOV 1"); ?seed=20261031 is a friend\'s night ("OCT 31"), ?seed=1234 "#1234", a bad one tonight\'s',
    p0.seed === 20261101 && p0.today && p0.label === 'NOV 1' && p1.seed === 20261031 && !p1.today && p1.label === 'OCT 31' && p2.seed === 1234 && p2.label === '#1234' && p3.seed === 20261101,
    JSON.stringify([p0, p1, p2].map((p) => [p.seed, p.label, p.today])));
  // a night as the game lays it out (main.js fillCandy, then the porches and the hands reset): 60 candies, then the
  // porches' next relight jitter and the hands' first waits
  const porches = new Porches({ scene, physics, heightAt, candy, ghosts, world, rnd: rng.porch });
  const hands = new Hands({ scene, heightAt, rnd: rng.hands });
  const night = (seed) => {
    rng.reset(seed); candy.reset();
    for (let i = 0; i < 60; i++) candy.spawnRandom(0, 6, undefined, 3);
    const pos = []; for (let i = 0; i < 60; i++) pos.push(candy.state[i] === 1 ? `${candy.p[i * 3].toFixed(3)},${candy.p[i * 3 + 2].toFixed(3)},${candy.kind[i]}` : '-');
    porches.reset(); hands.reset();
    const jit = []; for (let k = 0; k < 6; k++) jit.push(+(porches._cd(PORCH.CD_TREAT) - PORCH.CD_TREAT).toFixed(4));
    return { pos, jit, hands: Array.from(hands.wait, (v) => +v.toFixed(4)) };
  };
  const a = night(20261101), b = night(20261101), c = night(20261102);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const diffPos = a.pos.filter((v, i) => v !== c.pos[i]).length;
  check('patch: the same seed lays out the same first 60 candies, porch relight jitter and hand cycles; another seed differs in all three',
    same(a, b) && a.pos.every((v) => v !== '-') && diffPos > 55 && !same(a.jit, c.jit) && !same(a.hands, c.hands) && a.jit.every((v) => Math.abs(v) <= PORCH.JITTER) && a.hands.every((v) => v >= 0.5 && v <= HAND.HIDDEN[1]),
    `same ${same(a, b)}, ${diffPos}/60 candies differ, jitter ${a.jit.join(' ')} vs ${c.jit.join(' ')}`);
  candy.reset();
}

// ================================================================ badges and the night's best
{
  mem.clear();
  const book = new BadgeBook();
  const r1 = book.record({ full: false, tricks: 1, caught: 3, chain: 2, tags: 1, secrets: 3, potions: 5 }, 0);
  const r2 = book.record({ full: true, tricks: 3, caught: 0, chain: 3, tags: 2, secrets: 7, potions: 1 }, 1);
  const reload = new BadgeBook(), hadFull = reload.has('full'), hadExplorer = reload.has('explorer'), hadPotions = reload.has('potions');
  const r3 = reload.record({ full: true, tricks: 4, caught: 0, chain: 1, tags: 0, secrets: 7, potions: 7 }, 2);
  check('badges: none for a plain round (one locked badge\'s hint instead); a round earning six names three new ones (the rest still kept)',
    r1.earned.length === 0 && r1.shown.length === 0 && BADGES.some((b) => b[2] === r1.hint) && r2.earned.join() === 'full,trickster,untouchable,chainking,tagger,explorer' && r2.fresh.length === 6 && r2.shown.length === SHOW_NEW && r2.list.filter((b) => b.fresh).length === SHOW_NEW,
    JSON.stringify({ r1: [r1.earned, r1.hint], r2: [r2.earned, r2.shown] }));
  check('badges: they persist on the device (a new book reads them); only a first-time badge is new (Potion Master), the earned ones are listed lit',
    hadFull && hadExplorer && !hadPotions && r3.fresh.join() === 'potions' && r3.shown.join() === 'potions' && r3.list.every((b) => b.on) && r3.hint === '' && JSON.parse(mem.get('midnight-candy-run.badges')).full === 2,
    JSON.stringify({ r3: [r3.earned, r3.fresh], store: mem.get('midnight-candy-run.badges') }));
  check('badges: each one\'s rule (full round, 3 tricks, 0 catches, a x3 chain, 2 tags, every secret, every potion)',
    earnedBy({ full: true, tricks: 2, caught: 1, chain: 2, tags: 1, secrets: 6, potions: 3 }).join() === 'full' && earnedBy({ tricks: 3, caught: 1, chain: 3, tags: 2, secrets: 7, potions: 7 }).join() === 'trickster,chainking,tagger,explorer,potions' && earnedBy({ caught: 0 }).join() === 'untouchable');
  const d1 = saveDaily('20261101', 120), d2 = saveDaily('20261101', 90), d3 = saveDaily('20261102', 50);
  check('badges: the night\'s best is kept per seed (120 beats nothing, 90 does not; another night has its own)', d1.isBest && d1.best === 120 && !d2.isBest && d2.best === 120 && d3.isBest && d3.best === 50 && dailyBest('20261101') === 120 && dailyBest('1') === 0);
  mem.clear(); globalThis.localStorage = undefined;
  const blocked = new BadgeBook().record({ caught: 0 }, 0);
  check('badges: blocked storage keeps nothing and breaks nothing', blocked.earned.join() === 'untouchable' && saveDaily('x', 5).isBest && dailyBest('x') === 0);
}

// ================================================================ allocation: a frame of each, in TurboFan
{
  // (the frame's dt and clock from arrays of boxed numbers: a double computed in the harness and passed to a call it
  // does not inline is boxed by the harness itself, test/helpers/alloc.mjs BOXED)
  const FDT = BOXED(1 / 60), TIMES = BOXED(...Array.from({ length: 64 }, (_, i) => i * 0.37));
  const KX = new Float64Array([CAULDRON.x, CAULDRON.x + 6]), KY = new Float64Array([heightAt(CAULDRON.x, CAULDRON.z + 1.3), heightAt(CAULDRON.x + 6, CAULDRON.z + 1.3)]);
  const O = SECRETS.oak.inside, OX = new Float64Array([O[0], O[0] + 3]), OY = new Float64Array([heightAt(O[0], O[1]), heightAt(O[0] + 3, O[1])]);
  const kp = new THREE.Vector3();
  let f = 0, sink = 0;
  candy.reset(); S.reset(); P.reset();
  const potionsFrame = () => {
    f++;
    const j = (f & 255) < 4 ? 0 : 1; kid.x = KX[j]; kid.z = CAULDRON.z + 1.3; kid.y = KY[j]; kp.set(kid.x, kid.y, kid.z);
    P.fixedUpdate(DT, kid, true); P.fixedUpdate(DT, kid, true);
    if (P.cd > 1) P.cd = 1; // a take every few frames, colours cycling, effects on and off
    sink += P.update(FDT[0], glows, 0, TIMES[f & 63], kp);
  };
  // (the kid by the oak but not in it: a payout's shower is the candy pool's spill(), the one every porch, BOO and
  // catch uses, outside this gate; the crypt door opens and a fixed pop is taken and grows back in the loop)
  const secretsFrame = () => {
    f++;
    kid.x = OX[1]; kid.z = O[1]; kid.y = OY[1];
    if ((f & 127) === 64) { if (S.popSlot[0] >= 0) candy.state[S.popSlot[0]] = 0; S.popT[1] = 0.02; S.opening = true; S.doorT = 0; }
    if ((f & 511) === 0) candy.reset();
    S.fixedUpdate(DT, kid, true); S.fixedUpdate(DT, kid, true);
    sink += S.update(FDT[0], glows, 0, TIMES[f & 63]);
  };
  for (let i = 0; i < 3000; i++) { potionsFrame(); secretsFrame(); }
  const force = [...functionsOf(Potions, Secrets, Candy, Glows), ...functionsOf(THREE)];
  const mp = bytesPerCall((k) => { for (let q = 0; q < k; q++) potionsFrame(); }, 2000, { warm: 2000, budget: 1, force });
  const ms = bytesPerCall((k) => { for (let q = 0; q < k; q++) secretsFrame(); }, 2000, { warm: 2000, budget: 1, force });
  if (ALLOC.ok) {
    check('alloc: a frame of the potions (2 fixed steps + update: takes, the brew, the pail, the aura), TurboFan: 0 B', mp.per <= 1 && mp.control > 1, `${mp.per.toFixed(3)} B / frame, control ${mp.control.toFixed(1)} B`);
    check('alloc: a frame of the secrets (2 fixed steps + update: the oak\'s test, the fixed pops, the crypt door), TurboFan: 0 B', ms.per <= 1 && ms.control > 1, `${ms.per.toFixed(3)} B / frame, control ${ms.control.toFixed(1)} B`);
  }
  results.push(`NOTE  alloc: potions ${describe(mp, 'frame')}`, `NOTE  alloc: secrets ${describe(ms, 'frame')} (sink ${sink > 0})`);
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll Halloween depth checks passed.');
process.exit(failures ? 1 : 0);
