// Grave hands (DESIGN.md 2.4): at ten fixed spots (the graveyard aisle, among the graves, the bridges:
// the map's HAND_SPOTS through hand-spots.js) two bony hands burst out of the soil and grab a kid who runs over them.
//   cycle   hidden HIDDEN s (each spot its own, seeded by `rnd`; the Witching Hour HIDDEN_WITCH) -> the TELL: a soil
//           ring glows crimson, dirt puffs, a crack, the fingertips poke out (0.8 s) -> UP: the hands wave (2.5 s) ->
//           they sink (DOWN s). At most MAX_UP spots tell or stand up at once; the hands wake at START s of a 180 s
//           round (the game sets `awake`).
//   grab    a kid whose feet are under HEIGHT m inside REACH m of standing hands is held HOLD s (the game freezes the
//           controller: cc.hold; the kid wiggles), then released: it costs LOSS candy, spilled around, and the hands
//           go down. No grab while the kid is safe (after a catch), sneaking (a potion, pass 4) or for GRACE s after a
//           release. A grab ALWAYS ends: the hold has a timer, release() (a catch, a BOO, the round's end, a reset)
//           ends it at once, and a fixed step without play releases it.
//   counter JUMP over the hands (feet above HEIGHT), or BOO within BOO_R m: telling or standing hands retract.
// Look: the hands are one instanced mesh (two per spot, bone-pale, a moonlit rim: one draw, drawn only while some are
// out); the ring, its glow and the puffs go through the shared Glows and the effects' sparks (no draw of their own).
// No collider and no physics body: the grab is a distance test. Module shape (the game's convention): reset(),
// fixedUpdate(dt, kid, playing) -> events, update(dt, glows, base, t) -> glow slots used, boo(x, z, r), release();
// typed arrays, no per-frame allocation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Parts } from './props.js';
import { patchRim } from './looks.js';
import { HAND_SPOTS } from './hand-spots.js';

export const HAND = {
  HIDDEN: [7, 12], HIDDEN_WITCH: [3, 6],  // s between appearances (per spot)
  TELL: 0.8, UP: 2.5, DOWN: 0.4,          // the telegraph, standing, sinking (s)
  RISE: 0.18,                             // s out of the soil (the start of UP)
  REACH: 0.9, HEIGHT: 0.6,                // a grab: the kid's centre within REACH m, its feet under HEIGHT m
  HOLD: 1.0, LOSS: 3, GRACE: 1.2,         // held (s), candy lost, no grab after a release (s)
  MAX_UP: 4, START: 40,                   // at most MAX_UP telling / standing; awake from START s (of 180)
  BOO_R: 4,                               // a BOO this close retracts telling / standing hands
  RING: 0.6,                              // the soil ring's radius (m): the hands' 1.2 m footprint
  WAIT: [0.8, 2],                         // s a spot waits when MAX_UP are out already
};
const HIDE = 0, TELL = 1, UP = 2, DOWN = 3;
const SINK = -0.62;                        // the hands' base under the ground while hidden (the tips at -0.07)
const RING_N = 10;                         // glow discs round the ring
const SIZE = 1.3;                          // the hands' scale (0.73 m from the wrist to the tips): they must read at 360 px
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const len2 = (x, z) => Math.sqrt(x * x + z * z); // (Math.hypot boxes its arguments: no allocation per step)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const backOut = (u) => { const c = 1.9; u -= 1; return 1 + (c + 1) * u * u * u + c * u * u; }; // overshoots a little

/**
 * One bony hand reaching up out of the ground: its wrist at the origin, fingers up (+y, the tips at ~0.56 m), the
 * palm toward +z; a forearm of two bones down into the soil (darkened where it comes out of it). Merged, vertex
 * coloured.
 */
