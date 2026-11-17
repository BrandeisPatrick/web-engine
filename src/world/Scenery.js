// Scenery: a small, believable place to start a game in, built from what the engine already ships (Furniture,
// Vegetation, PartBuilder, material patches) in one call each. The starters use it; a game replaces it with its level.
//
//   countryRoad({ physics })   a two-lane road along -Z with a lay-by, lane and edge lines, gravel verges, a timber
//                              fence, utility poles with wires, a side track with a name sign, trees and a tree line
//   parkCorner({ physics, lamp, path })   a gravel path, a bench under the lamp, a fence run, rocks, trees, a tree line
//   groundCover({ paths })     a material patch for a flat grass ground: broad patches of lush and dry grass and bare
//                              earth (so one tiled texture stops reading as carpet), and gravel paths / verges
//   paintedLines(lines)        road paint (solid or dashed lines along Z) as one mesh
//
// Each builder returns { group, update(dt, cameraPos, darkness), ... }: add `group` to the scene and call update once a
// frame (tree wind and the near / impostor split). Static colliders go into `physics` when one is given. Everything is
// deterministic for a seed. Cost: about 4 draw calls for the static parts (one merged PartBuilder mesh, the boulders,
// the paint, furniture instances) plus the trees' (one per near species and one for every impostor).
import * as THREE from 'three';
import { PartBuilder } from './Vehicles.js';
import { makeFurnitureGeometry, createFurnitureMaterial, buildSignAtlas, FURNITURE_META } from './Furniture.js';
import { buildTreeMeshes } from './Vegetation.js';
import { mulberry32 } from './geom.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyPatches, weathering } from '../render/MaterialPatches.js';

/** Most path segments a groundCover patch takes (all paths together). */
export const COVER_MAX_SEGMENTS = 24;

const GLSL_COVER = /* glsl */`
uniform vec4 uScSeg[${COVER_MAX_SEGMENTS}];
uniform float uScHalf[${COVER_MAX_SEGMENTS}];
uniform int uScN;
uniform vec4 uScA;   // scale, seed, amount, -
uniform vec3 uScDry, uScLush, uScEarth, uScPath;
float scHash( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.x + p.y ) * p.z ); }
float scNoise( vec2 q, float s ) {
	vec3 x = vec3( q, s ), i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( scHash( i ), scHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( scHash( i + vec3( 0.0, 1.0, 0.0 ) ), scHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y );
}
float scSegD( vec2 p, vec4 s ) { vec2 ab = s.zw - s.xy; float t = clamp( dot( p - s.xy, ab ) / max( dot( ab, ab ), 1e-6 ), 0.0, 1.0 ); return length( p - s.xy - ab * t ); }
`;

/**
 * @typedef {object} CoverPath  a strip of gravel / packed earth on the ground
 * @property {Array<[number, number]>} points  [x, z] polyline (world metres)
 * @property {number} [width=1.6]  full width, metres (the edge is ragged by about 0.3 m)
 */

/**
 * Ground cover for a flat ground material (MeshStandardMaterial, textured or plain): broad patches, tens of metres
 * across, of lush and dry grass and small worn patches of bare earth, plus gravel paths with a ragged, worn edge.
 * World space, no UVs or textures; a few noise lookups and one distance loop per pixel. Install with applyPatches:
 *
 *   applyPatches(ground.material, [groundCover({ paths: [{ points: [[0, 10], [2, -20]], width: 1.8 }] })]);
 *
 * Do not combine with weathering() on the same material (it does the same macro job). Colours are linear multipliers.
 * @param {object} [o]
 * @param {CoverPath[]} [o.paths]  up to COVER_MAX_SEGMENTS segments in all
 * @param {number} [o.scale=1]  patch frequency (2 halves the patches)
 * @param {number} [o.seed=0]
 * @param {number} [o.amount=1]  0 leaves the ground as it was (paths still drawn)
 * @param {number[]} [o.dry=[1.75, 1.4, 0.62]]  dry grass: the albedo's luminance times this
 * @param {number[]} [o.lush=[0.84, 0.92, 0.8]]  lush grass: the albedo times this
 * @param {number[]} [o.earth=[0.13, 0.1, 0.072]]  bare earth albedo
 * @param {number[]} [o.path=[0.2, 0.175, 0.145]]  gravel albedo
 * @returns {object} a material patch (its uniforms can be changed live: patch.uniforms.uScA ...)
 */
