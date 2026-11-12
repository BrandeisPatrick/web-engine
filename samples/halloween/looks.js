// Shared look-dev pieces of Midnight Candy Run: a procedural detail texture and small material patches (onBeforeCompile
// on three's standard material) that the world, the kid and the ghosts use. Everything here is built once at load;
// the per-frame update writes a few shared uniforms in place (no allocation).
//   detailTexture()                tileable RGBA8 noise: r fine grain, g broad blotches, b speckle, a streaks (linear)
//   patchDetail(mat, o)            world-space detail on a vertex-coloured standard material (props, terrain): stone /
//                                  bark grain from the dominant-axis projection, broad blotches, optional dew sheen
//   patchRim(mat, o)               a moonlit rim: view-facing edges toward the moon glow in a cool colour (+ an even
//                                  share all round), the kid's and the ghosts' silhouettes against the dark
//   patchGrass(mat)                wind sway of the grass tufts (instanced; tips move, roots stay)
//   patchRibs(mat, lobes)          crisp pumpkin ribs: normals bent by the lobes' slope, creases darkened per pixel
//   patchGlow(mat, key)            emissive += albedo x a per-vertex `glow` attribute (the kid's pail face and
//                                  catchlights, a lantern's rind round its carving: self-lit details in one draw)
//   patchGround(mat, sets, o)      (remaster) CC0 ground scans on the terrain: grass, leaf litter and the lane's gravel
//                                  by a per-vertex mask, as detail on the vertex colour, with their normal maps
//   LOOK.update(dt, camera, moonDir)  per frame: time, the moon direction in view space
import * as THREE from 'three';
import { pfbm } from '@vibe/engine/render';

/** Shared uniforms (one object per uniform, referenced by every patched material). */
export const LOOK = {
  time: { value: 0 },
  moonView: { value: new THREE.Vector3(0, 0, -1) }, // toward the moon, view space
  wind: { value: new THREE.Vector2(0.9, 0.35) },     // grass sway direction (world xz) and strength
  cam: { value: new THREE.Vector3() },               // the camera (grass distance fade)
  update(dt, camera, moonDir) {
    this.time.value = (this.time.value + dt) % 3600;
    this.cam.value.copy(camera.position);
    this.moonView.value.copy(moonDir).transformDirection(camera.matrixWorldInverse);
  },
};

let _detail = null;
/** The tileable detail texture (256 x 256 RGBA8, linear data, mipmapped, repeating). Built once, shared. */
export function detailTexture() {
  if (_detail) return _detail;
  const S = 256, d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, i = (y * S + x) * 4;
      const fine = pfbm(u, v, 16, 4, 11, 0.55);
      const broad = pfbm(u, v, 4, 4, 23, 0.5);
      const speck = pfbm(u, v, 64, 2, 37, 0.5);
      const streak = pfbm(u * 0.25 + v * 0.0, v, 8, 3, 41, 0.5); // stretched along y: bark / wood grain when projected
      d[i] = Math.round(255 * fine); d[i + 1] = Math.round(255 * broad); d[i + 2] = Math.round(255 * speck); d[i + 3] = Math.round(255 * streak);
    }
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  t.name = 'halloweenDetail';
  _detail = t;
  return t;
}

/**
 * World-space detail on a standard material: the dominant axis of the world normal picks the projection (one fetch,
 * no triplanar blend: the noise hides the seams), a fine grain + broad blotches + speckle modulate the albedo.
 * o: scale (1/m of the fine grain, default 1.4), amount (0..1, default 0.55), broad (default 0.35), dew (0 = off:
 * the roughness drops where the broad noise is low, a moonlit sheen on terrain), streak (0..1: bark-like streaks on
 * vertical faces), spec (1: the specular share of a dielectric, F0 and F90, scaled), lite (true: one texture fetch, the
 * broad blotches from the same sample; 'none': no fetch, flat: for the phones' terrain, where the ground scans are
 * the detail).
 */
