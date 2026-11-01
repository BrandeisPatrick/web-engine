// The level: a moonlit valley with a pumpkin patch (west), a fenced graveyard with a crypt (north-east), a haunted
// house (north-west), a witch's cauldron (south-east), dead trees, dirt paths from the spawn, a picket fence around the
// playable square and low hills beyond it. Built once at load:
//   - terrain: one displaced plane (vertex colours: grass / paths / graveyard soil) on the PhysicsWorld heightfield
//   - static props, built by props.js's reusable builders (stones, iron fences and gate, gnarled trees, the house,
//     crypt, scarecrow, bales, cauldron): merged vertex-coloured geometry in FOUR tiles (the quadrants round the
//     spawn: a view or a shadow pass draws the ones it sees) + ONE merged unlit glow mesh (windows, candles, brew)
//   - instanced decor pumpkins + leaves (1 draw each), grass tufts (1 draw; fewer on phones)
//   - sky dressing: a big moon billboard + halo and a ring of tree-line silhouettes, both depth-less (the post fog reads
//     them as sky) and following the camera
// Colliders go to the PhysicsWorld as static boxes (gravestones, fences, trunks, buildings). The graveyard has four
// ways out (the south gate and a gap in each other side) and its iron fence collides only up to FENCE_TOP above the
// ground, so a JUMP clears it (walking does not): it used to be one gate in a 6 m wall, a trap. Exposes the spots the
// game needs: lantern positions, ghost spawn points, a candy spawn sampler, and glowSpots (halos the game draws over
// the static glowing props: gate and porch lanterns, lit windows, crypt candles, the cauldron).
// Materials: world-space grain on the props and the terrain (looks.js patchDetail; the terrain with a faint dew sheen),
// contact shading + moss baked into the prop colours near the ground, grass tufts (Lambert) swaying in the wind.
// Hooks for the living night (environment.js drives them per frame): the dead trees sway (a per-vertex sway weight
// on the merged props, WIND uniforms; their shadow caster carries the same patch), every lamp, candle and window of the
// glow mesh belongs to a light group whose level the game sets (glowLevels; halos() draws their halos at that level),
// the gate's two iron leaves (folded back inside the fence) swing, and perches lists where the crows sit.
import * as THREE from 'three';
import { makeCanvas, mulberry32, applyPatches, makeDepthMaterial } from '@vibe/engine/render';
import { patchDetail, patchGrass, patchRibs } from './looks.js';
import { Batch, pumpkinGeometry, pumpkinLeafGeometry } from './props.js';
import * as P from './props.js';

export { pumpkinGeometry };

export const PLAY = 50;     // fence half size (m): the playable square
const MOON_HALO = 4.2;      // the moon's halo radius in moon radii
export const HALF = 64;     // terrain half size
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// ------------------------------------------------------------------ paths (polylines, metres)
export const PATHS = [
  [[0, 6], [3, -3], [10, -7], [16, -10], [16, -24]],         // spawn -> graveyard gate -> aisle
  [[0, 6], [-7, 7], [-16, 10], [-26, 15], [-36, 19]],         // -> pumpkin patch
  [[0, 6], [-4, -8], [-13, -20], [-24, -30]],                // -> haunted house
  [[0, 6], [7, 12], [15, 19], [22, 24]],                     // -> cauldron
  [[0, 6], [2, 18], [-2, 32], [4, 44]],                      // -> south field
];
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  const x = ax + dx * t - px, z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}
export function pathDist(x, z) {
  let d = Infinity;
  for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) d = Math.min(d, segDist(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
  return d;
}
// heightAt runs per spark, per ghost step, per candy...: its path-bed test only measures the segments whose box
// (grown by the bed's width) holds the point: the same value wherever the bed dips the ground, a fraction of the work
const BED = 1.6;
const SEGS = new Float64Array(PATHS.reduce((n, P) => n + P.length - 1, 0) * 8);
{
  let k = 0;
  for (const P of PATHS) for (let i = 0; i < P.length - 1; i++, k += 8) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1];
    SEGS.set([ax, az, bx, bz, Math.min(ax, bx) - BED, Math.max(ax, bx) + BED, Math.min(az, bz) - BED, Math.max(az, bz) + BED], k);
  }
}
/** pathDist(x, z) where it is under BED (exactly), else BED. */
function bedDist(x, z) {
  let d = BED;
  for (let k = 0; k < SEGS.length; k += 8) {
    if (x < SEGS[k + 4] || x > SEGS[k + 5] || z < SEGS[k + 6] || z > SEGS[k + 7]) continue;
    d = Math.min(d, segDist(x, z, SEGS[k], SEGS[k + 1], SEGS[k + 2], SEGS[k + 3]));
  }
  return d;
}

// ------------------------------------------------------------------ regions
export const GRAVEYARD = { x0: 8, x1: 46, z0: -46, z1: -10, gate: [13.5, 18.5],
  // the gaps (m along their side): south (the gate, x), west (x = x0, z), east (x = x1, z), north (z = z0, x)
  exits: { s: [13.5, 18.5], w: [-30, -25.5], e: [-24, -19.5], n: [26, 30.5] } };
const FENCE_TOP = 1.1; // the graveyard fence collider's top above the ground (the jump apex is ~1.7 m, a step 0.32 m)
export const PATCH = { x0: -47, x1: -12, z0: -3, z1: 42 };
export const HOUSE = { x: -31, z: -37, w: 11, d: 9, yaw: 0.25 };
export const CRYPT = { x: 35, z: -38 };
export const CAULDRON = { x: 25, z: 27 };
export const SCARECROW = { x: -29, z: 22 };
const inGraveyard = (x, z, m = 0) => x > GRAVEYARD.x0 - m && x < GRAVEYARD.x1 + m && z > GRAVEYARD.z0 - m && z < GRAVEYARD.z1 + m;
const inPatch = (x, z, m = 0) => x > PATCH.x0 - m && x < PATCH.x1 + m && z > PATCH.z0 - m && z < PATCH.z1 + m;

