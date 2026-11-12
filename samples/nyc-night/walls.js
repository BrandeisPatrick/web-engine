// Wall surfaces that hold up close (sample-side, a chained onBeforeCompile on the engine's facade materials, like
// facades.js; no engine change). Why the facades read as untextured before: the photo sets were there, but (1) at
// dusk a wall is lit almost only by the environment + hemisphere, which is smooth over a wall, so the normal maps had
// nothing to shade (they only show under a lamp or the sun); (2) a sixth of the walls (the white post-war blocks and
// the trims) used a procedural 256 px stucco layer; (3) the sets were fine-grained (granite tiles, smooth concrete),
// so even their albedo was nearly flat at 3-10 m. texture-sets.json now carries coarser scans (brick with deep joints,
// ashlar limestone blocks with carved bands, rock-faced granite, ribbed precast panels, painted brick, white glazed
// brick), and this patch makes their relief read in the dusk light:
//   - relief: the ambient light follows the mapped normal (joint tops catch the sky, undersides and mortar beds fall
//     dark; amplified, since the real sky term is nearly isotropic) and the AO map deepens the joints;
//   - grime: rain streaks under the sills of the texture windows and in long runs down the wall, soot rising from the
//     street, lighter patches of repointing (smoother, paler mortar), a slow per-wall dirt variation;
//   - curtains behind some windows (the engine draws blinds only): drawn from the sides, with folds, lit through.
// Both tiers (mobile: no streaks under the sills, the cheaper noise).
import * as THREE from 'three';
import { WIN_RECTS } from '@vibe/engine/world';

const HEAD = /* glsl */`
uniform vec4 uWbWin[24];   // window rects per facade layer (WIN_RECTS: x0, x1, y0, y1; two per layer)
uniform vec4 uWbGrime;     // x streaks, y soot, z repointing, w relief
uniform vec3 uWbSky;       // world direction the ambient comes from (up, leaning to the afterglow)
uniform float uWbContrast; // extra albedo contrast around the scan's mean (0 = as scanned)
float wbH(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float wbN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wbH(i), wbH(i + vec2(1.0, 0.0)), f.x), mix(wbH(i + vec2(0.0, 1.0)), wbH(i + vec2(1.0, 1.0)), f.x), f.y); }
`;

// before diffuseColor.rgb *= fCol: the wall's own dirt (not on glass, signs, grates)
const GRIME = /* glsl */`
if (vWall.z > 0.5 && fGlass < 0.5 && (fMode == 0 || fMode == 1 || fMode == 3)) {
  float hsW = vWPos.y - vWall.x;
  vec2 wq = vec2(vWuv.x, vWPos.y);
  // local contrast of the scan around its own mean (a coarse mip): joints, block faces and stains read at dusk
  if (uWbContrast > 0.0) {
    vec3 mean = textureLod(uPA, vec3(fWu, fPbrF), 5.0).rgb;
    fCol *= pow(clamp(fPA.rgb / max(mean, vec3(0.02)), vec3(0.05), vec3(4.0)), vec3(uWbContrast));
  }
  // a slow per-wall variation: no wall one even tone
  float slow = wbN(wq * vec2(0.09, 0.05) + vInfo.z * 13.0);
  fCol *= 0.86 + 0.28 * slow;
  // repointing: paler, smoother patches (fresh mortar flattens the joints)
  float rp = smoothstep(0.7, 0.8, wbN(wq * vec2(0.32, 0.45) + vInfo.z * 7.0)) * uWbGrime.z;
  fCol = mix(fCol, fCol * 1.16 + 0.015, rp); fNStr *= 1.0 - 0.45 * rp;
  // rain streaks: long thin runs down the wall, patchy along it
  float col = wbN(vec2(wq.x * 2.6, wq.y * 0.07 + vInfo.z * 3.0));
  float run = smoothstep(0.62, 0.9, col) * smoothstep(0.45, 0.75, wbN(vec2(wq.x * 0.35, wq.y * 0.04 + 5.0)));
  float st = run * 0.28;
#ifdef WB_SILLS
  // under the sills of texture windows: a dark stain fanning down from each sill, a floor's height at most
  if (fMode == 0 && vInfo.x >= 0.0) {
    int L = int(vInfo.x + 0.5);
    vec2 cf = fract(vFuv), ci = floor(vFuv);
    for (int k = 0; k < 2; k++) {
      vec4 R = uWbWin[L * 2 + k];
      if (R.y <= R.x) continue;
      float below = R.z - cf.y + (cf.y > R.w ? 1.0 : 0.0);  // floors below this sill (the stain runs into the next floor)
      float inX = smoothstep(R.x - 0.02, R.x + 0.06, cf.x) * (1.0 - smoothstep(R.y - 0.06, R.y + 0.02, cf.x));
      float s = inX * step(0.0, below) * (1.0 - smoothstep(0.0, 0.55 + 0.3 * wbH(ci + float(k)), below));
      s *= 0.55 + 0.45 * wbN(vec2(cf.x * 22.0 + ci.x * 7.0, below * 2.0));
      st = max(st, s * 0.42 * step(0.25, wbH(ci + vInfo.z + float(k) * 3.1)));
    }
  }
#endif
  st *= uWbGrime.x;
  fCol *= 1.0 - st; fRough = mix(fRough, min(1.0, fRough + 0.15), st);
  // soot rising from the street (traffic, steam): ragged top, heavier near the corners of the block
  float soot = 1.0 - smoothstep(0.0, 2.6 + 2.4 * wbN(vec2(wq.x * 0.6, 3.0)), hsW);
  fCol *= 1.0 - 0.3 * soot * uWbGrime.y;
}
`;