export function patchDetail(mat, { scale = 1.4, amount = 0.55, broad = 0.35, dew = 0, streak = 0, spec = 1, lite = false } = {}) {
  const tex = detailTexture();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tDetailHw = { value: tex };
    sh.uniforms.uDetailHw = { value: new THREE.Vector4(scale, amount, broad, dew) };
    sh.uniforms.uStreakHw = { value: streak };
    sh.uniforms.uSpecHw = { value: spec };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHwPos;\nvarying vec3 vHwNrm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  {
    vec4 hwp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    hwp = instanceMatrix * hwp;
  #endif
    vHwPos = ( modelMatrix * hwp ).xyz;
    vHwNrm = normalize( mat3( modelMatrix ) * objectNormal );
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHwPos;\nvarying vec3 vHwNrm;\nuniform sampler2D tDetailHw;\nuniform vec4 uDetailHw;\nuniform float uStreakHw;\nuniform float uSpecHw;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 hwAn = abs( vHwNrm );
  bool hwSide = hwAn.y < max( hwAn.x, hwAn.z );
  vec2 hwUv = hwSide ? ( hwAn.x > hwAn.z ? vHwPos.zy : vHwPos.xy ) : vHwPos.xz;
  vec4 hwD = ${lite === 'none' ? 'vec4( 0.5 )' : 'texture2D( tDetailHw, hwUv * uDetailHw.x )'};
  vec4 hwB = ${lite ? 'hwD' : 'texture2D( tDetailHw, hwUv * uDetailHw.x * 0.13 + 0.37 )'};
  float hwG = hwD.r * 0.75 + hwD.b * 0.25;
  if ( hwSide ) hwG = mix( hwG, hwD.a, uStreakHw );
  diffuseColor.rgb *= mix( 1.0, 0.45 + 1.1 * hwG, uDetailHw.y ) * mix( 1.0, 0.6 + 0.8 * hwB.g, uDetailHw.z );`);
    if (spec !== 1) { // a dielectric's specular share (F0 and the grazing F90): the ground's moon glare
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  material.specularColor *= uSpecHw; material.specularF90 *= uSpecHw;`);
    }
    if (dew > 0) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix( roughnessFactor, roughnessFactor * ( 0.86 + 0.14 * smoothstep( 0.3, 0.6, hwB.g ) ), uDetailHw.w );`);
    }
  };
  mat.customProgramCacheKey = () => `hwDetail${dew > 0 ? 'D' : ''}${spec !== 1 ? 'S' : ''}${lite ? `L${lite}` : ''}`;
  return mat;
}

/**
 * Ground scans on the terrain (the remaster): three CC0 sets (grass, leaf litter, the lane's gravel and the creek's
 * bed) projected on world xz and picked per vertex by the attribute `gmask` (x: gravel, y: litter; the rest grass).
 * Each scan is detail on the art-directed vertex colour: divided by its own mean (measured once at load: set.mean), half of its hue
 * kept and half its luminance only, so the night's palette stays the vertex colours' while every stone, twig and leaf
 * shows. With normal maps (desktop) the scans' relief is tilted into the world normal, so the low moon rakes across
 * it; a second, rotated sample of the grass at 0.37x scale breaks its tiling up. Chains after patchDetail (it reuses
 * that patch's world position and normal varyings). sets: { grass, litter, gravel }: { map, mean (linear rgb),
 * normal?, scale (1/m) };
 * o: normal (bool), strength (normal map strength, 1), hue (0..1: how much of each scan's own colour shows, 0.5).
 */
export function patchGround(mat, sets, { normal = true, strength = 1, hue = 0.5, breakup = true } = {}) {
  const prev = mat.onBeforeCompile, S = [sets.grass, sets.litter, sets.gravel];
  const nrm = normal && S.every((t) => t.normal);
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    S.forEach((t, i) => { sh.uniforms[`tGrnd${i}`] = { value: t.map }; if (nrm) sh.uniforms[`tGrndN${i}`] = { value: t.normal }; });
    sh.uniforms.uGrndK = { value: new THREE.Vector4(S[0].scale, S[1].scale, S[2].scale, strength) };
    sh.uniforms.uGrndHue = { value: hue };
    S.forEach((t, i) => { sh.uniforms[`uGrndM${i}`] = { value: t.mean }; });
    const samplers = S.map((_, i) => `uniform sampler2D tGrnd${i};${nrm ? ` uniform sampler2D tGrndN${i};` : ''}`).join('\n');
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 gmask;\nvarying vec2 vGMaskHw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGMaskHw = gmask;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vGMaskHw;
${samplers}
uniform vec4 uGrndK;
uniform float uGrndHue;
uniform vec3 uGrndM0, uGrndM1, uGrndM2;
vec3 hwGrndDetail( vec3 c, vec3 m ) {
  vec3 d = c / max( m, vec3( 1e-3 ) );
  return mix( vec3( dot( d, vec3( 0.2126, 0.7152, 0.0722 ) ) ), d, uGrndHue );
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec2 hwGUv = vec2( vHwPos.x, - vHwPos.z );
  float hwWg = clamp( vGMaskHw.x, 0.0, 1.0 ), hwWl = clamp( vGMaskHw.y, 0.0, 1.0 ) * ( 1.0 - hwWg ), hwWa = 1.0 - hwWg - hwWl;
  // the grass twice (a rotated, larger sample over the first, by a broad noise): no visible tiling at a distance
  vec2 hwRUv = mat2( 0.8, 0.6, - 0.6, 0.8 ) * hwGUv * 0.37 + 0.31;
  ${breakup ? 'float hwBrk = smoothstep( 0.4, 0.6, texture2D( tDetailHw, hwGUv * 0.035 ).g );' : 'float hwBrk = 0.0;'}
  float hwNear = 1.0 - smoothstep( 20.0, 32.0, distance( vHwPos, cameraPosition ) ); // (the costly samples near the eye only)
  vec3 hwGa = texture2D( tGrnd0, hwGUv * uGrndK.x ).rgb;
  ${breakup ? 'if ( hwNear > 0.0 ) hwGa = mix( hwGa, texture2D( tGrnd0, hwRUv * uGrndK.x ).rgb, hwBrk * hwNear );' : ''}
  vec3 hwDet = hwGrndDetail( hwGa, uGrndM0 ) * hwWa;
  if ( hwWl > 0.004 ) hwDet += hwGrndDetail( texture2D( tGrnd1, hwGUv * uGrndK.y ).rgb, uGrndM1 ) * hwWl;
  if ( hwWg > 0.004 ) hwDet += hwGrndDetail( texture2D( tGrnd2, hwGUv * uGrndK.z ).rgb, uGrndM2 ) * hwWg;
  diffuseColor.rgb *= hwDet;`);
    if (nrm) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if ( hwNear > 0.0 ) {
    vec3 hwTn = ( texture2D( tGrndN0, mix( hwGUv * uGrndK.x, hwRUv * uGrndK.x, step( 0.5, hwBrk ) ) ).xyz * 2.0 - 1.0 ) * hwWa;
    if ( hwWl > 0.004 ) hwTn += ( texture2D( tGrndN1, hwGUv * uGrndK.y ).xyz * 2.0 - 1.0 ) * hwWl;
    if ( hwWg > 0.004 ) hwTn += ( texture2D( tGrndN2, hwGUv * uGrndK.z ).xyz * 2.0 - 1.0 ) * hwWg;
    hwTn.xy *= uGrndK.w * hwNear;
    vec3 hwN = normalize( vHwNrm ), hwT = normalize( vec3( 1.0, 0.0, 0.0 ) - hwN * hwN.x ), hwB = cross( hwN, hwT );
    vec3 hwNw = normalize( hwT * hwTn.x + hwB * hwTn.y + hwN * max( hwTn.z, 0.05 ) );
    normal = normalize( ( viewMatrix * vec4( hwNw, 0.0 ) ).xyz );
  }`);
    }
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|hwGround${nrm ? 'N' : ''}${breakup ? 'B' : ''}`;
  return mat;
}

