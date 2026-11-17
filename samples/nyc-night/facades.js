// How dusk light sits on the facades (sample-side, on top of the engine's facade material; no engine change). The
// engine's buildings already have relief near the walker (real openings, window units with reveals, sills and lintels,
// cornices, string courses, fire escapes), but at late dusk every wall is lit by the same flat ambient (environment +
// hemisphere: the sun is down, the moon is weak), so that relief has nothing to shade it and a cream wall reads as one
// tone from street to roof. This chains a patch onto the facade materials' onBeforeCompile:
//   - grading of the indirect light: darkest in the street canyon, lifting toward the roof line where the sky still
//     reaches; ledge tops / sills catch the sky, soffits and lintel undersides go dark, jambs and piers facing the
//     afterglow are a little lighter than those facing away (the relief reads); a per-building and a slow per-wall
//     variation (nothing evenly lit);
//   - a lamp wash: the nearest street lamps (uniform list, re-picked as the camera moves) wash the first two storeys in
//     pools that fall off between lamps;
//   - lit windows that look inhabited: sparse runs of lit windows on a few floors per building, a single lit window or
//     corner office here and there, a warm or cool cast per building (not per window), and the distant-window average
//     brighter at the top (a lit ceiling) instead of identical flat cards;
//   - glass (window panes and curtain walls) mirrors the dusk sky gradient: the afterglow shows in west-facing glass;
//     below the far roofline it mirrors the block across the street (a dark wall, a few lit windows) and the nearest
//     street lamp heads, so a glass wall is not an even black grid;
//   - the engine's opt-in facade detail (Buildings.js enableFacadeDetail): dim rooms between dark and lit, room spill,
//     panes that differ, roller shades and weathering on the curtain walls, stocked shops.
// Both tiers get it (mobile: 8 lamps in the wash instead of 12).
import * as THREE from 'three';
import { enableFacadeDetail } from '@vibe/engine/world';

const GLSL_UNIFORMS = /* glsl */`
uniform vec4 uNycLamps[NYC_LAMPS];
uniform vec3 uNycLampCol;
uniform float uNycGround;
uniform vec3 uNycWest;
uniform vec3 uNycSkyZen, uNycSkyHor, uNycSkyGlow;
uniform vec4 uNycGrade; // x canyon floor, y roof lift, z sky reflection gain, w wash gain
uniform vec4 uNycOpp;   // what the glass mirrors across the street: x distance (m), y lowest roofline, z roofline spread, w lit windows
float nycGround() { return vWall.z > 0.5 ? vWall.x : uNycGround; }
// value noise (smooth), for slow variation across a wall
float nycNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y); }
// occupancy at dusk: a few floors with a tenant working late (runs of 2-7 windows), single windows / corner offices
float nycLit(vec2 uv, vec2 id, float seed) {
  float row = floor(uv.y), col = floor(uv.x);
  float occ = 0.3 + 1.4 * fract(seed * 7.13);
  float rowH = fHash(vec2(seed * 17.0 + 0.5, row));
  float runW = 2.0 + floor(6.0 * fHash(vec2(row, seed * 3.1)));
  float runH = fHash(vec2(floor((col + 13.0 * fHash(vec2(row + 2.0, seed))) / runW), row + seed * 41.0));
  float rowLit = step(rowH, uLitFrac * 0.42 * occ) * step(0.4, runH);
  float single = step(1.0 - uLitFrac * 0.16 * occ, fHash(id + 3.7));
  return max(rowLit, single);
}
`;

