// The player: a procedural skinned kid in a witch costume (pointy hat, cape, striped stockings, a glowing
// jack-o'-lantern candy pail), on the same bone names and procedural clips as the character sample's rig
// (samples/character/rig.js: Idle / Walking / Running / Jump), so the engine's AnimationController drives it.
// Kid proportions: hips at 0.62 m, a big head, 1.3 m to the hat brim; the clips are built for that hip height.
//   buildKid() -> { root, skinnedMesh, clips, headBone, handR, pail (Mesh on the right hand), pailGlow (Points) }
// Faces +Z (glTF convention), feet at y = 0. One SkinnedMesh (vertex coloured, every segment 100 % on its bone) + the
// pail's glowing face as a child mesh of the right hand bone (an unlit HDR colour for bloom).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { proceduralClips } from '../character/rig.js';

// [name, parent, joint position at rest] (model space, faces +Z, its left is +X)
const JOINTS = [
  ['hips', null, [0, 0.62, 0]],
  ['spine', 'hips', [0, 0.7, 0]],
  ['chest', 'spine', [0, 0.82, 0]],
  ['neck', 'chest', [0, 0.95, 0]],
  ['head', 'neck', [0, 1.0, 0]],
  ['upperArmL', 'chest', [0.155, 0.93, 0]],
  ['lowerArmL', 'upperArmL', [0.155, 0.76, 0]],
  ['upperArmR', 'chest', [-0.155, 0.93, 0]],
  ['lowerArmR', 'upperArmR', [-0.155, 0.76, 0]],
  ['upperLegL', 'hips', [0.075, 0.59, 0]],
  ['lowerLegL', 'upperLegL', [0.075, 0.33, 0]],
  ['footL', 'lowerLegL', [0.075, 0.075, 0]],
  ['upperLegR', 'hips', [-0.075, 0.59, 0]],
  ['lowerLegR', 'upperLegR', [-0.075, 0.33, 0]],
  ['footR', 'lowerLegR', [-0.075, 0.075, 0]],
];
const LEAVES = [['handL', 'lowerArmL', [0.155, 0.6, 0]], ['handR', 'lowerArmR', [-0.155, 0.6, 0]]];
const SKELETON = JOINTS.concat(LEAVES);
const BONE_INDEX = Object.fromEntries(JOINTS.map((j, i) => [j[0], i]));
const JOINT_POS = Object.fromEntries(SKELETON.map((j) => [j[0], j[2]]));
/** proceduralClips(h) puts the hips at 0.98 * h / 1.8: this h puts them at the kid's 0.62 m. */
const CLIP_HEIGHT = 1.8 * (0.62 / 0.98);

export const KID_COLORS = {
  robe: '#5b2a86', robeDark: '#3a1a5c', cape: '#26123d', capeIn: '#7a1f3d', trim: '#ff8a1e', skin: '#f1c7a5',
  hair: '#ff7a1a', hat: '#3d1d63', band: '#5fe36b', boot: '#1b1424', stripeA: '#ff8a1e', stripeB: '#1d1426', pail: '#ff7b16',
};

