// The candy thief (DESIGN.md 2.4): a raccoon in a little bedsheet with eye holes, its loot in a glowing pink sack on
// its back that swells as it fills. It lives in a den (the map's THIEF_DEN, its opening: hand-spots.js) and comes
// out at APPEAR s of a 180 s round (the game sets `awake`).
//   roam    runs at SPEED to the candy the kid is heading for: the best cluster (>= CLUSTER_N resting candies within
//           CLUSTER_R m, >= CLUSTER_KID m from the kid; ahead of the kid's run counts double), else it lurks LURK m off.
//           It is shy of lit porches: it takes no candy within SHY m of a lit porch's mat (a porch's trail stays the
//           kid's breadcrumb to the door)
//   eat     one candy every EAT_T s (gone from the field, into the sack; it stops eating at SACK_MAX)
//   wary    it keeps KEEP m from the kid (its own steps never bring it closer) and bolts (BOLT m/s, zigzagging, BOLT_T s)
//           when the kid comes within NEAR m; cornered, a touch takes TOUCH candy from the kid and it bolts
//   BOO     within the BOO's reach it is stunned STUN s (dizzy, stars); touching it then is a TAG: its whole sack plus
//           TAG_BONUS spill around it, and it runs home (HOME_T s in all) before it comes out again
//   finale  the Witching Hour brings it back at once with WITCH_SACK candies in its sack
// It steers on heightAt and one look-ahead collider probe per fixed step (no physics body), and hops an obstacle it is
// stuck at. Look: one skinned mesh (the kid's rig approach: rigid parts on 13 bones, posed procedurally per frame,
// one draw; the sack's glow is a uniform), a pink halo over the sack and the stun's stars in the shared Glows.
// Module shape (the game's convention): reset(), fixedUpdate(dt, kid, playing) -> events, update(dt, glows, base, t)
// -> glow slots used, boo(x, z, r), setWitch(on); typed state, no per-frame allocation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLAY } from './world.js';
import { paint, place, lathe } from './props.js';
import { patchRim } from './looks.js';
import { THIEF_DEN } from './hand-spots.js';

export const THIEF = {
  APPEAR: 60,                          // s of a 180 s round
  SPEED: 5, BOLT: 6.5, BOLT_T: 2,      // m/s; bolting m/s and s
  KEEP: 6, NEAR: 4,                    // keeps this far from the kid; bolts when the kid comes this close (m)
  EAT_T: 0.5, SACK_MAX: 20,            // s per candy; it stops eating with a full sack
  CLUSTER_N: 3, CLUSTER_R: 5, CLUSTER_KID: 8, CLUSTER_FAR: 34, // a cluster: n resting within r m, >= KID m from the kid, <= FAR
  SHY: 12,                             // m round a lit porch's mat where it takes no candy (the porch's trail)
  AIM: 1,                              // 1: the cluster the kid is running at (ahead counts double); 0: the one nearest to it
  LURK: 12,                            // no cluster: it hangs about this far from the kid
  TOUCH: 5, TOUCH_R: 0.7,              // a cornered thief's touch takes TOUCH candy (m: the touch)
  STUN: 1.8, TAG_R: 1.1, TAG_BONUS: 5, // stunned s; a touch this close tags it; + candy on top of the sack
  HOME_T: 25,                          // s from a tag until it comes out again
  WITCH_SACK: 10,                      // the Witching Hour: back at once with this many in the sack
  EMERGE: 0.7, EAT_R: 0.9,             // s out of the den; a candy this close is eaten
};
const S_AWAY = 0, S_EMERGE = 1, S_ROAM = 2, S_EAT = 3, S_BOLT = 4, S_STUN = 5, S_HOME = 6, S_DEN = 7;
const NAMES = ['away', 'emerge', 'roam', 'eat', 'bolt', 'stun', 'home', 'den'];
const SCALE = 1.55; // the model is bigger than life (a 1.1 m raccoon): it must read at 360 px
const len2 = (x, z) => Math.sqrt(x * x + z * z); // (Math.hypot boxes its arguments: no allocation per step)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const _cols = [];
const TURNS = [0.7, -0.7, 1.3, -1.3, 2.0, -2.0]; // blocked: the turns tried, in order (rad, x the zigzag side)
const PROBE = 0.65, PROBE_R = 0.28; // the look-ahead probe: m ahead, its radius

