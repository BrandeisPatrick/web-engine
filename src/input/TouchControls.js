// On-screen virtual sticks and buttons for touch screens (DOM + pointer events).
// Writes into an InputMap's virtual sources, so actions bind to them with { virtual: 'stick.x' }:
//   stick  id -> `${id}.x`, `${id}.y`   (-1..1, +x right, +y down — same convention as gamepad axes)
//   button id -> `${id}`                 (0 / 1)
//
//   const touch = new TouchControls({ input, layout: [
//     { type: 'stick', id: 'stick', side: 'left', x: 110, y: 110, radius: 64 },
//     { type: 'button', id: 'jump', label: 'A', side: 'right', x: 70, y: 90, size: 68 },
//   ], show: 'auto' });   // 'auto' = only on coarse-pointer (touch-first) devices
//
// x / y are the centre's distance in CSS px from the chosen bottom corner (or top corner with top: true).
//
// Phone options (all opt-in; without them the controls are placed and behave exactly as above):
//   safeArea: true (constructor)   every offset also clears the notch / home indicator: the distance to each edge is
//                                  measured from env(safe-area-inset-<edge>) (needs viewport-fit=cover to be non-zero)
//   portrait: { x, y, size, radius, side, top, zone, ... } (entry)   fields that replace the entry's own while the
//                                  viewport is portrait (innerHeight > innerWidth); the layout is re-applied on resize /
//                                  orientationchange (listeners only exist when some entry has an override)
//   floating: true (stick entry)   the stick's base jumps under the finger wherever it lands in the stick's zone
//                                  (zone: { width: 0.5 = fraction of the screen width from the stick's side, top: 0,
//                                  bottom: 0 = px insets }) and returns to its rest spot (x, y) on release; the zone is
//                                  a transparent element under the stick (a touch on the base re-centres it too).
//   hitSlop: px (button entry)     an invisible ring that far around the button also presses it (a thumb that lands
//                                  a little off still hits); the drawn button and its bounding box keep their size.
//                                  Takes a portrait override like the other fields.
// Methods: get(id) -> control | null, setLabel(id, text), setProgress(id, p) (a button's cooldown ring: p in [0, 1)
//   draws the ring filled to p and dims the button, p >= 1 removes it; the DOM is only touched when the percentage
//   changes, and no string is built per call), relayout() (re-place for the current orientation; also clears active
//   touches, since the controls move), setVisible(on), releaseAll(), dispose().

const CSS = `
.ui-touch{position:fixed;inset:0;pointer-events:none;z-index:30;user-select:none;-webkit-user-select:none;touch-action:none}
.ui-touch.hidden{display:none}
.ui-touch-stick,.ui-touch-btn{position:absolute;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
.ui-touch-stick{border-radius:50%;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.22);
  box-shadow:inset 0 0 24px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ui-touch-knob{position:absolute;left:50%;top:50%;border-radius:50%;background:rgba(255,255,255,.28);
  border:1.5px solid rgba(255,255,255,.55);transform:translate(-50%,-50%);transition:background .15s}
.ui-touch-stick.on .ui-touch-knob{background:rgba(255,255,255,.45)}
.ui-touch-btn{display:flex;align-items:center;justify-content:center;border-radius:50%;
  background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.25);color:rgba(255,255,255,.85);
  font:600 13px/1 -apple-system,system-ui,sans-serif;letter-spacing:.08em;transition:background .1s,transform .1s;
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ui-touch-btn.on{background:rgba(var(--ui-accent-rgb,232,33,39),.45);border-color:var(--ui-accent,#e82127);transform:scale(.94)}
.ui-touch-zone{position:absolute;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
.ui-touch-slop{position:absolute;border-radius:50%;pointer-events:auto;touch-action:none}
.ui-touch-stick.floating{opacity:.6;transition:opacity .15s}
.ui-touch-stick.floating.on{opacity:1}
.ui-touch-btn.cooling{opacity:.72}
.ui-touch-btn.cooling::after{content:"";position:absolute;inset:-6px;border-radius:50%;pointer-events:none;
  background:conic-gradient(var(--ui-accent,#e82127) calc(var(--ui-touch-p,0) * 1turn),rgba(255,255,255,.14) 0);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 4px));
  mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 4px))}
`;

