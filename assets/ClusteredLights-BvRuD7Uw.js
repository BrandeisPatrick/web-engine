import{S as oe,a as Kt}from"./three.module-Dt1S_jJM.js";import{ah as he,aH as re,n as ae,s as ce,aO as ge,cX as fe}from"./three.core-BG5Iv3B7.js";const _t="ENGINE_CLUSTERED",Rt=64,W=1024,j=3,Tt=1024,dt=Tt*4,yt=24,wt=1,Ft=.001,ue=1e-4,rt=1,k=2,It=4;class de extends fe{clone(){return this}}let Q=null;function G(){if(Q)return Q;const s=(o,h,r)=>{const a=new de(o,1,1,h,r);return a.minFilter=a.magFilter=he,a.generateMipmaps=!1,a.needsUpdate=!0,a},t=s(new Float32Array(4),ae,re),e=s(new Uint32Array(4),ge,ce);t.name="engineClLights",e.name="engineClCells";const n=new Float32Array(4),l=new Float32Array(4),i=new Float32Array(4);return Q={lights:t,cells:e,params:n,params2:l,tiles:i,emptyLights:t.image,emptyCells:e.image,uniforms:{engineClLights:{value:t},engineClCells:{value:e},engineClParams:{value:n},engineClParams2:{value:l},engineClTiles:{value:i}},textures:Object.freeze({lights:t,cells:e}),bound:null},Q}function Le(){return G().uniforms}const Jt="RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",at="#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )",_e=`
#if defined( ${_t} )
	uniform highp sampler2D engineClLights;
	uniform highp usampler2D engineClCells;
	uniform vec4 engineClParams;
	uniform vec4 engineClParams2;
	uniform vec4 engineClTiles;
	struct EngineClLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
		vec3 direction;
		float coneCos;
		float penumbraCos;
		float cut;
		float near;
		bool spot;
	};
	highp ivec2 engineClLightTexel( const in highp int li, const in int row ) {
		return ivec2( li & ${W-1}, ( li >> 10 ) * ${j} + row );
	}
	highp ivec2 engineClCellTexel( const in highp int texel ) {
		return ivec2( texel & ${Tt-1}, texel >> 10 );
	}
	highp int engineClCellIndex( const in vec3 viewPos ) {
		ivec3 g = ivec3( engineClParams.xyz );
		ivec2 t = clamp( ivec2( gl_FragCoord.xy * engineClTiles.zw * engineClParams.xy ), ivec2( 0 ), g.xy - 1 );
		int s = clamp( int( floor( log( max( - viewPos.z, engineClParams2.y ) ) * engineClParams.w + engineClParams2.x ) ), 0, g.z - 1 );
		return ( s * g.y + t.y ) * g.x + t.x;
	}
	EngineClLight engineClFetch( const in highp int li, const in vec4 row0 ) {
		EngineClLight l;
		vec4 row1 = texelFetch( engineClLights, engineClLightTexel( li, 1 ), 0 );
		l.position = row0.xyz;
		l.distance = abs( row0.w );
		l.spot = row0.w < 0.0;
		l.color = row1.rgb;
		l.decay = row1.a;
		l.cut = 0.0;
		l.near = 0.0;
		if ( row1.a < 0.0 ) { // a point cut at its reach (row0.w): decay stored as -(decay + 1), row 2 = range, cutoff
			vec2 cut = texelFetch( engineClLights, engineClLightTexel( li, 2 ), 0 ).xy;
			l.decay = - row1.a - 1.0;
			l.distance = cut.x;
			l.cut = cut.y;
		}
		l.direction = vec3( 0.0, 0.0, 1.0 );
		l.coneCos = - 1.0;
		l.penumbraCos = 1.0;
		if ( l.spot ) {
			vec4 row2 = texelFetch( engineClLights, engineClLightTexel( li, 2 ), 0 );
			float k = length( row2.xyz );
			l.direction = row2.xyz / k;
			l.coneCos = - row2.w / k;
			l.penumbraCos = l.coneCos + 1.0 / k;
			// a spot's near shield (setSpot near): decay stored as decay + 8 * (near in quarter metres)
			float q = floor( l.decay * 0.125 );
			l.decay -= 8.0 * q;
			l.near = 0.25 * q;
		}
		return l;
	}
	void engineClLightInfo( const in EngineClLight l, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = l.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		if ( l.spot ) {
			float spotAttenuation = getSpotAttenuation( l.coneCos, l.penumbraCos, dot( light.direction, l.direction ) );
			// near shield: nothing within near m of the apex along the axis (a luminaire's housing; the pole beside a
			// street lamp's head is not lit white), fading in to full at near
			if ( l.near > 0.0 ) spotAttenuation *= smoothstep( 0.0, l.near, dot( lVector, l.direction ) );
			light.color = l.color * spotAttenuation;
		} else {
			light.color = l.color;
		}
		light.color *= getDistanceAttenuation( lightDistance, l.distance, l.decay );
		// a cut point fades out while its brightest channel falls from twice the cutoff to the cutoff (= at its reach):
		// cut hard there, each light ended in a visible ring
		if ( l.cut > 0.0 ) {
			light.color *= smoothstep( l.cut, 2.0 * l.cut, max( light.color.r, max( light.color.g, light.color.b ) ) );
		}
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif`,me=`#if defined( ${_t} ) && defined( RE_Direct )
	if ( engineClParams2.w > 0.0 ) {
		highp int engineClCell = engineClCellIndex( geometryPosition );
		highp uvec4 engineClQuad = texelFetch( engineClCells, engineClCellTexel( engineClCell >> 2 ), 0 );
		highp uint engineClWord = engineClQuad[ engineClCell & 3 ];
		int engineClCount = int( engineClWord >> ${yt}u );
		highp int engineClStart = int( engineClWord & ${(1<<yt)-1}u );
		for ( int engineClK = 0; engineClK < ${Rt}; engineClK ++ ) {
			if ( engineClK >= engineClCount ) break;
			if ( ( engineClK & 3 ) == 0 ) engineClQuad = texelFetch( engineClCells, engineClCellTexel( ( engineClStart + engineClK ) >> 2 ), 0 );
			highp int engineClLi = int( engineClQuad[ engineClK & 3 ] );
			vec4 engineClRow0 = texelFetch( engineClLights, engineClLightTexel( engineClLi, 0 ), 0 );
			vec3 engineClV = engineClRow0.xyz - geometryPosition;
			if ( dot( engineClV, engineClV ) >= engineClRow0.w * engineClRow0.w ) continue; // attenuation is 0 there
			engineClLightInfo( engineClFetch( engineClLi, engineClRow0 ), geometryPosition, directLight );
			if ( directLight.visible ) {
				${Jt}
			}
		}
	}
#endif
`;let ct=null;function pe(){if(ct!==null)return ct;const s=oe,t=[[s.common,"struct IncidentLight"],[s.lights_pars_begin,"float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent )"],[s.lights_pars_begin,"float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine )"],[s.lights_fragment_begin,"vec3 geometryPosition = - vViewPosition;"],[s.lights_fragment_begin,"IncidentLight directLight;"],[s.lights_fragment_begin,at],[s.lights_fragment_begin,Jt]],e=s.lights_fragment_begin;if(!t.every(([l,i])=>typeof l=="string"&&l.includes(i))||e.indexOf(at)!==e.lastIndexOf(at)||e.indexOf(at)<e.indexOf("IncidentLight directLight;"))return console.warn("[render] clustered lights: three.js light chunks changed, clustered lights disabled"),ct=!1,!1;s.lights_pars_begin+=_e,s.lights_fragment_begin=e.replace(at,me+at);const n=G().uniforms;for(const l in Kt){const i=Kt[l].uniforms;i&&i.pointLights&&!i.engineClLights&&Object.assign(i,n)}return ct=!0,!0}const X=new Float64Array(2);function jt(s,t,e){const n=s*s+t*t,l=e*e;if(n<=l){X[0]=-1/0,X[1]=1/0;return}const i=Math.sqrt(n-l),o=t*i+s*e,h=t*i-s*e;X[0]=o>0?(s*i-t*e)/o:-1/0,X[1]=h>0?(s*i+t*e)/h:1/0}function Gt(s){const t=new Array(s);for(let e=0;e<s;e++)t[e]={start:0,count:0};return t}class Me{constructor({maxLights:t=1024,grid:e=[16,9,24],zNear:n=.5,zFar:l=400,maxIndices:i=65536,timing:o=!1,cutoff:h=0}={}){const r=e[0]|0,a=e[1]|0,g=e[2]|0;if(!(r>0&&a>0&&g>0&&r<=4096&&a<=4096&&g<=4096))throw new RangeError("ClusteredLights: bad grid");if(!(t>=1&&t<=1<<20))throw new RangeError("ClusteredLights: maxLights must be 1 .. 2^20");if(!(n>0&&l>n))throw new RangeError("ClusteredLights: need 0 < zNear < zFar");this.maxLights=t|0,this.grid=Object.freeze([r,a,g]),this.zNear=n,this.zFar=l,this.timing=!!o,this.enabled=!0;const f=r*a*g;if(this.cellCount=f,this.cellBase=f+3&-4,this.maxIndices=Math.max(4,Math.ceil(i)+3&-4),this.cellBase+this.maxIndices>=2**yt)throw new RangeError("ClusteredLights: cells + maxIndices must stay below 2^24");this.sliceScale=g/Math.log(l/n),this.sliceBias=-Math.log(n)*this.sliceScale;const c=this.maxLights;this._wp=new Float64Array(c*4),this._wb=new Float64Array(c*2),this._wd=new Float64Array(c*4),this._wc=new Float64Array(c),this._wi=new Float64Array(c*2),this._flags=new Uint8Array(c),this._cutoff=0,this._count=0,this._spotN=0,this._spotLo=c,this._spotHi=0,this.lightsWidth=Math.min(c,W),this._bands=Math.ceil(c/W),this.lightData=new Float32Array(this.lightsWidth*4*j*this._bands),this._limg={data:this.lightData,width:this.lightsWidth,height:j*this._bands},this.cellsHeight=Math.ceil((this.cellBase+this.maxIndices)/dt),this.cellData=new Uint32Array(dt*this.cellsHeight),this._cimg={data:this.cellData,width:Tt,height:this.cellsHeight},this._cnt=new Uint32Array(f),this._start=new Uint32Array(f),this._n=new Uint8Array(f),this._fill=new Uint8Array(f),this._vis=new Uint32Array(c),this._vs0=new Uint16Array(c),this._vs1=new Uint16Array(c),this._rect=new Uint16Array(c*g*4),this._rp=new Uint32Array(c);const p=Math.exp(Ft/this.sliceScale);this._slabLo=new Float64Array(g),this._slabHi=new Float64Array(g);for(let d=0;d<g;d++)this._slabLo[d]=d===0?-1/0:this.sliceDepth(d)/p,this._slabHi[d]=d===g-1?1/0:this.sliceDepth(d+1)*p;this._lr=Gt(j*this._bands),this._cr=Gt(this.cellsHeight),this.width=1920,this.height=1080,this._mx=wt/1920,this._my=wt/1080,this.stats={lights:0,cells:0,indices:0,overflow:0,ms:0,maxPerCell:0,bytes:0},this._disposed=!1,this.cutoff=h,this._bind()}get cutoff(){return this._cutoff}set cutoff(t){if(t=t>0&&t<1/0?+t:0,t!==this._cutoff){this._cutoff=t;for(let e=0;e<this._count;e++)(this._flags[e]&(rt|k))===rt&&this._reach(e)}}get uniforms(){return G().uniforms}get textures(){return G().textures}get count(){return this._count}set count(t){t=Math.max(0,Math.min(this.maxLights,t|0));for(let e=t;e<this._count;e++)this._setFlags(e,0);this._count=t}setSize(t,e){this.width=Math.max(1,t|0),this.height=Math.max(1,e|0),this._mx=wt/this.width,this._my=wt/this.height,G().bound===this&&this._writeTiles()}setLight(t,e,n,l,i,o,h,r,a=2){this._check(t);const g=t*4,f=this._wp;f[g]=e,f[g+1]=n,f[g+2]=l,f[g+3]=i,this._wb[t*2]=0,this._wb[t*2+1]=i,this._row1(t,o,h,r,a),this._wi[t*2]=Math.max(o,h,r),this._wi[t*2+1]=a,this._setFlags(t,i>0&&i<1/0?rt|(o===0&&h===0&&r===0?It:0):0),this._cutoff>0&&this._flags[t]&rt&&this._reach(t)}setSpot(t,e,n,l,i,o,h,r,a,g,f,c,p,d,R=0){this._check(t);const A=Math.hypot(g,f,c);if(!(A>0)){this.setLight(t,e,n,l,i,o,h,r,a);return}g/=A,f/=A,c/=A;const m=Math.max(-1,Math.min(1,d)),S=Math.max(p,m+ue),w=t*4,et=this._wp,y=this._wd;et[w]=e,et[w+1]=n,et[w+2]=l,et[w+3]=i,y[w]=-g,y[w+1]=-f,y[w+2]=-c,y[w+3]=1/(S-m),this._wc[t]=m;let J=0,Y=i;m>=Math.SQRT1_2?(J=i/(2*m),Y=J):m>0&&(J=i*m,Y=i*Math.sqrt(1-m*m)),this._wb[t*2]=J,this._wb[t*2+1]=Y,this._row1(t,o,h,r,R>0&&a<8?a+8*Math.min(4096,Math.round(R*4)):a),this._setFlags(t,i>0&&i<1/0?rt|k|(o===0&&h===0&&r===0?It:0):0)}clearLight(t){if(this._check(t),this._setFlags(t,0),t===this._count-1){let e=t;for(;e>0&&!this._flags[e-1];)e--;this._count=e}}sliceOf(t){if(!(t>0))return 0;const e=Math.floor(Math.log(t)*this.sliceScale+this.sliceBias);return e<0?0:e>=this.grid[2]?this.grid[2]-1:e}sliceDepth(t){return this.zNear*Math.pow(this.zFar/this.zNear,t/this.grid[2])}cellOf(t,e,n){const[l,i,o]=this.grid,h=Math.min(l-1,Math.max(0,Math.floor(t/this.width*l))),r=Math.min(i-1,Math.max(0,Math.floor(e/this.height*i)));return(Math.min(o-1,Math.max(0,Math.floor(Math.log(Math.max(n,this.zNear))*this.sliceScale+this.sliceBias)))*i+r)*l+h}update(t){const e=this.timing?performance.now():0,n=this.stats;if(this._disposed)return;this._bind();const l=Q;if(!this.enabled||!t){l.params2[3]=0,n.lights=n.cells=n.indices=n.overflow=n.maxPerCell=n.bytes=0,n.ms=this.timing?performance.now()-e:0;return}t.updateWorldMatrix(!0,!1);const i=t.matrixWorldInverse.elements,o=t.projectionMatrix.elements,h=o[11]!==0,r=this.grid[0],a=this.grid[1],g=this.grid[2],f=this.sliceScale,c=this.sliceBias,p=this.zFar,d=this._mx,R=this._my,A=this._flags,m=this._wp,S=this._wb,w=this._wd,et=this._wc,y=this.lightData,J=this.lightsWidth,Y=this._cnt,B=this._rect,Ut=this._vis,zt=this._vs0,Nt=this._vs1,Pt=this._rp,ee=this._slabLo,ie=this._slabHi;Y.fill(0);let U=0,it=0;const Ot=this._count;for(let u=0;u<Ot;u++){const x=A[u];if(!(x&rt))continue;const _=u*4,M=m[_],gt=m[_+1],ft=m[_+2],vt=m[_+3],Z=((u>>10)*j*J+(u&W-1))*4;let z=i[0]*M+i[4]*gt+i[8]*ft+i[12],E=i[1]*M+i[5]*gt+i[9]*ft+i[13],ut=i[2]*M+i[6]*gt+i[10]*ft+i[14];if(y[Z]=z,y[Z+1]=E,y[Z+2]=ut,y[Z+3]=x&k?-vt:S[u*2+1],x&k){const D=w[_+3],b=w[_],F=w[_+1],H=w[_+2];let T=i[0]*b+i[4]*F+i[8]*H,N=i[1]*b+i[5]*F+i[9]*H,P=i[2]*b+i[6]*F+i[10]*H;const tt=1/Math.sqrt(T*T+N*N+P*P);T*=tt,N*=tt,P*=tt;const O=Z+2*J*4;y[O]=T*D,y[O+1]=N*D,y[O+2]=P*D,y[O+3]=-et[u]*D;const v=S[u*2];z-=T*v,E-=N*v,ut-=P*v}if(x&It)continue;const C=S[u*2+1],L=-ut,mt=L-C,pt=L+C;if(h&&pt<=0||mt>p)continue;let nt,lt,ot,ht;if(h?(jt(z,L,C),nt=X[0],lt=X[1],jt(E,L,C),ot=X[0],ht=X[1]):(nt=z-C,lt=z+C,ot=E-C,ht=E+C),this._tiles(h,o,nt,lt,ot,ht,d,R,r,a)===0)continue;const $t=mt>0?Math.min(g-1,Math.max(0,Math.floor(Math.log(mt)*f+c-Ft))):0,qt=pt>0?Math.min(g-1,Math.max(0,Math.floor(Math.log(pt)*f+c+Ft))):0;Ut[U]=u,zt[U]=$t,Nt[U]=qt,Pt[U]=it,U++;const ne=C*C;for(let D=$t;D<=qt;D++){const b=Math.max(ee[D],mt),F=Math.min(ie[D],pt);let H=1,T=0,N=1,P=0;if(b<=F){const tt=L<b?b-L:L>F?L-F:0,O=tt>0?Math.sqrt(Math.max(0,ne-tt*tt)):C;let v=z-O,V=z+O,$=E-O,q=E+O;if(h&&(b>0?(v=v<=0?v/b:v/F,V=V>=0?V/b:V/F,$=$<=0?$/b:$/F,q=q>=0?q/b:q/F,nt>v&&(v=nt),lt<V&&(V=lt),ot>$&&($=ot),ht<q&&(q=ht)):(v=nt,V=lt,$=ot,q=ht)),this._tiles(h,o,v,V,$,q,d,R,r,a)!==0){H=K[0],T=K[1],N=K[2],P=K[3];for(let At=N;At<=P;At++){const le=(D*a+At)*r;for(let Et=H;Et<=T;Et++)Y[le+Et]++}}else H=1,T=0}B[it]=H,B[it+1]=T,B[it+2]=N,B[it+3]=P,it+=4}}if(U===0){l.params2[3]=0,n.lights=n.cells=n.indices=n.overflow=n.maxPerCell=n.bytes=0,n.ms=this.timing?performance.now()-e:0;return}const xt=this.cellData,kt=this._start,Lt=this._n,Mt=this._fill,se=this.cellCount,Wt=this.cellBase+this.maxIndices;let st=this.cellBase,Bt=0,bt=0,Ht=0,Vt=0;for(let u=0;u<se;u++){const x=Y[u];if(Mt[u]=0,x===0){Lt[u]=0,xt[u]=0;continue}x>bt&&(bt=x);let _=x<Rt?x:Rt,M=_+3&-4;st+M>Wt&&(M=Wt-st,_=M),Bt+=x-_,Lt[u]=_,kt[u]=st,xt[u]=_>0?(st|_<<yt)>>>0:0,st+=M,Vt+=_,_>0&&Ht++}for(let u=0;u<U;u++){const x=Ut[u];let _=Pt[u];for(let M=zt[u],gt=Nt[u];M<=gt;M++,_+=4){const ft=B[_],vt=B[_+1],Z=B[_+2],z=B[_+3];for(let E=Z;E<=z;E++){const ut=(M*a+E)*r;for(let C=ft;C<=vt;C++){const L=ut+C;Mt[L]<Lt[L]&&(xt[kt[L]+Mt[L]++]=x)}}}}l.params[0]=r,l.params[1]=a,l.params[2]=g,l.params[3]=f,l.params2[0]=c,l.params2[1]=this.zNear,l.params2[2]=p,l.params2[3]=U,n.bytes=this._uploadLights(Ot)+this._uploadCells(st),n.lights=U,n.cells=Ht,n.indices=Vt,n.overflow=Bt,n.maxPerCell=bt,n.ms=this.timing?performance.now()-e:0}dispose(){if(this._disposed)return;this._disposed=!0;const t=G();t.bound===this&&(t.bound=null,Ct(t.lights,t.emptyLights),Ct(t.cells,t.emptyCells),t.params2[3]=0)}_check(t){if(!(t>=0&&t<this.maxLights)||(t|0)!==t)throw new RangeError(`ClusteredLights: light index ${t} outside 0 .. ${this.maxLights-1}`)}_setFlags(t,e){const n=this._flags[t];n&k&&!(e&k)&&--this._spotN===0&&(this._spotLo=this.maxLights,this._spotHi=0),e&k&&!(n&k)&&this._spotN++,e&k&&(t<this._spotLo&&(this._spotLo=t),t+1>this._spotHi&&(this._spotHi=t+1)),this._flags[t]=e,e&&t>=this._count&&(this._count=t+1)}_row1(t,e,n,l,i){const o=(((t>>10)*j+1)*this.lightsWidth+(t&W-1))*4,h=this.lightData;h[o]=e,h[o+1]=n,h[o+2]=l,h[o+3]=i}_reach(t){const e=this._wp[t*4+3],n=this._wi[t*2],l=this._wi[t*2+1],i=this._cutoff;let o=e;if(i>0&&n>0&&Qt(e*.999,e,n,l)<i){let f=0,c=e;for(let p=0;p<24;p++){const d=.5*(f+c);Qt(d,e,n,l)>=i?f=d:c=d}o=c}this._wb[t*2+1]=o;const h=((t>>10)*j*this.lightsWidth+(t&W-1))*4,r=this.lightData,a=h+this.lightsWidth*4,g=h+this.lightsWidth*8;o<e?(r[a+3]=-(l+1),r[g]=e,r[g+1]=i):r[a+3]=l}_tiles(t,e,n,l,i,o,h,r,a,g){let f,c,p,d;if(t?(f=e[0]*n-e[8],c=e[0]*l-e[8],p=e[5]*i-e[9],d=e[5]*o-e[9]):(f=e[0]*n+e[12],c=e[0]*l+e[12],p=e[5]*i+e[13],d=e[5]*o+e[13]),f>c){const w=f;f=c,c=w}if(p>d){const w=p;p=d,d=w}let R=Math.floor((f*.5+.5-h)*a),A=Math.floor((c*.5+.5+h)*a),m=Math.floor((p*.5+.5-r)*g),S=Math.floor((d*.5+.5+r)*g);return A>=0&&R<=a-1&&S>=0&&m<=g-1?(R>=0||(R=0),A>a-1&&(A=a-1),m>=0||(m=0),S>g-1&&(S=g-1),K[0]=R,K[1]=A,K[2]=m,K[3]=S,1):0}_bind(){const t=G();t.bound!==this&&(t.bound=this,Ct(t.lights,this._limg),Ct(t.cells,this._cimg),t.params[0]=this.grid[0],t.params[1]=this.grid[1],t.params[2]=this.grid[2],t.params[3]=this.sliceScale,t.params2[0]=this.sliceBias,t.params2[1]=this.zNear,t.params2[2]=this.zFar,t.params2[3]=0,this._writeTiles())}_writeTiles(){const t=Q.tiles;t[0]=this.width/this.grid[0],t[1]=this.height/this.grid[1],t[2]=1/this.width,t[3]=1/this.height}_uploadLights(t){const e=Q.lights,n=this._lr;e.clearUpdateRanges();let l=0,i=0;for(let o=0;o<this._bands;o++){const h=o*W,r=Math.min(h+W,t);if(r<=h)break;l=this._range(e,n,l,o,0,h,r),l=this._range(e,n,l,o,1,h,r),this._cutoff>0?l=this._range(e,n,l,o,2,h,r):this._spotN>0&&(l=this._range(e,n,l,o,2,Math.max(h,this._spotLo),Math.min(r,this._spotHi)))}if(l===0)return 0;for(let o=0;o<l;o++)i+=n[o].count*4;return e.needsUpdate=!0,i}_range(t,e,n,l,i,o,h){if(h<=o)return n;const r=e[n];return r.start=((l*j+i)*this.lightsWidth+(o-l*W))*4,r.count=(h-o)*4,t.updateRanges.push(r),n+1}_uploadCells(t){const e=Q.cells,n=this._cr;e.clearUpdateRanges();const l=Math.ceil(t/dt);for(let i=0;i<l;i++){const o=n[i];o.start=i*dt,o.count=Math.min(dt,t-o.start),e.updateRanges.push(o)}return e.needsUpdate=!0,t*4}}const K=new Int32Array(4);function Qt(s,t,e,n){const l=s/t,i=1-l*l*l*l;return e*i*i/Math.max(Math.pow(s,n),.01)}function Ct(s,t){const e=s.image;(!e||e.width!==t.width||e.height!==t.height)&&s.dispose(),s.image=t,s.clearUpdateRanges(),s.needsUpdate=!0}function we(s){return!!(s.isMeshStandardMaterial||s.isMeshLambertMaterial||s.isMeshPhongMaterial||s.isMeshToonMaterial||s.isShaderMaterial&&s.lights===!0)}function Xt(s,t){if(!s||!we(s))return!1;t&&ct===null&&pe();const e=!!t&&ct===!0;if(e===!!(s.defines&&_t in s.defines))return!1;if(e){if(s.isShaderMaterial){const n=G().uniforms,l=s.uniforms||(s.uniforms={});for(const i in n)l[i]||(l[i]=n[i])}(s.defines||(s.defines={}))[_t]=""}else delete s.defines[_t];return s.needsUpdate=!0,!0}const I={on:!1,n:0};function Ce(s){const t=s.material;if(t)if(Array.isArray(t))for(let e=0;e<t.length;e++)Xt(t[e],I.on)&&I.n++;else Xt(t,I.on)&&I.n++}function Yt(s,t){const e=I.on,n=I.n;I.on=!!t,I.n=0,s&&s.traverse(Ce);const l=I.n;return I.on=e,I.n=n,l}function St(s){const t=s.child;t&&(Yt(t,!0),t.traverse(Zt))}function Dt(s){s.child&&s.child.traverse(te)}function Zt(s){s.hasEventListener("childadded",St)||s.addEventListener("childadded",St),s.hasEventListener("childremoved",Dt)||s.addEventListener("childremoved",Dt)}function te(s){s.removeEventListener("childadded",St),s.removeEventListener("childremoved",Dt)}function be(s,t){const e=Yt(s,t);return s&&s.traverse(t?Zt:te),e}export{_t as CLUSTERED_DEFINE,Me as ClusteredLights,Rt as MAX_PER_CELL,Yt as applyClustered,Le as clusteredUniforms,pe as installClusteredChunks,Xt as setMaterialClustered,be as syncClustered};
