// The living night of Midnight Candy Run: weather and wildlife that build up from a breezy 11:57 to a storm at
// midnight. One Environment, driven by the round clock (update(dt, clock 0..1, kid position)); the Witching Hour
// finale can push it further (setFinale(on)). Everything that moves is animated on the GPU from a few uniforms or
// from per-instance data written only when something happens; nothing here allocates per frame, and nothing calls
// Math.random (its own seeded stream: the game's random sequence, and with it the captured media, stays as it was).
//   storm      0.08 at the start -> 1 at midnight (f^1.6), >= 0.9 while the finale is on; eased (no pops)
//   wind       a breeze plus gusts (more, stronger, closer together toward midnight). The grass (looks.js LOOK.wind),
//              the dead trees and their shadows (world.js WIND, the props material) and the leaves all follow it
//   leaves     Fliers: autumn leaves streaming through a box around the view (positions from the integrated wind
//              offset in the vertex shader) + leaves kicked up at the kid's feet while it runs; the crows ride in the
//              same instanced draw
//   sky        MoonClouds: dark wisps with moonlit edges racing across the moon (the moonlight dims while one covers
//              it); the sky's cloud layer thickens and speeds up; a blood moon in the last seconds / the finale
//   mist       the post fog's ground mist and haze thicken; MistField: drifting moonlit mist banks around the view,
//              and mist pouring out of a grave as a ghost rises (additive soft quads, one draw)
//   lightning  soft sheet lightning (sky, clouds and the ambient fill brighten for under a second, never a hard
//              strobe; reduced motion: one slow, dim swell), thunder a moment later
//   crows      Crows (state; drawn by Fliers): perched on the gate finials, the scarecrow, the crypt and the tall
//              stones; they lift off when the kid runs near (or a BOO / thunder), fly off, and glide back later
//   lights     every lamp, candle and window of the merged glow mesh flickers by its light group (world.glowLevels):
//              flames gutter in the gusts, the house windows blink out now and then near midnight and at a strike
//   gate       the graveyard's gate leaves (part of the props mesh, world.js) swing in the gusts, and creak
// Draw calls: three (Fliers, MistField, MoonClouds); world.js gave back one (the moon and its halo are one quad now).
//   sound      on the game's AudioBus: wind swells with the gusts, thunder, caws and wing beats, the gate's creak
// prefers-reduced-motion calms it: slower leaves, clouds and sway, no blinking windows, dimmer slow flashes.
import * as THREE from 'three';
import { mulberry32, pfbm, makeCanvas } from '@vibe/engine/render';
import { NoiseVoice, playTone, makeFilter, makeGain } from '@vibe/engine/audio';
import { WIND, GLOW } from './world.js';
import { LOOK } from './looks.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const STORM0 = 0.08, FINALE_STORM = 0.9;
const WIND_DIR = new THREE.Vector2(1, 0.3).normalize(); // toward east-south-east, like the cloud drift
const REBASE = 3000; // s: the shader clock and every stored time stamp step back by this much (float precision)