let styleInjected = false;
function injectCSS() {
  if (styleInjected || typeof document === 'undefined') return;
  const st = document.createElement('style');
  st.id = 'ui-touch-style'; st.textContent = CSS;
  document.head.appendChild(st);
  styleInjected = true;
}

function capture(node, id) { try { node.setPointerCapture(id); } catch { /* synthetic / already released pointer */ } }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let PCT = null; // '0.00' .. '1.00': the cooldown ring's CSS values, built once
const pct = (q) => { if (!PCT) { PCT = []; for (let i = 0; i <= 100; i++) PCT.push((i / 100).toFixed(2)); } return PCT[q]; };

/**
 * True on touch-first devices (phones/tablets), false on mouse/trackpad machines.
 * Default: the primary pointer is coarse and no fine pointer is attached. `{ multiTouch: true }` (opt-in) also counts a
 * coarse primary pointer on a multi-touch screen (navigator.maxTouchPoints > 1) that has a fine pointer too: an iPad
 * with a keyboard / trackpad (iPadOS Safari reports a Mac user agent, so only these queries tell), a phone with a
 * stylus. A laptop with a touchscreen (fine primary pointer) stays false: reveal its controls on the first touch
 * instead (CharacterInput `touchReveal`).
 * @param {{ multiTouch?: boolean }} [o]
 */
export function isTouchDevice(o) {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (!window.matchMedia('(pointer: coarse)').matches) return false;
  if (!window.matchMedia('(any-pointer: fine)').matches) return true;
  const nav = window.navigator;
  return !!(o && o.multiTouch && nav && nav.maxTouchPoints > 1);
}

/** True while the viewport is taller than wide (false outside the browser). */
export function isPortrait() {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
}

/**
 * The layout entry in effect: `c` itself, or (portrait and `c.portrait` set) a copy with the portrait fields applied.
 * Pure; used by TouchControls and CharacterInput's touchpads.
 */
export function resolveTouchEntry(c, portrait) {
  return portrait && c && c.portrait ? { ...c, ...c.portrait } : c;
}

/** CSS length for an offset from `edge`: the px value, or calc(px + env(safe-area-inset-<edge>)) with safeArea. */
export function touchEdge(px, edge, safeArea) {
  return safeArea ? `calc(${px}px + env(safe-area-inset-${edge}, 0px))` : `${px}px`;
}

export class TouchControls {
  /**
   * @param {object} o
   * @param {import('./InputMap.js').InputMap} o.input
   * @param {Array<object>} o.layout
   * @param {HTMLElement} [o.container=document.body]
   * @param {'auto'|boolean} [o.show='auto']
   * @param {boolean} [o.safeArea=false]  offsets measured from the safe-area insets (see header)
   */
  constructor(o = {}) {
    this.input = o.input;
    this.layout = o.layout || [];
    this.container = o.container || document.body;
    this.safeArea = !!o.safeArea;
    this.portrait = false;
    injectCSS();
    this.root = document.createElement('div');
    this.root.className = 'ui-touch';
    this.container.appendChild(this.root);
    this.controls = [];
    const responsive = this.layout.some((c) => c && c.portrait);
    if (responsive) this.portrait = isPortrait();
    for (const c of this.layout) this.controls.push(c.type === 'stick' ? this._stick(c) : this._button(c));
    this._onResize = null;
    if (responsive && typeof window !== 'undefined') {
      this._onResize = () => { if (isPortrait() !== this.portrait) this.relayout(); };
      window.addEventListener('resize', this._onResize);
      window.addEventListener('orientationchange', this._onResize);
    }
    const show = o.show ?? 'auto';
    this.setVisible(show === 'auto' ? isTouchDevice() : !!show);
  }

