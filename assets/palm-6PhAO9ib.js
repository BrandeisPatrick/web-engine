import{a as X}from"./BufferGeometryUtils-Cm1sGGAi.js";import{V as _,em as R,D as Y,dq as E,M as Z,dC as $,eK as j,a as U,z as Q,df as H,dt as L}from"./three.core-BG5Iv3B7.js";import"./three.module-Dt1S_jJM.js";function tt(d){let v=d>>>0;return()=>{v=v+1831565813>>>0;let r=v;return r=Math.imul(r^r>>>15,r|1),r^=r+Math.imul(r^r>>>7,r|61),((r^r>>>14)>>>0)/4294967296}}const et=.07,O=d=>new _(Math.sin(d*1.3)*et*d,d,0);function ot(){const r=[],y=[],P=[],z=[];for(let M=0;M<=36;M++){const x=M/36,w=O(x),T=(.21-.07*x+.08*Math.exp(-x*18))/10;for(let a=0;a<=14;a++){const o=a/14*Math.PI*2,s=Math.cos(o),b=Math.sin(o);r.push(w.x+s*T,w.y,w.z+b*T),y.push(s,0,b),P.push(a/14,x)}}for(let M=0;M<36;M++)for(let x=0;x<14;x++){const w=M*15+x,T=w+14+1;z.push(w,T,w+1,w+1,T,T+1)}const e=new Q;return e.setAttribute("position",new H(r,3)),e.setAttribute("normal",new H(y,3)),e.setAttribute("uv",new H(P,2)),e.setIndex(z),e}function W(d,{fronds:v=18,len:r=4.3,droop:y=1,dead:P=6,nuts:z=9}={}){const e=tt(d),M=[],x=(a,o,s,b)=>{const p=new Q;p.setAttribute("position",new H(a,3)),p.setAttribute("color",new H(s,3)),p.setAttribute("aSway",new H(b,2)),p.setIndex(o),p.computeVertexNormals(),M.push(p)};{const a=[],o=[],s=[],b=[];for(let h=0;h<=4;h++)for(let c=0;c<=10;c++){const n=c/10*Math.PI*2,u=-.9+h*.25,g=.17+.03*Math.sin(h*1.3);a.push(Math.cos(n)*g,u,Math.sin(n)*g),s.push(.32,.36,.2),b.push(0,0)}for(let h=0;h<4;h++)for(let c=0;c<10;c++){const n=h*11+c,u=n+10+1;o.push(n,u,n+1,n+1,u,u+1)}x(a,o,s,b);const S=[],I=[],B=[],k=[];for(let h=0;h<14;h++){const c=e()*Math.PI*2,n=-1.5+e()*.7,u=Math.cos(c),g=Math.sin(c),N=.09+e()*.05,t=.35+e()*.25,l=S.length/3;S.push(u*.16-g*N,n,g*.16+u*N,u*.16+g*N,n,g*.16-u*N,u*(.2+t*.6),n+t,g*(.2+t*.6)),I.push(l,l+1,l+2);for(let i=0;i<3;i++)B.push(.36,.28,.19),k.push(0,0)}x(S,I,B,k)}const w=(a,o,s,b,p,S)=>{const I=[],B=[],k=[],h=[],n=Math.cos(a),u=Math.sin(a),g=t=>{const l=o*t;return new _(n*l,s*t-b*t*t*o*.45,u*l)},N=p?[.24+e()*.06,.33+e()*.06,.13]:[.38,.27,.15];for(let t=0;t<=10;t++){const l=t/10,i=g(l),f=.03*(1-l)+.008;I.push(i.x-u*f,i.y,i.z+n*f,i.x+u*f,i.y,i.z-n*f);for(let m=0;m<2;m++)k.push(N[0]*1.15,N[1]*1.05,N[2]*.95),h.push(l,S);if(t<10){const m=t*2;B.push(m,m+2,m+1,m+1,m+2,m+3)}}for(let t=1;t<=26;t++){const l=.08+.9*(t/26),i=g(l),f=(.25+.75*Math.sin(Math.PI*Math.min(1,l*1.05)))*(p?.9:.75)*(.9+e()*.2),m=new _(n,0,u);for(const G of[-1,1]){if(!p&&e()<.25)continue;const J=new _(-u*G,0,n*G),F=i.clone().addScaledVector(J,f*.85).addScaledVector(m,f*.35);F.y-=f*(p?.55:.8)*(.7+.6*l);const A=i.clone().lerp(F,.45);A.y+=.03;const q=.075*f/.9,C=I.length/3;I.push(i.x,i.y,i.z,A.x+m.x*q,A.y,A.z+m.z*q,A.x-m.x*q,A.y,A.z-m.z*q,F.x,F.y,F.z),B.push(C,C+1,C+2,C+1,C+3,C+2);const D=.85+e()*.3;for(let V=0;V<4;V++)k.push(N[0]*D,N[1]*D,N[2]*D),h.push(l+(V===3?.06:0),S)}}x(I,B,k,h)};for(let a=0;a<v;a++){const o=a/v*Math.PI*2+(e()-.5)*.3,s=r*(.8+e()*.35);w(o,s,.9+e()*.8,y*(.8+e()*.6),!0,e()*6.28)}for(let a=0;a<P;a++){const o=e()*Math.PI*2,s=r*(.7+e()*.3);w(o,s,-1.2-e()*.8,.4,!1,e()*6.28)}for(let a=0;a<z;a++){const o=new L(.11+e()*.03,1);o.scale(1,1.15,1);const s=e()*Math.PI*2,b=.2+e()*.12;o.translate(Math.cos(s)*b,-.55-e()*.35,Math.sin(s)*b);const p=o.attributes.position.count,S=[],I=[],B=e()<.4;for(let k=0;k<p;k++)B?S.push(.42,.3,.14):S.push(.36,.4,.16),I.push(0,0);o.setAttribute("color",new H(S,3)),o.setAttribute("aSway",new H(I,2)),o.deleteAttribute("uv"),M.push(o.index?o:o.toNonIndexed())}const T=M.map(a=>{const o=a.index?a.toNonIndexed():a;for(const s of Object.keys(o.attributes))/^(position|normal|color|aSway)$/.test(s)||o.deleteAttribute(s);return o.attributes.normal||o.computeVertexNormals(),o});return X(T)}const rt=d=>d?"step(uNear - 2.0, DIST)":"smoothstep(uNear - 4.0, uNear, DIST)",at="fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + 0.125 * mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0) + 0.0625)";function K(d,v,r){return d.onBeforeCompile=y=>{Object.assign(y.uniforms,{uTime:v.uTime,uViewPos:v.uViewPos,uNear:v.uNear}),y.vertexShader=y.vertexShader.replace("#include <common>",`#include <common>
uniform float uTime; varying vec3 vPW; varying float vTy; varying float vTu;
${r==="crown"?"attribute vec2 aSway;":""}`).replace("#include <begin_vertex>",`#include <begin_vertex>
vTy = position.y; vTu = ${r==="trunk"?"uv.x":"0.0"};
#ifdef USE_INSTANCING
  float iph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
#else
  float iph = 0.0;
#endif
${r==="crown"?`  { float t = aSway.x; float w = sin(uTime * 1.9 + aSway.y + iph - t * 3.2) * 0.5 + sin(uTime * 3.1 + aSway.y * 1.7 - t * 5.0) * 0.18;
    transformed.y += w * 0.22 * t * t; transformed.xz += vec2(cos(aSway.y), sin(aSway.y)) * w * 0.12 * t * t;
    transformed.x += sin(uTime * 0.7 + iph) * 0.06; }`:"  transformed.x += sin(uTime * 0.7 + iph) * 0.006 * position.y * position.y;"}
#ifdef USE_INSTANCING
vPW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`),y.fragmentShader=y.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uViewPos; uniform float uNear; varying vec3 vPW; varying float vTy; varying float vTu;
float npH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
  { float k = ${rt(r==="trunk").replace("DIST","distance(vPW, uViewPos)")};
    if (k > ${at}) discard; }`).replace("#include <color_fragment>",r==="trunk"?`#include <color_fragment>
  { // ring scars ~11 cm apart on a 10 m trunk, each a little uneven in height, depth and tilt; fibres between them
    float y = vTy * 90.0, rI = floor(y + sin(vTu * 6.2832 + floor(y) * 1.7) * 0.18);
    float yr = y + sin(vTu * 6.2832 + rI * 1.7) * 0.18 + (npH(vec2(rI, 3.1)) - 0.5) * 0.25;
    float aa = 1.0 - smoothstep(0.25, 0.7, fwidth(y));
    float ring = abs(fract(yr) - 0.5), deep = 0.55 + 0.45 * npH(vec2(rI, 7.7));
    diffuseColor.rgb *= 1.0 - aa * deep * 0.3 * (1.0 - smoothstep(0.03, 0.17, ring));
    float fib = npH(vec2(floor(vTu * 150.0), floor(yr * 0.5))) * 0.6 + npH(vec2(floor(vTu * 47.0), rI)) * 0.4;
    diffuseColor.rgb *= 1.0 + (fib - 0.5) * 0.22 * (1.0 - smoothstep(0.4, 1.2, fwidth(vTu * 150.0)));
    diffuseColor.rgb *= 0.92 + 0.16 * npH(vec2(rI, 1.3)) * aa;
    diffuseColor.rgb *= mix(0.85, 1.08, smoothstep(0.0, 0.15, vTy)) * mix(1.0, 0.8, smoothstep(0.85, 1.0, vTy)); }`:"#include <color_fragment>").replace("#include <normal_fragment_maps>",r==="trunk"?`#include <normal_fragment_maps>
  { float y = vTy * 90.0, rI = floor(y + sin(vTu * 6.2832 + floor(y) * 1.7) * 0.18);
    float rr = fract(y + sin(vTu * 6.2832 + rI * 1.7) * 0.18 + (npH(vec2(rI, 3.1)) - 0.5) * 0.25);
    normal = normalize(normal + vec3(0.0, (smoothstep(0.0, 0.2, rr) - smoothstep(0.2, 0.4, rr)) * 0.5 * (1.0 - smoothstep(0.25, 0.7, fwidth(y))), 0.0)); }`:"#include <normal_fragment_maps>")},d.customProgramCacheKey=()=>`near-palm-2-${r}`,d}function it(d,v={}){const r=v.near??48,y=v.fade||{},P={uTime:y.uTime||{value:0},uViewPos:y.uViewPos||{value:new _},uNear:y.uNear||{value:r}};P.uNear.value=r;const z=ot(),e=[W(11,{fronds:18,len:4.4,droop:1,dead:6,nuts:10}),W(23,{fronds:15,len:4,droop:1.25,dead:7,nuts:8})],M=K(new R({color:8747628,roughness:.95,name:"nearPalmTrunk"}),P,"trunk"),x=K(new R({vertexColors:!0,roughness:.8,side:Y,name:"nearPalmCrown"}),P,"crown"),w=new E;w.name="near-palms";const T=60,a=new Map;for(const c of d){const n=Math.floor(c.z/T)+":"+Math.floor(c.x/T);a.has(n)||a.set(n,[]),a.get(n).push(c)}const o=new Z,s=new j,b=new j,p=new _,S=new _,I=[];let B=0;const k=c=>(c.index?c.index.count:c.attributes.position.count)/3;for(const c of a.values()){const n=new E;n.name="near-palms-chunk",n.visible=!1;const u=new _;for(const t of c)u.add(p.set(t.x,t.y,t.z));u.multiplyScalar(1/c.length),n.userData.ctr=u;const g=new $(z,M,c.length),N=[[],[]];c.forEach((t,l)=>{const i=t.h/10*(.9+.2*(l*7%5)/4);s.setFromAxisAngle(p.set(0,1,0),t.yaw),b.setFromAxisAngle(p.set(Math.cos(t.leanDir||0),0,Math.sin(t.leanDir||0)),t.lean||0);const f=b.clone().multiply(s);o.compose(p.set(t.x,t.y-.05,t.z),f,S.set(i*10,t.h,i*10)),g.setMatrixAt(l,o);const m=O(1).multiply(S.set(t.h,t.h,t.h)).applyQuaternion(f);N[l%2].push({x:t.x+m.x,y:t.y+m.y-.05,z:t.z+m.z,rot:f.clone(),sc:.85+i*.25})}),g.castShadow=!0,g.receiveShadow=!0,g.computeBoundingSphere(),n.add(g),B+=c.length*k(z),N.forEach((t,l)=>{if(!t.length)return;const i=new $(e[l],x,t.length);t.forEach((f,m)=>{o.compose(p.set(f.x,f.y,f.z),f.rot,S.set(f.sc,f.sc,f.sc)),i.setMatrixAt(m,o)}),i.castShadow=!0,i.receiveShadow=!0,i.computeBoundingSphere(),n.add(i),B+=t.length*k(e[l])}),w.add(n),I.push(n)}const h=new _;return{group:w,fade:P,stats:{palms:d.length,chunks:I.length,crownTris:e.map(k),trunkTris:k(z),totalTris:Math.round(B)},update(c,n=0){P.uTime.value+=n,P.uViewPos.value.copy(c.position);for(const u of I)h.copy(u.userData.ctr),u.visible=h.distanceTo(c.position)<r+30}}}function ut(d,v,{frond:r=null,frondTint:y=null}={}){let P=0;return d.traverse(z=>{if(!z.isMesh||z.name!=="veg-palm")return;const e=z.material;if(!e||e.userData.canaryBark)return;e.userData.canaryBark=!0,P++;const M=e.onBeforeCompile,x=e.customProgramCacheKey,w={value:new U(v.u0,v.v0,v.u1,v.v1)},T=r&&y,a={value:T?new U(r.u0,r.v0,r.u1,r.v1):new U(2,2,2,2)},o={value:new _(...T?y:[1,1,1])};e.onBeforeCompile=function(s,b){M&&M.call(this,s,b),s.uniforms.uPalmBark=w,s.uniforms.uPalmFrond=a,s.uniforms.uPalmFrondTint=o,s.fragmentShader=s.fragmentShader.replace("#include <common>",`#include <common>
uniform vec4 uPalmBark, uPalmFrond; uniform vec3 uPalmFrondTint;
float cbH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cbN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cbH(i), cbH(i + vec2(1.0, 0.0)), f.x), mix(cbH(i + vec2(0.0, 1.0)), cbH(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 canaryBark(vec2 q) {
  // q.x: around the trunk (0..1, periodic), q.y: metres up the strip (~12 m)
  float y = q.y * 130.0, a = q.x * 6.2832;  // ~9 cm rings
  float rI = floor(y + sin(a * 2.0 + floor(y) * 2.3) * 0.2);
  float yr = y + sin(a * 2.0 + rI * 2.3) * 0.2 + (cbH(vec2(rI, 4.1)) - 0.5) * 0.3;
  float fy = fwidth(y), aa = 1.0 - smoothstep(0.3, 0.8, fy);
  float ring = abs(fract(yr) - 0.5);
  vec3 c = vec3(0.17, 0.152, 0.13) * (0.86 + 0.28 * cbH(vec2(rI, 1.7)) * aa);              // grey-brown, per ring
  c *= 1.0 - aa * (0.4 + 0.6 * cbH(vec2(rI, 8.3))) * 0.26 * (1.0 - smoothstep(0.04, 0.24, ring));
  // faint leaf-base scars: broad, staggered, soft (no lattice), every second or third ring
  float cell = floor(q.x * 9.0 + mod(rI, 2.0) * 0.5 + cbH(vec2(rI, 2.0)) * 0.6);
  float sc = step(0.45, cbH(vec2(cell, rI))) * (1.0 - smoothstep(0.15, 0.5, abs(fract(q.x * 9.0 + mod(rI, 2.0) * 0.5 + cbH(vec2(rI, 2.0)) * 0.6) - 0.5)));
  c *= 1.0 + sc * 0.12 * aa * smoothstep(0.1, 0.4, ring);
  // fibres
  float fib = cbN(vec2(q.x * 260.0, yr * 1.4)) * 0.6 + cbN(vec2(q.x * 90.0, y * 0.3)) * 0.4;
  c *= 1.0 + (fib - 0.5) * 0.45 * (1.0 - smoothstep(0.5, 1.5, fwidth(q.x * 260.0)));
  return c * (0.9 + 0.2 * cbN(vec2(q.x * 3.0, y * 0.015)));                                     // broad weathering
}`).replace("diffuseColor *= texture2D( map, vMapUv );",`vec4 cbTx = texture2D( map, vMapUv );
	if ( vMapUv.x > uPalmBark.x && vMapUv.x < uPalmBark.z && vMapUv.y > uPalmBark.y && vMapUv.y < uPalmBark.w ) {
		vec2 cbQ = vec2( ( vMapUv.x - uPalmBark.x ) / ( uPalmBark.z - uPalmBark.x ), ( vMapUv.y - uPalmBark.y ) / ( uPalmBark.w - uPalmBark.y ) );
		cbTx.rgb = canaryBark( cbQ );
	}
	if ( vMapUv.x > uPalmFrond.x && vMapUv.x < uPalmFrond.z && vMapUv.y > uPalmFrond.y && vMapUv.y < uPalmFrond.w ) cbTx.rgb *= uPalmFrondTint;
	diffuseColor *= cbTx;`)},e.customProgramCacheKey=function(){return(x?x.call(this):"")+"|canary-bark-1"},e.needsUpdate=!0}),P}export{at as PALM_DITHER_FS,rt as PALM_FADE_FS,it as buildNearPalms,ut as canaryBark};
