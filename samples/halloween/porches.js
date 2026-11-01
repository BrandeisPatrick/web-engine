// Trick-or-treat porches (DESIGN.md 2.2): six lit porches are the round's destinations; the grass candy is the trail
// between them. A porch is available while its lamp burns (and its doormat glows):
//   TREAT   walk onto a lit mat: a knock, the door swings open, and KNOCK_T s later 8 candies arc out of the doorway onto
//           the lane side; the lamp goes dark for 40 s
//   TRICK   BOO while on a lit mat (BOO ready; it still scares the ghosts around): 14 candies at once, the lamp dark for
//           60 s, and RESIDENT_DELAY s later a resident ghost drops from the chimney and chases at once
//   HAUNTED P6 (the haunted house): a treat is only a knock (the door rattles, stays shut); a trick pays 22 and wakes
//           two residents; dark for 70 s
// The lamp dims to 0 on use and fades back up over the last FADE s of its cooldown (readable from far: about to
// relight); a porch that relights lays a trail of TRAIL candies along the lane within TRAIL_R m of its mat (from the
// respawn budget: the game skips that many respawns, `takeDebt`). Treating or tricking each lane porch (P1..P5) once in
// a round pays the FULL ROUND bonus; a visited porch keeps a lit jack-o'-lantern on its railing for the rest of the
// round (the tracker: no HUD). The Witching Hour relights every porch at once (relightAll).
// Residents come from the ghost pool (ghosts.summon): a dormant ghost drops from the porch's chimney, else the nearest
// wandering one turns to chase; the ghost count stays the same.
// Geometry: the doors are one instanced mesh (6, hinged); until the map pass builds the cottages (porch-spots.js is a
// stub then: no `lamp` glow groups), each porch also gets a stand-in front from the props.js kit (a clapboard wall with
// a gable and a doorway, the lamp's cage, two turned posts, a ribbed pumpkin on the left one: one merged lit mesh,
// colliders on the wall) and its glowing parts (the doormat, the lamp glass, the pumpkin's carved face, the warm
// doorway) in one merged unlit mesh whose per-porch levels come from a uniform array (one draw). With the map pass's PORCHES (spot.lamp / spot.railing set), the stand-ins
// are not built and the lamp / railing levels go into world.glowLevels on top of the environment's flicker.
// Module shape (the game's convention): reset(), fixedUpdate(dt, kid, playing) -> events, update(dt, glows, base) ->
// glow slots used, plus boo() (the trick, called from the game's BOO) and relightAll(). Typed arrays, no per-frame
// allocation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PATHS, PLAY } from './world.js';
import { patchDetail } from './looks.js';
import { Batch, Parts, chamferBox, vgrad, crack, lathe, place, pumpkinGeometry, pumpkinFront } from './props.js';
import { PORCHES } from './porch-spots.js';

export const PORCH = {
  TREAT: 8, TRICK: 14, HAUNTED: 22,                 // candy per visit
  CD_TREAT: 40, CD_TRICK: 60, CD_HAUNTED: 70,       // lamp dark (s)
  FADE: 3,                                          // the lamp fades back up over the last FADE s of the cooldown
  KNOCK_T: 0.8,                                     // s from stepping on a lit mat to the treat (BOO in it = trick)
  RESIDENT_DELAY: 0.6,                              // s after the trick's BOO (so the BOO does not scare the resident)
  FULL_ROUND: 25,                                   // P1..P5 each treated or tricked once in a round
  TRAIL: 5, TRAIL_R: 12,                            // candies laid along the lane by a porch that relights
  SPILL_SPEED: 3.5, SPILL_DELAY: 0.3, SPILL_TTL: 20, SPILL_FAN: 0.95, // the shower out of the doorway (fan: rad)
  DOOR_OPEN: 1.2, DOOR_TRICK: 0.3, DOOR_HOLD: 2, DOOR_CLOSE: 0.9, DOOR_ANGLE: 1.4, // hinge (s, rad; it swings in)
  BOO_MARGIN: 0.5,                                  // a BOO this far off the mat still counts as on it
  DEBT_MAX: 15,                                     // respawns skipped at most for trails
};
const LANE = 5; // the lane porches (P1..P5) are spots[0..LANE-1]; the Full Round counts them
// stand-in front, in the porch's frame (origin: the mat's centre on its top; +x along the wall, +z out of the door)
export const DOOR = { W: 1.06, H: 2.1 }; // the leaf; the map's doorway for it: HOLE_W x HOLE_H, centred on the mat's axis at its back edge
const DOOR_W = DOOR.W, DOOR_H = DOOR.H, WALL_W = 3.6, WALL_H = 3, WALL_T = 0.22, HOLE_W = 1.12, HOLE_H = 2.14, VEST = 1.2;
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _cols = [];
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** A primitive painted (linear colour times `k`), placed (local), then moved by the porch matrix `pm`; + attributes. */
function part(list, pm, g, color, k, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx, attrs = null) {
  if (g.attributes.uv) g.deleteAttribute('uv');
  _c.set(color);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _c.r * k; c[i * 3 + 1] = _c.g * k; c[i * 3 + 2] = _c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (attrs) for (const [name, v] of attrs) g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n).fill(v), 1));
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  g.applyMatrix4(_l.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz))).applyMatrix4(pm);
  list.push(g);
}

