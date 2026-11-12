// Cumulus puffs for the remastered night sky (sample-side: the engine's Atmosphere draws streaky sky-shader clouds):
// separate soft billboards on a dome around the camera, darker than the sky, with a silver rim on the edges that face
// the moon (strongest near it), drifting slowly with the wind. One instanced draw; a procedural 2 x 2 atlas of cloud
// shapes (sums of soft blobs, a flat-ish base) built once at load. No depth writes, like the moon and the tree line:
// drawn over the moon, under the tree line. Desktop ~18 puffs, phones ~8.
//   const clouds = new CumulusClouds({ scene, count, rng });  clouds.update(camera.position, moonDir, time)
import * as THREE from 'three';
import { makeCanvas, mulberry32, pfbm } from '@vibe/engine/render';

const D = 520; // m: the dome's radius (inside the sky sphere, past the tree line's ring)

/** 512 x 256: four cloud shapes (2 x 2 cells); r = density, g = height in the puff (for the darker base). */
function atlas() {
  const W = 512, H = 256, c = makeCanvas(W, H), g = c.getContext('2d'), rnd = mulberry32(91);
  const img = g.createImageData(W, H), d = img.data, cw = W / 2, ch = H / 2;
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * cw, oy = Math.floor(cell / 2) * ch, blobs = [];
    const n = 6 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) { // a heap: bigger towers in the middle, lower toward the edges
      const u = (rnd() - 0.5) * 0.62, r = 0.07 + rnd() * 0.07 * (1 - Math.abs(u));
      blobs.push([0.5 + u, 0.66 - r * 0.9 - rnd() * 0.3 * (1 - Math.abs(u) * 1.6), r]);
    }
    for (let k = 0; k < 26; k++) { const b = blobs[Math.floor(rnd() * blobs.length)]; blobs.push([b[0] + (rnd() - 0.5) * b[2] * 2.2, b[1] - rnd() * b[2] * 1.1, b[2] * (0.35 + rnd() * 0.3)]); } // cauliflower lumps
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const u = x / cw, v = y / ch;
      let s = 0;
      for (const [bx, by, br] of blobs) { const dx = (u - bx) / br, dy = (v - by) / (br * 2); s += Math.exp(-(dx * dx + dy * dy) * 1.4); }
      const base = 1 - Math.min(1, Math.max(0, (v - 0.68) / 0.08)); // a flat-ish underside
      const ero = pfbm(u * 2 + cell * 0.31, v, 6, 4, 17 + cell, 0.55); // ragged, wispy edges
      const raw = (1 - Math.exp(-s * 1.6)) - 0.45 * (ero - 0.5), e = Math.min(1, Math.max(0, (raw - 0.28) / 0.3));
      const den = e * e * (3 - 2 * e) * base * Math.min(1, u * 8, (1 - u) * 8, v * 6);
      const i = ((oy + y) * W + ox + x) * 4;
      d[i] = 255 * den; d[i + 1] = 255 * (1 - v); d[i + 2] = 0; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const VS = /* glsl */`
attribute vec4 cA; // azimuth (rad), elevation (rad), width (m), atlas cell
attribute vec2 cB; // drift speed (rad / s), opacity
uniform vec3 uCam, uMoon;
uniform float uTime;
varying vec2 vUv;
varying vec2 vMoon2;
varying float vNear, vOp;
void main() {
  float az = cA.x + uTime * cB.x, el = cA.y;
  vec3 dir = vec3( cos( el ) * sin( az ), sin( el ), cos( el ) * cos( az ) );
  vec3 c = uCam + dir * ${D.toFixed(1)};
  vec3 r = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) ), u = cross( r, dir );
  vec3 p = c + r * position.x * cA.z + u * position.y * cA.z * 0.5 * 1.15;
  float cell = cA.w;
  vUv = ( position.xy + 0.5 ) * 0.5 + vec2( mod( cell, 2.0 ), floor( cell / 2.0 ) ) * 0.5;
  vUv.y = 1.0 - vUv.y; // (canvas rows run down)
  vec3 m = normalize( uMoon );
  vMoon2 = normalize( vec2( dot( m, r ), - dot( m, u ) ) + 1e-4 ); // toward the moon in the atlas' orientation
  vNear = pow( max( dot( dir, m ), 0.0 ), 6.0 );
  vOp = cB.y;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}`;
const FS = /* glsl */`
uniform sampler2D tCloud;
uniform vec3 uBody, uRim;
varying vec2 vUv;
varying vec2 vMoon2;
varying float vNear, vOp;
void main() {
  vec4 t = texture2D( tCloud, vUv );
  float a = t.r;
  if ( a < 0.004 ) discard;
  // the rim: how much thinner the cloud gets two steps toward the moon (a soft band, not an outline)
  float toward = 0.5 * ( texture2D( tCloud, vUv + vMoon2 * vec2( 0.025, 0.05 ) ).r + texture2D( tCloud, vUv + vMoon2 * vec2( 0.05, 0.1 ) ).r );
  float rim = clamp( ( a - toward ) * 1.6, 0.0, 1.0 ) * smoothstep( 0.0, 0.5, a ) * ( 1.0 - 0.6 * smoothstep( 0.6, 1.0, a ) );
  vec3 col = uBody * ( 0.45 + 0.9 * t.g ) + uRim * rim * ( 1.0 - a ) * ( 0.06 + 0.4 * vNear );
  gl_FragColor = vec4( col * a * vOp, a * vOp ); // premultiplied
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class CumulusClouds {
  constructor({ scene, count = 18, rng = Math.random }) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = new Float32Array(count * 4), B = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      A[i * 4] = (i / count) * Math.PI * 2 + rng() * 0.3; A[i * 4 + 1] = (0.11 + Math.pow(rng(), 1.6) * 0.4);
      A[i * 4 + 2] = 120 + rng() * 170; A[i * 4 + 3] = Math.floor(rng() * 4);
      B[i * 2] = 0.0012 + rng() * 0.0012; B[i * 2 + 1] = 0.55 + rng() * 0.4;
    }
    g.setAttribute('cA', new THREE.InstancedBufferAttribute(A, 4)); g.setAttribute('cB', new THREE.InstancedBufferAttribute(B, 2));
    g.instanceCount = count;
    this.u = {
      uCam: { value: new THREE.Vector3() }, uMoon: { value: new THREE.Vector3(0, 1, 0) }, uTime: { value: 0 }, tCloud: { value: atlas() },
      uBody: { value: new THREE.Color(0.012, 0.013, 0.019) }, uRim: { value: new THREE.Color(0.2, 0.21, 0.24) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'cumulus'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1.2; // over the moon, under the tree line
    scene.add(this.mesh);
  }
  /** Per frame: the dome follows the camera; the rims follow the moon; t: seconds (the drift). */
  update(camPos, moonDir, t) {
    this.u.uCam.value.copy(camPos); this.u.uMoon.value.copy(moonDir); this.u.uTime.value = t % 20000;
  }
}
