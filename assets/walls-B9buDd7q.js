import{W as p}from"./FacadeTextures-CFrENjYO.js";import{a as l,V as b}from"./three.core-BG5Iv3B7.js";import"./TextureSets-B1CadDTh.js";import"./three.module-Dt1S_jJM.js";import"./noise-g5kHFeMn.js";const x=`
uniform vec4 uWbWin[24];   // window rects per facade layer (WIN_RECTS: x0, x1, y0, y1; two per layer)
uniform vec4 uWbGrime;     // x streaks, y soot, z repointing, w relief
uniform vec3 uWbSky;       // world direction the ambient comes from (up, leaning to the afterglow)
uniform float uWbContrast; // extra albedo contrast around the scan's mean (0 = as scanned)
uniform vec4 uWbDetail;   // x drip runs, y rising damp
float wbH(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float wbN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wbH(i), wbH(i + vec2(1.0, 0.0)), f.x), mix(wbH(i + vec2(0.0, 1.0)), wbH(i + vec2(1.0, 1.0)), f.x), f.y); }
`,W=`
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
#ifdef WB_DETAIL
  // two scales of tone (patches of a few metres inside the slow drift), and fine drip runs from every floor line
  float mid = wbN(wq * vec2(0.42, 0.3) + vInfo.z * 5.0);
  fCol *= (0.8 + 0.4 * slow) * (0.86 + 0.28 * mid);
  float dcol = wq.x * 8.0, dc = floor(dcol), band = floor(hsW / 3.6), d = 3.6 - (hsW - band * 3.6);
  float len = 0.35 + 3.0 * pow(wbH(vec2(dc, band + vInfo.z * 17.0)), 2.0);
  float drip = step(0.5, wbH(vec2(dc * 1.7, band * 3.1 + vInfo.z))) * (1.0 - smoothstep(len * 0.4, len, d));
  float cx = fract(dcol);
  drip *= smoothstep(0.0, 0.4, cx) * smoothstep(1.0, 0.6, cx) * (0.6 + 0.4 * wbN(vec2(dcol * 3.0, hsW * 4.0)));
  float dfar = smoothstep(0.25, 0.7, fwidth(dcol));
  drip = mix(drip, 0.09, dfar) * uWbDetail.x;
  fCol *= 1.0 - 0.5 * drip;
  fRough = mix(fRough, fRough * 0.55, drip);         // the runs are damp: they catch the lamps
#else
  fCol *= 0.86 + 0.28 * slow;
#endif
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
#ifdef WB_DETAIL
  st *= 1.0 + 0.6 * uWbDetail.x;
  fCol *= 1.0 - st; fRough = mix(fRough, fRough * 0.6, st);
  // rising damp at the foot of the wall: darker, smoother, a ragged tide line
  float damp = 1.0 - smoothstep(0.15, 0.55 + 0.6 * wbN(vec2(wq.x * 1.3, 9.0)), hsW);
  fCol *= 1.0 - 0.4 * damp * uWbDetail.y; fRough = mix(fRough, 0.42, damp * uWbDetail.y);
#else
  fCol *= 1.0 - st; fRough = mix(fRough, min(1.0, fRough + 0.15), st);
#endif
  // soot rising from the street (traffic, steam): ragged top, heavier near the corners of the block
  float soot = 1.0 - smoothstep(0.0, 2.6 + 2.4 * wbN(vec2(wq.x * 0.6, 3.0)), hsW);
  fCol *= 1.0 - 0.3 * soot * uWbGrime.y;
}
`,g=`
if (fGlass < 0.5 && uWbGrime.w > 0.0) {
  vec3 wn = inverseTransformDirection(normal, viewMatrix), wg = inverseTransformDirection(fNg, viewMatrix);
  float rel = dot(wn - wg, uWbSky);                       // the mapped normal's tilt toward the sky
  float k = clamp(1.0 + rel * uWbGrime.w, 0.35, 1.8);
  float cav = mix(1.0, fAO * fAO, 0.6);                    // joints and beds deeper than the engine's AO
  reflectedLight.indirectDiffuse *= k * cav;
  reflectedLight.indirectSpecular *= mix(1.0, k, 0.5);
}
`,w=`room = bc * (0.11 * fDay) + bc * lc * lit * 0.65;
      }`,y=`
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
      }`;function c(e,a,s,i){return e.includes(a)?e.replace(a,s):(console.info(`[nyc] walls: patch point missing (${i})`),e)}function H(e){const{world:a}=e,s=[];for(let o=0;o<12;o++)for(let r=0;r<2;r++){const f=p[o]&&p[o][r];s.push(f?new l(f[0],f[1],f[2],f[3]):new l(0,0,0,0))}const i=e.grime||[1,1,1],h=new b(e.west?e.west.x*.35:0,1,e.west?e.west.z*.35:0).normalize(),d={uWbWin:{value:s},uWbGrime:{value:new l(i[0],i[1],i[2],e.relief??2.2)},uWbSky:{value:h},uWbContrast:{value:e.contrast??.45},uWbDetail:{value:new l(e.drips??1,e.damp??1,0,0)}},m=e.sills!==!1,u=e.detail!==!1;for(const o of[a.mat.facade,a.mat.facadeWin]){if(!o)continue;const r=o.onBeforeCompile,f=o.customProgramCacheKey.bind(o);o.onBeforeCompile=(n,v)=>{r.call(o,n,v),Object.assign(n.uniforms,d);let t=n.fragmentShader;t=c(t,"float fHash(vec2 p)",`${m?`#define WB_SILLS
`:""}${u?`#define WB_DETAIL
`:""}${x}
float fHash(vec2 p)`,"head"),t=c(t,"diffuseColor.rgb *= fCol;",`${W}
diffuseColor.rgb *= fCol;`,"grime"),t=c(t,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}`,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}
${g}`,"relief"),t=c(t,w,w+y,"curtains"),n.fragmentShader=t},o.customProgramCacheKey=()=>`${f()}-nyc-walls-${m?1:0}${u?1:0}`,o.needsUpdate=!0}return{uniforms:d}}export{H as dressWalls};
