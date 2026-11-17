// Reusable onBeforeCompile patches for built-in three.js materials (MeshStandardMaterial, MeshLambertMaterial,
// MeshDepthMaterial, ...), composable on one material:
//   windSway    world-space sway of foliage / flags / cables: weight from object height, an attribute or GLSL
//   ditherFade  screen-space dithered distance fade-out ('out') or fade-in ('in'); an 'out' and an 'in'
//               material with the same start/end cross-fade with complementary dither (near model <-> impostor),
//               so LOD transitions never pop and never double-blend
//   weathering  surface breakup in world space for MeshStandardMaterial walls and props: macro value / hue / roughness
//               variation, dirt rising from the ground, rain streaks, dust on ledges, sun fading, paint chips
//               (GLSL_WEATHERING: the same as a GLSL library for custom shaders; bakeWeathering: into vertex colours)
//   time / view uniforms shared by any number of materials (createTimeUniforms / updateTimeUniforms)
//
//   applyPatches(wallMaterial, [weathering({ grime: 0.4, streaks: 0.35 })]);   // non-flat walls in one line
//
//   const U = createTimeUniforms();                       // { uTime, uViewPos } shared objects
//   const mat = applyPatches(new THREE.MeshStandardMaterial({ color }), [
//     windSway(U, { strength: 0.3, weight: 'height', height: 6 }),
//     ditherFade(U, { start: 150, end: 185, mode: 'out' }),
//   ]);
//   mesh.customDepthMaterial = makeDepthMaterial(mat);   // shadows sway / fade the same way
//   per frame: updateTimeUniforms(U, dt, camera.position)  (allocation-free)
//
// Displacements are applied after the instance matrix and before the model matrix (InstancedMesh-friendly;
// world space for meshes at the scene root). `mpInstancePos` (world position of the instance / object origin)
// is available to every patch for per-instance phase and distance.
import * as THREE from 'three';

/** Interleaved gradient noise (stable per pixel), 0..1. Used for dithered fades. */
export const GLSL_IGN = /* glsl */'float mpIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }\n';
/** Cheap 2D hash, 0..1 (per-instance phase / jitter). */
export const GLSL_HASH = /* glsl */'float mpHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }\n';

/** Shared uniform objects: uTime (s) and uViewPos (camera world position). */
export function createTimeUniforms() {
  return { uTime: { value: 0 }, uViewPos: { value: new THREE.Vector3(0, -1e6, 0) } };
}
/** Advance uTime by dt (or set it with `time`), copy the camera position. Allocation-free. */
export function updateTimeUniforms(U, dt, cameraPos, time) {
  U.uTime.value = Number.isFinite(time) ? time : U.uTime.value + (dt || 0);
  if (cameraPos && U.uViewPos) U.uViewPos.value.copy(cameraPos);
}

/**
 * Wind sway.
 * @param {object} U  shared uniforms with uTime
 * @param {object} [o]
 * @param {number} [o.strength=1]  displacement scale (m at weight 1)
 * @param {number} [o.frequency=1] time scale
 * @param {number[]} [o.direction=[0.8, 0.6]] prevailing wind direction (xz)
 * @param {'height'|string} [o.weight='height']  'height': (position.y / height)^2 (object space; 0 at the base),
 *   'attr:name.c': an attribute component (e.g. 'attr:veg.x'), or any GLSL float expression
 * @param {number} [o.height=1]  object-space height that reaches weight 1 (weight 'height')
 * @param {number} [o.flutter=0] small high-frequency jitter amplitude (m)
 * Returns a patch; patch.uniforms.uWind.value = Vector4(dirX, dirZ, strength, frequency) can be animated.
 */
