// Extra clustered lights on top of MapWorld's street lamps: the signs (every screen / fascia / marquee / ticker within
// `signRange` of the camera), the headlights (spot lights) and tail lights of the nearest moving cars, and a soft
// fill that follows the walker. MapWorld's lamp list (NearestLights, mode 'clustered') writes lights 0..n-1 and sets
// the count only when the camera moved 4 m; this wraps the ClusteredLights instance's update() so that, every frame,
// just before the cluster assignment, the extra lights are written from index n (= lightPool.pushed) on and the count
// raised to cover them; the traffic signals' phase colours too. Allocation-free per frame.
import * as THREE from 'three';

const _cand = [];

export class ExtraLights {
  /**
   * @param {{ clustered, world, signs: Array<{x,y,z,range,r,g,b}>, signRange?: number, cars?: number, headK?: number,
   *   player?: THREE.Object3D|null }} o
   */
  constructor(o) {
    this.cl = o.clustered; this.world = o.world;
    this.signs = o.signs || [];
    this.signals = o.signals || []; // [{ sig (Props signal: .state), group, x, y, z }]
    this.signRange = o.signRange ?? 260;
    this.cars = o.cars ?? 24; this.headK = o.headK ?? 1;
    this.player = o.player || null;
    this.enabled = true; this.signsOn = true; this.carsOn = true;
    this.count = 0; this.signCount = 0; this.carCount = 0;
    this._pose = {}; this._cam = new THREE.Vector3();
    this._d = new Float32Array(4096); this._i = new Int32Array(4096);
    const orig = this.cl.update.bind(this.cl);
    this.cl.update = (camera) => { if (camera) this._write(camera); return orig(camera); };
  }

  _write(camera) {
    const cl = this.cl, W = this.world, LP = W.props && W.props.lightPool;
    const base = LP && LP.mode === 'clustered' ? LP.pushed : 0;
    let n = base;
    const max = cl.maxLights - 1;
    if (!this.enabled || !(W.atmo && W.atmo.darkness > 0.3)) { if (cl.count > base) cl.count = base; this.count = 0; return; }
    const cam = this._cam.setFromMatrixPosition(camera.matrixWorld);
    // ---- signs
    const R2 = this.signRange * this.signRange;
    let s = 0;
    if (this.signsOn) {
      for (const l of this.signs) {
        if (n >= max) break;
        const d2 = (l.x - cam.x) ** 2 + (l.z - cam.z) ** 2;
        if (d2 > R2) continue;
        // small lights (shop fronts, wall lights: ranges of 8-10 m) only near the camera, where their pools are seen
        const near = 40 + l.range * 6, d = Math.sqrt(d2);
        if (d > near) continue;
        const f = Math.min(1, (this.signRange - d) / 40, (near - d) / 25); // fade at the edge of either range
        cl.setLight(n++, l.x, l.y, l.z, l.range, l.r * f, l.g * f, l.b * f, 2);
        s++;
      }
    }
    this.signCount = s;
    // ---- traffic signals within 160 m: the colour the heads of that phase group show (Props.updateSignals' rule)
    for (const g of this.signals) {
      if (n >= max) break;
      if ((g.x - cam.x) ** 2 + (g.z - cam.z) ** 2 > 25600) continue;
      const st = g.sig.state, a = g.group === 0;
      const light = st === 0 ? (a ? 2 : 0) : st === 1 ? (a ? 1 : 0) : st === 3 ? (a ? 0 : 2) : st === 4 ? (a ? 0 : 1) : 0;
      if (light === 2) cl.setLight(n++, g.x, g.y, g.z, 15, 0.05, 1.5, 0.75, 2);
      else if (light === 1) cl.setLight(n++, g.x, g.y, g.z, 15, 1.7, 1.0, 0.05, 2);
      else cl.setLight(n++, g.x, g.y, g.z, 15, 1.8, 0.07, 0.03, 2);
    }
    // ---- cars: nearest `cars` active vehicles within 120 m -> a headlight spot pair (one wide spot) + a tail glow
    let c = 0;
    const T = W.traffic;
    if (this.carsOn && T && T.count && n + 2 < max) {
      const P = this._pose, D = this._d, I = this._i;
      let m = 0;
      const N = Math.min(T.count, 4096);
      for (let i = 0; i < N; i++) {
        T.pose(i, P);
        if (!P.active) continue;
        const d2 = (P.x - cam.x) ** 2 + (P.z - cam.z) ** 2;
        if (d2 > 14400) continue;
        D[m] = d2; I[m] = i; m++;
      }
      // partial selection of the nearest
      const k = Math.min(this.cars, m);
      for (let a = 0; a < k; a++) {
        let b = a; for (let j = a + 1; j < m; j++) if (D[j] < D[b]) b = j;
        const td = D[a]; D[a] = D[b]; D[b] = td; const ti = I[a]; I[a] = I[b]; I[b] = ti;
        T.pose(I[a], P);
        const V = T.vehicles && T.vehicles[I[a]];
        const L = V ? V.L : 4.6;
        const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
        const hx = P.x + fx * L * 0.5, hz = P.z + fz * L * 0.5;
        const hk = 9 * this.headK;
        cl.setSpot(n++, hx, P.y + 0.75, hz, 28, hk, hk * 0.92, hk * 0.8, 2, fx, -0.12, fz, Math.cos(0.32), Math.cos(0.52));
        const tk = 0.35 + 1.4 * (P.brake || 0);
        cl.setLight(n++, P.x - fx * L * 0.55, P.y + 0.8, P.z - fz * L * 0.55, 6, tk, 0.02 * tk, 0.01 * tk, 2);
        c++;
        if (n + 2 >= max) break;
      }
    }
    this.carCount = c;
    // ---- a soft fill above and behind the walker's shoulder (reads against the dark)
    if (this.player && n < max) {
      const p = this.player.position;
      cl.setLight(n++, p.x, p.y + 2.6, p.z, 5.5, 0.35, 0.38, 0.45, 2);
    }
    cl.count = n;
    this.count = n - base;
  }
}
