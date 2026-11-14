import{b2 as F,j as I,F as S,C as _,V as O,aZ as W,a_ as D,S as E,D as j,A as K,M as P}from"./three.module-B_yomNYV.js";import{baleBlock as H,bench as G,bankWall as U,bridge as Y,rngAt as V,vgrad as k,reeds as L,hauntedHouse as R,chamferBox as X,doormat as $,doormatGlow as A,jackOLantern as N,hayBale as Z,hollowOak as q,cottage as J,pickets as Q,signpost as C,standingStone as oo,well as to}from"./props-g9i9K76n.js";import"./BufferGeometryUtils-DLVI-17q.js";import"./noise-g5kHFeMn.js";function B(c,x,l,s,t,o,n,e,r,m){const f=Math.round(Math.cos(s)),a=Math.round(Math.sin(s));let p=1/0,i=-1/0,h=1/0,d=-1/0;for(const[v,w]of[[t,n],[o,n],[o,e],[t,e]]){const u=x+v*f+w*a,g=l-v*a+w*f;p=Math.min(p,u),i=Math.max(i,u),h=Math.min(h,g),d=Math.max(d,g)}return c.addStaticBox(p,r,i,m,h,d)}function T(c,x,l,s,t,o,n=0){const e=Math.cos(s),r=Math.sin(s);let m=1/0;for(let f=-t;f<=t+1e-6;f+=t/3)for(let a=-o;a<=o+n+1e-6;a+=(o+n/2)/3)m=Math.min(m,c(x+f*e+a*r,l-f*r+a*e));return m}function ro(c,x,l,s,t,o){const n=o.build,e=o.floor,{w:r,d:m}=n,f=T(t,o.x,o.z,o.yaw,r/2,m/2,n.deckD),a=J(c,x,l,{x:o.x,y:e,z:o.z,yaw:o.yaw,foot:Math.max(.3,e-f+.35),...n}),p=a.deck,i=(h,d,v,w,u)=>B(s,o.x,o.z,o.yaw,h,d,v,w,Math.min(f,e)-1,u);i(-r/2-.12,r/2+.12,-m/2-.12,m/2+.02,e+5.3),i(p.x0,p.x1,p.z0,p.z1,a.deckTop),i(p.x0-.35,p.x1+.35,p.z0,p.z1+.35,e+.15);for(const[h,d,v]of p.rails)i(h-.07,d+.07,v-.07,v+.07,a.deckTop+.95);return Object.assign(o,{lamp:a.lamp,railing:a.railing,chimney:a.chimney,halos:{lamp:a.lampHalo,mat:a.matHalo,railing:a.railingHalo,window:a.windowHalo},window:a.window}),o.mat.y=a.deckTop,a}function lo(c,x,l,s,t,o,n){const{w:e,d:r}=n,m=o.floor-.2,f=T(t,o.x,o.z,o.yaw,e/2+.7,r/2,2.4),a=R(c,x,l,{x:o.x,y:m,z:o.z,w:e,d:r,yaw:o.yaw,door:!1,lamp:"lamp",tower:0});k(c.add(X(e+.6,m-f+.5,r+.5,.06),"#433e4c",o.x,(f+m+.4)/2-.15,o.z,o.yaw),.5,.9);const p=(g,y,z,M,b)=>B(s,o.x,o.z,o.yaw,g,y,z,M,f-1,b),i=m+.5,h=r/2+1.85;p(-e/2-.75,e/2+.15,-r/2-.15,r/2+.02,m+9),p(-1.1,3.5,r/2,r/2+2,i),p(-1.45,3.85,r/2,r/2+2.75,m+.35);for(const[g,y]of[[-.95,.35],[2.05,3.35]])p(g-.08,y+.08,h-.08,h+.08,i+.95);const d=a.at(1.2,.5,r/2+.85);$(c,x,{x:d[0],z:d[2],yaw:o.yaw}),l.use(a.lamp),A(x,{x:d[0],y:i,z:d[2],yaw:o.yaw});const v=l.spot(d[0],i+.35,d[2],2.3,.2,.16,.09,.1,a.lamp);l.glow("steady",0);const w=a.at(2.36,1.5,h),u=N(c,x,l,{x:w[0],y:w[1],z:w[2],yaw:o.yaw+.3,r:.16});return Object.assign(o,{lamp:a.lamp,railing:u.group,chimney:a.chimney,halos:{lamp:a.lampHalo,mat:v,railing:u.halo,window:-1},window:-1}),o.mat.y=i,a}function fo(c,x,l,s,t,o,n){const e=(o.z0+o.z1)/2,r=o.depth>o.ford,m=[];let f=-(o.x-.2);for(const i of[...n].sort((h,d)=>h.x-d.x))m.push([f,i.x-i.w/2]),f=i.x+i.w/2;if(m.push([f,o.x-.2]),r)for(const i of[!0,!1]){const h=i?o.z0-.02:o.z1+.02;for(const[d,v]of m){const w=Math.max(1,Math.ceil((v-d)/4));for(let u=0;u<w;u++){const g=d+(v-d)*u/w,y=d+(v-d)*(u+1)/w;let z=-1/0,M=1/0;for(let b=g;b<=y+1e-6;b+=.5)z=Math.max(z,t(b,h)),M=Math.min(M,t(b,e));U(c,{x0:g,x1:y,zf:i?o.z0+o.lip:o.z1-o.lip,dir:i?1:-1,topY:z,bedY:M}),s.addStaticBox(g,M-1,y,z,i?o.z0:o.z1-o.lip,i?o.z0+o.lip:o.z1)}}}for(const i of n){const h=i.w/2;let d=-1/0,v=1/0;for(const u of[i.x-h,i.x,i.x+h])d=Math.max(d,t(u,o.z0-.4),t(u,o.z1+.4)),v=Math.min(v,t(u,e));d+=.03;const w=Y(c,x,l,{x:i.x,y:d,z0:o.z0,z1:o.z1,w:i.w,bedY:v});s.addStaticBox(i.x-h,v-1,i.x+h,d,o.z0,o.z1);for(const u of[-1,1])s.addStaticBox(i.x+u*h-.09,v-1,i.x+u*h+.09,d+1.06,o.z0-.5,o.z1+.5);Object.assign(i,{y:d,bed:v,candles:w.candles.map(([u,g,y,z,M])=>({group:u,halo:g,x:y,y:z,z:M}))})}const a=V(o.z0,o.z1,7),p=i=>n.every(h=>Math.abs(i-h.x)>h.w/2+1.2);for(let i=-o.x+1.5;i<o.x-1;i+=2.2+a()*2.6){if(!p(i))continue;const h=e+(a()-.5)*(o.z1-o.z0-2*o.lip-.6),d=t(i,h),v=c.add(new F(.16+a()*.2,0),a()<.5?"#3c3842":"#47434d",i,d+.02,h,a()*6,a(),0,1.3,.5,1);if(k(v,.5,1,.06,a()*1e6|0),a()<.45){const w=a()<.5,u=w?o.z0+o.lip+.25:o.z1-o.lip-.25;L(c,{x:i+(a()-.5)*1.5,y:t(i,u),z:u,n:5+(a()*4|0),h:r?1.2+a()*.5:.9})}}return n}const ao=`
attribute float kind;
varying vec3 vW;
varying float vK;
varying float vE;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz; vK = kind; vE = uv.y;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,no=`
uniform float uT;
uniform vec3 uMoon;
uniform vec3 uGlint;
varying vec3 vW;
varying float vK;
varying float vE;
#include <fog_pars_fragment>
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float vnoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
void main() {
  vec2 p = vW.xz;
  float edge = smoothstep( 0.0, 0.12, vE ) * smoothstep( 1.0, 0.88, vE ) * smoothstep( 49.8, 48.0, abs( p.x ) );
  vec3 col;
  if ( vK < 0.5 ) {
    // ripples drifting downstream (+x): a perturbed normal; the low moon's glint in it, a cold sheen at grazing angles
    float a = sin( p.x * 3.1 - uT * 1.4 + sin( p.y * 2.3 ) * 1.2 ) + 0.6 * sin( p.x * 1.7 + p.y * 4.3 - uT * 0.9 ) + 0.25 * sin( ( p.x + p.y ) * 7.0 - uT * 2.6 );
    float b = cos( p.y * 5.2 + uT * 1.1 + sin( p.x * 0.8 ) ) + 0.5 * cos( ( p.x - p.y ) * 3.3 - uT * 1.7 );
    vec3 n = normalize( vec3( a * 0.08, 1.0, b * 0.08 ) );
    vec3 v = normalize( cameraPosition - vW );
    float m = max( dot( reflect( - v, n ), uMoon ), 0.0 );
    float fres = pow( 1.0 - max( v.y, 0.0 ), 3.0 );
    col = vec3( 0.006, 0.012, 0.026 ) + vec3( 0.03, 0.045, 0.075 ) * fres + uGlint * ( pow( m, 90.0 ) * 1.6 + pow( m, 14.0 ) * 0.1 );
    float sp = max( 0.0, sin( p.x * 13.0 - uT * 3.0 ) * sin( p.y * 17.0 + uT * 2.2 ) * sin( ( p.x - p.y ) * 9.0 + uT ) );
    col += vec3( 0.22, 0.28, 0.38 ) * pow( sp, 14.0 ) * ( 0.3 + fres );
    col *= edge;
  } else {
    // mist: soft noise drifting downstream, thicker at the middle of the creek
    float m = vnoise( vec2( p.x * 0.32 - uT * ( 0.18 + 0.06 * vK ), p.y * 0.9 + vK * 3.7 ) ) * vnoise( vec2( p.x * 0.11 + vK, p.y * 0.4 - uT * 0.05 ) );
    col = vec3( 0.05, 0.05, 0.08 ) * smoothstep( 0.12, 0.55, m ) * edge * edge;
  }
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogF = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogF = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    col *= 1.0 - fogF;
  #endif
  gl_FragColor = vec4( col, 1.0 );
}`;function mo(c,x,l){const s=(c.z0+c.z1)/2,t=[],o=[],n=[],e=[],r=[[0,c.z0+c.lip-.05,c.z1-c.lip+.05,.2],[1,c.z0+c.lip+.2,c.z1-c.lip-.2,.6],[2,c.z0+c.lip+.4,c.z1-c.lip-.4,1]],m=c.x-.2;for(const[h,d,v,w]of r){const u=t.length/3;let g=0;for(let y=-m;y<=m+1e-6;y+=2,g++){const z=x(y,s)+w;t.push(y,z,d,y,z,v),o.push(y,0,y,1),n.push(h,h)}for(let y=0;y<g-1;y++){const z=u+y*2;e.push(z,z+1,z+2,z+2,z+1,z+3)}}const f=new I;f.setAttribute("position",new S(t,3)),f.setAttribute("uv",new S(o,2)),f.setAttribute("kind",new S(n,1)),f.setIndex(e),f.computeBoundingSphere();const a={...W.clone(D.fog),uT:l,uMoon:{value:new O(0,.2,-1).normalize()},uGlint:{value:new _(.75,.8,1)}},p=new E({uniforms:a,vertexShader:ao,fragmentShader:no,transparent:!0,depthWrite:!1,blending:K,side:j,fog:!0}),i=new P(f,p);return i.name="creekWater",i.renderOrder=4,i.frustumCulled=!0,i}function ho(c,x,l,s){for(const t of s){const o=(t.x0+t.x1)/2,n=(t.z0+t.z1)/2,e=Math.min(l(t.x0,t.z0),l(t.x1,t.z0),l(t.x0,t.z1),l(t.x1,t.z1)),r=l(o,n);H(c,{x:o,y:e,z:n,w:t.x1-t.x0,h:r+t.h-e,d:t.z1-t.z0,course:(r+t.h-e)/Math.max(1,Math.round((r+t.h-e)/.36))}),x.addStaticBox(t.x0,e-1,t.x1,r+t.h,t.z0,t.z1),t.top=r+t.h}}function xo(c,x,l,s,t,o){for(const[n,e,r]of s){const m=l(n,e);oo(c,{x:n,y:m,z:e,h:r,yaw:Math.atan2(t-n,o-e)}),x.addStaticBox(n-.4,m-1,n+.4,m+r-.2,e-.4,e+.4)}}function po(c,x,l,s,t,o,n){const e=t(o,n),r=e+4,m=q(c,x,l,{x:o,y:e,z:n,open:Math.PI/4}),f=.95,a=1.45;return s.addStaticBox(o-a,e-1,o+a,r,n-a,n-f),s.addStaticBox(o-a,e-1,o-f,r,n-f,n+a),s.addStaticBox(o-f,e-1,o-.05,r,n+f,n+a),s.addStaticBox(o+f,e-1,o+a,r,n-f,n-.05),m}function uo(c,x,l,s,t){for(const[o,n]of t){Q(c,o,s,n,s,l,1);const e=Math.max(1,Math.ceil((n-o)/4));for(let r=0;r<e;r++){const m=o+(n-o)*r/e,f=o+(n-o)*(r+1)/e;let a=-1/0;for(let p=m;p<=f+1e-6;p+=.5)a=Math.max(a,l(p,s));x.addStaticBox(m,a-5,f,a+1,s-.1,s+.1)}}}function vo(c,x,l,s,t,o){const n=l(s,t);Z(c,{x:s,y:n,z:t,ry:o}),x.addStaticBox(s-.65,n-1,s+.65,n+1.1,t-.65,t+.65)}function yo(c,x,l,s,t){const o=l(s,t);to(c,{x:s,y:o,z:t,yaw:.5}),x.addStaticBox(s-1.1,o-1,s+1.1,o+.95,t-1.1,t+1.1)}function wo(c,x,l,s,t,o){const n=l(s,t);C(c,{x:s,y:n,z:t,arms:o}),x.addStaticBox(s-.15,n-1,s+.15,n+2.7,t-.15,t+.15)}function zo(c,x,l,s,t,o){const n=l(s,t);G(c,{x:s,y:n,z:t,yaw:o});const e=Math.abs(Math.cos(o))>.7;x.addStaticBox(s-(e?.9:.35),n-1,s+(e?.9:.35),n+.5,t-(e?.35:.9),t+(e?.35:.9))}export{ho as baleYard,zo as benchAt,fo as creek,mo as creekWater,lo as hauntedPorch,vo as hayBale,po as hollowOak,B as localBox,ro as porchCottage,uo as rowFences,wo as signpostAt,xo as standingStones,yo as wellAt};
