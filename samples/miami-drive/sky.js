// The dusk sky: an analytic after-sunset gradient calibrated against the reference through the dusk grade
// (mauve-grey overhead ~ (46, 39, 43) sRGB, dull rose ~ (90, 70, 70) mid sky, salmon-orange ~ (115, 70, 52) at the
// horizon around the glow) with separate cumulus puffs: value-noise fbm on a cloud layer seen in perspective (puffs
// grow overhead and shrink to thin dark strips toward the horizon), grouped by a low-frequency cluster field so they
// stand apart with clear sky between them, shaded darker than the sky behind them and rim-lit warm near the glow.
// No texture is downloaded (the lit deck's value-noise lattice is a 1024 x 1024 R32F table rendered once at load with
// the shader's own hash, so it reads the same values for a fetch instead of a sin per corner). The glow sits at glowAzimuth (the Dune Road's vanishing point). The dome is the
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
const HASH_N = 1024; // the h2 table covers lattice cells -512..511 on both axes (the lit deck reaches |p| < 400)
const HASH_FS = /* glsl */`
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() { gl_FragColor = vec4(h2(floor(gl_FragCoord.xy) - float(${HASH_N / 2})), 0.0, 0.0, 1.0); }`;
const FS = /* glsl */`
#define HASH_HALF ${HASH_N / 2}
uniform float uExposure, uGlowAz, uSeed, uClouds, uCloudLit;
varying vec3 vDir;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm3(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * n2(p); p = ROT * p + 17.3; a *= 0.5; } return s / 0.875; }
// the lit deck's value noise reads h2 from a table baked once on this GPU with the same expression (HASH_FS): same values
// (HASH_TEX: when the GPU can render to a float target; otherwise the deck hashes per pixel as before, the same picture)
#ifdef HASH_TEX
uniform highp sampler2D tHash;
float hT(vec2 i) { return texelFetch(tHash, ivec2(i) + HASH_HALF, 0).r; }
float nT(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hT(i), hT(i + vec2(1.0, 0.0)), f.x), mix(hT(i + vec2(0.0, 1.0)), hT(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm3T(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * nT(p); p = ROT * p + 17.3; a *= 0.5; } return s / 0.875; }
#else
#define nT n2
#define fbm3T fbm3
#endif
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
  if (uClouds < 0.5 || el < 0.0) return (el < 0.0 ? mix(hor * 0.6, vec3(0.05, 0.04, 0.045), smoothstep(0.0, 0.08, -el)) : sky) * uExposure;
  vec3 col = sky;
  if (uCloudLit < 0.5) {
    // the old puffs (kept for A/B: uCloudLit 0): darker than the sky behind them
    vec2 q = d.xz / pow(d.y + 0.05, 0.8) * 0.95 + vec2(uSeed, -uSeed * 0.7);
    float cluster = n2(q * 0.16 + 5.3) * 0.6 + n2(q * 0.4 - 2.1) * 0.4;
    float body = fbm3(q * 0.85);
    float dens = body * 0.9 + cluster * 0.7 - 0.8;
    float det = n2(q * 3.1 + 4.0) * 0.65 + n2(q * 6.7 - 1.0) * 0.35;
    dens -= (1.0 - det) * 0.1;
    float cov = smoothstep(0.0, 0.05, dens) * smoothstep(0.008, 0.04, e);
    float thick = smoothstep(0.02, 0.3, dens);
    vec3 cc = sky * vec3(0.54, 0.5, 0.54) * (0.7 + 0.45 * det) * (1.0 - 0.35 * thick);
    cc += vec3(0.07, 0.03, 0.01) * glowA * (1.0 - thick) * exp(-e / 0.15);
    return (cov > 0.0 ? mix(sky, cc, cov) : sky) * uExposure;
  }
  // an altostratus / altocumulus deck lit from below by the sun just under the horizon: long soft streaks that run
  // across the glow, warm and bright on their sunward undersides, a pink rim on the thin edges near the glow, cool
  // violet-grey where they turn away; a clear burning gap low over the glow, wisps only overhead (no towers)
  vec2 ax = vec2(sin(uGlowAz), -cos(uGlowAz)), ay = vec2(-ax.y, ax.x);   // toward the glow / across it (xz)
  vec2 w = d.xz / (d.y + 0.07);                                           // the deck in perspective
  // (cost: where the deck is certainly clear, cov is 0 and the colour is the sky, so the work stops as soon as that is
  // known: below e 0.012, or when even the largest density the remaining octaves could add stays under the coverage
  // threshold. The picture is the same as computing it all: value noise never leaves [0, 1].)
  float covE = smoothstep(0.012, 0.06, e);
  if (covE > 0.0) {
  vec2 p = vec2(dot(w, ax) * 1.25, dot(w, ay) * 0.5) + vec2(uSeed, -uSeed * 0.6);  // streaks run across the glow
  p += (vec2(nT(p * 0.45 + 7.1), nT(p * 0.45 + 2.9)) - 0.5) * 1.3;       // domain warp: rolls, not stripes
  float grp = nT(p * 0.17 + 3.7) * 0.42 + nT(p * 0.07 - 1.3) * 0.12 - 0.06;  // groups, clear sky between
  // coverage: patchy, a clear gap low over the glow, thinning overhead
  float gap = glowA * exp(-e / 0.06) * 0.22;
  float c0 = 0.53 + gap + smoothstep(0.25, 0.9, e) * 0.05;
  // fbm4(p), octave by octave: stop once dens cannot lift body over c0 (need: the density body needs to pass c0)
  float need = (c0 - grp) / 0.7 * 0.9375 - 1e-3;
  float s = 0.0, a = 0.5; vec2 pp = p; bool clear = false;
  for (int i = 0; i < 4; i++) { s += a * nT(pp); pp = ROT * pp + 17.3; a *= 0.5; if (s + 2.0 * a - 0.0625 <= need) { clear = true; break; } }
  if (!clear) {
  float dens = s / 0.9375;
  float body = dens * 0.7 + grp;
  float cov = smoothstep(c0, c0 + 0.22, body) * covE;
  if (cov > 0.0) {
  float thick = smoothstep(c0 + 0.05, c0 + 0.4, body);
  // relief: density falling toward the glow = a face the low sun reaches (self-shadowing from the gradient)
  float relief = clamp((dens - fbm3T(p + vec2(0.16, 0.0))) * 5.0 + 0.5, 0.0, 1.0); // (3 octaves: the fine one hardly moves it)
  float nearG = pow(glowA, 1.3);
  vec3 base = mix(vec3(0.16, 0.125, 0.15), vec3(0.075, 0.06, 0.075), thick);                 // cool violet-grey shade
  base = mix(base, sky * vec3(0.9, 0.85, 0.95), 0.45) * (0.75 + 0.55 * relief * relief);
  vec3 litC = mix(vec3(0.5, 0.2, 0.17), vec3(0.95, 0.42, 0.18), nearG);                     // pink overhead, orange at the glow
  float lit = (0.06 + 0.9 * relief * relief * relief) * (0.25 + 0.75 * nearG) * (1.0 - 0.55 * thick) * (0.45 + 0.55 * exp(-e / 0.4));
  vec3 cc = base + litC * lit;
  cc += vec3(1.0, 0.5, 0.32) * cov * (1.0 - cov) * 4.0 * pow(glowA, 3.0) * 0.18 * exp(-e / 0.25); // burning rim
  cc = mix(cc, hor * 0.95, exp(-e * 14.0) * 0.7);                                          // the far deck melts into the haze
  col = mix(sky, cc, cov * 0.92);
  }
  }
  }
  // scud: thin bright wisps low in the gap
  float scK = glowA * exp(-e / 0.05) * smoothstep(0.004, 0.02, e);
  if (scK > 0.01) col += vec3(0.5, 0.2, 0.08) * 0.35 * scK * smoothstep(0.62, 0.85, fbm3T(vec2(dot(w, ax) * 3.0, dot(w, ay) * 0.35) + 11.0));
  return col * uExposure;
}
void main() { gl_FragColor = vec4(skyAt(vDir), 1.0); }`;