export function groundCover(o = {}) {
  const segs = [], half = [];
  for (const p of o.paths || []) {
    for (let i = 0; i + 1 < p.points.length && segs.length < COVER_MAX_SEGMENTS; i++) {
      const [ax, az] = p.points[i], [bx, bz] = p.points[i + 1];
      segs.push(new THREE.Vector4(ax, az, bx, bz)); half.push((p.width ?? 1.6) / 2);
    }
  }
  const n = segs.length;
  while (segs.length < COVER_MAX_SEGMENTS) { segs.push(new THREE.Vector4(0, 0, 0, 0)); half.push(0); }
  const v3 = (a, d) => new THREE.Vector3(...(a || d));
  return {
    key: 'cover',
    worldPosition: true,
    depth: false,
    uniforms: {
      uScSeg: { value: segs }, uScHalf: { value: half }, uScN: { value: n },
      uScA: { value: new THREE.Vector4(o.scale ?? 1, (o.seed ?? 0) % 997, o.amount ?? 1, 0) },
      uScDry: { value: v3(o.dry, [1.75, 1.4, 0.62]) }, uScLush: { value: v3(o.lush, [0.84, 0.92, 0.8]) },
      uScEarth: { value: v3(o.earth, [0.13, 0.1, 0.072]) }, uScPath: { value: v3(o.path, [0.2, 0.175, 0.145]) },
    },
    fragmentPars: GLSL_COVER,
    fragmentSurface: /* glsl */`
	{
		vec2 p = vMpWorld.xz * uScA.x;
		float sd = uScA.y, pw = length( fwidth( vMpWorld ) );
		float n1 = scNoise( p * 0.03, sd ), n2 = scNoise( p * 0.11, sd + 7.0 ), n3 = scNoise( p * 0.42, sd + 3.0 );
		float near = 1.0 - smoothstep( 0.04, 0.15, pw ); // fine grain only where a pixel is small (else it shimmers)
		float fine = mix( 0.5, scNoise( vMpWorld.xz * 7.0, sd + 1.0 ) * 0.6 + scNoise( vMpWorld.xz * 23.0, sd + 5.0 ) * 0.4, near );
		vec3 c = diffuseColor.rgb;
		float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
		float k = uScA.z;
		float dry = smoothstep( 0.5, 0.78, n1 * 0.7 + n2 * 0.3 ) * k;
		float lush = smoothstep( 0.42, 0.18, n1 * 0.65 + n3 * 0.35 ) * k;
		c = mix( c, vec3( lum ) * uScDry, dry * 0.8 );
		c *= mix( vec3( 1.0 ), uScLush, lush );
		float bare = smoothstep( 0.78, 0.9, n2 * 0.55 + n3 * 0.45 ) * ( 1.0 - lush ) * k;
		// paths: distance to the nearest segment edge, ragged; the grass beside them is worn thin
		float d = 1e5;
		for ( int i = 0; i < ${COVER_MAX_SEGMENTS}; i++ ) { if ( i >= uScN ) break; d = min( d, scSegD( vMpWorld.xz, uScSeg[ i ] ) - uScHalf[ i ] ); }
		d += ( n3 - 0.5 ) * 0.4 + ( scNoise( vMpWorld.xz * 2.3, sd + 9.0 ) - 0.5 ) * 0.25;
		float path = 1.0 - smoothstep( -0.06, 0.1, d );
		bare = max( bare, ( 1.0 - smoothstep( 0.0, 0.7, d ) ) * 0.75 );
		c = mix( c, uScEarth * ( 0.7 + 0.6 * fine ) * ( 0.85 + 0.3 * n2 ), bare );
		c = mix( c, uScPath * ( 0.72 + 0.5 * fine ) * ( 0.88 + 0.24 * n3 ), path );
		diffuseColor.rgb = c;
	#if defined( STANDARD ) || defined( PHYSICAL )
		roughnessFactor = mix( roughnessFactor, 1.0, max( path, bare * 0.6 ) );
	#endif
	}
`,
  };
}

