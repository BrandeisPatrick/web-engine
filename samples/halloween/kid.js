// The player: a procedural skinned kid in a witch costume, chibi proportions (a big round head, short limbs): a wide
// floppy hat with a bent, drooping tip and a buckled band, orange hair with bangs and two braids that stick out
// sideways (the silhouette that reads from behind at 100 px), a toon face (big glossy eyes with catchlights, blush, a
// little open smile, freckles), a purple dress with a zigzag hem and trumpet sleeves, a pleated cape with a crimson
// lining and stars on its back, striped stockings, curly-toed boots and a jack-o'-lantern candy pail (carved face that
// glows, candy peeking out) in the right hand. Bone names as the character sample's rig, with the kid's own clips
// (Idle / Walking / Running / Jump: a bouncy short-legged run, a jump with an anticipation crouch, a tuck and a reach
// for the ground), so the engine's AnimationController drives it.
// Kid proportions: hips at 0.62 m, 1.3 m to the hat brim, 1.72 m to the top of the bent hat.
//   buildKid() -> { root, skinnedMesh, material, clips, headBone, handR, pail (the pail's centre, an Object3D on the
//   right hand), cape, hatTip (secondary-motion bones: main.js swings them with the speed) }
//   landPose(kid, k)  after the clips: bend into a landing (k 0..1: knees, hips, arms out), main.js drives it from
//   the landing squash
// Faces +Z (glTF convention), feet at y = 0. ONE SkinnedMesh, one draw (vertex coloured; the pail and its glowing face
// are part of it: a per-vertex `glow` adds albedo x glow as emissive, so the pail's face and the eyes' catchlights read
// in the dark and bloom, and no separate pail meshes are drawn). Segments are rigid on their bone except the hat tip
// and the braids' roots, which blend between two bones so they bend without cracks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchRim, patchGlow } from './looks.js';
import { sweep, lathe, curve, star, smooth } from './props.js';

// [name, parent, joint position at rest] (model space, faces +Z, its left is +X)
const JOINTS = [
  ['hips', null, [0, 0.62, 0]],
  ['spine', 'hips', [0, 0.7, 0]],
  ['chest', 'spine', [0, 0.82, 0]],
  ['neck', 'chest', [0, 0.95, 0]],
  ['head', 'neck', [0, 1.0, 0]],
  ['upperArmL', 'chest', [0.135, 0.915, 0]],
  ['lowerArmL', 'upperArmL', [0.15, 0.765, 0]],
  ['upperArmR', 'chest', [-0.135, 0.915, 0]],
  ['lowerArmR', 'upperArmR', [-0.15, 0.765, 0]],
  ['upperLegL', 'hips', [0.07, 0.59, 0]],
  ['lowerLegL', 'upperLegL', [0.072, 0.33, 0]],
  ['footL', 'lowerLegL', [0.072, 0.08, 0]],
  ['upperLegR', 'hips', [-0.07, 0.59, 0]],
  ['lowerLegR', 'upperLegR', [-0.072, 0.33, 0]],
  ['footR', 'lowerLegR', [-0.072, 0.08, 0]],
];
// leaves: the hands, and two secondary-motion bones the clips never key (main.js swings them): the cape from the
// shoulders, the hat tip from the bend of the cone
const HAT_Y = 1.262; // the brim's underside at the front
const LEAVES = [['handL', 'lowerArmL', [0.155, 0.61, 0.005]], ['handR', 'lowerArmR', [-0.155, 0.61, 0.005]],
  ['cape', 'chest', [0, 0.93, -0.1]], ['hatTip', 'head', [0, HAT_Y + 0.3, -0.035]]];
const SKELETON = JOINTS.concat(LEAVES);
const BONES = JOINTS.map((j) => j[0]);
const BONE_INDEX = Object.fromEntries(SKELETON.map((j, i) => [j[0], i]));
const JOINT_POS = Object.fromEntries(SKELETON.map((j) => [j[0], j[2]]));
const HIPS_Y = JOINT_POS.hips[1];

export const KID_COLORS = {
  robe: '#6b33a6', robeDark: '#47206f', cape: '#3b1b62', capeIn: '#c23a4e', trim: '#ff8d1f', skin: '#f3c6a4',
  hair: '#e84a14', hairDark: '#b5300f', hat: '#4a2385', hatDark: '#2f1458', band: '#ff8d1f', gold: '#ffd24a',
  boot: '#2b1d36', sole: '#160f1d', stripeA: '#ff8d1f', stripeB: '#2a1838', pail: '#ff7a14', bow: '#5ee06c',
  eye: '#120818', blush: '#ff8f9a', mouth: '#7d1f37', tongue: '#ff7b8a', bloomers: '#3a1d55', star: '#ffd84a',
};

