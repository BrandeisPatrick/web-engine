// Light in the air, kept as subtle as the reference (a glow is never bigger than its lamp): three additive instanced
// meshes, three draw calls, no lights.
//   cones  every street lamp within `coneRange` of the camera: a soft cone of lit haze from the head to the ground (an
//          open cone, brightest under the head, faded at the rim by the view angle and toward the ground, so it never
//          shows a hard edge or its intersection with the street), re-picked as the camera moves;
//   halos  camera-facing soft discs: every lamp head (the near ones small, the distant ones kept a few pixels wide and
//          dimmed by the haze, so depth reads block by block), a faint one on the signs and screens, red beacons;
//   beams  the nearest cars' headlights: a short soft beam ahead of the car, updated every frame from the traffic.
// The cones fade out near the camera (no wall of haze when the walker stands under a lamp) and end 3.1 m above the
// pavement, above car roofs, awnings and entrance canopies (they used to reach the ground and clip through them). Mobile: halos and beams
// only (the cheaper version), fewer of them.
import * as THREE from 'three';

const CONE_STOP = 3.1; // m above the pavement where the cones end
const CONE_VS = /* glsl */`
attribute vec4 iA; // x, y (head), z, height
attribute vec4 iB; // radius at the ground, intensity, -, -
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  // unit cone: y 0 (head) .. -1 (ground), radius 0.08 .. 1
  float t = -position.y;
  vec3 p = vec3(position.x * iB.x, position.y * iA.w, position.z * iB.x);
  vec3 w = iA.xyz + p;
  vT = t; vK = iB.y; vW = w;
  vN = normalize(vec3(position.x, 0.25 * iB.x / max(iA.w, 1.0), position.z));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const CONE_FS = /* glsl */`
uniform vec3 uCol; uniform float uGain;
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float facing = abs(dot(normalize(vN), V));
  float rim = pow(facing, 2.2);                          // soft at the silhouette (thin path through the haze)
  float along = (1.0 - smoothstep(0.55, 0.98, vT)) * (0.35 + 0.65 * exp(-vT * 2.2)); // bright under the head, gone at the ground
  float dc = length(cameraPosition - vW);
  float near = smoothstep(2.5, 9.0, dc);                 // no haze wall in the walker's face
  float far = 1.0 - smoothstep(70.0, 120.0, dc);
  float a = rim * along * near * far * vK * uGain;
  gl_FragColor = vec4(uCol * a, 1.0);
}`;

const HALO_VS = /* glsl */`
attribute vec4 iA; // x, y, z, size (m)
attribute vec4 iC; // r, g, b, intensity
uniform float uHaze;
varying vec2 vUv; varying vec3 vC;
void main() {
  vec4 vp = viewMatrix * vec4(iA.xyz, 1.0);
  float d = -vp.z;
  // near: the size in metres; far: at least ~a few pixels (the haze spreads it), dimmed by the haze
  float s = max(iA.w, d * 0.0042);
  vec3 dir = normalize(vp.xyz);
  vp.xyz -= dir * min(0.8, d * 0.1);                     // pulled toward the camera: not cut by its own lamp housing
  vp.xy += position.xy * s;
  float fade = exp(-d * uHaze) * smoothstep(1.5, 6.0, d) * iC.w;
  vC = iC.rgb * fade * (iA.w / s);                       // energy kept roughly constant as the disc grows
  vUv = position.xy;
  gl_Position = projectionMatrix * vp;
}`;
const HALO_FS = /* glsl */`
uniform float uGain;
varying vec2 vUv; varying vec3 vC;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 7.0) * 0.8 + exp(-r2 * 30.0) * 0.6;
  g *= 1.0 - r2;
  gl_FragColor = vec4(vC * g * uGain, 1.0);
}`;

const BEAM_VS = /* glsl */`
attribute vec4 iA; // x, y, z, yaw
attribute vec4 iB; // length, width, intensity, -
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  // unit cone along -z: z 0 (lamp) .. -1 (end), radius 0.1 .. 1
  float c = cos(iA.w), s = sin(iA.w);
  vec3 p = vec3(position.x * iB.y, position.y * iB.y * 0.45 + position.z * iB.x * 0.06, position.z * iB.x);
  vec3 w = iA.xyz + vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  vec3 n = vec3(position.x, position.y, 0.0);
  vN = vec3(n.x * c, n.y, -n.x * s);
  vT = -position.z; vK = iB.z; vW = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;
