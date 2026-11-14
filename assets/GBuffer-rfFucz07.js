import{v as m,l as $,a5 as C,R as P,c as X,a6 as q,p as x,a7 as Y,a8 as J,a9 as Q,aa as ee,N as te,ab as ne,u as ie,ac as se,ad as re,ae,t as oe,af as fe,ag as le,ah as ce}from"./three.module-B_yomNYV.js";const p="ENGINE_GBUFFER",k="ENGINE_GBUFFER_NOVEL",v="ENGINE_GBUFFER_ZERO",R="ENGINE_GBUFFER_PREV",ue="ENGINE_GBUFFER_INSTANCE_PREV",Le=Object.freeze({WRITE:p,NOVEL:k,ZERO:v,PREV:R,INSTANCE_PREV:ue}),N={enginePrevViewProj:{value:new m},engineUnjitteredProj:{value:new m},engineViewToPrevClip:{value:new m}};function he(n){N.engineViewToPrevClip.value.multiplyMatrices(N.enginePrevViewProj.value,n.matrixWorld)}const de=`
#ifdef ENGINE_GBUFFER
	uniform mat4 engineUnjitteredProj;
	uniform mat4 engineViewToPrevClip;
	varying vec4 vEngineClipCur;
	varying vec4 vEngineClipPrev;
	#ifdef ENGINE_GBUFFER_PREV
		uniform mat4 enginePrevModelView;
	#endif
	#if defined( USE_INSTANCING ) && defined( ENGINE_GBUFFER_INSTANCE_PREV )
		attribute mat4 instancePrevMatrix;
	#endif
#endif
`,ge=`
#ifdef ENGINE_GBUFFER
	{
		vec3 engineGbD = vec3( 0.0 );
		#if defined( ENGINE_GBUFFER_PREV ) || ( defined( USE_INSTANCING ) && defined( ENGINE_GBUFFER_INSTANCE_PREV ) )
			vec4 engineGbL = vec4( transformed, 1.0 );
			#ifdef USE_BATCHING
				engineGbL = batchingMatrix * engineGbL;
			#endif
			vec3 engineGbDL = vec3( 0.0 );
			#if defined( USE_INSTANCING ) && defined( ENGINE_GBUFFER_INSTANCE_PREV )
				engineGbDL = ( ( instancePrevMatrix - instanceMatrix ) * engineGbL ).xyz;
			#endif
			#ifdef ENGINE_GBUFFER_PREV
				#ifdef USE_INSTANCING
					engineGbL = instanceMatrix * engineGbL;
				#endif
				engineGbD = mat3( enginePrevModelView ) * engineGbDL + ( ( enginePrevModelView - modelViewMatrix ) * engineGbL ).xyz;
			#else
				engineGbD = mat3( modelViewMatrix ) * engineGbDL;
			#endif
		#endif
		vEngineClipCur = engineUnjitteredProj * mvPosition;
		vEngineClipPrev = engineViewToPrevClip * vec4( mvPosition.xyz + engineGbD, 1.0 );
	}
#endif
`,_e=`
#ifdef ENGINE_GBUFFER
	#ifdef gl_FragColor
		layout( location = 1 ) out highp vec4 engineGbNormal;
		layout( location = 2 ) out highp vec4 engineGbVelocity;
	#endif
	varying highp vec4 vEngineClipCur;
	varying highp vec4 vEngineClipPrev;
	vec3 engineGbN = vec3( 0.0 );
	float engineGbRoughness = 1.0;
	float engineGbMetalness = 0.0;
	float engineGbFlagSum = 0.0;
	vec2 engineOctEncode( vec3 n ) {
		n /= abs( n.x ) + abs( n.y ) + abs( n.z );
		return n.z >= 0.0 ? n.xy : ( 1.0 - abs( n.yx ) ) * vec2( n.x >= 0.0 ? 1.0 : - 1.0, n.y >= 0.0 ? 1.0 : - 1.0 );
	}
#endif
`,K=`
#if defined( ENGINE_GBUFFER_ZERO ) && ! defined( ENGINE_GBUFFER ) && defined( gl_FragColor ) && ! defined( ENGINE_GBUFFER_ZERO_MAIN )
	#define ENGINE_GBUFFER_ZERO_MAIN
	layout( location = 1 ) out highp vec4 engineGbNormal;
	layout( location = 2 ) out highp vec4 engineGbVelocity;
	void engineGbUserMain();
	void main() {
		engineGbUserMain();
		engineGbNormal = vec4( 0.0 );
		engineGbVelocity = vec4( 0.0 );
	}
	#define main engineGbUserMain
#endif
`,pe=`
#ifdef ENGINE_GBUFFER
	engineGbN = normal;
	engineGbFlagSum += 2.0;
#endif
`,ve=`
#ifdef ENGINE_GBUFFER
	engineGbRoughness = roughnessFactor;
#endif
`,Ee=`
#ifdef ENGINE_GBUFFER
	engineGbMetalness = metalnessFactor;
#endif
`,Ge=`
#ifdef ENGINE_GBUFFER
	{
		highp vec2 engineGbVel = vec2( 0.0 );
		#ifdef ENGINE_GBUFFER_NOVEL
			engineGbFlagSum += 8.0;
		#else
			if ( vEngineClipPrev.w > 0.0 ) engineGbVel = ( vEngineClipCur.xy / vEngineClipCur.w - vEngineClipPrev.xy / vEngineClipPrev.w ) * 0.5;
			else engineGbFlagSum += 8.0;
		#endif
		vec2 engineGbE = dot( engineGbN, engineGbN ) > 0.0 ? engineOctEncode( normalize( engineGbN ) ) * 0.5 + 0.5 : vec2( 0.5 );
		float engineGbA = floor( clamp( engineGbMetalness, 0.0, 1.0 ) * 15.0 + 0.5 ) * 16.0 + engineGbFlagSum + 1.0;
		engineGbNormal = vec4( engineGbE, clamp( engineGbRoughness, 0.0, 1.0 ), engineGbA / 255.0 );
		engineGbVelocity = vec4( engineGbVel, 0.0, 0.0 );
	}
#endif
`,I=Object.freeze({clipping_planes_pars_vertex:de,project_vertex:ge,clipping_planes_pars_fragment:_e+K.slice(1),normal_fragment_maps:pe,roughnessmap_fragment:ve,metalnessmap_fragment:Ee,dithering_fragment:Ge}),De=`
const int ENGINE_GB_WROTE = 1;
const int ENGINE_GB_HAS_NORMAL = 2;
const int ENGINE_GB_NO_HISTORY = 8;
vec3 engineOctDecode( vec2 e ) {
	vec2 f = e * 2.0 - 1.0;
	vec3 n = vec3( f, 1.0 - abs( f.x ) - abs( f.y ) );
	float t = max( - n.z, 0.0 );
	n.x += n.x >= 0.0 ? - t : t;
	n.y += n.y >= 0.0 ? - t : t;
	return normalize( n );
}
int engineGbByte( float a ) { return int( a * 255.0 + 0.5 ); }
float engineGbMetal( float a ) { return float( engineGbByte( a ) >> 4 ) / 15.0; }
int engineGbFlags( float a ) { return engineGbByte( a ) & 15; }
`,O=n=>({get elements(){return n.value.elements}}),T={engineUnjitteredProj:O(N.engineUnjitteredProj),engineViewToPrevClip:O(N.engineViewToPrevClip)};let E=null;function me(){if(E!==null)return E;const n=ie,e=se;if(typeof n.project_vertex=="string"&&n.project_vertex.includes("vEngineClipCur"))return E=!0;const t=["basic","lambert","phong","standard","physical","toon","matcap"],s=[[n.project_vertex,"mvPosition = modelViewMatrix * mvPosition;"],[n.project_vertex,"gl_Position = projectionMatrix * mvPosition;"],[n.normal_fragment_begin,"vec3 normal ="],[n.roughnessmap_fragment,"float roughnessFactor"],[n.metalnessmap_fragment,"float metalnessFactor"],[n.dithering_fragment,"DITHERING"],[n.clipping_planes_pars_vertex,"NUM_CLIPPING_PLANES"],[n.clipping_planes_pars_fragment,"NUM_CLIPPING_PLANES"],[n.normal_fragment_maps,"normal ="]];for(const i of t){const r=e[i]||{};s.push([U(r.vertexShader,"clipping_planes_pars_vertex")?r.vertexShader:null,"#include <project_vertex>"]),s.push([U(r.fragmentShader,"clipping_planes_pars_fragment")?Ne(r.fragmentShader):null,"dithering_fragment"])}if(!s.every(([i,r])=>typeof i=="string"&&i.includes(r)))return console.warn("[render] G-buffer: three.js shader chunks changed, the G-buffer is unavailable"),E=!1;for(const i in I)n[i]=ye(n[i],I[i]);for(const i in e){const r=e[i];if(!(!r||!r.uniforms||typeof r.vertexShader!="string"||!r.vertexShader.includes("#include <clipping_planes_pars_vertex>")))for(const a in T)r.uniforms[a]||(r.uniforms[a]={value:T[a]})}return E=!0}function ye(n,e){return n.endsWith(`
`)?n+e.slice(1):n+e.slice(0,-1)}function U(n,e){if(typeof n!="string")return!1;const t=n.indexOf(`#include <${e}>`),s=n.search(/void\s+main\s*\(/);return t>=0&&s>t}function Ne(n){const e=typeof n=="string"?n.match(/#include <[a-z_]+>/g):null;return e?e[e.length-1]:null}function Me(n,e,{colorType:t=C,colorFormat:s=P,depthTexture:i}={}){const r=Math.max(1,n|0),a=Math.max(1,e|0),o=new q(r,a,{count:3,samples:0,type:t,format:s,depthBuffer:!0,stencilBuffer:!1,depthTexture:i||new Y(r,a,J),generateMipmaps:!1,minFilter:x,magFilter:x}),[c,f,l]=o.textures;c.name="GBuffer.color",f.name="GBuffer.normal",f.type=Q,f.format=P,l.name="GBuffer.velocity",l.type=C,l.format=ee;for(const u of[f,l])u.colorSpace=te,u.minFilter=u.magFilter=ne;return o}const g=1,G=2,_=3,A=4,L=0,F=(n,e)=>Object.prototype.hasOwnProperty.call(n,e),Z=n=>!!(n.isMeshStandardMaterial||n.isMeshLambertMaterial||n.isMeshPhongMaterial||n.isMeshToonMaterial||n.isMeshBasicMaterial||n.isMeshMatcapMaterial),be=n=>!!(Z(n)||n.isMeshNormalMaterial||n.isMeshDepthMaterial||n.isMeshDistanceMaterial||n.isLineBasicMaterial||n.isPointsMaterial||n.isSpriteMaterial),we=n=>n.isShaderMaterial&&!n.isRawShaderMaterial&&n.glslVersion!==fe,Re=n=>n.transparent===!0||n.blending!==le&&n.blending!==ce,B=(n,e)=>!!(n.defines&&n.defines[e]!==void 0);function h(n,e,t){return t===B(n,e)?!1:(t?(n.defines||(n.defines={}))[e]=1:delete n.defines[e],!0)}function D(n,e,t){const s={ownOBC:F(n,"onBeforeCompile"),ownKey:F(n,"customProgramCacheKey"),prev:n.onBeforeCompile,prevKey:n.customProgramCacheKey},i=s.prev,r=s.prevKey;return s.obc=function(a,o){i.call(this,a,o),e(a,o)},s.key=s.ownKey?function(){return`${r.call(this)}|${t}`}:function(){return`${i.toString()}|${t}`},n.onBeforeCompile=s.obc,n.customProgramCacheKey=s.key,s}function V(n,e){return n.onBeforeCompile!==e.obc||n.customProgramCacheKey!==e.key?!1:(e.ownOBC?n.onBeforeCompile=e.prev:delete n.onBeforeCompile,e.ownKey?n.customProgramCacheKey=e.prevKey:delete n.customProgramCacheKey,!0)}function M(n,e,t,s=!1){const i={o:n,name:e,own:F(n,e),prev:n[e],active:!0},r=i.prev;return i.f=s?function(a,o,c,f,l,u){i.active&&t.call(this,a,o,c,f,l,u),r.call(this,a,o,c,f,l,u)}:function(a,o,c,f,l,u){r.call(this,a,o,c,f,l,u),i.active&&t.call(this,a,o,c,f,l,u)},n[e]=i.f,i}function b(n){n.active=!1,n.o[n.name]===n.f&&(n.own?n.o[n.name]=n.prev:delete n.o[n.name])}const w=new WeakMap,Fe=n=>{n.fragmentShader.includes("ENGINE_GBUFFER_ZERO_MAIN")||(n.fragmentShader=K+n.fragmentShader)},Be=36064,Se=0,Ce=[],Pe=[];let y=0;function H(n,e,t){let s=n[e];if(!s){s=n[e]=[];for(let i=0;i<e;i++)s.push(i===0||t?Be+i:Se)}return s}function j(n,e){if(B(e,p)||B(e,v))return;const t=n.getRenderTarget();t===null||!t.textures||t.textures.length<2||(y=t.textures.length,n.getContext().drawBuffers(H(Ce,y,!1)))}function ke(n){y!==0&&(n.getContext().drawBuffers(H(Pe,y,!0)),y=0)}function xe(n,e,t,s){s&&s.textures&&s.textures.length>1&&t&&he(t)}const d=[];let z=!1;function Ie(n,e,t,s,i){if(d.length===0)return;const r=this.defines;if(r&&(r[p]!==void 0||r[v]!==void 0))return;const a=n.getRenderTarget();if(a!==null){for(let o=0;o<d.length;o++)if(d[o].target===a){d[o]._lazy(this,i,n);return}}}function Oe(){if(z)return;z=!0;const n=oe.prototype,e=n.onBeforeRender;n.onBeforeRender=function(t,s,i,r,a,o){e.call(this,t,s,i,r,a,o),Ie.call(this,t,s,i,r,a,o)}}const W=new Float32Array(4),S=new $,Te=["onBeforeCompile","customProgramCacheKey","onBeforeRender"];function Ue(n,e){const t=n.userData,s=n.isShaderMaterial?n.uniforms:null;n.userData={},s&&(n.uniforms={});let i;try{i=n.clone()}finally{n.userData=t,s&&(n.uniforms=s)}i.userData={...t},s&&(i.uniforms={...s},delete i.uniforms.enginePrevModelView),n.defines&&(i.defines={...n.defines});for(const r of Te){const a=e(r);a!==void 0&&(i[r]=a)}return i.defines&&(delete i.defines[R],delete i.defines[v]),i}class Ve{constructor(e,{width:t,height:s,color:i,nonWriters:r="zero",autoSync:a=!0}={}){this.renderer=e;const o=!(e&&e.extensions&&e.extensions.has)||e.extensions.has("EXT_color_buffer_float");o||console.warn("[GBuffer] EXT_color_buffer_float is unavailable: the G-buffer target cannot be rendered (supported = false)"),this.supported=o&&me();let c=t,f=s;!(c>0&&f>0)&&e&&e.getDrawingBufferSize&&(e.getDrawingBufferSize(S),c=S.x,f=S.y);const l=i&&(i.format!==void 0||i.type!==void 0)?{colorFormat:i.format??P,colorType:i.type??C}:{colorFormat:ae,colorType:re};this.target=Me(c||1,f||1,l),this.nonWriters=r==="mask"?"mask":"zero",this._stats={materialsDefined:0,materialsZero:0,materialsMasked:0,tracked:0,pools:0},this._statsDirty=!1,this._mats=new Map,this._hooks=new Map,this._scenes=new Map,this._recs=[],this._recOf=new Map,this._owner=new Map,this._pools=[],this._warned=new Set,this._changed=0,this._syncObject=u=>this._syncObj(u),this._unsyncObject=u=>this._unsyncObj(u),this._onMatDispose=u=>this._forget(u.target),this.autoSync=!!a&&this.supported,this.autoSync&&(Oe(),d.push(this))}get stats(){return this._statsDirty&&this._countStats(),this._stats}get color(){return this.target.textures[0]}get normal(){return this.target.textures[1]}get velocity(){return this.target.textures[2]}get depth(){return this.target.depthTexture}setSize(e,t){this.target.setSize(Math.max(1,e|0),Math.max(1,t|0))}sync(e){if(!e||!this.supported)return 0;if(e.isScene&&!this._scenes.has(e)){const t={onChildAdded:s=>this.sync(s.child),before:M(e,"onBeforeRender",xe)};e.addEventListener("childadded",t.onChildAdded),this._scenes.set(e,t),!this.autoSync&&e.background&&e.background.isTexture&&this._warnOnce("background","[GBuffer] scene.background textures are drawn by an internal three.js mesh that sync() cannot see: use autoSync, or draw the sky as a scene object")}return this._changed=0,e.traverse(this._syncObject),this._statsDirty=!0,this._changed}unsync(e){if(!e)return;e.traverse(this._unsyncObject);const t=this._scenes.get(e);t&&(e.removeEventListener("childadded",t.onChildAdded),b(t.before),this._scenes.delete(e)),this._statsDirty=!0}track(e,{clone:t=!1}={}){if(!e)return 0;const s=[];if(e.traverse(o=>{o.isMesh&&o.material&&!this._recOf.has(o)&&s.push(o)}),!s.length)return 0;let i=e;for(;i.parent;)i=i.parent;const r=new Map,a=new Set;i.traverse(o=>{if(!o.material)return;const c=Array.isArray(o.material)?o.material:[o.material];for(const f of c){if(!f)continue;const l=r.get(f);l===void 0?r.set(f,o):l!==o&&a.add(f)}});for(const o of s)this._trackMesh(o,a,t);return this._statsDirty=!0,s.length}untrack(e){e&&(e.traverse(t=>{const s=this._recOf.get(t);s&&this._untrackRec(s)}),this._statsDirty=!0)}trackPool(e){e&&!this._pools.includes(e)&&this._pools.push(e),this._statsDirty=!0}untrackPool(e){const t=this._pools.indexOf(e);t>=0&&this._pools.splice(t,1),this._statsDirty=!0}endFrame(){const e=this._recs;for(let s=0;s<e.length;s++){const i=e[s];i.drawn&&i.prevWorld.copy(i.mesh.matrixWorld),i.hasPrev=i.drawn,i.drawn=!1}const t=this._pools;for(let s=0;s<t.length;s++)t[s].capturePrev()}clear(e=this.renderer){const t=e.getRenderTarget(),s=e.getActiveCubeFace(),i=e.getActiveMipmapLevel();t!==this.target&&e.setRenderTarget(this.target);const r=e.getContext();e.state.buffers.color.setMask(!0),r.clearBufferfv(r.COLOR,1,W),r.clearBufferfv(r.COLOR,2,W),t!==this.target&&e.setRenderTarget(t,s,i)}dispose(){for(const t of[...this._scenes.keys()])this.unsync(t);for(const t of[...this._hooks.keys()])this._unhook(t);for(const[t,s]of this._mats)this._revert(t,s)&&(t.needsUpdate=!0),t.removeEventListener("dispose",this._onMatDispose);for(this._mats.clear();this._recs.length;)this._untrackRec(this._recs[this._recs.length-1]);this._pools.length=0,this._statsDirty=!0;const e=d.indexOf(this);e>=0&&d.splice(e,1),this.target.dispose()}_syncObj(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;const t=e.material;let s=!1;if(Array.isArray(t))for(let i=0;i<t.length;i++)t[i]&&this._syncMaterial(t[i])===_&&(s=!0);else t&&this._syncMaterial(t)===_&&(s=!0);s?this._hook(e):this._unhook(e)}_unsyncObj(e){this._unhook(e);const t=e.material;if(!t)return;const s=Array.isArray(t)?t:[t];for(const i of s){const r=i&&this._mats.get(i);r&&(this._revert(i,r)&&(i.needsUpdate=!0),i.removeEventListener("dispose",this._onMatDispose),this._mats.delete(i))}}_kind(e){if(e.visible===!1)return L;const t=we(e)||!e.isShaderMaterial&&be(e);if(e.colorWrite===!1)return t?G:_;const s=e.userData?e.userData.gbuffer:void 0,i=!Re(e);if(e.isShaderMaterial){if(s===!0||s==="novel"){if(i&&!e.isRawShaderMaterial)return g;this._warnOnce(`optin:${e.uuid}`,`[GBuffer] ShaderMaterial '${e.name||e.uuid}' has userData.gbuffer = ${s} but is ${e.isRawShaderMaterial?"a RawShaderMaterial":"blended"}: it does not write the G-buffer`)}const r=this._mats.get(e);if(s===void 0&&B(e,p)&&!(r&&r.own))return A}else if(i&&s!==!1&&Z(e))return g;return this.nonWriters==="zero"&&e.blending!==X&&t?G:_}_syncMaterial(e){const t=this._kind(e),s=t===g&&e.userData.gbuffer==="novel";let i=this._mats.get(e),r=!1;if(i===void 0?(i={kind:t,novel:s,own:!1,chain:null},this._mats.set(e,i),e.addEventListener("dispose",this._onMatDispose),this._statsDirty=!0):(i.kind!==t||i.novel!==s)&&(r=this._revert(e,i),i.kind=t,i.novel=s,i.own=!1,i.chain=null,this._statsDirty=!0),t===g){if(r=h(e,p,!0)||r,r=h(e,k,s)||r,i.own=!0,e.isShaderMaterial)for(const a of["engineUnjitteredProj","engineViewToPrevClip"])e.uniforms[a]||(e.uniforms[a]=N[a])}else t===G&&(r=h(e,v,!0)||r,e.isShaderMaterial&&!w.has(e)&&(i.chain=D(e,Fe,"engine-gbzero"),w.set(e,i.chain)));return r&&(e.needsUpdate=!0,this._changed++),t}_lazy(e,t,s){let i=this._mats.get(e);(i===void 0||i.kind===L)&&(this._syncMaterial(e),i=this._mats.get(e)),i.kind===_&&t&&!this._hooks.has(t)&&(this._hook(t),j(s,e))}_revert(e,t){let s=!1;return t.kind===g&&t.own&&(s=h(e,p,!1)||s,s=h(e,k,!1)||s),t.kind===G&&(s=h(e,v,!1)||s,t.chain&&(V(e,t.chain),w.delete(e))),s}_forget(e){e.removeEventListener("dispose",this._onMatDispose),this._mats.delete(e),this._statsDirty=!0}_hook(e){this._hooks.has(e)||this._hooks.set(e,{before:M(e,"onBeforeRender",function(t,s,i,r,a){j(t,a)}),after:M(e,"onAfterRender",function(t){ke(t)},!0)})}_unhook(e){const t=this._hooks.get(e);t&&(b(t.before),b(t.after),this._hooks.delete(e))}_trackMesh(e,t,s){const i={mesh:e,prevWorld:new m().copy(e.matrixWorld),u:{value:new m},hasPrev:!1,drawn:!1,mats:[]},r=Array.isArray(e.material)?e.material:[e.material],a=[],o=new Map;let c=!1;for(const f of r){if(!f){a.push(f);continue}let l=o.get(f);l===void 0&&(l=f,(s||t.has(f)||this._owner.has(f))&&(!s&&!this._warned.has("shared")&&(this._warned.add("shared"),console.info(`[GBuffer] track(): material '${f.name||f.type}' is shared with other meshes, so the tracked mesh got its own copy (per-object velocity needs one). This is expected; nothing to do. (Noted once; track(obj, { clone: true }) skips this note.)`)),l=Ue(f,u=>this._unwound(f,u)),this._mats.has(f)&&this._syncMaterial(l)),this._patchTracked(l,i),o.set(f,l)),l!==f&&(c=!0),a.push(l)}c&&(e.material=Array.isArray(e.material)?a:a[0]),this._recOf.set(e,i),this._recs.push(i)}_unwound(e,t){const s=[],i=this._owner.get(e);if(i)for(const c of i.mats)c.m===e&&(c.compile&&s.push(c.compile),s.push(c.render));const r=w.get(e);r&&s.push(r);let a=F(e,t),o=e[t];for(let c=0;a&&c<=s.length;c++){let f=!1;for(const l of s){if(t==="onBeforeCompile"&&l.obc===o){a=l.ownOBC,o=l.prev,f=!0;break}if(t==="customProgramCacheKey"&&l.key===o){a=l.ownKey,o=l.prevKey,f=!0;break}if(t==="onBeforeRender"&&l.f===o){a=l.own,o=l.prev,f=!0;break}}if(!f)break}return a?o:void 0}_patchTracked(e,t){const s={m:e,compile:null,render:null};e.isShaderMaterial?e.uniforms.enginePrevModelView=t.u:s.compile=D(e,i=>{i.uniforms.enginePrevModelView=t.u},"engine-gbprev"),s.render=M(e,"onBeforeRender",function(i,r,a,o,c){c===t.mesh?(t.u.value.multiplyMatrices(a.matrixWorldInverse,t.hasPrev?t.prevWorld:c.matrixWorld),t.drawn=!0):t.u.value.multiplyMatrices(a.matrixWorldInverse,c.matrixWorld)}),h(e,R,!0),e.needsUpdate=!0,this._owner.set(e,t),t.mats.push(s)}_untrackRec(e){for(const s of e.mats){const i=s.m;s.compile?V(i,s.compile):i.uniforms&&i.uniforms.enginePrevModelView===e.u&&delete i.uniforms.enginePrevModelView,b(s.render),h(i,R,!1)&&(i.needsUpdate=!0),this._owner.get(i)===e&&this._owner.delete(i)}e.mats.length=0,this._recOf.delete(e.mesh);const t=this._recs.indexOf(e);t>=0&&(this._recs[t]=this._recs[this._recs.length-1],this._recs.pop())}_countStats(){let e=0,t=0,s=0;for(const r of this._mats.values())r.kind===g||r.kind===A?e++:r.kind===G?t++:r.kind===_&&s++;const i=this._stats;i.materialsDefined=e,i.materialsZero=t,i.materialsMasked=s,i.tracked=this._recs.length,i.pools=this._pools.length,this._statsDirty=!1}_warnOnce(e,t){this._warned.has(e)||(this._warned.add(e),console.warn(t))}}export{I as G,ge as a,Le as b,De as c,N as d,Ve as e,Me as f,me as i,he as u};