// ------------------------------------------------------------------ segment tagging
const _c = new THREE.Color();
/** Tag a part: indexed, no uv, vertex colour, glow, 100 % on `bone` (or blended with `bone2` by w(x, y, z)). */
function seg(g, bone, color, glow = 0, bone2 = null, w = null) {
  if (g.index === null) { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
  for (const a of ['uv', 'uv1']) if (g.attributes[a]) g.deleteAttribute(a);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.clearGroups();
  const n = g.attributes.position.count, P = g.attributes.position.array;
  const c = new Float32Array(n * 3), gl = new Float32Array(n), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const b = BONE_INDEX[bone], b2 = bone2 ? BONE_INDEX[bone2] : 0;
  const col = Array.isArray(color) ? null : _c.set(color).clone();
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (col) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } else { const k = color[0](x, y, z, _c); c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
    gl[i] = typeof glow === 'function' ? glow(x, y, z) : glow;
    const ww = bone2 ? w(x, y, z) : 0;
    si[i * 4] = b; sw[i * 4] = 1 - ww; si[i * 4 + 1] = b2; sw[i * 4 + 1] = ww;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('glow', new THREE.BufferAttribute(gl, 1));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}
/** Multiply a tagged part's colours by f(x, y, z) (a soft painted gradient). */
function grade(g, f) {
  const P = g.attributes.position.array, C = g.attributes.color.array;
  for (let i = 0; i < P.length; i += 3) { const k = f(P[i], P[i + 1], P[i + 2]); C[i] *= k; C[i + 1] *= k; C[i + 2] *= k; }
  return g;
}
const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
const cyl = (r0, r1, h, x, y, z, s = 12, open = false) => new THREE.CylinderGeometry(r0, r1, h, s, 1, open).translate(x, y, z);

// ------------------------------------------------------------------ the head: an ellipsoid with the face projected on it
const HEAD = { cx: 0, cy: 1.148, cz: 0.004, rx: 0.172, ry: 0.162, rz: 0.158 };
/** A point on the head's front (x, y in the face plane) pushed `lift` m out along the surface normal: [p, n]. */
function onHead(x, y, lift = 0.0018) {
  const H = HEAD, u = (x - H.cx) / H.rx, v = (y - H.cy) / H.ry, w = Math.sqrt(Math.max(0.02, 1 - u * u - v * v));
  const z = H.cz + H.rz * w;
  const n = new THREE.Vector3(u / H.rx, v / H.ry, w / H.rz).normalize();
  return [new THREE.Vector3(x, y, z).addScaledVector(n, lift), n];
}
/** A flat 2D shape (THREE.Shape, face-plane coordinates) laid onto the face (normals of the head). */
function faceDecal(shape, lift = 0.0018, segs = 10) {
  const g = new THREE.ShapeGeometry(shape, segs);
  const P = g.attributes.position, N = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const [p, n] = onHead(P.getX(i), P.getY(i), lift);
    P.setXYZ(i, p.x, p.y, p.z); N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}
const ellipse = (x, y, rx, ry, rot = 0) => { const s = new THREE.Shape(); s.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, rot); return s; };

function faceParts(P) {
  const C = KID_COLORS, H = HEAD;
  const head = new THREE.SphereGeometry(1, 22, 16).scale(H.rx, H.ry, H.rz).translate(H.cx, H.cy, H.cz);
  P.push(grade(seg(head, 'head', C.skin), (x, y) => 0.86 + 0.18 * smooth((y - 1.0) / 0.25)));
  for (const s of [1, -1]) {
    const ex = s * 0.064, ey = 1.142;
    // big glossy eyes: a dark oval, a big catchlight up and out, a small one down and in (the catchlights glow)
    P.push(seg(faceDecal(ellipse(ex, ey, 0.026, 0.036, s * 0.08), 0.002), 'head', C.eye, 0.05));
    P.push(seg(faceDecal(ellipse(ex + s * 0.009, ey + 0.013, 0.0095, 0.011), 0.0034), 'head', '#ffffff', 0.9));
    P.push(seg(faceDecal(ellipse(ex - s * 0.008, ey - 0.014, 0.0045, 0.0045), 0.0034), 'head', '#ffffff', 0.7));
    // a lash flick at the outer corner
    const lash = new THREE.Shape(); lash.moveTo(ex + s * 0.02, ey + 0.026); lash.lineTo(ex + s * 0.042, ey + 0.036); lash.lineTo(ex + s * 0.026, ey + 0.016); lash.closePath();
    P.push(seg(faceDecal(lash, 0.0022), 'head', C.eye));
    // blush + freckles
    P.push(seg(faceDecal(ellipse(s * 0.104, 1.098, 0.026, 0.015), 0.0016), 'head', C.blush, 0.12));
    for (const [fx, fy] of [[0.086, 1.112], [0.1, 1.118], [0.094, 1.124]]) P.push(seg(faceDecal(ellipse(s * fx, fy, 0.0032, 0.003), 0.0024), 'head', '#d9733f'));
  }
  // a little open smile with a tongue
  const m = new THREE.Shape();
  m.moveTo(-0.03, 1.088); m.quadraticCurveTo(0, 1.082, 0.03, 1.088); m.quadraticCurveTo(0.026, 1.058, 0, 1.054); m.quadraticCurveTo(-0.026, 1.058, -0.03, 1.088);
  P.push(seg(faceDecal(m, 0.002), 'head', C.mouth));
  const t = new THREE.Shape(); t.moveTo(-0.016, 1.062); t.quadraticCurveTo(0, 1.074, 0.016, 1.062); t.quadraticCurveTo(0, 1.052, -0.016, 1.062);
  P.push(seg(faceDecal(t, 0.0028), 'head', C.tongue, 0.1));
  // a button nose
  { const [p, n] = onHead(0, 1.112, -0.004); P.push(seg(ball(0.016, p.x, p.y, p.z + 0.004, 1.15, 0.9, 0.8, 10, 8), 'head', '#f2b18f')); void n; }
  // ears peeking out under the hair
  for (const s of [1, -1]) P.push(seg(ball(0.03, s * 0.168, 1.118, -0.005, 0.55, 1, 0.9, 10, 8), 'head', '#f1bf9d'));
}