/**
 * Material scans on the merged props (the remaster): the vertex attribute `surf` (props.js SURF_KIND: 1 boards,
 * 2 slate, 3 masonry, 4 lichened stone, 5 bark, 6 iron) picks a CC0 set, projected on the dominant world axis
 * (walls: across x or z by height, so the boards and slate rows run level; tops: on xz), as detail on the vertex
 * colour like patchGround (divided by its mean, `hue` of its own colour kept); iron gets a rust bloom instead of a
 * scan. With normal maps (desktop) the scans' relief bends the shading normal, so the moon rakes across board edges,
 * slates, mortar joints and bark. sets: [wood, roof, masonry, stone, bark], each { map, mean, normal?, scale (1/m),
 * hue }. Chains after patchDetail.
 */
export function patchSurfaces(mat, sets, { normal = true, strength = 1 } = {}) {
  const prev = mat.onBeforeCompile;
  const nrm = normal && sets.every((t) => t.normal);
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    sets.forEach((t, i) => {
      sh.uniforms[`tSurf${i}`] = { value: t.map }; if (nrm) sh.uniforms[`tSurfN${i}`] = { value: t.normal };
      sh.uniforms[`uSurfM${i}`] = { value: new THREE.Vector4(t.mean.x, t.mean.y, t.mean.z, t.scale) };
      sh.uniforms[`uSurfH${i}`] = { value: t.hue };
    });
    sh.uniforms.uSurfK = { value: strength };
    const decl = sets.map((_, i) => `uniform sampler2D tSurf${i};${nrm ? ` uniform sampler2D tSurfN${i};` : ''} uniform vec4 uSurfM${i}; uniform float uSurfH${i};`).join('\n');
    // one branch per kind: a constant sampler index (GLSL ES 3 allows no dynamic sampler indexing)
    const pick = (body) => sets.map((_, i) => `${i ? 'else ' : ''}if ( hwSk == ${i + 1} ) { ${body(i)} }`).join('\n    ');
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float surf;\nvarying float vSurfHw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvSurfHw = surf;');
    sh.uniforms.uMoonSurfHw = LOOK.moonView;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if ( hwSk >= 1 && hwSk <= 3 ) totalEmissiveRadiance += diffuseColor.rgb * vec3( 0.05, 0.055, 0.075 ) * clamp( - dot( normal, uMoonSurfHw ) + 0.3, 0.0, 1.0 ); // (bounce / sky fill: walls away from the moon keep their boards)`)
      .replace('#include <common>', `#include <common>\nvarying float vSurfHw;\n${decl}\nuniform float uSurfK;\nuniform vec3 uMoonSurfHw;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  int hwSk = int( vSurfHw + 0.5 );
  vec3 hwSn = normalize( vHwNrm ), hwSa = abs( hwSn );
  bool hwSside = hwSa.y < max( hwSa.x, hwSa.z );
  bool hwSx = hwSa.x > hwSa.z;
  vec2 hwSuv = hwSside ? ( hwSx ? vec2( vHwPos.z, vHwPos.y ) : vec2( vHwPos.x, vHwPos.y ) ) : vHwPos.xz;
  vec3 hwSt = hwSside ? ( hwSx ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 ) ) : vec3( 1.0, 0.0, 0.0 );
  vec3 hwSb = hwSside ? vec3( 0.0, 1.0, 0.0 ) : vec3( 0.0, 0.0, 1.0 );
  if ( hwSk == 2 && hwSa.y < 0.97 ) { // slate: rows along the eaves whichever way the roof faces (frame from the slope)
    hwSt = normalize( cross( vec3( 0.0, 1.0, 0.0 ), hwSn ) ); hwSb = cross( hwSn, hwSt );
    hwSuv = vec2( dot( vHwPos, hwSt ), dot( vHwPos, hwSb ) );
  }
  vec3 hwStn = vec3( 0.0, 0.0, 1.0 );
  float hwSnear = 1.0 - smoothstep( 40.0, 60.0, distance( vHwPos, cameraPosition ) );
  if ( hwSk >= 1 && hwSk <= ${sets.length} ) {
    vec3 hwSc = vec3( 1.0 ); vec4 hwSm = vec4( 1.0 ); float hwSh = 0.5;
    ${pick((i) => `hwSm = uSurfM${i}; hwSh = uSurfH${i}; hwSc = texture2D( tSurf${i}, hwSuv * uSurfM${i}.w ).rgb;${nrm ? ` if ( hwSnear > 0.0 ) hwStn = texture2D( tSurfN${i}, hwSuv * uSurfM${i}.w ).xyz * 2.0 - 1.0;` : ''}`)}
    vec3 hwSd = hwSc / max( hwSm.rgb, vec3( 1e-3 ) );
    diffuseColor.rgb *= clamp( mix( vec3( dot( hwSd, vec3( 0.2126, 0.7152, 0.0722 ) ) ), hwSd, hwSh ), 0.0, 2.5 );
  } else if ( hwSk == 6 ) { // rusted iron: a warm bloom in the pits, darker scale
    float hwR = texture2D( tDetailHw, hwSuv * 3.1 ).g;
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.16, 0.07, 0.035 ), smoothstep( 0.45, 0.75, hwR ) * 0.7 );
  }`);
    if (nrm) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if ( hwSk >= 1 && hwSk <= ${sets.length} && hwSnear > 0.0 ) {
    vec3 hwT = normalize( hwSt - hwSn * dot( hwSt, hwSn ) ), hwB = normalize( hwSb - hwSn * dot( hwSb, hwSn ) - hwT * dot( hwSb, hwT ) );
    vec3 hwNw = normalize( ( hwT * hwStn.x + hwB * hwStn.y ) * uSurfK * hwSnear + hwSn * max( hwStn.z, 0.05 ) );
    normal = normalize( ( viewMatrix * vec4( hwNw, 0.0 ) ).xyz );
  }`);
    }
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|hwSurf${nrm ? 'N' : ''}${sets.length}`;
  return mat;
}

