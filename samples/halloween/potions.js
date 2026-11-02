// Potions at the witch's cauldron (DESIGN.md 2.3): the brew cycles colour every CYCLE s, green -> violet -> pink. Walking
// into the cauldron's ring while it glows takes the colour showing (the kid presses against the pot: TAKE_R from its
// centre); the brew then goes dark for CD s, fading back up over its last FADE s. One potion at a time (a new one
// replaces the old). The pail's light and an aura round the kid take the potion's colour and blink in its last BLINK s.
//   ZOOM        green   the run 6 -> ZOOM m/s                                        ZOOM_T s
//   SNEAK       violet  ghosts, grave hands and the thief cannot see the kid (chasers drop to wandering; no grab, no
//                       snatch, no bolting: ghosts.js, hands.js, thief.js read kid.sneak)                      SNEAK_T s
//   SWEET TOOTH pink    the candy magnet -> SWEET_MAG m, the pickup reach 0.75 -> SWEET_REACH m (candy.js)    SWEET_T s
// The effects are applied here (cc.walk, candy.boost / candy.reach) and undone when the potion ends, on reset() and
// on a replacement. Look: no draw of its own; the brew's colour is the glow mesh's tinted light group (world.glowTint:
// the cauldron's brew group, its glow parts and its halo), the aura one Glows slot, the pail the existing point light.
// Module shape (the game's convention): reset(), fixedUpdate(dt, kid, playing) -> events, update(dt, glows, base, t, kid)
// -> glow slots used; plain fields, no allocation per frame.
import * as THREE from 'three';

