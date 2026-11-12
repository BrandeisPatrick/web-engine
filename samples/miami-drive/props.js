// Dynamic props the car scatters (traffic cones, bins, crates, café chairs and tables, a stack of boxes on the beach)
// on the engine's DynamicsWorld, plus the beach ramps (height bumps both the car and the props stand on).
//
// Coupling: the VehicleController treats DynamicsWorld bodies bridged into its PhysicsWorld as immovable walls (ENGINE.md:
// the vehicle does not couple both ways), so these bodies are NOT bridged. Instead, after every vehicle step,
// `couple(car)` finds the light bodies overlapping the car's body box (in the car frame, with the body's bounding
// radius), and resolves the hit as an impulse between a 1340 kg car and a few-kg prop: the prop takes
// J = m (1 + e) v_rel along the contact normal plus a lift and an off-centre spin, the car loses J / M (a small speed
// loss, a thump and a rumble), and the prop is pushed out of the box so it is not hit twice. Deterministic for a
// given input (no randomness: the "random" spin comes from the body id).
//
//   const props = new Props({ scene, physics, ground, spots, lod });
//   fixedUpdate: props.step(dt) after the car; props.couple(car) · update: props.render()
import * as THREE from 'three';
import { DynamicsWorld, Shapes } from '@vibe/engine/physics';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TYPES = {
  cone: { mass: 3.5, half: [0.17, 0.36, 0.17], r: 0.36, e: 0.35 },
  bin: { mass: 14, half: [0.28, 0.5, 0.28], r: 0.55, e: 0.25 },
  crate: { mass: 22, half: [0.36, 0.36, 0.36], r: 0.55, e: 0.2 },
  box: { mass: 4, half: [0.28, 0.24, 0.28], r: 0.42, e: 0.3 },
  chair: { mass: 5, half: [0.22, 0.42, 0.24], r: 0.45, e: 0.3 },
  table: { mass: 9, half: [0.38, 0.37, 0.38], r: 0.55, e: 0.25 },
  lounger: { mass: 11, half: [0.33, 0.2, 0.95], r: 0.8, e: 0.25 },
  parasol: { mass: 6, half: [0.12, 1.1, 0.12], r: 0.5, e: 0.3 },
};