/**
 * @typedef {object} PaintedLine  one line of road paint along Z
 * @property {number} x  centre of the line across the road (m)
 * @property {number} from  start z (m)
 * @property {number} to  end z (m)
 * @property {number} [width=0.12]
 * @property {[number, number]} [dash]  [paint, gap] lengths (m); solid when left out
 */

/**
 * Road paint as one mesh of flat quads just above the road (polygon offset, receives shadows): worn off-white.
 * @param {PaintedLine[]} lines
 * @param {{ y?: number, color?: number }} [o]  y: height of the paint (default 0.028; put it above the road surface)
 * @returns {THREE.Mesh}
 */
export function paintedLines(lines, { y = 0.028, color = 0xc9c5ba } = {}) {
  const P = [], I = [];
  const quad = (x0, x1, z0, z1) => {
    const b = P.length / 3;
    P.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    if ((x1 - x0) * (z1 - z0) > 0) I.push(b, b + 2, b + 1, b, b + 3, b + 2); else I.push(b, b + 1, b + 2, b, b + 2, b + 3); // facing up
  };
  for (const L of lines) {
    const w = (L.width ?? 0.12) / 2, s = Math.sign(L.to - L.from) || 1, len = Math.abs(L.to - L.from);
    if (!L.dash) { quad(L.x - w, L.x + w, L.from, L.to); continue; }
    for (let t = 0; t < len; t += L.dash[0] + L.dash[1]) quad(L.x - w, L.x + w, L.from + s * t, L.from + s * Math.min(len, t + L.dash[0]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(P.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(I);
  g.computeBoundingSphere();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true; mesh.name = 'roadPaint';
  return mesh;
}

// ---------------------------------------------------------------------------------------------- shared pieces
const TIMBER = { c: [0.13, 0.112, 0.09], rough: 0.9, metal: 0 }; // weathered, greyed timber
const WIRE = { c: [0.015, 0.015, 0.016], rough: 0.6, metal: 0.3 };

/** A post-and-rail timber fence along a polyline into a PartBuilder; returns the post positions. */
function fenceInto(B, pts, rnd, { spacing = 2.6, height = 1.15, rails = 2, skip = null } = {}) {
  const posts = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / spacing));
    const yaw = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k <= n; k++) {
      if (k === n && i + 2 < pts.length) continue; // the next segment places it
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (skip && skip(x, z)) continue;
      const h = height * (0.95 + rnd() * 0.08), tilt = (rnd() - 0.5) * 0.05;
      B.box(x, h / 2 - 0.05, z, 0.11, h + 0.1, 0.11, TIMBER, { yaw: yaw + (rnd() - 0.5) * 0.3, roll: tilt });
      posts.push([x, z]);
    }
  }
  // rails between neighbouring posts (none across a gap)
  for (let i = 0; i + 1 < posts.length; i++) {
    const [ax, az] = posts[i], [bx, bz] = posts[i + 1], L = Math.hypot(bx - ax, bz - az);
    if (L > spacing * 1.6) continue;
    for (let r = 0; r < rails; r++) {
      const y = height * (rails === 1 ? 0.8 : 0.38 + (0.5 * r) / (rails - 1)) + (rnd() - 0.5) * 0.04;
      B.box((ax + bx) / 2, y, (az + bz) / 2, 0.05, 0.09, L + 0.12, TIMBER, { yaw: Math.atan2(bx - ax, bz - az) });
    }
  }
  return posts;
}

/**
 * A weathered boulder into `rocks` (a list of geometries that rocksMesh merges): a displaced sphere with two or three
 * flat fracture faces, shared vertices so the normals stay smooth after the displacement, half sunk. Vertex colours
 * carry the form: darker in the hollows and in a band at the ground (contact), a little lichen on the up-facing parts.
 * Takes exactly seven numbers from `rnd` (the placements after it depend on that).
 */
