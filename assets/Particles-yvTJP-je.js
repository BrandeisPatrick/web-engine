import{V as S,I as V,F as z,a as _,i as A,S as P,A as D,ag as k,aZ as U,a_ as I,M as L,d as q,s as F}from"./three.module-B_yomNYV.js";import{n as M,t as w}from"./bufferRanges-CPmfb8AL.js";function j(n){if(!n)return 1;const t=n.darkness||0;if(t>.5)return 0;const i=n.sun&&n.sunIntensity>0?n.sun.intensity/n.sunIntensity:1-t;return(i<0?0:i>1?1:i)*(1-t)}const B=`
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iData;   // size, alpha, rotation, -
attribute vec3 iColor;
uniform float uStreak;
uniform float uLight;
varying vec2 vUv;
varying float vAlpha;
varying vec3 vColor;
#include <fog_pars_vertex>
void main() {
	vUv = uv;
	vec4 mvPosition = modelViewMatrix * vec4( iPos, 1.0 );
	vec2 q = position.xy;
	float size = iData.x;
	if ( uStreak > 0.0 ) {
		vec2 d = ( modelViewMatrix * vec4( iVel, 0.0 ) ).xy;
		float l = length( d );
		vec2 dir = l > 1e-4 ? d / l : vec2( 1.0, 0.0 );
		vec2 nrm = vec2( - dir.y, dir.x );
		float len = size + l * uStreak;
		mvPosition.xy += dir * ( q.x - 0.5 ) * len + nrm * q.y * size;
	} else {
		float c = cos( iData.z ), s = sin( iData.z );
		mvPosition.xy += vec2( c * q.x - s * q.y, s * q.x + c * q.y ) * size;
	}
	vAlpha = iData.y;
	vColor = iColor * uLight;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`,E=`
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
}`;let x=null;function R(){if(x)return x;const n=document.createElement("canvas");n.width=n.height=64;const t=n.getContext("2d"),i=t.createRadialGradient(32,32,0,32,32,32);return i.addColorStop(0,"rgba(255,255,255,1)"),i.addColorStop(.4,"rgba(255,255,255,0.45)"),i.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=i,t.fillRect(0,0,64,64),x=new q(n),x.colorSpace=F,x}class O{constructor(t={}){const i=this.max=t.max??1024;this.count=0,this.gravity=t.gravity??0,this.drag=t.drag??0,this.floor=t.floor??-1/0,this.floorAt=typeof t.floorAt=="function"?t.floorAt:null,this.bounce=t.bounce??.35,this.fadeInTime=t.fadeIn??.12,this.spin=t.spin??1.2,this.lit=!!t.lit,this.litAmbient=t.litAmbient??.15,this.sunSource=typeof t.sun=="number"?null:t.sun||null,this.sunFactor=typeof t.sun=="number"?t.sun:1,this._light=t.light??1;const s=h=>new Float32Array(i*h);this.p=s(3),this.v=s(3),this.age=s(1),this.life=s(1),this.s0=s(1),this.s1=s(1),this.a0=s(1),this.rot=s(1),this.rotV=s(1),this.c=s(3),this.c1=s(3),this.dragA=s(1),this.grav=s(1);const r=new V;r.setAttribute("position",new z([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),r.setAttribute("uv",new z([0,0,1,0,1,1,0,1],2)),r.setIndex([0,1,2,0,2,3]),this.aPos=new _(s(3),3).setUsage(A),this.aVel=new _(s(3),3).setUsage(A),this.aData=new _(s(4),4).setUsage(A),this.aColor=new _(s(3),3).setUsage(A),r.setAttribute("iPos",this.aPos),r.setAttribute("iVel",this.aVel),r.setAttribute("iData",this.aData),r.setAttribute("iColor",this.aColor),r.instanceCount=0,this.geometry=r,this.material=new P({uniforms:U.merge([I.fog,{uMap:{value:null},uStreak:{value:t.streak??0},uLight:{value:t.light??1}}]),vertexShader:B,fragmentShader:E,transparent:!0,depthWrite:!1,fog:!0,blending:(t.blending??"additive")==="additive"?D:k}),this.material.uniforms.uMap.value=t.map||R(),this.mesh=new L(r,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=t.renderOrder??8,this.mesh.name=t.name||"particles",this.mesh.visible=!1,this._r3=[M(),M(),M()],this._r4=M()}spawn(t,i,s,r,h,m,f,p,b,v,d,l,a,e=d,o=l,u=a,C=this.drag,y=this.gravity){if(this.count>=this.max)return-1;const g=this.count++,c=g*3;return this.p[c]=t,this.p[c+1]=i,this.p[c+2]=s,this.v[c]=r,this.v[c+1]=h,this.v[c+2]=m,this.age[g]=0,this.life[g]=Math.max(.001,f),this.s0[g]=p,this.s1[g]=b,this.a0[g]=v,this.rot[g]=Math.random()*6.283,this.rotV[g]=(Math.random()*2-1)*this.spin,this.c[c]=d,this.c[c+1]=l,this.c[c+2]=a,this.c1[c]=e,this.c1[c+1]=o,this.c1[c+2]=u,this.dragA[g]=C,this.grav[g]=y,g}emit(t){return this.spawn(t.x,t.y,t.z,t.vx,t.vy,t.vz,t.life,t.size0,t.size1??t.size0,t.alpha??1,t.r??1,t.g??1,t.b??1,t.r1??t.r??1,t.g1??t.g??1,t.b1??t.b??1,t.drag??this.drag,t.gravity??this.gravity)}_kill(t){const i=--this.count;if(t===i)return;const s=t*3,r=i*3;for(let h=0;h<3;h++)this.p[s+h]=this.p[r+h],this.v[s+h]=this.v[r+h],this.c[s+h]=this.c[r+h],this.c1[s+h]=this.c1[r+h];this.age[t]=this.age[i],this.life[t]=this.life[i],this.s0[t]=this.s0[i],this.s1[t]=this.s1[i],this.a0[t]=this.a0[i],this.rot[t]=this.rot[i],this.rotV[t]=this.rotV[i],this.dragA[t]=this.dragA[i],this.grav[t]=this.grav[i]}update(t){const i=this.p,s=this.v,r=this.floor,h=this.bounce,m=this.floorAt;for(let a=0;a<this.count;a++){if(this.age[a]+=t,this.age[a]>=this.life[a]){this._kill(a),a--;continue}const e=a*3,o=Math.exp(-this.dragA[a]*t);s[e]*=o,s[e+1]=s[e+1]*o-this.grav[a]*t,s[e+2]*=o,i[e]+=s[e]*t,i[e+1]+=s[e+1]*t,i[e+2]+=s[e+2]*t;const u=m?m(i[e],i[e+2]):r;i[e+1]<u&&(i[e+1]=u,s[e+1]=Math.abs(s[e+1])*h,s[e]*=.6,s[e+2]*=.6),this.rot[a]+=this.rotV[a]*t}const f=this.count,p=this.aPos.array,b=this.aVel.array,v=this.aData.array,d=this.aColor.array;for(let a=0;a<f;a++){const e=a*3,o=a*4,u=this.age[a]/this.life[a];p[e]=i[e],p[e+1]=i[e+1],p[e+2]=i[e+2],b[e]=s[e],b[e+1]=s[e+1],b[e+2]=s[e+2];const C=this.fadeInTime>0?Math.min(1,this.age[a]/this.fadeInTime):1;v[o]=this.s0[a]+(this.s1[a]-this.s0[a])*Math.sqrt(u),v[o+1]=this.a0[a]*C*(1-u)*(1-u),v[o+2]=this.rot[a];for(let y=0;y<3;y++)d[e+y]=this.c[e+y]+(this.c1[e+y]-this.c[e+y])*u}const l=Math.max(1,f);w(this.aPos,this._r3[0],0,l*3),w(this.aVel,this._r3[1],0,l*3),w(this.aColor,this._r3[2],0,l*3),w(this.aData,this._r4,0,l*4),this.geometry.instanceCount=f,this.mesh.visible=f>0,this.lit&&this._applyLight()}get sunLevel(){const t=this.sunSource,i=typeof t=="function"?t():t?j(t):this.sunFactor;return i<0?0:i>1?1:i||0}_applyLight(){const t=this.lit?this.litAmbient+(1-this.litAmbient)*this.sunLevel:1;this.material.uniforms.uLight.value=this._light*t}get light(){return this._light}set light(t){this._light=t,this._applyLight()}clear(){this.count=0,this.geometry.instanceCount=0,this.mesh.visible=!1}dispose(){this.geometry.dispose(),this.material.dispose()}}class N{constructor(t,i={}){this.system=t,this.rate=i.rate??30,this.position=(i.position||new S).clone(),this.velocity=(i.velocity||new S(0,1,0)).clone(),this.spread=i.spread??1,this.jitter=i.jitter??0,this.life=i.life||[1,2],this.size=i.size||[.5,1.5],this.alpha=i.alpha??1,this.color=i.color||[1,1,1],this.colorEnd=i.colorEnd||this.color,this.drag=i.drag,this.gravity=i.gravity,this.enabled=i.enabled!==!1,this._acc=0}update(t){if(!this.enabled)return 0;this._acc+=this.rate*t;let i=0;const s=this.system,r=this.position,h=this.velocity,m=this.color,f=this.colorEnd,p=this.drag??s.drag,b=this.gravity??s.gravity;for(;this._acc>=1;){this._acc-=1;let v,d,l,a;do v=Math.random()*2-1,d=Math.random()*2-1,l=Math.random()*2-1,a=v*v+d*d+l*l;while(a>1||a<1e-6);const e=this.jitter,o=this.spread,u=this.life[0]+Math.random()*(this.life[1]-this.life[0]);if(s.spawn(r.x+(Math.random()-.5)*2*e,r.y+(Math.random()-.5)*2*e,r.z+(Math.random()-.5)*2*e,h.x+v*o,h.y+d*o,h.z+l*o,u,this.size[0],this.size[1],this.alpha,m[0],m[1],m[2],f[0],f[1],f[2],p,b)<0){this._acc=0;break}i++}return i}}export{O as P,j as a,N as b,R as s};
