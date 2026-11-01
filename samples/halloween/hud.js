// DOM HUD and screens for Midnight Candy Run, on the engine UI kit's theme (setTheme: accent, font) plus its own CSS:
//   title     logo, tag line, a big tap-to-start button (the gesture that also starts audio), HOW TO PLAY / sound /
//             full-screen buttons, three how-to cards (hidden on short landscape screens: HOW TO PLAY opens them),
//             the control scheme for this device, best score
//   help      the how-to-play panel (cards, controls, tips), from the title and the pause screen
//   hud       candy counter (+N pops) with the next rank's threshold after it ("/130"), a streak meter along its bottom
//             edge while a streak runs and a gold "x2" badge in the Witching Hour; the clock to midnight with a progress
//             bar (its time-left line shows "+12 VS BEST" for a moment every 20 s once a best run is recorded);
//             full-screen (where the Fullscreen API exists: not on iPhone) / sound / pause buttons; centre call-outs
//             (STOMP!, CAUGHT -6, BOO!, a new rank: white letters, a dark outline, a coloured glow); the last ten
//             seconds counting down under the clock; a cold frost on the edges when a ghost is close, and (desktop) a
//             BOO cooldown meter; on phones the BOO button itself shows the ring (TouchControls).
//             Edge markers: a lollipop + distance at the screen edge toward an off-screen big pop, ghost chevrons
//             toward chasers that are off screen or behind; BOO glows ("hot") while a chaser is in reach; a look
//             hint pill (desktop: how the mouse looks)
//   pause     resume / restart / how to play / title / music / sound
//   results   candy, rank title, the rank ladder and what the next rank takes, best (NEW BEST), stats, PLAY AGAIN /
//             TITLE / share (the game shares through Web Share on phones, else copies; a toast says so)
// Everything sits inside env(safe-area-inset-*) and scales with the viewport (clamp + vmin), so it works in portrait
// and landscape phones as well as desktop. Interactive elements have z-index 40 (over the touch layer's 30). Every
// button is at least 44 x 44 CSS px. setTouch(on) switches between the touch and the keyboard / mouse presentation
// (a laptop with a touchscreen reveals the touch controls on its first touch).
import { setTheme, injectStyle, UIDom } from '@vibe/engine/ui';

export const ACCENT = '#ff8a1e';
const { el } = UIDom;

