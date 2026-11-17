import{S as xe}from"./three.module-Dt1S_jJM.js";import{a as W}from"./BufferGeometryUtils-Cm1sGGAi.js";import{dq as Pe,z as be,df as F,i as B,dt as J,dC as Ee,em as G,M as Ue,bI as Le,V as Re,C as we,eK as He,D as Ve,cV as Oe,k as ke,j as Te,ad as Ze}from"./three.core-BG5Iv3B7.js";const je={value:0},ee=3.35,w=3.6,m=5.4,E=(c,s,e)=>{const n=Math.min(1,Math.max(0,(e-c)/(s-c)));return n*n*(3-2*n)};function $e(c){let s=c>>>0;return()=>{s=s+1831565813>>>0;let e=s;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}const q=c=>{const s=Math.floor(c),e=c-s,n=p=>{const g=Math.sin(p*127.1)*43758.5453;return g-Math.floor(g)},S=e*e*(3-2*e);return n(s)*(1-S)+n(s+1)*S};function et(c){const s=c.rows,e=$e(c.seed??911),n=c.lod==="low",S=s.map(t=>t.z),p=Math.min(...S)+60,g=Math.max(...S)-60,U=4,N=Math.floor((g-p)/U)+1,L=new Float64Array(N),ye=t=>{let a=s[0];for(const r of s)Math.abs(r.z-t)<Math.abs(a.z-t)&&(a=r);return a},te=new Float64Array(N);for(let t=0;t<N;t++)te[t]=ye(p+t*U).x0+(c.offset??30);for(let t=0;t<N;t++){let a=0,r=0;for(let d=-10;d<=10;d++){const o=t+d;o>=0&&o<N&&(a+=te[o],r++)}L[t]=a/r}const b=t=>{const a=Math.min(N-1.001,Math.max(0,(t-p)/U)),r=Math.floor(a),d=a-r;return L[r]*(1-d)+L[r+1]*d},H=t=>(b(t+2)-b(t-2))/4,Ae=(p+g)/2,v=c.crestZ??Ae,Se=[[v,2.5,46],[v-260,1.1,55],[v+240,.9,60],[v-520,1.4,70],[v+470,1,50]],ze=t=>.38+.15*Math.sin(t*.013),De=t=>{let a=ze(t);for(const[r,d,o]of Se)a+=d*Math.exp(-(((t-r)/o)**2));return a},Me=t=>1.8+1.2*q(t*.018)+.6*q(t*.07+3),V=(t,a)=>(t-b(a))/Math.sqrt(1+H(a)**2),Ne=(t,a)=>{const r=c.sandHeight(t,a);return Number.isFinite(r)?r:.1},z=(t,a)=>{if(a<p||a>g)return-1/0;const r=V(t,a);if(r<-16||r>30)return-1/0;const d=De(a);if(Math.abs(r)<=w)return d+.03*(1-(r/w)**2);if(Math.abs(r)<=m)return d-.06*(Math.abs(r)-w)/(m-w);const o=Ne(t,a);if(r<0){const i=E(-m,-15,r);return d-.06+(o-d)*i+.45*Math.sin(Math.PI*i)*E(-m,-8,r)}const l=Math.max(d+.4,o+Me(a)),u=E(m,11,r),f=1-E(14,30,r);return Math.max(o,(d-.06)*(1-u)+l*u*f+o*u*(1-f))},Ce=(t,a)=>{if(a<p||a>g)return null;const r=Math.abs(V(t,a));return r<=w?"road":r<=m+.8?"gravel":null},k=new Pe;k.name="dune-road";const ae=[-16,-13,-10,-8,-6.6,-m,-w,-ee,-1.7,0,1.7,ee,w,m,6.6,8,10,12,14,17,20,24,30],re=Math.floor((g-p)/2)+1,se=[],ne=[],oe=[],de=[],ie=[];for(let t=0;t<re;t++){const a=p+t*2,r=b(a),d=H(a),o=1/Math.sqrt(1+d*d);for(const l of ae){const u=r+l*o,f=z(u,a);se.push(u,f+(Math.abs(l)<=m?.02:.03),a),oe.push(l,a);const i=Math.abs(l)<=w?0:Math.abs(l)<=m+.6?1:2;de.push(i);const h=i===0?[1,1,1]:i===1?[.2,.17,.14]:l<0?[.11,.1,.07]:[.16,.14,.09];ne.push(h[0],h[1],h[2])}}const O=ae.length;for(let t=0;t<re-1;t++)for(let a=0;a<O-1;a++){const r=t*O+a,d=r+1,o=r+O,l=o+1;ie.push(r,o,d,d,o,l)}const D=new be;D.setAttribute("position",new F(se,3)),D.setAttribute("color",new F(ne,3)),D.setAttribute("uv",new F(oe,2)),D.setAttribute("aZone",new F(de,1)),D.setIndex(ie),D.computeVertexNormals();const ce=Xe(c.asphalt),T=new B(D,ce);T.name="dune-road-surface",T.receiveShadow=!0,k.add(T);const Ke=new J(1,0),le=n?1400:5200,R=new Ee(Ke,new G({color:16777215,roughness:.92,metalness:0,name:"stones"}),le),ue=new Ue,fe=new He,pe=new Le,Be=new Re,x=new Re,Ge=new we;let _=0;for(let t=0;t<le;t++){const a=p+e()*(g-p),r=e()<.55?1:-1,d=r*(w+.2+Math.pow(e(),1.6)*(r>0?6.5:4.5)),o=b(a)+d,l=z(o,a);if(!Number.isFinite(l))continue;const u=.03+Math.pow(e(),3)*.14;pe.set(e()*6,e()*6,e()*6),fe.setFromEuler(pe),ue.compose(x.set(o,l+u*.25,a),fe,Be.set(u*(1+e()),u*(.5+e()*.4),u*(1+e()))),R.setMatrixAt(_,ue);const f=.06+e()*.08;R.setColorAt(_,Ge.setRGB(f*1.05,f*.95,f*.85)),_++}R.count=_,R.castShadow=!n,R.receiveShadow=!0,R.name="dune-stones",R.instanceMatrix.needsUpdate=!0,R.instanceColor&&(R.instanceColor.needsUpdate=!0),k.add(R);const I=[],Z=[],_e=[[v-40,15,3.6],[v-70,12,2.4],[v+30,17,2.8],[v-150,13,3.2],[v-330,16,4.2],[v+180,14,2.6],[v-470,12,3]];for(const[t,a,r]of _e)if(!(t<p||t>g))for(let d=0;d<3;d++){const o=t+(e()-.5)*r*2,l=a+(e()-.5)*r,u=b(o)+l,f=z(u,o),i=r*.7*(.55+e()*.5),h=new J(1,n?1:3),A=h.attributes.position;for(let K=0;K<A.count;K++){x.fromBufferAttribute(A,K);const Q=.7+.45*q(x.x*2.1+d*7+x.y*3.3)+.15*q(x.z*6.3+x.y*5.1)+.06*q(x.x*17+x.z*13);x.multiplyScalar(Q),x.y*=.5,A.setXYZ(K,x.x,x.y,x.z)}h.computeVertexNormals(),h.scale(i,i,i*(.8+e()*.5)),h.rotateY(e()*6),h.translate(u,f+i*.08,o),I.push(h),Z.push([u-i*.8,f-1,u+i*.8,f+i,o-i*.8,o+i*.8])}if(I.length){const t=new B(W(I),new G({color:3814188,roughness:.95,metalness:0,name:"coralRock"}));t.castShadow=!0,t.receiveShadow=!0,t.name="dune-rocks",k.add(t)}const he=[],me=n?160:520;for(let t=0;t<me;t++){const a=p+e()*(g-p),d=e()<.6?-(m+2+e()*9):m+7+e()*18,o=b(a)+d,l=z(o,a);if(!Number.isFinite(l))continue;const u=2+Math.floor(e()*3),f=.3+e()*.55;for(let i=0;i<u;i++){const h=new J(f*(.5+e()*.6),n?0:1);h.scale(1,.5+e()*.3,1),h.translate(o+(e()-.5)*f*1.6,l+f*.45+e()*f*.5,a+(e()-.5)*f*1.6),he.push(h.index?h.toNonIndexed():h)}}const P=new B(W(he.map(t=>(t.deleteAttribute("uv"),t))),new G({color:1909780,roughness:.9,flatShading:!0,name:"scrub"}));P.castShadow=!n,P.receiveShadow=!0,P.name="dune-scrub",k.add(P);const ve=[],ge=n?2500:9e3;for(let t=0;t<ge;t++){const a=p+e()*(g-p),d=e()<.4?-(m+.5+e()*9):m+.8+e()*20,o=b(a)+d,l=z(o,a);if(!Number.isFinite(l))continue;const u=.25+e()*.5;for(let f=0;f<4;f++){const i=e()*Math.PI*2,h=.2+e()*.3,A=.022,K=o+Math.cos(i)*h*u,Q=a+Math.sin(i)*h*u;ve.push(o-Math.sin(i)*A,l,a+Math.cos(i)*A,o+Math.sin(i)*A,l,a-Math.cos(i)*A,K,l+u*(.8+e()*.4),Q)}}const j=new be;j.setAttribute("position",new F(ve,3)),j.computeVertexNormals();const $=new B(j,new G({color:4867110,roughness:.9,side:Ve,name:"dunegrass"}));$.name="dune-grass2",$.receiveShadow=!0,k.add($);const y=v+34,M=b(y)-(m+.9),C=z(M,y),Fe=new Oe(.07,.11,7.2,8).translate(M,C+3.6,y),qe=new ke(1.6,.08,.1).translate(M+.8,C+7.1,y),X=new B(W([Fe,qe].map(t=>(t.deleteAttribute("uv"),t.index?t.toNonIndexed():t))),new G({color:1710618,roughness:.6,metalness:.5})),Y=new B(new ke(.55,.12,.26).translate(M+1.55,C+7,y),new Te({color:new we(2.2,1.55,.9),name:"duneLampHead"}));X.name="dune-lamp",Y.name="dune-lamp-head",X.castShadow=!0,k.add(X,Y);const Ie={x:M+1.55,y:C+6.85,z:y,mat:Y.material};return Z.push([M-.15,C-1,M+.15,C+7,y-.15,y+.15]),{group:k,heightAt:z,surfaceAt:Ce,start:(t=70,a=ee/2)=>{const r=v+t,d=H(r),o=Math.sqrt(1+d*d),l=-d/o,u=-1/o,f=-u,i=l;return{x:b(r)+f*a,z:r+i*a,heading:Math.atan2(-l,-u),dir:[l,u],right:[f,i]}},colliders:Z,lamp:Ie,xAt:b,zCrest:v,z0:p,z1:g,mat:ce,half:w,shoulder:m,lateral:V,stats:{length:Math.round(g-p),stones:_,rocks:I.length,bushes:me,grass:ge}}}function tt(c,s){const e=[s.diff,s.nor,s.rough];s.road&&e.push(s.road.diff,s.road.nor,s.road.rough),s.bank&&e.push(s.bank.diff,s.bank.nor,s.bank.rough,s.bank.disp);for(const n of e)n&&(n.wrapS=n.wrapT=Ze,n.anisotropy=8,n.needsUpdate=!0);s.nor.repeat.set(1/1.5,1/1.5),c.userData.scan=s,c.userData.u=Object.fromEntries(e.filter(Boolean).map((n,S)=>[`t${S}`,{value:n}])),c.normalMap=s.nor,c.normalScale.set(1,1),c.envMapIntensity=1.9,c.needsUpdate=!0}function Xe(c){const s=new G({vertexColors:!0,roughness:.9,metalness:0,name:"duneRoad"});return c&&c.map&&(s.map=c.map),s.userData.uDusk={value:1},s.userData.uPx={value:1},s.userData.uDetail={value:1},s.onBeforeCompile=e=>{const n=s.userData.scan;e.uniforms.uDusk=s.userData.uDusk,e.uniforms.uPx=s.userData.uPx,e.uniforms.uDetail=s.userData.uDetail,n&&(Object.assign(e.uniforms,{uScanDiff:{value:n.diff},uScanRough:{value:n.rough},uScanNor:{value:n.nor}}),e.defines={...e.defines||{},SCAN:1},n.road&&(Object.assign(e.uniforms,{uAspD:{value:n.road.diff},uAspN:{value:n.road.nor},uAspR:{value:n.road.rough}}),e.defines.ROADSCAN=1),n.bank&&(Object.assign(e.uniforms,{uBnkD:{value:n.bank.diff},uBnkN:{value:n.bank.nor},uBnkR:{value:n.bank.rough},uBnkH:{value:n.bank.disp}}),e.defines.BANKSCAN=1)),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
attribute float aZone; varying float vZone; varying vec2 vRd;`).replace("#include <uv_vertex>",`#include <uv_vertex>
vZone = aZone; vRd = uv;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
varying float vZone; varying vec2 vRd;
uniform float uDusk, uPx, uDetail;
float dh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dh(i), dh(i + vec2(1, 0)), f.x), mix(dh(i + vec2(0, 1)), dh(i + vec2(1, 1)), f.x), f.y); }
float dfbm(vec2 p) { return dn(p) * 0.5 + dn(p * 2.1) * 0.25 + dn(p * 4.3) * 0.125 + dn(p * 8.7) * 0.0625; }
#ifdef SCAN
uniform sampler2D uScanDiff, uScanRough, uScanNor;
#endif
#ifdef ROADSCAN
uniform sampler2D uAspD, uAspN, uAspR;
#endif
#ifdef BANKSCAN
uniform sampler2D uBnkD, uBnkN, uBnkR, uBnkH;
#endif
// grass density (identical to roadside.js grassDensity: sine-free value noise in corridor coordinates)
float gh2(vec2 q) { vec3 p3 = fract(vec3(q.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gvn(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh2(i), gh2(i + vec2(1.0, 0.0)), f.x), mix(gh2(i + vec2(0.0, 1.0)), gh2(i + vec2(1.0, 1.0)), f.x), f.y); }
float grassDensity(float d, float z) { return gvn(vec2(d / 6.0, z / 9.0)) * 0.7 + gvn(vec2(d / 2.3 + 17.0, z / 3.1)) * 0.3; }
float scanK = 0.0, cAsp = 0.0, cGrav = 0.0, cBank = 0.0, cFlat = 0.0, cPaint = 0.0;
vec2 bankUv = vec2(0.0);`).replace("#include <map_fragment>",`
float roadK = 1.0 - step(0.5, vZone), gravK = step(0.5, vZone) * (1.0 - step(1.5, vZone));
float dRd = vRd.x, zRd = vRd.y;
// each zone's work below runs only where its weight is non-zero; a texture read inside such a branch would get
// undefined implicit derivatives where a 2x2 quad straddles two zones (wrong-mip speckles), so the uv derivatives are
// taken here, outside every branch, and the branched reads pass them to textureGrad scaled as their uv is
vec2 gx = dFdx(vRd), gy = dFdy(vRd);
#ifndef ROADSCAN
#ifdef USE_MAP
vec4 sampledDiffuseColor = texture2D(map, vec2(dRd, zRd) / 6.0);
#else
vec4 sampledDiffuseColor = vec4(vec3(0.3), 1.0);
#endif
#endif
float dRough = 0.88;
{
  float ad = abs(dRd);
  float aa = fwidth(dRd) * 0.8 + 0.004;   // (outside the branches: a derivative)
  float bankK = 1.0 - roadK - gravK;
  float aspK = 0.0;
  if (roadK > 0.0) {
    // the asphalt's edge crumbles into the shoulder: a ragged boundary 0.2-0.6 m inside the geometric edge
    float rag = dn(vec2(zRd * 1.7, dRd * 3.0)) * 0.4 + dn(vec2(zRd * 6.0, dRd)) * 0.2;
    aspK = roadK * (1.0 - smoothstep(3.0 - rag, 3.15 - rag, ad));
  }
  // ---- asphalt (asp / rAsp / cPaint only ever count multiplied by aspK)
  vec3 asp = vec3(0.0); float rAsp = 0.0;
  if (aspK > 0.0) {
#ifndef ROADSCAN
  float agg = dfbm(vec2(dRd, zRd) * 3.0);
  asp = vec3(0.15, 0.125, 0.11) * (0.75 + 0.5 * agg) * mix(vec3(1.0), sampledDiffuseColor.rgb * 2.2, 0.35);
#endif
#ifdef ROADSCAN
  // the 2k scan at its 3 m tile, a 0.9 m detail octave (holds from 1 m) and a 25 m macro variation (holds from afar)
  vec3 a3 = textureGrad(uAspD, vec2(dRd, zRd) / 3.0, gx / 3.0, gy / 3.0).rgb, a1 = vec3(0.3);
  if (uDetail > 0.5) a1 = textureGrad(uAspD, vec2(zRd, -dRd) / 0.9, vec2(gx.y, -gx.x) / 0.9, vec2(gy.y, -gy.x) / 0.9).rgb;
  float macro = dfbm(vec2(dRd, zRd) / 25.0);
  asp = a3 * (0.7 + 0.6 * dot(a1, vec3(0.333)) / 0.3) * (0.8 + 0.4 * macro) * vec3(0.92, 0.88, 0.84);
  float ar = textureGrad(uAspR, vec2(dRd, zRd) / 3.0, gx / 3.0, gy / 3.0).r;
#else
  float ar = 0.9;
#endif
  float patchN = dfbm(vec2(dRd * 0.35, zRd * 0.06));
  asp *= mix(1.0, 0.75, smoothstep(0.55, 0.6, patchN));
  // rectangular repair patches (darker, smoother), crack lines, tar-sealed seams (black, glossy)
  vec2 pc = vec2(dRd / 2.6, zRd / 5.0), pi = floor(pc), pf = fract(pc);
  float patchR = step(0.82, dh(pi + 3.7)) * step(0.12, pf.x) * step(pf.x, 0.88) * step(0.1, pf.y) * step(pf.y, 0.8);
  asp = mix(asp, asp * 0.6, patchR);
  float crack = 1.0 - smoothstep(0.0, 0.025, abs(dn(vec2(dRd * 1.3, zRd * 0.35)) - 0.5) - 0.002);
  asp *= 1.0 - 0.35 * crack * smoothstep(0.4, 0.7, dfbm(vec2(dRd, zRd) * 0.5));
  float seamX = abs(abs(dRd + 0.15 * sin(zRd * 0.07)) - 1.75) , seamZ = abs(fract(zRd / 11.0 + 0.1 * dn(vec2(dRd, 3.0))) - 0.5) * 11.0;
  float seam = max(1.0 - smoothstep(0.03, 0.03 + aa * 2.0, seamX), (1.0 - smoothstep(0.025, 0.025 + aa * 2.0, seamZ)) * step(ad, 3.2)) * step(0.35, dn(vec2(zRd * 0.05, dRd * 0.2)));
  asp = mix(asp, vec3(0.025, 0.022, 0.02), seam * 0.85);
  // polished wheel tracks: smoother, a touch darker, slightly damp-looking toward the afterglow (not a mirror)
  float lane = ad - 1.68, track = 1.0 - smoothstep(0.25, 0.55, abs(abs(lane) - 0.8));
  track *= 0.7 + 0.3 * dn(vec2(zRd * 0.2, dRd));
  asp *= 1.0 - 0.12 * track;
  rAsp = mix(mix(0.82, 0.95, ar), 0.42, track * 0.85);
  rAsp = mix(rAsp, 0.66, patchR); rAsp = mix(rAsp, 0.35, seam);
  // the double yellow: thick paint, worn through to the aggregate in places, broken into lengths with gaps
  float wear = smoothstep(0.25, 0.7, dfbm(vec2(dRd * 4.0, zRd * 0.9)));
#ifdef ROADSCAN
  wear *= smoothstep(0.15, 0.4, dot(a1, vec3(0.333)));   // the paint sits on the aggregate's high points
#endif
  float broken = smoothstep(0.3, 0.42, dn(vec2(zRd * 0.09, dRd > 0.0 ? 1.0 : 7.0)));
  float yl = (1.0 - smoothstep(0.05 - aa, 0.05 + aa, abs(ad - 0.11))) * (0.3 + 0.65 * wear) * broken;
  asp = mix(asp, vec3(0.5, 0.35, 0.08), yl); rAsp = mix(rAsp, 0.6, yl); cPaint = yl;
  }
  // ---- gravel shoulder (and where the asphalt has crumbled)
  float gK = gravK + roadK - aspK;   // gravel where the asphalt has gone
  vec3 grav = vec3(0.0); float rGrav = 0.9;
#ifdef SCAN
  // the rubble runs on 3-4 m past the shoulder before the soil takes over (wider on the dune side)
  float spill = 0.0;
  if (bankK > 0.0) spill = bankK * (1.0 - smoothstep(5.6, dRd > 0.0 ? 9.5 : 7.5, ad + 1.2 * dn(vec2(zRd * 0.15, dRd))));
  vec3 gRaw = vec3(0.0);   // one read of the gravel scan, for the shoulder and the spill
  if (gK > 0.0 || spill > 0.0) {
    gRaw = textureGrad(uScanDiff, vec2(dRd, zRd) / 1.5, gx / 1.5, gy / 1.5).rgb;
    if (gK > 0.0) {
      grav = mix(vec3(dot(gRaw, vec3(0.3, 0.55, 0.15))), gRaw, 0.55) * vec3(0.82, 0.8, 0.76);   // the coral scan muted toward limestone grey
      rGrav = textureGrad(uScanRough, vec2(dRd, zRd) / 1.5, gx / 1.5, gy / 1.5).r;
    }
  }
#else
  vec2 gp = vec2(dRd, zRd) * 9.0;
  float peb = smoothstep(0.55, 0.75, dn(gp)) * (0.6 + 0.4 * dn(gp * 2.7));
  grav = vec3(0.09, 0.08, 0.07) + vec3(0.16, 0.14, 0.12) * peb;
#endif
  vec3 col = aspK * asp + gK * grav + (1.0 - roadK - gravK) * vec3(1.0);
  dRough = aspK * rAsp + gK * rGrav + (1.0 - roadK - gravK) * 0.92;
  diffuseColor.rgb *= col;
  // dirt / sand blown over the edges of the asphalt
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.19, 0.15), aspK * smoothstep(2.4, 3.1, ad) * 0.45);
  if (bankK > 0.0) {
    float gv = dfbm(vec2(dRd, zRd) * 0.4);
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.85, 0.7) + 0.4 * gv, bankK);
  }
  cAsp = aspK; cGrav = gK;
