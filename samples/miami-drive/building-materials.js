// Materials for the Miami buildings (buildings.js): the engine's facade material set (Buildings.js
// createFacadeMaterials) in a copy of its own, chained with a weathering pass, plus the lettering atlas of the hotel
// canopies and roof signs.
//
// Weathering: a class in aInfo.x of PLAIN-mode vertices (the engine ignores x there) picks the treatment, all in
// world / wall-plane space, so it costs no texture and no download:
//   1 stucco   float texture (fine normal) + unevenness (broad normal), repainted patches a shade off, hairline
//              cracks, rain / salt streaks, a damp band at the pavement, sun-fading on the south / west faces,
//              mildew on the north faces and low down
//   2 concrete formwork board lines, drip marks, damp undersides
//   3 trim     gloss paint (a different sheen), crisp: no streaks
//   4 glass block  0.2 m blocks with mortar, pillowed faces, a faint glow at night
//   5 far facade   the near version's window bays drawn in the shader (bays and floors in the uv, the window size
//              packed in aInfo.y): interior-mapped glass with blinds and lit rooms, a reveal shadow, the stucco above
//   6 roof     gravel / membrane with seams and stains
// The uniforms the engine drives per frame (night, lit fraction, window gain, time) are shared with the world's set.
import * as THREE from 'three';
import { createFacadeMaterials } from '@vibe/engine/world';
import { NEON_NAMES } from './world.js';

export const CL = { WALL: 1, CONCRETE: 2, TRIM: 3, GLASSBLOCK: 4, FAR: 5, ROOF: 6 };

