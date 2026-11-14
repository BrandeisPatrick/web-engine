import{H as _e,j as xe,F,M as B,b5 as W,f as Oe,q as G,v as Ve,E as Ze,V as be,C as we,Q as Ee,D as He,x as Ie,w as Re,e as Ue,o as je,u as Te}from"./three.module-B_yomNYV.js";import{m as J}from"./BufferGeometryUtils-DLVI-17q.js";const ee=3.35,R=3.6,m=5.4,V=(c,r,e)=>{const o=Math.min(1,Math.max(0,(e-c)/(r-c)));return o*o*(3-2*o)};function Le(c){let r=c>>>0;return()=>{r=r+1831565813>>>0;let e=r;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}const P=c=>{const r=Math.floor(c),e=c-r,o=p=>{const g=Math.sin(p*127.1)*43758.5453;return g-Math.floor(g)},z=e*e*(3-2*e);return o(r)*(1-z)+o(r+1)*z};function We(c){const r=c.rows,e=Le(c.seed??911),o=c.lod==="low",z=r.map(t=>t.z),p=Math.min(...z)+60,g=Math.max(...z)-60,Z=4,S=Math.floor((g-p)/Z)+1,E=new Float64Array(S),ke=t=>{let a=r[0];for(const s of r)Math.abs(s.z-t)<Math.abs(a.z-t)&&(a=s);return a},te=new Float64Array(S);for(let t=0;t<S;t++)te[t]=ke(p+t*Z).x0+(c.offset??30);for(let t=0;t<S;t++){let a=0,s=0;for(let d=-10;d<=10;d++){const n=t+d;n>=0&&n<S&&(a+=te[n],s++)}E[t]=a/s}const b=t=>{const a=Math.min(S-1.001,Math.max(0,(t-p)/Z)),s=Math.floor(a),d=a-s;return E[s]*(1-d)+E[s+1]*d},H=t=>(b(t+2)-b(t-2))/4,ye=(p+g)/2,v=c.crestZ??ye,Ae=[[v,2.5,46],[v-260,1.1,55],[v+240,.9,60],[v-520,1.4,70],[v+470,1,50]],ze=t=>.38+.15*Math.sin(t*.013),Ne=t=>{let a=ze(t);for(const[s,d,n]of Ae)a+=d*Math.exp(-(((t-s)/n)**2));return a},De=t=>1.8+1.2*P(t*.018)+.6*P(t*.07+3),I=(t,a)=>(t-b(a))/Math.sqrt(1+H(a)**2),Me=(t,a)=>{const s=c.sandHeight(t,a);return Number.isFinite(s)?s:.1},N=(t,a)=>{if(a<p||a>g)return-1/0;const s=I(t,a);if(s<-16||s>30)return-1/0;const d=Ne(a);if(Math.abs(s)<=R)return d+.03*(1-(s/R)**2);if(Math.abs(s)<=m)return d-.06*(Math.abs(s)-R)/(m-R);const n=Me(t,a);if(s<0){const i=V(-m,-15,s);return d-.06+(n-d)*i+.45*Math.sin(Math.PI*i)*V(-m,-8,s)}const l=Math.max(d+.4,n+De(a)),u=V(m,11,s),f=1-V(14,30,s);return Math.max(n,(d-.06)*(1-u)+l*u*f+n*u*(1-f))},Se=(t,a)=>{if(a<p||a>g)return null;const s=Math.abs(I(t,a));return s<=R?"road":s<=m+.8?"gravel":null},k=new _e;k.name="dune-road";const ae=[-16,-13,-10,-8,-6.6,-m,-R,-ee,-1.7,0,1.7,ee,R,m,6.6,8,10,12,14,17,20,24,30],se=Math.floor((g-p)/2)+1,re=[],oe=[],ne=[],de=[],ie=[];for(let t=0;t<se;t++){const a=p+t*2,s=b(a),d=H(a),n=1/Math.sqrt(1+d*d);for(const l of ae){const u=s+l*n,f=N(u,a);re.push(u,f+(Math.abs(l)<=m?.02:.03),a),ne.push(l,a);const i=Math.abs(l)<=R?0:Math.abs(l)<=m+.6?1:2;de.push(i);const h=i===0?[1,1,1]:i===1?[.2,.17,.14]:l<0?[.11,.1,.07]:[.16,.14,.09];oe.push(h[0],h[1],h[2])}}const U=ae.length;for(let t=0;t<se-1;t++)for(let a=0;a<U-1;a++){const s=t*U+a,d=s+1,n=s+U,l=n+1;ie.push(s,n,d,d,n,l)}const D=new xe;D.setAttribute("position",new F(re,3)),D.setAttribute("color",new F(oe,3)),D.setAttribute("uv",new F(ne,2)),D.setAttribute("aZone",new F(de,1)),D.setIndex(ie),D.computeVertexNormals();const ce=$e(c.asphalt),j=new B(D,ce);j.name="dune-road-surface",j.receiveShadow=!0,k.add(j);const Ce=new W(1,0),le=o?1400:5200,w=new Oe(Ce,new G({color:16777215,roughness:.92,metalness:0,name:"stones"}),le),ue=new Ve,fe=new Ee,pe=new Ze,Ke=new be,x=new be,Be=new we;let q=0;for(let t=0;t<le;t++){const a=p+e()*(g-p),s=e()<.55?1:-1,d=s*(R+.2+Math.pow(e(),1.6)*(s>0?6.5:4.5)),n=b(a)+d,l=N(n,a);if(!Number.isFinite(l))continue;const u=.03+Math.pow(e(),3)*.14;pe.set(e()*6,e()*6,e()*6),fe.setFromEuler(pe),ue.compose(x.set(n,l+u*.25,a),fe,Ke.set(u*(1+e()),u*(.5+e()*.4),u*(1+e()))),w.setMatrixAt(q,ue);const f=.06+e()*.08;w.setColorAt(q,Be.setRGB(f*1.05,f*.95,f*.85)),q++}w.count=q,w.castShadow=!o,w.receiveShadow=!0,w.name="dune-stones",w.instanceMatrix.needsUpdate=!0,w.instanceColor&&(w.instanceColor.needsUpdate=!0),k.add(w);const _=[],T=[],Ge=[[v-40,15,3.6],[v-70,12,2.4],[v+30,17,2.8],[v-150,13,3.2],[v-330,16,4.2],[v+180,14,2.6],[v-470,12,3]];for(const[t,a,s]of Ge)if(!(t<p||t>g))for(let d=0;d<3;d++){const n=t+(e()-.5)*s*2,l=a+(e()-.5)*s,u=b(n)+l,f=N(u,n),i=s*.7*(.55+e()*.5),h=new W(1,o?1:3),A=h.attributes.position;for(let K=0;K<A.count;K++){x.fromBufferAttribute(A,K);const Q=.7+.45*P(x.x*2.1+d*7+x.y*3.3)+.15*P(x.z*6.3+x.y*5.1)+.06*P(x.x*17+x.z*13);x.multiplyScalar(Q),x.y*=.5,A.setXYZ(K,x.x,x.y,x.z)}h.computeVertexNormals(),h.scale(i,i,i*(.8+e()*.5)),h.rotateY(e()*6),h.translate(u,f+i*.08,n),_.push(h),T.push([u-i*.8,f-1,u+i*.8,f+i,n-i*.8,n+i*.8])}if(_.length){const t=new B(J(_),new G({color:3814188,roughness:.95,metalness:0,name:"coralRock"}));t.castShadow=!0,t.receiveShadow=!0,t.name="dune-rocks",k.add(t)}const he=[],me=o?160:520;for(let t=0;t<me;t++){const a=p+e()*(g-p),d=e()<.6?-(m+2+e()*9):m+7+e()*18,n=b(a)+d,l=N(n,a);if(!Number.isFinite(l))continue;const u=2+Math.floor(e()*3),f=.3+e()*.55;for(let i=0;i<u;i++){const h=new W(f*(.5+e()*.6),o?0:1);h.scale(1,.5+e()*.3,1),h.translate(n+(e()-.5)*f*1.6,l+f*.45+e()*f*.5,a+(e()-.5)*f*1.6),he.push(h.index?h.toNonIndexed():h)}}const O=new B(J(he.map(t=>(t.deleteAttribute("uv"),t))),new G({color:1909780,roughness:.9,flatShading:!0,name:"scrub"}));O.castShadow=!o,O.receiveShadow=!0,O.name="dune-scrub",k.add(O);const ve=[],ge=o?2500:9e3;for(let t=0;t<ge;t++){const a=p+e()*(g-p),d=e()<.4?-(m+.5+e()*9):m+.8+e()*20,n=b(a)+d,l=N(n,a);if(!Number.isFinite(l))continue;const u=.25+e()*.5;for(let f=0;f<4;f++){const i=e()*Math.PI*2,h=.2+e()*.3,A=.022,K=n+Math.cos(i)*h*u,Q=a+Math.sin(i)*h*u;ve.push(n-Math.sin(i)*A,l,a+Math.cos(i)*A,n+Math.sin(i)*A,l,a-Math.cos(i)*A,K,l+u*(.8+e()*.4),Q)}}const L=new xe;L.setAttribute("position",new F(ve,3)),L.computeVertexNormals();const $=new B(L,new G({color:4867110,roughness:.9,side:He,name:"dunegrass"}));$.name="dune-grass2",$.receiveShadow=!0,k.add($);const y=v+34,M=b(y)-(m+.9),C=N(M,y),qe=new Ie(.07,.11,7.2,8).translate(M,C+3.6,y),Fe=new Re(1.6,.08,.1).translate(M+.8,C+7.1,y),X=new B(J([qe,Fe].map(t=>(t.deleteAttribute("uv"),t.index?t.toNonIndexed():t))),new G({color:1710618,roughness:.6,metalness:.5})),Y=new B(new Re(.55,.12,.26).translate(M+1.55,C+7,y),new Ue({color:new we(2.2,1.55,.9),name:"duneLampHead"}));X.name="dune-lamp",Y.name="dune-lamp-head",X.castShadow=!0,k.add(X,Y);const Pe={x:M+1.55,y:C+6.85,z:y,mat:Y.material};return T.push([M-.15,C-1,M+.15,C+7,y-.15,y+.15]),{group:k,heightAt:N,surfaceAt:Se,start:(t=70,a=ee/2)=>{const s=v+t,d=H(s),n=Math.sqrt(1+d*d),l=-d/n,u=-1/n,f=-u,i=l;return{x:b(s)+f*a,z:s+i*a,heading:Math.atan2(-l,-u),dir:[l,u],right:[f,i]}},colliders:T,lamp:Pe,xAt:b,zCrest:v,z0:p,z1:g,mat:ce,half:R,shoulder:m,lateral:I,stats:{length:Math.round(g-p),stones:q,rocks:_.length,bushes:me,grass:ge}}}function Je(c,r){const e=[r.diff,r.nor,r.rough];r.road&&e.push(r.road.diff,r.road.nor,r.road.rough),r.bank&&e.push(r.bank.diff,r.bank.nor,r.bank.rough,r.bank.disp);for(const o of e)o&&(o.wrapS=o.wrapT=je,o.anisotropy=8,o.needsUpdate=!0);r.nor.repeat.set(1/1.5,1/1.5),c.userData.scan=r,c.userData.u=Object.fromEntries(e.filter(Boolean).map((o,z)=>[`t${z}`,{value:o}])),c.normalMap=r.nor,c.normalScale.set(1,1),c.envMapIntensity=1.9,c.needsUpdate=!0}function $e(c){const r=new G({vertexColors:!0,roughness:.9,metalness:0,name:"duneRoad"});return c&&c.map&&(r.map=c.map),r.userData.uDusk={value:1},r.userData.uPx={value:1},r.userData.uDetail={value:1},r.onBeforeCompile=e=>{const o=r.userData.scan;e.uniforms.uDusk=r.userData.uDusk,e.uniforms.uPx=r.userData.uPx,e.uniforms.uDetail=r.userData.uDetail,o&&(Object.assign(e.uniforms,{uScanDiff:{value:o.diff},uScanRough:{value:o.rough},uScanNor:{value:o.nor}}),e.defines={...e.defines||{},SCAN:1},o.road&&(Object.assign(e.uniforms,{uAspD:{value:o.road.diff},uAspN:{value:o.road.nor},uAspR:{value:o.road.rough}}),e.defines.ROADSCAN=1),o.bank&&(Object.assign(e.uniforms,{uBnkD:{value:o.bank.diff},uBnkN:{value:o.bank.nor},uBnkR:{value:o.bank.rough},uBnkH:{value:o.bank.disp}}),e.defines.BANKSCAN=1)),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
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
#endif`).replace("#include <roughnessmap_fragment>",Te.roughnessmap_fragment.replace("float roughnessFactor = roughness;","float roughnessFactor = dRough;")+`
#ifdef ENGINE_GBUFFER
engineGbRoughness = max(roughnessFactor, 0.6); // no screen-space reflections on the corridor: its sheen is the environment's
#endif`)},r.customProgramCacheKey=()=>{const e=r.userData.scan;return`miami-dune-road-${c&&c.map?1:0}-${e?1:0}${e&&e.road?"r":""}${e&&e.bank?"b":""}`},r}export{We as buildDuneRoad,Je as setCorridorScan};
