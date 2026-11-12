// The hero car's look. The SDF body (car-sdf.js) is ONE mesh with ONE uber material: a MeshPhysicalMaterial whose
// fragment shader re-evaluates the body's region masks in object space (windscreen / side / rear glass with a
// ceramic frit border, fluted composite head lamps, wide ribbed tail lamps with reverse / indicator cells, the
// slatted grille and intake, the plate, wheel-well liners, the underside) and sets the albedo,
// roughness, metalness, clear coat and emission of each pixel. Region edges are therefore exact at any distance,
// and the car costs one draw for the body. The paint is a metallic base under a clear coat with panel gaps (hood,
// doors, trunk, bumpers, fuel flap) drawn from the same object-space position. Roughness / metalness are set where
// three computes them, so the engine's G-buffer (SSR, TAA) sees the same values the lighting uses.
// Around the body: lathe-turned tyres (sidewall bulge, tread grooves, a lettering band), five-spoke alloys,
// discs and calipers, a third brake lamp on the parcel shelf, mirrors, wipers, fog lamps, one tailpipe, an antenna.
// Two levels of detail: 'high' (desktop: 2 cm body voxels) and 'low' (phones: 4 cm, simpler wheels).
//
//   const model = buildCarModel({ lod: 'high', paint: 0x5c0b12 });
//   model.root (Group), model.wheels[4] ({ root (steers), spin (rolls), side }), model.lamps (uniforms uHead, uDrl,
//   uTail, uBrake, uReverse, uIndL, uIndR, uFog), model.materials, model.stats
//
// Car frame: x right, y up from the tyre contact plane, z towards the rear (forward = -Z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCarBody, surfaceZ } from './car-sdf.js';
import { CAR_SPEC } from './spec.js';

const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
const merge = (list) => { const g = mergeGeometries(list.map(clean)); g.computeVertexNormals(); return g; };