/** prefers-reduced-motion (false where matchMedia is missing). */
export function prefersReducedMotion() {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// ---------------------------------------------------------------------------------------------- leaves and crows
// One instanced draw for both: an instance is a leaf (lfB.x >= 0) or a crow (lfB.x = -1). The geometry holds one leaf
// and one crow (fp.x: the part a vertex belongs to); the vertex shader collapses the part that is not the instance's
// (degenerate triangles: no fragments), so the crows cost no draw call of their own.
const FLY_VS_PARS = /* glsl */`
attribute vec2 fp;  // part (0 leaf, 1 crow), wing flap weight (0 body .. 1 tip)
attribute vec4 lfA; // leaf: seed x, seed height, seed z, size (m)        | crow: perch x, y, z, yaw
attribute vec4 lfB; // leaf: tumble axis (theta, phi), drift factor, phase  | crow: -1
attribute vec4 lfC; // leaf: kicked origin xyz, birth time (-1 ambient, -1e6 unused) | crow: take-off t, return t, away x, z
attribute vec4 lfD; // leaf: kicked velocity xyz, spin (rad/s)              | crow: return-from x, z, seed, size
uniform float uEnvT;
uniform vec3 uLfC;  // leaf field centre (x, ground y, z)
uniform vec4 uLfO;  // integrated wind offset x, fall, z; tumble phase
uniform vec4 uLfP;  // half size (m), height (m), active share, flutter (m)
vec3 lfPos; vec3 lfAx; float lfAng; float lfScl;
vec3 crPos; vec3 crRo; float crFold; float crRate; float crVis;
bool flyCrow; bool flyHide;
vec3 lfRot( vec3 v, vec3 a, float t ) { float c = cos( t ), s = sin( t ); return v * c + cross( a, v ) * s + a * dot( a, v ) * ( 1.0 - c ); }
vec3 crRot( vec3 v, vec3 r ) { // pitch r.x, yaw r.y, roll r.z
  float c = cos( r.z ), s = sin( r.z ); v = vec3( c * v.x - s * v.y, s * v.x + c * v.y, v.z );
  c = cos( r.x ); s = sin( r.x ); v = vec3( v.x, c * v.y - s * v.z, s * v.y + c * v.z );
  c = cos( r.y ); s = sin( r.y ); return vec3( c * v.x + s * v.z, v.y, - s * v.x + c * v.z );
}
void lfPlace() {
  lfAx = vec3( sin( lfB.x ) * cos( lfB.y ), cos( lfB.x ), sin( lfB.x ) * sin( lfB.y ) );
  float ph = lfB.w;
  if ( lfC.w < 0.0 && lfC.w > - 1e5 ) {
    // drifting with the wind through a box around the view, wrapping at its sides (faded there)
    float B = uLfP.x, H = uLfP.y;
    vec3 q = vec3( lfA.x * 2.0 * B, lfA.y * H, lfA.z * 2.0 * B ) + vec3( uLfO.x, - uLfO.y, uLfO.z ) * lfB.z;
    float rx = mod( q.x - uLfC.x + B, 2.0 * B ), rz = mod( q.z - uLfC.z + B, 2.0 * B ), ry = mod( q.y, H );
    lfPos = vec3( uLfC.x - B + rx, uLfC.y + ry, uLfC.z - B + rz );
    lfPos += vec3( sin( uEnvT * 1.3 + ph ), 0.4 * sin( uEnvT * 2.1 + ph * 2.3 ), cos( uEnvT * 1.1 + ph * 1.7 ) ) * uLfP.w;
    float edge = min( min( rx, 2.0 * B - rx ), min( rz, 2.0 * B - rz ) );
    lfScl = lfA.w * smoothstep( 0.0, 2.5, edge ) * smoothstep( 0.0, 0.6, ry ) * smoothstep( H, H - 1.2, ry )
      * step( fract( ph * 7.13 ), uLfP.z );
    lfAng = uLfO.w * ( 0.6 + lfB.z ) + ph;
  } else {
    // kicked up at the kid's feet: thrown, fluttering down, resting a moment, gone
    float tau = uEnvT - lfC.w, life = 1.7;
    float e = ( 1.0 - exp( - 2.4 * tau ) ) / 2.4;
    lfPos = lfC.xyz + lfD.xyz * e;
    lfPos.y = max( lfPos.y - 0.9 * tau * tau, lfC.y + 0.03 );
    lfPos.xz += vec2( sin( tau * 5.0 + ph ), cos( tau * 4.3 + ph ) ) * 0.06 * tau;
    lfScl = tau < 0.0 || tau > life ? 0.0 : lfA.w * smoothstep( 0.0, 0.06, tau ) * smoothstep( life, life - 0.45, tau );
    lfAng = tau * lfD.w + ph;
  }
  lfScl *= smoothstep( 1.6, 4.5, distance( lfPos, cameraPosition ) ); // none drifts across the lens
}
void crPlace() {
  const float RET = 4.5;
  float t = uEnvT, sd = lfD.z, tau = t - lfC.x, rho = ( t - lfC.y ) / RET;
  crPos = lfA.xyz; crRo = vec3( 0.0, lfA.w, 0.0 ); crFold = 1.0; crRate = 0.0; crVis = 1.0;
  if ( tau < 0.0 || rho >= 1.0 ) {
    // perched: looks around now and then, a little hop
    crRo.y += 0.7 * sin( floor( t * 0.4 + sd * 9.0 ) * 2.3 + sd * 17.0 );
    crPos.y += 0.05 * pow( max( 0.0, sin( t * 1.3 + sd * 11.0 ) ), 24.0 );
    crRo.x = - 0.38;
  } else if ( rho < 0.0 ) {
    // flying off: up and away from the kid, accelerating, a weave; gone (far, in the fog) after ~7 s
    vec2 d = lfC.zw;
    float s = 3.2 * tau + 1.7 * tau * tau, h = 1.9 * tau + 0.45 * tau * tau, wv = sin( tau * 2.2 + sd * 7.0 ) * 0.9 * min( tau, 1.0 );
    crPos += vec3( d.x * s - d.y * wv, h, d.y * s + d.x * wv );
    crRo = vec3( 0.35 * exp( - tau * 1.5 ), atan( d.x, d.y ), 0.35 * cos( tau * 2.2 + sd * 7.0 ) );
    crFold = 1.0 - smoothstep( 0.0, 0.12, tau ); crRate = 15.0;
    crVis = smoothstep( 7.0, 5.6, tau );
  } else {
    // gliding home from far off, wings braking at the end
    float u = 1.0 - rho;
    vec2 d = lfD.xy;
    crPos += vec3( d.x * 40.0 * pow( u, 1.4 ), 11.0 * u * u + 0.25 * u, d.y * 40.0 * pow( u, 1.4 ) );
    crRo = vec3( - 0.15 + 0.6 * smoothstep( 0.8, 1.0, rho ), atan( - d.x, - d.y ), 0.25 * sin( rho * 6.0 + sd ) );
    crFold = smoothstep( 0.93, 1.0, rho ); crRate = mix( 6.0, 16.0, smoothstep( 0.75, 0.95, rho ) );
    crVis = smoothstep( 0.0, 0.15, rho );
  }
}
void flyPlace() {
  flyCrow = lfB.x < - 0.5;
  flyHide = ( fp.x > 0.5 ) != flyCrow;
  if ( flyCrow ) crPlace(); else lfPlace();
}
`;
const FLY_VS_BEGIN = /* glsl */`
  if ( flyHide ) transformed = vec3( 0.0 );
  else if ( flyCrow ) {
    // folded wings tuck along the body; open ones beat
    float w = sin( uEnvT * crRate + lfD.z * 13.0 ), flap = fp.y;
    vec3 v = position;
    v.x = mix( v.x, sign( v.x ) * min( abs( v.x ), 0.06 ) + v.x * 0.04, crFold * step( 0.05, flap ) );
    v.z -= crFold * flap * 0.05;
    v.y += ( 1.0 - crFold ) * flap * ( 0.3 * w + 0.05 ) + crFold * flap * 0.02;
    transformed = crRot( v * lfD.w * crVis, crRo ) + crPos;
  } else transformed = lfRot( position * lfScl, lfAx, lfAng ) + lfPos;
`;

/** A leaf: a pointed oval with a crease, in the xy plane (a fan around the centre). */
function leafParts(P, N, F, I) {
  const outline = [[0, 0.5], [0.2, 0.3], [0.27, 0.04], [0.2, -0.24], [0.04, -0.42], [0, -0.5], [-0.04, -0.42], [-0.2, -0.24], [-0.27, 0.04], [-0.2, 0.3]];
  const o = P.length / 3;
  P.push(0, 0, 0); N.push(0, 0, 1); F.push(0, 0);
  for (const [x, y] of outline) { P.push(x, y, -0.07 * Math.abs(x) / 0.27); N.push(0, 0, 1); F.push(0, 0); }
  for (let i = 0; i < outline.length; i++) I.push(o, o + 1 + i, o + 1 + ((i + 1) % outline.length));
}
/** A crow (+z forward, wings along x, fp.y = |x| / span on the wings). */
function crowParts(P, N, F, I) {
  const o = P.length / 3, Q = [], W = [], J = [];
  const v = (x, y, z, f = 0) => { Q.push(x, y, z); W.push(f); return Q.length / 3 - 1; };
  const tri = (a, b, c) => J.push(a, b, c);
  const Nn = v(0, 0.025, 0.21), T = v(0, 0.07, 0.03), Bt = v(0, -0.055, 0.03), L = v(-0.065, 0.005, 0.03), R = v(0.065, 0.005, 0.03), TB = v(0, 0.015, -0.13);
  tri(Nn, T, R); tri(Nn, R, Bt); tri(Nn, Bt, L); tri(Nn, L, T); tri(TB, R, T); tri(TB, Bt, R); tri(TB, L, Bt); tri(TB, T, L); // body
  const b0 = v(-0.016, 0.03, 0.2), b1 = v(0.016, 0.03, 0.2), b2 = v(0, 0.012, 0.29); tri(b0, b1, b2);                      // beak
  const t0 = v(-0.04, 0.015, -0.12), t1 = v(0.04, 0.015, -0.12), t2 = v(0.075, 0.0, -0.3), t3 = v(-0.075, 0.0, -0.3);
  tri(t0, t1, t2); tri(t0, t2, t3);                                                                                        // tail
  for (const s of [1, -1]) {
    const r0 = v(0.05 * s, 0.03, 0.09, 0.11), r1 = v(0.05 * s, 0.03, -0.06, 0.11), m0 = v(0.22 * s, 0.025, 0.08, 0.5);
    const tip = v(0.44 * s, 0.0, -0.04, 1), f0 = v(0.38 * s, 0.0, -0.12, 0.86), f1 = v(0.26 * s, 0.0, -0.13, 0.6);
    tri(r0, m0, r1); tri(m0, tip, f0); tri(m0, f0, f1); tri(m0, f1, r1);                                                  // wings
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(Q, 3)); g.setIndex(J); g.computeVertexNormals();
  const n = g.attributes.normal.array;
  for (let i = 0; i < W.length; i++) { P.push(Q[i * 3], Q[i * 3 + 1], Q[i * 3 + 2]); N.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]); F.push(1, W[i]); }
  for (const j of J) I.push(o + j);
  g.dispose();
}