const BEAM_FS = /* glsl */`
uniform vec3 uCol; uniform float uGain;
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float rim = pow(abs(dot(normalize(vN + 1e-4), V)), 2.0);
  float along = exp(-vT * 3.0) * (1.0 - smoothstep(0.6, 1.0, vT));
  float near = smoothstep(2.0, 6.0, length(cameraPosition - vW));
  gl_FragColor = vec4(uCol * rim * along * near * vK * uGain, 1.0);
}`;

const additive = (vs, fs, uniforms) => new THREE.ShaderMaterial({
  vertexShader: vs, fragmentShader: fs, uniforms, transparent: true, depthWrite: false, depthTest: true,
  blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false, toneMapped: true,
});

/** Unit cone along -y, open ends, n sides. */
function coneGeo(n = 18) {
  const g = new THREE.CylinderGeometry(0.08, 1, 1, n, 6, true);
  g.translate(0, -0.5, 0);
  return g;
}

/**
 * o: { scene, world, signs (sign lights), cones = true, coneRange = 110, maxCones = 40, haloRange = 700,
 *   cars = 10, gain = 1, beacons: [[x,y,z]] }. Returns { group, update(camera), counts }.
 */
export class AirGlow {
  constructor(o) {
    this.world = o.world;
    this.group = new THREE.Group(); this.group.name = 'airglow-nyc';
    this.heads = (o.world.props && o.world.props.lampHeads) || [];
    this.counts = { cones: 0, halos: 0, beams: 0 };
    this.coneRange = o.coneRange ?? 110;
    this._last = new THREE.Vector3(1e9, 0, 0); this._cam = new THREE.Vector3();
    const lampCol = new THREE.Color(1.0, 0.6, 0.3);

    // ---- cones (desktop)
    if (o.cones !== false) {
      const N = o.maxCones ?? 40;
      const ig = new THREE.InstancedBufferGeometry().copy(coneGeo());
      ig.instanceCount = 0;
      this.coneA = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
      this.coneB = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
      ig.setAttribute('iA', this.coneA); ig.setAttribute('iB', this.coneB);
      this.coneMat = additive(CONE_VS, CONE_FS, { uCol: { value: lampCol.clone() }, uGain: { value: 0.5 * (o.gain ?? 1) } });
      this.cones = new THREE.Mesh(ig, this.coneMat);
      this.cones.frustumCulled = false; this.cones.name = 'lamp-cones'; this.cones.renderOrder = 5;
      this.coneMax = N;
      this.group.add(this.cones);
    }

    // ---- halos: lamp heads, signs, beacons (static list)
    const H = [];
    for (const h of this.heads) H.push([h[0], h[1] - 0.15, h[2], 0.55, 1.0, 0.62, 0.32, 1.0]);
    for (const l of o.signs || []) {
      if (l.kind !== 'screen' && l.kind !== 'fascia' && l.kind !== 'marquee' && l.kind !== 'blade') continue;
      const m = Math.max(l.r, l.g, l.b) || 1;
      H.push([l.sx ?? l.x, l.sy ?? l.y, l.sz ?? l.z, Math.min(6, 1.2 + (l.range || 8) * 0.12), l.r / m, l.g / m, l.b / m, 0.16]);
    }
    for (const b of o.beacons || []) H.push([b[0], b[1], b[2], 0.5, 1.0, 0.08, 0.04, 2.2]);
    if (H.length) {
      const q = new THREE.PlaneGeometry(2, 2);
      const ig = new THREE.InstancedBufferGeometry();
      ig.index = q.index; ig.setAttribute('position', q.getAttribute('position'));
      const A = new Float32Array(H.length * 4), C = new Float32Array(H.length * 4);
      H.forEach((h, i) => { A.set(h.slice(0, 4), i * 4); C.set(h.slice(4, 8), i * 4); });
      ig.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
      ig.setAttribute('iC', new THREE.InstancedBufferAttribute(C, 4));
      ig.instanceCount = H.length;
      this.haloMat = additive(HALO_VS, HALO_FS, { uGain: { value: 0.8 * (o.gain ?? 1) }, uHaze: { value: 0.0016 } });
      this.halos = new THREE.Mesh(ig, this.haloMat);
      this.halos.frustumCulled = false; this.halos.name = 'lamp-halos'; this.halos.renderOrder = 6;
      this.group.add(this.halos);
      this.counts.halos = H.length;
    }

    // ---- headlight beams
    this.carsN = o.cars ?? 10;
    if (this.carsN > 0 && o.world.traffic) {
      const N = this.carsN * 2;
      const g = new THREE.CylinderGeometry(0.1, 1, 1, 12, 4, true);
      g.rotateX(Math.PI / 2); g.translate(0, 0, -0.5); // along -z: narrow at 0 (the lamp), wide at -1
      const ig = new THREE.InstancedBufferGeometry().copy(g);
      ig.instanceCount = 0;
      this.beamA = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
      this.beamB = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
      ig.setAttribute('iA', this.beamA); ig.setAttribute('iB', this.beamB);
      this.beamMat = additive(BEAM_VS, BEAM_FS, { uCol: { value: new THREE.Color(1.0, 0.92, 0.8) }, uGain: { value: 0.07 * (o.gain ?? 1) } });
      this.beams = new THREE.Mesh(ig, this.beamMat);
      this.beams.frustumCulled = false; this.beams.name = 'head-beams'; this.beams.renderOrder = 5;
      this.group.add(this.beams);
      this._pose = {}; this._d = new Float32Array(512); this._i = new Int32Array(512);
    }
    o.scene.add(this.group);
  }