// ------------------------------------------------------------------ the model (faces +z, feet at y = 0)
// [name, parent, joint position at rest] (model space)
const JOINTS = [
  ['hips', null, [0, 0.27, -0.12]], ['spine', 'hips', [0, 0.28, 0]], ['chest', 'spine', [0, 0.28, 0.1]], ['head', 'chest', [0, 0.33, 0.21]],
  ['tail0', 'hips', [0, 0.3, -0.25]], ['tail1', 'tail0', [0, 0.36, -0.37]], ['tail2', 'tail1', [0, 0.43, -0.47]],
  ['legFL', 'chest', [0.075, 0.2, 0.12]], ['legFR', 'chest', [-0.075, 0.2, 0.12]], ['legBL', 'hips', [0.085, 0.2, -0.15]], ['legBR', 'hips', [-0.085, 0.2, -0.15]],
  ['sack', 'spine', [0, 0.38, -0.08]], ['jaw', 'head', [0, 0.3, 0.33]],
];
const BI = Object.fromEntries(JOINTS.map((j, i) => [j[0], i]));
const JP = Object.fromEntries(JOINTS.map((j) => [j[0], j[2]]));
const COL = { fur: '#6c6574', furDark: '#2c2732', belly: '#a39ba9', mask: '#1d1920', ring: '#1a161e', ringLight: '#c9c1cb', paw: '#1c1820', nose: '#120e14',
  sheet: '#d9d3c8', sheetShade: '#b4ad9f', hole: '#0e0a12', eye: '#fff3c4', sack: '#ff4f9e', sackTie: '#b8236a', ear: '#3a343f' };

/** Tag a part for the skinned mesh: rigid on `bone`, glow (x: always, y: x the sack's level). */
function tag(g, bone, glow = 0, sglow = 0) {
  g.clearGroups();
  const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), gl = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { si[i * 4] = BI[bone]; sw[i * 4] = 1; gl[i * 2] = glow; gl[i * 2 + 1] = sglow; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('glow2', new THREE.Float32BufferAttribute(gl, 2));
  return g;
}
/** Vertex colours shaded by height in the part (darker underneath, lighter on top), a simple fur / cloth gradient. */
function shadeY(g, lo, hi, y0, y1) {
  const P = g.attributes.position.array, C = g.attributes.color.array;
  for (let i = 0; i < P.length; i += 3) { const k = lo + (hi - lo) * clamp((P[i + 1] - y0) / (y1 - y0), 0, 1); C[i] *= k; C[i + 1] *= k; C[i + 2] *= k; }
  return g;
}