function hairParts(P) {
  const C = KID_COLORS, H = HEAD;
  // the cap: the head ellipsoid grown 1.5 cm; under the hairline (the face) it sinks inside the head
  const cap = new THREE.SphereGeometry(1, 24, 14), p = cap.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const face = z > 0.05 && y < 0.36 - 0.3 * Math.abs(x) && !(Math.abs(x) > 0.86 && y > -0.3);
    const lobe = Math.abs(Math.sin(Math.atan2(x, z) * 5.5));
    const k = face ? 0.9 : 1.08 + 0.045 * lobe * smooth((0.45 - y) / 0.9) + 0.01 * lobe;
    p.setXYZ(i, H.cx + x * H.rx * k, H.cy + y * H.ry * k + (face ? 0 : 0.004), H.cz + z * H.rz * k - (face ? 0 : 0.008));
  }
  cap.computeVertexNormals();
  P.push(grade(seg(cap, 'head', C.hair), (x, y, z) => (0.8 + 0.32 * smooth((y - 1.02) / 0.28)) * (0.86 + 0.16 * Math.abs(Math.sin(Math.atan2(x, z - H.cz) * 5.5)))));
  // bangs: flattened tapered locks over the forehead, curling to points
  const locks = [[-0.112, 1.205, -0.035, 0.034], [-0.05, 1.19, -0.012, 0.042], [0.018, 1.188, 0.014, 0.044], [0.082, 1.196, 0.03, 0.04], [0.128, 1.21, 0.02, 0.03]];
  for (const [x0, yEnd, bend, r0] of locks) {
    const [a] = onHead(x0 - bend * 0.4, 1.285, 0.004), [b] = onHead(x0, 1.245, 0.016), [c] = onHead(x0 + bend, yEnd, 0.008);
    P.push(grade(seg(sweep(curve([[a.x, a.y, a.z], [b.x, b.y, b.z], [c.x, c.y, c.z]], 8), (t) => r0 * (1 - t) ** 0.7 * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.8))) + 0.002, 8, { flat: 0.5, caps: [false, 0.008] }), 'head', C.hair), (x, y) => 0.9 + 0.25 * smooth((y - 1.19) / 0.08)));
  }
  // side locks in front of the ears
  for (const s of [1, -1]) {
    P.push(seg(sweep(curve([[s * 0.15, 1.2, 0.05], [s * 0.168, 1.13, 0.06], [s * 0.158, 1.06, 0.055]], 6), (t) => 0.024 * (1 - 0.75 * t), 6, { flat: 0.6 }), 'head', C.hair));
  }
  // braids: out and down from behind the ears (they stick out: a silhouette from behind), a green bow, a tuft
  for (const s of [1, -1]) {
    const dir = new THREE.Vector3(s * 0.8, -0.5, -0.3).normalize(), o = new THREE.Vector3(s * 0.15, 1.1, -0.06);
    for (let k = 0; k < 4; k++) {
      const r = 0.036 - k * 0.004, c = o.clone().addScaledVector(dir, 0.035 + k * 0.05);
      c.y += (k % 2 ? 0.006 : -0.006);
      P.push(grade(seg(ball(r, c.x, c.y, c.z, 1.05, 0.9, 1.05, 10, 8), 'head', k % 2 ? C.hair : C.hairDark), () => 1));
    }
    const e = o.clone().addScaledVector(dir, 0.22);
    // the bow: two flattened cones (loops) and a knot
    for (const t of [1, -1]) {
      const g = new THREE.ConeGeometry(0.028, 0.05, 8).rotateZ(t * Math.PI / 2).scale(1, 1, 0.45).translate(t * 0.024, 0, 0);
      g.rotateY(Math.atan2(dir.x, dir.z) + Math.PI / 2).translate(e.x, e.y + 0.004, e.z);
      P.push(seg(g, 'head', C.bow, 0.12));
    }
    P.push(seg(ball(0.014, e.x, e.y + 0.004, e.z), 'head', '#3fc252', 0.1));
    const tuft = e.clone().addScaledVector(dir, 0.045);
    const tg = new THREE.ConeGeometry(0.026, 0.07, 8).translate(0, -0.035, 0);
    tg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)).translate(tuft.x, tuft.y, tuft.z);
    P.push(seg(tg, 'head', C.hair));
  }
}

/** Witch hat: a floppy wavy brim, a buckled band, a crown that bends back and droops (its tip on the hatTip bone). */
function hatParts(P) {
  const C = KID_COLORS, y0 = HAT_Y, TILT = -0.16; // tipped back a little: the face shows under the brim
  const tilt = (g) => g.translate(0, -(y0 - 0.02), 0).rotateX(TILT).rotateZ(0.07).translate(0.004, y0 - 0.02, -0.006); // about the crown
  // brim: a lathe of the brim's cross-section, waves around the rim, drooping at the front and the back
  const brimDy = (th, r) => smooth((r - 0.17) / 0.13) * (-0.03 * Math.cos(th * 2) + 0.012 * Math.sin(th * 5));
  const BP = [[0.152, y0 - 0.004], [0.24, y0 - 0.001], [0.305, y0 + 0.022], [0.31, y0 + 0.036], [0.3, y0 + 0.028], [0.24, y0 + 0.012], [0.152, y0 + 0.016]];
  const brim = lathe(BP, 40, {
    mod: (th) => 1 + 0.035 * Math.sin(th * 3 + 0.8) + 0.02 * Math.sin(th * 7),
    dy: (th, t) => brimDy(th, BP[Math.round(t * (BP.length - 1))][0]),
  });
  P.push(grade(seg(tilt(brim), 'head', C.hat), (x, y) => 0.85 + 0.25 * smooth((y - y0) / 0.05)));
  // the crown: a tapered tube up, bending back, the tip drooping down; wrinkle rings where it bends
  const spine = curve([[0, y0, 0], [0, y0 + 0.14, -0.005], [0, y0 + 0.25, -0.02], [0.012, y0 + 0.33, -0.06], [0.028, y0 + 0.385, -0.12], [0.04, y0 + 0.39, -0.18], [0.05, y0 + 0.355, -0.225]], 18);
  const rad = (t) => 0.152 * Math.pow(1 - t, 0.85) * (1 + 0.06 * Math.exp(-((t - 0.42) ** 2) / 0.002) + 0.05 * Math.exp(-((t - 0.62) ** 2) / 0.002)) + 0.004;
  const crown = sweep(spine, rad, 16, { caps: [false, 0.012] });
  const tipW = (x, y, z) => smooth((y - (y0 + 0.24)) / 0.08 + Math.max(0, -z - 0.08) * 8);
  P.push(grade(seg(tilt(crown), 'head', C.hat, 0, 'hatTip', tipW), (x, y) => 0.88 + 0.3 * smooth((y - y0) / 0.4)));
  // band + a gold buckle (front), a star charm hanging off the band's side
  const band = cyl(0.153, 0.147, 0.05, 0, y0 + 0.03, 0, 24, true);
  P.push(seg(tilt(band), 'head', C.band, 0.1));
  const bk = new THREE.TorusGeometry(0.022, 0.006, 4, 4).rotateZ(Math.PI / 4).scale(1.1, 1, 1).translate(0, y0 + 0.03, 0.152);
  P.push(seg(tilt(bk), 'head', C.gold, 0.15));
  const st = star(0.026, 0.008).translate(0, 0, -0.004).rotateY(0.5).rotateZ(0.3).translate(0.13, y0 + 0.006, 0.09);
  P.push(seg(tilt(st), 'head', C.star, 0.35));
}

