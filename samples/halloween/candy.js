// Candy: a fixed pool of pickups (structure of arrays, no allocation per frame) drawn as three instanced meshes
// (wrapped sweets with pleated bow-tie ends, flattened candy-corn kernels, big swirl lollipops worth 5: three distinct
// silhouettes) plus a soft halo each (Glows). Unlit so it glows, but hand-shaded (patchCandy: a fixed key light, a
// glossy highlight, a rim, and the swirl / bands / stripes painted per pixel). Candy rests bobbing and
// spinning on the grass, flies in arcs when spilled (smashed lanterns, booed ghosts, or the kid dropping some when a
// ghost catches it), and is pulled toward the kid inside the magnet radius. Spilled candy that nobody picks up blinks
// and vanishes after a while; resting candy stays.
import * as THREE from 'three';
import { lathe } from './props.js';

const MAX = 220;
export const CANDY_KIND = { WRAP: 0, CORN: 1, POP: 2 };
const VALUE = [1, 1, 5];
const CORN_GLOW = [1, 0.6, 0.15], POP_GLOW = [1, 0.3, 0.8];
const WRAP_COLORS = [[1, 0.18, 0.25], [0.65, 0.3, 1], [0.25, 0.95, 0.45], [1, 0.75, 0.15], [0.2, 0.75, 1], [1, 0.45, 0.85]];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);