function raccoonGeometry() {
  const P = [];
  const add = (g, bone, color, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx, glow = 0, sglow = 0) => { const p = tag(place(paint(g, color), x, y, z, ry, rx, rz, sx, sy, sz), bone, glow, sglow); P.push(p); return p; };
  const ball = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
  // body: a rump and a chest, fur shaded darker underneath... a lighter belly
  shadeY(add(ball(0.13), 'hips', COL.fur, 0, 0.27, -0.11, 0, 0, 0, 1, 0.92, 1.25), 0.62, 1.12, 0.15, 0.38);
  shadeY(add(ball(0.12), 'chest', COL.fur, 0, 0.28, 0.07, 0, 0, 0, 1, 0.94, 1.2), 0.62, 1.12, 0.16, 0.38);
  add(ball(0.09), 'spine', COL.belly, 0, 0.2, -0.02, 0, 0, 0, 1, 0.55, 1.9);
  // legs: dark "gloves", a paw each
  for (const [b, x, z] of [['legFL', 0.075, 0.12], ['legFR', -0.075, 0.12], ['legBL', 0.085, -0.15], ['legBR', -0.085, -0.15]]) {
    add(new THREE.CylinderGeometry(0.036, 0.028, 0.19, 7), b, COL.furDark, x, 0.115, z);
    add(ball(0.034, 8, 5), b, COL.paw, x, 0.022, z + 0.012, 0, 0, 0, 1, 0.6, 1.3);
  }
  // the ringed tail: three fat segments, dark and light rings
  for (const [b, y, z, r, k] of [['tail0', 0.32, -0.3, 0.06, 0], ['tail1', 0.385, -0.41, 0.068, 1], ['tail2', 0.45, -0.52, 0.06, 2]]) {
    const g = add(ball(r, 12, 12), b, COL.ringLight, 0, y, z, 0, -0.55, 0, 1, 1, 1.45);
    const Pp = g.attributes.position.array, C = g.attributes.color.array, dark = new THREE.Color(COL.ring);
    for (let i = 0; i < Pp.length; i += 3) { // two bold rings per segment along its long axis (tilted: z and y together)
      const s = (Pp[i + 2] - z) * 0.84 - (Pp[i + 1] - y) * 0.52;
      if (Math.sin(s * 40 + k * 1.3) > 0 || (k === 2 && s < -0.06)) { C[i] = dark.r; C[i + 1] = dark.g; C[i + 2] = dark.b; }
    }
  }
  // head: the striped snout and the black nose poke out under the sheet's front hem; the sheet hood with two eye holes
  // (their black rims are the raccoon's mask), the ears through it
  add(new THREE.ConeGeometry(0.052, 0.14, 10).rotateX(Math.PI / 2), 'head', COL.belly, 0, 0.29, 0.385, 0, -0.06);
  add(ball(0.024, 8, 6), 'head', COL.nose, 0, 0.296, 0.458);
  add(new THREE.ConeGeometry(0.03, 0.1, 8).rotateX(Math.PI / 2), 'head', COL.mask, 0, 0.306, 0.37, 0, -0.18, 0, 1, 0.45, 1); // the dark stripe up the snout
  add(ball(0.03, 8, 5), 'jaw', COL.belly, 0, 0.268, 0.36, 0, 0, 0, 1.2, 0.6, 1.4);
  const hood = new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
  {
    const Hp = hood.attributes.position.array; // a wavy, flared hem over the shoulders, cut high across the face
    for (let i = 0; i < Hp.length; i += 3) {
      const x = Hp[i], z = Hp[i + 2], a = Math.atan2(z, x), front = clamp(z / 0.1, 0, 1) * clamp(1 - Math.abs(x) / 0.11, 0, 1);
      let y = Math.max(Hp[i + 1], -0.052 + 0.05 * front);
      const hem = clamp((0.04 - y) / 0.09, 0, 1) * (1 - front);
      Hp[i] = x * (1 + 0.35 * hem); Hp[i + 2] = z * (1 + 0.3 * hem) - 0.05 * hem; y -= hem * (0.015 * Math.sin(a * 7) + 0.02); Hp[i + 1] = y;
    }
    hood.computeVertexNormals();
  }
  shadeY(add(hood, 'head', COL.sheet, 0, 0.335, 0.235, 0, 0, 0, 1, 1.05, 1.05), 0.74, 1.08, 0.26, 0.47);
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.035, 0.085, 6), 'head', COL.ear, s * 0.07, 0.465, 0.215, 0, -0.15, -s * 0.35);
    // an eye hole: a dark oval on the hood's front, an eye shining in it
    add(new THREE.CircleGeometry(0.031, 12), 'head', COL.hole, s * 0.046, 0.362, 0.37, s * 0.33, -0.18, 0, 1, 1.2, 1);
    add(ball(0.012, 8, 6), 'head', COL.eye, s * 0.045, 0.362, 0.373, 0, 0, 0, 1, 1, 0.6, 1.6);
  }
  // the sack on its back: a pink bulb tied at the top (its glow follows the loot: uSack)
  add(lathe([[0, -0.11], [0.08, -0.105], [0.125, -0.06], [0.135, 0.0], [0.115, 0.06], [0.065, 0.1], [0.032, 0.12], [0.04, 0.15], [0.0, 0.16]], 14), 'sack', COL.sack, 0, 0.47, -0.08, 0, 0, 0, 1, 1, 1, 0.12, 1);
  add(new THREE.TorusGeometry(0.036, 0.012, 5, 12).rotateX(Math.PI / 2), 'sack', COL.sackTie, 0, 0.592, -0.08, 0, 0, 0, 1, 1, 1, 0, 0.4);
  // the strap round its middle that holds the sack
  add(new THREE.TorusGeometry(0.125, 0.012, 5, 16).rotateY(Math.PI / 2), 'spine', COL.sackTie, 0, 0.27, -0.03, 0, 0, 0, 1, 1.02, 1);
  for (const g of P) { if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1'); }
  const g = mergeGeometries(P);
  for (const p of P) p.dispose();
  return g;
}

/** Vertex glow (glow2.x) plus the sack's glow (glow2.y x uSack.x) as emissive, in the one draw. */
function thiefMaterial(uSack) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, emissive: '#140d18', emissiveIntensity: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSackHw = uSack;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 glow2;\nvarying vec2 vGlow2Hw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGlow2Hw = glow2;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGlow2Hw;\nuniform vec2 uSackHw;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * ( vGlow2Hw.x + vGlow2Hw.y * uSackHw.x );');
  };
  mat.customProgramCacheKey = () => 'hwThief';
  return patchRim(mat, { color: new THREE.Color(0.42, 0.45, 0.85), power: 2.6, share: 0.3, fill: 0.07, key: 'thiefRim' });
}

