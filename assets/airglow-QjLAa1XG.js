import{H as S,V as N,C as G,I as b,a as g,i as x,M as A,a1 as P,x as W,S as H,aO as O,A as V}from"./three.module-B_yomNYV.js";const k=3.1,K=`
attribute vec4 iA; // x, y (head), z, height
attribute vec4 iB; // radius at the ground, intensity, -, -
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  // unit cone: y 0 (head) .. -1 (ground), radius 0.08 .. 1
  float t = -position.y;
  vec3 p = vec3(position.x * iB.x, position.y * iA.w, position.z * iB.x);
  vec3 w = iA.xyz + p;
  vT = t; vK = iB.y; vW = w;
  vN = normalize(vec3(position.x, 0.25 * iB.x / max(iA.w, 1.0), position.z));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,E=`
uniform vec3 uCol; uniform float uGain;
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float facing = abs(dot(normalize(vN), V));
  float rim = pow(facing, 2.2);                          // soft at the silhouette (thin path through the haze)
  float along = (1.0 - smoothstep(0.55, 0.98, vT)) * (0.35 + 0.65 * exp(-vT * 2.2)); // bright under the head, gone at the ground
  float dc = length(cameraPosition - vW);
  float near = smoothstep(2.5, 9.0, dc);                 // no haze wall in the walker's face
  float far = 1.0 - smoothstep(70.0, 120.0, dc);
  float a = rim * along * near * far * vK * uGain;
  gl_FragColor = vec4(uCol * a, 1.0);
}`,I=`
attribute vec4 iA; // x, y, z, size (m)
attribute vec4 iC; // r, g, b, intensity
uniform float uHaze;
varying vec2 vUv; varying vec3 vC;
void main() {
  vec4 vp = viewMatrix * vec4(iA.xyz, 1.0);
  float d = -vp.z;
  // near: the size in metres; far: at least ~a few pixels (the haze spreads it), dimmed by the haze
  float s = max(iA.w, d * 0.0042);
  vec3 dir = normalize(vp.xyz);
  vp.xyz -= dir * min(0.8, d * 0.1);                     // pulled toward the camera: not cut by its own lamp housing
  vp.xy += position.xy * s;
  float fade = exp(-d * uHaze) * smoothstep(1.5, 6.0, d) * iC.w;
  vC = iC.rgb * fade * (iA.w / s);                       // energy kept roughly constant as the disc grows
  vUv = position.xy;
  gl_Position = projectionMatrix * vp;
}`,j=`
uniform float uGain;
varying vec2 vUv; varying vec3 vC;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 7.0) * 0.8 + exp(-r2 * 30.0) * 0.6;
  g *= 1.0 - r2;
  gl_FragColor = vec4(vC * g * uGain, 1.0);
}`,L=`
attribute vec4 iA; // x, y, z, yaw
attribute vec4 iB; // length, width, intensity, -
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  // unit cone along -z: z 0 (lamp) .. -1 (end), radius 0.1 .. 1
  float c = cos(iA.w), s = sin(iA.w);
  vec3 p = vec3(position.x * iB.y, position.y * iB.y * 0.45 + position.z * iB.x * 0.06, position.z * iB.x);
  vec3 w = iA.xyz + vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  vec3 n = vec3(position.x, position.y, 0.0);
  vN = vec3(n.x * c, n.y, -n.x * s);
  vT = -position.z; vK = iB.z; vW = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,R=`
uniform vec3 uCol; uniform float uGain;
varying float vT; varying vec3 vN; varying vec3 vW; varying float vK;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float rim = pow(abs(dot(normalize(vN + 1e-4), V)), 2.0);
  float along = exp(-vT * 3.0) * (1.0 - smoothstep(0.6, 1.0, vT));
  float near = smoothstep(2.0, 6.0, length(cameraPosition - vW));
  gl_FragColor = vec4(uCol * rim * along * near * vK * uGain, 1.0);
}`,z=(y,a,d)=>new H({vertexShader:y,fragmentShader:a,uniforms:d,transparent:!0,depthWrite:!1,depthTest:!0,blending:V,side:O,fog:!1,toneMapped:!0});function q(y=18){const a=new W(.08,1,1,y,6,!0);return a.translate(0,-.5,0),a}class X{constructor(a){this.world=a.world,this.group=new S,this.group.name="airglow-nyc",this.heads=a.world.props&&a.world.props.lampHeads||[],this.counts={cones:0,halos:0,beams:0},this.coneRange=a.coneRange??110,this._last=new N(1e9,0,0),this._cam=new N;const d=new G(1,.6,.3);if(a.cones!==!1){const t=a.maxCones??40,e=new b().copy(q());e.instanceCount=0,this.coneA=new g(new Float32Array(t*4),4).setUsage(x),this.coneB=new g(new Float32Array(t*4),4).setUsage(x),e.setAttribute("iA",this.coneA),e.setAttribute("iB",this.coneB),this.coneMat=z(K,E,{uCol:{value:d.clone()},uGain:{value:.5*(a.gain??1)}}),this.cones=new A(e,this.coneMat),this.cones.frustumCulled=!1,this.cones.name="lamp-cones",this.cones.renderOrder=5,this.coneMax=t,this.group.add(this.cones)}const c=[];for(const t of this.heads)c.push([t[0],t[1]-.15,t[2],.55,1,.62,.32,1]);for(const t of a.signs||[]){if(t.kind!=="screen"&&t.kind!=="fascia"&&t.kind!=="marquee"&&t.kind!=="blade")continue;const e=Math.max(t.r,t.g,t.b)||1;c.push([t.sx??t.x,t.sy??t.y,t.sz??t.z,Math.min(6,1.2+(t.range||8)*.12),t.r/e,t.g/e,t.b/e,.16])}for(const t of a.beacons||[])c.push([t[0],t[1],t[2],.5,1,.08,.04,2.2]);if(c.length){const t=new P(2,2),e=new b;e.index=t.index,e.setAttribute("position",t.getAttribute("position"));const i=new Float32Array(c.length*4),r=new Float32Array(c.length*4);c.forEach((h,s)=>{i.set(h.slice(0,4),s*4),r.set(h.slice(4,8),s*4)}),e.setAttribute("iA",new g(i,4)),e.setAttribute("iC",new g(r,4)),e.instanceCount=c.length,this.haloMat=z(I,j,{uGain:{value:.8*(a.gain??1)},uHaze:{value:.0016}}),this.halos=new A(e,this.haloMat),this.halos.frustumCulled=!1,this.halos.name="lamp-halos",this.halos.renderOrder=6,this.group.add(this.halos),this.counts.halos=c.length}if(this.carsN=a.cars??10,this.carsN>0&&a.world.traffic){const t=this.carsN*2,e=new W(.1,1,1,12,4,!0);e.rotateX(Math.PI/2),e.translate(0,0,-.5);const i=new b().copy(e);i.instanceCount=0,this.beamA=new g(new Float32Array(t*4),4).setUsage(x),this.beamB=new g(new Float32Array(t*4),4).setUsage(x),i.setAttribute("iA",this.beamA),i.setAttribute("iB",this.beamB),this.beamMat=z(L,R,{uCol:{value:new G(1,.92,.8)},uGain:{value:.07*(a.gain??1)}}),this.beams=new A(i,this.beamMat),this.beams.frustumCulled=!1,this.beams.name="head-beams",this.beams.renderOrder=5,this.group.add(this.beams),this._pose={},this._d=new Float32Array(512),this._i=new Int32Array(512)}a.scene.add(this.group)}update(a){const d=this.world,c=d.atmo.darkness>.3;if(this.group.visible=c,!c)return;const t=this._cam.setFromMatrixPosition(a.matrixWorld);if(this.cones&&this._last.distanceToSquared(t)>9){this._last.copy(t);const i=this.coneA.array,r=this.coneB.array,h=this.coneRange**2;let s=0;for(const l of this.heads){if(s>=this.coneMax)break;if((l[0]-t.x)**2+(l[2]-t.z)**2>h)continue;const m=d.getGroundHeight(l[0],l[2]),o=l[1]-m-.25-k;o>2&&(i[s*4]=l[0],i[s*4+1]=l[1]-.25,i[s*4+2]=l[2],i[s*4+3]=o,r[s*4]=o*.55,r[s*4+1]=1,s++)}this.cones.geometry.instanceCount=s,this.counts.cones=s,this.coneA.needsUpdate=!0,this.coneB.needsUpdate=!0}const e=d.traffic;if(this.beams&&e&&e.count){const i=this._pose,r=this._d,h=this._i;let s=0;for(let n=0,v=Math.min(e.count,512);n<v;n++){if(e.pose(n,i),!i.active)continue;const w=(i.x-t.x)**2+(i.z-t.z)**2;w>8100||(r[s]=w,h[s]=n,s++)}const l=Math.min(this.carsN,s),f=this.beamA.array,m=this.beamB.array;let o=0;for(let n=0;n<l;n++){let v=n;for(let u=n+1;u<s;u++)r[u]<r[v]&&(v=u);const w=r[n];r[n]=r[v],r[v]=w;const F=h[n];h[n]=h[v],h[v]=F,e.pose(h[n],i);const p=e.vehicles&&e.vehicles[h[n]],C=p?p.L:4.6,B=p&&p.W?p.W:1.8,M=-Math.sin(i.yaw),_=-Math.cos(i.yaw),T=-_,U=M;for(const u of[-.36,.36])f[o*4]=i.x+M*C*.5+T*u*B,f[o*4+1]=i.y+.7,f[o*4+2]=i.z+_*C*.5+U*u*B,f[o*4+3]=i.yaw,m[o*4]=9,m[o*4+1]=1.5,m[o*4+2]=1,o++}this.beams.geometry.instanceCount=o,this.counts.beams=o,this.beamA.needsUpdate=!0,this.beamB.needsUpdate=!0}}}export{X as AirGlow};
