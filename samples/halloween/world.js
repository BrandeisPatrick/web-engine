// The level (map v2, DESIGN.md 3): a moonlit village in a 100 x 100 m valley. A lane ring with four spokes from the
// green at the spawn; the fenced graveyard with its crypt (north-east, as it always was); the haunted house on a 4.5 m
// knoll (north-west); the gatekeeper's cottage by the green; the pumpkin patch with the scarecrow (west); the witch's
// hollow, a cauldron in a ring of standing stones (east), with the east cottage; a creek across the south third (three
// footbridges, jumpable anywhere, candy in its bed); Porch Row (three cottages along the lane) and the Bale Yard (a
// stair of bales) beyond it; the hollow oak in the far corner; a picket fence round the playable square, hills beyond.
// Built once at load:
//   - terrain: one displaced grid (vertex colours: grass, the lane's dirt, graveyard soil, the creek's bed, the knoll's
//     dry grass) on the PhysicsWorld heightfield (heightAt: the knoll and the creek are two cheap terms; extra grid rows
//     at the creek's edges keep its bank walls tight on the mesh)
//   - static props, built by props.js's reusable builders and placed by village.js (cottages, bridges, banks, stones,
//     bales, the oak, the well, the signpost): ONE merged vertex-coloured mesh + ONE merged unlit glow mesh (windows,
//     lamps, candles, the cauldron's brew), so the whole level is a handful of draw calls; plus the creek's water (one
//     additive mesh). Each porch house leaves a doorway for the porch logic's door (porches.js)
//   - instanced decor pumpkins + leaves (1 draw each, the patch only), grass tufts (1 draw; fewer on phones)
//   - sky dressing: a big moon billboard + halo and a ring of tree-line silhouettes, both depth-less (the post fog reads
//     them as sky) and following the camera
// Colliders go to the PhysicsWorld as static boxes. The graveyard has four ways out (the south gate and a gap in each
// other side) and its iron fence collides only up to FENCE_TOP above the ground, so a JUMP clears it (walking does not).
// The creek's banks are walls of the bed's depth: falling in is allowed, a JUMP gets out (walking does not); Porch Row's
// picket fences are 1 m high (a jump clears them) with a gate gap between each pair of cottages.
// Exposes the map to the game (the passes build against these names): PORCHES (the six trick-or-treat porches: mats,
// lamps and railings as light groups, chimneys; each house leaves a doorway for the porch logic's door), HAND_SPOTS,
// BRIDGES, CREEK, POP_SPOTS, SECRETS (the well, the crypt door, the hollow oak), CAULDRON, VANTAGE, THIEF_DEN, the
// lantern spots, ghost spawn points, a candy spawn sampler with the design's shares per zone (candySpot), zoneOf(x, z),
// and glowSpots (halos over the static glowing props). Materials: world-space grain on the props and the terrain
// (looks.js patchDetail; the terrain with a faint dew sheen), contact shading + moss baked into the prop colours near
// the ground, grass tufts (Lambert) swaying in the wind.
// Hooks for the living night (environment.js drives them per frame): the dead trees, the oak and the reeds sway (a
// per-vertex sway weight on the merged props, WIND uniforms; their shadow caster carries the same patch), every lamp,
// candle and window of the glow mesh belongs to a light group whose level the game sets (glowLevels; halos() draws
// their halos at that level; GLOW.LAMP groups, the porch lamps, railings and the oak's glint, burn steady for the game
// to scale),
// the gate's two iron leaves swing, and perches lists where the crows sit.
import * as THREE from 'three';
import { makeCanvas, mulberry32, applyPatches, makeDepthMaterial } from '@vibe/engine/render';
import { patchDetail, patchGrass, patchRibs } from './looks.js';
import { Batch, pumpkinGeometry, pumpkinLeafGeometry } from './props.js';
import * as P from './props.js';
import * as V from './village.js';

export { pumpkinGeometry };

export const PLAY = 50;     // fence half size (m): the playable square
const MOON_HALO = 4.2;      // the moon's halo radius in moon radii
export const HALF = 64;     // terrain half size
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// ------------------------------------------------------------------ the lane (polylines, metres; x east, z south)
/**
 * The lane: a ring (the safe loop past every porch, the gate, the hollow, two bridges and the patch) and four spokes from
 * the spawn's green (to the graveyard gate, to the centre bridge, up the knoll to the haunted house's steps, to the
 * cauldron). 3 m of dirt, its bed sunk 6 cm.
 */
export const LANE = {
  ring: [[-36, -11], [-36, 29], [40, 29], [40, -6], [8, -6], [-36, -11]],
  spokes: [[[0, 6], [16, -10]], [[0, 6], [0, 29]], [[0, 6], [-17, -15], [-20.8, -16.0]], [[0, 6], [36, 10]]],
  width: 3,
};
export const PATHS = [LANE.ring, ...LANE.spokes];
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  const x = ax + dx * t - px, z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}
/** Distance (m) from (x, z) to the lane's centre line. */
export function pathDist(x, z) {
  let d = Infinity;
  for (const L of PATHS) for (let i = 0; i < L.length - 1; i++) d = Math.min(d, segDist(x, z, L[i][0], L[i][1], L[i + 1][0], L[i + 1][1]));
  return d;
}
// heightAt runs per spark, per ghost step, per candy...: its lane-bed test only measures the segments whose box (grown
// by the bed's width) holds the point: the same value wherever the bed dips the ground, a fraction of the work
const BED = 1.6;
const SEGS = new Float64Array(PATHS.reduce((n, L) => n + L.length - 1, 0) * 8);
{
  let k = 0;
  for (const L of PATHS) for (let i = 0; i < L.length - 1; i++, k += 8) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1];
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

// ------------------------------------------------------------------ regions and landmarks
export const GRAVEYARD = { x0: 8, x1: 46, z0: -46, z1: -10, gate: [13.5, 18.5],
  // the gaps (m along their side): south (the gate, x), west (x = x0, z), east (x = x1, z), north (z = z0, x)
  exits: { s: [13.5, 18.5], w: [-30, -25.5], e: [-24, -19.5], n: [26, 30.5] } };
