import{p as u,al as f,$ as v,a0 as h,V as x,a6 as g}from"./three.module--UGqIKUS.js";const P=`float mpIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
`,w=`float mpHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
`;function F(){return{uTime:{value:0},uViewPos:{value:new x(0,-1e6,0)}}}function $(e,n,t,i){e.uTime.value=Number.isFinite(i)?i:e.uTime.value+(n||0),t&&e.uViewPos&&e.uViewPos.value.copy(t)}function C(e,n={}){const t=n.direction||[.8,.6],i=Math.hypot(t[0],t[1])||1,a={value:new u(t[0]/i,t[1]/i,n.strength??1,n.frequency??1)},r={value:new u(1/(n.height??1),n.flutter??0,0,0)},s=n.weight??"height";let o="",c;if(s==="height")c="pow( clamp( position.y * uWindB.x, 0.0, 1.0 ), 2.0 )";else if(s.startsWith("attr:")){const[d,m]=s.slice(5).split(".");o=`attribute vec4 ${d};
`,c=`${d}.${m||"x"}`}else c=s;return{key:`wind(${s})`,uniforms:{uTime:e.uTime,uWind:a,uWindB:r},depth:!0,vertexPars:`uniform float uTime;
uniform vec4 uWind;
uniform vec4 uWindB;
${o}`,vertexBegin:`
	{
		float mpW = ${c};
		if ( mpW > 0.0 ) {
			float t = uTime * uWind.w, ph = mpHash( mpInstancePos.xz ) * 6.2831853;
			vec2 dirW = uWind.xy;
			float g = 0.55 + 0.45 * sin( t * 0.33 + mpInstancePos.x * 0.004 + mpInstancePos.z * 0.003 );
			float s1 = sin( t * 1.2 + ph ) * 0.6 + sin( t * 2.3 + ph * 1.7 ) * 0.25;
			float s2 = cos( t * 1.05 + ph * 2.1 ) * 0.35;
			mpOffset.xz += ( dirW * ( 0.35 + s1 ) + vec2( - dirW.y, dirW.x ) * s2 ) * g * mpW * uWind.z;
			mpOffset.y -= abs( s1 ) * mpW * g * 0.12 * uWind.z;
			if ( uWindB.y > 0.0 ) mpOffset += vec3( 0.6, 1.0, - 0.45 ) * sin( t * 6.3 + dot( position, vec3( 17.0, 31.0, 23.0 ) ) + ph ) * uWindB.y * mpW;
		}
	}
`}}function O(e,n={}){const t={value:new u(n.start??100,n.end??120,n.mode==="in"?1:0,0)};return{key:"dither",uniforms:{uViewPos:e.uViewPos,uFade:t},depth:!0,vertexPars:`uniform vec3 uViewPos;
uniform vec4 uFade;
varying float vMpFade;
`,vertexBegin:`
	{
		float s = smoothstep( uFade.x, uFade.y, distance( uViewPos, mpInstancePos ) );
		vMpFade = uFade.z > 0.5 ? s : 1.0 - s;
		if ( vMpFade <= 0.0 ) { transformed = vec3( 0.0 ); mpCollapsed = true; }
	}
`,fragmentPars:`uniform vec4 uFade;
varying float vMpFade;
`,fragmentDiscard:`
	if ( vMpFade < 0.999 ) {
		float n = mpIGN( gl_FragCoord.xy );
		if ( uFade.z > 0.5 ? n <= 1.0 - vMpFade : n > vMpFade ) discard;
	}
`}}const p="mvPosition = modelViewMatrix * mvPosition;",l="worldPosition = modelMatrix * worldPosition;";function y(e,n){const t=g,i=n.map(r=>r.vertexPars||"").join(""),a=n.map(r=>r.vertexBegin||"").join("");return e=e.replace("#include <common>",`#include <common>
${w}vec3 mpOffset;
vec3 mpInstancePos;
bool mpCollapsed;
${i}`),e=e.replace("#include <begin_vertex>",`#include <begin_vertex>
mpOffset = vec3( 0.0 );
mpCollapsed = false;
#ifdef USE_INSTANCING
	mpInstancePos = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
#else
	mpInstancePos = modelMatrix[ 3 ].xyz;
#endif
${a}`),t.project_vertex.includes(p)||console.warn("[MaterialPatches] project_vertex anchor missing"),e=e.replace("#include <project_vertex>",t.project_vertex.replace(p,`if ( ! mpCollapsed ) mvPosition.xyz += mpOffset;
${p}`)),e.includes("#include <worldpos_vertex>")&&(e=e.replace("#include <worldpos_vertex>",t.worldpos_vertex.replace(l,`if ( ! mpCollapsed ) worldPosition.xyz += mpOffset;
	${l}`))),e}function W(e,n){const t=n.map(a=>a.fragmentPars||"").join(""),i=n.map(a=>a.fragmentDiscard||"").join("");return!t&&!i?e:(e=e.replace("#include <common>",`#include <common>
${P}${t}`),e.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
${i}`))}function M(e,n,{cacheKey:t}={}){const i=e.onBeforeCompile,a=Object.assign({},...n.map(o=>o.uniforms||{}));e.onBeforeCompile=(o,c)=>{i&&i!==f.prototype.onBeforeCompile&&i.call(e,o,c),Object.assign(o.uniforms,a),o.vertexShader=y(o.vertexShader,n),o.fragmentShader=W(o.fragmentShader,n)};const r=t||`mp:${n.map(o=>o.key).join("|")}`,s=e.customProgramCacheKey;return e.customProgramCacheKey=()=>`${s.call(e)}|${r}`,e.userData.patchUniforms=a,e.userData.patches=n,e.needsUpdate=!0,e}function T(e,n={}){const t=(e.userData.patches||[]).filter(a=>a.depth!==!1),i=new v({depthPacking:h,map:e.map||null,alphaMap:e.alphaMap||null,alphaTest:e.alphaTest||0,side:e.side,...n});return M(i,t)}export{P as G,M as a,F as c,O as d,T as m,$ as u,C as w};
