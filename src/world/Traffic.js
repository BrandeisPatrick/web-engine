// Moving traffic, main-thread side: the presenter for the simulation core (TrafficSim.js), which runs in a Web Worker
// (traffic.worker.js, default in browsers with module workers; `traffic: { worker: false }` or ?noworker=1 = in-thread,
// as do Node / headless builds) or on the main thread.
//
// Worker mode: the main thread builds the same TrafficSim (lane graph + baked ground heights + initial spawn; also the
// fallback and what dev tools read), hands the worker the road data + baked heights, and from then on posts ONE small
// message per frame (dt, camera position + view-projection matrix, player footprint, the 169 signal phases the bulbs
// show, the pose buffer it is done with). The worker steps the AI and answers with a transferable Float32Array of
// poses (POSE_STRIDE floats per vehicle: x, y, z, yaw, pitch, brake, speed, yaw rate, flags), double-buffered.
// Respawn / recycling decisions stay in the worker. The presenter draws the latest snapshot extrapolated to the
// current frame (speed + yaw rate; the snapshot is one frame old), and queryColliders answers from that snapshot
// (the same oriented AABB slices as before). If the worker fails to start, the in-thread sim takes over (logged once).
//
// Rendering: one InstancedMesh per vehicle type with a small shader patch (Vehicles.js: paint mask, clearcoat,
// head/tail/brake lamps scaled by darkness). Instances are re-packed every frame (_present): near-cascade casters
// first, then the rest of the view, then far-cascade-only casters, so the main pass and each shadow cascade draw only
// a prefix (engine ShadowPasses.shadowCount) instead of all vehicles in every pass. Headlight beams at night.
// Opt-in detail rings (`hd: { count, radius, midCount, midRadius, parked, shadowProxy }`, Vehicles.js lod 'hd' / 'mid'):
// the nearest `count` cars within `radius` m are drawn from one HD InstancedMesh per type (two draws: opaque + blended
// glass), the next nearest `midCount` within `midRadius` from one mid mesh per type (one draw), the rest from their
// LOD-0 slot; picks use a hysteresis band (a car already in a ring keeps it to radius x 1.15 / 1.1 and wins ties), so
// the swap never flickers. With `parked` (default true) Props' parked cars get the same two rings: hidden in its
// BatchedMesh, drawn here with its parked look. Ring meshes write G-buffer velocity (per-vehicle previous matrices,
// ENGINE_GBUFFER_INSTANCE_PREV); with `shadowProxy` (default) they do not cast: a LOD-0 body per ring instance does.
// refreshHD(cameraPosition) re-picks immediately (frozen loops, bench captures). Without the option nothing changes.
import * as THREE from 'three';
import { makeVehicleGeometry, VEHICLE_SPECS, VEHICLE_HD_TYPES, createVehicleMaterial } from './Vehicles.js';
import { shadowCount, shadowFrustum } from './ShadowPasses.js';
import { releaseStaticGeometry } from '../render/Memory.js';
import { TrafficSim, TRAFFIC_TYPES, POSE_STRIDE, buildSignalInfos, playerInfoFrom, vehicleSlices } from './TrafficSim.js';

const TYPES = TRAFFIC_TYPES;
const MAX_SLICES = 10;
const READY_TIMEOUT = 5000; // ms for the worker to build its sim before the in-thread sim takes over
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _one = new THREE.Vector3(1, 1, 1), _sph = new THREE.Sphere(), _pm = new THREE.Matrix4();
const _bm = new THREE.Matrix4(), _bm2 = new THREE.Matrix4(), _bp = new THREE.Vector3(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3();
const clamp01h = (h) => Math.min(1.05, Math.max(0.62, h));
let _warned = false;
const _sx = new THREE.Vector3(), _sy = new THREE.Vector3(), _sz = new THREE.Vector3();

/** Bounding sphere of a directional light's orthographic shadow box (same placement as ShadowPasses.shadowFrustum). */
function shadowBoxSphere(light, out) {
  const sc = light.shadow.camera;
  _sx.setFromMatrixPosition(light.matrixWorld);
  _sz.setFromMatrixPosition(light.target ? light.target.matrixWorld : light.matrixWorld).sub(_sx);
  const L = _sz.length();
  if (L > 1e-6) _sz.multiplyScalar(1 / L); else _sz.set(0, -1, 0);
  const w = sc.right - sc.left, h = sc.top - sc.bottom, d = sc.far - sc.near;
  out.center.copy(_sx).addScaledVector(_sz, (sc.near + sc.far) / 2);
  if (sc.left + sc.right !== 0 || sc.top + sc.bottom !== 0) out.radius = Infinity; // off-centre box: no reject
  else out.radius = 0.5 * Math.sqrt(w * w + h * h + d * d);
  return out;
}
const nearSphere = (a, x, y, z, r) => { const c = a.center, R = a.radius + r, dx = c.x - x, dy = c.y - y, dz = c.z - z; return dx * dx + dy * dy + dz * dz <= R * R; };
function loadPlanes(f, out, o) {
  for (let k = 0; k < 6; k++) { const p = f.planes[k], n = p.normal, j = o + k * 4; out[j] = n.x; out[j + 1] = n.y; out[j + 2] = n.z; out[j + 3] = p.constant; }
}
/** THREE.Frustum.intersectsSphere on planes flattened by loadPlanes. */
function inPlanes(F, o, x, y, z, r) {
  for (let j = o; j < o + 24; j += 4) if (F[j] * x + F[j + 1] * y + F[j + 2] * z + F[j + 3] < -r) return false;
  return true;
}

/** Default for `traffic.worker`: browsers with Worker support, unless ?noworker=1. */
export function trafficWorkerDefault() {
  if (typeof Worker === 'undefined' || typeof window === 'undefined') return false;
  try { const q = new URLSearchParams(window.location.search); if (q.has('noworker') && q.get('noworker') !== '0') return false; } catch { /* no location */ }
  return true;
}

/**
 * Traffic paint / lamp material tweaks (vehicles.js builds the base): brighter brake lamps, police light bars
 * flashing red / blue alternately, and glass that reflects the sky environment more strongly.
 */
function patchTrafficMaterial(m, key = 'roadster-vehicle-traffic-1') {
  const tu = { uTimeT: { value: 0 } };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, tu);
    sh.vertexShader = sh.vertexShader
      .replace('uniform float uDark;', 'uniform float uDark; uniform float uTimeT; varying float vGlassK;')
      .replace('vec3( 1.0, 0.0, 0.0 ) * ( 0.03 + uDark * 0.45 + brk * ( 0.85 + uDark * 0.3 ) )', 'vec3( 1.0, 0.012, 0.008 ) * ( 0.03 + uDark * 0.5 + brk * ( 1.7 + uDark * 1.9 ) )')
      .replace('vec3( 1.0, 0.04, 0.04 ) * ( uDark * 0.5 )', 'vec3( 1.0, 0.04, 0.03 ) * smoothstep( 0.15, 0.6, sin( uTimeT * 3.6 ) ) * ( 0.8 + uDark * 3.2 )')
      .replace('vec3( 0.08, 0.2, 1.0 ) * ( uDark * 0.5 )', 'vec3( 0.06, 0.2, 1.0 ) * smoothstep( 0.15, 0.6, -sin( uTimeT * 3.6 ) ) * ( 0.8 + uDark * 3.2 )')
      .replace('vSurf = aSurf;', 'vSurf = aSurf;\nvGlassK = ( aSurf.x < 0.045 && aSurf.y < 0.5 && aLamp < 0.5 ) ? 1.0 : 0.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('varying vec3 vLampE; varying vec3 vSurf;', 'varying vec3 vLampE; varying vec3 vSurf; varying float vGlassK;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectSpecular *= 1.0 + 1.6 * vGlassK;');
  };
  m.customProgramCacheKey = () => key;
  m.userData.tu = tu;
  return m;
}