function rockInto(rocks, x, z, s, rnd) {
  let g = new THREE.IcosahedronGeometry(1, 7); // 1280 triangles, 642 vertices
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g); // indexed: computeVertexNormals then averages across faces (smooth, no facets)
  const pos = g.getAttribute('position'), v = new THREE.Vector3(), d = new THREE.Vector3();
  const f = [rnd() * 9, rnd() * 9, rnd() * 9], squash = 0.5 + rnd() * 0.2, stretch = 0.85 + rnd() * 0.4;
  const tone = 0.85 + rnd() * 0.3, yaw = rnd() * 6.28, r2 = mulberry32(Math.floor(f[0] * 1e5));
  // fracture planes: a flat-ish top and one or two broken sides (the radius is cut to the plane where it is shorter)
  const planes = [[0, 1, 0, 0.74 + r2() * 0.16]];
  for (let k = 0, n = 1 + Math.floor(r2() * 2); k < n; k++) { const a = r2() * 6.28, e = 0.1 + r2() * 0.5; planes.push([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e), 0.7 + r2() * 0.15]); }
  const hollow = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = Math.sin(v.x * 2.1 + f[0]) * Math.sin(v.y * 2.7 + f[1]) * Math.sin(v.z * 2.3 + f[2]);
    const mid = Math.sin(v.x * 7.1 + v.z * 5.3 + f[1]) * 0.6 + Math.sin(v.y * 9.7 - v.x * 6.1 + f[2]) * 0.4; // knobs and dips
    let m = 1 + 0.2 * n + 0.06 * mid;
    for (const [px, py, pz, o] of planes) { const c = v.x * px + v.y * py + v.z * pz; if (c > 0.05) m = Math.min(m, o / c); }
    hollow[i] = Math.max(0, -mid);
    pos.setXYZ(i, v.x * m * stretch, v.y * m * squash, v.z * m);
  }
  const mat = new THREE.Matrix4().compose(d.set(x, -0.18 * s, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s));
  g.applyMatrix4(mat);
  g.computeVertexNormals();
  // colour: a warm grey that sits with the bare earth and gravel; mottled (two octaves of vertex noise), darker in the
  // hollows and in a band at the ground (contact), pale lichen patches on the up-facing parts
  const nor = g.getAttribute('normal'), col = new Float32Array(pos.count * 3);
  const wn = (px, py, pz, k) => Math.sin(px * k + f[0]) * Math.sin(py * k * 1.3 + f[1]) * Math.sin(pz * k * 0.9 + f[2]);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), h = pos.getY(i), pz = pos.getZ(i), up = nor.getY(i);
    const foot = 0.45 + 0.55 * Math.min(1, Math.max(0, h / (0.18 * s + 0.04)));   // contact: darker near the ground
    const cav = 1 - 0.4 * Math.min(1, hollow[i] * 1.6);
    const mot = 1 + 0.22 * wn(px, h, pz, 9) + 0.14 * wn(pz, px, h, 23);           // mottling at ~30 cm and ~10 cm
    const k = tone * foot * cav * mot;
    const li = Math.min(1, Math.max(0, up - 0.35) * 2.2) * Math.max(0, wn(px, h, pz, 6) * 1.6 + 0.2); // lichen, up faces
    const r = 0.25 * k, gg = 0.205 * k, bb = 0.155 * k;
    col[i * 3] = r + (0.3 - r) * li * 0.4; col[i * 3 + 1] = gg + (0.31 - gg) * li * 0.4; col[i * 3 + 2] = bb + (0.22 - bb) * li * 0.4;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  rocks.push(g);
}

// stone grain: a world-space value-noise bump (pits and grains of a few cm) and a fine albedo speckle, faded out where a
// pixel covers more than ~3 cm (it would only shimmer there). Four noise lookups per rock pixel.
const ROCK_GRAIN = {
  key: 'rockGrain',
  worldPosition: true,
  depth: false,
  fragmentPars: /* glsl */`
float rgHash( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.x + p.y ) * p.z ); }
float rgNoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( rgHash( i ), rgHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( rgHash( i + vec3( 0.0, 1.0, 0.0 ) ), rgHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
		mix( mix( rgHash( i + vec3( 0.0, 0.0, 1.0 ) ), rgHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( rgHash( i + vec3( 0.0, 1.0, 1.0 ) ), rgHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
`,
  fragmentSurface: /* glsl */`
	{
		float pw = length( fwidth( vMpWorld ) ), near = 1.0 - smoothstep( 0.012, 0.035, pw );
		if ( near > 0.0 ) {
			vec3 q = vMpWorld * 24.0;
			float n0 = rgNoise( q ), e = 0.35;
			vec3 gr = vec3( rgNoise( q + vec3( e, 0.0, 0.0 ) ), rgNoise( q + vec3( 0.0, e, 0.0 ) ), rgNoise( q + vec3( 0.0, 0.0, e ) ) ) - n0;
			vec3 gv = ( viewMatrix * vec4( gr / e, 0.0 ) ).xyz;
			normal = normalize( normal - 0.35 * near * ( gv - dot( gv, normal ) * normal ) );
			diffuseColor.rgb *= 1.0 + near * ( n0 - 0.5 ) * 0.45;
		}
	}
`,
};

