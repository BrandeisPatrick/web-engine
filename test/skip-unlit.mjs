// The skip-unlit chunk patch (src/render/shadowSkipUnlit.js, Atmosphere shadows.skipUnlit), headless. Checks
//   - off (absent / false): the chunk is exactly what the cascade patch alone makes;
//   - on: only the directional loop's RE_Direct call is guarded (point, spot and clustered calls untouched); one guard
//     per directional light after three's loop unrolling (emulated); idempotent;
//   - either install order with the cascade patch, for 2, 3 and 4 cascades (3 / 4: the upgrade swaps only its block);
//   - a changed three.js chunk: false, a warning, nothing changed;
//   - the quality tiers turn it on, and the city demos' shadow overrides keep it.
// The patch changes the global chunk for the rest of the process: each case below resets the chunk and imports
// fresh module instances (a query string makes a new instance). Pixel identity is measured in the browser (npm run perf).
import * as THREE from 'three';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}

const STOCK = THREE.ShaderChunk.lights_fragment_begin;
const ORIG = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const GUARDED = `if ( directLight.color != vec3( 0.0 ) ) { ${CALL} }`;
const count = (s, t) => s.split(t).length - 1;
// the directional call is the last RE_Direct call of the chunk (point, spot, then directional; rect area has its own)
const guardLast = (s) => { const i = s.lastIndexOf(CALL); return s.slice(0, i) + GUARDED + s.slice(i + CALL.length); };
let tag = 0;
const fresh = (p) => import(`${p}?case${++tag}`);
const reset = () => { THREE.ShaderChunk.lights_fragment_begin = STOCK; };

check('stock chunk: point, spot and directional RE_Direct calls, directional last', count(STOCK, CALL) === 3
  && STOCK.lastIndexOf(CALL) > STOCK.indexOf('getDirectionalLightInfo( directionalLight, directLight );')
  && STOCK.indexOf('getDirectionalLightInfo') > STOCK.indexOf('getSpotLightInfo'));

// ---------------------------------------------------------------- 1. Atmosphere: off by default, on by option
const SC0 = await import('../src/render/shadowCascade.js');
const SK0 = await import('../src/render/shadowSkipUnlit.js');
const { Atmosphere } = await import('../src/render/Atmosphere.js'); // installs the 2-cascade patch at module load
const P2 = STOCK.replace(ORIG, SC0.cascadeShadowChunkText(2));
const headless = (shadows) => new Atmosphere({ scene: new THREE.Scene(), renderer: null, camera: new THREE.PerspectiveCamera(), shadows });
check('Atmosphere module load: cascade patch only, no guard', THREE.ShaderChunk.lights_fragment_begin === P2 && !P2.includes(GUARDED));
headless({ cascades: 2 }); headless({ cascades: 1 }); headless(undefined); headless({ cascades: 2, skipUnlit: false });
check('skipUnlit absent / false: chunk unchanged', THREE.ShaderChunk.lights_fragment_begin === P2 && !SK0.skipUnlitInstalled());
headless({ cascades: 2, skipUnlit: true });
check('skipUnlit: true guards the directional call of the 2-cascade chunk', THREE.ShaderChunk.lights_fragment_begin === guardLast(P2) && SK0.skipUnlitInstalled());
headless({ cascades: 2, skipUnlit: true });
check('a second skipUnlit Atmosphere: no change', THREE.ShaderChunk.lights_fragment_begin === guardLast(P2));
headless({ cascades: 4, skipUnlit: true });
check('cascades: 4 afterwards: upgraded block, guard kept', THREE.ShaderChunk.lights_fragment_begin === guardLast(STOCK.replace(ORIG, SC0.cascadeShadowChunkText(4))));

// ---------------------------------------------------------------- 2. the guarded chunk
reset();
{
  const SK = await fresh('../src/render/shadowSkipUnlit.js');
  check('install on the stock chunk', SK.installSkipUnlitChunk() === true && SK.skipUnlitInstalled());
  const f = THREE.ShaderChunk.lights_fragment_begin, d = f.indexOf('#if ( NUM_DIR_LIGHTS > 0 )');
  check('exactly one guard, on the directional call', count(f, GUARDED) === 1 && count(f, CALL) === 3 && f === guardLast(STOCK) && f.indexOf(GUARDED) > d);
  check('point and spot loops byte-identical', f.slice(0, d) === STOCK.slice(0, d) && count(f.slice(0, d), CALL) === 2 && !f.slice(0, d).includes('vec3( 0.0 ) )'));
  check('idempotent', SK.installSkipUnlitChunk() === true && THREE.ShaderChunk.lights_fragment_begin === f);
  // three r180 WebGLProgram: light numbers, then loop unrolling (the guard's closing brace must not end the loop body)
  const UNROLL = /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
  for (const n of [1, 2, 4]) {
    const g = f.replace(/\bNUM_DIR_LIGHTS\b/g, String(n)).replace(/\bNUM_POINT_LIGHTS\b/g, '1').replace(/\bNUM_SPOT_LIGHTS\b/g, '1')
      .replace(/\bNUM_RECT_AREA_LIGHTS\b/g, '0').replace(/\bNUM_HEMI_LIGHTS\b/g, '1')
      .replace(UNROLL, (m, a, b, body) => { let r = ''; for (let i = +a; i < +b; i++) r += body.replace(/\[\s*i\s*\]/g, `[ ${i} ]`); return r; });
    check(`unrolled, ${n} directional light(s): ${n} guard(s), 1 point + 1 spot call unguarded`, count(g, GUARDED) === n && count(g, CALL) === n + 2 && !g.includes('#pragma unroll_loop'));
  }
}

