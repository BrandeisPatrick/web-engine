// Steam from the street: manhole vents (a soft column of puffs that leans with the breeze) and a couple of the
// orange-and-white striped vent stacks the utility puts over a steaming main. Puffs are sprites in one particle
// system (GpuParticleSystem on the desktop tier, the CPU ParticleSystem otherwise: the same spawn API), normal
// blending. Particles are unlit, so each vent's puffs are tinted at spawn by the light around it (the nearest street
// lamp's warm white and the colour of the brightest sign within reach, from the sample's light list): steam over a
// red neon sign glows red. Seeded (no Math.random), so bench poses reproduce once `clear()` and a fixed pre-roll ran.
import * as THREE from 'three';
import { ParticleSystem, GpuParticleSystem } from '@vibe/engine/render';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function puffTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), R = rng(5);
  for (let i = 0; i < 14; i++) {
    const x = S * (0.3 + R() * 0.4), y = S * (0.3 + R() * 0.4), r = S * (0.14 + R() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stackMesh() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f0ea' : '#ff5a12'; g.fillRect(0, i * 32, 64, 32); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // retro-reflective stripes: a little emissive so they read in the headlights' absence
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 });
  const geo = new THREE.CylinderGeometry(0.42, 0.48, 3.4, 20, 1, true); geo.translate(0, 1.7, 0);
  return { geo, mat: m };
}

/**
 * o: { scene, renderer, gpu (bool), vents: [{ x, y, z, stack? }], lights: [{x,y,z,r,g,b}] (sign lights),
 * lamps: Float32Array | [[x,y,z]], budget (0..1), seed }
 */
export class Steam {
  constructor(o) {
    this.R = rng(o.seed ?? 99);
    this.budget = o.budget ?? 1;
    const opts = { max: Math.round(2400 * this.budget), map: puffTexture(), blending: 'normal', gravity: -0.9, drag: 0.6, fadeIn: 0.5, spin: 0.4, light: 1 };
    let sys = null;
    if (o.gpu && GpuParticleSystem.isSupported(o.renderer)) { try { sys = new GpuParticleSystem(o.renderer, { ...opts, sort: false }); } catch (e) { console.warn('[nyc] GPU steam unavailable, CPU particles', e); } }
    this.gpu = !!sys;
    this.sys = sys || new ParticleSystem(opts);
    this.mesh = this.sys.mesh || this.sys.points || this.sys.object;
    if (this.mesh) { this.mesh.renderOrder = 4; this.mesh.frustumCulled = false; o.scene.add(this.mesh); }
    this.vents = o.vents.map((v) => ({ ...v, acc: 0, col: this._tint(v, o.lights, o.lamps) }));
    // stacks
    const st = o.vents.filter((v) => v.stack);
    if (st.length) {
      const { geo, mat } = stackMesh();
      const im = new THREE.InstancedMesh(geo, mat, st.length);
      const m4 = new THREE.Matrix4();
      st.forEach((v, i) => im.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z)));
      im.castShadow = true; im.receiveShadow = true; im.name = 'steam-stacks';
      o.scene.add(im); this.stacks = im;
    }
    this.wind = new THREE.Vector2(0.6, -0.25);
  }

  /** Steam colour at a vent: a cool-white base + the nearest lamp's warmth + the strongest coloured sign light. */
  _tint(v, lights, lamps) {
    const c = [0.16, 0.17, 0.19];
    let best = 0, bc = null;
    for (const l of lights || []) {
      const d2 = (l.x - v.x) ** 2 + (l.y - v.y) ** 2 + (l.z - v.z) ** 2;
      const lum = (l.r + l.g + l.b) / (1 + d2 * 0.02);
      if (lum > best) { best = lum; bc = l; }
    }
    if (bc) { const k = Math.min(0.5, best * 0.08) / Math.max(1e-3, Math.max(bc.r, bc.g, bc.b)); c[0] += bc.r * k; c[1] += bc.g * k; c[2] += bc.b * k; }
    let ld = Infinity;
    if (lamps) for (let i = 0; i < lamps.length; i++) { const p = lamps[i]; const d = (p[0] - v.x) ** 2 + (p[2] - v.z) ** 2; if (d < ld) ld = d; }
    const lk = Math.max(0, 1 - Math.sqrt(ld) / 30) * 0.22;
    c[0] += lk; c[1] += lk * 0.85; c[2] += lk * 0.62;
    return c;
  }

  clear() { if (this.sys.clear) this.sys.clear(); else if (this.sys.reset) this.sys.reset(); }

  /** Seeded pre-roll (bench): clear, then simulate `seconds` at 30 Hz. */
  preroll(seconds, camera) { this.clear(); this.R = rng(99); for (let t = 0; t < seconds; t += 1 / 30) this.update(1 / 30, camera); }

  update(dt, camera) {
    if (dt > 0) {
      const R = this.R, wx = this.wind.x, wz = this.wind.y;
      for (const v of this.vents) {
        const rate = (v.stack ? 26 : 14) * this.budget;
        v.acc += rate * dt;
        while (v.acc >= 1) {
          v.acc -= 1;
          const y0 = v.y + (v.stack ? 3.4 : 0.05);
          const life = 3 + R() * 2.5, s0 = v.stack ? 0.7 : 0.5, s1 = (v.stack ? 4.5 : 3.2) + R() * 1.5;
          const a = (v.stack ? 0.55 : 0.4) * (0.7 + R() * 0.3), c = v.col;
          this.sys.spawn(v.x + (R() - 0.5) * 0.6, y0, v.z + (R() - 0.5) * 0.6, wx * 0.3 + (R() - 0.5) * 0.4, 0.9 + R() * 0.8, wz * 0.3 + (R() - 0.5) * 0.4, life, s0, s1, a, c[0], c[1], c[2]);
        }
      }
    }
    if (this.gpu) this.sys.update(dt, camera); else this.sys.update(dt);
  }
}
