// Cheap night effects:
//   Glows      additive camera-facing soft discs (one instanced draw): lantern halos, candy halos, ghost auras, wisps.
//              Written per frame through set(i, ...) into reused typed arrays; commit(n) uploads the first n.
//   Sparkles   the engine's pooled ParticleSystem (additive, HDR so bloom picks it up): pickups, smashes, BOO.
//   BooRing    an expanding shockwave on the ground (two ripples) + a vertical shock shell for the BOO shout.
//   Flashes    short glow bursts (smash, BOO, a big pop) written into the shared Glows.
//   Bats       a small colony circling over the graveyard against the moon (one instanced draw; the flight and the
//              wing beat are computed in the vertex shader from one time uniform).
// Nothing here allocates per frame.
import * as THREE from 'three';
import { ParticleSystem, makeCanvas } from '@vibe/engine/render';

const GLOW_VS = /* glsl */`
attribute vec3 iPos;
attribute vec4 iData; // rgb (linear, premultiplied intensity), size (m)
varying vec2 vUv;
varying vec3 vCol;
void main() {
  vUv = position.xy;
  vec4 mv = modelViewMatrix * vec4( iPos, 1.0 );
  float d = -mv.z;
  float near = smoothstep( 0.4, 2.2, d );            // fade out right in front of the lens
  vCol = iData.rgb * near;
  // pull the quad toward the eye along the view ray (same spot and size on screen) by 0.45 of its size: a halo sits on
  // the grass, and without this the ground cut its lower half off in a hard straight edge (a boxy glow on phones)
  float k = max( 0.3, d - iData.w * 0.45 ) / max( d, 1e-3 );
  mv.xyz *= k;
  mv.xy += position.xy * iData.w * k;
  gl_Position = projectionMatrix * mv;
}`;
const GLOW_FS = /* glsl */`
varying vec2 vUv;
varying vec3 vCol;
void main() {
  float r = length( vUv ) * 2.0;
  float a = 1.0 - smoothstep( 0.0, 1.0, r );
  a *= a;
  gl_FragColor = vec4( vCol * a, 1.0 );
}`;

export class Glows {
  constructor(max = 256, { renderOrder = 9, name = 'glows' } = {}) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(max * 3); this.data = new Float32Array(max * 4);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.InstancedBufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iData', this.aData);
    g.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder; this.mesh.name = name;
    this.geometry = g;
  }
  set(i, x, y, z, size, r, g, b) {
    if (i >= this.max) return;
    const p = i * 3, d = i * 4;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.data[d] = r; this.data[d + 1] = g; this.data[d + 2] = b; this.data[d + 3] = size;
  }
  commit(n) {
    n = Math.min(n, this.max);
    this.geometry.instanceCount = n;
    if (n > 0) {
      this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, n * 3); this.aPos.needsUpdate = true;
      this.aData.clearUpdateRanges(); this.aData.addUpdateRange(0, n * 4); this.aData.needsUpdate = true;
    }
    this.mesh.visible = n > 0;
  }
}