/**
 * Parked HD / mid cars keep Props' parked look (Props.js patchParkedMaterial: the same shader lines): no lit lamps,
 * tail lenses glinting red at night, a police light bar idling red / blue. Uniforms copied from props.parkedMat.
 */
function patchParkedHD(m, key) {
  const pu = { uDarkP: { value: 0 }, uTimeP: { value: 0 } };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, pu);
    sh.vertexShader = sh.vertexShader
      .replace('uniform float uDark;', 'uniform float uDark; uniform float uDarkP; uniform float uTimeP;')
      .replace('vLampE = vec3( 0.0 );', `vLampE = vec3( 0.0 );
if ( aLamp > 1.5 && aLamp < 2.5 ) vLampE = vec3( 1.0, 0.02, 0.01 ) * ( 0.02 + uDarkP * 0.16 );
else if ( aLamp > 4.5 ) {
  float ph = sin( uTimeP * 3.3 );
  float on = aLamp < 5.5 ? smoothstep( 0.2, 0.7, ph ) : smoothstep( 0.2, 0.7, -ph );
  vLampE = ( aLamp < 5.5 ? vec3( 1.0, 0.04, 0.03 ) : vec3( 0.06, 0.2, 1.0 ) ) * on * ( 0.6 + uDarkP * 3.0 );
}`);
  };
  m.customProgramCacheKey = () => key;
  m.userData.pu = pu;
  return m;
}

// ------------------------------------------------------------------ Traffic
export class Traffic {
  /**
   * @param {object} o
   * @param {object} o.world  needs getGroundHeight(x,z,y) (height bake) + getSpawn(); optional world.player / world.camera
   * @param {object} o.data  city.json (signals)
   * @param {import('./RoadNetwork.js').RoadNetwork} o.net
   * @param {import('./Props.js').Props} o.props  traffic signal phases (props.signals[].state)
   * @param {number} [o.seed]
   * @param {number} [o.count] vehicles (default world.opts.traffic ?? 250 - a number, or { count }; 0/false disables)
   * @param {THREE.Camera} [o.camera] for out-of-view respawns (also: setCamera, world.camera)
   * @param {{lower?: object, stripe?: object}} [o.busLivery] bus colours (Vehicles.js DEFAULT_BUS_LIVERY)
   * @param {boolean} [o.worker] simulate in a Web Worker (default trafficWorkerDefault())
   * @param {object|null} [o.mix] opt-in fleet shares { typeName: share } (TrafficSim typeCounts); null = the default fleet
   * @param {object|null} [o.area] opt-in { recycleRadius, spawnRadius } (m, TrafficSim); null = 700 / 620
   * @param {object|boolean|null} [o.hd] opt-in detailed cars near the camera: true or { count = 3, radius = 18,
   *        midCount = 8, midRadius = 45, parked = true, shadowProxy = true, releaseCpu = true } (also read from
   *        world.opts.traffic.hd); null = off. releaseCpu: the shared ring geometry drops its CPU arrays after upload
   */
  constructor({ world, data, net, props, seed = 7, count, camera, busLivery = null, worker, mix = null, area = null, hd } = {}) {
    const wh = hd ?? (world && world.opts && world.opts.traffic && typeof world.opts.traffic === 'object' ? world.opts.traffic.hd : null);
    this.hd = wh ? { count: 3, radius: 18, midCount: 8, midRadius: 45, parked: true, shadowProxy: true, releaseCpu: true, ...(wh === true ? {} : wh) } : null;
    this.area = area || null; // opt-in { recycleRadius, spawnRadius } (TrafficSim), handed to the worker's sim too
    this.mix = mix || null; // opt-in fleet mix (TrafficSim typeCounts), handed to the worker's sim too
    this.world = world; this.data = data; this.net = net; this.props = props; this.seed = seed;
    this.busLivery = busLivery;
    const wo = world && world.opts ? world.opts.traffic : undefined;
    const opt = count ?? (wo && typeof wo === 'object' ? wo.count : wo);
    this.target = opt === false ? 0 : Number.isFinite(opt) ? Math.max(0, Math.floor(opt)) : 250;
    this.wantWorker = worker ?? trafficWorkerDefault();
    this.count = 0;
    this.camera = camera || null;
    this._player = null; this._plInfo = {};
    this.sim = null;
    this.mode = 'main';          // 'worker' once the worker answered, else the in-thread sim
    this.ready = Promise.resolve();
    this.meshes = [];
    this._cam = new THREE.Vector3(0, 30, 0);
    this._frustum = new THREE.Frustum(); this._hasFrustum = false;
    this.stats = {};
    // measurements (dev pages / profiling): main-thread ms per update (EMA), worker step ms, message bytes
    this.perf = { mainMs: 0, workerMs: 0, postBytes: 0, snapBytes: 0, latency: 0, snapshots: 0, late: 0 };
  }

  /** Optional: () => AABB {minX..maxZ} | THREE.Vector3 | Object3D | {object3d}. Vehicles brake for it. */
  setPlayer(getter) { this._player = getter || null; }
  /** Optional: camera used to keep respawns out of view. */
  setCamera(camera) { this.camera = camera || null; }

  /** The core's lane graph / vehicles (static data in worker mode: use pose(i) for where a vehicle is drawn). */
  get lanes() { return this.sim ? this.sim.lanes : []; }
  get vehicles() { return this.sim ? this.sim.vehicles : []; }
  get typeNames() { return TYPES.map((t) => t.name); }
  /** Signal colour (0 red, 1 yellow, 2 green) of a lane's signal info for phase group g, as the AI sees it. */
  _light(info, g) { return this.sim ? this.sim._light(info, g) : 0; }