class Fliers {
  /**
   * count ambient leaves + kick leaves (for the kid's feet) + crows (one per perch, up to `crows`); U: the shared time
   * uniform. Instances: [0, count) ambient, [count, crowBase) kicked, then the crows.
   */
  constructor({ scene, count, kick, perches, crows, rng, U }) {
    this.count = count; this.kick = kick; this.next = 0;
    const nc = this.crowCount = Math.min(crows, perches.length), n = count + kick + nc;
    this.crowBase = count + kick;
    const P = [], N = [], F = [], I = [];
    leafParts(P, N, F, I); crowParts(P, N, F, I);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('fp', new THREE.Float32BufferAttribute(F, 2));
    g.setIndex(I);
    const A = new Float32Array(n * 4), Bv = new Float32Array(n * 4), C = new Float32Array(n * 4), D = new Float32Array(n * 4);
    for (let i = 0; i < this.crowBase; i++) {
      A[i * 4] = rng(); A[i * 4 + 1] = rng(); A[i * 4 + 2] = rng(); A[i * 4 + 3] = 0.15 + rng() * 0.11;
      Bv[i * 4] = rng() * Math.PI; Bv[i * 4 + 1] = rng() * Math.PI * 2; Bv[i * 4 + 2] = 0.7 + rng() * 0.6; Bv[i * 4 + 3] = rng() * 100;
      C[i * 4 + 3] = i < count ? -1 : -1e6; // ambient / a kick slot never used
    }
    this.perch = perches.slice(0, nc);
    for (let c = 0; c < nc; c++) {
      const i = this.crowBase + c, p = this.perch[c];
      A[i * 4] = p[0]; A[i * 4 + 1] = p[1] + 0.06; A[i * 4 + 2] = p[2]; A[i * 4 + 3] = p[3]; // (the feet on the perch)
      Bv[i * 4] = -1; C[i * 4] = 1e6; C[i * 4 + 1] = 1e6; D[i * 4 + 2] = rng(); D[i * 4 + 3] = 1.25 + rng() * 0.3;
    }
    this.aC = new THREE.InstancedBufferAttribute(C, 4).setUsage(THREE.DynamicDrawUsage);
    this.aD = new THREE.InstancedBufferAttribute(D, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('lfA', new THREE.InstancedBufferAttribute(A, 4));
    g.setAttribute('lfB', new THREE.InstancedBufferAttribute(Bv, 4));
    g.setAttribute('lfC', this.aC); g.setAttribute('lfD', this.aD);
    this.u = { uLfC: { value: new THREE.Vector3() }, uLfO: { value: new THREE.Vector4() }, uLfP: { value: new THREE.Vector4(13, 4.5, 0.5, 0.3) }, uLfFill: { value: 0.07 } };
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.u, { uEnvT: U });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${FLY_VS_PARS}`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tflyPlace();\n\tobjectNormal = flyCrow ? crRot( objectNormal, crRo ) : lfRot( objectNormal, lfAx, lfAng );')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FLY_VS_BEGIN}`);
      // a little self light: a leaf still reads as a leaf against the dark grass (a crow stays black)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uLfFill;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uLfFill;');
    };
    mat.customProgramCacheKey = () => 'hwFliers';
    this.mesh = new THREE.InstancedMesh(g, mat, n); // identity instance matrices: the shader places everything
    this.mesh.name = 'windLeavesCrows'; this.mesh.frustumCulled = false;
    const col = new THREE.Color(), PAL = [[0.34, 0.11, 0.03], [0.5, 0.21, 0.04], [0.4, 0.26, 0.06], [0.28, 0.07, 0.05], [0.55, 0.34, 0.08], [0.22, 0.14, 0.05]];
    for (let i = 0; i < this.crowBase; i++) { const p = PAL[Math.floor(rng() * PAL.length)], k = 0.8 + rng() * 0.4; this.mesh.setColorAt(i, col.setRGB(p[0] * k, p[1] * k, p[2] * k)); }
    for (let i = this.crowBase; i < n; i++) this.mesh.setColorAt(i, col.setRGB(0.022, 0.02, 0.03));
    this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }
  _touch(i) {
    this.aC.addUpdateRange(i * 4, 4); this.aD.addUpdateRange(i * 4, 4);
    this.aC.needsUpdate = this.aD.needsUpdate = true;
  }
  /** Kick one leaf up from (x, y, z) with velocity (vx, vy, vz) at time t. */
  spawn(t, x, y, z, vx, vy, vz, spin) {
    const i = this.count + this.next; this.next = (this.next + 1) % this.kick;
    const C = this.aC.array, D = this.aD.array, k = i * 4;
    C[k] = x; C[k + 1] = y; C[k + 2] = z; C[k + 3] = t;
    D[k] = vx; D[k + 1] = vy; D[k + 2] = vz; D[k + 3] = spin;
    this._touch(i);
  }
  /** Leaves kicked within the last `life` s of t. */
  live(t, life = 1.7) {
    let n = 0;
    const C = this.aC.array;
    for (let i = this.count; i < this.crowBase; i++) if (t - C[i * 4 + 3] < life) n++;
    return n;
  }
  clearKicks() {
    const C = this.aC.array;
    for (let i = this.count; i < this.crowBase; i++) C[i * 4 + 3] = -1e6;
    this.aC.clearUpdateRanges(); this.aC.needsUpdate = true;
  }
  /** The clock steps back by dt (now: the time before it): live kicks keep their age, old ones become unused slots. */
  rebase(dt, now) {
    const C = this.aC.array;
    for (let i = this.count; i < this.crowBase; i++) C[i * 4 + 3] = C[i * 4 + 3] > now - 10 ? C[i * 4 + 3] - dt : -1e6;
    this.aC.clearUpdateRanges(); this.aC.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------- mist
const MIST_VS = /* glsl */`
attribute vec4 msA; // bank: seed x, seed z, size (m), seed | puff: x, y, z, birth time
attribute vec4 msB; // mode (0 bank, 1 puff), seed, drift speed factor, -
uniform float uEnvT;
uniform vec3 uMsC;  // centre (x, ground y, z)
uniform vec4 uMsO;  // wind offset x, z, half size, -
uniform vec4 uMsK;  // bank amount, puff amount, -, -
uniform vec3 uMsCol, uMsPuff;
varying vec2 vUv;
varying vec3 vCol;
varying vec2 vOff;
void main() {
  vec3 c; float w, h, a;
  if ( msB.x < 0.5 ) {
    float B = uMsO.z;
    float rx = mod( msA.x * 2.0 * B + uMsO.x * msB.z - uMsC.x + B, 2.0 * B ), rz = mod( msA.y * 2.0 * B + uMsO.y * msB.z - uMsC.z + B, 2.0 * B );
    c = vec3( uMsC.x - B + rx, uMsC.y + msA.z * 0.16, uMsC.z - B + rz );
    w = msA.z * 2.3; h = msA.z * 0.62;
    float edge = min( min( rx, 2.0 * B - rx ), min( rz, 2.0 * B - rz ) );
    a = uMsK.x * smoothstep( 0.0, 5.0, edge ) * ( 0.75 + 0.25 * sin( uEnvT * 0.4 + msA.w * 6.0 ) );
    vCol = uMsCol;
  } else {
    float tau = uEnvT - msA.w, life = 3.6;
    c = msA.xyz + vec3( sin( msB.y * 6.3 ) * 0.35 * tau, 0.38 * tau, cos( msB.y * 6.3 ) * 0.35 * tau );
    w = h = 0.9 + 1.1 * tau;
    a = tau < 0.0 || tau > life ? 0.0 : uMsK.y * smoothstep( 0.0, 0.45, tau ) * smoothstep( life, 1.2, tau );
    vCol = uMsPuff;
  }
  vec4 mv = modelViewMatrix * vec4( c, 1.0 );
  float d = - mv.z;
  a *= smoothstep( msB.x < 0.5 ? 4.0 : 1.5, msB.x < 0.5 ? 9.0 : 4.0, d ); // no bank over the lens
  vCol *= a;
  if ( a < 0.002 ) { gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); vUv = vec2( 0.0 ); vOff = vec2( 0.0 ); return; } // (clipped: no fill)
  // pulled toward the eye by part of its height (same place on screen): the ground does not cut a hard edge into it
  float k = max( 0.3, d - h * 0.45 ) / max( d, 1e-3 );
  mv.xyz *= k;
  mv.xy += position.xy * vec2( w, h ) * k;
  vUv = position.xy;
  vOff = vec2( msB.y * 3.7 + uEnvT * 0.012, msB.y * 1.3 );
  gl_Position = projectionMatrix * mv;
}`;
const MIST_FS = /* glsl */`
uniform sampler2D tMist;
varying vec2 vUv;
varying vec3 vCol;
varying vec2 vOff;
void main() {
  vec2 q = vUv * 2.0;
  float r = dot( q, q );
  float n = texture2D( tMist, vUv * vec2( 1.4, 0.5 ) + vOff ).r;
  float a = ( 1.0 - smoothstep( 0.15, 1.0, r ) ) * smoothstep( 0.25, 0.75, n );
  gl_FragColor = vec4( vCol * a, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A small tileable noise (R8): the mist's texture. */
function mistTexture() {
  const S = 64, d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = pfbm(x / S, y / S, 4, 4, 61, 0.55), i = (y * S + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = Math.round(255 * v); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true; t.name = 'hwMist';
  return t;
}

class MistField {
  constructor({ scene, banks, puffs, rng, U }) {
    this.banks = banks; this.puffs = puffs; this.next = 0;
    const n = banks + puffs, g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = new Float32Array(n * 4), B = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const puff = i >= banks;
      if (!puff) { A[i * 4] = rng(); A[i * 4 + 1] = rng(); A[i * 4 + 2] = 2.8 + rng() * 2.6; A[i * 4 + 3] = rng(); } else A[i * 4 + 3] = -1e6;
      B[i * 4] = puff ? 1 : 0; B[i * 4 + 1] = rng(); B[i * 4 + 2] = 0.6 + rng() * 0.5;
    }
    this.aA = new THREE.InstancedBufferAttribute(A, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('msA', this.aA); g.setAttribute('msB', new THREE.InstancedBufferAttribute(B, 4));
    g.instanceCount = n;
    this.u = {
      uEnvT: U, uMsC: { value: new THREE.Vector3() }, uMsO: { value: new THREE.Vector4(0, 0, 20, 0) }, uMsK: { value: new THREE.Vector4(0.3, 1, 0, 0) },
      uMsCol: { value: new THREE.Color(0.065, 0.06, 0.11) }, uMsPuff: { value: new THREE.Color(0.075, 0.12, 0.1) }, tMist: { value: mistTexture() },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'mist'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 7;
    scene.add(this.mesh);
  }
  /** Mist pouring out of the ground at (x, y, z) from time t (a few staggered puffs). */
  pour(t, x, y, z, rng, count = 5) {
    const A = this.aA.array;
    for (let k = 0; k < count; k++) {
      const i = this.banks + this.next; this.next = (this.next + 1) % this.puffs;
      const a = rng() * Math.PI * 2, r = rng() * 0.5;
      A[i * 4] = x + Math.cos(a) * r; A[i * 4 + 1] = y + 0.1; A[i * 4 + 2] = z + Math.sin(a) * r; A[i * 4 + 3] = t + k * 0.22;
    }
    this.aA.clearUpdateRanges(); this.aA.addUpdateRange(this.banks * 4, this.puffs * 4); this.aA.needsUpdate = true;
  }
  live(t) { let n = 0; const A = this.aA.array; for (let i = this.banks; i < this.banks + this.puffs; i++) { const u = t - A[i * 4 + 3]; if (u > -1 && u < 3.6) n++; } return n; }
  clearPuffs() { const A = this.aA.array; for (let i = this.banks; i < this.banks + this.puffs; i++) A[i * 4 + 3] = -1e6; this.aA.clearUpdateRanges(); this.aA.needsUpdate = true; }
  rebase(dt, now) {
    const A = this.aA.array;
    for (let i = this.banks; i < this.banks + this.puffs; i++) A[i * 4 + 3] = A[i * 4 + 3] > now - 10 ? A[i * 4 + 3] - dt : -1e6;
    this.aA.clearUpdateRanges(); this.aA.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------- clouds over the moon
const WISP_D = 410, MOON_R = 30; // m: in front of the moon billboard (world.js: 420 m, radius 30 m)
const WISP_VS = /* glsl */`
attribute vec4 mcA; // span seed 0..1, vertical offset (m), width (m), height (m)
attribute vec4 mcB; // speed factor, uv flip, uv row, appearance threshold
uniform vec3 uMcPos, uMcR, uMcU;
uniform vec4 uMcP;  // phase (m), half span (m), density, -
varying vec2 vUv;
varying float vA;
varying float vProx;
varying vec2 vTM;
void main() {
  float S = uMcP.y;
  float sx = mod( mcA.x * 2.0 * S + uMcP.x * mcB.x, 2.0 * S ) - S;
  vec3 c = uMcPos + uMcR * sx + uMcU * mcA.y;
  vec3 p = c + uMcR * position.x * mcA.z + uMcU * position.y * mcA.w;
  vec2 rel = vec2( sx + position.x * mcA.z, mcA.y + position.y * mcA.w );
  vProx = exp( - dot( rel, rel ) / ( 2.0 * 75.0 * 75.0 ) );
  vA = uMcP.z * smoothstep( S, S * 0.55, abs( sx ) ) * smoothstep( mcB.w, mcB.w + 0.25, uMcP.z );
  vUv = vec2( mcB.y > 0.5 ? 1.0 - uv.x : uv.x, uv.y * 0.5 + mcB.z * 0.5 );
  // toward the moon in texture space (a texel step): the lit edge is the side the moon is behind
  vec2 tm = - rel / max( length( rel ), 1.0 );
  vTM = vec2( tm.x * ( mcB.y > 0.5 ? - 1.0 : 1.0 ) / mcA.z, tm.y * 0.5 / mcA.w ) * 7.0;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}`;
const WISP_FS = /* glsl */`
uniform sampler2D tWisp;
uniform vec3 uMcBody, uMcLit, uMcFlash;
varying vec2 vUv;
varying float vA;
varying float vProx;
varying vec2 vTM;
void main() {
  float a = texture2D( tWisp, vUv ).a;
  float lit = clamp( ( a - texture2D( tWisp, vUv + vTM ).a ) * 2.5, 0.0, 1.0 ); // thinning toward the moon: backlit
  vec3 col = uMcBody + uMcLit * ( lit * vProx + 0.06 * vProx ) + uMcFlash * ( 0.4 + 0.6 * a );
  gl_FragColor = vec4( col, a * vA * ( 0.55 + 0.45 * vProx ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Two rows of wispy cloud shapes (alpha), 256 x 128. */
function wispTexture() {
  const W = 256, H = 128, c = makeCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), D = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const row = y < H / 2 ? 0 : 1, v = (y % (H / 2)) / (H / 2), u = x / W;
    const ex = (u - 0.5) / 0.5, ey = (v - 0.5) / 0.5;
    const shape = Math.max(0, 1 - (ex * ex * (row ? 0.9 : 1.1) + ey * ey * 1.4 + 0.25 * Math.sin(ex * 5 + row * 2) * ey));
    const n = pfbm(u * 2, v * (row ? 1.3 : 1.0) + row * 0.5, 4, 5, 71 + row * 9, 0.55);
    const a = smooth(clamp((n - 0.42) * 2.4 + shape * 0.9 - 0.15, 0, 1)) * smooth(Math.min(1, shape * 2.2)) * 0.95;
    const i = (y * W + x) * 4;
    D[i] = D[i + 1] = D[i + 2] = 255; D[i + 3] = Math.round(255 * a);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.name = 'hwWisps';
  return t;
}

class MoonClouds {
  constructor({ scene, count, rng }) {
    this.n = count;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.A = new Float32Array(count * 4); this.B = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      this.A[i * 4] = (i + rng() * 0.6) / count; this.A[i * 4 + 1] = (rng() - 0.5) * 2 * MOON_R * 1.6;
      this.A[i * 4 + 2] = 110 + rng() * 70; this.A[i * 4 + 3] = 36 + rng() * 24;
      this.B[i * 4] = 0.75 + rng() * 0.5; this.B[i * 4 + 1] = rng() < 0.5 ? 1 : 0; this.B[i * 4 + 2] = i % 2; this.B[i * 4 + 3] = (i / count) * 0.55;
    }
    g.setAttribute('mcA', new THREE.InstancedBufferAttribute(this.A, 4));
    g.setAttribute('mcB', new THREE.InstancedBufferAttribute(this.B, 4));
    g.instanceCount = count;
    this.u = {
      uMcPos: { value: new THREE.Vector3() }, uMcR: { value: new THREE.Vector3(1, 0, 0) }, uMcU: { value: new THREE.Vector3(0, 1, 0) },
      uMcP: { value: new THREE.Vector4(0, 230, 0.4, 0) }, tWisp: { value: wispTexture() },
      uMcBody: { value: new THREE.Color(0.016, 0.014, 0.034) }, uMcLit: { value: new THREE.Color(0.5, 0.5, 0.62) }, uMcFlash: { value: new THREE.Color(0, 0, 0) },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: WISP_VS, fragmentShader: WISP_FS, transparent: true, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'moonClouds'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1.5; // after the moon, before the skyline
    scene.add(this.mesh);
    this.cover = 0;
  }
  /** Place the wisps around the moon (seen from cam) and return how much of the moon they cover (0..1). */
  update(cam, moonPos, phase, density) {
    const u = this.u, dir = _d.copy(moonPos).sub(cam).normalize();
    u.uMcPos.value.copy(cam).addScaledVector(dir, WISP_D);
    u.uMcR.value.crossVectors(dir, _up).normalize();
    u.uMcU.value.crossVectors(u.uMcR.value, dir);
    const P = u.uMcP.value, S = P.y;
    P.x = phase; P.z = density;
    let clear = 1;
    for (let i = 0; i < this.n; i++) {
      const A = this.A, B = this.B, sx = ((((A[i * 4] * 2 * S + phase * B[i * 4]) % (2 * S)) + 2 * S) % (2 * S)) - S;
      const fade = smooth((S - Math.abs(sx)) / (S * 0.45)) * smooth((density - B[i * 4 + 3]) / 0.25);
      const gx = sx / (A[i * 4 + 2] * 0.3), gy = A[i * 4 + 1] / (A[i * 4 + 3] * 0.3);
      clear *= 1 - 0.85 * density * fade * Math.exp(-0.5 * (gx * gx + gy * gy));
    }
    return (this.cover = 1 - clear);
  }
}
const _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------- crows (state)
/** The crows' state machine on the CPU; their instance data lives in the Fliers mesh (written on changes only). */
class Crows {
  constructor(fly) {
    this.fly = fly; this.n = fly.crowCount; this.perch = fly.perch; this.base = fly.crowBase;
    this.state = new Uint8Array(this.n); // 0 perched, 1 away, 2 coming back
    this.t0 = new Float64Array(this.n); this.wait = new Float32Array(this.n);
  }
  /** Crow i takes off at time t, away from (fx, fz). */
  launch(i, t, fx, fz, rng) {
    if (this.state[i] !== 0) return false;
    const p = this.perch[i], B = this.fly.aC.array, k = (this.base + i) * 4;
    let dx = p[0] - fx, dz = p[2] - fz;
    const l = Math.hypot(dx, dz) || 1, a = Math.atan2(dz / l, dx / l) + (rng() - 0.5) * 1.2;
    dx = Math.cos(a); dz = Math.sin(a);
    B[k] = t; B[k + 1] = t + 1e5; B[k + 2] = dx; B[k + 3] = dz;
    this.state[i] = 1; this.t0[i] = t; this.wait[i] = 9 + rng() * 7;
    this.fly._touch(this.base + i);
    return true;
  }
  /** Per frame: crows that flew off come back once the kid is away from their perch. */
  update(t, kx, kz, rng) {
    const B = this.fly.aC.array, C = this.fly.aD.array;
    for (let i = 0; i < this.n; i++) {
      const s = this.state[i], p = this.perch[i], k = (this.base + i) * 4;
      if (s === 1 && t - this.t0[i] > this.wait[i]) {
        if (Math.hypot(p[0] - kx, p[2] - kz) < 11) { this.wait[i] += 3; continue; }
        const a = rng() * Math.PI * 2;
        C[k] = Math.cos(a); C[k + 1] = Math.sin(a); B[k + 1] = t;
        this.state[i] = 2; this.t0[i] = t;
        this.fly._touch(this.base + i);
      } else if (s === 2 && t - this.t0[i] > 4.6) this.state[i] = 0;
    }
  }
  get away() { let n = 0; for (let i = 0; i < this.n; i++) if (this.state[i] !== 0) n++; return n; }
  reset() {
    const B = this.fly.aC.array;
    for (let i = 0; i < this.n; i++) { const k = (this.base + i) * 4; this.state[i] = 0; B[k] = 1e6; B[k + 1] = 1e6; }
    this.fly.aC.clearUpdateRanges(); this.fly.aC.needsUpdate = true;
  }
  rebase(dt) {
    const B = this.fly.aC.array;
    for (let i = 0; i < this.n; i++) {
      const k = (this.base + i) * 4;
      this.t0[i] -= dt; if (B[k] < 1e5) B[k] -= dt; if (B[k + 1] < 1e5) B[k + 1] -= dt;
    }
    this.fly.aC.clearUpdateRanges(); this.fly.aC.needsUpdate = true;
  }
}
// ---------------------------------------------------------------------------------------------- sound
/** A looping noise buffer from our own random stream (pink / brown), so the game's Math.random sequence is untouched. */
function noiseBuf(ctx, type, seconds, rng) {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = rng() * 2 - 1;
    if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16; }
    else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  const fade = Math.min(2048, len >> 4);
  for (let i = 0; i < fade; i++) { const t = i / fade; d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t; }
  return buf;
}

class EnvAudio {
  constructor(bus, rng) {
    this.bus = bus; this.rng = rng; this.ready = false; this._t = 0; this.live = 0; // one-shots playing
    bus.onStart((ctx) => this._build(ctx));
  }
  _build(ctx) {
    const R = this.rng, out = this.out = this.bus.bus('ambience');
    this.pink = noiseBuf(ctx, 'pink', 3.1, R); this.brown = noiseBuf(ctx, 'brown', 4.3, R); this.white = noiseBuf(ctx, 'white', 1.3, R);
    // the gusts: a breathy band of noise that swells with each gust, and a thin whistle over strong ones
    this.gust = new NoiseVoice(ctx, { buffer: this.pink, rate: 0.55, filters: [{ type: 'bandpass', frequency: 480, Q: 0.8 }, { type: 'lowpass', frequency: 1500 }], gain: 0, out });
    this.howl = new NoiseVoice(ctx, { buffer: this.white, rate: 0.9, filters: [{ type: 'bandpass', frequency: 640, Q: 10 }], gain: 0, out });
    this.ready = true;
  }
  get ctx() { return this.bus.ctx; }
  running() { return this.ready && this.ctx.state === 'running'; }
  /** Per frame (throttled): the gust voices follow the wind. */
  update(dt, wind, gust, storm) {
    if (!this.running() || (this._t -= dt) > 0) return;
    this._t = 0.08;
    const now = this.ctx.currentTime;
    this.gust.output.gain.setTargetAtTime(0.012 + 0.11 * gust * (0.45 + 0.55 * storm), now, 0.25);
    this.gust.filters[0].frequency.setTargetAtTime(330 + 520 * gust + 160 * wind, now, 0.3);
    this.howl.output.gain.setTargetAtTime(0.018 * gust * gust * storm, now, 0.4);
    this.howl.filters[0].frequency.setTargetAtTime(560 + 260 * gust, now, 0.5);
  }
  /** One-shot noise from `buf` (our own random offset). */
  _burst(buf, { peak, attack, decay, filter, rate = 1, when = 0, pan = 0 }) {
    const ctx = this.ctx, t = Math.max(ctx.currentTime, when || ctx.currentTime);
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); g.gain.setValueAtTime(0, t + attack + decay + 0.01);
    let tail = src.connect(makeFilter(ctx, filter)).connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); tail = tail.connect(p); }
    tail.connect(this.out);
    src.start(t, this.rng() * Math.max(0, buf.duration - attack - decay - 0.1));
    src.stop(t + attack + decay + 0.05);
    this.live++;
    src.onended = () => { this.live--; try { g.disconnect(); } catch { /* gone */ } };
  }
  /** Thunder `delay` s from now; near 0..1 (a close one cracks first). */
  thunder(delay, near) {
    if (!this.running()) return;
    const t = this.ctx.currentTime + delay, v = 0.45 + 0.55 * near;
    if (near > 0.55) this._burst(this.white, { peak: 0.14 * v, attack: 0.004, decay: 0.4, filter: { type: 'highpass', frequency: 1400 }, when: t, pan: (this.rng() - 0.5) * 0.8 });
    this._burst(this.brown, { peak: 0.55 * v, attack: 0.18, decay: 3.2, filter: { type: 'lowpass', frequency: 150 }, rate: 0.75, when: t + 0.05 });
    this._burst(this.brown, { peak: 0.35 * v, attack: 0.3, decay: 2.6, filter: { type: 'lowpass', frequency: 95 }, rate: 0.6, when: t + 0.55 });
  }
  /** A crow's "kraa" (n calls) and its wings; pan -1..1, volume 0..1. */
  caw(pan, vol, n = 2) {
    if (!this.running() || vol <= 0.01) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let k = 0; k < 4; k++) this._burst(this.white, { peak: 0.05 * vol, attack: 0.004, decay: 0.045, filter: { type: 'bandpass', frequency: 1700 + k * 150, Q: 1.2 }, when: t + k * 0.07, pan });
    for (let k = 0; k < n; k++) {
      const f = 560 + this.rng() * 120, w = t + 0.12 + k * (0.3 + this.rng() * 0.1);
      playTone(ctx, this.out, { type: 'sawtooth', pitch: [[0, f], [0.05, f * 1.28], [0.2, f * 0.82]], peak: 0.05 * vol, attack: 0.012, decay: 0.2, filter: { type: 'bandpass', frequency: 1250, Q: 2.2 }, pan, when: w });
      playTone(ctx, this.out, { type: 'square', pitch: [[0, f * 0.5], [0.2, f * 0.42]], peak: 0.012 * vol, attack: 0.012, decay: 0.16, filter: { type: 'lowpass', frequency: 900 }, pan, when: w });
    }
  }
  /** The gate's creak; pan -1..1, volume 0..1. */
  creak(pan, vol) {
    if (!this.running() || vol <= 0.01) return;
    const f = 88 + this.rng() * 30;
    playTone(this.ctx, this.out, { type: 'sawtooth', pitch: [[0, f], [0.28, f * 1.45], [0.52, f * 1.15], [0.85, f * 1.6]], peak: 0.045 * vol, attack: 0.09, decay: 0.85, filter: { type: 'bandpass', frequency: 950, Q: 7 }, pan });
  }
}