export function windSway(U, o = {}) {
  const dir = o.direction || [0.8, 0.6], l = Math.hypot(dir[0], dir[1]) || 1;
  const uWind = { value: new THREE.Vector4(dir[0] / l, dir[1] / l, o.strength ?? 1, o.frequency ?? 1) };
  const uWindB = { value: new THREE.Vector4(1 / (o.height ?? 1), o.flutter ?? 0, 0, 0) };
  const w = o.weight ?? 'height';
  let attrDecl = '', weightExpr;
  if (w === 'height') weightExpr = 'pow( clamp( position.y * uWindB.x, 0.0, 1.0 ), 2.0 )';
  else if (w.startsWith('attr:')) {
    const [name, comp] = w.slice(5).split('.');
    attrDecl = `attribute vec4 ${name};\n`;
    weightExpr = `${name}.${comp || 'x'}`;
  } else weightExpr = w;
  return {
    key: `wind(${w})`,
    uniforms: { uTime: U.uTime, uWind, uWindB },
    depth: true,
    vertexPars: `uniform float uTime;\nuniform vec4 uWind;\nuniform vec4 uWindB;\n${attrDecl}`,
    vertexBegin: /* glsl */`
	{
		float mpW = ${weightExpr};
		if ( mpW > 0.0 ) {
			float t = uTime * uWind.w, ph = mpHash( mpInstancePos.xz ) * 6.2831853;
			vec2 dirW = uWind.xy;
			float g = 0.55 + 0.45 * sin( t * 0.33 + mpInstancePos.x * 0.004 + mpInstancePos.z * 0.003 );
			float s1 = sin( t * 1.2 + ph ) * 0.6 + sin( t * 2.3 + ph * 1.7 ) * 0.25;
			float s2 = cos( t * 1.05 + ph * 2.1 ) * 0.35;
			mpOffset.xz += ( dirW * ( 0.35 + s1 ) + vec2( - dirW.y, dirW.x ) * s2 ) * g * mpW * uWind.z;
			mpOffset.y -= abs( s1 ) * mpW * g * 0.12 * uWind.z;
			if ( uWindB.y > 0.0 ) mpOffset += vec3( 0.6, 1.0, - 0.45 ) * sin( t * 6.3 + dot( position, vec3( 17.0, 31.0, 23.0 ) ) + ph ) * uWindB.y * mpW;
		}
	}
`,
  };
}

/**
 * Dithered distance fade (per instance, by the distance from uViewPos to the instance origin).
 * mode 'out': visible near, gone beyond `end`. mode 'in': invisible before `start`, solid beyond `end`.
 * Fully faded instances collapse to a point in the vertex shader (no fragment cost).
 * Returns a patch; patch.uniforms.uFade.value = Vector4(start, end, mode 0|1, -) can be changed live.
 */
export function ditherFade(U, o = {}) {
  const uFade = { value: new THREE.Vector4(o.start ?? 100, o.end ?? 120, o.mode === 'in' ? 1 : 0, 0) };
  return {
    key: 'dither',
    uniforms: { uViewPos: U.uViewPos, uFade },
    depth: true,
    vertexPars: 'uniform vec3 uViewPos;\nuniform vec4 uFade;\nvarying float vMpFade;\n',
    vertexBegin: /* glsl */`
	{
		float s = smoothstep( uFade.x, uFade.y, distance( uViewPos, mpInstancePos ) );
		vMpFade = uFade.z > 0.5 ? s : 1.0 - s;
		if ( vMpFade <= 0.0 ) { transformed = vec3( 0.0 ); mpCollapsed = true; }
	}
`,
    fragmentPars: 'uniform vec4 uFade;\nvarying float vMpFade;\n',
    fragmentDiscard: /* glsl */`
	if ( vMpFade < 0.999 ) {
		float n = mpIGN( gl_FragCoord.xy );
		if ( uFade.z > 0.5 ? n <= 1.0 - vMpFade : n > vMpFade ) discard;
	}
`,
  };
}

/**
 * GLSL library of the weathering patch, for shaders that are not a patched built-in material (a custom facade
 * shader, a terrain) and want the same look: wxHash / wxNoise (3D value noise, 0..1) and
 *   void wxWeather(inout vec3 albedo, inout float rough, vec3 worldPos, vec3 worldNormal, float heightAboveGround,
 *                  float pixelMetres, vec4 A, vec4 B, vec4 C, vec3 grimeColor, vec3 chipColor)
 * with A = (macro, hue, roughness, scale), B = (grime, grimeHeight, streaks, 1 / streakLength),
 * C = (fade, chips, dust, seed): what weatheringUniforms(options) packs.
 */