  build() {
    if (!this.net || !this.net.list || !this.target) return null;
    const t0 = performance.now();
    const W = this.world;
    const sim = this.sim = new TrafficSim({
      roads: TrafficSim.roadsFrom(this.net),
      signals: buildSignalInfos({ data: this.data, net: this.net, props: this.props }),
      groundAt: W && W.getGroundHeight ? (x, z, y) => W.getGroundHeight(x, z, y) : null,
      spawn: W && W.getSpawn ? W.getSpawn().position : { x: 0, z: 0 },
      seed: this.seed, count: this.target, mix: this.mix, ...(this.area || {}),
    });
    if (!sim.build()) { this.sim = null; return null; }
    this.count = sim.count;
    this.stats = sim.stats;
    const N = sim.vehicles.length;
    this.poses = sim.writePoses(new Float32Array(N * POSE_STRIDE));
    this.pp = new Float32Array(N * 6);     // presented pose per vehicle: x, y, z, yaw, pitch, brake
    this.act = new Uint8Array(N);
    this._buildMeshes();
    this._buildBeams();
    this._present(this.poses, 0);
    if (this.wantWorker) this.ready = this._startWorker();
    this.stats.buildMs = Math.round(performance.now() - t0);
    console.info('[Traffic]', this.stats);
    return this.group;
  }