// ---------------------------------------------------------------------------------------------- the environment
export class Environment {
  /**
   * @param {object} o  scene, camera, atmo (Atmosphere), world (buildWorld's result), ghosts (Ghosts: read only, for
   *   the grave mist), heightAt, low (phone tier: fewer leaves, mist banks and wisps), reducedMotion (default: the
   *   media query)
   */
  constructor({ scene, camera, atmo, world, ghosts = null, heightAt, low = false, reducedMotion = prefersReducedMotion() }) {
    this.camera = camera; this.atmo = atmo; this.world = world; this.ghosts = ghosts; this.heightAt = heightAt;
    this.reduced = !!reducedMotion; this.low = low;
    this.rng = mulberry32(0x5eed1031);
    this.U = { value: 0 }; // shader clock (s), shared by every material here
    this.t = 0;
    // escalation state
    this.clock = 0; this.storm = STORM0; this.finale = 0; this._finaleOn = false;
    this.wind = 0.3; this.gust = 0; this._gustAge = 9; this._gustLen = 4; this._gustAmp = 0; this._gustT = 2;
    this.flash = 0; this._flashAge = 99; this._flashAmp = 0; this._flashTwin = false; this._boltT = 12; this.strikes = 0; this.flashPeak = 0; this.creaks = 0;
    this.blood = 0; this.moonCover = 0;
    this._windOff = new THREE.Vector4(); this._mistOff = new THREE.Vector2(); this._cloudPhase = 0;
    this._kidPrev = new THREE.Vector3(); this._kidHave = false; this._kickAcc = 0; this.kidSpeed = 0;
    this._ghostState = ghosts ? ghosts.list.map((g) => g.state) : [];
    this._gate = world.gate.hinges.map((h) => ({ h, a: world.gate.open, v: 0, peak: 0, creakT: 0 }));
    // the lights' blinking windows: seconds left dark
    this._blink = new Float32Array(GLOW.MAX); this._blinkT = 6;
    // the baseline the escalation works from (as the game set it up)
    const sky = atmo.sky.material.uniforms, fp = atmo.fogParams;
    this.base = {
      hemi: atmo.hemi.intensity, hemiCol: atmo.hemi.color.clone(), moonI: atmo.sun.intensity, moonCol: atmo.sun.color.clone(),
      scatter: atmo.scatterColor !== atmo.sunColor ? atmo.scatterColor.clone() : null,
      cover: sky.uCover.value, cop: sky.uCloudOpacity.value, ca: sky.uCloudAmb.value.clone(), hor: sky.uNightHor.value.clone(), skyMoon: sky.uMoonCol.value.clone(),
      cloudWind: atmo.cloudWind.clone(), haze: fp.haze, mist: fp.mist, fog: atmo.fog ? atmo.fog.density : 0,
      disc: world.moonColor.disc.clone(), halo: world.moonColor.halo.clone(), grass: LOOK.wind.value.y,
    };
    this.leaves = new Fliers({ scene, count: low ? 150 : 260, kick: 20, perches: world.perches, crows: low ? 9 : 12, rng: this.rng, U: this.U });
    this.mist = new MistField({ scene, banks: low ? 8 : 14, puffs: 20, rng: this.rng, U: this.U });
    this.wisps = new MoonClouds({ scene, count: low ? 4 : 6, rng: this.rng });
    this.crows = new Crows(this.leaves);
    this.sound = null;
  }

