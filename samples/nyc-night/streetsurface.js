// The street as the richest surface in the frame (a chained onBeforeCompile patch on MapWorld's road and sidewalk
// materials, after wet.js; no engine change). Everything is world space and layered at several scales, so no tile
// repeat shows from eye height or from 30 m:
//   road      tone at 0.7 / 4 / 18 / 70 m (resurfacing ages), a crack network (Voronoi edges, 1.6 m cells) masked to
//             cracked zones and partly tar-sealed (wide, black, glossy, a hair raised), longitudinal construction joints
//             under the lane lines, transverse cracks, oil drips in the lane centres before stop lines and under parked
//             cars, polished darker wheel tracks, a grimy gutter band with grit along the kerbs, and lane / crosswalk /
//             stop-bar paint that is never clean: chipped, cracked through, eroded where the tyres run, grey-yellow.
//   sidewalk  5 ft concrete flags on the city grid (uGridAngle, the dominant street direction): scored joints with a
//             grime halo, per-flag tone, replaced (lighter) flags, cracked flags, a few settled flags tilted a degree
//             or two so lamp light catches them differently.
// Relief (cracks, joints, seams, tilted flags) goes into the shading normal as a derivative bump (screen-space dH),
// so lamp pools rake across it; the G-buffer normal (engineGbN) is updated for SSR / AO.
import * as THREE from 'three';