/** Terrain height (m): gentle rolls inside the fence, hills rising outside it, path beds sunk 6 cm. */
export function heightAt(x, z) {
  let h = 0.5 * Math.sin(x * 0.071 + 0.4) * Math.cos(z * 0.063 - 0.8) + 0.28 * Math.sin(x * 0.17 + 1.3) * Math.sin(z * 0.13 + 0.4)
    + 0.08 * Math.sin(x * 0.41 + z * 0.37);
  const r = Math.max(Math.abs(x), Math.abs(z));
  const e = smooth((r - PLAY + 1) / 12);
  h += e * (5 + 2.5 * Math.sin(x * 0.11 + z * 0.07));
  const pd = bedDist(x, z);
  if (pd < BED) h -= 0.06 * (1 - pd / BED);
  return h;
}

// ------------------------------------------------------------------ textures
let glowSpots = []; // filled by buildWorld (the props register their halos while it builds them)
// Light groups of the merged glow mesh: each lamp, candle and window is one group whose brightness the game sets per
// frame (world.glowLevels -> the glow material's uGlowLv[]; the halos over them read the same level), so a flame
// flickers and gutters in a gust and a window can blink out, all in the one draw. [kind, flicker amount]; group 0 is
// steady (level 1) and holds every untagged glow part.
export const GLOW = { STEADY: 0, FLAME: 1, WINDOW: 2, BREW: 3, EMBER: 4, MAX: 24 };
let glowGroups = [];
/** The next glow parts added to G belong to a new light group (kind, flicker amount); returns its index. */
function glowGroup(G, kind, amt = 1) {
  if (glowGroups.length >= GLOW.MAX) { G.group = 0; return 0; }
  glowGroups.push([kind, amt]); G.group = glowGroups.length - 1;
  return G.group;
}

/** Moon disc with maria and a soft limb, plus a separate glow texture. */
function moonTextures() {
  const S = 256, c = makeCanvas(S), g = c.getContext('2d'), rnd = mulberry32(31);
  const R = S * 0.46;
  const gr = g.createRadialGradient(S * 0.46, S * 0.44, R * 0.1, S / 2, S / 2, R);
  gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.7, '#f3e7c4'); gr.addColorStop(1, '#d9c79c');
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.clip();
  for (let k = 0; k < 26; k++) {
    const x = S / 2 + (rnd() - 0.5) * R * 1.7, y = S / 2 + (rnd() - 0.5) * R * 1.7, r = 4 + rnd() * (k < 6 ? 34 : 12);
    g.fillStyle = `rgba(150,130,100,${0.16 + rnd() * 0.22})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  const disc = new THREE.CanvasTexture(c); disc.colorSpace = THREE.SRGBColorSpace;
  const c2 = makeCanvas(128), g2 = c2.getContext('2d');
  const h = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  h.addColorStop(0, 'rgba(255,240,210,0.55)'); h.addColorStop(0.25, 'rgba(230,200,255,0.22)'); h.addColorStop(0.6, 'rgba(160,110,220,0.07)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = h; g2.fillRect(0, 0, 128, 128);
  const halo = new THREE.CanvasTexture(c2); halo.colorSpace = THREE.SRGBColorSpace;
  return { disc, halo };
}

/** Tree-line silhouettes for the horizon ring (alpha only; tiles 4x around). */
function skylineTexture() {
  const W = 1024, H = 128, c = makeCanvas(W, H), g = c.getContext('2d'), rnd = mulberry32(5);
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff';
  // rolling ground line
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H - 18 - 10 * Math.sin(x * 0.012) - 6 * Math.sin(x * 0.041 + 1));
  g.lineTo(W, H); g.closePath(); g.fill();
  // bare trees: trunks + forked branches
  const branch = (x, y, len, a, w, depth) => {
    const x1 = x + Math.sin(a) * len, y1 = y - Math.cos(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke();
    if (depth > 0) for (let k = 0; k < 2 + (rnd() < 0.4 ? 1 : 0); k++) branch(x1, y1, len * (0.55 + rnd() * 0.2), a + (rnd() - 0.5) * 1.4, w * 0.6, depth - 1);
  };
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  for (let x = 10; x < W; x += 22 + rnd() * 40) {
    if (rnd() < 0.18) continue;
    const base = H - 16 - 10 * Math.sin(x * 0.012);
    branch(x, base, 16 + rnd() * 30, (rnd() - 0.5) * 0.3, 2.5 + rnd() * 3, 3);
  }
  // a distant church spire and a windmill
  g.fillRect(610, H - 70, 14, 60); g.beginPath(); g.moveTo(606, H - 70); g.lineTo(617, H - 104); g.lineTo(628, H - 70); g.fill();
  g.fillRect(300, H - 58, 10, 40);
  g.lineWidth = 3; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; g.beginPath(); g.moveTo(305, H - 58); g.lineTo(305 + Math.cos(a) * 24, H - 58 + Math.sin(a) * 24); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1);
  return t;
}

// ------------------------------------------------------------------ wind + light groups (the game drives them)
/**
 * Shared uniforms the game writes per frame (environment.js): WIND.time (s), WIND.sway = (wind dir x, dir z, lean
 * (m at the crown), gust rocking (m)), WIND.gate = per gate leaf (hinge x, z, swing past its built pose (rad), -).
 * Trees bend and the gate swings through the props material and its shadow-caster copy.
 */
export const WIND = { time: { value: 0 }, sway: { value: new THREE.Vector4(0.99, 0.11, 0, 0) }, gate: { value: [new THREE.Vector4(), new THREE.Vector4()] } };
const GATE_OPEN = 2.75; // rad: how far the gate leaves stand open as built (from closed, folded back inside the fence)
// tree sway on the props material (MaterialPatches patch object): attribute sway = (weight, phase). The crown leans
// with the wind and rocks with the gusts, the twigs shiver; everything else has weight 0 and stays put. The gate's
// leaves (sway.x = -1, -2) turn about their hinges instead
const swayPatch = {
  key: 'hwSway', depth: true,
  uniforms: { uSwayT: WIND.time, uSway: WIND.sway, uGate: WIND.gate },
  vertexPars: 'attribute vec2 sway;\nuniform float uSwayT;\nuniform vec4 uSway;\nuniform vec4 uGate[ 2 ];\n',
  vertexBegin: /* glsl */`
	if ( sway.x < - 0.5 ) {
		vec4 gh = sway.x < - 1.5 ? uGate[ 1 ] : uGate[ 0 ];
		vec2 r = position.xz - gh.xy;
		float c = cos( gh.z ), s = sin( gh.z );
		mpOffset.xz += vec2( c * r.x + s * r.y, - s * r.x + c * r.y ) - r;
	} else if ( sway.x > 0.0 ) {
		float t = uSwayT, ph = sway.y;
		float s1 = sin( t * 1.13 + ph ) * 0.6 + sin( t * 2.37 + ph * 1.7 ) * 0.25;
		float s2 = cos( t * 0.91 + ph * 2.1 ) * 0.3;
		vec2 d = uSway.xy;
		mpOffset.xz += ( d * ( uSway.z + uSway.w * ( 0.45 + s1 ) ) + vec2( - d.y, d.x ) * s2 * uSway.w ) * sway.x;
		mpOffset.y -= abs( s1 ) * sway.x * 0.1 * uSway.w;
		mpOffset += vec3( 0.6, 0.8, - 0.5 ) * sin( t * 7.3 + dot( position, vec3( 13.0, 29.0, 17.0 ) ) ) * 0.03 * uSway.w * sway.x;
	}
`,
};
/** The glow material reads its light group's level (uGlowLv[grp], default 1) into the vertex colour. */
function patchGlowGroups(mat, levels) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlowLv = { value: levels };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float grp;\nuniform float uGlowLv[ ${GLOW.MAX} ];`)
      .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor.rgb *= uGlowLv[ int( grp + 0.5 ) ];');
  };
  mat.customProgramCacheKey = () => 'hwGlowGroups';
  return mat;
}

