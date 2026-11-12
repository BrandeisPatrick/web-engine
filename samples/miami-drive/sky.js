// The dusk sky: an analytic after-sunset gradient calibrated against the reference through the dusk grade
// (mauve-grey overhead ~ (46, 39, 43) sRGB, dull rose ~ (90, 70, 70) mid sky, salmon-orange ~ (115, 70, 52) at the
// horizon around the glow) with separate cumulus puffs: value-noise fbm on a cloud layer seen in perspective (puffs
// grow overhead and shrink to thin dark strips toward the horizon), grouped by a low-frequency cluster field so they
// stand apart with clear sky between them, shaded darker than the sky behind them and rim-lit warm near the glow.
// No texture: nothing is downloaded. The glow sits at glowAzimuth (the Dune Road's vanishing point). The dome is the
// scene's ambient / reflection environment (a PMREM of it), so the car reflects the same sky, and it is rendered into
// the Atmosphere's post-fog colour cube (atmo.cubeCam) so distant haze matches it. The Atmosphere keeps its sun /
// moon light, fog and shadows; its own sky mesh is hidden while the dome is on (dusk only).
//
//   const sky = new DuskSky({ scene, renderer, atmo, glowAzimuth });  await sky.load();
//   per frame: sky.update(camera)  (follows the camera; re-applies itself after an Atmosphere time change)
import * as THREE from 'three';

const VS = /* glsl */`
varying vec3 vDir;
void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const FS = /* glsl */`
uniform float uExposure, uGlowAz, uSeed, uClouds;
varying vec3 vDir;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s / 0.875; }
vec3 skyAt(vec3 d) {
  d = normalize(d);
  float phi = atan(d.x, -d.z), el = asin(clamp(d.y, -1.0, 1.0));
  float da = abs(mod(phi - uGlowAz + 3.14159265, 6.2831853) - 3.14159265);   // azimuth from the glow (rad)
  float glowA = exp(-da * da / 0.9);
  float e = max(el, 0.0);
  vec3 hor = mix(vec3(0.24, 0.14, 0.125), vec3(0.42, 0.17, 0.085), glowA);
  vec3 mid = mix(vec3(0.21, 0.15, 0.16), vec3(0.26, 0.17, 0.18), glowA);
  vec3 zen = vec3(0.045, 0.038, 0.045);
  vec3 sky = mix(hor, mid, smoothstep(0.0, 0.16, e));
  sky = mix(sky, zen, smoothstep(0.08, 0.46, e));
  sky += vec3(0.12, 0.04, 0.01) * glowA * exp(-e / 0.03) * exp(-da * da / 0.06);  // where the sun went down
  // cumulus on a layer 1 unit up: q = horizontal position where the view ray meets it
  if (uClouds < 0.5 || el < 0.0) return (el < 0.0 ? mix(hor * 0.6, vec3(0.05, 0.04, 0.045), smoothstep(0.0, 0.08, -el)) : sky) * uExposure;
  vec2 q = d.xz / pow(d.y + 0.05, 0.8) * 0.95 + vec2(uSeed, -uSeed * 0.7);
  float cluster = n2(q * 0.16 + 5.3) * 0.6 + n2(q * 0.4 - 2.1) * 0.4;     // groups of puffs, clear sky between
  float body = fbm(q * 0.85);
  float dens = body * 0.9 + cluster * 0.7 - 0.8;
  float det = n2(q * 3.1 + 4.0) * 0.65 + n2(q * 6.7 - 1.0) * 0.35;
  dens -= (1.0 - det) * 0.1;                                       // cauliflower edges
  float cov = smoothstep(0.0, 0.05, dens) * smoothstep(0.008, 0.04, e);
  float thick = smoothstep(0.02, 0.3, dens);
  vec3 cc = sky * vec3(0.54, 0.5, 0.54) * (0.7 + 0.45 * det) * (1.0 - 0.35 * thick);   // darker than the sky behind
  cc += vec3(0.07, 0.03, 0.01) * glowA * (1.0 - thick) * exp(-e / 0.15);                // warm-lit thin edges near the glow
  vec3 col = cov > 0.0 ? mix(sky, cc, cov) : sky;
  if (el < 0.0) col = mix(hor * 0.6, vec3(0.05, 0.04, 0.045), smoothstep(0.0, 0.08, -el)); // below the horizon: the haze
  return col * uExposure;
}
void main() { gl_FragColor = vec4(skyAt(vDir), 1.0); }`;

export class DuskSky {
  constructor({ scene, renderer, atmo, glowAzimuth = 0, exposure = 1 }) {
    this.scene = scene; this.renderer = renderer; this.atmo = atmo;
    this.glowAzimuth = glowAzimuth; this.exposure = exposure; this.active = false; this._ver = -1; this.envRT = null;
  }

  async load() {
    this.uniforms = { uExposure: { value: this.exposure }, uGlowAz: { value: this.glowAzimuth }, uSeed: { value: 3.7 }, uClouds: { value: 1 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, name: 'duskSky' });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat);
    this.mesh.name = 'dusk-sky'; this.mesh.renderOrder = -100; this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
    return this;
  }

  /** The dome on for the dusk hours (sun 5 deg above to 8 deg below the horizon), the Atmosphere sky otherwise. */
  wantActive() { const el = Math.asin(this.atmo.sunDir.y); return el < 0.09 && el > -0.14; }

  _apply(on) {
    this.active = on;
    this.mesh.visible = on;
    if (this.atmo.sky) this.atmo.sky.visible = !on;
    if (!on) return;
    // the environment: a PMREM of the graded dome (the car, glass and every PBR surface see the same sky)
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene(); const dome = this.mesh.clone(); dome.material = this.mesh.material.clone(); dome.material.depthTest = false; dome.position.set(0, 0, 0); dome.visible = true; envScene.add(dome);
    if (this.envRT) this.envRT.dispose();
    this.envRT = pm.fromScene(envScene, 0.02, 0.1, 100);
    pm.dispose();
    // the post fog's colour cube (Atmosphere.skyCubeRT via its public cubeCam): the same graded dome, so distant
    // ground and sea fade into this sky, not into the Atmosphere's brighter sky toward the sun
    if (this.atmo.cubeCam && this.renderer) this.atmo.cubeCam.update(this.renderer, envScene);
    dome.material.dispose();
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 1.6; // (the dome is dim overhead; the ground needs its light, as in the reference)
    // the hemisphere fill warm and dim (no cool / blue shade)
    const h = this.atmo.hemi;
    if (h) { h.color.setRGB(0.58, 0.52, 0.56); h.groundColor.setRGB(0.14, 0.125, 0.115); h.intensity = 0.75; } // (the dusk ground light: the dome's overhead is dark, the low sky lights the ground)
    // distance haze: the hotel row and the far shore fade toward this sky (post fog, Atmosphere.fogParams)
    if (this.atmo.fogParams) this.atmo.fogParams.haze = Math.max(this.atmo.fogParams.haze, 0.0022);
  }

  update(camera) {
    if (!this.mesh) return;
    const want = this.wantActive();
    if (want !== this.active || (want && this.atmo.version !== this._ver)) { this._ver = this.atmo.version; this._apply(want); }
    if (this.active) this.mesh.position.copy(camera.position);
  }
}
