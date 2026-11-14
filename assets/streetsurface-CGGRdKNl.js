import{n as R,R as _,k as j,ab as A,a2 as q,d as O,o as $}from"./three.module-B_yomNYV.js";const E=`
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
`,V=`
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
`,L=`
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
`;function T(r,o,n){const i=r.onBeforeCompile,f=r.customProgramCacheKey?r.customProgramCacheKey.bind(r):()=>"",e=o==="road";r.onBeforeCompile=(c,l)=>{i&&i.call(r,c,l),Object.assign(c.uniforms,n),c.vertexShader=c.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vStP;`).replace("#include <project_vertex>",`#include <project_vertex>
vStP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);let s=c.fragmentShader.replace("#include <common>",`#include <common>
${E}`);if(s=s.replace("void main() {",`float sH = 0.0, sRough = 1.0; vec2 sTilt = vec2(0.0);
void main() {`),e){const t="diffuseColor.rgb = mix(diffuseColor.rgb, rPaintCol, rPaint);";if(!s.includes(t)){console.warn("[street] road shader anchor missing");return}s=s.replace(t,`${V}
${t}`)}else{const t="mix(1.0, 1.55, cFlat); // light concrete sidewalks";if(!s.includes(t)){console.warn("[street] sidewalk shader anchor missing");return}s=s.replace(t,`${t}
${L}`)}s=s.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * sRough, 0.04, 1.0);`),s=s.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
{
  vec2 sDH = vec2(dFdx(sH), dFdy(sH)) * 0.012;
  normal = sBump(-vViewPosition, normal, sDH, faceDirection);
  normal = normalize(normal - (viewMatrix * vec4(sTilt.x, 0.0, sTilt.y, 0.0)).xyz);
#ifdef ENGINE_GBUFFER
  engineGbN = normal;
#endif
}`),c.fragmentShader=s},r.customProgramCacheKey=()=>`${f()}|nyc-street-${o}-1`,r.needsUpdate=!0}function J(r){const o=new Float32Array(90);for(const e of r.net&&r.net.list||[])if(!(!e||e.filler||!e.pts))for(let c=0;c<e.pts.length-1;c++){const l=e.pts[c],s=e.pts[c+1],t=s[0]-l[0],d=s[1]-l[1],y=Math.hypot(t,d);let g=Math.atan2(d,t)*180/Math.PI%90;g<0&&(g+=90),o[Math.floor(g)%90]+=y}let n=0;for(let e=1;e<90;e++)o[e]>o[n]&&(n=e);let i=0,f=0;for(let e=-2;e<=2;e++){const c=(n+e+90)%90;i+=(n+e+.5)*o[c],f+=o[c]}return(f?i/f:n)*Math.PI/180}function W(r,o=2,n=24){let i=1/0,f=-1/0,e=1/0,c=-1/0;const l=[];for(const a of r.net&&r.net.list||[])if(!(!a||a.filler||!a.pts||a.st&&a.st.minor&&a.st.cls!=="pedestrian"))for(let h=0;h<a.pts.length-1;h++){const p=a.pts[h],v=a.pts[h+1];l.push(p[0],p[1],v[0],v[1],a.st&&a.st.hw||4),i=Math.min(i,p[0],v[0]),f=Math.max(f,p[0],v[0]),e=Math.min(e,p[1],v[1]),c=Math.max(c,p[1],v[1])}if(!l.length)return null;i-=n,e-=n,f+=n,c+=n;const s=Math.min(2048,Math.ceil((f-i)/o)),t=Math.min(2048,Math.ceil((c-e)/o)),d=(f-i)/s,y=(c-e)/t,g=new Float32Array(s*t).fill(1/0),x=new Float32Array(s*t);for(let a=0;a<l.length;a+=5){const h=l[a],p=l[a+1],v=l[a+2],H=l[a+3],C=l[a+4],w=v-h,k=H-p,K=w*w+k*k||1,G=Math.atan2(k,w),b=n+C,I=Math.max(0,Math.floor((Math.min(h,v)-b-i)/d)),Z=Math.min(s-1,Math.floor((Math.max(h,v)+b-i)/d)),B=Math.max(0,Math.floor((Math.min(p,H)-b-e)/y)),U=Math.min(t-1,Math.floor((Math.max(p,H)+b-e)/y));for(let M=B;M<=U;M++)for(let P=I;P<=Z;P++){const N=i+(P+.5)*d,F=e+(M+.5)*y,D=Math.max(0,Math.min(1,((N-h)*w+(F-p)*k)/K)),z=Math.hypot(h+w*D-N,p+k*D-F)-C,S=M*s+P;z<g[S]&&z<n&&(g[S]=z,x[S]=G)}}const u=new Uint8Array(s*t*4);for(let a=0;a<s*t;a++)g[a]<1/0&&(u[a*4]=(Math.cos(4*x[a])*.5+.5)*255,u[a*4+1]=(Math.sin(4*x[a])*.5+.5)*255,u[a*4+2]=255,u[a*4+3]=255);const m=new R(u,s,t,_);return m.magFilter=A,m.minFilter=A,m.wrapS=m.wrapT=q,m.needsUpdate=!0,{texture:m,box:new j(i,e,1/(f-i),1/(c-e))}}function Y(r){const o=W(r),n=new R(new Uint8Array(4),1,1,_);n.needsUpdate=!0;const i={uStK:{value:1},uGridAngle:{value:J(r)},uDirMap:{value:o?o.texture:n},uDirBox:{value:o?o.box:new j(0,0,1,1)}};return r.mat&&r.mat.road&&T(r.mat.road,"road",i),r.mat&&r.mat.concrete&&T(r.mat.concrete,"sidewalk",i),{uniforms:i}}function Q(r){let o=null;if(r.group.traverse(t=>{!o&&t.isMesh&&t.material&&t.material.roughness===.62&&t.material.map&&t.material.map.isCanvasTexture&&t.material.polygonOffsetFactor===-1&&(o=t.material)}),!o)return null;const n=128,i=n/8,f=document.createElement("canvas");f.width=f.height=n;const e=f.getContext("2d"),c=e.createImageData(n,n),l=c.data;for(let t=0;t<n;t++)for(let d=0;d<n;d++){const y=d%i/i-.5,g=t%i/i-.5,x=Math.hypot(y,g)/.34;let u=0,m=0;if(x<1&&x>.45){const p=(x-.45)/.55;u=y/(x*.34||1)*p*.8,m=g/(x*.34||1)*p*.8}const a=Math.sqrt(Math.max(0,1-u*u-m*m)),h=(t*n+d)*4;l[h]=(u*.5+.5)*255,l[h+1]=(-m*.5+.5)*255,l[h+2]=(a*.5+.5)*255,l[h+3]=255}e.putImageData(c,0,0);const s=new O(f);return s.wrapS=s.wrapT=$,s.anisotropy=4,o.normalMap=s,o.normalScale.set(1.2,1.2),o.color.setRGB(.62,.42,.3),o.roughness=.7,o.needsUpdate=!0,o}export{J as gridAngle,Y as makeStreetSurface,W as streetDirMap,Q as wearTactile};
