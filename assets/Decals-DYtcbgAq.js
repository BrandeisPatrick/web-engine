import{K as d,i as p,j as y,S as w,D as x,aZ as _,a_ as S,C as A,M as U,V as f}from"./three.module-B_yomNYV.js";import{n as g,t as v}from"./bufferRanges-CPmfb8AL.js";const M=`
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
}`,D=`
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
}`;class T{constructor(a={}){const r=this.max=a.maxQuads??1600;this.head=0,this.lift=a.lift??0,this.opacity=a.opacity??.78,this.minSegment=a.minSegment??.2,this.maxSegment=a.maxSegment??2;const l=r*4;this.pos=new d(new Float32Array(l*3),3).setUsage(p),this.alpha=new d(new Float32Array(l),1).setUsage(p),this.id=new d(new Float32Array(l).fill(-1e9),1).setUsage(p);const h=new Float32Array(l*2),n=new Uint32Array(r*6);for(let t=0;t<r;t++){const e=t*4;h.set([0,0,0,1,1,0,1,1],e*2),n.set([e,e+1,e+2,e+1,e+3,e+2],t*6)}const o=new y;o.setAttribute("position",this.pos),o.setAttribute("uv",new d(h,2)),o.setAttribute("aAlpha",this.alpha),o.setAttribute("aId",this.id),o.setIndex(new d(n,1)),o.setDrawRange(0,0),this.geometry=o,this.material=new w({uniforms:_.merge([S.fog,{uHead:{value:0},uCap:{value:r},uFadeTail:{value:a.fadeTail??.3},uColor:{value:new A(a.color??197379)},uEdge:{value:a.edge??.18},uTread:{value:a.tread===!1?0:1},uMap:{value:a.map||null},uHasMap:{value:a.map?1:0}}]),vertexShader:M,fragmentShader:D,transparent:!0,depthWrite:!1,fog:!0,side:x,polygonOffset:!0,polygonOffsetFactor:a.polygonOffset??-4,polygonOffsetUnits:a.polygonOffset??-4}),this.mesh=new U(o,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=a.renderOrder??2,this.mesh.name=a.name||"decalTrail",this.trail=Array.from({length:a.trails??4},()=>({on:!1,l:new f,r:new f,c:new f,a:0})),this._l=new f,this._r=new f,this._rp=g(),this._ra=g(),this._ri=g()}_quad(a,r,l,h,n,o){const t=this.head%this.max,e=t*4,s=this.pos.array,i=e*3;s[i]=a.x,s[i+1]=a.y,s[i+2]=a.z,s[i+3]=r.x,s[i+4]=r.y,s[i+5]=r.z,s[i+6]=l.x,s[i+7]=l.y,s[i+8]=l.z,s[i+9]=h.x,s[i+10]=h.y,s[i+11]=h.z;const u=this.alpha.array,m=this.id.array,c=this.head;u[e]=n,u[e+1]=n,u[e+2]=o,u[e+3]=o,m[e]=c,m[e+1]=c,m[e+2]=c,m[e+3]=c,v(this.pos,this._rp,e*3,12),v(this.alpha,this._ra,e,4),v(this.id,this._ri,e,4),this.head++,this.geometry.setDrawRange(0,Math.min(this.head,this.max)*6),this.material.uniforms.uHead.value=this.head}feed(a,r,l,h,n,o){const t=this.trail[a];if(n<=.02){t.on=!1;return}const e=this._l.copy(r).addScaledVector(l,-h),s=this._r.copy(r).addScaledVector(l,h),i=this.lift;if(i&&(o?(e.addScaledVector(o,i),s.addScaledVector(o,i)):(e.y+=i,s.y+=i)),!t.on){t.on=!0,t.l.copy(e),t.r.copy(s),t.c.copy(r),t.a=n;return}const u=t.c.distanceToSquared(r);if(!(u<this.minSegment*this.minSegment)){if(u>this.maxSegment*this.maxSegment){t.l.copy(e),t.r.copy(s),t.c.copy(r),t.a=n;return}this._quad(t.l,t.r,e,s,t.a*this.opacity,n*this.opacity),t.l.copy(e),t.r.copy(s),t.c.copy(r),t.a=n}}end(a){this.trail[a].on=!1}get count(){return Math.min(this.head,this.max)}clear(){this.head=0,this.geometry.setDrawRange(0,0);for(const a of this.trail)a.on=!1;this.id.array.fill(-1e9),this.id.clearUpdateRanges(),this.id.needsUpdate=!0,this.material.uniforms.uHead.value=0}dispose(){this.geometry.dispose(),this.material.dispose()}}export{T as D};
