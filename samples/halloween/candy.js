// Candy: a fixed pool of pickups (structure of arrays, no allocation per frame) drawn as three instanced meshes
// (wrapped sweets, candy corn, big swirl lollipops worth 5) plus a soft halo each (Glows). Candy rests bobbing and
// spinning on the grass, flies in arcs when spilled (smashed lanterns, booed ghosts, or the kid dropping some when a
// ghost catches it), and is pulled toward the kid inside the magnet radius. Spilled candy that nobody picks up blinks
// and vanishes after a while; resting candy stays.
import * as THREE from 'three';

const MAX = 220;
export const CANDY_KIND = { WRAP: 0, CORN: 1, POP: 2 };
const VALUE = [1, 1, 5];
const CORN_GLOW = [1, 0.6, 0.15], POP_GLOW = [1, 0.3, 0.8];
const WRAP_COLORS = [[1, 0.18, 0.25], [0.65, 0.3, 1], [0.25, 0.95, 0.45], [1, 0.75, 0.15], [0.2, 0.75, 1], [1, 0.45, 0.85]];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

function colorize(g, rgb) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function merge(parts) {
  // tiny local merge (all indexed): position, normal, color
  let nv = 0, ni = 0;
  for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint16Array(ni);
  let v = 0, i = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3); col.set(g.attributes.color.array, v * 3);
    const ix = g.index.array; for (let k = 0; k < ix.length; k++) idx[i + k] = ix[k] + v;
    v += g.attributes.position.count; i += ix.length; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
function wrappedGeometry() {
  const W = [1, 1, 1];
  return merge([
    colorize(new THREE.SphereGeometry(0.11, 12, 8).scale(1.35, 0.9, 0.9), W),
    colorize(new THREE.ConeGeometry(0.08, 0.12, 8).rotateZ(Math.PI / 2).translate(0.2, 0, 0), W),
    colorize(new THREE.ConeGeometry(0.08, 0.12, 8).rotateZ(-Math.PI / 2).translate(-0.2, 0, 0), W),
  ]);
}
function cornGeometry() {
  // three bands: yellow base, orange middle, white tip
  const g = new THREE.CylinderGeometry(0.0, 0.11, 0.26, 10, 6).translate(0, 0.13, 0);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), p = g.attributes.position;
  for (let i = 0; i < n; i++) {
    const y = p.getY(i) / 0.26, col = y < 0.38 ? [1, 0.8, 0.1] : y < 0.72 ? [1, 0.42, 0.05] : [1, 0.98, 0.92];
    c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv');
  return merge([g]);
}
function popGeometry() {
  // big swirl lollipop: a disc with a two-colour spiral (vertex colours by angle + radius) on a stick
  const disc = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 32, 4).rotateX(Math.PI / 2).translate(0, 0.62, 0);
  const p = disc.attributes.position, n = p.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i) - 0.62, a = Math.atan2(y, x), r = Math.hypot(x, y) / 0.26;
    const band = Math.sin(a * 2 + r * 9) > 0;
    const col = band ? [1, 0.2, 0.55] : [1, 0.95, 0.98];
    c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2];
  }
  disc.setAttribute('color', new THREE.BufferAttribute(c, 3)); disc.deleteAttribute('uv');
  const stick = colorize(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6).translate(0, 0.27, 0), [0.95, 0.92, 0.85]);
  const bow = colorize(new THREE.TorusGeometry(0.05, 0.02, 6, 10).scale(1.6, 1, 1).translate(0, 0.38, 0.02), [0.5, 0.25, 1]);
  return merge([disc, stick, bow]);
}

