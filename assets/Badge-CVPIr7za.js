import{W as i}from"./HelpOverlay-BydqqTGx.js";import{i as s}from"./LoadingScreen-D-xrkYm6.js";import{e as r}from"./index-DdVyjZko.js";const o=`
.ui-badge{position:relative;padding:5px 12px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.28em;
  border:1px solid rgba(255,255,255,.22);color:#fff;overflow:hidden}
.ui-badge.on{border-color:var(--ui-accent);background:rgba(var(--ui-accent-rgb),.18);box-shadow:0 0 18px rgba(var(--ui-accent-rgb),.35)}
.ui-badge.anim{animation:uiBadge .7s cubic-bezier(.2,.8,.2,1)}
.ui-badge.anim::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);
  transform:translateX(-120%);animation:uiSweep .7s ease-out}
@keyframes uiBadge{0%{transform:rotateX(90deg) scale(.9);opacity:.2}60%{transform:rotateX(-12deg) scale(1.06);opacity:1}100%{transform:none}}
@keyframes uiSweep{to{transform:translateX(120%)}}
`;class g extends i{constructor(e={}){super(e),s("ui-badge",o),this.el=r("div",`ui-w ui-badge${e.className?` ${e.className}`:""}`,null,e.text??""),this.on=!1,this.mountTo(e.parent)}set(e,t=this.on,{animate:a=!1}={}){this.el.textContent=e,this.on=!!t,this.el.classList.toggle("on",this.on),a&&this.pulse()}pulse(){this.el.classList.remove("anim"),this.el.offsetWidth,this.el.classList.add("anim")}}export{g as B};