/**
 * Pools of light from small practical lamps (the remaster): up to LAMP_POOLS point lights evaluated in the material
 * (diffuse only, a smooth (1 - d / r)^2 falloff, N.L from the shaded normal), so a porch lamp lights its deck, the
 * ground in front and the facade around it without a three.js light (the scene keeps its 8-light budget). Uniform
 * arrays shared by every patched material: pos[i] = (x, y, z, radius), col[i] = linear rgb x intensity (0: off);
 * n.value = how many are live. Chains after patchDetail (its world-position varying).
 */
export const LAMP_POOLS = 8;
export const POOLS = {
  pos: { value: Array.from({ length: LAMP_POOLS }, () => new THREE.Vector4()) },
  col: { value: Array.from({ length: LAMP_POOLS }, () => new THREE.Vector3()) },
  n: { value: 0 },
};
export function patchPools(mat, key = 'hwPools') {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    sh.uniforms.uPoolP = POOLS.pos; sh.uniforms.uPoolC = POOLS.col; sh.uniforms.uPoolN = POOLS.n;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec4 uPoolP[ ${LAMP_POOLS} ];\nuniform vec3 uPoolC[ ${LAMP_POOLS} ];\nuniform int uPoolN;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  for ( int i = 0; i < ${LAMP_POOLS}; i ++ ) {
    if ( i >= uPoolN ) break;
    vec3 hwD = uPoolP[ i ].xyz - vHwPos;
    float hwDl = length( hwD ), hwF = clamp( 1.0 - hwDl / uPoolP[ i ].w, 0.0, 1.0 );
    if ( hwF <= 0.0 ) continue;
    vec3 hwL = normalize( ( viewMatrix * vec4( hwD, 0.0 ) ).xyz );
    reflectedLight.directDiffuse += BRDF_Lambert( material.diffuseColor ) * uPoolC[ i ] * hwF * hwF * clamp( dot( normal, hwL ) * 0.85 + 0.15, 0.0, 1.0 );
  }`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|${key}`;
  return mat;
}