/** The boulders as one mesh: vertex colours, rough stone, weathering() for the breakup (mottling, dirt at the foot), grain. */
function rocksMesh(rocks) {
  if (!rocks.length) return null;
  const g = mergeGeometries(rocks);
  for (const r of rocks) r.dispose();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  applyPatches(m, [weathering({ scale: 4, macro: 0.3, hue: 0.06, roughness: 0.12, grime: 0.6, grimeHeight: 0.2, grimeColor: [0.45, 0.4, 0.33], streaks: 0, dust: 0.2, seed: 2 }), ROCK_GRAIN]);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'boulders';
  return mesh;
}

/** Furniture instances of one type: [[x, z, yaw], ...]. */
function furniture(type, at, color = 0xffffff) {
  const mesh = new THREE.InstancedMesh(makeFurnitureGeometry(type), createFurnitureMaterial(), at.length);
  const m = new THREE.Matrix4(), c = new THREE.Color(color);
  at.forEach(([x, z, yaw = 0], i) => { mesh.setMatrixAt(i, m.makeRotationY(yaw).setPosition(x, 0, z)); mesh.setColorAt(i, c); });
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** A name blade on a sign post, from the engine's street-sign atlas. */
function nameSign(B, group, name, x, z, yaw) {
  B.box(x, 1.35, z, 0.06, 2.7, 0.06, { c: [0.32, 0.33, 0.34], rough: 0.45, metal: 0.6 });
  const atlas = buildSignAtlas([name]);
  if (!atlas.texture) return;
  const [u0, v0, du, dv] = atlas.nameUV(name), g = new THREE.PlaneGeometry(0.95, 0.2), uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
  const blade = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.45, side: THREE.DoubleSide }));
  blade.position.set(x, 2.55, z); blade.rotation.y = yaw; blade.castShadow = true;
  group.add(blade);
}

/**
 * Trees through buildTreeMeshes: `near` [x, z, scale] as park trees (some get shrubs and grass tufts around them) with
 * the `mix` species, `line` [x, z, scale, hue] as a mixed broadleaf tree line. `keepOut(x, z, r)` true keeps the
 * shrubs and tufts off paths and roads. With `physics` every trunk is a static collider.
 */
function plantTrees(near, line, mix, keepOut, physics) {
  const placements = [
    ...near.map(([x, z, s]) => ({ x, z, s, hue: 0.5, kind: 'park', ctx: { park: 'park' } })),
    ...line.map(([x, z, s, h]) => ({ x, z, s, hue: h, kind: 'park', ctx: { park: 'forest' } })),
  ];
  const colliders = {
    add: (x0, y0, x1, y1, z0, z1) => { if (physics) physics.addStaticBox({ min: [x0, y0, z0], max: [x1, y1, z1], kind: 'tree' }); },
    query: (x, z, r, out) => { out.length = 0; if (keepOut(x, z, r)) out.push(1); return out; },
  };
  const trees = buildTreeMeshes(placements, { seed: 7, colliders, mix: { park: mix, forest: [['oak', 0.45], ['round', 0.3], ['planeB', 0.15], ['cypress', 0.1]] } });
  // a quieter, olive leaf colour than the atlas's (multiplied into every tree material: near models and impostors)
  if (trees.group) trees.group.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.color) m.color.setRGB(0.74, 0.7, 0.54); });
  return trees;
}

function finish(B, group, trees, rocks, extra = {}) {
  const mat = createFurnitureMaterial();
  const mesh = new THREE.Mesh(B.build('furniture'), mat);
  mesh.castShadow = mesh.receiveShadow = true; mesh.name = 'sceneryStatic';
  group.add(mesh);
  const boulders = rocksMesh(rocks);
  if (boulders) group.add(boulders);
  if (trees.group) group.add(trees.group);
  return { group, trees, update: (dt, cameraPos, darkness = 0) => trees.update(dt, cameraPos, darkness), ...extra };
}

