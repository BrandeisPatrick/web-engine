import{d as x,bd as S,s as C,b7 as b}from"./three.module-B_yomNYV.js";const y=`
float wHash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wPuddle(vec2 p, float bias, float cover) {
  float n = wNoise(p * 0.11) * 0.64 + wNoise(p * 0.37 + 17.3) * 0.28 + wNoise(p * 0.9 + 3.1) * 0.08;
  return smoothstep(1.0 - cover, 1.0 - cover + 0.09, n + bias);
}
`;function v(t,l,f,c){const r=t.onBeforeCompile,o=t.customProgramCacheKey?t.customProgramCacheKey.bind(t):()=>"";t.onBeforeCompile=(e,s)=>{r&&r.call(t,e,s),Object.assign(e.uniforms,f),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vWetP;`).replace("#include <project_vertex>",`#include <project_vertex>
vWetP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);const n=l==="road";e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vWetP;
uniform float uWet; uniform float uWetCover;
${y}`).replace("#include <map_fragment>",`#include <map_fragment>
float wetK = uWet, wetP = 0.0, wetUp = 1.0;
{
${n?`  float wAd = abs(vRoad.x), wHw = vRoad.z;
  float gutter = wHw > 0.5 ? smoothstep(wHw - 1.4, wHw - 0.15, wAd) : 0.0;           // water runs to the kerbs
  float lanePos = fract(wAd / 3.3);
  float track = (1.0 - smoothstep(0.08, 0.3, abs(abs(lanePos - 0.5) - 0.24))) * 0.12; // ruts hold water
  wetP = wPuddle(vWetP.xz, gutter * 0.5 + track, uWetCover) * wetK; // standing water mostly in the gutters
  diffuseColor.rgb *= mix(1.0, 0.58, wetK);   // damp asphalt
  diffuseColor.rgb *= 0.7 + 0.55 * wNoise(vWetP.xz * 0.05 + 11.0);   // large tonal patches (resurfacing, old oil)
  diffuseColor.rgb *= 1.0 - 0.35 * wetP;      // standing water`:`  wetUp = smoothstep(0.75, 0.95, abs(dot(normalize(vNormal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz))));
  wetP = wPuddle(vWetP.xz * 1.2 + 41.0, -0.02, uWetCover) * wetK * wetUp;
  diffuseColor.rgb *= mix(1.0, 0.55, wetK * wetUp);
  // city grime on the flags: large stains, dark drip lines near the kerb, chewing-gum spots (breaks the tile repeat)
  float stain = wNoise(vWetP.xz * 0.23 + 7.0) * 0.6 + wNoise(vWetP.xz * 0.9 + 2.0) * 0.4;
  vec2 gq = vWetP.xz * 14.0; float gum = step(0.985, wHash(floor(gq))) * (1.0 - smoothstep(0.18, 0.32, length(fract(gq) - 0.5)));
  diffuseColor.rgb *= mix(1.0, (0.62 + 0.6 * stain) * (1.0 - 0.45 * gum), wetUp);
  diffuseColor.rgb *= 1.0 - 0.3 * wetP;`}
}`).replace("#include <metalnessmap_fragment>",`#include <metalnessmap_fragment>
roughnessFactor = mix(roughnessFactor, ${n?"0.42 * roughnessFactor + 0.08":"mix(roughnessFactor, 0.42 * roughnessFactor + 0.07, wetUp)"}, wetK);
roughnessFactor = mix(roughnessFactor, 0.06, wetP); // puddles: glossy, not a mirror (rain-dimpled)
#ifdef ENGINE_GBUFFER
engineGbRoughness = roughnessFactor;
#endif`),e.fragmentShader.includes("mapN.xy *= normalScale;")?e.fragmentShader=e.fragmentShader.replace("mapN.xy *= normalScale;","mapN.xy *= normalScale * 1.6 * (1.0 - wetP) * (1.0 - 0.3 * wetK * wetUp); /* asphalt relief survives the damp */"):e.fragmentShader.includes("mapN.xy *= normalScale * cFlat;")&&(e.fragmentShader=e.fragmentShader.replace("mapN.xy *= normalScale * cFlat;","mapN.xy *= normalScale * 1.8 * cFlat * (1.0 - wetP) * (1.0 - 0.3 * wetK * wetUp); // slab joints and wear catch the light"))},t.customProgramCacheKey=()=>`${o()}|nyc-wet-${l}-1`,c&&(t.envMap=c,t.envMapIntensity=l==="road"?.6:.4),t.needsUpdate=!0}function W(t,l=7){const r=document.createElement("canvas");r.width=512,r.height=256;const o=r.getContext("2d"),e=o.createLinearGradient(0,0,0,256);e.addColorStop(0,"#05060a"),e.addColorStop(.25,"#12131a"),e.addColorStop(.42,"#2a2420"),e.addColorStop(.5,"#4a3626"),e.addColorStop(.56,"#100c09"),e.addColorStop(1,"#030303"),o.fillStyle=e,o.fillRect(0,0,512,256);let s=l>>>0;const n=()=>{s=s+1831565813>>>0;let a=s;return a=Math.imul(a^a>>>15,a|1),a^=a+Math.imul(a^a>>>7,a|61),((a^a>>>14)>>>0)/4294967296},g=["#ffb46a","#ffd9a0","#ff5a3c","#3cc8ff","#ff4fd0","#fff1d6","#9cff6a","#ffcf3a"];o.globalCompositeOperation="lighter";for(let a=0;a<220;a++){const p=n()*512,m=256*(.2+n()*.31),i=4+n()*18,u=o.createRadialGradient(p,m,0,p,m,i);u.addColorStop(0,g[n()*g.length|0]),u.addColorStop(1,"rgba(0,0,0,0)"),o.globalAlpha=.25+n()*.55,o.fillStyle=u,o.fillRect(p-i,m-i,2*i,2*i)}o.globalAlpha=1,o.globalCompositeOperation="source-over";const d=new x(r);d.mapping=S,d.colorSpace=C;const w=new b(t),h=w.fromEquirectangular(d);return w.dispose(),d.dispose(),h.texture}function N(t,{wet:l=1,cover:f=.3,env:c=null}={}){const r={uWet:{value:l},uWetCover:{value:f}};return t.mat&&t.mat.road&&v(t.mat.road,"road",r,c),t.mat&&t.mat.concrete&&v(t.mat.concrete,"sidewalk",r,c),{uniforms:r,env:c}}export{W as makeCityEnv,N as makeStreetsWet};