/**
 * The graveyard's south gate: two iron leaves (bars between two stiles), hinged at [x, y, z] (the posts' inner back
 * corners) and folded back GATE_OPEN inside the fence, so they never stand in the gap or between the camera and the
 * kid; merged into the props batch B. Each part carries sway = (-1 - k, 0): the props material turns it about its
 * hinge by WIND.gate[k].z, so the gate swings in the gusts (and its shadow with it) at no draw call.
 */
function gateLeaves(B, hinges, width) {
  const IRON = '#1a1720';
  hinges.forEach(([hx, hy, hz], k) => {
    const L = new Batch();
    L.add(new THREE.BoxGeometry(0.07, 1.78, 0.07), IRON, 0.04, 0.95, 0);
    L.add(new THREE.BoxGeometry(0.05, 1.62, 0.05), IRON, width - 0.03, 0.87, 0);
    for (const y of [0.22, 1.02, 1.62]) L.add(new THREE.BoxGeometry(width, 0.05, 0.04), IRON, width / 2, y, 0);
    for (let x = 0.2; x < width - 0.1; x += 0.19) {
      L.add(new THREE.BoxGeometry(0.024, 1.5, 0.024), IRON, x, 0.93, 0);
      L.add(new THREE.OctahedronGeometry(1, 0), IRON, x, 1.73, 0, 0, 0, 0, 0.034, 0.085, 0.014); // a flat spear tip
    }
    L.add(new THREE.TorusGeometry(0.16, 0.014, 4, 12), IRON, width / 2, 1.32, 0); // a curl between the upper rails
    // closed, the west leaf (k 0) reaches +x and the east one -x; open = turned toward -z (into the graveyard)
    _q.setFromEuler(_e.set(0, k === 0 ? GATE_OPEN : Math.PI - GATE_OPEN, 0));
    _m.compose(_p.set(hx, hy, hz), _q, _s.set(1, 1, 1));
    for (const g of L.parts) {
      g.applyMatrix4(_m);
      const w = new Float32Array(g.attributes.position.count * 2);
      for (let i = 0; i < w.length; i += 2) w[i] = -1 - k;
      g.setAttribute('sway', new THREE.BufferAttribute(w, 2));
      B.parts.push(g);
    }
  });
}

// ------------------------------------------------------------------ props
// The props themselves are built by props.js (reusable builders: any position, any level). These wrappers keep this
// level's layout: the same draws from the level's random stream in the same order (so every tree, stone, pumpkin and
// candy spot stays where it was), the same colliders, the same crow perches.
const skip = (rnd, n) => { for (let i = 0; i < n; i++) rnd(); };
/** A glow context for the builders: light groups by kind name, halos into glowSpots. */
const glowCtx = (G) => ({
  glow: (kind, amt) => (kind === 'steady' ? ((G.group = 0), 0) : glowGroup(G, { flame: GLOW.FLAME, window: GLOW.WINDOW, brew: GLOW.BREW, ember: GLOW.EMBER }[kind], amt)),
  spot: (...a) => glowSpots.push(a),
});

function deadTree(B, x, z, s, rnd, physics, lod = 1) {
  const y = heightAt(x, z) - 0.15;
  const bark = rnd() < 0.5 ? '#3a2f36' : '#463a3e';
  const h = (2.4 + rnd() * 1.6) * s;
  const yaw0 = rnd() * 6.28;
  skip(rnd, 95); // the old limb recursion's draws (its shape is local now)
  // wind sway (the props material, swayPatch): weight 0 at the root rising to 1 at the crown (squared: the trunk
  // stays put, the twigs move most), one phase per tree so the trees rock out of step
  const phase = (x * 0.37 + z * 0.21) % (Math.PI * 2), crown = h * 1.7;
  P.deadTree(B, { x, y, z, h, r: 0.22 * s, phase, crown, seed: P.seedOf(x, z, 3), yaw0, lod, bark });
  physics.addStaticBox(x - 0.28 * s, y - 1, x + 0.28 * s, y + h, z - 0.28 * s, z + 0.28 * s);
}