export class Thief {
  /**
   * @param {object} o  scene, heightAt, physics (PhysicsWorld: the look-ahead probe), candy (Candy: what it eats), fx
   *   (Effects: sparkles; optional), den ([x, z]), porches (Porches: it is shy of the lit ones; optional)
   */
  constructor({ scene, heightAt, physics, candy, fx = null, den = THIEF_DEN, porches = null }) {
    this.heightAt = heightAt; this.physics = physics; this.candy = candy; this.fx = fx; this.porches = porches;
    this.denX = den[0]; this.denZ = den[1]; this.denY = heightAt(den[0], den[1]); this._px = 0; this._pz = 0;
    // the model: one skinned mesh under a group placed per frame
    const bones = [], by = {};
    for (const [name, parent, p] of JOINTS) {
      const b = new THREE.Bone(); b.name = name;
      const pp = parent ? JP[parent] : [0, 0, 0];
      b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
      if (parent) by[parent].add(b);
      bones.push(b); by[name] = b;
    }
    this.bones = by;
    this.rest = Object.fromEntries(JOINTS.map(([n]) => [n, by[n].position.clone()]));
    this.uSack = { value: new THREE.Vector2(0.3, 0) }; // (a vector: a plain { value: number } field stores a boxed double)
    const mesh = this.skinned = new THREE.SkinnedMesh(raccoonGeometry(), thiefMaterial(this.uSack));
    mesh.name = 'thief'; mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.add(bones[0]); mesh.bind(new THREE.Skeleton(bones));
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.3, -0.05), 0.75); // the posed model stays inside
    mesh.scale.setScalar(SCALE);
    this.root = new THREE.Group(); this.root.name = 'thiefRoot'; this.root.add(mesh); this.root.visible = false;
    scene.add(this.root);
    this.events = { appear: false, eat: 0, steal: false, bolt: false, tag: 0, home: false };
    this.tags = 0; this.eaten = 0; this.stuns = 0; this.steals = 0;
    this.reset();
  }

  /** A new round (or the title): in its den, not yet out, an empty sack. */
  reset() {
    this.state = S_AWAY; this.t = 0; this.awake = false; this.witch = false;
    this.x = this.denX; this.z = this.denZ; this.y = this.heightAt(this.x, this.z); this.vx = 0; this.vz = 0; this.yaw = 0;
    this.sack = 0; this.target = -1; this.tx = this.x; this.tz = this.z; this.retarget = 0; this.eatT = 0; this.boltT = 0; this.zigT = 0; this.zig = 1;
    this.homeT = 0; this.stunT = 0; this.hop = 0; this.lastX = this.x; this.lastZ = this.z; this.progT = 0;
    this.ph = 0; this.nibble = 0; this.bounce = 0; this.minKid = Infinity;
    this.tags = 0; this.eaten = 0; this.stuns = 0; this.steals = 0;
    const E = this.events; E.appear = false; E.eat = 0; E.steal = false; E.bolt = false; E.tag = 0; E.home = false;
    this.root.visible = false;
  }

  /** Out of its den and in play (not home, not hidden). */
  get out() { return this.state >= S_EMERGE && this.state <= S_STUN; }
  /** Stunnable / taggable by a BOO now. */
  get catchable() { return this.state === S_ROAM || this.state === S_EAT || this.state === S_BOLT; }
  get stateName() { return NAMES[this.state]; }

  _set(s) { this.state = s; this.t = 0; }
  _emerge() { this.x = this.denX; this.z = this.denZ; this.y = this.denY; this.vx = this.vz = 0; this._set(S_EMERGE); this.events.appear = true; this.retarget = 0; }

  /** The Witching Hour: back at once (from the den or on its way home) with at least WITCH_SACK in the sack. */
  setWitch(on) {
    if (on === this.witch) return;
    this.witch = on;
    if (!on) return;
    this.sack = Math.max(this.sack, THIEF.WITCH_SACK);
    if (this.state === S_DEN || this.state === S_HOME || this.state === S_AWAY) { this.awake = true; this._emerge(); }
  }

  /** BOO at (x, z): within r it is stunned STUN s. Returns true when it was. */
  boo(x, z, r) {
    if (!this.catchable || len2(this.x - x, this.z - z) > r) return false;
    this._set(S_STUN); this.stunT = THIEF.STUN; this.vx = this.vz = 0; this.stuns++;
    return true;
  }

  /** (x, z) within SHY m of a lit porch's mat (its trail): not the thief's. */
  _shy(x, z) {
    const P = this.porches;
    if (!P) return false;
    for (let k = 0; k < P.n; k++) {
      if (P.st[k] === 2) continue; // dark: no trail to keep
      const M = P.spots[k].mat, dx = x - M.x, dz = z - M.z;
      if (dx * dx + dz * dz < THIEF.SHY * THIEF.SHY) return true;
    }
    return false;
  }

  /** The kid's run gives away where it is heading: the best cluster (see the header), or -1. */
  _pickCluster(kid) {
    const C = this.candy, P = C.p, ST = C.state, K = C.kind, n = ST.length;
    const kv = len2(kid.vx, kid.vz), hx = kv > 1 ? kid.vx / kv : 0, hz = kv > 1 ? kid.vz / kv : 0;
    const R2 = THIEF.CLUSTER_R * THIEF.CLUSTER_R;
    let best = -1, bs = Infinity;
    for (let i = 0; i < n; i++) {
      if (ST[i] !== 1 || K[i] === 2) continue;
      const x = P[i * 3], z = P[i * 3 + 2], dx = x - kid.x, dz = z - kid.z, dk = len2(dx, dz);
      if (dk < THIEF.CLUSTER_KID || dk > THIEF.CLUSTER_FAR || this._shy(x, z)) continue;
      let c = 0;
      for (let j = 0; j < n && c < THIEF.CLUSTER_N; j++) {
        if (ST[j] !== 1 || K[j] === 2) continue;
        const ex = P[j * 3] - x, ez = P[j * 3 + 2] - z;
        if (ex * ex + ez * ez <= R2) c++;
      }
      if (c < THIEF.CLUSTER_N) continue;
      const ahead = (dx * hx + dz * hz) / dk, dt = len2(x - this.x, z - this.z);
      const sc = (1 - THIEF.AIM) * dt + THIEF.AIM * (dk * (1.2 - 0.6 * ahead) + 0.3 * dt);
      if (sc < bs) { bs = sc; best = i; }
    }
    return best;
  }

  /** The nearest resting candy (not a pop) within EAT_R m of the thief (far: CLUSTER_R m), or -1. */
  _nearCandy(far) {
    const C = this.candy, P = C.p, ST = C.state, K = C.kind, r = far ? THIEF.CLUSTER_R : THIEF.EAT_R;
    let best = -1, bd = r * r;
    for (let i = 0; i < ST.length; i++) {
      if (ST[i] !== 1 || K[i] === 2) continue;
      const dx = P[i * 3] - this.x, dz = P[i * 3 + 2] - this.z, d2 = dx * dx + dz * dz;
      if (d2 < bd && !this._shy(P[i * 3], P[i * 3 + 2])) { bd = d2; best = i; }
    }
    return best;
  }

  /** Is there a tall collider round the probe point (_px, _pz) (low steps, the paths' kerbs do not count)? */
  _blocked() {
    _cols.length = 0;
    const c = this.physics.queryColliders(this._px, this._pz, PROBE_R, _cols), top = this.y + 0.35;
    for (let i = 0; i < c.length; i++) if (c[i].maxY === undefined || c[i].maxY > top) return true;
    return false;
  }

  /**
   * Fixed step: the state machine, steering, eating, the kid's touches. kid: { x, y, z, vx, vz, safe, sneak }.
   * Fills this.events: appear (it came out), eat (candies eaten this step), steal (a cornered touch: the game takes
   * TOUCH candy and calls stole(n)), bolt (it started to bolt from the kid), tag (> 0: the candies a tag spills, the
   * sack + TAG_BONUS), home (it reached its den). (A stun is the return value of boo().)
   */
  fixedUpdate(dt, kid, playing) {
    const E = this.events;
    E.appear = false; E.eat = 0; E.steal = false; E.bolt = false; E.tag = 0; E.home = false;
    this.t += dt;
    if (this.state === S_AWAY) { if (this.awake && playing) this._emerge(); return; }
    if (this.state === S_DEN) {
      if ((this.homeT -= dt) <= 0 && playing) { if (this.witch) this.sack = Math.max(this.sack, THIEF.WITCH_SACK); this._emerge(); }
      return;
    }
    const dkx = this.x - kid.x, dkz = this.z - kid.z, dk = len2(dkx, dkz) || 1e-3;
    const sees = playing && !kid.sneak;
    if (sees && dk < this.minKid) this.minKid = dk;
    let wantX = 0, wantZ = 0, speed = 0, accel = 14;
    switch (this.state) {
      case S_EMERGE: if (this.t >= THIEF.EMERGE) this._set(S_ROAM); break;
      case S_ROAM: case S_EAT: {
        if (sees && dk < THIEF.NEAR) { // the kid too close: it bolts (cornered, so the kid touched it: it snatches first)
          if (dk < THIEF.TOUCH_R && !kid.safe) { E.steal = true; this.steals++; }
          this._bolt(); E.bolt = true; break;
        }
        if (this.state === S_ROAM) {
          if ((this.retarget -= dt) <= 0) {
            this.retarget = 0.5;
            this.target = this.sack < THIEF.SACK_MAX && playing ? this._pickCluster(kid) : -1;
            if (this.target < 0) { // lurk LURK m from the kid, on its own side
              const lim = PLAY - 3;
              this.tx = clamp(kid.x + dkx / dk * THIEF.LURK, -lim, lim); this.tz = clamp(kid.z + dkz / dk * THIEF.LURK, -lim, lim);
            }
          }
          const C = this.candy;
          if (this.target >= 0 && C.state[this.target] !== 1) { this.target = -1; this.retarget = 0; }
          if (this.target >= 0) { this.tx = C.p[this.target * 3]; this.tz = C.p[this.target * 3 + 2]; }
          const ex = this.tx - this.x, ez = this.tz - this.z, el = len2(ex, ez);
          if (this.target >= 0 && el < THIEF.EAT_R) { this._set(S_EAT); this.eatT = THIEF.EAT_T * 0.6; break; }
          if (el > 0.6) { wantX = ex / el; wantZ = ez / el; speed = THIEF.SPEED * Math.min(1, el / 2 + 0.3); }
        } else { // eating: one every EAT_T s, stepping to the next one in the cluster
          if (this.sack >= THIEF.SACK_MAX) { this._set(S_ROAM); break; }
          const near = this._nearCandy(false), next = near >= 0 ? near : this._nearCandy(true);
          if (next < 0) { this._set(S_ROAM); this.retarget = 0; break; }
          if (near >= 0 && (this.eatT += dt) >= THIEF.EAT_T) {
            this.eatT = 0; this.candy.state[near] = 0; this.sack++; this.eaten++; E.eat++; this.nibble = 0.35; this.bounce = 0.2;
            if (this.fx) { const P = this.candy.p; this.fx.burst(P[near * 3], P[near * 3 + 1] + 0.35, P[near * 3 + 2], 7, 1.6, 0.35, 0.9, 1.4, 1.2, 0.4, 0.08); }
          } else if (near < 0) {
            const P = this.candy.p, ex = P[next * 3] - this.x, ez = P[next * 3 + 2] - this.z, el = len2(ex, ez) || 1;
            wantX = ex / el; wantZ = ez / el; speed = 3;
          }
        }
        // wary: backs away from a kid inside KEEP (+ a margin)
        if (sees && dk < THIEF.KEEP + 1) {
          const k = clamp((THIEF.KEEP + 1 - dk) / 1.5, 0, 1);
          wantX = wantX * (1 - k) + dkx / dk * k; wantZ = wantZ * (1 - k) + dkz / dk * k;
          speed = Math.max(speed, THIEF.SPEED * k);
          if (this.state === S_EAT && dk < THIEF.KEEP) this._set(S_ROAM);
        }
        break;
      }
      case S_BOLT: {
        if ((this.boltT -= dt) <= 0) { this._set(S_ROAM); this.retarget = 0; break; }
        if ((this.zigT -= dt) <= 0) { this.zigT = 0.32 + Math.random() * 0.12; this.zig = -this.zig; }
        const a = Math.atan2(dkz, dkx) + this.zig * 0.55;
        wantX = Math.cos(a); wantZ = Math.sin(a); speed = THIEF.BOLT; accel = 22;
        break;
      }
      case S_STUN: if ((this.stunT -= dt) <= 0) { this._bolt(); E.bolt = true; } break;
      case S_HOME: {
        const ex = this.denX - this.x, ez = this.denZ - this.z, el = len2(ex, ez);
        if (el < 0.6) { this._set(S_DEN); E.home = true; this.root.visible = false; this.vx = this.vz = 0; return; }
        wantX = ex / el; wantZ = ez / el; speed = THIEF.SPEED;
        this.homeT -= dt;
        break;
      }
      default: break;
    }
    // a touch while it is stunned tags it (a cornered one's touch is above: it snatches; a bolting one only flees)
    if (sees && this.state === S_STUN && dk < THIEF.TAG_R) {
      E.tag = this.sack + THIEF.TAG_BONUS; this.sack = 0; this.tags++;
      this._set(S_HOME); this.homeT = THIEF.HOME_T; this.vx = this.vz = 0;
    }
    // steering: one look-ahead probe; blocked, it tries turning either way, then hops whatever it is stuck at
    if (speed > 0 && this.hop <= 0) {
      this._px = this.x + wantX * PROBE; this._pz = this.z + wantZ * PROBE;
      if (this._blocked()) {
        let found = false;
        for (let j = 0; j < TURNS.length; j++) {
          const s = this.zig * TURNS[j], c = Math.cos(s), sn = Math.sin(s), qx = wantX * c - wantZ * sn, qz = wantX * sn + wantZ * c;
          this._px = this.x + qx * PROBE; this._pz = this.z + qz * PROBE;
          if (!this._blocked()) { wantX = qx; wantZ = qz; found = true; break; }
        }
        if (!found) this.progT += dt; // nowhere to turn: hop sooner
      }
    }
    // no progress for a while (a corner, a fence): it hops over (a short arc; no probe meanwhile)
    if ((this.progT += dt) >= 0.8) {
      const moved = len2(this.x - this.lastX, this.z - this.lastZ);
      if (speed > 1 && moved < 0.5 && this.hop <= 0) { this.hop = 0.55; }
      this.progT = 0; this.lastX = this.x; this.lastZ = this.z;
    }
    if (this.hop > 0) this.hop = Math.max(0, this.hop - dt);
    const k = 1 - Math.exp(-accel * dt);
    this.vx += (wantX * speed - this.vx) * k; this.vz += (wantZ * speed - this.vz) * k;
    if (this.state === S_STUN || this.state === S_EMERGE) { this.vx = 0; this.vz = 0; }
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    // its own steps never bring it inside KEEP of the kid (unless it bolts or goes home)
    if (sees && (this.state === S_ROAM || this.state === S_EAT)) {
      const ex = nx - kid.x, ez = nz - kid.z, nd = len2(ex, ez);
      if (nd < THIEF.KEEP && nd < dk) { const s = dk / Math.max(nd, 1e-3); nx = kid.x + ex * s; nz = kid.z + ez * s; }
    }
    const lim = PLAY - 1.2;
    this.x = clamp(nx, -lim, lim); this.z = clamp(nz, -lim, lim); // (its ground height: per frame, update())
    const sp = len2(this.vx, this.vz);
    if (sp > 0.3) this.yaw += wrapPi(Math.atan2(this.vx, this.vz) - this.yaw) * (1 - Math.exp(-12 * dt));
    else if (this.state === S_EAT || this.state === S_ROAM) this.yaw += wrapPi(Math.atan2(-dkx, -dkz) - this.yaw) * (1 - Math.exp(-3 * dt)); // eyes on the kid
  }

  _bolt() { this._set(S_BOLT); this.boltT = THIEF.BOLT_T; this.zigT = 0; this.target = -1; }

  /** A cornered touch took n candies from the kid: into the sack. */
  stole(n) { this.sack += n; this.bounce = 0.25; }

  /**
   * Per frame: the pose (run cycle, nibbling, dizzy sway, the den's pop out), the sack's size and glow, its halo and
   * the stun's stars into `glows` from slot `base`; returns slots used. cam (optional, a Vector3): the halo grows with
   * the distance (up to 2x at 28 m), so a thief across the field still shows as a pink spark on a phone.
   */
  update(dt, glows, base, t = 0, cam = null) {
    const st = this.state, R = this.root;
    const on = st !== S_AWAY && st !== S_DEN;
    R.visible = on;
    if (!on) return 0;
    this.y = this.heightAt(this.x, this.z); // the ground under it (once a frame)
    const B = this.bones, rest = this.rest, sp = len2(this.vx, this.vz);
    let n = 0;
    // the den: it pops up out of the ground
    const em = st === S_EMERGE ? clamp(this.t / THIEF.EMERGE, 0, 1) : 1;
    const hopY = this.hop > 0 ? Math.sin((1 - this.hop / 0.55) * Math.PI) * 0.9 : 0;
    R.position.set(this.x, this.y - 0.35 * (1 - em) + hopY, this.z);
    R.rotation.y = this.yaw;
    R.scale.setScalar(0.4 + 0.6 * em);
    // the run: a bounding gallop, the legs in pairs, the body pitching, the tail streaming
    const run = clamp(sp / THIEF.SPEED, 0, 1.3);
    this.ph += dt * (4 + 10 * run);
    const ph = this.ph, sw = 0.85 * Math.min(1, run);
    B.legFL.rotation.x = Math.sin(ph) * sw; B.legFR.rotation.x = Math.sin(ph + 0.5) * sw;
    B.legBL.rotation.x = Math.sin(ph + Math.PI) * sw; B.legBR.rotation.x = Math.sin(ph + Math.PI + 0.5) * sw;
    B.hips.position.y = rest.hips.y + Math.abs(Math.sin(ph)) * 0.035 * run;
    B.hips.rotation.set(Math.sin(ph * 2) * 0.06 * run, 0, 0);
    B.chest.rotation.set(0, 0, 0); B.head.rotation.set(-0.05 * run, 0, 0); B.jaw.rotation.x = 0;
    B.tail0.rotation.set(-0.25 - 0.2 * run, 0, 0);
    B.tail1.rotation.set(-0.1 * run, Math.sin(t * 5 + 0.5) * 0.35, 0);
    B.tail2.rotation.set(-0.05, Math.sin(t * 5 + 1.4) * 0.45, 0);
    if (st === S_EAT || this.nibble > 0) { // nibbling: head down, the jaw going
      this.nibble = Math.max(0, this.nibble - dt);
      B.chest.rotation.x = 0.18; B.head.rotation.x = 0.55 + 0.12 * Math.sin(t * 16); B.jaw.rotation.x = 0.2 + 0.2 * Math.sin(t * 22);
    }
    if (st === S_STUN) { // dizzy: swaying, the head going round
      B.hips.rotation.z = Math.sin(t * 5) * 0.22; B.chest.rotation.z = Math.sin(t * 5 + 0.6) * 0.15;
      B.head.rotation.set(0.15 + Math.cos(t * 7) * 0.25, Math.sin(t * 7) * 0.4, Math.sin(t * 7) * 0.25);
      B.tail1.rotation.y = 0; B.tail2.rotation.y = 0; B.tail0.rotation.x = 0.35; // the tail droops
    }
    // the sack: swells with the loot, bounces on each candy, wobbles on the run
    const fill = clamp(this.sack / THIEF.SACK_MAX, 0, 1.25);
    this.bounce = Math.max(0, this.bounce - dt);
    const s = 0.55 + 0.6 * fill + Math.sin(this.bounce * 40) * this.bounce * 0.6;
    B.sack.scale.set(s, s * (1 + 0.05 * Math.sin(ph * 2) * run), s);
    B.sack.position.y = rest.sack.y + 0.03 * (s - 1);
    B.sack.rotation.set(0.1 * Math.sin(ph * 2) * run, 0, 0.12 * Math.sin(ph) * run);
    this.uSack.value.x = 0.3 + 0.6 * fill;
    // its halo: a pink beacon over the sack (stronger with more in it)
    const c = Math.cos(this.yaw), sn = Math.sin(this.yaw), sk = SCALE * (0.4 + 0.6 * em);
    const hx = this.x - sn * 0.08 * sk, hz = this.z - c * 0.08 * sk, hy = R.position.y + (0.47 + 0.05 * s) * sk;
    const a = 0.12 + 0.2 * fill, far = cam ? 1 + clamp((len2(this.x - cam.x, this.z - cam.z) - 7) / 21, 0, 1) : 1;
    glows.set(base + n++, hx, hy, hz, (1.0 + 0.8 * s) * far, a * 1.0, a * 0.22, a * 0.6);
    if (st === S_STUN) { // three stars circling over its head
      const fx = this.x + sn * 0.24 * sk, fz = this.z + c * 0.24 * sk, fy = R.position.y + 0.78 * sk;
      for (let j = 0; j < 3; j++) {
        const w = t * 6 + j * 2.094, r = 0.2;
        glows.set(base + n++, fx + Math.cos(w) * r * sk, fy + Math.sin(w * 2) * 0.04, fz + Math.sin(w) * r * sk, 0.5 * far, 1.1, 0.9, 0.22);
      }
    }
    return n;
  }

  /** A snapshot for tests and bots. */
  snapshot() {
    return { state: NAMES[this.state], x: +this.x.toFixed(2), z: +this.z.toFixed(2), sack: this.sack, target: this.target, homeT: +this.homeT.toFixed(2), stunT: +this.stunT.toFixed(2),
      tags: this.tags, eaten: this.eaten, stuns: this.stuns, steals: this.steals, minKid: +this.minKid.toFixed(2), visible: this.root.visible, awake: this.awake, witch: this.witch };
  }
}