export const POTION = {
  CYCLE: 3, CD: 30, FADE: 3,                 // s per colour; the brew dark after a take (s), fading up over the last FADE
  R: 1.4, TAKE_R: 1.75,                      // the ring (m); the kid's centre this close to the pot's takes (its capsule on the stones)
  ZOOM: 8.5, ZOOM_T: 8,                      // run speed m/s, s
  SNEAK_T: 8,                                // s
  SWEET_MAG: 7, SWEET_REACH: 1.2, SWEET_T: 12, // magnet m, pickup reach m, s
  BLINK: 2,                                  // the pail and the aura blink in the last BLINK s
};
export const ZOOM = 0, SNEAK = 1, SWEET = 2;
export const POTION_NAMES = ['ZOOM', 'SNEAK', 'SWEET TOOTH'];
/** The call-out that names a potion when it is taken: [text, hud class, the first time's sub-line]. */
export const POTION_CALLS = [['ZOOM!', 'good', 'SUPER SPEED'], ['SNEAK!', 'boo', 'GHOSTS CAN\'T SEE YOU'], ['SWEET TOOTH!', 'thief', 'CANDY MAGNET']];
const DURATION = [POTION.ZOOM_T, POTION.SNEAK_T, POTION.SWEET_T];
// linear colours: the brew / halo / aura / pail (green, violet, pink: the map's potion green and the thief's pink stay apart)
export const POTION_COLORS = [[0.12, 1.0, 0.2], [0.5, 0.16, 1.0], [1.0, 0.2, 0.6]];
const COLORS = POTION_COLORS;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class Potions {
  /**
   * @param {object} o  cauldron ({ x, z, r, brew, brewHalo }: world.js CAULDRON), heightAt, world (glowLevels, glowTint,
   *   glowSpots: the brew's level, colour and halo; optional), cc (the CharacterController: ZOOM), candy (Candy:
   *   SWEET TOOTH), pail (the pail's THREE.PointLight; optional), fx (Effects: the brew's bubbles; optional)
   */
  constructor({ cauldron, heightAt, world = null, cc, candy, pail = null, fx = null }) {
    this.C = cauldron; this.world = world; this.cc = cc; this.candy = candy; this.pail = pail; this.fx = fx;
    this.y = heightAt(cauldron.x, cauldron.z);
    this.baseWalk = cc.walk; this.baseRun = cc.run; this.baseReach = candy.reach;
    this.pailColor = pail ? pail.color.clone() : null; this.pailI = pail ? pail.intensity : 0; this.pailHi = this.pailI * 1.25;
    this.pailColors = COLORS.map((q) => new THREE.Color(q[0], q[1] * 0.9 + 0.1, q[2])); // (copied per frame: no boxed arguments)
    // the brew's base colour (its parts are painted green in the glow mesh): the tint is target / base, per channel
    this.base = new THREE.Color('#5dff6e');
    this.events = { take: -1, end: -1 };
    this.reset();
  }

  /** A new round (or the title): the brew lit on green, no potion, every effect undone. */
  reset() {
    this.phase = 0; this.cd = 0; this.active = -1; this.left = 0; this.taken = 0; this.takes = 0; this.lv = 1; this._shown = 0;
    const E = this.events; E.take = -1; E.end = -1;
    this._apply();
  }

  /** The brew glows (a take is possible). */
  get lit() { return this.cd <= 0; }
  /** The colour showing now (ZOOM / SNEAK / SWEET). */
  get showing() { return Math.floor(this.phase / POTION.CYCLE) % 3; }
  /** SNEAK is on (kid.sneak). */
  get sneak() { return this.active === SNEAK; }

  _apply() {
    const a = this.active, cc = this.cc, C = this.candy;
    cc.walk = a === ZOOM ? POTION.ZOOM : this.baseWalk; cc.run = a === ZOOM ? Math.max(POTION.ZOOM, this.baseRun) : this.baseRun;
    C.boost = a === SWEET ? POTION.SWEET_MAG : 0; C.reach = a === SWEET ? POTION.SWEET_REACH : this.baseReach;
  }

  /** Take potion k now (the ring, or a test): it replaces any other; the brew goes dark. */
  take(k) {
    this.active = k; this.left = DURATION[k]; this.cd = POTION.CD;
    this.taken |= 1 << k; this.takes++; this.events.take = k;
    this._apply();
  }

  /**
   * Fixed step: the colour cycle, the brew's cooldown, the take, the potion's time. kid: { x, y, z }. Fills
   * this.events: take (the potion taken this step or -1), end (the potion that ran out or -1).
   */
  fixedUpdate(dt, kid, playing) {
    const E = this.events;
    E.take = -1; E.end = -1;
    if (this.cd > 0) this.cd = Math.max(0, this.cd - dt);
    else this.phase += dt;
    if (this.active >= 0 && (this.left -= dt) <= 0) { E.end = this.active; this.active = -1; this.left = 0; this._apply(); }
    if (!playing || this.cd > 0) return;
    const dx = kid.x - this.C.x, dz = kid.z - this.C.z;
    if (dx * dx + dz * dz < POTION.TAKE_R * POTION.TAKE_R && kid.y < this.y + 1.6) this.take(this.showing);
  }

  /**
   * Per frame: the brew's level and colour (after the environment wrote its flicker into world.glowLevels), its halo's
   * colour, the pail light and the aura round the kid ({ x, y, z }) into `glows` from slot `base`; returns slots used.
   */
  update(dt, glows, base, t = 0, kid = null) {
    let n = 0;
    // the brew: lit at full, dark on its cooldown (a low simmer), fading back up over the last FADE s
    const goal = this.cd <= 0 ? 1 : 0.1 + 0.9 * smooth(1 - this.cd / POTION.FADE);
    this.lv += (goal - this.lv) * (1 - Math.exp(-6 * dt));
    const k = this.showing, c = COLORS[k], W = this.world;
    if (k !== this._shown) { // a new colour: a puff of bubbles in it
      this._shown = k;
      if (this.fx && this.cd <= 0) this.fx.burst(this.C.x, this.y + 1.3, this.C.z, 10, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, 1.4, 1.6, 0.5, 0.09);
    }
    if (W && this.C.brew >= 0) {
      W.glowLevels[this.C.brew] *= this.lv;
      const b = this.base, T = W.glowTint; // (its halo takes the tint too: world.halos)
      if (T) { T.x = Math.min(8, c[0] / b.r); T.y = Math.min(8, c[1] / b.g); T.z = Math.min(8, c[2] / b.b); }
    }
    // the potion on the kid: the pail's light and an aura in its colour, blinking in its last BLINK s
    const a = this.active, P = this.pail;
    const blink = a >= 0 && this.left < POTION.BLINK && Math.floor(this.left * 8) % 2 === 0;
    if (P) {
      if (a >= 0 && !blink) { P.color.copy(this.pailColors[a]); P.intensity = this.pailHi; }
      else { P.color.copy(this.pailColor); P.intensity = this.pailI; }
    }
    if (a >= 0 && kid && !blink) {
      const q = COLORS[a], f = 0.2 + 0.04 * Math.sin(t * 9);
      glows.set(base + n++, kid.x, kid.y + 0.8, kid.z, 2.1, q[0] * f, q[1] * f, q[2] * f);
    }
    return n;
  }

  /** A snapshot for tests and bots. */
  snapshot() {
    return { lit: this.lit, showing: this.showing, cd: +this.cd.toFixed(2), active: this.active, left: +this.left.toFixed(2), taken: this.taken, takes: this.takes, walk: this.cc.walk, magnet: this.candy.boost, reach: this.candy.reach };
  }
}