// ------------------------------------------------------------------ GLSL: the body's masks (mirror of car-sdf.js M)
export const CAR_GLSL = /* glsl */`
float c_sm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float c_smax(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return max(a, b) + h * h * k * 0.25; }
float c_cabHW(float y, float z) {
  float t = clamp((y - 0.85) / 0.55, 0.0, 1.0);
  return 0.82 - 0.17 * t - 0.03 * c_sm(0.7, 1.35, z) - 0.02 * c_sm(-0.3, -0.75, z);
}
float c_zA(float y) { return -0.59 + ((y - 0.855) / 0.49) * 0.54; }
float c_zC(float y) { return 1.2 - ((y - 0.94) / 0.4) * 0.38; }
float m_windscreen(vec3 p) { return c_smax(c_smax(p.z + 0.15, 0.89 - p.y, 0.03), abs(p.x) - (c_cabHW(p.y, p.z) - 0.075), 0.04); }
float m_rear(vec3 p) { return c_smax(c_smax(max(0.94 - p.z, p.z - 1.28), 0.95 - p.y, 0.03), abs(p.x) - (c_cabHW(p.y, p.z) - 0.09), 0.05); }
float m_side(vec3 p) {
  float a = c_smax(c_smax(0.9 - p.y, p.y - 1.33, 0.02), c_smax(c_zA(p.y) - p.z, p.z - c_zC(p.y), 0.03), 0.03);
  return max(a, (c_cabHW(p.y, p.z) - 0.06) - abs(p.x));
}
float m_head(vec3 p) { float ax = abs(p.x); return c_smax(c_smax(max(0.39 - ax, ax - 0.8), max(0.56 - p.y, p.y - 0.655), 0.012), p.z + 2.3, 0.01); }
float m_tail(vec3 p) { float ax = abs(p.x); return c_smax(c_smax(max(0.42 - ax, ax - 0.835), max(0.7 - p.y, p.y - 0.84), 0.012), 2.3 - p.z, 0.01); }
float m_grille(vec3 p) { float ax = abs(p.x); return min(c_smax(c_smax(ax - 0.34, max(0.565 - p.y, p.y - 0.65), 0.01), p.z + 2.3, 0.01), c_smax(c_smax(ax - 0.62, max(0.28 - p.y, p.y - 0.4), 0.04), p.z + 2.3, 0.01)); }
float m_plate(vec3 p) { float ax = abs(p.x); return c_smax(c_smax(ax - 0.25, max(0.7 - p.y, p.y - 0.835), 0.01), 2.3 - p.z, 0.01); }
float m_handle(vec3 p) { return max(min(c_smax(abs(p.z - 0.28) - 0.075, abs(p.y - 0.79) - 0.016, 0.01), c_smax(abs(p.z - 0.8) - 0.075, abs(p.y - 0.79) - 0.016, 0.01)), 0.6 - abs(p.x)); }
float m_well(vec3 p) {
  float d = min(length(vec2(p.z + 1.42, p.y - 0.33)), length(vec2(p.z - 1.30, p.y - 0.33))) - 0.385;
  return max(d, 0.48 - abs(p.x));
}
float pgLine(float d, float on) { return on > 0.5 ? abs(d) : 1.0; }
// ---- the cabin seen through the glass (interior mapping: a ray from the glass into a few boxes; rays that leave the
// cabin through another window see the warm dusk outside, so the car reads as see-through like a real one)
float c_box(vec3 ro, vec3 ird, vec3 b0, vec3 b1) {
  vec3 t0 = (b0 - ro) * ird, t1 = (b1 - ro) * ird;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float n = max(max(tn.x, tn.y), tn.z), f = min(min(tf.x, tf.y), tf.z);
  return (f > max(n, 0.0)) ? max(n, 0.0) : 1e3;
}
vec3 carInterior(vec3 ro, vec3 rd) {
  vec3 ird = 1.0 / rd;
  vec3 col = vec3(0.012);
  float t = 1e3, k;
  vec3 outside = vec3(0.55, 0.3, 0.2);            // the sky / street through the far glass
  // leaving the cabin: the roof liner, the windscreen, the far side windows, the rear window
  float tr = rd.y > 0.0 ? (1.32 - ro.y) / rd.y : 1e3; if (tr > 0.0 && tr < t) { t = tr; col = vec3(0.075, 0.068, 0.062); }
  float fw = -0.49 * (ro.z + 0.7) + 0.54 * (ro.y - 0.855), dw = -0.49 * rd.z + 0.54 * rd.y;
  if (dw > 0.0) { float tw = -fw / dw; vec3 q = ro + rd * tw; if (tw > 0.01 && tw < t && q.y > 0.9) { t = tw; col = outside; } }
  float fr = 0.43 * (ro.z - 1.3) + 0.38 * (ro.y - 0.94), dr = 0.43 * rd.z + 0.38 * rd.y;
  if (dr > 0.0) { float tq = -fr / dr; vec3 q = ro + rd * tq; if (tq > 0.01 && tq < t && q.y > 0.96) { t = tq; col = outside; } }
  float ts = rd.x != 0.0 ? (sign(rd.x) * 0.76 - ro.x) / rd.x : 1e3;
  if (ts > 0.05 && ts < t) { vec3 q = ro + rd * ts; t = ts; col = q.y > 0.92 && q.z > c_zA(q.y) && q.z < c_zC(q.y) && abs(q.z - 0.46) > 0.04 ? outside * 0.8 : vec3(0.02); }
  float tf = rd.y < 0.0 ? (0.32 - ro.y) / rd.y : 1e3; if (tf > 0.0 && tf < t) { t = tf; col = vec3(0.012); }
  for (int s = 0; s < 2; s++) {
    float sx = s == 0 ? -1.0 : 1.0;
    vec3 a = vec3(sx * 0.1, 0.42, 0.16), b = vec3(sx * 0.62, 1.0, 0.32);       // front seat back
    k = c_box(ro, ird, min(a, b), max(a, b)); if (k < t) { t = k; col = vec3(0.05, 0.035, 0.03); }
    a = vec3(sx * 0.1, 0.32, -0.36); b = vec3(sx * 0.62, 0.52, 0.2);            // cushion
    k = c_box(ro, ird, min(a, b), max(a, b)); if (k < t) { t = k; col = vec3(0.05, 0.036, 0.03); }
    a = vec3(sx * 0.22, 1.0, 0.18); b = vec3(sx * 0.5, 1.17, 0.29);             // front headrest
    k = c_box(ro, ird, min(a, b), max(a, b)); if (k < t) { t = k; col = vec3(0.06, 0.045, 0.038); }
    a = vec3(sx * 0.24, 0.96, 1.06); b = vec3(sx * 0.52, 1.07, 1.16);           // rear headrest (on the parcel shelf line)
    k = c_box(ro, ird, min(a, b), max(a, b)); if (k < t) { t = k; col = vec3(0.055, 0.04, 0.034); }
  }
  k = c_box(ro, ird, vec3(-0.66, 0.36, 0.86), vec3(0.66, 0.96, 1.08)); if (k < t) { t = k; col = vec3(0.045, 0.032, 0.028); } // rear bench
  k = c_box(ro, ird, vec3(-0.76, 0.88, 1.08), vec3(0.76, 0.94, 1.32)); if (k < t) { t = k; col = vec3(0.02); }                // parcel shelf
  k = c_box(ro, ird, vec3(-0.8, 0.5, -0.85), vec3(0.8, 0.86, -0.46)); if (k < t) { t = k; col = vec3(0.016); }               // dash
  k = c_box(ro, ird, vec3(-0.56, 0.7, -0.47), vec3(-0.14, 1.0, -0.43)); if (k < t) { t = k; col = vec3(0.01); }             // wheel
  k = c_box(ro, ird, vec3(-0.08, 0.32, -0.6), vec3(0.08, 0.62, 0.5)); if (k < t) { t = k; col = vec3(0.022); }              // console
  k = c_box(ro, ird, vec3(-0.11, 1.18, -0.3), vec3(0.11, 1.245, -0.26)); if (k < t) { t = k; col = vec3(0.012); }           // rear-view mirror
  return col;
}
float carGap(vec3 p) {
  float ax = abs(p.x), d = 1.0;
  float side = step(0.78, ax);
  float doorY = step(0.29, p.y) * step(p.y, 0.9);
  d = min(d, pgLine(p.z + 0.66, side * doorY));                                       // front door, front edge
  d = min(d, pgLine(p.z - 0.46, side * doorY));                                       // B-pillar shut line
  d = min(d, pgLine(p.z - 0.93, side * doorY * step(0.55, p.y)));                     // rear door, rear edge
  d = min(d, pgLine(length(vec2(p.z - 1.30, p.y - 0.33)) - 0.43, side * step(0.29, p.y) * step(p.z, 0.93) * step(0.75, p.z))); // its dog-leg round the arch
  d = min(d, pgLine(p.y - 0.295, side * step(-0.66, p.z) * step(p.z, 0.86)));          // door bottoms
  float hood = step(0.78, p.y) * step(p.z, -0.7);
  d = min(d, pgLine(p.z + 0.72, step(0.8, p.y) * step(ax, 0.82)));                    // hood rear edge at the cowl
  d = min(d, pgLine(ax - 0.84, hood * step(-2.22, p.z)));                             // hood sides (on the shoulder crease)
  d = min(d, pgLine(p.z + 2.24, step(0.66, p.y) * step(ax, 0.84)));                   // hood front edge
  d = min(d, pgLine(p.z - 1.44, step(0.89, p.y) * step(ax, 0.82)));                   // trunk front edge
  d = min(d, pgLine(ax - 0.84, step(0.88, p.y) * step(1.44, p.z)));                   // trunk sides
  d = min(d, pgLine(p.y - 0.865, step(2.3, p.z) * step(ax, 0.84)));                   // trunk lip above the lamps
  d = min(d, pgLine(p.y - 0.565, step(2.32, p.z)));                                   // rear bumper
  d = min(d, pgLine(p.z - 1.96, side * step(p.y, 0.6) * step(0.22, p.y)));
  d = min(d, pgLine(p.y - 0.53, step(p.z, -2.32)));                                   // front bumper
  d = min(d, pgLine(p.z + 2.0, side * step(p.y, 0.56) * step(0.22, p.y)));
  d = min(d, pgLine(length(vec2(p.z - 1.68, p.y - 0.8)) - 0.07, step(0.8, p.x)));     // fuel flap (right)
  return d;
}
`;

