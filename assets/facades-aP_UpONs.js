import{e as k}from"./Buildings-C62c_lfG.js";import{a as v,C as h,V as g}from"./three.core-BG5Iv3B7.js";import"./FacadeTextures-C-sPHzmD.js";import"./TextureSets-D-BoxG4d.js";import"./three.module-Dt1S_jJM.js";import"./noise-g5kHFeMn.js";import"./geom-CY3Snety.js";import"./GBuffer-Dhsz133z.js";const L=`
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
`,S=`
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
    // looked up with the pane's own plane (only a fifth of the per-pane bow): at the 24 m to the opposite wall the
    // full bow sheared the mirrored windows into tilted pale squares floating in the panes
    vec3 gO = normalize(mix(inverseTransformDirection(normalize(vNormal), viewMatrix), gN, 0.2));
    vec3 Ro = reflect(wV, gO);
    float Rn = dot(Ro, gO);
    if (Rn > 0.02) {
      vec2 tw = normalize(vec2(-gO.z, gO.x));
      vec3 Hp = vWPos + Ro * (uNycOpp.x / Rn);
      float hg = Hp.y - nycGround(), u = dot(Hp.xz, tw);
      float roof = uNycOpp.y + uNycOpp.z * nycNoise(vec2(u / 35.0, 7.0 + fract(vInfo.z * 3.0) * 9.0));
      float wall = smoothstep(roof + 2.0, roof - 2.0, hg);
      vec2 wq = vec2(u / 2.7, hg / 3.5), ci = floor(wq), cf = fract(wq);
      float win = smoothstep(0.18, 0.3, cf.x) * smoothstep(0.82, 0.7, cf.x) * smoothstep(0.28, 0.4, cf.y) * smoothstep(0.9, 0.78, cf.y) * step(1.0, ci.y);
      float on = step(0.82, fHash(ci + 7.7 + floor(u / 60.0)));
      vec3 wc = mix(vec3(1.0, 0.68, 0.4), vec3(0.72, 0.84, 1.0), step(0.7, fHash(ci + 3.1))) * (0.4 + 0.8 * fHash(ci + 1.3));
      float aa = clamp(max(fwidth(wq.x), fwidth(wq.y)) * 1.5, 0.0, 1.0);
      // a pane close by (looked up at from the pavement) shows one or two mirrored windows, sharp, in a black pane:
      // they read as loose squares, so near panes keep only the soft average of the wall across
      aa = max(aa, 1.0 - smoothstep(16.0, 32.0, length(vWPos - cameraPosition)));
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
`,z=`
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
`;function i(o,a,r,l){return o.includes(a)?o.replace(a,r):(console.info(`[nyc] facades: patch point missing (${l})`),o)}function A(o){const{world:a}=o,r=o.lamps??12,l={uNycLamps:{value:Array.from({length:r},()=>new v(0,-1e4,0,0))},uNycLampCol:{value:new h(1,.62,.3)},uNycGround:{value:0},uNycWest:{value:new g(o.west.x,0,o.west.z)},uNycSkyZen:{value:new h},uNycSkyHor:{value:new h},uNycSkyGlow:{value:new h},uNycGrade:{value:new v(o.canyon?.[0]??.32,o.canyon?.[1]??1.25,o.skyGain??1,o.wash??.2)},uNycOpp:{value:new v(o.opposite?.[0]??24,o.opposite?.[1]??18,o.opposite?.[2]??45,o.opposite?.[3]??.3)}},x=()=>{const t=a.atmo.sky.material.uniforms,y=t.uAfterglow?t.uAfterglow.value:1;l.uNycSkyZen.value.copy(t.uTwZen.value).multiplyScalar(.6),l.uNycSkyHor.value.copy(t.uTwHor.value).multiplyScalar(.5),l.uNycSkyGlow.value.copy(t.uTwGlow.value).multiplyScalar(.45*y)};x(),o.detail!==!1&&a.mat.facadeSet&&k(a.mat.facadeSet,o.detail||{});for(const t of[a.mat.facade,a.mat.facadeWin]){if(!t)continue;const y=t.onBeforeCompile,f=t.customProgramCacheKey.bind(t);t.onBeforeCompile=(u,s)=>{y.call(t,u,s),Object.assign(u.uniforms,l);let e=u.fragmentShader;e=i(e,`return fract(p.x * p.y); }
`,`return fract(p.x * p.y); }
#define NYC_LAMPS ${r}
${L}`,"uniforms"),e=i(e,"float lit = step(1.0 - litP, hp);","float lit = store > 0.5 ? step(1.0 - litP, hp) : nycLit(uv, id, vInfo.z);","lit"),e=i(e,"step(0.72, fHash(id + 9.1))","step(0.7, mix(fHash(id + 9.1), fract(vInfo.z * 3.91), 0.8))","cast"),e=i(e,"lc * lit * 0.62)","lc * lit * 0.62 * (0.3 + 1.2 * f.y * f.y))","far rooms"),e=i(e,"float lit = step(1.0 - uLitFrac * (0.6 + 0.9 * fract(vInfo.z * 5.7)), hp);","float lit = nycLit(vec2(g.x * 0.5, g.y), id, vInfo.z);","curtain lit"),e=i(e,"lc * lit * 0.55)","lc * lit * 0.55 * (0.3 + 1.2 * fv * fv))","curtain far"),e=i(e,"room += lc * glow * 1.4;","room += lc * glow * 1.4 * (0.15 + 1.1 * fHash(id + 11.3));","fixtures"),e=i(e,"+ lc * glow * 1.2;","+ lc * glow * 1.2 * (0.15 + 1.1 * fHash(id + 11.3));","curtain fixtures"),e=i(e,"totalEmissiveRadiance += fEmis;",`totalEmissiveRadiance += fEmis;
${S}`,"glass sky"),e=i(e,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}`,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}
${z}`,"grade"),u.fragmentShader=e},t.customProgramCacheKey=()=>`${f()}-nyc-grade-${r}`,t.needsUpdate=!0}const w=a.props&&a.props.lampHeads||[],N=new g(1e9,0,0),n=new g,m=new Float32Array(r),d=new Int32Array(r);return{uniforms:l,setSky:x,update(t,y=!1){if(n.setFromMatrixPosition(t.matrixWorld),!y&&N.distanceToSquared(n)<4)return;N.copy(n),l.uNycGround.value=a.getGroundHeight(n.x,n.z);let f=0;for(let s=0;s<w.length;s++){const e=w[s],p=(e[0]-n.x)**2+(e[2]-n.z)**2;if(f===r&&p>=m[f-1])continue;let c=f<r?f++:r-1;for(;c>0&&m[c-1]>p;)m[c]=m[c-1],d[c]=d[c-1],c--;m[c]=p,d[c]=s}const u=a.atmo.darkness>.3?1:0;for(let s=0;s<r;s++){const e=l.uNycLamps.value[s];if(s<f){const p=w[d[s]];e.set(p[0],p[1],p[2],u)}else e.set(0,-1e4,0,0)}}}}export{A as gradeFacades};