export const GLSL_WEATHERING = /* glsl */`
float wxHash( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.x + p.y ) * p.z ); }
float wxNoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( wxHash( i ), wxHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( wxHash( i + vec3( 0.0, 1.0, 0.0 ) ), wxHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
		mix( mix( wxHash( i + vec3( 0.0, 0.0, 1.0 ) ), wxHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( wxHash( i + vec3( 0.0, 1.0, 1.0 ) ), wxHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
void wxWeather( inout vec3 col, inout float rough, vec3 p, vec3 n, float h, float pw, vec4 A, vec4 B, vec4 C, vec3 grimeCol, vec3 chipCol ) {
	float s = A.w, sd = C.w * 17.31;
	vec3 q = p * s;
	float m1 = wxNoise( q * 0.29 + sd ), m2 = wxNoise( q * 1.07 + sd + 11.7 );
	float m = 0.65 * m1 + 0.35 * m2;
	float wall = 1.0 - smoothstep( 0.55, 0.9, abs( n.y ) );
	// macro variation: value at two scales, a slight warm / cool drift, roughness
	col *= 1.0 + A.x * ( m - 0.5 ) * 2.0;
	col *= 1.0 + A.y * ( m2 - 0.5 ) * 2.0 * vec3( 1.0, 0.15, - 0.9 );
	rough += A.z * ( ( m2 - 0.5 ) * 1.4 + ( m1 - 0.5 ) * 0.8 );
	// mottling at hand scale (~30 cm), faded out where a pixel is over ~5 cm (it would only shimmer)
	float mot = 1.0 - smoothstep( 0.02, 0.06, pw );
	if ( mot > 0.0 ) col *= 1.0 + A.x * 0.45 * ( wxNoise( q * 3.3 + sd + 5.3 ) - 0.5 ) * 2.0 * mot;
	// sun fading: patchy, paler and greyer, more on the upper parts
	if ( C.x > 0.0 ) {
		float l = dot( col, vec3( 0.299, 0.587, 0.114 ) );
		float fd = C.x * smoothstep( 0.3, 0.75, m1 ) * ( 0.6 + 0.4 * smoothstep( 1.0, 8.0, h ) );
		col = mix( col, vec3( l ) * 1.05 + 0.015, fd );
	}
	// rain streaks on walls: columns of runs along the wall, broken up along their length
	if ( B.z > 0.0 && wall > 0.0 ) {
		vec2 t = normalize( vec2( - n.z, n.x ) + 1e-5 );
		float u = dot( p.xz, t ) * s, y = p.y * s * B.w;
		float c1 = wxNoise( vec3( u * 2.7, y * 0.6, sd + 3.1 ) ), c2 = wxNoise( vec3( u * 8.5, y * 1.9, sd + 7.9 ) );
		float gate = smoothstep( 0.4, 0.75, wxNoise( vec3( u * 0.42, y * 0.18, sd + 1.3 ) ) );
		float st = smoothstep( 0.52, 0.85, c1 * 0.68 + c2 * 0.42 ) * gate * wall * B.z;
		col *= mix( vec3( 1.0 ), grimeCol, st );
		rough += st * 0.08;
	}
	// grime rising from the ground (ragged top, patchy)
	if ( B.x > 0.0 && h < B.y * 1.45 ) {
		float e = wxNoise( vec3( p.x * s * 1.9, p.z * s * 1.9, sd + 5.0 ) );
		float g = 1.0 - smoothstep( 0.0, B.y * ( 0.5 + 0.9 * e ), h );
		g *= ( 0.7 + 0.6 * m1 ) * mix( 0.35, 1.0, wall );
		g = clamp( g * B.x, 0.0, 1.0 );
		col *= mix( vec3( 1.0 ), grimeCol, g );
		rough = mix( rough, 1.0, g * 0.4 );
	}
	// dust and dirt settled on up-facing faces (ledges, sills, tops)
	if ( C.z > 0.0 ) {
		float up = smoothstep( 0.6, 0.95, n.y ) * C.z * ( 0.45 + 0.8 * m2 );
		col = mix( col, col * grimeCol * 0.9, clamp( up, 0.0, 1.0 ) );
		rough = mix( rough, 1.0, up * 0.5 );
	}
	// chips: small spots where the paint is gone (only where a pixel is under ~2 cm)
	if ( C.y > 0.0 ) {
		float near = 1.0 - smoothstep( 0.006, 0.025, pw );
		if ( near > 0.0 ) {
			float c = wxNoise( q * 7.0 + sd + 2.0 ) * 0.62 + wxNoise( q * 23.0 + sd ) * 0.38;
			float th = 0.86 - 0.1 * C.y * m1;
			float chip = smoothstep( th, th + 0.015, c ) * near * min( 1.0, C.y * 1.5 );
			col = mix( col, chipCol, chip * 0.85 );
			rough = mix( rough, 0.95, chip );
		}
	}
	rough = clamp( rough, 0.04, 1.0 );
}
`;

