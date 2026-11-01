// Jack-o'-lanterns: carved pumpkins with a flickering HDR face (bloom) and a halo, lit by the engine's NearestLights
// pool (a few real point lights on the lanterns nearest the view; the rest glow emissively). Running into one kicks it
// to pieces, landing on one stomps it (more candy, a bounce). Smashing uses the engine's fracture module: the pumpkin's
// hull is cut ahead of time by fracturePieces (seeded planes, two variants), each piece drawn with pieceGeometry
// (orange rind outside, pale flesh on the cut faces) and thrown as a real dynamic body on the shared DynamicsWorld,
// so the shards tumble and bounce over the terrain heightfield and gravestones; they sink away after a few seconds.
// A smashed lantern regrows after REGROW seconds.
import * as THREE from 'three';
import { Shapes, fracturePieces } from '@vibe/engine/physics';
import { pieceGeometry, makeCanvas } from '@vibe/engine/render';
import { NearestLights } from '@vibe/engine/world';
import { pumpkinGeometry, pumpkinFront, smooth } from './props.js';
import { patchGlow, patchRibs } from './looks.js';

const R = 0.46;          // lantern radius (m)
const LOBES = 8, DEPTH = 0.11; // ribs and crease depth of the lantern body
const REGROW = 26;       // s until a smashed lantern is back
const SHARD_LIFE = 2.8;  // s before the shards sink away
const SLOTS = 4;         // smashes whose shards can be alive at once
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _qa = [0, 0, 0, 1];

/** Convex hull points of the lantern body (a squashed sphere sitting on y = 0, centred at y = 0.76 R). */
function hullPoints() {
  const pts = [];
  for (let j = 0; j <= 4; j++) {
    const v = j / 4, ph = v * Math.PI, y = Math.cos(ph) * R * 0.78 + 0.76 * R, rr = Math.sin(ph) * R * 0.97;
    const n = j === 0 || j === 4 ? 1 : 8;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + j * 0.4; pts.push(Math.cos(a) * rr, y, Math.sin(a) * rr); }
  }
  return pts;
}

// The carved face. Its outline lives in a small mask texture (three faces side by side: a classic toothy grin, a cute
// round-eyed one, a spooky slanted one; per-lantern `faceVar`), drawn on a thin patch laid on the pumpkin's ribbed
// front. The fragment shader discards everything outside the carving and, inside it, marches the view ray a few steps
// into the rind (parallax): where the ray leaves the outline it hit the cut wall (flesh, brighter deeper in, toward
// the candle), else it sees the glowing inside. So the face reads carved, with depth and a rind thickness from every
// angle, at ~200 triangles a lantern and no cut geometry; the instance colour still flickers it.
const FACE_X = 0.6 * R, FACE_Y0 = 0.28 * R, FACE_Y1 = 1.24 * R, FACE_DEPTH = 0.075;
let _faceTex = null;
function faceTexture() {
  if (_faceTex) return _faceTex;
  const W = 516, H = 128, CW = W / 3, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  // face-plane units: x in R (-0.6 .. 0.6), y in R (0.28 .. 1.24) above the base
  const px = (k, x) => k * CW + (x / 1.2 + 0.5) * CW, py = (y) => H - ((y - 0.28) / 0.96) * H;
  const poly = (k, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(px(k, x), py(y)) : g.moveTo(px(k, x), py(y)))); g.closePath(); g.fill(); };
  const ell = (k, x, y, rx, ry) => { g.beginPath(); g.ellipse(px(k, x), py(y), (rx / 1.2) * CW, (ry / 0.96) * H, 0, 0, Math.PI * 2); g.fill(); };
  const grin = (k, x0, x1, top, bottom, teeth, jag = 0) => { // a crescent grin, teeth notched into its top edge
    const pts = [], n = 18;
    for (let i = 0; i <= n; i++) { const u = i / n, a = (u - 0.5) * 2; pts.push([x0 + (x1 - x0) * u, top - 0.1 * (1 - a * a) + (jag && i % 2 ? jag : 0)]); }
    for (let i = n; i >= 0; i--) { const u = i / n, a = (u - 0.5) * 2; pts.push([x0 + (x1 - x0) * u, bottom + (top - bottom) * (a * a) * 0.9 - (jag && i % 2 ? jag : 0)]); }
    poly(k, pts);
    g.fillStyle = '#000';
    for (const [tx, w, h] of teeth) {
      const a = (tx - (x0 + x1) / 2) / ((x1 - x0) / 2), yTop = top - 0.1 * (1 - a * a);
      g.fillRect(px(k, tx - w / 2), py(yTop + 0.03), (w / 1.2) * CW, ((h + 0.03) / 0.96) * H);
    }
    g.fillStyle = '#fff';
  };
  // 0: classic: triangle eyes, a triangle nose, a toothy grin
  poly(0, [[-0.42, 0.86], [-0.1, 0.86], [-0.24, 1.12]]); poly(0, [[0.42, 0.86], [0.1, 0.86], [0.24, 1.12]]);
  poly(0, [[-0.07, 0.7], [0.07, 0.7], [0, 0.82]]);
  grin(0, -0.46, 0.46, 0.6, 0.36, [[-0.16, 0.08, 0.07], [0.12, 0.08, 0.08]]);
  // 1: cute: big round eyes, a little happy mouth with one fang
  ell(1, -0.24, 0.96, 0.13, 0.15); ell(1, 0.24, 0.96, 0.13, 0.15);
  poly(1, [[-0.05, 0.76], [0.05, 0.76], [0, 0.84]]);
  grin(1, -0.3, 0.3, 0.62, 0.44, [[0.08, 0.06, 0.06]]);
  // 2: spooky: slanted eyes, a jagged zigzag mouth
  poly(2, [[-0.44, 1.02], [-0.1, 0.9], [-0.14, 0.8], [-0.38, 0.86]]); poly(2, [[0.44, 1.02], [0.1, 0.9], [0.14, 0.8], [0.38, 0.86]]);
  poly(2, [[-0.06, 0.68], [0.06, 0.68], [0, 0.78]]);
  grin(2, -0.48, 0.48, 0.58, 0.34, [], 0.06);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  _faceTex = t;
  return t;
}