/** Shockwave ring texture: dark inside, a soft rise to a bright crest near the rim, a crisp outer edge (additive rgb). */
function ringTexture() {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgb(0,0,0)'); gr.addColorStop(0.6, 'rgb(4,4,4)'); gr.addColorStop(0.82, 'rgb(48,48,48)');
  gr.addColorStop(0.94, 'rgb(255,255,255)'); gr.addColorStop(0.97, 'rgb(120,120,120)'); gr.addColorStop(1, 'rgb(0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const FLASHES = 12;

export class Effects {
  constructor({ scene, heightAt, low }) {
    this.heightAt = heightAt;
    this.sparks = new ParticleSystem({ max: low ? 360 : 900, blending: 'additive', gravity: 4, drag: 1.2, light: 2.4, floorAt: heightAt, bounce: 0.3, name: 'sparks' });
    scene.add(this.sparks.mesh);
    // short-lived glow flashes (smash, BOO, a big pop), drawn through the shared Glows: x, y, z, size, r, g, b, life, age
    this.flashes = new Float32Array(FLASHES * 9); this.nextFlash = 0;
    // BOO ring: a soft shockwave disc on the ground (+ a second, later ripple) and a translucent dome
    const tex = ringTexture();
    const ringMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 0.6, 2.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), ringMat);
    this.ring.visible = false; this.ring.renderOrder = 10; this.ring.name = 'booRing';
    this.ring2 = new THREE.Mesh(this.ring.geometry, ringMat.clone());
    this.ring2.material.color.setRGB(0.35, 0.6, 1.6);
    this.ring2.visible = false; this.ring2.renderOrder = 10; this.ring2.name = 'booRing2';
    scene.add(this.ring2);
    const domeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.25, 1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    this.dome.visible = false; this.dome.renderOrder = 10;
    scene.add(this.ring, this.dome);
    this.booT = 1; this.booR = 7;
  }

  /** Burst of n sparks at (x, y, z): colour (r, g, b) linear, speed m/s, up bias. */
  burst(x, y, z, n, r, g, b, speed = 3, up = 2, life = 0.8, size = 0.12) {
    const S = this.sparks;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, k = speed * (0.4 + Math.random() * 0.6), h = Math.sqrt(1 - e * e);
      S.spawn(x, y, z, Math.cos(a) * h * k, e * k * 0.6 + up, Math.sin(a) * h * k, life * (0.6 + Math.random() * 0.6), size, size * 0.2, 1, r, g, b, r * 0.6, g * 0.3, b * 0.5);
    }
  }
  /** Rising motes (a candy appearing, a lantern regrowing). */
  motes(x, y, z, n, r, g, b) {
    const S = this.sparks;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 0.5;
      S.spawn(x + Math.cos(a) * d, y + Math.random() * 0.3, z + Math.sin(a) * d, 0, 0.8 + Math.random() * 1.2, 0, 0.7 + Math.random() * 0.5, 0.09, 0.02, 1, r, g, b, r, g, b, 0.5, -0.5);
    }
  }
  /** A glow flash at (x, y, z): size (m), colour (linear, premultiplied), life (s). */
  flash(x, y, z, size, r, g, b, life = 0.35) {
    const F = this.flashes, k = this.nextFlash * 9;
    this.nextFlash = (this.nextFlash + 1) % FLASHES;
    F[k] = x; F[k + 1] = y; F[k + 2] = z; F[k + 3] = size; F[k + 4] = r; F[k + 5] = g; F[k + 6] = b; F[k + 7] = life; F[k + 8] = 0;
  }
  /** The live flashes into `glows` from slot `base` (each swells a little and fades); returns slots used. */
  glow(glows, base) {
    const F = this.flashes;
    let n = 0;
    for (let i = 0; i < FLASHES; i++) {
      const k = i * 9, life = F[k + 7];
      if (!(life > 0) || F[k + 8] >= life) continue;
      const u = F[k + 8] / life, a = (1 - u) * (1 - u), sz = F[k + 3] * (0.7 + 0.5 * Math.sqrt(u));
      glows.set(base + n++, F[k], F[k + 1], F[k + 2], sz, F[k + 4] * a, F[k + 5] * a, F[k + 6] * a);
    }
    return n;
  }
  boo(x, y, z, radius) {
    this.booT = 0; this.booR = radius;
    this.ring.position.set(x, y + 0.08, z); this.ring2.position.set(x, y + 0.1, z); this.dome.position.set(x, y, z);
    this.ring.visible = this.dome.visible = true;
    this.flash(x, y + 0.9, z, 3.6, 0.32, 0.16, 0.66, 0.4);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.sparks.spawn(x + Math.cos(a) * 0.6, y + 0.4, z + Math.sin(a) * 0.6, Math.cos(a) * radius * 1.4, 0.6, Math.sin(a) * radius * 1.4, 0.55, 0.22, 0.05, 1, 0.8, 0.45, 1.6, 0.4, 0.2, 1, 3, 0);
    }
  }
  update(dt) {
    this.sparks.update(dt);
    const F = this.flashes;
    for (let k = 0; k < FLASHES * 9; k += 9) if (F[k + 8] < F[k + 7]) F[k + 8] += dt; // age the live ones
    if (this.booT < 1) {
      this.booT = Math.min(1, this.booT + dt / 0.55);
      const t = this.booT, e = 1 - (1 - t) * (1 - t) * (1 - t), r = 0.6 + this.booR * e;
      this.ring.scale.set(r, 1, r);
      this.ring.material.opacity = 0.95 * (1 - t);
      // the second ripple starts a beat later and stays smaller
      const t2 = Math.max(0, (t - 0.22) / 0.78), e2 = 1 - (1 - t2) * (1 - t2), r2 = 0.4 + this.booR * 0.72 * e2;
      this.ring2.visible = t2 > 0 && t < 1;
      this.ring2.scale.set(r2, 1, r2);
      this.ring2.material.opacity = 0.6 * (1 - t2);
      this.dome.scale.set(r, r * 0.55, r);
      this.dome.material.opacity = 0.35 * (1 - t) * (1 - t);
      if (t >= 1) this.ring.visible = this.ring2.visible = this.dome.visible = false;
    }
  }
  clear() {
    this.sparks.clear(); this.booT = 1; this.ring.visible = this.ring2.visible = this.dome.visible = false;
    this.flashes.fill(0);
  }
}