/** Defaults of weathering(): realistic and restrained, painted render / concrete outdoors. */
export const WEATHERING_DEFAULTS = Object.freeze({
  seed: 0, scale: 1, macro: 0.12, hue: 0.03, roughness: 0.1, grime: 0.35, grimeHeight: 1.0, grimeColor: [0.58, 0.53, 0.45],
  ground: 0, streaks: 0.3, streakLength: 3, fade: 0, chips: 0, chipColor: [0.62, 0.6, 0.56], dust: 0.25,
});

/**
 * @typedef {object} WeatheringOptions
 * @property {number} [seed=0]          pattern seed: two materials with different seeds weather differently
 * @property {number} [scale=1]         noise frequency multiplier (1: blotches ~3 m and ~1 m across; 2 halves them)
 * @property {number} [macro=0.12]      albedo value variation, +- fraction (breaks flat walls and texture tiling)
 * @property {number} [hue=0.03]        warm / cool colour drift, +- fraction
 * @property {number} [roughness=0.1]   roughness variation (added, +-)
 * @property {number} [grime=0.35]      dirt rising from the ground, 0..1 (how far albedo goes to grimeColor)
 * @property {number} [grimeHeight=1]   how high the dirt reaches, metres (ragged)
 * @property {number[]} [grimeColor=[0.58, 0.53, 0.45]]  linear multiplier for dirt, streaks and dust
 * @property {number|'origin'} [ground=0]  ground height (world y) for the grime; 'origin': the object's / instance's
 *   origin (props standing on their origin)
 * @property {number} [streaks=0.3]     vertical rain streaks on walls, 0..1
 * @property {number} [streakLength=3]  typical streak length, metres
 * @property {number} [fade=0]          sun fading: patchy paler, greyer paint, 0..1
 * @property {number} [chips=0]         chipped paint spots showing chipColor (near the camera only), 0..1
 * @property {number[]} [chipColor=[0.62, 0.6, 0.56]]  linear albedo under the paint (render, primer)
 * @property {number} [dust=0.25]       dirt on up-facing faces (ledges, sills), 0..1
 */

/**
 * Pack weathering options into the vectors the GLSL takes (wxWeather's A, B, C, grime and chip colours, ground).
 * @param {WeatheringOptions} [o]
 */
export function weatheringUniforms(o = {}) {
  const k = { ...WEATHERING_DEFAULTS, ...o };
  return {
    uWxA: { value: new THREE.Vector4(k.macro, k.hue, k.roughness, k.scale) },
    uWxB: { value: new THREE.Vector4(k.grime, k.grimeHeight, k.streaks, 1 / Math.max(0.1, k.streakLength)) },
    uWxC: { value: new THREE.Vector4(k.fade, k.chips, k.dust, k.seed % 1000) },
    uWxGrime: { value: new THREE.Vector3(...k.grimeColor) },
    uWxChip: { value: new THREE.Vector3(...k.chipColor) },
    uWxGround: { value: new THREE.Vector2(k.ground === 'origin' ? 0 : k.ground, k.ground === 'origin' ? 1 : 0) },
  };
}