function bodyParts(P) {
  const C = KID_COLORS;
  // neck
  P.push(seg(cyl(0.046, 0.054, 0.07, 0, 0.98, 0, 12), 'neck', '#c98f73'));
  // torso: a lathe from the shoulders to the waist (scaled flat front to back), two buttons, a wide zigzag collar
  const torso = lathe([[0.1, 0.7], [0.106, 0.74], [0.118, 0.82], [0.12, 0.885], [0.1, 0.93], [0.05, 0.955]], 18).scale(1, 1, 0.8);
  P.push(grade(seg(torso, 'chest', C.robe), (x, y) => 0.85 + 0.2 * smooth((y - 0.7) / 0.25)));
  for (const y of [0.86, 0.79]) P.push(seg(ball(0.012, 0, y, 0.096, 1, 1, 0.6, 8, 6), 'chest', C.gold, 0.15));
  const collar = lathe([[0.15, 0.925], [0.105, 0.962], [0.052, 0.978]], 24, {
    dy: (th, t) => (t < 0.4 ? -0.025 * Math.abs(Math.sin(th * 4)) : 0),
  }).scale(1, 1, 0.85);
  P.push(seg(collar, 'chest', C.trim, 0.06));
  const collarB = lathe([[0.052, 0.972], [0.105, 0.955], [0.15, 0.921]], 24, { dy: (th, t) => (t > 0.6 ? -0.025 * Math.abs(Math.sin(th * 4)) : 0) }).scale(1, 1, 0.85);
  P.push(seg(collarB, 'chest', '#c96413'));
  // belt + buckle
  P.push(seg(cyl(0.106, 0.104, 0.036, 0, 0.705, 0, 20).scale(1, 1, 0.82), 'spine', C.trim, 0.05));
  P.push(seg(new THREE.TorusGeometry(0.019, 0.006, 4, 4).rotateZ(Math.PI / 4).translate(0, 0.705, 0.087), 'spine', C.gold, 0.15));
  // the skirt: a bell with soft folds, a zigzag hem, a dark hem band
  const HEM = 9;
  const hem = (th, t) => (t < 0.2 ? -0.03 * (0.5 + 0.5 * Math.cos(th * HEM)) * (0.2 - t) / 0.2 : 0);
  const fold = (th, t) => 1 + 0.06 * (1 - t) * (1 - t) * Math.cos(th * HEM);
  const skirt = lathe([[0.238, 0.4], [0.232, 0.42], [0.2, 0.49], [0.155, 0.58], [0.12, 0.66], [0.104, 0.705]], 36, { mod: fold, dy: hem }).scale(1, 1, 0.88);
  P.push(grade(seg(skirt, 'hips', C.robe), (x, y) => 0.72 + 0.4 * smooth((y - 0.4) / 0.3)));
  const band = lathe([[0.24, 0.401], [0.233, 0.43]], 36, { mod: (th) => fold(th, 0) * 1.01, dy: (th) => hem(th, 0) }).scale(1, 1, 0.88);
  P.push(seg(band, 'hips', C.trim, 0.06));
  const under = lathe([[0.1, 0.5], [0.18, 0.43], [0.236, 0.399]], 36, { mod: (th, t) => (t > 0.5 ? fold(th, 0) : 1), dy: (th, t) => (t > 0.5 ? hem(th, 0) : 0) }).scale(1, 1, 0.88);
  P.push(seg(under, 'hips', C.robeDark));
  // bloomers under the skirt (the legs' tops)
  for (const s of [1, -1]) P.push(seg(ball(0.07, s * 0.07, 0.5, 0, 1, 1.25, 1, 12, 8), `upperLeg${s > 0 ? 'L' : 'R'}`, C.bloomers));
}

