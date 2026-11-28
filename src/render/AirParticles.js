// AirParticles: what floats in the air around the camera. Dust motes and pollen that light up toward a low sun,
// drifting leaves, drizzle and rain that glint near lamps, snow, embers, fireflies. One instanced draw call and no
// per-particle CPU work: every particle is a fixed random point in a box that wraps around the camera (the vertex
// shader moves it by time, wind and a slow wobble, and wraps it back into the box), so the air is full wherever the
// camera goes and the cost does not grow with the level. Lit, not textured: the sun's colour with a forward-scatter
// lobe (motes sparkle when you look toward the sun), the sky's ambient, and up to AIR_MAX_LIGHTS point lights you pass
// (rain shows in a street lamp's light and nowhere else, as at night).
//
//   const air = new AirParticles({ preset: 'motes', atmosphere, budget: S.effects.particles });
//   scene.add(air.mesh);
//   per frame: air.update(dt, camera);
//   lamps: air.setLights([{ position: [x, y, z], color: 0xffb070, intensity: 10, range: 12 }]);   // up to 6
//
// Presets (AIR_PRESETS; every key can be overridden in the options): 'motes' (fine dust, additive, strongest toward the
// sun), 'pollen' (fewer, larger, floating up), 'leaves' (tumbling, alpha blended, two colours), 'drizzle' and 'rain'
// (short streaks along their fall, additive: they show where light reaches them), 'snow', 'embers' and 'fireflies'
// (self-lit, blinking; they glow through bloom). An unknown preset throws and lists the names.
//
// Options: preset, count, budget (0..1 multiplies count: a tier's effects.particles), box ([x, y, z] half extents, m),
// size ([min, max] m), fall (m/s, negative rises), wind ([x, y, z] m/s), wobble ([amplitude m, frequency Hz, vertical
// share]), stretch (s: streak length = speed x stretch; 0 = round), spin (rad/s, leaves), color / color2 (linear mix per
// particle), opacity, gain (brightness of the lit term), forward (strength of the lobe toward the sun), ambient (share
// of the sky's light), emissive (self-lit radiance, HDR), blink (Hz, 0 = steady), blending ('additive' | 'normal'),
// shape ('dot' | 'streak' | 'leaf'), minPixels (a particle smaller than this on screen is drawn this size and dimmed
// by the same factor, so far motes do not flicker), fade ([near m, far 0..1 of the box]), lights (how many point
// lights the shader reads, 0..AIR_MAX_LIGHTS), atmosphere (an Atmosphere: sun direction / colour and sky ambient are
// read from it every update), seed.
// API: mesh, count, time (settable: a bench holds it still), update(dt, camera), setLights(list), setWind(x, y, z),
// dispose(). Without an atmosphere: `sunDir`, `sunColor` and `ambientColor` are yours to set (THREE.Vector3 / Color).
//
// Cost: `count` camera-facing quads of a few pixels each (motes: 900 quads, under 10 000 pixels of fill at 1080p), one
// program, no texture, no CPU per particle. Depth-tested, not depth-written, not shadowed. Under TAA they carry no
// velocity (small and slow ones hold; rain streaks soften a little, which suits them).
import * as THREE from 'three';

/** How many point lights the shader can read. */
export const AIR_MAX_LIGHTS = 6;