const WEATHER = /* glsl */`
{
  float mbC = vInfo.x;
  if (fMode == 3 && mbC > 0.5) {
    vec3 wN = normalize((vec4(fNg, 0.0) * viewMatrix).xyz);
    vec2 p = vWuv;
    float pw = max(fwidth(p.x), fwidth(p.y));            // metres per pixel
    float nearK = 1.0 - smoothstep(0.012, 0.05, pw);     // fine detail fades out with distance
    float hs = mbC < 1.5 ? vWPos.y - vInfo.y / 20.0 : (vWall.z > 0.5 ? vWPos.y - vWall.x : 10.0); // height above the street
    if ((mbC < 1.5 || (mbC > 4.5 && mbC < 5.5)) && uMbWeather > 0.5) {
      // ---- stucco: float texture (fine) + unevenness (broad) as normal detail, repainted patches, hairline cracks;
      // the fine work only where a pixel is under ~2 cm (branch: distant walls skip it)
      float b0 = mbN(p * 0.55 + 3.1);
      vec2 gB = vec2(dFdx(b0), dFdy(b0)) / max(pw, 1e-3) * 0.08;
      fNxy = fNxy * 0.5 + clamp(gB, -0.2, 0.2);
      fNStr = 1.0;
      if (pw < 0.012) {
        float a0 = mbN(p * 11.0);
        fNxy += clamp(vec2(dFdx(a0), dFdy(a0)) / max(pw, 1e-4) * 0.012, -0.25, 0.25) * nearK;
        vec2 pr = vec2(dot(p, vec2(0.8, 0.6)), dot(p, vec2(-0.6, 0.8)));
        float cq = pr.y * 0.7 + (mbN(vec2(pr.x * 2.5, 7.0)) - 0.5) * 0.3 + (mbN(vec2(pr.x * 13.0, 3.0)) - 0.5) * 0.05;
        float cl = abs(fract(cq) - 0.5) / 0.7;
        float cw = max(0.0015, pw * 0.5);
        float crack = (1.0 - smoothstep(cw * 0.5, cw * 1.5, cl)) * smoothstep(0.72, 0.8, mbN(vec2(pr.x * 0.55, floor(cq) * 3.1 + 5.0))) * (1.0 - smoothstep(0.004, 0.02, pw));
        fCol *= 1.0 - 0.3 * crack;
      }
      // repainted patches, a shade off, crisp edged
      vec2 pc = floor((p + vec2(mbH(floor(p / 7.0)) * 3.0, 1.0)) / vec2(2.3, 1.6));
      float ph = mbH(pc + 7.7);
      fCol *= 1.0 + step(0.86, ph) * (ph - 0.93) * 1.1;
      // rain / salt streaks running down from ledges and sills
      float st = mbN(vec2(p.x * 2.2, p.y * 0.09 + mbH(vec2(floor(p.x * 2.2), 1.0)) * 9.0));
      float streak = smoothstep(0.6, 0.9, st);
      fCol *= mix(vec3(1.0), vec3(0.84, 0.82, 0.77), streak * 0.6);
      // the damp band at the pavement (ragged top)
      if (hs < 1.4) {
        float damp = 1.0 - smoothstep(0.15, 0.6 + 0.6 * mbN(vec2(p.x * 1.4, 3.0)), hs);
        fCol *= mix(vec3(1.0), vec3(0.74, 0.76, 0.7), damp * 0.85);
        fRough = mix(fRough, 0.97, damp);
      }
      // sun-fading on the south / west faces (z is south), mildew on the north faces, low down and in patches
      float sunF = clamp(wN.z * 0.8 - wN.x * 0.5, 0.0, 1.0) * (1.0 - abs(wN.y));
      fCol = mix(fCol, vec3(dot(fCol, vec3(0.3, 0.59, 0.11))) * 1.06, 0.2 * sunF);
      float north = smoothstep(0.15, 0.7, -wN.z) * (1.0 - abs(wN.y));
      float mil = north > 0.01 || hs < 5.0 ? (north * 0.7 + 0.3) * smoothstep(0.5, 0.85, mbN(p * 0.8 + 5.0)) * (0.35 + 0.65 * (1.0 - smoothstep(0.0, 5.0, hs))) : 0.0;
      fCol *= mix(vec3(1.0), vec3(0.8, 0.84, 0.76), mil * 0.55);
      fRough = mix(fRough, 0.9, 0.3);
    } else if (mbC < 2.5 && mbC > 1.5 && uMbWeather > 0.5) {
      // ---- concrete: formwork board lines, drip marks, damp undersides
      float bl = 1.0 - smoothstep(0.0, max(0.008, pw), abs(fract(p.y / 0.15) - 0.5) * 0.15 - 0.065);
      float bv = 1.0 - smoothstep(0.0, max(0.01, pw), abs(fract(p.x / 1.22) - 0.5) * 1.22 - 0.6);
      fNxy = vec2(bv * 0.25, bl * 0.18) * nearK + (vec2(mbN(p * 13.0), mbN(p * 13.0 + 4.0)) - 0.5) * 0.25 * nearK;
      fNStr = 1.0;
      fCol *= 1.0 - 0.05 * max(bl, bv) * nearK;
      float drip = smoothstep(0.55, 0.85, mbN(vec2(p.x * 7.0, p.y * 0.7))) * (1.0 - abs(wN.y));
      fCol *= mix(vec3(1.0), vec3(0.78, 0.77, 0.74), drip * 0.6);
      if (wN.y < -0.5) fCol *= mix(1.0, 0.82, smoothstep(0.4, 0.8, mbN(p * 0.9)));
      fRough = 0.88;
    } else if (mbC > 2.5 && mbC < 3.5) {
      // ---- trim: gloss paint
      fRough = 0.38; fNStr = 0.15;
    } else if (mbC > 3.5 && mbC < 4.5) {
      // ---- glass block
      vec2 g = fract(p / 0.2), gi = floor(p / 0.2);
      float mortar = 1.0 - step(0.06, g.x) * step(g.x, 0.94) * step(0.06, g.y) * step(g.y, 0.94);
      float far = smoothstep(0.01, 0.03, pw);
      mortar = mix(mortar, 0.25, far);
      vec3 blockC = vec3(0.62, 0.74, 0.76) * (0.9 + 0.2 * mbH(gi));
      fCol = mix(blockC * 0.55, vec3(0.86, 0.86, 0.84) * 0.6, mortar);
      fNxy = (g - 0.5) * 0.9 * (1.0 - mortar) * (1.0 - far); fNStr = 1.0;
      fRough = mix(0.1, 0.8, mortar);
      fEmis += vec3(1.0, 0.84, 0.6) * uNight * (1.0 - mortar) * 0.18 * step(0.4, mbH(gi * 0.1 + vInfo.z));
      fEnv = 1.4;
    } else if (mbC > 5.5 && mbC < 6.5 && uMbWeather > 0.5) {
      // ---- roof: gravel / membrane, seams, stains
      float gr = mbN(p * 31.0);
      fNxy = (vec2(gr, mbN(p * 31.0 + 9.0)) - 0.5) * 0.7 * nearK; fNStr = 1.0;
      float seam = 1.0 - smoothstep(0.0, max(0.02, pw), abs(fract(p.x / 1.0) - 0.5) * 1.0 - 0.48);
      float stain = smoothstep(0.5, 0.82, mbN(p * 0.18 + 2.0)) * 0.7 + smoothstep(0.7, 0.9, mbN(p * 0.9)) * 0.3;
      fCol *= (0.92 + 0.16 * gr * nearK) * (1.0 - 0.07 * seam) * mix(vec3(1.0), vec3(0.62, 0.6, 0.55), stain * 0.7);
      fRough = 0.95;
    }
    // ---- far facade: the window bays of the near version (uv: bays, floors; y: window width / height x100)
    if (mbC > 4.5 && mbC < 5.5) {
      vec2 c = vFuv, cf = fract(c), ci = floor(c);
      float wf = floor(vInfo.y / 100.0) / 100.0, hf = mod(vInfo.y, 100.0) / 100.0, sf = hf > 0.85 ? 0.04 : 0.3;
      vec2 fw2 = fwidth(c) + 1e-4;
      float inX = smoothstep(-fw2.x, fw2.x, wf * 0.5 - abs(cf.x - 0.5));
      float inY = smoothstep(-fw2.y, fw2.y, cf.y - sf) * smoothstep(-fw2.y, fw2.y, sf + hf - cf.y);
      vec2 id = ci + vec2(vInfo.z * 113.0, vInfo.z * 71.0);
      float blank = step(0.93, mbH(id + 1.3)) * step(hf, 0.85);
      float win = inX * inY * (1.0 - blank);
      if (win > 0.01) {
        vec2 wl = vec2((cf.x - 0.5) / max(wf, 0.05) + 0.5, (cf.y - sf) / max(hf, 0.05));
        float hp = mbH(id + 3.7);
        float lit = step(1.0 - uLitFrac * (0.5 + 1.0 * fract(vInfo.z * 7.13)), hp);
        vec3 lc = mix(vec3(1.0, 0.66, 0.36), vec3(0.78, 0.87, 1.0), step(0.72, mbH(id + 9.1))) * uWinGain * (0.55 + 0.8 * mbH(id + 5.3)) * uNight;
        float glow = 0.0;
        vec3 room = fRoom(id, clamp(wl, 0.0, 1.0), fRt, vInfo.z, lit, lc, fDay, 0.0, glow) + lc * glow * 1.4;
        float blind = mbH(id + 21.7) < 0.4 ? 0.2 + 0.6 * mbH(id + 2.2) : 0.0;
        if (wl.y > 1.0 - blind) room = vec3(0.85, 0.82, 0.74) * (0.12 * fDay) + vec3(0.85, 0.82, 0.74) * lc * lit * 0.6;
        float farR = smoothstep(0.12, 0.45, max(fw2.x, fw2.y) * 3.0);
        vec3 avg = vec3(0.6, 0.57, 0.52) * (0.05 * fDay + lc * lit * 0.62);
        // the reveal: a shadow along the head and one jamb of the opening
        float rev = smoothstep(0.86, 0.98, wl.y) + smoothstep(0.12, 0.0, wl.x) * 0.6;
        fEmis = mix(fEmis, mix(room, avg, farR) * (1.0 - 0.6 * rev), win);
        fCol = mix(fCol, vec3(0.025), win);
        fRough = mix(fRough, 0.05, win);
        fNxy *= 1.0 - win;
        if (win > 0.5) { fGlass = 1.0; fSpec = vec3(0.05 + 0.02 * mbH(id)); fEnv = 1.5 * (1.0 - 0.5 * rev); }
      }
      // shade under each window head (the eyebrow / reveal above)
      float under = smoothstep(sf + hf + 0.12, sf + hf, cf.y) * step(sf + hf, cf.y) * inX;
      fCol *= 1.0 - 0.25 * under;
    }
  }
}
`;