function limbParts(P) {
  const C = KID_COLORS;
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', x = s * 0.15;
    // puffed shoulder, sleeve, a trumpet cuff with a zigzag edge, a mitten hand with a thumb
    P.push(grade(seg(ball(0.058, s * 0.14, 0.905, 0, 1, 0.95, 1, 14, 10), `upperArm${L}`, C.robe), (xx, y) => 0.85 + 0.25 * smooth((y - 0.86) / 0.08)));
    P.push(seg(cyl(0.04, 0.036, 0.13, x, 0.83, 0, 10), `upperArm${L}`, C.robe));
    const cuff = lathe([[0.066, 0.665], [0.046, 0.72], [0.034, 0.77]], 18, { dy: (th, t) => (t < 0.4 ? -0.018 * Math.abs(Math.sin(th * 3)) : 0) }).translate(x, 0, 0);
    P.push(grade(seg(cuff, `lowerArm${L}`, C.robe), (xx, y) => 0.8 + 0.25 * smooth((y - 0.66) / 0.1)));
    const cuffIn = lathe([[0.033, 0.765], [0.045, 0.716], [0.065, 0.662]], 18, { dy: (th, t) => (t > 0.6 ? -0.018 * Math.abs(Math.sin(th * 3)) : 0) }).translate(x, 0, 0);
    P.push(seg(cuffIn, `lowerArm${L}`, C.robeDark));
    const trim = lathe([[0.068, 0.662], [0.066, 0.672]], 18, { dy: (th) => -0.018 * Math.abs(Math.sin(th * 3)) }).translate(x, 0, 0);
    P.push(seg(trim, `lowerArm${L}`, C.trim, 0.05));
    P.push(seg(cyl(0.022, 0.024, 0.06, x, 0.65, 0, 8), `lowerArm${L}`, C.skin));
    P.push(seg(ball(0.036, x, 0.605, 0.004, 0.95, 1.1, 0.85, 12, 9), `lowerArm${L}`, C.skin));
    P.push(seg(ball(0.014, x - s * 0.0, 0.62, 0.03, 1, 1.3, 1, 8, 6), `lowerArm${L}`, C.skin));
    // striped stockings (six bands, a calf bulge), knees
    const lx = s * 0.072;
    for (let k = 0; k < 6; k++) {
      const y1 = 0.36 - k * 0.046, y0 = y1 - 0.046, r = (y) => 0.034 + 0.008 * Math.exp(-((y - 0.23) ** 2) / 0.006);
      P.push(seg(cyl(r(y1), r(y0), 0.046, lx, (y0 + y1) / 2, 0, 12, true), `lowerLeg${L}`, k & 1 ? C.stripeB : C.stripeA, k & 1 ? 0 : 0.05));
    }
    P.push(seg(cyl(0.04, 0.042, 0.1, lx, 0.41, 0, 12), `upperLeg${L}`, C.stripeA, 0.05));
    P.push(seg(ball(0.041, lx, 0.36, 0.004, 1, 0.8, 1, 12, 8), `lowerLeg${L}`, C.stripeB));
    // boots: a rounded shoe with a long toe that curls up to a point, a folded cuff, a buckle, a dark sole
    const toe = curve([[lx, 0.05, -0.04], [lx, 0.045, 0.03], [lx, 0.05, 0.1], [lx, 0.085, 0.15], [lx, 0.12, 0.14]], 12);
    P.push(grade(seg(sweep(toe, (t) => 0.05 * (1 - t) ** 0.9 * (t < 0.15 ? 0.75 + t * 1.6 : 1) + 0.004, 10, { flat: 0.8, caps: [true, 0.006] }), `foot${L}`, C.boot), (xx, y) => 0.85 + 0.6 * smooth((y - 0.03) / 0.1)));
    P.push(seg(cyl(0.05, 0.052, 0.012, lx, 0.008, 0.02, 14).scale(1, 1, 1.5).translate(0, 0, -0.01), `foot${L}`, C.sole));
    P.push(seg(cyl(0.04, 0.044, 0.07, lx, 0.1, -0.005, 12), `foot${L}`, C.boot));
    P.push(seg(lathe([[0.05, 0.1], [0.052, 0.128], [0.04, 0.135]], 14, { dy: (th, t) => (t < 0.4 ? -0.012 * Math.abs(Math.sin(th * 2.5)) : 0) }).translate(lx, 0, -0.005), `foot${L}`, '#3d2a4d'));
    P.push(seg(new THREE.BoxGeometry(0.03, 0.022, 0.008).translate(lx, 0.06, 0.06), `foot${L}`, C.gold, 0.12));
  }
}

/** The cape: a pleated sheet behind the shoulders to the knees (cape bone), a pointed hem, crimson lining, stars. */
function capeParts(P) {
  const C = KID_COLORS, PL = 7, phi0 = Math.PI * 0.6, phiLen = Math.PI * 0.8;
  const pleat = (th, t) => 1 + 0.12 * (1 - t) * Math.cos((th - phi0) / phiLen * Math.PI * 2 * PL);
  const hem = (th, t) => (t < 0.15 ? -0.05 * (0.15 - t) / 0.15 * (0.5 + 0.5 * Math.cos((th - phi0) / phiLen * Math.PI * 2 * PL)) : 0);
  const prof = [[0.305, 0.4], [0.29, 0.47], [0.25, 0.6], [0.2, 0.74], [0.15, 0.86], [0.115, 0.935]];
  const out = lathe(prof, 42, { mod: pleat, dy: hem, phi0, phiLen }).scale(1, 1, 0.78).translate(0, 0, -0.02);
  P.push(grade(seg(out, 'cape', C.cape), (x, y) => 0.72 + 0.42 * smooth((y - 0.4) / 0.5)));
  const lin = lathe(prof.map(([r, y]) => [r - 0.008, y]), 42, { mod: pleat, dy: hem, phi0, phiLen, flip: true }).scale(1, 1, 0.78).translate(0, 0, -0.02);
  P.push(grade(seg(lin, 'cape', C.capeIn), (x, y) => 0.75 + 0.3 * smooth((y - 0.4) / 0.5)));
  // a little standing collar (lining colour) and the clasp
  const col = lathe([[0.112, 0.93], [0.135, 0.985]], 20, { phi0: Math.PI * 0.45, phiLen: Math.PI * 1.1 }).scale(1, 1, 0.8).translate(0, 0, -0.015);
  P.push(seg(col, 'cape', C.capeIn));
  const colB = lathe([[0.135, 0.985], [0.112, 0.93]], 20, { phi0: Math.PI * 0.45, phiLen: Math.PI * 1.1 }).scale(1, 1, 0.8).translate(0, 0, -0.012);
  P.push(seg(colB, 'cape', '#5a2347'));
  // stars on the back (they glow a little: the kid's back reads as a witch from far away)
  for (const [y, a, r, sp] of [[0.76, 0.18, 0.05, 0.3], [0.58, -0.32, 0.04, -0.4], [0.5, 0.4, 0.03, 0.1]]) {
    const th = Math.PI + a, rr = (0.115 + (0.305 - 0.115) * ((0.935 - y) / 0.535)) * pleat(th, 1 - (0.935 - y) / 0.535) + 0.004;
    const g = star(r, 0.006).rotateZ(sp).translate(0, 0, 0.012);
    g.rotateY(th + 0).translate(Math.sin(th) * rr, y, Math.cos(th) * rr * 0.78 - 0.02);
    P.push(seg(g, 'cape', C.star, 0.8));
  }
}

