// The v2 village of Midnight Candy Run (DESIGN.md 3): builds the map's structures with props.js's builders into the
// level's merged batches (B: the props mesh, G: the glow mesh; ctx: light groups and halos), adds their colliders to
// the PhysicsWorld and fills in the anchors the game reads (porch mats, lamps, chimneys, door hinges, bridge candles,
// the oak's glint). world.js lays the map out and calls these; nothing here reads the level's random stream.
//   colliders  static boxes, axis-aligned: every building is turned by a multiple of 90 degrees so its boxes fit it
//              (a diagonal wall built of box steps traps the kid); the creek's banks and the fences come in pieces of
//              4 m at most (the slide-around assist goes round one piece at a time, as along the graveyard fence)
//   meshes     one of its own: the creek's water (ONE additive mesh: the water strip with ripples and the moon's
//              glint, and low mist wisps over it). Everything else goes into the merged props / glow meshes (no draw
//              call); the porch doors are the porch logic's (porches.js), hinged in each house's doorway.
import * as THREE from 'three';
import * as P from './props.js';

/**
 * A static box for the rectangle lx0..lx1 x lz0..lz1 in the frame of a building at (x, z) turned by yaw (a multiple of
 * 90 degrees, so the box fits exactly), from y0 to y1.
 */
export function localBox(physics, x, z, yaw, lx0, lx1, lz0, lz1, y0, y1) {
  const c = Math.round(Math.cos(yaw)), s = Math.round(Math.sin(yaw));
  let ax = Infinity, bx = -Infinity, az = Infinity, bz = -Infinity;
  for (const [a, b] of [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]]) {
    const px = x + a * c + b * s, pz = z - a * s + b * c;
    ax = Math.min(ax, px); bx = Math.max(bx, px); az = Math.min(az, pz); bz = Math.max(bz, pz);
  }
  return physics.addStaticBox(ax, y0, bx, y1, az, bz);
}
/** The lowest ground under a building's footprint (local half sizes hw, hd) and its front deck. */
function lowest(groundAt, x, z, yaw, hw, hd, front = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let lo = Infinity;
  for (let a = -hw; a <= hw + 1e-6; a += hw / 3) for (let b = -hd; b <= hd + front + 1e-6; b += (hd + front / 2) / 3) lo = Math.min(lo, groundAt(x + a * c + b * s, z - a * s + b * c));
  return lo;
}

// ------------------------------------------------------------------ porches
/**
 * A trick-or-treat cottage for porch p (world.js PORCHES: x, z, yaw, floor, build {w, d, doorX, deckW, deckD, palette,
 * stone}): the house, its colliders (the shell, the deck, the step round it, the two railings) and p's anchors (lamp,
 * railing, chimney, halos; the mat as built).
 */
export function porchCottage(B, G, ctx, physics, groundAt, p) {
  const o = p.build, y = p.floor, { w, d } = o;
  const lo = lowest(groundAt, p.x, p.z, p.yaw, w / 2, d / 2, o.deckD);
  const a = P.cottage(B, G, ctx, { x: p.x, y, z: p.z, yaw: p.yaw, foot: Math.max(0.3, y - lo + 0.35), ...o });
  const D = a.deck, box = (lx0, lx1, lz0, lz1, y1) => localBox(physics, p.x, p.z, p.yaw, lx0, lx1, lz0, lz1, Math.min(lo, y) - 1, y1);
  box(-w / 2 - 0.12, w / 2 + 0.12, -d / 2 - 0.12, d / 2 + 0.02, y + 5.3);
  box(D.x0, D.x1, D.z0, D.z1, a.deckTop);
  box(D.x0 - 0.35, D.x1 + 0.35, D.z0, D.z1 + 0.35, y + 0.15);
  for (const [ra, rb, rz] of D.rails) box(ra - 0.07, rb + 0.07, rz - 0.07, rz + 0.07, a.deckTop + 0.95);
  Object.assign(p, { lamp: a.lamp, railing: a.railing, chimney: a.chimney, halos: { lamp: a.lampHalo, mat: a.matHalo, railing: a.railingHalo, window: a.windowHalo }, window: a.window });
  p.mat.y = a.deckTop;
  return a;
}