/** The presets. `count` is at budget 1. */
export const AIR_PRESETS = {
  motes: { count: 900, box: [14, 7, 14], size: [0.012, 0.03], fall: 0.015, wind: [0.12, 0, 0.05], wobble: [0.35, 0.12, 0.6], stretch: 0, spin: 0, color: [1, 0.95, 0.85], color2: [1, 0.86, 0.66], opacity: 0.8, gain: 0.5, forward: 7, ambient: 0.35, emissive: 0, blink: 0, blending: 'additive', shape: 'dot', minPixels: 1.3, fade: [1.2, 0.72] },
  pollen: { count: 260, box: [18, 8, 18], size: [0.04, 0.085], fall: -0.05, wind: [0.35, 0, 0.15], wobble: [0.8, 0.09, 0.5], stretch: 0, spin: 0, color: [1, 0.97, 0.88], color2: [0.96, 0.92, 0.7], opacity: 0.75, gain: 0.8, forward: 5, ambient: 0.5, emissive: 0, blink: 0, blending: 'additive', shape: 'dot', minPixels: 1.4, fade: [1.5, 0.72] },
  leaves: { count: 70, box: [28, 10, 28], size: [0.07, 0.13], fall: 0.85, wind: [1.6, 0, 0.5], wobble: [1.1, 0.22, 0.35], stretch: 0, spin: 2.4, color: [0.42, 0.27, 0.07], color2: [0.5, 0.12, 0.04], opacity: 1, gain: 0.3, forward: 1.2, ambient: 1, emissive: 0, blink: 0, blending: 'normal', shape: 'leaf', minPixels: 1.5, fade: [2, 0.75] },
  drizzle: { count: 2200, box: [11, 8, 11], size: [0.006, 0.01], fall: 6.2, wind: [0.5, 0, 0.2], wobble: [0.03, 0.4, 0], stretch: 0.03, spin: 0, color: [0.8, 0.86, 1], color2: [1, 1, 1], opacity: 0.55, gain: 0.5, forward: 3, ambient: 0.25, emissive: 0, blink: 0, blending: 'additive', shape: 'streak', minPixels: 1, fade: [1, 0.7] },
  rain: { count: 4200, box: [12, 9, 12], size: [0.008, 0.014], fall: 8.5, wind: [1.2, 0, 0.4], wobble: [0.02, 0.5, 0], stretch: 0.045, spin: 0, color: [0.8, 0.86, 1], color2: [1, 1, 1], opacity: 0.6, gain: 0.55, forward: 3, ambient: 0.3, emissive: 0, blink: 0, blending: 'additive', shape: 'streak', minPixels: 1, fade: [1, 0.7] },
  snow: { count: 1800, box: [16, 9, 16], size: [0.018, 0.04], fall: 1.1, wind: [0.5, 0, 0.2], wobble: [0.5, 0.18, 0.2], stretch: 0, spin: 0, color: [1, 1, 1], color2: [0.9, 0.94, 1], opacity: 0.85, gain: 0.45, forward: 1.5, ambient: 1, emissive: 0, blink: 0, blending: 'normal', shape: 'dot', minPixels: 1.3, fade: [1, 0.72] },
  embers: { count: 160, box: [12, 7, 12], size: [0.015, 0.035], fall: -0.7, wind: [0.4, 0, 0.1], wobble: [0.6, 0.3, 0.4], stretch: 0.02, spin: 0, color: [1, 0.42, 0.08], color2: [1, 0.7, 0.2], opacity: 1, gain: 0, forward: 0, ambient: 0, emissive: 9, blink: 1.3, blending: 'additive', shape: 'dot', minPixels: 1.3, fade: [1, 0.72] },
  fireflies: { count: 90, box: [22, 2.6, 22], size: [0.05, 0.08], fall: 0, wind: [0.08, 0, 0.05], wobble: [1.6, 0.07, 0.35], stretch: 0, spin: 0, color: [0.78, 1, 0.3], color2: [1, 0.9, 0.3], opacity: 1, gain: 0, forward: 0, ambient: 0, emissive: 10, blink: 0.45, blending: 'additive', shape: 'dot', minPixels: 1.6, fade: [1.5, 0.75] },
};
const SHAPES = { dot: 0, streak: 1, leaf: 2 };
const KEYS = ['preset', 'count', 'budget', 'box', 'size', 'fall', 'wind', 'wobble', 'stretch', 'spin', 'color', 'color2', 'opacity', 'gain', 'forward',
  'ambient', 'emissive', 'blink', 'blending', 'shape', 'minPixels', 'fade', 'lights', 'atmosphere', 'seed'];

