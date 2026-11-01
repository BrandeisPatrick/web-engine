import{h as u,e as l,c as d}from"./index-CcqdAHtD.js";import{a7 as f,i as h}from"./LoadingScreen-D-xrkYm6.js";class n{constructor(t={}){f(),this.el=null,this.textHz=t.textHz??15,this._textTimer=1,this._cache=Object.create(null)}mount(t){const e=u(t);return e&&this.el&&e.appendChild(this.el),this}mountTo(t){return t?this.mount(t):this}unmount(){return this.el&&this.el.remove(),this}tickText(t){return this._textTimer+=t,this._textTimer>=1/this.textHz?(this._textTimer=0,!0):!1}setText(t,e,s){this._cache[t]!==s&&(this._cache[t]=s,e.textContent=s)}setHTML(t,e,s){this._cache[t]!==s&&(this._cache[t]=s,e.innerHTML=s)}setAttr(t,e,s,i){this._cache[t]!==i&&(this._cache[t]=i,e.setAttribute(s,i))}setStyle(t,e,s,i){this._cache[t]!==i&&(this._cache[t]=i,e.style[s]=i)}toggleClass(t,e,s,i){i=!!i,this._cache[t]!==i&&(this._cache[t]=i,e.classList.toggle(s,i))}setVisible(t){return this.el&&(this.el.style.display=t?"":"none"),this}update(t,...e){}dispose(){this.unmount()}}class w extends n{constructor(t={}){super(t),this.el=l("div",`ui-root${t.className?` ${t.className}`:""}`),t.zIndex!=null&&(this.el.style.zIndex=String(t.zIndex)),this.mount(t.parent||document.body),this.autoScale=t.autoScale===!1?null:{refW:1440,refH:900,minW:820,min:.45,max:1.25,...t.autoScale||{}},this.scale=1,this._scaleCbs=[],this._onResize=this._onResize.bind(this),this.autoScale&&(window.addEventListener("resize",this._onResize),this._onResize())}onScale(t){return this._scaleCbs.push(t),t(this.scale),this}_onResize(){const t=this.autoScale,e=window.innerWidth,s=window.innerHeight,i=d(Math.min(e/t.refW,s/t.refH,e/t.minW),t.min,t.max);this.scale=i,this.el.style.setProperty("--ui-scale",i.toFixed(3));for(const r of this._scaleCbs)r(i)}dispose(){window.removeEventListener("resize",this._onResize),super.dispose()}}class z extends n{constructor(t={}){super(t);const e=["ui-w","ui-panel"];t.corner&&e.push("ui-corner",`ui-${t.corner}`),t.glass!==!1&&e.push("ui-glass"),t.className&&e.push(t.className),this.el=l(t.tag||"div",e.join(" ")),t.style&&Object.assign(this.el.style,t.style),this.mountTo(t.parent)}add(t){const e=u(t);return t&&t.el?t.mount(this):e&&this.el.appendChild(e),t}}const m=`
.ui-readout.contents{display:contents}
.ui-rv.xl{font-size:78px;line-height:1;font-weight:200;letter-spacing:-.03em}
.ui-rv.lg{font-size:36px;font-weight:200;line-height:1;letter-spacing:-.02em}
.ui-rv.md{font-size:28px;font-weight:200;line-height:1}
.ui-rv.sm{font-size:15px;font-weight:300}
.ui-rv small{color:var(--ui-mute)}
.ui-rv.lg small{font-size:14px;margin-left:3px}
.ui-rv.md small{font-size:12px;margin-left:2px}
.ui-readout-unit{margin-top:2px}
.ui-readout-sub{margin-top:6px;font-size:13px;color:var(--ui-mute)}
`;class $ extends n{constructor(t={}){super(t),h("ui-readout",m),this.unit=t.unit||"";const e=this.el=l("div",`ui-w ui-readout${t.contents?" contents":""}${t.className?` ${t.className}`:""}`);this.labelEl=t.label!=null?l("div","ui-label",e,t.label):null,this.valueEl=l("div",`ui-rv ui-num${t.size?` ${t.size}`:""}${t.valueClass?` ${t.valueClass}`:""}`,e),this.unitLabelEl=t.unitLabel!=null?l("div","ui-label ui-readout-unit",e,t.unitLabel):null,this.subEl=t.sub!=null?l("div","ui-readout-sub ui-num",e,t.sub):null,this.set(t.value??"0"),this.mountTo(t.parent)}set(t,e=this.unit){e?this.setHTML("v",this.valueEl,`${t}<small>${e}</small>`):this.setText("v",this.valueEl,String(t))}setSub(t){this.subEl&&this.setText("sub",this.subEl,t)}setLabel(t){this.labelEl&&this.setText("label",this.labelEl,t)}}const x=`
.ui-flash{position:absolute;z-index:3;left:50%;top:24%;transform:translate(-50%,-50%);font-size:28px;font-weight:300;
  letter-spacing:.35em;text-transform:uppercase;white-space:nowrap;opacity:0;text-shadow:0 2px 20px rgba(0,0,0,.6);pointer-events:none}
.ui-flash::after{content:"";display:block;height:2px;margin:10px auto 0;width:60%;background:var(--ui-accent);border-radius:1px}
.ui-flash.show{animation:uiFlash 2.1s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes uiFlash{0%{opacity:0;transform:translate(-50%,-40%) scale(.96);letter-spacing:.6em}
  12%{opacity:1;transform:translate(-50%,-50%) scale(1);letter-spacing:.35em}
  75%{opacity:1}100%{opacity:0;transform:translate(-50%,-56%)}}
`;class _ extends n{constructor(t={}){super(t),h("ui-flash",x),this.el=l("div",`ui-w ui-flash${t.className?` ${t.className}`:""}`),this.mountTo(t.parent)}show(t){const e=this.el;e.textContent=String(t),e.classList.remove("show"),e.offsetWidth,e.classList.add("show")}}const g=`
.ui-help{position:absolute;left:50%;top:50%;width:min(460px,calc(100vw - 32px));padding:22px 26px 18px;
  transform:translate(-50%,-50%) scale(var(--ui-scale));transition:opacity .35s;opacity:1}
.ui-help.hidden{opacity:0}
.ui-help h3{margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.32em;color:#fff}
.ui-help h3 b{color:var(--ui-accent);font-weight:600}
.ui-help table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
.ui-help td{padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.ui-help td:first-child{color:#fff;font-weight:500;white-space:nowrap;padding-right:16px}
.ui-help td:last-child{color:rgba(235,240,247,.7);text-align:right}
.ui-help .pad{margin-top:10px;font-size:11px;color:rgba(235,240,247,.5);line-height:1.5}
.ui-help .hint{margin-top:12px;text-align:center;font-size:11px;letter-spacing:.2em;color:rgba(235,240,247,.75)}
.ui-help .hint kbd{display:inline-block;padding:1px 7px;border:1px solid rgba(255,255,255,.35);border-radius:4px;font-family:inherit;color:#fff}
@media (max-width:760px){.ui-help td:last-child{text-align:left}}
`;class y extends n{constructor(t={}){super(t),h("ui-help",g),this.el=l("div",`ui-w ui-help ui-glass hidden${t.className?` ${t.className}`:""}`),this.setContent(t),this.visible=!1,this.mountTo(t.parent),t.visible&&this.show(!0)}setContent({title:t="",subtitle:e="",rows:s=[],footnote:i="",hint:r=""}={}){let o="";for(const[c,p]of s)o+=`<tr><td>${c}</td><td>${p}</td></tr>`;this.el.innerHTML=`<h3>${t}</h3>
      ${e?`<div class="ui-label">${e}</div>`:""}
      <table>${o}</table>
      ${i?`<div class="pad">${i}</div>`:""}
      ${r?`<div class="hint">${r}</div>`:""}`}show(t){return this.visible=!!t,this.el.classList.toggle("hidden",!t),this.visible}toggle(){return this.show(!this.visible)}}export{_ as F,y as H,z as P,$ as R,w as U,n as W};
