import{W as u}from"./FacadeTextures-CKKwej-R.js";import{k as c,V as b}from"./three.module-B_yomNYV.js";import"./TextureSets-CvZAYc7C.js";import"./noise-g5kHFeMn.js";const h=`
uniform vec4 uWbWin[24];   // window rects per facade layer (WIN_RECTS: x0, x1, y0, y1; two per layer)
uniform vec4 uWbGrime;     // x streaks, y soot, z repointing, w relief
uniform vec3 uWbSky;       // world direction the ambient comes from (up, leaning to the afterglow)
uniform float uWbContrast; // extra albedo contrast around the scan's mean (0 = as scanned)
float wbH(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float wbN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wbH(i), wbH(i + vec2(1.0, 0.0)), f.x), mix(wbH(i + vec2(0.0, 1.0)), wbH(i + vec2(1.0, 1.0)), f.x), f.y); }
`,x=`
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
`,W=`
if (fGlass < 0.5 && uWbGrime.w > 0.0) {
  vec3 wn = inverseTransformDirection(normal, viewMatrix), wg = inverseTransformDirection(fNg, viewMatrix);
  float rel = dot(wn - wg, uWbSky);                       // the mapped normal's tilt toward the sky
  float k = clamp(1.0 + rel * uWbGrime.w, 0.35, 1.8);
  float cav = mix(1.0, fAO * fAO, 0.6);                    // joints and beds deeper than the engine's AO
  reflectedLight.indirectDiffuse *= k * cav;
  reflectedLight.indirectSpecular *= mix(1.0, k, 0.5);
}
`,v=`room = bc * (0.11 * fDay) + bc * lc * lit * 0.65;
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
      }`;function l(e,r,i,n){return e.includes(r)?e.replace(r,i):(console.info(`[nyc] walls: patch point missing (${n})`),e)}function H(e){const{world:r}=e,i=[];for(let t=0;t<12;t++)for(let a=0;a<2;a++){const f=u[t]&&u[t][a];i.push(f?new c(f[0],f[1],f[2],f[3]):new c(0,0,0,0))}const n=e.grime||[1,1,1],p=new b(e.west?e.west.x*.35:0,1,e.west?e.west.z*.35:0).normalize(),m={uWbWin:{value:i},uWbGrime:{value:new c(n[0],n[1],n[2],e.relief??2.2)},uWbSky:{value:p},uWbContrast:{value:e.contrast??.45}},w=e.sills!==!1;for(const t of[r.mat.facade,r.mat.facadeWin]){if(!t)continue;const a=t.onBeforeCompile,f=t.customProgramCacheKey.bind(t);t.onBeforeCompile=(s,d)=>{a.call(t,s,d),Object.assign(s.uniforms,m);let o=s.fragmentShader;o=l(o,"float fHash(vec2 p)",`${w?`#define WB_SILLS
`:""}${h}
float fHash(vec2 p)`,"head"),o=l(o,"diffuseColor.rgb *= fCol;",`${x}
diffuseColor.rgb *= fCol;`,"grime"),o=l(o,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}`,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}
${W}`,"relief"),o=l(o,v,v+y,"curtains"),s.fragmentShader=o},t.customProgramCacheKey=()=>`${f()}-nyc-walls-${w?1:0}`,t.needsUpdate=!0}return{uniforms:m}}export{H as dressWalls};