  get visible() { return !this.root.classList.contains('hidden'); }
  setVisible(on) {
    this.root.classList.toggle('hidden', !on);
    if (!on) this.releaseAll();
  }

  /** The control with this id (stick or button), or null. */
  get(id) {
    for (let i = 0; i < this.controls.length; i++) if (this.controls[i].id === id) return this.controls[i];
    return null;
  }

  /** Change a button's label (no DOM write when unchanged). */
  setLabel(id, text) {
    const c = this.get(id);
    if (!c || c.type !== 'button') return;
    const t = String(text);
    if (c.el.textContent !== t) { c.el.textContent = t; if (c.slop) c.el.appendChild(c.slop); }
  }

  /** Cooldown ring of a button: p in [0, 1) shows it filled to p (and dims the button), p >= 1 removes it. */
  setProgress(id, p) {
    const c = this.get(id);
    if (!c || c.type !== 'button') return;
    const q = p >= 1 ? 100 : p > 0 ? Math.floor(p * 100) : 0;
    if (c.progress === q) return;
    c.progress = q;
    c.el.classList.toggle('cooling', q < 100);
    c.el.style.setProperty('--ui-touch-p', pct(q));
  }

  /** Re-place every control for the current orientation (portrait overrides); active touches are released. */
  relayout() {
    this.portrait = isPortrait();
    this.releaseAll();
    for (const ctl of this.controls) ctl.place();
  }

  _place(node, c, w, h) {
    const s = node.style, sa = this.safeArea;
    s.width = `${w}px`; s.height = `${h}px`;
    const x = c.x ?? 100, y = c.y ?? 100;
    if (c.side === 'right') { s.right = touchEdge(x - w / 2, 'right', sa); s.left = ''; } else { s.left = touchEdge(x - w / 2, 'left', sa); s.right = ''; }
    if (c.top) { s.top = touchEdge(y - h / 2, 'top', sa); s.bottom = ''; } else { s.bottom = touchEdge(y - h / 2, 'bottom', sa); s.top = ''; }
  }

  _placeZone(node, c) {
    const z = c.zone || {}, s = node.style, sa = this.safeArea;
    s.top = touchEdge(z.top ?? 0, 'top', sa); s.bottom = touchEdge(z.bottom ?? 0, 'bottom', sa);
    s.width = `${(z.width ?? 0.5) * 100}%`;
    if (c.side === 'right') { s.right = '0'; s.left = ''; } else { s.left = '0'; s.right = ''; }
  }

