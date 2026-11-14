import{m as I}from"./TextureSets-CvZAYc7C.js";import{P as K}from"./Particles-yvTJP-je.js";import{V as A,e as S,D as F,a as M,f as O,A as P,C as k,M as y,g as _,B as W,h as V,I as X,F as C,i as B,S as q,j as E,d as L,N as Y}from"./three.module-B_yomNYV.js";import"./noise-g5kHFeMn.js";import"./bufferRanges-CPmfb8AL.js";const Z=`
attribute vec3 iPos;
attribute vec4 iData; // rgb (linear, premultiplied intensity), size (m)
uniform vec3 uGlowK; // size scale, intensity scale, falloff power (look())
varying vec2 vUv;
varying vec3 vCol;
void main() {
  vUv = position.xy;
  vec4 mv = modelViewMatrix * vec4( iPos, 1.0 );
  float d = -mv.z;
  float near = smoothstep( 0.4, 2.2, d );            // fade out right in front of the lens
  vCol = iData.rgb * near * uGlowK.y;
  float sz = iData.w * uGlowK.x;
  // pull the quad toward the eye along the view ray (same spot and size on screen) by 0.45 of its size: a halo sits on
  // the grass, and without this the ground cut its lower half off in a hard straight edge (a boxy glow on phones)
  float k = max( 0.3, d - sz * 0.45 ) / max( d, 1e-3 );
  mv.xyz *= k;
  mv.xy += position.xy * sz * k;
  gl_Position = projectionMatrix * mv;
}`,j=`
uniform vec3 uGlowK;
varying vec2 vUv;
varying vec3 vCol;
void main() {
  float r = length( vUv ) * 2.0;
  float a = pow( 1.0 - smoothstep( 0.0, 1.0, r ), uGlowK.z );
  gl_FragColor = vec4( vCol * a, 1.0 );
}`;class et{constructor(e=256,{renderOrder:s=9,name:t="glows"}={}){this.max=e;const o=new X;o.setAttribute("position",new C([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),o.setIndex([0,1,2,0,2,3]),this.pos=new Float32Array(e*3),this.data=new Float32Array(e*4),this.aPos=new M(this.pos,3).setUsage(B),this.aData=new M(this.data,4).setUsage(B),o.setAttribute("iPos",this.aPos),o.setAttribute("iData",this.aData),o.instanceCount=0,this.material=new q({uniforms:{uGlowK:{value:new A(1,1,2)}},vertexShader:Z,fragmentShader:j,transparent:!0,depthWrite:!1,blending:P}),this.mesh=new y(o,this.material),this.mesh.frustumCulled=!1,this.mesh.renderOrder=s,this.mesh.name=t,this.geometry=o}look(e=1,s=1,t=2){return this.material.uniforms.uGlowK.value.set(e,s,t),this}set(e,s,t,o,r,i,l,h){if(e>=this.max)return;const n=e*3,a=e*4;this.pos[n]=s,this.pos[n+1]=t,this.pos[n+2]=o,this.data[a]=i,this.data[a+1]=l,this.data[a+2]=h,this.data[a+3]=r}commit(e){e=Math.min(e,this.max),this.geometry.instanceCount=e,e>0&&(this.aPos.clearUpdateRanges(),this.aPos.addUpdateRange(0,e*3),this.aPos.needsUpdate=!0,this.aData.clearUpdateRanges(),this.aData.addUpdateRange(0,e*4),this.aData.needsUpdate=!0),this.mesh.visible=e>0}}function N(){const e=I(256),s=e.getContext("2d"),t=s.createRadialGradient(256/2,256/2,0,256/2,256/2,256/2);t.addColorStop(0,"rgb(0,0,0)"),t.addColorStop(.6,"rgb(4,4,4)"),t.addColorStop(.82,"rgb(48,48,48)"),t.addColorStop(.94,"rgb(255,255,255)"),t.addColorStop(.97,"rgb(120,120,120)"),t.addColorStop(1,"rgb(0,0,0)"),s.fillStyle=t,s.fillRect(0,0,256,256);const o=new L(e);return o.colorSpace=Y,o}const w=12;class at{constructor({scene:e,heightAt:s,low:t}){this.heightAt=s,this.sparks=new K({max:t?360:900,blending:"additive",gravity:4,drag:1.2,light:2.4,floorAt:s,bounce:.3,name:"sparks"}),e.add(this.sparks.mesh),this.flashes=new Float32Array(w*9),this.nextFlash=0;const o=N(),r=new S({map:o,color:new k(1.3,.6,2.6),transparent:!0,opacity:0,blending:P,depthWrite:!1,side:F});this.ring=new y(new _(1,64).rotateX(-Math.PI/2),r),this.ring.visible=!1,this.ring.renderOrder=10,this.ring.name="booRing",this.ring2=new y(this.ring.geometry,r.clone()),this.ring2.material.color.setRGB(.35,.6,1.6),this.ring2.visible=!1,this.ring2.renderOrder=10,this.ring2.name="booRing2",e.add(this.ring2);const i=new S({color:new k(.5,.25,1),transparent:!0,opacity:0,blending:P,depthWrite:!1,side:W});this.dome=new y(new V(1,24,12,0,Math.PI*2,0,Math.PI/2),i),this.dome.visible=!1,this.dome.renderOrder=10,e.add(this.ring,this.dome),this.booT=1,this.booR=7}burst(e,s,t,o,r,i,l,h=3,n=2,a=.8,d=.12){const v=this.sparks;for(let p=0;p<o;p++){const f=Math.random()*Math.PI*2,c=Math.random()*2-1,u=h*(.4+Math.random()*.6),g=Math.sqrt(1-c*c);v.spawn(e,s,t,Math.cos(f)*g*u,c*u*.6+n,Math.sin(f)*g*u,a*(.6+Math.random()*.6),d,d*.2,1,r,i,l,r*.6,i*.3,l*.5)}}motes(e,s,t,o,r,i,l){const h=this.sparks;for(let n=0;n<o;n++){const a=Math.random()*Math.PI*2,d=Math.random()*.5;h.spawn(e+Math.cos(a)*d,s+Math.random()*.3,t+Math.sin(a)*d,0,.8+Math.random()*1.2,0,.7+Math.random()*.5,.09,.02,1,r,i,l,r,i,l,.5,-.5)}}flash(e,s,t,o,r,i,l,h=.35){const n=this.flashes,a=this.nextFlash*9;this.nextFlash=(this.nextFlash+1)%w,n[a]=e,n[a+1]=s,n[a+2]=t,n[a+3]=o,n[a+4]=r,n[a+5]=i,n[a+6]=l,n[a+7]=h,n[a+8]=0}glow(e,s){const t=this.flashes;let o=0;for(let r=0;r<w;r++){const i=r*9,l=t[i+7];if(!(l>0)||t[i+8]>=l)continue;const h=t[i+8]/l,n=(1-h)*(1-h),a=t[i+3]*(.7+.5*Math.sqrt(h));e.set(s+o++,t[i],t[i+1],t[i+2],a,t[i+4]*n,t[i+5]*n,t[i+6]*n)}return o}boo(e,s,t,o){this.booT=0,this.booR=o,this.ring.position.set(e,s+.08,t),this.ring2.position.set(e,s+.1,t),this.dome.position.set(e,s,t),this.ring.visible=this.dome.visible=!0,this.flash(e,s+.9,t,3.6,.32,.16,.66,.4);for(let r=0;r<40;r++){const i=r/40*Math.PI*2;this.sparks.spawn(e+Math.cos(i)*.6,s+.4,t+Math.sin(i)*.6,Math.cos(i)*o*1.4,.6,Math.sin(i)*o*1.4,.55,.22,.05,1,.8,.45,1.6,.4,.2,1,3,0)}}update(e){this.sparks.update(e);const s=this.flashes;for(let t=0;t<w*9;t+=9)s[t+8]<s[t+7]&&(s[t+8]+=e);if(this.booT<1){this.booT=Math.min(1,this.booT+e/.55);const t=this.booT,o=1-(1-t)*(1-t)*(1-t),r=.6+this.booR*o;this.ring.scale.set(r,1,r),this.ring.material.opacity=.95*(1-t);const i=Math.max(0,(t-.22)/.78),l=1-(1-i)*(1-i),h=.4+this.booR*.72*l;this.ring2.visible=i>0&&t<1,this.ring2.scale.set(h,1,h),this.ring2.material.opacity=.6*(1-i),this.dome.scale.set(r,r*.55,r),this.dome.material.opacity=.35*(1-t)*(1-t),t>=1&&(this.ring.visible=this.ring2.visible=this.dome.visible=!1)}}clear(){this.sparks.clear(),this.booT=1,this.ring.visible=this.ring2.visible=this.dome.visible=!1,this.flashes.fill(0)}}function H(){const m=[],e=[],s=(c,u,g)=>(m.push(c,u,g),e.push(Math.min(1,Math.abs(c)/.62)),m.length/3-1),t=[],o=s(0,.02,.2),r=s(.07,0,0),i=s(0,.02,-.24),l=s(-.07,0,0);t.push(o,r,i,o,i,l);const h=s(.035,0,.17),n=s(.05,0,.27),a=s(.012,0,.2),d=s(-.035,0,.17),v=s(-.05,0,.27),p=s(-.012,0,.2);t.push(h,n,a,d,p,v);for(const c of[1,-1]){const u=s(.06*c,0,.1),g=s(.62*c,0,.05),R=s(.47*c,0,-.14),z=s(.4*c,0,-.06),G=s(.3*c,0,-.2),D=s(.22*c,0,-.1),T=s(.09*c,0,-.16),U=s(.06*c,0,-.08),x=[g,R,z,G,D,T,U];for(let b=0;b<x.length-1;b++)t.push(u,x[b],x[b+1])}const f=new E;return f.setAttribute("position",new C(m,3)),f.setAttribute("flap",new C(e,1)),f.setIndex(t),f}class it{constructor({scene:e,count:s=8,center:t=[26,17,-36],radius:o=14}){this.n=s,this.t=0,this.time={value:0};const r=new A(t[0],t[1],t[2]),i=new S({color:"#07050b",side:F});i.onBeforeCompile=a=>{a.uniforms.uBatT=this.time,a.uniforms.uBatC={value:r},a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float flap;
attribute vec4 batP; // orbit radius, angular speed (signed), phase, height offset
attribute vec2 batS; // size, index
uniform float uBatT;
uniform vec3 uBatC;
vec3 hwRotYXZ( vec3 v, float x, float y, float z ) { // three's Euler 'YXZ': Ry * Rx * Rz
  float c = cos( z ), s = sin( z ); v = vec3( c * v.x - s * v.y, s * v.x + c * v.y, v.z );
  c = cos( x ); s = sin( x ); v = vec3( v.x, c * v.y - s * v.z, s * v.y + c * v.z );
  c = cos( y ); s = sin( y ); return vec3( c * v.x + s * v.z, v.y, - s * v.x + c * v.z );
}`).replace("#include <begin_vertex>",`#include <begin_vertex>
  {
    float i = batS.y, w = sin( uBatT * 15.0 + i * 1.7 );
    transformed.y += flap * ( 0.34 * w + 0.06 ) - ( 1.0 - flap ) * 0.03 * w; // the wings beat
    transformed.x *= 1.0 - 0.18 * flap * max( w, 0.0 );
    // a wobbly loop: an ellipse with a figure-eight drift and a bob; the bat faces along its velocity and banks
    float a = uBatT * batP.y + batP.z, r = batP.x;
    vec3 pos = uBatC + vec3( cos( a ) * r + sin( a * 2.3 + i ) * 2.2, batP.w + sin( a * 3.1 + i ) * 1.2, sin( a ) * r * 0.7 + cos( a * 1.7 + i ) * 1.6 );
    float yaw = atan( - sin( a ) * r * batP.y, cos( a ) * r * 0.7 * batP.y );
    transformed = hwRotYXZ( transformed * batS.x, sin( a * 3.1 + i ) * 0.25, yaw, - cos( a ) * 0.5 * sign( batP.y ) ) + pos;
  }`)},i.customProgramCacheKey=()=>"hwBats";const l=H(),h=new Float32Array(s*4),n=new Float32Array(s*2);for(let a=0;a<s;a++){const d=Math.sin(a*12.9898)*43758.5453,v=d-Math.floor(d);h[a*4]=o*(.45+.55*v),h[a*4+1]=(.28+.2*(a*.37%1))*(a%3===0?-1:1),h[a*4+2]=a*2.39,h[a*4+3]=(v-.5)*7,n[a*2]=1.6+.8*(a*.61%1),n[a*2+1]=a}l.setAttribute("batP",new M(h,4)),l.setAttribute("batS",new M(n,2)),this.mesh=new O(l,i,s),this.mesh.name="bats",this.mesh.frustumCulled=!1,this.mesh.renderOrder=1,e.add(this.mesh)}update(e){this.t=(this.t+e)%3600,this.time.value=this.t}}export{it as Bats,at as Effects,et as Glows};