const COMMON = /* glsl */`
varying vec3 vStP;
uniform float uStK; uniform float uGridAngle; uniform sampler2D uDirMap; uniform vec4 uDirBox;
float sHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); } // small multipliers: stable at city-scale coordinates
vec2 sHash2(vec2 p) { return vec2(sHash(p), sHash(p + 19.19)); }
float sNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// distance to the nearest Voronoi edge (F2 - F1 approximation) and the cell id
vec3 sVoronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), o = sHash2(i + g) * 0.8 + 0.1;
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d;
  }
  return vec3(d2 - d1, id);
}
// three's perturbNormalArb (bumpmap_pars_fragment) under its own name: dHdxy = screen-space height derivatives
vec3 sBump(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)), vSigmaY = normalize(dFdy(surf_pos.xyz)), vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

const ROAD = /* glsl */`
{ // ---- nyc street surface (streetsurface.js)
  vec2 P = vStP.xz;
  float n1 = sNoise(P * 1.43), n2 = sNoise(P * 0.27 + 7.1), n3 = sNoise(P * 0.057 + 3.3), n4 = sNoise(P * 0.0143 + 9.2);
  // ages of asphalt: large resurfaced areas (blacker, finer) next to old grey wearing course
  float age = smoothstep(0.35, 0.7, n4 * 0.7 + n3 * 0.3);
  vec3 c = diffuseColor.rgb;
  c *= mix(0.72, 1.12, age) * (0.84 + 0.2 * n3 + 0.1 * n2 + 0.06 * n1);
  c = mix(c, vec3(dot(c, vec3(0.333))), 0.35 * age);                   // old asphalt: grey, the binder gone
  // cracks: long meandering ones (iso-lines of a warped noise field), some overbanded with tar (black, glossy, a hair
  // raised), and alligator cracking (Voronoi edges, 0.9 m cells) only in a few tired patches
  // (both are multiplied by longZone: its noise runs only where that is non-zero)
  float longZone = smoothstep(0.3, 0.55, sNoise(P * 0.045 + 5.0) * 0.7 + age * 0.3);
  float crack = 0.0, seal = 0.0;
  if (longZone > 0.0) {
    float cf = sNoise(P * 0.21 + vec2(n2, n1) * 0.55) * 0.75 + sNoise(P * 0.9 + 3.0) * 0.25;
    float cw = abs(cf - 0.5);
    float sealZone = step(0.5, sNoise(P * 0.03 + 11.0));
    crack = (1.0 - smoothstep(0.0025, 0.007, cw)) * longZone * (1.0 - sealZone);
    seal = (1.0 - smoothstep(0.008, 0.016, cw)) * longZone * sealZone;
  }
  float gator = smoothstep(0.74, 0.82, n3 * 0.5 + age * 0.35 + n2 * 0.25); // only the most tired patches
  if (gator > 0.0) { vec3 vo = sVoronoi(P * 1.1); crack = max(crack, (1.0 - smoothstep(0.008, 0.022, vo.x + (n1 - 0.5) * 0.03)) * gator * step(0.25, sHash(vo.yz))); }
  // longitudinal joint just beside the lane lines, transverse cracks every few metres
  float joint = 0.0, trans = 0.0;
  if (hw > 0.5) {
    float kk = floor(lx / lw + 0.5);
    float dj = lx - kk * lw - 0.22 + (sNoise(vec2(s * 0.3, kk)) - 0.5) * 0.08;
    joint = (kk >= 1.0 && kk < nL - 0.5 ? 1.0 : 0.0) * (1.0 - smoothstep(0.015, 0.05, abs(dj))) * step(0.35, sNoise(vec2(s * 0.05, kk * 3.1)));
    float cs = floor(s / 7.0), ts = cs * 7.0 + 1.0 + sHash(vec2(cs, hw)) * 5.0 + (sNoise(vec2(ac * 0.7, cs)) - 0.5) * 0.6;
    trans = (1.0 - smoothstep(0.01, 0.03, abs(s - ts))) * step(0.55, sHash(vec2(cs, 3.7 + hw))) * step(abs(ac), hw - 0.3) * box;
  }
  seal = max(seal, joint);
  crack = max(crack, trans);
  c = mix(c, vec3(0.012, 0.012, 0.013), clamp(seal * 0.85, 0.0, 1.0));   // tar
  c *= 1.0 - 0.75 * crack;
  // oil: drips down the lane centres before a stop line, spots under parked cars
  float stopZone = hasI * (1.0 - smoothstep(4.0, 26.0, dI - rA)) * smoothstep(1.0, 4.0, dI - rA);
  float fl = (fract(lx / lw) - 0.5) * lw;
  float blot = 0.0; // (only counts multiplied by stopZone)
  if (stopZone > 0.0) blot = smoothstep(0.45, 0.8, sNoise(P * 0.9 + 1.7) * 0.6 + sNoise(P * 3.1) * 0.4);
  float oil = stopZone * (1.0 - smoothstep(0.15, 0.6, abs(fl))) * (0.4 + 0.6 * blot) * step(ad, ch);
  if (pw > 0.1) {                                                        // parking lanes: one stain per car length
    float pc = floor(s / 6.2), ps = s - pc * 6.2 - 3.1 + (sHash(vec2(pc, 2.0)) - 0.5) * 2.0;
    float pd = length(vec2(ps / 1.1, (ad - (hw - pw * 0.5)) / 0.55));
    oil = max(oil, (1.0 - smoothstep(0.3, 1.0, pd + (n1 - 0.5) * 0.5)) * step(ch, ad) * step(0.3, sHash(vec2(pc, 5.0 + sign(ac)))) * 0.8);
  }
  c *= 1.0 - 0.45 * oil;
  // polished wheel tracks: darker, a little sheen (roughness below)
  c *= 1.0 - 0.14 * rTrack;
  // gutter: grime band along the kerb, grit and leaf litter caught in it
  float gut = hw > 0.5 ? smoothstep(hw - 0.55, hw - 0.08, ad) : 0.0;
  float grit = step(0.82, sHash(floor(P * 34.0))) * gut;
  c *= 1.0 - 0.38 * gut;
  c = mix(c, vec3(0.09, 0.075, 0.055), grit * 0.6);
  // litter caught along the kerb: paper scraps, receipts, leaves, a bottle cap (rotated rectangles in 0.25 m cells)
  float scrap = 0.0; vec3 scrapCol = vec3(0.0);
  if (gut > 0.05) {
    vec2 lq = vec2(s, ad) / 0.25, li = floor(lq), lf = fract(lq) - 0.5;
    float lh = sHash(li + hw * 3.1);
    if (lh < 0.16) {
      float a = sHash(li + 4.2) * 6.283, sz = 0.12 + 0.3 * sHash(li + 8.8);
      vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * (lf - (vec2(sHash(li + 1.3), sHash(li + 2.9)) - 0.5) * 0.4);
      scrap = (1.0 - smoothstep(sz, sz + 0.04, abs(r.x))) * (1.0 - smoothstep(sz * 0.55, sz * 0.55 + 0.04, abs(r.y))) * gut;
      scrapCol = lh < 0.06 ? vec3(0.42, 0.41, 0.37) : lh < 0.12 ? vec3(0.16, 0.09, 0.035) : vec3(0.3, 0.12, 0.08);
    }
  }
  c = mix(c, scrapCol, scrap);
  // pedestrian plazas and footways (no lanes): dark granite pavers, 0.6 x 0.3 m in running bond along the way
  float paveJ = 0.0;
  if (lanes < 0.5) {
    vec2 g = vec2(s / 0.6, (ac + hw) / 0.3); g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5;
    vec2 fc = fract(g), id = floor(g);
    float e = min(min(fc.x, 1.0 - fc.x) * 0.6, min(fc.y, 1.0 - fc.y) * 0.3);
    paveJ = 1.0 - smoothstep(0.003, 0.009, e);
    float lum = dot(diffuseColor.rgb, vec3(0.333));
    c = vec3(0.2, 0.198, 0.195) * (0.72 + 0.5 * sHash(id)) * (0.75 + 2.2 * lum) * (0.85 + 0.25 * n3) * (1.0 - 0.6 * paveJ);
    crack *= 0.3; seal = 0.0;
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, c, uStK);
  // paint: chipped, cracked through, eroded in the tracks, grimy
  // streaky wear along the direction of travel, fine chips, and whole areas worn thin
  float chip = 1.0; // (only counts multiplied by rPaint: its three noises run where there is paint)
  if (rPaint > 0.0) chip = smoothstep(0.3, 0.56,
    sNoise(vec2(s * 1.6, ac * 9.0)) * 0.45 + sNoise(P * 24.0) * 0.3 + sNoise(P * 0.45 + 2.0) * 0.4);
  float erode = 1.0 - 0.6 * rTrack - 0.5 * smoothstep(0.1, 0.4, oil);
  rPaint *= mix(1.0, chip * erode * (1.0 - crack) * (1.0 - 0.8 * seal) * (0.7 + 0.3 * n2), uStK);
  rPaintCol = mix(rPaintCol, yellow > white ? vec3(0.5, 0.36, 0.11) : vec3(0.46, 0.45, 0.42) * (0.85 + 0.15 * n1), uStK);
  sRough = (1.0 - 0.25 * rTrack) * mix(1.0, 0.55, seal) * mix(1.0, 0.8, oil) * (1.0 + 0.1 * gut) * (1.0 + 0.4 * scrap);
  sH = (seal * 0.25 - crack * 0.9 - gut * 0.1 - paveJ * 0.8) * uStK;
}
`;

const WALK = /* glsl */`
{ // ---- nyc sidewalk flags (streetsurface.js)
  vec2 P = vStP.xz;
  // flags follow the nearest street (uDirMap: cos / sin of 4 x its heading, 4 m cells), the city grid elsewhere
  // (nearest cell: one orientation per 2 m cell, streets within 2.5 deg of the city grid snap to it exactly)
  vec4 dm = texture2D(uDirMap, (P - uDirBox.xy) * uDirBox.zw);
  float gA = dm.b > 0.5 ? atan(dm.g * 2.0 - 1.0, dm.r * 2.0 - 1.0) * 0.25 : uGridAngle;
  float dG = mod(gA - uGridAngle + 0.785398, 1.570796) - 0.785398;
  if (abs(dG) < 0.0436) gA = uGridAngle;
  float ca = cos(gA), sa = sin(gA);
  vec2 q = vec2(ca * P.x + sa * P.y, -sa * P.x + ca * P.y) / 1.524;   // 5 ft flags on the street grid
  vec2 cell = floor(q), f = fract(q);
  float h = sHash(cell), h2 = sHash(cell + 7.3);
  float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 1.524; // metres to the joint
  float groove = 1.0 - smoothstep(0.004, 0.011, edge);
  float halo = 1.0 - smoothstep(0.01, 0.07, edge);
  float n1 = sNoise(P * 2.1), n2 = sNoise(P * 0.33 + 5.0), n3 = sNoise(P * 0.06 + 2.0);
  vec3 c = diffuseColor.rgb;
  float fresh = step(h, 0.07);                                          // a replaced flag: lighter, cleaner
  c *= mix(0.74 + 0.4 * h2, 1.22, fresh) * (0.84 + 0.22 * n3 + 0.08 * n2);
  // a cracked flag: one meandering line corner to corner
  float cracked = step(0.86, h) * step(0.5, h2 + 0.3);
  vec2 dir = normalize(vec2(1.0, h2 * 2.0 - 1.0));
  float dl = abs(dot(f - 0.5, vec2(-dir.y, dir.x)) + (n1 - 0.5) * 0.035) * 1.524;
  float crack = cracked * (1.0 - smoothstep(0.004, 0.011, dl));
  c *= 1.0 - 0.5 * groove - 0.16 * halo * (1.0 - fresh) - 0.55 * crack;
  diffuseColor.rgb = mix(diffuseColor.rgb, c, cFlat * uStK);
  // the engine's kerb tops (vertex colour 0.82) and kerb faces (0.75) where no granite stone covers them (corners,
  // plaza edges): weathered granite grey, not fresh concrete
#ifdef USE_COLOR
  float kTop = step(0.8, vColor.r) * cFlat, kFace = (1.0 - cFlat) * step(0.745, vColor.r) * step(vColor.r, 0.755);
  diffuseColor.rgb *= 1.0 - (0.42 * kTop + 0.35 * kFace) * uStK;
#endif
  sH = (-groove - crack * 0.7) * cFlat * uStK;
  // settled flags: a degree or two of tilt (a slope in the height, so lamp light picks them out)
  sTilt = (step(0.8, h2) * (vec2(sHash(cell + 3.1), sHash(cell + 9.4)) - 0.5) * 0.06) * cFlat * uStK;
  sTilt = vec2(ca * sTilt.x - sa * sTilt.y, sa * sTilt.x + ca * sTilt.y);
  sRough = mix(1.0, 1.08 - 0.12 * fresh, cFlat);
}
`;

function patch(mat, kind, U) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  const road = kind === 'road';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvStP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let fs = sh.fragmentShader.replace('#include <common>', `#include <common>\n${COMMON}`);
    // globals the later chunks read (main scope, declared before the first use)
    fs = fs.replace('void main() {', 'float sH = 0.0, sRough = 1.0; vec2 sTilt = vec2(0.0);\nvoid main() {');
    if (road) {
      const anchor = 'diffuseColor.rgb = mix(diffuseColor.rgb, rPaintCol, rPaint);';
      if (!fs.includes(anchor)) { console.warn('[street] road shader anchor missing'); return; }
      fs = fs.replace(anchor, `${ROAD}\n${anchor}`);
    } else {
      const anchor = 'mix(1.0, 1.55, cFlat); // light concrete sidewalks';
      if (!fs.includes(anchor)) { console.warn('[street] sidewalk shader anchor missing'); return; }
      fs = fs.replace(anchor, `${anchor}\n${WALK}`);
    }
    fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * sRough, 0.04, 1.0);');
    // relief: derivative bump of the height + the tilt of settled flags (world xz slope -> view space)
    fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 sDH = vec2(dFdx(sH), dFdy(sH)) * 0.012;
  normal = sBump(-vViewPosition, normal, sDH, faceDirection);
  normal = normalize(normal - (viewMatrix * vec4(sTilt.x, 0.0, sTilt.y, 0.0)).xyz);