/**
 * Moonlit rim: emissive += color * fresnel^power * (share + facing the moon), in view space. o: color (linear),
 * power (3), share (0.35: how much of the rim shows away from the moon), fill (0: emissive += albedo * fill, a soft
 * self light so a character's colours still read in the dark).
 */
export function patchRim(mat, { color = new THREE.Color(0.32, 0.36, 0.62), power = 3, share = 0.35, fill = 0, key = 'rim' } = {}) {
  const prev = mat.onBeforeCompile;
  const col = color.isColor ? color : new THREE.Color(color);
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    sh.uniforms.uRimHw = { value: col };
    sh.uniforms.uRimHwP = { value: new THREE.Vector3(power, share, fill) };
    sh.uniforms.uMoonViewHw = LOOK.moonView;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimHw;\nuniform vec3 uRimHwP;\nuniform vec3 uMoonViewHw;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    vec3 hwV = normalize( vViewPosition );
    float hwF = pow( 1.0 - clamp( abs( dot( normal, hwV ) ), 0.0, 1.0 ), uRimHwP.x );
    float hwM = uRimHwP.y + clamp( dot( normal, uMoonViewHw ) * 0.6 + 0.4, 0.0, 1.0 ); // edges turned toward the moon
    float hwL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ); // light albedo (skin, a white sheet) rims less
    totalEmissiveRadiance += uRimHw * hwF * hwM * ( 1.0 - 0.7 * clamp( hwL, 0.0, 1.0 ) ) + diffuseColor.rgb * uRimHwP.z; // + a self fill
  }`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|${key}`;
  return mat;
}

