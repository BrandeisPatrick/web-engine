import{W as ct,F as G,P as D,a as Vt}from"./FacadeTextures-C-sPHzmD.js";import{s as Dt,d as it,c as Mt,r as $t,p as Yt}from"./geom-CY3Snety.js";import{G as It}from"./GBuffer-Dhsz133z.js";import{c as Y}from"./noise-g5kHFeMn.js";import{l as Qt,f1 as Et,dR as Jt,dq as Wt,eu as t0,z as Bt,G as nt,i as qt,a as Ft,dA as e0,dz as ft,cu as n0,V as Ct,f6 as s0,C as dt,df as wt,as as i0,at as o0,el as a0,D as l0,S as Ht}from"./three.core-BG5Iv3B7.js";const S={WALL:0,WALLONLY:1,PANE:2,PLAIN:3,GRATE:4,SIGN:5,CLOCK:6,CURTAIN:7,LED:8},k=(A,e)=>A+64*e,r0=`
uniform highp sampler2DArray uAlb;
uniform highp sampler2DArray uDat;
uniform highp sampler2DArray uPA;
uniform highp sampler2DArray uPN;
uniform float uPbrSize[16];
uniform float uNight;
uniform float uLitFrac;
uniform float uWinGain;
uniform float uTime;
uniform float uClock;
#ifdef FACADE_DETAIL
uniform vec4 uFd;  // facade detail (enableFacadeDetail): x dim rooms, y room spill, z pane variation, w curtain-wall shades
uniform vec4 uFd2; // x spandrel / mullion weathering
#endif
varying vec2 vFuv;
varying vec2 vWuv;
varying vec4 vInfo;
varying vec3 vTint;
varying vec3 vWPos;
varying vec3 vWall; // street height, overhang (AO) height, 1 = wall vertex
float fHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// interior mapping: room box behind the glass. id = room cell, f = entry point (0..1), rt = tangent-space ray
// (x along the wall, y up, z out of the wall; rt.z < 0 looking in). Returns lit colour (pre-exposure).
#ifdef FACADE_DETAIL
float fRoomDim = 0.0; // set per pixel: 1 = a dim room (a lamp deep in the flat), no ceiling fixtures lit
#endif
vec3 fRoom(vec2 id, vec2 f, vec3 rt, float seed, float lit, vec3 lcol, float day, float store, out float glow) {
  vec3 r = vec3(rt.x * 1.15, rt.y, min(rt.z, -0.06) * 0.8);
  vec3 rr = vec3(r.x >= 0.0 ? max(r.x, 1e-4) : min(r.x, -1e-4), r.y >= 0.0 ? max(r.y, 1e-4) : min(r.y, -1e-4), r.z);
  vec3 p = vec3(f, 0.0);
  vec3 tB = (vec3(rr.x > 0.0 ? 1.0 : 0.0, rr.y > 0.0 ? 1.0 : 0.0, -1.0) - p) / rr;
  glow = 0.0;
  float t = min(tB.x, min(tB.y, tB.z));
  vec3 h = p + rr * t;
  float h1 = fHash(id + seed * 31.7), h2 = fHash(id.yx + seed * 7.3 + 3.1);
  vec3 wallC = mix(mix(vec3(0.7, 0.64, 0.55), vec3(0.5, 0.54, 0.58), h1), vec3(0.78, 0.74, 0.68), h2 * 0.5);
  vec3 floorC = mix(vec3(0.16, 0.14, 0.13), vec3(0.36, 0.26, 0.17), h2);
  vec3 c; float lightTerm;
  if (t == tB.z) { // back wall (+ desk / shelf silhouettes)
    c = wallC; lightTerm = 0.75;
    float dk = step(h.y, 0.34) * step(0.12, h.x) * step(h.x, 0.88);
    c = mix(c, vec3(0.18, 0.15, 0.12), dk * step(0.35, h1));
    c = mix(c, vec3(0.3, 0.32, 0.36), step(0.45, h.y) * step(h.y, 0.8) * step(abs(h.x - 0.5), 0.12) * step(0.7, h2));
  } else if (t == tB.y) {
    if (rr.y > 0.0) { // ceiling with light panels
      c = vec3(0.86, 0.86, 0.84); lightTerm = 0.55;
      vec2 pn = fract(vec2(h.x * 2.0, -h.z * 2.5));
      float panel = step(0.25, pn.x) * step(pn.x, 0.75) * step(0.3, pn.y) * step(pn.y, 0.7);
      glow = panel;
    } else { c = floorC; lightTerm = 0.6; }
  } else { c = wallC * 0.85; lightTerm = 0.6; }
#ifdef FACADE_DETAIL
  if (store > 0.5) { // a shop, not an empty box: stocked shelves on the back and side walls, a tiled floor
    if (t != tB.y && h.y > 0.1 && h.y < 0.84) {
      float u = (t == tB.z ? h.x : -h.z) * 13.0, y5 = h.y * 5.0, sh = fract(y5);
      vec2 pc = vec2(floor(u), floor(y5)) + id * 3.1;
      float fill = step(sh, 0.22 + 0.7 * fHash(pc + 1.7)) * step(0.12, fract(u)) * step(0.22, fHash(pc + seed));
      vec3 pcol = 0.06 + 0.6 * vec3(fHash(pc + 2.1), fHash(pc + 3.3), fHash(pc + 4.7));
      c = mix(c, mix(vec3(dot(pcol, vec3(0.33))), pcol, 0.7) * (0.75 + 0.5 * step(0.5, sh)), fill);
      c = mix(c, vec3(0.2, 0.19, 0.18), step(sh, 0.07));
    } else if (t == tB.y && rr.y <= 0.0) { vec2 tl = floor(vec2(h.x * 6.0, -h.z * 6.0)); c = mix(vec3(0.5, 0.48, 0.44), vec3(0.3, 0.29, 0.28), mod(tl.x + tl.y, 2.0)); }
  }
#endif
  float depth = clamp(-h.z, 0.0, 1.0);
  // a desk in front of the back wall for half the rooms
  vec3 dmin = vec3(0.15, 0.0, -0.62), dmax = vec3(0.85, 0.3, -0.42);
  vec3 t0 = (dmin - p) / rr, t1 = (dmax - p) / rr;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float te = max(max(tn.x, tn.y), tn.z), tx = min(min(tf.x, tf.y), tf.z);
  if (h1 > 0.5 && te < tx && te > 0.0 && te < t) { c = vec3(0.16, 0.13, 0.1) + 0.1 * h2; depth = 0.5; lightTerm = 0.5; }
  float dayK = mix(1.0, 0.25, depth) * lightTerm * (0.07 + 0.1 * store);
  float nightK = lit * (0.55 + 0.45 * lightTerm) * mix(1.0, 0.6, depth);
  glow *= lit;
#ifdef FACADE_DETAIL
  // a dim room is lit by one lamp low and deep in the room: no ceiling panels, the ceiling and the front of the room
  // fall dark, the back wall keeps the light (seen from the street below, a warm glow, not floating squares)
  glow *= 1.0 - fRoomDim;
  nightK *= mix(1.0, (t == tB.y && rr.y > 0.0 ? 0.25 : 1.0) * mix(0.35, 1.3, depth), fRoomDim);
#endif
  return c * (dayK * day) * vec3(1.0, 0.98, 0.95) + c * lcol * nightK;
}
`,c0=`
float fModeF = floor(vInfo.w / 64.0 + 0.001);
float fPbrF = vInfo.w - fModeF * 64.0;
int fMode = int(fModeF + 0.5);
vec3 fNg = normalize(vNormal);
vec3 fUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
vec3 fTv = cross(fNg, fUpV);
fTv = dot(fTv, fTv) < 1e-4 ? normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz) : normalize(fTv);
vec3 fBv = cross(fTv, fNg);
vec3 fRd = normalize(-vViewPosition);
vec3 fRt = vec3(dot(fRd, fTv), dot(fRd, fBv), dot(fRd, fNg));
int fPi = int(fPbrF + 0.5);
vec2 fWu = vWuv / uPbrSize[fPi];
vec4 fPA = texture(uPA, vec3(fWu, fPbrF));
vec4 fPN = texture(uPN, vec3(fWu, fPbrF));
vec3 fCol = fPA.rgb * vTint;
float fRough = fPN.b;
float fMetal = 0.0;
float fAO = fPA.a;
vec2 fNxy = fPN.rg * 2.0 - 1.0;
float fNStr = 1.0;
vec3 fEmis = vec3(0.0);
float fGlass = 0.0;
vec3 fSpec = vec3(0.04);
float fEnv = 1.0;
float fDay = 1.0 - uNight;
float fDayR = fDay; // how much of the room shows when it is not lit (FACADE_DETAIL: some spill at night)
#ifdef FACADE_DETAIL
fDayR = max(fDay, uFd.y);
#endif
if (fMode == 0 || fMode == 2) {
  float layer = vInfo.x;
  float store = 0.0;
  if (fMode == 0 && vInfo.y >= 0.0 && vFuv.y < 1.0) layer = vInfo.y;
  if (layer > 7.5 && layer < 8.5) store = 1.0;
  if (layer >= 0.0) {
    vec2 uv = vFuv;
    vec4 d0 = texture(uDat, vec3(uv * 0.25, layer));
    bool reveal = false;
    if (fMode == 0 && d0.r > 0.75) {
      vec2 sh = fRt.xy / max(0.25, -fRt.z) * vec2(0.06, 0.05) * (1.0 + store);
      vec4 d1 = texture(uDat, vec3((uv + sh) * 0.25, layer));
      if (d1.r < 0.75) reveal = true; else { uv += sh; d0 = d1; }
    }
    if (reveal) {
      fCol *= 0.42; fNStr = 0.4;
    } else if (d0.r > 0.75) {
      // ---- glass + interior
      vec2 id = floor(uv) + vec2(vInfo.z * 113.0, vInfo.z * 71.0);
      vec2 f = fract(uv);
      float fl = fHash(vec2(vInfo.z * 17.0, floor(uv.y)));
      float hp = mix(fHash(id + 3.7), fl, 0.55);
      float litP = store > 0.5 ? 0.92 : uLitFrac * (0.5 + 1.0 * fract(vInfo.z * 7.13));
      float lit = step(1.0 - litP, hp);
      vec3 lc = mix(vec3(1.0, 0.66, 0.36), vec3(0.78, 0.87, 1.0), step(0.72, fHash(id + 9.1)));
      if (store > 0.5) lc = vec3(1.0, 0.84, 0.64);
      lc *= uWinGain * (0.55 + 0.8 * fHash(id + 5.3)) * (1.0 + 0.6 * store) * uNight;
#ifdef FACADE_DETAIL
      // rooms between dark and lit: a lamp deep in the flat, a hall light through a door, a television (cool, dim)
      float fdD = step(fHash(id + 17.3), uFd.x) * (1.0 - step(0.5, lit)) * (1.0 - store);
      vec3 fdC = mix(vec3(1.0, 0.68, 0.4), vec3(0.55, 0.7, 1.0), step(0.6, fHash(id + 18.9)));
      lit = mix(lit, 0.08 + 0.22 * fHash(id + 18.1), fdD);
      lc = mix(lc, fdC * uWinGain * uNight, fdD);
      fRoomDim = fdD;
#endif
      float glow = 0.0;
      vec3 room = fRoom(id, f, fRt, vInfo.z, lit, lc, fDayR, store, glow);
      room += lc * glow * 1.4;
      // blinds (at the glass plane)
      float hb = fHash(id + 21.7);
      float blind = hb < 0.42 && store < 0.5 ? (0.25 + 0.6 * fHash(id + 2.2)) : 0.0;
      if (f.y > 1.0 - blind) {
        float slat = 0.8 + 0.2 * step(0.5, fract(f.y * 26.0));
        vec3 bc = mix(vec3(0.85, 0.82, 0.74), vec3(0.6, 0.62, 0.62), step(0.5, fHash(id + 4.4))) * slat;
        room = bc * (0.11 * fDay) + bc * lc * lit * 0.65;
      }
      // distant windows: fade the parallax room to its average (no moire)
      float px = max(fwidth(uv.x), fwidth(uv.y));
      float far = smoothstep(0.12, 0.45, px);
      vec3 avg = vec3(0.6, 0.57, 0.52) * (0.04 * fDayR * (1.0 + store) + lc * lit * 0.62);
      fEmis = mix(room, avg, far);
      fGlass = 1.0;
      fCol = vec3(0.025);
      fRough = 0.05;
      fSpec = vec3(0.05);
      fEnv = 1.5;
      fNxy = (vec2(fHash(id + 0.3), fHash(id + 0.7)) - 0.5) * 0.035;
      fNStr = 1.0;
#ifdef FACADE_DETAIL
      { // no two panes alike: the reflection's strength and tint, and a pane that is not quite flat (bent reflections)
        float fdP = fHash(id + 23.1);
        fEnv *= mix(1.0, 0.6 + 0.8 * fdP, uFd.z);
        fSpec *= mix(vec3(1.0), fdP > 0.72 ? vec3(0.86, 1.0, 0.9) : vec3(1.0, 0.97, 0.92), uFd.z);
        fNxy += vec2(sin(f.y * 3.3 + fdP * 6.3), sin(f.x * 2.9 + fdP * 9.1)) * 0.01 * uFd.z;
      }
#endif
    } else if (d0.r > 0.25) {
      // ---- trim (frames, sills, spandrels)
      vec4 ta = texture(uAlb, vec3(uv * 0.25, layer));
      fCol = ta.rgb * mix(1.0, fPA.a, 0.5) * (0.85 + 0.3 * dot(fPA.rgb, vec3(0.33)));
      fRough = d0.g; fMetal = d0.b; fNStr = 0.25;
    }
  }
} else if (fMode == 7) {
  // ---- glass curtain wall: analytic mullion grid, spandrels, interior, coated reflective glass
  float variant = vInfo.x;
  vec2 g = vFuv;
  vec2 fw = fwidth(g) + 1e-4;
  float fu = fract(g.x), fv = fract(g.y);
  float mw = variant > 2.5 ? 0.075 : 0.03;
  float hw = variant > 2.5 ? 0.012 : 0.022;
  float md = min(fu, 1.0 - fu);
  float mull = 1.0 - smoothstep(mw - fw.x, mw + fw.x, md);
  float sp0 = (variant > 0.5 && variant < 1.5) ? 0.0 : ((variant > 1.5 && variant < 2.5) ? 0.33 : 0.23);
  float spand = sp0 > 0.0 ? 1.0 - smoothstep(sp0 - fw.y, sp0 + fw.y, fv) : 0.0;
  float tr = 1.0 - smoothstep(hw - fw.y, hw + fw.y, min(fv, 1.0 - fv));
  float frame = max(mull, tr);
  vec2 cell = vec2(floor(g.x * 0.5), floor(g.y));
  vec2 id = cell + vec2(vInfo.z * 113.0, vInfo.z * 71.0);
  float fl = fHash(vec2(vInfo.z * 17.0, cell.y));
  float hp = mix(fHash(id + 3.7), fl, 0.75);
  float lit = step(1.0 - uLitFrac * (0.6 + 0.9 * fract(vInfo.z * 5.7)), hp);
  vec3 lc = mix(vec3(1.0, 0.86, 0.66), vec3(0.85, 0.92, 1.0), step(0.5, fHash(vec2(vInfo.z, cell.y)))) * uWinGain * (0.6 + 0.6 * fHash(id + 5.3)) * uNight;
  float glow = 0.0;
  vec2 f = vec2(fract(g.x * 0.5), fv);
  vec3 room = fRoom(id, f, fRt, vInfo.z, lit, lc, fDayR * 1.2, 0.0, glow) + lc * glow * 1.2;
#ifdef FACADE_DETAIL
  { // roller shades drawn to different heights, panel by panel (the lit floors are not one bright band)
    float pn = floor(g.x);
    float sh = fHash(id + 21.7 + pn) < uFd.w ? 0.12 + 0.8 * fHash(id + 2.2 + pn) : 0.0;
    if (fv > 1.0 - sh) {
      vec3 bc = mix(vec3(0.8, 0.78, 0.72), vec3(0.4, 0.42, 0.44), step(0.55, fHash(id + 4.4 + pn)));
      room = bc * (0.1 * fDayR) + bc * lc * lit * 0.6;
    }
  }
#endif
  float far = smoothstep(0.12, 0.45, max(fwidth(g.x * 0.5), fw.y));
  room = mix(room, vec3(0.55) * (0.04 * fDayR + lc * lit * 0.55), far);
  vec3 tint = vTint;
  fGlass = 1.0;
  fCol = tint * 0.05;
  fRough = 0.035;
  fSpec = mix(vec3(0.07), tint * 0.22, 0.75);
  fEmis = room * tint * 0.9;
  fNxy = (vec2(fHash(id + 0.31 + floor(g.x)), fHash(id + 0.77 + floor(g.x))) - 0.5) * 0.02;
  fNStr = 1.0;
  float envK = 1.0;
#ifdef FACADE_DETAIL
  { // panel by panel: reflection strength, a slight bow in the glass (reflections bend at the mullions)
    float fdP = fHash(id + 23.1 + floor(g.x));
    envK *= mix(1.0, 0.65 + 0.7 * fdP, uFd.z);
    fNxy += vec2(sin(fu * 3.14159) - 0.64, sin(fv * 3.14159) - 0.64) * (fdP - 0.3) * 0.016 * uFd.z;
  }
#endif
  // shadow band under each slab edge: top of the vision glass reads darker (deeper, no interior light)
  float slabSh = smoothstep(0.8, 0.985, fv) * (1.0 - spand);
  fEmis *= 1.0 - 0.55 * slabSh; envK *= 1.0 - 0.3 * slabSh;
  if (variant > 0.5 && variant < 1.5) { float sl = 1.0 - smoothstep(0.02, 0.07, fv); fEmis *= 1.0 - 0.8 * sl; envK *= 1.0 - 0.45 * sl; } // floor slab through full-height glass
  if (spand > 0.5) {
    // opaque spandrel panels: dark back-painted glass / painted metal, much less sky than the vision glass
    if (variant > 1.5 && variant < 2.5) { fGlass = 0.0; fCol = vec3(0.24, 0.25, 0.26) * (0.8 + 0.4 * dot(tint, vec3(0.33))); fMetal = 0.55; fRough = 0.42; fEmis = vec3(0.0); }
    else { fCol = tint * 0.018; fEmis = vec3(0.0); fSpec = mix(vec3(0.04), tint * 0.11, 0.6); envK *= 0.55; }
    float band = smoothstep(sp0 - 0.07, sp0 - 0.005, fv); // shade under the vision-glass sill
    fCol *= 1.0 - 0.35 * band; envK *= 1.0 - 0.25 * band;
#ifdef FACADE_DETAIL
    { // panels differ (replaced, faded), and the rain runs down from the sill: duller, darker streaks
      float pv = fHash(vec2(floor(g.x), cell.y) + vInfo.z * 13.0);
      fCol *= 1.0 + (pv - 0.5) * 0.5 * uFd2.x;
      float run = fHash(vec2(floor(fu * 7.0) + floor(g.x) * 7.0, cell.y + vInfo.z * 5.0));
      float st = step(0.55, run) * smoothstep(0.0, sp0, fv) * uFd2.x;
      envK *= 1.0 - 0.45 * st; fRough = mix(fRough, 0.6, 0.5 * st);
    }
#endif
  }
  if (frame > 0.01) {
    vec3 mc = variant > 2.5 ? vec3(0.75, 0.76, 0.77) : (fract(vInfo.z * 3.3) > 0.5 ? vec3(0.62, 0.64, 0.66) : vec3(0.16, 0.16, 0.17));
    fCol = mix(fCol, mc, frame);
    fEmis *= 1.0 - frame;
    fMetal = mix(fMetal, 0.85, frame);
    fRough = mix(fRough, 0.32, frame);
    fGlass *= 1.0 - step(0.5, frame);
#ifdef FACADE_DETAIL
    // mullions: dirt collects on the transoms' tops and runs down the verticals; anodising worn in patches
    fCol *= 1.0 - frame * uFd2.x * (0.25 * fHash(vec2(floor(g.x), cell.y + 3.0)) + 0.2 * tr * step(fv, 0.5));
    fRough = mix(fRough, 0.55, frame * uFd2.x * 0.5 * fHash(vec2(floor(g.x) + 7.0, cell.y)));
#endif
    fNxy = mix(fNxy, vec2((fu < 0.5 ? -1.0 : 1.0) * mull * 0.7, (fv < 0.5 ? -1.0 : 1.0) * tr * 0.5), frame);
  }
  fAO = 1.0;
  fEnv = mix(0.6, 1.8, smoothstep(2.0, 25.0, g.y)) * envK; // scene.environmentIntensity is low (~0.5): glass reflects the full sky
} else if (fMode == 4) {
  // ---- grate (fire escapes, railings): vInfo.x 0 bars, 1 stair treads, 2 ladder
  float pat = vInfo.x;
  vec2 g = vFuv;
  float bar = 0.0, dens;
  if (pat < 0.5) {
    float bx = abs(fract(g.x / 0.12) - 0.5) * 0.12;
    bar = max(step(bx, 0.011), max(step(0.93, g.y), step(g.y, 0.05)));
    dens = fwidth(g.x / 0.12);
  } else if (pat < 1.5) {
    float tv = abs(fract(g.y / 0.22) - 0.5) * 0.22;
    bar = max(step(tv, 0.035), max(step(g.x, 0.09), step(0.91, g.x)));
    dens = fwidth(g.y / 0.22);
  } else {
    float tv = abs(fract(g.y / 0.3) - 0.5) * 0.3;
    bar = max(step(tv, 0.016), max(step(g.x, 0.11), step(0.89, g.x)));
    dens = fwidth(g.y / 0.3);
  }
  if (dens > 0.35) bar = step(fHash(gl_FragCoord.xy), 0.4);
  if (bar < 0.5) discard;
  fCol = vTint; fRough = 0.6; fMetal = 0.5; fNStr = 0.0;
} else if (fMode == 5) {
  // ---- signs (vInfo.x > 0.5: lit, lettering) and awnings (fabric, vInfo.y: stripes)
  if (vInfo.x > 0.5) {
    vec2 g = vFuv;
    float cellw = 0.3;
    float ci = floor(g.x / cellw);
    vec2 lp = vec2(fract(g.x / cellw), (g.y - 0.22) / 0.56);
    float word = step(0.16, fHash(vec2(floor(ci / 5.0), vInfo.z * 37.0)));           // word gaps
    float glyph = step(0.42, fHash(vec2(ci * 3.0 + floor(lp.x * 3.0), floor(lp.y * 5.0) + vInfo.z * 91.0)));
    float lk = glyph * word * step(0.12, lp.x) * step(lp.x, 0.88) * step(0.0, lp.y) * step(lp.y, 1.0);
    float edge = step(0.3, g.x) * step(g.x, max(0.6, vInfo.y - 0.3));
    lk *= edge;
    vec3 lcol = fHash(vec2(vInfo.z, 4.0)) > 0.5 ? vec3(1.0, 0.96, 0.86) : vec3(1.0, 0.85, 0.35);
    fCol = mix(vTint, lcol, lk * 0.9);
    fEmis = mix(vTint * 0.35, lcol * 1.6, lk) * uNight * 2.2;
    fRough = 0.4; fNStr = 0.0;
  } else {
    float stripe = vInfo.y > 0.5 ? step(0.5, fract(vFuv.x / 0.42)) : 0.0;
    fCol = mix(vTint, vec3(0.92, 0.9, 0.86), stripe) * (fPA.rgb / 0.58);
    fRough = 0.9;
  }
} else if (fMode == 6) {
  // ---- clock face (Ferry Building)
  vec2 q = vFuv - 0.5;
  float rr = length(q);
  if (rr < 0.5) {
    float ang = atan(q.x, q.y);
    float hrs = mod(uClock, 12.0);
    float ha = hrs / 12.0 * 6.2831853, ma = fract(uClock) * 6.2831853;
    vec2 hd = vec2(sin(ha), cos(ha)), mdv = vec2(sin(ma), cos(ma));
    float hand = 0.0;
    float th = dot(q, hd), tm = dot(q, mdv);
    hand = max(hand, step(abs(q.x * hd.y - q.y * hd.x), 0.018) * step(-0.03, th) * step(th, 0.24));
    hand = max(hand, step(abs(q.x * mdv.y - q.y * mdv.x), 0.012) * step(-0.03, tm) * step(tm, 0.38));
    float tick = step(0.38, rr) * step(rr, 0.45) * step(abs(fract(ang / 6.2831853 * 12.0 + 0.5) - 0.5), 0.04);
    float rim = step(0.46, rr);
    float ink = max(max(hand, tick), rim);
    fCol = mix(vec3(0.92, 0.9, 0.84), vec3(0.06, 0.06, 0.07), ink);
    fEmis = vec3(1.0, 0.92, 0.75) * (1.0 - ink) * uNight * 1.6;
    fRough = 0.35; fNStr = 0.0;
  }
} else if (fMode == 8) {
  // ---- LEDs: 0 outline bulbs (Embarcadero Center), 1 animated crown (Salesforce Tower), 2 red beacon
  if (vInfo.x < 0.5) {
    float b = 1.0 - smoothstep(0.08, 0.32, length(vec2(fract(vFuv.x / 0.7) - 0.5, (vFuv.y - 0.5) * 0.5)));
    fCol = vec3(0.7); fEmis = vec3(1.0, 0.93, 0.8) * (0.15 + 1.8 * b) * uNight * 2.0;
  } else if (vInfo.x < 1.5) {
    float w = 0.5 + 0.5 * sin(vFuv.y * 0.18 - uTime * 0.7 + 2.0 * sin(vFuv.x * 0.9 + uTime * 0.23));
    w = pow(w, 3.0);
    fCol = vTint * 0.7; fEmis = mix(vec3(0.5, 0.7, 1.0), vec3(1.0, 0.98, 0.95), w) * (0.25 + 2.2 * w) * uNight * 1.6;
  } else {
    float blink = step(0.5, fract(uTime * 0.5 + vInfo.z));
    fCol = vec3(0.6, 0.05, 0.03); fEmis = vec3(1.0, 0.08, 0.04) * (0.3 + 2.5 * blink) * (0.3 + uNight);
  }
  fNStr = 0.0; fRough = 0.3;
}
if (vWall.z > 0.5) {
  float hs = vWPos.y - vWall.x;                                   // height above the street
  float streak = fHash(vec2(floor(vWuv.x * 2.3), 7.0));
  float gr = 1.0 - smoothstep(0.03, 0.55 + 1.1 * streak, hs);     // splash / dirt band, ragged top
  gr *= 0.8 + 0.4 * fHash(floor(vWuv * vec2(5.0, 9.0)));
  float ao = vWall.y > -1e3 ? smoothstep(vWall.y - 1.6, vWall.y, vWPos.y) * (1.0 - smoothstep(vWall.y, vWall.y + 0.08, vWPos.y)) : 0.0;
  if (fGlass < 0.5) {
    fCol *= (1.0 - 0.34 * gr) * mix(vec3(1.0), vec3(0.94, 0.9, 0.84), gr) * (1.0 - 0.36 * ao);
    fRough = mix(fRough, 0.95, 0.6 * gr);
  } else { fEmis *= 1.0 - 0.45 * ao; fEnv *= 1.0 - 0.3 * ao - 0.25 * gr; }
  fAO *= 1.0 - 0.45 * ao;
}
diffuseColor.rgb *= fCol;
`;function f0(A,e){const t=e?`
attribute vec4 iP; attribute vec4 iD; attribute vec4 iF; attribute vec4 iInfo; attribute vec3 iTint;
attribute vec2 aOff; attribute float aPart;`:`
attribute vec2 aFuv; attribute vec4 aInfo; attribute vec3 aTint; attribute float aWu; attribute vec2 aGy;`;return A.replace("#include <common>",`#include <common>${t}
varying vec2 vFuv; varying vec2 vWuv; varying vec4 vInfo; varying vec3 vTint; varying vec3 vWPos; varying vec3 vWall;`).replace("#include <beginnormal_vertex>",e?`
vec3 wD = vec3(iD.x, 0.0, iD.y); vec3 wO = vec3(iD.y, 0.0, -iD.x);
vec3 objectNormal = wD * normal.x + vec3(0.0, normal.y, 0.0) + wO * normal.z;`:"vec3 objectNormal = vec3( normal );").replace("#include <begin_vertex>",e?`
int wFl = int(iInfo.y + 0.5);
bool wOn = aPart < 1.5 || (aPart < 2.5 ? (wFl & 2) != 0 : (wFl & 1) != 0);
float wZ = position.z * (aPart < 1.5 ? iP.w : 1.0);
vec3 transformed = wOn ? iP.xyz + wD * (position.x * iD.z + aOff.x) + vec3(0.0, position.y * iD.w + aOff.y, 0.0) + wO * wZ : iP.xyz;
vFuv = iF.xy + position.xy * iF.zw;
vInfo = aPart < 0.5 ? vec4(iInfo.x, -1.0, iInfo.z, ${k(D.PLAIN,S.PANE)}.0) : vec4(-1.0, -1.0, iInfo.z, iInfo.w);
vTint = iTint;`:`
vec3 transformed = vec3( position );
vFuv = aFuv; vInfo = vec4(aInfo.xy, aInfo.z * 0.001, aInfo.w); vTint = aTint;`).replace("#include <project_vertex>",`#include <project_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
{ vec3 wn = normalize(mat3(modelMatrix) * objectNormal);
  vec2 tw = vec2(-wn.z, wn.x); float tl = length(tw);
  vWuv = (abs(wn.y) > 0.7 || tl < 1e-3) ? vWPos.xz : vec2(dot(vWPos.xz, tw / tl), vWPos.y);
  ${e?"vWall = vec3(0.0);":`// walls: PBR u runs continuously round the footprint (bricks wrap the corners)
  vWall = vec3((aGy.x - 16384.0) * 0.05, aGy.y > 0.5 ? (aGy.y - 16384.0) * 0.05 : -1e4, step(0.5, aGy.x));
  if (vWall.z > 0.5 && abs(wn.y) < 0.7) vWuv.x = aWu;`} }`)}function h0(A,e){const t=e?`
attribute vec4 iP; attribute vec4 iD; attribute vec4 iF; attribute vec4 iInfo;
attribute vec2 aOff; attribute float aPart;`:`
attribute vec2 aFuv; attribute vec4 aInfo;`;return A.replace("#include <common>",`#include <common>${t}
varying vec2 vFuv; varying vec4 vInfo;`).replace("#include <begin_vertex>",e?`
vec3 wD = vec3(iD.x, 0.0, iD.y); vec3 wO = vec3(iD.y, 0.0, -iD.x);
int wFl = int(iInfo.y + 0.5);
bool wOn = aPart < 1.5 || (aPart < 2.5 ? (wFl & 2) != 0 : (wFl & 1) != 0);
float wZ = position.z * (aPart < 1.5 ? iP.w : 1.0);
vec3 transformed = wOn ? iP.xyz + wD * (position.x * iD.z + aOff.x) + vec3(0.0, position.y * iD.w + aOff.y, 0.0) + wO * wZ : iP.xyz;
vFuv = vec2(0.0); vInfo = vec4(0.0);`:`
vec3 transformed = vec3( position );
vFuv = aFuv; vInfo = vec4(aInfo.xy, aInfo.z * 0.001, aInfo.w);`)}const d0=`
{
  float fModeF = floor(vInfo.w / 64.0 + 0.001);
  if (fModeF > 3.5 && fModeF < 4.5) {
    float pat = vInfo.x; vec2 g = vFuv; float bar;
    if (pat < 0.5) { float bx = abs(fract(g.x / 0.12) - 0.5) * 0.12; bar = max(step(bx, 0.011), max(step(0.93, g.y), step(g.y, 0.05))); }
    else if (pat < 1.5) { float tv = abs(fract(g.y / 0.22) - 0.5) * 0.22; bar = max(step(tv, 0.035), max(step(g.x, 0.09), step(0.91, g.x))); }
    else { float tv = abs(fract(g.y / 0.3) - 0.5) * 0.3; bar = max(step(tv, 0.016), max(step(g.x, 0.11), step(0.89, g.x))); }
    if (bar < 0.5) discard;
  }
}`;function T0(A,e){const t=new Array(16).fill(2);(e.sizes||[]).forEach((c,f)=>{f<16&&(t[f]=c||2)});const n={uAlb:{value:A.albedo},uDat:{value:A.data},uPA:{value:e.albedo},uPN:{value:e.normal},uPbrSize:{value:t},uNight:{value:0},uLitFrac:{value:.35},uWinGain:{value:1.3},uTime:{value:0},uClock:{value:17.85},uFd:{value:new Ft(0,0,0,0)},uFd2:{value:new Ft(0,0,0,0)}},a=c=>{const f=new a0({roughness:1,metalness:0,ior:1.5,specularIntensity:1,envMapIntensity:1});return f.onBeforeCompile=r=>{Object.assign(r.uniforms,n),r.vertexShader=f0(r.vertexShader,c),r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
${r0}`).replace("#include <map_fragment>",c0).replace("#include <roughnessmap_fragment>","float roughnessFactor = fRough;"+It.roughnessmap_fragment).replace("#include <metalnessmap_fragment>","float metalnessFactor = fMetal;"+It.metalnessmap_fragment).replace("#include <normal_fragment_maps>",`{
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(vWuv), st1 = dFdy(vWuv);
  vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
  vec3 T = q1p * st0.x + q0p * st1.x, Bt = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(Bt, Bt));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec2 nxy = fNxy * fNStr;
  vec3 mapN = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  normal = normalize(T * (mapN.x * sc) + Bt * (mapN.y * sc) + normal * mapN.z);
}`+It.normal_fragment_maps).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += fEmis;`).replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>
if (fGlass > 0.5) { material.specularColor = fSpec; material.specularF90 = 1.0; }`).replace("#include <aomap_fragment>",`{
  float aoI = mix(1.0, fAO, 0.85);
  reflectedLight.indirectDiffuse *= aoI;
  reflectedLight.indirectSpecular *= aoI * fEnv;
  reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}`)},f.customProgramCacheKey=()=>c?"roadster-facade-win-3":"roadster-facade-3",f.shadowSide=l0,f.userData.uniforms=n,f},s=c=>{const f=new i0({depthPacking:o0});return f.onBeforeCompile=r=>{r.vertexShader=h0(r.vertexShader,c),r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
varying vec2 vFuv; varying vec4 vInfo;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
${c?"":d0}`)},f.customProgramCacheKey=()=>c?"roadster-facade-depth-win-3":"roadster-facade-depth-3",f};return{facade:a(!1),windows:a(!0),depth:s(!1),winDepth:s(!0),uniforms:n}}function z0(A,e={}){const t=[A.facade,A.windows].filter(Boolean),n=A.uniforms||t[0]&&t[0].userData.uniforms;n.uFd.value.set(e.dimRooms??.22,e.spill??.05,e.paneVariation??1,e.shades??.4),n.uFd2.value.set(e.weathering??1,0,0,0);for(const a of t)a.defines={...a.defines||{},FACADE_DETAIL:""},a.needsUpdate=!0;return n}class ut{constructor(e=1024){this.n=0,this.ni=0,this.wall=null,this._alloc(e,e*2)}_alloc(e,t){const n=(a,s,c)=>{const f=new s(c);return a&&f.set(a.subarray(0,Math.min(a.length,c))),f};this.pos=n(this.pos,Float32Array,e*3),this.nor=n(this.nor,Int8Array,e*3),this.fuv=n(this.fuv,Float32Array,e*2),this.info=n(this.info,Int16Array,e*4),this.tint=n(this.tint,Uint8Array,e*3),this.wu=n(this.wu,Float32Array,e),this.gy=n(this.gy,Int16Array,e*2),this.idx=n(this.idx,Uint32Array,t),this.vcap=e,this.icap=t}v(e,t,n,a,s,c,f,r,l,d){this.n>=this.vcap&&this._alloc(this.vcap*2,this.icap);const o=this.n,i=this.pos,u=this.nor,x=this.fuv,g=this.info,p=this.tint;i[o*3]=e,i[o*3+1]=t,i[o*3+2]=n,u[o*3]=Math.round(a*127),u[o*3+1]=Math.round(s*127),u[o*3+2]=Math.round(c*127),x[o*2]=f,x[o*2+1]=r,g[o*4]=l[0],g[o*4+1]=l[1],g[o*4+2]=Math.round(l[2]*1e3),g[o*4+3]=l[3],p[o*3]=d[0],p[o*3+1]=d[1],p[o*3+2]=d[2];const h=this.wall;if(h){this.wu[o]=(h.u0+h.sg*((e-h.ax)*h.dx+(n-h.az)*h.dz))*h.k;const m=h.gy?h.gy(e,n):0;this.gy[o*2]=Y(Math.round(m*20)+16384,1,32767),this.gy[o*2+1]=h.ao>-1e3?Y(Math.round(h.ao*20)+16384,1,32767):0}else this.wu[o]=0,this.gy[o*2]=0,this.gy[o*2+1]=0;return this.n++}tri(e,t,n){this.ni+3>this.icap&&this._alloc(this.vcap,this.icap*2);const a=this.pos,s=this.nor,c=a[e*3],f=a[e*3+1],r=a[e*3+2],l=a[t*3]-c,d=a[t*3+1]-f,o=a[t*3+2]-r,i=a[n*3]-c,u=a[n*3+1]-f,x=a[n*3+2]-r,g=d*x-o*u,p=o*i-l*x,h=l*u-d*i,m=this.idx;g*s[e*3]+p*s[e*3+1]+h*s[e*3+2]>=0?(m[this.ni++]=e,m[this.ni++]=t,m[this.ni++]=n):(m[this.ni++]=e,m[this.ni++]=n,m[this.ni++]=t)}quad(e,t,n,a){this.tri(e,t,n),this.tri(e,n,a)}q(e,t,n,a,s){const c=e.map((f,r)=>{const l=typeof s=="function"?s(f,r):s?s[r]:[0,0];return this.v(f[0],f[1],f[2],t[0],t[1],t[2],l[0],l[1],n,a)});this.quad(c[0],c[1],c[2],c[3])}poly(e,t,n,a,s){const c=e.map((f,r)=>{const l=typeof s=="function"?s(f,r):s?s[r]:[0,0];return this.v(f[0],f[1],f[2],t[0],t[1],t[2],l[0],l[1],n,a)});for(let f=1;f+1<c.length;f++)this.tri(c[0],c[f],c[f+1])}lift(e,t){if(!t)return;const n=this.pos;for(let a=e;a<this.n;a++)n[a*3+1]+=t}get tris(){return this.ni/3}geometry(){if(!this.n)return null;const e=new Bt;return e.setAttribute("position",new nt(this.pos.slice(0,this.n*3),3)),e.setAttribute("normal",new nt(this.nor.slice(0,this.n*3),3,!0)),e.setAttribute("aFuv",new nt(this.fuv.slice(0,this.n*2),2)),e.setAttribute("aInfo",new nt(this.info.slice(0,this.n*4),4,!1)),e.setAttribute("aTint",new nt(this.tint.slice(0,this.n*3),3,!0)),e.setAttribute("aWu",new nt(this.wu.slice(0,this.n),1)),e.setAttribute("aGy",new nt(this.gy.slice(0,this.n*2),2,!1)),e.setIndex(new nt(this.idx.slice(0,this.ni),1)),e.computeBoundingSphere(),e.computeBoundingBox(),e}build(e,t="buildings"){const n=this.geometry();if(!n)return null;const a=new qt(n,e.facade);return a.customDepthMaterial=e.depth,a.castShadow=!0,a.receiveShadow=!0,a.matrixAutoUpdate=!1,a.updateMatrix(),a.name=t,a}}class Gt{constructor(){this.n=0,this.cap=256,this.P=new Float32Array(1024),this.D=new Float32Array(1024),this.F=new Float32Array(1024),this.I=new Float32Array(1024),this.T=new Uint8Array(768)}add(e,t,n,a,s,c,f,r,l,d,o,i,u,x,g,p,h){if(this.n>=this.cap){const v=(L,b)=>{const P=new L.constructor(this.cap*2*b);return P.set(L),P};this.P=v(this.P,4),this.D=v(this.D,4),this.F=v(this.F,4),this.I=v(this.I,4),this.T=v(this.T,3),this.cap*=2}const m=this.n++;this.P.set([e,t,n,a],m*4),this.D.set([s,c,f,r],m*4),this.F.set([l,d,o,i],m*4),this.I.set([u,x,g,p],m*4),this.T.set(h,m*3)}lift(e,t){if(t)for(let n=e;n<this.n;n++)this.P[n*4+1]+=t}build(e,t){if(!this.n)return null;const n=new e0;for(const i of["position","normal","aOff","aPart"])n.setAttribute(i,t.getAttribute(i));n.setIndex(t.getIndex());const a=this.n;n.setAttribute("iP",new ft(this.P.slice(0,a*4),4)),n.setAttribute("iD",new ft(this.D.slice(0,a*4),4)),n.setAttribute("iF",new ft(this.F.slice(0,a*4),4)),n.setAttribute("iInfo",new ft(this.I.slice(0,a*4),4)),n.setAttribute("iTint",new ft(this.T.slice(0,a*3),3,!0)),n.instanceCount=a;let s=1/0,c=1/0,f=1/0,r=-1/0,l=-1/0,d=-1/0;for(let i=0;i<a;i++){const u=this.P[i*4],x=this.P[i*4+1],g=this.P[i*4+2],p=Math.max(this.D[i*4+2],this.D[i*4+3])+1;s=Math.min(s,u-p),r=Math.max(r,u+p),c=Math.min(c,x-1),l=Math.max(l,x+p),f=Math.min(f,g-p),d=Math.max(d,g+p)}n.boundingBox=new n0(new Ct(s,c,f),new Ct(r,l,d)),n.boundingSphere=n.boundingBox.getBoundingSphere(new s0);const o=new qt(n,e.windows);return o.customDepthMaterial=e.winDepth,o.castShadow=!0,o.receiveShadow=!0,o.matrixAutoUpdate=!1,o.updateMatrix(),o.name="building-windows",o}}let Pt=null;function Ut(){if(Pt)return Pt;const A=[],e=[],t=[],n=[],a=[],s=(l,d,o,i,u,x,g)=>(A.push(l,d,o),e.push(i[0],i[1],i[2]),t.push(u,x),n.push(g),A.length/3-1),c=(l,d,o,i,u)=>{const x=I=>[A[I*3]+t[I*2]*.3,A[I*3+1]+t[I*2+1]*.3,A[I*3+2]],g=x(l),p=x(d),h=x(o),m=p[0]-g[0],v=p[1]-g[1],L=p[2]-g[2],b=h[0]-g[0],P=h[1]-g[1],T=h[2]-g[2],y=v*T-L*P,w=L*b-m*T,M=m*P-v*b;y*u[0]+w*u[1]+M*u[2]>=0?a.push(l,o,d,l,i,o):a.push(l,d,o,l,o,i)};{const l=[0,0,1];c(s(0,0,-1,l,0,0,0),s(1,0,-1,l,0,0,0),s(1,1,-1,l,0,0,0),s(0,1,-1,l,0,0,0),l)}{const l=[1,0,0];c(s(0,0,0,l,0,0,1),s(0,0,-1,l,0,0,1),s(0,1,-1,l,0,0,1),s(0,1,0,l,0,0,1),l)}{const l=[-1,0,0];c(s(1,0,0,l,0,0,1),s(1,0,-1,l,0,0,1),s(1,1,-1,l,0,0,1),s(1,1,0,l,0,0,1),l)}{const l=[0,1,0];c(s(0,0,0,l,0,0,1),s(1,0,0,l,0,0,1),s(1,0,-1,l,0,0,1),s(0,0,-1,l,0,0,1),l)}{const l=[0,-1,0];c(s(0,1,0,l,0,0,1),s(1,1,0,l,0,0,1),s(1,1,-1,l,0,0,1),s(0,1,-1,l,0,0,1),l)}const f=(l,d,o,i,u,x,g,p)=>{const h=(v,L,b,P,T)=>s(v,l,P,T,L,b,g);let m;p.includes("t")&&(m=[0,1,0],c(h(0,-x,o,u,m),h(1,x,o,u,m),h(1,x,o,i,m),h(0,-x,o,i,m),m)),m=[0,0,1],c(h(0,-x,d,u,m),h(1,x,d,u,m),h(1,x,o,u,m),h(0,-x,o,u,m),m),p.includes("b")&&(m=[0,-1,0],c(h(0,-x,d,u,m),h(1,x,d,u,m),h(1,x,d,i,m),h(0,-x,d,i,m),m))};f(0,-.1,.025,-.05,.075,.07,2,"tb"),f(1,0,.2,0,.055,.06,3,"b");const r=new Bt;return r.setAttribute("position",new wt(A,3)),r.setAttribute("normal",new wt(e,3)),r.setAttribute("aOff",new wt(t,2)),r.setAttribute("aPart",new wt(n,1)),r.setIndex(a),Pt=r,r}const Zt=20,Xt=(A,e,t)=>new dt().setRGB(A,e,t,Ht);function yt(A){return[Y(Math.round(A.r*255),0,255),Y(Math.round(A.g*255),0,255),Y(Math.round(A.b*255),0,255)]}const N0=(A,e,t)=>yt(Xt(A,e,t)),Z=(A,e)=>A[Math.min(A.length-1,Math.floor(e*A.length))];function _t(A){if(!A||typeof A!="string")return null;const e=A.trim().toLowerCase().replace(/\s+/g,"");if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(e)||dt.NAMES&&e in dt.NAMES)try{const t=new dt;return t.setStyle(e,Ht),t}catch{return null}return null}const J={brickRed:[[1,.96,.94],[.92,.86,.82],[1,.9,.86],[.86,.8,.76],[1,1,1]],brickPaint:[[.97,.96,.92],[.92,.88,.8],[.78,.8,.8],[.66,.7,.62],[.93,.85,.72],[.74,.62,.55],[.58,.6,.63]],stone:[[.98,.93,.84],[.93,.88,.78],[.86,.82,.74],[1,.97,.9],[.8,.77,.72],[.94,.88,.82]],concrete:[[.86,.86,.84],[.76,.76,.75],[.66,.66,.66],[.92,.91,.88],[.8,.78,.74]],stucco:[[1,.96,.88],[.97,.9,.78],[.9,.93,.95],[1,.92,.84],[.92,.96,.9],[1,1,.98],[.96,.85,.72],[.98,.86,.8]],victorian:[[.62,.74,.86],[.96,.88,.62],[.72,.84,.72],[.96,.78,.76],[.98,.97,.94],[.78,.78,.8],[.6,.66,.58],[.86,.7,.86],[.95,.83,.62]],white:[[.98,.98,.97],[.93,.93,.91],[.86,.87,.88],[.95,.92,.86]],roof:[[.5,.5,.5],[.38,.38,.39],[.62,.61,.58],[.3,.3,.32],[.88,.88,.86],[.72,.72,.7]],pitched:[[.86,.86,.88],[1,.62,.48],[.62,.62,.66],[.9,.78,.66]],glass:[[.56,.7,.84],[.55,.76,.72],[.46,.48,.52],[.66,.58,.48],[.74,.8,.86],[.5,.62,.74]],sign:[[.62,.1,.08],[.1,.22,.48],[.82,.62,.12],[.08,.36,.2],[.9,.9,.86],[.06,.06,.07],[.42,.12,.34],[.86,.32,.08]],awning:[[.55,.1,.1],[.08,.26,.18],[.12,.18,.36],[.08,.08,.09],[.66,.5,.2],[.8,.78,.72],[.42,.08,.2]]},_=(A,e=1)=>yt(Xt(A[0]*e,A[1]*e,A[2]*e)),bt={oldProb:()=>.4,victorianProb:()=>.3,namedRe:/building|hotel|bank|exchange|hall|church|theat|temple|club|lodge|house|cathedral|mission/i};function R0(A,e,t,n,a,s=bt){return jt(A,e,t,n,a,{...bt,...s||{}})}function jt(A,e,t,n,a,s=bt){const c=s.storeProb||{},f=A.t||"yes",r=(A.m||"").toLowerCase(),l=String(A.n||""),d=n(),o=n(),i=n(),u=/^(apartments|residential|house|detached|terrace|dormitory|hostel|semidetached_house)$/.test(f),x=/^(office|commercial|hotel|government|bank|mixed_use|university|public|data_center)$/.test(f),g=/^(industrial|warehouse|service|garage|garages|shed|hangar|storage_tank|manufacture|transportation|train_station)$/.test(f),p=c.anyType&&!/^(garage|garages|shed|roof|carport|parking|industrial|warehouse)$/.test(f)||/^(commercial|retail|mixed_use|yes|hotel|apartments|office)$/.test(f),h={cat:"modern",win:G.PUNCHED,store:!1,pbr:D.CONCRETE_PANEL,tint:_([.85,.85,.83]),trimPbr:D.STUCCO_B,trimTint:_([.9,.88,.84]),basePbr:-1,baseTint:null,roofPbr:D.ROOF_TAR,roofTint:_(Z(J.roof,n())),bayW:3.2,floorH:3.6,prewar:!1,curtain:!1,glassVariant:0,glassTint:null,sill:!0,lintel:!1,depth:.14,cornice:!1,courses:0,fireEscape:!1,balconies:!1,bays:!1,water:!1},m=a?s.oldProb(a.xb,a.zb):.4,v=s.namedRe.test(l),L=e<95&&!/glass|mirror/.test(r)&&(i<m||v&&e<70&&i<.85);if(A.water)Object.assign(h,{cat:"industrial",win:-1,pbr:D.METAL,tint:_([.8,.8,.8]),floorH:6,sill:!1});else if(/glass|mirror/.test(r)||!L&&(e>=60&&d<.6||e>=28&&x&&d<.35||e>=28&&d<.12))Object.assign(h,{cat:"glass",curtain:!0,win:-1,bayW:1.5,floorH:3.9,glassVariant:Math.floor(o*4),glassTint:_(Z(J.glass,n()))});else if(f==="parking")Object.assign(h,{cat:"garage",win:G.GARAGE,pbr:D.CONCRETE_ROUGH,tint:_(Z(J.concrete,o)),floorH:3.1,sill:!1,depth:.5});else if(f==="roof"||f==="carport"||f==="bridge"||f==="pavilion"||f==="tent")Object.assign(h,{cat:"shed",win:-1,pbr:D.METAL,tint:_([.82,.82,.8]),sill:!1});else if(g&&!/brick/.test(r)){const y=o<.4;Object.assign(h,{cat:"industrial",win:G.INDUSTRIAL,pbr:y?D.METAL:o<.75?D.CONCRETE_ROUGH:D.BRICK_RED,tint:_(Z(J.concrete,i)),floorH:4.5,bayW:4})}else if(L||/brick|stone|sandstone|granite|marble|limestone/.test(r))if(h.prewar=!0,h.cornice=e>7,h.courses=e>14?1:0,h.lintel=!0,h.depth=.26,h.floorH=3.7,e<=16.5&&(u||f==="house"||f==="yes"&&t<320)&&d<(a?s.victorianProb(a.xb,a.zb):.3))Object.assign(h,{cat:"victorian",win:G.VICTORIAN,pbr:D.WOOD_SIDING,tint:_(Z(J.victorian,o)),trimPbr:D.PLAIN,trimTint:_([.96,.95,.92]),bayW:2.3,floorH:3.3,depth:.16,bays:!0,courses:0});else if(/brick/.test(r)||d<.42){const w=n();Object.assign(h,{cat:"masonry",pbr:w<.6?D.BRICK_RED:w<.78?D.BRICK_DARK:D.BRICK_PAINTED,win:g?G.INDUSTRIAL:Z([G.PUNCHED,G.PAIR,G.PUNCHED,G.SMALL,G.CLASSIC],o),trimPbr:D.CONCRETE_PANEL,trimTint:_(Z(J.stone,i)),floorH:3.5,bayW:g?4:3}),h.tint=h.pbr===D.BRICK_PAINTED?_(Z(J.brickPaint,n())):_(Z(J.brickRed,n())),h.fireEscape=e>=11&&e<=46&&n()<.75}else d<.78?Object.assign(h,{cat:"masonry",pbr:n()<.55?D.CONCRETE_PANEL:D.GRANITE,tint:_(Z(J.stone,o)),win:Z([G.CLASSIC,G.PUNCHED,G.CLASSIC,G.PAIR],n()),trimPbr:D.CONCRETE_PANEL,trimTint:_(Z(J.stone,i),1.05),basePbr:D.GRANITE,baseTint:_([.55,.52,.5]),courses:e>20?2:1}):Object.assign(h,{cat:"masonry",pbr:n()<.5?D.STUCCO_A:D.STUCCO_B,tint:_(Z(J.stucco,o)),win:Z([G.PAIR,G.SMALL,G.PUNCHED],n()),trimTint:_([.96,.95,.92]),floorH:3.3});else if(u||e<60&&d<.3){const y=n()<.7;Object.assign(h,y?{cat:"res",win:G.MODERN_RES,pbr:n()<.5?D.STUCCO_B:D.CONCRETE_PANEL,tint:_(Z(J.white,o)),floorH:3.1,bayW:3.4,balconies:e>9&&n()<.55,sill:!1,depth:.12}:{cat:"res",win:Z([G.PAIR,G.SMALL],o),pbr:n()<.5?D.STUCCO_A:D.BRICK_PAINTED,tint:_(Z(J.stucco,i)),floorH:3,bayW:3.2,depth:.16})}else{const y=n();Object.assign(h,{cat:"office",pbr:y<.5?D.CONCRETE_PANEL:y<.8?D.CONCRETE_ROUGH:D.GRANITE,tint:_(Z(J.concrete,o)),win:Z([G.RIBBON,G.OFFICE_MODERN,G.VERTICAL,G.PUNCHED,G.OFFICE_MODERN],i),floorH:3.8,depth:.14,sill:!1}),h.win===G.VERTICAL&&(h.depth=.32)}h.store=p&&e>3.6&&!A.mh&&!A.water&&!h.curtain&&h.cat!=="garage"&&h.cat!=="shed"&&h.cat!=="industrial"&&(h.prewar||h.cat==="office"||h.cat==="res"?n()<(h.prewar?c.prewar??.85:c.other??.55):!1),h.curtain&&(h.store=e>20&&n()<(c.curtain??.4)),A.lv>0&&e/A.lv>2.6&&e/A.lv<6&&(h.floorH=e/A.lv);const b=_t(A.c);if(b&&!h.curtain){const y=new dt().setRGB(h.tint[0]/255,h.tint[1]/255,h.tint[2]/255).lerp(b,.6);h.tint=yt(y)}const P=_t(A.rc);P?h.roofTint=yt(P):(h.cat==="res"||h.curtain)&&(h.roofTint=_(Z([[.88,.88,.86],[.5,.5,.5],[.66,.66,.64]],n())));const T=.93+n()*.12;return h.tint=h.tint.map(y=>Y(Math.round(y*T),0,255)),h}class u0{constructor(e,t={}){if(this.region=e,this.style={...bt,...t.style||{}},this.groundAt=t.groundAt||null,this.streetAt=t.streetAt||null,this.offset=t.offset||{x:0,z:0},this.foundation=this.groundAt?1:0,[this.bnx,this.bnz]=t.baseGrid||[2,2],[this.dnx,this.dnz]=t.detailGrid||[4,4],this.lodDist=t.lodDist||700,this.maxWindows=t.maxWindows??7e4,this.detailFloors=t.detailFloors??6,this.nearDetail=t.nearDetail!==!1,this.base=[],this.cells=[],t.grid!==!1)for(let n=0;n<this.bnx*this.bnz+4;n++)this.base.push(new ut(4096));if(t.grid!==!1)for(let n=0;n<this.dnz;n++)for(let a=0;a<this.dnx;a++)this.cells.push({near:new ut(2048),far:new ut(1024),wins:new Gt,cx:e.minX+(a+.5)*(e.maxX-e.minX)/this.dnx,cz:e.minZ+(n+.5)*(e.maxZ-e.minZ)/this.dnz});this.colliders=[],this.count=0,this.skipped=0,this.detailed=0,this.windowCount=0,this.samples=[],this._v2=n=>new Qt(n[0],n[1])}inRegion(e,t){const n=this.region;return e>=n.minX&&e<=n.maxX&&t>=n.minZ&&t<=n.maxZ}baseIndex(e,t){const n=this.region;if(this.inRegion(e,t)){const r=Y(Math.floor((e-n.minX)/(n.maxX-n.minX)*this.bnx),0,this.bnx-1);return Y(Math.floor((t-n.minZ)/(n.maxZ-n.minZ)*this.bnz),0,this.bnz-1)*this.bnx+r}const a=(n.minX+n.maxX)/2,s=(n.minZ+n.maxZ)/2,c=e-a,f=t-s;return this.bnx*this.bnz+(Math.abs(c)>Math.abs(f)?c>0?0:1:f>0?2:3)}cellIndex(e,t){const n=this.region,a=Y(Math.floor((e-n.minX)/(n.maxX-n.minX)*this.dnx),0,this.dnx-1);return Y(Math.floor((t-n.minZ)/(n.maxZ-n.minZ)*this.dnz),0,this.dnz-1)*this.dnx+a}cellCentre(e){const t=this.region,n=e%this.dnx,a=Math.floor(e/this.dnx);return[t.minX+(n+.5)*(t.maxX-t.minX)/this.dnx,t.minZ+(a+.5)*(t.maxZ-t.minZ)/this.dnz]}baseFor(e,t){const n=this.region;if(this.inRegion(e,t)){const l=Y(Math.floor((e-n.minX)/(n.maxX-n.minX)*this.bnx),0,this.bnx-1),d=Y(Math.floor((t-n.minZ)/(n.maxZ-n.minZ)*this.bnz),0,this.bnz-1);return this.base[d*this.bnx+l]}const a=(n.minX+n.maxX)/2,s=(n.minZ+n.maxZ)/2,c=e-a,f=t-s,r=Math.abs(c)>Math.abs(f)?c>0?0:1:f>0?2:3;return this.base[this.bnx*this.bnz+r]}cellFor(e,t){const n=this.region,a=Y(Math.floor((e-n.minX)/(n.maxX-n.minX)*this.dnx),0,this.dnx-1),s=Y(Math.floor((t-n.minZ)/(n.maxZ-n.minZ)*this.dnz),0,this.dnz-1);return this.cells[s*this.dnx+a]}isStreet(e,t){return this.streetAt?!!this.streetAt(e,t):!0}footprint(e){if(e._lm)return null;const t=Dt(e.p);if(!t)return null;let n=Number(e.h);(!isFinite(n)||n<=0)&&(n=10),n=Y(n,2.5,600);let a=Number(e.mh)||0;a=Y(a,0,n-1);const s=it(t)>0?t:t.slice().reverse(),c=(e.hl||[]).map(d=>Dt(d)).filter(d=>d&&Math.abs(it(d))>2).map(d=>it(d)<0?d:d.slice().reverse()),f=Math.abs(it(s))-c.reduce((d,o)=>d+Math.abs(it(o)),0);if(f<3)return null;const r=Mt(s);let l=0;if(this.groundAt){l=1/0;for(let d=0;d<s.length;d++){const o=s[d],i=s[(d+1)%s.length],u=Math.max(1,Math.ceil(Math.hypot(i[0]-o[0],i[1]-o[1])/2.5));for(let x=0;x<u;x++)l=Math.min(l,this.groundAt(o[0]+(i[0]-o[0])*x/u,o[1]+(i[1]-o[1])*x/u))}Number.isFinite(l)||(l=0)}return{outer:s,holes:c,h:n,mh:a,area:f,c:r,base:l}}add(e,t,n=null){if(this.lastDetailed=!1,e._lm)return!1;const a=n||this.footprint(e);if(!a)return this.skipped++,!1;const{outer:s,holes:c,h:f,mh:r,area:l,c:d,base:o}=a,i=jt(e,f,l,t,{xb:d[0]+this.offset.x,zb:d[1]+this.offset.z},this.style),u=t(),x=this.baseFor(d[0],d[1]),g=Math.max(1,Math.round(f/i.floorH)),p=f/g,h=Math.floor(u*4);let m=(e.r||"").toLowerCase(),v=0;const L=kt(s),b=g0(s);if(m&&m!=="flat"){if(/^(pyramidal|cone|dome|onion|round)$/.test(m)){const R=f-r>2.2*Math.sqrt(l);v=Number(e.rh)>0?Number(e.rh):R?(f-r)*.85:Y(.45*Math.sqrt(l),1.5,(f-r)*.6),(!x0(s,d)||c.length)&&(m="",v=0)}else/^(gabled|hipped|half-hipped|gambrel|mansard|saltbox|quadruple_saltbox|side_hipped)$/.test(m)&&L&&!c.length?v=Number(e.rh)>0?Number(e.rh):Y(.32*b,1.2,7):m==="skillion"&&!c.length?v=Number(e.rh)>0?Number(e.rh):Y(.15*b,.8,3):m="";v=Math.min(v,(f-r)*.9)}else m="";const P=f-v;let T=s,y=null;if(m&&/^(gabled|half-hipped|gambrel|saltbox|side_hipped)$/.test(m)||m&&/^(hipped|mansard|quadruple_saltbox)$/.test(m)&&s.length!==4){const R=ht(s),F=-R[1],j=R[0];let V=0;for(const tt of s)V=Math.max(V,Math.abs((tt[0]-d[0])*F+(tt[1]-d[1])*j));V<.5?m="":(T=w0(s,d,F,j),y=(tt,et)=>P+v*(1-Math.abs((tt-d[0])*F+(et-d[1])*j)/V),m="gabled")}else if(m==="skillion"){const R=ht(s),F=-R[1],j=R[0];let V=1/0,tt=-1/0;for(const et of s){const K=(et[0]-d[0])*F+(et[1]-d[1])*j;V=Math.min(V,K),tt=Math.max(tt,K)}tt-V<.5?m="":y=(et,K)=>P+v*(((et-d[0])*F+(K-d[1])*j-V)/(tt-V))}m||(v=0);const w=m?P:f,M=!m&&f-r>7&&l>60&&e.t!=="roof"&&i.cat!=="shed"?Y(.6+f*.004,.7,1.6)*(e.lod?.8:1):0,I=!e.lod&&this.inRegion(d[0],d[1])?this.cellFor(d[0],d[1]):null;let z=!1;const N={est:0};if(I&&!i.curtain&&i.win>=0&&!m){let R=0;const F=ct[i.win].length;for(let j=0;j<s.length;j++){const V=s[j],tt=s[(j+1)%s.length],et=Math.hypot(tt[0]-V[0],tt[1]-V[1]),K=et>=2.5?St(V,tt,!0):null;K&&this.isStreet(K.mx+K.ox*4.5,K.mz+K.oz*4.5)&&(R+=Math.max(1,Math.round(et/i.bayW))*F*Math.max(1,Math.min(this.detailFloors,Math.round(w/p))-Math.ceil(r/p)))}z=R<=2600&&this.windowCount+R<=this.maxWindows,z&&(this.windowCount+=R,N.est=R)}const C={B:x.n,near:I?I.near.n:0,far:I?I.far.n:0,wins:I?I.wins.n:0},E={b:e,st:i,h:f,mh:r,fh:p,floors:g,u0:h,seed:u,base:o,rnd:t,flatTop:w,wallTop:P,parapet:M,B:x,cell:I,detailed:z,outer:s,holes:c,area:l,c:d},B=[],$=r>0?r:-this.foundation,U=Y(.35+f*.008,.4,1.1),Q=!e.lod&&!i.curtain&&i.cornice&&!m?o+w-.25-U*.9:-1e4,O=o+ct[G.STOREFRONT][0][3]*p+.14,W=(R,F)=>{let j=0;for(let K=0;K<R.length;K++)j+=Math.hypot(R[(K+1)%R.length][0]-R[K][0],R[(K+1)%R.length][1]-R[K][1]);const V=(Vt[i.curtain?D.PLAIN:i.pbr]||{}).size||2,tt=j>V?Math.max(1,Math.round(j/V))*V/j:1;let et=0;for(let K=0;K<R.length;K++){const at=R[K],lt=R[(K+1)%R.length],H=St(at,lt,F);if(!H)continue;H.wall={u0:F?et:-et,sg:F?1:-1,k:tt,ax:H.ax,az:H.az,dx:H.dx,dz:H.dz,gy:this.groundAt,ao:Q},et+=H.L;const pt=y&&F?y(at[0],at[1]):w,vt=y&&F?y(lt[0],lt[1]):w,At=F&&!e.lod&&H.L>3&&this.isStreet(H.mx+H.ox*4.5,H.mz+H.oz*4.5),Kt={f:H,street:At,ya:pt,yb:vt,isOuter:F};F&&B.push(Kt);const xt=i.store&&At&&r<.5?G.STOREFRONT:-1;H.wallLo=xt>=0?{...H.wall,ao:O}:H.wall;const zt=H.L>=.6*i.bayW?Math.max(1,Math.round(H.L/i.bayW)):H.L/i.bayW,rt=H.L/zt,gt={gl:this.groundAt&&F&&r<.5&&!e.lod?Rt=>this.groundAt(H.ax+H.dx*Rt,H.az+H.dz*Rt)-o:null,split:xt>=0?p:null,pInfo:[-1,-1,u,k(i.pbr,S.WALLONLY)],pTint:i.tint};if(i.curtain){gt.pInfo=[-1,-1,u,k(D.GRANITE,S.PLAIN)],gt.pTint=_([.5,.49,.48]),this.wallPieces(x,H,$,pt+(F?M:0),vt+(F?M:0),h,rt,p,[i.glassVariant,-1,u,k(D.PLAIN,S.CURTAIN)],i.glassTint,gt);continue}const Nt=[i.win,xt,u,k(i.pbr,i.win>=0?S.WALL:S.PLAIN)];z&&H.L>=2.5&&At?(this.shellWall(I.far,H,$,pt,vt,h,rt,p,Nt,i.tint),this.nearDetail&&this.detailWall(E,H,$,w,zt,rt,xt),F&&M>0&&this.shellWall(x,H,w,w+M,w+M,h,rt,p,[-1,-1,u,k(i.pbr,S.WALLONLY)],i.tint)):this.wallPieces(x,H,$,pt+(F?M:0),vt+(F?M:0),h,rt,p,Nt,i.tint,gt)}};W(T,!0);for(const R of c)W(R,!1);const X=[-1,-1,u,k(i.trimPbr,S.PLAIN)],q=[-1,-1,u,k(i.roofPbr,S.PLAIN)];if(M>0?this.parapet(x,s,w,M,[-1,-1,u,k(i.pbr,S.WALLONLY)],i.tint,X,i.trimTint,!e.lod):!m&&!e.lod&&i.cat!=="shed"&&f>4&&this.ledge(x,s,w-.35,.35,.18,X,i.trimTint),!e.lod&&!i.curtain){if(i.cornice&&!m){const R=Y(.35+f*.008,.4,1.1);this.cornice(x,s,w-.25-R*.9,R,R*.9,X,i.trimTint)}if(i.courses>0&&g>=3){const R=i.courses>=2?Math.max(3,Math.round(g/4)):g>6?Math.round(g/2):99;for(let F=1;F<g-1;F++){if(F!==1&&F%R!==0)continue;const j=F*p-.08;j<r+1||this.ledge(x,s,j,.26,.09,X,i.trimTint)}}i.curtain&&!m&&f>40&&this.ledge(x,s,w-1.2,1.2,.04,[-1,-1,u,k(D.PLAIN,S.PLAIN)],_([.6,.62,.64]))}if(!m)this.flatPolygon(x,s,c,w,q,i.roofTint,!0);else if(m==="gabled"||m==="skillion"){const R=e.lod?0:.35,F=R?ot(T,R):T,j=m==="gabled"?y0(F,d,ht(s)):[F];for(const V of j)this.heightPolygon(x,V,y,[-1,-1,u,k(D.ROOF_SLATE,S.PLAIN)],_(Z(J.pitched,t())));R&&this.eaves(x,T,F,V=>y(V[0],V[1]),u,i)}else if(/^(hipped|mansard|quadruple_saltbox)$/.test(m)&&s.length===4)this.hipRoof(x,s,P,v,[-1,-1,u,k(D.ROOF_SLATE,S.PLAIN)],_(Z(J.pitched,t())),e.lod?0:.35,u,i);else{const R=m==="dome"||m==="round"||m==="onion"?[[1,0],[.92,.38],[.71,.71],[.38,.92],[0,1]]:[[1,0],[0,1]],F=m==="pyramidal"&&f>60;this.taperRoof(x,s,d,P,v,R,F?[-1,-1,u,k(i.pbr,S.PLAIN)]:[-1,-1,u,k(D.ROOF_SLATE,S.PLAIN)],F?i.tint:_(Z(J.pitched,t())))}if(r>2&&this.flatPolygon(x,s,c,r,q,i.roofTint,!1),!e.lod){!m&&f>6&&l>60&&e.t!=="roof"&&i.cat!=="shed"&&this.rooftop(E,x,s,c,w,l,f,t,u,i);for(const R of B){const F=this.groundAt?j=>this.groundAt(R.f.ax+R.f.dx*j,R.f.az+R.f.dz*j)-o:()=>0;R.street&&i.store&&r<.5&&g>=1&&R.f.L>=4&&this.storefront(this.style.storeDressing===!1?this._nullSink||(this._nullSink=new st):x,R.f,i,p,t,u,h,F),i.bays&&R.street&&R.f.L>=4.5&&R.f.L<=16&&g>=2&&t()<.85&&this.bayWindow(x,R.f,i,p,g,w,u,F)}if(this.nearDetail&&z&&i.fireEscape&&g>=3){const R=B.filter(F=>F.street&&F.f.L>=3*i.bayW);R.length&&this.fireEscape(I.near,Z(R,t()).f,i,p,g,w,t,o)}if(this.nearDetail&&z&&i.balconies&&g>=3)for(const R of B)R.street&&R.f.L>=6&&this.balconies(I.near,R.f,i,p,g,w,t,u)}return o&&(x.lift(C.B,o),I&&(I.near.lift(C.near,o),I.far.lift(C.far,o),I.wins.lift(C.wins,o))),z&&(this.detailed++,this.windowCount+=I.wins.n-C.wins-N.est),this.colliders.push([s,c,r,f,o]),!e.lod&&this.samples.length<6e3&&this.samples.push({x:+d[0].toFixed(1),z:+d[1].toFixed(1),y:+o.toFixed(1),h:f,cat:i.cat,pbr:i.pbr,win:i.win,detailed:z,fire:!!(z&&i.fireEscape),store:i.store,n:e.n||""}),this.count++,this.lastDetailed=z,!0}shellWall(e,t,n,a,s,c,f,r,l,d,o=t.wall){const i=t.L/f,u=(v,L)=>[t.ax+t.dx*v,L,t.az+t.dz*v],x=[t.ox,0,t.oz];e.wall=o||null;const g=e.v(...u(0,n),...x,c+t.uDir0*i,n/r,l,d),p=e.v(...u(t.L,n),...x,c+t.uDir1*i,n/r,l,d),h=e.v(...u(t.L,s),...x,c+t.uDir1*i,s/r,l,d),m=e.v(...u(0,a),...x,c+t.uDir0*i,a/r,l,d);e.wall=null,e.quad(g,p,h,m)}wallPieces(e,t,n,a,s,c,f,r,l,d,o){const i=t.L;let u=null;if(o.gl&&n<0){const h=Math.max(1,Math.ceil(i/5));let m=!1;u=[];for(let v=0;v<h;v++){const L=i*v/h,b=i*(v+1)/h,P=Math.max(o.gl(L),o.gl(b),o.gl((L+b)/2));u.push([L,b,P>.12?P+.4:0]),P>.12&&(m=!0)}m||(u=null)}if(!u&&o.split==null){this.shellWall(e,t,n,a,s,c,f,r,l,d);return}u||(u=[[0,i,0]]);const x=[t.ox,0,t.oz],g=h=>c+(t.uDir0*(i-h)+t.uDir1*h)/f,p=(h,m,v,L,b,P,T,y)=>{if(Math.min(L,b)-v<.02)return;e.wall=y||null;const w=(C,E)=>[t.ax+t.dx*C,E,t.az+t.dz*C],M=e.v(...w(h,v),...x,g(h),v/r,P,T),I=e.v(...w(m,v),...x,g(m),v/r,P,T),z=e.v(...w(m,b),...x,g(m),b/r,P,T),N=e.v(...w(h,L),...x,g(h),L/r,P,T);e.wall=null,e.quad(M,I,z,N)};for(const[h,m,v]of u){const L=a+(s-a)*h/i,b=a+(s-a)*m/i;let P=n;if(v>n+.05){const y=Math.min(v,L,b);p(h,m,n,y,y,o.pInfo,o.pTint,t.wallLo||t.wall),P=y}const T=o.split;T!=null&&T>P+.05&&T<Math.min(L,b)-.05?(p(h,m,P,T,T,l,d,t.wallLo||t.wall),p(h,m,T,L,b,l,d,t.wall)):p(h,m,P,L,b,l,d,T!=null&&P<T&&t.wallLo||t.wall)}}detailWall(e,t,n,a,s,c,f){const{st:r,fh:l,floors:d,mh:o,u0:i,seed:u,base:x,cell:g}=e,p=g.near,h=g.wins,m=t.L,v=r.win,L=ct[v],b=L[0][0]<=.001&&L[0][1]>=.999,P=L[0][2]<=.001&&L[0][3]>=.999,T=this.groundAt?O=>this.groundAt(t.ax+t.dx*O,t.az+t.dz*O)-x:()=>0,y=[],w=Math.max(0,Math.ceil((o-.01)/l)),M=Math.min(d,Math.floor((a+.01)/l),this.detailFloors)-1,I=Math.min(a,(M+1)*l),z=k(r.trimPbr,S.WALLONLY),N=O=>(r.sill?2:0)|(r.lintel?1:0),C=(O,W,X,q,R,F,j)=>{if(W-O<.3||q-X<.3||Math.max(T(O),T(W),T((O+W)/2))+.25>X)return;y.push([O,W,X,q]);const tt=i+(t.uDir0*(m-O)+t.uDir1*O)/c,et=i+(t.uDir0*(m-W)+t.uDir1*W)/c,K=t.uDir1?O:W,at=Math.min(tt,et),lt=t.uDir1?t.dx:-t.dx,H=t.uDir1?t.dz:-t.dz;h.add(t.ax+t.dx*K,X,t.az+t.dz*K,F,lt,H,W-O,q-X,at,X/l,(W-O)/c,(q-X)/l,R,j,u,z,r.trimTint)};for(let O=w;O<=M;O++){const W=O*l;if(O===0&&f>=0){const q=ct[G.STOREFRONT][0];for(let R=0;R<Math.round(s);R++)C(R*c+q[0]*c+.12,R*c+q[1]*c-.12,W+q[2]*l,W+q[3]*l,G.STOREFRONT,.32,0);continue}if(P){if(O!==Math.max(w,f>=0?1:0))continue;const q=W+.4,R=(M+1)*l-.15;for(let F=0;F<Math.round(s);F++)C(F*c+L[0][0]*c,F*c+L[0][1]*c,q,R,v,r.depth,2);continue}for(const q of L){if(b){C(.25,m-.25,W+q[2]*l,W+q[3]*l,v,r.depth,N()&2);continue}for(let R=0;R<Math.round(s);R++)C(R*c+q[0]*c,R*c+q[1]*c,W+q[2]*l,W+q[3]*l,v,r.depth,N())}}const E=[-1,-1,u,k(r.pbr,S.WALLONLY)],B=r.store&&f>=0&&r.basePbr>=0?[-1,-1,u,k(r.basePbr,S.WALLONLY)]:null,$=[t.ox,0,t.oz],U=(O,W)=>[t.ax+t.dx*O,W,t.az+t.dz*O];a>I+.05&&this.shellWall(p,t,I,a,a,i,c,l,[v,-1,u,k(r.pbr,S.WALL)],r.tint);const Q=t.wallLo||t.wall;v0(m,n,I,y,(O,W,X,q)=>{if(p.wall=X<l-.01?Q:t.wall,B&&X<l-.01){const R=Math.min(q,l);p.q([U(O,X),U(W,X),U(W,R),U(O,R)],$,B,r.baseTint),p.wall=t.wall,q>R+.01&&p.q([U(O,R),U(W,R),U(W,q),U(O,q)],$,E,r.tint)}else p.q([U(O,X),U(W,X),U(W,q),U(O,q)],$,E,r.tint);p.wall=null})}parapet(e,t,n,a,s,c,f,r,l){const d=Ot(t,.35);if(!d)return;const o=l?ot(t,.06):t,i=t.length,u=n+a;for(let x=0;x<i;x++){const g=(x+1)%i,p=d[x],h=d[g],m=o[x],v=o[g],L=h[0]-p[0],b=h[1]-p[1],P=Math.hypot(L,b);if(P<.05)continue;const T=-b/P,y=L/P;e.q([[p[0],n,p[1]],[h[0],n,h[1]],[h[0],u,h[1]],[p[0],u,p[1]]],[T,0,y],s,c);const w=u+(l?.08:0);if(e.q([[m[0],w,m[1]],[v[0],w,v[1]],[h[0],w,h[1]],[p[0],w,p[1]]],[0,1,0],f,r),l){const M=v[0]-m[0],I=v[1]-m[1],z=Math.hypot(M,I)||1,N=I/z,C=-M/z;e.q([[m[0],u-.06,m[1]],[v[0],u-.06,v[1]],[v[0],w,v[1]],[m[0],w,m[1]]],[N,0,C],f,r)}}}ledge(e,t,n,a,s,c,f){const r=ot(t,s),l=t.length;for(let d=0;d<l;d++){const o=(d+1)%l,i=t[d],u=t[o],x=r[d],g=r[o],p=g[0]-x[0],h=g[1]-x[1],m=Math.hypot(p,h);if(m<.05)continue;const v=h/m,L=-p/m;e.q([[x[0],n,x[1]],[g[0],n,g[1]],[g[0],n+a,g[1]],[x[0],n+a,x[1]]],[v,0,L],c,f),e.q([[i[0],n+a,i[1]],[u[0],n+a,u[1]],[g[0],n+a,g[1]],[x[0],n+a,x[1]]],[0,1,0],c,f),e.q([[i[0],n,i[1]],[u[0],n,u[1]],[g[0],n,g[1]],[x[0],n,x[1]]],[0,-1,0],c,f)}}cornice(e,t,n,a,s,c,f){const r=ot(t,a*.35),l=ot(t,a),d=t.length,o=n+s*.35,i=n+s;for(let u=0;u<d;u++){const x=(u+1)%d,g=t[u],p=t[x],h=l[x][0]-l[u][0],m=l[x][1]-l[u][1],v=Math.hypot(h,m);if(v<.05)continue;const L=m/v,b=-h/v,P=[L*.7,-.7,b*.7];e.q([[g[0],n,g[1]],[p[0],n,p[1]],[r[x][0],o,r[x][1]],[r[u][0],o,r[u][1]]],P,c,f),e.q([[r[u][0],o,r[u][1]],[r[x][0],o,r[x][1]],[l[x][0],o,l[x][1]],[l[u][0],o,l[u][1]]],[0,-1,0],c,f),e.q([[l[u][0],o,l[u][1]],[l[x][0],o,l[x][1]],[l[x][0],i,l[x][1]],[l[u][0],i,l[u][1]]],[L,0,b],c,f),e.q([[g[0],i,g[1]],[p[0],i,p[1]],[l[x][0],i,l[x][1]],[l[u][0],i,l[u][1]]],[0,1,0],c,f)}}storefront(e,t,n,a,s,c,f,r=()=>0){const l=Math.max(1,Math.round(t.L/n.bayW)),d=t.L/l,o=(h,m,v)=>[t.ax+t.dx*h+t.ox*v,m,t.az+t.dz*h+t.oz*v],i=[t.ox,0,t.oz],u=[t.dx,0,t.dz],x=ct[G.STOREFRONT][0][3]*a,g=[-1,-1,c,k(D.PLAIN,S.PLAIN)];let p=0;for(;p<l;){const h=Math.min(l-p,1+Math.floor(s()*3)),m=p*d+.15,v=(p+h)*d-.15;if(p+=h,v-m<1.5)continue;const L=v-m;if(!(Math.max(r(m),r(v),r((m+v)/2))>.35)){if(s()<.72){const b=x+.12,P=Math.min(a-.08,b+.55+s()*.3),T=.12+s()*.06,y=_(Z(J.sign,s()),.9+s()*.2),w=[s()<.85?1:0,L,s(),k(D.PLAIN,S.SIGN)];e.q([o(m,b,T),o(v,b,T),o(v,P,T),o(m,P,T)],i,w,y,(M,I)=>[I===1||I===2?L:0,I>=2?1:0]),e.q([o(m,P,0),o(v,P,0),o(v,P,T),o(m,P,T)],[0,1,0],g,y)}if(s()<.38){const b=x+.05,P=1.1+s()*.5,T=.55+s()*.25,y=_(Z(J.awning,s())),w=[0,s()<.35?1:0,c,k(D.FABRIC,S.SIGN)],M=o(m,b,.02),I=o(v,b,.02),z=o(v,b-T,P),N=o(m,b-T,P),C=Math.hypot(P,T),E=[t.ox*T/C,P/C,t.oz*T/C],B=(Q,O)=>[O===1||O===2?v:m,O>=2?1:0];e.q([M,I,z,N],E,w,y,B),e.q([M,I,z,N],E.map(Q=>-Q),w,y.map(Q=>Math.round(Q*.75)),B);const $=o(m,b-T-.25,P),U=o(v,b-T-.25,P);e.q([N,z,U,$],i,w,y,B),e.q([N,z,U,$],i.map(Q=>-Q),w,y,B),e.poly([o(m,b,.02),o(m,b-T,P),o(m,b-T,.02)],u.map(Q=>-Q),w,y),e.poly([o(v,b,.02),o(v,b-T,P),o(v,b-T,.02)],u,w,y)}if(n.prewar&&s()<.14){const b=s()<.5?m+.2:v-.2,P=a+.5,T=P+1.8+s()*1.5,y=.25,w=1.15,M=.09,I=_(Z(J.sign,s())),z=[1,w-y,s(),k(D.PLAIN,S.SIGN)];for(const N of[-1,1]){const C=b+N*M;e.q([o(C,P,y),o(C,P,w),o(C,T,w),o(C,T,y)],u.map(E=>E*N),z,I,(E,B)=>[B===1||B===2?w-y:0,B>=2?1:0])}e.q([o(b-M,P,w),o(b+M,P,w),o(b+M,T,w),o(b-M,T,w)],i,g,I)}}}}bayWindow(e,t,n,a,s,c,f,r=()=>0){const l=Math.min(3.8,t.L*.5),d=.75,o=t.L*.5+(t.L>9?(f-.5)*(t.L-l-2):0),i=o-l/2,u=o+l/2,x=i+d,g=u-d,p=Math.max(s>=3?a+.15:.7,Math.max(r(i),r(u),r(o))+2.6),h=c-.45;if(h-p<2)return;const m=(w,M,I)=>[t.ax+t.dx*w+t.ox*M,I,t.az+t.dz*w+t.oz*M],v=[[i,0],[x,d],[g,d],[u,0]],L=[G.VICTORIAN,-1,f,k(n.pbr,S.WALL)];let b=0;for(let w=0;w<3;w++){const[M,I]=v[w],[z,N]=v[w+1],C=m(M,I,p),E=m(z,N,p),B=E[0]-C[0],$=E[2]-C[2],U=Math.hypot(B,$),Q=[$/U,0,-B/U],O=X=>X/a,W=Math.max(.6,U/2);e.q([C,E,m(z,N,h),m(M,I,h)],Q,L,n.tint,(X,q)=>[b+(q===1||q===2?W:0),O(X[1])]),b+=W}const P=v.map(([w,M])=>m(w,M,0)),T=[-1,-1,f,k(n.trimPbr,S.PLAIN)];e.poly(P.map(w=>[w[0],p,w[2]]),[0,-1,0],T,n.trimTint);const y=v.map(([w,M])=>m(w+(w<o?-.15:.15)*(M===0?1:.4),M+.15,0));e.poly(y.map(w=>[w[0],h+.35,w[2]]),[0,1,0],T,n.trimTint);for(let w=0;w<3;w++){const M=y[w],I=y[w+1],z=I[0]-M[0],N=I[2]-M[2],C=Math.hypot(z,N)||1;e.q([[M[0],h,M[2]],[I[0],h,I[2]],[I[0],h+.35,I[2]],[M[0],h+.35,M[2]]],[N/C,0,-z/C],T,n.trimTint);const E=P[w],B=P[w+1];e.q([[E[0],h,E[2]],[B[0],h,B[2]],[I[0],h,I[2]],[M[0],h,M[2]]],[0,-1,0],T,n.trimTint)}}fireEscape(e,t,n,a,s,c,f,r){const l=Math.max(1,Math.round(t.L/n.bayW)),d=t.L/l,o=Math.floor(f()*Math.max(1,l-1)),i=o*d+.15,u=Math.min(t.L-.15,(o+2)*d-.15),x=u-i,g=1.1;if(x<2.4)return;const p=(z,N,C)=>[t.ax+t.dx*z+t.ox*N,C,t.az+t.dz*z+t.oz*N],h=[t.ox,0,t.oz],m=[t.dx,0,t.dz],v=_([.1,.1,.11]),L=[-1,-1,.5,k(D.PLAIN,S.PLAIN)],b=[0,0,.5,k(D.PLAIN,S.GRATE)],P=(z,N,C,E)=>{e.q(z,N,C,v,E),e.q(z,N.map(B=>-B),C,v,E)},T=Math.min(s-1,Math.floor((c-1)/a));for(let z=1;z<=T;z++){const N=z*a+.02;if(e.q([p(i,.02,N),p(u,.02,N),p(u,g,N),p(i,g,N)],[0,1,0],L,v),e.q([p(i,.02,N-.06),p(u,.02,N-.06),p(u,g,N-.06),p(i,g,N-.06)],[0,-1,0],L,v),e.q([p(i,g,N-.06),p(u,g,N-.06),p(u,g,N),p(i,g,N)],h,L,v),P([p(i,g,N),p(u,g,N),p(u,g,N+.95),p(i,g,N+.95)],h,b,(C,E)=>[E===1||E===2?x:0,E>=2?1:0]),P([p(i,.02,N),p(i,g,N),p(i,g,N+.95),p(i,.02,N+.95)],m,b,(C,E)=>[E===1||E===2?g:0,E>=2?1:0]),P([p(u,.02,N),p(u,g,N),p(u,g,N+.95),p(u,.02,N+.95)],m,b,(C,E)=>[E===1||E===2?g:0,E>=2?1:0]),z<T){const E=g-.62-.05,B=g-.05,$=z%2===0,U=$?i+.3:u-.3,Q=$?u-.6:i+.6,O=N+a,W=Math.hypot(Q-U,a),X=[1,0,.5,k(D.PLAIN,S.GRATE)],q=[0,1,0];P([p(U,E,N),p(U,B,N),p(Q,B,O),p(Q,E,O)],q,X,(R,F)=>[F===1||F===2?1:0,F>=2?W:0])}}const y=a+.02,w=i+.5,M=[2,0,.5,k(D.PLAIN,S.GRATE)],I=Math.max(y-3.2,(this.groundAt?this.groundAt(t.ax+t.dx*w,t.az+t.dz*w)-r:0)+2.4);y-I>.6&&P([p(w,g-.08,I),p(w+.45,g-.08,I),p(w+.45,g-.08,y),p(w,g-.08,y)],h,M,(z,N)=>[N===1||N===2?1:0,z[1]-I])}balconies(e,t,n,a,s,c,f,r){const l=Math.max(1,Math.round(t.L/n.bayW)),d=t.L/l,o=Math.floor(r*3),i=_([.86,.86,.84]),u=_([.2,.21,.22]),x=[-1,-1,r,k(D.CONCRETE_PANEL,S.PLAIN)],g=[0,0,r,k(D.PLAIN,S.GRATE)],p=(L,b,P)=>[t.ax+t.dx*L+t.ox*b,P,t.az+t.dz*L+t.oz*b],h=[t.ox,0,t.oz],m=[t.dx,0,t.dz],v=1.25;for(let L=1;L<s;L++){const b=L*a;if(b>c-1)break;for(let P=0;P<l;P++){if(o===1&&(P+L)%2||o===2&&P%3===2)continue;const T=P*d+.2,y=(P+1)*d-.2;e.q([p(T,0,b),p(y,0,b),p(y,v,b),p(T,v,b)],[0,1,0],x,i),e.q([p(T,0,b-.18),p(y,0,b-.18),p(y,v,b-.18),p(T,v,b-.18)],[0,-1,0],x,i),e.q([p(T,v,b-.18),p(y,v,b-.18),p(y,v,b),p(T,v,b)],h,x,i),e.q([p(T,0,b-.18),p(T,v,b-.18),p(T,v,b),p(T,0,b)],m.map(M=>-M),x,i),e.q([p(y,0,b-.18),p(y,v,b-.18),p(y,v,b),p(y,0,b)],m,x,i);const w=y-T;for(const M of[1,-1])e.q([p(T,v,b),p(y,v,b),p(y,v,b+1.05),p(T,v,b+1.05)],h.map(I=>I*M),g,u,(I,z)=>[z===1||z===2?w:0,z>=2?1:0]),e.q([p(T,0,b),p(T,v,b),p(T,v,b+1.05),p(T,0,b+1.05)],m.map(I=>I*M),g,u,(I,z)=>[z===1||z===2?v:0,z>=2?1:0]),e.q([p(y,0,b),p(y,v,b),p(y,v,b+1.05),p(y,0,b+1.05)],m.map(I=>I*M),g,u,(I,z)=>[z===1||z===2?v:0,z>=2?1:0])}}}flatPolygon(e,t,n,a,s,c,f){let r;try{r=Et.triangulateShape(t.map(this._v2),n.map(o=>o.map(this._v2)))}catch{return}if(!r||!r.length)return;const d=t.concat(...n).map(o=>e.v(o[0],a,o[1],0,f?1:-1,0,o[0]/3,o[1]/3,s,c));for(const o of r)d[o[0]]!==void 0&&d[o[1]]!==void 0&&d[o[2]]!==void 0&&e.tri(d[o[0]],d[o[1]],d[o[2]])}heightPolygon(e,t,n,a,s){if(!t||t.length<3)return;let c;try{c=Et.triangulateShape(t.map(this._v2),[])}catch{return}if(!c||!c.length)return;const f=t.map(u=>[u[0],n(u[0],u[1]),u[1]]);let r=0,l=0,d=0;for(let u=0;u<f.length;u++){const x=f[u],g=f[(u+1)%f.length];r+=(x[1]-g[1])*(x[2]+g[2]),l+=(x[2]-g[2])*(x[0]+g[0]),d+=(x[0]-g[0])*(x[1]+g[1])}const o=Math.hypot(r,l,d)||1;r/=o,l/=o,d/=o,l<0&&(r=-r,l=-l,d=-d);const i=f.map(u=>e.v(u[0],u[1],u[2],r,l,d,u[0]/3,u[2]/3,a,s));for(const u of c)i[u[0]]!==void 0&&i[u[1]]!==void 0&&i[u[2]]!==void 0&&e.tri(i[u[0]],i[u[1]],i[u[2]])}hipRoof(e,t,n,a,s,c,f=0,r=.5,l=null){const d=E=>Math.hypot(t[(E+1)%4][0]-t[E][0],t[(E+1)%4][1]-t[E][1]),o=d(0)+d(2)>d(1)+d(3)?0:1,i=E=>[(t[E][0]+t[(E+1)%4][0])/2,(t[E][1]+t[(E+1)%4][1])/2],u=i((o+1)%4),x=i((o+3)%4),g=(d((o+1)%4)+d((o+3)%4))/4,p=x[0]-u[0],h=x[1]-u[1],m=Math.hypot(p,h);if(m<2*g+.2){this.taperRoof(e,t,Mt(t),n,a,[[1,0],[0,1]],s,c);return}const v=p/m,L=h/m,b=[u[0]+v*g,n+a,u[1]+L*g],P=[x[0]-v*g,n+a,x[1]-L*g],T=a/Math.max(.5,g),y=f?ot(t,f):t,w=n-f*T,M=y.map(E=>[E[0],w,E[1]]);f&&this.eaves(e,t,y,()=>w,r,l);const I=(o+1)%4,z=(o+2)%4,N=(o+3)%4,C=o;this.face(e,[M[C],M[I],b,P],s,c),this.face(e,[M[I],M[z],b],s,c),this.face(e,[M[z],M[N],P,b],s,c),this.face(e,[M[N],M[C],P],s,c)}taperRoof(e,t,n,a,s,c,f,r){const l=c.map(([d,o])=>t.map(i=>[n[0]+(i[0]-n[0])*d,a+s*o,n[1]+(i[1]-n[1])*d]));for(let d=0;d+1<l.length;d++){const o=l[d],i=l[d+1];for(let u=0;u<t.length;u++){const x=(u+1)%t.length;c[d+1][0]===0?this.face(e,[o[u],o[x],i[u]],f,r):this.face(e,[o[u],o[x],i[x],i[u]],f,r)}}}face(e,t,n,a){const s=t[0],c=t[1],f=t[2];let r=(c[1]-s[1])*(f[2]-s[2])-(c[2]-s[2])*(f[1]-s[1]),l=(c[2]-s[2])*(f[0]-s[0])-(c[0]-s[0])*(f[2]-s[2]),d=(c[0]-s[0])*(f[1]-s[1])-(c[1]-s[1])*(f[0]-s[0]);const o=Math.hypot(r,l,d);o>1e-8&&(r/=o,l/=o,d/=o,l<0&&(r=-r,l=-l,d=-d),e.poly(t,[r,l,d],n,a,i=>[i[0]/3,i[2]/3]))}eaves(e,t,n,a,s,c){const f=t.length,r=.18,l=[-1,-1,s,k(D.PLAIN,S.PLAIN)],d=c&&c.cat==="victorian"?_([.95,.94,.9]):_([.62,.6,.57]),o=d.map(i=>Math.round(i*.72));for(let i=0;i<f;i++){const u=(i+1)%f,x=n[i],g=n[u],p=g[0]-x[0],h=g[1]-x[1],m=Math.hypot(p,h);if(m<.05)continue;const v=a(x),L=a(g),b=a(t[i]),P=a(t[u]);e.q([[x[0],v-r,x[1]],[g[0],L-r,g[1]],[g[0],L,g[1]],[x[0],v,x[1]]],[h/m,0,-p/m],l,d),e.q([[x[0],v-r,x[1]],[g[0],L-r,g[1]],[t[u][0],Math.min(P,L)-r,t[u][1]],[t[i][0],Math.min(b,v)-r,t[i][1]]],[0,-1,0],l,o)}}box(e,t,n,a,s,c,f,r,l,d,o=null,i=null){const u=Math.cos(r),x=Math.sin(r),g=[[-s/2,-c/2],[s/2,-c/2],[s/2,c/2],[-s/2,c/2]].map(([h,m])=>[t+h*u-m*x,n+h*x+m*u]),p=a+f;for(let h=0;h<4;h++){const m=g[h],v=g[(h+1)%4],L=(m[0]+v[0])/2-t,b=(m[1]+v[1])/2-n,P=Math.hypot(L,b)||1,T=Math.hypot(v[0]-m[0],v[1]-m[1]);e.q([[m[0],a,m[1]],[v[0],a,v[1]],[v[0],p,v[1]],[m[0],p,m[1]]],[L/P,0,b/P],l,d,(y,w)=>[w===1||w===2?T/3:0,y[1]/3])}return e.q(g.map(h=>[h[0],p,h[1]]),[0,1,0],o||l,i||d),g}cylinder(e,t,n,a,s,c,f,r,l,d="flat",o=0,i=null,u=null){const x=a+c,g=[];for(let p=0;p<f;p++){const h=p/f*Math.PI*2;g.push([Math.cos(h),Math.sin(h)])}for(let p=0;p<f;p++){const h=g[p],m=g[(p+1)%f],v=[(h[0]+m[0])/2,(h[1]+m[1])/2],L=Math.hypot(v[0],v[1]);e.q([[t+h[0]*s,a,n+h[1]*s],[t+m[0]*s,a,n+m[1]*s],[t+m[0]*s,x,n+m[1]*s],[t+h[0]*s,x,n+h[1]*s]],[v[0]/L,0,v[1]/L],r,l,(b,P)=>[(p+(P===1||P===2?1:0))/f*2*Math.PI*s/3,b[1]/3])}if(d==="flat")e.poly(g.map(p=>[t+p[0]*s,x,n+p[1]*s]),[0,1,0],i||r,u||l);else if(d==="cone"){const p=[t,x+o,n];for(let h=0;h<f;h++){const m=g[h],v=g[(h+1)%f];this.face(e,[[t+m[0]*s*1.06,x,n+m[1]*s*1.06],[t+v[0]*s*1.06,x,n+v[1]*s*1.06],p],i||r,u||l)}}}rooftop(e,t,n,a,s,c,f,r,l,d){const o=Math.atan2(...(()=>{const y=ht(n);return[y[1],y[0]]})()),i=$t(n),u=Math.cos(o),x=Math.sin(o),g=(y,w,M,I)=>{for(const[z,N]of[[-M,-I],[M,-I],[M,I],[-M,I],[0,0]])if(!Yt(y+z*u-N*x,w+z*x+N*u,n,a))return!1;return!0},p=(y,w,M=10)=>{for(let I=0;I<M;I++){const z=i.minX+r()*(i.maxX-i.minX),N=i.minZ+r()*(i.maxZ-i.minZ);if(g(z,N,y+.8,w+.8))return[z,N]}return null},h=_([.78,.79,.8]),m=[-1,-1,l,k(D.METAL,S.PLAIN)],v=[-1,-1,l,k(D.PLAIN,S.PLAIN)],L=[-1,-1,l,k(d.curtain?D.CONCRETE_PANEL:d.pbr,S.PLAIN)],b=d.curtain?_([.72,.73,.74]):d.tint;let P=!1;if(f>40&&c>400){const y=Mt(n);for(let w=0;w<6;w++){const M=Math.sqrt(c)*(.42-w*.05);if(M<4)break;if(g(y[0],y[1],M/2+1,M*.35+1)){const I=3.5+r()*4.5;d.curtain?this.box(t,y[0],y[1],s,M,M*.7,I,o,[d.glassVariant,-1,l,k(D.PLAIN,S.CURTAIN)],d.glassTint,v,_([.5,.5,.5])):this.box(t,y[0],y[1],s,M,M*.7,I,o,L,b,[-1,-1,l,k(D.ROOF_TAR,S.PLAIN)],d.roofTint),P=!0,r()<.6&&this.box(t,y[0],y[1],s+I,M*.6,M*.4,2.2,o,m,h,v,_([.4,.4,.42]));break}}}if(!P&&e.floors>=5&&c>150){const y=p(2.2,3);y&&this.box(t,y[0],y[1],s,4.4,6,3.6,o,L,b,[-1,-1,l,k(D.ROOF_TAR,S.PLAIN)],d.roofTint)}const T=Math.min(8,Math.floor(c/500)+(c>200?1:0));for(let y=0;y<T;y++){const w=1.6+r()*3.4,M=1.2+r()*2.4,I=1+r()*1.6,z=p(w/2,M/2,8);z&&this.box(t,z[0],z[1],s,w,M,I,o,m,h,v,_([.34,.35,.36]))}if(d.prewar&&e.floors>=4&&e.floors<=16&&c>180&&r()<.12){const y=1.7+r()*.9,w=p(y+.5,y+.5);if(w){const M=_([.16,.16,.17]);for(const[I,z]of[[-1,-1],[1,-1],[1,1],[-1,1]])this.box(t,w[0]+I*y*.6,w[1]+z*y*.6,s,.22,.22,2,0,v,M);this.box(t,w[0],w[1],s+1.9,y*1.9,y*1.9,.12,0,v,M),this.cylinder(t,w[0],w[1],s+2.02,y,3.2+r()*1.6,12,[-1,-1,l,k(D.WOOD_SIDING,S.PLAIN)],_([.62,.48,.36]),"cone",.9,[-1,-1,l,k(D.ROOF_TAR,S.PLAIN)],_([.3,.3,.3]))}}if(f>85&&r()<.4){const y=1+Math.floor(r()*3);for(let w=0;w<y;w++){const M=p(.4,.4);if(!M)continue;const I=8+r()*18;this.box(t,M[0],M[1],s,.35,.35,I,o,m,h),this.box(t,M[0],M[1],s+I,.5,.5,.4,0,[2,-1,r(),k(D.PLAIN,S.LED)],_([1,.1,.05]))}}if(f<16&&c>260&&(d.cat==="industrial"||d.cat==="masonry"||d.cat==="office")&&r()<.5){const y=1+Math.floor(r()*Math.min(4,c/300));for(let w=0;w<y;w++){const M=3+r()*5,I=1.4,z=p(M/2,I/2);if(!z)continue;const N=(U,Q,O)=>[z[0]+U*u-Q*x,O,z[1]+U*x+Q*u],C=[1,-1,l,k(D.PLAIN,S.CURTAIN)],E=_([.7,.78,.82]);this.box(t,z[0],z[1],s,M,I,.35,o,v,_([.7,.7,.7]));const B=s+.35,$=B+.6;this.face(t,[N(-M/2,-I/2,B),N(M/2,-I/2,B),N(M/2,0,$),N(-M/2,0,$)],C,E),this.face(t,[N(-M/2,I/2,B),N(M/2,I/2,B),N(M/2,0,$),N(-M/2,0,$)],C,E)}}if((d.cat==="res"||d.curtain||d.cat==="office")&&f<70&&c>300&&r()<.22){const y=Ot(n,2.2);if(y&&Math.abs(it(y))>60&&kt(y)){const w=s+.45;this.flatPolygon(t,y,[],w,[-1,-1,l,k(D.GRASS,S.PLAIN)],_([.95,1,.92]),!0);for(let M=0;M<y.length;M++){const I=y[M],z=y[(M+1)%y.length],N=z[0]-I[0],C=z[1]-I[1],E=Math.hypot(N,C);E<.1||t.q([[I[0],s,I[1]],[z[0],s,z[1]],[z[0],w+.1,z[1]],[I[0],w+.1,I[1]]],[C/E,0,-N/E],[-1,-1,l,k(D.CONCRETE_PANEL,S.PLAIN)],_([.8,.8,.78]))}}}}build(e){const t=[];this.stats={baseTris:0,nearTris:0,farTris:0,windows:0,windowTris:0,cells:0,chunks:0,detailed:this.detailed};for(const a of this.base){const s=a.build(e,"buildings");s&&(t.push(s),this.stats.baseTris+=a.tris,this.stats.chunks++)}const n=Ut();for(const a of this.cells){if(!a.near.n&&!a.wins.n&&!a.far.n)continue;const s=new Jt;s.name="buildings-detail",s.position.set(a.cx,40,a.cz);const c=new Wt;c.name="buildings-near";const f=a.near.build(e,"buildings-near-walls");f&&c.add(f);const r=a.wins.build(e,n);r&&c.add(r);for(const d of c.children)d.position.set(-a.cx,-40,-a.cz),d.updateMatrix();const l=a.far.build(e,"buildings-far")||new t0;l.position.set(-a.cx,-40,-a.cz),l.updateMatrix(),s.addLevel(c,0),s.addLevel(l,this.lodDist,.05),s.updateMatrix(),t.push(s),this.stats.nearTris+=a.near.tris,this.stats.farTris+=a.far.tris,this.stats.windows+=a.wins.n,this.stats.windowTris+=a.wins.n*Zt,this.stats.cells++}return this.stats.totalTris=this.stats.baseTris+this.stats.nearTris+this.stats.farTris+this.stats.windowTris,t}}const mt=[],m0=4,p0=1<<17;function Lt(A){const e=mt.pop();return e?(e.n=0,e.ni=0,e.wall=null,e):new ut(A)}function Tt(A){A instanceof ut&&mt.length<m0&&A.vcap<=p0&&mt.push(A)}function D0(){const A=mt.length;return mt.length=0,A}class st{constructor(){this.n=0,this.ni=0,this.wall=null}v(){return this.n++}tri(){this.ni+=3}quad(){this.ni+=6}q(){this.n+=4,this.ni+=6}poly(e){this.n+=e.length,this.ni+=3*Math.max(0,e.length-2)}lift(){}add(){this.n++}get tris(){return 0}geometry(){return null}build(){return null}}class E0 extends u0{constructor(e,t={},n="full"){super(e,{...t,grid:!1,nearDetail:n!=="low"}),this.mode=n,this.tileBase=n==="near"?new st:Lt(4096),this.tileCells=new Map,this.detailedIds=[]}baseFor(){return this.tileBase}cellFor(e,t){const n=this.cellIndex(e,t);let a=this.tileCells.get(n);if(!a){const[s,c]=this.cellCentre(n),f=this.mode;a={key:n,cx:s,cz:c,near:f==="low"?new st:Lt(2048),far:f==="near"?new st:Lt(1024),wins:f==="low"?new st:new Gt},this.tileCells.set(n,a)}return a}*meshes(e){const t={base:null,cells:[],bytes:0,tris:0},n=s=>{if(s&&s.geometry)for(const c in s.geometry.attributes)t.bytes+=s.geometry.attributes[c].array.byteLength;s&&s.geometry&&s.geometry.index&&(t.bytes+=s.geometry.index.array.byteLength)};this.tileBase.n&&!(this.tileBase instanceof st)&&(t.base=this.tileBase.build(e,"buildings"),n(t.base),t.tris+=this.tileBase.tris,yield),Tt(this.tileBase),this.tileBase=null;const a=Ut();for(const s of this.tileCells.values()){const c={key:s.key,cx:s.cx,cz:s.cz,far:null,near:null};if(s.far.n&&!(s.far instanceof st)&&(c.far=s.far.build(e,"buildings-far"),c.far.position.set(-s.cx,-40,-s.cz),c.far.updateMatrix(),n(c.far),t.tris+=s.far.tris,yield),(s.near.n||s.wins.n)&&!(s.near instanceof st)){const f=new Wt;f.name="buildings-near";const r=s.near.build(e,"buildings-near-walls");r&&(f.add(r),n(r),t.tris+=s.near.tris),yield;const l=s.wins.build(e,a);l&&(f.add(l),n(l),t.tris+=s.wins.n*Zt,t.windows=(t.windows||0)+s.wins.n);for(const d of f.children)d.position.set(-s.cx,-40,-s.cz),d.updateMatrix();c.near=f,yield}(c.far||c.near)&&t.cells.push(c),Tt(s.far),Tt(s.near)}return this.tileCells.clear(),t}}function St(A,e,t){const n=e[0]-A[0],a=e[1]-A[1],s=Math.hypot(n,a);if(s<.05)return null;let c=a/s,f=-n/s;t||(c=-c,f=-f);const r=t?1:0,l=t?0:1;return{ax:A[0],az:A[1],dx:n/s,dz:a/s,ox:c,oz:f,L:s,mx:(A[0]+e[0])/2,mz:(A[1]+e[1])/2,uDir0:l,uDir1:r}}function v0(A,e,t,n,a){const s=[e,t];for(const o of n)o[2]>e&&o[2]<t&&s.push(o[2]),o[3]>e&&o[3]<t&&s.push(o[3]);s.sort((o,i)=>o-i);const c=s.filter((o,i)=>i===0||o-s[i-1]>.004);let f=null,r=0,l=null;const d=o=>{if(l)for(const[i,u]of l)a(i,u,r,o)};for(let o=0;o+1<c.length;o++){const i=c[o],u=c[o+1],x=(i+u)/2,g=n.filter(v=>v[2]<=x&&v[3]>=x).map(v=>[v[0],v[1]]).sort((v,L)=>v[0]-L[0]),p=[];let h=0;for(const[v,L]of g)v>h+.004&&p.push([h,v]),h=Math.max(h,L);A>h+.004&&p.push([h,A]);const m=p.map(v=>`${v[0].toFixed(3)}:${v[1].toFixed(3)}`).join("|");m!==f&&(d(i),f=m,r=i,l=p)}d(c[c.length-1])}function kt(A){let e=0;for(let t=0;t<A.length;t++){const n=A[t],a=A[(t+1)%A.length],s=A[(t+2)%A.length],c=(a[0]-n[0])*(s[1]-a[1])-(a[1]-n[1])*(s[0]-a[0]);if(Math.abs(c)<1e-6)continue;const f=Math.sign(c);if(e&&f!==e)return!1;e=f}return!0}function x0(A,e){for(let t=0;t<A.length;t++){const n=A[t],a=A[(t+1)%A.length];if((n[0]-e[0])*(a[1]-e[1])-(n[1]-e[1])*(a[0]-e[0])<=0)return!1}return!0}function ht(A){let e=0,t=[1,0];for(let n=0;n<A.length;n++){const a=A[n],s=A[(n+1)%A.length],c=s[0]-a[0],f=s[1]-a[1],r=Math.hypot(c,f);r>e&&(e=r,t=[c/r,f/r])}return t}function g0(A){const e=ht(A);let t=1/0,n=-1/0;for(const a of A){const s=-a[0]*e[1]+a[1]*e[0];t=Math.min(t,s),n=Math.max(n,s)}return n-t}function Ot(A,e){const t=A.length,n=[];for(let a=0;a<t;a++){const s=A[(a+t-1)%t],c=A[a],f=A[(a+1)%t],r=c[0]-s[0],l=c[1]-s[1],d=Math.hypot(r,l),o=f[0]-c[0],i=f[1]-c[1],u=Math.hypot(o,i);if(d<1e-6||u<1e-6)return null;const x=-l/d,g=r/d,p=-i/u,h=o/u;let m=x+p,v=g+h;const L=Math.hypot(m,v);L<.001?(m=x,v=g):(m/=L,v/=L);const b=Math.max(.35,m*x+v*g),P=Math.min(e/b,e*2.5,d*.45,u*.45);n.push([c[0]+m*P,c[1]+v*P])}return n}function ot(A,e){const t=A.length,n=[];for(let a=0;a<t;a++){const s=A[(a+t-1)%t],c=A[a],f=A[(a+1)%t],r=c[0]-s[0],l=c[1]-s[1],d=Math.hypot(r,l)||1e-6,o=f[0]-c[0],i=f[1]-c[1],u=Math.hypot(o,i)||1e-6,x=l/d,g=-r/d,p=i/u,h=-o/u;let m=x+p,v=g+h;const L=Math.hypot(m,v);L<.001?(m=x,v=g):(m/=L,v/=L);const b=Math.max(.4,m*x+v*g),P=Math.min(e/b,e*2.5);n.push([c[0]+m*P,c[1]+v*P])}return n}function w0(A,e,t,n){const a=[];for(let s=0;s<A.length;s++){const c=A[s],f=A[(s+1)%A.length];a.push(c);const r=(c[0]-e[0])*t+(c[1]-e[1])*n,l=(f[0]-e[0])*t+(f[1]-e[1])*n;if(r>1e-6&&l<-1e-6||r<-1e-6&&l>1e-6){const d=r/(r-l);a.push([c[0]+(f[0]-c[0])*d,c[1]+(f[1]-c[1])*d])}}return a}function y0(A,e,t){const n=-t[1],a=t[0],s=r=>(r[0]-e[0])*n+(r[1]-e[1])*a,c=A.filter(r=>s(r)>=-1e-6),f=A.filter(r=>s(r)<=1e-6);return[c,f].filter(r=>r.length>=3&&Math.abs(it(r))>.1)}export{u0 as B,bt as D,ut as G,S as M,st as N,E0 as T,Zt as U,k as a,R0 as b,T0 as c,N0 as d,z0 as e,Ot as i,ht as l,ot as o,D0 as r,yt as t};