const GLASS_SKY = /* glsl */`
if (fGlass > 0.5 && uNycGrade.z > 0.0) {
  vec3 gN = inverseTransformDirection(normal, viewMatrix);
  vec3 wV = normalize(vWPos - cameraPosition);
  vec3 R = reflect(wV, gN);
  float e = R.y;
  vec2 rh = R.xz / max(1e-4, length(R.xz));
  float tw = max(dot(rh, uNycWest.xz), 0.0);
  vec3 sky = mix(uNycSkyHor, uNycSkyZen, pow(clamp(e, 0.0, 1.0), 0.5)) + uNycSkyGlow * exp(-max(e, 0.0) * 7.0) * pow(tw, 2.5);
  sky *= smoothstep(-0.04, 0.1, e); // below the horizon: the street and the opposite walls (dark)
  float hsG = vWPos.y - nycGround();
  sky *= mix(0.3, 1.0, smoothstep(5.0, 70.0, hsG)); // low in the canyon the opposite block hides the low sky
  float NdV = clamp(dot(gN, -wV), 0.0, 1.0);
  float F = mix(0.12, 1.0, pow(1.0 - NdV, 4.0));
  if (uNycOpp.x > 0.0) {
    // below the far roofline the glass mirrors the block across the street, not black: a dark wall with its few lit
    // windows, and the street lamps (the nearest heads, as points)
    float Rn = dot(R, gN);
    if (Rn > 0.02) {
      vec2 tw = normalize(vec2(-gN.z, gN.x));
      vec3 Hp = vWPos + R * (uNycOpp.x / Rn);
      float hg = Hp.y - nycGround(), u = dot(Hp.xz, tw);
      float roof = uNycOpp.y + uNycOpp.z * nycNoise(vec2(u / 35.0, 7.0 + fract(vInfo.z * 3.0) * 9.0));
      float wall = smoothstep(roof + 2.0, roof - 2.0, hg);
      vec2 wq = vec2(u / 2.7, hg / 3.5), ci = floor(wq), cf = fract(wq);
      float win = smoothstep(0.18, 0.3, cf.x) * smoothstep(0.82, 0.7, cf.x) * smoothstep(0.28, 0.4, cf.y) * smoothstep(0.9, 0.78, cf.y) * step(1.0, ci.y);
      float on = step(0.82, fHash(ci + 7.7 + floor(u / 60.0)));
      vec3 wc = mix(vec3(1.0, 0.68, 0.4), vec3(0.72, 0.84, 1.0), step(0.7, fHash(ci + 3.1))) * (0.4 + 0.8 * fHash(ci + 1.3));
      float aa = clamp(max(fwidth(wq.x), fwidth(wq.y)) * 1.5, 0.0, 1.0);
      vec3 lw = mix(wc * win * on, vec3(0.8, 0.66, 0.5) * 0.055, aa);
      vec3 opp = uNycSkyHor * 0.12 + lw * uNycOpp.w;
      opp *= step(0.0, hg); // the street itself: dark (its own lamps below)
      sky = mix(sky, opp, wall);
    }
    // the lamp heads, mirrored: a tight core and a soft halo (a pane is not optically flat)
    for (int i = 0; i < NYC_LAMPS; i++) {
      vec4 L = uNycLamps[i];
      vec3 d = L.xyz - vWPos; float dl = length(d);
      float c = max(dot(d / max(dl, 1e-3), R), 0.0);
      sky += uNycLampCol * L.w * (exp(-(1.0 - c) * 6000.0) * 6.0 + exp(-(1.0 - c) * 260.0) * 0.12) * (1.0 - smoothstep(30.0, 90.0, dl));
    }
  }
  totalEmissiveRadiance += sky * F * uNycGrade.z * fEnv;
}
`;

