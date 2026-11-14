import{q as b,D as L,ap as V,H as M,M as l,w as A,a1 as q,x as g,b6 as r0,C as P,h as $,S as s0,B as n0,b7 as c0,n as i0,d as l0,s as p0,u as m0,a3 as d0,b8 as J,l as Q,X as e0,a0 as t0,e as f0}from"./three.module-B_yomNYV.js";import{m as h0}from"./BufferGeometryUtils-DLVI-17q.js";import{buildCarBody as u0,surfaceZ as a0}from"./car-sdf-nPtfOsKY.js";const v0=a=>{const e=a.index?a.toNonIndexed():a;for(const o of Object.keys(e.attributes))o!=="position"&&o!=="normal"&&e.deleteAttribute(o);return e},y=a=>{const e=h0(a.map(v0));return e.computeVertexNormals(),e},x0=`
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
`,g0=`
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
`;function b0(a,e){const o=new V({color:a,metalness:.12,roughness:.45,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:3,name:"carBody"});return o.onBeforeCompile=t=>{Object.assign(t.uniforms,e),t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vCarObj;
varying vec3 vCarN;
varying vec3 vCarCam;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vCarObj = transformed;
vCarN = objectNormal;
vCarCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;`);const n=m0;t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vCarObj; varying vec3 vCarN; varying vec3 vCarCam;
uniform float uHead; uniform float uDrl; uniform float uTail; uniform float uBrake; uniform float uReverse; uniform float uIndL; uniform float uIndR;
uniform sampler2D uPlate;
${x0}`).replace("#include <color_fragment>",`#include <color_fragment>
${g0}`).replace("#include <roughnessmap_fragment>",`${n.roughnessmap_fragment.replace("float roughnessFactor = roughness;","float roughnessFactor = carRough;")}
#ifdef ENGINE_GBUFFER
engineGbRoughness = max(roughnessFactor, 0.62 * carCoat * (1.0 - carGlass)); // no SSR on the paint (self-hits on the curved
// skin sparkle); the clear coat reflects the environment; the glass (roughness 0.03) keeps its screen-space reflections
#endif`).replace("#include <metalnessmap_fragment>",n.metalnessmap_fragment.replace("float metalnessFactor = metalness;","float metalnessFactor = carMetal;")).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += carEmit;`).replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>
material.clearcoat *= carCoat;`)},o.customProgramCacheKey=()=>"miami-car-uber-sedan-1",o}function y0(){if(typeof document>"u")return new i0(new Uint8Array([230,228,220,255]),1,1);const a=document.createElement("canvas");a.width=512,a.height=256;const e=a.getContext("2d"),o=e.createLinearGradient(0,0,0,256);o.addColorStop(0,"#f4f1e8"),o.addColorStop(.6,"#f0e2c8"),o.addColorStop(1,"#e8b48a"),e.fillStyle=o,e.fillRect(0,0,512,256),e.strokeStyle="#1d3b5a",e.lineWidth=10,e.strokeRect(8,8,496,240),e.fillStyle="#d2532a",e.font="bold 36px Helvetica, Arial, sans-serif",e.textAlign="center",e.fillText("SUNCOAST",256,58),e.fillStyle="#123a5e",e.font='bold 124px "Arial Narrow", Arial, sans-serif',e.fillText("VLA 92",256,192),e.fillStyle="#4b6d84",e.font="22px Helvetica, Arial, sans-serif",e.fillText("BEACH STATE",256,234);const t=new l0(a);return t.colorSpace=p0,t.anisotropy=4,t}const h=.33,H=.235,i=.215,R=.785,K=-1.42,O=1.3;function w0(a){const e=H/2,o=[],t=(r,s)=>o.push(new Q(r,s)),n=a==="high"?10:5;t(i-.004,-e+.012);for(let r=0;r<=n;r++){const s=r/n;t(i+(h-.025-i)*s,-e-.012*Math.sin(Math.PI*s)+.012*(1-s))}if(t(h-.012,-e+.004),t(h-.002,-e+.016),a==="high")for(const r of[-.055,0,.055])t(h,r-.008),t(h-.008,r-.006),t(h-.008,r+.006),t(h,r+.008);t(h-.002,e-.016),t(h-.012,e-.004);for(let r=n;r>=0;r--){const s=r/n;t(i+(h-.025-i)*s,e+.012*Math.sin(Math.PI*s)-.012*(1-s))}t(i-.004,e-.012);const d=new J(o,a==="high"?72:32);return d.rotateZ(-Math.PI/2),d}function _0(a){const e=[],o=a==="high"?48:24,t=H/2-.01,n=[[i-.03,t-.045],[i-.012,t-.006],[i+.008,t],[i+.014,t-.012],[i-.002,t-.02],[i-.006,-t+.01],[i+.008,-t],[i-.012,-t+.004]],d=new J(n.map(([s,c])=>new Q(s,c)),o);d.rotateZ(-Math.PI/2),e.push(d);const r=5;for(let s=0;s<r;s++)for(const c of[-1,1]){const f=new e0,w=.024,p=.013;f.moveTo(.045,-w*.5),f.lineTo(i-.018,-p*.5),f.lineTo(i-.018,p*.5),f.lineTo(.045,w*.5),f.closePath();const u=new t0(f,{depth:.024,bevelEnabled:a==="high",bevelThickness:.004,bevelSize:.004,bevelSegments:1,curveSegments:1});u.rotateZ(Math.PI/2),u.rotateY(Math.PI/2),u.rotateX((s+c*.075)/r*Math.PI*2),u.translate(t-.05,0,0);const x=u.attributes.position;for(let v=0;v<x.count;v++){const _=Math.hypot(x.getY(v),x.getZ(v));x.setX(v,x.getX(v)+.032*(1-_/i))}e.push(u)}if(e.push(new g(.06,.068,.05,o/2).rotateZ(Math.PI/2).translate(t-.012,0,0)),e.push(new g(.032,.034,.02,o/2).rotateZ(Math.PI/2).translate(t+.02,0,0)),a==="high")for(let s=0;s<5;s++){const c=(s/5+.1)*Math.PI*2;e.push(new g(.009,.009,.02,6).rotateZ(Math.PI/2).translate(t+.016,Math.cos(c)*.047,Math.sin(c)*.047))}return e.push(new g(i-.012,i-.012,H-.03,o,1,!0).rotateZ(Math.PI/2)),y(e)}function P0(){const a=new e0;a.absarc(0,0,.17,-.25,1.15,!1),a.absarc(0,0,.112,1.15,-.25,!0);const e=new t0(a,{depth:.05,bevelEnabled:!0,bevelThickness:.01,bevelSize:.008,bevelSegments:2,curveSegments:10});return e.translate(0,0,-.025),e.rotateY(Math.PI/2),e}function z0(a){const e=[new g(.152,.152,.024,a==="high"?40:20).rotateZ(Math.PI/2)];return e.push(new g(.09,.09,.05,20).rotateZ(Math.PI/2).translate(.02,0,0)),y(e)}function U(a){const e=new $(.1,20,12);e.scale(.5,.4,.78);const o=e.attributes.position;for(let n=0;n<o.count;n++)o.getZ(n)>.03&&o.setZ(n,.03+(o.getZ(n)-.03)*.2);e.translate(a*.95,.985,-.5);const t=new A(.12,.022,.07).translate(a*.87,.95,-.52);return y([e,t])}function k0(){const a=[];for(const e of[-.3,.26])a.push(new A(.58,.01,.018).rotateY(.05).translate(e,.885,-.64));return y(a)}function C0(a){const e=[],o=a==="high"?24:12,t=.55,n=.215,d=a0(t,.25,2.7,-1);return e.push(new g(.032,.032,.3,o,1,!0).rotateX(Math.PI/2).translate(t,n,d-.08)),e.push(new d0(.027,.032,o).translate(t,n,d+.07)),y(e)}function S0(){const a=[];for(const e of[-.705,.705]){const o=a0(e,.315,-2.6,1);a.push(new g(.045,.048,.03,20).rotateX(Math.PI/2).translate(e,.315,o+.008))}return y(a)}function G0(a,e=.5){if(!a)return null;const o=new r0,t=Math.min(1,Math.max(0,e)),n=new P().setRGB(.03+.4*(1-t),.05+.5*(1-t),.16+.6*(1-t)),d=new P().setRGB(1.3-.7*t*t,.5+.35*(1-t),.22+.6*(1-t)*(1-t)),r=new l(new $(50,48,24),new s0({side:n0,depthWrite:!1,uniforms:{uTop:{value:n},uHor:{value:d},uGround:{value:new P(.02,.018,.02)}},vertexShader:"varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`varying vec3 vP; uniform vec3 uTop, uHor, uGround;
      void main(){ float y = vP.y;
        vec3 c = y > 0.0 ? mix(uHor * 0.45, uTop, smoothstep(0.0, 0.35, y)) : mix(uHor * 0.08, uGround, smoothstep(0.0, 0.06, -y));
        c += uHor * 1.2 * exp(-abs(y - 0.01) * 90.0);   // the bright horizon line
        gl_FragColor = vec4(c, 1.0); }`}));o.add(r);const s=(p,u,x,v,_,S)=>{const z=new l(new q(p,u),new f0({color:x,side:L}));z.position.set(v,_,S),z.lookAt(0,_,0),o.add(z)},c=.5+3*t;s(16,1.2,new P(1*c,.75*c,.45*c),0,22,-30),s(6,2.2,new P(1*c,.1*c,.55*c),-34,6,10),s(5,2,new P(.1*c,.8*c,1*c),30,5,-14),s(26,.6,new P(1.2,1,.9).multiplyScalar(.6+t),0,35,12);const f=new c0(a),w=f.fromScene(o,.02);return f.dispose(),o.traverse(p=>{p.geometry&&p.geometry.dispose(),p.material&&p.material.dispose()}),w.texture}function I0(a={}){const e=a.lod||"high",o=performance.now(),{geometry:t,stats:n}=u0({voxel:e==="high"?.017:.035}),d={uHead:{value:0},uDrl:{value:1},uTail:{value:0},uBrake:{value:0},uReverse:{value:0},uIndL:{value:0},uIndR:{value:0},uPlate:{value:y0()}},r={body:b0(a.paint??3803664,d),glass:new V({color:461067,metalness:0,roughness:.03,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:1.5,name:"mirrorGlass"}),trim:new b({color:789517,roughness:.55,metalness:.1,name:"carTrim"}),floor:new b({color:328965,roughness:.95,metalness:0,name:"underbody"}),chrome:new b({color:13948634,metalness:1,roughness:.14,side:L,name:"chrome"}),tyre:new b({color:1315862,roughness:.86,metalness:0,name:"tyre"}),rim:new b({color:12567240,metalness:1,roughness:.2,side:L,name:"rim"}),disc:new b({color:5592922,metalness:.9,roughness:.42,name:"disc"}),caliper:new b({color:10099730,metalness:.3,roughness:.38,name:"caliper"}),brake3:new b({color:2228740,roughness:.2,emissive:16716296,emissiveIntensity:0,name:"thirdBrake"}),fog:new b({color:12104352,metalness:.6,roughness:.12,emissive:16769704,emissiveIntensity:0,name:"fogLamp"})},s=new M;s.name="carBody";const c=new l(t,r.body);c.name="car-body",c.castShadow=!0,c.receiveShadow=!0;const f=new l(new A(1.5,.02,4.4).translate(0,.16,0),r.floor);f.name="car-floor";const w=new l(new A(.32,.03,.06).translate(0,.965,1.24),r.brake3);w.name="car-brake3";const p=new l(y([U(-1),U(1)]),r.body);p.castShadow=!0,p.name="car-mirrors";const u=new l(y([new q(.09,.06).translate(-.95,.985,-.465),new q(.09,.06).translate(.95,.985,-.465)]),r.glass);u.name="car-mirrorGlass";const x=new l(k0(),r.trim);x.name="car-wipers";const v=new l(C0(e),r.chrome);v.name="car-exhaust";const _=new l(S0(),r.fog);_.name="car-fog";const S=new l(y([new g(.0025,.004,.62,5).translate(.76,1.25,1.72),new g(.012,.014,.02,10).translate(.76,.945,1.72)]),r.trim);S.name="car-antenna",s.add(S),s.add(c,f,w,p,u,x,v,_);const z=w0(e),N=_0(e),Z=z0(e),D=P0(),j=[],F=[[-R,K],[R,K],[-R,O],[R,O]];for(let m=0;m<4;m++){const G=m%2===0?-1:1,C=new M;C.name=`wheel${m}`;const I=new M,T=new M;T.scale.x=G;const E=new l(z,r.tyre),Y=new l(N,r.rim),X=new l(Z,r.disc);E.castShadow=!0,E.receiveShadow=Y.receiveShadow=!0,X.position.x=-.035,T.add(E,Y,X),I.add(T);const B=new l(D,r.caliper);B.position.x=G*-.01,B.rotation.x=m<2?.25:Math.PI-.6,C.add(I,B),C.position.set(F[m][0],h,F[m][1]),j.push({root:C,spin:I,side:G,base:C.position.clone(),radius:h})}const k=m=>(m.index?m.index.count:m.attributes.position.count)/3;let W=0;s.traverse(m=>{m.isMesh&&(W+=k(m.geometry))});const o0=k(z)+k(N)+k(Z)+k(D);return{root:s,wheels:j,materials:r,lamps:d,meshes:{body:c,mirrors:p,brake3:w,fog:_},stats:{lod:e,body:n,triangles:Math.round(W+4*o0),ms:Math.round(performance.now()-o)}}}export{x0 as CAR_GLSL,I0 as buildCarModel,G0 as makeCarEnvironment};