const UBER_FRAG = /* glsl */`
// ---- car regions (object space) -> albedo / roughness / metalness / clear coat / emission
vec3 cP = vCarObj, cN = normalize(vCarN);
float cAx = abs(cP.x);
float carRough = 0.45, carMetal = 0.12, carCoat = 1.0, carCoatRough = 0.03;
vec3 carEmit = vec3(0.0);
float carGlass = 0.0;
{
  // glass: windscreen, side windows, rear window; a black frit border; black B-pillar and window surrounds
  float glass = 0.0, frit = 0.0;
  float cpx = max(length(fwidth(cP)) * 0.7, 1e-4); // pixel footprint (m), outside the branches (derivatives)
  if (cP.y > 0.86 && cP.z > -0.85 && cP.z < 1.4) {
    float mg = min(min(m_windscreen(cP), m_rear(cP)), m_side(cP));
    float fw = cpx;
    glass = 1.0 - smoothstep(-fw, fw, mg);
    float inner = 1.0 - smoothstep(-0.018 - fw, -0.018 + fw, mg);
    vec2 dots = fract(vec2(cP.x + cP.z, cP.y) / 0.008) - 0.5;
    float dotK = smoothstep(-0.03, -0.018, mg) * step(length(dots), 0.32);
    frit = glass * max(1.0 - inner, dotK * inner);
    float bpil = (1.0 - smoothstep(0.038, 0.042, abs(cP.z - 0.46))) * step(0.5, cAx) * glass;
    frit = max(frit, bpil);
    carGlass = glass * (1.0 - frit);
  }
  // lamps / openings (pockets carved in the geometry; the walls are dark bezels): front and rear ends only
  float head = 0.0, headB = 0.0, tail = 0.0, tailB = 0.0, gr = 0.0, pl = 0.0, plB = 0.0, hd = 0.0;
  if (cP.z < -2.2) {
    float mh = m_head(cP), mr = m_grille(cP);
    head = 1.0 - smoothstep(-0.006, -0.003, mh); headB = (1.0 - smoothstep(0.002, 0.005, mh)) * (1.0 - head);
    gr = 1.0 - smoothstep(0.0, 0.003, mr);
  } else if (cP.z > 2.2) {
    float mt = m_tail(cP), mp = m_plate(cP);
    tail = 1.0 - smoothstep(-0.006, -0.003, mt); tailB = (1.0 - smoothstep(0.002, 0.005, mt)) * (1.0 - tail);
    pl = 1.0 - smoothstep(-0.005, -0.003, mp); plB = (1.0 - smoothstep(0.002, 0.004, mp)) * (1.0 - pl);
  } else if (cAx > 0.6 && abs(cP.y - 0.79) < 0.05) {
    hd = 1.0 - smoothstep(0.0, 0.003, m_handle(cP));
  }
  float well = cAx > 0.45 && cP.y < 0.75 ? 1.0 - smoothstep(0.004, 0.012, m_well(cP)) : 0.0;
  float under = smoothstep(-0.45, -0.7, cN.y) * step(cP.y, 0.32);
  // the body-side rubbing strip (dark, satin) and the black bumper lower lips
  float strip = step(0.8, cAx) * (1.0 - smoothstep(0.024, 0.027, abs(cP.y - 0.5))) * step(abs(cP.z), 2.26) * (1.0 - well);
  float lip = (step(2.32, cP.z) + step(cP.z, -2.32)) * (1.0 - smoothstep(0.255, 0.262, cP.y));
  // paint with panel gaps
  float gapD = carGap(cP);
  float gapW = max(fwidth(gapD) * 0.75, 0.0009);
  float gapK = 1.0 - smoothstep(0.0016 - gapW, 0.0016 + gapW, gapD);
  float gapS = 1.0 - smoothstep(0.0, 0.01, gapD);
  diffuseColor.rgb *= (1.0 - 0.94 * gapK) * (1.0 - 0.16 * gapS);
  carCoat = 1.0 - gapK;
  // blend the regions over the paint (later wins)
  #define CAR_SET(w, col, r, m, c) diffuseColor.rgb = mix(diffuseColor.rgb, col, w); carRough = mix(carRough, r, w); carMetal = mix(carMetal, m, w); carCoat = mix(carCoat, c, w);
  vec3 cabin = glass > 0.0 ? carInterior(cP, normalize(cP - vCarCam)) : vec3(0.0);
  CAR_SET(glass, cabin * 0.32 + vec3(0.003, 0.003, 0.004), 0.03, 0.0, 1.0)
  carEmit += carGlass * cabin * 0.06; // the warm outside seen through the cabin (unlit by the body's own lighting)
  CAR_SET(frit, vec3(0.012), 0.42, 0.0, 0.6)
  CAR_SET(max(max(headB, tailB), max(plB, hd)), vec3(0.015), 0.45, 0.2, 0.3)
  CAR_SET(max(strip, lip), vec3(0.018), 0.55, 0.0, 0.25)
  CAR_SET(gr, vec3(0.02), 0.6, 0.2, 0.0)
  CAR_SET(max(well, under), vec3(0.007), 0.92, 0.0, 0.0)
  // grille: horizontal slats
  if (gr > 0.0) {
    float sl = smoothstep(0.3, 0.42, abs(fract(cP.y / 0.016) - 0.5));
    diffuseColor.rgb *= mix(1.0, mix(0.3, 2.4, sl), gr);
  }
  // head lamps: wide composite units, a fluted lens over a reflector, an amber corner outboard
  if (head > 0.0) {
    float flute = 0.85 + 0.15 * smoothstep(0.15, 0.45, abs(fract(cAx / 0.014) - 0.5));
    float ind = step(0.72, cAx);
    float hot = exp(-pow(length(vec2(cAx - 0.56, (cP.y - 0.607) * 1.6)) / 0.07, 2.0));
    vec3 refl = mix(vec3(0.42, 0.43, 0.44) * flute, vec3(0.45, 0.22, 0.04), ind);
    CAR_SET(head, refl, 0.08, 1.0 - ind, 1.0)
    float sideInd = cP.x < 0.0 ? uIndL : uIndR;
    carEmit += head * (vec3(1.0, 0.9, 0.74) * (1.0 - ind) * flute * (uHead * (0.9 + 3.0 * hot) + uDrl * 0.25)
      + vec3(1.0, 0.45, 0.05) * ind * sideInd * 5.0);
  }
  // tail lamps: wide rectangles, horizontal ribs, three cells per side; a small reverse cell inboard (dark unless
  // reversing); the lit colour is an orange-red, never white, kept below the clip so bloom stays moderate
  if (tail > 0.0) {
    float rib = 0.62 + 0.38 * smoothstep(0.12, 0.45, abs(fract(cP.y / 0.0115) - 0.5));
    float cell = smoothstep(0.002, 0.005, abs(fract((cAx - 0.42) / 0.1383) - 0.5) * 0.1383);
    float rev = step(cAx, 0.52);
    vec3 col = vec3(0.22, 0.035, 0.02) * rib;
    col = mix(col, vec3(0.32, 0.3, 0.29), rev * 0.8);
    col *= mix(0.45, 1.0, cell);
    CAR_SET(tail, col, 0.08, 0.1, 1.0)
    vec3 red = vec3(1.0, 0.36, 0.2);
    carEmit += tail * cell * (red * (uTail * 0.45 + uBrake * 1.8) * rib * (1.0 - rev) * (0.85 + 0.15 * smoothstep(0.42, 0.62, cAx))
      + vec3(1.0, 0.95, 0.9) * uReverse * 4.0 * rev
      + vec3(1.0, 0.42, 0.04) * (1.0 - rev) * step(0.74, cAx) * (cP.x < 0.0 ? uIndL : uIndR) * 3.0);
  }
  if (pl > 0.0) {
    vec2 puv = vec2((cP.x + 0.25) / 0.5, (cP.y - 0.70) / 0.135);
    vec3 pc = texture2D(uPlate, puv).rgb;
    CAR_SET(pl, pc * 0.32, 0.5, 0.0, 0.3)
    carEmit += pl * pc * uTail * 0.015; // a dim plate lamp
  }
  // the lit tail lamps spill red onto the bumper top and the paint just below them
  float spill = step(2.1, cP.z) * step(cP.y, 0.7) * step(0.3, cP.y) * (1.0 - tail) * (1.0 - pl);
  carEmit += spill * diffuseColor.rgb * vec3(1.0, 0.3, 0.15) * (uTail * 0.8 + uBrake * 1.6)
    * exp(-max(0.0, 0.7 - cP.y) * 9.0) * (1.0 - smoothstep(0.86, 0.95, cAx)) * smoothstep(2.1, 2.42, cP.z);
}
`;