function coneGeometry() {
  const base = new THREE.BoxGeometry(0.34, 0.04, 0.34).translate(0, -0.34, 0);
  const body = new THREE.CylinderGeometry(0.03, 0.14, 0.66, 16, 1, true).translate(0, 0.0, 0);
  const g = mergeGeometries([base, body].map((x) => { const n = x.toNonIndexed(); n.deleteAttribute('uv'); return n; }));
  // vertex colours: orange with two white reflective bands
  const pos = g.attributes.position, c = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), band = (y > 0.0 && y < 0.09) || (y > 0.16 && y < 0.22);
    const col = y < -0.31 ? [0.1, 0.1, 0.1] : band ? [0.9, 0.9, 0.9] : [1.0, 0.28, 0.03];
    c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const tint = (g, rgb) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(rgb, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
function chairGeometry() {
  const P = [];
  const metal = [0.75, 0.76, 0.78], seat = [0.08, 0.5, 0.55];
  P.push(tint(new THREE.BoxGeometry(0.42, 0.04, 0.42).translate(0, 0.02, 0), seat));
  P.push(tint(new THREE.BoxGeometry(0.42, 0.4, 0.04).translate(0, 0.22, 0.2), seat));
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) P.push(tint(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6).translate(x, -0.21, z), metal));
  return mergeGeometries(P);
}
function tableGeometry() {
  const P = [];
  P.push(tint(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 20).translate(0, 0.35, 0), [0.92, 0.9, 0.86]));
  P.push(tint(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8).translate(0, 0.0, 0), [0.2, 0.2, 0.22]));
  P.push(tint(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 16).translate(0, -0.35, 0), [0.2, 0.2, 0.22]));
  // a café parasol through the table: pole, ribs and an eight-panel canopy in alternating stripes with a scalloped hem
  P.push(tint(new THREE.CylinderGeometry(0.02, 0.02, 1.95, 6).translate(0, 1.3, 0), [0.85, 0.85, 0.82]));
  const pan = 8, Rr = 1.15;
  for (let k = 0; k < pan; k++) {
    const a0 = (k / pan) * Math.PI * 2, a1 = ((k + 1) / pan) * Math.PI * 2, am = (a0 + a1) / 2;
    const g = new THREE.BufferGeometry();
    const tip = [0, 2.42, 0], e0 = [Math.cos(a0) * Rr, 2.0, Math.sin(a0) * Rr], e1 = [Math.cos(a1) * Rr, 2.0, Math.sin(a1) * Rr];
    const sag = [Math.cos(am) * Rr * 0.97, 2.06, Math.sin(am) * Rr * 0.97];
    const hem = [Math.cos(am) * Rr * 0.96, 1.9, Math.sin(am) * Rr * 0.96];
    g.setAttribute('position', new THREE.Float32BufferAttribute([...tip, ...e1, ...sag, ...tip, ...sag, ...e0, ...e0, ...sag, ...hem, ...sag, ...e1, ...hem], 3));
    g.computeVertexNormals();
    P.push(tint(g, k % 2 ? [0.95, 0.94, 0.9] : [0.1, 0.55, 0.6]));
  }
  return mergeGeometries(P.map((g) => { if (!g.attributes.normal) g.computeVertexNormals(); return g; }));
}
function loungerGeometry() {
  const P = [], wood = [0.92, 0.9, 0.86], cloth = [0.12, 0.6, 0.7];
  P.push(tint(new THREE.BoxGeometry(0.62, 0.05, 1.3).translate(0, -0.02, 0.3), cloth));                         // flat part
  P.push(tint(new THREE.BoxGeometry(0.62, 0.05, 0.7).rotateX(-0.75).translate(0, 0.12, -0.6), cloth));        // back rest
  for (const [x, z] of [[-0.28, -0.75], [0.28, -0.75], [-0.28, 0.85], [0.28, 0.85]]) P.push(tint(new THREE.BoxGeometry(0.04, 0.18, 0.04).translate(x, -0.12, z), wood));
  return mergeGeometries(P);
}
function parasolGeometry() { // a folded beach umbrella
  const P = [tint(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6), [0.9, 0.9, 0.86])];
  P.push(tint(new THREE.CylinderGeometry(0.03, 0.11, 1.0, 8).translate(0, 0.55, 0), [0.95, 0.45, 0.2]));
  return mergeGeometries(P);
}
function binGeometry() {
  const P = [];
  P.push(tint(new THREE.CylinderGeometry(0.27, 0.24, 0.92, 18).translate(0, -0.04, 0), [0.1, 0.42, 0.32]));
  P.push(tint(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 18).translate(0, 0.45, 0), [0.08, 0.08, 0.09]));
  return mergeGeometries(P);
}