const VS = /* glsl */`
attribute vec4 iSeed;
uniform float uTime, uFall, uStretch, uSpin, uMinPx, uPxAngle, uOpacity, uGain, uForward, uEmissive, uBlink;
uniform vec3 uCam, uBox, uWind, uWobble, uColor, uColor2, uSunDir, uSunCol, uAmbient;
uniform vec2 uSize, uFade;
#if AIR_LIGHTS > 0
uniform vec4 uLightPos[ AIR_LIGHTS ]; // xyz, range (0 = unused)
uniform vec3 uLightCol[ AIR_LIGHTS ];
#endif
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vec3 box2 = uBox * 2.0;
  float ph = iSeed.w * 6.2831853;
  // home point, carried by the wind and its own fall speed, with a slow wobble; then wrapped into the camera's box
  vec3 vel = uWind + vec3( 0.0, - uFall * ( 0.75 + 0.5 * fract( iSeed.w * 5.3 ) ), 0.0 );
  float wt = uTime * uWobble.y * 6.2831853;
  vec3 wob = vec3( sin( wt * ( 0.7 + 0.6 * iSeed.x ) + ph ), sin( wt * ( 0.5 + 0.7 * iSeed.y ) + ph * 1.7 ) * uWobble.z, cos( wt * ( 0.6 + 0.8 * iSeed.z ) + ph * 2.3 ) ) * uWobble.x;
  vec3 p = iSeed.xyz * box2 + vel * uTime + wob;
  vec3 rel = mod( p - uCam + uBox, box2 ) - uBox;
  vec3 world = uCam + rel;
  vec4 mv = viewMatrix * vec4( world, 1.0 );
  float dist = length( mv.xyz );

  // size, never under uMinPx pixels (drawn that size and dimmed instead: no sub-pixel flicker)
  float size = mix( uSize.x, uSize.y, fract( iSeed.w * 7.31 ) );
  float sMin = dist * uPxAngle * uMinPx;
  float dim = min( 1.0, size / max( sMin, 1e-6 ) );
  float w = max( size, sMin );

  // the quad's axes in view space: along the motion for streaks, a spinning axis for leaves, upright otherwise
  vec2 axis = vec2( 0.0, 1.0 );
  float len = w;
  float flat_ = 1.0;
  #if AIR_SHAPE == 1
    vec3 vv = ( viewMatrix * vec4( vel, 0.0 ) ).xyz;
    float sp = length( vv.xy );
    if ( sp > 1e-4 ) axis = vv.xy / sp;
    len = w + sp * uStretch;
    dim *= w / len * 2.0 + 0.25; // a longer streak spreads the same drop over more pixels
  #elif AIR_SHAPE == 2
    float a = ph + uTime * uSpin * ( iSeed.x - 0.5 ) * 2.0;
    axis = vec2( sin( a ), cos( a ) );
    flat_ = 0.25 + 0.75 * abs( cos( uTime * uSpin * 0.8 * ( 0.6 + iSeed.y ) + ph ) ); // tumbling: edge-on now and then
    len = w * 1.7;
  #endif
  vec2 side = vec2( axis.y, - axis.x );
  mv.xy += side * position.x * w * flat_ + axis * position.y * len;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy + 0.5;

  // fades: none in the camera's face, none popping in at the box's faces
  vec3 e = abs( rel ) / uBox;
  float fade = smoothstep( uFade.x * 0.35, uFade.x, dist ) * ( 1.0 - smoothstep( uFade.y, 1.0, max( e.x, max( e.y, e.z ) ) ) );

  // light: sky ambient, the sun with a lobe toward it, the point lights; or its own glow
  vec3 V = normalize( world - cameraPosition );
  float lobe = pow( max( dot( V, uSunDir ), 0.0 ), 6.0 );
  vec3 light = uAmbient + uSunCol * ( 1.0 + uForward * lobe );
  #if AIR_LIGHTS > 0
  for ( int i = 0; i < AIR_LIGHTS; i ++ ) {
    vec3 d = uLightPos[ i ].xyz - world;
    float r2 = dot( d, d ), R = uLightPos[ i ].w;
    float k = clamp( 1.0 - r2 / max( R * R, 1e-4 ), 0.0, 1.0 );
    light += uLightCol[ i ] * ( k * k / ( 1.0 + r2 ) );
  }
  #endif
  vec3 base = mix( uColor, uColor2, fract( iSeed.w * 3.7 ) );
  float blink = uBlink > 0.0 ? pow( 0.5 + 0.5 * sin( uTime * uBlink * 6.2831853 * ( 0.6 + 0.8 * iSeed.y ) + ph * 3.1 ), 3.0 ) : 1.0;
  vCol = vec4( base * ( light * uGain + uEmissive * blink ), uOpacity * dim * fade );
}`;