/**
 * Weathering: surface breakup for any MeshStandardMaterial / MeshPhysicalMaterial (Lambert / Phong: albedo only), in
 * world space so it needs no UVs and no texture: macro value / hue / roughness variation at two scales, dirt rising
 * from the ground, rain streaks down walls, dust on ledges, optional sun fading and paint chips. Composes with the
 * other patches (applyPatches). Costs a few 3D value-noise lookups per pixel (no texture, no extra pass).
 *
 *   applyPatches(wallMaterial, [weathering({ grime: 0.4, streaks: 0.35 })]);
 *
 * Returns a patch; its uniforms (patch.uniforms.uWxA ... ) can be changed live, see weatheringUniforms.
 * @param {WeatheringOptions} [o]
 */
export function weathering(o = {}) {
  const uniforms = weatheringUniforms(o);
  return {
    key: 'weather',
    worldPosition: true,
    uniforms,
    depth: false,
    fragmentPars: `uniform vec4 uWxA;\nuniform vec4 uWxB;\nuniform vec4 uWxC;\nuniform vec3 uWxGrime;\nuniform vec3 uWxChip;\nuniform vec2 uWxGround;\n${GLSL_WEATHERING}`,
    fragmentSurface: /* glsl */`
	{
		vec3 wxN = normalize( ( vec4( nonPerturbedNormal, 0.0 ) * viewMatrix ).xyz );
		float wxH0 = mix( uWxGround.x, vMpOrigin.y, uWxGround.y );
		float wxR = 0.5;
	#if defined( STANDARD ) || defined( PHYSICAL )
		wxR = roughnessFactor;
	#endif
		wxWeather( diffuseColor.rgb, wxR, vMpWorld, wxN, vMpWorld.y - wxH0, length( fwidth( vMpWorld ) ), uWxA, uWxB, uWxC, uWxGrime, uWxChip );
	#if defined( STANDARD ) || defined( PHYSICAL )
		roughnessFactor = wxR;
	#endif
	}
`,
  };
}

