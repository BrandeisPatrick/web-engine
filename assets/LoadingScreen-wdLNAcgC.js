import{ai as lo,u as qe,bg as ho,bh as Ls,aj as Ns,aY as Ga,V as b,g as Ct,S as ee,ar as co,U as Fe,w as uo,v as La,bi as mi,bj as fs,A as Na,a as L,f as T,bk as fo,p as Be,ah as N,l as ii,aP as go,b0 as pi,D as ai,R as ie,a5 as st,z as O,a9 as at,K as Oe,s as Dt,a6 as Mt,bl as ri,bm as mo,bn as po,W as Y,N as Ae,bo as Us,aN as Ci,bp as Co,bq as gs,bc as Io,br as Bo,H,bs as Eo,bt as vo,F as $e,ak as wo,c as Ii,X as me,bu as xo,M as z,aq as _o,bv as Ua,b as ge,al as yo,Y as Qo,d as So,bw as Ft,bx as it,by as bo,b3 as Do,aJ as Mo,aL as ds,bz as Fo,bA as Ro,bB as Oa,aM as To,bC as Bi,bD as es,bE as ts,bF as ko,bG as Po,bH as Go,bI as Lo,bJ as Ei,bK as vi,bL as ss,bM as ms,bN as It,bO as oi,bP as ni,J as gt,bQ as za,ba as No,aS as Uo,bR as Ha,bS as qa,bT as Va,bU as Oo,bV as zo,ag as Ho,j as qo,bW as Vo,b7 as wi,b6 as Jo}from"./three.module--UGqIKUS.js";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function t(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(i){if(i.ep)return;i.ep=!0;const r=t(i);fetch(i.href,r)}})();class jo{constructor(e,{window:t=60}={}){if(this.renderer=e,this.gl=e?e.getContext():null,this.ext=this.gl?this.gl.getExtension("EXT_disjoint_timer_query_webgl2"):null,this.gpuRenderer="",this.gl)try{let s=String(this.gl.getParameter(this.gl.RENDERER)||"");if(!s||/^WebKit WebGL$/i.test(s)){const i=this.gl.getExtension("WEBGL_debug_renderer_info");i&&(s=String(this.gl.getParameter(i.UNMASKED_RENDERER_WEBGL)||s))}this.gpuRenderer=s}catch{}this.gpuApprox=!!this.ext&&/ANGLE/i.test(this.gpuRenderer)&&/Metal/i.test(this.gpuRenderer),this._px=new Uint8Array(4),this.win=t,this.cpu=new Map,this.gpu=new Map,this._open=new Map,this._queries=[],this._gpuActive=null,this.frame={ms:0,avg:0,interval:0,fps:0,refresh:0,calls:0,triangles:0,memory:null,steps:0},this._frameStart=0,this.enabled=!0}begin(e){this.enabled&&this._open.set(e,performance.now())}end(e){if(!this.enabled)return;const t=this._open.get(e);t!==void 0&&this._fold(this.cpu,e,performance.now()-t)}record(e,t){this.enabled&&this._fold(this.cpu,e,t)}scope(e,t){this.begin(e);try{return t()}finally{this.end(e)}}gpuBegin(e){if(!this.ext||this._gpuActive)return;const t=this.gl.createQuery();this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,t),this._gpuActive={name:e,q:t}}gpuEnd(){!this.ext||!this._gpuActive||(this.gl.endQuery(this.ext.TIME_ELAPSED_EXT),this._queries.push(this._gpuActive),this._gpuActive=null)}frameBegin(){this._frameStart=performance.now()}frameEnd(e){const t=performance.now()-this._frameStart,s=this.frame;s.ms=t,s.avg+=(t-s.avg)/Math.min(this.win,120),e>0&&(s.interval+=(e*1e3-s.interval)/(s.interval?Math.min(this.win,120):1));const i=s.interval||s.avg;s.fps=i>0?1e3/i:0,this.renderer&&(s.calls=this.renderer.info.render.calls,s.triangles=this.renderer.info.render.triangles,s.memory=this.renderer.info.memory),this._collectGpu()}_collectGpu(){if(!this.ext)return;const e=this.gl,t=e.getParameter(this.ext.GPU_DISJOINT_EXT);for(let s=this._queries.length-1;s>=0;s--){const{name:i,q:r}=this._queries[s];e.getQueryParameter(r,e.QUERY_RESULT_AVAILABLE)&&(t||this._fold(this.gpu,i,e.getQueryParameter(r,e.QUERY_RESULT)/1e6),e.deleteQuery(r),this._queries.splice(s,1))}if(this._queries.length>32)for(const{q:s}of this._queries.splice(0,16))e.deleteQuery(s)}benchThroughput(e,t=60,{warmup:s=3}={}){if(typeof e!="function")throw new Error("Profiler.benchThroughput: renderFn required");t=Math.max(1,t|0);for(let o=0;o<s;o++)e(-1-o);this._sync();const i=performance.now();for(let o=0;o<t;o++)e(o);this._sync();const r=(performance.now()-i)/t;return this.lastBench={frames:t,ms:r,fps:1e3/r},r}_sync(){const e=this.gl,t=this.renderer;if(!e)return;const s=t&&t.getRenderTarget?t.getRenderTarget():null;s&&t.setRenderTarget&&t.setRenderTarget(null),e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,this._px),s&&t.setRenderTarget&&t.setRenderTarget(s)}_fold(e,t,s){let i=e.get(t);i||(i={last:0,avg:s,max:0,n:0},e.set(t,i)),i.last=s,i.avg+=(s-i.avg)/Math.min(this.win,i.n+1),i.max=Math.max(i.max*.98,s),i.n++}snapshot(){const e=[];for(const[t,s]of this.cpu)e.push({scope:`cpu:${t}`,avg:+s.avg.toFixed(2),max:+s.max.toFixed(2)});for(const[t,s]of this.gpu)e.push({scope:`gpu:${t}`,avg:+s.avg.toFixed(2),max:+s.max.toFixed(2),...this.gpuApprox?{approx:!0}:{}});return e.push({scope:"frame(cpu)",avg:+this.frame.avg.toFixed(2),max:+this.frame.ms.toFixed(2),fps:+this.frame.fps.toFixed(0),hz:+this.frame.refresh.toFixed(0),calls:this.frame.calls,tris:this.frame.triangles}),e}}class Ko{constructor(e,t=document.body,s={}){this.p=e,this.visible=!1,this._t=0,this.el=document.createElement("pre"),Object.assign(this.el.style,{position:"fixed",left:"50%",top:"8px",transform:"translateX(-50%)",margin:0,padding:"6px 8px",font:"11px/1.35 ui-monospace, Menlo, monospace",color:"#cfe",background:"rgba(0,0,0,.55)",borderRadius:"6px",zIndex:50,display:"none",pointerEvents:"none",whiteSpace:"pre",...s}),t.appendChild(this.el),this._onKey=i=>{i.code==="F3"&&(i.preventDefault(),this.toggle())},window.addEventListener("keydown",this._onKey)}dispose(){window.removeEventListener("keydown",this._onKey),this.el.remove()}toggle(e=!this.visible){this.visible=e,this.el.style.display=e?"block":"none"}update(e){if(!this.visible||(this._t+=e,this._t<.25))return;this._t=0;const t=this.p.frame;let s=`${t.fps.toFixed(0)} fps${t.refresh?` / ${t.refresh.toFixed(0)} Hz`:""}  cpu ${t.avg.toFixed(1)} ms  calls ${t.calls}  tris ${(t.triangles/1e6).toFixed(2)}M  steps ${t.steps}
`;for(const[r,o]of this.p.cpu)s+=`cpu ${r.padEnd(12)} ${o.avg.toFixed(2).padStart(6)} ms
`;const i=this.p.gpuApprox?"gpu~":"gpu ";for(const[r,o]of this.p.gpu)s+=`${i}${r.padEnd(12)} ${o.avg.toFixed(2).padStart(6)} ms
`;t.memory&&(s+=`geom ${t.memory.geometries}  tex ${t.memory.textures}`),this.el.textContent=s}}class Yo{constructor(e={}){this._timeScale=1,this.timeScale=e.timeScale,this.paused=!!e.paused,this.time=0,this.unscaledTime=0,this.frame=0,this._steps=0}get timeScale(){return this._timeScale}set timeScale(e){this._timeScale=Number.isFinite(e)&&e>=0?e:1}scale(e){return this.paused||!(e>=0)?0:e*this._timeScale}advance(e){e>=0||(e=0);const t=this.paused?0:e*this._timeScale;return this.unscaledTime+=e,this.time+=t,this.frame++,t}step(e=1){return e=Math.floor(e),e>0&&e<1/0&&(this._steps+=e),this}takeSteps(){const e=this._steps;return this._steps=0,e}get pendingSteps(){return this._steps}pause(){return this.paused=!0,this}resume(){return this.paused=!1,this._steps=0,this}toggle(){return this.paused?this.resume():this.pause(),this.paused}}const xi=()=>{},fe=()=>performance.now();class nh{constructor(e={}){this.container=e.container||document.body,this.fixedDt=1/(e.fixedHz||120),this.maxSubsteps=e.maxSubsteps||4,this.clock=e.clock||new Yo,this.systems=[],this.physics=e.physics||null,this.renderer=new lo({antialias:!0,powerPreference:"high-performance",...e.renderer||{}}),this.renderer.outputColorSpace=qe,this.renderer.toneMapping=ho,this.renderer.toneMappingExposure=e.exposure??.9,this.renderer.shadowMap.enabled=e.shadows!==!1,this.renderer.shadowMap.type=e.shadowType??Ls,this.renderer.info.autoReset=!1,this.container.appendChild(this.renderer.domElement),this.scene=new Ns,this.camera=new Ga(e.fov||60,1,e.near||.1,e.far||6e3),this.profiler=new jo(this.renderer),this.overlay=e.overlay===!1?null:new Ko(this.profiler,e.overlayParent||document.body),this.maxPR=Math.min(window.devicePixelRatio||1,e.maxPixelRatio??2),this.adaptive=e.adaptiveResolution!==!1,this.pixelRatio=this.maxPR,this._frameEMA=1/60,this._prTimer=0,this.targetFps=e.targetFps>0?+e.targetFps:0,this.refreshRate=0,this._rafT=0,this._rafMs=0,this._rafN=0,this._rafLong=0,this._calib=0,this.renderFn=(t,s)=>this.renderer.render(t,s),this.onResize=xi,this.time=0,this.frameCount=0,this.dt=0,this.alpha=0,this.substeps=0,this._running=!1,this._acc=0,this._last=0,this._raf=0,this._profileAt=e.profile?e.profile===!0?10:+e.profile:0,this._onWindowResize=()=>this.resize(),window.addEventListener("resize",this._onWindowResize),this.setPixelRatio(this.maxPR),this.resize()}addSystem(e,t){e.__name=t||e.__name||(e.constructor&&e.constructor!==Object?e.constructor.name:"")||`system${this.systems.length}`,e.__ms=0,e.__pr=Number.isFinite(e.priority)?e.priority:0,e.__on===void 0&&(e.__on=!0);const s=this.systems;let i=s.length;for(;i>0&&s[i-1].__pr>e.__pr;)i--;return s.splice(i,0,e),e}setSystemEnabled(e,t=!0){const s=typeof e=="string"?this.getSystem(e):e;return s&&(s.__on=!!t),s}isSystemEnabled(e){const t=typeof e=="string"?this.getSystem(e):e;return!!t&&t.__on!==!1}removeSystem(e){const t=this.systems.indexOf(e);t>=0&&this.systems.splice(t,1)}getSystem(e){return this.systems.find(t=>t.__name===e)||null}async load(e=xi){const t=this.systems.filter(o=>typeof o.load=="function"),s=t.map(o=>Number.isFinite(o.loadWeight)&&o.loadWeight>0?o.loadWeight:1),i=s.reduce((o,n)=>o+n,0)||1;let r=0;for(let o=0;o<t.length;o++){const n=t[o],A=s[o],l=r;await n.load((h,c)=>e((l+A*Math.min(1,Math.max(0,h||0)))/i,c||n.__name)),r+=A}e(1,"Ready")}get size(){return{width:this.container.clientWidth||window.innerWidth,height:this.container.clientHeight||window.innerHeight}}setPixelRatio(e){this.pixelRatio=e;const{width:t,height:s}=this.size;this.renderer.setPixelRatio(e),this.renderer.setSize(t,s),this.onResize(t,s,e)}resize(){const{width:e,height:t}=this.size;this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.renderer.setSize(e,t),this.onResize(e,t,this.pixelRatio)}start(){this._running||(this._running=!0,this._last=fe(),this._rafT=0,this._calib=10,this._raf=requestAnimationFrame(this._frame))}stop(){this._running=!1,cancelAnimationFrame(this._raf)}_frame=e=>{if(!this._running)return;cancelAnimationFrame(this._raf),this._raf=requestAnimationFrame(this._frame);const t=this._rafT?e-this._rafT:0;if(this._rafT=e,t>1&&t<250){const r=this._rafMs;t>r*.7&&t<r*1.5?(this._rafMs=r+(t-r)/Math.min(20,++this._rafN+1),this._rafLong=0,this._rafN>=4&&(this.refreshRate=this.profiler.frame.refresh=1e3/this._rafMs)):(!r||t<r*.7||(this._rafLong+=t)>1e4)&&(this._rafMs=t,this._rafN=0,this._rafLong=0)}if(!this.refreshRate&&this._calib>0){this._calib--,this._last=e;return}const s=this.targetFps;if(s>0&&e-this._last<1e3/s-1)return;let i=(e-this._last)/1e3;this._last=e,i>.25?i=.25:i>=0||(i=0),this.tick(i)};tick(e){const t=this.profiler;t.frameBegin();const s=e>.25?.25:e>=0?e:0,i=this.clock;e=i.advance(s),this.time+=e,this.frameCount++,this.dt=e;const r=this.systems;for(let h=0;h<r.length;h++)r[h].__ms=0;for(let h=0;h<r.length;h++){const c=r[h];if(c.earlyUpdate&&c.__on!==!1){const d=fe();c.earlyUpdate(e),c.__ms+=fe()-d}}this._acc+=e;let o=0,n=i.paused?i.takeSteps():0;const A=fe();for(;o<this.maxSubsteps&&(n>0||this._acc>=this.fixedDt);){for(let h=0;h<r.length;h++){const c=r[h];if(c.fixedUpdate&&c.__on!==!1){const d=fe();c.fixedUpdate(this.fixedDt),c.__ms+=fe()-d}}n>0?n--:this._acc-=this.fixedDt,o++}n>0&&i.step(n),o===this.maxSubsteps&&!i.paused&&(this._acc=0),t.record("sim",fe()-A),this.substeps=o,t.frame.steps=o;const l=this.alpha=this._acc/this.fixedDt;for(let h=0;h<r.length;h++){const c=r[h];if(c.update&&c.__on!==!1){const d=fe();c.update(e,l),c.__ms+=fe()-d}}for(let h=0;h<r.length;h++){const c=r[h];if(c.lateUpdate&&c.__on!==!1){const d=fe();c.lateUpdate(e,l),c.__ms+=fe()-d}}for(let h=0;h<r.length;h++){const c=r[h];(c.earlyUpdate||c.fixedUpdate||c.update||c.lateUpdate)&&t.record(c.__name,c.__ms)}if(t.begin("render"),t.gpuBegin("frame"),this.renderer.info.reset(),this.renderFn(this.scene,this.camera,e),t.gpuEnd(),t.end("render"),this.overlay&&this.overlay.update(s),t.frameEnd(s),this._profileAt&&i.unscaledTime>=this._profileAt&&(this._profileAt=0,console.table(t.snapshot())),this.adaptive&&s<.2&&(this._frameEMA+=(s-this._frameEMA)*.05,this._prTimer+=s,this._prTimer>2)){this._prTimer=0;const h=this.targetFps,c=1/(h>0?Math.min(h,Math.max(this.refreshRate,60)):60);this._frameEMA>c*1.11&&this.pixelRatio>1?this.setPixelRatio(Math.max(1,this.pixelRatio-.25)):this._frameEMA<c*.69&&this.pixelRatio<this.maxPR&&this.setPixelRatio(Math.min(this.maxPR,this.pixelRatio+.25))}}dispose(){this.stop(),window.removeEventListener("resize",this._onWindowResize);for(const e of this.systems)e.dispose&&e.dispose();this.overlay&&this.overlay.dispose(),this.renderer.dispose(),this.renderer.domElement.remove()}}const _i=2048,Bt=(a,e)=>(a+_i)*4096+(e+_i);class yi{constructor(e=32){this.cell=e,this.boxes=[],this.cells=new Map,this._stamp=new Uint32Array(1024),this._q=0}add(e,t,s,i,r,o,n=0){if(!(s>e)||!(o>r)||!(i>t)||![e,t,s,i,r,o].every(Number.isFinite))return-1;const A=this.boxes.length;this.boxes.push({minX:e,minY:t,maxX:s,maxY:i,minZ:r,maxZ:o,kind:n});const l=this.cell,h=Math.floor(e/l),c=Math.floor(s/l),d=Math.floor(r/l),f=Math.floor(o/l);for(let u=h;u<=c;u++)for(let g=d;g<=f;g++){const m=Bt(u,g);let p=this.cells.get(m);p||(p=[],this.cells.set(m,p)),p.push(A)}if(this._stamp.length<this.boxes.length){const u=new Uint32Array(this._stamp.length*2);u.set(this._stamp),this._stamp=u}return A}query(e,t,s,i=[]){if(i.length=0,!Number.isFinite(e)||!Number.isFinite(t))return i;const r=Math.max(0,s||0),o=this.cell,n=Math.floor((e-r)/o),A=Math.floor((e+r)/o),l=Math.floor((t-r)/o),h=Math.floor((t+r)/o);if((A-n+1)*(h-l+1)>4096)return i;++this._q===4294967295&&(this._stamp.fill(0),this._q=1);const d=this._stamp,f=this.boxes;for(let u=n;u<=A;u++)for(let g=l;g<=h;g++){const m=this.cells.get(Bt(u,g));if(m)for(let p=0;p<m.length;p++){const C=m[p];if(d[C]===this._q)continue;d[C]=this._q;const B=f[C],I=e<B.minX?B.minX-e:e>B.maxX?e-B.maxX:0,E=t<B.minZ?B.minZ-t:t>B.maxZ?t-B.maxZ:0;I*I+E*E<=r*r&&i.push(B)}}return i}raycast(e,t,s,i,r,o){if(!Number.isFinite(e)||!Number.isFinite(t)||!(r>0))return r;const n=this.cell;let A=Math.floor(e/n),l=Math.floor(t/n);const h=s>1e-12?1:s<-1e-12?-1:0,c=i>1e-12?1:i<-1e-12?-1:0,d=h?n/Math.abs(s):1/0,f=c?n/Math.abs(i):1/0;let u=h>0?((A+1)*n-e)/s:h<0?(A*n-e)/s:1/0,g=c>0?((l+1)*n-t)/i:c<0?(l*n-t)/i:1/0;++this._q===4294967295&&(this._stamp.fill(0),this._q=1);const p=this._stamp,C=this.boxes,B=this._q;let I=r,E=0;for(let v=0;v<8192&&E<=I;v++){const x=this.cells.get(Bt(A,l));if(x)for(let _=0;_<x.length;_++){const y=x[_];if(p[y]===B)continue;p[y]=B;const D=o(C[y],I);D<I&&(I=D)}if(u<g?(E=u,u+=d,A+=h):(E=g,g+=f,l+=c),E===1/0)break}return I}}function Ah(a,e,t=1.5){let s=1/0,i=-1/0,r=1/0,o=-1/0;for(const[u,g]of a)g<s&&(s=g),g>i&&(i=g),u<r&&(r=u),u>o&&(o=u);if(!(i>s)||!(o>r))return[];const n=e&&e.length?[a,...e]:[a];if(a.length===4&&(!e||!e.length)){let u=!0;for(let g=0;g<4;g++){const m=a[g],p=a[(g+1)%4];if(Math.abs(m[0]-p[0])>.3&&Math.abs(m[1]-p[1])>.3){u=!1;break}}if(u)return[[r,s,o,i]]}const A=Math.max(1,Math.ceil((i-s)/t)),l=(i-s)/A,h=[],c=[];for(let u=0;u<A;u++){const g=s+u*l,m=g+l,p=Wo(n,g+l*.5,c);h.push({z0:g,z1:m,iv:p})}const d=[];let f=[];for(const u of h){const g=[];for(const m of u.iv){const p=f.find(C=>Math.abs(C[0]-m[0])<.35&&Math.abs(C[2]-m[1])<.35&&!C.used);p?(p.used=!0,p[3]=u.z1,g.push(p)):g.push(Object.assign([m[0],u.z0,m[1],u.z1],{used:!0}))}for(const m of f)m.used||d.push([m[0],m[1],m[2],m[3]]);for(const m of g)m.used=!1;f=g}for(const u of f)d.push([u[0],u[1],u[2],u[3]]);return d.filter(u=>u[2]-u[0]>.05&&u[3]-u[1]>.05)}function Wo(a,e,t){t.length=0;for(const i of a)for(let r=0,o=i.length-1;r<i.length;o=r++){const n=i[r][1],A=i[o][1];n>e!=A>e&&t.push(i[r][0]+(e-n)/(A-n)*(i[o][0]-i[r][0]))}t.sort((i,r)=>i-r);const s=[];for(let i=0;i+1<t.length;i+=2)t[i+1]-t[i]>.05&&s.push([t[i],t[i+1]]);return s}class lh{constructor(e=16){this.cell=e,this.segs=[],this.cells=new Map,this._stamp=new Uint32Array(1024),this._q=0}add(e){const t=this.segs.length;this.segs.push(e);const s=this.cell,i=e.hw+1,r=Math.floor((Math.min(e.ax,e.bx)-i)/s),o=Math.floor((Math.max(e.ax,e.bx)+i)/s),n=Math.floor((Math.min(e.az,e.bz)-i)/s),A=Math.floor((Math.max(e.az,e.bz)+i)/s);for(let l=r;l<=o;l++)for(let h=n;h<=A;h++){const c=Bt(l,h);let d=this.cells.get(c);d||(d=[],this.cells.set(c,d)),d.push(t)}if(this._stamp.length<this.segs.length){const l=new Uint32Array(this._stamp.length*2);l.set(this._stamp),this._stamp=l}return t}forEachNear(e,t,s,i){if(!Number.isFinite(e)||!Number.isFinite(t))return;const r=this.cell,o=Math.floor((e-s)/r),n=Math.floor((e+s)/r),A=Math.floor((t-s)/r),l=Math.floor((t+s)/r);++this._q===4294967295&&(this._stamp.fill(0),this._q=1);for(let c=o;c<=n;c++)for(let d=A;d<=l;d++){const f=this.cells.get(Bt(c,d));if(f)for(let u=0;u<f.length;u++){const g=f[u];if(this._stamp[g]===this._q)continue;this._stamp[g]=this._q;const m=this.segs[g],p=m.bx-m.ax,C=m.bz-m.az,B=p*p+C*C;if(B<1e-6)continue;const I=Math.sqrt(B);let E=((e-m.ax)*p+(t-m.az)*C)/B;const v=(m.ext||0)/I;if(E<-v||E>1+v)continue;const x=m.ax+p*E,_=m.az+C*E,y=((e-m.ax)*-C+(t-m.az)*p)/I;Math.abs(y)>m.hw+s||i(m,E<0?0:E>1?1:E,y,Math.hypot(e-x,t-_))}}}}class hh{constructor(e,t,s,i,r){this.minX=e,this.minZ=t,this.res=r,this.w=Math.max(1,Math.ceil((s-e)/r)),this.h=Math.max(1,Math.ceil((i-t)/r)),this.data=new Uint8Array(this.w*this.h)}idx(e,t){const s=Math.floor((e-this.minX)/this.res),i=Math.floor((t-this.minZ)/this.res);return s<0||i<0||s>=this.w||i>=this.h?-1:i*this.w+s}get(e,t){const s=this.idx(e,t);return s<0?0:this.data[s]}fillPolygon(e,t,s="or"){let i=1/0,r=-1/0;for(const l of e)for(const h of l)h[1]<i&&(i=h[1]),h[1]>r&&(r=h[1]);const o=Math.max(0,Math.floor((i-this.minZ)/this.res)),n=Math.min(this.h-1,Math.ceil((r-this.minZ)/this.res)),A=[];for(let l=o;l<=n;l++){const h=this.minZ+(l+.5)*this.res;A.length=0;for(const d of e)for(let f=0,u=d.length-1;f<d.length;u=f++){const g=d[f][1],m=d[u][1];g>h!=m>h&&A.push(d[f][0]+(h-g)/(m-g)*(d[u][0]-d[f][0]))}if(A.length<2)continue;A.sort((d,f)=>d-f);const c=l*this.w;for(let d=0;d+1<A.length;d+=2){const f=Math.max(0,Math.ceil((A[d]-this.minX)/this.res-.5)),u=Math.min(this.w-1,Math.floor((A[d+1]-this.minX)/this.res-.5));if(s==="or")for(let g=f;g<=u;g++)this.data[c+g]|=t;else if(s==="clear")for(let g=f;g<=u;g++)this.data[c+g]&=~t;else for(let g=f;g<=u;g++)this.data[c+g]=t}}}any(e,t,s,i){const r=Math.floor((e-s-this.minX)/this.res),o=Math.floor((e+s-this.minX)/this.res),n=Math.floor((t-s-this.minZ)/this.res),A=Math.floor((t+s-this.minZ)/this.res);for(let l=Math.max(0,n);l<=Math.min(this.h-1,A);l++)for(let h=Math.max(0,r);h<=Math.min(this.w-1,o);h++)if(this.data[l*this.w+h]&i)return!0;return!1}}class ch{constructor(){this.k=[],this.v=[]}get size(){return this.k.length}push(e,t){const s=this.k,i=this.v;let r=s.length;for(s.push(e),i.push(t);r>0;){const o=r-1>>1;if(s[o]<=s[r])break;[s[o],s[r]]=[s[r],s[o]],[i[o],i[r]]=[i[r],i[o]],r=o}}pop(){const e=this.k,t=this.v,s=t[0],i=e[0],r=e.pop(),o=t.pop();if(e.length){e[0]=r,t[0]=o;let n=0;for(;;){const A=2*n+1,l=A+1;let h=n;if(A<e.length&&e[A]<e[h]&&(h=A),l<e.length&&e[l]<e[h]&&(h=l),h===n)break;[e[h],e[n]]=[e[n],e[h]],[t[h],t[n]]=[t[n],t[h]],n=h}}return this.lastKey=i,s}}const U={best:0,depth:0,out:null,allowDown:!1,horizOnly:!1,Tx:0,Ty:0,Tz:0,hbx:0,hby:0,hbz:0,ax:null,h0:0,h1:0,h2:0};function Te(a,e,t,s){const i=Math.hypot(a,e,t);if(i<1e-6)return!0;a/=i,e/=i,t/=i;const r=U.ax,o=U.h0*Math.abs(r[0].x*a+r[0].y*e+r[0].z*t)+U.h1*Math.abs(r[1].x*a+r[1].y*e+r[1].z*t)+U.h2*Math.abs(r[2].x*a+r[2].y*e+r[2].z*t),n=U.hbx*Math.abs(a)+U.hby*Math.abs(e)+U.hbz*Math.abs(t),A=U.Tx*a+U.Ty*e+U.Tz*t,l=o+n-Math.abs(A);if(l<=0)return!1;const h=A>=0?1:-1;return!U.allowDown&&h*e<-.5||U.horizOnly&&Math.abs(e)>.5||l*s<U.best&&(U.best=l*s,U.depth=l,U.out.set(a*h,e*h,t*h)),!0}function uh(a,e,t,s,i,r,o=!0,n=!1){const A=(i.maxX-i.minX)*.5,l=(i.maxY-i.minY)*.5,h=(i.maxZ-i.minZ)*.5,c=a.x-(i.minX+A),d=a.y-(i.minY+l),f=a.z-(i.minZ+h);if(Math.abs(c)>A+s||Math.abs(d)>l+s||Math.abs(f)>h+s||(U.best=1/0,U.depth=0,U.out=r,U.allowDown=o,U.horizOnly=n,U.Tx=c,U.Ty=d,U.Tz=f,U.hbx=A,U.hby=l,U.hbz=h,U.ax=e,U.h0=t[0],U.h1=t[1],U.h2=t[2],!Te(1,0,0,1)||!Te(0,1,0,1)||!Te(0,0,1,1)))return 0;for(let u=0;u<3;u++)if(!Te(e[u].x,e[u].y,e[u].z,1.02))return 0;for(let u=0;u<3;u++){const g=e[u];if(!Te(0,-g.z,g.y,1.1)||!Te(g.z,0,-g.x,1.1)||!Te(-g.y,g.x,0,1.1))return 0}return U.best===1/0?0:U.depth}function fh(a,e,t,s,i){return s[0].set(1,0,0).applyQuaternion(e),s[1].set(0,1,0).applyQuaternion(e),s[2].set(0,0,1).applyQuaternion(e),s}const Qi=new b;function gh(a,e,t,s){const i=a.distanceTo(e);if(!(i>t))return!1;const r=Math.ceil(i/t);Qi.copy(a);for(let o=1;o<=r;o++)if(a.lerpVectors(e,Qi,o/r),s())return!0;return!1}const ps=new b;function dh(a,e,t,s){const i=a.dot(e);if(i>=0)return 0;const r=-i;a.addScaledVector(e,-(1+t)*i),ps.copy(a).addScaledVector(e,-a.dot(e));const o=ps.length();return o>1e-4&&a.addScaledVector(ps,-Math.min(o,s*(1+t)*r)/o),r}let Ja=0;function ja(a,e,t,s,i,r,o,n,A=0,l=null){let h=0,c=n,d=-1,f=0;if(Math.abs(s)<1e-12){if(a<o.minX-A||a>o.maxX+A)return 1/0}else{const u=1/s;let g=(o.minX-A-a)*u,m=(o.maxX+A-a)*u,p=-1;if(g>m){const C=g;g=m,m=C,p=1}if(g>h&&(h=g,d=0,f=p),m<c&&(c=m),h>c)return 1/0}if(Math.abs(i)<1e-12){if(e<o.minY-A||e>o.maxY+A)return 1/0}else{const u=1/i;let g=(o.minY-A-e)*u,m=(o.maxY+A-e)*u,p=-1;if(g>m){const C=g;g=m,m=C,p=1}if(g>h&&(h=g,d=1,f=p),m<c&&(c=m),h>c)return 1/0}if(Math.abs(r)<1e-12){if(t<o.minZ-A||t>o.maxZ+A)return 1/0}else{const u=1/r;let g=(o.minZ-A-t)*u,m=(o.maxZ+A-t)*u,p=-1;if(g>m){const C=g;g=m,m=C,p=1}if(g>h&&(h=g,d=2,f=p),m<c&&(c=m),h>c)return 1/0}return Ja=c,l&&(d<0?l.set(-s,-i,-r):l.set(d===0?f:0,d===1?f:0,d===2?f:0)),h}function Xo(a,e,t,s){const i=e<a.minX?a.minX-e:e>a.maxX?e-a.maxX:0,r=t<a.minY?a.minY-t:t>a.maxY?t-a.maxY:0,o=s<a.minZ?a.minZ-s:s>a.maxZ?s-a.maxZ:0;return Math.sqrt(i*i+r*r+o*o)}function $o(a,e,t,s,i,r,o,n,A,l=null){const h=ja(a,e,t,s,i,r,o,n,A,null);if(h===1/0)return 1/0;const c=f=>Xo(o,a+s*f,e+i*f,t+r*f)-A;let d=h;if(c(h)>1e-7){const f=Ja,u=.6180339887498949;let g=h,m=f,p=m-u*(m-g),C=g+u*(m-g),B=c(p),I=c(C);for(let _=0;_<48&&m-g>1e-6;_++)B<I?(m=C,C=p,I=B,p=m-u*(m-g),B=c(p)):(g=p,p=C,B=I,C=g+u*(m-g),I=c(C));const E=(g+m)*.5;if(c(E)>1e-7)return 1/0;let v=h,x=E;for(let _=0;_<48&&x-v>1e-7;_++){const y=(v+x)*.5;c(y)>0?v=y:x=y}d=x}if(l){const f=a+s*d,u=e+i*d,g=t+r*d,m=f-(f<o.minX?o.minX:f>o.maxX?o.maxX:f),p=u-(u<o.minY?o.minY:u>o.maxY?o.maxY:u),C=g-(g<o.minZ?o.minZ:g>o.maxZ?o.maxZ:g),B=Math.sqrt(m*m+p*p+C*C);B>1e-9?l.set(m/B,p/B,C/B):l.set(-s,-i,-r)}return d}function Zo(a,e,t){return t.set(e.x<a.minX?a.minX:e.x>a.maxX?a.maxX:e.x,e.y<a.minY?a.minY:e.y>a.maxY?a.maxY:e.y,e.z<a.minZ?a.minZ:e.z>a.maxZ?a.maxZ:e.z)}const Et=Object.freeze({GROUND:1<<30,OTHER:1<<31,ALL:-1}),yt=new Map;let vt=24;function Ai(a){if(a==null)return 1;if(typeof a=="number")return a>=0&&a<24?1<<a:Et.OTHER;let e=yt.get(a);return e===void 0&&(e=vt<30?1<<vt++:Et.OTHER,yt.set(a,e)),e}function mh(){return Array.from(yt.entries())}function ph(a){yt.clear(),vt=24;for(const[e,t]of a){yt.set(e,t);const s=Math.log2(t)+1;s>vt&&(vt=s)}}Ai("vehicle");Ai("rigid");const Si=Object.freeze({}),en=()=>({distance:0,point:new b,normal:new b,box:null,kind:null,ground:!1});new b;new b;const ne=new b,Cs=new b,Je=new b,Tt=new b;class Ka{constructor(e={}){this.grid=e.grid||new yi(e.cellSize||32),this.providers=[],this.groundLevel=Number.isFinite(e.groundLevel)?e.groundLevel:0,this.stepHeight=e.stepHeight??.35,this.heightfield=null,this._hf=null,this._surface=null,this._tmp=[],this._dyn=[],this._dynSeen=new Set,this._rc={ox:0,oy:0,oz:0,dx:0,dy:0,dz:0,pad:0,mask:-1,filter:null,box:null,n:new b},this._visit=(t,s)=>this._testBox(t,s),e.heightfield&&this.setHeightfield(e.heightfield),e.surface&&this.setSurfaceProvider(e.surface)}addStaticBox(e,t,s,i,r,o,n=0){return this.grid.add(e,t,s,i,r,o,n)}get staticBoxes(){return this.grid.boxes}queryStatic(e,t,s,i=[]){return this.grid.query(e,t,s,i)}addDynamicProvider(e){return typeof e=="function"&&!this.providers.includes(e)&&this.providers.push(e),e}removeDynamicProvider(e){const t=this.providers.indexOf(e);t>=0&&this.providers.splice(t,1)}queryDynamic(e,t,s,i=[]){i.length=0;for(let r=0;r<this.providers.length;r++)this.providers[r](e,t,s,i);return i}queryColliders(e,t,s,i=[]){this.grid.query(e,t,s,i);for(let r=0;r<this.providers.length;r++)this.providers[r](e,t,s,i);return i}setHeightfield(e){return this.heightfield=e||null,this._hf=e?typeof e=="function"?e:typeof e.heightAt=="function"?(t,s,i)=>e.heightAt(t,s,i):null:null,this}groundHeight(e,t,s){if(!this._hf)return this.groundLevel;const i=this._hf(e,t,s);return typeof i=="number"&&Number.isFinite(i)?i:this.groundLevel}getGroundHeight(e,t,s){return this.groundHeight(e,t,s)}setSurfaceProvider(e){return this._surface=typeof e=="function"?e:null,this}surfaceAt(e,t,s={mu:1,crr:1,tag:null}){if(s.mu=1,s.crr=1,s.tag=null,!this._surface)return s;const i=this._surface(e,t,s);return i&&i!==s&&(s.mu=i.mu??1,s.crr=i.crr??1,s.tag=i.tag??null),s}groundNormal(e,t,s,i=new b,r=.5){if(!this._hf)return i.set(0,1,0);const o=this.groundHeight(e+r,t,s)-this.groundHeight(e-r,t,s),n=this.groundHeight(e,t+r,s)-this.groundHeight(e,t-r,s);return i.set(-o/(2*r),1,-n/(2*r)).normalize()}supportAt(e,t,s,i=this.stepHeight){let r=this.groundHeight(e,t,s);const o=this.queryColliders(e,t,0,this._tmp),n=s+i;for(let A=0;A<o.length;A++){const l=o[A];e>l.minX&&e<l.maxX&&t>l.minZ&&t<l.maxZ&&l.maxY<=n&&l.maxY>r&&(r=l.maxY)}return r}raycast(e,t,s=1e4,i=Si){return this._cast(e,t,0,s,i)}sphereCast(e,t,s,i=1e4,r=Si){return this._cast(e,t,Math.max(0,s||0),i,r)}_cast(e,t,s,i,r){const o=Math.hypot(t.x,t.y,t.z);if(!(o>1e-12)||!Number.isFinite(e.x+e.y+e.z)||(i=Math.min(Number.isFinite(i)?i:1e4,1e5),!(i>0)))return null;const n=this._rc;n.ox=e.x,n.oy=e.y,n.oz=e.z,n.dx=t.x/o,n.dy=t.y/o,n.dz=t.z/o,n.pad=s,n.mask=r.mask??Et.ALL,n.filter=r.filter||null,n.box=null;let A=i,l=null,h=!1;if(r.statics!==!1&&(s>0?A=this._castBoxesAlongRay(A,!0):typeof this.grid.raycast=="function"?A=this.grid.raycast(n.ox,n.oz,n.dx,n.dz,A,this._visit):A=this._castBoxesAlongRay(A,!0),n.box&&(l=n.box,Tt.copy(n.n))),r.dynamics!==!1&&this.providers.length&&(n.box=null,A=this._castBoxesAlongRay(A,!1),n.box&&(l=n.box,Tt.copy(n.n))),r.ground!==!1&&(n.mask&Et.GROUND)!==0){const d=this._marchHeightfield(A,s,r.hfStep);d<A&&(A=d,h=!0,l=null)}if(!l&&!h)return null;const c=r.out||en();if(c.distance=A,c.box=l,c.kind=l?l.kind:null,c.ground=h,ne.set(n.ox+n.dx*A,n.oy+n.dy*A,n.oz+n.dz*A),h)this.groundNormal(ne.x,ne.z,ne.y,c.normal),s>0?c.point.set(ne.x,this.groundHeight(ne.x,ne.z,ne.y),ne.z):c.point.copy(ne);else if(s>0){Zo(l,ne,Cs),Je.subVectors(ne,Cs);const d=Je.length();d>1e-6?c.normal.copy(Je).divideScalar(d):c.normal.copy(Tt),c.point.copy(Cs)}else c.normal.copy(Tt),c.point.copy(ne);return c}_testBox(e,t){const s=this._rc;if(s.mask!==Et.ALL&&(s.mask&Ai(e.kind))===0||s.filter&&!s.filter(e))return 1/0;const i=s.pad>0?$o(s.ox,s.oy,s.oz,s.dx,s.dy,s.dz,e,t,s.pad,Je):ja(s.ox,s.oy,s.oz,s.dx,s.dy,s.dz,e,t,0,Je);return i<t&&(s.box=e,s.n.copy(Je)),i}_castBoxesAlongRay(e,t){const s=this._rc,i=this._dynSeen,r=this._dyn;i.clear();const o=Math.hypot(s.dx,s.dz)*e,n=16,A=Math.max(1,Math.ceil(o/n)),l=o/A*.5*Math.SQRT2+s.pad+.01;for(let h=0;h<A;h++){const c=(h+.5)/A*e,d=s.ox+s.dx*c,f=s.oz+s.dz*c;t?this.grid.query(d,f,l,r):this.queryDynamic(d,f,l,r);for(let u=0;u<r.length;u++){const g=r[u];if(i.has(g))continue;i.add(g);const m=this._testBox(g,e);m<e&&(e=m)}}return e}_marchHeightfield(e,t,s){const i=this._rc,r=s&&s.min||.25,o=s&&s.max||8,n=h=>{const c=i.oy+i.dy*h;return c-t-this.groundHeight(i.ox+i.dx*h,i.oz+i.dz*h,c)};let A=0,l=n(0);if(l<=0)return 0;for(let h=0;h<1e5&&A<e;h++){const c=Math.min(e,A+Math.min(o,Math.max(r,l*.9))),d=n(c);if(d<=0){let f=A,u=c;for(let g=0;g<24&&u-f>1e-4;g++){const m=(f+u)*.5;n(m)>0?f=m:u=m}return u}A=c,l=d}return 1/0}static fromWorld(e,t={}){const{dynamic:s=[],deckStep:i,...r}=t,o=e&&e.colliders instanceof yi?e.colliders:void 0,n=new Ka({...r,grid:o});if(e&&typeof e.getGroundHeight=="function"&&(Number.isFinite(i)?n.setHeightfield((A,l,h)=>e.getGroundHeight(A,l,h,i)):n.setHeightfield((A,l,h)=>e.getGroundHeight(A,l,h))),e&&typeof e.surfaceAt=="function"&&n.setSurfaceProvider((A,l,h)=>e.surfaceAt(A,l,h)),o)for(const A of s)n.addDynamicProvider(A);else e&&typeof e.queryColliders=="function"&&n.addDynamicProvider((A,l,h,c)=>{const d=e.queryColliders(A,l,h);if(d)for(let f=0;f<d.length;f++)c.push(d[f])});return n}}const Ch=Object.freeze({A:0,B:1,X:2,Y:3,LB:4,RB:5,LT:6,RT:7,BACK:8,START:9,LS:10,RS:11,UP:12,DOWN:13,LEFT:14,RIGHT:15,HOME:16}),Ih=Object.freeze({LX:0,LY:1,RX:2,RY:3});function tn(a,e=.12){const t=Math.abs(a);return t<e?0:Math.sign(a)*Math.min(1,(t-e)/(1-e))}class sn{constructor(e={}){this.deadzone=e.deadzone??.12,this.index=e.index??null,this.pad=null,this.connected=!1,this.id=""}poll(){let e=null;if(typeof navigator<"u"&&navigator.getGamepads){const t=navigator.getGamepads();if(this.index!=null){const s=t[this.index];s&&s.connected&&(e=s)}else for(const s of t)if(s&&s.connected){e=s;break}}return this.pad=e,this.connected=!!e,this.id=e?e.id:"",e}button(e){const t=this.pad&&this.pad.buttons[e];return t?typeof t=="object"?t.value||(t.pressed?1:0):t:0}pressed(e){const t=this.pad&&this.pad.buttons[e];return!!(t&&(t.pressed||t.value>.5))}axis(e,t=this.deadzone){const s=this.pad&&this.pad.axes[e]||0;return tn(s,t)}rumble(e=.5,t=120){const s=this.pad&&this.pad.vibrationActuator;if(!(!s||!s.playEffect))try{s.playEffect("dual-rumble",{duration:t,strongMagnitude:e,weakMagnitude:e*.6})}catch{}}}function an(a,e,t,s,i){const o=Math.abs(e)>Math.abs(a)&&Math.sign(e)!==-Math.sign(a)?s:i,n=e-a,A=o*t;return Math.abs(n)<=A?e:a+Math.sign(n)*A}function Bh(a,e=a){return{up:1/a,down:1/e}}function Is(a){if(!a)return!1;const e=a.tagName;return e==="INPUT"||e==="TEXTAREA"||e==="SELECT"||a.isContentEditable===!0}const bi=(a,e,t)=>a<e?e:a>t?t:a,Di=["x","y","wheel"],rn=new Set(["ShiftLeft","ShiftRight","AltLeft","AltRight","ControlLeft","ControlRight","MetaLeft","MetaRight"]);function Bs(a){typeof a=="string"&&(a={key:a});const e={...a};if(e.key!=null)e.kind="key";else if(e.padButton!=null)e.kind="padButton";else if(e.padAxis!=null)e.kind="padAxis";else if(e.mouse!=null)e.kind=typeof e.mouse=="number"?"mouseButton":"mouseAxis";else if(e.virtual!=null||e.touch!=null)e.kind="virtual",e.virtual=e.virtual??e.touch;else throw new Error(`InputMap: unknown binding ${JSON.stringify(a)}`);if(e.kind==="mouseAxis"&&!Di.includes(e.mouse))throw new Error(`InputMap: mouse axis must be one of ${Di}`);e.value=e.value??1,e.smooth=e.smooth??(e.kind==="key"||e.kind==="mouseButton");const t=e.when==null?[]:Array.isArray(e.when)?e.when:[e.when];return e._req=t.filter(s=>s[0]!=="!"),e._not=t.filter(s=>s[0]==="!").map(s=>s.slice(1)),e}class Eh{constructor(e={}){this.enabled=!0,this.preventDefault=e.preventDefault!==!1,this.useGamepad=e.gamepad!==!1,this.gamepad=new sn({deadzone:e.deadzone??.12}),this.gamepadConnected=!1,this.actions=new Map,this.contexts=new Set,this.virtual=new Map,this.dt=0,this._keys=new Set,this._keyEdges=new Set,this._boundKeys=new Set,this._mouseButtons=0,this._mouseEdges=0,this._mouse={x:0,y:0,wheel:0},this._mouseFrame={x:0,y:0,wheel:0},this._virtualEdges=new Set,this._lastTime=0,this._capture=null,this._target=e.target||(typeof window<"u"?window:null),this._pointerTarget=e.pointerTarget||null,this._pointerAttached=!1,this._onKeyDown=this._onKeyDown.bind(this),this._onKeyUp=this._onKeyUp.bind(this),this._onBlur=()=>{this._keys.clear(),this._mouseButtons=0},this._onPadConnect=()=>{this.gamepadConnected=!0},this._onPadDisconnect=()=>{this.gamepadConnected=!1},this._onPointerDown=t=>{const s=1<<t.button;this._mouseButtons&s||(this._mouseEdges|=s),this._mouseButtons|=s},this._onPointerUp=t=>{this._mouseButtons&=~(1<<t.button)},this._onPointerMove=t=>{this._mouse.x+=t.movementX||0,this._mouse.y+=t.movementY||0},this._onWheel=t=>{this._mouse.wheel+=t.deltaY||0},this._target&&this._target.addEventListener&&(this._target.addEventListener("keydown",this._onKeyDown,{passive:!1}),this._target.addEventListener("keyup",this._onKeyUp),typeof window<"u"&&(window.addEventListener("blur",this._onBlur),window.addEventListener("gamepadconnected",this._onPadConnect),window.addEventListener("gamepaddisconnected",this._onPadDisconnect))),e.actions&&this.defineAll(e.actions)}define(e,t={}){const s=t.type||"axis",i=t.range||(s==="button"?[0,1]:[-1,1]),r={name:e,type:s,min:i[0],max:i[1],smoothing:t.smoothing||null,bindings:(t.bindings||[]).map(Bs),alwaysOn:!!t.alwaysOn,_liveBindings:!1,value:0,smoothed:0,analog:0,down:!1,prevDown:!1,justPressed:!1,justReleased:!1,padDown:!1};return this.actions.set(e,r),this._reindex(),this}defineAll(e){for(const t of Object.keys(e))this.define(t,e[t]);return this}undefine(e){return this.actions.delete(e),this._reindex(),this}bind(e,t){return this._action(e).bindings.push(Bs(t)),this._reindex(),this}unbind(e,t){const s=this._action(e);return s.bindings=s.bindings.filter(i=>!t(i)),this._reindex(),this}rebind(e,t){const s=this._action(e);return s.bindings=t.map(Bs),this._reindex(),this}getBindings(){const e={};for(const[t,s]of this.actions)e[t]=s.bindings.map(({kind:i,_req:r,_not:o,...n})=>n);return e}loadBindings(e){for(const t of Object.keys(e||{}))this.actions.has(t)&&this.rebind(t,e[t]);return this}captureBinding({timeout:e=1e4}={}){return new Promise(t=>{const s=r=>{clearTimeout(i),this._capture=null,t(r)},i=setTimeout(()=>s(null),e);this._capture={done:s,padPrev:null}})}_action(e){const t=this.actions.get(e);if(!t)throw new Error(`InputMap: unknown action "${e}"`);return t}_reindex(){this._boundKeys.clear();let e=!1;for(const t of this.actions.values()){t._liveBindings=t.bindings.some(s=>s.alwaysOn);for(const s of t.bindings)s.kind==="key"&&this._boundKeys.add(s.key),(s.kind==="mouseButton"||s.kind==="mouseAxis")&&(e=!0)}e&&this._attachPointer()}_attachPointer(){if(this._pointerAttached)return;const e=this._pointerTarget||(typeof window<"u"?window:null);!e||!e.addEventListener||(this._pointerAttached=e,e.addEventListener("pointerdown",this._onPointerDown),e.addEventListener("pointermove",this._onPointerMove),e.addEventListener("wheel",this._onWheel,{passive:!0}),typeof window<"u"&&window.addEventListener("pointerup",this._onPointerUp))}setContext(e,t=!0){return t?this.contexts.add(e):this.contexts.delete(e),this}hasContext(e){return this.contexts.has(e)}setVirtual(e,t){const s=this.virtual.get(e)||0;Math.abs(s)<=.5&&Math.abs(t)>.5&&this._virtualEdges.add(e),this.virtual.set(e,t)}value(e){const t=this.actions.get(e);return t?t.value:0}down(e){const t=this.actions.get(e);return!!(t&&t.down)}justPressed(e){const t=this.actions.get(e);return!!(t&&t.justPressed)}justReleased(e){const t=this.actions.get(e);return!!(t&&t.justReleased)}keyDown(e){return this._keys.has(e)}get pressedKeys(){return this._keys}get mouseDelta(){return this._mouseFrame}readSources(e,t={mouse:0,virtual:0,pad:0,keyPos:0,keyNeg:0}){t.mouse=t.virtual=t.pad=t.keyPos=t.keyNeg=0;const s=this.actions.get(e);if(!s)return t;const i=this.enabled||s.alwaysOn;if(!i&&!s._liveBindings)return t;for(let r=0;r<s.bindings.length;r++){const o=s.bindings[r];if(!i&&!o.alwaysOn||(o._req.length||o._not.length)&&!this._active(o))continue;const n=this._read(o);switch(o.kind){case"mouseAxis":t.mouse+=n;break;case"virtual":t.virtual+=n;break;case"padAxis":case"padButton":t.pad+=n;break;default:n>t.keyPos?t.keyPos=n:n<t.keyNeg&&(t.keyNeg=n)}}return t}_onKeyDown(e){if(Is(e.target)||typeof document<"u"&&Is(document.activeElement)||(e.metaKey||e.ctrlKey||e.altKey)&&!rn.has(e.code))return;if(this._capture&&!e.repeat){e.preventDefault(),this._capture.done({key:e.code});return}this._boundKeys.has(e.code)&&this.preventDefault&&e.preventDefault(),e.repeat||this._keyEdges.add(e.code),this._keys.add(e.code)}_onKeyUp(e){this._keys.delete(e.code),this._boundKeys.has(e.code)&&this.preventDefault&&!Is(e.target)&&e.preventDefault()}_active(e){for(let t=0;t<e._req.length;t++)if(!this.contexts.has(e._req[t]))return!1;for(let t=0;t<e._not.length;t++)if(this.contexts.has(e._not[t]))return!1;return!0}_read(e){const t=this.gamepad;switch(e.kind){case"key":return this._keys.has(e.key)?e.value:0;case"padButton":return t.pad?e.binary?t.pressed(e.padButton)?e.value:0:t.button(e.padButton)*e.value:0;case"padAxis":{if(!t.pad)return 0;let s=t.axis(e.padAxis,e.deadzone??t.deadzone);return e.half===1?s=s>0?s:0:e.half===-1&&(s=s<0?-s:0),s*e.value}case"mouseButton":return this._mouseButtons&1<<e.mouse?e.value:0;case"mouseAxis":return this._mouseFrame[e.mouse]*e.value;case"virtual":return(this.virtual.get(e.virtual)||0)*e.value}return 0}_held(e){return e.kind==="padButton"?!!this.gamepad.pad&&this.gamepad.pressed(e.padButton):Math.abs(this._read(e))>.5}_edge(e){return e.kind==="key"?this._keyEdges.has(e.key):e.kind==="mouseButton"?!!(this._mouseEdges&1<<e.mouse):e.kind==="virtual"?this._virtualEdges.has(e.virtual):!1}update(e){const t=typeof performance<"u"?performance.now():Date.now();e>0||(e=this._lastTime?(t-this._lastTime)/1e3:1/60),this._lastTime=t,e=Math.min(Math.max(e,0),.1),this.dt=e;const s=this._mouseFrame,i=this._mouse;s.x=i.x,s.y=i.y,s.wheel=i.wheel,i.x=i.y=i.wheel=0,this.useGamepad&&(this.gamepadConnected=!!this.gamepad.poll()),this._capture&&this._pollCapture();const r=this.enabled;for(const o of this.actions.values()){let n=0,A=0,l=0,h=!1,c=!1,d=!1;const f=r||o.alwaysOn;if(f||o._liveBindings)for(let g=0;g<o.bindings.length;g++){const m=o.bindings[g];if(!f&&!m.alwaysOn||(m._req.length||m._not.length)&&!this._active(m))continue;const p=this._read(m);m.smooth?p>n?n=p:p<A&&(A=p):l+=p,o.type==="button"&&this._held(m)&&(h=!0,(m.kind==="padButton"||m.kind==="padAxis")&&(d=!0)),!c&&this._edge(m)&&(c=!0)}const u=n+A;if(o.smoothing?o.smoothed=an(o.smoothed,u,e,o.smoothing.up,o.smoothing.down):o.smoothed=u,l=bi(l,-1,1),o.analog=l,o.prevDown=o.down,o.type==="button")o.down=h,o.value=h?1:0,o.justPressed=c||d&&!o.padDown,o.padDown=d;else{const g=Math.abs(l)>Math.abs(o.smoothed)?l:o.smoothed;o.value=bi(g,o.min,o.max),o.down=Math.abs(o.value)>.5,o.justPressed=o.down&&!o.prevDown}o.justReleased=!o.down&&o.prevDown}return this._keyEdges.clear(),this._mouseEdges=0,this._virtualEdges.clear(),this}_pollCapture(){const e=this.gamepad,t=this._capture;if(!e.pad)return;const s=e.pad.buttons.length,i=t.padPrev,r=t.padPrev=[];for(let o=0;o<s;o++)r.push(e.pressed(o));if(i){for(let o=0;o<s;o++)if(r[o]&&!i[o]){t.done({padButton:o});return}}for(let o=0;o<e.pad.axes.length;o++){const n=e.pad.axes[o]||0;if(Math.abs(n)>.6){t.done({padAxis:o,value:Math.sign(n),half:Math.sign(n)});return}}}dispose(){this._target&&this._target.removeEventListener&&(this._target.removeEventListener("keydown",this._onKeyDown),this._target.removeEventListener("keyup",this._onKeyUp)),typeof window<"u"&&(window.removeEventListener("blur",this._onBlur),window.removeEventListener("gamepadconnected",this._onPadConnect),window.removeEventListener("gamepaddisconnected",this._onPadDisconnect),window.removeEventListener("pointerup",this._onPointerUp));const e=this._pointerAttached;e&&(e.removeEventListener("pointerdown",this._onPointerDown),e.removeEventListener("pointermove",this._onPointerMove),e.removeEventListener("wheel",this._onWheel),this._pointerAttached=!1)}}function Ya(a,e,t){return a<e?e:a>t?t:a}function vh(a,e,t){const s=Ya((t-a)/(e-a),0,1);return s*s*(3-2*s)}function wh(a,e){return 1-Math.exp(-a*e)}function xh(a){for(;a>Math.PI;)a-=2*Math.PI;for(;a<-Math.PI;)a+=2*Math.PI;return a}function _h(a,e,t,s,i,r,o){const n=2*i*Math.sqrt(s);o.copy(t).sub(a).multiplyScalar(s).addScaledVector(e,-n),e.addScaledVector(o,r),a.addScaledVector(e,r)}function yh(a,e,t){if(a.kind!==2)return!1;const s=a.maxY-a.minY,i=a.maxX-a.minX;let r,o,n;if(s>8){const A=s/12;r=a.maxY+.3,o=4.6*A,n=2.8*A}else{let A=Ya(s,2.6,7);i>.9&&(A*=1.3),r=a.maxY+.75*A,o=1.32*A,n=1.25*A}return e[t]=(a.minX+a.maxX)/2,e[t+1]=r,e[t+2]=(a.minZ+a.maxZ)/2,e[t+3]=o,e[t+4]=n,!0}class on{constructor(e={}){const t=e.physics||null;this.physics=t,this.getGroundHeight=e.getGroundHeight||(t&&typeof t.getGroundHeight=="function"?(s,i,r)=>t.getGroundHeight(s,i,r):null),this.queryColliders=e.queryColliders||(t&&typeof t.queryColliders=="function"?(s,i,r)=>t.queryColliders(s,i,r,this._qOut)||this._qOut:null),this.raycast=e.raycast||(t&&typeof t.raycast=="function"?(s,i,r)=>t.raycast(s,i,r):null),this.occlusion=e.occlusion!==!1,this.canopyFromCollider=typeof e.canopyFromCollider=="function"?e.canopyFromCollider:null,this.thinKinds=new Set(e.thinKinds||[]),this.maxCanopies=e.maxCanopies||96,this.nearMargin=e.nearMargin??.3,this.focus=new b,this.boxes=null,this.canopies=new Float64Array(this.maxCanopies*5),this.nCan=0,this._qOut=[],this._dir=new b}ground(e,t,s){if(!this.getGroundHeight)return 0;const i=this.getGroundHeight(e,t,s);return Number.isFinite(i)?i:0}gather(e,t){if(this.focus.copy(e),this.boxes=null,this.nCan=0,!this.queryColliders||!this.occlusion)return;const s=e,i=this.queryColliders(s.x,s.z,t);if(!i||!i.length)return;this.boxes=i;const r=this.canopyFromCollider;if(!r)return;const o=this.canopies,n=this.maxCanopies;let A=0;for(let l=0;l<i.length&&A<n;l++)r(i[l],o,A*5)&&A++;this.nCan=A}canopyD(e,t,s,i){const r=this.canopies,o=e*5,n=(t-r[o])/r[o+3],A=(s-r[o+1])/r[o+4],l=(i-r[o+2])/r[o+3];return n*n+A*A+l*l}segHit(e,t,s){if(!this.occlusion)return 1;const i=t.x-e.x,r=t.y-e.y,o=t.z-e.z,n=Math.hypot(i,r,o);if(n<1e-4)return 1;let A=1;const l=this.boxes,h=this.thinKinds;if(l)for(let d=0;d<l.length;d++){const f=l[d],u=h.has(f.kind),g=u?.25:s,m=f.minX-g,p=f.maxX+g,C=f.minY-g,B=f.maxY+g,I=f.minZ-g,E=f.maxZ+g;if(e.x>m&&e.x<p&&e.y>C&&e.y<B&&e.z>I&&e.z<E)continue;let v=0,x=A;if(Math.abs(i)<1e-9){if(e.x<m||e.x>p)continue}else{let _=(m-e.x)/i,y=(p-e.x)/i;if(_>y){const D=_;_=y,y=D}if(_>v&&(v=_),y<x&&(x=y),v>x)continue}if(Math.abs(r)<1e-9){if(e.y<C||e.y>B)continue}else{let _=(C-e.y)/r,y=(B-e.y)/r;if(_>y){const D=_;_=y,y=D}if(_>v&&(v=_),y<x&&(x=y),v>x)continue}if(Math.abs(o)<1e-9){if(e.z<I||e.z>E)continue}else{let _=(I-e.z)/o,y=(E-e.z)/o;if(_>y){const D=_;_=y,y=D}if(_>v&&(v=_),y<x&&(x=y),v>x)continue}u&&(1-v)*n>1.6||v<A&&(A=v)}else if(this.raycast&&!this.queryColliders){this._dir.set(i/n,r/n,o/n);const d=this.raycast(e,this._dir,n),f=d==null?1/0:typeof d=="number"?d:d.distance??(d.t!=null?d.t*n:1/0);f<n&&(A=Math.max(0,(f-s)/n))}const c=this.canopies;for(let d=0;d<this.nCan;d++){const f=d*5,u=c[f+3],g=c[f+4],m=(e.x-c[f])/u,p=(e.y-c[f+1])/g,C=(e.z-c[f+2])/u,B=i/u,I=r/g,E=o/u,v=B*B+I*I+E*E,x=2*(m*B+p*I+C*E),_=m*m+p*p+C*C-1;if(_<0)continue;const y=x*x-4*v*_;if(y<0)continue;const D=(-x-Math.sqrt(y))/(2*v);D>=0&&D<A&&(A=D)}if(this.getGroundHeight){const d=this.focus.y+1.5;for(let f=1;f<=6;f++){const u=f/6;if(u>=A)break;const g=e.x+i*u,m=e.y+r*u,p=e.z+o*u;if(m<this.ground(g,p,Math.min(d,m+1))+.25){A=Math.max(0,u-1/6);break}}}return A}pushOut(e){const t=this.boxes;if(!t)return;const s=this.nearMargin,i=this.focus.y;for(let r=0;r<t.length;r++){const o=t[r],n=o.minX-s,A=o.maxX+s,l=o.minY-s,h=o.maxY+s,c=o.minZ-s,d=o.maxZ+s;if(!(e.x>n&&e.x<A&&e.y>l&&e.y<h&&e.z>c&&e.z<d))continue;let f=A-e.x,u=0,g=1;e.x-n<f&&(f=e.x-n,u=0,g=-1),d-e.z<f&&(f=d-e.z,u=2,g=1),e.z-c<f&&(f=e.z-c,u=2,g=-1),h-e.y<f&&(f=h-e.y,u=1,g=1),o.minY>i+1.5&&e.y-l<f&&(f=e.y-l,u=1,g=-1),u===0?e.x+=g*f:u===1?e.y+=g*f:e.z+=g*f}}clampAboveGround(e,t){let s=t;this.getGroundHeight&&(s=this.ground(e.x,e.z,Math.min(e.y,this.focus.y+1.5))+t),e.y<s&&(e.y=s)}}class Qh{constructor(e,t={}){this.camera=e,this.enabled=t.active!==!1,this.minY=t.minY??.6,this.collision=new on(t),this.target=null,this.getState=null,this._snapPending=!0}get getGroundHeight(){return this.collision.getGroundHeight}set getGroundHeight(e){this.collision.getGroundHeight=e||null}get queryColliders(){return this.collision.queryColliders}set queryColliders(e){this.collision.queryColliders=e||null}get occlusion(){return this.collision.occlusion}set occlusion(e){this.collision.occlusion=!!e}setTarget(e,t){this.target=e,this.getState=typeof t=="function"?t:()=>t,this._snapPending=!0}snap(){this._snapPending=!0}activate(){this.enabled=!0,this._snapPending=!0}deactivate(){this.enabled=!1}update(e){}dispose(){}}class Qt extends Ct{constructor(){const e=Qt.SkyShader,t=new ee({name:e.name,uniforms:Fe.clone(e.uniforms),vertexShader:e.vertexShader,fragmentShader:e.fragmentShader,side:co,depthWrite:!1});super(new uo(1,1,1),t),this.isSky=!0}}Qt.SkyShader={name:"SkyShader",uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new b},up:{value:new b(0,1,0)}},vertexShader:`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;
		uniform vec3 up;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( dot( vSunDirection, up ) );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorption + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,fragmentShader:`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform vec3 up;

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPosition );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
			L0 += ( vSunE * 19000.0 * Fex ) * sundisk;

			vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

			vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

			gl_FragColor = vec4( retColor, 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};class St extends Ct{constructor(){super(St.Geometry,new La({opacity:0,transparent:!0})),this.isLensflare=!0,this.type="Lensflare",this.frustumCulled=!1,this.renderOrder=1/0;const e=new b,t=new b,s=new mi(16,16),i=new mi(16,16);let r=N;const o=St.Geometry,n=new fs({uniforms:{scale:{value:null},screenPosition:{value:null}},vertexShader:`

				precision highp float;

				uniform vec3 screenPosition;
				uniform vec2 scale;

				attribute vec3 position;

				void main() {

					gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );

				}`,fragmentShader:`

				precision highp float;

				void main() {

					gl_FragColor = vec4( 1.0, 0.0, 1.0, 1.0 );

				}`,depthTest:!0,depthWrite:!1,transparent:!1}),A=new fs({uniforms:{map:{value:s},scale:{value:null},screenPosition:{value:null}},vertexShader:`

				precision highp float;

				uniform vec3 screenPosition;
				uniform vec2 scale;

				attribute vec3 position;
				attribute vec2 uv;

				varying vec2 vUV;

				void main() {

					vUV = uv;

					gl_Position = vec4( position.xy * scale + screenPosition.xy, screenPosition.z, 1.0 );

				}`,fragmentShader:`

				precision highp float;

				uniform sampler2D map;

				varying vec2 vUV;

				void main() {

					gl_FragColor = texture2D( map, vUV );

				}`,depthTest:!1,depthWrite:!1,transparent:!1}),l=new Ct(o,n),h=[],c=li.Shader,d=new fs({name:c.name,uniforms:{map:{value:null},occlusionMap:{value:i},color:{value:new T(16777215)},scale:{value:new L},screenPosition:{value:new b}},vertexShader:c.vertexShader,fragmentShader:c.fragmentShader,blending:Na,transparent:!0,depthWrite:!1}),f=new Ct(o,d);this.addElement=function(C){h.push(C)};const u=new L,g=new L,m=new fo,p=new Be;this.onBeforeRender=function(C,B,I){C.getCurrentViewport(p);const E=C.getRenderTarget(),v=E!==null?E.texture.type:N;r!==v&&(s.dispose(),i.dispose(),s.type=i.type=v,r=v);const x=p.w/p.z,_=p.z/2,y=p.w/2;let D=16/p.w;if(u.set(D*x,D),m.min.set(p.x,p.y),m.max.set(p.x+(p.z-16),p.y+(p.w-16)),t.setFromMatrixPosition(this.matrixWorld),t.applyMatrix4(I.matrixWorldInverse),!(t.z>0)&&(e.copy(t).applyMatrix4(I.projectionMatrix),g.x=p.x+e.x*_+_-8,g.y=p.y+e.y*y+y-8,m.containsPoint(g))){C.copyFramebufferToTexture(s,g);let q=n.uniforms;q.scale.value=u,q.screenPosition.value=e,C.renderBufferDirect(I,null,o,n,l,null),C.copyFramebufferToTexture(i,g),q=A.uniforms,q.scale.value=u,q.screenPosition.value=e,C.renderBufferDirect(I,null,o,A,l,null);const $=-e.x*2,w=-e.y*2;for(let S=0,F=h.length;S<F;S++){const P=h[S],Q=d.uniforms;Q.color.value.copy(P.color),Q.map.value=P.texture,Q.screenPosition.value.x=e.x+$*P.distance,Q.screenPosition.value.y=e.y+w*P.distance,D=P.size/p.w;const G=p.w/p.z;Q.scale.value.set(D*G,D),d.uniformsNeedUpdate=!0,C.renderBufferDirect(I,null,o,d,f,null)}}},this.dispose=function(){n.dispose(),A.dispose(),d.dispose(),s.dispose(),i.dispose();for(let C=0,B=h.length;C<B;C++)h[C].texture.dispose()}}}class li{constructor(e,t=1,s=0,i=new T(16777215)){this.texture=e,this.size=t,this.distance=s,this.color=i}}li.Shader={name:"LensflareElementShader",uniforms:{map:{value:null},occlusionMap:{value:null},color:{value:null},scale:{value:null},screenPosition:{value:null}},vertexShader:`

		precision highp float;

		uniform vec3 screenPosition;
		uniform vec2 scale;

		uniform sampler2D occlusionMap;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUV;
		varying float vVisibility;

		void main() {

			vUV = uv;

			vec2 pos = position.xy;

			vec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.1 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.5 ) );
			visibility += texture2D( occlusionMap, vec2( 0.9, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.1, 0.9 ) );
			visibility += texture2D( occlusionMap, vec2( 0.1, 0.5 ) );
			visibility += texture2D( occlusionMap, vec2( 0.5, 0.5 ) );

			vVisibility =        visibility.r / 9.0;
			vVisibility *= 1.0 - visibility.g / 9.0;
			vVisibility *=       visibility.b / 9.0;

			gl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D map;
		uniform vec3 color;

		varying vec2 vUV;
		varying float vVisibility;

		void main() {

			vec4 texture = texture2D( map, vUV );
			texture.a *= vVisibility;
			gl_FragColor = texture;
			gl_FragColor.rgb *= color;

		}`};St.Geometry=(function(){const a=new ii,e=new Float32Array([-1,-1,0,0,0,1,-1,0,1,0,1,1,0,1,1,-1,1,0,0,1]),t=new go(e,5);return a.setIndex([0,1,2,0,2,3]),a.setAttribute("position",new pi(t,3,0,!1)),a.setAttribute("uv",new pi(t,2,3,!1)),a})();function hi(a){let e=a>>>0;return function(){e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function le(a,e){let t=Math.imul(a|0,374761393)+Math.imul(e|0,668265263)|0;return t=Math.imul(t^t>>>13,1274126177),t^=t>>>16,(t>>>0)/4294967296}function Wa(a,e,t,s=0){const i=Math.floor(a),r=Math.floor(e),o=a-i,n=e-r,A=o*o*(3-2*o),l=n*n*(3-2*n),h=(i%t+t)%t,c=((i+1)%t+t)%t,d=(r%t+t)%t,f=((r+1)%t+t)%t,u=s*131,g=le(h+u,d),m=le(c+u,d),p=le(h+u,f),C=le(c+u,f);return g+(m-g)*A+(p-g)*l+(g-m-p+C)*A*l}function Re(a,e,t,s,i=0,r=.5){let o=1,n=0,A=0,l=t,h=t;for(let c=0;c<s;c++)n+=o*Wa(a*h,e*h,l,i+c*7),A+=o,o*=r,l*=2,h*=2;return n/A}const oe=(a,e,t)=>a<e?e:a>t?t:a,nn=(a,e,t)=>a+(e-a)*t,be=(a,e,t)=>{const s=oe((t-a)/(e-a),0,1);return s*s*(3-2*s)},An=.5*(Math.sqrt(3)-1),ot=(3-Math.sqrt(3))/6,ln=1/3,Ce=1/6,Es=new Float32Array([1,-1,1,-1,1,-1,0,0,.7071,-.7071,.7071,-.7071]),vs=new Float32Array([0,0,0,0,1,1,-1,-1,.7071,.7071,-.7071,-.7071]),kt=new Int8Array([1,-1,1,-1,1,-1,1,-1,0,0,0,0]),Pt=new Int8Array([1,1,-1,-1,0,0,0,0,1,-1,1,-1]),Gt=new Int8Array([0,0,0,0,1,1,-1,-1,1,1,-1,-1]);class hn{constructor(e=1){this.seed=e;const t=hi(e),s=new Uint8Array(256);for(let i=0;i<256;i++)s[i]=i;for(let i=255;i>0;i--){const r=Math.floor(t()*(i+1)),o=s[i];s[i]=s[r],s[r]=o}this.perm=new Uint8Array(512),this.g=new Uint8Array(512);for(let i=0;i<512;i++)this.perm[i]=s[i&255],this.g[i]=this.perm[i]%12}noise(e,t){const s=this.perm,i=this.g,r=(e+t)*An,o=Math.floor(e+r),n=Math.floor(t+r),A=(o+n)*ot,l=e-(o-A),h=t-(n-A),c=l>h?1:0,d=1-c,f=l-c+ot,u=h-d+ot,g=l-1+2*ot,m=h-1+2*ot,p=o&255,C=n&255;let B=0,I;if(I=.5-l*l-h*h,I>0){const E=i[p+s[C]];I*=I,B+=I*I*(Es[E]*l+vs[E]*h)}if(I=.5-f*f-u*u,I>0){const E=i[p+c+s[C+d]];I*=I,B+=I*I*(Es[E]*f+vs[E]*u)}if(I=.5-g*g-m*m,I>0){const E=i[p+1+s[C+1]];I*=I,B+=I*I*(Es[E]*g+vs[E]*m)}return 70*B}noise2(e,t){return this.noise(e,t)}noise3(e,t,s){const i=this.perm,r=this.g,o=(e+t+s)*ln,n=Math.floor(e+o),A=Math.floor(t+o),l=Math.floor(s+o),h=(n+A+l)*Ce,c=e-(n-h),d=t-(A-h),f=s-(l-h);let u,g,m,p,C,B;c>=d?d>=f?(u=1,g=0,m=0,p=1,C=1,B=0):c>=f?(u=1,g=0,m=0,p=1,C=0,B=1):(u=0,g=0,m=1,p=1,C=0,B=1):d<f?(u=0,g=0,m=1,p=0,C=1,B=1):c<f?(u=0,g=1,m=0,p=0,C=1,B=1):(u=0,g=1,m=0,p=1,C=1,B=0);const I=c-u+Ce,E=d-g+Ce,v=f-m+Ce,x=c-p+2*Ce,_=d-C+2*Ce,y=f-B+2*Ce,D=c-1+3*Ce,q=d-1+3*Ce,$=f-1+3*Ce,w=n&255,S=A&255,F=l&255;let P=0,Q,G;return Q=.6-c*c-d*d-f*f,Q>0&&(G=r[w+i[S+i[F]]],Q*=Q,P+=Q*Q*(kt[G]*c+Pt[G]*d+Gt[G]*f)),Q=.6-I*I-E*E-v*v,Q>0&&(G=r[w+u+i[S+g+i[F+m]]],Q*=Q,P+=Q*Q*(kt[G]*I+Pt[G]*E+Gt[G]*v)),Q=.6-x*x-_*_-y*y,Q>0&&(G=r[w+p+i[S+C+i[F+B]]],Q*=Q,P+=Q*Q*(kt[G]*x+Pt[G]*_+Gt[G]*y)),Q=.6-D*D-q*q-$*$,Q>0&&(G=r[w+1+i[S+1+i[F+1]]],Q*=Q,P+=Q*Q*(kt[G]*D+Pt[G]*q+Gt[G]*$)),32*P}fbm(e,t,s=4,i=2,r=.5){let o=1,n=1,A=0,l=0;for(let h=0;h<s;h++)A+=o*this.noise(e*n+h*17.3,t*n-h*9.1),l+=o,o*=r,n*=i;return A/l}fbm3(e,t,s,i=4,r=2,o=.5){let n=1,A=1,l=0,h=0;for(let c=0;c<i;c++)l+=n*this.noise3(e*A+c*17.3,t*A-c*9.1,s*A+c*5.3),h+=n,n*=o,A*=r;return l/h}ridged(e,t,s=4){let i=1,r=1,o=0,n=0;for(let A=0;A<s;A++){const l=1-Math.abs(this.noise(e*r+A*5.7,t*r+A*3.1));o+=i*l*l,n+=i,i*=.5,r*=2}return o/n}}const Sh=Object.freeze(Object.defineProperty({__proto__:null,Simplex:hn,clamp:oe,hash2:le,lerp:nn,mulberry32:hi,pfbm:Re,pnoise:Wa,smoothstep:be},Symbol.toStringTag,{value:"Module"}));function cn(a){let e=a>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function un(a){const e=cn(a),t=new Uint8Array(256);for(let i=0;i<256;i++)t[i]=i;for(let i=255;i>0;i--){const r=Math.floor(e()*(i+1)),o=t[i];t[i]=t[r],t[r]=o}const s=new Uint8Array(512);for(let i=0;i<512;i++)s[i]=t[i&255];return s}const Lt=[1,-1,1,-1,1,-1,0,0],Nt=[1,1,-1,-1,0,0,1,-1],Mi=a=>a*a*a*(a*(a*6-15)+10);function fn(a,e,t,s){const i=Math.floor(a),r=Math.floor(e),o=a-i,n=e-r,A=(i%t+t)%t,l=(r%t+t)%t,h=(A+1)%t,c=(l+1)%t,d=s[s[A]+l]&7,f=s[s[h]+l]&7,u=s[s[A]+c]&7,g=s[s[h]+c]&7,m=Lt[d]*o+Nt[d]*n,p=Lt[f]*(o-1)+Nt[f]*n,C=Lt[u]*o+Nt[u]*(n-1),B=Lt[g]*(o-1)+Nt[g]*(n-1),I=Mi(o),E=Mi(n),v=m+(p-m)*I,x=C+(B-C)*I;return(v+(x-v)*E)*.7071}function ws(a,e,t,s,i,r,o,n=!1){const A=un(s),l=new Float32Array(a*a);let h=1/0,c=-1/0;for(let u=0;u<a;u++)for(let g=0;g<a;g++){let m=e,p=1,C=0;const B=g/a,I=u/a;for(let E=0;E<t;E++){let v=fn(B*m,I*m,m,A);i&&(v=.6*v+.4*(.5-Math.abs(v))),C+=v*p,m*=2,p*=.52}l[u*a+g]=C,C<h&&(h=C),C>c&&(c=C)}const d=a*a;if(n){const u=Float32Array.from(l).sort(),g=new Float32Array(256);for(let m=0;m<256;m++)g[m]=u[Math.min(d-1,Math.floor((m+1)/256*d))];for(let m=0;m<d;m++){const p=l[m];let C=0,B=255;for(;C<B;){const I=C+B>>1;g[I]<p?C=I+1:B=I}r[m*4+o]=C}return}const f=255/(c-h||1);for(let u=0;u<d;u++)r[u*4+o]=Math.round((l[u]-h)*f)}function gn(a=512){const e=new Uint8Array(a*a*4);ws(a,4,6,1337,!0,e,0,!0),ws(a,3,5,4242,!1,e,1,!0),ws(a,16,3,99,!1,e,2);for(let s=0;s<a*a;s++)e[s*4+3]=255;const t=new ai(e,a,a,ie,N);return t.wrapS=t.wrapT=st,t.magFilter=O,t.minFilter=at,t.generateMipmaps=!0,t.anisotropy=4,t.colorSpace=Oe,t.needsUpdate=!0,t.name="cloudNoise",{texture:t,data:e,size:a}}function Fi(a,e,t,s=0){const i=a.size,r=a.data,o=(e-Math.floor(e))*i-.5,n=(t-Math.floor(t))*i-.5,A=Math.floor(o),l=Math.floor(n),h=o-A,c=n-l,d=m=>(m%i+i)%i,f=(m,p)=>r[(d(p)*i+d(m))*4+s]/255,u=f(A,l)+(f(A+1,l)-f(A,l))*h,g=f(A,l+1)+(f(A+1,l+1)-f(A,l+1))*h;return u+(g-u)*c}function Ut(a,e){const t=document.createElement("canvas");t.width=t.height=a;const s=t.getContext("2d");e(s,a);const i=new Dt(t);return i.colorSpace=qe,i}function dn(){const a=Ut(256,(i,r)=>{const o=r/2;let n=i.createRadialGradient(o,o,0,o,o,o);n.addColorStop(0,"rgba(255,255,255,1)"),n.addColorStop(.06,"rgba(255,250,235,0.85)"),n.addColorStop(.2,"rgba(255,225,180,0.25)"),n.addColorStop(.55,"rgba(255,200,150,0.05)"),n.addColorStop(1,"rgba(255,190,140,0)"),i.fillStyle=n,i.fillRect(0,0,r,r),i.globalCompositeOperation="lighter";for(let A=0;A<6;A++){i.save(),i.translate(o,o),i.rotate(A/6*Math.PI+.26);const l=i.createLinearGradient(-o,0,o,0);l.addColorStop(0,"rgba(255,240,220,0)"),l.addColorStop(.5,"rgba(255,240,220,0.18)"),l.addColorStop(1,"rgba(255,240,220,0)"),i.fillStyle=l,i.fillRect(-o,-.8,r,1.6),i.restore()}}),e=Ut(128,(i,r)=>{const o=r/2,n=r*.44;i.beginPath();for(let l=0;l<6;l++){const h=l/6*Math.PI*2+Math.PI/6;i[l?"lineTo":"moveTo"](o+Math.cos(h)*n,o+Math.sin(h)*n)}i.closePath();const A=i.createRadialGradient(o,o,0,o,o,n);A.addColorStop(0,"rgba(255,255,255,0.35)"),A.addColorStop(.8,"rgba(255,255,255,0.55)"),A.addColorStop(1,"rgba(255,255,255,0.8)"),i.fillStyle=A,i.filter="blur(1.5px)",i.fill()}),t=Ut(256,(i,r)=>{const o=r/2,n=i.createRadialGradient(o,o,r*.36,o,o,r*.48);n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.35,"rgba(255,120,80,0.35)"),n.addColorStop(.55,"rgba(160,255,170,0.35)"),n.addColorStop(.75,"rgba(120,150,255,0.35)"),n.addColorStop(1,"rgba(255,255,255,0)"),i.fillStyle=n,i.fillRect(0,0,r,r)}),s=Ut(64,(i,r)=>{const o=r/2,n=i.createRadialGradient(o,o,0,o,o,o);n.addColorStop(0,"rgba(255,255,255,0.9)"),n.addColorStop(.5,"rgba(255,255,255,0.35)"),n.addColorStop(1,"rgba(255,255,255,0)"),i.fillStyle=n,i.fillRect(0,0,r,r)});return{glow:a,hex:e,ring:t,dot:s}}const ci=4,De="directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;";let nt=null,xs=0,_s="";function mn(){const a=De.replace(/\[ i \]/g,"[ 0 ]"),e=De.replace(/\[ i \]/g,"[ 1 ]").replace(/directionalLightShadow\./g,"rcFarS.");return`
		#if ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
		if ( dot( directionalLights[ 1 ].color, vec3( 1.0 ) ) <= 0.0 && dot( directionalLights[ 1 ].direction, directionalLight.direction ) > 0.9999 ) {
			vec3 rcN = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
			vec3 rcF = vDirectionalShadowCoord[ 1 ].xyz / vDirectionalShadowCoord[ 1 ].w;
			vec2 rcE = abs( rcN.xy - 0.5 );
			float rcW = ( rcN.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE.x, rcE.y ) );
			float rcS = 1.0;
			if ( receiveShadow ) {
				DirectionalLightShadow rcFarS = directionalLightShadows[ 1 ];
				float rcSN = 1.0, rcSF = 1.0;
				if ( rcW < 1.0 ) rcSN = getShadow( directionalShadowMap[ 0 ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ 0 ] );
				if ( rcW > 0.0 ) {
					rcSF = getShadow( directionalShadowMap[ 1 ], rcFarS.shadowMapSize, rcFarS.shadowIntensity, rcFarS.shadowBias, rcFarS.shadowRadius, vDirectionalShadowCoord[ 1 ] );
					vec2 rcEF = abs( rcF.xy - 0.5 );
					rcSF = mix( rcSF, 1.0, smoothstep( 0.43, 0.495, max( rcEF.x, rcEF.y ) ) );
				}
				rcS = mix( rcSN, rcSF, rcW );
			}
			directLight.color *= rcS;
		} else {
			${a}
		}
		#elif ( UNROLLED_LOOP_INDEX == 1 )
		if ( dot( directLight.color, vec3( 1.0 ) ) > 0.0 ) {
			DirectionalLightShadow rcFarS = directionalLightShadows[ 1 ];
			${e}
		}
		#else
		${De}
		#endif`}const pn=a=>`dot( directionalLights[ ${a} ].color, vec3( 1.0 ) ) <= 0.0 && dot( directionalLights[ ${a} ].direction, directionalLight.direction ) > 0.9999`;function Xa(a){const e=a===0?"directionalLightShadow":`rcL${a}`;return`getShadow( directionalShadowMap[ ${a} ], ${e}.shadowMapSize, ${e}.shadowIntensity, ${e}.shadowBias, ${e}.shadowRadius, vDirectionalShadowCoord[ ${a} ] )`}function $a(a,e,t,s){s(`DirectionalLightShadow rcL${a} = directionalLightShadows[ ${a} ];`,t),s(`vec3 rc${a} = vDirectionalShadowCoord[ ${a} ].xyz / vDirectionalShadowCoord[ ${a} ].w;`,t),s(`vec2 rcE${a} = abs( rc${a}.xy - 0.5 );`,t),s(`bool rcF${a} = rcN == ${a+1};`,t),s(`float rcW${a} = rcF${a} ? 0.0 : ( rc${a}.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE${a}.x, rcE${a}.y ) );`,t),s(`float rcS${a} = 1.0, rcR${a} = 1.0;`,t),s(`if ( rcW${a} < 1.0 ) rcS${a} = ${Xa(a)};`,t),s(`if ( rcF${a} ) rcS${a} = mix( rcS${a}, 1.0, smoothstep( 0.43, 0.495, max( rcE${a}.x, rcE${a}.y ) ) );`,t),a+1<e&&(s(`#if NUM_DIR_LIGHT_SHADOWS > ${a+1}`,t),s(`else if ( rcW${a} > 0.0 ) {`,t),$a(a+1,e,t+1,s),s("}",t),s("#endif",t)),s(`rcR${a-1} = mix( rcS${a}, rcR${a}, rcW${a} );`,t)}function Cn(a){const e=De.replace(/\[ i \]/g,"[ 0 ]"),t=[""],s=(i,r)=>t.push("		"+"	".repeat(r)+i);s("#if ( UNROLLED_LOOP_INDEX == 0 ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )",0),s("{",0),s("int rcN = 1;",1);for(let i=1;i<a;i++)i>1&&s(`#if NUM_DIR_LIGHT_SHADOWS > ${i}`,i),s(`if ( ${pn(i)} ) {`,i),s(`rcN = ${i+1};`,i+1);for(let i=a-1;i>=1;i--)s("}",i),i>1&&s("#endif",i);return s("if ( rcN > 1 ) {",1),s("float rcS = 1.0;",2),s("if ( receiveShadow ) {",2),s("vec3 rc0 = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;",3),s("vec2 rcE0 = abs( rc0.xy - 0.5 );",3),s("float rcW0 = ( rc0.z > 1.0 ) ? 1.0 : smoothstep( 0.39, 0.47, max( rcE0.x, rcE0.y ) );",3),s("float rcS0 = 1.0, rcR0 = 1.0;",3),s(`if ( rcW0 < 1.0 ) rcS0 = ${Xa(0)};`,3),s("if ( rcW0 > 0.0 ) {",3),$a(1,a,4,s),s("}",3),s("rcS = mix( rcS0, rcR0, rcW0 );",3),s("}",2),s("directLight.color *= rcS;",2),s("} else {",1),s(e,2),s("}",1),s("}",0),s("#elif ( UNROLLED_LOOP_INDEX > 0 )",0),s("if ( dot( directLight.color, vec3( 1.0 ) ) > 0.0 ) {",0),s(De,1),s("}",0),s("#else",0),s(De,0),s("#endif",0),t.join(`
`)}function In(a=2){const e=Math.max(2,Math.min(ci,Math.round(a)||2));return e===2?mn():Cn(e)}function Za(a=2){const e=Math.max(2,Math.min(ci,Math.round(a)||2));if(nt===!1)return!1;if(nt===!0&&e<=xs)return!0;const t=Mt,s=In(e);if(nt===null){if(!t.lights_fragment_begin.includes(De))return console.warn("[render] shadow cascade patch: three.js chunk changed, using a single cascade"),nt=!1,!1;t.lights_fragment_begin=t.lights_fragment_begin.replace(De,s)}else{if(!t.lights_fragment_begin.includes(_s))return console.warn(`[render] shadow cascade patch: lights_fragment_begin was replaced, keeping ${xs} cascades`),!1;t.lights_fragment_begin=t.lights_fragment_begin.replace(_s,()=>s)}return nt=!0,xs=e,_s=s,!0}const Bn=["pcf","fast","pcss"],Xt="ENGINE_SHADOW_FAST",$t="ENGINE_SHADOW_PCSS",ze="engineDirShadowDepth",As="engineDirShadowPcss",We={length:0},is={length:4};for(let a=0;a<4;a++)is[a]=new Be(0,0,0,0);const En=`
#if defined( USE_SHADOWMAP ) && defined( ${Xt} ) && defined( SHADOWMAP_TYPE_PCF ) && NUM_DIR_LIGHT_SHADOWS > 0
	uniform sampler2DShadow ${ze}[ NUM_DIR_LIGHT_SHADOWS ];
	float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		if ( inFrustum && shadowCoord.z <= 1.0 ) {
			vec2 s = sqrt( max( 0.2206 * shadowRadius * shadowRadius - 0.0417, 0.0 ) ) / shadowMapSize;
			vec3 p = shadowCoord.xyz;
			shadow = 0.2 * (
				texture( shadowMap, p ) +
				texture( shadowMap, vec3( p.xy + s * vec2( 2.0, 1.0 ), p.z ) ) +
				texture( shadowMap, vec3( p.xy + s * vec2( - 1.0, 2.0 ), p.z ) ) +
				texture( shadowMap, vec3( p.xy - s * vec2( 2.0, 1.0 ), p.z ) ) +
				texture( shadowMap, vec3( p.xy - s * vec2( - 1.0, 2.0 ), p.z ) ) );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#define directionalShadowMap ${ze}
#endif
`,Ri=a=>Array.from({length:a},(e,t)=>{const s=Math.sqrt((t+.5)/a),i=t*2.39996323;return`vec2( ${(s*Math.cos(i)).toFixed(4)}, ${(s*Math.sin(i)).toFixed(4)} )`}).join(", "),Ot=a=>`enginePcssShadow( directionalShadowMap[ ${a} ], ${ze}[ ${a} ], ${As}[ ${a} ], shadowMapSize, shadowIntensity, shadowBias, shadowRadius, shadowCoord )`,vn=`
#if defined( USE_SHADOWMAP ) && defined( ${$t} ) && defined( SHADOWMAP_TYPE_PCF ) && NUM_DIR_LIGHT_SHADOWS > 0 && NUM_DIR_LIGHT_SHADOWS <= 4
	uniform sampler2DShadow ${ze}[ NUM_DIR_LIGHT_SHADOWS ];
	uniform vec4 ${As}[ NUM_DIR_LIGHT_SHADOWS ];
	const vec2 enginePcssSearch[ 8 ] = vec2[ 8 ]( ${Ri(8)} );
	const vec2 enginePcssDisc[ 12 ] = vec2[ 12 ]( ${Ri(12)} );
	const ivec4 enginePcssIndex = ivec4( 0, 1, 2, 3 );
	float enginePcssShadow( sampler2D packedMap, sampler2DShadow depthMap, vec4 pcss, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		// receiver plane: depth change per texel along the map's x / y (derivatives before any branch of this function;
		// callers may be in non-uniform flow, see the header)
		vec3 ddx = dFdx( shadowCoord.xyz ), ddy = dFdy( shadowCoord.xyz );
		float det = ddx.x * ddy.y - ddx.y * ddy.x;
		vec2 slope = abs( det ) > 1e-20 ? vec2( ddy.y * ddx.z - ddx.y * ddy.z, ddx.x * ddy.z - ddy.x * ddx.z ) / ( det * shadowMapSize ) : vec2( 0.0 );
		slope = clamp( slope, - pcss.z, pcss.z );
		if ( shadowCoord.x < 0.0 || shadowCoord.x > 1.0 || shadowCoord.y < 0.0 || shadowCoord.y > 1.0 || shadowCoord.z > 1.0 ) return 1.0;
		vec2 texel = 1.0 / shadowMapSize;
		vec3 p = shadowCoord.xyz;
		// 1. contact kernel: the 'fast' kernel (three's PCF width at shadowRadius)
		float s = sqrt( max( 0.2206 * shadowRadius * shadowRadius - 0.0417, 0.0 ) );
		vec2 g1 = s * vec2( 2.0, 1.0 ), g2 = s * vec2( - 1.0, 2.0 );
		float lit = 0.2 * (
			texture( depthMap, p ) +
			texture( depthMap, vec3( p.xy + g1 * texel, p.z + dot( slope, g1 ) ) ) +
			texture( depthMap, vec3( p.xy + g2 * texel, p.z + dot( slope, g2 ) ) ) +
			texture( depthMap, vec3( p.xy - g1 * texel, p.z - dot( slope, g1 ) ) ) +
			texture( depthMap, vec3( p.xy - g2 * texel, p.z - dot( slope, g2 ) ) ) );
		// 2. blocker search: raw depths from the packed map over the widest filter radius (one pattern for every pixel:
		// neighbours read the same texels, which keeps the texture cache warm; only the filter below is rotated)
		float nb = 0.0, zb = 0.0;
		for ( int k = 0; k < 8; k ++ ) {
			vec2 o = enginePcssSearch[ k ] * pcss.y;
			float d = unpackRGBAToDepth( texture( packedMap, p.xy + o * texel ) );
			#ifdef USE_REVERSED_DEPTH_BUFFER
			if ( d > p.z + dot( slope, o ) ) { nb += 1.0; zb += d; }
			#else
			if ( d < p.z + dot( slope, o ) ) { nb += 1.0; zb += d; }
			#endif
		}
		// no blocker: contact kernel; umbra (may harden the inner edge of a wide penumbra a little, see the header)
		if ( nb == 0.0 || ( nb == 8.0 && lit == 0.0 ) ) return mix( 1.0, lit, shadowIntensity );
		// 3. penumbra: filter radius from the mean blocker distance, at least the contact kernel's, at most pcss.y
		float rMin = 2.0 * sqrt( max( 0.441 * shadowRadius * shadowRadius - 0.0833, 0.0 ) );
		float rad = max( min( 0.5 * abs( p.z - zb / nb ) * pcss.x, pcss.y ), rMin );
		float wide = smoothstep( 1.5 * rMin, 2.5 * rMin, rad );
		if ( wide > 0.0 ) {
			float a = 6.2831853 * fract( 52.9829189 * fract( dot( gl_FragCoord.xy + 5.588238 * pcss.w, vec2( 0.06711056, 0.00583715 ) ) ) );
			mat2 rot = mat2( cos( a ), sin( a ), - sin( a ), cos( a ) );
			float sw = 0.0;
			for ( int k = 0; k < 12; k ++ ) {
				vec2 o = rot * enginePcssDisc[ k ] * rad;
				sw += texture( depthMap, vec3( p.xy + o * texel, p.z + dot( slope, o ) ) );
			}
			lit = mix( lit, sw * ( 1.0 / 12.0 ), wide );
		}
		return mix( 1.0, lit, shadowIntensity );
	}
	float getShadow( int cascade, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		#if NUM_DIR_LIGHT_SHADOWS > 3
		if ( cascade == 3 ) return ${Ot(3)};
		#endif
		#if NUM_DIR_LIGHT_SHADOWS > 2
		if ( cascade == 2 ) return ${Ot(2)};
		#endif
		#if NUM_DIR_LIGHT_SHADOWS > 1
		if ( cascade == 1 ) return ${Ot(1)};
		#endif
		return ${Ot(0)};
	}
	#define directionalShadowMap enginePcssIndex
#endif
`;let dt=null,mt=null;function er(a,e){const t=Mt;return[[t.shadowmap_pars_fragment,"uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];"],[t.shadowmap_pars_fragment,"float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord )"],[t.shadowmap_pars_fragment,"unpackRGBAToDepth"],[t.lights_fragment_begin,"getShadow( directionalShadowMap["]].every(([i,r])=>typeof i=="string"&&i.includes(r))?!0:(console.warn(`[render] ${a} shadow kernel: three.js shadow chunk changed, keeping '${e}'`),!1)}function Os(a,e){for(const t in Us){const s=Us[t].uniforms;s&&s.directionalShadowMap&&!s[a]&&(s[a]={value:e})}}function wn(){return dt!==null?dt:er("fast","pcf")?(Mt.shadowmap_pars_fragment+=En,Os(ze,We),dt=!0,!0):(dt=!1,!1)}function xn(){return mt!==null?mt:er("pcss","pcf")?(Mt.shadowmap_pars_fragment+=vn,Os(ze,We),Os(As,is),mt=!0,!0):(mt=!1,!1)}function _n(a=!1){const e=new ri(1,1);return e.compareFunction=a?mo:po,e.minFilter=e.magFilter=O,e}function yn(a,e){const t=a.shadow;if(t.map&&t.map.depthTexture===e)return!1;e.renderTarget&&e.renderTarget!==t.map&&(e.renderTarget.depthTexture=null),t.map&&t.map.dispose();const s=new Y(t.mapSize.x,t.mapSize.y,{minFilter:Ae,magFilter:Ae,depthTexture:e});return s.texture.name=`${a.name}.shadowMap`,t.map=s,t.needsUpdate=!0,!0}function Qn(a,e=a.length){for(let t=0;t<e;t++)We[t]=a[t];for(let t=e;t<We.length;t++)We[t]=void 0;We.length=e}function Sn(a,e=a.length){const t=Math.min(e,4);for(let s=0;s<t;s++)is[s].copy(a[s]);for(let s=t;s<4;s++)is[s].set(0,0,0,0)}function Ti(a,e){return!!(a.isMeshStandardMaterial||a.isMeshLambertMaterial||a.isMeshPhongMaterial||a.isMeshToonMaterial||a.isShadowMaterial||a.isShaderMaterial&&a.lights===!0&&a.uniforms&&a.uniforms[ze]&&(!e||a.uniforms[As]))}function ki(a,e){if(!a||!Ti(a,!1))return!1;const t=e==="pcss"&&mt===!0&&Ti(a,!0),s=e==="fast"&&dt===!0,i=a.defines,r=!!(i&&Xt in i),o=!!(i&&$t in i);return s===r&&t===o?!1:(r&&!s&&delete i[Xt],o&&!t&&delete i[$t],s&&!r&&((a.defines||(a.defines={}))[Xt]=""),t&&!o&&((a.defines||(a.defines={}))[$t]=""),a.needsUpdate=!0,!0)}const Ne={kernel:"pcf",n:0};function bn(a){const e=a.material;if(e)if(Array.isArray(e))for(let t=0;t<e.length;t++)ki(e[t],Ne.kernel)&&Ne.n++;else ki(e,Ne.kernel)&&Ne.n++}function Pi(a,e){return Ne.kernel=e,Ne.n=0,a&&a.traverse(bn),Ne.n}const W=Math.PI/180,Gi=8,Li={dawn:7.25,morning:9.5,noon:13,afternoon:15.5,golden:17.55,sunset:18.45,dusk:18.95,night:22},Dn=Za(),tr={rise:7.15,set:18.6,maxElevation:46,nightDepth:35,nightRate:13,azimuthStart:102,azimuthSpan:156};function Mn(a,e=tr){const t=e.rise,s=e.set,i=e.maxElevation*W,r=(a-t)/(s-t);let o;r>=0&&r<=1?o=i*Math.sin(Math.PI*r):o=-Math.min(e.nightDepth*W,(r>1?a-s:t-a<0?t-a+24:t-a)*e.nightRate*W);const n=(e.azimuthStart+e.azimuthSpan*oe(r,-.15,1.15))*W;return{el:o,az:n}}function Fn(a,e){let t=a.r*e/.6,s=a.g*e/.6,i=a.b*e/.6;const r=.59719*t+.35458*s+.04823*i,o=.076*t+.90834*s+.01566*i,n=.0284*t+.13383*s+.83777*i,A=d=>(d*(d+.0245786)-90537e-9)/(d*(.983729*d+.432951)+.238081),l=A(r),h=A(o),c=A(n);return new T(oe(1.60475*l-.53108*h-.07367*c,0,1),oe(-.10208*l+1.10813*h-.00605*c,0,1),oe(-.00327*l-.07276*h+1.07602*c,0,1))}const Rn=[{el:-40,turb:2.4,ray:1.4,mie:.003,g:.78,tw:1,night:1,glowA:0,sun:1,env:.85,hemi:.2,haze:18e-5,mist:8e-5,cover:.36,cirrus:.22,cop:.8,cs:[.012,.014,.02],ca:[.032,.023,.019],aur:0},{el:-12,turb:2.4,ray:1.4,mie:.003,g:.78,tw:1,night:1,glowA:.05,sun:1,env:.85,hemi:.2,haze:18e-5,mist:8e-5,cover:.36,cirrus:.22,cop:.8,cs:[.014,.015,.022],ca:[.032,.024,.021],aur:0},{el:-6,turb:2.6,ray:1.6,mie:.003,g:.78,tw:1,night:.3,glowA:.55,sun:1,env:1.1,hemi:.26,haze:17e-5,mist:1e-4,cover:.34,cirrus:.26,cop:.8,cs:[.09,.045,.055],ca:[.026,.026,.038],aur:0},{el:-3,turb:3,ray:2,mie:.0035,g:.8,tw:1,night:0,glowA:1,sun:1,env:1.2,hemi:.28,haze:17e-5,mist:12e-5,cover:.33,cirrus:.3,cop:.85,cs:[.36,.13,.1],ca:[.04,.036,.052],aur:0},{el:0,turb:3.2,ray:2.3,mie:.004,g:.8,tw:.55,night:0,glowA:.9,sun:1,env:1.05,hemi:.26,haze:12e-5,mist:13e-5,cover:.32,cirrus:.32,cop:.85,cs:[.65,.26,.13],ca:[.065,.055,.065],aur:.5},{el:3,turb:3,ray:2.2,mie:.0038,g:.8,tw:.12,night:0,glowA:.4,sun:1,env:.95,hemi:.24,haze:12e-5,mist:11e-5,cover:.32,cirrus:.32,cop:.85,cs:[.9,.45,.24],ca:[.1,.095,.11],aur:.55},{el:9,turb:2.3,ray:1.75,mie:.0033,g:.8,tw:0,night:0,glowA:0,sun:1,env:.9,hemi:.22,haze:11e-5,mist:8e-5,cover:.3,cirrus:.3,cop:.85,cs:[1.05,.75,.5],ca:[.15,.16,.19],aur:.5},{el:18,turb:2.2,ray:1.6,mie:.0031,g:.79,tw:0,night:0,glowA:0,sun:1,env:.88,hemi:.2,haze:1e-4,mist:5e-5,cover:.28,cirrus:.3,cop:.85,cs:[1.2,1.08,.95],ca:[.21,.23,.28],aur:.4},{el:32,turb:2.1,ray:1.5,mie:.0029,g:.78,tw:0,night:0,glowA:0,sun:1,env:.86,hemi:.18,haze:8e-5,mist:4e-5,cover:.26,cirrus:.28,cop:.85,cs:[1.3,1.25,1.18],ca:[.25,.28,.33],aur:.3},{el:50,turb:2,ray:1.4,mie:.0027,g:.78,tw:0,night:0,glowA:0,sun:1,env:.85,hemi:.18,haze:8e-5,mist:3e-5,cover:.25,cirrus:.25,cop:.85,cs:[1.35,1.32,1.28],ca:[.27,.3,.36],aur:.3},{el:90,turb:1.95,ray:1.35,mie:.0026,g:.78,tw:0,night:0,glowA:0,sun:1,env:.83,hemi:.17,haze:7e-5,mist:25e-6,cover:.25,cirrus:.24,cop:.85,cs:[1.4,1.37,1.33],ca:[.28,.31,.37],aur:.25}];function Ni(a,e){let t=0;for(;t<a.length-2&&e>a[t+1].el;)t++;const s=a[t],i=a[t+1],r=oe((e-s.el)/(i.el-s.el),0,1),o=r*r*(3-2*r),n={};for(const A in s)A!=="el"&&(n[A]=Array.isArray(s[A])?s[A].map((l,h)=>l+(i[A][h]-l)*o):s[A]+(i[A]-s[A])*o);return n}function Tn(a){const e=Math.max(a/W,-1),t=1/(Math.sin(Math.max(e,0)*W)+.50572*Math.pow(e+6.07995,-1.6364)),i=[.045,.085,.19].map(o=>Math.exp(-t*o)),r=Math.max(...i);return{color:new T(i[0]/r,i[1]/r,i[2]/r),trans:r}}const kn=`
uniform float skyGain;
uniform float uDisc, uDiscCos;
uniform vec3 uGlowCol;
uniform float uTwilight, uNight, uAfterglow;
uniform vec3 uTwZen, uTwHor, uTwGlow, uNightZen, uNightHor, uPollution;
uniform float uClouds, uCover, uCirrus, uCloudOpacity, uCloudScale, uCloudH;
uniform vec2 uCloudOffset;
uniform sampler2D tCloud;
uniform vec3 uCloudSun, uCloudAmb;
uniform float uStars, uTime;
uniform vec3 uMoonDir, uMoonCol;
uniform vec3 uHorizonTint;
uniform float uSkySat;
float rsHash13( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
vec3 rsHash33( vec3 p ) { p = fract( p * vec3( 0.1031, 0.1030, 0.0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.xxy + p.yxx ) * p.zyx ); }
float rsCloud( vec2 uv ) { return texture2D( tCloud, uv ).r * 0.65 + texture2D( tCloud, uv * 2.9 + vec2( 0.37, 0.71 ) ).r * 0.35; }
`,Pn=`
	vec3 col = retColor * skyGain;
	col = max( mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, uSkySat ), 0.0 ); // Preetham is pale
	float rsCs = max( cosTheta, 0.0 );
	{ // Preetham's horizon is milky: cool it to a blue-grey away from the sun (the sun side stays warm)
		float toSun = dot( normalize( direction.xz + vec2( 1e-5 ) ), normalize( vSunDirection.xz + vec2( 1e-5 ) ) ) * 0.5 + 0.5;
		float hz = exp( -max( direction.y, 0.0 ) * 9.0 );
		col *= mix( vec3( 1.0 ), uHorizonTint, hz * ( 1.0 - toSun * toSun * toSun ) );
	}
	col += uGlowCol * uDisc * ( 0.35 * pow( rsCs, 900.0 ) + 0.05 * pow( rsCs, 48.0 ) );
	// blue hour / night: replaces the Preetham model once the sun is below the horizon
	if ( uTwilight > 0.0 ) {
		float h = max( direction.y, 0.0 );
		vec2 sd = normalize( vSunDirection.xz + vec2( 1e-5 ) );
		vec2 dd = normalize( direction.xz + vec2( 1e-5 ) );
		// clamped: normalize() can leave |dot| a hair above 1, and pow( negative, y ) is NaN (ANGLE/Metal), which
		// PMREM would smear over the whole environment map (black PBR surfaces at some twilight hours)
		float towards = clamp( dot( dd, sd ) * 0.5 + 0.5, 0.0, 1.0 );
		vec3 tw = mix( uTwHor, uTwZen, pow( h, 0.5 ) );
		tw += uTwGlow * uAfterglow * exp( -h * 7.0 ) * pow( towards, 2.5 );
		tw += uTwGlow * vec3( 0.25, 0.45, 0.9 ) * uAfterglow * 0.35 * exp( -abs( h - 0.1 ) * 12.0 ) * pow( 1.0 - towards, 2.0 ); // belt of Venus
		vec3 ng = mix( uNightHor, uNightZen, pow( h, 0.4 ) ) + uPollution * exp( -h * 6.0 );
		tw = mix( tw, ng, uNight );
		col = mix( col, tw, uTwilight );
	}
	// stars + moon (night)
	if ( uStars > 0.0 && direction.y > 0.0 ) {
		vec3 q = direction * 360.0;
		vec3 id = floor( q );
		float hs = rsHash13( id );
		if ( hs > 0.982 ) {
			vec3 o = rsHash33( id + 7.0 );
			float d = length( fract( q ) - ( 0.25 + 0.5 * o ) );
			float b = ( hs - 0.982 ) / 0.018; b = b * b * b;
			float tw = 0.7 + 0.3 * sin( uTime * ( 1.3 + 3.0 * o.x ) + hs * 91.0 );
			col += mix( vec3( 1.0, 0.85, 0.7 ), vec3( 0.75, 0.85, 1.0 ), o.y ) * smoothstep( 0.24, 0.0, d ) * ( 0.06 + 1.6 * b ) * tw * uStars * smoothstep( 0.04, 0.35, direction.y );
		}
	}
	if ( uStars > 0.0 ) {
		float cm = dot( direction, uMoonDir );
		if ( cm > 0.9995 ) {
			vec3 mx = normalize( cross( uMoonDir, vec3( 0.0, 1.0, 0.0 ) ) );
			vec3 my = cross( mx, uMoonDir );
			vec2 p = vec2( dot( direction, mx ), dot( direction, my ) ) / 0.0105;
			float disc = smoothstep( 1.0, 0.93, length( p ) );
			vec3 n = vec3( p, sqrt( max( 0.0, 1.0 - dot( p, p ) ) ) );
			float lit = smoothstep( -0.2, 0.3, dot( n, normalize( vec3( 0.6, 0.2, 0.75 ) ) ) );
			float maria = texture2D( tCloud, p * 0.16 + 0.37 ).b;
			col = mix( col, col * 0.4 + uMoonCol * ( 0.55 + 0.5 * maria ) * ( 0.06 + 0.94 * lit ), disc * uStars );
		}
		float cm2 = max( cm, 0.0 );
		col += uMoonCol * uStars * ( 0.006 * pow( cm2, 1500.0 ) + 0.0025 * pow( cm2, 90.0 ) );
	}
	// clouds: cumulus layer at uCloudH + streaky cirrus at 2.6x, lit by the sun colour, fading into the horizon
	if ( uClouds > 0.0 && direction.y > 0.0 ) {
		float dy = max( direction.y, 0.012 );
		float t = max( uCloudH - cameraPosition.y, 60.0 ) / dy;
		vec2 uv = ( cameraPosition.xz + direction.xz * t ) * uCloudScale + uCloudOffset;
		float n = rsCloud( uv ) + ( texture2D( tCloud, uv * 9.0 ).b - 0.5 ) * 0.12;
		float thr = 1.0 - uCover;
		float d = smoothstep( thr, thr + 0.2, n );
		vec2 sdir = normalize( vSunDirection.xz + vec2( 1e-4 ) ) * 0.012;
		float dS = smoothstep( thr, thr + 0.2, rsCloud( uv + sdir ) );
		float lit = clamp( 1.0 - 0.7 * dS + 0.2 * ( 1.0 - d ), 0.0, 1.0 );
		float fwd = pow( rsCs, 5.0 );
		vec3 cc = uCloudAmb * ( 0.7 + 0.3 * ( 1.0 - d ) ) + uCloudSun * lit * ( 0.45 + 1.5 * fwd * ( 1.0 - 0.6 * d ) );
		float t2 = max( uCloudH * 2.6 - cameraPosition.y, 60.0 ) / dy;
		vec2 w2 = cameraPosition.xz + direction.xz * t2;
		vec2 uv2 = vec2( w2.x * 0.8 + w2.y * 0.6, -w2.x * 0.6 + w2.y * 0.8 ) * uCloudScale * vec2( 0.45, 1.5 ) + uCloudOffset * 1.7;
		float ci = smoothstep( 0.5, 0.95, texture2D( tCloud, uv2 ).g * 0.8 + texture2D( tCloud, uv2 * 3.1 + 0.3 ).g * 0.2 );
		ci *= smoothstep( 0.35, 0.75, texture2D( tCloud, uv2 * 0.21 + vec2( 0.5, 0.2 ) ).r ) * uCirrus; // patchy, not uniform streaks
		vec3 cic = uCloudAmb * 0.9 + uCloudSun * ( 0.8 + 2.2 * fwd );
		float fade = smoothstep( 0.0, 0.05, direction.y );
		float a1 = d * uCloudOpacity * fade;
		float a2 = ci * 0.5 * fade;
		vec3 sky0 = col;
		col = mix( col, mix( cic, sky0, ( 1.0 - exp( -t2 * 0.00002 ) ) * 0.8 ), a2 );
		col = mix( col, mix( cc, sky0, 1.0 - exp( -t * 0.00004 ) ), a1 );
	}
	gl_FragColor = vec4( col, 1.0 );`;function Gn(a){return{skyGain:{value:.6},uDisc:{value:1},uDiscCos:{value:Math.cos(.0075)},uGlowCol:{value:new T(0,0,0)},uTwilight:{value:0},uNight:{value:0},uAfterglow:{value:0},uTwZen:{value:new T(.018,.04,.115)},uTwHor:{value:new T(.1,.11,.15)},uTwGlow:{value:new T(.75,.28,.07)},uNightZen:{value:new T(.0035,.0075,.024)},uNightHor:{value:new T(.012,.015,.026)},uPollution:{value:new T(.036,.027,.024)},uClouds:{value:1},uCover:{value:.3},uCirrus:{value:.4},uCloudOpacity:{value:.85},uCloudScale:{value:1/14e3},uCloudH:{value:1700},uCloudOffset:{value:new L(.13,.41)},tCloud:{value:a},uCloudSun:{value:new T(1,1,1)},uCloudAmb:{value:new T(.3,.3,.35)},uStars:{value:0},uTime:{value:0},uHorizonTint:{value:new T(.8,.93,1.15)},uSkySat:{value:1.3},uMoonDir:{value:new b(0,1,0)},uMoonCol:{value:new T(1.6,1.55,1.45)}}}function Ui(a,e){const t=a.material;Object.assign(t.uniforms,Gn(e));let s=t.fragmentShader;const i=["uniform vec3 up;","float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );","gl_FragColor = vec4( retColor, 1.0 );"];for(const r of i)s.includes(r)||console.warn("[sky] Sky shader patch point missing:",r);return s=s.replace("uniform vec3 up;",`uniform vec3 up;
`+kn).replace(i[1],"float sundisk = uDisc * smoothstep( uDiscCos, uDiscCos + 0.00002, cosTheta );").replace(i[2],Pn),t.fragmentShader=s,t.needsUpdate=!0,a}const Ln=[["glow",380,0,[1,.92,.8],.25],["dot",46,.32,[1,.75,.45],.16],["hex",74,.52,[.55,.85,1],.1],["hex",118,.7,[1,.7,.4],.075],["ring",300,.92,[1,1,1],.07],["hex",170,1.12,[.55,1,.7],.055],["dot",90,1.38,[.75,.6,1],.07]],Nn={cascades:2,near:45,far:[260,420,650],farUp:[70,200],farDown:[50,160],mid:null,single:130,nearMapSize:2048,midMapSize:2048,farMapSize:4096,singleMapSize:4096,nearRadius:2,midRadius:1.7,farRadius:1.4,lead:.45,farLead:.55,farMaxY:40,kernel:"pcf",lightSize:.5,maxPenumbra:24,temporalNoise:!1};class bh{constructor(e={},t,s){const i=!!(e&&e.isScene),r=i?{...s||{},scene:e,renderer:t}:e;this.scene=r.scene,this.renderer=r.renderer,this.timePresets=r.timePresets||Li,this.sunModel={...tr,...r.sun||{}},this.looks=r.looks||Rn;const o=this.shadowOpts={...Nn,...r.shadows||{}};r.shadowNearHalf!=null&&(o.near=r.shadowNearHalf);const n=Math.max(1,Math.min(ci,Math.floor(Number(o.cascades))||1));this.cascaded=n>1&&Dn,this.cascadeCount=this.cascaded?n>2&&Za(n)?n:2:1,this.cascadeLights=[],this.shadowKernel="pcf";const A=r.timeOfDay??"golden";this.hours=typeof A=="number"?A:this.timePresets[A]??this.timePresets.golden??Li.golden,this.skyGain=r.skyGain??.38,this.skyRadius=r.skyRadius??4e3,this.sunIntensity=r.sunIntensity??3.9,this.moonIntensity=r.moonIntensity??.3,this.moonScatter=Math.max(0,+r.moonScatter||0),this.moonColor=new T(...r.moonColor||[.62,.72,1]),this.fogDensity=r.fogDensity??[3e-4,15e-5],this.flareSpec=r.flare===!1?null:r.flare||Ln,this.nearHalf=o.near,this.farHalfSteps=Array.isArray(o.far)?o.far.slice():[o.far],this.shadowHalf=this.nearHalf,this.sunDir=new b(0,1,0),this.lightDir=new b(0,1,0);const l=r.moon||{azimuth:150,elevation:34};this.moonDir=new b,this.moonDir.set(Math.sin(l.azimuth*W)*Math.cos(l.elevation*W),Math.sin(l.elevation*W),-Math.cos(l.azimuth*W)*Math.cos(l.elevation*W)).normalize(),this.darkness=0,this.windowGlow=0,this.maxBuildingHeight=r.maxCasterHeight??200,this.version=0,this.fogMode="scene",this.camera=r.camera||null,this.sunColor=new T(1,1,1),this.scatterDir=this.moonScatter>0?new b(0,1,0):this.sunDir,this.scatterColor=this.moonScatter>0?new T(1,1,1):this.sunColor,this.fogParams={haze:2e-4,hazeK:1/700,hazeBase:0,mist:1e-4,mistK:1/40,sunScatter:0},this.look=Ni(this.looks,10),this.cloudWind=new L(...r.cloudWind||[6.5,2.2]),this._frame=0,this._farHalf=this.farHalfSteps[0],this._farDirty=!0,this._lastT=0,this._clock=0,this._fastDepth=null,this._fastMaps=null,this._onChildAdded=null,this._pcss=null,this._noiseFrame=0,this.flareScale=1,(r.build??!i)&&this.build()}get maxCasterHeight(){return this.maxBuildingHeight}set maxCasterHeight(e){this.maxBuildingHeight=e}build(){const{scene:e,renderer:t}=this,s=this.shadowOpts;this.cloudAtlas=gn(512);const i=this.cloudAtlas.texture;this.sky=Ui(new Qt,i),this.sky.scale.setScalar(this.skyRadius),this.sky.frustumCulled=!1,this.sky.renderOrder=-1,this.sky.name="sky",this.sky.material.uniforms.uStars.value=0,e.add(this.sky);const r=t?.capabilities?.maxTextureSize||4096;this.sun=new Ci(16777215,3),this.sun.name="sun",this.sun.castShadow=!0;const o=this.cascaded?Math.min(s.nearMapSize,r):Math.min(s.singleMapSize,r);if(this.cascaded||(this.nearHalf=s.single),this.sun.shadow.mapSize.set(o,o),this._setBox(this.sun,this.nearHalf),this.sun.shadow.radius=s.nearRadius,e.add(this.sun,this.sun.target),this.cascadeLights.length=0,this.cascadeLights.push(this.sun),this.cascaded){const n=this.cascadeCount,A=Math.min(s.farMapSize,r),l=Math.min(s.midMapSize,r);this.midHalfSteps=this._midHalfSteps(o,l,A);for(let h=1;h<n-1;h++){const c=h===1?"sunMid":"sunMid2",d=this[c]=this._cascadeLight(`${c}Cascade`,l,this.midHalfSteps[h-1][0],s.midRadius);e.add(d,d.target),this.cascadeLights.push(d)}this.sunFar=this._cascadeLight("sunFarCascade",A,this._farHalf,s.farRadius),e.add(this.sunFar,this.sunFar.target),this.cascadeLights.push(this.sunFar)}return this.cascaded&&this._checkShadowOrder(),this.hemi=new Co(12571903,4866102,.3),e.add(this.hemi),this.fog=new gs(12634320,42e-5),this.fogPost=new gs(8425632,0),e.fog=this.fogMode==="scene"?this.fog:this.fogPost,this.pmrem=t?new Io(t):null,this.envScene=new Ns,this.envSky=Ui(new Qt,i),this.envSky.scale.setScalar(500),this.envScene.add(this.envSky),this.skyCubeRT=new Bo(32,{type:H,generateMipmaps:!1,minFilter:O,magFilter:O}),this.skyCubeRT.texture.name="skyCube",this.cubeCam=new Eo(.1,1e3,this.skyCubeRT),this.envScene.add(this.cubeCam),this.flareSpec&&t&&typeof document<"u"&&this._buildFlare(),s.kernel&&s.kernel!=="pcf"&&this.setShadowKernel(s.kernel),this.setTime(this.hours),this}get skyCube(){return this.skyCubeRT?this.skyCubeRT.texture:null}get fogColor(){return this.fogMode==="scene"?this.fog?this.fog.color:null:this.fogPost?this.fogPost.color:null}setFogMode(e){this.fogMode=e==="post"?"post":"scene",this.fogPost||(this.fogPost=new gs(8425632,0)),this.horizon&&this.fogPost.color.copy(this.horizon),this.scene&&(this.scene.fog=this.fogMode==="scene"?this.fog:this.fogPost)}setShadowKernel(e,t=this.scene){if(!Bn.includes(e))return console.warn(`[Atmosphere] unknown shadow kernel '${e}' ('pcf' | 'fast' | 'pcss')`),0;e!=="pcf"&&!this._fastShadowsOk(e)&&(e="pcf"),this.shadowKernel=e;const s=this.scene;return e!=="pcf"?(this._syncFastShadows(),e==="pcss"&&this._syncPcss(),!this._onChildAdded&&s&&(this._onChildAdded=i=>{const r=this._foreignShadowLight(i.child);if(r===null){Pi(i.child,this.shadowKernel);return}console.warn(`[Atmosphere] ${this.shadowKernel} shadow kernel unavailable (another shadow-casting directional light '${r}' was added), using 'pcf'`),this.setShadowKernel("pcf")},s.addEventListener("childadded",this._onChildAdded))):this._onChildAdded&&(s.removeEventListener("childadded",this._onChildAdded),this._onChildAdded=null),Pi(t,e)}_fastShadowsOk(e="fast"){const t=this.renderer;let s="";if(!t)s="no renderer";else if(!this.sun)s="not built yet";else if(t.shadowMap.type!==Ls)s="it replaces PCFShadowMap only";else if(!(e==="pcss"?xn():wn()))s="three.js shadow chunks changed";else if(e==="pcss"&&2*this.cascadeCount>=(t.capabilities?.maxTextures??16)-Gi)s=`${2*this.cascadeCount} shadow texture units leave ${Gi} or fewer of ${t.capabilities?.maxTextures??16} for materials`;else{const i=this._foreignShadowLight(this.scene);i!==null&&(s=`another shadow-casting directional light '${i}'`)}return s&&console.warn(`[Atmosphere] ${e} shadow kernel unavailable (${s}), using 'pcf'`),!s}_foreignShadowLight(e){let t=null;const s=this.cascadeLights;return e.traverse(i=>{t===null&&i.isDirectionalLight&&i.castShadow&&!s.includes(i)&&(t=i.name||"(unnamed)")}),t}_checkShadowOrder(){let e=null;return this.scene.traverse(t=>{e===null&&t.isDirectionalLight&&t.castShadow&&(e=t)}),e&&e!==this.sun&&console.warn(`[Atmosphere] shadow-casting directional light '${e.name||"(unnamed)"}' precedes the sun in the scene: the shadow cascades will not be used (add it after the Atmosphere or turn its castShadow off)`),e===this.sun}_syncFastShadows(){if(this.renderer.shadowMap.type!==Ls)return;const e=this.cascadeLights;if(!this._fastDepth){const s=this.renderer.state?.buffers?.depth?.getReversed?.()===!0;this._fastDepth=e.map(i=>{const r=_n(s);return r.name=`${i.name}.shadowDepth`,r}),this._fastMaps=e.map(()=>null)}let t=0;for(let s=0;s<e.length;s++){const i=e[s];i.castShadow&&(yn(i,this._fastDepth[s]),this._fastMaps[t++]=this._fastDepth[s])}Qn(this._fastMaps,t)}_syncPcss(){const e=this.shadowOpts,t=this.cascadeLights,s=this._pcss||(this._pcss=t.map(()=>new Be)),i=Math.tan(Math.max(0,e.lightSize)*W),r=e.maxPenumbra*(2*this.sun.userData.half/this.sun.shadow.mapSize.x),o=e.temporalNoise?this._noiseFrame:0;let n=0;for(let A=0;A<t.length;A++){const l=t[A];if(!l.castShadow)continue;const h=l.shadow.camera,c=2*l.userData.half/l.shadow.mapSize.x,d=h.far-h.near;s[n++].set(d*i/c,.5*Math.min(e.maxPenumbra,r/c),8*c/d,o)}Sn(s,n)}shadowCascadeInfo(e={count:0,lights:[],cameras:[],matrices:[],halfSizes:[],maps:[],depthTextures:[],packed:!0}){const t=this.cascadeLights,s=e.lights,i=e.cameras,r=e.matrices,o=e.halfSizes,n=e.maps||(e.maps=[]),A=e.depthTextures;let l=0,h=!1;for(let c=0;c<t.length;c++){const d=t[c],f=d.shadow;if(!d.castShadow)continue;const u=f.map?f.map.texture:null,g=f.map&&f.map.depthTexture?f.map.depthTexture:null;s[l]=d,i[l]=f.camera,r[l]=f.matrix,o[l]=d.userData.half,n[l]=u,A[l]=g||u,g||(h=!0),l++}return s.length=i.length=r.length=o.length=n.length=A.length=l,e.count=l,e.packed=h,e}_cascadeLight(e,t,s,i){const r=new Ci(0,0);return r.name=e,r.castShadow=!0,r.shadow.mapSize.set(t,t),this._setBox(r,s),r.shadow.radius=i,r.shadow.autoUpdate=!1,r.shadow.needsUpdate=!0,r}_midHalfSteps(e,t,s){const i=this.shadowOpts,r=this.cascadeCount,o=[],n=i.mid==null?null:Array.isArray(i.mid)?i.mid:[i.mid],A=2*this.nearHalf/e;for(let l=1;l<r-1;l++){const h=n?n[l-1]:null,c=l===1?null:o[l-2];o.push(this.farHalfSteps.map((d,f)=>{if(h!=null)return Array.isArray(h)?h[Math.min(f,h.length-1)]:h;const u=A*Math.pow(2*d/s/A,l/(r-1)),g=c?c[f]:this.nearHalf,m=c?i.farLead:i.lead,p=Math.max(1.25*g,g*(1-m)/Math.max(.05,1-i.farLead)+2);return Math.round(Math.min(Math.max(u*t/2,p),.8*d)/5)*5}))}return o}_setMidBoxes(e){const t=this.cascadeLights;for(let s=1;s<t.length-1;s++){const i=this.midHalfSteps[s-1],r=i[Math.min(e,i.length-1)];t[s].userData.half!==r&&this._setBox(t[s],r)}}_setBox(e,t){const s=e.shadow.camera;Object.assign(s,{left:-t,right:t,top:t,bottom:-t,near:1,far:2500}),s.updateProjectionMatrix(),e.userData.half=t;const i=2*t/e.shadow.mapSize.x;e.shadow.normalBias=i*1.4,e.shadow.bias=-3e-5}_buildFlare(){const e=dn();this._flareTex=e,this.flare=new St,this.flare.frustumCulled=!1,this.flareEls=this.flareSpec.map(([t,s,i,r,o])=>{const n=new li(typeof t=="string"?e[t]:t,s,i,new T(r[0]*o,r[1]*o,r[2]*o));return n.baseSize=s,n.base=new T(r[0]*o,r[1]*o,r[2]*o),this.flare.addElement(n),n}),this.flareScene=new Ns,this.flareScene.name="flare",this.flareScene.add(this.flare),this.flare.visible=!1}renderFlare(e,t){if(!this.flare||!this.flare.visible)return;const s=e.autoClear;e.autoClear=!1,e.setRenderTarget(null),e.render(this.flareScene,t),e.autoClear=s}setFlareScale(e){this.flareScale=oe(e/1300,.3,3);for(const t of this.flareEls||[])t.size=t.baseSize*this.flareScale}setTimeOfDay(e){const t=typeof e=="number"?e:this.timePresets[e];return Number.isFinite(t)&&this.setTime(t),this}get timeOfDay(){return this.hours}setTime(e){this.hours=(e%24+24)%24;const{el:t,az:s}=Mn(this.hours,this.sunModel);this.sunEl=t;const i=t/W,r=new b(Math.sin(s)*Math.cos(t),Math.sin(t),-Math.cos(s)*Math.cos(t)).normalize();this.sunDir.copy(r),this.darkness=be(6*W,-9*W,t),this.windowGlow=oe(Math.pow(be(14*W,-6*W,t),1.5),.02,1);const o=this.look=Ni(this.looks,i),n=be(-2*W,3*W,t),A=Tn(t);this.sunColor.copy(A.color);const l=this.moonColor;this.lightDir.copy(n>.02?r:this.moonDir),this.sun.color.copy(n>.02?A.color:l),this.sun.intensity=n>.02?this.sunIntensity*n*Math.pow(A.trans,.8)*o.sun:this.moonIntensity;const h=this.moonScatter>0&&!(n>.02);this.moonScatter>0&&(this.scatterDir.copy(h?this.moonDir:r),this.scatterColor.copy(h?l:A.color)),this._farDirty=!0;const c=this.sunColor.clone().multiplyScalar(o.aur*n);for(const B of[this.sky,this.envSky]){const I=B.material.uniforms;I.turbidity.value=o.turb,I.rayleigh.value=o.ray,I.mieCoefficient.value=o.mie,I.mieDirectionalG.value=o.g,I.sunPosition.value.copy(r),I.skyGain.value=this.skyGain,I.uGlowCol.value.copy(c),I.uTwilight.value=o.tw,I.uNight.value=o.night,I.uAfterglow.value=o.glowA,I.uCover.value=o.cover,I.uCirrus.value=o.cirrus,I.uCloudOpacity.value=o.cop,I.uCloudSun.value.setRGB(o.cs[0],o.cs[1],o.cs[2]),I.uCloudAmb.value.setRGB(o.ca[0],o.ca[1],o.ca[2]),I.uMoonDir.value.copy(this.moonDir),I.uHorizonTint.value.setRGB(.8,.93,1.15).lerp(Oi,o.tw)}this.sky.material.uniforms.uStars.value=o.night,this.envSky.material.uniforms.uStars.value=0,this.pmrem&&(this.envRT&&this.envRT.dispose(),this.envRT=this.pmrem.fromScene(this.envScene,0,.1,1e3),this.scene.environment=this.envRT.texture,this.scene.environmentIntensity=o.env);const d=this.envSky.material.uniforms;d.uDisc.value=0,d.uClouds.value=0,this.renderer&&this.cubeCam.update(this.renderer,this.envScene);const f=this.sampleHorizon();d.uDisc.value=1,d.uClouds.value=1,this.horizon=f;const u=(this.renderer&&this.renderer.toneMappingExposure)??1,g=this.renderer&&this.renderer.toneMapping===vo?new T(oe(f.r*u,0,1),oe(f.g*u,0,1),oe(f.b*u,0,1)):Fn(f,u);this.fog.color.copy(g),this.fog.density=this.fogDensity[0]+this.fogDensity[1]*this.darkness,this.fogPost.color.copy(f);const m=this.fogParams;m.haze=o.haze,m.mist=o.mist,m.sunScatter=h?this.moonScatter:.05*n*(1-be(25*W,45*W,t));const p=f.clone().multiplyScalar(1/Math.max(.03,Math.max(f.r,f.g,f.b)));this.hemi.color.copy(p).lerp(new T(.5,.66,1),.5+.3*this.darkness);const C=new T(.42,.37,.31).lerp(this.sunColor,.45*n);this.hemi.groundColor.copy(C).lerp(new T(.55,.36,.2),this.darkness*.8),this.hemi.intensity=o.hemi,this.flareEls&&this.flareEls.forEach((B,I)=>B.color.copy(B.base).multiply(I===0?this.sunColor:Oi)),this.version++}sampleHorizon(){const e=this.renderer,t=new T(.6,.65,.7);if(!e)return t;try{const i=new Y(16,16,{type:$e,depthBuffer:!1}),r=new Ga(60,1,.1,1e3),o=new Float32Array(256*4),n=e.getRenderTarget();let A=0,l=0,h=0,c=0;for(let d=0;d<8;d++){const f=d/8*Math.PI*2;r.position.set(0,0,0),r.lookAt(Math.cos(f),-.02,Math.sin(f)),e.setRenderTarget(i),e.render(this.envScene,r),e.readRenderTargetPixels(i,0,0,16,16,o);for(let u=0;u<256;u++){const g=o[u*4],m=o[u*4+1],p=o[u*4+2];isFinite(g)&&isFinite(m)&&isFinite(p)&&(A+=g,l+=m,h+=p,c++)}}e.setRenderTarget(n),i.dispose(),c&&t.setRGB(A/c,l/c,h/c)}catch(s){console.warn("[World] horizon sampling failed",s)}return t}cloudDensityToward(e,t){if(!this.cloudAtlas||t.y<=.01)return 0;const s=this.sky.material.uniforms,i=Math.max(s.uCloudH.value-e.y,60)/Math.max(t.y,.012),r=s.uCloudScale.value,o=s.uCloudOffset.value,n=(e.x+t.x*i)*r+o.x,A=(e.z+t.z*i)*r+o.y,l=Fi(this.cloudAtlas,n,A)*.65+Fi(this.cloudAtlas,n*2.9+.37,A*2.9+.71)*.35,h=1-s.uCover.value;return be(h,h+.2,l)*s.uCloudOpacity.value*be(0,.05,t.y)}update(e,t){if(!e)return;let s;Number.isFinite(t)?(t=Math.min(.1,Math.max(0,t)),this._clock+=t,s=this._clock*1e3):(s=performance.now(),t=this._lastT?Math.min(.1,(s-this._lastT)/1e3):0,this._lastT=s),this.sky.position.copy(e);const i=this.sky.material.uniforms;i.uTime.value=s/1e3%3600,i.uCloudOffset.value.addScaledVector(this.cloudWind,t*i.uCloudScale.value);let r=0,o=0;if(this.camera){this.camera.getWorldDirection(At);const l=Math.hypot(At.x,At.z);l>.001&&(r=At.x/l,o=At.z/l)}const n=this.shadowOpts,A=this.nearHalf;if(this._fitCascade(this.sun,e.x+r*A*n.lead,e.y,e.z+o*A*n.lead,A),this._frame++,this.sunFar){const l=this.farHalfSteps;let h=l.indexOf(this._farHalf);const c=n.farUp,d=n.farDown;h<l.length-1&&e.y>c[h]?h++:h>0&&e.y<d[h-1]&&h--,l[h]!==this._farHalf&&(this._farHalf=l[h],this._setBox(this.sunFar,this._farHalf),this._setMidBoxes(h),this._farDirty=!0);const f=this.cascadeLights,u=f.length,g=this._frame,m=this._farDirty,p=Math.min(e.y,n.farMaxY),C=n.farLead;let B=e.y,I=this.nearHalf,E=n.lead;for(let v=1;v<u;v++){const x=f[v],_=x.userData.half,y=_*C;let D=p;v<u-1&&(D=Math.max(p,B-Math.max(0,_*(1-C)-I*(1-E))),B=D,I=_,E=C);const q=e.x+r*y,$=e.z+o*y;let w=m||(u===2?(g&1)===0:v===1?(g&1)===1:u===3?(g&1)===0:(g&3)===(v===2?0:2));!w&&u>2&&x.target.position.distanceToSquared(qn.set(q,D,$))>(.3*_)**2&&(w=!0),w&&(this._fitCascade(x,q,D,$,_),x.shadow.needsUpdate=!0)}this._farDirty=!1}this.shadowKernel!=="pcf"&&(this._syncFastShadows(),this.shadowKernel==="pcss"&&(n.temporalNoise&&t>0&&(this._noiseFrame=this._noiseFrame+1&63),this._syncPcss())),this._updateFlare(e)}_fitCascade(e,t,s,i,r){const o=this.lightDir,n=2*r/e.shadow.mapSize.x,A=Un.copy(o).negate(),l=On.crossVectors(A,Math.abs(A.y)>.99?Jn:Vn).normalize(),h=zn.crossVectors(l,A).normalize();let c=t*l.x+s*l.y+i*l.z,d=t*h.x+s*h.y+i*h.z;const f=t*A.x+s*A.y+i*A.z;c=Math.round(c/n)*n,d=Math.round(d/n)*n;const u=Hn.set(0,0,0).addScaledVector(l,c).addScaledVector(h,d).addScaledVector(A,f),g=Math.max(.05,Math.asin(oe(o.y,-1,1))),m=oe(this.maxBuildingHeight/Math.tan(g)+200,400,2200);e.target.position.copy(u),e.position.copy(u).addScaledVector(o,m);const p=e.shadow.camera,C=m+500+r;Math.abs(p.far-C)>50&&(p.far=C,p.updateProjectionMatrix()),e.target.updateMatrixWorld(),e.updateMatrixWorld()}_updateFlare(e){if(!this.flare)return;const t=be(-.8*W,1.5*W,this.sunEl);if(t<=.001){this.flare.visible=!1;return}this.flare.visible=!0,this.flare.position.copy(e).addScaledVector(this.sunDir,5e3),this.flare.updateMatrixWorld();const s=t*(1-.92*this.cloudDensityToward(e,this.sunDir)),i=this.flareEls;for(let r=0;r<i.length;r++){const o=i[r];o.color.copy(o.base).multiplyScalar(s),r===0&&o.color.multiply(this.sunColor)}}dispose(){const e=this.scene;for(const t of[this.sky,this.hemi])t&&e&&e.remove(t);for(const t of this.cascadeLights)e&&e.remove(t,t.target);e&&(e.fog===this.fog||e.fog===this.fogPost)&&(e.fog=null),e&&this._onChildAdded&&(e.removeEventListener("childadded",this._onChildAdded),this._onChildAdded=null),e&&this.envRT&&e.environment===this.envRT.texture&&(e.environment=null);for(const t of[this.sky,this.envSky])t&&t.material.dispose();for(const t of this.cascadeLights)t.dispose();if(this.envRT&&this.envRT.dispose(),this.skyCubeRT&&this.skyCubeRT.dispose(),this.pmrem&&this.pmrem.dispose(),this.cloudAtlas&&this.cloudAtlas.texture.dispose(),this._flareTex)for(const t of Object.values(this._flareTex))t.dispose()}}const Un=new b,On=new b,zn=new b,Hn=new b,At=new b,qn=new b,Vn=new b(0,1,0),Jn=new b(1,0,0),Oi=new T(1,1,1),Zt={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class he{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const jn=new wo(-1,1,1,-1,0,1);class Kn extends ii{constructor(){super(),this.setAttribute("position",new Ii([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new Ii([0,2,0,0,2,0],2))}}const Yn=new Kn;class Ee{constructor(e){this._mesh=new Ct(Yn,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,jn)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Wn extends he{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof ee?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=Fe.clone(e.uniforms),this.material=new ee({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new Ee(this.material)}render(e,t,s){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=s.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class zi extends he{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,s){const i=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let o,n;this.inverse?(o=0,n=1):(o=1,n=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),r.buffers.stencil.setFunc(i.ALWAYS,o,4294967295),r.buffers.stencil.setClear(n),r.buffers.stencil.setLocked(!0),e.setRenderTarget(s),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(i.EQUAL,1,4294967295),r.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),r.buffers.stencil.setLocked(!0)}}class Xn extends he{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class $n{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const s=e.getSize(new L);this._width=s.width,this._height=s.height,t=new Y(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:H}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Wn(Zt),this.copyPass.material.blending=me,this.clock=new xo}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let s=!1;for(let i=0,r=this.passes.length;i<r;i++){const o=this.passes[i];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),o.render(this.renderer,this.writeBuffer,this.readBuffer,e,s),o.needsSwap){if(s){const n=this.renderer.getContext(),A=this.renderer.state.buffers.stencil;A.setFunc(n.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),A.setFunc(n.EQUAL,1,4294967295)}this.swapBuffers()}zi!==void 0&&(o instanceof zi?s=!0:o instanceof Xn&&(s=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new L);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const s=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(s,i),this.renderTarget2.setSize(s,i);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(s,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class Zn extends he{constructor(e,t,s=null,i=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=s,this.clearColor=i,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new T}render(e,t,s){const i=e.autoClear;e.autoClear=!1;let r,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:s),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),e.autoClear=i}}const zt={defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new L},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new z},cameraProjectionMatrixInverse:{value:new z},cameraWorldMatrix:{value:new z},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new b(-1,-1,-1)},sceneBoxMax:{value:new b(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);
			if (depth >= 1.0) {
				discard;
				return;
			}
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function eA(a=5){const e=Math.floor(a)%2===0?Math.floor(a)+1:Math.floor(a),t=tA(e),s=t.length,i=new Uint8Array(s*4);for(let o=0;o<s;++o){const n=t[o],A=2*Math.PI*n/s,l=new b(Math.cos(A),Math.sin(A),0).normalize();i[o*4]=(l.x*.5+.5)*255,i[o*4+1]=(l.y*.5+.5)*255,i[o*4+2]=127,i[o*4+3]=255}const r=new ai(i,e,e);return r.wrapS=st,r.wrapT=st,r.needsUpdate=!0,r}function tA(a){const e=Math.floor(a)%2===0?Math.floor(a)+1:Math.floor(a),t=e*e,s=Array(t).fill(0);let i=Math.floor(e/2),r=e-1;for(let o=1;o<=t;){if(i===-1&&r===e?(r=e-2,i=0):(r===e&&(r=0),i<0&&(i=e-1)),s[i*e+r]!==0){r-=2,i++;continue}else s[i*e+r]=o++;r++,i--}return s}const wt="ENGINE_GBUFFER",Hi="ENGINE_GBUFFER_NOVEL",bt="ENGINE_GBUFFER_ZERO",zs="ENGINE_GBUFFER_PREV",He={enginePrevViewProj:{value:new z},engineUnjitteredProj:{value:new z},engineViewToPrevClip:{value:new z}};function sA(a){He.engineViewToPrevClip.value.multiplyMatrices(He.enginePrevViewProj.value,a.matrixWorld)}const iA=`
#ifdef ENGINE_GBUFFER
	uniform mat4 engineUnjitteredProj;
	uniform mat4 engineViewToPrevClip;
	varying vec4 vEngineClipCur;
	varying vec4 vEngineClipPrev;
	#ifdef ENGINE_GBUFFER_PREV
		uniform mat4 enginePrevModelView;
	#endif
	#if defined( USE_INSTANCING ) && defined( ENGINE_GBUFFER_INSTANCE_PREV )
		attribute mat4 instancePrevMatrix;
	#endif
#endif
`,aA=`
#ifdef ENGINE_GBUFFER
	{
		vec3 engineGbD = vec3( 0.0 );
		#if defined( ENGINE_GBUFFER_PREV ) || ( defined( USE_INSTANCING ) && defined( ENGINE_GBUFFER_INSTANCE_PREV ) )
			vec4 engineGbL = vec4( transformed, 1.0 );
			#ifdef USE_BATCHING
				engineGbL = batchingMatrix * engineGbL;
			#endif
			vec3 engineGbDL = vec3( 0.0 );
			#if defined( USE_INSTANCING ) && defined( ENGINE_GBUFFER_INSTANCE_PREV )
				engineGbDL = ( ( instancePrevMatrix - instanceMatrix ) * engineGbL ).xyz;
			#endif
			#ifdef ENGINE_GBUFFER_PREV
				#ifdef USE_INSTANCING
					engineGbL = instanceMatrix * engineGbL;
				#endif
				engineGbD = mat3( enginePrevModelView ) * engineGbDL + ( ( enginePrevModelView - modelViewMatrix ) * engineGbL ).xyz;
			#else
				engineGbD = mat3( modelViewMatrix ) * engineGbDL;
			#endif
		#endif
		vEngineClipCur = engineUnjitteredProj * mvPosition;
		vEngineClipPrev = engineViewToPrevClip * vec4( mvPosition.xyz + engineGbD, 1.0 );
	}
#endif
`,rA=`
#ifdef ENGINE_GBUFFER
	#ifdef gl_FragColor
		layout( location = 1 ) out highp vec4 engineGbNormal;
		layout( location = 2 ) out highp vec4 engineGbVelocity;
	#endif
	varying highp vec4 vEngineClipCur;
	varying highp vec4 vEngineClipPrev;
	vec3 engineGbN = vec3( 0.0 );
	float engineGbRoughness = 1.0;
	float engineGbMetalness = 0.0;
	float engineGbFlagSum = 0.0;
	vec2 engineOctEncode( vec3 n ) {
		n /= abs( n.x ) + abs( n.y ) + abs( n.z );
		return n.z >= 0.0 ? n.xy : ( 1.0 - abs( n.yx ) ) * vec2( n.x >= 0.0 ? 1.0 : - 1.0, n.y >= 0.0 ? 1.0 : - 1.0 );
	}
#endif
`,sr=`
#if defined( ENGINE_GBUFFER_ZERO ) && ! defined( ENGINE_GBUFFER ) && defined( gl_FragColor ) && ! defined( ENGINE_GBUFFER_ZERO_MAIN )
	#define ENGINE_GBUFFER_ZERO_MAIN
	layout( location = 1 ) out highp vec4 engineGbNormal;
	layout( location = 2 ) out highp vec4 engineGbVelocity;
	void engineGbUserMain();
	void main() {
		engineGbUserMain();
		engineGbNormal = vec4( 0.0 );
		engineGbVelocity = vec4( 0.0 );
	}
	#define main engineGbUserMain
#endif
`,oA=`
#ifdef ENGINE_GBUFFER
	engineGbN = normal;
	engineGbFlagSum += 2.0;
#endif
`,nA=`
#ifdef ENGINE_GBUFFER
	engineGbRoughness = roughnessFactor;
#endif
`,AA=`
#ifdef ENGINE_GBUFFER
	engineGbMetalness = metalnessFactor;
#endif
`,lA=`
#ifdef ENGINE_GBUFFER
	{
		highp vec2 engineGbVel = vec2( 0.0 );
		#ifdef ENGINE_GBUFFER_NOVEL
			engineGbFlagSum += 8.0;
		#else
			if ( vEngineClipPrev.w > 0.0 ) engineGbVel = ( vEngineClipCur.xy / vEngineClipCur.w - vEngineClipPrev.xy / vEngineClipPrev.w ) * 0.5;
			else engineGbFlagSum += 8.0;
		#endif
		vec2 engineGbE = dot( engineGbN, engineGbN ) > 0.0 ? engineOctEncode( normalize( engineGbN ) ) * 0.5 + 0.5 : vec2( 0.5 );
		float engineGbA = floor( clamp( engineGbMetalness, 0.0, 1.0 ) * 15.0 + 0.5 ) * 16.0 + engineGbFlagSum + 1.0;
		engineGbNormal = vec4( engineGbE, clamp( engineGbRoughness, 0.0, 1.0 ), engineGbA / 255.0 );
		engineGbVelocity = vec4( engineGbVel, 0.0, 0.0 );
	}
#endif
`,qi=Object.freeze({clipping_planes_pars_vertex:iA,project_vertex:aA,clipping_planes_pars_fragment:rA+sr.slice(1),normal_fragment_maps:oA,roughnessmap_fragment:nA,metalnessmap_fragment:AA,dithering_fragment:lA}),ls=`
const int ENGINE_GB_WROTE = 1;
const int ENGINE_GB_HAS_NORMAL = 2;
const int ENGINE_GB_NO_HISTORY = 8;
vec3 engineOctDecode( vec2 e ) {
	vec2 f = e * 2.0 - 1.0;
	vec3 n = vec3( f, 1.0 - abs( f.x ) - abs( f.y ) );
	float t = max( - n.z, 0.0 );
	n.x += n.x >= 0.0 ? - t : t;
	n.y += n.y >= 0.0 ? - t : t;
	return normalize( n );
}
int engineGbByte( float a ) { return int( a * 255.0 + 0.5 ); }
float engineGbMetal( float a ) { return float( engineGbByte( a ) >> 4 ) / 15.0; }
int engineGbFlags( float a ) { return engineGbByte( a ) & 15; }
`,Vi=a=>({get elements(){return a.value.elements}}),Ji={engineUnjitteredProj:Vi(He.engineUnjitteredProj),engineViewToPrevClip:Vi(He.engineViewToPrevClip)};let lt=null;function ir(){if(lt!==null)return lt;const a=Mt,e=Us;if(typeof a.project_vertex=="string"&&a.project_vertex.includes("vEngineClipCur"))return lt=!0;const t=["basic","lambert","phong","standard","physical","toon","matcap"],s=[[a.project_vertex,"mvPosition = modelViewMatrix * mvPosition;"],[a.project_vertex,"gl_Position = projectionMatrix * mvPosition;"],[a.normal_fragment_begin,"vec3 normal ="],[a.roughnessmap_fragment,"float roughnessFactor"],[a.metalnessmap_fragment,"float metalnessFactor"],[a.dithering_fragment,"DITHERING"],[a.clipping_planes_pars_vertex,"NUM_CLIPPING_PLANES"],[a.clipping_planes_pars_fragment,"NUM_CLIPPING_PLANES"],[a.normal_fragment_maps,"normal ="]];for(const i of t){const r=e[i]||{};s.push([ji(r.vertexShader,"clipping_planes_pars_vertex")?r.vertexShader:null,"#include <project_vertex>"]),s.push([ji(r.fragmentShader,"clipping_planes_pars_fragment")?cA(r.fragmentShader):null,"dithering_fragment"])}if(!s.every(([i,r])=>typeof i=="string"&&i.includes(r)))return console.warn("[render] G-buffer: three.js shader chunks changed, the G-buffer is unavailable"),lt=!1;for(const i in qi)a[i]=hA(a[i],qi[i]);for(const i in e){const r=e[i];if(!(!r||!r.uniforms||typeof r.vertexShader!="string"||!r.vertexShader.includes("#include <clipping_planes_pars_vertex>")))for(const o in Ji)r.uniforms[o]||(r.uniforms[o]={value:Ji[o]})}return lt=!0}function hA(a,e){return a.endsWith(`
`)?a+e.slice(1):a+e.slice(0,-1)}function ji(a,e){if(typeof a!="string")return!1;const t=a.indexOf(`#include <${e}>`),s=a.search(/void\s+main\s*\(/);return t>=0&&s>t}function cA(a){const e=typeof a=="string"?a.match(/#include <[a-z_]+>/g):null;return e?e[e.length-1]:null}function uA(a,e,{colorType:t=H,colorFormat:s=ie,depthTexture:i}={}){const r=Math.max(1,a|0),o=Math.max(1,e|0),n=new Y(r,o,{count:3,samples:0,type:t,format:s,depthBuffer:!0,stencilBuffer:!1,depthTexture:i||new ri(r,o,Ua),generateMipmaps:!1,minFilter:O,magFilter:O}),[A,l,h]=n.textures;A.name="GBuffer.color",l.name="GBuffer.normal",l.type=N,l.format=ie,h.name="GBuffer.velocity",h.type=H,h.format=ge;for(const c of[l,h])c.colorSpace=Oe,c.minFilter=c.magFilter=Ae;return n}const je=1,ht=2,Ke=3,Ki=4,Yi=0,as=(a,e)=>Object.prototype.hasOwnProperty.call(a,e),ar=a=>!!(a.isMeshStandardMaterial||a.isMeshLambertMaterial||a.isMeshPhongMaterial||a.isMeshToonMaterial||a.isMeshBasicMaterial||a.isMeshMatcapMaterial),fA=a=>!!(ar(a)||a.isMeshNormalMaterial||a.isMeshDepthMaterial||a.isMeshDistanceMaterial||a.isLineBasicMaterial||a.isPointsMaterial||a.isSpriteMaterial),gA=a=>a.isShaderMaterial&&!a.isRawShaderMaterial&&a.glslVersion!==Qo,dA=a=>a.transparent===!0||a.blending!==So&&a.blending!==me,rs=(a,e)=>!!(a.defines&&a.defines[e]!==void 0);function ye(a,e,t){return t===rs(a,e)?!1:(t?(a.defines||(a.defines={}))[e]=1:delete a.defines[e],!0)}function Wi(a,e,t){const s={ownOBC:as(a,"onBeforeCompile"),ownKey:as(a,"customProgramCacheKey"),prev:a.onBeforeCompile,prevKey:a.customProgramCacheKey},i=s.prev,r=s.prevKey;return s.obc=function(o,n){i.call(this,o,n),e(o,n)},s.key=s.ownKey?function(){return`${r.call(this)}|${t}`}:function(){return`${i.toString()}|${t}`},a.onBeforeCompile=s.obc,a.customProgramCacheKey=s.key,s}function Xi(a,e){return a.onBeforeCompile!==e.obc||a.customProgramCacheKey!==e.key?!1:(e.ownOBC?a.onBeforeCompile=e.prev:delete a.onBeforeCompile,e.ownKey?a.customProgramCacheKey=e.prevKey:delete a.customProgramCacheKey,!0)}function Ht(a,e,t,s=!1){const i={o:a,name:e,own:as(a,e),prev:a[e],active:!0},r=i.prev;return i.f=s?function(o,n,A,l,h,c){i.active&&t.call(this,o,n,A,l,h,c),r.call(this,o,n,A,l,h,c)}:function(o,n,A,l,h,c){r.call(this,o,n,A,l,h,c),i.active&&t.call(this,o,n,A,l,h,c)},a[e]=i.f,i}function qt(a){a.active=!1,a.o[a.name]===a.f&&(a.own?a.o[a.name]=a.prev:delete a.o[a.name])}const Vt=new WeakMap,mA=a=>{a.fragmentShader.includes("ENGINE_GBUFFER_ZERO_MAIN")||(a.fragmentShader=sr+a.fragmentShader)},pA=36064,CA=0,IA=[],BA=[];let xt=0;function rr(a,e,t){let s=a[e];if(!s){s=a[e]=[];for(let i=0;i<e;i++)s.push(i===0||t?pA+i:CA)}return s}function $i(a,e){if(rs(e,wt)||rs(e,bt))return;const t=a.getRenderTarget();t===null||!t.textures||t.textures.length<2||(xt=t.textures.length,a.getContext().drawBuffers(rr(IA,xt,!1)))}function EA(a){xt!==0&&(a.getContext().drawBuffers(rr(BA,xt,!0)),xt=0)}function vA(a,e,t,s){s&&s.textures&&s.textures.length>1&&t&&sA(t)}const Ue=[];let Zi=!1;function wA(a,e,t,s,i){if(Ue.length===0)return;const r=this.defines;if(r&&(r[wt]!==void 0||r[bt]!==void 0))return;const o=a.getRenderTarget();if(o!==null){for(let n=0;n<Ue.length;n++)if(Ue[n].target===o){Ue[n]._lazy(this,i,a);return}}}function xA(){if(Zi)return;Zi=!0;const a=yo.prototype,e=a.onBeforeRender;a.onBeforeRender=function(t,s,i,r,o,n){e.call(this,t,s,i,r,o,n),wA.call(this,t,s,i,r,o,n)}}const ea=new Float32Array(4),ys=new L,_A=["onBeforeCompile","customProgramCacheKey","onBeforeRender"];function yA(a,e){const t=a.userData,s=a.isShaderMaterial?a.uniforms:null;a.userData={},s&&(a.uniforms={});let i;try{i=a.clone()}finally{a.userData=t,s&&(a.uniforms=s)}i.userData={...t},s&&(i.uniforms={...s},delete i.uniforms.enginePrevModelView),a.defines&&(i.defines={...a.defines});for(const r of _A){const o=e(r);o!==void 0&&(i[r]=o)}return i.defines&&(delete i.defines[zs],delete i.defines[bt]),i}class QA{constructor(e,{width:t,height:s,color:i,nonWriters:r="zero",autoSync:o=!0}={}){this.renderer=e;const n=!(e&&e.extensions&&e.extensions.has)||e.extensions.has("EXT_color_buffer_float");n||console.warn("[GBuffer] EXT_color_buffer_float is unavailable: the G-buffer target cannot be rendered (supported = false)"),this.supported=n&&ir();let A=t,l=s;!(A>0&&l>0)&&e&&e.getDrawingBufferSize&&(e.getDrawingBufferSize(ys),A=ys.x,l=ys.y);const h=i&&(i.format!==void 0||i.type!==void 0)?{colorFormat:i.format??ie,colorType:i.type??H}:{colorFormat:it,colorType:Ft};this.target=uA(A||1,l||1,h),this.nonWriters=r==="mask"?"mask":"zero",this._stats={materialsDefined:0,materialsZero:0,materialsMasked:0,tracked:0,pools:0},this._statsDirty=!1,this._mats=new Map,this._hooks=new Map,this._scenes=new Map,this._recs=[],this._recOf=new Map,this._owner=new Map,this._pools=[],this._warned=new Set,this._changed=0,this._syncObject=c=>this._syncObj(c),this._unsyncObject=c=>this._unsyncObj(c),this._onMatDispose=c=>this._forget(c.target),this.autoSync=!!o&&this.supported,this.autoSync&&(xA(),Ue.push(this))}get stats(){return this._statsDirty&&this._countStats(),this._stats}get color(){return this.target.textures[0]}get normal(){return this.target.textures[1]}get velocity(){return this.target.textures[2]}get depth(){return this.target.depthTexture}setSize(e,t){this.target.setSize(Math.max(1,e|0),Math.max(1,t|0))}sync(e){if(!e||!this.supported)return 0;if(e.isScene&&!this._scenes.has(e)){const t={onChildAdded:s=>this.sync(s.child),before:Ht(e,"onBeforeRender",vA)};e.addEventListener("childadded",t.onChildAdded),this._scenes.set(e,t),!this.autoSync&&e.background&&e.background.isTexture&&this._warnOnce("background","[GBuffer] scene.background textures are drawn by an internal three.js mesh that sync() cannot see: use autoSync, or draw the sky as a scene object")}return this._changed=0,e.traverse(this._syncObject),this._statsDirty=!0,this._changed}unsync(e){if(!e)return;e.traverse(this._unsyncObject);const t=this._scenes.get(e);t&&(e.removeEventListener("childadded",t.onChildAdded),qt(t.before),this._scenes.delete(e)),this._statsDirty=!0}track(e,{clone:t=!1}={}){if(!e)return 0;const s=[];if(e.traverse(n=>{n.isMesh&&n.material&&!this._recOf.has(n)&&s.push(n)}),!s.length)return 0;let i=e;for(;i.parent;)i=i.parent;const r=new Map,o=new Set;i.traverse(n=>{if(!n.material)return;const A=Array.isArray(n.material)?n.material:[n.material];for(const l of A){if(!l)continue;const h=r.get(l);h===void 0?r.set(l,n):h!==n&&o.add(l)}});for(const n of s)this._trackMesh(n,o,t);return this._statsDirty=!0,s.length}untrack(e){e&&(e.traverse(t=>{const s=this._recOf.get(t);s&&this._untrackRec(s)}),this._statsDirty=!0)}trackPool(e){e&&!this._pools.includes(e)&&this._pools.push(e),this._statsDirty=!0}untrackPool(e){const t=this._pools.indexOf(e);t>=0&&this._pools.splice(t,1),this._statsDirty=!0}endFrame(){const e=this._recs;for(let s=0;s<e.length;s++){const i=e[s];i.drawn&&i.prevWorld.copy(i.mesh.matrixWorld),i.hasPrev=i.drawn,i.drawn=!1}const t=this._pools;for(let s=0;s<t.length;s++)t[s].capturePrev()}clear(e=this.renderer){const t=e.getRenderTarget(),s=e.getActiveCubeFace(),i=e.getActiveMipmapLevel();t!==this.target&&e.setRenderTarget(this.target);const r=e.getContext();e.state.buffers.color.setMask(!0),r.clearBufferfv(r.COLOR,1,ea),r.clearBufferfv(r.COLOR,2,ea),t!==this.target&&e.setRenderTarget(t,s,i)}dispose(){for(const t of[...this._scenes.keys()])this.unsync(t);for(const t of[...this._hooks.keys()])this._unhook(t);for(const[t,s]of this._mats)this._revert(t,s)&&(t.needsUpdate=!0),t.removeEventListener("dispose",this._onMatDispose);for(this._mats.clear();this._recs.length;)this._untrackRec(this._recs[this._recs.length-1]);this._pools.length=0,this._statsDirty=!0;const e=Ue.indexOf(this);e>=0&&Ue.splice(e,1),this.target.dispose()}_syncObj(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;const t=e.material;let s=!1;if(Array.isArray(t))for(let i=0;i<t.length;i++)t[i]&&this._syncMaterial(t[i])===Ke&&(s=!0);else t&&this._syncMaterial(t)===Ke&&(s=!0);s?this._hook(e):this._unhook(e)}_unsyncObj(e){this._unhook(e);const t=e.material;if(!t)return;const s=Array.isArray(t)?t:[t];for(const i of s){const r=i&&this._mats.get(i);r&&(this._revert(i,r)&&(i.needsUpdate=!0),i.removeEventListener("dispose",this._onMatDispose),this._mats.delete(i))}}_kind(e){if(e.visible===!1)return Yi;const t=gA(e)||!e.isShaderMaterial&&fA(e);if(e.colorWrite===!1)return t?ht:Ke;const s=e.userData?e.userData.gbuffer:void 0,i=!dA(e);if(e.isShaderMaterial){if(s===!0||s==="novel"){if(i&&!e.isRawShaderMaterial)return je;this._warnOnce(`optin:${e.uuid}`,`[GBuffer] ShaderMaterial '${e.name||e.uuid}' has userData.gbuffer = ${s} but is ${e.isRawShaderMaterial?"a RawShaderMaterial":"blended"}: it does not write the G-buffer`)}const r=this._mats.get(e);if(s===void 0&&rs(e,wt)&&!(r&&r.own))return Ki}else if(i&&s!==!1&&ar(e))return je;return this.nonWriters==="zero"&&e.blending!==_o&&t?ht:Ke}_syncMaterial(e){const t=this._kind(e),s=t===je&&e.userData.gbuffer==="novel";let i=this._mats.get(e),r=!1;if(i===void 0?(i={kind:t,novel:s,own:!1,chain:null},this._mats.set(e,i),e.addEventListener("dispose",this._onMatDispose),this._statsDirty=!0):(i.kind!==t||i.novel!==s)&&(r=this._revert(e,i),i.kind=t,i.novel=s,i.own=!1,i.chain=null,this._statsDirty=!0),t===je){if(r=ye(e,wt,!0)||r,r=ye(e,Hi,s)||r,i.own=!0,e.isShaderMaterial)for(const o of["engineUnjitteredProj","engineViewToPrevClip"])e.uniforms[o]||(e.uniforms[o]=He[o])}else t===ht&&(r=ye(e,bt,!0)||r,e.isShaderMaterial&&!Vt.has(e)&&(i.chain=Wi(e,mA,"engine-gbzero"),Vt.set(e,i.chain)));return r&&(e.needsUpdate=!0,this._changed++),t}_lazy(e,t,s){let i=this._mats.get(e);(i===void 0||i.kind===Yi)&&(this._syncMaterial(e),i=this._mats.get(e)),i.kind===Ke&&t&&!this._hooks.has(t)&&(this._hook(t),$i(s,e))}_revert(e,t){let s=!1;return t.kind===je&&t.own&&(s=ye(e,wt,!1)||s,s=ye(e,Hi,!1)||s),t.kind===ht&&(s=ye(e,bt,!1)||s,t.chain&&(Xi(e,t.chain),Vt.delete(e))),s}_forget(e){e.removeEventListener("dispose",this._onMatDispose),this._mats.delete(e),this._statsDirty=!0}_hook(e){this._hooks.has(e)||this._hooks.set(e,{before:Ht(e,"onBeforeRender",function(t,s,i,r,o){$i(t,o)}),after:Ht(e,"onAfterRender",function(t){EA(t)},!0)})}_unhook(e){const t=this._hooks.get(e);t&&(qt(t.before),qt(t.after),this._hooks.delete(e))}_trackMesh(e,t,s){const i={mesh:e,prevWorld:new z().copy(e.matrixWorld),u:{value:new z},hasPrev:!1,drawn:!1,mats:[]},r=Array.isArray(e.material)?e.material:[e.material],o=[],n=new Map;let A=!1;for(const l of r){if(!l){o.push(l);continue}let h=n.get(l);h===void 0&&(h=l,(s||t.has(l)||this._owner.has(l))&&(s||this._warnOnce("shared",`[GBuffer] track(): material '${l.name||l.type}' is shared; cloned for per-object velocity (warned once)`),h=yA(l,c=>this._unwound(l,c)),this._mats.has(l)&&this._syncMaterial(h)),this._patchTracked(h,i),n.set(l,h)),h!==l&&(A=!0),o.push(h)}A&&(e.material=Array.isArray(e.material)?o:o[0]),this._recOf.set(e,i),this._recs.push(i)}_unwound(e,t){const s=[],i=this._owner.get(e);if(i)for(const A of i.mats)A.m===e&&(A.compile&&s.push(A.compile),s.push(A.render));const r=Vt.get(e);r&&s.push(r);let o=as(e,t),n=e[t];for(let A=0;o&&A<=s.length;A++){let l=!1;for(const h of s){if(t==="onBeforeCompile"&&h.obc===n){o=h.ownOBC,n=h.prev,l=!0;break}if(t==="customProgramCacheKey"&&h.key===n){o=h.ownKey,n=h.prevKey,l=!0;break}if(t==="onBeforeRender"&&h.f===n){o=h.own,n=h.prev,l=!0;break}}if(!l)break}return o?n:void 0}_patchTracked(e,t){const s={m:e,compile:null,render:null};e.isShaderMaterial?e.uniforms.enginePrevModelView=t.u:s.compile=Wi(e,i=>{i.uniforms.enginePrevModelView=t.u},"engine-gbprev"),s.render=Ht(e,"onBeforeRender",function(i,r,o,n,A){A===t.mesh?(t.u.value.multiplyMatrices(o.matrixWorldInverse,t.hasPrev?t.prevWorld:A.matrixWorld),t.drawn=!0):t.u.value.multiplyMatrices(o.matrixWorldInverse,A.matrixWorld)}),ye(e,zs,!0),e.needsUpdate=!0,this._owner.set(e,t),t.mats.push(s)}_untrackRec(e){for(const s of e.mats){const i=s.m;s.compile?Xi(i,s.compile):i.uniforms&&i.uniforms.enginePrevModelView===e.u&&delete i.uniforms.enginePrevModelView,qt(s.render),ye(i,zs,!1)&&(i.needsUpdate=!0),this._owner.get(i)===e&&this._owner.delete(i)}e.mats.length=0,this._recOf.delete(e.mesh);const t=this._recs.indexOf(e);t>=0&&(this._recs[t]=this._recs[this._recs.length-1],this._recs.pop())}_countStats(){let e=0,t=0,s=0;for(const r of this._mats.values())r.kind===je||r.kind===Ki?e++:r.kind===ht?t++:r.kind===Ke&&s++;const i=this._stats;i.materialsDefined=e,i.materialsZero=t,i.materialsMasked=s,i.tracked=this._recs.length,i.pools=this._pools.length,this._statsDirty=!1}_warnOnce(e,t){this._warned.has(e)||(this._warned.add(e),console.warn(t))}}const Hs=["depth","gbuffer"],SA=6e4,Qs={uniforms:{tAO:{value:null},uTexel:{value:new L},uDir:{value:new L(1,0)}},vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    uniform sampler2D tAO;
    uniform vec2 uTexel;
    uniform vec2 uDir;
    varying vec2 vUv;
    void main() {
      vec2 c = texture2D( tAO, vUv ).rg;
      float z = c.g;
      float tol = 0.06 * z + 0.15; // depth tolerance grows with distance
      float sum = c.r * 0.38, wsum = 0.38;
      for ( int i = 1; i <= 2; i ++ ) {
        float w0 = i == 1 ? 0.24 : 0.07;
        vec2 o = uDir * uTexel * float( i );
        vec2 a = texture2D( tAO, vUv + o ).rg;
        vec2 b = texture2D( tAO, vUv - o ).rg;
        float wa = w0 * clamp( 1.0 - abs( a.g - z ) / tol, 0.0, 1.0 );
        float wb = w0 * clamp( 1.0 - abs( b.g - z ) / tol, 0.0, 1.0 );
        sum += a.r * wa + b.r * wb; wsum += wa + wb;
      }
      gl_FragColor = vec4( sum / wsum, z, 0.0, 1.0 );
    }`};class bA extends he{constructor(e,t={}){super(),this.needsSwap=!1,this.camera=e,this.scale=t.resolutionScale??.5,this.maxPixels=t.maxPixels??1/0,this.upsample=t.upsample??"linear",this.fadeNear=t.fadeNear??140,this.fadeFar=t.fadeFar??320,this._compact=!!t.compact,this._size=new L(1,1);const s={type:H,format:this._compact?ge:ie,depthBuffer:!1,minFilter:O,magFilter:O};this.rtA=new Y(1,1,s),this.rtB=new Y(1,1,s),this.rtA.texture.name="AO.a",this.rtB.texture.name="AO.b",this.rtA.texture.generateMipmaps=this.rtB.texture.generateMipmaps=!1;let i=zt.fragmentShader;i=i.replace("float radiusToUse = radius;","float radiusToUse = min( radius, -viewPos.z * 0.35 );"),i=i.replace("vec3 viewNormal = getViewNormal(vUv);",`if ( -viewPos.z > AO_FADE_FAR ) { gl_FragColor = vec4( 1.0, -viewPos.z, 0.0, 1.0 ); return; }
			vec3 viewNormal = getViewNormal(vUv);`),i.includes("AO_FADE_FAR ) {")||console.warn("[render] GTAO early-out patch point missing"),this._fragDepth=i,this._fragGBuffer=MA(i),this._normals=ta(t.normals??"depth"),this._gbuffer=null,this._gbOn=!1,this._warnedNoGBuffer=!1,this.material=new ee({name:"PostFXGTAO",defines:{...zt.defines,PERSPECTIVE_CAMERA:1,SAMPLES:t.samples??12,NORMAL_VECTOR_TYPE:0,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCENE_CLIP_BOX:0,AO_FADE_NEAR:this.fadeNear.toFixed(1),AO_FADE_FAR:this.fadeFar.toFixed(1),FRAGMENT_OUTPUT:"vec4( mix( ao, 1.0, smoothstep( AO_FADE_NEAR, AO_FADE_FAR, -viewPos.z ) ), -viewPos.z, 0.0, 1.0 )"},uniforms:Fe.clone(zt.uniforms),vertexShader:zt.vertexShader,fragmentShader:i,blending:me,depthTest:!1,depthWrite:!1});const r=this.material.uniforms;r.tNoise.value=eA(),r.radius.value=t.radius??1.8,r.thickness.value=t.thickness??1.6,r.distanceExponent.value=t.distanceExponent??1.6,r.distanceFallOff.value=1,r.scale.value=t.power??1,r.cameraNear.value=e.near,r.cameraFar.value=e.far,this.blur=new ee({name:"PostFXAOBlur",uniforms:Fe.clone(Qs.uniforms),vertexShader:Qs.vertexShader,fragmentShader:Qs.fragmentShader,blending:me,depthTest:!1,depthWrite:!1}),this._quad=new Ee(null),this._clear=new T,this._syncNormals()}get aoTexture(){return this.rtA.texture}get normals(){return this._normals}set normals(e){this._normals=ta(e),this._syncNormals()}get gbuffer(){return this._gbuffer}set gbuffer(e){this._gbuffer=e??null,this._syncNormals()}setSize(e,t){this._size.set(e,t);let s=Math.max(1,Math.round(e*this.scale)),i=Math.max(1,Math.round(t*this.scale));if(s*i>this.maxPixels){const r=Math.sqrt(this.maxPixels/(e*t));s=Math.max(1,Math.floor(e*r)),i=Math.max(1,Math.floor(t*r))}this.rtA.setSize(s,i),this.rtB.setSize(s,i),this.material.uniforms.resolution.value.set(s,i),this.blur.uniforms.uTexel.value.set(1/s,1/i)}setResolution(e=this.scale,t=this.maxPixels){this.scale=e,this.maxPixels=t??1/0,this.setSize(this._size.x,this._size.y)}get compact(){return this._compact}set compact(e){if(!!e!==this._compact){this._compact=!!e;for(const t of[this.rtA,this.rtB])t.texture.format=this._compact?ge:ie,t.dispose()}}render(e,t,s){const i=s.depthTexture;if(!i)return;const r=this.camera,o=this.material.uniforms;this._gbOn?o.tNormal.value=this._gbuffer.normal:this._normals==="gbuffer"&&this._gbuffer===null&&!this._warnedNoGBuffer&&(this._warnedNoGBuffer=!0,console.warn("[AOPass] normals 'gbuffer' without a G-buffer (aoPass.gbuffer is null): normals reconstructed from depth")),o.tDepth.value=i,o.cameraNear.value!==r.near&&(o.cameraNear.value=r.near),o.cameraFar.value!==r.far&&(o.cameraFar.value=r.far),o.cameraProjectionMatrix.value.copy(r.projectionMatrix),o.cameraProjectionMatrixInverse.value.copy(r.projectionMatrixInverse),o.cameraWorldMatrix.value.copy(r.matrixWorld),e.getClearColor(this._clear);const n=e.getClearAlpha(),A=e.autoClear;e.autoClear=!1,e.setRenderTarget(this.rtA),e.setClearColor(DA,1),e.clear(!0,!1,!1),this._quad.material=this.material,this._quad.render(e);const l=this.blur.uniforms,h=this._compact;this._quad.material=this.blur,l.tAO.value=this.rtA.texture,l.uDir.value.set(1,0),e.setRenderTarget(this.rtB),h&&e.clear(!0,!1,!1),this._quad.render(e),l.tAO.value=this.rtB.texture,l.uDir.value.set(0,1),e.setRenderTarget(this.rtA),h&&e.clear(!0,!1,!1),this._quad.render(e),e.setClearColor(this._clear,n),e.autoClear=A}dispose(){this.rtA.dispose(),this.rtB.dispose(),this.material.dispose(),this.blur.dispose(),this._quad.dispose(),this.material.uniforms.tNoise.value.dispose()}_syncNormals(){const e=this._normals==="gbuffer"&&this._gbuffer!==null&&this._fragGBuffer!==null;if(e===this._gbOn)return;this._gbOn=e;const t=this.material;t.fragmentShader=e?this._fragGBuffer:this._fragDepth,e?t.defines.AO_GBUFFER_NORMAL=1:(delete t.defines.AO_GBUFFER_NORMAL,t.uniforms.tNormal.value=null),t.needsUpdate=!0}}const DA=new T(1,SA,0);function ta(a){if(!Hs.includes(a))throw new Error(`[AOPass] normals: unknown value '${a}' ('depth' | 'gbuffer')`);return a}function MA(a){const e="vec3 getViewNormal(const vec2 uv) {",t="#if NORMAL_VECTOR_TYPE == 2",s=a.indexOf(e),i=s<0?-1:a.indexOf(t,s);return i<0?(console.warn("[render] GTAO getViewNormal patch point missing: AO normals 'gbuffer' unavailable"),null):a.slice(0,s)+ls+`
		`+a.slice(s,i)+`#ifdef AO_GBUFFER_NORMAL
				// the scene pass's view-space normal (normal maps included): the nearest full-resolution texel under
				// this AO pixel, where a lit material wrote one; reconstructed from depth elsewhere
				vec4 gbN = textureLod(tNormal, uv, 0.);
				if ((engineGbFlags(gbN.a) & ENGINE_GB_HAS_NORMAL) != 0) return engineOctDecode(gbN.rg);
				return computeNormalFromDepth(uv);
			#elif NORMAL_VECTOR_TYPE == 2`+a.slice(i+t.length)}const FA={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new T(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class Me extends he{constructor(e,t=1,s,i){super(),this.strength=t,this.radius=s,this.threshold=i,this.resolution=e!==void 0?new L(e.x,e.y):new L(256,256),this.clearColor=new T(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new Y(r,o,{type:H}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){const c=new Y(r,o,{type:H});c.texture.name="UnrealBloomPass.h"+h,c.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(c);const d=new Y(r,o,{type:H});d.texture.name="UnrealBloomPass.v"+h,d.texture.generateMipmaps=!1,this.renderTargetsVertical.push(d),r=Math.round(r/2),o=Math.round(o/2)}const n=FA;this.highPassUniforms=Fe.clone(n.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new ee({uniforms:this.highPassUniforms,vertexShader:n.vertexShader,fragmentShader:n.fragmentShader}),this.separableBlurMaterials=[];const A=[3,5,7,9,11];r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(A[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new L(1/r,1/o),r=Math.round(r/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const l=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=l,this.bloomTintColors=[new b(1,1,1),new b(1,1,1),new b(1,1,1),new b(1,1,1),new b(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=Fe.clone(Zt.uniforms),this.blendMaterial=new ee({uniforms:this.copyUniforms,vertexShader:Zt.vertexShader,fragmentShader:Zt.fragmentShader,blending:Na,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new T,this._oldClearAlpha=1,this._basic=new La,this._fsQuad=new Ee(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let s=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(s,i);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(s,i),this.renderTargetsVertical[r].setSize(s,i),this.separableBlurMaterials[r].uniforms.invSize.value=new L(1/s,1/i),s=Math.round(s/2),i=Math.round(i/2)}render(e,t,s,i,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=s.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=s.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let n=this.renderTargetBright;for(let A=0;A<this.nMips;A++)this._fsQuad.material=this.separableBlurMaterials[A],this.separableBlurMaterials[A].uniforms.colorTexture.value=n.texture,this.separableBlurMaterials[A].uniforms.direction.value=Me.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[A]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[A].uniforms.colorTexture.value=this.renderTargetsHorizontal[A].texture,this.separableBlurMaterials[A].uniforms.direction.value=Me.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[A]),e.clear(),this._fsQuad.render(e),n=this.renderTargetsVertical[A];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(s),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){const t=[];for(let s=0;s<e;s++)t.push(.39894*Math.exp(-.5*s*s/(e*e))/e);return new ee({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new L(.5,.5)},direction:{value:new L(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}_getCompositeMaterial(e){return new ee({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}Me.BlurDirectionX=new L(1,0);Me.BlurDirectionY=new L(0,1);const Ss={uniforms:{tDiffuse:{value:null},uTexel:{value:new L},uThreshold:{value:2},uKnee:{value:.8},uMax:{value:40}},vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uThreshold, uKnee, uMax;
    varying vec2 vUv;
    vec3 tap( vec2 o ) { return min( texture2D( tDiffuse, vUv + o * uTexel ).rgb, vec3( uMax ) ); }
    void main() {
      vec3 c = 0.25 * ( tap( vec2( -1.0, -1.0 ) ) + tap( vec2( 1.0, -1.0 ) ) + tap( vec2( -1.0, 1.0 ) ) + tap( vec2( 1.0, 1.0 ) ) );
      float l = max( c.r, max( c.g, c.b ) );
      float s = clamp( l - uThreshold + uKnee, 0.0, 2.0 * uKnee );
      s = s * s / ( 4.0 * uKnee + 1e-4 );
      float k = max( s, l - uThreshold ) / max( l, 1e-4 );
      gl_FragColor = vec4( c * k, 1.0 );
    }`};class RA extends Me{constructor({strength:e=.4,radius:t=.5,threshold:s=2,resolutionScale:i=.5}={}){super(new L(256,256),e,t,s),this.resScale=i,this.knee=.8,this.maxBrightness=14,this.materialHighPassFilter.dispose(),this.materialHighPassFilter=new ee({name:"PostFXBloomBright",uniforms:Fe.clone(Ss.uniforms),vertexShader:Ss.vertexShader,fragmentShader:Ss.fragmentShader,depthTest:!1,depthWrite:!1}),this.bloomFactors=[1,.85,.65,.45,.3],this.compositeMaterial.uniforms.bloomFactors.value=this.bloomFactors}get bloomTexture(){return this.renderTargetsHorizontal[0].texture}setSize(e,t){super.setSize(Math.max(2,e*this.resScale),Math.max(2,t*this.resScale));const s=2/this.resScale;this.materialHighPassFilter.uniforms.uTexel.value.set(s/4/e,s/4/t)}render(e,t,s){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const i=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0);const r=this.materialHighPassFilter.uniforms;r.tDiffuse.value=s.texture,r.uThreshold.value=this.threshold,r.uKnee.value=Math.max(.05,this.knee),r.uMax.value=this.maxBrightness,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),this._fsQuad.render(e);let o=this.renderTargetBright;for(let A=0;A<this.nMips;A++){const l=this.separableBlurMaterials[A];this._fsQuad.material=l,l.uniforms.colorTexture.value=o.texture,l.uniforms.direction.value=Me.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[A]),this._fsQuad.render(e),l.uniforms.colorTexture.value=this.renderTargetsHorizontal[A].texture,l.uniforms.direction.value=Me.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[A]),this._fsQuad.render(e),o=this.renderTargetsVertical[A]}const n=this.compositeMaterial.uniforms;this._fsQuad.material=this.compositeMaterial,n.bloomStrength.value=this.strength,n.bloomRadius.value=this.radius,n.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),this._fsQuad.render(e),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=i}}const sa="varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }";class TA extends he{constructor(){super(),this.needsSwap=!1,this.speed=1.6,this.lumRT=new Y(64,64,{type:H,depthBuffer:!1,minFilter:at,magFilter:O,generateMipmaps:!0}),this.lumRT.texture.name="Exposure.lum";const e={type:H,depthBuffer:!1,minFilter:Ae,magFilter:Ae};this.rtA=new Y(1,1,e),this.rtB=new Y(1,1,e),this.lumMat=new ee({name:"PostFXLum",uniforms:{tColor:{value:null}},vertexShader:sa,fragmentShader:`
        uniform sampler2D tColor; varying vec2 vUv;
        void main() {
          vec2 o = vec2( 0.25 / 64.0 );
          vec3 c = 0.25 * ( texture2D( tColor, vUv + o ).rgb + texture2D( tColor, vUv - o ).rgb + texture2D( tColor, vUv + vec2( o.x, -o.y ) ).rgb + texture2D( tColor, vUv - vec2( o.x, -o.y ) ).rgb );
          float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
          vec2 d = ( vUv - 0.5 ) * vec2( 1.0, 1.25 );
          float w = 1.0 - 0.7 * smoothstep( 0.1, 0.7, length( d ) ); // centre-weighted metering
          gl_FragColor = vec4( log2( clamp( l, 1e-4, 32.0 ) ) * w, w, 0.0, 1.0 );
        }`,depthTest:!1,depthWrite:!1,blending:me}),this.adaptMat=new ee({name:"PostFXAdapt",uniforms:{tLum:{value:null},tPrev:{value:null},uRate:{value:1}},vertexShader:sa,fragmentShader:`
        uniform sampler2D tLum, tPrev; uniform float uRate; varying vec2 vUv;
        void main() {
          vec2 s = textureLod( tLum, vec2( 0.5 ), 6.0 ).rg;
          float cur = s.r / max( s.g, 1e-4 );
          float prev = texture2D( tPrev, vec2( 0.5 ) ).r;
          gl_FragColor = vec4( mix( prev, cur, uRate ), 0.0, 0.0, 1.0 ); // adapted log2 luminance
        }`,depthTest:!1,depthWrite:!1,blending:me}),this._quad=new Ee(null),this._snap=!0}get texture(){return this.rtA.texture}reset(){this._snap=!0}render(e,t,s,i){this.lumMat.uniforms.tColor.value=s.texture,this._quad.material=this.lumMat,e.setRenderTarget(this.lumRT),this._quad.render(e);const r=this.rtA;this.rtA=this.rtB,this.rtB=r;const o=this.adaptMat.uniforms;o.tLum.value=this.lumRT.texture,o.tPrev.value=this.rtB.texture;const n=Math.min(.25,Math.max(0,i||0));o.uRate.value=this._snap?1:1-Math.exp(-n*this.speed),this._snap=!1,this._quad.material=this.adaptMat,e.setRenderTarget(this.rtA),this._quad.render(e)}dispose(){this.lumRT.dispose(),this.rtA.dispose(),this.rtB.dispose(),this.lumMat.dispose(),this.adaptMat.dispose(),this._quad.dispose()}}const ui=Object.freeze({scale:.5,maxPixels:1/0,steps:24,refine:4,maxDistance:80,thickness:.4,thicknessScale:0,maxRoughness:.5,edgeFade:.1,jitter:!1,metalTint:!0,source:"current"}),or=Object.freeze(["current"]),nr="vec3 engineSsrComposite( vec3 col, vec4 ssr ) { return col * ( 1.0 - ssr.a ) + ssr.rgb; }",ia={vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    uniform sampler2D tColor; // this frame's HDR scene colour (linear filtering)
    uniform highp sampler2D tDepth; // its depth, standard 0..1
    uniform sampler2D tNormal; // G-buffer normal + roughness + metalness / flags (nearest)
    uniform mat4 uProj; // the camera's projection (jittered under TAA, as the depth) and its inverse
    uniform mat4 uProjInv;
    uniform vec2 uRes; // full-resolution size (px) of the three textures
    uniform float uNear, uFar;
    uniform float uMaxDistance, uThickness, uThicknessScale, uMaxRoughness, uEdgeFade;
    uniform int uFrame;
    varying vec2 vUv;

    ${ls}

    float linearDepth( float d ) { return uNear * uFar / ( uFar - ( uFar - uNear ) * d ); } // standard (not reversed) depth
    // depth at a march position in full-resolution pixels (nearest texel; positions stay inside [0.5, uRes - 0.5])
    float depthAt( vec2 px ) { return texelFetch( tDepth, ivec2( px ), 0 ).x; }
    // depth behind a surface at linear depth z that still counts as that surface (m)
    float band( float z ) { return uThickness + z * uThicknessScale; }

    // three's DFGApprox (Karis' analytic fit of the split-sum env BRDF): specular = F0 * A + f90 * B
    vec2 envBRDF( float NdotV, float roughness ) {
      const vec4 c0 = vec4( - 1.0, - 0.0275, - 0.572, 0.022 );
      const vec4 c1 = vec4( 1.0, 0.0425, 1.04, - 0.04 );
      vec4 r = roughness * c0 + c1;
      float a004 = min( r.x * r.x, exp2( - 9.28 * NdotV ) ) * r.x + r.y;
      return vec2( - 1.04, 1.04 ) * a004 + r.zw;
    }

    void main() {
      gl_FragColor = vec4( 0.0 ); // every early return is "no reflection": the forward colour stays
      ivec2 ip = min( ivec2( vUv * uRes ), ivec2( uRes ) - 1 ); // the full-resolution texel under this pixel
      vec4 gb = texelFetch( tNormal, ip, 0 );
      int flags = engineGbFlags( gb.a );
      float rough = gb.b;
      if ( ( flags & ENGINE_GB_WROTE ) == 0 || ( flags & ENGINE_GB_HAS_NORMAL ) == 0 || rough >= uMaxRoughness ) return;
      float d = texelFetch( tDepth, ip, 0 ).x;
      if ( d >= 1.0 ) return;

      // view-space surface point, view vector, normal, mirror direction
      vec2 uv = ( vec2( ip ) + 0.5 ) / uRes;
      vec4 hp = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      vec3 P = hp.xyz / hp.w;
      vec3 V = - normalize( P );
      vec3 N = engineOctDecode( gb.rg );
      float NdotV = dot( N, V );
      vec3 R = reflect( - V, N );

      // weight before tracing: specular share * roughness fade * toward-camera fade
      float metal = engineGbMetal( gb.a );
      vec2 fab = envBRDF( clamp( NdotV, 0.0, 1.0 ), rough );
      float fr = clamp( ( uMaxRoughness - rough ) / 0.2, 0.0, 1.0 );
      float w = clamp( mix( 0.04, 1.0, metal ) * fab.x + fab.y, 0.0, 1.0 ) * fr * fr * ( 3.0 - 2.0 * fr )
              * ( 1.0 - smoothstep( 0.0, 0.25, R.z ) );
      if ( NdotV <= 0.0 || w <= 0.0 ) return;

      // the ray in screen space: both ends projected once; screen position and 1 / w are affine along the segment
      float len = R.z > 0.0 ? min( uMaxDistance, ( - uNear - P.z ) / R.z ) : uMaxDistance; // stop at the near plane
      vec4 H0 = uProj * vec4( P, 1.0 ), H1 = uProj * vec4( P + R * len, 1.0 );
      float k0 = 1.0 / H0.w, k1 = 1.0 / H1.w; // 1 / linear depth at both ends
      vec2 S0 = ( H0.xy * k0 * 0.5 + 0.5 ) * uRes, S1 = ( H1.xy * k1 * 0.5 + 0.5 ) * uRes; // full-resolution pixels
      vec2 dS = S1 - S0;
      // march span in the segment parameter u (u = 1 at the ray end): from two pixels past the origin to where the
      // segment leaves the screen (the centres of the border texels)
      vec2 lim = mix( vec2( 0.5 ), uRes - 0.5, step( 0.0, dS ) );
      vec2 te = vec2( abs( dS.x ) > 1e-4 ? ( lim.x - S0.x ) / dS.x : 1.0, abs( dS.y ) > 1e-4 ? ( lim.y - S0.y ) / dS.y : 1.0 );
      float uEnd = min( 1.0, min( te.x, te.y ) );
      float u0 = 2.0 / max( length( dS ), 1e-4 ); // two pixels past the origin (see the header)
      if ( uEnd <= u0 ) return; // the ray stays near the origin's pixel or leaves the screen at once
      float zPrev = 1.0 / mix( k0, k1, u0 ); // linear depth of the ray at the march start
      float zStart = linearDepth( depthAt( mix( S0, S1, u0 ) ) );
      if ( zPrev > zStart && zPrev < zStart + band( zStart ) ) return; // starts inside a surface (normal-mapped self-hit)

    #ifdef SSR_JITTER
      // interleaved-gradient noise (Jimenez), a new pattern each frame (needs a temporal filter: see Limitations)
      float o = fract( 52.9829189 * fract( dot( gl_FragCoord.xy + 5.588238 * float( uFrame & 63 ), vec2( 0.06711056, 0.00583715 ) ) ) );
    #else
      float o = 0.5;
    #endif
      float du = ( uEnd - u0 ) / float( SSR_STEPS );
      float uPrev = u0, uHit = - 1.0, zHit = 0.0;
      for ( int i = 0; i < SSR_STEPS; i ++ ) {
        float u = u0 + ( float( i ) + o ) * du;
        float zRay = 1.0 / mix( k0, k1, u );
        float sd = depthAt( mix( S0, S1, u ) );
        float zScene = linearDepth( sd );
        // hit: the ray is behind the surface here and its depth span since the previous sample reaches into
        // [scene, scene + band] (crossing in one stride counts; coming out from behind or passing in front does not)
        if ( sd < 1.0 && zRay > zScene && min( zRay, zPrev ) < zScene + band( zScene ) ) { uHit = u; zHit = zScene; break; }
        uPrev = u; zPrev = zRay;
      }
      if ( uHit < 0.0 ) return; // miss: left the screen, reached maxDistance / the near plane, or only sky

      // bisection between the last miss and the hit. A midpoint behind its surface is the new hit end when it lies
      // inside that surface's band, or when that surface is not nearer than the hit end's by more than a band (the
      // same thick surface the stride crossed, or one the march stepped over before it); behind a nearer surface by
      // more than the band (an occluder the ray passed behind on its way to the hit) or in front: the new miss end
      float a = uPrev, b = uHit;
      for ( int i = 0; i < SSR_REFINE; i ++ ) {
        float m = 0.5 * ( a + b );
        float zs = linearDepth( depthAt( mix( S0, S1, m ) ) ), zr = 1.0 / mix( k0, k1, m );
        if ( zr > zs && ( zr < zs + band( zs ) || zs > zHit - band( zHit ) ) ) { b = m; zHit = zs; } else a = m;
      }

      vec2 hitUv = mix( S0, S1, b ) / uRes;
      float dist = len * b * k1 / mix( k0, k1, b ); // metres along the ray (t / w is affine in screen space too)
      vec2 e = min( hitUv, 1.0 - hitUv );
      w *= smoothstep( 0.0, uEdgeFade, min( e.x, e.y ) ) * ( 1.0 - smoothstep( 0.7, 1.0, dist / uMaxDistance ) );

      vec3 c = textureLod( tColor, hitUv, 0.0 ).rgb; // bilinear; explicit LOD (non-uniform control flow)
    #ifdef SSR_METAL_TINT
      if ( metal > 0.0 ) {
        // stopgap until the G-buffer carries F0 (see the header): the share assumed a white metal, so the reflected
        // radiance takes this pixel's hue and at most its brightness (a metal cannot reflect brighter than it renders)
        vec3 own = texelFetch( tColor, ip, 0 ).rgb;
        float maxC = max( own.r, max( own.g, own.b ) );
        c *= mix( vec3( 1.0 ), own / max( maxC, 1e-3 ) * min( 1.0, maxC / max( max( c.r, max( c.g, c.b ) ), 1e-3 ) ), metal );
      }
    #endif
      if ( ! all( lessThan( abs( c ), vec3( 65000.0 ) ) ) ) c = vec3( 0.0 ); // NaN / Inf from the scene: no reflection
      gl_FragColor = vec4( max( c, 0.0 ) * w, w );
    }`};class kA extends he{constructor(e,t,s,i={}){super(),this.needsSwap=!1,this.camera=e,this.history=t??null,this.gbuffer=s??null;const r={...ui};for(const o in i)i[o]!==void 0&&(r[o]=i[o]);this._scale=re(r.scale,"scale",0,1,!0),this._maxPixels=re(r.maxPixels??1/0,"maxPixels",1,1/0),this._steps=Jt(r.steps,"steps",1,128),this._refine=Jt(r.refine,"refine",0,16),this._maxDistance=re(r.maxDistance,"maxDistance",0,1e5,!0),this._thickness=re(r.thickness,"thickness",0,1e5,!0),this._thicknessScale=re(r.thicknessScale,"thicknessScale",0,1),this._maxRoughness=re(r.maxRoughness,"maxRoughness",0,1,!0),this._edgeFade=re(r.edgeFade,"edgeFade",0,.5),this._jitter=!!r.jitter,this._metalTint=!!r.metalTint,this._source=ra(r.source),this._w=1,this._h=1,this._rt=new Y(1,1,{type:H,format:ie,depthBuffer:!1,stencilBuffer:!1,minFilter:O,magFilter:O,generateMipmaps:!1}),this._rt.texture.name="SSR",this.material=new ee({name:"PostFXSSR",defines:{},uniforms:{tColor:{value:null},tDepth:{value:null},tNormal:{value:null},uProj:{value:new z},uProjInv:{value:new z},uRes:{value:new L(1,1)},uNear:{value:.1},uFar:{value:1e3},uMaxDistance:{value:this._maxDistance},uThickness:{value:this._thickness},uThicknessScale:{value:this._thicknessScale},uMaxRoughness:{value:this._maxRoughness},uEdgeFade:{value:aa(this._edgeFade)},uFrame:{value:0}},vertexShader:ia.vertexShader,fragmentShader:ia.fragmentShader,blending:me,depthTest:!1,depthWrite:!1}),this._syncDefines(),this._quad=new Ee(this.material),this._clear=new T}get texture(){return this._rt.texture}get scale(){return this._scale}set scale(e){this._scale=re(e,"scale",0,1,!0),this.setSize(this._w,this._h)}get maxPixels(){return this._maxPixels}set maxPixels(e){this._maxPixels=re(e??1/0,"maxPixels",1,1/0),this.setSize(this._w,this._h)}get steps(){return this._steps}set steps(e){this._steps=Jt(e,"steps",1,128),this._syncDefines()}get refine(){return this._refine}set refine(e){this._refine=Jt(e,"refine",0,16),this._syncDefines()}get maxDistance(){return this._maxDistance}set maxDistance(e){this.material.uniforms.uMaxDistance.value=this._maxDistance=re(e,"maxDistance",0,1e5,!0)}get thickness(){return this._thickness}set thickness(e){this.material.uniforms.uThickness.value=this._thickness=re(e,"thickness",0,1e5,!0)}get thicknessScale(){return this._thicknessScale}set thicknessScale(e){this.material.uniforms.uThicknessScale.value=this._thicknessScale=re(e,"thicknessScale",0,1)}get maxRoughness(){return this._maxRoughness}set maxRoughness(e){this.material.uniforms.uMaxRoughness.value=this._maxRoughness=re(e,"maxRoughness",0,1,!0)}get edgeFade(){return this._edgeFade}set edgeFade(e){this._edgeFade=re(e,"edgeFade",0,.5),this.material.uniforms.uEdgeFade.value=aa(this._edgeFade)}get jitter(){return this._jitter}set jitter(e){this._jitter=!!e,this._syncDefines()}get metalTint(){return this._metalTint}set metalTint(e){this._metalTint=!!e,this._syncDefines()}get source(){return this._source}set source(e){this._source=ra(e)}reset(){}setSize(e,t){this._w=e,this._h=t;let s=Math.max(1,Math.round(e*this._scale)),i=Math.max(1,Math.round(t*this._scale));if(s*i>this._maxPixels){const r=Math.sqrt(this._maxPixels/(e*t));s=Math.max(1,Math.floor(e*r)),i=Math.max(1,Math.floor(t*r))}this._rt.setSize(s,i),this.material.uniforms.uRes.value.set(Math.max(1,e),Math.max(1,t))}render(e,t,s){const i=this.gbuffer,r=s.depthTexture;if(i===null||!r){e.getClearColor(this._clear);const l=e.getClearAlpha();e.setRenderTarget(this._rt),e.setClearColor(PA,0),e.clear(!0,!1,!1),e.setClearColor(this._clear,l);return}const o=this.material.uniforms,n=this.camera,A=this.history;o.tColor.value=s.texture,o.tDepth.value=r,o.tNormal.value=i.normal,o.uProj.value.copy(n.projectionMatrix),o.uProjInv.value.copy(n.projectionMatrixInverse),o.uNear.value!==n.near&&(o.uNear.value=n.near),o.uFar.value!==n.far&&(o.uFar.value=n.far),o.uFrame.value=A!==null?A.uniforms.uFrame.value:0,e.setRenderTarget(this._rt),this._quad.render(e)}dispose(){this._rt.dispose(),this.material.dispose(),this._quad.dispose()}_syncDefines(){const e=this.material.defines;let t=!1;e.SSR_STEPS!==this._steps&&(e.SSR_STEPS=this._steps,t=!0),e.SSR_REFINE!==this._refine&&(e.SSR_REFINE=this._refine,t=!0),this._jitter!=="SSR_JITTER"in e&&(this._jitter?e.SSR_JITTER=1:delete e.SSR_JITTER,t=!0),this._metalTint!=="SSR_METAL_TINT"in e&&(this._metalTint?e.SSR_METAL_TINT=1:delete e.SSR_METAL_TINT,t=!0),t&&(this.material.needsUpdate=!0)}}const PA=new T(0,0,0),aa=a=>Math.max(a,1e-4),fi=a=>typeof a=="string"?`'${a}'`:String(a);function re(a,e,t,s,i=!1){if(typeof a!="number"||Number.isNaN(a)||(i?a<=t:a<t)||a>s)throw new Error(`[SSRPass] ${e}: expected a number in ${i?"(":"["}${t}, ${s}], got ${fi(a)}`);return a}function Jt(a,e,t,s){if(!Number.isInteger(a)||a<t||a>s)throw new Error(`[SSRPass] ${e}: expected an integer in [${t}, ${s}], got ${fi(a)}`);return a}function ra(a){if(a==="history")throw new Error("[SSRPass] source: 'history' is reserved (not implemented yet); use 'current'");if(!or.includes(a))throw new Error(`[SSRPass] source: unknown value ${fi(a)} ('current')`);return a}const qs=["variance","minmax"],Vs=["catmull-rom","bilinear"],Js=["rgba16f","r11g11b10"],js=["quad","early","single"];function GA(a,e,t=new Float32Array(9)){let s=0;for(let i=0;i<9;i++){const r=i%3-1+a,o=(i/3|0)-1+e;s+=t[i]=Math.exp(-2.29*(r*r+o*o))}for(let i=0;i<9;i++)t[i]/=s;return t}const oa={vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    uniform sampler2D tColor;
    uniform highp sampler2D tDepth;
    uniform sampler2D tVelocity;
    uniform sampler2D tNormal;
    uniform sampler2D tHistory;
    uniform mat4 uReproj;
    uniform vec4 uInvVPw; // 4th row of inverse(viewProj): homogeneous w of a reconstructed world point
    uniform vec2 uJitter; // pixels
    uniform float uWeights[ 9 ];
    uniform float uBlend, uGamma, uSharpen, uFresh, uNear, uFar;
    uniform vec2 uRes;
    varying vec2 vUv;

    ${ls}

    vec3 toYCoCg( vec3 c ) { return vec3( dot( c, vec3( 0.25, 0.5, 0.25 ) ), dot( c, vec3( 0.5, 0.0, - 0.5 ) ), dot( c, vec3( - 0.25, 0.5, - 0.25 ) ) ); }
    vec3 fromYCoCg( vec3 c ) { return vec3( c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z ); }
    // Karis: scale Y, Co, Cg by 1 / (1 + Y) (and back), so HDR highlights do not flicker through the filter and clip
    vec3 tm( vec3 c ) { vec3 y = toYCoCg( c ); return y / ( 1.0 + y.x ); }
    vec3 itm( vec3 y ) { return fromYCoCg( y / max( 1.0 - y.x, 1e-3 ) ); }
    float linearDepth( float d ) { return uNear * uFar / ( uFar - ( uFar - uNear ) * d ); } // standard (not reversed) depth
    // a NaN / Inf from the scene would stay in the history for good: black instead (comparisons with NaN fail)
    vec3 finite( vec3 o ) { return all( lessThan( abs( o ), vec3( 65000.0 ) ) ) ? max( o, 0.0 ) : vec3( 0.0 ); }
    #ifdef TAA_SSR
    uniform sampler2D tSSR;
    ${nr}
    #endif

    vec3 historyAt( vec2 uv ) {
    #ifdef TAA_SNAP
      // history position on a texel centre (to 1/512 px: static camera and surface): Catmull-Rom there is that texel
      // (weights 0, 1, 0, 0), so one fetch replaces the 5 taps (pixels in motion take the full filter)
      vec2 sp = uv * uRes - 0.5, sn = floor( sp + 0.5 );
      if ( all( lessThan( abs( sp - sn ), vec2( 1.0 / 512.0 ) ) ) ) return texelFetch( tHistory, clamp( ivec2( sn ), ivec2( 0 ), ivec2( uRes ) - 1 ), 0 ).rgb;
    #endif
    #ifdef TAA_CATMULL_ROM
      // 5-tap Catmull-Rom from bilinear taps (the 4 corner taps of the 9-tap version dropped, weights renormalised)
      vec2 rcp = 1.0 / uRes, p = uv * uRes, t1 = floor( p - 0.5 ) + 0.5, f = p - t1, f2 = f * f, f3 = f2 * f;
      vec2 w0 = f2 - 0.5 * ( f3 + f ), w1 = 1.5 * f3 - 2.5 * f2 + 1.0, w3 = 0.5 * ( f3 - f2 ), w2 = 1.0 - w0 - w1 - w3;
      vec2 w12 = w1 + w2, t0 = ( t1 - 1.0 ) * rcp, t3 = ( t1 + 2.0 ) * rcp, t12 = ( t1 + w2 / w12 ) * rcp;
      float a = w12.x * w0.y, b = w0.x * w12.y, c = w12.x * w12.y, d = w3.x * w12.y, e = w12.x * w3.y;
      vec3 s = texture2D( tHistory, vec2( t12.x, t0.y ) ).rgb * a + texture2D( tHistory, vec2( t0.x, t12.y ) ).rgb * b
             + texture2D( tHistory, t12 ).rgb * c + texture2D( tHistory, vec2( t3.x, t12.y ) ).rgb * d
             + texture2D( tHistory, vec2( t12.x, t3.y ) ).rgb * e;
      return max( s / ( a + b + c + d + e ), 0.0 );
    #else
      return texture2D( tHistory, uv ).rgb;
    #endif
    }

    #define TAA_CLOSEST( X, Y ) { ivec2 q = clamp( ip + ivec2( X, Y ), ivec2( 0 ), mx ); float e = texelFetch( tDepth, q, 0 ).x; if ( e < d ) { d = e; bp = q; } }
    #define TAA_TAP( X, Y, I ) { vec3 c = tm( texelFetch( tColor, clamp( ip + ivec2( X, Y ), ivec2( 0 ), mx ), 0 ).rgb ); cur += c * uWeights[ I ]; m1 += c; m2 += c * c; lo = min( lo, c ); hi = max( hi, c ); }
    #ifdef TAA_SSR
    // every tap with this pixel's reflection composited (ssrC, fetched once in main)
    #undef TAA_TAP
    #define TAA_TAP( X, Y, I ) { vec3 c = tm( engineSsrComposite( texelFetch( tColor, clamp( ip + ivec2( X, Y ), ivec2( 0 ), mx ), 0 ).rgb, ssrC ) ); cur += c * uWeights[ I ]; m1 += c; m2 += c * c; lo = min( lo, c ); hi = max( hi, c ); }
    #endif

    void main() {
      ivec2 ip = ivec2( gl_FragCoord.xy ), mx = ivec2( uRes ) - 1;
      float d = texelFetch( tDepth, ip, 0 ).x;
      ivec2 bp = ip;
      TAA_CLOSEST( - 1, - 1 ) TAA_CLOSEST( 1, - 1 ) TAA_CLOSEST( - 1, 1 ) TAA_CLOSEST( 1, 1 )
      float z = linearDepth( d );
    #ifdef TAA_SSR
      vec4 ssrC = texture2D( tSSR, vUv );
      if ( uFresh > 0.5 ) { gl_FragColor = vec4( finite( engineSsrComposite( texelFetch( tColor, ip, 0 ).rgb, ssrC ) ), z ); return; }
    #endif
      if ( uFresh > 0.5 ) { gl_FragColor = vec4( finite( texelFetch( tColor, ip, 0 ).rgb ), z ); return; }

      // current frame at the unjittered pixel centre + neighbourhood moments (tonemapped YCoCg)
      vec3 cur = vec3( 0.0 ), m1 = vec3( 0.0 ), m2 = vec3( 0.0 ), lo = vec3( 1e4 ), hi = vec3( - 1e4 );
      TAA_TAP( - 1, - 1, 0 ) TAA_TAP( 0, - 1, 1 ) TAA_TAP( 1, - 1, 2 )
      TAA_TAP( - 1, 0, 3 ) TAA_TAP( 0, 0, 4 ) TAA_TAP( 1, 0, 5 )
      TAA_TAP( - 1, 1, 6 ) TAA_TAP( 0, 1, 7 ) TAA_TAP( 1, 1, 8 )
      vec3 mean = m1 / 9.0;
      if ( uSharpen > 0.0 ) { cur += ( cur - mean ) * uSharpen; cur.x = clamp( cur.x, 0.0, 0.999 ); }

      // motion of the front-most surface: G-buffer velocity, or the camera reprojection of its depth
      vec2 uvJ = ( vec2( bp ) + 0.5 + uJitter ) / uRes; // where that texel's surface is, unjittered
      vec4 ndc = vec4( uvJ * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      vec4 pc = uReproj * ndc; // previous clip position if the surface is static
    #ifdef TAA_VELOCITY_FIRST
      // a G-buffer writer that stores a non-zero velocity has bit0 set and not noHistory (noHistory writes 0; other
      // materials write 0 or leave both attachments as they were): the flags are read only where the velocity is 0
      // (static camera + surface, noHistory, nothing written). Same result, one full-screen read less in motion.
      vec2 vel = texelFetch( tVelocity, bp, 0 ).rg;
      int flags = vel.x != 0.0 || vel.y != 0.0 ? ENGINE_GB_WROTE : engineGbFlags( texelFetch( tNormal, bp, 0 ).a );
      bool wrote = ( flags & ENGINE_GB_WROTE ) != 0;
      bool behind = ! wrote && pc.w <= 0.0;
      if ( ! wrote ) vel = behind ? vec2( 0.0 ) : uvJ - ( pc.xy / pc.w * 0.5 + 0.5 );
    #else
      int flags = engineGbFlags( texelFetch( tNormal, bp, 0 ).a );
      bool wrote = ( flags & ENGINE_GB_WROTE ) != 0;
      // depth path: a point behind the previous camera (pc.w <= 0) projects to garbage, often inside [0, 1]: no
      // history, as the G-buffer's noHistory flag does for its writers
      bool behind = ! wrote && pc.w <= 0.0;
      vec2 vel = wrote ? texelFetch( tVelocity, bp, 0 ).rg : behind ? vec2( 0.0 ) : uvJ - ( pc.xy / pc.w * 0.5 + 0.5 );
    #endif
      vec2 huv = vUv - vel;
      float a = uBlend;
      if ( behind || ( flags & ENGINE_GB_NO_HISTORY ) != 0 || huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0 ) a = 0.0;
    #ifdef TAA_DEPTH_REJECT
      float zPrev = pc.w / dot( uInvVPw, ndc ); // view depth the surface had, static
     #if defined( TAA_REJECT_EARLY ) || defined( TAA_REJECT_SINGLE )
      // the texel nearest the history position first (one of the 2x2): it decides almost every pixel
      float tol = 0.1 * z + 0.3, hn = texelFetch( tHistory, clamp( ivec2( huv * uRes ), ivec2( 0 ), mx ), 0 ).a;
      if ( min( abs( hn - zPrev ), abs( hn - z ) ) > tol ) {
      #ifdef TAA_REJECT_EARLY
        ivec2 h0 = clamp( ivec2( floor( huv * uRes - 0.5 ) ), ivec2( 0 ), mx ), h1 = min( h0 + 1, mx );
        vec4 hz = vec4( texelFetch( tHistory, h0, 0 ).a, texelFetch( tHistory, ivec2( h1.x, h0.y ), 0 ).a,
                        texelFetch( tHistory, ivec2( h0.x, h1.y ), 0 ).a, texelFetch( tHistory, h1, 0 ).a );
        vec4 e = min( abs( hz - zPrev ), abs( hz - z ) );
        if ( min( min( e.x, e.y ), min( e.z, e.w ) ) > tol ) a = 0.0;
      #else
        a = 0.0;
      #endif
      }
     #else
      ivec2 h0 = clamp( ivec2( floor( huv * uRes - 0.5 ) ), ivec2( 0 ), mx ), h1 = min( h0 + 1, mx );
      vec4 hz = vec4( texelFetch( tHistory, h0, 0 ).a, texelFetch( tHistory, ivec2( h1.x, h0.y ), 0 ).a,
                      texelFetch( tHistory, ivec2( h0.x, h1.y ), 0 ).a, texelFetch( tHistory, h1, 0 ).a );
      vec4 e = min( abs( hz - zPrev ), abs( hz - z ) );
      if ( min( min( e.x, e.y ), min( e.z, e.w ) ) > 0.1 * z + 0.3 ) a = 0.0;
     #endif
    #endif

      vec3 h = tm( historyAt( huv ) );
    #ifdef TAA_MINMAX
      h = clamp( h, lo, hi );
    #else
      vec3 ext = max( sqrt( max( m2 / 9.0 - mean * mean, 0.0 ) ) * uGamma, vec3( 1e-5 ) ), v = h - mean, k = abs( v / ext );
      float m = max( k.x, max( k.y, k.z ) );
      if ( m > 1.0 ) h = mean + v / m; // clip toward the mean
    #endif
      gl_FragColor = vec4( finite( itm( mix( cur, h, a ) ) ), z );
    }`};class LA extends he{constructor(e,t,s,i={}){super(),this.needsSwap=!1,this.camera=e,this.history=t,this.gbuffer=s,this.blend=i.blend??.9,this.gamma=i.gamma??1,this.sharpen=i.sharpen??0,this._clamp=Qe(i.clamp??"variance",qs,"clamp"),this._filter=Qe(i.filter??"catmull-rom",Vs,"filter"),this._format=Qe(i.historyFormat??"rgba16f",Js,"historyFormat"),this._reject=Qe(i.reject??"quad",js,"reject"),this._velocityFirst=!!(i.velocityFirst??!1),this._snap=!!(i.snap??!1),this.ssr=null,this._ssrOn=!1,this._w=1,this._h=1,this._rt=[null,null],this._makeTargets(),this._cur=0,this._reset=!0,this._lastFrame=-2;const r=t.uniforms;this.material=new ee({name:"PostFXTAA",defines:{},uniforms:{tColor:{value:null},tDepth:{value:null},tVelocity:{value:null},tNormal:{value:null},tHistory:{value:null},tSSR:{value:null},uReproj:r.uReproj,uJitter:r.uJitter,uInvVPw:{value:new Be},uWeights:{value:new Float32Array(9)},uBlend:{value:.9},uGamma:{value:1},uSharpen:{value:0},uFresh:{value:1},uNear:{value:.1},uFar:{value:1e3},uRes:{value:new L(1,1)}},vertexShader:oa.vertexShader,fragmentShader:oa.fragmentShader,blending:me,depthTest:!1,depthWrite:!1}),this._syncDefines(),this._quad=new Ee(this.material)}get texture(){return this._rt[this._cur].texture}get clamp(){return this._clamp}set clamp(e){this._clamp=Qe(e,qs,"clamp"),this._syncDefines()}get filter(){return this._filter}set filter(e){this._filter=Qe(e,Vs,"filter"),this._syncDefines()}get historyFormat(){return this._format}set historyFormat(e){if(e=Qe(e,Js,"historyFormat"),e!==this._format){this._format=e;for(const t of this._rt)t.dispose();this._makeTargets(),this._syncDefines(),this._reset=!0}}get reject(){return this._reject}set reject(e){this._reject=Qe(e,js,"reject"),this._syncDefines()}get velocityFirst(){return this._velocityFirst}set velocityFirst(e){this._velocityFirst=!!e,this._syncDefines()}get snap(){return this._snap}set snap(e){this._snap=!!e,this._syncDefines()}reset(){this._reset=!0}setSize(e,t){this._w=e,this._h=t;for(const s of this._rt)s.setSize(e,t);this.material.uniforms.uRes.value.set(e,t),this._reset=!0}render(e,t,s){const i=this.material.uniforms,r=this.history,o=this.gbuffer,n=this.camera,A=r.uniforms.uFrame.value,l=this.ssr,h=l!==null&&l.enabled;h!==this._ssrOn&&(this._ssrOn=h,this._syncDefines());const c=this._reset||r.fresh||A!==this._lastFrame+1;this._reset=!1,this._lastFrame=A,i.tColor.value=s.texture,i.tDepth.value=s.depthTexture,i.tVelocity.value=o.velocity,i.tNormal.value=o.normal,i.tHistory.value=this._rt[this._cur].texture,i.tSSR.value=h?l.texture:null,this._cur^=1,i.uFresh.value=c?1:0,i.uBlend.value=this.blend,i.uGamma.value=this.gamma,i.uSharpen.value=this.sharpen,i.uNear.value=n.near,i.uFar.value=n.far;const d=r.uniforms.uInvViewProj.value.elements;i.uInvVPw.value.set(d[3],d[7],d[11],d[15]);const f=r.uniforms.uJitter.value;GA(f.x,f.y,i.uWeights.value),e.setRenderTarget(this._rt[this._cur]),this._quad.render(e)}dispose(){for(const e of this._rt)e.dispose();this.material.dispose(),this._quad.dispose()}_makeTargets(){const t={...this._format==="r11g11b10"?{format:it,type:Ft}:{type:H},depthBuffer:!1,stencilBuffer:!1,minFilter:O,magFilter:O,generateMipmaps:!1};for(let s=0;s<2;s++){const i=this._rt[s]=new Y(this._w,this._h,t);i.texture.name=`TAA.history${s}`}}_syncDefines(){const e=this.material.defines,t={TAA_CATMULL_ROM:this._filter==="catmull-rom",TAA_MINMAX:this._clamp==="minmax",TAA_DEPTH_REJECT:this._format==="rgba16f",TAA_REJECT_EARLY:this._reject==="early",TAA_REJECT_SINGLE:this._reject==="single",TAA_VELOCITY_FIRST:this._velocityFirst,TAA_SNAP:this._snap,TAA_SSR:this._ssrOn};let s=!1;for(const i in t)t[i]!==i in e&&(t[i]?e[i]=1:delete e[i],s=!0);s&&(this.material.needsUpdate=!0)}}function Qe(a,e,t){if(!e.includes(a))throw new Error(`[TAAPass] unknown ${t} '${a}' (${e.map(s=>`'${s}'`).join(" | ")})`);return a}const Ar=6e4,na=4,Aa=Math.PI/180,lr=Object.freeze({scale:.25,maxPixels:1/0,steps:16,maxDistance:400,g:.55,density:1,temporal:!0,blend:.9,jitter:!0}),la={scale:[a=>typeof a=="number"&&a>0&&a<=1,"a number in (0, 1]"],maxPixels:[a=>typeof a=="number"&&a>=1,"a number >= 1 (Infinity or null: no budget)"],steps:[a=>Number.isInteger(a)&&a>=1&&a<=128,"an integer in 1..128"],maxDistance:[a=>Number.isFinite(a)&&a>0,"a finite number > 0 (m)"],g:[a=>typeof a=="number"&&a>-1&&a<1,"a number in (-1, 1)"],density:[a=>Number.isFinite(a)&&a>=0,"a finite number >= 0"],temporal:[a=>typeof a=="boolean","a boolean"],blend:[a=>typeof a=="number"&&a>=0&&a<1,"a number in [0, 1)"],jitter:[a=>typeof a=="boolean","a boolean"]},NA=a=>typeof a=="string"?`'${a}'`:String(a);function Ie(a,e){const t=la[a];if(!t)throw new Error(`[VolumetricPass] unknown option '${a}' (${Object.keys(la).join(", ")})`);if(a==="maxPixels"&&e===null&&(e=1/0),!t[0](e))throw new Error(`[VolumetricPass] ${a} must be ${t[1]} (got ${NA(e)})`);return e}const ha={vertexShader:`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,fragmentShader:`
    #include <packing>
    #define VOL_FAR_DEPTH ${Ar.toFixed(1)}
    uniform highp sampler2D tDepth;
    uniform sampler2D tHistory;
    #ifdef VOL_SHADOW_PACKED
    uniform sampler2D tShadow0;
    #if VOL_CASCADES > 1
    uniform sampler2D tShadow1;
    #endif
    #if VOL_CASCADES > 2
    uniform sampler2D tShadow2;
    #endif
    #if VOL_CASCADES > 3
    uniform sampler2D tShadow3;
    #endif
    // three's texture2DCompare on the RGBA-packed map: 1 (lit) where z is not behind the stored depth
    float volTap( sampler2D map, vec3 c, float bias ) {
      float d = unpackRGBAToDepth( texture2D( map, c.xy ) );
    #ifdef USE_REVERSED_DEPTH_BUFFER
      return step( d, c.z + bias );
    #else
      return step( c.z + bias, d );
    #endif
    }
    #else
    uniform sampler2DShadow tShadow0;
    #if VOL_CASCADES > 1
    uniform sampler2DShadow tShadow1;
    #endif
    #if VOL_CASCADES > 2
    uniform sampler2DShadow tShadow2;
    #endif
    #if VOL_CASCADES > 3
    uniform sampler2DShadow tShadow3;
    #endif
    // the 'fast' kernel's compare-mode depth texture (one tap: 2x2 hardware PCF)
    float volTap( sampler2DShadow map, vec3 c, float bias ) { return texture( map, vec3( c.xy, c.z + bias ) ); }
    #endif
    #if VOL_CASCADES == 1
    #define VOL_LAST 0
    #define VOL_LAST_MAP tShadow0
    #elif VOL_CASCADES == 2
    #define VOL_LAST 1
    #define VOL_LAST_MAP tShadow1
    #elif VOL_CASCADES == 3
    #define VOL_LAST 2
    #define VOL_LAST_MAP tShadow2
    #else
    #define VOL_LAST 3
    #define VOL_LAST_MAP tShadow3
    #endif

    uniform mat4 uShadowMatrix[ 4 ]; // light.shadow.matrix: world -> shadow uv + depth (orthographic: w = 1)
    uniform vec3 uShadowOrigin[ 4 ]; // the camera position through each matrix
    uniform float uShadowBias[ 4 ];  // light.shadow.bias per cascade
    uniform mat4 uProjInv, uCamWorld; // this frame's (jittered) camera
    uniform mat4 uReproj;            // current unjittered NDC -> previous clip
    uniform vec4 uInvVPw;            // 4th row of inverse(viewProj): homogeneous w of a reconstructed point
    uniform vec2 uJitter, uPrevJitter; // TAA jitter of this / the previous frame (drawing-buffer px)
    uniform vec3 uSunDir;            // toward the sun
    uniform vec3 uPhase;             // (1 - g^2) / (4 pi), 1 + g^2, 2 g
    uniform vec4 uMedium;            // haze sigma at the camera (1/m), haze k, mist sigma at the camera, mist k
    uniform int uSteps;
    uniform vec4 uMarch;             // max distance (m), sun gate, noise on (0 / 1), frame offset (0..1)
    uniform vec2 uClip;              // camera near, far
    uniform vec2 uTemporal;          // blend, fresh (1: no history)
    varying vec2 vUv;

    vec3 volDC[ 4 ]; // per pixel: shadow-space change per metre along the ray, by cascade

    // shadowCascade.js's walk at an inner cascade: z > 1 goes on with xi kept; else the patch blends on to the next
    // cascade with weight w, so this cascade is tapped when w <= xi and the walk goes on with xi / w (uniform again)
    bool volPick( vec3 c, inout float xi ) {
      if ( c.z > 1.0 ) return false;
      vec2 e = abs( c.xy - 0.5 );
      float w = smoothstep( 0.39, 0.47, max( e.x, e.y ) );
      if ( w <= xi ) return true;
      xi /= w;
      return false;
    }

    float sunVisibility( float t, float xi ) {
      vec3 c;
    #if VOL_CASCADES > 1
      c = uShadowOrigin[ 0 ] + volDC[ 0 ] * t;
      if ( volPick( c, xi ) ) return volTap( tShadow0, c, uShadowBias[ 0 ] );
    #endif
    #if VOL_CASCADES > 2
      c = uShadowOrigin[ 1 ] + volDC[ 1 ] * t;
      if ( volPick( c, xi ) ) return volTap( tShadow1, c, uShadowBias[ 1 ] );
    #endif
    #if VOL_CASCADES > 3
      c = uShadowOrigin[ 2 ] + volDC[ 2 ] * t;
      if ( volPick( c, xi ) ) return volTap( tShadow2, c, uShadowBias[ 2 ] );
    #endif
      // the last (far) cascade: three's frustum test, then (with cascades) the patch's fade to lit at the box edge
      c = uShadowOrigin[ VOL_LAST ] + volDC[ VOL_LAST ] * t;
      if ( c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0 ) return 1.0;
      float s = volTap( VOL_LAST_MAP, c, uShadowBias[ VOL_LAST ] );
    #if VOL_CASCADES > 1
      vec2 e = abs( c.xy - 0.5 );
      s = mix( s, 1.0, smoothstep( 0.43, 0.495, max( e.x, e.y ) ) );
    #endif
      return s;
    }

    float ign( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }

    void main() {
      // the depth texel under this pixel's centre; its own centre is the ray (depth and ray agree)
      ivec2 dsz = textureSize( tDepth, 0 );
      ivec2 ip = min( ivec2( vUv * vec2( dsz ) ), dsz - 1 );
      float d = texelFetch( tDepth, ip, 0 ).x;
      vec2 uv = ( vec2( ip ) + 0.5 ) / vec2( dsz );
      bool sky = d >= 1.0;
      // the final pass's linearisation
      float z = sky ? VOL_FAR_DEPTH : uClip.x * uClip.y / ( uClip.y - ( uClip.y - uClip.x ) * d );
      vec4 vp = uProjInv * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      vec3 v = vp.xyz / vp.w;
      float dist = length( v );
      vec3 dir = normalize( mat3( uCamWorld ) * ( v / dist ) );
      float len = sky ? uMarch.x : min( dist, uMarch.x );
      float dt = len / float( uSteps );

      float phase = uPhase.x / pow( uPhase.y - uPhase.z * dot( dir, uSunDir ), 1.5 );
      volDC[ 0 ] = mat3( uShadowMatrix[ 0 ] ) * dir;
    #if VOL_CASCADES > 1
      volDC[ 1 ] = mat3( uShadowMatrix[ 1 ] ) * dir;
    #endif
    #if VOL_CASCADES > 2
      volDC[ 2 ] = mat3( uShadowMatrix[ 2 ] ) * dir;
    #endif
    #if VOL_CASCADES > 3
      volDC[ 3 ] = mat3( uShadowMatrix[ 3 ] ) * dir;
    #endif

      float o = uMarch.z > 0.5 ? fract( ign( gl_FragCoord.xy ) + uMarch.w ) : 0.5;
      vec2 kdy = uMedium.yw * dir.y; // k * dy per metre of ray, haze / mist
      float sum = 0.0;
      for ( int i = 0; i < uSteps; i ++ ) {
        float t = ( float( i ) + o ) * dt;
        // the two layers from the camera to t: density e = exp(-x) relative to the camera's, optical depth
        // sigma_cam * t * (1 - e) / x (layer() of the final pass); x clamped where no surface is (60 scale heights)
        vec2 x = clamp( kdy * t, - 60.0, 60.0 );
        vec2 e = exp( - x );
        vec2 f = vec2( abs( x.x ) > 1e-3 ? ( 1.0 - e.x ) / x.x : 1.0 - 0.5 * x.x,
                       abs( x.y ) > 1e-3 ? ( 1.0 - e.y ) / x.y : 1.0 - 0.5 * x.y );
        float sigma = dot( uMedium.xz, e );
        float tau = t * dot( uMedium.xz, f );
        float xi = uMarch.z > 0.5 ? fract( o + 0.618034 * float( i ) ) : 0.5;
        sum += sigma * exp( - tau ) * sunVisibility( t, xi );
      }
      float r = uMarch.y * phase * sum * dt;

      if ( uTemporal.y < 0.5 ) {
        vec2 uvJ = uv + uJitter / vec2( dsz ); // the unjittered position of what this texel shows
        vec4 ndc = vec4( uvJ * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
        vec4 pc = uReproj * ndc;
        if ( pc.w > 0.0 ) {
          // where the previous (jittered) frame drew it
          vec2 huv = pc.xy / pc.w * 0.5 + 0.5 - uPrevJitter / vec2( dsz );
          if ( huv.x >= 0.0 && huv.y >= 0.0 && huv.x <= 1.0 && huv.y <= 1.0 ) {
            float zPrev = sky ? VOL_FAR_DEPTH : pc.w / dot( uInvVPw, ndc ); // view depth the surface had, static
            // depth-aware 2x2 history tap: aoAt's weights with TAAPass's tolerance and quad rule
            ivec2 hm = textureSize( tHistory, 0 ) - 1;
            vec2 hp = huv * vec2( hm + 1 ) - 0.5, hf = fract( hp );
            ivec2 h0 = ivec2( floor( hp ) );
            vec2 ha = texelFetch( tHistory, clamp( h0, ivec2( 0 ), hm ), 0 ).rg;
            vec2 hb = texelFetch( tHistory, clamp( h0 + ivec2( 1, 0 ), ivec2( 0 ), hm ), 0 ).rg;
            vec2 hc = texelFetch( tHistory, clamp( h0 + ivec2( 0, 1 ), ivec2( 0 ), hm ), 0 ).rg;
            vec2 hd = texelFetch( tHistory, clamp( h0 + 1, ivec2( 0 ), hm ), 0 ).rg;
            vec4 hz = vec4( ha.y, hb.y, hc.y, hd.y );
            vec4 m = 1.0 - min( abs( hz - z ), abs( hz - zPrev ) ) / ( 0.1 * z + 0.3 ); // >= 0: within tolerance
            if ( max( max( m.x, m.y ), max( m.z, m.w ) ) >= 0.0 ) {
              vec4 w = vec4( ( 1.0 - hf.x ) * ( 1.0 - hf.y ), hf.x * ( 1.0 - hf.y ),
                             ( 1.0 - hf.x ) * hf.y, hf.x * hf.y ) * max( vec4( 1e-3 ), m );
              r = mix( r, dot( w, vec4( ha.x, hb.x, hc.x, hd.x ) ) / dot( w, vec4( 1.0 ) ), uTemporal.x );
            }
          }
        }
      }
      gl_FragColor = vec4( r >= 0.0 && r < 65000.0 ? r : 0.0, z, 0.0, 1.0 ); // NaN / Inf: 0
    }`};class UA extends he{constructor(e,t,s,i={}){if(super(),!e||!e.isCamera)throw new Error("[VolumetricPass] needs a camera");const r=s;if(!r||typeof r.shadowCascadeInfo!="function"||!r.sunDir||!r.fogParams)throw new Error("[VolumetricPass] needs an atmosphere (sunDir, fogParams, shadowCascadeInfo(out))");if(i===null||typeof i!="object")throw new Error("[VolumetricPass] options must be an object");this.needsSwap=!1,this.camera=e,this.history=t||null,this.atmosphere=s;const o={...lr};for(const c in i)o[c]=Ie(c,i[c]);this._o=o,this._W=1,this._H=1,this._sized=!1,this._info={count:0,lights:[],cameras:[],matrices:[],halfSizes:[],maps:[],depthTextures:[],packed:!0},this._count=1,this._packed=!0;const n={type:H,format:ge,depthBuffer:!1,stencilBuffer:!1,minFilter:O,magFilter:O,generateMipmaps:!1};this._rt=[new Y(1,1,n),new Y(1,1,n)],this._rt[0].texture.name="Volumetric.a",this._rt[1].texture.name="Volumetric.b",this._cur=0,this._reset=!0,this._zeroed=!1,this._lastFrame=-2,this._lastHistory=this.history,this._frame=0,this._vp=new z,this._prevVP=new z,this._inv=new z,this._hasPrev=!1,this._clear=new T;const A=()=>new z,l=()=>new b;this.material=new ee({name:"PostFXVolumetric",defines:{VOL_CASCADES:1,VOL_SHADOW_PACKED:1},uniforms:{tDepth:{value:null},tHistory:{value:null},tShadow0:{value:null},tShadow1:{value:null},tShadow2:{value:null},tShadow3:{value:null},uShadowMatrix:{value:[A(),A(),A(),A()]},uShadowOrigin:{value:[l(),l(),l(),l()]},uShadowBias:{value:new Float32Array(4)},uProjInv:{value:new z},uCamWorld:{value:new z},uReproj:{value:new z},uInvVPw:{value:new Be(0,0,0,1)},uJitter:{value:new L},uPrevJitter:{value:new L},uSunDir:{value:new b(0,1,0)},uPhase:{value:new b},uMedium:{value:new Be},uSteps:{value:16},uMarch:{value:new Be(400,0,1,0)},uClip:{value:new L(.1,1e3)},uTemporal:{value:new L(.9,1)}},vertexShader:ha.vertexShader,fragmentShader:ha.fragmentShader,blending:me,depthTest:!1,depthWrite:!1});const h=this.material.uniforms;this._shadowU=[h.tShadow0,h.tShadow1,h.tShadow2,h.tShadow3],this._quad=new Ee(this.material)}get texture(){return this._rt[this._cur].texture}get width(){return this._rt[0].width}get height(){return this._rt[0].height}get scale(){return this._o.scale}set scale(e){this._o.scale=Ie("scale",e),this._sized&&this.setSize(this._W,this._H)}get maxPixels(){return this._o.maxPixels}set maxPixels(e){this._o.maxPixels=Ie("maxPixels",e),this._sized&&this.setSize(this._W,this._H)}get steps(){return this._o.steps}set steps(e){this._o.steps=Ie("steps",e)}get maxDistance(){return this._o.maxDistance}set maxDistance(e){this._o.maxDistance=Ie("maxDistance",e)}get g(){return this._o.g}set g(e){this._o.g=Ie("g",e)}get density(){return this._o.density}set density(e){this._o.density=Ie("density",e)}get temporal(){return this._o.temporal}set temporal(e){Ie("temporal",e)!==this._o.temporal&&(this._o.temporal=e,this._reset=!0)}get blend(){return this._o.blend}set blend(e){this._o.blend=Ie("blend",e)}get jitter(){return this._o.jitter}set jitter(e){this._o.jitter=Ie("jitter",e)}reset(){this._reset=!0}setSize(e,t){this._W=e,this._H=t,this._sized=!0;const s=Math.max(1,e),i=Math.max(1,t),r=this._o.scale,o=this._o.maxPixels;let n=Math.max(1,Math.round(s*r)),A=Math.max(1,Math.round(i*r));if(n*A>o){const l=Math.sqrt(o/(s*i));n=Math.max(1,Math.floor(s*l)),A=Math.max(1,Math.floor(i*l))}this._rt[0].setSize(n,A),this._rt[1].setSize(n,A),this._reset=!0,this._zeroed=!1}render(e,t,s){const i=this.atmosphere,r=this._o,o=this.camera,n=this.history,A=this.material.uniforms,l=s?s.depthTexture:null,h=i.shadowCascadeInfo(this._info),c=Math.min(h.count,na),d=!!h.packed,f=n!==null?n.uniforms.uFrame.value:this._frame;this._frame++;const u=i.scatterDir||i.sunDir,g=u.y;let p=(Math.asin(g<-1?-1:g>1?1:g)+2*Aa)/(5*Aa);p=p<0?0:p>1?1:p,p=p*p*(3-2*p);const C=p>.02?1:0,B=o.matrixWorld.elements,I=B[12],E=B[13],v=B[14],x=i.fogParams,_=r.density,y=E-(x.hazeBase||0),D=_*x.haze*Math.exp(-x.hazeK*(y<-100?-100:y>4e3?4e3:y)),q=_*x.mist*Math.exp(-x.mistK*(E<-100?-100:E>4e3?4e3:E)),$=A.uClip.value,w=A.uMarch.value,S=A.uTemporal.value;$.x=o.near,$.y=o.far,A.uSunDir.value.copy(u);const F=r.g,P=A.uPhase.value,Q=A.uMedium.value;P.x=(1-F*F)/(4*Math.PI),P.y=1+F*F,P.z=2*F,Q.x=D,Q.y=x.hazeK,Q.z=q,Q.w=x.mistK,A.uSteps.value=r.steps,w.x=r.maxDistance,w.y=C,w.z=r.jitter?1:0,w.w=r.jitter?f%4096*.6180339887498949%1:0,S.x=r.blend;let G=l!=null&&c>0&&C>0&&D+q>0;for(let M=0;G&&M<c;M++)(d?h.maps[M]:h.depthTextures[M])||(G=!1);if(!G){this._zero(e),this._lastFrame=f;return}if(c!==this._count||d!==this._packed){const M=this.material.defines;M.VOL_CASCADES=c,d?M.VOL_SHADOW_PACKED=1:delete M.VOL_SHADOW_PACKED,this._count=c,this._packed=d,this.material.needsUpdate=!0}const V=A.uShadowMatrix.value,ae=A.uShadowOrigin.value,k=A.uShadowBias.value;for(let M=0;M<na;M++)if(M<c){const te=h.matrices[M],X=te.elements,j=ae[M],Z=h.lights[M];V[M].copy(te),j.x=X[0]*I+X[4]*E+X[8]*v+X[12],j.y=X[1]*I+X[5]*E+X[9]*v+X[13],j.z=X[2]*I+X[6]*E+X[10]*v+X[14],k[M]=Z?Z.shadow.bias:0,this._shadowU[M].value=d?h.maps[M]:h.depthTextures[M]}else this._shadowU[M].value=null,k[M]=0;A.tDepth.value=l,A.uProjInv.value.copy(o.projectionMatrixInverse),A.uCamWorld.value.copy(o.matrixWorld);let R=this._reset||f!==this._lastFrame+1||n!==this._lastHistory;if(this._lastHistory=n,n!==null){const M=n.uniforms;R=R||n.fresh,A.uReproj.value.copy(M.uReproj.value);const te=M.uInvViewProj.value.elements,X=A.uInvVPw.value;X.x=te[3],X.y=te[7],X.z=te[11],X.w=te[15],A.uJitter.value.copy(M.uJitter.value),A.uPrevJitter.value.copy(M.uPrevJitter.value)}else{this._vp.multiplyMatrices(o.projectionMatrix,o.matrixWorldInverse),this._inv.multiplyMatrices(o.matrixWorld,o.projectionMatrixInverse),R=R||!this._hasPrev,A.uReproj.value.multiplyMatrices(this._hasPrev?this._prevVP:this._vp,this._inv),this._prevVP.copy(this._vp),this._hasPrev=!0;const M=this._inv.elements,te=A.uInvVPw.value;te.x=M[3],te.y=M[7],te.z=M[11],te.w=M[15],A.uJitter.value.set(0,0),A.uPrevJitter.value.set(0,0)}this._lastFrame=f;let J;if(r.temporal){const M=this._rt[this._cur];this._cur^=1,J=this._rt[this._cur],A.tHistory.value=R?l:M.texture,S.y=R?1:0,this._reset=!1}else J=this._rt[this._cur],A.tHistory.value=l,S.y=1,this._reset=!0;e.setRenderTarget(J),this._quad.render(e),this._zeroed=!1}dispose(){this._rt[0].dispose(),this._rt[1].dispose(),this.material.dispose(),this._quad.dispose()}_zero(e){if(this._reset=!0,this._hasPrev=!1,this._zeroed)return;e.getClearColor(this._clear);const t=e.getClearAlpha();e.setRenderTarget(this._rt[this._cur]),e.setClearColor(OA,1),e.clear(!0,!1,!1),e.setClearColor(this._clear,t),this._zeroed=!0}}const OA=new T(0,Ar,0),Ze=Object.freeze({strength:1,maxBlur:24,tileSize:20,samples:8,shutter:0}),zA=`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,HA=`
  uniform highp sampler2D tDepth;
  #ifndef MB_CAMERA_ONLY
  uniform sampler2D tVelocity;
  uniform sampler2D tNormal;
  #endif
  uniform mat4 uReproj;
  uniform vec2 uJitter, uRes;
  uniform vec2 uBlur; // x = k / 2 (UV motion -> half extent), y = largest half extent (px)
  uniform float uNear, uFar;
  layout( location = 1 ) out highp vec4 mbVZ;

  ${ls}

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy );
    float d = texelFetch( tDepth, ip, 0 ).x;
    vec2 v;
  #ifndef MB_CAMERA_ONLY
    // a G-buffer writer with history: its own velocity. noHistory surfaces (ENGINE_GBUFFER_NOVEL writes velocity 0)
    // fall through to the camera motion, so a video screen still streaks while the camera pans
    if ( ( engineGbFlags( texelFetch( tNormal, ip, 0 ).a ) & ( ENGINE_GB_WROTE | ENGINE_GB_NO_HISTORY ) ) == ENGINE_GB_WROTE ) v = texelFetch( tVelocity, ip, 0 ).rg;
    else
  #endif
    {
      // camera-only: where this depth sample's surface was in the previous frame (uReproj: NDC -> previous clip)
      vec2 uv = ( gl_FragCoord.xy + uJitter ) / uRes;
      vec4 pc = uReproj * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
      v = pc.w > 0.0 ? uv - ( pc.xy / pc.w * 0.5 + 0.5 ) : vec2( 0.0 );
    }
    v *= uRes * uBlur.x; // UV -> px, half extent of the streak
    float l = length( v );
    if ( l > uBlur.y ) { v *= uBlur.y / l; l = uBlur.y; }
    gl_FragColor = vec4( v, 0.0, 1.0 );
    mbVZ = vec4( l, min( uNear * uFar / ( uFar - ( uFar - uNear ) * d ), 65000.0 ), 0.0, 1.0 );
  }`,qA=`
  uniform sampler2D tSrc;
  uniform ivec2 uDir;
  uniform int uTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ), sz = textureSize( tSrc, 0 );
    ivec2 p = o + uDir * o * ( uTile - 1 ); // first texel of this output's run
    int n = min( uTile, uDir.x == 1 ? sz.x - p.x : sz.y - p.y );
    vec2 best = vec2( 0.0 );
    float bl = - 1.0;
    for ( int i = 0; i < n; i ++ ) {
      vec2 v = texelFetch( tSrc, p + uDir * i, 0 ).rg;
      float l = dot( v, v );
      if ( l > bl ) { bl = l; best = v; }
    }
    gl_FragColor = vec4( best, 0.0, 1.0 );
  }`,VA=`
  uniform sampler2D tTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ), mx = textureSize( tTile, 0 ) - 1;
    vec2 best = vec2( 0.0 );
    float bl = - 1.0;
    for ( int y = - 1; y <= 1; y ++ ) {
      for ( int x = - 1; x <= 1; x ++ ) {
        vec2 v = texelFetch( tTile, clamp( o + ivec2( x, y ), ivec2( 0 ), mx ), 0 ).rg;
        float l = dot( v, v );
        if ( l > bl ) { bl = l; best = v; }
      }
    }
    gl_FragColor = vec4( best, 0.0, 1.0 );
  }`,JA=`
  uniform sampler2D tColor;
  uniform sampler2D tVZ;
  uniform sampler2D tNeighbor;
  uniform int uTile;

  float cone( float r, float v ) { return clamp( 1.0 - r / v, 0.0, 1.0 ); }
  float cylinder( float r, float v ) { return 1.0 - smoothstep( 0.95 * v, 1.05 * v, r ); }
  // 1 where depth a is in front of (or level with) depth b, 0 once it is behind by the soft extent
  float front( float a, float b ) { return clamp( 1.0 - ( a - b ) / ( 0.03 * min( a, b ) + 0.05 ), 0.0, 1.0 ); }

  void main() {
    vec2 X = gl_FragCoord.xy;
    ivec2 mx = textureSize( tColor, 0 ) - 1, ix = min( ivec2( X ), mx );
    vec2 vn = texelFetch( tNeighbor, ix / uTile, 0 ).rg;
    vec4 cx = texelFetch( tColor, ix, 0 );
    if ( dot( vn, vn ) < 0.0625 ) { gl_FragColor = cx; return; } // |V_N| < 0.25 px: no streak reaches here, input texel
    vec2 vzx = texelFetch( tVZ, ix, 0 ).rg;
    float vx = max( vzx.x, 0.5 ), zx = vzx.y;
    float w = 1.0 / vx;
    vec3 sum = cx.rgb * w;
    float j = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) - 0.5; // IGN
    for ( int i = 0; i < MB_SAMPLES; i ++ ) {
      float t = mix( - 1.0, 1.0, ( float( i ) + j + 1.0 ) / ( float( MB_SAMPLES ) + 1.0 ) );
      ivec2 iy = clamp( ivec2( floor( X + vn * t ) ), ivec2( 0 ), mx );
      vec2 vzy = texelFetch( tVZ, iy, 0 ).rg;
      float vy = max( vzy.x, 0.5 ), zy = vzy.y, r = length( vec2( iy - ix ) );
      float a = front( zy, zx ) * cone( r, vy ) + front( zx, zy ) * cone( r, vx ) + cylinder( r, vy ) * cylinder( r, vx ) * 2.0;
      w += a;
      sum += texelFetch( tColor, iy, 0 ).rgb * a;
    }
    gl_FragColor = vec4( sum / w, cx.a );
  }`,ca=Object.keys(Ze);class jA extends he{constructor(e,t,s,i={}){if(super(),!t||!t.uniforms||!t.uniforms.uReproj)throw new Error("[MotionBlurPass] needs a CameraHistory (camera-only velocity, jitter)");for(const l in i)if(!ca.includes(l))throw new Error(`[MotionBlurPass] unknown option '${l}' (${ca.join(", ")})`);this.needsSwap=!1,this.camera=e,this.history=t,this.gbuffer=s??null;const r=Ze;this._strength=jt(i.strength??r.strength,"strength"),this._maxBlur=jt(i.maxBlur??r.maxBlur,"maxBlur"),this._tileSize=Kt(i.tileSize??r.tileSize,1,128,"tileSize"),this._samples=Kt(i.samples??r.samples,2,64,"samples"),this._shutter=ua(i.shutter??r.shutter,"shutter"),this._w=1,this._h=1,this._camOnly=null;const o={type:H,format:ge,depthBuffer:!1,stencilBuffer:!1,minFilter:Ae,magFilter:Ae,generateMipmaps:!1};this._vel=new Y(1,1,{...o,count:2}),this._vel.textures[0].name="MotionBlur.velocity",this._vel.textures[1].name="MotionBlur.speedDepth",this._tileX=new Y(1,1,o),this._tileX.texture.name="MotionBlur.tileRows",this._tile=new Y(1,1,o),this._tile.texture.name="MotionBlur.tileMax",this._neighbor=new Y(1,1,o),this._neighbor.texture.name="MotionBlur.neighborMax",this._out=new Y(1,1,{type:H,depthBuffer:!1,stencilBuffer:!1,minFilter:O,magFilter:O,generateMipmaps:!1}),this._out.texture.name="MotionBlur.out";const n=t.uniforms,A=(l,h,c,d={})=>new ee({name:l,defines:d,uniforms:c,vertexShader:zA,fragmentShader:h,blending:me,depthTest:!1,depthWrite:!1});this._velocityMat=A("PostFXMotionBlurVelocity",HA,{tDepth:{value:null},tVelocity:{value:null},tNormal:{value:null},uReproj:n.uReproj,uJitter:n.uJitter,uRes:{value:new L(1,1)},uBlur:{value:new L(.5,12)},uNear:{value:.1},uFar:{value:1e3}}),this._tileMat=A("PostFXMotionBlurTileMax",qA,{tSrc:{value:null},uDir:{value:new L(1,0)},uTile:{value:20}}),this._neighborMat=A("PostFXMotionBlurNeighborMax",VA,{tTile:{value:null}}),this._reconstructMat=A("PostFXMotionBlur",JA,{tColor:{value:null},tVZ:{value:this._vel.textures[1]},tNeighbor:{value:this._neighbor.texture},uTile:{value:20}},{MB_SAMPLES:this._samples}),this._quad=new Ee(null),this._resize()}get texture(){return this._out.texture}get velocityTexture(){return this._vel.textures[0]}get neighborMaxTexture(){return this._neighbor.texture}get strength(){return this._strength}set strength(e){this._strength=jt(e,"strength")}get maxBlur(){return this._maxBlur}set maxBlur(e){this._maxBlur=jt(e,"maxBlur")}get tileSize(){return this._tileSize}set tileSize(e){this._tileSize=Kt(e,1,128,"tileSize"),this._resize()}get samples(){return this._samples}set samples(e){e=Kt(e,2,64,"samples"),e!==this._samples&&(this._samples=e,this._reconstructMat.defines.MB_SAMPLES=e,this._reconstructMat.needsUpdate=!0)}get shutter(){return this._shutter}set shutter(e){this._shutter=ua(e,"shutter")}reset(){}setSize(e,t){this._w=Math.max(1,Math.floor(e)||1),this._h=Math.max(1,Math.floor(t)||1),this._resize()}render(e,t,s,i){const r=this.gbuffer,o=this.camera,n=r===null;if(n!==this._camOnly){this._camOnly=n;const u=this._velocityMat.defines;n?u.MB_CAMERA_ONLY=1:delete u.MB_CAMERA_ONLY,this._velocityMat.needsUpdate=!0}const A=this._velocityMat.uniforms;A.tDepth.value=s.depthTexture,A.tVelocity.value=n?null:r.velocity,A.tNormal.value=n?null:r.normal,A.uNear.value!==o.near&&(A.uNear.value=o.near),A.uFar.value!==o.far&&(A.uFar.value=o.far);const l=this._shutter,h=l>0&&i>0?Math.min(l/i,4):1,c=A.uBlur.value;c.x=.5*this._strength*h,c.y=Math.min(.5*this._maxBlur,this._tileSize);const d=e.autoClear;e.autoClear=!1,this._draw(e,this._vel,this._velocityMat);const f=this._tileMat.uniforms;f.tSrc.value=this._vel.textures[0],f.uDir.value.set(1,0),this._draw(e,this._tileX,this._tileMat),f.tSrc.value=this._tileX.texture,f.uDir.value.set(0,1),this._draw(e,this._tile,this._tileMat),this._neighborMat.uniforms.tTile.value=this._tile.texture,this._draw(e,this._neighbor,this._neighborMat),this._reconstructMat.uniforms.tColor.value=s.texture,this._draw(e,this._out,this._reconstructMat),e.autoClear=d}dispose(){for(const e of[this._vel,this._tileX,this._tile,this._neighbor,this._out])e.dispose();for(const e of[this._velocityMat,this._tileMat,this._neighborMat,this._reconstructMat])e.dispose();this._quad.dispose()}_draw(e,t,s){e.setRenderTarget(t),e.clear(!0,!1,!1),this._quad.material=s,this._quad.render(e)}_resize(){const e=this._w,t=this._h,s=this._tileSize,i=Math.max(1,Math.ceil(e/s)),r=Math.max(1,Math.ceil(t/s));this._vel.setSize(e,t),this._tileX.setSize(i,t),this._tile.setSize(i,r),this._neighbor.setSize(i,r),this._out.setSize(e,t),this._velocityMat.uniforms.uRes.value.set(e,t),this._tileMat.uniforms.uTile.value=s,this._reconstructMat.uniforms.uTile.value=s}}function jt(a,e){if(typeof a!="number"||!Number.isFinite(a)||a<=0)throw new Error(`[MotionBlurPass] ${e}: expected a finite number > 0, got ${a}`);return a}function Kt(a,e,t,s){if(!Number.isInteger(a)||a<e||a>t)throw new Error(`[MotionBlurPass] ${s}: expected an integer in ${e}..${t}, got ${a}`);return a}function ua(a,e){if(typeof a!="number"||!Number.isFinite(a)||a<0)throw new Error(`[MotionBlurPass] ${e}: expected a finite number >= 0, got ${a}`);return a}const hs=Object.freeze({focusDistance:12,focalLength:50,fStop:2,sensorHeight:24,maxCoC:12,scale:.5,samples:24,nearBlur:!0,stableDepth:!1}),KA=Math.PI*(3-Math.sqrt(5));function YA(a,e,t,s,i,r){const o=t,n=e*1e3;return o/s*o/(n-o)*(1-n/(a*1e3))*r/i}function fa(a,e=new Float32Array(2*a)){for(let t=0;t<a;t++){const s=Math.sqrt((t+.5)/a),i=t*KA;e[2*t]=s*Math.cos(i),e[2*t+1]=s*Math.sin(i)}return e}const WA=`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,hr=`
  uniform vec3 uCoc;
  uniform float uNear, uFar;
  float dofCoc( float d ) {
    float z = uNear * uFar / ( uFar - ( uFar - uNear ) * d );
    return clamp( uCoc.x * ( 1.0 - uCoc.y / z ), - uCoc.z, uCoc.z );
  }`,XA=`
  uniform sampler2D tColor;
  uniform highp sampler2D tDepth;
  uniform vec2 uRatio; // full-resolution px per prefilter texel
  ${hr}

  void main() {
    vec2 P = gl_FragCoord.xy * uRatio - 0.5, f = fract( P ); // bilinear footprint of this texel's centre
    ivec2 mx = textureSize( tColor, 0 ) - 1, i0 = clamp( ivec2( floor( P ) ), ivec2( 0 ), mx ), i1 = min( i0 + 1, mx );
    ivec2 p1 = ivec2( i1.x, i0.y ), p2 = ivec2( i0.x, i1.y );
    vec4 bw = vec4( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y );
    vec4 c = vec4( dofCoc( texelFetch( tDepth, i0, 0 ).x ), dofCoc( texelFetch( tDepth, p1, 0 ).x ),
                   dofCoc( texelFetch( tDepth, p2, 0 ).x ), dofCoc( texelFetch( tDepth, i1, 0 ).x ) );
    vec4 cs = c * step( 1e-6, bw ); // taps outside the footprint (weight 0) take no part in the choice
    float lo = min( min( cs.x, cs.y ), min( cs.z, cs.w ) ), hi = max( max( cs.x, cs.y ), max( cs.z, cs.w ) );
    float coc = - lo >= 0.5 ? lo : hi; // near wins once any tap is near-blurred
    vec4 w = bw * ( max( c * sign( coc ), 0.0 ) + 1e-3 );
    vec3 col = texelFetch( tColor, i0, 0 ).rgb * w.x + texelFetch( tColor, p1, 0 ).rgb * w.y
             + texelFetch( tColor, p2, 0 ).rgb * w.z + texelFetch( tColor, i1, 0 ).rgb * w.w;
    gl_FragColor = vec4( col / ( w.x + w.y + w.z + w.w ), coc );
  }`,$A=`
  uniform sampler2D tPre;
  uniform int uTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ) * uTile, e = min( o + uTile, textureSize( tPre, 0 ) );
    float m = 0.0;
    for ( int y = o.y; y < e.y; y ++ ) {
      for ( int x = o.x; x < e.x; x ++ ) m = max( m, - texelFetch( tPre, ivec2( x, y ), 0 ).a );
    }
    gl_FragColor = vec4( m, 0.0, 0.0, 1.0 );
  }`,ZA=`
  uniform sampler2D tTile;

  void main() {
    ivec2 o = ivec2( gl_FragCoord.xy ), mx = textureSize( tTile, 0 ) - 1;
    float m = 0.0;
    for ( int y = - 1; y <= 1; y ++ ) {
      for ( int x = - 1; x <= 1; x ++ ) m = max( m, texelFetch( tTile, clamp( o + ivec2( x, y ), ivec2( 0 ), mx ), 0 ).r );
    }
    gl_FragColor = vec4( m, 0.0, 0.0, 1.0 );
  }`,el=`
  uniform sampler2D tPre;
  uniform float uScale; // prefilter texels per full-resolution px
  uniform vec2 uKernel[ DOF_SAMPLES ];

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy ), mx = textureSize( tPre, 0 ) - 1;
    vec4 c0 = texelFetch( tPre, ip, 0 );
    if ( c0.a < 0.5 ) { gl_FragColor = vec4( c0.rgb, 1.0 ); return; } // not far-blurred: the composite keeps the sharp texel
    float R = c0.a * uScale;
    vec3 sum = c0.rgb;
    float ws = 1.0;
    for ( int i = 0; i < DOF_SAMPLES; i ++ ) {
      vec2 o = uKernel[ i ] * R;
      vec4 t = texelFetch( tPre, clamp( ivec2( floor( gl_FragCoord.xy + o ) ), ivec2( 0 ), mx ), 0 );
      float w = clamp( t.a * uScale - length( o ) + 1.0, 0.0, 1.0 ); // the tap's own disc reaches this texel
      sum += t.rgb * w;
      ws += w;
    }
    gl_FragColor = vec4( sum / ws, 1.0 );
  }`,tl=`
  uniform sampler2D tPre;
  uniform sampler2D tNearMax;
  uniform int uTile;
  uniform float uScale;
  uniform vec2 uKernel[ DOF_SAMPLES ];

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy ), mx = textureSize( tPre, 0 ) - 1;
    float R = texelFetch( tNearMax, ip / uTile, 0 ).r; // largest near CoC around (full-resolution px)
    if ( R < 0.5 ) { gl_FragColor = vec4( 0.0 ); return; }
    float Rs = R * uScale, k = Rs * Rs / float( DOF_SAMPLES ), hs = 0.5 * uScale;
    vec3 sum = vec3( 0.0 );
    float a = 0.0;
    for ( int i = 0; i < DOF_SAMPLES; i ++ ) {
      vec2 o = uKernel[ i ] * Rs;
      vec4 t = texelFetch( tPre, clamp( ivec2( floor( gl_FragCoord.xy + o ) ), ivec2( 0 ), mx ), 0 );
      float n = max( - t.a * uScale, hs ); // the tap's near CoC radius in texels (>= 0.5 px)
      float w = clamp( n - length( o ) + 1.0, 0.0, 1.0 ) * smoothstep( 0.5, 2.0, - t.a ) * k / ( n * n );
      sum += t.rgb * w;
      a += w;
    }
    gl_FragColor = vec4( sum / max( a, 1.0 ), min( a, 1.0 ) );
  }`,sl=`
  uniform sampler2D tColor;
  uniform highp sampler2D tDepth;
  uniform sampler2D tFar;
  #ifdef DOF_NEAR
  uniform sampler2D tNear;
  #endif
  varying vec2 vUv;
  ${hr}

  void main() {
    ivec2 ip = ivec2( gl_FragCoord.xy );
    vec4 c = texelFetch( tColor, ip, 0 );
    float d = texelFetch( tDepth, ip, 0 ).x;
  #ifdef DOF_STABLE_DEPTH
    // under TAA jitter: the closest depth of the pixel and its diagonals, so a silhouette keeps one CoC every frame
    ivec2 mx = textureSize( tDepth, 0 ) - 1;
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( - 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( - 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
    d = min( d, texelFetch( tDepth, clamp( ip + ivec2( 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
  #endif
    float coc = dofCoc( d );
  #ifdef DOF_NEAR
    vec4 nf = texture2D( tNear, vUv );
  #else
    vec4 nf = vec4( 0.0 );
  #endif
    if ( abs( coc ) < 0.5 && nf.a <= 0.0 ) { gl_FragColor = c; return; } // in focus, nothing blurred in front: the input texel
    vec3 col = c.rgb;
    if ( coc > 0.5 ) col = mix( col, texture2D( tFar, vUv ).rgb, smoothstep( 0.5, 2.0, coc ) );
    gl_FragColor = vec4( col * ( 1.0 - nf.a ) + nf.rgb, c.a );
  }`,ga=Object.keys(hs);class il extends he{constructor(e,t={}){super();for(const h in t)if(!ga.includes(h))throw new Error(`[DoFPass] unknown option '${h}' (${ga.join(", ")})`);this.needsSwap=!1,this.camera=e;const s=hs;this._focus=Se(t.focusDistance??s.focusDistance,"focusDistance"),this._focal=Se(t.focalLength??s.focalLength,"focalLength"),bs(this._focus,this._focal),this._fStop=Se(t.fStop??s.fStop,"fStop"),this._sensor=Se(t.sensorHeight??s.sensorHeight,"sensorHeight"),this._maxCoC=pa(t.maxCoC??s.maxCoC),this._scale=ma(t.scale??s.scale),this._samples=da(t.samples??s.samples,4,64,"samples"),this._nearBlur=Yt(t.nearBlur??s.nearBlur,"nearBlur"),this._stableDepth=Yt(t.stableDepth??s.stableDepth,"stableDepth"),this._nearDefined=null,this._stableDefined=null,this._w=1,this._h=1,this._tile=1;const i={type:H,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1},r=(h,c)=>{const d=new Y(1,1,c);return d.texture.name=h,d};this._pre=r("DoF.prefilter",{...i,minFilter:Ae,magFilter:Ae});const o={...i,format:ge,minFilter:Ae,magFilter:Ae};this._nearTile=r("DoF.nearTileMax",o),this._nearMax=r("DoF.nearDilated",o),this._far=r("DoF.far",{...i,minFilter:O,magFilter:O}),this._near=r("DoF.near",{...i,minFilter:O,magFilter:O}),this._out=r("DoF.out",{...i,minFilter:O,magFilter:O}),this._uCoc={value:new b},this._uNear={value:.1},this._uFar={value:1e3},this._uKernel={value:fa(this._samples)},this._uScale={value:.5};const n=(h,c,d,f={})=>new ee({name:h,defines:f,uniforms:d,vertexShader:WA,fragmentShader:c,blending:me,depthTest:!1,depthWrite:!1}),A={uCoc:this._uCoc,uNear:this._uNear,uFar:this._uFar};this._prefilterMat=n("PostFXDoFPrefilter",XA,{tColor:{value:null},tDepth:{value:null},uRatio:{value:new L(2,2)},...A}),this._tileMat=n("PostFXDoFNearTile",$A,{tPre:{value:this._pre.texture},uTile:{value:1}}),this._dilateMat=n("PostFXDoFNearDilate",ZA,{tTile:{value:this._nearTile.texture}});const l={DOF_SAMPLES:this._samples};this._farMat=n("PostFXDoFFar",el,{tPre:{value:this._pre.texture},uScale:this._uScale,uKernel:this._uKernel},{...l}),this._nearMat=n("PostFXDoFNear",tl,{tPre:{value:this._pre.texture},tNearMax:{value:this._nearMax.texture},uTile:{value:1},uScale:this._uScale,uKernel:this._uKernel},{...l}),this._compositeMat=n("PostFXDoF",sl,{tColor:{value:null},tDepth:{value:null},tFar:{value:this._far.texture},tNear:{value:this._near.texture},...A}),this._quad=new Ee(null),this._resize()}get texture(){return this._out.texture}get farTexture(){return this._far.texture}get nearTexture(){return this._near.texture}get prefilterTexture(){return this._pre.texture}get focusDistance(){return this._focus}set focusDistance(e){bs(Se(e,"focusDistance"),this._focal),this._focus=e}get focalLength(){return this._focal}set focalLength(e){bs(this._focus,Se(e,"focalLength")),this._focal=e}get fStop(){return this._fStop}set fStop(e){this._fStop=Se(e,"fStop")}get sensorHeight(){return this._sensor}set sensorHeight(e){this._sensor=Se(e,"sensorHeight")}get maxCoC(){return this._maxCoC}set maxCoC(e){this._maxCoC=pa(e),this._resize()}get scale(){return this._scale}set scale(e){this._scale=ma(e),this._resize()}get nearBlur(){return this._nearBlur}set nearBlur(e){this._nearBlur=Yt(e,"nearBlur")}get stableDepth(){return this._stableDepth}set stableDepth(e){this._stableDepth=Yt(e,"stableDepth")}get samples(){return this._samples}set samples(e){if(e=da(e,4,64,"samples"),e!==this._samples){this._samples=e,this._uKernel.value=fa(e);for(const t of[this._farMat,this._nearMat])t.defines.DOF_SAMPLES=e,t.needsUpdate=!0}}cocAt(e){return YA(e,this._focus,this._focal,this._fStop,this._sensor,this._h)}reset(){}setSize(e,t){this._w=Math.max(1,Math.floor(e)||1),this._h=Math.max(1,Math.floor(t)||1),this._resize()}render(e,t,s){const i=this.camera,r=this._nearBlur,o=this._stableDepth;if(r!==this._nearDefined||o!==this._stableDefined){this._nearDefined=r,this._stableDefined=o;const d=this._compositeMat.defines;r?d.DOF_NEAR=1:delete d.DOF_NEAR,o?d.DOF_STABLE_DEPTH=1:delete d.DOF_STABLE_DEPTH,this._compositeMat.needsUpdate=!0}const n=this._focal,A=this._focus*1e3;this._uCoc.value.set(n/this._fStop*n/(A-n)*this._h/this._sensor,this._focus,this._maxCoC),this._uNear.value!==i.near&&(this._uNear.value=i.near),this._uFar.value!==i.far&&(this._uFar.value=i.far);const l=this._prefilterMat.uniforms,h=this._compositeMat.uniforms;l.tColor.value=s.texture,l.tDepth.value=s.depthTexture,h.tColor.value=s.texture,h.tDepth.value=s.depthTexture;const c=e.autoClear;e.autoClear=!1,this._draw(e,this._pre,this._prefilterMat),r&&(this._draw(e,this._nearTile,this._tileMat),this._draw(e,this._nearMax,this._dilateMat),this._draw(e,this._near,this._nearMat)),this._draw(e,this._far,this._farMat),this._draw(e,this._out,this._compositeMat),e.autoClear=c}_draw(e,t,s){e.setRenderTarget(t),e.clear(!0,!1,!1),this._quad.material=s,this._quad.render(e)}dispose(){for(const e of[this._pre,this._nearTile,this._nearMax,this._far,this._near,this._out])e.dispose();for(const e of[this._prefilterMat,this._tileMat,this._dilateMat,this._farMat,this._nearMat,this._compositeMat])e.dispose();this._quad.dispose()}_resize(){const e=this._w,t=this._h,s=Math.max(1,Math.round(e*this._scale)),i=Math.max(1,Math.round(t*this._scale)),r=i/t,o=this._tile=Math.max(1,Math.ceil(this._maxCoC*r)),n=Math.max(1,Math.ceil(s/o)),A=Math.max(1,Math.ceil(i/o));this._pre.setSize(s,i),this._far.setSize(s,i),this._near.setSize(s,i),this._nearTile.setSize(n,A),this._nearMax.setSize(n,A),this._out.setSize(e,t),this._prefilterMat.uniforms.uRatio.value.set(e/s,t/i),this._uScale.value=r,this._tileMat.uniforms.uTile.value=o,this._nearMat.uniforms.uTile.value=o}}function Se(a,e){if(typeof a!="number"||!Number.isFinite(a)||a<=0)throw new Error(`[DoFPass] ${e}: expected a finite number > 0, got ${a}`);return a}function da(a,e,t,s){if(!Number.isInteger(a)||a<e||a>t)throw new Error(`[DoFPass] ${s}: expected an integer in ${e}..${t}, got ${a}`);return a}function ma(a){if(typeof a!="number"||!(a>0&&a<=1))throw new Error(`[DoFPass] scale: expected a number in (0, 1], got ${a}`);return a}function pa(a){if(typeof a!="number"||!(a>0&&a<=64))throw new Error(`[DoFPass] maxCoC: expected a number in (0, 64] px, got ${a}`);return a}function Yt(a,e){if(typeof a!="boolean")throw new Error(`[DoFPass] ${e}: expected a boolean, got ${typeof a=="string"?`'${a}'`:a}`);return a}function bs(a,e){if(!(a*1e3>e))throw new Error(`[DoFPass] focusDistance (${a} m) must exceed focalLength (${e} mm) / 1000`)}const al=`
vec3 engineApplyLut( highp sampler3D lut, vec3 c, float size ) { float s = ( size - 1.0 ) / size; return texture( lut, c * s + 0.5 / size ).rgb; }
`;function Ca(a,e){let t=1,s=0;for(;a>0;)t/=e,s+=t*(a%e),a=Math.floor(a/e);return s}function rl(a="halton16"){if(Array.isArray(a)){if(!a.length)throw new Error("[CameraHistory] empty jitter pattern");const s=new Float64Array(a.length*2);return a.forEach((i,r)=>{s[2*r]=+i[0],s[2*r+1]=+i[1]}),s}const e=a==="halton16"?16:a==="halton8"?8:0;if(!e)throw new Error(`[CameraHistory] unknown jitter pattern '${a}' ('halton16' | 'halton8' | [[x, y], ...])`);const t=new Float64Array(e*2);for(let s=0;s<e;s++)t[2*s]=Ca(s+1,2)-.5,t[2*s+1]=Ca(s+1,3)-.5;return t}class ol{constructor(e,{pattern:t="halton16",jitter:s=!0}={}){this.camera=e,this.jitter=!!s,this.frame=0,this._k=0,this.fresh=!0,this._reset=!0,this._applied=!1,this._ji=8,this._je0=0,this._je1=0,this._proj=new z,this._projInv=new z,this.setPattern(t),this.uniforms={uViewProj:{value:new z},uPrevViewProj:{value:new z},uInvViewProj:{value:new z},uUnjitteredProj:{value:new z},uReproj:{value:new z},uJitter:{value:new L},uPrevJitter:{value:new L},uFrame:{value:0}}}setPattern(e){this._seq=rl(e),this.pattern=e}get patternLength(){return this._seq.length>>1}reset(){this._reset=!0}begin(e,t){const s=this.camera,i=this.uniforms;this._applied&&this.end();const r=i.uViewProj.value,o=i.uPrevViewProj.value,n=i.uInvViewProj.value,A=this.fresh=this._reset;this._reset=!1,A&&(this._k=0),A||o.copy(r),i.uUnjitteredProj.value.copy(s.projectionMatrix),r.multiplyMatrices(s.projectionMatrix,s.matrixWorldInverse),n.multiplyMatrices(s.matrixWorld,s.projectionMatrixInverse),A&&o.copy(r),i.uReproj.value.multiplyMatrices(o,n),He.enginePrevViewProj.value.copy(o),He.engineUnjitteredProj.value.copy(s.projectionMatrix);const l=i.uJitter.value,h=this._seq,c=this._k++%(h.length>>1)*2;if(i.uPrevJitter.value.copy(l),this.jitter&&e>0&&t>0&&(h[c]!==0||h[c+1]!==0)){l.set(h[c],h[c+1]),this._proj.copy(s.projectionMatrix),this._projInv.copy(s.projectionMatrixInverse);const d=s.projectionMatrix.elements,f=l.x*2/e,u=l.y*2/t,g=this._ji=s.isOrthographicCamera?12:8;g===12?(d[12]-=f,d[13]-=u):(d[8]+=f,d[9]+=u),this._je0=d[g],this._je1=d[g+1],s.projectionMatrixInverse.copy(s.projectionMatrix).invert(),this._applied=!0}else l.set(0,0);i.uFrame.value=this.frame++}end(){if(!this._applied)return;this._applied=!1;const e=this.camera,t=e.projectionMatrix.elements,s=this._ji;t[s]!==this._je0||t[s+1]!==this._je1||(e.projectionMatrix.copy(this._proj),e.projectionMatrixInverse.copy(this._projInv))}}const nl=Math.PI/180,cr=(a,e,t)=>a<e?e:a>t?t:a,Al=(a,e,t)=>{const s=cr((t-a)/(e-a),0,1);return s*s*(3-2*s)},Ks=(a,e,t)=>a+(e-a)*t,Ds={uniforms:{tColor:{value:null},tDepth:{value:null},tAO:{value:null},tBloom:{value:null},tSky:{value:null},tAdapt:{value:null},uAE:{value:new Be(.3,.5,.7,2)},uHasAO:{value:1},uHasBloom:{value:1},uHasFog:{value:1},uProjInv:{value:new z},uCamWorld:{value:new z},uCamPos:{value:new b},uNear:{value:.1},uFar:{value:6e3},uAO:{value:.75},uFogA:{value:new Be(2e-4,1/700,0,.72)},uFogB:{value:new Be(1e-4,1/40,0,.02)},uSunDir:{value:new b(0,1,0)},uSunCol:{value:new T(1,1,1)},uSunScatter:{value:0},uExposure:{value:.9},uShadowTint:{value:new b},uHighTint:{value:new b},uWB:{value:new b(1,1,1)},uContrast:{value:.15},uSaturation:{value:1.05},uVignette:{value:.3},uCA:{value:.006},uGrain:{value:0},uTime:{value:0},uRes:{value:new L(1,1)},uDebug:{value:0},uFXAA:{value:0},uFogColor:{value:new T},tSSR:{value:null},tVolume:{value:null},uVolColor:{value:new T(0,0,0)},tLUT:{value:null},uLutSize:{value:2},uLutStrength:{value:1}},vertexShader:`
    uniform sampler2D tAdapt;
    uniform vec4 uAE;
    varying vec2 vUv;
    flat varying float vAE;
    void main() {
      vUv = uv;
      vAE = clamp( pow( uAE.x / exp2( textureLod( tAdapt, vec2( 0.5 ), 0.0 ).r ), uAE.y ), uAE.z, uAE.w );
      gl_Position = vec4( position.xy, 0.0, 1.0 );
    }`,fragmentShader:`
    uniform sampler2D tColor;
    uniform highp sampler2D tDepth;
    uniform sampler2D tAO;
    uniform sampler2D tBloom;
    #ifdef FOG_SKY
    uniform samplerCube tSky;
    #endif
    uniform vec3 uFogColor;
    uniform vec4 uAE;
    uniform float uHasAO, uHasBloom, uHasFog;
    uniform mat4 uProjInv, uCamWorld;
    uniform vec3 uCamPos;
    uniform float uNear, uFar, uAO;
    uniform vec4 uFogA, uFogB;
    uniform vec3 uSunDir, uSunCol;
    uniform float uSunScatter, uExposure;
    uniform vec3 uShadowTint, uHighTint, uWB;
    uniform float uContrast, uSaturation, uVignette, uCA, uGrain, uTime;
    uniform vec2 uRes;
    uniform int uDebug;
    uniform float uFXAA;
    varying vec2 vUv;
    flat varying float vAE;
    #ifdef FINAL_SSR
    uniform sampler2D tSSR;
    ${nr}
    #endif
    #ifdef FINAL_VOLUMETRIC
    uniform sampler2D tVolume;
    uniform vec3 uVolColor;
    #endif
    #ifdef FINAL_LUT
    uniform highp sampler3D tLUT;
    uniform float uLutSize, uLutStrength;
    ${al}
    #endif

    // ACES filmic, identical to three's ACESFilmicToneMapping / OutputPass
    vec3 RRTAndODTFit( vec3 v ) {
      vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
      vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
      return a / b;
    }
    vec3 acesFilmic( vec3 color ) {
      const mat3 ACESInputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
      const mat3 ACESOutputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
      color *= uExposure / 0.6;
      color = ACESInputMat * color;
      color = RRTAndODTFit( color );
      color = ACESOutputMat * color;
      return clamp( color, 0.0, 1.0 );
    }
    vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) ); }
    // FXAA (console-style, 9 taps) on the HDR input, used when the scene target is not multisampled.
    // Taps are blended in a compressed space (c / (1 + max(c))) so bright lights do not smear.
    vec3 fxC( vec3 c ) { return c / ( 1.0 + max( c.r, max( c.g, c.b ) ) ); }
    vec3 fxU( vec3 c ) { return c / max( 1e-4, 1.0 - max( c.r, max( c.g, c.b ) ) ); }
    float fxL( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }
    vec3 fxaa( vec2 uv ) {
      vec2 rcp = 1.0 / uRes;
      vec3 nw = fxC( texture2D( tColor, uv + vec2( -0.5, -0.5 ) * rcp ).rgb ), ne = fxC( texture2D( tColor, uv + vec2( 0.5, -0.5 ) * rcp ).rgb );
      vec3 sw = fxC( texture2D( tColor, uv + vec2( -0.5, 0.5 ) * rcp ).rgb ), se = fxC( texture2D( tColor, uv + vec2( 0.5, 0.5 ) * rcp ).rgb );
      vec3 m = fxC( texture2D( tColor, uv ).rgb );
      float lNW = fxL( nw ), lNE = fxL( ne ), lSW = fxL( sw ), lSE = fxL( se ), lM = fxL( m );
      float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) ), lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
      if ( lMax - lMin < max( 0.03, lMax * 0.1 ) ) return fxU( m ); // no edge
      vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );
      float red = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 1.0 / 128.0 );
      dir = clamp( dir / ( min( abs( dir.x ), abs( dir.y ) ) + red ), vec2( -8.0 ), vec2( 8.0 ) ) * rcp;
      vec3 a = 0.5 * ( fxC( texture2D( tColor, uv + dir * ( 1.0 / 3.0 - 0.5 ) ).rgb ) + fxC( texture2D( tColor, uv + dir * ( 2.0 / 3.0 - 0.5 ) ).rgb ) );
      vec3 b = a * 0.5 + 0.25 * ( fxC( texture2D( tColor, uv - dir * 0.5 ).rgb ) + fxC( texture2D( tColor, uv + dir * 0.5 ).rgb ) );
      float lB = fxL( b );
      return fxU( ( lB < lMin || lB > lMax ) ? a : b );
    }
    float hash12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }

    // AO at this pixel. AO_UPSAMPLE_DEPTH (ao.upsample 'depth'): joint bilateral upsample instead of the bilinear tap,
    // the four AO texels around the pixel weighted bilinearly and by how close their linear depth (g) is to the
    // pixel's own (the AO blur's tolerance), so AO computed at a lower resolution keeps crisp silhouettes: no dark
    // halo on the background behind an object, no light rim along its edge. Texels of another surface keep a 1e-3
    // weight, so a pixel that matches none of them (a pole thinner than an AO texel) gets the plain bilinear value.
    float aoAt( float depth ) {
    #ifdef AO_UPSAMPLE_DEPTH
      float z = uNear * uFar / ( uFar - ( uFar - uNear ) * depth ); // linear view depth (m), the g channel's units
      ivec2 mx = textureSize( tAO, 0 ) - 1;
      vec2 p = vUv * vec2( mx + 1 ) - 0.5, f = fract( p );
      ivec2 i = ivec2( floor( p ) );
      vec2 a = texelFetch( tAO, clamp( i, ivec2( 0 ), mx ), 0 ).rg;
      vec2 b = texelFetch( tAO, clamp( i + ivec2( 1, 0 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 c = texelFetch( tAO, clamp( i + ivec2( 0, 1 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 d = texelFetch( tAO, clamp( i + 1, ivec2( 0 ), mx ), 0 ).rg;
      vec4 w = vec4( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y )
             * max( vec4( 1e-3 ), 1.0 - abs( vec4( a.y, b.y, c.y, d.y ) - z ) / ( 0.06 * z + 0.15 ) );
      return dot( w, vec4( a.x, b.x, c.x, d.x ) ) / dot( w, vec4( 1.0 ) );
    #else
      return texture2D( tAO, vUv ).r;
    #endif
    }
    #ifdef FINAL_VOLUMETRIC
    // aoAt's AO_UPSAMPLE_DEPTH, for any RG buffer with r = value, g = linear view depth (m) of its texel
    float depthAwareUpsample( sampler2D t, float z ) {
      ivec2 mx = textureSize( t, 0 ) - 1;
      vec2 p = vUv * vec2( mx + 1 ) - 0.5, f = fract( p );
      ivec2 i = ivec2( floor( p ) );
      vec2 a = texelFetch( t, clamp( i, ivec2( 0 ), mx ), 0 ).rg;
      vec2 b = texelFetch( t, clamp( i + ivec2( 1, 0 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 c = texelFetch( t, clamp( i + ivec2( 0, 1 ), ivec2( 0 ), mx ), 0 ).rg;
      vec2 d = texelFetch( t, clamp( i + 1, ivec2( 0 ), mx ), 0 ).rg;
      vec4 w = vec4( ( 1.0 - f.x ) * ( 1.0 - f.y ), f.x * ( 1.0 - f.y ), ( 1.0 - f.x ) * f.y, f.x * f.y )
             * max( vec4( 1e-3 ), 1.0 - abs( vec4( a.y, b.y, c.y, d.y ) - z ) / ( 0.06 * z + 0.15 ) );
      return dot( w, vec4( a.x, b.x, c.x, d.x ) ) / dot( w, vec4( 1.0 ) );
    }
    // sun in-scatter of the volume pass at this pixel; sky pixels match the pass's sky texels (g = 60000 m)
    float volumeAt( float depth ) {
      return depthAwareUpsample( tVolume, depth < 1.0 ? uNear * uFar / ( uFar - ( uFar - uNear ) * depth ) : 60000.0 );
    }
    #endif

    #ifdef DEPTH_CLOSEST
    // Under TAA the colour is resolved over the jitter but the depth is this frame's jittered sample, so a silhouette
    // pixel would get AO / fog of the object one frame and of the background the next: take the closest depth of the
    // pixel and its 4 diagonals instead (the TAA pass's velocity choice), stable over the jitter sequence.
    float closestDepth() {
      ivec2 p = ivec2( gl_FragCoord.xy ), mx = textureSize( tDepth, 0 ) - 1;
      float d = texelFetch( tDepth, p, 0 ).x;
      d = min( d, texelFetch( tDepth, clamp( p + ivec2( - 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
      d = min( d, texelFetch( tDepth, clamp( p + ivec2( 1, - 1 ), ivec2( 0 ), mx ), 0 ).x );
      d = min( d, texelFetch( tDepth, clamp( p + ivec2( - 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
      return min( d, texelFetch( tDepth, clamp( p + ivec2( 1, 1 ), ivec2( 0 ), mx ), 0 ).x );
    }
    #endif

    // optical depth through an exponential layer (density d at height 0, falloff k) from y0 to y1 over dist
    float layer( float y0, float y1, float dist, float d, float k ) {
      float x = k * ( y1 - y0 );
      float f = abs( x ) > 1e-3 ? ( 1.0 - exp( -x ) ) / x : 1.0 - 0.5 * x;
      return d * exp( -k * clamp( y0, -100.0, 4000.0 ) ) * dist * f;
    }

    void main() {
    #ifdef DEPTH_CLOSEST
      float depth = closestDepth();
    #else
      float depth = texture2D( tDepth, vUv ).x;
    #endif
      vec2 dc = vUv - 0.5;
      vec2 ca = dc * dot( dc, dc ) * uCA;
      float dbgT = 1.0;
      vec3 col;
      if ( uFXAA > 0.5 ) col = fxaa( vUv );
      else if ( uCA != 0.0 ) col = vec3( texture2D( tColor, vUv - ca ).r, texture2D( tColor, vUv ).g, texture2D( tColor, vUv + ca ).b );
      else col = texture2D( tColor, vUv ).rgb; // uCA 0: the one texel all three taps would read
    #ifdef FINAL_SSR
      col = engineSsrComposite( col, texture2D( tSSR, vUv ) ); // reflections (TAA off; under TAA the TAA pass does it)
    #endif

      if ( depth < 1.0 ) {
        if ( uHasAO > 0.5 ) {
          float ao = aoAt( depth );
          float lum = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
          ao = mix( ao, 1.0, smoothstep( 2.0, 10.0, lum ) ); // emissives / hot highlights keep their energy
          col *= mix( 1.0, ao, uAO );
        }
        if ( uHasFog > 0.5 ) {
          vec4 vp = uProjInv * vec4( vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
          vp.xyz /= vp.w;
          vec3 wp = ( uCamWorld * vec4( vp.xyz, 1.0 ) ).xyz;
          vec3 rd = wp - uCamPos;
          float dist = length( rd );
          vec3 dir = rd / max( dist, 1e-3 );
          float tau = layer( uCamPos.y - uFogA.z, wp.y - uFogA.z, dist, uFogA.x, uFogA.y )
                    + layer( uCamPos.y - uFogB.z, wp.y - uFogB.z, dist, uFogB.x, uFogB.y );
          float T = exp( -tau ) * ( 1.0 - smoothstep( uFogA.w * uFar, 0.985 * uFar, dist ) );
          vec3 fd = normalize( vec3( dir.x, max( dir.y, uFogB.w ), dir.z ) );
        #ifdef FOG_SKY
          vec3 fogCol = textureCube( tSky, fd ).rgb;
        #else
          vec3 fogCol = uFogColor; // no sky cube (no atmosphere): the fogColor option
        #endif
          if ( uSunScatter != 0.0 ) fogCol += uSunCol * uSunScatter * pow( max( dot( dir, uSunDir ), 0.0 ), 10.0 ); // 0 at night, high sun
          col = col * T + fogCol * ( 1.0 - T );
          dbgT = T;
        }
      }
    #ifdef FINAL_VOLUMETRIC
      col += uVolColor * volumeAt( depth ); // volumetric sun in-scatter (sky pixels too: shafts against the sky)
    #endif
      if ( uHasBloom > 0.5 ) col += texture2D( tBloom, vUv ).rgb;
      if ( uAE.y > 0.0 ) col *= vAE;

      col = acesFilmic( col * uWB );
      // grading in display-linear space
      float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = max( mix( vec3( l ), col, uSaturation ), 0.0 );
      col += uShadowTint * ( 1.0 - smoothstep( 0.0, 0.45, l ) ) + uHighTint * smoothstep( 0.3, 1.0, l );
      vec3 p = sqrt( max( col, 0.0 ) );          // contrast S-curve in a perceptual space
      p = mix( p, p * p * ( 3.0 - 2.0 * p ), uContrast );
      col = p * p;
      vec2 vc = dc * vec2( uRes.x / uRes.y, 1.0 );
      col *= mix( 1.0, smoothstep( 1.05, 0.25, length( vc ) ), uVignette );
      vec3 o = toSRGB( clamp( col, 0.0, 1.0 ) );
    #ifdef FINAL_LUT
      o = mix( o, engineApplyLut( tLUT, o, uLutSize ), uLutStrength ); // creative 3D LUT on the display-referred colour
    #endif
      if ( uGrain > 0.0 ) o += ( hash12( vUv * uRes + fract( uTime * 7.31 ) * 913.0 ) - 0.5 ) * uGrain * ( 1.0 - 0.6 * l ); // film grain in display space
      o += ( hash12( vUv * uRes + 17.0 ) - 0.5 ) / 255.0; // dither: no banding in the sky gradients
      gl_FragColor = vec4( o, 1.0 );
      if ( uDebug == 1 ) gl_FragColor = vec4( vec3( aoAt( depth ) ), 1.0 );
      else if ( uDebug == 2 ) gl_FragColor = vec4( toSRGB( clamp( texture2D( tBloom, vUv ).rgb, 0.0, 1.0 ) ), 1.0 );
      else if ( uDebug == 3 ) gl_FragColor = vec4( vec3( dbgT ), 1.0 );
    #ifdef FINAL_VOLUMETRIC
      if ( uDebug == 4 ) gl_FragColor = vec4( toSRGB( clamp( uVolColor * volumeAt( depth ), 0.0, 1.0 ) ), 1.0 );
    #endif
      gl_FragDepth = depth; // the lens-flare overlay depth-tests against the scene
    }`};class ll extends he{constructor(e){super(),this.fx=e,this.needsSwap=!1,this.material=new ee({name:"PostFXFinal",uniforms:Fe.clone(Ds.uniforms),vertexShader:Ds.vertexShader,fragmentShader:Ds.fragmentShader,depthTest:!0,depthWrite:!0,depthFunc:bo,toneMapped:!1}),this._quad=new Ee(this.material),this._aoUp=!1,this._sky=!1,this._closest=!1,this._ssr=!1,this._vol=!1,this._lut=!1}setSize(e,t){this.material.uniforms.uRes.value.set(e,t)}render(e,t,s){const i=this.material.uniforms,r=this.fx,o=r.taaPass!==null&&r.taaPass.enabled,n=r.aoPass.upsample==="depth",A=r.atmo&&r.atmo.skyCube,l=!!A,h=o&&r.history.jitter&&r.taaOptions.stableDepth!==!1,c=r.ssrPass,d=c!==null&&c.enabled&&!o,f=r.volumetricPass,u=f!==null&&f.enabled,g=r.lutOptions,m=g.texture!==null;if(n!==this._aoUp||l!==this._sky||h!==this._closest||d!==this._ssr||u!==this._vol||m!==this._lut){this._aoUp=n,this._sky=l,this._closest=h,this._ssr=d,this._vol=u,this._lut=m;const p=this.material.defines;n?p.AO_UPSAMPLE_DEPTH=1:delete p.AO_UPSAMPLE_DEPTH,l?p.FOG_SKY=1:delete p.FOG_SKY,h?p.DEPTH_CLOSEST=1:delete p.DEPTH_CLOSEST,d?p.FINAL_SSR=1:delete p.FINAL_SSR,u?p.FINAL_VOLUMETRIC=1:delete p.FINAL_VOLUMETRIC,m?p.FINAL_LUT=1:delete p.FINAL_LUT,this.material.needsUpdate=!0}i.tColor.value=r._source(s).texture,i.tSSR.value=d?c.texture:null,i.tVolume.value=u?f.texture:null,i.tLUT.value=m?g.texture:null,m&&(i.uLutSize.value=g.size,i.uLutStrength.value=g.strength),i.tDepth.value=s.depthTexture,i.uHasAO.value=r.aoPass.enabled?1:0,i.tAO.value=r.aoPass.aoTexture,i.uHasBloom.value=r.bloomPass.enabled?1:0,i.tBloom.value=r.bloomPass.bloomTexture,i.uHasFog.value=(l||r.fogColor)&&r.fog?1:0,i.tSky.value=A,!l&&r.fogColor&&i.uFogColor.value.copy(r.fogColor),i.tAdapt.value=r.exposurePass.texture,i.uAE.value.y=r.exposurePass.enabled&&r.autoExposure&&r.grade?r.grade.aeS:0,e.setRenderTarget(this.renderToScreen?null:t),this._quad.render(e)}dispose(){this.material.dispose(),this._quad.dispose()}}class hl extends Zn{constructor(e,t,s){super(e,t),this.fx=s}render(e,t,s,i,r){const o=this.fx;if(o.gbuffer===null){this._render(e,t,s,i,r);return}o._rendererClear=e.clear,e.clear=o._gbClear;try{this.clear||(e.setRenderTarget(s),o._clearGBuffer()),this._render(e,t,s,i,r)}finally{e.clear=o._rendererClear}}_render(e,t,s,i,r){const o=this.clear&&!this.clearDepth&&this.overrideMaterial===null&&this.clearColor===null&&this.clearAlpha===null;if(!this.fx.lateClear||!o){super.render(e,t,s,i,r);return}const n=e.autoClear;e.autoClear=!0,e.setRenderTarget(this.renderToScreen?null:s),e.render(this.scene,this.camera),e.autoClear=n}}class cl extends RA{constructor(e,t){super(t),this.fx=e}render(e,t,s,i){super.render(e,t,this.fx._source(s),i)}}const ul=1,ur=2,Ia=3;class fl extends jA{constructor(e,t,s,i,r){super(t,s,i,r),this.fx=e}render(e,t,s,i,r){super.render(e,t,this.fx._source(s,ul),i,r)}}class gl extends il{constructor(e,t,s){super(t,s),this.fx=e}render(e,t,s,i,r){super.render(e,t,this.fx._source(s,ur),i,r)}}const Ba=["scene","exposure","ao","ssr","volumetric","taa","motionBlur","dof","bloom","final"],dl=["blend","clamp","gamma","sharpen","filter","historyFormat","stableDepth","reject","velocityFirst","snap"],et={ssr:ui,volumetric:{...lr,intensity:1},motionBlur:Ze,dof:hs},os=new Map;for(const a of dl)os.set(`taa.${a}`,{group:"taa",key:a});for(const a in et)for(const e in et[a])os.set(`${a}.${e}`,{group:a,key:e});const ml={ssr:{scale:[0,1,!0],maxPixels:[1,1/0],steps:[1,128,!1,!1,!0],refine:[0,16,!1,!1,!0],maxDistance:[0,1e5,!0],thickness:[0,1e5,!0],maxRoughness:[0,1,!0],edgeFade:[0,.5]},volumetric:{scale:[0,1,!0],maxPixels:[1,1/0],steps:[1,128,!1,!1,!0],maxDistance:[0,1/0,!0],g:[-1,1,!0,!0],density:[0,1/0],blend:[0,1,!1,!0],intensity:[0,1/0]},motionBlur:{strength:[0,1/0],maxBlur:[0,1/0,!0],tileSize:[1,128,!1,!1,!0],samples:[2,64,!1,!1,!0],shutter:[0,1/0]},dof:{focusDistance:[0,1/0,!0],focalLength:[0,1/0,!0],fStop:[0,1/0,!0],sensorHeight:[0,1/0,!0],maxCoC:[0,64,!0],scale:[0,1,!0],samples:[4,64,!1,!1,!0]}},pl=new Set(["steps","refine","samples","tileSize"]),Cl={ssr:"SSR marches the depth with the G-buffer normals and roughness",motionBlur:"motion blur reads the G-buffer velocity","ao.normals":"the AO reads the G-buffer normals"},Ea={ssr:{source:or}},va=["texture","size","strength","title","domainMin","domainMax"],Il=["auto","msaa","fxaa","taa"];function Ms(a={},e={},t={}){const s=a.aa??"auto",i=!!a.gbuffer,r=e.maxSamples??0,o=a.msaa??"auto";if(!Il.includes(s))throw new Error(`[PostFX] unknown aa '${s}' ('auto' | 'msaa' | 'fxaa' | 'taa')`);if(s==="taa"&&!i)throw new Error("[PostFX] aa 'taa' needs gbuffer: true (TAA reprojects with the G-buffer velocity and flags)");let n=0,A=!1,l=!1;return i?(A=s==="auto"||s==="taa",l=s==="msaa"):s==="auto"?n=o==="auto"?(a.darkness??0)>.35||(a.pixels??0)>(a.msaaMaxPixels??1/0)?0:r:Math.min(r,o|0):s==="msaa"&&(n=o==="auto"?r:Math.min(r,o|0),l=r===0),t.mode=A?"taa":n>0?"msaa":"fxaa",t.samples=n,t.fxaa=!A&&n===0,t.taa=A,t.forced=l,t}let wa=!1;const Bl=[{el:-40,wb:[.93,.98,1.08],aeK:.04,aeS:.45,aeMax:1.6,exp:1.35,bT:.85,bS:.85,bR:.62,sat:1,con:.14,split:.9,sh:[-.004,0,.012],hi:[.016,.006,-.008],vig:.38,grain:.022,ao:.6},{el:-8,wb:[.95,.98,1.07],aeK:.05,aeS:.45,aeMax:1.6,exp:1.3,bT:.95,bS:.75,bR:.6,sat:1.02,con:.14,split:.9,sh:[-.006,0,.016],hi:[.02,.008,-.01],vig:.36,grain:.016,ao:.65},{el:-3,wb:[1,.98,1.02],aeK:.09,aeS:.5,aeMax:1.9,exp:1.15,bT:1.3,bS:.55,bR:.55,sat:1.06,con:.15,split:1,sh:[-.008,.002,.018],hi:[.026,.01,-.012],vig:.34,grain:.008,ao:.7},{el:2,wb:[1.06,1,.92],aeK:.16,aeS:.5,aeMax:2,exp:.95,bT:2.2,bS:.32,bR:.5,sat:1.1,con:.17,split:1,sh:[-.01,.004,.018],hi:[.03,.012,-.016],vig:.32,grain:0,ao:.78},{el:10,wb:[1.045,1,.95],aeK:.19,aeS:.5,aeMax:2,exp:.92,bT:2.6,bS:.24,bR:.45,sat:1.08,con:.17,split:1,sh:[-.009,.004,.016],hi:[.026,.01,-.014],vig:.3,grain:0,ao:.8},{el:25,wb:[1.015,1,.985],aeK:.21,aeS:.5,aeMax:2,exp:.9,bT:2.9,bS:.2,bR:.4,sat:1.05,con:.16,split:.5,sh:[-.006,.002,.01],hi:[.012,.006,-.006],vig:.28,grain:0,ao:.8},{el:50,wb:[1,1,1],aeK:.22,aeS:.5,aeMax:2,exp:.88,bT:3,bS:.18,bR:.4,sat:1.04,con:.15,split:.35,sh:[-.004,.002,.008],hi:[.008,.005,-.004],vig:.26,grain:0,ao:.8},{el:90,wb:[1,1,1],aeK:.22,aeS:.5,aeMax:2,exp:.86,bT:3.1,bS:.17,bR:.4,sat:1.04,con:.15,split:.3,sh:[-.004,.002,.008],hi:[.008,.005,-.004],vig:.26,grain:0,ao:.8}];function El(a,e){let t=0;for(;t<a.length-2&&e>a[t+1].el;)t++;const s=a[t],i=a[t+1],r=Al(s.el,i.el,e),o={};for(const n in s)o[n]=Array.isArray(s[n])?s[n].map((A,l)=>Ks(A,i[n][l],r)):Ks(s[n],i[n],r);return o}class Dh{constructor(e,t,s,i={}){this.renderer=e,this.scene=t,this.camera=s,this.atmo=i.atmosphere||null;const r=e.getSize(new L);this.width=i.width??r.x,this.height=i.height??r.y,this.pixelRatio=i.pixelRatio??e.getPixelRatio(),this.enabled=!0,this.fog=i.fog??!0,this.exposureScale=1,this.autoExposure=i.autoExposure??!0,this.gradeKeys=i.grade||Bl,this.fogFarFade=i.fogFarFade??.72,this.fogMinSkyEl=i.fogMinSkyElevation??.02,this.fogColor=i.fogColor!=null?new T(i.fogColor):null,this.fogParams={haze:2e-4,hazeK:1/700,hazeBase:0,mist:1e-4,mistK:1/40,...i.fogParams||{}},this.maxSamples=Math.min(i.samples??4,e.capabilities.maxSamples||0),this.msaa=i.msaa??"auto",this.msaaMaxPixels=i.msaaMaxPixels??1/0,this.lateClear=i.lateClear??!0,this._compactHDR=i.compactHDR,this.aa=i.aa??"auto",this.taaOptions={blend:.9,clamp:"variance",gamma:1,sharpen:0,filter:"catmull-rom",historyFormat:"rgba16f",stableDepth:!1,reject:"quad",velocityFirst:!1,snap:!1};for(const l in i.taa||{})this._setTaaOption(l,i.taa[l]);this.jitter=i.jitter??!0,this.jitterPattern=i.jitterPattern??"halton16",this.timing=!!i.timing,this.timings={scene:0,exposure:0,ao:0,ssr:0,volumetric:0,taa:0,motionBlur:0,dof:0,bloom:0,final:0,flare:0,total:0},this._aaIn={aa:"auto",gbuffer:!1,msaa:"auto",msaaMaxPixels:1/0,darkness:0,pixels:0},this._aaCaps={maxSamples:this.maxSamples},this._aaOut=Ms({aa:this.aa,gbuffer:!!i.gbuffer},this._aaCaps),this.ssrOptions={...ui},this.volumetricOptions={...et.volumetric},this.motionBlurOptions={...Ze,strength:0},this.dofOptions={...hs},this.lutOptions={texture:null,size:0,strength:1},this._next=null,this._ssrOn=this._parseToggle("ssr",i.ssr),this._volOn=this._parseToggle("volumetric",i.volumetric),this._dofOn=this._parseToggle("dof",i.dof);const o=this._parseMotionBlur(i.motionBlur);if(this._aoNormals=Ge((i.ao&&i.ao.normals)??"depth",Hs,"ao.normals"),i.lut!=null&&i.lut!==!1&&this._setLut(i.lut),!i.gbuffer){if(this._ssrOn)throw ke("ssr");if(o.strength>0)throw ke("motionBlur");if(this._aoNormals==="gbuffer")throw ke("ao.normals")}if(this._volOn&&!this.atmo)throw _a();Object.assign(this.motionBlurOptions,o),this._warnedForced=!1,this.gbuffer=null,this.history=null,this.taaPass=null,this.ssrPass=null,this.volumetricPass=null,this.motionBlurPass=null,this.dofPass=null,this._tracked=[],this._trackOpts=[],this._trackedPools=[],this._spare=null,this._srcProxy={texture:null,depthTexture:null},this._rendererClear=null,this._gbClearing=!1,this._gbClear=(l=!0,h=!0,c=!0)=>{const d=this.renderer;this._rendererClear.call(d,l,h,c),l&&this.gbuffer!==null&&d.getRenderTarget()===this.gbuffer.target&&this._clearGBuffer()};const n=Math.max(1,Math.floor(this.width*this.pixelRatio)),A=Math.max(1,Math.floor(this.height*this.pixelRatio));this._W=n,this._H=A,this.composer=new $n(e,this._makeSceneTarget()),this.renderPass=new hl(t,s,this),this.exposurePass=new TA,this.aoPass=new bA(s,{radius:1.8,thickness:1.6,samples:12,resolutionScale:.5,maxPixels:6e5,upsample:"depth",compact:!0,...i.ao||{},normals:"depth"}),this.bloomPass=new cl(this,{strength:.3,radius:.45,threshold:2.8,resolutionScale:.5,...i.bloom||{}}),this.finalPass=new ll(this);for(const l of[this.renderPass,this.exposurePass,this.aoPass,this.bloomPass,this.finalPass])this.composer.addPass(l);this.uniforms=this.finalPass.material.uniforms,this._passKeys=new Map([[this.renderPass,"scene"],[this.exposurePass,"exposure"],[this.aoPass,"ao"],[this.bloomPass,"bloom"],[this.finalPass,"final"]]),this.composer.setPixelRatio(1),this.composer.setSize(n,A),i.gbuffer&&this._buildGBuffer(!0),this._syncPasses(),this.atmo&&(this.atmo.setFogMode("post"),this.atmo.setFlareScale&&this.atmo.setFlareScale(A)),this._ver=-1,this._time=0,this.setTimeOfDay(this.atmo?this.atmo.darkness:0)}get ao(){return this.aoPass}get bloom(){return this.bloomPass}set debug(e){this.uniforms.uDebug.value={ao:1,bloom:2,fog:3,volumetric:4}[e]||0}get debug(){return[null,"ao","bloom","fog","volumetric"][this.uniforms.uDebug.value]}get sceneDepth(){return this.composer.readBuffer.depthTexture}get colorSource(){return this._source(this.composer.readBuffer).texture}get ssr(){return this.ssrPass!==null}get volumetric(){return this.volumetricPass!==null}get motionBlur(){return this.motionBlurPass!==null?this.motionBlurOptions.strength:0}get dof(){return this.dofPass!==null?{...this.dofOptions}:null}get lut(){const e=this.lutOptions;return e.texture!==null?{texture:e.texture,size:e.size,strength:e.strength}:null}setSize(e,t,s=this.pixelRatio){this.width=e,this.height=t,this.pixelRatio=s;const i=Math.max(1,Math.floor(e*s)),r=Math.max(1,Math.floor(t*s));this._W=i,this._H=r,this.gbuffer&&this.gbuffer.setSize(i,r),this.composer.setSize(i,r),this.gbuffer&&this._bindGBuffer(),this._applyAA(this._aaDark),this.atmo&&this.atmo.setFlareScale&&this.atmo.setFlareScale(r)}setEnabled(e){const t=this.enabled;this.enabled=!!e,this.enabled&&!t&&this.history&&this.history.reset(),this.enabled&&!t&&this.volumetricPass&&this.volumetricPass.reset(),this.atmo&&this.atmo.setFogMode(this.enabled&&this.fog?"post":"scene")}setTimeOfDay(e=0){const t=this.atmo&&Number.isFinite(this.atmo.sunEl)?this.atmo.sunEl/nl:Ks(20,-20,cr(e,0,1)),s=this.grade=El(this.gradeKeys,t),i=this.uniforms;this.baseExposure=(this.renderer.toneMappingExposure||.9)/.9*s.exp,i.uSaturation.value=s.sat,i.uContrast.value=s.con,i.uShadowTint.value.set(s.sh[0]*s.split,s.sh[1]*s.split,s.sh[2]*s.split),i.uHighTint.value.set(s.hi[0]*s.split,s.hi[1]*s.split,s.hi[2]*s.split),i.uVignette.value=s.vig,i.uWB.value.set(s.wb[0],s.wb[1],s.wb[2]),i.uGrain.value=s.grain,i.uAO.value=s.ao,this._applyAA(e),i.uAE.value.set(s.aeK,this.autoExposure?s.aeS:0,.6,s.aeMax),this.exposurePass.reset(),this.bloomPass.threshold=s.bT,this.bloomPass.strength=s.bS,this.bloomPass.radius=s.bR,this.atmo&&(this._ver=this.atmo.version)}_applyAA(e=this.atmo?this.atmo.darkness:this._aaDark??0){this._aaDark=e;const t=this._aaIn;t.aa=this.aa,t.gbuffer=this.gbuffer!==null,t.msaa=this.msaa,t.msaaMaxPixels=this.msaaMaxPixels,t.darkness=e,t.pixels=this._W*this._H;const s=Ms(t,this._aaCaps,this._aaOut),i=s.samples;if(this.gbuffer===null)for(const r of[this.composer.renderTarget1,this.composer.renderTarget2])r.samples!==i&&(r.samples=i,r.dispose());this.uniforms.uFXAA.value=s.fxaa?1:0,this.taaPass&&(this.taaPass.enabled=s.taa),this._syncSsrJitter(),this.history&&(this.history.jitter=s.taa&&this.jitter),s.forced&&!this._warnedForced&&(this._warnedForced=!0,console.warn(`[PostFX] aa '${this.aa}' is unavailable ${this.gbuffer?"on the single-sampled G-buffer":"without MSAA support"}: using FXAA`))}setMSAA(e,t){this.msaa=e,t!==void 0&&(this.msaaMaxPixels=t??1/0),this.gbuffer===null&&(this.aa="auto"),this._applyAA()}setAA(e){return Ms({aa:e,gbuffer:this.gbuffer!==null},this._aaCaps),this.aa=e,this._applyAA(),this}setGBuffer(e){return e=!!e,e===(this.gbuffer!==null)?this:(this._buildGBuffer(e),this._applyAA(),this)}syncGBuffer(){return this.gbuffer&&this.gbuffer.sync(this.scene),this}track(e,t){if(!e)return 0;const s=this._tracked.indexOf(e);return s<0?(this._tracked.push(e),this._trackOpts.push(t)):this._trackOpts[s]=t,this.gbuffer?this.gbuffer.track(e,t):0}untrack(e){const t=this._tracked.indexOf(e);t>=0&&(this._tracked.splice(t,1),this._trackOpts.splice(t,1)),this.gbuffer&&this.gbuffer.untrack(e)}trackPool(e){e&&!this._trackedPools.includes(e)&&this._trackedPools.push(e),this.gbuffer&&this.gbuffer.trackPool(e)}untrackPool(e){const t=this._trackedPools.indexOf(e);t>=0&&this._trackedPools.splice(t,1),this.gbuffer&&this.gbuffer.untrackPool(e)}_setTaaOption(e,t){switch(e){case"blend":case"sharpen":case"gamma":if(typeof t!="number"||!Number.isFinite(t))throw new Error(`[PostFX] taa.${e}: expected a finite number, got ${t}`);break;case"clamp":Ge(t,qs,"taa.clamp");break;case"filter":Ge(t,Vs,"taa.filter");break;case"historyFormat":Ge(t,Js,"taa.historyFormat");break;case"reject":Ge(t,js,"taa.reject");break;case"stableDepth":case"velocityFirst":case"snap":t=!!t;break;default:throw new Error(`[PostFX] unknown taa option '${e}' (${Object.keys(this.taaOptions).join(", ")})`)}this.taaOptions[e]=t}set(e,t){switch(e){case"aa":return this.setAA(t);case"gbuffer":return this.setGBuffer(t);case"jitter":this.jitter=!!t,this._applyAA();break;case"ao.enabled":this.aoPass.enabled=!!t;break;case"ao.normals":if(Ge(t,Hs,"ao.normals"),t==="gbuffer"&&this.gbuffer===null)throw ke("ao.normals");this._aoNormals=t,this._syncAO();break;case"bloom.enabled":this.bloomPass.enabled=!!t;break;case"timing":this.timing=!!t;break;case"ssr":{const s=this._parseToggle("ssr",t,!0);if(s&&this.gbuffer===null)throw this._next=null,ke("ssr");this._ssrOn=s,this._commitToggle("ssr");break}case"volumetric":{const s=this._parseToggle("volumetric",t,!0);if(s&&!this.atmo)throw this._next=null,_a();this._volOn=s,this._commitToggle("volumetric");break}case"dof":this._dofOn=this._parseToggle("dof",t,!0),this._commitToggle("dof");break;case"motionBlur":if(typeof t=="number"){this._setOption("motionBlur","strength",t);break}{const s=this._parseMotionBlur(t);if(s.strength>0&&this.gbuffer===null)throw ke("motionBlur");this._next=s,this._commitToggle("motionBlur")}break;case"lut":this._setLut(t);break;case"lut.strength":if(typeof t!="number"||!Number.isFinite(t))throw new Error(`[PostFX] lut.strength: expected a finite number, got ${t}`);this.lutOptions.strength=t;break;default:{const s=os.get(e);if(s===void 0)throw new Error(`[PostFX] set: unknown path '${e}'`);if(s.group!=="taa"){this._setOption(s.group,s.key,t);break}this._setTaaOption(s.key,t),this.taaPass&&s.key!=="stableDepth"&&(this.taaPass[s.key]=this.taaOptions[s.key])}}return this}get(e){switch(e){case"aa":return this.aa;case"gbuffer":return this.gbuffer!==null;case"jitter":return this.jitter;case"timing":return this.timing;case"ao.enabled":return this.aoPass.enabled;case"ao.normals":return this._aoNormals;case"bloom.enabled":return this.bloomPass.enabled;case"ssr":return this.ssr;case"volumetric":return this.volumetric;case"motionBlur":return this.motionBlur;case"dof":return this.dof;case"lut":return this.lut;case"lut.strength":return this.lutOptions.strength;default:{const t=os.get(e);if(t===void 0)throw new Error(`[PostFX] get: unknown path '${e}'`);return this._options(t.group)[t.key]}}}_options(e){switch(e){case"taa":return this.taaOptions;case"ssr":return this.ssrOptions;case"volumetric":return this.volumetricOptions;case"motionBlur":return this.motionBlurOptions;default:return this.dofOptions}}_pass(e){switch(e){case"ssr":return this.ssrPass;case"volumetric":return this.volumetricPass;case"motionBlur":return this.motionBlurPass;case"dof":return this.dofPass;default:return null}}_setOption(e,t,s){const i=Wt(e,t,s);if(e==="dof"&&(t==="focusDistance"||t==="focalLength")){const A=this.dofOptions;xa(t==="focusDistance"?i:A.focusDistance,t==="focalLength"?i:A.focalLength)}const r=e==="motionBlur"&&t==="strength";if(r&&i>0&&this.gbuffer===null)throw ke("motionBlur");const o=this._pass(e),n=e==="ssr"&&t==="jitter";o!==null&&t!=="intensity"&&!(r&&i===0)&&!n&&this._applyOption(o,t,i),this._options(e)[t]=i,r&&this._syncPasses(),n&&this._syncSsrJitter()}_syncSsrJitter(){const e=this.ssrPass;if(e===null)return;const t=this.ssrOptions.jitter&&this.taaPass!==null&&this.taaPass.enabled;e.jitter!==t&&(e.jitter=t)}_applyAll(e,t,s){const i=e==="dof";if(i){const r=s.focalLength>=t.focalLength;r||this._applyOption(t,"focalLength",s.focalLength),this._applyOption(t,"focusDistance",s.focusDistance),r&&this._applyOption(t,"focalLength",s.focalLength)}for(const r in s)r==="intensity"||e==="ssr"&&r==="jitter"||i&&(r==="focusDistance"||r==="focalLength")||this._applyOption(t,r,s[r])}_replaceOptions(e,t){switch(e){case"ssr":this.ssrOptions=t;break;case"volumetric":this.volumetricOptions=t;break;case"motionBlur":this.motionBlurOptions=t;break;default:this.dofOptions=t}}_applyOption(e,t,s){e[t]!==s&&(e[t]=s)}_parseToggle(e,t,s=!1){const i=this._options(e);if(this._next=null,t==null||t===!1)return!1;if(t===!0)return!0;if(typeof t!="object"||Array.isArray(t))throw new Error(`[PostFX] ${e}: expected false | true | { ${Object.keys(et[e]).join(", ")} }, got ${_t(t)}`);const r={...et[e]};for(const o in t)r[o]=Wt(e,o,t[o]);return e==="dof"&&xa(r.focusDistance,r.focalLength),s?this._next=r:Object.assign(i,r),!0}_parseMotionBlur(e){if((e==null||e===!1)&&(e=0),typeof e=="number")return{...this.motionBlurOptions,strength:Wt("motionBlur","strength",e)};if(typeof e!="object"||Array.isArray(e))throw new Error(`[PostFX] motionBlur: expected 0 | strength | { ${Object.keys(Ze).join(", ")} }, got ${_t(e)}`);const t={...Ze};for(const s in e)t[s]=Wt("motionBlur",s,e[s]);return t}_commitToggle(e){const t=this._next,s=this._pass(e);if(this._next=null,t!==null){const i=e==="ssr"?this._ssrOn:e==="volumetric"?this._volOn:e==="dof"?this._dofOn:t.strength>0;if(s!==null&&i){const r=this._options(e);try{this._applyAll(e,s,t)}catch(o){try{this._applyAll(e,s,r)}catch{}throw o}}this._replaceOptions(e,t)}this._syncPasses()}_setLut(e){if(e==null||e===!1){this.lutOptions={texture:null,size:0,strength:1};return}if(typeof e!="object")throw new Error(`[PostFX] lut: expected null or { texture: Data3DTexture, size, strength }, got ${_t(e)}`);for(const o in e)if(!va.includes(o))throw new Error(`[PostFX] unknown lut option '${o}' (${va.join(", ")})`);const t=e.texture;if(!t||!t.isData3DTexture)throw new Error(`[PostFX] lut.texture: expected a THREE.Data3DTexture (the Assets 'lut' value), got ${t}`);const s=e.size??(t.image&&t.image.width);if(!Number.isInteger(s)||s<2||s>256)throw new Error(`[PostFX] lut.size: expected an integer in [2, 256], got ${s}`);const i=e.strength??1;if(typeof i!="number"||!Number.isFinite(i))throw new Error(`[PostFX] lut.strength: expected a finite number, got ${i}`);const r=(o,n)=>o!=null&&(!Array.isArray(o)||o.some(A=>A!==n));(r(e.domainMin,0)||r(e.domainMax,1))&&console.warn("[PostFX] lut: a domain other than 0..1 is not applied (inputs are display-space 0..1)"),this.lutOptions={texture:t,size:s,strength:i}}_syncPasses(){const e=this.gbuffer!==null;this._passOn("ssr",e&&this._ssrOn),this._passOn("volumetric",this._volOn),this._passOn("motionBlur",e&&this.motionBlurOptions.strength>0),this._passOn("dof",this._dofOn),this.taaPass!==null&&this.taaPass.ssr!==this.ssrPass&&(this.taaPass.ssr=this.ssrPass);const t=this.volumetricPass;t!==null&&t.history!==this.history&&(t.history=this.history),this._syncSsrJitter(),this._syncAO()}_syncAO(){const e=this.aoPass,t=this.gbuffer,s=t!==null?this._aoNormals:"depth";t!==null&&e.gbuffer!==t&&(e.gbuffer=t),(e.normals??"depth")!==s&&(e.normals=s),t===null&&e.gbuffer!=null&&(e.gbuffer=null)}_passOn(e,t){const s=this._pass(e);if(t===(s!==null))return;let i=null;if(t){switch(e){case"ssr":i=new kA(this.camera,this.history,this.gbuffer,{...this.ssrOptions,jitter:this.ssrOptions.jitter&&this.taaPass!==null&&this.taaPass.enabled});break;case"volumetric":{const r={...this.volumetricOptions};delete r.intensity,i=new UA(this.camera,this.history,this.atmo,r);break}case"motionBlur":i=new fl(this,this.camera,this.history,this.gbuffer,this.motionBlurOptions);break;default:i=new gl(this,this.camera,this.dofOptions)}this._placePass(i,e)}else this.composer.removePass(s),this._passKeys.delete(s),s.dispose();switch(e){case"ssr":this.ssrPass=i;break;case"volumetric":this.volumetricPass=i;break;case"motionBlur":this.motionBlurPass=i;break;default:this.dofPass=i}}_placePass(e,t){const s=this.composer,i=Ba.indexOf(t);let r=s.passes.length;for(let o=0;o<s.passes.length;o++)if(Ba.indexOf(this._passKeys.get(s.passes[o]))>i){r=o;break}s.insertPass(e,r),this._passKeys.set(e,t)}setAOResolution({scale:e,maxPixels:t,upsample:s}={}){const i=this.aoPass;return s!==void 0&&(i.upsample=s),i.setResolution(e??i.scale,t===void 0?i.maxPixels:t),{width:i.rtA.width,height:i.rtA.height}}_syncFrame(e){const t=this.atmo,s=this.uniforms,i=this.camera;if(t&&t.version!==this._ver&&this.setTimeOfDay(t.darkness),this._time+=e||0,s.uTime.value=this._time%1e3,s.uExposure.value=this.baseExposure*this.exposureScale,s.uProjInv.value.copy(i.projectionMatrixInverse),s.uCamWorld.value.copy(i.matrixWorld),s.uCamPos.value.setFromMatrixPosition(i.matrixWorld),s.uNear.value=i.near,s.uFar.value=i.far,t){const r=t.fogParams;s.uFogA.value.set(r.haze,r.hazeK,r.hazeBase||0,this.fogFarFade),s.uFogB.value.set(r.mist,r.mistK,0,this.fogMinSkyEl);const o=t.scatterColor||t.sunColor;s.uSunDir.value.copy(t.scatterDir||t.sunDir),s.uSunCol.value.copy(o);const n=this.volumetricPass;s.uSunScatter.value=n!==null&&n.enabled?0:r.sunScatter,n!==null&&s.uVolColor.value.copy(o).multiplyScalar((t.sun?t.sun.intensity:1)*this.volumetricOptions.intensity)}else{const r=this.fogParams;s.uFogA.value.set(r.haze,r.hazeK,r.hazeBase||0,this.fogFarFade),s.uFogB.value.set(r.mist,r.mistK,0,this.fogMinSkyEl),s.uSunScatter.value=0}}render(e){const t=this.renderer;if(!this.enabled){t.render(this.scene,this.camera),this.atmo&&this.atmo.renderFlare(t,this.camera);return}const s=this.timing,i=s?performance.now():0,r=this.history,o=this.gbuffer;this.camera.updateMatrixWorld(),o!==null&&this.composer.readBuffer!==o.target&&this._bindGBuffer(),r!==null&&r.begin(this._W,this._H),this._syncFrame(e);const n=t.info,A=n.autoReset;n.autoReset=!1,n.reset();try{s?this._renderTimed(e):this.composer.render(e)}finally{r!==null&&r.end()}if(o!==null&&o.endFrame(),this.atmo){const l=s?performance.now():0;this.atmo.renderFlare(t,this.camera),s&&(this.timings.flare=performance.now()-l)}n.autoReset=A,s&&(this.timings.total=performance.now()-i)}dispose(){this.composer.dispose(),this.aoPass.dispose(),this.bloomPass.dispose(),this.finalPass.dispose(),this.exposurePass.dispose(),this.taaPass&&this.taaPass.dispose();for(const e of[this.ssrPass,this.volumetricPass,this.motionBlurPass,this.dofPass])e&&e.dispose();this.gbuffer&&this.gbuffer.dispose(),this.atmo&&this.atmo.setFogMode("scene")}_renderTimed(e){const t=this.composer,s=this.renderer,i=this.timings,r=t.passes,o=this._passKeys;e===void 0&&(e=t.clock.getDelta());const n=s.getRenderTarget();for(let A=0;A<r.length;A++){const l=r[A],h=o.get(l);if(l.enabled===!1){h!==void 0&&(i[h]=0);continue}l.renderToScreen=t.renderToScreen&&t.isLastEnabledPass(A);const c=performance.now();l.render(s,t.writeBuffer,t.readBuffer,e,!1),l.needsSwap&&t.swapBuffers(),h!==void 0&&(i[h]=performance.now()-c)}this.taaPass===null&&(i.taa=0),this.ssrPass===null&&(i.ssr=0),this.volumetricPass===null&&(i.volumetric=0),this.motionBlurPass===null&&(i.motionBlur=0),this.dofPass===null&&(i.dof=0),s.setRenderTarget(n)}_makeSceneTarget(){const e=this._W,t=this._H,s=this.renderer,i=this.maxSamples,r=new ri(e,t,Ua),n=this._compactHDR!==!1&&s.extensions.has("EXT_color_buffer_float")?{format:it,type:Ft}:{type:H},A=new Y(e,t,{...n,samples:i,depthBuffer:!0,stencilBuffer:!1,depthTexture:r});return A.texture.name="PostFX.scene",A.texture.generateMipmaps=!1,A}_buildGBuffer(e){const t=this.composer,s=this._W,i=this._H;if(e){if(this.renderer.capabilities.reversedDepthBuffer)throw new Error("[PostFX] G-buffer / TAA need a standard depth buffer (reversedDepthBuffer is on)");if(!wa){if(ir()===!1)throw new Error("[PostFX] G-buffer: installGBufferChunks() failed (three.js shader chunks changed)");wa=!0}const r=new QA(this.renderer,{width:s,height:i});if(!r.supported)return r.dispose(),console.warn("[PostFX] G-buffer unavailable on this renderer: forward scene pass kept"),!1;this.gbuffer=r,r.sync(this.scene);for(let n=0;n<this._tracked.length;n++)r.track(this._tracked[n],this._trackOpts[n]);for(const n of this._trackedPools)r.trackPool(n);t.renderTarget1.dispose(),t.renderTarget2.dispose();const o=this._spare=new Y(s,i,{type:H,depthBuffer:!1,stencilBuffer:!1});o.texture.name="PostFX.spare",t.renderTarget1=t.writeBuffer=o,this._bindGBuffer(),this.history=new ol(this.camera,{pattern:this.jitterPattern,jitter:!1}),this.taaPass=new LA(this.camera,this.history,r,this.taaOptions),this.taaPass.enabled=!1,this._placePass(this.taaPass,"taa"),this._syncPasses()}else{t.removePass(this.taaPass),this._passKeys.delete(this.taaPass),this.taaPass.dispose(),this.taaPass=null,this.history=null;const r=this.gbuffer;this.gbuffer=null,this._syncPasses(),r.dispose(),this._spare.dispose(),this._spare=null;const o=this._makeSceneTarget();t.renderTarget1=t.writeBuffer=o,t.renderTarget2=t.readBuffer=o.clone(),t.renderTarget2.texture.name="EffectComposer.rt2",this.aa==="taa"&&(this.aa="auto")}}_bindGBuffer(){const e=this.composer;e.renderTarget2=e.readBuffer=this.gbuffer.target}_clearGBuffer(){if(!this._gbClearing){this._gbClearing=!0;try{this.gbuffer.clear(this.renderer)}finally{this._gbClearing=!1}}}_source(e,t=Ia){const s=this.dofPass,i=this.motionBlurPass,r=this.taaPass;let o=null;if(t>=Ia&&s!==null&&s.enabled?o=s.texture:t>=ur&&i!==null&&i.enabled?o=i.texture:r!==null&&r.enabled&&(o=r.texture),o===null)return e;const n=this._srcProxy;return n.texture=o,n.depthTexture=e.depthTexture,n}}function Wt(a,e,t){const s=et[a];if(!Object.prototype.hasOwnProperty.call(s,e))throw new Error(`[PostFX] unknown ${a} option '${e}' (${Object.keys(s).join(", ")})`);const i=s[e];if(typeof i=="boolean")return!!t;if(typeof i=="string"){const c=Ea[a]&&Ea[a][e];if(c)return Ge(t,c,`${a}.${e}`);if(typeof t!="string")throw new Error(`[PostFX] ${a}.${e}: expected a string, got ${t}`);return t}e==="maxPixels"&&t===null&&(t=1/0);const r=ml[a][e];if(typeof t!="number"||!(Number.isFinite(t)||t===1/0&&e==="maxPixels"))throw new Error(`[PostFX] ${a}.${e}: expected a ${e==="maxPixels"?"number (Infinity / null: no budget)":"finite number"}, got ${_t(t)}`);const o=r?r[0]:0,n=r?r[1]:1/0,A=!!(r&&r[2]),l=!!(r&&r[3]),h=r?!!r[4]:pl.has(e);if((A?t<=o:t<o)||(l?t>=n:t>n)||h&&!Number.isInteger(t))throw new Error(`[PostFX] ${a}.${e}: expected ${h?"an integer":"a number"} in ${A?"(":"["}${o}, ${n}${l?")":"]"}, got ${_t(t)}`);return t}const _t=a=>typeof a=="string"?`'${a}'`:String(a);function xa(a,e){if(!(a*1e3>e))throw new Error(`[PostFX] dof.focusDistance (${a} m) must exceed dof.focalLength (${e} mm) / 1000`)}function ke(a){const e=a==="ao.normals"?"ao.normals 'gbuffer'":a;return new Error(`[PostFX] ${e} needs gbuffer: true (${Cl[a]})`)}function _a(){return new Error("[PostFX] volumetric needs an atmosphere (the sun direction, colour and shadow cascades it marches)")}function Ge(a,e,t){if(!e.includes(a))throw new Error(`[PostFX] ${t}: unknown value '${a}' (${e.map(s=>`'${s}'`).join(" | ")})`);return a}class vl{constructor(e=4){this.pool=e,this.queue=[],this.workers=[],this.workersResolve=[],this.workerStatus=0,this.workerCreator=null}_initWorker(e){if(!this.workers[e]){const t=this.workerCreator();t.addEventListener("message",this._onMessage.bind(this,e)),this.workers[e]=t}}_getIdleWorker(){for(let e=0;e<this.pool;e++)if(!(this.workerStatus&1<<e))return e;return-1}_onMessage(e,t){const s=this.workersResolve[e];if(s&&s(t),this.queue.length){const{resolve:i,msg:r,transfer:o}=this.queue.shift();this.workersResolve[e]=i,this.workers[e].postMessage(r,o)}else this.workerStatus^=1<<e}setWorkerCreator(e){this.workerCreator=e}setWorkerLimit(e){this.pool=e}postMessage(e,t){return new Promise(s=>{const i=this._getIdleWorker();i!==-1?(this._initWorker(i),this.workerStatus|=1<<i,this.workersResolve[i]=s,this.workers[i].postMessage(e,t)):this.queue.push({resolve:s,msg:e,transfer:t})})}dispose(){this.workers.forEach(e=>e.terminate()),this.workersResolve.length=0,this.workers.length=0,this.queue.length=0,this.workerStatus=0}}const wl=0,ya=2,xl=1,Qa=2,_l=0,yl=1,Ql=10,Sl=0,fr=9,gr=15,dr=16,mr=22,pr=37,Cr=43,Ir=76,Br=83,Er=97,vr=100,wr=103,xr=109,_r=122,yr=123,Qr=131,Sr=132,br=133,Dr=134,Mr=137,Fr=138,Rr=139,Tr=140,kr=141,Pr=142,Gr=145,Lr=146,Nr=148,Ur=152,Or=157,zr=158,Hr=165,qr=166,Vr=1000054e3,Jr=1000054001,jr=1000054004,Kr=1000054005,gi=1000066e3,Yr=1000066004;class ct{constructor(e,t,s,i){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(e.buffer,e.byteOffset+t,s),this._littleEndian=i,this._offset=0}_nextUint8(){const e=this._dataView.getUint8(this._offset);return this._offset+=1,e}_nextUint16(){const e=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,e}_nextUint32(){const e=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint64(){const e=this._dataView.getUint32(this._offset,this._littleEndian)+4294967296*this._dataView.getUint32(this._offset+4,this._littleEndian);return this._offset+=8,e}_nextInt32(){const e=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint8Array(e){const t=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,e);return this._offset+=e,t}_skip(e){return this._offset+=e,this}_scan(e,t=0){const s=this._offset;let i=0;for(;this._dataView.getUint8(this._offset)!==t&&i<e;)i++,this._offset++;return i<e&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+s,i)}}const se=[171,75,84,88,32,50,48,187,13,10,26,10];function Sa(a){return new TextDecoder().decode(a)}function bl(a){const e=new Uint8Array(a.buffer,a.byteOffset,se.length);if(e[0]!==se[0]||e[1]!==se[1]||e[2]!==se[2]||e[3]!==se[3]||e[4]!==se[4]||e[5]!==se[5]||e[6]!==se[6]||e[7]!==se[7]||e[8]!==se[8]||e[9]!==se[9]||e[10]!==se[10]||e[11]!==se[11])throw new Error("Missing KTX 2.0 identifier.");const t={vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null},s=17*Uint32Array.BYTES_PER_ELEMENT,i=new ct(a,se.length,s,!0);t.vkFormat=i._nextUint32(),t.typeSize=i._nextUint32(),t.pixelWidth=i._nextUint32(),t.pixelHeight=i._nextUint32(),t.pixelDepth=i._nextUint32(),t.layerCount=i._nextUint32(),t.faceCount=i._nextUint32(),t.levelCount=i._nextUint32(),t.supercompressionScheme=i._nextUint32();const r=i._nextUint32(),o=i._nextUint32(),n=i._nextUint32(),A=i._nextUint32(),l=i._nextUint64(),h=i._nextUint64(),c=3*Math.max(t.levelCount,1)*8,d=new ct(a,se.length+s,c,!0);for(let k=0,R=Math.max(t.levelCount,1);k<R;k++)t.levels.push({levelData:new Uint8Array(a.buffer,a.byteOffset+d._nextUint64(),d._nextUint64()),uncompressedByteLength:d._nextUint64()});const f=new ct(a,r,o,!0);f._skip(4);const u=f._nextUint16(),g=f._nextUint16(),m=f._nextUint16(),p=f._nextUint16(),C={vendorId:u,descriptorType:g,versionNumber:m,colorModel:f._nextUint8(),colorPrimaries:f._nextUint8(),transferFunction:f._nextUint8(),flags:f._nextUint8(),texelBlockDimension:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],bytesPlane:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],samples:[]},B=(p/4-6)/4;for(let k=0;k<B;k++){const R={bitOffset:f._nextUint16(),bitLength:f._nextUint8(),channelType:f._nextUint8(),samplePosition:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};64&R.channelType?(R.sampleLower=f._nextInt32(),R.sampleUpper=f._nextInt32()):(R.sampleLower=f._nextUint32(),R.sampleUpper=f._nextUint32()),C.samples[k]=R}t.dataFormatDescriptor.length=0,t.dataFormatDescriptor.push(C);const I=new ct(a,n,A,!0);for(;I._offset<A;){const k=I._nextUint32(),R=I._scan(k),J=Sa(R);if(t.keyValue[J]=I._nextUint8Array(k-R.byteLength-1),J.match(/^ktx/i)){const M=Sa(t.keyValue[J]);t.keyValue[J]=M.substring(0,M.lastIndexOf("\0"))}I._skip(k%4?4-k%4:0)}if(h<=0)return t;const E=new ct(a,l,h,!0),v=E._nextUint16(),x=E._nextUint16(),_=E._nextUint32(),y=E._nextUint32(),D=E._nextUint32(),q=E._nextUint32(),$=[];for(let k=0,R=Math.max(t.levelCount,1);k<R;k++)$.push({imageFlags:E._nextUint32(),rgbSliceByteOffset:E._nextUint32(),rgbSliceByteLength:E._nextUint32(),alphaSliceByteOffset:E._nextUint32(),alphaSliceByteLength:E._nextUint32()});const w=l+E._offset,S=w+_,F=S+y,P=F+D,Q=new Uint8Array(a.buffer,a.byteOffset+w,_),G=new Uint8Array(a.buffer,a.byteOffset+S,y),V=new Uint8Array(a.buffer,a.byteOffset+F,D),ae=new Uint8Array(a.buffer,a.byteOffset+P,q);return t.globalData={endpointCount:v,selectorCount:x,imageDescs:$,endpointsData:Q,selectorsData:G,tablesData:V,extendedData:ae},t}let Fs,xe,Ys;const Rs={env:{emscripten_notify_memory_growth:function(a){Ys=new Uint8Array(xe.exports.memory.buffer)}}};class Dl{init(){return Fs||(Fs=typeof fetch<"u"?fetch("data:application/wasm;base64,"+ba).then(e=>e.arrayBuffer()).then(e=>WebAssembly.instantiate(e,Rs)).then(this._init):WebAssembly.instantiate(Buffer.from(ba,"base64"),Rs).then(this._init),Fs)}_init(e){xe=e.instance,Rs.env.emscripten_notify_memory_growth(0)}decode(e,t=0){if(!xe)throw new Error("ZSTDDecoder: Await .init() before decoding.");const s=e.byteLength,i=xe.exports.malloc(s);Ys.set(e,i),t=t||Number(xe.exports.ZSTD_findDecompressedSize(i,s));const r=xe.exports.malloc(t),o=xe.exports.ZSTD_decompress(r,t,i,s),n=Ys.slice(r,r+o);return xe.exports.free(i),xe.exports.free(r),n}}const ba="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IAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAACy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAIajYCACADCy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAFajYCACADCx8AIAAgASACKAIEEAg2AgAgARAEGiAAIAJBCGo2AgQLCAAgAGdBH3MLugUBDX8jAEEQayIKJAACfyAEQQNNBEAgCkEANgIMIApBDGogAyAEEAsaIAAgASACIApBDGpBBBAVIgBBbCAAEAMbIAAgACAESxsMAQsgAEEAIAEoAgBBAXRBAmoQECENQVQgAygAACIGQQ9xIgBBCksNABogAiAAQQVqNgIAIAMgBGoiAkF8aiEMIAJBeWohDiACQXtqIRAgAEEGaiELQQQh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ASIDNgLE4AEgACgCvOABIQQgACABNgK84AEgACABIAJqNgK44AEgACABIAQgA2tqNgLA4AELpgEBAX8gACAAKALs4QEQFjYCyOABIABCADcD+OABIABCADcDuOABIABBwOABakIANwMAIABBqNAAaiIBQYyAgOAANgIAIABBADYCmOIBIABCADcDiOEBIABCAzcDgOEBIABBrNABakHgEikCADcCACAAQbTQAWpB6BIoAgA2AgAgACABNgIMIAAgAEGYIGo2AgggACAAQaAwajYCBCAAIABBEGo2AgALYQEBf0G4fyEDAkAgAUEDSQ0AIAIgABAhIgFBA3YiADYCCCACIAFBAXE2AgQgAiABQQF2QQNxIgM2AgACQCADQX9qIgFBAksNAAJAIAFBAWsOAgEAAgtBbA8LIAAhAwsgAwsMACAAIAEgAkEAEC4LiAQCA38CfiADEBYhBCAAQQBBKBAQIQAgBCACSwRAIAQPCyABRQRAQX8PCwJAAkAgA0EBRg0AIAEoAAAiBkGo6r5pRg0AQXYhAyAGQXBxQdDUtMIBRw0BQQghAyACQQhJDQEgAEEAQSgQECEAIAEoAAQhASAAQQE2AhQgACABrTcDAEEADwsgASACIAMQLyIDIAJLDQAgACADNgIYQXIhAyABIARqIgVBf2otAAAiAkEIcQ0AIAJBIHEiBkUEQEFwIQMgBS0AACIFQacBSw0BIAVBB3GtQgEgBUEDdkEKaq2GIgdCA4h+IAd8IQggBEEBaiEECyACQQZ2IQMgAkECdiEFAkAgAkEDcUF/aiICQQJLBEBBACECDAELAkACQAJAIAJBAWsOAgECAAsgASAEai0AACECIARBAWohBAwCCyABIARqLwAAIQIgBEECaiEEDAELIAEgBGooAAAhAiAEQQRqIQQLIAVBAXEhBQJ+AkACQAJAIANBf2oiA0ECTQRAIANBAWsOAgIDAQtCfyAGRQ0DGiABIARqMQAADAMLIAEgBGovAACtQoACfAwCCyABIARqKAAArQwBCyABIARqKQAACyEHIAAgBTYCICAAIAI2AhwgACAHNwMAQQAhAyAAQQA2AhQgACAHIAggBhsiBzcDCCAAIAdCgIAIIAdCgIAIVBs+AhALIAMLWwEBf0G4fyEDIAIQFiICIAFNBH8gACACakF/ai0AACIAQQNxQQJ0QaAeaigC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C0Egak8NAQsgByAHKQNoNwMQIAcgBykDYDcDCCAEIA0gB0EIaiAHQdwAaiAPIA4gESAQEB4hCwwBCyACIARqIQggBCAKEAcgAkERTwRAIARBEGohAgNAIAIgCkEQaiIKEAcgAkEQaiICIAhJDQALCyAIIAlrIQIgByATNgJcIAkgCCAOa0sEQCAJIAggEWtLBEBBbCELDAILIBAgAiAOayICaiIKIANqIBBNBEAgCCAKIAMQDxoMAgsgCCAKQQAgAmsQDyEIIAcgAiADaiIDNgJkIAggAmshCCAOIQILIAlBEE8EQCADIAhqIQMDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALDAELAkAgCUEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgCUECdCIDQcAeaigCAGoiAhAXIAIgA0HgHmooAgBrIQIgBygCZCEDDAELIAggAhAMCyADQQlJDQAgAyAIaiEDIAhBCGoiCCACQQhqIgJrQQ9MBEADQCAIIAIQDCACQQhqIQIgCEEIaiIIIANJDQAMAgALAAsDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALCyAHQRhqEAQaIAsgDCALEAMiAhshDCAEIAQgC2ogAhshBCAFQX9qIgUNAAsgDBADDQFBbCEMIAdBGGoQBEECSQ0BQQAhCANAIAhBA0cEQCAAIAhBAnQiAmpBrNABaiACIAdqKAJENgIAIAhBAWohCAwBCwsgBygCXCEIC0G6fyEMIA8gCGsiACANIARrSw0AIAQEfyAEIAggABALIABqBUEACyABayEMCyAHQfAAaiQAIAwLkRcCFn8FfiMAQdABayIHJAAgByAAKALw4QEiCDYCvAEgASACaiESIAggACgCgOIBaiETAkACQCAFRQRAIAEhAwwBCyAAKALE4AEhESAAKALA4AEhFSAAKAK84AEhDyAAQQE2AozhAUEAIQgDQCAIQQNHBEAgByAIQQJ0IgJqIAAgAmpBrNABaigCADYCVCAIQQFqIQgMAQsLIAcgETYCZCAHIA82AmAgByABIA9rNgJoQWwhECAHQShqIAMgBBAGEAMNASAFQQQgBUEESBshFyAHQTxqIAdBKGogACgCABATIAdBxABqIAdBKGogACgCCBATIAdBzABqIAdB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IAdB0AFqJAAgEAslACAAQgA3AgAgAEEAOwEIIABBADoACyAAIAE2AgwgACACOgAKC7QFAQN/IwBBMGsiBCQAIABB/wFqIgVBfWohBgJAIAMvAQIEQCAEQRhqIAEgAhAGIgIQAw0BIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahASOgAAIAMgBEEIaiAEQRhqEBI6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0FIAEgBEEQaiAEQRhqEBI6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBSABIARBCGogBEEYahASOgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEjoAACABIAJqIABrIQIMAwsgAyAEQRBqIARBGGoQEjoAAiADIARBCGogBEEYahASOgADIANBBGohAwwAAAsACyAEQRhqIAEgAhAGIgIQAw0AIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahAROgAAIAMgBEEIaiAEQRhqEBE6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0EIAEgBEEQaiAEQRhqEBE6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBCABIARBCGogBEEYahAROgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEToAACABIAJqIABrIQIMAgsgAyAEQRBqIARBGGoQEToAAiADIARBCGogBEEYahAROgADIANBBGohAwwAAAsACyAEQTBqJAAgAgtpAQF/An8CQAJAIAJBB00NACABKAAAQbfIwuF+Rw0AIAAgASgABDYCmOIBQWIgAEEQaiABIAIQPiIDEAMNAhogAEKBgICAEDcDiOEBIAAgASADaiACIANrECoMAQsgACABIAIQKgtBAAsLrQMBBn8jAEGAAWsiAyQAQWIhCAJAIAJBCUkNACAAQZjQAGogAUEIaiIEIAJBeGogAEGY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wOABCwutAgIEfwF+IwBBQGoiBCQAAkACQCACQQhJDQAgASgAAEFwcUHQ1LTCAUcNACABIAIQIiEBIABCADcDCCAAQQA2AgQgACABNgIADAELIARBGGogASACEC0iAxADBEAgACADEBoMAQsgAwRAIABBuH8QGgwBCyACIAQoAjAiA2shAiABIANqIQMDQAJAIAAgAyACIARBCGoQLCIFEAMEfyAFBSACIAVBA2oiBU8NAUG4fwsQGgwCCyAGQQFqIQYgAiAFayECIAMgBWohAyAEKAIMRQ0ACyAEKAI4BEAgAkEDTQRAIABBuH8QGgwCCyADQQRqIQMLIAQoAighAiAEKQMYIQcgAEEANgIEIAAgAyABazYCACAAIAIgBmytIAcgB0J/URs3AwgLIARBQGskAAslAQF/IwBBEGsiAiQAIAIgACABEFEgAigCACEAIAJBEGokACAAC30BBH8jAEGQBGsiBCQAIARB/wE2AggCQCAEQRBqIARBCGogBEEMaiABIAIQFSIGEAMEQCAGIQUMAQtBVCEFIAQoAgwiB0EGSw0AIAMgBEEQaiAEKAIIIAcQQSIFEAMNACAAIAEgBmogAiAGayADEDwhBQsgBEGQBGokACAFC4cBAgJ/An5BABAWIQMCQANAIAEgA08EQAJAIAAoAABBcHFB0NS0wgFGBEAgACABECIiAhADRQ0BQn4PCyAAIAEQVSIEQn1WDQMgBCAFfCIFIARUIQJCfiEEIAINAyAAIAEQUiICEAMNAwsgASACayEBIAAgAmohAAwBCwtCfiAFIAEbIQQLIAQLPwIBfwF+IwBBMGsiAiQAAn5CfiACQQhqIAAgARAtDQAaQgAgAigCHEEBRg0AGiACKQMICyEDIAJBMGokACADC40BAQJ/IwBBMGsiASQAAkAgAEUNACAAKAKI4gENACABIABB/OEBaigCADYCKCABIAApAvThATcDICAAEDAgACgCqOIBIQIgASABKAIoNgIYIAEgASkDIDcDECACIAFBEGoQGyAAQQA2AqjiASABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALKgECfyMAQRBrIgAkACAAQQA2AgggAEIANwMAIAAQWCEBIABBEGokACABC4cBAQN/IwBBEGsiAiQAAkAgACgCAEUgACgCBEVzDQAgAiAAKAIINgIIIAIgACkCADcDAAJ/IAIoAgAiAQRAIAIoAghBqOMJIAERBQAMAQtBqOMJECgLIgFFDQAgASAAKQIANwL04QEgAUH84QFqIAAoAgg2AgAgARBZIAEhAwsgAkEQaiQAIAMLywEBAn8jAEEgayIBJAAgAEGBgIDAADYCtOIBIABBADYCiOIBIABBADYC7OEBIABCADcDkOIBIABBADYCpOMJIABBADYC3OIBIABCADcCzOIBIABBADYCvOIBIABBADYCxOABIABCADcCnOIBIABBpOIBakIANwIAIABBrOIBakEANgIAIAFCADcCECABQgA3AhggASABKQMYNwMIIAEgASkDEDcDACABKAIIQQh2QQFxIQIgAEEANgLg4gEgACACNgKM4gEgAUEgaiQAC3YBA38jAEEwayIBJAAgAARAIAEgAEHE0AFqIgIoAgA2AiggASAAKQK80AE3AyAgACgCACEDIAEgAigCADYCGCABIAApArzQATcDECADIAFBEGoQGyABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALzAEBAX8gACABKAK00AE2ApjiASAAIAEoAgQiAjYCwOABIAAgAjYCvOABIAAgAiABKAIIaiICNgK44AEgACACNgLE4AEgASgCuNABBEAgAEKBgICAEDcDiOEBIAAgAUGk0ABqNgIMIAAgAUGUIGo2AgggACABQZwwajYCBCAAIAFBDGo2AgAgAEGs0AFqIAFBqNABaigCADYCACAAQbDQAWogAUGs0AFqKAIANgIAIABBtNABaiABQbDQAWooAgA2AgAPCyAAQgA3A4jhAQs7ACACRQRAQbp/DwsgBEUEQEFsDwsgAiAEEGAEQCAAIAEgAiADIAQgBRBhDwsgACABIAIgAyAEIAUQZQtGAQF/IwBBEGsiBSQAIAVBCGogBBAOAn8gBS0ACQRAIAAgASACIAMgBBAyDAELIAAgASACIAMgBBA0CyEAIAVBEGokACAACzQAIAAgAyAEIAUQNiIFEAMEQCAFDwsgBSAESQR/IAEgAiADIAVqIAQgBWsgABA1BUG4fwsLRgEBfyMAQRBrIgUkACAFQQhqIAQQDgJ/IAUtAAkEQCAAIAEgAiADIAQQYgwBCyAAIAEgAiADIAQQNQshACAFQRBqJAAgAAtZAQF/QQ8hAiABIABJBEAgAUEE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",Ml="display-p3",Fl="display-p3-linear";({...Do.spaces[qe]});const Ts=new WeakMap;let ks=0,Ps;class ue extends Mo{constructor(e){super(e),this.transcoderPath="",this.transcoderBinary=null,this.transcoderPending=null,this.workerPool=new vl,this.workerSourceURL="",this.workerConfig=null,typeof MSC_TRANSCODER<"u"&&console.warn('THREE.KTX2Loader: Please update to latest "basis_transcoder". "msc_basis_transcoder" is no longer supported in three.js r125+.')}setTranscoderPath(e){return this.transcoderPath=e,this}setWorkerLimit(e){return this.workerPool.setWorkerLimit(e),this}async detectSupportAsync(e){return this.workerConfig={astcSupported:await e.hasFeatureAsync("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:await e.hasFeatureAsync("texture-compression-etc2"),etc2Supported:await e.hasFeatureAsync("texture-compression-etc2"),dxtSupported:await e.hasFeatureAsync("texture-compression-bc"),bptcSupported:await e.hasFeatureAsync("texture-compression-bc"),pvrtcSupported:await e.hasFeatureAsync("texture-compression-pvrtc")},this}detectSupport(e){return e.isWebGPURenderer===!0?this.workerConfig={astcSupported:e.hasFeature("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:e.hasFeature("texture-compression-etc2"),etc2Supported:e.hasFeature("texture-compression-etc2"),dxtSupported:e.hasFeature("texture-compression-bc"),bptcSupported:e.hasFeature("texture-compression-bc"),pvrtcSupported:e.hasFeature("texture-compression-pvrtc")}:this.workerConfig={astcSupported:e.extensions.has("WEBGL_compressed_texture_astc"),astcHDRSupported:e.extensions.has("WEBGL_compressed_texture_astc")&&e.extensions.get("WEBGL_compressed_texture_astc").getSupportedProfiles().includes("hdr"),etc1Supported:e.extensions.has("WEBGL_compressed_texture_etc1"),etc2Supported:e.extensions.has("WEBGL_compressed_texture_etc"),dxtSupported:e.extensions.has("WEBGL_compressed_texture_s3tc"),bptcSupported:e.extensions.has("EXT_texture_compression_bptc"),pvrtcSupported:e.extensions.has("WEBGL_compressed_texture_pvrtc")||e.extensions.has("WEBKIT_WEBGL_compressed_texture_pvrtc")},this}init(){if(!this.transcoderPending){const e=new ds(this.manager);e.setPath(this.transcoderPath),e.setWithCredentials(this.withCredentials);const t=e.loadAsync("basis_transcoder.js"),s=new ds(this.manager);s.setPath(this.transcoderPath),s.setResponseType("arraybuffer"),s.setWithCredentials(this.withCredentials);const i=s.loadAsync("basis_transcoder.wasm");this.transcoderPending=Promise.all([t,i]).then(([r,o])=>{const n=ue.BasisWorker.toString(),A=["/* constants */","let _EngineFormat = "+JSON.stringify(ue.EngineFormat),"let _EngineType = "+JSON.stringify(ue.EngineType),"let _TranscoderFormat = "+JSON.stringify(ue.TranscoderFormat),"let _BasisFormat = "+JSON.stringify(ue.BasisFormat),"/* basis_transcoder.js */",r,"/* worker */",n.substring(n.indexOf("{")+1,n.lastIndexOf("}"))].join(`
`);this.workerSourceURL=URL.createObjectURL(new Blob([A])),this.transcoderBinary=o,this.workerPool.setWorkerCreator(()=>{const l=new Worker(this.workerSourceURL),h=this.transcoderBinary.slice(0);return l.postMessage({type:"init",config:this.workerConfig,transcoderBinary:h},[h]),l})}),ks>0&&console.warn("THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues. Use a single KTX2Loader instance, or call .dispose() on old instances."),ks++}return this.transcoderPending}load(e,t,s,i){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");const r=new ds(this.manager);r.setPath(this.path),r.setCrossOrigin(this.crossOrigin),r.setWithCredentials(this.withCredentials),r.setResponseType("arraybuffer"),r.load(e,o=>{this.parse(o,t,i)},s,i)}parse(e,t,s){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");if(Ts.has(e))return Ts.get(e).promise.then(t).catch(s);this._createTexture(e).then(i=>t?t(i):null).catch(s)}_createTextureFrom(e,t){const{type:s,error:i,data:{faces:r,width:o,height:n,format:A,type:l,dfdFlags:h}}=e;if(s==="error")return Promise.reject(i);let c;if(t.faceCount===6)c=new Fo(r,A,l);else{const d=r[0].mipmaps;c=t.layerCount>1?new Ro(d,o,n,t.layerCount,A,l):new Oa(d,o,n,A,l)}return c.minFilter=r[0].mipmaps.length===1?O:at,c.magFilter=O,c.generateMipmaps=!1,c.needsUpdate=!0,c.colorSpace=Wr(t),c.premultiplyAlpha=!!(h&xl),c}async _createTexture(e,t={}){const s=bl(new Uint8Array(e)),i=s.vkFormat===gi&&s.dataFormatDescriptor[0].colorModel===167;if(!(s.vkFormat===Sl||i&&!this.workerConfig.astcHDRSupported))return Tl(s);const o=t,n=this.init().then(()=>this.workerPool.postMessage({type:"transcode",buffer:e,taskConfig:o},[e])).then(A=>this._createTextureFrom(A.data,s));return Ts.set(e,{promise:n}),n}dispose(){this.workerPool.dispose(),this.workerSourceURL&&URL.revokeObjectURL(this.workerSourceURL),ks--}}ue.BasisFormat={ETC1S:0,UASTC:1,UASTC_HDR:2};ue.TranscoderFormat={ETC1:0,ETC2:1,BC1:2,BC3:3,BC4:4,BC5:5,BC7_M6_OPAQUE_ONLY:6,BC7_M5:7,PVRTC1_4_RGB:8,PVRTC1_4_RGBA:9,ASTC_4x4:10,ATC_RGB:11,ATC_RGBA_INTERPOLATED_ALPHA:12,RGBA32:13,RGB565:14,BGR565:15,RGBA4444:16,BC6H:22,RGB_HALF:24,RGBA_HALF:25};ue.EngineFormat={RGBAFormat:ie,RGBA_ASTC_4x4_Format:It,RGB_BPTC_UNSIGNED_Format:Oo,RGBA_BPTC_Format:ts,RGBA_ETC2_EAC_Format:ni,RGBA_PVRTC_4BPPV1_Format:es,RGBA_S3TC_DXT5_Format:Va,RGB_ETC1_Format:qa,RGB_ETC2_Format:oi,RGB_PVRTC_4BPPV1_Format:Ha,RGBA_S3TC_DXT1_Format:ss};ue.EngineType={UnsignedByteType:N,HalfFloatType:H,FloatType:$e};ue.BasisWorker=function(){let a,e,t;const s=_EngineFormat,i=_EngineType,r=_TranscoderFormat,o=_BasisFormat;self.addEventListener("message",function(u){const g=u.data;switch(g.type){case"init":a=g.config,n(g.transcoderBinary);break;case"transcode":e.then(()=>{try{const{faces:m,buffers:p,width:C,height:B,hasAlpha:I,format:E,type:v,dfdFlags:x}=A(g.buffer);self.postMessage({type:"transcode",id:g.id,data:{faces:m,width:C,height:B,hasAlpha:I,format:E,type:v,dfdFlags:x}},p)}catch(m){console.error(m),self.postMessage({type:"error",id:g.id,error:m.message})}});break}});function n(u){e=new Promise(g=>{t={wasmBinary:u,onRuntimeInitialized:g},BASIS(t)}).then(()=>{t.initializeBasis(),t.KTX2File===void 0&&console.warn("THREE.KTX2Loader: Please update Basis Universal transcoder.")})}function A(u){const g=new t.KTX2File(new Uint8Array(u));function m(){g.close(),g.delete()}if(!g.isValid())throw m(),new Error("THREE.KTX2Loader:	Invalid or unsupported .ktx2 file");let p;if(g.isUASTC())p=o.UASTC;else if(g.isETC1S())p=o.ETC1S;else if(g.isHDR())p=o.UASTC_HDR;else throw new Error("THREE.KTX2Loader: Unknown Basis encoding");const C=g.getWidth(),B=g.getHeight(),I=g.getLayers()||1,E=g.getLevels(),v=g.getFaces(),x=g.getHasAlpha(),_=g.getDFDFlags(),{transcoderFormat:y,engineFormat:D,engineType:q}=c(p,C,B,x);if(!C||!B||!E)throw m(),new Error("THREE.KTX2Loader:	Invalid texture");if(!g.startTranscoding())throw m(),new Error("THREE.KTX2Loader: .startTranscoding failed");const $=[],w=[];for(let S=0;S<v;S++){const F=[];for(let P=0;P<E;P++){const Q=[];let G,V;for(let k=0;k<I;k++){const R=g.getImageLevelInfo(P,k,S);S===0&&P===0&&k===0&&(R.origWidth%4!==0||R.origHeight%4!==0)&&console.warn("THREE.KTX2Loader: ETC1S and UASTC textures should use multiple-of-four dimensions."),E>1?(G=R.origWidth,V=R.origHeight):(G=R.width,V=R.height);let J=new Uint8Array(g.getImageTranscodedSizeInBytes(P,k,0,y));const M=g.transcodeImage(J,P,k,S,y,0,-1,-1);if(q===i.HalfFloatType&&(J=new Uint16Array(J.buffer,J.byteOffset,J.byteLength/Uint16Array.BYTES_PER_ELEMENT)),!M)throw m(),new Error("THREE.KTX2Loader: .transcodeImage failed.");Q.push(J)}const ae=f(Q);F.push({data:ae,width:G,height:V}),w.push(ae.buffer)}$.push({mipmaps:F,width:C,height:B,format:D,type:q})}return m(),{faces:$,buffers:w,width:C,height:B,hasAlpha:x,dfdFlags:_,format:D,type:q}}const l=[{if:"astcSupported",basisFormat:[o.UASTC],transcoderFormat:[r.ASTC_4x4,r.ASTC_4x4],engineFormat:[s.RGBA_ASTC_4x4_Format,s.RGBA_ASTC_4x4_Format],engineType:[i.UnsignedByteType],priorityETC1S:1/0,priorityUASTC:1,needsPowerOfTwo:!1},{if:"bptcSupported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.BC7_M5,r.BC7_M5],engineFormat:[s.RGBA_BPTC_Format,s.RGBA_BPTC_Format],engineType:[i.UnsignedByteType],priorityETC1S:3,priorityUASTC:2,needsPowerOfTwo:!1},{if:"dxtSupported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.BC1,r.BC3],engineFormat:[s.RGBA_S3TC_DXT1_Format,s.RGBA_S3TC_DXT5_Format],engineType:[i.UnsignedByteType],priorityETC1S:4,priorityUASTC:5,needsPowerOfTwo:!1},{if:"etc2Supported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.ETC1,r.ETC2],engineFormat:[s.RGB_ETC2_Format,s.RGBA_ETC2_EAC_Format],engineType:[i.UnsignedByteType],priorityETC1S:1,priorityUASTC:3,needsPowerOfTwo:!1},{if:"etc1Supported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.ETC1],engineFormat:[s.RGB_ETC1_Format],engineType:[i.UnsignedByteType],priorityETC1S:2,priorityUASTC:4,needsPowerOfTwo:!1},{if:"pvrtcSupported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.PVRTC1_4_RGB,r.PVRTC1_4_RGBA],engineFormat:[s.RGB_PVRTC_4BPPV1_Format,s.RGBA_PVRTC_4BPPV1_Format],engineType:[i.UnsignedByteType],priorityETC1S:5,priorityUASTC:6,needsPowerOfTwo:!0},{if:"bptcSupported",basisFormat:[o.UASTC_HDR],transcoderFormat:[r.BC6H],engineFormat:[s.RGB_BPTC_UNSIGNED_Format],engineType:[i.HalfFloatType],priorityHDR:1,needsPowerOfTwo:!1},{basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.RGBA32,r.RGBA32],engineFormat:[s.RGBAFormat,s.RGBAFormat],engineType:[i.UnsignedByteType,i.UnsignedByteType],priorityETC1S:100,priorityUASTC:100,needsPowerOfTwo:!1},{basisFormat:[o.UASTC_HDR],transcoderFormat:[r.RGBA_HALF],engineFormat:[s.RGBAFormat],engineType:[i.HalfFloatType],priorityHDR:100,needsPowerOfTwo:!1}],h={[o.ETC1S]:l.filter(u=>u.basisFormat.includes(o.ETC1S)).sort((u,g)=>u.priorityUASTC-g.priorityUASTC),[o.UASTC]:l.filter(u=>u.basisFormat.includes(o.UASTC)).sort((u,g)=>u.priorityUASTC-g.priorityUASTC),[o.UASTC_HDR]:l.filter(u=>u.basisFormat.includes(o.UASTC_HDR)).sort((u,g)=>u.priorityHDR-g.priorityHDR)};function c(u,g,m,p){const C=h[u];for(let B=0;B<C.length;B++){const I=C[B];if(I.if&&!a[I.if]||!I.basisFormat.includes(u)||p&&I.transcoderFormat.length<2||I.needsPowerOfTwo&&!(d(g)&&d(m)))continue;const E=I.transcoderFormat[p?1:0],v=I.engineFormat[p?1:0],x=I.engineType[0];return{transcoderFormat:E,engineFormat:v,engineType:x}}throw new Error("THREE.KTX2Loader: Failed to identify transcoding target.")}function d(u){return u<=2?!0:(u&u-1)===0&&u!==0}function f(u){if(u.length===1)return u[0];let g=0;for(let C=0;C<u.length;C++){const B=u[C];g+=B.byteLength}const m=new Uint8Array(g);let p=0;for(let C=0;C<u.length;C++){const B=u[C];m.set(B,p),p+=B.byteLength}return m}};const Rl=new Set([ie,it,ge,gt]),Gs={[xr]:ie,[wr]:ge,[vr]:gt,[Er]:ie,[Br]:ge,[Ir]:gt,[Cr]:ie,[pr]:ie,[mr]:ge,[dr]:ge,[gr]:gt,[fr]:gt,[yr]:it,[_r]:it,[Ur]:ni,[Nr]:oi,[gi]:It,[zr]:It,[Or]:It,[Yr]:ms,[qr]:ms,[Hr]:ms,[Dr]:ss,[br]:ss,[Sr]:vi,[Qr]:vi,[Fr]:Ei,[Mr]:Ei,[Tr]:Lo,[Rr]:Go,[Pr]:Po,[kr]:ko,[Lr]:ts,[Gr]:ts,[Kr]:es,[Jr]:es,[jr]:Bi,[Vr]:Bi},Ye={[xr]:$e,[wr]:$e,[vr]:$e,[Er]:H,[Br]:H,[Ir]:H,[Cr]:N,[pr]:N,[mr]:N,[dr]:N,[gr]:N,[fr]:N,[yr]:za,[_r]:Ft,[Ur]:N,[Nr]:N,[gi]:H,[zr]:N,[Or]:N,[Yr]:H,[qr]:N,[Hr]:N,[Dr]:N,[br]:N,[Sr]:N,[Qr]:N,[Fr]:N,[Mr]:N,[Tr]:N,[Rr]:N,[Pr]:N,[kr]:N,[Lr]:N,[Gr]:N,[Kr]:N,[Jr]:N,[jr]:N,[Vr]:N};async function Tl(a){const{vkFormat:e}=a;if(Gs[e]===void 0)throw new Error("THREE.KTX2Loader: Unsupported vkFormat: "+e);Ye[e]===void 0&&console.warn('THREE.KTX2Loader: Missing ".type" for vkFormat: '+e);let t;a.supercompressionScheme===ya&&(Ps||(Ps=new Promise(async o=>{const n=new Dl;await n.init(),o(n)})),t=await Ps);const s=[];for(let o=0;o<a.levels.length;o++){const n=Math.max(1,a.pixelWidth>>o),A=Math.max(1,a.pixelHeight>>o),l=a.pixelDepth?Math.max(1,a.pixelDepth>>o):0,h=a.levels[o];let c;if(a.supercompressionScheme===wl)c=h.levelData;else if(a.supercompressionScheme===ya)c=t.decode(h.levelData,h.uncompressedByteLength);else throw new Error("THREE.KTX2Loader: Unsupported supercompressionScheme.");let d;Ye[e]===$e?d=new Float32Array(c.buffer,c.byteOffset,c.byteLength/Float32Array.BYTES_PER_ELEMENT):Ye[e]===H?d=new Uint16Array(c.buffer,c.byteOffset,c.byteLength/Uint16Array.BYTES_PER_ELEMENT):Ye[e]===za||Ye[e]===Ft?d=new Uint32Array(c.buffer,c.byteOffset,c.byteLength/Uint32Array.BYTES_PER_ELEMENT):d=c,s.push({data:d,width:n,height:A,depth:l})}const i=a.levelCount===0||s.length>1;let r;if(Rl.has(Gs[e]))r=a.pixelDepth===0?new ai(s[0].data,a.pixelWidth,a.pixelHeight):new No(s[0].data,a.pixelWidth,a.pixelHeight,a.pixelDepth),r.minFilter=i?Uo:Ae,r.magFilter=Ae,r.generateMipmaps=a.levelCount===0;else{if(a.pixelDepth>0)throw new Error("THREE.KTX2Loader: Unsupported pixelDepth.");r=new Oa(s,a.pixelWidth,a.pixelHeight),r.minFilter=i?at:O,r.magFilter=O}return r.mipmaps=s,r.type=Ye[e],r.format=Gs[e],r.colorSpace=Wr(a),r.needsUpdate=!0,Promise.resolve(r)}function Wr(a){const e=a.dataFormatDescriptor[0];return e.colorPrimaries===yl?e.transferFunction===Qa?qe:To:e.colorPrimaries===Ql?e.transferFunction===Qa?Ml:Fl:e.colorPrimaries===_l?Oe:(console.warn(`THREE.KTX2Loader: Unsupported color primaries, "${e.colorPrimaries}"`),Oe)}function kl(a,e,t){const s=new Float32Array(e*e*3),i=new Float32Array(e*e),r=new Float32Array(e*e);for(let o=0;o<e;o++)for(let n=0;n<e;n++){const A=n/e,l=o/e,h=o*e+n,c=Re(A,l,8,4,t),d=le(n*3+t,o*7);let f=.72+(c-.5)*.25+(d-.5)*.08,u=c*.3,g=.85,m=[f,f,f];if(a==="brick"){const C=Math.floor(l*12),B=1/5,I=C%2*B*.5,E=(A+I)/B,v=E-Math.floor(E),x=l*12-C,_=v<.05||x<.12,y=le(Math.floor(E)+31,C+t);m=_?[.62,.6,.57]:[.55+y*.15,.27+y*.08,.2+y*.05],u=_?.1:.7+c*.2,g=_?.95:.8}else if(a==="panel"){const p=A*2%1<.01||l*2%1<.01;f=.7+(c-.5)*.12+(d-.5)*.12,m=[f,f,f],u=p?0:.6+c*.1,g=.7}else if(a==="stucco")f=.78+(c-.5)*.1+(d-.5)*.1,m=[f,f,f],u=.5+d*.3+c*.2,g=.9;else if(a==="siding"){const p=l*8%1;f=.78+(c-.5)*.06-(p<.08?.25:0),m=[f,f,f],u=p,g=.7}else if(a==="corrugated"){const p=.5+.5*Math.sin(A*Math.PI*2*14);f=.6+p*.2,m=[f,f,f],u=p,g=.45}else if(a==="slate"){const C=Math.floor(l*10),B=C%2*.05,I=(A+B)*10%1,E=l*10-C;f=.32+le(Math.floor((A+B)*10),C)*.08-(E>.85?.1:0)-(I<.04?.08:0),m=[f*.95,f*.97,f],u=E,g=.75}else if(a==="grass")m=[.18+c*.12,.34+c*.16+d*.08,.1+c*.05],u=d,g=.95;else if(a==="plain")f=.8+(c-.5)*.04,m=[f,f,f],u=.5,g=.55;else if(a==="fabric"){const p=(Math.floor(A*160)+Math.floor(l*160))%2*.06;f=.75+p+(c-.5)*.05,m=[f,f,f],u=p*8,g=.9}s[h*3]=m[0],s[h*3+1]=m[1],s[h*3+2]=m[2],i[h]=u,r[h]=g}return{alb:s,hgt:i,rgh:r}}function Pl(a,e,t,s){const i=kl(a,e,t);if(s){const n=[0,0,0];for(let l=0;l<e*e;l++)n[0]+=i.alb[l*3],n[1]+=i.alb[l*3+1],n[2]+=i.alb[l*3+2];const A=n.map(l=>.58/Math.max(.02,l/(e*e)));for(let l=0;l<e*e;l++)for(let h=0;h<3;h++)i.alb[l*3+h]*=A[h]}const r=new Uint8Array(e*e*4),o=new Uint8Array(e*e*4);for(let n=0;n<e;n++)for(let A=0;A<e;A++){const l=n*e+A,h=l*4;r[h]=Math.min(255,Math.pow(i.alb[l*3],1/2.2)*255),r[h+1]=Math.min(255,Math.pow(i.alb[l*3+1],1/2.2)*255),r[h+2]=Math.min(255,Math.pow(i.alb[l*3+2],1/2.2)*255),r[h+3]=255;const c=(A+e-1)%e,d=(A+1)%e,f=(n+e-1)%e,u=(n+1)%e,g=(i.hgt[n*e+d]-i.hgt[n*e+c])*2.5,m=(i.hgt[u*e+A]-i.hgt[f*e+A])*2.5,p=Math.hypot(g,m,1);o[h]=(-g/p*.5+.5)*255,o[h+1]=(-m/p*.5+.5)*255,o[h+2]=i.rgh[l]*255,o[h+3]=255}return{pa:r,pn:o}}function Gl(a,e,t,s,i,r,o){const n=s*4,A=new Int32Array(s);for(let g=0;g<s;g++)A[g]=Math.floor(g*t/s);const l=new Uint32Array(i.buffer,i.byteOffset,i.byteLength>>2),h=new Uint32Array(r.buffer,r.byteOffset,r.byteLength>>2),c=new Uint32Array(a.buffer,a.byteOffset,a.byteLength>>2),d=new Uint32Array(e.buffer,e.byteOffset,e.byteLength>>2);let f=-1,u=0;for(let g=0;g<s;g++){const m=Math.floor(g*t/s),p=o+g*n;if(m===f){i.copyWithin(p,u,u+n),r.copyWithin(p,u,u+n);continue}const C=m*t,B=p>>2;for(let I=0;I<s;I++){const E=C+A[I];l[B+I]=c[E],h[B+I]=d[E]}f=m,u=p}}const Xr={BASE_URL:"/web-engine/",DEV:!1,MODE:"production",PROD:!0,SSR:!1};function Rt(a,e=a){const t=document.createElement("canvas");return t.width=a,t.height=e,t}function $r(a){return a.getContext("2d",{willReadFrequently:!0})}function cs(a,e,t=!0,s=!0,i=8){return s&&(a.wrapS=a.wrapT=st),a.colorSpace=t?qe:Oe,a.anisotropy=e?Math.min(i,e.capabilities.getMaxAnisotropy()):4,a.minFilter=at,a.magFilter=O,a.generateMipmaps=!0,a.needsUpdate=!0,a}function us(a,e){const t=$r(a),s=t.createImageData(a.width,a.height),i=s.data,r=[0,0,0],o=a.width,n=a.height;for(let A=0;A<n;A++)for(let l=0;l<o;l++){const h=(A*o+l)*4,c=e(l,A,r)||r;i[h]=c[0],i[h+1]=c[1],i[h+2]=c[2],i[h+3]=255}return t.putImageData(s,0,0),t}function Ll(a){return a.onUpdate=()=>{a.image.data=null,a.onUpdate=null},a}function Da(a,e,t,s,i,{free:r=!0}={}){const o=new zo(a,e,e,t);return o.format=ie,o.type=N,o.wrapS=o.wrapT=st,o.minFilter=at,o.magFilter=O,o.generateMipmaps=!0,o.anisotropy=i?i.capabilities.getMaxAnisotropy():4,o.colorSpace=s?qe:Oe,o.needsUpdate=!0,r?Ll(o):o}function Mh(a){const t=Rt(1024),s=hi(11),i=us(t,(r,o,n)=>{const A=r/1024,l=o/1024,h=Re(A,l,4,4,1),c=le(r*3+1,o*7+3),d=Re(A,l,64,2,5);let f=46+h*22+(c-.5)*26+(d-.5)*14;return c>.985&&(f+=40),n[0]=f,n[1]=f*1,n[2]=f*1.02,n});i.globalAlpha=.25;for(let r=0;r<7;r++){i.fillStyle=s()<.5?"#1c1c1d":"#5a5a5a";const o=80+s()*220,n=60+s()*160,A=s()*1024,l=s()*1024;i.fillRect(A,l,o,n),A+o>1024&&i.fillRect(A-1024,l,o,n),l+n>1024&&i.fillRect(A,l-1024,o,n)}i.globalAlpha=.55,i.strokeStyle="#141414",i.lineWidth=1.2;for(let r=0;r<22;r++){let o=s()*1024,n=s()*1024;i.beginPath(),i.moveTo(o,n);for(let A=0;A<14;A++)o+=(s()-.5)*34,n+=(s()-.5)*34,i.lineTo(o,n);i.stroke()}return i.globalAlpha=1,cs(new Dt(t),a)}function Fh(a){const t=Rt(512),s=us(t,(i,r,o)=>{const n=i/512,A=r/512,l=Re(n,A,8,4,21),h=le(i+9,r*3),c=le(Math.floor(i/128),Math.floor(r/128)+77);let d=168+l*30+(h-.5)*14+(c-.5)*16;const f=i%128,u=r%128;return f<2||u<2?d-=52:(f<4||u<4)&&(d-=12),o[0]=d,o[1]=d*.985,o[2]=d*.95,o});return s.globalAlpha=1,cs(new Dt(t),a)}function Rh(a){const t=Rt(1024);return us(t,(s,i,r)=>{const o=s/1024,n=i/1024,A=Re(o,n,3,5,31),l=le(s*5,i*11+1),h=s%256<2||i%256<2?-30:0,c=118+A*40+(l-.5)*18+h;return r[0]=c*1,r[1]=c*.98,r[2]=c*.93,r}),cs(new Dt(t),a)}function Th(a){const t=Rt(512);return us(t,(s,i,r)=>{const o=s/512,n=i/512,A=Re(o,n,4,5,41),l=Re(o,n,16,3,43),h=le(s*13,i*17),c=.75+A*.45+(h-.5)*.35;return r[0]=52*c+l*18,r[1]=92*c+l*20,r[2]=34*c,r}),cs(new Dt(t),a)}function di(){return`${typeof import.meta<"u"&&Xr&&"/web-engine/"||"/"}textures/`}function Ws(){return`${typeof import.meta<"u"&&Xr&&"/web-engine/"||"/"}basis/`}async function Nl(a=di()){try{const e=await fetch(`${a}manifest.json`);if(e.ok)return await e.json()}catch{}return null}async function Ul(a){const e=await fetch(a);if(!e.ok)throw new Error(`HTTP ${e.status} ${a}`);const t=await e.blob(),s=performance.now();return{bmp:await createImageBitmap(t,{colorSpaceConversion:"none",premultiplyAlpha:"none",imageOrientation:"none"}),bytes:t.size,ms:performance.now()-s}}function Ol(a,e,t){return t.g.clearRect(0,0,e,e),t.g.drawImage(a,0,0,e,e),t.g.getImageData(0,0,e,e).data}const Xs={map:["diff.jpg",!0,"Diffuse"],normalMap:["nor_gl.jpg",!1,"nor_gl"],roughnessMap:["rough.jpg",!1,"Rough"],aoMap:["ao.jpg",!1,"AO"]},Ma=["map","normalMap","roughnessMap","aoMap"],de={options:{ktx2:!0,arrayKtx2:"auto",basisPath:null,workers:3,proceduralWorkers:!0,log:!0},stats:null,configure(a={}){return Object.assign(this.options,a),this},resetStats(){return this.stats=zl(),this.stats}};function zl(){return{ktx2:null,sets:{},totals:{sets:0,ktx2:0,jpg:0,mixed:0,procedural:0,missing:0,bytes:0,ktx2Bytes:0,jpgBytes:0,gpuBytes:0,decodeMs:0,packMs:0,procMs:0,workerMs:0,procWorker:0,wallMs:0}}}de.resetStats();const Hl={[It]:"ASTC 4x4",[ts]:"BC7",[oi]:"ETC2",[ni]:"ETC2 EAC",[qa]:"ETC1",[ss]:"BC1",[Va]:"BC3",[Ha]:"PVRTC",[es]:"PVRTC",[ie]:"RGBA8"},Zr=4/3;function ql(){try{const a=new URLSearchParams(globalThis.location?globalThis.location.search:"");if(a.has("nokx")||a.has("noktx2")||a.get("ktx2")==="0")return!1;if(a.get("ktx2")==="1")return!0}catch{}return null}function $s(a){const e=ql();return e!==null?e:a!==void 0?!!a:!0}let eo=0,to=0,Xe=0;const pt=a=>Math.round(a*10)/10;function Zs(a,e){return eo++===0&&!Xe&&(to=performance.now()),Xe&&(clearTimeout(Xe),Xe=0),{id:e,consumer:a,path:"missing",maps:{},bytes:0,ms:0,decodeMs:0,packMs:0,gpuBytes:0,formats:[],t0:performance.now()}}function tt(a,e,t,s=0,i=0,r=null){a.maps[e]=t,a.bytes+=s,a.decodeMs+=i,r&&!a.formats.includes(r)&&a.formats.push(r)}function so(a,e){const t=Object.values(a.maps).filter(o=>o!=="missing");a.path=e||(t.length===0?"missing":t.every(o=>o===t[0])?t[0]:"mixed"),a.ms=Math.round(performance.now()-a.t0),a.decodeMs=Math.round(a.decodeMs),a.packMs=pt(a.packMs),delete a.t0;const s=de.stats,i=s.totals,r=`${a.consumer}:${a.id}`;s.sets[r]||i.sets++,s.sets[r]=a,i[a.path]=(i[a.path]||0)+1,i.bytes+=a.bytes,i.gpuBytes+=a.gpuBytes,i.decodeMs+=a.decodeMs,i.packMs=pt(i.packMs+a.packMs),a.procIn&&(i.procMs=pt(i.procMs+a.packMs),i.workerMs=pt(i.workerMs+a.workerMs),a.procIn==="worker"&&i.procWorker++);for(const[o,n]of Object.entries(a.maps))(n==="ktx2"||n==="jpg")&&(i[n+"Bytes"]+=a.mapBytes&&a.mapBytes[o]||0);--eo===0&&(Xe=setTimeout(Vl,300))}function Vl(){Xe=0;const a=de.stats,e=a.totals;e.wallMs=Math.round(performance.now()-300-to);const t=new Set;for(const n of Object.values(a.sets))for(const A of n.formats)t.add(A);const s=["ktx2","jpg","mixed","procedural","missing"].filter(n=>e[n]).map(n=>`${n} ${e[n]}`).join(" / "),i=e.procedural,r=e.procWorker,o=i?`; procedural ${i} layer${i>1?"s":""}${r===i?" in workers":r?` (${r} in workers)`:""}: ${e.procMs.toFixed(1)} ms main-thread${r?`, ${e.workerMs.toFixed(0)} ms off-thread`:""}`:"";console.info(`[TextureSets] ${e.sets} sets: ${s} · ${(e.bytes/1048576).toFixed(1)} MB downloaded (ktx2 ${(e.ktx2Bytes/1048576).toFixed(1)}, jpg ${(e.jpgBytes/1048576).toFixed(1)}) · ~${(e.gpuBytes/1048576).toFixed(0)} MB GPU · ready in ${e.wallMs} ms (main-thread packing ${e.packMs.toFixed(1)} ms${o}) · ${[...t].join(", ")||"no textures"}${a.ktx2===!1?" (KTX2 off)":""}`)}function ns(a,e,t){(a.mapBytes||(a.mapBytes={}))[e]=t}let ut;function Jl(a){if(!a)return null;if(ut!==void 0)return ut;try{const e=new ue().setTranscoderPath(Ws());e.detectSupport(a);const t=e.workerConfig,s=[["astcSupported","ASTC"],["bptcSupported","BC7"],["etc2Supported","ETC2"],["etc1Supported","ETC1"],["dxtSupported","BC1/BC3"],["pvrtcSupported","PVRTC"]].filter(([r])=>t[r]).map(([,r])=>r);if(!s.length)return de.stats.ktx2=!1,ut=null;const i={loader:e,formats:s,failed:!1,ready:null};return i.ready=e.init().then(()=>{const r=new Uint8Array(e.transcoderBinary||new ArrayBuffer(0),0,4);if(r.length<4||r[0]!==0||r[1]!==97||r[2]!==115||r[3]!==109)throw new Error("basis_transcoder.wasm is not a WASM file");return!0}).catch(r=>(i.failed=!0,de.stats.ktx2=!1,console.warn(`[TextureSets] KTX2 transcoder unavailable at ${Ws()} (${r&&r.message?r.message:r}); using JPG`),!1)),de.stats.ktx2={formats:s},ut=i}catch(e){return console.warn(`[TextureSets] KTX2 unavailable (${e&&e.message?e.message:e}); using JPG`),de.stats.ktx2=!1,ut=null}}let jl=0;function io(a,e){jl++<4&&console.warn(`[TextureSets] ${a}: ${e&&e.message?e.message:e}; falling back to JPG`)}const ao=(a,e,t)=>new Promise((s,i)=>{const r=setTimeout(()=>i(new Error(t)),e);a.then(o=>{clearTimeout(r),s(o)},o=>{clearTimeout(r),i(o)})}),ro=a=>fetch(a).then(e=>{if(!e.ok)throw new Error(`HTTP ${e.status}`);return e.arrayBuffer()});async function Kl(a,e,t,s,i){try{const r=await e;if(!await a.ready)return null;const o=r.byteLength,n=performance.now(),A=await ao(new Promise((c,d)=>a.loader.parse(r,c,d)),2e4,"transcode timed out"),l=Hl[A.format]||String(A.format);let h=0;for(const c of A.mipmaps||[])h+=c.data?c.data.byteLength:0;return s.gpuBytes+=h,ns(s,i,o),tt(s,i,"ktx2",o,performance.now()-n,l),A}catch(r){return a.failed||io(t,r),null}}async function Yl(a,e,t,s){try{const i=await fetch(a);if(!i.ok)throw new Error(`HTTP ${i.status}`);const r=await i.blob(),o=performance.now(),n=URL.createObjectURL(r),A=await new Ho().loadAsync(n).finally(()=>URL.revokeObjectURL(n)),l=A.image.width||0,h=A.image.height||0;return t.gpuBytes+=l*h*4*Zr,ns(t,s,r.size),tt(t,s,"jpg",r.size,performance.now()-o,"RGBA8"),A}catch{return tt(t,s,"missing"),null}}function Wl(){let a=null;const e=[];let t=!1,s=null;const i=n=>{if(s){self.postMessage({id:n.id,error:s});return}let A=null;try{if(A=new a.KTX2File(new Uint8Array(n.buffer)),!A.isValid()||!A.startTranscoding())throw new Error("invalid or unsupported .ktx2");const l=A.getLevels();let h=0;for(let u=0;u<l;u++){const g=A.getImageLevelInfo(u,0,0);if(g.origWidth===n.size&&g.origHeight===n.size){h=u;break}g.origWidth>=n.size&&g.origHeight>=n.size&&(h=u)}const c=A.getImageLevelInfo(h,0,0),d=performance.now(),f=new Uint8Array(A.getImageTranscodedSizeInBytes(h,0,0,13));if(!A.transcodeImage(f,h,0,0,13,0,-1,-1))throw new Error("transcode failed");self.postMessage({id:n.id,data:f,width:c.origWidth,height:c.origHeight,ms:performance.now()-d},[f.buffer])}catch(l){self.postMessage({id:n.id,error:String(l&&l.message?l.message:l)})}finally{A&&(A.close(),A.delete())}};self.onmessage=n=>{t||s?i(n.data):e.push(n.data)};const r=n=>{s=String(n&&n.message?n.message:n),self.postMessage({type:"failed",error:s});for(const A of e.splice(0))i(A)},o=(n,A)=>fetch(self.BASIS_PATH+n).then(l=>{if(!l.ok)throw new Error(`HTTP ${l.status} ${n}`);return l[A]()});Promise.all([o("basis_transcoder.js","text"),o("basis_transcoder.wasm","arrayBuffer")]).then(([n,A])=>{const l=new Uint8Array(A,0,Math.min(4,A.byteLength));if(/^\s*</.test(n)||l[0]!==0||l[1]!==97||l[2]!==115||l[3]!==109)throw new Error("transcoder files are not JS / WASM");return importScripts(URL.createObjectURL(new Blob([n],{type:"text/javascript"}))),new Promise((h,c)=>{a={wasmBinary:A,onRuntimeInitialized:h,onAbort:d=>c(new Error(`transcoder aborted: ${d}`))},BASIS(a)})}).then(()=>{a.initializeBasis(),t=!0;for(const n of e.splice(0))i(n)}).catch(r)}let ft=null,_e=!1,Fa=!1;function ei(a){Fa||console.warn(`[TextureSets] KTX2 transcoder unavailable for texture arrays (${a}); using JPG`),Fa=!0}function ti(){if(ft)return ft;const a=new URL(Ws(),globalThis.location?globalThis.location.href:void 0).href,e=Wl.toString(),t=URL.createObjectURL(new Blob([`self.BASIS_PATH = ${JSON.stringify(a)};
`,e.substring(e.indexOf("{")+1,e.lastIndexOf("}"))],{type:"text/javascript"})),s=Math.max(1,de.options.workers|0),i=[],r=new Map,o=[],n=new Array(s).fill(0);let A=0,l=0;const h=()=>{for(let u=0;u<s&&o.length;u++){if(n[u])continue;let g=0;for(let p=1;p<o.length;p++)o[p].prio<o[g].prio&&(g=p);const m=o.splice(g,1)[0];n[u]=m.id,i[u].postMessage({id:m.id,buffer:m.buffer,size:m.size},[m.buffer])}},c=()=>{if(l=0,!r.size){for(const u of i)u.terminate();URL.revokeObjectURL(t),ft===f&&(ft=null)}},d=u=>{!_e&&r.size&&ei(u),_e=u||"transcoder unavailable",o.length=0;for(const[g,m]of r)r.delete(g),m.rej(new Error(u))};for(let u=0;u<s;u++){const g=new Worker(t);g.onmessage=m=>{const p=m.data;if(p.type==="failed")return d(p.error);n[u]===p.id&&(n[u]=0);const C=r.get(p.id);C&&(r.delete(p.id),p.error?C.rej(new Error(p.error)):C.res(p)),h(),!r.size&&!l&&(l=setTimeout(c,1e4))},g.onerror=m=>{m.preventDefault&&m.preventDefault(),d(m.message||"transcode worker failed")},i.push(g)}const f={transcode(u,g,m=0){return _e?Promise.reject(new Error("transcoder unavailable")):(l&&(clearTimeout(l),l=0),new Promise((p,C)=>{const B=++A;r.set(B,{res:p,rej:C}),o.push({id:B,buffer:u,size:g,prio:m}),h()}))}};return ft=f}function Xl(a,e,t,s){const i=new Uint8Array(s*s*4),r=e/s,o=t/s;for(let n=0;n<s;n++){const A=Math.min(t-1,Math.max(0,(n+.5)*o-.5)),l=Math.floor(A),h=Math.min(t-1,l+1),c=A-l;for(let d=0;d<s;d++){const f=Math.min(e-1,Math.max(0,(d+.5)*r-.5)),u=Math.floor(f),g=Math.min(e-1,u+1),m=f-u,p=(l*e+u)*4,C=(l*e+g)*4,B=(h*e+u)*4,I=(h*e+g)*4,E=(n*s+d)*4;for(let v=0;v<4;v++){const x=a[p+v]+(a[C+v]-a[p+v])*m,_=a[B+v]+(a[I+v]-a[B+v])*m;i[E+v]=Math.round(x+(_-x)*c)}}}return i}async function $l(a,e,t=0){const s=await a,i=s.byteLength,r=await ao(ti().transcode(s,e,t),2e4,"transcode timed out");let o=r.data;return(r.width!==e||r.height!==e)&&(o=Xl(o,r.width,r.height,e)),{data:o,up:!0,bytes:i,ms:r.ms}}const Le=256,Ra=1e4;let Pe=null,si=null,Ta=!1;function oo(a){Ta||console.warn(`[TextureSets] procedural texture workers unavailable (${a}); generating procedural layers on the main thread`),Ta=!0}function Zl(){try{const a=new URLSearchParams(globalThis.location?globalThis.location.search:"").get("procworkers");if(a!==null&&a!=="")return Math.max(0,+a|0)}catch{}return null}function eh(){const a=Zl(),e=a!==null?a:de.options.proceduralWorkers;return!e||si||typeof Worker>"u"?0:e===!0?Math.max(1,Math.min(4,(globalThis.navigator&&globalThis.navigator.hardwareConcurrency||4)-1)):Math.max(0,e|0)}function th(a){if(Pe)return Pe;const e=[],t=[],s=[],i=new Map,r=[];let o=0,n=0,A=!1;const l=()=>{if(n=0,!i.size){for(const u of e)u.terminate();Pe===f&&(Pe=null)}},h=u=>{if(!A){A=!0,oo(u),si=u||"worker failed";for(const g of s)clearTimeout(g);n&&(clearTimeout(n),n=0);for(const g of e)try{g.terminate()}catch{}r.length=0;for(const[g,m]of i)i.delete(g),m.rej(new Error(si));Pe===f&&(Pe=null)}},c=()=>{const u=e.length,g=new Worker(new URL("/web-engine/assets/proceduralTextures.worker-B_WQqOdV.js",import.meta.url),{type:"module"});g.onmessage=m=>{const p=m.data;if(p.error)return h(p.error);clearTimeout(s[u]),s[u]=0,t[u]===p.id&&(t[u]=0);const C=i.get(p.id);C&&(i.delete(p.id),C.res(p)),d(),!i.size&&!n&&(n=setTimeout(l,1e4))},g.onerror=m=>{m&&m.preventDefault&&m.preventDefault(),h(m&&m.message||"worker failed to load")},g.onmessageerror=()=>h("unreadable worker message"),e.push(g),t.push(0),s.push(0)},d=()=>{for(;r.length;){let u=t.indexOf(0);if(u<0){if(e.length>=a)return;c(),u=e.length-1}let g=0;for(let p=1;p<r.length;p++)r[p].prio<r[g].prio&&(g=p);const m=r.splice(g,1)[0];t[u]=m.msg.id,s[u]=setTimeout(()=>h(`no answer within ${Ra/1e3} s`),Ra),e[u].postMessage(m.msg)}},f={run(u,g,m,p,C=0){return n&&(clearTimeout(n),n=0),new Promise((B,I)=>{const E=++o;i.set(E,{res:B,rej:I}),r.push({prio:C,msg:{id:E,kind:u,P:g,seed:m,tint:p}});try{d()}catch(v){h(v&&v.message?v.message:String(v))}})}};return Pe=f}function sh(a,e,t,s){const i=eh();if(!i)return null;const r=th(i).run(a,Le,e,t,s);return r.catch(()=>{}),r}async function kh(a,{renderer:e=null,base:t=di(),manifest:s=null,maps:i=["map","normalMap","roughnessMap"],defaultSize:r=2,ktx2:o}={}){const n=s&&s.sets&&Object.values(s.sets).find(u=>u.id===a);if(s&&!n)return null;const A=Zs("set",a),l=n&&n.ktx2Maps&&$s(o)?Jl(e):null,h=(u,g)=>(u.colorSpace=g?qe:Oe,u.wrapS=u.wrapT=st,u.anisotropy=e?e.capabilities.getMaxAnisotropy():4,u.needsUpdate=!0,u),c=async u=>{const[g,m,p]=Xs[u],C=l&&!l.failed&&n.ktx2Maps[p],B=C?`${t}${a}/${C.file}`:null,I=B?ro(B):null;I&&I.catch(()=>{});let E=I?await Kl(l,I,B,A,u):null;return E||(E=await Yl(`${t}${a}/${g}`,m,A,u)),E?h(E,m):null},d=await Promise.all(i.map(c)),f={};return i.forEach((u,g)=>{f[u]=d[g]}),so(A),f.map?(f.size=n&&n.size?n.size[0]:r,f):null}async function Ph(a,e,{size:t=1024,base:s=di(),manifest:i,onProgress:r,ktx2:o,free:n=!0}={}){const A=e.length,l=new Array(A).fill(null),h=w=>97+w*13,c=w=>{if(!l[w]){const S=performance.now(),F=e[w],P=sh(F.proc,h(w),!!F.tint,w);l[w]={job:P,ms:performance.now()-S}}return l[w]};for(let w=0;w<A;w++)e[w].id||c(w);i===void 0&&($s(o)&&de.options.arrayKtx2!==!1&&!_e&&typeof Worker<"u"&&ti(),i=await Nl(s)),e=e.map(w=>{const S=i&&i.sets&&i.sets[w.role];return{...w,size:S&&S.size?S.size[0]:w.size,maps:S?S.maps||{}:null,kx:S&&S.ktx2Maps?S.ktx2Maps:null}});const d=t,f=new Uint8Array(d*d*4*A),u=new Uint8Array(d*d*4*A),g=Rt(d),m={g:$r(g)};let p=0,C=0;const B=e.filter(w=>w.id).length,I=$s(o),E=w=>!!w&&w.bytes<=(w.srcBytes||1/0);I&&!_e&&e.some(w=>w.id&&w.kx&&Ma.some(S=>E(w.kx[Xs[S][2]])))&&ti();const v=[],x=(w,S)=>{if(!w.id||i&&!w.maps)return Promise.resolve(null);const F=v[S]=Zs("array",w.id),P=async Q=>{const[G,,V]=Xs[Q],ae=I&&w.kx?w.kx[V]:null;if(E(ae))if(_e)ei(_e);else{const k=`${s}${w.id}/${ae.file}`;try{const R=await $l(ro(k),d,S);return ns(F,Q,R.bytes),tt(F,Q,"ktx2",R.bytes,R.ms,"RGBA8 array"),R}catch(R){_e?ei(_e):io(k,R)}}try{const k=await Ul(`${s}${w.id}/${G}`);return ns(F,Q,k.bytes),tt(F,Q,"jpg",k.bytes,k.ms,"RGBA8 array"),k}catch{return tt(F,Q,"missing"),null}};return Promise.all(Ma.map(P)).then(Q=>(r&&r(++C/Math.max(1,B)),Q))},_=e.map(x),y=w=>!!(w&&w[0]&&w[1]);e.forEach((w,S)=>{!w.id||i&&!w.maps?c(S):_[S].then(F=>{y(F)||c(S)},()=>c(S))});const D=w=>w?w.data?{d:w.data,up:!0}:{d:Ol(w.bmp,d,m),up:!1}:null;for(let w=0;w<A;w++){const S=e[w];let F=null;try{F=await _[w]}catch{F=null}const P=w*d*d*4,Q=d*4;if(y(F)){const G=performance.now(),V=D(F[0]);let ae=1,k=1,R=1;if(S.tint){let j=0,Z=0,ve=0;const Ve=7,pe=V.d;for(let rt=0;rt<d*d;rt+=Ve)j+=pe[rt*4],Z+=pe[rt*4+1],ve+=pe[rt*4+2];const we=Math.ceil(d*d/Ve),K=200;ae=K/Math.max(8,j/we),k=K/Math.max(8,Z/we),R=K/Math.max(8,ve/we)}const J=D(F[3]),M=(j,Z)=>(j.up?Z:d-1-Z)*Q;for(let j=0;j<d;j++){const Z=P+j*Q,ve=M(V,j),Ve=J?M(J,j):0,pe=V.d,we=J?J.d:null;for(let K=0;K<Q;K+=4)f[Z+K]=Math.min(255,pe[ve+K]*ae),f[Z+K+1]=Math.min(255,pe[ve+K+1]*k),f[Z+K+2]=Math.min(255,pe[ve+K+2]*R),f[Z+K+3]=we?we[Ve+K]:255}const te=D(F[1]),X=D(F[2]);for(let j=0;j<d;j++){const Z=P+j*Q,ve=M(te,j),Ve=X?M(X,j):0,pe=te.d,we=X?X.d:null;for(let K=0;K<Q;K+=4)u[Z+K]=pe[ve+K],u[Z+K+1]=pe[ve+K+1],u[Z+K+2]=we?we[Ve+K]:200,u[Z+K+3]=255}for(const j of F)j&&j.bmp&&j.bmp.close&&j.bmp.close();v[w]&&(v[w].packMs+=performance.now()-G),p++}else{const G=c(w);let V=null;if(G.job)try{V=await G.job}catch(J){oo(J&&J.message?J.message:J)}V&&!(V.pa&&V.pa.length===Le*Le*4&&V.pn&&V.pn.length===Le*Le*4)&&(V=null);const ae=performance.now(),k=V||Pl(S.proc,Le,h(w),S.tint);Gl(k.pa,k.pn,Le,d,f,u,P);const R=v[w]||(v[w]=Zs("array",`(${S.role})`));R.packMs+=G.ms+performance.now()-ae,R.procIn=V?"worker":"main",R.workerMs=V?pt(V.ms):0}so(v[w],y(F)?void 0:"procedural")}const q=Da(f,d,A,!0,a,{free:n}),$=Da(u,d,A,!1,a,{free:n});return de.stats.totals.gpuBytes+=2*d*d*4*A*Zr,{albedo:q,normal:$,sizes:e.map(w=>w.size),tintable:e.map(w=>w.tint?1:0),layers:A,loaded:p,wanted:B}}function Gh(a,e=!1){const t=a[0].index!==null,s=new Set(Object.keys(a[0].attributes)),i=new Set(Object.keys(a[0].morphAttributes)),r={},o={},n=a[0].morphTargetsRelative,A=new ii;let l=0;for(let h=0;h<a.length;++h){const c=a[h];let d=0;if(t!==(c.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const f in c.attributes){if(!s.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+f+'" attribute exists among all geometries, or in none of them.'),null;r[f]===void 0&&(r[f]=[]),r[f].push(c.attributes[f]),d++}if(d!==s.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(n!==c.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const f in c.morphAttributes){if(!i.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[f]===void 0&&(o[f]=[]),o[f].push(c.morphAttributes[f])}if(e){let f;if(t)f=c.index.count;else if(c.attributes.position!==void 0)f=c.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;A.addGroup(l,f,h),l+=f}}if(t){let h=0;const c=[];for(let d=0;d<a.length;++d){const f=a[d].index;for(let u=0;u<f.count;++u)c.push(f.getX(u)+h);h+=a[d].attributes.position.count}A.setIndex(c)}for(const h in r){const c=ka(r[h]);if(!c)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;A.setAttribute(h,c)}for(const h in o){const c=o[h][0].length;if(c===0)break;A.morphAttributes=A.morphAttributes||{},A.morphAttributes[h]=[];for(let d=0;d<c;++d){const f=[];for(let g=0;g<o[h].length;++g)f.push(o[h][g][d]);const u=ka(f);if(!u)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;A.morphAttributes[h].push(u)}}return A}function ka(a){let e,t,s,i=-1,r=0;for(let l=0;l<a.length;++l){const h=a[l];if(e===void 0&&(e=h.array.constructor),e!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=h.itemSize),t!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(s===void 0&&(s=h.normalized),s!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(i===-1&&(i=h.gpuType),i!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*t}const o=new e(r),n=new qo(o,t,s);let A=0;for(let l=0;l<a.length;++l){const h=a[l];if(h.isInterleavedBufferAttribute){const c=A/t;for(let d=0,f=h.count;d<f;d++)for(let u=0;u<t;u++){const g=h.getComponent(d,u);n.setComponent(d+c,u,g)}}else o.set(h.array,A);A+=h.count*t}return i!==void 0&&(n.gpuType=i),n}function Lh(a,e=1e-4){e=Math.max(e,Number.EPSILON);const t={},s=a.getIndex(),i=a.getAttribute("position"),r=s?s.count:i.count;let o=0;const n=Object.keys(a.attributes),A={},l={},h=[],c=["getX","getY","getZ","getW"],d=["setX","setY","setZ","setW"];for(let C=0,B=n.length;C<B;C++){const I=n[C],E=a.attributes[I];A[I]=new E.constructor(new E.array.constructor(E.count*E.itemSize),E.itemSize,E.normalized);const v=a.morphAttributes[I];v&&(l[I]||(l[I]=[]),v.forEach((x,_)=>{const y=new x.array.constructor(x.count*x.itemSize);l[I][_]=new x.constructor(y,x.itemSize,x.normalized)}))}const f=e*.5,u=Math.log10(1/e),g=Math.pow(10,u),m=f*g;for(let C=0;C<r;C++){const B=s?s.getX(C):C;let I="";for(let E=0,v=n.length;E<v;E++){const x=n[E],_=a.getAttribute(x),y=_.itemSize;for(let D=0;D<y;D++)I+=`${~~(_[c[D]](B)*g+m)},`}if(I in t)h.push(t[I]);else{for(let E=0,v=n.length;E<v;E++){const x=n[E],_=a.getAttribute(x),y=a.morphAttributes[x],D=_.itemSize,q=A[x],$=l[x];for(let w=0;w<D;w++){const S=c[w],F=d[w];if(q[F](o,_[S](B)),y)for(let P=0,Q=y.length;P<Q;P++)$[P][F](o,y[P][S](B))}}t[I]=o,h.push(o),o++}}const p=a.clone();for(const C in a.attributes){const B=A[C];if(p.setAttribute(C,new B.constructor(B.array.slice(0,o*B.itemSize),B.itemSize,B.normalized)),C in l)for(let I=0;I<l[C].length;I++){const E=l[C][I];p.morphAttributes[C][I]=new E.constructor(E.array.slice(0,o*E.itemSize),E.itemSize,E.normalized)}}return p.setIndex(h),p}function Nh(a,e){if(e===Vo)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),a;if(e===wi||e===Jo){let t=a.getIndex();if(t===null){const o=[],n=a.getAttribute("position");if(n!==void 0){for(let A=0;A<n.count;A++)o.push(A);a.setIndex(o),t=a.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),a}const s=t.count-2,i=[];if(e===wi)for(let o=1;o<=s;o++)i.push(t.getX(0)),i.push(t.getX(o)),i.push(t.getX(o+1));else for(let o=0;o<s;o++)o%2===0?(i.push(t.getX(o)),i.push(t.getX(o+1)),i.push(t.getX(o+2))):(i.push(t.getX(o+2)),i.push(t.getX(o+1)),i.push(t.getX(o)));i.length/3!==s&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const r=a.clone();return r.setIndex(i),r.clearGroups(),r}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),a}const ce={accent:"#e82127",accentRgb:"232,33,39",regen:"#3e9bff",ok:"#4cd27a",warn:"#ffb057",text:"#f2f4f7",font:'"Inter","SF Pro Display",-apple-system,system-ui,"Segoe UI",Roboto,sans-serif'},ih={accent:"--ui-accent",accentRgb:"--ui-accent-rgb",regen:"--ui-regen",ok:"--ui-ok",warn:"--ui-warn",text:"--ui-text",font:"--ui-font"},ah=`
:root{--ui-accent:${ce.accent};--ui-accent-rgb:${ce.accentRgb};--ui-regen:${ce.regen};--ui-ok:${ce.ok};--ui-warn:${ce.warn};
  --ui-text:${ce.text};--ui-dim:rgba(235,240,247,.55);--ui-mute:rgba(235,240,247,.6);--ui-font:${ce.font};
  --ui-glass:linear-gradient(160deg,rgba(22,26,33,.62),rgba(8,10,14,.55));--ui-glass-border:rgba(255,255,255,.08);
  --ui-radius:18px;--ui-gutter:22px;--ui-scale:1}
.ui-root{position:fixed;inset:0;pointer-events:none;z-index:20;color:var(--ui-text);font-family:var(--ui-font);
  font-weight:300;-webkit-font-smoothing:antialiased;user-select:none}
.ui-root *,.ui-w,.ui-w *{box-sizing:border-box}
.ui-glass{background:var(--ui-glass);border:1px solid var(--ui-glass-border);border-radius:var(--ui-radius);
  box-shadow:0 10px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05);
  -webkit-backdrop-filter:blur(14px) saturate(130%);backdrop-filter:blur(14px) saturate(130%)}
.ui-corner{position:absolute;transform:scale(var(--ui-scale))}
.ui-br{right:var(--ui-gutter);bottom:var(--ui-gutter);transform-origin:100% 100%}
.ui-bl{left:var(--ui-gutter);bottom:var(--ui-gutter);transform-origin:0 100%}
.ui-tl{left:var(--ui-gutter);top:var(--ui-gutter);transform-origin:0 0}
.ui-tr{right:var(--ui-gutter);top:var(--ui-gutter);transform-origin:100% 0}
.ui-label{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--ui-dim);font-weight:500}
.ui-num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.ui-row{display:flex;justify-content:space-between;align-items:baseline;width:100%;margin-bottom:6px}
`,Pa=new Set;function no(a,e){if(Pa.has(a)||typeof document>"u"||(Pa.add(a),document.getElementById(a)))return;const t=document.createElement("style");t.id=a,t.textContent=e,document.head.appendChild(t)}function Uh(){no("ui-theme",ah)}function Oh(a={},e=typeof document<"u"?document.documentElement:null){for(const t of Object.keys(a))t in ce&&(ce[t]=a[t]),e&&e.style.setProperty(ih[t]||`--ui-${t}`,a[t]);if(a.accent&&!a.accentRgb&&/^#[0-9a-f]{6}$/i.test(a.accent)){const t=parseInt(a.accent.slice(1),16);ce.accentRgb=`${t>>16},${t>>8&255},${t&255}`,e&&e.style.setProperty("--ui-accent-rgb",ce.accentRgb)}}const rh=`
.ui-loading{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ddd;
  background:#06080c;z-index:100;font-family:-apple-system,system-ui,sans-serif}
.ui-loading h2{margin:0;font-weight:500;letter-spacing:.2em}
.ui-loading .bar{width:320px;max-width:calc(100vw - 48px);height:4px;background:#222;margin-top:16px;border-radius:2px;overflow:hidden}
.ui-loading .bar>div{height:100%;width:0%;background:var(--ui-accent,${ce.accent});transition:width .2s}
.ui-loading small{opacity:.6;margin-top:10px}
`;class Ao{constructor(e={}){if(e.adopt)this.el=e.adopt,this.barEl=e.adopt.querySelector(".bar > div"),this.labelEl=e.adopt.querySelector("small"),this.titleEl=e.adopt.querySelector("h2");else{no("ui-loading",rh);const t=this.el=document.createElement("div");t.className="ui-loading",this.titleEl=document.createElement("h2"),this.titleEl.textContent=e.title??"LOADING";const s=document.createElement("div");s.className="bar",this.barEl=document.createElement("div"),s.appendChild(this.barEl),this.labelEl=document.createElement("small"),this.labelEl.textContent=e.label??"Loading…",t.append(this.titleEl,s,this.labelEl),e.accent&&t.style.setProperty("--ui-accent",e.accent),e.background&&(t.style.background=e.background),(e.parent||document.body).appendChild(t)}this.progress=0}static adopt(e){return new Ao({adopt:e})}setProgress(e,t){this.progress=Math.min(1,Math.max(0,e||0)),this.barEl&&(this.barEl.style.width=`${Math.round(this.progress*100)}%`),t&&this.labelEl&&(this.labelEl.textContent=t)}setLabel(e){this.labelEl&&(this.labelEl.textContent=e)}error(e){this.setLabel(e),this.barEl&&(this.barEl.style.background="#a33")}hide(e=500){const t=this.el;return!t||!t.isConnected?Promise.resolve():(t.style.transition=`opacity ${e/1e3}s`,t.style.opacity="0",t.style.pointerEvents="none",new Promise(s=>setTimeout(()=>{t.remove(),s()},e+50)))}dispose(){this.el&&this.el.remove()}}export{_h as $,bh as A,lh as B,Qh as C,Rn as D,nh as E,Ee as F,qi as G,aA as H,le as I,be as J,Ah as K,Ao as L,ch as M,Sh as N,yi as O,Ch as P,Th as Q,hh as R,hn as S,Li as T,Rh as U,Fh as V,Mh as W,nn as X,Eh as Y,Re as Z,an as _,ce as a,Et as a0,fh as a1,gh as a2,dh as a3,uh as a4,ph as a5,mh as a6,Uh as a7,Nh as a8,Jl as a9,Gh as b,Ya as c,wh as d,Rt as e,cs as f,Lh as g,Oh as h,no as i,Bl as j,Ih as k,Ka as l,hi as m,Ph as n,Dh as o,Ai as p,Nl as q,Bh as r,vh as s,yh as t,kh as u,$r as v,xh as w,di as x,Da as y,oe as z};