const GRADE = /* glsl */`
{
  vec3 gN = inverseTransformDirection(normal, viewMatrix);
  float hs = vWPos.y - nycGround();
  // canyon: the street floor sees a slot of sky; the roof line sees most of it
  float skyV = smoothstep(1.0, 75.0, hs);
  float canyon = mix(uNycGrade.x, uNycGrade.y, sqrt(skyV));
  canyon *= 0.78 + 0.44 * fract(vInfo.z * 5.31);                                   // per building
  canyon *= 0.8 + 0.4 * nycNoise(vec2(dot(vWPos.xz, vec2(0.7, 0.7)) / 19.0, vWPos.y / 23.0)); // slow, per wall
  float up = gN.y;
  float dirK = 1.0 + 0.7 * clamp(up, 0.0, 1.0) - 0.75 * clamp(-up, 0.0, 1.0);    // sills / ledge tops vs soffits
  vec2 hn = gN.xz / max(1e-4, length(gN.xz));
  dirK *= 1.0 + 0.38 * dot(hn, uNycWest.xz) * (1.0 - abs(up));                    // jambs / piers: the glow side
  float k = canyon * dirK;
  reflectedLight.indirectDiffuse *= k;
  reflectedLight.directDiffuse *= mix(1.0, canyon, 0.5);             // the moon's light too reads stronger up high
  reflectedLight.indirectSpecular *= fGlass > 0.5 ? mix(1.0, k, 0.5) : k;
  // the street lamps wash the first two storeys in pools. A lamp adds nothing beyond r2 = 300 (its fall-off reaches
  // 0 there), so a lamp out of that reach is skipped (exact; most of a wall is out of reach of most of the lamps)
  if (hs < 13.0 && uNycGrade.w > 0.0) {
    float wash = 0.0;
    for (int i = 0; i < NYC_LAMPS; i++) {
      vec4 L = uNycLamps[i];
      vec3 d = L.xyz - vWPos; float r2 = dot(d, d);
      if (r2 >= 300.0) continue;
      float a = L.w / (1.0 + r2 * 0.05) * (1.0 - smoothstep(90.0, 300.0, r2));
      a *= 0.25 + 0.75 * max(dot(gN, d * inversesqrt(r2 + 1e-4)), 0.0);
      a *= 1.0 - smoothstep(-1.0, 3.0, vWPos.y - L.y);                             // the head shines down
      wash += a;
    }
    wash *= 1.0 - smoothstep(5.0, 12.0, hs);
    reflectedLight.indirectDiffuse += material.diffuseColor * uNycLampCol * wash * uNycGrade.w * (fGlass > 0.5 ? 0.15 : 1.0);
  }
}
`;

function rep(src, a, b, what) {
  if (!src.includes(a)) { console.info(`[nyc] facades: patch point missing (${what})`); return src; }
  return src.replace(a, b);
}

/**
 * o: { world, camera, lamps = 12 (the nearest heads that wash the walls: each costs every wall pixel a little, lit or
 * not; the map's lamps stand 60 m and more apart and a pool reaches 17 m, so nyc-night passes 4), west: {x,z} (unit,
 * toward the afterglow), skyGain, canyon: [floor, roof], wash, opposite: [distance 24, lowest roofline 18, roofline
 * spread 45, lit windows 0.3] (what the glass mirrors across the street and the mirrored lamp heads; distance 0 = off),
 * detail: options for the engine's enableFacadeDetail (false = off) }.
 * Returns { uniforms, update(camera) }.
 */