const ICON = {
  candy: '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M6 6l9 7-9 7 1 4 13-8a10 10 0 0 0 8 0l13 8 1-4-9-7 9-7-1-4-13 8a10 10 0 0 0-8 0L7 2z" fill="#ff4f8b"/><ellipse cx="24" cy="16" rx="9" ry="7" fill="#ff7aa8"/><path d="M19 12c3 4 7 6 10 8" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/></svg>',
  pumpkin: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 12c-2-5 1-8 4-9l1 3c-2 1-3 3-2 6z" fill="#5fae4a"/><ellipse cx="15" cy="28" rx="11" ry="14" fill="#ff7a1a"/><ellipse cx="33" cy="28" rx="11" ry="14" fill="#ff7a1a"/><ellipse cx="24" cy="28" rx="10" ry="15" fill="#ff8f2a"/><path d="M14 24l5-5 3 5zm20 0l-5-5-3 5zM14 32q10 9 20 0l-3 1-2-2-3 3-3-3-3 3-3-3z" fill="#ffe27a"/></svg>',
  ghost: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 44V22a16 16 0 0 1 32 0v22l-5-4-5 4-6-4-6 4-5-4z" fill="#eef1ff"/><ellipse cx="18" cy="22" rx="3" ry="4.5" fill="#1b1028"/><ellipse cx="30" cy="22" rx="3" ry="4.5" fill="#1b1028"/><ellipse cx="24" cy="32" rx="3.5" ry="4" fill="#1b1028"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3z" fill="#ffe9b0"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  windowed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const CARDS = `
  <div class="hw-card">${ICON.candy}<div><b>Grab candy</b><span>Run past it and it flies into your pail.</span></div></div>
  <div class="hw-card">${ICON.pumpkin}<div><b>Smash lanterns</b><span>Kick or stomp jack-o'-lanterns: candy spills out.</span></div></div>
  <div class="hw-card">${ICON.ghost}<div><b>BOO the ghosts</b><span>A touch steals candy. Shout BOO to scare them off.</span></div></div>`;
const CTRL_TOUCH = 'Left thumb: move &nbsp;·&nbsp; Right thumb: drag to look &nbsp;·&nbsp; JUMP &nbsp;·&nbsp; BOO! &nbsp;·&nbsp; ❚❚ pause';
const CTRL_KEYS = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &nbsp;·&nbsp; mouse look &nbsp;·&nbsp; <kbd>←</kbd><kbd>→</kbd> turn &nbsp;·&nbsp; <kbd>Space</kbd> jump &nbsp;·&nbsp; <kbd>E</kbd> BOO &nbsp;·&nbsp; <kbd>Esc</kbd> pause &nbsp;·&nbsp; gamepad: stick, A, X';
const POP_ICON = '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M11 15h2v16h-2z" fill="#f3ead8"/><circle cx="12" cy="10" r="9" fill="#fff4fa"/><path d="M12 10m-6 0a6 6 0 1 0 12 0a4 4 0 1 0-8 0a2 2 0 1 0 4 0" stroke="#ff3d8b" stroke-width="2.4" fill="none"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15l7-8 7 8" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---- full screen (Android Chrome, desktop, iPad; iPhone Safari has no element full screen: the button stays hidden)
const fsDoc = () => /** @type {any} */ (document);
export function canFullscreen() {
  const d = fsDoc(), e = /** @type {any} */ (document.documentElement);
  return !!((d.fullscreenEnabled || d.webkitFullscreenEnabled) && (e.requestFullscreen || e.webkitRequestFullscreen));
}
export const isFullscreen = () => !!(fsDoc().fullscreenElement || fsDoc().webkitFullscreenElement);
/** Enter (then ask for a landscape lock) or leave full screen; a refusal anywhere is harmless. */
export function toggleFullscreen() {
  const d = fsDoc(), e = /** @type {any} */ (document.documentElement);
  try {
    if (isFullscreen()) { const p = (d.exitFullscreen || d.webkitExitFullscreen).call(d); if (p && p.catch) p.catch(() => {}); return; }
    const lock = () => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch { /* no lock */ } };
    const p = (e.requestFullscreen || e.webkitRequestFullscreen).call(e, { navigationUI: 'hide' });
    if (p && p.then) p.then(lock, () => {}); else lock();
  } catch { /* refused */ }
}

const CSS = `
:root{--hw-orange:#ff8a1e;--hw-purple:#9b5cff;--hw-green:#6dff8a;--hw-ink:#140a1f;
  --sa-t:env(safe-area-inset-top,0px);--sa-r:env(safe-area-inset-right,0px);--sa-b:env(safe-area-inset-bottom,0px);--sa-l:env(safe-area-inset-left,0px);
  --hw-font:"Avenir Next","Avenir","Segoe UI","Trebuchet MS",system-ui,-apple-system,sans-serif}
.hw{position:fixed;inset:0;pointer-events:none;z-index:20;color:#fff;font-family:var(--hw-font);-webkit-user-select:none;user-select:none;
  -webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.hw *{box-sizing:border-box}
.hw svg{display:block}
.hw button{font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;min-width:44px;min-height:44px}
/* ---------------- in-game HUD */
.hw-hud{position:absolute;inset:0;padding:calc(var(--sa-t) + 10px) calc(var(--sa-r) + 12px) calc(var(--sa-b) + 10px) calc(var(--sa-l) + 12px);transition:opacity .4s}
.hw-hud.off{opacity:0;visibility:hidden}
.hw-pill{display:flex;align-items:center;gap:10px;padding:6px 16px 6px 10px;border-radius:999px;
  background:linear-gradient(160deg,rgba(40,18,58,.78),rgba(18,8,28,.7));border:1px solid rgba(255,170,90,.25);
  box-shadow:0 6px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.hw-candy{position:absolute;left:calc(var(--sa-l) + 12px);top:calc(var(--sa-t) + 10px)}
.hw-candy svg{width:clamp(34px,6vmin,46px);height:auto;filter:drop-shadow(0 0 6px rgba(255,79,139,.6))}
.hw-candy b{font-size:clamp(26px,5.4vmin,40px);font-weight:800;letter-spacing:-.01em;font-variant-numeric:tabular-nums;min-width:1.6em;
  text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 18px rgba(255,138,30,.45)}
.hw-candy.bump b{animation:hwBump .28s ease-out}
@keyframes hwBump{0%{transform:scale(1.35);color:#ffe27a}100%{transform:scale(1)}}
.hw-candy{position:absolute}
/* the next rank's threshold after the count ("/100"), muted; empty at the top rank */
.hw-candy .goal{font-size:clamp(13px,2.7vmin,18px);font-weight:700;color:rgba(255,226,196,.6);margin-left:-8px;font-variant-numeric:tabular-nums;align-self:flex-end;
  margin-bottom:.5em;white-space:nowrap}
.hw-candy .goal:empty{display:none}
/* Witching Hour: a gold "x2" badge on the pill's corner, the pill glows */
.hw-x2{position:absolute;right:-9px;top:-8px;padding:2px 7px 2px 6px;border-radius:999px;font-style:normal;font-weight:900;font-size:13px;line-height:1.15;
  color:#2a1000;background:linear-gradient(180deg,#ffe27a,#ff8a1e);box-shadow:0 0 12px rgba(255,150,40,.85);opacity:0;transform:scale(.5);transition:opacity .3s,transform .3s}
.hw-candy.wh .hw-x2{opacity:1;transform:none}
.hw-candy.wh{border-color:rgba(255,196,96,.8);box-shadow:0 0 22px rgba(255,140,30,.5),0 6px 24px rgba(0,0,0,.35)}
/* a streak (5+ quick pickups): a segmented meter along the candy pill's bottom edge fills toward the bonus */
.hw-streak{position:absolute;left:14px;right:14px;bottom:4px;height:4px;display:flex;gap:3px;opacity:0;transition:opacity .2s}
.hw-streak.on{opacity:1}
.hw-streak i{flex:1;border-radius:2px;background:rgba(255,255,255,.16)}
.hw-streak i.f{background:#ffd36a;box-shadow:0 0 6px rgba(255,190,80,.95)}
.hw-plus{position:absolute;left:calc(100% + 8px);top:50%;margin-top:-.6em;font-weight:800;font-size:clamp(18px,3.6vmin,26px);line-height:1.2;
  color:#ffe27a;text-shadow:0 0 10px rgba(255,180,60,.8),0 2px 0 rgba(0,0,0,.4);opacity:0;white-space:nowrap}
.hw-plus.go{animation:hwPlus .9s ease-out forwards}
.hw-plus.bad{color:#d9b8ff;text-shadow:0 0 10px rgba(160,90,255,.9)}
@keyframes hwPlus{0%{opacity:0;transform:translateX(-8px) scale(.8)}15%{opacity:1;transform:none}70%{opacity:1}100%{opacity:0;transform:translateX(10px)}}
.hw-clock{position:absolute;left:50%;top:calc(var(--sa-t) + 10px);transform:translateX(-50%);flex-direction:column;gap:3px;padding:7px 18px 9px;border-radius:16px;min-width:clamp(150px,30vmin,210px)}
.hw-clock .row{display:flex;align-items:center;gap:8px;justify-content:center;white-space:nowrap}
.hw-clock svg{width:18px;height:18px}
.hw-clock .time{font-size:clamp(18px,3.8vmin,24px);font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.hw-clock .left{font-size:11px;letter-spacing:.24em;color:rgba(255,230,200,.7);font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.hw-clock .bar{width:100%;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
.hw-clock .bar i{display:block;height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,var(--hw-purple),var(--hw-orange))}
.hw-clock.late .time{color:#ffb35c;animation:hwPulse 1s ease-in-out infinite}
/* the pace against the best run: for a moment it takes the place of the time-left line */
.hw-clock .pace{position:absolute;left:0;right:0;bottom:9px;text-align:center;font-size:11px;line-height:normal;letter-spacing:.2em;font-weight:800;opacity:0;
  white-space:nowrap;font-variant-numeric:tabular-nums}
.hw-clock .pace.up{color:#8dffa6;text-shadow:0 0 10px rgba(80,255,130,.6)}.hw-clock .pace.down{color:#ffa08e;text-shadow:0 0 10px rgba(255,110,80,.55)}
.hw-clock.pacing .pace{animation:hwPace 2.6s ease forwards}
.hw-clock.pacing .left{animation:hwPaceOut 2.6s ease forwards}
@keyframes hwPace{0%{opacity:0}10%,84%{opacity:1}100%{opacity:0}}
@keyframes hwPaceOut{0%{opacity:1}10%,84%{opacity:0}100%{opacity:1}}
@keyframes hwPulse{50%{color:#ff5a3c;text-shadow:0 0 14px rgba(255,90,60,.8)}}
.hw-btns{position:absolute;right:calc(var(--sa-r) + 12px);top:calc(var(--sa-t) + 10px);display:flex;gap:10px;pointer-events:auto;z-index:40}
.hw-icon{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;
  background:linear-gradient(160deg,rgba(40,18,58,.8),rgba(18,8,28,.72));border:1px solid rgba(255,170,90,.25);padding:0}
.hw-icon svg{width:22px;height:22px}
.hw-icon:active{transform:scale(.92)}
/* call-outs: white letters with a dark outline (8 hard shadows) and a glow in the call-out's colour: lavender on the
   purple night used to vanish. Landscape: higher, over the sky instead of the path ahead (lower while the last-ten
   countdown shows under the clock) */
.hw-call{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);text-align:center;font-weight:900;font-size:clamp(30px,8vmin,64px);letter-spacing:.04em;
  white-space:nowrap;opacity:0;color:#fff;--glow:rgba(255,190,70,.95);--ink:#1b0b28;
  text-shadow:2px 2px 0 var(--ink),-2px 2px 0 var(--ink),2px -2px 0 var(--ink),-2px -2px 0 var(--ink),0 3px 0 var(--ink),0 -3px 0 var(--ink),3px 0 0 var(--ink),-3px 0 0 var(--ink),
  0 6px 0 rgba(0,0,0,.3),0 0 26px var(--glow)}
.hw-call.go{animation:hwCall 1.15s cubic-bezier(.2,.9,.25,1) forwards}
.hw-call.boo{--glow:rgba(176,120,255,1)}.hw-call.bad{--glow:rgba(150,96,255,1)}.hw-call.warn{--glow:rgba(255,120,56,1)}.hw-call.good{--glow:rgba(80,255,130,.95)}
.hw-call.rank,.hw-call.witch{--glow:rgba(255,176,40,1)}
.hw-call.rank{font-size:clamp(23px,6.4vmin,52px)} /* "LORD OF THE NIGHT!" fits a 360 px phone */
.hw-call small{display:block;font-size:.42em;letter-spacing:.14em;margin-top:.3em;color:#ffe9b8;
  text-shadow:1px 1px 0 var(--ink),-1px 1px 0 var(--ink),1px -1px 0 var(--ink),-1px -1px 0 var(--ink),0 2px 0 var(--ink),0 0 14px var(--glow)}
.hw-call.good small{color:#c8ffd4}.hw-call.boo small,.hw-call.bad small{color:#e6d6ff}
@keyframes hwCall{0%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}14%{opacity:1;transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(.96)}}
@media (orientation:landscape){.hw-call{top:max(30%,calc(var(--sa-t) + 120px))}}
.hw-hud.counting .hw-call{top:44%}
/* the last ten seconds count down just under the clock pill (at the centre they covered the action) */
.hw-count{position:absolute;left:50%;top:calc(100% + 2px);transform:translateX(-50%);font-weight:900;font-size:clamp(36px,8.5vmin,64px);line-height:1;color:#fff;opacity:0;
  text-shadow:0 0 24px rgba(255,120,40,.95),0 3px 0 rgba(0,0,0,.4);font-variant-numeric:tabular-nums}
.hw-count.go{animation:hwCount .9s ease-out forwards}
@keyframes hwCount{0%{opacity:0;transform:translateX(-50%) scale(1.5)}20%{opacity:.95;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translateX(-50%) scale(.85)}}
/* a ghost close by: a cold, pale frost on the screen edges (a purple one vanished into the purple night) */
/* its clear centre moves away from the ghost, so the frost is thickest on the side it comes from */
.hw-danger{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at var(--fx,50%) var(--fy,50%),rgba(0,0,0,0) 48%,rgba(150,205,255,.32) 80%,rgba(225,240,255,.62) 100%);transition:opacity .2s}
.hw-flash{position:absolute;inset:0;background:#fff;opacity:0}
.hw-flash.go{animation:hwFlash .6s ease-out}
@keyframes hwFlash{0%{opacity:.75}100%{opacity:0}}
.hw-boo{position:absolute;left:50%;bottom:calc(var(--sa-b) + 18px);transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:6px 16px 6px 6px}
.hw-boo .ring{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;letter-spacing:.06em;
  background:conic-gradient(var(--hw-purple) calc(var(--p,1) * 1turn),rgba(255,255,255,.12) 0)}
.hw-boo .ring span{width:34px;height:34px;border-radius:50%;background:#1d0f2c;display:flex;align-items:center;justify-content:center}
.hw-boo.ready .ring{box-shadow:0 0 16px rgba(155,92,255,.8)}
.hw-boo small{font-size:12px;letter-spacing:.18em;color:rgba(255,255,255,.75);font-weight:600}
.hw-boo kbd,.hw-screen kbd{display:inline-block;padding:1px 7px;margin:0 2px;border:1px solid rgba(255,255,255,.4);border-radius:5px;font-family:inherit;font-size:.92em}
.hw-touch .hw-boo{display:none}
.hw-boo.hot .ring{animation:hwHotRing .5s ease-in-out infinite}
@keyframes hwHotRing{50%{box-shadow:0 0 26px 6px rgba(190,140,255,.95)}}
/* desktop: how the mouse looks (shown for a few seconds at the start) */
.hw-hint{position:absolute;left:50%;bottom:calc(var(--sa-b) + 76px);transform:translateX(-50%);padding:8px 18px;font-size:13px;font-weight:800;
  letter-spacing:.16em;white-space:nowrap;opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .35s}
.hw-hint.on{opacity:1;visibility:visible;transition:opacity .35s}
.hw-touch .hw-hint{display:none}
/* edge markers: an off-screen big pop (lollipop + distance), ghosts coming from off screen / behind (chevrons) */
.hw-edge{position:absolute;left:0;top:0;width:0;height:0;opacity:0;visibility:hidden;will-change:transform}
.hw-edge.on{visibility:visible}
.hw-edge .in{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle,rgba(40,14,52,.82) 55%,rgba(40,14,52,0) 72%)}
.hw-edge .in svg{width:22px;height:30px}
.hw-edge .arr{position:absolute;left:-14px;top:-14px;width:28px;height:28px;color:#ff7ab8}
.hw-edge .arr svg{width:28px;height:28px;transform:translateY(-30px)}
.hw-edge b{position:absolute;left:-30px;top:24px;width:60px;text-align:center;font-size:12px;font-weight:800;letter-spacing:.06em;color:#ffd6ea;
  text-shadow:0 1px 0 rgba(0,0,0,.6),0 0 8px rgba(255,80,160,.7);font-variant-numeric:tabular-nums}
.hw-edge.pop{opacity:1}
.hw-edge.ghost .in{background:radial-gradient(circle,rgba(200,225,255,.28) 40%,rgba(200,225,255,0) 70%)}
.hw-edge.ghost .in svg{width:30px;height:30px;filter:drop-shadow(0 0 6px rgba(190,220,255,.9))}
.hw-edge.ghost .arr{color:#dbe9ff}
/* ---------------- screens (title / pause / results) */
.hw-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(8px,2vmin,16px);
  padding:calc(var(--sa-t) + 16px) calc(var(--sa-r) + 18px) calc(var(--sa-b) + 16px) calc(var(--sa-l) + 18px);pointer-events:auto;z-index:40;text-align:center;
  background:radial-gradient(ellipse at 50% 45%,rgba(20,8,30,.25) 0%,rgba(12,5,20,.72) 70%,rgba(8,3,14,.92) 100%);transition:opacity .45s;overflow:hidden}
.hw-screen.off{opacity:0;pointer-events:none;visibility:hidden}
.hw-logo{line-height:.86;font-weight:900;letter-spacing:.02em;filter:drop-shadow(0 6px 0 rgba(0,0,0,.35)) drop-shadow(0 0 28px rgba(255,120,30,.45))}
.hw-logo .s{display:block;font-size:clamp(20px,5.2vmin,40px);line-height:1.15;letter-spacing:.42em;color:#d9c2ff;margin-right:-.42em;margin-bottom:.12em;text-shadow:0 0 18px rgba(160,100,255,.9)}
.hw-logo .b{display:block;font-size:clamp(46px,13vmin,112px);background:linear-gradient(180deg,#ffe27a 0%,#ff9a2a 45%,#ff5a14 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:hwWobble 3.2s ease-in-out infinite}
@keyframes hwWobble{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg) translateY(-2px)}}
.hw-tag{font-size:clamp(14px,3vmin,19px);color:rgba(255,240,225,.88);max-width:34em;font-weight:500}
.hw-start{margin-top:clamp(4px,1.5vmin,12px);font-size:clamp(20px,4.6vmin,30px);font-weight:900;letter-spacing:.14em;color:#26100a;cursor:pointer;
  padding:clamp(14px,2.8vmin,20px) clamp(34px,8vmin,56px);border-radius:999px;border:0;background:linear-gradient(180deg,#ffd36a,#ff8a1e 55%,#ff6a12);
  box-shadow:0 0 0 4px rgba(255,138,30,.25),0 10px 30px rgba(255,100,20,.45),inset 0 -4px 0 rgba(120,40,0,.35);animation:hwBreathe 1.6s ease-in-out infinite}
.hw-start:active{transform:scale(.96)}
@keyframes hwBreathe{50%{box-shadow:0 0 0 12px rgba(255,138,30,.12),0 10px 40px rgba(255,100,20,.65),inset 0 -4px 0 rgba(120,40,0,.35)}}
.hw-cards{display:flex;gap:clamp(8px,1.8vmin,14px);justify-content:center;flex-wrap:wrap;max-width:min(860px,100%)}
.hw-card{flex:1 1 0;min-width:150px;max-width:250px;display:flex;align-items:center;gap:10px;text-align:left;padding:10px 14px;border-radius:16px;
  background:linear-gradient(160deg,rgba(46,20,66,.8),rgba(20,9,32,.75));border:1px solid rgba(255,170,90,.18)}
.hw-card svg{width:40px;height:40px;flex:0 0 auto}
.hw-card b{display:block;font-size:15px;font-weight:800;color:#ffd38a}
.hw-card span{display:block;font-size:12.5px;line-height:1.3;color:rgba(255,240,230,.82)}
.hw-ctrl{font-size:clamp(11.5px,2.4vmin,14px);color:rgba(255,235,220,.72);letter-spacing:.04em;line-height:1.5;max-width:44em}
.hw-best{font-size:13px;letter-spacing:.3em;color:#d9c2ff;font-weight:700}
.hw-title-btns{align-items:center}.hw-title-btns .hw-btn2{padding:10px 18px}
.hw-help{background:radial-gradient(ellipse at 50% 40%,rgba(30,12,46,.95),rgba(9,4,16,.97));z-index:45}
.hw-help .hw-cards{display:flex}.hw-help .hw-ctrl{max-width:40em}
.hw-tips{font-size:clamp(12px,2.5vmin,14px);color:rgba(255,240,225,.8);max-width:36em;line-height:1.45}
.hw-small-btns{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.hw-btn2{font-size:clamp(14px,3vmin,17px);font-weight:800;letter-spacing:.12em;color:#fff;cursor:pointer;padding:12px 24px;border-radius:999px;
  border:1px solid rgba(255,170,90,.4);background:linear-gradient(160deg,rgba(60,26,86,.9),rgba(28,12,44,.9))}
.hw-btn2:active{transform:scale(.96)}
.hw-row{align-items:center}.hw-row .hw-start{margin-top:0}
.hw-h1{font-size:clamp(28px,7vmin,56px);font-weight:900;letter-spacing:.06em;color:#ffcf5a;text-shadow:0 0 24px rgba(255,138,30,.6),0 4px 0 rgba(0,0,0,.35)}
.hw-sub{font-size:clamp(12px,2.6vmin,15px);letter-spacing:.3em;color:#d9c2ff;font-weight:700}
.hw-score{display:flex;align-items:center;gap:14px;font-size:clamp(56px,16vmin,120px);font-weight:900;line-height:1;color:#fff;text-shadow:0 0 30px rgba(255,79,139,.6)}
.hw-score svg{width:clamp(50px,11vmin,90px);height:auto}
.hw-rank{font-size:clamp(18px,4.4vmin,28px);font-weight:800;color:#ffd38a}
.hw-newbest{display:inline-block;padding:5px 14px;border-radius:999px;background:linear-gradient(90deg,#9b5cff,#ff8a1e);font-weight:900;letter-spacing:.25em;font-size:13px;color:#fff;
  text-shadow:0 1px 0 rgba(60,10,40,.6);animation:hwBest 1s ease-in-out infinite}
@keyframes hwBest{50%{transform:scale(1.08);box-shadow:0 0 18px rgba(255,150,60,.75)}}
.hw-stats{display:grid;grid-template-columns:repeat(4,auto);gap:6px clamp(14px,4vmin,30px);justify-content:center}
.hw-stats div{display:flex;flex-direction:column;align-items:center;gap:2px}
.hw-stats b{font-size:clamp(18px,4vmin,24px);font-weight:800}
.hw-stats span{font-size:10.5px;letter-spacing:.2em;color:rgba(255,235,220,.65);font-weight:700}
/* results: the rank ladder (one segment per rank, the current one filled up to the next) and what the next rank takes */
.hw-ladder{display:flex;gap:4px;width:clamp(180px,44vmin,300px);height:7px;margin-top:-2px;flex-shrink:0}
.hw-ladder i{flex:1;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden;position:relative}
.hw-ladder i b{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#9b5cff,#ff8a1e);border-radius:4px}
.hw-break{display:none}
@media (orientation:portrait){.hw-break{display:block;flex-basis:100%;height:0}}
.hw-next{font-size:12px;letter-spacing:.2em;color:rgba(255,226,196,.8);font-weight:700}
.hw-next:empty{display:none}
.hw-toast{position:absolute;left:50%;bottom:calc(var(--sa-b) + 18px);transform:translateX(-50%);padding:8px 18px;font-size:13px;font-weight:800;letter-spacing:.16em;
  white-space:nowrap;opacity:0;pointer-events:none}
.hw-toast.go{animation:hwToast 1.8s ease forwards}
@keyframes hwToast{0%{opacity:0}12%,75%{opacity:1}100%{opacity:0}}
/* reduced motion: no zooming call-outs or bouncing badges (the game also skips the camera shake and FOV punch) */
@media (prefers-reduced-motion:reduce){
  .hw-call.go,.hw-count.go{animation-name:hwFade}.hw-candy.bump b{animation:none}
  .hw-logo .b,.hw-start,.hw-newbest{animation:none}
  .hw-touch-on .ui-touch-btn.hw-boo-btn.hw-boo-hot{animation:none;box-shadow:0 0 30px 8px rgba(190,140,255,.9),0 6px 18px rgba(0,0,0,.35)}
  .hw-boo.hot .ring{animation:none;box-shadow:0 0 26px 6px rgba(190,140,255,.95)}
}
@keyframes hwFade{0%{opacity:0}12%,75%{opacity:1}100%{opacity:0}}
@media (max-height:500px){
  .hw-cards{display:none}
  .hw-screen{gap:5px}
  .hw-screen .hw-sub{font-size:11px}
  .hw-h1{font-size:clamp(24px,9vh,40px)}
  .hw-score{font-size:clamp(40px,15vh,64px)}.hw-score svg{width:44px}
  .hw-rank{font-size:18px}
  .hw-stats b{font-size:17px}.hw-stats span{font-size:9.5px}
  .hw-screen .hw-start{padding:10px 30px;font-size:19px}
  .hw-btn2{padding:9px 18px;font-size:13px}
}
@media (max-height:500px){
  .hw-help .hw-cards{display:flex;flex-direction:row;flex-wrap:nowrap;max-width:100%}.hw-help .hw-card{min-width:0;padding:6px 10px}
  .hw-help .hw-card svg{width:28px;height:28px}.hw-help .hw-card span{font-size:11px}.hw-help .hw-card b{font-size:13px}
  .hw-title-wrap .hw-ctrl{display:none}.hw-tips{font-size:11.5px}
  .hw-title-btns .hw-btn2{padding:6px 14px;font-size:12px}
}
@media (max-height:500px) and (min-width:700px){
  .hw-title-wrap .hw-cards{display:flex}.hw-card{padding:6px 10px}.hw-card svg{width:30px;height:30px}.hw-card span{font-size:11px}
}
@media (orientation:portrait){
  .hw-stats{grid-template-columns:repeat(2,auto)}
  .hw-cards{flex-direction:column;align-items:stretch;max-width:340px}
  .hw-card{max-width:none}
  .hw-clock{top:calc(var(--sa-t) + 64px)}
}
/* touch controls skin */
.hw-touch-on .ui-touch-btn{font:900 15px/1 var(--hw-font);letter-spacing:.08em;color:#fff;border:2px solid rgba(255,190,120,.55);
  background:radial-gradient(circle at 50% 35%,rgba(255,150,60,.42),rgba(120,40,10,.35));box-shadow:0 6px 18px rgba(0,0,0,.35);text-shadow:0 1px 0 rgba(0,0,0,.4)}
.hw-touch-on .ui-touch-btn.hw-boo-btn{border-color:rgba(200,160,255,.7);background:radial-gradient(circle at 50% 35%,rgba(170,110,255,.5),rgba(50,20,90,.45))}
.hw-touch-on .ui-touch-btn.on{transform:scale(.92);background:radial-gradient(circle at 50% 35%,rgba(255,200,120,.75),rgba(200,80,20,.55))}
.hw-touch-on .ui-touch-btn.hw-boo-btn.on{background:radial-gradient(circle at 50% 35%,rgba(220,190,255,.8),rgba(110,50,200,.6))}
.hw-touch-on .ui-touch-btn.hw-boo-btn.hw-boo-hot{border-color:#f1e4ff;animation:hwHot .5s ease-in-out infinite}
@keyframes hwHot{50%{scale:1.08;box-shadow:0 0 30px 8px rgba(190,140,255,.9),0 6px 18px rgba(0,0,0,.35)}}
/* border-box: the floating base's centre lands exactly under the thumb (with the border outside the box it sat 2 px off,
   a bias that read as a push before the thumb had moved) */
.hw-touch-on .ui-touch-stick{box-sizing:border-box;border:2px solid rgba(255,190,120,.4);background:rgba(40,16,60,.25)}
.hw-touch-on .ui-touch-knob{background:radial-gradient(circle at 50% 35%,rgba(255,190,110,.75),rgba(255,120,30,.5));border-color:rgba(255,220,170,.8)}
.hw-touch-on .ui-touch-btn.cooling::after{background:conic-gradient(#c9a2ff calc(var(--ui-touch-p,0) * 1turn),rgba(255,255,255,.14) 0)}
.hw-touch-on .ui-touch-stick.on{border-color:rgba(255,210,150,.85);background:rgba(60,24,90,.4);box-shadow:0 0 22px rgba(255,140,40,.35)}
.hw-touch-on .ui-touch-stick.on .ui-touch-knob{background:radial-gradient(circle at 50% 35%,rgba(255,225,160,.95),rgba(255,140,40,.75));box-shadow:0 0 16px rgba(255,160,60,.7)}
.hw-hidden-touch .ui-touch{display:none}
`;

// rank thresholds (candy in a 3-minute round), tuned on the phone bots after gameplay round 2 (18 rounds: novice and
// one-hand 92..165, casual 108..175, skilled 306..454): a fumbled first round is a Little Pumpkin, novice and casual
// rounds split between Candy Collector and Sugar Goblin, skilled ones are Pumpkin Royalty, and Lord of the Night takes
// the best third of the skilled bot's rounds (a bot that sees every candy on the map)
export const RANKS = [[0, 'Little Pumpkin'], [40, 'Trick-or-Treater'], [90, 'Candy Collector'], [160, 'Sugar Goblin'], [260, 'Pumpkin Royalty'], [420, 'Lord of the Night']];
/** Index into RANKS for n candy. */
export const rankIndex = (n) => { let r = 0; for (let k = 1; k < RANKS.length; k++) if (n >= RANKS[k][0]) r = k; return r; };
export const rankFor = (n) => RANKS[rankIndex(n)][1];
/** The next rank's threshold above n candy (null at the top rank). */
export const nextRankAt = (n) => { const k = rankIndex(n) + 1; return k < RANKS.length ? RANKS[k][0] : null; };const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H16" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>';

export function applyTheme() {
  setTheme({ accent: ACCENT, font: '"Avenir Next","Segoe UI",system-ui,sans-serif' });
  injectStyle('hw-style', CSS);
}

export class HUD {
  constructor({ touch = false, streak = 10, onStart, onPause, onResume, onRestart, onTitle, onMute, onMusic, onShare } = {}) {
    applyTheme();
    this.touch = touch;
    const root = this.root = el('div', 'hw', document.body);
    const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    const fs = canFullscreen();
    this.muteBtns = []; this.fsBtns = []; this.ctrlEls = [];
    const wire = (b, fn) => { b.addEventListener('click', stop(fn)); b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
    // ---- HUD
    const hud = this.hud = el('div', 'hw-hud off', root);
    this.danger = el('div', 'hw-danger', hud);
    this.flashEl = el('div', 'hw-flash', hud);
    const candy = this.candyEl = el('div', 'hw-pill hw-candy', hud, `${ICON.candy}<b>0</b><small class="goal"></small><i class="hw-x2">×2</i>`);
    this.candyNum = candy.querySelector('b'); this.goalEl = candy.querySelector('.goal');
    this.plus = el('div', 'hw-plus', candy);
    this.streakEl = el('div', 'hw-streak', candy, '<i></i>'.repeat(streak));
    this.pips = [...this.streakEl.children];
    const clock = this.clock = el('div', 'hw-pill hw-clock', hud, `<div class="row">${ICON.moon}<span class="time">11:57 PM</span></div><div class="bar"><i></i></div><div class="left">3:00 TO MIDNIGHT</div>`);
    this.clockTime = clock.querySelector('.time'); this.clockBar = clock.querySelector('.bar i'); this.clockLeft = clock.querySelector('.left');
    this.paceEl = el('div', 'pace', clock);
    const btns = el('div', 'hw-btns', hud);
    if (fs) { const b = el('button', 'hw-icon hw-fs', btns, ICON.fullscreen); b.setAttribute('aria-label', 'Full screen'); this.fsBtns.push(b); }
    this.muteBtn = el('button', 'hw-icon hw-mute', btns, ICON.sound); this.muteBtn.setAttribute('aria-label', 'Sound');
    this.pauseBtn = el('button', 'hw-icon hw-pause', btns, ICON.pause); this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.muteBtns.push(this.muteBtn);
    wire(this.pauseBtn, () => onPause && onPause());
    this.call = el('div', 'hw-call', hud);
    this.count = el('div', 'hw-count', clock);
    this.boo = el('div', 'hw-pill hw-boo ready', hud, '<div class="ring"><span>BOO</span></div><small>PRESS <kbd>E</kbd></small>');
    this.booRing = this.boo.querySelector('.ring');
    this.hint = el('div', 'hw-pill hw-hint', hud);
    this.callSub = document.createElement('small');
    // edge markers (placed by the game each frame through setEdge; DOM written only when a rounded value changes)
    const edge = (cls, icon) => {
      const e = el('div', `hw-edge ${cls}`, hud, `<div class="arr">${CHEVRON}</div><div class="in">${icon}</div><b></b>`);
      return { el: e, arr: e.querySelector('.arr'), num: e.querySelector('b'), on: false, x: -1, y: -1, a: 999, o: -1, d: -1 };
    };
    this.popEdge = edge('pop', POP_ICON);
    this.ghostEdges = [edge('ghost', ICON.ghost), edge('ghost', ICON.ghost), edge('ghost', ICON.ghost)];
    // ---- title
    const title = this.title = el('div', 'hw-screen hw-title-wrap', root);
    title.innerHTML = `
      <div class="hw-logo"><span class="s">MIDNIGHT</span><span class="b">CANDY RUN</span></div>
      <div class="hw-tag">It's Halloween night. Grab every sweet in the pumpkin patch and the graveyard before the clock strikes twelve!</div>
      <button class="hw-start">TAP TO START</button>
      <div class="hw-small-btns hw-title-btns"><button class="hw-btn2" data-a="help">HOW TO PLAY</button><button class="hw-icon hw-mute" aria-label="Sound">${ICON.sound}</button>${fs ? `<button class="hw-icon hw-fs" aria-label="Full screen">${ICON.fullscreen}</button>` : ''}</div>
      <div class="hw-cards">${CARDS}</div>
      <div class="hw-ctrl"></div>
      <div class="hw-best"></div>`;
    this.bestEl = title.querySelector('.hw-best');
    const startBtn = this.startBtn = title.querySelector('.hw-start');
    wire(startBtn, () => onStart && onStart());
    // ---- pause
    const pause = this.pause = el('div', 'hw-screen off', root);
    pause.innerHTML = `<div class="hw-h1">PAUSED</div><div class="hw-sub">THE GHOSTS ARE WAITING</div>
      <div class="hw-small-btns" style="margin-top:10px"><button class="hw-start" data-a="resume">RESUME</button></div>
      <div class="hw-small-btns"><button class="hw-btn2" data-a="restart">RESTART</button><button class="hw-btn2" data-a="help">HOW TO PLAY</button><button class="hw-btn2" data-a="title">TITLE</button></div>
      <div class="hw-small-btns"><button class="hw-btn2" data-a="music">MUSIC: ON</button><button class="hw-btn2 hw-mute" data-a="sound">SOUND: ON</button></div>`;
    pause.querySelector('[data-a=resume]').addEventListener('click', stop(() => onResume && onResume()));
    pause.querySelector('[data-a=restart]').addEventListener('click', stop(() => onRestart && onRestart()));
    pause.querySelector('[data-a=title]').addEventListener('click', stop(() => onTitle && onTitle()));
    this.musicBtn = pause.querySelector('[data-a=music]');
    this.musicBtn.addEventListener('click', stop(() => onMusic && onMusic()));
    // ---- how to play (over the title or the pause screen)
    const help = this.help = el('div', 'hw-screen hw-help off', root);
    help.innerHTML = `<div class="hw-h1">HOW TO PLAY</div><div class="hw-cards">${CARDS}</div><div class="hw-ctrl"></div>
      <div class="hw-tips">Swirl lollipops under a light beam are worth 5. Jump onto a lantern to stomp it for extra candy.
      When the screen edges frost over, a ghost is close: let it come near, then BOO! Caught? Grab the candy you drop.
      Jump over the graveyard fence! Grab candy fast for a streak bonus. The last 30 seconds are the Witching Hour:
      candy counts double!</div>
      <div class="hw-small-btns"><button class="hw-start" data-a="close">GOT IT</button></div>`;
    wire(help.querySelector('[data-a=close]'), () => this.showHelp(false));
    for (const b of root.querySelectorAll('[data-a=help]')) wire(b, () => this.showHelp(true));
    for (const b of root.querySelectorAll('.hw-screen .hw-mute')) this.muteBtns.push(b);
    for (const b of this.muteBtns) wire(b, () => onMute && onMute());
    for (const b of root.querySelectorAll('.hw-screen .hw-fs')) this.fsBtns.push(b);
    for (const b of this.fsBtns) wire(b, toggleFullscreen);
    if (fs) for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => this._syncFullscreen());
    this.ctrlEls = [...root.querySelectorAll('.hw-ctrl')];
    // ---- results
    const over = this.over = el('div', 'hw-screen off', root);
    over.innerHTML = `<div class="hw-sub">THE CLOCK STRUCK</div><div class="hw-h1">MIDNIGHT!</div>
      <div class="hw-score">${ICON.candy}<span class="n">0</span></div>
      <div class="hw-rank"></div><div class="hw-ladder">${'<i><b></b></i>'.repeat(RANKS.length)}</div><div class="hw-next"></div><div class="hw-best-line"></div>
      <div class="hw-stats"></div>
      <div class="hw-small-btns hw-row" style="margin-top:6px"><button class="hw-start" data-a="again">PLAY AGAIN</button><i class="hw-break"></i><button class="hw-btn2" data-a="title">TITLE</button><button class="hw-icon hw-share" data-a="share" aria-label="Share your score">${ICON_SHARE}</button></div>
      <div class="hw-pill hw-toast"></div>`;
    this.overN = over.querySelector('.n'); this.overRank = over.querySelector('.hw-rank'); this.overBest = over.querySelector('.hw-best-line'); this.overStats = over.querySelector('.hw-stats');
    this.ladder = [...over.querySelectorAll('.hw-ladder b')]; this.overNext = over.querySelector('.hw-next'); this.toastEl = over.querySelector('.hw-toast');
    this.againBtn = over.querySelector('[data-a=again]');
    // the results come up while a thumb may still be hammering JUMP / BOO (TITLE sits where JUMP was in portrait):
    // taps in the first moments after they appear are ignored
    this._overAt = 0;
    const settled = (fn) => stop(() => { if (performance.now() - this._overAt > 800) fn(); });
    this.againBtn.addEventListener('click', settled(() => onRestart && onRestart()));
    over.querySelector('[data-a=title]').addEventListener('click', settled(() => onTitle && onTitle()));
    over.querySelector('[data-a=share]').addEventListener('click', settled(() => onShare && onShare()));
    for (const s of [title, pause, over, help]) s.addEventListener('pointerdown', (e) => e.stopPropagation());
    this._c = { candy: -1, clock: '', left: '', bar: -1, boo: -1, booReady: null, danger: -1, late: null, hot: false, fx: 50, fy: 50, goal: -2, wh: false, streak: -1, counting: false };
    this.setTouch(touch);
  }

  /** Touch presentation (start label, control hints, BOO pill hidden, the touch skin) or keyboard / mouse. */
  setTouch(on) {
    this.touch = !!on;
    this.root.classList.toggle('hw-touch', this.touch);
    document.body.classList.toggle('hw-touch-on', this.touch);
    this.startBtn.textContent = this.touch ? 'TAP TO START' : 'CLICK TO START';
    for (const c of this.ctrlEls) c.innerHTML = this.touch ? CTRL_TOUCH : CTRL_KEYS;
  }
  showHelp(on) { this.help.classList.toggle('off', !on); }
  _syncFullscreen() { const f = isFullscreen(); for (const b of this.fsBtns) { b.innerHTML = f ? ICON.windowed : ICON.fullscreen; b.setAttribute('aria-label', f ? 'Leave full screen' : 'Full screen'); } }

  showTitle(best) {
    this.bestEl.textContent = best > 0 ? `BEST ${best} CANDY` : '';
    this.title.classList.remove('off'); this.hud.classList.add('off'); this.pause.classList.add('off'); this.over.classList.add('off');
    this.showHelp(false);
    this.setTouchVisible(false);
  }
  showPlay() {
    this.title.classList.add('off'); this.pause.classList.add('off'); this.over.classList.add('off'); this.hud.classList.remove('off');
    this.hideEdges(); this.lookHint(null); this.setBooHot(false);
    this.setWitching(false); this.setStreak(0, false); this.setCounting(false); this.clock.classList.remove('pacing');
    this.showHelp(false);
    this.setTouchVisible(true);
  }
  showPause(on) { this.pause.classList.toggle('off', !on); if (!on) this.showHelp(false); this.setTouchVisible(!on); }
  setMusicLabel(on) { this.musicBtn.textContent = `MUSIC: ${on ? 'ON' : 'OFF'}`; }
  setTouchVisible(on) { document.body.classList.toggle('hw-hidden-touch', !on); }
  hideEdges() { this.setEdge(this.popEdge, false); for (const g of this.ghostEdges) this.setEdge(g, false); }
  setMuted(m) {
    for (const b of this.muteBtns) {
      if (b.dataset.a === 'sound') b.textContent = `SOUND: ${m ? 'OFF' : 'ON'}`; else b.innerHTML = m ? ICON.muted : ICON.sound;
      b.setAttribute('aria-pressed', String(!!m));
    }
  }

  /**
   * The results: candy, rank, the rank ladder (filled up to the next rank) with what the next rank takes, the best,
   * four stats.
   */
  showResults({ candy, best, isBest, smashed, booed, caught, streak }) {
    this.overN.textContent = String(candy);
    const ri = rankIndex(candy), next = ri + 1 < RANKS.length ? RANKS[ri + 1] : null;
    this.overRank.textContent = RANKS[ri][1];
    this.ladder.forEach((b, k) => {
      const f = k < ri ? 1 : k > ri ? 0 : next ? (candy - RANKS[ri][0]) / (next[0] - RANKS[ri][0]) : 1;
      b.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
    });
    this.overNext.textContent = next ? `${next[0] - candy} MORE FOR ${next[1].toUpperCase()}` : '';
    this.overBest.innerHTML = isBest ? '<span class="hw-newbest">NEW BEST!</span>' : `<span class="hw-best">BEST ${best}</span>`;
    this.overStats.innerHTML = `<div><b>${smashed}</b><span>LANTERNS</span></div><div><b>${booed}</b><span>GHOSTS BOOED</span></div><div><b>${streak}</b><span>BEST STREAK</span></div><div><b>${caught}</b><span>TIMES CAUGHT</span></div>`;
    this.toastEl.classList.remove('go');
    this.hud.classList.add('off'); this.over.classList.remove('off');
    this.showHelp(false);
    this._overAt = performance.now();
    this.setTouchVisible(false);
  }

  /** The next rank's threshold after the count ("/100"); null (top rank) shows nothing. */
  setGoal(at) {
    const v = at == null ? -1 : at;
    if (v !== this._c.goal) { this._c.goal = v; this.goalEl.textContent = v < 0 ? '' : `/${v}`; }
  }
  /** Witching Hour on the candy pill: the x2 badge and a warm glow. */
  setWitching(on) { if (on !== this._c.wh) { this._c.wh = on; this.candyEl.classList.toggle('wh', on); } }
  /** The pace against the best run at this moment of the round, in the clock's time-left line for ~2.6 s. */
  pace(diff) {
    const p = this.paceEl, c = this.clock;
    p.textContent = `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} VS BEST`;
    p.classList.toggle('up', diff >= 0); p.classList.toggle('down', diff < 0);
    c.classList.remove('pacing'); void c.offsetWidth; c.classList.add('pacing');
  }
  /** The streak meter on the candy pill: `filled` segments lit, on = shown. */
  setStreak(filled, on) {
    const v = on ? filled : -1;
    if (v === this._c.streak) return;
    this._c.streak = v;
    this.streakEl.classList.toggle('on', on);
    if (on) for (let k = 0; k < this.pips.length; k++) this.pips[k].classList.toggle('f', k < filled);
  }
  /** The last-ten countdown is up under the clock (the call-outs move lower, out of its way). */
  setCounting(on) { if (on !== this._c.counting) { this._c.counting = on; this.hud.classList.toggle('counting', on); } }
  /** A short message at the bottom of the results ("COPIED!"). */
  toast(text) { const t = this.toastEl; t.textContent = text; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }

  setCandy(n, bump = true) {
    if (this._c.candy === n) return;
    this._c.candy = n; this.candyNum.textContent = String(n);
    if (bump) { const c = this.candyEl; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
  }
  plusText(text, bad = false) {
    const p = this.plus;
    p.textContent = text; p.classList.toggle('bad', bad);
    p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
  }
  /** remaining / total seconds of the round. */
  setClock(remaining, total) {
    // the time of day counts down to midnight (a 3-minute round starts at 11:57:00; other lengths end at 12 too)
    const r = Math.max(0, Math.ceil(remaining)), before = Math.min(3599, r); // seconds before midnight
    const mins = 59 - Math.floor((before - 1) / 60), secs = (60 - (before % 60)) % 60;
    const t = r <= 0 ? '12:00 AM' : `11:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} PM`;
    if (t !== this._c.clock) { this._c.clock = t; this.clockTime.textContent = t; }
    const left = r <= 0 ? 'MIDNIGHT!' : `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')} TO MIDNIGHT`;
    if (left !== this._c.left) { this._c.left = left; this.clockLeft.textContent = left; }
    const bar = Math.round((1 - remaining / total) * 200) / 2;
    if (bar !== this._c.bar) { this._c.bar = bar; this.clockBar.style.width = `${bar}%`; }
    const late = r <= 30;
    if (late !== this._c.late) { this._c.late = late; this.clock.classList.toggle('late', late); }
  }
  /** p = 0..1 recharge (1 = ready). */
  setBoo(p) {
    const q = Math.round(p * 50) / 50;
    if (q !== this._c.boo) { this._c.boo = q; this.booRing.style.setProperty('--p', String(q)); }
    const ready = p >= 1;
    if (ready !== this._c.booReady) { this._c.booReady = ready; this.boo.classList.toggle('ready', ready); }
  }
  /** A big centre call-out; `sub` (optional) is a smaller second line under it. */
  callout(text, cls = '', sub = '') {
    const c = this.call;
    c.textContent = text; c.className = `hw-call ${cls}`;
    if (sub) { this.callSub.textContent = sub; c.appendChild(this.callSub); }
    void c.offsetWidth; c.classList.add('go');
  }
  /** Desktop look hint: ok true (mouse captured), false (refused: click / arrows), null hides it. */
  lookHint(ok) {
    if (ok == null) { this.hint.classList.remove('on'); return; }
    this.hint.textContent = ok ? 'MOVE THE MOUSE TO LOOK · ESC FREES IT' : 'CLICK THE VIEW TO LOOK · OR USE ← →';
    this.hint.classList.add('on');
  }
  /** BOO glows while a chaser is in reach and BOO is ready (desktop pill; the touch button is toggled by the game). */
  setBooHot(on) { if (on !== this._c.hot) { this._c.hot = on; this.boo.classList.toggle('hot', on); } }
  /**
   * Place an edge marker (this.popEdge / this.ghostEdges[i]): on, screen position (CSS px), arrow angle (rad, 0 = up,
   * clockwise), opacity 0..1, distance (m; < 0 = no label). Writes the DOM only when a rounded value changes.
   */
  setEdge(m, on, x = 0, y = 0, ang = 0, op = 1, dist = -1) {
    if (on !== m.on) { m.on = on; m.el.classList.toggle('on', on); }
    if (!on) return;
    const px = Math.round(x), py = Math.round(y), a = Math.round(ang * 30) / 30, o = Math.round(op * 20) / 20, d = dist < 0 ? -1 : Math.round(dist);
    if (px !== m.x || py !== m.y) { m.x = px; m.y = py; m.el.style.transform = `translate3d(${px}px,${py}px,0)`; }
    if (a !== m.a) { m.a = a; m.arr.style.transform = `rotate(${a}rad)`; }
    if (o !== m.o) { m.o = o; m.el.style.opacity = String(o); }
    if (d !== m.d) { m.d = d; m.num.textContent = d < 0 ? '' : `${d} m`; }
  }
  countdown(n) {
    this.setCounting(true);
    const c = this.count;
    c.textContent = String(n); c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
  }
  flash() { const f = this.flashEl; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  /** Frost 0..1; ang (rad, 0 = ahead / up, + = right): the ghost's side, where the frost gathers. */
  setDanger(v, ang = null) {
    const q = Math.round(v * 20) / 20;
    if (q !== this._c.danger) { this._c.danger = q; this.danger.style.opacity = String(q); }
    if (q > 0 && ang != null) {
      const fx = Math.round(50 - Math.sin(ang) * 16), fy = Math.round(50 + Math.cos(ang) * 14);
      if (fx !== this._c.fx || fy !== this._c.fy) { this._c.fx = fx; this._c.fy = fy; this.danger.style.setProperty('--fx', `${fx}%`); this.danger.style.setProperty('--fy', `${fy}%`); }
    }
  }
}