function gravestone(B, x, z, kind, rnd, physics) {
  const y = heightAt(x, z), yaw = (rnd() - 0.5) * 0.25, tilt = (rnd() - 0.5) * 0.18, roll = (rnd() - 0.5) * 0.14;
  const shade = ['#6f6b78', '#5f5b69', '#7d7886', '#565264'][Math.floor(rnd() * 4)];
  let w = 0.7, h = 1, d = 0.2;
  if (kind === 0) { w = 0.7 + rnd() * 0.2; h = 0.85 + rnd() * 0.35; } // a slab
  else if (kind === 1) { h = 1.3 + rnd() * 0.3; w = 0.6; }        // a cross
  else if (kind === 2) { h = 1.6 + rnd() * 0.6; w = 0.42; }       // an obelisk
  else { h = 0.5; w = 0.6; }                                       // a low marker
  const top = P.gravestone(B, { x, y, z, yaw, tilt: kind === 2 ? tilt * 0.4 : kind === 3 ? tilt * 2 : tilt, roll: kind === 2 ? 0 : roll, kind, w, h, d, shade });
  // mound in front of each stone (soil)
  P.vgrad(B.add(new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.22, 1.8), '#2e2228', x + Math.sin(yaw) * 1.1, y - 0.03, z + Math.cos(yaw) * 1.1, yaw), 0.7, 1.1, 0.08, 7);
  const hw = Math.max(w, d) / 2 + 0.05;
  physics.addStaticBox(x - hw, y - 1, x + hw, y + h, z - 0.18, z + 0.18);
  return { x, z, y, top: y + top, yaw, kind };
}

function ironFence(B, ax, az, bx, bz, physics, gap = null) { P.ironFence(B, ax, az, bx, bz, heightAt, gap); }

function picketFence(B, ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 2.5), dx = (bx - ax) / n, dz = (bz - az) / n, yaw = Math.atan2(dx, dz);
  const WOOD = '#4a3a33', WOOD2 = '#3b2e2a';
  for (let i = 0; i <= n; i++) {
    const x = ax + dx * i, z = az + dz * i, y = heightAt(x, z), lean = Math.sin(i * 7.3) * 0.08;
    B.add(new THREE.BoxGeometry(0.14, 1.3, 0.14), WOOD, x, y + 0.6, z, yaw, lean, 0);
    if (i < n) {
      const y1 = (y + heightAt(x + dx, z + dz)) / 2, l = Math.hypot(dx, dz) + 0.1;
      B.add(new THREE.BoxGeometry(0.06, 0.12, l), WOOD2, x + dx / 2, y1 + 0.45, z + dz / 2, yaw, 0, Math.sin(i) * 0.03);
      B.add(new THREE.BoxGeometry(0.06, 0.12, l), WOOD2, x + dx / 2, y1 + 0.95, z + dz / 2, yaw, 0, Math.sin(i * 1.7) * 0.04);
    }
  }
}

function house(B, G, physics) {
  const { x, z, w, d, yaw } = HOUSE, y = heightAt(x, z) - 0.2;
  P.hauntedHouse(B, G, glowCtx(G), { x, y, z, w, d, yaw });
  const c = Math.cos(yaw), s = Math.sin(yaw), L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  // collider: the rotated footprint's bounding box (house + tower + porch)
  const pts = [L(-w / 2 - 0.2, -d / 2), L(w / 2, -d / 2), L(w / 2, d / 2 + 1.6), L(-w / 2 - 0.2, d / 2 + 1.6)];
  physics.addStaticBox(Math.min(...pts.map((p) => p[0])) + 0.4, y - 1, Math.max(...pts.map((p) => p[0])) - 0.4, y + 9, Math.min(...pts.map((p) => p[1])) + 0.4, Math.max(...pts.map((p) => p[1])) - 0.4);
}

function crypt(B, G, physics) {
  const { x, z } = CRYPT, y = heightAt(x, z) - 0.15;
  P.crypt(B, G, glowCtx(G), { x, y, z });
  physics.addStaticBox(x - 2.6, y - 1, x + 2.6, y + 4.5, z - 2.3, z + 2.5);
}

function cauldron(B, G, physics) {
  const { x, z } = CAULDRON, y = heightAt(x, z);
  P.cauldron(B, G, glowCtx(G), { x, y, z });
  physics.addStaticBox(x - 0.95, y - 1, x + 0.95, y + 1.25, z - 0.95, z + 0.95);
}

function scarecrow(B, G, physics) {
  const { x, z } = SCARECROW, y = heightAt(x, z);
  P.scarecrow(B, G, glowCtx(G), { x, y, z });
  physics.addStaticBox(x - 0.3, y - 1, x + 0.3, y + 2.6, z - 0.3, z + 0.3);
}

/** A small iron candle lantern standing on the ground at (x, y, z): frame, glowing glass, a pyramid roof, a ring. */
function candleLantern(B, G, x, y, z, ry = 0) {
  const IRON = '#17141c';
  B.add(new THREE.BoxGeometry(0.24, 0.04, 0.24), IRON, x, y + 0.02, z, ry);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const c = Math.cos(ry), sn = Math.sin(ry), lx = dx * 0.105, lz = dz * 0.105;
    B.add(new THREE.BoxGeometry(0.022, 0.3, 0.022), IRON, x + lx * c + lz * sn, y + 0.19, z - lx * sn + lz * c, ry);
  }
  B.add(new THREE.ConeGeometry(0.19, 0.13, 4).rotateY(Math.PI / 4), IRON, x, y + 0.405, z, ry);
  B.add(new THREE.TorusGeometry(0.035, 0.008, 4, 10), IRON, x, y + 0.49, z, ry);
  G.add(new THREE.BoxGeometry(0.18, 0.27, 0.18), '#ffb253', x, y + 0.19, z, ry, 0, 0, 1, 1, 1, 2.2);
}

function hayBale(B, x, z, ry, physics) {
  const y = heightAt(x, z);
  P.hayBale(B, { x, y, z, ry });
  physics.addStaticBox(x - 0.65, y - 1, x + 0.65, y + 1.1, z - 0.65, z + 0.65);
}