/**
 * The haunted house as porch p (P6, trick only) on the knoll: house {w, d}; p.floor its porch's ground. A stone plinth
 * under it down to the slope, its colliders (the house with its tower, the porch deck, a step round it, the two
 * railings), the doormat (its border glows with the porch lamp: a warm white lamp the game drives) and the railing's
 * jack-o'-lantern.
 */
export function hauntedPorch(B, G, ctx, physics, groundAt, p, house) {
  const { w, d } = house, y = p.floor - 0.2, lo = lowest(groundAt, p.x, p.z, p.yaw, w / 2 + 0.7, d / 2, 2.4);
  // (its tower flush with the front: a tower standing out made a corner by the porch that pinned a kid pushing at the
  // facade, 28 s in a bot round)
  const h = P.hauntedHouse(B, G, ctx, { x: p.x, y, z: p.z, w, d, yaw: p.yaw, door: false, lamp: 'lamp', tower: 0 });
  // the plinth: the house stands on the plateau's rim, its back corners over the slope
  P.vgrad(B.add(P.chamferBox(w + 0.6, y - lo + 0.5, d + 0.5, 0.06), '#433e4c', p.x, (lo + y + 0.4) / 2 - 0.15, p.z, p.yaw), 0.5, 0.9);
  const box = (lx0, lx1, lz0, lz1, y1) => localBox(physics, p.x, p.z, p.yaw, lx0, lx1, lz0, lz1, lo - 1, y1);
  const deckTop = y + 0.5, pz = d / 2 + 1.85;
  box(-w / 2 - 0.75, w / 2 + 0.15, -d / 2 - 0.15, d / 2 + 0.02, y + 9); // (the tower reaches 0.6 m past the west wall)
  box(-1.1, 3.5, d / 2, d / 2 + 2.0, deckTop);
  box(-1.45, 3.85, d / 2, d / 2 + 2.75, y + 0.35);
  for (const [a, b] of [[-0.95, 0.35], [2.05, 3.35]]) box(a - 0.08, b + 0.08, pz - 0.08, pz + 0.08, deckTop + 0.95);
  // the doormat on the porch, its glowing border in the lamp's group
  const mat = h.at(1.2, 0.5, d / 2 + 0.85);
  P.doormat(B, G, { x: mat[0], y: deckTop, z: mat[2], yaw: p.yaw, rug: '#3a2232' });
  ctx.use(h.lamp);
  P.doormatGlow(G, { x: mat[0], y: deckTop, z: mat[2], yaw: p.yaw });
  const mh = ctx.spot(mat[0], deckTop + 0.35, mat[2], 2.3, 0.2, 0.16, 0.09, 0.1, h.lamp);
  ctx.glow('steady', 0);
  const jp = h.at(2.36, 1.5, pz);
  const jack = P.jackOLantern(B, G, ctx, { x: jp[0], y: jp[1], z: jp[2], yaw: p.yaw + 0.3, r: 0.16 });
  Object.assign(p, { lamp: h.lamp, railing: jack.group, chimney: h.chimney, halos: { lamp: h.lampHalo, mat: mh, railing: jack.halo, window: -1 }, window: -1 });
  p.mat.y = deckTop;
  return h;
}

// ------------------------------------------------------------------ the creek
/**
 * The creek C (z0..z1 across the map, depth, lip: the bank walls' thickness) with its bridges (each { x, w }): the bank
 * walls in pieces of <= 4 m (a jump clears them, walking out of the bed does not), the footbridges (a solid deck box down
 * to the bed, a railing each side, a candle lantern at each end), rocks and reeds in the bed. With a shallow creek
 * (C.depth <= C.ford, the kill switch) the banks are gentle slopes: no walls. Fills each bridge's { y (deck top), bed,
 * candles } and returns the bridges.
 */
