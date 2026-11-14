import{u as oe,ac as jt,ab as he,aV as re,R as ae,a8 as ce,aW as ge,n as fe}from"./three.module-B_yomNYV.js";const dt="ENGINE_CLUSTERED",It=64,k=1024,q=3,Tt=1024,ut=Tt*4,wt=24,pt=1,Et=.001,ue=1e-4,ht=1,W=2,Ft=4;class de extends fe{clone(){return this}}let Q=null;function G(){if(Q)return Q;const s=(o,h,r)=>{const c=new de(o,1,1,h,r);return c.minFilter=c.magFilter=he,c.generateMipmaps=!1,c.needsUpdate=!0,c},t=s(new Float32Array(4),ae,re),e=s(new Uint32Array(4),ge,ce);t.name="engineClLights",e.name="engineClCells";const n=new Float32Array(4),l=new Float32Array(4),i=new Float32Array(4);return Q={lights:t,cells:e,params:n,params2:l,tiles:i,emptyLights:t.image,emptyCells:e.image,uniforms:{engineClLights:{value:t},engineClCells:{value:e},engineClParams:{value:n},engineClParams2:{value:l},engineClTiles:{value:i}},textures:Object.freeze({lights:t,cells:e}),bound:null},Q}function xe(){return G().uniforms}const Jt="RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",rt="#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )",_e=`
#if defined( ${dt} )
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
		bool spot;
	};
	highp ivec2 engineClLightTexel( const in highp int li, const in int row ) {
		return ivec2( li & ${k-1}, ( li >> 10 ) * ${q} + row );
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
		}
		return l;
	}
	void engineClLightInfo( const in EngineClLight l, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = l.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		if ( l.spot ) {
			float spotAttenuation = getSpotAttenuation( l.coneCos, l.penumbraCos, dot( light.direction, l.direction ) );
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
#endif`,me=`#if defined( ${dt} ) && defined( RE_Direct )
	if ( engineClParams2.w > 0.0 ) {
		highp int engineClCell = engineClCellIndex( geometryPosition );
		highp uvec4 engineClQuad = texelFetch( engineClCells, engineClCellTexel( engineClCell >> 2 ), 0 );
		highp uint engineClWord = engineClQuad[ engineClCell & 3 ];
		int engineClCount = int( engineClWord >> ${wt}u );
		highp int engineClStart = int( engineClWord & ${(1<<wt)-1}u );
		for ( int engineClK = 0; engineClK < ${It}; engineClK ++ ) {
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
`;let at=null;function pe(){if(at!==null)return at;const s=oe,t=[[s.common,"struct IncidentLight"],[s.lights_pars_begin,"float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent )"],[s.lights_pars_begin,"float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine )"],[s.lights_fragment_begin,"vec3 geometryPosition = - vViewPosition;"],[s.lights_fragment_begin,"IncidentLight directLight;"],[s.lights_fragment_begin,rt],[s.lights_fragment_begin,Jt]],e=s.lights_fragment_begin;if(!t.every(([l,i])=>typeof l=="string"&&l.includes(i))||e.indexOf(rt)!==e.lastIndexOf(rt)||e.indexOf(rt)<e.indexOf("IncidentLight directLight;"))return console.warn("[render] clustered lights: three.js light chunks changed, clustered lights disabled"),at=!1,!1;s.lights_pars_begin+=_e,s.lights_fragment_begin=e.replace(rt,me+rt);const n=G().uniforms;for(const l in jt){const i=jt[l].uniforms;i&&i.pointLights&&!i.engineClLights&&Object.assign(i,n)}return at=!0,!0}const X=new Float64Array(2);function qt(s,t,e){const n=s*s+t*t,l=e*e;if(n<=l){X[0]=-1/0,X[1]=1/0;return}const i=Math.sqrt(n-l),o=t*i+s*e,h=t*i-s*e;X[0]=o>0?(s*i-t*e)/o:-1/0,X[1]=h>0?(s*i+t*e)/h:1/0}function Gt(s){const t=new Array(s);for(let e=0;e<s;e++)t[e]={start:0,count:0};return t}class Le{constructor({maxLights:t=1024,grid:e=[16,9,24],zNear:n=.5,zFar:l=400,maxIndices:i=65536,timing:o=!1,cutoff:h=0}={}){const r=e[0]|0,c=e[1]|0,g=e[2]|0;if(!(r>0&&c>0&&g>0&&r<=4096&&c<=4096&&g<=4096))throw new RangeError("ClusteredLights: bad grid");if(!(t>=1&&t<=1<<20))throw new RangeError("ClusteredLights: maxLights must be 1 .. 2^20");if(!(n>0&&l>n))throw new RangeError("ClusteredLights: need 0 < zNear < zFar");this.maxLights=t|0,this.grid=Object.freeze([r,c,g]),this.zNear=n,this.zFar=l,this.timing=!!o,this.enabled=!0;const f=r*c*g;if(this.cellCount=f,this.cellBase=f+3&-4,this.maxIndices=Math.max(4,Math.ceil(i)+3&-4),this.cellBase+this.maxIndices>=2**wt)throw new RangeError("ClusteredLights: cells + maxIndices must stay below 2^24");this.sliceScale=g/Math.log(l/n),this.sliceBias=-Math.log(n)*this.sliceScale;const a=this.maxLights;this._wp=new Float64Array(a*4),this._wb=new Float64Array(a*2),this._wd=new Float64Array(a*4),this._wc=new Float64Array(a),this._wi=new Float64Array(a*2),this._flags=new Uint8Array(a),this._cutoff=0,this._count=0,this._spotN=0,this._spotLo=a,this._spotHi=0,this.lightsWidth=Math.min(a,k),this._bands=Math.ceil(a/k),this.lightData=new Float32Array(this.lightsWidth*4*q*this._bands),this._limg={data:this.lightData,width:this.lightsWidth,height:q*this._bands},this.cellsHeight=Math.ceil((this.cellBase+this.maxIndices)/ut),this.cellData=new Uint32Array(ut*this.cellsHeight),this._cimg={data:this.cellData,width:Tt,height:this.cellsHeight},this._cnt=new Uint32Array(f),this._start=new Uint32Array(f),this._n=new Uint8Array(f),this._fill=new Uint8Array(f),this._vis=new Uint32Array(a),this._vs0=new Uint16Array(a),this._vs1=new Uint16Array(a),this._rect=new Uint16Array(a*g*4),this._rp=new Uint32Array(a);const m=Math.exp(Et/this.sliceScale);this._slabLo=new Float64Array(g),this._slabHi=new Float64Array(g);for(let d=0;d<g;d++)this._slabLo[d]=d===0?-1/0:this.sliceDepth(d)/m,this._slabHi[d]=d===g-1?1/0:this.sliceDepth(d+1)*m;this._lr=Gt(q*this._bands),this._cr=Gt(this.cellsHeight),this.width=1920,this.height=1080,this._mx=pt/1920,this._my=pt/1080,this.stats={lights:0,cells:0,indices:0,overflow:0,ms:0,maxPerCell:0,bytes:0},this._disposed=!1,this.cutoff=h,this._bind()}get cutoff(){return this._cutoff}set cutoff(t){if(t=t>0&&t<1/0?+t:0,t!==this._cutoff){this._cutoff=t;for(let e=0;e<this._count;e++)(this._flags[e]&(ht|W))===ht&&this._reach(e)}}get uniforms(){return G().uniforms}get textures(){return G().textures}get count(){return this._count}set count(t){t=Math.max(0,Math.min(this.maxLights,t|0));for(let e=t;e<this._count;e++)this._setFlags(e,0);this._count=t}setSize(t,e){this.width=Math.max(1,t|0),this.height=Math.max(1,e|0),this._mx=pt/this.width,this._my=pt/this.height,G().bound===this&&this._writeTiles()}setLight(t,e,n,l,i,o,h,r,c=2){this._check(t);const g=t*4,f=this._wp;f[g]=e,f[g+1]=n,f[g+2]=l,f[g+3]=i,this._wb[t*2]=0,this._wb[t*2+1]=i,this._row1(t,o,h,r,c),this._wi[t*2]=Math.max(o,h,r),this._wi[t*2+1]=c,this._setFlags(t,i>0&&i<1/0?ht|(o===0&&h===0&&r===0?Ft:0):0),this._cutoff>0&&this._flags[t]&ht&&this._reach(t)}setSpot(t,e,n,l,i,o,h,r,c,g,f,a,m,d){this._check(t);const b=Math.hypot(g,f,a);if(!(b>0)){this.setLight(t,e,n,l,i,o,h,r,c);return}g/=b,f/=b,a/=b;const C=Math.max(-1,Math.min(1,d)),E=Math.max(m,C+ue),p=t*4,y=this._wp,Z=this._wd;y[p]=e,y[p+1]=n,y[p+2]=l,y[p+3]=i,Z[p]=-g,Z[p+1]=-f,Z[p+2]=-a,Z[p+3]=1/(E-C),this._wc[t]=C;let x=0,tt=i;C>=Math.SQRT1_2?(x=i/(2*C),tt=x):C>0&&(x=i*C,tt=i*Math.sqrt(1-C*C)),this._wb[t*2]=x,this._wb[t*2+1]=tt,this._row1(t,o,h,r,c),this._setFlags(t,i>0&&i<1/0?ht|W|(o===0&&h===0&&r===0?Ft:0):0)}clearLight(t){if(this._check(t),this._setFlags(t,0),t===this._count-1){let e=t;for(;e>0&&!this._flags[e-1];)e--;this._count=e}}sliceOf(t){if(!(t>0))return 0;const e=Math.floor(Math.log(t)*this.sliceScale+this.sliceBias);return e<0?0:e>=this.grid[2]?this.grid[2]-1:e}sliceDepth(t){return this.zNear*Math.pow(this.zFar/this.zNear,t/this.grid[2])}cellOf(t,e,n){const[l,i,o]=this.grid,h=Math.min(l-1,Math.max(0,Math.floor(t/this.width*l))),r=Math.min(i-1,Math.max(0,Math.floor(e/this.height*i)));return(Math.min(o-1,Math.max(0,Math.floor(Math.log(Math.max(n,this.zNear))*this.sliceScale+this.sliceBias)))*i+r)*l+h}update(t){const e=this.timing?performance.now():0,n=this.stats;if(this._disposed)return;this._bind();const l=Q;if(!this.enabled||!t){l.params2[3]=0,n.lights=n.cells=n.indices=n.overflow=n.maxPerCell=n.bytes=0,n.ms=this.timing?performance.now()-e:0;return}t.updateWorldMatrix(!0,!1);const i=t.matrixWorldInverse.elements,o=t.projectionMatrix.elements,h=o[11]!==0,r=this.grid[0],c=this.grid[1],g=this.grid[2],f=this.sliceScale,a=this.sliceBias,m=this.zFar,d=this._mx,b=this._my,C=this._flags,E=this._wp,p=this._wb,y=this._wd,Z=this._wc,x=this.lightData,tt=this.lightsWidth,yt=this._cnt,B=this._rect,Ut=this._vis,zt=this._vs0,Nt=this._vs1,Pt=this._rp,ee=this._slabLo,ie=this._slabHi;yt.fill(0);let U=0,et=0;const Ot=this._count;for(let u=0;u<Ot;u++){const L=C[u];if(!(L&ht))continue;const _=u*4,v=E[_],ct=E[_+1],gt=E[_+2],vt=E[_+3],J=((u>>10)*q*tt+(u&k-1))*4;let z=i[0]*v+i[4]*ct+i[8]*gt+i[12],F=i[1]*v+i[5]*ct+i[9]*gt+i[13],ft=i[2]*v+i[6]*ct+i[10]*gt+i[14];if(x[J]=z,x[J+1]=F,x[J+2]=ft,x[J+3]=L&W?-vt:p[u*2+1],L&W){const D=y[_+3],A=y[_],I=y[_+1],H=y[_+2];let T=i[0]*A+i[4]*I+i[8]*H,N=i[1]*A+i[5]*I+i[9]*H,P=i[2]*A+i[6]*I+i[10]*H;const Y=1/Math.sqrt(T*T+N*N+P*P);T*=Y,N*=Y,P*=Y;const O=J+2*tt*4;x[O]=T*D,x[O+1]=N*D,x[O+2]=P*D,x[O+3]=-Z[u]*D;const R=p[u*2];z-=T*R,F-=N*R,ft-=P*R}if(L&Ft)continue;const w=p[u*2+1],M=-ft,_t=M-w,mt=M+w;if(h&&mt<=0||_t>m)continue;let st,nt,lt,ot;if(h?(qt(z,M,w),st=X[0],nt=X[1],qt(F,M,w),lt=X[0],ot=X[1]):(st=z-w,nt=z+w,lt=F-w,ot=F+w),this._tiles(h,o,st,nt,lt,ot,d,b,r,c)===0)continue;const $t=_t>0?Math.min(g-1,Math.max(0,Math.floor(Math.log(_t)*f+a-Et))):0,Kt=mt>0?Math.min(g-1,Math.max(0,Math.floor(Math.log(mt)*f+a+Et))):0;Ut[U]=u,zt[U]=$t,Nt[U]=Kt,Pt[U]=et,U++;const ne=w*w;for(let D=$t;D<=Kt;D++){const A=Math.max(ee[D],_t),I=Math.min(ie[D],mt);let H=1,T=0,N=1,P=0;if(A<=I){const Y=M<A?A-M:M>I?M-I:0,O=Y>0?Math.sqrt(Math.max(0,ne-Y*Y)):w;let R=z-O,V=z+O,$=F-O,K=F+O;if(h&&(A>0?(R=R<=0?R/A:R/I,V=V>=0?V/A:V/I,$=$<=0?$/A:$/I,K=K>=0?K/A:K/I,st>R&&(R=st),nt<V&&(V=nt),lt>$&&($=lt),ot<K&&(K=ot)):(R=st,V=nt,$=lt,K=ot)),this._tiles(h,o,R,V,$,K,d,b,r,c)!==0){H=j[0],T=j[1],N=j[2],P=j[3];for(let At=N;At<=P;At++){const le=(D*c+At)*r;for(let Rt=H;Rt<=T;Rt++)yt[le+Rt]++}}else H=1,T=0}B[et]=H,B[et+1]=T,B[et+2]=N,B[et+3]=P,et+=4}}if(U===0){l.params2[3]=0,n.lights=n.cells=n.indices=n.overflow=n.maxPerCell=n.bytes=0,n.ms=this.timing?performance.now()-e:0;return}const xt=this.cellData,Wt=this._start,Lt=this._n,Mt=this._fill,se=this.cellCount,kt=this.cellBase+this.maxIndices;let it=this.cellBase,Bt=0,bt=0,Ht=0,Vt=0;for(let u=0;u<se;u++){const L=yt[u];if(Mt[u]=0,L===0){Lt[u]=0,xt[u]=0;continue}L>bt&&(bt=L);let _=L<It?L:It,v=_+3&-4;it+v>kt&&(v=kt-it,_=v),Bt+=L-_,Lt[u]=_,Wt[u]=it,xt[u]=_>0?(it|_<<wt)>>>0:0,it+=v,Vt+=_,_>0&&Ht++}for(let u=0;u<U;u++){const L=Ut[u];let _=Pt[u];for(let v=zt[u],ct=Nt[u];v<=ct;v++,_+=4){const gt=B[_],vt=B[_+1],J=B[_+2],z=B[_+3];for(let F=J;F<=z;F++){const ft=(v*c+F)*r;for(let w=gt;w<=vt;w++){const M=ft+w;Mt[M]<Lt[M]&&(xt[Wt[M]+Mt[M]++]=L)}}}}l.params[0]=r,l.params[1]=c,l.params[2]=g,l.params[3]=f,l.params2[0]=a,l.params2[1]=this.zNear,l.params2[2]=m,l.params2[3]=U,n.bytes=this._uploadLights(Ot)+this._uploadCells(it),n.lights=U,n.cells=Ht,n.indices=Vt,n.overflow=Bt,n.maxPerCell=bt,n.ms=this.timing?performance.now()-e:0}dispose(){if(this._disposed)return;this._disposed=!0;const t=G();t.bound===this&&(t.bound=null,Ct(t.lights,t.emptyLights),Ct(t.cells,t.emptyCells),t.params2[3]=0)}_check(t){if(!(t>=0&&t<this.maxLights)||(t|0)!==t)throw new RangeError(`ClusteredLights: light index ${t} outside 0 .. ${this.maxLights-1}`)}_setFlags(t,e){const n=this._flags[t];n&W&&!(e&W)&&--this._spotN===0&&(this._spotLo=this.maxLights,this._spotHi=0),e&W&&!(n&W)&&this._spotN++,e&W&&(t<this._spotLo&&(this._spotLo=t),t+1>this._spotHi&&(this._spotHi=t+1)),this._flags[t]=e,e&&t>=this._count&&(this._count=t+1)}_row1(t,e,n,l,i){const o=(((t>>10)*q+1)*this.lightsWidth+(t&k-1))*4,h=this.lightData;h[o]=e,h[o+1]=n,h[o+2]=l,h[o+3]=i}_reach(t){const e=this._wp[t*4+3],n=this._wi[t*2],l=this._wi[t*2+1],i=this._cutoff;let o=e;if(i>0&&n>0&&Qt(e*.999,e,n,l)<i){let f=0,a=e;for(let m=0;m<24;m++){const d=.5*(f+a);Qt(d,e,n,l)>=i?f=d:a=d}o=a}this._wb[t*2+1]=o;const h=((t>>10)*q*this.lightsWidth+(t&k-1))*4,r=this.lightData,c=h+this.lightsWidth*4,g=h+this.lightsWidth*8;o<e?(r[c+3]=-(l+1),r[g]=e,r[g+1]=i):r[c+3]=l}_tiles(t,e,n,l,i,o,h,r,c,g){let f,a,m,d;if(t?(f=e[0]*n-e[8],a=e[0]*l-e[8],m=e[5]*i-e[9],d=e[5]*o-e[9]):(f=e[0]*n+e[12],a=e[0]*l+e[12],m=e[5]*i+e[13],d=e[5]*o+e[13]),f>a){const y=f;f=a,a=y}if(m>d){const y=m;m=d,d=y}let b=Math.floor((f*.5+.5-h)*c),C=Math.floor((a*.5+.5+h)*c),E=Math.floor((m*.5+.5-r)*g),p=Math.floor((d*.5+.5+r)*g);return C>=0&&b<=c-1&&p>=0&&E<=g-1?(b>=0||(b=0),C>c-1&&(C=c-1),E>=0||(E=0),p>g-1&&(p=g-1),j[0]=b,j[1]=C,j[2]=E,j[3]=p,1):0}_bind(){const t=G();t.bound!==this&&(t.bound=this,Ct(t.lights,this._limg),Ct(t.cells,this._cimg),t.params[0]=this.grid[0],t.params[1]=this.grid[1],t.params[2]=this.grid[2],t.params[3]=this.sliceScale,t.params2[0]=this.sliceBias,t.params2[1]=this.zNear,t.params2[2]=this.zFar,t.params2[3]=0,this._writeTiles())}_writeTiles(){const t=Q.tiles;t[0]=this.width/this.grid[0],t[1]=this.height/this.grid[1],t[2]=1/this.width,t[3]=1/this.height}_uploadLights(t){const e=Q.lights,n=this._lr;e.clearUpdateRanges();let l=0,i=0;for(let o=0;o<this._bands;o++){const h=o*k,r=Math.min(h+k,t);if(r<=h)break;l=this._range(e,n,l,o,0,h,r),l=this._range(e,n,l,o,1,h,r),this._cutoff>0?l=this._range(e,n,l,o,2,h,r):this._spotN>0&&(l=this._range(e,n,l,o,2,Math.max(h,this._spotLo),Math.min(r,this._spotHi)))}if(l===0)return 0;for(let o=0;o<l;o++)i+=n[o].count*4;return e.needsUpdate=!0,i}_range(t,e,n,l,i,o,h){if(h<=o)return n;const r=e[n];return r.start=((l*q+i)*this.lightsWidth+(o-l*k))*4,r.count=(h-o)*4,t.updateRanges.push(r),n+1}_uploadCells(t){const e=Q.cells,n=this._cr;e.clearUpdateRanges();const l=Math.ceil(t/ut);for(let i=0;i<l;i++){const o=n[i];o.start=i*ut,o.count=Math.min(ut,t-o.start),e.updateRanges.push(o)}return e.needsUpdate=!0,t*4}}const j=new Int32Array(4);function Qt(s,t,e,n){const l=s/t,i=1-l*l*l*l;return e*i*i/Math.max(Math.pow(s,n),.01)}function Ct(s,t){const e=s.image;(!e||e.width!==t.width||e.height!==t.height)&&s.dispose(),s.image=t,s.clearUpdateRanges(),s.needsUpdate=!0}function Ce(s){return!!(s.isMeshStandardMaterial||s.isMeshLambertMaterial||s.isMeshPhongMaterial||s.isMeshToonMaterial||s.isShaderMaterial&&s.lights===!0)}function Xt(s,t){if(!s||!Ce(s))return!1;t&&at===null&&pe();const e=!!t&&at===!0;if(e===!!(s.defines&&dt in s.defines))return!1;if(e){if(s.isShaderMaterial){const n=G().uniforms,l=s.uniforms||(s.uniforms={});for(const i in n)l[i]||(l[i]=n[i])}(s.defines||(s.defines={}))[dt]=""}else delete s.defines[dt];return s.needsUpdate=!0,!0}const S={on:!1,n:0};function we(s){const t=s.material;if(t)if(Array.isArray(t))for(let e=0;e<t.length;e++)Xt(t[e],S.on)&&S.n++;else Xt(t,S.on)&&S.n++}function Yt(s,t){const e=S.on,n=S.n;S.on=!!t,S.n=0,s&&s.traverse(we);const l=S.n;return S.on=e,S.n=n,l}function St(s){const t=s.child;t&&(Yt(t,!0),t.traverse(Zt))}function Dt(s){s.child&&s.child.traverse(te)}function Zt(s){s.hasEventListener("childadded",St)||s.addEventListener("childadded",St),s.hasEventListener("childremoved",Dt)||s.addEventListener("childremoved",Dt)}function te(s){s.removeEventListener("childadded",St),s.removeEventListener("childremoved",Dt)}function Me(s,t){const e=Yt(s,t);return s&&s.traverse(t?Zt:te),e}export{dt as CLUSTERED_DEFINE,Le as ClusteredLights,It as MAX_PER_CELL,Yt as applyClustered,xe as clusteredUniforms,pe as installClusteredChunks,Xt as setMaterialClustered,Me as syncClustered};