/** @typedef {import('../physics/PhysicsWorld.js').PhysicsWorld} PhysicsWorld */

/**
 * @typedef {object} SceneryResult
 * @property {THREE.Group} group  add it to the scene
 * @property {(dt: number, cameraPos: THREE.Vector3, darkness?: number) => void} update  once a frame
 * @property {CoverPath[]} paths  the gravel strips, for groundCover({ paths })
 * @property {{ trees: number, posts: number }} counts
 */

/**
 * A quiet two-lane country road along -Z (x = 0), from `from` to `to`: the asphalt (road and a lay-by on the left near
 * the start, both returned as `surfaces` for a texture set), lane and edge lines (the left edge broken along the
 * lay-by), gravel verges (as `paths` for groundCover), a timber fence on both sides, utility poles with sagging wires on
 * the right, a gravel side track with a name sign, trees near the start, field trees and a tree line on both sides.
 * @param {object} [o]
 * @param {PhysicsWorld} [o.physics]  static colliders for the poles, the sign and the near tree trunks
 * @param {number} [o.width=10]  asphalt width (two 3.5 m lanes and two hard shoulders)
 * @param {number} [o.from=100]
 * @param {number} [o.to=-900]
 * @param {{ from: number, to: number, width: number }} [o.layby={ from: 10, to: -110, width: 7 }]  on the left, with 20 m tapers
 * @param {string} [o.trackName='Mill Lane']
 * @param {number} [o.seed=3]
 * @returns {SceneryResult & { surfaces: Array<{ mesh: THREE.Mesh, uvMetres: boolean, w: number, l: number }> }}
 */