function makeUberMaterial(paint, U) {
  const m = new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.12, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 3.0, name: 'carBody' });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCarObj;\nvarying vec3 vCarN;\nvarying vec3 vCarCam;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarObj = transformed;\nvCarN = objectNormal;\nvCarCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;');
    const C = THREE.ShaderChunk;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCarObj; varying vec3 vCarN; varying vec3 vCarCam;
uniform float uHead; uniform float uDrl; uniform float uTail; uniform float uBrake; uniform float uReverse; uniform float uIndL; uniform float uIndR;
uniform sampler2D uPlate;
${CAR_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${UBER_FRAG}`)
      .replace('#include <roughnessmap_fragment>', `${C.roughnessmap_fragment.replace('float roughnessFactor = roughness;', 'float roughnessFactor = carRough;')}
#ifdef ENGINE_GBUFFER
engineGbRoughness = max(roughnessFactor, 0.62 * carCoat * (1.0 - carGlass)); // no SSR on the paint (self-hits on the curved
// skin sparkle); the clear coat reflects the environment; the glass (roughness 0.03) keeps its screen-space reflections
#endif`)
      .replace('#include <metalnessmap_fragment>', C.metalnessmap_fragment.replace('float metalnessFactor = metalness;', 'float metalnessFactor = carMetal;'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += carEmit;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= carCoat;');
  };
  m.customProgramCacheKey = () => 'miami-car-uber-sedan-1';
  return m;
}

function plateTexture() {
  if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([230, 228, 220, 255]), 1, 1);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#f4f1e8'); grd.addColorStop(0.6, '#f0e2c8'); grd.addColorStop(1, '#e8b48a');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#1d3b5a'; g.lineWidth = 10; g.strokeRect(8, 8, 496, 240);
  g.fillStyle = '#d2532a'; g.font = 'bold 36px Helvetica, Arial, sans-serif'; g.textAlign = 'center';
  g.fillText('SUNCOAST', 256, 58);
  g.fillStyle = '#123a5e'; g.font = 'bold 124px "Arial Narrow", Arial, sans-serif';
  g.fillText('VLA 92', 256, 192);
  g.fillStyle = '#4b6d84'; g.font = '22px Helvetica, Arial, sans-serif'; g.fillText('BEACH STATE', 256, 234);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ wheels
// the sedan's own wheel geometry (car-sdf.js WHEELS_Z / WHEEL_Y); spec.js is sized for the desktop model and the
// physics' contact points are within a few cm of these
const R = 0.33, TYRE_W = 0.235, RIM_R = 0.215, TRACK = 0.785, AXLE_F = -1.42, AXLE_R = 1.30;
function tyreGeometry(lod) {
  const hw = TYRE_W / 2, pts = [];
  const add = (r, x) => pts.push(new THREE.Vector2(r, x));
  const N = lod === 'high' ? 10 : 5;
  add(RIM_R - 0.004, -hw + 0.012);
  for (let i = 0; i <= N; i++) { const t = i / N; add(RIM_R + (R - 0.025 - RIM_R) * t, -hw - 0.012 * Math.sin(Math.PI * t) + 0.012 * (1 - t)); }
  add(R - 0.012, -hw + 0.004); add(R - 0.002, -hw + 0.016);
  if (lod === 'high') for (const gx of [-0.055, 0, 0.055]) { add(R, gx - 0.008); add(R - 0.008, gx - 0.006); add(R - 0.008, gx + 0.006); add(R, gx + 0.008); }
  add(R - 0.002, hw - 0.016); add(R - 0.012, hw - 0.004);
  for (let i = N; i >= 0; i--) { const t = i / N; add(RIM_R + (R - 0.025 - RIM_R) * t, hw + 0.012 * Math.sin(Math.PI * t) - 0.012 * (1 - t)); }
  add(RIM_R - 0.004, hw - 0.012);
  // lathe: profile (radius, x) in the shape's (x, y) -> revolve about Y, then Y -> X (the axle)
  const g = new THREE.LatheGeometry(pts, lod === 'high' ? 72 : 32);
  g.rotateZ(-Math.PI / 2);
  return g;
}
function rimGeometry(lod) {
  const P = [];
  const segs = lod === 'high' ? 48 : 24;
  const hw = TYRE_W / 2 - 0.01;
  const lip = [[RIM_R - 0.03, hw - 0.045], [RIM_R - 0.012, hw - 0.006], [RIM_R + 0.008, hw], [RIM_R + 0.014, hw - 0.012], [RIM_R - 0.002, hw - 0.02], [RIM_R - 0.006, -hw + 0.01], [RIM_R + 0.008, -hw], [RIM_R - 0.012, -hw + 0.004]];
  const lg = new THREE.LatheGeometry(lip.map(([r, x]) => new THREE.Vector2(r, x)), segs); lg.rotateZ(-Math.PI / 2);
  P.push(lg);
  const nSp = 5;
  for (let s = 0; s < nSp; s++) {
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      const w0 = 0.024, w1 = 0.013;
      shape.moveTo(0.045, -w0 * 0.5); shape.lineTo(RIM_R - 0.018, -w1 * 0.5); shape.lineTo(RIM_R - 0.018, w1 * 0.5); shape.lineTo(0.045, w0 * 0.5); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: lod === 'high', bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 1 });
      // shape (x radial, y tangential), extruded along z -> radial along y, extrusion along x (the axle)
      g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2);
      g.rotateX(((s + side * 0.075) / nSp) * Math.PI * 2);
      g.translate(hw - 0.05, 0, 0);
      const pos = g.attributes.position; // concave dish: the hub sits further out than the rim end of the spoke
      for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getY(i), pos.getZ(i)); pos.setX(i, pos.getX(i) + 0.032 * (1 - r / RIM_R)); }
      P.push(g);
    }
  }
  P.push(new THREE.CylinderGeometry(0.06, 0.068, 0.05, segs / 2).rotateZ(Math.PI / 2).translate(hw - 0.012, 0, 0));
  P.push(new THREE.CylinderGeometry(0.032, 0.034, 0.02, segs / 2).rotateZ(Math.PI / 2).translate(hw + 0.02, 0, 0));
  if (lod === 'high') for (let k = 0; k < 5; k++) {
    const a = (k / 5 + 0.1) * Math.PI * 2;
    P.push(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6).rotateZ(Math.PI / 2).translate(hw + 0.016, Math.cos(a) * 0.047, Math.sin(a) * 0.047));
  }
  // the barrel's inner face (seen through the spokes)
  P.push(new THREE.CylinderGeometry(RIM_R - 0.012, RIM_R - 0.012, TYRE_W - 0.03, segs, 1, true).rotateZ(Math.PI / 2));
  return merge(P);
}
function caliperGeometry() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.17, -0.25, 1.15, false);
  shape.absarc(0, 0, 0.112, 1.15, -0.25, true);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -0.025);
  g.rotateY(Math.PI / 2); // shape plane -> the wheel plane (y-z)
  return g;
}
function discGeometry(lod) {
  const P = [new THREE.CylinderGeometry(0.152, 0.152, 0.024, lod === 'high' ? 40 : 20).rotateZ(Math.PI / 2)];
  P.push(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20).rotateZ(Math.PI / 2).translate(0.02, 0, 0)); // hat
  return merge(P);
}

