// Bedsheet ghosts: each one is an XPBD cloth (Cloth.grid on the shared DynamicsWorld) whose centre disc is attached
// to a kinematic "head" sphere at anchors laid on its dome, so the rest of the sheet hangs, trails and flutters as the
// head moves. The head is steered by a small state machine:
//   dormant (under its grave, hidden) -> rise (out of the ground) -> wander <-> chase -> (caught the kid) retreat,
//   any awake state -> flee (BOO!) -> wander.
// A ghost that just caught the kid, was booed, or chased for CHASE_MAX s without catching stays calm (wanders, no chase)
// for a few seconds, and after a catch the other ghosts within CALM_R calm down too (CALM_NEAR, backing off; the
// farther ones for CALM_FAR, a little longer than the kid's safety), so the round has breathing room between attacks
// instead of one long pile-on (a pack used to catch a cornered kid again every time its 2 s of safety ran out).
// At most `maxChasers` ghosts chase at once (the game sets 2 on phones); the others wait their turn HOLD_R m from the
// kid (closer, a freed chase slot would start a chase from point-blank range). A "tame" ghost (g.tame > 0 s, the
// game's BOO lesson) chases from any distance but slowly (TAME_SPEED) and cannot catch; a BOO or its time ends it.
// Every ghost exists (and is simulated) for the whole round; waking one teleports its head and its whole cloth
// (positions and previous positions, so no velocity) to a grave. The face (eyes, mouth) is painted in the cloth
// texture where the dome's front lands in UV. Ghosts pass through everything (head layer 0) and cast no shadow.
// Look: a cold inner glow, a cyan moonlit rim (looks.js patchRim), a cute face (big glossy eyes, blush, one of five
// mouths) painted at twice the texel density of the rest through a radial uv warp, a round sheet with a scalloped hem
// (shared alpha map), pinned on a dome a little taller than the head sphere, drawn as a smooth 2x subdivided surface.
import * as THREE from 'three';
import { Cloth, Shapes } from '@vibe/engine/physics';
import { ClothMesh, makeCanvas } from '@vibe/engine/render';
import { PLAY } from './world.js';
import { patchRim } from './looks.js';

const FLAT = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // grid normal (local +Z) -> world +Y; grid +Y -> world -Z (the face)
const HEAD_R = 0.32, PIN_THETA = 1.62, SHEET = 2.15, HOVER = 1.55;
const FACE_ARC = 0.41; // m along the sheet from the crown to the middle of the face (eyes ~0.34, mouth ~0.49)
// pacing (s): calm after a catch / a BOO / a chase given up; how long a chase lasts before the ghost gives up
const CALM_CAUGHT = 5, CALM_NEAR = 5, CALM_R = 14, CALM_FAR = 4.5, CALM_BOO = 3, CALM_GIVEUP = 3.5, CHASE_MAX = 8, TAME_SPEED = 2.4, HOLD_R = 9;
// a ghost fades out when it comes this close to the camera (m): a sheet over the lens hides the whole view. It keeps
// CAM_FLOOR of its opacity, so one chasing in from behind the camera still shows as a veil (it used to keep 0.08)
const CAM_FADE0 = 1.4, CAM_FADE1 = 3.6, CAM_FLOOR = 0.25;
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _sph = new THREE.Sphere(new THREE.Vector3(), 2.4); // a sheet's reach round its head
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// The sheet's texture is drawn in a WARPED uv space: radially, the middle of the sheet (the head and the face, uv
// radius < W_R0) gets W_M times the texels of the rest, so a 512 px texture draws a crisp face (the shader samples the
// map and emissive map through the same warp, hwWarp; the hem's alpha map is radial and stays unwarped).
const W_R0 = 0.25, W_M = 1.8, W_OUT = (Math.SQRT1_2 - W_R0 * W_M) / (Math.SQRT1_2 - W_R0);
const DOME_Y = 1.2; // the pins sit on a dome this much taller than the head sphere: a rounder, taller ghost head

