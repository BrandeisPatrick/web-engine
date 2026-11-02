// The village's secrets and its fixed big pops (DESIGN.md 2.3, 2.5, 3.4, 3.5). No markers: each is found by playing.
//   the well       BOO within R m of it: an echo ("boo... oo... oo") and WELL candies fly up out of it
//   the crypt      BOO within R m of its door (the green crack under it is the only tell): the door sinks into the
//                  plinth, CRYPT candies and a big pop spill out of the dark doorway, and a ghost rises in front of it
//   the hollow oak walk into its hollow (the faint glint inside): OAK candies and a pop tumble out round the kid; the
//                  Witching Hour refills it (the glint comes back)
// The well and the crypt pay once a round; the oak once, and once more after its refill. Fixed pops: one big pop rests
// on each POP_SPOTS spot (the knoll's plateau, the Bale Yard's platform: the climb is the price) and grows back
// POP_EVERY s after it is taken (candy.js `fixed`: they are not the roaming pop, its edge marker or its cap).
// Look: the crypt's door is its own small mesh (one draw while in view; the map's crypt is built without its leaf, a
// dark doorway behind it); the crack's and the glint's levels go into world.glowLevels (after the environment's flicker);
// the open doorway's green light is one Glows slot. Module shape (the game's convention): reset(), fixedUpdate(dt, kid,
// playing) -> events, update(dt, glows, base, t) -> glow slots used, boo(x, y, z), setWitch(on); no allocation per frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Parts, chamferBox } from './props.js';
import { CANDY_KIND } from './candy.js';

export const SECRET = {
  R: 3,                          // a BOO this close to the well / the crypt's door finds it (m)
  WELL: 4, CRYPT: 12, OAK: 8,    // candies (the crypt and the oak add a big pop)
  OAK_R: 0.85,                   // the kid's centre this close to the hollow's middle: inside
  POP_EVERY: 45,                 // s until a taken fixed pop grows back
  DOOR_T: 1.4, DOOR_DROP: 2.5,   // the crypt door sinking: s, m
};
export const WELL = 0, CRYPT = 1, OAK = 2;
export const SECRET_NAMES = ['THE WELL', 'THE CRYPT', 'THE HOLLOW OAK'];
/** The call-out when one is found: [text, hud class] (short: they fit a 360 px phone). */
export const SECRET_CALLS = [['BOO… OO… OO…', 'boo'], ['CRYPT OPENS!', 'good'], ['HOLLOW OAK!', 'good']];
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The crypt's banded iron door leaf (1.6 x 2.38 m, its foot at the origin, the front face toward +z). */
function doorGeometry() {
  const L = new Parts(), IRON = '#141017', BAND = '#2c2832';
  L.add(new THREE.BoxGeometry(1.58, 2.38, 0.1), IRON, 0, 1.19, 0);
  for (const yy of [0.39, 1.14, 1.89]) L.add(new THREE.BoxGeometry(1.6, 0.07, 0.04), BAND, 0, yy, 0.07);
  L.add(new THREE.BoxGeometry(0.04, 2.4, 0.04), BAND, 0, 1.19, 0.07);
  for (const sx of [-0.18, 0.18]) L.add(new THREE.TorusGeometry(0.07, 0.014, 4, 10), '#3b3540', sx, 0.99, 0.09);
  L.add(chamferBox(0.16, 0.16, 0.05, 0.01), '#2a2530', 0, 1.3, 0.07); // the lock plate
  for (const g of L.list) { g.clearGroups(); if (g.attributes.uv) g.deleteAttribute('uv'); }
  const g = mergeGeometries(L.list);
  for (const p of L.list) p.dispose();
  g.computeBoundingSphere();
  return g;
}