#ifdef ENGINE_GBUFFER
  engineGbN = normal;
#endif
}`);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => `${prevKey()}|nyc-street-${kind}-1`;
  mat.needsUpdate = true;
}

/** The dominant street direction (radians, mod 90 deg) of the map's road network: the flag grid follows it. */
export function gridAngle(world) {
  const bins = new Float32Array(90);
  for (const R of (world.net && world.net.list) || []) {
    if (!R || R.filler || !R.pts) continue;
    for (let i = 0; i < R.pts.length - 1; i++) {
      const a = R.pts[i], b = R.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      let deg = (Math.atan2(dz, dx) * 180 / Math.PI) % 90; if (deg < 0) deg += 90;
      bins[Math.floor(deg) % 90] += L;
    }
  }
  let best = 0; for (let i = 1; i < 90; i++) if (bins[i] > bins[best]) best = i;
  // refine: length-weighted mean within +-2 deg of the peak
  let s = 0, w = 0; for (let k = -2; k <= 2; k++) { const i = (best + k + 90) % 90; s += (best + k + 0.5) * bins[i]; w += bins[i]; }
  return (w ? s / w : best) * Math.PI / 180;
}

/**
 * Patch the world's road and sidewalk materials (call after makeStreetsWet). Returns { uniforms } (uStK 0..1 fades
 * the whole layer: the A/B knob).
 */
/**
 * Direction field of the streets: per 2 m cell the heading (mod 90 deg) of the nearest street within 24 m, as
 * (cos 4a, sin 4a) (nearest filtering); b = 1 where a street was found.
 */
export function streetDirMap(world, cell = 2, reach = 24) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const segs = [];
  for (const R of (world.net && world.net.list) || []) {
    if (!R || R.filler || !R.pts || (R.st && R.st.minor && R.st.cls !== 'pedestrian')) continue;
    for (let i = 0; i < R.pts.length - 1; i++) {
      const a = R.pts[i], b = R.pts[i + 1];
      segs.push(a[0], a[1], b[0], b[1], (R.st && R.st.hw) || 4);
      x0 = Math.min(x0, a[0], b[0]); x1 = Math.max(x1, a[0], b[0]); z0 = Math.min(z0, a[1], b[1]); z1 = Math.max(z1, a[1], b[1]);
    }
  }
  if (!segs.length) return null;
  x0 -= reach; z0 -= reach; x1 += reach; z1 += reach;
  const W = Math.min(2048, Math.ceil((x1 - x0) / cell)), H = Math.min(2048, Math.ceil((z1 - z0) / cell));
  const cw = (x1 - x0) / W, ch = (z1 - z0) / H;
  const dist = new Float32Array(W * H).fill(Infinity), ang = new Float32Array(W * H);
  for (let k = 0; k < segs.length; k += 5) {
    const ax = segs[k], az = segs[k + 1], bx = segs[k + 2], bz = segs[k + 3], hw = segs[k + 4];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, a = Math.atan2(dz, dx);
    const r = reach + hw;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - x0) / cw)), i1 = Math.min(W - 1, Math.floor((Math.max(ax, bx) + r - x0) / cw));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - r - z0) / ch)), j1 = Math.min(H - 1, Math.floor((Math.max(az, bz) + r - z0) / ch));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * cw, pz = z0 + (j + 0.5) * ch;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
      const d = Math.hypot(ax + dx * t - px, az + dz * t - pz) - hw; // from the kerb line
      const o = j * W + i;
      if (d < dist[o] && d < reach) { dist[o] = d; ang[o] = a; }
    }
  }
  const px = new Uint8Array(W * H * 4);
  for (let o = 0; o < W * H; o++) {
    if (!(dist[o] < Infinity)) continue;
    px[o * 4] = (Math.cos(4 * ang[o]) * 0.5 + 0.5) * 255; px[o * 4 + 1] = (Math.sin(4 * ang[o]) * 0.5 + 0.5) * 255; px[o * 4 + 2] = 255; px[o * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(px, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return { texture: t, box: new THREE.Vector4(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0)) };
}

export function makeStreetSurface(world) {
  const dir = streetDirMap(world);
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); blank.needsUpdate = true;
  const U = { uStK: { value: 1 }, uGridAngle: { value: gridAngle(world) }, uDirMap: { value: dir ? dir.texture : blank }, uDirBox: { value: dir ? dir.box : new THREE.Vector4(0, 0, 1, 1) } };
  if (world.mat && world.mat.road) patch(world.mat.road, 'road', U);
  if (world.mat && world.mat.concrete) patch(world.mat.concrete, 'sidewalk', U);
  return { uniforms: U };
}

/** Darker, worn detectable-warning pads with real domes (normal map) on the engine's tactile material. */
export function wearTactile(world) {
  let mat = null;
  world.group.traverse((o) => { if (!mat && o.isMesh && o.material && o.material.roughness === 0.62 && o.material.map && o.material.map.isCanvasTexture && o.material.polygonOffsetFactor === -1) mat = o.material; });
  if (!mat) return null;
  const S = 128, cell = S / 8, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), im = g.createImageData(S, S), p = im.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const fx = (x % cell) / cell - 0.5, fy = (y % cell) / cell - 0.5, r = Math.hypot(fx, fy) / 0.34;
    let nx = 0, ny = 0;
    if (r < 1 && r > 0.45) { const k = (r - 0.45) / 0.55; nx = fx / (r * 0.34 || 1) * k * 0.8; ny = fy / (r * 0.34 || 1) * k * 0.8; }
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), i = (y * S + x) * 4;
    p[i] = (nx * 0.5 + 0.5) * 255; p[i + 1] = (-ny * 0.5 + 0.5) * 255; p[i + 2] = (nz * 0.5 + 0.5) * 255; p[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  mat.normalMap = t; mat.normalScale.set(1.2, 1.2);
  mat.color.setRGB(0.62, 0.42, 0.3); // weathered, grimy: closer to the cast-iron red-brown pads of Midtown corners
  mat.roughness = 0.7; mat.needsUpdate = true;
  return mat;
}
