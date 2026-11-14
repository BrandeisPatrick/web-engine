import{k as x,C as h,V as w}from"./three.module-B_yomNYV.js";const k=`
uniform vec4 uNycLamps[NYC_LAMPS];
uniform vec3 uNycLampCol;
uniform float uNycGround;
uniform vec3 uNycWest;
uniform vec3 uNycSkyZen, uNycSkyHor, uNycSkyGlow;
uniform vec4 uNycGrade; // x canyon floor, y roof lift, z sky reflection gain, w wash gain
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
`,L=`
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
  totalEmissiveRadiance += sky * F * uNycGrade.z * fEnv;
}
`,G=`
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
`;function c(t,r,s,i){return t.includes(r)?t.replace(r,s):(console.info(`[nyc] facades: patch point missing (${i})`),t)}function H(t){const{world:r}=t,s=t.lamps??12,i={uNycLamps:{value:Array.from({length:s},()=>new x(0,-1e4,0,0))},uNycLampCol:{value:new h(1,.62,.3)},uNycGround:{value:0},uNycWest:{value:new w(t.west.x,0,t.west.z)},uNycSkyZen:{value:new h},uNycSkyHor:{value:new h},uNycSkyGlow:{value:new h},uNycGrade:{value:new x(t.canyon?.[0]??.32,t.canyon?.[1]??1.25,t.skyGain??1,t.wash??.2)}},g=()=>{const o=r.atmo.sky.material.uniforms,m=o.uAfterglow?o.uAfterglow.value:1;i.uNycSkyZen.value.copy(o.uTwZen.value).multiplyScalar(.6),i.uNycSkyHor.value.copy(o.uTwHor.value).multiplyScalar(.5),i.uNycSkyGlow.value.copy(o.uTwGlow.value).multiplyScalar(.45*m)};g();for(const o of[r.mat.facade,r.mat.facadeWin]){if(!o)continue;const m=o.onBeforeCompile,f=o.customProgramCacheKey.bind(o);o.onBeforeCompile=(y,a)=>{m.call(o,y,a),Object.assign(y.uniforms,i);let e=y.fragmentShader;e=c(e,`return fract(p.x * p.y); }
`,`return fract(p.x * p.y); }
#define NYC_LAMPS ${s}
${k}`,"uniforms"),e=c(e,"float lit = step(1.0 - litP, hp);","float lit = store > 0.5 ? step(1.0 - litP, hp) : nycLit(uv, id, vInfo.z);","lit"),e=c(e,"step(0.72, fHash(id + 9.1))","step(0.7, mix(fHash(id + 9.1), fract(vInfo.z * 3.91), 0.8))","cast"),e=c(e,"lc * lit * 0.62)","lc * lit * 0.62 * (0.3 + 1.2 * f.y * f.y))","far rooms"),e=c(e,"float lit = step(1.0 - uLitFrac * (0.6 + 0.9 * fract(vInfo.z * 5.7)), hp);","float lit = nycLit(vec2(g.x * 0.5, g.y), id, vInfo.z);","curtain lit"),e=c(e,"lc * lit * 0.55)","lc * lit * 0.55 * (0.3 + 1.2 * fv * fv))","curtain far"),e=c(e,"room += lc * glow * 1.4;","room += lc * glow * 1.4 * (0.15 + 1.1 * fHash(id + 11.3));","fixtures"),e=c(e,"+ lc * glow * 1.2;","+ lc * glow * 1.2 * (0.15 + 1.1 * fHash(id + 11.3));","curtain fixtures"),e=c(e,"totalEmissiveRadiance += fEmis;",`totalEmissiveRadiance += fEmis;
${L}`,"glass sky"),e=c(e,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}`,`reflectedLight.directDiffuse *= mix(1.0, fAO, 0.35);
}
${G}`,"grade"),y.fragmentShader=e},o.customProgramCacheKey=()=>`${f()}-nyc-grade-${s}`,o.needsUpdate=!0}const v=r.props&&r.props.lampHeads||[],N=new w(1e9,0,0),l=new w,d=new Float32Array(s),p=new Int32Array(s);return{uniforms:i,setSky:g,update(o,m=!1){if(l.setFromMatrixPosition(o.matrixWorld),!m&&N.distanceToSquared(l)<4)return;N.copy(l),i.uNycGround.value=r.getGroundHeight(l.x,l.z);let f=0;for(let a=0;a<v.length;a++){const e=v[a],u=(e[0]-l.x)**2+(e[2]-l.z)**2;if(f===s&&u>=d[f-1])continue;let n=f<s?f++:s-1;for(;n>0&&d[n-1]>u;)d[n]=d[n-1],p[n]=p[n-1],n--;d[n]=u,p[n]=a}const y=r.atmo.darkness>.3?1:0;for(let a=0;a<s;a++){const e=i.uNycLamps.value[a];if(a<f){const u=v[p[a]];e.set(u[0],u[1],u[2],y)}else e.set(0,-1e4,0,0)}}}}export{H as gradeFacades};
