import{D as Ue,R as je,ao as Ve,ag as Ge,$ as We,C as $e,ap as He,u as Me,S as Ce,f as Ke,m as be,l as ke,aq as qe,g as Re,ar as Ye,W as se,N as Y,a2 as Qe,I as Xe,c as le,aa as ce,a3 as Je,V as _e,p as $,a as Ze,o as et}from"./three.module-DXzoBpqv.js";import{F as tt,H as ot}from"./LoadingScreen-DH00SDUw.js";import{G as nt}from"./MaterialPatches-CODPu3a8.js";const j=new Float32Array(256);for(let e=0;e<256;e++){const t=e/255;j[e]=t<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}const me=new Uint8Array(4096);for(let e=0;e<4096;e++){const t=e/4095;me[e]=Math.round(255*(t<=.0031308?t*12.92:1.055*Math.pow(t,1/2.4)-.055))}function at(e,t,o,n,u,a,p=12){let s=0,i=0,h=0,v=0;const d=Math.min(t,o+u),y=n+a;for(let w=n;w<y;w++)for(let g=o;g<d;g++){const f=(w*t+g)*4;e[f+3]>127&&(s+=e[f],i+=e[f+1],h+=e[f+2],v++)}const A=v?s/v:60,c=v?i/v:75,_=v?h/v:40;for(let w=n;w<y;w++)for(let g=o;g<d;g++){const f=(w*t+g)*4;e[f+3]<p&&(e[f]=A,e[f+1]=c,e[f+2]=_,e[f+3]=0)}const m=t*4;for(let w=n+1;w<y-1;w++)for(let g=o+1;g<d-1;g++){const f=(w*t+g)*4;if(e[f+3]!==0)continue;let b=f-4;(e[b+3]>127||e[(b=f+4)+3]>127||e[(b=f-m)+3]>127||e[(b=f+m)+3]>127)&&(e[f]=e[b],e[f+1]=e[b+1],e[f+2]=e[b+2])}}function rt(e,t,o,n=128){let u=0,a=0;for(let p=o.y;p<o.y+o.h;p++)for(let s=o.x;s<o.x+o.w;s++)a++,e[(p*t+s)*4+3]>=n&&u++;return a?u/a:0}function Ae(e,t,o,n=[],u=!0){const a=[{data:e,width:t,height:o}],p=n.map(y=>y.cov?rt(e,t,y):-1);let s=e,i=t,h=o,v=0;const d=new Uint32Array(256);for(;i>1||h>1;){const y=Math.max(1,i>>1),A=Math.max(1,h>>1),c=new Uint8Array(y*A*4);for(let m=0;m<A;m++){const w=Math.min(h-1,m*2),g=Math.min(h-1,m*2+1);for(let f=0;f<y;f++){const b=Math.min(i-1,f*2),T=Math.min(i-1,f*2+1),F=(w*i+b)*4,B=(w*i+T)*4,P=(g*i+b)*4,z=(g*i+T)*4,I=s[F+3],R=s[B+3],S=s[P+3],D=s[z+3],V=I+R+S+D,O=(m*y+f)*4;if(u)if(V>0)for(let l=0;l<3;l++)c[O+l]=me[Math.min(4095,(j[s[F+l]]*I+j[s[B+l]]*R+j[s[P+l]]*S+j[s[z+l]]*D)/V*4095+.5|0)];else for(let l=0;l<3;l++)c[O+l]=me[Math.min(4095,(j[s[F+l]]+j[s[B+l]]+j[s[P+l]]+j[s[z+l]])*.25*4095+.5|0)];else if(V>0)for(let l=0;l<3;l++)c[O+l]=(s[F+l]*I+s[B+l]*R+s[P+l]*S+s[z+l]*D)/V+.5;else for(let l=0;l<3;l++)c[O+l]=(s[F+l]+s[B+l]+s[P+l]+s[z+l])*.25+.5;c[O+3]=V+2>>2}}v++;const _=1<<v;n.forEach((m,w)=>{if(p[w]<0)return;const g=Math.floor(m.x/_),f=Math.floor(m.y/_),b=Math.min(y,Math.ceil((m.x+m.w)/_)),T=Math.min(A,Math.ceil((m.y+m.h)/_));if(b-g<2||T-f<2)return;d.fill(0);let F=0;for(let I=f;I<T;I++)for(let R=g;R<b;R++)d[c[(I*y+R)*4+3]]++,F++;let B=0,P=255;for(;P>1&&(B+=d[P],!(B/F>=p[w]));P--);const z=Math.min(6,Math.max(.6,127.5/P));if(!(Math.abs(z-1)<.02))for(let I=f;I<T;I++)for(let R=g;R<b;R++){const S=(I*y+R)*4+3;c[S]=Math.min(255,c[S]*z+.5)}}),a.push({data:c,width:y,height:A}),s=c,i=y,h=A}return a}function fe(e,t){const o=e[0],n=new Ue(o.data,o.width,o.height,je,Ve);return n.mipmaps=e,n.generateMipmaps=!1,n.minFilter=Ge,n.magFilter=We,n.wrapS=n.wrapT=$e,n.colorSpace=t,n.flipY=!1,n.unpackAlignment=4,n.needsUpdate=!0,n}function it(e,t,o,n,u,a){const p=[],s=t*4;for(let i=n+1;i<n+a-1;i++)for(let h=o+1;h<o+u-1;h++){const v=(i*t+h)*4;if(e[v+3]>0)continue;let d=v-4;(e[d+3]>0||e[(d=v+4)+3]>0||e[(d=v-s)+3]>0||e[(d=v+s)+3]>0)&&p.push(v,d)}for(let i=0;i<p.length;i+=2){const h=p[i],v=p[i+1];e[h]=e[v],e[h+1]=e[v+1],e[h+2]=e[v+2],e[h+3]=1}}const ue=[{el:10,n:8},{el:45,n:8},{el:80,n:4}];function st(e=ue){const t=[];for(const o of e)for(let n=0;n<o.n;n++)t.push({az:n/o.n*Math.PI*2,el:o.el});return t}const lt=`
varying vec2 vUv; varying vec3 vN; varying vec3 vC;
void main() {
	vUv = uv; vN = normal;
#ifdef HAS_VCOLOR
	vC = color;
#else
	vC = vec3( 1.0 );
#endif
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Pe=`
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
`,ct=Pe+`
vec3 toSRGB( vec3 c ) { c = max( c, 0.0 ); return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
	vec4 t = bakeTexel();
#ifdef HAS_TINT
	t.rgb *= uTint;
#endif
	gl_FragColor = vec4( toSRGB( t.rgb * vC ), 1.0 );
}`,ft=Pe+`
void main() { vec4 t = bakeTexel(); gl_FragColor = vec4( normalize( vN ) * 0.5 + 0.5, 1.0 ); }`,mt=`
void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,ut=`
uniform sampler2D tSrc;
uniform vec3 uEmpty;
void main() {
	ivec2 o = ivec2( gl_FragCoord.xy ) * K;
	vec4 acc = vec4( 0.0 );
	for ( int j = 0; j < K; j ++ ) for ( int i = 0; i < K; i ++ ) { vec4 c = texelFetch( tSrc, o + ivec2( i, j ), 0 ); acc += vec4( c.rgb * c.a, c.a ); }
	gl_FragColor = acc.a > 0.0 ? vec4( acc.rgb / acc.a, acc.a / float( K * K ) ) : vec4( uEmpty, 0.0 );
}`,Se=(e,t)=>new Ce({vertexShader:mt,fragmentShader:ut,defines:{K:e},uniforms:{tSrc:{value:null},uEmpty:{value:new _e(t[0],t[1],t[2])}},depthTest:!1,depthWrite:!1,blending:Je});function vt(e){const t=e&&e.isMesh?e:null,o=t?t.geometry:e.geometry||e.geo;o.boundingSphere||o.computeBoundingSphere();const n=t?Array.isArray(t.material)?t.material[0]:t.material:null;return{geo:o,center:e.center||o.boundingSphere.center,radius:e.radius||o.boundingSphere.radius,map:e.map!==void 0?e.map:n?n.map||null:void 0,color:e.color||n&&n.color||null}}function _t(e,t={}){if(typeof document>"u"||typeof WebGL2RenderingContext>"u")return null;const o=t.rings||ue,n=st(o),u=n.length,a=t.cellPx??170,p=t.texSize??2048,s=t.ss??2,i=t.cols??Math.floor(p/a),h=t.label||"impostors",v=t.name||"impostor",d=e.map(vt),y=d.length*u,A=Math.ceil(y/i);if(A*a>p||i*a>p)throw new Error("impostor atlas too small");let c=null;const _=performance.now(),m=t.timing||{},w=(g,f)=>{m[g]=(m[g]||0)+(performance.now()-f)};try{const g=document.createElement("canvas");g.width=g.height=8,c=new He({canvas:g,antialias:!1,alpha:!0,powerPreference:"high-performance"}),c.setPixelRatio(1),w("context",_),c.autoClear=!1;const f=[],b=Array.isArray(t.map)?(f.push(fe(t.map,Me)),f[0]):t.map||null,T=new Map,F=(r,x,C,M)=>new Ce({vertexShader:lt,fragmentShader:r,vertexColors:C,side:be,uniforms:{map:{value:x},uTint:{value:new Ke(M?M.r:1,M?M.g:1,M?M.b:1)},uAlphaTest:{value:t.alphaTest??.5}},defines:Object.assign({},x?{HAS_MAP:""}:{},C?{HAS_VCOLOR:""}:{},M&&(M.r!==1||M.g!==1||M.b!==1)?{HAS_TINT:""}:{})}),B=r=>{const x=r.map===void 0?b:r.map||b,C=!!r.geo.getAttribute("color"),M=`${x?x.uuid:"-"}|${C}|${r.color?r.color.getHexString():"-"}`;let E=T.get(M);return E||(E=[F(ct,x,C,r.color),F(ft,x,C,r.color)],T.set(M,E)),E},P=d.map(r=>{const x=new ke;for(const C of["position","normal","uv","color"])r.geo.getAttribute(C)&&x.setAttribute(C,r.geo.getAttribute(C));return x.setIndex(r.geo.getIndex()),x.getAttribute("normal")||x.computeVertexNormals(),x}),z=d.map(B),I=new qe,R=new Re(P[0],z[0][0]);R.frustumCulled=!1,I.add(R);const S=new Ye(-1,1,1,-1,.1,100),D=a*s,V=i*D,O=new se(V,D,{depthBuffer:!0,generateMipmaps:!1,minFilter:Y,magFilter:Y}),l=p,Ie=A*a;let G=1;for(;G<Ie;)G<<=1;G>p&&(G=p);const k=l>>1,ve=G>>1,W=t.normals!==!1,Q=new Uint8Array(l*G*4),X=W?new Uint8Array(k*ve*4):null,N=a>>1,pe={depthBuffer:!1,generateMipmaps:!1,minFilter:Y,magFilter:Y},de=new se(i*a,a,pe),J=W?new se(i*N,N,pe):null,Ne=new Uint8Array(i*a*a*4),Oe=W?new Uint8Array(i*N*N*4):null,Z=Se(s,[0,0,0]),ee=W?Se(s*2,[.5,1,.5]):null,te=new tt(Z);c.setClearColor(0,0);for(let r=0;r<(W?2:1);r++){const x=r===0?de:J,C=r===0?Ne:Oe,M=r===0?Z:ee,E=r===0?a:N,ze=r===0?Q:X,Te=r===0?l:k,ne=i*E;for(let H=0;H<A;H++){const Be=performance.now();O.viewport.set(0,0,V,D),c.setRenderTarget(O),c.clear(!0,!0,!1);for(let L=0;L<i;L++){const ae=H*i+L;if(ae>=y)break;const re=Math.floor(ae/u),{az:ye,el:Le}=n[ae%u],xe=d[re];R.geometry=P[re],R.material=z[re][r];const U=xe.radius,q=xe.center,ie=Le*Math.PI/180;S.left=-U,S.right=U,S.top=U,S.bottom=-U,S.near=U*.5,S.far=U*6,S.position.set(q.x+Math.sin(ye)*Math.cos(ie)*U*3,q.y+Math.sin(ie)*U*3,q.z+Math.cos(ye)*Math.cos(ie)*U*3),S.up.set(0,1,0),S.lookAt(q),S.updateProjectionMatrix(),O.viewport.set(L*D,0,D,D),c.setRenderTarget(O),c.render(I,S)}M.uniforms.tSrc.value=O.texture,te.material=M,c.setRenderTarget(x),te.render(c),c.readRenderTargetPixels(x,0,0,ne,E,C),w("render",Be);const De=performance.now(),Ee=Math.min(i,y-H*i)*E*4;for(let L=0;L<E;L++)ze.set(C.subarray(L*ne*4,L*ne*4+Ee),(H*E+L)*Te*4);w("downsample",De)}}const Fe=performance.now(),he=[],ge=[];for(let r=0;r<y;r++){const x=r%i,C=Math.floor(r/i);if(at(Q,l,x*a,C*a,a,a,8),W)for(let M=0;M<2;M++)it(X,k,x*N,C*N,N,N);he.push({x:x*a,y:C*a,w:a,h:a,cov:!0}),ge.push({x:x*N,y:C*N,w:N,h:N,cov:!1})}const we=fe(Ae(Q,l,G,he,!0),Me),oe=W?fe(Ae(X,k,ve,ge,!1),Qe):null;we.name=`${v}Albedo`,oe&&(oe.name=`${v}Normal`),w("post",Fe),O.dispose(),de.dispose(),J&&J.dispose(),Z.dispose(),ee&&ee.dispose(),te.dispose();for(const r of T.values())r.forEach(x=>x.dispose());return P.forEach(r=>r.dispose()),f.forEach(r=>r.dispose()),w("total",_),console.info(`[${h}] impostors baked: ${y} views in ${Math.round(performance.now()-_)} ms (context ${Math.round(m.context)}, render ${Math.round(m.render)}, downsample ${Math.round(m.downsample)}, post ${Math.round(m.post)})`),{albedo:we,normal:oe,layout:{cols:i,cellU:a/l,cellV:a/G,pad:1.5/a,views:u,rings:o.map(r=>({el:r.el,n:r.n}))},models:d.map(r=>({cx:r.center.x,cy:r.center.y,cz:r.center.z,r:r.radius}))}}catch(g){return console.warn(`[${h}] impostor bake failed${t.failNote||""}`,g),null}finally{c&&(c.dispose(),c.forceContextLoss())}}const K=4,pt=`
uniform vec3 uViewPos;
uniform vec4 uFade;                    // x fade-in start, y fade-in end (end <= start: always visible)
uniform vec4 uModels[ IMP_MODELS ];    // local bounding sphere centre xyz, radius
uniform vec4 uAtlas;                   // columns, cell width (uv), cell height (uv), inner padding (cell fraction)
uniform vec4 uRings[ ${K} ];   // elevation (deg), views in ring, first view index, -
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
`,dt=`
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
	for ( int i = 1; i < ${K}; i ++ ) if ( i < nr && el >= uRings[ i ].x ) r0 = i;
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
`,ht=`
vec3 transformed = impC + impR * position.x * impRw + impU * position.y * impRh;
if ( vFade <= 0.0 ) transformed = impC;
`,gt=`
vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
gl_Position = projectionMatrix * mvPosition;
`+ot,wt=`
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
#endif
`,yt=`
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
`+nt,xt=`
if ( vFade < 0.999 && mpIGN( gl_FragCoord.xy ) <= 1.0 - vFade ) discard;
`,Mt=`
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
`,At=`
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
`;function St(e,t={}){const o=e.layout,n=o.rings||ue;if(n.length>K)throw new Error(`impostors: at most ${K} elevation rings`);const u=Math.max(1,e.models.length),a=t.viewPos||{value:new _e},p={value:new $(t.fade?t.fade.start:0,t.fade?t.fade.end:0,0,0)},s={value:Array.from({length:u},(c,_)=>{const m=e.models[_];return m?new $(m.cx,m.cy,m.cz,m.r):new $(0,0,0,1)})},i={value:new $(o.cols,o.cellU,o.cellV,o.pad)};let h=0;const v={value:Array.from({length:K},(c,_)=>{const m=n[_],w=m?new $(m.el,m.n,h,0):new $(90,1,0,0);return m&&(h+=m.n),w})},d={value:new Ze(n.length,h)},y={value:e.normal},A=new et({map:e.albedo,roughness:t.roughness??.85,metalness:t.metalness??0,alphaTest:t.alphaTest??.5,alphaToCoverage:t.alphaToCoverage??!0,side:be,envMapIntensity:t.envMapIntensity??.9});return A.defines=Object.assign({IMP_MODELS:u},e.normal?{IMP_NORMALS:""}:{},t.color?{IMP_COLOR:""}:{}),A.onBeforeCompile=c=>{Object.assign(c.uniforms,{uViewPos:a,uFade:p,uModels:s,uAtlas:i,uRings:v,uRingInfo:d,uNormalAtlas:y}),c.vertexShader=c.vertexShader.replace("#include <common>",`#include <common>
`+pt).replace("#include <beginnormal_vertex>",dt).replace("#include <begin_vertex>",ht).replace("#include <project_vertex>",gt).replace("#include <worldpos_vertex>",wt),c.fragmentShader=c.fragmentShader.replace("#include <common>",`#include <common>
`+yt).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
`+xt).replace("#include <map_fragment>",Mt).replace("#include <normal_fragment_begin>",At)},A.customProgramCacheKey=()=>`engine-impostor-v1|${u}|${!!e.normal}|${!!t.color}`,A.userData.uViewPos=a,A.userData.uFade=p,A}class Pt{constructor(t,o={}){const n=this.capacity=Math.max(1,o.capacity??1024),u=new Xe;u.setAttribute("position",new le([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3)),u.setAttribute("normal",new le([0,0,1,0,0,1,0,0,1,0,0,1],3)),u.setAttribute("uv",new le([0,0,1,0,1,1,0,1],2)),u.setIndex([0,1,2,0,2,3]),this.iPos=new ce(new Float32Array(n*4),4),this.iScl=new ce(new Float32Array(n*4),4),u.setAttribute("iPos",this.iPos),u.setAttribute("iScl",this.iScl),o.color&&(this.iColor=new ce(new Float32Array(n*3).fill(1),3),u.setAttribute("iColor",this.iColor)),u.instanceCount=0,this.geometry=u,this.material=o.material||St(t,o),this.mesh=new Re(u,this.material),this.mesh.frustumCulled=!1,this.mesh.castShadow=!1,this.mesh.receiveShadow=!0,this.mesh.name=o.name||"impostors",this._count=0}get count(){return this._count}set count(t){this._count=Math.max(0,Math.min(this.capacity,t|0)),this.geometry.instanceCount=this._count}setInstance(t,o,n,u,a=0,p=1,s=p,i=0){const h=this.iPos.array,v=this.iScl.array,d=t*4;h[d]=o,h[d+1]=n,h[d+2]=u,h[d+3]=a,v[d]=p,v[d+1]=s,v[d+2]=i,v[d+3]=0,this.iPos.needsUpdate=!0,this.iScl.needsUpdate=!0,t>=this._count&&(this.count=t+1)}setColor(t,o,n,u){if(!this.iColor)return;const a=this.iColor.array,p=t*3;a[p]=o,a[p+1]=n,a[p+2]=u,this.iColor.needsUpdate=!0}update(t){this.material.userData.uViewPos.value.copy(t)}dispose(){this.geometry.dispose(),this.material.dispose()}}export{ue as D,Pt as I,Ae as a,_t as b,fe as d,at as f,st as i};