// ------------------------------------------------------------------ small parts
function mirrorGeometry(side) {
  const housing = new THREE.SphereGeometry(0.1, 20, 12);
  housing.scale(0.5, 0.4, 0.78);
  const pos = housing.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > 0.03) pos.setZ(i, 0.03 + (pos.getZ(i) - 0.03) * 0.2);
  housing.translate(side * 0.95, 0.985, -0.5);
  const stalk = new THREE.BoxGeometry(0.12, 0.022, 0.07).translate(side * 0.87, 0.95, -0.52);
  return merge([housing, stalk]);
}
function wiperGeometry() {
  const P = [];
  for (const x of [-0.3, 0.26]) P.push(new THREE.BoxGeometry(0.58, 0.01, 0.018).rotateY(0.05).translate(x, 0.885, -0.64));
  return merge(P);
}
function exhaustGeometry(lod) {
  const P = [];
  const n = lod === 'high' ? 24 : 12;
  // one plain turned-down tailpipe under the right of the bumper (a 90s sedan, not a sports car)
  const sx = 0.55, y = 0.215, z0 = surfaceZ(sx, 0.25, 2.7, -1);
  P.push(new THREE.CylinderGeometry(0.032, 0.032, 0.3, n, 1, true).rotateX(Math.PI / 2).translate(sx, y, z0 - 0.08));
  P.push(new THREE.RingGeometry(0.027, 0.032, n).translate(sx, y, z0 + 0.07));
  return merge(P);
}
function fogLampGeometry() {
  const P = [];
  for (const sx of [-0.705, 0.705]) {
    const z0 = surfaceZ(sx, 0.315, -2.6, 1);
    P.push(new THREE.CylinderGeometry(0.045, 0.048, 0.03, 20).rotateX(Math.PI / 2).translate(sx, 0.315, z0 + 0.008));
  }
  return merge(P);
}