/** Bat silhouette: a body and two scalloped wings in the xz plane (span along x); `flap` attribute = |x| / half span. */
function batGeometry() {
  const P = [], F = [];
  const v = (x, y, z) => { P.push(x, y, z); F.push(Math.min(1, Math.abs(x) / 0.62)); return P.length / 3 - 1; };
  const idx = [];
  // body (a thin diamond) and ears
  const b0 = v(0, 0.02, 0.2), b1 = v(0.07, 0, 0), b2 = v(0, 0.02, -0.24), b3 = v(-0.07, 0, 0);
  idx.push(b0, b1, b2, b0, b2, b3);
  const e0 = v(0.035, 0.0, 0.17), e1 = v(0.05, 0.0, 0.27), e2 = v(0.012, 0, 0.2);
  const e3 = v(-0.035, 0.0, 0.17), e4 = v(-0.05, 0.0, 0.27), e5 = v(-0.012, 0, 0.2);
  idx.push(e0, e1, e2, e3, e5, e4);
  for (const s of [1, -1]) { // wing: leading edge to the tip, a scalloped trailing edge back to the body
    const root0 = v(0.06 * s, 0, 0.1), tip = v(0.62 * s, 0, 0.05);
    const t1 = v(0.47 * s, 0, -0.14), m1 = v(0.4 * s, 0, -0.06), t2 = v(0.3 * s, 0, -0.2), m2 = v(0.22 * s, 0, -0.1), t3 = v(0.09 * s, 0, -0.16);
    const root1 = v(0.06 * s, 0, -0.08);
    const fan = [tip, t1, m1, t2, m2, t3, root1];
    for (let k = 0; k < fan.length - 1; k++) idx.push(root0, fan[k], fan[k + 1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('flap', new THREE.Float32BufferAttribute(F, 1));
  g.setIndex(idx);
  return g;
}

export class Bats {
  /**
   * The flight is computed in the vertex shader from one time uniform (per bat: orbit radius, angular speed, phase,
   * height offset, size), so a frame costs one uniform write and no matrix upload.
   * @param {object} o  scene, count (8), center [x, y, z] of the colony, radius (m)
   */
  constructor({ scene, count = 8, center = [26, 17, -36], radius = 14 }) {
    this.n = count; this.t = 0;
    this.time = { value: 0 };
    const C = new THREE.Vector3(center[0], center[1], center[2]);
    const mat = new THREE.MeshBasicMaterial({ color: '#07050b', side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBatT = this.time;
      sh.uniforms.uBatC = { value: C };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute float flap;
attribute vec4 batP; // orbit radius, angular speed (signed), phase, height offset
attribute vec2 batS; // size, index
uniform float uBatT;
uniform vec3 uBatC;
vec3 hwRotYXZ( vec3 v, float x, float y, float z ) { // three's Euler 'YXZ': Ry * Rx * Rz
  float c = cos( z ), s = sin( z ); v = vec3( c * v.x - s * v.y, s * v.x + c * v.y, v.z );
  c = cos( x ); s = sin( x ); v = vec3( v.x, c * v.y - s * v.z, s * v.y + c * v.z );
  c = cos( y ); s = sin( y ); return vec3( c * v.x + s * v.z, v.y, - s * v.x + c * v.z );
}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    float i = batS.y, w = sin( uBatT * 15.0 + i * 1.7 );
    transformed.y += flap * ( 0.34 * w + 0.06 ) - ( 1.0 - flap ) * 0.03 * w; // the wings beat
    transformed.x *= 1.0 - 0.18 * flap * max( w, 0.0 );
    // a wobbly loop: an ellipse with a figure-eight drift and a bob; the bat faces along its velocity and banks
    float a = uBatT * batP.y + batP.z, r = batP.x;
    vec3 pos = uBatC + vec3( cos( a ) * r + sin( a * 2.3 + i ) * 2.2, batP.w + sin( a * 3.1 + i ) * 1.2, sin( a ) * r * 0.7 + cos( a * 1.7 + i ) * 1.6 );
    float yaw = atan( - sin( a ) * r * batP.y, cos( a ) * r * 0.7 * batP.y );
    transformed = hwRotYXZ( transformed * batS.x, sin( a * 3.1 + i ) * 0.25, yaw, - cos( a ) * 0.5 * sign( batP.y ) ) + pos;
  }`);
    };
    mat.customProgramCacheKey = () => 'hwBats';
    const g = batGeometry(), P = new Float32Array(count * 4), S = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453, f = h - Math.floor(h);
      P[i * 4] = radius * (0.45 + 0.55 * f); P[i * 4 + 1] = (0.28 + 0.2 * ((i * 0.37) % 1)) * (i % 3 === 0 ? -1 : 1);
      P[i * 4 + 2] = i * 2.39; P[i * 4 + 3] = (f - 0.5) * 7;
      S[i * 2] = 1.6 + 0.8 * ((i * 0.61) % 1); S[i * 2 + 1] = i;
    }
    g.setAttribute('batP', new THREE.InstancedBufferAttribute(P, 4));
    g.setAttribute('batS', new THREE.InstancedBufferAttribute(S, 2));
    this.mesh = new THREE.InstancedMesh(g, mat, count); // identity instance matrices: the shader places each bat
    this.mesh.name = 'bats'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }
  update(dt) {
    this.t = (this.t + dt) % 3600;
    this.time.value = this.t;
  }
}