// Geometry: each part carries `cpat` (the pattern the candy shader paints per pixel from the part's local position):
// 0 plain (vertex colour x instance colour), 1 the lollipop's swirl, 2 candy corn's three bands, 3 a wrapper's
// diagonal stripes, 4 a wrapper's crinkled end (lighter, the instance colour washed toward white).
function colorize(g, rgb, pat = 0) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('cpat', new THREE.BufferAttribute(new Float32Array(n).fill(pat), 1));
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.index === null) { const ix = new Uint16Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
function merge(parts) {
  // tiny local merge (all indexed): position, normal, color, cpat
  let nv = 0, ni = 0;
  for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), pat = new Float32Array(nv), idx = new Uint16Array(ni);
  let v = 0, i = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3); col.set(g.attributes.color.array, v * 3); pat.set(g.attributes.cpat.array, v);
    const ix = g.index.array; for (let k = 0; k < ix.length; k++) idx[i + k] = ix[k] + v;
    v += g.attributes.position.count; i += ix.length; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('cpat', new THREE.BufferAttribute(pat, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
/** A wrapped sweet: a plump striped body and two pleated, crinkled bow-tie ends (the classic candy silhouette). */
function wrappedGeometry() {
  const W = [1, 1, 1];
  const body = colorize(lathe([[0, -0.12], [0.07, -0.098], [0.09, -0.035], [0.09, 0.035], [0.07, 0.098], [0, 0.12]], 10).rotateZ(Math.PI / 2).scale(1, 1, 0.82), W, 3);
  const parts = [body];
  for (const s of [1, -1]) {
    // a twisted neck, then a fan of pleats flaring out to a wavy rim
    const fan = lathe([[0.022, 0], [0.05, 0.06], [0.095, 0.105]], 12, {
      mod: (th, t) => 1 + 0.13 * t * Math.cos(th * 6),
      dy: (th, t) => (t > 0.6 ? 0.012 * Math.sin(th * 5) : 0),
    });
    fan.rotateZ(-s * Math.PI / 2).scale(1, 1.1, 0.45).translate(s * 0.112, 0, 0);
    parts.push(colorize(fan, W, 4));
    parts.push(colorize(new THREE.TorusGeometry(0.026, 0.01, 3, 6).rotateY(Math.PI / 2).translate(s * 0.112, 0, 0), W, 0)); // the twist
  }
  return merge(parts);
}
/** Candy corn: a flattened kernel, wide rounded base to a blunt tip (bands painted per pixel by height). */
function cornGeometry() {
  const g = lathe([[0, 0], [0.07, 0.004], [0.112, 0.03], [0.108, 0.07], [0.085, 0.14], [0.05, 0.215], [0.022, 0.255], [0, 0.265]], 14).scale(1, 1, 0.58);
  return merge([colorize(g, [1, 1, 1], 2)]);
}
/** The big swirl lollipop (worth 5): a thick disc with a rounded rim (the swirl painted per pixel), a stick, a bow. */
function popGeometry() {
  const disc = lathe([[0, -0.036], [0.2, -0.036], [0.25, -0.025], [0.265, 0], [0.25, 0.025], [0.2, 0.036], [0, 0.036]], 36)
    .rotateX(Math.PI / 2).translate(0, 0.62, 0);
  const stick = colorize(new THREE.CylinderGeometry(0.017, 0.017, 0.5, 8).translate(0, 0.27, 0), [0.95, 0.92, 0.85]);
  const parts = [colorize(disc, [1, 1, 1], 1), stick];
  // a ribbon bow where the stick meets the disc: two loops and two tails
  for (const s of [1, -1]) {
    parts.push(colorize(new THREE.TorusGeometry(0.04, 0.014, 6, 12).scale(1.3, 0.8, 0.6).translate(s * 0.05, 0.39, 0.02), [0.55, 0.3, 1]));
    parts.push(colorize(new THREE.BoxGeometry(0.03, 0.09, 0.008).rotateZ(s * 0.35).translate(s * 0.03, 0.34, 0.02), [0.5, 0.26, 0.95]));
  }
  parts.push(colorize(new THREE.SphereGeometry(0.022, 8, 6).translate(0, 0.39, 0.025), [0.45, 0.22, 0.9]));
  return merge(parts);
}

/**
 * The candy shader: unlit (candy glows in the dark and blooms, as before) but hand-lit by a fixed key from the top
 * left in view space, a glossy highlight and a rim, so every sweet reads as a rounded, shiny 3D thing; plus the per-
 * pixel patterns (cpat) from the part's local position.
 */
function patchCandy(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cpat;\nvarying float vPatHw;\nvarying vec3 vLocHw;\nvarying vec3 vNrmHw;\nvarying vec3 vViewHw;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec3 n = normal;
  #ifdef USE_INSTANCING
    n = mat3( instanceMatrix ) * n;
  #endif
    vNrmHw = normalize( normalMatrix * n );
    vViewHw = - mvPosition.xyz;
    vLocHw = position; vPatHw = cpat;
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPatHw;\nvarying vec3 vLocHw;\nvarying vec3 vNrmHw;\nvarying vec3 vViewHw;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 p = vLocHw;
    if ( vPatHw > 0.5 && vPatHw < 1.5 ) { // the swirl: two arms from the middle, pink on white
      vec2 d = p.xy - vec2( 0.0, 0.62 ); float r = length( d ) / 0.265, a = atan( d.y, d.x );
      float band = smoothstep( -0.12, 0.12, sin( a * 2.0 + r * 11.0 ) );
      diffuseColor.rgb = mix( vec3( 1.0, 0.97, 0.99 ), vec3( 1.0, 0.16, 0.5 ), band );
      diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.55, 0.3, 1.0 ), smoothstep( 0.9, 0.95, r ) * 0.7 );
    } else if ( vPatHw > 1.5 && vPatHw < 2.5 ) { // candy corn: yellow base, orange middle, white tip
      float h = p.y / 0.265;
      diffuseColor.rgb = h < 0.38 ? vec3( 1.0, 0.78, 0.08 ) : h < 0.7 ? vec3( 1.0, 0.4, 0.04 ) : vec3( 1.0, 0.97, 0.9 );
    } else if ( vPatHw > 2.5 && vPatHw < 3.5 ) { // a wrapper's diagonal stripes
      float st = smoothstep( 0.45, 0.55, abs( fract( ( p.x * 1.0 + p.y * 1.3 + p.z * 0.4 ) * 14.0 ) - 0.5 ) * 2.0 );
      diffuseColor.rgb *= mix( 0.85, 1.25, st ) + vec3( 0.12 ) * st; // light and dark of the same hue: saturated
    } else if ( vPatHw > 3.5 ) { // a crinkled end: the wrapper's colour, lighter
      diffuseColor.rgb = diffuseColor.rgb * 1.1 + 0.06;
    }
    vec3 n = normalize( vNrmHw ), v = normalize( vViewHw );
    if ( ! gl_FrontFacing ) n = - n;
    vec3 L = normalize( vec3( - 0.45, 0.75, 0.55 ) );
    float dif = 0.4 + 0.55 * max( dot( n, L ), 0.0 );
    float spec = pow( max( dot( reflect( - L, n ), v ), 0.0 ), 28.0 );
    float rim = pow( 1.0 - max( dot( n, v ), 0.0 ), 3.0 );
    diffuseColor.rgb = diffuseColor.rgb * dif + vec3( 0.75 ) * spec + diffuseColor.rgb * rim * 0.3;
  }`);
  };
  mat.customProgramCacheKey = () => 'hwCandy';
  return mat;
}

export class Candy {
  /**
   * @param {object} o  scene, heightAt, candySpot (world.candySpot), floorAt (optional (x, z, y) -> the surface a falling
   *   candy lands on: the ground or a deck, a bridge, a bale under it; default the ground, heightAt)
   */
  constructor({ scene, heightAt, candySpot, floorAt = null }) {
    this.heightAt = heightAt; this.candySpot = candySpot; this.floorAt = floorAt;
    const f = (k = 1) => new Float32Array(MAX * k);
    this.p = f(3); this.v = f(3); this.age = f(); this.ttl = f(); this.spin = f();
    this.state = new Uint8Array(MAX); // 0 free, 1 resting, 2 flying (spilled), 3 pulled by the magnet
    this.kind = new Uint8Array(MAX); this.color = new Uint8Array(MAX); this.delay = f();
    this.count = 0; this.resting = 0;
    const mat = patchCandy(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.2, 1.2, 1.2), side: THREE.DoubleSide }));
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

  /**
   * A candy falling from `height` m above (x, ground y, z) (the Witching Hour rain): it lands, bounces and stays until
   * `ttl` s; collectable at once. Returns the slot or -1.
   */
  drop(x, y, z, kind, height = 7, ttl = 60) {
    const i = this._alloc(); if (i < 0) return -1;
    this.state[i] = 2; this.kind[i] = kind; this.color[i] = (Math.random() * WRAP_COLORS.length) | 0;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y + height; this.p[i * 3 + 2] = z;
    this.v[i * 3] = 0; this.v[i * 3 + 1] = -2; this.v[i * 3 + 2] = 0;
    this.age[i] = 0; this.ttl[i] = ttl; this.spin[i] = Math.random() * 6.28; this.delay[i] = 0;
    return i;
  }

  countKind(kind) { let n = 0; for (let i = 0; i < MAX; i++) if (this.state[i] !== 0 && this.kind[i] === kind) n++; return n; }
  get restingCount() { let n = 0; for (let i = 0; i < MAX; i++) if (this.state[i] === 1) n++; return n; }

  /**
   * Per frame. kid: { x, y, z } (feet). Collected candy is counted into collectedThisFrame / valueThisFrame (+ the
   * positions of the last pickup in lastX/Y/Z); onPick(i, kind, x, y, z) is called per pickup.
   */
  update(dt, kid, time, onPick) {
    this.collectedThisFrame = 0; this.valueThisFrame = 0; this.popThisFrame = 0;
    const P = this.p, V = this.v, H = this.heightAt, F = this.floorAt, mag = this.magnet, cx = kid.x, cy = kid.y + 0.7, cz = kid.z;
    for (let i = 0; i < MAX; i++) {
      const st = this.state[i];
      if (st === 0) continue;
      this.age[i] += dt;
      const i3 = i * 3;
      if (st === 2) { // flying: ballistic with bounces on the terrain
        V[i3 + 1] -= 14 * dt;
        P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
        const g = F ? F(P[i3], P[i3 + 2], P[i3 + 1]) : H(P[i3], P[i3 + 2]);
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