const FENCE_TOP = 1.1; // the graveyard fence collider's top above the ground (the jump apex is ~1.7 m, a step 0.32 m)
export const PATCH = { x0: -47, x1: -14, z0: -6, z1: 16 };
/** The knoll: 4.5 m high, a plateau of radius 7 m easing out to 15 m (h += 4.5 smooth((15 - d) / 8)). */
export const KNOLL = { x: -22, z: -22, r: 15, top: 7, h: 4.5 };
/**
 * The creek across the south third: its banks at z0 / z1, its bed `depth` m down (the jump's 1.7 m apex clears the
 * banks; walking out does not), bank walls `lip` m thick, across x -x..x (it fades into the hills under the fence).
 * depth <= ford (the kill switch): a walkable ford with gentle banks and no walls.
 */
export const CREEK = { z0: 19, z1: 22.5, depth: 1.2, lip: 0.4, ford: 0.6, x: 50 };
/** The footbridges (2.6 m plank decks flush with the banks); world.js fills y (the deck top), bed, candles. */
export const BRIDGES = [{ id: 'W', x: -36, w: 2.6 }, { id: 'C', x: 0, w: 2.6 }, { id: 'E', x: 40, w: 2.6 }].map((b) => ({ ...b, z: (CREEK.z0 + CREEK.z1) / 2 }));
export const HOUSE = { x: -22, z: -23.5, w: 11, d: 9, yaw: 0 };
export const CRYPT = { x: 35, z: -38 };
/** The witch's cauldron: the potions' ring (r); brew / brewHalo: its light group and halo (filled by buildWorld). */
export const CAULDRON = { x: 36, z: 10, r: 1.4, brew: -1, brewHalo: -1 };
export const SCARECROW = { x: -29, z: 6 };
/** The vantage point on the knoll's rim (a bench and a lantern): every porch lamp in sight. */
export const VANTAGE = [-17, -15];
/** The candy thief's den: under the hay bale at (x, z); its burrow opens toward the patch at (door). */
export const THIEF_DEN = { x: -42, z: -3, door: [-42, -1.7] };
const WELL = [9, 1.5], SIGNPOST = [0, -1], OAK = [-44, -44];
/** Standing stones round the cauldron [x, z, height]: the lane passes inside the ring's east side. */
const STONES = [[31, 10, 2.3], [36, 5, 2.0], [42.2, 10, 2.5], [33, 14.2, 1.9], [37.9, 14.7, 2.2]];
/**
 * The Bale Yard's stair: three tiers 0.7 / 1.4 / 2.2 m, stacked into the yard's far corner (each tier a box that holds
 * the next: from outside the stack is one convex block, no inside corner for the kid to be pushed into), the last the
 * platform with the pop. A jump climbs each tier from the north-west.
 */
const BALE_TIERS = [{ x0: 36.5, x1: 44.5, z0: 36.5, z1: 44.5, h: 0.7 }, { x0: 38.9, x1: 44.5, z0: 38.9, z1: 44.5, h: 1.4 }, { x0: 41.0, x1: 44.5, z0: 41.0, z1: 44.5, h: 2.2 }];
/** Fixed big-pop spots: the knoll's plateau and the Bale Yard's platform (y: the ground or the platform). */
export const POP_SPOTS = [[-14.6, -21], [42.75, 42.75]];
/** Grave hands: the graveyard's aisle and two rows off it, the three bridges' north ends (nudged off colliders at build). */
export const HAND_SPOTS = [[16, -14], [16, -20], [16, -26], [16, -32], [16, -38], [28, -20], [38, -30], [-36, 17], [0, 17], [40, 17]];
/** The secrets' places (their rules come later): BOO at the well, BOO at the crypt's door, the hollow oak's inside. */
export const SECRETS = {
  well: { x: WELL[0], z: WELL[1], r: 3 },
  crypt: { door: [CRYPT.x, 0, CRYPT.z + 2.27], r: 3, group: -1, halo: -1 },
  oak: { x: OAK[0], z: OAK[1], inside: [OAK[0], OAK[1]], group: -1, halo: -1 },
};
const inGraveyard = (x, z, m = 0) => x > GRAVEYARD.x0 - m && x < GRAVEYARD.x1 + m && z > GRAVEYARD.z0 - m && z < GRAVEYARD.z1 + m;
const inPatch = (x, z, m = 0) => x > PATCH.x0 - m && x < PATCH.x1 + m && z > PATCH.z0 - m && z < PATCH.z1 + m;

// ------------------------------------------------------------------ terrain
/** The knoll's rise (m) at (x, z). */
function knollH(x, z) {
  const dx = x - KNOLL.x, dz = z - KNOLL.z, d2 = dx * dx + dz * dz;
  if (d2 >= KNOLL.r * KNOLL.r) return 0;
  const d = Math.sqrt(d2);
  return KNOLL.h * (d <= KNOLL.top ? 1 : smooth((KNOLL.r - d) / (KNOLL.r - KNOLL.top)));
}
/** How far down the creek's bed is at z (0..1 of its depth): steep under the bank walls, flat across the bed (a ford: gentle). */
function creekK(z) {
  const C = CREEK, e = Math.min(z - C.z0, C.z1 - z);
  if (e <= 0) return 0;
  return C.depth > C.ford ? smooth(e / (C.lip - 0.05)) : smooth(e / ((C.z1 - C.z0) / 2));
}
/** Terrain height (m): gentle rolls inside the fence, hills rising outside it, the knoll, the creek, the lane's bed. */
export function heightAt(x, z) {
  let h = 0.5 * Math.sin(x * 0.071 + 0.4) * Math.cos(z * 0.063 - 0.8) + 0.28 * Math.sin(x * 0.17 + 1.3) * Math.sin(z * 0.13 + 0.4)
    + 0.08 * Math.sin(x * 0.41 + z * 0.37);
  const r = Math.max(Math.abs(x), Math.abs(z));
  const e = smooth((r - PLAY + 1) / 12);
  h += e * (5 + 2.5 * Math.sin(x * 0.11 + z * 0.07));
  h += knollH(x, z);
  if (z > CREEK.z0 && z < CREEK.z1) { const ax = Math.abs(x); if (ax < CREEK.x + 4) h -= CREEK.depth * creekK(z) * (ax < CREEK.x ? 1 : smooth((CREEK.x + 4 - ax) / 4)); }
  const pd = bedDist(x, z);
  if (pd < BED) h -= 0.06 * (1 - pd / BED);
  return h;
}