function handGeometry() {
  const L = new Parts(), BONE = '#e9dfc6', KNUCKLE = '#d3c6a7', DARK = '#b8a98a';
  const cyl = (r0, r1, h, s = 6) => new THREE.CylinderGeometry(r1, r0, h, s, 1);
  const ball = (r) => new THREE.SphereGeometry(r, 6, 4);
  // forearm: radius and ulna, a little apart, from under the soil to the wrist
  for (const [x, r] of [[-0.022, 0.024], [0.022, 0.02]]) L.add(cyl(r * 1.15, r, 0.42), DARK, x, 0.05, 0);
  L.add(ball(0.04).scale(1.25, 0.8, 0.9), KNUCKLE, 0, 0.27, 0);                    // the wrist
  L.add(new THREE.BoxGeometry(0.105, 0.1, 0.03), BONE, 0, 0.33, 0.004);              // the palm (metacarpals)
  // four fingers, two bones each with a knuckle, fanned and curled forward (toward +z) like a claw
  const F = [[-0.04, 0.072, 0.064, -0.16], [-0.013, 0.082, 0.07, -0.05], [0.014, 0.08, 0.068, 0.05], [0.04, 0.066, 0.058, 0.15]];
  for (const [x, a, b, fan] of F) {
    const k1y = 0.385;
    L.add(ball(0.016), KNUCKLE, x, k1y, 0.004);
    // the first bone, tilted out by `fan` and forward a little; the second curls further
    const c1 = 0.22, x1 = x + Math.sin(fan) * a, y1 = k1y + Math.cos(fan) * Math.cos(c1) * a, z1 = 0.004 + Math.sin(c1) * a;
    L.add(cyl(0.013, 0.011, a), BONE, (x + x1) / 2, (k1y + y1) / 2, (0.004 + z1) / 2, 0, c1, -fan);
    L.add(ball(0.013), KNUCKLE, x1, y1, z1);
    const c2 = 0.62, x2 = x1 + Math.sin(fan) * b, y2 = y1 + Math.cos(fan) * Math.cos(c2) * b, z2 = z1 + Math.sin(c2) * b;
    L.add(cyl(0.011, 0.007, b), BONE, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, 0, c2, -fan);
  }
  // the thumb, out to the side
  L.add(ball(0.017), KNUCKLE, -0.058, 0.32, 0.01);
  L.add(cyl(0.014, 0.009, 0.09), BONE, -0.088, 0.36, 0.03, 0, 0.35, 0.75);
  const list = L.list;
  for (const g of list) {
    g.clearGroups();
    // soil on the bone where it comes out of the ground (and a little up it)
    const P = g.attributes.position.array, C = g.attributes.color.array;
    for (let i = 0; i < P.length; i += 3) { const k = 0.35 + 0.65 * clamp01((P[i + 1] + 0.02) / 0.2); C[i] *= k; C[i + 1] *= k * 0.92; C[i + 2] *= k * 0.82; }
  }
  const g = mergeGeometries(list);
  for (const p of list) p.dispose();
  g.computeBoundingSphere();
  return g;
}