const FS = /* glsl */`
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vec2 c = vUv - 0.5;
  #if AIR_SHAPE == 1
    float a = ( 1.0 - smoothstep( 0.1, 0.5, abs( c.x ) ) ) * ( 1.0 - smoothstep( 0.2, 0.5, abs( c.y ) ) );
  #elif AIR_SHAPE == 2
    float a = 1.0 - smoothstep( 0.42, 0.5, length( c * vec2( 1.0, 1.0 ) ) + 0.12 * abs( c.x ) );
  #else
    float r = length( c ) * 2.0;
    float a = 1.0 - smoothstep( 0.0, 1.0, r );
    a *= a;
  #endif
  a *= vCol.a;
  if ( a < 0.002 ) discard;
  gl_FragColor = vec4( vCol.rgb, a );
}`;

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const vec = (v, n, what) => {
  if (!Array.isArray(v) || v.length !== n || v.some((x) => !Number.isFinite(x))) throw new Error(`AirParticles: ${what} must be ${n} numbers`);
  return v;
};

/**
 * @typedef {object} AirParticlesOptions
 * @property {string} [preset='motes']  a key of AIR_PRESETS
 * @property {number} [count]  particles at budget 1
 * @property {number} [budget=1]  0..1, multiplies count (a quality tier's effects.particles)
 * @property {number[]} [box]  half extents of the box around the camera, m
 * @property {number[]} [size]  [min, max] m
 * @property {number} [fall]  m/s down (negative rises)
 * @property {number[]} [wind]  m/s
 * @property {number[]} [wobble]  [amplitude m, frequency Hz, vertical share]
 * @property {number} [stretch]  streak seconds (0 = round)
 * @property {number} [spin]  rad/s (leaves)
 * @property {number[]} [color] @property {number[]} [color2]  linear RGB, mixed per particle
 * @property {number} [opacity] @property {number} [gain] @property {number} [forward] @property {number} [ambient]
 * @property {number} [emissive] @property {number} [blink]
 * @property {'additive'|'normal'} [blending] @property {'dot'|'streak'|'leaf'} [shape]
 * @property {number} [minPixels] @property {number[]} [fade]  [near m, far 0..1]
 * @property {number} [lights=0]  point lights the shader reads (0..AIR_MAX_LIGHTS)
 * @property {object} [atmosphere]  an Atmosphere (sun and sky light are read from it every update)
 * @property {number} [seed=1]
 */

