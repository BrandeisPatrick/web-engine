import{D as I,R as ee,o as se,a as W,p as z,f as E,u as T,a6 as q,a5 as ce,K as te,z as ae,a9 as ne,V as re,g as le,ah as fe,C as ue,J as me,b as de,l as he,c as pe,j as ve,a3 as we,a4 as ge,i as xe}from"./three.module-BKHKcI7v.js";import{G as j,m as ye,Z as C,z as N,R as Me}from"./LoadingScreen-BfRRBmvZ.js";const Re=9.81,Fe=Math.atan2(-.36,.93),D=[[42,.07,-.12,.6,0],[27,.06,.28,.65,1.7],[17,.045,-.46,.7,4.1],[11,.032,.7,.7,2.3],[7.1,.022,-.2,.65,5.2],[4.6,.014,1.05,.6,.9],[3.1,.009,-.9,.55,3.3]].map(([n,e,a,s,c])=>{const t=2*Math.PI/n,o=Fe+a,r=Math.min(220,n*3);return{L:n,k:t,a:e,dx:Math.cos(o),dz:Math.sin(o),w:Math.sqrt(Re*t),q:s,ph:c,fade0:r,fade1:r*1.5}}),be=D.length;function Ie(n,e,a,s,c){const t=Math.hypot(n-s,e-c);let o=0;for(const r of D){if(t>=r.fade1)continue;const f=t<=r.fade0?1:1-oe((t-r.fade0)/(r.fade1-r.fade0));o+=r.a*f*Math.sin(r.k*(r.dx*n+r.dz*e)-r.w*a+r.ph)}return o}function Ge(n,e,a,s,c,t=[0,0]){const o=Math.hypot(n-s,e-c);let r=0,f=0;for(const l of D){if(o>=l.fade1)continue;const v=o<=l.fade0?1:1-oe((o-l.fade0)/(l.fade1-l.fade0)),i=l.a*v*l.k*Math.cos(l.k*(l.dx*n+l.dz*e)-l.w*a+l.ph);r+=i*l.dx,f+=i*l.dz}return t[0]=r,t[1]=f,t}const oe=n=>n<=0?0:n>=1?1:n*n*(3-2*n);function Ne(){return{uWaveA:{value:D.map(n=>new z(n.dx,n.dz,n.k,n.a))},uWaveB:{value:D.map(n=>new z(n.w,n.q,n.ph,n.fade0))}}}const Ae=`
#define NWAVES ${be}
uniform vec4 uWaveA[NWAVES]; // dir.x, dir.z, k, amplitude
uniform vec4 uWaveB[NWAVES]; // omega, steepness, phase, fade start
// Gerstner displacement at world xz (dist = horizontal distance to the camera); n = surface normal (world)
vec3 gerstner(vec2 p, float dist, float t, out vec3 n) {
  vec3 d = vec3(0.0);
  n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < NWAVES; i++) {
    vec4 A = uWaveA[i]; vec4 B = uWaveB[i];
    float a = A.w * (1.0 - smoothstep(B.w, B.w * 1.5, dist));
    if (a <= 0.0) continue;
    float th = A.z * dot(A.xy, p) - B.x * t + B.z;
    float c = cos(th), s = sin(th);
    d.xz += B.y * a * A.xy * c;
    d.y += a * s;
    float wa = A.z * a;
    n.x -= A.x * wa * c;
    n.z -= A.y * wa * c;
    n.y -= B.y * wa * s;
  }
  n = normalize(n);
  return d;
}
`;function Ve(n,e=512){const a=ye(9071),s=[];for(let i=0;i<46;i++){const m=2+Math.floor(Math.pow(a(),1.6)*44);let h=(a()-.5)*2.2;a()<.18&&(h+=Math.PI);let u=Math.round(Math.cos(h)*m),g=Math.round(Math.sin(h)*m);!u&&!g&&(u=2);const w=Math.hypot(u,g);s.push({kx:u,ky:g,a:Math.pow(w,-1.18)*(.75+a()*.5),ph:a()*Math.PI*2})}const c=new Float32Array(e*e),t=new Float32Array(e*e),o=Math.PI*2;for(const i of s){const m=i.a*o*i.kx,h=i.a*o*i.ky,u=new Float32Array(e),g=new Float32Array(e),w=new Float32Array(e),d=new Float32Array(e);for(let p=0;p<e;p++){const x=o*i.kx*p/e+i.ph;u[p]=Math.cos(x),g[p]=Math.sin(x)}for(let p=0;p<e;p++){const x=o*i.ky*p/e;w[p]=Math.cos(x),d[p]=Math.sin(x)}for(let p=0;p<e;p++){const x=w[p],y=d[p],F=p*e;for(let M=0;M<e;M++){const R=g[M]*x+u[M]*y;c[F+M]-=m*R,t[F+M]-=h*R}}}let r=0;for(let i=0;i<e*e;i++)r+=c[i]*c[i]+t[i]*t[i];const f=.38/Math.sqrt(r/(e*e)),l=new Uint8Array(e*e*4);for(let i=0;i<e*e;i++){const m=c[i]*f,h=t[i]*f,u=Math.hypot(m,h,1);l[i*4]=(-m/u*.5+.5)*255,l[i*4+1]=(-h/u*.5+.5)*255,l[i*4+2]=(1/u*.5+.5)*255,l[i*4+3]=255}const v=new I(l,e,e,ee);return ie(v,n)}function Xe(n,e=256){const a=new Uint8Array(e*e*4);for(let c=0;c<e;c++)for(let t=0;t<e;t++){const o=t/e,r=c/e,f=(c*e+t)*4,l=C(o,r,4,4,301),v=C(o,r,8,4,311),i=C(o,r,16,3,321),m=C(o,r,32,2,331),h=Math.pow(N(1-Math.abs(m-.5)*4.2,0,1),1.5)*.6+i*.4;a[f]=l*255,a[f+1]=v*255,a[f+2]=i*255,a[f+3]=N(h,0,1)*255}const s=new I(a,e,e,ee);return ie(s,n)}function ie(n,e,a){return n.wrapS=n.wrapT=ce,n.colorSpace=te,n.magFilter=ae,n.minFilter=ne,n.generateMipmaps=!0,n.anisotropy=e?Math.min(8,e.capabilities.getMaxAnisotropy()):4,n.needsUpdate=!0,n}function $(n,e,a,s,c){let t=0;s[0]=0,c[0]=-1e20,c[1]=1e20;for(let o=1;o<e;o++){let r=(n[o]+o*o-(n[s[t]]+s[t]*s[t]))/(2*o-2*s[t]);for(;r<=c[t];)t--,r=(n[o]+o*o-(n[s[t]]+s[t]*s[t]))/(2*o-2*s[t]);t++,s[t]=o,c[t]=r,c[t+1]=1e20}t=0;for(let o=0;o<e;o++){for(;c[t+1]<o;)t++;const r=o-s[t];a[o]=r*r+n[s[t]]}}function K(n,e,a,s){const t=new Float32Array(e*a),o=Math.max(e,a),r=new Float64Array(o),f=new Float64Array(o),l=new Int32Array(o),v=new Float64Array(o+1);for(let i=0;i<e;i++){for(let m=0;m<a;m++)r[m]=n[m*e+i]===s?0:1e20;$(r,a,f,l,v);for(let m=0;m<a;m++)t[m*e+i]=f[m]}for(let i=0;i<a;i++){const m=i*e;for(let h=0;h<e;h++)r[h]=t[m+h];$(r,e,f,l,v);for(let h=0;h<e;h++)t[m+h]=f[h]}return t}function ke(n){const e=n.outerBox,a=2,s=(t,o)=>Math.abs(t[0]-e.minX)<a&&Math.abs(o[0]-e.minX)<a||Math.abs(t[0]-e.maxX)<a&&Math.abs(o[0]-e.maxX)<a||Math.abs(t[1]-e.minZ)<a&&Math.abs(o[1]-e.minZ)<a||Math.abs(t[1]-e.maxZ)<a&&Math.abs(o[1]-e.maxZ)<a,c=[];for(const t of[...n.landPolys,...n.pierPolys||[]]){const o=t.ring;for(let r=0;r<o.length;r++){const f=o[r],l=o[(r+1)%o.length];s(f,l)||c.push([f[0],f[1],l[0],l[1]])}}return c}function Y(n,e,a,s){const c=a.n,t=a.size/c,o=new Me(a.minX,a.minZ,a.minX+a.size-t*.01,a.minZ+a.size-t*.01,t),r=o.w,f=o.h;for(const d of[...n.landPolys,...n.pierPolys||[]])o.fillPolygon([d.ring],1,"or");const l=o.data;if(s){const d=n.outerBox,p=N(Math.ceil((d.minX-a.minX)/t),0,r-1),x=N(Math.floor((d.maxX-a.minX)/t)-1,0,r-1),y=N(Math.ceil((d.minZ-a.minZ)/t),0,f-1),F=N(Math.floor((d.maxZ-a.minZ)/t)-1,0,f-1);for(let M=0;M<f;M++)for(let R=0;R<r;R++)R>=p&&R<=x&&M>=y&&M<=F||(l[M*r+R]=l[N(M,y,F)*r+N(R,p,x)])}const v=K(l,r,f,1),i=K(l,r,f,0),m=new Float32Array(r*f);for(let d=0;d<r*f;d++)m[d]=l[d]?-(Math.sqrt(i[d])-.5)*t:(Math.sqrt(v[d])-.5)*t;const h=t*4,u=Math.max(h*2,t*8),g=new Map,w=(d,p)=>d*73856093^p*19349663;e.forEach((d,p)=>{const x=Math.floor((Math.min(d[0],d[2])-h)/u),y=Math.floor((Math.max(d[0],d[2])+h)/u),F=Math.floor((Math.min(d[1],d[3])-h)/u),M=Math.floor((Math.max(d[1],d[3])+h)/u);for(let R=x;R<=y;R++)for(let A=F;A<=M;A++){const b=w(R,A);let k=g.get(b);k||g.set(b,k=[]),k.push(p)}});for(let d=0;d<f;d++)for(let p=0;p<r;p++){const x=d*r+p;if(Math.abs(m[x])>h)continue;const y=a.minX+(p+.5)*t,F=a.minZ+(d+.5)*t,M=g.get(w(Math.floor(y/u),Math.floor(F/u)));if(!M)continue;let R=1/0;for(const A of M){const b=e[A],k=b[2]-b[0],S=b[3]-b[1],Z=k*k+S*S;let _=Z>0?((y-b[0])*k+(F-b[1])*S)/Z:0;_=_<0?0:_>1?1:_;const U=b[0]+k*_-y,H=b[1]+S*_-F,L=U*U+H*H;L<R&&(R=L)}if(R<1/0){const A=Math.sqrt(R);m[x]=l[x]?-A:A}}return{sd:m,W:r,H:f,cell:t}}function Ze(n,e){const a=performance.now(),s=ke(n),c=n.bounds,t=n.outerBox,o=Math.max(c.maxX-c.minX,c.maxZ-c.minZ)+360,r={minX:(c.minX+c.maxX)/2-o/2,minZ:(c.minZ+c.maxZ)/2-o/2,size:o,n:1024},f=Math.max(t.maxX-t.minX,t.maxZ-t.minZ)+400,l={minX:(t.minX+t.maxX)/2-f/2,minZ:(t.minZ+t.maxZ)/2-f/2,size:f,n:512},v=Y(n,s,r,!1),i=Y(n,s,l,!0),m=new Uint8Array(v.W*v.H*2);for(let w=0;w<v.W*v.H;w++)m[w*2]=N(Math.round((v.sd[w]+8)/64*255),0,255),m[w*2+1]=N(Math.round(v.sd[w]+32),0,255);const h=new Uint8Array(i.W*i.H);for(let w=0;w<i.W*i.H;w++)h[w]=N(Math.round((i.sd[w]+64)/2),0,255);const u=(w,d,p,x)=>{const y=new I(w,d,p,x,fe);return y.wrapS=y.wrapT=ue,y.magFilter=ae,y.minFilter=ne,y.generateMipmaps=!0,y.colorSpace=te,y.needsUpdate=!0,y},g={fine:{tex:u(m,v.W,v.H,de),rect:new z(r.minX,r.minZ,1/(v.W*v.cell),1/(v.H*v.cell)),R:r,F:v},coarse:{tex:u(h,i.W,i.H,me),rect:new z(l.minX,l.minZ,1/(i.W*i.cell),1/(i.H*i.cell)),R:l,F:i},segs:s,ms:Math.round(performance.now()-a)};return g.distanceAt=(w,d)=>{const p=F=>{const M=Math.floor((w-F.R.minX)/F.F.cell),R=Math.floor((d-F.R.minZ)/F.F.cell);return M<0||R<0||M>=F.F.W||R>=F.F.H?null:F.F.sd[R*F.F.W+M]},x=p(g.fine);if(x!==null&&Math.abs(x)<200)return x;const y=p(g.coarse);return y===null?500:y},g}const ze=`
uniform float uTime;
varying vec3 vWPos;
varying vec3 vGN;
${Ae}
`,_e=`
uniform float uTime;
uniform float uNight;
uniform float uFar;
uniform float uChop;
uniform sampler2D uNrm;
uniform sampler2D uNoise;
uniform sampler2D uShoreF;
uniform sampler2D uShoreC;
uniform vec4 uFineRect;
uniform vec4 uCoarseRect;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoamCol;
uniform vec3 uGlowCol;
uniform vec4 uPiers[16]; // nearest columns / bridge piers standing in the water: centre xz, half size (local)
uniform vec2 uPierR[16]; // their orientation (cos, sin)
uniform float uPierN;
varying vec3 vWPos;
varying vec3 vGN;

vec3 wN;          // final world normal
vec3 wMeanN;      // smooth normal (glitter envelope)
vec3 wSparkN;     // sharper normal for the sparkle term (view space, set later)
float wSpark;
float wRough;
float wFoam;
vec3 wCol;
vec3 wGlow;
float wHorizon;

vec2 wOctave(vec2 p, float scale, float ang, float speed, float w) {
  float c = cos(ang), s = sin(ang);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / scale + vec2(speed * uTime / scale, 0.0);
  vec3 n = texture2D(uNrm, q).xyz * 2.0 - 1.0;
  vec2 g = -n.xy / max(n.z, 0.25);
  return vec2(c * g.x + s * g.y, -s * g.x + c * g.y) * w;
}
float wShoreSD(vec2 p) {
#ifdef WATER_POND
  return 200.0;
#else
  vec2 cu = (p - uCoarseRect.xy) * uCoarseRect.zw;
  float dc = texture2D(uShoreC, cu).r * 510.0 - 64.0;
  vec2 fu = (p - uFineRect.xy) * uFineRect.zw;
  vec2 e = min(fu, 1.0 - fu);
  float inF = smoothstep(0.0, 0.015, min(e.x, e.y));
  if (inF <= 0.0 || dc > 260.0) return dc;
  vec2 f = texture2D(uShoreF, fu).rg;
  float dn = f.r * 64.0 - 8.0, dm = f.g * 255.0 - 32.0;
  float df = dn < 54.0 ? dn : dm;
  df = dm > 220.0 ? max(df, dc) : df;
  return mix(dc, df, inF);
#endif
}
`,G=`
{
  vec3 toCam = cameraPosition - vWPos;
  float dist = length(toCam);
  vec3 Vw = toCam / max(dist, 1e-3);
  vec2 p = vWPos.xz;
  float hd = length(toCam.xz);
  // large-scale wind patches (cat's paws): modulate chop + colour, break any tile repeat
  vec4 pn = texture2D(uNoise, p / 1900.0 + vec2(0.0011, 0.0004) * uTime);
  float pa = pn.r, pb = pn.b; // ~475 m and ~120 m patches from one fetch
  float patchv = pa * 0.6 + pb * 0.4;
  float wind = clamp(0.35 + 1.5 * (patchv - 0.28), 0.25, 1.5);
  // wind rows / slicks: long smooth streaks aligned with the wind (very visible from the air)
  vec2 wd = vec2(0.93, -0.36);
  vec2 ws = vec2(dot(p, wd) / 1400.0, dot(p, vec2(-wd.y, wd.x)) / 170.0);
  float slick = smoothstep(0.56, 0.74, texture2D(uNoise, ws + vec2(-0.0006 * uTime, 0.0)).b * 0.75 + pb * 0.35);
  wind *= 1.0 - 0.62 * slick;
  float fHi = 1.0 - smoothstep(60.0, 700.0, hd);
  float fMid = 1.0 - smoothstep(500.0, 3500.0, hd);
  vec2 g = vec2(0.0);
  g += wOctave(p, 61.0, 0.31, 2.2, 0.50);
  vec2 gMean = g * uChop * wind;
  g += wOctave(p, 23.0, -0.45, 1.5, 0.46) * mix(0.55, 1.0, fMid);
  g += wOctave(p, 8.3, 0.92, 1.0, 0.40) * mix(0.3, 1.0, fHi);
  vec2 gFine = fHi > 0.0 ? wOctave(p, 2.9, -1.17, 0.65, 0.36) * fHi : vec2(0.0);
  g += gFine;
  g *= uChop * wind;
  vec2 gg = -vGN.xz / max(vGN.y, 0.3);
  wN = normalize(vec3(-(g.x + gg.x), 1.0, -(g.y + gg.y)));
  wMeanN = normalize(vec3(-(gMean.x + gg.x) * 0.6, 1.0, -(gMean.y + gg.y) * 0.6));
  // sparkle normal: exaggerated fine chop
  float fSp = 1.0 - smoothstep(40.0, 420.0, hd);
  vec2 g2 = g + gFine * (2.2 * fSp * uChop * wind);
  wSparkN = normalize(vec3(-(g2.x + gg.x), 1.0, -(g2.y + gg.y)));
  wSpark = fSp * (0.6 + 0.6 * wind);

  // shoreline distance (m): + over water, - under land / piers
  float sd = wShoreSD(p);
  float aa = max(fwidth(sd), 0.02);
  float nearShore = 1.0 - smoothstep(0.0, 170.0, sd);
  vec3 col = mix(uDeep, uShallow, nearShore * nearShore * 0.85 + 0.15 * nearShore);
  col *= 0.9 + 0.22 * patchv;
  // sediment / plankton plumes on the kilometre scale
  col = mix(col, col * vec3(1.16, 1.1, 0.84), smoothstep(0.5, 0.78, pa) * 0.7); // sediment / plankton plumes
  // under piers / decks: shaded, almost black
  float under = smoothstep(0.3, -5.0, sd);
  col *= 1.0 - 0.85 * under;

  // piers / bridge columns in the water (box distance), merged into the foam distance only
  float sdF = sd;
#ifndef WATER_POND
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uPierN) break;
    vec4 b = uPiers[i]; vec2 r = uPierR[i];
    vec2 d = p - b.xy;
    vec2 q = abs(vec2(d.x * r.x + d.y * r.y, -d.x * r.y + d.y * r.x)) - b.zw;
    sdF = min(sdF, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));
  }
#endif
  // foam: contact line + lapping bands at walls / piers (only evaluated near them)
  float foam = 0.0;
  if (sdF < 7.0) {
    float fn = texture2D(uNoise, p / 7.0 + vec2(0.021, -0.013) * uTime).a;
    float fn2 = texture2D(uNoise, p / 2.3 + vec2(-0.05, 0.03) * uTime).b;
    float fsd = sdF + (fn - 0.5) * 0.8;
    float contact = 1.0 - smoothstep(0.0, 0.7 + aa * 1.5, fsd);
    float lap = sin(sdF * 2.1 - uTime * 1.35 + fn * 4.0) * 0.5 + 0.5;
    float bands = smoothstep(0.62, 0.95, lap) * (1.0 - smoothstep(0.4, 4.5, sdF));
    foam = contact * (0.55 + 0.45 * fn2) + bands * (0.25 + 0.6 * fn2) * fn;
    foam *= step(-0.6, sd) * (1.0 - smoothstep(1.0, 8.0, aa)); // not under decks; fades out when sub-pixel
  }
  wFoam = clamp(foam, 0.0, 1.0);
  wCol = mix(col, uFoamCol, wFoam);
  wN = normalize(mix(wN, vec3(0.0, 1.0, 0.0), wFoam * 0.7));
  wSpark *= 1.0 - wFoam;

  // roughness: glassy near, wider sun streak far (sub-pixel waves), foam is matte
  wRough = mix(0.045, 0.2, smoothstep(30.0, 2600.0, hd)) * mix(0.85, 1.25, clamp(wind - 0.5, 0.0, 1.0)) * (1.0 - 0.45 * slick);
  wRough = mix(wRough, 0.75, wFoam);

  // night: lit windows / street lights reflected where the reflected ray runs low toward the shore (probe the
  // shoreline field along the reflection); the wave normals scatter it into shimmering columns
  wGlow = vec3(0.0);
#ifndef WATER_POND
  if (uNight > 0.12) {
    vec3 rv = reflect(-Vw, wN);
    float elev = smoothstep(0.32, 0.03, rv.y);
    vec2 rh = normalize(rv.xz + 1e-5);
    float s1 = wShoreSD(p + rh * 90.0), s2 = wShoreSD(p + rh * 260.0);
    float land = smoothstep(4.0, -25.0, min(s1, s2 + 40.0));
    float fres = pow(1.0 - clamp(dot(wN, Vw), 0.0, 1.0), 3.0);
    float patchy = 0.4 + 0.6 * texture2D(uNoise, (p + rh * 200.0) / 330.0).g;
    wGlow = uGlowCol * (smoothstep(0.12, 0.5, uNight) * uNight * land * elev * (0.1 + 1.4 * fres) * patchy * (1.0 - under) * (1.0 - smoothstep(1800.0, 4500.0, hd)));
  }
#endif

  // far plane: fade into the sky seen at the horizon
#ifdef WATER_POND
  wHorizon = 0.0;
#else
  wHorizon = smoothstep(0.62 * uFar, 0.96 * uFar, hd);
#endif
}
`,De=`
vec3 wSparkNv;
vec3 wMeanNv;
float waterSparkle(vec3 L, vec3 V) {
  vec3 H = normalize(L + V);
  // glints only inside the glitter path: where the mean (large-scale) surface can reflect the light at all
  float env = smoothstep(0.965, 0.995, dot(wMeanNv, H));
  float d = max(dot(wSparkNv, H), 0.0);
  return wSpark * env * (pow(d, 2500.0) * 60.0 + pow(d, 400.0) * 0.8) * saturate(dot(wSparkNv, L));
}
`,P=Object.freeze({strength:.035,absorption:Object.freeze([.35,.12,.08]),murk:.6,foamDepth:.5,maxDepth:30}),J=Object.keys(P),V=n=>`#ifdef WATER_REFRACTION
${n}
#endif // WATER_REFRACTION
`,Se=V(`uniform sampler2D uSceneColor;      // SceneCopy colour: HDR linear, this frame, before the water
uniform highp sampler2D uSceneDepth; // SceneCopy depth: raw 0..1, farthest of each 2x2
uniform vec2 uSceneRes;              // scene target size (px): screen uv = gl_FragCoord.xy / uSceneRes
uniform vec4 uRefract;               // strength, murk, foamDepth, maxDepth
uniform vec3 uAbsorb;                // per-metre extinction (Beer-Lambert)
uniform vec2 uNearFar;               // the drawing camera's near / far (perspective)
uniform float uRefractOn;            // 0: no valid copy this frame (the opaque look, no recompile)
vec3 wRefr;                          // transmitted scene radiance, added as emissive * (1 - foam)
float wLinDepth(float d) { return uNearFar.x * uNearFar.y / (uNearFar.y - d * (uNearFar.y - uNearFar.x)); }`),O=`  wFoam = clamp(foam, 0.0, 1.0);
`,Ee=V(`  wRefr = vec3(0.0);
  if (uRefractOn > 0.5) {
    vec2 suv = gl_FragCoord.xy / uSceneRes;
    float zs = vViewPosition.z;                                   // the surface's own view depth (m)
    float z0 = wLinDepth(texture2D(uSceneDepth, suv).r);         // the scene behind it, undistorted
    // refraction offset: the wave slope (world xz) seen in view space; full strength within 10 m, then ~ 1 / distance
    vec2 off = (viewMatrix * vec4(wN.x, 0.0, wN.z, 0.0)).xy * (uRefract.x * min(1.0, 10.0 / max(dist, 1e-3)));
    off.x *= uSceneRes.y / uSceneRes.x;                           // isotropic in pixels
    vec2 ruv = suv + off;
    float zr = wLinDepth(texture2D(uSceneDepth, ruv).r);
    if (zr < zs) { ruv = suv; zr = z0; }                         // the offset landed on a foreground object
    float dep = clamp(zr - zs, 0.0, uRefract.w);                 // water depth along the view (m)
#ifdef WATER_POND
    dep += 2.0;                                                   // draped over undug ground: a nominal bed
#endif
    float murkF = 1.0 - exp(-uRefract.y * dep);                  // share of the body colour
    float fr = 0.02 + 0.98 * pow(1.0 - clamp(dot(wN, Vw), 0.0, 1.0), 5.0); // Schlick, F0 0.02: reflected, not transmitted
    wRefr = texture2D(uSceneColor, ruv).rgb * exp(-uAbsorb * dep) * ((1.0 - murkF) * (1.0 - fr));
    col *= murkF;
#ifndef WATER_POND
    // depth foam at contact lines (piles, hulls, rip-rap, pier edges): the undistorted depth, so it hugs the line
    float dfoam = (1.0 - smoothstep(0.0, max(uRefract.z, 1e-3), z0 - zs)) * (1.0 - smoothstep(150.0, 600.0, hd)) * step(-0.6, sd);
    if (dfoam > 0.0) foam = max(foam, dfoam * (0.45 + 0.55 * texture2D(uNoise, p / 2.3 + vec2(-0.05, 0.03) * uTime).b));
#endif
  }`);if(!G.includes(O))throw new Error("[Water] refraction anchor missing in WATER_MAIN_F");const Ce=G.replace(O,Ee+O),Te=`
`+V("totalEmissiveRadiance += wRefr * ( 1.0 - wFoam );").slice(0,-1);function B(n){return!!n.defines&&n.defines.WATER_REFRACTION!==void 0}function X(n,e=null){const a=n.userData.u;return a.uRefractOn===void 0&&(Object.assign(a,{uSceneColor:{value:null},uSceneDepth:{value:null},uSceneRes:{value:new W(1,1)},uRefract:{value:new z},uAbsorb:{value:new re},uNearFar:{value:new W(.1,6e3)},uRefractOn:{value:0}}),n.userData.refraction={source:null},Q(a,P)),e&&Q(a,{...P,...e}),a}function Q(n,e){for(const s in e)if(!J.includes(s))throw new Error(`[Water] refraction: unknown option '${s}' (${J.join(", ")})`);const a=typeof e.absorption=="number"?[e.absorption,e.absorption,e.absorption]:e.absorption;if(!Array.isArray(a)||a.length!==3||!a.every(Number.isFinite))throw new Error("[Water] refraction.absorption: a number or [r, g, b] per metre");for(const s of["strength","murk","foamDepth","maxDepth"])if(!Number.isFinite(e[s]))throw new Error(`[Water] refraction.${s}: a finite number`);n.uRefract.value.set(e.strength,e.murk,e.foamDepth,e.maxDepth),n.uAbsorb.value.set(a[0],a[1],a[2])}function Ue(n,e,a,s=null){const c=X(n);return c.uSceneColor.value=e||null,c.uSceneDepth.value=a||null,n.userData.refraction.source=s||null,(!e||!a)&&(c.uRefractOn.value=0),n}function He(n,e){return e=!!e,e===B(n)?!1:(e?(X(n),(n.defines||(n.defines={})).WATER_REFRACTION=""):delete n.defines.WATER_REFRACTION,n.needsUpdate=!0,!0)}function We(n,e,a){const s=n.userData.u;if(s.uRefractOn===void 0)return;const c=e.getRenderTarget(),t=n.userData.refraction.source;c!==null&&s.uSceneRes.value.set(c.width,c.height),a&&a.far&&s.uNearFar.value.set(a.near,a.far),s.uRefractOn.value=c!==null&&s.uSceneColor.value!==null&&s.uSceneDepth.value!==null&&(t===null||t.valid===!0)?1:0}function Le({normalMap:n,noiseMap:e,shore:a=null,pond:s=!1,refraction:c=!1}){const t=new se({color:16777215,roughness:.06,metalness:0,envMapIntensity:1});t.name=s?"pond":"bay";const o={uTime:{value:0},uNight:{value:0},uFar:{value:6e3},uChop:{value:s?.3:.62},uNrm:{value:n},uNoise:{value:e},uShoreF:{value:a?a.fine.tex:null},uShoreC:{value:a?a.coarse.tex:null},uFineRect:{value:a?a.fine.rect:new z(0,0,1,1)},uCoarseRect:{value:a?a.coarse.rect:new z(0,0,1,1)},uDeep:{value:new E().setRGB(.082,.13,.122,T)},uShallow:{value:new E().setRGB(.135,.185,.14,T)},uFoamCol:{value:new E().setRGB(.78,.8,.78,T)},uGlowCol:{value:new E(1,.66,.36).multiplyScalar(.3)},uPiers:{value:Array.from({length:16},()=>new z(1e6,1e6,0,0))},uPierN:{value:0},uPierR:{value:Array.from({length:16},()=>new W(1,0))},...Ne()};return s&&(t.defines={WATER_POND:""}),t.userData.u=o,c&&(X(t,c===!0?null:c),t.defines.WATER_REFRACTION=""),t.onBeforeCompile=r=>{const f=B(t);Object.assign(r.uniforms,o),r.vertexShader=r.vertexShader.replace("#include <common>",`#include <common>
${ze}`).replace("#include <beginnormal_vertex>",`
vec3 objectNormal = vec3(0.0, 1.0, 0.0);
vec3 wDisp = vec3(0.0);
{
  vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
#ifndef WATER_POND
  float hdist = length(wp0.xz - cameraPosition.xz);
  wDisp = gerstner(wp0.xz, hdist, uTime, objectNormal);
#endif
  vWPos = wp0 + wDisp;
  vGN = objectNormal;
}`).replace("#include <begin_vertex>","vec3 transformed = vec3( position ) + wDisp;"),r.fragmentShader=r.fragmentShader.replace("#include <common>",`#include <common>
${_e}`+(f?Se:"")).replace("#include <map_fragment>",f?Ce:G).replace("#include <color_fragment>","diffuseColor.rgb = wCol;").replace("#include <roughnessmap_fragment>","float roughnessFactor = wRough;"+j.roughnessmap_fragment).replace("#include <normal_fragment_maps>",`normal = normalize( ( viewMatrix * vec4( wN, 0.0 ) ).xyz );
wSparkNv = normalize( ( viewMatrix * vec4( wSparkN, 0.0 ) ).xyz );
wMeanNv = normalize( ( viewMatrix * vec4( wMeanN, 0.0 ) ).xyz );`+j.normal_fragment_maps).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance += wGlow;`+(f?Te:"")).replace("#include <lights_physical_fragment>",q.lights_physical_fragment.replace("vec3( 0.04 )","vec3( 0.02 )")).replace("#include <lights_physical_pars_fragment>",De+q.lights_physical_pars_fragment.replace("reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );",`reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directSpecular += directLight.color * waterSparkle( directLight.direction, geometryViewDir );`)).replace("#include <lights_fragment_maps>",`
#if defined( RE_IndirectDiffuse ) && defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
  iblIrradiance += getIBLIrradiance( geometryNormal );
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
  {
    vec3 rv = inverseTransformDirection( reflect( - geometryViewDir, geometryNormal ), viewMatrix );
    rv.y = abs( rv.y ) * 0.9 + 0.02; // never reflect the sky below the horizon
    rv = normalize( mix( normalize( rv ), inverseTransformDirection( geometryNormal, viewMatrix ), material.roughness * material.roughness ) );
    radiance += textureCubeUV( envMap, envMapRotation * rv, material.roughness ).rgb * envMapIntensity;
  }
#endif`).replace("#include <fog_fragment>",`#include <fog_fragment>
#ifndef WATER_POND
if ( wHorizon > 0.0 ) {
#ifdef USE_ENVMAP
  vec3 hz = textureCubeUV( envMap, envMapRotation * normalize( vWPos - cameraPosition ), 0.0 ).rgb;
  #ifdef TONE_MAPPING
  hz = toneMapping( hz );
  #endif
  hz = linearToOutputTexel( vec4( hz, 1.0 ) ).rgb;
#else
  vec3 hz = gl_FragColor.rgb;
  #ifdef USE_FOG
  hz = fogColor;
  #endif
#endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, hz, wHorizon );
}
#endif`)},t.customProgramCacheKey=()=>(s?"roadster-pond-3":"roadster-bay-3")+(B(t)?"-refr":""),t}function Pe(){const n=[{r1:10,n:48,k:.065,min:.45},{r1:80,n:96,k:.065,min:0},{r1:420,n:192,k:.033,min:0},{r1:3e4,n:192,k:.2,min:0}],e=[];let a=.5,s=0;for(e.push({r:0,n:1});a<3e4;){for(;s<n.length-1&&a>=n[s].r1;)s++;const l=n[s];e.push({r:a,n:l.n}),a+=Math.max(l.min,a*l.k)}e.push({r:3e4,n:192});const c=[],t=[],o=[];for(const l of e){if(o.push(c.length/3),l.n===1){c.push(0,0,0);continue}for(let v=0;v<l.n;v++){const i=v/l.n*Math.PI*2;c.push(Math.cos(i)*l.r,0,Math.sin(i)*l.r)}}for(let l=1;l<e.length;l++){const v=e[l-1],i=e[l],m=o[l-1],h=o[l];if(v.n===1){for(let u=0;u<i.n;u++)t.push(m,h+(u+1)%i.n,h+u);continue}if(i.n===v.n)for(let u=0;u<v.n;u++){const g=(u+1)%v.n;t.push(m+u,m+g,h+g,m+u,h+g,h+u)}else for(let u=0;u<v.n;u++){const g=(u+1)%v.n,w=h+2*u,d=h+2*u+1,p=h+(2*u+2)%i.n;t.push(m+u,d,w,m+u,m+g,d,m+g,p,d)}}const r=new Float32Array(c.length);for(let l=1;l<r.length;l+=3)r[l]=1;const f=new he;return f.setAttribute("position",new pe(c,3)),f.setAttribute("normal",new ve(r,3)),f.setIndex(c.length/3>65535?new we(t,1):new ge(t,1)),f.boundingSphere=new xe(new re,3e4),f}class qe{constructor({material:e,level:a}){this.material=e,this.level=a,this.mesh=null}build(){const e=new le(Pe(),this.material);e.name="bay",e.frustumCulled=!1,e.receiveShadow=!0,e.castShadow=!1,e.renderOrder=1,e.matrixAutoUpdate=!1,e.matrixWorldAutoUpdate=!1;const a=this.material.userData.u,s=this.level,c=.5;return e.onBeforeRender=(t,o,r)=>{const f=r.matrixWorld.elements;e.matrixWorld.makeTranslation(Math.round(f[12]/c)*c,s,Math.round(f[14]/c)*c),r.far&&(a.uFar.value=r.far),a.uRefractOn!==void 0&&We(this.material,t,r)},this.mesh=e,e}update(e,a){const s=this.material.userData.u;s.uTime.value=e,s.uNight.value=a}}export{Ae as W,Ge as a,Ne as b,Ze as c,qe as d,Ve as e,Ue as f,Le as g,Xe as m,He as s,We as u,Ie as w};
