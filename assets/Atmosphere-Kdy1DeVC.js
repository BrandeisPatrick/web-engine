import{M as te,S as Ke,B as je,aZ as qe,w as Xe,V as M,e as Ye,bz as Se,bA as ce,A as Ze,l as K,C as y,bB as Je,k as me,a9 as ue,j as Qe,av as et,aK as ye,n as tt,R as st,o as at,p as ie,L as ot,N as it,d as nt,s as rt,u as $,a6 as Oe,ab as xe,a7 as ct,bC as lt,bD as ht,ac as Me,as as Ce,bs as dt,bE as le,b7 as ut,b6 as be,b9 as ft,a5 as pt,ba as mt,by as _e,bF as vt,aV as wt,aG as gt}from"./three.module-B_yomNYV.js";import{c as _,s as F}from"./noise-g5kHFeMn.js";class j extends te{constructor(){const t=j.SkyShader,e=new Ke({name:t.name,uniforms:qe.clone(t.uniforms),vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,side:je,depthWrite:!1});super(new Xe(1,1,1),e),this.isSky=!0}}j.SkyShader={name:"SkyShader",uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new M},up:{value:new M(0,1,0)}},vertexShader:`
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

		}`};class q extends te{constructor(){super(q.Geometry,new Ye({opacity:0,transparent:!0})),this.isLensflare=!0,this.type="Lensflare",this.frustumCulled=!1,this.renderOrder=1/0;const t=new M,e=new M,s=new Se(16,16),o=new Se(16,16);let i=ue;const n=q.Geometry,r=new ce({uniforms:{scale:{value:null},screenPosition:{value:null}},vertexShader:`

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

				}`,depthTest:!0,depthWrite:!1,transparent:!1}),l=new ce({uniforms:{map:{value:s},scale:{value:null},screenPosition:{value:null}},vertexShader:`

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

				}`,depthTest:!1,depthWrite:!1,transparent:!1}),c=new te(n,r),h=[],f=ve.Shader,d=new ce({name:f.name,uniforms:{map:{value:null},occlusionMap:{value:o},color:{value:new y(16777215)},scale:{value:new K},screenPosition:{value:new M}},vertexShader:f.vertexShader,fragmentShader:f.fragmentShader,blending:Ze,transparent:!0,depthWrite:!1}),p=new te(n,d);this.addElement=function(w){h.push(w)};const u=new K,S=new K,v=new Je,m=new me;this.onBeforeRender=function(w,C,g){w.getCurrentViewport(m);const D=w.getRenderTarget(),b=D!==null?D.texture.type:ue;i!==b&&(s.dispose(),o.dispose(),s.type=o.type=b,i=b);const T=m.w/m.z,L=m.z/2,P=m.w/2;let A=16/m.w;if(u.set(A*T,A),v.min.set(m.x,m.y),v.max.set(m.x+(m.z-16),m.y+(m.w-16)),e.setFromMatrixPosition(this.matrixWorld),e.applyMatrix4(g.matrixWorldInverse),!(e.z>0)&&(t.copy(e).applyMatrix4(g.projectionMatrix),S.x=m.x+t.x*L+L-8,S.y=m.y+t.y*P+P-8,v.containsPoint(S))){w.copyFramebufferToTexture(s,S);let z=r.uniforms;z.scale.value=u,z.screenPosition.value=t,w.renderBufferDirect(g,null,n,r,c,null),w.copyFramebufferToTexture(o,S),z=l.uniforms,z.scale.value=u,z.screenPosition.value=t,w.renderBufferDirect(g,null,n,l,c,null);const X=-t.x*2,Y=-t.y*2;for(let E=0,ge=h.length;E<ge;E++){const N=h[E],G=d.uniforms;G.color.value.copy(N.color),G.map.value=N.texture,G.screenPosition.value.x=t.x+X*N.distance,G.screenPosition.value.y=t.y+Y*N.distance,A=N.size/m.w;const Ve=m.w/m.z;G.scale.value.set(A*Ve,A),d.uniformsNeedUpdate=!0,w.renderBufferDirect(g,null,n,d,p,null)}}},this.dispose=function(){r.dispose(),l.dispose(),d.dispose(),s.dispose(),o.dispose();for(let w=0,C=h.length;w<C;w++)h[w].texture.dispose()}}}class ve{constructor(t,e=1,s=0,o=new y(16777215)){this.texture=t,this.size=e,this.distance=s,this.color=o}}ve.Shader={name:"LensflareElementShader",uniforms:{map:{value:null},occlusionMap:{value:null},color:{value:null},scale:{value:null},screenPosition:{value:null}},vertexShader:`

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

		}`};q.Geometry=(function(){const a=new Qe,t=new Float32Array([-1,-1,0,0,0,1,-1,0,1,0,1,1,0,1,1,-1,1,0,0,1]),e=new et(t,5);return a.setIndex([0,1,2,0,2,3]),a.setAttribute("position",new ye(e,3,0,!1)),a.setAttribute("uv",new ye(e,2,3,!1)),a})();function St(a){let t=a>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function yt(a){const t=St(a),e=new Uint8Array(256);for(let o=0;o<256;o++)e[o]=o;for(let o=255;o>0;o--){const i=Math.floor(t()*(o+1)),n=e[o];e[o]=e[i],e[i]=n}const s=new Uint8Array(512);for(let o=0;o<512;o++)s[o]=e[o&255];return s}const Z=[1,-1,1,-1,1,-1,0,0],J=[1,1,-1,-1,0,0,1,-1],De=a=>a*a*a*(a*(a*6-15)+10);function xt(a,t,e,s){const o=Math.floor(a),i=Math.floor(t),n=a-o,r=t-i,l=(o%e+e)%e,c=(i%e+e)%e,h=(l+1)%e,f=(c+1)%e,d=s[s[l]+c]&7,p=s[s[h]+c]&7,u=s[s[l]+f]&7,S=s[s[h]+f]&7,v=Z[d]*n+J[d]*r,m=Z[p]*(n-1)+J[p]*r,w=Z[u]*n+J[u]*(r-1),C=Z[S]*(n-1)+J[S]*(r-1),g=De(n),D=De(r),b=v+(m-v)*g,T=w+(C-w)*g;return(b+(T-b)*D)*.7071}function he(a,t,e,s,o,i,n,r=!1){const l=yt(s),c=new Float32Array(a*a);let h=1/0,f=-1/0;for(let u=0;u<a;u++)for(let S=0;S<a;S++){let v=t,m=1,w=0;const C=S/a,g=u/a;for(let D=0;D<e;D++){let b=xt(C*v,g*v,v,l);o&&(b=.6*b+.4*(.5-Math.abs(b))),w+=b*m,v*=2,m*=.52}c[u*a+S]=w,w<h&&(h=w),w>f&&(f=w)}const d=a*a;if(r){const u=Float32Array.from(c).sort(),S=new Float32Array(256);for(let v=0;v<256;v++)S[v]=u[Math.min(d-1,Math.floor((v+1)/256*d))];for(let v=0;v<d;v++){const m=c[v];let w=0,C=255;for(;w<C;){const g=w+C>>1;S[g]<m?w=g+1:C=g}i[v*4+n]=w}return}const p=255/(f-h||1);for(let u=0;u<d;u++)i[u*4+n]=Math.round((c[u]-h)*p)}function Mt(a=512){const t=new Uint8Array(a*a*4);he(a,4,6,1337,!0,t,0,!0),he(a,3,5,4242,!1,t,1,!0),he(a,16,3,99,!1,t,2);for(let s=0;s<a*a;s++)t[s*4+3]=255;const e=new tt(t,a,a,st,ue);return e.wrapS=e.wrapT=at,e.magFilter=ie,e.minFilter=ot,e.generateMipmaps=!0,e.anisotropy=4,e.colorSpace=it,e.needsUpdate=!0,e.name="cloudNoise",{texture:e,data:t,size:a}}function Te(a,t,e,s=0){const o=a.size,i=a.data,n=(t-Math.floor(t))*o-.5,r=(e-Math.floor(e))*o-.5,l=Math.floor(n),c=Math.floor(r),h=n-l,f=r-c,d=v=>(v%o+o)%o,p=(v,m)=>i[(d(m)*o+d(v))*4+s]/255,u=p(l,c)+(p(l+1,c)-p(l,c))*h,S=p(l,c+1)+(p(l+1,c+1)-p(l,c+1))*h;return u+(S-u)*f}function Q(a,t){const e=document.createElement("canvas");e.width=e.height=a;const s=e.getContext("2d");t(s,a);const o=new nt(e);return o.colorSpace=rt,o}function Ct(){const a=Q(256,(o,i)=>{const n=i/2;let r=o.createRadialGradient(n,n,0,n,n,n);r.addColorStop(0,"rgba(255,255,255,1)"),r.addColorStop(.06,"rgba(255,250,235,0.85)"),r.addColorStop(.2,"rgba(255,225,180,0.25)"),r.addColorStop(.55,"rgba(255,200,150,0.05)"),r.addColorStop(1,"rgba(255,190,140,0)"),o.fillStyle=r,o.fillRect(0,0,i,i),o.globalCompositeOperation="lighter";for(let l=0;l<6;l++){o.save(),o.translate(n,n),o.rotate(l/6*Math.PI+.26);const c=o.createLinearGradient(-n,0,n,0);c.addColorStop(0,"rgba(255,240,220,0)"),c.addColorStop(.5,"rgba(255,240,220,0.18)"),c.addColorStop(1,"rgba(255,240,220,0)"),o.fillStyle=c,o.fillRect(-n,-.8,i,1.6),o.restore()}}),t=Q(128,(o,i)=>{const n=i/2,r=i*.44;o.beginPath();for(let c=0;c<6;c++){const h=c/6*Math.PI*2+Math.PI/6;o[c?"lineTo":"moveTo"](n+Math.cos(h)*r,n+Math.sin(h)*r)}o.closePath();const l=o.createRadialGradient(n,n,0,n,n,r);l.addColorStop(0,"rgba(255,255,255,0.35)"),l.addColorStop(.8,"rgba(255,255,255,0.55)"),l.addColorStop(1,"rgba(255,255,255,0.8)"),o.fillStyle=l,o.filter="blur(1.5px)",o.fill()}),e=Q(256,(o,i)=>{const n=i/2,r=o.createRadialGradient(n,n,i*.36,n,n,i*.48);r.addColorStop(0,"rgba(255,255,255,0)"),r.addColorStop(.35,"rgba(255,120,80,0.35)"),r.addColorStop(.55,"rgba(160,255,170,0.35)"),r.addColorStop(.75,"rgba(120,150,255,0.35)"),r.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=r,o.fillRect(0,0,i,i)}),s=Q(64,(o,i)=>{const n=i/2,r=o.createRadialGradient(n,n,0,n,n,n);r.addColorStop(0,"rgba(255,255,255,0.9)"),r.addColorStop(.5,"rgba(255,255,255,0.35)"),r.addColorStop(1,"rgba(255,255,255,0)"),o.fillStyle=r,o.fillRect(0,0,i,i)});return{glow:a,hex:t,ring:e,dot:s}}const we=4,R="directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;";let I=null,se=0,de="";function bt(){const a=R.replace(/\[ i \]/g,"[ 0 ]"),t=R.replace(/\[ i \]/g,"[ 1 ]").replace(/directionalLightShadow\./g,"rcFarS.");return`
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
			${a}
		}
		#elif ( UNROLLED_LOOP_INDEX == 1 )
		if ( dot( directLight.color, vec3( 1.0 ) ) > 0.0 ) {
			DirectionalLightShadow rcFarS = directionalLightShadows[ 1 ];
			${t}
		}
		#else
		${R}
		#endif`}const _t=a=>`dot( directionalLights[ ${a} ].color, vec3( 1.0 ) ) <= 0.0 && dot( directionalLights[ ${a} ].direction, directionalLight.direction ) > 0.9999`;function $e(a){const t=a===0?"directionalLightShadow":`rcL${a}`;return`getShadow( directionalShadowMap[ ${a} ], ${t}.shadowMapSize, ${t}.shadowIntensity, ${t}.shadowBias, ${t}.shadowRadius, vDirectionalShadowCoord[ ${a} ] )`}function Ne(a,t,e,s){s(`DirectionalLightShadow rcL${a} = directionalLightShadows[ ${a} ];`,e),s(`vec3 rc${a} = vDirectionalShadowCoord[ ${a} ].xyz / vDirectionalShadowCoord[ ${a} ].w;`,e),s(`vec2 rcE${a} = abs( rc${a}.xy - 0.5 );`,e),s(`bool rcF${a} = rcN == ${a+1};`,e),s(`float rcW${a} = rcF${a} ? 0.0 : ( rc${a}.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE${a}.x, rcE${a}.y ) );`,e),s(`float rcS${a} = 1.0, rcR${a} = 1.0;`,e),s(`if ( rcW${a} < 1.0 ) rcS${a} = ${$e(a)};`,e),s(`if ( rcF${a} ) rcS${a} = mix( rcS${a}, 1.0, smoothstep( 0.43, 0.495, max( rcE${a}.x, rcE${a}.y ) ) );`,e),a+1<t&&(s(`#if NUM_DIR_LIGHT_SHADOWS > ${a+1}`,e),s(`else if ( rcW${a} > 0.0 ) {`,e),Ne(a+1,t,e+1,s),s("}",e),s("#endif",e)),s(`rcR${a-1} = mix( rcS${a}, rcR${a}, rcW${a} );`,e)}function Dt(a){const t=R.replace(/\[ i \]/g,"[ 0 ]"),e=[""],s=(o,i)=>e.push("		"+"	".repeat(i)+o);s("#if ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )",0),s("{",0),s("int rcN = 1;",1);for(let o=1;o<a;o++)o>1&&s(`#if NUM_DIR_LIGHT_SHADOWS > ${o}`,o),s(`if ( ${_t(o)} ) {`,o),s(`rcN = ${o+1};`,o+1);for(let o=a-1;o>=1;o--)s("}",o),o>1&&s("#endif",o);return s("if ( rcN > 1 ) {",1),s("float rcS = 1.0;",2),s("if ( receiveShadow ) {",2),s("vec3 rc0 = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;",3),s("vec2 rcE0 = abs( rc0.xy - 0.5 );",3),s("float rcW0 = ( rc0.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE0.x, rcE0.y ) );",3),s("float rcS0 = 1.0, rcR0 = 1.0;",3),s(`if ( rcW0 < 1.0 ) rcS0 = ${$e(0)};`,3),s("if ( rcW0 > 0.0 ) {",3),Ne(1,a,4,s),s("}",3),s("rcS = mix( rcS0, rcR0, rcW0 );",3),s("}",2),s("directLight.color *= rcS;",2),s("} else {",1),s(t,2),s("}",1),s("}",0),s("#elif ( UNROLLED_LOOP_INDEX > 0 )",0),s("if ( dot( directLight.color, vec3( 1.0 ) ) > 0.0 ) {",0),s(R,1),s("}",0),s("#else",0),s(R,0),s("#endif",0),e.join(`
`)}function Tt(a=2){const t=Math.max(2,Math.min(we,Math.round(a)||2));return t===2?bt():Dt(t)}function os(){return I===!0?se:0}function Ge(a=2){const t=Math.max(2,Math.min(we,Math.round(a)||2));if(I===!1)return!1;if(I===!0&&t<=se)return!0;const e=$,s=Tt(t);if(I===null){if(!e.lights_fragment_begin.includes(R))return console.warn("[render] shadow cascade patch: three.js chunk changed, using a single cascade"),I=!1,!1;e.lights_fragment_begin=e.lights_fragment_begin.replace(R,s)}else{if(!e.lights_fragment_begin.includes(de))return console.warn(`[render] shadow cascade patch: lights_fragment_begin was replaced, keeping ${se} cascades`),!1;e.lights_fragment_begin=e.lights_fragment_begin.replace(de,()=>s)}return I=!0,se=t,de=s,!0}const ze="getDirectionalLightInfo( directionalLight, directLight );",fe="RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",zt=`if ( directLight.color != vec3( 0.0 ) ) { ${fe} }`;let U=null;function Pt(){if(U!==null)return U;const a=$.lights_fragment_begin,t=a.indexOf(ze),e=t<0?-1:a.indexOf(fe,t);return t<0||a.lastIndexOf(ze)!==t||e<0||a.slice(t,e).includes("#pragma unroll_loop_end")?(console.warn("[render] skip-unlit patch: three.js chunk changed, directional lights stay unguarded"),U=!1,!1):($.lights_fragment_begin=a.slice(0,e)+zt+a.slice(e+fe.length),U=!0,!0)}function is(){return U===!0}const At=["pcf","fast","pcss"],ae="ENGINE_SHADOW_FAST",oe="ENGINE_SHADOW_PCSS",H="engineDirShadowDepth",re="engineDirShadowPcss",O={length:0},ne={length:4};for(let a=0;a<4;a++)ne[a]=new me(0,0,0,0);const Rt=`
#if defined( USE_SHADOWMAP ) && defined( ${ae} ) && defined( SHADOWMAP_TYPE_PCF ) && NUM_DIR_LIGHT_SHADOWS > 0
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
`,Pe=a=>Array.from({length:a},(t,e)=>{const s=Math.sqrt((e+.5)/a),o=e*2.39996323;return`vec2( ${(s*Math.cos(o)).toFixed(4)}, ${(s*Math.sin(o)).toFixed(4)} )`}).join(", "),ee=a=>`enginePcssShadow( directionalShadowMap[ ${a} ], ${H}[ ${a} ], ${re}[ ${a} ], shadowMapSize, shadowIntensity, shadowBias, shadowRadius, shadowCoord )`,Be=`
#if defined( USE_SHADOWMAP ) && defined( ${oe} ) && defined( SHADOWMAP_TYPE_PCF ) && NUM_DIR_LIGHT_SHADOWS > 0 && NUM_DIR_LIGHT_SHADOWS <= 4
	uniform sampler2DShadow ${H}[ NUM_DIR_LIGHT_SHADOWS ];
	uniform vec4 ${re}[ NUM_DIR_LIGHT_SHADOWS ];
	const vec2 enginePcssSearch[ 8 ] = vec2[ 8 ]( ${Pe(8)} );
	const vec2 enginePcssDisc[ 12 ] = vec2[ 12 ]( ${Pe(12)} );
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
`,ns=Be;let W=null,V=null;function Ue(a,t){const e=$;return[[e.shadowmap_pars_fragment,"uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];"],[e.shadowmap_pars_fragment,"float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord )"],[e.shadowmap_pars_fragment,"unpackRGBAToDepth"],[e.lights_fragment_begin,"getShadow( directionalShadowMap["]].every(([o,i])=>typeof o=="string"&&o.includes(i))?!0:(console.warn(`[render] ${a} shadow kernel: three.js shadow chunk changed, keeping '${t}'`),!1)}function pe(a,t){for(const e in Me){const s=Me[e].uniforms;s&&s.directionalShadowMap&&!s[a]&&(s[a]={value:t})}}function Lt(){return W!==null?W:Ue("fast","pcf")?($.shadowmap_pars_fragment+=Rt,pe(H,O),W=!0,!0):(W=!1,!1)}function Et(){return V!==null?V:Ue("pcss","pcf")?($.shadowmap_pars_fragment+=Be,pe(H,O),pe(re,ne),V=!0,!0):(V=!1,!1)}function Ft(a=!1){const t=new ct(1,1);return t.compareFunction=a?lt:ht,t.minFilter=t.magFilter=ie,t}function kt(a,t){const e=a.shadow;if(e.map&&e.map.depthTexture===t)return!1;t.renderTarget&&t.renderTarget!==e.map&&(t.renderTarget.depthTexture=null),e.map&&e.map.dispose();const s=new Oe(e.mapSize.x,e.mapSize.y,{minFilter:xe,magFilter:xe,depthTexture:t});return s.texture.name=`${a.name}.shadowMap`,e.map=s,e.needsUpdate=!0,!0}function Ht(a,t=a.length){for(let e=0;e<t;e++)O[e]=a[e];for(let e=t;e<O.length;e++)O[e]=void 0;O.length=t}function It(a,t=a.length){const e=Math.min(t,4);for(let s=0;s<e;s++)ne[s].copy(a[s]);for(let s=e;s<4;s++)ne[s].set(0,0,0,0)}function Ae(a,t){return!!(a.isMeshStandardMaterial||a.isMeshLambertMaterial||a.isMeshPhongMaterial||a.isMeshToonMaterial||a.isShadowMaterial||a.isShaderMaterial&&a.lights===!0&&a.uniforms&&a.uniforms[H]&&(!t||a.uniforms[re]))}function Re(a,t){if(!a||!Ae(a,!1))return!1;const e=t==="pcss"&&V===!0&&Ae(a,!0),s=t==="fast"&&W===!0,o=a.defines,i=!!(o&&ae in o),n=!!(o&&oe in o);return s===i&&e===n?!1:(i&&!s&&delete o[ae],n&&!e&&delete o[oe],s&&!i&&((a.defines||(a.defines={}))[ae]=""),e&&!n&&((a.defines||(a.defines={}))[oe]=""),a.needsUpdate=!0,!0)}const k={kernel:"pcf",n:0};function Ot(a){const t=a.material;if(t)if(Array.isArray(t))for(let e=0;e<t.length;e++)Re(t[e],k.kernel)&&k.n++;else Re(t,k.kernel)&&k.n++}function Le(a,t){return k.kernel=t,k.n=0,a&&a.traverse(Ot),k.n}const x=Math.PI/180,Ee=8,Fe={dawn:7.25,morning:9.5,noon:13,afternoon:15.5,golden:17.55,sunset:18.45,dusk:18.95,night:22},$t=Ge(),We={rise:7.15,set:18.6,maxElevation:46,nightDepth:35,nightRate:13,azimuthStart:102,azimuthSpan:156};function Nt(a,t=We){const e=t.rise,s=t.set,o=t.maxElevation*x,i=(a-e)/(s-e);let n;i>=0&&i<=1?n=o*Math.sin(Math.PI*i):n=-Math.min(t.nightDepth*x,(i>1?a-s:e-a<0?e-a+24:e-a)*t.nightRate*x);const r=(t.azimuthStart+t.azimuthSpan*_(i,-.15,1.15))*x;return{el:n,az:r}}function Gt(a,t){let e=a.r*t/.6,s=a.g*t/.6,o=a.b*t/.6;const i=.59719*e+.35458*s+.04823*o,n=.076*e+.90834*s+.01566*o,r=.0284*e+.13383*s+.83777*o,l=d=>(d*(d+.0245786)-90537e-9)/(d*(.983729*d+.432951)+.238081),c=l(i),h=l(n),f=l(r);return new y(_(1.60475*c-.53108*h-.07367*f,0,1),_(-.10208*c+1.10813*h-.00605*f,0,1),_(-.00327*c-.07276*h+1.07602*f,0,1))}const Bt=[{el:-40,turb:2.4,ray:1.4,mie:.003,g:.78,tw:1,night:1,glowA:0,sun:1,env:.85,hemi:.2,haze:18e-5,mist:8e-5,cover:.36,cirrus:.22,cop:.8,cs:[.012,.014,.02],ca:[.032,.023,.019],aur:0},{el:-12,turb:2.4,ray:1.4,mie:.003,g:.78,tw:1,night:1,glowA:.05,sun:1,env:.85,hemi:.2,haze:18e-5,mist:8e-5,cover:.36,cirrus:.22,cop:.8,cs:[.014,.015,.022],ca:[.032,.024,.021],aur:0},{el:-6,turb:2.6,ray:1.6,mie:.003,g:.78,tw:1,night:.3,glowA:.55,sun:1,env:1.1,hemi:.26,haze:17e-5,mist:1e-4,cover:.34,cirrus:.26,cop:.8,cs:[.09,.045,.055],ca:[.026,.026,.038],aur:0},{el:-3,turb:3,ray:2,mie:.0035,g:.8,tw:1,night:0,glowA:1,sun:1,env:1.2,hemi:.28,haze:17e-5,mist:12e-5,cover:.33,cirrus:.3,cop:.85,cs:[.36,.13,.1],ca:[.04,.036,.052],aur:0},{el:0,turb:3.2,ray:2.3,mie:.004,g:.8,tw:.55,night:0,glowA:.9,sun:1,env:1.05,hemi:.26,haze:12e-5,mist:13e-5,cover:.32,cirrus:.32,cop:.85,cs:[.65,.26,.13],ca:[.065,.055,.065],aur:.5},{el:3,turb:3,ray:2.2,mie:.0038,g:.8,tw:.12,night:0,glowA:.4,sun:1,env:.95,hemi:.24,haze:12e-5,mist:11e-5,cover:.32,cirrus:.32,cop:.85,cs:[.9,.45,.24],ca:[.1,.095,.11],aur:.55},{el:9,turb:2.3,ray:1.75,mie:.0033,g:.8,tw:0,night:0,glowA:0,sun:1,env:.9,hemi:.22,haze:11e-5,mist:8e-5,cover:.3,cirrus:.3,cop:.85,cs:[1.05,.75,.5],ca:[.15,.16,.19],aur:.5},{el:18,turb:2.2,ray:1.6,mie:.0031,g:.79,tw:0,night:0,glowA:0,sun:1,env:.88,hemi:.2,haze:1e-4,mist:5e-5,cover:.28,cirrus:.3,cop:.85,cs:[1.2,1.08,.95],ca:[.21,.23,.28],aur:.4},{el:32,turb:2.1,ray:1.5,mie:.0029,g:.78,tw:0,night:0,glowA:0,sun:1,env:.86,hemi:.18,haze:8e-5,mist:4e-5,cover:.26,cirrus:.28,cop:.85,cs:[1.3,1.25,1.18],ca:[.25,.28,.33],aur:.3},{el:50,turb:2,ray:1.4,mie:.0027,g:.78,tw:0,night:0,glowA:0,sun:1,env:.85,hemi:.18,haze:8e-5,mist:3e-5,cover:.25,cirrus:.25,cop:.85,cs:[1.35,1.32,1.28],ca:[.27,.3,.36],aur:.3},{el:90,turb:1.95,ray:1.35,mie:.0026,g:.78,tw:0,night:0,glowA:0,sun:1,env:.83,hemi:.17,haze:7e-5,mist:25e-6,cover:.25,cirrus:.24,cop:.85,cs:[1.4,1.37,1.33],ca:[.28,.31,.37],aur:.25}];function ke(a,t){let e=0;for(;e<a.length-2&&t>a[e+1].el;)e++;const s=a[e],o=a[e+1],i=_((t-s.el)/(o.el-s.el),0,1),n=i*i*(3-2*i),r={};for(const l in s)l!=="el"&&(r[l]=Array.isArray(s[l])?s[l].map((c,h)=>c+(o[l][h]-c)*n):s[l]+(o[l]-s[l])*n);return r}function Ut(a){const t=Math.max(a/x,-1),e=1/(Math.sin(Math.max(t,0)*x)+.50572*Math.pow(t+6.07995,-1.6364)),o=[.045,.085,.19].map(n=>Math.exp(-e*n)),i=Math.max(...o);return{color:new y(o[0]/i,o[1]/i,o[2]/i),trans:i}}const Wt=`
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
float rsHash13( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
vec3 rsHash33( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.xxy + p.yxx ) * p.zyx ); }
float rsCloud( vec2 uv ) { return texture2D( tCloud, uv ).r * 0.65 + texture2D( tCloud, uv * 2.9 + vec2( 0.37, 0.71 ) ).r * 0.35; }
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
		float n = rsCloud( uv ) + ( texture2D( tCloud, uv * 9.0 ).b - 0.5 ) * 0.12;
		float thr = 1.0 - uCover;
		float d = smoothstep( thr, thr + 0.2, n );
		vec2 sdir = normalize( vSunDirection.xz + vec2( 1e-4 ) ) * 0.012;
		float dS = smoothstep( thr, thr + 0.2, rsCloud( uv + sdir ) );
		float lit = clamp( 1.0 - 0.7 * dS + 0.2 * ( 1.0 - d ), 0.0, 1.0 );
		float fwd = pow( rsCs, 5.0 );
		vec3 cc = uCloudAmb * ( 0.7 + 0.3 * ( 1.0 - d ) ) + uCloudSun * lit * ( 0.45 + 1.5 * fwd * ( 1.0 - 0.6 * d ) );
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
	gl_FragColor = vec4( col, 1.0 );`;function Kt(a){return{skyGain:{value:.6},uDisc:{value:1},uDiscCos:{value:Math.cos(.0075)},uGlowCol:{value:new y(0,0,0)},uTwilight:{value:0},uNight:{value:0},uAfterglow:{value:0},uTwZen:{value:new y(.018,.04,.115)},uTwHor:{value:new y(.1,.11,.15)},uTwGlow:{value:new y(.75,.28,.07)},uNightZen:{value:new y(.0035,.0075,.024)},uNightHor:{value:new y(.012,.015,.026)},uPollution:{value:new y(.036,.027,.024)},uClouds:{value:1},uCover:{value:.3},uCirrus:{value:.4},uCloudOpacity:{value:.85},uCloudScale:{value:1/14e3},uCloudH:{value:1700},uCloudOffset:{value:new K(.13,.41)},tCloud:{value:a},uCloudSun:{value:new y(1,1,1)},uCloudAmb:{value:new y(.3,.3,.35)},uStars:{value:0},uTime:{value:0},uHorizonTint:{value:new y(.8,.93,1.15)},uSkySat:{value:1.3},uMoonDir:{value:new M(0,1,0)},uMoonCol:{value:new y(1.6,1.55,1.45)}}}function He(a,t){const e=a.material;Object.assign(e.uniforms,Kt(t));let s=e.fragmentShader;const o=["uniform vec3 up;","float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );","gl_FragColor = vec4( retColor, 1.0 );"];for(const i of o)s.includes(i)||console.warn("[sky] Sky shader patch point missing:",i);return s=s.replace("uniform vec3 up;",`uniform vec3 up;
`+Wt).replace(o[1],"float sundisk = uDisc * smoothstep( uDiscCos, uDiscCos + 0.00002, cosTheta );").replace(o[2],Vt),e.fragmentShader=s,e.needsUpdate=!0,a}const jt=[["glow",380,0,[1,.92,.8],.25],["dot",46,.32,[1,.75,.45],.16],["hex",74,.52,[.55,.85,1],.1],["hex",118,.7,[1,.7,.4],.075],["ring",300,.92,[1,1,1],.07],["hex",170,1.12,[.55,1,.7],.055],["dot",90,1.38,[.75,.6,1],.07]],qt={cascades:2,near:45,far:[260,420,650],farUp:[70,200],farDown:[50,160],mid:null,single:130,nearMapSize:2048,midMapSize:2048,farMapSize:4096,singleMapSize:4096,nearRadius:2,midRadius:1.7,farRadius:1.4,lead:.45,farLead:.55,farMaxY:40,farInterval:2,kernel:"pcf",lightSize:.5,maxPenumbra:24,temporalNoise:!1,skipUnlit:!1};class rs{constructor(t={},e,s){const o=!!(t&&t.isScene),i=o?{...s||{},scene:t,renderer:e}:t;this.scene=i.scene,this.renderer=i.renderer,this.timePresets=i.timePresets||Fe,this.sunModel={...We,...i.sun||{}},this.looks=i.looks||Bt;const n=this.shadowOpts={...qt,...i.shadows||{}};i.shadowNearHalf!=null&&(n.near=i.shadowNearHalf);const r=Math.max(1,Math.min(we,Math.floor(Number(n.cascades))||1));this.cascaded=r>1&&$t,this.cascadeCount=this.cascaded?r>2&&Ge(r)?r:2:1,n.skipUnlit&&Pt(),this.cascadeLights=[],this.shadowKernel="pcf";const l=i.timeOfDay??"golden";this.hours=typeof l=="number"?l:this.timePresets[l]??this.timePresets.golden??Fe.golden,this.skyGain=i.skyGain??.38,this.skyRadius=i.skyRadius??4e3,this.sunIntensity=i.sunIntensity??3.9,this.moonIntensity=i.moonIntensity??.3,this.moonScatter=Math.max(0,+i.moonScatter||0),this.moonColor=new y(...i.moonColor||[.62,.72,1]),this.fogDensity=i.fogDensity??[3e-4,15e-5],this.flareSpec=i.flare===!1?null:i.flare||jt,this.nearHalf=n.near,this.farHalfSteps=Array.isArray(n.far)?n.far.slice():[n.far],this.shadowHalf=this.nearHalf,this.sunDir=new M(0,1,0),this.lightDir=new M(0,1,0);const c=i.moon||{azimuth:150,elevation:34};this.moonDir=new M,this.moonDir.set(Math.sin(c.azimuth*x)*Math.cos(c.elevation*x),Math.sin(c.elevation*x),-Math.cos(c.azimuth*x)*Math.cos(c.elevation*x)).normalize(),this.darkness=0,this.windowGlow=0,this.maxBuildingHeight=i.maxCasterHeight??200,this.version=0,this.fogMode="scene",this.camera=i.camera||null,this.sunColor=new y(1,1,1),this.scatterDir=this.moonScatter>0?new M(0,1,0):this.sunDir,this.scatterColor=this.moonScatter>0?new y(1,1,1):this.sunColor,this.fogParams={haze:2e-4,hazeK:1/700,hazeBase:0,mist:1e-4,mistK:1/40,sunScatter:0},this.look=ke(this.looks,10),this.cloudWind=new K(...i.cloudWind||[6.5,2.2]),this._frame=0,this._farHalf=this.farHalfSteps[0],this._farDirty=!0,this._lastT=0,this._clock=0,this._fastDepth=null,this._fastMaps=null,this._onChildAdded=null,this._pcss=null,this._noiseFrame=0,this.flareScale=1,(i.build??!o)&&this.build()}get maxCasterHeight(){return this.maxBuildingHeight}set maxCasterHeight(t){this.maxBuildingHeight=t}build(){const{scene:t,renderer:e}=this,s=this.shadowOpts;this.cloudAtlas=Mt(512);const o=this.cloudAtlas.texture;this.sky=He(new j,o),this.sky.scale.setScalar(this.skyRadius),this.sky.frustumCulled=!1,this.sky.renderOrder=-1,this.sky.name="sky",this.sky.material.uniforms.uStars.value=0,t.add(this.sky);const i=e?.capabilities?.maxTextureSize||4096;this.sun=new Ce(16777215,3),this.sun.name="sun",this.sun.castShadow=!0;const n=this.cascaded?Math.min(s.nearMapSize,i):Math.min(s.singleMapSize,i);if(this.cascaded||(this.nearHalf=s.single),this.sun.shadow.mapSize.set(n,n),this._setBox(this.sun,this.nearHalf),this.sun.shadow.radius=s.nearRadius,t.add(this.sun,this.sun.target),this.cascadeLights.length=0,this.cascadeLights.push(this.sun),this.cascaded){const r=this.cascadeCount,l=Math.min(s.farMapSize,i),c=Math.min(s.midMapSize,i);this.midHalfSteps=this._midHalfSteps(n,c,l);for(let h=1;h<r-1;h++){const f=h===1?"sunMid":"sunMid2",d=this[f]=this._cascadeLight(`${f}Cascade`,c,this.midHalfSteps[h-1][0],s.midRadius);t.add(d,d.target),this.cascadeLights.push(d)}this.sunFar=this._cascadeLight("sunFarCascade",l,this._farHalf,s.farRadius),t.add(this.sunFar,this.sunFar.target),this.cascadeLights.push(this.sunFar)}return this.cascaded&&this._checkShadowOrder(),this.hemi=new dt(12571903,4866102,.3),t.add(this.hemi),this.fog=new le(12634320,42e-5),this.fogPost=new le(8425632,0),t.fog=this.fogMode==="scene"?this.fog:this.fogPost,this.pmrem=e?new ut(e):null,this.envScene=new be,this.envSky=He(new j,o),this.envSky.scale.setScalar(500),this.envScene.add(this.envSky),this.skyCubeRT=new ft(32,{type:pt,generateMipmaps:!1,minFilter:ie,magFilter:ie}),this.skyCubeRT.texture.name="skyCube",this.cubeCam=new mt(.1,1e3,this.skyCubeRT),this.envScene.add(this.cubeCam),this.flareSpec&&e&&typeof document<"u"&&this._buildFlare(),s.kernel&&s.kernel!=="pcf"&&this.setShadowKernel(s.kernel),this.setTime(this.hours),this}get skyCube(){return this.skyCubeRT?this.skyCubeRT.texture:null}get fogColor(){return this.fogMode==="scene"?this.fog?this.fog.color:null:this.fogPost?this.fogPost.color:null}setFogMode(t){this.fogMode=t==="post"?"post":"scene",this.fogPost||(this.fogPost=new le(8425632,0)),this.horizon&&this.fogPost.color.copy(this.horizon),this.scene&&(this.scene.fog=this.fogMode==="scene"?this.fog:this.fogPost)}setShadowKernel(t,e=this.scene){if(!At.includes(t))return console.warn(`[Atmosphere] unknown shadow kernel '${t}' ('pcf' | 'fast' | 'pcss')`),0;t!=="pcf"&&!this._fastShadowsOk(t)&&(t="pcf"),this.shadowKernel=t;const s=this.scene;return t!=="pcf"?(this._syncFastShadows(),t==="pcss"&&this._syncPcss(),!this._onChildAdded&&s&&(this._onChildAdded=o=>{const i=this._foreignShadowLight(o.child);if(i===null){Le(o.child,this.shadowKernel);return}console.warn(`[Atmosphere] ${this.shadowKernel} shadow kernel unavailable (another shadow-casting directional light '${i}' was added), using 'pcf'`),this.setShadowKernel("pcf")},s.addEventListener("childadded",this._onChildAdded))):this._onChildAdded&&(s.removeEventListener("childadded",this._onChildAdded),this._onChildAdded=null),Le(e,t)}_fastShadowsOk(t="fast"){const e=this.renderer;let s="";if(!e)s="no renderer";else if(!this.sun)s="not built yet";else if(e.shadowMap.type!==_e)s="it replaces PCFShadowMap only";else if(!(t==="pcss"?Et():Lt()))s="three.js shadow chunks changed";else if(t==="pcss"&&2*this.cascadeCount>=(e.capabilities?.maxTextures??16)-Ee)s=`${2*this.cascadeCount} shadow texture units leave ${Ee} or fewer of ${e.capabilities?.maxTextures??16} for materials`;else{const o=this._foreignShadowLight(this.scene);o!==null&&(s=`another shadow-casting directional light '${o}'`)}return s&&console.warn(`[Atmosphere] ${t} shadow kernel unavailable (${s}), using 'pcf'`),!s}_foreignShadowLight(t){let e=null;const s=this.cascadeLights;return t.traverse(o=>{e===null&&o.isDirectionalLight&&o.castShadow&&!s.includes(o)&&(e=o.name||"(unnamed)")}),e}_checkShadowOrder(){let t=null;return this.scene.traverse(e=>{t===null&&e.isDirectionalLight&&e.castShadow&&(t=e)}),t&&t!==this.sun&&console.warn(`[Atmosphere] shadow-casting directional light '${t.name||"(unnamed)"}' precedes the sun in the scene: the shadow cascades will not be used (add it after the Atmosphere or turn its castShadow off)`),t===this.sun}_syncFastShadows(){if(this.renderer.shadowMap.type!==_e)return;const t=this.cascadeLights;if(!this._fastDepth){const s=this.renderer.state?.buffers?.depth?.getReversed?.()===!0;this._fastDepth=t.map(o=>{const i=Ft(s);return i.name=`${o.name}.shadowDepth`,i}),this._fastMaps=t.map(()=>null)}let e=0;for(let s=0;s<t.length;s++){const o=t[s];o.castShadow&&(kt(o,this._fastDepth[s]),this._fastMaps[e++]=this._fastDepth[s])}Ht(this._fastMaps,e)}_syncPcss(){const t=this.shadowOpts,e=this.cascadeLights,s=this._pcss||(this._pcss=e.map(()=>new me)),o=Math.tan(Math.max(0,t.lightSize)*x),i=t.maxPenumbra*(2*this.sun.userData.half/this.sun.shadow.mapSize.x),n=t.temporalNoise?this._noiseFrame:0;let r=0;for(let l=0;l<e.length;l++){const c=e[l];if(!c.castShadow)continue;const h=c.shadow.camera,f=2*c.userData.half/c.shadow.mapSize.x,d=h.far-h.near;s[r++].set(d*o/f,.5*Math.min(t.maxPenumbra,i/f),8*f/d,n)}It(s,r)}shadowCascadeInfo(t={count:0,lights:[],cameras:[],matrices:[],halfSizes:[],maps:[],depthTextures:[],packed:!0}){const e=this.cascadeLights,s=t.lights,o=t.cameras,i=t.matrices,n=t.halfSizes,r=t.maps||(t.maps=[]),l=t.depthTextures;let c=0,h=!1;for(let f=0;f<e.length;f++){const d=e[f],p=d.shadow;if(!d.castShadow)continue;const u=p.map?p.map.texture:null,S=p.map&&p.map.depthTexture?p.map.depthTexture:null;s[c]=d,o[c]=p.camera,i[c]=p.matrix,n[c]=d.userData.half,r[c]=u,l[c]=S||u,S||(h=!0),c++}return s.length=o.length=i.length=n.length=r.length=l.length=c,t.count=c,t.packed=h,t}_cascadeLight(t,e,s,o){const i=new Ce(0,0);return i.name=t,i.castShadow=!0,i.shadow.mapSize.set(e,e),this._setBox(i,s),i.shadow.radius=o,i.shadow.autoUpdate=!1,i.shadow.needsUpdate=!0,i}_midHalfSteps(t,e,s){const o=this.shadowOpts,i=this.cascadeCount,n=[],r=o.mid==null?null:Array.isArray(o.mid)?o.mid:[o.mid],l=2*this.nearHalf/t;for(let c=1;c<i-1;c++){const h=r?r[c-1]:null,f=c===1?null:n[c-2];n.push(this.farHalfSteps.map((d,p)=>{if(h!=null)return Array.isArray(h)?h[Math.min(p,h.length-1)]:h;const u=l*Math.pow(2*d/s/l,c/(i-1)),S=f?f[p]:this.nearHalf,v=f?o.farLead:o.lead,m=Math.max(1.25*S,S*(1-v)/Math.max(.05,1-o.farLead)+2);return Math.round(Math.min(Math.max(u*e/2,m),.8*d)/5)*5}))}return n}_setMidBoxes(t){const e=this.cascadeLights;for(let s=1;s<e.length-1;s++){const o=this.midHalfSteps[s-1],i=o[Math.min(t,o.length-1)];e[s].userData.half!==i&&this._setBox(e[s],i)}}_setBox(t,e){const s=t.shadow.camera;Object.assign(s,{left:-e,right:e,top:e,bottom:-e,near:1,far:2500}),s.updateProjectionMatrix(),t.userData.half=e;const o=2*e/t.shadow.mapSize.x;t.shadow.normalBias=o*1.4,t.shadow.bias=-3e-5}_buildFlare(){const t=Ct();this._flareTex=t,this.flare=new q,this.flare.frustumCulled=!1,this.flareEls=this.flareSpec.map(([e,s,o,i,n])=>{const r=new ve(typeof e=="string"?t[e]:e,s,o,new y(i[0]*n,i[1]*n,i[2]*n));return r.baseSize=s,r.base=new y(i[0]*n,i[1]*n,i[2]*n),this.flare.addElement(r),r}),this.flareScene=new be,this.flareScene.name="flare",this.flareScene.add(this.flare),this.flare.visible=!1}renderFlare(t,e){if(!this.flare||!this.flare.visible)return;const s=t.autoClear;t.autoClear=!1,t.setRenderTarget(null),t.render(this.flareScene,e),t.autoClear=s}setFlareScale(t){this.flareScale=_(t/1300,.3,3);for(const e of this.flareEls||[])e.size=e.baseSize*this.flareScale}setTimeOfDay(t){const e=typeof t=="number"?t:this.timePresets[t];return Number.isFinite(e)&&this.setTime(e),this}get timeOfDay(){return this.hours}setTime(t){this.hours=(t%24+24)%24;const{el:e,az:s}=Nt(this.hours,this.sunModel);this.sunEl=e;const o=e/x,i=new M(Math.sin(s)*Math.cos(e),Math.sin(e),-Math.cos(s)*Math.cos(e)).normalize();this.sunDir.copy(i),this.darkness=F(6*x,-9*x,e),this.windowGlow=_(Math.pow(F(14*x,-6*x,e),1.5),.02,1);const n=this.look=ke(this.looks,o),r=F(-2*x,3*x,e),l=Ut(e);this.sunColor.copy(l.color);const c=this.moonColor;this.lightDir.copy(r>.02?i:this.moonDir),this.sun.color.copy(r>.02?l.color:c),this.sun.intensity=r>.02?this.sunIntensity*r*Math.pow(l.trans,.8)*n.sun:this.moonIntensity;const h=this.moonScatter>0&&!(r>.02);this.moonScatter>0&&(this.scatterDir.copy(h?this.moonDir:i),this.scatterColor.copy(h?c:l.color)),this._farDirty=!0;const f=this.sunColor.clone().multiplyScalar(n.aur*r);for(const C of[this.sky,this.envSky]){const g=C.material.uniforms;g.turbidity.value=n.turb,g.rayleigh.value=n.ray,g.mieCoefficient.value=n.mie,g.mieDirectionalG.value=n.g,g.sunPosition.value.copy(i),g.skyGain.value=this.skyGain,g.uGlowCol.value.copy(f),g.uTwilight.value=n.tw,g.uNight.value=n.night,g.uAfterglow.value=n.glowA,g.uCover.value=n.cover,g.uCirrus.value=n.cirrus,g.uCloudOpacity.value=n.cop,g.uCloudSun.value.setRGB(n.cs[0],n.cs[1],n.cs[2]),g.uCloudAmb.value.setRGB(n.ca[0],n.ca[1],n.ca[2]),g.uMoonDir.value.copy(this.moonDir),g.uHorizonTint.value.setRGB(.8,.93,1.15).lerp(Ie,n.tw)}this.sky.material.uniforms.uStars.value=n.night,this.envSky.material.uniforms.uStars.value=0,this.pmrem&&(this.envRT&&this.envRT.dispose(),this.envRT=this.pmrem.fromScene(this.envScene,0,.1,1e3),this.scene.environment=this.envRT.texture,this.scene.environmentIntensity=n.env);const d=this.envSky.material.uniforms;d.uDisc.value=0,d.uClouds.value=0,this.renderer&&this.cubeCam.update(this.renderer,this.envScene);const p=this.sampleHorizon();d.uDisc.value=1,d.uClouds.value=1,this.horizon=p;const u=(this.renderer&&this.renderer.toneMappingExposure)??1,S=this.renderer&&this.renderer.toneMapping===vt?new y(_(p.r*u,0,1),_(p.g*u,0,1),_(p.b*u,0,1)):Gt(p,u);this.fog.color.copy(S),this.fog.density=this.fogDensity[0]+this.fogDensity[1]*this.darkness,this.fogPost.color.copy(p);const v=this.fogParams;v.haze=n.haze,v.mist=n.mist,v.sunScatter=h?this.moonScatter:.05*r*(1-F(25*x,45*x,e));const m=p.clone().multiplyScalar(1/Math.max(.03,Math.max(p.r,p.g,p.b)));this.hemi.color.copy(m).lerp(new y(.5,.66,1),.5+.3*this.darkness);const w=new y(.42,.37,.31).lerp(this.sunColor,.45*r);this.hemi.groundColor.copy(w).lerp(new y(.55,.36,.2),this.darkness*.8),this.hemi.intensity=n.hemi,this.flareEls&&this.flareEls.forEach((C,g)=>C.color.copy(C.base).multiply(g===0?this.sunColor:Ie)),this.version++}sampleHorizon(){const t=this.renderer,e=new y(.6,.65,.7);if(!t)return e;try{const o=new Oe(16,16,{type:wt,depthBuffer:!1}),i=new gt(60,1,.1,1e3),n=new Float32Array(256*4),r=t.getRenderTarget();let l=0,c=0,h=0,f=0;for(let d=0;d<8;d++){const p=d/8*Math.PI*2;i.position.set(0,0,0),i.lookAt(Math.cos(p),-.02,Math.sin(p)),t.setRenderTarget(o),t.render(this.envScene,i),t.readRenderTargetPixels(o,0,0,16,16,n);for(let u=0;u<256;u++){const S=n[u*4],v=n[u*4+1],m=n[u*4+2];isFinite(S)&&isFinite(v)&&isFinite(m)&&(l+=S,c+=v,h+=m,f++)}}t.setRenderTarget(r),o.dispose(),f&&e.setRGB(l/f,c/f,h/f)}catch(s){console.warn("[World] horizon sampling failed",s)}return e}cloudDensityToward(t,e){if(!this.cloudAtlas||e.y<=.01)return 0;const s=this.sky.material.uniforms,o=Math.max(s.uCloudH.value-t.y,60)/Math.max(e.y,.012),i=s.uCloudScale.value,n=s.uCloudOffset.value,r=(t.x+e.x*o)*i+n.x,l=(t.z+e.z*o)*i+n.y,c=Te(this.cloudAtlas,r,l)*.65+Te(this.cloudAtlas,r*2.9+.37,l*2.9+.71)*.35,h=1-s.uCover.value;return F(h,h+.2,c)*s.uCloudOpacity.value*F(0,.05,e.y)}update(t,e){if(!t)return;let s;Number.isFinite(e)?(e=Math.min(.1,Math.max(0,e)),this._clock+=e,s=this._clock*1e3):(s=performance.now(),e=this._lastT?Math.min(.1,(s-this._lastT)/1e3):0,this._lastT=s),this.sky.position.copy(t);const o=this.sky.material.uniforms;o.uTime.value=s/1e3%3600,o.uCloudOffset.value.addScaledVector(this.cloudWind,e*o.uCloudScale.value);let i=0,n=0;if(this.camera){this.camera.getWorldDirection(B);const c=Math.hypot(B.x,B.z);c>.001&&(i=B.x/c,n=B.z/c)}const r=this.shadowOpts,l=this.nearHalf;if(this._fitCascade(this.sun,t.x+i*l*r.lead,t.y,t.z+n*l*r.lead,l),this._frame++,this.sunFar){const c=this.farHalfSteps;let h=c.indexOf(this._farHalf);const f=r.farUp,d=r.farDown;h<c.length-1&&t.y>f[h]?h++:h>0&&t.y<d[h-1]&&h--,c[h]!==this._farHalf&&(this._farHalf=c[h],this._setBox(this.sunFar,this._farHalf),this._setMidBoxes(h),this._farDirty=!0);const p=this.cascadeLights,u=p.length,S=this._frame,v=this._farDirty,m=Math.min(t.y,r.farMaxY),w=r.farLead,C=Math.max(1,r.farInterval|0||2);let g=t.y,D=this.nearHalf,b=r.lead;for(let T=1;T<u;T++){const L=p[T],P=L.userData.half,A=P*w;let z=m;T<u-1&&(z=Math.max(m,g-Math.max(0,P*(1-w)-D*(1-b))),g=z,D=P,b=w);const X=t.x+i*A,Y=t.z+n*A;let E=v||(u===2?S%C===0:T===1?(S&1)===1:u===3?(S&1)===0:(S&3)===(T===2?0:2));(!E&&(u>2||C>2)?L.target.position.distanceToSquared(Qt.set(X,z,Y)):0)>((u>2?.3:.1)*P)**2&&(E=!0),E&&(this._fitCascade(L,X,z,Y,P),L.shadow.needsUpdate=!0)}this._farDirty=!1}this.shadowKernel!=="pcf"&&(this._syncFastShadows(),this.shadowKernel==="pcss"&&(r.temporalNoise&&e>0&&(this._noiseFrame=this._noiseFrame+1&63),this._syncPcss())),this._updateFlare(t)}_fitCascade(t,e,s,o,i){const n=this.lightDir,r=2*i/t.shadow.mapSize.x,l=Xt.copy(n).negate(),c=Yt.crossVectors(l,Math.abs(l.y)>.99?ts:es).normalize(),h=Zt.crossVectors(c,l).normalize();let f=e*c.x+s*c.y+o*c.z,d=e*h.x+s*h.y+o*h.z;const p=e*l.x+s*l.y+o*l.z;f=Math.round(f/r)*r,d=Math.round(d/r)*r;const u=Jt.set(0,0,0).addScaledVector(c,f).addScaledVector(h,d).addScaledVector(l,p),S=Math.max(.05,Math.asin(_(n.y,-1,1))),v=_(this.maxBuildingHeight/Math.tan(S)+200,400,2200);t.target.position.copy(u),t.position.copy(u).addScaledVector(n,v);const m=t.shadow.camera,w=v+500+i;Math.abs(m.far-w)>50&&(m.far=w,m.updateProjectionMatrix()),t.target.updateMatrixWorld(),t.updateMatrixWorld()}_updateFlare(t){if(!this.flare)return;const e=F(-.8*x,1.5*x,this.sunEl);if(e<=.001){this.flare.visible=!1;return}this.flare.visible=!0,this.flare.position.copy(t).addScaledVector(this.sunDir,5e3),this.flare.updateMatrixWorld();const s=e*(1-.92*this.cloudDensityToward(t,this.sunDir)),o=this.flareEls;for(let i=0;i<o.length;i++){const n=o[i];n.color.copy(n.base).multiplyScalar(s),i===0&&n.color.multiply(this.sunColor)}}dispose(){const t=this.scene;for(const e of[this.sky,this.hemi])e&&t&&t.remove(e);for(const e of this.cascadeLights)t&&t.remove(e,e.target);t&&(t.fog===this.fog||t.fog===this.fogPost)&&(t.fog=null),t&&this._onChildAdded&&(t.removeEventListener("childadded",this._onChildAdded),this._onChildAdded=null),t&&this.envRT&&t.environment===this.envRT.texture&&(t.environment=null);for(const e of[this.sky,this.envSky])e&&e.material.dispose();for(const e of this.cascadeLights)e.dispose();if(this.envRT&&this.envRT.dispose(),this.skyCubeRT&&this.skyCubeRT.dispose(),this.pmrem&&this.pmrem.dispose(),this.cloudAtlas&&this.cloudAtlas.texture.dispose(),this._flareTex)for(const e of Object.values(this._flareTex))e.dispose()}}const Xt=new M,Yt=new M,Zt=new M,Jt=new M,B=new M,Qt=new M,es=new M(0,1,0),ts=new M(1,0,0),Ie=new y(1,1,1);export{rs as A,Bt as D,ae as F,we as M,oe as P,At as S,Fe as T,jt as a,We as b,ns as c,zt as d,Le as e,kt as f,Tt as g,Ft as h,Ge as i,Lt as j,Et as k,Pt as l,os as m,Mt as n,Ct as o,Ht as p,Re as q,It as r,Te as s,is as t,Nt as u};
