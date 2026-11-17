import{U as y}from"./three.module-Dt1S_jJM.js";import{n as p,t as g}from"./Particles-DsON8qAt.js";import{G as u,d7 as v,z as w,v as x,D as _,bD as A,C as S,i as U,V as f}from"./three.core-BG5Iv3B7.js";const D=`
attribute float aAlpha;
attribute float aId;
uniform float uHead;
uniform float uCap;
uniform float uFadeTail;
varying float vAlpha;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
	float age = ( uHead - aId ) / uCap;
	vAlpha = aAlpha * ( 1.0 - smoothstep( 1.0 - uFadeTail, 1.0, age ) );
	vUv = uv;
	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`,M=`
uniform vec3 uColor;
uniform float uEdge;
uniform float uTread;
uniform sampler2D uMap;
uniform float uHasMap;
varying float vAlpha;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
	float edge = smoothstep( 0.0, uEdge, vUv.y ) * smoothstep( 1.0, 1.0 - uEdge, vUv.y );
	float tread = mix( 1.0, 0.8 + 0.2 * step( 0.5, fract( vUv.y * 4.0 ) ), uTread );
	vec4 t = uHasMap > 0.5 ? texture2D( uMap, vUv ) : vec4( 1.0 );
	gl_FragColor = vec4( uColor * t.rgb, vAlpha * edge * tread * t.a );
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;class V{constructor(t={}){const r=this.max=t.maxQuads??1600;this.head=0,this.lift=t.lift??0,this.opacity=t.opacity??.78,this.minSegment=t.minSegment??.2,this.maxSegment=t.maxSegment??2;const l=r*4;this.pos=new u(new Float32Array(l*3),3).setUsage(v),this.alpha=new u(new Float32Array(l),1).setUsage(v),this.id=new u(new Float32Array(l).fill(-1e9),1).setUsage(v);const h=new Float32Array(l*2),n=new Uint32Array(r*6);for(let a=0;a<r;a++){const e=a*4;h.set([0,0,0,1,1,0,1,1],e*2),n.set([e,e+1,e+2,e+1,e+3,e+2],a*6)}const o=new w;o.setAttribute("position",this.pos),o.setAttribute("uv",new u(h,2)),o.setAttribute("aAlpha",this.alpha),o.setAttribute("aId",this.id),o.setIndex(new u(n,1)),o.setDrawRange(0,0),this.geometry=o,this.material=new x({uniforms:A.merge([y.fog,{uHead:{value:0},uCap:{value:r},uFadeTail:{value:t.fadeTail??.3},uColor:{value:new S(t.color??197379)},uEdge:{value:t.edge??.18},uTread:{value:t.tread===!1?0:1},uMap:{value:t.map||null},uHasMap:{value:t.map?1:0}}]),vertexShader:D,fragmentShader:M,transparent:!0,depthWrite:!1,fog:!0,side:_,polygonOffset:!0,polygonOffsetFactor:t.polygonOffset??-4,polygonOffsetUnits:t.polygonOffset??-4}),this.mesh=new U(o,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=t.renderOrder??2,this.mesh.name=t.name||"decalTrail",this.trail=Array.from({length:t.trails??4},()=>({on:!1,l:new f,r:new f,c:new f,a:0})),this._l=new f,this._r=new f,this._rp=p(),this._ra=p(),this._ri=p()}_quad(t,r,l,h,n,o){const a=this.head%this.max,e=a*4,s=this.pos.array,i=e*3;s[i]=t.x,s[i+1]=t.y,s[i+2]=t.z,s[i+3]=r.x,s[i+4]=r.y,s[i+5]=r.z,s[i+6]=l.x,s[i+7]=l.y,s[i+8]=l.z,s[i+9]=h.x,s[i+10]=h.y,s[i+11]=h.z;const d=this.alpha.array,m=this.id.array,c=this.head;d[e]=n,d[e+1]=n,d[e+2]=o,d[e+3]=o,m[e]=c,m[e+1]=c,m[e+2]=c,m[e+3]=c,g(this.pos,this._rp,e*3,12),g(this.alpha,this._ra,e,4),g(this.id,this._ri,e,4),this.head++,this.geometry.setDrawRange(0,Math.min(this.head,this.max)*6),this.material.uniforms.uHead.value=this.head}feed(t,r,l,h,n,o){const a=this.trail[t];if(n<=.02){a.on=!1;return}const e=this._l.copy(r).addScaledVector(l,-h),s=this._r.copy(r).addScaledVector(l,h),i=this.lift;if(i&&(o?(e.addScaledVector(o,i),s.addScaledVector(o,i)):(e.y+=i,s.y+=i)),!a.on){a.on=!0,a.l.copy(e),a.r.copy(s),a.c.copy(r),a.a=n;return}const d=a.c.distanceToSquared(r);if(!(d<this.minSegment*this.minSegment)){if(d>this.maxSegment*this.maxSegment){a.l.copy(e),a.r.copy(s),a.c.copy(r),a.a=n;return}this._quad(a.l,a.r,e,s,a.a*this.opacity,n*this.opacity),a.l.copy(e),a.r.copy(s),a.c.copy(r),a.a=n}}end(t){this.trail[t].on=!1}get count(){return Math.min(this.head,this.max)}clear(){this.head=0,this.geometry.setDrawRange(0,0);for(const t of this.trail)t.on=!1;this.id.array.fill(-1e9),this.id.clearUpdateRanges(),this.id.needsUpdate=!0,this.material.uniforms.uHead.value=0}dispose(){this.geometry.dispose(),this.material.dispose()}}export{V as D};