// ------------------------------------------------------------------ the paint's reflection environment
/**
 * A small "street at dusk" environment for the car's clear coat and glass (PMREM of a procedural scene): a sky
 * gradient (deep blue zenith, warm horizon band), a dark ground, the bright line of the horizon that sweeps across
 * the doors as the car turns, and a few lamp / neon cards. The scene's own environment (the Atmosphere's sky) is
 * correct but soft and dim at dusk; car renders read as glossy because of exactly these sharp features.
 * darkness 0 = day palette, 1 = night.
 */
export function makeCarEnvironment(renderer, darkness = 0.5) {
  if (!renderer) return null;
  const sc = new THREE.Scene();
  const d = Math.min(1, Math.max(0, darkness));
  const top = new THREE.Color().setRGB(0.03 + 0.4 * (1 - d), 0.05 + 0.5 * (1 - d), 0.16 + 0.6 * (1 - d));
  const hor = new THREE.Color().setRGB(1.3 - 0.7 * d * d, 0.5 + 0.35 * (1 - d), 0.22 + 0.6 * (1 - d) * (1 - d));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: top }, uHor: { value: hor }, uGround: { value: new THREE.Color(0.02, 0.018, 0.02) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 uTop, uHor, uGround;
      void main(){ float y = vP.y;
        vec3 c = y > 0.0 ? mix(uHor * 0.45, uTop, smoothstep(0.0, 0.35, y)) : mix(uHor * 0.08, uGround, smoothstep(0.0, 0.06, -y));
        c += uHor * 1.2 * exp(-abs(y - 0.01) * 90.0);   // the bright horizon line
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sc.add(sky);
  const card = (w, h, col, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, y, 0); sc.add(m); };
  const k = 0.5 + 3 * d;
  card(16, 1.2, new THREE.Color(1.0 * k, 0.75 * k, 0.45 * k), 0, 22, -30);          // a street lamp row overhead
  card(6, 2.2, new THREE.Color(1.0 * k, 0.1 * k, 0.55 * k), -34, 6, 10);             // pink neon
  card(5, 2.0, new THREE.Color(0.1 * k, 0.8 * k, 1.0 * k), 30, 5, -14);              // cyan neon
  card(26, 0.6, new THREE.Color(1.2, 1.0, 0.9).multiplyScalar(0.6 + d), 0, 35, 12);  // a long soft strip (sky light)
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(sc, 0.02);
  pm.dispose();
  sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}