  update(camera) {
    const W = this.world, on = W.atmo.darkness > 0.3;
    this.group.visible = on;
    if (!on) return;
    const cam = this._cam.setFromMatrixPosition(camera.matrixWorld);
    // ---- cones: re-pick when the camera moved 3 m
    if (this.cones && this._last.distanceToSquared(cam) > 9) {
      this._last.copy(cam);
      const A = this.coneA.array, B = this.coneB.array, R2 = this.coneRange ** 2;
      let n = 0;
      for (const h of this.heads) {
        if (n >= this.coneMax) break;
        const d2 = (h[0] - cam.x) ** 2 + (h[2] - cam.z) ** 2;
        if (d2 > R2) continue;
        // the haze stops 3.1 m above the pavement (it faded out there anyway): it never cuts through a car, a bus
        // roof, an awning or a canopy with a hard line (no scene depth to fade against inside the scene pass)
        const gy = W.getGroundHeight(h[0], h[2]), H = h[1] - gy - 0.25 - CONE_STOP;
        if (!(H > 2)) continue;
        A[n * 4] = h[0]; A[n * 4 + 1] = h[1] - 0.25; A[n * 4 + 2] = h[2]; A[n * 4 + 3] = H;
        B[n * 4] = H * 0.55; B[n * 4 + 1] = 1; n++;
      }
      this.cones.geometry.instanceCount = n; this.counts.cones = n;
      this.coneA.needsUpdate = true; this.coneB.needsUpdate = true;
    }
    // ---- beams: the nearest cars within 90 m
    const T = W.traffic;
    if (this.beams && T && T.count) {
      const P = this._pose, D = this._d, I = this._i;
      let m = 0;
      for (let i = 0, N = Math.min(T.count, 512); i < N; i++) {
        T.pose(i, P);
        if (!P.active) continue;
        const d2 = (P.x - cam.x) ** 2 + (P.z - cam.z) ** 2;
        if (d2 > 8100) continue;
        D[m] = d2; I[m] = i; m++;
      }
      const k = Math.min(this.carsN, m), A = this.beamA.array, B = this.beamB.array;
      let n = 0;
      for (let a = 0; a < k; a++) {
        let b = a; for (let j = a + 1; j < m; j++) if (D[j] < D[b]) b = j;
        const td = D[a]; D[a] = D[b]; D[b] = td; const ti = I[a]; I[a] = I[b]; I[b] = ti;
        T.pose(I[a], P);
        const V = T.vehicles && T.vehicles[I[a]], L = V ? V.L : 4.6, Wd = V && V.W ? V.W : 1.8;
        const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = -fz, rz = fx;
        for (const side of [-0.36, 0.36]) {
          A[n * 4] = P.x + fx * L * 0.5 + rx * side * Wd; A[n * 4 + 1] = P.y + 0.7; A[n * 4 + 2] = P.z + fz * L * 0.5 + rz * side * Wd; A[n * 4 + 3] = P.yaw;
          B[n * 4] = 9; B[n * 4 + 1] = 1.5; B[n * 4 + 2] = 1; n++;
        }
      }
      this.beams.geometry.instanceCount = n; this.counts.beams = n;
      this.beamA.needsUpdate = true; this.beamB.needsUpdate = true;
    }
  }
}