const _c = new THREE.Color();
function seg(g, bone, color) {
  if (g.index === null) { const n = g.attributes.position.count, ix = new Uint16Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
  g.deleteAttribute('uv');
  _c.set(color);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const b = BONE_INDEX[bone];
  for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; si[i * 4] = b; sw[i * 4] = 1; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}
const cap = (r, len, x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.CapsuleGeometry(r, len, 4, 12).scale(sx, sy, sz).translate(x, y, z);
const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
const cyl = (r0, r1, h, x, y, z, seg = 14) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);

/** Witch hat: brim, band and a cone in three tilted frustums (the tip droops backwards). */
function hatParts(P) {
  const y0 = 1.245;
  P.push(seg(cyl(0.28, 0.28, 0.022, 0, y0, 0, 20), 'head', KID_COLORS.hat));
  P.push(seg(cyl(0.172, 0.178, 0.06, 0, y0 + 0.04, 0, 18), 'head', KID_COLORS.band));
  const stack = [[0.17, 0.115, 0.17, 0, 0], [0.115, 0.065, 0.15, -0.025, 0.25], [0.065, 0.004, 0.16, -0.07, 0.6]];
  let y = y0 + 0.012, z = 0;
  for (const [r0, r1, h, dz, tilt] of stack) {
    const g = new THREE.CylinderGeometry(r1, r0, h, 14).translate(0, h / 2, 0).rotateX(-tilt).translate(0, y, z);
    P.push(seg(g, 'head', KID_COLORS.hat));
    y += h * Math.cos(tilt) * 0.96; z += dz;
  }
  // a little star on the band (front)
  P.push(seg(new THREE.OctahedronGeometry(0.035, 0).scale(1, 1, 0.4).translate(0, y0 + 0.045, 0.176), 'head', '#ffe36b'));
}

function bodyGeometry() {
  const C = KID_COLORS, P = [];
  // head, hair tufts, face
  P.push(seg(ball(0.158, 0, 1.135, 0, 1, 1.02, 1, 18, 14), 'head', C.skin));
  for (const [x, y, z, r] of [[0.13, 1.17, -0.04, 0.06], [-0.13, 1.17, -0.04, 0.06], [0.1, 1.2, -0.1, 0.065], [-0.1, 1.2, -0.1, 0.065], [0, 1.19, -0.14, 0.075], [0.14, 1.11, -0.02, 0.045], [-0.14, 1.11, -0.02, 0.045]]) {
    P.push(seg(ball(r, x, y, z, 1, 1, 1, 8, 6), 'head', C.hair));
  }
  for (const s of [1, -1]) {
    P.push(seg(ball(0.026, s * 0.055, 1.15, 0.142, 1, 1.25, 0.6, 8, 6), 'head', '#1a1020'));   // eyes
    P.push(seg(ball(0.03, s * 0.095, 1.095, 0.128, 1, 0.7, 0.4, 8, 6), 'head', '#f39a9a'));     // cheeks
  }
  P.push(seg(ball(0.022, 0, 1.115, 0.157, 1, 1, 1, 8, 6), 'head', '#e9a985'));                  // nose
  P.push(seg(new THREE.TorusGeometry(0.035, 0.008, 4, 10, Math.PI).rotateZ(Math.PI).translate(0, 1.08, 0.148), 'head', '#7a2030')); // smile
  hatParts(P);
  // neck + collar
  P.push(seg(cyl(0.045, 0.05, 0.08, 0, 0.97, 0, 10), 'neck', C.skin));
  P.push(seg(new THREE.TorusGeometry(0.075, 0.025, 6, 16).rotateX(Math.PI / 2).translate(0, 0.935, 0), 'chest', C.trim));
  // torso: robe top, belt, skirt (flared cone on the hips)
  P.push(seg(cap(0.115, 0.1, 0, 0.84, 0, 1.0, 1, 0.82), 'chest', C.robe));
  P.push(seg(cap(0.105, 0.02, 0, 0.71, 0, 1, 1, 0.82), 'spine', C.robe));
  P.push(seg(cyl(0.118, 0.118, 0.035, 0, 0.665, 0, 16).scale(1, 1, 0.84), 'hips', C.trim));
  P.push(seg(cyl(0.12, 0.215, 0.24, 0, 0.53, 0, 18).scale(1, 1, 0.86), 'hips', C.robe));
  P.push(seg(cyl(0.216, 0.222, 0.025, 0, 0.405, 0, 18).scale(1, 1, 0.86), 'hips', C.robeDark));
  // cape: a curved sheet behind the shoulders down to the knees (chest bone), dark outside, crimson lining inside
  {
    const g = new THREE.CylinderGeometry(0.2, 0.3, 0.56, 14, 1, true, Math.PI * 0.62, Math.PI * 0.76).translate(0, 0.66, 0).scale(1, 1, 0.8);
    P.push(seg(g, 'chest', C.cape));
    const gi = new THREE.CylinderGeometry(0.19, 0.29, 0.55, 14, 1, true, Math.PI * 0.62, Math.PI * 0.76).translate(0, 0.66, 0).scale(1, 1, 0.78);
    gi.index.array.reverse(); // flip the winding and the normals: the lining faces in
    const nr = gi.attributes.normal.array; for (let i = 0; i < nr.length; i++) nr[i] = -nr[i];
    P.push(seg(gi, 'chest', C.capeIn));
  }
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    P.push(seg(ball(0.055, s * 0.155, 0.925, 0, 1, 1, 1, 10, 8), `upperArm${L}`, C.robe));
    P.push(seg(cap(0.042, 0.11, s * 0.155, 0.84, 0), `upperArm${L}`, C.robe));
    P.push(seg(cyl(0.05, 0.062, 0.12, s * 0.155, 0.7, 0, 12), `lowerArm${L}`, C.robe));      // flared sleeve
    P.push(seg(cyl(0.064, 0.064, 0.02, s * 0.155, 0.64, 0, 12), `lowerArm${L}`, C.trim));
    P.push(seg(ball(0.038, s * 0.155, 0.605, 0.005, 0.9, 1.1, 1, 10, 8), `lowerArm${L}`, C.skin));
    P.push(seg(cap(0.052, 0.17, s * 0.075, 0.46, 0), `upperLeg${L}`, C.stripeB));
    // striped stockings
    for (let k = 0; k < 4; k++) P.push(seg(cyl(0.041, 0.043, 0.055, s * 0.075, 0.305 - k * 0.055, 0, 10), `lowerLeg${L}`, k & 1 ? C.stripeB : C.stripeA));
    // pointy boots
    P.push(seg(new THREE.CapsuleGeometry(0.045, 0.1, 4, 10).rotateX(Math.PI / 2).scale(1.05, 0.85, 1).translate(s * 0.075, 0.05, 0.035), `foot${L}`, C.boot));
    P.push(seg(new THREE.ConeGeometry(0.03, 0.09, 8).rotateX(Math.PI / 2).rotateX(-0.5).translate(s * 0.075, 0.075, 0.15), `foot${L}`, C.boot));
  }
  for (const g of P) { g.deleteAttribute('uv'); if (g.attributes.normal === undefined) g.computeVertexNormals(); }
  const g = mergeGeometries(P);
  for (const p of P) p.dispose();
  return g;
}