export class Hands {
  /**
   * @param {object} o  scene, heightAt, fx (Effects: dirt puffs; optional), spots ([x, z][]: HAND_SPOTS), rnd (the
   *   hidden times' random stream: Math.random until the daily seed, pass 4)
   */
  constructor({ scene, heightAt, fx = null, spots = HAND_SPOTS, rnd = Math.random }) {
    this.spots = spots; this.fx = fx; this.rnd = rnd;
    const n = this.n = spots.length, f = () => new Float32Array(n);
    this.x = f(); this.z = f(); this.gy = f(); this.yaw = f();
    for (let k = 0; k < n; k++) {
      this.x[k] = spots[k][0]; this.z[k] = spots[k][1]; this.gy[k] = heightAt(spots[k][0], spots[k][1]);
      this.yaw[k] = (k * 2.39996) % (Math.PI * 2); // each spot's hands face their own way (the golden angle)
    }
    this.st = new Uint8Array(n);       // HIDE / TELL / UP / DOWN
    this.t = f();                      // time in the state (s)
    this.wait = f();                   // HIDE: s until the next telegraph
    this.lv = f();                     // the ring's glow (eased)
    this.puffT = f();                  // the next dirt puff (TELL)
    this.inside = new Uint8Array(n); this.air = new Uint8Array(n); this.grabbedIn = new Uint8Array(n); // crossings
    this.awake = false; this.witch = false; this.grace = 0;
    this.holding = -1; this.holdT = 0; this.holdX = 0; this.holdZ = 0; this._released = -1;
    this.events = { tell: -1, rise: -1, grab: -1, release: -1 };
    this.stats = { grabs: 0, crossed: 0, jumped: 0, retracted: 0, tells: 0 };
    // two hands per spot: one instanced mesh, drawn only while some are out (the visible ones packed first)
    // pale bone that reads at night: a self fill (fill), a cool moonlit rim, a warm underlight from the glowing soil
    const mat = patchRim(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0, emissive: '#4a2a1c', emissiveIntensity: 1 }),
      { color: new THREE.Color(0.6, 0.66, 1.0), power: 2.2, share: 0.55, fill: 0.3, key: 'handRim' });
    this.mesh = new THREE.InstancedMesh(handGeometry(), mat, n * 2);
    this.mesh.name = 'graveHands'; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n * 2; i++) this.mesh.setMatrixAt(i, _zero);
    scene.add(this.mesh);
    this.reset();
  }

  _hide(k, witch = this.witch) {
    const H = witch ? HAND.HIDDEN_WITCH : HAND.HIDDEN;
    this.st[k] = HIDE; this.t[k] = 0; this.wait[k] = H[0] + this.rnd() * (H[1] - H[0]);
  }

  /** A new round (or the title): every hand under the soil, asleep; no hold. */
  reset() {
    this.awake = false; this.witch = false; this.grace = 0;
    this.holding = -1; this.holdT = 0; this._released = -1;
    this.lv.fill(0); this.inside.fill(0); this.air.fill(0); this.grabbedIn.fill(0); this.puffT.fill(0);
    // the first appearances spread over the first HIDDEN[1] s after the hands wake (some right away)
    for (let k = 0; k < this.n; k++) { this.st[k] = HIDE; this.t[k] = 0; this.wait[k] = 0.5 + this.rnd() * (HAND.HIDDEN[1] - 0.5); }
    const E = this.events; E.tell = -1; E.rise = -1; E.grab = -1; E.release = -1;
    const S = this.stats; S.grabs = 0; S.crossed = 0; S.jumped = 0; S.retracted = 0; S.tells = 0;
  }

  /** The Witching Hour: the hands cycle twice as fast (a waiting spot's time is cut to the finale's range). */
  setWitch(on) {
    if (on === this.witch) return;
    this.witch = on;
    if (on) for (let k = 0; k < this.n; k++) if (this.st[k] === HIDE) this.wait[k] = Math.min(this.wait[k], HAND.HIDDEN_WITCH[0] + this.rnd() * (HAND.HIDDEN_WITCH[1] - HAND.HIDDEN_WITCH[0]));
  }

  get out() { let c = 0; for (let k = 0; k < this.n; k++) if (this.st[k] === TELL || this.st[k] === UP) c++; return c; }

  /**
   * End a grab now (a catch, a BOO, the round's end): the hands go down; the next fixed step reports it (events.release),
   * so every way out of a grab costs the same. Returns the spot or -1.
   */
  release() {
    const k = this.holding;
    if (k < 0) return -1;
    this.holding = -1; this.holdT = 0; this.grace = HAND.GRACE; this._released = k;
    if (this.st[k] === UP) { this.st[k] = DOWN; this.t[k] = 0; }
    return k;
  }

  /** BOO at (x, z): telling or standing hands within r m retract (and let go). Returns how many. */
  boo(x, z, r = HAND.BOO_R) {
    let c = 0;
    for (let k = 0; k < this.n; k++) {
      const s = this.st[k];
      if ((s !== TELL && s !== UP) || len2(this.x[k] - x, this.z[k] - z) > r) continue;
      if (this.holding === k) this.release();
      this.st[k] = DOWN; this.t[k] = s === TELL ? HAND.DOWN * 0.5 : 0; // a telegraph had only its tips out
      c++;
    }
    this.stats.retracted += c;
    return c;
  }

  /**
   * Fixed step: the cycles, the grab and the hold. kid: { x, y, z (feet), safe, sneak }. Fills this.events: tell /
   * rise (a spot that started telegraphing / rose this step), grab (the spot that grabbed the kid), release (the
   * spot that let go: the game spills the LOSS then), each -1 when nothing happened.
   */
  fixedUpdate(dt, kid, playing) {
    const E = this.events;
    E.tell = -1; E.rise = -1; E.grab = -1;
    if (!playing && this.holding >= 0) this.release();
    E.release = this._released; this._released = -1; // a release() since the last step (a BOO, a catch) or now
    if (this.grace > 0) this.grace -= dt;
    let out = this.out;
    for (let k = 0; k < this.n; k++) {
      this.t[k] += dt;
      const s = this.st[k];
      if (s === HIDE) {
        if (!this.awake || (this.wait[k] -= dt) > 0) continue;
        if (out >= HAND.MAX_UP) { this.wait[k] = HAND.WAIT[0] + this.rnd() * (HAND.WAIT[1] - HAND.WAIT[0]); continue; }
        this.st[k] = TELL; this.t[k] = 0; this.puffT[k] = 0; out++; E.tell = k; this.stats.tells++;
      } else if (s === TELL) {
        if (this.t[k] >= HAND.TELL) { this.st[k] = UP; this.t[k] = 0; E.rise = k; }
      } else if (s === UP) {
        if (this.holding !== k && this.t[k] >= HAND.UP) { this.st[k] = DOWN; this.t[k] = 0; }
      } else if (this.t[k] >= HAND.DOWN) this._hide(k);
    }
    // the hold: frozen for HOLD s, then let go (always)
    if (this.holding >= 0 && (this.holdT -= dt) <= 0) { this.release(); E.release = this._released; this._released = -1; }
    if (!playing) return;
    // crossings (the bots' "jumped over" share) and the grab
    for (let k = 0; k < this.n; k++) {
      const s = this.st[k], d = len2(kid.x - this.x[k], kid.z - this.z[k]), feet = kid.y - this.gy[k];
      const live = s === TELL || s === UP;
      if (d <= HAND.REACH && live) {
        if (!this.inside[k]) { this.inside[k] = 1; this.air[k] = 0; this.grabbedIn[k] = 0; this.stats.crossed++; }
        if (feet >= HAND.HEIGHT) this.air[k] = 1;
      } else if (this.inside[k] && d > HAND.REACH + 0.1) {
        if (this.air[k] && !this.grabbedIn[k]) this.stats.jumped++;
        this.inside[k] = 0;
      }
      if (s !== UP || this.holding >= 0 || this.grace > 0 || kid.safe || kid.sneak) continue;
      if (d <= HAND.REACH && feet < HAND.HEIGHT) {
        this.holding = k; this.holdT = HAND.HOLD; this.holdX = kid.x; this.holdZ = kid.z;
        this.grabbedIn[k] = 1; this.stats.grabs++; E.grab = k;
        if (this.t[k] > HAND.UP - HAND.HOLD) this.t[k] = HAND.UP - HAND.HOLD; // stand for the whole hold
      }
    }
  }

  /**
   * Per frame: the hands' instances (rising, waving, clutching the held kid, sinking) and the ring's glow and puffs
   * into `glows` from slot `base`; returns slots used.
   */
  update(dt, glows, base, t = 0) {
    let n = 0, m = 0;
    const kLv = 1 - Math.exp(-10 * dt), M = this.mesh;
    for (let k = 0; k < this.n; k++) {
      const s = this.st[k], u = this.t[k];
      // the ring's glow: rises through the telegraph (flickering faster toward the rise), steady while standing,
      // pulsing in a grab, gone as they sink
      let goal = 0;
      if (s === TELL) goal = (0.35 + 0.65 * u / HAND.TELL) * (0.75 + 0.25 * Math.sin(t * (18 + 30 * u)));
      else if (s === UP) goal = this.holding === k ? 0.85 + 0.15 * Math.sin(t * 22) : 0.55;
      this.lv[k] += (goal - this.lv[k]) * kLv;
      const L = this.lv[k], x = this.x[k], z = this.z[k], gy = this.gy[k];
      if (L > 0.02) {
        for (let j = 0; j < RING_N; j++) {
          const a = this.yaw[k] + j * (Math.PI * 2 / RING_N), r = HAND.RING * (0.94 + 0.06 * Math.sin(t * 3 + j));
          const f = 0.8 + 0.2 * Math.sin(t * 11 + j * 2.3); // embers along the crack
          glows.set(base + n++, x + Math.cos(a) * r, gy + 0.05, z + Math.sin(a) * r, 0.36, 0.6 * L * f, 0.05 * L * f, 0.02 * L * f);
        }
        glows.set(base + n++, x, gy + 0.08, z, 1.9, 0.22 * L, 0.018 * L, 0.01 * L); // crimson: not a lantern's orange
      }
      // dirt puffs while it tells (dim, low), a burst as the hands break out
      if (this.fx && s === TELL && (this.puffT[k] -= dt) <= 0) {
        this.puffT[k] = 0.16;
        const a = this.yaw[k] + u * 9, r = HAND.RING * 0.8;
        this.fx.burst(x + Math.cos(a) * r, gy + 0.05, z + Math.sin(a) * r, 3, 0.42, 0.27, 0.15, 0.9, 1.2, 0.45, 0.07);
      }
      if (s === HIDE) continue;
      // the hands: out of the soil (backOut), waving, clutching the kid in a grab, back down
      let rise;
      if (s === TELL) rise = 0.1 * clamp01((u - HAND.TELL * 0.45) / (HAND.TELL * 0.55)); // the fingertips poke out
      else if (s === UP) rise = backOut(clamp01(u / HAND.RISE));
      else rise = 1 - clamp01(u / HAND.DOWN) * (1 + 0.1);
      if (rise <= -0.05) { continue; }
      const held = this.holding === k;
      const cx = held ? this.holdX : x, cz = held ? this.holdZ : z;
      for (let h = 0; h < 2; h++) {
        const side = h ? 1 : -1, ph = k * 1.7 + h * 2.1, yaw = this.yaw[k] + (h ? Math.PI * 0.85 : 0);
        const ox = held ? side * 0.3 : side * 0.26, oz = held ? 0 : side * 0.06 - 0.02;
        const c = Math.cos(this.yaw[k]), sn = Math.sin(this.yaw[k]);
        const px = cx + ox * c + oz * sn, pz = cz - ox * sn + oz * c;
        const y = gy + SINK * SIZE * (1 - rise) - (held ? 0.12 : 0);
        let rx = 0.18 + 0.2 * Math.sin(t * 5.3 + ph), rz = 0.35 * Math.sin(t * 7 + ph) * clamp01(rise);
        let hy = yaw;
        if (held) { // clutching the kid's ankles from both sides, shaking
          hy = this.yaw[k] - side * Math.PI / 2; rx = 0.55 + 0.08 * Math.sin(t * 31 + ph); rz = 0.06 * Math.sin(t * 27 + ph);
        }
        if (s === TELL) { rx = 0.1; rz = 0.15 * Math.sin(t * 24 + ph); }
        _q.setFromEuler(_e.set(rx, hy, rz, 'YXZ'));
        const sc = SIZE * (0.94 + 0.1 * h);
        M.setMatrixAt(m++, _m.compose(_p.set(px, y, pz), _q, _s.set(sc, sc, sc)));
      }
    }
    if (m > 0 || M.count > 0) M.instanceMatrix.needsUpdate = true;
    M.count = m; M.visible = m > 0;
    return n;
  }

  /** A snapshot for tests and bots. */
  snapshot() {
    const out = [];
    for (let k = 0; k < this.n; k++) out.push({ x: this.x[k], z: this.z[k], y: +this.gy[k].toFixed(3), st: ['hidden', 'tell', 'up', 'down'][this.st[k]], t: +this.t[k].toFixed(2), wait: +this.wait[k].toFixed(2) });
    return { spots: out, awake: this.awake, witch: this.witch, holding: this.holding, holdT: +this.holdT.toFixed(2), out: this.out, drawn: this.mesh.count, ...this.stats };
  }
}