/** The pail: a ribbed pumpkin bucket on the right hand (its centre below the hand), a carved glowing face (+Z), candy. */
const PAIL_C = [-0.155, 0.46, 0.035], PAIL_R = 0.1;
function pailParts(P) {
  const C = KID_COLORS, [cx, cy, cz] = PAIL_C, R = PAIL_R, B = 'handR';
  const ribs = (th) => 1 - 0.07 * Math.pow(Math.abs(Math.sin(th * 4)), 0.8);
  const prof = [[0, -0.86], [0.55, -0.8], [0.88, -0.5], [1, -0.05], [0.94, 0.4], [0.8, 0.62], [0.74, 0.66]].map(([r, y]) => [r * R, y * R]);
  const body = lathe(prof, 32, { mod: ribs }).translate(cx, cy, cz);
  P.push(grade(seg(body, B, C.pail, 0.04), (x, y) => 0.6 + 0.5 * smooth((y - (cy - R)) / (1.6 * R))));
  // the rim (a rolled lip) and the dark inside, candy peeking out
  P.push(seg(new THREE.TorusGeometry(0.074, 0.009, 6, 24).rotateX(Math.PI / 2).translate(cx, cy + 0.066, cz), B, '#e8620f', 0.1));
  P.push(seg(new THREE.CircleGeometry(0.072, 20).rotateX(-Math.PI / 2).translate(cx, cy + 0.05, cz), B, '#2a1208', 0.2));
  const candy = [[-0.03, 0.02, '#ff3355', 0.022], [0.025, -0.02, '#7a4dff', 0.02], [0.01, 0.03, '#3dff7a', 0.018], [-0.02, -0.03, '#ffd24a', 0.018]];
  for (const [dx, dz, col, r] of candy) P.push(seg(ball(r, cx + dx, cy + 0.06, cz + dz, 1.4, 0.8, 0.9, 8, 6), B, col, 0.6));
  // a lollipop sticking out of the pail
  P.push(seg(cyl(0.005, 0.005, 0.1, cx + 0.03, cy + 0.1, cz - 0.02, 5), B, '#f2ead8'));
  P.push(seg(cyl(0.03, 0.03, 0.012, cx + 0.03, cy + 0.155, cz - 0.02, 14).rotateX(Math.PI / 2).translate(0, 0, 0), B, '#ff4fa8', 0.5));
  P.push(seg(new THREE.TorusGeometry(0.018, 0.004, 4, 14).translate(cx + 0.03, cy + 0.155, cz - 0.0132), B, '#ffffff', 0.6));
  // the stem nub and the handle (an arc from rim to rim, through the hand)
  const hy = cy + 0.066;
  P.push(seg(sweep(curve([[cx - 0.074, hy, cz], [cx - 0.062, hy + 0.055, cz], [cx, hy + 0.08, cz - 0.005], [cx + 0.062, hy + 0.055, cz], [cx + 0.074, hy, cz]], 14), 0.0055, 5, { caps: [false, false] }), B, '#2a1a14'));
  // the carved face: triangle eyes, a nose, a toothy grin, laid on the bucket's front, unlit-bright (glow)
  const tris = [];
  const T = (a, b, c) => tris.push(a, b, c);
  for (const s of [-1, 1]) T([s * 0.016, 0.006], [s * 0.05, 0.004], [s * 0.034, 0.034]);
  T([-0.01, -0.006], [0.01, -0.006], [0, 0.01]);
  const M = 8;
  for (let i = 0; i < M; i++) {
    const a0 = -0.95 + (i / M) * 1.9, a1 = -0.95 + ((i + 1) / M) * 1.9;
    const o0 = [Math.sin(a0) * 0.058, -0.016 - Math.cos(a0) * 0.03], o1 = [Math.sin(a1) * 0.058, -0.016 - Math.cos(a1) * 0.03];
    const tooth = i === 2 || i === 5 ? 0.011 : 0;
    const i0 = [Math.sin(a0) * 0.05, -0.022 - Math.cos(a0) * 0.012 - tooth], i1 = [Math.sin(a1) * 0.05, -0.022 - Math.cos(a1) * 0.012 - tooth];
    T(o0, i0, o1); T(i0, i1, o1);
  }
  const v = [], nn = [];
  for (const [x, y] of tris) {
    const r2 = (x * x + y * y) / (R * R), z = Math.sqrt(Math.max(0.02, 1 - r2)) * R * 0.94 + 0.003;
    v.push(cx + x, cy + y, cz + z);
    const n = new THREE.Vector3(x, y, z).normalize(); nn.push(n.x, n.y, n.z);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  fg.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
  P.push(seg(fg, B, '#ffb347', 4.5));
}

function bodyGeometry() {
  const P = [];
  faceParts(P); hairParts(P); hatParts(P); bodyParts(P); limbParts(P); capeParts(P); pailParts(P);
  for (const g of P) { if (g.attributes.normal === undefined) g.computeVertexNormals(); }
  const g = mergeGeometries(P);
  for (const p of P) p.dispose();
  return g;
}

// ------------------------------------------------------------------ the kid's clips (sampled pose functions)
const _e = new THREE.Euler(), _qq = new THREE.Quaternion();
const newPose = () => { const Q = { hipsPos: [0, 0, 0] }; for (const b of BONES) Q[b] = [0, 0, 0]; return Q; };
const set = (r, x, y, z) => { r[0] = x; r[1] = y; r[2] = z; };
const pos = (v) => Math.max(0, v);
/** A clip from key times and fill(i, pose) (Euler XYZ per bone + a hips position offset). */
function buildClip(name, times, fill) {
  const n = times.length, Q = newPose();
  const rot = Object.fromEntries(BONES.map((b) => [b, new Float32Array(n * 4)]));
  const hp = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (const b of BONES) Q[b].fill(0);
    Q.hipsPos.fill(0); fill(i, Q);
    for (const b of BONES) { const r = Q[b]; _qq.setFromEuler(_e.set(r[0], r[1], r[2], 'XYZ')).toArray(rot[b], i * 4); }
    hp[i * 3] = Q.hipsPos[0]; hp[i * 3 + 1] = HIPS_Y + Q.hipsPos[1]; hp[i * 3 + 2] = Q.hipsPos[2];
  }
  const t = Float32Array.from(times);
  const tracks = BONES.map((b) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, t, rot[b]));
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', t, hp));
  return new THREE.AnimationClip(name, times[n - 1], tracks);
}
function cycleClip(name, duration, n, pose) {
  const times = [];
  for (let i = 0; i <= n; i++) times.push((i / n) * duration);
  return buildClip(name, times, (i, Q) => pose(((i % n) / n) * Math.PI * 2, Q));
}

