// BOO's reach on the ground: a faint ring around the kid at BOO's radius while BOO is ready and a chaser is inside it
// (the moment the BOO button glows), so "inside the ring means BOO now" can be seen. A thin lavender band (bright in
// its middle, fading to nothing at both edges, no fill inside), additive; it fades in and out and breathes slowly.
// Nothing here allocates per frame.
import * as THREE from 'three';

/** A flat unit-radius band from r0 to 1 whose vertex colours peak halfway across it (lying on the XZ plane). */
function bandGeometry(r0 = 0.94, segments = 96) {
  const g = new THREE.RingGeometry(r0, 1, segments, 2).rotateX(-Math.PI / 2);
  const P = g.attributes.position, c = new Float32Array(P.count * 3), mid = (r0 + 1) / 2, half = (1 - r0) / 2;
  for (let i = 0; i < P.count; i++) {
    const k = Math.max(0, 1 - Math.abs(Math.hypot(P.getX(i), P.getZ(i)) - mid) / half);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}

export class BooReach {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.62, 0.36, 1.25), vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(bandGeometry(), mat);
    this.mesh.visible = false; this.mesh.renderOrder = 10; this.mesh.name = 'booReach'; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.a = 0; this.t = 0;
  }

  /** Per frame: the ring around (x, y, z) (feet on the ground) at radius r, easing toward on / off. */
  update(dt, on, x, y, z, r) {
    this.a += ((on ? 1 : 0) - this.a) * (1 - Math.exp(-(on ? 10 : 6) * dt));
    const m = this.mesh;
    if (this.a < 0.01) { m.visible = false; return; }
    this.t += dt;
    m.visible = true; m.position.set(x, y + 0.08, z); m.scale.set(r, 1, r);
    m.material.opacity = this.a * (0.5 + 0.12 * Math.sin(this.t * 5));
  }
}
