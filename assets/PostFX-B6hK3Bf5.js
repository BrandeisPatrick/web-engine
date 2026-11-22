import"./three.module-Dt1S_jJM.js";import{P as E,F as N}from"./Pass-CoGsOzd1.js";import{v as F,bD as K,l as p,b as w,H as P,x as B,cF as Ht,C as R,V as y,M as b,cX as Vt,ad as Ke,aM as ae,n as re,I as A,by as Gt,j as $t,L as Wt,ah as V,a as q,aD as Tt,aJ as Ft,cZ as Ee,b_ as Xt,ac as qt,t as Kt,s as Jt,bp as Yt}from"./three.core-BG5Iv3B7.js";import{c as oe,d as Je,i as Qt,e as Zt}from"./GBuffer-Dhsz133z.js";const ve={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class es extends E{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof F?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=K.clone(e.uniforms),this.material=new F({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new N(this.material)}render(e,t,s){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=s.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Ye extends E{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,s){const i=e.getContext(),a=e.state;a.buffers.color.setMask(!1),a.buffers.depth.setMask(!1),a.buffers.color.setLocked(!0),a.buffers.depth.setLocked(!0);let o,n;this.inverse?(o=0,n=1):(o=1,n=0),a.buffers.stencil.setTest(!0),a.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),a.buffers.stencil.setFunc(i.ALWAYS,o,4294967295),a.buffers.stencil.setClear(n),a.buffers.stencil.setLocked(!0),e.setRenderTarget(s),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),a.buffers.color.setLocked(!1),a.buffers.depth.setLocked(!1),a.buffers.color.setMask(!0),a.buffers.depth.setMask(!0),a.buffers.stencil.setLocked(!1),a.buffers.stencil.setFunc(i.EQUAL,1,4294967295),a.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),a.buffers.stencil.setLocked(!0)}}class ts extends E{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class ss{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const s=e.getSize(new p);this._width=s.width,this._height=s.height,t=new w(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:P}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new es(ve),this.copyPass.material.blending=B,this.clock=new Ht}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let s=!1;for(let i=0,a=this.passes.length;i<a;i++){const o=this.passes[i];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),o.render(this.renderer,this.writeBuffer,this.readBuffer,e,s),o.needsSwap){if(s){const n=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(n.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(n.EQUAL,1,4294967295)}this.swapBuffers()}Ye!==void 0&&(o instanceof Ye?s=!0:o instanceof ts&&(s=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new p);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const s=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(s,i),this.renderTarget2.setSize(s,i);for(let a=0;a<this.passes.length;a++)this.passes[a].setSize(s,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class is extends E{constructor(e,t,s=null,i=null,a=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=s,this.clearColor=i,this.clearAlpha=a,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new R}render(e,t,s){const i=e.autoClear;e.autoClear=!1;let a,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(a=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:s),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(a),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),e.autoClear=i}}const he={defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new p},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new b},cameraProjectionMatrixInverse:{value:new b},cameraWorldMatrix:{value:new b},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new y(-1,-1,-1)},sceneBoxMax:{value:new y(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);
			if (depth >= 1.0) {
				discard;
				return;
			}
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function as(r=5){const e=Math.floor(r)%2===0?Math.floor(r)+1:Math.floor(r),t=rs(e),s=t.length,i=new Uint8Array(s*4);for(let o=0;o<s;++o){const n=t[o],l=2*Math.PI*n/s,u=new y(Math.cos(l),Math.sin(l),0).normalize();i[o*4]=(u.x*.5+.5)*255,i[o*4+1]=(u.y*.5+.5)*255,i[o*4+2]=127,i[o*4+3]=255}const a=new Vt(i,e,e);return a.wrapS=Ke,a.wrapT=Ke,a.needsUpdate=!0,a}function rs(r){const e=Math.floor(r)%2===0?Math.floor(r)+1:Math.floor(r),t=e*e,s=Array(t).fill(0);let i=Math.floor(e/2),a=e-1;for(let o=1;o<=t;){if(i===-1&&a===e?(a=e-2,i=0):(a===e&&(a=0),i<0&&(i=e-1)),s[i*e+a]!==0){a-=2,i++;continue}else s[i*e+a]=o++;a++,i--}return s}const Oe=["depth","gbuffer"],os=6e4,Te={uniforms:{tAO:{value:null},uTexel:{value:new p},uDir:{value:new p(1,0)}},vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    uniform sampler2D tAO;
    uniform vec2 uTexel;
    uniform vec2 uDir;
    varying vec2 vUv;
    void main() {
      vec2 c = texture2D( tAO, vUv ).rg;
      float z = c.g;
      float tol = 0.06 * z + 0.15; // depth tolerance grows with distance
      float sum = c.r * 0.38, wsum = 0.38;
      for ( int i = 1; i <= 2; i ++ ) {
        float w0 = i == 1 ? 0.24 : 0.07;
        vec2 o = uDir * uTexel * float( i );
        vec2 a = texture2D( tAO, vUv + o ).rg;
        vec2 b = texture2D( tAO, vUv - o ).rg;
        float wa = w0 * clamp( 1.0 - abs( a.g - z ) / tol, 0.0, 1.0 );
        float wb = w0 * clamp( 1.0 - abs( b.g - z ) / tol, 0.0, 1.0 );
        sum += a.r * wa + b.r * wb; wsum += wa + wb;
      }
      gl_FragColor = vec4( sum / wsum, z, 0.0, 1.0 );
    }`};class ns extends E{constructor(e,t={}){super(),this.needsSwap=!1,this.camera=e,this.scale=t.resolutionScale??.5,this.maxPixels=t.maxPixels??1/0,this.upsample=t.upsample??"linear",this.fadeNear=t.fadeNear??140,this.fadeFar=t.fadeFar??320,this._compact=!!t.compact,this._size=new p(1,1);const s={type:P,format:this._compact?ae:re,depthBuffer:!1,minFilter:A,magFilter:A};this.rtA=new w(1,1,s),this.rtB=new w(1,1,s),this.rtA.texture.name="AO.a",this.rtB.texture.name="AO.b",this.rtA.texture.generateMipmaps=this.rtB.texture.generateMipmaps=!1;let i=he.fragmentShader;i=i.replace("float radiusToUse = radius;","float radiusToUse = min( radius, -viewPos.z * 0.35 );"),i=i.replace("vec3 viewNormal = getViewNormal(vUv);",`if ( -viewPos.z > AO_FADE_FAR ) { gl_FragColor = vec4( 1.0, -viewPos.z, 0.0, 1.0 ); return; }
			vec3 viewNormal = getViewNormal(vUv);`),i.includes("AO_FADE_FAR ) {")||console.warn("[render] GTAO early-out patch point missing"),this._fragDepth=i,this._fragGBuffer=us(i),this._normals=Qe(t.normals??"depth"),this._gbuffer=null,this._gbOn=!1,this._warnedNoGBuffer=!1,this.material=new F({name:"PostFXGTAO",defines:{...he.defines,PERSPECTIVE_CAMERA:1,SAMPLES:t.samples??12,NORMAL_VECTOR_TYPE:0,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCENE_CLIP_BOX:0,AO_FADE_NEAR:this.fadeNear.toFixed(1),AO_FADE_FAR:this.fadeFar.toFixed(1),FRAGMENT_OUTPUT:"vec4( mix( ao, 1.0, smoothstep( AO_FADE_NEAR, AO_FADE_FAR, -viewPos.z ) ), -viewPos.z, 0.0, 1.0 )"},uniforms:K.clone(he.uniforms),vertexShader:he.vertexShader,fragmentShader:i,blending:B,depthTest:!1,depthWrite:!1});const a=this.material.uniforms;a.tNoise.value=as(),a.radius.value=t.radius??1.8,a.thickness.value=t.thickness??1.6,a.distanceExponent.value=t.distanceExponent??1.6,a.distanceFallOff.value=1,a.scale.value=t.power??1,a.cameraNear.value=e.near,a.cameraFar.value=e.far,this.blur=new F({name:"PostFXAOBlur",uniforms:K.clone(Te.uniforms),vertexShader:Te.vertexShader,fragmentShader:Te.fragmentShader,blending:B,depthTest:!1,depthWrite:!1}),this._quad=new N(null),this._clear=new R,this._syncNormals()}get aoTexture(){return this.rtA.texture}get normals(){return this._normals}set normals(e){this._normals=Qe(e),this._syncNormals()}get gbuffer(){return this._gbuffer}set gbuffer(e){this._gbuffer=e??null,this._syncNormals()}setSize(e,t){this._size.set(e,t);let s=Math.max(1,Math.round(e*this.scale)),i=Math.max(1,Math.round(t*this.scale));if(s*i>this.maxPixels){const a=Math.sqrt(this.maxPixels/(e*t));s=Math.max(1,Math.floor(e*a)),i=Math.max(1,Math.floor(t*a))}this.rtA.setSize(s,i),this.rtB.setSize(s,i),this.material.uniforms.resolution.value.set(s,i),this.blur.uniforms.uTexel.value.set(1/s,1/i)}setResolution(e=this.scale,t=this.maxPixels){this.scale=e,this.maxPixels=t??1/0,this.setSize(this._size.x,this._size.y)}get compact(){return this._compact}set compact(e){if(!!e!==this._compact){this._compact=!!e;for(const t of[this.rtA,this.rtB])t.texture.format=this._compact?ae:re,t.dispose()}}render(e,t,s){const i=s.depthTexture;if(!i)return;const a=this.camera,o=this.material.uniforms;this._gbOn?o.tNormal.value=this._gbuffer.normal:this._normals==="gbuffer"&&this._gbuffer===null&&!this._warnedNoGBuffer&&(this._warnedNoGBuffer=!0,console.warn("[AOPass] normals 'gbuffer' without a G-buffer (aoPass.gbuffer is null): normals reconstructed from depth")),o.tDepth.value=i,o.cameraNear.value!==a.near&&(o.cameraNear.value=a.near),o.cameraFar.value!==a.far&&(o.cameraFar.value=a.far),o.cameraProjectionMatrix.value.copy(a.projectionMatrix),o.cameraProjectionMatrixInverse.value.copy(a.projectionMatrixInverse),o.cameraWorldMatrix.value.copy(a.matrixWorld),e.getClearColor(this._clear);const n=e.getClearAlpha(),l=e.autoClear;e.autoClear=!1,e.setRenderTarget(this.rtA),e.setClearColor(ls,1),e.clear(!0,!1,!1),this._quad.material=this.material,this._quad.render(e);const u=this.blur.uniforms,h=this._compact;this._quad.material=this.blur,u.tAO.value=this.rtA.texture,u.uDir.value.set(1,0),e.setRenderTarget(this.rtB),h&&e.clear(!0,!1,!1),this._quad.render(e),u.tAO.value=this.rtB.texture,u.uDir.value.set(0,1),e.setRenderTarget(this.rtA),h&&e.clear(!0,!1,!1),this._quad.render(e),e.setClearColor(this._clear,n),e.autoClear=l}dispose(){this.rtA.dispose(),this.rtB.dispose(),this.material.dispose(),this.blur.dispose(),this._quad.dispose(),this.material.uniforms.tNoise.value.dispose()}_syncNormals(){const e=this._normals==="gbuffer"&&this._gbuffer!==null&&this._fragGBuffer!==null;if(e===this._gbOn)return;this._gbOn=e;const t=this.material;t.fragmentShader=e?this._fragGBuffer:this._fragDepth,e?t.defines.AO_GBUFFER_NORMAL=1:(delete t.defines.AO_GBUFFER_NORMAL,t.uniforms.tNormal.value=null),t.needsUpdate=!0}}const ls=new R(1,os,0);function Qe(r){if(!Oe.includes(r))throw new Error(`[AOPass] normals: unknown value '${r}' ('depth' | 'gbuffer')`);return r}function us(r){const e="vec3 getViewNormal(const vec2 uv) {",t="#if NORMAL_VECTOR_TYPE == 2",s=r.indexOf(e),i=s<0?-1:r.indexOf(t,s);return i<0?(console.warn("[render] GTAO getViewNormal patch point missing: AO normals 'gbuffer' unavailable"),null):r.slice(0,s)+oe+`
		`+r.slice(s,i)+`#ifdef AO_GBUFFER_NORMAL
				// the scene pass's view-space normal (normal maps included): the nearest full-resolution texel under
				// this AO pixel, where a lit material wrote one; reconstructed from depth elsewhere
				vec4 gbN = textureLod(tNormal, uv, 0.);
				if ((engineGbFlags(gbN.a) & ENGINE_GB_HAS_NORMAL) != 0) return engineOctDecode(gbN.rg);
				return computeNormalFromDepth(uv);
			#elif NORMAL_VECTOR_TYPE == 2`+r.slice(i+t.length)}const hs={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new R(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class G extends E{constructor(e,t=1,s,i){super(),this.strength=t,this.radius=s,this.threshold=i,this.resolution=e!==void 0?new p(e.x,e.y):new p(256,256),this.clearColor=new R(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new w(a,o,{type:P}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){const c=new w(a,o,{type:P});c.texture.name="UnrealBloomPass.h"+h,c.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(c);const f=new w(a,o,{type:P});f.texture.name="UnrealBloomPass.v"+h,f.texture.generateMipmaps=!1,this.renderTargetsVertical.push(f),a=Math.round(a/2),o=Math.round(o/2)}const n=hs;this.highPassUniforms=K.clone(n.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new F({uniforms:this.highPassUniforms,vertexShader:n.vertexShader,fragmentShader:n.fragmentShader}),this.separableBlurMaterials=[];const l=[3,5,7,9,11];a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new p(1/a,1/o),a=Math.round(a/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const u=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=u,this.bloomTintColors=[new y(1,1,1),new y(1,1,1),new y(1,1,1),new y(1,1,1),new y(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=K.clone(ve.uniforms),this.blendMaterial=new F({uniforms:this.copyUniforms,vertexShader:ve.vertexShader,fragmentShader:ve.fragmentShader,blending:Gt,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new R,this._oldClearAlpha=1,this._basic=new $t,this._fsQuad=new N(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let s=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(s,i);for(let a=0;a<this.nMips;a++)this.renderTargetsHorizontal[a].setSize(s,i),this.renderTargetsVertical[a].setSize(s,i),this.separableBlurMaterials[a].uniforms.invSize.value=new p(1/s,1/i),s=Math.round(s/2),i=Math.round(i/2)}render(e,t,s,i,a){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),a&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=s.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=s.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let n=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=n.texture,this.separableBlurMaterials[l].uniforms.direction.value=G.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=G.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this._fsQuad.render(e),n=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(s),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){const t=[];for(let s=0;s<e;s++)t.push(.39894*Math.exp(-.5*s*s/(e*e))/e);return new F({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new p(.5,.5)},direction:{value:new p(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}_getCompositeMaterial(e){return new F({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}G.BlurDirectionX=new p(1,0);G.BlurDirectionY=new p(0,1);const Fe={uniforms:{tDiffuse:{value:null},uTexel:{value:new p},uThreshold:{value:2},uKnee:{value:.8},uMax:{value:40}},vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uThreshold, uKnee, uMax;
    varying vec2 vUv;
    vec3 tap( vec2 o ) { return min( texture2D( tDiffuse, vUv + o * uTexel ).rgb, vec3( uMax ) ); }
    void main() {
      vec3 c = 0.25 * ( tap( vec2( -1.0, -1.0 ) ) + tap( vec2( 1.0, -1.0 ) ) + tap( vec2( -1.0, 1.0 ) ) + tap( vec2( 1.0, 1.0 ) ) );
      float l = max( c.r, max( c.g, c.b ) );
      float s = clamp( l - uThreshold + uKnee, 0.0, 2.0 * uKnee );
      s = s * s / ( 4.0 * uKnee + 1e-4 );
      float k = max( s, l - uThreshold ) / max( l, 1e-4 );
      gl_FragColor = vec4( c * k, 1.0 );
    }`};class cs extends G{constructor({strength:e=.4,radius:t=.5,threshold:s=2,resolutionScale:i=.5}={}){super(new p(256,256),e,t,s),this.resScale=i,this.knee=.8,this.maxBrightness=14,this.materialHighPassFilter.dispose(),this.materialHighPassFilter=new F({name:"PostFXBloomBright",uniforms:K.clone(Fe.uniforms),vertexShader:Fe.vertexShader,fragmentShader:Fe.fragmentShader,depthTest:!1,depthWrite:!1}),this.bloomFactors=[1,.85,.65,.45,.3],this.compositeMaterial.uniforms.bloomFactors.value=this.bloomFactors}get bloomTexture(){return this.renderTargetsHorizontal[0].texture}setSize(e,t){super.setSize(Math.max(2,e*this.resScale),Math.max(2,t*this.resScale));const s=2/this.resScale;this.materialHighPassFilter.uniforms.uTexel.value.set(s/4/e,s/4/t)}render(e,t,s){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const i=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0);const a=this.materialHighPassFilter.uniforms;a.tDiffuse.value=s.texture,a.uThreshold.value=this.threshold,a.uKnee.value=Math.max(.05,this.knee),a.uMax.value=this.maxBrightness,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),this._fsQuad.render(e);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++){const u=this.separableBlurMaterials[l];this._fsQuad.material=u,u.uniforms.colorTexture.value=o.texture,u.uniforms.direction.value=G.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),this._fsQuad.render(e),u.uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,u.uniforms.direction.value=G.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),this._fsQuad.render(e),o=this.renderTargetsVertical[l]}const n=this.compositeMaterial.uniforms;this._fsQuad.material=this.compositeMaterial,n.bloomStrength.value=this.strength,n.bloomRadius.value=this.radius,n.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),this._fsQuad.render(e),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=i}}const Ze="varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }";class fs extends E{constructor(){super(),this.needsSwap=!1,this.speed=1.6,this.lumRT=new w(64,64,{type:P,depthBuffer:!1,minFilter:Wt,magFilter:A,generateMipmaps:!0}),this.lumRT.texture.name="Exposure.lum";const e={type:P,depthBuffer:!1,minFilter:V,magFilter:V};this.rtA=new w(1,1,e),this.rtB=new w(1,1,e),this.lumMat=new F({name:"PostFXLum",uniforms:{tColor:{value:null}},vertexShader:Ze,fragmentShader:`
        uniform sampler2D tColor; varying vec2 vUv;
        void main() {
          vec2 o = vec2( 0.25 / 64.0 );
          vec3 c = 0.25 * ( texture2D( tColor, vUv + o ).rgb + texture2D( tColor, vUv - o ).rgb + texture2D( tColor, vUv + vec2( o.x, -o.y ) ).rgb + texture2D( tColor, vUv - vec2( o.x, -o.y ) ).rgb );
          float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
          vec2 d = ( vUv - 0.5 ) * vec2( 1.0, 1.25 );
          float w = 1.0 - 0.7 * smoothstep( 0.1, 0.7, length( d ) ); // centre-weighted metering
          gl_FragColor = vec4( log2( clamp( l, 1e-4, 32.0 ) ) * w, w, 0.0, 1.0 );
        }`,depthTest:!1,depthWrite:!1,blending:B}),this.adaptMat=new F({name:"PostFXAdapt",uniforms:{tLum:{value:null},tPrev:{value:null},uRate:{value:1}},vertexShader:Ze,fragmentShader:`
        uniform sampler2D tLum, tPrev; uniform float uRate; varying vec2 vUv;
        void main() {
          vec2 s = textureLod( tLum, vec2( 0.5 ), 6.0 ).rg;
          float cur = s.r / max( s.g, 1e-4 );
          float prev = texture2D( tPrev, vec2( 0.5 ) ).r;
          gl_FragColor = vec4( mix( prev, cur, uRate ), 0.0, 0.0, 1.0 ); // adapted log2 luminance
        }`,depthTest:!1,depthWrite:!1,blending:B}),this._quad=new N(null),this._snap=!0}get texture(){return this.rtA.texture}reset(){this._snap=!0}render(e,t,s,i){this.lumMat.uniforms.tColor.value=s.texture,this._quad.material=this.lumMat,e.setRenderTarget(this.lumRT),this._quad.render(e);const a=this.rtA;this.rtA=this.rtB,this.rtB=a;const o=this.adaptMat.uniforms;o.tLum.value=this.lumRT.texture,o.tPrev.value=this.rtB.texture;const n=Math.min(.25,Math.max(0,i||0));o.uRate.value=this._snap?1:1-Math.exp(-n*this.speed),this._snap=!1,this._quad.material=this.adaptMat,e.setRenderTarget(this.rtA),this._quad.render(e)}dispose(){this.lumRT.dispose(),this.rtA.dispose(),this.rtB.dispose(),this.lumMat.dispose(),this.adaptMat.dispose(),this._quad.dispose()}}const He=Object.freeze({scale:.5,maxPixels:1/0,steps:24,refine:4,maxDistance:80,thickness:.4,thicknessScale:0,maxRoughness:.5,edgeFade:.1,jitter:!1,metalTint:!0,source:"current",denoise:0,interval:1}),Pt=Object.freeze(["current"]),Ct="vec3 engineSsrComposite( vec3 col, vec4 ssr ) { return col * ( 1.0 - ssr.a ) + ssr.rgb; }",Pe={vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    uniform sampler2D tColor; // this frame's HDR scene colour (linear filtering)
    uniform highp sampler2D tDepth; // its depth, standard 0..1
    uniform sampler2D tNormal; // G-buffer normal + roughness + metalness / flags (nearest)
    uniform mat4 uProj; // the camera's projection (jittered under TAA, as the depth) and its inverse
    uniform mat4 uProjInv;
    uniform vec2 uRes; // full-resolution size (px) of the three textures
    uniform float uNear, uFar;
    uniform float uMaxDistance, uThickness, uThicknessScale, uMaxRoughness, uEdgeFade;
    uniform int uFrame;
    varying vec2 vUv;

    ${oe}

    float linearDepth( float d ) { return uNear * uFar / ( uFar - ( uFar - uNear ) * d ); } // standard (not reversed) depth
    // depth at a march position in full-resolution pixels (nearest texel; positions stay inside [0.5, uRes - 0.5])
    float depthAt( vec2 px ) { return texelFetch( tDepth, ivec2( px ), 0 ).x; }
    // depth behind a surface at linear depth z that still counts as that surface (m)
    float band( float z ) { return uThickness + z * uThicknessScale; }

    // three's DFGApprox (Karis' analytic fit of the split-sum env BRDF): specular = F0 * A + f90 * B
    vec2 envBRDF( float NdotV, float roughness ) {
      const vec4 c0 = vec4( - 1.0, - 0.0275, - 0.572, 0.022 );
      const vec4 c1 = vec4( 1.0, 0.0425, 1.04, - 0.04 );
      vec4 r = roughness * c0 + c1;
      float a004 = min( r.x * r.x, exp2( - 9.28 * NdotV ) ) * r.x + r.y;
      return vec2( - 1.04, 1.04 ) * a004 + r.zw;
    }

    void main() {
      gl_FragColor = vec4( 0.0 ); // every early return is "no reflection": the forward colour stays
      ivec2 ip = min( ivec2( vUv * uRes ), ivec2( uRes ) - 1 ); // the full-resolution texel under this pixel
      vec4 gb = texelFetch( tNormal, ip, 0 );
      int flags = engineGbFlags( gb.a );
      float rough = gb.b;
      if ( ( flags & ENGINE_GB_WROTE ) == 0 || ( flags & ENGINE_GB_HAS_NORMAL ) == 0 || rough >= uMaxRoughness ) return;
      float d = texelFetch( tDepth, ip, 0 ).x;
      if ( d >= 1.0 ) return;

      // view-space surface point, view vector, normal, mirror direction
      vec2 uv = ( vec2( ip ) + 0.5 ) / uRes;
      vec4 hp = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      vec3 P = hp.xyz / hp.w;
      vec3 V = - normalize( P );
      vec3 N = engineOctDecode( gb.rg );
      float NdotV = dot( N, V );
      vec3 R = reflect( - V, N );

      // weight before tracing: specular share * roughness fade * toward-camera fade
      float metal = engineGbMetal( gb.a );
      vec2 fab = envBRDF( clamp( NdotV, 0.0, 1.0 ), rough );
      float fr = clamp( ( uMaxRoughness - rough ) / 0.2, 0.0, 1.0 );
      float w = clamp( mix( 0.04, 1.0, metal ) * fab.x + fab.y, 0.0, 1.0 ) * fr * fr * ( 3.0 - 2.0 * fr )
              * ( 1.0 - smoothstep( 0.0, 0.25, R.z ) );
      if ( NdotV <= 0.0 || w <= 0.0 ) return;

      // the ray in screen space: both ends projected once; screen position and 1 / w are affine along the segment
      float len = R.z > 0.0 ? min( uMaxDistance, ( - uNear - P.z ) / R.z ) : uMaxDistance; // stop at the near plane
      vec4 H0 = uProj * vec4( P, 1.0 ), H1 = uProj * vec4( P + R * len, 1.0 );
      float k0 = 1.0 / H0.w, k1 = 1.0 / H1.w; // 1 / linear depth at both ends
      vec2 S0 = ( H0.xy * k0 * 0.5 + 0.5 ) * uRes, S1 = ( H1.xy * k1 * 0.5 + 0.5 ) * uRes; // full-resolution pixels
      vec2 dS = S1 - S0;
      // march span in the segment parameter u (u = 1 at the ray end): from two pixels past the origin to where the
      // segment leaves the screen (the centres of the border texels)
      vec2 lim = mix( vec2( 0.5 ), uRes - 0.5, step( 0.0, dS ) );
      vec2 te = vec2( abs( dS.x ) > 1e-4 ? ( lim.x - S0.x ) / dS.x : 1.0, abs( dS.y ) > 1e-4 ? ( lim.y - S0.y ) / dS.y : 1.0 );
      float uEnd = min( 1.0, min( te.x, te.y ) );
      float u0 = 2.0 / max( length( dS ), 1e-4 ); // two pixels past the origin (see the header)
      if ( uEnd <= u0 ) return; // the ray stays near the origin's pixel or leaves the screen at once
      float zPrev = 1.0 / mix( k0, k1, u0 ); // linear depth of the ray at the march start
      float zStart = linearDepth( depthAt( mix( S0, S1, u0 ) ) );
      if ( zPrev > zStart && zPrev < zStart + band( zStart ) ) return; // starts inside a surface (normal-mapped self-hit)

    #ifdef SSR_JITTER
      // interleaved-gradient noise (Jimenez), a new pattern each frame (needs a temporal filter: see Limitations)
      float o = fract( 52.9829189 * fract( dot( gl_FragCoord.xy + 5.588238 * float( uFrame & 63 ), vec2( 0.06711056, 0.00583715 ) ) ) );
    #else
      float o = 0.5;
    #endif
      float du = ( uEnd - u0 ) / float( SSR_STEPS );
      float uPrev = u0, uHit = - 1.0, zHit = 0.0;
      for ( int i = 0; i < SSR_STEPS; i ++ ) {
        float u = u0 + ( float( i ) + o ) * du;
        float zRay = 1.0 / mix( k0, k1, u );
        float sd = depthAt( mix( S0, S1, u ) );
        float zScene = linearDepth( sd );
        // hit: the ray is behind the surface here and its depth span since the previous sample reaches into
        // [scene, scene + band] (crossing in one stride counts; coming out from behind or passing in front does not)
        if ( sd < 1.0 && zRay > zScene && min( zRay, zPrev ) < zScene + band( zScene ) ) { uHit = u; zHit = zScene; break; }
        uPrev = u; zPrev = zRay;
      }
      if ( uHit < 0.0 ) return; // miss: left the screen, reached maxDistance / the near plane, or only sky

      // bisection between the last miss and the hit. A midpoint behind its surface is the new hit end when it lies
      // inside that surface's band, or when that surface is not nearer than the hit end's by more than a band (the
      // same thick surface the stride crossed, or one the march stepped over before it); behind a nearer surface by
      // more than the band (an occluder the ray passed behind on its way to the hit) or in front: the new miss end
      float a = uPrev, b = uHit;
      for ( int i = 0; i < SSR_REFINE; i ++ ) {
        float m = 0.5 * ( a + b );
        float zs = linearDepth( depthAt( mix( S0, S1, m ) ) ), zr = 1.0 / mix( k0, k1, m );
        if ( zr > zs && ( zr < zs + band( zs ) || zs > zHit - band( zHit ) ) ) { b = m; zHit = zs; } else a = m;
      }

      vec2 hitUv = mix( S0, S1, b ) / uRes;
      float dist = len * b * k1 / mix( k0, k1, b ); // metres along the ray (t / w is affine in screen space too)
      vec2 e = min( hitUv, 1.0 - hitUv );
      w *= smoothstep( 0.0, uEdgeFade, min( e.x, e.y ) ) * ( 1.0 - smoothstep( 0.7, 1.0, dist / uMaxDistance ) );

      vec3 c = textureLod( tColor, hitUv, 0.0 ).rgb; // bilinear; explicit LOD (non-uniform control flow)
    #ifdef SSR_METAL_TINT
      if ( metal > 0.0 ) {
        // stopgap until the G-buffer carries F0 (see the header): the share assumed a white metal, so the reflected
        // radiance takes this pixel's hue and at most its brightness (a metal cannot reflect brighter than it renders)
        vec3 own = texelFetch( tColor, ip, 0 ).rgb;
        float maxC = max( own.r, max( own.g, own.b ) );
        c *= mix( vec3( 1.0 ), own / max( maxC, 1e-3 ) * min( 1.0, maxC / max( max( c.r, max( c.g, c.b ) ), 1e-3 ) ), metal );
      }
    #endif
      if ( ! all( lessThan( abs( c ), vec3( 65000.0 ) ) ) ) c = vec3( 0.0 ); // NaN / Inf from the scene: no reflection
      gl_FragColor = vec4( max( c, 0.0 ) * w, w );
    }`},ms={fragmentShader:`
    uniform sampler2D tSsr; // the traced (or half-blurred) reflections, premultiplied
    uniform highp sampler2D tDepth;
    uniform sampler2D tNormal;
    uniform vec2 uRes; // full-resolution size (px) of tDepth / tNormal
    uniform vec2 uDir; // one output texel along the blur axis (uv)
    uniform float uNear, uFar, uRadius, uMaxRoughness;
    varying vec2 vUv;

    ${oe}

    float linearDepth( float d ) { return uNear * uFar / ( uFar - ( uFar - uNear ) * d ); }

    void main() {
      vec4 c = texture2D( tSsr, vUv );
      ivec2 mx = ivec2( uRes ) - 1;
      ivec2 ip = min( ivec2( vUv * uRes ), mx );
      vec4 gb = texelFetch( tNormal, ip, 0 );
      int flags = engineGbFlags( gb.a );
      if ( ( flags & ENGINE_GB_WROTE ) == 0 || ( flags & ENGINE_GB_HAS_NORMAL ) == 0 ) { gl_FragColor = c; return; }
      float r = uRadius * mix( 0.35, 1.0, clamp( gb.b / uMaxRoughness, 0.0, 1.0 ) );
      // the taps' reflections first (the small texture): where they and the centre are all exactly 0 the result is 0
      // whatever the weights, so the depth / normal reads are skipped (the tap positions need the centre's
      // roughness). The taps are read again below (cache hits): an array of the eight cost more than it saved.
      bool lit = any( notEqual( c, vec4( 0.0 ) ) );
      if ( ! lit ) for ( int i = - 4; i <= 4; i ++ ) {
        if ( i == 0 ) continue;
        float t = float( i ) * 0.25; // -1 .. 1 across the radius
        vec2 uv = vUv + uDir * ( t * r );
        if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) continue;
        if ( any( notEqual( texture2D( tSsr, uv ), vec4( 0.0 ) ) ) ) { lit = true; break; }
      }
      if ( ! lit ) { gl_FragColor = vec4( 0.0 ); return; }
      float zc = linearDepth( texelFetch( tDepth, ip, 0 ).x );
      vec3 nc = engineOctDecode( gb.rg );
      float zk = 1.0 / ( 0.05 + 0.02 * zc );
      vec4 sum = c; float wsum = 1.0;
      for ( int i = - 4; i <= 4; i ++ ) {
        if ( i == 0 ) continue;
        float t = float( i ) * 0.25;
        vec2 uv = vUv + uDir * ( t * r );
        if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) continue;
        ivec2 tp = min( ivec2( uv * uRes ), mx );
        vec4 g = texelFetch( tNormal, tp, 0 );
        float z = linearDepth( texelFetch( tDepth, tp, 0 ).x );
        float nd = max( dot( nc, engineOctDecode( g.rg ) ), 0.0 ); nd *= nd; nd *= nd; nd *= nd;
        float w = exp( - 2.0 * t * t ) * exp( - abs( z - zc ) * zk ) * nd;
        sum += texture2D( tSsr, uv ) * w; wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`};class ps extends E{constructor(e,t,s,i={}){super(),this.needsSwap=!1,this.camera=e,this.history=t??null,this.gbuffer=s??null;const a={...He};for(const o in i)i[o]!==void 0&&(a[o]=i[o]);this._scale=D(a.scale,"scale",0,1,!0),this._maxPixels=D(a.maxPixels??1/0,"maxPixels",1,1/0),this._steps=Y(a.steps,"steps",1,128),this._refine=Y(a.refine,"refine",0,16),this._maxDistance=D(a.maxDistance,"maxDistance",0,1e5,!0),this._thickness=D(a.thickness,"thickness",0,1e5,!0),this._thicknessScale=D(a.thicknessScale,"thicknessScale",0,1),this._maxRoughness=D(a.maxRoughness,"maxRoughness",0,1,!0),this._edgeFade=D(a.edgeFade,"edgeFade",0,.5),this._jitter=!!a.jitter,this._metalTint=!!a.metalTint,this._source=tt(a.source),this._denoise=D(a.denoise,"denoise",0,16),this._interval=Y(a.interval,"interval",1,4),this._age=0,this._lastFrame=-2,this._stale=!0,this.tracedJitter=new p,this._blurRts=null,this._blurMat=null,this._blurQuad=null,this._w=1,this._h=1,this._rt=new w(1,1,{type:P,format:re,depthBuffer:!1,stencilBuffer:!1,minFilter:A,magFilter:A,generateMipmaps:!1}),this._rt.texture.name="SSR",this.material=new F({name:"PostFXSSR",defines:{},uniforms:{tColor:{value:null},tDepth:{value:null},tNormal:{value:null},uProj:{value:new b},uProjInv:{value:new b},uRes:{value:new p(1,1)},uNear:{value:.1},uFar:{value:1e3},uMaxDistance:{value:this._maxDistance},uThickness:{value:this._thickness},uThicknessScale:{value:this._thicknessScale},uMaxRoughness:{value:this._maxRoughness},uEdgeFade:{value:et(this._edgeFade)},uFrame:{value:0}},vertexShader:Pe.vertexShader,fragmentShader:Pe.fragmentShader,blending:B,depthTest:!1,depthWrite:!1}),this._syncDefines(),this._quad=new N(this.material),this._clear=new R}get texture(){return this._denoise>0&&this._blurRts!==null?this._blurRts[1].texture:this._rt.texture}get denoise(){return this._denoise}set denoise(e){this._stale=!0,this._denoise=D(e,"denoise",0,16),this._denoise>0&&this._ensureBlur()}get interval(){return this._interval}set interval(e){this._interval=Y(e,"interval",1,4),this._stale=!0}get age(){return this._age}get scale(){return this._scale}set scale(e){this._scale=D(e,"scale",0,1,!0),this.setSize(this._w,this._h)}get maxPixels(){return this._maxPixels}set maxPixels(e){this._maxPixels=D(e??1/0,"maxPixels",1,1/0),this.setSize(this._w,this._h)}get steps(){return this._steps}set steps(e){this._stale=!0,this._steps=Y(e,"steps",1,128),this._syncDefines()}get refine(){return this._refine}set refine(e){this._stale=!0,this._refine=Y(e,"refine",0,16),this._syncDefines()}get maxDistance(){return this._maxDistance}set maxDistance(e){this._stale=!0,this.material.uniforms.uMaxDistance.value=this._maxDistance=D(e,"maxDistance",0,1e5,!0)}get thickness(){return this._thickness}set thickness(e){this._stale=!0,this.material.uniforms.uThickness.value=this._thickness=D(e,"thickness",0,1e5,!0)}get thicknessScale(){return this._thicknessScale}set thicknessScale(e){this._stale=!0,this.material.uniforms.uThicknessScale.value=this._thicknessScale=D(e,"thicknessScale",0,1)}get maxRoughness(){return this._maxRoughness}set maxRoughness(e){this._stale=!0,this.material.uniforms.uMaxRoughness.value=this._maxRoughness=D(e,"maxRoughness",0,1,!0)}get edgeFade(){return this._edgeFade}set edgeFade(e){this._stale=!0,this._edgeFade=D(e,"edgeFade",0,.5),this.material.uniforms.uEdgeFade.value=et(this._edgeFade)}get jitter(){return this._jitter}set jitter(e){this._jitter=!!e,this._stale=!0,this._syncDefines()}get metalTint(){return this._metalTint}set metalTint(e){this._metalTint=!!e,this._stale=!0,this._syncDefines()}get source(){return this._source}set source(e){this._source=tt(e)}reset(){this._stale=!0}setSize(e,t){this._w=e,this._h=t,this._stale=!0;let s=Math.max(1,Math.round(e*this._scale)),i=Math.max(1,Math.round(t*this._scale));if(s*i>this._maxPixels){const a=Math.sqrt(this._maxPixels/(e*t));s=Math.max(1,Math.floor(e*a)),i=Math.max(1,Math.floor(t*a))}this._rt.setSize(s,i),this.material.uniforms.uRes.value.set(Math.max(1,e),Math.max(1,t)),this._blurRts!==null&&(this._blurRts[0].setSize(s,i),this._blurRts[1].setSize(s,i),this._blurMat.uniforms.uRes.value.set(Math.max(1,e),Math.max(1,t)))}_ensureBlur(){if(this._blurRts!==null)return;const e=t=>{const s=new w(this._rt.width,this._rt.height,{type:P,format:re,depthBuffer:!1,stencilBuffer:!1,minFilter:A,magFilter:A,generateMipmaps:!1});return s.texture.name=t,s};this._blurRts=[e("SSRBlurH"),e("SSR")],this._blurMat=new F({name:"PostFXSSRBlur",uniforms:{tSsr:{value:null},tDepth:{value:null},tNormal:{value:null},uRes:{value:this.material.uniforms.uRes.value.clone()},uDir:{value:new p},uNear:{value:.1},uFar:{value:1e3},uRadius:{value:0},uMaxRoughness:{value:1}},vertexShader:Pe.vertexShader,fragmentShader:ms.fragmentShader,blending:B,depthTest:!1,depthWrite:!1}),this._blurQuad=new N(this._blurMat),this._blurDirs=[new p,new p],this._blurDirW=0,this._blurDirH=0}render(e,t,s){const i=this.gbuffer,a=s.depthTexture,o=this.history,n=o!==null?o.uniforms.uFrame.value:0,l=this._interval===1||this._stale||o===null||o.fresh||n!==this._lastFrame+1||this._age+1>=this._interval;if(this._lastFrame=n,!l){this._age++;return}if(this._age=0,this._stale=!1,o!==null?this.tracedJitter.copy(o.uniforms.uJitter.value):this.tracedJitter.set(0,0),i===null||!a){e.getClearColor(this._clear);const c=e.getClearAlpha();e.setRenderTarget(this._rt),e.setClearColor(ds,0),e.clear(!0,!1,!1),e.setClearColor(this._clear,c);return}const u=this.material.uniforms,h=this.camera;if(u.tColor.value=s.texture,u.tDepth.value=a,u.tNormal.value=i.normal,u.uProj.value.copy(h.projectionMatrix),u.uProjInv.value.copy(h.projectionMatrixInverse),u.uNear.value!==h.near&&(u.uNear.value=h.near),u.uFar.value!==h.far&&(u.uFar.value=h.far),u.uFrame.value=o!==null?o.uniforms.uFrame.value:0,e.setRenderTarget(this._rt),this._quad.render(e),this._denoise>0){this._blurRts===null&&this._ensureBlur();const c=this._blurMat.uniforms,f=this._blurRts,m=this._rt.width,v=this._rt.height;c.tDepth.value=a,c.tNormal.value=i.normal,c.uNear.value!==h.near&&(c.uNear.value=h.near),c.uFar.value!==h.far&&(c.uFar.value=h.far),c.uRadius.value!==this._denoise&&(c.uRadius.value=this._denoise),c.uMaxRoughness.value!==this._maxRoughness&&(c.uMaxRoughness.value=this._maxRoughness);const _=this._blurDirs;(this._blurDirW!==m||this._blurDirH!==v)&&(this._blurDirW=m,this._blurDirH=v,_[0].set(1/m,0),_[1].set(0,1/v)),c.tSsr.value=this._rt.texture,c.uDir.value=_[0],e.setRenderTarget(f[0]),this._blurQuad.render(e),c.tSsr.value=f[0].texture,c.uDir.value=_[1],e.setRenderTarget(f[1]),this._blurQuad.render(e)}}dispose(){this._rt.dispose(),this.material.dispose(),this._quad.dispose(),this._blurRts!==null&&(this._blurRts[0].dispose(),this._blurRts[1].dispose(),this._blurMat.dispose(),this._blurQuad.dispose())}_syncDefines(){const e=this.material.defines;let t=!1;e.SSR_STEPS!==this._steps&&(e.SSR_STEPS=this._steps,t=!0),e.SSR_REFINE!==this._refine&&(e.SSR_REFINE=this._refine,t=!0),this._jitter!=="SSR_JITTER"in e&&(this._jitter?e.SSR_JITTER=1:delete e.SSR_JITTER,t=!0),this._metalTint!=="SSR_METAL_TINT"in e&&(this._metalTint?e.SSR_METAL_TINT=1:delete e.SSR_METAL_TINT,t=!0),t&&(this.material.needsUpdate=!0)}}const ds=new R(0,0,0),et=r=>Math.max(r,1e-4),Ve=r=>typeof r=="string"?`'${r}'`:String(r);function D(r,e,t,s,i=!1){if(typeof r!="number"||Number.isNaN(r)||(i?r<=t:r<t)||r>s)throw new Error(`[SSRPass] ${e}: expected a number in ${i?"(":"["}${t}, ${s}], got ${Ve(r)}`);return r}function Y(r,e,t,s){if(!Number.isInteger(r)||r<t||r>s)throw new Error(`[SSRPass] ${e}: expected an integer in [${t}, ${s}], got ${Ve(r)}`);return r}function tt(r){if(r==="history")throw new Error("[SSRPass] source: 'history' is reserved (not implemented yet); use 'current'");if(!Pt.includes(r))throw new Error(`[SSRPass] source: unknown value ${Ve(r)} ('current')`);return r}const ze=["variance","minmax"],Le=["catmull-rom","bilinear"],Ne=["rgba16f","r11g11b10"],Be=["quad","early","single"];function vs(r,e,t=new Float32Array(9)){let s=0;for(let i=0;i<9;i++){const a=i%3-1+r,o=(i/3|0)-1+e;s+=t[i]=Math.exp(-2.29*(a*a+o*o))}for(let i=0;i<9;i++)t[i]/=s;return t}const Dt=`
    uniform sampler2D tColor;
    uniform highp sampler2D tDepth;
    uniform sampler2D tVelocity;
    uniform sampler2D tNormal;
    uniform sampler2D tHistory;
    uniform mat4 uReproj;
    uniform vec4 uInvVPw; // 4th row of inverse(viewProj): homogeneous w of a reconstructed world point
    uniform vec2 uJitter; // pixels
    uniform float uWeights[ 9 ];
    uniform float uBlend, uGamma, uSharpen, uFresh, uNear, uFar;
    uniform vec2 uRes;
    varying vec2 vUv;

    ${oe}

    vec3 toYCoCg( vec3 c ) { return vec3( dot( c, vec3( 0.25, 0.5, 0.25 ) ), dot( c, vec3( 0.5, 0.0, - 0.5 ) ), dot( c, vec3( - 0.25, 0.5, - 0.25 ) ) ); }
    vec3 fromYCoCg( vec3 c ) { return vec3( c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z ); }
    // Karis: scale Y, Co, Cg by 1 / (1 + Y) (and back), so HDR highlights do not flicker through the filter and clip
    vec3 tm( vec3 c ) { vec3 y = toYCoCg( c ); return y / ( 1.0 + y.x ); }
    vec3 itm( vec3 y ) { return fromYCoCg( y / max( 1.0 - y.x, 1e-3 ) ); }
    float linearDepth( float d ) { return uNear * uFar / ( uFar - ( uFar - uNear ) * d ); } // standard (not reversed) depth
    // a NaN / Inf from the scene would stay in the history for good: black instead (comparisons with NaN fail)
    vec3 finite( vec3 o ) { return all( lessThan( abs( o ), vec3( 65000.0 ) ) ) ? max( o, 0.0 ) : vec3( 0.0 ); }
    #ifdef TAA_SSR
    uniform sampler2D tSSR;
    uniform float uSsrAge; // TAA_SSR_REUSE: frames since the reflection buffer was traced
    uniform vec2 uSsrShift; // TAA_SSR_REUSE: (this frame's jitter - the traced frame's) / uRes (uv)
    ${Ct}
    #endif

    vec3 historyAt( vec2 uv ) {
    #ifdef TAA_SNAP
      // history position on a texel centre (to 1/512 px: static camera and surface): Catmull-Rom there is that texel
      // (weights 0, 1, 0, 0), so one fetch replaces the 5 taps (pixels in motion take the full filter)
      vec2 sp = uv * uRes - 0.5, sn = floor( sp + 0.5 );
      if ( all( lessThan( abs( sp - sn ), vec2( 1.0 / 512.0 ) ) ) ) return texelFetch( tHistory, clamp( ivec2( sn ), ivec2( 0 ), ivec2( uRes ) - 1 ), 0 ).rgb;
    #endif
    #ifdef TAA_CATMULL_ROM
      // 5-tap Catmull-Rom from bilinear taps (the 4 corner taps of the 9-tap version dropped, weights renormalised)
      vec2 rcp = 1.0 / uRes, p = uv * uRes, t1 = floor( p - 0.5 ) + 0.5, f = p - t1, f2 = f * f, f3 = f2 * f;
      vec2 w0 = f2 - 0.5 * ( f3 + f ), w1 = 1.5 * f3 - 2.5 * f2 + 1.0, w3 = 0.5 * ( f3 - f2 ), w2 = 1.0 - w0 - w1 - w3;
      vec2 w12 = w1 + w2, t0 = ( t1 - 1.0 ) * rcp, t3 = ( t1 + 2.0 ) * rcp, t12 = ( t1 + w2 / w12 ) * rcp;
      float a = w12.x * w0.y, b = w0.x * w12.y, c = w12.x * w12.y, d = w3.x * w12.y, e = w12.x * w3.y;
      vec3 s = texture2D( tHistory, vec2( t12.x, t0.y ) ).rgb * a + texture2D( tHistory, vec2( t0.x, t12.y ) ).rgb * b
             + texture2D( tHistory, t12 ).rgb * c + texture2D( tHistory, vec2( t3.x, t12.y ) ).rgb * d
             + texture2D( tHistory, vec2( t12.x, t3.y ) ).rgb * e;
      return max( s / ( a + b + c + d + e ), 0.0 );
    #else
      return texture2D( tHistory, uv ).rgb;
    #endif
    }`,_s=`

    #define TAA_CLOSEST( X, Y ) { ivec2 q = clamp( ip + ivec2( X, Y ), ivec2( 0 ), mx ); float e = texelFetch( tDepth, q, 0 ).x; if ( e < d ) { d = e; bp = q; } }
    #define TAA_TAP( X, Y, I ) { vec3 c = tm( texelFetch( tColor, clamp( ip + ivec2( X, Y ), ivec2( 0 ), mx ), 0 ).rgb ); cur += c * uWeights[ I ]; m1 += c; m2 += c * c; lo = min( lo, c ); hi = max( hi, c ); }
    #ifdef TAA_SSR
    // every tap with this pixel's reflection composited (ssrC, fetched once in main)
    #undef TAA_TAP
    #define TAA_TAP( X, Y, I ) { vec3 c = tm( engineSsrComposite( texelFetch( tColor, clamp( ip + ivec2( X, Y ), ivec2( 0 ), mx ), 0 ).rgb, ssrC ) ); cur += c * uWeights[ I ]; m1 += c; m2 += c * c; lo = min( lo, c ); hi = max( hi, c ); }
    #endif

    void main() {
      ivec2 ip = ivec2( gl_FragCoord.xy ), mx = ivec2( uRes ) - 1;
      float d = texelFetch( tDepth, ip, 0 ).x;
      ivec2 bp = ip;
      TAA_CLOSEST( - 1, - 1 ) TAA_CLOSEST( 1, - 1 ) TAA_CLOSEST( - 1, 1 ) TAA_CLOSEST( 1, 1 )
      float z = linearDepth( d );
    #ifdef TAA_SSR
     #ifdef TAA_SSR_REUSE
      // a reused reflection buffer (SSRPass interval > 1), traced uSsrAge frames ago: read where this pixel's surface
      // was then (its G-buffer velocity per frame times the age, constant motion assumed) plus the jitter change;
      // pixels without a G-buffer velocity (no reflection of their own) read at the jitter shift only. Age 0: vUv.
      vec4 sg = texelFetch( tNormal, ip, 0 );
      vec2 sv = ( engineGbFlags( sg.a ) & ENGINE_GB_WROTE ) != 0 ? texelFetch( tVelocity, ip, 0 ).rg : vec2( 0.0 );
      vec4 ssrC = texture2D( tSSR, vUv - sv * uSsrAge + uSsrShift );
     #else
      vec4 ssrC = texture2D( tSSR, vUv );
     #endif
      if ( uFresh > 0.5 ) { gl_FragColor = vec4( finite( engineSsrComposite( texelFetch( tColor, ip, 0 ).rgb, ssrC ) ), z ); return; }
    #endif
      if ( uFresh > 0.5 ) { gl_FragColor = vec4( finite( texelFetch( tColor, ip, 0 ).rgb ), z ); return; }

      // current frame at the unjittered pixel centre + neighbourhood moments (tonemapped YCoCg)
      vec3 cur = vec3( 0.0 ), m1 = vec3( 0.0 ), m2 = vec3( 0.0 ), lo = vec3( 1e4 ), hi = vec3( - 1e4 );
      TAA_TAP( - 1, - 1, 0 ) TAA_TAP( 0, - 1, 1 ) TAA_TAP( 1, - 1, 2 )
      TAA_TAP( - 1, 0, 3 ) TAA_TAP( 0, 0, 4 ) TAA_TAP( 1, 0, 5 )
      TAA_TAP( - 1, 1, 6 ) TAA_TAP( 0, 1, 7 ) TAA_TAP( 1, 1, 8 )
      vec3 mean = m1 / 9.0;
      if ( uSharpen > 0.0 ) { cur += ( cur - mean ) * uSharpen; cur.x = clamp( cur.x, 0.0, 0.999 ); }

      // motion of the front-most surface: G-buffer velocity, or the camera reprojection of its depth
      vec2 uvJ = ( vec2( bp ) + 0.5 + uJitter ) / uRes; // where that texel's surface is, unjittered`,Mt=`
      vec4 ndc = vec4( uvJ * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      vec4 pc = uReproj * ndc; // previous clip position if the surface is static
    #ifdef TAA_VELOCITY_FIRST
      // a G-buffer writer that stores a non-zero velocity has bit0 set and not noHistory (noHistory writes 0; other
      // materials write 0 or leave both attachments as they were): the flags are read only where the velocity is 0
      // (static camera + surface, noHistory, nothing written). Same result, one full-screen read less in motion.
      vec2 vel = texelFetch( tVelocity, bp, 0 ).rg;
      int flags = vel.x != 0.0 || vel.y != 0.0 ? ENGINE_GB_WROTE : engineGbFlags( texelFetch( tNormal, bp, 0 ).a );
      bool wrote = ( flags & ENGINE_GB_WROTE ) != 0;
      bool behind = ! wrote && pc.w <= 0.0;
      if ( ! wrote ) vel = behind ? vec2( 0.0 ) : uvJ - ( pc.xy / pc.w * 0.5 + 0.5 );
    #else
      int flags = engineGbFlags( texelFetch( tNormal, bp, 0 ).a );
      bool wrote = ( flags & ENGINE_GB_WROTE ) != 0;
      // depth path: a point behind the previous camera (pc.w <= 0) projects to garbage, often inside [0, 1]: no
      // history, as the G-buffer's noHistory flag does for its writers
      bool behind = ! wrote && pc.w <= 0.0;
      vec2 vel = wrote ? texelFetch( tVelocity, bp, 0 ).rg : behind ? vec2( 0.0 ) : uvJ - ( pc.xy / pc.w * 0.5 + 0.5 );
    #endif
      vec2 huv = vUv - vel;
      float a = uBlend;
      if ( behind || ( flags & ENGINE_GB_NO_HISTORY ) != 0 || huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0 ) a = 0.0;
    #ifdef TAA_DEPTH_REJECT
      float zPrev = pc.w / dot( uInvVPw, ndc ); // view depth the surface had, static
     #if defined( TAA_REJECT_EARLY ) || defined( TAA_REJECT_SINGLE )
      // the texel nearest the history position first (one of the 2x2): it decides almost every pixel
      float tol = 0.1 * z + 0.3, hn = texelFetch( tHistory, clamp( ivec2( huv * uRes ), ivec2( 0 ), mx ), 0 ).a;
      if ( min( abs( hn - zPrev ), abs( hn - z ) ) > tol ) {
      #ifdef TAA_REJECT_EARLY
        ivec2 h0 = clamp( ivec2( floor( huv * uRes - 0.5 ) ), ivec2( 0 ), mx ), h1 = min( h0 + 1, mx );
        vec4 hz = vec4( texelFetch( tHistory, h0, 0 ).a, texelFetch( tHistory, ivec2( h1.x, h0.y ), 0 ).a,
                        texelFetch( tHistory, ivec2( h0.x, h1.y ), 0 ).a, texelFetch( tHistory, h1, 0 ).a );
        vec4 e = min( abs( hz - zPrev ), abs( hz - z ) );
        if ( min( min( e.x, e.y ), min( e.z, e.w ) ) > tol ) a = 0.0;
      #else
        a = 0.0;
      #endif
      }
     #else
      ivec2 h0 = clamp( ivec2( floor( huv * uRes - 0.5 ) ), ivec2( 0 ), mx ), h1 = min( h0 + 1, mx );
      vec4 hz = vec4( texelFetch( tHistory, h0, 0 ).a, texelFetch( tHistory, ivec2( h1.x, h0.y ), 0 ).a,
                      texelFetch( tHistory, ivec2( h0.x, h1.y ), 0 ).a, texelFetch( tHistory, h1, 0 ).a );
      vec4 e = min( abs( hz - zPrev ), abs( hz - z ) );
      if ( min( min( e.x, e.y ), min( e.z, e.w ) ) > 0.1 * z + 0.3 ) a = 0.0;
     #endif
    #endif

      vec3 h = tm( historyAt( huv ) );
    #ifdef TAA_MINMAX
      h = clamp( h, lo, hi );
    #else
      vec3 ext = max( sqrt( max( m2 / 9.0 - mean * mean, 0.0 ) ) * uGamma, vec3( 1e-5 ) ), v = h - mean, k = abs( v / ext );
      float m = max( k.x, max( k.y, k.z ) );
      if ( m > 1.0 ) h = mean + v / m; // clip toward the mean
    #endif`,xs=`
      gl_FragColor = vec4( finite( itm( mix( cur, h, a ) ) ), z );
    }`,Ce={vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:Dt+_s+Mt+xs},gs=Dt+`
    uniform vec2 uInRes; // internal (scene) size, px; uRes = output and history size
    uniform vec3 uUp; // x: window factor on d^2 (output px); y: 1 / E[c] (the mean nearest-sample weight); z: its use

    #define TAAU_CLOSEST( X, Y ) { ivec2 q = clamp( ic + ivec2( X, Y ), ivec2( 0 ), imx );       float e = texelFetch( tDepth, q, 0 ).x; if ( e < d ) { d = e; bp = q; } df = max( df, e ); }
    #define TAAU_COL( q ) texelFetch( tColor, q, 0 ).rgb
    #ifdef TAA_SSR
    #undef TAAU_COL
    #define TAAU_COL( q ) engineSsrComposite( texelFetch( tColor, q, 0 ).rgb, ssrC )
    #endif
    // an internal texel q sampled the scene at q + 0.5 + uJitter (internal px): its weight is the window of its
    // distance to this output pixel's centre, in output px (o); dn = the nearest sample's squared distance
    #define TAAU_TAP( X, Y ) { ivec2 q = clamp( ic + ivec2( X, Y ), ivec2( 0 ), imx ); vec3 c = tm( TAAU_COL( q ) );       vec2 o = ( vec2( q ) + 0.5 + uJitter - pin ) * ko; float dd = dot( o, o ), w = exp( - 2.29 * uUp.x * dd );       cur += c * w; ws += w; dn = min( dn, dd ); m1 += c; m2 += c * c; lo = min( lo, c ); hi = max( hi, c ); }

    void main() {
      vec2 ko = uRes / uInRes; // output px per internal px
      vec2 pin = gl_FragCoord.xy / ko; // this output pixel's centre, internal px
      ivec2 imx = ivec2( uInRes ) - 1, mx = ivec2( uRes ) - 1, ic = clamp( ivec2( pin ), ivec2( 0 ), imx );
      float d = texelFetch( tDepth, ic, 0 ).x;
      ivec2 bp = ic;
      float df = d; // the farthest of the five: the footprint's depth range is [z, zf]
      TAAU_CLOSEST( - 1, - 1 ) TAAU_CLOSEST( 1, - 1 ) TAAU_CLOSEST( - 1, 1 ) TAAU_CLOSEST( 1, 1 )
      float z = linearDepth( d ), zf = linearDepth( df );
    #ifdef TAA_SSR
     #ifdef TAA_SSR_REUSE
      vec4 sg = texelFetch( tNormal, ic, 0 );
      vec2 sv = ( engineGbFlags( sg.a ) & ENGINE_GB_WROTE ) != 0 ? texelFetch( tVelocity, ic, 0 ).rg : vec2( 0.0 );
      vec4 ssrC = texture2D( tSSR, vUv - sv * uSsrAge + uSsrShift );
     #else
      vec4 ssrC = texture2D( tSSR, vUv );
     #endif
    #endif
      // current frame at this output pixel: the windowed 3x3 internal neighbourhood + its moments (tonemapped YCoCg)
      vec3 cur = vec3( 0.0 ), m1 = vec3( 0.0 ), m2 = vec3( 0.0 ), lo = vec3( 1e4 ), hi = vec3( - 1e4 );
      float ws = 0.0, dn = 1e9;
      TAAU_TAP( - 1, - 1 ) TAAU_TAP( 0, - 1 ) TAAU_TAP( 1, - 1 )
      TAAU_TAP( - 1, 0 ) TAAU_TAP( 0, 0 ) TAAU_TAP( 1, 0 )
      TAAU_TAP( - 1, 1 ) TAAU_TAP( 0, 1 ) TAAU_TAP( 1, 1 )
      cur /= max( ws, 1e-20 );
      if ( uFresh > 0.5 ) { gl_FragColor = vec4( finite( itm( cur ) ), z ); return; } // fresh: the filtered upsample
      vec3 mean = m1 / 9.0;
      if ( uSharpen > 0.0 ) { cur += ( cur - mean ) * uSharpen; cur.x = clamp( cur.x, 0.0, 0.999 ); }

      vec2 uvJ = ( vec2( bp ) + 0.5 + uJitter ) / uInRes; // where that texel's surface is, unjittered`+Mt.replaceAll("abs( hz - z )","max( max( z - hz, hz - zf ), 0.0 )").replace("abs( hn - z )","max( max( z - hn, hn - zf ), 0.0 )")+`
      // this frame's weight: (1 - blend) scaled by how close its nearest sample lies to the pixel centre (relative to
      // the mean over sample placements), so detail finer than the internal grid accumulates from the jitter
      float wn = a > 0.0 ? min( 1.0, ( 1.0 - a ) * mix( 1.0, exp( - 2.29 * dn ) * uUp.y, uUp.z ) ) : 1.0;
      gl_FragColor = vec4( finite( itm( mix( h, cur, wn ) ) ), z );
    }`;function Ss(r,e){const t=s=>{let i=0;for(let a=0;a<64;a++){const o=(a+.5)/64*s;i+=Math.exp(-2.29*o*o)}return i/64};return t(.5*r)*t(.5*e)}class ws extends E{constructor(e,t,s,i={}){super(),this.needsSwap=!1,this.camera=e,this.history=t,this.gbuffer=s,this.blend=i.blend??.9,this.gamma=i.gamma??1,this.sharpen=i.sharpen??0,this._clamp=I(i.clamp??"variance",ze,"clamp"),this._filter=I(i.filter??"catmull-rom",Le,"filter"),this._format=I(i.historyFormat??"rgba16f",Ne,"historyFormat"),this._reject=I(i.reject??"quad",Be,"reject"),this._velocityFirst=!!(i.velocityFirst??!1),this._snap=!!(i.snap??!1),this.ssr=null,this._ssrOn=!1,this._ssrReuse=!1,this._w=1,this._h=1,this._inW=0,this._inH=0,this._density=1,this.upscaleWindow=1,this.upscaleProximity=1,this._rt=[null,null],this._makeTargets(),this._cur=0,this._reset=!0,this._lastFrame=-2;const a=t.uniforms;this.material=new F({name:"PostFXTAA",defines:{},uniforms:{tColor:{value:null},tDepth:{value:null},tVelocity:{value:null},tNormal:{value:null},tHistory:{value:null},tSSR:{value:null},uSsrAge:{value:0},uSsrShift:{value:new p},uReproj:a.uReproj,uJitter:a.uJitter,uInvVPw:{value:new q},uWeights:{value:new Float32Array(9)},uBlend:{value:.9},uGamma:{value:1},uSharpen:{value:0},uFresh:{value:1},uNear:{value:.1},uFar:{value:1e3},uRes:{value:new p(1,1)},uInRes:{value:new p(1,1)},uUp:{value:new y(1,1,1)}},vertexShader:Ce.vertexShader,fragmentShader:Ce.fragmentShader,blending:B,depthTest:!1,depthWrite:!1}),this._syncDefines(),this._quad=new N(this.material)}get texture(){return this._rt[this._cur].texture}get clamp(){return this._clamp}set clamp(e){this._clamp=I(e,ze,"clamp"),this._syncDefines()}get filter(){return this._filter}set filter(e){this._filter=I(e,Le,"filter"),this._syncDefines()}get historyFormat(){return this._format}set historyFormat(e){if(e=I(e,Ne,"historyFormat"),e!==this._format){this._format=e;for(const t of this._rt)t.dispose();this._makeTargets(),this._syncDefines(),this._reset=!0}}get reject(){return this._reject}set reject(e){this._reject=I(e,Be,"reject"),this._syncDefines()}get velocityFirst(){return this._velocityFirst}set velocityFirst(e){this._velocityFirst=!!e,this._syncDefines()}get snap(){return this._snap}set snap(e){this._snap=!!e,this._syncDefines()}reset(){this._reset=!0}get resetPending(){return this._reset}setSize(e,t){this._w=e,this._h=t;for(const s of this._rt)s.setSize(e,t);this.material.uniforms.uRes.value.set(e,t),this._syncUpscale(),this._reset=!0}get inputWidth(){return this._inW||this._w}get inputHeight(){return this._inH||this._h}get upscale(){return this._inW>0}setUpscale(e,t){const s=e>0?Math.max(1,e|0):0,i=s>0?Math.max(1,t|0):0;if(s===this._inW&&i===this._inH)return;this._inW=s,this._inH=i;const a=this.material,o=s>0;a.fragmentShader=o?gs:Ce.fragmentShader,o?a.defines.TAA_UPSCALE=1:delete a.defines.TAA_UPSCALE,a.needsUpdate=!0,this._syncUpscale()}render(e,t,s){const i=this.material.uniforms,a=this.history,o=this.gbuffer,n=this.camera,l=a.uniforms.uFrame.value,u=this.ssr,h=u!==null&&u.enabled,c=h&&(u.interval??1)>1;(h!==this._ssrOn||c!==this._ssrReuse)&&(this._ssrOn=h,this._ssrReuse=c,this._syncDefines());const f=this._reset||a.fresh||l!==this._lastFrame+1;this._reset=!1,this._lastFrame=l,i.tColor.value=s.texture,i.tDepth.value=s.depthTexture,i.tVelocity.value=o.velocity,i.tNormal.value=o.normal,i.tHistory.value=this._rt[this._cur].texture,i.tSSR.value=h?u.texture:null,this._cur^=1,i.uFresh.value=f?1:0;const m=this._density;i.uBlend.value=m<1?1-(1-this.blend)*m:this.blend,i.uGamma.value=m<1?this.gamma/Math.sqrt(m):this.gamma,i.uSharpen.value=this.sharpen,i.uNear.value=n.near,i.uFar.value=n.far;const v=a.uniforms.uInvViewProj.value.elements;i.uInvVPw.value.set(v[3],v[7],v[11],v[15]);const _=a.uniforms.uJitter.value;if(vs(_.x,_.y,i.uWeights.value),c){const M=u.age??0,x=u.tracedJitter;i.uSsrAge.value!==M&&(i.uSsrAge.value=M),M===0||!x?i.uSsrShift.value.set(0,0):i.uSsrShift.value.set((_.x-x.x)/this.inputWidth,(_.y-x.y)/this.inputHeight)}this._inW>0&&(i.uUp.value.x=this.upscaleWindow*m,i.uUp.value.z=this.upscaleProximity),e.setRenderTarget(this._rt[this._cur]),this._quad.render(e)}dispose(){for(const e of this._rt)e.dispose();this.material.dispose(),this._quad.dispose()}_syncUpscale(){if(this._density=this._inW>0?Math.min(1,this._inW*this._inH/(this._w*this._h)):1,this._inW===0)return;const e=this.material.uniforms;e.uInRes.value.set(this._inW,this._inH),e.uUp.value.y=1/Ss(Math.max(1,this._w/this._inW),Math.max(1,this._h/this._inH))}_makeTargets(){const t={...this._format==="r11g11b10"?{format:Ft,type:Tt}:{type:P},depthBuffer:!1,stencilBuffer:!1,minFilter:A,magFilter:A,generateMipmaps:!1};for(let s=0;s<2;s++){const i=this._rt[s]=new w(this._w,this._h,t);i.texture.name=`TAA.history${s}`}}_syncDefines(){const e=this.material.defines,t={TAA_CATMULL_ROM:this._filter==="catmull-rom",TAA_MINMAX:this._clamp==="minmax",TAA_DEPTH_REJECT:this._format==="rgba16f",TAA_REJECT_EARLY:this._reject==="early",TAA_REJECT_SINGLE:this._reject==="single",TAA_VELOCITY_FIRST:this._velocityFirst,TAA_SNAP:this._snap,TAA_SSR:this._ssrOn,TAA_SSR_REUSE:this._ssrReuse};let s=!1;for(const i in t)t[i]!==i in e&&(t[i]?e[i]=1:delete e[i],s=!0);s&&(this.material.needsUpdate=!0)}}function I(r,e,t){if(!e.includes(r))throw new Error(`[TAAPass] unknown ${t} '${r}' (${e.map(s=>`'${s}'`).join(" | ")})`);return r}const Rt=6e4,st=4,it=Math.PI/180,Et=Object.freeze({scale:.25,maxPixels:1/0,steps:16,maxDistance:400,g:.55,density:1,temporal:!0,blend:.9,jitter:!0}),at={scale:[r=>typeof r=="number"&&r>0&&r<=1,"a number in (0, 1]"],maxPixels:[r=>typeof r=="number"&&r>=1,"a number >= 1 (Infinity or null: no budget)"],steps:[r=>Number.isInteger(r)&&r>=1&&r<=128,"an integer in 1..128"],maxDistance:[r=>Number.isFinite(r)&&r>0,"a finite number > 0 (m)"],g:[r=>typeof r=="number"&&r>-1&&r<1,"a number in (-1, 1)"],density:[r=>Number.isFinite(r)&&r>=0,"a finite number >= 0"],temporal:[r=>typeof r=="boolean","a boolean"],blend:[r=>typeof r=="number"&&r>=0&&r<1,"a number in [0, 1)"],jitter:[r=>typeof r=="boolean","a boolean"]},bs=r=>typeof r=="string"?`'${r}'`:String(r);function U(r,e){const t=at[r];if(!t)throw new Error(`[VolumetricPass] unknown option '${r}' (${Object.keys(at).join(", ")})`);if(r==="maxPixels"&&e===null&&(e=1/0),!t[0](e))throw new Error(`[VolumetricPass] ${r} must be ${t[1]} (got ${bs(e)})`);return e}const rt={vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    #include <packing>
    #define VOL_FAR_DEPTH ${Rt.toFixed(1)}
    uniform highp sampler2D tDepth;
    uniform sampler2D tHistory;
    #ifdef VOL_SHADOW_PACKED
    uniform sampler2D tShadow0;
    #if VOL_CASCADES > 1
    uniform sampler2D tShadow1;
    #endif
    #if VOL_CASCADES > 2
    uniform sampler2D tShadow2;
    #endif
    #if VOL_CASCADES > 3
    uniform sampler2D tShadow3;
    #endif
    // three's texture2DCompare on the RGBA-packed map: 1 (lit) where z is not behind the stored depth
    float volTap( sampler2D map, vec3 c, float bias ) {
      float d = unpackRGBAToDepth( texture2D( map, c.xy ) );
    #ifdef USE_REVERSED_DEPTH_BUFFER
      return step( d, c.z + bias );
    #else
      return step( c.z + bias, d );
    #endif
    }
    #else
    uniform sampler2DShadow tShadow0;
    #if VOL_CASCADES > 1
    uniform sampler2DShadow tShadow1;
    #endif
    #if VOL_CASCADES > 2
    uniform sampler2DShadow tShadow2;
    #endif
    #if VOL_CASCADES > 3
    uniform sampler2DShadow tShadow3;
    #endif
    // the 'fast' kernel's compare-mode depth texture (one tap: 2x2 hardware PCF)
    float volTap( sampler2DShadow map, vec3 c, float bias ) { return texture( map, vec3( c.xy, c.z + bias ) ); }
    #endif
    #if VOL_CASCADES == 1
    #define VOL_LAST 0
    #define VOL_LAST_MAP tShadow0
    #elif VOL_CASCADES == 2
    #define VOL_LAST 1
    #define VOL_LAST_MAP tShadow1
    #elif VOL_CASCADES == 3
    #define VOL_LAST 2
    #define VOL_LAST_MAP tShadow2
    #else
    #define VOL_LAST 3
    #define VOL_LAST_MAP tShadow3
    #endif

    uniform mat4 uShadowMatrix[ 4 ]; // light.shadow.matrix: world -> shadow uv + depth (orthographic: w = 1)
    uniform vec3 uShadowOrigin[ 4 ]; // the camera position through each matrix
    uniform float uShadowBias[ 4 ];  // light.shadow.bias per cascade
    uniform mat4 uProjInv, uCamWorld; // this frame's (jittered) camera
    uniform mat4 uReproj;            // current unjittered NDC -> previous clip
    uniform vec4 uInvVPw;            // 4th row of inverse(viewProj): homogeneous w of a reconstructed point
    uniform vec2 uJitter, uPrevJitter; // TAA jitter of this / the previous frame (drawing-buffer px)
    uniform vec3 uSunDir;            // toward the sun
    uniform vec3 uPhase;             // (1 - g^2) / (4 pi), 1 + g^2, 2 g
    uniform vec4 uMedium;            // haze sigma at the camera (1/m), haze k, mist sigma at the camera, mist k
    uniform int uSteps;
    uniform vec4 uMarch;             // max distance (m), sun gate, noise on (0 / 1), frame offset (0..1)
    uniform vec2 uClip;              // camera near, far
    uniform vec2 uTemporal;          // blend, fresh (1: no history)
    varying vec2 vUv;

    vec3 volDC[ 4 ]; // per pixel: shadow-space change per metre along the ray, by cascade

    // shadowCascade.js's walk at an inner cascade: z > 1 goes on with xi kept; else the patch blends on to the next
    // cascade with weight w, so this cascade is tapped when w <= xi and the walk goes on with xi / w (uniform again)
    bool volPick( vec3 c, inout float xi ) {
      if ( c.z > 1.0 ) return false;
      vec2 e = abs( c.xy - 0.5 );
      float w = smoothstep( 0.39, 0.47, max( e.x, e.y ) );
      if ( w <= xi ) return true;
      xi /= w;
      return false;
    }

    float sunVisibility( float t, float xi ) {
      vec3 c;
    #if VOL_CASCADES > 1
      c = uShadowOrigin[ 0 ] + volDC[ 0 ] * t;
      if ( volPick( c, xi ) ) return volTap( tShadow0, c, uShadowBias[ 0 ] );
    #endif
    #if VOL_CASCADES > 2
      c = uShadowOrigin[ 1 ] + volDC[ 1 ] * t;
      if ( volPick( c, xi ) ) return volTap( tShadow1, c, uShadowBias[ 1 ] );
    #endif
    #if VOL_CASCADES > 3
      c = uShadowOrigin[ 2 ] + volDC[ 2 ] * t;
      if ( volPick( c, xi ) ) return volTap( tShadow2, c, uShadowBias[ 2 ] );
    #endif
      // the last (far) cascade: three's frustum test, then (with cascades) the patch's fade to lit at the box edge
      c = uShadowOrigin[ VOL_LAST ] + volDC[ VOL_LAST ] * t;
      if ( c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0 ) return 1.0;
      float s = volTap( VOL_LAST_MAP, c, uShadowBias[ VOL_LAST ] );
    #if VOL_CASCADES > 1
      vec2 e = abs( c.xy - 0.5 );
      s = mix( s, 1.0, smoothstep( 0.43, 0.495, max( e.x, e.y ) ) );
    #endif
      return s;
    }

    float ign( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }

    void main() {
      // the depth texel under this pixel's centre; its own centre is the ray (depth and ray agree)
      ivec2 dsz = textureSize( tDepth, 0 );
      ivec2 ip = min( ivec2( vUv * vec2( dsz ) ), dsz - 1 );
      float d = texelFetch( tDepth, ip, 0 ).x;
      vec2 uv = ( vec2( ip ) + 0.5 ) / vec2( dsz );
      bool sky = d >= 1.0;
      // the final pass's linearisation
      float z = sky ? VOL_FAR_DEPTH : uClip.x * uClip.y / ( uClip.y - ( uClip.y - uClip.x ) * d );
      vec4 vp = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      vec3 v = vp.xyz / vp.w;
      float dist = length( v );
      vec3 dir = normalize( mat3( uCamWorld ) * ( v / dist ) );
      float len = sky ? uMarch.x : min( dist, uMarch.x );
      float dt = len / float( uSteps );

      float phase = uPhase.x / pow( uPhase.y - uPhase.z * dot( dir, uSunDir ), 1.5 );
      volDC[ 0 ] = mat3( uShadowMatrix[ 0 ] ) * dir;
    #if VOL_CASCADES > 1
      volDC[ 1 ] = mat3( uShadowMatrix[ 1 ] ) * dir;
    #endif
    #if VOL_CASCADES > 2
      volDC[ 2 ] = mat3( uShadowMatrix[ 2 ] ) * dir;
    #endif
    #if VOL_CASCADES > 3
      volDC[ 3 ] = mat3( uShadowMatrix[ 3 ] ) * dir;
    #endif

      float o = uMarch.z > 0.5 ? fract( ign( gl_FragCoord.xy ) + uMarch.w ) : 0.5;
      vec2 kdy = uMedium.yw * dir.y; // k * dy per metre of ray, haze / mist
      float sum = 0.0;
      for ( int i = 0; i < uSteps; i ++ ) {
        float t = ( float( i ) + o ) * dt;
        // the two layers from the camera to t: density e = exp(-x) relative to the camera's, optical depth
        // sigma_cam * t * (1 - e) / x (layer() of the final pass); x clamped where no surface is (60 scale heights)
        vec2 x = clamp( kdy * t, - 60.0, 60.0 );
        vec2 e = exp( - x );
        vec2 f = vec2( abs( x.x ) > 1e-3 ? ( 1.0 - e.x ) / x.x : 1.0 - 0.5 * x.x,
                       abs( x.y ) > 1e-3 ? ( 1.0 - e.y ) / x.y : 1.0 - 0.5 * x.y );
        float sigma = dot( uMedium.xz, e );
        float tau = t * dot( uMedium.xz, f );
        float xi = uMarch.z > 0.5 ? fract( o + 0.618034 * float( i ) ) : 0.5;
        sum += sigma * exp( - tau ) * sunVisibility( t, xi );
      }
      float r = uMarch.y * phase * sum * dt;

      if ( uTemporal.y < 0.5 ) {
        vec2 uvJ = uv + uJitter / vec2( dsz ); // the unjittered position of what this texel shows
        vec4 ndc = vec4( uvJ * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
        vec4 pc = uReproj * ndc;
        if ( pc.w > 0.0 ) {
          // where the previous (jittered) frame drew it
          vec2 huv = pc.xy / pc.w * 0.5 + 0.5 - uPrevJitter / vec2( dsz );
          if ( huv.x >= 0.0 && huv.y >= 0.0 && huv.x <= 1.0 && huv.y <= 1.0 ) {
            float zPrev = sky ? VOL_FAR_DEPTH : pc.w / dot( uInvVPw, ndc ); // view depth the surface had, static
            // depth-aware 2x2 history tap: aoAt's weights with TAAPass's tolerance and quad rule
            ivec2 hm = textureSize( tHistory, 0 ) - 1;
            vec2 hp = huv * vec2( hm + 1 ) - 0.5, hf = fract( hp );
            ivec2 h0 = ivec2( floor( hp ) );
            vec2 ha = texelFetch( tHistory, clamp( h0, ivec2( 0 ), hm ), 0 ).rg;
            vec2 hb = texelFetch( tHistory, clamp( h0 + ivec2( 1, 0 ), ivec2( 0 ), hm ), 0 ).rg;
            vec2 hc = texelFetch( tHistory, clamp( h0 + ivec2( 0, 1 ), ivec2( 0 ), hm ), 0 ).rg;
            vec2 hd = texelFetch( tHistory, clamp( h0 + 1, ivec2( 0 ), hm ), 0 ).rg;
            vec4 hz = vec4( ha.y, hb.y, hc.y, hd.y );
            vec4 m = 1.0 - min( abs( hz - z ), abs( hz - zPrev ) ) / ( 0.1 * z + 0.3 ); // >= 0: within tolerance
            if ( max( max( m.x, m.y ), max( m.z, m.w ) ) >= 0.0 ) {
              vec4 w = vec4( ( 1.0 - hf.x ) * ( 1.0 - hf.y ), hf.x * ( 1.0 - hf.y ),
                             ( 1.0 - hf.x ) * hf.y, hf.x * hf.y ) * max( vec4( 1e-3 ), m );
              r = mix( r, dot( w, vec4( ha.x, hb.x, hc.x, hd.x ) ) / dot( w, vec4( 1.0 ) ), uTemporal.x );
            }
          }
        }
      }
      gl_FragColor = vec4( r >= 0.0 && r < 65000.0 ? r : 0.0, z, 0.0, 1.0 ); // NaN / Inf: 0
    }`};class ys extends E{constructor(e,t,s,i={}){if(super(),!e||!e.isCamera)throw new Error("[VolumetricPass] needs a camera");const a=s;if(!a||typeof a.shadowCascadeInfo!="function"||!a.sunDir||!a.fogParams)throw new Error("[VolumetricPass] needs an atmosphere (sunDir, fogParams, shadowCascadeInfo(out))");if(i===null||typeof i!="object")throw new Error("[VolumetricPass] options must be an object");this.needsSwap=!1,this.camera=e,this.history=t||null,this.atmosphere=s;const o={...Et};for(const c in i)o[c]=U(c,i[c]);this._o=o,this._W=1,this._H=1,this._sized=!1,this._info={count:0,lights:[],cameras:[],matrices:[],halfSizes:[],maps:[],depthTextures:[],packed:!0},this._count=1,this._packed=!0;const n={type:P,format:ae,depthBuffer:!1,stencilBuffer:!1,minFilter:A,magFilter:A,generateMipmaps:!1};this._rt=[new w(1,1,n),new w(1,1,n)],this._rt[0].texture.name="Volumetric.a",this._rt[1].texture.name="Volumetric.b",this._cur=0,this._reset=!0,this._zeroed=!1,this._lastFrame=-2,this._lastHistory=this.history,this._frame=0,this._vp=new b,this._prevVP=new b,this._inv=new b,this._hasPrev=!1,this._clear=new R;const l=()=>new b,u=()=>new y;this.material=new F({name:"PostFXVolumetric",defines:{VOL_CASCADES:1,VOL_SHADOW_PACKED:1},uniforms:{tDepth:{value:null},tHistory:{value:null},tShadow0:{value:null},tShadow1:{value:null},tShadow2:{value:null},tShadow3:{value:null},uShadowMatrix:{value:[l(),l(),l(),l()]},uShadowOrigin:{value:[u(),u(),u(),u()]},uShadowBias:{value:new Float32Array(4)},uProjInv:{value:new b},uCamWorld:{value:new b},uReproj:{value:new b},uInvVPw:{value:new q(0,0,0,1)},uJitter:{value:new p},uPrevJitter:{value:new p},uSunDir:{value:new y(0,1,0)},uPhase:{value:new y},uMedium:{value:new q},uSteps:{value:16},uMarch:{value:new q(400,0,1,0)},uClip:{value:new p(.1,1e3)},uTemporal:{value:new p(.9,1)}},vertexShader:rt.vertexShader,fragmentShader:rt.fragmentShader,blending:B,depthTest:!1,depthWrite:!1});const h=this.material.uniforms;this._shadowU=[h.tShadow0,h.tShadow1,h.tShadow2,h.tShadow3],this._quad=new N(this.material)}get texture(){return this._rt[this._cur].texture}get width(){return this._rt[0].width}get height(){return this._rt[0].height}get scale(){return this._o.scale}set scale(e){this._o.scale=U("scale",e),this._sized&&this.setSize(this._W,this._H)}get maxPixels(){return this._o.maxPixels}set maxPixels(e){this._o.maxPixels=U("maxPixels",e),this._sized&&this.setSize(this._W,this._H)}get steps(){return this._o.steps}set steps(e){this._o.steps=U("steps",e)}get maxDistance(){return this._o.maxDistance}set maxDistance(e){this._o.maxDistance=U("maxDistance",e)}get g(){return this._o.g}set g(e){this._o.g=U("g",e)}get density(){return this._o.density}set density(e){this._o.density=U("density",e)}get temporal(){return this._o.temporal}set temporal(e){U("temporal",e)!==this._o.temporal&&(this._o.temporal=e,this._reset=!0)}get blend(){return this._o.blend}set blend(e){this._o.blend=U("blend",e)}get jitter(){return this._o.jitter}set jitter(e){this._o.jitter=U("jitter",e)}reset(){this._reset=!0}setSize(e,t){this._W=e,this._H=t,this._sized=!0;const s=Math.max(1,e),i=Math.max(1,t),a=this._o.scale,o=this._o.maxPixels;let n=Math.max(1,Math.round(s*a)),l=Math.max(1,Math.round(i*a));if(n*l>o){const u=Math.sqrt(o/(s*i));n=Math.max(1,Math.floor(s*u)),l=Math.max(1,Math.floor(i*u))}this._rt[0].setSize(n,l),this._rt[1].setSize(n,l),this._reset=!0,this._zeroed=!1}render(e,t,s){const i=this.atmosphere,a=this._o,o=this.camera,n=this.history,l=this.material.uniforms,u=s?s.depthTexture:null,h=i.shadowCascadeInfo(this._info),c=Math.min(h.count,st),f=!!h.packed,m=n!==null?n.uniforms.uFrame.value:this._frame;this._frame++;const v=i.scatterDir||i.sunDir,_=v.y;let x=(Math.asin(_<-1?-1:_>1?1:_)+2*it)/(5*it);x=x<0?0:x>1?1:x,x=x*x*(3-2*x);const T=x>.02?1:0,O=o.matrixWorld.elements,L=O[12],g=O[13],S=O[14],k=i.fogParams,ne=a.density,se=g-(k.hazeBase||0),Ge=ne*k.haze*Math.exp(-k.hazeK*(se<-100?-100:se>4e3?4e3:se)),$e=ne*k.mist*Math.exp(-k.mistK*(g<-100?-100:g>4e3?4e3:g)),We=l.uClip.value,le=l.uMarch.value,Se=l.uTemporal.value;We.x=o.near,We.y=o.far,l.uSunDir.value.copy(v);const ie=a.g,we=l.uPhase.value,ue=l.uMedium.value;we.x=(1-ie*ie)/(4*Math.PI),we.y=1+ie*ie,we.z=2*ie,ue.x=Ge,ue.y=k.hazeK,ue.z=$e,ue.w=k.mistK,l.uSteps.value=a.steps,le.x=a.maxDistance,le.y=T,le.z=a.jitter?1:0,le.w=a.jitter?m%4096*.6180339887498949%1:0,Se.x=a.blend;let be=u!=null&&c>0&&T>0&&Ge+$e>0;for(let d=0;be&&d<c;d++)(f?h.maps[d]:h.depthTextures[d])||(be=!1);if(!be){this._zero(e),this._lastFrame=m;return}if(c!==this._count||f!==this._packed){const d=this.material.defines;d.VOL_CASCADES=c,f?d.VOL_SHADOW_PACKED=1:delete d.VOL_SHADOW_PACKED,this._count=c,this._packed=f,this.material.needsUpdate=!0}const It=l.uShadowMatrix.value,jt=l.uShadowOrigin.value,Xe=l.uShadowBias.value;for(let d=0;d<st;d++)if(d<c){const z=h.matrices[d],C=z.elements,Ae=jt[d],qe=h.lights[d];It[d].copy(z),Ae.x=C[0]*L+C[4]*g+C[8]*S+C[12],Ae.y=C[1]*L+C[5]*g+C[9]*S+C[13],Ae.z=C[2]*L+C[6]*g+C[10]*S+C[14],Xe[d]=qe?qe.shadow.bias:0,this._shadowU[d].value=f?h.maps[d]:h.depthTextures[d]}else this._shadowU[d].value=null,Xe[d]=0;l.tDepth.value=u,l.uProjInv.value.copy(o.projectionMatrixInverse),l.uCamWorld.value.copy(o.matrixWorld);let J=this._reset||m!==this._lastFrame+1||n!==this._lastHistory;if(this._lastHistory=n,n!==null){const d=n.uniforms;J=J||n.fresh,l.uReproj.value.copy(d.uReproj.value);const z=d.uInvViewProj.value.elements,C=l.uInvVPw.value;C.x=z[3],C.y=z[7],C.z=z[11],C.w=z[15],l.uJitter.value.copy(d.uJitter.value),l.uPrevJitter.value.copy(d.uPrevJitter.value)}else{this._vp.multiplyMatrices(o.projectionMatrix,o.matrixWorldInverse),this._inv.multiplyMatrices(o.matrixWorld,o.projectionMatrixInverse),J=J||!this._hasPrev,l.uReproj.value.multiplyMatrices(this._hasPrev?this._prevVP:this._vp,this._inv),this._prevVP.copy(this._vp),this._hasPrev=!0;const d=this._inv.elements,z=l.uInvVPw.value;z.x=d[3],z.y=d[7],z.z=d[11],z.w=d[15],l.uJitter.value.set(0,0),l.uPrevJitter.value.set(0,0)}this._lastFrame=m;let ye;if(a.temporal){const d=this._rt[this._cur];this._cur^=1,ye=this._rt[this._cur],l.tHistory.value=J?u:d.texture,Se.y=J?1:0,this._reset=!1}else ye=this._rt[this._cur],l.tHistory.value=u,Se.y=1,this._reset=!0;e.setRenderTarget(ye),this._quad.render(e),this._zeroed=!1}dispose(){this._rt[0].dispose(),this._rt[1].dispose(),this.material.dispose(),this._quad.dispose()}_zero(e){if(this._reset=!0,this._hasPrev=!1,this._zeroed)return;e.getClearColor(this._clear);const t=e.getClearAlpha();e.setRenderTarget(this._rt[this._cur]),e.setClearColor(As,1),e.clear(!0,!1,!1),e.setClearColor(this._clear,t),this._zeroed=!0}}const As=new R(0,Rt,0),Z=Object.freeze({strength:1,maxBlur:24,tileSize:20,samples:8,shutter:0}),Ts=`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,Ue=`
  uniform highp sampler2D tDepth;
  #ifndef MB_CAMERA_ONLY
  uniform sampler2D tVelocity;
  uniform sampler2D tNormal;
  #endif
  uniform mat4 uReproj;
  uniform vec2 uJitter, uRes;
  uniform vec2 uBlur; // x = k / 2 (UV motion -> half extent), y = largest half extent (px)
  uniform float uNear, uFar;
  layout( location = 1 ) out highp vec4 mbVZ;

  ${oe}

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy );
    float d = texelFetch( tDepth, ip, 0 ).x;
    vec2 v;
  #ifndef MB_CAMERA_ONLY
    // a G-buffer writer with history: its own velocity. noHistory surfaces (ENGINE_GBUFFER_NOVEL writes velocity 0)
    // fall through to the camera motion, so a video screen still streaks while the camera pans
    if ( ( engineGbFlags( texelFetch( tNormal, ip, 0 ).a ) & ( ENGINE_GB_WROTE | ENGINE_GB_NO_HISTORY ) ) == ENGINE_GB_WROTE ) v = texelFetch( tVelocity, ip, 0 ).rg;
    else
  #endif
    {
      // camera-only: where this depth sample's surface was in the previous frame (uReproj: NDC -> previous clip)
      vec2 uv = ( gl_FragCoord.xy + uJitter ) / uRes;
      vec4 pc = uReproj * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      v = pc.w > 0.0 ? uv - ( pc.xy / pc.w * 0.5 + 0.5 ) : vec2( 0.0 );
    }
    v *= uRes * uBlur.x; // UV -> px, half extent of the streak
    float l = length( v );
    if ( l > uBlur.y ) { v *= uBlur.y / l; l = uBlur.y; }
    gl_FragColor = vec4( v, 0.0, 1.0 );
    mbVZ = vec4( l, min( uNear * uFar / ( uFar - ( uFar - uNear ) * d ), 65000.0 ), 0.0, 1.0 );
  }`,Fs=[["uniform vec2 uJitter, uRes;","uniform vec2 uJitter, uRes, uInRes;"],["ivec2 ip = ivec2( gl_FragCoord.xy );","ivec2 ip = min( ivec2( gl_FragCoord.xy * uInRes / uRes ), ivec2( uInRes ) - 1 );"],["vec2 uv = ( gl_FragCoord.xy + uJitter ) / uRes;","vec2 uv = ( vec2( ip ) + 0.5 + uJitter ) / uInRes;"]].reduce((r,[e,t])=>{if(r.split(e).length!==2)throw new Error(`[MotionBlurPass] shader anchor not found once: ${e}`);return r.replace(e,t)},Ue),Ps=`
  uniform sampler2D tSrc;
  uniform ivec2 uDir;
  uniform int uTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ), sz = textureSize( tSrc, 0 );
    ivec2 p = o + uDir * o * ( uTile - 1 ); // first texel of this output's run
    int n = min( uTile, uDir.x == 1 ? sz.x - p.x : sz.y - p.y );
    vec2 best = vec2( 0.0 );
    float bl = - 1.0;
    for ( int i = 0; i < n; i ++ ) {
      vec2 v = texelFetch( tSrc, p + uDir * i, 0 ).rg;
      float l = dot( v, v );
      if ( l > bl ) { bl = l; best = v; }
    }
    gl_FragColor = vec4( best, 0.0, 1.0 );
  }`,Cs=`
  uniform sampler2D tTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ), mx = textureSize( tTile, 0 ) - 1;
    vec2 best = vec2( 0.0 );
    float bl = - 1.0;
    for ( int y = - 1; y <= 1; y ++ ) {
      for ( int x = - 1; x <= 1; x ++ ) {
        vec2 v = texelFetch( tTile, clamp( o + ivec2( x, y ), ivec2( 0 ), mx ), 0 ).rg;
        float l = dot( v, v );
        if ( l > bl ) { bl = l; best = v; }
      }
    }
    gl_FragColor = vec4( best, 0.0, 1.0 );
  }`,Ds=`
  uniform sampler2D tColor;
  uniform sampler2D tVZ;
  uniform sampler2D tNeighbor;
  uniform int uTile;

  float cone( float r, float v ) { return clamp( 1.0 - r / v, 0.0, 1.0 ); }
  float cylinder( float r, float v ) { return 1.0 - smoothstep( 0.95 * v, 1.05 * v, r ); }
  // 1 where depth a is in front of (or level with) depth b, 0 once it is behind by the soft extent
  float front( float a, float b ) { return clamp( 1.0 - ( a - b ) / ( 0.03 * min( a, b ) + 0.05 ), 0.0, 1.0 ); }

  void main() {
    vec2 X = gl_FragCoord.xy;
    ivec2 mx = textureSize( tColor, 0 ) - 1, ix = min( ivec2( X ), mx );
    vec2 vn = texelFetch( tNeighbor, ix / uTile, 0 ).rg;
    vec4 cx = texelFetch( tColor, ix, 0 );
    if ( dot( vn, vn ) < 0.0625 ) { gl_FragColor = cx; return; } // |V_N| < 0.25 px: no streak reaches here, input texel
    vec2 vzx = texelFetch( tVZ, ix, 0 ).rg;
    float vx = max( vzx.x, 0.5 ), zx = vzx.y;
    float w = 1.0 / vx;
    vec3 sum = cx.rgb * w;
    float j = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) - 0.5; // IGN
    for ( int i = 0; i < MB_SAMPLES; i ++ ) {
      float t = mix( - 1.0, 1.0, ( float( i ) + j + 1.0 ) / ( float( MB_SAMPLES ) + 1.0 ) );
      ivec2 iy = clamp( ivec2( floor( X + vn * t ) ), ivec2( 0 ), mx );
      vec2 vzy = texelFetch( tVZ, iy, 0 ).rg;
      float vy = max( vzy.x, 0.5 ), zy = vzy.y, r = length( vec2( iy - ix ) );
      float a = front( zy, zx ) * cone( r, vy ) + front( zx, zy ) * cone( r, vx ) + cylinder( r, vy ) * cylinder( r, vx ) * 2.0;
      w += a;
      sum += texelFetch( tColor, iy, 0 ).rgb * a;
    }
    gl_FragColor = vec4( sum / w, cx.a );
  }`,ot=Object.keys(Z);class Ms extends E{constructor(e,t,s,i={}){if(super(),!t||!t.uniforms||!t.uniforms.uReproj)throw new Error("[MotionBlurPass] needs a CameraHistory (camera-only velocity, jitter)");for(const u in i)if(!ot.includes(u))throw new Error(`[MotionBlurPass] unknown option '${u}' (${ot.join(", ")})`);this.needsSwap=!1,this.camera=e,this.history=t,this.gbuffer=s??null;const a=Z;this._strength=ce(i.strength??a.strength,"strength"),this._maxBlur=ce(i.maxBlur??a.maxBlur,"maxBlur"),this._tileSize=fe(i.tileSize??a.tileSize,1,128,"tileSize"),this._samples=fe(i.samples??a.samples,2,64,"samples"),this._shutter=nt(i.shutter??a.shutter,"shutter"),this._w=1,this._h=1,this._inW=0,this._inH=0,this._camOnly=null;const o={type:P,format:ae,depthBuffer:!1,stencilBuffer:!1,minFilter:V,magFilter:V,generateMipmaps:!1};this._vel=new w(1,1,{...o,count:2}),this._vel.textures[0].name="MotionBlur.velocity",this._vel.textures[1].name="MotionBlur.speedDepth",this._tileX=new w(1,1,o),this._tileX.texture.name="MotionBlur.tileRows",this._tile=new w(1,1,o),this._tile.texture.name="MotionBlur.tileMax",this._neighbor=new w(1,1,o),this._neighbor.texture.name="MotionBlur.neighborMax",this._out=new w(1,1,{type:P,depthBuffer:!1,stencilBuffer:!1,minFilter:A,magFilter:A,generateMipmaps:!1}),this._out.texture.name="MotionBlur.out";const n=t.uniforms,l=(u,h,c,f={})=>new F({name:u,defines:f,uniforms:c,vertexShader:Ts,fragmentShader:h,blending:B,depthTest:!1,depthWrite:!1});this._velocityMat=l("PostFXMotionBlurVelocity",Ue,{tDepth:{value:null},tVelocity:{value:null},tNormal:{value:null},uReproj:n.uReproj,uJitter:n.uJitter,uRes:{value:new p(1,1)},uBlur:{value:new p(.5,12)},uInRes:{value:new p(1,1)},uNear:{value:.1},uFar:{value:1e3}}),this._tileMat=l("PostFXMotionBlurTileMax",Ps,{tSrc:{value:null},uDir:{value:new p(1,0)},uTile:{value:20}}),this._neighborMat=l("PostFXMotionBlurNeighborMax",Cs,{tTile:{value:null}}),this._reconstructMat=l("PostFXMotionBlur",Ds,{tColor:{value:null},tVZ:{value:this._vel.textures[1]},tNeighbor:{value:this._neighbor.texture},uTile:{value:20}},{MB_SAMPLES:this._samples}),this._quad=new N(null),this._resize()}get texture(){return this._out.texture}get velocityTexture(){return this._vel.textures[0]}get neighborMaxTexture(){return this._neighbor.texture}get strength(){return this._strength}set strength(e){this._strength=ce(e,"strength")}get maxBlur(){return this._maxBlur}set maxBlur(e){this._maxBlur=ce(e,"maxBlur")}get tileSize(){return this._tileSize}set tileSize(e){this._tileSize=fe(e,1,128,"tileSize"),this._resize()}get samples(){return this._samples}set samples(e){e=fe(e,2,64,"samples"),e!==this._samples&&(this._samples=e,this._reconstructMat.defines.MB_SAMPLES=e,this._reconstructMat.needsUpdate=!0)}get shutter(){return this._shutter}set shutter(e){this._shutter=nt(e,"shutter")}reset(){}setUpscale(e,t){const s=e>0?Math.max(1,e|0):0,i=s>0?Math.max(1,t|0):0;if(s===this._inW&&i===this._inH)return;const a=this._velocityMat,o=s>0;o!==this._inW>0&&(a.fragmentShader=o?Fs:Ue,o?a.defines.MB_UPSCALE=1:delete a.defines.MB_UPSCALE,a.needsUpdate=!0),this._inW=s,this._inH=i,o&&a.uniforms.uInRes.value.set(s,i)}setSize(e,t){this._w=Math.max(1,Math.floor(e)||1),this._h=Math.max(1,Math.floor(t)||1),this._resize()}render(e,t,s,i){const a=this.gbuffer,o=this.camera,n=a===null;if(n!==this._camOnly){this._camOnly=n;const v=this._velocityMat.defines;n?v.MB_CAMERA_ONLY=1:delete v.MB_CAMERA_ONLY,this._velocityMat.needsUpdate=!0}const l=this._velocityMat.uniforms;l.tDepth.value=s.depthTexture,l.tVelocity.value=n?null:a.velocity,l.tNormal.value=n?null:a.normal,l.uNear.value!==o.near&&(l.uNear.value=o.near),l.uFar.value!==o.far&&(l.uFar.value=o.far);const u=this._shutter,h=u>0&&i>0?Math.min(u/i,4):1,c=l.uBlur.value;c.x=.5*this._strength*h,c.y=Math.min(.5*this._maxBlur,this._tileSize);const f=e.autoClear;e.autoClear=!1,this._draw(e,this._vel,this._velocityMat);const m=this._tileMat.uniforms;m.tSrc.value=this._vel.textures[0],m.uDir.value.set(1,0),this._draw(e,this._tileX,this._tileMat),m.tSrc.value=this._tileX.texture,m.uDir.value.set(0,1),this._draw(e,this._tile,this._tileMat),this._neighborMat.uniforms.tTile.value=this._tile.texture,this._draw(e,this._neighbor,this._neighborMat),this._reconstructMat.uniforms.tColor.value=s.texture,this._draw(e,this._out,this._reconstructMat),e.autoClear=f}dispose(){for(const e of[this._vel,this._tileX,this._tile,this._neighbor,this._out])e.dispose();for(const e of[this._velocityMat,this._tileMat,this._neighborMat,this._reconstructMat])e.dispose();this._quad.dispose()}_draw(e,t,s){e.setRenderTarget(t),e.clear(!0,!1,!1),this._quad.material=s,this._quad.render(e)}_resize(){const e=this._w,t=this._h,s=this._tileSize,i=Math.max(1,Math.ceil(e/s)),a=Math.max(1,Math.ceil(t/s));this._vel.setSize(e,t),this._tileX.setSize(i,t),this._tile.setSize(i,a),this._neighbor.setSize(i,a),this._out.setSize(e,t),this._velocityMat.uniforms.uRes.value.set(e,t),this._tileMat.uniforms.uTile.value=s,this._reconstructMat.uniforms.uTile.value=s}}function ce(r,e){if(typeof r!="number"||!Number.isFinite(r)||r<=0)throw new Error(`[MotionBlurPass] ${e}: expected a finite number > 0, got ${r}`);return r}function fe(r,e,t,s){if(!Number.isInteger(r)||r<e||r>t)throw new Error(`[MotionBlurPass] ${s}: expected an integer in ${e}..${t}, got ${r}`);return r}function nt(r,e){if(typeof r!="number"||!Number.isFinite(r)||r<0)throw new Error(`[MotionBlurPass] ${e}: expected a finite number >= 0, got ${r}`);return r}const ge=Object.freeze({focusDistance:12,focalLength:50,fStop:2,sensorHeight:24,maxCoC:12,scale:.5,samples:24,nearBlur:!0,stableDepth:!1}),Rs=Math.PI*(3-Math.sqrt(5));function Es(r,e,t,s,i,a){const o=t,n=e*1e3;return o/s*o/(n-o)*(1-n/(r*1e3))*a/i}function lt(r,e=new Float32Array(2*r)){for(let t=0;t<r;t++){const s=Math.sqrt((t+.5)/r),i=t*Rs;e[2*t]=s*Math.cos(i),e[2*t+1]=s*Math.sin(i)}return e}const Os=`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,Ot=`
  uniform vec3 uCoc;
  uniform float uNear, uFar;
  float dofCoc( float d ) {
    float z = uNear * uFar / ( uFar - ( uFar - uNear ) * d );
    return clamp( uCoc.x * ( 1.0 - uCoc.y / z ), - uCoc.z, uCoc.z );
  }`,ke=`
  uniform sampler2D tColor;
  uniform highp sampler2D tDepth;
  uniform vec2 uRatio; // full-resolution px per prefilter texel
  ${Ot}

  void main() {
    vec2 P = gl_FragCoord.xy * uRatio - 0.5, f = fract( P ); // bilinear footprint of this texel's centre
    ivec2 mx = textureSize( tColor, 0 ) - 1, i0 = clamp( ivec2( floor( P ) ), ivec2( 0 ), mx ), i1 = min( i0 + 1, mx );
    ivec2 p1 = ivec2( i1.x, i0.y ), p2 = ivec2( i0.x, i1.y );
    vec4 bw = vec4( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y );
    vec4 c = vec4( dofCoc( texelFetch( tDepth, i0, 0 ).x ), dofCoc( texelFetch( tDepth, p1, 0 ).x ),
                   dofCoc( texelFetch( tDepth, p2, 0 ).x ), dofCoc( texelFetch( tDepth, i1, 0 ).x ) );
    vec4 cs = c * step( 1e-6, bw ); // taps outside the footprint (weight 0) take no part in the choice
    float lo = min( min( cs.x, cs.y ), min( cs.z, cs.w ) ), hi = max( max( cs.x, cs.y ), max( cs.z, cs.w ) );
    float coc = - lo >= 0.5 ? lo : hi; // near wins once any tap is near-blurred
    vec4 w = bw * ( max( c * sign( coc ), 0.0 ) + 1e-3 );
    vec3 col = texelFetch( tColor, i0, 0 ).rgb * w.x + texelFetch( tColor, p1, 0 ).rgb * w.y
             + texelFetch( tColor, p2, 0 ).rgb * w.z + texelFetch( tColor, i1, 0 ).rgb * w.w;
    gl_FragColor = vec4( col / ( w.x + w.y + w.z + w.w ), coc );
  }`,zs=`
  uniform sampler2D tPre;
  uniform int uTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ) * uTile, e = min( o + uTile, textureSize( tPre, 0 ) );
    float m = 0.0;
    for ( int y = o.y; y < e.y; y ++ ) {
      for ( int x = o.x; x < e.x; x ++ ) m = max( m, - texelFetch( tPre, ivec2( x, y ), 0 ).a );
    }
    gl_FragColor = vec4( m, 0.0, 0.0, 1.0 );
  }`,Ls=`
  uniform sampler2D tTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ), mx = textureSize( tTile, 0 ) - 1;
    float m = 0.0;
    for ( int y = - 1; y <= 1; y ++ ) {
      for ( int x = - 1; x <= 1; x ++ ) m = max( m, texelFetch( tTile, clamp( o + ivec2( x, y ), ivec2( 0 ), mx ), 0 ).r );
    }
    gl_FragColor = vec4( m, 0.0, 0.0, 1.0 );
  }`,Ns=`
  uniform sampler2D tPre;
  uniform float uScale; // prefilter texels per full-resolution px
  uniform vec2 uKernel[ DOF_SAMPLES ];

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy ), mx = textureSize( tPre, 0 ) - 1;
    vec4 c0 = texelFetch( tPre, ip, 0 );
    if ( c0.a < 0.5 ) { gl_FragColor = vec4( c0.rgb, 1.0 ); return; } // not far-blurred: the composite keeps the sharp texel
    float R = c0.a * uScale;
    vec3 sum = c0.rgb;
    float ws = 1.0;
    for ( int i = 0; i < DOF_SAMPLES; i ++ ) {
      vec2 o = uKernel[ i ] * R;
      vec4 t = texelFetch( tPre, clamp( ivec2( floor( gl_FragCoord.xy + o ) ), ivec2( 0 ), mx ), 0 );
      float w = clamp( t.a * uScale - length( o ) + 1.0, 0.0, 1.0 ); // the tap's own disc reaches this texel
      sum += t.rgb * w;
      ws += w;
    }
    gl_FragColor = vec4( sum / ws, 1.0 );
  }`,Bs=`
  uniform sampler2D tPre;
  uniform sampler2D tNearMax;
  uniform int uTile;
  uniform float uScale;
  uniform vec2 uKernel[ DOF_SAMPLES ];

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy ), mx = textureSize( tPre, 0 ) - 1;
    float R = texelFetch( tNearMax, ip / uTile, 0 ).r; // largest near CoC around (full-resolution px)
    if ( R < 0.5 ) { gl_FragColor = vec4( 0.0 ); return; }
    float Rs = R * uScale, k = Rs * Rs / float( DOF_SAMPLES ), hs = 0.5 * uScale;
    vec3 sum = vec3( 0.0 );
    float a = 0.0;
    for ( int i = 0; i < DOF_SAMPLES; i ++ ) {
      vec2 o = uKernel[ i ] * Rs;
      vec4 t = texelFetch( tPre, clamp( ivec2( floor( gl_FragCoord.xy + o ) ), ivec2( 0 ), mx ), 0 );
      float n = max( - t.a * uScale, hs ); // the tap's near CoC radius in texels (>= 0.5 px)
      float w = clamp( n - length( o ) + 1.0, 0.0, 1.0 ) * smoothstep( 0.5, 2.0, - t.a ) * k / ( n * n );
      sum += t.rgb * w;
      a += w;
    }
    gl_FragColor = vec4( sum / max( a, 1.0 ), min( a, 1.0 ) );
  }`,Ie=`
  uniform sampler2D tColor;
  uniform highp sampler2D tDepth;
  uniform sampler2D tFar;
  #ifdef DOF_NEAR
  uniform sampler2D tNear;
  #endif
  varying vec2 vUv;
  ${Ot}

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy );
    vec4 c = texelFetch( tColor, ip, 0 );
    float d = texelFetch( tDepth, ip, 0 ).x;
  #ifdef DOF_STABLE_DEPTH
    // under TAA jitter: the closest depth of the pixel and its diagonals, so a silhouette keeps one CoC every frame
    ivec2 mx = textureSize( tDepth, 0 ) - 1;
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( - 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( - 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
  #endif
    float coc = dofCoc( d );
  #ifdef DOF_NEAR
    vec4 nf = texture2D( tNear, vUv );
  #else
    vec4 nf = vec4( 0.0 );
  #endif
    if ( abs( coc ) < 0.5 && nf.a <= 0.0 ) { gl_FragColor = c; return; } // in focus, nothing blurred in front: the input texel
    vec3 col = c.rgb;
    if ( coc > 0.5 ) col = mix( col, texture2D( tFar, vUv ).rgb, smoothstep( 0.5, 2.0, coc ) );
    gl_FragColor = vec4( col * ( 1.0 - nf.a ) + nf.rgb, c.a );
  }`,zt=`
  ivec2 dofIn( ivec2 p ) {
    ivec2 ds = textureSize( tDepth, 0 );
    return min( ivec2( ( vec2( p ) + 0.5 ) * vec2( ds ) / vec2( textureSize( tColor, 0 ) ) ), ds - 1 );
  }
  void main() {`;function Lt(r,e){return e.reduce((t,[s,i])=>{if(!t.includes(s))throw new Error(`[DoFPass] shader anchor not found: ${s}`);return t.split(s).join(i)},r)}const Us=Lt(ke,[[`
  void main() {`,zt],...["i0","p1","p2","i1"].map(r=>[`texelFetch( tDepth, ${r}, 0 )`,`texelFetch( tDepth, dofIn( ${r} ), 0 )`])]),ks=Lt(Ie,[[`
  void main() {`,zt],["float d = texelFetch( tDepth, ip, 0 ).x;","ivec2 dp = dofIn( ip ); float d = texelFetch( tDepth, dp, 0 ).x;"],["clamp( ip + ivec2(","clamp( dp + ivec2("]]),ut=Object.keys(ge);class Is extends E{constructor(e,t={}){super();for(const h in t)if(!ut.includes(h))throw new Error(`[DoFPass] unknown option '${h}' (${ut.join(", ")})`);this.needsSwap=!1,this.camera=e;const s=ge;this._focus=j(t.focusDistance??s.focusDistance,"focusDistance"),this._focal=j(t.focalLength??s.focalLength,"focalLength"),De(this._focus,this._focal),this._fStop=j(t.fStop??s.fStop,"fStop"),this._sensor=j(t.sensorHeight??s.sensorHeight,"sensorHeight"),this._maxCoC=ft(t.maxCoC??s.maxCoC),this._scale=ct(t.scale??s.scale),this._samples=ht(t.samples??s.samples,4,64,"samples"),this._nearBlur=me(t.nearBlur??s.nearBlur,"nearBlur"),this._stableDepth=me(t.stableDepth??s.stableDepth,"stableDepth"),this._nearDefined=null,this._stableDefined=null,this._w=1,this._h=1,this._up=!1,this._tile=1;const i={type:P,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1},a=(h,c)=>{const f=new w(1,1,c);return f.texture.name=h,f};this._pre=a("DoF.prefilter",{...i,minFilter:V,magFilter:V});const o={...i,format:ae,minFilter:V,magFilter:V};this._nearTile=a("DoF.nearTileMax",o),this._nearMax=a("DoF.nearDilated",o),this._far=a("DoF.far",{...i,minFilter:A,magFilter:A}),this._near=a("DoF.near",{...i,minFilter:A,magFilter:A}),this._out=a("DoF.out",{...i,minFilter:A,magFilter:A}),this._uCoc={value:new y},this._uNear={value:.1},this._uFar={value:1e3},this._uKernel={value:lt(this._samples)},this._uScale={value:.5};const n=(h,c,f,m={})=>new F({name:h,defines:m,uniforms:f,vertexShader:Os,fragmentShader:c,blending:B,depthTest:!1,depthWrite:!1}),l={uCoc:this._uCoc,uNear:this._uNear,uFar:this._uFar};this._prefilterMat=n("PostFXDoFPrefilter",ke,{tColor:{value:null},tDepth:{value:null},uRatio:{value:new p(2,2)},...l}),this._tileMat=n("PostFXDoFNearTile",zs,{tPre:{value:this._pre.texture},uTile:{value:1}}),this._dilateMat=n("PostFXDoFNearDilate",Ls,{tTile:{value:this._nearTile.texture}});const u={DOF_SAMPLES:this._samples};this._farMat=n("PostFXDoFFar",Ns,{tPre:{value:this._pre.texture},uScale:this._uScale,uKernel:this._uKernel},{...u}),this._nearMat=n("PostFXDoFNear",Bs,{tPre:{value:this._pre.texture},tNearMax:{value:this._nearMax.texture},uTile:{value:1},uScale:this._uScale,uKernel:this._uKernel},{...u}),this._compositeMat=n("PostFXDoF",Ie,{tColor:{value:null},tDepth:{value:null},tFar:{value:this._far.texture},tNear:{value:this._near.texture},...l}),this._quad=new N(null),this._resize()}get texture(){return this._out.texture}get farTexture(){return this._far.texture}get nearTexture(){return this._near.texture}get prefilterTexture(){return this._pre.texture}get focusDistance(){return this._focus}set focusDistance(e){De(j(e,"focusDistance"),this._focal),this._focus=e}get focalLength(){return this._focal}set focalLength(e){De(this._focus,j(e,"focalLength")),this._focal=e}get fStop(){return this._fStop}set fStop(e){this._fStop=j(e,"fStop")}get sensorHeight(){return this._sensor}set sensorHeight(e){this._sensor=j(e,"sensorHeight")}get maxCoC(){return this._maxCoC}set maxCoC(e){this._maxCoC=ft(e),this._resize()}get scale(){return this._scale}set scale(e){this._scale=ct(e),this._resize()}get nearBlur(){return this._nearBlur}set nearBlur(e){this._nearBlur=me(e,"nearBlur")}get stableDepth(){return this._stableDepth}set stableDepth(e){this._stableDepth=me(e,"stableDepth")}get samples(){return this._samples}set samples(e){if(e=ht(e,4,64,"samples"),e!==this._samples){this._samples=e,this._uKernel.value=lt(e);for(const t of[this._farMat,this._nearMat])t.defines.DOF_SAMPLES=e,t.needsUpdate=!0}}cocAt(e){return Es(e,this._focus,this._focal,this._fStop,this._sensor,this._h)}reset(){}setSize(e,t){this._w=Math.max(1,Math.floor(e)||1),this._h=Math.max(1,Math.floor(t)||1),this._resize()}render(e,t,s){const i=this.camera,a=this._nearBlur,o=this._stableDepth;if(a!==this._nearDefined||o!==this._stableDefined){this._nearDefined=a,this._stableDefined=o;const f=this._compositeMat.defines;a?f.DOF_NEAR=1:delete f.DOF_NEAR,o?f.DOF_STABLE_DEPTH=1:delete f.DOF_STABLE_DEPTH,this._compositeMat.needsUpdate=!0}const n=this._focal,l=this._focus*1e3;this._uCoc.value.set(n/this._fStop*n/(l-n)*this._h/this._sensor,this._focus,this._maxCoC),this._uNear.value!==i.near&&(this._uNear.value=i.near),this._uFar.value!==i.far&&(this._uFar.value=i.far);const u=this._prefilterMat.uniforms,h=this._compositeMat.uniforms;u.tColor.value=s.texture,u.tDepth.value=s.depthTexture,h.tColor.value=s.texture,h.tDepth.value=s.depthTexture;const c=e.autoClear;e.autoClear=!1,this._draw(e,this._pre,this._prefilterMat),a&&(this._draw(e,this._nearTile,this._tileMat),this._draw(e,this._nearMax,this._dilateMat),this._draw(e,this._near,this._nearMat)),this._draw(e,this._far,this._farMat),this._draw(e,this._out,this._compositeMat),e.autoClear=c}setUpscale(e){if(e=!!e,e===this._up)return;this._up=e;const t=[[this._prefilterMat,ke,Us],[this._compositeMat,Ie,ks]];for(const[s,i,a]of t)s.fragmentShader=e?a:i,e?s.defines.DOF_UPSCALE=1:delete s.defines.DOF_UPSCALE,s.needsUpdate=!0}_draw(e,t,s){e.setRenderTarget(t),e.clear(!0,!1,!1),this._quad.material=s,this._quad.render(e)}dispose(){for(const e of[this._pre,this._nearTile,this._nearMax,this._far,this._near,this._out])e.dispose();for(const e of[this._prefilterMat,this._tileMat,this._dilateMat,this._farMat,this._nearMat,this._compositeMat])e.dispose();this._quad.dispose()}_resize(){const e=this._w,t=this._h,s=Math.max(1,Math.round(e*this._scale)),i=Math.max(1,Math.round(t*this._scale)),a=i/t,o=this._tile=Math.max(1,Math.ceil(this._maxCoC*a)),n=Math.max(1,Math.ceil(s/o)),l=Math.max(1,Math.ceil(i/o));this._pre.setSize(s,i),this._far.setSize(s,i),this._near.setSize(s,i),this._nearTile.setSize(n,l),this._nearMax.setSize(n,l),this._out.setSize(e,t),this._prefilterMat.uniforms.uRatio.value.set(e/s,t/i),this._uScale.value=a,this._tileMat.uniforms.uTile.value=o,this._nearMat.uniforms.uTile.value=o}}function j(r,e){if(typeof r!="number"||!Number.isFinite(r)||r<=0)throw new Error(`[DoFPass] ${e}: expected a finite number > 0, got ${r}`);return r}function ht(r,e,t,s){if(!Number.isInteger(r)||r<e||r>t)throw new Error(`[DoFPass] ${s}: expected an integer in ${e}..${t}, got ${r}`);return r}function ct(r){if(typeof r!="number"||!(r>0&&r<=1))throw new Error(`[DoFPass] scale: expected a number in (0, 1], got ${r}`);return r}function ft(r){if(typeof r!="number"||!(r>0&&r<=64))throw new Error(`[DoFPass] maxCoC: expected a number in (0, 64] px, got ${r}`);return r}function me(r,e){if(typeof r!="boolean")throw new Error(`[DoFPass] ${e}: expected a boolean, got ${typeof r=="string"?`'${r}'`:r}`);return r}function De(r,e){if(!(r*1e3>e))throw new Error(`[DoFPass] focusDistance (${r} m) must exceed focalLength (${e} mm) / 1000`)}const js=16,Hs=`
vec3 engineApplyLut( highp sampler3D lut, vec3 c, float size ) { float s = ( size - 1.0 ) / size; return texture( lut, c * s + 0.5 / size ).rgb; }
`,Vs=(r,e,t,s)=>{s[0]=r,s[1]=e,s[2]=t};function Gs(r){if(!Number.isInteger(r)||r<2||r>256)throw new Error(`[Lut] size must be an integer in 2..256, got ${r}`);return r}function vi(r=js){return $s(r,Vs,"identity")}function $s(r,e,t=""){if(Gs(r),typeof e!="function")throw new Error("[Lut] lutFromFunction: fn must be a function (r, g, b, out) => void");const s=r,i=new Uint16Array(s*s*s*4),a=[0,0,0],o=1/(s-1),n=Ee.toHalfFloat(1);let l=0;for(let h=0;h<s;h++)for(let c=0;c<s;c++)for(let f=0;f<s;f++){a[0]=a[1]=a[2]=0,e(f*o,c*o,h*o,a);for(let m=0;m<3;m++){const v=+a[m];if(!Number.isFinite(v))throw new Error(`[Lut] lutFromFunction: fn(${f*o}, ${c*o}, ${h*o}) gave a non-finite channel ${m} (${a[m]})`);i[l+m]=Ee.toHalfFloat(v)}i[l+3]=n,l+=4}const u=new Xt(i,s,s,s);return u.name=`LUT.${t||"function"}`,u.format=re,u.type=P,u.minFilter=u.magFilter=A,u.wrapS=u.wrapT=u.wrapR=qt,u.generateMipmaps=!1,u.unpackAlignment=1,u.needsUpdate=!0,{size:s,texture:u,title:String(t),domainMin:[0,0,0],domainMax:[1,1,1]}}function _i(r,e,t,s,i=[0,0,0]){const a=r.size,o=r.texture.image.data,n=r.texture.type===P,l=a-1,u=Me(e)*l,h=Me(t)*l,c=Me(s)*l,f=Math.min(Math.floor(u),l),m=Math.min(Math.floor(h),l),v=Math.min(Math.floor(c),l),_=Math.min(f+1,l),M=Math.min(m+1,l),x=Math.min(v+1,l),T=u-f,O=h-m,L=c-v;for(let g=0;g<3;g++){const S=$(H(o,n,a,f,m,v,g),H(o,n,a,_,m,v,g),T),k=$(H(o,n,a,f,M,v,g),H(o,n,a,_,M,v,g),T),ne=$(H(o,n,a,f,m,x,g),H(o,n,a,_,m,x,g),T),se=$(H(o,n,a,f,M,x,g),H(o,n,a,_,M,x,g),T);i[g]=$($(S,k,O),$(ne,se,O),L)}return i}function H(r,e,t,s,i,a,o){const n=r[((a*t+i)*t+s)*4+o];return e?Ee.fromHalfFloat(n):n}function xi(r){r&&r.texture&&r.texture.dispose()}const Me=r=>r>0?r<1?r:1:0,$=(r,e,t)=>r+(e-r)*t;function mt(r,e){let t=1,s=0;for(;r>0;)t/=e,s+=t*(r%e),r=Math.floor(r/e);return s}function Ws(r="halton16"){if(Array.isArray(r)){if(!r.length)throw new Error("[CameraHistory] empty jitter pattern");const s=new Float64Array(r.length*2);return r.forEach((i,a)=>{s[2*a]=+i[0],s[2*a+1]=+i[1]}),s}const e=r==="halton16"?16:r==="halton8"?8:0;if(!e)throw new Error(`[CameraHistory] unknown jitter pattern '${r}' ('halton16' | 'halton8' | [[x, y], ...])`);const t=new Float64Array(e*2);for(let s=0;s<e;s++)t[2*s]=mt(s+1,2)-.5,t[2*s+1]=mt(s+1,3)-.5;return t}class Xs{constructor(e,{pattern:t="halton16",jitter:s=!0}={}){this.camera=e,this.jitter=!!s,this.frame=0,this._k=0,this.fresh=!0,this._reset=!0,this._applied=!1,this._ji=8,this._je0=0,this._je1=0,this._proj=new b,this._projInv=new b,this.setPattern(t),this.uniforms={uViewProj:{value:new b},uPrevViewProj:{value:new b},uInvViewProj:{value:new b},uUnjitteredProj:{value:new b},uReproj:{value:new b},uJitter:{value:new p},uPrevJitter:{value:new p},uFrame:{value:0}}}setPattern(e){this._seq=Ws(e),this.pattern=e}get patternLength(){return this._seq.length>>1}reset(){this._reset=!0}begin(e,t){const s=this.camera,i=this.uniforms;this._applied&&this.end();const a=i.uViewProj.value,o=i.uPrevViewProj.value,n=i.uInvViewProj.value,l=this.fresh=this._reset;this._reset=!1,l&&(this._k=0),l||o.copy(a),i.uUnjitteredProj.value.copy(s.projectionMatrix),a.multiplyMatrices(s.projectionMatrix,s.matrixWorldInverse),n.multiplyMatrices(s.matrixWorld,s.projectionMatrixInverse),l&&o.copy(a),i.uReproj.value.multiplyMatrices(o,n),Je.enginePrevViewProj.value.copy(o),Je.engineUnjitteredProj.value.copy(s.projectionMatrix);const u=i.uJitter.value,h=this._seq,c=this._k++%(h.length>>1)*2;if(i.uPrevJitter.value.copy(u),this.jitter&&e>0&&t>0&&(h[c]!==0||h[c+1]!==0)){u.x=h[c],u.y=h[c+1],this._proj.copy(s.projectionMatrix),this._projInv.copy(s.projectionMatrixInverse);const f=s.projectionMatrix.elements,m=u.x*2/e,v=u.y*2/t,_=this._ji=s.isOrthographicCamera?12:8;_===12?(f[12]-=m,f[13]-=v):(f[8]+=m,f[9]+=v),this._je0=f[_],this._je1=f[_+1],s.projectionMatrixInverse.copy(s.projectionMatrix).invert(),this._applied=!0}else u.set(0,0);i.uFrame.value=this.frame++}end(){if(!this._applied)return;this._applied=!1;const e=this.camera,t=e.projectionMatrix.elements,s=this._ji;t[s]!==this._je0||t[s+1]!==this._je1||(e.projectionMatrix.copy(this._proj),e.projectionMatrixInverse.copy(this._projInv))}}const qs=Math.PI/180,Nt=(r,e,t)=>r<e?e:r>t?t:r,Ks=(r,e,t)=>{const s=Nt((t-r)/(e-r),0,1);return s*s*(3-2*s)},je=(r,e,t)=>r+(e-r)*t,Q={uniforms:{tColor:{value:null},tDepth:{value:null},tAO:{value:null},tBloom:{value:null},tSky:{value:null},tAdapt:{value:null},uAE:{value:new q(.3,.5,.7,2)},uHasAO:{value:1},uHasBloom:{value:1},uHasFog:{value:1},uProjInv:{value:new b},uCamWorld:{value:new b},uCamPos:{value:new y},uNear:{value:.1},uFar:{value:6e3},uAO:{value:.75},uFogA:{value:new q(2e-4,1/700,0,.72)},uFogB:{value:new q(1e-4,1/40,0,.02)},uSunDir:{value:new y(0,1,0)},uSunCol:{value:new R(1,1,1)},uSunScatter:{value:0},uExposure:{value:.9},uShadowTint:{value:new y},uHighTint:{value:new y},uWB:{value:new y(1,1,1)},uContrast:{value:.15},uSaturation:{value:1.05},uVignette:{value:.3},uCA:{value:.006},uGrain:{value:0},uTime:{value:0},uRes:{value:new p(1,1)},uDebug:{value:0},uFXAA:{value:0},uFogColor:{value:new R},tSSR:{value:null},tVolume:{value:null},uVolColor:{value:new R(0,0,0)},tLUT:{value:null},uLutSize:{value:2},uLutStrength:{value:1},uAoLit:{value:0},uAoTint:{value:new y},uLift:{value:new y}},vertexShader:`
    uniform sampler2D tAdapt;
    uniform vec4 uAE;
    varying vec2 vUv;
    flat varying float vAE;
    void main() {
      vUv = uv;
      vAE = clamp( pow( uAE.x / exp2( textureLod( tAdapt, vec2( 0.5 ), 0.0 ).r ), uAE.y ), uAE.z, uAE.w );
      gl_Position = vec4( position.xy, 0.0, 1.0 );
    }`,fragmentShader:`
    uniform sampler2D tColor;
    uniform highp sampler2D tDepth;
    uniform sampler2D tAO;
    uniform sampler2D tBloom;
    #ifdef FOG_SKY
    uniform samplerCube tSky;
    #endif
    uniform vec3 uFogColor;
    uniform vec4 uAE;
    uniform float uHasAO, uHasBloom, uHasFog;
    uniform mat4 uProjInv, uCamWorld;
    uniform vec3 uCamPos;
    uniform float uNear, uFar, uAO;
    uniform vec4 uFogA, uFogB;
    uniform vec3 uSunDir, uSunCol;
    uniform float uSunScatter, uExposure;
    uniform vec3 uShadowTint, uHighTint, uWB;
    uniform float uContrast, uSaturation, uVignette, uCA, uGrain, uTime;
    uniform vec2 uRes;
    uniform int uDebug;
    uniform float uFXAA;
    varying vec2 vUv;
    flat varying float vAE;
    #ifdef FINAL_SSR
    uniform sampler2D tSSR;
    ${Ct}
    #endif
    #ifdef FINAL_VOLUMETRIC
    uniform sampler2D tVolume;
    uniform vec3 uVolColor;
    #endif
    #ifdef FINAL_LUT
    uniform highp sampler3D tLUT;
    uniform float uLutSize, uLutStrength;
    ${Hs}
    #endif

    // ACES filmic, identical to three's ACESFilmicToneMapping / OutputPass
    vec3 RRTAndODTFit( vec3 v ) {
      vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
      vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
      return a / b;
    }
    vec3 acesFilmic( vec3 color ) {
      const mat3 ACESInputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
      const mat3 ACESOutputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
      color *= uExposure / 0.6;
      color = ACESInputMat * color;
      color = RRTAndODTFit( color );
      color = ACESOutputMat * color;
      return clamp( color, 0.0, 1.0 );
    }
    vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) ); }
    // FXAA (console-style, 9 taps) on the HDR input, used when the scene target is not multisampled.
    // Taps are blended in a compressed space (c / (1 + max(c))) so bright lights do not smear.
    vec3 fxC( vec3 c ) { return c / ( 1.0 + max( c.r, max( c.g, c.b ) ) ); }
    vec3 fxU( vec3 c ) { return c / max( 1e-4, 1.0 - max( c.r, max( c.g, c.b ) ) ); }
    float fxL( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }
    vec3 fxaa( vec2 uv ) {
      vec2 rcp = 1.0 / uRes;
      vec3 nw = fxC( texture2D( tColor, uv + vec2( -0.5, -0.5 ) * rcp ).rgb ), ne = fxC( texture2D( tColor, uv + vec2( 0.5, -0.5 ) * rcp ).rgb );
      vec3 sw = fxC( texture2D( tColor, uv + vec2( -0.5, 0.5 ) * rcp ).rgb ), se = fxC( texture2D( tColor, uv + vec2( 0.5, 0.5 ) * rcp ).rgb );
      vec3 m = fxC( texture2D( tColor, uv ).rgb );
      float lNW = fxL( nw ), lNE = fxL( ne ), lSW = fxL( sw ), lSE = fxL( se ), lM = fxL( m );
      float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) ), lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
      if ( lMax - lMin < max( 0.03, lMax * 0.1 ) ) return fxU( m ); // no edge
      vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );
      float red = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 1.0 / 128.0 );
      dir = clamp( dir / ( min( abs( dir.x ), abs( dir.y ) ) + red ), vec2( -8.0 ), vec2( 8.0 ) ) * rcp;
      vec3 a = 0.5 * ( fxC( texture2D( tColor, uv + dir * ( 1.0 / 3.0 - 0.5 ) ).rgb ) + fxC( texture2D( tColor, uv + dir * ( 2.0 / 3.0 - 0.5 ) ).rgb ) );
      vec3 b = a * 0.5 + 0.25 * ( fxC( texture2D( tColor, uv - dir * 0.5 ).rgb ) + fxC( texture2D( tColor, uv + dir * 0.5 ).rgb ) );
      float lB = fxL( b );
      return fxU( ( lB < lMin || lB > lMax ) ? a : b );
    }
    float hash12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }

    // AO at this pixel. AO_UPSAMPLE_DEPTH (ao.upsample 'depth'): joint bilateral upsample instead of the bilinear tap,
    // the four AO texels around the pixel weighted bilinearly and by how close their linear depth (g) is to the
    // pixel's own (the AO blur's tolerance), so AO computed at a lower resolution keeps crisp silhouettes: no dark
    // halo on the background behind an object, no light rim along its edge. Texels of another surface keep a 1e-3
    // weight, so a pixel that matches none of them (a pole thinner than an AO texel) gets the plain bilinear value.
    float aoAt( float depth ) {
    #ifdef AO_UPSAMPLE_DEPTH
      float z = uNear * uFar / ( uFar - ( uFar - uNear ) * depth ); // linear view depth (m), the g channel's units
      ivec2 mx = textureSize( tAO, 0 ) - 1;
      vec2 p = vUv * vec2( mx + 1 ) - 0.5, f = fract( p );
      ivec2 i = ivec2( floor( p ) );
      vec2 a = texelFetch( tAO, clamp( i, ivec2( 0 ), mx ), 0 ).rg;
      vec2 b = texelFetch( tAO, clamp( i + ivec2( 1, 0 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 c = texelFetch( tAO, clamp( i + ivec2( 0, 1 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 d = texelFetch( tAO, clamp( i + 1, ivec2( 0 ), mx ), 0 ).rg;
      vec4 w = vec4( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y )
             * max( vec4( 1e-3 ), 1.0 - abs( vec4( a.y, b.y, c.y, d.y ) - z ) / ( 0.06 * z + 0.15 ) );
      return dot( w, vec4( a.x, b.x, c.x, d.x ) ) / dot( w, vec4( 1.0 ) );
    #else
      return texture2D( tAO, vUv ).r;
    #endif
    }
    #ifdef FINAL_VOLUMETRIC
    // aoAt's AO_UPSAMPLE_DEPTH, for any RG buffer with r = value, g = linear view depth (m) of its texel
    float depthAwareUpsample( sampler2D t, float z ) {
      ivec2 mx = textureSize( t, 0 ) - 1;
      vec2 p = vUv * vec2( mx + 1 ) - 0.5, f = fract( p );
      ivec2 i = ivec2( floor( p ) );
      vec2 a = texelFetch( t, clamp( i, ivec2( 0 ), mx ), 0 ).rg;
      vec2 b = texelFetch( t, clamp( i + ivec2( 1, 0 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 c = texelFetch( t, clamp( i + ivec2( 0, 1 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 d = texelFetch( t, clamp( i + 1, ivec2( 0 ), mx ), 0 ).rg;
      vec4 w = vec4( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y )
             * max( vec4( 1e-3 ), 1.0 - abs( vec4( a.y, b.y, c.y, d.y ) - z ) / ( 0.06 * z + 0.15 ) );
      return dot( w, vec4( a.x, b.x, c.x, d.x ) ) / dot( w, vec4( 1.0 ) );
    }
    // sun in-scatter of the volume pass at this pixel; sky pixels match the pass's sky texels (g = 60000 m)
    float volumeAt( float depth ) {
      return depthAwareUpsample( tVolume, depth < 1.0 ? uNear * uFar / ( uFar - ( uFar - uNear ) * depth ) : 60000.0 );
    }
    #endif

    #ifdef DEPTH_CLOSEST
    // Under TAA the colour is resolved over the jitter but the depth is this frame's jittered sample, so a silhouette
    // pixel would get AO / fog of the object one frame and of the background the next: take the closest depth of the
    // pixel and its 4 diagonals instead (the TAA pass's velocity choice), stable over the jitter sequence.
    float closestDepth() {
      ivec2 p = ivec2( gl_FragCoord.xy ), mx = textureSize( tDepth, 0 ) - 1;
      float d = texelFetch( tDepth, p, 0 ).x;
      d = min( d, texelFetch( tDepth, clamp( p + ivec2( - 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
      d = min( d, texelFetch( tDepth, clamp( p + ivec2( 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
      d = min( d, texelFetch( tDepth, clamp( p + ivec2( - 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
      return min( d, texelFetch( tDepth, clamp( p + ivec2( 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
    }
    #endif

    // optical depth through an exponential layer (density d at height 0, falloff k) from y0 to y1 over dist
    float layer( float y0, float y1, float dist, float d, float k ) {
      float x = k * ( y1 - y0 );
      float f = abs( x ) > 1e-3 ? ( 1.0 - exp( -x ) ) / x : 1.0 - 0.5 * x;
      return d * exp( -k * clamp( y0, -100.0, 4000.0 ) ) * dist * f;
    }

    void main() {
    #ifdef DEPTH_CLOSEST
      float depth = closestDepth();
    #else
      float depth = texture2D( tDepth, vUv ).x;
    #endif
      vec2 dc = vUv - 0.5;
      vec2 ca = dc * dot( dc, dc ) * uCA;
      float dbgT = 1.0;
      vec3 col;
      if ( uFXAA > 0.5 ) col = fxaa( vUv );
      else if ( uCA != 0.0 ) col = vec3( texture2D( tColor, vUv - ca ).r, texture2D( tColor, vUv ).g, texture2D( tColor, vUv + ca ).b );
      else col = texture2D( tColor, vUv ).rgb; // uCA 0: the one texel all three taps would read
    #ifdef FINAL_SSR
      col = engineSsrComposite( col, texture2D( tSSR, vUv ) ); // reflections (TAA off; under TAA the TAA pass does it)
    #endif

      if ( depth < 1.0 ) {
        if ( uHasAO > 0.5 ) {
          float ao = aoAt( depth );
          float lum = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
          ao = mix( ao, 1.0, smoothstep( 2.0, 10.0, lum ) ); // emissives / hot highlights keep their energy
          col *= mix( 1.0, ao, uAO );
        }
        if ( uHasFog > 0.5 ) {
          vec4 vp = uProjInv * vec4( vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
          vp.xyz /= vp.w;
          vec3 wp = ( uCamWorld * vec4( vp.xyz, 1.0 ) ).xyz;
          vec3 rd = wp - uCamPos;
          float dist = length( rd );
          vec3 dir = rd / max( dist, 1e-3 );
          float tau = layer( uCamPos.y - uFogA.z, wp.y - uFogA.z, dist, uFogA.x, uFogA.y )
                    + layer( uCamPos.y - uFogB.z, wp.y - uFogB.z, dist, uFogB.x, uFogB.y );
          float T = exp( -tau ) * ( 1.0 - smoothstep( uFogA.w * uFar, 0.985 * uFar, dist ) );
          vec3 fd = normalize( vec3( dir.x, max( dir.y, uFogB.w ), dir.z ) );
        #ifdef FOG_SKY
          vec3 fogCol = textureCube( tSky, fd ).rgb;
        #else
          vec3 fogCol = uFogColor; // no sky cube (no atmosphere): the fogColor option
        #endif
          if ( uSunScatter != 0.0 ) fogCol += uSunCol * uSunScatter * pow( max( dot( dir, uSunDir ), 0.0 ), 10.0 ); // 0 at night, high sun
          col = col * T + fogCol * ( 1.0 - T );
          dbgT = T;
        }
      }
    #ifdef FINAL_VOLUMETRIC
      col += uVolColor * volumeAt( depth ); // volumetric sun in-scatter (sky pixels too: shafts against the sky)
    #endif
      if ( uHasBloom > 0.5 ) col += texture2D( tBloom, vUv ).rgb;
      if ( uAE.y > 0.0 ) col *= vAE;

      col = acesFilmic( col * uWB );
      // grading in display-linear space
      float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = max( mix( vec3( l ), col, uSaturation ), 0.0 );
      col += uShadowTint * ( 1.0 - smoothstep( 0.0, 0.45, l ) ) + uHighTint * smoothstep( 0.3, 1.0, l );
      vec3 p = sqrt( max( col, 0.0 ) );          // contrast S-curve in a perceptual space
      p = mix( p, p * p * ( 3.0 - 2.0 * p ), uContrast );
      col = p * p;
      vec2 vc = dc * vec2( uRes.x / uRes.y, 1.0 );
      col *= mix( 1.0, smoothstep( 1.05, 0.25, length( vc ) ), uVignette );
      vec3 o = toSRGB( clamp( col, 0.0, 1.0 ) );
    #ifdef FINAL_LUT
      o = mix( o, engineApplyLut( tLUT, o, uLutSize ), uLutStrength ); // creative 3D LUT on the display-referred colour
    #endif
      if ( uGrain > 0.0 ) o += ( hash12( vUv * uRes + fract( uTime * 7.31 ) * 913.0 ) - 0.5 ) * uGrain * ( 1.0 - 0.6 * l ); // film grain in display space
      o += ( hash12( vUv * uRes + 17.0 ) - 0.5 ) / 255.0; // dither: no banding in the sky gradients
      gl_FragColor = vec4( o, 1.0 );
      if ( uDebug == 1 ) gl_FragColor = vec4( vec3( aoAt( depth ) ), 1.0 );
      else if ( uDebug == 2 ) gl_FragColor = vec4( toSRGB( clamp( texture2D( tBloom, vUv ).rgb, 0.0, 1.0 ) ), 1.0 );
      else if ( uDebug == 3 ) gl_FragColor = vec4( vec3( dbgT ), 1.0 );
    #ifdef FINAL_VOLUMETRIC
      if ( uDebug == 4 ) gl_FragColor = vec4( toSRGB( clamp( uVolColor * volumeAt( depth ), 0.0, 1.0 ) ), 1.0 );
    #endif
      gl_FragDepth = depth; // the lens-flare overlay depth-tests against the scene
    }`},Js="ivec2 p = ivec2( gl_FragCoord.xy ), mx = textureSize( tDepth, 0 ) - 1;",Bt=_e(Q.fragmentShader,Js,"ivec2 mx = textureSize( tDepth, 0 ) - 1, p = min( ivec2( vUv * vec2( mx + 1 ) ), mx );"),pt=`          col *= mix( 1.0, ao, uAO );
`,dt=`      col = p * p;
`,vt=`    varying vec2 vUv;
    flat varying float vAE;
`;function Ut(r){return r=_e(r,vt,vt+`    #ifdef FINAL_AO_LIT
    uniform float uAoLit;
    uniform vec3 uAoTint;
    #endif
    #ifdef FINAL_LIFT
    uniform vec3 uLift;
    #endif
`),r=_e(r,pt,`    #ifdef FINAL_AO_LIT
          // AO belongs to the ambient: pixels a light reaches (exposed luma 0.16 .. 0.85) keep most of their light
          ao = mix( ao, 1.0, uAoLit * smoothstep( 0.16, 0.85, lum * uExposure / 0.6 * ( uAE.y > 0.0 ? vAE : 1.0 ) ) );
    #endif
${pt}    #ifdef FINAL_AO_LIT
          { float a = max( mix( 1.0, ao, uAO ), 1e-3 ); col *= mix( vec3( 1.0 ), vec3( 1.0 / a ), uAoTint ); } // per channel mix( a, 1, tint ): a cool occlusion
    #endif
`),_e(r,dt,`${dt}    #ifdef FINAL_LIFT
      col = col * ( 1.0 - max( uLift.r, max( uLift.g, uLift.b ) ) ) + uLift; // a coloured floor: the darkest pixel is uLift, white stays white
    #endif
`)}const Ys=Ut(Q.fragmentShader),Qs=Ut(Bt);class Zs extends E{constructor(e){super(),this.fx=e,this.needsSwap=!1,this.material=new F({name:"PostFXFinal",uniforms:K.clone(Q.uniforms),vertexShader:Q.vertexShader,fragmentShader:Q.fragmentShader,depthTest:!0,depthWrite:!0,depthFunc:Yt,toneMapped:!1}),this._quad=new N(this.material),this._aoUp=!1,this._sky=!1,this._closest=!1,this._ssr=!1,this._vol=!1,this._lut=!1,this._up=!1,this._aoLit=!1,this._lift=!1,this._look=!1}setSize(e,t){this.material.uniforms.uRes.value.set(e,t)}render(e,t,s){const i=this.material.uniforms,a=this.fx,o=a.taaPass!==null&&a.taaPass.enabled,n=a.aoPass.upsample==="depth",l=a.atmo&&a.atmo.skyCube,u=!!l,h=o&&a.history.jitter&&a.taaOptions.stableDepth!==!1,c=a.ssrPass,f=c!==null&&c.enabled&&!o,m=a.volumetricPass,v=m!==null&&m.enabled,_=a.lutOptions,M=_.texture!==null,x=a._scaleOn,T=a.lookOptions,O=T.aoLit>0||T.aoTint[0]!==0||T.aoTint[1]!==0||T.aoTint[2]!==0,L=T.lift[0]!==0||T.lift[1]!==0||T.lift[2]!==0,g=O||L;if((x!==this._up||g!==this._look)&&(this._look=g,this.material.fragmentShader=x?g?Qs:Bt:g?Ys:Q.fragmentShader,this.material.needsUpdate=!0),O!==this._aoLit||L!==this._lift){this._aoLit=O,this._lift=L;const S=this.material.defines;O?S.FINAL_AO_LIT=1:delete S.FINAL_AO_LIT,L?S.FINAL_LIFT=1:delete S.FINAL_LIFT,this.material.needsUpdate=!0}if(O&&(i.uAoLit.value=T.aoLit,i.uAoTint.value.fromArray(T.aoTint)),L&&i.uLift.value.fromArray(T.lift),x!==this._up&&(this._up=x,x?this.material.defines.FINAL_UPSCALE=1:delete this.material.defines.FINAL_UPSCALE,this.material.needsUpdate=!0),n!==this._aoUp||u!==this._sky||h!==this._closest||f!==this._ssr||v!==this._vol||M!==this._lut){this._aoUp=n,this._sky=u,this._closest=h,this._ssr=f,this._vol=v,this._lut=M;const S=this.material.defines;n?S.AO_UPSAMPLE_DEPTH=1:delete S.AO_UPSAMPLE_DEPTH,u?S.FOG_SKY=1:delete S.FOG_SKY,h?S.DEPTH_CLOSEST=1:delete S.DEPTH_CLOSEST,f?S.FINAL_SSR=1:delete S.FINAL_SSR,v?S.FINAL_VOLUMETRIC=1:delete S.FINAL_VOLUMETRIC,M?S.FINAL_LUT=1:delete S.FINAL_LUT,this.material.needsUpdate=!0}i.tColor.value=a._source(s).texture,i.tSSR.value=f?c.texture:null,i.tVolume.value=v?m.texture:null,i.tLUT.value=M?_.texture:null,M&&(i.uLutSize.value=_.size,i.uLutStrength.value=_.strength),i.tDepth.value=s.depthTexture,i.uHasAO.value=a.aoPass.enabled?1:0,i.tAO.value=a.aoPass.aoTexture,i.uHasBloom.value=a.bloomPass.enabled?1:0,i.tBloom.value=a.bloomPass.bloomTexture,i.uHasFog.value=(u||a.fogColor)&&a.fog?1:0,i.tSky.value=l,!u&&a.fogColor&&i.uFogColor.value.copy(a.fogColor),i.tAdapt.value=a.exposurePass.texture,i.uAE.value.y=a.exposurePass.enabled&&a.autoExposure&&a.grade?a.grade.aeS:0,e.setRenderTarget(this.renderToScreen?null:t),this._quad.render(e)}dispose(){this.material.dispose(),this._quad.dispose()}}class ei extends is{constructor(e,t,s){super(e,t),this.fx=s}render(e,t,s,i,a){const o=this.fx;if(o.gbuffer===null){this._render(e,t,s,i,a);return}o._rendererClear=e.clear,e.clear=o._gbClear;try{this.clear||(e.setRenderTarget(s),o._clearGBuffer()),this._render(e,t,s,i,a)}finally{e.clear=o._rendererClear}}_render(e,t,s,i,a){const o=this.clear&&!this.clearDepth&&this.overrideMaterial===null&&this.clearColor===null&&this.clearAlpha===null;if(!this.fx.lateClear||!o){super.render(e,t,s,i,a);return}const n=e.autoClear;e.autoClear=!0,e.setRenderTarget(this.renderToScreen?null:s),e.render(this.scene,this.camera),e.autoClear=n}}class ti extends cs{constructor(e,t){super(t),this.fx=e}render(e,t,s,i){super.render(e,t,this.fx._source(s),i)}}const si=1,kt=2,_t=3;class ii extends Ms{constructor(e,t,s,i,a){super(t,s,i,a),this.fx=e}render(e,t,s,i,a){super.render(e,t,this.fx._source(s,si),i,a)}}class ai extends Is{constructor(e,t,s){super(t,s),this.fx=e}render(e,t,s,i,a){super.render(e,t,this.fx._source(s,kt),i,a)}}const xt=["scene","exposure","ao","ssr","volumetric","taa","motionBlur","dof","bloom","final"],ri=["blend","clamp","gamma","sharpen","filter","historyFormat","stableDepth","reject","velocityFirst","snap"],ee={ssr:He,volumetric:{...Et,intensity:1},motionBlur:Z,dof:ge},xe=new Map;for(const r of ri)xe.set(`taa.${r}`,{group:"taa",key:r});for(const r in ee)for(const e in ee[r])xe.set(`${r}.${e}`,{group:r,key:e});const oi={ssr:{scale:[0,1,!0],maxPixels:[1,1/0],steps:[1,128,!1,!1,!0],refine:[0,16,!1,!1,!0],maxDistance:[0,1e5,!0],thickness:[0,1e5,!0],maxRoughness:[0,1,!0],edgeFade:[0,.5],interval:[1,4,!1,!1,!0]},volumetric:{scale:[0,1,!0],maxPixels:[1,1/0],steps:[1,128,!1,!1,!0],maxDistance:[0,1/0,!0],g:[-1,1,!0,!0],density:[0,1/0],blend:[0,1,!1,!0],intensity:[0,1/0]},motionBlur:{strength:[0,1/0],maxBlur:[0,1/0,!0],tileSize:[1,128,!1,!1,!0],samples:[2,64,!1,!1,!0],shutter:[0,1/0]},dof:{focusDistance:[0,1/0,!0],focalLength:[0,1/0,!0],fStop:[0,1/0,!0],sensorHeight:[0,1/0,!0],maxCoC:[0,64,!0],scale:[0,1,!0],samples:[4,64,!1,!1,!0]}},ni=new Set(["steps","refine","samples","tileSize","interval"]),li={ssr:"SSR marches the depth with the G-buffer normals and roughness",motionBlur:"motion blur reads the G-buffer velocity","ao.normals":"the AO reads the G-buffer normals"},gt={ssr:{source:Pt}},St=["texture","size","strength","title","domainMin","domainMax"],ui=["auto","msaa","fxaa","taa"];function Re(r={},e={},t={}){const s=r.aa??"auto",i=!!r.gbuffer,a=e.maxSamples??0,o=r.msaa??"auto";if(!ui.includes(s))throw new Error(`[PostFX] unknown aa '${s}' ('auto' | 'msaa' | 'fxaa' | 'taa')`);if(s==="taa"&&!i)throw new Error("[PostFX] aa 'taa' needs gbuffer: true (TAA reprojects with the G-buffer velocity and flags)");let n=0,l=!1,u=!1;return i?(l=s==="auto"||s==="taa",u=s==="msaa"):s==="auto"?n=o==="auto"?(r.darkness??0)>.35||(r.pixels??0)>(r.msaaMaxPixels??1/0)?0:a:Math.min(a,o|0):s==="msaa"&&(n=o==="auto"?a:Math.min(a,o|0),u=a===0),t.mode=l?"taa":n>0?"msaa":"fxaa",t.samples=n,t.fxaa=!l&&n===0,t.taa=l,t.forced=u,t}let wt=!1;const hi=[{el:-40,wb:[.93,.98,1.08],aeK:.04,aeS:.45,aeMax:1.6,exp:1.35,bT:.85,bS:.85,bR:.62,sat:1,con:.14,split:.9,sh:[-.004,0,.012],hi:[.016,.006,-.008],vig:.38,grain:.022,ao:.6},{el:-8,wb:[.95,.98,1.07],aeK:.05,aeS:.45,aeMax:1.6,exp:1.3,bT:.95,bS:.75,bR:.6,sat:1.02,con:.14,split:.9,sh:[-.006,0,.016],hi:[.02,.008,-.01],vig:.36,grain:.016,ao:.65},{el:-3,wb:[1,.98,1.02],aeK:.09,aeS:.5,aeMax:1.9,exp:1.15,bT:1.3,bS:.55,bR:.55,sat:1.06,con:.15,split:1,sh:[-.008,.002,.018],hi:[.026,.01,-.012],vig:.34,grain:.008,ao:.7},{el:2,wb:[1.06,1,.92],aeK:.16,aeS:.5,aeMax:2,exp:.95,bT:2.2,bS:.32,bR:.5,sat:1.1,con:.17,split:1,sh:[-.01,.004,.018],hi:[.03,.012,-.016],vig:.32,grain:0,ao:.78},{el:10,wb:[1.045,1,.95],aeK:.19,aeS:.5,aeMax:2,exp:.92,bT:2.6,bS:.24,bR:.45,sat:1.08,con:.17,split:1,sh:[-.009,.004,.016],hi:[.026,.01,-.014],vig:.3,grain:0,ao:.8},{el:25,wb:[1.015,1,.985],aeK:.21,aeS:.5,aeMax:2,exp:.9,bT:2.9,bS:.2,bR:.4,sat:1.05,con:.16,split:.5,sh:[-.006,.002,.01],hi:[.012,.006,-.006],vig:.28,grain:0,ao:.8},{el:50,wb:[1,1,1],aeK:.22,aeS:.5,aeMax:2,exp:.88,bT:3,bS:.18,bR:.4,sat:1.04,con:.15,split:.35,sh:[-.004,.002,.008],hi:[.008,.005,-.004],vig:.26,grain:0,ao:.8},{el:90,wb:[1,1,1],aeK:.22,aeS:.5,aeMax:2,exp:.86,bT:3.1,bS:.17,bR:.4,sat:1.04,con:.15,split:.3,sh:[-.004,.002,.008],hi:[.008,.005,-.004],vig:.26,grain:0,ao:.8}];function ci(r,e){let t=0;for(;t<r.length-2&&e>r[t+1].el;)t++;const s=r[t],i=r[t+1],a=Ks(s.el,i.el,e),o={};for(const n in s)o[n]=Array.isArray(s[n])?s[n].map((l,u)=>je(l,i[n][u],a)):je(s[n],i[n],a);return o}class gi{constructor(e,t,s,i={}){this.renderer=e,this.scene=t,this.camera=s,this.atmo=i.atmosphere||null;const a=e.getSize(new p);this.width=i.width??a.x,this.height=i.height??a.y,this.pixelRatio=i.pixelRatio??e.getPixelRatio(),this.enabled=!0,this.fog=i.fog??!0,this.exposureScale=1,this.autoExposure=i.autoExposure??!0,this.gradeKeys=i.grade||hi,this.fogFarFade=i.fogFarFade??.72,this.fogMinSkyEl=i.fogMinSkyElevation??.02,this.fogColor=i.fogColor!=null?new R(i.fogColor):null,this.fogParams={haze:2e-4,hazeK:1/700,hazeBase:0,mist:1e-4,mistK:1/40,...i.fogParams||{}},this.maxSamples=Math.min(i.samples??4,e.capabilities.maxSamples||0),this.msaa=i.msaa??"auto",this.msaaMaxPixels=i.msaaMaxPixels??1/0,this.lateClear=i.lateClear??!0,this._compactHDR=i.compactHDR,this.aa=i.aa??"auto",this.taaOptions={blend:.9,clamp:"variance",gamma:1,sharpen:0,filter:"catmull-rom",historyFormat:"rgba16f",stableDepth:!1,reject:"quad",velocityFirst:!1,snap:!1};for(const u in i.taa||{})this._setTaaOption(u,i.taa[u]);this.jitter=i.jitter??!0,this._renderScale=bt(i.renderScale??1),this._scaleOn=!1,this.onInternalResize=null,this.jitterPattern=i.jitterPattern??"halton16",this.timing=!!i.timing,this.timings={scene:0,exposure:0,ao:0,ssr:0,volumetric:0,taa:0,motionBlur:0,dof:0,bloom:0,final:0,flare:0,total:0},this._aaIn={aa:"auto",gbuffer:!1,msaa:"auto",msaaMaxPixels:1/0,darkness:0,pixels:0},this._aaCaps={maxSamples:this.maxSamples},this._aaOut=Re({aa:this.aa,gbuffer:!!i.gbuffer},this._aaCaps),this.ssrOptions={...He},this.volumetricOptions={...ee.volumetric},this.motionBlurOptions={...Z,strength:0},this.dofOptions={...ge},this.lutOptions={texture:null,size:0,strength:1},this.lookOptions={aoLit:0,aoTint:[0,0,0],lift:[0,0,0]};for(const u in i.look||{})this._setLook(u,i.look[u]);this._next=null,this._ssrOn=this._parseToggle("ssr",i.ssr),this._volOn=this._parseToggle("volumetric",i.volumetric),this._dofOn=this._parseToggle("dof",i.dof);const o=this._parseMotionBlur(i.motionBlur);if(this._aoNormals=X((i.ao&&i.ao.normals)??"depth",Oe,"ao.normals"),i.lut!=null&&i.lut!==!1&&this._setLut(i.lut),!i.gbuffer){if(this._ssrOn)throw W("ssr");if(o.strength>0)throw W("motionBlur");if(this._aoNormals==="gbuffer")throw W("ao.normals")}if(this._volOn&&!this.atmo)throw At();Object.assign(this.motionBlurOptions,o),this._warnedForced=!1,this.gbuffer=null,this.history=null,this.taaPass=null,this.ssrPass=null,this.volumetricPass=null,this.motionBlurPass=null,this.dofPass=null,this._tracked=[],this._trackOpts=[],this._trackedPools=[],this._spare=null,this._srcProxy={texture:null,depthTexture:null},this._rendererClear=null,this._gbClearing=!1,this._gbClear=(u=!0,h=!0,c=!0)=>{const f=this.renderer;this._rendererClear.call(f,u,h,c),u&&this.gbuffer!==null&&f.getRenderTarget()===this.gbuffer.target&&this._clearGBuffer()};const n=Math.max(1,Math.floor(this.width*this.pixelRatio)),l=Math.max(1,Math.floor(this.height*this.pixelRatio));this._W=n,this._H=l,this._iw=n,this._ih=l,this.composer=new ss(e,this._makeSceneTarget()),this.renderPass=new ei(t,s,this),this.exposurePass=new fs,this.aoPass=new ns(s,{radius:1.8,thickness:1.6,samples:12,resolutionScale:.5,maxPixels:6e5,upsample:"depth",compact:!0,...i.ao||{},normals:"depth"}),this.bloomPass=new ti(this,{strength:.3,radius:.45,threshold:2.8,resolutionScale:.5,...i.bloom||{}}),this.finalPass=new Zs(this);for(const u of[this.renderPass,this.exposurePass,this.aoPass,this.bloomPass,this.finalPass])this.composer.addPass(u);this.uniforms=this.finalPass.material.uniforms,this._passKeys=new Map([[this.renderPass,"scene"],[this.exposurePass,"exposure"],[this.aoPass,"ao"],[this.bloomPass,"bloom"],[this.finalPass,"final"]]),this.composer.setPixelRatio(1),this.composer.setSize(n,l),i.gbuffer&&this._buildGBuffer(!0),this._syncPasses(),this.atmo&&(this.atmo.setFogMode("post"),this.atmo.setFlareScale&&this.atmo.setFlareScale(l)),this._ver=-1,this._time=0,this.setTimeOfDay(this.atmo?this.atmo.darkness:0)}get ao(){return this.aoPass}get bloom(){return this.bloomPass}set debug(e){this.uniforms.uDebug.value={ao:1,bloom:2,fog:3,volumetric:4}[e]||0}get debug(){return[null,"ao","bloom","fog","volumetric"][this.uniforms.uDebug.value]}get sceneDepth(){return this.composer.readBuffer.depthTexture}get colorSource(){return this._source(this.composer.readBuffer).texture}get renderScaleInEffect(){return this._scaleOn?this._renderScale:1}get internalWidth(){return this._iw}get internalHeight(){return this._ih}get ssr(){return this.ssrPass!==null}get volumetric(){return this.volumetricPass!==null}get motionBlur(){return this.motionBlurPass!==null?this.motionBlurOptions.strength:0}get dof(){return this.dofPass!==null?{...this.dofOptions}:null}get lut(){const e=this.lutOptions;return e.texture!==null?{texture:e.texture,size:e.size,strength:e.strength}:null}setSize(e,t,s=this.pixelRatio){this.width=e,this.height=t,this.pixelRatio=s;const i=Math.max(1,Math.floor(e*s)),a=Math.max(1,Math.floor(t*s));this._W=i,this._H=a;const o=this.composer,n=this.gbuffer;n&&(n.setSize(this._scaleOn?de(i,this._renderScale):i,this._scaleOn?de(a,this._renderScale):a),o.renderTarget2=o.readBuffer=this._spare),o.setSize(i,a),n&&this._bindGBuffer(),this._scaleOn?this._iw=-1:(this._iw=i,this._ih=a),this._applyAA(this._aaDark),this.atmo&&this.atmo.setFlareScale&&this.atmo.setFlareScale(a),this.onInternalResize&&this.onInternalResize(this._iw,this._ih)}setEnabled(e){const t=this.enabled;this.enabled=!!e,this.enabled&&!t&&this.history&&this.history.reset(),this.enabled&&!t&&this.volumetricPass&&this.volumetricPass.reset(),this.atmo&&this.atmo.setFogMode(this.enabled&&this.fog?"post":"scene")}setTimeOfDay(e=0){const t=this.atmo&&Number.isFinite(this.atmo.sunEl)?this.atmo.sunEl/qs:je(20,-20,Nt(e,0,1)),s=this.grade=ci(this.gradeKeys,t),i=this.uniforms;this.baseExposure=(this.renderer.toneMappingExposure||.9)/.9*s.exp,i.uSaturation.value=s.sat,i.uContrast.value=s.con,i.uShadowTint.value.set(s.sh[0]*s.split,s.sh[1]*s.split,s.sh[2]*s.split),i.uHighTint.value.set(s.hi[0]*s.split,s.hi[1]*s.split,s.hi[2]*s.split),i.uVignette.value=s.vig,i.uWB.value.set(s.wb[0],s.wb[1],s.wb[2]),i.uGrain.value=s.grain,i.uAO.value=s.ao,this._applyAA(e),i.uAE.value.set(s.aeK,this.autoExposure?s.aeS:0,.6,s.aeMax),this.exposurePass.reset(),this.bloomPass.threshold=s.bT,this.bloomPass.strength=s.bS,this.bloomPass.radius=s.bR,this.atmo&&(this._ver=this.atmo.version)}_applyAA(e=this.atmo?this.atmo.darkness:this._aaDark??0){this._aaDark=e;const t=this._aaIn;t.aa=this.aa,t.gbuffer=this.gbuffer!==null,t.msaa=this.msaa,t.msaaMaxPixels=this.msaaMaxPixels,t.darkness=e,t.pixels=this._W*this._H;const s=Re(t,this._aaCaps,this._aaOut),i=s.samples;if(this.gbuffer===null)for(const a of[this.composer.renderTarget1,this.composer.renderTarget2])a.samples!==i&&(a.samples=i,a.dispose());this.uniforms.uFXAA.value=s.fxaa?1:0,this.taaPass&&(this.taaPass.enabled=s.taa),this._syncScale(),this._syncSsrJitter(),this.history&&(this.history.jitter=s.taa&&this.jitter),s.forced&&!this._warnedForced&&(this._warnedForced=!0,console.warn(`[PostFX] aa '${this.aa}' is unavailable ${this.gbuffer?"on the single-sampled G-buffer":"without MSAA support"}: using FXAA`))}setMSAA(e,t){this.msaa=e,t!==void 0&&(this.msaaMaxPixels=t??1/0),this.gbuffer===null&&(this.aa="auto"),this._applyAA()}setAA(e){return Re({aa:e,gbuffer:this.gbuffer!==null},this._aaCaps),this.aa=e,this._applyAA(),this}setGBuffer(e){return e=!!e,e===(this.gbuffer!==null)?this:(this._buildGBuffer(e),this._applyAA(),this)}syncGBuffer(){return this.gbuffer&&this.gbuffer.sync(this.scene),this}track(e,t){if(!e)return 0;const s=this._tracked.indexOf(e);return s<0?(this._tracked.push(e),this._trackOpts.push(t)):this._trackOpts[s]=t,this.gbuffer?this.gbuffer.track(e,t):0}untrack(e){const t=this._tracked.indexOf(e);t>=0&&(this._tracked.splice(t,1),this._trackOpts.splice(t,1)),this.gbuffer&&this.gbuffer.untrack(e)}trackPool(e){e&&!this._trackedPools.includes(e)&&this._trackedPools.push(e),this.gbuffer&&this.gbuffer.trackPool(e)}untrackPool(e){const t=this._trackedPools.indexOf(e);t>=0&&this._trackedPools.splice(t,1),this.gbuffer&&this.gbuffer.untrackPool(e)}_setTaaOption(e,t){switch(e){case"blend":case"sharpen":case"gamma":if(typeof t!="number"||!Number.isFinite(t))throw new Error(`[PostFX] taa.${e}: expected a finite number, got ${t}`);break;case"clamp":X(t,ze,"taa.clamp");break;case"filter":X(t,Le,"taa.filter");break;case"historyFormat":X(t,Ne,"taa.historyFormat");break;case"reject":X(t,Be,"taa.reject");break;case"stableDepth":case"velocityFirst":case"snap":t=!!t;break;default:throw new Error(`[PostFX] unknown taa option '${e}' (${Object.keys(this.taaOptions).join(", ")})`)}this.taaOptions[e]=t}set(e,t){switch(e){case"aa":return this.setAA(t);case"gbuffer":return this.setGBuffer(t);case"jitter":this.jitter=!!t,this._applyAA();break;case"renderScale":this._renderScale=bt(t),this._syncScale();break;case"ao.enabled":this.aoPass.enabled=!!t;break;case"ao.normals":if(X(t,Oe,"ao.normals"),t==="gbuffer"&&this.gbuffer===null)throw W("ao.normals");this._aoNormals=t,this._syncAO();break;case"bloom.enabled":this.bloomPass.enabled=!!t;break;case"timing":this.timing=!!t;break;case"ssr":{const s=this._parseToggle("ssr",t,!0);if(s&&this.gbuffer===null)throw this._next=null,W("ssr");this._ssrOn=s,this._commitToggle("ssr");break}case"volumetric":{const s=this._parseToggle("volumetric",t,!0);if(s&&!this.atmo)throw this._next=null,At();this._volOn=s,this._commitToggle("volumetric");break}case"dof":this._dofOn=this._parseToggle("dof",t,!0),this._commitToggle("dof");break;case"motionBlur":if(typeof t=="number"){this._setOption("motionBlur","strength",t);break}{const s=this._parseMotionBlur(t);if(s.strength>0&&this.gbuffer===null)throw W("motionBlur");this._next=s,this._commitToggle("motionBlur")}break;case"lut":this._setLut(t);break;case"look.aoLit":case"look.aoTint":case"look.lift":this._setLook(e.slice(5),t);break;case"lut.strength":if(typeof t!="number"||!Number.isFinite(t))throw new Error(`[PostFX] lut.strength: expected a finite number, got ${t}`);this.lutOptions.strength=t;break;default:{const s=xe.get(e);if(s===void 0)throw new Error(`[PostFX] set: unknown path '${e}'`);if(s.group!=="taa"){this._setOption(s.group,s.key,t);break}this._setTaaOption(s.key,t),this.taaPass&&s.key!=="stableDepth"&&(this.taaPass[s.key]=this.taaOptions[s.key])}}return this}get(e){switch(e){case"aa":return this.aa;case"gbuffer":return this.gbuffer!==null;case"jitter":return this.jitter;case"renderScale":return this._renderScale;case"timing":return this.timing;case"ao.enabled":return this.aoPass.enabled;case"ao.normals":return this._aoNormals;case"bloom.enabled":return this.bloomPass.enabled;case"ssr":return this.ssr;case"volumetric":return this.volumetric;case"motionBlur":return this.motionBlur;case"dof":return this.dof;case"lut":return this.lut;case"lut.strength":return this.lutOptions.strength;case"look.aoLit":return this.lookOptions.aoLit;case"look.aoTint":return this.lookOptions.aoTint.slice();case"look.lift":return this.lookOptions.lift.slice();default:{const t=xe.get(e);if(t===void 0)throw new Error(`[PostFX] get: unknown path '${e}'`);return this._options(t.group)[t.key]}}}_setLook(e,t){const s=this.lookOptions;if(e==="aoLit"){if(typeof t!="number"||!(t>=0&&t<=1))throw new Error(`[PostFX] look.aoLit: expected a number in 0..1, got ${t}`);s.aoLit=t}else if(e==="aoTint"||e==="lift"){if(!Array.isArray(t)||t.length!==3||!t.every(i=>typeof i=="number"&&i>=0&&i<1))throw new Error(`[PostFX] look.${e}: expected [r, g, b] with each in 0..1, got ${t}`);s[e]=t.slice()}else throw new Error(`[PostFX] look: unknown option '${e}' (aoLit, aoTint, lift)`)}_options(e){switch(e){case"taa":return this.taaOptions;case"ssr":return this.ssrOptions;case"volumetric":return this.volumetricOptions;case"motionBlur":return this.motionBlurOptions;default:return this.dofOptions}}_pass(e){switch(e){case"ssr":return this.ssrPass;case"volumetric":return this.volumetricPass;case"motionBlur":return this.motionBlurPass;case"dof":return this.dofPass;default:return null}}_setOption(e,t,s){const i=pe(e,t,s);if(e==="dof"&&(t==="focusDistance"||t==="focalLength")){const l=this.dofOptions;yt(t==="focusDistance"?i:l.focusDistance,t==="focalLength"?i:l.focalLength)}const a=e==="motionBlur"&&t==="strength";if(a&&i>0&&this.gbuffer===null)throw W("motionBlur");const o=this._pass(e),n=e==="ssr"&&(t==="jitter"||t==="interval");o!==null&&t!=="intensity"&&!(a&&i===0)&&!n&&this._applyOption(o,t,i),this._options(e)[t]=i,a&&this._syncPasses(),n&&this._syncSsrJitter()}_syncSsrJitter(){const e=this.ssrPass;if(e===null)return;const t=this.taaPass!==null&&this.taaPass.enabled,s=this.ssrOptions.jitter&&t,i=t?this.ssrOptions.interval:1;e.jitter!==s&&(e.jitter=s),e.interval!==i&&(e.interval=i)}_syncScale(){const e=this.taaPass!==null&&this.taaPass.enabled,t=e?this._renderScale:1,s=t<1,i=this._W,a=this._H,o=s?de(i,t):i,n=s?de(a,t):a;if(!(s===this._scaleOn&&o===this._iw&&n===this._ih)){this._scaleOn=s,this._iw=o,this._ih=n,this.gbuffer!==null&&this.gbuffer.setSize(o,n),this.aoPass.setSize(o,n);for(const l of["ssr","volumetric","motionBlur","dof"]){const u=this._pass(l);u!==null&&this._scalePass(l,u)}this.taaPass!==null&&this.taaPass.setUpscale(s?o:0,n),this.onInternalResize&&this.onInternalResize(o,n)}}_scalePass(e,t){const s=this._scaleOn;switch(e){case"ssr":case"volumetric":t.setSize(this._iw,this._ih);break;case"motionBlur":t.setUpscale(s?this._iw:0,this._ih);break;default:t.setUpscale(s)}}_applyAll(e,t,s){const i=e==="dof";if(i){const a=s.focalLength>=t.focalLength;a||this._applyOption(t,"focalLength",s.focalLength),this._applyOption(t,"focusDistance",s.focusDistance),a&&this._applyOption(t,"focalLength",s.focalLength)}for(const a in s)a==="intensity"||e==="ssr"&&(a==="jitter"||a==="interval")||i&&(a==="focusDistance"||a==="focalLength")||this._applyOption(t,a,s[a])}_replaceOptions(e,t){switch(e){case"ssr":this.ssrOptions=t;break;case"volumetric":this.volumetricOptions=t;break;case"motionBlur":this.motionBlurOptions=t;break;default:this.dofOptions=t}}_applyOption(e,t,s){e[t]!==s&&(e[t]=s)}_parseToggle(e,t,s=!1){const i=this._options(e);if(this._next=null,t==null||t===!1)return!1;if(t===!0)return!0;if(typeof t!="object"||Array.isArray(t))throw new Error(`[PostFX] ${e}: expected false | true | { ${Object.keys(ee[e]).join(", ")} }, got ${te(t)}`);const a={...ee[e]};for(const o in t)a[o]=pe(e,o,t[o]);return e==="dof"&&yt(a.focusDistance,a.focalLength),s?this._next=a:Object.assign(i,a),!0}_parseMotionBlur(e){if((e==null||e===!1)&&(e=0),typeof e=="number")return{...this.motionBlurOptions,strength:pe("motionBlur","strength",e)};if(typeof e!="object"||Array.isArray(e))throw new Error(`[PostFX] motionBlur: expected 0 | strength | { ${Object.keys(Z).join(", ")} }, got ${te(e)}`);const t={...Z};for(const s in e)t[s]=pe("motionBlur",s,e[s]);return t}_commitToggle(e){const t=this._next,s=this._pass(e);if(this._next=null,t!==null){const i=e==="ssr"?this._ssrOn:e==="volumetric"?this._volOn:e==="dof"?this._dofOn:t.strength>0;if(s!==null&&i){const a=this._options(e);try{this._applyAll(e,s,t)}catch(o){try{this._applyAll(e,s,a)}catch{}throw o}}this._replaceOptions(e,t)}this._syncPasses()}_setLut(e){if(e==null||e===!1){this.lutOptions={texture:null,size:0,strength:1};return}if(typeof e!="object")throw new Error(`[PostFX] lut: expected null or { texture: Data3DTexture, size, strength }, got ${te(e)}`);for(const o in e)if(!St.includes(o))throw new Error(`[PostFX] unknown lut option '${o}' (${St.join(", ")})`);const t=e.texture;if(!t||!t.isData3DTexture)throw new Error(`[PostFX] lut.texture: expected a THREE.Data3DTexture (the Assets 'lut' value), got ${t}`);const s=e.size??(t.image&&t.image.width);if(!Number.isInteger(s)||s<2||s>256)throw new Error(`[PostFX] lut.size: expected an integer in [2, 256], got ${s}`);const i=e.strength??1;if(typeof i!="number"||!Number.isFinite(i))throw new Error(`[PostFX] lut.strength: expected a finite number, got ${i}`);const a=(o,n)=>o!=null&&(!Array.isArray(o)||o.some(l=>l!==n));(a(e.domainMin,0)||a(e.domainMax,1))&&console.warn("[PostFX] lut: a domain other than 0..1 is not applied (inputs are display-space 0..1)"),this.lutOptions={texture:t,size:s,strength:i}}_syncPasses(){const e=this.gbuffer!==null;this._passOn("ssr",e&&this._ssrOn),this._passOn("volumetric",this._volOn),this._passOn("motionBlur",e&&this.motionBlurOptions.strength>0),this._passOn("dof",this._dofOn),this.taaPass!==null&&this.taaPass.ssr!==this.ssrPass&&(this.taaPass.ssr=this.ssrPass);const t=this.volumetricPass;t!==null&&t.history!==this.history&&(t.history=this.history),this._syncSsrJitter(),this._syncAO()}_syncAO(){const e=this.aoPass,t=this.gbuffer,s=t!==null?this._aoNormals:"depth";t!==null&&e.gbuffer!==t&&(e.gbuffer=t),(e.normals??"depth")!==s&&(e.normals=s),t===null&&e.gbuffer!=null&&(e.gbuffer=null)}_passOn(e,t){const s=this._pass(e);if(t===(s!==null))return;let i=null;if(t){switch(e){case"ssr":{const a=this.taaPass!==null&&this.taaPass.enabled,o={...this.ssrOptions,jitter:this.ssrOptions.jitter&&a,interval:a?this.ssrOptions.interval:1};i=new ps(this.camera,this.history,this.gbuffer,o);break}case"volumetric":{const a={...this.volumetricOptions};delete a.intensity,i=new ys(this.camera,this.history,this.atmo,a);break}case"motionBlur":i=new ii(this,this.camera,this.history,this.gbuffer,this.motionBlurOptions);break;default:i=new ai(this,this.camera,this.dofOptions)}this._placePass(i,e),this._scaleOn&&this._scalePass(e,i)}else this.composer.removePass(s),this._passKeys.delete(s),s.dispose();switch(e){case"ssr":this.ssrPass=i;break;case"volumetric":this.volumetricPass=i;break;case"motionBlur":this.motionBlurPass=i;break;default:this.dofPass=i}}_placePass(e,t){const s=this.composer,i=xt.indexOf(t);let a=s.passes.length;for(let o=0;o<s.passes.length;o++)if(xt.indexOf(this._passKeys.get(s.passes[o]))>i){a=o;break}s.insertPass(e,a),this._passKeys.set(e,t)}setAOResolution({scale:e,maxPixels:t,upsample:s}={}){const i=this.aoPass;return s!==void 0&&(i.upsample=s),i.setResolution(e??i.scale,t===void 0?i.maxPixels:t),{width:i.rtA.width,height:i.rtA.height}}_syncFrame(e){const t=this.atmo,s=this.uniforms,i=this.camera;if(t&&t.version!==this._ver&&this.setTimeOfDay(t.darkness),this._time+=e||0,s.uTime.value=this._time%1e3,s.uExposure.value=this.baseExposure*this.exposureScale,s.uProjInv.value.copy(i.projectionMatrixInverse),s.uCamWorld.value.copy(i.matrixWorld),s.uCamPos.value.setFromMatrixPosition(i.matrixWorld),s.uNear.value=i.near,s.uFar.value=i.far,t){const a=t.fogParams;s.uFogA.value.set(a.haze,a.hazeK,a.hazeBase||0,this.fogFarFade),s.uFogB.value.set(a.mist,a.mistK,0,this.fogMinSkyEl);const o=t.scatterColor||t.sunColor;s.uSunDir.value.copy(t.scatterDir||t.sunDir),s.uSunCol.value.copy(o);const n=this.volumetricPass;s.uSunScatter.value=n!==null&&n.enabled?0:a.sunScatter,n!==null&&s.uVolColor.value.copy(o).multiplyScalar((t.sun?t.sun.intensity:1)*this.volumetricOptions.intensity)}else{const a=this.fogParams;s.uFogA.value.set(a.haze,a.hazeK,a.hazeBase||0,this.fogFarFade),s.uFogB.value.set(a.mist,a.mistK,0,this.fogMinSkyEl),s.uSunScatter.value=0}}render(e){const t=this.renderer;if(!this.enabled){t.render(this.scene,this.camera),this.atmo&&this.atmo.renderFlare(t,this.camera);return}const s=this.timing,i=s?performance.now():0,a=this.history,o=this.gbuffer;this.camera.updateMatrixWorld(),o!==null&&this.composer.readBuffer!==o.target&&this._bindGBuffer(),a!==null&&a.begin(this._iw,this._ih);const n=this.taaPass,l=this.ssrPass;l!==null&&n!==null&&n.resetPending&&l.interval>1&&l.reset(),this._syncFrame(e);const u=t.info,h=u.autoReset;u.autoReset=!1,u.reset();try{s?this._renderTimed(e):this.composer.render(e)}finally{a!==null&&a.end()}if(o!==null&&o.endFrame(),this.atmo){const c=s?performance.now():0;this.atmo.renderFlare(t,this.camera),s&&(this.timings.flare=performance.now()-c)}u.autoReset=h,s&&(this.timings.total=performance.now()-i)}dispose(){this.composer.dispose(),this.aoPass.dispose(),this.bloomPass.dispose(),this.finalPass.dispose(),this.exposurePass.dispose(),this.taaPass&&this.taaPass.dispose();for(const e of[this.ssrPass,this.volumetricPass,this.motionBlurPass,this.dofPass])e&&e.dispose();this.gbuffer&&this.gbuffer.dispose(),this.atmo&&this.atmo.setFogMode("scene")}_renderTimed(e){const t=this.composer,s=this.renderer,i=this.timings,a=t.passes,o=this._passKeys;e===void 0&&(e=t.clock.getDelta());const n=s.getRenderTarget();for(let l=0;l<a.length;l++){const u=a[l],h=o.get(u);if(u.enabled===!1){h!==void 0&&(i[h]=0);continue}u.renderToScreen=t.renderToScreen&&t.isLastEnabledPass(l);const c=performance.now();u.render(s,t.writeBuffer,t.readBuffer,e,!1),u.needsSwap&&t.swapBuffers(),h!==void 0&&(i[h]=performance.now()-c)}this.taaPass===null&&(i.taa=0),this.ssrPass===null&&(i.ssr=0),this.volumetricPass===null&&(i.volumetric=0),this.motionBlurPass===null&&(i.motionBlur=0),this.dofPass===null&&(i.dof=0),s.setRenderTarget(n)}_makeSceneTarget(){const e=this._W,t=this._H,s=this.renderer,i=this.maxSamples,a=new Kt(e,t,Jt),n=this._compactHDR!==!1&&s.extensions.has("EXT_color_buffer_float")?{format:Ft,type:Tt}:{type:P},l=new w(e,t,{...n,samples:i,depthBuffer:!0,stencilBuffer:!1,depthTexture:a});return l.texture.name="PostFX.scene",l.texture.generateMipmaps=!1,l}_buildGBuffer(e){const t=this.composer,s=this._W,i=this._H;if(e){if(this.renderer.capabilities.reversedDepthBuffer)throw new Error("[PostFX] G-buffer / TAA need a standard depth buffer (reversedDepthBuffer is on)");if(!wt){if(Qt()===!1)throw new Error("[PostFX] G-buffer: installGBufferChunks() failed (three.js shader chunks changed)");wt=!0}const a=new Zt(this.renderer,{width:s,height:i});if(!a.supported)return a.dispose(),console.warn("[PostFX] G-buffer unavailable on this renderer: forward scene pass kept"),!1;this.gbuffer=a,a.sync(this.scene);for(let n=0;n<this._tracked.length;n++)a.track(this._tracked[n],this._trackOpts[n]);for(const n of this._trackedPools)a.trackPool(n);t.renderTarget1.dispose(),t.renderTarget2.dispose();const o=this._spare=new w(s,i,{type:P,depthBuffer:!1,stencilBuffer:!1});o.texture.name="PostFX.spare",t.renderTarget1=t.writeBuffer=o,this._bindGBuffer(),this.history=new Xs(this.camera,{pattern:this.jitterPattern,jitter:!1}),this.taaPass=new ws(this.camera,this.history,a,this.taaOptions),this.taaPass.enabled=!1,this._placePass(this.taaPass,"taa"),this._syncPasses()}else{t.removePass(this.taaPass),this._passKeys.delete(this.taaPass),this.taaPass.dispose(),this.taaPass=null,this.history=null;const a=this.gbuffer;this.gbuffer=null,this._syncPasses(),a.dispose(),this._spare.dispose(),this._spare=null;const o=this._makeSceneTarget();t.renderTarget1=t.writeBuffer=o,t.renderTarget2=t.readBuffer=o.clone(),t.renderTarget2.texture.name="EffectComposer.rt2",this.aa==="taa"&&(this.aa="auto")}}_bindGBuffer(){const e=this.composer;e.renderTarget2=e.readBuffer=this.gbuffer.target}_clearGBuffer(){if(!this._gbClearing){this._gbClearing=!0;try{this.gbuffer.clear(this.renderer)}finally{this._gbClearing=!1}}}_source(e,t=_t){const s=this.dofPass,i=this.motionBlurPass,a=this.taaPass;let o=null;if(t>=_t&&s!==null&&s.enabled?o=s.texture:t>=kt&&i!==null&&i.enabled?o=i.texture:a!==null&&a.enabled&&(o=a.texture),o===null)return e;const n=this._srcProxy;return n.texture=o,n.depthTexture=e.depthTexture,n}}function pe(r,e,t){const s=ee[r];if(!Object.prototype.hasOwnProperty.call(s,e))throw new Error(`[PostFX] unknown ${r} option '${e}' (${Object.keys(s).join(", ")})`);const i=s[e];if(typeof i=="boolean")return!!t;if(typeof i=="string"){const c=gt[r]&&gt[r][e];if(c)return X(t,c,`${r}.${e}`);if(typeof t!="string")throw new Error(`[PostFX] ${r}.${e}: expected a string, got ${t}`);return t}e==="maxPixels"&&t===null&&(t=1/0);const a=oi[r][e];if(typeof t!="number"||!(Number.isFinite(t)||t===1/0&&e==="maxPixels"))throw new Error(`[PostFX] ${r}.${e}: expected a ${e==="maxPixels"?"number (Infinity / null: no budget)":"finite number"}, got ${te(t)}`);const o=a?a[0]:0,n=a?a[1]:1/0,l=!!(a&&a[2]),u=!!(a&&a[3]),h=a?!!a[4]:ni.has(e);if((l?t<=o:t<o)||(u?t>=n:t>n)||h&&!Number.isInteger(t))throw new Error(`[PostFX] ${r}.${e}: expected ${h?"an integer":"a number"} in ${l?"(":"["}${o}, ${n}${u?")":"]"}, got ${te(t)}`);return t}const de=(r,e)=>Math.max(1,Math.round(r*e));function bt(r){if(typeof r!="number"||!Number.isFinite(r)||r<.5||r>1)throw new Error(`[PostFX] renderScale: expected a number in [0.5, 1], got ${te(r)}`);return r}const te=r=>typeof r=="string"?`'${r}'`:String(r);function yt(r,e){if(!(r*1e3>e))throw new Error(`[PostFX] dof.focusDistance (${r} m) must exceed dof.focalLength (${e} mm) / 1000`)}function W(r){const e=r==="ao.normals"?"ao.normals 'gbuffer'":r;return new Error(`[PostFX] ${e} needs gbuffer: true (${li[r]})`)}function At(){return new Error("[PostFX] volumetric needs an atmosphere (the sun direction, colour and shadow cascades it marches)")}function _e(r,e,t){const s=r.indexOf(e);if(s<0||r.indexOf(e,s+1)>=0)throw new Error(`[PostFX] shader anchor not found once: ${e}`);return r.slice(0,s)+t+r.slice(s+e.length)}function X(r,e,t){if(!e.includes(r))throw new Error(`[PostFX] ${t}: unknown value '${r}' (${e.map(s=>`'${s}'`).join(" | ")})`);return r}export{ui as A,cs as B,Xs as C,hi as D,fs as E,js as L,Z as M,gi as P,ps as S,ws as T,Et as V,ns as a,Oe as b,ge as c,Is as d,Hs as e,Ms as f,Ct as g,He as h,Pt as i,ze as j,Le as k,$s as l,Ne as m,ys as n,Es as o,xi as p,ci as q,vi as r,Ws as s,_i as t,Re as u,vs as v,lt as w};
