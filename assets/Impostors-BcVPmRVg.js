import{S as Ye,W as Xe}from"./three.module-Dt1S_jJM.js";import{F as Je}from"./Pass-CoGsOzd1.js";import{cX as Qe,n as Ze,U as et,L as tt,I as ot,ac as nt,ed as at,G as it,V,ar as rt,a as T,as as st,at as ct,l as We,dA as lt,df as me,dz as fe,i as Ie,S as _e,v as Fe,C as ut,D as Oe,z as mt,eY as ft,O as pt,b as pe,ah as Q,J as dt,em as vt,x as ht}from"./three.core-BG5Iv3B7.js";import{a as gt}from"./GBuffer-Dhsz133z.js";const G=new Float32Array(256);for(let e=0;e<256;e++){const t=e/255;G[e]=t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}const ge=new Uint8Array(4096);for(let e=0;e<4096;e++){const t=e/4095;ge[e]=Math.round(255*(t<=.0031308?t*12.92:1.055*Math.pow(t,1/2.4)-.055))}function xt(e,t,o,n,r,a,i=12){let s=0,c=0,u=0,l=0;const m=Math.min(t,o+r),w=n+a;for(let x=n;x<w;x++)for(let g=o;g<m;g++){const v=(x*t+g)*4;e[v+3]>127&&(s+=e[v],c+=e[v+1],u+=e[v+2],l++)}const y=l?s/l:60,d=l?c/l:75,_=l?u/l:40;for(let x=n;x<w;x++)for(let g=o;g<m;g++){const v=(x*t+g)*4;e[v+3]<i&&(e[v]=y,e[v+1]=d,e[v+2]=_,e[v+3]=0)}const f=t*4;for(let x=n+1;x<w-1;x++)for(let g=o+1;g<m-1;g++){const v=(x*t+g)*4;if(e[v+3]!==0)continue;let b=v-4;(e[b+3]>127||e[(b=v+4)+3]>127||e[(b=v-f)+3]>127||e[(b=v+f)+3]>127)&&(e[v]=e[b],e[v+1]=e[b+1],e[v+2]=e[b+2])}}function wt(e,t,o,n=128){let r=0,a=0;for(let i=o.y;i<o.y+o.h;i++)for(let s=o.x;s<o.x+o.w;s++)a++,e[(i*t+s)*4+3]>=n&&r++;return a?r/a:0}function Re(e,t,o,n=[],r=!0){const a=[{data:e,width:t,height:o}],i=n.map(w=>w.cov?wt(e,t,w):-1);let s=e,c=t,u=o,l=0;const m=new Uint32Array(256);for(;c>1||u>1;){const w=Math.max(1,c>>1),y=Math.max(1,u>>1),d=new Uint8Array(w*y*4);for(let f=0;f<y;f++){const x=Math.min(u-1,f*2),g=Math.min(u-1,f*2+1);for(let v=0;v<w;v++){const b=Math.min(c-1,v*2),M=Math.min(c-1,v*2+1),C=(x*c+b)*4,I=(x*c+M)*4,R=(g*c+b)*4,F=(g*c+M)*4,W=s[C+3],z=s[I+3],S=s[R+3],D=s[F+3],j=W+z+S+D,B=(f*w+v)*4;if(r)if(j>0)for(let h=0;h<3;h++)d[B+h]=ge[Math.min(4095,(G[s[C+h]]*W+G[s[I+h]]*z+G[s[R+h]]*S+G[s[F+h]]*D)/j*4095+.5|0)];else for(let h=0;h<3;h++)d[B+h]=ge[Math.min(4095,(G[s[C+h]]+G[s[I+h]]+G[s[R+h]]+G[s[F+h]])*.25*4095+.5|0)];else if(j>0)for(let h=0;h<3;h++)d[B+h]=(s[C+h]*W+s[I+h]*z+s[R+h]*S+s[F+h]*D)/j+.5;else for(let h=0;h<3;h++)d[B+h]=(s[C+h]+s[I+h]+s[R+h]+s[F+h])*.25+.5;d[B+3]=j+2>>2}}l++;const _=1<<l;n.forEach((f,x)=>{if(i[x]<0)return;const g=Math.floor(f.x/_),v=Math.floor(f.y/_),b=Math.min(w,Math.ceil((f.x+f.w)/_)),M=Math.min(y,Math.ceil((f.y+f.h)/_));if(b-g<2||M-v<2)return;m.fill(0);let C=0;for(let W=v;W<M;W++)for(let z=g;z<b;z++)m[d[(W*w+z)*4+3]]++,C++;let I=0,R=255;for(;R>1&&(I+=m[R],!(I/C>=i[x]));R--);const F=Math.min(6,Math.max(.6,127.5/R));if(!(Math.abs(F-1)<.02))for(let W=v;W<M;W++)for(let z=g;z<b;z++){const S=(W*w+z)*4+3;d[S]=Math.min(255,d[S]*F+.5)}}),a.push({data:d,width:w,height:y}),s=d,c=w,u=y}return a}function de(e,t){const o=e[0],n=new Qe(o.data,o.width,o.height,Ze,et);return n.mipmaps=e,n.generateMipmaps=!1,n.minFilter=tt,n.magFilter=ot,n.wrapS=n.wrapT=nt,n.colorSpace=t,n.flipY=!1,n.unpackAlignment=4,n.needsUpdate=!0,n}function yt(e,t,o,n,r,a){const i=[],s=t*4;for(let c=n+1;c<n+a-1;c++)for(let u=o+1;u<o+r-1;u++){const l=(c*t+u)*4;if(e[l+3]>0)continue;let m=l-4;(e[m+3]>0||e[(m=l+4)+3]>0||e[(m=l-s)+3]>0||e[(m=l+s)+3]>0)&&i.push(l,m)}for(let c=0;c<i.length;c+=2){const u=i[c],l=i[c+1];e[u]=e[l],e[u+1]=e[l+1],e[u+2]=e[l+2],e[u+3]=1}}const Be=`float mpIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
`,Mt=`float mpHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
`;function Jt(){return{uTime:{value:0},uViewPos:{value:new V(0,-1e6,0)}}}function Qt(e,t,o,n){e.uTime.value=Number.isFinite(n)?n:e.uTime.value+(t||0),o&&e.uViewPos&&e.uViewPos.value.copy(o)}function Zt(e,t={}){const o=t.direction||[.8,.6],n=Math.hypot(o[0],o[1])||1,r={value:new T(o[0]/n,o[1]/n,t.strength??1,t.frequency??1)},a={value:new T(1/(t.height??1),t.flutter??0,0,0)},i=t.weight??"height";let s="",c;if(i==="height")c="pow( clamp( position.y * uWindB.x, 0.0, 1.0 ), 2.0 )";else if(i.startsWith("attr:")){const[u,l]=i.slice(5).split(".");s=`attribute vec4 ${u};
`,c=`${u}.${l||"x"}`}else c=i;return{key:`wind(${i})`,uniforms:{uTime:e.uTime,uWind:r,uWindB:a},depth:!0,vertexPars:`uniform float uTime;
uniform vec4 uWind;
uniform vec4 uWindB;
${s}`,vertexBegin:`
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
`}}function eo(e,t={}){const o={value:new T(t.start??100,t.end??120,t.mode==="in"?1:0,0)};return{key:"dither",uniforms:{uViewPos:e.uViewPos,uFade:o},depth:!0,vertexPars:`uniform vec3 uViewPos;
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
`}}const Ct=`
float wxHash( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.x + p.y ) * p.z ); }
float wxNoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( wxHash( i ), wxHash( i + vec3( 1.0, 0.0, 0.0 ) ), f.x ), mix( wxHash( i + vec3( 0.0, 1.0, 0.0 ) ), wxHash( i + vec3( 1.0, 1.0, 0.0 ) ), f.x ), f.y ),
		mix( mix( wxHash( i + vec3( 0.0, 0.0, 1.0 ) ), wxHash( i + vec3( 1.0, 0.0, 1.0 ) ), f.x ), mix( wxHash( i + vec3( 0.0, 1.0, 1.0 ) ), wxHash( i + vec3( 1.0, 1.0, 1.0 ) ), f.x ), f.y ), f.z );
}
void wxWeather( inout vec3 col, inout float rough, vec3 p, vec3 n, float h, float pw, vec4 A, vec4 B, vec4 C, vec3 grimeCol, vec3 chipCol ) {
	float s = A.w, sd = C.w * 17.31;
	vec3 q = p * s;
	float m1 = wxNoise( q * 0.29 + sd ), m2 = wxNoise( q * 1.07 + sd + 11.7 );
	float m = 0.65 * m1 + 0.35 * m2;
	float wall = 1.0 - smoothstep( 0.55, 0.9, abs( n.y ) );
	// macro variation: value at two scales, a slight warm / cool drift, roughness
	col *= 1.0 + A.x * ( m - 0.5 ) * 2.0;
	col *= 1.0 + A.y * ( m2 - 0.5 ) * 2.0 * vec3( 1.0, 0.15, - 0.9 );
	rough += A.z * ( ( m2 - 0.5 ) * 1.4 + ( m1 - 0.5 ) * 0.8 );
	// mottling at hand scale (~30 cm), faded out where a pixel is over ~5 cm (it would only shimmer)
	float mot = 1.0 - smoothstep( 0.02, 0.06, pw );
	if ( mot > 0.0 ) col *= 1.0 + A.x * 0.45 * ( wxNoise( q * 3.3 + sd + 5.3 ) - 0.5 ) * 2.0 * mot;
	// sun fading: patchy, paler and greyer, more on the upper parts
	if ( C.x > 0.0 ) {
		float l = dot( col, vec3( 0.299, 0.587, 0.114 ) );
		float fd = C.x * smoothstep( 0.3, 0.75, m1 ) * ( 0.6 + 0.4 * smoothstep( 1.0, 8.0, h ) );
		col = mix( col, vec3( l ) * 1.05 + 0.015, fd );
	}
	// rain streaks on walls: columns of runs along the wall, broken up along their length
	if ( B.z > 0.0 && wall > 0.0 ) {
		vec2 t = normalize( vec2( - n.z, n.x ) + 1e-5 );
		float u = dot( p.xz, t ) * s, y = p.y * s * B.w;
		float c1 = wxNoise( vec3( u * 2.7, y * 0.6, sd + 3.1 ) ), c2 = wxNoise( vec3( u * 8.5, y * 1.9, sd + 7.9 ) );
		float gate = smoothstep( 0.4, 0.75, wxNoise( vec3( u * 0.42, y * 0.18, sd + 1.3 ) ) );
		float st = smoothstep( 0.52, 0.85, c1 * 0.68 + c2 * 0.42 ) * gate * wall * B.z;
		col *= mix( vec3( 1.0 ), grimeCol, st );
		rough += st * 0.08;
	}
	// grime rising from the ground (ragged top, patchy)
	if ( B.x > 0.0 && h < B.y * 1.45 ) {
		float e = wxNoise( vec3( p.x * s * 1.9, p.z * s * 1.9, sd + 5.0 ) );
		float g = 1.0 - smoothstep( 0.0, B.y * ( 0.5 + 0.9 * e ), h );
		g *= ( 0.7 + 0.6 * m1 ) * mix( 0.35, 1.0, wall );
		g = clamp( g * B.x, 0.0, 1.0 );
		col *= mix( vec3( 1.0 ), grimeCol, g );
		rough = mix( rough, 1.0, g * 0.4 );
	}
	// dust and dirt settled on up-facing faces (ledges, sills, tops)
	if ( C.z > 0.0 ) {
		float up = smoothstep( 0.6, 0.95, n.y ) * C.z * ( 0.45 + 0.8 * m2 );
		col = mix( col, col * grimeCol * 0.9, clamp( up, 0.0, 1.0 ) );
		rough = mix( rough, 1.0, up * 0.5 );
	}
	// chips: small spots where the paint is gone (only where a pixel is under ~2 cm)
	if ( C.y > 0.0 ) {
		float near = 1.0 - smoothstep( 0.006, 0.025, pw );
		if ( near > 0.0 ) {
			float c = wxNoise( q * 7.0 + sd + 2.0 ) * 0.62 + wxNoise( q * 23.0 + sd ) * 0.38;
			float th = 0.86 - 0.1 * C.y * m1;
			float chip = smoothstep( th, th + 0.015, c ) * near * min( 1.0, C.y * 1.5 );
			col = mix( col, chipCol, chip * 0.85 );
			rough = mix( rough, 0.95, chip );
		}
	}
	rough = clamp( rough, 0.04, 1.0 );
}
`,Te=Object.freeze({seed:0,scale:1,macro:.12,hue:.03,roughness:.1,grime:.35,grimeHeight:1,grimeColor:[.58,.53,.45],ground:0,streaks:.3,streakLength:3,fade:0,chips:0,chipColor:[.62,.6,.56],dust:.25});function At(e={}){const t={...Te,...e};return{uWxA:{value:new T(t.macro,t.hue,t.roughness,t.scale)},uWxB:{value:new T(t.grime,t.grimeHeight,t.streaks,1/Math.max(.1,t.streakLength))},uWxC:{value:new T(t.fade,t.chips,t.dust,t.seed%1e3)},uWxGrime:{value:new V(...t.grimeColor)},uWxChip:{value:new V(...t.chipColor)},uWxGround:{value:new We(t.ground==="origin"?0:t.ground,t.ground==="origin"?1:0)}}}function to(e={}){return{key:"weather",worldPosition:!0,uniforms:At(e),depth:!1,fragmentPars:`uniform vec4 uWxA;
uniform vec4 uWxB;
uniform vec4 uWxC;
uniform vec3 uWxGrime;
uniform vec3 uWxChip;
uniform vec2 uWxGround;
${Ct}`,fragmentSurface:`
	{
		vec3 wxN = normalize( ( vec4( nonPerturbedNormal, 0.0 ) * viewMatrix ).xyz );
		float wxH0 = mix( uWxGround.x, vMpOrigin.y, uWxGround.y );
		float wxR = 0.5;
	#if defined( STANDARD ) || defined( PHYSICAL )
		wxR = roughnessFactor;
	#endif
		wxWeather( diffuseColor.rgb, wxR, vMpWorld, wxN, vMpWorld.y - wxH0, length( fwidth( vMpWorld ) ), uWxA, uWxB, uWxC, uWxGrime, uWxChip );
	#if defined( STANDARD ) || defined( PHYSICAL )
		roughnessFactor = wxR;
	#endif
	}
`}}const Z=e=>e-Math.floor(e);function St(e,t,o){let n=Z(e*.1031),r=Z(t*.103),a=Z(o*.0973);const i=n*(r+33.33)+r*(n+33.33)+a*(a+33.33);return n+=i,r+=i,a+=i,Z((n+r)*a)}function U(e,t,o){const n=Math.floor(e),r=Math.floor(t),a=Math.floor(o);let i=e-n,s=t-r,c=o-a;i=i*i*(3-2*i),s=s*s*(3-2*s),c=c*c*(3-2*c);const u=(m,w,y)=>m+(w-m)*y,l=(m,w,y)=>St(n+m,r+w,a+y);return u(u(u(l(0,0,0),l(1,0,0),i),u(l(0,1,0),l(1,1,0),i),s),u(u(l(0,0,1),l(1,0,1),i),u(l(0,1,1),l(1,1,1),i),s),c)}const K=(e,t,o)=>{const n=Math.min(1,Math.max(0,(o-e)/(t-e)));return n*n*(3-2*n)};function bt(e,t,o,n){const r={...Te,...e},a=r.scale,i=r.seed%1e3*17.31,s=t[0]*a,c=t[1]*a,u=t[2]*a,l=U(s*.29+i,c*.29+i,u*.29+i),m=U(s*1.07+i+11.7,c*1.07+i+11.7,u*1.07+i+11.7),w=.65*l+.35*m,y=1-K(.55,.9,Math.abs(o[1])),d=1+r.macro*(w-.5)*2,_=r.hue*(m-.5)*2;let f=[d*(1+_),d*(1+_*.15),d*(1-_*.9)],x=r.roughness*((m-.5)*1.4+(l-.5)*.8);const g=r.grimeColor,v=M=>[1+(g[0]-1)*M,1+(g[1]-1)*M,1+(g[2]-1)*M],b=M=>{f=[f[0]*M[0],f[1]*M[1],f[2]*M[2]]};if(r.streaks>0&&y>0){let M=-o[2],C=o[0];const I=Math.hypot(M,C)||1;M/=I,C/=I;const R=(t[0]*M+t[2]*C)*a,F=t[1]*a/Math.max(.1,r.streakLength),W=U(R*2.7,F*.6,i+3.1),z=U(R*8.5,F*1.9,i+7.9),S=K(.52,.85,W*.68+z*.42)*K(.4,.75,U(R*.42,F*.18,i+1.3))*y*r.streaks;b(v(S)),x+=S*.08}if(r.grime>0){const M=U(t[0]*a*1.9,t[2]*a*1.9,i+5);let C=1-K(0,r.grimeHeight*(.5+.9*M),n);C=Math.min(1,Math.max(0,C*(.7+.6*l)*(.35+.65*y)*r.grime)),b(v(C)),x+=(1-x)*C*.4}if(r.dust>0){const M=Math.min(1,K(.6,.95,o[1])*r.dust*(.45+.8*m));f=f.map((C,I)=>C+(C*g[I]*.9-C)*M)}return{mul:f,rough:x}}function oo(e,t={},o=null){const n=e.attributes.position,r=e.attributes.normal;if(!n||!r)throw new Error("bakeWeathering: position and normal attributes required");let a=e.attributes.color;a||(a=new it(new Float32Array(n.count*3).fill(1),3),e.setAttribute("color",a));const i=t.ground==="origin"?o?new V().setFromMatrixPosition(o).y:0:t.ground??0,s=new V,c=new V,u=o?new rt().getNormalMatrix(o):null;for(let l=0;l<n.count;l++){s.fromBufferAttribute(n,l),c.fromBufferAttribute(r,l),o&&(s.applyMatrix4(o),c.applyMatrix3(u).normalize());const m=bt(t,[s.x,s.y,s.z],[c.x,c.y,c.z],s.y-i);a.setXYZ(l,a.getX(l)*m.mul[0],a.getY(l)*m.mul[1],a.getZ(l)*m.mul[2])}return a.needsUpdate=!0,e}const ve="mvPosition = modelViewMatrix * mvPosition;",ze="worldPosition = modelMatrix * worldPosition;";function Pt(e,t){const o=Ye,n=t.map(a=>a.vertexPars||"").join(""),r=t.map(a=>a.vertexBegin||"").join("");return e=e.replace("#include <common>",`#include <common>
${Mt}vec3 mpOffset;
vec3 mpInstancePos;
bool mpCollapsed;
${n}`),e=e.replace("#include <begin_vertex>",`#include <begin_vertex>
mpOffset = vec3( 0.0 );
mpCollapsed = false;
#ifdef USE_INSTANCING
	mpInstancePos = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
#else
	mpInstancePos = modelMatrix[ 3 ].xyz;
#endif
${r}`),o.project_vertex.includes(ve)||console.warn("[MaterialPatches] project_vertex anchor missing"),e=e.replace("#include <project_vertex>",o.project_vertex.replace(ve,`if ( ! mpCollapsed ) mvPosition.xyz += mpOffset;
${ve}`)),e.includes("#include <worldpos_vertex>")&&(e=e.replace("#include <worldpos_vertex>",o.worldpos_vertex.replace(ze,`if ( ! mpCollapsed ) worldPosition.xyz += mpOffset;
	${ze}`))),t.some(a=>a.worldPosition)&&(e=e.replace("#include <common>",`#include <common>
${De}`),e=e.replace(/(if \( ! mpCollapsed \) mvPosition\.xyz \+= mpOffset;\n)/,`$1${_t}`)),e}const De=`varying vec3 vMpWorld;
varying vec3 vMpOrigin;
`,_t=`vMpWorld = ( modelMatrix * vec4( mvPosition.xyz, 1.0 ) ).xyz;
vMpOrigin = mpInstancePos;
`;function Rt(e,t){const n=(t.some(i=>i.worldPosition)?De:"")+t.map(i=>i.fragmentPars||"").join(""),r=t.map(i=>i.fragmentDiscard||"").join(""),a=t.map(i=>i.fragmentSurface||"").join("");return!n&&!r&&!a?e:(e=e.replace("#include <common>",`#include <common>
${Be}${n}`),a&&(e.includes(he)||console.warn("[MaterialPatches] normal_fragment_maps anchor missing: surface patch skipped"),e=e.replace(he,`${he}
${a}`)),e.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
${r}`))}const he="#include <normal_fragment_maps>";function zt(e,t,{cacheKey:o}={}){const n=e.onBeforeCompile,r=Object.assign({},...t.map(s=>s.uniforms||{}));e.onBeforeCompile=(s,c)=>{n&&n!==at.prototype.onBeforeCompile&&n.call(e,s,c),Object.assign(s.uniforms,r),s.vertexShader=Pt(s.vertexShader,t),s.fragmentShader=Rt(s.fragmentShader,t)};const a=o||`mp:${t.map(s=>s.key).join("|")}`,i=e.customProgramCacheKey;return e.customProgramCacheKey=()=>`${i.call(e)}|${a}`,e.userData.patchUniforms=r,e.userData.patches=t,e.needsUpdate=!0,e}function no(e,t={}){const o=(e.userData.patches||[]).filter(r=>r.depth!==!1),n=new st({depthPacking:ct,map:e.map||null,alphaMap:e.alphaMap||null,alphaTest:e.alphaTest||0,side:e.side,...t});return zt(n,o)}const xe=[{el:10,n:8},{el:45,n:8},{el:80,n:4}];function Nt(e=xe){const t=[];for(const o of e)for(let n=0;n<o.n;n++)t.push({az:n/o.n*Math.PI*2,el:o.el});return t}const Wt=`
varying vec2 vUv; varying vec3 vN; varying vec3 vC;
void main() {
	vUv = uv; vN = normal;
#ifdef HAS_VCOLOR
	vC = color;
#else
	vC = vec3( 1.0 );
#endif
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Le=`
uniform sampler2D map;
uniform vec3 uTint;
uniform float uAlphaTest;
varying vec2 vUv; varying vec3 vN; varying vec3 vC;
vec4 bakeTexel() {
#ifdef HAS_MAP
	vec4 t = texture2D( map, vUv );
#else
	vec4 t = vec4( 1.0 );
#endif
	if ( t.a < uAlphaTest ) discard;
	return t;
}
`,It=Le+`
vec3 toSRGB( vec3 c ) { c = max( c, 0.0 ); return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
	vec4 t = bakeTexel();
#ifdef HAS_TINT
	t.rgb *= uTint;
#endif
	gl_FragColor = vec4( toSRGB( t.rgb * vC ), 1.0 );
}`,Ft=Le+`
void main() { vec4 t = bakeTexel(); gl_FragColor = vec4( normalize( vN ) * 0.5 + 0.5, 1.0 ); }`,Ot=`
void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,Bt=`
uniform sampler2D tSrc;
uniform vec3 uEmpty;
void main() {
	ivec2 o = ivec2( gl_FragCoord.xy ) * K;
	vec4 acc = vec4( 0.0 );
	for ( int j = 0; j < K; j ++ ) for ( int i = 0; i < K; i ++ ) { vec4 c = texelFetch( tSrc, o + ivec2( i, j ), 0 ); acc += vec4( c.rgb * c.a, c.a ); }
	gl_FragColor = acc.a > 0.0 ? vec4( acc.rgb / acc.a, acc.a / float( K * K ) ) : vec4( uEmpty, 0.0 );
}`,Ne=(e,t)=>new Fe({vertexShader:Ot,fragmentShader:Bt,defines:{K:e},uniforms:{tSrc:{value:null},uEmpty:{value:new V(t[0],t[1],t[2])}},depthTest:!1,depthWrite:!1,blending:ht});function Tt(e){const t=e&&e.isMesh?e:null,o=t?t.geometry:e.geometry||e.geo;o.boundingSphere||o.computeBoundingSphere();const n=t?Array.isArray(t.material)?t.material[0]:t.material:null;return{geo:o,center:e.center||o.boundingSphere.center,radius:e.radius||o.boundingSphere.radius,map:e.map!==void 0?e.map:n?n.map||null:void 0,color:e.color||n&&n.color||null}}function ao(e,t={}){if(typeof document>"u"||typeof WebGL2RenderingContext>"u")return null;const o=t.rings||xe,n=Nt(o),r=n.length,a=t.cellPx??170,i=t.texSize??2048,s=t.ss??2,c=t.cols??Math.floor(i/a),u=t.label||"impostors",l=t.name||"impostor",m=e.map(Tt),w=m.length*r,y=Math.ceil(w/c);if(y*a>i||c*a>i)throw new Error("impostor atlas too small");let d=null;const _=performance.now(),f=t.timing||{},x=(g,v)=>{f[g]=(f[g]||0)+(performance.now()-v)};try{const g=document.createElement("canvas");g.width=g.height=8,d=new Xe({canvas:g,antialias:!1,alpha:!0,powerPreference:"high-performance"}),d.setPixelRatio(1),x("context",_),d.autoClear=!1;const v=[],b=Array.isArray(t.map)?(v.push(de(t.map,_e)),v[0]):t.map||null,M=new Map,C=(p,A,N,P)=>new Fe({vertexShader:Wt,fragmentShader:p,vertexColors:N,side:Oe,uniforms:{map:{value:A},uTint:{value:new ut(P?P.r:1,P?P.g:1,P?P.b:1)},uAlphaTest:{value:t.alphaTest??.5}},defines:Object.assign({},A?{HAS_MAP:""}:{},N?{HAS_VCOLOR:""}:{},P&&(P.r!==1||P.g!==1||P.b!==1)?{HAS_TINT:""}:{})}),I=p=>{const A=p.map===void 0?b:p.map||b,N=!!p.geo.getAttribute("color"),P=`${A?A.uuid:"-"}|${N}|${p.color?p.color.getHexString():"-"}`;let L=M.get(P);return L||(L=[C(It,A,N,p.color),C(Ft,A,N,p.color)],M.set(P,L)),L},R=m.map(p=>{const A=new mt;for(const N of["position","normal","uv","color"])p.geo.getAttribute(N)&&A.setAttribute(N,p.geo.getAttribute(N));return A.setIndex(p.geo.getIndex()),A.getAttribute("normal")||A.computeVertexNormals(),A}),F=m.map(I),W=new ft,z=new Ie(R[0],F[0][0]);z.frustumCulled=!1,W.add(z);const S=new pt(-1,1,1,-1,.1,100),D=a*s,j=c*D,B=new pe(j,D,{depthBuffer:!0,generateMipmaps:!1,minFilter:Q,magFilter:Q}),h=i,Ee=y*a;let H=1;for(;H<Ee;)H<<=1;H>i&&(H=i);const X=h>>1,we=H>>1,k=t.normals!==!1,ee=new Uint8Array(h*H*4),te=k?new Uint8Array(X*we*4):null,O=a>>1,ye={depthBuffer:!1,generateMipmaps:!1,minFilter:Q,magFilter:Q},Me=new pe(c*a,a,ye),oe=k?new pe(c*O,O,ye):null,$e=new Uint8Array(c*a*a*4),Ge=k?new Uint8Array(c*O*O*4):null,ne=Ne(s,[0,0,0]),ae=k?Ne(s*2,[.5,1,.5]):null,ie=new Je(ne);d.setClearColor(0,0);for(let p=0;p<(k?2:1);p++){const A=p===0?Me:oe,N=p===0?$e:Ge,P=p===0?ne:ae,L=p===0?a:O,He=p===0?ee:te,Ve=p===0?h:X,se=c*L;for(let q=0;q<y;q++){const ke=performance.now();B.viewport.set(0,0,j,D),d.setRenderTarget(B),d.clear(!0,!0,!1);for(let E=0;E<c;E++){const ce=q*c+E;if(ce>=w)break;const le=Math.floor(ce/r),{az:be,el:Ke}=n[ce%r],Pe=m[le];z.geometry=R[le],z.material=F[le][p];const $=Pe.radius,J=Pe.center,ue=Ke*Math.PI/180;S.left=-$,S.right=$,S.top=$,S.bottom=-$,S.near=$*.5,S.far=$*6,S.position.set(J.x+Math.sin(be)*Math.cos(ue)*$*3,J.y+Math.sin(ue)*$*3,J.z+Math.cos(be)*Math.cos(ue)*$*3),S.up.set(0,1,0),S.lookAt(J),S.updateProjectionMatrix(),B.viewport.set(E*D,0,D,D),d.setRenderTarget(B),d.render(W,S)}P.uniforms.tSrc.value=B.texture,ie.material=P,d.setRenderTarget(A),ie.render(d),d.readRenderTargetPixels(A,0,0,se,L,N),x("render",ke);const Ue=performance.now(),qe=Math.min(c,w-q*c)*L*4;for(let E=0;E<L;E++)He.set(N.subarray(E*se*4,E*se*4+qe),(q*L+E)*Ve*4);x("downsample",Ue)}}const je=performance.now(),Ce=[],Ae=[];for(let p=0;p<w;p++){const A=p%c,N=Math.floor(p/c);if(xt(ee,h,A*a,N*a,a,a,8),k)for(let P=0;P<2;P++)yt(te,X,A*O,N*O,O,O);Ce.push({x:A*a,y:N*a,w:a,h:a,cov:!0}),Ae.push({x:A*O,y:N*O,w:O,h:O,cov:!1})}const Se=de(Re(ee,h,H,Ce,!0),_e),re=k?de(Re(te,X,we,Ae,!1),dt):null;Se.name=`${l}Albedo`,re&&(re.name=`${l}Normal`),x("post",je),B.dispose(),Me.dispose(),oe&&oe.dispose(),ne.dispose(),ae&&ae.dispose(),ie.dispose();for(const p of M.values())p.forEach(A=>A.dispose());return R.forEach(p=>p.dispose()),v.forEach(p=>p.dispose()),x("total",_),console.info(`[${u}] impostors baked: ${w} views in ${Math.round(performance.now()-_)} ms (context ${Math.round(f.context)}, render ${Math.round(f.render)}, downsample ${Math.round(f.downsample)}, post ${Math.round(f.post)})`),{albedo:Se,normal:re,layout:{cols:c,cellU:a/h,cellV:a/H,pad:1.5/a,views:r,rings:o.map(p=>({el:p.el,n:p.n}))},models:m.map(p=>({cx:p.center.x,cy:p.center.y,cz:p.center.z,r:p.radius}))}}catch(g){return console.warn(`[${u}] impostor bake failed${t.failNote||""}`,g),null}finally{d&&(d.dispose(),d.forceContextLoss())}}const Y=4,Dt=`
uniform vec3 uViewPos;
uniform vec4 uFade;                    // x fade-in start, y fade-in end (end <= start: always visible)
uniform vec4 uModels[ IMP_MODELS ];    // local bounding sphere centre xyz, radius
uniform vec4 uAtlas;                   // columns, cell width (uv), cell height (uv), inner padding (cell fraction)
uniform vec4 uRings[ ${Y} ];   // elevation (deg), views in ring, first view index, -
uniform vec2 uRingInfo;                // ring count, views per model
attribute vec4 iPos;                   // x, base y, z, yaw
attribute vec4 iScl;                   // horizontal scale, vertical scale, model index, -
#ifdef IMP_COLOR
attribute vec3 iColor;
varying vec3 vIColor;
#endif
varying float vFade;
varying vec2 vQ;
varying vec4 vCA;
varying vec4 vCB;
varying vec3 vW;
varying vec2 vYaw;
vec3 impC; vec3 impR; vec3 impU; float impRw; float impRh;
vec2 impCell( float m, float view ) {
	float idx = m * uRingInfo.y + view;
	float col = mod( idx, uAtlas.x ), r = floor( idx / uAtlas.x );
	return vec2( col * uAtlas.y, r * uAtlas.z );
}
`,Lt=`
{
	float m = floor( iScl.z + 0.5 );
	vec4 S = uModels[ int( m ) ];
	float cy = cos( iPos.w ), sy = sin( iPos.w );
	vYaw = vec2( cy, sy );
	impC = iPos.xyz + vec3( S.x * cy + S.z * sy, S.y, - S.x * sy + S.z * cy ) * vec3( iScl.x, iScl.y, iScl.x );
	vec3 toCam = uViewPos - impC;
	float dist = length( toCam );
	vec3 f = toCam / max( dist, 1e-3 );
	impR = cross( vec3( 0.0, 1.0, 0.0 ), f );
	float rl = length( impR );
	impR = rl > 1e-4 ? impR / rl : vec3( 1.0, 0.0, 0.0 );
	impU = cross( f, impR );
	impRw = S.w * iScl.x; impRh = S.w * iScl.y;
	vFade = uFade.y > uFade.x ? smoothstep( uFade.x, uFade.y, dist ) : 1.0;
#ifdef IMP_COLOR
	vIColor = iColor;
#endif
	vQ = position.xy * 0.5 + 0.5;
	// view direction in the model's local frame -> two baked cells in each of the two nearest elevation rings
	vec3 fl = vec3( f.x * cy - f.z * sy, f.y, f.x * sy + f.z * cy );
	float az = fract( atan( fl.x, fl.z ) / 6.2831853 );
	float el = degrees( asin( clamp( fl.y, -1.0, 1.0 ) ) );
	int nr = int( uRingInfo.x + 0.5 );
	int r0 = 0;
	for ( int i = 1; i < ${Y}; i ++ ) if ( i < nr && el >= uRings[ i ].x ) r0 = i;
	int r1 = min( r0 + 1, nr - 1 );
	vec4 R0 = uRings[ r0 ], R1 = uRings[ r1 ];
	float we = r1 == r0 ? 0.0 : clamp( ( el - R0.x ) / ( R1.x - R0.x ), 0.0, 1.0 );
	float a = az * R0.y, a0 = floor( a ), wa = a - a0;
	float b = az * R1.y, b0 = floor( b ), wb = b - b0;
	vCA = vec4( impCell( m, R0.z + a0 ), impCell( m, R0.z + mod( a0 + 1.0, R0.y ) ) );
	vCB = vec4( impCell( m, R1.z + b0 ), impCell( m, R1.z + mod( b0 + 1.0, R1.y ) ) );
	vW = vec3( wa, wb, we );
}
vec3 objectNormal = normalize( uViewPos - impC );
`,Et=`
vec3 transformed = impC + impR * position.x * impRw + impU * position.y * impRh;
if ( vFade <= 0.0 ) transformed = impC;
`,$t=`
vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
gl_Position = projectionMatrix * mvPosition;
`+gt,Gt=`
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
#endif
`,jt=`
uniform sampler2D uNormalAtlas;
uniform vec4 uAtlas;
varying float vFade;
varying vec2 vQ;
varying vec4 vCA;
varying vec4 vCB;
varying vec3 vW;
varying vec2 vYaw;
#ifdef IMP_COLOR
varying vec3 vIColor;
#endif
vec4 iNrm;
`+Be,Ht=`
if ( vFade < 0.999 && mpIGN( gl_FragCoord.xy ) <= 1.0 - vFade ) discard;
`,Vt=`
vec2 iq = uAtlas.w + vQ * ( 1.0 - 2.0 * uAtlas.w );
vec2 ics = uAtlas.yz;
vec4 iA = mix( texture2D( map, vCA.xy + iq * ics ), texture2D( map, vCA.zw + iq * ics ), vW.x );
vec4 iB = mix( texture2D( map, vCB.xy + iq * ics ), texture2D( map, vCB.zw + iq * ics ), vW.y );
diffuseColor *= mix( iA, iB, vW.z );
#ifdef IMP_COLOR
diffuseColor.rgb *= vIColor;
#endif
#ifdef IMP_NORMALS
vec4 nA = mix( texture2D( uNormalAtlas, vCA.xy + iq * ics ), texture2D( uNormalAtlas, vCA.zw + iq * ics ), vW.x );
vec4 nB = mix( texture2D( uNormalAtlas, vCB.xy + iq * ics ), texture2D( uNormalAtlas, vCB.zw + iq * ics ), vW.y );
iNrm = mix( nA, nB, vW.z );
#endif
`,kt=`
float faceDirection = 1.0;
#ifdef IMP_NORMALS
vec3 nObj = iNrm.xyz * 2.0 - 1.0;
nObj = length( nObj ) > 0.05 ? normalize( nObj ) : vec3( 0.0, 1.0, 0.0 );
vec3 nW = vec3( vYaw.x * nObj.x + vYaw.y * nObj.z, nObj.y, - vYaw.y * nObj.x + vYaw.x * nObj.z );
vec3 normal = normalize( ( viewMatrix * vec4( nW, 0.0 ) ).xyz );
#else
vec3 normal = normalize( vNormal );
#endif
vec3 nonPerturbedNormal = normal;
`;function Ut(e,t={}){const o=e.layout,n=o.rings||xe;if(n.length>Y)throw new Error(`impostors: at most ${Y} elevation rings`);const r=Math.max(1,e.models.length),a=t.viewPos||{value:new V},i={value:new T(t.fade?t.fade.start:0,t.fade?t.fade.end:0,0,0)},s={value:Array.from({length:r},(d,_)=>{const f=e.models[_];return f?new T(f.cx,f.cy,f.cz,f.r):new T(0,0,0,1)})},c={value:new T(o.cols,o.cellU,o.cellV,o.pad)};let u=0;const l={value:Array.from({length:Y},(d,_)=>{const f=n[_],x=f?new T(f.el,f.n,u,0):new T(90,1,0,0);return f&&(u+=f.n),x})},m={value:new We(n.length,u)},w={value:e.normal},y=new vt({map:e.albedo,roughness:t.roughness??.85,metalness:t.metalness??0,alphaTest:t.alphaTest??.5,alphaToCoverage:t.alphaToCoverage??!0,side:Oe,envMapIntensity:t.envMapIntensity??.9});return y.defines=Object.assign({IMP_MODELS:r},e.normal?{IMP_NORMALS:""}:{},t.color?{IMP_COLOR:""}:{}),y.onBeforeCompile=d=>{Object.assign(d.uniforms,{uViewPos:a,uFade:i,uModels:s,uAtlas:c,uRings:l,uRingInfo:m,uNormalAtlas:w}),d.vertexShader=d.vertexShader.replace("#include <common>",`#include <common>
`+Dt).replace("#include <beginnormal_vertex>",Lt).replace("#include <begin_vertex>",Et).replace("#include <project_vertex>",$t).replace("#include <worldpos_vertex>",Gt),d.fragmentShader=d.fragmentShader.replace("#include <common>",`#include <common>
`+jt).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
`+Ht).replace("#include <map_fragment>",Vt).replace("#include <normal_fragment_begin>",kt)},y.customProgramCacheKey=()=>`engine-impostor-v1|${r}|${!!e.normal}|${!!t.color}`,y.userData.uViewPos=a,y.userData.uFade=i,y}class io{constructor(t,o={}){const n=this.capacity=Math.max(1,o.capacity??1024),r=new lt;r.setAttribute("position",new me([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3)),r.setAttribute("normal",new me([0,0,1,0,0,1,0,0,1,0,0,1],3)),r.setAttribute("uv",new me([0,0,1,0,1,1,0,1],2)),r.setIndex([0,1,2,0,2,3]),this.iPos=new fe(new Float32Array(n*4),4),this.iScl=new fe(new Float32Array(n*4),4),r.setAttribute("iPos",this.iPos),r.setAttribute("iScl",this.iScl),o.color&&(this.iColor=new fe(new Float32Array(n*3).fill(1),3),r.setAttribute("iColor",this.iColor)),r.instanceCount=0,this.geometry=r,this.material=o.material||Ut(t,o),this.mesh=new Ie(r,this.material),this.mesh.frustumCulled=!1,this.mesh.castShadow=!1,this.mesh.receiveShadow=!0,this.mesh.name=o.name||"impostors",this._count=0}get count(){return this._count}set count(t){this._count=Math.max(0,Math.min(this.capacity,t|0)),this.geometry.instanceCount=this._count}setInstance(t,o,n,r,a=0,i=1,s=i,c=0){const u=this.iPos.array,l=this.iScl.array,m=t*4;u[m]=o,u[m+1]=n,u[m+2]=r,u[m+3]=a,l[m]=i,l[m+1]=s,l[m+2]=c,l[m+3]=0,this.iPos.needsUpdate=!0,this.iScl.needsUpdate=!0,t>=this._count&&(this.count=t+1)}setColor(t,o,n,r){if(!this.iColor)return;const a=this.iColor.array,i=t*3;a[i]=o,a[i+1]=n,a[i+2]=r,this.iColor.needsUpdate=!0}update(t){this.material.userData.uViewPos.value.copy(t)}dispose(){this.geometry.dispose(),this.material.dispose()}}export{xe as D,Ct as G,io as I,Te as W,zt as a,ao as b,Re as c,de as d,Mt as e,xt as f,Be as g,oo as h,Nt as i,Ut as j,Jt as k,yt as l,eo as m,no as n,bt as o,At as p,Zt as q,Qt as u,to as w};