/** The candy pail in the right hand: an orange pumpkin bucket (lit) + its glowing face (unlit HDR, bloom). */
function buildPail() {
  const group = new THREE.Group(); group.name = 'pail';
  const body = new THREE.SphereGeometry(0.09, 14, 10).scale(1, 0.86, 1);
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) { // ribs + an open top
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 - 0.06 * Math.abs(Math.sin(a * 4));
    pos.setXYZ(i, x * k, Math.min(y, 0.055), z * k);
  }
  body.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: KID_COLORS.pail, roughness: 0.55, emissive: '#ff5a00', emissiveIntensity: 0.25 });
  const shell = new THREE.Mesh(body, mat); shell.castShadow = true; group.add(shell);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 5, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#2a1a14', roughness: 0.6 }));
  handle.position.y = 0.05; group.add(handle);
  // face: two triangle eyes and a jagged mouth on the front (+Z), unlit and over-bright (bloom)
  const tri = (cx, cy, s) => [cx - s, cy - s * 0.6, cx + s, cy - s * 0.6, cx, cy + s * 0.8];
  const pts = [...tri(-0.032, 0.012, 0.018), ...tri(0.032, 0.012, 0.018)];
  const mouth = [[-0.045, -0.02], [-0.03, -0.035], [-0.015, -0.025], [0, -0.04], [0.015, -0.025], [0.03, -0.035], [0.045, -0.02]];
  for (let i = 0; i < mouth.length - 1; i++) { const [x0, y0] = mouth[i], [x1, y1] = mouth[i + 1]; pts.push(x0, y0, x1, y1, (x0 + x1) / 2, -0.008); }
  const v = [];
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; v.push(x, y, Math.sqrt(Math.max(0, 0.0081 - x * x - y * y / 0.74)) + 0.004); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const face = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 2.2, 0.5), side: THREE.DoubleSide, toneMapped: true }));
  group.add(face);
  return group;
}

export function buildKid() {
  const geometry = bodyGeometry();
  const bones = [], byName = {};
  for (const [name, parent, p] of SKELETON) {
    const b = new THREE.Bone(); b.name = name;
    const pp = parent ? JOINT_POS[parent] : [0, 0, 0];
    b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (parent) byName[parent].add(b);
    bones.push(b); byName[name] = b;
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, emissive: '#1a0d22', emissiveIntensity: 1 });
  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
  skinnedMesh.name = 'kid';
  skinnedMesh.add(bones[0]);
  skinnedMesh.bind(new THREE.Skeleton(bones));
  skinnedMesh.castShadow = true; skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;
  const root = new THREE.Group(); root.name = 'kidRoot';
  root.add(skinnedMesh);
  const pail = buildPail();
  pail.position.set(0, -0.085, 0.03); // hangs under the right hand
  byName.handR.add(pail);
  return { root, skinnedMesh, material, clips: proceduralClips(CLIP_HEIGHT), headBone: byName.head, handR: byName.handR, pail };
}