#ifdef SCAN
  if (bankK > 0.0) {
    vec3 bs = textureGrad(uScanDiff, vec2(dRd, zRd) / 4.0, gx / 4.0, gy / 4.0).rgb;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.45 + 1.1 * bs), bankK * 0.85);
  }
#ifdef BANKSCAN
  vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);   // (outside the branch: derivatives)
  // the bank / dune face: a sand-and-rock scan with parallax relief (4 steps along the view ray in tangent space)
  if (bankK > 0.0) {
    float pxK = uPx * (1.0 - smoothstep(22.0, 30.0, length(vViewPosition)));   // relief only where it can be seen
    vec2 s0 = gx, s1 = gy;
    vec3 Nn = normalize(vNormal), q1p = cross(q1, Nn), q0p = cross(Nn, q0);
    vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
    float sc = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12)); T *= sc; B *= sc;
    vec3 V = normalize(vViewPosition);
    vec2 dir = vec2(dot(V, T), dot(V, B)) / max(dot(V, Nn), 0.25);
    vec2 uv0 = vec2(dRd, zRd) / 4.5, pStep = -dir * 0.12 / 4.5 / 3.0;   // 12 cm of relief, 3 steps, within 30 m
    // (these reads keep their implicit derivatives, as before the zones were branched: this block always was inside
    // this branch, and the marched uv's own derivatives pick the mip the relief was tuned with)
    float hz = 1.0, h = texture2D(uBnkH, uv0).r; vec2 uv = uv0;
    for (int i = 0; i < 3; i++) { if (h >= hz || pxK < 0.5) break; hz -= 0.3333; uv += pStep; h = texture2D(uBnkH, uv).r; }
    bankUv = uv;
    vec3 bd = texture2D(uBnkD, uv).rgb * (0.5 + 0.6 * smoothstep(0.1, 0.7, h));   // crevices darker
    diffuseColor.rgb = mix(diffuseColor.rgb, bd * vec3(1.05, 0.98, 0.9), bankK * 0.95);
    dRough = mix(dRough, texture2D(uBnkR, uv).r, bankK);
    cBank = bankK;
  }