export class Secrets {
  /**
   * @param {object} o  scene, heightAt, candy (Candy), ghosts (Ghosts: the crypt's ghost; optional), secrets (world.js
   *   SECRETS), popSpots (world.js POP_SPOTS: [x, z, y]), world (glowLevels: the crack's and the glint's levels;
   *   optional), fx (Effects: dust, sparkles; optional)
   */
  constructor({ scene, heightAt, candy, ghosts = null, secrets, popSpots = [], world = null, fx = null }) {
    this.S = secrets; this.candy = candy; this.ghosts = ghosts; this.world = world; this.fx = fx; this.heightAt = heightAt;
    this.popSpots = popSpots;
    const D = secrets.crypt.door; // [x, the crypt's floor + 0.6, z (the door's front face)]: the leaf's foot is 0.02 above that
    this.doorX = D[0]; this.doorY = D[1] + 0.02; this.doorZ = D[2] - 0.05;
    this.wellY = heightAt(secrets.well.x, secrets.well.z);
    this.oakY = heightAt(secrets.oak.inside[0], secrets.oak.inside[1]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.35 });
    this.door = new THREE.Mesh(doorGeometry(), mat);
    this.door.name = 'cryptDoor'; this.door.castShadow = false; this.door.receiveShadow = true;
    this.door.position.set(this.doorX, this.doorY, this.doorZ);
    scene.add(this.door);
    this.popSlot = new Int16Array(popSpots.length).fill(-1); this.popT = new Float32Array(popSpots.length);
    this.events = { found: -1, value: 0, regrow: -1 };
    this.reset();
  }

  /** A new round (or the title): every secret hidden again, the crypt shut, the oak full, a pop on each fixed spot. */
  reset() {
    this.found = 0; this.finds = 0; this.oakFull = true; this.oakTaken = 0; this.doorT = 0; this.opening = false; this.witch = false;
    this.door.position.y = this.doorY; this.door.visible = true;
    const E = this.events; E.found = -1; E.value = 0; E.regrow = -1;
    this.popSlot.fill(-1); this.popT.fill(0);
    for (let k = 0; k < this.popSpots.length; k++) this._grow(k);
  }

  /** Found secret k this round (WELL / CRYPT / OAK). */
  has(k) { return (this.found & (1 << k)) !== 0; }
  /** Distinct secrets found this round. */
  get count() { let n = 0; for (let k = 0; k < 3; k++) if (this.has(k)) n++; return n; }

  _grow(k) {
    const s = this.popSpots[k];
    if (!s || s[2] === undefined) return;
    this.popSlot[k] = this.candy.place(s[0], s[2], s[1], CANDY_KIND.POP, k + 1);
  }

  /** n candies out of (x, y, z), fanned round the bearing `yaw` (three.js: toward (sin, cos)): out of a doorway, not into its walls. */
  _shower(x, y, z, n, speed, yaw) {
    const C = this.candy;
    C.spill(x, y, z, n, 0, 0.45, 18);
    const P = C.p, V = C.v;
    for (let i = 0, m = 0; i < C.state.length && m < n; i++) {
      if (C.state[i] !== 2 || C.age[i] !== 0 || P[i * 3] !== x || P[i * 3 + 2] !== z) continue;
      const a = yaw + (Math.random() * 2 - 1) * 0.9, sp = speed * (0.55 + Math.random() * 0.6);
      V[i * 3] = Math.sin(a) * sp; V[i * 3 + 2] = Math.cos(a) * sp; m++;
    }
  }

  _find(k, value) {
    if (!this.has(k)) this.finds++;
    this.found |= 1 << k;
    this.events.found = k; this.events.value = value;
  }

  /** BOO at the kid's feet (x, y, z): the well or the crypt's door within R m pays (once a round). Returns which or -1. */
  boo(x, y, z) {
    const S = this.S, C = this.candy, R2 = SECRET.R * SECRET.R;
    const wx = x - S.well.x, wz = z - S.well.z;
    if (!this.has(WELL) && wx * wx + wz * wz <= R2) {
      C.spill(S.well.x, this.wellY + 1.1, S.well.z, SECRET.WELL, 2.6, 0.35, 16);
      if (this.fx) this.fx.burst(S.well.x, this.wellY + 1.1, S.well.z, 18, 0.5, 0.7, 1.2, 2.2, 3, 0.7, 0.1);
      this._find(WELL, SECRET.WELL);
      return WELL;
    }
    const cx = x - this.doorX, cz = z - this.doorZ;
    if (!this.has(CRYPT) && cx * cx + cz * cz <= R2) {
      this.opening = true;
      const oy = this.doorY + 0.8, oz = this.doorZ + 0.6;
      this._shower(this.doorX, oy, oz, SECRET.CRYPT, 3.2, 0); // out of the doorway (+z)
      // (the pop and the ghost to the sides of the doorway: a pop's beam or a rising sheet between the camera and the
      // door washed the moment out on a phone)
      C.drop(this.doorX - 1.5, this.heightAt(this.doorX - 1.5, oz + 0.9), oz + 0.9, CANDY_KIND.POP, 1.2, 30);
      if (this.fx) { this.fx.burst(this.doorX, this.doorY + 0.4, oz, 30, 0.4, 0.36, 0.32, 2.4, 1.2, 1.1, 0.16); this.fx.flash(this.doorX, oy, oz, 2.6, 0.1, 0.55, 0.22, 0.45); }
      if (this.ghosts) { const sp = this._ghostSpot || (this._ghostSpot = [0, 0]); sp[0] = this.doorX + 2.8; sp[1] = this.doorZ - 0.3; this.ghosts.wake(x, z, Math.random, sp); }
      this._find(CRYPT, SECRET.CRYPT + 5);
      return CRYPT;
    }
    return -1;
  }

  /** The Witching Hour: the hollow oak refills (its glint comes back). */
  setWitch(on) {
    if (on === this.witch) return;
    this.witch = on;
    if (on) this.oakFull = true;
  }

  /**
   * Fixed step: the hollow oak (the kid inside it while it is full), the fixed pops growing back. kid: { x, y, z }.
   * Fills this.events: found (the secret found this step or -1; value: the candy it is worth), regrow (a fixed pop's
   * spot that grew back or -1). (The well and the crypt are found by boo().)
   */
  fixedUpdate(dt, kid, playing) {
    const E = this.events, C = this.candy;
    E.found = -1; E.value = 0; E.regrow = -1;
    for (let k = 0; k < this.popSlot.length; k++) {
      const i = this.popSlot[k];
      if (i >= 0 && C.state[i] !== 0 && C.fixed[i] === k + 1) continue; // still there
      if (i >= 0) { this.popSlot[k] = -1; this.popT[k] = SECRET.POP_EVERY; } // taken: it grows back later
      if ((this.popT[k] -= dt) <= 0) { this._grow(k); if (this.popSlot[k] >= 0) E.regrow = k; }
    }
    if (!playing || !this.oakFull) return;
    const O = this.S.oak.inside, dx = kid.x - O[0], dz = kid.z - O[1];
    if (dx * dx + dz * dz < SECRET.OAK_R * SECRET.OAK_R && kid.y < this.oakY + 1) {
      this.oakFull = false; this.oakTaken++;
      this._shower(O[0], this.oakY + 0.9, O[1], SECRET.OAK, 2.2, Math.PI / 4); // toward its opening (south-east)
      C.drop(O[0] + 0.25, this.oakY, O[1] + 0.25, CANDY_KIND.POP, 1.4, 30);
      if (this.fx) this.fx.burst(O[0], this.oakY + 1, O[1], 26, 1.6, 1.2, 0.4, 2, 2.4, 0.8, 0.1);
      this._find(OAK, SECRET.OAK + 5);
    }
  }

  /**
   * Per frame: the crypt's door sinking, the crack's and the glint's levels (after the environment's flicker), the open
   * doorway's green light into `glows` from slot `base`; returns slots used.
   */
  update(dt, glows, base, t = 0) {
    let n = 0;
    const W = this.world, S = this.S, D = this.door;
    if (this.opening && this.doorT < 1) {
      this.doorT = Math.min(1, this.doorT + dt / SECRET.DOOR_T);
      const u = smooth(this.doorT);
      D.position.set(this.doorX + (this.doorT < 1 ? Math.sin(t * 60) * 0.012 : 0), this.doorY - SECRET.DOOR_DROP * u, this.doorZ);
      D.visible = this.doorT < 1;
      if (this.fx && Math.floor(this.doorT * 12) !== Math.floor((this.doorT - dt / SECRET.DOOR_T) * 12)) this.fx.burst(this.doorX + (Math.random() - 0.5) * 1.4, this.doorY + 0.3, this.doorZ + 0.3, 4, 0.35, 0.32, 0.3, 1.2, 0.8, 0.8, 0.12);
    }
    if (W) {
      if (S.crypt.group > 0) W.glowLevels[S.crypt.group] *= 1 + 1.2 * this.doorT; // the green light pours out as it opens
      if (S.oak.group > 0) W.glowLevels[S.oak.group] *= this.oakFull ? 1 : 0;
    }
    if (this.doorT > 0) {
      const f = this.doorT * (0.85 + 0.15 * Math.sin(t * 2.3));
      glows.set(base + n++, this.doorX, this.doorY + 1.2, this.doorZ + 0.3, 2.6, 0.02 * f, 0.17 * f, 0.07 * f);
    }
    return n;
  }

  /** A snapshot for tests and bots. */
  snapshot() {
    return { found: this.found, count: this.count, oakFull: this.oakFull, oakTaken: this.oakTaken, door: +this.doorT.toFixed(2), pops: Array.from(this.popSlot), popT: Array.from(this.popT, (v) => +v.toFixed(1)) };
  }
}