export function countryRoad(o = {}) {
  const W = o.width ?? 10, from = o.from ?? 100, to = o.to ?? -900, hw = W / 2;
  const LB = o.layby || { from: 10, to: -110, width: 7 }, rnd = mulberry32(o.seed ?? 3), physics = o.physics || null;
  const group = new THREE.Group(); group.name = 'countryRoad';
  const B = new PartBuilder();
  // x the set's maps: dry, worn grey. Low over the ground (6 mm, pulled forward in depth so it never fights the field far
  // off): a car's contact shadow (12 mm up) and the paint (10 mm) must sit above it, or the asphalt hides them
  const asphalt = new THREE.MeshStandardMaterial({ color: 0xb4b4b4, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  // asphalt: the road (UVs 0..1 over w x l) and the lay-by, a tapered strip on the left (UVs in metres)
  const road = new THREE.Mesh(new THREE.PlaneGeometry(W, from - to).rotateX(-Math.PI / 2), asphalt);
  road.position.set(0, 0.006, (from + to) / 2);
  const s = new THREE.Shape([[-hw + 0.2, LB.from], [-hw - LB.width, LB.from - 20], [-hw - LB.width, LB.to + 20], [-hw + 0.2, LB.to]].map(([x, z]) => new THREE.Vector2(x, -z)));
  const layby = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), asphalt.clone());
  layby.position.y = 0.004;
  for (const m of [road, layby]) { // patched and resurfaced stretches: world-space breakup over the set's tiles
    applyPatches(m.material, [weathering({ scale: 0.3, macro: 0.14, hue: 0.02, roughness: 0.1, grime: 0, streaks: 0, dust: 0, seed: 5 })]);
    m.receiveShadow = true; group.add(m);
  }
  // paint: dashed centre line, edge lines 0.35 m in from the asphalt edge; the left one broken along the lay-by
  const ex = hw - 0.35;
  group.add(paintedLines([
    { x: 0, from, to, dash: [3, 9], width: 0.12 },
    { x: ex, from, to, width: 0.15 },
    { x: -ex, from, to: LB.from, width: 0.15 }, { x: -ex, from: LB.from, to: LB.to, width: 0.15, dash: [1, 1] }, { x: -ex, from: LB.to, to, width: 0.15 },
  ], { y: 0.01 }));
  // gravel verges (also round the lay-by) and a side track off to the right
  const vx = hw + 0.6, lx = hw + LB.width + 0.6, tz = LB.to + 40;
  const track = [[hw, tz], [12, tz - 6], [30, tz - 20], [80, tz - 32], [160, tz - 38]];
  const paths = [
    { points: [[-vx, from], [-vx, LB.from + 2], [-lx, LB.from - 20], [-lx, LB.to + 20], [-vx, LB.to - 2], [-vx, to]], width: 1.3 },
    { points: [[vx, from], [vx, to]], width: 1.3 },
    { points: track, width: 3 },
  ];
  // timber fences 15 m out on both sides (a gate-wide gap at the track)
  const fz = (z) => z < from - 10 && z > to;
  let posts = fenceInto(B, [[-15, from - 10], [-15, to]], rnd).length;
  posts += fenceInto(B, [[15, from - 10], [15, to]], rnd, { skip: (x, z) => Math.abs(z - (tz - 8)) < 7 }).length;
  // utility poles on the right with three wires and a lower one (the poles are colliders)
  const att = FURNITURE_META.utilityPole.wires, poles = [];
  for (let z = from - 30; z > to; z -= 44) if (fz(z) && Math.abs(z - tz) > 8) poles.push([11, z + (rnd() - 0.5) * 3, (rnd() - 0.5) * 0.08]);
  for (let i = 0; i + 1 < poles.length; i++) {
    const [ax, az] = poles[i], [bx, bz] = poles[i + 1];
    att.forEach(([lx2, ly], w) => {
      const span = Math.abs(bz - az), sag = 0.25 + span * 0.016 + (w === 3 ? 0.3 : 0), pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([ax + lx2 + (bx - ax) * t, ly - sag * 4 * t * (1 - t), az + (bz - az) * t]); }
      B.tube(pts, w === 3 ? 0.02 : 0.012, 3, WIRE);
    });
  }
  group.add(furniture('utilityPole', poles.map(([x, z, yaw]) => [x, z, yaw]), 0xb9b2a4));
  if (physics) for (const [x, z] of poles) physics.addStaticBox({ center: [x, 5.75, z], size: [0.34, 11.5, 0.34], kind: 'post' });
  // the side track's name sign
  nameSign(B, group, o.trackName || 'Mill Lane', hw + 1.6, tz + 5, -Math.PI / 2);
  if (physics) physics.addStaticBox({ center: [hw + 1.6, 1.35, tz + 5], size: [0.12, 2.7, 0.12], kind: 'post' });
  // a few boulders by the lay-by and the verges
  const rocks = [];
  for (const [x, z, sc] of [[-hw - LB.width - 2.2, LB.from - 26, 0.55], [-hw - LB.width - 1.8, LB.from - 31, 0.35], [hw + 2.4, -36, 0.4], [-hw - 2.2, LB.to - 18, 0.5], [hw + 2.8, tz - 9, 0.6]]) rockInto(rocks, x, z, sc, rnd);
  // trees: a few near the start beyond the fences, field trees, and a tree line 150-250 m out on both sides
  // (the low sun is on the left: trees there sit where their swaying shadows miss the first 50 m of road ahead)
  const near = [[-23, 12, 1.1], [-26, 24, 1.2], [-21, -66, 1.25], [-24, -80, 1.05], [20, -10, 1.15], [24, -24, 0.95], [21, tz - 26, 1.2], [19.5, -150, 1.1]];
  for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1; near.push([side * (30 + rnd() * 110), 40 - rnd() * 850, 0.9 + rnd() * 0.5]); }
  const line = [];
  for (let z = from + 150; z > to - 400; z -= 7 + rnd() * 5) for (const side of [-1, 1]) line.push([side * (150 + rnd() * 90 + 30 * Math.sin(z * 0.004 + side)), z, 1 + rnd() * 0.6, rnd()]);
  for (let x = -150; x < 150; x += 8 + rnd() * 4) line.push([x, to - 260 - rnd() * 60, 1 + rnd() * 0.5, rnd()]);
  const trees = plantTrees(near, line, [['oak', 0.5], ['round', 0.3], ['planeB', 0.2]], (x, z, r) => Math.abs(x) < 16 + r, physics);
  return finish(B, group, trees, rocks, {
    paths, counts: { trees: trees.count, posts },
    surfaces: [{ mesh: road, uvMetres: false, w: W, l: from - to }, { mesh: layby, uvMetres: true, w: 1, l: 1 }],
  });
}