  /** Sound on the game's AudioBus (built when the context starts). */
  attachAudio(bus) { if (!this.sound && bus) this.sound = new EnvAudio(bus, this.rng); return this; }

  /** The Witching Hour: on drives the storm, the wind, the lightning and the blood moon to their peak (eased). */
  setFinale(on) { this._finaleOn = !!on; }
  /** 0..1: how far the night has escalated (the storm level). */
  get intensity() { return this.storm; }

  /** A new round (or the title): calm again, crows home, nothing in flight. */
  reset() {
    this.clock = 0; this.storm = STORM0; this.finale = 0; this._finaleOn = false;
    this.gust = 0; this._gustAge = 9; this._gustT = 2; this.flash = 0; this._flashAge = 99; this._boltT = 12; this.flashPeak = 0; this.blood = 0;
    this._windOff.set(0, 0, 0, this._windOff.w); this._kidHave = false; this._kickAcc = 0;
    this._blink.fill(0);
    this.crows.reset(); this.leaves.clearKicks(); this.mist.clearPuffs();
    if (this.ghosts) this.ghosts.list.forEach((g, i) => { this._ghostState[i] = g.state; });
  }

  /** A BOO (or anything loud) at (x, z): crows within r take off. */
  scare(x, z, r = 14) {
    let n = 0, sx = 0, sz = 0;
    const C = this.crows;
    for (let i = 0; i < C.n; i++) {
      const p = C.perch[i];
      if (Math.hypot(p[0] - x, p[2] - z) < r && C.launch(i, this.t, x, z, this.rng)) { n++; sx += p[0]; sz += p[2]; }
    }
    if (n) this._cawAt(sx / n, sz / n, n);
    return n;
  }