export class AirParticles {
  /** @param {AirParticlesOptions} [o] */
  constructor(o = {}) {
    for (const k in o) if (!KEYS.includes(k)) throw new Error(`AirParticles: unknown option '${k}' (options: ${KEYS.join(', ')})`);
    const name = o.preset ?? 'motes', P = AIR_PRESETS[name];
    if (!P) throw new Error(`AirParticles: unknown preset '${name}' (presets: ${Object.keys(AIR_PRESETS).join(', ')})`);
    const c = { ...P, ...o };
    if (!(c.shape in SHAPES)) throw new Error(`AirParticles: unknown shape '${c.shape}' (shapes: ${Object.keys(SHAPES).join(', ')})`);
    if (c.blending !== 'additive' && c.blending !== 'normal') throw new Error(`AirParticles: blending must be 'additive' or 'normal', not '${c.blending}'`);
    const budget = Math.min(1, Math.max(0, o.budget ?? 1));
    const lights = Math.min(AIR_MAX_LIGHTS, Math.max(0, Math.floor(o.lights ?? 0)));
    /** The preset's name. */
    this.preset = name;
    /** Particles drawn. */
    this.count = Math.max(0, Math.round(c.count * budget));
    /** Seconds of motion so far; set it to hold or replay the air. */
    this.time = 0;
    this.atmosphere = o.atmosphere || null;
    this.gain = c.gain; this.ambient = c.ambient;
    /** Sun direction (toward the sun), its radiance and the sky's ambient: read from the atmosphere when there is one. */
    this.sunDir = new THREE.Vector3(0.3, 0.6, 0.4).normalize();
    this.sunColor = new THREE.Color(1, 0.95, 0.85);
    this.ambientColor = new THREE.Color(0.5, 0.6, 0.8);
    this.maxLights = lights;

    const rnd = mulberry((o.seed ?? 1) * 7919 + 13), n = Math.max(1, this.count);
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = this.count;
    const u = this.uniforms = {
      uTime: { value: 0 }, uFall: { value: c.fall }, uStretch: { value: c.stretch }, uSpin: { value: c.spin }, uMinPx: { value: c.minPixels },
      uPxAngle: { value: 2 * Math.tan(27.5 * Math.PI / 180) / 1080 }, uOpacity: { value: c.opacity }, uGain: { value: 1 }, uForward: { value: c.forward },
      uEmissive: { value: c.emissive }, uBlink: { value: c.blink },
      uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...vec(c.box, 3, 'box')) }, uWind: { value: new THREE.Vector3(...vec(c.wind, 3, 'wind')) },
      uWobble: { value: new THREE.Vector3(...vec(c.wobble, 3, 'wobble')) }, uColor: { value: new THREE.Vector3(...vec(c.color, 3, 'color')) },
      uColor2: { value: new THREE.Vector3(...vec(c.color2, 3, 'color2')) }, uSunDir: { value: this.sunDir.clone() }, uSunCol: { value: new THREE.Vector3() },
      uAmbient: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector2(...vec(c.size, 2, 'size')) }, uFade: { value: new THREE.Vector2(...vec(c.fade, 2, 'fade')) },
    };
    if (lights) {
      u.uLightPos = { value: Array.from({ length: lights }, () => new THREE.Vector4()) };
      u.uLightCol = { value: Array.from({ length: lights }, () => new THREE.Vector3()) };
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: u, vertexShader: VS, fragmentShader: FS, defines: { AIR_LIGHTS: lights, AIR_SHAPE: SHAPES[c.shape] },
      transparent: true, depthWrite: false, toneMapped: false, fog: false,
      blending: c.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    /** The mesh to add to the scene (never frustum-culled: it follows the camera). */
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = `air-${name}`;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.visible = this.count > 0;
    // pixels per radian from whatever is being drawn into (the internal size under render scaling)
    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      const rt = renderer.getRenderTarget(), h = rt ? rt.height : renderer.domElement.height;
      const p11 = camera.projectionMatrix.elements[5];
      if (h > 0 && p11 > 0) u.uPxAngle.value = 2 / (p11 * h);
    };
    this._light();
  }

  _light() {
    const a = this.atmosphere, u = this.uniforms;
    if (a) {
      if (a.lightDir) this.sunDir.copy(a.lightDir);
      if (a.sun) this.sunColor.copy(a.sun.color).multiplyScalar(a.sun.intensity / Math.PI);
      if (a.hemi) this.ambientColor.copy(a.hemi.color).multiplyScalar(Math.max(a.hemi.intensity, 0.02) * 2);
    }
    u.uSunDir.value.copy(this.sunDir);
    u.uSunCol.value.set(this.sunColor.r, this.sunColor.g, this.sunColor.b);
    u.uAmbient.value.set(this.ambientColor.r, this.ambientColor.g, this.ambientColor.b).multiplyScalar(this.ambient);
    u.uGain.value = this.gain;
  }

  /**
   * Advance the air and follow the camera. Call once per frame.
   * @param {number} dt
   * @param {THREE.Camera} camera
   */
  update(dt, camera) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    if (camera) camera.getWorldPosition(this.uniforms.uCam.value);
    this._light();
    return this;
  }

  /**
   * The point lights the particles pass through (the nearest lamps): up to `lights` of them, the rest are dropped.
   * @param {Array<{ position: number[]|THREE.Vector3, color?: number|THREE.Color|number[], intensity?: number, range?: number }>} list
   */
  setLights(list) {
    const P = this.uniforms.uLightPos, C = this.uniforms.uLightCol;
    if (!P) return this;
    const col = AirParticles._c || (AirParticles._c = new THREE.Color());
    for (let i = 0; i < this.maxLights; i++) {
      const l = list && list[i];
      if (!l) { P.value[i].set(0, 0, 0, 0); C.value[i].set(0, 0, 0); continue; }
      const p = l.position;
      if (Array.isArray(p)) P.value[i].set(p[0], p[1], p[2], l.range ?? 12); else P.value[i].set(p.x, p.y, p.z, l.range ?? 12);
      if (Array.isArray(l.color)) col.setRGB(l.color[0], l.color[1], l.color[2]); else if (l.color && l.color.isColor) col.copy(l.color); else col.set(l.color ?? 0xffffff);
      const k = l.intensity ?? 1;
      C.value[i].set(col.r * k, col.g * k, col.b * k);
    }
    return this;
  }

  /** Wind in m/s. */
  setWind(x, y, z) { this.uniforms.uWind.value.set(x, y, z); return this; }

  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); if (this.mesh.parent) this.mesh.parent.remove(this.mesh); }
}
