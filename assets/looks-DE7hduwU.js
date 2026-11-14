import{p as g}from"./noise-g5kHFeMn.js";import{V as S,l as G,k as x,n as $,R as _,a9 as P,o as D,L as z,p as N,N as K,t as v,C as y}from"./three.module-B_yomNYV.js";const s={time:{value:0},moonView:{value:new S(0,0,-1)},wind:{value:new G(.9,.35)},cam:{value:new S},update(e,o,n){this.time.value=(this.time.value+e)%3600,this.cam.value.copy(o.position),this.moonView.value.copy(n).transformDirection(o.matrixWorldInverse)}};let H=null;function C(){if(H)return H;const e=256,o=new Uint8Array(e*e*4);for(let w=0;w<e;w++)for(let a=0;a<e;a++){const i=a/e,t=w/e,r=(w*e+a)*4,m=g(i,t,16,4,11,.55),l=g(i,t,4,4,23,.5),u=g(i,t,64,2,37,.5),c=g(i*.25+t*0,t,8,3,41,.5);o[r]=Math.round(255*m),o[r+1]=Math.round(255*l),o[r+2]=Math.round(255*u),o[r+3]=Math.round(255*c)}const n=new $(o,e,e,_,P);return n.wrapS=n.wrapT=D,n.minFilter=z,n.magFilter=N,n.generateMipmaps=!0,n.anisotropy=4,n.colorSpace=K,n.needsUpdate=!0,n.name="halloweenDetail",H=n,n}function B(e,{scale:o=1.4,amount:n=.55,broad:w=.35,dew:a=0,streak:i=0,spec:t=1,lite:r=!1}={}){const m=C();return e.onBeforeCompile=l=>{l.uniforms.tDetailHw={value:m},l.uniforms.uDetailHw={value:new x(o,n,w,a)},l.uniforms.uStreakHw={value:i},l.uniforms.uSpecHw={value:t},l.vertexShader=l.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vHwPos;
varying vec3 vHwNrm;`).replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
  {
    vec4 hwp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    hwp = instanceMatrix * hwp;
  #endif
    vHwPos = ( modelMatrix * hwp ).xyz;
    vHwNrm = normalize( mat3( modelMatrix ) * objectNormal );
  }`),l.fragmentShader=l.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vHwPos;
varying vec3 vHwNrm;
uniform sampler2D tDetailHw;
uniform vec4 uDetailHw;
uniform float uStreakHw;
uniform float uSpecHw;`).replace("#include <color_fragment>",`#include <color_fragment>
  vec3 hwAn = abs( vHwNrm );
  bool hwSide = hwAn.y < max( hwAn.x, hwAn.z );
  vec2 hwUv = hwSide ? ( hwAn.x > hwAn.z ? vHwPos.zy : vHwPos.xy ) : vHwPos.xz;
  vec4 hwD = ${r==="none"?"vec4( 0.5 )":"texture2D( tDetailHw, hwUv * uDetailHw.x )"};
  vec4 hwB = ${r?"hwD":"texture2D( tDetailHw, hwUv * uDetailHw.x * 0.13 + 0.37 )"};
  float hwG = hwD.r * 0.75 + hwD.b * 0.25;
  if ( hwSide ) hwG = mix( hwG, hwD.a, uStreakHw );
  diffuseColor.rgb *= mix( 1.0, 0.45 + 1.1 * hwG, uDetailHw.y ) * mix( 1.0, 0.6 + 0.8 * hwB.g, uDetailHw.z );`),t!==1&&(l.fragmentShader=l.fragmentShader.replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>
  material.specularColor *= uSpecHw; material.specularF90 *= uSpecHw;`)),a>0&&(l.fragmentShader=l.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
  roughnessFactor = mix( roughnessFactor, roughnessFactor * ( 0.86 + 0.14 * smoothstep( 0.3, 0.6, hwB.g ) ), uDetailHw.w );`))},e.customProgramCacheKey=()=>`hwDetail${a>0?"D":""}${t!==1?"S":""}${r?`L${r}`:""}`,e}function k(e,o,{normal:n=!0,strength:w=1,hue:a=.5,breakup:i=!0}={}){const t=e.onBeforeCompile,r=[o.grass,o.litter,o.gravel],m=n&&r.every(u=>u.normal);e.onBeforeCompile=(u,c)=>{t&&t!==v.prototype.onBeforeCompile&&t(u,c),r.forEach((f,d)=>{u.uniforms[`tGrnd${d}`]={value:f.map},m&&(u.uniforms[`tGrndN${d}`]={value:f.normal})}),u.uniforms.uGrndK={value:new x(r[0].scale,r[1].scale,r[2].scale,w)},u.uniforms.uGrndHue={value:a},r.forEach((f,d)=>{u.uniforms[`uGrndM${d}`]={value:f.mean}});const h=r.map((f,d)=>`uniform sampler2D tGrnd${d};${m?` uniform sampler2D tGrndN${d};`:""}`).join(`
`);u.vertexShader=u.vertexShader.replace("#include <common>",`#include <common>
attribute vec2 gmask;
varying vec2 vGMaskHw;`).replace("#include <begin_vertex>",`#include <begin_vertex>
	vGMaskHw = gmask;`),u.fragmentShader=u.fragmentShader.replace("#include <common>",`#include <common>
varying vec2 vGMaskHw;
${h}
uniform vec4 uGrndK;
uniform float uGrndHue;
uniform vec3 uGrndM0, uGrndM1, uGrndM2;
vec3 hwGrndDetail( vec3 c, vec3 m ) {
  vec3 d = c / max( m, vec3( 1e-3 ) );
  return mix( vec3( dot( d, vec3( 0.2126, 0.7152, 0.0722 ) ) ), d, uGrndHue );
}`).replace("#include <color_fragment>",`#include <color_fragment>
  vec2 hwGUv = vec2( vHwPos.x, - vHwPos.z );
  float hwWg = clamp( vGMaskHw.x, 0.0, 1.0 ), hwWl = clamp( vGMaskHw.y, 0.0, 1.0 ) * ( 1.0 - hwWg ), hwWa = 1.0 - hwWg - hwWl;
  // the grass twice (a rotated, larger sample over the first, by a broad noise): no visible tiling at a distance
  vec2 hwRUv = mat2( 0.8, 0.6, - 0.6, 0.8 ) * hwGUv * 0.37 + 0.31;
  ${i?"float hwBrk = smoothstep( 0.4, 0.6, texture2D( tDetailHw, hwGUv * 0.035 ).g );":"float hwBrk = 0.0;"}
  float hwNear = 1.0 - smoothstep( 20.0, 32.0, distance( vHwPos, cameraPosition ) ); // (the costly samples near the eye only)
  vec3 hwGa = texture2D( tGrnd0, hwGUv * uGrndK.x ).rgb;
  ${i?"if ( hwNear > 0.0 ) hwGa = mix( hwGa, texture2D( tGrnd0, hwRUv * uGrndK.x ).rgb, hwBrk * hwNear );":""}
  vec3 hwDet = hwGrndDetail( hwGa, uGrndM0 ) * hwWa;
  if ( hwWl > 0.004 ) hwDet += hwGrndDetail( texture2D( tGrnd1, hwGUv * uGrndK.y ).rgb, uGrndM1 ) * hwWl;
  if ( hwWg > 0.004 ) hwDet += hwGrndDetail( texture2D( tGrnd2, hwGUv * uGrndK.z ).rgb, uGrndM2 ) * hwWg;
  diffuseColor.rgb *= hwDet;`),m&&(u.fragmentShader=u.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
  if ( hwNear > 0.0 ) {
    vec3 hwTn = ( texture2D( tGrndN0, mix( hwGUv * uGrndK.x, hwRUv * uGrndK.x, step( 0.5, hwBrk ) ) ).xyz * 2.0 - 1.0 ) * hwWa;
    if ( hwWl > 0.004 ) hwTn += ( texture2D( tGrndN1, hwGUv * uGrndK.y ).xyz * 2.0 - 1.0 ) * hwWl;
    if ( hwWg > 0.004 ) hwTn += ( texture2D( tGrndN2, hwGUv * uGrndK.z ).xyz * 2.0 - 1.0 ) * hwWg;
    hwTn.xy *= uGrndK.w * hwNear;
    vec3 hwN = normalize( vHwNrm ), hwT = normalize( vec3( 1.0, 0.0, 0.0 ) - hwN * hwN.x ), hwB = cross( hwN, hwT );
    vec3 hwNw = normalize( hwT * hwTn.x + hwB * hwTn.y + hwN * max( hwTn.z, 0.05 ) );
    normal = normalize( ( viewMatrix * vec4( hwNw, 0.0 ) ).xyz );
  }`))};const l=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${l()}|hwGround${m?"N":""}${i?"B":""}`,e}function F(e,o,{normal:n=!0,strength:w=1}={}){const a=e.onBeforeCompile,i=n&&o.every(r=>r.normal);e.onBeforeCompile=(r,m)=>{a&&a!==v.prototype.onBeforeCompile&&a(r,m),o.forEach((c,h)=>{r.uniforms[`tSurf${h}`]={value:c.map},i&&(r.uniforms[`tSurfN${h}`]={value:c.normal}),r.uniforms[`uSurfM${h}`]={value:new x(c.mean.x,c.mean.y,c.mean.z,c.scale)},r.uniforms[`uSurfH${h}`]={value:c.hue}}),r.uniforms.uSurfK={value:w};const l=o.map((c,h)=>`uniform sampler2D tSurf${h};${i?` uniform sampler2D tSurfN${h};`:""} uniform vec4 uSurfM${h}; uniform float uSurfH${h};`).join(`