/** Which part of the map (x, z) is in (bots, tests and candy share checks). */
export function zoneOf(x, z) {
  if (inGraveyard(x, z)) return 'graveyard';
  if (z > CREEK.z0 && z < CREEK.z1) return 'creek';
  if (x > 35 && z > 35) return 'baleyard';
  if (Math.abs(x) < 37 && z > 29.6) return 'row';
  if (inPatch(x, z)) return 'patch';
  if (Math.hypot(x - KNOLL.x, z - KNOLL.z) < KNOLL.r) return 'knoll';
  if (Math.hypot(x - CAULDRON.x, z - CAULDRON.z) < 9) return 'hollow';
  if (Math.hypot(x - OAK[0], z - OAK[1]) < 6) return 'oak';
  if (Math.hypot(x, z - 2) < 12) return 'green';
  if (pathDist(x, z) < 2.5) return 'lane';
  return Math.max(Math.abs(x), Math.abs(z)) > PLAY - 5 ? 'edge' : 'field';
}

// ------------------------------------------------------------------ porches
const COTTAGE = { w: 7, d: 6, doorX: -0.9, deckW: 4.2, deckD: 1.9 };
/**
 * A porch (the shape the porch logic builds against): id, x / z the house's centre, yaw (three.js rotation.y: the door
 * faces (sin yaw, cos yaw)), mat { x, z, w (along the wall), d (out from it), y (the deck's top) }, chimney [x, y, z]
 * (where a resident ghost drops from), haunted (P6: trick only); lamp / railing: light groups of the glow mesh (the
 * porch lamp with its glowing mat; the railing's jack-o'-lantern: the porch logic scales their levels in glowLevels after
 * environment.js has written them each frame), halos
 * (indices into glowSpots), floor (the ground at its steps) and build (the cottage's dimensions): filled by buildWorld.
 */
function porch(id, x, z, yaw, build, haunted = false) {
  const c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const b = haunted ? null : { ...COTTAGE, ...build };
  const doorX = haunted ? 1.2 : b.doorX, fd = haunted ? HOUSE.d / 2 : b.d / 2;
  const [fx, fz] = W(doorX, fd + (haunted ? 2.3 : b.deckD + 0.2)), floor = heightAt(fx, fz);
  const [mx, mz] = W(doorX, fd + 0.85), [cx, cz] = haunted ? W(2.9, -0.9) : W(b.w / 2 - 1.2, -b.d / 4);
  return {
    id, x, z, yaw, haunted, floor, build: b, lamp: -1, railing: -1, window: -1, halos: null,
    mat: { x: +mx.toFixed(3), z: +mz.toFixed(3), w: 2.2, d: 1.6, y: floor + 0.3 },
    chimney: [cx, floor + (haunted ? 10.6 : 6.2), cz],
  };
}
/** The six porches: P1 the gatekeeper's cottage by the green (lit at 0:00, 17 m ahead-left of the spawn), P2..P4 Porch
 * Row (doors north onto the lane), P5 the east cottage (door west onto the lane), P6 the haunted house on the knoll. */
export const PORCHES = [
  porch('P1', -5, -14, 0, { doorX: 0.9, palette: 0, stone: true }),
  porch('P2', -26, 35, Math.PI, { palette: 1 }),
  porch('P3', -4, 35, Math.PI, { palette: 2 }),
  porch('P4', 18, 35, Math.PI, { palette: 3 }),
  porch('P5', 46, -2, -Math.PI / 2, { w: 6, d: 5, doorX: -0.6, deckW: 3.6, deckD: 1.8, palette: 4 }),
  porch('P6', HOUSE.x, HOUSE.z, HOUSE.yaw, null, true),
];
/** Porch Row's picket fence (z = its line, the stretches between the cottages; the gaps are gates). */
const ROW_FENCE = { z: 32, stretches: [[-36, -29.6], [-22.4, -16.2], [-13.8, -7.6], [-0.4, 5.8], [8.2, 14.4], [21.6, 27.8], [30.2, 36]] };

// ------------------------------------------------------------------ light groups
let glowSpots = []; // filled by buildWorld (the props register their halos while it builds them)
// Light groups of the merged glow mesh: each lamp, candle and window is one group whose brightness the game sets per
// frame (world.glowLevels -> the glow material's uGlowLv[]; the halos over them read the same level), so a flame
// flickers and gutters in a gust and a window can blink out, all in the one draw. [kind, flicker amount]; group 0 is
// steady (level 1) and holds every untagged glow part. LAMP groups (the porch lamps with their mats, the railings'
// jack-o'-lanterns, the oak's glint) burn steady; the game scales their levels after environment.js has written them
// each frame (the porch logic: a lamp dark on its cooldown, a railing lit once its porch is visited).
export const GLOW = { STEADY: 0, FLAME: 1, WINDOW: 2, BREW: 3, EMBER: 4, LAMP: 5, MAX: 48 };
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
// The props themselves are built by props.js (reusable builders: any position, any level) and placed by village.js.
// The level's random stream draws the graveyard's stones and the v1 trees exactly as it always did (so the graveyard
// and its gate stay as they were); everything new takes its variation from local seeded streams.
const skip = (rnd, n) => { for (let i = 0; i < n; i++) rnd(); };
/** A glow context for the builders: light groups by kind name (use(k): back into group k), halos into glowSpots. */
const glowCtx = (G) => ({
  glow: (kind, amt) => (kind === 'steady' ? ((G.group = 0), 0) : glowGroup(G, { flame: GLOW.FLAME, window: GLOW.WINDOW, brew: GLOW.BREW, ember: GLOW.EMBER, lamp: GLOW.LAMP }[kind], amt)),
  use: (k) => { G.group = k; },
  spot: (...a) => glowSpots.push(a) - 1,
});

