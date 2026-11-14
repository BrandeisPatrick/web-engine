import{ab as S,S as J,a6 as z,aV as W,R as B,n as Z,a2 as N,V as tt,l as k,v as F,aa as et,I as it,F as j,A as st,ag as at,aZ as rt,a_ as nt,C as ut,M as ot}from"./three.module-B_yomNYV.js";import{F as lt}from"./Pass-zYCX4yqx.js";import{s as ht,a as ct}from"./Particles-yvTJP-je.js";class dt{constructor(t,e,i){this.variables=[],this.currentTextureIndex=0;let n=W;const o={passThruTexture:{value:null}},u=g(x(),o),l=new lt(u);this.setDataType=function(r){return n=r,this},this.addVariable=function(r,s,a){const c=this.createShaderMaterial(s),h={name:r,initialValueTexture:a,material:c,dependencies:null,renderTargets:[],wrapS:null,wrapT:null,minFilter:S,magFilter:S};return this.variables.push(h),h},this.setVariableDependencies=function(r,s){r.dependencies=s},this.init=function(){if(i.capabilities.maxVertexTextures===0)return"No support for vertex shader textures.";for(let r=0;r<this.variables.length;r++){const s=this.variables[r];s.renderTargets[0]=this.createRenderTarget(t,e,s.wrapS,s.wrapT,s.minFilter,s.magFilter),s.renderTargets[1]=this.createRenderTarget(t,e,s.wrapS,s.wrapT,s.minFilter,s.magFilter),this.renderTexture(s.initialValueTexture,s.renderTargets[0]),this.renderTexture(s.initialValueTexture,s.renderTargets[1]);const a=s.material,c=a.uniforms;if(s.dependencies!==null)for(let h=0;h<s.dependencies.length;h++){const d=s.dependencies[h];if(d.name!==s.name){let p=!1;for(let w=0;w<this.variables.length;w++)if(d.name===this.variables[w].name){p=!0;break}if(!p)return"Variable dependency not found. Variable="+s.name+", dependency="+d.name}c[d.name]={value:null},a.fragmentShader=`
uniform sampler2D `+d.name+`;
`+a.fragmentShader}}return this.currentTextureIndex=0,null},this.compute=function(){const r=this.currentTextureIndex,s=this.currentTextureIndex===0?1:0;for(let a=0,c=this.variables.length;a<c;a++){const h=this.variables[a];if(h.dependencies!==null){const d=h.material.uniforms;for(let p=0,w=h.dependencies.length;p<w;p++){const _=h.dependencies[p];d[_.name].value=_.renderTargets[r].texture}}this.doRenderTarget(h.material,h.renderTargets[s])}this.currentTextureIndex=s},this.getCurrentRenderTarget=function(r){return r.renderTargets[this.currentTextureIndex]},this.getAlternateRenderTarget=function(r){return r.renderTargets[this.currentTextureIndex===0?1:0]},this.dispose=function(){l.dispose();const r=this.variables;for(let s=0;s<r.length;s++){const a=r[s];a.initialValueTexture&&a.initialValueTexture.dispose();const c=a.renderTargets;for(let h=0;h<c.length;h++)c[h].dispose()}};function f(r){r.defines.resolution="vec2( "+t.toFixed(1)+", "+e.toFixed(1)+" )"}this.addResolutionDefine=f;function g(r,s){s=s||{};const a=new J({name:"GPUComputationShader",uniforms:s,vertexShader:m(),fragmentShader:r});return f(a),a}this.createShaderMaterial=g,this.createRenderTarget=function(r,s,a,c,h,d){return r=r||t,s=s||e,a=a||N,c=c||N,h=h||S,d=d||S,new z(r,s,{wrapS:a,wrapT:c,minFilter:h,magFilter:d,format:B,type:n,depthBuffer:!1})},this.createTexture=function(){const r=new Float32Array(t*e*4),s=new Z(r,t,e,B,W);return s.needsUpdate=!0,s},this.renderTexture=function(r,s){o.passThruTexture.value=r,this.doRenderTarget(u,s),o.passThruTexture.value=null},this.doRenderTarget=function(r,s){const a=i.getRenderTarget(),c=i.xr.enabled,h=i.shadowMap.autoUpdate;i.xr.enabled=!1,i.shadowMap.autoUpdate=!1,l.material=r,i.setRenderTarget(s),l.render(i),l.material=u,i.xr.enabled=c,i.shadowMap.autoUpdate=h,i.setRenderTarget(a)};function m(){return`void main()	{

	gl_Position = vec4( position, 1.0 );

}
`}function x(){return`uniform sampler2D passThruTexture;

void main() {

	vec2 uv = gl_FragCoord.xy / resolution.xy;

	gl_FragColor = texture2D( passThruTexture, uv );

}
`}}}const Q=Math.PI*2,q=1/64,V=4096,pt=.001,$=16,I=v=>{let t=1;for(;t<v;)t*=2;return t};function H(v){return v=(v^v>>>16)>>>0,v=Math.imul(v,2146121005),v=(v^v>>>15)>>>0,v=Math.imul(v,2221713035),v=(v^v>>>16)>>>0,v}function K(v,t,e){v=v>0?v:0,t=t>0?t:0,e=e>0?e:0;const i=v>t?v>e?v:e:t>e?t:e;let n=0,o=1/16;for(;n<7&&i>o;)n++,o*=2;const u=127/o;let l=Math.round(v*u),f=Math.round(t*u),g=Math.round(e*u);return l>127&&(l=127),f>127&&(f=127),g>127&&(g=127),n*2097152+l*16384+f*128+g}function ft(v,t){let e=Math.round(v/Q*4096)%4096;e<0&&(e+=4096),e>=0||(e=0);let i=Math.round(t*(2048/$))+2048;return i=i<0?0:i>4095?4095:i,i>=0||(i=2048),e*4096+i}class vt{constructor(t={}){const e=this.max=Math.max(1,(t.max??65536)|0),i=this.width=Math.min(1024,I(e)),n=this.height=Math.ceil(e/i),o=this.capacity=Math.max(1,Math.min(e,(t.stagingPerFrame??4096)|0)),u=this.stagingWidth=Math.min(1024,I(o*2)),l=this.stagingHeight=Math.ceil(o*2/u);this.spin=t.spin??1.2,this.staging=new Float32Array(u*l*4),this.attrA=new Float32Array(i*n*4),this.attrB=new Float32Array(i*n*4),this.deathAt=new Float64Array(e),this.slotBucket=new Int32Array(e),this.buckets=new Int32Array(V),this.spawned=0,this.dropped=0,this.overwritten=0,this.reset()}reset(){this.head=0,this.start=0,this.n=0,this.tail=0,this.window=0,this.live=0,this.time=0,this.bucketDone=0,this.serial=0,this.deathAt.fill(-1/0),this.slotBucket.fill(-1),this.buckets.fill(0)}spawn(t,e,i,n,o,u,l,f,g,m,x,r,s,a,c,h,d,p,w,_){if(this.n>=this.capacity)return this.dropped++,-1;const T=this.max,y=this.head,E=this.time;l>.001||(l=.001),this.deathAt[y]>E&&this.overwritten++;const O=this.slotBucket[y];O>this.bucketDone&&(this.buckets[O%V]--,this.live--),this.window===T?this.tail=this.tail+1===T?0:this.tail+1:this.window++;const U=E+l;this.deathAt[y]=U;let A=Math.floor(U/q)+1;const G=this.bucketDone+V-1;A>G&&(A=G),this.slotBucket[y]=A,this.buckets[A%V]++,this.live++;const D=this.staging,P=this.n*8;D[P]=t,D[P+1]=e,D[P+2]=i,D[P+3]=0,D[P+4]=n,D[P+5]=o,D[P+6]=u,D[P+7]=l;const M=this.attrA,C=this.attrB,b=y*4,L=this.serial++;return M[b]=f,M[b+1]=g,M[b+2]=d,M[b+3]=p,w===void 0&&(w=H(L*2+1)*(Q/4294967296)),_===void 0&&(_=(H(L*2+2)*(2/4294967296)-1)*this.spin),C[b]=m,C[b+1]=ft(w,_),C[b+2]=K(x,r,s),C[b+3]=K(a,c,h),this.n++,this.spawned++,this.head=y+1===T?0:y+1,y}advance(t){const e=this.time+=t,i=Math.floor(e/q);if(i-this.bucketDone>=V)this.buckets.fill(0),this.live=0,this.bucketDone=i;else for(;this.bucketDone<i;){const u=++this.bucketDone%V;this.live-=this.buckets[u],this.buckets[u]=0}const n=this.deathAt,o=this.max;for(;this.window>0&&n[this.tail]+pt<=e;)this.tail=this.tail+1===o?0:this.tail+1,this.window--}flush(){this.start=this.head,this.n=0}stagedSlots(t){t[0]=t[1]=t[2]=t[3]=-1;const e=this.n;if(!e)return t;const i=this.start,n=i+e-1,o=this.max;return t[0]=i,n<o?t[1]=n:(t[1]=o-1,t[2]=0,t[3]=n-o),t}windowRows(t){if(!this.window)return t[0]=0,t[1]=0,t;const e=this.width,i=this.tail,n=i+this.window-1;return n<this.max?(t[0]=i/e|0,t[1]=(n/e|0)-t[0]+1):(t[0]=0,t[1]=this.height),t}}const X=`
uniform highp sampler2D uStaging;
uniform highp sampler2D uAttrA;
uniform int uSpawnStart, uSpawnCount, uMax, uW, uStagingW;
uniform float uDt, uFloor, uBounce;
uniform vec3 uGravDir;
#ifdef DEPTH_COLLIDE
uniform highp sampler2D uDepth;
uniform int uDepthOn;
uniform mat4 uDepthViewProj, uDepthView, uDepthProjInv, uDepthCamWorld;
uniform vec2 uDepthTexel, uDepthNF;
uniform float uDepthThickness;
// distance along the view axis of the depth sample at uv (perspective 0..1 depth)
float depthDist( vec2 uv ) {
	float d = texture( uDepth, uv ).r;
	return uDepthNF.x * uDepthNF.y / ( uDepthNF.y - d * ( uDepthNF.y - uDepthNF.x ) );
}
vec3 depthViewPos( vec2 uv ) {
	vec4 v = uDepthProjInv * vec4( uv * 2.0 - 1.0, 0.0, 1.0 );
	v.xyz /= v.w;
	return v.xyz * ( depthDist( uv ) / - v.z );
}
void collideDepth( inout vec4 P, inout vec4 V, vec4 A ) {
	vec4 clip = uDepthViewProj * vec4( P.xyz, 1.0 );
	if ( clip.w <= uDepthNF.x ) return;
	vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
	if ( uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0 ) return;
	float scene = depthDist( uv );
	if ( scene >= uDepthNF.y * 0.999 ) return; // sky
	float size = A.x + ( A.y - A.x ) * sqrt( clamp( P.w / max( V.w, 1e-3 ), 0.0, 1.0 ) );
	float tol = uDepthThickness * size + length( V.xyz ) * uDt;
	float behind = clip.w - scene; // along the view axis: up to 1 / cos(view, normal) x the true penetration
	if ( behind <= 0.0 || behind > tol * 16.0 ) return;
	vec3 c0 = depthViewPos( uv );
	vec3 l = depthViewPos( uv - vec2( uDepthTexel.x, 0.0 ) ), r = depthViewPos( uv + vec2( uDepthTexel.x, 0.0 ) );
	vec3 b = depthViewPos( uv - vec2( 0.0, uDepthTexel.y ) ), t = depthViewPos( uv + vec2( 0.0, uDepthTexel.y ) );
	vec3 dx = abs( r.z - c0.z ) < abs( c0.z - l.z ) ? r - c0 : c0 - l;
	vec3 dy = abs( t.z - c0.z ) < abs( c0.z - b.z ) ? t - c0 : c0 - b;
	vec3 nv = cross( dx, dy );
	float nl = length( nv );
	if ( nl < 1e-12 ) return;
	nv /= nl;
	if ( dot( nv, c0 ) > 0.0 ) nv = - nv; // facing the camera (view-space origin)
	// penetration below the surface plane, along its normal
	vec3 pv = ( uDepthView * vec4( P.xyz, 1.0 ) ).xyz;
	float pen = dot( c0 - pv, nv );
	if ( pen <= 0.0 || pen > tol ) return;
	vec3 n = normalize( mat3( uDepthCamWorld ) * nv );
	P.xyz += n * ( pen + 0.01 );
	float vn = dot( V.xyz, n );
	if ( vn < 0.0 ) V.xyz = ( V.xyz - vn * n ) * 0.6 - n * ( vn * uBounce );
}
#endif
void stepParticle( out vec4 P, out vec4 V ) {
	ivec2 c = ivec2( gl_FragCoord.xy );
	int slot = c.y * uW + c.x;
	int k = slot - uSpawnStart;
	if ( k < 0 ) k += uMax;
	if ( slot < uMax && k < uSpawnCount ) { // spawned this frame: initial state from the staging texels 2k, 2k + 1
		int t = k * 2;
		P = texelFetch( uStaging, ivec2( t % uStagingW, t / uStagingW ), 0 );
		V = texelFetch( uStaging, ivec2( ( t + 1 ) % uStagingW, ( t + 1 ) / uStagingW ), 0 );
	} else {
		P = texelFetch( texturePos, c, 0 );
		V = texelFetch( textureVel, c, 0 );
	}
	if ( ! ( P.w < V.w ) ) return; // dead: unchanged
	P.w += uDt;
	if ( ! ( P.w < V.w ) ) return; // died this step (ParticleSystem kills before integrating)
	vec4 A = texelFetch( uAttrA, c, 0 ); // size0, size1, drag, gravity
	float dr = exp( - A.z * uDt );
	V.xyz = V.xyz * dr + uGravDir * ( A.w * uDt );
	P.xyz += V.xyz * uDt;
	if ( P.y < uFloor ) { P.y = uFloor; V.y = abs( V.y ) * uBounce; V.xz *= 0.6; }
#ifdef DEPTH_COLLIDE
	if ( uDepthOn == 1 ) collideDepth( P, V, A );
#endif
}`,gt=X+`
void main() { vec4 P, V; stepParticle( P, V ); gl_FragColor = P; }
`,mt=X+`
void main() { vec4 P, V; stepParticle( P, V ); gl_FragColor = V; }
`,xt=`
uniform highp sampler2D uPos;
uniform highp sampler2D uVel;
uniform mat4 uView;
uniform int uFirst, uWindow, uMax, uW;
void main() {
	ivec2 c = ivec2( gl_FragCoord.xy );
	int i = c.y * uW + c.x;
	float key = 2e30, slot = 0.0;
	if ( i < uWindow ) {
		int s = uFirst + i;
		if ( s >= uMax ) s -= uMax;
		ivec2 sc = ivec2( s % uW, s / uW );
		vec4 P = texelFetch( uPos, sc, 0 ), V = texelFetch( uVel, sc, 0 );
		key = P.w < V.w ? ( uView * vec4( P.xyz, 1.0 ) ).z : 1e30;
		slot = float( s );
	}
	gl_FragColor = vec4( key, slot, 0.0, 0.0 );
}`,wt=`
uniform highp sampler2D uSrc;
uniform int uJ, uK, uW;
void main() {
	ivec2 c = ivec2( gl_FragCoord.xy );
	int i = c.y * uW + c.x, p = i ^ uJ;
	vec2 a = texelFetch( uSrc, c, 0 ).xy, b = texelFetch( uSrc, ivec2( p % uW, p / uW ), 0 ).xy;
	bool aFirst = a.x < b.x || ( a.x == b.x && a.y <= b.y );
	bool keepFirst = ( ( i & uK ) == 0 ) == ( i < p );
	gl_FragColor = vec4( keepFirst == aFirst ? a : b, 0.0, 0.0 );
}`,_t=`
uniform highp sampler2D uPos;
uniform highp sampler2D uVel;
uniform highp sampler2D uAttrA;
uniform highp sampler2D uAttrB;
#ifdef SORTED
uniform highp sampler2D uOrder;
#endif
uniform int uFirst, uMax, uW;
uniform float uStreak, uLight, uFadeIn;
uniform vec3 uTint;
uniform vec2 uPx;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
#include <fog_pars_vertex>
vec3 unpackColor( float f ) {
	int u = int( f );
	return vec3( float( ( u >> 14 ) & 127 ), float( ( u >> 7 ) & 127 ), float( u & 127 ) ) * ( exp2( float( u >> 21 ) - 4.0 ) / 127.0 );
}
void main() {
#ifdef SORTED
	int slot = int( texelFetch( uOrder, ivec2( gl_InstanceID % uW, gl_InstanceID / uW ), 0 ).y );
#else
	int slot = uFirst + gl_InstanceID;
	if ( slot >= uMax ) slot -= uMax;
#endif
	ivec2 c = ivec2( slot % uW, slot / uW );
	vec4 P = texelFetch( uPos, c, 0 );   // xyz, age
	vec4 V = texelFetch( uVel, c, 0 );   // xyz, life
	vec4 A = texelFetch( uAttrA, c, 0 ); // size0, size1, drag, gravity
	vec4 B = texelFetch( uAttrB, c, 0 ); // alpha0, rotation, colour0, colour1
	float t = clamp( P.w / max( V.w, 1e-3 ), 0.0, 1.0 );
	float size = A.x + ( A.y - A.x ) * sqrt( t );
	vUv = uv;
	vec4 mvPosition = modelViewMatrix * vec4( P.xyz, 1.0 );
	vec2 q = position.xy, off;
	if ( uStreak > 0.0 ) {
		vec2 d = ( modelViewMatrix * vec4( V.xyz, 0.0 ) ).xy;
		float l = length( d );
		vec2 dir = l > 1e-4 ? d / l : vec2( 1.0, 0.0 );
		vec2 nrm = vec2( - dir.y, dir.x );
		mvPosition.xy += dir * ( q.x - 0.5 ) * l * uStreak;
		off = dir * ( q.x - 0.5 ) * size + nrm * q.y * size;
	} else {
		int rp = int( B.y );
		float rot = float( rp >> 12 ) * ( 6.283185307 / 4096.0 ) + float( ( rp & 4095 ) - 2048 ) * ( ${($/2048).toFixed(8)} ) * P.w;
		float cr = cos( rot ), sr = sin( rot );
		off = vec2( cr * q.x - sr * q.y, sr * q.x + cr * q.y ) * size;
	}
#ifdef SCREEN_SIZE
	gl_Position = projectionMatrix * mvPosition;
	gl_Position.xy += off * uPx * gl_Position.w;
#else
	mvPosition.xy += off;
	gl_Position = projectionMatrix * mvPosition;
#endif
	float fin = uFadeIn > 0.0 ? min( 1.0, P.w / uFadeIn ) : 1.0;
	vAlpha = B.x * fin * ( 1.0 - t ) * ( 1.0 - t );
	vColor = mix( unpackColor( B.z ), unpackColor( B.w ), t ) * uTint * uLight;
	#include <fog_vertex>
	if ( ! ( P.w < V.w ) ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); // dead: outside the clip volume
}`,yt=`
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
#include <fog_pars_fragment>
void main() {
	vec4 t = texture2D( uMap, vUv );
	gl_FragColor = vec4( vColor * t.rgb, t.a * vAlpha );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,R=new k;class Y{static isSupported(t){if(!t||!t.capabilities||!t.extensions||typeof t.extensions.has!="function")return!1;const e=t.capabilities;return e.isWebGL2===!1||(e.maxVertexTextures??0)<5?!1:!!t.extensions.has("EXT_color_buffer_float")}constructor(t,e={}){if(!Y.isSupported(t))throw new Error("GpuParticleSystem: needs a WebGL2 renderer with EXT_color_buffer_float (RGBA32F render targets) and vertex texture fetch; use ParticleSystem instead");this.floorAt=e.floorAt,this.renderer=t;const i=this.staging=new vt({max:e.max??65536,stagingPerFrame:e.stagingPerFrame??4096,spin:e.spin??1.2}),n=this.max=i.max,o=i.width,u=i.height;this.gravityDir=new tt(0,-1,0);const l=e.gravity??0;if(typeof l=="number")this.gravity=l;else{const p=l.x??l[0]??0,w=l.y??l[1]??0,_=l.z??l[2]??0,T=Math.hypot(p,w,_);this.gravity=T,T>0&&this.gravityDir.set(p/T,w/T,_/T)}this.drag=e.drag??0,this.floor=e.floor??-1/0,this.bounce=e.bounce??.35,this.fadeInTime=e.fadeIn??.12,this.lit=!!e.lit,this.litAmbient=e.litAmbient??.15,this.sunSource=typeof e.sun=="number"?null:e.sun||null,this.sunFactor=typeof e.sun=="number"?e.sun:1,this._light=e.light??1,this.depthCollision=!!e.depthCollision,this.depthThickness=e.depthThickness??1,this.sort=!!e.sort,this.sizeAttenuation=e.sizeAttenuation!==!1;const f=t.capabilities;this.depthCollision&&f&&f.reverseDepthBuffer===!0&&console.warn("GpuParticleSystem: depthCollision assumes standard 0..1 depth; reverseDepthBuffer is not supported"),!this.sizeAttenuation&&(e.streak??0)>0&&console.warn("GpuParticleSystem: streak needs sizeAttenuation (streak length is view-space metres, sizes are pixels)"),this.stats={spawned:0,dropped:0,overwritten:0,staged:0,window:0,live:0,computeRows:0,sortPasses:0,uploadRanges:0};const g=(p,w,_,T)=>{const y=new Z(p,w,_,B,W);return y.minFilter=y.magFilter=S,y.generateMipmaps=!1,y.name=T,y.needsUpdate=!0,y};this._stagingTex=g(i.staging,i.stagingWidth,i.stagingHeight,"GpuParticles.staging"),this._attrATex=g(i.attrA,o,u,"GpuParticles.attrA"),this._attrBTex=g(i.attrB,o,u,"GpuParticles.attrB");const m=(p,w)=>{const _=[];for(let T=0;T<w;T++)_.push({start:0,count:0});return _.used=0,p.onUpdate=()=>{_.used=0},_};this._poolS=m(this._stagingTex,i.stagingHeight+1),this._poolA=m(this._attrATex,u+4),this._poolB=m(this._attrBTex,u+4),this._slots=new Int32Array(4),this._rows=new Int32Array(2);const x=this._gpu=new dt(o,u,t),r=this._cu={uStaging:{value:this._stagingTex},uAttrA:{value:this._attrATex},uSpawnStart:{value:0},uSpawnCount:{value:0},uMax:{value:n},uW:{value:o},uStagingW:{value:i.stagingWidth},uDt:{value:0},uFloor:{value:-1e30},uBounce:{value:this.bounce},uGravDir:{value:this.gravityDir},uDepth:{value:null},uDepthOn:{value:0},uDepthViewProj:{value:new F},uDepthView:{value:new F},uDepthProjInv:{value:new F},uDepthCamWorld:{value:new F},uDepthTexel:{value:new k(1,1)},uDepthNF:{value:new k(.1,1e3)},uDepthThickness:{value:this.depthThickness}};this._posVar=x.addVariable("texturePos",gt,x.createTexture()),this._velVar=x.addVariable("textureVel",mt,x.createTexture());for(const p of[this._posVar,this._velVar])x.setVariableDependencies(p,[this._posVar,this._velVar]),Object.assign(p.material.uniforms,r),this.depthCollision&&(p.material.defines.DEPTH_COLLIDE=1);const s=x.init();if(s)throw new Error("GpuParticleSystem: "+s);if(this._depthSrc=null,this._depthCam=null,this._near=void 0,this._far=void 0,this._snapFresh=!1,this.sort){const p=I(u),w={type:W,format:et,depthBuffer:!1,minFilter:S,magFilter:S,generateMipmaps:!1};this._sortRT=[new z(o,p,w),new z(o,p,w)],this._keyMat=x.createShaderMaterial(xt,{uPos:{value:null},uVel:{value:null},uView:{value:new F},uFirst:{value:0},uWindow:{value:0},uMax:{value:n},uW:{value:o}}),this._sortMat=x.createShaderMaterial(wt,{uSrc:{value:null},uJ:{value:1},uK:{value:2},uW:{value:o}}),this._sortCam=null}const a=new it;a.setAttribute("position",new j([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),a.setAttribute("uv",new j([0,0,1,0,1,1,0,1],2)),a.setIndex([0,1,2,0,2,3]),a.instanceCount=0,this.geometry=a;const c={};this.sizeAttenuation||(c.SCREEN_SIZE=1),this.sort&&(c.SORTED=1);const h=e.blending??"additive";this.material=new J({uniforms:rt.merge([nt.fog,{uMap:{value:null},uStreak:{value:e.streak??0},uLight:{value:this._light},uFadeIn:{value:this.fadeInTime},uTint:{value:new ut(e.color??16777215)},uFirst:{value:0},uMax:{value:n},uW:{value:o},uPx:{value:new k(1,1)}}]),vertexShader:_t,fragmentShader:yt,defines:c,transparent:!0,depthWrite:!1,fog:e.fog!==!1,blending:typeof h=="number"?h:h==="additive"?st:at});const d=this.material.uniforms;d.uMap.value=e.texture||e.map||ht(),d.uPos={value:null},d.uVel={value:null},d.uAttrA={value:this._attrATex},d.uAttrB={value:this._attrBTex},d.uOrder={value:null},this.mesh=new ot(a,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=e.renderOrder??8,this.mesh.name=e.name||"gpuParticles",this.mesh.visible=!1,this.mesh.onBeforeRender=(p,w,_)=>{this.depthCollision&&_===this._depthCam&&(this._snapshot(_),this._snapFresh=!0)},this._bindState()}get spin(){return this.staging.spin}set spin(t){this.staging.spin=t}get count(){return this.staging.live}get floorAt(){return null}set floorAt(t){typeof t=="function"&&console.warn("GpuParticleSystem: floorAt is CPU-only and ignored; use floor or depthCollision")}get streak(){return this.material.uniforms.uStreak.value}set streak(t){this.material.uniforms.uStreak.value=t}spawn(t,e,i,n,o,u,l,f,g,m,x,r,s,a=x,c=r,h=s,d=this.drag,p=this.gravity,w,_){return this.staging.spawn(t,e,i,n,o,u,l,f,g,m,x,r,s,a,c,h,d,p,w,_)}emit(t){return this.spawn(t.x,t.y,t.z,t.vx,t.vy,t.vz,t.life,t.size0,t.size1??t.size0,t.alpha??1,t.r??1,t.g??1,t.b??1,t.r1??t.r??1,t.g1??t.g??1,t.b1??t.b??1,t.drag??this.drag,t.gravity??this.gravity,t.rot,t.rotV)}setDepth(t,e,i,n){this._depthSrc=t||null,e&&(this._depthCam=e),this._near=i,this._far=n,this._snapFresh=!1}_depthTexture(){const t=this._depthSrc;if(!t)return null;const e=typeof t=="function"?t():t.isTexture?t:t.sceneDepth;return e&&e.isTexture?e:null}_snapshot(t){const e=this._cu;e.uDepthViewProj.value.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),e.uDepthView.value.copy(t.matrixWorldInverse),e.uDepthProjInv.value.copy(t.projectionMatrixInverse),e.uDepthCamWorld.value.copy(t.matrixWorld),e.uDepthNF.value.set(this._near??t.near,this._far??t.far)}_touch(t,e,i,n,o){const u=t.updateRanges;if(t.needsUpdate=!0,e.used===-1)return 0;let l=0;for(let f=i;f<=n;){const g=Math.min(n,(f/o|0)*o+o-1);if(e.used>=e.length)return u.length=0,e.used=-1,l;const m=e[e.used++];m.start=f*4,m.count=(g-f+1)*4,u.push(m),l++,f=g+1}return l}_bindState(){const t=this.material.uniforms,e=this._gpu;t.uPos.value=e.getCurrentRenderTarget(this._posVar).texture,t.uVel.value=e.getCurrentRenderTarget(this._velVar).texture}update(t,e){const i=this.staging,n=this._cu,o=this._gpu,u=this.stats;i.advance(t);const l=i.n,f=i.width;let g=0;if(l>0){g+=this._touch(this._stagingTex,this._poolS,0,l*2-1,i.stagingWidth);const s=i.stagedSlots(this._slots);for(let a=0;a<4;a+=2)s[a]<0||(g+=this._touch(this._attrATex,this._poolA,s[a],s[a+1],f),g+=this._touch(this._attrBTex,this._poolB,s[a],s[a+1],f))}let m=0;if(i.window>0){if(n.uDt.value=t,n.uSpawnStart.value=i.start,n.uSpawnCount.value=l,n.uFloor.value=Number.isFinite(this.floor)?this.floor:-1e30,n.uBounce.value=this.bounce,this.depthCollision){e&&!this._depthCam&&(this._depthCam=e);const d=this._depthTexture(),p=this._depthCam;p&&!this._snapFresh&&this._snapshot(p),n.uDepth.value=d,n.uDepthOn.value=d&&p?1:0,d&&d.image&&n.uDepthTexel.value.set(1/Math.max(1,d.image.width),1/Math.max(1,d.image.height)),n.uDepthThickness.value=this.depthThickness,this._snapFresh=!1}const s=i.windowRows(this._rows);m=s[1];const a=this._posVar.renderTargets,c=this._velVar.renderTargets;a[0].viewport.set(0,s[0],f,m),a[1].viewport.set(0,s[0],f,m),c[0].viewport.set(0,s[0],f,m),c[1].viewport.set(0,s[0],f,m);const h=this.renderer.autoClear;this.renderer.autoClear=!1,o.compute(),this.renderer.autoClear=h,this._bindState()}u.staged=l,i.flush();const x=i.window,r=this.material.uniforms;r.uFirst.value=i.tail,r.uFadeIn.value=this.fadeInTime,this.geometry.instanceCount=x,this.mesh.visible=x>0,u.sortPasses=this.sort&&x>0?this._sortWindow(e):0,this.sizeAttenuation||(this.renderer.getDrawingBufferSize(R),r.uPx.value.set(2/Math.max(1,R.x),2/Math.max(1,R.y))),this.lit&&this._applyLight(),u.spawned=i.spawned,u.dropped=i.dropped,u.overwritten=i.overwritten,u.window=x,u.live=i.live,u.computeRows=m,u.uploadRanges=g}_sortWindow(t){const e=this.staging,i=this._gpu,n=e.width,o=this._sortRT,u=this._keyMat.uniforms,l=this._sortMat.uniforms;t&&(this._sortCam=t);const f=this._sortCam,g=I(Math.max(2,e.window)),m=Math.min(g,n),x=Math.max(1,g/n);o[0].viewport.set(0,0,m,x),o[1].viewport.set(0,0,m,x),u.uPos.value=this.material.uniforms.uPos.value,u.uVel.value=this.material.uniforms.uVel.value,f?u.uView.value.copy(f.matrixWorldInverse):u.uView.value.identity(),u.uFirst.value=e.tail,u.uWindow.value=e.window;const r=this.renderer.autoClear;this.renderer.autoClear=!1,i.doRenderTarget(this._keyMat,o[0]);let s=0,a=1;for(let c=2;c<=g;c*=2)for(let h=c>>1;h>0;h>>=1)l.uSrc.value=o[s].texture,l.uJ.value=h,l.uK.value=c,i.doRenderTarget(this._sortMat,o[1-s]),s=1-s,a++;return this.renderer.autoClear=r,this.material.uniforms.uOrder.value=o[s].texture,a}get sunLevel(){const t=this.sunSource,e=typeof t=="function"?t():t?ct(t):this.sunFactor;return e<0?0:e>1?1:e||0}_applyLight(){const t=this.lit?this.litAmbient+(1-this.litAmbient)*this.sunLevel:1;this.material.uniforms.uLight.value=this._light*t}get light(){return this._light}set light(t){this._light=t,this._applyLight()}clear(){this.staging.reset(),this.geometry.instanceCount=0,this.mesh.visible=!1}dispose(){this._gpu.dispose(),this._stagingTex.dispose(),this._attrATex.dispose(),this._attrBTex.dispose(),this._posVar.material.dispose(),this._velVar.material.dispose(),this._sortRT&&(this._sortRT[0].dispose(),this._sortRT[1].dispose(),this._keyMat.dispose(),this._sortMat.dispose()),this.geometry.dispose(),this.material.dispose()}}export{Y as G,vt as a};
