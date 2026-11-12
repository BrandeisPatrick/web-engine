// Wet streets after rain: a chained onBeforeCompile patch on MapWorld's road and sidewalk materials (no engine change).
// The road shader (RoadNetwork.createRoadMaterial) already has photo asphalt, lane paint, tyre tracks and patches;
// this adds, in world space:
//   - a damp film everywhere: albedo darkened (wet asphalt absorbs), roughness pulled down,
//   - puddles from two octaves of value noise, biased into the gutters along the kerbs and into the tyre tracks: near
//     mirror roughness, flat normal (a water surface hides the asphalt's grain), darker still,
//   - the same, milder, on the sidewalk tops (concrete stays rougher: fewer, smaller puddles).
// The G-buffer roughness (GBuffer.js captures it inside roughnessmap_fragment, BEFORE the road's own tail runs) is
// re-captured after the wet roughness, so SSR sees the puddles (`engineGbRoughness` exists only under ENGINE_GBUFFER).
// Cheap fake for the forward / mobile path: an optional envMap (makeCityEnv: a dark equirect with a band of warm and
// neon blobs at the horizon, PMREM-filtered) on the wet materials, so grazing views pick up smeared city light without
// screen-space reflections. `uniforms.uWet` (0..1) fades everything at runtime (bench knob 'wet').
import * as THREE from 'three';

const NOISE = /* glsl */`
float wHash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wPuddle(vec2 p, float bias, float cover) {
  float n = wNoise(p * 0.11) * 0.64 + wNoise(p * 0.37 + 17.3) * 0.28 + wNoise(p * 0.9 + 3.1) * 0.08;
  return smoothstep(1.0 - cover, 1.0 - cover + 0.09, n + bias);
}
`;

/**
 * Patch one material (keeps its own onBeforeCompile). kind 'road' reads the road varyings (kerb gutters, tracks);
 * 'sidewalk' only up-facing faces get wet puddles.
 */
function patch(mat, kind, U, env) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWetP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWetP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const road = kind === 'road';
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWetP;\nuniform float uWet; uniform float uWetCover;\n${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float wetK = uWet, wetP = 0.0, wetUp = 1.0;
{
${road ? `  float wAd = abs(vRoad.x), wHw = vRoad.z;
  float gutter = wHw > 0.5 ? smoothstep(wHw - 1.4, wHw - 0.15, wAd) : 0.0;           // water runs to the kerbs
  float lanePos = fract(wAd / 3.3);
  float track = (1.0 - smoothstep(0.08, 0.3, abs(abs(lanePos - 0.5) - 0.24))) * 0.12; // ruts hold water
  wetP = wPuddle(vWetP.xz, gutter * 0.5 + track, uWetCover) * wetK; // standing water mostly in the gutters
  diffuseColor.rgb *= mix(1.0, 0.58, wetK);   // damp asphalt
  diffuseColor.rgb *= 0.7 + 0.55 * wNoise(vWetP.xz * 0.05 + 11.0);   // large tonal patches (resurfacing, old oil)
  diffuseColor.rgb *= 1.0 - 0.35 * wetP;      // standing water` : `  wetUp = smoothstep(0.75, 0.95, abs(dot(normalize(vNormal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))));
  wetP = wPuddle(vWetP.xz * 1.2 + 41.0, -0.02, uWetCover) * wetK * wetUp;
  diffuseColor.rgb *= mix(1.0, 0.55, wetK * wetUp);
  // city grime on the flags: large stains, dark drip lines near the kerb, chewing-gum spots (breaks the tile repeat)
  float stain = wNoise(vWetP.xz * 0.23 + 7.0) * 0.6 + wNoise(vWetP.xz * 0.9 + 2.0) * 0.4;
  vec2 gq = vWetP.xz * 14.0; float gum = step(0.985, wHash(floor(gq))) * (1.0 - smoothstep(0.18, 0.32, length(fract(gq) - 0.5)));
  diffuseColor.rgb *= mix(1.0, (0.62 + 0.6 * stain) * (1.0 - 0.45 * gum), wetUp);
  diffuseColor.rgb *= 1.0 - 0.3 * wetP;`}
}`)
      // after the road's own roughness tail (paint, tracks), which follows its roughnessmap_fragment include
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
roughnessFactor = mix(roughnessFactor, ${road ? '0.42 * roughnessFactor + 0.08' : 'mix(roughnessFactor, 0.42 * roughnessFactor + 0.07, wetUp)'}, wetK);
roughnessFactor = mix(roughnessFactor, 0.06, wetP); // puddles: glossy, not a mirror (rain-dimpled)
#ifdef ENGINE_GBUFFER
engineGbRoughness = roughnessFactor;
#endif`);
    // water fills the grain: damp surfaces lose most of their normal-map relief (else the glossy SSR sparkles), puddles all
    if (sh.fragmentShader.includes('mapN.xy *= normalScale;')) sh.fragmentShader = sh.fragmentShader.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * 1.6 * (1.0 - wetP) * (1.0 - 0.3 * wetK * wetUp); /* asphalt relief survives the damp */');
    else if (sh.fragmentShader.includes('mapN.xy *= normalScale * cFlat;')) sh.fragmentShader = sh.fragmentShader.replace('mapN.xy *= normalScale * cFlat;', 'mapN.xy *= normalScale * 1.8 * cFlat * (1.0 - wetP) * (1.0 - 0.3 * wetK * wetUp); // slab joints and wear catch the light');
  };
  mat.customProgramCacheKey = () => `${prevKey()}|nyc-wet-${kind}-1`;
  if (env) { mat.envMap = env; mat.envMapIntensity = kind === 'road' ? 0.6 : 0.4; }
  mat.needsUpdate = true;
}

/**
 * A procedural "city at night" environment (equirect canvas -> PMREM): near-black sky, a sodium / neon glow band
 * just above the horizon with brighter blobs (lit windows, signs). Used as envMap of the wet surfaces.
 */
export function makeCityEnv(renderer, seed = 7) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05060a'); sky.addColorStop(0.25, '#12131a'); sky.addColorStop(0.42, '#2a2420'); sky.addColorStop(0.5, '#4a3626'); sky.addColorStop(0.56, '#100c09'); sky.addColorStop(1, '#030303');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cols = ['#ffb46a', '#ffd9a0', '#ff5a3c', '#3cc8ff', '#ff4fd0', '#fff1d6', '#9cff6a', '#ffcf3a'];
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 220; i++) {
    const x = rnd() * W, y = H * (0.2 + rnd() * 0.31), r = 4 + rnd() * 18;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, cols[(rnd() * cols.length) | 0]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.25 + rnd() * 0.55; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromEquirectangular(tex);
  pm.dispose(); tex.dispose();
  return rt.texture;
}

/**
 * Make the world's road and sidewalk materials wet. Returns { uniforms, env } (uniforms.uWet.value 0..1).
 * @param {object} world MapWorld after load
 * @param {{ wet?: number, cover?: number, env?: THREE.Texture|null }} [o] cover: puddle share (0.25 = a quarter of the road)
 */
export function makeStreetsWet(world, { wet = 1, cover = 0.3, env = null } = {}) {
  const U = { uWet: { value: wet }, uWetCover: { value: cover } };
  if (world.mat && world.mat.road) patch(world.mat.road, 'road', U, env);
  if (world.mat && world.mat.concrete) patch(world.mat.concrete, 'sidewalk', U, env);
  return { uniforms: U, env };
}