// after the engine's AO block (before facades.js's grade, which multiplies on top): ambient follows the relief
const RELIEF = /* glsl */`
if (fGlass < 0.5 && uWbGrime.w > 0.0) {
  vec3 wn = inverseTransformDirection(normal, viewMatrix), wg = inverseTransformDirection(fNg, viewMatrix);
  float rel = dot(wn - wg, uWbSky);                       // the mapped normal's tilt toward the sky
  float k = clamp(1.0 + rel * uWbGrime.w, 0.35, 1.8);
  float cav = mix(1.0, fAO * fAO, 0.6);                    // joints and beds deeper than the engine's AO
  reflectedLight.indirectDiffuse *= k * cav;
  reflectedLight.indirectSpecular *= mix(1.0, k, 0.5);
}
`;

// curtains: some windows have them instead of blinds (drawn from the sides, folds, a warm or neutral fabric)
const CURTAIN_ANCHOR = 'room = bc * (0.11 * fDay) + bc * lc * lit * 0.65;\n      }';
const CURTAIN = /* glsl */`
      else if (hb >= 0.42 && hb < 0.66 && store < 0.5 && layer >= 0.0) {
        vec4 R = uWbWin[int(layer + 0.5) * 2];
        vec4 R2 = uWbWin[int(layer + 0.5) * 2 + 1];
        if (R2.y > R2.x && f.x > 0.5 * (R.y + R2.x)) R = R2;
        float w = max(0.05, R.y - R.x), x = (f.x - R.x) / w;
        float c1 = 0.12 + 0.3 * fHash(id + 6.1), c2 = 0.12 + 0.3 * fHash(id + 6.7);
        float c = max(step(x, c1), step(1.0 - c2, x));
        if (c > 0.5) {
          float fold = 0.72 + 0.28 * sin(x * w * 70.0 + fHash(id) * 6.0);
          vec3 cc = mix(vec3(0.62, 0.42, 0.3), vec3(0.72, 0.68, 0.6), step(0.5, fHash(id + 4.9))) * fold;
          room = cc * (0.09 * fDay) + cc * lc * lit * 0.55;
        }
      }`;

function rep(src, a, b, what) {
  if (!src.includes(a)) { console.info(`[nyc] walls: patch point missing (${what})`); return src; }
  return src.replace(a, b);
}

/**
 * o: { world, sills = true (streaks under the texture windows), grime: [streaks, soot, repointing], relief = 2.2,
 * west: {x, z} (unit, toward the afterglow) }. Returns { uniforms }.
 */
export function dressWalls(o) {
  const { world } = o;
  const win = [];
  for (let l = 0; l < 12; l++) for (let k = 0; k < 2; k++) {
    const r = WIN_RECTS[l] && WIN_RECTS[l][k];
    win.push(r ? new THREE.Vector4(r[0], r[1], r[2], r[3]) : new THREE.Vector4(0, 0, 0, 0));
  }
  const g = o.grime || [1, 1, 1];
  const sky = new THREE.Vector3(o.west ? o.west.x * 0.35 : 0, 1, o.west ? o.west.z * 0.35 : 0).normalize();
  const U = {
    uWbWin: { value: win },
    uWbGrime: { value: new THREE.Vector4(g[0], g[1], g[2], o.relief ?? 2.2) },
    uWbSky: { value: sky },
    uWbContrast: { value: o.contrast ?? 0.45 },
  };
  const sills = o.sills !== false;
  for (const m of [world.mat.facade, world.mat.facadeWin]) {
    if (!m) continue;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.bind(m);
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      Object.assign(sh.uniforms, U);
      let f = sh.fragmentShader;
      f = rep(f, 'float fHash(vec2 p)', `${sills ? '#define WB_SILLS\n' : ''}${HEAD}\nfloat fHash(vec2 p)`, 'head');
      f = rep(f, 'diffuseColor.rgb *= fCol;', `${GRIME}\ndiffuseColor.rgb *= fCol;`, 'grime');
      f = rep(f, 'reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);\n}', `reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);\n}\n${RELIEF}`, 'relief');
      f = rep(f, CURTAIN_ANCHOR, CURTAIN_ANCHOR + CURTAIN, 'curtains');
      sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => `${prevKey()}-nyc-walls-${sills ? 1 : 0}`;
    m.needsUpdate = true;
  }
  return { uniforms: U };
}