  /** Lightning now (power 0..1; also the test hook). */
  strike(power = 0.55 + this.rng() * 0.3) {
    this._flashAge = 0; this._flashAmp = power; this._flashTwin = !this.reduced && this.rng() < 0.6; this.strikes++;
    const near = this.rng();
    if (this.sound) this.sound.thunder(0.6 + (1 - near) * 2.6, near);
    // the house lights stutter, and nearby crows take to the air
    if (!this.reduced) for (let k = 0; k < this.world.glowGroups.length; k++) if (this.world.glowGroups[k][0] === GLOW.WINDOW && this.rng() < 0.6) this._blink[k] = 0.1 + this.rng() * 0.5;
    const cam = this.camera.position, C = this.crows;
    let n = 0, sx = 0, sz = 0;
    for (let i = 0; i < C.n; i++) {
      const p = C.perch[i];
      if (Math.hypot(p[0] - cam.x, p[2] - cam.z) < 45 && this.rng() < 0.5 && C.launch(i, this.t, p[0] - 1 + this.rng() * 2, p[2] - 1 + this.rng() * 2, this.rng)) { n++; sx += p[0]; sz += p[2]; }
    }
    if (n) this._cawAt(sx / n, sz / n, n);
  }

  _pan(x, z) {
    const c = this.camera, p = c.position, e = c.matrixWorld.elements; // camera right = the first column
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) || 1;
    return { pan: clamp((dx * e[0] + dz * e[2]) / d, -1, 1), d };
  }
  _cawAt(x, z, n) {
    if (!this.sound) return;
    const { pan, d } = this._pan(x, z);
    this.sound.caw(pan * 0.8, clamp(1.15 - d / 40, 0, 1), Math.min(3, 1 + n));
  }

  /**
   * Per frame, after the world's sky dressing (world.update) has followed the camera.
   * @param {number} dt  s (0 while paused: everything holds)
   * @param {number} clock  the round clock 0 (11:57) .. 1 (midnight)
   * @param {THREE.Vector3} kid  the kid's position
   */
  update(dt, clock, kid) {
    if (!(dt > 0)) return;
    const R = this.rng;
    this.t += dt;
    if (this.t > REBASE + 60) this._rebase(REBASE);
    const t = this.t;
    this.U.value = t; WIND.time.value = t;
    this.clock = clamp(clock, 0, 1);
    // ---- escalation: the storm level eases toward the clock's (and the finale's)
    this.finale += ((this._finaleOn ? 1 : 0) - this.finale) * (1 - Math.exp(-dt / 1.2));
    const want = Math.max(STORM0 + (1 - STORM0) * Math.pow(this.clock, 1.6), FINALE_STORM * this.finale);
    this.storm += (want - this.storm) * (1 - Math.exp(-dt / 1.5));
    const S = this.storm;
    // ---- wind: a breeze plus gusts (bumps of 3..5 s), more and stronger toward midnight
    if ((this._gustT -= dt) <= 0 && this._gustAge >= this._gustLen) {
      this._gustAge = 0; this._gustLen = 2.6 + R() * 2.4; this._gustAmp = (0.35 + 0.65 * R()) * (0.45 + 0.75 * S);
      this._gustT = this._gustLen + lerp(6, 1.2, S) * (0.5 + R());
    }
    this._gustAge += dt;
    const ga = this._gustAge / this._gustLen, gEnv = ga < 1 ? Math.pow(Math.sin(Math.PI * ga), 2) : 0;
    this.gust = this._gustAmp * gEnv;
    const breeze = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1);
    this.wind = 0.25 + 0.45 * S + 0.18 * breeze + this.gust;
    const calm = this.reduced ? 0.4 : 1, W = this.wind, G = this.gust;
    LOOK.wind.value.y = Math.min(0.78, this.base.grass * 0.6 + 0.36 * W * calm + 0.1);
    WIND.sway.value.set(WIND_DIR.x, WIND_DIR.y, (0.03 + 0.12 * W) * calm, (0.04 + 0.3 * G + 0.08 * S) * calm);
    // the leaves ride the wind (integrated, so a gust speeds them up without a jump)
    const lv = (1.0 + 4.6 * W) * (this.reduced ? 0.45 : 1);
    const O = this._windOff;
    O.x += WIND_DIR.x * lv * dt; O.z += WIND_DIR.y * lv * dt; O.y += (0.45 + 0.35 * W) * dt * (this.reduced ? 0.6 : 1); O.w += dt * (0.8 + 2.4 * W) * (this.reduced ? 0.5 : 1);
    if (Math.abs(O.x) > 4000 || Math.abs(O.z) > 4000) O.x = O.z = 0; // (hours of wind; the leaves re-scatter once)
    // ---- the field around the view: a point ahead of the camera, on the ground under the kid
    const cam = this.camera.position, e = this.camera.matrixWorld.elements;
    let fx = -e[8], fz = -e[10]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const gy = this.heightAt(kid.x, kid.z);
    const L = this.leaves.u;
    L.uLfC.value.set(cam.x + fx * 8, gy - 0.2, cam.z + fz * 8);
    L.uLfO.value.copy(O);
    L.uLfP.value.set(13, 4.5, clamp((0.42 + 0.58 * S) * (this.reduced ? 0.6 : 1), 0, 1), (0.18 + 0.3 * W) * calm);
    // ---- kicked leaves: the kid running through the grass
    if (this._kidHave) {
      const dx = kid.x - this._kidPrev.x, dz = kid.z - this._kidPrev.z, dy = kid.y - this._kidPrev.y, sp = Math.hypot(dx, dz) / dt;
      this.kidSpeed = sp < 15 ? sp : 0; // (a teleport is not a run)
      if (this.kidSpeed > 3.2 && Math.abs(dy) < 0.08) {
        this._kickAcc += dt * 6.5 * (this.kidSpeed / 6);
        while (this._kickAcc >= 1) {
          this._kickAcc -= 1;
          const a = R() * Math.PI * 2, vx = dx / dt, vz = dz / dt;
          this.leaves.spawn(t, kid.x + Math.cos(a) * 0.25, gy + 0.05, kid.z + Math.sin(a) * 0.25,
            vx * 0.3 + Math.cos(a) * 1.1, 1.7 + R() * 1.2, vz * 0.3 + Math.sin(a) * 1.1, (R() - 0.5) * 14);
        }
      } else this._kickAcc = 0;
    }
    this._kidPrev.copy(kid); this._kidHave = true;
    // ---- mist: the post fog thickens, the banks drift and fill in, graves breathe out as ghosts rise
    const fp = this.atmo.fogParams;
    fp.mist = this.base.mist * (1 + 1.05 * S); fp.haze = this.base.haze * (1 + 0.55 * S);
    if (this.atmo.fog) this.atmo.fog.density = this.base.fog * (1 + 0.5 * S);
    this._mistOff.x += WIND_DIR.x * (0.35 + 1.1 * W) * dt * calm; this._mistOff.y += WIND_DIR.y * (0.35 + 1.1 * W) * dt * calm;
    const M = this.mist.u;
    M.uMsC.value.set(cam.x + fx * 12, gy, cam.z + fz * 12);
    M.uMsO.value.set(this._mistOff.x, this._mistOff.y, 20, 0);
    M.uMsK.value.set(0.25 + 0.6 * S, 1, 0, 0);
    if (this.ghosts) {
      const GL = this.ghosts.list;
      for (let i = 0; i < GL.length; i++) {
        const g = GL[i], was = this._ghostState[i];
        if (g.state === 'rise' && was !== 'rise') this.mist.pour(t, g.x, this.heightAt(g.x, g.z), g.z, R);
        this._ghostState[i] = g.state;
      }
    }
    // ---- sky: thicker, faster clouds; wisps racing across the moon; the blood moon at the very end
    const sky = this.atmo.sky.material.uniforms, B = this.base;
    sky.uCover.value = B.cover + 0.24 * S;
    sky.uCloudOpacity.value = Math.min(0.97, B.cop + 0.06 * S);
    this.atmo.cloudWind.copy(B.cloudWind).multiplyScalar((1 + 2.2 * W) * (this.reduced ? 0.5 : 1));
    this._cloudPhase += dt * (5 + 30 * W * W) * (this.reduced ? 0.4 : 1);
    if (this._cloudPhase > 1e5) this._cloudPhase -= 460 * 100;
    const cover = this.moonCover = this.wisps.update(cam, this.world.moon.position, this._cloudPhase, clamp(0.3 + 0.62 * S, 0, 1));
    this.blood = Math.max(smooth((this.clock - 0.9) / 0.075), this.finale);
    const bl = this.blood;
    this.world.moonColor.disc.copy(B.disc).lerp(_c.setRGB(1.15, 0.2, 0.11), bl).multiplyScalar(1 - 0.72 * cover);
    this.world.moonColor.halo.copy(B.halo).lerp(_c.setRGB(1.25, 0.16, 0.1), bl).multiplyScalar((1 - 0.7 * cover) * (1 + 0.25 * bl));
    sky.uMoonCol.value.copy(B.skyMoon).lerp(_c.setRGB(1.6, 0.42, 0.3), bl);
    this.atmo.sun.intensity = B.moonI * (1 - 0.45 * cover) * (1 - 0.12 * S);
    this.atmo.sun.color.copy(B.moonCol).lerp(_c.setRGB(0.95, 0.5, 0.5), 0.65 * bl);
    if (B.scatter) this.atmo.scatterColor.copy(B.scatter).lerp(_c.setRGB(1.0, 0.36, 0.3), bl);
    const wu = this.wisps.u;
    wu.uMcLit.value.setRGB(0.5, 0.5, 0.62).lerp(_c.setRGB(0.62, 0.22, 0.18), bl);
    // ---- lightning: none in the calm; then every ~30 s, down to ~8 s at midnight (the finale: ~6 s)
    if (S > 0.32) {
      if ((this._boltT -= dt) <= 0) {
        this.strike();
        const k = clamp((S - 0.32) / 0.68, 0, 1);
        this._boltT = (this.finale > 0.5 ? 5 + R() * 5 : lerp(34, 8, k) * (0.65 + 0.7 * R())) * (this.reduced ? 1.6 : 1);
      }
    } else this._boltT = Math.max(this._boltT, 4 + R() * 6);
    this._flashAge += dt;
    const fa = this._flashAge, pulse = (a, r, d) => (a < 0 ? 0 : a < r ? smooth(a / r) : Math.exp(-3 * (a - r) / d));
    let f = this.reduced ? 0.35 * pulse(fa, 0.4, 1.1) : Math.max(pulse(fa, 0.07, 0.32), this._flashTwin ? 0.6 * pulse(fa - 0.24, 0.06, 0.36) : 0);
    f *= this._flashAmp; if (fa > 3) f = 0;
    this.flash = f; if (f > this.flashPeak) this.flashPeak = f;
    this.atmo.hemi.intensity = B.hemi * (1 - 0.14 * S) + 1.05 * f;
    this.atmo.hemi.color.copy(B.hemiCol).lerp(_c.setRGB(0.72, 0.78, 1.0), clamp(f * 1.4, 0, 1));
    sky.uCloudAmb.value.setRGB(B.ca.r + 0.24 * f, B.ca.g + 0.26 * f, B.ca.b + 0.38 * f);
    sky.uNightHor.value.setRGB(B.hor.r + 0.07 * f, B.hor.g + 0.075 * f, B.hor.b + 0.12 * f);
    wu.uMcFlash.value.setRGB(0.3 * f, 0.32 * f, 0.45 * f);
    // ---- the crows: run near them and they lift off (a walk has to come closer)
    const C = this.crows;
    C.update(t, kid.x, kid.z, R);
    const reach = this.kidSpeed > 3 ? 6.5 : this.kidSpeed > 0.5 ? 4.2 : 2.4;
    let n = 0, sx = 0, sz = 0;
    for (let i = 0; i < C.n; i++) {
      const p = C.perch[i];
      if (C.state[i] === 0 && Math.abs(p[0] - kid.x) < reach && Math.abs(p[2] - kid.z) < reach && Math.hypot(p[0] - kid.x, p[2] - kid.z) < reach && C.launch(i, t, kid.x, kid.z, R)) { n++; sx += p[0]; sz += p[2]; }
    }
    if (n) this._cawAt(sx / n, sz / n, n);
    // ---- the lights: flames flicker (harder in the gusts and the storm), windows blink near midnight
    this._lights(dt, t, S, G);
    // ---- the gate swings in the gusts and creaks
    for (let k = 0; k < this._gate.length; k++) {
      const q = this._gate[k], amp = (0.04 + 0.24 * G + 0.05 * S) * calm;
      const goal = this.world.gate.open - 0.1 + amp * (0.65 * Math.sin(t * 0.83 + k * 2.1) + 0.35 * Math.sin(t * 2.1 + k));
      const v0 = q.v;
      q.v += ((goal - q.a) * 9 - q.v * 2.2) * dt; q.a += q.v * dt;
      // a creak as a swing that moved fast enough turns back
      q.creakT -= dt; q.peak = Math.max(q.peak, Math.abs(q.v));
      if (Math.sign(q.v) !== Math.sign(v0)) {
        if (this.sound && q.peak > 0.16 && q.creakT <= 0) {
          q.creakT = 1.4 + R() * 1.4; this.creaks++;
          const { pan, d } = this._pan(q.h[0], q.h[2]);
          this.sound.creak(pan * 0.7, clamp(1.1 - d / 28, 0, 1) * clamp(q.peak * 2.5, 0.3, 1));
        }
        q.peak = 0;
      }
    }
    this.world.gate.set(this._gate[0].a, this._gate[1].a);
    if (this.sound) this.sound.update(dt, W, G, S);
  }

  _lights(dt, t, S, G) {
    const groups = this.world.glowGroups, lv = this.world.glowLevels, rm = this.reduced;
    const gutter = clamp(0.25 * S + 0.9 * G, 0, 1) * (rm ? 0.4 : 1);
    // now and then a window goes dark for a moment (from mid-round; more often toward midnight)
    if (!rm && S > 0.45 && (this._blinkT -= dt) <= 0) {
      this._blinkT = lerp(9, 2.5, (S - 0.45) / 0.55) * (0.5 + this.rng());
      const k = 1 + Math.floor(this.rng() * (groups.length - 1));
      if (groups[k][0] === GLOW.WINDOW) this._blink[k] = 0.12 + this.rng() * 0.4;
    }
    for (let k = 0; k < groups.length; k++) {
      const [kind, amt] = groups[k];
      let v = 1;
      if (kind === GLOW.FLAME) {
        v = 1 - amt * (0.12 + 0.1 * Math.sin(t * 9.3 + k * 2.1) + 0.06 * Math.sin(t * 23.1 + k)) * (1 + 1.4 * gutter);
        if (!rm) v *= 1 - 0.5 * gutter * Math.pow(Math.max(0, Math.sin(t * 6.1 + k * 5.3) * Math.sin(t * 2.9 + k)), 3); // a gust bends the flame low
      } else if (kind === GLOW.WINDOW) {
        v = 1 - amt * 0.06 * Math.sin(t * 0.7 + k);
        if (this._blink[k] > 0) { this._blink[k] -= dt; v *= 0.12 + 0.2 * Math.max(0, Math.sin(t * 24 + k)); }
      } else if (kind === GLOW.BREW) v = 0.86 + 0.14 * Math.sin(t * 1.7 + k) + 0.18 * S;
      else if (kind === GLOW.EMBER) v = 0.85 + 0.1 * Math.sin(t * 5.1 + k) + 0.08 * Math.sin(t * 13.3 + k) + 0.35 * G;
      lv[k] = Math.max(0.15, v);
    }
  }

  _rebase(dt) {
    this.leaves.rebase(dt, this.t); this.mist.rebase(dt, this.t); this.crows.rebase(dt);
    this.t -= dt;
  }

  /** A snapshot for tests and tuning. */
  stats() {
    const fp = this.atmo.fogParams, sky = this.atmo.sky.material.uniforms, lv = this.world.glowLevels;
    let lmin = 1, wmin = 1;
    for (let k = 0; k < this.world.glowGroups.length; k++) { lmin = Math.min(lmin, lv[k]); if (this.world.glowGroups[k][0] === GLOW.WINDOW) wmin = Math.min(wmin, lv[k]); }
    return {
      clock: +this.clock.toFixed(3), storm: +this.storm.toFixed(3), finale: +this.finale.toFixed(3), wind: +this.wind.toFixed(3), gust: +this.gust.toFixed(3),
      mist: +fp.mist.toFixed(4), haze: +fp.haze.toFixed(5), cover: +sky.uCover.value.toFixed(3), moonCover: +this.moonCover.toFixed(3), blood: +this.blood.toFixed(3),
      flash: +this.flash.toFixed(3), flashPeak: +this.flashPeak.toFixed(3), strikes: this.strikes, grass: +LOOK.wind.value.y.toFixed(3),
      sway: +WIND.sway.value.w.toFixed(3), leafSpeed: +((1.0 + 4.6 * this.wind) * (this.reduced ? 0.45 : 1)).toFixed(2), leavesActive: +this.leaves.u.uLfP.value.z.toFixed(3),
      kicked: this.leaves.live(this.t), puffs: this.mist.live(this.t), crowsAway: this.crows.away, crows: this.crows.n, glowMin: +lmin.toFixed(3),
      windowMin: +wmin.toFixed(3), creaks: this.creaks, sounds: this.sound ? this.sound.live : 0, cloudPhase: +this._cloudPhase.toFixed(2),
      leafDrift: +Math.hypot(this._windOff.x, this._windOff.z).toFixed(2), reduced: this.reduced, t: +this.t.toFixed(2),
    };
  }
}
const _c = new THREE.Color();
