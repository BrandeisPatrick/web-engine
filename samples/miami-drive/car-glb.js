// The hero car from a glTF file (desktop tier): the Khronos "Car Concept" sample (CC-BY 4.0, see
// public/miami/CREDITS.md; our copy has the Khronos / 3D Commerce marks removed), re-oriented to the car frame and
// wired to the same interface as car-model.js buildCarModel(), so HeroCar drives either model:
//   { root, wheels[4] ({ root (steers), spin (rolls), side, base, radius }), lamps (uHead, uDrl, uTail, uBrake,
//     uReverse, uIndL, uIndR: { value }), materials (incl. dummies brake3 / fog), anchors, stats }
// Static parts are merged per material (one draw each); each wheel's rim / tyre / disc are re-centred on the axle so
// they spin, the calipers steer but do not spin. The transmission glass becomes a tinted transparent glass (no
// transmission pass); the lamp materials are driven through emissive intensity.
//
//   const model = await loadCarGlb({ url, paint: 0x5c0c18 });
//
// Car frame: x right, y up from the tyre contact plane, z towards the rear (forward = -Z), the wheelbase centred on 0.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WHEEL = /^Wheel(Front|Rear)(L|R)$/;
const HIDE = /Emblem/; // the steering-wheel badge

function plateTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#f1eee6'); grd.addColorStop(1, '#e2c7a2');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#1d3b5a'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 118);
  g.fillStyle = '#123a5e'; g.font = 'bold 84px "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('VLA 92', 256, 70);
  g.fillStyle = '#d2532a'; g.font = 'bold 18px Helvetica, Arial, sans-serif'; g.fillText('SUNCOAST', 256, 18);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false;
  return t;
}

