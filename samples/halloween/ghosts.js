// Bedsheet ghosts: each one is an XPBD cloth (Cloth.grid on the shared DynamicsWorld) whose centre disc is attached
// to a kinematic "head" sphere at anchors laid on its dome, so the rest of the sheet hangs, trails and flutters as the
// head moves. The head is steered by a small state machine:
//   dormant (under its grave, hidden) -> rise (out of the ground) -> wander <-> chase -> (caught the kid) retreat,
//   any awake state -> flee (BOO!) -> wander.
// A ghost that just caught the kid, was booed, or chased for CHASE_MAX s without catching stays calm (wanders, no chase)
// for a few seconds, and after a catch the other ghosts within CALM_R calm down too (CALM_NEAR; the farther ones for
// CALM_FAR, a little longer than the kid's safety), so the round has breathing room between attacks instead of one long pile-on (a pack used to catch a cornered kid again every time its
// 2 s of safety ran out). At most `maxChasers` ghosts chase at once (the game sets 2 on phones); the others keep
// wandering and drifting toward the kid. A "tame" ghost (g.tame > 0 s, the game's BOO lesson) chases from any distance
// but slowly (TAME_SPEED) and cannot catch; a BOO or the time running out ends it.
// Every ghost exists (and is simulated) for the whole round; waking one teleports its head and its whole cloth
// (positions and previous positions, so no velocity) to a grave. The face (eyes, mouth) is painted in the cloth
// texture where the dome's front lands in UV. Ghosts pass through everything (head layer 0) and cast no shadow.
// Look: a cold inner glow, a cyan moonlit rim (looks.js patchRim) and a shared alpha map whose hem fades into tatters.
import * as THREE from 'three';
import { Cloth, Shapes } from '@vibe/engine/physics';
import { ClothMesh, makeCanvas } from '@vibe/engine/render';
import { PLAY } from './world.js';
import { patchRim } from './looks.js';

