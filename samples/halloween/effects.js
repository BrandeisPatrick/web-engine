// Cheap night effects:
//   Glows      additive camera-facing soft discs (one instanced draw): lantern halos, candy halos, ghost auras, wisps.
//              Written per frame through set(i, ...) into reused typed arrays; commit(n) uploads the first n.
//   Sparkles   the engine's pooled ParticleSystem (additive, HDR so bloom picks it up): pickups, smashes, BOO.
//   BooRing    an expanding ring on the ground + a vertical shock shell for the BOO shout.
// Nothing here allocates per frame.
import * as THREE from 'three';
import { ParticleSystem } from '@vibe/engine/render';

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

export class Effects {
  constructor({ scene, heightAt, low }) {
    this.heightAt = heightAt;
    this.sparks = new ParticleSystem({ max: low ? 360 : 900, blending: 'additive', gravity: 4, drag: 1.2, light: 2.4, floorAt: heightAt, bounce: 0.3, name: 'sparks' });
    scene.add(this.sparks.mesh);
    // BOO ring: flat ring on the ground + a translucent dome
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.55, 2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), ringMat);
    this.ring.visible = false; this.ring.renderOrder = 10; this.ring.name = 'booRing';
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
  boo(x, y, z, radius) {
    this.booT = 0; this.booR = radius;
    this.ring.position.set(x, y + 0.08, z); this.dome.position.set(x, y, z);
    this.ring.visible = this.dome.visible = true;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      this.sparks.spawn(x + Math.cos(a) * 0.6, y + 0.4, z + Math.sin(a) * 0.6, Math.cos(a) * radius * 1.4, 0.6, Math.sin(a) * radius * 1.4, 0.55, 0.22, 0.05, 1, 0.8, 0.45, 1.6, 0.4, 0.2, 1, 3, 0);
    }
  }
  update(dt) {
    this.sparks.update(dt);
    if (this.booT < 1) {
      this.booT = Math.min(1, this.booT + dt / 0.55);
      const t = this.booT, e = 1 - (1 - t) * (1 - t) * (1 - t), r = 0.6 + this.booR * e;
      this.ring.scale.set(r, 1, r);
      this.ring.material.opacity = 0.9 * (1 - t);
      this.dome.scale.set(r, r * 0.55, r);
      this.dome.material.opacity = 0.35 * (1 - t) * (1 - t);
      if (t >= 1) this.ring.visible = this.dome.visible = false;
    }
  }
  clear() { this.sparks.clear(); this.booT = 1; this.ring.visible = this.dome.visible = false; }
}