// ------------------------------------------------------------------ assembly
/** @param {{ lod?: 'high' | 'low', paint?: number }} [o] */
export function buildCarModel(o = {}) {
  const lod = o.lod || 'high';
  const t0 = performance.now();
  const { geometry, stats } = buildCarBody({ voxel: lod === 'high' ? 0.017 : 0.035 });
  const U = {
    uHead: { value: 0 }, uDrl: { value: 1 }, uTail: { value: 0 }, uBrake: { value: 0 }, uReverse: { value: 0 },
    uIndL: { value: 0 }, uIndR: { value: 0 }, uPlate: { value: plateTexture() },
  };
  const mats = {
    body: makeUberMaterial(o.paint ?? 0x3a0a10, U),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x07090b, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5, name: 'mirrorGlass' }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55, metalness: 0.1, name: 'carTrim' }),
    floor: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, metalness: 0, name: 'underbody' }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd4d6da, metalness: 1, roughness: 0.14, side: THREE.DoubleSide, name: 'chrome' }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.86, metalness: 0, name: 'tyre' }),
    rim: new THREE.MeshStandardMaterial({ color: 0xbfc2c8, metalness: 1, roughness: 0.2, side: THREE.DoubleSide, name: 'rim' }),
    disc: new THREE.MeshStandardMaterial({ color: 0x55575a, metalness: 0.9, roughness: 0.42, name: 'disc' }),
    caliper: new THREE.MeshStandardMaterial({ color: 0x9a1c12, metalness: 0.3, roughness: 0.38, name: 'caliper' }),
    brake3: new THREE.MeshStandardMaterial({ color: 0x220204, roughness: 0.2, emissive: 0xff1208, emissiveIntensity: 0, name: 'thirdBrake' }),
    fog: new THREE.MeshStandardMaterial({ color: 0xb8b2a0, metalness: 0.6, roughness: 0.12, emissive: 0xffe2a8, emissiveIntensity: 0, name: 'fogLamp' }),
  };
  const root = new THREE.Group(); root.name = 'carBody';
  const body = new THREE.Mesh(geometry, mats.body); body.name = 'car-body'; body.castShadow = true; body.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 4.4).translate(0, 0.16, 0), mats.floor); floor.name = 'car-floor';
  const brake3 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.06).translate(0, 0.965, 1.24), mats.brake3); brake3.name = 'car-brake3';
  const mirrors = new THREE.Mesh(merge([mirrorGeometry(-1), mirrorGeometry(1)]), mats.body); mirrors.castShadow = true; mirrors.name = 'car-mirrors';
  const mgl = new THREE.Mesh(merge([new THREE.PlaneGeometry(0.09, 0.06).translate(-0.95, 0.985, -0.465), new THREE.PlaneGeometry(0.09, 0.06).translate(0.95, 0.985, -0.465)]), mats.glass); mgl.name = 'car-mirrorGlass';
  const wipers = new THREE.Mesh(wiperGeometry(), mats.trim); wipers.name = 'car-wipers';
  const exhaust = new THREE.Mesh(exhaustGeometry(lod), mats.chrome); exhaust.name = 'car-exhaust';
  const fog = new THREE.Mesh(fogLampGeometry(), mats.fog); fog.name = 'car-fog';
  // a whip antenna on the right rear fender
  const ant = new THREE.Mesh(merge([new THREE.CylinderGeometry(0.0025, 0.004, 0.62, 5).translate(0.76, 1.25, 1.72), new THREE.CylinderGeometry(0.012, 0.014, 0.02, 10).translate(0.76, 0.945, 1.72)]), mats.trim); ant.name = 'car-antenna';
  root.add(ant);
  root.add(body, floor, brake3, mirrors, mgl, wipers, exhaust, fog);

  // wheels: root (wheel centre; steers) > spin (rolls about x) > tyre + rim + disc; the caliper steers, never rolls
  const tyreG = tyreGeometry(lod), rimG = rimGeometry(lod), discG = discGeometry(lod), calG = caliperGeometry();
  const S = CAR_SPEC, wheels = [];
  const at = [[-TRACK, AXLE_F], [TRACK, AXLE_F], [-TRACK, AXLE_R], [TRACK, AXLE_R]];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const wroot = new THREE.Group(); wroot.name = `wheel${i}`;
    const spin = new THREE.Group();
    const face = new THREE.Group(); face.scale.x = side; // the rim's face (+x) points outwards on both sides
    const tyre = new THREE.Mesh(tyreG, mats.tyre), rim = new THREE.Mesh(rimG, mats.rim), disc = new THREE.Mesh(discG, mats.disc);
    tyre.castShadow = true; tyre.receiveShadow = rim.receiveShadow = true;
    disc.position.x = -0.035;
    face.add(tyre, rim, disc);
    spin.add(face);
    const cal = new THREE.Mesh(calG, mats.caliper); cal.position.x = side * -0.01; cal.rotation.x = i < 2 ? 0.25 : Math.PI - 0.6;
    wroot.add(spin, cal);
    wroot.position.set(at[i][0], R, at[i][1]);
    wheels.push({ root: wroot, spin, side, base: wroot.position.clone(), radius: R });
  }
  const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  let total = 0; root.traverse((m) => { if (m.isMesh) total += tris(m.geometry); });
  const wheelTris = tris(tyreG) + tris(rimG) + tris(discG) + tris(calG);
  return {
    root, wheels, materials: mats, lamps: U, meshes: { body, mirrors, brake3, fog },
    stats: { lod, body: stats, triangles: Math.round(total + 4 * wheelTris), ms: Math.round(performance.now() - t0) },
  };
}
