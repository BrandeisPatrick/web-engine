import{m as W}from"./TextureSets-CvZAYc7C.js";import{p as T,m as H}from"./noise-g5kHFeMn.js";import{I as _,F as k,a as b,C,V as g,S as L,O as R,b as V,c as P,M as j,d as G,N as $,L as q}from"./three.module-B_yomNYV.js";const E=520;function J(){const r=W(512,256),o=r.getContext("2d"),t=H(91),s=o.createImageData(512,256),i=s.data,a=512/2,h=256/2;for(let l=0;l<4;l++){const B=l%2*a,F=Math.floor(l/2)*h,u=[],S=6+Math.floor(t()*4);for(let n=0;n<S;n++){const e=(t()-.5)*.62,c=.07+t()*.07*(1-Math.abs(e));u.push([.5+e,.66-c*.9-t()*.3*(1-Math.abs(e)*1.6),c])}for(let n=0;n<26;n++){const e=u[Math.floor(t()*u.length)];u.push([e[0]+(t()-.5)*e[2]*2.2,e[1]-t()*e[2]*1.1,e[2]*(.35+t()*.3)])}for(let n=0;n<h;n++)for(let e=0;e<a;e++){const c=e/a,m=n/h;let M=0;for(const[I,N,w]of u){const y=(c-I)/w,x=(m-N)/(w*2);M+=Math.exp(-(y*y+x*x)*1.4)}const z=1-Math.min(1,Math.max(0,(m-.68)/.08)),O=T(c*2+l*.31,m,6,4,17+l,.55),D=1-Math.exp(-M*1.6)-.45*(O-.5),p=Math.min(1,Math.max(0,(D-.28)/.3)),U=p*p*(3-2*p)*z*Math.min(1,c*8,(1-c)*8,m*6),d=((F+n)*512+B+e)*4;i[d]=255*U,i[d+1]=255*(1-m),i[d+2]=0,i[d+3]=255}}o.putImageData(s,0,0);const f=new G(r);return f.colorSpace=$,f.minFilter=q,f}const K=`
attribute vec4 cA; // azimuth (rad), elevation (rad), width (m), atlas cell
attribute vec2 cB; // drift speed (rad / s), opacity
uniform vec3 uCam, uMoon;
uniform float uTime;
varying vec2 vUv;
varying vec2 vMoon2;
varying float vNear, vOp;
void main() {
  float az = cA.x + uTime * cB.x, el = cA.y;
  vec3 dir = vec3( cos( el ) * sin( az ), sin( el ), cos( el ) * cos( az ) );
  vec3 c = uCam + dir * ${E.toFixed(1)};
  vec3 r = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) ), u = cross( r, dir );
  vec3 p = c + r * position.x * cA.z + u * position.y * cA.z * 0.5 * 1.15;
  float cell = cA.w;
  vUv = ( position.xy + 0.5 ) * 0.5 + vec2( mod( cell, 2.0 ), floor( cell / 2.0 ) ) * 0.5;
  vUv.y = 1.0 - vUv.y; // (canvas rows run down)
  vec3 m = normalize( uMoon );
  vMoon2 = normalize( vec2( dot( m, r ), - dot( m, u ) ) + 1e-4 ); // toward the moon in the atlas' orientation
  vNear = pow( max( dot( dir, m ), 0.0 ), 6.0 );
  vOp = cB.y;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}`,Q=`
uniform sampler2D tCloud;
uniform vec3 uBody, uRim;
varying vec2 vUv;
varying vec2 vMoon2;
varying float vNear, vOp;
void main() {
  vec4 t = texture2D( tCloud, vUv );
  float a = t.r;
  if ( a < 0.004 ) discard;
  // the rim: how much thinner the cloud gets two steps toward the moon (a soft band, not an outline)
  float toward = 0.5 * ( texture2D( tCloud, vUv + vMoon2 * vec2( 0.025, 0.05 ) ).r + texture2D( tCloud, vUv + vMoon2 * vec2( 0.05, 0.1 ) ).r );
  float rim = clamp( ( a - toward ) * 1.6, 0.0, 1.0 ) * smoothstep( 0.0, 0.5, a ) * ( 1.0 - 0.6 * smoothstep( 0.6, 1.0, a ) );
  vec3 col = uBody * ( 0.45 + 0.9 * t.g ) + uRim * rim * ( 1.0 - a ) * ( 0.06 + 0.4 * vNear );
  gl_FragColor = vec4( col * a * vOp, a * vOp ); // premultiplied
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;class tt{constructor({scene:v,count:r=18,rng:o=Math.random}){const t=new _;t.setAttribute("position",new k([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),t.setIndex([0,1,2,0,2,3]);const s=new Float32Array(r*4),i=new Float32Array(r*2);for(let a=0;a<r;a++)s[a*4]=a/r*Math.PI*2+o()*.3,s[a*4+1]=.11+Math.pow(o(),1.6)*.4,s[a*4+2]=120+o()*170,s[a*4+3]=Math.floor(o()*4),i[a*2]=.0012+o()*.0012,i[a*2+1]=.55+o()*.4;t.setAttribute("cA",new b(s,4)),t.setAttribute("cB",new b(i,2)),t.instanceCount=r,this.u={uCam:{value:new g},uMoon:{value:new g(0,1,0)},uTime:{value:0},tCloud:{value:J()},uBody:{value:new C(.012,.013,.019)},uRim:{value:new C(.2,.21,.24)}},this.material=new L({uniforms:this.u,vertexShader:K,fragmentShader:Q,transparent:!0,depthWrite:!1,fog:!1,blending:P,blendSrc:V,blendDst:R}),this.mesh=new j(t,this.material),this.mesh.name="cumulus",this.mesh.frustumCulled=!1,this.mesh.renderOrder=1.2,v.add(this.mesh)}update(v,r,o){this.u.uCam.value.copy(v),this.u.uMoon.value.copy(r),this.u.uTime.value=o%2e4}}export{tt as CumulusClouds};