/** The h2 table: one R32F texel per lattice cell, rendered once with the shader's own hash so the values match. */
function bakeHash(renderer) {
  const rt = new THREE.WebGLRenderTarget(HASH_N, HASH_N, { type: THREE.FloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
  rt.texture.name = 'duskSky.hash';
  const mat = new THREE.ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: HASH_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(quad);
  const prev = renderer.getRenderTarget(), cam = new THREE.Camera();
  renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(prev);
  mat.dispose(); quad.geometry.dispose();
  return rt;
}

export class DuskSky {
  constructor({ scene, renderer, atmo, glowAzimuth = 0, exposure = 1, cloudLit = true, haze = 0.0022 }) {
    this.cloudLit = cloudLit; this.haze = haze; // haze: the least post-fog density (1 / m) while this sky is up
    this.scene = scene; this.renderer = renderer; this.atmo = atmo;
    this.glowAzimuth = glowAzimuth; this.exposure = exposure; this.active = false; this._ver = -1; this.envRT = null;
  }

  async load() {
    this.hashRT = this.renderer && this.renderer.extensions.has('EXT_color_buffer_float') ? bakeHash(this.renderer) : null;
    this.uniforms = { uExposure: { value: this.exposure }, uGlowAz: { value: this.glowAzimuth }, uSeed: { value: 3.7 }, uClouds: { value: 1 }, uCloudLit: { value: this.cloudLit ? 1 : 0 }, tHash: { value: this.hashRT ? this.hashRT.texture : null } };
    const mat = this._material();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat);
    this.mesh.name = 'dusk-sky'; this.mesh.renderOrder = -100; this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.scene.add(this.mesh);
    return this;
  }

  _material() { return new THREE.ShaderMaterial({ uniforms: this.uniforms, defines: this.hashRT ? { HASH_TEX: '' } : {}, vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, name: 'duskSky' }); }

  /** The dome on for the dusk hours (sun 5 deg above to 8 deg below the horizon), the Atmosphere sky otherwise. */
  wantActive() { const el = Math.asin(this.atmo.sunDir.y); return el < 0.09 && el > -0.14; }

  _apply(on) {
    this.active = on;
    this.mesh.visible = on;
    if (this.atmo.sky) this.atmo.sky.visible = !on;
    if (!on) return;
    // the environment: a PMREM of the graded dome (the car, glass and every PBR surface see the same sky)
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene(); const dome = this.mesh.clone(); dome.material = this.mesh.material.clone(); dome.material.uniforms = this.uniforms; dome.material.depthTest = false; dome.position.set(0, 0, 0); dome.visible = true; envScene.add(dome);
    if (this.envRT) this.envRT.dispose();
    this.envRT = pm.fromScene(envScene, 0.02, 0.1, 100);
    pm.dispose();
    // the post fog's colour cube (Atmosphere.skyCubeRT via its public cubeCam): the same graded dome, so distant
    // ground and sea fade into this sky, not into the Atmosphere's brighter sky toward the sun
    if (this.atmo.cubeCam && this.renderer) this.atmo.cubeCam.update(this.renderer, envScene);
    dome.material.dispose();
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 2.0; // (the dome is dim overhead; the ground needs its light, as in the reference)
    // the hemisphere fill: a cool violet dome over a warm sand bounce (the warm side comes from the afterglow key)
    const h = this.atmo.hemi;
    if (h) { h.color.setRGB(0.52, 0.5, 0.7); h.groundColor.setRGB(0.2, 0.15, 0.12); h.intensity = 1.05; } // (the dusk ground light: the dome's overhead is dark, the low sky lights the ground)
    // distance haze: the hotel row and the far shore fade toward this sky (post fog, Atmosphere.fogParams)
    if (this.atmo.fogParams) this.atmo.fogParams.haze = Math.max(this.atmo.fogParams.haze, this.haze);
  }

  update(camera) {
    if (!this.mesh) return;
    const want = this.wantActive();
    if (want !== this.active || (want && this.atmo.version !== this._ver)) { this._ver = this.atmo.version; this._apply(want); }
    if (this.active) this.mesh.position.copy(camera.position);
  }
}
