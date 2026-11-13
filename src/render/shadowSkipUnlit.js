// Skip the BRDF of a directional light that is black at the pixel: a global ShaderChunk patch for the directional
// light loop. three calls RE_Direct for every directional light at every lit pixel; the cascades' extra lights are
// black (shadowCascade.js) and a light in full shadow has its colour multiplied by 0, so there every term RE_Direct
// adds (Lambert, Phong, Toon, Standard / Physical incl. clearcoat and sheen) is a product with directLight.color and
// is exactly 0, so skipping it changes nothing (the branch itself can move a rare pixel by 1/255: the GPU compiler
// rounds the lit path differently, as any always-taken branch does). Point and spot loops are left as they are; the
// clustered loop (ClusteredLights.js) already skips invisible lights.
// Separate from shadowCascade.js: it touches another line of the loop (the RE_Direct call, not the shadow lookup), so
// the two install in either order and the cascade upgrade, which swaps only its own block, keeps it.
import * as THREE from 'three';

const ANCHOR = 'getDirectionalLightInfo( directionalLight, directLight );';
const CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
/** The guarded call that replaces the directional loop's RE_Direct call. */
export const SKIP_UNLIT_CALL = `if ( directLight.color != vec3( 0.0 ) ) { ${CALL} }`;

let installed = null; // null: not tried, false: three's chunk changed, true: installed

/**
 * Install the patch (idempotent). Opt-in: Atmosphere installs it for `shadows: { skipUnlit: true }`. Chunk text is not
 * in three's program cache key, so programs compiled before the install keep the stock loop: install before the
 * materials compile (Atmosphere's constructor does). Returns false (with a warning, chunk unchanged) when three's
 * directional loop is not the one expected.
 */
export function installSkipUnlitChunk() {
  if (installed !== null) return installed;
  const f = THREE.ShaderChunk.lights_fragment_begin;
  const a = f.indexOf(ANCHOR);
  const c = a < 0 ? -1 : f.indexOf(CALL, a);
  // one directional loop, and the first RE_Direct call after it is inside that loop
  if (a < 0 || f.lastIndexOf(ANCHOR) !== a || c < 0 || f.slice(a, c).includes('#pragma unroll_loop_end')) {
    console.warn('[render] skip-unlit patch: three.js chunk changed, directional lights stay unguarded');
    installed = false;
    return false;
  }
  THREE.ShaderChunk.lights_fragment_begin = f.slice(0, c) + SKIP_UNLIT_CALL + f.slice(c + CALL.length);
  installed = true;
  return true;
}

/** True once the patch is in lights_fragment_begin. */
export function skipUnlitInstalled() { return installed === true; }