  // ================================================================ worker
  _startWorker() {
    const sim = this.sim, N = sim.vehicles.length;
    let worker;
    try {
      worker = new Worker(new URL('./traffic.worker.js', import.meta.url), { type: 'module' });
    } catch (e) { this._fallback(e); return Promise.resolve(); }
    this.worker = worker;
    this._msg = { type: 'step', dt: 0, seq: 0, view: new Float32Array(19), hasPv: false, player: new Float32Array(9), hasPlayer: false, sig: sim.sigState, bufs: null };
    this._spares = []; this._postedT = 0; this._snapT = 0; this._seq = 0; this.snap = null;
    this._cvs = sim.vehicles.map((v) => ({
      id: v.id, L: v.L, W: v.W, Hc: v.Hc, WB: v.WB, nb: 0, gen: -1,
      box: { minX: 0, minY: -1e4, maxX: 0, maxY: -1e4, minZ: 0, maxZ: 0 },
      boxes: Array.from({ length: MAX_SLICES }, () => ({ minX: 0, minY: -1e4, maxX: 0, maxY: -1e4, minZ: 0, maxZ: 0, kind: 'vehicle', id: v.id, vx: 0, vz: 0 })),
    }));
    this._snapGen = 0;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
      const timer = setTimeout(() => { this._fallback(new Error(`no answer within ${READY_TIMEOUT} ms`)); finish(); }, READY_TIMEOUT);
      worker.onmessage = (ev) => {
        const m = ev.data;
        if (this.worker !== worker) return; // fell back meanwhile
        if (m.type === 'poses') { this._onPoses(m); return; }
        if (m.type === 'ready') {
          const a = new Float32Array(m.buf);
          let dmax = 0; for (let i = 0; i < a.length; i++) dmax = Math.max(dmax, Math.abs(a[i] - this.poses[i]));
          if (dmax > 1e-3) console.warn('[Traffic] worker sim differs from the main-thread build (max pose diff', dmax, ')');
          this.snap = a; this._snapT = m.t; this._postedT = m.t; this._snapGen++;
          this.mode = 'worker';
          this.stats.worker = { buildMs: m.buildMs, lanes: m.lanes, poseDiff: dmax };
          console.info('[Traffic] simulating in a Web Worker', this.stats.worker);
          finish();
        } else if (m.type === 'error') { this._fallback(new Error(m.message)); finish(); }
      };
      worker.onerror = (ev) => { ev.preventDefault && ev.preventDefault(); this._fallback(new Error(ev.message || 'worker error')); finish(); };
      worker.onmessageerror = () => { this._fallback(new Error('message error')); finish(); };
      const bk = sim.baked;
      // the worker gets its own copy of the baked heights (the main-thread sim keeps its graph as the fallback)
      const heights = bk.heights.slice(), index = bk.index.slice();
      worker.postMessage({ type: 'init', roads: sim.roads, signals: sim.sigInfos, heights, index, spawn: { x: sim.spawn.x, z: sim.spawn.z }, seed: sim.seed, count: sim.target, mix: sim.mix, area: this.area, n: N },
        [heights.buffer, index.buffer]);
    });
  }

  _fallback(err) {
    if (this.worker) { try { this.worker.terminate(); } catch { /* gone */ } this.worker = null; }
    const was = this.mode;
    this.mode = 'main';
    if (!_warned) { _warned = true; console.warn(`[Traffic] Web Worker unavailable${was === 'worker' ? ' (failed while running)' : ''}, simulating on the main thread:`, err && err.message ? err.message : err); }
  }

  _onPoses(m) {
    const buf = new Float32Array(m.buf);
    if (this.snap) this._spares.push(this.snap);
    this.snap = buf; this._snapT = m.t; this._snapGen++;
    const P = this.perf;
    P.workerMs = P.workerMs * 0.9 + m.stepMs * 0.1; P.snapBytes = buf.byteLength; P.snapshots++;
    P.latency = this._postedT - m.t; // sim seconds the newest snapshot lags the main thread (one frame when on time)
    this._summary = m.summary;
  }

  _post(dt, pv, info) {
    const m = this._msg, S = this.sim;
    m.dt = dt; m.seq = ++this._seq;
    m.view[0] = this._cam.x; m.view[1] = this._cam.y; m.view[2] = this._cam.z;
    m.hasPv = !!pv; if (pv) m.view.set(pv, 3);
    m.hasPlayer = !!info;
    if (info) { const p = m.player; p[0] = info.x; p[1] = info.y; p[2] = info.z; p[3] = info.fx; p[4] = info.fz; p[5] = info.hl; p[6] = info.hw; p[7] = info.rx; p[8] = info.rz; }
    m.sig = S.sigState;
    const sp = this._spares, tr = [];
    m.bufs = sp.length ? sp.map((b) => b.buffer) : null;
    for (const b of sp) tr.push(b.buffer);
    sp.length = 0;
    this.worker.postMessage(m, tr);
    m.bufs = null; // transferred (detached)
    this._postedT += dt;
    this.perf.postBytes = 19 * 4 + 9 * 4 + m.sig.byteLength + 16;
  }

  // ================================================================ per frame
  update(dt, cameraPos, darkness = 0) {
    const S = this.sim;
    if (!S || !S.vehicles.length) return;
    const t0 = performance.now();
    dt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0;
    if (cameraPos) this._cam.copy(cameraPos);
    const cam = this.camera || (this.world && this.world.camera) || null;
    let pv = null;
    if (cam && cam.projectionMatrix) {
      _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(_pm); this._hasFrustum = true;
      pv = _pm.elements;
      if (!cameraPos) this._cam.copy(cam.position);
    }
    this.material.userData.u.uDark.value = Math.min(1, Math.max(0, (darkness - 0.12) / 0.45));
    this._lightT = (this._lightT || 0) + dt; this.material.userData.tu.uTimeT.value = this._lightT;
    if (this.materialHD) for (const m of [this.materialHD, this.glassHD]) { m.userData.u.uDark.value = this.material.userData.u.uDark.value; m.userData.tu.uTimeT.value = this._lightT; }
    if (this.parkedMatHD) { // follow Props' parked glint / idle flash uniforms
      const src = this.props && this.props.parkedMat && this.props.parkedMat.userData.pu;
      if (src) for (const m of [this.parkedMatHD, this.parkedGlassHD]) { m.userData.pu.uDarkP.value = src.uDarkP.value; m.userData.pu.uTimeP.value = src.uTimeP.value; }
    }
    S.readSignals(this.props && this.props.signals); // the phase the bulbs show this frame
    const src = this._player || (this.world && this.world.player) || null;
    const info = src ? playerInfoFrom(src, this._plInfo) : null;
    if (this.mode === 'worker' && this.worker) {
      this._post(dt, pv, info);
      const late = this._postedT - this._snapT - dt; // > 0: the last snapshot missed its frame
      if (late > 1e-4) this.perf.late++;
      this._present(this.snap, Math.min(0.1, Math.max(0, this._postedT - this._snapT)));
    } else {
      S.setView(this._cam.x, this._cam.y, this._cam.z, pv);
      S.setPlayer(info);
      S.update(dt);
      S.writePoses(this.poses);
      this._present(this.poses, 0);
    }
    this._updateBeams(darkness);
    const ms = performance.now() - t0;
    this.perf.mainMs = this.perf.mainMs * 0.95 + ms * 0.05;
    this.perf.lastMs = ms;
  }

  /** Presented pose of vehicle i -> out { x, y, z, yaw, pitch, brake, active } (where it is drawn this frame). */
  pose(i, out = {}) {
    const q = i * 6, P = this.pp;
    out.x = P[q]; out.y = P[q + 1]; out.z = P[q + 2]; out.yaw = P[q + 3]; out.pitch = P[q + 4]; out.brake = P[q + 5];
    out.active = !!this.act[i];
    return out;
  }

  // ================================================================ meshes
  _buildMeshes() {
    const counts = this.sim.typeCounts;
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    this.material = patchTrafficMaterial(createVehicleMaterial({ brake: true }));
    this._tierIdx = []; this._tierN = new Int32Array(TYPES.length * 3);
    TYPES.forEach((T, ti) => {
      const n = counts[ti];
      this._tierIdx.push(new Int32Array(Math.max(1, n) * 3));
      if (!n) { this.meshes.push(null); return; }
      const geo = makeVehicleGeometry(T.name, T.name === 'bus' && this.busLivery ? { livery: this.busLivery } : undefined);
      const brake = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
      brake.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aBrake', brake);
      geo.computeBoundingSphere();
      const mesh = new THREE.InstancedMesh(geo, this.material, n);
      mesh.name = `traffic-${T.name}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = true; mesh.receiveShadow = true;
      const col = new THREE.Color();
      for (const v of this.sim.vehicles) if (v.type === ti) { col.setRGB(v.rgb[0], v.rgb[1], v.rgb[2]); mesh.setColorAt(v.ii, col); }
      for (let i = 0; i < n; i++) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); }
      if (mesh.instanceColor) { mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.needsUpdate = true; }
      mesh.userData.nNear = n; mesh.userData.nFar = n;
      shadowCount(mesh, (cam) => (cam === this._nearShadowCam ? mesh.userData.nNear : mesh.userData.nFar));
      this.meshes.push(mesh);
      this.group.add(mesh);
    });
    if (this.hd) this._buildHD(counts);
  }

  // ================================================================ opt-in HD / mid cars near the camera
  _buildHD(counts) {
    const H = this.hd, hdTypes = new Set(VEHICLE_HD_TYPES), N = this.sim.vehicles.length;
    // G-buffer velocity from the previous instance matrices (slots are repacked, so prev is kept per vehicle)
    const vel = (m) => { m.defines = { ...(m.defines || {}), ENGINE_GBUFFER_INSTANCE_PREV: '' }; return m; };
    this.materialHD = vel(patchTrafficMaterial(createVehicleMaterial({ brake: true, hd: true }), 'roadster-vehicle-traffic-hd-1'));
    this.glassHD = vel(patchTrafficMaterial(createVehicleMaterial({ brake: true, glass: true, hd: true }), 'roadster-vehicle-traffic-hdg-1'));
    if (!H.shadowProxy) this.materialHD.shadowSide = THREE.DoubleSide; // open shells: cast from both faces
    // ring meshes are built lazily, the first time a car of their type is about to enter the ring (one build per frame);
    // a type that never comes near costs nothing. _ringOk: types that may get rings; capacities per type.
    this._ringOk = TYPES.map((T, ti) => !!(counts[ti] && hdTypes.has(T.name)));
    this._cap = TYPES.map((T, ti) => [Math.min(H.count, counts[ti]), Math.min(H.midCount, counts[ti])]);
    this.hdMeshes = TYPES.map(() => null); this.midMeshes = TYPES.map(() => null);
    this._proxies = new Map(); // type -> LOD-0 shadow caster (moving + parked)
    this._geos = new Map(); // `${type}:${lod}` -> the shared packed geometry (one copy for moving and parked meshes)
    this._hdSel = new Uint8Array(N); this._hdPrev = new Uint8Array(N); this._hdDist = new Float64Array(N);
    const K = Math.max(H.count, H.midCount, 1);
    this._rkD = new Float64Array(K); this._rkI = new Int32Array(K);
    this._pm16 = new Float32Array(N * 16); this._pmOK = new Uint8Array(N);
    this._builds = 0;
    // parked cars (Props' BatchedMesh): the nearest swapped for HD / mid copies drawn here, with Props' parked look
    const PP = H.parked && this.props && this.props.parked;
    if (PP && PP.typeNames) {
      this.parkedMatHD = patchParkedHD(createVehicleMaterial({ brake: false, lamps: false, hd: true }), 'roadster-vehicle-parked-hd-1');
      this.parkedGlassHD = patchParkedHD(createVehicleMaterial({ brake: false, lamps: false, glass: true, hd: true }), 'roadster-vehicle-parked-hdg-1');
      if (!H.shadowProxy) this.parkedMatHD.shadowSide = THREE.DoubleSide;
      const n0 = PP.ids.length;
      this._pk = { P: PP, ok: PP.typeNames.map((nm) => hdTypes.has(nm)), sel: new Uint8Array(n0), prev: new Uint8Array(n0), dist: new Float64Array(n0), hd: new Map(), mid: new Map(), m: new THREE.Matrix4(), c: new THREE.Color() };
    }
  }

  /** Ring mesh for (type, lod) on demand: null while this frame's build budget is spent. */
  _ensure(store, key, name, lod, cap, mats, label, brake, velocity) {
    let m = store instanceof Map ? store.get(key) : store[key];
    if (m || !cap) return m || null;
    const gk = `${name}:${lod}`;
    if (!this._geos.has(gk)) { if (this._builds >= 1) return null; this._builds++; }
    m = this._hdMesh(name, lod, cap, mats, label, brake, velocity);
    if (store instanceof Map) store.set(key, m); else store[key] = m;
    return m;
  }

  _hdMesh(name, lod, cap, mats, label, brake, velocity) {
    const H = this.hd, gk = `${name}:${lod}`;
    let shared = this._geos.get(gk);
    if (!shared) { shared = makeVehicleGeometry(name, { lod }); this._geos.set(gk, shared); }
    // a view: the shared vertex / index buffers (one GPU copy) + this mesh's own per-instance attributes
    const geo = new THREE.BufferGeometry();
    geo.index = shared.index; for (const k in shared.attributes) geo.attributes[k] = shared.attributes[k];
    geo.groups = shared.groups; geo.boundingBox = shared.boundingBox; geo.boundingSphere = shared.boundingSphere; geo.userData = shared.userData;
    if (brake) { const b = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); b.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aBrake', b); }
    if (velocity) { const p = new THREE.InstancedBufferAttribute(new Float32Array(cap * 16), 16); p.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('instancePrevMatrix', p); }
    const mesh = new THREE.InstancedMesh(geo, mats, cap);
    mesh.name = label; mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = !H.shadowProxy; mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.tris = shared.userData.tris;
    this.group.add(mesh);
    // the shared vertex arrays leave the JS heap after their upload (render/Memory.js; per-instance data stays)
    if (H.releaseCpu) releaseStaticGeometry(mesh);
    if (H.shadowProxy && !this._proxies.has(name)) {
      if (!this.proxyMat) { // invisible in the view, casts in every shadow pass
        const pm = this.proxyMat = createVehicleMaterial({ brake: false, lamps: false });
        pm.colorWrite = false; pm.depthWrite = false; pm.shadowSide = THREE.DoubleSide;
      }
      const px = new THREE.InstancedMesh(makeVehicleGeometry(name), this.proxyMat, 2 * (H.count + H.midCount));
      px.name = `traffic-hd-shadow-${name}`; px.count = 0; px.frustumCulled = false; px.castShadow = true; px.receiveShadow = false;
      px.instanceMatrix.setUsage(THREE.DynamicDrawUsage); px.renderOrder = -1;
      this._proxies.set(name, px); this.group.add(px);
    }
    return mesh;
  }

  /** Build every ring mesh now (moving + parked, types in this fleet), e.g. behind a loading screen: no first-use hitch. */
  prepareHD() {
    if (!this.hd || !this.sim) return;
    const b = this._builds; this._builds = -1e9;
    TYPES.forEach((T, ti) => {
      if (!this._ringOk[ti]) return;
      this._ensure(this.hdMeshes, ti, T.name, 'hd', this._cap[ti][0], [this.materialHD, this.glassHD], `traffic-hd-${T.name}`, true, true);
      this._ensure(this.midMeshes, ti, T.name, 'mid', this._cap[ti][1], this.materialHD, `traffic-mid-${T.name}`, true, true);
    });
    const K = this._pk;
    if (K) for (const nm of new Set(K.P.typeNames)) if (VEHICLE_HD_TYPES.includes(nm)) {
      this._ensure(K.hd, nm, nm, 'hd', this.hd.count, [this.parkedMatHD, this.parkedGlassHD], `parked-hd-${nm}`, false, false);
      this._ensure(K.mid, nm, nm, 'mid', this.hd.midCount, this.parkedMatHD, `parked-mid-${nm}`, false, false);
    }
    this._builds = b;
  }

  /** Nearest `K` of the candidates (dist < Infinity, not taken by a nearer ring) within R into sel (= id); hysteresis. */
  _ring(dist, prev, sel, id, K, R, rk, kk) {
    const D = this._rkD, I = this._rkI;
    let n = 0;
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i];
      if (sel[i] || !(d < Infinity)) continue;
      const was = prev[i] && prev[i] <= id; // in this ring (or a nearer one) last time: a wider radius, a nearer key
      if (d > (was ? R * rk : R)) continue;
      const key = was ? d * kk : d;
      if (n < K) { D[n] = key; I[n] = i; n++; } else {
        let w = 0; for (let k = 1; k < n; k++) if (D[k] > D[w]) w = k;
        if (key < D[w]) { D[w] = key; I[w] = i; }
      }
    }
    for (let k = 0; k < n; k++) sel[I[k]] = id;
  }

  /** Rings for the moving fleet from the last presented poses: 1 = HD, 2 = mid, 0 = LOD 0 (_hdSel). */
  _pickHD() {
    const H = this.hd, V = this.sim.vehicles, P = this.pp, A = this.act, cam = this._cam, dist = this._hdDist;
    this._hdPrev.set(this._hdSel); this._hdSel.fill(0);
    for (let i = 0; i < V.length; i++) {
      const q = i * 6;
      dist[i] = A[i] && this._ringOk[V[i].type] ? Math.hypot(P[q] - cam.x, P[q + 1] - cam.y, P[q + 2] - cam.z) : Infinity;
    }
    const sel = this._hdSel;
    this._ring(dist, this._hdPrev, sel, 1, H.count, H.radius, 1.15, 0.87);
    this._ring(dist, this._hdPrev, sel, 2, H.midCount, H.midRadius, 1.1, 0.9);
    for (let i = 0; i < V.length; i++) { // the ring's mesh for this type (built now, or next frame: then LOD 0 meanwhile)
      if (!sel[i]) continue;
      const ti = V[i].type, nm = TYPES[ti].name;
      const m = sel[i] === 1 ? this._ensure(this.hdMeshes, ti, nm, 'hd', this._cap[ti][0], [this.materialHD, this.glassHD], `traffic-hd-${nm}`, true, true)
        : this._ensure(this.midMeshes, ti, nm, 'mid', this._cap[ti][1], this.materialHD, `traffic-mid-${nm}`, true, true);
      if (!m) sel[i] = 0;
    }
  }

  _presentHD() {
    const V = this.sim.vehicles, P = this.pp, sel = this._hdSel, A = this.act, PM = this._pm16, OK = this._pmOK;
    for (const m of this.hdMeshes) if (m) m.count = 0;
    for (const m of this.midMeshes) if (m) m.count = 0;
    for (const m of this._proxies.values()) m.count = 0;
    for (let i = 0; i < V.length; i++) {
      const v = V[i], mesh = sel[i] && A[i] ? (sel[i] === 1 ? this.hdMeshes : this.midMeshes)[v.type] : null;
      if (!mesh) { OK[i] = 0; continue; }
      const k = mesh.count++, q = i * 6, E = mesh.instanceMatrix.array, e = k * 16;
      const yaw = P[q + 3], pitch = P[q + 4], ca = Math.cos(pitch), sa = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
      E[e] = cy; E[e + 1] = 0; E[e + 2] = -sy; E[e + 3] = 0;
      E[e + 4] = sy * sa; E[e + 5] = ca; E[e + 6] = cy * sa; E[e + 7] = 0;
      E[e + 8] = ca * sy; E[e + 9] = -sa; E[e + 10] = ca * cy; E[e + 11] = 0;
      E[e + 12] = P[q]; E[e + 13] = P[q + 1]; E[e + 14] = P[q + 2]; E[e + 15] = 1;
      const pv = mesh.geometry.attributes.instancePrevMatrix.array;
      for (let j = 0; j < 16; j++) { pv[e + j] = OK[i] ? PM[i * 16 + j] : E[e + j]; PM[i * 16 + j] = E[e + j]; }
      OK[i] = 1;
      mesh.geometry.attributes.aBrake.array[k] = P[q + 5];
      const c = mesh.instanceColor.array; c[k * 3] = v.rgb[0]; c[k * 3 + 1] = v.rgb[1]; c[k * 3 + 2] = v.rgb[2];
      const px = this._proxies.get(TYPES[v.type].name);
      if (px) { const pe = px.count++ * 16, PE = px.instanceMatrix.array; for (let j = 0; j < 16; j++) PE[pe + j] = E[e + j]; }
    }
    for (const m of [...this.hdMeshes, ...this.midMeshes]) if (m && m.count) {
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      m.geometry.attributes.aBrake.needsUpdate = true; m.geometry.attributes.instancePrevMatrix.needsUpdate = true;
    }
  }

  /** Parked cars: the nearest (hysteresis) are hidden in Props' batch and drawn from the HD / mid meshes here. */
  _parkedHD() {
    const K = this._pk;
    if (K) {
      const H = this.hd, { P, sel, prev, dist } = K, cam = this._cam, n0 = P.ids.length, names = P.typeNames;
      prev.set(sel); sel.fill(0);
      for (let i = 0; i < n0; i++) dist[i] = K.ok[P.type[i]] ? Math.hypot(P.x[i] - cam.x, P.y[i] - cam.y, P.z[i] - cam.z) : Infinity;
      this._ring(dist, prev, sel, 1, H.count, H.radius, 1.15, 0.87);
      this._ring(dist, prev, sel, 2, H.midCount, H.midRadius, 1.1, 0.9);
      for (let i = 0; i < n0; i++) if (sel[i]) {
        const nm = names[P.type[i]];
        const m = sel[i] === 1 ? this._ensure(K.hd, nm, nm, 'hd', H.count, [this.parkedMatHD, this.parkedGlassHD], `parked-hd-${nm}`, false, false)
          : this._ensure(K.mid, nm, nm, 'mid', H.midCount, this.parkedMatHD, `parked-mid-${nm}`, false, false);
        if (!m) sel[i] = 0;
      }
      for (const m of K.hd.values()) m.count = 0;
      for (const m of K.mid.values()) m.count = 0;
      for (let i = 0; i < n0; i++) {
        // Props keeps its own near / far state (st); give a car back only if Props would draw it
        if (!!sel[i] !== !!prev[i]) { if (sel[i]) P.mesh.setVisibleAt(P.ids[i], false); else if (P.st[i] >= 0) P.mesh.setVisibleAt(P.ids[i], true); }
        if (!sel[i]) continue;
        const nm = names[P.type[i]], mesh = (sel[i] === 1 ? K.hd : K.mid).get(nm), j = mesh.count++;
        P.mesh.getMatrixAt(P.ids[i], K.m); mesh.setMatrixAt(j, K.m);
        P.mesh.getColorAt(P.ids[i], K.c); mesh.setColorAt(j, K.c);
        const px = this._proxies.get(nm);
        if (px && px.count < px.instanceMatrix.count) px.setMatrixAt(px.count++, K.m);
      }
      for (const m of [...K.hd.values(), ...K.mid.values()]) if (m.count) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
    for (const px of this._proxies.values()) if (px.count) px.instanceMatrix.needsUpdate = true;
  }

  /**
   * Re-pick and redraw the HD / mid rings (moving and parked) for a camera at `cameraPosition` now, from the poses
   * already presented: for frozen loops / bench captures, where update() does not run after the camera moved.
   * @param {THREE.Vector3|{x:number,y:number,z:number}} [cameraPosition]
   */
  refreshHD(cameraPosition) {
    if (!this.hd || !this.sim) return;
    if (cameraPosition) this._cam.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    // (a worker snapshot handed back to the worker since is detached: fall back to the newest poses)
    const src = this._lastSrc && this._lastSrc.length ? this._lastSrc : this.mode === 'worker' && this.snap ? this.snap : this.poses;
    this._present(src, src === this._lastSrc ? this._lastExt || 0 : 0);
  }

  /** Instances and triangles drawn by the HD / mid rings this frame (moving, parked; shadow proxies). */
  hdStats() {
    const sum = (ms) => { let n = 0, t = 0; for (const m of ms) if (m) { n += m.count; t += m.count * (m.userData.tris || 0); } return [n, t]; };
    const K = this._pk, [hd, hdT] = sum(this.hdMeshes || []), [mid, midT] = sum(this.midMeshes || []);
    const [phd, phdT] = K ? sum(K.hd.values()) : [0, 0], [pmid, pmidT] = K ? sum(K.mid.values()) : [0, 0];
    let proxyT = 0; for (const p of (this._proxies || new Map()).values()) proxyT += p.count * p.geometry.userData.tris;
    return { hd, mid, parkedHd: phd, parkedMid: pmid, tris: hdT + midT + phdT + pmidT, shadowProxyTris: proxyT };
  }

  // ================================================================ headlight beams (night, near the camera)
  /** Two faint additive light cones + one road light pool per vehicle, instanced; filled near the camera only. */
  _buildBeams() {
    const MAX = 96; // vehicles with beams (nearest within BEAM_R)
    this._beamMax = MAX;
    const cone = new THREE.CylinderGeometry(0.09, 2.3, 15, 14, 1, true);
    cone.translate(0, -7.5, 0).rotateX(Math.PI / 2 - 0.075); // apex at the origin, opening along -Z, dipped ~4 deg
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 } },
      vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV;
        #include <common>
        #include <fog_pars_vertex>
        void main() { vT = clamp(-position.z / 15.0, 0.0, 1.0);
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uK; varying float vT; varying vec3 vN; varying vec3 vV;
        #include <common>
        #include <fog_pars_fragment>
        void main() { float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.3);
          float a = uK * (0.3 + 0.7 * edge) * (1.0 - vT) * (1.0 - vT) * smoothstep(0.0, 0.05, vT);
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a, 1.0);
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
    });
    beamMat.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, beamMat.uniforms]);
    this._beamU = beamMat.uniforms;
    const beams = new THREE.InstancedMesh(cone, beamMat, MAX * 2);
    beams.name = 'traffic-headlight-beams'; beams.frustumCulled = false; beams.count = 0; beams.renderOrder = 3;
    beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const pool = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const poolMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uK: { value: 0 } }]),
      vertexShader: `varying vec2 vU;
        #include <common>
        #include <fog_pars_vertex>
        void main() { vU = uv; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uK; varying vec2 vU;
        #include <common>
        #include <fog_pars_fragment>
        void main() { vec2 q = (vU - 0.5) * 2.0; float r = dot(q, q);
          float a = uK * (1.0 - smoothstep(0.15, 1.0, r)) * (0.55 + 0.45 * smoothstep(-1.0, 0.6, q.y));
          gl_FragColor = vec4(vec3(1.0, 0.92, 0.78) * a, 1.0);
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12,
    });
    this._poolU = poolMat.uniforms;
    const pools = new THREE.InstancedMesh(pool, poolMat, MAX);
    pools.name = 'traffic-headlight-pools'; pools.frustumCulled = false; pools.count = 0; pools.renderOrder = 2;
    pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beams = beams; this.pools = pools;
    this.group.add(beams); this.group.add(pools);
    // per type: headlamp offsets in the vehicle frame (-Z forward)
    this._lampOff = TYPES.map((T) => { const sp = VEHICLE_SPECS[T.name] || {}; return { x: Math.max(0.45, (T.W || 1.8) / 2 - 0.33), y: clamp01h(0.45 * (sp.H || 1.5)), z: -(T.L || 4.6) / 2 + 0.08 }; });
    this._beamCand = null;
  }

  _updateBeams(darkness) {
    if (!this.beams) return;
    const k = Math.min(1, Math.max(0, (darkness - 0.3) / 0.4));
    if (k <= 0.001) { this.beams.count = 0; this.pools.count = 0; return; }
    this._beamU.uK.value = 0.05 * k; this._poolU.uK.value = 0.22 * k;
    const cam = this._cam, R2 = 120 * 120, P = this.pp, A = this.act, V = this.sim.vehicles;
    const C = this._beamCand || (this._beamCand = { d: new Float64Array(V.length), id: new Int32Array(V.length), ord: new Int32Array(V.length) });
    let n = 0;
    for (let i = 0; i < V.length; i++) {
      if (!A[i]) continue;
      const q = i * 6, d2 = (P[q] - cam.x) ** 2 + (P[q + 2] - cam.z) ** 2 + (P[q + 1] - cam.y) ** 2;
      if (d2 < R2) { C.d[n] = d2; C.id[n] = i; n++; }
    }
    if (n > this._beamMax) { // nearest first
      for (let i = 0; i < n; i++) C.ord[i] = i;
      const ord = C.ord.subarray(0, n).sort((a, b) => C.d[a] - C.d[b]);
      for (let i = 0; i < this._beamMax; i++) ord[i] = C.id[ord[i]];
      for (let i = 0; i < this._beamMax; i++) C.id[i] = ord[i];
      n = this._beamMax;
    }
    let bi = 0;
    for (let i = 0; i < n; i++) {
      const id = C.id[i], v = V[id], o = this._lampOff[v.type], q = id * 6;
      _e.set(P[q + 4], P[q + 3], 0, 'YXZ'); _q.setFromEuler(_e);
      _m.compose(_p.set(P[q], P[q + 1], P[q + 2]), _q, _one);
      _bm.makeTranslation(-o.x, o.y, o.z); _bm2.multiplyMatrices(_m, _bm); this.beams.setMatrixAt(bi * 2, _bm2);
      _bm.makeTranslation(o.x, o.y, o.z); _bm2.multiplyMatrices(_m, _bm); this.beams.setMatrixAt(bi * 2 + 1, _bm2);
      _bm.compose(_bp.set(0, 0.07, o.z - 7.5), _bq.identity(), _bs.set((o.x * 2 + 3.2), 1, 11)); _bm2.multiplyMatrices(_m, _bm); this.pools.setMatrixAt(bi, _bm2);
      bi++;
    }
    this.beams.count = bi * 2; this.pools.count = bi;
    this.beams.instanceMatrix.needsUpdate = true; this.pools.instanceMatrix.needsUpdate = true;
  }

  /**
   * Draw the poses in `src` (POSE_STRIDE floats per vehicle), extrapolated by `ext` seconds (worker snapshots are one
   * frame old), packed into their type's instance slots per type in three tiers:
   *   [ near-cascade casters | other vehicles in view | off-screen casters whose shadow can reach the view ]
   * The main pass draws tiers 1+2 (mesh.count; tier 1 may hold a few off-screen near casters), the near cascade
   * tier 1, the far cascade all three. Membership is a sphere test against the camera frustum and the two shadow
   * cameras' frustums (Atmosphere sun / sunFar). Without a camera every active vehicle is drawn in every pass.
   * Matrices are written directly (rotation YXZ: yaw, then pitch); no per-frame allocation.
   */
  _present(src, ext) {
    if (!src) return;
    this._lastSrc = src; this._lastExt = ext;
    const W = this.world, A = W && W.atmo;
    const near = A && A.sun && A.sun.castShadow ? A.sun : null, far = A && A.sunFar && A.sunFar.castShadow ? A.sunFar : null;
    const fN = near ? shadowFrustum(near, this._fN || (this._fN = new THREE.Frustum())) : null;
    const fF = far ? shadowFrustum(far, this._fF || (this._fF = new THREE.Frustum())) : null;
    // bounding spheres of the two shadow boxes: a cheap reject before the 6-plane tests
    const sN = fN ? shadowBoxSphere(near, this._sN || (this._sN = new THREE.Sphere())) : null;
    const sF = fF ? shadowBoxSphere(far, this._sF || (this._sF = new THREE.Sphere())) : null;
    this._nearShadowCam = near ? near.shadow.camera : null;
    // view frustum for drawing: World's per-frame view (this frame's camera pose) when available, else the camera's
    const wv = W && W._view;
    const fV = wv && wv.frustum ? wv.frustum : this._hasFrustum ? this._frustum : null;
    // an off-screen vehicle matters to the far cascade only if its shadow can reach the view: test a sphere that
    // covers the vehicle and its shadow (cast away from the sun, length <= 4 m / tan(sun elevation), capped)
    const L = A && A.lightDir, Ly = L ? Math.max(0.05, L.y) : 1, sl = Math.min(90, 4 / Ly) * 0.5;
    const V = this.sim.vehicles, P = this.pp, act = this.act, TN = this._tierN, TI = this._tierIdx;
    TN.fill(0);
    this._builds = 0;
    if (this.hd) this._pickHD(); // from the last presented poses: the same set is skipped below and drawn HD after
    const hdSel = this.hd ? this._hdSel : null;
    // frustum planes as flat arrays (0: near cascade, 24: view, 48: far cascade): inlined sphere tests
    const FP = this._fp || (this._fp = new Float64Array(72));
    if (fN) loadPlanes(fN, FP, 0);
    if (fV) loadPlanes(fV, FP, 24);
    if (fF) loadPlanes(fF, FP, 48);
    for (let i = 0; i < V.length; i++) {
      const o = i * POSE_STRIDE;
      if (!(src[o + 8] & 1)) { act[i] = 0; continue; }
      const v = V[i];
      let x = src[o], y = src[o + 1], z = src[o + 2], yaw = src[o + 3];
      const pitch = src[o + 4];
      if (ext > 0) {
        const sp = src[o + 6], yr = src[o + 7], d = sp * ext, ym = yaw + yr * ext * 0.5;
        x -= Math.sin(ym) * d; z -= Math.cos(ym) * d; y += Math.tan(pitch) * d; yaw += yr * ext;
      }
      const q = i * 6;
      P[q] = x; P[q + 1] = y; P[q + 2] = z; P[q + 3] = yaw; P[q + 4] = pitch; P[q + 5] = src[o + 5];
      act[i] = 1;
      if (!this.meshes[v.type]) continue;
      if (hdSel && hdSel[i]) continue; // drawn by the HD mesh (selection of the previous frame's poses)
      let t;
      if (!fV) t = 0; // no camera: every vehicle in every pass
      else {
        const cy = y + v.Hc * 0.5, r = v.L * 0.5 + 0.6;
        if (fN && nearSphere(sN, x, cy, z, r) && inPlanes(FP, 0, x, cy, z, r)) t = 0;
        else if (inPlanes(FP, 24, x, cy, z, r)) t = 1;
        else if (!fF || (nearSphere(sF, x, cy, z, r) && inPlanes(FP, 48, x, cy, z, r))) {
          t = !L || inPlanes(FP, 24, x - L.x * sl, cy - L.y * sl, z - L.z * sl, r + sl) ? 2 : -1;
        } else t = -1;
      }
      if (t < 0) continue;
      const ti = v.type, n = TN[ti * 3 + t]++;
      TI[ti][t * (TI[ti].length / 3) + n] = i;
    }
    for (let ti = 0; ti < this.meshes.length; ti++) {
      const mesh = this.meshes[ti]; if (!mesh) continue;
      const col = mesh.instanceColor ? mesh.instanceColor.array : null, br = mesh.geometry.attributes.aBrake.array, E = mesh.instanceMatrix.array;
      const idx = TI[ti], stride = idx.length / 3;
      let k = 0;
      for (let g = 0; g < 3; g++) {
        const cnt = TN[ti * 3 + g];
        for (let j = 0; j < cnt; j++) {
          const i = idx[g * stride + j], q = i * 6, v = V[i];
          const yaw = P[q + 3], pitch = P[q + 4];
          const ca = Math.cos(pitch), sa = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw), e = k * 16;
          E[e] = cy; E[e + 1] = 0; E[e + 2] = -sy; E[e + 3] = 0;
          E[e + 4] = sy * sa; E[e + 5] = ca; E[e + 6] = cy * sa; E[e + 7] = 0;
          E[e + 8] = ca * sy; E[e + 9] = -sa; E[e + 10] = ca * cy; E[e + 11] = 0;
          E[e + 12] = P[q]; E[e + 13] = P[q + 1]; E[e + 14] = P[q + 2]; E[e + 15] = 1;
          br[k] = P[q + 5];
          if (col) { col[k * 3] = v.rgb[0]; col[k * 3 + 1] = v.rgb[1]; col[k * 3 + 2] = v.rgb[2]; }
          k++;
        }
        if (g === 0) mesh.userData.nNear = k;
        else if (g === 1) mesh.count = k;
      }
      mesh.userData.nFar = k;
      // shadow-less setups (no Atmosphere shadows) still draw tier 1 + 2 in every pass
      if (!fN) mesh.userData.nNear = mesh.count;
      const n = Math.max(1, k);
      mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, n * 16); mesh.instanceMatrix.needsUpdate = true;
      const ab = mesh.geometry.attributes.aBrake; ab.clearUpdateRanges(); ab.addUpdateRange(0, n); ab.needsUpdate = true;
      if (col) { mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, n * 3); mesh.instanceColor.needsUpdate = true; }
    }
    if (this.hd) { this._presentHD(); this._parkedHD(); }
  }

  // ================================================================ colliders
  /** Append vehicle AABBs {minX,minY,maxX,maxY,minZ,maxZ,kind:'vehicle'} within `radius` of (x,z). Shared objects: read only. */
  queryColliders(x, z, radius, out = []) {
    if (!this.sim) return out;
    if (this.mode !== 'worker' || !this.snap) return this.sim.queryColliders(x, z, radius, out);
    return this._snapQuery(x, z, radius, out);
  }

  /**
   * Worker mode: the same oriented AABB slices as the sim, from the latest snapshot. 250 vehicles are scanned linearly
   * (cheaper than maintaining a grid for a few queries per frame); a vehicle's slices are computed from its snapshot
   * pose the first time a query reaches it (once per snapshot).
   */
  _snapQuery(x, z, radius, out) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return out;
    const r = Math.max(0, radius || 0), rr = r + 6.5, r2 = r * r;
    if ((2 * rr / 32 + 1) ** 2 > 1024) return out; // the sim's grid query refuses such radii too
    const S = this.snap, C = this._cvs, gen = this._snapGen;
    for (let i = 0; i < C.length; i++) {
      const o = i * POSE_STRIDE;
      if (!(S[o + 8] & 1)) continue;
      const ex = S[o] - x, ez = S[o + 2] - z;
      if (ex > rr || ex < -rr || ez > rr || ez < -rr) continue;
      const c = C[i];
      if (c.gen !== gen) {
        const y = S[o + 1], yaw = S[o + 3], dh = Math.abs(c.WB * Math.tan(S[o + 4])) * 0.5; // axle heights = y -+ dh
        vehicleSlices(c, S[o], S[o + 2], -Math.sin(yaw), -Math.cos(yaw), y - dh, y + c.Hc, S[o + 6]);
        c.gen = gen;
      }
      let b = c.box;
      let dx = x < b.minX ? b.minX - x : x > b.maxX ? x - b.maxX : 0;
      let dz = z < b.minZ ? b.minZ - z : z > b.maxZ ? z - b.maxZ : 0;
      if (dx * dx + dz * dz > r2) continue;
      for (let q = 0; q < c.nb; q++) {
        b = c.boxes[q];
        dx = x < b.minX ? b.minX - x : x > b.maxX ? x - b.maxX : 0;
        dz = z < b.minZ ? b.minZ - z : z > b.maxZ ? z - b.maxZ : 0;
        if (dx * dx + dz * dz <= r2) out.push(b);
      }
    }
    return out;
  }

  /** Debug summary (worker mode: as of the latest snapshot). */
  summary() {
    if (this.mode === 'worker' && this._summary) return this._summary;
    return this.sim ? this.sim.summary() : { count: 0, moving: 0, stopped: 0, onConn: 0, avgSpeed: 0 };
  }

  dispose() {
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this.mode = 'main';
    for (const m of this.meshes) if (m) { m.geometry.dispose(); m.dispose && m.dispose(); }
    const extra = [...(this.hdMeshes || []), ...(this.midMeshes || []), ...(this._proxies ? this._proxies.values() : []), ...(this._pk ? [...this._pk.hd.values(), ...this._pk.mid.values()] : [])];
    for (const m of extra) if (m) { m.geometry.dispose(); m.dispose && m.dispose(); }
    if (this._pk) { const P = this._pk.P; for (let i = 0; i < this._pk.sel.length; i++) if (this._pk.sel[i] && P.st[i] >= 0) P.mesh.setVisibleAt(P.ids[i], true); }
    for (const m of [this.materialHD, this.glassHD, this.parkedMatHD, this.parkedGlassHD, this.proxyMat]) if (m) m.dispose();
    if (this.beams) { this.beams.geometry.dispose(); this.beams.material.dispose(); this.pools.geometry.dispose(); this.pools.material.dispose(); }
    if (this.material) this.material.dispose();
    if (this.group && this.group.parent) this.group.parent.remove(this.group);
  }
}