`),u=c=>o.map((h,f)=>`${f?"else ":""}if ( hwSk == ${f+1} ) { ${c(f)} }`).join(`
    `);r.vertexShader=r.vertexShader.replace("#include <common>",`#include <common>
attribute float surf;
varying float vSurfHw;`).replace("#include <begin_vertex>",`#include <begin_vertex>
	vSurfHw = surf;`),r.uniforms.uMoonSurfHw=s.moonView,r.fragmentShader=r.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
  if ( hwSk >= 1 && hwSk <= 3 ) totalEmissiveRadiance += diffuseColor.rgb * vec3( 0.05, 0.055, 0.075 ) * clamp( - dot( normal, uMoonSurfHw ) + 0.3, 0.0, 1.0 ); // (bounce / sky fill: walls away from the moon keep their boards)`).replace("#include <common>",`#include <common>
varying float vSurfHw;
${l}
uniform float uSurfK;
uniform vec3 uMoonSurfHw;`).replace("#include <color_fragment>",`#include <color_fragment>
  int hwSk = int( vSurfHw + 0.5 );
  vec3 hwSn = normalize( vHwNrm ), hwSa = abs( hwSn );
  bool hwSside = hwSa.y < max( hwSa.x, hwSa.z );
  bool hwSx = hwSa.x > hwSa.z;
  vec2 hwSuv = hwSside ? ( hwSx ? vec2( vHwPos.z, vHwPos.y ) : vec2( vHwPos.x, vHwPos.y ) ) : vHwPos.xz;
  vec3 hwSt = hwSside ? ( hwSx ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 ) ) : vec3( 1.0, 0.0, 0.0 );
  vec3 hwSb = hwSside ? vec3( 0.0, 1.0, 0.0 ) : vec3( 0.0, 0.0, 1.0 );
  if ( hwSk == 2 && hwSa.y < 0.97 ) { // slate: rows along the eaves whichever way the roof faces (frame from the slope)
    hwSt = normalize( cross( vec3( 0.0, 1.0, 0.0 ), hwSn ) ); hwSb = cross( hwSn, hwSt );
    hwSuv = vec2( dot( vHwPos, hwSt ), dot( vHwPos, hwSb ) );
  }
  vec3 hwStn = vec3( 0.0, 0.0, 1.0 );
  float hwSnear = 1.0 - smoothstep( 40.0, 60.0, distance( vHwPos, cameraPosition ) );
  if ( hwSk >= 1 && hwSk <= ${o.length} ) {
    vec3 hwSc = vec3( 1.0 ); vec4 hwSm = vec4( 1.0 ); float hwSh = 0.5;
    ${u(c=>`hwSm = uSurfM${c}; hwSh = uSurfH${c}; hwSc = texture2D( tSurf${c}, hwSuv * uSurfM${c}.w ).rgb;${i?` if ( hwSnear > 0.0 ) hwStn = texture2D( tSurfN${c}, hwSuv * uSurfM${c}.w ).xyz * 2.0 - 1.0;`:""}`)}
    vec3 hwSd = hwSc / max( hwSm.rgb, vec3( 1e-3 ) );
    diffuseColor.rgb *= clamp( mix( vec3( dot( hwSd, vec3( 0.2126, 0.7152, 0.0722 ) ) ), hwSd, hwSh ), 0.0, 2.5 );
  } else if ( hwSk == 6 ) { // rusted iron: a warm bloom in the pits, darker scale
    float hwR = texture2D( tDetailHw, hwSuv * 3.1 ).g;
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.16, 0.07, 0.035 ), smoothstep( 0.45, 0.75, hwR ) * 0.7 );
  }`),i&&(r.fragmentShader=r.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
  if ( hwSk >= 1 && hwSk <= ${o.length} && hwSnear > 0.0 ) {
    vec3 hwT = normalize( hwSt - hwSn * dot( hwSt, hwSn ) ), hwB = normalize( hwSb - hwSn * dot( hwSb, hwSn ) - hwT * dot( hwSb, hwT ) );
    vec3 hwNw = normalize( ( hwT * hwStn.x + hwB * hwStn.y ) * uSurfK * hwSnear + hwSn * max( hwStn.z, 0.05 ) );
    normal = normalize( ( viewMatrix * vec4( hwNw, 0.0 ) ).xyz );
  }`))};const t=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${t()}|hwSurf${i?"N":""}${o.length}`,e}const p=8,b={pos:{value:Array.from({length:p},()=>new x)},col:{value:Array.from({length:p},()=>new S)},n:{value:0}};function T(e,o="hwPools"){const n=e.onBeforeCompile;e.onBeforeCompile=(a,i)=>{n&&n!==v.prototype.onBeforeCompile&&n(a,i),a.uniforms.uPoolP=b.pos,a.uniforms.uPoolC=b.col,a.uniforms.uPoolN=b.n,a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
uniform vec4 uPoolP[ ${p} ];
uniform vec3 uPoolC[ ${p} ];
uniform int uPoolN;`).replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
  for ( int i = 0; i < ${p}; i ++ ) {
    if ( i >= uPoolN ) break;
    vec3 hwD = uPoolP[ i ].xyz - vHwPos;
    float hwDl = length( hwD ), hwF = clamp( 1.0 - hwDl / uPoolP[ i ].w, 0.0, 1.0 );
    if ( hwF <= 0.0 ) continue;
    vec3 hwL = normalize( ( viewMatrix * vec4( hwD, 0.0 ) ).xyz );
    reflectedLight.directDiffuse += BRDF_Lambert( material.diffuseColor ) * uPoolC[ i ] * hwF * hwF * clamp( dot( normal, hwL ) * 0.85 + 0.15, 0.0, 1.0 );
  }`)};const w=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${w()}|${o}`,e}function W(e,{color:o=new y(.32,.36,.62),power:n=3,share:w=.35,fill:a=0,key:i="rim"}={}){const t=e.onBeforeCompile,r=o.isColor?o:new y(o);e.onBeforeCompile=(l,u)=>{t&&t!==v.prototype.onBeforeCompile&&t(l,u),l.uniforms.uRimHw={value:r},l.uniforms.uRimHwP={value:new S(n,w,a)},l.uniforms.uMoonViewHw=s.moonView,l.fragmentShader=l.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uRimHw;
uniform vec3 uRimHwP;
uniform vec3 uMoonViewHw;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
  {
    vec3 hwV = normalize( vViewPosition );
    float hwF = pow( 1.0 - clamp( abs( dot( normal, hwV ) ), 0.0, 1.0 ), uRimHwP.x );
    float hwM = uRimHwP.y + clamp( dot( normal, uMoonViewHw ) * 0.6 + 0.4, 0.0, 1.0 ); // edges turned toward the moon
    float hwL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ); // light albedo (skin, a white sheet) rims less
    totalEmissiveRadiance += uRimHw * hwF * hwM * ( 1.0 - 0.7 * clamp( hwL, 0.0, 1.0 ) ) + diffuseColor.rgb * uRimHwP.z; // + a self fill
  }`)};const m=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${m()}|${i}`,e}function U(e,o=null){return e.onBeforeCompile=n=>{n.uniforms.uTimeHw=s.time,n.uniforms.uWindHw=s.wind,n.uniforms.uCamHw=s.cam,n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
uniform float uTimeHw;
uniform vec2 uWindHw;
uniform vec3 uCamHw;`).replace("#include <begin_vertex>",`#include <begin_vertex>
  {
  #ifdef USE_INSTANCING
    vec2 hwO = instanceMatrix[ 3 ].xz;
  #else
    vec2 hwO = vec2( 0.0 );
  #endif
    float hwPh = dot( hwO, vec2( 0.21, 0.17 ) ) - uTimeHw * 1.9;
    float hwS = ( sin( hwPh ) * 0.6 + sin( hwPh * 2.3 + 1.7 ) * 0.25 + 0.35 ) * uWindHw.y;
    float hwH = transformed.y * transformed.y * 2.2;
    // the wind is world-space: undo the instance's rotation for the offset direction (its upper 3x3, unit scale ~)
  #ifdef USE_INSTANCING
    vec3 hwW = transpose( mat3( instanceMatrix ) ) * vec3( uWindHw.x, 0.0, 1.0 - uWindHw.x );
  #else
    vec3 hwW = vec3( uWindHw.x, 0.0, 1.0 - uWindHw.x );
  #endif
    transformed += normalize( hwW ) * hwS * hwH;
    ${o?`transformed *= 1.0 - smoothstep( ${o[0].toFixed(1)}, ${o[1].toFixed(1)}, length( hwO - uCamHw.xz ) ); // (far clumps fold away: thin far blades cost the most per pixel)`:""}
  }`)},e.customProgramCacheKey=()=>o?`hwGrassF${o[0]}`:"hwGrass",e}function A(e,o,n,w="hwFold"){const a=e.onBeforeCompile;e.onBeforeCompile=(t,r)=>{a&&a!==v.prototype.onBeforeCompile&&a(t,r),t.uniforms.uCamFoldHw=s.cam,t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
uniform vec3 uCamFoldHw;`).replace("#include <begin_vertex>",`#include <begin_vertex>
  #ifdef USE_INSTANCING
    transformed *= 1.0 - smoothstep( ${o.toFixed(1)}, ${n.toFixed(1)}, distance( instanceMatrix[ 3 ].xyz, uCamFoldHw ) );
  #endif`)};const i=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${i()}|${w}${o}`,e}function L(e,o="hwGlow"){const n=e.onBeforeCompile;e.onBeforeCompile=(a,i)=>{n&&n!==v.prototype.onBeforeCompile&&n(a,i),a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float glow;
varying float vGlowHw;`).replace("#include <begin_vertex>",`#include <begin_vertex>
	vGlowHw = glow;`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
varying float vGlowHw;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
	totalEmissiveRadiance += diffuseColor.rgb * vGlowHw;`)};const w=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${w()}|${o}`,e}function V(e,o,n=.5,w="hwRibs",a=!1){const i=e.onBeforeCompile;e.onBeforeCompile=(r,m)=>{i&&i!==v.prototype.onBeforeCompile&&i(r,m),a&&(r.uniforms.tSkinHw={value:C()},r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D tSkinHw;`).replace("#include <lights_physical_fragment>",`if ( vRibHw.w > 0.5 ) {
    float hwA = atan( vRibHw.x, vRibHw.z ), hwH = vRibHw.y;
    vec4 hwK1 = texture2D( tSkinHw, vec2( hwA * ${(o*.32).toFixed(3)}, hwH * 0.7 ) );
    vec4 hwK2 = texture2D( tSkinHw, vec2( hwA * 1.9, hwH * 2.6 ) + 0.5 );
    float hwL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
    float hwSt = smoothstep( 0.3, 0.75, hwK1.a ) * 0.7 + 0.3 * hwK1.r;
    diffuseColor.rgb = mix( vec3( hwL ), diffuseColor.rgb, 0.8 ) * ( 0.55 + 0.75 * hwSt );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.35, 1.25, 0.7 ), smoothstep( 0.58, 0.74, hwK2.b ) * 0.7 );
    roughnessFactor = clamp( roughnessFactor * ( 0.7 + 0.6 * hwK2.r ), 0.2, 1.0 );
    ${typeof a=="number"?`// the lid's cut: a zigzag ring round the stem (skin = the pumpkin's radius)
    float hwR = length( vRibHw.xz ), hwZ = ${(.42*a).toFixed(4)} * ( 1.0 + 0.1 * sign( sin( hwA * 7.0 ) ) );
    float hwCut = ( 1.0 - smoothstep( 0.004, 0.012, abs( hwR - hwZ ) ) ) * step( ${(1*a).toFixed(4)}, vRibHw.y );
    diffuseColor.rgb *= 1.0 - 0.75 * hwCut;`:""}
  }
#include <lights_physical_fragment>`)),r.vertexShader=r.vertexShader.replace("#include <common>",`#include <common>
attribute float rib;
varying vec4 vRibHw;
varying vec3 vRibTHw;`).replace("#include <begin_vertex>",`#include <begin_vertex>
  {
    vec3 t = vec3( position.z, 0.0, - position.x ) + vec3( 1e-5, 0.0, 0.0 );
  #ifdef USE_INSTANCING
    t = mat3( instanceMatrix ) * t;
  #endif
    vRibTHw = normalize( normalMatrix * t );
    vRibHw = vec4( position, rib );
  }`),r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
varying vec4 vRibHw;
varying vec3 vRibTHw;`).replace("#include <normal_fragment_begin>",`#include <normal_fragment_begin>
  float hwRibL = 1.0;
  if ( vRibHw.w > 0.5 ) {
    float a = atan( vRibHw.x, vRibHw.z ) * ${(o/2).toFixed(2)}, c = cos( a ), s = sin( a );
    hwRibL = pow( abs( c ), 0.6 );
    float slope = - 0.6 * pow( max( abs( c ), 0.04 ), - 0.4 ) * sign( c ) * s; // d lobe / d phase
    normal = normalize( normal - normalize( vRibTHw ) * clamp( slope, - 2.5, 2.5 ) * ${n.toFixed(3)} );
  }`).replace("#include <lights_fragment_begin>",`	diffuseColor.rgb *= 0.72 + 0.28 * hwRibL;
#include <lights_fragment_begin>`)};const t=e.customProgramCacheKey.bind(e);return e.customProgramCacheKey=()=>`${t()}|${w}${o}${a?"S":""}`,e}export{p as LAMP_POOLS,s as LOOK,b as POOLS,C as detailTexture,B as patchDetail,A as patchFold,L as patchGlow,U as patchGrass,k as patchGround,T as patchPools,V as patchRibs,W as patchRim,F as patchSurfaces};