// v1's paths and landmarks: only to draw the v1 trees from the level's stream as they were drawn
const V1 = {
  paths: [[[0, 6], [3, -3], [10, -7], [16, -10], [16, -24]], [[0, 6], [-7, 7], [-16, 10], [-26, 15], [-36, 19]], [[0, 6], [-4, -8], [-13, -20], [-24, -30]], [[0, 6], [7, 12], [15, 19], [22, 24]], [[0, 6], [2, 18], [-2, 32], [4, 44]]],
  house: [-31, -37], cauldron: [25, 27], patch: { x0: -47, x1: -12, z0: -3, z1: 42 },
};
/** The trees of the v1 map ({ x, z, s, bark, h, yaw0, lod }): the same draws from the level's stream, in order. */
function v1Trees(rnd, low, graves) {
  const v1Path = (x, z) => { let d = Infinity; for (const L of V1.paths) for (let i = 0; i < L.length - 1; i++) d = Math.min(d, segDist(x, z, L[i][0], L[i][1], L[i + 1][0], L[i + 1][1])); return d; };
  const Q = V1.patch, out = [];
  const ok = (x, z) => v1Path(x, z) > 3 && Math.hypot(x - V1.house[0], z - V1.house[1]) > 10 && Math.hypot(x - V1.cauldron[0], z - V1.cauldron[1]) > 5
    && Math.hypot(x - CRYPT.x, z - CRYPT.z) > 6 && Math.hypot(x, z - 6) > 8 && !(inGraveyard(x, z, 1) && Math.abs(x - 16) < 4)
    && !(x > Q.x0 + 2 && x < Q.x1 - 2 && z > Q.z0 + 2 && z < Q.z1 - 2) && out.every((t) => Math.hypot(t.x - x, t.z - z) > 7);
  const tree = (x, z, s, lod) => { const bark = rnd() < 0.5 ? '#3a2f36' : '#463a3e', h = (2.4 + rnd() * 1.6) * s, yaw0 = rnd() * 6.28; skip(rnd, 95); out.push({ x, z, s, bark, h, yaw0, lod }); };
  for (let tries = 0; out.length < (low ? 16 : 22) && tries < 2000; tries++) {
    const x = (rnd() * 2 - 1) * (PLAY - 3), z = (rnd() * 2 - 1) * (PLAY - 3);
    if (!ok(x, z)) continue;
    if (inGraveyard(x, z, 0) && graves.some((g) => Math.hypot(g.x - x, g.z - z) < 2)) continue;
    tree(x, z, 0.85 + rnd() * 0.5, 1);
  }
  for (let k = 0; k < (low ? 10 : 18); k++) { // the hills outside the fence
    const a = rnd() * Math.PI * 2, r = PLAY + 4 + rnd() * 8;
    tree(Math.cos(a) * r, Math.sin(a) * r, 1.1 + rnd() * 0.6, 0);
  }
  return out;
}
const insideFence = (x, z) => Math.abs(x) < PLAY + 0.5 && Math.abs(z) < PLAY + 0.5;
/** A gnarled dead tree (props.js) from its drawn numbers; a trunk collider inside the fence. */
function plantTree(B, physics, { x, z, s, bark, h, yaw0, lod }) {
  const y = heightAt(x, z) - 0.15;
  // wind sway (the props material, swayPatch): weight 0 at the root rising to 1 at the crown (squared), one phase per tree
  const phase = (x * 0.37 + z * 0.21) % (Math.PI * 2), crown = h * 1.7;
  P.deadTree(B, { x, y, z, h, r: 0.22 * s, phase, crown, seed: P.seedOf(x, z, 3), yaw0, lod, bark });
  if (insideFence(x, z)) physics.addStaticBox(x - 0.28 * s, y - 1, x + 0.28 * s, y + h, z - 0.28 * s, z + 0.28 * s);
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

function crypt(B, G, physics) {
  const { x, z } = CRYPT, y = heightAt(x, z) - 0.15;
  const a = P.crypt(B, G, glowCtx(G), { x, y, z });
  physics.addStaticBox(x - 2.6, y - 1, x + 2.6, y + 4.5, z - 2.3, z + 2.5);
  return a;
}
function cauldron(B, G, physics) {
  const { x, z } = CAULDRON, y = heightAt(x, z);
  const a = P.cauldron(B, G, glowCtx(G), { x, y, z });
  physics.addStaticBox(x - 0.95, y - 1, x + 0.95, y + 1.25, z - 0.95, z + 0.95);
  return a;
}
function scarecrow(B, G, physics) {
  const { x, z } = SCARECROW, y = heightAt(x, z);
  P.scarecrow(B, G, glowCtx(G), { x, y, z });
  physics.addStaticBox(x - 0.3, y - 1, x + 0.3, y + 2.6, z - 0.3, z + 0.3);
}

/** The jack-o'-lantern spots (34, DESIGN.md 3.3): patch chain triangles, the graveyard, the green and spokes, the knoll, the lane and the row, the hollow and the Bale Yard. */
const LANTERNS = [
  [-22, 0], [-20, 3], [-24, 3.5], [-38, 8], [-40, 11], [-36, 12], [-30, 14], [-32, 11], [-28, 11], [-18, 12], // patch
  [12.5, -14], [24, -19], [41, -17], [21, -33], [37, -28], [12, -41], [28, -43],                             // graveyard
  [-10, -2], [6, -6], [9, 13], [-6, 14], [22, 8],                                                            // green, spokes
  [-15.4, -13], [-30, -12], [-10, -30],                                                                       // knoll
  [-14, 26], [4, 26], [30, 24], [-36, 36], [-6, 44], [20, 44],                                               // lane, row
  [30, 16], [44.5, 35.2], [35.2, 44.5],                                                                      // hollow, Bale Yard
];
/** Extra ghost spawn points out in the open (the graves are far from the south half of the map). */
const OPEN_SPAWNS = [[-15, -26], [-30, -30], [-40, 2], [-22, 10], [-28, 42], [6, 42], [28, 44], [44, 14], [26, -2], [-12, -40], [-44, -30], [12, 26], [-20, 26]];

/** The terrain grid: N x N cells plus rows at the creek's edges (its bank walls stand on them, the mesh dips behind). */
function terrainGrid(N) {
  const xs = [], zs = [], C = CREEK;
  const extra = C.depth > C.ford ? [C.z0 - 0.03, C.z0 + C.lip - 0.02, C.z1 - C.lip + 0.02, C.z1 + 0.03] : [];
  for (let i = 0; i <= N; i++) xs.push(-HALF + (2 * HALF * i) / N);
  for (let i = 0; i <= N; i++) { const z = -HALF + (2 * HALF * i) / N; if (extra.every((e) => Math.abs(e - z) > 0.3)) zs.push(z); }
  zs.push(...extra); zs.sort((a, b) => a - b);
  const nx = xs.length, nz = zs.length, pos = new Float32Array(nx * nz * 3), idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pos[k] = xs[i]; pos[k + 2] = zs[j]; }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------------ build
export function buildWorld({ scene, physics, low }) {
  const rnd = mulberry32(2026);
  physics.setHeightfield(heightAt);
  const B = new Batch(), G = new Batch();
  // halos the game draws every frame over static glowing props: [x, y, z, size, r, g, b, flicker 0..1, light group]
  glowSpots = [];
  glowGroups = [[GLOW.STEADY, 0]]; G.group = 0;
  const ctx = glowCtx(G);

  // ---- terrain
  const tg = terrainGrid(low ? 96 : 140);
  {
    const p = tg.attributes.position, c = new Float32Array(p.count * 3);
    const grass = new THREE.Color('#24331f'), grass2 = new THREE.Color('#2f3a1f'), dirt = new THREE.Color('#4a3729'), soil = new THREE.Color('#2a2a2c'), hill = new THREE.Color('#1d2420'), patch = new THREE.Color('#3a3420');
    const bed = new THREE.Color('#1e1a19'), mud = new THREE.Color('#2a2420'), dry = new THREE.Color('#38371f');
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, heightAt(x, z));
      const n = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2) * Math.cos(z * 0.27 - x * 0.05);
      tmp.copy(grass).lerp(grass2, n);
      const kh = knollH(x, z);
      if (kh > 0) tmp.lerp(dry, 0.45 * (kh / KNOLL.h) * (0.6 + 0.4 * n));
      if (inGraveyard(x, z, 2)) tmp.lerp(soil, 0.55 * smooth(1 - Math.max(0, Math.max(GRAVEYARD.x0 - x, x - GRAVEYARD.x1, GRAVEYARD.z0 - z, z - GRAVEYARD.z1)) / 2));
      if (inPatch(x, z, 2)) tmp.lerp(patch, 0.45);
      const pd = pathDist(x, z);
      if (pd < 1.7) tmp.lerp(dirt, smooth((1.7 - pd) / 0.8));
      const ce = Math.min(z - CREEK.z0, CREEK.z1 - z);
      if (ce > -1.2) tmp.lerp(ce > 0.05 ? bed : mud, ce > 0.05 ? 0.92 : 0.5 * smooth((ce + 1.2) / 1.2));
      const r = Math.max(Math.abs(x), Math.abs(z));
      if (r > PLAY) tmp.lerp(hill, smooth((r - PLAY) / 8));
      c[i * 3] = tmp.r; c[i * 3 + 1] = tmp.g; c[i * 3 + 2] = tmp.b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(c, 3));
    tg.computeVertexNormals();
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
  const v1 = v1Trees(rnd, low, graves); // the stream's next draws, as v1 made them (planted below where they still fit)
  const G0 = GRAVEYARD, X = G0.exits, inGap = (v, g) => v > g[0] && v < g[1];
  P.ironFence(B, G0.x0, G0.z1, G0.x1, G0.z1, heightAt, (x, z) => Math.abs(z - G0.z1) < 0.3 && inGap(x, X.s));
  P.ironFence(B, G0.x1, G0.z1, G0.x1, G0.z0, heightAt, (x, z) => Math.abs(x - G0.x1) < 0.3 && inGap(z, X.e));
  P.ironFence(B, G0.x1, G0.z0, G0.x0, G0.z0, heightAt, (x, z) => Math.abs(z - G0.z0) < 0.3 && inGap(x, X.n));
  P.ironFence(B, G0.x0, G0.z0, G0.x0, G0.z1, heightAt, (x, z) => Math.abs(x - G0.x0) < 0.3 && inGap(z, X.w));
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
    P.candleLantern(B, G, x, y, z, gx < 16 ? 0.3 : -0.4);
    glowSpots.push([x, y + 0.2, z, 1.7, 0.55, 0.26, 0.07, 1, gl]);
  }
  G.group = 0;
  const cr = crypt(B, G, physics);
  Object.assign(SECRETS.crypt, { door: cr.door, group: cr.crack, halo: cr.crackHalo });

  // ---- the village (village.js): the porches, the creek and its bridges, the hollow, the Bale Yard, the oak ...
  for (const p of PORCHES) {
    if (p.haunted) V.hauntedPorch(B, G, ctx, physics, heightAt, p, HOUSE);
    else V.porchCottage(B, G, ctx, physics, heightAt, p);
  }
  V.creek(B, G, ctx, physics, heightAt, CREEK, BRIDGES);
  const cd = cauldron(B, G, physics);
  Object.assign(CAULDRON, { brew: cd.brew, brewHalo: cd.brewHalo, ember: cd.ember });
  V.standingStones(B, physics, heightAt, STONES, CAULDRON.x, CAULDRON.z);
  scarecrow(B, G, physics);
  V.baleYard(B, physics, heightAt, BALE_TIERS);
  for (const [x, z, ry] of [[-16, 36, 0.4], [10, 36, 1.2], [30, 38, 0.2], [THIEF_DEN.x, THIEF_DEN.z, 0.1]]) V.hayBale(B, physics, heightAt, x, z, ry);
  { // the thief's burrow: a dark hollow dug under the bale, a mound of earth beside it
    const [dx, dz] = THIEF_DEN.door, y = heightAt(dx, dz);
    B.add(new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2).scale(1.3, 1, 0.8), '#0c0808', dx, y + 0.02, dz - 0.25);
    P.vgrad(B.add(new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 0.35, 0.7), '#3a2c22', dx + 0.9, y - 0.04, dz), 0.6, 1.0);
  }
  const oak = V.hollowOak(B, G, ctx, physics, heightAt, OAK[0], OAK[1]);
  Object.assign(SECRETS.oak, { inside: oak.inside, group: oak.glint, halo: oak.glintHalo });
  V.wellAt(B, physics, heightAt, WELL[0], WELL[1]);
  const toward = (x, z) => Math.atan2(x - SIGNPOST[0], z - SIGNPOST[1]);
  V.signpostAt(B, physics, heightAt, SIGNPOST[0], SIGNPOST[1], [[toward(16, -10), '#d9d2bf'], [toward(-20, -16), '#8a5aa8'], [toward(36, 10), '#5aa84e'], [toward(0, 29), '#d0913c']]);
  V.benchAt(B, physics, heightAt, -17.6, -17.6, 0); // on the rim by the vantage, off the path, facing the village
  V.rowFences(B, physics, heightAt, ROW_FENCE.z, ROW_FENCE.stretches);
  P.pathStones(B, [[-12.6, -9.6], [-17, -15], [-20.8, -16.0]], heightAt);
  // the grave hands' spots: nudged to the nearest spot with no collider within 1 m (a hand never comes up in a stone)
  for (const s of HAND_SPOTS) {
    const free = (x, z) => physics.queryColliders(x, z, 1.0, []).length === 0;
    if (free(s[0], s[1])) continue;
    search: for (let r = 0.5; r <= 3; r += 0.5) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, x = s[0] + Math.cos(a) * r, z = s[1] + Math.sin(a) * r; if (free(x, z)) { s[0] = +x.toFixed(2); s[1] = +z.toFixed(2); break search; } }
  }
  POP_SPOTS[0][2] = heightAt(POP_SPOTS[0][0], POP_SPOTS[0][1]); POP_SPOTS[1][2] = BALE_TIERS[2].top;

  // ---- dead trees: the v1 trees that stand clear of the v2 map, then new ones in the open (their own stream)
  const treeClear = (x, z) => Math.abs(x) < PLAY - 2 && Math.abs(z) < PLAY - 2 && pathDist(x, z) > 3.2
    && !(z > CREEK.z0 - 2.6 && z < CREEK.z1 + 2.6) && !inPatch(x, z, 1) && Math.hypot(x, z - 6) > 9
    && !(inGraveyard(x, z, 1) && Math.abs(x - 16) < 4) && Math.hypot(x - CRYPT.x, z - CRYPT.z) > 6 && Math.hypot(x - HOUSE.x, z - HOUSE.z) > 10.5
    && Math.hypot(x - VANTAGE[0], z - VANTAGE[1]) > 4 && PORCHES.every((p) => p.haunted || Math.abs(x - p.x) > 7 || Math.abs(z - p.z) > 7)
    && !(Math.abs(x) < 38 && z > ROW_FENCE.z - 3 && z < ROW_FENCE.z + 2) && !(x > 34 && z > 34) && Math.hypot(x - CAULDRON.x, z - CAULDRON.z) > 9
    && Math.hypot(x - OAK[0], z - OAK[1]) > 7 && Math.hypot(x - WELL[0], z - WELL[1]) > 3.5 && Math.hypot(x - SIGNPOST[0], z - SIGNPOST[1]) > 3
    && Math.hypot(x - THIEF_DEN.x, z - THIEF_DEN.z) > 4 && LANTERNS.every(([a, b]) => Math.hypot(a - x, b - z) > 2.4)
    && HAND_SPOTS.every(([a, b]) => Math.hypot(a - x, b - z) > 2) && POP_SPOTS.every(([a, b]) => Math.hypot(a - x, b - z) > 3);
  const trees = v1.filter((t) => (insideFence(t.x, t.z) ? treeClear(t.x, t.z) : Math.abs(t.z - (CREEK.z0 + CREEK.z1) / 2) > 4.5));
  {
    const R = mulberry32(4242), want = low ? 16 : 22;
    for (let tries = 0; trees.filter((t) => t.lod && insideFence(t.x, t.z)).length < want && tries < 3000; tries++) {
      const x = (R() * 2 - 1) * (PLAY - 3), z = (R() * 2 - 1) * (PLAY - 3);
      if (!treeClear(x, z) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
      if (inGraveyard(x, z, 0) && graves.some((g) => Math.hypot(g.x - x, g.z - z) < 2)) continue;
      if (physics.queryColliders(x, z, 1.2, []).length) continue;
      const s = 0.85 + R() * 0.5;
      trees.push({ x, z, s, bark: R() < 0.5 ? '#3a2f36' : '#463a3e', h: (2.4 + R() * 1.6) * s, yaw0: R() * 6.28, lod: 1 });
    }
  }
  for (const t of trees) plantTree(B, physics, t);

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
  // one mesh (main pass + shadow pass: two draws). Measured: four tiles (quadrants) drew 6 more calls at the spawn,
  // where they all meet, than they saved elsewhere; Batch.build's `split` is there for a larger map
  const props = B.build(propMat, 'props', heightAt, true);
  props.castShadow = true; props.receiveShadow = true;
  props.customDepthMaterial = makeDepthMaterial(propMat);
  scene.add(props);
  const glowLevels = new Float32Array(GLOW.MAX).fill(1);
  const glowMat = patchGlowGroups(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), glowLevels);
  const glow = G.build(glowMat, 'glow');
  scene.add(glow);
  // each light group's centre (its glowing parts' mean position: a window dims as the camera comes near it, halos())
  const groupPos = new Float32Array(GLOW.MAX * 3);
  {
    const GP = glow.geometry.attributes.position.array, GR = glow.geometry.attributes.grp.array, cnt = new Float32Array(GLOW.MAX);
    for (let i = 0; i < GR.length; i++) { const k = Math.round(GR[i]); groupPos[k * 3] += GP[i * 3]; groupPos[k * 3 + 1] += GP[i * 3 + 1]; groupPos[k * 3 + 2] += GP[i * 3 + 2]; cnt[k]++; }
    for (let k = 0; k < GLOW.MAX; k++) if (cnt[k]) for (let j = 0; j < 3; j++) groupPos[k * 3 + j] /= cnt[k];
  }
  const water = V.creekWater(CREEK, heightAt, WIND.time);
  scene.add(water);
  // the gate: its leaves stand open a0 / a1 (rad from closed, folded inward; built at `open`), through the props material
  const G2 = WIND.gate.value;
  const gate = {
    hinges, open: GATE_OPEN,
    set(a0, a1) { G2[0].set(hinges[0][0], hinges[0][2], a0 - GATE_OPEN, 0); G2[1].set(hinges[1][0], hinges[1][2], -(a1 - GATE_OPEN), 0); },
  };
  gate.set(GATE_OPEN, GATE_OPEN);

  // ---- pumpkin patch: rows of decor pumpkins (instanced) + leaves (only in the patch: elsewhere they read as lanterns)
  const decor = [];
  for (let zz = PATCH.z0 + 1.5; zz < PATCH.z1 - 1; zz += 3.2) {
    for (let xx = PATCH.x0 + 1.5; xx < PATCH.x1 - 1; xx += 1.7) {
      const x = xx + (rnd() - 0.5) * 0.9, z = zz + (rnd() - 0.5) * 0.8;
      if (pathDist(x, z) < 2 || Math.hypot(x - SCARECROW.x, z - SCARECROW.z) < 2 || Math.hypot(x - THIEF_DEN.x, z - THIEF_DEN.z) < 2.5) continue;
      if (LANTERNS.some(([a, b]) => Math.hypot(a - x, b - z) < 1.3)) continue;
      if (rnd() < (low ? 0.45 : 0.3)) continue;
      decor.push([x, z, 0.55 + rnd() * 0.7, rnd() * 6.28, rnd()]);
    }
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

  // ---- grass tufts (crossed blades, instanced): not on the lane, in the patch, in the creek or under a building
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
    const _c0 = [];
    const scatter = (R, upTo) => {
      for (let tries = 0; n2 < upTo && tries < upTo * 4; tries++) {
        const x = (R() * 2 - 1) * (PLAY + 6), z = (R() * 2 - 1) * (PLAY + 6);
        if (pathDist(x, z) < 1.6 || inPatch(x, z, -1) || (z > CREEK.z0 - 0.2 && z < CREEK.z1 + 0.2)) continue;
        _c0.length = 0; if (physics.queryColliders(x, z, 0.08, _c0).length) continue;
        const s = 0.6 + R() * 0.9;
        _q.setFromEuler(_e.set((R() - 0.5) * 0.3, R() * 6.28, 0));
        tufts.setMatrixAt(n2, _m.compose(_p.set(x, heightAt(x, z) - 0.02, z), _q, _s.set(s, s * (0.8 + R() * 0.9), s)));
        tint.setHSL(0.22 + R() * 0.1, 0.45, 0.2 + R() * 0.12); tufts.setColorAt(n2, tint);
        n2++;
      }
    };
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
  // (a spot with a collider within 0.7 m moves to the nearest clear one: two graveyard spots sit by a stone)
  const lanternSpots = LANTERNS.map(([x0, z0]) => {
    for (let r = 0; r <= 2.5; r += 0.35) for (let k = 0; k < (r ? 12 : 1); k++) {
      const x = x0 + Math.cos(k * 0.5236) * r, z = z0 + Math.sin(k * 0.5236) * r;
      if (physics.queryColliders(x, z, 0.7, []).length === 0) return [+x.toFixed(2), +z.toFixed(2)];
    }
    return null;
  }).filter(Boolean);
  const ghostSpawns = graves.map((g) => [g.x, g.z]).concat([[CRYPT.x, CRYPT.z + 3.5]], OPEN_SPAWNS.filter(([x, z]) => physics.queryColliders(x, z, 1.5, []).length === 0));
  // where a light shows the way (porch lamps, lanterns, the bridges' candles): a beacon within 30 m of anywhere on the lane
  const beacons = [
    ...PORCHES.map((p) => { const h = glowSpots[p.halos.lamp]; return [h[0], h[2], 'porch']; }),
    ...lanternSpots.map(([x, z]) => [x, z, 'lantern']),
    ...BRIDGES.flatMap((b) => b.candles.map((c) => [c.x, c.z, 'candle'])),
  ];
  // candy spawns by zone (DESIGN.md 3.5): the lane ring and spokes 30 % (within 2.5 m of the centre line), the graveyard
  // 22 %, the patch 13 %, porch approaches 10 % (within 10 m of a lit mat, on the lane side), the creek's bed 8 %, the
  // knoll 7 %, anywhere 10 %. A spot is drawn in its zone until it is clear (a zone keeps its share).
  const SHARES = [['lane', 0.3], ['graveyard', 0.22], ['patch', 0.13], ['porch', 0.1], ['creek', 0.08], ['knoll', 0.07], ['any', 0.1]];
  const laneSegs = [];
  let laneLen = 0;
  for (const L of PATHS) for (let i = 0; i < L.length - 1; i++) { const l = Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]); laneSegs.push([L[i][0], L[i][1], L[i + 1][0], L[i + 1][1], laneLen, l]); laneLen += l; }
  const C = CREEK, litPorches = [];
  let self = null;
  const sample = (zone, out) => {
    let x, z;
    if (zone === 'lane') {
      const u = rnd() * laneLen;
      let s = laneSegs[0];
      for (let i = 0; i < laneSegs.length; i++) if (u >= laneSegs[i][4]) s = laneSegs[i];
      const f = (u - s[4]) / s[5], o = (rnd() * 2 - 1) * 2.5, dx = (s[2] - s[0]) / s[5], dz = (s[3] - s[1]) / s[5];
      x = s[0] + (s[2] - s[0]) * f - dz * o; z = s[1] + (s[3] - s[1]) * f + dx * o;
    } else if (zone === 'graveyard') { x = GRAVEYARD.x0 + 1 + rnd() * (GRAVEYARD.x1 - GRAVEYARD.x0 - 2); z = GRAVEYARD.z0 + 1 + rnd() * (GRAVEYARD.z1 - GRAVEYARD.z0 - 2); }
    else if (zone === 'patch') { x = PATCH.x0 + rnd() * (PATCH.x1 - PATCH.x0); z = PATCH.z0 + rnd() * (PATCH.z1 - PATCH.z0); }
    else if (zone === 'porch') {
      litPorches.length = 0;
      const lit = self && self.porchLit;
      for (let i = 0; i < PORCHES.length; i++) if (!lit || lit(i)) litPorches.push(i);
      if (!litPorches.length) return false;
      const p = PORCHES[litPorches[Math.floor(rnd() * litPorches.length)]], a = p.yaw + (rnd() * 2 - 1) * 1.3, r = Math.sqrt(1.7 * 1.7 + rnd() * (100 - 1.7 * 1.7));
      x = p.mat.x + Math.sin(a) * r; z = p.mat.z + Math.cos(a) * r;
    } else if (zone === 'creek') { x = (rnd() * 2 - 1) * (C.x - 1.5); z = C.z0 + C.lip + 0.45 + rnd() * (C.z1 - C.z0 - 2 * C.lip - 0.9); }
    else if (zone === 'knoll') { const a = rnd() * Math.PI * 2, r = (KNOLL.r - 1) * Math.sqrt(rnd()); x = KNOLL.x + Math.cos(a) * r; z = KNOLL.z + Math.sin(a) * r; }
    else { x = (rnd() * 2 - 1) * (PLAY - 3); z = (rnd() * 2 - 1) * (PLAY - 3); }
    out[0] = x; out[2] = z;
    return true;
  };
  const _cols = [];
  /** A free spot for a resting candy (inside the fence, clear of colliders, away from (ax, az)), drawn by zone share. */
  const candySpot = (out, ax = 1e9, az = 1e9, minDist = 6) => {
    const k = rnd();
    let zone = 'any', acc = 0;
    for (const [nm, w] of SHARES) { acc += w; if (k < acc) { zone = nm; break; } }
    for (const zz of zone === 'any' ? ['any'] : [zone, 'any']) {
      for (let t = 0; t < (zz === zone ? 40 : 20); t++) {
        if (!sample(zz, out)) break;
        const x = out[0], z = out[2];
        if (Math.abs(x) > PLAY - 2 || Math.abs(z) > PLAY - 2) continue;
        if (zz !== 'creek' && z > C.z0 - 0.5 && z < C.z1 + 0.5) continue; // the bed's candy is its own share
        if ((x - ax) * (x - ax) + (z - az) * (z - az) < minDist * minDist) continue;
        _cols.length = 0;
        if (physics.queryColliders(x, z, 0.6, _cols).length) continue;
        out[1] = heightAt(x, z); candySpot.zone = zz;
        return true;
      }
    }
    return false;
  };
  candySpot.zone = '';
  candySpot.shares = SHARES;

  // crow perches [x, y (the feet), z, yaw] (one crow each, as many as the tier has crows, in this order): the gate
  // finials, the scarecrow's arms, the crypt's ridge, the oak's limbs, the gatekeeper's and Porch Row's roof ridges, the
  // signpost, the tallest standing stone, then the tall stones near the aisle
  const perches = [];
  for (const gx of X.s) perches.push([gx, heightAt(gx, G0.z1) + 2.95, G0.z1, 2.8 + gx * 0.1]);
  { const y = heightAt(SCARECROW.x, SCARECROW.z); perches.push([SCARECROW.x - 0.72, y + 2.0, SCARECROW.z, 0.4], [SCARECROW.x + 0.66, y + 2.0, SCARECROW.z, -2.6]); }
  { const y = heightAt(CRYPT.x, CRYPT.z) - 0.15 + 5.06; perches.push([CRYPT.x - 1.4, y, CRYPT.z, 1.2], [CRYPT.x + 1.1, y, CRYPT.z, -0.5]); }
  perches.push(...oak.perches);
  for (const p of [PORCHES[0], PORCHES[2]]) { const c = Math.cos(p.yaw), s = Math.sin(p.yaw); perches.push([p.x + 1.4 * c, p.floor + 5.36, p.z - 1.4 * s, p.yaw + 1.7]); }
  perches.push([SIGNPOST[0] - 0.02, heightAt(SIGNPOST[0], SIGNPOST[1]) + 2.77, SIGNPOST[1], 2.4]);
  { const [x, z, h] = STONES[2]; perches.push([x, heightAt(x, z) + h - 0.42, z, -1.2]); }
  graves.filter((g) => g.kind < 3).map((g) => [Math.hypot(g.x - 16, g.z + 16) - (g.top - g.y) * 2, g]).sort((a, b) => a[0] - b[0]).slice(0, 7)
    .forEach(([, g], i) => perches.push([g.x, g.top, g.z, g.yaw + (i % 2 ? Math.PI : 0) + 0.6 * Math.sin(i * 3.1)]));
  const groups = glowGroups.map((q) => q.slice()), kinds = new Uint8Array(GLOW.MAX), _camP = new THREE.Vector3(0, 1e4, 0);
  groups.forEach(([kind], k) => { kinds[k] = kind; });
  const bankAt = (x) => Math.max(heightAt(x, C.z0 - 0.05), heightAt(x, C.z1 + 0.05));

  self = {
    terrain, props, glow, pumpkins, leaves, tufts, moon, moonColor, sky, water, lanternSpots, ghostSpawns, graves, candySpot, heightAt, glowSpots, beacons,
    /** Light groups ([kind, flicker amount], see GLOW) and their levels (glowLevels: set per frame by the game; 1). */
    glowGroups: groups, glowLevels, gate, perches,
    // the map v2 (also exported from world.js): the porch logic sets porchLit(i) -> bool (candy near lit mats only)
    porches: PORCHES, bridges: BRIDGES, creek: CREEK, handSpots: HAND_SPOTS, popSpots: POP_SPOTS, secrets: SECRETS, cauldron: CAULDRON, vantage: VANTAGE, thiefDen: THIEF_DEN, knoll: KNOLL,
    paths: PATHS, trees: trees.map((t) => [+t.x.toFixed(2), +t.z.toFixed(2), t.lod]), porchLit: null, zoneOf, pathDist,
    /** Is a kid at (x, y, z) down in the creek's bed (below its banks, not on a bridge)? */
    inCreek(x, y, z) {
      if (C.depth <= C.ford || z < C.z0 + C.lip - 0.1 || z > C.z1 - C.lip + 0.1) return false;
      for (let i = 0; i < BRIDGES.length; i++) if (Math.abs(x - BRIDGES[i].x) < BRIDGES[i].w / 2 + 0.1) return false;
      return y < bankAt(x) - C.depth * 0.5;
    },
    /**
     * The halos over the static glowing props into `glows` from slot `base`, each at its light group's level; first (after
     * the environment has written this frame's levels) a lit window within 16 m of the camera dims toward 45 %: up close
     * the haunted house's bright panes bloomed over the whole view from its porch, a destination now.
     */
    halos(glows, base) {
      const GS = glowSpots, L = glowLevels, c = _camP;
      for (let k = 0; k < groups.length; k++) {
        if (kinds[k] !== GLOW.WINDOW) continue;
        const dx = groupPos[k * 3] - c.x, dy = groupPos[k * 3 + 1] - c.y, dz = groupPos[k * 3 + 2] - c.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 256) L[k] *= 0.45 + 0.55 * smooth((Math.sqrt(d2) - 4) / 12);
      }
      for (let k = 0; k < GS.length; k++) {
        const q = GS[k], f = L[q[8]];
        glows.set(base + k, q[0], q[1], q[2], q[3], q[4] * f, q[5] * f, q[6] * f);
      }
      return GS.length;
    },
    /** Per frame: the sky dressing follows the camera (moon along the atmosphere's moon direction), the water's glint. */
    update(camera, moonDir) {
      const cp = camera.position;
      _camP.copy(cp);
      _moonDir.copy(moonDir).normalize();
      const D = 420, R = 30;
      moon.position.copy(cp).addScaledVector(_moonDir, D);
      moon.lookAt(cp); moon.scale.setScalar(R * MOON_HALO); // the quad holds the halo; the disc is 1 / MOON_HALO of it
      sky.position.set(cp.x, 0, cp.z);
      water.material.uniforms.uMoon.value.copy(_moonDir);
    },
  };
  return self;
}