/** Grass tufts sway in the wind: the blade tips (local y) move, the roots stay; per-instance phase from its position. */
export function patchGrass(mat, fade = null) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTimeHw = LOOK.time;
    sh.uniforms.uWindHw = LOOK.wind;
    sh.uniforms.uCamHw = LOOK.cam;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTimeHw;\nuniform vec2 uWindHw;\nuniform vec3 uCamHw;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  {
  #ifdef USE_INSTANCING
    vec2 hwO = instanceMatrix[ 3 ].xz;
  #else
    vec2 hwO = vec2( 0.0 );
  #endif
    float hwPh = dot( hwO, vec2( 0.21, 0.17 ) ) - uTimeHw * 1.9;
    float hwS = ( sin( hwPh ) * 0.6 + sin( hwPh * 2.3 + 1.7 ) * 0.25 + 0.35 ) * uWindHw.y;
    float hwH = transformed.y * transformed.y * 2.2;
    // the wind is world-space: undo the instance's rotation for the offset direction (its upper 3x3, unit scale ~)
  #ifdef USE_INSTANCING
    vec3 hwW = transpose( mat3( instanceMatrix ) ) * vec3( uWindHw.x, 0.0, 1.0 - uWindHw.x );
  #else
    vec3 hwW = vec3( uWindHw.x, 0.0, 1.0 - uWindHw.x );
  #endif
    transformed += normalize( hwW ) * hwS * hwH;
    ${fade ? `transformed *= 1.0 - smoothstep( ${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, length( hwO - uCamHw.xz ) ); // (far clumps fold away: thin far blades cost the most per pixel)` : ''}
  }`);
  };
  mat.customProgramCacheKey = () => (fade ? `hwGrassF${fade[0]}` : 'hwGrass');
  return mat;
}

/**
 * Small instanced dressing (leaves, twigs, stones, mushrooms) folds away with distance from the camera (scaled to
 * nothing between near and far, m): far-off specks cost raster work and add only sparkle. Instanced meshes only.
 */
export function patchFold(mat, near, far, key = 'hwFold') {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    sh.uniforms.uCamFoldHw = LOOK.cam;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCamFoldHw;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
    transformed *= 1.0 - smoothstep( ${near.toFixed(1)}, ${far.toFixed(1)}, distance( instanceMatrix[ 3 ].xyz, uCamFoldHw ) );
  #endif`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|${key}${near}`;
  return mat;
}

/**
 * Emissive += albedo x the vertex attribute `glow` (0 = none; > 1 blooms): details that light themselves (a carved
 * face, catchlights, the rind round a lantern's carving) in the same draw as the rest of the mesh. Chains with
 * patchRim (apply this one first).
 */
export function patchGlow(mat, key = 'hwGlow') {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlowHw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvGlowHw = glow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlowHw;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * vGlowHw;');
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|${key}`;
  return mat;
}

