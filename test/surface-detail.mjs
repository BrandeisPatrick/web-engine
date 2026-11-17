// The weathering patch (src/render/MaterialPatches.js weathering / weatheringAt / bakeWeathering), headless. Checks
//   - it builds: the patched standard shader gets the world-position varyings, the GLSL library and the surface call
//     after normal_fragment_maps; the depth material leaves it out;
//   - deterministic: the same options and point give the same CPU result and the same baked colours; another seed
//     gives another pattern;
//   - zero amounts are the identity, defaults stay within a restrained range, grime darkens near the ground;
//   - an unpatched material is unchanged (no onBeforeCompile, no cache key change), and the other patches compile
//     exactly as before (no world varyings unless a patch asks for them).
// The picture is checked in the browser (miami-drive captures, npm run perf).
import * as THREE from 'three';
import {
  applyPatches, weathering, weatheringAt, bakeWeathering, windSway, createTimeUniforms, makeDepthMaterial, WEATHERING_DEFAULTS,
} from '../src/render/MaterialPatches.js';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `   (${detail})` : ''}`);
  return ok;
}
const compile = (mat, lib = 'standard') => {
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader };
  mat.onBeforeCompile(sh, null);
  return sh;
};

// ---- builds
const mat = applyPatches(new THREE.MeshStandardMaterial({ color: 0xe8d8c8 }), [weathering({ seed: 3, grime: 0.4 })]);
const sh = compile(mat);
check('vertex: world position varying written', /vMpWorld = \( modelMatrix \* vec4\( mvPosition\.xyz, 1\.0 \) \)\.xyz;/.test(sh.vertexShader));
check('vertex: written after the patch offset, before modelView', sh.vertexShader.indexOf('vMpWorld =') > sh.vertexShader.indexOf('mvPosition.xyz += mpOffset') && sh.vertexShader.indexOf('vMpWorld =') < sh.vertexShader.indexOf('mvPosition = modelViewMatrix * mvPosition'));
check('fragment: library and uniforms declared', sh.fragmentShader.includes('void wxWeather(') && sh.fragmentShader.includes('uniform vec4 uWxA;') && sh.fragmentShader.includes('varying vec3 vMpWorld;'));
const iMaps = sh.fragmentShader.indexOf('#include <normal_fragment_maps>'), iCall = sh.fragmentShader.indexOf('wxWeather( diffuseColor.rgb');
check('fragment: weathering runs after the normal maps, before lighting', iMaps > 0 && iCall > iMaps && iCall < sh.fragmentShader.indexOf('#include <lights_fragment_begin>'));
check('uniforms merged into the shader', sh.uniforms.uWxA && sh.uniforms.uWxA.value.x === WEATHERING_DEFAULTS.macro && sh.uniforms.uWxC.value.w === 3);
check('cache key names the patch', mat.customProgramCacheKey().includes('weather'));
const lam = compile(applyPatches(new THREE.MeshLambertMaterial(), [weathering()]), 'lambert');
check('lambert: albedo only (roughness guarded)', lam.fragmentShader.includes('wxWeather(') && lam.fragmentShader.includes('#if defined( STANDARD ) || defined( PHYSICAL )'));
const dm = makeDepthMaterial(applyPatches(new THREE.MeshStandardMaterial(), [weathering()]));
const dsh = compile(dm, 'depth');
check('depth material: no weathering', !dsh.fragmentShader.includes('wxWeather') && !dsh.vertexShader.includes('vMpWorld'));
check('options: ground origin packs mode 1', weathering({ ground: 'origin' }).uniforms.uWxGround.value.y === 1 && weathering({ ground: 2.5 }).uniforms.uWxGround.value.x === 2.5);

// ---- deterministic
const P = [123.4, 2.1, -456.7], N = [0, 0, 1];
const a = weatheringAt({ seed: 7 }, P, N, 2.1), b = weatheringAt({ seed: 7 }, P, N, 2.1);
check('CPU sample deterministic for a seed', JSON.stringify(a) === JSON.stringify(b));
let differs = 0;
for (let i = 0; i < 40; i++) { const p = [i * 1.37, 1 + (i % 5), i * -2.11]; if (Math.abs(weatheringAt({ seed: 7 }, p, N, p[1]).mul[0] - weatheringAt({ seed: 8 }, p, N, p[1]).mul[0]) > 1e-4) differs++; }
check('another seed, another pattern', differs > 30, `${differs}/40 points differ`);
const box = () => new THREE.BoxGeometry(4, 3, 2, 4, 3, 2).translate(10, 1.5, -5);
const g1 = bakeWeathering(box(), { seed: 2 }), g2 = bakeWeathering(box(), { seed: 2 });
check('baked vertex colours deterministic', g1.attributes.color.array.every((v, i) => v === g2.attributes.color.array[i]));

// ---- ranges
const zero = { macro: 0, hue: 0, roughness: 0, grime: 0, streaks: 0, dust: 0, fade: 0 };
const id = weatheringAt(zero, P, N, 0.2);
check('all amounts 0: identity', id.mul.every((v) => Math.abs(v - 1) < 1e-9) && Math.abs(id.rough) < 1e-9);
let lo = Infinity, hi = -Infinity, low = 0, high = 0, nl = 0, nh = 0;
for (let i = 0; i < 400; i++) {
  const p = [Math.sin(i) * 300, (i % 20) * 0.6, Math.cos(i * 1.3) * 300], h = p[1];
  const w = weatheringAt({}, p, [1, 0, 0], h);
  for (const v of w.mul) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const l = (w.mul[0] + w.mul[1] + w.mul[2]) / 3;
  if (h < 0.3) { low += l; nl++; } else if (h > 6) { high += l; nh++; }
}
check('defaults restrained (albedo x 0.5 .. 1.2)', lo > 0.5 && hi < 1.2, `${lo.toFixed(3)} .. ${hi.toFixed(3)}`);
check('grime darkens near the ground', low / nl < high / nh - 0.05, `${(low / nl).toFixed(3)} near vs ${(high / nh).toFixed(3)} high`);

// ---- unpatched / other patches unchanged
const plain = new THREE.MeshStandardMaterial();
check('unpatched material: stock onBeforeCompile and cache key', plain.onBeforeCompile === THREE.Material.prototype.onBeforeCompile && plain.customProgramCacheKey() === THREE.Material.prototype.customProgramCacheKey.call(plain));
const before = compile(plain);
check('unpatched material compiles the stock shader', before.vertexShader === THREE.ShaderLib.standard.vertexShader && before.fragmentShader === THREE.ShaderLib.standard.fragmentShader);
const U = createTimeUniforms();
const sway = compile(applyPatches(new THREE.MeshStandardMaterial(), [windSway(U, { strength: 0.3 })]));
check('windSway alone: no world varyings, fragment untouched', !sway.vertexShader.includes('vMpWorld') && sway.fragmentShader === THREE.ShaderLib.standard.fragmentShader);
const both = compile(applyPatches(new THREE.MeshStandardMaterial(), [windSway(U), weathering()]));
check('composes with windSway', both.vertexShader.includes('uWind') && both.vertexShader.includes('vMpWorld =') && both.fragmentShader.includes('wxWeather('));

console.log(results.join('\n'));
console.log(failures ? `\n${failures} check(s) FAILED` : `\nsurface detail: all ${results.length} checks passed`);
process.exit(failures ? 1 : 0);