const NOISE = /* glsl */`
uniform float uMbWeather;
float mbH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
uniform sampler2D uMbNoise; // 64 x 64 value-noise lattice, one cell per texel, repeating: bilinear = value noise
float mbN(vec2 p) { return texture2D(uMbNoise, (p + 0.5) / 64.0).r; }
`;

/**
 * The building materials: a facade material set of its own (the same textures as the world's), chained with the
 * weathering pass; its per-frame uniforms are the world set's own objects.
 */
export function miamiFacadeMaterials(world, { weather = true } = {}) {
  const T = world.tex;
  const set = createFacadeMaterials(T.facade, T.pbr);
  const eng = world.mat.facadeSet.uniforms;
  for (const k of ['uNight', 'uLitFrac', 'uWinGain', 'uTime', 'uClock']) if (eng[k]) set.uniforms[k] = eng[k];
  set.uniforms.uMbWeather = { value: weather ? 1 : 0 }; // phones: the far windows, glass block and trim only
  set.uniforms.uMbNoise = { value: noiseTexture() };
  const m = set.facade, prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace('varying vec3 vWall;', `varying vec3 vWall;\n${NOISE}`)
      .replace('diffuseColor.rgb *= fCol;', `${WEATHER}\ndiffuseColor.rgb *= fCol;`);
  };
  m.customProgramCacheKey = () => 'roadster-facade-3-miami-weather';
  return set;
}