/** The door leaf with its hinge on the local origin (x 0..DOOR_W, y 0..DOOR_H), panels and a knob on the +z face. */
function doorGeometry() {
  const L = new Parts();
  vgrad(L.add(chamferBox(DOOR_W, DOOR_H, 0.06, 0.015), '#d8d8d8', DOOR_W / 2, DOOR_H / 2, 0), 0.8, 1.1);
  for (const [px, py, h] of [[0.29, 1.5, 0.75], [0.77, 1.5, 0.75], [0.29, 0.55, 0.8], [0.77, 0.55, 0.8]]) vgrad(L.add(chamferBox(0.36, h, 0.03, 0.012), '#ffffff', px, py, 0.035), 0.85, 1.1);
  L.add(chamferBox(DOOR_W - 0.1, 0.06, 0.03, 0.01), '#9a9a9a', DOOR_W / 2, 1.05, 0.035);
  L.add(new THREE.SphereGeometry(0.045, 8, 6), '#ffe9a8', DOOR_W - 0.13, 1.0, 0.075);
  for (const g of L.list) g.clearGroups();
  const g = mergeGeometries(L.list);
  for (const p of L.list) p.dispose();
  return g;
}

/** The glow material reads its porch channel's level (uPorchLv[grp]) between the part's floor (pfloor) and 1. */
function porchGlowMaterial(levels) {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPorchLv = { value: levels };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float pgrp;\nattribute float pfloor;\nuniform float uPorchLv[ ${levels.length} ];`)
      .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor.rgb *= mix( pfloor, 1.0, uPorchLv[ int( pgrp + 0.5 ) ] );');
  };
  mat.customProgramCacheKey = () => 'hwPorchGlow';
  return mat;
}

export class Porches {
  /**
   * @param {object} o  scene, physics (PhysicsWorld: stand-in colliders, trail checks), heightAt, candy (Candy),
   *   ghosts (Ghosts: summon), world (world.glowLevels for the map pass's lamp groups), spots (PORCHES)
   */
  constructor({ scene, physics, heightAt, candy, ghosts, world = null, spots = PORCHES }) {
    this.spots = spots; this.candy = candy; this.ghosts = ghosts; this.physics = physics; this.heightAt = heightAt; this.world = world;
    const n = this.n = spots.length, f = () => new Float32Array(n);
    this.st = new Uint8Array(n);       // 0 lit, 1 knocking (the door opening: a BOO now is a trick), 2 dark (cooling down)
    this.cd = f(); this.knockT = f();  // cooldown left (s); time since the knock
    this.onMat = new Uint8Array(n);    // the kid stood on the mat last step (a haunted knock once per visit)
    this.visited = new Uint8Array(n);  // treated / tricked this round (the railing's jack-o'-lantern)
    this.resT = f(); this.resN = new Uint8Array(n); // residents due in resT s
    this.door = f(); this.doorGoal = f(); this.doorRate = f(); this.doorHold = f(); this.rattle = f(); this._doorDrawn = new Float32Array(n).fill(-1);
    this.lampLv = f(); this.railLv = f(); this.doorLv = f();
    // per porch: cos / sin of the facing, the doorway (shower origin) and the lamp, railing pumpkin and door hinge spots
    this.cs = f(); this.sn = f();
    this.dx = f(); this.dy = f(); this.dz = f();  // the doorway, 1 m up, 0.35 m out (the shower and its sparkles)
    this.lx = f(); this.ly = f(); this.lz = f();  // the lamp glass
    this.rx = f(); this.ry = f(); this.rz = f();  // the railing's jack-o'-lantern
    this.hx = f(); this.hz = f();                 // the door's hinge
    this.trail = new Float32Array(n * PORCH.TRAIL * 2); this.trailN = new Uint8Array(n);
    this.startTrail = new Float32Array(PORCH.TRAIL * 2); this.startTrailN = 0;
    this.stand = !spots.some((s) => s.lamp != null); // no cottages in the map yet: build the stand-in fronts
    for (let k = 0; k < n; k++) {
      const S = spots[k], M = S.mat, c = Math.cos(S.yaw), s = Math.sin(S.yaw), at = (lx, lz, out) => { out[0] = M.x + lx * c + lz * s; out[1] = M.z - lx * s + lz * c; return out; };
      this.cs[k] = c; this.sn[k] = s;
      const v = [0, 0], doorZ = -M.d / 2 - 0.06;
      at(0, doorZ + 0.4, v); this.dx[k] = v[0]; this.dy[k] = M.y + 1.0; this.dz[k] = v[1];
      at(0.95, -M.d / 2 + 0.2, v); this.lx[k] = v[0]; this.ly[k] = M.y + 2.08; this.lz[k] = v[1];
      at(-1.3, M.d / 2 - 0.1, v); this.rx[k] = v[0]; this.ry[k] = M.y + 1.08; this.rz[k] = v[1];
      at(-DOOR_W / 2, doorZ, v); this.hx[k] = v[0]; this.hz[k] = v[1];
    }
    // doors: one instanced mesh (a colour each), hinged
    this.doors = new THREE.InstancedMesh(doorGeometry(), patchDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 }), { scale: 2.2, amount: 0.5, streak: 0.6 }), n);
    this.doors.name = 'porchDoors'; this.doors.receiveShadow = true; this.doors.castShadow = false;
    const DOOR_COL = ['#8a2f2a', '#2f6a42', '#33497e', '#9a7428', '#64407a', '#2a2026'];
    for (let k = 0; k < n; k++) this.doors.setColorAt(k, _c.set(spots[k].haunted ? DOOR_COL[5] : DOOR_COL[k % 5]));
    this.doors.instanceColor.needsUpdate = true;
    this.doors.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.doors.frustumCulled = false;
    scene.add(this.doors);
    this.glowLv = new Float32Array(n * 3); // [lamp + mat, railing, doorway] per porch (the stand-in glow mesh)
    this.front = null; this.glow = null; this.colliders = 0;
    if (this.stand) this._buildStandIns(scene);
    this._trails();
    this.events = { knock: -1, treat: -1, full: false, relit: -1, resident: -1 };
    this._fullDue = false;
    this.visits = 0; this.tricks = 0; this.treats = 0; this.fullPaid = false; this.debt = 0; this.lastValue = 0;
    this.knocking = -1; // the porch whose door is opening with the kid on its mat (BOO now = trick), or -1
  }

  /**
   * The stand-in porch fronts (the props.js kit: hand-painted, chamfered, merged into one lit mesh with the baked ground
   * shading), their glowing parts (unlit, one mesh) and the wall colliders.
   */
  _buildStandIns(scene) {
    const B = new Batch(), glo = [], pm = new THREE.Matrix4(), I = (v) => [['pgrp', v[0]], ['pfloor', v[1]]];
    const R = 0.2, face = pumpkinFront(R, 8, 0.1); // the railing pumpkin (radius) and its front surface
    for (let k = 0; k < this.n; k++) {
      const S = this.spots[k], M = S.mat, H = S.haunted, wz = -M.d / 2 - 0.06 - 0.04; // the wall's mid-plane
      const WALL = H ? '#352b3e' : '#5d4c66', WALL2 = H ? '#3d3148' : '#66546f', TRIM = H ? '#5e4f6a' : '#7a6584', ROOF = H ? '#211a28' : '#2e2436';
      const STONE = '#454050', IRON = '#141016', INK = '#1d1724', zf = wz + WALL_T / 2 + 0.003; // the wall's face
      const L = new Parts();
      // a stone footing, the wall round the doorway (into the ground for uneven terrain), siding, corner boards
      vgrad(L.add(chamferBox(WALL_W + 0.24, 0.55, WALL_T + 0.22, 0.04), STONE, 0, 0.0, wz), 0.6, 0.95);
      const side = (WALL_W - HOLE_W) / 2, sx = HOLE_W / 2 + side / 2, top = WALL_H - HOLE_H;
      for (const s of [-1, 1]) vgrad(L.add(new THREE.BoxGeometry(side, WALL_H + 0.5, WALL_T), WALL, s * sx, (WALL_H - 0.5) / 2, wz), 0.72, 1.1, 0.04, k * 7 + s + 2);
      vgrad(L.add(new THREE.BoxGeometry(HOLE_W, top, WALL_T), WALL, 0, HOLE_H + top / 2, wz), 0.95, 1.1);
      for (let yy = 0.44; yy < WALL_H - 0.1; yy += 0.34) { // clapboard lines, round the doorway
        if (yy > HOLE_H + 0.12) crack(L, [[-WALL_W / 2, yy, zf], [WALL_W / 2, yy, zf]], 0.014, INK);
        else for (const s of [-1, 1]) crack(L, [[s * (HOLE_W / 2 + 0.14), yy, zf], [s * WALL_W / 2, yy, zf]], 0.014, INK);
      }
      for (const s of [-1, 1]) L.add(chamferBox(0.2, WALL_H, 0.28, 0.03), TRIM, s * (WALL_W / 2 - 0.06), WALL_H / 2, wz);
      vgrad(L.add(chamferBox(WALL_W + 0.3, 0.2, WALL_T + 0.3, 0.04), TRIM, 0, WALL_H + 0.02, wz), 0.8, 1.15);
      // the door's frame: two boards and a peaked lintel
      for (const s of [-1, 1]) L.add(chamferBox(0.14, HOLE_H + 0.1, 0.1, 0.02), TRIM, s * (HOLE_W / 2 + 0.05), (HOLE_H + 0.1) / 2, zf + 0.03);
      const ped = new THREE.Shape(); ped.moveTo(-(HOLE_W + 0.5) / 2, 0); ped.lineTo((HOLE_W + 0.5) / 2, 0); ped.lineTo(0, 0.3); ped.closePath();
      vgrad(L.add(new THREE.ExtrudeGeometry(ped, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06), TRIM, 0, HOLE_H + 0.08, zf + 0.04), 0.85, 1.2);
      // a gable over the wall and two shingled roof slabs, eaves out over the door
      {
        const rh = 1.25, tri = new THREE.Shape(); tri.moveTo(-WALL_W / 2, 0); tri.lineTo(WALL_W / 2, 0); tri.lineTo(0, rh); tri.closePath();
        vgrad(L.add(new THREE.ExtrudeGeometry(tri, { depth: WALL_T, bevelEnabled: false }).translate(0, 0, -WALL_T / 2), WALL2, 0, WALL_H + 0.1, wz), 0.85, 1.1);
        L.add(new THREE.TorusGeometry(0.26, 0.05, 4, 14), TRIM, 0, WALL_H + 0.62, zf + 0.02);
        L.add(new THREE.CircleGeometry(0.25, 12), '#120c14', 0, WALL_H + 0.62, zf + 0.01);
        const a = Math.atan2(rh, WALL_W / 2), len = Math.hypot(rh, WALL_W / 2) + 0.35;
        for (const s of [-1, 1]) {
          vgrad(L.add(chamferBox(len, 0.12, 1.15, 0.03), ROOF, s * (WALL_W / 4 + 0.05), WALL_H + 0.1 + rh / 2 + 0.1, wz + 0.42, 0, 0, -s * a), 0.85, 1.25);
          for (let q = 1; q < 4; q++) { // shingle rows along the slab (on its top face)
            const t = (q / 4 - 0.5) * len, cx = s * (WALL_W / 4 + 0.05) + t * Math.cos(a), cy = WALL_H + 0.2 + rh / 2 - s * t * Math.sin(a) + 0.07;
            crack(L, [[cx, cy, wz - 0.15], [cx, cy, wz + 0.99]], 0.012, '#160f1a', [0, 1, 0]);
          }
        }
      }
      // the lamp right of the door: a rod, a cap, a cage and a base (its glass glows: below)
      const lx = 0.95, ly = 2.08, lz = -M.d / 2 + 0.2;
      L.add(chamferBox(0.05, 0.05, 0.32, 0.01), IRON, lx, ly + 0.25, lz - 0.15);
      L.add(new THREE.ConeGeometry(0.16, 0.13, 4).rotateY(Math.PI / 4), IRON, lx, ly + 0.2, lz);
      for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.add(new THREE.BoxGeometry(0.02, 0.26, 0.02), IRON, lx + cx * 0.085, ly, lz + cz * 0.085);
      L.add(new THREE.BoxGeometry(0.2, 0.03, 0.2), IRON, lx, ly - 0.14, lz);
      // two turned newel posts at the mat's front corners; the left one carries the jack-o'-lantern (the tracker)
      const pz = M.d / 2 - 0.1;
      for (const s of [-1, 1]) {
        L.add(chamferBox(0.22, 0.14, 0.22, 0.03), TRIM, s * 1.3, 0.04, pz);
        vgrad(L.add(lathe([[0.075, 0], [0.09, 0.08], [0.06, 0.25], [0.065, 0.6], [0.085, 0.7], [0.07, 0.78], [0.1, 0.82], [0.1, 0.86]], 8), TRIM, s * 1.3, 0.04, pz), 0.75, 1.15);
      }
      const pg = pumpkinGeometry(R, 24, 0, H ? '#c95a20' : '#e0701e', '#4d6a2a', { seed: 11 + k });
      for (const a of ['rib', 'glow']) if (pg.attributes[a]) pg.deleteAttribute(a);
      L.push(place(pg, -1.3, 0.9, pz));
      L.into(B, M.x, M.y, M.z, S.yaw);
      // ---- glowing parts (channel: 0 lamp + mat, 1 railing, 2 doorway; floor: the level at "off")
      pm.compose(_p.set(M.x, M.y, M.z), _q.setFromEuler(_e.set(0, S.yaw, 0)), _s.set(1, 1, 1));
      const G = (g, col, k2, x, y, z, ch, floor, ry = 0, rx = 0) => part(glo, pm, g, col, k2, x, y, z, ry, rx, 0, 1, 1, 1, I([k * 3 + ch, floor]));
      // the doormat: a woven middle (dim when the lamp is off) inside a bright border
      G(new THREE.PlaneGeometry(M.w - 0.24, M.d - 0.24).rotateX(-Math.PI / 2), H ? '#6f5a86' : '#c08a52', 1.05, 0, 0.025, 0, 0, 0.28);
      for (const [bw, bd, bx, bz] of [[M.w, 0.12, 0, M.d / 2 - 0.06], [M.w, 0.12, 0, -M.d / 2 + 0.06], [0.12, M.d - 0.24, M.w / 2 - 0.06, 0], [0.12, M.d - 0.24, -M.w / 2 + 0.06, 0]]) {
        G(new THREE.PlaneGeometry(bw, bd).rotateX(-Math.PI / 2), '#ffe2b0', 1.9, bx, 0.03, bz, 0, 0.07);
      }
      G(new THREE.BoxGeometry(0.15, 0.22, 0.15), '#fff0d2', 2.6, lx, ly, lz, 0, 0.05);                       // the lamp's glass
      // the pumpkin's carved face on its ribbed front (toward the lane): two triangle eyes and a grin
      for (const [fx, fy, rr, n, rot] of [[-0.07, 0.17, 0.04, 3, 0], [0.07, 0.17, 0.04, 3, 0], [0, 0.085, 0.07, 3, Math.PI]]) {
        const q = face(fx, fy), ry = Math.atan2(q[3], q[5]), rx = -Math.asin(q[4]);
        const g = new THREE.CircleGeometry(rr, n).rotateZ(Math.PI / 2 + rot);
        if (rot) g.scale(1.5, 0.55, 1);
        G(g, '#ffb347', 2.4, -1.3 + q[0], 0.9 + q[1], pz + q[2] + 0.006, 1, 0.04, ry, rx);
      }
      // the doorway behind the door: warm light (violet in the haunted house) when the door opens
      const vz = wz - WALL_T / 2 - VEST / 2;
      G(new THREE.PlaneGeometry(HOLE_W, HOLE_H), H ? '#9a62ff' : '#ffb766', H ? 1.3 : 1.6, 0, HOLE_H / 2, vz - VEST / 2 + 0.05, 2, 0);
      // a shallow vestibule behind the doorway (the door swings into it): two sides, a lintel, a back wall
      const V = new Parts();
      for (const s of [-1, 1]) V.add(new THREE.BoxGeometry(0.1, HOLE_H + 0.1, VEST), '#2a2030', s * (HOLE_W / 2 + 0.05), (HOLE_H + 0.1) / 2, vz);
      V.add(new THREE.BoxGeometry(HOLE_W + 0.2, 0.1, VEST), '#2a2030', 0, HOLE_H + 0.05, vz);
      V.add(new THREE.BoxGeometry(HOLE_W + 0.2, HOLE_H + 0.1, 0.08), '#1e1724', 0, (HOLE_H + 0.1) / 2, vz - VEST / 2);
      V.into(B, M.x, M.y, M.z, S.yaw);
      // colliders: the wall (axis-aligned: one box; a diagonal one in short pieces so no box reaches onto the mat, but
      // their steps trap a kid pushing into them: porch-spots.js keeps the stand-ins axis-aligned)
      const c = this.cs[k], sn = this.sn[k], wx = (lx2) => M.x + lx2 * c + wz * sn, wzz = (lx2) => M.z - lx2 * sn + wz * c, half = WALL_T / 2;
      const y0 = M.y - 1, y1 = M.y + WALL_H;
      if (Math.abs(Math.sin(2 * S.yaw)) < 0.01) {
        const ax = wx(-WALL_W / 2), bx = wx(WALL_W / 2), az = wzz(-WALL_W / 2), bz = wzz(WALL_W / 2);
        this.physics.addStaticBox(Math.min(ax, bx) - half, y0, Math.max(ax, bx) + half, y1, Math.min(az, bz) - half, Math.max(az, bz) + half); this.colliders++;
      } else {
        const pieces = 8, step = WALL_W / pieces;
        for (let i = 0; i < pieces; i++) {
          const a = -WALL_W / 2 + i * step, b = a + step, ax = wx(a), bx = wx(b), az = wzz(a), bz = wzz(b), h2 = half * 0.75;
          this.physics.addStaticBox(Math.min(ax, bx) - h2, y0, Math.max(ax, bx) + h2, y1, Math.min(az, bz) - h2, Math.max(az, bz) + h2); this.colliders++;
        }
      }
    }
    const frontMat = patchDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02 }), { scale: 1.7, amount: 0.62, broad: 0.32, streak: 0.55 });
    this.front = B.build(frontMat, 'porchFronts', this.heightAt);
    this.front.receiveShadow = true; this.front.castShadow = false;
    scene.add(this.front);
    this.glow = new THREE.Mesh(mergeGeometries(glo), porchGlowMaterial(this.glowLv));
    this.glow.name = 'porchGlow';
    scene.add(this.glow);
    for (const g of glo) g.dispose();
  }

  /** Per porch: up to TRAIL spots along the lane (the map's paths) within TRAIL_R m of the mat, out from the door. */
  _trails() {
    const T = PORCH.TRAIL, R = PORCH.TRAIL_R, ok = (x, z) => Math.abs(x) < PLAY - 2 && Math.abs(z) < PLAY - 2 && (_cols.length = 0, this.physics.queryColliders(x, z, 0.55, _cols).length === 0);
    const cand = [];
    for (let k = 0; k < this.n; k++) {
      const M = this.spots[k].mat, nx = this.sn[k], nz = this.cs[k];
      cand.length = 0;
      for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az);
        for (let u = 0; u <= L; u += 1) {
          const x = ax + (bx - ax) * u / L, z = az + (bz - az) * u / L, d = Math.hypot(x - M.x, z - M.z);
          if (d >= 2.5 && d <= R && (x - M.x) * nx + (z - M.z) * nz > 1 && ok(x, z)) cand.push([d, x, z]);
        }
      }
      // too few lane spots near this porch (no lane past it): straight out from the door, zigzagging a little
      for (let j = 0; cand.length < T * 3 && j < 8; j++) {
        const d = 2.6 + j * 1.3, w = (j % 2 ? 0.6 : -0.6), x = M.x + nx * d + nz * w, z = M.z + nz * d - nx * w;
        if (ok(x, z)) cand.push([d + 50, x, z]); // after any lane spot
      }
      cand.sort((a, b) => a[0] - b[0]);
      let m = 0;
      for (const [, x, z] of cand) {
        if (m >= T) break;
        let far = true;
        for (let j = 0; j < m; j++) if (Math.hypot(this.trail[(k * T + j) * 2] - x, this.trail[(k * T + j) * 2 + 1] - z) < 2) far = false;
        if (!far) continue;
        this.trail[(k * T + m) * 2] = x; this.trail[(k * T + m) * 2 + 1] = z; m++;
      }
      this.trailN[k] = m;
    }
    // the dusk trail: from the spawn (0, 6) to P1's mat, the first porch (lit, in view ahead-left)
    const M = this.spots[0].mat, L = Math.hypot(M.x, M.z - 6);
    let m = 0;
    for (let j = 0; j < T; j++) {
      const d = 3.5 + j * (L - 6.5) / (T - 1), x = (M.x / L) * d, z = 6 + ((M.z - 6) / L) * d;
      if (ok(x, z)) { this.startTrail[m * 2] = x; this.startTrail[m * 2 + 1] = z; m++; }
    }
    this.startTrailN = m;
  }

  /** A new round (or the title): every lamp lit, doors shut, no porch visited; the dusk trail to P1. */
  reset(trail = true) {
    this.st.fill(0); this.cd.fill(0); this.knockT.fill(0); this.onMat.fill(0); this.visited.fill(0);
    this.resT.fill(0); this.resN.fill(0); this.door.fill(0); this.doorGoal.fill(0); this.doorRate.fill(1); this.doorHold.fill(0); this.rattle.fill(0);
    this.lampLv.fill(1); this.railLv.fill(0); this.doorLv.fill(0);
    this.visits = 0; this.tricks = 0; this.treats = 0; this.fullPaid = false; this.debt = 0; this.lastValue = 0; this.knocking = -1; this._fullDue = false;
    const E = this.events; E.knock = -1; E.treat = -1; E.full = false; E.relit = -1; E.resident = -1;
    if (trail) for (let j = 0; j < this.startTrailN; j++) this._place(this.startTrail[j * 2], this.startTrail[j * 2 + 1]);
  }

  _place(x, z) {
    const C = this.candy, i = C.place(x, this.heightAt(x, z), z, Math.random() < 0.35 ? 1 : 0);
    if (i >= 0 && this.debt < PORCH.DEBT_MAX) this.debt++;
    return i;
  }

  /** The game's respawn tick asks: true = a trail candy already took this respawn's place (skip it). */
  takeDebt() { if (this.debt > 0) { this.debt--; return true; } return false; }

  /** The kid (x, z) on porch k's mat (grown by `m` m), feet near its top. */
  _on(k, x, y, z, m = 0) {
    const M = this.spots[k].mat, dx = x - M.x, dz = z - M.z, c = this.cs[k], s = this.sn[k];
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) <= M.w / 2 + m && Math.abs(lz) <= M.d / 2 + m && y > M.y - 0.6 && y < M.y + 0.9;
  }

  /** n candies arc out of porch k's doorway, fanned around its facing (onto the lane side). */
  _shower(k, n) {
    const C = this.candy, ox = this.dx[k], oy = this.dy[k], oz = this.dz[k], yaw = this.spots[k].yaw;
    C.spill(ox, oy, oz, n, 0, PORCH.SPILL_DELAY, PORCH.SPILL_TTL); // straight up; aimed below
    const P = C.p, V = C.v;
    for (let i = 0, m = 0; i < C.state.length && m < n; i++) {
      if (C.state[i] !== 2 || C.age[i] !== 0 || P[i * 3] !== ox || P[i * 3 + 2] !== oz) continue;
      const a = yaw + (Math.random() * 2 - 1) * PORCH.SPILL_FAN, sp = PORCH.SPILL_SPEED * (0.55 + Math.random() * 0.6);
      V[i * 3] = Math.sin(a) * sp; V[i * 3 + 2] = Math.cos(a) * sp; m++;
    }
  }

  _visit(k) {
    this.visits++;
    if (this.visited[k]) return;
    this.visited[k] = 1;
    if (this.fullPaid || k >= LANE || this.spots[k].haunted) return;
    for (let j = 0; j < LANE; j++) if (!this.visited[j]) return;
    this.fullPaid = true; this._fullDue = true;
  }

  /** Lane porches (P1..P5) visited this round. */
  get laneVisited() { let n = 0; for (let j = 0; j < Math.min(LANE, this.n); j++) n += this.visited[j]; return n; }

  _door(k, goal, time, hold = 0) { this.doorGoal[k] = goal; this.doorRate[k] = 1 / time; if (hold) this.doorHold[k] = hold; }

  /**
   * A BOO at the kid's feet (x, y, z), BOO ready: on (or within BOO_MARGIN of) a lit mat it is a TRICK. Returns the
   * porch index (this.lastValue = the candy it paid) or -1.
   */
  boo(x, y, z) {
    for (let k = 0; k < this.n; k++) {
      if (this.st[k] === 2 || !this._on(k, x, y, z, PORCH.BOO_MARGIN)) continue;
      const H = this.spots[k].haunted, v = this.lastValue = H ? PORCH.HAUNTED : PORCH.TRICK;
      this.st[k] = 2; this.cd[k] = H ? PORCH.CD_HAUNTED : PORCH.CD_TRICK; this.knocking = -1;
      this._door(k, 1, PORCH.DOOR_TRICK, PORCH.DOOR_HOLD);
      this._shower(k, v);
      this.resT[k] = PORCH.RESIDENT_DELAY; this.resN[k] = H ? 2 : 1;
      this.tricks++;
      this._visit(k);
      return k;
    }
    return -1;
  }

  /** The Witching Hour: every dark porch relights at once (each lays its trail as it does). */
  relightAll() { for (let k = 0; k < this.n; k++) if (this.st[k] === 2) this.cd[k] = Math.min(this.cd[k], 1e-3); }

  /**
   * Fixed step: the kid on the mats (knock, treat), cooldowns and relights (+ trails), residents due. kid: { x, y, z }.
   * Fills this.events: knock / treat / relit / resident (porch index or -1), full (the Full Round bonus is due).
   */
  fixedUpdate(dt, kid, playing) {
    const E = this.events;
    E.knock = -1; E.treat = -1; E.relit = -1; E.resident = -1; E.full = this._fullDue; this._fullDue = false;
    this.knocking = -1;
    for (let k = 0; k < this.n; k++) {
      const H = this.spots[k].haunted;
      if (this.st[k] === 2) {
        if ((this.cd[k] -= dt) <= 0) { // relit: a trail along the lane toward it
          this.cd[k] = 0; this.st[k] = 0; E.relit = k;
          for (let j = 0; j < this.trailN[k]; j++) this._place(this.trail[(k * PORCH.TRAIL + j) * 2], this.trail[(k * PORCH.TRAIL + j) * 2 + 1]);
        }
      }
      const on = playing && this._on(k, kid.x, kid.y, kid.z);
      if (this.st[k] === 0 && on) {
        if (H) { if (!this.onMat[k]) { E.knock = k; this.rattle[k] = 0.6; } } // knock, knock... the door stays shut
        else { this.st[k] = 1; this.knockT[k] = 0; E.knock = k; this._door(k, 1, PORCH.DOOR_OPEN); }
      }
      this.onMat[k] = on ? 1 : 0;
      if (this.st[k] === 1) {
        if (on) this.knocking = k;
        if ((this.knockT[k] += dt) >= PORCH.KNOCK_T) { // the treat
          this.st[k] = 2; this.cd[k] = PORCH.CD_TREAT; E.treat = k; this.lastValue = PORCH.TREAT;
          this.doorHold[k] = PORCH.DOOR_HOLD;
          this._shower(k, PORCH.TREAT);
          this.treats++;
          this._visit(k);
        }
      } else if (this.st[k] === 0 && on && H) this.knocking = k;
      if (this.resN[k] > 0 && (this.resT[k] -= dt) <= 0) {
        const C = this.spots[k].chimney;
        if (playing) for (let r = 0; r < this.resN[k]; r++) if (this.ghosts.summon(C[0] + r * 1.2, C[1], C[2] - r * 0.8)) E.resident = k;
        this.resN[k] = 0;
      }
    }
  }

  /**
   * Per frame: the doors (hinge, rattle), lamp / railing / doorway levels, and the halos (stand-ins: lamp, mat,
   * pumpkin, doorway) into `glows` from slot `base`; returns slots used. With the map pass's lamp / railing glow
   * groups, their levels go into world.glowLevels instead (call after the environment wrote its flicker there).
   */
  update(dt, glows, base, t = 0) {
    let n = 0, moved = false;
    const kLv = 1 - Math.exp(-8 * dt);
    for (let k = 0; k < this.n; k++) {
      const S = this.spots[k];
      // the door: toward its goal at its rate; held open, then it closes
      if (this.doorHold[k] > 0 && (this.doorHold[k] -= dt) <= 0) this._door(k, 0, PORCH.DOOR_CLOSE);
      const g = this.doorGoal[k], d = this.door[k], step = this.doorRate[k] * dt;
      this.door[k] = g > d ? Math.min(g, d + step) : Math.max(g, d - step);
      if (this.rattle[k] > 0) this.rattle[k] = Math.max(0, this.rattle[k] - dt);
      const ang = PORCH.DOOR_ANGLE * smooth(this.door[k]) + (this.rattle[k] > 0 ? 0.05 * Math.sin(this.rattle[k] * 46) * this.rattle[k] / 0.6 : 0);
      if (ang !== this._doorDrawn[k]) {
        this._doorDrawn[k] = ang; moved = true;
        _q.setFromEuler(_e.set(0, S.yaw + ang, 0));
        this.doors.setMatrixAt(k, _m.compose(_p.set(this.hx[k], S.mat.y, this.hz[k]), _q, _s.set(1, 1, 1)));
      }
      // levels: the lamp (and the mat) dark while cooling, fading up over the last FADE s; the railing's pumpkin once
      // visited; the doorway with the door
      const cd = this.cd[k], lamp = this.st[k] === 2 ? (cd < PORCH.FADE ? 1 - cd / PORCH.FADE : 0) : 1;
      this.lampLv[k] += (lamp - this.lampLv[k]) * kLv;
      this.railLv[k] += ((this.visited[k] ? 1 : 0) - this.railLv[k]) * kLv;
      this.doorLv[k] = smooth(this.door[k] * 1.6);
      let L = this.lampLv[k];
      if (S.haunted) L *= 0.82 + 0.18 * Math.sin(t * 7.3 + k) * Math.sin(t * 2.3); // the haunted lamp gutters
      if (S.lamp != null && this.world) { // the map pass's glow groups, on top of the environment's flicker
        this.world.glowLevels[S.lamp] *= L;
        if (S.railing != null) this.world.glowLevels[S.railing] = this.railLv[k] * this.world.glowLevels[S.railing];
      } else {
        this.glowLv[k * 3] = L; this.glowLv[k * 3 + 1] = this.railLv[k]; this.glowLv[k * 3 + 2] = this.doorLv[k];
        if (L > 0.01) {
          glows.set(base + n++, this.lx[k], this.ly[k], this.lz[k], 2.0, 0.38 * L, 0.3 * L, 0.18 * L);            // lamp: warm white
          glows.set(base + n++, S.mat.x, S.mat.y + 0.15, S.mat.z, 2.6, 0.14 * L, 0.1 * L, 0.06 * L);            // the mat's glow
        }
        if (this.railLv[k] > 0.01) { const r = this.railLv[k]; glows.set(base + n++, this.rx[k], this.ry[k], this.rz[k], 1.1, 0.5 * r, 0.22 * r, 0.04 * r); }
      }
      if (this.doorLv[k] > 0.01) { // the doorway's light, set back inside it (a halo is drawn pulled toward the eye: in
        // front of the door it washed over the kid on the mat)
        const v = this.doorLv[k], hv = S.haunted, x = this.dx[k] - this.sn[k] * 0.75, z = this.dz[k] - this.cs[k] * 0.75;
        glows.set(base + n++, x, this.dy[k] + 0.1, z, 1.6, (hv ? 0.3 : 0.5) * v, (hv ? 0.16 : 0.32) * v, (hv ? 0.6 : 0.14) * v);
      }
    }
    if (moved) this.doors.instanceMatrix.needsUpdate = true;
    return n;
  }

  /** A snapshot for tests and bots. */
  snapshot() {
    const out = [];
    for (let k = 0; k < this.n; k++) {
      const S = this.spots[k];
      out.push({ id: S.id, x: S.mat.x, z: S.mat.z, y: S.mat.y, yaw: S.yaw, haunted: !!S.haunted, st: this.st[k], cd: +this.cd[k].toFixed(2), lit: this.st[k] !== 2, lamp: +this.lampLv[k].toFixed(3), rail: +this.railLv[k].toFixed(3), visited: !!this.visited[k], door: +this.door[k].toFixed(3) });
    }
    return { porches: out, visits: this.visits, tricks: this.tricks, treats: this.treats, full: this.fullPaid, lane: this.laneVisited, debt: this.debt, knocking: this.knocking };
  }
}