export function creek(B, G, ctx, physics, groundAt, C, bridges) {
  const zc = (C.z0 + C.z1) / 2, walls = C.depth > C.ford;
  const spans = []; // the stretches between bridges
  let from = -(C.x - 0.2);
  for (const b of [...bridges].sort((a, q) => a.x - q.x)) { spans.push([from, b.x - b.w / 2]); from = b.x + b.w / 2; }
  spans.push([from, C.x - 0.2]);
  if (walls) {
    for (const north of [true, false]) {
      const edge = north ? C.z0 - 0.02 : C.z1 + 0.02;
      for (const [s0, s1] of spans) {
        const n = Math.max(1, Math.ceil((s1 - s0) / 4));
        for (let i = 0; i < n; i++) {
          const x0 = s0 + ((s1 - s0) * i) / n, x1 = s0 + ((s1 - s0) * (i + 1)) / n;
          let top = -Infinity, bed = Infinity;
          for (let x = x0; x <= x1 + 1e-6; x += 0.5) { top = Math.max(top, groundAt(x, edge)); bed = Math.min(bed, groundAt(x, zc)); }
          P.bankWall(B, { x0, x1, zf: north ? C.z0 + C.lip : C.z1 - C.lip, dir: north ? 1 : -1, topY: top, bedY: bed });
          physics.addStaticBox(x0, bed - 1, x1, top, north ? C.z0 : C.z1 - C.lip, north ? C.z0 + C.lip : C.z1);
        }
      }
    }
  }
  for (const b of bridges) {
    const hw = b.w / 2;
    let y = -Infinity, bed = Infinity;
    for (const x of [b.x - hw, b.x, b.x + hw]) { y = Math.max(y, groundAt(x, C.z0 - 0.4), groundAt(x, C.z1 + 0.4)); bed = Math.min(bed, groundAt(x, zc)); }
    y += 0.03;
    const r = P.bridge(B, G, ctx, { x: b.x, y, z0: C.z0, z1: C.z1, w: b.w, bedY: bed });
    physics.addStaticBox(b.x - hw, bed - 1, b.x + hw, y, C.z0, C.z1);
    for (const sx of [-1, 1]) physics.addStaticBox(b.x + sx * hw - 0.09, bed - 1, b.x + sx * hw + 0.09, y + 1.06, C.z0 - 0.5, C.z1 + 0.5);
    Object.assign(b, { y, bed, candles: r.candles.map(([group, halo, x, cy, z]) => ({ group, halo, x, y: cy, z })) });
  }
  // rocks along the bed and reeds against the banks (seeded by position: the level's stream is not touched)
  const r = P.rngAt(C.z0, C.z1, 7), clear = (x) => bridges.every((b) => Math.abs(x - b.x) > b.w / 2 + 1.2);
  for (let x = -C.x + 1.5; x < C.x - 1; x += 2.2 + r() * 2.6) {
    if (!clear(x)) continue;
    const z = zc + (r() - 0.5) * (C.z1 - C.z0 - 2 * C.lip - 0.6), y = groundAt(x, z);
    const g = B.add(new THREE.DodecahedronGeometry(0.16 + r() * 0.2, 0), r() < 0.5 ? '#3c3842' : '#47434d', x, y + 0.02, z, r() * 6, r(), 0, 1.3, 0.5, 1);
    P.vgrad(g, 0.5, 1.0, 0.06, (r() * 1e6) | 0);
    if (r() < 0.45) {
      const north = r() < 0.5, rz = north ? C.z0 + C.lip + 0.25 : C.z1 - C.lip - 0.25;
      P.reeds(B, { x: x + (r() - 0.5) * 1.5, y: groundAt(x, rz), z: rz, n: 5 + ((r() * 4) | 0), h: walls ? 1.2 + r() * 0.5 : 0.9 });
    }
  }
  return bridges;
}