  _stick(c0) {
    const base = document.createElement('div');
    base.className = 'ui-touch-stick';
    const knob = document.createElement('div');
    knob.className = 'ui-touch-knob';
    base.appendChild(knob);
    const zone = c0.floating ? document.createElement('div') : null;
    if (zone) { zone.className = 'ui-touch-zone'; this.root.appendChild(zone); base.classList.add('floating'); }
    this.root.appendChild(base);
    const ctl = { type: 'stick', id: c0.id, el: base, zone, pointer: null, x: 0, y: 0, r: 64, knobR: 27, floated: false };
    ctl.place = () => {
      const c = resolveTouchEntry(c0, this.portrait);
      ctl.r = c.radius ?? 64; ctl.knobR = c.knob ?? Math.round(ctl.r * 0.42);
      this._place(base, c, ctl.r * 2, ctl.r * 2);
      knob.style.width = knob.style.height = `${ctl.knobR * 2}px`;
      if (zone) this._placeZone(zone, c);
      ctl.floated = false;
    };
    ctl.place();
    const set = (x, y) => {
      ctl.x = x; ctl.y = y;
      const r = ctl.r;
      knob.style.transform = `translate(calc(-50% + ${(x * r).toFixed(1)}px), calc(-50% + ${(y * r).toFixed(1)}px))`;
      this.input && this.input.setVirtual(`${c0.id}.x`, x);
      this.input && this.input.setVirtual(`${c0.id}.y`, y);
    };
    const move = (e) => {
      const b = base.getBoundingClientRect(), r = ctl.r;
      let dx = (e.clientX - (b.left + b.width / 2)) / r, dy = (e.clientY - (b.top + b.height / 2)) / r;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      set(dx, dy);
    };
    const start = (e, node) => {
      ctl.pointer = e.pointerId; capture(node, e.pointerId); base.classList.add('on');
      move(e); e.preventDefault();
    };
    const end = (e) => { if (e.pointerId !== ctl.pointer) return; ctl.release(); };
    // floating: centre the base on the finger (kept on screen) before tracking it, whether the touch landed on the
    // zone or on the base itself (no jump of the knob on touch-down)
    const float = (e) => {
      const r = ctl.r, W = window.innerWidth, H = window.innerHeight, s = base.style;
      const cx = clamp(e.clientX, r, Math.max(r, W - r)), cy = clamp(e.clientY, r, Math.max(r, H - r));
      s.left = `${(cx - r).toFixed(1)}px`; s.top = `${(cy - r).toFixed(1)}px`; s.right = ''; s.bottom = '';
      ctl.floated = true;
    };
    base.addEventListener('pointerdown', (e) => { if (ctl.pointer != null) return; if (zone) float(e); start(e, base); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === ctl.pointer) move(e); });
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    if (zone) {
      zone.addEventListener('pointerdown', (e) => { if (ctl.pointer == null) { float(e); start(e, zone); } });
      zone.addEventListener('pointermove', (e) => { if (e.pointerId === ctl.pointer) move(e); });
      zone.addEventListener('pointerup', end);
      zone.addEventListener('pointercancel', end);
    }
    ctl.release = () => {
      ctl.pointer = null; base.classList.remove('on'); set(0, 0);
      if (ctl.floated) this._place(base, resolveTouchEntry(c0, this.portrait), ctl.r * 2, ctl.r * 2); // back to rest
      ctl.floated = false;
    };
    return ctl;
  }

  _button(c0) {
    const b = document.createElement('div');
    b.className = 'ui-touch-btn';
    b.textContent = c0.label ?? c0.id;
    this.root.appendChild(b);
    const ctl = { type: 'button', id: c0.id, el: b, pointers: new Set(), progress: 100, slop: null };
    ctl.place = () => {
      const c = resolveTouchEntry(c0, this.portrait), size = c.size ?? 64, h = c.hitSlop || 0;
      this._place(b, c, size, size);
      if (c.fontSize) b.style.fontSize = `${c.fontSize}px`;
      if (h > 0 && !ctl.slop) { ctl.slop = document.createElement('span'); ctl.slop.className = 'ui-touch-slop'; b.appendChild(ctl.slop); }
      if (ctl.slop) { const q = ctl.slop.style, v = `${-h}px`; q.top = q.right = q.bottom = q.left = v; q.display = h > 0 ? '' : 'none'; }
    };
    ctl.place();
    const sync = () => {
      const on = ctl.pointers.size > 0;
      b.classList.toggle('on', on);
      this.input && this.input.setVirtual(c0.id, on ? 1 : 0);
    };
    b.addEventListener('pointerdown', (e) => { ctl.pointers.add(e.pointerId); capture(b, e.pointerId); sync(); e.preventDefault(); });
    const end = (e) => { ctl.pointers.delete(e.pointerId); sync(); };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    ctl.release = () => { ctl.pointers.clear(); sync(); };
    return ctl;
  }

  releaseAll() { for (const c of this.controls) c.release(); }

  dispose() {
    this.releaseAll();
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
      this._onResize = null;
    }
    this.root.remove();
  }
}