export function gradeFacades(o) {
  const { world } = o, NL = o.lamps ?? 12;
  const U = {
    uNycLamps: { value: Array.from({ length: NL }, () => new THREE.Vector4(0, -1e4, 0, 0)) },
    uNycLampCol: { value: new THREE.Color(1.0, 0.62, 0.3) },
    uNycGround: { value: 0 },
    uNycWest: { value: new THREE.Vector3(o.west.x, 0, o.west.z) },
    uNycSkyZen: { value: new THREE.Color() }, uNycSkyHor: { value: new THREE.Color() }, uNycSkyGlow: { value: new THREE.Color() },
    uNycGrade: { value: new THREE.Vector4(o.canyon?.[0] ?? 0.32, o.canyon?.[1] ?? 1.25, o.skyGain ?? 1, o.wash ?? 0.2) },
    uNycOpp: { value: new THREE.Vector4(o.opposite?.[0] ?? 24, o.opposite?.[1] ?? 18, o.opposite?.[2] ?? 45, o.opposite?.[3] ?? 0.3) },
  };
  const setSky = () => { // the dusk sky's own twilight colours (Atmosphere uniforms), scaled by the afterglow
    const su = world.atmo.sky.material.uniforms, ag = su.uAfterglow ? su.uAfterglow.value : 1;
    U.uNycSkyZen.value.copy(su.uTwZen.value).multiplyScalar(0.6);
    U.uNycSkyHor.value.copy(su.uTwHor.value).multiplyScalar(0.5);
    U.uNycSkyGlow.value.copy(su.uTwGlow.value).multiplyScalar(0.45 * ag);
  };
  setSky();
  // the engine's opt-in facade detail (Buildings.js): dim rooms, room spill, pane variation, shades, curtain-wall weathering
  if (o.detail !== false && world.mat.facadeSet) enableFacadeDetail(world.mat.facadeSet, o.detail || {});
  for (const m of [world.mat.facade, world.mat.facadeWin]) {
    if (!m) continue;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.bind(m);
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      Object.assign(sh.uniforms, U);
      let f = sh.fragmentShader;
      f = rep(f, 'return fract(p.x * p.y); }\n', `return fract(p.x * p.y); }\n#define NYC_LAMPS ${NL}\n${GLSL_UNIFORMS}`, 'uniforms');
      // sparse, irregular lit windows (punched / texture windows), a warm or cool cast per building
      f = rep(f, 'float lit = step(1.0 - litP, hp);', 'float lit = store > 0.5 ? step(1.0 - litP, hp) : nycLit(uv, id, vInfo.z);', 'lit');
      f = rep(f, 'step(0.72, fHash(id + 9.1))', 'step(0.7, mix(fHash(id + 9.1), fract(vInfo.z * 3.91), 0.8))', 'cast');
      f = rep(f, 'lc * lit * 0.62)', 'lc * lit * 0.62 * (0.3 + 1.2 * f.y * f.y))', 'far rooms');
      // curtain walls
      f = rep(f, 'float lit = step(1.0 - uLitFrac * (0.6 + 0.9 * fract(vInfo.z * 5.7)), hp);', 'float lit = nycLit(vec2(g.x * 0.5, g.y), id, vInfo.z);', 'curtain lit');
      f = rep(f, 'lc * lit * 0.55)', 'lc * lit * 0.55 * (0.3 + 1.2 * fv * fv))', 'curtain far');
      // ceiling fixtures: not the same bright panel in every room
      f = rep(f, 'room += lc * glow * 1.4;', 'room += lc * glow * 1.4 * (0.15 + 1.1 * fHash(id + 11.3));', 'fixtures');
      f = rep(f, '+ lc * glow * 1.2;', '+ lc * glow * 1.2 * (0.15 + 1.1 * fHash(id + 11.3));', 'curtain fixtures');
      f = rep(f, 'totalEmissiveRadiance += fEmis;', `totalEmissiveRadiance += fEmis;\n${GLASS_SKY}`, 'glass sky');
      f = rep(f, 'reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);\n}', `reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);\n}\n${GRADE}`, 'grade');
      sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => `${prevKey()}-nyc-grade-${NL}`;
    m.needsUpdate = true;
  }

  const heads = (world.props && world.props.lampHeads) || [];
  const last = new THREE.Vector3(1e9, 0, 0), cam = new THREE.Vector3();
  const D = new Float32Array(NL), I = new Int32Array(NL);
  return {
    uniforms: U,
    setSky,
    update(camera, force = false) {
      cam.setFromMatrixPosition(camera.matrixWorld);
      if (!force && last.distanceToSquared(cam) < 4) return;
      last.copy(cam);
      U.uNycGround.value = world.getGroundHeight(cam.x, cam.z);
      // the nearest NL lamp heads (insertion into a small sorted list)
      let n = 0;
      for (let i = 0; i < heads.length; i++) {
        const h = heads[i], d = (h[0] - cam.x) ** 2 + (h[2] - cam.z) ** 2;
        if (n === NL && d >= D[n - 1]) continue;
        let j = n < NL ? n++ : NL - 1;
        while (j > 0 && D[j - 1] > d) { D[j] = D[j - 1]; I[j] = I[j - 1]; j--; }
        D[j] = d; I[j] = i;
      }
      const dark = world.atmo.darkness > 0.3 ? 1 : 0;
      for (let k = 0; k < NL; k++) {
        const v = U.uNycLamps.value[k];
        if (k < n) { const h = heads[I[k]]; v.set(h[0], h[1], h[2], dark); } else v.set(0, -1e4, 0, 0);
      }
    },
  };
}
