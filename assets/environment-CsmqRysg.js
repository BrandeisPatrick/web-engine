import{m as vt}from"./TextureSets-CvZAYc7C.js";import{m as wt,p as lt}from"./noise-g5kHFeMn.js";import{N as rt,m as gt,b as yt,p as tt}from"./Synth-Cczn3Qv-.js";import{G as F,W as st}from"./porch-spots-CU_BlHOe.js";import{LOOK as et}from"./looks-DE7hduwU.js";import{k as N,l as ut,V as O,C as I,j as ft,F as E,a as L,i as ot,m as xt,D as Mt,f as bt,I as mt,S as dt,A as At,M as pt,n as _t,R as kt,o as Ct,p as Bt,L as zt,d as Pt,N as Rt}from"./three.module-B_yomNYV.js";import"./BufferGeometryUtils-DLVI-17q.js";import"./MaterialPatches-ikA35XrI.js";import"./props-g9i9K76n.js";import"./village-BogexNTu.js";import"./rng-DJiNNbuk.js";const z=(p,t,e)=>p<t?t:p>e?e:p,K=p=>p<=0?0:p>=1?1:p*p*(3-2*p),it=(p,t,e)=>p+(t-p)*e,$=.08,Tt=.9,H=new ut(1,.3).normalize(),ct=3e3;function St(){try{return typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches}catch{return!1}}const Ft=`
attribute vec2 fp;  // part (0 leaf, 1 crow), wing flap weight (0 body .. 1 tip)
attribute vec4 lfA; // leaf: seed x, seed height, seed z, size (m)        | crow: perch x, y, z, yaw
attribute vec4 lfB; // leaf: tumble axis (theta, phi), drift factor, phase  | crow: -1
attribute vec4 lfC; // leaf: kicked origin xyz, birth time (-1 ambient, -1e6 unused) | crow: take-off t, return t, away x, z
attribute vec4 lfD; // leaf: kicked velocity xyz, spin (rad/s)              | crow: return-from x, z, seed, size
uniform float uEnvT;
uniform vec3 uLfC;  // leaf field centre (x, ground y, z)
uniform vec4 uLfO;  // integrated wind offset x, fall, z; tumble phase
uniform vec4 uLfP;  // half size (m), height (m), active share, flutter (m)
vec3 lfPos; vec3 lfAx; float lfAng; float lfScl;
vec3 crPos; vec3 crRo; float crFold; float crRate; float crVis;
bool flyCrow; bool flyHide;
vec3 lfRot( vec3 v, vec3 a, float t ) { float c = cos( t ), s = sin( t ); return v * c + cross( a, v ) * s + a * dot( a, v ) * ( 1.0 - c ); }
vec3 crRot( vec3 v, vec3 r ) { // pitch r.x, yaw r.y, roll r.z
  float c = cos( r.z ), s = sin( r.z ); v = vec3( c * v.x - s * v.y, s * v.x + c * v.y, v.z );
  c = cos( r.x ); s = sin( r.x ); v = vec3( v.x, c * v.y - s * v.z, s * v.y + c * v.z );
  c = cos( r.y ); s = sin( r.y ); return vec3( c * v.x + s * v.z, v.y, - s * v.x + c * v.z );
}
void lfPlace() {
  lfAx = vec3( sin( lfB.x ) * cos( lfB.y ), cos( lfB.x ), sin( lfB.x ) * sin( lfB.y ) );
  float ph = lfB.w;
  if ( lfC.w < 0.0 && lfC.w > - 1e5 ) {
    // drifting with the wind through a box around the view, wrapping at its sides (faded there)
    float B = uLfP.x, H = uLfP.y;
    vec3 q = vec3( lfA.x * 2.0 * B, lfA.y * H, lfA.z * 2.0 * B ) + vec3( uLfO.x, - uLfO.y, uLfO.z ) * lfB.z;
    float rx = mod( q.x - uLfC.x + B, 2.0 * B ), rz = mod( q.z - uLfC.z + B, 2.0 * B ), ry = mod( q.y, H );
    lfPos = vec3( uLfC.x - B + rx, uLfC.y + ry, uLfC.z - B + rz );
    lfPos += vec3( sin( uEnvT * 1.3 + ph ), 0.4 * sin( uEnvT * 2.1 + ph * 2.3 ), cos( uEnvT * 1.1 + ph * 1.7 ) ) * uLfP.w;
    float edge = min( min( rx, 2.0 * B - rx ), min( rz, 2.0 * B - rz ) );
    lfScl = lfA.w * smoothstep( 0.0, 2.5, edge ) * smoothstep( 0.0, 0.6, ry ) * smoothstep( H, H - 1.2, ry )
      * step( fract( ph * 7.13 ), uLfP.z );
    lfAng = uLfO.w * ( 0.6 + lfB.z ) + ph;
  } else {
    // kicked up at the kid's feet: thrown, fluttering down, resting a moment, gone
    float tau = uEnvT - lfC.w, life = 1.7;
    float e = ( 1.0 - exp( - 2.4 * tau ) ) / 2.4;
    lfPos = lfC.xyz + lfD.xyz * e;
    lfPos.y = max( lfPos.y - 0.9 * tau * tau, lfC.y + 0.03 );
    lfPos.xz += vec2( sin( tau * 5.0 + ph ), cos( tau * 4.3 + ph ) ) * 0.06 * tau;
    lfScl = tau < 0.0 || tau > life ? 0.0 : lfA.w * smoothstep( 0.0, 0.06, tau ) * smoothstep( life, life - 0.45, tau );
    lfAng = tau * lfD.w + ph;
  }
  lfScl *= smoothstep( 1.6, 4.5, distance( lfPos, cameraPosition ) ); // none drifts across the lens
}
void crPlace() {
  const float RET = 4.5;
  float t = uEnvT, sd = lfD.z, tau = t - lfC.x, rho = ( t - lfC.y ) / RET;
  crPos = lfA.xyz; crRo = vec3( 0.0, lfA.w, 0.0 ); crFold = 1.0; crRate = 0.0; crVis = 1.0;
  if ( tau < 0.0 || rho >= 1.0 ) {
    // perched: looks around now and then, a little hop
    crRo.y += 0.7 * sin( floor( t * 0.4 + sd * 9.0 ) * 2.3 + sd * 17.0 );
    crPos.y += 0.05 * pow( max( 0.0, sin( t * 1.3 + sd * 11.0 ) ), 24.0 );
    crRo.x = - 0.38;
  } else if ( rho < 0.0 ) {
    // flying off: up and away from the kid, accelerating, a weave; gone (far, in the fog) after ~7 s
    vec2 d = lfC.zw;
    float s = 3.2 * tau + 1.7 * tau * tau, h = 1.9 * tau + 0.45 * tau * tau, wv = sin( tau * 2.2 + sd * 7.0 ) * 0.9 * min( tau, 1.0 );
    crPos += vec3( d.x * s - d.y * wv, h, d.y * s + d.x * wv );
    crRo = vec3( 0.35 * exp( - tau * 1.5 ), atan( d.x, d.y ), 0.35 * cos( tau * 2.2 + sd * 7.0 ) );
    crFold = 1.0 - smoothstep( 0.0, 0.12, tau ); crRate = 15.0;
    crVis = smoothstep( 7.0, 5.6, tau );
  } else {
    // gliding home from far off, wings braking at the end
    float u = 1.0 - rho;
    vec2 d = lfD.xy;
    crPos += vec3( d.x * 40.0 * pow( u, 1.4 ), 11.0 * u * u + 0.25 * u, d.y * 40.0 * pow( u, 1.4 ) );
    crRo = vec3( - 0.15 + 0.6 * smoothstep( 0.8, 1.0, rho ), atan( - d.x, - d.y ), 0.25 * sin( rho * 6.0 + sd ) );
    crFold = smoothstep( 0.93, 1.0, rho ); crRate = mix( 6.0, 16.0, smoothstep( 0.75, 0.95, rho ) );
    crVis = smoothstep( 0.0, 0.15, rho );
  }
}
void flyPlace() {
  flyCrow = lfB.x < - 0.5;
  flyHide = ( fp.x > 0.5 ) != flyCrow;
  if ( flyCrow ) crPlace(); else lfPlace();
}
`,Lt=`
  if ( flyHide ) transformed = vec3( 0.0 );
  else if ( flyCrow ) {
    // folded wings tuck along the body; open ones beat
    float w = sin( uEnvT * crRate + lfD.z * 13.0 ), flap = fp.y;
    vec3 v = position;
    v.x = mix( v.x, sign( v.x ) * min( abs( v.x ), 0.06 ) + v.x * 0.04, crFold * step( 0.05, flap ) );
    v.z -= crFold * flap * 0.05;
    v.y += ( 1.0 - crFold ) * flap * ( 0.3 * w + 0.05 ) + crFold * flap * 0.02;
    transformed = crRot( v * lfD.w * crVis, crRo ) + crPos;
  } else transformed = lfRot( position * lfScl, lfAx, lfAng ) + lfPos;
`;function Ot(p,t,e,s){const i=[[0,.5],[.2,.3],[.27,.04],[.2,-.24],[.04,-.42],[0,-.5],[-.04,-.42],[-.2,-.24],[-.27,.04],[-.2,.3]],a=p.length/3;p.push(0,0,0),t.push(0,0,1),e.push(0,0);for(const[r,n]of i)p.push(r,n,-.07*Math.abs(r)/.27),t.push(0,0,1),e.push(0,0);for(let r=0;r<i.length;r++)s.push(a,a+1+r,a+1+(r+1)%i.length)}function Ut(p,t,e,s){const i=p.length/3,a=[],r=[],n=[],h=(w,y,T,C=0)=>(a.push(w,y,T),r.push(C),a.length/3-1),o=(w,y,T)=>n.push(w,y,T),c=h(0,.025,.21),u=h(0,.07,.03),l=h(0,-.055,.03),d=h(-.065,.005,.03),g=h(.065,.005,.03),v=h(0,.015,-.13);o(c,u,g),o(c,g,l),o(c,l,d),o(c,d,u),o(v,g,u),o(v,l,g),o(v,d,l),o(v,u,d);const b=h(-.016,.03,.2),k=h(.016,.03,.2),R=h(0,.012,.29);o(b,k,R);const P=h(-.04,.015,-.12),U=h(.04,.015,-.12),S=h(.075,0,-.3),m=h(-.075,0,-.3);o(P,U,S),o(P,S,m);for(const w of[1,-1]){const y=h(.05*w,.03,.09,.11),T=h(.05*w,.03,-.06,.11),C=h(.22*w,.025,.08,.5),Y=h(.44*w,0,-.04,1),D=h(.38*w,0,-.12,.86),G=h(.26*w,0,-.13,.6);o(y,C,T),o(C,Y,D),o(C,D,G),o(C,G,T)}const M=new ft;M.setAttribute("position",new E(a,3)),M.setIndex(n),M.computeVertexNormals();const A=M.attributes.normal.array;for(let w=0;w<r.length;w++)p.push(a[w*3],a[w*3+1],a[w*3+2]),t.push(A[w*3],A[w*3+1],A[w*3+2]),e.push(1,r[w]);for(const w of n)s.push(i+w);M.dispose()}class Dt{constructor({scene:t,count:e,kick:s,perches:i,crows:a,rng:r,U:n}){this.count=e,this.kick=s,this.next=0;const h=this.crowCount=Math.min(a,i.length),o=e+s+h;this.crowBase=e+s;const c=[],u=[],l=[],d=[];Ot(c,u,l,d),Ut(c,u,l,d);const g=new ft;g.setAttribute("position",new E(c,3)),g.setAttribute("normal",new E(u,3)),g.setAttribute("fp",new E(l,2)),g.setIndex(d);const v=new Float32Array(o*4),b=new Float32Array(o*4),k=new Float32Array(o*4),R=new Float32Array(o*4);for(let m=0;m<this.crowBase;m++)v[m*4]=r(),v[m*4+1]=r(),v[m*4+2]=r(),v[m*4+3]=.15+r()*.11,b[m*4]=r()*Math.PI,b[m*4+1]=r()*Math.PI*2,b[m*4+2]=.7+r()*.6,b[m*4+3]=r()*100,k[m*4+3]=m<e?-1:-1e6;this.perch=i.slice(0,h);for(let m=0;m<h;m++){const M=this.crowBase+m,A=this.perch[m];v[M*4]=A[0],v[M*4+1]=A[1]+.06,v[M*4+2]=A[2],v[M*4+3]=A[3],b[M*4]=-1,k[M*4]=1e6,k[M*4+1]=1e6,R[M*4+2]=r(),R[M*4+3]=1.25+r()*.3}this.aC=new L(k,4).setUsage(ot),this.aD=new L(R,4).setUsage(ot),g.setAttribute("lfA",new L(v,4)),g.setAttribute("lfB",new L(b,4)),g.setAttribute("lfC",this.aC),g.setAttribute("lfD",this.aD),this.u={uLfC:{value:new O},uLfO:{value:new N},uLfP:{value:new N(13,4.5,.5,.3)},uLfFill:{value:.07}};const P=new xt({color:"#ffffff",side:Mt});P.onBeforeCompile=m=>{Object.assign(m.uniforms,this.u,{uEnvT:n}),m.vertexShader=m.vertexShader.replace("#include <common>",`#include <common>
${Ft}`).replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
	flyPlace();
	objectNormal = flyCrow ? crRot( objectNormal, crRo ) : lfRot( objectNormal, lfAx, lfAng );`).replace("#include <begin_vertex>",`#include <begin_vertex>
${Lt}`),m.fragmentShader=m.fragmentShader.replace("#include <common>",`#include <common>
uniform float uLfFill;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
	totalEmissiveRadiance += diffuseColor.rgb * uLfFill;`)},P.customProgramCacheKey=()=>"hwFliers",this.mesh=new bt(g,P,o),this.mesh.name="windLeavesCrows",this.mesh.frustumCulled=!1;const U=new I,S=[[.34,.11,.03],[.5,.21,.04],[.4,.26,.06],[.28,.07,.05],[.55,.34,.08],[.22,.14,.05]];for(let m=0;m<this.crowBase;m++){const M=S[Math.floor(r()*S.length)],A=.8+r()*.4;this.mesh.setColorAt(m,U.setRGB(M[0]*A,M[1]*A,M[2]*A))}for(let m=this.crowBase;m<o;m++)this.mesh.setColorAt(m,U.setRGB(.022,.02,.03));this.mesh.instanceColor.needsUpdate=!0,t.add(this.mesh)}_touch(t){this.aC.addUpdateRange(t*4,4),this.aD.addUpdateRange(t*4,4),this.aC.needsUpdate=this.aD.needsUpdate=!0}spawn(t,e,s,i,a,r,n,h){const o=this.count+this.next;this.next=(this.next+1)%this.kick;const c=this.aC.array,u=this.aD.array,l=o*4;c[l]=e,c[l+1]=s,c[l+2]=i,c[l+3]=t,u[l]=a,u[l+1]=r,u[l+2]=n,u[l+3]=h,this._touch(o)}live(t,e=1.7){let s=0;const i=this.aC.array;for(let a=this.count;a<this.crowBase;a++)t-i[a*4+3]<e&&s++;return s}clearKicks(){const t=this.aC.array;for(let e=this.count;e<this.crowBase;e++)t[e*4+3]=-1e6;this.aC.clearUpdateRanges(),this.aC.needsUpdate=!0}rebase(t,e){const s=this.aC.array;for(let i=this.count;i<this.crowBase;i++)s[i*4+3]=s[i*4+3]>e-10?s[i*4+3]-t:-1e6;this.aC.clearUpdateRanges(),this.aC.needsUpdate=!0}}const Wt=`
attribute vec4 msA; // bank: seed x, seed z, size (m), seed | puff: x, y, z, birth time
attribute vec4 msB; // mode (0 bank, 1 puff), seed, drift speed factor, -
uniform float uEnvT;
uniform vec3 uMsC;  // centre (x, ground y, z)
uniform vec4 uMsO;  // wind offset x, z, half size, -
uniform vec4 uMsK;  // bank amount, puff amount, -, -
uniform vec3 uMsCol, uMsPuff;
varying vec2 vUv;
varying vec3 vCol;
varying vec2 vOff;
void main() {
  vec3 c; float w, h, a;
  if ( msB.x < 0.5 ) {
    float B = uMsO.z;
    float rx = mod( msA.x * 2.0 * B + uMsO.x * msB.z - uMsC.x + B, 2.0 * B ), rz = mod( msA.y * 2.0 * B + uMsO.y * msB.z - uMsC.z + B, 2.0 * B );
    c = vec3( uMsC.x - B + rx, uMsC.y + msA.z * 0.16, uMsC.z - B + rz );
    w = msA.z * 2.3; h = msA.z * 0.62;
    float edge = min( min( rx, 2.0 * B - rx ), min( rz, 2.0 * B - rz ) );
    a = uMsK.x * smoothstep( 0.0, 5.0, edge ) * ( 0.75 + 0.25 * sin( uEnvT * 0.4 + msA.w * 6.0 ) );
    vCol = uMsCol;
  } else {
    float tau = uEnvT - msA.w, life = 3.6;
    c = msA.xyz + vec3( sin( msB.y * 6.3 ) * 0.35 * tau, 0.38 * tau, cos( msB.y * 6.3 ) * 0.35 * tau );
    w = h = 0.9 + 1.1 * tau;
    a = tau < 0.0 || tau > life ? 0.0 : uMsK.y * smoothstep( 0.0, 0.45, tau ) * smoothstep( life, 1.2, tau );
    vCol = uMsPuff;
  }
  vec4 mv = modelViewMatrix * vec4( c, 1.0 );
  float d = - mv.z;
  a *= smoothstep( msB.x < 0.5 ? 4.0 : 1.5, msB.x < 0.5 ? 9.0 : 4.0, d ); // no bank over the lens
  vCol *= a;
  if ( a < 0.002 ) { gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); vUv = vec2( 0.0 ); vOff = vec2( 0.0 ); return; } // (clipped: no fill)
  // pulled toward the eye by part of its height (same place on screen): the ground does not cut a hard edge into it
  float k = max( 0.3, d - h * 0.45 ) / max( d, 1e-3 );
  mv.xyz *= k;
  mv.xy += position.xy * vec2( w, h ) * k;
  vUv = position.xy;
  vOff = vec2( msB.y * 3.7 + uEnvT * 0.012, msB.y * 1.3 );
  gl_Position = projectionMatrix * mv;
}`,It=`
uniform sampler2D tMist;
varying vec2 vUv;
varying vec3 vCol;
varying vec2 vOff;
void main() {
  vec2 q = vUv * 2.0;
  float r = dot( q, q );
  float n = texture2D( tMist, vUv * vec2( 1.4, 0.5 ) + vOff ).r;
  float a = ( 1.0 - smoothstep( 0.15, 1.0, r ) ) * smoothstep( 0.25, 0.75, n );
  gl_FragColor = vec4( vCol * a, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;function Et(){const t=new Uint8Array(16384);for(let s=0;s<64;s++)for(let i=0;i<64;i++){const a=lt(i/64,s/64,4,4,61,.55),r=(s*64+i)*4;t[r]=t[r+1]=t[r+2]=Math.round(255*a),t[r+3]=255}const e=new _t(t,64,64,kt);return e.wrapS=e.wrapT=Ct,e.magFilter=Bt,e.minFilter=zt,e.generateMipmaps=!0,e.needsUpdate=!0,e.name="hwMist",e}class Gt{constructor({scene:t,banks:e,puffs:s,rng:i,U:a}){this.banks=e,this.puffs=s,this.next=0;const r=e+s,n=new mt;n.setAttribute("position",new E([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),n.setIndex([0,1,2,0,2,3]);const h=new Float32Array(r*4),o=new Float32Array(r*4);for(let c=0;c<r;c++){const u=c>=e;u?h[c*4+3]=-1e6:(h[c*4]=i(),h[c*4+1]=i(),h[c*4+2]=2.8+i()*2.6,h[c*4+3]=i()),o[c*4]=u?1:0,o[c*4+1]=i(),o[c*4+2]=.6+i()*.5}this.aA=new L(h,4).setUsage(ot),n.setAttribute("msA",this.aA),n.setAttribute("msB",new L(o,4)),n.instanceCount=r,this.u={uEnvT:a,uMsC:{value:new O},uMsO:{value:new N(0,0,20,0)},uMsK:{value:new N(.3,1,0,0)},uMsCol:{value:new I(.065,.06,.11)},uMsPuff:{value:new I(.075,.12,.1)},tMist:{value:Et()}},this.material=new dt({uniforms:this.u,vertexShader:Wt,fragmentShader:It,transparent:!0,depthWrite:!1,blending:At}),this.mesh=new pt(n,this.material),this.mesh.name="mist",this.mesh.frustumCulled=!1,this.mesh.renderOrder=7,t.add(this.mesh)}pour(t,e,s,i,a,r=5){const n=this.aA.array;for(let h=0;h<r;h++){const o=this.banks+this.next;this.next=(this.next+1)%this.puffs;const c=a()*Math.PI*2,u=a()*.5;n[o*4]=e+Math.cos(c)*u,n[o*4+1]=s+.1,n[o*4+2]=i+Math.sin(c)*u,n[o*4+3]=t+h*.22}this.aA.clearUpdateRanges(),this.aA.addUpdateRange(this.banks*4,this.puffs*4),this.aA.needsUpdate=!0}live(t){let e=0;const s=this.aA.array;for(let i=this.banks;i<this.banks+this.puffs;i++){const a=t-s[i*4+3];a>-1&&a<3.6&&e++}return e}clearPuffs(){const t=this.aA.array;for(let e=this.banks;e<this.banks+this.puffs;e++)t[e*4+3]=-1e6;this.aA.clearUpdateRanges(),this.aA.needsUpdate=!0}rebase(t,e){const s=this.aA.array;for(let i=this.banks;i<this.banks+this.puffs;i++)s[i*4+3]=s[i*4+3]>e-10?s[i*4+3]-t:-1e6;this.aA.clearUpdateRanges(),this.aA.needsUpdate=!0}}const Vt=410,qt=30,Ht=`
attribute vec4 mcA; // span seed 0..1, vertical offset (m), width (m), height (m)
attribute vec4 mcB; // speed factor, uv flip, uv row, appearance threshold
uniform vec3 uMcPos, uMcR, uMcU;
uniform vec4 uMcP;  // phase (m), half span (m), density, -
varying vec2 vUv;
varying float vA;
varying float vProx;
varying vec2 vTM;
void main() {
  float S = uMcP.y;
  float sx = mod( mcA.x * 2.0 * S + uMcP.x * mcB.x, 2.0 * S ) - S;
  vec3 c = uMcPos + uMcR * sx + uMcU * mcA.y;
  vec3 p = c + uMcR * position.x * mcA.z + uMcU * position.y * mcA.w;
  vec2 rel = vec2( sx + position.x * mcA.z, mcA.y + position.y * mcA.w );
  vProx = exp( - dot( rel, rel ) / ( 2.0 * 75.0 * 75.0 ) );
  vA = uMcP.z * smoothstep( S, S * 0.55, abs( sx ) ) * smoothstep( mcB.w, mcB.w + 0.25, uMcP.z );
  vUv = vec2( mcB.y > 0.5 ? 1.0 - uv.x : uv.x, uv.y * 0.5 + mcB.z * 0.5 );
  // toward the moon in texture space (a texel step): the lit edge is the side the moon is behind
  vec2 tm = - rel / max( length( rel ), 1.0 );
  vTM = vec2( tm.x * ( mcB.y > 0.5 ? - 1.0 : 1.0 ) / mcA.z, tm.y * 0.5 / mcA.w ) * 7.0;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
}`,Nt=`
uniform sampler2D tWisp;
uniform vec3 uMcBody, uMcLit, uMcFlash;
varying vec2 vUv;
varying float vA;
varying float vProx;
varying vec2 vTM;
void main() {
  float a = texture2D( tWisp, vUv ).a;
  float lit = clamp( ( a - texture2D( tWisp, vUv + vTM ).a ) * 2.5, 0.0, 1.0 ); // thinning toward the moon: backlit
  vec3 col = uMcBody + uMcLit * ( lit * vProx + 0.06 * vProx ) + uMcFlash * ( 0.4 + 0.6 * a );
  gl_FragColor = vec4( col, a * vA * ( 0.55 + 0.45 * vProx ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;function Kt(){const e=vt(256,128),s=e.getContext("2d"),i=s.createImageData(256,128),a=i.data;for(let n=0;n<128;n++)for(let h=0;h<256;h++){const o=n<64?0:1,c=n%(128/2)/(128/2),u=h/256,l=(u-.5)/.5,d=(c-.5)/.5,g=Math.max(0,1-(l*l*(o?.9:1.1)+d*d*1.4+.25*Math.sin(l*5+o*2)*d)),v=lt(u*2,c*(o?1.3:1)+o*.5,4,5,71+o*9,.55),b=K(z((v-.42)*2.4+g*.9-.15,0,1))*K(Math.min(1,g*2.2))*.95,k=(n*256+h)*4;a[k]=a[k+1]=a[k+2]=255,a[k+3]=Math.round(255*b)}s.putImageData(i,0,0);const r=new Pt(e);return r.colorSpace=Rt,r.name="hwWisps",r}class jt{constructor({scene:t,count:e,rng:s}){this.n=e;const i=new mt;i.setAttribute("position",new E([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3)),i.setAttribute("uv",new E([0,0,1,0,1,1,0,1],2)),i.setIndex([0,1,2,0,2,3]),this.A=new Float32Array(e*4),this.B=new Float32Array(e*4);for(let a=0;a<e;a++)this.A[a*4]=(a+s()*.6)/e,this.A[a*4+1]=(s()-.5)*2*qt*1.6,this.A[a*4+2]=110+s()*70,this.A[a*4+3]=36+s()*24,this.B[a*4]=.75+s()*.5,this.B[a*4+1]=s()<.5?1:0,this.B[a*4+2]=a%2,this.B[a*4+3]=a/e*.55;i.setAttribute("mcA",new L(this.A,4)),i.setAttribute("mcB",new L(this.B,4)),i.instanceCount=e,this.u={uMcPos:{value:new O},uMcR:{value:new O(1,0,0)},uMcU:{value:new O(0,1,0)},uMcP:{value:new N(0,230,.4,0)},tWisp:{value:Kt()},uMcBody:{value:new I(.016,.014,.034)},uMcLit:{value:new I(.5,.5,.62)},uMcFlash:{value:new I(0,0,0)}},this.material=new dt({uniforms:this.u,vertexShader:Ht,fragmentShader:Nt,transparent:!0,depthWrite:!1,fog:!1}),this.mesh=new pt(i,this.material),this.mesh.name="moonClouds",this.mesh.frustumCulled=!1,this.mesh.renderOrder=1.5,t.add(this.mesh),this.cover=0}update(t,e,s,i){const a=this.u,r=Qt.copy(e).sub(t).normalize();a.uMcPos.value.copy(t).addScaledVector(r,Vt),a.uMcR.value.crossVectors(r,Yt).normalize(),a.uMcU.value.crossVectors(a.uMcR.value,r);const n=a.uMcP.value,h=n.y;n.x=s,n.z=i;let o=1;for(let c=0;c<this.n;c++){const u=this.A,l=this.B,d=((u[c*4]*2*h+s*l[c*4])%(2*h)+2*h)%(2*h)-h,g=K((h-Math.abs(d))/(h*.45))*K((i-l[c*4+3])/.25),v=d/(u[c*4+2]*.3),b=u[c*4+1]/(u[c*4+3]*.3);o*=1-.85*i*g*Math.exp(-.5*(v*v+b*b))}return this.cover=1-o}}const Qt=new O,Yt=new O(0,1,0);class $t{constructor(t){this.fly=t,this.n=t.crowCount,this.perch=t.perch,this.base=t.crowBase,this.state=new Uint8Array(this.n),this.t0=new Float64Array(this.n),this.wait=new Float32Array(this.n)}launch(t,e,s,i,a){if(this.state[t]!==0)return!1;const r=this.perch[t],n=this.fly.aC.array,h=(this.base+t)*4;let o=r[0]-s,c=r[2]-i;const u=Math.hypot(o,c)||1,l=Math.atan2(c/u,o/u)+(a()-.5)*1.2;return o=Math.cos(l),c=Math.sin(l),n[h]=e,n[h+1]=e+1e5,n[h+2]=o,n[h+3]=c,this.state[t]=1,this.t0[t]=e,this.wait[t]=9+a()*7,this.fly._touch(this.base+t),!0}update(t,e,s,i){const a=this.fly.aC.array,r=this.fly.aD.array;for(let n=0;n<this.n;n++){const h=this.state[n],o=this.perch[n],c=(this.base+n)*4;if(h===1&&t-this.t0[n]>this.wait[n]){if(Math.hypot(o[0]-e,o[2]-s)<11){this.wait[n]+=3;continue}const u=i()*Math.PI*2;r[c]=Math.cos(u),r[c+1]=Math.sin(u),a[c+1]=t,this.state[n]=2,this.t0[n]=t,this.fly._touch(this.base+n)}else h===2&&t-this.t0[n]>4.6&&(this.state[n]=0)}}get away(){let t=0;for(let e=0;e<this.n;e++)this.state[e]!==0&&t++;return t}reset(){const t=this.fly.aC.array;for(let e=0;e<this.n;e++){const s=(this.base+e)*4;this.state[e]=0,t[s]=1e6,t[s+1]=1e6}this.fly.aC.clearUpdateRanges(),this.fly.aC.needsUpdate=!0}rebase(t){const e=this.fly.aC.array;for(let s=0;s<this.n;s++){const i=(this.base+s)*4;this.t0[s]-=t,e[i]<1e5&&(e[i]-=t),e[i+1]<1e5&&(e[i+1]-=t)}this.fly.aC.clearUpdateRanges(),this.fly.aC.needsUpdate=!0}}function at(p,t,e,s){const i=Math.floor(p.sampleRate*e),a=p.createBuffer(1,i,p.sampleRate),r=a.getChannelData(0);let n=0,h=0,o=0,c=0;for(let l=0;l<i;l++){const d=s()*2-1;t==="pink"?(n=.99765*n+d*.099046,h=.963*h+d*.2965164,o=.57*o+d*1.0526913,r[l]=(n+h+o+d*.1848)*.16):t==="brown"?(c=(c+.02*d)/1.02,r[l]=c*3.5):r[l]=d}const u=Math.min(2048,i>>4);for(let l=0;l<u;l++){const d=l/u;r[i-u+l]=r[i-u+l]*(1-d)+r[l]*d}return a}class Jt{constructor(t,e){this.bus=t,this.rng=e,this.ready=!1,this._t=0,this.live=0,t.onStart(s=>this._build(s))}_build(t){const e=this.rng,s=this.out=this.bus.bus("ambience");this.pink=at(t,"pink",3.1,e),this.brown=at(t,"brown",4.3,e),this.white=at(t,"white",1.3,e),this.gust=new rt(t,{buffer:this.pink,rate:.55,filters:[{type:"bandpass",frequency:480,Q:.8},{type:"lowpass",frequency:1500}],gain:0,out:s}),this.howl=new rt(t,{buffer:this.white,rate:.9,filters:[{type:"bandpass",frequency:640,Q:10}],gain:0,out:s}),this.ready=!0}get ctx(){return this.bus.ctx}running(){return this.ready&&this.ctx.state==="running"}update(t,e,s,i){if(!this.running()||(this._t-=t)>0)return;this._t=.08;const a=this.ctx.currentTime;this.gust.output.gain.setTargetAtTime(.012+.11*s*(.45+.55*i),a,.25),this.gust.filters[0].frequency.setTargetAtTime(330+520*s+160*e,a,.3),this.howl.output.gain.setTargetAtTime(.018*s*s*i,a,.4),this.howl.filters[0].frequency.setTargetAtTime(560+260*s,a,.5)}_burst(t,{peak:e,attack:s,decay:i,filter:a,rate:r=1,when:n=0,pan:h=0}){const o=this.ctx,c=Math.max(o.currentTime,n||o.currentTime),u=o.createBufferSource();u.buffer=t,u.playbackRate.value=r;const l=gt(o,0);l.gain.setValueAtTime(1e-4,c),l.gain.exponentialRampToValueAtTime(Math.max(2e-4,e),c+s),l.gain.exponentialRampToValueAtTime(1e-4,c+s+i),l.gain.setValueAtTime(0,c+s+i+.01);let d=u.connect(yt(o,a)).connect(l);if(h&&o.createStereoPanner){const g=o.createStereoPanner();g.pan.value=z(h,-1,1),d=d.connect(g)}d.connect(this.out),u.start(c,this.rng()*Math.max(0,t.duration-s-i-.1)),u.stop(c+s+i+.05),this.live++,u.onended=()=>{this.live--;try{l.disconnect()}catch{}}}thunder(t,e){if(!this.running())return;const s=this.ctx.currentTime+t,i=.45+.55*e;e>.55&&this._burst(this.white,{peak:.14*i,attack:.004,decay:.4,filter:{type:"highpass",frequency:1400},when:s,pan:(this.rng()-.5)*.8}),this._burst(this.brown,{peak:.55*i,attack:.18,decay:3.2,filter:{type:"lowpass",frequency:150},rate:.75,when:s+.05}),this._burst(this.brown,{peak:.35*i,attack:.3,decay:2.6,filter:{type:"lowpass",frequency:95},rate:.6,when:s+.55})}caw(t,e,s=2){if(!this.running()||e<=.01)return;const i=this.ctx,a=i.currentTime;for(let r=0;r<4;r++)this._burst(this.white,{peak:.05*e,attack:.004,decay:.045,filter:{type:"bandpass",frequency:1700+r*150,Q:1.2},when:a+r*.07,pan:t});for(let r=0;r<s;r++){const n=560+this.rng()*120,h=a+.12+r*(.3+this.rng()*.1);tt(i,this.out,{type:"sawtooth",pitch:[[0,n],[.05,n*1.28],[.2,n*.82]],peak:.05*e,attack:.012,decay:.2,filter:{type:"bandpass",frequency:1250,Q:2.2},pan:t,when:h}),tt(i,this.out,{type:"square",pitch:[[0,n*.5],[.2,n*.42]],peak:.012*e,attack:.012,decay:.16,filter:{type:"lowpass",frequency:900},pan:t,when:h})}}creak(t,e){if(!this.running()||e<=.01)return;const s=88+this.rng()*30;tt(this.ctx,this.out,{type:"sawtooth",pitch:[[0,s],[.28,s*1.45],[.52,s*1.15],[.85,s*1.6]],peak:.045*e,attack:.09,decay:.85,filter:{type:"bandpass",frequency:950,Q:7},pan:t})}}class cs{constructor({scene:t,camera:e,atmo:s,world:i,ghosts:a=null,heightAt:r,low:n=!1,reducedMotion:h=St()}){this.camera=e,this.atmo=s,this.world=i,this.ghosts=a,this.heightAt=r,this.reduced=!!h,this.low=n,this.rng=wt(1592594481),this.U={value:0},this.t=0,this.clock=0,this.storm=$,this.finale=0,this._finaleOn=!1,this.wind=.3,this.gust=0,this._gustAge=9,this._gustLen=4,this._gustAmp=0,this._gustT=2,this.flash=0,this._flashAge=99,this._flashAmp=0,this._flashTwin=!1,this._boltT=12,this.strikes=0,this.flashPeak=0,this.creaks=0,this.blood=0,this.moonCover=0,this._windOff=new N,this._mistOff=new ut,this._cloudPhase=0,this._kidPrev=new O,this._kidHave=!1,this._kickAcc=0,this.kidSpeed=0,this._ghostState=a?a.list.map(u=>u.state):[],this._gate=i.gate.hinges.map(u=>({h:u,a:i.gate.open,v:0,peak:0,creakT:0})),this._blink=new Float32Array(F.MAX),this._blinkT=6;const o=s.sky.material.uniforms,c=s.fogParams;this.base={hemi:s.hemi.intensity,hemiCol:s.hemi.color.clone(),moonI:s.sun.intensity,moonCol:s.sun.color.clone(),scatter:s.scatterColor!==s.sunColor?s.scatterColor.clone():null,cover:o.uCover.value,cop:o.uCloudOpacity.value,ca:o.uCloudAmb.value.clone(),hor:o.uNightHor.value.clone(),skyMoon:o.uMoonCol.value.clone(),cloudWind:s.cloudWind.clone(),haze:c.haze,mist:c.mist,fog:s.fog?s.fog.density:0,disc:i.moonColor.disc.clone(),halo:i.moonColor.halo.clone(),grass:et.wind.value.y},this.leaves=new Dt({scene:t,count:n?150:260,kick:20,perches:i.perches,crows:n?9:12,rng:this.rng,U:this.U}),this.mist=new Gt({scene:t,banks:n?8:14,puffs:20,rng:this.rng,U:this.U}),this.wisps=new jt({scene:t,count:n?4:6,rng:this.rng}),this.crows=new $t(this.leaves),this.sound=null}attachAudio(t){return!this.sound&&t&&(this.sound=new Jt(t,this.rng)),this}setFinale(t){this._finaleOn=!!t}get intensity(){return this.storm}reset(){this.clock=0,this.storm=$,this.finale=0,this._finaleOn=!1,this.gust=0,this._gustAge=9,this._gustT=2,this.flash=0,this._flashAge=99,this._boltT=12,this.flashPeak=0,this.blood=0,this._windOff.set(0,0,0,this._windOff.w),this._kidHave=!1,this._kickAcc=0,this._blink.fill(0),this.crows.reset(),this.leaves.clearKicks(),this.mist.clearPuffs(),this.ghosts&&this.ghosts.list.forEach((t,e)=>{this._ghostState[e]=t.state})}scare(t,e,s=14){let i=0,a=0,r=0;const n=this.crows;for(let h=0;h<n.n;h++){const o=n.perch[h];Math.hypot(o[0]-t,o[2]-e)<s&&n.launch(h,this.t,t,e,this.rng)&&(i++,a+=o[0],r+=o[2])}return i&&this._cawAt(a/i,r/i,i),i}strike(t=.55+this.rng()*.3){this._flashAge=0,this._flashAmp=t,this._flashTwin=!this.reduced&&this.rng()<.6,this.strikes++;const e=this.rng();if(this.sound&&this.sound.thunder(.6+(1-e)*2.6,e),!this.reduced)for(let h=0;h<this.world.glowGroups.length;h++)this.world.glowGroups[h][0]===F.WINDOW&&this.rng()<.6&&(this._blink[h]=.1+this.rng()*.5);const s=this.camera.position,i=this.crows;let a=0,r=0,n=0;for(let h=0;h<i.n;h++){const o=i.perch[h];Math.hypot(o[0]-s.x,o[2]-s.z)<45&&this.rng()<.5&&i.launch(h,this.t,o[0]-1+this.rng()*2,o[2]-1+this.rng()*2,this.rng)&&(a++,r+=o[0],n+=o[2])}a&&this._cawAt(r/a,n/a,a)}_pan(t,e){const s=this.camera,i=s.position,a=s.matrixWorld.elements,r=t-i.x,n=e-i.z,h=Math.hypot(r,n)||1;return{pan:z((r*a[0]+n*a[2])/h,-1,1),d:h}}_cawAt(t,e,s){if(!this.sound)return;const{pan:i,d:a}=this._pan(t,e);this.sound.caw(i*.8,z(1.15-a/40,0,1),Math.min(3,1+s))}update(t,e,s){if(!(t>0))return;const i=this.rng;this.t+=t,this.t>ct+60&&this._rebase(ct);const a=this.t;this.U.value=a,st.time.value=a,this.clock=z(e,0,1),this.finale+=((this._finaleOn?1:0)-this.finale)*(1-Math.exp(-t/1.2));const r=Math.max($+(1-$)*Math.pow(this.clock,1.6),Tt*this.finale);this.storm+=(r-this.storm)*(1-Math.exp(-t/1.5));const n=this.storm;(this._gustT-=t)<=0&&this._gustAge>=this._gustLen&&(this._gustAge=0,this._gustLen=2.6+i()*2.4,this._gustAmp=(.35+.65*i())*(.45+.75*n),this._gustT=this._gustLen+it(6,1.2,n)*(.5+i())),this._gustAge+=t;const h=this._gustAge/this._gustLen,o=h<1?Math.pow(Math.sin(Math.PI*h),2):0;this.gust=this._gustAmp*o;const c=.5+.5*Math.sin(a*.37)*Math.sin(a*.23+1);this.wind=.25+.45*n+.18*c+this.gust;const u=this.reduced?.4:1,l=this.wind,d=this.gust;et.wind.value.y=Math.min(.78,this.base.grass*.6+.36*l*u+.1),st.sway.value.set(H.x,H.y,(.03+.12*l)*u,(.04+.3*d+.08*n)*u);const g=(1+4.6*l)*(this.reduced?.45:1),v=this._windOff;v.x+=H.x*g*t,v.z+=H.y*g*t,v.y+=(.45+.35*l)*t*(this.reduced?.6:1),v.w+=t*(.8+2.4*l)*(this.reduced?.5:1),(Math.abs(v.x)>4e3||Math.abs(v.z)>4e3)&&(v.x=v.z=0);const b=this.camera.position,k=this.camera.matrixWorld.elements;let R=-k[8],P=-k[10];const U=Math.hypot(R,P)||1;R/=U,P/=U;const S=this.heightAt(s.x,s.z),m=this.leaves.u;if(m.uLfC.value.set(b.x+R*8,S-.2,b.z+P*8),m.uLfO.value.copy(v),m.uLfP.value.set(13,4.5,z((.42+.58*n)*(this.reduced?.6:1),0,1),(.18+.3*l)*u),this._kidHave){const x=s.x-this._kidPrev.x,f=s.z-this._kidPrev.z,B=s.y-this._kidPrev.y,V=Math.hypot(x,f)/t;if(this.kidSpeed=V<15?V:0,this.kidSpeed>3.2&&Math.abs(B)<.08)for(this._kickAcc+=t*6.5*(this.kidSpeed/6);this._kickAcc>=1;){this._kickAcc-=1;const q=i()*Math.PI*2,X=x/t,Z=f/t;this.leaves.spawn(a,s.x+Math.cos(q)*.25,S+.05,s.z+Math.sin(q)*.25,X*.3+Math.cos(q)*1.1,1.7+i()*1.2,Z*.3+Math.sin(q)*1.1,(i()-.5)*14)}else this._kickAcc=0}this._kidPrev.copy(s),this._kidHave=!0;const M=this.atmo.fogParams;M.mist=this.base.mist*(1+1.05*n),M.haze=this.base.haze*(1+.55*n),this.atmo.fog&&(this.atmo.fog.density=this.base.fog*(1+.5*n)),this._mistOff.x+=H.x*(.35+1.1*l)*t*u,this._mistOff.y+=H.y*(.35+1.1*l)*t*u;const A=this.mist.u;if(A.uMsC.value.set(b.x+R*12,S,b.z+P*12),A.uMsO.value.set(this._mistOff.x,this._mistOff.y,20,0),A.uMsK.value.set(.25+.6*n,1,0,0),this.ghosts){const x=this.ghosts.list;for(let f=0;f<x.length;f++){const B=x[f],V=this._ghostState[f];B.state==="rise"&&V!=="rise"&&this.mist.pour(a,B.x,this.heightAt(B.x,B.z),B.z,i),this._ghostState[f]=B.state}}const w=this.atmo.sky.material.uniforms,y=this.base;w.uCover.value=y.cover+.24*n,w.uCloudOpacity.value=Math.min(.97,y.cop+.06*n),this.atmo.cloudWind.copy(y.cloudWind).multiplyScalar((1+2.2*l)*(this.reduced?.5:1)),this._cloudPhase+=t*(5+30*l*l)*(this.reduced?.4:1),this._cloudPhase>1e5&&(this._cloudPhase-=460*100);const T=this.moonCover=this.wisps.update(b,this.world.moon.position,this._cloudPhase,z(.3+.62*n,0,1));this.blood=Math.max(K((this.clock-.9)/.075),this.finale);const C=this.blood;this.world.moonColor.disc.copy(y.disc).lerp(W.setRGB(1.15,.2,.11),C).multiplyScalar(1-.72*T),this.world.moonColor.halo.copy(y.halo).lerp(W.setRGB(1.25,.16,.1),C).multiplyScalar((1-.7*T)*(1+.25*C)),w.uMoonCol.value.copy(y.skyMoon).lerp(W.setRGB(1.6,.42,.3),C),this.atmo.sun.intensity=y.moonI*(1-.45*T)*(1-.12*n),this.atmo.sun.color.copy(y.moonCol).lerp(W.setRGB(.95,.5,.5),.65*C),y.scatter&&this.atmo.scatterColor.copy(y.scatter).lerp(W.setRGB(1,.36,.3),C);const Y=this.wisps.u;if(Y.uMcLit.value.setRGB(.5,.5,.62).lerp(W.setRGB(.62,.22,.18),C),n>.32){if((this._boltT-=t)<=0){this.strike();const x=z((n-.32)/.68,0,1);this._boltT=(this.finale>.5?5+i()*5:it(34,8,x)*(.65+.7*i()))*(this.reduced?1.6:1)}}else this._boltT=Math.max(this._boltT,4+i()*6);this._flashAge+=t;const D=this._flashAge,G=(x,f,B)=>x<0?0:x<f?K(x/f):Math.exp(-3*(x-f)/B);let _=this.reduced?.35*G(D,.4,1.1):Math.max(G(D,.07,.32),this._flashTwin?.6*G(D-.24,.06,.36):0);_*=this._flashAmp,D>3&&(_=0),this.flash=_,_>this.flashPeak&&(this.flashPeak=_),this.atmo.hemi.intensity=y.hemi*(1-.14*n)+1.05*_,this.atmo.hemi.color.copy(y.hemiCol).lerp(W.setRGB(.72,.78,1),z(_*1.4,0,1)),w.uCloudAmb.value.setRGB(y.ca.r+.24*_,y.ca.g+.26*_,y.ca.b+.38*_),w.uNightHor.value.setRGB(y.hor.r+.07*_,y.hor.g+.075*_,y.hor.b+.12*_),Y.uMcFlash.value.setRGB(.3*_,.32*_,.45*_);const j=this.crows;j.update(a,s.x,s.z,i);const J=this.kidSpeed>3?6.5:this.kidSpeed>.5?4.2:2.4;let Q=0,nt=0,ht=0;for(let x=0;x<j.n;x++){const f=j.perch[x];j.state[x]===0&&Math.abs(f[0]-s.x)<J&&Math.abs(f[2]-s.z)<J&&Math.hypot(f[0]-s.x,f[2]-s.z)<J&&j.launch(x,a,s.x,s.z,i)&&(Q++,nt+=f[0],ht+=f[2])}Q&&this._cawAt(nt/Q,ht/Q,Q),this._lights(t,a,n,d);for(let x=0;x<this._gate.length;x++){const f=this._gate[x],B=(.04+.24*d+.05*n)*u,V=this.world.gate.open-.1+B*(.65*Math.sin(a*.83+x*2.1)+.35*Math.sin(a*2.1+x)),q=f.v;if(f.v+=((V-f.a)*9-f.v*2.2)*t,f.a+=f.v*t,f.creakT-=t,f.peak=Math.max(f.peak,Math.abs(f.v)),Math.sign(f.v)!==Math.sign(q)){if(this.sound&&f.peak>.16&&f.creakT<=0){f.creakT=1.4+i()*1.4,this.creaks++;const{pan:X,d:Z}=this._pan(f.h[0],f.h[2]);this.sound.creak(X*.7,z(1.1-Z/28,0,1)*z(f.peak*2.5,.3,1))}f.peak=0}}this.world.gate.set(this._gate[0].a,this._gate[1].a),this.sound&&this.sound.update(t,l,d,n)}_lights(t,e,s,i){const a=this.world.glowGroups,r=this.world.glowLevels,n=this.reduced,h=z(.25*s+.9*i,0,1)*(n?.4:1);if(!n&&s>.45&&(this._blinkT-=t)<=0){this._blinkT=it(9,2.5,(s-.45)/.55)*(.5+this.rng());const o=1+Math.floor(this.rng()*(a.length-1));a[o][0]===F.WINDOW&&(this._blink[o]=.12+this.rng()*.4)}for(let o=0;o<a.length;o++){const[c,u]=a[o];let l=1;c===F.FLAME?(l=1-u*(.12+.1*Math.sin(e*9.3+o*2.1)+.06*Math.sin(e*23.1+o))*(1+1.4*h),n||(l*=1-.5*h*Math.pow(Math.max(0,Math.sin(e*6.1+o*5.3)*Math.sin(e*2.9+o)),3))):c===F.WINDOW?(l=1-u*.06*Math.sin(e*.7+o),this._blink[o]>0&&(this._blink[o]-=t,l*=.12+.2*Math.max(0,Math.sin(e*24+o)))):c===F.BREW?l=.86+.14*Math.sin(e*1.7+o)+.18*s:c===F.EMBER?l=.85+.1*Math.sin(e*5.1+o)+.08*Math.sin(e*13.3+o)+.35*i:c===F.LAMP&&(l=1-u*(.04+.03*Math.sin(e*3.1+o*1.7))),r[o]=Math.max(.15,l)}}_rebase(t){this.leaves.rebase(t,this.t),this.mist.rebase(t,this.t),this.crows.rebase(t),this.t-=t}stats(){const t=this.atmo.fogParams,e=this.atmo.sky.material.uniforms,s=this.world.glowLevels;let i=1,a=1;for(let r=0;r<this.world.glowGroups.length;r++)i=Math.min(i,s[r]),this.world.glowGroups[r][0]===F.WINDOW&&(a=Math.min(a,s[r]));return{clock:+this.clock.toFixed(3),storm:+this.storm.toFixed(3),finale:+this.finale.toFixed(3),wind:+this.wind.toFixed(3),gust:+this.gust.toFixed(3),mist:+t.mist.toFixed(4),haze:+t.haze.toFixed(5),cover:+e.uCover.value.toFixed(3),moonCover:+this.moonCover.toFixed(3),blood:+this.blood.toFixed(3),flash:+this.flash.toFixed(3),flashPeak:+this.flashPeak.toFixed(3),strikes:this.strikes,grass:+et.wind.value.y.toFixed(3),sway:+st.sway.value.w.toFixed(3),leafSpeed:+((1+4.6*this.wind)*(this.reduced?.45:1)).toFixed(2),leavesActive:+this.leaves.u.uLfP.value.z.toFixed(3),kicked:this.leaves.live(this.t),puffs:this.mist.live(this.t),crowsAway:this.crows.away,crows:this.crows.n,glowMin:+i.toFixed(3),windowMin:+a.toFixed(3),creaks:this.creaks,sounds:this.sound?this.sound.live:0,cloudPhase:+this._cloudPhase.toFixed(2),leafDrift:+Math.hypot(this._windOff.x,this._windOff.z).toFixed(2),reduced:this.reduced,t:+this.t.toFixed(2)}}}const W=new I;export{cs as Environment,St as prefersReducedMotion};
