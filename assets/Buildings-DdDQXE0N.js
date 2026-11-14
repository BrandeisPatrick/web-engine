import{W as ct,F as H,P as C,a as Kt}from"./FacadeTextures-CKKwej-R.js";import{a as Ct,s as it,c as It,r as Vt,p as $t}from"./geom-CfAKTJNw.js";import{G as At}from"./GBuffer-rfFucz07.js";import{c as Y}from"./noise-g5kHFeMn.js";import{l as Yt,a$ as Et,b1 as Qt,H as Wt,J as Jt,j as kt,K as nt,M as Bt,I as t0,a as ft,aQ as e0,V as Dt,r as n0,C as ut,F as wt,aX as s0,aY as i0,ap as o0,D as a0,s as qt}from"./three.module-B_yomNYV.js";const _={WALL:0,WALLONLY:1,PANE:2,PLAIN:3,GRATE:4,SIGN:5,CLOCK:6,CURTAIN:7,LED:8},O=(I,e)=>I+64*e,l0=`
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
varying vec2 vFuv;
varying vec2 vWuv;
varying vec4 vInfo;
varying vec3 vTint;
varying vec3 vWPos;
varying vec3 vWall; // street height, overhang (AO) height, 1 = wall vertex
float fHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// interior mapping: room box behind the glass. id = room cell, f = entry point (0..1), rt = tangent-space ray
// (x along the wall, y up, z out of the wall; rt.z < 0 looking in). Returns lit colour (pre-exposure).
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
  return c * (dayK * day) * vec3(1.0, 0.98, 0.95) + c * lcol * nightK;
}
`,r0=`
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
      float glow = 0.0;
      vec3 room = fRoom(id, f, fRt, vInfo.z, lit, lc, fDay, store, glow);
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
      vec3 avg = vec3(0.6, 0.57, 0.52) * (0.04 * fDay * (1.0 + store) + lc * lit * 0.62);
      fEmis = mix(room, avg, far);
      fGlass = 1.0;
      fCol = vec3(0.025);
      fRough = 0.05;
      fSpec = vec3(0.05);
      fEnv = 1.5;
      fNxy = (vec2(fHash(id + 0.3), fHash(id + 0.7)) - 0.5) * 0.035;
      fNStr = 1.0;
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
  vec3 room = fRoom(id, f, fRt, vInfo.z, lit, lc, fDay * 1.2, 0.0, glow) + lc * glow * 1.2;
  float far = smoothstep(0.12, 0.45, max(fwidth(g.x * 0.5), fw.y));
  room = mix(room, vec3(0.55) * (0.04 * fDay + lc * lit * 0.55), far);
  vec3 tint = vTint;
  fGlass = 1.0;
  fCol = tint * 0.05;
  fRough = 0.035;
  fSpec = mix(vec3(0.07), tint * 0.22, 0.75);
  fEmis = room * tint * 0.9;
  fNxy = (vec2(fHash(id + 0.31 + floor(g.x)), fHash(id + 0.77 + floor(g.x))) - 0.5) * 0.02;
  fNStr = 1.0;
  float envK = 1.0;
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
  }
  if (frame > 0.01) {
    vec3 mc = variant > 2.5 ? vec3(0.75, 0.76, 0.77) : (fract(vInfo.z * 3.3) > 0.5 ? vec3(0.62, 0.64, 0.66) : vec3(0.16, 0.16, 0.17));
    fCol = mix(fCol, mc, frame);
    fEmis *= 1.0 - frame;
    fMetal = mix(fMetal, 0.85, frame);
    fRough = mix(fRough, 0.32, frame);
    fGlass *= 1.0 - step(0.5, frame);
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
`;function c0(I,e){const t=e?`
attribute vec4 iP; attribute vec4 iD; attribute vec4 iF; attribute vec4 iInfo; attribute vec3 iTint;
attribute vec2 aOff; attribute float aPart;`:`
attribute vec2 aFuv; attribute vec4 aInfo; attribute vec3 aTint; attribute float aWu; attribute vec2 aGy;`;return I.replace("#include <common>",`#include <common>${t}
varying vec2 vFuv; varying vec2 vWuv; varying vec4 vInfo; varying vec3 vTint; varying vec3 vWPos; varying vec3 vWall;`).replace("#include <beginnormal_vertex>",e?`
vec3 wD = vec3(iD.x, 0.0, iD.y); vec3 wO = vec3(iD.y, 0.0, -iD.x);
vec3 objectNormal = wD * normal.x + vec3(0.0, normal.y, 0.0) + wO * normal.z;`:"vec3 objectNormal = vec3( normal );").replace("#include <begin_vertex>",e?`
int wFl = int(iInfo.y + 0.5);
bool wOn = aPart < 1.5 || (aPart < 2.5 ? (wFl & 2) != 0 : (wFl & 1) != 0);
float wZ = position.z * (aPart < 1.5 ? iP.w : 1.0);
vec3 transformed = wOn ? iP.xyz + wD * (position.x * iD.z + aOff.x) + vec3(0.0, position.y * iD.w + aOff.y, 0.0) + wO * wZ : iP.xyz;
vFuv = iF.xy + position.xy * iF.zw;
vInfo = aPart < 0.5 ? vec4(iInfo.x, -1.0, iInfo.z, ${O(C.PLAIN,_.PANE)}.0) : vec4(-1.0, -1.0, iInfo.z, iInfo.w);
vTint = iTint;`:`
vec3 transformed = vec3( position );
vFuv = aFuv; vInfo = vec4(aInfo.xy, aInfo.z * 0.001, aInfo.w); vTint = aTint;`).replace("#include <project_vertex>",`#include <project_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
{ vec3 wn = normalize(mat3(modelMatrix) * objectNormal);
  vec2 tw = vec2(-wn.z, wn.x); float tl = length(tw);
  vWuv = (abs(wn.y) > 0.7 || tl < 1e-3) ? vWPos.xz : vec2(dot(vWPos.xz, tw / tl), vWPos.y);
  ${e?"vWall = vec3(0.0);":`// walls: PBR u runs continuously round the footprint (bricks wrap the corners)
  vWall = vec3((aGy.x - 16384.0) * 0.05, aGy.y > 0.5 ? (aGy.y - 16384.0) * 0.05 : -1e4, step(0.5, aGy.x));
  if (vWall.z > 0.5 && abs(wn.y) < 0.7) vWuv.x = aWu;`} }`)}function f0(I,e){const t=e?`
attribute vec4 iP; attribute vec4 iD; attribute vec4 iF; attribute vec4 iInfo;
attribute vec2 aOff; attribute float aPart;`:`
attribute vec2 aFuv; attribute vec4 aInfo;`;return I.replace("#include <common>",`#include <common>${t}
varying vec2 vFuv; varying vec4 vInfo;`).replace("#include <begin_vertex>",e?`
vec3 wD = vec3(iD.x, 0.0, iD.y); vec3 wO = vec3(iD.y, 0.0, -iD.x);
int wFl = int(iInfo.y + 0.5);
bool wOn = aPart < 1.5 || (aPart < 2.5 ? (wFl & 2) != 0 : (wFl & 1) != 0);
float wZ = position.z * (aPart < 1.5 ? iP.w : 1.0);
vec3 transformed = wOn ? iP.xyz + wD * (position.x * iD.z + aOff.x) + vec3(0.0, position.y * iD.w + aOff.y, 0.0) + wO * wZ : iP.xyz;
vFuv = vec2(0.0); vInfo = vec4(0.0);`:`
vec3 transformed = vec3( position );
vFuv = aFuv; vInfo = vec4(aInfo.xy, aInfo.z * 0.001, aInfo.w);`)}const h0=`
{
  float fModeF = floor(vInfo.w / 64.0 + 0.001);
  if (fModeF > 3.5 && fModeF < 4.5) {
    float pat = vInfo.x; vec2 g = vFuv; float bar;
    if (pat < 0.5) { float bx = abs(fract(g.x / 0.12) - 0.5) * 0.12; bar = max(step(bx, 0.011), max(step(0.93, g.y), step(g.y, 0.05))); }
    else if (pat < 1.5) { float tv = abs(fract(g.y / 0.22) - 0.5) * 0.22; bar = max(step(tv, 0.035), max(step(g.x, 0.09), step(0.91, g.x))); }
    else { float tv = abs(fract(g.y / 0.3) - 0.5) * 0.3; bar = max(step(tv, 0.016), max(step(g.x, 0.11), step(0.89, g.x))); }
    if (bar < 0.5) discard;
  }
}`;function N0(I,e){const t=new Array(16).fill(2);(e.sizes||[]).forEach((c,f)=>{f<16&&(t[f]=c||2)});const s={uAlb:{value:I.albedo},uDat:{value:I.data},uPA:{value:e.albedo},uPN:{value:e.normal},uPbrSize:{value:t},uNight:{value:0},uLitFrac:{value:.35},uWinGain:{value:1.3},uTime:{value:0},uClock:{value:17.85}},r=c=>{const f=new o0({roughness:1,metalness:0,ior:1.5,specularIntensity:1,envMapIntensity:1});return f.onBeforeCompile=l=>{Object.assign(l.uniforms,s),l.vertexShader=c0(l.vertexShader,c),l.fragmentShader=l.fragmentShader.replace("#include <common>",`#include <common>
${l0}`).replace("#include <map_fragment>",r0).replace("#include <roughnessmap_fragment>","float roughnessFactor = fRough;"+At.roughnessmap_fragment).replace("#include <metalnessmap_fragment>","float metalnessFactor = fMetal;"+At.metalnessmap_fragment).replace("#include <normal_fragment_maps>",`{
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
  vec2 st0 = dFdx(vWuv), st1 = dFdy(vWuv);
  vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
  vec3 T = q1p * st0.x + q0p * st1.x, Bt = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(Bt, Bt));
  float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec2 nxy = fNxy * fNStr;
  vec3 mapN = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  normal = normalize(T * (mapN.x * sc) + Bt * (mapN.y * sc) + normal * mapN.z);
}`+At.normal_fragment_maps).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += fEmis;`).replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>
if (fGlass > 0.5) { material.specularColor = fSpec; material.specularF90 = 1.0; }`).replace("#include <aomap_fragment>",`{
  float aoI = mix(1.0, fAO, 0.85);
  reflectedLight.indirectDiffuse *= aoI;
  reflectedLight.indirectSpecular *= aoI * fEnv;
  reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}`)},f.customProgramCacheKey=()=>c?"roadster-facade-win-3":"roadster-facade-3",f.shadowSide=a0,f.userData.uniforms=s,f},n=c=>{const f=new s0({depthPacking:i0});return f.onBeforeCompile=l=>{l.vertexShader=f0(l.vertexShader,c),l.fragmentShader=l.fragmentShader.replace("#include <common>",`#include <common>
varying vec2 vFuv; varying vec4 vInfo;`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
${c?"":h0}`)},f.customProgramCacheKey=()=>c?"roadster-facade-depth-win-3":"roadster-facade-depth-3",f};return{facade:r(!1),windows:r(!0),depth:n(!1),winDepth:n(!0),uniforms:s}}class mt{constructor(e=1024){this.n=0,this.ni=0,this.wall=null,this._alloc(e,e*2)}_alloc(e,t){const s=(r,n,c)=>{const f=new n(c);return r&&f.set(r.subarray(0,Math.min(r.length,c))),f};this.pos=s(this.pos,Float32Array,e*3),this.nor=s(this.nor,Int8Array,e*3),this.fuv=s(this.fuv,Float32Array,e*2),this.info=s(this.info,Int16Array,e*4),this.tint=s(this.tint,Uint8Array,e*3),this.wu=s(this.wu,Float32Array,e),this.gy=s(this.gy,Int16Array,e*2),this.idx=s(this.idx,Uint32Array,t),this.vcap=e,this.icap=t}v(e,t,s,r,n,c,f,l,a,u){this.n>=this.vcap&&this._alloc(this.vcap*2,this.icap);const o=this.n,i=this.pos,m=this.nor,g=this.fuv,x=this.info,p=this.tint;i[o*3]=e,i[o*3+1]=t,i[o*3+2]=s,m[o*3]=Math.round(r*127),m[o*3+1]=Math.round(n*127),m[o*3+2]=Math.round(c*127),g[o*2]=f,g[o*2+1]=l,x[o*4]=a[0],x[o*4+1]=a[1],x[o*4+2]=Math.round(a[2]*1e3),x[o*4+3]=a[3],p[o*3]=u[0],p[o*3+1]=u[1],p[o*3+2]=u[2];const h=this.wall;if(h){this.wu[o]=(h.u0+h.sg*((e-h.ax)*h.dx+(s-h.az)*h.dz))*h.k;const d=h.gy?h.gy(e,s):0;this.gy[o*2]=Y(Math.round(d*20)+16384,1,32767),this.gy[o*2+1]=h.ao>-1e3?Y(Math.round(h.ao*20)+16384,1,32767):0}else this.wu[o]=0,this.gy[o*2]=0,this.gy[o*2+1]=0;return this.n++}tri(e,t,s){this.ni+3>this.icap&&this._alloc(this.vcap,this.icap*2);const r=this.pos,n=this.nor,c=r[e*3],f=r[e*3+1],l=r[e*3+2],a=r[t*3]-c,u=r[t*3+1]-f,o=r[t*3+2]-l,i=r[s*3]-c,m=r[s*3+1]-f,g=r[s*3+2]-l,x=u*g-o*m,p=o*i-a*g,h=a*m-u*i,d=this.idx;x*n[e*3]+p*n[e*3+1]+h*n[e*3+2]>=0?(d[this.ni++]=e,d[this.ni++]=t,d[this.ni++]=s):(d[this.ni++]=e,d[this.ni++]=s,d[this.ni++]=t)}quad(e,t,s,r){this.tri(e,t,s),this.tri(e,s,r)}q(e,t,s,r,n){const c=e.map((f,l)=>{const a=typeof n=="function"?n(f,l):n?n[l]:[0,0];return this.v(f[0],f[1],f[2],t[0],t[1],t[2],a[0],a[1],s,r)});this.quad(c[0],c[1],c[2],c[3])}poly(e,t,s,r,n){const c=e.map((f,l)=>{const a=typeof n=="function"?n(f,l):n?n[l]:[0,0];return this.v(f[0],f[1],f[2],t[0],t[1],t[2],a[0],a[1],s,r)});for(let f=1;f+1<c.length;f++)this.tri(c[0],c[f],c[f+1])}lift(e,t){if(!t)return;const s=this.pos;for(let r=e;r<this.n;r++)s[r*3+1]+=t}get tris(){return this.ni/3}geometry(){if(!this.n)return null;const e=new kt;return e.setAttribute("position",new nt(this.pos.slice(0,this.n*3),3)),e.setAttribute("normal",new nt(this.nor.slice(0,this.n*3),3,!0)),e.setAttribute("aFuv",new nt(this.fuv.slice(0,this.n*2),2)),e.setAttribute("aInfo",new nt(this.info.slice(0,this.n*4),4,!1)),e.setAttribute("aTint",new nt(this.tint.slice(0,this.n*3),3,!0)),e.setAttribute("aWu",new nt(this.wu.slice(0,this.n),1)),e.setAttribute("aGy",new nt(this.gy.slice(0,this.n*2),2,!1)),e.setIndex(new nt(this.idx.slice(0,this.ni),1)),e.computeBoundingSphere(),e.computeBoundingBox(),e}build(e,t="buildings"){const s=this.geometry();if(!s)return null;const r=new Bt(s,e.facade);return r.customDepthMaterial=e.depth,r.castShadow=!0,r.receiveShadow=!0,r.matrixAutoUpdate=!1,r.updateMatrix(),r.name=t,r}}class Gt{constructor(){this.n=0,this.cap=256,this.P=new Float32Array(1024),this.D=new Float32Array(1024),this.F=new Float32Array(1024),this.I=new Float32Array(1024),this.T=new Uint8Array(768)}add(e,t,s,r,n,c,f,l,a,u,o,i,m,g,x,p,h){if(this.n>=this.cap){const v=(N,b)=>{const P=new N.constructor(this.cap*2*b);return P.set(N),P};this.P=v(this.P,4),this.D=v(this.D,4),this.F=v(this.F,4),this.I=v(this.I,4),this.T=v(this.T,3),this.cap*=2}const d=this.n++;this.P.set([e,t,s,r],d*4),this.D.set([n,c,f,l],d*4),this.F.set([a,u,o,i],d*4),this.I.set([m,g,x,p],d*4),this.T.set(h,d*3)}lift(e,t){if(t)for(let s=e;s<this.n;s++)this.P[s*4+1]+=t}build(e,t){if(!this.n)return null;const s=new t0;for(const i of["position","normal","aOff","aPart"])s.setAttribute(i,t.getAttribute(i));s.setIndex(t.getIndex());const r=this.n;s.setAttribute("iP",new ft(this.P.slice(0,r*4),4)),s.setAttribute("iD",new ft(this.D.slice(0,r*4),4)),s.setAttribute("iF",new ft(this.F.slice(0,r*4),4)),s.setAttribute("iInfo",new ft(this.I.slice(0,r*4),4)),s.setAttribute("iTint",new ft(this.T.slice(0,r*3),3,!0)),s.instanceCount=r;let n=1/0,c=1/0,f=1/0,l=-1/0,a=-1/0,u=-1/0;for(let i=0;i<r;i++){const m=this.P[i*4],g=this.P[i*4+1],x=this.P[i*4+2],p=Math.max(this.D[i*4+2],this.D[i*4+3])+1;n=Math.min(n,m-p),l=Math.max(l,m+p),c=Math.min(c,g-1),a=Math.max(a,g+p),f=Math.min(f,x-p),u=Math.max(u,x+p)}s.boundingBox=new e0(new Dt(n,c,f),new Dt(l,a,u)),s.boundingSphere=s.boundingBox.getBoundingSphere(new n0);const o=new Bt(s,e.windows);return o.customDepthMaterial=e.winDepth,o.castShadow=!0,o.receiveShadow=!0,o.matrixAutoUpdate=!1,o.updateMatrix(),o.name="building-windows",o}}let Pt=null;function Ht(){if(Pt)return Pt;const I=[],e=[],t=[],s=[],r=[],n=(a,u,o,i,m,g,x)=>(I.push(a,u,o),e.push(i[0],i[1],i[2]),t.push(m,g),s.push(x),I.length/3-1),c=(a,u,o,i,m)=>{const g=A=>[I[A*3]+t[A*2]*.3,I[A*3+1]+t[A*2+1]*.3,I[A*3+2]],x=g(a),p=g(u),h=g(o),d=p[0]-x[0],v=p[1]-x[1],N=p[2]-x[2],b=h[0]-x[0],P=h[1]-x[1],L=h[2]-x[2],y=v*L-N*P,w=N*b-d*L,M=d*P-v*b;y*m[0]+w*m[1]+M*m[2]>=0?r.push(a,o,u,a,i,o):r.push(a,u,o,a,o,i)};{const a=[0,0,1];c(n(0,0,-1,a,0,0,0),n(1,0,-1,a,0,0,0),n(1,1,-1,a,0,0,0),n(0,1,-1,a,0,0,0),a)}{const a=[1,0,0];c(n(0,0,0,a,0,0,1),n(0,0,-1,a,0,0,1),n(0,1,-1,a,0,0,1),n(0,1,0,a,0,0,1),a)}{const a=[-1,0,0];c(n(1,0,0,a,0,0,1),n(1,0,-1,a,0,0,1),n(1,1,-1,a,0,0,1),n(1,1,0,a,0,0,1),a)}{const a=[0,1,0];c(n(0,0,0,a,0,0,1),n(1,0,0,a,0,0,1),n(1,0,-1,a,0,0,1),n(0,0,-1,a,0,0,1),a)}{const a=[0,-1,0];c(n(0,1,0,a,0,0,1),n(1,1,0,a,0,0,1),n(1,1,-1,a,0,0,1),n(0,1,-1,a,0,0,1),a)}const f=(a,u,o,i,m,g,x,p)=>{const h=(v,N,b,P,L)=>n(v,a,P,L,N,b,x);let d;p.includes("t")&&(d=[0,1,0],c(h(0,-g,o,m,d),h(1,g,o,m,d),h(1,g,o,i,d),h(0,-g,o,i,d),d)),d=[0,0,1],c(h(0,-g,u,m,d),h(1,g,u,m,d),h(1,g,o,m,d),h(0,-g,o,m,d),d),p.includes("b")&&(d=[0,-1,0],c(h(0,-g,u,m,d),h(1,g,u,m,d),h(1,g,u,i,d),h(0,-g,u,i,d),d))};f(0,-.1,.025,-.05,.075,.07,2,"tb"),f(1,0,.2,0,.055,.06,3,"b");const l=new kt;return l.setAttribute("position",new wt(I,3)),l.setAttribute("normal",new wt(e,3)),l.setAttribute("aOff",new wt(t,2)),l.setAttribute("aPart",new wt(s,1)),l.setIndex(r),Pt=l,l}const Ut=20,Zt=(I,e,t)=>new ut().setRGB(I,e,t,qt);function yt(I){return[Y(Math.round(I.r*255),0,255),Y(Math.round(I.g*255),0,255),Y(Math.round(I.b*255),0,255)]}const L0=(I,e,t)=>yt(Zt(I,e,t)),Z=(I,e)=>I[Math.min(I.length-1,Math.floor(e*I.length))];function Ft(I){if(!I||typeof I!="string")return null;const e=I.trim().toLowerCase().replace(/\s+/g,"");if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(e)||ut.NAMES&&e in ut.NAMES)try{const t=new ut;return t.setStyle(e,qt),t}catch{return null}return null}const J={brickRed:[[1,.96,.94],[.92,.86,.82],[1,.9,.86],[.86,.8,.76],[1,1,1]],brickPaint:[[.97,.96,.92],[.92,.88,.8],[.78,.8,.8],[.66,.7,.62],[.93,.85,.72],[.74,.62,.55],[.58,.6,.63]],stone:[[.98,.93,.84],[.93,.88,.78],[.86,.82,.74],[1,.97,.9],[.8,.77,.72],[.94,.88,.82]],concrete:[[.86,.86,.84],[.76,.76,.75],[.66,.66,.66],[.92,.91,.88],[.8,.78,.74]],stucco:[[1,.96,.88],[.97,.9,.78],[.9,.93,.95],[1,.92,.84],[.92,.96,.9],[1,1,.98],[.96,.85,.72],[.98,.86,.8]],victorian:[[.62,.74,.86],[.96,.88,.62],[.72,.84,.72],[.96,.78,.76],[.98,.97,.94],[.78,.78,.8],[.6,.66,.58],[.86,.7,.86],[.95,.83,.62]],white:[[.98,.98,.97],[.93,.93,.91],[.86,.87,.88],[.95,.92,.86]],roof:[[.5,.5,.5],[.38,.38,.39],[.62,.61,.58],[.3,.3,.32],[.88,.88,.86],[.72,.72,.7]],pitched:[[.86,.86,.88],[1,.62,.48],[.62,.62,.66],[.9,.78,.66]],glass:[[.56,.7,.84],[.55,.76,.72],[.46,.48,.52],[.66,.58,.48],[.74,.8,.86],[.5,.62,.74]],sign:[[.62,.1,.08],[.1,.22,.48],[.82,.62,.12],[.08,.36,.2],[.9,.9,.86],[.06,.06,.07],[.42,.12,.34],[.86,.32,.08]],awning:[[.55,.1,.1],[.08,.26,.18],[.12,.18,.36],[.08,.08,.09],[.66,.5,.2],[.8,.78,.72],[.42,.08,.2]]},S=(I,e=1)=>yt(Zt(I[0]*e,I[1]*e,I[2]*e)),bt={oldProb:()=>.4,victorianProb:()=>.3,namedRe:/building|hotel|bank|exchange|hall|church|theat|temple|club|lodge|house|cathedral|mission/i};function T0(I,e,t,s,r,n=bt){return Xt(I,e,t,s,r,{...bt,...n||{}})}function Xt(I,e,t,s,r,n=bt){const c=n.storeProb||{},f=I.t||"yes",l=(I.m||"").toLowerCase(),a=String(I.n||""),u=s(),o=s(),i=s(),m=/^(apartments|residential|house|detached|terrace|dormitory|hostel|semidetached_house)$/.test(f),g=/^(office|commercial|hotel|government|bank|mixed_use|university|public|data_center)$/.test(f),x=/^(industrial|warehouse|service|garage|garages|shed|hangar|storage_tank|manufacture|transportation|train_station)$/.test(f),p=c.anyType&&!/^(garage|garages|shed|roof|carport|parking|industrial|warehouse)$/.test(f)||/^(commercial|retail|mixed_use|yes|hotel|apartments|office)$/.test(f),h={cat:"modern",win:H.PUNCHED,store:!1,pbr:C.CONCRETE_PANEL,tint:S([.85,.85,.83]),trimPbr:C.STUCCO_B,trimTint:S([.9,.88,.84]),basePbr:-1,baseTint:null,roofPbr:C.ROOF_TAR,roofTint:S(Z(J.roof,s())),bayW:3.2,floorH:3.6,prewar:!1,curtain:!1,glassVariant:0,glassTint:null,sill:!0,lintel:!1,depth:.14,cornice:!1,courses:0,fireEscape:!1,balconies:!1,bays:!1,water:!1},d=r?n.oldProb(r.xb,r.zb):.4,v=n.namedRe.test(a),N=e<95&&!/glass|mirror/.test(l)&&(i<d||v&&e<70&&i<.85);if(I.water)Object.assign(h,{cat:"industrial",win:-1,pbr:C.METAL,tint:S([.8,.8,.8]),floorH:6,sill:!1});else if(/glass|mirror/.test(l)||!N&&(e>=60&&u<.6||e>=28&&g&&u<.35||e>=28&&u<.12))Object.assign(h,{cat:"glass",curtain:!0,win:-1,bayW:1.5,floorH:3.9,glassVariant:Math.floor(o*4),glassTint:S(Z(J.glass,s()))});else if(f==="parking")Object.assign(h,{cat:"garage",win:H.GARAGE,pbr:C.CONCRETE_ROUGH,tint:S(Z(J.concrete,o)),floorH:3.1,sill:!1,depth:.5});else if(f==="roof"||f==="carport"||f==="bridge"||f==="pavilion"||f==="tent")Object.assign(h,{cat:"shed",win:-1,pbr:C.METAL,tint:S([.82,.82,.8]),sill:!1});else if(x&&!/brick/.test(l)){const y=o<.4;Object.assign(h,{cat:"industrial",win:H.INDUSTRIAL,pbr:y?C.METAL:o<.75?C.CONCRETE_ROUGH:C.BRICK_RED,tint:S(Z(J.concrete,i)),floorH:4.5,bayW:4})}else if(N||/brick|stone|sandstone|granite|marble|limestone/.test(l))if(h.prewar=!0,h.cornice=e>7,h.courses=e>14?1:0,h.lintel=!0,h.depth=.26,h.floorH=3.7,e<=16.5&&(m||f==="house"||f==="yes"&&t<320)&&u<(r?n.victorianProb(r.xb,r.zb):.3))Object.assign(h,{cat:"victorian",win:H.VICTORIAN,pbr:C.WOOD_SIDING,tint:S(Z(J.victorian,o)),trimPbr:C.PLAIN,trimTint:S([.96,.95,.92]),bayW:2.3,floorH:3.3,depth:.16,bays:!0,courses:0});else if(/brick/.test(l)||u<.42){const w=s();Object.assign(h,{cat:"masonry",pbr:w<.6?C.BRICK_RED:w<.78?C.BRICK_DARK:C.BRICK_PAINTED,win:x?H.INDUSTRIAL:Z([H.PUNCHED,H.PAIR,H.PUNCHED,H.SMALL,H.CLASSIC],o),trimPbr:C.CONCRETE_PANEL,trimTint:S(Z(J.stone,i)),floorH:3.5,bayW:x?4:3}),h.tint=h.pbr===C.BRICK_PAINTED?S(Z(J.brickPaint,s())):S(Z(J.brickRed,s())),h.fireEscape=e>=11&&e<=46&&s()<.75}else u<.78?Object.assign(h,{cat:"masonry",pbr:s()<.55?C.CONCRETE_PANEL:C.GRANITE,tint:S(Z(J.stone,o)),win:Z([H.CLASSIC,H.PUNCHED,H.CLASSIC,H.PAIR],s()),trimPbr:C.CONCRETE_PANEL,trimTint:S(Z(J.stone,i),1.05),basePbr:C.GRANITE,baseTint:S([.55,.52,.5]),courses:e>20?2:1}):Object.assign(h,{cat:"masonry",pbr:s()<.5?C.STUCCO_A:C.STUCCO_B,tint:S(Z(J.stucco,o)),win:Z([H.PAIR,H.SMALL,H.PUNCHED],s()),trimTint:S([.96,.95,.92]),floorH:3.3});else if(m||e<60&&u<.3){const y=s()<.7;Object.assign(h,y?{cat:"res",win:H.MODERN_RES,pbr:s()<.5?C.STUCCO_B:C.CONCRETE_PANEL,tint:S(Z(J.white,o)),floorH:3.1,bayW:3.4,balconies:e>9&&s()<.55,sill:!1,depth:.12}:{cat:"res",win:Z([H.PAIR,H.SMALL],o),pbr:s()<.5?C.STUCCO_A:C.BRICK_PAINTED,tint:S(Z(J.stucco,i)),floorH:3,bayW:3.2,depth:.16})}else{const y=s();Object.assign(h,{cat:"office",pbr:y<.5?C.CONCRETE_PANEL:y<.8?C.CONCRETE_ROUGH:C.GRANITE,tint:S(Z(J.concrete,o)),win:Z([H.RIBBON,H.OFFICE_MODERN,H.VERTICAL,H.PUNCHED,H.OFFICE_MODERN],i),floorH:3.8,depth:.14,sill:!1}),h.win===H.VERTICAL&&(h.depth=.32)}h.store=p&&e>3.6&&!I.mh&&!I.water&&!h.curtain&&h.cat!=="garage"&&h.cat!=="shed"&&h.cat!=="industrial"&&(h.prewar||h.cat==="office"||h.cat==="res"?s()<(h.prewar?c.prewar??.85:c.other??.55):!1),h.curtain&&(h.store=e>20&&s()<(c.curtain??.4)),I.lv>0&&e/I.lv>2.6&&e/I.lv<6&&(h.floorH=e/I.lv);const b=Ft(I.c);if(b&&!h.curtain){const y=new ut().setRGB(h.tint[0]/255,h.tint[1]/255,h.tint[2]/255).lerp(b,.6);h.tint=yt(y)}const P=Ft(I.rc);P?h.roofTint=yt(P):(h.cat==="res"||h.curtain)&&(h.roofTint=S(Z([[.88,.88,.86],[.5,.5,.5],[.66,.66,.64]],s())));const L=.93+s()*.12;return h.tint=h.tint.map(y=>Y(Math.round(y*L),0,255)),h}class u0{constructor(e,t={}){if(this.region=e,this.style={...bt,...t.style||{}},this.groundAt=t.groundAt||null,this.streetAt=t.streetAt||null,this.offset=t.offset||{x:0,z:0},this.foundation=this.groundAt?1:0,[this.bnx,this.bnz]=t.baseGrid||[2,2],[this.dnx,this.dnz]=t.detailGrid||[4,4],this.lodDist=t.lodDist||700,this.maxWindows=t.maxWindows??7e4,this.detailFloors=t.detailFloors??6,this.nearDetail=t.nearDetail!==!1,this.base=[],this.cells=[],t.grid!==!1)for(let s=0;s<this.bnx*this.bnz+4;s++)this.base.push(new mt(4096));if(t.grid!==!1)for(let s=0;s<this.dnz;s++)for(let r=0;r<this.dnx;r++)this.cells.push({near:new mt(2048),far:new mt(1024),wins:new Gt,cx:e.minX+(r+.5)*(e.maxX-e.minX)/this.dnx,cz:e.minZ+(s+.5)*(e.maxZ-e.minZ)/this.dnz});this.colliders=[],this.count=0,this.skipped=0,this.detailed=0,this.windowCount=0,this.samples=[],this._v2=s=>new Yt(s[0],s[1])}inRegion(e,t){const s=this.region;return e>=s.minX&&e<=s.maxX&&t>=s.minZ&&t<=s.maxZ}baseIndex(e,t){const s=this.region;if(this.inRegion(e,t)){const l=Y(Math.floor((e-s.minX)/(s.maxX-s.minX)*this.bnx),0,this.bnx-1);return Y(Math.floor((t-s.minZ)/(s.maxZ-s.minZ)*this.bnz),0,this.bnz-1)*this.bnx+l}const r=(s.minX+s.maxX)/2,n=(s.minZ+s.maxZ)/2,c=e-r,f=t-n;return this.bnx*this.bnz+(Math.abs(c)>Math.abs(f)?c>0?0:1:f>0?2:3)}cellIndex(e,t){const s=this.region,r=Y(Math.floor((e-s.minX)/(s.maxX-s.minX)*this.dnx),0,this.dnx-1);return Y(Math.floor((t-s.minZ)/(s.maxZ-s.minZ)*this.dnz),0,this.dnz-1)*this.dnx+r}cellCentre(e){const t=this.region,s=e%this.dnx,r=Math.floor(e/this.dnx);return[t.minX+(s+.5)*(t.maxX-t.minX)/this.dnx,t.minZ+(r+.5)*(t.maxZ-t.minZ)/this.dnz]}baseFor(e,t){const s=this.region;if(this.inRegion(e,t)){const a=Y(Math.floor((e-s.minX)/(s.maxX-s.minX)*this.bnx),0,this.bnx-1),u=Y(Math.floor((t-s.minZ)/(s.maxZ-s.minZ)*this.bnz),0,this.bnz-1);return this.base[u*this.bnx+a]}const r=(s.minX+s.maxX)/2,n=(s.minZ+s.maxZ)/2,c=e-r,f=t-n,l=Math.abs(c)>Math.abs(f)?c>0?0:1:f>0?2:3;return this.base[this.bnx*this.bnz+l]}cellFor(e,t){const s=this.region,r=Y(Math.floor((e-s.minX)/(s.maxX-s.minX)*this.dnx),0,this.dnx-1),n=Y(Math.floor((t-s.minZ)/(s.maxZ-s.minZ)*this.dnz),0,this.dnz-1);return this.cells[n*this.dnx+r]}isStreet(e,t){return this.streetAt?!!this.streetAt(e,t):!0}footprint(e){if(e._lm)return null;const t=Ct(e.p);if(!t)return null;let s=Number(e.h);(!isFinite(s)||s<=0)&&(s=10),s=Y(s,2.5,600);let r=Number(e.mh)||0;r=Y(r,0,s-1);const n=it(t)>0?t:t.slice().reverse(),c=(e.hl||[]).map(u=>Ct(u)).filter(u=>u&&Math.abs(it(u))>2).map(u=>it(u)<0?u:u.slice().reverse()),f=Math.abs(it(n))-c.reduce((u,o)=>u+Math.abs(it(o)),0);if(f<3)return null;const l=It(n);let a=0;if(this.groundAt){a=1/0;for(let u=0;u<n.length;u++){const o=n[u],i=n[(u+1)%n.length],m=Math.max(1,Math.ceil(Math.hypot(i[0]-o[0],i[1]-o[1])/2.5));for(let g=0;g<m;g++)a=Math.min(a,this.groundAt(o[0]+(i[0]-o[0])*g/m,o[1]+(i[1]-o[1])*g/m))}Number.isFinite(a)||(a=0)}return{outer:n,holes:c,h:s,mh:r,area:f,c:l,base:a}}add(e,t,s=null){if(this.lastDetailed=!1,e._lm)return!1;const r=s||this.footprint(e);if(!r)return this.skipped++,!1;const{outer:n,holes:c,h:f,mh:l,area:a,c:u,base:o}=r,i=Xt(e,f,a,t,{xb:u[0]+this.offset.x,zb:u[1]+this.offset.z},this.style),m=t(),g=this.baseFor(u[0],u[1]),x=Math.max(1,Math.round(f/i.floorH)),p=f/x,h=Math.floor(m*4);let d=(e.r||"").toLowerCase(),v=0;const N=_t(n),b=g0(n);if(d&&d!=="flat"){if(/^(pyramidal|cone|dome|onion|round)$/.test(d)){const R=f-l>2.2*Math.sqrt(a);v=Number(e.rh)>0?Number(e.rh):R?(f-l)*.85:Y(.45*Math.sqrt(a),1.5,(f-l)*.6),(!v0(n,u)||c.length)&&(d="",v=0)}else/^(gabled|hipped|half-hipped|gambrel|mansard|saltbox|quadruple_saltbox|side_hipped)$/.test(d)&&N&&!c.length?v=Number(e.rh)>0?Number(e.rh):Y(.32*b,1.2,7):d==="skillion"&&!c.length?v=Number(e.rh)>0?Number(e.rh):Y(.15*b,.8,3):d="";v=Math.min(v,(f-l)*.9)}else d="";const P=f-v;let L=n,y=null;if(d&&/^(gabled|half-hipped|gambrel|saltbox|side_hipped)$/.test(d)||d&&/^(hipped|mansard|quadruple_saltbox)$/.test(d)&&n.length!==4){const R=ht(n),D=-R[1],j=R[0];let V=0;for(const tt of n)V=Math.max(V,Math.abs((tt[0]-u[0])*D+(tt[1]-u[1])*j));V<.5?d="":(L=x0(n,u,D,j),y=(tt,et)=>P+v*(1-Math.abs((tt-u[0])*D+(et-u[1])*j)/V),d="gabled")}else if(d==="skillion"){const R=ht(n),D=-R[1],j=R[0];let V=1/0,tt=-1/0;for(const et of n){const K=(et[0]-u[0])*D+(et[1]-u[1])*j;V=Math.min(V,K),tt=Math.max(tt,K)}tt-V<.5?d="":y=(et,K)=>P+v*(((et-u[0])*D+(K-u[1])*j-V)/(tt-V))}d||(v=0);const w=d?P:f,M=!d&&f-l>7&&a>60&&e.t!=="roof"&&i.cat!=="shed"?Y(.6+f*.004,.7,1.6)*(e.lod?.8:1):0,A=!e.lod&&this.inRegion(u[0],u[1])?this.cellFor(u[0],u[1]):null;let T=!1;const z={est:0};if(A&&!i.curtain&&i.win>=0&&!d){let R=0;const D=ct[i.win].length;for(let j=0;j<n.length;j++){const V=n[j],tt=n[(j+1)%n.length],et=Math.hypot(tt[0]-V[0],tt[1]-V[1]),K=et>=2.5?St(V,tt,!0):null;K&&this.isStreet(K.mx+K.ox*4.5,K.mz+K.oz*4.5)&&(R+=Math.max(1,Math.round(et/i.bayW))*D*Math.max(1,Math.min(this.detailFloors,Math.round(w/p))-Math.ceil(l/p)))}T=R<=2600&&this.windowCount+R<=this.maxWindows,T&&(this.windowCount+=R,z.est=R)}const F={B:g.n,near:A?A.near.n:0,far:A?A.far.n:0,wins:A?A.wins.n:0},E={b:e,st:i,h:f,mh:l,fh:p,floors:x,u0:h,seed:m,base:o,rnd:t,flatTop:w,wallTop:P,parapet:M,B:g,cell:A,detailed:T,outer:n,holes:c,area:a,c:u},B=[],$=l>0?l:-this.foundation,U=Y(.35+f*.008,.4,1.1),Q=!e.lod&&!i.curtain&&i.cornice&&!d?o+w-.25-U*.9:-1e4,W=o+ct[H.STOREFRONT][0][3]*p+.14,k=(R,D)=>{let j=0;for(let K=0;K<R.length;K++)j+=Math.hypot(R[(K+1)%R.length][0]-R[K][0],R[(K+1)%R.length][1]-R[K][1]);const V=(Kt[i.curtain?C.PLAIN:i.pbr]||{}).size||2,tt=j>V?Math.max(1,Math.round(j/V))*V/j:1;let et=0;for(let K=0;K<R.length;K++){const at=R[K],lt=R[(K+1)%R.length],G=St(at,lt,D);if(!G)continue;G.wall={u0:D?et:-et,sg:D?1:-1,k:tt,ax:G.ax,az:G.az,dx:G.dx,dz:G.dz,gy:this.groundAt,ao:Q},et+=G.L;const pt=y&&D?y(at[0],at[1]):w,vt=y&&D?y(lt[0],lt[1]):w,Mt=D&&!e.lod&&G.L>3&&this.isStreet(G.mx+G.ox*4.5,G.mz+G.oz*4.5),jt={f:G,street:Mt,ya:pt,yb:vt,isOuter:D};D&&B.push(jt);const gt=i.store&&Mt&&l<.5?H.STOREFRONT:-1;G.wallLo=gt>=0?{...G.wall,ao:W}:G.wall;const Tt=G.L>=.6*i.bayW?Math.max(1,Math.round(G.L/i.bayW)):G.L/i.bayW,rt=G.L/Tt,xt={gl:this.groundAt&&D&&l<.5&&!e.lod?Rt=>this.groundAt(G.ax+G.dx*Rt,G.az+G.dz*Rt)-o:null,split:gt>=0?p:null,pInfo:[-1,-1,m,O(i.pbr,_.WALLONLY)],pTint:i.tint};if(i.curtain){xt.pInfo=[-1,-1,m,O(C.GRANITE,_.PLAIN)],xt.pTint=S([.5,.49,.48]),this.wallPieces(g,G,$,pt+(D?M:0),vt+(D?M:0),h,rt,p,[i.glassVariant,-1,m,O(C.PLAIN,_.CURTAIN)],i.glassTint,xt);continue}const zt=[i.win,gt,m,O(i.pbr,i.win>=0?_.WALL:_.PLAIN)];T&&G.L>=2.5&&Mt?(this.shellWall(A.far,G,$,pt,vt,h,rt,p,zt,i.tint),this.nearDetail&&this.detailWall(E,G,$,w,Tt,rt,gt),D&&M>0&&this.shellWall(g,G,w,w+M,w+M,h,rt,p,[-1,-1,m,O(i.pbr,_.WALLONLY)],i.tint)):this.wallPieces(g,G,$,pt+(D?M:0),vt+(D?M:0),h,rt,p,zt,i.tint,xt)}};k(L,!0);for(const R of c)k(R,!1);const X=[-1,-1,m,O(i.trimPbr,_.PLAIN)],q=[-1,-1,m,O(i.roofPbr,_.PLAIN)];if(M>0?this.parapet(g,n,w,M,[-1,-1,m,O(i.pbr,_.WALLONLY)],i.tint,X,i.trimTint,!e.lod):!d&&!e.lod&&i.cat!=="shed"&&f>4&&this.ledge(g,n,w-.35,.35,.18,X,i.trimTint),!e.lod&&!i.curtain){if(i.cornice&&!d){const R=Y(.35+f*.008,.4,1.1);this.cornice(g,n,w-.25-R*.9,R,R*.9,X,i.trimTint)}if(i.courses>0&&x>=3){const R=i.courses>=2?Math.max(3,Math.round(x/4)):x>6?Math.round(x/2):99;for(let D=1;D<x-1;D++){if(D!==1&&D%R!==0)continue;const j=D*p-.08;j<l+1||this.ledge(g,n,j,.26,.09,X,i.trimTint)}}i.curtain&&!d&&f>40&&this.ledge(g,n,w-1.2,1.2,.04,[-1,-1,m,O(C.PLAIN,_.PLAIN)],S([.6,.62,.64]))}if(!d)this.flatPolygon(g,n,c,w,q,i.roofTint,!0);else if(d==="gabled"||d==="skillion"){const R=e.lod?0:.35,D=R?ot(L,R):L,j=d==="gabled"?w0(D,u,ht(n)):[D];for(const V of j)this.heightPolygon(g,V,y,[-1,-1,m,O(C.ROOF_SLATE,_.PLAIN)],S(Z(J.pitched,t())));R&&this.eaves(g,L,D,V=>y(V[0],V[1]),m,i)}else if(/^(hipped|mansard|quadruple_saltbox)$/.test(d)&&n.length===4)this.hipRoof(g,n,P,v,[-1,-1,m,O(C.ROOF_SLATE,_.PLAIN)],S(Z(J.pitched,t())),e.lod?0:.35,m,i);else{const R=d==="dome"||d==="round"||d==="onion"?[[1,0],[.92,.38],[.71,.71],[.38,.92],[0,1]]:[[1,0],[0,1]],D=d==="pyramidal"&&f>60;this.taperRoof(g,n,u,P,v,R,D?[-1,-1,m,O(i.pbr,_.PLAIN)]:[-1,-1,m,O(C.ROOF_SLATE,_.PLAIN)],D?i.tint:S(Z(J.pitched,t())))}if(l>2&&this.flatPolygon(g,n,c,l,q,i.roofTint,!1),!e.lod){!d&&f>6&&a>60&&e.t!=="roof"&&i.cat!=="shed"&&this.rooftop(E,g,n,c,w,a,f,t,m,i);for(const R of B){const D=this.groundAt?j=>this.groundAt(R.f.ax+R.f.dx*j,R.f.az+R.f.dz*j)-o:()=>0;R.street&&i.store&&l<.5&&x>=1&&R.f.L>=4&&this.storefront(this.style.storeDressing===!1?this._nullSink||(this._nullSink=new st):g,R.f,i,p,t,m,h,D),i.bays&&R.street&&R.f.L>=4.5&&R.f.L<=16&&x>=2&&t()<.85&&this.bayWindow(g,R.f,i,p,x,w,m,D)}if(this.nearDetail&&T&&i.fireEscape&&x>=3){const R=B.filter(D=>D.street&&D.f.L>=3*i.bayW);R.length&&this.fireEscape(A.near,Z(R,t()).f,i,p,x,w,t,o)}if(this.nearDetail&&T&&i.balconies&&x>=3)for(const R of B)R.street&&R.f.L>=6&&this.balconies(A.near,R.f,i,p,x,w,t,m)}return o&&(g.lift(F.B,o),A&&(A.near.lift(F.near,o),A.far.lift(F.far,o),A.wins.lift(F.wins,o))),T&&(this.detailed++,this.windowCount+=A.wins.n-F.wins-z.est),this.colliders.push([n,c,l,f,o]),!e.lod&&this.samples.length<6e3&&this.samples.push({x:+u[0].toFixed(1),z:+u[1].toFixed(1),y:+o.toFixed(1),h:f,cat:i.cat,pbr:i.pbr,win:i.win,detailed:T,fire:!!(T&&i.fireEscape),store:i.store,n:e.n||""}),this.count++,this.lastDetailed=T,!0}shellWall(e,t,s,r,n,c,f,l,a,u,o=t.wall){const i=t.L/f,m=(v,N)=>[t.ax+t.dx*v,N,t.az+t.dz*v],g=[t.ox,0,t.oz];e.wall=o||null;const x=e.v(...m(0,s),...g,c+t.uDir0*i,s/l,a,u),p=e.v(...m(t.L,s),...g,c+t.uDir1*i,s/l,a,u),h=e.v(...m(t.L,n),...g,c+t.uDir1*i,n/l,a,u),d=e.v(...m(0,r),...g,c+t.uDir0*i,r/l,a,u);e.wall=null,e.quad(x,p,h,d)}wallPieces(e,t,s,r,n,c,f,l,a,u,o){const i=t.L;let m=null;if(o.gl&&s<0){const h=Math.max(1,Math.ceil(i/5));let d=!1;m=[];for(let v=0;v<h;v++){const N=i*v/h,b=i*(v+1)/h,P=Math.max(o.gl(N),o.gl(b),o.gl((N+b)/2));m.push([N,b,P>.12?P+.4:0]),P>.12&&(d=!0)}d||(m=null)}if(!m&&o.split==null){this.shellWall(e,t,s,r,n,c,f,l,a,u);return}m||(m=[[0,i,0]]);const g=[t.ox,0,t.oz],x=h=>c+(t.uDir0*(i-h)+t.uDir1*h)/f,p=(h,d,v,N,b,P,L,y)=>{if(Math.min(N,b)-v<.02)return;e.wall=y||null;const w=(F,E)=>[t.ax+t.dx*F,E,t.az+t.dz*F],M=e.v(...w(h,v),...g,x(h),v/l,P,L),A=e.v(...w(d,v),...g,x(d),v/l,P,L),T=e.v(...w(d,b),...g,x(d),b/l,P,L),z=e.v(...w(h,N),...g,x(h),N/l,P,L);e.wall=null,e.quad(M,A,T,z)};for(const[h,d,v]of m){const N=r+(n-r)*h/i,b=r+(n-r)*d/i;let P=s;if(v>s+.05){const y=Math.min(v,N,b);p(h,d,s,y,y,o.pInfo,o.pTint,t.wallLo||t.wall),P=y}const L=o.split;L!=null&&L>P+.05&&L<Math.min(N,b)-.05?(p(h,d,P,L,L,a,u,t.wallLo||t.wall),p(h,d,L,N,b,a,u,t.wall)):p(h,d,P,N,b,a,u,L!=null&&P<L&&t.wallLo||t.wall)}}detailWall(e,t,s,r,n,c,f){const{st:l,fh:a,floors:u,mh:o,u0:i,seed:m,base:g,cell:x}=e,p=x.near,h=x.wins,d=t.L,v=l.win,N=ct[v],b=N[0][0]<=.001&&N[0][1]>=.999,P=N[0][2]<=.001&&N[0][3]>=.999,L=this.groundAt?W=>this.groundAt(t.ax+t.dx*W,t.az+t.dz*W)-g:()=>0,y=[],w=Math.max(0,Math.ceil((o-.01)/a)),M=Math.min(u,Math.floor((r+.01)/a),this.detailFloors)-1,A=Math.min(r,(M+1)*a),T=O(l.trimPbr,_.WALLONLY),z=W=>(l.sill?2:0)|(l.lintel?1:0),F=(W,k,X,q,R,D,j)=>{if(k-W<.3||q-X<.3||Math.max(L(W),L(k),L((W+k)/2))+.25>X)return;y.push([W,k,X,q]);const tt=i+(t.uDir0*(d-W)+t.uDir1*W)/c,et=i+(t.uDir0*(d-k)+t.uDir1*k)/c,K=t.uDir1?W:k,at=Math.min(tt,et),lt=t.uDir1?t.dx:-t.dx,G=t.uDir1?t.dz:-t.dz;h.add(t.ax+t.dx*K,X,t.az+t.dz*K,D,lt,G,k-W,q-X,at,X/a,(k-W)/c,(q-X)/a,R,j,m,T,l.trimTint)};for(let W=w;W<=M;W++){const k=W*a;if(W===0&&f>=0){const q=ct[H.STOREFRONT][0];for(let R=0;R<Math.round(n);R++)F(R*c+q[0]*c+.12,R*c+q[1]*c-.12,k+q[2]*a,k+q[3]*a,H.STOREFRONT,.32,0);continue}if(P){if(W!==Math.max(w,f>=0?1:0))continue;const q=k+.4,R=(M+1)*a-.15;for(let D=0;D<Math.round(n);D++)F(D*c+N[0][0]*c,D*c+N[0][1]*c,q,R,v,l.depth,2);continue}for(const q of N){if(b){F(.25,d-.25,k+q[2]*a,k+q[3]*a,v,l.depth,z()&2);continue}for(let R=0;R<Math.round(n);R++)F(R*c+q[0]*c,R*c+q[1]*c,k+q[2]*a,k+q[3]*a,v,l.depth,z())}}const E=[-1,-1,m,O(l.pbr,_.WALLONLY)],B=l.store&&f>=0&&l.basePbr>=0?[-1,-1,m,O(l.basePbr,_.WALLONLY)]:null,$=[t.ox,0,t.oz],U=(W,k)=>[t.ax+t.dx*W,k,t.az+t.dz*W];r>A+.05&&this.shellWall(p,t,A,r,r,i,c,a,[v,-1,m,O(l.pbr,_.WALL)],l.tint);const Q=t.wallLo||t.wall;p0(d,s,A,y,(W,k,X,q)=>{if(p.wall=X<a-.01?Q:t.wall,B&&X<a-.01){const R=Math.min(q,a);p.q([U(W,X),U(k,X),U(k,R),U(W,R)],$,B,l.baseTint),p.wall=t.wall,q>R+.01&&p.q([U(W,R),U(k,R),U(k,q),U(W,q)],$,E,l.tint)}else p.q([U(W,X),U(k,X),U(k,q),U(W,q)],$,E,l.tint);p.wall=null})}parapet(e,t,s,r,n,c,f,l,a){const u=Ot(t,.35);if(!u)return;const o=a?ot(t,.06):t,i=t.length,m=s+r;for(let g=0;g<i;g++){const x=(g+1)%i,p=u[g],h=u[x],d=o[g],v=o[x],N=h[0]-p[0],b=h[1]-p[1],P=Math.hypot(N,b);if(P<.05)continue;const L=-b/P,y=N/P;e.q([[p[0],s,p[1]],[h[0],s,h[1]],[h[0],m,h[1]],[p[0],m,p[1]]],[L,0,y],n,c);const w=m+(a?.08:0);if(e.q([[d[0],w,d[1]],[v[0],w,v[1]],[h[0],w,h[1]],[p[0],w,p[1]]],[0,1,0],f,l),a){const M=v[0]-d[0],A=v[1]-d[1],T=Math.hypot(M,A)||1,z=A/T,F=-M/T;e.q([[d[0],m-.06,d[1]],[v[0],m-.06,v[1]],[v[0],w,v[1]],[d[0],w,d[1]]],[z,0,F],f,l)}}}ledge(e,t,s,r,n,c,f){const l=ot(t,n),a=t.length;for(let u=0;u<a;u++){const o=(u+1)%a,i=t[u],m=t[o],g=l[u],x=l[o],p=x[0]-g[0],h=x[1]-g[1],d=Math.hypot(p,h);if(d<.05)continue;const v=h/d,N=-p/d;e.q([[g[0],s,g[1]],[x[0],s,x[1]],[x[0],s+r,x[1]],[g[0],s+r,g[1]]],[v,0,N],c,f),e.q([[i[0],s+r,i[1]],[m[0],s+r,m[1]],[x[0],s+r,x[1]],[g[0],s+r,g[1]]],[0,1,0],c,f),e.q([[i[0],s,i[1]],[m[0],s,m[1]],[x[0],s,x[1]],[g[0],s,g[1]]],[0,-1,0],c,f)}}cornice(e,t,s,r,n,c,f){const l=ot(t,r*.35),a=ot(t,r),u=t.length,o=s+n*.35,i=s+n;for(let m=0;m<u;m++){const g=(m+1)%u,x=t[m],p=t[g],h=a[g][0]-a[m][0],d=a[g][1]-a[m][1],v=Math.hypot(h,d);if(v<.05)continue;const N=d/v,b=-h/v,P=[N*.7,-.7,b*.7];e.q([[x[0],s,x[1]],[p[0],s,p[1]],[l[g][0],o,l[g][1]],[l[m][0],o,l[m][1]]],P,c,f),e.q([[l[m][0],o,l[m][1]],[l[g][0],o,l[g][1]],[a[g][0],o,a[g][1]],[a[m][0],o,a[m][1]]],[0,-1,0],c,f),e.q([[a[m][0],o,a[m][1]],[a[g][0],o,a[g][1]],[a[g][0],i,a[g][1]],[a[m][0],i,a[m][1]]],[N,0,b],c,f),e.q([[x[0],i,x[1]],[p[0],i,p[1]],[a[g][0],i,a[g][1]],[a[m][0],i,a[m][1]]],[0,1,0],c,f)}}storefront(e,t,s,r,n,c,f,l=()=>0){const a=Math.max(1,Math.round(t.L/s.bayW)),u=t.L/a,o=(h,d,v)=>[t.ax+t.dx*h+t.ox*v,d,t.az+t.dz*h+t.oz*v],i=[t.ox,0,t.oz],m=[t.dx,0,t.dz],g=ct[H.STOREFRONT][0][3]*r,x=[-1,-1,c,O(C.PLAIN,_.PLAIN)];let p=0;for(;p<a;){const h=Math.min(a-p,1+Math.floor(n()*3)),d=p*u+.15,v=(p+h)*u-.15;if(p+=h,v-d<1.5)continue;const N=v-d;if(!(Math.max(l(d),l(v),l((d+v)/2))>.35)){if(n()<.72){const b=g+.12,P=Math.min(r-.08,b+.55+n()*.3),L=.12+n()*.06,y=S(Z(J.sign,n()),.9+n()*.2),w=[n()<.85?1:0,N,n(),O(C.PLAIN,_.SIGN)];e.q([o(d,b,L),o(v,b,L),o(v,P,L),o(d,P,L)],i,w,y,(M,A)=>[A===1||A===2?N:0,A>=2?1:0]),e.q([o(d,P,0),o(v,P,0),o(v,P,L),o(d,P,L)],[0,1,0],x,y)}if(n()<.38){const b=g+.05,P=1.1+n()*.5,L=.55+n()*.25,y=S(Z(J.awning,n())),w=[0,n()<.35?1:0,c,O(C.FABRIC,_.SIGN)],M=o(d,b,.02),A=o(v,b,.02),T=o(v,b-L,P),z=o(d,b-L,P),F=Math.hypot(P,L),E=[t.ox*L/F,P/F,t.oz*L/F],B=(Q,W)=>[W===1||W===2?v:d,W>=2?1:0];e.q([M,A,T,z],E,w,y,B),e.q([M,A,T,z],E.map(Q=>-Q),w,y.map(Q=>Math.round(Q*.75)),B);const $=o(d,b-L-.25,P),U=o(v,b-L-.25,P);e.q([z,T,U,$],i,w,y,B),e.q([z,T,U,$],i.map(Q=>-Q),w,y,B),e.poly([o(d,b,.02),o(d,b-L,P),o(d,b-L,.02)],m.map(Q=>-Q),w,y),e.poly([o(v,b,.02),o(v,b-L,P),o(v,b-L,.02)],m,w,y)}if(s.prewar&&n()<.14){const b=n()<.5?d+.2:v-.2,P=r+.5,L=P+1.8+n()*1.5,y=.25,w=1.15,M=.09,A=S(Z(J.sign,n())),T=[1,w-y,n(),O(C.PLAIN,_.SIGN)];for(const z of[-1,1]){const F=b+z*M;e.q([o(F,P,y),o(F,P,w),o(F,L,w),o(F,L,y)],m.map(E=>E*z),T,A,(E,B)=>[B===1||B===2?w-y:0,B>=2?1:0])}e.q([o(b-M,P,w),o(b+M,P,w),o(b+M,L,w),o(b-M,L,w)],i,x,A)}}}}bayWindow(e,t,s,r,n,c,f,l=()=>0){const a=Math.min(3.8,t.L*.5),u=.75,o=t.L*.5+(t.L>9?(f-.5)*(t.L-a-2):0),i=o-a/2,m=o+a/2,g=i+u,x=m-u,p=Math.max(n>=3?r+.15:.7,Math.max(l(i),l(m),l(o))+2.6),h=c-.45;if(h-p<2)return;const d=(w,M,A)=>[t.ax+t.dx*w+t.ox*M,A,t.az+t.dz*w+t.oz*M],v=[[i,0],[g,u],[x,u],[m,0]],N=[H.VICTORIAN,-1,f,O(s.pbr,_.WALL)];let b=0;for(let w=0;w<3;w++){const[M,A]=v[w],[T,z]=v[w+1],F=d(M,A,p),E=d(T,z,p),B=E[0]-F[0],$=E[2]-F[2],U=Math.hypot(B,$),Q=[$/U,0,-B/U],W=X=>X/r,k=Math.max(.6,U/2);e.q([F,E,d(T,z,h),d(M,A,h)],Q,N,s.tint,(X,q)=>[b+(q===1||q===2?k:0),W(X[1])]),b+=k}const P=v.map(([w,M])=>d(w,M,0)),L=[-1,-1,f,O(s.trimPbr,_.PLAIN)];e.poly(P.map(w=>[w[0],p,w[2]]),[0,-1,0],L,s.trimTint);const y=v.map(([w,M])=>d(w+(w<o?-.15:.15)*(M===0?1:.4),M+.15,0));e.poly(y.map(w=>[w[0],h+.35,w[2]]),[0,1,0],L,s.trimTint);for(let w=0;w<3;w++){const M=y[w],A=y[w+1],T=A[0]-M[0],z=A[2]-M[2],F=Math.hypot(T,z)||1;e.q([[M[0],h,M[2]],[A[0],h,A[2]],[A[0],h+.35,A[2]],[M[0],h+.35,M[2]]],[z/F,0,-T/F],L,s.trimTint);const E=P[w],B=P[w+1];e.q([[E[0],h,E[2]],[B[0],h,B[2]],[A[0],h,A[2]],[M[0],h,M[2]]],[0,-1,0],L,s.trimTint)}}fireEscape(e,t,s,r,n,c,f,l){const a=Math.max(1,Math.round(t.L/s.bayW)),u=t.L/a,o=Math.floor(f()*Math.max(1,a-1)),i=o*u+.15,m=Math.min(t.L-.15,(o+2)*u-.15),g=m-i,x=1.1;if(g<2.4)return;const p=(T,z,F)=>[t.ax+t.dx*T+t.ox*z,F,t.az+t.dz*T+t.oz*z],h=[t.ox,0,t.oz],d=[t.dx,0,t.dz],v=S([.1,.1,.11]),N=[-1,-1,.5,O(C.PLAIN,_.PLAIN)],b=[0,0,.5,O(C.PLAIN,_.GRATE)],P=(T,z,F,E)=>{e.q(T,z,F,v,E),e.q(T,z.map(B=>-B),F,v,E)},L=Math.min(n-1,Math.floor((c-1)/r));for(let T=1;T<=L;T++){const z=T*r+.02;if(e.q([p(i,.02,z),p(m,.02,z),p(m,x,z),p(i,x,z)],[0,1,0],N,v),e.q([p(i,.02,z-.06),p(m,.02,z-.06),p(m,x,z-.06),p(i,x,z-.06)],[0,-1,0],N,v),e.q([p(i,x,z-.06),p(m,x,z-.06),p(m,x,z),p(i,x,z)],h,N,v),P([p(i,x,z),p(m,x,z),p(m,x,z+.95),p(i,x,z+.95)],h,b,(F,E)=>[E===1||E===2?g:0,E>=2?1:0]),P([p(i,.02,z),p(i,x,z),p(i,x,z+.95),p(i,.02,z+.95)],d,b,(F,E)=>[E===1||E===2?x:0,E>=2?1:0]),P([p(m,.02,z),p(m,x,z),p(m,x,z+.95),p(m,.02,z+.95)],d,b,(F,E)=>[E===1||E===2?x:0,E>=2?1:0]),T<L){const E=x-.62-.05,B=x-.05,$=T%2===0,U=$?i+.3:m-.3,Q=$?m-.6:i+.6,W=z+r,k=Math.hypot(Q-U,r),X=[1,0,.5,O(C.PLAIN,_.GRATE)],q=[0,1,0];P([p(U,E,z),p(U,B,z),p(Q,B,W),p(Q,E,W)],q,X,(R,D)=>[D===1||D===2?1:0,D>=2?k:0])}}const y=r+.02,w=i+.5,M=[2,0,.5,O(C.PLAIN,_.GRATE)],A=Math.max(y-3.2,(this.groundAt?this.groundAt(t.ax+t.dx*w,t.az+t.dz*w)-l:0)+2.4);y-A>.6&&P([p(w,x-.08,A),p(w+.45,x-.08,A),p(w+.45,x-.08,y),p(w,x-.08,y)],h,M,(T,z)=>[z===1||z===2?1:0,T[1]-A])}balconies(e,t,s,r,n,c,f,l){const a=Math.max(1,Math.round(t.L/s.bayW)),u=t.L/a,o=Math.floor(l*3),i=S([.86,.86,.84]),m=S([.2,.21,.22]),g=[-1,-1,l,O(C.CONCRETE_PANEL,_.PLAIN)],x=[0,0,l,O(C.PLAIN,_.GRATE)],p=(N,b,P)=>[t.ax+t.dx*N+t.ox*b,P,t.az+t.dz*N+t.oz*b],h=[t.ox,0,t.oz],d=[t.dx,0,t.dz],v=1.25;for(let N=1;N<n;N++){const b=N*r;if(b>c-1)break;for(let P=0;P<a;P++){if(o===1&&(P+N)%2||o===2&&P%3===2)continue;const L=P*u+.2,y=(P+1)*u-.2;e.q([p(L,0,b),p(y,0,b),p(y,v,b),p(L,v,b)],[0,1,0],g,i),e.q([p(L,0,b-.18),p(y,0,b-.18),p(y,v,b-.18),p(L,v,b-.18)],[0,-1,0],g,i),e.q([p(L,v,b-.18),p(y,v,b-.18),p(y,v,b),p(L,v,b)],h,g,i),e.q([p(L,0,b-.18),p(L,v,b-.18),p(L,v,b),p(L,0,b)],d.map(M=>-M),g,i),e.q([p(y,0,b-.18),p(y,v,b-.18),p(y,v,b),p(y,0,b)],d,g,i);const w=y-L;for(const M of[1,-1])e.q([p(L,v,b),p(y,v,b),p(y,v,b+1.05),p(L,v,b+1.05)],h.map(A=>A*M),x,m,(A,T)=>[T===1||T===2?w:0,T>=2?1:0]),e.q([p(L,0,b),p(L,v,b),p(L,v,b+1.05),p(L,0,b+1.05)],d.map(A=>A*M),x,m,(A,T)=>[T===1||T===2?v:0,T>=2?1:0]),e.q([p(y,0,b),p(y,v,b),p(y,v,b+1.05),p(y,0,b+1.05)],d.map(A=>A*M),x,m,(A,T)=>[T===1||T===2?v:0,T>=2?1:0])}}}flatPolygon(e,t,s,r,n,c,f){let l;try{l=Et.triangulateShape(t.map(this._v2),s.map(o=>o.map(this._v2)))}catch{return}if(!l||!l.length)return;const u=t.concat(...s).map(o=>e.v(o[0],r,o[1],0,f?1:-1,0,o[0]/3,o[1]/3,n,c));for(const o of l)u[o[0]]!==void 0&&u[o[1]]!==void 0&&u[o[2]]!==void 0&&e.tri(u[o[0]],u[o[1]],u[o[2]])}heightPolygon(e,t,s,r,n){if(!t||t.length<3)return;let c;try{c=Et.triangulateShape(t.map(this._v2),[])}catch{return}if(!c||!c.length)return;const f=t.map(m=>[m[0],s(m[0],m[1]),m[1]]);let l=0,a=0,u=0;for(let m=0;m<f.length;m++){const g=f[m],x=f[(m+1)%f.length];l+=(g[1]-x[1])*(g[2]+x[2]),a+=(g[2]-x[2])*(g[0]+x[0]),u+=(g[0]-x[0])*(g[1]+x[1])}const o=Math.hypot(l,a,u)||1;l/=o,a/=o,u/=o,a<0&&(l=-l,a=-a,u=-u);const i=f.map(m=>e.v(m[0],m[1],m[2],l,a,u,m[0]/3,m[2]/3,r,n));for(const m of c)i[m[0]]!==void 0&&i[m[1]]!==void 0&&i[m[2]]!==void 0&&e.tri(i[m[0]],i[m[1]],i[m[2]])}hipRoof(e,t,s,r,n,c,f=0,l=.5,a=null){const u=E=>Math.hypot(t[(E+1)%4][0]-t[E][0],t[(E+1)%4][1]-t[E][1]),o=u(0)+u(2)>u(1)+u(3)?0:1,i=E=>[(t[E][0]+t[(E+1)%4][0])/2,(t[E][1]+t[(E+1)%4][1])/2],m=i((o+1)%4),g=i((o+3)%4),x=(u((o+1)%4)+u((o+3)%4))/4,p=g[0]-m[0],h=g[1]-m[1],d=Math.hypot(p,h);if(d<2*x+.2){this.taperRoof(e,t,It(t),s,r,[[1,0],[0,1]],n,c);return}const v=p/d,N=h/d,b=[m[0]+v*x,s+r,m[1]+N*x],P=[g[0]-v*x,s+r,g[1]-N*x],L=r/Math.max(.5,x),y=f?ot(t,f):t,w=s-f*L,M=y.map(E=>[E[0],w,E[1]]);f&&this.eaves(e,t,y,()=>w,l,a);const A=(o+1)%4,T=(o+2)%4,z=(o+3)%4,F=o;this.face(e,[M[F],M[A],b,P],n,c),this.face(e,[M[A],M[T],b],n,c),this.face(e,[M[T],M[z],P,b],n,c),this.face(e,[M[z],M[F],P],n,c)}taperRoof(e,t,s,r,n,c,f,l){const a=c.map(([u,o])=>t.map(i=>[s[0]+(i[0]-s[0])*u,r+n*o,s[1]+(i[1]-s[1])*u]));for(let u=0;u+1<a.length;u++){const o=a[u],i=a[u+1];for(let m=0;m<t.length;m++){const g=(m+1)%t.length;c[u+1][0]===0?this.face(e,[o[m],o[g],i[m]],f,l):this.face(e,[o[m],o[g],i[g],i[m]],f,l)}}}face(e,t,s,r){const n=t[0],c=t[1],f=t[2];let l=(c[1]-n[1])*(f[2]-n[2])-(c[2]-n[2])*(f[1]-n[1]),a=(c[2]-n[2])*(f[0]-n[0])-(c[0]-n[0])*(f[2]-n[2]),u=(c[0]-n[0])*(f[1]-n[1])-(c[1]-n[1])*(f[0]-n[0]);const o=Math.hypot(l,a,u);o>1e-8&&(l/=o,a/=o,u/=o,a<0&&(l=-l,a=-a,u=-u),e.poly(t,[l,a,u],s,r,i=>[i[0]/3,i[2]/3]))}eaves(e,t,s,r,n,c){const f=t.length,l=.18,a=[-1,-1,n,O(C.PLAIN,_.PLAIN)],u=c&&c.cat==="victorian"?S([.95,.94,.9]):S([.62,.6,.57]),o=u.map(i=>Math.round(i*.72));for(let i=0;i<f;i++){const m=(i+1)%f,g=s[i],x=s[m],p=x[0]-g[0],h=x[1]-g[1],d=Math.hypot(p,h);if(d<.05)continue;const v=r(g),N=r(x),b=r(t[i]),P=r(t[m]);e.q([[g[0],v-l,g[1]],[x[0],N-l,x[1]],[x[0],N,x[1]],[g[0],v,g[1]]],[h/d,0,-p/d],a,u),e.q([[g[0],v-l,g[1]],[x[0],N-l,x[1]],[t[m][0],Math.min(P,N)-l,t[m][1]],[t[i][0],Math.min(b,v)-l,t[i][1]]],[0,-1,0],a,o)}}box(e,t,s,r,n,c,f,l,a,u,o=null,i=null){const m=Math.cos(l),g=Math.sin(l),x=[[-n/2,-c/2],[n/2,-c/2],[n/2,c/2],[-n/2,c/2]].map(([h,d])=>[t+h*m-d*g,s+h*g+d*m]),p=r+f;for(let h=0;h<4;h++){const d=x[h],v=x[(h+1)%4],N=(d[0]+v[0])/2-t,b=(d[1]+v[1])/2-s,P=Math.hypot(N,b)||1,L=Math.hypot(v[0]-d[0],v[1]-d[1]);e.q([[d[0],r,d[1]],[v[0],r,v[1]],[v[0],p,v[1]],[d[0],p,d[1]]],[N/P,0,b/P],a,u,(y,w)=>[w===1||w===2?L/3:0,y[1]/3])}return e.q(x.map(h=>[h[0],p,h[1]]),[0,1,0],o||a,i||u),x}cylinder(e,t,s,r,n,c,f,l,a,u="flat",o=0,i=null,m=null){const g=r+c,x=[];for(let p=0;p<f;p++){const h=p/f*Math.PI*2;x.push([Math.cos(h),Math.sin(h)])}for(let p=0;p<f;p++){const h=x[p],d=x[(p+1)%f],v=[(h[0]+d[0])/2,(h[1]+d[1])/2],N=Math.hypot(v[0],v[1]);e.q([[t+h[0]*n,r,s+h[1]*n],[t+d[0]*n,r,s+d[1]*n],[t+d[0]*n,g,s+d[1]*n],[t+h[0]*n,g,s+h[1]*n]],[v[0]/N,0,v[1]/N],l,a,(b,P)=>[(p+(P===1||P===2?1:0))/f*2*Math.PI*n/3,b[1]/3])}if(u==="flat")e.poly(x.map(p=>[t+p[0]*n,g,s+p[1]*n]),[0,1,0],i||l,m||a);else if(u==="cone"){const p=[t,g+o,s];for(let h=0;h<f;h++){const d=x[h],v=x[(h+1)%f];this.face(e,[[t+d[0]*n*1.06,g,s+d[1]*n*1.06],[t+v[0]*n*1.06,g,s+v[1]*n*1.06],p],i||l,m||a)}}}rooftop(e,t,s,r,n,c,f,l,a,u){const o=Math.atan2(...(()=>{const y=ht(s);return[y[1],y[0]]})()),i=Vt(s),m=Math.cos(o),g=Math.sin(o),x=(y,w,M,A)=>{for(const[T,z]of[[-M,-A],[M,-A],[M,A],[-M,A],[0,0]])if(!$t(y+T*m-z*g,w+T*g+z*m,s,r))return!1;return!0},p=(y,w,M=10)=>{for(let A=0;A<M;A++){const T=i.minX+l()*(i.maxX-i.minX),z=i.minZ+l()*(i.maxZ-i.minZ);if(x(T,z,y+.8,w+.8))return[T,z]}return null},h=S([.78,.79,.8]),d=[-1,-1,a,O(C.METAL,_.PLAIN)],v=[-1,-1,a,O(C.PLAIN,_.PLAIN)],N=[-1,-1,a,O(u.curtain?C.CONCRETE_PANEL:u.pbr,_.PLAIN)],b=u.curtain?S([.72,.73,.74]):u.tint;let P=!1;if(f>40&&c>400){const y=It(s);for(let w=0;w<6;w++){const M=Math.sqrt(c)*(.42-w*.05);if(M<4)break;if(x(y[0],y[1],M/2+1,M*.35+1)){const A=3.5+l()*4.5;u.curtain?this.box(t,y[0],y[1],n,M,M*.7,A,o,[u.glassVariant,-1,a,O(C.PLAIN,_.CURTAIN)],u.glassTint,v,S([.5,.5,.5])):this.box(t,y[0],y[1],n,M,M*.7,A,o,N,b,[-1,-1,a,O(C.ROOF_TAR,_.PLAIN)],u.roofTint),P=!0,l()<.6&&this.box(t,y[0],y[1],n+A,M*.6,M*.4,2.2,o,d,h,v,S([.4,.4,.42]));break}}}if(!P&&e.floors>=5&&c>150){const y=p(2.2,3);y&&this.box(t,y[0],y[1],n,4.4,6,3.6,o,N,b,[-1,-1,a,O(C.ROOF_TAR,_.PLAIN)],u.roofTint)}const L=Math.min(8,Math.floor(c/500)+(c>200?1:0));for(let y=0;y<L;y++){const w=1.6+l()*3.4,M=1.2+l()*2.4,A=1+l()*1.6,T=p(w/2,M/2,8);T&&this.box(t,T[0],T[1],n,w,M,A,o,d,h,v,S([.34,.35,.36]))}if(u.prewar&&e.floors>=4&&e.floors<=16&&c>180&&l()<.12){const y=1.7+l()*.9,w=p(y+.5,y+.5);if(w){const M=S([.16,.16,.17]);for(const[A,T]of[[-1,-1],[1,-1],[1,1],[-1,1]])this.box(t,w[0]+A*y*.6,w[1]+T*y*.6,n,.22,.22,2,0,v,M);this.box(t,w[0],w[1],n+1.9,y*1.9,y*1.9,.12,0,v,M),this.cylinder(t,w[0],w[1],n+2.02,y,3.2+l()*1.6,12,[-1,-1,a,O(C.WOOD_SIDING,_.PLAIN)],S([.62,.48,.36]),"cone",.9,[-1,-1,a,O(C.ROOF_TAR,_.PLAIN)],S([.3,.3,.3]))}}if(f>85&&l()<.4){const y=1+Math.floor(l()*3);for(let w=0;w<y;w++){const M=p(.4,.4);if(!M)continue;const A=8+l()*18;this.box(t,M[0],M[1],n,.35,.35,A,o,d,h),this.box(t,M[0],M[1],n+A,.5,.5,.4,0,[2,-1,l(),O(C.PLAIN,_.LED)],S([1,.1,.05]))}}if(f<16&&c>260&&(u.cat==="industrial"||u.cat==="masonry"||u.cat==="office")&&l()<.5){const y=1+Math.floor(l()*Math.min(4,c/300));for(let w=0;w<y;w++){const M=3+l()*5,A=1.4,T=p(M/2,A/2);if(!T)continue;const z=(U,Q,W)=>[T[0]+U*m-Q*g,W,T[1]+U*g+Q*m],F=[1,-1,a,O(C.PLAIN,_.CURTAIN)],E=S([.7,.78,.82]);this.box(t,T[0],T[1],n,M,A,.35,o,v,S([.7,.7,.7]));const B=n+.35,$=B+.6;this.face(t,[z(-M/2,-A/2,B),z(M/2,-A/2,B),z(M/2,0,$),z(-M/2,0,$)],F,E),this.face(t,[z(-M/2,A/2,B),z(M/2,A/2,B),z(M/2,0,$),z(-M/2,0,$)],F,E)}}if((u.cat==="res"||u.curtain||u.cat==="office")&&f<70&&c>300&&l()<.22){const y=Ot(s,2.2);if(y&&Math.abs(it(y))>60&&_t(y)){const w=n+.45;this.flatPolygon(t,y,[],w,[-1,-1,a,O(C.GRASS,_.PLAIN)],S([.95,1,.92]),!0);for(let M=0;M<y.length;M++){const A=y[M],T=y[(M+1)%y.length],z=T[0]-A[0],F=T[1]-A[1],E=Math.hypot(z,F);E<.1||t.q([[A[0],n,A[1]],[T[0],n,T[1]],[T[0],w+.1,T[1]],[A[0],w+.1,A[1]]],[F/E,0,-z/E],[-1,-1,a,O(C.CONCRETE_PANEL,_.PLAIN)],S([.8,.8,.78]))}}}}build(e){const t=[];this.stats={baseTris:0,nearTris:0,farTris:0,windows:0,windowTris:0,cells:0,chunks:0,detailed:this.detailed};for(const r of this.base){const n=r.build(e,"buildings");n&&(t.push(n),this.stats.baseTris+=r.tris,this.stats.chunks++)}const s=Ht();for(const r of this.cells){if(!r.near.n&&!r.wins.n&&!r.far.n)continue;const n=new Qt;n.name="buildings-detail",n.position.set(r.cx,40,r.cz);const c=new Wt;c.name="buildings-near";const f=r.near.build(e,"buildings-near-walls");f&&c.add(f);const l=r.wins.build(e,s);l&&c.add(l);for(const u of c.children)u.position.set(-r.cx,-40,-r.cz),u.updateMatrix();const a=r.far.build(e,"buildings-far")||new Jt;a.position.set(-r.cx,-40,-r.cz),a.updateMatrix(),n.addLevel(c,0),n.addLevel(a,this.lodDist,.05),n.updateMatrix(),t.push(n),this.stats.nearTris+=r.near.tris,this.stats.farTris+=r.far.tris,this.stats.windows+=r.wins.n,this.stats.windowTris+=r.wins.n*Ut,this.stats.cells++}return this.stats.totalTris=this.stats.baseTris+this.stats.nearTris+this.stats.farTris+this.stats.windowTris,t}}const dt=[],m0=4,d0=1<<17;function Nt(I){const e=dt.pop();return e?(e.n=0,e.ni=0,e.wall=null,e):new mt(I)}function Lt(I){I instanceof mt&&dt.length<m0&&I.vcap<=d0&&dt.push(I)}function z0(){const I=dt.length;return dt.length=0,I}class st{constructor(){this.n=0,this.ni=0,this.wall=null}v(){return this.n++}tri(){this.ni+=3}quad(){this.ni+=6}q(){this.n+=4,this.ni+=6}poly(e){this.n+=e.length,this.ni+=3*Math.max(0,e.length-2)}lift(){}add(){this.n++}get tris(){return 0}geometry(){return null}build(){return null}}class R0 extends u0{constructor(e,t={},s="full"){super(e,{...t,grid:!1,nearDetail:s!=="low"}),this.mode=s,this.tileBase=s==="near"?new st:Nt(4096),this.tileCells=new Map,this.detailedIds=[]}baseFor(){return this.tileBase}cellFor(e,t){const s=this.cellIndex(e,t);let r=this.tileCells.get(s);if(!r){const[n,c]=this.cellCentre(s),f=this.mode;r={key:s,cx:n,cz:c,near:f==="low"?new st:Nt(2048),far:f==="near"?new st:Nt(1024),wins:f==="low"?new st:new Gt},this.tileCells.set(s,r)}return r}*meshes(e){const t={base:null,cells:[],bytes:0,tris:0},s=n=>{if(n&&n.geometry)for(const c in n.geometry.attributes)t.bytes+=n.geometry.attributes[c].array.byteLength;n&&n.geometry&&n.geometry.index&&(t.bytes+=n.geometry.index.array.byteLength)};this.tileBase.n&&!(this.tileBase instanceof st)&&(t.base=this.tileBase.build(e,"buildings"),s(t.base),t.tris+=this.tileBase.tris,yield),Lt(this.tileBase),this.tileBase=null;const r=Ht();for(const n of this.tileCells.values()){const c={key:n.key,cx:n.cx,cz:n.cz,far:null,near:null};if(n.far.n&&!(n.far instanceof st)&&(c.far=n.far.build(e,"buildings-far"),c.far.position.set(-n.cx,-40,-n.cz),c.far.updateMatrix(),s(c.far),t.tris+=n.far.tris,yield),(n.near.n||n.wins.n)&&!(n.near instanceof st)){const f=new Wt;f.name="buildings-near";const l=n.near.build(e,"buildings-near-walls");l&&(f.add(l),s(l),t.tris+=n.near.tris),yield;const a=n.wins.build(e,r);a&&(f.add(a),s(a),t.tris+=n.wins.n*Ut,t.windows=(t.windows||0)+n.wins.n);for(const u of f.children)u.position.set(-n.cx,-40,-n.cz),u.updateMatrix();c.near=f,yield}(c.far||c.near)&&t.cells.push(c),Lt(n.far),Lt(n.near)}return this.tileCells.clear(),t}}function St(I,e,t){const s=e[0]-I[0],r=e[1]-I[1],n=Math.hypot(s,r);if(n<.05)return null;let c=r/n,f=-s/n;t||(c=-c,f=-f);const l=t?1:0,a=t?0:1;return{ax:I[0],az:I[1],dx:s/n,dz:r/n,ox:c,oz:f,L:n,mx:(I[0]+e[0])/2,mz:(I[1]+e[1])/2,uDir0:a,uDir1:l}}function p0(I,e,t,s,r){const n=[e,t];for(const o of s)o[2]>e&&o[2]<t&&n.push(o[2]),o[3]>e&&o[3]<t&&n.push(o[3]);n.sort((o,i)=>o-i);const c=n.filter((o,i)=>i===0||o-n[i-1]>.004);let f=null,l=0,a=null;const u=o=>{if(a)for(const[i,m]of a)r(i,m,l,o)};for(let o=0;o+1<c.length;o++){const i=c[o],m=c[o+1],g=(i+m)/2,x=s.filter(v=>v[2]<=g&&v[3]>=g).map(v=>[v[0],v[1]]).sort((v,N)=>v[0]-N[0]),p=[];let h=0;for(const[v,N]of x)v>h+.004&&p.push([h,v]),h=Math.max(h,N);I>h+.004&&p.push([h,I]);const d=p.map(v=>`${v[0].toFixed(3)}:${v[1].toFixed(3)}`).join("|");d!==f&&(u(i),f=d,l=i,a=p)}u(c[c.length-1])}function _t(I){let e=0;for(let t=0;t<I.length;t++){const s=I[t],r=I[(t+1)%I.length],n=I[(t+2)%I.length],c=(r[0]-s[0])*(n[1]-r[1])-(r[1]-s[1])*(n[0]-r[0]);if(Math.abs(c)<1e-6)continue;const f=Math.sign(c);if(e&&f!==e)return!1;e=f}return!0}function v0(I,e){for(let t=0;t<I.length;t++){const s=I[t],r=I[(t+1)%I.length];if((s[0]-e[0])*(r[1]-e[1])-(s[1]-e[1])*(r[0]-e[0])<=0)return!1}return!0}function ht(I){let e=0,t=[1,0];for(let s=0;s<I.length;s++){const r=I[s],n=I[(s+1)%I.length],c=n[0]-r[0],f=n[1]-r[1],l=Math.hypot(c,f);l>e&&(e=l,t=[c/l,f/l])}return t}function g0(I){const e=ht(I);let t=1/0,s=-1/0;for(const r of I){const n=-r[0]*e[1]+r[1]*e[0];t=Math.min(t,n),s=Math.max(s,n)}return s-t}function Ot(I,e){const t=I.length,s=[];for(let r=0;r<t;r++){const n=I[(r+t-1)%t],c=I[r],f=I[(r+1)%t],l=c[0]-n[0],a=c[1]-n[1],u=Math.hypot(l,a),o=f[0]-c[0],i=f[1]-c[1],m=Math.hypot(o,i);if(u<1e-6||m<1e-6)return null;const g=-a/u,x=l/u,p=-i/m,h=o/m;let d=g+p,v=x+h;const N=Math.hypot(d,v);N<.001?(d=g,v=x):(d/=N,v/=N);const b=Math.max(.35,d*g+v*x),P=Math.min(e/b,e*2.5,u*.45,m*.45);s.push([c[0]+d*P,c[1]+v*P])}return s}function ot(I,e){const t=I.length,s=[];for(let r=0;r<t;r++){const n=I[(r+t-1)%t],c=I[r],f=I[(r+1)%t],l=c[0]-n[0],a=c[1]-n[1],u=Math.hypot(l,a)||1e-6,o=f[0]-c[0],i=f[1]-c[1],m=Math.hypot(o,i)||1e-6,g=a/u,x=-l/u,p=i/m,h=-o/m;let d=g+p,v=x+h;const N=Math.hypot(d,v);N<.001?(d=g,v=x):(d/=N,v/=N);const b=Math.max(.4,d*g+v*x),P=Math.min(e/b,e*2.5);s.push([c[0]+d*P,c[1]+v*P])}return s}function x0(I,e,t,s){const r=[];for(let n=0;n<I.length;n++){const c=I[n],f=I[(n+1)%I.length];r.push(c);const l=(c[0]-e[0])*t+(c[1]-e[1])*s,a=(f[0]-e[0])*t+(f[1]-e[1])*s;if(l>1e-6&&a<-1e-6||l<-1e-6&&a>1e-6){const u=l/(l-a);r.push([c[0]+(f[0]-c[0])*u,c[1]+(f[1]-c[1])*u])}}return r}function w0(I,e,t){const s=-t[1],r=t[0],n=l=>(l[0]-e[0])*s+(l[1]-e[1])*r,c=I.filter(l=>n(l)>=-1e-6),f=I.filter(l=>n(l)<=1e-6);return[c,f].filter(l=>l.length>=3&&Math.abs(it(l))>.1)}export{u0 as B,bt as D,mt as G,_ as M,st as N,R0 as T,Ut as U,L0 as a,T0 as b,N0 as c,O as e,Ot as i,ht as l,ot as o,z0 as r,yt as t};
