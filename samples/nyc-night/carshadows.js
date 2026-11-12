// Soft contact shadows under the nearest moving cars (the moon is too dim at dusk to plant them): one instanced
// quad per car, a radial-falloff dark blob slightly larger than the footprint, multiplied over the road
// (premultiplied alpha, no depth write). Updated per frame from Traffic.pose(i).
import * as THREE from 'three';

function blobTexture() {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export class CarShadows {
  constructor({ scene, world, max = 48, range = 140 }) {
    this.world = world; this.max = max; this.range = range;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.9,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.name = 'car-contact-shadows'; this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this._p = {}; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  update(cam) {
    const T = this.world.traffic; if (!T || !T.count) return;
    const P = this._p, R2 = this.range * this.range;
    let n = 0;
    for (let i = 0; i < T.count && n < this.max; i++) {
      T.pose(i, P);
      if (!P.active || (P.x - cam.x) ** 2 + (P.z - cam.z) ** 2 > R2) continue;
      const V = T.vehicles && T.vehicles[i], L = V ? V.L : 4.6, W = V ? V.W : 1.9;
      this._q.setFromAxisAngle(this._up, P.yaw);
      this.mesh.setMatrixAt(n++, this._m.compose(this._v.set(P.x, P.y + 0.03, P.z), this._q, this._s.set(W * 1.35, 1, L * 1.2)));
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