// ---- CPU twin of the GLSL (same hash and noise in float64; matches the shader to a few 1e-3): bake weathering into
// vertex colours (phones, far LODs, merged props) or sample it in tests
const fract = (x) => x - Math.floor(x);
function wxHashJS(x, y, z) {
  let px = fract(x * 0.1031), py = fract(y * 0.103), pz = fract(z * 0.0973);
  const d = px * (py + 33.33) + py * (px + 33.33) + pz * (pz + 33.33);
  px += d; py += d; pz += d;
  return fract((px + py) * pz);
}
function wxNoiseJS(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t, H = (a, b, c) => wxHashJS(ix + a, iy + b, iz + c);
  return L(L(L(H(0, 0, 0), H(1, 0, 0), fx), L(H(0, 1, 0), H(1, 1, 0), fx), fy), L(L(H(0, 0, 1), H(1, 0, 1), fx), L(H(0, 1, 1), H(1, 1, 1), fx), fy), fz);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The weathering at one point, on the CPU: { mul: [r, g, b] albedo multiplier, rough: roughness delta } for a surface
 * at world `p` with world normal `n`, `h` metres above the ground (chips are left out: they are a near-camera detail).
 * Deterministic: the same options and point give the same result.
 * @param {WeatheringOptions} o
 * @param {number[]} p  [x, y, z]
 * @param {number[]} n  [x, y, z] unit normal
 * @param {number} h   height above the ground
 */
export function weatheringAt(o, p, n, h) {
  const k = { ...WEATHERING_DEFAULTS, ...o };
  const s = k.scale, sd = (k.seed % 1000) * 17.31;
  const qx = p[0] * s, qy = p[1] * s, qz = p[2] * s;
  const m1 = wxNoiseJS(qx * 0.29 + sd, qy * 0.29 + sd, qz * 0.29 + sd), m2 = wxNoiseJS(qx * 1.07 + sd + 11.7, qy * 1.07 + sd + 11.7, qz * 1.07 + sd + 11.7);
  const m = 0.65 * m1 + 0.35 * m2, wall = 1 - smooth(0.55, 0.9, Math.abs(n[1]));
  const v = 1 + k.macro * (m - 0.5) * 2, hd = k.hue * (m2 - 0.5) * 2;
  let col = [v * (1 + hd), v * (1 + hd * 0.15), v * (1 - hd * 0.9)];
  let rough = k.roughness * ((m2 - 0.5) * 1.4 + (m1 - 0.5) * 0.8);
  const G = k.grimeColor, mix3 = (t) => [1 + (G[0] - 1) * t, 1 + (G[1] - 1) * t, 1 + (G[2] - 1) * t];
  const mul = (a) => { col = [col[0] * a[0], col[1] * a[1], col[2] * a[2]]; };
  if (k.streaks > 0 && wall > 0) {
    let tx = -n[2], tz = n[0]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const u = (p[0] * tx + p[2] * tz) * s, y = p[1] * s / Math.max(0.1, k.streakLength);
    const c1 = wxNoiseJS(u * 2.7, y * 0.6, sd + 3.1), c2 = wxNoiseJS(u * 8.5, y * 1.9, sd + 7.9);
    const st = smooth(0.52, 0.85, c1 * 0.68 + c2 * 0.42) * smooth(0.4, 0.75, wxNoiseJS(u * 0.42, y * 0.18, sd + 1.3)) * wall * k.streaks;
    mul(mix3(st)); rough += st * 0.08;
  }
  if (k.grime > 0) {
    const e = wxNoiseJS(p[0] * s * 1.9, p[2] * s * 1.9, sd + 5);
    let g = 1 - smooth(0, k.grimeHeight * (0.5 + 0.9 * e), h);
    g = Math.min(1, Math.max(0, g * (0.7 + 0.6 * m1) * (0.35 + 0.65 * wall) * k.grime));
    mul(mix3(g)); rough += (1 - rough) * g * 0.4;
  }
  if (k.dust > 0) {
    const up = Math.min(1, smooth(0.6, 0.95, n[1]) * k.dust * (0.45 + 0.8 * m2));
    col = col.map((c, i) => c + (c * G[i] * 0.9 - c) * up);
  }
  return { mul: col, rough };
}

/**
 * Bake weathering into a geometry's vertex colours (multiplying any it has; creates a white 'color' attribute
 * otherwise): the cheap version for phones, far LODs and merged props. Set `vertexColors: true` on the material.
 * `matrix` (optional Matrix4) places the geometry in the world first.
 * @param {import('three').BufferGeometry} geometry
 * @param {WeatheringOptions} [o]
 * @param {import('three').Matrix4} [matrix]
 */
export function bakeWeathering(geometry, o = {}, matrix = null) {
  const P = geometry.attributes.position, N = geometry.attributes.normal;
  if (!P || !N) throw new Error('bakeWeathering: position and normal attributes required');
  let C = geometry.attributes.color;
  if (!C) { C = new THREE.BufferAttribute(new Float32Array(P.count * 3).fill(1), 3); geometry.setAttribute('color', C); }
  const ground = o.ground === 'origin' ? (matrix ? new THREE.Vector3().setFromMatrixPosition(matrix).y : 0) : (o.ground ?? 0);
  const v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i); nv.fromBufferAttribute(N, i);
    if (matrix) { v.applyMatrix4(matrix); nv.applyMatrix3(nm).normalize(); }
    const w = weatheringAt(o, [v.x, v.y, v.z], [nv.x, nv.y, nv.z], v.y - ground);
    C.setXYZ(i, C.getX(i) * w.mul[0], C.getY(i) * w.mul[1], C.getZ(i) * w.mul[2]);
  }
  C.needsUpdate = true;
  return geometry;
}

const PROJECT_ANCHOR = 'mvPosition = modelViewMatrix * mvPosition;';
const WORLD_ANCHOR = 'worldPosition = modelMatrix * worldPosition;';

