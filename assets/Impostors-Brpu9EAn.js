import{D as Ve,R as Ue,ah as Ge,a9 as ke,z as He,C as Ke,p as L,ai as qe,$ as Ye,a0 as Qe,V as pe,a6 as Xe,aj as Je,u as Ce,S as be,f as Ze,m as Re,l as et,ak as tt,g as Ie,al as nt,W as se,N as Y,K as ot,I as at,c as ce,a2 as le,X as it,a as rt,o as st}from"./three.module-C8-88sYI.js";import{F as ct,H as lt}from"./LoadingScreen-D-xrkYm6.js";const E=new Float32Array(256);for(let e=0;e<256;e++){const t=e/255;E[e]=t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}const fe=new Uint8Array(4096);for(let e=0;e<4096;e++){const t=e/4095;fe[e]=Math.round(255*(t<=.0031308?t*12.92:1.055*Math.pow(t,1/2.4)-.055))}function ut(e,t,n,o,s,i,l=12){let a=0,r=0,v=0,d=0;const h=Math.min(t,n+s),x=o+i;for(let w=o;w<x;w++)for(let g=n;g<h;g++){const f=(w*t+g)*4;e[f+3]>127&&(a+=e[f],r+=e[f+1],v+=e[f+2],d++)}const A=d?a/d:60,m=d?r/d:75,b=d?v/d:40;for(let w=o;w<x;w++)for(let g=n;g<h;g++){const f=(w*t+g)*4;e[f+3]<l&&(e[f]=A,e[f+1]=m,e[f+2]=b,e[f+3]=0)}const p=t*4;for(let w=o+1;w<x-1;w++)for(let g=n+1;g<h-1;g++){const f=(w*t+g)*4;if(e[f+3]!==0)continue;let P=f-4;(e[P+3]>127||e[(P=f+4)+3]>127||e[(P=f-p)+3]>127||e[(P=f+p)+3]>127)&&(e[f]=e[P],e[f+1]=e[P+1],e[f+2]=e[P+2])}}function mt(e,t,n,o=128){let s=0,i=0;for(let l=n.y;l<n.y+n.h;l++)for(let a=n.x;a<n.x+n.w;a++)i++,e[(l*t+a)*4+3]>=o&&s++;return i?s/i:0}function Se(e,t,n,o=[],s=!0){const i=[{data:e,width:t,height:n}],l=o.map(x=>x.cov?mt(e,t,x):-1);let a=e,r=t,v=n,d=0;const h=new Uint32Array(256);for(;r>1||v>1;){const x=Math.max(1,r>>1),A=Math.max(1,v>>1),m=new Uint8Array(x*A*4);for(let p=0;p<A;p++){const w=Math.min(v-1,p*2),g=Math.min(v-1,p*2+1);for(let f=0;f<x;f++){const P=Math.min(r-1,f*2),T=Math.min(r-1,f*2+1),N=(w*r+P)*4,B=(w*r+T)*4,R=(g*r+P)*4,z=(g*r+T)*4,I=a[N+3],_=a[B+3],C=a[R+3],D=a[z+3],V=I+_+C+D,O=(p*x+f)*4;if(s)if(V>0)for(let u=0;u<3;u++)m[O+u]=fe[Math.min(4095,(E[a[N+u]]*I+E[a[B+u]]*_+E[a[R+u]]*C+E[a[z+u]]*D)/V*4095+.5|0)];else for(let u=0;u<3;u++)m[O+u]=fe[Math.min(4095,(E[a[N+u]]+E[a[B+u]]+E[a[R+u]]+E[a[z+u]])*.25*4095+.5|0)];else if(V>0)for(let u=0;u<3;u++)m[O+u]=(a[N+u]*I+a[B+u]*_+a[R+u]*C+a[z+u]*D)/V+.5;else for(let u=0;u<3;u++)m[O+u]=(a[N+u]+a[B+u]+a[R+u]+a[z+u])*.25+.5;m[O+3]=V+2>>2}}d++;const b=1<<d;o.forEach((p,w)=>{if(l[w]<0)return;const g=Math.floor(p.x/b),f=Math.floor(p.y/b),P=Math.min(x,Math.ceil((p.x+p.w)/b)),T=Math.min(A,Math.ceil((p.y+p.h)/b));if(P-g<2||T-f<2)return;h.fill(0);let N=0;for(let I=f;I<T;I++)for(let _=g;_<P;_++)h[m[(I*x+_)*4+3]]++,N++;let B=0,R=255;for(;R>1&&(B+=h[R],!(B/N>=l[w]));R--);const z=Math.min(6,Math.max(.6,127.5/R));if(!(Math.abs(z-1)<.02))for(let I=f;I<T;I++)for(let _=g;_<P;_++){const C=(I*x+_)*4+3;m[C]=Math.min(255,m[C]*z+.5)}}),i.push({data:m,width:x,height:A}),a=m,r=x,v=A}return i}function ue(e,t){const n=e[0],o=new Ve(n.data,n.width,n.height,Ue,Ge);return o.mipmaps=e,o.generateMipmaps=!1,o.minFilter=ke,o.magFilter=He,o.wrapS=o.wrapT=Ke,o.colorSpace=t,o.flipY=!1,o.unpackAlignment=4,o.needsUpdate=!0,o}function ft(e,t,n,o,s,i){const l=[],a=t*4;for(let r=o+1;r<o+i-1;r++)for(let v=n+1;v<n+s-1;v++){const d=(r*t+v)*4;if(e[d+3]>0)continue;let h=d-4;(e[h+3]>0||e[(h=d+4)+3]>0||e[(h=d-a)+3]>0||e[(h=d+a)+3]>0)&&l.push(d,h)}for(let r=0;r<l.length;r+=2){const v=l[r],d=l[r+1];e[v]=e[d],e[v+1]=e[d+1],e[v+2]=e[d+2],e[v+3]=1}}const Fe=`float mpIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
`,pt=`float mpHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
`;function Dt(){return{uTime:{value:0},uViewPos:{value:new pe(0,-1e6,0)}}}function Wt(e,t,n,o){e.uTime.value=Number.isFinite(o)?o:e.uTime.value+(t||0),n&&e.uViewPos&&e.uViewPos.value.copy(n)}function $t(e,t={}){const n=t.direction||[.8,.6],o=Math.hypot(n[0],n[1])||1,s={value:new L(n[0]/o,n[1]/o,t.strength??1,t.frequency??1)},i={value:new L(1/(t.height??1),t.flutter??0,0,0)},l=t.weight??"height";let a="",r;if(l==="height")r="pow( clamp( position.y * uWindB.x, 0.0, 1.0 ), 2.0 )";else if(l.startsWith("attr:")){const[v,d]=l.slice(5).split(".");a=`attribute vec4 ${v};
`,r=`${v}.${d||"x"}`}else r=l;return{key:`wind(${l})`,uniforms:{uTime:e.uTime,uWind:s,uWindB:i},depth:!0,vertexPars:`uniform float uTime;
uniform vec4 uWind;
uniform vec4 uWindB;
${a}`,vertexBegin:`
	{
		float mpW = ${r};
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
`}}function jt(e,t={}){const n={value:new L(t.start??100,t.end??120,t.mode==="in"?1:0,0)};return{key:"dither",uniforms:{uViewPos:e.uViewPos,uFade:n},depth:!0,vertexPars:`uniform vec3 uViewPos;
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
`}}const me="mvPosition = modelViewMatrix * mvPosition;",Pe="worldPosition = modelMatrix * worldPosition;";function dt(e,t){const n=Xe,o=t.map(i=>i.vertexPars||"").join(""),s=t.map(i=>i.vertexBegin||"").join("");return e=e.replace("#include <common>",`#include <common>
${pt}vec3 mpOffset;
vec3 mpInstancePos;
bool mpCollapsed;
${o}`),e=e.replace("#include <begin_vertex>",`#include <begin_vertex>
mpOffset = vec3( 0.0 );
mpCollapsed = false;
#ifdef USE_INSTANCING
	mpInstancePos = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
#else
	mpInstancePos = modelMatrix[ 3 ].xyz;
#endif
${s}`),n.project_vertex.includes(me)||console.warn("[MaterialPatches] project_vertex anchor missing"),e=e.replace("#include <project_vertex>",n.project_vertex.replace(me,`if ( ! mpCollapsed ) mvPosition.xyz += mpOffset;
${me}`)),e.includes("#include <worldpos_vertex>")&&(e=e.replace("#include <worldpos_vertex>",n.worldpos_vertex.replace(Pe,`if ( ! mpCollapsed ) worldPosition.xyz += mpOffset;
	${Pe}`))),e}function vt(e,t){const n=t.map(s=>s.fragmentPars||"").join(""),o=t.map(s=>s.fragmentDiscard||"").join("");return!n&&!o?e:(e=e.replace("#include <common>",`#include <common>
${Fe}${n}`),e.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
${o}`))}function ht(e,t,{cacheKey:n}={}){const o=e.onBeforeCompile,s=Object.assign({},...t.map(a=>a.uniforms||{}));e.onBeforeCompile=(a,r)=>{o&&o!==qe.prototype.onBeforeCompile&&o.call(e,a,r),Object.assign(a.uniforms,s),a.vertexShader=dt(a.vertexShader,t),a.fragmentShader=vt(a.fragmentShader,t)};const i=n||`mp:${t.map(a=>a.key).join("|")}`,l=e.customProgramCacheKey;return e.customProgramCacheKey=()=>`${l.call(e)}|${i}`,e.userData.patchUniforms=s,e.userData.patches=t,e.needsUpdate=!0,e}function Et(e,t={}){const n=(e.userData.patches||[]).filter(s=>s.depth!==!1),o=new Ye({depthPacking:Qe,map:e.map||null,alphaMap:e.alphaMap||null,alphaTest:e.alphaTest||0,side:e.side,...t});return ht(o,n)}const de=[{el:10,n:8},{el:45,n:8},{el:80,n:4}];function gt(e=de){const t=[];for(const n of e)for(let o=0;o<n.n;o++)t.push({az:o/n.n*Math.PI*2,el:n.el});return t}const wt=`
varying vec2 vUv; varying vec3 vN; varying vec3 vC;
void main() {
	vUv = uv; vN = normal;
#ifdef HAS_VCOLOR
	vC = color;
#else
	vC = vec3( 1.0 );
#endif
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Oe=`
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
`,xt=Oe+`
vec3 toSRGB( vec3 c ) { c = max( c, 0.0 ); return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
	vec4 t = bakeTexel();
#ifdef HAS_TINT
	t.rgb *= uTint;
#endif
	gl_FragColor = vec4( toSRGB( t.rgb * vC ), 1.0 );
}`,yt=Oe+`
void main() { vec4 t = bakeTexel(); gl_FragColor = vec4( normalize( vN ) * 0.5 + 0.5, 1.0 ); }`,Mt=`
void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,At=`
uniform sampler2D tSrc;
uniform vec3 uEmpty;
void main() {
	ivec2 o = ivec2( gl_FragCoord.xy ) * K;
	vec4 acc = vec4( 0.0 );
	for ( int j = 0; j < K; j ++ ) for ( int i = 0; i < K; i ++ ) { vec4 c = texelFetch( tSrc, o + ivec2( i, j ), 0 ); acc += vec4( c.rgb * c.a, c.a ); }
	gl_FragColor = acc.a > 0.0 ? vec4( acc.rgb / acc.a, acc.a / float( K * K ) ) : vec4( uEmpty, 0.0 );
}`,_e=(e,t)=>new be({vertexShader:Mt,fragmentShader:At,defines:{K:e},uniforms:{tSrc:{value:null},uEmpty:{value:new pe(t[0],t[1],t[2])}},depthTest:!1,depthWrite:!1,blending:it});function Ct(e){const t=e&&e.isMesh?e:null,n=t?t.geometry:e.geometry||e.geo;n.boundingSphere||n.computeBoundingSphere();const o=t?Array.isArray(t.material)?t.material[0]:t.material:null;return{geo:n,center:e.center||n.boundingSphere.center,radius:e.radius||n.boundingSphere.radius,map:e.map!==void 0?e.map:o?o.map||null:void 0,color:e.color||o&&o.color||null}}function Lt(e,t={}){if(typeof document>"u"||typeof WebGL2RenderingContext>"u")return null;const n=t.rings||de,o=gt(n),s=o.length,i=t.cellPx??170,l=t.texSize??2048,a=t.ss??2,r=t.cols??Math.floor(l/i),v=t.label||"impostors",d=t.name||"impostor",h=e.map(Ct),x=h.length*s,A=Math.ceil(x/r);if(A*i>l||r*i>l)throw new Error("impostor atlas too small");let m=null;const b=performance.now(),p=t.timing||{},w=(g,f)=>{p[g]=(p[g]||0)+(performance.now()-f)};try{const g=document.createElement("canvas");g.width=g.height=8,m=new Je({canvas:g,antialias:!1,alpha:!0,powerPreference:"high-performance"}),m.setPixelRatio(1),w("context",b),m.autoClear=!1;const f=[],P=Array.isArray(t.map)?(f.push(ue(t.map,Ce)),f[0]):t.map||null,T=new Map,N=(c,y,S,M)=>new be({vertexShader:wt,fragmentShader:c,vertexColors:S,side:Re,uniforms:{map:{value:y},uTint:{value:new Ze(M?M.r:1,M?M.g:1,M?M.b:1)},uAlphaTest:{value:t.alphaTest??.5}},defines:Object.assign({},y?{HAS_MAP:""}:{},S?{HAS_VCOLOR:""}:{},M&&(M.r!==1||M.g!==1||M.b!==1)?{HAS_TINT:""}:{})}),B=c=>{const y=c.map===void 0?P:c.map||P,S=!!c.geo.getAttribute("color"),M=`${y?y.uuid:"-"}|${S}|${c.color?c.color.getHexString():"-"}`;let W=T.get(M);return W||(W=[N(xt,y,S,c.color),N(yt,y,S,c.color)],T.set(M,W)),W},R=h.map(c=>{const y=new et;for(const S of["position","normal","uv","color"])c.geo.getAttribute(S)&&y.setAttribute(S,c.geo.getAttribute(S));return y.setIndex(c.geo.getIndex()),y.getAttribute("normal")||y.computeVertexNormals(),y}),z=h.map(B),I=new tt,_=new Ie(R[0],z[0][0]);_.frustumCulled=!1,I.add(_);const C=new nt(-1,1,1,-1,.1,100),D=i*a,V=r*D,O=new se(V,D,{depthBuffer:!0,generateMipmaps:!1,minFilter:Y,magFilter:Y}),u=l,Ne=A*i;let U=1;for(;U<Ne;)U<<=1;U>l&&(U=l);const K=u>>1,ve=U>>1,G=t.normals!==!1,Q=new Uint8Array(u*U*4),X=G?new Uint8Array(K*ve*4):null,F=i>>1,he={depthBuffer:!1,generateMipmaps:!1,minFilter:Y,magFilter:Y},ge=new se(r*i,i,he),J=G?new se(r*F,F,he):null,ze=new Uint8Array(r*i*i*4),Te=G?new Uint8Array(r*F*F*4):null,Z=_e(a,[0,0,0]),ee=G?_e(a*2,[.5,1,.5]):null,te=new ct(Z);m.setClearColor(0,0);for(let c=0;c<(G?2:1);c++){const y=c===0?ge:J,S=c===0?ze:Te,M=c===0?Z:ee,W=c===0?i:F,De=c===0?Q:X,We=c===0?u:K,oe=r*W;for(let k=0;k<A;k++){const $e=performance.now();O.viewport.set(0,0,V,D),m.setRenderTarget(O),m.clear(!0,!0,!1);for(let $=0;$<r;$++){const ae=k*r+$;if(ae>=x)break;const ie=Math.floor(ae/s),{az:Me,el:Le}=o[ae%s],Ae=h[ie];_.geometry=R[ie],_.material=z[ie][c];const j=Ae.radius,q=Ae.center,re=Le*Math.PI/180;C.left=-j,C.right=j,C.top=j,C.bottom=-j,C.near=j*.5,C.far=j*6,C.position.set(q.x+Math.sin(Me)*Math.cos(re)*j*3,q.y+Math.sin(re)*j*3,q.z+Math.cos(Me)*Math.cos(re)*j*3),C.up.set(0,1,0),C.lookAt(q),C.updateProjectionMatrix(),O.viewport.set($*D,0,D,D),m.setRenderTarget(O),m.render(I,C)}M.uniforms.tSrc.value=O.texture,te.material=M,m.setRenderTarget(y),te.render(m),m.readRenderTargetPixels(y,0,0,oe,W,S),w("render",$e);const je=performance.now(),Ee=Math.min(r,x-k*r)*W*4;for(let $=0;$<W;$++)De.set(S.subarray($*oe*4,$*oe*4+Ee),(k*W+$)*We*4);w("downsample",je)}}const Be=performance.now(),we=[],xe=[];for(let c=0;c<x;c++){const y=c%r,S=Math.floor(c/r);if(ut(Q,u,y*i,S*i,i,i,8),G)for(let M=0;M<2;M++)ft(X,K,y*F,S*F,F,F);we.push({x:y*i,y:S*i,w:i,h:i,cov:!0}),xe.push({x:y*F,y:S*F,w:F,h:F,cov:!1})}const ye=ue(Se(Q,u,U,we,!0),Ce),ne=G?ue(Se(X,K,ve,xe,!1),ot):null;ye.name=`${d}Albedo`,ne&&(ne.name=`${d}Normal`),w("post",Be),O.dispose(),ge.dispose(),J&&J.dispose(),Z.dispose(),ee&&ee.dispose(),te.dispose();for(const c of T.values())c.forEach(y=>y.dispose());return R.forEach(c=>c.dispose()),f.forEach(c=>c.dispose()),w("total",b),console.info(`[${v}] impostors baked: ${x} views in ${Math.round(performance.now()-b)} ms (context ${Math.round(p.context)}, render ${Math.round(p.render)}, downsample ${Math.round(p.downsample)}, post ${Math.round(p.post)})`),{albedo:ye,normal:ne,layout:{cols:r,cellU:i/u,cellV:i/U,pad:1.5/i,views:s,rings:n.map(c=>({el:c.el,n:c.n}))},models:h.map(c=>({cx:c.center.x,cy:c.center.y,cz:c.center.z,r:c.radius}))}}catch(g){return console.warn(`[${v}] impostor bake failed${t.failNote||""}`,g),null}finally{m&&(m.dispose(),m.forceContextLoss())}}const H=4,St=`
uniform vec3 uViewPos;
uniform vec4 uFade;                    // x fade-in start, y fade-in end (end <= start: always visible)
uniform vec4 uModels[ IMP_MODELS ];    // local bounding sphere centre xyz, radius
uniform vec4 uAtlas;                   // columns, cell width (uv), cell height (uv), inner padding (cell fraction)
uniform vec4 uRings[ ${H} ];   // elevation (deg), views in ring, first view index, -
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
`,Pt=`
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
	for ( int i = 1; i < ${H}; i ++ ) if ( i < nr && el >= uRings[ i ].x ) r0 = i;
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
`,_t=`
vec3 transformed = impC + impR * position.x * impRw + impU * position.y * impRh;
if ( vFade <= 0.0 ) transformed = impC;
`,bt=`
vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
gl_Position = projectionMatrix * mvPosition;
`+lt,Rt=`
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
#endif
`,It=`
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
`+Fe,Ft=`
if ( vFade < 0.999 && mpIGN( gl_FragCoord.xy ) <= 1.0 - vFade ) discard;
`,Ot=`
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
`,Nt=`
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
`;function zt(e,t={}){const n=e.layout,o=n.rings||de;if(o.length>H)throw new Error(`impostors: at most ${H} elevation rings`);const s=Math.max(1,e.models.length),i=t.viewPos||{value:new pe},l={value:new L(t.fade?t.fade.start:0,t.fade?t.fade.end:0,0,0)},a={value:Array.from({length:s},(m,b)=>{const p=e.models[b];return p?new L(p.cx,p.cy,p.cz,p.r):new L(0,0,0,1)})},r={value:new L(n.cols,n.cellU,n.cellV,n.pad)};let v=0;const d={value:Array.from({length:H},(m,b)=>{const p=o[b],w=p?new L(p.el,p.n,v,0):new L(90,1,0,0);return p&&(v+=p.n),w})},h={value:new rt(o.length,v)},x={value:e.normal},A=new st({map:e.albedo,roughness:t.roughness??.85,metalness:t.metalness??0,alphaTest:t.alphaTest??.5,alphaToCoverage:t.alphaToCoverage??!0,side:Re,envMapIntensity:t.envMapIntensity??.9});return A.defines=Object.assign({IMP_MODELS:s},e.normal?{IMP_NORMALS:""}:{},t.color?{IMP_COLOR:""}:{}),A.onBeforeCompile=m=>{Object.assign(m.uniforms,{uViewPos:i,uFade:l,uModels:a,uAtlas:r,uRings:d,uRingInfo:h,uNormalAtlas:x}),m.vertexShader=m.vertexShader.replace("#include <common>",`#include <common>
`+St).replace("#include <beginnormal_vertex>",Pt).replace("#include <begin_vertex>",_t).replace("#include <project_vertex>",bt).replace("#include <worldpos_vertex>",Rt),m.fragmentShader=m.fragmentShader.replace("#include <common>",`#include <common>
`+It).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
`+Ft).replace("#include <map_fragment>",Ot).replace("#include <normal_fragment_begin>",Nt)},A.customProgramCacheKey=()=>`engine-impostor-v1|${s}|${!!e.normal}|${!!t.color}`,A.userData.uViewPos=i,A.userData.uFade=l,A}class Vt{constructor(t,n={}){const o=this.capacity=Math.max(1,n.capacity??1024),s=new at;s.setAttribute("position",new ce([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3)),s.setAttribute("normal",new ce([0,0,1,0,0,1,0,0,1,0,0,1],3)),s.setAttribute("uv",new ce([0,0,1,0,1,1,0,1],2)),s.setIndex([0,1,2,0,2,3]),this.iPos=new le(new Float32Array(o*4),4),this.iScl=new le(new Float32Array(o*4),4),s.setAttribute("iPos",this.iPos),s.setAttribute("iScl",this.iScl),n.color&&(this.iColor=new le(new Float32Array(o*3).fill(1),3),s.setAttribute("iColor",this.iColor)),s.instanceCount=0,this.geometry=s,this.material=n.material||zt(t,n),this.mesh=new Ie(s,this.material),this.mesh.frustumCulled=!1,this.mesh.castShadow=!1,this.mesh.receiveShadow=!0,this.mesh.name=n.name||"impostors",this._count=0}get count(){return this._count}set count(t){this._count=Math.max(0,Math.min(this.capacity,t|0)),this.geometry.instanceCount=this._count}setInstance(t,n,o,s,i=0,l=1,a=l,r=0){const v=this.iPos.array,d=this.iScl.array,h=t*4;v[h]=n,v[h+1]=o,v[h+2]=s,v[h+3]=i,d[h]=l,d[h+1]=a,d[h+2]=r,d[h+3]=0,this.iPos.needsUpdate=!0,this.iScl.needsUpdate=!0,t>=this._count&&(this.count=t+1)}setColor(t,n,o,s){if(!this.iColor)return;const i=this.iColor.array,l=t*3;i[l]=n,i[l+1]=o,i[l+2]=s,this.iColor.needsUpdate=!0}update(t){this.material.userData.uViewPos.value.copy(t)}dispose(){this.geometry.dispose(),this.material.dispose()}}export{de as D,Vt as I,ht as a,Lt as b,Dt as c,jt as d,Se as e,ut as f,ue as g,gt as i,Et as m,Wt as u,$t as w};