/** The patch the face is drawn on: a grid over the face window laid on the ribbed front (fuv = face-plane metres). */
function faceGeometry() {
  const front = pumpkinFront(R, LOBES, DEPTH), NX = 8, NY = 6, pos = [], nor = [], fuv = [], idx = [];
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = -FACE_X + (2 * FACE_X * i) / NX, y = FACE_Y0 + ((FACE_Y1 - FACE_Y0) * j) / NY, q = front(x, y);
      pos.push(q[0] + q[3] * 0.004, q[1] + q[4] * 0.004, q[2] + q[5] * 0.004); nor.push(q[3], q[4], q[5]); fuv.push(x, y);
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('fuv', new THREE.Float32BufferAttribute(fuv, 2));
  g.setIndex(idx);
  return g;
}
function patchFace(mat) {
  const tex = faceTexture();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tFaceHw = { value: tex };
    sh.uniforms.uFaceHw = { value: new THREE.Vector4(1 / (2 * FACE_X), FACE_Y0, 1 / (FACE_Y1 - FACE_Y0), FACE_DEPTH) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 fuv;\nattribute float faceVar;\nvarying vec2 vFuvHw;\nvarying float vVarHw;\nvarying vec3 vPosHw;\nvarying vec3 vTHw;\nvarying vec3 vBHw;\nvarying vec3 vNHw;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  {
    mat3 hwM = mat3( modelViewMatrix );
  #ifdef USE_INSTANCING
    hwM = hwM * mat3( instanceMatrix );
  #endif
    vTHw = hwM * vec3( 1.0, 0.0, 0.0 ); vBHw = hwM * vec3( 0.0, 1.0, 0.0 ); vNHw = hwM * normal;
    vPosHw = mvPosition.xyz; vFuvHw = fuv; vVarHw = faceVar;
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tFaceHw;
uniform vec4 uFaceHw; // 1 / width, y0, 1 / height (face-plane metres), depth of the cut (m)
varying vec2 vFuvHw;
varying float vVarHw;
varying vec3 vPosHw;
varying vec3 vTHw;
varying vec3 vBHw;
varying vec3 vNHw;
float hwMask( vec2 p ) {
  vec2 uv = clamp( vec2( p.x * uFaceHw.x + 0.5, ( p.y - uFaceHw.y ) * uFaceHw.z ), 0.02, 0.98 );
  return texture2D( tFaceHw, vec2( ( uv.x + vVarHw ) / 3.0, uv.y ) ).r;
}`)
      .replace('#include <color_fragment>', `{
    if ( hwMask( vFuvHw ) < 0.5 ) discard;
    vec3 V = normalize( vPosHw );
    float vn = max( 0.22, - dot( V, normalize( vNHw ) ) );
    vec2 dir = vec2( dot( V, normalize( vTHw ) ), dot( V, normalize( vBHw ) ) ) / vn;
    // march into the cut; where the ray leaves the outline, interpolate the crossing between the two samples
    float hit = 2.0, mPrev = hwMask( vFuvHw );
    for ( int i = 1; i <= 6; i ++ ) {
      float m = hwMask( vFuvHw + dir * uFaceHw.w * float( i ) / 6.0 );
      if ( hit > 1.5 && m < 0.5 ) hit = ( float( i ) - 1.0 + clamp( ( mPrev - 0.5 ) / max( mPrev - m, 1e-3 ), 0.0, 1.0 ) ) / 6.0;
      mPrev = m;
    }
    // the cut wall: flesh, dim near the rind's skin, bright toward the candle; past it the glowing inside
    diffuseColor.rgb = hit > 1.5 ? vec3( 1.0 ) : vec3( 1.0, 0.62, 0.3 ) * mix( 0.1, 0.5, hit * hit );
  }
#include <color_fragment>`);
  };
  mat.customProgramCacheKey = () => 'hwLanternFace';
  return mat;
}

/**
 * Fracture shading: each piece geometry gets `orig` (its vertices in the lantern's frame), so the rind shader paints the
 * ribs back in (crease shading + a normal bent round the lantern's axis) and the flesh shader draws fibres and seeds.
 */
function patchRind(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 orig;\nvarying vec3 vOrigHw;\nvarying vec3 vTanHw;\nvarying vec3 vRoundHw;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vOrigHw = orig;
  vTanHw = normalize( normalMatrix * normalize( vec3( orig.z, 0.0, - orig.x ) + 1e-5 ) );
  vRoundHw = normalize( normalMatrix * vec3( orig.x, ( orig.y - ${(0.76 * R).toFixed(4)} ) / 0.61, orig.z ) );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vOrigHw;\nvarying vec3 vTanHw;\nvarying vec3 vRoundHw;\nconst float LOBES_HW = ${LOBES.toFixed(1)};`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float c = cos( atan( vOrigHw.x, vOrigHw.z ) * LOBES_HW * 0.5 );
    diffuseColor.rgb *= ( 0.62 + 0.38 * pow( abs( c ), 0.6 ) ) * ( 0.8 + 0.3 * smoothstep( 0.0, ${R.toFixed(3)}, vOrigHw.y ) );
  }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
  {
    float a = atan( vOrigHw.x, vOrigHw.z ) * LOBES_HW * 0.5, c = cos( a ), s = sin( a );
    float slope = - 0.6 * pow( max( abs( c ), 0.05 ), - 0.4 ) * sign( c ) * s; // d lobe / d phase
    vec3 rn = normalize( vRoundHw );
    normal = normalize( ( dot( rn, normal ) > 0.0 ? rn : normal ) - vTanHw * clamp( slope, - 2.5, 2.5 ) * 0.5 );
  }`);
  };
  mat.customProgramCacheKey = () => 'hwRind';
  return mat;
}
function patchFlesh(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 orig;\nvarying vec3 vOrigHw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvOrigHw = orig;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vOrigHw;
float hwH3( vec3 p ) { return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    // stringy fibres running round the axis, darker toward the rind, and pale seeds in the middle
    vec3 p = vOrigHw;
    float rr = length( p.xz ) / ${R.toFixed(3)};
    float fib = 0.5 + 0.5 * sin( atan( p.x, p.z ) * 23.0 + rr * 31.0 + sin( p.y * 47.0 ) * 1.5 );
    diffuseColor.rgb *= ( 0.82 + 0.18 * fib ) * mix( 1.05, 0.72, smoothstep( 0.55, 0.95, rr ) );
    vec3 q = p * 26.0, cell = floor( q );
    vec3 o = vec3( hwH3( cell ), hwH3( cell + 3.1 ), hwH3( cell + 7.7 ) ) * 0.6 + 0.2;
    vec3 d = ( q - cell - o ) * vec3( 1.0, 1.8, 1.0 );
    float seed = ( 1.0 - smoothstep( 0.1, 0.16, length( d ) ) ) * step( hwH3( cell + 1.3 ), 0.45 ) * ( 1.0 - smoothstep( 0.35, 0.6, rr ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 1.0, 0.95, 0.8 ), seed );
  }`);
  };
  mat.customProgramCacheKey = () => 'hwFlesh';
  return mat;
}
/** The piece's vertices in the lantern frame (= local - shape.offset + the hull's offset from the lantern origin). */
function withOrig(geo, piece, hullC) {
  const P = geo.attributes.position.array, so = piece.shape.offset, O = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { O[i] = P[i] - so[0] + hullC[0]; O[i + 1] = P[i + 1] - so[1] + hullC[1]; O[i + 2] = P[i + 2] - so[2] + hullC[2]; }
  geo.setAttribute('orig', new THREE.BufferAttribute(O, 3));
  return geo;
}

export class Lanterns {
  /** @param {object} o  scene, dyn (DynamicsWorld), spots ([x, z][]), heightAt, effects, glows, lights (pool size), low */
  constructor({ scene, dyn, spots, heightAt, lights = 5 }) {
    this.dyn = dyn; this.heightAt = heightAt;
    const n = this.n = spots.length;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n); this.yaw = new Float32Array(n);
    this.alive = new Uint8Array(n); this.regrow = new Float32Array(n); this.grow = new Float32Array(n); this.flick = new Float32Array(n);
    spots.forEach(([x, z], i) => {
      this.x[i] = x; this.z[i] = z; this.y[i] = heightAt(x, z) - 0.04;
      this.yaw[i] = Math.atan2(-x, 6 - z) + (Math.sin(i * 12.9) * 0.6); // roughly facing the spawn
      this.flick[i] = i * 1.37;
    });
    // intact lanterns: body (lit, instanced) + face (unlit HDR, instanced)
    // the body: ribbed, a curved stem and a curly vine; the rind round the carving glows (light through the thin rind)
    this.bodyMat = patchRibs(patchGlow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, emissive: '#ff4a00', emissiveIntensity: 0.12 }), 'hwLanternBody'), LOBES, 0.5);
    const glow = (x, y, z) => 0.015 + 0.3 * Math.exp(-((x / (0.5 * R)) ** 2) - (((y - 0.76 * R) / (0.42 * R)) ** 2)) * smooth(z / (0.6 * R));
    this.body = new THREE.InstancedMesh(pumpkinGeometry(R, 32, 0, '#ff7a1a', '#5a5a24', { lobes: LOBES, depth: DEPTH, vine: true, glow, seed: 11 }), this.bodyMat, n);
    this.body.name = 'lanterns'; this.body.castShadow = true; this.body.receiveShadow = true;
    this.faceMat = patchFace(new THREE.MeshBasicMaterial({ color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const fg = faceGeometry(), fv = new Float32Array(n);
    for (let i = 0; i < n; i++) fv[i] = i % 3;
    fg.setAttribute('faceVar', new THREE.InstancedBufferAttribute(fv, 1));
    this.face = new THREE.InstancedMesh(fg, this.faceMat, n);
    this.face.name = 'lanternFaces';
    this.face.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    scene.add(this.body, this.face);
    // light pool: real point lights on the lanterns nearest the view
    this.lightPos = new Float32Array(n * 3);
    this.pool = new NearestLights({ count: lights, color: 0xff7a26, distance: 9, decay: 1.6, parent: scene, lead: 6, fade: 0.3, name: 'lanternLight' });
    // fracture pieces: two seeded variants of the same hull
    const hull = Shapes.convex(hullPoints());
    // convex() re-centres on the centre of mass: the hull's body sits at the lantern origin + this (piece offsets are
    // relative to it)
    this.hullC = [-hull.offset[0], -hull.offset[1], -hull.offset[2]];
    this.variants = [3, 17].map((seed) => {
      const pieces = fracturePieces(hull, { pieces: 7, seed, minFraction: 0.08 });
      return pieces.map((pc) => ({ piece: pc, geometry: withOrig(pieceGeometry(pc, true), pc, this.hullC) }));
    });
    // the rind's ribs and the flesh's fibres and seeds come from each piece's `orig` (its vertices in the lantern frame)
    this.rindMat = patchRind(new THREE.MeshStandardMaterial({ color: '#ff8a26', roughness: 0.5, emissive: '#ff6a10', emissiveIntensity: 0.4 }));
    this.fleshMat = patchFlesh(new THREE.MeshStandardMaterial({ color: '#ffd77a', roughness: 0.85, emissive: '#ffa830', emissiveIntensity: 0.45 }));
    this.slots = [];
    for (let s = 0; s < SLOTS; s++) {
      const v = this.variants[s % this.variants.length], meshes = [];
      for (const p of v) {
        const m = new THREE.Mesh(p.geometry, [this.rindMat, this.fleshMat]);
        m.visible = false; m.castShadow = true; m.frustumCulled = false;
        scene.add(m); meshes.push(m);
      }
      this.slots.push({ v, meshes, bodies: new Int32Array(v.length).fill(-1), t: 0, active: false });
    }
    this.nextSlot = 0;
    for (let i = 0; i < n; i++) this.alive[i] = 1;
    this._sync(true);
  }

  reset() {
    for (let i = 0; i < this.n; i++) { this.alive[i] = 1; this.regrow[i] = 0; this.grow[i] = 1; }
    for (const s of this.slots) this._clearSlot(s);
    this._sync(true);
  }

  _clearSlot(s) {
    for (let k = 0; k < s.bodies.length; k++) { if (s.bodies[k] >= 0) this.dyn.removeBody(s.bodies[k]); s.bodies[k] = -1; s.meshes[k].visible = false; }
    s.active = false;
  }

  /** Index of an intact lantern the kid (feet x, y, z, capsule radius r) touches, or -1. */
  touching(x, y, z, r) {
    const rr = (R + r) * (R + r);
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i] || this.grow[i] < 0.8) continue;
      const dx = x - this.x[i], dz = z - this.z[i];
      if (dx * dx + dz * dz < rr && y < this.y[i] + R * 1.7) return i;
    }
    return -1;
  }

  /** Smash lantern i, kicked along (kx, kz) (unit) with `power` (1 kick, 1.6 stomp). */
  smash(i, kx, kz, power = 1) {
    this.alive[i] = 0; this.regrow[i] = REGROW; this.grow[i] = 0;
    const s = this.slots[this.nextSlot]; this.nextSlot = (this.nextSlot + 1) % SLOTS;
    this._clearSlot(s);
    const x = this.x[i], y = this.y[i], z = this.z[i], yaw = this.yaw[i];
    _q.setFromEuler(_e.set(0, yaw, 0)); _qa[0] = _q.x; _qa[1] = _q.y; _qa[2] = _q.z; _qa[3] = _q.w;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (let k = 0; k < s.v.length; k++) {
      const pc = s.v[k].piece, o = pc.offset, h = this.hullC, ox0 = o[0] + h[0], oz0 = o[2] + h[2];
      const px = x + ox0 * c + oz0 * sn, py = y + o[1] + h[1], pz = z - ox0 * sn + oz0 * c;
      const id = this.dyn.addBody({ shape: pc.shape, position: [px, py, pz], quaternion: _qa, density: 350, friction: 0.7, restitution: 0.25, linearDamping: 0.15, angularDamping: 0.3 });
      if (id < 0) continue;
      // outward from the centre + the kick + up
      const ox = px - x, oy = py - (y + 0.76 * R), oz = pz - z, ol = Math.hypot(ox, oy, oz) || 1;
      const out = 2.2 * power;
      this.dyn.setVelocity(id, ox / ol * out + kx * 2.5 * power, 2.4 * power + oy / ol * out + Math.random(), oz / ol * out + kz * 2.5 * power,
        (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      s.bodies[k] = id; s.meshes[k].visible = true; s.meshes[k].scale.setScalar(1);
    }
    s.active = true; s.t = 0;
    this.lightPos[i * 3 + 1] = -1000; // out of the light pool's candidates (re-selected within 0.3 s)
    this._sync(false);
    return { x, y: y + 0.76 * R, z };
  }

  /** Every smashed lantern grows back now (the Witching Hour); onRelight(i) per lantern. */
  relightAll(onRelight) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.alive[i]) continue;
      this.alive[i] = 1; this.regrow[i] = 0; this.grow[i] = 0.001; any = true;
      if (onRelight) onRelight(i);
    }
    if (any) this._sync(false);
  }

  /** Fixed step: shard lifetimes (bodies removed at the end). */
  fixedUpdate(dt) {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t > SHARD_LIFE + 0.6) this._clearSlot(s);
    }
  }

  /** Per frame: regrowth, flicker, shard poses, light pool. Returns indices of lanterns that just regrew via cb. */
  update(dt, view, time, onRegrow) {
    let dirty = false;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) {
        this.regrow[i] -= dt;
        if (this.regrow[i] <= 0) { this.alive[i] = 1; this.grow[i] = 0.001; dirty = true; if (onRegrow) onRegrow(i); }
      } else if (this.grow[i] < 1) { this.grow[i] = Math.min(1, this.grow[i] + dt / 0.7); dirty = true; }
    }
    if (dirty) this._sync(false);
    // flicker the faces (instance colours, HDR)
    const C = this.face.instanceColor.array;
    for (let i = 0; i < this.n; i++) {
      const f = this.flick[i] + time;
      const k = 0.82 + 0.1 * Math.sin(f * 9.1) + 0.07 * Math.sin(f * 23.7 + 1.3) + 0.05 * Math.sin(f * 3.3);
      C[i * 3] = 5.2 * k; C[i * 3 + 1] = 2.3 * k; C[i * 3 + 2] = 0.45 * k;
    }
    this.face.instanceColor.needsUpdate = true;
    // shards: poses from the bodies, sinking + shrinking at the end
    for (const s of this.slots) {
      if (!s.active) continue;
      const sink = s.t > SHARD_LIFE ? Math.min(1, (s.t - SHARD_LIFE) / 0.6) : 0;
      for (let k = 0; k < s.bodies.length; k++) {
        const id = s.bodies[k], m = s.meshes[k];
        if (id < 0) continue;
        this.dyn.getPose(id, m.position, m.quaternion);
        if (sink > 0) { m.position.y -= sink * 0.3; m.scale.setScalar(Math.max(0.001, 1 - sink)); }
      }
    }
    this.pool.update(dt, view, 7.5);
  }

  _sync(lightsToo) {
    const P = this.lightPos;
    for (let i = 0; i < this.n; i++) {
      const g = this.alive[i] ? this.grow[i] : 0;
      const sc = g < 1 ? Math.max(0.001, g * (1 + 0.25 * Math.sin(g * Math.PI))) : 1; // a little overshoot as it regrows
      _q.setFromEuler(_e.set(0, this.yaw[i], 0));
      _m.compose(_p.set(this.x[i], this.y[i], this.z[i]), _q, _s.set(sc, sc, sc));
      this.body.setMatrixAt(i, _m); this.face.setMatrixAt(i, _m);
      if (this.alive[i] || lightsToo) { P[i * 3] = this.x[i]; P[i * 3 + 1] = this.alive[i] ? this.y[i] + 0.5 : -1000; P[i * 3 + 2] = this.z[i]; }
    }
    this.body.instanceMatrix.needsUpdate = true; this.face.instanceMatrix.needsUpdate = true;
    if (lightsToo) { this.body.computeBoundingSphere(); this.face.computeBoundingSphere(); this.pool.setPositions(P); }
  }

  /** Halo glows for the intact lanterns into `glows` from slot `base`; returns slots used. */
  glow(glows, base, time) {
    let n = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      const g = this.grow[i], f = this.flick[i] + time, k = (0.85 + 0.15 * Math.sin(f * 7.3)) * g;
      glows.set(base + n++, this.x[i], this.y[i] + 0.42, this.z[i], 2.6, 0.5 * k, 0.2 * k, 0.04 * k);
    }
    return n;
  }
}