// ---------------------------------------------------------------- 3. install order with the cascade patch
for (const max of [2, 3, 4]) {
  const want = guardLast(STOCK.replace(ORIG, (SC0.cascadeShadowChunkText(max))));
  // skip-unlit first, then cascades (2, then the upgrade to 3 / 4)
  reset();
  {
    const SK = await fresh('../src/render/shadowSkipUnlit.js'), SC = await fresh('../src/render/shadowCascade.js');
    const ok = SK.installSkipUnlitChunk() && SC.installCascadeShadowChunk(2) && SC.installCascadeShadowChunk(max);
    check(`skip-unlit, then cascades 2 -> ${max}`, ok && SC.installedCascades() === max && THREE.ShaderChunk.lights_fragment_begin === want);
  }
  // cascades 2 first, skip-unlit, then the upgrade
  reset();
  {
    const SK = await fresh('../src/render/shadowSkipUnlit.js'), SC = await fresh('../src/render/shadowCascade.js');
    const ok = SC.installCascadeShadowChunk(2) && SK.installSkipUnlitChunk() && SC.installCascadeShadowChunk(max);
    check(`cascades 2, skip-unlit, then cascades -> ${max}`, ok && SC.installedCascades() === max && THREE.ShaderChunk.lights_fragment_begin === want);
  }
  // cascades straight to max, then skip-unlit
  reset();
  {
    const SK = await fresh('../src/render/shadowSkipUnlit.js'), SC = await fresh('../src/render/shadowCascade.js');
    const ok = SC.installCascadeShadowChunk(max) && SK.installSkipUnlitChunk() && SK.installSkipUnlitChunk();
    check(`cascades ${max}, then skip-unlit (twice)`, ok && THREE.ShaderChunk.lights_fragment_begin === want);
  }
}

// clustered lights insert a loop with its own RE_Direct call before the spot loop: it stays as it is
reset();
{
  const CL = await fresh('../src/render/ClusteredLights.js'), SK = await fresh('../src/render/shadowSkipUnlit.js');
  CL.installClusteredChunks();
  const before = THREE.ShaderChunk.lights_fragment_begin;
  SK.installSkipUnlitChunk();
  const f = THREE.ShaderChunk.lights_fragment_begin;
  check('after clustered lights: only the directional call guarded', count(before, CALL) === 4 && f === guardLast(before) && count(f, GUARDED) === 1 && f.indexOf(GUARDED) > f.indexOf('getDirectionalLightInfo'));
}

// ---------------------------------------------------------------- 4. a changed three.js chunk
const warn = console.warn, warned = [];
console.warn = (...a) => warned.push(a.join(' '));
const changed = {
  'no directional loop anchor': STOCK.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, geometryPosition, directLight );'),
  'no RE_Direct call after it': guardLast(STOCK).replace(GUARDED, 'RE_Direct( directLight, material, reflectedLight );'),
  'the next call is outside the directional loop': (() => { const s = STOCK.replace(/[^\n]*$/, ''); const i = s.lastIndexOf(CALL); return s.slice(0, i) + 'RE_Direct_Other();' + s.slice(i + CALL.length) + CALL + '\n'; })(),
};
for (const [name, text] of Object.entries(changed)) {
  THREE.ShaderChunk.lights_fragment_begin = text;
  warned.length = 0;
  const SK = await fresh('../src/render/shadowSkipUnlit.js');
  check(`refuses: ${name}`, SK.installSkipUnlitChunk() === false && !SK.skipUnlitInstalled() && THREE.ShaderChunk.lights_fragment_begin === text
    && warned.some((w) => w.includes('skip-unlit patch: three.js chunk changed')) && SK.installSkipUnlitChunk() === false && warned.length === 1);
}
console.warn = warn;
reset();

// ---------------------------------------------------------------- 5. quality tiers
const { QUALITY_TIERS, tierSettings } = await import('../src/core/Quality.js');
check('both tiers turn skipUnlit on', QUALITY_TIERS.desktop.shadows.skipUnlit === true && QUALITY_TIERS.mobile.shadows.skipUnlit === true);
// the city demos' overrides (samples/nyc-night/main.js, samples/miami-drive/main.js + world.js)
const nyc = tierSettings('desktop', { shadows: { cascades: 2, kernel: 'fast', nearMapSize: 2048 } }).shadows;
const miami = { ...tierSettings('desktop', { shadows: { cascades: 2, kernel: 'fast' } }).shadows, near: 45, far: [200, 420, 650] };
const mob = tierSettings('mobile', { shadows: { cascades: 1, kernel: 'fast', singleMapSize: 1024 } }).shadows;
check('demo overrides keep skipUnlit', nyc.skipUnlit === true && miami.skipUnlit === true && mob.skipUnlit === true && nyc.cascades === 2);

console.error(results.join('\n'));
console.error(failures ? `\n${failures} skip-unlit check(s) FAILED` : '\nAll skip-unlit checks passed.');
process.exit(failures ? 1 : 0);