// ------------------------------------------------------------------ build
export function buildWorld({ scene, physics, low }) {
  const rnd = mulberry32(2026);
  physics.setHeightfield(heightAt);
  const B = new Batch(), G = new Batch();
  // halos the game draws every frame over static glowing props: [x, y, z, size, r, g, b, flicker 0..1, light group]
  glowSpots = [];
  glowGroups = [[GLOW.STEADY, 0]]; G.group = 0;

  // ---- terrain
  const N = low ? 96 : 140;
  const tg = new THREE.PlaneGeometry(HALF * 2, HALF * 2, N, N).rotateX(-Math.PI / 2);
  {
    const p = tg.attributes.position, c = new Float32Array(p.count * 3);
    const grass = new THREE.Color('#24331f'), grass2 = new THREE.Color('#2f3a1f'), dirt = new THREE.Color('#4a3729'), soil = new THREE.Color('#2a2a2c'), hill = new THREE.Color('#1d2420'), patch = new THREE.Color('#3a3420');
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, heightAt(x, z));
      const n = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2) * Math.cos(z * 0.27 - x * 0.05);
      tmp.copy(grass).lerp(grass2, n);
      if (inGraveyard(x, z, 2)) tmp.lerp(soil, 0.55 * smooth(1 - Math.max(0, Math.max(GRAVEYARD.x0 - x, x - GRAVEYARD.x1, GRAVEYARD.z0 - z, z - GRAVEYARD.z1)) / 2));
      if (inPatch(x, z, 2)) tmp.lerp(patch, 0.45);
      const pd = pathDist(x, z);
      if (pd < 1.7) tmp.lerp(dirt, smooth((1.7 - pd) / 0.8));
      const r = Math.max(Math.abs(x), Math.abs(z));
      if (r > PLAY) tmp.lerp(hill, smooth((r - PLAY) / 8));
      c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(c, 3));
    tg.computeVertexNormals();
    tg.deleteAttribute('uv');
  }
  // world-space grain + broad clumps (looks.js), and dew: damp patches catch the low moon as a soft sheen
  const terrainMat = patchDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), { scale: 0.9, amount: 0.5, broad: 0.6, dew: 1, spec: 0.15 });
  const terrain = new THREE.Mesh(tg, terrainMat);
  terrain.name = 'terrain'; terrain.receiveShadow = true;
  scene.add(terrain);

  // ---- graveyard: stones in rows, an aisle up the middle, the crypt at the back, an iron fence with a gate
  const graves = [];
  for (let zz = GRAVEYARD.z1 - 4.5; zz > GRAVEYARD.z0 + 2.5; zz -= 3.6) {
    for (let xx = GRAVEYARD.x0 + 2.5; xx < GRAVEYARD.x1 - 2; xx += 3.1) {
      const x = xx + (rnd() - 0.5) * 0.9, z = zz + (rnd() - 0.5) * 0.7;
      if (Math.abs(x - 16) < 2.2) continue;                                  // the aisle
      if (Math.hypot(x - CRYPT.x, z - CRYPT.z) < 5.5) continue;
      if (rnd() < 0.17) continue;
      const k = rnd(), kind = k < 0.45 ? 0 : k < 0.7 ? 1 : k < 0.85 ? 2 : 3;
      graves.push(gravestone(B, x, z, kind, rnd, physics));
    }
  }
  const G0 = GRAVEYARD, X = G0.exits, inGap = (v, g) => v > g[0] && v < g[1];
  ironFence(B, G0.x0, G0.z1, G0.x1, G0.z1, physics, (x, z) => Math.abs(z - G0.z1) < 0.3 && inGap(x, X.s));
  ironFence(B, G0.x1, G0.z1, G0.x1, G0.z0, physics, (x, z) => Math.abs(x - G0.x1) < 0.3 && inGap(z, X.e));
  ironFence(B, G0.x1, G0.z0, G0.x0, G0.z0, physics, (x, z) => Math.abs(z - G0.z0) < 0.3 && inGap(x, X.n));
  ironFence(B, G0.x0, G0.z0, G0.x0, G0.z1, physics, (x, z) => Math.abs(x - G0.x0) < 0.3 && inGap(z, X.w));
  // fence colliders: ~4 m pieces whose top is FENCE_TOP over the highest ground under them (a jump clears the fence,
  // walking does not), with the four gaps open
  const fenceSide = (along, at, a0, a1, gap) => { // along 'x' (a side at z = at) or 'z' (a side at x = at)
    const pieces = (b0, b1) => {
      const n = Math.max(1, Math.round((b1 - b0) / 4));
      for (let i = 0; i < n; i++) {
        const c0 = b0 + ((b1 - b0) * i) / n, c1 = b0 + ((b1 - b0) * (i + 1)) / n;
        let top = -Infinity;
        for (let c = c0; c <= c1 + 1e-6; c += 0.5) top = Math.max(top, along === 'x' ? heightAt(c, at) : heightAt(at, c));
        if (along === 'x') physics.addStaticBox(c0, -5, c1, top + FENCE_TOP, at - 0.1, at + 0.1);
        else physics.addStaticBox(at - 0.1, -5, at + 0.1, top + FENCE_TOP, c0, c1);
      }
    };
    pieces(a0, gap[0]); pieces(gap[1], a1);
  };
  fenceSide('x', G0.z1, G0.x0 - 0.1, G0.x1 + 0.1, X.s);
  fenceSide('x', G0.z0, G0.x0 - 0.1, G0.x1 + 0.1, X.n);
  fenceSide('z', G0.x0, G0.z0, G0.z1, X.w);
  fenceSide('z', G0.x1, G0.z0, G0.z1, X.e);
  // gate posts with stone caps at every gap (+ an iron arch with scrolls and a crescent moon over the south gate)
  const gatePost = (gx, gz) => P.gatePost(B, gx, heightAt(gx, gz), gz);
  for (const gx of X.s) gatePost(gx, G0.z1);
  for (const gx of X.n) gatePost(gx, G0.z0);
  for (const gz of X.w) gatePost(G0.x0, gz);
  for (const gz of X.e) gatePost(G0.x1, gz);
  P.gateArch(B, G0.gate[0], G0.gate[1], heightAt(16, G0.z1), G0.z1);
  // candle lanterns at the foot of the gate posts, on their outer sides (the path between them stays clear): warm points
  // framing the way in (glow geometry + a halo each)
  for (const gx of G0.gate) {
    const x = gx + (gx < 16 ? -0.62 : 0.62), z = G0.z1 + 0.42, y = heightAt(x, z), gl = glowGroup(G, GLOW.FLAME, 1);
    candleLantern(B, G, x, y, z, gx < 16 ? 0.3 : -0.4);
    glowSpots.push([x, y + 0.2, z, 1.7, 0.55, 0.26, 0.07, 1, gl]);
  }
  G.group = 0;
  crypt(B, G, physics);

  // ---- haunted house, cauldron, scarecrow, hay bales
  house(B, G, physics);
  cauldron(B, G, physics);
  scarecrow(B, G, physics);
  for (const [x, z, r] of [[-15, 3, 0.4], [-17, 4.5, 1.2], [-40, 31, 0.2], [-24, 38, 1.5], [-44, 5, 0.9], [9, 30, 0.7]]) hayBale(B, x, z, r, physics);

  // ---- dead trees (kept off paths, buildings and the graveyard aisle)
  const treeSpots = [];
  const okTree = (x, z) => pathDist(x, z) > 3 && Math.hypot(x - HOUSE.x, z - HOUSE.z) > 10 && Math.hypot(x - CAULDRON.x, z - CAULDRON.z) > 5
    && Math.hypot(x - CRYPT.x, z - CRYPT.z) > 6 && Math.hypot(x, z - 6) > 8 && !(inGraveyard(x, z, 1) && Math.abs(x - 16) < 4) && !inPatch(x, z, -2)
    && treeSpots.every(([a, b]) => Math.hypot(a - x, b - z) > 7);
  for (let tries = 0; treeSpots.length < (low ? 16 : 22) && tries < 2000; tries++) {
    const x = (rnd() * 2 - 1) * (PLAY - 3), z = (rnd() * 2 - 1) * (PLAY - 3);
    if (!okTree(x, z)) continue;
    if (inGraveyard(x, z, 0) && graves.some((g) => Math.hypot(g.x - x, g.z - z) < 2)) continue;
    treeSpots.push([x, z]);
    deadTree(B, x, z, 0.85 + rnd() * 0.5, rnd, physics);
  }
  // a few trees outside the fence on the hills (no colliders needed, but harmless)
  for (let k = 0; k < (low ? 10 : 18); k++) {
    const a = rnd() * Math.PI * 2, r = PLAY + 4 + rnd() * 8;
    deadTree(B, Math.cos(a) * r, Math.sin(a) * r, 1.1 + rnd() * 0.6, rnd, physics, 0);
  }

  // ---- outer picket fence + its colliders
  const F = PLAY;
  picketFence(B, -F, -F, F, -F); picketFence(B, F, -F, F, F); picketFence(B, F, F, -F, F); picketFence(B, -F, F, -F, -F);
  physics.addStaticBox(-F - 2, -5, F + 2, 8, -F - 2, -F + 0.2);
  physics.addStaticBox(-F - 2, -5, F + 2, 8, F - 0.2, F + 2);
  physics.addStaticBox(-F - 2, -5, -F + 0.2, 8, -F, F);
  physics.addStaticBox(F - 0.2, -5, F + 2, 8, -F, F);

  // ---- the south gate's two leaves, folded back inside (no colliders: they never close across the path)
  const hinges = [G0.gate[0] + 0.27, G0.gate[1] - 0.27].map((hx) => [hx, heightAt(hx, G0.z1 - 0.27) + 0.04, G0.z1 - 0.27]);
  gateLeaves(B, hinges, (G0.gate[1] - G0.gate[0]) / 2 - 0.3);

  // ---- merged static meshes
  // stone / bark / wood grain in world space (looks.js), contact shading + moss baked into the colours at the ground;
  // the trees sway in the wind (swayPatch), and their shadows with them (the shadow caster carries the same patch)
  const propMat = applyPatches(patchDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02 }), { scale: 1.7, amount: 0.62, broad: 0.32, streak: 0.55 }), [swayPatch]);
  // four tiles (the quadrants round the spawn): a view or a shadow pass draws only the quadrants it sees
  const props = B.build(propMat, 'props', heightAt, true, (px, pz) => (px < 0 ? 0 : 1) + (pz < 0 ? 0 : 2));
  const propDepth = makeDepthMaterial(propMat);
  for (const m of props.children) { m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = propDepth; }
  scene.add(props);
  const glowLevels = new Float32Array(GLOW.MAX).fill(1);
  const glowMat = patchGlowGroups(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), glowLevels);
  const glow = G.build(glowMat, 'glow');
  scene.add(glow);
  // the gate: its leaves stand open a0 / a1 (rad from closed, folded inward; built at `open`), through the props material
  const G2 = WIND.gate.value;
  const gate = {
    hinges, open: GATE_OPEN,
    set(a0, a1) { G2[0].set(hinges[0][0], hinges[0][2], a0 - GATE_OPEN, 0); G2[1].set(hinges[1][0], hinges[1][2], -(a1 - GATE_OPEN), 0); },
  };
  gate.set(GATE_OPEN, GATE_OPEN);

  // ---- pumpkin patch: rows of decor pumpkins (instanced) + leaves
  const decor = [];
  for (let zz = PATCH.z0 + 1.5; zz < PATCH.z1 - 1; zz += 3.2) {
    for (let xx = PATCH.x0 + 1.5; xx < PATCH.x1 - 1; xx += 1.7) {
      const x = xx + (rnd() - 0.5) * 0.9, z = zz + (rnd() - 0.5) * 0.8;
      if (pathDist(x, z) < 2 || Math.hypot(x - SCARECROW.x, z - SCARECROW.z) < 2) continue;
      if (rnd() < (low ? 0.45 : 0.3)) continue;
      decor.push([x, z, 0.55 + rnd() * 0.7, rnd() * 6.28, rnd()]);
    }
  }
  for (let k = 0; k < 26; k++) { // strays elsewhere
    const x = (rnd() * 2 - 1) * (PLAY - 4), z = (rnd() * 2 - 1) * (PLAY - 4);
    if (pathDist(x, z) < 2.5 || inGraveyard(x, z, 1) || Math.hypot(x - HOUSE.x, z - HOUSE.z) < 9) continue;
    decor.push([x, z, 0.5 + rnd() * 0.6, rnd() * 6.28, rnd()]);
  }
  const pg = pumpkinGeometry(0.4, 15, 0, '#ffffff', '#4d6a2a', { lobes: 5, depth: 0.12, seed: 5, lite: true });
  const pMat = patchRibs(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 }), 5, 0.45);
  const pumpkins = new THREE.InstancedMesh(pg, pMat, decor.length);
  pumpkins.name = 'decorPumpkins'; pumpkins.castShadow = false; pumpkins.receiveShadow = true;
  const leafGeo = pumpkinLeafGeometry(0.34);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#2c4a22', roughness: 0.85 }), decor.length * 2);
  leaves.name = 'leaves'; leaves.receiveShadow = true;
  const tint = new THREE.Color();
  decor.forEach(([x, z, s, yaw, v], i) => {
    const y = heightAt(x, z) - 0.03;
    _q.setFromEuler(_e.set(0, yaw, (v - 0.5) * 0.2));
    pumpkins.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(s, s * (0.85 + v * 0.3), s)));
    if (v < 0.08) tint.set('#e9e2d0'); else if (v < 0.14) tint.set('#6f8a3a'); else tint.setHSL(0.065 + v * 0.03, 0.95, 0.42 + v * 0.1);
    pumpkins.setColorAt(i, tint);
    for (let k = 0; k < 2; k++) {
      const a = yaw + k * 2.6 + 0.6, lx = x + Math.cos(a) * 0.45 * s, lz = z + Math.sin(a) * 0.45 * s;
      _q.setFromEuler(_e.set(0.1, -a - Math.PI / 2, 0)); // the leaf points away from its pumpkin
      leaves.setMatrixAt(i * 2 + k, _m.compose(_p.set(lx, heightAt(lx, lz) + 0.02, lz), _q, _s.set(s * 1.3, s, s * 1.3)));
    }
  });
  pumpkins.instanceMatrix.needsUpdate = true; if (pumpkins.instanceColor) pumpkins.instanceColor.needsUpdate = true;
  pumpkins.computeBoundingSphere(); leaves.computeBoundingSphere();
  scene.add(pumpkins, leaves);

  // ---- grass tufts (crossed blades, instanced)
  let tufts = null;
  {
    const count = low ? 2400 : 7000;
    const blade = [], shade = [];
    for (let k = 0; k < 5; k++) { // five thin blades leaning out from the centre
      const a = k * 1.2566 + 0.3, ca = Math.cos(a), sa = Math.sin(a), w = 0.022, lean = 0.1 + (k % 2) * 0.06, h = 0.26 + (k % 3) * 0.07;
      blade.push(-sa * w + ca * 0.03, 0, ca * w + sa * 0.03, sa * w + ca * 0.03, 0, -ca * w + sa * 0.03, ca * lean, h, sa * lean);
      shade.push(0.32, 0.36, 0.42, 0.32, 0.36, 0.42, 1.25, 1.3, 1.15); // dark roots, tips catching the moon
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(blade, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
    g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // lit like the ground
    // swaying in the wind (looks.js: the tips move, the roots stay)
    // Lambert: no specular (up-facing blade normals caught the low moon as white glints), and cheaper per fragment
    tufts = new THREE.InstancedMesh(g, patchGrass(new THREE.MeshLambertMaterial({ color: '#3d5a2c', vertexColors: true, side: THREE.DoubleSide })), count);
    tufts.name = 'grass';
    let n2 = 0;
    const scatter = (R, upTo) => {
      for (let tries = 0; n2 < upTo && tries < upTo * 4; tries++) {
        const x = (R() * 2 - 1) * (PLAY + 6), z = (R() * 2 - 1) * (PLAY + 6);
        if (pathDist(x, z) < 1.6 || inPatch(x, z, -1)) continue;
        const s = 0.6 + R() * 0.9;
        _q.setFromEuler(_e.set((R() - 0.5) * 0.3, R() * 6.28, 0));
        tufts.setMatrixAt(n2, _m.compose(_p.set(x, heightAt(x, z) - 0.02, z), _q, _s.set(s, s * (0.8 + R() * 0.9), s)));
        tint.setHSL(0.22 + R() * 0.1, 0.45, 0.2 + R() * 0.12); tufts.setColorAt(n2, tint);
        n2++;
      }
    };
    // the first tufts draw exactly the level's seeded numbers they always did (so the candy spots sampled after them
    // stay where they were); the extra ones come from their own stream
    scatter(rnd, low ? 1100 : 2800);
    scatter(mulberry32(1031), count);
    tufts.count = n2;
    tufts.instanceMatrix.needsUpdate = true; tufts.instanceColor.needsUpdate = true;
    tufts.computeBoundingSphere();
    tufts.receiveShadow = true;
    scene.add(tufts);
  }

  // ---- sky dressing: moon billboard + halo, horizon silhouettes (depth-less: the post fog sees sky there)
  // the moon: its disc over its additive halo in one quad (premultiplied: out = disc + halo * (1 - a) + sky * (1 - a),
  // what the halo drawn additively and the disc alpha-blended over it gave); moonColor.disc / .halo tint them
  const moonTex = moonTextures();
  const moonColor = { disc: new THREE.Color(1.6, 1.5, 1.3), halo: new THREE.Color(1.2, 1.1, 1.3) };
  const moonMat = new THREE.ShaderMaterial({
    uniforms: { tDisc: { value: moonTex.disc }, tHalo: { value: moonTex.halo }, uDisc: { value: moonColor.disc }, uHalo: { value: moonColor.halo }, uK: { value: MOON_HALO } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDisc, tHalo;
      uniform vec3 uDisc, uHalo;
      uniform float uK;
      varying vec2 vUv;
      void main() {
        vec4 h = texture2D( tHalo, vUv );
        vec2 du = ( vUv - 0.5 ) * uK + 0.5;
        vec4 d = texture2D( tDisc, du ); // clamped: outside the disc's square its transparent border repeats
        gl_FragColor = vec4( uDisc * d.rgb * d.a + uHalo * h.rgb * h.a * ( 1.0 - d.a ), d.a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), moonMat);
  moon.name = 'moon'; moon.renderOrder = 1; moon.frustumCulled = false;
  scene.add(moon);
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 56, 48, 1, true).translate(0, 12, 0),
    // a touch lighter than black: the far tree line sits in the night haze, behind the fogged hills
    new THREE.MeshBasicMaterial({ color: '#0e0919', alphaMap: skylineTexture(), transparent: true, depthWrite: false, side: THREE.BackSide, fog: false }));
  sky.name = 'skyline'; sky.renderOrder = 2; sky.frustumCulled = false;
  scene.add(sky);
  const _moonDir = new THREE.Vector3();

  // ---- spots for the game
  const lanternSpots = [
    [-20, 4], [-26, 9], [-34, 6], [-41, 12], [-22, 20], [-37, 24], [-44, 30], [-27, 31], [-18, 37], [-34, 38], // patch
    [12.5, -14], [24, -19], [41, -17], [21, -33], [37, -28], [12, -41], [28, -43],                             // graveyard
    [4.5, -3.5], [-9, 9.5], [10, 15], [-11, -16], [-21, -28], [19, 25], [29, 31], [31, 6], [41, 37], [-4, 28], [7, 42], [44, 8], [-44, -12], [-6, -40], [43, -2],
  ].filter(([x, z]) => physics.queryColliders(x, z, 0.7, []).length === 0);
  const ghostSpawns = graves.map((g) => [g.x, g.z]).concat([[CRYPT.x, CRYPT.z + 3.5], [HOUSE.x + 2, HOUSE.z + 7]]);
  const _cols = [];
  /** A random free spot for a candy (inside the fence, not in a collider, away from (ax, az)). */
  const candySpot = (out, ax = 1e9, az = 1e9, minDist = 6) => {
    for (let t = 0; t < 40; t++) {
      // half the candies near paths and in the graveyard / patch (where the action is), the rest anywhere
      let x, z;
      const k = rnd();
      if (k < 0.3) { const P = PATHS[Math.floor(rnd() * PATHS.length)], i = Math.floor(rnd() * (P.length - 1)), f = rnd(); x = P[i][0] + (P[i + 1][0] - P[i][0]) * f + (rnd() - 0.5) * 3; z = P[i][1] + (P[i + 1][1] - P[i][1]) * f + (rnd() - 0.5) * 3; }
      else if (k < 0.5) { x = GRAVEYARD.x0 + 1 + rnd() * (GRAVEYARD.x1 - GRAVEYARD.x0 - 2); z = GRAVEYARD.z0 + 1 + rnd() * (GRAVEYARD.z1 - GRAVEYARD.z0 - 2); }
      else if (k < 0.65) { x = PATCH.x0 + rnd() * (PATCH.x1 - PATCH.x0); z = PATCH.z0 + rnd() * (PATCH.z1 - PATCH.z0); }
      else { x = (rnd() * 2 - 1) * (PLAY - 3); z = (rnd() * 2 - 1) * (PLAY - 3); }
      if (Math.abs(x) > PLAY - 2 || Math.abs(z) > PLAY - 2) continue;
      if ((x - ax) * (x - ax) + (z - az) * (z - az) < minDist * minDist) continue;
      _cols.length = 0;
      if (physics.queryColliders(x, z, 0.6, _cols).length) continue;
      out[0] = x; out[1] = heightAt(x, z); out[2] = z;
      return true;
    }
    return false;
  };

  // crow perches [x, y (the feet), z, yaw]: the gate finials, the scarecrow's arms, the crypt's ridge, and the tall
  // stones near the aisle
  const perches = [];
  for (const gx of X.s) perches.push([gx, heightAt(gx, G0.z1) + 2.95, G0.z1, 2.8 + gx * 0.1]);
  { const y = heightAt(SCARECROW.x, SCARECROW.z); perches.push([SCARECROW.x - 0.72, y + 2.0, SCARECROW.z, 0.4], [SCARECROW.x + 0.66, y + 2.0, SCARECROW.z, -2.6]); }
  { const y = heightAt(CRYPT.x, CRYPT.z) - 0.15 + 5.06; perches.push([CRYPT.x - 1.4, y, CRYPT.z, 1.2], [CRYPT.x + 1.1, y, CRYPT.z, -0.5]); }
  graves.filter((g) => g.kind < 3).map((g) => [Math.hypot(g.x - 16, g.z + 16) - (g.top - g.y) * 2, g]).sort((a, b) => a[0] - b[0]).slice(0, 7)
    .forEach(([, g], i) => perches.push([g.x, g.top, g.z, g.yaw + (i % 2 ? Math.PI : 0) + 0.6 * Math.sin(i * 3.1)]));
  const groups = glowGroups.map((q) => q.slice());

  return {
    terrain, props, glow, pumpkins, leaves, tufts, moon, moonColor, sky, lanternSpots, ghostSpawns, graves, candySpot, heightAt, glowSpots,
    /** Light groups ([kind, flicker amount], see GLOW) and their levels (glowLevels: set per frame by the game; 1). */
    glowGroups: groups, glowLevels, gate, perches,
    /** The halos over the static glowing props into `glows` from slot `base`, each at its light group's level. */
    halos(glows, base) {
      const GS = glowSpots, L = glowLevels;
      for (let k = 0; k < GS.length; k++) {
        const q = GS[k], f = L[q[8]];
        glows.set(base + k, q[0], q[1], q[2], q[3], q[4] * f, q[5] * f, q[6] * f);
      }
      return GS.length;
    },
    /** Per frame: the sky dressing follows the camera (moon along the atmosphere's moon direction). */
    update(camera, moonDir) {
      const cp = camera.position;
      _moonDir.copy(moonDir).normalize();
      const D = 420, R = 30;
      moon.position.copy(cp).addScaledVector(_moonDir, D);
      moon.lookAt(cp); moon.scale.setScalar(R * MOON_HALO); // the quad holds the halo; the disc is 1 / MOON_HALO of it
      sky.position.set(cp.x, 0, cp.z);
    },
  };
}