/** @param {{ url: string, paint?: number }} o */
export async function loadCarGlb(o) {
  const t0 = performance.now();
  const gltf = await new GLTFLoader().loadAsync(o.url);
  const src = gltf.scene;
  // The showcase model poses its wheels: the front pair steered 30 degrees and every wheel at its own roll angle. A
  // wheel node's local X is its axle, so clearing the node's rotation sets the wheel straight (axle along the car's
  // X) at zero roll. Baked in as posed, the front tyres pointed sideways while driving straight and wobbled when
  // spun about the car's axle, and each caliper sat wherever that wheel's roll angle had carried it.
  src.traverse((n) => { if (WHEEL.test(n.name || '')) n.quaternion.identity(); });
  src.updateMatrixWorld(true);
  // ---- orientation from the wheels: forward = front axle - rear axle, up = +Y (glTF)
  const wb = {};
  src.traverse((n) => { const m = WHEEL.exec(n.name || ''); if (m) wb[m[1] + m[2]] = new THREE.Box3().setFromObject(n); });
  if (Object.keys(wb).length !== 4) throw new Error('car glb: four Wheel{Front,Rear}{L,R} nodes expected');
  const ctr = (b) => b.getCenter(new THREE.Vector3());
  const front = ctr(wb.FrontL).add(ctr(wb.FrontR)).multiplyScalar(0.5), rear = ctr(wb.RearL).add(ctr(wb.RearR)).multiplyScalar(0.5);
  const fwd = front.clone().sub(rear); fwd.y = 0; fwd.normalize();
  const yaw = Math.atan2(fwd.x, fwd.z); // rotate fwd onto -Z
  const M = new THREE.Matrix4().makeRotationY(Math.PI - yaw);
  const mid = front.clone().add(rear).multiplyScalar(0.5).applyMatrix4(M);
  let groundY = Infinity; for (const k in wb) groundY = Math.min(groundY, wb[k].clone().applyMatrix4(M).min.y);
  M.premultiply(new THREE.Matrix4().makeTranslation(-mid.x, -groundY, -mid.z));

  // ---- materials: tune for the scene (paint colour, glass, lamps), mark for the reflection probe
  const mats = new Map();
  const lampMats = { tail: [], head: [], sig: [] };
  const plate = plateTexture();
  const fix = (m) => {
    if (mats.has(m)) return mats.get(m);
    let r = m;
    const name = m.name || '';
    if (m.transmission > 0 || /Glass/.test(name)) {
      r = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.4, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8, depthWrite: false, name: 'carGlass' }); // the interior shows faintly through it
    }
    if (/^Paint 1/.test(name) && o.paint != null) {
      // deep burgundy (the reference: trunk ~ (30, 14, 22) sRGB at dusk, roof ~ (48, 34, 42) where it takes the sky): a dark,
      // saturated base; half-metallic flakes so the base layer's reflection keeps the hue; a smooth clear coat that lays
      // a broad soft sky reflection over it without washing it out
      r.color.copy(new THREE.Color(o.paint)); r.metalness = 0.55; r.roughness = 0.34;
      r.clearcoat = 1; r.clearcoatRoughness = 0.045; r.envMapIntensity = 2.6; r.userData.paintEnv = [1.3, 2.8]; // (noon .. dusk: car.js)
      if (r.normalScale) r.normalScale.set(0.15, 0.15);
    }
    if (r.emissiveMap && /^(Hardware|Mirror|Brake|Rim1|Rim2|License)$/.test(name)) { r.emissiveMap = null; r.emissive?.setRGB(0, 0, 0); } // (the logo sheet, cleared in our copy)
    if (/^License$/.test(name) && plate) { r.map = plate; r.color?.setRGB(0.3, 0.3, 0.3); r.roughness = 0.5; r.emissiveMap = plate; r.emissive.setRGB(1, 0.95, 0.85); r.emissiveIntensity = 0; }
    if (/^Brakelight/.test(name)) { r.emissiveMap = null; r.emissive.setRGB(1, 0.13, 0.045); r.emissiveIntensity = 0; lampMats.tail.push(r); }
    if (/^Headlight/.test(name)) { r.emissive.setRGB(1, 0.92, 0.8); r.emissiveIntensity = 0; lampMats.head.push(r); }
    if (/^Signallight/.test(name)) { r.emissive.setRGB(1, 0.45, 0.06); r.emissiveIntensity = 0; lampMats.sig.push(r); }
    if (/^Dashboard/.test(name)) r.emissiveIntensity = Math.min(r.emissiveIntensity ?? 1, 0.4);
    if (r.iridescence) r.iridescence = 0;
    r.userData.carEnv = true;
    mats.set(m, r);
    return r;
  };

  // ---- geometry: wheels re-centred, the rest baked into the car frame and merged per material
  const root = new THREE.Group(); root.name = 'carBody';
  const wheelParts = { FrontL: [], FrontR: [], RearL: [], RearR: [] };
  const byMat = new Map();
  const tmp = new THREE.Matrix4();
  src.traverse((n) => {
    if (!n.isMesh || HIDE.test(n.name || '')) return;
    let w = null; for (let p = n; p; p = p.parent) { const m = WHEEL.exec(p.name || ''); if (m) { w = m[1] + m[2]; break; } }
    tmp.multiplyMatrices(M, n.matrixWorld);
    const g = n.geometry.clone().applyMatrix4(tmp);
    for (const k of Object.keys(g.attributes)) if (!/^(position|normal|uv|uv1|tangent)$/.test(k)) g.deleteAttribute(k);
    const mat = fix(n.material);
    if (w) wheelParts[w].push({ g, mat, caliper: /BrakePad/.test(n.name) });
    else { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g); }
  });
  let tris = 0;
  const count = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  for (const [mat, list] of byMat) {
    const sig = (g) => Object.keys(g.attributes).sort().join(',') + (g.index ? '+i' : '');
    const groups = new Map(); for (const g of list) { const s = sig(g); if (!groups.has(s)) groups.set(s, []); groups.get(s).push(g); }
    for (const gs of groups.values()) {
      const g = gs.length > 1 ? mergeGeometries(gs) : gs[0];
      const mesh = new THREE.Mesh(g, mat); mesh.name = `car-${mat.name || 'part'}`;
      mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
      if (mat.transparent) mesh.renderOrder = 2;
      root.add(mesh); tris += count(g);
    }
  }
  // ---- wheels: [front-left, front-right, rear-left, rear-right] in the car frame (x < 0 = left)
  const wheels = [];
  const order = ['Front', 'Rear'];
  for (const fr of order) {
    const pair = ['L', 'R'].map((s) => { const b = new THREE.Box3(); for (const p of wheelParts[fr + s]) { p.g.computeBoundingBox(); b.union(p.g.boundingBox); } return { key: fr + s, b }; });
    pair.sort((a, b) => ctr(a.b).x - ctr(b.b).x);
    for (const { key, b } of pair) {
      const c = ctr(b), radius = (b.max.y - b.min.y) / 2;
      const wroot = new THREE.Group(); wroot.name = `wheel-${key}`;
      const spin = new THREE.Group();
      for (const p of wheelParts[key]) {
        p.g.translate(-c.x, -c.y, -c.z);
        const mesh = new THREE.Mesh(p.g, p.mat); mesh.castShadow = true; mesh.receiveShadow = true;
        (p.caliper ? wroot : spin).add(mesh); tris += count(p.g);
      }
      wroot.add(spin);
      wroot.position.set(c.x, radius, c.z);
      wheels.push({ root: wroot, spin, side: c.x < 0 ? -1 : 1, base: new THREE.Vector3(c.x, radius, c.z), radius });
    }
  }
  // ---- lamps through emissive intensity (the same uniforms the generated car exposes)
  const L = { head: 0, drl: 1, tail: 0, brake: 0, rev: 0, il: 0, ir: 0 };
  // (by material name on the meshes: PostFX.track may clone a shared material per mesh)
  const apply = () => {
    const kTail = 2.6 * L.tail + 7.0 * L.brake, kHead = 6 * L.head + 0.3 * L.drl, kSig = 4 * Math.max(L.il, L.ir), kPlate = 0.025 * L.tail;
    root.traverse((n) => {
      const m = n.material; if (!m || !m.name) return;
      if (/^Brakelight/.test(m.name)) m.emissiveIntensity = kTail;
      else if (/^Headlight/.test(m.name)) m.emissiveIntensity = kHead;
      else if (/^Signallight/.test(m.name)) m.emissiveIntensity = kSig;
      else if (/^License$/.test(m.name)) m.emissiveIntensity = kPlate;   // a dim plate lamp
    });
  };
  const u = (k) => ({ get value() { return L[k]; }, set value(v) { if (L[k] !== v) { L[k] = v; apply(); } } });
  const lamps = { uHead: u('head'), uDrl: u('drl'), uTail: u('tail'), uBrake: u('brake'), uReverse: u('rev'), uIndL: u('il'), uIndR: u('ir'), uPlate: { value: plate } };
  apply();
  // ---- the body's extent and anchors HeroCar reads (lamp lights, exhaust)
  const box = new THREE.Box3(), tailBox = new THREE.Box3();
  for (const c of root.children) { c.geometry.computeBoundingBox(); box.union(c.geometry.boundingBox); if (/^Brakelight/.test(c.material.name)) tailBox.union(c.geometry.boundingBox); }
  const size = box.getSize(new THREE.Vector3());
  const anchors = {
    rearZ: box.max.z, frontZ: box.min.z, halfWidth: size.x / 2, height: box.max.y,
    tail: tailBox.isEmpty() ? [[-size.x * 0.36, 0.78, box.max.z], [size.x * 0.36, 0.78, box.max.z]]
      : [[tailBox.min.x * 0.72, (tailBox.min.y + tailBox.max.y) / 2, tailBox.max.z], [tailBox.max.x * 0.72, (tailBox.min.y + tailBox.max.y) / 2, tailBox.max.z]],
    tailWidth: tailBox.isEmpty() ? 1.2 : tailBox.max.x - tailBox.min.x,
    exhaust: [[size.x * 0.3, 0.28, box.max.z - 0.05]],
    head: [[-size.x * 0.33, 0.62, box.min.z - 0.05], [size.x * 0.33, 0.62, box.min.z - 0.05]],
  };
  const materials = {
    brake3: new THREE.MeshStandardMaterial({ name: 'thirdBrake' }), fog: new THREE.MeshStandardMaterial({ name: 'fogLamp' }),
    ...Object.fromEntries([...new Set(mats.values())].map((m) => [m.name || m.uuid, m])),
  };
  // memory: nothing reads the vertex arrays after upload (physics uses spec.js): drop the CPU copies
  const free = (g) => { g.computeBoundingSphere(); g.computeBoundingBox(); for (const k in g.attributes) g.attributes[k].onUpload(function () { this.array = new this.array.constructor(0); }); if (g.index) g.index.onUpload(function () { this.array = new this.array.constructor(0); }); };
  root.traverse((n) => { if (n.isMesh) free(n.geometry); });
  for (const w of wheels) w.root.traverse((n) => { if (n.isMesh) free(n.geometry); });
  return {
    root, wheels, lamps, materials, anchors, kind: 'glb',
    stats: { lod: 'glb', triangles: Math.round(tris), draws: root.children.length + wheels.length * 4, size: size.toArray().map((v) => +v.toFixed(3)), wheelbase: +(front.distanceTo(rear)).toFixed(3), ms: Math.round(performance.now() - t0) },
  };
}