const WATER_VS = /* glsl */`
attribute float kind;
varying vec3 vW;
varying float vK;
varying float vE;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz; vK = kind; vE = uv.y;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = /* glsl */`
uniform float uT;
uniform vec3 uMoon;
uniform vec3 uGlint;
varying vec3 vW;
varying float vK;
varying float vE;
#include <fog_pars_fragment>
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float vnoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
void main() {
  vec2 p = vW.xz;
  float edge = smoothstep( 0.0, 0.12, vE ) * smoothstep( 1.0, 0.88, vE ) * smoothstep( 49.8, 48.0, abs( p.x ) );
  vec3 col;
  if ( vK < 0.5 ) {
    // ripples drifting downstream (+x): a perturbed normal; the low moon's glint in it, a cold sheen at grazing angles
    float a = sin( p.x * 3.1 - uT * 1.4 + sin( p.y * 2.3 ) * 1.2 ) + 0.6 * sin( p.x * 1.7 + p.y * 4.3 - uT * 0.9 ) + 0.25 * sin( ( p.x + p.y ) * 7.0 - uT * 2.6 );
    float b = cos( p.y * 5.2 + uT * 1.1 + sin( p.x * 0.8 ) ) + 0.5 * cos( ( p.x - p.y ) * 3.3 - uT * 1.7 );
    vec3 n = normalize( vec3( a * 0.08, 1.0, b * 0.08 ) );
    vec3 v = normalize( cameraPosition - vW );
    float m = max( dot( reflect( - v, n ), uMoon ), 0.0 );
    float fres = pow( 1.0 - max( v.y, 0.0 ), 3.0 );
    col = vec3( 0.006, 0.012, 0.026 ) + vec3( 0.03, 0.045, 0.075 ) * fres + uGlint * ( pow( m, 90.0 ) * 1.6 + pow( m, 14.0 ) * 0.1 );
    float sp = max( 0.0, sin( p.x * 13.0 - uT * 3.0 ) * sin( p.y * 17.0 + uT * 2.2 ) * sin( ( p.x - p.y ) * 9.0 + uT ) );
    col += vec3( 0.22, 0.28, 0.38 ) * pow( sp, 14.0 ) * ( 0.3 + fres );
    col *= edge;
  } else {
    // mist: soft noise drifting downstream, thicker at the middle of the creek
    float m = vnoise( vec2( p.x * 0.32 - uT * ( 0.18 + 0.06 * vK ), p.y * 0.9 + vK * 3.7 ) ) * vnoise( vec2( p.x * 0.11 + vK, p.y * 0.4 - uT * 0.05 ) );
    col = vec3( 0.05, 0.05, 0.08 ) * smoothstep( 0.12, 0.55, m ) * edge * edge;
  }
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogF = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogF = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    col *= 1.0 - fogF;
  #endif
  gl_FragColor = vec4( col, 1.0 );
}`;

/**
 * The creek's water: ONE additive mesh. A strip between the bank walls 0.2 m above the bed (following the bed along x,
 * fence to fence), and two low mist layers over it (attribute kind 0 water, 1..2 mist). uT is the
 * shared wind clock (environment.js advances it), uMoon the moon's direction (world.update sets it).
 */
export function creekWater(C, groundAt, uT) {
  const zc = (C.z0 + C.z1) / 2, pos = [], uv = [], kind = [], idx = [];
  const layers = [[0, C.z0 + C.lip - 0.05, C.z1 - C.lip + 0.05, 0.2], [1, C.z0 + C.lip + 0.2, C.z1 - C.lip - 0.2, 0.6], [2, C.z0 + C.lip + 0.4, C.z1 - C.lip - 0.4, 1.0]];
  const X = C.x - 0.2;
  for (const [k, za, zb, dy] of layers) {
    const base = pos.length / 3;
    let n = 0;
    for (let x = -X; x <= X + 1e-6; x += 2, n++) {
      const y = groundAt(x, zc) + dy;
      pos.push(x, y, za, x, y, zb); uv.push(x, 0, x, 1); kind.push(k, k);
    }
    for (let i = 0; i < n - 1; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const uniforms = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uT, uMoon: { value: new THREE.Vector3(0, 0.2, -1).normalize() }, uGlint: { value: new THREE.Color(0.75, 0.8, 1.0) } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'creekWater'; mesh.renderOrder = 4; mesh.frustumCulled = true;
  return mesh;
}

// ------------------------------------------------------------------ the rest of the village
/** The Bale Yard's tiers (each { x0, x1, z0, z1, h }: a block of stacked bales; one collider each; fills t.top). */
export function baleYard(B, physics, groundAt, tiers) {
  for (const t of tiers) {
    const x = (t.x0 + t.x1) / 2, z = (t.z0 + t.z1) / 2, lo = Math.min(groundAt(t.x0, t.z0), groundAt(t.x1, t.z0), groundAt(t.x0, t.z1), groundAt(t.x1, t.z1));
    const g = groundAt(x, z);
    P.baleBlock(B, { x, y: lo, z, w: t.x1 - t.x0, h: g + t.h - lo, d: t.z1 - t.z0, course: (g + t.h - lo) / Math.max(1, Math.round((g + t.h - lo) / 0.36)) });
    physics.addStaticBox(t.x0, lo - 1, t.x1, g + t.h, t.z0, t.z1);
    t.top = g + t.h;
  }
}

/** Standing stones ([x, z, h]) round the cauldron: each faces the centre (cx, cz); a 0.8 x 0.8 m collider each. */
export function standingStones(B, physics, groundAt, stones, cx, cz) {
  for (const [x, z, h] of stones) {
    const y = groundAt(x, z);
    P.standingStone(B, { x, y, z, h, yaw: Math.atan2(cx - x, cz - z) });
    physics.addStaticBox(x - 0.4, y - 1, x + 0.4, y + h - 0.2, z - 0.4, z + 0.4);
  }
}

/**
 * The hollow oak at (x, z) with its opening toward the south-east: four colliders round a 1.9 m hollow (walls 0.5 m
 * thick), the south-east corner open (a 1.3 m way in: the kid walks in and out). Returns the oak's anchors.
 */
export function hollowOak(B, G, ctx, physics, groundAt, x, z) {
  const y = groundAt(x, z), top = y + 4;
  const a = P.hollowOak(B, G, ctx, { x, y, z, open: Math.PI / 4 });
  const I = 0.95, O = 1.45;
  physics.addStaticBox(x - O, y - 1, x + O, top, z - O, z - I);       // north
  physics.addStaticBox(x - O, y - 1, x - I, top, z - I, z + O);       // west
  physics.addStaticBox(x - I, y - 1, x - 0.05, top, z + I, z + O);    // south (west half)
  physics.addStaticBox(x + I, y - 1, x + O, top, z - I, z - 0.05);    // east (north half)
  return a;
}

/** Picket fences along z = at between the x stretches given ([x0, x1], ...), 1 m high (a jump clears them). */
export function rowFences(B, physics, groundAt, at, stretches) {
  for (const [x0, x1] of stretches) {
    P.pickets(B, x0, at, x1, at, groundAt, 1.0);
    const n = Math.max(1, Math.ceil((x1 - x0) / 4));
    for (let i = 0; i < n; i++) {
      const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n;
      let top = -Infinity; for (let x = a; x <= b + 1e-6; x += 0.5) top = Math.max(top, groundAt(x, at));
      physics.addStaticBox(a, top - 5, b, top + 1.0, at - 0.1, at + 0.1);
    }
  }
}

/** A round hay bale lying at (x, z) along ry, with its collider. */
export function hayBale(B, physics, groundAt, x, z, ry) {
  const y = groundAt(x, z);
  P.hayBale(B, { x, y, z, ry });
  physics.addStaticBox(x - 0.65, y - 1, x + 0.65, y + 1.1, z - 0.65, z + 0.65);
}

/** The well at (x, z) (a 2.2 m collider round its ring), the signpost at (sx, sz) with its arms, the vantage bench. */
export function wellAt(B, physics, groundAt, x, z) {
  const y = groundAt(x, z);
  P.well(B, { x, y, z, yaw: 0.5 });
  physics.addStaticBox(x - 1.1, y - 1, x + 1.1, y + 0.95, z - 1.1, z + 1.1);
}
export function signpostAt(B, physics, groundAt, x, z, arms) {
  const y = groundAt(x, z);
  P.signpost(B, { x, y, z, arms });
  physics.addStaticBox(x - 0.15, y - 1, x + 0.15, y + 2.7, z - 0.15, z + 0.15);
}
export function benchAt(B, physics, groundAt, x, z, yaw) {
  const y = groundAt(x, z);
  P.bench(B, { x, y, z, yaw });
  const c = Math.abs(Math.cos(yaw)) > 0.7;
  physics.addStaticBox(x - (c ? 0.9 : 0.35), y - 1, x + (c ? 0.9 : 0.35), y + 0.5, z - (c ? 0.35 : 0.9), z + (c ? 0.35 : 0.9));
}