function patchVertex(vs, patches) {
  const C = THREE.ShaderChunk;
  const pars = patches.map((p) => p.vertexPars || '').join('');
  const begin = patches.map((p) => p.vertexBegin || '').join('');
  vs = vs.replace('#include <common>', `#include <common>\n${GLSL_HASH}vec3 mpOffset;\nvec3 mpInstancePos;\nbool mpCollapsed;\n${pars}`);
  vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
mpOffset = vec3( 0.0 );
mpCollapsed = false;
#ifdef USE_INSTANCING
	mpInstancePos = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
#else
	mpInstancePos = modelMatrix[ 3 ].xyz;
#endif
${begin}`);
  if (!C.project_vertex.includes(PROJECT_ANCHOR)) console.warn('[MaterialPatches] project_vertex anchor missing');
  vs = vs.replace('#include <project_vertex>', C.project_vertex.replace(PROJECT_ANCHOR, `if ( ! mpCollapsed ) mvPosition.xyz += mpOffset;\n${PROJECT_ANCHOR}`));
  if (vs.includes('#include <worldpos_vertex>')) {
    vs = vs.replace('#include <worldpos_vertex>', C.worldpos_vertex.replace(WORLD_ANCHOR, `if ( ! mpCollapsed ) worldPosition.xyz += mpOffset;\n\t${WORLD_ANCHOR}`));
  }
  // world position / object origin varyings, only when a patch asks for them (patches without it compile as before)
  if (patches.some((p) => p.worldPosition)) {
    vs = vs.replace('#include <common>', `#include <common>\n${WORLD_VARYINGS}`);
    vs = vs.replace(/(if \( ! mpCollapsed \) mvPosition\.xyz \+= mpOffset;\n)/, `$1${WORLD_VERTEX}`);
  }
  return vs;
}
const WORLD_VARYINGS = 'varying vec3 vMpWorld;\nvarying vec3 vMpOrigin;\n';
// mvPosition here is the batched / instanced object-space position plus the patches' offset (before modelView)
const WORLD_VERTEX = 'vMpWorld = ( modelMatrix * vec4( mvPosition.xyz, 1.0 ) ).xyz;\nvMpOrigin = mpInstancePos;\n';
function patchFragment(fs, patches) {
  const world = patches.some((p) => p.worldPosition);
  const pars = (world ? WORLD_VARYINGS : '') + patches.map((p) => p.fragmentPars || '').join('');
  const disc = patches.map((p) => p.fragmentDiscard || '').join('');
  const surf = patches.map((p) => p.fragmentSurface || '').join('');
  if (!pars && !disc && !surf) return fs;
  fs = fs.replace('#include <common>', `#include <common>\n${GLSL_IGN}${pars}`);
  if (surf) {
    // after the normal maps: diffuseColor, roughnessFactor (standard / physical) and nonPerturbedNormal are set and
    // nothing has lit the surface yet
    if (!fs.includes(SURFACE_ANCHOR)) console.warn('[MaterialPatches] normal_fragment_maps anchor missing: surface patch skipped');
    fs = fs.replace(SURFACE_ANCHOR, `${SURFACE_ANCHOR}\n${surf}`);
  }
  return fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${disc}`);
}
const SURFACE_ANCHOR = '#include <normal_fragment_maps>';

/**
 * Install patches on a material (chains an existing onBeforeCompile). Returns the material; the merged uniforms
 * are on material.userData.patchUniforms and the patch list on material.userData.patches.
 * @param {import('three').Material} material
 * @param {object[]} patches
 * @param {{ cacheKey?: string }} [o]  cacheKey: appended to customProgramCacheKey (defaults to the patch names)
 */
export function applyPatches(material, patches, { cacheKey } = {}) {
  const prev = material.onBeforeCompile;
  const uniforms = Object.assign({}, ...patches.map((p) => p.uniforms || {}));
  material.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = patchVertex(sh.vertexShader, patches);
    sh.fragmentShader = patchFragment(sh.fragmentShader, patches);
  };
  const key = cacheKey || `mp:${patches.map((p) => p.key).join('|')}`;
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${prevKey.call(material)}|${key}`;
  material.userData.patchUniforms = uniforms;
  material.userData.patches = patches;
  material.needsUpdate = true;
  return material;
}

/**
 * Shadow-caster material carrying the same vertex patches (and dithered discards) as `material`:
 * assign to mesh.customDepthMaterial. Copies map / alphaTest / side so alpha-tested cut-outs cast correctly.
 */
export function makeDepthMaterial(material, extra = {}) {
  const patches = (material.userData.patches || []).filter((p) => p.depth !== false);
  const d = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: material.map || null, alphaMap: material.alphaMap || null,
    alphaTest: material.alphaTest || 0, side: material.side, ...extra,
  });
  return applyPatches(d, patches);
}