const FLAT = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // grid normal (local +Z) -> world +Y; grid +Y -> world -Z (the face)
const HEAD_R = 0.32, PIN_THETA = 1.3, SHEET = 2.15, HOVER = 1.55;
// pacing (s): calm after a catch / a BOO / a chase given up; how long a chase lasts before the ghost gives up
const CALM_CAUGHT = 5, CALM_NEAR = 5, CALM_R = 14, CALM_FAR = 4.5, CALM_BOO = 3, CALM_GIVEUP = 3.5, CHASE_MAX = 8, TAME_SPEED = 2.4;
// a ghost fades out when it comes this close to the camera (m): a sheet over the lens hides the whole view
const CAM_FADE0 = 1.4, CAM_FADE1 = 3.6;
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function ghostTexture(n) {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#dfe4ff'); bg.addColorStop(0.5, '#ffffff'); bg.addColorStop(1, '#dfe4ff');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  // faint folds radiating from the top of the head (the canvas centre)
  g.strokeStyle = 'rgba(150,160,210,0.18)'; g.lineWidth = 3;
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30); g.lineTo(128 + Math.cos(a) * 180, 128 + Math.sin(a) * 180); g.stroke(); }
  // face on the front of the dome: v = 0.5 + arc / SHEET (canvas y = (1 - v) * S, flipY), arc = theta * HEAD_R
  const v = (theta) => (1 - (0.5 + (theta * HEAD_R) / SHEET)) * S, u = (m) => (0.5 + m / SHEET) * S;
  const ey = v(1.02), my = v(1.42), ew = 0.05 / SHEET * S, eh = 0.085 / SHEET * S;
  g.fillStyle = '#120a1c';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(u(s * 0.105), ey, ew, eh, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.ellipse(u(0), my, 0.055 / SHEET * S * (n % 2 ? 1.3 : 0.9), 0.07 / SHEET * S, 0, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let _hem = null;
/** Shared alpha map: the head and the body solid, the hem (the sheet's outer ring) fading out into wisps. */
function hemTexture() {
  if (_hem) return _hem;
  const S = 128, c = makeCanvas(S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.5);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(0.78, '#9a9a9a'); gr.addColorStop(1, '#262626');
  g.fillStyle = '#262626'; g.fillRect(0, 0, S, S);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  // ragged tatters: darker wedges reaching in from the rim
  g.globalCompositeOperation = 'multiply';
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2 + Math.sin(k * 7.3) * 0.1, w = 0.07 + 0.04 * Math.sin(k * 3.1), r0 = S * (0.36 + 0.06 * Math.sin(k * 5.7));
    g.fillStyle = 'rgba(70,70,70,0.55)';
    g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0);
    g.lineTo(S / 2 + Math.cos(a - w) * S * 0.72, S / 2 + Math.sin(a - w) * S * 0.72); g.lineTo(S / 2 + Math.cos(a + w) * S * 0.72, S / 2 + Math.sin(a + w) * S * 0.72); g.fill();
  }
  _hem = new THREE.CanvasTexture(c);
  _hem.colorSpace = THREE.NoColorSpace;
  return _hem;
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
          pins.push({ i, j, body: head, anchor: [u * s, Math.cos(th) * HEAD_R, -w * s] });
        }
      }
      const cloth = Cloth.grid(dyn, {
        nx: grid, ny: grid, spacing: sp, position: [px, py + HEAD_R, pz], quaternion: FLAT, mass: co.mass ?? 0.8,
        stretch: 0, shear: co.shear ?? 0.02, bend: co.bend ?? 0.5, radius: sp * 0.3, pins,
      });
      const tex = ghostTexture(k);
      // a moonlit sheet: soft shading in the folds, a cold glow from within, a cyan rim, the hem fading into wisps
      const mat = patchRim(new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, alphaMap: hemTexture(), color: '#f2f4ff', emissive: '#9fb2ff', emissiveIntensity: 0.42, roughness: 0.8, metalness: 0,
        side: THREE.DoubleSide, transparent: true, opacity: 0.86, depthWrite: true,
      }), { color: new THREE.Color(0.35, 0.6, 1.1), power: 2.2, share: 0.6, key: 'ghostRim' });
      const cm = new ClothMesh(dyn.particles, cloth, mat);
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
    this.difficulty = 0;
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
          if (active && !kid.safe && g.calm <= 0 && (dist < aggro || g.tame > 0) && chasing < this.maxChasers) { g.state = 'chase'; g.t = 0; E.chaseStart = n; chasing++; }
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
   */
  update(dt, alpha, glows, base, cam = null) {
    let n = 0, lit = null, ld = 22;
    for (const g of this.list) {
      if (g.state === 'dormant') continue;
      if (cam) { const d = Math.hypot(g.x - cam.x, g.z - cam.z); if (d < ld && g.alpha > 0.3) { ld = d; lit = g; } }
      g.mesh.update(alpha);
      const s = g.scared, m = g.mat;
      m.emissive.setRGB(0.62 - 0.2 * s, 0.7 - 0.35 * s, 1.0);
      m.color.setRGB(0.95 - 0.35 * s, 0.96 - 0.4 * s, 1.0);
      let near = 1;
      if (cam) {
        const d = Math.hypot(g.x - cam.x, g.y - 0.4 - cam.y, g.z - cam.z), u = Math.min(1, Math.max(0, (d - CAM_FADE0) / (CAM_FADE1 - CAM_FADE0)));
        near = 0.08 + 0.92 * u * u * (3 - 2 * u);
      }
      m.opacity = 0.86 * Math.min(1, g.alpha * 1.4) * near;
      m.depthWrite = near > 0.95; // a faded sheet must not hide what is behind it
      const a = 0.22 * g.alpha * near;
      glows.set(base + n++, g.x, g.y - 0.15, g.z, 3.2, a * (0.7 - 0.3 * s), a * (0.8 - 0.4 * s), a * 1.2);
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