export class Candy {
  /** @param {object} o  scene, heightAt, candySpot (world.candySpot) */
  constructor({ scene, heightAt, candySpot }) {
    this.heightAt = heightAt; this.candySpot = candySpot;
    const f = (k = 1) => new Float32Array(MAX * k);
    this.p = f(3); this.v = f(3); this.age = f(); this.ttl = f(); this.spin = f();
    this.state = new Uint8Array(MAX); // 0 free, 1 resting, 2 flying (spilled), 3 pulled by the magnet
    this.kind = new Uint8Array(MAX); this.color = new Uint8Array(MAX); this.delay = f();
    this.count = 0; this.resting = 0;
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.5, 1.5, 1.5) });
    this.meshes = [wrappedGeometry(), cornGeometry(), popGeometry()].map((g, k) => {
      const m = new THREE.InstancedMesh(g, mat, k === 2 ? 8 : MAX);
      m.name = ['candyWrap', 'candyCorn', 'candyPop'][k];
      m.frustumCulled = false; m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (k !== 1) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage); }
      scene.add(m);
      return m;
    });
    // light beams over the big lollipops (visible from far away)
    this.beams = [];
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.5, 1.1), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const bg = new THREE.CylinderGeometry(0.35, 0.6, 14, 16, 1, true).translate(0, 7, 0);
    const a = new Float32Array(bg.attributes.position.count);
    // fade the beam toward its top (vertex alpha via colour: additive, so darker = more transparent)
    const col = new Float32Array(bg.attributes.position.count * 3);
    for (let i = 0; i < a.length; i++) { const t = 1 - bg.attributes.position.getY(i) / 14; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = t * t; }
    bg.setAttribute('color', new THREE.BufferAttribute(col, 3)); beamMat.vertexColors = true;
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(bg, beamMat); b.visible = false; b.renderOrder = 7; b.frustumCulled = false; scene.add(b); this.beams.push(b); }
    this.magnet = 2.4;
    this._spot = [0, 0, 0];
    this.collectedThisFrame = 0; this.valueThisFrame = 0; this.popThisFrame = 0;
  }

  reset() { this.state.fill(0); this.count = 0; }

  _alloc() {
    for (let i = 0; i < MAX; i++) if (this.state[i] === 0) return i;
    // full: recycle the oldest spilled one
    let best = -1, ba = -1;
    for (let i = 0; i < MAX; i++) if (this.state[i] === 2 && this.age[i] > ba) { ba = this.age[i]; best = i; }
    return best;
  }

  /** Resting candy at (x, y, z). */
  place(x, y, z, kind) {
    const i = this._alloc(); if (i < 0) return -1;
    this.state[i] = 1; this.kind[i] = kind; this.color[i] = (Math.random() * WRAP_COLORS.length) | 0;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = this.v[i * 3 + 1] = this.v[i * 3 + 2] = 0;
    this.age[i] = 0; this.ttl[i] = Infinity; this.spin[i] = Math.random() * 6.28; this.delay[i] = 0;
    return i;
  }

  /** A resting candy at a random free spot away from (ax, az). Returns the slot or -1. */
  spawnRandom(ax, az, kind = Math.random() < 0.35 ? CANDY_KIND.CORN : CANDY_KIND.WRAP, minDist = 6) {
    if (!this.candySpot(this._spot, ax, az, minDist)) return -1;
    return this.place(this._spot[0], this._spot[1], this._spot[2], kind);
  }

  /** Spill n candies from (x, y, z): they arc out (speed m/s) and become collectable after `delay` s. */
  spill(x, y, z, n, speed = 3, delay = 0.35, ttl = 12) {
    for (let k = 0; k < n; k++) {
      const i = this._alloc(); if (i < 0) return;
      const a = Math.random() * Math.PI * 2, s = speed * (0.5 + Math.random() * 0.6);
      this.state[i] = 2; this.kind[i] = Math.random() < 0.3 ? 1 : 0; this.color[i] = (Math.random() * WRAP_COLORS.length) | 0;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = Math.cos(a) * s; this.v[i * 3 + 1] = 3.5 + Math.random() * 2.5; this.v[i * 3 + 2] = Math.sin(a) * s;
      this.age[i] = 0; this.ttl[i] = ttl; this.spin[i] = Math.random() * 6.28; this.delay[i] = delay;
    }
  }

  countKind(kind) { let n = 0; for (let i = 0; i < MAX; i++) if (this.state[i] !== 0 && this.kind[i] === kind) n++; return n; }
  get restingCount() { let n = 0; for (let i = 0; i < MAX; i++) if (this.state[i] === 1) n++; return n; }

  /**
   * Per frame. kid: { x, y, z } (feet). Collected candy is counted into collectedThisFrame / valueThisFrame (+ the
   * positions of the last pickup in lastX/Y/Z); onPick(i, kind, x, y, z) is called per pickup.
   */
  update(dt, kid, time, onPick) {
    this.collectedThisFrame = 0; this.valueThisFrame = 0; this.popThisFrame = 0;
    const P = this.p, V = this.v, H = this.heightAt, mag = this.magnet, cx = kid.x, cy = kid.y + 0.7, cz = kid.z;
    for (let i = 0; i < MAX; i++) {
      const st = this.state[i];
      if (st === 0) continue;
      this.age[i] += dt;
      const i3 = i * 3;
      if (st === 2) { // flying: ballistic with bounces on the terrain
        V[i3 + 1] -= 14 * dt;
        P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
        const g = H(P[i3], P[i3 + 2]);
        if (P[i3 + 1] < g) { P[i3 + 1] = g; V[i3 + 1] *= -0.35; V[i3] *= 0.6; V[i3 + 2] *= 0.6; if (Math.abs(V[i3 + 1]) < 0.6) { V[i3] = V[i3 + 1] = V[i3 + 2] = 0; } }
        if (this.age[i] > this.ttl[i]) { this.state[i] = 0; continue; }
        // keep inside the fence
        if (P[i3] > 48) { P[i3] = 48; V[i3] = -Math.abs(V[i3]); } if (P[i3] < -48) { P[i3] = -48; V[i3] = Math.abs(V[i3]); }
        if (P[i3 + 2] > 48) { P[i3 + 2] = 48; V[i3 + 2] = -Math.abs(V[i3 + 2]); } if (P[i3 + 2] < -48) { P[i3 + 2] = -48; V[i3 + 2] = Math.abs(V[i3 + 2]); }
      }
      if (this.age[i] < this.delay[i]) continue;
      const dx = cx - P[i3], dy = cy - (P[i3 + 1] + 0.35), dz = cz - P[i3 + 2], d2 = dx * dx + dy * dy + dz * dz;
      const reach = this.kind[i] === 2 ? 1.1 : 0.75;
      if (d2 < reach * reach) {
        const k = this.kind[i];
        this.state[i] = 0;
        this.collectedThisFrame++; this.valueThisFrame += VALUE[k]; if (k === 2) this.popThisFrame++;
        if (onPick) onPick(i, k, P[i3], P[i3 + 1] + 0.35, P[i3 + 2]);
        continue;
      }
      if (d2 < mag * mag && this.kind[i] !== 2) { // magnet: accelerate toward the kid's chest
        this.state[i] = 3;
        const d = Math.sqrt(d2), pull = 9 + 14 * (1 - d / mag);
        P[i3] += dx / d * pull * dt; P[i3 + 1] += dy / d * pull * dt; P[i3 + 2] += dz / d * pull * dt;
      } else if (st === 3) { this.state[i] = 2; V[i3] = V[i3 + 1] = V[i3 + 2] = 0; this.ttl[i] = Math.max(this.ttl[i], this.age[i] + 8); }
    }
    this._draw(time);
  }

  _draw(time) {
    const M = this.meshes, cnt = [0, 0, 0], P = this.p;
    let beams = 0;
    for (let i = 0; i < MAX; i++) {
      const st = this.state[i];
      if (st === 0) continue;
      const k = this.kind[i], mesh = M[k], j = cnt[k];
      if (k === 2 && j >= mesh.instanceMatrix.count) continue;
      const i3 = i * 3, t = time + this.spin[i];
      // blinking before a spilled candy expires
      const left = this.ttl[i] - this.age[i];
      if (left < 2.5 && (Math.floor(left * 8) & 1)) { mesh.setMatrixAt(j, _zero); cnt[k]++; continue; }
      const bob = st === 1 ? 0.32 + Math.sin(t * 2.4) * 0.08 : 0.2;
      const s = k === 2 ? 1.25 : 1;
      _q.setFromEuler(_e.set(k === 0 ? 0.35 : 0, t * (k === 2 ? 1.2 : 1.8), 0));
      mesh.setMatrixAt(j, _m.compose(_p.set(P[i3], P[i3 + 1] + bob, P[i3 + 2]), _q, _s.set(s, s, s)));
      if (k === 0) { const c = WRAP_COLORS[this.color[i]]; mesh.instanceColor.setXYZ(j, c[0], c[1], c[2]); }
      if (k === 2 && beams < this.beams.length) { const b = this.beams[beams++]; b.visible = true; b.position.set(P[i3], P[i3 + 1], P[i3 + 2]); }
      cnt[k]++;
    }
    for (let k = 0; k < 3; k++) {
      const m = M[k]; m.count = cnt[k];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    for (let b = beams; b < this.beams.length; b++) this.beams[b].visible = false;
  }

  /**
   * Halo glows for every live candy into `glows` from slot `base`; returns slots used. cam (optional, a Vector3): halos
   * of far candy grow (up to 2.2x at 28 m) so a sweet across the field still reads as a dot on a phone screen.
   */
  glow(glows, base, time, cam = null) {
    let n = 0;
    const P = this.p;
    for (let i = 0; i < MAX; i++) {
      if (this.state[i] === 0) continue;
      const i3 = i * 3, k = this.kind[i], c = k === 0 ? WRAP_COLORS[this.color[i]] : k === 1 ? CORN_GLOW : POP_GLOW;
      const bob = this.state[i] === 1 ? 0.32 + Math.sin((time + this.spin[i]) * 2.4) * 0.08 : 0.2;
      let far = 1;
      if (cam && k !== 2) { const d = Math.hypot(P[i3] - cam.x, P[i3 + 2] - cam.z); far = 1 + 1.2 * Math.min(1, Math.max(0, (d - 7) / 21)); }
      const a = k === 2 ? 0.5 : 0.19;
      glows.set(base + n++, P[i3], P[i3 + 1] + bob + (k === 2 ? 0.6 : 0), P[i3 + 2], k === 2 ? 2.4 : 1.0 * far, c[0] * a, c[1] * a, c[2] * a);
    }
    return n;
  }
}