/** The lattice behind mbN(): 64 x 64 random bytes, repeating, filtered (one texel per noise cell, mipmapped). */
function noiseTexture() {
  const n = 64, d = new Uint8Array(n * n * 4);
  let a = 9137;
  for (let i = 0; i < n * n; i++) { a = (a * 1103515245 + 12345) >>> 0; const v = (a >>> 16) & 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ lettering atlas (canopies, roof signs)
/**
 * Hotel names (invented, world.js NEON_NAMES) lettered on boards: column 0 a canopy fascia (dark letters on cream),
 * column 1 a roof sign (white letters on a coloured board). Returns { material, cell(nameIndex, style) -> [u0, v0, u1, v1],
 * uniforms: { uLit } } or null without a DOM. The emissive map holds the letters only (lit at dusk).
 */
export function signAtlas() {
  if (typeof document === 'undefined') return null;
  const W = 1024, cw = 512, ch = 96, rows = NEON_NAMES.length, H = 2048;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const ca = mk(), ce = mk(), ga = ca.getContext('2d'), ge = ce.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const boards = ['#1d4f5c', '#9c2533', '#e8e1cf', '#22324f', '#2c6e4e'];
  NEON_NAMES.forEach((name, i) => {
    for (let s = 0; s < 2; s++) {
      const x0 = s * cw, y0 = i * ch;
      const bg = s === 0 ? '#efe7d4' : boards[i % boards.length], fg = s === 0 ? '#1c2a33' : (bg === '#e8e1cf' ? '#a3202c' : '#fbf6ea');
      ga.fillStyle = bg; ga.fillRect(x0, y0, cw, ch);
      ga.strokeStyle = s === 0 ? '#b9ad92' : '#f3efe4'; ga.lineWidth = 4; ga.strokeRect(x0 + 6, y0 + 6, cw - 12, ch - 12);
      const font = s === 0 ? `600 ${ch * 0.5}px "Futura", "Avenir Next", "Trebuchet MS", sans-serif` : `bold ${ch * 0.6}px "Futura", "Avenir Next", "Trebuchet MS", sans-serif`;
      for (const g of [ga, ge]) {
        g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = g === ga ? fg : '#fff';
        const t = s === 0 ? name.split('').join(String.fromCharCode(8202)) : name;
        g.fillText(t, x0 + cw / 2, y0 + ch / 2 + 3, cw - 40);
      }
    }
  });
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false; return t; };
  const material = new THREE.MeshStandardMaterial({ map: tex(ca, true), emissiveMap: tex(ce, true), emissive: new THREE.Color(1, 0.86, 0.62), emissiveIntensity: 0, roughness: 0.55, metalness: 0, name: 'miamiSigns' });
  return {
    material,
    cell: (i, style) => { const k = i % rows; return [style * cw / W, k * ch / H, (style + 1) * cw / W, (k + 1) * ch / H]; },
    setLit: (on) => { material.emissiveIntensity = 2.6 * on; },
  };
}
