// Shared look-dev pieces of Midnight Candy Run: a procedural detail texture and small material patches (onBeforeCompile
// on three's standard material) that the world, the kid and the ghosts use. Everything here is built once at load;
// the per-frame update writes a few shared uniforms in place (no allocation).
//   detailTexture()                tileable RGBA8 noise: r fine grain, g broad blotches, b speckle, a streaks (linear)
//   patchDetail(mat, o)            world-space detail on a vertex-coloured standard material (props, terrain): stone /
//                                  bark grain from the dominant-axis projection, broad blotches, optional dew sheen
//   patchRim(mat, o)               a moonlit rim: view-facing edges toward the moon glow in a cool colour (+ an even
//                                  share all round), the kid's and the ghosts' silhouettes against the dark
//   patchGrass(mat)                wind sway of the grass tufts (instanced; tips move, roots stay)
//   LOOK.update(dt, camera, moonDir)  per frame: time, the moon direction in view space
import * as THREE from 'three';
import { pfbm } from '@vibe/engine/render';

/** Shared uniforms (one object per uniform, referenced by every patched material). */
export const LOOK = {
  time: { value: 0 },
  moonView: { value: new THREE.Vector3(0, 0, -1) }, // toward the moon, view space
  wind: { value: new THREE.Vector2(0.9, 0.35) },     // grass sway direction (world xz) and strength
  update(dt, camera, moonDir) {
    this.time.value = (this.time.value + dt) % 3600;
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
 * vertical faces), spec (1: the specular share of a dielectric, F0 and F90, scaled).
 */
export function patchDetail(mat, { scale = 1.4, amount = 0.55, broad = 0.35, dew = 0, streak = 0, spec = 1 } = {}) {
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
  vec4 hwD = texture2D( tDetailHw, hwUv * uDetailHw.x );
  vec4 hwB = texture2D( tDetailHw, hwUv * uDetailHw.x * 0.13 + 0.37 );
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
  mat.customProgramCacheKey = () => `hwDetail${dew > 0 ? 'D' : ''}${spec !== 1 ? 'S' : ''}`;
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
export function patchGrass(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTimeHw = LOOK.time;
    sh.uniforms.uWindHw = LOOK.wind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTimeHw;\nuniform vec2 uWindHw;')
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
  }`);
  };
  mat.customProgramCacheKey = () => 'hwGrass';
  return mat;
}
