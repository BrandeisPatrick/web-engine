// LoadingScreen — full-screen loading overlay (title, progress bar, label) with a fade-out.
// Matches the Roadster index.html overlay so games can share it.
//   const ls = new LoadingScreen({ title: 'ROADSTER', label: 'Loading city…' });
//   ls.setProgress(0.4, 'Building car…');  await ls.hide();   // fades out (500 ms) and removes itself
//   LoadingScreen.adopt(document.getElementById('loading'))   // wrap an existing inline overlay
// compositor: true (opt-in) keeps the bar visibly moving while the main thread is busy (shader compiles, texture
// uploads, world building): the fill is a scaleX transform and a light sweeps along the track with a Web Animations
// transform loop, both of which the browser runs on the compositor thread. Without it the bar is exactly as before.
import { injectStyle, theme } from './theme.js';

const CSS = `
.ui-loading{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ddd;
  background:#06080c;z-index:100;font-family:-apple-system,system-ui,sans-serif}
.ui-loading h2{margin:0;font-weight:500;letter-spacing:.2em}
.ui-loading .bar{width:320px;max-width:calc(100vw - 48px);height:4px;background:#222;margin-top:16px;border-radius:2px;overflow:hidden}
.ui-loading .bar>div{height:100%;width:0%;background:var(--ui-accent,${theme.accent});transition:width .2s}
.ui-loading small{opacity:.6;margin-top:10px}
.ui-loading .bar.comp{position:relative}
.ui-loading .bar.comp>div{width:100%;transform:scaleX(0);transform-origin:0 50%;transition:transform .3s ease-out}
.ui-loading .bar.comp>i{position:absolute;top:0;left:0;width:30%;height:100%;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:translateX(-100%)}
`;

export class LoadingScreen {
  /**
   * @param {object} [o]  title, label, parent=document.body, accent, background
   * @param {string} [o.title]
   * @param {string} [o.label]
   * @param {HTMLElement} [o.parent]
   * @param {string} [o.accent]
   * @param {string} [o.background]
   * @param {boolean} [o.compositor=false]  keep the bar moving while the main thread is busy (see header)
   * @param {HTMLElement} [o.adopt]  wrap this existing overlay instead of building one
   */
  constructor(o = {}) {
    /** @type {Animation | null} the compositor sweep (compositor: true), cancelled by hide() / dispose() */
    this._sweep = null;
    this.compositor = false;
    if (o.adopt) {
      this.el = o.adopt;
      this.barEl = o.adopt.querySelector('.bar > div');
      this.labelEl = o.adopt.querySelector('small');
      this.titleEl = o.adopt.querySelector('h2');
    } else {
      injectStyle('ui-loading', CSS);
      const root = this.el = document.createElement('div');
      root.className = 'ui-loading';
      this.titleEl = document.createElement('h2');
      this.titleEl.textContent = o.title ?? 'LOADING';
      const bar = document.createElement('div'); bar.className = 'bar';
      this.barEl = document.createElement('div');
      bar.appendChild(this.barEl);
      if (o.compositor) {
        this.compositor = true;
        bar.classList.add('comp');
        const sweep = document.createElement('i');
        bar.appendChild(sweep);
        if (typeof sweep.animate === 'function') {
          this._sweep = sweep.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(340%)' }],
            { duration: 1400, iterations: Infinity, easing: 'ease-in-out' });
        }
      }
      this.labelEl = document.createElement('small');
      this.labelEl.textContent = o.label ?? 'Loading…';
      root.append(this.titleEl, bar, this.labelEl);
      if (o.accent) root.style.setProperty('--ui-accent', o.accent);
      if (o.background) root.style.background = o.background;
      (o.parent || document.body).appendChild(root);
    }
    this.progress = 0;
  }

  static adopt(element) { return new LoadingScreen({ adopt: element }); }

  /**
   * @param {number} p  0..1
   * @param {string} [label]
   */
  setProgress(p, label) {
    this.progress = Math.min(1, Math.max(0, p || 0));
    if (this.barEl) {
      if (this.compositor) this.barEl.style.transform = `scaleX(${this.progress.toFixed(3)})`;
      else this.barEl.style.width = `${Math.round(this.progress * 100)}%`;
    }
    if (label && this.labelEl) this.labelEl.textContent = label;
  }
  /** @param {string} text */
  setLabel(text) { if (this.labelEl) this.labelEl.textContent = text; }
  /** Show an error in the label (bar stops). */
  error(msg) { this.setLabel(msg); if (this.barEl) this.barEl.style.background = '#a33'; this._stopSweep(); }
  _stopSweep() { if (this._sweep) { this._sweep.cancel(); this._sweep = null; } }

  /** Fade out over ms and remove. Resolves when gone. */
  hide(ms = 500) {
    const e = this.el;
    if (!e || !e.isConnected) return Promise.resolve();
    e.style.transition = `opacity ${ms / 1000}s`;
    e.style.opacity = '0';
    e.style.pointerEvents = 'none';
    return new Promise((res) => setTimeout(() => { this._stopSweep(); e.remove(); res(); }, ms + 50));
  }
  dispose() { this._stopSweep(); if (this.el) this.el.remove(); }
}