// conventions: -X swings a hanging limb forward, +X bends a knee, -X bends an elbow forward, +X leans the spine
// forward, -X tips the head up; +Z on the left arm lifts it out to the side (the right arm: -Z)
function idlePose(w, Q) {
  const sw = Math.sin(w), s2 = Math.sin(2 * w);
  set(Q.hipsPos, 0.01 * sw, -0.006 + 0.005 * s2, 0);
  set(Q.hips, 0, 0.05 * sw, 0.03 * sw);
  set(Q.spine, 0.03, -0.03 * sw, -0.02 * sw);
  set(Q.chest, -0.03 - 0.02 * s2, 0, -0.01 * sw);                                     // breathing
  set(Q.head, -0.03 + 0.03 * s2, 0.18 * Math.sin(w + 0.7), 0.1 * Math.sin(w + 1.6)); // looking around, a tilt
  // the left arm relaxed, a little swing; the right one holds the pail out a touch in front
  set(Q.upperArmL, -0.05 + 0.04 * sw, 0, 0.16 + 0.03 * s2);
  set(Q.lowerArmL, -0.25, 0, 0);
  set(Q.upperArmR, -0.28 + 0.03 * s2, 0, -0.14);
  set(Q.lowerArmR, -0.35, 0, 0);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    set(Q[`upperLeg${L}`], -0.03, 0, -s * 0.03 * sw + s * 0.04);
    set(Q[`lowerLeg${L}`], 0.06 + 0.04 * pos(s * sw), 0, 0);
    set(Q[`foot${L}`], -0.03, 0, -s * 0.04);
  }
}

// a kid's gait: quick short strides, knees high, a bounce, the free arm pumping, the pail arm swinging less
const WALK = { thigh: 0.5, thighBias: 0.05, kneeBase: 0.08, knee: 0.75, kneeShift: 0.4, footComp: 0.8, toe: 0.3, armL: 0.5, armR: 0.28, armBias: 0.05, abduct: 0.12,
  elbowL: 0.35, elbowR: 0.4, lean: 0.05, lean2: 0.02, pelvisYaw: 0.1, chestYaw: 0.12, bob: 0.025, bobBase: -0.02, bobSign: 1, sway: 0.02, headBob: 0.04 };
const RUN = { thigh: 0.72, thighBias: 0.3, kneeBase: 0.4, knee: 1.55, kneeShift: 0.5, footComp: 0.55, toe: 0.55, armL: 0.95, armR: 0.45, armBias: 0.2, abduct: 0.2,
  elbowL: 1.35, elbowR: 0.75, lean: 0.2, lean2: 0.06, pelvisYaw: 0.14, chestYaw: 0.24, bob: 0.045, bobBase: 0.012, bobSign: -1, sway: 0.012, headBob: 0.07 };
function gaitPose(w, Q, g) {
  const sw = Math.sin(w), c2 = Math.cos(2 * w);
  set(Q.hipsPos, -g.sway * Math.cos(w), g.bobBase + g.bobSign * g.bob * c2, 0);
  set(Q.hips, 0, -g.pelvisYaw * sw, 0.03 * Math.cos(w));
  set(Q.spine, g.lean, 0, 0);
  set(Q.chest, g.lean2 + 0.03 * c2 * g.bobSign, (g.chestYaw - g.pelvisYaw * 0.4) * sw, 0);
  set(Q.head, -(g.lean + g.lean2) * 0.85 + g.headBob * c2 * g.bobSign * 0.5, -(g.chestYaw - g.pelvisYaw) * sw * 0.8, 0.04 * sw);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', ph = s > 0 ? w : w + Math.PI, sp = Math.sin(ph);
    const th = g.thighBias + g.thigh * sp;
    const kn = g.kneeBase + g.knee * pos(Math.cos(ph + g.kneeShift)) ** 2;
    const toe = g.toe * pos(-Math.sin(ph - 0.2)) ** 3;
    set(Q[`upperLeg${L}`], -th, 0, 0);
    set(Q[`lowerLeg${L}`], kn, 0, 0);
    set(Q[`foot${L}`], g.footComp * (th - kn) + toe, 0, 0);
  }
  // arms opposed to the same-side leg (the left arm swings with the right leg)
  const aL = g.armBias - g.armL * Math.sin(w), aR = g.armBias * 0.6 - g.armR * Math.sin(w + Math.PI);
  set(Q.upperArmL, -aL, 0, g.abduct);
  set(Q.lowerArmL, -(g.elbowL + 0.25 * pos(Math.sin(w))), 0, 0);
  set(Q.upperArmR, -aR - 0.1, 0, -g.abduct - 0.04);
  set(Q.lowerArmR, -(g.elbowR + 0.15 * pos(-Math.sin(w))), 0, 0);
}