/**
 * A corner of a park at dusk around one lamp: a gravel path (as `paths` for groundCover), a bench beside the lamp
 * facing the path, a timber fence run behind it, a few boulders along the path, trees near and far, and a tree line.
 * @param {object} [o]
 * @param {PhysicsWorld} [o.physics]  static colliders for the bench, the fence, the boulders and the near tree trunks
 * @param {[number, number]} [o.lamp=[3, -6]]  the lamp's [x, z]: the bench and fence sit by it
 * @param {Array<[number, number]>} [o.path]  the path's [x, z] polyline (default: past the lamp's left and away)
 * @param {number} [o.seed=5]
 * @returns {SceneryResult}
 */
export function parkCorner(o = {}) {
  const [lx, lz] = o.lamp || [3, -6], rnd = mulberry32(o.seed ?? 5), physics = o.physics || null;
  const path = o.path || [[-1, 16], [0.4, 4], [lx - 1.5, lz + 2], [lx - 1.8, lz - 6], [-1.5, lz - 18], [-6, lz - 32], [-9, lz - 55], [-7, lz - 85]];
  const group = new THREE.Group(); group.name = 'parkCorner';
  const B = new PartBuilder();
  const box = (cx, cy, cz, sx, sy, sz) => physics && physics.addStaticBox({ center: [cx, cy, cz], size: [sx, sy, sz] });
  // a bench under the lamp, facing the path (the seat faces -Z; turned to face -X)
  const bx = lx + 0.45, bz = lz + 2.2;
  group.add(furniture('bench', [[bx, bz, Math.PI / 2]], 0x2f3a30));
  box(bx, 0.45, bz, 0.6, 0.9, 1.8);
  // a timber fence behind the lamp and the bench (the walker cannot pass it)
  const fence = [[lx + 2.4, lz + 14], [lx + 2.2, lz + 2], [lx + 2.9, lz - 10], [lx + 4.5, lz - 20]];
  fenceInto(B, fence, rnd, { rails: 2 });
  for (let i = 0; i + 1 < fence.length; i++) {
    const [ax, az] = fence[i], [cx, cz] = fence[i + 1], L = Math.hypot(cx - ax, cz - az);
    for (let t = 0; t < L; t += 1) box(ax + ((cx - ax) * t) / L, 0.6, az + ((cz - az) * t) / L, 0.3, 1.2, 1.1);
  }
  // boulders beside the path
  const rocks = [], rockAt = [[-1.7, lz - 1.5, 0.55], [-2.5, lz - 2.6, 0.32], [lx + 0.6, lz - 9, 0.45], [-3.6, lz + 9, 0.4], [-4.8, lz - 22, 0.7], [-3.2, lz - 37, 0.5], [lx + 6, lz - 2, 0.8]];
  for (const [x, z, s] of rockAt) { rockInto(rocks, x, z, s, rnd); box(x, s * 0.3, z, s * 1.6, s * 0.6, s * 1.6); }
  // trees: a handful near the path, a loose scatter beyond, and a tree line 130-220 m out
  const near = [[-9, lz - 14, 0.9], [lx + 10, lz - 22, 0.85], [-13, lz + 3, 1.0], [lx + 10, lz + 9, 0.85], [-14, lz - 36, 0.95], [lx + 4, lz - 42, 1.0]];
  const pathDist = (x, z) => Math.min(...path.slice(1).map(([bx2, bz2], i) => {
    const [ax, az] = path[i], dx = bx2 - ax, dz = bz2 - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t);
  }));
  for (let i = 0; i < 40 && near.length < 30; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + rnd() * 90, x = Math.sin(a) * r, z = lz - Math.cos(a) * r;
    if (pathDist(x, z) > 6) near.push([x, z, 0.9 + rnd() * 0.5]);
  }
  const line = [];
  for (let a = 0; a < Math.PI * 2; a += 0.03 + rnd() * 0.02) { const r = 130 + rnd() * 90; line.push([Math.sin(a) * r, lz - Math.cos(a) * r, 1 + rnd() * 0.6, rnd()]); }
  const trees = plantTrees(near, line, [['oak', 0.45], ['round', 0.35], ['planeB', 0.2]], (x, z, r) => pathDist(x, z) < 1.3 + r || Math.hypot(x - bx, z - bz) < 1.5 + r, physics);
  return finish(B, group, trees, rocks, { paths: [{ points: path, width: 1.7 }], counts: { trees: trees.count, posts: 0 } });
}
