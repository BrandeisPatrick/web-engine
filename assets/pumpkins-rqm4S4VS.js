import{c as j}from"./shapes-DT5Gf2uN.js";import{f as K}from"./fracture-Cu1Nusom.js";import{m as Y}from"./TextureSets-CvZAYc7C.js";import{p as Q}from"./Fracture-BUFwht1Q.js";import{N as X}from"./NearestLights-B-kF9obx.js";import{pumpkinGeometry as J,smooth as Z,pumpkinFront as tt}from"./props-g9i9K76n.js";import{patchRibs as et,patchGlow as it}from"./looks-DE7hduwU.js";import{q as V,f as I,e as st,a as N,i as at,M as nt,Q as ot,E as rt,v as lt,V as U,k as ct,j as ht,F as E,K as R,d as ft,N as vt,a2 as ut,L as dt,p as mt}from"./three.module-B_yomNYV.js";import"./state-PuWou6Jb.js";import"./joints-D1pYBk47.js";import"./mathDet-hzMJJDPb.js";import"./xpbd-C5oc9roP.js";import"./DynamicsWorld-fcxBBhha.js";import"./PhysicsWorld-CMLPkGDv.js";import"./spatial-BBDwhacX.js";import"./collision-DGRBXund.js";import"./debug-G1Ks0CNc.js";import"./particles-DeuTLjHR.js";import"./noise-g5kHFeMn.js";import"./BufferGeometryUtils-DLVI-17q.js";const p=.46,A=8,G=.11,pt=26,B=2.8,$=4,O=new lt,M=new ot,wt=new U,gt=new U,q=new rt,S=[0,0,0,1];function yt(){const u=[];for(let t=0;t<=4;t++){const a=t/4,i=a*Math.PI,l=Math.cos(i)*p*.78+.76*p,r=Math.sin(i)*p*.97,n=t===0||t===4?1:8;for(let e=0;e<n;e++){const s=e/n*Math.PI*2+t*.4;u.push(Math.cos(s)*r,l,Math.sin(s)*r)}}return u}const L=.6*p,C=.28*p,W=1.24*p,D=.075;let T=null;function xt(){if(T)return T;const u=516,t=128,a=u/3,i=Y(u,t),l=i.getContext("2d");l.fillStyle="#000",l.fillRect(0,0,u,t),l.fillStyle="#fff";const r=(f,v)=>f*a+(v/1.2+.5)*a,n=f=>t-(f-.28)/.96*t,e=(f,v)=>{l.beginPath(),v.forEach(([o,d],h)=>h?l.lineTo(r(f,o),n(d)):l.moveTo(r(f,o),n(d))),l.closePath(),l.fill()},s=(f,v,o,d,h)=>{l.beginPath(),l.ellipse(r(f,v),n(o),d/1.2*a,h/.96*t,0,0,Math.PI*2),l.fill()},c=(f,v,o,d,h,H,w=0)=>{const b=[];for(let g=0;g<=18;g++){const y=g/18,x=(y-.5)*2;b.push([v+(o-v)*y,d-.1*(1-x*x)+(w&&g%2?w:0)])}for(let g=18;g>=0;g--){const y=g/18,x=(y-.5)*2;b.push([v+(o-v)*y,h+(d-h)*(x*x)*.9-(w&&g%2?w:0)])}e(f,b),l.fillStyle="#000";for(const[g,y,x]of H){const F=(g-(v+o)/2)/((o-v)/2),_=d-.1*(1-F*F);l.fillRect(r(f,g-y/2),n(_+.03),y/1.2*a,(x+.03)/.96*t)}l.fillStyle="#fff"};e(0,[[-.42,.86],[-.1,.86],[-.24,1.12]]),e(0,[[.42,.86],[.1,.86],[.24,1.12]]),e(0,[[-.07,.7],[.07,.7],[0,.82]]),c(0,-.46,.46,.6,.36,[[-.16,.08,.07],[.12,.08,.08]]),s(1,-.24,.96,.13,.15),s(1,.24,.96,.13,.15),e(1,[[-.05,.76],[.05,.76],[0,.84]]),c(1,-.3,.3,.62,.44,[[.08,.06,.06]]),e(2,[[-.44,1.02],[-.1,.9],[-.14,.8],[-.38,.86]]),e(2,[[.44,1.02],[.1,.9],[.14,.8],[.38,.86]]),e(2,[[-.06,.68],[.06,.68],[0,.78]]),c(2,-.48,.48,.58,.34,[],.06);const m=new ft(i);return m.colorSpace=vt,m.wrapS=m.wrapT=ut,m.minFilter=dt,m.magFilter=mt,T=m,m}function Ht(u=.004){const t=tt(p,A,G),a=8,i=6,l=[],r=[],n=[],e=[];for(let c=0;c<=i;c++)for(let m=0;m<=a;m++){const f=-L+2*L*m/a,v=C+(W-C)*c/i,o=t(f,v);l.push(o[0]+o[3]*u,o[1]+o[4]*u,o[2]+o[5]*u),r.push(o[3],o[4],o[5]),n.push(f,v)}for(let c=0;c<i;c++)for(let m=0;m<a;m++){const f=c*(a+1)+m,v=f+1,o=f+a+1,d=o+1;e.push(f,v,d,f,d,o)}const s=new ht;return s.setAttribute("position",new E(l,3)),s.setAttribute("normal",new E(r,3)),s.setAttribute("fuv",new E(n,2)),s.setIndex(e),s}function Mt(u,t=!1){const a=xt();return u.onBeforeCompile=i=>{i.uniforms.tFaceHw={value:a},i.uniforms.uFaceHw={value:new ct(1/(2*L),C,1/(W-C),t?D*1.45:D)},i.vertexShader=i.vertexShader.replace("#include <common>",`#include <common>
attribute vec2 fuv;
attribute float faceVar;
varying vec2 vFuvHw;
varying float vVarHw;
varying vec3 vPosHw;
varying vec3 vTHw;
varying vec3 vBHw;
varying vec3 vNHw;`).replace("#include <project_vertex>",`#include <project_vertex>
  {
    mat3 hwM = mat3( modelViewMatrix );
  #ifdef USE_INSTANCING
    hwM = hwM * mat3( instanceMatrix );
  #endif
    vTHw = hwM * vec3( 1.0, 0.0, 0.0 ); vBHw = hwM * vec3( 0.0, 1.0, 0.0 ); vNHw = hwM * normal;
    vPosHw = mvPosition.xyz; vFuvHw = fuv; vVarHw = faceVar;
  }`),i.fragmentShader=i.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D tFaceHw;
uniform vec4 uFaceHw; // 1 / width, y0, 1 / height (face-plane metres), depth of the cut (m)
varying vec2 vFuvHw;
varying float vVarHw;
varying vec3 vPosHw;
varying vec3 vTHw;
varying vec3 vBHw;
varying vec3 vNHw;
float hwMask( vec2 p ) {
  vec2 uv = clamp( vec2( p.x * uFaceHw.x + 0.5, ( p.y - uFaceHw.y ) * uFaceHw.z ), 0.02, 0.98 );
  return texture2D( tFaceHw, vec2( ( uv.x + vVarHw ) / 3.0, uv.y ) ).r;
}`).replace("#include <color_fragment>",`{
    if ( hwMask( vFuvHw ) < 0.5 ) discard;
    vec3 V = normalize( vPosHw );
    float vn = max( 0.22, - dot( V, normalize( vNHw ) ) );
    vec2 dir = vec2( dot( V, normalize( vTHw ) ), dot( V, normalize( vBHw ) ) ) / vn;
    // march into the cut; where the ray leaves the outline, interpolate the crossing between the two samples
    float hit = 2.0, mPrev = hwMask( vFuvHw );
    for ( int i = 1; i <= ${t?12:6}; i ++ ) {
      float m = hwMask( vFuvHw + dir * uFaceHw.w * float( i ) / ${t?"12.0":"6.0"} );
      if ( hit > 1.5 && m < 0.5 ) hit = ( float( i ) - 1.0 + clamp( ( mPrev - 0.5 ) / max( mPrev - m, 1e-3 ), 0.0, 1.0 ) ) / ${t?"12.0":"6.0"};
      mPrev = m;
    }
    // the cut wall: flesh, dim near the rind's skin, bright toward the candle; past it the glowing inside
    ${t?`// (the remaster) past the wall the HOLLOW: its far side seen through the opening, lit by a candle low in the
    // middle (hot and yellow there, deep orange at the edges and up under the lid), the skin's edge a dark line
    vec2 back = vFuvHw + dir * 0.55;
    float cand = exp( - dot( back - vec2( 0.0, ${(.5*p).toFixed(3)} ), back - vec2( 0.0, ${(.5*p).toFixed(3)} ) ) * 26.0 );
    vec3 hollowC = mix( vec3( 0.75, 0.24, 0.05 ), vec3( 1.0, 0.72, 0.32 ), cand ) * ( 0.55 + 0.6 * cand );
    float edge = smoothstep( 0.0, 0.12, hit );
    diffuseColor.rgb = hit > 1.5 ? hollowC : vec3( 1.0, 0.6, 0.27 ) * mix( 0.04, 0.55, hit * hit ) * edge;`:"diffuseColor.rgb = hit > 1.5 ? vec3( 1.0 ) : vec3( 1.0, 0.62, 0.3 ) * mix( 0.1, 0.5, hit * hit );"}
  }
#include <color_fragment>`)},u.customProgramCacheKey=()=>t?"hwLanternFaceH":"hwLanternFace",u}function bt(u){return u.onBeforeCompile=t=>{t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
attribute vec3 orig;
attribute float flesh;
varying vec3 vOrigHw;
varying vec3 vTanHw;
varying vec3 vRoundHw;
varying float vFleshHw;`).replace("#include <begin_vertex>",`#include <begin_vertex>
  vOrigHw = orig; vFleshHw = flesh;
  vTanHw = normalize( normalMatrix * normalize( vec3( orig.z, 0.0, - orig.x ) + 1e-5 ) );
  vRoundHw = normalize( normalMatrix * vec3( orig.x, ( orig.y - ${(.76*p).toFixed(4)} ) / 0.61, orig.z ) );`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vOrigHw;
varying vec3 vTanHw;
varying vec3 vRoundHw;
varying float vFleshHw;
const float LOBES_HW = ${A.toFixed(1)};
float hwH3( vec3 p ) { return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ); }`).replace("#include <color_fragment>",`#include <color_fragment>
  bool hwFlesh = vFleshHw > 0.5;
  vec3 p = vOrigHw;
  if ( hwFlesh ) {
    // stringy fibres running round the axis, darker toward the rind, and pale seeds in the middle
    float rr = length( p.xz ) / ${p.toFixed(3)};
    float fib = 0.5 + 0.5 * sin( atan( p.x, p.z ) * 23.0 + rr * 31.0 + sin( p.y * 47.0 ) * 1.5 );
    diffuseColor.rgb = vec3( 1.0, 0.68, 0.195 ) * ( 0.82 + 0.18 * fib ) * mix( 1.05, 0.72, smoothstep( 0.55, 0.95, rr ) );
    vec3 q = p * 26.0, cell = floor( q );
    vec3 o = vec3( hwH3( cell ), hwH3( cell + 3.1 ), hwH3( cell + 7.7 ) ) * 0.6 + 0.2;
    vec3 d = ( q - cell - o ) * vec3( 1.0, 1.8, 1.0 );
    float seed = ( 1.0 - smoothstep( 0.1, 0.16, length( d ) ) ) * step( hwH3( cell + 1.3 ), 0.45 ) * ( 1.0 - smoothstep( 0.35, 0.6, rr ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 1.0, 0.95, 0.8 ), seed );
  } else {
    float c = cos( atan( p.x, p.z ) * LOBES_HW * 0.5 );
    diffuseColor.rgb *= ( 0.62 + 0.38 * pow( abs( c ), 0.6 ) ) * ( 0.8 + 0.3 * smoothstep( 0.0, ${p.toFixed(3)}, p.y ) );
  }`).replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
	if ( hwFlesh ) roughnessFactor = 0.85;`).replace("#include <normal_fragment_begin>",`#include <normal_fragment_begin>
  if ( vFleshHw < 0.5 ) {
    float a = atan( vOrigHw.x, vOrigHw.z ) * LOBES_HW * 0.5, c = cos( a ), s = sin( a );
    float slope = - 0.6 * pow( max( abs( c ), 0.05 ), - 0.4 ) * sign( c ) * s; // d lobe / d phase
    vec3 rn = normalize( vRoundHw );
    normal = normalize( ( dot( rn, normal ) > 0.0 ? rn : normal ) - vTanHw * clamp( slope, - 2.5, 2.5 ) * 0.5 );
  }`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
	if ( hwFlesh ) totalEmissiveRadiance = vec3( 1.0, 0.39, 0.03 ) * 0.45; // #ffd77a lit by #ffa830 (linear)`)},u.customProgramCacheKey=()=>"hwShard",u}function Ft(u,t,a){const i=u.attributes.position.array,l=t.shape.offset,r=new Float32Array(i.length);for(let c=0;c<i.length;c+=3)r[c]=i[c]-l[0]+a[0],r[c+1]=i[c+1]-l[1]+a[1],r[c+2]=i[c+2]-l[2]+a[2];u.setAttribute("orig",new R(r,3));const n=new Float32Array(i.length/3),e=u.index.array,s=u.groups[1];if(s)for(let c=s.start;c<s.start+s.count;c++)n[e[c]]=1;return u.setAttribute("flesh",new R(n,1)),u.clearGroups(),u}class Gt{constructor({scene:t,dyn:a,spots:i,heightAt:l,lights:r=5,remaster:n=!1,skin:e=n}){this.dyn=a,this.heightAt=l;const s=this.n=i.length;this.x=new Float32Array(s),this.y=new Float32Array(s),this.z=new Float32Array(s),this.yaw=new Float32Array(s),this.shape=new Float32Array(s*4),this.alive=new Uint8Array(s),this.regrow=new Float32Array(s),this.grow=new Float32Array(s),this.flick=new Float32Array(s),i.forEach(([o,d],h)=>{this.x[h]=o,this.z[h]=d,this.y[h]=l(o,d)-.04,this.yaw[h]=Math.atan2(-o,6-d)+Math.sin(h*12.9)*.6;const H=Math.sin(h*78.233)*43758.5453%1,w=Math.abs(H);this.shape[h*4]=n?.94+.14*Math.abs(Math.sin(h*3.7)):1,this.shape[h*4+1]=n?w<.33?.84:w<.66?1.12:.98:1,this.shape[h*4+2]=n?.96+.08*Math.abs(Math.cos(h*5.1)):1,this.shape[h*4+3]=n&&w>=.66?.07*Math.sign(Math.sin(h*9.1)):0,this.flick[h]=h*1.37}),this.bodyMat=et(it(new V({vertexColors:!0,roughness:n?.42:.5,metalness:0,emissive:"#ff4a00",emissiveIntensity:n?.07:.12}),"hwLanternBody"),A,.5,"hwRibs",e?p:!1);const c=(o,d,h)=>.015+.3*Math.exp(-((o/(.5*p))**2)-((d-.76*p)/(.42*p))**2)*Z(h/(.6*p));this.body=new I(J(p,n?e?72:48:32,0,n?"#e8681c":"#ff7a1a","#5a5a24",{lobes:A,depth:G,vine:!0,glow:c,seed:11,fine:e?28:0}),this.bodyMat,s),this.body.name="lanterns",this.body.castShadow=!0,this.body.receiveShadow=!0,this.faceMat=Mt(new st({color:"#ffffff",polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),e);const m=Ht(e?.016:.004),f=new Float32Array(s);for(let o=0;o<s;o++)f[o]=o%3;m.setAttribute("faceVar",new N(f,1)),this.face=new I(m,this.faceMat,s),this.face.name="lanternFaces",this.face.instanceColor=new N(new Float32Array(s*3),3).setUsage(at),t.add(this.body,this.face),this.lightPos=new Float32Array(s*3),this.pool=new X({count:r,color:16742950,distance:9,decay:1.6,parent:t,lead:6,fade:.3,name:"lanternLight"});const v=j(yt());this.hullC=[-v.offset[0],-v.offset[1],-v.offset[2]],this.variants=[3,17].map(o=>K(v,{pieces:7,seed:o,minFraction:.08}).map(h=>({piece:h,geometry:Ft(Q(h,!0),h,this.hullC)}))),this.shardMat=bt(new V({color:"#ff8a26",roughness:.5,emissive:"#ff6a10",emissiveIntensity:.4})),this.slots=[];for(let o=0;o<$;o++){const d=this.variants[o%this.variants.length],h=[];for(const H of d){const w=new nt(H.geometry,this.shardMat);w.visible=!1,w.castShadow=!0,w.frustumCulled=!1,t.add(w),h.push(w)}this.slots.push({v:d,meshes:h,bodies:new Int32Array(d.length).fill(-1),t:0,active:!1})}this.nextSlot=0;for(let o=0;o<s;o++)this.alive[o]=1;this._sync(!0)}reset(){for(let t=0;t<this.n;t++)this.alive[t]=1,this.regrow[t]=0,this.grow[t]=1;for(const t of this.slots)this._clearSlot(t);this._sync(!0)}_clearSlot(t){for(let a=0;a<t.bodies.length;a++)t.bodies[a]>=0&&this.dyn.removeBody(t.bodies[a]),t.bodies[a]=-1,t.meshes[a].visible=!1;t.active=!1}touching(t,a,i,l){const r=(p+l)*(p+l);for(let n=0;n<this.n;n++){if(!this.alive[n]||this.grow[n]<.8)continue;const e=t-this.x[n],s=i-this.z[n];if(e*e+s*s<r&&a<this.y[n]+p*1.7)return n}return-1}smash(t,a,i,l=1){this.alive[t]=0,this.regrow[t]=pt,this.grow[t]=0;const r=this.slots[this.nextSlot];this.nextSlot=(this.nextSlot+1)%$,this._clearSlot(r);const n=this.x[t],e=this.y[t],s=this.z[t],c=this.yaw[t];M.setFromEuler(q.set(0,c,0)),S[0]=M.x,S[1]=M.y,S[2]=M.z,S[3]=M.w;const m=Math.cos(c),f=Math.sin(c);for(let v=0;v<r.v.length;v++){const o=r.v[v].piece,d=o.offset,h=this.hullC,H=d[0]+h[0],w=d[2]+h[2],b=n+H*m+w*f,P=e+d[1]+h[1],g=s-H*f+w*m,y=this.dyn.addBody({shape:o.shape,position:[b,P,g],quaternion:S,density:350,friction:.7,restitution:.25,linearDamping:.15,angularDamping:.3});if(y<0)continue;const x=b-n,F=P-(e+.76*p),_=g-s,z=Math.hypot(x,F,_)||1,k=2.2*l;this.dyn.setVelocity(y,x/z*k+a*2.5*l,2.4*l+F/z*k+Math.random(),_/z*k+i*2.5*l,(Math.random()-.5)*14,(Math.random()-.5)*14,(Math.random()-.5)*14),r.bodies[v]=y,r.meshes[v].visible=!0,r.meshes[v].scale.setScalar(1)}return r.active=!0,r.t=0,this.lightPos[t*3+1]=-1e3,this._sync(!1),{x:n,y:e+.76*p,z:s}}relightAll(t){let a=!1;for(let i=0;i<this.n;i++)this.alive[i]||(this.alive[i]=1,this.regrow[i]=0,this.grow[i]=.001,a=!0,t&&t(i));a&&this._sync(!1)}fixedUpdate(t){for(const a of this.slots)a.active&&(a.t+=t,a.t>B+.6&&this._clearSlot(a))}update(t,a,i,l){let r=!1;for(let e=0;e<this.n;e++)this.alive[e]?this.grow[e]<1&&(this.grow[e]=Math.min(1,this.grow[e]+t/.7),r=!0):(this.regrow[e]-=t,this.regrow[e]<=0&&(this.alive[e]=1,this.grow[e]=.001,r=!0,l&&l(e)));r&&this._sync(!1);const n=this.face.instanceColor.array;for(let e=0;e<this.n;e++){const s=this.flick[e]+i,c=.82+.1*Math.sin(s*9.1)+.07*Math.sin(s*23.7+1.3)+.05*Math.sin(s*3.3);n[e*3]=5.2*c,n[e*3+1]=2.3*c,n[e*3+2]=.45*c}this.face.instanceColor.needsUpdate=!0;for(const e of this.slots){if(!e.active)continue;const s=e.t>B?Math.min(1,(e.t-B)/.6):0;for(let c=0;c<e.bodies.length;c++){const m=e.bodies[c],f=e.meshes[c];m<0||(this.dyn.getPose(m,f.position,f.quaternion),s>0&&(f.position.y-=s*.3,f.scale.setScalar(Math.max(.001,1-s))))}}this.pool.update(t,a,7.5)}_sync(t){const a=this.lightPos;for(let i=0;i<this.n;i++){const l=this.alive[i]?this.grow[i]:0,r=l<1?Math.max(.001,l*(1+.25*Math.sin(l*Math.PI))):1,n=this.shape,e=i*4;M.setFromEuler(q.set(n[e+3],this.yaw[i],n[e+3]*.6)),O.compose(wt.set(this.x[i],this.y[i],this.z[i]),M,gt.set(r*n[e],r*n[e+1],r*n[e+2])),this.body.setMatrixAt(i,O),this.face.setMatrixAt(i,O),(this.alive[i]||t)&&(a[i*3]=this.x[i],a[i*3+1]=this.alive[i]?this.y[i]+.5:-1e3,a[i*3+2]=this.z[i])}this.body.instanceMatrix.needsUpdate=!0,this.face.instanceMatrix.needsUpdate=!0,t&&(this.body.computeBoundingSphere(),this.face.computeBoundingSphere(),this.pool.setPositions(a))}glow(t,a,i){let l=0;for(let r=0;r<this.n;r++){if(!this.alive[r])continue;const n=this.grow[r],e=this.flick[r]+i,s=(.85+.15*Math.sin(e*7.3))*n;t.set(a+l++,this.x[r],this.y[r]+.42,this.z[r],2.6,.5*s,.2*s,.04*s)}return l}}export{Gt as Lanterns};