export class Props {
  /**
   * @param {object} o scene, physics (PhysicsWorld: static boxes + the ground with the bumps), spots: [{ type, x, y?, z, yaw }],
   *   ramps: [{ x, z, yaw, len, width, height }] (visuals; their heights come from rampHeight), lod
   */
  constructor(o) {
    this.dyn = new DynamicsWorld({ physics: o.physics, substeps: 2, maxBodies: 1024, maxContacts: 8192, sleep: { linear: 0.08, angular: 0.08, time: 0.6 } });
    this.bodies = []; // { id, type, T }
    this.byType = {};
    const geos = { cone: coneGeometry(), bin: binGeometry(), crate: null, box: null, chair: chairGeometry(), table: tableGeometry(), lounger: loungerGeometry(), parasol: parasolGeometry() };
    // crates (wood) and cardboard boxes: plain boxes with a canvas-free procedural look (vertex colours + roughness)
    geos.crate = tint(new THREE.BoxGeometry(0.72, 0.72, 0.72), [0.55, 0.38, 0.2]);
    geos.box = tint(new THREE.BoxGeometry(0.56, 0.48, 0.56), [0.66, 0.5, 0.32]);
    const counts = {};
    for (const s of o.spots) counts[s.type] = (counts[s.type] || 0) + 1;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, name: 'props' });
    for (const t in counts) {
      const mesh = new THREE.InstancedMesh(geos[t], mat, counts[t]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `props-${t}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      o.scene.add(mesh);
      this.byType[t] = { mesh, n: 0 };
    }
    for (const s of o.spots) {
      const T = TYPES[s.type];
      const y = (s.y ?? o.physics.getGroundHeight(s.x, s.z, 50)) + T.half[1] + 0.01;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw || 0);
      const id = this.dyn.addBody({ shape: Shapes.box(T.half[0], T.half[1], T.half[2]), position: [s.x, y, s.z], quaternion: [q.x, q.y, q.z, q.w], mass: T.mass, friction: 0.6, restitution: 0.15, kind: 'prop' });
      const slot = this.byType[s.type].n++;
      this.bodies.push({ id, type: s.type, T, slot, hit: 0 });
    }
    this._p = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._m = new THREE.Matrix4();
    this._ids = new Int32Array(256); this._dv = new THREE.Vector3(); this._w = new THREE.Vector3();
    this.hits = 0; this.lastHit = 0; this.lastHitPos = new THREE.Vector3();
    // ramps (visual only: heights come from rampHeight through the physics ground)
    this.group = new THREE.Group(); this.group.name = 'ramps';
    for (const r of o.ramps || []) this.group.add(rampMesh(r));
    o.scene.add(this.group);
    this.render();
  }

  step(dt) { this.dyn.step(dt); }

  /** Car vs light props (see header). Returns the impact speed of the strongest hit this step (m/s), 0 if none. */
  couple(car) {
    const vc = car.vc, S = vc.spec, P = vc.position, Q = vc.quaternion, V = vc.velocity, M = S.mass;
    const hx = S.obb.half[0], hy = S.obb.half[1], hz = S.obb.half[2], cy = S.obb.centerY;
    const n = this.dyn.overlap(P.x - 4, P.y - 1, P.z - 4, P.x + 4, P.y + 3, P.z + 4, this._ids);
    if (!n) return 0;
    let strongest = 0;
    const qi = this._q.copy(Q).invert(), lp = this._p, dv = this._dv, w = this._w;
    for (let k = 0; k < Math.min(n, this._ids.length); k++) {
      const id = this._ids[k];
      const b = this.bodyOf(id);
      if (!b) continue;
      this.dyn.getPose(id, lp, null);
      const wx = lp.x, wy = lp.y, wz = lp.z;
      lp.set(wx - P.x, wy - P.y - cy, wz - P.z).applyQuaternion(qi);
      const r = b.T.r * 0.75;
      const ox = hx + r - Math.abs(lp.x), oz = hz + r - Math.abs(lp.z), oy = hy + b.T.half[1] - Math.abs(lp.y);
      if (ox <= 0 || oz <= 0 || oy <= 0) continue;
      // contact normal (car frame): the axis of least penetration, then to world
      if (ox < oz) dv.set(Math.sign(lp.x), 0, 0); else dv.set(0, 0, Math.sign(lp.z));
      dv.applyQuaternion(Q);
      this.dyn.getVelocity(id, w, null);
      const vrel = (V.x - w.x) * dv.x + (V.z - w.z) * dv.z;
      if (vrel <= 0.2) continue;
      const m = b.T.mass, J = m * (1 + b.T.e) * vrel;
      const seed = ((id * 2654435761) >>> 0) / 4294967296 - 0.5;
      // impulse at a point above the centre and off to one side: the prop tumbles
      this.dyn.applyImpulse(id, wx + seed * 0.2, wy + b.T.half[1] * 0.5, wz - seed * 0.2, dv.x * J, J * (0.18 + 0.12 * Math.min(1, vrel / 15)), dv.z * J);
      // the car pays J / M along the normal
      V.x -= dv.x * J / M; V.z -= dv.z * J / M;
      // out of the box along the normal (so the next step does not hit it again)
      const push = (dv.x * dv.x > 0 ? (ox < oz ? ox : oz) : 0) + 0.02;
      this.dyn.setPose(id, wx + dv.x * push, wy, wz + dv.z * push);
      b.hit = 1; this.hits++;
      if (vrel > strongest) { strongest = vrel; this.lastHitPos.set(wx, wy, wz); }
    }
    this.lastHit = strongest;
    return strongest;
  }

  bodyOf(id) {
    if (!this._map) { this._map = new Map(); for (const b of this.bodies) this._map.set(b.id, b); }
    return this._map.get(id);
  }

  /** Instance matrices from the body poses (the bodies sleep once settled: cheap). */
  render() {
    const p = this._p, q = this._q, m = this._m;
    for (const b of this.bodies) {
      this.dyn.getPose(b.id, p, q);
      m.compose(p, q, this._s);
      this.byType[b.type].mesh.setMatrixAt(b.slot, m);
    }
    for (const t in this.byType) this.byType[t].mesh.instanceMatrix.needsUpdate = true;
  }

  /** Put every prop back where it started (R on the HUD resets the car only; this is for the harness). */
  get awake() { let n = 0; for (const b of this.bodies) if (this.dyn.isAwake(b.id)) n++; return n; }
}

// ------------------------------------------------------------------ ramps
/** Height of the ramps at (x, z) (0 outside): a wedge rising over len to height, with a short flat top, then a drop. */
export function rampHeight(ramps, x, z) {
  let h = 0;
  for (const r of ramps) {
    const dx = x - r.x, dz = z - r.z, c = Math.cos(r.yaw), s = Math.sin(r.yaw);
    // ramp frame: u along the run (0 at the toe, len at the lip), v across
    const u = -(dx * s + dz * c), v = dx * c - dz * s;
    if (Math.abs(v) > r.width / 2 || u < 0 || u > r.len + 0.6) continue;
    const t = Math.min(1, u / r.len), y = r.height * (t * t * 0.35 + t * 0.65);
    h = Math.max(h, y);
  }
  return h;
}
function rampMesh(r) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.9 });
  const N = 16, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * r.len, t = u / r.len, y = r.height * (t * t * 0.35 + t * 0.65);
    pos.push(-r.width / 2, y + 0.04, -u, r.width / 2, y + 0.04, -u);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const top = new THREE.BufferGeometry(); top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); top.setIndex(idx); top.computeVertexNormals();
  const deck = new THREE.Mesh(top, wood); deck.castShadow = deck.receiveShadow = true; g.add(deck);
  // planks (dark gaps) and side frames
  for (let i = 1; i < 14; i++) {
    const u = (i / 14) * r.len, t = u / r.len, y = r.height * (t * t * 0.35 + t * 0.65);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(r.width, 0.012, 0.03), dark); plank.position.set(0, y + 0.05, -u); g.add(plank);
  }
  for (const sx of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0);
    for (let i = 0; i <= N; i++) { const u = (i / N) * r.len, t = u / r.len; sh.lineTo(u, r.height * (t * t * 0.35 + t * 0.65)); }
    sh.lineTo(r.len, 0); sh.closePath();
    const side = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false });
    side.rotateY(Math.PI / 2); side.translate(sx * r.width / 2 - (sx > 0 ? 0 : 0.08), 0, 0);
    const m = new THREE.Mesh(side, dark); m.castShadow = true; g.add(m);
  }
  g.position.set(r.x, r.y ?? 0, r.z); g.rotation.y = r.yaw;
  return g;
}