function ghostTexture(n) {
  const S = 512, c = makeCanvas(S), g = c.getContext('2d'), C = S / 2;
  // a soft moonlit sheet: bright on the head, a cool blue toward the hem
  const bg = g.createRadialGradient(C, C, 0, C, C, S * 0.72);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.45, '#f4f6ff'); bg.addColorStop(0.75, '#dfe5ff'); bg.addColorStop(1, '#c9d2ff');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  // folds radiating from the crown (texture space: radial lines stay radial under the warp)
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + Math.sin(k * 3.7) * 0.08, w = 2 + (k % 3);
    g.strokeStyle = `rgba(140,152,215,${0.1 + 0.08 * (k % 2)})`; g.lineWidth = w;
    g.beginPath(); g.moveTo(C + Math.cos(a) * S * 0.24, C + Math.sin(a) * S * 0.24); g.lineTo(C + Math.cos(a) * S * 0.7, C + Math.sin(a) * S * 0.7); g.stroke();
  }
  // the face, drawn in viewer metres (x right, y up as seen from the front, origin between the eyes and the mouth):
  // on the sheet the face's front lands at v > 0.5, mirrored and upside down, hence the transform
  const k = (W_M * S) / SHEET, fy = C - (W_M * S * FACE_ARC) / SHEET;
  g.setTransform(-k, 0, 0, k, C, fy);
  const ell = (x, y, rx, ry, rot, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
  const INK = '#160c26', TONGUE = '#ff7d9b';
  for (const s of [-1, 1]) {
    ell(s * 0.175, -0.025, 0.042, 0.022, 0, 'rgba(255,128,165,0.6)');              // blush
    ell(s * 0.115, 0.06, 0.044, 0.064, s * 0.12, INK);                            // big oval eyes
    ell(s * 0.115 + s * 0.015, 0.082, 0.016, 0.018, 0, '#ffffff');                // catchlights
    ell(s * 0.115 - s * 0.012, 0.036, 0.007, 0.007, 0, '#ffffff');
  }
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 0.011;
  const mouth = n % 5;
  if (mouth === 0) { // a little open 'o', tongue at the bottom
    ell(0, -0.065, 0.026, 0.032, 0, INK); ell(0, -0.08, 0.016, 0.012, 0, TONGUE);
  } else if (mouth === 1) { // a wide happy open smile with a tongue
    g.fillStyle = INK; g.beginPath(); g.moveTo(-0.05, -0.045); g.quadraticCurveTo(0, -0.055, 0.05, -0.045); g.quadraticCurveTo(0.045, -0.105, 0, -0.108); g.quadraticCurveTo(-0.045, -0.105, -0.05, -0.045); g.fill();
    ell(0, -0.09, 0.024, 0.014, 0, TONGUE);
  } else if (mouth === 2) { // a cat 'w'
    g.beginPath(); g.moveTo(-0.045, -0.05); g.quadraticCurveTo(-0.022, -0.085, 0, -0.055); g.quadraticCurveTo(0.022, -0.085, 0.045, -0.05); g.stroke();
  } else if (mouth === 3) { // a wobbly nervous mouth
    g.beginPath(); for (let i = 0; i <= 12; i++) { const x = -0.045 + (i / 12) * 0.09, y = -0.065 + Math.sin(i * 1.6) * 0.008; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  } else { // a cheeky smile, tongue out
    g.beginPath(); g.moveTo(-0.045, -0.052); g.quadraticCurveTo(0, -0.09, 0.045, -0.052); g.stroke();
    g.fillStyle = TONGUE; g.beginPath(); g.moveTo(0.004, -0.07); g.quadraticCurveTo(0.008, -0.11, 0.026, -0.1); g.quadraticCurveTo(0.034, -0.08, 0.03, -0.062); g.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let _hem = null;
/** Shared alpha map (unwarped uv): a round sheet with a scalloped hem (soft edged), nothing beyond it. */
function hemTexture() {
  if (_hem) return _hem;
  const S = 256, c = makeCanvas(S), g = c.getContext('2d'), C = S / 2;
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const rim = (a) => S * (0.455 + 0.028 * Math.cos(a * 7) + 0.008 * Math.sin(a * 13 + 1));
  for (const [grow, col] of [[0, '#5a5a5a'], [-4, '#b0b0b0'], [-8, '#ffffff']]) {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i <= 140; i++) { const a = (i / 140) * Math.PI * 2, r = rim(a) + grow; if (i) g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); else g.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  _hem = new THREE.CanvasTexture(c);
  _hem.colorSpace = THREE.NoColorSpace;
  return _hem;
}

/** Map + emissive map sampled through the sheet's uv warp (see ghostTexture). */
function patchWarp(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
vec2 hwWarp( vec2 uv ) {
  vec2 d = uv - 0.5; float r = length( d );
  float t = r < ${W_R0.toFixed(3)} ? r * ${W_M.toFixed(3)} : ${(W_R0 * W_M).toFixed(4)} + ( r - ${W_R0.toFixed(3)} ) * ${W_OUT.toFixed(4)};
  return 0.5 + d * ( t / max( r, 1e-5 ) );
}`)
      .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'texture2D( map, hwWarp( vMapUv ) )'))
      .replace('#include <emissivemap_fragment>', THREE.ShaderChunk.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', 'texture2D( emissiveMap, hwWarp( vEmissiveMapUv ) )'));
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|hwWarp`;
  return mat;
}

export class Ghosts {
  /**
   * @param {object} o  scene, dyn (DynamicsWorld with particles), heightAt, spawns ([x, z][]), count, grid (particles per
   *   side), cloth (mass / shear / bend), light (false: true adds the one point light that follows the ghost nearest the
   *   camera)
   */
  constructor({ scene, dyn, heightAt, spawns, count = 6, grid = 13, cloth: co = {}, light = false }) {
    this.dyn = dyn; this.heightAt = heightAt; this.spawns = spawns;
    // light: one real point light (cold blue) that follows the awake ghost nearest the camera, so a ghost casts its
    // glow on the grass, the stones and the kid (always in the scene: a light count change would recompile shaders)
    this.light = null; this._lk = 0;
    if (light) {
      this.light = new THREE.PointLight(0x9fb8ff, 0, 7.5, 1.6);
      this.light.name = 'ghostLight'; this.light.position.set(0, -50, 0);
      scene.add(this.light);
    }
    this.list = [];
    this.time = 0;
    this.difficulty = 0; // 0..1 over the round: chase speed and aggro radius
    this.maxChasers = Infinity; // how many may chase at once
    this.witch = false; this._wk = 0; // the Witching Hour: auras (and a little of the inner glow) ease to orange
    const sp = SHEET / (grid - 1), half = (grid - 1) / 2;
    for (let k = 0; k < count; k++) {
      const px = -200 - k * 8, py = -30, pz = -200;  // parked far below the level until woken
      const head = dyn.addBody({ type: 'kinematic', shape: Shapes.sphere(HEAD_R), position: [px, py, pz], layer: 0, mask: 0 });
      const pins = [];
      for (let j = 0; j < grid; j++) {
        for (let i = 0; i < grid; i++) {
          const u = (i - half) * sp, w = (j - half) * sp, d = Math.hypot(u, w), th = d / HEAD_R;
          if (th > PIN_THETA) continue;
          const s = d > 1e-9 ? Math.sin(th) * HEAD_R / d : 0;
          pins.push({ i, j, body: head, anchor: [u * s, Math.cos(th) * HEAD_R * DOME_Y, -w * s] });
        }
      }
      const cloth = Cloth.grid(dyn, {
        nx: grid, ny: grid, spacing: sp, position: [px, py + HEAD_R, pz], quaternion: FLAT, mass: co.mass ?? 0.8,
        stretch: 0, shear: co.shear ?? 0.02, bend: co.bend ?? 0.25, radius: sp * 0.3, pins,
      });
      const tex = ghostTexture(k);
      // a moonlit sheet: soft shading in the folds, a cold glow from within, a cyan rim, the hem fading into wisps
      const mat = patchRim(patchWarp(new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, alphaMap: hemTexture(), color: '#f2f4ff', emissive: '#9fb2ff', emissiveIntensity: 0.42, roughness: 0.8, metalness: 0,
        side: THREE.DoubleSide, transparent: true, opacity: 0.86, depthWrite: true, alphaTest: 0.04,
      })), { color: new THREE.Color(0.35, 0.6, 1.1), power: 2.2, share: 0.6, key: 'ghostRim' });
      // drawn as a 2x finer Catmull-Rom surface through the particles (render/SoftMeshes.js `subdivide`): soft folds, no facets
      const cm = new ClothMesh(dyn.particles, cloth, mat, { subdivide: 2 });
      cm.mesh.castShadow = false; cm.mesh.receiveShadow = false; cm.mesh.renderOrder = 3; cm.mesh.visible = false;
      scene.add(cm.mesh);
      this.list.push({
        k, head, cloth, mesh: cm, mat, state: 'dormant', t: 0, x: px, y: py, z: pz, vx: 0, vz: 0, yaw: 0, lean: 0,
        tx: 0, tz: 0, retarget: 0, lunge: 0, lungeCd: 0, phase: k * 1.7, scared: 0, alpha: 0, spawnI: 0, calm: 0, tame: 0,
        restX: px, restY: py, restZ: pz,
      });
    }
    this.events = { caught: -1, chaseStart: -1, scaredCount: 0 };
  }

  /** Pre-simulate the parked sheets so they start draped (call once after construction). */
  settle(steps = 150, dt = 1 / 120) {
    for (let i = 0; i < steps; i++) { for (const g of this.list) this._target(g); this.dyn.step(dt); }
    for (const g of this.list) { g.mesh.capture(); g.mesh.capture(); }
  }

  /** Teleport a ghost (head + every cloth particle, no velocity) so its head is at (x, y, z). */
  _teleport(g, x, y, z) {
    const P = this.dyn.particles, ids = g.cloth.ids, dx = x - g.x, dy = y - g.y, dz = z - g.z;
    for (let n = 0; n < ids.length; n++) {
      const p = ids[n] * 3;
      P.pos[p] += dx; P.pos[p + 1] += dy; P.pos[p + 2] += dz;
      P.prevPos[p] = P.pos[p]; P.prevPos[p + 1] = P.pos[p + 1]; P.prevPos[p + 2] = P.pos[p + 2];
      P.vel[p] = P.vel[p + 1] = P.vel[p + 2] = 0;
    }
    g.x = x; g.y = y; g.z = z; g.vx = g.vz = 0;
    _q.setFromEuler(_e.set(0, g.yaw, 0, 'YXZ'));
    this.dyn.setPose(g.head, x, y, z, _q.x, _q.y, _q.z, _q.w);
    g.mesh.capture(); g.mesh.capture();
  }

  /** Every ghost back under the level (round reset). */
  reset() {
    this.difficulty = 0; this.witch = false; this._wk = 0;
    this._lk = 0; if (this.light) this.light.intensity = 0;
    for (const g of this.list) {
      g.state = 'dormant'; g.t = 0; g.scared = 0; g.alpha = 0; g.lunge = 0; g.lungeCd = 0; g.yaw = 0; g.lean = 0; g.calm = 0; g.tame = 0;
      this._teleport(g, g.restX, g.restY, g.restZ);
      g.mesh.mesh.visible = false;
    }
  }

  get awake() { let n = 0; for (const g of this.list) if (g.state !== 'dormant') n++; return n; }

  /** Wake the next dormant ghost at a grave away from the kid (px, pz), or out of the ground at `spot` ([x, z]). */
  wake(px, pz, rnd = Math.random, spot = null) {
    const g = this.list.find((q) => q.state === 'dormant');
    if (!g) return null;
    // a grave 14..35 m from the kid; none in reach (the kid is across the map): out of the ground 18..24 m away
    let best = spot, bd = Infinity;
    for (let t = 0; t < 16 && !best; t++) {
      const sp = this.spawns[Math.floor(rnd() * this.spawns.length)], d = Math.hypot(sp[0] - px, sp[1] - pz);
      if (d >= 14 && d <= 35 && Math.abs(d - 22) < bd) { bd = Math.abs(d - 22); best = sp; }
    }
    if (!best) {
      const a = Math.atan2(-pz, -px) + (rnd() - 0.5) * 2, r = 18 + rnd() * 6, lim = PLAY - 4; // toward the middle
      best = this._spot || (this._spot = [0, 0]);
      best[0] = Math.max(-lim, Math.min(lim, px + Math.cos(a) * r)); best[1] = Math.max(-lim, Math.min(lim, pz + Math.sin(a) * r));
    }
    const x = best[0], z = best[1] + 0.9, y = this.heightAt(x, z) - 1.2;
    g.yaw = Math.atan2(-(px - x), -(pz - z));
    this._teleport(g, x, y, z);
    g.state = 'rise'; g.t = 0; g.alpha = 0; g.calm = 0; g.tame = 0; g.mesh.mesh.visible = true;
    g.tx = x; g.tz = z;
    return g;
  }

  /**
   * A resident (porches.js, a trick): the next dormant ghost drops from (x, y, z) (a chimney), else the nearest wandering
   * one turns where it is; it chases at once (calm 0). It takes a chase slot: past maxChasers, the farthest older chaser
   * goes back to wandering. Returns the ghost or null.
   */
  summon(x, y, z) {
    let g = this.list.find((q) => q.state === 'dormant'), d = Infinity, far = null, fd = -1, n = 0;
    if (g) { this._teleport(g, x, y, z); g.alpha = 1; g.mesh.mesh.visible = true; }
    else for (const q of this.list) { const e = Math.hypot(q.x - x, q.z - z); if (q.state === 'wander' && e < d) { d = e; g = q; } }
    if (!g) return null;
    g.state = 'chase'; g.t = 0; g.calm = 0; g.tame = 0; g.scared = 0;
    for (const q of this.list) if (q.state === 'chase') { n++; const e = Math.hypot(q.x - x, q.z - z); if (q !== g && q.t > 1 && e > fd) { fd = e; far = q; } }
    if (n > this.maxChasers && far) { far.state = 'wander'; far.t = 0; far.retarget = 0; }
    return g;
  }

  /** BOO at (x, z): every awake ghost within r flees. Returns the ghosts scared (in this.scaredList). */
  boo(x, z, r) {
    const out = this.scaredList || (this.scaredList = []);
    out.length = 0;
    for (const g of this.list) {
      if (g.state === 'dormant' || g.state === 'rise') continue;
      const d = Math.hypot(g.x - x, g.z - z);
      if (d > r) continue;
      g.state = 'flee'; g.t = 0; g.scared = 1; g.tame = 0;
      const k = 1 / Math.max(d, 0.1), dx = (g.x - x) * k, dz = (g.z - z) * k;
      g.vx = dx * 9; g.vz = dz * 9;
      out.push(g);
    }
    return out;
  }

  _target(g) {
    _q.setFromEuler(_e.set(-g.lean, g.yaw, Math.sin(this.time * 1.3 + g.phase) * 0.06, 'YXZ'));
    this.dyn.setKinematicTarget(g.head, g.x, g.y, g.z, _q.x, _q.y, _q.z, _q.w);
  }

  /**
   * Fixed step (before dyn.step): AI + head targets. kid: { x, y, z, vx, vz, safe (invulnerable) }.
   * Fills this.events: caught (ghost index or -1), chaseStart (index or -1).
   */
  fixedUpdate(dt, kid, active) {
    this.time += dt;
    const E = this.events; E.caught = -1; E.chaseStart = -1;
    const L = this.list, D = this.difficulty;
    const chaseSpeed = 3.2 + 1.5 * D, aggro = 10 + 5 * D;
    let chasing = 0;
    for (let n = 0; n < L.length; n++) if (L[n].state === 'chase') chasing++;
    for (let n = 0; n < L.length; n++) {
      const g = L[n];
      if (g.state === 'dormant') continue;
      g.t += dt;
      let wantX = 0, wantZ = 0, speed = 0, accel = 3;
      const dx = kid.x - g.x, dz = kid.z - g.z, dist = Math.hypot(dx, dz);
      g.scared = Math.max(0, g.scared - dt * 0.5);
      if (g.lungeCd > 0) g.lungeCd -= dt;
      if (g.calm > 0) g.calm -= dt;
      if (g.tame > 0) g.tame -= dt;
      switch (g.state) {
        case 'rise': {
          const ground = this.heightAt(g.x, g.z), u = Math.min(1, g.t / 1.5);
          g.y = ground - 1.2 + (HOVER + 1.2) * (1 - (1 - u) * (1 - u));
          g.alpha = u;
          if (u >= 1) { g.state = 'wander'; g.t = 0; g.retarget = 0; }
          break;
        }
        case 'wander': {
          g.retarget -= dt;
          if (g.retarget <= 0 || (g.tx - g.x) ** 2 + (g.tz - g.z) ** 2 < 2) {
            const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 9;
            g.tx = Math.max(-PLAY + 4, Math.min(PLAY - 4, g.x + Math.cos(a) * r));
            g.tz = Math.max(-PLAY + 4, Math.min(PLAY - 4, g.z + Math.sin(a) * r));
            // drift toward the kid a little, so the round stays lively (a calm ghost backs off instead)
            if (active) { const w = g.calm > 0 ? -0.35 : 0.45; g.tx += (kid.x - g.tx) * w; g.tz += (kid.z - g.tz) * w; }
            g.retarget = 4 + Math.random() * 4;
          }
          const ex = g.tx - g.x, ez = g.tz - g.z, el = Math.hypot(ex, ez) || 1;
          wantX = ex / el; wantZ = ez / el; speed = 1.8 + 0.8 * D;
          if (active && !kid.safe && g.calm <= 0 && (dist < aggro || g.tame > 0)) {
            if (chasing < this.maxChasers) { g.state = 'chase'; g.t = 0; E.chaseStart = n; chasing++; }
            else if (dist < HOLD_R) { const k = HOLD_R / Math.max(dist, 0.1); g.tx = kid.x - dx * k; g.tz = kid.z - dz * k; g.retarget = 1; }
          }
          break;
        }
        case 'chase': {
          const lead = Math.min(0.6, dist / 8);
          const cx = kid.x + kid.vx * lead - g.x, cz = kid.z + kid.vz * lead - g.z, cl = Math.hypot(cx, cz) || 1;
          wantX = cx / cl; wantZ = cz / cl; speed = g.tame > 0 ? TAME_SPEED : chaseSpeed; accel = 4;
          // the lunge: a short burst once close (late and mild enough that a BOO at ~3 m still lands in time)
          if (dist < 2.8 && g.lungeCd <= 0) { g.lunge = 0.7; g.lungeCd = 2.4; }
          if (g.lunge > 0) { g.lunge -= dt; speed *= 1.3; accel = 6; }
          if (!active || kid.safe || dist > aggro + 9) { g.state = 'wander'; g.t = 0; g.retarget = 0; }
          else if (g.t > CHASE_MAX && g.lunge <= 0) { g.state = 'wander'; g.t = 0; g.retarget = 0; g.calm = CALM_GIVEUP; } // gives up
          if (active && !kid.safe && g.tame <= 0 && dist < 0.85 && Math.abs(kid.y + 0.6 - (g.y - 0.5)) < 1.3) {
            E.caught = n; g.state = 'retreat'; g.t = 0;
          }
          break;
        }
        case 'flee': {
          const fl = Math.max(dist, 0.1);
          wantX = -dx / fl; wantZ = -dz / fl; speed = 6.5 * Math.max(0.35, 1 - g.t / 3.4); accel = 2.5;
          if (g.t > 3.4) { g.state = 'wander'; g.t = 0; g.retarget = 0; g.calm = CALM_BOO; }
          break;
        }
        case 'retreat': {
          const fl = Math.max(dist, 0.1);
          wantX = -dx / fl; wantZ = -dz / fl; speed = 3; accel = 3;
          if (g.t > 2.6) { g.state = 'wander'; g.t = 0; g.retarget = 0; g.calm = CALM_CAUGHT; }
          break;
        }
        default: break;
      }
      if (g.state !== 'rise') {
        // separation from the other ghosts, and the fence
        for (let m = 0; m < L.length; m++) {
          if (m === n) continue;
          const o = L[m];
          if (o.state === 'dormant') continue;
          const sx = g.x - o.x, sz = g.z - o.z, s2 = sx * sx + sz * sz;
          if (s2 < 5 && s2 > 1e-6) { const k = (2.24 - Math.sqrt(s2)) / 2.24 / Math.sqrt(s2); wantX += sx * k * 1.5; wantZ += sz * k * 1.5; }
        }
        const lim = g.state === 'chase' ? PLAY - 0.5 : PLAY - 3; // a chaser reaches a kid hugging the fence
        if (g.x > lim) wantX -= (g.x - lim); if (g.x < -lim) wantX += (-lim - g.x);
        if (g.z > lim) wantZ -= (g.z - lim); if (g.z < -lim) wantZ += (-lim - g.z);
        const wl = Math.hypot(wantX, wantZ);
        if (wl > 1) { wantX /= wl; wantZ /= wl; }
        const k = 1 - Math.exp(-accel * dt);
        g.vx += (wantX * speed - g.vx) * k; g.vz += (wantZ * speed - g.vz) * k;
        g.x += g.vx * dt; g.z += g.vz * dt;
        const ground = this.heightAt(g.x, g.z);
        const bob = Math.sin(this.time * 2.1 + g.phase) * 0.14;
        const goalY = ground + HOVER + bob + (g.state === 'flee' ? 0.5 : 0);
        g.y += (goalY - g.y) * (1 - Math.exp(-4 * dt));
        const sp = Math.hypot(g.vx, g.vz);
        if (sp > 0.2) g.yaw += wrapPi(Math.atan2(-g.vx, -g.vz) - g.yaw) * (1 - Math.exp(-6 * dt));
        else if (g.state !== 'flee') g.yaw += wrapPi(Math.atan2(-dx, -dz) - g.yaw) * (1 - Math.exp(-2 * dt)); // idle: look at the kid
        g.lean += (Math.min(0.35, sp * 0.07) - g.lean) * (1 - Math.exp(-5 * dt));
      }
      this._target(g);
    }
    if (E.caught >= 0) { // the rest of the pack backs off for a moment too
      for (let n = 0; n < L.length; n++) {
        const o = L[n];
        if (n === E.caught || o.state === 'dormant') continue;
        if (Math.hypot(o.x - kid.x, o.z - kid.z) < CALM_R) { o.calm = Math.max(o.calm, CALM_NEAR); o.retarget = 0; } else o.calm = Math.max(o.calm, CALM_FAR);
      }
    }
  }

  /** After each dynamics step: keep the drawn sheets' previous / current poses. */
  capture() { for (const g of this.list) if (g.state !== 'dormant') g.mesh.capture(); }

  /**
   * Per frame: draw the sheets interpolated, scared tint, auras into `glows` from slot `base`; returns slots used.
   * cam (optional, a Vector3): ghosts close to it fade out, so a sheet drifting over the lens never fills the view.
   * frustum (optional, the view's THREE.Frustum): a sheet whose ghost is well out of view is hidden and not rebuilt
   * this frame (the subdivided sheets cost a little CPU each; the cloth itself keeps simulating).
   */
  update(dt, alpha, glows, base, cam = null, frustum = null) {
    let n = 0, lit = null, ld = 22;
    const w = this._wk += ((this.witch ? 1 : 0) - this._wk) * (1 - Math.exp(-2.5 * dt));
    for (const g of this.list) {
      if (g.state === 'dormant') continue;
      if (cam) { const d = Math.hypot(g.x - cam.x, g.z - cam.z); if (d < ld && g.alpha > 0.3) { ld = d; lit = g; } }
      _sph.center.set(g.x, g.y - 0.5, g.z);
      const seen = !frustum || frustum.intersectsSphere(_sph);
      g.mesh.mesh.visible = seen;
      if (seen) g.mesh.update(alpha);
      const s = g.scared, m = g.mat;
      m.emissive.setRGB(0.62 - 0.2 * s + 0.3 * w, 0.7 - 0.35 * s - 0.12 * w, 1.0 - 0.55 * w);
      m.color.setRGB(0.95 - 0.35 * s, 0.96 - 0.4 * s, 1.0);
      let near = 1;
      if (cam) {
        const d = Math.hypot(g.x - cam.x, g.y - 0.4 - cam.y, g.z - cam.z), u = Math.min(1, Math.max(0, (d - CAM_FADE0) / (CAM_FADE1 - CAM_FADE0)));
        near = CAM_FLOOR + (1 - CAM_FLOOR) * u * u * (3 - 2 * u);
      }
      m.opacity = 0.86 * Math.min(1, g.alpha * 1.4) * near;
      m.depthWrite = near > 0.95; // a faded sheet must not hide what is behind it
      const a = 0.22 * g.alpha * near;
      const r = a * (0.7 - 0.3 * s), gg = a * (0.8 - 0.4 * s), b = a * 1.2;
      glows.set(base + n++, g.x, g.y - 0.15, g.z, 3.2 + 0.6 * w, r + (a * 1.5 - r) * w, gg + (a * 0.55 - gg) * w, b + (a * 0.1 - b) * w);
    }
    const L = this.light;
    if (L) {
      const k = 1 - Math.exp(-6 * dt);
      if (lit) {
        if (this._lk < 0.02) L.position.set(lit.x, lit.y - 0.2, lit.z); // was off: appear at the ghost, no slide
        else { L.position.x += (lit.x - L.position.x) * k; L.position.y += (lit.y - 0.2 - L.position.y) * k; L.position.z += (lit.z - L.position.z) * k; }
      }
      const want = lit ? Math.min(1, lit.alpha) * (1 - Math.max(0, (ld - 14) / 8)) : 0;
      this._lk += (want - this._lk) * k;
      L.intensity = 2.4 * this._lk;
    }
    return n;
  }

  /** Nearest chasing ghost's distance to (x, z) (Infinity when none). */
  nearestChaser(x, z) {
    let d = Infinity;
    for (const g of this.list) if (g.state === 'chase') d = Math.min(d, Math.hypot(g.x - x, g.z - z));
    return d;
  }
}