#endif
  if (spill > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, gRaw * vec3(0.85, 0.8, 0.75), spill);
  cGrav = max(cGrav, spill); cBank *= 1.0 - spill;
  scanK = 1.0;
  // the ground under dense grass: darker and tinted (thatch, humus), so tufts do not sit on bright dirt
  if (roadK < 1.0 && ad >= 3.8) {   // (where (1 - roadK) * step(3.8, ad) is non-zero)
    float gDen = smoothstep(0.35, 0.75, grassDensity(dRd, zRd)) * (1.0 - roadK) * step(3.8, ad);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.6, 0.48), gDen * 0.8);
  }
  // dusk only: the scans carry real albedo; lift the corridor so it reads like the reference's roadside in low light
  diffuseColor.rgb *= mix(1.0, mix(1.65, 2.1, 1.0 - roadK), uDusk);
#endif
}`).replace("#include <color_fragment>",`#if defined(SCAN) && defined(USE_COLOR)
  diffuseColor.rgb *= mix(vColor, vec3(1.0), cBank * 0.9);   // (vertex colour after the map stage: keep it off the scanned bank)
#else
#include <color_fragment>
#endif`).replace("#include <normal_fragment_maps>",`
#ifdef SCAN
{
  // per-zone tangent-space normals: asphalt (two scales, flattened on the tracks), gravel, bank (parallax uv)
  // (each zone's normal read only where its weight is non-zero, with the map stage's gradients: see there)
  vec3 mapN = vec3(0.0);
  if (cGrav > 0.0) {
    vec3 nG = textureGrad(uScanNor, vec2(dRd, zRd) / 1.5, gx / 1.5, gy / 1.5).xyz * 2.0 - 1.0;
    mapN = nG * cGrav;
  }
#ifdef ROADSCAN
  if (cAsp > 0.0) {
  vec3 nA = textureGrad(uAspN, vec2(dRd, zRd) / 3.0, gx / 3.0, gy / 3.0).xyz * 2.0 - 1.0;
  if (uDetail > 0.5) { vec3 nA1 = textureGrad(uAspN, vec2(zRd, -dRd) / 0.9, vec2(gx.y, -gx.x) / 0.9, vec2(gy.y, -gy.x) / 0.9).xyz * 2.0 - 1.0; nA.xy = nA.xy + nA1.yx * vec2(1.0, -1.0) * 0.6; }
  float lane2 = abs(dRd) - 1.68, track2 = 1.0 - smoothstep(0.25, 0.55, abs(abs(lane2) - 0.8));
  nA.xy *= 1.0 - 0.6 * track2;
  // the paint's thickness: flatter on the line, a ridge at its edges
  nA.xy = mix(nA.xy, vec2(0.0), cPaint * 0.7);
  mapN += nA * cAsp;
  }
#else
  mapN += vec3(0.0, 0.0, 1.0) * cAsp;
#endif
#ifdef BANKSCAN
  if (cBank > 0.0) mapN += (textureGrad(uBnkN, bankUv, gx / 4.5, gy / 4.5).xyz * 2.0 - 1.0) * cBank;
#endif
  mapN += vec3(0.0, 0.0, 1.0) * max(0.0, 1.0 - cAsp - cGrav - cBank);
  mapN.xy *= normalScale;
  normal = normalize(tbn * normalize(mapN));
}
#else
#include <normal_fragment_maps>
#endif`).replace("#include <roughnessmap_fragment>",xe.roughnessmap_fragment.replace("float roughnessFactor = roughness;","float roughnessFactor = dRough;")+`
#ifdef ENGINE_GBUFFER
engineGbRoughness = max(roughnessFactor, 0.6); // no screen-space reflections on the corridor: its sheen is the environment's
#endif`).replace("#include <lights_fragment_begin>",xe.lights_fragment_begin.replace("#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )",`vec3 drSpec0 = reflectedLight.directSpecular;
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )`).replace("#if ( NUM_RECT_AREA_LIGHTS > 0 )",`reflectedLight.directSpecular = drSpec0 + ( reflectedLight.directSpecular - drSpec0 ) * mix( 1.0, 0.33, uDuskFill );
#if ( NUM_RECT_AREA_LIGHTS > 0 )`)).replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
reflectedLight.directSpecular *= 0.45;`),e.uniforms.uDuskFill=je,e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
uniform float uDuskFill;`)},s.envMapIntensity=.6,s.customProgramCacheKey=()=>{const e=s.userData.scan;return`miami-dune-road-${c&&c.map?1:0}-${e?1:0}${e&&e.road?"r":""}${e&&e.bank?"b":""}`},s}export{je as DUSK_FILL,et as buildDuneRoad,tt as setCorridorScan};