/**
 * Crisp pumpkin ribs on a lathe-built pumpkin (instanced or not): where the vertex attribute `rib` is 1 the normal is
 * bent round the object's y axis by the slope of the lobes (|cos(lobes * angle / 2)|^0.6, the shape props.js models)
 * and the creases are darkened per pixel, so the creases read sharp at a low vertex count. strength: the bend.
 */
export function patchRibs(mat, lobes, strength = 0.5, key = 'hwRibs', skin = false) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    if (skin) { // (the remaster) a pumpkin's skin: streaks along the meridians, pale scars and speckles, a waxy sheen
      sh.uniforms.tSkinHw = { value: detailTexture() };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tSkinHw;')
        .replace('#include <lights_physical_fragment>', `if ( vRibHw.w > 0.5 ) {
    float hwA = atan( vRibHw.x, vRibHw.z ), hwH = vRibHw.y;
    vec4 hwK1 = texture2D( tSkinHw, vec2( hwA * ${(lobes * 0.32).toFixed(3)}, hwH * 0.7 ) );
    vec4 hwK2 = texture2D( tSkinHw, vec2( hwA * 1.9, hwH * 2.6 ) + 0.5 );
    float hwL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
    float hwSt = smoothstep( 0.3, 0.75, hwK1.a ) * 0.7 + 0.3 * hwK1.r;
    diffuseColor.rgb = mix( vec3( hwL ), diffuseColor.rgb, 0.8 ) * ( 0.55 + 0.75 * hwSt );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.35, 1.25, 0.7 ), smoothstep( 0.58, 0.74, hwK2.b ) * 0.7 );
    roughnessFactor = clamp( roughnessFactor * ( 0.7 + 0.6 * hwK2.r ), 0.2, 1.0 );
    ${typeof skin === 'number' ? `// the lid's cut: a zigzag ring round the stem (skin = the pumpkin's radius)
    float hwR = length( vRibHw.xz ), hwZ = ${(0.42 * skin).toFixed(4)} * ( 1.0 + 0.1 * sign( sin( hwA * 7.0 ) ) );
    float hwCut = ( 1.0 - smoothstep( 0.004, 0.012, abs( hwR - hwZ ) ) ) * step( ${(1.0 * skin).toFixed(4)}, vRibHw.y );
    diffuseColor.rgb *= 1.0 - 0.75 * hwCut;` : ''}
  }
#include <lights_physical_fragment>`);
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float rib;\nvarying vec4 vRibHw;\nvarying vec3 vRibTHw;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    vec3 t = vec3( position.z, 0.0, - position.x ) + vec3( 1e-5, 0.0, 0.0 );
  #ifdef USE_INSTANCING
    t = mat3( instanceMatrix ) * t;
  #endif
    vRibTHw = normalize( normalMatrix * t );
    vRibHw = vec4( position, rib );
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vRibHw;\nvarying vec3 vRibTHw;')
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
  float hwRibL = 1.0;
  if ( vRibHw.w > 0.5 ) {
    float a = atan( vRibHw.x, vRibHw.z ) * ${(lobes / 2).toFixed(2)}, c = cos( a ), s = sin( a );
    hwRibL = pow( abs( c ), 0.6 );
    float slope = - 0.6 * pow( max( abs( c ), 0.04 ), - 0.4 ) * sign( c ) * s; // d lobe / d phase
    normal = normalize( normal - normalize( vRibTHw ) * clamp( slope, - 2.5, 2.5 ) * ${strength.toFixed(3)} );
  }`)
      .replace('#include <lights_fragment_begin>', '\tdiffuseColor.rgb *= 0.72 + 0.28 * hwRibL;\n#include <lights_fragment_begin>');
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|${key}${lobes}${skin ? 'S' : ''}`;
  return mat;
}