// jump: crouch (anticipation) -> launch (stretched, arms up) -> tuck (knees up, arms out) -> open, reaching for the
// ground (held until the kid lands: the clip is clamped; landPose adds the landing absorb)
const JUMP_TIMES = [0, 0.1, 0.24, 0.5, 0.78, 1.0];
const JUMP_KEYS = [
  { thigh: 0.85, knee: 1.45, foot: -0.55, spine: 0.4, chest: 0.08, armL: -0.6, armR: -0.4, elbow: 0.3, abduct: 0.15, y: -0.14, head: -0.28 },
  { thigh: -0.08, knee: 0.04, foot: 0.65, spine: -0.08, chest: -0.08, armL: 2.6, armR: 1.4, elbow: 0.15, abduct: 0.25, y: 0.01, head: -0.2 },
  { thigh: 0.6, knee: 1.2, foot: 0.25, spine: 0.05, chest: -0.04, armL: 1.9, armR: 1.0, elbow: 0.4, abduct: 0.7, y: 0.02, head: -0.16 },
  { thigh: 1.25, knee: 1.9, foot: -0.2, spine: 0.18, chest: 0.06, armL: 0.9, armR: 0.6, elbow: 0.9, abduct: 1.0, y: 0.03, head: -0.1 },
  { thigh: 0.55, knee: 0.55, foot: -0.15, spine: 0.06, chest: 0, armL: 0.7, armR: 0.45, elbow: 0.5, abduct: 0.85, y: 0, head: -0.18 },
  { thigh: 0.42, knee: 0.4, foot: -0.12, spine: 0.04, chest: 0, armL: 0.6, armR: 0.4, elbow: 0.45, abduct: 0.7, y: 0, head: -0.15 },
];
function jumpPose(i, Q) {
  const k = JUMP_KEYS[i];
  set(Q.hipsPos, 0, k.y, 0);
  set(Q.spine, k.spine, 0, 0);
  set(Q.chest, k.chest, 0, 0);
  set(Q.head, k.head, 0, 0);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', a = s > 0 ? 1 : 0.88;
    set(Q[`upperLeg${L}`], -k.thigh * a, 0, s * 0.06);
    set(Q[`lowerLeg${L}`], k.knee * a, 0, 0);
    set(Q[`foot${L}`], k.foot, 0, 0);
  }
  set(Q.upperArmL, -k.armL, 0, k.abduct);
  set(Q.lowerArmL, -k.elbow, 0, 0);
  set(Q.upperArmR, -k.armR, 0, -k.abduct * 0.6);
  set(Q.lowerArmR, -k.elbow * 0.8, 0, 0);
}

/** The kid's clips: Idle 3.4 s, Walking 0.72 s and Running 0.5 s loops (quick short strides), Jump 1.0 s one-shot. */
export function kidClips() {
  return [
    cycleClip('Idle', 3.4, 18, idlePose),
    cycleClip('Walking', 0.72, 20, (w, Q) => gaitPose(w, Q, WALK)),
    cycleClip('Running', 0.5, 16, (w, Q) => gaitPose(w, Q, RUN)),
    buildClip('Jump', JUMP_TIMES, jumpPose),
  ];
}

const _ax = new THREE.Vector3(1, 0, 0), _az = new THREE.Vector3(0, 0, 1), _lq = new THREE.Quaternion();
/** After the clips: bend the kid into a landing absorb (k 0..1): hips down, knees bent, spine forward, arms out. */
export function landPose(kid, k) {
  if (!(k > 0.002)) return;
  const B = kid.bones;
  B.hips.position.y -= 0.075 * k;
  const rx = (b, a) => b.quaternion.multiply(_lq.setFromAxisAngle(_ax, a));
  const rz = (b, a) => b.quaternion.multiply(_lq.setFromAxisAngle(_az, a));
  rx(B.spine, 0.28 * k); rx(B.head, -0.2 * k);
  for (const L of ['L', 'R']) { rx(B[`upperLeg${L}`], -0.75 * k); rx(B[`lowerLeg${L}`], 1.25 * k); rx(B[`foot${L}`], -0.45 * k); }
  rz(B.upperArmL, 0.5 * k); rz(B.upperArmR, -0.35 * k);
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
  // a cool moonlit rim (looks.js): the kid is mostly seen from behind, against the moon, so the silhouette reads
  const material = patchRim(patchGlow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, emissive: '#160b1e', emissiveIntensity: 1 }), 'hwKidGlow'),
    { color: new THREE.Color(0.4, 0.42, 0.8), power: 2.8, share: 0.25, fill: 0.14, key: 'kidRim' });
  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
  skinnedMesh.name = 'kid';
  skinnedMesh.add(bones[0]);
  skinnedMesh.bind(new THREE.Skeleton(bones));
  skinnedMesh.castShadow = true; skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;
  const root = new THREE.Group(); root.name = 'kidRoot';
  root.add(skinnedMesh);
  // the pail is part of the skinned mesh; this marker is its centre (for effects that start at the pail)
  const pail = new THREE.Object3D(); pail.name = 'pail';
  pail.position.set(PAIL_C[0] - JOINT_POS.handR[0], PAIL_C[1] - JOINT_POS.handR[1], PAIL_C[2] - JOINT_POS.handR[2]);
  byName.handR.add(pail);
  return { root, skinnedMesh, material, clips: kidClips(), bones: byName, headBone: byName.head, handR: byName.handR, pail, cape: byName.cape, hatTip: byName.hatTip };
}
