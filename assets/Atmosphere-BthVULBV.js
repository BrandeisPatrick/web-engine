import{S as N,a as Se,P as Ke}from"./three.module-Dt1S_jJM.js";import{i as te,v as je,B as qe,bD as Xe,k as Ye,V as M,j as Ze,di as ye,eQ as le,by as Je,l as K,C as x,ct as Qe,a as me,U as de,z as et,dG as tt,dH as xe,cX as at,n as st,ad as ot,I as ie,L as it,J as nt,cB as rt,S as lt,b as Oe,ah as Ce,t as ct,ak as ht,am as ut,d2 as Me,dr as dt,dh as ce,eY as be,bB as ft,H as pt,cN as mt,av as _e,N as vt,aH as wt,P as gt}from"./three.core-BG5Iv3B7.js";import{c as P,s as E}from"./noise-g5kHFeMn.js";class j extends te{constructor(){const t=j.SkyShader,e=new je({name:t.name,uniforms:Xe.clone(t.uniforms),vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,side:qe,depthWrite:!1});super(new Ye(1,1,1),e),this.isSky=!0}}j.SkyShader={name:"SkyShader",uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new M},up:{value:new M(0,1,0)}},vertexShader:`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;
		uniform vec3 up;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( dot( vSunDirection, up ) );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorption + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,fragmentShader:`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform vec3 up;

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPosition );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
			L0 += ( vSunE * 19000.0 * Fex ) * sundisk;

			vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

			vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

			gl_FragColor = vec4( retColor, 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};class q extends te{constructor(){super(q.Geometry,new Ze({opacity:0,transparent:!0})),this.isLensflare=!0,this.type="Lensflare",this.frustumCulled=!1,this.renderOrder=1/0;const t=new M,e=new M,a=new ye(16,16),s=new ye(16,16);let i=de;const n=q.Geometry,r=new le({uniforms:{scale:{value:null},screenPosition:{value:null}},vertexShader:`

				precision highp float;

				uniform vec3 screenPosition;
				uniform vec2 scale;

				attribute vec3 position;

				void main() {

					gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );

				}`,fragmentShader:`

				precision highp float;

				void main() {

					gl_FragColor = vec4( 1.0, 0.0, 1.0, 1.0 );

				}`,depthTest:!0,depthWrite:!1,transparent:!1}),c=new le({uniforms:{map:{value:a},scale:{value:null},screenPosition:{value:null}},vertexShader:`

				precision highp float;

				uniform vec3 screenPosition;
				uniform vec2 scale;

				attribute vec3 position;
				attribute vec2 uv;

				varying vec2 vUV;

				void main() {

					vUV = uv;

					gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );

				}`,fragmentShader:`

				precision highp float;

				uniform sampler2D map;

				varying vec2 vUV;

				void main() {

					gl_FragColor = texture2D( map, vUV );

				}`,depthTest:!1,depthWrite:!1,transparent:!1}),l=new te(n,r),h=[],u=ve.Shader,d=new le({name:u.name,uniforms:{map:{value:null},occlusionMap:{value:s},color:{value:new x(16777215)},scale:{value:new K},screenPosition:{value:new M}},vertexShader:u.vertexShader,fragmentShader:u.fragmentShader,blending:Je,transparent:!0,depthWrite:!1}),w=new te(n,d);this.addElement=function(f){h.push(f)};const p=new K,g=new K,m=new Qe,v=new me;this.onBeforeRender=function(f,b,C){f.getCurrentViewport(v);const _=f.getRenderTarget(),D=_!==null?_.texture.type:de;i!==D&&(a.dispose(),s.dispose(),a.type=s.type=D,i=D);const T=v.w/v.z,z=v.z/2,S=v.w/2;let A=16/v.w;if(p.set(A*T,A),m.min.set(v.x,v.y),m.max.set(v.x+(v.z-16),v.y+(v.w-16)),e.setFromMatrixPosition(this.matrixWorld),e.applyMatrix4(C.matrixWorldInverse),!(e.z>0)&&(t.copy(e).applyMatrix4(C.projectionMatrix),g.x=v.x+t.x*z+z-8,g.y=v.y+t.y*S+S-8,m.containsPoint(g))){f.copyFramebufferToTexture(a,g);let L=r.uniforms;L.scale.value=p,L.screenPosition.value=t,f.renderBufferDirect(C,null,n,r,l,null),f.copyFramebufferToTexture(s,g),L=c.uniforms,L.scale.value=p,L.screenPosition.value=t,f.renderBufferDirect(C,null,n,c,l,null);const X=-t.x*2,Y=-t.y*2;for(let k=0,ge=h.length;k<ge;k++){const $=h[k],W=d.uniforms;W.color.value.copy($.color),W.map.value=$.texture,W.screenPosition.value.x=t.x+X*$.distance,W.screenPosition.value.y=t.y+Y*$.distance,A=$.size/v.w;const Ve=v.w/v.z;W.scale.value.set(A*Ve,A),d.uniformsNeedUpdate=!0,f.renderBufferDirect(C,null,n,d,w,null)}}},this.dispose=function(){r.dispose(),c.dispose(),d.dispose(),a.dispose(),s.dispose();for(let f=0,b=h.length;f<b;f++)h[f].texture.dispose()}}}class ve{constructor(t,e=1,a=0,s=new x(16777215)){this.texture=t,this.size=e,this.distance=a,this.color=s}}ve.Shader={name:"LensflareElementShader",uniforms:{map:{value:null},occlusionMap:{value:null},color:{value:null},scale:{value:null},screenPosition:{value:null}},vertexShader:`

		precision highp float;

		uniform vec3 screenPosition;
		uniform vec2 scale;

		uniform sampler2D occlusionMap;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUV;
		varying float vVisibility;

		void main() {

			vUV = uv;

			vec2 pos = position.xy;

			vec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.1, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.5 ) );

			vVisibility =        visibility.r / 9.0;
			vVisibility *= 1.0 - visibility.g / 9.0;
			vVisibility *=       visibility.b / 9.0;

			gl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D map;
		uniform vec3 color;

		varying vec2 vUV;
		varying float vVisibility;

		void main() {

			vec4 texture = texture2D( map, vUV );
			texture.a *= vVisibility;
			gl_FragColor = texture;
			gl_FragColor.rgb *= color;

		}`};q.Geometry=(function(){const o=new et,t=new Float32Array([-1,-1,0,0,0,1,-1,0,1,0,1,1,0,1,1,-1,1,0,0,1]),e=new tt(t,5);return o.setIndex([0,1,2,0,2,3]),o.setAttribute("position",new xe(e,3,0,!1)),o.setAttribute("uv",new xe(e,2,3,!1)),o})();function St(o){let t=o>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function yt(o){const t=St(o),e=new Uint8Array(256);for(let s=0;s<256;s++)e[s]=s;for(let s=255;s>0;s--){const i=Math.floor(t()*(s+1)),n=e[s];e[s]=e[i],e[i]=n}const a=new Uint8Array(512);for(let s=0;s<512;s++)a[s]=e[s&255];return a}const Z=[1,-1,1,-1,1,-1,0,0],J=[1,1,-1,-1,0,0,1,-1],De=o=>o*o*o*(o*(o*6-15)+10);function xt(o,t,e,a){const s=Math.floor(o),i=Math.floor(t),n=o-s,r=t-i,c=(s%e+e)%e,l=(i%e+e)%e,h=(c+1)%e,u=(l+1)%e,d=a[a[c]+l]&7,w=a[a[h]+l]&7,p=a[a[c]+u]&7,g=a[a[h]+u]&7,m=Z[d]*n+J[d]*r,v=Z[w]*(n-1)+J[w]*r,f=Z[p]*n+J[p]*(r-1),b=Z[g]*(n-1)+J[g]*(r-1),C=De(n),_=De(r),D=m+(v-m)*C,T=f+(b-f)*C;return(D+(T-D)*_)*.7071}function he(o,t,e,a,s,i,n,r=!1){const c=yt(a),l=new Float32Array(o*o);let h=1/0,u=-1/0;for(let p=0;p<o;p++)for(let g=0;g<o;g++){let m=t,v=1,f=0;const b=g/o,C=p/o;for(let _=0;_<e;_++){let D=xt(b*m,C*m,m,c);s&&(D=.6*D+.4*(.5-Math.abs(D))),f+=D*v,m*=2,v*=.52}l[p*o+g]=f,f<h&&(h=f),f>u&&(u=f)}const d=o*o;if(r){const p=Float32Array.from(l).sort(),g=new Float32Array(256);for(let m=0;m<256;m++)g[m]=p[Math.min(d-1,Math.floor((m+1)/256*d))];for(let m=0;m<d;m++){const v=l[m];let f=0,b=255;for(;f<b;){const C=f+b>>1;g[C]<v?f=C+1:b=C}i[m*4+n]=f}return}const w=255/(u-h||1);for(let p=0;p<d;p++)i[p*4+n]=Math.round((l[p]-h)*w)}function Ct(o=512){const t=new Uint8Array(o*o*4);he(o,4,6,1337,!0,t,0,!0),he(o,3,5,4242,!1,t,1,!0),he(o,16,3,99,!1,t,2);for(let a=0;a<o*o;a++)t[a*4+3]=255;const e=new at(t,o,o,st,de);return e.wrapS=e.wrapT=ot,e.magFilter=ie,e.minFilter=it,e.generateMipmaps=!0,e.anisotropy=4,e.colorSpace=nt,e.needsUpdate=!0,e.name="cloudNoise",{texture:e,data:t,size:o}}function ze(o,t,e,a=0){const s=o.size,i=o.data,n=(t-Math.floor(t))*s-.5,r=(e-Math.floor(e))*s-.5,c=Math.floor(n),l=Math.floor(r),h=n-c,u=r-l,d=m=>(m%s+s)%s,w=(m,v)=>i[(d(v)*s+d(m))*4+a]/255,p=w(c,l)+(w(c+1,l)-w(c,l))*h,g=w(c,l+1)+(w(c+1,l+1)-w(c,l+1))*h;return p+(g-p)*u}function Q(o,t){const e=document.createElement("canvas");e.width=e.height=o;const a=e.getContext("2d");t(a,o);const s=new rt(e);return s.colorSpace=lt,s}function Mt(){const o=Q(256,(s,i)=>{const n=i/2;let r=s.createRadialGradient(n,n,0,n,n,n);r.addColorStop(0,"rgba(255,255,255,1)"),r.addColorStop(.06,"rgba(255,250,235,0.85)"),r.addColorStop(.2,"rgba(255,225,180,0.25)"),r.addColorStop(.55,"rgba(255,200,150,0.05)"),r.addColorStop(1,"rgba(255,190,140,0)"),s.fillStyle=r,s.fillRect(0,0,i,i),s.globalCompositeOperation="lighter";for(let c=0;c<6;c++){s.save(),s.translate(n,n),s.rotate(c/6*Math.PI+.26);const l=s.createLinearGradient(-n,0,n,0);l.addColorStop(0,"rgba(255,240,220,0)"),l.addColorStop(.5,"rgba(255,240,220,0.18)"),l.addColorStop(1,"rgba(255,240,220,0)"),s.fillStyle=l,s.fillRect(-n,-.8,i,1.6),s.restore()}}),t=Q(128,(s,i)=>{const n=i/2,r=i*.44;s.beginPath();for(let l=0;l<6;l++){const h=l/6*Math.PI*2+Math.PI/6;s[l?"lineTo":"moveTo"](n+Math.cos(h)*r,n+Math.sin(h)*r)}s.closePath();const c=s.createRadialGradient(n,n,0,n,n,r);c.addColorStop(0,"rgba(255,255,255,0.35)"),c.addColorStop(.8,"rgba(255,255,255,0.55)"),c.addColorStop(1,"rgba(255,255,255,0.8)"),s.fillStyle=c,s.filter="blur(1.5px)",s.fill()}),e=Q(256,(s,i)=>{const n=i/2,r=s.createRadialGradient(n,n,i*.36,n,n,i*.48);r.addColorStop(0,"rgba(255,255,255,0)"),r.addColorStop(.35,"rgba(255,120,80,0.35)"),r.addColorStop(.55,"rgba(160,255,170,0.35)"),r.addColorStop(.75,"rgba(120,150,255,0.35)"),r.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=r,s.fillRect(0,0,i,i)}),a=Q(64,(s,i)=>{const n=i/2,r=s.createRadialGradient(n,n,0,n,n,n);r.addColorStop(0,"rgba(255,255,255,0.9)"),r.addColorStop(.5,"rgba(255,255,255,0.35)"),r.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=r,s.fillRect(0,0,i,i)});return{glow:o,hex:t,ring:e,dot:a}}const we=4,R="directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;";let I=null,ae=0,ue="";function bt(){const o=R.replace(/\[ i \]/g,"[ 0 ]"),t=R.replace(/\[ i \]/g,"[ 1 ]").replace(/directionalLightShadow\./g,"rcFarS.");return`
		#if ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
		if ( dot( directionalLights[ 1 ].color, vec3( 1.0 ) ) <= 0.0 && dot( directionalLights[ 1 ].direction, directionalLight.direction ) > 0.9999 ) {
			vec3 rcN = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
			vec3 rcF = vDirectionalShadowCoord[ 1 ].xyz / vDirectionalShadowCoord[ 1 ].w;
			vec2 rcE = abs( rcN.xy - 0.5 );
			float rcW = ( rcN.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE.x, rcE.y ) );
			float rcS = 1.0;
			if ( receiveShadow ) {
				DirectionalLightShadow rcFarS = directionalLightShadows[ 1 ];
				float rcSN = 1.0, rcSF = 1.0;
				if ( rcW < 1.0 ) rcSN = getShadow( directionalShadowMap[ 0 ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ 0 ] );
				if ( rcW > 0.0 ) {
					rcSF = getShadow( directionalShadowMap[ 1 ], rcFarS.shadowMapSize, rcFarS.shadowIntensity, rcFarS.shadowBias, rcFarS.shadowRadius, vDirectionalShadowCoord[ 1 ] );
					vec2 rcEF = abs( rcF.xy - 0.5 );
					rcSF = mix( rcSF, 1.0, smoothstep( 0.43, 0.495, max( rcEF.x, rcEF.y ) ) );
				}
				rcS = mix( rcSN, rcSF, rcW );
			}
			directLight.color *= rcS;
		} else {
			${o}
		}
		#elif ( UNROLLED_LOOP_INDEX == 1 )
		if ( dot( directLight.color, vec3( 1.0 ) ) > 0.0 ) {
			DirectionalLightShadow rcFarS = directionalLightShadows[ 1 ];
			${t}
		}
		#else
		${R}
		#endif`}const _t=o=>`dot( directionalLights[ ${o} ].color, vec3( 1.0 ) ) <= 0.0 && dot( directionalLights[ ${o} ].direction, directionalLight.direction ) > 0.9999`;function Ne(o){const t=o===0?"directionalLightShadow":`rcL${o}`;return`getShadow( directionalShadowMap[ ${o} ], ${t}.shadowMapSize, ${t}.shadowIntensity, ${t}.shadowBias, ${t}.shadowRadius, vDirectionalShadowCoord[ ${o} ] )`}function $e(o,t,e,a){a(`DirectionalLightShadow rcL${o} = directionalLightShadows[ ${o} ];`,e),a(`vec3 rc${o} = vDirectionalShadowCoord[ ${o} ].xyz / vDirectionalShadowCoord[ ${o} ].w;`,e),a(`vec2 rcE${o} = abs( rc${o}.xy - 0.5 );`,e),a(`bool rcF${o} = rcN == ${o+1};`,e),a(`float rcW${o} = rcF${o} ? 0.0 : ( rc${o}.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE${o}.x, rcE${o}.y ) );`,e),a(`float rcS${o} = 1.0, rcR${o} = 1.0;`,e),a(`if ( rcW${o} < 1.0 ) rcS${o} = ${Ne(o)};`,e),a(`if ( rcF${o} ) rcS${o} = mix( rcS${o}, 1.0, smoothstep( 0.43, 0.495, max( rcE${o}.x, rcE${o}.y ) ) );`,e),o+1<t&&(a(`#if NUM_DIR_LIGHT_SHADOWS > ${o+1}`,e),a(`else if ( rcW${o} > 0.0 ) {`,e),$e(o+1,t,e+1,a),a("}",e),a("#endif",e)),a(`rcR${o-1} = mix( rcS${o}, rcR${o}, rcW${o} );`,e)}function Dt(o){const t=R.replace(/\[ i \]/g,"[ 0 ]"),e=[""],a=(s,i)=>e.push("		"+"	".repeat(i)+s);a("#if ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )",0),a("{",0),a("int rcN = 1;",1);for(let s=1;s<o;s++)s>1&&a(`#if NUM_DIR_LIGHT_SHADOWS > ${s}`,s),a(`if ( ${_t(s)} ) {`,s),a(`rcN = ${s+1};`,s+1);for(let s=o-1;s>=1;s--)a("}",s),s>1&&a("#endif",s);return a("if ( rcN > 1 ) {",1),a("float rcS = 1.0;",2),a("if ( receiveShadow ) {",2),a("vec3 rc0 = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;",3),a("vec2 rcE0 = abs( rc0.xy - 0.5 );",3),a("float rcW0 = ( rc0.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE0.x, rcE0.y ) );",3),a("float rcS0 = 1.0, rcR0 = 1.0;",3),a(`if ( rcW0 < 1.0 ) rcS0 = ${Ne(0)};`,3),a("if ( rcW0 > 0.0 ) {",3),$e(1,o,4,a),a("}",3),a("rcS = mix( rcS0, rcR0, rcW0 );",3),a("}",2),a("directLight.color *= rcS;",2),a("} else {",1),a(t,2),a("}",1),a("}",0),a("#elif ( UNROLLED_LOOP_INDEX > 0 )",0),a("if ( dot( directLight.color, vec3( 1.0 ) ) > 0.0 ) {",0),a(R,1),a("}",0),a("#else",0),a(R,0),a("#endif",0),e.join(`
`)}function zt(o=2){const t=Math.max(2,Math.min(we,Math.round(o)||2));return t===2?bt():Dt(t)}function ra(){return I===!0?ae:0}function We(o=2){const t=Math.max(2,Math.min(we,Math.round(o)||2));if(I===!1)return!1;if(I===!0&&t<=ae)return!0;const e=N,a=zt(t);if(I===null){if(!e.lights_fragment_begin.includes(R))return console.warn("[render] shadow cascade patch: three.js chunk changed, using a single cascade"),I=!1,!1;e.lights_fragment_begin=e.lights_fragment_begin.replace(R,a)}else{if(!e.lights_fragment_begin.includes(ue))return console.warn(`[render] shadow cascade patch: lights_fragment_begin was replaced, keeping ${ae} cascades`),!1;e.lights_fragment_begin=e.lights_fragment_begin.replace(ue,()=>a)}return I=!0,ae=t,ue=a,!0}const Te="getDirectionalLightInfo( directionalLight, directLight );",fe="RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",Tt=`if ( directLight.color != vec3( 0.0 ) ) { ${fe} }`;let B=null;function At(){if(B!==null)return B;const o=N.lights_fragment_begin,t=o.indexOf(Te),e=t<0?-1:o.indexOf(fe,t);return t<0||o.lastIndexOf(Te)!==t||e<0||o.slice(t,e).includes("#pragma unroll_loop_end")?(console.warn("[render] skip-unlit patch: three.js chunk changed, directional lights stay unguarded"),B=!1,!1):(N.lights_fragment_begin=o.slice(0,e)+Tt+o.slice(e+fe.length),B=!0,!0)}function la(){return B===!0}const Pt=["pcf","fast","pcss"],se="ENGINE_SHADOW_FAST",oe="ENGINE_SHADOW_PCSS",H="engineDirShadowDepth",re="engineDirShadowPcss",O={length:0},ne={length:4};for(let o=0;o<4;o++)ne[o]=new me(0,0,0,0);const Et=`
#if defined( USE_SHADOWMAP ) && defined( ${se} ) && defined( SHADOWMAP_TYPE_PCF ) && NUM_DIR_LIGHT_SHADOWS > 0
	uniform sampler2DShadow ${H}[ NUM_DIR_LIGHT_SHADOWS ];
	float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		if ( inFrustum && shadowCoord.z <= 1.0 ) {
			vec2 s = sqrt( max( 0.2206 * shadowRadius * shadowRadius - 0.0417, 0.0 ) ) / shadowMapSize;
			vec3 p = shadowCoord.xyz;
			shadow = 0.2 * (
				texture( shadowMap, p ) +
				texture( shadowMap, vec3( p.xy + s * vec2( 2.0, 1.0 ), p.z ) ) +
				texture( shadowMap, vec3( p.xy + s * vec2( - 1.0, 2.0 ), p.z ) ) +
				texture( shadowMap, vec3( p.xy - s * vec2( 2.0, 1.0 ), p.z ) ) +
				texture( shadowMap, vec3( p.xy - s * vec2( - 1.0, 2.0 ), p.z ) ) );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#define directionalShadowMap ${H}
#endif
`,Ae=o=>Array.from({length:o},(t,e)=>{const a=Math.sqrt((e+.5)/o),s=e*2.39996323;return`vec2( ${(a*Math.cos(s)).toFixed(4)}, ${(a*Math.sin(s)).toFixed(4)} )`}).join(", "),ee=o=>`enginePcssShadow( directionalShadowMap[ ${o} ], ${H}[ ${o} ], ${re}[ ${o} ], shadowMapSize, shadowIntensity, shadowBias, shadowRadius, shadowCoord )`,Ge=`
#if defined( USE_SHADOWMAP ) && defined( ${oe} ) && defined( SHADOWMAP_TYPE_PCF ) && NUM_DIR_LIGHT_SHADOWS > 0 && NUM_DIR_LIGHT_SHADOWS <= 4
	uniform sampler2DShadow ${H}[ NUM_DIR_LIGHT_SHADOWS ];
	uniform vec4 ${re}[ NUM_DIR_LIGHT_SHADOWS ];
	const vec2 enginePcssSearch[ 8 ] = vec2[ 8 ]( ${Ae(8)} );
	const vec2 enginePcssDisc[ 12 ] = vec2[ 12 ]( ${Ae(12)} );
	const ivec4 enginePcssIndex = ivec4( 0, 1, 2, 3 );
	float enginePcssShadow( sampler2D packedMap, sampler2DShadow depthMap, vec4 pcss, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		// receiver plane: depth change per texel along the map's x / y (derivatives before any branch of this function;
		// callers may be in non-uniform flow, see the header)
		vec3 ddx = dFdx( shadowCoord.xyz ), ddy = dFdy( shadowCoord.xyz );
		float det = ddx.x * ddy.y - ddx.y * ddy.x;
		vec2 slope = abs( det ) > 1e-20 ? vec2( ddy.y * ddx.z - ddx.y * ddy.z, ddx.x * ddy.z - ddy.x * ddx.z ) / ( det * shadowMapSize ) : vec2( 0.0 );
		slope = clamp( slope, - pcss.z, pcss.z );
		if ( shadowCoord.x < 0.0 || shadowCoord.x > 1.0 || shadowCoord.y < 0.0 || shadowCoord.y > 1.0 || shadowCoord.z > 1.0 ) return 1.0;
		vec2 texel = 1.0 / shadowMapSize;
		vec3 p = shadowCoord.xyz;
		// 1. contact kernel: the 'fast' kernel (three's PCF width at shadowRadius)
		float s = sqrt( max( 0.2206 * shadowRadius * shadowRadius - 0.0417, 0.0 ) );
		vec2 g1 = s * vec2( 2.0, 1.0 ), g2 = s * vec2( - 1.0, 2.0 );
		float lit = 0.2 * (
			texture( depthMap, p ) +
			texture( depthMap, vec3( p.xy + g1 * texel, p.z + dot( slope, g1 ) ) ) +
			texture( depthMap, vec3( p.xy + g2 * texel, p.z + dot( slope, g2 ) ) ) +
			texture( depthMap, vec3( p.xy - g1 * texel, p.z - dot( slope, g1 ) ) ) +
			texture( depthMap, vec3( p.xy - g2 * texel, p.z - dot( slope, g2 ) ) ) );
		// 2. blocker search: raw depths from the packed map over the widest filter radius (one pattern for every pixel:
		// neighbours read the same texels, which keeps the texture cache warm; only the filter below is rotated)
		float nb = 0.0, zb = 0.0;
		for ( int k = 0; k < 8; k ++ ) {
			vec2 o = enginePcssSearch[ k ] * pcss.y;
			float d = unpackRGBAToDepth( texture( packedMap, p.xy + o * texel ) );
			#ifdef USE_REVERSED_DEPTH_BUFFER
			if ( d > p.z + dot( slope, o ) ) { nb += 1.0; zb += d; }
			#else
			if ( d < p.z + dot( slope, o ) ) { nb += 1.0; zb += d; }
			#endif
		}
		// no blocker: contact kernel; umbra (may harden the inner edge of a wide penumbra a little, see the header)
		if ( nb == 0.0 || ( nb == 8.0 && lit == 0.0 ) ) return mix( 1.0, lit, shadowIntensity );
		// 3. penumbra: filter radius from the mean blocker distance, at least the contact kernel's, at most pcss.y
		float rMin = 2.0 * sqrt( max( 0.441 * shadowRadius * shadowRadius - 0.0833, 0.0 ) );
		float rad = max( min( 0.5 * abs( p.z - zb / nb ) * pcss.x, pcss.y ), rMin );
		float wide = smoothstep( 1.5 * rMin, 2.5 * rMin, rad );
		if ( wide > 0.0 ) {
			float a = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy + 5.588238 * pcss.w, vec2( 0.06711056, 0.00583715 ) ) ) );
			mat2 rot = mat2( cos( a ), sin( a ), - sin( a ), cos( a ) );
			float sw = 0.0;
			for ( int k = 0; k < 12; k ++ ) {
				vec2 o = rot * enginePcssDisc[ k ] * rad;
				sw += texture( depthMap, vec3( p.xy + o * texel, p.z + dot( slope, o ) ) );
			}
			lit = mix( lit, sw * ( 1.0 / 12.0 ), wide );
		}
		return mix( 1.0, lit, shadowIntensity );
	}
	float getShadow( int cascade, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		#if NUM_DIR_LIGHT_SHADOWS > 3
		if ( cascade == 3 ) return ${ee(3)};
		#endif
		#if NUM_DIR_LIGHT_SHADOWS > 2
		if ( cascade == 2 ) return ${ee(2)};
		#endif
		#if NUM_DIR_LIGHT_SHADOWS > 1
		if ( cascade == 1 ) return ${ee(1)};
		#endif
		return ${ee(0)};
	}
	#define directionalShadowMap enginePcssIndex
#endif
`,ca=Ge;let U=null,V=null;function Be(o,t){const e=N;return[[e.shadowmap_pars_fragment,"uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];"],[e.shadowmap_pars_fragment,"float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord )"],[e.shadowmap_pars_fragment,"unpackRGBAToDepth"],[e.lights_fragment_begin,"getShadow( directionalShadowMap["]].every(([s,i])=>typeof s=="string"&&s.includes(i))?!0:(console.warn(`[render] ${o} shadow kernel: three.js shadow chunk changed, keeping '${t}'`),!1)}function pe(o,t){for(const e in Se){const a=Se[e].uniforms;a&&a.directionalShadowMap&&!a[o]&&(a[o]={value:t})}}function Lt(){return U!==null?U:Be("fast","pcf")?(N.shadowmap_pars_fragment+=Et,pe(H,O),U=!0,!0):(U=!1,!1)}function Rt(){return V!==null?V:Be("pcss","pcf")?(N.shadowmap_pars_fragment+=Ge,pe(H,O),pe(re,ne),V=!0,!0):(V=!1,!1)}function kt(o=!1){const t=new ct(1,1);return t.compareFunction=o?ht:ut,t.minFilter=t.magFilter=ie,t}function Ft(o,t){const e=o.shadow;if(e.map&&e.map.depthTexture===t)return!1;t.renderTarget&&t.renderTarget!==e.map&&(t.renderTarget.depthTexture=null),e.map&&e.map.dispose();const a=new Oe(e.mapSize.x,e.mapSize.y,{minFilter:Ce,magFilter:Ce,depthTexture:t});return a.texture.name=`${o.name}.shadowMap`,e.map=a,e.needsUpdate=!0,!0}function Ht(o,t=o.length){for(let e=0;e<t;e++)O[e]=o[e];for(let e=t;e<O.length;e++)O[e]=void 0;O.length=t}function It(o,t=o.length){const e=Math.min(t,4);for(let a=0;a<e;a++)ne[a].copy(o[a]);for(let a=e;a<4;a++)ne[a].set(0,0,0,0)}function Pe(o,t){return!!(o.isMeshStandardMaterial||o.isMeshLambertMaterial||o.isMeshPhongMaterial||o.isMeshToonMaterial||o.isShadowMaterial||o.isShaderMaterial&&o.lights===!0&&o.uniforms&&o.uniforms[H]&&(!t||o.uniforms[re]))}function Ee(o,t){if(!o||!Pe(o,!1))return!1;const e=t==="pcss"&&V===!0&&Pe(o,!0),a=t==="fast"&&U===!0,s=o.defines,i=!!(s&&se in s),n=!!(s&&oe in s);return a===i&&e===n?!1:(i&&!a&&delete s[se],n&&!e&&delete s[oe],a&&!i&&((o.defines||(o.defines={}))[se]=""),e&&!n&&((o.defines||(o.defines={}))[oe]=""),o.needsUpdate=!0,!0)}const F={kernel:"pcf",n:0};function Ot(o){const t=o.material;if(t)if(Array.isArray(t))for(let e=0;e<t.length;e++)Ee(t[e],F.kernel)&&F.n++;else Ee(t,F.kernel)&&F.n++}function Le(o,t){return F.kernel=t,F.n=0,o&&o.traverse(Ot),F.n}const y=Math.PI/180,Re=8,ke={dawn:7.25,morning:9.5,noon:13,afternoon:15.5,golden:17.55,sunset:18.45,dusk:18.95,night:22},Nt=We(),Ue={rise:7.15,set:18.6,maxElevation:46,nightDepth:35,nightRate:13,azimuthStart:102,azimuthSpan:156};function $t(o,t=Ue){const e=t.rise,a=t.set,s=t.maxElevation*y,i=(o-e)/(a-e);let n;i>=0&&i<=1?n=s*Math.sin(Math.PI*i):n=-Math.min(t.nightDepth*y,(i>1?o-a:e-o<0?e-o+24:e-o)*t.nightRate*y);const r=(t.azimuthStart+t.azimuthSpan*P(i,-.15,1.15))*y;return{el:n,az:r}}function Wt(o,t){let e=o.r*t/.6,a=o.g*t/.6,s=o.b*t/.6;const i=.59719*e+.35458*a+.04823*s,n=.076*e+.90834*a+.01566*s,r=.0284*e+.13383*a+.83777*s,c=d=>(d*(d+.0245786)-90537e-9)/(d*(.983729*d+.432951)+.238081),l=c(i),h=c(n),u=c(r);return new x(P(1.60475*l-.53108*h-.07367*u,0,1),P(-.10208*l+1.10813*h-.00605*u,0,1),P(-.00327*l-.07276*h+1.07602*u,0,1))}const Gt=[{el:-40,turb:2.4,ray:1.4,mie:.003,g:.78,tw:1,night:1,glowA:0,sun:1,env:.85,hemi:.2,haze:18e-5,mist:8e-5,cover:.36,cirrus:.22,cop:.8,cs:[.012,.014,.02],ca:[.032,.023,.019],aur:0},{el:-12,turb:2.4,ray:1.4,mie:.003,g:.78,tw:1,night:1,glowA:.05,sun:1,env:.85,hemi:.2,haze:18e-5,mist:8e-5,cover:.36,cirrus:.22,cop:.8,cs:[.014,.015,.022],ca:[.032,.024,.021],aur:0},{el:-6,turb:2.6,ray:1.6,mie:.003,g:.78,tw:1,night:.3,glowA:.55,sun:1,env:1.1,hemi:.26,haze:17e-5,mist:1e-4,cover:.34,cirrus:.26,cop:.8,cs:[.09,.045,.055],ca:[.026,.026,.038],aur:0},{el:-3,turb:3,ray:2,mie:.0035,g:.8,tw:1,night:0,glowA:1,sun:1,env:1.2,hemi:.28,haze:17e-5,mist:12e-5,cover:.33,cirrus:.3,cop:.85,cs:[.36,.13,.1],ca:[.04,.036,.052],aur:0},{el:0,turb:3.2,ray:2.3,mie:.004,g:.8,tw:.55,night:0,glowA:.9,sun:1,env:1.05,hemi:.26,haze:12e-5,mist:13e-5,cover:.32,cirrus:.32,cop:.85,cs:[.65,.26,.13],ca:[.065,.055,.065],aur:.5},{el:3,turb:3,ray:2.2,mie:.0038,g:.8,tw:.12,night:0,glowA:.4,sun:1,env:.95,hemi:.24,haze:12e-5,mist:11e-5,cover:.32,cirrus:.32,cop:.85,cs:[.9,.45,.24],ca:[.1,.095,.11],aur:.55},{el:9,turb:2.3,ray:1.75,mie:.0033,g:.8,tw:0,night:0,glowA:0,sun:1,env:.9,hemi:.22,haze:11e-5,mist:8e-5,cover:.3,cirrus:.3,cop:.85,cs:[1.05,.75,.5],ca:[.15,.16,.19],aur:.5},{el:18,turb:2.2,ray:1.6,mie:.0031,g:.79,tw:0,night:0,glowA:0,sun:1,env:.88,hemi:.2,haze:1e-4,mist:5e-5,cover:.28,cirrus:.3,cop:.85,cs:[1.2,1.08,.95],ca:[.21,.23,.28],aur:.4},{el:32,turb:2.1,ray:1.5,mie:.0029,g:.78,tw:0,night:0,glowA:0,sun:1,env:.86,hemi:.18,haze:8e-5,mist:4e-5,cover:.26,cirrus:.28,cop:.85,cs:[1.3,1.25,1.18],ca:[.25,.28,.33],aur:.3},{el:50,turb:2,ray:1.4,mie:.0027,g:.78,tw:0,night:0,glowA:0,sun:1,env:.85,hemi:.18,haze:8e-5,mist:3e-5,cover:.25,cirrus:.25,cop:.85,cs:[1.35,1.32,1.28],ca:[.27,.3,.36],aur:.3},{el:90,turb:1.95,ray:1.35,mie:.0026,g:.78,tw:0,night:0,glowA:0,sun:1,env:.83,hemi:.17,haze:7e-5,mist:25e-6,cover:.25,cirrus:.24,cop:.85,cs:[1.4,1.37,1.33],ca:[.28,.31,.37],aur:.25}];function Fe(o,t){let e=0;for(;e<o.length-2&&t>o[e+1].el;)e++;const a=o[e],s=o[e+1],i=P((t-a.el)/(s.el-a.el),0,1),n=i*i*(3-2*i),r={};for(const c in a)c!=="el"&&(r[c]=Array.isArray(a[c])?a[c].map((l,h)=>l+(s[c][h]-l)*n):a[c]+(s[c]-a[c])*n);return r}function Bt(o){const t=Math.max(o/y,-1),e=1/(Math.sin(Math.max(t,0)*y)+.50572*Math.pow(t+6.07995,-1.6364)),s=[.045,.085,.19].map(n=>Math.exp(-e*n)),i=Math.max(...s);return{color:new x(s[0]/i,s[1]/i,s[2]/i),trans:i}}const Ut=`
uniform float skyGain;
uniform float uDisc, uDiscCos;
uniform vec3 uGlowCol;
uniform float uTwilight, uNight, uAfterglow;
uniform vec3 uTwZen, uTwHor, uTwGlow, uNightZen, uNightHor, uPollution;
uniform float uClouds, uCover, uCirrus, uCloudOpacity, uCloudScale, uCloudH;
uniform vec2 uCloudOffset;
uniform sampler2D tCloud;
uniform vec3 uCloudSun, uCloudAmb;
uniform float uStars, uTime;
uniform vec3 uMoonDir, uMoonCol;
uniform vec3 uHorizonTint;
uniform float uSkySat;
uniform float uCloudStyle, uEnvWarm;
uniform vec3 uEnvWarmCol;
float rsHash13( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
vec3 rsHash33( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.xxy + p.yxx ) * p.zyx ); }
float rsCloud( vec2 uv ) { return texture2D( tCloud, uv ).r * 0.65 + texture2D( tCloud, uv * 2.9 + vec2( 0.37, 0.71 ) ).r * 0.35; }
// 'lit' style: three octaves (the third from the detail channel) on a domain-warped position
vec2 rsWarp( vec2 uv ) { return uv + ( vec2( texture2D( tCloud, uv * 0.43 + vec2( 0.11, 0.29 ) ).r, texture2D( tCloud, uv * 0.43 + vec2( 0.53, 0.07 ) ).r ) - 0.5 ) * 0.1; }
float rsCloud3( vec2 q ) { return rsCloud( q ) + ( texture2D( tCloud, q * 7.3 + vec2( 0.19, 0.83 ) ).b - 0.5 ) * 0.14; }
`,Vt=`
	vec3 col = retColor * skyGain;
	col = max( mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, uSkySat ), 0.0 ); // Preetham is pale
	float rsCs = max( cosTheta, 0.0 );
	{ // Preetham's horizon is milky: cool it to a blue-grey away from the sun (the sun side stays warm)
		float toSun = dot( normalize( direction.xz + vec2( 1e-5 ) ), normalize( vSunDirection.xz + vec2( 1e-5 ) ) ) * 0.5 + 0.5;
		float hz = exp( -max( direction.y, 0.0 ) * 9.0 );
		col *= mix( vec3( 1.0 ), uHorizonTint, hz * ( 1.0 - toSun * toSun * toSun ) );
	}
	col += uGlowCol * uDisc * ( 0.35 * pow( rsCs, 900.0 ) + 0.05 * pow( rsCs, 48.0 ) );
	// blue hour / night: replaces the Preetham model once the sun is below the horizon
	if ( uTwilight > 0.0 ) {
		float h = max( direction.y, 0.0 );
		vec2 sd = normalize( vSunDirection.xz + vec2( 1e-5 ) );
		vec2 dd = normalize( direction.xz + vec2( 1e-5 ) );
		// clamped: normalize() can leave |dot| a hair above 1, and pow( negative, y ) is NaN (ANGLE/Metal), which
		// PMREM would smear over the whole environment map (black PBR surfaces at some twilight hours)
		float towards = clamp( dot( dd, sd ) * 0.5 + 0.5, 0.0, 1.0 );
		vec3 tw = mix( uTwHor, uTwZen, pow( h, 0.5 ) );
		tw += uTwGlow * uAfterglow * exp( -h * 7.0 ) * pow( towards, 2.5 );
		tw += uTwGlow * vec3( 0.25, 0.45, 0.9 ) * uAfterglow * 0.35 * exp( -abs( h - 0.1 ) * 12.0 ) * pow( 1.0 - towards, 2.0 ); // belt of Venus
		vec3 ng = mix( uNightHor, uNightZen, pow( h, 0.4 ) ) + uPollution * exp( -h * 6.0 );
		tw = mix( tw, ng, uNight );
		col = mix( col, tw, uTwilight );
	}
	// stars + moon (night)
	if ( uStars > 0.0 && direction.y > 0.0 ) {
		vec3 q = direction * 360.0;
		vec3 id = floor( q );
		float hs = rsHash13( id );
		if ( hs > 0.982 ) {
			vec3 o = rsHash33( id + 7.0 );
			float d = length( fract( q ) - ( 0.25 + 0.5 * o ) );
			float b = ( hs - 0.982 ) / 0.018; b = b * b * b;
			float tw = 0.7 + 0.3 * sin( uTime * ( 1.3 + 3.0 * o.x ) + hs * 91.0 );
			col += mix( vec3( 1.0, 0.85, 0.7 ), vec3( 0.75, 0.85, 1.0 ), o.y ) * smoothstep( 0.24, 0.0, d ) * ( 0.06 + 1.6 * b ) * tw * uStars * smoothstep( 0.04, 0.35, direction.y );
		}
	}
	if ( uStars > 0.0 ) {
		float cm = dot( direction, uMoonDir );
		if ( cm > 0.9995 ) {
			vec3 mx = normalize( cross( uMoonDir, vec3( 0.0, 1.0, 0.0 ) ) );
			vec3 my = cross( mx, uMoonDir );
			vec2 p = vec2( dot( direction, mx ), dot( direction, my ) ) / 0.0105;
			float disc = smoothstep( 1.0, 0.93, length( p ) );
			vec3 n = vec3( p, sqrt( max( 0.0, 1.0 - dot( p, p ) ) ) );
			float lit = smoothstep( -0.2, 0.3, dot( n, normalize( vec3( 0.6, 0.2, 0.75 ) ) ) );
			float maria = texture2D( tCloud, p * 0.16 + 0.37 ).b;
			col = mix( col, col * 0.4 + uMoonCol * ( 0.55 + 0.5 * maria ) * ( 0.06 + 0.94 * lit ), disc * uStars );
		}
		float cm2 = max( cm, 0.0 );
		col += uMoonCol * uStars * ( 0.006 * pow( cm2, 1500.0 ) + 0.0025 * pow( cm2, 90.0 ) );
	}
	// clouds: cumulus layer at uCloudH + streaky cirrus at 2.6x, lit by the sun colour, fading into the horizon
	if ( uClouds > 0.0 && direction.y > 0.0 ) {
		float dy = max( direction.y, 0.012 );
		float t = max( uCloudH - cameraPosition.y, 60.0 ) / dy;
		vec2 uv = ( cameraPosition.xz + direction.xz * t ) * uCloudScale + uCloudOffset;
		float thr = 1.0 - uCover;
		vec2 sdir = normalize( vSunDirection.xz + vec2( 1e-4 ) ) * 0.012;
		float fwd = pow( rsCs, 5.0 );
		float d;
		vec3 cc;
		if ( uCloudStyle < 0.5 ) {
			float n = rsCloud( uv ) + ( texture2D( tCloud, uv * 9.0 ).b - 0.5 ) * 0.12;
			d = smoothstep( thr, thr + 0.2, n );
			float dS = smoothstep( thr, thr + 0.2, rsCloud( uv + sdir ) );
			float lit = clamp( 1.0 - 0.7 * dS + 0.2 * ( 1.0 - d ), 0.0, 1.0 );
			cc = uCloudAmb * ( 0.7 + 0.3 * ( 1.0 - d ) ) + uCloudSun * lit * ( 0.45 + 1.5 * fwd * ( 1.0 - 0.6 * d ) );
		} else {
			// soft deck lit by its relief: density falling toward the sun is a face the sun reaches (self-shadowing
			// from the density gradient), warm raking light on it, a cool shaded body, a bright rim on the thin edges
			// toward the sun, and never darker than a shade of the sky behind (no dark blobs against a bright sky)
			vec2 q = rsWarp( uv );
			float n = rsCloud3( q );
			d = smoothstep( thr - 0.04, thr + 0.24, n );
			float thick = smoothstep( thr + 0.08, thr + 0.45, n );
			float relief = clamp( ( n - rsCloud3( q + sdir * 1.4 ) ) * 6.0 + 0.5, 0.0, 1.0 );
			float toSun = clamp( dot( normalize( direction.xz + vec2( 1e-5 ) ), normalize( vSunDirection.xz + vec2( 1e-5 ) ) ) * 0.5 + 0.5, 0.0, 1.0 );
			float low = 1.0 - smoothstep( 0.05, 0.5, vSunDirection.y ); // 1 at a low sun: raking light, rims
			vec3 shade = uCloudAmb * ( 0.55 + 0.9 * relief * relief ) * ( 1.0 - 0.35 * thick );
			shade = max( shade, col * vec3( 0.78, 0.8, 0.9 ) * ( 1.0 - 0.3 * thick ) );
			float rake = mix( 0.6, 0.08 + 2.0 * relief * relief * relief, low ) * ( 1.0 - 0.45 * thick );
			cc = shade + uCloudSun * rake * ( 0.5 + 1.4 * fwd + 0.6 * low * pow( toSun, 3.0 ) );
			cc += uCloudSun * d * ( 1.0 - d ) * 4.0 * pow( toSun, 4.0 ) * ( 0.25 + 0.6 * low );
		}
		float t2 = max( uCloudH * 2.6 - cameraPosition.y, 60.0 ) / dy;
		vec2 w2 = cameraPosition.xz + direction.xz * t2;
		vec2 uv2 = vec2( w2.x * 0.8 + w2.y * 0.6, -w2.x * 0.6 + w2.y * 0.8 ) * uCloudScale * vec2( 0.45, 1.5 ) + uCloudOffset * 1.7;
		float ci = smoothstep( 0.5, 0.95, texture2D( tCloud, uv2 ).g * 0.8 + texture2D( tCloud, uv2 * 3.1 + 0.3 ).g * 0.2 );
		ci *= smoothstep( 0.35, 0.75, texture2D( tCloud, uv2 * 0.21 + vec2( 0.5, 0.2 ) ).r ) * uCirrus; // patchy, not uniform streaks
		vec3 cic = uCloudAmb * 0.9 + uCloudSun * ( 0.8 + 2.2 * fwd );
		float fade = smoothstep( 0.0, 0.05, direction.y );
		float a1 = d * uCloudOpacity * fade;
		float a2 = ci * 0.5 * fade;
		vec3 sky0 = col;
		col = mix( col, mix( cic, sky0, ( 1.0 - exp( -t2 * 0.00002 ) ) * 0.8 ), a2 );
		col = mix( col, mix( cc, sky0, 1.0 - exp( -t * 0.00004 ) ), a1 );
	}
	if ( uEnvWarm > 0.0 ) { // environment capture only (lowSunEnv): a warmer, brighter sky toward a low sun
		float ts = clamp( dot( normalize( direction.xz + vec2( 1e-5 ) ), normalize( vSunDirection.xz + vec2( 1e-5 ) ) ) * 0.5 + 0.5, 0.0, 1.0 );
		col += uEnvWarmCol * uEnvWarm * pow( ts, 3.0 ) * exp( -abs( direction.y ) * 4.0 );
	}
	gl_FragColor = vec4( col, 1.0 );`;function Kt(o){return{skyGain:{value:.6},uDisc:{value:1},uDiscCos:{value:Math.cos(.0075)},uGlowCol:{value:new x(0,0,0)},uTwilight:{value:0},uNight:{value:0},uAfterglow:{value:0},uTwZen:{value:new x(.018,.04,.115)},uTwHor:{value:new x(.1,.11,.15)},uTwGlow:{value:new x(.75,.28,.07)},uNightZen:{value:new x(.0035,.0075,.024)},uNightHor:{value:new x(.012,.015,.026)},uPollution:{value:new x(.036,.027,.024)},uClouds:{value:1},uCover:{value:.3},uCirrus:{value:.4},uCloudOpacity:{value:.85},uCloudScale:{value:1/14e3},uCloudH:{value:1700},uCloudOffset:{value:new K(.13,.41)},tCloud:{value:o},uCloudSun:{value:new x(1,1,1)},uCloudAmb:{value:new x(.3,.3,.35)},uStars:{value:0},uTime:{value:0},uHorizonTint:{value:new x(.8,.93,1.15)},uSkySat:{value:1.3},uCloudStyle:{value:0},uEnvWarm:{value:0},uEnvWarmCol:{value:new x(0,0,0)},uMoonDir:{value:new M(0,1,0)},uMoonCol:{value:new x(1.6,1.55,1.45)}}}function He(o,t){const e=o.material;Object.assign(e.uniforms,Kt(t));let a=e.fragmentShader;const s=["uniform vec3 up;","float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );","gl_FragColor = vec4( retColor, 1.0 );"];for(const i of s)a.includes(i)||console.warn("[sky] Sky shader patch point missing:",i);return a=a.replace("uniform vec3 up;",`uniform vec3 up;
`+Ut).replace(s[1],"float sundisk = uDisc * smoothstep( uDiscCos, uDiscCos + 0.00002, cosTheta );").replace(s[2],Vt),e.fragmentShader=a,e.needsUpdate=!0,o}const jt=[["glow",380,0,[1,.92,.8],.25],["dot",46,.32,[1,.75,.45],.16],["hex",74,.52,[.55,.85,1],.1],["hex",118,.7,[1,.7,.4],.075],["ring",300,.92,[1,1,1],.07],["hex",170,1.12,[.55,1,.7],.055],["dot",90,1.38,[.75,.6,1],.07]],qt={intensity:1.7,warm:.5,below:20},Xt={intensity:1.1,elevation:5,color:[1,.56,.34],fadeIn:-.5,fadeOut:-9,scatter:.03},Yt={cascades:2,near:45,far:[260,420,650],farUp:[70,200],farDown:[50,160],mid:null,single:130,nearMapSize:2048,midMapSize:2048,farMapSize:4096,singleMapSize:4096,nearRadius:2,midRadius:1.7,farRadius:1.4,lead:.45,farLead:.55,farMaxY:40,farInterval:2,kernel:"pcf",lightSize:.5,maxPenumbra:24,temporalNoise:!1,skipUnlit:!1};class ha{constructor(t={},e,a){const s=!!(t&&t.isScene),i=s?{...a||{},scene:t,renderer:e}:t;this.scene=i.scene,this.renderer=i.renderer,this.timePresets=i.timePresets||ke,this.sunModel={...Ue,...i.sun||{}},this.looks=i.looks||Gt;const n=this.shadowOpts={...Yt,...i.shadows||{}};i.shadowNearHalf!=null&&(n.near=i.shadowNearHalf);const r=Math.max(1,Math.min(we,Math.floor(Number(n.cascades))||1));this.cascaded=r>1&&Nt,this.cascadeCount=this.cascaded?r>2&&We(r)?r:2:1,n.skipUnlit&&At(),this.cascadeLights=[],this.shadowKernel="pcf";const c=i.timeOfDay??"golden";this.hours=typeof c=="number"?c:this.timePresets[c]??this.timePresets.golden??ke.golden,this.skyGain=i.skyGain??.38,this.skyRadius=i.skyRadius??4e3,this.sunIntensity=i.sunIntensity??3.9,this.moonIntensity=i.moonIntensity??.3,this.moonScatter=Math.max(0,+i.moonScatter||0),this.moonColor=new x(...i.moonColor||[.62,.72,1]),this.fogDensity=i.fogDensity??[3e-4,15e-5],this.flareSpec=i.flare===!1?null:i.flare||jt,this.twilightKey=i.twilightKey?{...Xt,...i.twilightKey===!0?{}:i.twilightKey}:null,this.twilightKeyAmount=0,this.cloudStyle=i.cloudStyle==="lit"?"lit":"classic",this.lowSunEnv=i.lowSunEnv?{...qt,...i.lowSunEnv===!0?{}:i.lowSunEnv}:null,this.nearHalf=n.near,this.farHalfSteps=Array.isArray(n.far)?n.far.slice():[n.far],this.shadowHalf=this.nearHalf,this.sunDir=new M(0,1,0),this.lightDir=new M(0,1,0);const l=i.moon||{azimuth:150,elevation:34};this.moonDir=new M,this.moonDir.set(Math.sin(l.azimuth*y)*Math.cos(l.elevation*y),Math.sin(l.elevation*y),-Math.cos(l.azimuth*y)*Math.cos(l.elevation*y)).normalize(),this.darkness=0,this.windowGlow=0,this.maxBuildingHeight=i.maxCasterHeight??200,this.version=0,this.fogMode="scene",this.camera=i.camera||null,this.sunColor=new x(1,1,1),this.scatterDir=this.moonScatter>0?new M(0,1,0):this.sunDir,this.scatterColor=this.moonScatter>0?new x(1,1,1):this.sunColor,this.fogParams={haze:2e-4,hazeK:1/700,hazeBase:0,mist:1e-4,mistK:1/40,sunScatter:0},this.look=Fe(this.looks,10),this.cloudWind=new K(...i.cloudWind||[6.5,2.2]),this._frame=0,this._farHalf=this.farHalfSteps[0],this._farDirty=!0,this._lastT=0,this._clock=0,this._fastDepth=null,this._fastMaps=null,this._onChildAdded=null,this._pcss=null,this._noiseFrame=0,this.flareScale=1,(i.build??!s)&&this.build()}get maxCasterHeight(){return this.maxBuildingHeight}set maxCasterHeight(t){this.maxBuildingHeight=t}build(){const{scene:t,renderer:e}=this,a=this.shadowOpts;this.cloudAtlas=Ct(512);const s=this.cloudAtlas.texture;this.sky=He(new j,s),this.sky.scale.setScalar(this.skyRadius),this.sky.frustumCulled=!1,this.sky.renderOrder=-1,this.sky.name="sky",this.sky.material.uniforms.uStars.value=0,t.add(this.sky);const i=e?.capabilities?.maxTextureSize||4096;this.sun=new Me(16777215,3),this.sun.name="sun",this.sun.castShadow=!0;const n=this.cascaded?Math.min(a.nearMapSize,i):Math.min(a.singleMapSize,i);if(this.cascaded||(this.nearHalf=a.single),this.sun.shadow.mapSize.set(n,n),this._setBox(this.sun,this.nearHalf),this.sun.shadow.radius=a.nearRadius,t.add(this.sun,this.sun.target),this.cascadeLights.length=0,this.cascadeLights.push(this.sun),this.cascaded){const r=this.cascadeCount,c=Math.min(a.farMapSize,i),l=Math.min(a.midMapSize,i);this.midHalfSteps=this._midHalfSteps(n,l,c);for(let h=1;h<r-1;h++){const u=h===1?"sunMid":"sunMid2",d=this[u]=this._cascadeLight(`${u}Cascade`,l,this.midHalfSteps[h-1][0],a.midRadius);t.add(d,d.target),this.cascadeLights.push(d)}this.sunFar=this._cascadeLight("sunFarCascade",c,this._farHalf,a.farRadius),t.add(this.sunFar,this.sunFar.target),this.cascadeLights.push(this.sunFar)}return this.cascaded&&this._checkShadowOrder(),this.hemi=new dt(12571903,4866102,.3),t.add(this.hemi),this.fog=new ce(12634320,42e-5),this.fogPost=new ce(8425632,0),t.fog=this.fogMode==="scene"?this.fog:this.fogPost,this.pmrem=e?new Ke(e):null,this.envScene=new be,this.envSky=He(new j,s),this.envSky.scale.setScalar(500),this.envScene.add(this.envSky),this.skyCubeRT=new ft(32,{type:pt,generateMipmaps:!1,minFilter:ie,magFilter:ie}),this.skyCubeRT.texture.name="skyCube",this.cubeCam=new mt(.1,1e3,this.skyCubeRT),this.envScene.add(this.cubeCam),this.flareSpec&&e&&typeof document<"u"&&this._buildFlare(),a.kernel&&a.kernel!=="pcf"&&this.setShadowKernel(a.kernel),this.setTime(this.hours),this}get skyCube(){return this.skyCubeRT?this.skyCubeRT.texture:null}get fogColor(){return this.fogMode==="scene"?this.fog?this.fog.color:null:this.fogPost?this.fogPost.color:null}setFogMode(t){this.fogMode=t==="post"?"post":"scene",this.fogPost||(this.fogPost=new ce(8425632,0)),this.horizon&&this.fogPost.color.copy(this.horizon),this.scene&&(this.scene.fog=this.fogMode==="scene"?this.fog:this.fogPost)}setShadowKernel(t,e=this.scene){if(!Pt.includes(t))return console.warn(`[Atmosphere] unknown shadow kernel '${t}' ('pcf' | 'fast' | 'pcss')`),0;t!=="pcf"&&!this._fastShadowsOk(t)&&(t="pcf"),this.shadowKernel=t;const a=this.scene;return t!=="pcf"?(this._syncFastShadows(),t==="pcss"&&this._syncPcss(),!this._onChildAdded&&a&&(this._onChildAdded=s=>{const i=this._foreignShadowLight(s.child);if(i===null){Le(s.child,this.shadowKernel);return}console.warn(`[Atmosphere] ${this.shadowKernel} shadow kernel unavailable (another shadow-casting directional light '${i}' was added), using 'pcf'`),this.setShadowKernel("pcf")},a.addEventListener("childadded",this._onChildAdded))):this._onChildAdded&&(a.removeEventListener("childadded",this._onChildAdded),this._onChildAdded=null),Le(e,t)}_fastShadowsOk(t="fast"){const e=this.renderer;let a="";if(!e)a="no renderer";else if(!this.sun)a="not built yet";else if(e.shadowMap.type!==_e)a="it replaces PCFShadowMap only";else if(!(t==="pcss"?Rt():Lt()))a="three.js shadow chunks changed";else if(t==="pcss"&&2*this.cascadeCount>=(e.capabilities?.maxTextures??16)-Re)a=`${2*this.cascadeCount} shadow texture units leave ${Re} or fewer of ${e.capabilities?.maxTextures??16} for materials`;else{const s=this._foreignShadowLight(this.scene);s!==null&&(a=`another shadow-casting directional light '${s}'`)}return a&&console.warn(`[Atmosphere] ${t} shadow kernel unavailable (${a}), using 'pcf'`),!a}_foreignShadowLight(t){let e=null;const a=this.cascadeLights;return t.traverse(s=>{e===null&&s.isDirectionalLight&&s.castShadow&&!a.includes(s)&&(e=s.name||"(unnamed)")}),e}_checkShadowOrder(){let t=null;return this.scene.traverse(e=>{t===null&&e.isDirectionalLight&&e.castShadow&&(t=e)}),t&&t!==this.sun&&console.warn(`[Atmosphere] shadow-casting directional light '${t.name||"(unnamed)"}' precedes the sun in the scene: the shadow cascades will not be used (add it after the Atmosphere or turn its castShadow off)`),t===this.sun}_syncFastShadows(){if(this.renderer.shadowMap.type!==_e)return;const t=this.cascadeLights;if(!this._fastDepth){const a=this.renderer.state?.buffers?.depth?.getReversed?.()===!0;this._fastDepth=t.map(s=>{const i=kt(a);return i.name=`${s.name}.shadowDepth`,i}),this._fastMaps=t.map(()=>null)}let e=0;for(let a=0;a<t.length;a++){const s=t[a];s.castShadow&&(Ft(s,this._fastDepth[a]),this._fastMaps[e++]=this._fastDepth[a])}Ht(this._fastMaps,e)}_syncPcss(){const t=this.shadowOpts,e=this.cascadeLights,a=this._pcss||(this._pcss=e.map(()=>new me)),s=Math.tan(Math.max(0,t.lightSize)*y),i=t.maxPenumbra*(2*this.sun.userData.half/this.sun.shadow.mapSize.x),n=t.temporalNoise?this._noiseFrame:0;let r=0;for(let c=0;c<e.length;c++){const l=e[c];if(!l.castShadow)continue;const h=l.shadow.camera,u=2*l.userData.half/l.shadow.mapSize.x,d=h.far-h.near;a[r++].set(d*s/u,.5*Math.min(t.maxPenumbra,i/u),8*u/d,n)}It(a,r)}shadowCascadeInfo(t={count:0,lights:[],cameras:[],matrices:[],halfSizes:[],maps:[],depthTextures:[],packed:!0}){const e=this.cascadeLights,a=t.lights,s=t.cameras,i=t.matrices,n=t.halfSizes,r=t.maps||(t.maps=[]),c=t.depthTextures;let l=0,h=!1;for(let u=0;u<e.length;u++){const d=e[u],w=d.shadow;if(!d.castShadow)continue;const p=w.map?w.map.texture:null,g=w.map&&w.map.depthTexture?w.map.depthTexture:null;a[l]=d,s[l]=w.camera,i[l]=w.matrix,n[l]=d.userData.half,r[l]=p,c[l]=g||p,g||(h=!0),l++}return a.length=s.length=i.length=n.length=r.length=c.length=l,t.count=l,t.packed=h,t}_cascadeLight(t,e,a,s){const i=new Me(0,0);return i.name=t,i.castShadow=!0,i.shadow.mapSize.set(e,e),this._setBox(i,a),i.shadow.radius=s,i.shadow.autoUpdate=!1,i.shadow.needsUpdate=!0,i}_midHalfSteps(t,e,a){const s=this.shadowOpts,i=this.cascadeCount,n=[],r=s.mid==null?null:Array.isArray(s.mid)?s.mid:[s.mid],c=2*this.nearHalf/t;for(let l=1;l<i-1;l++){const h=r?r[l-1]:null,u=l===1?null:n[l-2];n.push(this.farHalfSteps.map((d,w)=>{if(h!=null)return Array.isArray(h)?h[Math.min(w,h.length-1)]:h;const p=c*Math.pow(2*d/a/c,l/(i-1)),g=u?u[w]:this.nearHalf,m=u?s.farLead:s.lead,v=Math.max(1.25*g,g*(1-m)/Math.max(.05,1-s.farLead)+2);return Math.round(Math.min(Math.max(p*e/2,v),.8*d)/5)*5}))}return n}_setMidBoxes(t){const e=this.cascadeLights;for(let a=1;a<e.length-1;a++){const s=this.midHalfSteps[a-1],i=s[Math.min(t,s.length-1)];e[a].userData.half!==i&&this._setBox(e[a],i)}}_setBox(t,e){const a=t.shadow.camera;Object.assign(a,{left:-e,right:e,top:e,bottom:-e,near:1,far:2500}),a.updateProjectionMatrix(),t.userData.half=e;const s=2*e/t.shadow.mapSize.x;t.shadow.normalBias=s*1.4,t.shadow.bias=-3e-5}_buildFlare(){const t=Mt();this._flareTex=t,this.flare=new q,this.flare.frustumCulled=!1,this.flareEls=this.flareSpec.map(([e,a,s,i,n])=>{const r=new ve(typeof e=="string"?t[e]:e,a,s,new x(i[0]*n,i[1]*n,i[2]*n));return r.baseSize=a,r.base=new x(i[0]*n,i[1]*n,i[2]*n),this.flare.addElement(r),r}),this.flareScene=new be,this.flareScene.name="flare",this.flareScene.add(this.flare),this.flare.visible=!1}renderFlare(t,e){if(!this.flare||!this.flare.visible)return;const a=t.autoClear;t.autoClear=!1,t.setRenderTarget(null),t.render(this.flareScene,e),t.autoClear=a}setFlareScale(t){this.flareScale=P(t/1300,.3,3);for(const e of this.flareEls||[])e.size=e.baseSize*this.flareScale}setTimeOfDay(t){const e=typeof t=="number"?t:this.timePresets[t];return Number.isFinite(e)&&this.setTime(e),this}get timeOfDay(){return this.hours}setTime(t){this.hours=(t%24+24)%24;const{el:e,az:a}=$t(this.hours,this.sunModel);this.sunEl=e;const s=e/y,i=new M(Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)).normalize();this.sunDir.copy(i),this.darkness=E(6*y,-9*y,e),this.windowGlow=P(Math.pow(E(14*y,-6*y,e),1.5),.02,1);const n=this.look=Fe(this.looks,s),r=E(-2*y,3*y,e),c=Bt(e);this.sunColor.copy(c.color);const l=this.moonColor;this.lightDir.copy(r>.02?i:this.moonDir),this.sun.color.copy(r>.02?c.color:l),this.sun.intensity=r>.02?this.sunIntensity*r*Math.pow(c.trans,.8)*n.sun:this.moonIntensity;const h=this.twilightKey;if(this.twilightKeyAmount=0,h){const z=E(h.fadeOut*y,h.fadeIn*y,e)*(1-E(h.fadeIn*y,h.fadeIn*y+6*y,e)),S=h.intensity*z;if(S>this.sun.intensity&&S>.001){const A=Math.max(e,h.elevation*y);this.lightDir.set(Math.sin(a)*Math.cos(A),Math.sin(A),-Math.cos(a)*Math.cos(A)).normalize(),this.sun.color.setRGB(h.color[0],h.color[1],h.color[2]),this.sun.intensity=S,this.twilightKeyAmount=z}}const u=this.moonScatter>0&&!(r>.02);this.moonScatter>0&&(this.scatterDir.copy(u?this.moonDir:i),this.scatterColor.copy(u?l:c.color)),this._farDirty=!0;const d=this.sunColor.clone().multiplyScalar(n.aur*r);for(const z of[this.sky,this.envSky]){const S=z.material.uniforms;S.turbidity.value=n.turb,S.rayleigh.value=n.ray,S.mieCoefficient.value=n.mie,S.mieDirectionalG.value=n.g,S.sunPosition.value.copy(i),S.skyGain.value=this.skyGain,S.uGlowCol.value.copy(d),S.uTwilight.value=n.tw,S.uNight.value=n.night,S.uAfterglow.value=n.glowA,S.uCover.value=n.cover,S.uCirrus.value=n.cirrus,S.uCloudOpacity.value=n.cop,S.uCloudSun.value.setRGB(n.cs[0],n.cs[1],n.cs[2]),S.uCloudAmb.value.setRGB(n.ca[0],n.ca[1],n.ca[2]),S.uMoonDir.value.copy(this.moonDir),S.uHorizonTint.value.setRGB(.8,.93,1.15).lerp(Ie,n.tw),S.uCloudStyle.value=this.cloudStyle==="lit"?1:0}const w=this.lowSunEnv,p=w?E(w.below,2,s)*E(-8,-1,s):0,g=this.envSky.material.uniforms;g.uEnvWarm.value=w?w.warm*p:0,g.uEnvWarmCol.value.copy(this.sunColor).multiplyScalar(.5),this.sky.material.uniforms.uStars.value=n.night,this.envSky.material.uniforms.uStars.value=0,this.pmrem&&(this.envRT&&this.envRT.dispose(),this.envRT=this.pmrem.fromScene(this.envScene,0,.1,1e3),this.scene.environment=this.envRT.texture,this.scene.environmentIntensity=w?n.env+(Math.max(n.env,w.intensity)-n.env)*p:n.env);const m=this.envSky.material.uniforms,v=m.uEnvWarm.value;m.uDisc.value=0,m.uClouds.value=0,m.uEnvWarm.value=0,this.renderer&&this.cubeCam.update(this.renderer,this.envScene);const f=this.sampleHorizon();m.uDisc.value=1,m.uClouds.value=1,m.uEnvWarm.value=v,this.horizon=f;const b=(this.renderer&&this.renderer.toneMappingExposure)??1,C=this.renderer&&this.renderer.toneMapping===vt?new x(P(f.r*b,0,1),P(f.g*b,0,1),P(f.b*b,0,1)):Wt(f,b);this.fog.color.copy(C),this.fog.density=this.fogDensity[0]+this.fogDensity[1]*this.darkness,this.fogPost.color.copy(f);const _=this.fogParams;_.haze=n.haze,_.mist=n.mist,_.sunScatter=u?this.moonScatter:.05*r*(1-E(25*y,45*y,e)),h&&!u&&(_.sunScatter=Math.max(_.sunScatter,h.scatter*this.twilightKeyAmount));const D=f.clone().multiplyScalar(1/Math.max(.03,Math.max(f.r,f.g,f.b)));this.hemi.color.copy(D).lerp(new x(.5,.66,1),.5+.3*this.darkness);const T=new x(.42,.37,.31).lerp(this.sunColor,.45*r);this.hemi.groundColor.copy(T).lerp(new x(.55,.36,.2),this.darkness*.8),this.hemi.intensity=n.hemi,this.flareEls&&this.flareEls.forEach((z,S)=>z.color.copy(z.base).multiply(S===0?this.sunColor:Ie)),this.version++}sampleHorizon(){const t=this.renderer,e=new x(.6,.65,.7);if(!t)return e;try{const s=new Oe(16,16,{type:wt,depthBuffer:!1}),i=new gt(60,1,.1,1e3),n=new Float32Array(256*4),r=t.getRenderTarget();let c=0,l=0,h=0,u=0;for(let d=0;d<8;d++){const w=d/8*Math.PI*2;i.position.set(0,0,0),i.lookAt(Math.cos(w),-.02,Math.sin(w)),t.setRenderTarget(s),t.render(this.envScene,i),t.readRenderTargetPixels(s,0,0,16,16,n);for(let p=0;p<256;p++){const g=n[p*4],m=n[p*4+1],v=n[p*4+2];isFinite(g)&&isFinite(m)&&isFinite(v)&&(c+=g,l+=m,h+=v,u++)}}t.setRenderTarget(r),s.dispose(),u&&e.setRGB(c/u,l/u,h/u)}catch(a){console.warn("[World] horizon sampling failed",a)}return e}cloudDensityToward(t,e){if(!this.cloudAtlas||e.y<=.01)return 0;const a=this.sky.material.uniforms,s=Math.max(a.uCloudH.value-t.y,60)/Math.max(e.y,.012),i=a.uCloudScale.value,n=a.uCloudOffset.value,r=(t.x+e.x*s)*i+n.x,c=(t.z+e.z*s)*i+n.y,l=ze(this.cloudAtlas,r,c)*.65+ze(this.cloudAtlas,r*2.9+.37,c*2.9+.71)*.35,h=1-a.uCover.value;return E(h,h+.2,l)*a.uCloudOpacity.value*E(0,.05,e.y)}update(t,e){if(!t)return;let a;Number.isFinite(e)?(e=Math.min(.1,Math.max(0,e)),this._clock+=e,a=this._clock*1e3):(a=performance.now(),e=this._lastT?Math.min(.1,(a-this._lastT)/1e3):0,this._lastT=a),this.sky.position.copy(t);const s=this.sky.material.uniforms;s.uTime.value=a/1e3%3600,s.uCloudOffset.value.addScaledVector(this.cloudWind,e*s.uCloudScale.value);let i=0,n=0;if(this.camera){this.camera.getWorldDirection(G);const l=Math.hypot(G.x,G.z);l>.001&&(i=G.x/l,n=G.z/l)}const r=this.shadowOpts,c=this.nearHalf;if(this._fitCascade(this.sun,t.x+i*c*r.lead,t.y,t.z+n*c*r.lead,c),this._frame++,this.sunFar){const l=this.farHalfSteps;let h=l.indexOf(this._farHalf);const u=r.farUp,d=r.farDown;h<l.length-1&&t.y>u[h]?h++:h>0&&t.y<d[h-1]&&h--,l[h]!==this._farHalf&&(this._farHalf=l[h],this._setBox(this.sunFar,this._farHalf),this._setMidBoxes(h),this._farDirty=!0);const w=this.cascadeLights,p=w.length,g=this._frame,m=this._farDirty,v=Math.min(t.y,r.farMaxY),f=r.farLead,b=Math.max(1,r.farInterval|0||2);let C=t.y,_=this.nearHalf,D=r.lead;for(let T=1;T<p;T++){const z=w[T],S=z.userData.half,A=S*f;let L=v;T<p-1&&(L=Math.max(v,C-Math.max(0,S*(1-f)-_*(1-D))),C=L,_=S,D=f);const X=t.x+i*A,Y=t.z+n*A;let k=m||(p===2?g%b===0:T===1?(g&1)===1:p===3?(g&1)===0:(g&3)===(T===2?0:2));(!k&&(p>2||b>2)?z.target.position.distanceToSquared(ta.set(X,L,Y)):0)>((p>2?.3:.1)*S)**2&&(k=!0),k&&(this._fitCascade(z,X,L,Y,S),z.shadow.needsUpdate=!0)}this._farDirty=!1}this.shadowKernel!=="pcf"&&(this._syncFastShadows(),this.shadowKernel==="pcss"&&(r.temporalNoise&&e>0&&(this._noiseFrame=this._noiseFrame+1&63),this._syncPcss())),this._updateFlare(t)}_fitCascade(t,e,a,s,i){const n=this.lightDir,r=2*i/t.shadow.mapSize.x,c=Zt.copy(n).negate(),l=Jt.crossVectors(c,Math.abs(c.y)>.99?sa:aa).normalize(),h=Qt.crossVectors(l,c).normalize();let u=e*l.x+a*l.y+s*l.z,d=e*h.x+a*h.y+s*h.z;const w=e*c.x+a*c.y+s*c.z;u=Math.round(u/r)*r,d=Math.round(d/r)*r;const p=ea.set(0,0,0).addScaledVector(l,u).addScaledVector(h,d).addScaledVector(c,w),g=Math.max(.05,Math.asin(P(n.y,-1,1))),m=P(this.maxBuildingHeight/Math.tan(g)+200,400,2200);t.target.position.copy(p),t.position.copy(p).addScaledVector(n,m);const v=t.shadow.camera,f=m+500+i;Math.abs(v.far-f)>50&&(v.far=f,v.updateProjectionMatrix()),t.target.updateMatrixWorld(),t.updateMatrixWorld()}_updateFlare(t){if(!this.flare)return;const e=E(-.8*y,1.5*y,this.sunEl);if(e<=.001){this.flare.visible=!1;return}this.flare.visible=!0,this.flare.position.copy(t).addScaledVector(this.sunDir,5e3),this.flare.updateMatrixWorld();const a=e*(1-.92*this.cloudDensityToward(t,this.sunDir)),s=this.flareEls;for(let i=0;i<s.length;i++){const n=s[i];n.color.copy(n.base).multiplyScalar(a),i===0&&n.color.multiply(this.sunColor)}}dispose(){const t=this.scene;for(const e of[this.sky,this.hemi])e&&t&&t.remove(e);for(const e of this.cascadeLights)t&&t.remove(e,e.target);t&&(t.fog===this.fog||t.fog===this.fogPost)&&(t.fog=null),t&&this._onChildAdded&&(t.removeEventListener("childadded",this._onChildAdded),this._onChildAdded=null),t&&this.envRT&&t.environment===this.envRT.texture&&(t.environment=null);for(const e of[this.sky,this.envSky])e&&e.material.dispose();for(const e of this.cascadeLights)e.dispose();if(this.envRT&&this.envRT.dispose(),this.skyCubeRT&&this.skyCubeRT.dispose(),this.pmrem&&this.pmrem.dispose(),this.cloudAtlas&&this.cloudAtlas.texture.dispose(),this._flareTex)for(const e of Object.values(this._flareTex))e.dispose()}}const Zt=new M,Jt=new M,Qt=new M,ea=new M,G=new M,ta=new M,aa=new M(0,1,0),sa=new M(1,0,0),Ie=new x(1,1,1);export{ha as A,Gt as D,se as F,we as M,oe as P,Pt as S,ke as T,jt as a,qt as b,Ue as c,Xt as d,ca as e,Tt as f,Le as g,Ft as h,zt as i,kt as j,We as k,Lt as l,Rt as m,At as n,ra as o,Ct as p,Mt as q,Ht as r,ze as s,Ee as t,It as u,la as v,$t as w};
